import { appendFile, existsSync, readFileSync, writeFile } from 'fs'
import { homedir, tmpdir } from 'os'
import { dirname, isAbsolute, join } from 'path'

const LOG = join(tmpdir(), 'coide-debug.log')

let logBuffer: string[] = []
let logFlushTimer: ReturnType<typeof setTimeout> | null = null

function log(msg: string): void {
  logBuffer.push(`[${new Date().toISOString()}] ${msg}`)
  console.log(msg)
  if (!logFlushTimer) logFlushTimer = setTimeout(flushLog, 200)
}

function flushLog(): void {
  logFlushTimer = null
  if (logBuffer.length === 0) return
  const batch = `${logBuffer.join('\n')}\n`
  logBuffer = []
  appendFile(LOG, batch, () => {})
}

writeFile(LOG, '', () => {})

export type CommandSpec = {
  file: string
  args: string[]
}

function quoteForCmd(arg: string): string {
  if (!arg) return '""'
  if (!/[\s"&<>|^()]/.test(arg)) return arg
  return `"${arg.replace(/"/g, '""')}"`
}

export function buildCommandSpec(command: string, args: string[]): CommandSpec {
  if (process.platform !== 'win32') return { file: command, args }

  if (/\.(exe|com)$/i.test(command)) return { file: command, args }

  if (/\.(cmd|bat)$/i.test(command) && existsSync(command)) {
    try {
      const shim = readFileSync(command, 'utf-8')
      const nodeExe = existsSync(join(dirname(command), 'node.exe'))
        ? join(dirname(command), 'node.exe')
        : 'node'
      const scriptMatch =
        shim.match(/"%dp0%\\([^"]+\.(?:js|cjs|mjs))"/i) ||
        shim.match(/"%~dp0\\([^"]+\.(?:js|cjs|mjs))"/i)

      if (scriptMatch?.[1]) {
        const scriptPath = join(dirname(command), ...scriptMatch[1].split('\\'))
        if (existsSync(scriptPath)) return { file: nodeExe, args: [scriptPath, ...args] }
      }
    } catch {}
  }

  const comspec = process.env['ComSpec'] || process.env['COMSPEC'] || 'C:\\Windows\\System32\\cmd.exe'
  const commandLine = [command, ...args].map(quoteForCmd).join(' ')
  return { file: comspec, args: ['/d', '/s', '/c', commandLine] }
}

export function resolveClaudeBinary(configured: string): string {
  if (configured && isAbsolute(configured)) return configured

  if (process.platform === 'win32') {
    const candidates = [
      join(homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd'),
      join(homedir(), 'AppData', 'Local', 'Programs', 'Claude', 'claude.exe')
    ]
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        log(`Resolved claude binary: ${candidate}`)
        return candidate
      }
    }
    return configured || 'claude'
  }

  const candidates = [
    join(homedir(), '.local', 'bin', 'claude'),
    join(homedir(), '.npm-global', 'bin', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude'
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      log(`Resolved claude binary: ${candidate}`)
      return candidate
    }
  }

  return configured || 'claude'
}

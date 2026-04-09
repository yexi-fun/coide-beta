import { app, BrowserWindow, Notification } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { readFile as readFileAsync } from 'fs/promises'
import { execFile } from 'child_process'
import { dirname, join } from 'path'
import { query } from '@anthropic-ai/claude-agent-sdk'
import type { CoideSettings } from '../shared/types'
import { clearPermissionRequests, registerPermissionRequest } from './permissionRegistry'
import { registerConversation, unregisterConversation } from './conversationRegistry'
import {
  adaptAssistantMessage,
  adaptToolProgress,
  adaptUserMessage,
  emitAssistantText,
  emitError,
  emitResult,
  emitStreamEnd,
  emitSystemInit,
  emitToolDenied,
  emitToolStart
} from './claudeEventAdapter'

let notificationsEnabled = true
let activeNotification: Notification | null = null

function notifyViaOsascript(title: string, body: string): void {
  if (process.platform !== 'darwin') return
  const script = `display notification ${JSON.stringify(body)} with title ${JSON.stringify(title)}`
  execFile('osascript', ['-e', script], () => {})
}

function notify(win: BrowserWindow, title: string, body: string): void {
  if (!notificationsEnabled || win.isDestroyed()) return
  const isFocused = BrowserWindow.getFocusedWindow()?.id === win.id
  if (isFocused) return
  app.dock?.bounce?.('informational')

  if (Notification.isSupported()) {
    try {
      activeNotification = new Notification({ title, body })
      activeNotification.on('click', () => {
        win.show()
        win.focus()
      })
      activeNotification.show()
    } catch {}
  }

  notifyViaOsascript(title, body)
}

function resolveSdkExecutablePath(command: string): string {
  if (!/\.(cmd|bat)$/i.test(command) || !existsSync(command)) return command

  try {
    const shim = readFileSync(command, 'utf-8')
    const match =
      shim.match(/"%dp0%\\([^"]+\.(?:js|cjs|mjs))"/i) ||
      shim.match(/"%~dp0\\([^"]+\.(?:js|cjs|mjs))"/i)
    if (!match?.[1]) return command
    const scriptPath = join(dirname(command), ...match[1].split('\\'))
    return existsSync(scriptPath) ? scriptPath : command
  } catch {
    return command
  }
}

async function captureOriginalContent(toolName: string, input: Record<string, unknown>): Promise<string | null> {
  if (toolName !== 'Edit' && toolName !== 'Write') return null
  const filePath = String(input.file_path ?? input.path ?? '')
  if (!filePath) return null
  try {
    return await readFileAsync(filePath, 'utf-8')
  } catch {
    return null
  }
}

type ToolRequestInfo = {
  toolId: string
  toolName: string
  input: Record<string, unknown>
  originalContent?: string | null
}

const PERMISSION_REQUIRED = new Set(['Bash', 'Edit', 'Write', 'ExitPlanMode'])

type RunClaudeSdkParams = {
  prompt: string
  cwd: string
  sessionId: string | null
  coideSessionId: string
  win: BrowserWindow
  settings: CoideSettings
  claudeBin: string
}

function coideSystemPrompt(cwd: string, extraPrompt: string): string {
  const base = [
    'You are running inside coide, a desktop GUI for Claude Code.',
    'Tool call results are NOT shown inline — they are hidden inside collapsible cards the user may not open.',
    'You MUST always include relevant output (file contents, command results, directory listings, etc.) directly in your text response.',
    'Never say "here it is" or "see above" without actually showing the content in your message.',
    `The current working directory is: ${cwd}. When the user says "your directory" or "this directory", they mean this path.`
  ].join(' ')
  return extraPrompt ? `${base}\n\n${extraPrompt}` : base
}

export async function runClaudeViaSdk(params: RunClaudeSdkParams): Promise<string | null> {
  const { prompt, cwd, sessionId, coideSessionId, win, settings, claudeBin } = params
  const abortController = new AbortController()
  notificationsEnabled = settings.notifications
  const executablePath = resolveSdkExecutablePath(claudeBin)
  let resultSessionId: string | null = sessionId
  let streamEnded = false
  let lastToolById = new Map<string, ToolRequestInfo>()

  const finish = (): void => {
    if (streamEnded) return
    streamEnded = true
    clearPermissionRequests(coideSessionId)
    unregisterConversation(coideSessionId)
    emitStreamEnd(win, coideSessionId)
  }

  registerConversation(coideSessionId, { abortController, settle: finish })

  const options: Record<string, unknown> = {
    cwd,
    abortController,
    permissionMode: settings.planMode ? 'plan' : 'acceptEdits',
    includePartialMessages: true,
    pathToClaudeCodeExecutable: executablePath,
    systemPrompt: coideSystemPrompt(cwd, settings.systemPrompt)
  }

  if (sessionId) options.resume = sessionId
  if (settings.model) options.model = settings.model
  if (settings.effort) options.effort = settings.effort

  options.canUseTool = async (toolName: string, input: Record<string, unknown>, meta: Record<string, unknown>) => {
    const toolId = String(meta.toolUseID ?? meta.tool_use_id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    const request: ToolRequestInfo = {
      toolId,
      toolName,
      input,
      originalContent: await captureOriginalContent(toolName, input)
    }
    lastToolById.set(toolId, request)

    if (settings.skipPermissions || !PERMISSION_REQUIRED.has(toolName)) {
      emitToolStart(win, coideSessionId, request)
      return { behavior: 'allow', updatedInput: input }
    }

    win.webContents.send('claude:permission', {
      tool_id: request.toolId,
      tool_name: request.toolName,
      input: request.input,
      originalContent: request.originalContent,
      coideSessionId
    })
    notify(win, 'Permission Needed', `Claude wants to use ${toolName}`)

    const approved = await new Promise<boolean>((resolve) => {
      registerPermissionRequest(coideSessionId, resolve)
      abortController.signal.addEventListener('abort', () => resolve(false), { once: true })
    })

    if (!approved) {
      emitToolDenied(win, coideSessionId, request)
      return { behavior: 'deny' }
    }

    emitToolStart(win, coideSessionId, request)
    return { behavior: 'allow', updatedInput: input }
  }

  const conversation = query({
    prompt,
    options: options as never
  }) as AsyncIterable<Record<string, unknown>>

  try {
    let streamedAssistantText = false
    for await (const raw of conversation) {
      const type = String(raw.type ?? '')

      if (type === 'system' && raw.subtype === 'init') {
        emitSystemInit(win, coideSessionId, {
          mcpServers: raw.mcp_servers ?? raw.mcpServers,
          tools: raw.tools
        })
        continue
      }

      if (type === 'stream_event') {
        const event = (raw.event ?? {}) as Record<string, unknown>
        const delta = (event.delta ?? {}) as Record<string, unknown>
        if (String(event.type ?? '') === 'content_block_delta' && typeof delta.text === 'string' && delta.text) {
          streamedAssistantText = true
          emitAssistantText(win, coideSessionId, delta.text)
        }
        if (typeof delta.thinking === 'string' && delta.thinking) {
          emitThinking(win, coideSessionId, delta.thinking)
        }
        continue
      }

      if (type === 'assistant' || type === 'partial_assistant') {
        adaptAssistantMessage(win, coideSessionId, raw, (block) => {
          const toolId = String(block.id ?? block.tool_use_id ?? '')
          if (!toolId) return
          lastToolById.set(toolId, {
            toolId,
            toolName: String(block.name ?? 'Unknown'),
            input: (block.input as Record<string, unknown>) ?? {}
          })
        }, { emitText: !streamedAssistantText })
        continue
      }

      if (type === 'user') {
        adaptUserMessage(win, coideSessionId, raw)
        continue
      }

      if (type === 'tool_progress') {
        adaptToolProgress(win, coideSessionId, raw)
        continue
      }

      if (type === 'result') {
        resultSessionId = String(raw.session_id ?? raw.sessionId ?? sessionId ?? '') || null
        const resultText = String(raw.result ?? '')
        const isError = Boolean(raw.is_error ?? raw.isError)
        emitResult(win, coideSessionId, {
          result: resultText,
          sessionId: resultSessionId,
          isError
        })
        notify(win, isError ? 'Task Failed' : 'Task Complete', (resultText || 'Claude finished your task').slice(0, 80))
      }
    }
  } catch (err) {
    const aborted = abortController.signal.aborted
    if (!aborted) {
      emitError(win, coideSessionId, String(err))
      finish()
      throw err
    }
  }

  finish()
  return resultSessionId
}

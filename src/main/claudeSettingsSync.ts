import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import type { CoideSettings, ThirdPartyProviderSettings } from '../shared/types'

const CLAUDE_SETTINGS_DIR = join(homedir(), '.claude')
const CLAUDE_SETTINGS_PATH = join(CLAUDE_SETTINGS_DIR, 'settings.json')
const PROVIDER_KEYS = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN'] as const
const MODEL_KEYS = [
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_REASONING_MODEL'
] as const

type ClaudeSettingsJson = Record<string, unknown>
type ClaudeEnvJson = Record<string, unknown>
type ClaudeProviderSnapshot = {
  baseUrl: string
  apiKey: string
  model: string
}

let settingsWriteQueue = Promise.resolve()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readStringSetting(
  env: ClaudeEnvJson | null,
  json: ClaudeSettingsJson,
  key: string
): string {
  const envValue = env?.[key]
  if (typeof envValue === 'string' && envValue.trim()) {
    return envValue.trim()
  }

  const rootValue = json[key]
  if (typeof rootValue === 'string' && rootValue.trim()) {
    return rootValue.trim()
  }

  return typeof envValue === 'string'
    ? envValue.trim()
    : typeof rootValue === 'string'
      ? rootValue.trim()
      : ''
}

async function readClaudeSettings(): Promise<ClaudeSettingsJson> {
  try {
    const parsed = JSON.parse(await readFile(CLAUDE_SETTINGS_PATH, 'utf-8')) as unknown
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

async function writeClaudeSettings(json: ClaudeSettingsJson): Promise<void> {
  await mkdir(CLAUDE_SETTINGS_DIR, { recursive: true })
  await writeFile(CLAUDE_SETTINGS_PATH, JSON.stringify(json, null, 2) + '\n', 'utf-8')
}

async function patchClaudeSettings(updates: Record<string, string>): Promise<void> {
  if (Object.keys(updates).length === 0) return

  settingsWriteQueue = settingsWriteQueue.then(async () => {
    const json = await readClaudeSettings()
    const env = isRecord(json.env) ? { ...json.env } : {}
    let changed = false

    for (const [key, value] of Object.entries(updates)) {
      if (env[key] === value) continue
      env[key] = value
      changed = true
    }

    if (!changed) return

    json.env = env
    await writeClaudeSettings(json)
  })

  await settingsWriteQueue
}

function getEnabledProvider(settings: CoideSettings): ThirdPartyProviderSettings | null {
  return settings.thirdPartyProviders.find((provider) => provider.enabled) ?? null
}

function getEnabledProviderModelSet(settings: CoideSettings): Set<string> {
  const provider = getEnabledProvider(settings)
  return new Set(
    provider?.models.map((item) => item.model.trim()).filter(Boolean) ?? []
  )
}

export async function syncClaudeProviderSettings(settings: CoideSettings): Promise<void> {
  const provider = getEnabledProvider(settings)
  if (!provider) return

  const baseUrl = provider.baseUrl.trim()
  const apiKey = provider.apiKey.trim()
  const providerUpdates: Record<string, string> = {}

  if (baseUrl) {
    providerUpdates[PROVIDER_KEYS[0]] = baseUrl
  }
  if (apiKey) {
    providerUpdates[PROVIDER_KEYS[1]] = apiKey
  }

  if (Object.keys(providerUpdates).length === 0) return

  await patchClaudeSettings(providerUpdates)

  const selectedModel = settings.model.trim()
  if (selectedModel && !getEnabledProviderModelSet(settings).has(selectedModel)) {
    await syncClaudeSelectedModel('')
  }
}

export async function syncClaudeSelectedModel(model: string): Promise<void> {
  const value = model.trim()
  await patchClaudeSettings(
    Object.fromEntries(MODEL_KEYS.map((key) => [key, value]))
  )
}

export async function readClaudeProviderSnapshot(): Promise<ClaudeProviderSnapshot | null> {
  const json = await readClaudeSettings()
  const env = isRecord(json.env) ? (json.env as ClaudeEnvJson) : null

  const baseUrl = readStringSetting(env, json, 'ANTHROPIC_BASE_URL')
  const apiKey = readStringSetting(env, json, 'ANTHROPIC_AUTH_TOKEN')
  const model =
    readStringSetting(env, json, 'ANTHROPIC_MODEL') ||
    readStringSetting(env, json, 'ANTHROPIC_DEFAULT_SONNET_MODEL') ||
    readStringSetting(env, json, 'ANTHROPIC_DEFAULT_OPUS_MODEL') ||
    readStringSetting(env, json, 'ANTHROPIC_DEFAULT_HAIKU_MODEL') ||
    readStringSetting(env, json, 'ANTHROPIC_REASONING_MODEL')

  if (!baseUrl && !apiKey && !model) return null

  return { baseUrl, apiKey, model }
}

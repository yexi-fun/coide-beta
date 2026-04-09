import type { BrowserWindow } from 'electron'

type ClaudeEventPayload = Record<string, unknown> & { type: string; coideSessionId: string }

function emit(win: BrowserWindow, event: ClaudeEventPayload): void {
  win.webContents.send('claude:event', event)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function asBlocks(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!asRecord(item)) : []
}

export function emitSystemInit(
  win: BrowserWindow,
  coideSessionId: string,
  init: { mcpServers?: unknown; tools?: unknown }
): void {
  emit(win, {
    coideSessionId,
    type: 'system',
    subtype: 'init',
    mcp_servers: Array.isArray(init.mcpServers) ? init.mcpServers : [],
    tools: Array.isArray(init.tools) ? init.tools : []
  })
}

export function emitUsage(
  win: BrowserWindow,
  coideSessionId: string,
  usage: Record<string, unknown> | null | undefined
): void {
  if (!usage) return
  emit(win, {
    coideSessionId,
    type: 'usage',
    input_tokens: Number(usage.input_tokens ?? 0),
    output_tokens: Number(usage.output_tokens ?? 0),
    cache_creation_input_tokens: Number(usage.cache_creation_input_tokens ?? 0),
    cache_read_input_tokens: Number(usage.cache_read_input_tokens ?? 0)
  })
}

export function emitThinking(win: BrowserWindow, coideSessionId: string, thinking: string): void {
  if (!thinking) return
  emit(win, { coideSessionId, type: 'thinking', thinking })
}

export function emitAssistantText(win: BrowserWindow, coideSessionId: string, text: string): void {
  if (!text) return
  emit(win, { coideSessionId, type: 'assistant', text })
}

export function emitToolStart(
  win: BrowserWindow,
  coideSessionId: string,
  payload: { toolId: string; toolName: string; input?: Record<string, unknown>; originalContent?: string | null }
): void {
  emit(win, {
    coideSessionId,
    type: 'tool_start',
    tool_id: payload.toolId,
    tool_name: payload.toolName
  })
  emit(win, {
    coideSessionId,
    type: 'tool_input',
    tool_id: payload.toolId,
    tool_name: payload.toolName,
    input: payload.input ?? {},
    originalContent: payload.originalContent
  })
}

export function emitToolResult(
  win: BrowserWindow,
  coideSessionId: string,
  payload: { toolId: string; content: string }
): void {
  emit(win, {
    coideSessionId,
    type: 'tool_result',
    tool_id: payload.toolId,
    content: payload.content
  })
}

export function emitToolDenied(
  win: BrowserWindow,
  coideSessionId: string,
  payload: { toolId: string; toolName: string; input?: Record<string, unknown>; originalContent?: string | null }
): void {
  emit(win, {
    coideSessionId,
    type: 'tool_denied',
    tool_id: payload.toolId,
    tool_name: payload.toolName,
    input: payload.input ?? {},
    originalContent: payload.originalContent
  })
}

export function emitError(win: BrowserWindow, coideSessionId: string, result: string): void {
  emit(win, { coideSessionId, type: 'error', result })
}

export function emitResult(
  win: BrowserWindow,
  coideSessionId: string,
  payload: { result: string; sessionId?: string | null; isError?: boolean }
): void {
  emit(win, {
    coideSessionId,
    type: 'result',
    result: payload.result,
    session_id: payload.sessionId ?? null,
    is_error: payload.isError ?? false
  })
}

export function emitStreamEnd(win: BrowserWindow, coideSessionId: string): void {
  emit(win, { coideSessionId, type: 'stream_end' })
}

export function adaptAssistantMessage(
  win: BrowserWindow,
  coideSessionId: string,
  msg: Record<string, unknown>,
  onToolUse: (block: Record<string, unknown>) => void,
  options?: { emitText?: boolean }
): void {
  const message = asRecord(msg.message) ?? msg
  const usage = asRecord(message.usage)
  emitUsage(win, coideSessionId, usage)

  for (const block of asBlocks(message.content)) {
    if (block.type === 'text' && options?.emitText !== false) {
      emitAssistantText(win, coideSessionId, String(block.text ?? ''))
      continue
    }
    if (block.type === 'thinking') {
      emitThinking(win, coideSessionId, String(block.thinking ?? ''))
      continue
    }
    if (block.type === 'tool_use') {
      onToolUse(block)
    }
  }
}

export function adaptUserMessage(win: BrowserWindow, coideSessionId: string, msg: Record<string, unknown>): void {
  const message = asRecord(msg.message) ?? msg
  for (const block of asBlocks(message.content)) {
    if (block.type !== 'tool_result') continue
    const content = Array.isArray(block.content)
      ? block.content
          .map((item) => {
            const record = asRecord(item)
            return record ? String(record.text ?? '') : ''
          })
          .join('')
      : String(block.content ?? '')
    emitToolResult(win, coideSessionId, {
      toolId: String(block.tool_use_id ?? ''),
      content
    })
  }
}

export function adaptToolProgress(win: BrowserWindow, coideSessionId: string, msg: Record<string, unknown>): void {
  const toolId = String(msg.tool_use_id ?? msg.toolUseId ?? msg.tool_id ?? '')
  if (!toolId) return

  const toolName = String(msg.tool_name ?? msg.toolName ?? '')
  const input = asRecord(msg.input ?? msg.tool_input ?? msg.toolInput) ?? {}
  const result = msg.content ?? msg.result

  if (toolName) {
    emitToolStart(win, coideSessionId, { toolId, toolName, input })
  }

  if (typeof result === 'string' && result) {
    emitToolResult(win, coideSessionId, { toolId, content: result })
  }
}

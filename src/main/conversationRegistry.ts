type ConversationHandle = {
  abortController: AbortController
  settle?: () => void
}

const conversations = new Map<string, ConversationHandle>()

export function registerConversation(coideSessionId: string, handle: ConversationHandle): void {
  conversations.set(coideSessionId, handle)
}

export function unregisterConversation(coideSessionId: string): void {
  conversations.delete(coideSessionId)
}

export function abortConversation(coideSessionId?: string): void {
  if (coideSessionId) {
    const handle = conversations.get(coideSessionId)
    if (!handle) return
    handle.abortController.abort()
    handle.settle?.()
    conversations.delete(coideSessionId)
    return
  }

  for (const [id, handle] of conversations) {
    handle.abortController.abort()
    handle.settle?.()
    conversations.delete(id)
  }
}

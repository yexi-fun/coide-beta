type PermissionRequestRecord = {
  resolve: (approved: boolean) => void
}

const pendingPermissions = new Map<string, PermissionRequestRecord[]>()

export function registerPermissionRequest(
  coideSessionId: string,
  resolve: (approved: boolean) => void
): void {
  const queue = pendingPermissions.get(coideSessionId) ?? []
  queue.push({ resolve })
  pendingPermissions.set(coideSessionId, queue)
}

export function resolvePermissionRequest(approved: boolean, coideSessionId?: string): void {
  if (!coideSessionId) return
  const queue = pendingPermissions.get(coideSessionId)
  if (!queue?.length) return

  const next = queue.shift()
  if (queue.length === 0) pendingPermissions.delete(coideSessionId)
  else pendingPermissions.set(coideSessionId, queue)

  next?.resolve(approved)
}

export function clearPermissionRequests(coideSessionId: string): void {
  pendingPermissions.delete(coideSessionId)
}

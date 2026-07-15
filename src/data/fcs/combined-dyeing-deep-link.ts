export type CombinedDyeingDeepLinkResolution =
  | { kind: 'none' }
  | { kind: 'detail'; taskId: string }
  | { kind: 'invalid'; taskId: string }

export function resolveCombinedDyeingDeepLink(
  search: string,
  tasks: ReadonlyArray<{ taskId: string }>,
): CombinedDyeingDeepLinkResolution {
  const taskId = new URLSearchParams(search).get('taskId')?.trim() ?? ''
  if (!taskId) return { kind: 'none' }
  return tasks.some((task) => task.taskId === taskId)
    ? { kind: 'detail', taskId }
    : { kind: 'invalid', taskId }
}

export function removeCombinedDyeingTaskIdFromUrl(url: string): string {
  const parsed = new URL(url, 'http://higood.local')
  parsed.searchParams.delete('taskId')
  return `${parsed.pathname}${parsed.search}${parsed.hash}`
}

export function shouldClearCombinedDyeingOverlay(
  resolution: CombinedDyeingDeepLinkResolution,
  currentDeepLinkedTaskId: string,
): boolean {
  if (resolution.kind === 'invalid') return true
  return resolution.kind === 'none' && Boolean(currentDeepLinkedTaskId)
}

let resolveRuntimeTask: ((taskId: string) => unknown | null) | null = null

export function installRuntimeTaskReadResolver(resolver: (taskId: string) => unknown | null): void {
  if (resolveRuntimeTask && resolveRuntimeTask !== resolver) {
    throw new Error('运行时任务只读解析器已安装，不可重复覆盖')
  }
  resolveRuntimeTask = resolver
}

export function readRuntimeTaskById<T>(taskId: string): T | null {
  return (resolveRuntimeTask?.(taskId) as T | null | undefined) ?? null
}

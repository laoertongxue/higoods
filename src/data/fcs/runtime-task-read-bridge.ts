let resolveRuntimeTask: ((taskId: string) => unknown | null) | null = null

export function installRuntimeTaskReadResolver(resolver: (taskId: string) => unknown | null): void {
  // Vite HMR 会重新执行 runtime 模块并产生新的函数引用；桥本身保持稳定，
  // 因此安装动作必须替换为本轮最新的只读 resolver。
  resolveRuntimeTask = resolver
}

export function readRuntimeTaskById<T>(taskId: string): T | null {
  return (resolveRuntimeTask?.(taskId) as T | null | undefined) ?? null
}

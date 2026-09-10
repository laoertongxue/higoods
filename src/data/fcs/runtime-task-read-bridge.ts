type RuntimeTaskReadResolver = (taskId: string) => unknown | null
type RuntimeTaskListResolver = () => readonly unknown[]

let resolveRuntimeTask: RuntimeTaskReadResolver | null = null
let listRuntimeTasks: RuntimeTaskListResolver | null = null
let resolverOwner = ''
let resolverInstallToken: symbol | null = null

function normalizeModuleOwner(ownerUrl: string): string {
  if (!ownerUrl.trim()) throw new Error('运行时任务只读解析器缺少模块归属')
  try {
    const url = new URL(ownerUrl)
    return `${url.origin}${url.pathname}`
  } catch {
    return ownerUrl.split(/[?#]/, 1)[0]
  }
}

export function installRuntimeTaskReadResolver(
  resolver: RuntimeTaskReadResolver,
  ownerUrl: string,
  listResolver?: RuntimeTaskListResolver,
): () => void {
  const owner = normalizeModuleOwner(ownerUrl)
  if (resolverOwner && resolverOwner !== owner) throw new Error('运行时任务只读解析器仅允许原安装模块热替换')
  const token = Symbol(owner)
  resolveRuntimeTask = resolver
  listRuntimeTasks = listResolver || null
  resolverOwner = owner
  resolverInstallToken = token
  return () => {
    if (resolverInstallToken !== token) return
    resolveRuntimeTask = null
    listRuntimeTasks = null
    resolverOwner = ''
    resolverInstallToken = null
  }
}

export function readRuntimeTaskById<T>(taskId: string): T | null {
  return (resolveRuntimeTask?.(taskId) as T | null | undefined) ?? null
}

export function readRuntimeTasks<T>(): T[] {
  return listRuntimeTasks ? [...listRuntimeTasks()] as T[] : []
}

// 配料投影依赖任务读取；注册校验器可避免任务模块反向导入整个仓储模块。
let sewingMaterialReadinessCheck: ((task: unknown) => void) | null = null
export function installSewingMaterialReadinessCheck(check: (task: unknown) => void): void {
  sewingMaterialReadinessCheck = check
}
export function assertRegisteredSewingMaterialReadiness(task: unknown): void {
  if (!sewingMaterialReadinessCheck) throw new Error('配料校验尚未就绪，请刷新后重试')
  sewingMaterialReadinessCheck(task)
}

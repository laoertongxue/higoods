type RuntimeTaskReadResolver = (taskId: string) => unknown | null

let resolveRuntimeTask: RuntimeTaskReadResolver | null = null
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

export function installRuntimeTaskReadResolver(resolver: RuntimeTaskReadResolver, ownerUrl: string): () => void {
  const owner = normalizeModuleOwner(ownerUrl)
  if (resolverOwner && resolverOwner !== owner) throw new Error('运行时任务只读解析器仅允许原安装模块热替换')
  const token = Symbol(owner)
  resolveRuntimeTask = resolver
  resolverOwner = owner
  resolverInstallToken = token
  return () => {
    if (resolverInstallToken !== token) return
    resolveRuntimeTask = null
    resolverOwner = ''
    resolverInstallToken = null
  }
}

export function readRuntimeTaskById<T>(taskId: string): T | null {
  return (resolveRuntimeTask?.(taskId) as T | null | undefined) ?? null
}

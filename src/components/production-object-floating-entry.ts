function canShowProductionObjectEntry(pathname: string): boolean {
  if (pathname.startsWith('/fcs/print/')) return false
  if (pathname.startsWith('/fcs/task-print/')) return false
  if (pathname.includes('confirmation-print')) return false
  return pathname.startsWith('/fcs') || pathname.startsWith('/pcs') || pathname.startsWith('/pms') || pathname.startsWith('/wls')
}

export function renderProductionObjectFloatingEntry(pathname: string): string {
  if (!canShowProductionObjectEntry(pathname)) return ''

  return `
    <button
      type="button"
      class="production-object-floating-entry group"
      data-production-object-action="toggle-search"
      data-skip-page-rerender="true"
      aria-label="查生产"
    >
      <i data-lucide="search" class="h-5 w-5"></i>
      <span class="production-object-floating-entry__label">查生产</span>
    </button>
    <div data-production-object-overlay-root="true"></div>
  `
}

function renderProductionObjectSearchShell(): string {
  return `
    <div class="production-object-search-panel" data-production-object-surface="search">
      <button class="absolute inset-0 bg-slate-950/30" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭"></button>
      <section class="production-object-search-panel__body">
        <header class="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 class="text-base font-semibold">生产全局搜索</h2>
            <p class="mt-1 text-xs text-muted-foreground">支持生产单、生产需求、SPU、SKU、物料及生产执行单据</p>
          </div>
          <button class="h-8 w-8 rounded-md text-lg text-muted-foreground hover:bg-muted" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭">×</button>
        </header>
        <div class="production-object-search-panel__content space-y-3 p-4">
          <input
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-blue-500"
            placeholder="输入生产单 / 需求单 / SPU / SKU / 物料SKU / 生产执行单据"
            data-production-object-action="search"
            data-skip-page-rerender="true"
            autofocus
          />
          <div data-production-object-search-results="true">
            <div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">请输入至少 2 个字符开始查询</div>
          </div>
        </div>
      </section>
    </div>
  `
}

export function handleProductionObjectFloatingEntryEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-production-object-action]')
  const action = actionNode?.dataset.productionObjectAction
  if (action !== 'toggle-search' && action !== 'close') return false

  const root = document.querySelector<HTMLElement>('[data-production-object-overlay-root="true"]')
  if (!root) return true

  if (action === 'close' || root.dataset.productionObjectMode === 'search') {
    root.innerHTML = ''
    delete root.dataset.productionObjectMode
    return true
  }

  root.innerHTML = renderProductionObjectSearchShell()
  root.dataset.productionObjectMode = 'search'
  queueMicrotask(() => root.querySelector<HTMLInputElement>('[data-production-object-action="search"]')?.focus())
  return true
}

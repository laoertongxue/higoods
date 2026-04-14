import { escapeHtml } from '../utils'

export function renderPcsResetPlaceholderPage(title = 'PCS 页面'): string {
  return `
    <div class="space-y-4 p-6">
      <header class="rounded-lg border bg-card p-5">
        <h1 class="text-2xl font-bold">${escapeHtml(title)}</h1>
      </header>
      <section class="rounded-lg border bg-card p-10">
        <div class="flex min-h-[360px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 text-center">
          <p class="text-lg font-semibold text-slate-900">页面已清空</p>
          <p class="mt-2 text-sm text-slate-500">当前模块已下线，等待重新开始设计。</p>
        </div>
      </section>
    </div>
  `
}

// @page-pattern: pda
import { escapeHtml } from '../utils'
import { renderPdaFrame } from './pda-shell'

function renderTransferBagScrapSkeleton(): string {
  return `
    <main class="space-y-4 px-4 py-4">
      <a class="text-sm text-blue-700" data-nav="/fcs/pda/warehouse/wait-handover?scope=cutting">返回待交出仓</a>
      <section class="rounded-2xl border bg-card p-4">
        <h1 class="text-lg font-semibold">${escapeHtml('中转袋报废')}</h1>
        <label class="mt-4 block space-y-2">
          <span class="text-sm font-medium">1 扫中转袋</span>
          <input class="h-12 w-full rounded-xl border px-3" placeholder="扫描或填写中转袋编号" />
        </label>
        <button class="mt-4 h-12 w-full rounded-xl bg-blue-600 text-white opacity-50" type="button" disabled>${escapeHtml('确认报废')}</button>
      </section>
    </main>
  `
}

export function renderPdaCuttingTransferBagScrapPage(): string {
  return renderPdaFrame(renderTransferBagScrapSkeleton(), 'warehouse', {
    headerTitle: '中转袋报废',
    disableTodoAutoOpen: true,
  })
}

export function handlePdaCuttingTransferBagScrapEvent(_target: HTMLElement): boolean {
  return false
}

import { getSettlementPageBoundary } from '../data/fcs/settlement-flow-boundaries'
import { appStore } from '../state/store'
import { escapeHtml } from '../utils'

function renderBatchCompatPage(targetPath: string, title: string, note: string): string {
  const currentPath = appStore.getState().pathname
  if (currentPath !== targetPath) {
    queueMicrotask(() => {
      if (appStore.getState().pathname !== targetPath) {
        appStore.navigate(targetPath)
      }
    })
  }

  return `
    <div class="flex flex-col gap-4 p-6">
      <section>
        <h1 class="text-xl font-semibold">${escapeHtml(title)}</h1>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(note)}</p>
      </section>
      <section class="rounded-lg border bg-card p-4">
        <p class="text-sm text-muted-foreground">当前入口仅保留兼容跳转能力，系统正在带你进入预付款批次的历史视图。</p>
      </section>
    </div>
  `
}

export function renderHistoryPage(): string {
  const pageBoundary = getSettlementPageBoundary('history')
  return renderBatchCompatPage(
    '/fcs/settlement/batches?view=history',
    '预付款批次',
    pageBoundary.pageIntro,
  )
}

export function handleHistoryEvent(_target?: HTMLElement): boolean {
  return false
}

export function isHistoryDialogOpen(): boolean {
  return false
}

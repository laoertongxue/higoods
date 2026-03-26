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
        <p class="text-sm text-muted-foreground">当前入口仅保留兼容跳转能力，系统正在带你进入结算批次的待打款/待回写视图。</p>
      </section>
    </div>
  `
}

export function renderPaymentSyncPage(): string {
  const pageBoundary = getSettlementPageBoundary('payment-sync')
  return renderBatchCompatPage(
    '/fcs/settlement/batches?view=payment',
    '结算批次',
    pageBoundary.pageIntro,
  )
}

export function handlePaymentSyncEvent(_target?: HTMLElement): boolean {
  return false
}

export function isPaymentSyncDialogOpen(): boolean {
  return false
}

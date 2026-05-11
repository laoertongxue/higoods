import { renderPdaFrame } from './pda-shell'
import { OWN_KNITTING_FACTORY_ID } from '../data/fcs/factory-mock-data.ts'
import {
  listKnittingWaitHandoverHandoutRecords,
  listKnittingWaitHandoverInboundRecords,
  listKnittingWaitProcessReceiptRecords,
  listKnittingWaitProcessUsageRecords,
  listKnittingWarehouseInventory,
  listKnittingWarehouseLocations,
} from '../data/fcs/knitting-task-domain.ts'
import {
  getMobileWarehouseRuntimeContext,
  renderMobileWarehouseLoginRedirect,
  renderWarehouseActionCards,
  renderWarehouseSummaryHeader,
} from './pda-warehouse-shared'

function renderKnittingWarehouseTabs(active: 'home' | 'wait-process' | 'wait-handover' = 'home'): string {
  const tabClass = (key: 'wait-process' | 'wait-handover') =>
    active === key
      ? 'bg-primary text-primary-foreground'
      : 'border bg-background text-foreground'
  return `
    <section class="grid grid-cols-2 gap-2">
      <button type="button" class="rounded-2xl px-4 py-3 text-sm font-medium ${tabClass('wait-process')}" data-nav="/fcs/pda/warehouse/wait-process">待加工仓</button>
      <button type="button" class="rounded-2xl px-4 py-3 text-sm font-medium ${tabClass('wait-handover')}" data-nav="/fcs/pda/warehouse/wait-handover">待交出仓</button>
    </section>
  `
}

function renderKnittingWarehouseHome(): string {
  const waitProcessInventory = listKnittingWarehouseInventory('wait-process')
  const waitHandoverInventory = listKnittingWarehouseInventory('wait-handover')
  const receiptRecords = listKnittingWaitProcessReceiptRecords()
  const usageRecords = listKnittingWaitProcessUsageRecords()
  const inboundRecords = listKnittingWaitHandoverInboundRecords()
  const handoutRecords = listKnittingWaitHandoverHandoutRecords()
  const waitProcessLocations = listKnittingWarehouseLocations('wait-process')
  const waitHandoverLocations = listKnittingWarehouseLocations('wait-handover')
  return `
    <section class="grid gap-3">
      <button type="button" class="rounded-2xl border bg-card px-4 py-4 text-left shadow-sm" data-nav="/fcs/pda/warehouse/wait-process">
        <div class="flex items-center justify-between gap-2">
          <div class="text-base font-semibold">待加工仓</div>
          <span class="rounded-full bg-muted px-2 py-0.5 text-xs">${waitProcessInventory.length} 条库存</span>
        </div>
        <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div class="rounded-xl bg-muted/60 px-2 py-2"><div class="font-semibold">${receiptRecords.length}</div><div class="text-muted-foreground">领料记录</div></div>
          <div class="rounded-xl bg-muted/60 px-2 py-2"><div class="font-semibold">${usageRecords.length}</div><div class="text-muted-foreground">加工用料</div></div>
          <div class="rounded-xl bg-muted/60 px-2 py-2"><div class="font-semibold">${waitProcessLocations.length}</div><div class="text-muted-foreground">库区库位</div></div>
        </div>
      </button>
      <button type="button" class="rounded-2xl border bg-card px-4 py-4 text-left shadow-sm" data-nav="/fcs/pda/warehouse/wait-handover">
        <div class="flex items-center justify-between gap-2">
          <div class="text-base font-semibold">待交出仓</div>
          <span class="rounded-full bg-muted px-2 py-0.5 text-xs">${waitHandoverInventory.length} 条库存</span>
        </div>
        <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div class="rounded-xl bg-muted/60 px-2 py-2"><div class="font-semibold">${handoutRecords.length}</div><div class="text-muted-foreground">交出记录</div></div>
          <div class="rounded-xl bg-muted/60 px-2 py-2"><div class="font-semibold">${inboundRecords.length}</div><div class="text-muted-foreground">加工入仓</div></div>
          <div class="rounded-xl bg-muted/60 px-2 py-2"><div class="font-semibold">${waitHandoverLocations.length}</div><div class="text-muted-foreground">库区库位</div></div>
        </div>
      </button>
    </section>
  `
}

export function renderPdaWarehousePage(): string {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return renderMobileWarehouseLoginRedirect()

  if (runtime.factoryId === OWN_KNITTING_FACTORY_ID) {
    const content = `
      <div class="space-y-4 px-4 pb-5 pt-4">
        ${renderWarehouseSummaryHeader('针织仓管', '通过待加工仓和待交出仓切换处理针织库存。', runtime.overview)}
        ${renderKnittingWarehouseTabs('home')}
        ${renderKnittingWarehouseHome()}
      </div>
    `
    return renderPdaFrame(content, 'warehouse', { headerTitle: '针织仓管', disableTodoAutoOpen: true })
  }

  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${renderWarehouseSummaryHeader('仓管', '待加工仓 / 待交出仓 / 入库记录 / 出库记录 / 盘点', runtime.overview)}
      ${
        runtime.overview.isSewingLightweight
          ? '<section class="rounded-2xl border bg-card px-4 py-3 text-xs text-muted-foreground">车缝厂查看中转袋接收、菲票回写和差异，不生成内部仓记录。</section>'
          : ''
      }
      ${renderWarehouseActionCards(runtime.cards)}
    </div>
  `

  return renderPdaFrame(content, 'warehouse', { headerTitle: '仓管', disableTodoAutoOpen: true })
}

export function handlePdaWarehouseEvent(_target: HTMLElement): boolean {
  return false
}

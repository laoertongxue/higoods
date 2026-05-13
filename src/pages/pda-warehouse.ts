import { renderPdaFrame } from './pda-shell'
import { OWN_KNITTING_FACTORY_ID } from '../data/fcs/factory-mock-data.ts'
import {
  FULL_CAPABILITY_FACTORY_ID,
  listPostFinishingWaitHandoverWarehouseRecords,
  listPostFinishingWaitProcessWarehouseRecords,
} from '../data/fcs/post-finishing-domain.ts'
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
import { escapeHtml } from '../utils'

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

function renderPostFinishingWarehouseHome(factoryName: string): string {
  const waitProcessRecords = listPostFinishingWaitProcessWarehouseRecords()
  const waitHandoverRecords = listPostFinishingWaitHandoverWarehouseRecords()
  const waitProcessQty = waitProcessRecords.reduce((sum, record) => sum + record.availableGarmentQty, 0)
  const waitHandoverQty = waitHandoverRecords.reduce((sum, record) => sum + Math.max(record.waitHandoverGarmentQty - record.submittedHandoverGarmentQty, 0), 0)
  const inboundFlowCount = [
    ...waitProcessRecords.flatMap((record) => record.flowRecords.filter((flow) => flow.flowType === '扫码收货')),
    ...waitHandoverRecords.flatMap((record) => record.flowRecords.filter((flow) => flow.flowType === '复检入仓')),
  ].length
  const outboundFlowCount = waitHandoverRecords.flatMap((record) => record.flowRecords.filter((flow) => flow.flowType === '交出出仓')).length

  return `
    <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-lg font-semibold text-foreground">后道仓管</div>
          <div class="mt-1 text-xs text-muted-foreground">围绕扫码收货、质检占用、复检入仓和交出出仓处理库存。</div>
        </div>
        <div class="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">${escapeHtml(factoryName)}</div>
      </div>
      <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div class="rounded-2xl bg-muted/50 px-3 py-3">
          <div class="text-muted-foreground">待加工仓可用</div>
          <div class="mt-1 text-base font-semibold">${waitProcessQty} 件</div>
        </div>
        <div class="rounded-2xl bg-muted/50 px-3 py-3">
          <div class="text-muted-foreground">待交出仓可交</div>
          <div class="mt-1 text-base font-semibold">${waitHandoverQty} 件</div>
        </div>
        <div class="rounded-2xl bg-muted/50 px-3 py-3">
          <div class="text-muted-foreground">入库流水</div>
          <div class="mt-1 text-base font-semibold">${inboundFlowCount} 条</div>
        </div>
        <div class="rounded-2xl bg-muted/50 px-3 py-3">
          <div class="text-muted-foreground">出库流水</div>
          <div class="mt-1 text-base font-semibold">${outboundFlowCount} 条</div>
        </div>
      </div>
    </section>
    <section class="grid grid-cols-2 gap-3">
      <button type="button" class="rounded-2xl border bg-card px-4 py-4 text-left shadow-sm" data-nav="/fcs/pda/warehouse/wait-process">
        <div class="text-sm font-semibold">待加工仓</div>
        <div class="mt-2 text-xs leading-5 text-muted-foreground">上游交出扫码收货后入仓，质检时占用。</div>
      </button>
      <button type="button" class="rounded-2xl border bg-card px-4 py-4 text-left shadow-sm" data-nav="/fcs/pda/warehouse/wait-handover">
        <div class="text-sm font-semibold">待交出仓</div>
        <div class="mt-2 text-xs leading-5 text-muted-foreground">复检完成入仓，再由交出记录扣减。</div>
      </button>
      <button type="button" class="rounded-2xl border bg-card px-4 py-4 text-left shadow-sm" data-nav="/fcs/pda/warehouse/inbound-records">
        <div class="text-sm font-semibold">入库流水</div>
        <div class="mt-2 text-xs leading-5 text-muted-foreground">扫码收货、复检入仓形成的流水。</div>
      </button>
      <button type="button" class="rounded-2xl border bg-card px-4 py-4 text-left shadow-sm" data-nav="/fcs/pda/warehouse/outbound-records">
        <div class="text-sm font-semibold">出库流水</div>
        <div class="mt-2 text-xs leading-5 text-muted-foreground">交出记录提交后的出仓流水。</div>
      </button>
    </section>
  `
}

export function renderPdaWarehousePage(): string {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return renderMobileWarehouseLoginRedirect()

  if (runtime.factoryId === FULL_CAPABILITY_FACTORY_ID) {
    const content = `
      <div class="space-y-4 px-4 pb-5 pt-4">
        ${renderPostFinishingWarehouseHome(runtime.factoryName)}
      </div>
    `
    return renderPdaFrame(content, 'warehouse', { headerTitle: '后道仓管', disableTodoAutoOpen: true })
  }

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

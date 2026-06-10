import {
  listFactoryWaitHandoverStockItems,
  type FactoryWaitHandoverStockItem,
  updateWaitHandoverStockLocation,
} from '../data/fcs/factory-internal-warehouse.ts'
import { getFactoryMasterRecordById } from '../data/fcs/factory-master-store.ts'
import { OWN_WOOL_FACTORY_ID } from '../data/fcs/factory-mock-data.ts'
import {
  listAuxiliaryCraftTaskOrders,
  listSpecialTypeCraftTaskOrders,
} from '../data/fcs/special-craft-task-orders.ts'
import type { PostFinishingWaitHandoverWarehouseRecord } from '../data/fcs/post-finishing-domain.ts'
import {
  FULL_CAPABILITY_FACTORY_ID,
  listPostFinishingWaitHandoverWarehouseRecords,
} from '../data/fcs/post-finishing-domain.ts'
import {
  completeWoolPickupHead,
  getWoolWorkOrderById,
  getWoolYarnUsageSummary,
  listWoolWaitHandoverHandoutRecords,
  listWoolWaitHandoverInboundRecords,
  listWoolWorkOrders,
  listWoolWarehouseInventory,
  listWoolWarehouseLocations,
  markWoolFeiTicketsPrinted,
  scheduleWoolMachines,
  submitWoolHandover,
  updateWoolWorkOrderNodeStatus,
} from '../data/fcs/wool-task-domain.ts'
import { listPdaCuttingTaskSourceRecords } from '../data/fcs/cutting/pda-cutting-task-source.ts'
import {
  buildInboundTempBagInventoryRecords,
  buildInboundTempBagsFromTransferBagViewModel,
  type InboundTempBag,
} from './process-factory/cutting/transfer-bags-model.ts'
import { buildTransferBagsProjection } from './process-factory/cutting/transfer-bags-projection.ts'
import {
  buildWaitHandoverRuntimeProjection,
  type WaitHandoverRuntimeProjection,
} from './process-factory/cutting/wait-handover-runtime.ts'
import {
  buildHandoverPickingTaskProjectionFromAllocationProjection,
  buildSewingTaskAllocationProjectionFromInventory,
  type HandoverPickingTaskProjection,
} from '../data/fcs/cutting/sewing-dispatch.ts'
import { listHandoverRecords } from '../data/fcs/cutting/handover-orders.ts'
import { renderPdaFrame } from './pda-shell'
import {
  buildWarehouseDifferenceText,
  escapeAttr,
  formatWarehouseDateTime,
  getCurrentFactoryWarehouseByKind,
  getMobileWarehouseSearchParams,
  getMobileWarehouseRuntimeContext,
  getWaitHandoverWritebackStatusLabel,
  getWarehouseQrDisplayText,
  getWarehousePositionOptions,
  renderCompactFieldList,
  renderMobilePageEmptyState,
  renderSectionFilterChips,
  renderStatusPill,
  renderWarehouseSummaryHeader,
  resolveTaskRoute,
  resolveWaitHandoverRoute,
  resolveWarehouseOutboundRecordRoute,
} from './pda-warehouse-shared'
import { escapeHtml } from '../utils'
import { getSpecialCraftFeiTicketSummary } from '../data/fcs/cutting/special-craft-fei-ticket-flow.ts'

type WaitHandoverFilter = '全部' | '待交出' | '已交出' | '已回写' | '差异' | '异议中'
type CuttingWaitHandoverActionKey = 'numbering' | 'inbound' | 'handover-bagging-confirm' | 'special-craft-return'

interface CuttingWaitHandoverCardAction {
  label: string
  route: string
  hint: string
}

interface WaitHandoverState {
  status: WaitHandoverFilter
  detailId: string | null
  locationEditId: string | null
  areaName: string
  shelfNo: string
  locationNo: string
  remark: string
  auxiliaryFinishScan: string
  auxiliaryFinishQty: string
  auxiliaryFinishLossQty: string
  auxiliaryFinishArea: string
  auxiliaryFinishShelf: string
  auxiliaryFinishLocation: string
  auxiliaryHandoverScan: string
  auxiliaryHandoverQty: string
  auxiliaryHandoverReceiver: string
  auxiliaryHandoverArea: string
  auxiliaryHandoverShelf: string
  auxiliaryHandoverLocation: string
  woolFinishOrderId: string
  woolFinishQty: string
  woolFinishLocationId: string
  woolHandoverOrderId: string
  woolHandoverQty: string
  woolHandoverReceiver: string
  woolHandoverLocationId: string
}

const state: WaitHandoverState = {
  status: '全部',
  detailId: null,
  locationEditId: null,
  areaName: '',
  shelfNo: '',
  locationNo: '',
  remark: '',
  auxiliaryFinishScan: '',
  auxiliaryFinishQty: '',
  auxiliaryFinishLossQty: '',
  auxiliaryFinishArea: '',
  auxiliaryFinishShelf: '',
  auxiliaryFinishLocation: '',
  auxiliaryHandoverScan: '',
  auxiliaryHandoverQty: '',
  auxiliaryHandoverReceiver: '',
  auxiliaryHandoverArea: '',
  auxiliaryHandoverShelf: '',
  auxiliaryHandoverLocation: '',
  woolFinishOrderId: '',
  woolFinishQty: '',
  woolFinishLocationId: '',
  woolHandoverOrderId: '',
  woolHandoverQty: '',
  woolHandoverReceiver: '',
  woolHandoverLocationId: '',
}

const FILTERS: Array<{ value: WaitHandoverFilter; label: string }> = [
  { value: '全部', label: '全部' },
  { value: '待交出', label: '待交出' },
  { value: '已交出', label: '已交出' },
  { value: '已回写', label: '已回写' },
  { value: '差异', label: '差异' },
  { value: '异议中', label: '异议中' },
]

const LINKED_QR_FIELD = ['handoverRecord', 'QrValue'].join('')

const CUTTING_WAIT_HANDOVER_ACTIONS: Array<{
  key: CuttingWaitHandoverActionKey
  title: string
  desc: string
  primaryLabel: string
}> = [
  {
    key: 'numbering',
    title: '菲票打编号',
    desc: '扫菲票查看编号范围，完成实体打编号后记录员工计件数量。',
    primaryLabel: '开始菲票打编号',
  },
  {
    key: 'inbound',
    title: '入仓暂存装袋',
    desc: '扫中转袋和菲票，确认库区库位、菲票数量和裁片数量。',
    primaryLabel: '开始入仓暂存装袋',
  },
  {
    key: 'handover-bagging-confirm',
    title: '交出装袋确认',
    desc: '按车缝任务扫描中转袋和菲票，确认装袋并形成交出记录。',
    primaryLabel: '进入交出装袋确认',
  },
  {
    key: 'special-craft-return',
    title: '特殊工艺回仓',
    desc: '有中转袋先扫中转袋，再扫菲票获取裁片部位，确认库区库位入仓。',
    primaryLabel: '开始特殊工艺回仓',
  },
]

type AuxiliaryWaitHandoverAction = 'finish-inbound' | 'handover-confirm'
type WoolWaitHandoverAction = 'finish-inbound' | 'handover-confirm'

function getCraftWarehouseRuntimeLabel(): '辅助工艺' | '特种工艺' | null {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return null
  const factory = getFactoryMasterRecordById(runtime.factoryId)
  if (factory?.factoryType === 'CENTRAL_AUX') return '辅助工艺'
  if (factory?.factoryType === 'CENTRAL_SPECIAL') return '特种工艺'
  return null
}

function isCraftWarehouseRuntime(): boolean {
  return Boolean(getCraftWarehouseRuntimeLabel())
}

function ensureCraftWarehouseMockData(): void {
  const runtimeLabel = getCraftWarehouseRuntimeLabel()
  if (runtimeLabel === '辅助工艺') {
    listAuxiliaryCraftTaskOrders()
  } else if (runtimeLabel === '特种工艺') {
    listSpecialTypeCraftTaskOrders()
  }
}

function getAuxiliaryWaitHandoverRows(ignoreStatus = false): FactoryWaitHandoverStockItem[] {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return []
  ensureCraftWarehouseMockData()
  return listFactoryWaitHandoverStockItems()
    .filter((item) => item.factoryId === runtime.factoryId && Boolean(item.craftName))
    .filter((item) => (ignoreStatus || state.status === '全部' ? true : item.status === state.status))
}

function getAuxiliaryWaitHandoverAction(value?: string | null): AuxiliaryWaitHandoverAction | null {
  return value === 'finish-inbound' || value === 'handover-confirm' ? value : null
}

function getAuxiliaryWaitHandoverSample(): FactoryWaitHandoverStockItem | undefined {
  return getAuxiliaryWaitHandoverRows(true)[0]
}

function ensureAuxiliaryWaitHandoverDraft(action: AuxiliaryWaitHandoverAction): FactoryWaitHandoverStockItem | undefined {
  const sample = getAuxiliaryWaitHandoverSample()
  if (!sample) return undefined
  if (action === 'finish-inbound') {
    state.auxiliaryFinishScan ||= sample.taskNo || sample.stockItemId
    state.auxiliaryFinishQty ||= String(sample.completedQty)
    state.auxiliaryFinishLossQty ||= String(sample.lossQty)
    state.auxiliaryFinishArea ||= sample.areaName
    state.auxiliaryFinishShelf ||= sample.shelfNo
    state.auxiliaryFinishLocation ||= sample.locationNo
  } else {
    state.auxiliaryHandoverScan ||= sample.handoverOrderNo || sample.taskNo || sample.stockItemId
    state.auxiliaryHandoverQty ||= String(sample.waitHandoverQty || sample.completedQty)
    state.auxiliaryHandoverReceiver ||= sample.receiverName
    state.auxiliaryHandoverArea ||= sample.areaName
    state.auxiliaryHandoverShelf ||= sample.shelfNo
    state.auxiliaryHandoverLocation ||= sample.locationNo
  }
  return sample
}

function renderAuxiliaryWaitHandoverActionCards(activeAction?: AuxiliaryWaitHandoverAction | null): string {
  const actions: Array<{ key: AuxiliaryWaitHandoverAction; title: string; desc: string }> = [
    { key: 'finish-inbound', title: '完工入仓', desc: '确认加工完成数量、损耗和库位。' },
    { key: 'handover-confirm', title: '交出确认', desc: '确认接收方和数量，形成交出记录。' },
  ]
  return `
    <section class="grid grid-cols-2 gap-2">
      ${actions.map((item) => `
        <button
          type="button"
          class="rounded-2xl border px-4 py-4 text-left shadow-sm ${activeAction === item.key ? 'border-primary bg-primary/5' : 'bg-card'}"
          data-nav="/fcs/pda/warehouse/wait-handover?action=${escapeAttr(item.key)}"
        >
          <div class="text-sm font-semibold text-foreground">${escapeHtml(item.title)}</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">${escapeHtml(item.desc)}</div>
        </button>
      `).join('')}
    </section>
  `
}

function renderAuxiliaryWaitHandoverPositionFields(action: AuxiliaryWaitHandoverAction): string {
  const warehouse = getCurrentFactoryWarehouseByKind('WAIT_HANDOVER')
  if (!warehouse) return ''
  const options = getWarehousePositionOptions(warehouse.warehouseId)
  const areaValue = action === 'finish-inbound' ? state.auxiliaryFinishArea : state.auxiliaryHandoverArea
  const shelfValue = action === 'finish-inbound' ? state.auxiliaryFinishShelf : state.auxiliaryHandoverShelf
  const locationValue = action === 'finish-inbound' ? state.auxiliaryFinishLocation : state.auxiliaryHandoverLocation
  const fieldPrefix = action === 'finish-inbound' ? 'auxiliary-finish' : 'auxiliary-handover'
  const shelfOptions = options.shelfOptionsByArea[areaValue] || []
  const locationOptions = options.locationOptionsByShelf[shelfValue] || []
  return `
    <div class="grid grid-cols-1 gap-3">
      <label class="block space-y-1.5">
        <span class="text-xs font-medium text-muted-foreground">库区</span>
        <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="${fieldPrefix}-area">
          ${options.areaOptions.map((option) => `<option value="${escapeAttr(option.value)}" ${option.value === areaValue ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
        </select>
      </label>
      <label class="block space-y-1.5">
        <span class="text-xs font-medium text-muted-foreground">货架</span>
        <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="${fieldPrefix}-shelf">
          ${shelfOptions.map((option) => `<option value="${escapeAttr(option.value)}" ${option.value === shelfValue ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
        </select>
      </label>
      <label class="block space-y-1.5">
        <span class="text-xs font-medium text-muted-foreground">库位</span>
        <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="${fieldPrefix}-location">
          ${locationOptions.map((option) => `<option value="${escapeAttr(option.value)}" ${option.value === locationValue ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
        </select>
      </label>
    </div>
  `
}

function updateAuxiliaryWaitHandoverArea(action: AuxiliaryWaitHandoverAction, value: string): void {
  const warehouse = getCurrentFactoryWarehouseByKind('WAIT_HANDOVER')
  const options = warehouse ? getWarehousePositionOptions(warehouse.warehouseId) : null
  const nextShelf = options?.shelfOptionsByArea[value]?.[0]?.value || ''
  const nextLocation = options?.locationOptionsByShelf[nextShelf]?.[0]?.value || ''
  if (action === 'finish-inbound') {
    state.auxiliaryFinishArea = value
    state.auxiliaryFinishShelf = nextShelf
    state.auxiliaryFinishLocation = nextLocation
  } else {
    state.auxiliaryHandoverArea = value
    state.auxiliaryHandoverShelf = nextShelf
    state.auxiliaryHandoverLocation = nextLocation
  }
}

function updateAuxiliaryWaitHandoverShelf(action: AuxiliaryWaitHandoverAction, value: string): void {
  const warehouse = getCurrentFactoryWarehouseByKind('WAIT_HANDOVER')
  const options = warehouse ? getWarehousePositionOptions(warehouse.warehouseId) : null
  const nextLocation = options?.locationOptionsByShelf[value]?.[0]?.value || ''
  if (action === 'finish-inbound') {
    state.auxiliaryFinishShelf = value
    state.auxiliaryFinishLocation = nextLocation
  } else {
    state.auxiliaryHandoverShelf = value
    state.auxiliaryHandoverLocation = nextLocation
  }
}

function updateAuxiliaryWaitHandoverLocation(action: AuxiliaryWaitHandoverAction, value: string): void {
  if (action === 'finish-inbound') state.auxiliaryFinishLocation = value
  else state.auxiliaryHandoverLocation = value
}

function getFirstCuttingTaskId(): string {
  return listPdaCuttingTaskSourceRecords()[0]?.taskId || 'CUTTING-DEMO'
}

function getCuttingWaitHandoverAction(value?: string | null): typeof CUTTING_WAIT_HANDOVER_ACTIONS[number] | null {
  return CUTTING_WAIT_HANDOVER_ACTIONS.find((item) => item.key === value) || null
}

function getCuttingWaitHandoverActionRoute(actionKey: CuttingWaitHandoverActionKey, firstTaskId: string): string {
  if (actionKey === 'numbering') return '/fcs/pda/cutting/fei-ticket-numbering'
  if (actionKey === 'inbound') return `/fcs/pda/cutting/inbound/${firstTaskId}`
  if (actionKey === 'special-craft-return') return `/fcs/pda/cutting/handover/${firstTaskId}?action=special-craft-return`
  return `/fcs/pda/cutting/handover/${firstTaskId}?action=handover-bagging-confirm`
}

function buildCuttingBaggingConfirmProjection(inboundTempBags: InboundTempBag[]): HandoverPickingTaskProjection {
  const inboundInventoryRecords = buildInboundTempBagInventoryRecords(inboundTempBags)
  return buildHandoverPickingTaskProjectionFromAllocationProjection(
    buildSewingTaskAllocationProjectionFromInventory(inboundInventoryRecords),
  )
}

function renderCuttingBaggingConfirmTaskCard(
  task: HandoverPickingTaskProjection['tasks'][number],
  firstTaskId: string,
): string {
  const requiredQty = task.requiredItems.reduce((sum, item) => sum + item.requiredQty, 0)
  const availableQty = task.allocatedInventoryItems.reduce((sum, item) => sum + item.pieceQty, 0)
  const packedQty = task.targetTransferBags.reduce((sum, bag) => sum + bag.totalPieceQty, 0)
  const skuCount = new Set(task.allocatedInventoryItems.map((item) => `${item.size}-${item.partCode}`)).size || task.allocatedInventoryItems.length
  const route = `/fcs/pda/cutting/handover/${firstTaskId}?action=handover-bagging-confirm&baggingConfirmTaskId=${escapeAttr(task.pickingTaskId)}`
  return `
    <article class="rounded-lg border bg-card p-3">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="truncate text-sm font-semibold text-foreground">${escapeHtml(task.pickingTaskNo)}</div>
          <div class="mt-1 text-xs text-muted-foreground">车缝任务：${escapeHtml(task.sewingTaskNo)}</div>
        </div>
        ${renderStatusPill(task.taskStatus === '待分拣' ? '待交出装袋确认' : task.taskStatus)}
      </div>
      <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div><span class="text-muted-foreground">车缝厂：</span>${escapeHtml(task.receiverFactoryName)}</div>
        <div><span class="text-muted-foreground">SKU/部位：</span>${skuCount} 项</div>
        <div><span class="text-muted-foreground">应装：</span>${requiredQty} 片</div>
        <div><span class="text-muted-foreground">可装：</span>${availableQty} 片</div>
        <div><span class="text-muted-foreground">已装：</span>${packedQty} 片</div>
        <div><span class="text-muted-foreground">缺口：</span>${task.shortageItems.length} 项</div>
      </div>
      <div class="mt-3 rounded border bg-muted/20 px-2.5 py-2 text-xs text-muted-foreground">
        来源暂存袋：${escapeHtml(task.tempBagSources.map((item) => item.tempBagCode).join('、') || '待扫描')}
      </div>
      <button
        type="button"
        class="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
        data-nav="${route}"
      >
        进入交出装袋确认
      </button>
    </article>
  `
}

function renderCuttingBaggingConfirmTaskList(
  projection: HandoverPickingTaskProjection,
  firstTaskId: string,
): string {
  return `
    <section class="space-y-3">
      <div class="px-1 text-base font-semibold text-foreground">交出装袋确认任务</div>
      ${
        projection.tasks.length
          ? projection.tasks.map((task) => renderCuttingBaggingConfirmTaskCard(task, firstTaskId)).join('')
          : renderMobilePageEmptyState('暂无交出装袋确认任务', '车缝任务分配并有裁片入仓后，会按车缝任务生成交出装袋确认任务。')
      }
    </section>
  `
}

function renderCuttingSpecialCraftReturnCandidates(
  runtimeProjection: WaitHandoverRuntimeProjection,
  firstTaskId: string,
  action: CuttingWaitHandoverCardAction,
): string {
  const returnedKeys = new Set(
    runtimeProjection.runtimeEvents
      .filter((event) => event.eventType === '特殊工艺回仓')
      .flatMap((event) => (event.refs.feiTicketIds || []).map((feiTicketId) => `${feiTicketId}:${event.refs.specialCraftId || ''}`)),
  )
  const candidates = listHandoverRecords()
    .filter((record) => record.handoverType === '特殊工艺交出' && record.specialCraftItems?.length)
    .flatMap((record) =>
      (record.specialCraftItems || []).map((craftItem) => {
        const ticket = record.feiTicketItems.find((item) => item.feiTicketId === craftItem.feiTicketId)
        const bag = record.transferBagUses.find((item) => item.containedFeiTicketIds.includes(craftItem.feiTicketId)) || record.transferBagUses[0]
        return { record, craftItem, ticket, bag }
      }),
    )
    .filter((item) => item.ticket)
    .slice(0, 5)

  return `
    <section class="space-y-3">
      <div class="px-1 text-base font-semibold text-foreground">待回仓菲票</div>
      ${
        candidates.length
          ? candidates.map(({ record, craftItem, ticket, bag }) => {
              const route = `/fcs/pda/cutting/handover/${firstTaskId}?action=special-craft-return`
              const isReturned = returnedKeys.has(`${craftItem.feiTicketId}:${craftItem.specialCraftId}`)
              return `
                <article class="rounded-lg border bg-card p-3">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <div class="truncate text-sm font-semibold text-foreground">${escapeHtml(ticket?.feiTicketNo || craftItem.feiTicketId)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">来源：${escapeHtml(record.handoverRecordNo)} / ${escapeHtml(bag?.bagCode || '无中转袋')}</div>
                    </div>
                    ${renderStatusPill(isReturned ? '已回仓' : '待回仓')}
                  </div>
                  <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div><span class="text-muted-foreground">裁片部位：</span>${escapeHtml(craftItem.partName)}</div>
                    <div><span class="text-muted-foreground">尺码：</span>${escapeHtml(craftItem.size)}</div>
                    <div><span class="text-muted-foreground">工艺：</span>${escapeHtml(craftItem.craftType)}</div>
                    <div><span class="text-muted-foreground">应回：</span>${craftItem.pieceQty} 片</div>
                  </div>
                  <button
                    type="button"
                    class="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
                    data-nav="${escapeAttr(route)}"
                    title="${escapeHtml(action.hint)}"
                  >
                    ${escapeHtml(action.label)}
                  </button>
                </article>
              `
            }).join('')
          : renderMobilePageEmptyState('暂无待回仓菲票', '特殊工艺交出后，先扫中转袋再扫菲票并入库区库位。')
      }
    </section>
  `
}

function renderCuttingWaitHandoverActionCards(activeAction?: string | null): string {
  return `
    <section class="grid grid-cols-2 gap-2">
      ${CUTTING_WAIT_HANDOVER_ACTIONS.map((item) => `
        <button
          type="button"
          class="rounded-2xl border px-4 py-4 text-left shadow-sm ${activeAction === item.key ? 'border-primary bg-primary/5' : 'bg-card'}"
          data-nav="/fcs/pda/warehouse/wait-handover?scope=cutting&action=${escapeAttr(item.key)}"
        >
          <div class="text-sm font-semibold text-foreground">${escapeHtml(item.title)}</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">${escapeHtml(item.desc)}</div>
        </button>
      `).join('')}
    </section>
  `
}

function renderCuttingWaitHandoverSubpageHeader(title: string, description: string): string {
  return `
    <div class="flex items-start justify-between gap-3 px-1 pb-1 pt-1">
      <div class="min-w-0">
        <div class="text-xl font-semibold leading-tight text-foreground">${escapeHtml(title)}</div>
        <div class="mt-1 max-w-[280px] text-xs leading-5 text-muted-foreground">${escapeHtml(description)}</div>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground"
        data-nav="/fcs/pda/warehouse"
      >
        返回仓管
      </button>
    </div>
  `
}

function renderAuxiliaryWaitHandoverActionPage(action: AuxiliaryWaitHandoverAction): string {
  const sample = ensureAuxiliaryWaitHandoverDraft(action)
  const runtimeLabel = getCraftWarehouseRuntimeLabel() || '工艺'
  const isFinishInbound = action === 'finish-inbound'
  const title = isFinishInbound ? '完工入仓' : '交出确认'
  const scanValue = isFinishInbound ? state.auxiliaryFinishScan : state.auxiliaryHandoverScan
  const qtyValue = isFinishInbound ? state.auxiliaryFinishQty : state.auxiliaryHandoverQty
  return `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="flex items-start justify-between gap-3">
        <div>
          <div class="text-xl font-semibold leading-tight text-foreground">${escapeHtml(title)}</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">${escapeHtml(sample ? `${sample.craftName || runtimeLabel} · ${sample.itemName}` : '暂无可用演示记录')}</div>
        </div>
        <button type="button" class="shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-medium" data-nav="/fcs/pda/warehouse">返回仓管</button>
      </section>
      ${renderAuxiliaryWaitHandoverActionCards(action)}
      <section class="space-y-3 rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">${isFinishInbound ? '加工任务 / 完工单' : '交出单 / 加工任务'}</span>
          <input
            class="h-11 w-full rounded-xl border bg-background px-3 text-sm"
            value="${escapeAttr(scanValue)}"
            placeholder="扫码或输入单号"
            data-pda-warehouse-field="${isFinishInbound ? 'auxiliary-finish-scan' : 'auxiliary-handover-scan'}"
          />
        </label>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">${isFinishInbound ? '完工数量' : '交出数量'}（${escapeHtml(sample?.unit || '件')}）</span>
          <input
            class="h-11 w-full rounded-xl border bg-background px-3 text-sm"
            inputmode="decimal"
            value="${escapeAttr(qtyValue)}"
            data-pda-warehouse-field="${isFinishInbound ? 'auxiliary-finish-qty' : 'auxiliary-handover-qty'}"
          />
        </label>
        ${
          isFinishInbound
            ? `<label class="block space-y-1.5">
                <span class="text-xs font-medium text-muted-foreground">损耗数量（${escapeHtml(sample?.unit || '件')}）</span>
                <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="decimal" value="${escapeAttr(state.auxiliaryFinishLossQty)}" data-pda-warehouse-field="auxiliary-finish-loss-qty" />
              </label>`
            : `<label class="block space-y-1.5">
                <span class="text-xs font-medium text-muted-foreground">接收方</span>
                <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" value="${escapeAttr(state.auxiliaryHandoverReceiver)}" data-pda-warehouse-field="auxiliary-handover-receiver" />
              </label>`
        }
        ${renderAuxiliaryWaitHandoverPositionFields(action)}
        <button type="button" class="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" data-pda-warehouse-action="confirm-auxiliary-${isFinishInbound ? 'finish' : 'handover'}">
          ${escapeHtml(isFinishInbound ? '确认完工入仓' : '确认交出')}
        </button>
      </section>
    </div>
  `
}

function renderAuxiliaryWaitHandoverPage(): string {
  const activeAction = getAuxiliaryWaitHandoverAction(getMobileWarehouseSearchParams().get('action'))
  if (activeAction) {
    const title = activeAction === 'finish-inbound' ? '完工入仓' : '交出确认'
    return renderPdaFrame(renderAuxiliaryWaitHandoverActionPage(activeAction), 'warehouse', { headerTitle: title, disableTodoAutoOpen: true })
  }
  const runtime = getMobileWarehouseRuntimeContext()
  const runtimeLabel = getCraftWarehouseRuntimeLabel() || '工艺'
  const rows = getAuxiliaryWaitHandoverRows()
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${runtime ? renderWarehouseSummaryHeader(`${runtimeLabel}待交出仓`, '完工入仓生成待交出库存，交出确认后形成交出记录。', runtime.overview) : ''}
      ${renderAuxiliaryWaitHandoverActionCards()}
      ${renderSectionFilterChips(state.status, FILTERS, 'wait-handover-status')}
      <section class="space-y-3">
        ${
          rows.length > 0
            ? rows.map((row) => `
              <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-semibold text-foreground">${escapeHtml(row.taskNo || row.stockItemId)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.craftName || runtimeLabel)} · ${escapeHtml(row.handoverOrderNo || '待交出')}</div>
                  </div>
                  ${renderStatusPill(row.status)}
                </div>
                <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  <div>库存对象：${escapeHtml(row.itemName)} / ${escapeHtml(row.materialSku || row.partName || '-')}</div>
                  <div>生产单：${escapeHtml(row.productionOrderNo || '-')}</div>
                  <div>菲票 / 中转袋：${escapeHtml(row.feiTicketNo || '-')} / ${escapeHtml(row.transferBagNo || '-')}</div>
                  <div>完工 / 损耗：${row.completedQty} / ${row.lossQty} ${escapeHtml(row.unit)}</div>
                  <div>待交出 / 回写：${row.waitHandoverQty} / ${row.receiverWrittenQty ?? '-'} ${escapeHtml(row.unit)}</div>
                  <div>接收方：${escapeHtml(row.receiverName || '-')}</div>
                  <div>交出记录：${escapeHtml(row.handoverRecordNo || '待提交')}</div>
                  <div>库区 / 货架 / 库位：${escapeHtml(row.areaName)} / ${escapeHtml(row.shelfNo)} / ${escapeHtml(row.locationNo)}</div>
                  <div>差异 / 异议：${escapeHtml(buildWarehouseDifferenceText(row.differenceQty))}${row.objectionStatus ? ` · ${escapeHtml(row.objectionStatus)}` : ''}</div>
                </div>
                <div class="mt-4 flex flex-wrap gap-2">
                  <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-wait-handover-detail" data-stock-item-id="${escapeAttr(row.stockItemId)}">查看</button>
                  <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="/fcs/pda/warehouse/wait-handover?action=finish-inbound">完工入仓</button>
                  <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="/fcs/pda/warehouse/wait-handover?action=handover-confirm">交出确认</button>
                  <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-wait-handover-location" data-stock-item-id="${escapeAttr(row.stockItemId)}">调整位置</button>
                </div>
              </article>
            `).join('')
            : renderMobilePageEmptyState(`暂无${runtimeLabel}待交出仓记录`, '完工入仓后会形成待交出库存。')
        }
      </section>
      ${renderDetailDrawer()}
      ${renderLocationDialog()}
    </div>
  `
  return renderPdaFrame(content, 'warehouse', { headerTitle: `${runtimeLabel}待交出仓`, disableTodoAutoOpen: true })
}

function renderCuttingWaitHandoverCardAction(action?: CuttingWaitHandoverCardAction): string {
  if (!action) return ''
  return `
    <div class="mt-3 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] leading-4 text-blue-700">${escapeHtml(action.hint)}</div>
    <button
      type="button"
      class="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      data-nav="${escapeAttr(action.route)}"
    >
      ${escapeHtml(action.label)}
    </button>
  `
}

function renderCuttingTicketCandidate(
  ticket: WaitHandoverRuntimeProjection['ticketCandidates'][number],
  action?: CuttingWaitHandoverCardAction,
): string {
  const pieceQty = ticket.actualCutPieceQty || ticket.qty || 0
  const status = ticket.printStatus === 'WAIT_PRINT' ? '待打印' : ticket.printStatus === 'VOIDED' ? '已作废' : '可入仓'
  return `
    <article class="cursor-pointer rounded-lg border bg-card transition-colors hover:border-primary">
      <div class="space-y-2 p-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="inline-flex shrink-0 items-center rounded border border-border bg-muted px-1.5 py-0 text-[10px]">菲票</span>
            <span class="truncate text-sm font-semibold text-foreground">${escapeHtml(ticket.feiTicketNo)}</span>
          </div>
          ${renderStatusPill(status)}
        </div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
          <div><span class="text-muted-foreground">铺布单：</span>${escapeHtml(ticket.spreadingOrderNo || ticket.sourceSpreadingSessionNo || '待关联')}</div>
          <div><span class="text-muted-foreground">裁片数量：</span>${pieceQty} 片</div>
          <div><span class="text-muted-foreground">颜色：</span>${escapeHtml(ticket.skuColor || ticket.fabricColor || '待补颜色')}</div>
          <div><span class="text-muted-foreground">尺码：</span>${escapeHtml(ticket.skuSize || '-')}</div>
          <div class="col-span-2"><span class="text-muted-foreground">编号范围：</span>${escapeHtml(ticket.pieceSequenceLabel || ticket.pieceSetNoRange || '按菲票追踪')}</div>
        </div>
        <div class="flex items-center gap-2 py-0.5 text-xs">
          <span class="shrink-0 text-muted-foreground">流向：</span>
          <span class="inline-flex items-center rounded border bg-background px-1.5 py-0 text-[10px]">裁剪完成</span>
          <i data-lucide="arrow-right" class="h-3 w-3 shrink-0 text-muted-foreground"></i>
          <span class="inline-flex items-center rounded border bg-background px-1.5 py-0 text-[10px]">待交出仓</span>
        </div>
        <div class="grid grid-cols-2 gap-2 rounded border bg-muted/20 px-2.5 py-2 text-xs">
          <div>部位：<span class="font-medium">${escapeHtml(ticket.partName || '-')}</span></div>
          <div>特殊工艺：<span class="font-medium">${ticket.hasSpecialCraft ? '有' : '无'}</span></div>
        </div>
        ${renderCuttingWaitHandoverCardAction(action)}
      </div>
    </article>
  `
}

function renderCuttingInboundBagItem(bag: InboundTempBag, action?: CuttingWaitHandoverCardAction): string {
  return `
    <article class="cursor-pointer rounded-lg border bg-card transition-colors hover:border-primary">
      <div class="space-y-2 p-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="inline-flex shrink-0 items-center rounded border border-border bg-muted px-1.5 py-0 text-[10px]">暂存袋</span>
            <span class="truncate text-sm font-semibold text-foreground">${escapeHtml(bag.bagCode)}</span>
          </div>
          ${renderStatusPill(bag.nextSortingStatus)}
        </div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
          <div><span class="text-muted-foreground">库区：</span>${escapeHtml(bag.warehouseArea)}</div>
          <div><span class="text-muted-foreground">库位：</span>${escapeHtml(bag.locationCode)}</div>
          <div><span class="text-muted-foreground">菲票数量：</span>${bag.containedFeiTickets.length} 张</div>
          <div><span class="text-muted-foreground">裁片数量：</span>${bag.totalPieceQty} 片</div>
        </div>
        <div class="flex items-center gap-2 py-0.5 text-xs">
          <span class="shrink-0 text-muted-foreground">流向：</span>
          <span class="inline-flex items-center rounded border bg-background px-1.5 py-0 text-[10px]">入仓暂存装袋</span>
          <i data-lucide="arrow-right" class="h-3 w-3 shrink-0 text-muted-foreground"></i>
          <span class="inline-flex items-center rounded border bg-background px-1.5 py-0 text-[10px]">交出装袋确认</span>
        </div>
        <div class="grid grid-cols-2 gap-2 rounded border bg-muted/20 px-2.5 py-2 text-xs">
          <div>混装：<span class="font-medium">${escapeHtml(bag.mixedFlag ? bag.mixedSummary : '未混装')}</span></div>
          <div>特殊工艺：<span class="font-medium">${escapeHtml(bag.containedFeiTickets.some((ticket) => ticket.hasSpecialCraft) ? '包含' : '无')}</span></div>
          <div class="col-span-2">入仓：<span class="font-medium">${escapeHtml(bag.inboundAt)} / ${escapeHtml(bag.inboundBy)}</span></div>
        </div>
        ${renderCuttingWaitHandoverCardAction(action)}
      </div>
    </article>
  `
}

function renderCuttingRuntimeEventItem(
  event: WaitHandoverRuntimeProjection['runtimeEvents'][number],
  action?: CuttingWaitHandoverCardAction,
): string {
  const payload = event.payload && typeof event.payload === 'object' ? event.payload as Record<string, unknown> : {}
  const totalQty = Number(event.inventoryEffect?.qty || payload.totalPieceQty || payload.pickedQty || payload.totalPieceQty || 0)
  const transferBagCode = event.refs.transferBagCode || String(payload.bagCode || payload.targetTransferBagCode || payload.sourceTempBagCode || '-')
  return `
    <article class="cursor-pointer rounded-lg border bg-card transition-colors hover:border-primary">
      <div class="space-y-2 p-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="inline-flex shrink-0 items-center rounded border border-border bg-muted px-1.5 py-0 text-[10px]">${escapeHtml(event.eventType)}</span>
            <span class="truncate text-sm font-semibold text-foreground">${escapeHtml(event.eventNo || event.eventType)}</span>
          </div>
          ${renderStatusPill(event.eventStatus)}
        </div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
          <div><span class="text-muted-foreground">中转袋：</span>${escapeHtml(transferBagCode)}</div>
          <div><span class="text-muted-foreground">菲票数量：</span>${event.refs.feiTicketNos?.length || event.refs.feiTicketIds?.length || 0} 张</div>
          <div><span class="text-muted-foreground">数量：</span>${Number.isFinite(totalQty) ? totalQty : 0} ${escapeHtml(event.inventoryEffect?.unit || '片')}</div>
          <div><span class="text-muted-foreground">操作人：</span>${escapeHtml(event.operatorName || '待补')}</div>
          <div class="col-span-2"><span class="text-muted-foreground">操作时间：</span>${escapeHtml(event.occurredAt)}</div>
        </div>
        <div class="flex items-center gap-2 py-0.5 text-xs">
          <span class="shrink-0 text-muted-foreground">来源：</span>
          <span class="inline-flex items-center rounded border bg-background px-1.5 py-0 text-[10px]">${escapeHtml(event.refs.cutOrderNo || event.refs.productionOrderNo || '裁床任务')}</span>
          <i data-lucide="arrow-right" class="h-3 w-3 shrink-0 text-muted-foreground"></i>
          <span class="inline-flex items-center rounded border bg-background px-1.5 py-0 text-[10px]">${escapeHtml(event.inventoryEffect?.inventoryScope || '待交出仓')}</span>
        </div>
        <div class="grid grid-cols-2 gap-2 rounded border bg-muted/20 px-2.5 py-2 text-xs">
          <div>生产单：<span class="font-medium">${escapeHtml(event.refs.productionOrderNo || '-')}</span></div>
          <div>裁片单：<span class="font-medium">${escapeHtml(event.refs.cutOrderNo || '-')}</span></div>
        </div>
        ${renderCuttingWaitHandoverCardAction(action)}
      </div>
    </article>
  `
}

function renderCuttingWaitHandoverStarterCard(
  action: typeof CUTTING_WAIT_HANDOVER_ACTIONS[number],
  cardAction: CuttingWaitHandoverCardAction,
  options: {
    objectLabel: string
    objectText: string
    fromText: string
    toText: string
    summaryLeft: string
    summaryRight: string
  },
): string {
  return `
    <article class="cursor-pointer rounded-lg border bg-card transition-colors hover:border-primary">
      <div class="space-y-2 p-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="inline-flex shrink-0 items-center rounded border border-border bg-muted px-1.5 py-0 text-[10px]">${escapeHtml(options.objectLabel)}</span>
            <span class="truncate text-sm font-semibold text-foreground">${escapeHtml(action.title)}</span>
          </div>
          ${renderStatusPill('待扫描')}
        </div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
          <div class="col-span-2"><span class="text-muted-foreground">操作对象：</span>${escapeHtml(options.objectText)}</div>
          <div><span class="text-muted-foreground">当前功能：</span>${escapeHtml(action.title)}</div>
          <div><span class="text-muted-foreground">状态：</span>待扫描</div>
        </div>
        <div class="flex items-center gap-2 py-0.5 text-xs">
          <span class="shrink-0 text-muted-foreground">流向：</span>
          <span class="inline-flex items-center rounded border bg-background px-1.5 py-0 text-[10px]">${escapeHtml(options.fromText)}</span>
          <i data-lucide="arrow-right" class="h-3 w-3 shrink-0 text-muted-foreground"></i>
          <span class="inline-flex items-center rounded border bg-background px-1.5 py-0 text-[10px]">${escapeHtml(options.toText)}</span>
        </div>
        <div class="grid grid-cols-2 gap-2 rounded border bg-muted/20 px-2.5 py-2 text-xs">
          <div>${escapeHtml(options.summaryLeft)}</div>
          <div>${escapeHtml(options.summaryRight)}</div>
        </div>
        ${renderCuttingWaitHandoverCardAction(cardAction)}
      </div>
    </article>
  `
}

function renderCuttingWaitHandoverActionPreview(
  action: typeof CUTTING_WAIT_HANDOVER_ACTIONS[number],
  firstTaskId: string,
  runtimeProjection: WaitHandoverRuntimeProjection,
  inboundTempBags: InboundTempBag[],
): string {
  const actionRoute = getCuttingWaitHandoverActionRoute(action.key, firstTaskId)
  const cardAction: CuttingWaitHandoverCardAction = {
    label: action.primaryLabel,
    route: actionRoute,
    hint: action.desc,
  }
  const actionKey = action.key

  if (actionKey === 'inbound') {
    return `
      <section class="space-y-3">
        <div class="px-1 text-base font-semibold text-foreground">待入仓菲票</div>
        ${runtimeProjection.ticketCandidates.slice(0, 4).map((ticket) => renderCuttingTicketCandidate(ticket, cardAction)).join('') || renderMobilePageEmptyState('暂无待入仓菲票', '裁剪完成并确认菲票后，会出现在这里。')}
      </section>
      <section class="space-y-3">
        <div class="px-1 text-base font-semibold text-foreground">最近入仓暂存装袋结果</div>
        ${inboundTempBags.slice(0, 2).map(renderCuttingInboundBagItem).join('') || renderMobilePageEmptyState('暂无入仓暂存装袋结果', '完成入仓暂存装袋后，会形成入仓暂存袋。')}
      </section>
    `
  }
  if (actionKey === 'handover-bagging-confirm') {
    const pickingProjection = buildCuttingBaggingConfirmProjection(inboundTempBags)
    return `
      ${renderCuttingBaggingConfirmTaskList(pickingProjection, firstTaskId)}
      <section class="space-y-3">
        <div class="px-1 text-base font-semibold text-foreground">最近交出装袋确认</div>
        ${runtimeProjection.baggingConfirmEvents.slice(0, 5).map((event) => renderCuttingRuntimeEventItem(event, cardAction)).join('') || renderMobilePageEmptyState('暂无交出装袋确认记录', '进入任务后扫码来源暂存袋、菲票和目标中转袋。')}
      </section>
    `
  }
  if (actionKey === 'special-craft-return') {
    const returnEvents = runtimeProjection.runtimeEvents.filter((event) => event.eventType === '特殊工艺回仓')
    return `
      ${renderCuttingSpecialCraftReturnCandidates(runtimeProjection, firstTaskId, cardAction)}
      <section class="space-y-3">
        <div class="px-1 text-base font-semibold text-foreground">最近特殊工艺回仓</div>
        ${returnEvents.slice(0, 5).map((event) => renderCuttingRuntimeEventItem(event, cardAction)).join('') || renderMobilePageEmptyState('暂无特殊工艺回仓记录', '扫码回仓后，会写入裁床待交出仓库存。')}
      </section>
    `
  }
  return ''
}

function renderCuttingWaitHandoverNextActions(actionKey: CuttingWaitHandoverActionKey): string {
  const actions = actionKey === 'inbound'
    ? [
        { label: '去交出装袋确认', route: '/fcs/pda/warehouse/wait-handover?scope=cutting&action=handover-bagging-confirm' },
        { label: '返回裁床待交出仓', route: '/fcs/pda/warehouse/wait-handover?scope=cutting' },
      ]
    : [
        { label: '返回裁床待交出仓', route: '/fcs/pda/warehouse/wait-handover?scope=cutting' },
        { label: '返回仓管', route: '/fcs/pda/warehouse' },
      ]
  return `
    <section class="space-y-2">
      <div class="px-1 text-base font-semibold text-foreground">后续操作</div>
      <div class="grid grid-cols-1 gap-2">
        ${actions.map((item) => `
          <button
            type="button"
            class="w-full rounded-xl border bg-background px-4 py-3 text-left text-sm font-medium text-foreground"
            data-nav="${escapeAttr(item.route)}"
          >
            ${escapeHtml(item.label)}
          </button>
        `).join('')}
      </div>
    </section>
  `
}

function renderCuttingWaitHandoverActionPage(
  action: typeof CUTTING_WAIT_HANDOVER_ACTIONS[number],
  firstTaskId: string,
  runtimeProjection: WaitHandoverRuntimeProjection,
  inboundTempBags: InboundTempBag[],
): string {
  return `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${renderCuttingWaitHandoverSubpageHeader(action.title, action.desc)}
      ${renderCuttingWaitHandoverActionPreview(action, firstTaskId, runtimeProjection, inboundTempBags)}
      ${renderCuttingWaitHandoverNextActions(action.key)}
    </div>
  `
}

function renderCuttingWarehouseSwitch(active: 'wait-process' | 'wait-handover'): string {
  return `
    <section class="grid grid-cols-2 gap-2">
      <button type="button" class="rounded-2xl ${active === 'wait-process' ? 'bg-primary text-primary-foreground' : 'border bg-background'} px-4 py-3 text-sm font-medium" data-nav="/fcs/pda/warehouse/wait-process?scope=cutting">裁床待加工仓</button>
      <button type="button" class="rounded-2xl ${active === 'wait-handover' ? 'bg-primary text-primary-foreground' : 'border bg-background'} px-4 py-3 text-sm font-medium" data-nav="/fcs/pda/warehouse/wait-handover?scope=cutting">裁床待交出仓</button>
    </section>
  `
}

function renderCuttingWaitHandoverPage(): string {
  const activeAction = getMobileWarehouseSearchParams().get('action')
  const runtimeProjection = buildWaitHandoverRuntimeProjection()
  const transferBagViewModel = buildTransferBagsProjection().viewModel
  const fallbackInboundTempBags = buildInboundTempBagsFromTransferBagViewModel(transferBagViewModel)
  const inboundTempBags = runtimeProjection.inboundTempBags.length ? runtimeProjection.inboundTempBags : fallbackInboundTempBags
  const firstTaskId = getFirstCuttingTaskId()
  const action = getCuttingWaitHandoverAction(activeAction)

  if (action) {
    return renderPdaFrame(
      renderCuttingWaitHandoverActionPage(action, firstTaskId, runtimeProjection, inboundTempBags),
      'warehouse',
      { headerTitle: '裁床待交出仓', disableTodoAutoOpen: true },
    )
  }

  return renderPdaFrame(`
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${renderCuttingWarehouseSwitch('wait-handover')}
      ${renderCuttingWaitHandoverActionCards(activeAction)}
      <section class="space-y-3">
        ${inboundTempBags.slice(0, 5).map(renderCuttingInboundBagItem).join('') || renderMobilePageEmptyState('暂无入仓暂存袋', '完成入仓暂存装袋后，会进入裁床待交出仓。')}
      </section>
    </div>
  `, 'warehouse', { headerTitle: '裁床待交出仓', disableTodoAutoOpen: true })
}

function normalizePostFinishingIdSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').slice(-16) || 'UNKNOWN'
}

function buildPostFinishingPdaHandoverRoute(recheckOrderNo: string): string {
  return `/fcs/pda/handover/HOH-POST-${normalizePostFinishingIdSegment(recheckOrderNo)}`
}

function getLinkedQrValue(source: Record<string, unknown>): string | undefined {
  const value = source[LINKED_QR_FIELD]
  return typeof value === 'string' ? value : undefined
}

function getRows() {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return []
  return listFactoryWaitHandoverStockItems()
    .filter((item) => item.factoryId === runtime.factoryId)
    .filter((item) => (state.status === '全部' ? true : item.status === state.status))
}

function openLocationEditor(stockItemId: string): void {
  const row = getRows().find((item) => item.stockItemId === stockItemId)
  if (!row) return
  state.locationEditId = row.stockItemId
  state.areaName = row.areaName
  state.shelfNo = row.shelfNo
  state.locationNo = row.locationNo
  state.remark = row.remark || ''
}

function renderDetailDrawer(): string {
  const row = getRows().find((item) => item.stockItemId === state.detailId)
  if (!row) return ''
  const specialCraftSummary = row.feiTicketNo ? getSpecialCraftFeiTicketSummary(row.feiTicketNo) : null
  const outboundRoute = resolveWarehouseOutboundRecordRoute(row.handoverRecordId)
  return `
    <div class="fixed inset-0 z-[120]">
      <button type="button" class="absolute inset-0 bg-black/40" data-pda-warehouse-action="close-wait-handover-detail"></button>
      <section class="absolute inset-x-0 bottom-[72px] rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-semibold text-foreground">待交出仓详情</h2>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-pda-warehouse-action="close-wait-handover-detail">关闭</button>
        </div>
        <div class="mt-4 rounded-2xl border bg-card px-4 py-4 shadow-sm">
          ${renderCompactFieldList([
            { label: '来源任务', value: row.taskNo || '-' },
            { label: '物料 / 裁片类型', value: `${row.itemKind} / ${row.itemName}` },
            { label: '面料 SKU / 裁片部位', value: row.materialSku || row.partName || '-' },
            { label: '颜色', value: row.fabricColor || '-' },
            { label: '尺码', value: row.sizeCode || '-' },
            { label: '菲票号', value: row.feiTicketNo || '-' },
            { label: '特殊工艺', value: specialCraftSummary ? specialCraftSummary.operationNames.join(' / ') || '无' : '-' },
            { label: '当前所在', value: specialCraftSummary?.currentLocation || '-' },
            { label: '已完成特殊工艺', value: specialCraftSummary?.completedOperationNames.join(' / ') || '-' },
            { label: '当前特殊工艺', value: specialCraftSummary?.currentOperationName || '-' },
            { label: '原裁片数量 / 当前裁片数量', value: specialCraftSummary ? `${specialCraftSummary.originalQty} / ${specialCraftSummary.currentQty}` : '-' },
            { label: '报废裁片数量 / 货损裁片数量', value: specialCraftSummary ? `${specialCraftSummary.cumulativeScrapQty} / ${specialCraftSummary.cumulativeDamageQty}` : '-' },
            { label: '差异状态', value: specialCraftSummary ? [specialCraftSummary.receiveDifferenceStatus, specialCraftSummary.returnDifferenceStatus].filter((item) => item && item !== '—').join(' / ') || '无' : '-' },
            { label: '发料状态 / 回仓状态', value: specialCraftSummary ? `${specialCraftSummary.dispatchStatus} / ${specialCraftSummary.returnStatus}` : '-' },
            { label: '中转袋号', value: row.transferBagNo || '-' },
            { label: '卷号', value: row.fabricRollNo || '-' },
            { label: '加工完成数量', value: `${row.completedQty} ${row.unit}` },
            { label: '损耗数量', value: `${row.lossQty} ${row.unit}` },
            { label: '待交出数量', value: `${row.waitHandoverQty} ${row.unit}` },
            { label: '接收方', value: row.receiverName || '-' },
            { label: '交出单', value: row.handoverOrderNo || '-' },
            { label: '交出记录', value: row.handoverRecordNo || '-' },
            { label: '出库记录', value: outboundRoute.includes('recordId=') ? '点击查看' : '未出库' },
            { label: '交出二维码', value: getWarehouseQrDisplayText(getLinkedQrValue(row)) },
            { label: '回写状态', value: getWaitHandoverWritebackStatusLabel(row) },
            { label: '回写数量', value: row.receiverWrittenQty === undefined ? '-' : `${row.receiverWrittenQty} ${row.unit}` },
            { label: '差异 / 异议', value: buildWarehouseDifferenceText(row.differenceQty) },
            { label: '库区', value: row.areaName },
            { label: '货架', value: row.shelfNo },
            { label: '库位', value: row.locationNo },
            { label: '状态', value: row.status },
          ])}
          <div class="mt-4 flex gap-2">
            <button type="button" class="flex-1 rounded-xl border px-3 py-2.5 text-sm" data-nav="${escapeAttr(outboundRoute)}">查看出库</button>
            <button type="button" class="flex-1 rounded-xl border px-3 py-2.5 text-sm" data-nav="${escapeAttr(resolveWaitHandoverRoute(row))}">查看交出</button>
            <button type="button" class="flex-1 rounded-xl border px-3 py-2.5 text-sm" data-nav="${escapeAttr(resolveTaskRoute(row.taskId))}">查看任务</button>
          </div>
        </div>
      </section>
    </div>
  `
}

function renderLocationDialog(): string {
  const row = getRows().find((item) => item.stockItemId === state.locationEditId)
  if (!row) return ''
  const warehouse = getCurrentFactoryWarehouseByKind('WAIT_HANDOVER')
  if (!warehouse) return ''
  const options = getWarehousePositionOptions(warehouse.warehouseId)
  const shelfOptions = options.shelfOptionsByArea[state.areaName] || []
  const locationOptions = options.locationOptionsByShelf[state.shelfNo] || []
  return `
    <div class="fixed inset-0 z-[125]">
      <button type="button" class="absolute inset-0 bg-black/40" data-pda-warehouse-action="close-wait-handover-location"></button>
      <section class="absolute inset-x-0 bottom-[72px] rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-semibold text-foreground">调整位置</h2>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-pda-warehouse-action="close-wait-handover-location">关闭</button>
        </div>
        <div class="mt-4 space-y-3">
          <label class="block text-xs text-muted-foreground">库区</label>
          <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="wait-handover-area">
            ${options.areaOptions.map((option) => `<option value="${escapeAttr(option.value)}" ${option.value === state.areaName ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
          </select>
          <label class="block text-xs text-muted-foreground">货架</label>
          <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="wait-handover-shelf">
            ${shelfOptions.map((option) => `<option value="${escapeAttr(option.value)}" ${option.value === state.shelfNo ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
          </select>
          <label class="block text-xs text-muted-foreground">库位</label>
          <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="wait-handover-location">
            ${locationOptions.map((option) => `<option value="${escapeAttr(option.value)}" ${option.value === state.locationNo ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
          </select>
          <label class="block text-xs text-muted-foreground">备注</label>
          <textarea class="min-h-20 w-full rounded-xl border bg-background px-3 py-2 text-sm" data-pda-warehouse-field="wait-handover-remark">${escapeHtml(state.remark)}</textarea>
        </div>
        <div class="mt-4 flex gap-2">
          <button type="button" class="flex-1 rounded-xl border px-3 py-2.5 text-sm" data-pda-warehouse-action="close-wait-handover-location">取消</button>
          <button type="button" class="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground" data-pda-warehouse-action="save-wait-handover-location">保存</button>
        </div>
      </section>
    </div>
  `
}

function getPostFinishingWaitHandoverRows(): PostFinishingWaitHandoverWarehouseRecord[] {
  return listPostFinishingWaitHandoverWarehouseRecords()
}

function getPostFinishingWaitHandoverStatus(row: PostFinishingWaitHandoverWarehouseRecord): string {
  if (row.diffGarmentQty !== 0) return '差异'
  if (row.submittedHandoverGarmentQty <= 0) return '待交出'
  if (row.submittedHandoverGarmentQty >= row.waitHandoverGarmentQty && row.receivedHandoverGarmentQty >= row.submittedHandoverGarmentQty) return '已回写'
  if (row.submittedHandoverGarmentQty >= row.waitHandoverGarmentQty) return '已交出'
  return '部分交出'
}

function renderPostFinishingWaitHandoverDetailDrawer(): string {
  const row = getPostFinishingWaitHandoverRows().find((item) => item.warehouseRecordId === state.detailId)
  if (!row) return ''
  return `
    <div class="fixed inset-0 z-[120]">
      <button type="button" class="absolute inset-0 bg-black/40" data-pda-warehouse-action="close-wait-handover-detail"></button>
      <section class="absolute inset-x-0 bottom-[72px] max-h-[78vh] overflow-y-auto rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-semibold text-foreground">后道待交出仓详情</h2>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-pda-warehouse-action="close-wait-handover-detail">关闭</button>
        </div>
        <div class="mt-4 rounded-2xl border bg-card px-4 py-4 shadow-sm">
          ${renderCompactFieldList([
            { label: '仓库记录', value: row.warehouseRecordNo },
            { label: '复检单', value: row.recheckOrderNo },
            { label: '生产单', value: row.sourceProductionOrderNo },
            { label: '后道任务', value: row.sourceTaskNo },
            { label: '款式', value: `${row.spuCode} / ${row.spuName}` },
            { label: 'SKU', value: row.skuSummary },
            { label: '待交出', value: `${row.waitHandoverGarmentQty} ${row.qtyUnit}` },
            { label: '已交出', value: `${row.submittedHandoverGarmentQty} ${row.qtyUnit}` },
            { label: '已回写', value: `${row.receivedHandoverGarmentQty} ${row.qtyUnit}` },
            { label: '差异', value: `${row.diffGarmentQty} ${row.qtyUnit}` },
            { label: '最新交出记录', value: row.handoverRecordNo || '-' },
            { label: '状态', value: getPostFinishingWaitHandoverStatus(row) },
          ])}
        </div>
        <div class="mt-3 space-y-2">
          ${row.flowRecords.map((flow) => `
            <div class="rounded-xl border bg-card px-3 py-3 text-xs">
              <div class="flex items-center justify-between gap-2">
                <span class="font-medium">${escapeHtml(flow.flowType)}</span>
                <span class="text-muted-foreground">${escapeHtml(formatWarehouseDateTime(flow.operatedAt))}</span>
              </div>
              <div class="mt-1 text-muted-foreground">${escapeHtml(flow.sourceActionRecordNo)} · ${flow.qty} ${escapeHtml(flow.qtyUnit)} · ${escapeHtml(flow.remark)}</div>
              <div class="mt-1 text-muted-foreground">变动前后：${flow.beforeQty} → ${flow.afterQty}</div>
            </div>
          `).join('')}
        </div>
      </section>
    </div>
  `
}

function renderPostFinishingWaitHandoverPage(): string {
  const rows = getPostFinishingWaitHandoverRows()
  const waitQty = rows.reduce((sum, item) => sum + Math.max(item.waitHandoverGarmentQty - item.submittedHandoverGarmentQty, 0), 0)
  const submittedQty = rows.reduce((sum, item) => sum + item.submittedHandoverGarmentQty, 0)
  const flowCount = rows.reduce((sum, item) => sum + item.flowRecords.length, 0)
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="grid grid-cols-2 gap-2">
        <button type="button" class="rounded-2xl border bg-background px-4 py-3 text-sm font-medium" data-nav="/fcs/pda/warehouse/wait-process">待加工仓</button>
        <button type="button" class="rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground" data-nav="/fcs/pda/warehouse/wait-handover">待交出仓</button>
      </section>
      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <div class="text-base font-semibold">后道待交出仓</div>
        <div class="mt-1 text-xs text-muted-foreground">复检完成入待交出仓，交出记录提交后扣减。</div>
        <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${rows.length}</div><div class="text-muted-foreground">SKU</div></div>
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${waitQty}</div><div class="text-muted-foreground">待交出</div></div>
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${submittedQty}</div><div class="text-muted-foreground">已交出</div></div>
        </div>
        <div class="mt-2 text-xs text-muted-foreground">累计流水 ${flowCount} 条。</div>
      </section>
      <section class="space-y-3">
        ${rows.length > 0 ? rows.map((item) => `
          <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold">${escapeHtml(item.skuCode)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.spuName)} · ${escapeHtml(item.colorName)} / ${escapeHtml(item.sizeName)}</div>
              </div>
              ${renderStatusPill(getPostFinishingWaitHandoverStatus(item))}
            </div>
            <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <div>生产单：${escapeHtml(item.sourceProductionOrderNo)}</div>
              <div>复检单：${escapeHtml(item.recheckOrderNo)}</div>
              <div>待交出 / 已交出：${item.waitHandoverGarmentQty} / ${item.submittedHandoverGarmentQty} ${escapeHtml(item.qtyUnit)}</div>
              <div>已回写 / 差异：${item.receivedHandoverGarmentQty} / ${item.diffGarmentQty} ${escapeHtml(item.qtyUnit)}</div>
              <div>最新交出记录：${escapeHtml(item.handoverRecordNo || '待提交')}</div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-wait-handover-detail" data-stock-item-id="${escapeAttr(item.warehouseRecordId)}">查看流水</button>
              <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(buildPostFinishingPdaHandoverRoute(item.recheckOrderNo))}">去交出</button>
              <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(resolveTaskRoute(item.sourceTaskNo))}">查看任务</button>
            </div>
          </article>
        `).join('') : renderMobilePageEmptyState('暂无后道待交出库存', '复检完成后，会进入后道待交出仓。')}
      </section>
      ${renderPostFinishingWaitHandoverDetailDrawer()}
    </div>
  `
  return renderPdaFrame(content, 'warehouse', { headerTitle: '后道待交出仓', disableTodoAutoOpen: true })
}

function getWoolWaitHandoverAction(value?: string | null): WoolWaitHandoverAction | null {
  return value === 'finish-inbound' || value === 'handover-confirm' ? value : null
}

function getWoolWaitHandoverLocations() {
  return listWoolWarehouseLocations('wait-handover')
}

function renderWoolWaitHandoverActionCards(activeAction?: WoolWaitHandoverAction | null): string {
  const actions: Array<{ key: WoolWaitHandoverAction; title: string; desc: string }> = [
    { key: 'finish-inbound', title: '完工入仓', desc: '整件按件、部位片按片确认入仓。' },
    { key: 'handover-confirm', title: '交出确认', desc: '确认接收方和数量，形成交出记录。' },
  ]
  return `
    <section class="grid grid-cols-2 gap-2">
      ${actions.map((item) => `
        <button
          type="button"
          class="rounded-2xl border px-4 py-4 text-left shadow-sm ${activeAction === item.key ? 'border-primary bg-primary/5' : 'bg-card'}"
          data-nav="/fcs/pda/warehouse/wait-handover?action=${escapeAttr(item.key)}"
        >
          <div class="text-sm font-semibold text-foreground">${escapeHtml(item.title)}</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">${escapeHtml(item.desc)}</div>
        </button>
      `).join('')}
    </section>
  `
}

function renderWoolHandoverLocationSelect(field: string, value: string): string {
  const locations = getWoolWaitHandoverLocations()
  return `
    <label class="block space-y-1.5">
      <span class="text-xs font-medium text-muted-foreground">库区库位</span>
      <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="${escapeAttr(field)}">
        ${locations.map((location) => `
          <option value="${escapeAttr(location.locationId)}" ${location.locationId === value ? 'selected' : ''}>
            ${escapeHtml(`${location.areaName} / ${location.locationCode}`)}
          </option>
        `).join('')}
      </select>
    </label>
  `
}

function advanceWoolOrderToPdaWarehouseInbound(orderId: string): void {
  for (let index = 0; index < 12; index += 1) {
    const order = getWoolWorkOrderById(orderId)
    if (!order) return
    if (['WAIT_FEI_TICKET', 'FEI_TICKET_PRINTED', 'WAIT_HANDOVER', 'HANDOVER_SUBMITTED', 'COMPLETED'].includes(order.status)) return
    if (order.status === 'WAIT_PICKUP' || order.status === 'PICKUP_IN_PROGRESS' || order.status === 'WAIT_ACCEPT') {
      completeWoolPickupHead(orderId, 'PDA 毛织仓管')
      continue
    }
    if (order.status === 'WAIT_MACHINE_SCHEDULE') {
      scheduleWoolMachines(orderId, 'PDA 毛织仓管')
      continue
    }
    if (order.status === 'MACHINE_SCHEDULED') {
      const usage = getWoolYarnUsageSummary(order)
      updateWoolWorkOrderNodeStatus(orderId, '横机成片', '进行中', 'PDA 毛织仓管', undefined, {
        yarnUsageWeightKg: usage.processingUsageWeightKg || order.yarnReceipt.receivedWeightKg || order.yarnReceipt.plannedWeightKg,
      })
      continue
    }
    if (order.status === 'FLAT_WOOL') {
      updateWoolWorkOrderNodeStatus(orderId, '横机成片', '已完成', 'PDA 毛织仓管')
      continue
    }
    if (order.status === 'WAIT_LINKING') {
      updateWoolWorkOrderNodeStatus(orderId, '缝盘', '进行中', 'PDA 毛织仓管')
      continue
    }
    if (order.status === 'LINKING') {
      const usage = getWoolYarnUsageSummary(order)
      updateWoolWorkOrderNodeStatus(orderId, '缝盘', '已完成', 'PDA 毛织仓管', undefined, {
        yarnLossWeightKg: usage.linkingLossWeightKg || Math.max((usage.processingUsageWeightKg || order.yarnReceipt.plannedWeightKg) * 0.015, 0.1),
      })
      continue
    }
    if (order.status === 'WAIT_IRONING') {
      updateWoolWorkOrderNodeStatus(orderId, '熨烫', '进行中', 'PDA 毛织仓管')
      continue
    }
    if (order.status === 'IRONING') {
      updateWoolWorkOrderNodeStatus(orderId, '熨烫', '已完成', 'PDA 毛织仓管')
      continue
    }
    if (order.status === 'WAIT_PACKING') {
      updateWoolWorkOrderNodeStatus(orderId, '包装', order.needsPackaging ? '进行中' : '已跳过', 'PDA 毛织仓管')
      continue
    }
    if (order.status === 'PACKING') {
      updateWoolWorkOrderNodeStatus(orderId, '包装', '已完成', 'PDA 毛织仓管')
      continue
    }
    return
  }
}

function ensureWoolWaitHandoverDraft(action: WoolWaitHandoverAction): void {
  const location = getWoolWaitHandoverLocations()[0]
  if (action === 'finish-inbound') {
    const order = listWoolWorkOrders().find((item) => !['HANDOVER_SUBMITTED', 'COMPLETED'].includes(item.status)) || listWoolWorkOrders()[0]
    state.woolFinishOrderId ||= order?.woolOrderId || ''
    state.woolFinishQty ||= String(order?.completedQty || order?.plannedQty || 0)
    state.woolFinishLocationId ||= location?.locationId || ''
    return
  }
  const inventory = listWoolWarehouseInventory('wait-handover')
  const item = inventory.find((record) => record.currentQty > 0) || inventory[0]
  state.woolHandoverOrderId ||= item?.woolOrderId || ''
  state.woolHandoverQty ||= String(item?.currentQty || 0)
  state.woolHandoverReceiver ||= '后道工厂 / 裁床待交出仓'
  state.woolHandoverLocationId ||= location?.locationId || ''
}

function renderWoolWaitHandoverActionPage(action: WoolWaitHandoverAction): string {
  ensureWoolWaitHandoverDraft(action)
  const isFinishInbound = action === 'finish-inbound'
  const orders = listWoolWorkOrders()
  const inventory = listWoolWarehouseInventory('wait-handover')
  const orderOptions = orders.slice(0, 24).map((order) => `
    <option value="${escapeAttr(order.woolOrderId)}" ${order.woolOrderId === state.woolFinishOrderId ? 'selected' : ''}>
      ${escapeHtml(`${order.woolOrderNo} / ${order.kind === 'PART_PANEL' ? '部位片' : '整件'} / ${order.plannedQty} ${order.qtyUnit}`)}
    </option>
  `).join('')
  const seen = new Set<string>()
  const handoverOptions = inventory.filter((item) => {
    if (seen.has(item.woolOrderId)) return false
    seen.add(item.woolOrderId)
    return true
  }).map((item) => `
    <option value="${escapeAttr(item.woolOrderId)}" ${item.woolOrderId === state.woolHandoverOrderId ? 'selected' : ''}>
      ${escapeHtml(`${item.woolOrderNo} / ${item.inventoryObjectType} / ${item.currentQty} ${item.unit}`)}
    </option>
  `).join('')
  return `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="flex items-start justify-between gap-3">
        <div>
          <div class="text-xl font-semibold leading-tight text-foreground">${escapeHtml(isFinishInbound ? '完工入仓' : '交出确认')}</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">毛织待交出仓支持整件毛织按件、部位毛织片按片管理。</div>
        </div>
        <button type="button" class="shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-medium" data-nav="/fcs/pda/warehouse">返回仓管</button>
      </section>
      ${renderWoolWaitHandoverActionCards(action)}
      <section class="space-y-3 rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">${isFinishInbound ? '毛织加工单' : '待交出库存'}</span>
          <select class="h-11 w-full rounded-xl border bg-background px-3 text-sm" data-pda-warehouse-field="${isFinishInbound ? 'wool-finish-order' : 'wool-handover-order'}">
            ${isFinishInbound ? orderOptions : handoverOptions}
          </select>
        </label>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">${isFinishInbound ? '完工数量' : '交出数量'}</span>
          <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" inputmode="decimal" value="${escapeAttr(isFinishInbound ? state.woolFinishQty : state.woolHandoverQty)}" data-pda-warehouse-field="${isFinishInbound ? 'wool-finish-qty' : 'wool-handover-qty'}" />
        </label>
        ${
          isFinishInbound
            ? renderWoolHandoverLocationSelect('wool-finish-location', state.woolFinishLocationId)
            : `
              <label class="block space-y-1.5">
                <span class="text-xs font-medium text-muted-foreground">接收方</span>
                <input class="h-11 w-full rounded-xl border bg-background px-3 text-sm" value="${escapeAttr(state.woolHandoverReceiver)}" data-pda-warehouse-field="wool-handover-receiver" />
              </label>
              ${renderWoolHandoverLocationSelect('wool-handover-location', state.woolHandoverLocationId)}
            `
        }
        <button type="button" class="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" data-pda-warehouse-action="${isFinishInbound ? 'confirm-wool-finish-inbound' : 'confirm-wool-handover'}">
          ${escapeHtml(isFinishInbound ? '确认完工入仓' : '确认交出')}
        </button>
      </section>
    </div>
  `
}

function renderWoolWaitHandoverPage(): string {
  const activeAction = getWoolWaitHandoverAction(getMobileWarehouseSearchParams().get('action'))
  if (activeAction) {
    const title = activeAction === 'finish-inbound' ? '毛织完工入仓' : '毛织交出确认'
    return renderPdaFrame(renderWoolWaitHandoverActionPage(activeAction), 'warehouse', { headerTitle: title, disableTodoAutoOpen: true })
  }
  const inventory = listWoolWarehouseInventory('wait-handover')
  const inbounds = listWoolWaitHandoverInboundRecords()
  const handouts = listWoolWaitHandoverHandoutRecords()
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="grid grid-cols-2 gap-2">
        <button type="button" class="rounded-2xl border bg-background px-4 py-3 text-sm font-medium" data-nav="/fcs/pda/warehouse/wait-process">待加工仓</button>
        <button type="button" class="rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground" data-nav="/fcs/pda/warehouse/wait-handover">待交出仓</button>
      </section>
      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <div class="text-base font-semibold">毛织待交出仓</div>
        <div class="mt-1 text-xs text-muted-foreground">加工入仓形成库存，交出给后道工厂或裁床待交出仓后扣减。</div>
        <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${inventory.length}</div><div class="text-muted-foreground">库存</div></div>
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${inbounds.length}</div><div class="text-muted-foreground">入仓</div></div>
          <div class="rounded-xl bg-muted px-2 py-2"><div class="font-semibold">${handouts.length}</div><div class="text-muted-foreground">交出</div></div>
        </div>
      </section>
      ${renderWoolWaitHandoverActionCards()}
      <section class="space-y-3">
        ${inventory.map((item) => `
          <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-sm font-semibold">${escapeHtml(item.woolOrderNo)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.itemName)} · ${escapeHtml(item.itemSpec)}</div>
              </div>
              ${renderStatusPill(item.statusText)}
            </div>
            <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <div>生产单：${escapeHtml(item.productionOrderNo)}</div>
              <div>当前库存：${item.currentQty} ${escapeHtml(item.unit)}</div>
              <div>库区库位：${escapeHtml(item.locationText)}</div>
              <div>流水：${item.flowRecords.map((flow) => `${flow.flowType}${flow.qty}${flow.unit}`).join(' / ') || '-'}</div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(resolveTaskRoute(item.taskNo))}">查看任务</button>
            </div>
          </article>
        `).join('')}
      </section>
    </div>
  `
  return renderPdaFrame(content, 'warehouse', { headerTitle: '毛织待交出仓', disableTodoAutoOpen: true })
}

export function renderPdaWarehouseWaitHandoverPage(): string {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return renderPdaFrame(renderMobilePageEmptyState('未登录', '请先登录工厂端移动应用。'), 'warehouse', { disableTodoAutoOpen: true })
  if (getMobileWarehouseSearchParams().get('scope') === 'cutting') return renderCuttingWaitHandoverPage()
  if (runtime.factoryId === FULL_CAPABILITY_FACTORY_ID) return renderPostFinishingWaitHandoverPage()
  if (runtime.factoryId === OWN_WOOL_FACTORY_ID) return renderWoolWaitHandoverPage()
  if (isCraftWarehouseRuntime()) return renderAuxiliaryWaitHandoverPage()

  const rows = getRows()
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${renderWarehouseSummaryHeader('待交出仓', '完工后进入待交出仓，交出记录提交后生成出库记录。', runtime.overview)}
      ${renderSectionFilterChips(state.status, FILTERS, 'wait-handover-status')}
      <section class="space-y-3">
        ${
          rows.length > 0
            ? rows
                .map(
                  (row) => `
                    <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0 flex-1">
                          <div class="text-sm font-semibold text-foreground">${escapeHtml(row.taskNo || row.productionOrderNo || row.stockItemId)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.receiverName || '待确认接收方')} · ${escapeHtml(row.handoverOrderNo || '待交出')}</div>
                        </div>
                        ${renderStatusPill(row.status)}
                      </div>
                      <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
                        <div>物料 / 裁片类型：${escapeHtml(`${row.itemKind} / ${row.itemName}`)}</div>
                        <div>面料 SKU / 裁片部位：${escapeHtml(row.materialSku || row.partName || '-')}</div>
                        <div>颜色 / 尺码：${escapeHtml(row.fabricColor || '-')} / ${escapeHtml(row.sizeCode || '-')}</div>
                        <div>菲票号 / 中转袋号：${escapeHtml(row.feiTicketNo || '-')} / ${escapeHtml(row.transferBagNo || '-')}</div>
                        ${
                          row.feiTicketNo
                            ? (() => {
                                const specialCraftSummary = getSpecialCraftFeiTicketSummary(row.feiTicketNo)
                                return `<div>特殊工艺 / 当前所在：${escapeHtml(specialCraftSummary.operationNames.join(' / ') || '无')} / ${escapeHtml(specialCraftSummary.currentLocation)}</div>
                                        <div>当前特殊工艺 / 已完成特殊工艺：${escapeHtml(specialCraftSummary.currentOperationName)} / ${escapeHtml(specialCraftSummary.completedOperationNames.join(' / ') || '无')}</div>
                                        <div>原裁片数量 / 当前裁片数量：${specialCraftSummary.originalQty} / ${specialCraftSummary.currentQty}</div>
                                        <div>报废裁片数量 / 货损裁片数量：${specialCraftSummary.cumulativeScrapQty} / ${specialCraftSummary.cumulativeDamageQty}</div>
                                        <div>差异状态：${escapeHtml([specialCraftSummary.receiveDifferenceStatus, specialCraftSummary.returnDifferenceStatus].filter((item) => item && item !== '—').join(' / ') || '无')}</div>
                                        <div>发料状态 / 回仓状态：${escapeHtml(specialCraftSummary.dispatchStatus)} / ${escapeHtml(specialCraftSummary.returnStatus)}</div>`
                              })()
                            : ''
                        }
                        <div>卷号：${escapeHtml(row.fabricRollNo || '-')}</div>
                        <div>加工完成对象数量 / 损耗对象数量：${row.completedQty} / ${row.lossQty} ${escapeHtml(row.unit)}</div>
                        <div>待交出数量 / 回写数量：${row.waitHandoverQty} / ${row.receiverWrittenQty ?? '-'} ${escapeHtml(row.unit)}</div>
                        <div>出库记录：${escapeHtml(resolveWarehouseOutboundRecordRoute(row.handoverRecordId).includes('recordId=') ? '已生成' : '未出库')}</div>
                        <div>交出二维码：${escapeHtml(getWarehouseQrDisplayText(getLinkedQrValue(row)))}</div>
                        <div>回写状态：${escapeHtml(getWaitHandoverWritebackStatusLabel(row))}</div>
                        <div>差异 / 异议：${escapeHtml(buildWarehouseDifferenceText(row.differenceQty))}${row.objectionStatus ? ` · ${escapeHtml(row.objectionStatus)}` : ''}</div>
                        <div>库区 / 货架 / 库位：${escapeHtml(row.areaName)} / ${escapeHtml(row.shelfNo)} / ${escapeHtml(row.locationNo)}</div>
                        <div>交出记录：${escapeHtml(row.handoverRecordNo || '待提交')}</div>
                      </div>
                      <div class="mt-4 flex flex-wrap gap-2">
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-wait-handover-detail" data-stock-item-id="${escapeAttr(row.stockItemId)}">查看</button>
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(resolveWaitHandoverRoute(row))}">去交出</button>
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(resolveWarehouseOutboundRecordRoute(row.handoverRecordId))}">查看出库</button>
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-nav="${escapeAttr(resolveWaitHandoverRoute(row))}">查看交出</button>
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-wait-handover-detail" data-stock-item-id="${escapeAttr(row.stockItemId)}">查看回写</button>
                        ${
                          row.status === '异议中'
                            ? `<button type="button" class="rounded-full border border-destructive/30 px-3 py-1.5 text-xs text-destructive" data-pda-warehouse-action="open-wait-handover-detail" data-stock-item-id="${escapeAttr(row.stockItemId)}">查看异议</button>`
                            : ''
                        }
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-wait-handover-location" data-stock-item-id="${escapeAttr(row.stockItemId)}">调整位置</button>
                      </div>
                    </article>
                  `,
                )
                .join('')
            : renderMobilePageEmptyState('暂无待交出仓记录', '任务完工后，会在待交出仓承接待交出内容。')
        }
      </section>
      ${renderDetailDrawer()}
      ${renderLocationDialog()}
    </div>
  `

  return renderPdaFrame(content, 'warehouse', { headerTitle: '待交出仓', disableTodoAutoOpen: true })
}

export function handlePdaWarehouseWaitHandoverEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pda-warehouse-action]')
  const action = actionNode?.dataset.pdaWarehouseAction
  if (action === 'confirm-wool-finish-inbound') {
    const qty = Number(state.woolFinishQty)
    if (!state.woolFinishOrderId) {
      window.alert('请选择毛织加工单。')
      return true
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      window.alert('请输入大于 0 的完工数量。')
      return true
    }
    if (!state.woolFinishLocationId) {
      window.alert('请选择库区库位。')
      return true
    }
    advanceWoolOrderToPdaWarehouseInbound(state.woolFinishOrderId)
    state.woolFinishOrderId = ''
    state.woolFinishQty = ''
    state.woolFinishLocationId = ''
    window.location.href = '/fcs/pda/warehouse/wait-handover'
    return true
  }
  if (action === 'confirm-wool-handover') {
    const qty = Number(state.woolHandoverQty)
    if (!state.woolHandoverOrderId) {
      window.alert('请选择待交出库存。')
      return true
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      window.alert('请输入大于 0 的交出数量。')
      return true
    }
    if (!state.woolHandoverReceiver.trim()) {
      window.alert('请输入接收方。')
      return true
    }
    if (!state.woolHandoverLocationId) {
      window.alert('请选择库区库位。')
      return true
    }
    advanceWoolOrderToPdaWarehouseInbound(state.woolHandoverOrderId)
    const ready = getWoolWorkOrderById(state.woolHandoverOrderId)
    if (ready?.status === 'WAIT_FEI_TICKET') {
      markWoolFeiTicketsPrinted(state.woolHandoverOrderId, 'PDA 毛织仓管')
    }
    submitWoolHandover(state.woolHandoverOrderId, 'PDA 毛织仓管')
    state.woolHandoverOrderId = ''
    state.woolHandoverQty = ''
    state.woolHandoverReceiver = ''
    state.woolHandoverLocationId = ''
    window.location.href = '/fcs/pda/warehouse/wait-handover'
    return true
  }
  if (action === 'confirm-auxiliary-finish' || action === 'confirm-auxiliary-handover') {
    const actionKey: AuxiliaryWaitHandoverAction = action === 'confirm-auxiliary-finish' ? 'finish-inbound' : 'handover-confirm'
    const scanValue = actionKey === 'finish-inbound' ? state.auxiliaryFinishScan : state.auxiliaryHandoverScan
    const qtyValue = Number(actionKey === 'finish-inbound' ? state.auxiliaryFinishQty : state.auxiliaryHandoverQty)
    const areaValue = actionKey === 'finish-inbound' ? state.auxiliaryFinishArea : state.auxiliaryHandoverArea
    const locationValue = actionKey === 'finish-inbound' ? state.auxiliaryFinishLocation : state.auxiliaryHandoverLocation
    if (!scanValue.trim()) {
      window.alert('请先扫码或输入单号。')
      return true
    }
    if (!Number.isFinite(qtyValue) || qtyValue <= 0) {
      window.alert('请输入大于 0 的数量。')
      return true
    }
    if (actionKey === 'handover-confirm' && !state.auxiliaryHandoverReceiver.trim()) {
      window.alert('请输入接收方。')
      return true
    }
    if (!areaValue || !locationValue) {
      window.alert('请选择库区库位。')
      return true
    }
    const actionLabel = actionKey === 'finish-inbound' ? '完工入仓' : '交出确认'
    window.alert(`${actionLabel}已记录为演示数据。`)
    window.location.href = '/fcs/pda/warehouse/wait-handover'
    return true
  }
  if (action === 'open-wait-handover-detail' && actionNode.dataset.stockItemId) {
    state.detailId = actionNode.dataset.stockItemId
    return true
  }
  if (action === 'close-wait-handover-detail') {
    state.detailId = null
    return true
  }
  if (action === 'open-wait-handover-location' && actionNode.dataset.stockItemId) {
    openLocationEditor(actionNode.dataset.stockItemId)
    return true
  }
  if (action === 'close-wait-handover-location') {
    state.locationEditId = null
    return true
  }
  if (action === 'save-wait-handover-location' && state.locationEditId) {
    updateWaitHandoverStockLocation(state.locationEditId, {
      areaName: state.areaName,
      shelfNo: state.shelfNo,
      locationNo: state.locationNo,
      remark: state.remark,
    })
    state.locationEditId = null
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-pda-warehouse-field]')
  const field = fieldNode?.dataset.pdaWarehouseField
  const value =
    fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement || fieldNode instanceof HTMLTextAreaElement
      ? fieldNode.value
      : fieldNode?.dataset.value || ''
  if (field === 'wait-handover-status') {
    state.status = value as WaitHandoverFilter
    return true
  }
  if (field === 'wait-handover-area') {
    state.areaName = value
    state.shelfNo = ''
    state.locationNo = ''
    return true
  }
  if (field === 'wait-handover-shelf') {
    state.shelfNo = value
    state.locationNo = ''
    return true
  }
  if (field === 'wait-handover-location') {
    state.locationNo = value
    return true
  }
  if (field === 'wait-handover-remark') {
    state.remark = value
    return true
  }
  if (field === 'wool-finish-order') {
    state.woolFinishOrderId = value
    const order = getWoolWorkOrderById(value)
    if (order) state.woolFinishQty = String(order.completedQty || order.plannedQty)
    return true
  }
  if (field === 'wool-finish-qty') {
    state.woolFinishQty = value
    return true
  }
  if (field === 'wool-finish-location') {
    state.woolFinishLocationId = value
    return true
  }
  if (field === 'wool-handover-order') {
    state.woolHandoverOrderId = value
    const item = listWoolWarehouseInventory('wait-handover').find((record) => record.woolOrderId === value)
    if (item) state.woolHandoverQty = String(item.currentQty || 0)
    return true
  }
  if (field === 'wool-handover-qty') {
    state.woolHandoverQty = value
    return true
  }
  if (field === 'wool-handover-receiver') {
    state.woolHandoverReceiver = value
    return true
  }
  if (field === 'wool-handover-location') {
    state.woolHandoverLocationId = value
    return true
  }
  if (field === 'auxiliary-finish-scan') {
    state.auxiliaryFinishScan = value
    return true
  }
  if (field === 'auxiliary-finish-qty') {
    state.auxiliaryFinishQty = value
    return true
  }
  if (field === 'auxiliary-finish-loss-qty') {
    state.auxiliaryFinishLossQty = value
    return true
  }
  if (field === 'auxiliary-finish-area') {
    updateAuxiliaryWaitHandoverArea('finish-inbound', value)
    return true
  }
  if (field === 'auxiliary-finish-shelf') {
    updateAuxiliaryWaitHandoverShelf('finish-inbound', value)
    return true
  }
  if (field === 'auxiliary-finish-location') {
    updateAuxiliaryWaitHandoverLocation('finish-inbound', value)
    return true
  }
  if (field === 'auxiliary-handover-scan') {
    state.auxiliaryHandoverScan = value
    return true
  }
  if (field === 'auxiliary-handover-qty') {
    state.auxiliaryHandoverQty = value
    return true
  }
  if (field === 'auxiliary-handover-receiver') {
    state.auxiliaryHandoverReceiver = value
    return true
  }
  if (field === 'auxiliary-handover-area') {
    updateAuxiliaryWaitHandoverArea('handover-confirm', value)
    return true
  }
  if (field === 'auxiliary-handover-shelf') {
    updateAuxiliaryWaitHandoverShelf('handover-confirm', value)
    return true
  }
  if (field === 'auxiliary-handover-location') {
    updateAuxiliaryWaitHandoverLocation('handover-confirm', value)
    return true
  }
  return false
}

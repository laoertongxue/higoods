import {
  buildSpecialCraftWorkOrderDetailPath,
  getSpecialCraftManagementDomainBySlug,
  listOperationDefinitionsByManagementDomain,
  type SpecialCraftOperationDefinition,
} from '../../../data/fcs/special-craft-operations.ts'
import {
  buildHandoverQrLabelPrintLink,
  buildTaskDeliveryCardPrintLink,
} from '../../../data/fcs/fcs-route-links.ts'
import {
  listFactoryWaitHandoverStockItems,
  listFactoryWaitProcessStockItems,
  listFactoryWarehouseInboundRecords,
  listFactoryWarehouseNodeRows,
  listFactoryWarehouseOutboundRecords,
  type FactoryWaitHandoverStockItem,
  type FactoryWaitProcessStockItem,
  type FactoryWarehouseInboundRecord,
  type FactoryWarehouseNodeRow,
  type FactoryWarehouseOutboundRecord,
} from '../../../data/fcs/factory-internal-warehouse.ts'
import type { ProcessCraftManagementDomain } from '../../../data/fcs/process-craft-dict.ts'
import type { ProcessHandoverRecord, ProcessWarehouseRecord } from '../../../data/fcs/process-warehouse-domain.ts'
import {
  listProcessHandoverRecords,
  listWaitHandoverWarehouseRecords,
  listWaitProcessWarehouseRecords,
} from '../../../data/fcs/process-warehouse-domain.ts'
import {
  listAuxiliaryCraftTaskOrders,
  listSpecialTypeCraftTaskOrders,
} from '../../../data/fcs/special-craft-task-orders.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  paginateItems,
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchPagination,
  renderWorkbenchStateBar,
} from '../cutting/layout.helpers.ts'
import {
  getWarehouseSearchParams,
} from '../cutting/warehouse-shared.ts'
import {
  formatQty,
  renderEmptyState,
  renderSpecialCraftPageLayout,
  renderStatusBadge,
} from './shared.ts'
import {
  renderFactoryWarehouseStandardTabs,
  renderWarehouseFlowButton,
  renderWarehouseLocationToolbar,
  type FactoryWarehouseFlowLine,
  type FactoryWarehouseStandardTab,
} from '../shared/warehouse-standard.ts'

type SpecialCraftWarehousePageMode = 'wait-process' | 'wait-handover'
type SpecialCraftWarehouseDomain = 'AUXILIARY_CRAFT_FACTORY' | 'SPECIAL_CRAFT_FACTORY'
type WarehouseFilterField = 'keyword' | 'operationName' | 'factoryId' | 'physicalAreaName'
type AuxiliaryWaitProcessTabKey = 'inventory' | 'receive' | 'issue' | 'return' | 'locations'
type AuxiliaryWaitHandoverTabKey = 'inventory' | 'finish-inbound' | 'handover-confirm' | 'handover' | 'locations'
type AuxiliaryWarehouseAction = 'receive' | 'process-issue' | 'return' | 'finish-inbound' | 'handover-confirm'
type UnifiedWarehouseRecord =
  | FactoryWaitProcessStockItem
  | FactoryWaitHandoverStockItem
  | FactoryWarehouseInboundRecord
  | FactoryWarehouseOutboundRecord
type WarehouseFilterRecord = ProcessWarehouseRecord | ProcessHandoverRecord | UnifiedWarehouseRecord

interface SpecialCraftWarehousePageState {
  keyword: string
  operationName: string
  factoryId: string
  physicalAreaName: string
  page: number
  pageSize: number
}

interface PhysicalAreaMeta {
  areaName: '印花厂库区' | '毛织厂库区' | '裁片仓库区' | '车缝厂库区'
  warehousePrefix: string
  shelfPrefix: string
}

const initialWarehouseState: SpecialCraftWarehousePageState = {
  keyword: '',
  operationName: '全部',
  factoryId: '全部',
  physicalAreaName: '全部',
  page: 1,
  pageSize: 20,
}

const warehouseStateByPage = new Map<string, SpecialCraftWarehousePageState>()

const PHYSICAL_AREA_OPTIONS: PhysicalAreaMeta[] = [
  { areaName: '印花厂库区', warehousePrefix: 'PF', shelfPrefix: 'PFA' },
  { areaName: '毛织厂库区', warehousePrefix: 'WF', shelfPrefix: 'WFA' },
  { areaName: '裁片仓库区', warehousePrefix: 'CP', shelfPrefix: 'CPA' },
  { areaName: '车缝厂库区', warehousePrefix: 'SW', shelfPrefix: 'SWA' },
]

const specialCraftWarehouseDomainMeta: Record<
  SpecialCraftWarehouseDomain,
  { titlePrefix: string; domainLabel: string }
> = {
  AUXILIARY_CRAFT_FACTORY: {
    titlePrefix: '辅助工艺',
    domainLabel: '辅助工艺工厂管理',
  },
  SPECIAL_CRAFT_FACTORY: {
    titlePrefix: '特种工艺',
    domainLabel: '特种工艺工厂管理',
  },
}

function isSpecialCraftWarehouseDomain(
  domain: ProcessCraftManagementDomain | undefined,
): domain is SpecialCraftWarehouseDomain {
  return domain === 'AUXILIARY_CRAFT_FACTORY' || domain === 'SPECIAL_CRAFT_FACTORY'
}

function getDomainOperations(domain: SpecialCraftWarehouseDomain): SpecialCraftOperationDefinition[] {
  return listOperationDefinitionsByManagementDomain(domain).filter((operation) => operation.isEnabled)
}

function buildDomainCraftNameSet(operations: SpecialCraftOperationDefinition[]): Set<string> {
  return new Set(operations.map((operation) => operation.operationName))
}

function getWarehouseStateKey(domainSlug: string, mode: SpecialCraftWarehousePageMode): string {
  return `${domainSlug}:${mode}`
}

function getWarehouseState(domainSlug: string, mode: SpecialCraftWarehousePageMode): SpecialCraftWarehousePageState {
  const key = getWarehouseStateKey(domainSlug, mode)
  const current = warehouseStateByPage.get(key)
  if (current) return current
  const next = { ...initialWarehouseState }
  warehouseStateByPage.set(key, next)
  return next
}

function setWarehouseState(domainSlug: string, mode: SpecialCraftWarehousePageMode, patch: Partial<SpecialCraftWarehousePageState>): void {
  const key = getWarehouseStateKey(domainSlug, mode)
  warehouseStateByPage.set(key, { ...getWarehouseState(domainSlug, mode), ...patch })
}

function formatNumber(value: number | undefined | null): string {
  return (value || 0).toLocaleString('zh-CN')
}

function findOperationByCraftName(
  operations: SpecialCraftOperationDefinition[],
  craftName: string,
): SpecialCraftOperationDefinition | undefined {
  return operations.find((operation) => operation.operationName === craftName)
}

function filterSpecialCraftRecordsByDomain<T extends { craftType: string; craftName: string }>(
  records: T[],
  craftNames: Set<string>,
): T[] {
  return records.filter((record) => record.craftType === 'SPECIAL_CRAFT' && craftNames.has(record.craftName))
}

function filterUnifiedRecordsByDomain<T extends { craftName?: string }>(
  records: T[],
  craftNames: Set<string>,
): T[] {
  return records.filter((record) => Boolean(record.craftName && craftNames.has(record.craftName)))
}

function resolvePhysicalAreaMeta(craftName: string): PhysicalAreaMeta {
  if (craftName.includes('直喷') || craftName.includes('烫画')) return PHYSICAL_AREA_OPTIONS[0]
  if (craftName.includes('绣') || craftName.includes('贝壳') || craftName.includes('曲牙')) return PHYSICAL_AREA_OPTIONS[1]
  if (craftName.includes('打条') || craftName.includes('压褶')) return PHYSICAL_AREA_OPTIONS[2]
  return PHYSICAL_AREA_OPTIONS[3]
}

function buildLocationText(craftName: string, locationSeed: string): string {
  const area = resolvePhysicalAreaMeta(craftName)
  const index = Math.abs(Array.from(locationSeed).reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 9 + 1
  return `${area.areaName} / ${area.shelfPrefix}-A-${String(index).padStart(2, '0')}`
}

function recordMatchesKeyword(record: ProcessWarehouseRecord | ProcessHandoverRecord, keyword: string): boolean {
  const normalized = keyword.trim().toLowerCase()
  if (!normalized) return true
  const area = resolvePhysicalAreaMeta(record.craftName).areaName
  const tokens = [
    record.craftName,
    record.sourceWorkOrderNo,
    record.sourceTaskNo,
    record.sourceProductionOrderNo,
    'targetFactoryName' in record ? record.targetFactoryName : record.handoverFactoryName,
    'warehouseRecordNo' in record ? record.warehouseRecordNo : record.handoverRecordNo,
    'warehouseLocation' in record ? record.warehouseLocation : '',
    area,
  ]
  return tokens.some((token) => token?.toLowerCase().includes(normalized))
}

function getFilterRecordFactory(record: WarehouseFilterRecord): { factoryId: string; factoryName: string } {
  if ('targetFactoryId' in record) return { factoryId: record.targetFactoryId, factoryName: record.targetFactoryName }
  if ('handoverFactoryId' in record) return { factoryId: record.handoverFactoryId, factoryName: record.handoverFactoryName }
  return { factoryId: record.factoryId || '', factoryName: record.factoryName || '' }
}

function getFilterRecordCraftName(record: WarehouseFilterRecord): string {
  return 'craftName' in record ? record.craftName || '' : ''
}

function unifiedRecordMatchesKeyword(record: UnifiedWarehouseRecord, keyword: string): boolean {
  const normalized = keyword.trim().toLowerCase()
  if (!normalized) return true
  const craftName = getFilterRecordCraftName(record)
  const tokens = [
    craftName,
    record.factoryName,
    'sourceRecordNo' in record ? record.sourceRecordNo : '',
    'taskNo' in record ? record.taskNo : '',
    'productionOrderNo' in record ? record.productionOrderNo : '',
    'sourceTaskNo' in record ? record.sourceTaskNo : '',
    'handoverOrderNo' in record ? record.handoverOrderNo : '',
    'handoverRecordNo' in record ? record.handoverRecordNo : '',
    'inboundRecordNo' in record ? record.inboundRecordNo : '',
    'outboundRecordNo' in record ? record.outboundRecordNo : '',
    record.itemName,
    record.materialSku,
    record.partName,
    record.feiTicketNo,
    record.transferBagNo,
    record.areaName,
    record.shelfNo,
    record.locationNo,
    craftName ? resolvePhysicalAreaMeta(craftName).areaName : '',
  ]
  return tokens.some((token) => token?.toLowerCase().includes(normalized))
}

function unifiedRecordMatchesWarehouseState(record: UnifiedWarehouseRecord, state: SpecialCraftWarehousePageState): boolean {
  const craftName = getFilterRecordCraftName(record)
  if (state.operationName !== '全部' && craftName !== state.operationName) return false
  if (state.factoryId !== '全部' && getFilterRecordFactory(record).factoryId !== state.factoryId) return false
  if (state.physicalAreaName !== '全部') {
    const physicalAreaName = craftName ? resolvePhysicalAreaMeta(craftName).areaName : record.areaName
    if (physicalAreaName !== state.physicalAreaName) return false
  }
  return unifiedRecordMatchesKeyword(record, state.keyword)
}

function recordMatchesWarehouseState(
  record: ProcessWarehouseRecord | ProcessHandoverRecord,
  state: SpecialCraftWarehousePageState,
): boolean {
  if (state.operationName !== '全部' && record.craftName !== state.operationName) return false
  if (state.factoryId !== '全部') {
    const factoryId = 'targetFactoryId' in record ? record.targetFactoryId : record.handoverFactoryId
    if (factoryId !== state.factoryId) return false
  }
  if (state.physicalAreaName !== '全部' && resolvePhysicalAreaMeta(record.craftName).areaName !== state.physicalAreaName) return false
  return recordMatchesKeyword(record, state.keyword)
}

function buildOperationOptions(operations: SpecialCraftOperationDefinition[]): Array<{ value: string; label: string }> {
  return [{ value: '全部', label: '全部' }, ...operations.map((operation) => ({ value: operation.operationName, label: operation.operationName }))]
}

function buildFactoryOptions(records: WarehouseFilterRecord[]): Array<{ value: string; label: string }> {
  const seen = new Set<string>()
  const options = records
    .map((record) => {
      const factory = getFilterRecordFactory(record)
      return { value: factory.factoryId, label: factory.factoryName }
    })
    .filter((option) => {
      if (!option.value || seen.has(option.value)) return false
      seen.add(option.value)
      return true
    })
  return [{ value: '全部', label: '全部' }, ...options]
}

function renderWarehouseFilterSelect(
  label: string,
  field: WarehouseFilterField,
  value: string,
  options: Array<{ value: string; label: string }>,
  domainSlug: string,
  mode: SpecialCraftWarehousePageMode,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        data-special-craft-warehouse-field="${field}"
        data-domain-slug="${escapeHtml(domainSlug)}"
        data-warehouse-mode="${mode}"
      >
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function renderWarehouseFilters(
  domainSlug: string,
  mode: SpecialCraftWarehousePageMode,
  state: SpecialCraftWarehousePageState,
  operations: SpecialCraftOperationDefinition[],
  activeRecords: WarehouseFilterRecord[],
): string {
  return renderStickyFilterShell(`
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <label class="space-y-2 md:col-span-2">
        <span class="text-sm font-medium text-foreground">关键词</span>
        <input
          type="text"
          value="${escapeHtml(state.keyword)}"
          placeholder="加工单 / 生产单 / 工艺 / 库区 / 库位"
          class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          data-special-craft-warehouse-field="keyword"
          data-domain-slug="${escapeHtml(domainSlug)}"
          data-warehouse-mode="${mode}"
        />
      </label>
      ${renderWarehouseFilterSelect('工艺', 'operationName', state.operationName, buildOperationOptions(operations), domainSlug, mode)}
      ${renderWarehouseFilterSelect('工厂', 'factoryId', state.factoryId, buildFactoryOptions(activeRecords), domainSlug, mode)}
      ${renderWarehouseFilterSelect(
        '物理库区',
        'physicalAreaName',
        state.physicalAreaName,
        [{ value: '全部', label: '全部' }, ...PHYSICAL_AREA_OPTIONS.map((item) => ({ value: item.areaName, label: item.areaName }))],
        domainSlug,
        mode,
      )}
    </div>
  `)
}

function renderWarehouseStateBar(domainSlug: string, mode: SpecialCraftWarehousePageMode, state: SpecialCraftWarehousePageState): string {
  const chips = [
    state.keyword ? `关键词：${state.keyword}` : '',
    state.operationName !== '全部' ? `工艺：${state.operationName}` : '',
    state.factoryId !== '全部' ? `工厂：${state.factoryId}` : '',
    state.physicalAreaName !== '全部' ? `物理库区：${state.physicalAreaName}` : '',
  ].filter(Boolean)
  return renderWorkbenchStateBar({
    summary: '当前筛选条件',
    chips: chips.map((label) => renderWorkbenchFilterChip(label, `data-special-craft-warehouse-action="clear-filters" data-domain-slug="${domainSlug}" data-warehouse-mode="${mode}"`, 'blue')),
    clearAttrs: `data-special-craft-warehouse-action="clear-filters" data-domain-slug="${domainSlug}" data-warehouse-mode="${mode}"`,
  })
}

function renderDomainWorkOrderAction(
  operations: SpecialCraftOperationDefinition[],
  record: { craftName: string; sourceWorkOrderId: string },
): string {
  const operation = findOperationByCraftName(operations, record.craftName)
  if (!operation) return `<span class="text-sm text-slate-400">未匹配工艺</span>`
  return `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildSpecialCraftWorkOrderDetailPath(operation, record.sourceWorkOrderId))}">查看加工单</button>`
}

function buildSpecialWarehouseFlowLines(record: ProcessWarehouseRecord): FactoryWarehouseFlowLine[] {
  if (record.recordType === 'WAIT_PROCESS') {
    return [
      {
        flowType: '入仓',
        qtyText: `${formatQty(record.receivedObjectQty)} ${record.qtyUnit}`,
        sourceNo: record.warehouseRecordNo,
        operatedAt: record.inboundAt || record.createdAt,
        operatorName: record.targetFactoryName,
        statusText: record.status,
      },
      {
        flowType: '加工占用',
        qtyText: `${formatQty(Math.max(record.receivedObjectQty - record.availableObjectQty, 0))} ${record.qtyUnit}`,
        sourceNo: record.sourceWorkOrderNo,
        operatedAt: record.updatedAt,
        operatorName: record.targetFactoryName,
        statusText: record.currentActionName,
      },
    ]
  }

  const lines: FactoryWarehouseFlowLine[] = [
    {
      flowType: '加工入仓',
      qtyText: `${formatQty(record.availableObjectQty + record.handedOverObjectQty)} ${record.qtyUnit}`,
      sourceNo: record.warehouseRecordNo,
      operatedAt: record.inboundAt || record.createdAt,
      operatorName: record.targetFactoryName,
      statusText: record.status,
    },
  ]
  if (record.handedOverObjectQty > 0) {
    lines.push({
      flowType: '交出出仓',
      qtyText: `${formatQty(record.handedOverObjectQty)} ${record.qtyUnit}`,
      sourceNo: record.relatedHandoverRecordIds.join('、') || record.warehouseRecordNo,
      operatedAt: record.outboundAt || record.updatedAt,
      operatorName: record.targetFactoryName,
      statusText: record.status,
    })
  }
  return lines
}

function renderWaitProcessRows(records: ProcessWarehouseRecord[], operations: SpecialCraftOperationDefinition[]): string {
  if (!records.length) return `<tr><td colspan="8" class="py-10 text-center text-muted-foreground">当前筛选条件下暂无待加工库存。</td></tr>`
  return records
    .map((record) => {
      const locationText = buildLocationText(record.craftName, record.warehouseRecordNo)
      return `
        <tr class="align-top hover:bg-muted/20">
          <td class="px-3 py-3">
            <div class="font-medium text-slate-900">${escapeHtml(record.warehouseRecordNo)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.craftName)}</div>
          </td>
          <td class="px-3 py-3">
            <div>${escapeHtml(record.sourceWorkOrderNo)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.sourceProductionOrderNo)}</div>
          </td>
          <td class="px-3 py-3">${escapeHtml(record.targetFactoryName)}</td>
          <td class="px-3 py-3">${escapeHtml(record.skuSummary || record.materialName || '—')}</td>
          <td class="px-3 py-3 font-semibold tabular-nums">${formatNumber(record.availableObjectQty || record.receivedObjectQty)} ${escapeHtml(record.qtyUnit)}</td>
          <td class="px-3 py-3">
            <div>${escapeHtml(resolvePhysicalAreaMeta(record.craftName).areaName)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(locationText)}</div>
          </td>
          <td class="px-3 py-3">${renderStatusBadge(record.currentActionName || record.status || '待处理')}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              ${renderDomainWorkOrderAction(operations, record)}
              ${renderWarehouseFlowButton(`${record.warehouseRecordNo} 库存流水`, buildSpecialWarehouseFlowLines(record))}
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderWaitHandoverRows(records: ProcessWarehouseRecord[], operations: SpecialCraftOperationDefinition[]): string {
  if (!records.length) return `<tr><td colspan="8" class="py-10 text-center text-muted-foreground">当前筛选条件下暂无待交出库存。</td></tr>`
  return records
    .map((record) => {
      const locationText = buildLocationText(record.craftName, record.warehouseRecordNo)
      return `
        <tr class="align-top hover:bg-muted/20">
          <td class="px-3 py-3">
            <div class="font-medium text-slate-900">${escapeHtml(record.warehouseRecordNo)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.craftName)}</div>
          </td>
          <td class="px-3 py-3">
            <div>${escapeHtml(record.sourceWorkOrderNo)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.sourceProductionOrderNo)}</div>
          </td>
          <td class="px-3 py-3">${escapeHtml(record.targetFactoryName)}</td>
          <td class="px-3 py-3">${escapeHtml(record.skuSummary || record.materialName || '—')}</td>
          <td class="px-3 py-3 font-semibold tabular-nums">${formatNumber(record.availableObjectQty)} ${escapeHtml(record.qtyUnit)}</td>
          <td class="px-3 py-3">
            <div>${escapeHtml(resolvePhysicalAreaMeta(record.craftName).areaName)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(locationText)}</div>
          </td>
          <td class="px-3 py-3">${renderStatusBadge(record.status || '待交出')}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              ${renderDomainWorkOrderAction(operations, record)}
              ${renderWarehouseFlowButton(`${record.warehouseRecordNo} 库存流水`, buildSpecialWarehouseFlowLines(record))}
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderHandoverRows(records: ProcessHandoverRecord[]): string {
  if (!records.length) return `<tr><td colspan="8" class="py-10 text-center text-muted-foreground">当前筛选条件下暂无交出记录。</td></tr>`
  return records
    .map((record) => `
      <tr class="align-top hover:bg-muted/20">
        <td class="px-3 py-3">
          <div class="font-medium text-slate-900">${escapeHtml(record.handoverRecordNo)}</div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.craftName)}</div>
        </td>
        <td class="px-3 py-3">
          <div>${escapeHtml(record.sourceWorkOrderNo)}</div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.sourceProductionOrderNo)}</div>
        </td>
        <td class="px-3 py-3">${escapeHtml(record.handoverFactoryName)}</td>
        <td class="px-3 py-3">${escapeHtml(record.receiveFactoryName || record.receiveWarehouseName || '—')}</td>
        <td class="px-3 py-3 font-semibold tabular-nums">${formatNumber(record.handoverObjectQty)} ${escapeHtml(record.qtyUnit)}</td>
        <td class="px-3 py-3">${escapeHtml(resolvePhysicalAreaMeta(record.craftName).areaName)}</td>
        <td class="px-3 py-3">${escapeHtml(record.handoverAt)}</td>
        <td class="px-3 py-3">${renderStatusBadge(record.status)}</td>
      </tr>
    `)
    .join('')
}

function buildUnifiedWaitProcessFlowLines(item: FactoryWaitProcessStockItem): FactoryWarehouseFlowLine[] {
  const lines: FactoryWarehouseFlowLine[] = [
    {
      flowType: item.sourceRecordType === 'HANDOVER_RECEIVE' ? '接收入仓' : '接收入仓',
      qtyText: `${formatQty(item.receivedQty)} ${item.unit}`,
      sourceNo: item.sourceRecordNo,
      operatedAt: item.receivedAt,
      operatorName: item.receiverName,
      statusText: item.status,
    },
  ]
  if (item.receivedQty > 0) {
    lines.push({
      flowType: '加工领料',
      qtyText: `-${formatQty(Math.max(item.receivedQty - Math.abs(item.differenceQty || 0), 0))} ${item.unit}`,
      sourceNo: item.taskNo || item.sourceRecordNo,
      operatedAt: item.receivedAt,
      operatorName: item.factoryName,
      statusText: item.status === '差异待处理' ? '待复核' : '已领用',
    })
  }
  if (item.remark?.includes('回收') || item.status === '差异待处理') {
    lines.push({
      flowType: '回收入仓',
      qtyText: `${formatQty(Math.abs(item.differenceQty || 0) || Math.max(Math.round(item.receivedQty * 0.06), 1))} ${item.unit}`,
      sourceNo: item.taskNo || item.sourceRecordNo,
      operatedAt: item.receivedAt,
      operatorName: item.receiverName,
      statusText: item.status === '差异待处理' ? '待复核' : '已回收',
    })
  }
  return lines
}

function buildUnifiedWaitHandoverFlowLines(item: FactoryWaitHandoverStockItem): FactoryWarehouseFlowLine[] {
  const lines: FactoryWarehouseFlowLine[] = [
    {
      flowType: '完工入仓',
      qtyText: `${formatQty(item.completedQty)} ${item.unit}`,
      sourceNo: item.taskNo || item.stockItemId,
      operatedAt: item.handoverRecordNo ? '交出前' : '待交出前',
      operatorName: item.factoryName,
      statusText: item.status,
    },
  ]
  if (item.handoverRecordNo) {
    lines.push({
      flowType: '交出确认',
      qtyText: `${formatQty(item.completedQty)} ${item.unit}`,
      sourceNo: item.handoverRecordNo,
      operatedAt: item.handoverRecordNo,
      operatorName: item.factoryName,
      statusText: item.status,
    })
  }
  return lines
}

function getSpecialCraftWarehousePath(domainSlug: string, mode: SpecialCraftWarehousePageMode): string {
  return `/fcs/process-factory/special-craft/${encodeURIComponent(domainSlug)}/${mode === 'wait-process' ? 'wait-process-warehouse' : 'wait-handover-warehouse'}`
}

function buildAuxiliaryWarehouseHref(
  domainSlug: string,
  mode: SpecialCraftWarehousePageMode,
  patch: { tab?: string; action?: AuxiliaryWarehouseAction | null } = {},
): string {
  const params = getWarehouseSearchParams()
  if (patch.tab !== undefined) {
    if (patch.tab === 'inventory') params.delete('tab')
    else params.set('tab', patch.tab)
    params.delete('warehouseAction')
  }
  if (patch.action !== undefined) {
    if (patch.action) params.set('warehouseAction', patch.action)
    else params.delete('warehouseAction')
  }
  const query = params.toString()
  return `${getSpecialCraftWarehousePath(domainSlug, mode)}${query ? `?${query}` : ''}`
}

function readAuxiliaryWaitProcessTab(): AuxiliaryWaitProcessTabKey {
  const supported: AuxiliaryWaitProcessTabKey[] = ['inventory', 'receive', 'issue', 'return', 'locations']
  const raw = getWarehouseSearchParams().get('tab') as AuxiliaryWaitProcessTabKey | null
  return raw && supported.includes(raw) ? raw : 'inventory'
}

function readAuxiliaryWaitHandoverTab(): AuxiliaryWaitHandoverTabKey {
  const supported: AuxiliaryWaitHandoverTabKey[] = ['inventory', 'finish-inbound', 'handover-confirm', 'handover', 'locations']
  const raw = getWarehouseSearchParams().get('tab') as AuxiliaryWaitHandoverTabKey | null
  return raw && supported.includes(raw) ? raw : 'inventory'
}

function renderAuxiliaryWarehouseTabs(
  domainSlug: string,
  mode: SpecialCraftWarehousePageMode,
  activeTab: string,
  tabs: Array<{ key: string; label: string }>,
): string {
  return `
    <nav class="inline-flex max-w-full flex-nowrap gap-1 overflow-x-auto whitespace-nowrap rounded-md bg-muted p-1">
      ${tabs
        .map((tab) => `
          <button
            type="button"
            class="shrink-0 rounded px-3 py-1.5 text-sm ${tab.key === activeTab ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}"
            data-nav="${escapeHtml(buildAuxiliaryWarehouseHref(domainSlug, mode, { tab: tab.key }))}"
          >
            ${escapeHtml(tab.label)}
          </button>
        `)
        .join('')}
    </nav>
  `
}

function renderAuxiliaryWaitProcessHeaderActions(domainSlug: string): string {
  const actions: Array<{ action: AuxiliaryWarehouseAction; label: string; primary?: boolean }> = [
    { action: 'receive', label: '接收入仓', primary: true },
    { action: 'process-issue', label: '加工领料' },
    { action: 'return', label: '回收入仓' },
  ]
  return `
    <div class="flex flex-nowrap items-center gap-2 overflow-x-auto">
      ${actions
        .map((item) => `
          <button
            type="button"
            class="h-10 shrink-0 rounded-md ${item.primary ? 'bg-blue-600 px-4 font-medium text-white hover:bg-blue-700' : 'border bg-background px-4 text-slate-700 hover:bg-muted'} text-sm"
            data-nav="${escapeHtml(buildAuxiliaryWarehouseHref(domainSlug, 'wait-process', { action: item.action }))}"
          >
            ${escapeHtml(item.label)}
          </button>
        `)
        .join('')}
      <button type="button" class="h-10 shrink-0 rounded-md border border-blue-200 bg-blue-50 px-3 text-sm text-blue-700 hover:bg-blue-100" data-nav="/fcs/pda/warehouse">PDA 现场扫码</button>
    </div>
  `
}

function renderAuxiliaryWaitHandoverHeaderActions(domainSlug: string): string {
  return `
    <div class="flex flex-nowrap items-center gap-2 overflow-x-auto">
      <button type="button" class="h-10 shrink-0 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-nav="${escapeHtml(buildAuxiliaryWarehouseHref(domainSlug, 'wait-handover', { action: 'finish-inbound' }))}">完工入仓</button>
      <button type="button" class="h-10 shrink-0 rounded-md border bg-background px-4 text-sm text-slate-700 hover:bg-muted" data-nav="${escapeHtml(buildAuxiliaryWarehouseHref(domainSlug, 'wait-handover', { action: 'handover-confirm' }))}">交出确认</button>
      <button type="button" class="h-10 shrink-0 rounded-md border border-blue-200 bg-blue-50 px-3 text-sm text-blue-700 hover:bg-blue-100" data-nav="/fcs/pda/warehouse">PDA 现场扫码</button>
    </div>
  `
}

function renderAuxiliaryActionTextField(label: string, placeholder: string, value = ''): string {
  return `
    <label class="block">
      <span class="text-xs font-medium text-slate-700">${escapeHtml(label)}</span>
      <input
        value="${escapeHtml(value)}"
        class="mt-1 h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-blue-500"
        placeholder="${escapeHtml(placeholder)}"
      />
    </label>
  `
}

function renderAuxiliaryActionSelect(label: string, options: Array<{ value: string; label: string }>): string {
  const safeOptions = options.length ? options : [{ value: '', label: '暂无可选记录' }]
  return `
    <label class="block">
      <span class="text-xs font-medium text-slate-700">${escapeHtml(label)}</span>
      <select class="mt-1 h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-blue-500">
        ${safeOptions.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('')}
      </select>
    </label>
  `
}

function renderAuxiliaryWarehouseActionDialog(input: {
  domainSlug: string
  mode: SpecialCraftWarehousePageMode
  domainTitlePrefix: string
  waitProcessItems: FactoryWaitProcessStockItem[]
  inboundRecords: FactoryWarehouseInboundRecord[]
  waitHandoverItems: FactoryWaitHandoverStockItem[]
}): string {
  const action = getWarehouseSearchParams().get('warehouseAction') as AuxiliaryWarehouseAction | null
  if (!action) return ''
  const waitProcessActions: AuxiliaryWarehouseAction[] = ['receive', 'process-issue', 'return']
  const waitHandoverActions: AuxiliaryWarehouseAction[] = ['finish-inbound', 'handover-confirm']
  if (input.mode === 'wait-process' && !waitProcessActions.includes(action)) return ''
  if (input.mode === 'wait-handover' && !waitHandoverActions.includes(action)) return ''

  const closeHref = escapeHtml(buildAuxiliaryWarehouseHref(input.domainSlug, input.mode, { action: null }))
  const waitProcessOptions = input.waitProcessItems.slice(0, 24).map((item) => ({
    value: item.stockItemId,
    label: `${item.sourceRecordNo} / ${item.craftName || input.domainTitlePrefix} / ${formatNumber(item.receivedQty)} ${item.unit}`,
  }))
  const inboundOptions = input.inboundRecords.slice(0, 24).map((item) => ({
    value: item.inboundRecordId,
    label: `${item.inboundRecordNo} / ${item.sourceRecordNo} / ${formatNumber(item.receivedQty)} ${item.unit}`,
  }))
  const waitHandoverOptions = input.waitHandoverItems.slice(0, 24).map((item) => ({
    value: item.stockItemId,
    label: `${item.taskNo || item.stockItemId} / ${item.craftName || input.domainTitlePrefix} / ${formatNumber(item.waitHandoverQty || item.completedQty)} ${item.unit}`,
  }))
  const areaOptions = Array.from(
    new Set([
      ...input.waitProcessItems.map((item) => item.areaName),
      ...input.waitHandoverItems.map((item) => item.areaName),
    ].filter(Boolean)),
  ).map((value) => ({ value, label: value }))
  const locationOptions = Array.from(
    new Set([
      ...input.waitProcessItems.map((item) => item.locationNo),
      ...input.waitHandoverItems.map((item) => item.locationNo),
    ].filter(Boolean)),
  ).map((value) => ({ value, label: value }))
  const receiverOptions = Array.from(
    new Set(input.waitHandoverItems.map((item) => item.receiverName || '').filter(Boolean)),
  ).map((value) => ({ value, label: value }))

  const config: Record<AuxiliaryWarehouseAction, { title: string; badge: string; submitLabel: string; actionLabel: string; eventText: string; fields: string[] }> = {
    receive: {
      title: '接收入仓',
      badge: '形成接收入仓记录',
      submitLabel: '确认接收入仓',
      actionLabel: '接收入仓',
      eventText: '从交接接收或外部领料回来后，确认数量并放入待加工仓库位。',
      fields: [
        renderAuxiliaryActionTextField('扫描交接单 / 加工单', '扫交接单、加工单或物料码'),
        renderAuxiliaryActionSelect('接收记录', inboundOptions),
        renderAuxiliaryActionTextField('接收数量', '例如 120'),
        renderAuxiliaryActionSelect('入库库区', areaOptions),
        renderAuxiliaryActionSelect('入库库位', locationOptions),
        renderAuxiliaryActionTextField('接收人', '默认当前仓管', `${input.domainTitlePrefix}仓管`),
      ],
    },
    'process-issue': {
      title: '加工领料',
      badge: '形成加工领料记录',
      submitLabel: '确认加工领料',
      actionLabel: '加工领料',
      eventText: '从待加工仓领出给工序现场使用，并扣减待加工仓库存。',
      fields: [
        renderAuxiliaryActionTextField('扫描加工单 / 库存记录', '扫加工单或库存二维码'),
        renderAuxiliaryActionSelect('库存记录', waitProcessOptions),
        renderAuxiliaryActionSelect('来源库区', areaOptions),
        renderAuxiliaryActionSelect('来源库位', locationOptions),
        renderAuxiliaryActionTextField('领料数量', '例如 80'),
        renderAuxiliaryActionTextField('加工用途', '例如 绣花工序领用'),
      ],
    },
    return: {
      title: '回收入仓',
      badge: '形成回收入仓记录',
      submitLabel: '确认回收入仓',
      actionLabel: '回收入仓',
      eventText: '加工未用完或退回的半成品重新回到待加工仓库位。',
      fields: [
        renderAuxiliaryActionTextField('扫描加工单 / 回收单', '扫加工单、回收单或物料码'),
        renderAuxiliaryActionSelect('库存记录', waitProcessOptions),
        renderAuxiliaryActionTextField('回收数量', '例如 12'),
        renderAuxiliaryActionSelect('回收库区', areaOptions),
        renderAuxiliaryActionSelect('回收库位', locationOptions),
        renderAuxiliaryActionTextField('回收原因', '例如 加工剩余', '加工剩余'),
      ],
    },
    'finish-inbound': {
      title: '完工入仓',
      badge: '形成待交出仓库存',
      submitLabel: '确认完工入仓',
      actionLabel: '完工入仓',
      eventText: '加工岗位完工后，仓管确认完成数量和损耗数量并入待交出仓。',
      fields: [
        renderAuxiliaryActionTextField('扫描加工单 / 完工单', '扫加工单、完工单或物料码'),
        renderAuxiliaryActionSelect('加工任务', waitHandoverOptions),
        renderAuxiliaryActionTextField('完工数量', '例如 96'),
        renderAuxiliaryActionTextField('损耗数量', '例如 2'),
        renderAuxiliaryActionSelect('入库库区', areaOptions),
        renderAuxiliaryActionSelect('入库库位', locationOptions),
      ],
    },
    'handover-confirm': {
      title: '交出确认',
      badge: '形成交出记录',
      submitLabel: '确认交出',
      actionLabel: '交出确认',
      eventText: '确认待交出库存、接收方和数量，保存后形成交出记录并出库。',
      fields: [
        renderAuxiliaryActionTextField('扫描交出单 / 加工任务', '扫交出单、加工任务或物料码'),
        renderAuxiliaryActionSelect('待交出库存', waitHandoverOptions),
        renderAuxiliaryActionSelect('接收方', receiverOptions),
        renderAuxiliaryActionTextField('交出数量', '例如 96'),
        renderAuxiliaryActionSelect('来源库区', areaOptions),
        renderAuxiliaryActionSelect('来源库位', locationOptions),
      ],
    },
  }
  const current = config[action]

  return `
    <div class="fixed inset-0 z-[120]" data-special-craft-warehouse-modal data-special-craft-warehouse-action-type="${escapeHtml(action)}">
      <button class="absolute inset-0 bg-black/45" data-nav="${closeHref}" aria-label="关闭弹窗"></button>
      <section class="absolute left-1/2 top-1/2 w-[min(760px,calc(100vw-40px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border bg-background shadow-2xl">
        <header class="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 class="text-base font-semibold">${escapeHtml(current.title)}</h2>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(current.eventText)}</div>
          </div>
          <span class="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">${escapeHtml(current.badge)}</span>
        </header>
        <div class="max-h-[68vh] overflow-y-auto p-4">
          <div class="grid gap-3 md:grid-cols-2">${current.fields.join('')}</div>
          <label class="mt-3 block">
            <span class="text-xs font-medium text-slate-700">备注</span>
            <textarea class="mt-1 h-20 w-full resize-none rounded-md border px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="现场说明，可不填"></textarea>
          </label>
        </div>
        <footer class="flex justify-end gap-2 border-t px-4 py-3">
          <button type="button" class="h-10 rounded-md border px-4 text-sm hover:bg-muted" data-nav="${closeHref}">取消</button>
          <button
            type="button"
            class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
            data-skip-page-rerender="true"
            data-special-craft-warehouse-action="mock-confirm"
            data-action-label="${escapeHtml(current.actionLabel)}"
            data-domain-slug="${escapeHtml(input.domainSlug)}"
            data-warehouse-mode="${input.mode}"
          >${escapeHtml(current.submitLabel)}</button>
        </footer>
      </section>
    </div>
  `
}

function renderWaitProcessStockRows(items: FactoryWaitProcessStockItem[], operations: SpecialCraftOperationDefinition[]): string {
  if (!items.length) return `<tr><td colspan="8" class="py-10 text-center text-muted-foreground">当前筛选条件下暂无待加工库存。</td></tr>`
  return items.map((item) => `
    <tr class="align-top hover:bg-muted/20">
      <td class="px-3 py-3">
        <div class="font-medium text-slate-900">${escapeHtml(item.sourceRecordNo)}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.craftName || '-')}</div>
      </td>
      <td class="px-3 py-3">
        <div>${escapeHtml(item.taskNo || '-')}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.productionOrderNo || '-')}</div>
      </td>
      <td class="px-3 py-3">${escapeHtml(item.factoryName)}</td>
      <td class="px-3 py-3">${escapeHtml(item.materialSku || item.partName || item.itemName)}</td>
      <td class="px-3 py-3 font-semibold tabular-nums">${formatNumber(item.receivedQty)} ${escapeHtml(item.unit)}</td>
      <td class="px-3 py-3">
        <div>${escapeHtml(item.areaName)}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.shelfNo)} / ${escapeHtml(item.locationNo)}</div>
      </td>
      <td class="px-3 py-3">${renderStatusBadge(item.status)}</td>
      <td class="px-3 py-3">
        <div class="flex flex-wrap gap-2">
          ${renderDomainWorkOrderAction(operations, { craftName: item.craftName || '', sourceWorkOrderId: item.taskId || item.sourceRecordId })}
          ${renderWarehouseFlowButton(`${item.sourceRecordNo} 库存流水`, buildUnifiedWaitProcessFlowLines(item))}
        </div>
      </td>
    </tr>
  `).join('')
}

function renderInboundRecordRows(records: FactoryWarehouseInboundRecord[]): string {
  if (!records.length) return `<tr><td colspan="9" class="py-10 text-center text-muted-foreground">暂无接收入仓记录。</td></tr>`
  return records.map((item) => `
    <tr class="align-top hover:bg-muted/20">
      <td class="px-3 py-3 font-medium text-slate-900">${escapeHtml(item.inboundRecordNo)}</td>
      <td class="px-3 py-3">${escapeHtml(item.craftName || '-')}</td>
      <td class="px-3 py-3">${escapeHtml(item.factoryName)}</td>
      <td class="px-3 py-3">${escapeHtml(item.sourceRecordNo)}</td>
      <td class="px-3 py-3">${escapeHtml(item.taskNo || '-')}</td>
      <td class="px-3 py-3">${escapeHtml(item.materialSku || item.partName || item.itemName)}</td>
      <td class="px-3 py-3 font-semibold tabular-nums">${formatNumber(item.receivedQty)} ${escapeHtml(item.unit)}</td>
      <td class="px-3 py-3">${escapeHtml(item.areaName)} / ${escapeHtml(item.shelfNo)} / ${escapeHtml(item.locationNo)}</td>
      <td class="px-3 py-3">${renderStatusBadge(item.status)}</td>
    </tr>
  `).join('')
}

function renderIssueRecordRows(items: FactoryWaitProcessStockItem[]): string {
  if (!items.length) return `<tr><td colspan="8" class="py-10 text-center text-muted-foreground">暂无加工领料记录。</td></tr>`
  return items.map((item) => {
    const issueQty = Math.max(item.receivedQty - Math.abs(item.differenceQty || 0), 0)
    return `
      <tr class="align-top hover:bg-muted/20">
        <td class="px-3 py-3 font-medium text-slate-900">JGL-${escapeHtml(item.sourceRecordNo)}</td>
        <td class="px-3 py-3">${escapeHtml(item.craftName || '-')}</td>
        <td class="px-3 py-3">${escapeHtml(item.taskNo || '-')}</td>
        <td class="px-3 py-3">${escapeHtml(item.materialSku || item.partName || item.itemName)}</td>
        <td class="px-3 py-3 font-semibold tabular-nums">${formatNumber(issueQty)} ${escapeHtml(item.unit)}</td>
        <td class="px-3 py-3">${escapeHtml(item.areaName)} / ${escapeHtml(item.shelfNo)} / ${escapeHtml(item.locationNo)}</td>
        <td class="px-3 py-3">${renderStatusBadge(item.status === '差异待处理' ? '待复核' : '已领用')}</td>
        <td class="px-3 py-3">${renderWarehouseFlowButton(`${item.taskNo || item.sourceRecordNo} 加工领料流水`, buildUnifiedWaitProcessFlowLines(item), '查看流水')}</td>
      </tr>
    `
  }).join('')
}

function renderReturnRecordRows(items: FactoryWaitProcessStockItem[]): string {
  if (!items.length) return `<tr><td colspan="8" class="py-10 text-center text-muted-foreground">暂无回收入仓记录。</td></tr>`
  return items.map((item) => {
    const returnQty = Math.abs(item.differenceQty || 0) || Math.max(Math.round(item.receivedQty * 0.06), 1)
    return `
      <tr class="align-top hover:bg-muted/20">
        <td class="px-3 py-3 font-medium text-slate-900">HSH-${escapeHtml(item.sourceRecordNo)}</td>
        <td class="px-3 py-3">${escapeHtml(item.craftName || '-')}</td>
        <td class="px-3 py-3">${escapeHtml(item.taskNo || '-')}</td>
        <td class="px-3 py-3">${escapeHtml(item.materialSku || item.partName || item.itemName)}</td>
        <td class="px-3 py-3 font-semibold tabular-nums">${formatNumber(returnQty)} ${escapeHtml(item.unit)}</td>
        <td class="px-3 py-3">${escapeHtml(item.areaName)} / ${escapeHtml(item.shelfNo)} / ${escapeHtml(item.locationNo)}</td>
        <td class="px-3 py-3">${renderStatusBadge(item.status === '差异待处理' ? '待复核' : '已回收入仓')}</td>
        <td class="px-3 py-3">${renderWarehouseFlowButton(`${item.taskNo || item.sourceRecordNo} 回收入仓流水`, buildUnifiedWaitProcessFlowLines(item), '查看流水')}</td>
      </tr>
    `
  }).join('')
}

function renderWaitHandoverStockRows(
  items: FactoryWaitHandoverStockItem[],
  operations: SpecialCraftOperationDefinition[],
  domainSlug: string,
): string {
  if (!items.length) return `<tr><td colspan="8" class="py-10 text-center text-muted-foreground">当前筛选条件下暂无待交出库存。</td></tr>`
  return items.map((item) => `
    <tr class="align-top hover:bg-muted/20">
      <td class="px-3 py-3">
        <div class="font-medium text-slate-900">${escapeHtml(item.stockItemId)}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.craftName || '-')}</div>
      </td>
      <td class="px-3 py-3">
        <div>${escapeHtml(item.taskNo || '-')}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.productionOrderNo || '-')}</div>
      </td>
      <td class="px-3 py-3">${escapeHtml(item.factoryName)}</td>
      <td class="px-3 py-3">${escapeHtml(item.materialSku || item.partName || item.itemName)}</td>
      <td class="px-3 py-3 font-semibold tabular-nums">${formatNumber(item.waitHandoverQty || item.completedQty)} ${escapeHtml(item.unit)}</td>
      <td class="px-3 py-3">${escapeHtml(item.areaName)} / ${escapeHtml(item.shelfNo)} / ${escapeHtml(item.locationNo)}</td>
      <td class="px-3 py-3">${renderStatusBadge(item.status)}</td>
      <td class="px-3 py-3">
        <div class="flex flex-wrap gap-2">
          ${renderDomainWorkOrderAction(operations, { craftName: item.craftName || '', sourceWorkOrderId: item.taskId || item.stockItemId })}
          ${item.status === '待交出' ? `<button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildAuxiliaryWarehouseHref(domainSlug, 'wait-handover', { action: 'handover-confirm' }))}">交出确认</button>` : ''}
          ${renderWarehouseFlowButton(`${item.stockItemId} 库存流水`, buildUnifiedWaitHandoverFlowLines(item))}
        </div>
      </td>
    </tr>
  `).join('')
}

function renderFinishInboundRows(items: FactoryWaitHandoverStockItem[]): string {
  if (!items.length) return `<tr><td colspan="8" class="py-10 text-center text-muted-foreground">暂无完工入仓记录。</td></tr>`
  return items.map((item) => `
    <tr class="align-top hover:bg-muted/20">
      <td class="px-3 py-3 font-medium text-slate-900">WG-${escapeHtml(item.taskNo || item.stockItemId)}</td>
      <td class="px-3 py-3">${escapeHtml(item.craftName || '-')}</td>
      <td class="px-3 py-3">${escapeHtml(item.taskNo || '-')}</td>
      <td class="px-3 py-3">${escapeHtml(item.materialSku || item.partName || item.itemName)}</td>
      <td class="px-3 py-3 font-semibold tabular-nums">${formatNumber(item.completedQty)} ${escapeHtml(item.unit)}</td>
      <td class="px-3 py-3">${formatNumber(item.lossQty)} ${escapeHtml(item.unit)}</td>
      <td class="px-3 py-3">${escapeHtml(item.areaName)} / ${escapeHtml(item.shelfNo)} / ${escapeHtml(item.locationNo)}</td>
      <td class="px-3 py-3">${renderStatusBadge(item.status)}</td>
    </tr>
  `).join('')
}

function renderHandoverConfirmRows(items: FactoryWaitHandoverStockItem[], domainSlug: string): string {
  if (!items.length) return `<tr><td colspan="8" class="py-10 text-center text-muted-foreground">暂无可交出确认记录。</td></tr>`
  return items.map((item) => `
    <tr class="align-top hover:bg-muted/20">
      <td class="px-3 py-3 font-medium text-slate-900">${escapeHtml(item.handoverOrderNo || `待生成-${item.stockItemId}`)}</td>
      <td class="px-3 py-3">${escapeHtml(item.craftName || '-')}</td>
      <td class="px-3 py-3">${escapeHtml(item.taskNo || '-')}</td>
      <td class="px-3 py-3">${escapeHtml(item.receiverName || '-')}</td>
      <td class="px-3 py-3 font-semibold tabular-nums">${formatNumber(item.waitHandoverQty || item.completedQty)} ${escapeHtml(item.unit)}</td>
      <td class="px-3 py-3">${escapeHtml(item.areaName)} / ${escapeHtml(item.shelfNo)} / ${escapeHtml(item.locationNo)}</td>
      <td class="px-3 py-3">${renderStatusBadge(item.status)}</td>
      <td class="px-3 py-3"><button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildAuxiliaryWarehouseHref(domainSlug, 'wait-handover', { action: 'handover-confirm' }))}">交出确认</button></td>
    </tr>
  `).join('')
}

function renderOutboundRecordRows(records: FactoryWarehouseOutboundRecord[]): string {
  if (!records.length) return `<tr><td colspan="10" class="py-10 text-center text-muted-foreground">暂无交出记录。</td></tr>`
  return records.map((item) => `
    <tr class="align-top hover:bg-muted/20">
      <td class="px-3 py-3 font-medium text-slate-900">${escapeHtml(item.outboundRecordNo)}</td>
      <td class="px-3 py-3">${escapeHtml(item.craftName || '-')}</td>
      <td class="px-3 py-3">${escapeHtml(item.factoryName)}</td>
      <td class="px-3 py-3">${escapeHtml(item.sourceTaskNo || '-')}</td>
      <td class="px-3 py-3">${escapeHtml(item.handoverRecordNo || '-')}</td>
      <td class="px-3 py-3">${escapeHtml(item.receiverName)}</td>
      <td class="px-3 py-3 font-semibold tabular-nums">${formatNumber(item.outboundQty)} ${escapeHtml(item.unit)}</td>
      <td class="px-3 py-3">${item.receiverWrittenQty === undefined ? '-' : `${formatNumber(item.receiverWrittenQty)} ${escapeHtml(item.unit)}`}</td>
      <td class="px-3 py-3">${renderStatusBadge(item.status)}</td>
      <td class="px-3 py-3">
        <div class="flex flex-wrap gap-2">
          ${item.handoverRecordId ? `<button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildTaskDeliveryCardPrintLink(item.handoverRecordId))}">打印任务交货卡</button>` : ''}
          ${item.handoverRecordId ? `<button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildHandoverQrLabelPrintLink(item.handoverRecordId))}">打印交出二维码</button>` : ''}
          ${renderWarehouseFlowButton(`${item.outboundRecordNo} 交出流水`, [{
            flowType: '交出确认',
            qtyText: `${formatQty(item.outboundQty)} ${item.unit}`,
            sourceNo: item.handoverRecordNo || item.outboundRecordNo,
            operatedAt: item.outboundAt,
            operatorName: item.operatorName,
            statusText: item.status,
          }], '查看流水')}
        </div>
      </td>
    </tr>
  `).join('')
}

function renderNodeRows(rows: FactoryWarehouseNodeRow[]): string {
  if (!rows.length) return `<tr><td colspan="7" class="py-10 text-center text-muted-foreground">暂无库区库位。</td></tr>`
  return rows.map((item) => `
    <tr class="hover:bg-muted/20">
      <td class="px-3 py-3">${escapeHtml(item.factoryName)}</td>
      <td class="px-3 py-3">${escapeHtml(item.warehouseName)}</td>
      <td class="px-3 py-3">${escapeHtml(item.areaName)}</td>
      <td class="px-3 py-3">${escapeHtml(item.shelfNo || '-')}</td>
      <td class="px-3 py-3">${escapeHtml(item.locationNo || '-')}</td>
      <td class="px-3 py-3">${renderStatusBadge(item.status === 'AVAILABLE' ? '可用' : '停用')}</td>
      <td class="px-3 py-3">${escapeHtml(item.remark || '-')}</td>
    </tr>
  `).join('')
}

interface DomainLocationRow {
  operationName: string
  physicalAreaName: string
  warehouseName: string
  areaName: string
  shelfNo: string
  locationNo: string
  capacityLabel: string
}

function buildDomainLocationRows(
  operations: SpecialCraftOperationDefinition[],
  mode: SpecialCraftWarehousePageMode,
): DomainLocationRow[] {
  return operations.flatMap((operation, index) => {
    const area = resolvePhysicalAreaMeta(operation.operationName)
    const warehouseName = `${area.areaName} · ${mode === 'wait-process' ? '待加工仓' : '待交出仓'}`
    return [1, 2].map((slot) => ({
      operationName: operation.operationName,
      physicalAreaName: area.areaName,
      warehouseName,
      areaName: `${area.areaName} A区`,
      shelfNo: `${area.shelfPrefix}-A-${String((index % 3) + 1).padStart(2, '0')}`,
      locationNo: `${area.warehousePrefix}-${String(slot).padStart(2, '0')}`,
      capacityLabel: slot === 1 ? '常用库位' : '备用库位',
    }))
  })
}

function renderLocationRows(rows: DomainLocationRow[]): string {
  if (!rows.length) return `<tr><td colspan="7" class="py-10 text-center text-muted-foreground">当前筛选条件下暂无库区库位。</td></tr>`
  const seen = new Set<string>()
  return rows
    .filter((row) => {
      const key = `${row.operationName}-${row.warehouseName}-${row.shelfNo}-${row.locationNo}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((row) => `
      <tr class="hover:bg-muted/20">
        <td class="px-3 py-3 font-medium text-slate-900">${escapeHtml(row.operationName)}</td>
        <td class="px-3 py-3">${escapeHtml(row.physicalAreaName)}</td>
        <td class="px-3 py-3">${escapeHtml(row.warehouseName)}</td>
        <td class="px-3 py-3">${escapeHtml(row.areaName)}</td>
        <td class="px-3 py-3">${escapeHtml(row.shelfNo)}</td>
        <td class="px-3 py-3">${escapeHtml(row.locationNo)}</td>
        <td class="px-3 py-3">${escapeHtml(row.capacityLabel)}</td>
      </tr>
    `)
    .join('')
}

function renderPaginatedTable<T>(input: {
  title: string
  rows: T[]
  state: SpecialCraftWarehousePageState
  domainSlug: string
  mode: SpecialCraftWarehousePageMode
  headers: string[]
  rowHtml: (items: T[]) => string
  minWidth?: string
}): string {
  const pagination = paginateItems(input.rows, input.state.page, input.state.pageSize)
  const colSpan = input.headers.length
  const table = `
    <table class="w-full ${input.minWidth || 'min-w-[1180px]'} table-auto border-collapse text-sm">
      <thead class="sticky top-0 z-10 bg-slate-50 text-left text-slate-600">
        <tr>${input.headers.map((header) => `<th class="px-3 py-3 font-medium">${escapeHtml(header)}</th>`).join('')}</tr>
      </thead>
      <tbody class="divide-y bg-card">${input.rowHtml(pagination.items) || `<tr><td colspan="${colSpan}" class="py-10 text-center text-muted-foreground">暂无数据。</td></tr>`}</tbody>
    </table>
  `
  return `
    <div>
      ${renderStickyTableScroller(table, 'max-h-[58vh]')}
      ${renderWorkbenchPagination({
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        actionAttr: 'data-special-craft-warehouse-action',
        pageAction: 'set-page',
        pageSizeAttr: 'data-special-craft-warehouse-page-size',
        extraAttrs: `data-domain-slug="${escapeHtml(input.domainSlug)}" data-warehouse-mode="${input.mode}"`,
        pageSizeOptions: [10, 20, 50],
      })}
    </div>
  `
}

function renderSpecialCraftDomainWarehousePageByMode(
  domainSlug: string,
  mode: SpecialCraftWarehousePageMode,
): string {
  const domain = getSpecialCraftManagementDomainBySlug(domainSlug)
  if (!isSpecialCraftWarehouseDomain(domain)) {
    return renderEmptyState('未找到对应工艺仓页面。')
  }

  const state = getWarehouseState(domainSlug, mode)
  const operations = getDomainOperations(domain)
  const craftNames = buildDomainCraftNameSet(operations)
  const meta = specialCraftWarehouseDomainMeta[domain]
  const isAuxiliaryDomain = domain === 'AUXILIARY_CRAFT_FACTORY'
  const isSpecialTypeDomain = domain === 'SPECIAL_CRAFT_FACTORY'
  const isUnifiedCraftWarehouseDomain = isAuxiliaryDomain || isSpecialTypeDomain
  if (isAuxiliaryDomain) {
    listAuxiliaryCraftTaskOrders()
  }
  if (isSpecialTypeDomain) {
    listSpecialTypeCraftTaskOrders()
  }
  const allWaitProcessRecords = mode === 'wait-process'
    ? filterSpecialCraftRecordsByDomain(
      listWaitProcessWarehouseRecords({ craftType: 'SPECIAL_CRAFT' }),
      craftNames,
    )
    : []
  const allWaitHandoverRecords = mode === 'wait-handover'
    ? filterSpecialCraftRecordsByDomain(
      listWaitHandoverWarehouseRecords({ craftType: 'SPECIAL_CRAFT' }),
      craftNames,
    )
    : []
  const allHandoverRecords = mode === 'wait-handover'
    ? filterSpecialCraftRecordsByDomain(
      listProcessHandoverRecords({ craftType: 'SPECIAL_CRAFT' }),
      craftNames,
    )
    : []
  const activeAllRecords = mode === 'wait-process' ? allWaitProcessRecords : allWaitHandoverRecords
  const waitProcessRecords = mode === 'wait-process'
    ? allWaitProcessRecords.filter((record) => recordMatchesWarehouseState(record, state))
    : []
  const waitHandoverRecords = mode === 'wait-handover'
    ? allWaitHandoverRecords.filter((record) => recordMatchesWarehouseState(record, state))
    : []
  const handoverRecords = mode === 'wait-handover'
    ? allHandoverRecords.filter((record) => recordMatchesWarehouseState(record, state))
    : []
  const auxiliaryAllWaitProcessItems = isUnifiedCraftWarehouseDomain
    ? filterUnifiedRecordsByDomain(listFactoryWaitProcessStockItems(), craftNames)
    : []
  const auxiliaryAllWaitHandoverItems = isUnifiedCraftWarehouseDomain
    ? filterUnifiedRecordsByDomain(listFactoryWaitHandoverStockItems(), craftNames)
    : []
  const auxiliaryAllInboundRecords = isUnifiedCraftWarehouseDomain
    ? filterUnifiedRecordsByDomain(listFactoryWarehouseInboundRecords(), craftNames)
    : []
  const auxiliaryAllOutboundRecords = isUnifiedCraftWarehouseDomain
    ? filterUnifiedRecordsByDomain(listFactoryWarehouseOutboundRecords(), craftNames)
    : []
  const auxiliaryWaitProcessItems = auxiliaryAllWaitProcessItems.filter((record) => unifiedRecordMatchesWarehouseState(record, state))
  const auxiliaryWaitHandoverItems = auxiliaryAllWaitHandoverItems.filter((record) => unifiedRecordMatchesWarehouseState(record, state))
  const auxiliaryInboundRecords = auxiliaryAllInboundRecords.filter((record) => unifiedRecordMatchesWarehouseState(record, state))
  const auxiliaryOutboundRecords = auxiliaryAllOutboundRecords.filter((record) => unifiedRecordMatchesWarehouseState(record, state))
  const auxiliaryAllFilterRecords: WarehouseFilterRecord[] = mode === 'wait-process'
    ? [...auxiliaryAllWaitProcessItems, ...auxiliaryAllInboundRecords]
    : [...auxiliaryAllWaitHandoverItems, ...auxiliaryAllOutboundRecords]
  const auxiliaryActiveRecords = mode === 'wait-process' ? auxiliaryWaitProcessItems : auxiliaryWaitHandoverItems
  const auxiliaryReturnRecords = auxiliaryWaitProcessItems.filter((item) => item.status === '差异待处理' || item.remark?.includes('回收'))
  const auxiliaryHandoverConfirmRecords = auxiliaryWaitHandoverItems.filter((item) => item.status === '待交出')
  const auxiliaryNodeSourceRecords = auxiliaryActiveRecords.length ? auxiliaryActiveRecords : auxiliaryAllFilterRecords
  const auxiliaryNodeFactoryIds = new Set(auxiliaryNodeSourceRecords.map((record) => getFilterRecordFactory(record).factoryId).filter(Boolean))
  const auxiliaryNodeKeyword = state.keyword.trim().toLowerCase()
  const auxiliaryNodeRows = isUnifiedCraftWarehouseDomain
    ? listFactoryWarehouseNodeRows()
      .filter((row) => auxiliaryNodeFactoryIds.has(row.factoryId))
      .filter((row) => state.factoryId === '全部' || row.factoryId === state.factoryId)
      .filter((row) => {
        if (!auxiliaryNodeKeyword) return true
        return [row.factoryName, row.warehouseName, row.areaName, row.shelfNo, row.locationNo, row.remark]
          .some((token) => token?.toLowerCase().includes(auxiliaryNodeKeyword))
      })
    : []
  const activeRecords = mode === 'wait-process' ? waitProcessRecords : waitHandoverRecords
  const metricRecordLength = isUnifiedCraftWarehouseDomain ? auxiliaryActiveRecords.length : activeRecords.length
  const locationRows = buildDomainLocationRows(operations, mode).filter((row) => {
    if (state.operationName !== '全部' && row.operationName !== state.operationName) return false
    if (state.physicalAreaName !== '全部' && row.physicalAreaName !== state.physicalAreaName) return false
    if (!state.keyword.trim()) return true
    const normalized = state.keyword.trim().toLowerCase()
    return [row.operationName, row.physicalAreaName, row.warehouseName, row.areaName, row.shelfNo, row.locationNo]
      .some((token) => token.toLowerCase().includes(normalized))
  })
  const title = mode === 'wait-process' ? `${meta.titlePrefix}待加工仓` : `${meta.titlePrefix}待交出仓`
  const totalQty = isUnifiedCraftWarehouseDomain
    ? auxiliaryActiveRecords.reduce((sum, record) => sum + ('receivedQty' in record ? record.receivedQty : record.waitHandoverQty || record.completedQty), 0)
    : activeRecords.reduce((sum, record) => sum + record.availableObjectQty, 0)
  const factoryCount = isUnifiedCraftWarehouseDomain
    ? new Set(auxiliaryActiveRecords.map((record) => record.factoryId).filter(Boolean)).size
    : new Set(activeRecords.map((record) => record.targetFactoryId).filter(Boolean)).size
  const productionOrderCount = isUnifiedCraftWarehouseDomain
    ? new Set(auxiliaryActiveRecords.map((record) => record.productionOrderNo).filter(Boolean)).size
    : new Set(activeRecords.map((record) => record.sourceProductionOrderNo).filter(Boolean)).size

  if (state.page > Math.max(1, Math.ceil(metricRecordLength / state.pageSize))) {
    state.page = 1
  }

  const metrics = `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      ${renderCompactKpiCard(mode === 'wait-process' ? '待加工库存' : '待交出库存', `${formatNumber(totalQty)} 件`, `${metricRecordLength} 条库存记录`, mode === 'wait-process' ? 'text-amber-600' : 'text-blue-600')}
      ${renderCompactKpiCard('覆盖工艺', operations.length, operations.map((operation) => operation.operationName).slice(0, 4).join(' / '), 'text-slate-900')}
      ${renderCompactKpiCard('生产单', productionOrderCount, '按生产单聚合', 'text-blue-600')}
      ${renderCompactKpiCard('工厂', factoryCount, '当前筛选结果', 'text-emerald-600')}
    </section>
  `

  if (isUnifiedCraftWarehouseDomain) {
    const renderFilteredTable = (tableHtml: string): string => `
      <section class="space-y-4">
        ${renderWarehouseFilters(domainSlug, mode, state, operations, auxiliaryAllFilterRecords)}
        ${tableHtml}
      </section>
    `
    const locationContent = `
      <section class="space-y-4">
        <div class="flex justify-end rounded-lg border bg-card p-4">${renderWarehouseLocationToolbar(title)}</div>
        ${renderPaginatedTable({
          title: '库区库位',
          rows: auxiliaryNodeRows,
          state,
          domainSlug,
          mode,
          headers: ['工厂', '仓库', '库区', '货架', '库位', '状态', '备注'],
          rowHtml: renderNodeRows,
          minWidth: 'min-w-[960px]',
        })}
      </section>
    `
    const actionDialog = renderAuxiliaryWarehouseActionDialog({
      domainSlug,
      mode,
      domainTitlePrefix: meta.titlePrefix,
      waitProcessItems: auxiliaryAllWaitProcessItems,
      inboundRecords: auxiliaryAllInboundRecords,
      waitHandoverItems: auxiliaryAllWaitHandoverItems,
    })

    if (mode === 'wait-process') {
      const activeTab = readAuxiliaryWaitProcessTab()
      const tabs = [
        { key: 'inventory', label: '库存明细' },
        { key: 'receive', label: '接收入仓' },
        { key: 'issue', label: '加工领料' },
        { key: 'return', label: '回收入仓' },
        { key: 'locations', label: '库区库位' },
      ]
      const inventoryContent = renderFilteredTable(renderPaginatedTable({
        title: '库存明细',
        rows: auxiliaryWaitProcessItems,
        state,
        domainSlug,
        mode,
        headers: ['接收入仓记录 / 工艺', '加工来源', '工厂', '库存对象', '当前库存', '库区库位', '状态', '操作'],
        rowHtml: (items) => renderWaitProcessStockRows(items, operations),
      }))
      const receiveContent = renderFilteredTable(renderPaginatedTable({
        title: '接收入仓记录',
        rows: auxiliaryInboundRecords,
        state,
        domainSlug,
        mode,
        headers: ['入仓记录', '工艺', '工厂', '来源单据', '加工任务', '库存对象', '实收数量', '库区库位', '状态'],
        rowHtml: renderInboundRecordRows,
      }))
      const issueContent = renderFilteredTable(renderPaginatedTable({
        title: '加工领料记录',
        rows: auxiliaryWaitProcessItems,
        state,
        domainSlug,
        mode,
        headers: ['领料记录', '工艺', '加工任务', '库存对象', '领料数量', '库区库位', '状态', '操作'],
        rowHtml: renderIssueRecordRows,
      }))
      const returnContent = renderFilteredTable(renderPaginatedTable({
        title: '回收入仓记录',
        rows: auxiliaryReturnRecords,
        state,
        domainSlug,
        mode,
        headers: ['回收记录', '工艺', '加工任务', '库存对象', '回收数量', '库区库位', '状态', '操作'],
        rowHtml: renderReturnRecordRows,
      }))
      const activeContent =
        activeTab === 'receive'
          ? receiveContent
          : activeTab === 'issue'
            ? issueContent
            : activeTab === 'return'
              ? returnContent
              : activeTab === 'locations'
                ? locationContent
                : inventoryContent

      return renderSpecialCraftPageLayout({
        operation: operations[0],
        title,
        description: '',
        activeSubNav: 'wait-process',
        actionsHtml: renderAuxiliaryWaitProcessHeaderActions(domainSlug),
        content: `
          <div class="space-y-4">
            ${renderAuxiliaryWarehouseTabs(domainSlug, mode, activeTab, tabs)}
            ${activeContent}
            ${actionDialog}
          </div>
        `,
      })
    }

    const activeTab = readAuxiliaryWaitHandoverTab()
    const tabs = [
      { key: 'inventory', label: '库存明细' },
      { key: 'finish-inbound', label: '完工入仓' },
      { key: 'handover-confirm', label: '交出确认' },
      { key: 'handover', label: '交出记录' },
      { key: 'locations', label: '库区库位' },
    ]
    const inventoryContent = renderFilteredTable(renderPaginatedTable({
      title: '库存明细',
      rows: auxiliaryWaitHandoverItems,
      state,
      domainSlug,
      mode,
      headers: ['待交出库存 / 工艺', '加工来源', '工厂', '库存对象', '当前库存', '库区库位', '状态', '操作'],
      rowHtml: (items) => renderWaitHandoverStockRows(items, operations, domainSlug),
    }))
    const finishInboundContent = renderFilteredTable(renderPaginatedTable({
      title: '完工入仓记录',
      rows: auxiliaryWaitHandoverItems,
      state,
      domainSlug,
      mode,
      headers: ['完工记录', '工艺', '加工任务', '库存对象', '完工数量', '损耗数量', '库区库位', '状态'],
      rowHtml: renderFinishInboundRows,
    }))
    const handoverConfirmContent = renderFilteredTable(renderPaginatedTable({
      title: '交出确认',
      rows: auxiliaryHandoverConfirmRecords,
      state,
      domainSlug,
      mode,
      headers: ['交出单', '工艺', '加工任务', '接收方', '交出数量', '库区库位', '状态', '操作'],
      rowHtml: (items) => renderHandoverConfirmRows(items, domainSlug),
    }))
    const handoverContent = renderFilteredTable(renderPaginatedTable({
      title: '交出记录',
      rows: auxiliaryOutboundRecords,
      state,
      domainSlug,
      mode,
      headers: ['出库记录', '工艺', '工厂', '来源任务', '交出记录', '接收方', '交出数量', '回写数量', '状态', '操作'],
      rowHtml: renderOutboundRecordRows,
    }))
    const activeContent =
      activeTab === 'finish-inbound'
        ? finishInboundContent
        : activeTab === 'handover-confirm'
          ? handoverConfirmContent
          : activeTab === 'handover'
            ? handoverContent
            : activeTab === 'locations'
              ? locationContent
              : inventoryContent
    const waitHandoverKpis = `
      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        ${renderCompactKpiCard('待交出库存', `${formatNumber(totalQty)} 件`, `${auxiliaryWaitHandoverItems.length} 条库存`, 'text-blue-600')}
        ${renderCompactKpiCard('完工入仓', auxiliaryWaitHandoverItems.length, '已形成待交出库存', 'text-emerald-600')}
        ${renderCompactKpiCard('可交出确认', auxiliaryHandoverConfirmRecords.length, '待生成交出记录', 'text-amber-600')}
        ${renderCompactKpiCard('交出记录', auxiliaryOutboundRecords.length, '已确认交出', 'text-violet-600')}
        ${renderCompactKpiCard('差异 / 异议', auxiliaryWaitHandoverItems.filter((item) => item.status === '差异' || item.status === '异议中').length, '等待接收回写处理', 'text-rose-600')}
      </section>
    `

    return renderSpecialCraftPageLayout({
      operation: operations[0],
      title,
      description: '',
      activeSubNav: 'wait-handover',
      actionsHtml: renderAuxiliaryWaitHandoverHeaderActions(domainSlug),
      content: `
        <div class="space-y-4">
          ${waitHandoverKpis}
          ${renderAuxiliaryWarehouseTabs(domainSlug, mode, activeTab, tabs)}
          ${activeContent}
          ${actionDialog}
        </div>
      `,
    })
  }

  const tabs: FactoryWarehouseStandardTab[] = mode === 'wait-process'
      ? [
        {
          key: 'inventory',
          label: '库存',
          count: waitProcessRecords.length,
          content: renderPaginatedTable({
            title: '库存',
            rows: waitProcessRecords,
            state,
            domainSlug,
            mode,
            headers: ['仓记录 / 工艺', '加工来源', '工厂', '库存对象', '当前库存', '库区库位', '当前动作', '操作'],
            rowHtml: (items) => renderWaitProcessRows(items, operations),
          }),
        },
        {
          key: 'records',
          label: '入仓记录',
          count: waitProcessRecords.length,
          content: renderPaginatedTable({
            title: '入仓记录',
            rows: waitProcessRecords,
            state,
            domainSlug,
            mode,
            headers: ['仓记录 / 工艺', '加工来源', '工厂', '库存对象', '当前库存', '库区库位', '当前动作', '操作'],
            rowHtml: (items) => renderWaitProcessRows(items, operations),
          }),
        },
        {
          key: 'locations',
          label: '库区库位',
          count: locationRows.length,
          content: renderPaginatedTable({
            title: '库区库位',
            rows: locationRows,
            state,
            domainSlug,
            mode,
            headers: ['工艺', '物理库区', '仓库', '库区', '货架', '库位', '容量'],
            rowHtml: renderLocationRows,
            minWidth: 'min-w-[960px]',
          }),
        },
      ]
      : [
        {
          key: 'inventory',
          label: '库存',
          count: waitHandoverRecords.length,
          content: renderPaginatedTable({
            title: '库存',
            rows: waitHandoverRecords,
            state,
            domainSlug,
            mode,
            headers: ['仓记录 / 工艺', '加工来源', '工厂', '库存对象', '当前库存', '库区库位', '交出状态', '操作'],
            rowHtml: (items) => renderWaitHandoverRows(items, operations),
          }),
        },
        {
          key: 'handover',
          label: '交出记录',
          count: handoverRecords.length,
          content: renderPaginatedTable({
            title: '交出记录',
            rows: handoverRecords,
            state,
            domainSlug,
            mode,
            headers: ['交出记录 / 工艺', '加工来源', '交出工厂', '接收方', '交出数量', '物理库区', '交出时间', '状态'],
            rowHtml: renderHandoverRows,
          }),
        },
        {
          key: 'locations',
          label: '库区库位',
          count: locationRows.length,
          content: renderPaginatedTable({
            title: '库区库位',
            rows: locationRows,
            state,
            domainSlug,
            mode,
            headers: ['工艺', '物理库区', '仓库', '库区', '货架', '库位', '容量'],
            rowHtml: renderLocationRows,
            minWidth: 'min-w-[960px]',
          }),
        },
      ]

  return renderSpecialCraftPageLayout({
    operation: operations[0],
    title,
    description: '',
    activeSubNav: mode === 'wait-process' ? 'wait-process' : 'wait-handover',
    content: `
      <div class="space-y-3">
        ${metrics}
        ${renderWarehouseFilters(domainSlug, mode, state, operations, isUnifiedCraftWarehouseDomain ? auxiliaryAllFilterRecords : activeAllRecords)}
        ${renderWarehouseStateBar(domainSlug, mode, state)}
        ${renderFactoryWarehouseStandardTabs(tabs, `special-craft-${domainSlug}-${mode}-warehouse-tabs`)}
      </div>
    `,
  })
}

export function renderSpecialCraftDomainWaitProcessWarehousePage(domainSlug: string): string {
  return renderSpecialCraftDomainWarehousePageByMode(domainSlug, 'wait-process')
}

export function renderSpecialCraftDomainWaitHandoverWarehousePage(domainSlug: string): string {
  return renderSpecialCraftDomainWarehousePageByMode(domainSlug, 'wait-handover')
}

export function handleSpecialCraftWarehouseEvent(target: Element): boolean {
  const pageSizeNode = target.closest<HTMLElement>('[data-special-craft-warehouse-page-size]')
  if (pageSizeNode) {
    const domainSlug = pageSizeNode.dataset.domainSlug
    const mode = pageSizeNode.dataset.warehouseMode as SpecialCraftWarehousePageMode | undefined
    if (!domainSlug || !mode) return false
    setWarehouseState(domainSlug, mode, { pageSize: Number((pageSizeNode as HTMLSelectElement).value) || 20, page: 1 })
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-special-craft-warehouse-field]')
  if (fieldNode) {
    const domainSlug = fieldNode.dataset.domainSlug
    const mode = fieldNode.dataset.warehouseMode as SpecialCraftWarehousePageMode | undefined
    const field = fieldNode.dataset.specialCraftWarehouseField as WarehouseFilterField | undefined
    if (!domainSlug || !mode || !field) return false
    setWarehouseState(domainSlug, mode, { [field]: (fieldNode as HTMLInputElement | HTMLSelectElement).value, page: 1 })
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-special-craft-warehouse-action]')
  const action = actionNode?.dataset.specialCraftWarehouseAction
  if (!actionNode || !action) return false
  const domainSlug = actionNode.dataset.domainSlug
  const mode = actionNode.dataset.warehouseMode as SpecialCraftWarehousePageMode | undefined
  if (!domainSlug || !mode) return false

  if (action === 'mock-confirm') {
    const actionLabel = actionNode.dataset.actionLabel || '仓管操作'
    if (typeof window !== 'undefined') {
      window.alert(`${actionLabel}已记录为演示数据。`)
    }
    return true
  }

  if (action === 'clear-filters') {
    warehouseStateByPage.set(getWarehouseStateKey(domainSlug, mode), { ...initialWarehouseState })
    return true
  }
  if (action === 'set-page') {
    setWarehouseState(domainSlug, mode, { page: Number(actionNode.dataset.page) || 1 })
    return true
  }
  return false
}

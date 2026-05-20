import {
  buildSpecialCraftWorkOrderDetailPath,
  getSpecialCraftManagementDomainBySlug,
  listOperationDefinitionsByManagementDomain,
  type SpecialCraftOperationDefinition,
} from '../../../data/fcs/special-craft-operations.ts'
import type { ProcessCraftManagementDomain } from '../../../data/fcs/process-craft-dict.ts'
import type { ProcessHandoverRecord, ProcessWarehouseRecord } from '../../../data/fcs/process-warehouse-domain.ts'
import {
  listProcessHandoverRecords,
  listWaitHandoverWarehouseRecords,
  listWaitProcessWarehouseRecords,
} from '../../../data/fcs/process-warehouse-domain.ts'
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
  formatQty,
  renderEmptyState,
  renderSpecialCraftPageLayout,
  renderStatusBadge,
} from './shared.ts'
import {
  renderFactoryWarehouseStandardTabs,
  renderWarehouseFlowButton,
  type FactoryWarehouseFlowLine,
  type FactoryWarehouseStandardTab,
} from '../shared/warehouse-standard.ts'

type SpecialCraftWarehousePageMode = 'wait-process' | 'wait-handover'
type SpecialCraftWarehouseDomain = 'AUXILIARY_CRAFT_FACTORY' | 'SPECIAL_CRAFT_FACTORY'
type WarehouseFilterField = 'keyword' | 'operationName' | 'factoryId' | 'physicalAreaName'

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

function buildFactoryOptions(records: Array<ProcessWarehouseRecord | ProcessHandoverRecord>): Array<{ value: string; label: string }> {
  const seen = new Set<string>()
  const options = records
    .map((record) => {
      if ('targetFactoryId' in record) return { value: record.targetFactoryId, label: record.targetFactoryName }
      return { value: record.handoverFactoryId, label: record.handoverFactoryName }
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
  activeRecords: Array<ProcessWarehouseRecord | ProcessHandoverRecord>,
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
  if (!records.length) return `<tr><td colspan="11" class="py-10 text-center text-muted-foreground">当前筛选条件下暂无待加工库存。</td></tr>`
  return records
    .map((record) => {
      const locationText = buildLocationText(record.craftName, record.warehouseRecordNo)
      return `
        <tr class="align-top hover:bg-muted/20">
          <td class="px-3 py-3 font-medium text-slate-900">${escapeHtml(record.warehouseRecordNo)}</td>
          <td class="px-3 py-3">${escapeHtml(record.craftName)}</td>
          <td class="px-3 py-3">${escapeHtml(record.sourceWorkOrderNo)}</td>
          <td class="px-3 py-3">${escapeHtml(record.sourceProductionOrderNo)}</td>
          <td class="px-3 py-3">${escapeHtml(record.targetFactoryName)}</td>
          <td class="px-3 py-3">${escapeHtml(record.skuSummary || record.materialName || '—')}</td>
          <td class="px-3 py-3 font-semibold tabular-nums">${formatNumber(record.availableObjectQty || record.receivedObjectQty)} ${escapeHtml(record.qtyUnit)}</td>
          <td class="px-3 py-3">${escapeHtml(resolvePhysicalAreaMeta(record.craftName).areaName)}</td>
          <td class="px-3 py-3">${escapeHtml(locationText)}</td>
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
  if (!records.length) return `<tr><td colspan="11" class="py-10 text-center text-muted-foreground">当前筛选条件下暂无待交出库存。</td></tr>`
  return records
    .map((record) => {
      const locationText = buildLocationText(record.craftName, record.warehouseRecordNo)
      return `
        <tr class="align-top hover:bg-muted/20">
          <td class="px-3 py-3 font-medium text-slate-900">${escapeHtml(record.warehouseRecordNo)}</td>
          <td class="px-3 py-3">${escapeHtml(record.craftName)}</td>
          <td class="px-3 py-3">${escapeHtml(record.sourceWorkOrderNo)}</td>
          <td class="px-3 py-3">${escapeHtml(record.sourceProductionOrderNo)}</td>
          <td class="px-3 py-3">${escapeHtml(record.targetFactoryName)}</td>
          <td class="px-3 py-3">${escapeHtml(record.skuSummary || record.materialName || '—')}</td>
          <td class="px-3 py-3 font-semibold tabular-nums">${formatNumber(record.availableObjectQty)} ${escapeHtml(record.qtyUnit)}</td>
          <td class="px-3 py-3">${escapeHtml(resolvePhysicalAreaMeta(record.craftName).areaName)}</td>
          <td class="px-3 py-3">${escapeHtml(locationText)}</td>
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
  if (!records.length) return `<tr><td colspan="9" class="py-10 text-center text-muted-foreground">当前筛选条件下暂无交出记录。</td></tr>`
  return records
    .map((record) => `
      <tr class="align-top hover:bg-muted/20">
        <td class="px-3 py-3 font-medium text-slate-900">${escapeHtml(record.handoverRecordNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.craftName)}</td>
        <td class="px-3 py-3">${escapeHtml(record.sourceWorkOrderNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.sourceProductionOrderNo)}</td>
        <td class="px-3 py-3">${escapeHtml(record.handoverFactoryName)}</td>
        <td class="px-3 py-3 font-semibold tabular-nums">${formatNumber(record.handoverObjectQty)} ${escapeHtml(record.qtyUnit)}</td>
        <td class="px-3 py-3">${escapeHtml(resolvePhysicalAreaMeta(record.craftName).areaName)}</td>
        <td class="px-3 py-3">${escapeHtml(record.handoverAt)}</td>
        <td class="px-3 py-3">${renderStatusBadge(record.status)}</td>
      </tr>
    `)
    .join('')
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
  const activeRecords = mode === 'wait-process' ? waitProcessRecords : waitHandoverRecords
  const locationRows = buildDomainLocationRows(operations, mode).filter((row) => {
    if (state.operationName !== '全部' && row.operationName !== state.operationName) return false
    if (state.physicalAreaName !== '全部' && row.physicalAreaName !== state.physicalAreaName) return false
    if (!state.keyword.trim()) return true
    const normalized = state.keyword.trim().toLowerCase()
    return [row.operationName, row.physicalAreaName, row.warehouseName, row.areaName, row.shelfNo, row.locationNo]
      .some((token) => token.toLowerCase().includes(normalized))
  })
  const title = mode === 'wait-process' ? `${meta.titlePrefix}待加工仓` : `${meta.titlePrefix}待交出仓`
  const totalQty = activeRecords.reduce((sum, record) => sum + record.availableObjectQty, 0)
  const factoryCount = new Set(activeRecords.map((record) => record.targetFactoryId).filter(Boolean)).size
  const productionOrderCount = new Set(activeRecords.map((record) => record.sourceProductionOrderNo).filter(Boolean)).size

  if (state.page > Math.max(1, Math.ceil(activeRecords.length / state.pageSize))) {
    state.page = 1
  }

  const metrics = `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      ${renderCompactKpiCard(mode === 'wait-process' ? '待加工库存' : '待交出库存', `${formatNumber(totalQty)} 件`, `${activeRecords.length} 条库存记录`, mode === 'wait-process' ? 'text-amber-600' : 'text-blue-600')}
      ${renderCompactKpiCard('覆盖工艺', operations.length, operations.map((operation) => operation.operationName).slice(0, 4).join(' / '), 'text-slate-900')}
      ${renderCompactKpiCard('生产单', productionOrderCount, '按生产单聚合', 'text-blue-600')}
      ${renderCompactKpiCard('工厂', factoryCount, '当前筛选结果', 'text-emerald-600')}
    </section>
  `

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
            headers: ['仓记录号', '工艺', '加工单号', '生产单', '工厂', '对象', '当前库存', '物理库区', '库区库位', '当前动作', '操作'],
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
            headers: ['仓记录号', '工艺', '加工单号', '生产单', '工厂', '对象', '当前库存', '物理库区', '库区库位', '当前动作', '操作'],
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
            headers: ['仓记录号', '工艺', '加工单号', '生产单', '工厂', '对象', '当前库存', '物理库区', '库区库位', '交出状态', '操作'],
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
            headers: ['交出记录号', '工艺', '加工单号', '生产单', '工厂', '交出数量', '物理库区', '交出时间', '状态'],
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
        ${renderWarehouseFilters(domainSlug, mode, state, operations, activeAllRecords)}
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

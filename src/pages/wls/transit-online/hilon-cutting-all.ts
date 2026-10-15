// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderDialog, renderFormDialog } from '../../../components/ui/dialog.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { createStandardListPage, type TransitOnlineListDefinition, type TransitOnlineListContext } from './list-factory.ts'
import { hilonCuttingAllSeed, cuttingAllCuttingFactoryOptions, type TransitOnlineCuttingAllRow } from './seed.ts'
import type { StandardListColumn } from '../../../components/ui/list-table.ts'

const dyeStatusClass: Record<string, string> = {
  白坯: 'bg-slate-100 text-slate-600',
  已染色: 'bg-blue-50 text-blue-700',
  已印花: 'bg-violet-50 text-violet-700',
  待印染: 'bg-orange-50 text-orange-700',
  已定型: 'bg-emerald-50 text-emerald-700',
}

// 售卖类型 10 项 / 染印需求 8 项 / 配料状态 3 项 / 领料状态 3 项（group8 行5）。
const SELL_TYPE_OPTIONS = ['全部', '内销', '外销', '样衣', '大货', '返单', '补单', '预售', '现货', '清仓', '定制']
const DYE_DEMAND_OPTIONS = ['全部', '白坯', '染色', '印花', '绣花', '压皱', '洗水', '定型', '免烫']
const ALLOCATION_STATUS_OPTIONS = ['全部', '待配料', '部分配料', '已配料']
const PICKUP_STATUS_OPTIONS = ['全部', '待领料', '部分领料', '已领料']

function allocationStatusOf(row: TransitOnlineCuttingAllRow): string {
  if (row.allocationQty === 0) return '待配料'
  return row.allocationQty >= row.planQty ? '已配料' : '部分配料'
}

function pickupStatusOf(row: TransitOnlineCuttingAllRow): string {
  if (row.pickupQty === 0) return '待领料'
  return row.pickupQty >= row.planQty ? '已领料' : '部分领料'
}

export interface CuttingAllOptions {
  eventPrefix: string
  preferenceKey: string
  title: string
  listTitle: string
  rows: TransitOnlineCuttingAllRow[]
  factoryOptions: string[]
  /** 裁床工厂筛选选项（「工厂×2」中的第二个工厂维度，group8 行5）。 */
  cuttingFactoryOptions: string[]
  description?: string
  /** 是否展示「物料类型」列：Mahameru 有新裁床为面料/辅料混合视图，Hilon 无（group8 行7、group9 行9）。 */
  showMaterialType?: boolean
}

// 时间范围判定：起止均空视为不过滤；值为「—」表示该阶段尚未发生，命中筛选即排除。
function cuttingAllInRange(value: string, from: string, to: string): boolean {
  if (!from && !to) return true
  if (!value || value === '—') return false
  const date = value.slice(0, 10)
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

function buildColumns(options: CuttingAllOptions): StandardListColumn<TransitOnlineCuttingAllRow>[] {
  const event = options.eventPrefix
  const columns: StandardListColumn<TransitOnlineCuttingAllRow>[] = [
    {
      key: 'image',
      title: '图片',
      width: 72,
      required: true,
      render: (r) => `<img src="${escapeHtml(r.image)}" alt="${escapeHtml(r.name)}" loading="lazy" class="h-10 w-10 rounded-md border border-slate-200 object-cover" onerror="this.style.display='none'">`,
    },
    {
      key: 'sku',
      title: 'SKU',
      width: 200,
      required: true,
      freezeable: true,
      sortable: true,
      sortValue: (r) => r.sku,
      render: (r) => `<div class="min-w-0"><div class="font-mono text-xs text-slate-700">${escapeHtml(r.sku)}</div><div class="truncate text-xs text-slate-400">${escapeHtml(r.spu)}</div></div>`,
    },
  ]
  if (options.showMaterialType) {
    columns.push({ key: 'materialType', title: '物料类型', width: 100, sortable: true, sortValue: (r) => r.materialType, render: (r) => `<span class="text-xs text-slate-500">${escapeHtml(r.materialType)}</span>` })
  }
  columns.push(
    { key: 'name', title: '名称', width: 180, sortable: true, sortValue: (r) => r.name, render: (r) => `<span class="text-xs text-slate-700">${escapeHtml(r.name)}</span>` },
    { key: 'source', title: '来源', width: 100, sortable: true, sortValue: (r) => r.source, render: (r) => `<span class="text-xs text-slate-500">${escapeHtml(r.source)}</span>` },
    { key: 'dyeStatus', title: '印染状态', width: 100, sortable: true, sortValue: (r) => r.dyeStatus, render: (r) => `<span class="rounded-full px-2 py-0.5 text-xs ${dyeStatusClass[r.dyeStatus] ?? ''}">${escapeHtml(r.dyeStatus)}</span>` },
    { key: 'inventory', title: '库存', width: 90, align: 'right', sortable: true, sortValue: (r) => r.inventory, render: (r) => `<span class="text-slate-600">${r.inventory} 卷</span>` },
    { key: 'planQty', title: '计划数量', width: 100, align: 'right', sortable: true, sortValue: (r) => r.planQty, render: (r) => `<span class="text-slate-600">${r.planQty} 卷</span>` },
    { key: 'allocationQty', title: '配料数量', width: 100, align: 'right', sortable: true, sortValue: (r) => r.allocationQty, render: (r) => `<span class="text-slate-600">${r.allocationQty} 卷</span>` },
    { key: 'pickupQty', title: '领取数量', width: 100, align: 'right', sortable: true, sortValue: (r) => r.pickupQty, render: (r) => `<span class="text-slate-600">${r.pickupQty} 卷</span>` },
    {
      key: 'pendingQty',
      title: '待配数量',
      width: 100,
      align: 'right',
      sortable: true,
      sortValue: (r) => r.pendingQty,
      render: (r) => `<span class="font-medium ${r.pendingQty > 0 ? 'text-rose-600' : 'text-slate-700'}">${r.pendingQty} 卷</span>`,
    },
    {
      key: 'actions',
      title: '操作',
      width: 250,
      required: true,
      actionColumn: true,
      render: (r) => `<div class="flex items-center gap-1"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${event}-action="row-print" data-${event}-idx="${options.rows.indexOf(r)}">打印配料</button><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${event}-action="toggle-detail" data-${event}-idx="${options.rows.indexOf(r)}">明细</button><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${event}-action="row-remark" data-${event}-idx="${options.rows.indexOf(r)}">备注</button><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${event}-action="row-flow" data-${event}-idx="${options.rows.indexOf(r)}">配料流水</button></div>`,
    },
  )
  return columns
}

/** 裁片配料 All 型页面构建器：老中转仓与新中转仓同构，仅范围与数据不同。 */
export function createCuttingAllPage(options: CuttingAllOptions) {
  const event = options.eventPrefix
  const dataPrefix = event.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase())
  let expandedIdx = -1
  let remarkIdx = -1
  let flowIdx = -1
  let remarkDraft = ''

  const renderDetail = (ctx: TransitOnlineListContext<TransitOnlineCuttingAllRow>): string => {
    const row = ctx.rows[expandedIdx]
    if (!row) return ''
    const groups = new Map<string, typeof row.details>()
    row.details.forEach((detail) => {
      const list = groups.get(detail.materialType) ?? []
      list.push(detail)
      groups.set(detail.materialType, list)
    })
    const sections = [...groups.entries()]
      .map(
        ([materialType, details]) => `<div class="mb-2">
          <p class="mb-1 text-xs font-medium text-slate-600">${escapeHtml(materialType)}</p>
          <table class="w-full table-fixed border-collapse">
            <thead><tr class="border-b text-left text-xs text-muted-foreground"><th class="px-2 py-1.5">SKU</th><th class="px-2 py-1.5">名称</th><th class="px-2 py-1.5">来源</th><th class="px-2 py-1.5">印染状态</th><th class="px-2 py-1.5 text-right">库存</th><th class="px-2 py-1.5 text-right">计划</th><th class="px-2 py-1.5 text-right">配料</th><th class="px-2 py-1.5 text-right">待配</th></tr></thead>
            <tbody>${details
              .map(
                (detail) =>
                  `<tr class="border-b last:border-b-0"><td class="px-2 py-1.5 font-mono text-xs">${escapeHtml(detail.sku)}</td><td class="px-2 py-1.5 text-xs">${escapeHtml(detail.name)}</td><td class="px-2 py-1.5 text-xs">${escapeHtml(detail.source)}</td><td class="px-2 py-1.5 text-xs">${escapeHtml(detail.dyeStatus)}</td><td class="px-2 py-1.5 text-right text-xs">${detail.inventory} 卷</td><td class="px-2 py-1.5 text-right text-xs">${detail.planQty} 卷</td><td class="px-2 py-1.5 text-right text-xs">${detail.allocationQty} 卷</td><td class="px-2 py-1.5 text-right text-xs">${detail.pendingQty} 卷</td></tr>`,
              )
              .join('')}</tbody>
          </table>
        </div>`,
      )
      .join('')
    return `<div class="border-t bg-slate-50/70 px-3 py-3" data-${event}-detail>
      <p class="mb-2 text-xs font-medium text-slate-600">配料单 ${escapeHtml(row.allocationNo)} · 任务 ${escapeHtml(row.taskNo)} · 生产单 ${escapeHtml(row.productionNo)}</p>
      ${sections}
      ${row.remark ? `<p class="text-xs text-slate-500">备注：${escapeHtml(row.remark)}</p>` : ''}
    </div>`
  }

  const renderRemarkDialog = (): string => {
    const row = remarkIdx >= 0 ? options.rows[remarkIdx] : null
    const content = `<div class="space-y-2">
      <p class="text-xs text-muted-foreground">配料单 ${escapeHtml(row?.allocationNo ?? '')}</p>
      <textarea class="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="填写备注" data-${event}-field="remark-draft" data-skip-page-rerender="true">${escapeHtml(remarkDraft)}</textarea>
    </div>`
    return renderFormDialog(
      {
        title: '配料备注',
        closeAction: { prefix: event, action: 'close-remark' },
        submitAction: { prefix: event, action: 'save-remark', label: '保存备注' },
        width: 'lg',
      },
      content,
    )
  }

  const renderFlowDialog = (): string => {
    const row = flowIdx >= 0 ? options.rows[flowIdx] : null
    const flows = row
      ? [
          { time: `${row.allocationNo.slice(-3)} 10:12`, action: '生成配料单', qty: `${row.planQty} 卷` },
          { time: `${row.allocationNo.slice(-3)} 10:40`, action: '作业区配料', qty: `${row.allocationQty} 卷` },
          { time: `${row.allocationNo.slice(-3)} 11:05`, action: '领取', qty: `${row.pickupQty} 卷` },
          { time: `${row.allocationNo.slice(-3)} 11:30`, action: '待配确认', qty: `${row.pendingQty} 卷` },
        ]
      : []
    const content = `<div class="max-h-[50vh] overflow-y-auto"><table class="w-full table-fixed border-collapse text-xs">
      <thead><tr class="border-b text-left text-muted-foreground"><th class="px-2 py-1.5">时间</th><th class="px-2 py-1.5">动作</th><th class="px-2 py-1.5 text-right">数量</th></tr></thead>
      <tbody>${flows.map((flow) => `<tr class="border-b last:border-b-0"><td class="px-2 py-1.5">${escapeHtml(flow.time)}</td><td class="px-2 py-1.5">${escapeHtml(flow.action)}</td><td class="px-2 py-1.5 text-right">${escapeHtml(flow.qty)}</td></tr>`).join('')}</tbody>
    </table></div>`
    return renderDialog({ title: `配料流水 · ${row?.allocationNo ?? ''}`, closeAction: { prefix: event, action: 'close-flow' }, width: 'lg' }, content)
  }

  const definition: TransitOnlineListDefinition<TransitOnlineCuttingAllRow> = {
    eventPrefix: event,
    preferenceKey: options.preferenceKey,
    title: options.title,
    listTitle: options.listTitle,
    columns: buildColumns(options),
    rows: options.rows,
    emptyText: '暂无配料单',
    defaultFrozenKeys: ['sku'],
    exportFileName: options.listTitle,
    description: options.description,
    primaryActionsHtml: () =>
      `<div class="flex flex-wrap items-center gap-2">${renderPrimaryButton('备注', { prefix: event, action: 'open-remark' }, 'message-square')}${renderSecondaryButton('查看配料流水', { prefix: event, action: 'open-flow' }, 'history')}</div>`,
    searches: [
      { name: 'keyword', label: '关键词', placeholder: '请输入关键词', wide: true },
      { name: 'createdFrom', label: '创建时间起', placeholder: '创建时间起', type: 'date' },
      { name: 'createdTo', label: '创建时间止', placeholder: '创建时间止', type: 'date' },
      { name: 'prepFrom', label: '首次配料时间起', placeholder: '首次配料时间起', type: 'date' },
      { name: 'prepTo', label: '首次配料时间止', placeholder: '首次配料时间止', type: 'date' },
      { name: 'pickFrom', label: '首次领料时间起', placeholder: '首次领料时间起', type: 'date' },
      { name: 'pickTo', label: '首次领料时间止', placeholder: '首次领料时间止', type: 'date' },
      { name: 'demandFrom', label: '需求单创建时间起', placeholder: '需求单创建时间起', type: 'date' },
      { name: 'demandTo', label: '需求单创建时间止', placeholder: '需求单创建时间止', type: 'date' },
      { name: 'productionFrom', label: '生产单创建时间起', placeholder: '生产单创建时间起', type: 'date' },
      { name: 'productionTo', label: '生产单创建时间止', placeholder: '生产单创建时间止', type: 'date' },
    ],
    selects: [
      { name: 'factoryId', label: '工厂', options: options.factoryOptions },
      { name: 'cuttingFactory', label: '裁床工厂', options: options.cuttingFactoryOptions },
      { name: 'searchField', label: '搜索字段', options: ['全部', '任务单号', '配料单号', '生产单号', '需求单号', 'SPU', '面辅料SKU', '面辅料spu'] },
      { name: 'sellType', label: '售卖类型', options: SELL_TYPE_OPTIONS },
      { name: 'dyeDemand', label: '染印需求', options: DYE_DEMAND_OPTIONS },
      { name: 'hasSupplement', label: '是否包含补料', options: ['全部', '是', '否'] },
      { name: 'materialIsFull', label: '物料是否齐全', options: ['全部', '齐全', '不齐全'] },
      { name: 'isAccessoryCut', label: '是否是辅料裁片', options: ['全部', '是', '否'] },
      { name: 'disassembleStatus', label: '拆解状态', options: ['全部', '未拆解', '已拆解'] },
      { name: 'allocationStatus', label: '配料状态', options: ALLOCATION_STATUS_OPTIONS },
      { name: 'pickupStatus', label: '领料状态', options: PICKUP_STATUS_OPTIONS },
      { name: 'sortField', label: '排序字段', options: ['默认', '需求单创建时间'] },
      { name: 'sort', label: '排序方式', options: ['升序', '降序'] },
    ],
    stats: (rows) => [
      { label: '记录数', value: `${rows.length} 条` },
      { label: '待配合计', value: `${rows.reduce((sum, r) => sum + r.pendingQty, 0)} 卷` },
      { label: '需补料', value: `${rows.filter((r) => r.hasSupplement === '是').length} 条` },
    ],
    matches: (row, query) => {
      const keyword = (query.searches.keyword ?? '').trim().toLowerCase()
      if (keyword) {
        const field = query.selects.searchField ?? ''
        const map: Record<string, string> = {
          任务单号: row.taskNo,
          配料单号: row.allocationNo,
          生产单号: row.productionNo,
          需求单号: row.demandNo,
          SPU: row.spu,
          面辅料SKU: row.sku,
          面辅料spu: row.spu,
        }
        const haystack = field ? map[field] ?? '' : `${row.taskNo} ${row.allocationNo} ${row.productionNo} ${row.demandNo} ${row.spu} ${row.sku} ${row.name}`
        if (!haystack.toLowerCase().includes(keyword)) return false
      }
      if (query.selects.hasSupplement && query.selects.hasSupplement !== row.hasSupplement) return false
      if (query.selects.materialIsFull && query.selects.materialIsFull !== row.materialIsFull) return false
      if (query.selects.isAccessoryCut && query.selects.isAccessoryCut !== row.isAccessoryCut) return false
      if (query.selects.disassembleStatus && query.selects.disassembleStatus !== row.disassembleStatus) return false
      if (query.selects.sellType && query.selects.sellType !== row.sellType) return false
      if (query.selects.dyeDemand && query.selects.dyeDemand !== row.dyeDemand) return false
      if (query.selects.allocationStatus && query.selects.allocationStatus !== allocationStatusOf(row)) return false
      if (query.selects.pickupStatus && query.selects.pickupStatus !== pickupStatusOf(row)) return false
      if (query.selects.cuttingFactory && query.selects.cuttingFactory !== row.cuttingFactory) return false
      if (!cuttingAllInRange(row.createdAt, query.searches.createdFrom ?? '', query.searches.createdTo ?? '')) return false
      if (!cuttingAllInRange(row.prepAt, query.searches.prepFrom ?? '', query.searches.prepTo ?? '')) return false
      if (!cuttingAllInRange(row.pickAt, query.searches.pickFrom ?? '', query.searches.pickTo ?? '')) return false
      if (!cuttingAllInRange(row.demandAt, query.searches.demandFrom ?? '', query.searches.demandTo ?? '')) return false
      if (!cuttingAllInRange(row.productionAt, query.searches.productionFrom ?? '', query.searches.productionTo ?? '')) return false
      return true
    },
    extraTableHtml: (ctx) => (expandedIdx >= 0 ? renderDetail(ctx) : ''),
    overlaysHtml: () => [remarkIdx >= 0 ? renderRemarkDialog() : '', flowIdx >= 0 ? renderFlowDialog() : ''].join(''),
    onField: (name, element) => {
      if (name === 'remark-draft') {
        remarkDraft = element.value
        return true
      }
      return false
    },
    onAction: (action, node, ctx) => {
      if (action === 'row-print') {
        const idx = Number(node.dataset[`${dataPrefix}Idx`])
        const row = ctx.rows[idx]
        if (row) showListFeedback(`已生成配料单 ${row.allocationNo} 的打印配料任务`)
        return true
      }
      if (action === 'toggle-detail') {
        const idx = Number(node.dataset[`${dataPrefix}Idx`])
        expandedIdx = expandedIdx === idx ? -1 : idx
        return true
      }
      if (action === 'row-remark' || action === 'open-remark') {
        remarkIdx = action === 'row-remark' ? Number(node.dataset[`${dataPrefix}Idx`]) : expandedIdx
        if (remarkIdx < 0) {
          showListFeedback('请先展开一行配料单再填写备注', 'warning')
          return true
        }
        remarkDraft = ctx.rows[remarkIdx]?.remark ?? ''
        return true
      }
      if (action === 'close-remark') {
        remarkIdx = -1
        return true
      }
      if (action === 'save-remark') {
        const row = ctx.rows[remarkIdx]
        if (row) {
          row.remark = remarkDraft.trim()
          showListFeedback(`配料单 ${row.allocationNo} 备注已保存`)
        }
        remarkIdx = -1
        return true
      }
      if (action === 'row-flow' || action === 'open-flow') {
        flowIdx = action === 'row-flow' ? Number(node.dataset[`${dataPrefix}Idx`]) : expandedIdx
        if (flowIdx < 0) {
          showListFeedback('请先展开一行配料单再查看配料流水', 'warning')
          return true
        }
        return true
      }
      if (action === 'close-flow') {
        flowIdx = -1
        return true
      }
      return false
    },
  }
  return createStandardListPage(definition)
}

const page = createCuttingAllPage({
  eventPrefix: 'wls-online-hilon-cutting-all',
  preferenceKey: '/wls/online/hilon-cutting-all:list-columns',
  title: '裁片配料（全部）· 老中转仓 Hilon',
  listTitle: '裁片配料单',
  rows: hilonCuttingAllSeed,
  factoryOptions: ['全部', '老中转仓 Hilon'],
  cuttingFactoryOptions: cuttingAllCuttingFactoryOptions,
  description: '只读展示裁片配料明细，可打印配料、查看配料流水。',
  showMaterialType: false,
})

export function renderTransitOnlineHilonCuttingAllPage(): string {
  return page.render()
}

export function handleTransitOnlineHilonCuttingAllEvent(target: HTMLElement, event?: Event): boolean {
  return page.handle(target, event)
}

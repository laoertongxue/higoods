// @page-pattern: list

import { renderStandardListPage } from '../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../components/ui/list-table-model.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import { listProductionContracts } from '../data/fcs/production-contracts.ts'
import {
  addNaturalDays,
  projectProductionOrderReturnSummary,
  type ProductionOrderReturnListStatus,
  type ProductionOrderReturnSummary,
} from '../data/fcs/production-return-fulfillment.ts'
import {
  ensureProductionReturnProgressMockFacts,
  PRODUCTION_RETURN_PROGRESS_DEMO_TODAY,
} from '../data/fcs/production-return-progress-mock.ts'
import { escapeHtml } from '../utils.ts'

type RiskLevel = '高风险' | '中风险' | '低风险' | '无风险'

interface FactoryReturnProgress {
  assignmentId: string
  factoryId: string
  factoryName: string
  taskName: string
  assignedQty: number
  returnedQty: number
  contractNo?: string
  contractId?: string
  scanCount: number
  ruleLabel: string
  milestones: Array<{
    day: number
    ratio: number
    targetQty: number
    deadline: string
    confirmedQty: number
    status: '已达成' | '明日到期' | '今日到期' | '已逾期' | '未到期'
    reminderState: string
  }>
}

interface OnlineProductionProgressRecord {
  productionOrderId: string
  productionOrderNo: string
  demandNo: string
  spu: string
  title: string
  imageUrl: string
  sampleType: '首单' | '翻单'
  saleType: '预售' | '现货'
  difficulty: string
  qty: number
  materialPercent: number
  cuttingPercent: number
  registrationPercent: number
  inboundPercent: number
  cutReadyQty: number
  cutCompletedQty: number
  registeredQty: number
  inboundQty: number
  qcQualifiedQty: number
  qcReworkQty: number
  status: '生产中' | '待生产' | '已完成'
  breakdownStatus: string
  riskLevel: RiskLevel
  techPackVersion: string
  sewingFactories: string[]
  orderAt: string
  breakdownAt?: string
  firstMaterialAt: string
  firstPickupAt?: string
  cuttingStartedAt?: string
  cuttingCompletedAt?: string
  sewingAssignedAt?: string
  firstRegistrationAt?: string
  firstInboundAt?: string
  dyePrintRows: Array<{ type: '染色' | '印花'; no: string; sku: string; qty: number; status: string }>
  procurementRows: Array<{ no: string; sku: string; status: string }>
  inventoryRows: Array<{ sku: string; required: number; stock: number; unit: string }>
  returnProgress: FactoryReturnProgress[]
  returnSummary: ProductionOrderReturnSummary
  returnExpectation: 'STAGED' | 'BIDDING' | 'NONE'
}

interface ProgressTrackingState {
  keyword: string
  sampleType: string
  status: string
  riskLevel: string
  hasNode: string
  sewingAssigned: string
  saleType: string
  dyeStatus: string
  printStatus: string
  cuttingStatus: string
  deliveryStart: string
  deliveryEnd: string
  createStart: string
  createEnd: string
  qtyMin: string
  qtyMax: string
  returnStatus: ProductionOrderReturnListStatus | ''
  contractStatus: string
  page: number
  pageSize: number
  expandedOrderId: string | null
  detailOrderId: string | null
  imagePreview: { url: string; label: string } | null
}

const state: ProgressTrackingState = {
  keyword: '', sampleType: '', status: '', riskLevel: '', hasNode: '', sewingAssigned: '', saleType: '',
  dyeStatus: '', printStatus: '', cuttingStatus: '', deliveryStart: '', deliveryEnd: '', createStart: '', createEnd: '',
  qtyMin: '', qtyMax: '', returnStatus: '', contractStatus: '', page: 1, pageSize: 20, expandedOrderId: null, detailOrderId: null, imagePreview: null,
}

const IMAGE_URLS = ['/shirt-sample.jpg', '/dress-sample-1.jpg', '/cardigan-sample.jpg', '/tshirt-sample.jpg', '/pants-sample.jpg', '/lace-dress-sample.jpg', '/jacket-sample.jpg', '/denim-shorts-sample.jpg']

function mapReturnProgress(summary: ProductionOrderReturnSummary): FactoryReturnProgress[] {
  const tomorrow = addNaturalDays(PRODUCTION_RETURN_PROGRESS_DEMO_TODAY, 1)
  return summary.assignments.map((assignment) => {
    const snapshot = assignment.projection.snapshot
    const ruleLabel = snapshot.milestones.map((item) => `第${item.naturalDay}天≥${Math.round(item.ratio * 100)}%`).join('，')
    return {
      assignmentId: snapshot.assignmentId,
      factoryId: snapshot.factoryId,
      factoryName: snapshot.factoryName,
      taskName: snapshot.fulfillmentRuleCode === 'SEWING_ONLY' ? '独立车缝' : snapshot.fulfillmentRuleCode === 'SEWING_TO_IRON_PACK' ? '车缝+烫包' : '裁剪+车缝+烫包',
      assignedQty: snapshot.assignedQty,
      returnedQty: assignment.projection.confirmedReturnedQty,
      scanCount: 0,
      ruleLabel,
      milestones: assignment.projection.milestones.map((item) => ({
        day: item.naturalDay,
        ratio: item.ratio,
        targetQty: item.targetQty,
        deadline: item.deadlineDate,
        confirmedQty: item.confirmedQtyByDeadline,
        status: item.status === 'REACHED' ? '已达成' : item.status === 'OVERDUE' ? '已逾期' : item.status === 'DUE_TODAY' ? '今日到期' : item.deadlineDate === tomorrow ? '明日到期' : '未到期',
        reminderState: item.ratio === assignment.focusMilestone.ratio ? assignment.reminderState : item.status === 'REACHED' ? '节点已达成，无需提醒' : '尚未到提醒时间',
      })),
    }
  })
}

ensureProductionReturnProgressMockFacts()

const orders: OnlineProductionProgressRecord[] = Array.from({ length: 43 }, (_, index) => {
  const qty = [800, 1000, 309, 300, 786, 661, 703, 748, 600, 1163][index % 10]
  const poNo = `PO${16234 - index}`
  const dye = index % 3 === 0
  const print = index % 3 !== 0
  const returnExpectation: OnlineProductionProgressRecord['returnExpectation'] = index === 4 ? 'BIDDING' : index <= 3 ? 'STAGED' : 'NONE'
  const returnSummary = projectProductionOrderReturnSummary({
    productionOrderId: poNo,
    today: PRODUCTION_RETURN_PROGRESS_DEMO_TODAY,
    expectedStagedReturn: returnExpectation === 'STAGED',
    bidding: returnExpectation === 'BIDDING',
  })
  const returnProgress = mapReturnProgress(returnSummary)
  return {
    productionOrderId: poNo,
    productionOrderNo: poNo,
    demandNo: String(336627 - index * 12),
    spu: ['CHCKL26070978', 'ASYZZ26071566', 'MODXU26070614', 'ASYZZ26050573'][index % 4],
    title: ['棉混纺女装上衣', '印花连衣裙', '休闲针织开衫', '基础款T恤'][index % 4],
    imageUrl: IMAGE_URLS[index % IMAGE_URLS.length],
    sampleType: index < 4 ? '首单' : '翻单',
    saleType: index % 6 === 0 ? '现货' : '预售',
    difficulty: ['B', 'D', 'C', 'A+'][index % 4],
    qty,
    materialPercent: 50,
    cuttingPercent: index % 6 === 0 ? 70 : 0,
    registrationPercent: index % 8 === 0 ? 32 : 0,
    inboundPercent: index % 9 === 0 ? 18 : 0,
    cutReadyQty: index % 6 === 0 ? Math.ceil(qty * .7) : 0,
    cutCompletedQty: index % 6 === 0 ? Math.ceil(qty * .55) : 0,
    registeredQty: index % 8 === 0 ? Math.ceil(qty * .32) : 0,
    inboundQty: index % 9 === 0 ? Math.ceil(qty * .18) : 0,
    qcQualifiedQty: index % 9 === 0 ? Math.ceil(qty * .15) : 0,
    qcReworkQty: index % 11 === 0 ? 3 : 0,
    status: '生产中',
    breakdownStatus: index % 5 === 0 ? '已拆解' : '未拆解',
    riskLevel: (['高风险', '中风险', '低风险', '无风险'] as RiskLevel[])[index % 4],
    techPackVersion: `v1.${index % 5}`,
    sewingFactories: returnProgress.map((item) => item.factoryName),
    orderAt: `2026-08-04 ${String(9 - Math.floor(index / 8)).padStart(2, '0')}:${String((54 - index * 3 + 60) % 60).padStart(2, '0')}:11`,
    firstMaterialAt: `2026-08-04 ${String(9 - Math.floor(index / 8)).padStart(2, '0')}:${String((54 - index * 3 + 60) % 60).padStart(2, '0')}:12`,
    sewingAssignedAt: returnSummary.primary ? `${returnSummary.primary.projection.snapshot.assignmentDate} 10:20:00` : undefined,
    firstRegistrationAt: index % 8 === 0 ? '2026-08-04 15:10:00' : undefined,
    firstInboundAt: index % 9 === 0 ? '2026-08-05 08:30:00' : undefined,
    dyePrintRows: [
      ...(dye ? [{ type: '染色' as const, no: `RS${3837 - index}`, sku: `IDFL25${1038 + index}-beige`, qty: qty * 2, status: index % 5 === 0 ? '生产中' : '等待处理' }] : []),
      ...(print ? [{ type: '印花' as const, no: `YH${25086 - index}`, sku: `CNIDML076-${poNo.toLowerCase()}`, qty: Math.ceil(qty * 1.7), status: index % 4 === 0 ? '等打印' : '测试花型样品' }] : []),
    ],
    procurementRows: index % 4 === 1 ? [] : [{ no: String(36548 + index), sku: `FLSZ${24870 + index}`, status: '采购中' }],
    inventoryRows: [
      { sku: 'FLSZ24116-white', required: qty, stock: 654056, unit: '米' },
      { sku: `WLID009-${index % 2 ? 'asaya' : 'chicmore'}`, required: qty, stock: index % 5 === 0 ? Math.ceil(qty * .8) : 27561, unit: '件' },
    ],
    returnProgress,
    returnSummary,
    returnExpectation,
  }
})

function filterOrders(): OnlineProductionProgressRecord[] {
  const keyword = state.keyword.trim().toLowerCase()
  const min = state.qtyMin ? Number(state.qtyMin) : null
  const max = state.qtyMax ? Number(state.qtyMax) : null
  return orders.filter((order) => (
    (!keyword || [order.productionOrderNo, order.spu].some((value) => value.toLowerCase().includes(keyword)))
    && (!state.sampleType || order.sampleType === state.sampleType)
    && (!state.status || order.status === state.status)
    && (!state.riskLevel || order.riskLevel === state.riskLevel)
    && (!state.hasNode || (state.hasNode === 'YES' ? order.cutReadyQty > 0 || order.registeredQty > 0 : order.cutReadyQty === 0 && order.registeredQty === 0))
    && (!state.sewingAssigned || (state.sewingAssigned === 'YES' ? order.sewingFactories.length > 0 : order.sewingFactories.length === 0))
    && (!state.saleType || order.saleType === state.saleType)
    && (!state.dyeStatus || order.dyePrintRows.some((item) => item.type === '染色' && item.status === state.dyeStatus))
    && (!state.printStatus || order.dyePrintRows.some((item) => item.type === '印花' && item.status === state.printStatus))
    && (!state.cuttingStatus || (state.cuttingStatus === 'READY' ? order.cutReadyQty > 0 : order.cutReadyQty === 0))
    && (!state.deliveryStart || Boolean(order.sewingAssignedAt && order.sewingAssignedAt.slice(0, 10) >= state.deliveryStart))
    && (!state.deliveryEnd || Boolean(order.sewingAssignedAt && order.sewingAssignedAt.slice(0, 10) <= state.deliveryEnd))
    && (!state.createStart || order.orderAt.slice(0, 10) >= state.createStart)
    && (!state.createEnd || order.orderAt.slice(0, 10) <= state.createEnd)
    && (!state.returnStatus || order.returnSummary.status === state.returnStatus)
    && (!state.contractStatus || order.returnProgress.some((progress) => state.contractStatus === 'SIGNED' ? progress.scanCount > 0 : state.contractStatus === 'MISSING_SCAN' ? Boolean(progress.contractNo && progress.scanCount === 0) : state.contractStatus === 'NOT_APPLICABLE' ? !progress.contractNo : false))
    && (min == null || order.qty >= min)
    && (max == null || order.qty <= max)
  ))
}

function riskTone(risk: RiskLevel): string {
  if (risk === '高风险') return 'bg-red-50 text-red-700 border-red-200'
  if (risk === '中风险') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (risk === '低风险') return 'bg-blue-50 text-blue-700 border-blue-200'
  return 'bg-green-50 text-green-700 border-green-200'
}

function compactProgress(label: string, value: number): string {
  return `<div><div class="flex justify-between text-[11px]"><span>${label}</span><b>${value}%</b></div><div class="h-1.5 rounded bg-slate-100"><i class="block h-full rounded bg-emerald-500" style="width:${value}%"></i></div></div>`
}

function highestReturnRisk(row: OnlineProductionProgressRecord): { label: string; tone: string; progress?: FactoryReturnProgress; node?: FactoryReturnProgress['milestones'][number] } | null {
  const summary = row.returnSummary
  const tone = summary.status === 'DATA_INCOMPLETE' || summary.status === 'OVERDUE'
    ? 'border-red-200 bg-red-50 text-red-700'
    : summary.status === 'DUE_TODAY'
      ? 'border-orange-200 bg-orange-50 text-orange-700'
      : summary.status === 'DUE_TOMORROW'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : summary.status === 'REACHED'
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-blue-200 bg-blue-50 text-blue-700'
  if (!summary.primary) return { label: summary.statusLabel, tone }
  const progress = row.returnProgress.find((item) => item.assignmentId === summary.primary?.projection.snapshot.assignmentId)
  const node = progress?.milestones.find((item) => item.ratio === summary.primary?.focusMilestone.ratio)
  return { label: summary.statusLabel, tone, progress, node }
}

function renderReturnListCell(row: OnlineProductionProgressRecord): string {
  const summary = row.returnSummary
  const fulfillment = highestReturnRisk(row)
  if (!summary.primary || !fulfillment?.progress || !fulfillment.node) {
    return `<button class="w-full rounded border p-2 text-left text-xs ${fulfillment?.tone || 'border-slate-200'}" data-progress-action="view-return" data-order-id="${row.productionOrderId}"><b>${escapeHtml(summary.statusLabel)}</b><p class="mt-1 text-muted-foreground">${escapeHtml(summary.message || '查看回货履约详情')}</p></button>`
  }
  const milestone = summary.primary.focusMilestone
  const shortage = Math.max(0, milestone.targetQty - milestone.confirmedQtyByDeadline)
  return `<button class="w-full rounded border p-2 text-left text-xs ${fulfillment.tone}" data-progress-action="view-return" data-order-id="${row.productionOrderId}"><div class="flex justify-between gap-2"><b>${escapeHtml(summary.statusLabel)}</b><span>${escapeHtml(fulfillment.progress.factoryName)}</span></div><p class="mt-1">第${milestone.naturalDay}自然日 · ${Math.round(milestone.ratio * 100)}% · 截止 ${milestone.deadlineDate}</p><p>应回 ${milestone.targetQty}件 · 按期确认 ${milestone.confirmedQtyByDeadline}件 · 缺 ${shortage}件</p><p class="mt-1 font-medium">${escapeHtml(summary.primary.reminderState)}</p>${summary.additionalFactoryCount || summary.additionalRiskNodeCount ? `<p class="mt-1 text-muted-foreground">另有 ${summary.additionalFactoryCount} 家工厂、${summary.additionalRiskNodeCount} 个未达成节点，点击查看全部</p>` : ''}</button>`
}

const columns: StandardListColumn<OnlineProductionProgressRecord>[] = [
  { key: 'base', title: '基础信息', width: 230, required: true, freezeable: true, render: (row) => `<div class="flex gap-2"><button data-progress-action="preview-image" data-url="${row.imageUrl}" data-label="${escapeHtml(row.spu)}"><img src="${row.imageUrl}" alt="${escapeHtml(row.spu)}款式实拍图" class="h-16 w-14 rounded border object-cover"/></button><div class="text-xs"><b>Spu：${escapeHtml(row.spu)}</b><p>生产单：<span class="text-blue-600">${escapeHtml(row.productionOrderNo)}</span></p><p>需求单：<span class="text-blue-600">${escapeHtml(row.demandNo)}</span></p><p class="mt-1"><span class="rounded bg-orange-50 px-1 text-orange-600">${row.sampleType}</span> <span class="rounded bg-blue-50 px-1 text-blue-600">${row.saleType}</span></p><p>做货难度：${escapeHtml(row.difficulty)}</p></div></div>` },
  { key: 'process', title: '工序进度', width: 150, render: (row) => `<div class="space-y-1">${compactProgress('配料进度', row.materialPercent)}${compactProgress('裁片进度', row.cuttingPercent)}${compactProgress('登记进度', row.registrationPercent)}${compactProgress('入库进度', row.inboundPercent)}</div>` },
  { key: 'flow', title: '数据流转', width: 150, render: (row) => `<div class="grid grid-cols-2 gap-x-2 text-xs"><span>计划</span><b>${row.qty}</b><span>裁片齐套</span><b>${row.cutReadyQty}</b><span>裁片完成</span><b>${row.cutCompletedQty}</b><span>登记</span><b>${row.registeredQty}</b><span>入库</span><b>${row.inboundQty}</b><span>QC合格</span><b class="text-green-600">${row.qcQualifiedQty}</b><span>返工</span><b class="text-orange-600">${row.qcReworkQty}</b></div>` },
  { key: 'status', title: '状态', width: 155, render: (row) => `<span class="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">${row.status}</span><p class="mt-2 text-xs">拆解：${row.breakdownStatus}</p><span class="mt-2 inline-flex rounded border px-2 py-0.5 text-xs ${riskTone(row.riskLevel)}">${row.riskLevel}</span><p class="mt-1 text-xs">技术包：${row.techPackVersion}</p>` },
  { key: 'factory', title: '加工厂 / 回货履约', width: 290, render: renderReturnListCell },
  { key: 'time', title: '时间', width: 225, render: (row) => `<dl class="grid grid-cols-[74px_1fr] gap-x-2 text-[11px]"><dt>生产下单</dt><dd>${row.orderAt}</dd><dt>拆解</dt><dd>${row.breakdownAt || '-'}</dd><dt>首次配料</dt><dd>${row.firstMaterialAt}</dd><dt>首次接收</dt><dd>${row.firstPickupAt || '-'}</dd><dt>裁片开始</dt><dd>${row.cuttingStartedAt || '-'}</dd><dt>裁片完成</dt><dd>${row.cuttingCompletedAt || '-'}</dd><dt>车缝派单</dt><dd>${row.sewingAssignedAt || '-'}</dd><dt>首次登记</dt><dd>${row.firstRegistrationAt || '-'}</dd><dt>首次入库</dt><dd>${row.firstInboundAt || '-'}</dd></dl>` },
  { key: 'dyePrint', title: '印染状态', width: 220, render: (row) => row.dyePrintRows.map((item) => `<div class="mb-2 flex gap-2 rounded border p-2 text-[11px]"><button data-progress-action="preview-image" data-url="/materials/fabric-main.jpg" data-label="${escapeHtml(item.sku)}"><img src="/materials/fabric-main.jpg" alt="${escapeHtml(item.sku)}物料实拍图" class="h-10 w-10 rounded object-cover"/></button><div><b>${item.type} <span class="text-blue-600">${item.no}</span></b><p>Sku：${escapeHtml(item.sku)}</p><p>0/${item.qty} <span class="rounded bg-orange-50 px-1 text-orange-600">${item.status}</span></p></div></div>`).join('') || '<span class="text-xs">无</span>' },
  { key: 'procurement', title: '物料采购', width: 175, render: (row) => row.procurementRows.map((item) => `<div class="mb-2 rounded border p-2 text-[11px]"><p>采购单：<span class="text-blue-600">${item.no}</span> <span class="rounded bg-orange-50 px-1 text-orange-600">${item.status}</span></p><p>Sku：${escapeHtml(item.sku)}</p></div>`).join('') || '<span class="text-xs">无采购单</span>' },
  { key: 'inventory', title: '库存物料', width: 210, render: (row) => row.inventoryRows.map((item, index) => `<div class="mb-2 flex gap-2 text-[11px]"><button data-progress-action="preview-image" data-url="${index ? '/materials/accessory-label.jpg' : '/materials/fabric-main.jpg'}" data-label="${escapeHtml(item.sku)}"><img src="${index ? '/materials/accessory-label.jpg' : '/materials/fabric-main.jpg'}" alt="${escapeHtml(item.sku)}物料实拍图" class="h-9 w-9 rounded object-cover"/></button><div><b>${escapeHtml(item.sku)}</b><p>需${item.required}${item.unit} / 库 <span class="${item.stock < item.required ? 'text-red-600' : 'text-green-600'}">${item.stock}</span></p></div></div>`).join('') },
  { key: 'actions', title: '操作', width: 88, required: true, actionColumn: true, render: (row) => `<div class="space-y-2 text-sm"><button class="block text-blue-600" data-progress-action="detail" data-order-id="${row.productionOrderId}">详情</button><button class="block text-blue-600" data-progress-action="expand" data-order-id="${row.productionOrderId}">${state.expandedOrderId === row.productionOrderId ? '收起' : '展开'}</button></div>` },
]

const preferences: StandardListColumnPreferences = { order: columns.filter((item) => !item.actionColumn).map((item) => item.key), visibleKeys: columns.map((item) => item.key), frozenKeys: ['base'], pageSize: 20 }

function selectOptions(values: string[], selected: string, placeholder = '全部'): string {
  return `<option value="">${placeholder}</option>${values.map((value) => `<option value="${escapeHtml(value)}" ${selected === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}`
}

function renderReturnStatusOptions(): string {
  const options: Array<[ProductionOrderReturnListStatus, string]> = [
    ['DATA_INCOMPLETE', '履约数据不完整'],
    ['OVERDUE', '已逾期'],
    ['DUE_TODAY', '今日到期'],
    ['DUE_TOMORROW', '明日到期'],
    ['UPCOMING', '即将到期'],
    ['REACHED', '已达成'],
    ['NO_RULE', '无分阶段回货规则'],
    ['BIDDING', '竞价中'],
  ]
  return `<option value="">全部</option>${options.map(([value, label]) => `<option value="${value}" ${state.returnStatus === value ? 'selected' : ''}>${label}</option>`).join('')}`
}

function renderFilters(): string {
  return `<div class="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
    <label class="text-xs">生产单号/SPU<input class="mt-1 h-9 w-full rounded border px-2" data-progress-field="keyword" value="${escapeHtml(state.keyword)}" placeholder="生产单号/SPU"/></label>
    <label class="text-xs">起版<select class="mt-1 h-9 w-full rounded border px-2" data-progress-field="sampleType">${selectOptions(['首单','翻单'], state.sampleType)}</select></label>
    <label class="text-xs">状态<select class="mt-1 h-9 w-full rounded border px-2" data-progress-field="status">${selectOptions(['生产中','待生产','已完成'], state.status)}</select></label>
    <label class="text-xs">风险等级<select class="mt-1 h-9 w-full rounded border px-2" data-progress-field="riskLevel">${selectOptions(['高风险','中风险','低风险','无风险'], state.riskLevel)}</select></label>
    <label class="text-xs">是否有节点<select class="mt-1 h-9 w-full rounded border px-2" data-progress-field="hasNode">${selectOptions(['YES','NO'], state.hasNode, '全部')}</select></label>
    <label class="text-xs">车缝是否分配<select class="mt-1 h-9 w-full rounded border px-2" data-progress-field="sewingAssigned">${selectOptions(['YES','NO'], state.sewingAssigned, '全部')}</select></label>
    <label class="text-xs">售卖类型<select class="mt-1 h-9 w-full rounded border px-2" data-progress-field="saleType">${selectOptions(['预售','现货'], state.saleType, '请选择')}</select></label>
    <label class="text-xs">染色状态<select class="mt-1 h-9 w-full rounded border px-2" data-progress-field="dyeStatus">${selectOptions(['等待处理','生产中'], state.dyeStatus, '全部状态')}</select></label>
    <label class="text-xs">印花状态<select class="mt-1 h-9 w-full rounded border px-2" data-progress-field="printStatus">${selectOptions(['等打印','测试花型样品'], state.printStatus, '全部状态')}</select></label>
    <label class="text-xs">裁片单状态<select class="mt-1 h-9 w-full rounded border px-2" data-progress-field="cuttingStatus">${selectOptions(['READY','WAIT'], state.cuttingStatus, '请选择裁片单状态')}</select></label>
    <label class="text-xs">送去工厂时间<div class="mt-1 flex gap-1"><input type="date" class="h-9 min-w-0 rounded border px-1" data-progress-field="deliveryStart" value="${state.deliveryStart}"/><input type="date" class="h-9 min-w-0 rounded border px-1" data-progress-field="deliveryEnd" value="${state.deliveryEnd}"/></div></label>
    <label class="text-xs">生产下单时间<div class="mt-1 flex gap-1"><input type="date" class="h-9 min-w-0 rounded border px-1" data-progress-field="createStart" value="${state.createStart}"/><input type="date" class="h-9 min-w-0 rounded border px-1" data-progress-field="createEnd" value="${state.createEnd}"/></div></label>
    <label class="text-xs">下单数量<div class="mt-1 flex gap-1"><input type="number" class="h-9 min-w-0 rounded border px-2" data-progress-field="qtyMin" value="${state.qtyMin}" placeholder="最小值"/><input type="number" class="h-9 min-w-0 rounded border px-2" data-progress-field="qtyMax" value="${state.qtyMax}" placeholder="最大值"/></div></label>
    <label class="text-xs">回货履约<select class="mt-1 h-9 w-full rounded border px-2" data-progress-field="returnStatus">${renderReturnStatusOptions()}</select></label>
    <label class="text-xs">合同状态<select class="mt-1 h-9 w-full rounded border px-2" data-progress-field="contractStatus"><option value="">全部</option><option value="MISSING_SCAN" ${state.contractStatus === 'MISSING_SCAN' ? 'selected' : ''}>待上传签订扫描件</option><option value="SIGNED" ${state.contractStatus === 'SIGNED' ? 'selected' : ''}>已签订</option><option value="NOT_APPLICABLE" ${state.contractStatus === 'NOT_APPLICABLE' ? 'selected' : ''}>不适用</option></select></label>
    <div class="flex items-end"><button class="h-9 rounded border px-4 text-sm" data-progress-action="reset">重置</button></div>
  </div>`
}

function milestoneTone(status: FactoryReturnProgress['milestones'][number]['status']): string {
  if (status === '已逾期') return 'border-red-200 bg-red-50 text-red-700'
  if (status === '今日到期') return 'border-orange-300 bg-orange-50 text-orange-800'
  if (status === '明日到期') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (status === '已达成') return 'border-green-200 bg-green-50 text-green-700'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

function riskRank(progress: FactoryReturnProgress): number {
  if (progress.milestones.some((item) => item.status === '已逾期')) return 3
  if (progress.milestones.some((item) => item.status === '今日到期')) return 2
  if (progress.milestones.some((item) => item.status === '明日到期')) return 1
  return 0
}

function renderReturnProgress(order: OnlineProductionProgressRecord): string {
  const liveContracts = listProductionContracts({ productionOrderId: order.productionOrderId })
  const progressRows = [...order.returnProgress].sort((a, b) => riskRank(b) - riskRank(a))
  if (!progressRows.length) return `<div class="rounded border border-dashed p-5 text-sm text-muted-foreground"><b>${escapeHtml(order.returnSummary.statusLabel)}</b><p class="mt-1">${escapeHtml(order.returnSummary.message || '尚未产生需要阶段性回货跟踪的有效分配。')}</p><p class="mt-1">回货规则与是否生成合同分别判断。</p></div>`
  return `<div class="space-y-3"><p class="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">每个阶段性回货节点固定产生 3 次提醒：截止前1天提醒、截止当天提醒、逾期后首日警告；同一节点各类提醒只产生一次。</p>${progressRows.map((progress, index) => {
    const liveContract = liveContracts.find((contract) => contract.assignmentId === progress.assignmentId)
    const contractId = liveContract?.contractId || progress.contractId
    const scanCount = liveContract?.scans.length ?? progress.scanCount
    return `<article class="rounded-lg border ${index === 0 && riskRank(progress) > 0 ? 'border-red-300 shadow-sm' : ''}"><header class="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"><div><b>${escapeHtml(progress.factoryName)}</b><span class="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs">${escapeHtml(progress.taskName)}</span><p class="mt-1 text-xs text-muted-foreground">分配 ${progress.assignedQty}件 · 已确认回货 ${progress.returnedQty}件 · 仅累计本工厂/本分配记录</p></div><div class="flex gap-3 text-sm">${contractId ? `<a class="text-blue-600" target="_blank" href="/fcs/contracts/print?contractId=${encodeURIComponent(contractId)}">查看/打印合同</a>` : ''}${progress.contractNo ? `<span>合同：${escapeHtml(liveContract?.contractNo || progress.contractNo)}</span>` : '<span class="text-muted-foreground">合同状态按任务类型独立判断</span>'}<span class="${scanCount ? 'text-green-600' : 'text-amber-600'}">扫描图 ${scanCount} 张</span></div></header><div class="p-4"><p class="mb-3 text-sm"><b>回货规则：</b>${escapeHtml(progress.ruleLabel)}（自然日；分配日为第1天；合同不打印具体时间）</p><div class="grid gap-3 md:grid-cols-3">${progress.milestones.map((item) => `<div class="rounded border p-3 ${milestoneTone(item.status)}"><div class="flex justify-between"><b>第${item.day}自然日 · ${Math.round(item.ratio * 100)}%</b><span>${item.status}</span></div><p class="mt-2 text-sm">截止：${item.deadline}</p><p class="text-sm">应回 ${item.targetQty}件 · 按期确认 ${item.confirmedQty}件</p><p class="mt-2 text-xs font-semibold">${escapeHtml(item.reminderState)}</p></div>`).join('')}</div><p class="mt-3 text-xs text-muted-foreground">到货确认日期决定节点达成；质检、复检是流程节点，不改变到货确认日期。原工厂回货仍归原分配，不与新工厂互相抵扣。</p></div></article>`
  }).join('')}</div>`
}

function renderExpanded(order: OnlineProductionProgressRecord): string {
  return `<section class="mt-3 rounded-lg border bg-white" data-expanded-order="${order.productionOrderId}"><div class="grid divide-y lg:grid-cols-4 lg:divide-x lg:divide-y-0"><div class="p-4"><h3 class="font-semibold">生产单详情</h3><div class="mt-3 flex gap-3"><img src="${order.imageUrl}" alt="${escapeHtml(order.spu)}款式图" class="h-24 w-20 rounded object-cover"/><div class="text-xs"><b>${escapeHtml(order.title)}</b><p>${escapeHtml(order.spu)}</p><p>数量：${order.qty}件</p><p>售卖：${order.saleType}</p></div></div></div><div class="p-4"><h3 class="font-semibold">关键时间</h3><ol class="mt-3 space-y-2 text-xs"><li>生产下单 ${order.orderAt}</li><li>首次配料 ${order.firstMaterialAt}</li><li>车缝派单 ${order.sewingAssignedAt || '-'}</li><li>首次入库 ${order.firstInboundAt || '-'}</li></ol></div><div class="p-4"><h3 class="font-semibold">异常与提醒</h3><div class="mt-3 space-y-2 text-xs">${order.returnProgress.some((item) => riskRank(item) === 3) ? '<p class="rounded bg-red-50 p-2 text-red-700">阶段性回货逾期，请立即催回货</p>' : '<p class="rounded bg-green-50 p-2 text-green-700">暂无逾期节点</p>'}${order.inventoryRows.some((item) => item.stock < item.required) ? '<p class="rounded bg-amber-50 p-2 text-amber-700">库存物料存在缺口，仅提示风险</p>' : ''}</div></div><div class="p-4"><h3 class="font-semibold">关联</h3><div class="mt-3 space-y-2 text-sm"><a class="block text-blue-600" href="/fcs/dispatch/workbench">任务分配工作台</a><a class="block text-blue-600" href="/fcs/material-prep/list">配料准备</a><p>有效车缝工厂 ${order.sewingFactories.length} 家</p></div></div></div><div class="border-t p-4"><h3 class="mb-3 text-base font-semibold">合同与回货履约（按加工厂）</h3>${renderReturnProgress(order)}</div></section>`
}

function renderDetailDialog(): string {
  const order = orders.find((item) => item.productionOrderId === state.detailOrderId)
  if (!order) return ''
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4"><button class="absolute inset-0 bg-slate-900/40" data-progress-action="close-detail"></button><section class="relative z-10 max-h-[90vh] w-full max-w-6xl overflow-auto rounded-lg bg-slate-50 shadow-xl"><header class="sticky top-0 z-10 flex justify-between border-b bg-white p-4"><div><h2 class="text-lg font-semibold">${escapeHtml(order.productionOrderNo)} 生产进度详情</h2><p class="text-xs text-muted-foreground">沿用线上生产单详情/展开结构，并补充合同与回货履约</p></div><button data-progress-action="close-detail">关闭</button></header><div class="p-4">${renderExpanded(order)}</div></section></div>`
}

function renderImagePreview(): string {
  if (!state.imagePreview) return ''
  return `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-6" data-progress-action="close-image"><button class="absolute right-6 top-6 rounded bg-white px-3 py-2">关闭</button><img src="${escapeHtml(state.imagePreview.url)}" alt="${escapeHtml(state.imagePreview.label)}高清大图" class="max-h-full max-w-full object-contain"/></div>`
}

export function renderProductionOrderProgressTrackingPage(): string {
  const filtered = filterOrders()
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize))
  state.page = Math.min(Math.max(1, state.page), totalPages)
  const start = (state.page - 1) * state.pageSize
  const pageRows = filtered.slice(start, start + state.pageSize)
  const expandedOrder = pageRows.find((item) => item.productionOrderId === state.expandedOrderId)
  return `<div data-production-order-progress-page data-skip-page-rerender="true">${renderStandardListPage({
    title: '生产单进度跟踪',
    feedbackHtml: '<p class="text-sm text-muted-foreground">跟踪生产单全生命周期进度，从备料到交付的每个节点一目了然；回货节点按有效分配和加工厂独立核算。</p>',
    filtersHtml: renderFilters(),
    listTitle: '生产单进度',
    listActionsHtml: `<span class="text-xs text-muted-foreground">共 ${filtered.length} 条，第 ${state.page} 页 / 共 ${totalPages} 页</span>`,
    tableHtml: renderStandardListTable({ columns, rows: pageRows, preferences, sort: null, eventPrefix: 'production-order-progress', emptyText: '当前筛选下无生产单' }),
    paginationHtml: renderTablePagination({ total: filtered.length, from: filtered.length ? start + 1 : 0, to: Math.min(start + state.pageSize, filtered.length), currentPage: state.page, totalPages, pageSize: state.pageSize, actionPrefix: 'production-progress', fieldPrefix: 'production-progress', pageSizeOptions: [20, 50] }),
    overlaysHtml: `<div data-production-progress-overlays>${expandedOrder ? renderExpanded(expandedOrder) : ''}${renderDetailDialog()}${renderImagePreview()}</div>`,
  })}</div>`
}

function refreshRoot(): void {
  const root = document.querySelector<HTMLElement>('[data-production-order-progress-page]')
  if (root) root.outerHTML = renderProductionOrderProgressTrackingPage()
}

function refreshResults(): void {
  if (typeof document.createElement !== 'function') {
    refreshRoot()
    return
  }
  const root = document.querySelector<HTMLElement>('[data-production-order-progress-page]')
  if (!root) return
  const template = document.createElement('template')
  template.innerHTML = renderProductionOrderProgressTrackingPage().trim()
  const nextRoot = template.content.querySelector<HTMLElement>('[data-production-order-progress-page]')
  const currentTable = root.querySelector<HTMLElement>('[data-standard-list-table-section]')
  const nextTable = nextRoot?.querySelector<HTMLElement>('[data-standard-list-table-section]')
  const currentOverlays = root.querySelector<HTMLElement>('[data-production-progress-overlays]')
  const nextOverlays = nextRoot?.querySelector<HTMLElement>('[data-production-progress-overlays]')
  if (currentTable && nextTable) currentTable.replaceWith(nextTable)
  if (currentOverlays && nextOverlays) currentOverlays.replaceWith(nextOverlays)
}

export function handleProductionOrderProgressEvent(eventTarget: HTMLElement): boolean {
  const field = eventTarget.closest<HTMLInputElement | HTMLSelectElement>('[data-progress-field]')
  if (field) {
    const key = field.dataset.progressField as keyof ProgressTrackingState | undefined
    if (key) (state as unknown as Record<string, unknown>)[key] = field.value
    state.page = 1
    refreshResults()
    return true
  }
  const paginationField = eventTarget.closest<HTMLSelectElement>('[data-production-progress-field]')
  if (paginationField?.dataset.productionProgressField === 'page-size') {
    state.pageSize = Number(paginationField.value) || 20; state.page = 1; refreshResults(); return true
  }
  const actionNode = eventTarget.closest<HTMLElement>('[data-progress-action], [data-production-progress-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.progressAction || actionNode.dataset.productionProgressAction
  const orderId = actionNode.dataset.orderId || ''
  if (action === 'reset') {
    Object.assign(state, { keyword: '', sampleType: '', status: '', riskLevel: '', hasNode: '', sewingAssigned: '', saleType: '', dyeStatus: '', printStatus: '', cuttingStatus: '', deliveryStart: '', deliveryEnd: '', createStart: '', createEnd: '', qtyMin: '', qtyMax: '', returnStatus: '', contractStatus: '', page: 1 })
  } else if (action === 'detail' || action === 'view-return') state.detailOrderId = orderId
  else if (action === 'close-detail') state.detailOrderId = null
  else if (action === 'expand') state.expandedOrderId = state.expandedOrderId === orderId ? null : orderId
  else if (action === 'preview-image') state.imagePreview = { url: actionNode.dataset.url || '', label: actionNode.dataset.label || '款式' }
  else if (action === 'close-image') state.imagePreview = null
  else if (action === 'prev-page') state.page = Math.max(1, state.page - 1)
  else if (action === 'next-page') state.page += 1
  else return false
  if (action === 'reset') refreshRoot()
  else refreshResults()
  return true
}

export function closeProductionOrderProgressOverlay(): boolean {
  if (state.imagePreview) {
    state.imagePreview = null
    return true
  }
  if (state.detailOrderId) {
    state.detailOrderId = null
    return true
  }
  return false
}

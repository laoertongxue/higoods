import { appStore } from '../state/store'
import { hydrateIcons } from '../components/shell'
import { escapeHtml } from '../utils'

type TrackingTab = 'overview' | 'timeline' | 'quantity' | 'workorders' | 'handover' | 'settlement'
type RiskLevel = '高风险' | '中风险' | '低风险' | '无'
type NodeStatus = '已完成' | '进行中' | '风险' | '延期' | '异常' | '待处理' | '待审核' | '待休眠' | '相回仓' | '已接收' | '部分接收' | '差异异议' | '合格'

interface ProgressSet {
  actual: number
  material: number
  cutting: number
  sewing: number
  qc: number
}

interface ProductionOrderTrackingRecord {
  no: string
  demandNo: string
  scheduleNo: string
  materialRequestNo: string
  cutOrderNo: string
  sewingOrderNo: string
  title: string
  imageUrl: string
  styleName: string
  spu: string
  channel: string
  quantity: number
  status: '进行中' | '临期中' | '质检中' | '已完成'
  currentNode: string
  nodeIndexText: string
  riskLevel: RiskLevel
  riskTags: string[]
  deliveryWarehouse: string
  factories: string[]
  plannedDelivery: string
  dueText: string
  merchandiser: string
  brand: string
  season: string
  colors: string
  sizes: string
  fabric: string
  craft: string
  progress: ProgressSet
  alerts: Array<{ label: string; time: string; tone: 'red' | 'orange' | 'blue' }>
}

interface MetricCard {
  label: string
  value: string
  hint: string
  icon: string
  accent: string
}

interface StageNode {
  id: string
  label: string
  date: string
  qty?: string
  status: NodeStatus
  lane: string
  col: number
  span?: number
  detail: string
}

interface TimelineItem {
  id: string
  lane: string
  label: string
  start: number
  span: number
  date: string
  status: '准时' | '风险' | '延误' | '已完成'
  offset?: string
}

interface FlowNode {
  id: string
  label: string
  plan: number
  actual: number
  diff: number
  rate: string
  status: NodeStatus
}

interface WorkOrderNode {
  id: string
  lane: string
  label: string
  subLabel: string
  status: NodeStatus
}

interface HandoverEvent {
  id: string
  lane: string
  stage: string
  label: string
  time: string
  outQty: number
  inQty?: number
  status: NodeStatus
}

const BASE_PATH = '/fcs/progress/production-orders'
const DETAIL_PATH = `${BASE_PATH}/detail`

const TAB_ITEMS: Array<{ key: TrackingTab; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'timeline', label: '时间追踪' },
  { key: 'quantity', label: '数量流转' },
  { key: 'workorders', label: '工单与分支' },
  { key: 'handover', label: '交接与质检' },
  { key: 'settlement', label: '结算与复盘' },
]

const orders: ProductionOrderTrackingRecord[] = [
  {
    no: 'SO-PRD-202606-0018',
    demandNo: 'SO-REQ-202606-0012',
    scheduleNo: 'SO-SCH-202606-0018',
    materialRequestNo: 'PM-240618-08',
    cutOrderNo: 'CU-240618-05',
    sewingOrderNo: 'SEW-240618-06',
    title: '女装连衣裙补货单',
    imageUrl: '/dress-sample-1.jpg',
    styleName: '深蓝连衣裙',
    spu: 'DRS-240618',
    channel: '小红书',
    quantity: 8600,
    status: '进行中',
    currentNode: '车缝中',
    nodeIndexText: '3/7',
    riskLevel: '高风险',
    riskTags: ['印花未闭仓', '裁床多批次交出', '车缝组拒收'],
    deliveryWarehouse: 'WH-BDG-01',
    factories: ['东莞厚昇制衣厂', '苏州印花厂', '深圳染仓'],
    plannedDelivery: '2026-06-25',
    dueText: '剩余 0 天',
    merchandiser: '张毅峰',
    brand: 'Alice',
    season: '夏季',
    colors: '深蓝色',
    sizes: 'S 15% / M 35% / L 35% / XL 15%',
    fabric: '85% 棉 15% 聚酯纤维',
    craft: '吊牌、吊粒、水洗唛、合格证',
    progress: { actual: 82, material: 100, cutting: 95, sewing: 72, qc: 35 },
    alerts: [
      { label: '印花未闭仓：印花厂回仓延迟，影响车缝进度', time: '今天 09:12', tone: 'red' },
      { label: '裁床多批次交出：共 2 批未完成交出确认', time: '昨天 17:45', tone: 'orange' },
      { label: '车缝组拒收：有 1 个批次未签收', time: '昨天 16:10', tone: 'blue' },
    ],
  },
  {
    no: 'SO-PRD-202606-0017',
    demandNo: 'SO-REQ-202606-0011',
    scheduleNo: 'SO-SCH-202606-0017',
    materialRequestNo: 'PM-240617-03',
    cutOrderNo: 'CU-240617-04',
    sewingOrderNo: 'SEW-240617-03',
    title: '男装短袖T恤补货单',
    imageUrl: '/tshirt-sample.jpg',
    styleName: '白色T恤',
    spu: 'TSP-250501',
    channel: '天猫',
    quantity: 12000,
    status: '进行中',
    currentNode: '裁床中',
    nodeIndexText: '2/6',
    riskLevel: '中风险',
    riskTags: ['多节点并发未闭环'],
    deliveryWarehouse: 'WH-SZX-02',
    factories: ['佛山海尚制衣厂', '深圳中转仓'],
    plannedDelivery: '2026-06-28',
    dueText: '剩余 3 天',
    merchandiser: '李殿单',
    brand: 'Acme',
    season: '夏季',
    colors: '白色',
    sizes: 'S / M / L / XL',
    fabric: '精梳棉针织布',
    craft: '圆领、平车、包装袋',
    progress: { actual: 68, material: 100, cutting: 80, sewing: 0, qc: 0 },
    alerts: [
      { label: '裁床等待补料批次确认', time: '今天 10:20', tone: 'orange' },
      { label: '车缝产能尚未锁定', time: '昨天 18:02', tone: 'blue' },
    ],
  },
  {
    no: 'SO-PRD-202606-0016',
    demandNo: 'SO-REQ-202606-0010',
    scheduleNo: 'SO-SCH-202606-0016',
    materialRequestNo: 'PM-240616-09',
    cutOrderNo: 'CU-240616-06',
    sewingOrderNo: 'SEW-240616-05',
    title: '女装阔腿裤补货单',
    imageUrl: '/pants-sample.jpg',
    styleName: '卡其阔腿裤',
    spu: 'PNT-250303',
    channel: '抖音',
    quantity: 5400,
    status: '质检中',
    currentNode: '质检中',
    nodeIndexText: '6/6',
    riskLevel: '无',
    riskTags: [],
    deliveryWarehouse: 'WH-BDG-01',
    factories: ['东莞虎门制衣厂'],
    plannedDelivery: '2026-06-26',
    dueText: '剩余 1 天',
    merchandiser: '王银单',
    brand: 'Alice',
    season: '夏季',
    colors: '卡其色',
    sizes: 'S / M / L / XL',
    fabric: '斜纹棉弹力布',
    craft: '腰头、门襟、整烫',
    progress: { actual: 95, material: 100, cutting: 100, sewing: 100, qc: 60 },
    alerts: [],
  },
  {
    no: 'SO-PRD-202606-0015',
    demandNo: 'SO-REQ-202606-0009',
    scheduleNo: 'SO-SCH-202606-0015',
    materialRequestNo: 'PM-240615-02',
    cutOrderNo: 'CU-240615-02',
    sewingOrderNo: 'SEW-240615-02',
    title: '女装防晒外套补货单',
    imageUrl: '/cardigan-sample.jpg',
    styleName: '浅紫防晒外套',
    spu: 'JKT-250408',
    channel: '小红书',
    quantity: 9800,
    status: '已完成',
    currentNode: '已完成',
    nodeIndexText: '6/6',
    riskLevel: '无',
    riskTags: [],
    deliveryWarehouse: 'WH-SZX-01',
    factories: ['惠州博罗制衣厂'],
    plannedDelivery: '2026-06-22',
    dueText: '已交付',
    merchandiser: '赵银单',
    brand: 'Acme',
    season: '夏季',
    colors: '浅紫色',
    sizes: 'S / M / L',
    fabric: '轻薄防晒小套',
    craft: '拉链、帽绳、袖口',
    progress: { actual: 100, material: 100, cutting: 100, sewing: 100, qc: 100 },
    alerts: [],
  },
]

const overviewNodes: StageNode[] = [
  { id: 'PR-202606-01', label: '生产需求', date: '06-05', qty: '8,600件', status: '已完成', lane: '主线', col: 1, detail: '生产需求已确认，交付仓与尺码结构已冻结。' },
  { id: 'TB-240618-V2', label: '技术包 V2', date: '06-06', status: '已完成', lane: '主线', col: 2, detail: '技术包完成，补货版型与工艺要求已下发。' },
  { id: 'SO-PRD-0018', label: '生产单创建', date: '06-06', qty: '8,600件', status: '已完成', lane: '主线', col: 3, span: 2, detail: '生产单已生成，进入多泳道任务拆分。' },
  { id: 'PF-240618-01', label: '印花需求', date: '06-07', qty: '8,600件', status: '进行中', lane: '印花链路', col: 4, detail: '印花需求已拆分，存在回仓延迟。' },
  { id: 'DY-240618-01', label: '染色需求', date: '06-10', qty: '4,200件', status: '进行中', lane: '染色链路', col: 4, detail: '染色首批已完成，二批待回写。' },
  { id: 'M-240618-01', label: '配料批次 1', date: '06-07', qty: '5,000件', status: '已完成', lane: '物料链路', col: 6, detail: '主料、辅料首批已齐套。' },
  { id: 'L-240618-02', label: '领料批次 2', date: '06-11', qty: '3,800件', status: '已完成', lane: '物料链路', col: 7, detail: '第二批领料完成，等待车缝接收。' },
  { id: 'CT-240618-03', label: '裁片单', date: '06-11', qty: '3,800件', status: '进行中', lane: '裁床链路', col: 8, detail: '当前主卡点：裁床完成但交出滞后，需催办 2 个批次。' },
  { id: 'MK-240618-B', label: '唛架方案 B', date: '06-10', qty: '8,600件', status: '进行中', lane: '裁床链路', col: 9, detail: '唛架方案 B 已确认，等待二批铺布完成。' },
  { id: 'PB-240618-02', label: '铺布批次 2', date: '06-11', qty: '4,300件', status: '风险', lane: '裁床链路', col: 10, detail: '铺布批次存在 -80 件差异，需要登记损耗原因。' },
  { id: 'SP-240618-01', label: '特殊工艺', date: '06-13', qty: '2,800件', status: '进行中', lane: '裁床链路', col: 11, detail: '特殊工艺已派工，预计明日回仓。' },
  { id: 'SEW-240618-01', label: '车缝', date: '06-16', qty: '8,200件', status: '风险', lane: '车缝链路', col: 12, detail: '车缝接收 1 个批次拒收，影响后道排产。' },
  { id: 'QC-240618-01', label: '后道复检交出', date: '06-20', qty: '8,200件', status: '待处理', lane: '后道链路', col: 13, detail: '等待车缝完成后进入后道复检。' },
]

const timelineItems: TimelineItem[] = [
  { id: 'prepare', lane: '主线', label: '生产准备', start: 1, span: 3, date: '05-31 - 06-01', status: '已完成' },
  { id: 'tech', lane: '主线', label: '计划排产与工单下发', start: 4, span: 4, date: '06-02 - 06-03', status: '已完成' },
  { id: 'material', lane: '主线', label: '原料入仓', start: 8, span: 4, date: '06-05 - 06-08', status: '已完成' },
  { id: 'main-check', lane: '主线', label: '主料验仓', start: 12, span: 3, date: '06-09 - 06-11', status: '风险', offset: '延期 +1天' },
  { id: 'printing-v1', lane: '印花', label: '印花生产（噪喱 v1）', start: 6, span: 5, date: '06-04 - 06-08', status: '延误', offset: '+2天' },
  { id: 'printing-v2', lane: '印花', label: '印花生产（噪喱 v2）', start: 11, span: 4, date: '06-07 - 06-09', status: '风险', offset: '+1天' },
  { id: 'dye-b1', lane: '染色', label: '染色生产（批次1）', start: 8, span: 4, date: '06-05 - 06-06', status: '风险', offset: '+1天' },
  { id: 'dye-check', lane: '染色', label: '染色复工', start: 15, span: 2, date: '06-11', status: '已完成' },
  { id: 'material-b1', lane: '配料 / 领料', label: '配料批次1', start: 4, span: 4, date: '06-02 - 06-05', status: '已完成' },
  { id: 'material-b3', lane: '配料 / 领料', label: '领料批次3', start: 14, span: 2, date: '06-10', status: '延误', offset: '+1天' },
  { id: 'marker-v2', lane: '裁床', label: '唛架 v2', start: 11, span: 4, date: '06-07', status: '已完成' },
  { id: 'cutting', lane: '裁床', label: '铺布批次1', start: 14, span: 5, date: '06-10 - 06-12', status: '延误', offset: '+1天' },
  { id: 'sewing', lane: '车缝', label: '车缝生产（流水 1-3 线）', start: 18, span: 7, date: '06-12 - 06-19', status: '延误', offset: '+3天' },
  { id: 'qc1', lane: '后道复检交出', label: '复检批次1', start: 24, span: 2, date: '06-20', status: '风险', offset: '+1天' },
  { id: 'handover', lane: '后道复检交出', label: '交出批次2', start: 27, span: 2, date: '06-24', status: '延误', offset: '+1天' },
]

const quantityFlow: FlowNode[] = [
  { id: 'demand', label: '生产需求', plan: 8600, actual: 8600, diff: 0, rate: '100.00%', status: '合格' },
  { id: 'print-dye', label: '印花 / 染色需求', plan: 8600, actual: 8600, diff: 0, rate: '100.00%', status: '合格' },
  { id: 'material', label: '印染配料批次', plan: 8600, actual: 8500, diff: -100, rate: '98.84%', status: '风险' },
  { id: 'cutting', label: '裁片单', plan: 8600, actual: 8420, diff: -180, rate: '97.91%', status: '风险' },
  { id: 'spreading-a', label: '铺布批次 A', plan: 4300, actual: 4230, diff: -70, rate: '97.96%', status: '风险' },
  { id: 'spreading-b', label: '铺布批次 B', plan: 4300, actual: 4220, diff: -80, rate: '96.85%', status: '风险' },
  { id: 'sewing', label: '车缝', plan: 8360, actual: 8220, diff: -140, rate: '95.58%', status: '风险' },
  { id: 'recheck', label: '后道复检交出', plan: 8360, actual: 8160, diff: -200, rate: '94.88%', status: '风险' },
]

const workOrderNodes: WorkOrderNode[] = [
  { id: 'PF-240618-01', lane: '印花需求', label: 'PF-240618-01', subLabel: '1,800 件', status: '已完成' },
  { id: 'PF-240618-02', lane: '印花需求', label: 'PF-240618-02', subLabel: '1,400 件', status: '进行中' },
  { id: 'PF-240618-03', lane: '印花需求', label: 'PF-240618-03', subLabel: '1,600 件', status: '待审核' },
  { id: 'DY-240618-01', lane: '染色需求', label: 'DY-240618-01', subLabel: '4,200 米', status: '进行中' },
  { id: 'DY-240618-02', lane: '染色需求', label: 'DY-240618-02', subLabel: '4,000 米', status: '相回仓' },
  { id: 'BP-240618-01', lane: '印染配料', label: 'BP-240618-01', subLabel: '批次 1', status: '已完成' },
  { id: 'BP-240618-02', lane: '印染配料', label: 'BP-240618-02', subLabel: '批次 2', status: '进行中' },
  { id: 'MK-240618-B', lane: '裁片单', label: 'MK-240618-B', subLabel: '唛架方案 B', status: '进行中' },
  { id: 'MS-240618-B1', lane: '裁片单', label: 'MS-240618-B1', subLabel: '铺布 第1次', status: '待审核' },
  { id: 'CC-240618-C', lane: '裁片单', label: 'CC-240618-C', subLabel: '裁剪 第1次', status: '进行中' },
  { id: 'TC-240618-02', lane: '特殊工艺', label: 'TC-240618-02', subLabel: '染会', status: '相回仓' },
  { id: 'SW-240618-01', lane: '车缝', label: 'SW-240618-01', subLabel: '车缝组 1', status: '进行中' },
  { id: 'SW-240618-03', lane: '车缝', label: 'SW-240618-03', subLabel: '车缝组 3', status: '相回仓' },
  { id: 'QA-240618-01', lane: '后道复检交出', label: 'QA-240618-01', subLabel: '复检组 1 次', status: '进行中' },
  { id: 'DI-240618-03', lane: '后道复检交出', label: 'DI-240618-03', subLabel: '交出 第2次', status: '待审核' },
]

const handoverEvents: HandoverEvent[] = [
  { id: 'HD-CUT-240618-01', lane: '裁床', stage: '裁床 -> 车缝', label: '裁片交出 01', time: '06-11 08:30', outQty: 2000, inQty: 2000, status: '已接收' },
  { id: 'HD-CUT-240618-02', lane: '裁床', stage: '裁床 -> 车缝', label: '裁片交出 02', time: '06-11 14:20', outQty: 2000, inQty: 1980, status: '部分接收' },
  { id: 'HD-SEW-240618-01', lane: '车缝', stage: '车缝 -> 后道', label: '车缝交出 01', time: '06-13 18:00', outQty: 1940, inQty: 1900, status: '部分接收' },
  { id: 'HD-SEW-240618-03', lane: '车缝', stage: '车缝 -> 后道', label: '车缝交出 03', time: '06-14 09:20', outQty: 2000, inQty: 1970, status: '差异异议' },
  { id: 'HD-FIN-240618-01', lane: '后道', stage: '后道 -> 复检交出', label: '复检交出 01', time: '06-15 09:40', outQty: 1880, inQty: 1880, status: '已接收' },
  { id: 'QC-RECHK-240618-02', lane: '复检 / 质检', stage: '复检交出 -> 仓库', label: '复检记录 02', time: '06-16 15:50', outQty: 1790, inQty: 1790, status: '部分接收' },
  { id: 'HD-WH-240618-01', lane: '仓库', stage: '复检交出 -> 仓库', label: '成品入仓 01', time: '06-17 09:30', outQty: 1900, inQty: 1900, status: '已接收' },
]

const statusClassMap: Record<NodeStatus, string> = {
  已完成: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  进行中: 'border-blue-200 bg-blue-50 text-blue-700',
  风险: 'border-orange-200 bg-orange-50 text-orange-700',
  延期: 'border-red-200 bg-red-50 text-red-700',
  异常: 'border-red-200 bg-red-50 text-red-700',
  待处理: 'border-slate-200 bg-slate-50 text-slate-700',
  待审核: 'border-amber-200 bg-amber-50 text-amber-700',
  待休眠: 'border-orange-200 bg-orange-50 text-orange-700',
  相回仓: 'border-violet-200 bg-violet-50 text-violet-700',
  已接收: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  部分接收: 'border-orange-200 bg-orange-50 text-orange-700',
  差异异议: 'border-red-200 bg-red-50 text-red-700',
  合格: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

function formatNumber(value: number): string {
  return value.toLocaleString('zh-CN')
}

function getQueryParams(): URLSearchParams {
  const pathname = appStore.getState().pathname
  const query = pathname.includes('?') ? pathname.slice(pathname.indexOf('?') + 1) : ''
  return new URLSearchParams(query)
}

function buildHref(path: string, params: Record<string, string | number | null | undefined> = {}): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') search.set(key, String(value))
  })
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

function buildDetailHref(orderNo: string, tab: TrackingTab = 'overview', node?: string): string {
  return buildHref(DETAIL_PATH, { po: orderNo, tab, node })
}

function getActiveTab(): TrackingTab {
  const tab = getQueryParams().get('tab') as TrackingTab | null
  return TAB_ITEMS.some((item) => item.key === tab) ? tab : 'overview'
}

function getActiveOrder(): ProductionOrderTrackingRecord {
  const po = getQueryParams().get('po')
  return orders.find((order) => order.no === po) ?? orders[0]
}

function getSelectedNode(defaultId: string): string {
  return getQueryParams().get('node') || defaultId
}

function renderIcon(icon: string, className = 'h-5 w-5'): string {
  return `<i data-lucide="${escapeHtml(icon)}" class="${className}"></i>`
}

function badge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function renderStatusBadge(status: NodeStatus | ProductionOrderTrackingRecord['status']): string {
  const className = statusClassMap[status as NodeStatus] ?? 'border-blue-200 bg-blue-50 text-blue-700'
  return badge(status, className)
}

function renderRiskTags(order: ProductionOrderTrackingRecord): string {
  if (!order.riskTags.length) return badge('无', 'border-slate-200 bg-slate-50 text-slate-600')
  return order.riskTags.map((tag) => badge(tag, 'border-red-200 bg-red-50 text-red-600')).join('')
}

function renderProgressBar(value: number, tone: 'green' | 'blue' | 'orange' | 'purple' = 'green'): string {
  const toneClass = {
    green: 'bg-emerald-500',
    blue: 'bg-blue-500',
    orange: 'bg-orange-500',
    purple: 'bg-violet-500',
  }[tone]
  return `
    <div class="space-y-1">
      <div class="h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div class="h-full rounded-full ${toneClass}" style="width:${Math.max(0, Math.min(100, value))}%"></div>
      </div>
      <div class="text-xs font-medium text-slate-700">${value}%</div>
    </div>
  `
}

function renderMetricCard(card: MetricCard): string {
  return `
    <article class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-sm text-muted-foreground">${escapeHtml(card.label)}</p>
          <p class="mt-1 text-2xl font-bold tracking-normal ${card.accent}">${escapeHtml(card.value)}</p>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(card.hint)}</p>
        </div>
        ${renderIcon(card.icon, 'h-4 w-4 text-muted-foreground')}
      </div>
    </article>
  `
}

function renderListHeader(): string {
  const metrics: MetricCard[] = [
    { label: '进行中生产单', value: '268', hint: '环比上周 ↑ 12.8%', icon: 'ClipboardList', accent: 'text-blue-600' },
    { label: '临期生产单', value: '32', hint: '近7天交付　占12%', icon: 'PieChart', accent: 'text-orange-600' },
    { label: '延误生产单', value: '18', hint: '环比上周 ↑ 5', icon: 'TriangleAlert', accent: 'text-red-600' },
    { label: '今日新增', value: '15', hint: '昨日新增 18', icon: 'FilePlus2', accent: 'text-emerald-600' },
    { label: '待闭环异常', value: '27', hint: '较昨日 ↑ 3', icon: 'ShieldZap', accent: 'text-violet-600' },
    { label: '本周交付数量', value: '36,580', hint: '计划 42,000　完成 87%', icon: 'Package', accent: 'text-blue-600' },
  ]
  return `
    <header class="flex items-center justify-between gap-4">
      <div>
        <h1 class="flex items-center gap-2 text-xl font-semibold">
          ${renderIcon('GitBranch', 'h-5 w-5')}
          生产单进度跟踪
        </h1>
        <p class="text-sm text-muted-foreground">按生产单全生命周期追踪时间、数量、工单分支、交接质检与结算风险</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="inline-flex h-8 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          data-production-order-progress-action="open-modal"
          data-modal-title="新建生产单"
          data-modal-tone="blue"
          data-modal-body="已打开新建生产单入口。原型中展示关键入口响应，实际系统由生产单创建流程承接。"
          data-skip-page-rerender="true">
          ${renderIcon('Plus', 'h-4 w-4')}新建生产单
        </button>
        <button class="inline-flex h-8 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted"
          data-production-order-progress-action="open-modal"
          data-modal-title="导出生产单列表"
          data-modal-tone="green"
          data-modal-body="导出任务已模拟提交，当前筛选条件和展开信息会一并带出。"
          data-skip-page-rerender="true">
          ${renderIcon('Download', 'h-4 w-4')}导出
        </button>
        <button class="inline-flex h-8 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted"
          data-production-order-progress-action="open-modal"
          data-modal-title="刷新完成"
          data-modal-tone="blue"
          data-modal-body="已按当前筛选条件刷新列表数据。"
          data-skip-page-rerender="true">
          ${renderIcon('RefreshCw', 'h-4 w-4')}刷新
        </button>
      </div>
    </header>
    <section class="grid grid-cols-6 gap-4">
      ${metrics.map(renderMetricCard).join('')}
    </section>
  `
}

function renderFilterInput(label: string, placeholder: string, icon?: string): string {
  return `
    <label class="space-y-1.5">
      <span class="text-xs font-medium text-muted-foreground">${escapeHtml(label)}</span>
      <div class="relative">
        <input class="h-9 w-full rounded-md border bg-background px-3 ${icon ? 'pr-9' : ''} text-sm outline-none focus:border-primary" placeholder="${escapeHtml(placeholder)}" data-skip-page-rerender="true" />
        ${icon ? `<span class="absolute right-3 top-2.5 text-muted-foreground">${renderIcon(icon, 'h-4 w-4')}</span>` : ''}
      </div>
    </label>
  `
}

function renderFilterSelect(label: string, values: string[]): string {
  return `
    <label class="space-y-1.5">
      <span class="text-xs font-medium text-muted-foreground">${escapeHtml(label)}</span>
      <select class="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" data-skip-page-rerender="true">
        ${values.map((item) => `<option>${escapeHtml(item)}</option>`).join('')}
      </select>
    </label>
  `
}

function renderFilters(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid grid-cols-6 gap-3">
        ${renderFilterInput('生产单号', '请输入生产单号')}
        ${renderFilterInput('生产需求单', '请输入需求单号')}
        ${renderFilterInput('款式/SPU', '请输入款式或SPU')}
        ${renderFilterSelect('渠道', ['全部', '小红书', '天猫', '抖音'])}
        ${renderFilterSelect('状态', ['全部', '进行中', '临期中', '质检中', '已完成'])}
        ${renderFilterSelect('风险等级', ['全部', '高风险', '中风险', '低风险', '无'])}
        ${renderFilterInput('跟单员', '请选择跟单员', 'Users')}
        ${renderFilterSelect('工厂', ['全部', '东莞厚昇制衣厂', '佛山海尚制衣厂', '惠州博罗制衣厂'])}
        ${renderFilterInput('日期范围', '开始日期　~　结束日期', 'CalendarDays')}
        ${renderFilterSelect('是否含印花', ['全部', '是', '否'])}
        ${renderFilterSelect('是否含染色', ['全部', '是', '否'])}
        <div class="flex items-end justify-end gap-2">
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted"
            data-production-order-progress-action="open-modal"
            data-modal-title="筛选已重置"
            data-modal-body="已恢复生产单列表默认筛选条件。"
            data-skip-page-rerender="true">重置</button>
          <button class="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            data-production-order-progress-action="open-modal"
            data-modal-title="查询完成"
            data-modal-tone="blue"
            data-modal-body="已按当前筛选条件查询生产单，首行保留展开用于快速查看。"
            data-skip-page-rerender="true">搜索</button>
        </div>
      </div>
    </section>
  `
}

function renderExpandedRow(order: ProductionOrderTrackingRecord): string {
  return `
    <tr class="bg-white" data-production-order-expanded-row="${escapeHtml(order.no)}">
      <td colspan="19" class="border-t border-slate-100 p-0">
        <div class="mx-4 mb-3 rounded-lg border bg-muted/20 p-4">
          <div class="grid gap-6 xl:grid-cols-[1fr_1.2fr_1.2fr_.8fr]">
            <div>
              <h3 class="text-sm font-semibold text-slate-800">生产单详情</h3>
              <dl class="mt-3 space-y-1 text-xs text-slate-600">
                <div>生产需求单　<span class="font-medium text-slate-800">${escapeHtml(order.demandNo)}</span></div>
                <div>款式颜色　<span class="font-medium text-slate-800">${escapeHtml(order.colors)}</span></div>
                <div>尺码结构　<span class="font-medium text-slate-800">${escapeHtml(order.sizes)}</span></div>
                <div>面料　<span class="font-medium text-slate-800">${escapeHtml(order.fabric)}</span></div>
                <div>工艺要求　<span class="font-medium text-slate-800">${escapeHtml(order.craft)}</span></div>
              </dl>
            </div>
            <div>
              <h3 class="text-sm font-semibold text-slate-800">关键时间</h3>
              <div class="mt-5 flex items-center gap-0 text-xs">
                ${['计划开始|2026-06-18', '配料完成|2026-06-20', '裁床完成|2026-06-21', '车缝完成|2026-06-23', '质检完成|2026-06-24', '计划交付|2026-06-25'].map((item, index) => {
                  const [label, date] = item.split('|')
                  return `
                    <div class="flex flex-1 items-center">
                      <div class="text-center">
                        <div class="mx-auto h-2.5 w-2.5 rounded-full ${index === 5 ? 'bg-red-500' : 'bg-blue-500'}"></div>
                        <p class="mt-2 whitespace-nowrap text-slate-500">${escapeHtml(label)}</p>
                        <p class="font-medium text-slate-700">${escapeHtml(date)}</p>
                      </div>
                      ${index < 5 ? '<div class="mx-2 h-px flex-1 bg-slate-300"></div>' : ''}
                    </div>
                  `
                }).join('')}
              </div>
            </div>
            <div>
              <h3 class="text-sm font-semibold text-slate-800">异常与提醒</h3>
              <div class="mt-3 space-y-2 text-xs">
                ${order.alerts.length ? order.alerts.map((alert) => `
                  <div class="grid grid-cols-[1fr_72px] gap-3">
                    <p class="${alert.tone === 'red' ? 'text-red-600' : alert.tone === 'orange' ? 'text-orange-600' : 'text-blue-600'}">${escapeHtml(alert.label)}</p>
                    <span class="text-right text-slate-500">${escapeHtml(alert.time)}</span>
                  </div>
                `).join('') : '<p class="text-slate-500">暂无未闭环异常。</p>'}
                <button class="mt-1 text-xs font-medium text-blue-600"
                  data-production-order-progress-action="open-modal"
                  data-modal-title="${escapeHtml(order.no)} 异常提醒"
                  data-modal-tone="orange"
                  data-modal-body="已展示该生产单的 5 条异常与提醒，当前重点是印花回仓、裁床交出和车缝签收。"
                  data-skip-page-rerender="true">查看全部 5 条 ></button>
              </div>
            </div>
            <div>
              <h3 class="text-sm font-semibold text-slate-800">关联</h3>
              <div class="mt-3 space-y-1 text-xs text-blue-600">
                <button class="block text-left" data-production-order-progress-action="open-modal" data-modal-title="生产排期" data-modal-body="${escapeHtml(order.scheduleNo)} 已关联到当前生产单。" data-skip-page-rerender="true">生产排期　${escapeHtml(order.scheduleNo)}</button>
                <button class="block text-left" data-production-order-progress-action="open-modal" data-modal-title="配料单" data-modal-body="${escapeHtml(order.materialRequestNo)} 等 2 条配料单已关联。" data-skip-page-rerender="true">配料单　${escapeHtml(order.materialRequestNo)} 等 2 条</button>
                <button class="block text-left" data-production-order-progress-action="open-modal" data-modal-title="裁床单" data-modal-body="${escapeHtml(order.cutOrderNo)} 等 2 条裁床单已关联。" data-skip-page-rerender="true">裁床单　${escapeHtml(order.cutOrderNo)} 等 2 条</button>
                <button class="block text-left" data-production-order-progress-action="open-modal" data-modal-title="车缝单" data-modal-body="${escapeHtml(order.sewingOrderNo)} 等 2 条车缝单已关联。" data-skip-page-rerender="true">车缝单　${escapeHtml(order.sewingOrderNo)} 等 2 条</button>
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  `
}

function renderOrderRow(order: ProductionOrderTrackingRecord, expandedNo: string): string {
  const expanded = expandedNo === order.no
  const row = `
    <tr class="border-b align-top hover:bg-muted/30" data-production-order-row="${escapeHtml(order.no)}">
      <td class="px-3 py-3"><input type="checkbox" class="h-4 w-4 rounded border-slate-300" /></td>
      <td class="px-3 py-3"><img src="${escapeHtml(order.imageUrl)}" class="h-14 w-11 rounded-md object-cover" alt="${escapeHtml(order.title)}" /></td>
      <td class="px-3 py-3">
        <button class="font-semibold text-blue-600 hover:underline" data-nav="${escapeHtml(buildDetailHref(order.no))}">${escapeHtml(order.no)}</button>
        <p class="mt-1 text-xs text-slate-500">创建：2025-06-25</p>
        <p class="text-xs text-slate-500">更新：2025-06-25</p>
      </td>
      <td class="px-3 py-3">
        <p class="font-medium text-slate-900">${escapeHtml(order.title)}</p>
        <p class="mt-1 text-xs text-slate-500">渠道：${escapeHtml(order.channel)}</p>
        <p class="text-xs text-slate-500">季节：${escapeHtml(order.season)}</p>
      </td>
      <td class="px-3 py-3">
        <p class="font-medium text-slate-800">${escapeHtml(order.spu)}</p>
        <p class="text-xs text-slate-500">${escapeHtml(order.styleName)}</p>
      </td>
      <td class="px-3 py-3 font-semibold tabular-nums text-slate-900">${formatNumber(order.quantity)} 件</td>
      <td class="px-3 py-3">${renderStatusBadge(order.status)}</td>
      <td class="px-3 py-3">
        <p class="font-medium text-slate-900">${escapeHtml(order.currentNode)}</p>
        <p class="text-xs text-slate-500">${escapeHtml(order.nodeIndexText)}</p>
      </td>
      <td class="px-3 py-3"><div class="flex flex-col gap-1">${renderRiskTags(order)}</div></td>
      <td class="px-3 py-3">
        <p class="font-medium text-slate-800">${escapeHtml(order.deliveryWarehouse)}</p>
        <p class="text-xs text-slate-500">广州成衣仓</p>
      </td>
      <td class="px-3 py-3">
        <p class="font-medium text-slate-800">${escapeHtml(order.factories[0])}</p>
        <p class="text-xs text-blue-600">+${Math.max(0, order.factories.length - 1)}</p>
      </td>
      <td class="px-3 py-3">
        <p class="font-medium text-slate-900">${escapeHtml(order.plannedDelivery)}</p>
        <p class="${order.dueText.includes('0') ? 'text-red-500' : 'text-slate-500'} text-xs">${escapeHtml(order.dueText)}</p>
      </td>
      <td class="px-3 py-3">${renderProgressBar(order.progress.actual, 'green')}</td>
      <td class="px-3 py-3">${renderProgressBar(order.progress.material, 'green')}</td>
      <td class="px-3 py-3">${renderProgressBar(order.progress.cutting, 'green')}</td>
      <td class="px-3 py-3">${renderProgressBar(order.progress.sewing, 'blue')}</td>
      <td class="px-3 py-3">${renderProgressBar(order.progress.qc, 'orange')}</td>
      <td class="px-3 py-3 font-medium text-slate-700">${escapeHtml(order.merchandiser)}</td>
      <td class="px-3 py-3">
        <div class="flex items-center gap-3">
          <button class="text-sm font-medium text-blue-600" data-nav="${escapeHtml(buildDetailHref(order.no))}">详情</button>
          <button
            class="text-sm font-medium text-blue-600"
            data-production-order-progress-action="toggle-row"
            data-order-no="${escapeHtml(order.no)}"
            data-expanded="${expanded ? 'true' : 'false'}"
            data-skip-page-rerender="true"
          >${expanded ? '收起' : '展开'}</button>
        </div>
      </td>
    </tr>
  `
  return row + (expanded ? renderExpandedRow(order) : '')
}

function renderOrderTable(): string {
  const expandedNo = getQueryParams().get('expanded') || orders[0].no
  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3 text-sm">
        <label class="flex items-center gap-2 text-slate-600"><input type="checkbox" class="h-4 w-4 rounded border-slate-300" />已选择 0 项</label>
        <div class="flex items-center gap-4 text-slate-500">
          <button class="inline-flex items-center gap-1"
            data-production-order-progress-action="open-modal"
            data-modal-title="表格设置"
            data-modal-body="可调整列显示、列顺序和固定列。"
            data-skip-page-rerender="true">${renderIcon('Settings2', 'h-4 w-4')}表格设置</button>
          <button data-production-order-progress-action="open-modal"
            data-modal-title="批量操作"
            data-modal-body="请选择生产单后执行批量导出、批量提醒或批量分派。"
            data-skip-page-rerender="true">批量操作 ${renderIcon('ChevronDown', 'inline h-4 w-4')}</button>
          <button class="inline-flex items-center gap-1"
            data-production-order-progress-action="open-modal"
            data-modal-title="导出当前页"
            data-modal-tone="green"
            data-modal-body="当前页生产单数据已加入导出队列。"
            data-skip-page-rerender="true">${renderIcon('Download', 'h-4 w-4')}导出当前页</button>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-[1680px] w-full text-left text-sm">
          <thead class="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th class="w-10 px-3 py-2 font-medium"></th>
              <th class="px-3 py-2 font-medium">款式图</th>
              <th class="px-3 py-2 font-medium">生产单号</th>
              <th class="px-3 py-2 font-medium">标题</th>
              <th class="px-3 py-2 font-medium">款式/SPU</th>
              <th class="px-3 py-2 font-medium">生产数量</th>
              <th class="px-3 py-2 font-medium">当前状态</th>
              <th class="px-3 py-2 font-medium">当前节点</th>
              <th class="px-3 py-2 font-medium">风险等级</th>
              <th class="px-3 py-2 font-medium">交付仓</th>
              <th class="px-3 py-2 font-medium">涉及工厂</th>
              <th class="px-3 py-2 font-medium">计划交付</th>
              <th class="px-3 py-2 font-medium">实际进度</th>
              <th class="px-3 py-2 font-medium">配料进度</th>
              <th class="px-3 py-2 font-medium">裁床进度</th>
              <th class="px-3 py-2 font-medium">车缝进度</th>
              <th class="px-3 py-2 font-medium">质检/交出进度</th>
              <th class="px-3 py-2 font-medium">跟单员</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map((order) => renderOrderRow(order, expandedNo)).join('')}
          </tbody>
        </table>
      </div>
      <footer class="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
        <span>共 268 条</span>
        <div class="flex items-center gap-2">
          <button class="h-8 w-8 rounded-md border border-slate-200 text-slate-500" data-production-order-progress-action="open-modal" data-modal-title="上一页" data-modal-body="当前已经是第一页。" data-skip-page-rerender="true">${renderIcon('ChevronLeft', 'mx-auto h-4 w-4')}</button>
          <button class="h-8 w-8 rounded-md bg-blue-600 text-white" data-production-order-progress-action="open-modal" data-modal-title="第 1 页" data-modal-body="当前停留在第 1 页。" data-skip-page-rerender="true">1</button>
          <button class="h-8 w-8 rounded-md text-slate-700" data-production-order-progress-action="open-modal" data-modal-title="切换第 2 页" data-modal-body="已模拟切换到第 2 页。" data-skip-page-rerender="true">2</button>
          <button class="h-8 w-8 rounded-md text-slate-700" data-production-order-progress-action="open-modal" data-modal-title="切换第 3 页" data-modal-body="已模拟切换到第 3 页。" data-skip-page-rerender="true">3</button>
          <span class="px-2">...</span>
          <button class="h-8 w-8 rounded-md text-slate-700" data-production-order-progress-action="open-modal" data-modal-title="切换第 14 页" data-modal-body="已模拟切换到第 14 页。" data-skip-page-rerender="true">14</button>
          <button class="h-8 w-8 rounded-md border border-slate-200 text-slate-500" data-production-order-progress-action="open-modal" data-modal-title="下一页" data-modal-body="已模拟进入下一页。" data-skip-page-rerender="true">${renderIcon('ChevronRight', 'mx-auto h-4 w-4')}</button>
          <button class="ml-3 h-8 rounded-md border border-slate-200 px-3" data-production-order-progress-action="open-modal" data-modal-title="分页条数" data-modal-body="当前每页展示 20 条，可切换 50 条或 100 条。" data-skip-page-rerender="true">20 条/页</button>
          <span>跳至</span>
          <input class="h-8 w-12 rounded-md border border-slate-200 text-center" value="1" data-skip-page-rerender="true" />
          <span>页</span>
        </div>
      </footer>
    </section>
  `
}

function renderListPage(): string {
  return `
    <div class="space-y-4" data-production-order-progress-root data-page-mode="list">
      <div class="space-y-4">
        ${renderListHeader()}
        ${renderFilters()}
        ${renderOrderTable()}
      </div>
      <div data-production-order-progress-modal-host></div>
    </div>
  `
}

function renderCountdownCard(order: ProductionOrderTrackingRecord): string {
  return `
    <article class="rounded-lg border bg-card p-4">
      <p class="text-sm font-medium text-slate-600">交付倒计时</p>
      <div class="mt-2 flex items-end gap-2">
        <span class="text-5xl font-bold leading-none text-slate-950">24</span>
        <span class="mb-2 text-xl font-semibold text-slate-800">天</span>
      </div>
      <div class="mt-3 inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm font-medium text-orange-600">
        中风险：多节点并发未闭环
      </div>
      <div class="mt-3 h-2 rounded-full bg-slate-200">
        <div class="h-full w-[78%] rounded-full bg-gradient-to-r from-emerald-500 via-orange-400 to-orange-500"></div>
      </div>
      <p class="mt-2 text-sm text-slate-500">计划交付：${escapeHtml(order.plannedDelivery)}（周四）</p>
    </article>
  `
}

function renderOrderHero(order: ProductionOrderTrackingRecord, tab: TrackingTab): string {
  const labelMap: Record<TrackingTab, string[]> = {
    overview: ['面料配料', '裁片入仓', '工艺闭仓', '车缝完成'],
    timeline: ['整体进度', '原料入仓', '生产进度', '交付进度'],
    quantity: ['面料已到', '配料入仓', '工序综合', '整体良率'],
    workorders: ['面料备料', '配料入仓', '工序排产', '排产齐套'],
    handover: ['面料已到', '裁片入仓', '工序交接', '当前异常'],
    settlement: ['整体进度', '采购入仓', '生产制造', '质检发货'],
  }
  const values = tab === 'quantity' ? [82, 55, 36, 91] : tab === 'settlement' ? [82, 55, 36, 19] : [82, 55, 36, 19]
  const labels = labelMap[tab]
  return `
    <article class="grid grid-cols-[112px_minmax(0,1fr)] gap-4 rounded-lg border bg-card p-4 2xl:grid-cols-[128px_minmax(0,1fr)_320px]">
      <img src="${escapeHtml(order.imageUrl)}" class="h-32 w-28 rounded-lg object-cover" alt="${escapeHtml(order.title)}" />
      <div class="min-w-0">
        <div class="flex items-center gap-3">
          <h1 class="min-w-0 flex-1 truncate text-xl font-bold text-slate-950">
            <span class="block 2xl:inline">${escapeHtml(order.no)}</span>
            <span class="hidden 2xl:inline">　|　</span>
            <span class="block 2xl:inline">${escapeHtml(order.title)}</span>
          </h1>
          ${renderStatusBadge(order.status)}
        </div>
        <div class="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 text-sm 2xl:grid-cols-4">
          <div class="min-w-0"><p class="text-slate-500">生产数量</p><p class="mt-1 truncate font-semibold text-slate-950">${formatNumber(order.quantity)} 件</p></div>
          <div class="min-w-0"><p class="text-slate-500">款式 / SPU</p><p class="mt-1 truncate font-semibold text-slate-950">${escapeHtml(order.spu)}　|　3色6码</p></div>
          <div class="min-w-0"><p class="text-slate-500">交付仓</p><p class="mt-1 truncate font-semibold text-slate-950">万锦成衣仓 ${escapeHtml(order.deliveryWarehouse)}</p></div>
          <div class="min-w-0"><p class="text-slate-500">计划交付</p><p class="mt-1 truncate font-semibold text-slate-950">${escapeHtml(order.plannedDelivery)}</p></div>
          <div class="min-w-0"><p class="text-slate-500">责任品牌</p><p class="mt-1 truncate font-semibold text-slate-950">${escapeHtml(order.brand)} / 小飞袖</p></div>
          <div class="min-w-0"><p class="text-slate-500">涉及工厂</p><p class="mt-1 truncate font-semibold text-slate-950">${escapeHtml(order.factories.slice(0, 3).join('、'))}</p></div>
          <div class="min-w-0"><p class="text-slate-500">齐套状态</p><p class="mt-1 truncate font-semibold text-slate-950">主料 82% | 辅料 100%</p></div>
          <div class="min-w-0"><p class="text-slate-500">预计达成</p><p class="mt-1 truncate font-semibold text-slate-950">按当前节奏可准时</p></div>
        </div>
      </div>
      <div class="col-span-2 space-y-3 rounded-lg border bg-background p-4 2xl:col-span-1">
        ${labels.map((label, index) => `
          <div class="grid grid-cols-[90px_1fr_42px] items-center gap-3 text-sm">
            <span class="font-medium text-slate-700">${escapeHtml(label)}</span>
            <div class="h-2 rounded-full bg-slate-200">
              <div class="h-full rounded-full ${index === 0 ? 'bg-emerald-500' : index === 1 ? 'bg-blue-500' : index === 2 ? 'bg-orange-500' : 'bg-violet-500'}" style="width:${values[index]}%"></div>
            </div>
            <span class="text-right font-semibold text-slate-700">${values[index]}%</span>
          </div>
        `).join('')}
      </div>
    </article>
  `
}

function renderDetailHeader(order: ProductionOrderTrackingRecord, tab: TrackingTab): string {
  return `
    <div class="space-y-3">
      <header class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <button class="flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-nav="${BASE_PATH}">
            ${renderIcon('ArrowLeft', 'h-4 w-4')}
          </button>
          <h1 class="text-xl font-semibold">生产单全生命周期跟踪 / ${escapeHtml(order.no)}</h1>
        </div>
        <div class="flex items-center gap-2">
          <button class="inline-flex h-8 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted"
            data-production-order-progress-action="open-modal"
            data-modal-title="导出全生命周期跟踪"
            data-modal-tone="green"
            data-modal-body="${escapeHtml(order.no)} 的概览、时间、数量、工单、交接与结算数据已加入导出队列。"
            data-skip-page-rerender="true">${renderIcon('Download', 'h-4 w-4')}导出</button>
          <button class="inline-flex h-8 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted"
            data-production-order-progress-action="open-modal"
            data-modal-title="刷新完成"
            data-modal-body="已刷新当前生产单进度跟踪数据。"
            data-skip-page-rerender="true">${renderIcon('RefreshCw', 'h-4 w-4')}刷新</button>
          <button class="inline-flex h-8 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted"
            data-production-order-progress-action="open-modal"
            data-modal-title="更多操作"
            data-modal-body="可继续承接提醒跟单员、复制链接、打印进度报告等操作。"
            data-skip-page-rerender="true">${renderIcon('MoreHorizontal', 'h-4 w-4')}更多${renderIcon('ChevronDown', 'h-4 w-4')}</button>
        </div>
      </header>
      <section class="grid gap-4 xl:grid-cols-[330px_1fr] 2xl:grid-cols-[340px_1fr]">
        ${renderCountdownCard(order)}
        ${renderOrderHero(order, tab)}
      </section>
      <nav class="flex items-center gap-6 rounded-lg border bg-card px-4" data-production-order-progress-tabs>
        ${TAB_ITEMS.map((item) => `
          <button
            class="relative h-10 text-sm font-medium ${item.key === tab ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}"
            data-production-order-progress-tab="${item.key}"
            data-production-order-progress-action="switch-tab"
            data-order-no="${escapeHtml(order.no)}"
            data-tab="${item.key}"
            data-skip-page-rerender="true"
          >
            ${escapeHtml(item.label)}
            ${item.key === tab ? '<span data-tab-underline class="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600"></span>' : ''}
          </button>
        `).join('')}
      </nav>
    </div>
  `
}

function renderSmallStat(label: string, value: string, hint: string, tone = 'text-foreground'): string {
  return `
    <article class="rounded-lg border bg-card p-4">
      <p class="text-sm text-muted-foreground">${escapeHtml(label)}</p>
      <p class="mt-2 text-2xl font-bold ${tone}">${escapeHtml(value)}</p>
      <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(hint)}</p>
    </article>
  `
}

function renderOverviewMatrix(order: ProductionOrderTrackingRecord, selectedNode?: string): string {
  const selectedId = selectedNode ?? getSelectedNode('CT-240618-03')
  const selected = overviewNodes.find((node) => node.id === selectedId) ?? overviewNodes[7]
  const stages = ['生产需求', '技术包', '生产单创建', '印花需求', '染色需求', '印染配料', '裁片单', '唛架方案', '铺布', '裁剪/菲票', '特殊工艺', '车缝', '后道复检交出']
  const lanes = ['主线', '印花链路', '染色链路', '物料链路', '裁床链路', '车缝链路', '后道链路']
  return `
    <section class="grid grid-cols-[minmax(0,1fr)_300px] gap-4">
      <div class="min-w-0 rounded-lg border bg-card p-4">
        <h2 class="text-base font-semibold">多泳道生命周期矩阵</h2>
        <div class="mt-4 overflow-x-auto">
          <div class="grid min-w-[1104px] gap-2" style="grid-template-columns:90px repeat(13, 78px);">
            <div></div>
            ${stages.map((stage) => `<div class="rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-center text-xs font-semibold text-slate-700">${escapeHtml(stage)}</div>`).join('')}
            ${lanes.map((lane, index) => `
              <div class="flex h-[76px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">${escapeHtml(lane)}</div>
              ${Array.from({ length: 13 }, (_, colIndex) => {
                const node = overviewNodes.find((item) => item.lane === lane && item.col === colIndex + 1)
                if (!node) return '<div class="h-[76px] rounded-lg border border-dashed border-slate-100"></div>'
                return `
                  <button
                    class="h-[76px] rounded-lg border bg-background p-2 text-left transition hover:bg-muted/40 ${selected.id === node.id ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-100' : 'hover:border-blue-300'}"
                    data-production-order-progress-action="select-node"
                    data-order-no="${escapeHtml(order.no)}"
                    data-tab="overview"
                    data-node="${escapeHtml(node.id)}"
                    data-skip-page-rerender="true"
                  >
                    <p class="truncate text-xs font-bold text-slate-900">${escapeHtml(node.id)}</p>
                    <p class="mt-1 truncate text-xs text-slate-700">${escapeHtml(node.date)}　${escapeHtml(node.qty ?? '')}</p>
                    <span class="mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[11px] ${statusClassMap[node.status]}">${escapeHtml(node.status)}</span>
                  </button>
                `
              }).join('')}
            `).join('')}
          </div>
        </div>
      </div>
      <aside class="rounded-lg border bg-card p-4">
        <h2 class="text-base font-semibold">当前卡点详情</h2>
        <div class="mt-5 rounded-lg border border-orange-200 bg-orange-50 p-4">
          <div class="flex items-center justify-between">
            <p class="font-semibold text-slate-950">${escapeHtml(selected.label)} ${escapeHtml(selected.id)}</p>
            ${renderStatusBadge(selected.status)}
          </div>
          <dl class="mt-4 space-y-3 text-sm text-slate-600">
            <div class="flex justify-between"><dt>计划时间</dt><dd class="font-medium text-slate-900">06-11 08:00 ~ 06-12 20:00</dd></div>
            <div class="flex justify-between"><dt>实际时间</dt><dd class="font-medium text-slate-900">06-11 12:30 ~ 进行中</dd></div>
            <div class="flex justify-between"><dt>计划数量</dt><dd class="font-medium text-slate-900">3,800 件</dd></div>
            <div class="flex justify-between"><dt>实际数量</dt><dd class="font-medium text-slate-900">3,620 件（95.3%）</dd></div>
          </dl>
          <p class="mt-4 text-sm leading-6 text-slate-700">${escapeHtml(selected.detail)}</p>
          <div class="mt-4 space-y-2 text-sm">
            <p class="font-semibold text-slate-900">上下游</p>
            <p class="text-slate-600">上游：领料批次已完成，部分印花批次回仓延迟。</p>
            <p class="text-slate-600">下游：影响唛架方案 V2、铺布批次 PB-240618-02。</p>
          </div>
          <button class="mt-5 h-10 w-full rounded-lg border border-blue-500 text-sm font-semibold text-blue-600"
            data-production-order-progress-action="open-modal"
            data-modal-title="${escapeHtml(selected.label)} 详情"
            data-modal-body="${escapeHtml(selected.detail)}"
            data-skip-page-rerender="true">查看详情</button>
        </div>
      </aside>
    </section>
  `
}

function renderOverviewTab(order: ProductionOrderTrackingRecord, selectedNode?: string): string {
  return `
    <div class="space-y-4">
      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        ${renderSmallStat('当前状态', '进行中', '按当前节奏可准时', 'text-emerald-600')}
        ${renderSmallStat('主卡点', '裁片单 CT-240618-03', '预计延迟 1.5 天', 'text-orange-600')}
        ${renderSmallStat('已完成节点 / 总节点', '28 / 56', '50%')}
        ${renderSmallStat('已生成对象数', '132 个', '查看明细 >')}
        ${renderSmallStat('异常数', '8 个', '3 个高风险', 'text-red-600')}
        ${renderSmallStat('待处理数', '15 个', '含逾期 6 个', 'text-orange-600')}
      </section>
      ${renderOverviewMatrix(order, selectedNode)}
      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-base font-semibold">关键对象实时账</h2>
        ${renderLedgerTable(['对象类型', '对象编号 / 批次', '版本 / 批次', '计划时间', '实际时间', '计划数量（件）', '实际数量（件）', '完成度', '状态', '差异（件）', '差异原因', '当前责任方', '操作'], [
          ['配料记录', 'M-240618-01', '批次01', '06-07 ~ 06-08', '06-07 ~ 06-08', '5,000', '5,000', '100%', '已完成', '0', '-', '印花厂 · 张三', '查看'],
          ['配料记录', 'M-240618-02', '批次02', '06-09 ~ 06-10', '06-09 ~ 进行中', '3,600', '3,200', '88.9%', '进行中', '-400', '到货延迟', '印花厂 · 张三', '查看'],
          ['领料记录', 'L-240618-02', '批次02', '06-11', '06-11', '3,800', '3,800', '100%', '已完成', '0', '-', '裁床1 · 王五', '查看'],
          ['唛架方案', 'VM-240618-V2', 'V2', '06-10', '06-10', '8,600', '8,600', '100%', '进行中', '0', '-', '裁床1 · 李四', '查看'],
          ['铺布记录', 'PB-240618-02', '批次02', '06-11', '06-11', '4,300', '4,100', '95.3%', '进行中', '-200', '短横耗损', '裁床1 · 赵六', '查看'],
        ])}
      </section>
    </div>
  `
}

function renderTimelineTab(order: ProductionOrderTrackingRecord, selectedNode?: string): string {
  const selectedId = selectedNode ?? getSelectedNode('printing-v1')
  const selected = timelineItems.find((item) => item.id === selectedId) ?? timelineItems[4]
  const dates = ['05-31', '06-01', '06-02', '06-03', '06-04', '06-05', '06-06', '06-07', '06-08', '06-09', '06-10', '06-11', '06-12', '06-13', '06-14', '06-15', '06-16', '06-17', '06-18', '06-19', '06-20']
  const lanes = ['主线', '印花', '染色', '配料 / 领料', '裁床', '特殊工艺', '车缝', '后道复检交出']
  return `
    <div class="space-y-4">
      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        ${renderSmallStat('计划开始', '2026-06-01', '周一')}
        ${renderSmallStat('当前时间位置', '2026-06-11 10:30', '第 11 天 / 共 49 天')}
        ${renderSmallStat('计划交付', '2026-06-25', '周四')}
        ${renderSmallStat('已耗时', '10 天 3 小时', '20.5%')}
        ${renderSmallStat('剩余天数', '14 天', '79.5%', 'text-emerald-600')}
        ${renderSmallStat('预计延期 / 提前', '+8 天', '预计 2026-07-03 交付', 'text-red-600')}
        ${renderSmallStat('关键延误节点数', '8 个', '占全部节点 22%', 'text-orange-600')}
      </section>
      <section class="grid grid-cols-[minmax(0,1fr)_330px] gap-4">
        <div class="min-w-0 rounded-lg border bg-card p-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold">生产全生命周期时间轴（计划 vs 实际）</h2>
            <div class="flex items-center gap-4 text-xs text-slate-500">
              <span class="inline-flex items-center gap-1"><span class="h-2 w-4 rounded bg-emerald-500"></span>准时</span>
              <span class="inline-flex items-center gap-1"><span class="h-2 w-4 rounded bg-orange-500"></span>风险</span>
              <span class="inline-flex items-center gap-1"><span class="h-2 w-4 rounded bg-red-500"></span>延误</span>
              <span class="inline-flex items-center gap-1"><span class="h-3 w-px bg-blue-600"></span>今日</span>
            </div>
          </div>
          <div class="mt-4 overflow-x-auto">
            <div class="relative grid min-w-[1500px]" style="grid-template-columns:128px repeat(21, 64px);">
              <div class="border-b border-slate-200 bg-slate-50 p-2 text-xs font-semibold text-slate-500">阶段 / 节点</div>
              ${dates.map((date, index) => `<div class="border-b border-l border-slate-200 bg-slate-50 p-2 text-center text-xs ${index === 11 ? 'font-bold text-blue-600' : 'text-slate-500'}">${date}<br/>周${['日', '一', '二', '三', '四', '五', '六'][index % 7]}</div>`).join('')}
              <div class="absolute bottom-0 top-9 w-px bg-blue-600" style="left:${128 + 11 * 64 + 32}px"></div>
              ${lanes.map((lane) => `
                <div class="flex h-20 items-center border-b border-slate-100 bg-white px-3 text-sm font-semibold text-slate-700">${escapeHtml(lane)}</div>
                ${dates.map((_, index) => {
                  const item = timelineItems.find((task) => task.lane === lane && task.start === index + 1)
                  if (!item) return '<div class="h-20 border-b border-l border-slate-100"></div>'
                  const color = item.status === '已完成' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : item.status === '准时' ? 'border-blue-200 bg-blue-50 text-blue-700' : item.status === '风险' ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-red-200 bg-red-50 text-red-700'
                  return `
                    <div class="relative h-20 border-b border-l border-slate-100" style="grid-column: span ${item.span};">
                      <button
                        class="absolute left-1 right-1 top-3 rounded-md border px-3 py-2 text-left text-xs ${selected.id === item.id ? 'ring-2 ring-blue-300 ' : ''}${color}"
                        data-production-order-progress-action="select-node"
                        data-order-no="${escapeHtml(order.no)}"
                        data-tab="timeline"
                        data-node="${escapeHtml(item.id)}"
                        data-skip-page-rerender="true"
                      >
                        <span class="font-semibold">${escapeHtml(item.label)}</span>
                        <span class="ml-2">${escapeHtml(item.date)}</span>
                        ${item.offset ? `<span class="float-right font-semibold">${escapeHtml(item.offset)}</span>` : ''}
                      </button>
                    </div>
                  `
                }).join('')}
              `).join('')}
            </div>
          </div>
        </div>
        <aside class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">时间节点详情</h2>
          <div class="mt-4 space-y-4 text-sm">
            ${badge(selected.status === '延误' ? '延误 +2天' : selected.status, selected.status === '延误' ? 'border-red-200 bg-red-50 text-red-600' : 'border-orange-200 bg-orange-50 text-orange-600')}
            <h3 class="text-base font-bold text-slate-950">${escapeHtml(selected.label)}</h3>
            <dl class="space-y-2 text-slate-600">
              <div class="flex justify-between"><dt>所属阶段</dt><dd class="font-medium text-slate-900">${escapeHtml(selected.lane)}</dd></div>
              <div class="flex justify-between"><dt>计划时间</dt><dd class="font-medium text-slate-900">2026-06-04 ~ 2026-06-06</dd></div>
              <div class="flex justify-between"><dt>实际时间</dt><dd class="font-medium text-slate-900">2026-06-04 ~ 2026-06-08</dd></div>
              <div class="flex justify-between"><dt>偏差</dt><dd class="font-medium text-red-600">+2 天</dd></div>
              <div class="flex justify-between"><dt>状态</dt><dd class="font-medium text-red-600">延误</dd></div>
            </dl>
            <div class="border-t border-slate-100 pt-4">
              <p class="font-semibold text-slate-900">延误原因</p>
              <p class="mt-2 leading-6 text-slate-600">印花印版制作周期延长，导致印花首批产出延后。</p>
            </div>
            <div>
              <p class="font-semibold text-slate-900">上下游影响</p>
              <p class="mt-2 leading-6 text-slate-600">影响裁床、铺布和后续车缝排产等 3 个下游节点。</p>
            </div>
            <div>
              <p class="font-semibold text-slate-900">恢复计划</p>
              <p class="mt-2 leading-6 text-slate-600">已加急制作并优先排产，预计 06-09 完成并衔接裁床工序。</p>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <button class="h-10 rounded-lg border border-blue-500 text-sm font-semibold text-blue-600"
                data-production-order-progress-action="open-modal"
                data-modal-title="关联工单"
                data-modal-body="${escapeHtml(selected.label)} 已关联印花工单、配料批次和裁床计划。"
                data-skip-page-rerender="true">查看关联工单</button>
              <button class="h-10 rounded-lg bg-blue-600 text-sm font-semibold text-white"
                data-production-order-progress-action="open-modal"
                data-modal-title="标记已解决"
                data-modal-tone="green"
                data-modal-body="${escapeHtml(selected.label)} 的延误处理动作已模拟闭环。"
                data-skip-page-rerender="true">标记已解决</button>
            </div>
          </div>
        </aside>
      </section>
      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-base font-semibold">关键里程碑与节点里程账本</h2>
        ${renderLedgerTable(['节点名称', '所属阶段', '计划开始', '计划结束', '实际开始', '实际结束', '偏差', '状态', '责任方', '影响范围'], [
          ['印花生产（噪喱 v1）', '印花', '2026-06-04', '2026-06-06', '2026-06-04', '2026-06-08', '+2 天', '延误', '印花2厂', '影响裁床、铺布、车缝'],
          ['配料批次3', '配料 / 领料', '2026-06-06', '2026-06-07', '2026-06-06', '2026-06-08', '+1 天', '风险', '物控部', '影响领料批次2-3'],
          ['铺布批次1', '裁床', '2026-06-10', '2026-06-12', '2026-06-11', '2026-06-13', '+1 天', '延误', '裁床1厂', '影响车缝生产开始时间'],
          ['车缝生产（流水1-3线）', '车缝', '2026-06-12', '2026-06-19', '2026-06-12', '2026-06-22', '+3 天', '延误', '车缝3厂', '影响后道复检交出'],
        ])}
      </section>
    </div>
  `
}

function renderQuantityTab(order: ProductionOrderTrackingRecord, selectedNode?: string): string {
  const selectedId = selectedNode ?? getSelectedNode('spreading-b')
  const selected = quantityFlow.find((node) => node.id === selectedId) ?? quantityFlow[5]
  return `
    <div class="space-y-4">
      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        ${renderSmallStat('订单总量', '8,600 件', '100.00%')}
        ${renderSmallStat('已配料', '8,600 件', '100.00%')}
        ${renderSmallStat('已领料', '8,500 件', '98.84%')}
        ${renderSmallStat('已裁数量', '8,420 件', '97.91%')}
        ${renderSmallStat('已交出数量', '8,360 件', '97.21%')}
        ${renderSmallStat('车缝完成', '8,220 件', '95.58%')}
        ${renderSmallStat('后道复检通过', '8,160 件', '94.88%')}
        ${renderSmallStat('数量差异/损耗', '440 件', '5.12%', 'text-red-600')}
      </section>
      <section class="grid grid-cols-[minmax(0,1fr)_330px] gap-4">
        <div class="min-w-0 rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">数量流转全景图（单位：件）</h2>
          <div class="mt-6 overflow-x-auto">
            <div class="flex min-w-[1380px] items-center gap-4">
              ${quantityFlow.map((node, index) => `
                <button
                  class="w-40 shrink-0 rounded-lg border bg-background p-4 text-left transition hover:bg-muted/40 ${selected.id === node.id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'hover:border-blue-300'}"
                  data-production-order-progress-action="select-node"
                  data-order-no="${escapeHtml(order.no)}"
                  data-tab="quantity"
                  data-node="${escapeHtml(node.id)}"
                  data-skip-page-rerender="true"
                >
                  <p class="text-sm font-bold text-slate-950">${escapeHtml(node.label)}</p>
                  <dl class="mt-3 space-y-1 text-xs">
                    <div class="flex justify-between"><dt class="text-slate-500">计划数量</dt><dd class="font-semibold">${formatNumber(node.plan)}</dd></div>
                    <div class="flex justify-between"><dt class="text-slate-500">实际数量</dt><dd class="font-semibold">${formatNumber(node.actual)}</dd></div>
                    <div class="flex justify-between"><dt class="text-slate-500">差异数量</dt><dd class="${node.diff < 0 ? 'text-red-600' : 'text-slate-700'} font-semibold">${node.diff}</dd></div>
                    <div class="flex justify-between"><dt class="text-slate-500">良品率</dt><dd class="font-semibold">${escapeHtml(node.rate)}</dd></div>
                  </dl>
                  <div class="mt-3">${renderStatusBadge(node.status)}</div>
                </button>
                ${index < quantityFlow.length - 1 ? `<div class="shrink-0 text-blue-400">${renderIcon('ArrowRight', 'h-6 w-6')}</div>` : ''}
              `).join('')}
            </div>
          </div>
        </div>
        <aside class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">数量差异详情</h2>
          <div class="mt-5 space-y-4 text-sm">
            <div class="flex items-center justify-between">
              <h3 class="text-base font-bold text-slate-950">${escapeHtml(selected.label)}</h3>
              ${renderStatusBadge(selected.status)}
            </div>
            <dl class="space-y-2 text-slate-600">
              <div class="flex justify-between"><dt>计划数量</dt><dd class="font-medium text-slate-900">${formatNumber(selected.plan)} 件</dd></div>
              <div class="flex justify-between"><dt>实际数量</dt><dd class="font-medium text-slate-900">${formatNumber(selected.actual)} 件</dd></div>
              <div class="flex justify-between"><dt>差异数量</dt><dd class="font-medium text-red-600">${selected.diff} 件</dd></div>
              <div class="flex justify-between"><dt>报耗件数</dt><dd class="font-medium text-slate-900">50 件</dd></div>
              <div class="flex justify-between"><dt>质检不良</dt><dd class="font-medium text-slate-900">30 件</dd></div>
              <div class="flex justify-between"><dt>退回数量</dt><dd class="font-medium text-slate-900">10 件</dd></div>
              <div class="flex justify-between"><dt>补布数量</dt><dd class="font-medium text-slate-900">0 件</dd></div>
              <div class="flex justify-between"><dt>净损耗数量</dt><dd class="font-medium text-red-600">80 件</dd></div>
            </dl>
            <div class="border-t border-slate-100 pt-4">
              <p class="font-semibold text-slate-900">差异原因分析</p>
              <p class="mt-2 leading-6 text-slate-600">铺布夹层、压伤、跳针坏片等造成正常损耗。</p>
            </div>
            <p class="font-semibold text-slate-900">下一步动作</p>
            <p class="leading-6 text-slate-600">关注裁剪交出及特殊工艺损耗控制。</p>
            <button class="h-10 w-full rounded-lg border border-blue-500 text-sm font-semibold text-blue-600"
              data-production-order-progress-action="open-modal"
              data-modal-title="关联数量记录"
              data-modal-body="${escapeHtml(selected.label)} 已关联配料、领料、铺布、质检和报耗记录。"
              data-skip-page-rerender="true">查看关联记录</button>
          </div>
        </aside>
      </section>
      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-base font-semibold">数量台账明细（按生命周期顺序）</h2>
        ${renderLedgerTable(['序号', '环节', '单据编号', '数量口径说明', '计划数量', '实际数量', '差异数量', '差异率', '良品率/损耗率', '差异原因分类', '关键备注', '记录时间', '操作'], [
          ['1', '配料记录', 'MR-240618-01', '按配料入仓数量', '8,600', '8,600', '0', '0.00%', '99.80%', '正常损耗', '染整克重偏差、缩水率', '06-11 09:18', '查看'],
          ['2', '领料记录', 'ISS-240618-01', '按车间实际领用数量', '8,600', '8,500', '-100', '-1.16%', '98.84%', '小片损耗', '领用报损', '06-11 10:05', '查看'],
          ['3', '唛架方案', 'MK-240618-A/B', '按排版可裁片数合计', '8,600', '8,420', '-180', '-2.09%', '97.60%', '排版耗损', '版型排布优化空间', '06-11 11:22', '查看'],
          ['4', '铺布记录', 'PB-240618-02/03', '按铺布实际可裁数量合计', '8,600', '8,400', '-200', '-2.33%', '97.03%', '夹层损耗', '铺布张力/对格偏差', '06-11 12:48', '查看'],
          ['5', '后道复检交出', 'QC-240618-01', '按后道复检合格件数', '8,360', '8,160', '-200', '-2.39%', '94.88%', '破洞、污渍、尺寸', '报损单 QC-240618-11', '06-12 11:10', '查看'],
        ])}
      </section>
    </div>
  `
}

function renderWorkordersTab(order: ProductionOrderTrackingRecord, selectedNode?: string): string {
  const selectedId = selectedNode ?? getSelectedNode('PF-240618-02')
  const selected = workOrderNodes.find((node) => node.id === selectedId) ?? workOrderNodes[1]
  const lanes = ['印花需求', '染色需求', '印染配料', '裁片单', '特殊工艺', '车缝', '后道复检交出']
  return `
    <div class="space-y-4">
      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        ${renderSmallStat('已生成工单数', '78', '较昨日 +6')}
        ${renderSmallStat('进行中工单', '32', '较昨日 +4', 'text-blue-600')}
        ${renderSmallStat('待审核工单', '12', '较昨日 -1', 'text-orange-600')}
        ${renderSmallStat('已回仓工单', '21', '较昨日 +2', 'text-violet-600')}
        ${renderSmallStat('异常工单', '5', '较昨日 +1', 'text-red-600')}
        ${renderSmallStat('分支覆盖率', '92%', '较昨日 +3%')}
      </section>
      <section class="grid grid-cols-[minmax(0,1fr)_330px] gap-4">
        <div class="min-w-0 rounded-lg border bg-card p-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold">分支拓扑视图</h2>
            <div class="flex gap-2">
              <button class="h-8 rounded-md border border-slate-200 px-3 text-xs"
                data-production-order-progress-action="open-modal"
                data-modal-title="展开全部"
                data-modal-body="已展开当前生产单下全部工单分支。"
                data-skip-page-rerender="true">展开全部</button>
              <button class="h-8 rounded-md border border-slate-200 px-3 text-xs"
                data-production-order-progress-action="open-modal"
                data-modal-title="显示设置"
                data-modal-body="可配置工单类型、状态、责任方和连线层级。"
                data-skip-page-rerender="true">显示设置</button>
              <button class="h-8 rounded-md border border-slate-200 px-3 text-xs"
                data-production-order-progress-action="open-modal"
                data-modal-title="全屏拓扑"
                data-modal-body="已进入工单拓扑全屏查看模式的原型响应。"
                data-skip-page-rerender="true">全屏</button>
            </div>
          </div>
          <div class="mt-5 overflow-x-auto">
            <div class="min-w-[1280px] rounded-xl border border-slate-100">
              <div class="border-b border-blue-200 bg-blue-50 px-5 py-2 text-center text-sm font-semibold text-blue-700">
                生产单：${escapeHtml(order.no)}（${escapeHtml(order.title)}）　${formatNumber(order.quantity)} 件
              </div>
              ${lanes.map((lane) => `
                <div class="grid min-h-20 grid-cols-[150px_1fr] border-b border-slate-100 last:border-b-0">
                  <div class="flex items-center border-r border-slate-100 bg-slate-50 px-4 text-sm font-semibold text-slate-700">${escapeHtml(lane)}</div>
                  <div class="flex items-center gap-4 overflow-hidden px-4 py-3">
                    ${workOrderNodes.filter((node) => node.lane === lane).map((node, index, list) => `
                      <button
                        class="w-36 rounded-lg border bg-background px-3 py-2 text-left text-xs transition hover:bg-muted/40 ${selected.id === node.id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'hover:border-blue-300'}"
                        data-production-order-progress-action="select-node"
                        data-order-no="${escapeHtml(order.no)}"
                        data-tab="workorders"
                        data-node="${escapeHtml(node.id)}"
                        data-skip-page-rerender="true"
                      >
                        <p class="font-bold text-slate-950">${escapeHtml(node.label)}</p>
                        <p class="mt-1 text-slate-500">${escapeHtml(node.subLabel)}</p>
                        <span class="mt-2 inline-flex rounded-full border px-1.5 py-0.5 text-[11px] ${statusClassMap[node.status]}">${escapeHtml(node.status)}</span>
                      </button>
                      ${index < list.length - 1 ? `<span class="text-slate-300">${renderIcon('ArrowRight', 'h-5 w-5')}</span>` : ''}
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        <aside class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">分支详情</h2>
          <div class="mt-5 space-y-4 text-sm">
            <div class="flex items-center justify-between">
              <h3 class="text-base font-bold text-slate-950">${escapeHtml(selected.lane)} ${escapeHtml(selected.id)}</h3>
              ${renderStatusBadge(selected.status)}
            </div>
            <dl class="space-y-2 text-slate-600">
              <div class="flex justify-between"><dt>来源对象</dt><dd class="font-medium text-slate-900">${escapeHtml(selected.lane)}需求</dd></div>
              <div class="flex justify-between"><dt>上游节点</dt><dd class="font-medium text-slate-900">印花需求 PF-240618-02</dd></div>
              <div class="flex justify-between"><dt>下游节点</dt><dd class="font-medium text-slate-900">印染配料 BP-240618-02</dd></div>
              <div class="flex justify-between"><dt>数量 / 单位</dt><dd class="font-medium text-slate-900">1,400 件</dd></div>
              <div class="flex justify-between"><dt>计划时间</dt><dd class="font-medium text-slate-900">06-16 08:00 ~ 06-18 18:00</dd></div>
              <div class="flex justify-between"><dt>实际时间</dt><dd class="font-medium text-slate-900">06-16 09:12 ~ 进行中</dd></div>
              <div class="flex justify-between"><dt>当前责任方</dt><dd class="font-medium text-slate-900">苏州印花厂（王建国）</dd></div>
            </dl>
            <div>
              <p class="font-semibold text-slate-900">相关附件</p>
              <div class="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-blue-600">PF-240618-02_生产派工单.pdf</div>
            </div>
            <div>
              <p class="font-semibold text-slate-900">相关记录</p>
              <p class="mt-2 text-slate-600">06-16 09:12 工单开始生产</p>
              <p class="text-slate-600">06-15 17:32 工单审核通过</p>
            </div>
            <button class="h-10 w-full rounded-lg border border-blue-500 text-sm font-semibold text-blue-600"
              data-production-order-progress-action="open-modal"
              data-modal-title="${escapeHtml(selected.id)} 完整详情"
              data-modal-body="${escapeHtml(selected.lane)} ${escapeHtml(selected.id)} 的计划、实际、责任方、附件和记录已展示。"
              data-skip-page-rerender="true">查看完整详情</button>
          </div>
        </aside>
      </section>
      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-base font-semibold">工单对象列表（共 78 条）</h2>
        ${renderLedgerTable(['工单类型', '工单编号', '来源对象', '当前节点', '计划 / 实际时间', '数量', '状态', '当前责任方', '操作'], [
          ['印花工单', 'PF-240618-02', '印花需求 PF-240618-02', '印花生产', '06-16 08:00 ~ 06-18 18:00 / 06-16 09:12 ~ 进行中', '1,400 件', '生产中', '苏州印花厂（王建国）', '查看 | 转派 | 更多'],
          ['染色工单', 'DY-240618-02', '染色需求 DY-240618-02', '染色生产', '06-15 08:00 ~ 06-18 18:00 / 06-15 09:20 ~ 进行中', '4,000 米', '相回仓', '苏州染仓（李小涵）', '查看 | 转派 | 更多'],
          ['印染配料', 'BP-240618-02', '印染需求 BP-240618-02', '配料生产', '06-14 08:30 ~ 06-16 18:30 / 06-14 09:05 ~ 进行中', '1 批次', '生产中', '苏州印染配料厂（陈勇）', '查看 | 转派 | 更多'],
          ['铺布工单', 'MS-240618-B1', '唛架方案 MK-240618-B', '铺布 第1次', '06-13 08:00 ~ 06-13 18:00 / 06-13 08:22 ~ 进行中', '1,100 件', '待审核', '苏州铺布车间（周丽）', '查看 | 转派 | 更多'],
        ])}
      </section>
    </div>
  `
}

function renderHandoverTab(order: ProductionOrderTrackingRecord, selectedNode?: string): string {
  const selectedId = selectedNode ?? getSelectedNode('HD-SEW-240618-03')
  const selected = handoverEvents.find((event) => event.id === selectedId) ?? handoverEvents[3]
  const stages = ['裁床 -> 车缝', '车缝 -> 后道', '后道 -> 复检交出', '复检交出 -> 仓库', '特殊工艺 -> 车缝']
  const lanes = ['裁床', '车缝', '特殊工艺', '后道', '复检 / 质检', '仓库']
  return `
    <div class="space-y-4">
      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        ${renderSmallStat('裁床交出批次', '28', '已接收 26')}
        ${renderSmallStat('车缝交出批次', '42', '已接收 40')}
        ${renderSmallStat('后道复检批次', '15', '已接收 13')}
        ${renderSmallStat('待签收', '4 批次', '3,210 件', 'text-orange-600')}
        ${renderSmallStat('差异异议', '3 批次', '980 件', 'text-red-600')}
        ${renderSmallStat('质检异常', '2 批次', '620 件', 'text-red-600')}
        ${renderSmallStat('返工对象', '1 批次', '320 件', 'text-blue-600')}
      </section>
      <section class="grid grid-cols-[minmax(0,1fr)_330px] gap-4">
        <div class="min-w-0 rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">交接事件时间线</h2>
          <div class="mt-4 overflow-x-auto">
            <div class="grid min-w-[1250px]" style="grid-template-columns:110px repeat(5, 220px);">
              <div class="border border-slate-100 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">阶段</div>
              ${stages.map((stage) => `<div class="border border-slate-100 bg-blue-50 px-3 py-2 text-center text-sm font-semibold text-blue-700">${escapeHtml(stage)}</div>`).join('')}
              ${lanes.map((lane) => `
                <div class="flex h-24 items-center border border-slate-100 bg-slate-50 px-3 text-sm font-semibold text-slate-700">${escapeHtml(lane)}</div>
                ${stages.map((stage) => {
                  const event = handoverEvents.find((item) => item.lane === lane && item.stage === stage)
                  if (!event) return '<div class="h-24 border border-slate-100"></div>'
                  return `
                    <div class="relative h-24 border border-slate-100 p-2">
                      <button
                        class="h-full w-full rounded-lg border bg-background px-3 py-2 text-left text-xs transition hover:bg-muted/40 ${selected.id === event.id ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-100' : 'hover:border-blue-300'}"
                        data-production-order-progress-action="select-node"
                        data-order-no="${escapeHtml(order.no)}"
                        data-tab="handover"
                        data-node="${escapeHtml(event.id)}"
                        data-skip-page-rerender="true"
                      >
                        <p class="font-bold text-blue-700">${escapeHtml(event.id)}</p>
                        <p class="mt-1 text-slate-600">交出：${escapeHtml(event.time)}</p>
                        <p class="text-slate-600">交出：${formatNumber(event.outQty)}　接收：${event.inQty ? formatNumber(event.inQty) : '--'}</p>
                        <span class="mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[11px] ${statusClassMap[event.status]}">${escapeHtml(event.status)}</span>
                      </button>
                    </div>
                  `
                }).join('')}
              `).join('')}
            </div>
          </div>
        </div>
        <aside class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">交接 / 质检详情</h2>
          <div class="mt-5 space-y-4 text-sm">
            <div class="flex items-center justify-between">
              <h3 class="text-base font-bold text-slate-950">${escapeHtml(selected.id)}</h3>
              ${renderStatusBadge(selected.status)}
            </div>
            <dl class="space-y-2 text-slate-600">
              <div class="flex justify-between"><dt>交出方</dt><dd class="font-medium text-slate-900">车缝一组（SEW-01）</dd></div>
              <div class="flex justify-between"><dt>接收方</dt><dd class="font-medium text-slate-900">后道整烫组（FIN-01）</dd></div>
              <div class="flex justify-between"><dt>交出时间</dt><dd class="font-medium text-slate-900">${escapeHtml(selected.time)}</dd></div>
              <div class="flex justify-between"><dt>接收时间</dt><dd class="font-medium text-slate-900">2026-06-14 11:05</dd></div>
              <div class="flex justify-between"><dt>交出数量</dt><dd class="font-medium text-slate-900">${formatNumber(selected.outQty)} 件</dd></div>
              <div class="flex justify-between"><dt>接收数量</dt><dd class="font-medium text-slate-900">${formatNumber(selected.inQty ?? selected.outQty)} 件</dd></div>
              <div class="flex justify-between"><dt>数量差异</dt><dd class="font-medium text-red-600">${(selected.inQty ?? selected.outQty) - selected.outQty} 件</dd></div>
            </dl>
            <div class="border-t border-slate-100 pt-4">
              <p class="font-semibold text-slate-900">质检节点</p>
              <p class="mt-2 text-slate-600">中检（车缝 -> 后道）</p>
              <p class="mt-1 text-slate-600">质检结论：部分合格；质检不良数：30 件（1.52%）</p>
            </div>
            <div>
              <p class="font-semibold text-slate-900">异议状态</p>
              <p class="mt-2 text-red-600">已发起异议，责任判定待判定。</p>
            </div>
            <div class="grid gap-2">
              <button class="h-10 rounded-lg bg-blue-600 text-sm font-semibold text-white"
                data-production-order-progress-action="open-modal"
                data-modal-title="质检记录"
                data-modal-body="${escapeHtml(selected.id)} 已关联中检、复检和差异异议处理记录。"
                data-skip-page-rerender="true">查看质检记录</button>
              <button class="h-10 rounded-lg border border-blue-500 text-sm font-semibold text-blue-600"
                data-production-order-progress-action="open-modal"
                data-modal-title="关联批次"
                data-modal-body="${escapeHtml(selected.id)} 已关联车缝交出批次、后道接收批次和仓库入仓批次。"
                data-skip-page-rerender="true">查看关联批次</button>
            </div>
          </div>
        </aside>
      </section>
      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-base font-semibold">交接与质检记录明细</h2>
        ${renderLedgerTable(['记录类型', '编号', '来源对象', '交出方 / 质检方', '接收方 / 被检方', '时间', '交出数量', '接收数量', '差异', '质量结论', '状态', '处理结果'], [
          ['交出记录', 'HD-CUT-240618-02', '裁床', '裁床一组（CUT-01）', '车缝一组（SEW-01）', '2026-06-11 14:20', '2,000', '1,980', '-20', '--', '部分接收', '补接收完成'],
          ['交出记录', 'HD-SEW-240618-03', '车缝', '车缝一组（SEW-01）', '后道整烫组（FIN-01）', '2026-06-14 09:20', '2,000', '1,970', '-30', '部分合格', '差异异议', '待处理'],
          ['质检记录', 'QC-MID-240614-03', '车缝 -> 后道', '品检组（QC-02）', '车缝一组（SEW-01）', '2026-06-14 11:05', '2,000', '1,970', '-30', '部分合格', '异常', '待处理'],
          ['质检记录', 'QC-RECHK-240618-01', '后道 -> 复检', '复检组（QC-RECHK-01）', '仓库质检组（QC-WH-01）', '2026-06-16 09:30', '1,850', '1,850', '0', '合格', '合格', '--'],
        ])}
      </section>
    </div>
  `
}

function renderSettlementTab(_order: ProductionOrderTrackingRecord): string {
  return `
    <div class="space-y-4">
      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        ${renderSmallStat('预计结算金额', '¥1,285,600.00', '含税')}
        ${renderSmallStat('已确认质量扣款', '¥32,450.00', '2.52% ↑')}
        ${renderSmallStat('待确认扣款', '¥8,760.00', '0.68%')}
        ${renderSmallStat('交期达成率', '93.3%', '提前 1 天', 'text-blue-600')}
        ${renderSmallStat('综合完成率', '98.6%', '良好', 'text-emerald-600')}
        ${renderSmallStat('复盘结论', '达成', '总体达成目标', 'text-emerald-600')}
      </section>
      <section class="grid grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div class="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          <article class="rounded-lg border bg-card p-4">
            <h2 class="text-base font-semibold">完成节点统计</h2>
            <div class="mt-5 flex items-center gap-6">
              <div class="flex h-36 w-36 items-center justify-center rounded-full" style="background:conic-gradient(#10b981 0 89%, #3b82f6 89% 94%, #ef4444 94% 100%);">
                <div class="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white">
                  <span class="text-3xl font-bold">19</span>
                  <span class="text-xs text-slate-500">总节点</span>
                </div>
              </div>
              <div class="space-y-2 text-sm">
                <p><span class="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500"></span>已完成　17　89.5%</p>
                <p><span class="mr-2 inline-block h-2 w-2 rounded-full bg-blue-500"></span>进行中　1　5.3%</p>
                <p><span class="mr-2 inline-block h-2 w-2 rounded-full bg-red-500"></span>未完成　1　5.3%</p>
              </div>
            </div>
          </article>
          <article class="rounded-lg border bg-card p-4">
            <h2 class="text-base font-semibold">成本构成（预结算）</h2>
            <div class="mt-5 grid grid-cols-[130px_1fr] gap-5">
              <div class="flex h-32 w-32 items-center justify-center rounded-full" style="background:conic-gradient(#3b82f6 0 51%, #10b981 51% 80%, #f97316 80% 88%, #94a3b8 88% 94%, #cbd5e1 94% 100%);">
                <div class="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white text-center">
                  <span class="text-sm font-bold">¥1,285,600</span>
                  <span class="text-xs text-slate-500">总金额</span>
                </div>
              </div>
              <div class="space-y-2 text-sm text-slate-600">
                <p>面辅料　¥653,480　50.8%</p>
                <p>加工费　¥384,600　29.9%</p>
                <p>包装费　¥108,200　8.4%</p>
                <p>物流费　¥68,350　5.3%</p>
                <p>其他费用　¥70,970　5.6%</p>
              </div>
            </div>
          </article>
          <article class="rounded-lg border bg-card p-4">
            <h2 class="text-base font-semibold">质量扣款流程</h2>
            <div class="mt-6 flex items-center justify-between text-xs text-slate-600">
              ${['发现问题', '供应商确认', '扣款评审', '财务入账'].map((step, index) => `
                <div class="flex flex-1 items-center">
                  <div class="text-center">
                    <span class="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">${index + 1}</span>
                    <p class="mt-2">${escapeHtml(step)}</p>
                  </div>
                  ${index < 3 ? '<div class="mx-2 h-1 flex-1 rounded-full bg-blue-500"></div>' : ''}
                </div>
              `).join('')}
            </div>
            <div class="mt-6 grid grid-cols-4 gap-3 text-center text-sm">
              <div><p class="text-slate-500">已发生</p><p class="mt-1 font-bold">¥41,210</p></div>
              <div><p class="text-slate-500">已确认</p><p class="mt-1 font-bold">¥32,450</p></div>
              <div><p class="text-slate-500">待确认</p><p class="mt-1 font-bold">¥8,760</p></div>
              <div><p class="text-slate-500">已入账</p><p class="mt-1 font-bold">¥32,450</p></div>
            </div>
          </article>
          <article class="rounded-lg border bg-card p-4">
            <h2 class="text-base font-semibold">异议处理进度</h2>
            <div class="mt-6 flex items-center justify-between text-xs">
              ${['已登记', '供应商处理', '复审中', '已关闭'].map((step) => `
                <div class="text-center">
                  <span class="mx-auto block h-3 w-3 rounded-full bg-emerald-500"></span>
                  <p class="mt-2 text-slate-600">${escapeHtml(step)}</p>
                </div>
              `).join('')}
            </div>
            <div class="mt-6 grid grid-cols-4 gap-3 text-center text-sm">
              <div><p class="text-slate-500">总数</p><p class="mt-1 font-bold">5</p></div>
              <div><p class="text-slate-500">处理中</p><p class="mt-1 font-bold text-orange-600">1</p></div>
              <div><p class="text-slate-500">待复审</p><p class="mt-1 font-bold text-red-600">1</p></div>
              <div><p class="text-slate-500">已关闭</p><p class="mt-1 font-bold">3</p></div>
            </div>
          </article>
          <article class="rounded-lg border bg-card p-4">
            <h2 class="text-base font-semibold">交期表现</h2>
            <div class="mt-4 space-y-4 text-sm">
              ${[
                ['计划交付', '2026-06-25', 'w-[90%]'],
                ['实际交付', '2026-06-24', 'w-[84%]'],
                ['偏差', '-1 天', 'w-[28%]'],
                ['交期达成率', '93.3%', 'w-[82%]'],
              ].map(([label, value, width]) => `
                <div class="grid grid-cols-[80px_1fr_90px] items-center gap-3">
                  <span class="text-slate-500">${escapeHtml(label)}</span>
                  <div class="h-2 rounded-full bg-slate-200"><div class="h-full rounded-full bg-blue-500 ${width}"></div></div>
                  <span class="text-right font-semibold">${escapeHtml(value)}</span>
                </div>
              `).join('')}
            </div>
          </article>
          <article class="rounded-lg border bg-card p-4">
            <h2 class="text-base font-semibold">主要异常原因排行</h2>
            <div class="mt-4 space-y-3 text-sm">
              ${[
                ['面料辅料延期到货', '42.1%', 'w-[72%]'],
                ['产线效率低于标准', '21.1%', 'w-[45%]'],
                ['工艺返工', '15.8%', 'w-[34%]'],
                ['人员出勤不足', '10.5%', 'w-[24%]'],
                ['质检不良返修', '10.5%', 'w-[24%]'],
              ].map(([label, value, width], index) => `
                <div class="grid grid-cols-[18px_120px_1fr_50px] items-center gap-2">
                  <span class="text-slate-500">${index + 1}</span>
                  <span>${escapeHtml(label)}</span>
                  <div class="h-2 rounded-full bg-slate-200"><div class="h-full rounded-full bg-blue-500 ${width}"></div></div>
                  <span class="text-right">${escapeHtml(value)}</span>
                </div>
              `).join('')}
            </div>
          </article>
        </div>
        <aside class="rounded-lg border bg-card p-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">复盘结论</h2>
            ${badge('达成', 'border-emerald-200 bg-emerald-50 text-emerald-700')}
          </div>
          <div class="mt-5 space-y-3">
            ${[
              ['交期目标', '提前 1 天交付，达成率 93.3%'],
              ['质量目标', '质量扣款率 2.52%，低于目标 3.00%'],
              ['成本目标', '实际成本 ¥1,178,550，低于预算 2.15%'],
            ].map(([label, text]) => `
              <div class="rounded-lg border border-slate-200 p-4">
                <p class="font-semibold text-slate-900">${escapeHtml(label)} ${badge('达成', 'border-emerald-200 bg-emerald-50 text-emerald-700')}</p>
                <p class="mt-2 text-sm text-slate-600">${escapeHtml(text)}</p>
              </div>
            `).join('')}
          </div>
          <div class="mt-5">
            <h3 class="font-semibold text-slate-950">关键根因 TOP3</h3>
            <ol class="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
              <li>面辅料延期到货（占比 42.1%）</li>
              <li>产线效率低于标准（占比 21.1%）</li>
              <li>工艺返工（占比 15.8%）</li>
            </ol>
          </div>
          <div class="mt-5 rounded-lg border border-slate-200 p-4">
            <h3 class="font-semibold text-slate-950">建议与跟进行动</h3>
            <ol class="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
              <li>优化面辅料供应商交期管控，建立预警机制。</li>
              <li>加强产线效率监控与人员技能培训。</li>
              <li>优化工艺标准，减少返工率。</li>
            </ol>
          </div>
        </aside>
      </section>
      <section class="rounded-lg border bg-card p-4">
        <div class="flex gap-6 border-b border-slate-100 text-sm font-semibold">
          <span class="border-b-2 border-blue-600 pb-3 text-blue-600">结算记录</span>
          <span class="pb-3 text-slate-500">质量扣款记录</span>
          <span class="pb-3 text-slate-500">异议单</span>
          <span class="pb-3 text-slate-500">复盘项</span>
        </div>
        ${renderLedgerTable(['对象类型', '编号', '金额（含税）', '数量影响', '时间', '状态', '责任方', '备注'], [
          ['预结算单', 'PS-202606-0018', '¥1,285,600.00', '8,600 件', '2026-06-18 10:22', '已确认', '万锦成衣厂', '含税预结算金额'],
          ['质量扣款单', 'QD-202606-0018-01', '-¥32,450.00', '-', '2026-06-20 15:40', '已入账', '采购部', '色差、缝制工艺不良'],
          ['异议单', 'DI-202606-0018-02', '-¥8,760.00', '-', '2026-06-19 11:30', '复审中', '质量部', '面料缩水未达标'],
          ['结算单', 'ST-202606-0018', '¥1,178,550.00', '8,600 件', '2026-06-24 16:05', '已完成', '财务部', '最终结算金额'],
        ])}
      </section>
    </div>
  `
}

function renderLedgerTable(headers: string[], rows: string[][]): string {
  return `
    <div class="mt-4 overflow-x-auto">
      <table class="min-w-full text-left text-sm">
        <thead class="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>${headers.map((header) => `<th class="whitespace-nowrap px-3 py-2 font-medium">${escapeHtml(header)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr class="border-b last:border-b-0">
              ${row.map((cell, index) => `<td class="whitespace-nowrap px-3 py-3 ${index === row.length - 1 ? 'font-medium text-blue-600' : cell.includes('-') && cell.includes('¥') ? 'text-red-600' : cell.startsWith('-') ? 'text-red-600' : 'text-slate-700'}">${escapeHtml(cell)}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderDetailBody(order: ProductionOrderTrackingRecord, tab: TrackingTab, selectedNode?: string): string {
  if (tab === 'timeline') return renderTimelineTab(order, selectedNode)
  if (tab === 'quantity') return renderQuantityTab(order, selectedNode)
  if (tab === 'workorders') return renderWorkordersTab(order, selectedNode)
  if (tab === 'handover') return renderHandoverTab(order, selectedNode)
  if (tab === 'settlement') return renderSettlementTab(order)
  return renderOverviewTab(order, selectedNode)
}

function renderDetailPage(): string {
  const order = getActiveOrder()
  const tab = getActiveTab()
  return `
    <div class="space-y-4"
      data-production-order-progress-root
      data-page-mode="detail"
      data-order-no="${escapeHtml(order.no)}"
      data-active-tab="${tab}">
      <div class="space-y-4">
        ${renderDetailHeader(order, tab)}
        <div data-production-order-progress-tab-body>
          ${renderDetailBody(order, tab)}
        </div>
      </div>
      <div data-production-order-progress-modal-host></div>
    </div>
  `
}

function isTrackingTab(value: string | undefined): value is TrackingTab {
  return Boolean(value && TAB_ITEMS.some((item) => item.key === value))
}

function findOrder(orderNo: string | undefined): ProductionOrderTrackingRecord {
  return orders.find((order) => order.no === orderNo) ?? orders[0]
}

function hydrateLocalIcons(root: ParentNode): void {
  requestAnimationFrame(() => hydrateIcons(root))
}

function setBrowserUrl(order: ProductionOrderTrackingRecord, tab: TrackingTab, node?: string): void {
  const nextUrl = buildDetailHref(order.no, tab, node)
  if (window.location.pathname + window.location.search !== nextUrl) {
    window.history.replaceState(window.history.state, '', nextUrl)
  }
}

function updateActiveTabNav(root: HTMLElement, tab: TrackingTab): void {
  const tabButtons = root.querySelectorAll<HTMLButtonElement>('[data-production-order-progress-tab]')
  tabButtons.forEach((button) => {
    const active = button.dataset.productionOrderProgressTab === tab
    button.className = `relative h-10 text-sm font-medium ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`
    button.querySelector('[data-tab-underline]')?.remove()
    if (active) {
      button.insertAdjacentHTML('beforeend', '<span data-tab-underline class="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600"></span>')
    }
  })
}

function replaceDetailBody(root: HTMLElement, order: ProductionOrderTrackingRecord, tab: TrackingTab, node?: string): void {
  const body = root.querySelector<HTMLElement>('[data-production-order-progress-tab-body]')
  if (!body) return
  body.innerHTML = renderDetailBody(order, tab, node)
  root.dataset.activeTab = tab
  updateActiveTabNav(root, tab)
  setBrowserUrl(order, tab, node)
  hydrateLocalIcons(body)
}

function renderProgressModal(title: string, body: string, tone: string): string {
  const toneClass = tone === 'green'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : tone === 'orange'
      ? 'bg-orange-50 text-orange-700 border-orange-200'
      : 'bg-blue-50 text-blue-700 border-blue-200'
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4" data-production-order-progress-modal>
      <section class="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${toneClass}">操作已响应</p>
            <h2 class="mt-3 text-lg font-bold text-slate-950">${escapeHtml(title)}</h2>
          </div>
          <button class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            data-production-order-progress-action="close-modal"
            data-skip-page-rerender="true"
            aria-label="关闭弹窗">${renderIcon('X', 'h-4 w-4')}</button>
        </div>
        <p class="mt-4 leading-6 text-slate-600">${escapeHtml(body)}</p>
        <div class="mt-5 flex justify-end gap-2">
          <button class="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700"
            data-production-order-progress-action="close-modal"
            data-skip-page-rerender="true">取消</button>
          <button class="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"
            data-production-order-progress-action="close-modal"
            data-skip-page-rerender="true">确认</button>
        </div>
      </section>
    </div>
  `
}

function openProgressModal(actionNode: HTMLElement): void {
  const root = actionNode.closest<HTMLElement>('[data-production-order-progress-root]') ?? document.body
  const host = root.querySelector<HTMLElement>('[data-production-order-progress-modal-host]') ?? root
  host.innerHTML = renderProgressModal(
    actionNode.dataset.modalTitle || '操作已响应',
    actionNode.dataset.modalBody || '该操作已在原型中完成响应。',
    actionNode.dataset.modalTone || 'blue',
  )
  hydrateLocalIcons(host)
}

function closeProgressModal(actionNode: HTMLElement): void {
  const root = actionNode.closest<HTMLElement>('[data-production-order-progress-root]') ?? document.body
  root.querySelector('[data-production-order-progress-modal]')?.remove()
}

function toggleOrderRow(actionNode: HTMLElement): void {
  const order = findOrder(actionNode.dataset.orderNo)
  const root = actionNode.closest<HTMLElement>('[data-production-order-progress-root]')
  if (!root) return

  const wasExpanded = actionNode.dataset.expanded === 'true'
  root.querySelectorAll('[data-production-order-expanded-row]').forEach((row) => row.remove())
  root.querySelectorAll<HTMLButtonElement>('[data-production-order-progress-action="toggle-row"]').forEach((button) => {
    button.dataset.expanded = 'false'
    button.textContent = '展开'
  })

  if (wasExpanded) return

  const row = root.querySelector<HTMLTableRowElement>(`[data-production-order-row="${CSS.escape(order.no)}"]`)
  row?.insertAdjacentHTML('afterend', renderExpandedRow(order))
  actionNode.dataset.expanded = 'true'
  actionNode.textContent = '收起'
}

export function handleProductionOrderProgressEvent(eventTarget: HTMLElement): boolean {
  const actionNode = eventTarget.closest<HTMLElement>('[data-production-order-progress-action]')
  const action = actionNode?.dataset.productionOrderProgressAction
  if (!action) return false

  if (action === 'open-modal') {
    openProgressModal(actionNode)
    return true
  }

  if (action === 'close-modal') {
    closeProgressModal(actionNode)
    return true
  }

  if (action === 'toggle-row') {
    toggleOrderRow(actionNode)
    return true
  }

  if (action === 'switch-tab') {
    const root = actionNode.closest<HTMLElement>('[data-production-order-progress-root]')
    const tab = isTrackingTab(actionNode.dataset.tab) ? actionNode.dataset.tab : 'overview'
    if (!root) return true
    replaceDetailBody(root, findOrder(actionNode.dataset.orderNo), tab)
    return true
  }

  if (action === 'select-node') {
    const root = actionNode.closest<HTMLElement>('[data-production-order-progress-root]')
    const tab = isTrackingTab(actionNode.dataset.tab) ? actionNode.dataset.tab : 'overview'
    if (!root) return true
    replaceDetailBody(root, findOrder(actionNode.dataset.orderNo), tab, actionNode.dataset.node)
    return true
  }

  return false
}

export async function renderProductionOrderProgressTrackingPage(): Promise<string> {
  const pathname = appStore.getState().pathname
  if (pathname.startsWith(DETAIL_PATH)) return renderDetailPage()
  return renderListPage()
}

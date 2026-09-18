import { PMS_STYLE_IMAGES } from './images.ts'

export type PmsTransitReceiptStatus = '待收货' | '收货中' | '已收货'

export interface PmsTransitMetric {
  key: string
  label: string
  value: number
  unit: string
  filter: string
}

export interface PmsTransitTrendPoint {
  date: string
  inbound: number
  outbound: number
}

export interface PmsTransitDistribution {
  label: string
  value: number
  tone: 'blue' | 'green' | 'yellow' | 'red' | 'slate'
}

export interface PmsTransitException {
  id: string
  title: string
  detail: string
  tone: 'yellow' | 'red'
  filter: string
}

export interface PmsTransitReceipt {
  receiptNo: string
  productionOrderNo: string
  styleName: string
  styleCode: string
  styleImageUrl: string
  qty: number
  boxCount: number
  fromFactory: string
  region: string
  warehouse: string
  status: PmsTransitReceiptStatus
  shippedAt: string
  receivedAt: string
  diffQty: number
  note: string
}

export interface PmsTransitOrderCheck {
  productionNo: string
  receivedStatus: '缺货' | '未收齐' | '已收齐'
  checkedAt: string
  note: string
}

export interface PmsTransitPreparationTask {
  taskId: string
  type: '已收齐配料' | '未收齐配料'
  productionNo: string
  qty: number
  unit: string
  owner: string
}

export interface PmsTransitCard {
  key: string
  label: string
  filter: string
  count: number
}

const receipts: PmsTransitReceipt[] = [
  { receiptNo: 'TR-2026-0001', productionOrderNo: 'PO-2026-0518', styleName: '男款圆领T恤', styleCode: 'TS-2601', styleImageUrl: PMS_STYLE_IMAGES.tshirt, qty: 6200, boxCount: 62, fromFactory: '广州华盛制衣有限公司', region: '广州', warehouse: '广州中转仓', status: '待收货', shippedAt: '2026-06-12 08:30', receivedAt: '', diffQty: 0, note: '' },
  { receiptNo: 'TR-2026-0002', productionOrderNo: 'PO-2026-0519', styleName: '女款休闲裤', styleCode: 'PT-2602', styleImageUrl: PMS_STYLE_IMAGES.pants, qty: 4800, boxCount: 48, fromFactory: '佛山成衣加工厂', region: '佛山', warehouse: '广州中转仓', status: '待收货', shippedAt: '2026-06-12 09:10', receivedAt: '', diffQty: 0, note: '' },
  { receiptNo: 'TR-2026-0003', productionOrderNo: 'PO-2026-0520', styleName: '连帽卫衣', styleCode: 'HD-2603', styleImageUrl: PMS_STYLE_IMAGES.hoodie, qty: 3600, boxCount: 40, fromFactory: '中山针织制衣有限公司', region: '中山', warehouse: '义乌中转仓', status: '已收货', shippedAt: '2026-06-10 07:40', receivedAt: '2026-06-11 15:20', diffQty: 0, note: '' },
  { receiptNo: 'TR-2026-0004', productionOrderNo: 'PO-2026-0521', styleName: '商务衬衫', styleCode: 'SH-2607', styleImageUrl: PMS_STYLE_IMAGES.shirt, qty: 1400, boxCount: 15, fromFactory: '宁波衬衫制造有限公司', region: '宁波', warehouse: '义乌中转仓', status: '收货中', shippedAt: '2026-06-09 10:00', receivedAt: '', diffQty: -20, note: '实收少 20 件，已上报差异' },
  { receiptNo: 'TR-2026-0005', productionOrderNo: 'PO-2026-0522', styleName: '女款连衣裙', styleCode: 'SK-2604', styleImageUrl: PMS_STYLE_IMAGES.dress, qty: 1700, boxCount: 18, fromFactory: '杭州女装制衣有限公司', region: '杭州', warehouse: '广州中转仓', status: '已收货', shippedAt: '2026-06-08 14:20', receivedAt: '2026-06-10 09:30', diffQty: 0, note: '' },
  { receiptNo: 'TR-2026-0006', productionOrderNo: 'PO-2026-0523', styleName: '轻薄夹克', styleCode: 'JK-2605', styleImageUrl: PMS_STYLE_IMAGES.jacket, qty: 900, boxCount: 10, fromFactory: '苏州户外服饰有限公司', region: '苏州', warehouse: '广州中转仓', status: '待收货', shippedAt: '2026-06-13 08:00', receivedAt: '', diffQty: 0, note: '' },
  { receiptNo: 'TR-2026-0007', productionOrderNo: 'PO-2026-0524', styleName: '男款圆领T恤', styleCode: 'TS-2601', styleImageUrl: PMS_STYLE_IMAGES.tshirt, qty: 2100, boxCount: 21, fromFactory: '广州华盛制衣有限公司', region: '广州', warehouse: '广州中转仓', status: '已收货', shippedAt: '2026-06-07 11:30', receivedAt: '2026-06-08 16:10', diffQty: 0, note: '' },
]

const orderChecks: PmsTransitOrderCheck[] = [
  { productionNo: 'SC-2609-0188', receivedStatus: '缺货', checkedAt: '2026-06-12 08:45', note: '读取生产单现有校验结果' },
  { productionNo: 'SC-2609-0191', receivedStatus: '未收齐', checkedAt: '2026-06-12 09:20', note: '' },
  { productionNo: 'SC-2609-0183', receivedStatus: '未收齐', checkedAt: '2026-06-11 15:40', note: '' },
  { productionNo: 'SC-2609-0176', receivedStatus: '已收齐', checkedAt: '2026-06-11 10:05', note: '' },
  { productionNo: 'SC-2609-0169', receivedStatus: '已收齐', checkedAt: '2026-06-10 14:35', note: '' },
  { productionNo: 'SC-2609-0152', receivedStatus: '缺货', checkedAt: '2026-06-09 09:15', note: '缺货待补，暂不推进' },
]

const preparationTasks: PmsTransitPreparationTask[] = [
  { taskId: 'PRP-2026-0001', type: '已收齐配料', productionNo: 'PO-2026-0520', qty: 4, unit: '单', owner: '刘配料' },
  { taskId: 'PRP-2026-0002', type: '未收齐配料', productionNo: 'PO-2026-0518', qty: 4, unit: '单', owner: '刘配料' },
  { taskId: 'PRP-2026-0003', type: '未收齐配料', productionNo: 'PO-2026-0521', qty: 1, unit: '单', owner: '陈配料' },
  { taskId: 'PRP-2026-0004', type: '已收齐配料', productionNo: 'PO-2026-0522', qty: 3, unit: '单', owner: '陈配料' },
  { taskId: 'PRP-2026-0005', type: '未收齐配料', productionNo: 'PO-2026-0519', qty: 4, unit: '单', owner: '刘配料' },
]

let transitFilter = ''

export function setPmsTransitFilter(filter: string): void {
  transitFilter = filter
}

export function consumePmsTransitFilter(): string {
  const value = transitFilter
  transitFilter = ''
  return value
}

export function listPmsTransitReceipts(): PmsTransitReceipt[] {
  return receipts
}

export function getPmsTransitReceipt(receiptNo: string): PmsTransitReceipt | undefined {
  return receipts.find((receipt) => receipt.receiptNo === receiptNo)
}

export function listPmsTransitCards(): PmsTransitCard[] {
  return [
    { key: 'all', label: '全部收货单', filter: '', count: receipts.length },
    { key: 'pending', label: '待收货', filter: 'pending', count: receipts.filter((receipt) => receipt.status === '待收货').length },
    { key: 'receiving', label: '收货中', filter: 'receiving', count: receipts.filter((receipt) => receipt.status === '收货中').length },
    { key: 'received', label: '已收货', filter: 'received', count: receipts.filter((receipt) => receipt.status === '已收货').length },
    { key: 'exception', label: '收货异常', filter: 'exception', count: receipts.filter((receipt) => receipt.diffQty !== 0).length },
    { key: 'guangzhou', label: '广州中转仓', filter: 'warehouse:广州中转仓', count: receipts.filter((receipt) => receipt.warehouse === '广州中转仓').length },
    { key: 'yiwu', label: '义乌中转仓', filter: 'warehouse:义乌中转仓', count: receipts.filter((receipt) => receipt.warehouse === '义乌中转仓').length },
  ]
}

export function filterPmsTransitReceipts(filter: string): PmsTransitReceipt[] {
  if (!filter) return receipts
  if (filter === 'pending') return receipts.filter((receipt) => receipt.status === '待收货')
  if (filter === 'receiving') return receipts.filter((receipt) => receipt.status === '收货中')
  if (filter === 'received') return receipts.filter((receipt) => receipt.status === '已收货')
  if (filter === 'exception') return receipts.filter((receipt) => receipt.diffQty !== 0)
  if (filter.startsWith('warehouse:')) {
    const warehouse = filter.slice('warehouse:'.length)
    return receipts.filter((receipt) => receipt.warehouse === warehouse)
  }
  if (filter.startsWith('region:')) {
    const region = filter.slice('region:'.length)
    return receipts.filter((receipt) => receipt.region === region)
  }
  return receipts
}

export function describePmsTransitFilter(filter: string): string {
  if (!filter) return '全部收货单'
  if (filter === 'pending') return '待收货'
  if (filter === 'receiving') return '收货中'
  if (filter === 'received') return '已收货'
  if (filter === 'exception') return '收货异常'
  if (filter.startsWith('warehouse:')) return `仓库：${filter.slice('warehouse:'.length)}`
  if (filter.startsWith('region:')) return `来源地区：${filter.slice('region:'.length)}`
  return filter
}

export function getPmsTransitDashboard(): {
  metrics: PmsTransitMetric[]
  trend: PmsTransitTrendPoint[]
  statusDistribution: PmsTransitDistribution[]
  regionDistribution: PmsTransitDistribution[]
  warehouseDistribution: PmsTransitDistribution[]
  exceptions: PmsTransitException[]
} {
  const pending = receipts.filter((receipt) => receipt.status === '待收货')
  const receiving = receipts.filter((receipt) => receipt.status === '收货中')
  const received = receipts.filter((receipt) => receipt.status === '已收货')
  const exceptions = receipts.filter((receipt) => receipt.diffQty !== 0)
  const totalQty = receipts.reduce((sum, receipt) => sum + receipt.qty, 0)
  return {
    metrics: [
      { key: 'pending', label: '待收货', value: pending.length, unit: '单', filter: 'pending' },
      { key: 'receiving', label: '收货中', value: receiving.length, unit: '单', filter: 'receiving' },
      { key: 'received', label: '已收货', value: received.length, unit: '单', filter: 'received' },
      { key: 'exception', label: '收货异常', value: exceptions.length, unit: '单', filter: 'exception' },
      { key: 'qty', label: '在途数量', value: totalQty, unit: '件', filter: '' },
      { key: 'guangzhou', label: '广州中转仓', value: receipts.filter((receipt) => receipt.warehouse === '广州中转仓').length, unit: '单', filter: 'warehouse:广州中转仓' },
      { key: 'yiwu', label: '义乌中转仓', value: receipts.filter((receipt) => receipt.warehouse === '义乌中转仓').length, unit: '单', filter: 'warehouse:义乌中转仓' },
      { key: 'factories', label: '来源工厂', value: new Set(receipts.map((receipt) => receipt.fromFactory)).size, unit: '家', filter: '' },
      { key: 'checks', label: '缺货校验', value: orderChecks.filter((check) => check.receivedStatus === '缺货').length, unit: '单', filter: '' },
    ],
    trend: [
      { date: '06-07', inbound: 12, outbound: 9 },
      { date: '06-08', inbound: 15, outbound: 11 },
      { date: '06-09', inbound: 9, outbound: 14 },
      { date: '06-10', inbound: 18, outbound: 13 },
      { date: '06-11', inbound: 14, outbound: 16 },
      { date: '06-12', inbound: 20, outbound: 15 },
      { date: '06-13', inbound: 16, outbound: 18 },
    ],
    statusDistribution: [
      { label: '待收货', value: pending.length, tone: 'yellow' },
      { label: '收货中', value: receiving.length, tone: 'blue' },
      { label: '已收货', value: received.length, tone: 'green' },
    ],
    regionDistribution: [
      { label: '广州', value: receipts.filter((receipt) => receipt.region === '广州').length, tone: 'blue' },
      { label: '佛山', value: receipts.filter((receipt) => receipt.region === '佛山').length, tone: 'blue' },
      { label: '中山', value: receipts.filter((receipt) => receipt.region === '中山').length, tone: 'slate' },
      { label: '宁波/杭州/苏州', value: receipts.filter((receipt) => ['宁波', '杭州', '苏州'].includes(receipt.region)).length, tone: 'slate' },
    ],
    warehouseDistribution: [
      { label: '广州中转仓', value: receipts.filter((receipt) => receipt.warehouse === '广州中转仓').length, tone: 'blue' },
      { label: '义乌中转仓', value: receipts.filter((receipt) => receipt.warehouse === '义乌中转仓').length, tone: 'slate' },
    ],
    exceptions: exceptions.map((receipt) => ({
      id: receipt.receiptNo,
      title: `${receipt.receiptNo} 收货差异 ${receipt.diffQty} 件`,
      detail: `${receipt.styleName}（${receipt.styleCode}）来自 ${receipt.fromFactory}，${receipt.note}`,
      tone: 'red' as const,
      filter: 'exception',
    })),
  }
}

export function listPmsTransitOrderChecks(): PmsTransitOrderCheck[] {
  return orderChecks
}

export function listPmsTransitPreparationTasks(): PmsTransitPreparationTask[] {
  return preparationTasks
}

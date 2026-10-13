/**
 * 面辅料采购时效(原型 mock,跟随 manage.higood.ai /pms/fitting_timeliness/index)。
 *
 * 原型说明:
 * - 当前只保留关键时间节点(发起/确认/出货/到达龙邮/到达深圳/到达雅加达/到达万隆)
 *   与采购批次号、采购员、跟进员等核心字段,不复制线上 24 列;
 * - Tab(首单/翻单)在原型合并为一个集合,按 garmentSpu 维度过滤;
 * - mock 集合保存在模块级 runtime,刷新页面会回到初始状态。
 */
import { PMS_MATERIAL_IMAGES } from './images.ts'
import { PmsDomainError } from './runtime.ts'

export type PmsFittingTimelinessOrderType = '首单' | '翻单'

export interface PmsFittingTimelinessRow {
  id: string
  garmentSpu: string
  orderType: PmsFittingTimelinessOrderType
  fittingImageUrl: string
  fittingSku: string
  purchaseLocation: string
  initiatedAt: string
  confirmedAt: string
  shippedAt: string
  arrivedLongmailAt: string
  arrivedShenzhenAt: string
  logisticsChannel: string
  batchNo: string
  arrivedJakartaAt: string
  arrivedBandungAt: string
  followUpPersonnel: string
  purchaseOrderNo: string
  purchaseOrderStatus: string
}

interface FittingTimelinessRuntime {
  rows: PmsFittingTimelinessRow[]
}

function getRuntime(): FittingTimelinessRuntime {
  return fittingTimelinessRuntime
}

const fittingTimelinessRuntime: FittingTimelinessRuntime = {
  rows: [
    {
      id: 'FIT-ASYAL26042588-1',
      garmentSpu: 'ASYAL26042588',
      orderType: '首单',
      fittingImageUrl: PMS_MATERIAL_IMAGES.cottonJersey,
      fittingSku: 'FLSZ2505245-white',
      purchaseLocation: '广州',
      initiatedAt: '2026-08-22 10:11:00',
      confirmedAt: '2026-08-24 17:32:35',
      shippedAt: '2026-08-26',
      arrivedLongmailAt: '2026-08-28',
      arrivedShenzhenAt: '2026-09-02',
      logisticsChannel: '星舰空运快线(5天左右,价格贵)',
      batchNo: 'ID20260827X',
      arrivedJakartaAt: '2026-09-02',
      arrivedBandungAt: '2026-09-02',
      followUpPersonnel: '雪雪.雷永艺',
      purchaseOrderNo: '39339',
      purchaseOrderStatus: '全部入库',
    },
    {
      id: 'FIT-ASYAL26042588-2',
      garmentSpu: 'ASYAL26042588',
      orderType: '首单',
      fittingImageUrl: PMS_MATERIAL_IMAGES.cottonJersey,
      fittingSku: 'FLSZ2505245-gold',
      purchaseLocation: '广州',
      initiatedAt: '2026-08-25 12:30:28',
      confirmedAt: '2026-08-25 13:19:41',
      shippedAt: '2026-08-26',
      arrivedLongmailAt: '2026-08-28',
      arrivedShenzhenAt: '2026-09-02',
      logisticsChannel: '星舰空运快线(5天左右,价格贵)',
      batchNo: 'ID20260828X',
      arrivedJakartaAt: '2026-09-02',
      arrivedBandungAt: '2026-09-02',
      followUpPersonnel: '雪雪.雷永艺',
      purchaseOrderNo: '39585',
      purchaseOrderStatus: '全部入库',
    },
    {
      id: 'FIT-ASYAL26042588-3',
      garmentSpu: 'ASYAL26042588',
      orderType: '首单',
      fittingImageUrl: PMS_MATERIAL_IMAGES.lining,
      fittingSku: 'IDML24043-blue-13-4200PT',
      purchaseLocation: '万隆',
      initiatedAt: '2026-08-27 10:49:06',
      confirmedAt: '',
      shippedAt: '',
      arrivedLongmailAt: '',
      arrivedShenzhenAt: '',
      logisticsChannel: '',
      batchNo: '',
      arrivedJakartaAt: '',
      arrivedBandungAt: '',
      followUpPersonnel: 'Lisnawati',
      purchaseOrderNo: '39786',
      purchaseOrderStatus: '全部入库',
    },
    {
      id: 'FIT-ASYAL26080801-1',
      garmentSpu: 'ASYAL26080801',
      orderType: '首单',
      fittingImageUrl: PMS_MATERIAL_IMAGES.whitePoplin,
      fittingSku: 'FLSZ24099-101-white',
      purchaseLocation: '广州',
      initiatedAt: '2026-08-13 10:34:12',
      confirmedAt: '2026-08-14 09:53:47',
      shippedAt: '2026-08-13',
      arrivedLongmailAt: '2026-08-14',
      arrivedShenzhenAt: '2026-08-22',
      logisticsChannel: '龙邮正清空运',
      batchNo: 'ID20260815Z',
      arrivedJakartaAt: '2026-08-22',
      arrivedBandungAt: '2026-08-22',
      followUpPersonnel: '雪雪.雷永艺',
      purchaseOrderNo: '38330',
      purchaseOrderStatus: '全部入库',
    },
    {
      id: 'FIT-ASYAL26080801-2',
      garmentSpu: 'ASYAL26080801',
      orderType: '首单',
      fittingImageUrl: PMS_MATERIAL_IMAGES.cottonJersey,
      fittingSku: 'IDFL25016-white',
      purchaseLocation: '万隆',
      initiatedAt: '2026-08-14 12:01:28',
      confirmedAt: '',
      shippedAt: '',
      arrivedLongmailAt: '',
      arrivedShenzhenAt: '',
      logisticsChannel: '',
      batchNo: '',
      arrivedJakartaAt: '',
      arrivedBandungAt: '',
      followUpPersonnel: '铁锤',
      purchaseOrderNo: '38565',
      purchaseOrderStatus: '全部入库',
    },
    {
      id: 'FIT-ASYAP26042501-1',
      garmentSpu: 'ASYAP26042501',
      orderType: '首单',
      fittingImageUrl: PMS_MATERIAL_IMAGES.lining,
      fittingSku: 'FLSZ24651-105',
      purchaseLocation: '广州',
      initiatedAt: '2026-07-14 16:38:13',
      confirmedAt: '2026-07-14 16:52:05',
      shippedAt: '2026-07-15',
      arrivedLongmailAt: '2026-07-16',
      arrivedShenzhenAt: '2026-07-24',
      logisticsChannel: '星舰空运快线(5天左右,价格贵)',
      batchNo: 'ID20260716X',
      arrivedJakartaAt: '2026-07-24',
      arrivedBandungAt: '2026-07-24',
      followUpPersonnel: '雪雪',
      purchaseOrderNo: '34713',
      purchaseOrderStatus: '全部入库',
    },
    {
      id: 'FIT-ASYER26081901-1',
      garmentSpu: 'ASYER26081901',
      orderType: '首单',
      fittingImageUrl: PMS_MATERIAL_IMAGES.whitePoplin,
      fittingSku: 'FLSZ24555-1cm-sameasphoto',
      purchaseLocation: '广州',
      initiatedAt: '2026-07-28 08:29:59',
      confirmedAt: '2026-07-28 10:34:00',
      shippedAt: '2026-08-05',
      arrivedLongmailAt: '2026-08-06',
      arrivedShenzhenAt: '2026-08-26',
      logisticsChannel: '海运整柜(时效30天左右,价格便宜,适合备货)',
      batchNo: 'HGFAD20260807',
      arrivedJakartaAt: '',
      arrivedBandungAt: '2026-08-26',
      followUpPersonnel: '么么',
      purchaseOrderNo: '36117',
      purchaseOrderStatus: '全部入库',
    },
    {
      id: 'FIT-ASYER26081905-1',
      garmentSpu: 'ASYER26081905',
      orderType: '首单',
      fittingImageUrl: PMS_MATERIAL_IMAGES.lining,
      fittingSku: 'FLLR011-white',
      purchaseLocation: '万隆',
      initiatedAt: '2026-08-27 12:10:58',
      confirmedAt: '',
      shippedAt: '',
      arrivedLongmailAt: '',
      arrivedShenzhenAt: '',
      logisticsChannel: '',
      batchNo: '',
      arrivedJakartaAt: '',
      arrivedBandungAt: '',
      followUpPersonnel: '菠萝',
      purchaseOrderNo: '39791',
      purchaseOrderStatus: '全部入库',
    },
    {
      id: 'FIT-ASYER26081908-1',
      garmentSpu: 'ASYER26081908',
      orderType: '首单',
      fittingImageUrl: PMS_MATERIAL_IMAGES.contrast,
      fittingSku: 'FLLR015-sameasphoto',
      purchaseLocation: '广州',
      initiatedAt: '2026-08-27 18:11:45',
      confirmedAt: '2026-08-28 15:02:46',
      shippedAt: '2026-08-28',
      arrivedLongmailAt: '2026-08-30',
      arrivedShenzhenAt: '2026-09-08',
      logisticsChannel: '星舰空运快线(5天左右,价格贵)',
      batchNo: 'ID20260831X',
      arrivedJakartaAt: '2026-09-08',
      arrivedBandungAt: '2026-09-08',
      followUpPersonnel: '雪雪.雷永艺',
      purchaseOrderNo: '39864',
      purchaseOrderStatus: '全部入库',
    },
    {
      id: 'FIT-ASYNR26012101-1',
      garmentSpu: 'ASYNR26012101',
      orderType: '首单',
      fittingImageUrl: PMS_MATERIAL_IMAGES.navyFabric,
      fittingSku: 'FLSZ2505100-50cm-102',
      purchaseLocation: '广州',
      initiatedAt: '2026-07-13 12:07:00',
      confirmedAt: '2026-07-13 13:00:29',
      shippedAt: '2026-07-13',
      arrivedLongmailAt: '2026-07-14',
      arrivedShenzhenAt: '2026-07-19',
      logisticsChannel: '星舰空运快线(5天左右,价格贵)',
      batchNo: 'ID20260714X',
      arrivedJakartaAt: '2026-07-19',
      arrivedBandungAt: '2026-07-19',
      followUpPersonnel: '火华',
      purchaseOrderNo: '34563',
      purchaseOrderStatus: '全部入库',
    },
    {
      id: 'FIT-ASYNR26032801-1',
      garmentSpu: 'ASYNR26032801',
      orderType: '首单',
      fittingImageUrl: PMS_MATERIAL_IMAGES.whitePoplin,
      fittingSku: 'FLSZ24099-101-white',
      purchaseLocation: '广州',
      initiatedAt: '2026-08-04 15:56:03',
      confirmedAt: '2026-08-04 16:19:13',
      shippedAt: '2026-08-04',
      arrivedLongmailAt: '2026-08-05',
      arrivedShenzhenAt: '2026-08-10',
      logisticsChannel: '星舰空运快线(5天左右,价格贵)',
      batchNo: 'ID20260805X',
      arrivedJakartaAt: '2026-08-10',
      arrivedBandungAt: '2026-08-10',
      followUpPersonnel: '火华',
      purchaseOrderNo: '37287',
      purchaseOrderStatus: '全部入库',
    },
    {
      id: 'FIT-ASYQU25082783-1',
      garmentSpu: 'ASYQU25082783',
      orderType: '首单',
      fittingImageUrl: PMS_MATERIAL_IMAGES.cottonJersey,
      fittingSku: 'FLSZ24273-sameasphoto',
      purchaseLocation: '广州',
      initiatedAt: '2026-06-01 16:40:42',
      confirmedAt: '2026-06-01 17:04:53',
      shippedAt: '2026-06-05',
      arrivedLongmailAt: '2026-06-06',
      arrivedShenzhenAt: '2026-07-22',
      logisticsChannel: '海运整柜(时效30天左右,价格便宜,适合备货)',
      batchNo: 'ID20260605M',
      arrivedJakartaAt: '2026-07-22',
      arrivedBandungAt: '2026-07-22',
      followUpPersonnel: 'sync',
      purchaseOrderNo: '30603',
      purchaseOrderStatus: '全部入库',
    },
    {
      id: 'FIT-ASYQU26052109-1',
      garmentSpu: 'ASYQU26052109',
      orderType: '首单',
      fittingImageUrl: PMS_MATERIAL_IMAGES.cottonJersey,
      fittingSku: 'FLSZ2505415-sameasphoto',
      purchaseLocation: '广州',
      initiatedAt: '2026-06-29 13:49:49',
      confirmedAt: '2026-06-29 16:16:23',
      shippedAt: '2026-06-29',
      arrivedLongmailAt: '2026-06-30',
      arrivedShenzhenAt: '2026-07-06',
      logisticsChannel: '星舰空运快线(5天左右,价格贵)',
      batchNo: 'ID20260630X',
      arrivedJakartaAt: '2026-07-06',
      arrivedBandungAt: '2026-07-06',
      followUpPersonnel: '火华',
      purchaseOrderNo: '32983',
      purchaseOrderStatus: '全部入库',
    },
  ],
}

export function listPmsFittingTimelinessRows(): PmsFittingTimelinessRow[] {
  return getRuntime().rows.slice()
}

export interface PmsFittingTimelinessFilter {
  garmentSpu?: string
  fittingSku?: string
  purchaseOrderNo?: string
  purchaseLocation?: string
  purchaseOrderStatus?: string
  initiatedAtFrom?: string
  initiatedAtTo?: string
}

export function filterPmsFittingTimeliness(filter: PmsFittingTimelinessFilter): PmsFittingTimelinessRow[] {
  const all = getRuntime().rows
  const fromTs = filter.initiatedAtFrom ? Date.parse(filter.initiatedAtFrom.replace(' ', 'T')) : undefined
  const toTs = filter.initiatedAtTo ? Date.parse(filter.initiatedAtTo.replace(' ', 'T') || `${filter.initiatedAtTo} 23:59:59`) : undefined
  return all.filter((row) => {
    if (filter.garmentSpu && !row.garmentSpu.toLowerCase().includes(filter.garmentSpu.toLowerCase())) return false
    if (filter.fittingSku && !row.fittingSku.toLowerCase().includes(filter.fittingSku.toLowerCase())) return false
    if (filter.purchaseOrderNo && !row.purchaseOrderNo.includes(filter.purchaseOrderNo)) return false
    if (filter.purchaseLocation && filter.purchaseLocation !== '全部' && row.purchaseLocation !== filter.purchaseLocation) return false
    if (filter.purchaseOrderStatus && filter.purchaseOrderStatus !== '全部' && row.purchaseOrderStatus !== filter.purchaseOrderStatus) return false
    if (fromTs !== undefined || toTs !== undefined) {
      const ts = row.initiatedAt ? Date.parse(row.initiatedAt.replace(' ', 'T')) : Number.NaN
      if (Number.isNaN(ts)) return false
      if (fromTs !== undefined && ts < fromTs) return false
      if (toTs !== undefined && ts > toTs) return false
    }
    return true
  })
}

export function summarizePmsFittingTimeliness(filter: PmsFittingTimelinessFilter): {
  total: number
  pending: number
  fullyArrived: number
} {
  const rows = filterPmsFittingTimeliness(filter)
  const fullyArrived = rows.filter((r) => r.purchaseOrderStatus === '全部入库' && !!r.arrivedBandungAt).length
  const pending = rows.filter((r) => r.purchaseOrderStatus !== '全部入库' || !r.arrivedBandungAt).length
  return { total: rows.length, pending, fullyArrived }
}

export function listPmsFittingTimelinessPurchaseLocations(): string[] {
  const set = new Set<string>()
  for (const row of getRuntime().rows) set.add(row.purchaseLocation)
  return Array.from(set)
}

export function listPmsFittingTimelinessPurchaseOrderStatuses(): string[] {
  const set = new Set<string>()
  for (const row of getRuntime().rows) set.add(row.purchaseOrderStatus)
  return Array.from(set)
}

export function updatePmsFittingTimelinessConfirmedAt(id: string, confirmedAt: string): PmsFittingTimelinessRow {
  const row = getRuntime().rows.find((r) => r.id === id)
  if (!row) throw new PmsDomainError('PMS_FITTING_NOT_FOUND', `未找到面辅料采购时效 ${id}`)
  row.confirmedAt = confirmedAt
  return row
}

export function updatePmsFittingTimelinessShippedAt(id: string, shippedAt: string): PmsFittingTimelinessRow {
  const row = getRuntime().rows.find((r) => r.id === id)
  if (!row) throw new PmsDomainError('PMS_FITTING_NOT_FOUND', `未找到面辅料采购时效 ${id}`)
  row.shippedAt = shippedAt
  return row
}

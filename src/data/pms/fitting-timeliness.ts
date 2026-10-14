/**
 * 面辅料采购时效：结构对齐测试站，时间为静态演示夹具。
 *
 * 原型说明:
 * - 当前只保留关键时间节点(发起/确认/出货/到达龙邮/到达深圳/到达雅加达/到达万隆)
 *   与采购批次号、采购员、跟进员等核心字段,不复制线上 24 列;
 * - Tab(首单/翻单)在原型合并为一个集合,按 garmentSpu 维度过滤;
 * - 静态夹具只读；用户节点修改在 IndexedDB 保存并在直达与刷新后读取。
 */
import { PMS_STORES, pmsAll, pmsCommitRecords } from './idb-storage.ts'
import { getPmsMaterialPurchaseOrder, hydratePmsMaterialPurchaseOrdersFromIdb } from './material-purchase-orders.ts'
import { PmsDomainError } from './runtime.ts'

export type PmsFittingTimelinessOrderType = '首单' | '翻单'

export interface PmsFittingTimelinessRow {
  id: string
  _pmsBaseVersion?: number
  garmentPurchaseOrderNo?: string
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

/** Fixed demo timeline snapshots: reading a changed purchase plan never creates actual arrival facts. */
const fittingTimelinessRuntime: FittingTimelinessRuntime = {
  rows: [
    {
      "id": "FIT-ASYAL26042588-1",
      "garmentPurchaseOrderNo": "CG-2026-0020",
      "garmentSpu": "SH-2607",
      "orderType": "首单",
      "fittingImageUrl": "/materials/fabric-main.jpg",
      "fittingSku": "FAB-2026-0001",
      "purchaseLocation": "广州",
      "initiatedAt": "2026-06-09 09:00:00",
      "confirmedAt": "",
      "shippedAt": "",
      "arrivedLongmailAt": "",
      "arrivedShenzhenAt": "",
      "logisticsChannel": "",
      "batchNo": "",
      "arrivedJakartaAt": "",
      "arrivedBandungAt": "",
      "followUpPersonnel": "王采购",
      "purchaseOrderNo": "CGF-2026-0001",
      "purchaseOrderStatus": "已采购"
    },
    {
      "id": "FIT-ASYAL26042588-2",
      "garmentPurchaseOrderNo": "CG-2026-0020",
      "garmentSpu": "SH-2607",
      "orderType": "首单",
      "fittingImageUrl": "/materials/accessory-button.jpg",
      "fittingSku": "ACC-2026-0002",
      "purchaseLocation": "广州",
      "initiatedAt": "2026-06-09 09:00:00",
      "confirmedAt": "2026-06-09 10:00:00",
      "shippedAt": "2026-06-09",
      "arrivedLongmailAt": "",
      "arrivedShenzhenAt": "",
      "logisticsChannel": "",
      "batchNo": "",
      "arrivedJakartaAt": "",
      "arrivedBandungAt": "",
      "followUpPersonnel": "王采购",
      "purchaseOrderNo": "CGF-2026-0002",
      "purchaseOrderStatus": "部分到货"
    },
    {
      "id": "FIT-ASYAL26042588-3",
      "garmentPurchaseOrderNo": "CG-2026-0021",
      "garmentSpu": "SK-2604",
      "orderType": "首单",
      "fittingImageUrl": "/materials/fabric-main.jpg",
      "fittingSku": "FAB-2026-0001",
      "purchaseLocation": "广州",
      "initiatedAt": "2026-06-05 09:00:00",
      "confirmedAt": "2026-06-05 10:00:00",
      "shippedAt": "2026-06-05",
      "arrivedLongmailAt": "2026-06-20",
      "arrivedShenzhenAt": "2026-06-20",
      "logisticsChannel": "",
      "batchNo": "",
      "arrivedJakartaAt": "2026-06-20",
      "arrivedBandungAt": "2026-06-20",
      "followUpPersonnel": "王采购",
      "purchaseOrderNo": "CGF-2026-0003",
      "purchaseOrderStatus": "已入库"
    },
    {
      "id": "FIT-ASYAL26080801-1",
      "garmentPurchaseOrderNo": "",
      "garmentSpu": "HD-2603",
      "orderType": "首单",
      "fittingImageUrl": "/materials/fei-ticket/fog-grey-sweatshirt-fleece.png",
      "fittingSku": "FAB-2026-0002",
      "purchaseLocation": "广州",
      "initiatedAt": "2026-06-10 09:00:00",
      "confirmedAt": "",
      "shippedAt": "",
      "arrivedLongmailAt": "",
      "arrivedShenzhenAt": "",
      "logisticsChannel": "",
      "batchNo": "",
      "arrivedJakartaAt": "",
      "arrivedBandungAt": "",
      "followUpPersonnel": "王采购",
      "purchaseOrderNo": "CGF-2026-0004",
      "purchaseOrderStatus": "已采购"
    },
    {
      "id": "FIT-ASYAL26080801-2",
      "garmentPurchaseOrderNo": "",
      "garmentSpu": "HD-2603",
      "orderType": "首单",
      "fittingImageUrl": "/materials/yarn-stitching.jpg",
      "fittingSku": "ACC-2026-0004",
      "purchaseLocation": "广州",
      "initiatedAt": "2026-06-08 09:00:00",
      "confirmedAt": "2026-06-08 10:00:00",
      "shippedAt": "2026-06-08",
      "arrivedLongmailAt": "",
      "arrivedShenzhenAt": "",
      "logisticsChannel": "",
      "batchNo": "",
      "arrivedJakartaAt": "",
      "arrivedBandungAt": "",
      "followUpPersonnel": "王采购",
      "purchaseOrderNo": "CGF-2026-0005",
      "purchaseOrderStatus": "部分到货"
    },
    {
      "id": "FIT-ASYAP26042501-1",
      "garmentPurchaseOrderNo": "",
      "garmentSpu": "HD-2603",
      "orderType": "首单",
      "fittingImageUrl": "/materials/accessory-label.jpg",
      "fittingSku": "ACC-2026-0003",
      "purchaseLocation": "广州",
      "initiatedAt": "2026-05-30 09:00:00",
      "confirmedAt": "2026-05-30 10:00:00",
      "shippedAt": "2026-05-30",
      "arrivedLongmailAt": "2026-06-12",
      "arrivedShenzhenAt": "2026-06-12",
      "logisticsChannel": "",
      "batchNo": "",
      "arrivedJakartaAt": "2026-06-12",
      "arrivedBandungAt": "2026-06-12",
      "followUpPersonnel": "王采购",
      "purchaseOrderNo": "CGF-2026-0006",
      "purchaseOrderStatus": "已入库"
    },
    {
      "id": "FIT-ASYER26081901-1",
      "garmentPurchaseOrderNo": "",
      "garmentSpu": "HD-2603",
      "orderType": "翻单",
      "fittingImageUrl": "/materials/process-orders/cotton-yarn-cone.jpg",
      "fittingSku": "MAT-YN-00000001-B01",
      "purchaseLocation": "广州",
      "initiatedAt": "2026-06-11 09:00:00",
      "confirmedAt": "",
      "shippedAt": "",
      "arrivedLongmailAt": "",
      "arrivedShenzhenAt": "",
      "logisticsChannel": "",
      "batchNo": "",
      "arrivedJakartaAt": "",
      "arrivedBandungAt": "",
      "followUpPersonnel": "王采购",
      "purchaseOrderNo": "CGF-2026-0007",
      "purchaseOrderStatus": "待采购"
    },
    {
      "id": "FIT-ASYER26081905-1",
      "garmentPurchaseOrderNo": "",
      "garmentSpu": "HD-2603",
      "orderType": "翻单",
      "fittingImageUrl": "/materials/packing-bag.jpg",
      "fittingSku": "PKG-2026-0002",
      "purchaseLocation": "广州",
      "initiatedAt": "2026-05-26 09:00:00",
      "confirmedAt": "2026-05-26 10:00:00",
      "shippedAt": "2026-05-26",
      "arrivedLongmailAt": "",
      "arrivedShenzhenAt": "",
      "logisticsChannel": "",
      "batchNo": "",
      "arrivedJakartaAt": "",
      "arrivedBandungAt": "",
      "followUpPersonnel": "王采购",
      "purchaseOrderNo": "CGF-2026-0008",
      "purchaseOrderStatus": "已关闭"
    },
    {
      "id": "FIT-ASYER26081908-1",
      "garmentPurchaseOrderNo": "CG-2026-0020",
      "garmentSpu": "SH-2607",
      "orderType": "翻单",
      "fittingImageUrl": "/materials/fabric-main.jpg",
      "fittingSku": "FAB-2026-0001",
      "purchaseLocation": "广州",
      "initiatedAt": "2026-06-09 09:00:00",
      "confirmedAt": "2026-06-09 10:00:00",
      "shippedAt": "2026-06-09",
      "arrivedLongmailAt": "",
      "arrivedShenzhenAt": "",
      "logisticsChannel": "",
      "batchNo": "",
      "arrivedJakartaAt": "",
      "arrivedBandungAt": "",
      "followUpPersonnel": "王采购",
      "purchaseOrderNo": "CGF-2026-0001",
      "purchaseOrderStatus": "已采购"
    },
    {
      "id": "FIT-ASYNR26012101-1",
      "garmentPurchaseOrderNo": "CG-2026-0020",
      "garmentSpu": "SH-2607",
      "orderType": "翻单",
      "fittingImageUrl": "/materials/accessory-button.jpg",
      "fittingSku": "ACC-2026-0002",
      "purchaseLocation": "广州",
      "initiatedAt": "2026-06-09 09:00:00",
      "confirmedAt": "",
      "shippedAt": "",
      "arrivedLongmailAt": "",
      "arrivedShenzhenAt": "",
      "logisticsChannel": "",
      "batchNo": "",
      "arrivedJakartaAt": "",
      "arrivedBandungAt": "",
      "followUpPersonnel": "王采购",
      "purchaseOrderNo": "CGF-2026-0002",
      "purchaseOrderStatus": "部分到货"
    },
    {
      "id": "FIT-ASYNR26032801-1",
      "garmentPurchaseOrderNo": "CG-2026-0021",
      "garmentSpu": "SK-2604",
      "orderType": "翻单",
      "fittingImageUrl": "/materials/fabric-main.jpg",
      "fittingSku": "FAB-2026-0001",
      "purchaseLocation": "广州",
      "initiatedAt": "2026-06-05 09:00:00",
      "confirmedAt": "2026-06-05 10:00:00",
      "shippedAt": "2026-06-05",
      "arrivedLongmailAt": "2026-06-20",
      "arrivedShenzhenAt": "2026-06-20",
      "logisticsChannel": "",
      "batchNo": "",
      "arrivedJakartaAt": "2026-06-20",
      "arrivedBandungAt": "2026-06-20",
      "followUpPersonnel": "王采购",
      "purchaseOrderNo": "CGF-2026-0003",
      "purchaseOrderStatus": "已入库"
    },
    {
      "id": "FIT-ASYQU25082783-1",
      "garmentPurchaseOrderNo": "",
      "garmentSpu": "HD-2603",
      "orderType": "翻单",
      "fittingImageUrl": "/materials/fei-ticket/fog-grey-sweatshirt-fleece.png",
      "fittingSku": "FAB-2026-0002",
      "purchaseLocation": "广州",
      "initiatedAt": "2026-06-10 09:00:00",
      "confirmedAt": "2026-06-10 10:00:00",
      "shippedAt": "2026-06-10",
      "arrivedLongmailAt": "",
      "arrivedShenzhenAt": "",
      "logisticsChannel": "",
      "batchNo": "",
      "arrivedJakartaAt": "",
      "arrivedBandungAt": "",
      "followUpPersonnel": "王采购",
      "purchaseOrderNo": "CGF-2026-0004",
      "purchaseOrderStatus": "已采购"
    },
    {
      "id": "FIT-ASYQU26052109-1",
      "garmentPurchaseOrderNo": "",
      "garmentSpu": "HD-2603",
      "orderType": "翻单",
      "fittingImageUrl": "/materials/yarn-stitching.jpg",
      "fittingSku": "ACC-2026-0004",
      "purchaseLocation": "广州",
      "initiatedAt": "2026-06-08 09:00:00",
      "confirmedAt": "",
      "shippedAt": "",
      "arrivedLongmailAt": "",
      "arrivedShenzhenAt": "",
      "logisticsChannel": "",
      "batchNo": "",
      "arrivedJakartaAt": "",
      "arrivedBandungAt": "",
      "followUpPersonnel": "王采购",
      "purchaseOrderNo": "CGF-2026-0005",
      "purchaseOrderStatus": "部分到货"
    }
  ],
}

function withCurrentPurchaseStatus(row: PmsFittingTimelinessRow): PmsFittingTimelinessRow {
  return { ...row, purchaseOrderStatus: getPmsMaterialPurchaseOrder(row.purchaseOrderNo)?.status ?? '采购单未找到' }
}

export function listPmsFittingTimelinessRows(): PmsFittingTimelinessRow[] {
  return getRuntime().rows.map(withCurrentPurchaseStatus)
}

export interface PmsFittingTimelinessFilter {
  orderType?: PmsFittingTimelinessOrderType
  garmentPurchaseOrderNo?: string
  garmentSpu?: string
  fittingSku?: string
  purchaseOrderNo?: string
  purchaseLocation?: string
  purchaseOrderStatus?: string
  initiatedAtFrom?: string
  initiatedAtTo?: string
}

function matchesKeywords(value: string | undefined, query: string | undefined): boolean {
  const terms = (query ?? '').split(/[,，]/).map(term => term.trim().toLowerCase()).filter(Boolean)
  return terms.length === 0 || terms.some(term => (value ?? '').toLowerCase().includes(term))
}

export function filterPmsFittingTimeliness(filter: PmsFittingTimelinessFilter): PmsFittingTimelinessRow[] {
  const all = listPmsFittingTimelinessRows()
  const fromTs = filter.initiatedAtFrom ? Date.parse(filter.initiatedAtFrom.replace(' ', 'T')) : undefined
  const toTs = filter.initiatedAtTo ? Date.parse(`${filter.initiatedAtTo.slice(0,10)}T23:59:59`) : undefined
  return all.filter((row) => {
    if(filter.orderType && row.orderType !== filter.orderType) return false
    if (!matchesKeywords(row.garmentPurchaseOrderNo, filter.garmentPurchaseOrderNo)) return false
    if (!matchesKeywords(row.garmentSpu, filter.garmentSpu)) return false
    if (!matchesKeywords(row.fittingSku, filter.fittingSku)) return false
    if (!matchesKeywords(row.purchaseOrderNo, filter.purchaseOrderNo)) return false
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
  const fullyArrived = rows.filter((r) => ['全部入库', '已入库'].includes(r.purchaseOrderStatus) && !!r.arrivedBandungAt).length
  const pending = rows.filter((r) => !['全部入库', '已入库'].includes(r.purchaseOrderStatus) || !r.arrivedBandungAt).length
  return { total: rows.length, pending, fullyArrived }
}

export function listPmsFittingTimelinessPurchaseLocations(): string[] {
  const set = new Set<string>()
  for (const row of getRuntime().rows) set.add(row.purchaseLocation)
  return Array.from(set)
}

export function listPmsFittingTimelinessPurchaseOrderStatuses(): string[] {
  const set = new Set<string>()
  for (const row of listPmsFittingTimelinessRows()) set.add(row.purchaseOrderStatus)
  return Array.from(set)
}

let hydration: Promise<void> | null = null
export function hydratePmsFittingTimeliness(): Promise<void> {
  return hydration ??= Promise.all([
    pmsAll<PmsFittingTimelinessRow>(PMS_STORES.pmsFittingTimeliness),
    hydratePmsMaterialPurchaseOrdersFromIdb(true),
  ]).then(([rows]) => {
    for (const row of rows) {
      const old = getRuntime().rows.find(item => item.id === row.id)
      if (old) Object.assign(old, row)
      else getRuntime().rows.push(row)
    }
  }).catch(error => { hydration = null; throw error })
}
async function updateTime(id:string,field:'confirmedAt'|'shippedAt',value:string,operationId:string):Promise<PmsFittingTimelinessRow> {
  await hydratePmsFittingTimeliness()
  const before=getRuntime().rows.find(r=>r.id===id)
  if(!before) throw new PmsDomainError('PMS_FITTING_NOT_FOUND',`未找到采购时效 ${id}`)
  const date=Date.parse(value.replace(' ','T'))
  if(!Number.isFinite(date)) throw new PmsDomainError('PMS_FITTING_DATE','填写有效日期时间')
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  if (dateOnly && new Date(date).toISOString().slice(0, 10) !== value) throw new PmsDomainError('PMS_FITTING_DATE', '填写有效日期时间')
  if (dateOnly ? value < before.initiatedAt.slice(0, 10) : date < Date.parse(before.initiatedAt.replace(' ', 'T'))) throw new PmsDomainError('PMS_FITTING_ORDER','节点时间不能早于发起时间')
  const row={...before,[field]:value}
  await pmsCommitRecords([{store:PMS_STORES.pmsFittingTimeliness,value:row}],{operationId,operationSignature:JSON.stringify([id,field,value])})
  Object.assign(before,row);return withCurrentPurchaseStatus(before)
}
export function updatePmsFittingTimelinessConfirmedAt(id:string,value:string,operationId:string=crypto.randomUUID()):Promise<PmsFittingTimelinessRow> { return updateTime(id,'confirmedAt',value,operationId) }
export function updatePmsFittingTimelinessShippedAt(id:string,value:string,operationId:string=crypto.randomUUID()):Promise<PmsFittingTimelinessRow> { return updateTime(id,'shippedAt',value,operationId) }

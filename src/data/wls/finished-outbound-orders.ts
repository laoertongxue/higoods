/**
 * 成衣出库单页面专用演示事实。
 * 静态源版本：2026-10-20-v1。前三条为参照页面抽样，DEMO 记录为边界演示。
 * 用户动作只把受影响记录及操作收据写入本库；读取不复制种子、不触及线上库存。
 */
import { QC_SHIPPING_OUTBOUND_SEEDS } from '../fcs/post-finishing-qc-shipping-seeds.ts'
import { parseQcShippingDeadlineMillis } from '../fcs/post-finishing-qc-shipping-priority.ts'
export const OUTBOUND_STATUSES = ['待处理', '待拣货', '拣货完成', '已打单', '已出库', '已揽收', '已取消'] as const
export type FinishedOutboundStatus = typeof OUTBOUND_STATUSES[number]
export type FinishedOutboundProduct = {
  lineId?: string
  spu: string
  sku: string
  imageUrl: string
  quantity: number
  pendingQuantity: number
  locations: { name: string; quantity: number }[]
  inventoryUpdatedAt: string
}
export type FinishedOutboundOrder = {
  id: string
  outboundOrderNo: string
  relatedOrderNo: string
  trackingNo: string
  warehouse: string
  platform: string
  orderType: '现货订单' | '预售订单' | '成衣质检'
  inventoryApplicationId?: string
  recipientName?: string
  operatorName?: string
  status: FinishedOutboundStatus
  createdAt: string
  updatedAt: string
  deadline: string
  deadlineTimeZone?: string
  pickedAt: string
  shippedAt: string
  cancelledAt: string
  labelDownloadedAt: string
  printedAt: string
  pickOrderNo: string
  remark: string
  isKol: boolean
  printCount: number
  products: FinishedOutboundProduct[]
  logs: { at: string; action: string; operator: string; remark: string }[]
  version: number
}
export type FinishedOutboundFilters = {
  keyword: string
  spu: string
  sku: string
  warehouse: string
  platform: string
  hasLabel: string
  orderType: string
  pickType: string
  kol: string
  stock: string
  createdFrom: string
  createdTo: string
  deadlineFrom: string
  deadlineTo: string
  shippedFrom: string
  shippedTo: string
  sortField: string
  sortDirection: string
}
export type FinishedOutboundAction = 'print' | 'cancel-print' | 'outbound' | 'download-label'

export function emptyFinishedOutboundFilters(): FinishedOutboundFilters {
  return {
    keyword: '', spu: '', sku: '', warehouse: '', platform: '', hasLabel: '', orderType: '',
    pickType: '', kol: '', stock: '', createdFrom: '', createdTo: '', deadlineFrom: '', deadlineTo: '',
    shippedFrom: '', shippedTo: '', sortField: '', sortDirection: '',
  }
}

const PRODUCT_REFERENCES = [
  { spu: 'FADSS2610168888', sku: 'FADSS2610168888-sameasphoto-m', imageUrl: '/images/wls-outbound/FADSS2610168888-sameasphoto.webp' },
  { spu: 'ASYSA26100755', sku: 'ASYSA26100755-coffee-l', imageUrl: '/images/wls-outbound/ASYSA26100755-coffee.webp' },
  { spu: 'CHCKL26101020', sku: 'CHCKL26101020-army-green-l', imageUrl: '/images/wls-outbound/CHCKL26101020-army-green.webp' },
] as const

function product(reference: number, overrides: Partial<FinishedOutboundProduct> = {}): FinishedOutboundProduct {
  return { ...PRODUCT_REFERENCES[reference % PRODUCT_REFERENCES.length]!, quantity: 1, pendingQuantity: 0, locations: [], inventoryUpdatedAt: '', ...overrides }
}

function referenceOrder(index: number): FinishedOutboundOrder {
  const source = [
    ['7010498', 'DN2TENR6HH1Q80476789', '586682914523874516', 'F&M WH', 'Tiktok', '2026-10-20 10:31:16', '2026-11-21 23:59:59'],
    ['7010497', 'DN2TENR3X2SXS0475456', '2610204QE9YMK3', 'A&C WH', 'Shopee', '2026-10-20 09:31:15', '2026-11-22 09:30:50'],
    ['7010496', 'DN2TENR3DSL5OG475179', '586682904961517148', 'A&C WH', 'Tiktok', '2026-10-20 10:31:15', '2026-11-21 23:59:59'],
  ][index]!
  return {
    id: source[0]!, outboundOrderNo: source[1]!, relatedOrderNo: source[2]!, trackingNo: '',
    warehouse: source[3]!, platform: source[4]!, orderType: '预售订单', status: '待处理',
    createdAt: source[5]!, updatedAt: source[5]!, deadline: source[6]!, pickedAt: '', shippedAt: '',
    cancelledAt: '', labelDownloadedAt: '', printedAt: '', pickOrderNo: '',
    remark: `订单出库:${source[2]}`, isKol: false, printCount: 0, products: [product(index)],
    logs: [], version: 1,
  }
}

function demoOrder(index: number): FinishedOutboundOrder {
  const n = index + 1
  const status = OUTBOUND_STATUSES[index % OUTBOUND_STATUSES.length]!
  const suffix = String(n).padStart(3, '0')
  const date = `2026-10-${String(19 - Math.floor(index / 7)).padStart(2, '0')}`
  const createdAt = `${date} 10:${String(index % 60).padStart(2, '0')}:00`
  const hasPicked = ['拣货完成', '已打单', '已出库', '已揽收'].includes(status)
  const hasPrinted = ['已打单', '已出库', '已揽收'].includes(status)
  const shipped = ['已出库', '已揽收'].includes(status)
  // 待处理样本也保留无库存记录；其余样本分别覆盖多库位、零库存与未更新库存。
  const products = [product(index, {
    quantity: n % 4 === 0 ? 3 : 1,
    pendingQuantity: n * 3,
    locations: n % 6 === 0 ? [] : [{ name: n % 2 ? 'V1 A2-4' : 'U7 A1-4', quantity: n % 5 === 0 ? 0 : n % 4 === 0 ? 2 : 16 }],
    inventoryUpdatedAt: n % 6 === 0 ? '' : createdAt,
  })]
  if (n % 4 === 0) products.push(product(index + 1, { quantity: 2, pendingQuantity: 7, locations: [{ name: 'W3 B2-8', quantity: 9 }], inventoryUpdatedAt: createdAt }))
  const platform = n % 3 === 0 ? 'Shopee' : 'Tiktok'
  return {
    id: `outbound-demo-${suffix}`, outboundOrderNo: `DEMO-DN-202610-${suffix}`, relatedOrderNo: `DEMO-ORDER-${suffix}`,
    trackingNo: hasPrinted ? `DEMO-TRACK-${suffix}` : '', warehouse: n % 3 === 0 ? 'F&M WH' : 'A&C WH', platform,
    orderType: n % 2 === 0 ? '现货订单' : '预售订单', status, createdAt, updatedAt: createdAt,
    deadline: `${date} 23:59:59`, deadlineTimeZone: 'Asia/Shanghai', pickedAt: hasPicked ? `${date} 11:00:00` : '',
    shippedAt: shipped ? `${date} 13:00:00` : '', cancelledAt: status === '已取消' ? `${date} 11:30:00` : '',
    // Tiktok 拣货完成样本保留已下载面单、未打印的独立事实。
    labelDownloadedAt: hasPrinted || platform === 'Tiktok' && status === '拣货完成' ? `${date} 11:10:00` : '',
    printedAt: hasPrinted ? `${date} 11:20:00` : '', pickOrderNo: status !== '待处理' && status !== '已取消' ? `DEMO-PICK-${suffix}` : '',
    remark: `演示数据 ${suffix}，用于筛选、状态及本地保存验证。`, isKol: n % 5 === 0,
    printCount: hasPrinted ? n % 3 + 1 : 0, products,
    logs: [{ at: createdAt, action: '创建演示出库单', operator: '演示数据', remark: '仅原型场景，不代表真实出库。' }], version: 1,
  }
}

export const FINISHED_OUTBOUND_SEED: FinishedOutboundOrder[] = [
  referenceOrder(0), referenceOrder(1), referenceOrder(2), ...Array.from({ length: 42 }, (_, index) => demoOrder(index)), ...QC_SHIPPING_OUTBOUND_SEEDS,
]

export function outboundQuantity(order: FinishedOutboundOrder): number {
  return order.products.reduce((sum, line) => sum + line.quantity, 0)
}

function normalizeDate(value: string): string {
  return value.trim().replace('T', ' ')
}

function inDateRange(value: string, from: string, to: string): boolean {
  if (!from && !to) return true
  if (!value) return false
  const actual = normalizeDate(value)
  const lowerBase = normalizeDate(from)
  const lower = lowerBase.length === 10 ? `${lowerBase} 00:00:00` : lowerBase.length === 16 ? `${lowerBase}:00` : lowerBase
  const upperBase = normalizeDate(to)
  const upper = upperBase.length === 10 ? `${upperBase} 23:59:59` : upperBase.length === 16 ? `${upperBase}:59` : upperBase
  // 分钟输入的起点用 :00；字符串比较避免浏览器 / 部署时区改变本地业务日期。
  return (!lower || actual >= lower) && (!upper || actual <= upper)
}

export function filterFinishedOutboundOrders(
  rows: FinishedOutboundOrder[], filters: FinishedOutboundFilters, statusFilter = '',
): FinishedOutboundOrder[] {
  const contains = (value: string, search: string) => value.toLowerCase().includes(search.trim().toLowerCase())
  const result = rows.filter(row => {
    const available = row.products.length > 0 && row.products.every(line => line.locations.length > 0 && line.locations.reduce((sum, location) => sum + location.quantity, 0) >= line.quantity)
    return (!statusFilter || row.status === statusFilter)
      && (!filters.keyword.trim() || [row.outboundOrderNo, row.relatedOrderNo, row.trackingNo].some(value => contains(value, filters.keyword)))
      && (!filters.spu.trim() || row.products.some(line => contains(line.spu, filters.spu)))
      && (!filters.sku.trim() || row.products.some(line => contains(line.sku, filters.sku)))
      && (!filters.warehouse || row.warehouse === filters.warehouse)
      && (!filters.platform || row.platform === filters.platform)
      && (!filters.hasLabel || Boolean(row.labelDownloadedAt) === (filters.hasLabel === 'yes'))
      && (!filters.orderType || row.orderType === filters.orderType)
      && (!filters.pickType || (filters.pickType === 'single' ? outboundQuantity(row) === 1 : outboundQuantity(row) > 1))
      && (!filters.kol || row.isKol === (filters.kol === 'yes'))
      && (!filters.stock || available === (filters.stock === 'available'))
      && inDateRange(row.createdAt, filters.createdFrom, filters.createdTo)
      && inDateRange(row.deadline, filters.deadlineFrom, filters.deadlineTo)
      && inDateRange(row.shippedAt, filters.shippedFrom, filters.shippedTo)
  })
  const fields = ['createdAt', 'pickedAt', 'deadline', 'shippedAt'] as const
  const field = fields.find(value => value === filters.sortField)
  if (field && filters.sortDirection) result.sort((a, b) => {
    if (!a[field] || !b[field]) return !a[field] && !b[field] ? 0 : !a[field] ? 1 : -1
    const comparison = a[field].localeCompare(b[field])
    return filters.sortDirection === 'desc' ? -comparison : comparison
  })
  return result
}

/** 纯业务动作：打印记录历史与下载事实分别保留；本函数不改传入记录。 */
export function applyFinishedOutboundAction(order: FinishedOutboundOrder, action: FinishedOutboundAction, at: string): FinishedOutboundOrder {
  if (order.orderType === '成衣质检') throw new Error('成衣质检出库已在送检时完成，请从关联送检单查看流转。')
  // Calendar validation is required even for inactive records; source timezone
  // remains explicit for priority calculation and is never inferred here.
  if (parseQcShippingDeadlineMillis(order.deadline, order.deadlineTimeZone || 'Asia/Jakarta') === undefined) throw new Error('出库单揽收时效无效，请依据来源核对后再操作。')
  const next = structuredClone(order)
  let description: string
  if (action === 'download-label') {
    if (order.platform !== 'Tiktok' || order.status === '待处理' || order.status === '已取消') throw new Error('当前出库单不能下载 Tiktok 面单。')
    next.labelDownloadedAt = at
    description = '下载 Tiktok 面单'
  } else {
    if (order.status !== '已打单') throw new Error('仅已打单的出库单可以执行此操作，请重新读取后重试。')
    if (action === 'print') {
      next.printCount += 1
      next.printedAt = at
      description = '打印面单'
    } else if (action === 'cancel-print') {
      next.status = '已取消'
      next.cancelledAt = at
      // 用户确认取消后终止本单；已发生的打印次数与时间仍保留供追溯。
      description = '取消打单'
    } else if (action === 'outbound') {
      next.status = '已出库'
      next.shippedAt = at
      description = '确认出库'
    } else throw new Error('不支持的出库操作。')
  }
  next.version += 1
  next.updatedAt = at
  next.logs.push({ at, action: description, operator: '本机操作', remark: '已保存至本浏览器；不改变线上库存或实际物流。' })
  return next
}

const DB_NAME = 'higood-finished-outbound-v1'
const DB_VERSION = 1
type OperationReceipt = { id: string; action: FinishedOutboundAction; ids: string[]; at: string }

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('当前浏览器无法读取本地出库单，请使用支持 IndexedDB 的浏览器。')); return }
    let settled = false
    let request: IDBOpenDBRequest
    try { request = indexedDB.open(DB_NAME, DB_VERSION) } catch (error) { reject(error); return }
    request.onupgradeneeded = () => {
      const db = request.result
      for (const name of ['records', 'operations']) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
    }
    request.onerror = () => { settled = true; reject(request.error ?? new Error('本地出库单读取失败。')) }
    request.onblocked = () => { settled = true; reject(new Error('本地出库单升级被旧页面阻挡，请关闭其他旧页面后重新读取。')) }
    request.onsuccess = () => {
      const db = request.result
      if (settled) { db.close(); return }
      db.onversionchange = () => db.close()
      settled = true
      resolve(db)
    }
  })
}

function mergeOverrides(overrides: FinishedOutboundOrder[]): FinishedOutboundOrder[] {
  const records = new Map(FINISHED_OUTBOUND_SEED.map(row => [row.id, row]))
  for (const row of overrides) records.set(row.id, row)
  return structuredClone([...records.values()])
}

export async function loadFinishedOutboundOrders(): Promise<FinishedOutboundOrder[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    let rows: FinishedOutboundOrder[] = []
    let tx: IDBTransaction
    try { tx = db.transaction('records', 'readonly') } catch (error) { db.close(); reject(error); return }
    const request = tx.objectStore('records').getAll()
    request.onsuccess = () => { rows = request.result as FinishedOutboundOrder[] }
    tx.oncomplete = () => { db.close(); resolve(mergeOverrides(rows)) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('本地出库单读取中断，请重新读取。')) }
    tx.onerror = () => { /* 由 onabort 统一报告，不发布半套结果。 */ }
  })
}

function currentBusinessTime(): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')} ${value('hour')}:${value('minute')}:${value('second')}`
}

export async function saveFinishedOutboundAction(
  ids: string[], expectedVersions: Record<string, number>, action: FinishedOutboundAction, operationId: string,
): Promise<FinishedOutboundOrder[]> {
  const targets = [...new Set(ids)].sort()
  if (!targets.length) throw new Error('请先选择出库单。')
  if (!operationId.trim()) throw new Error('缺少操作标识，请重新打开操作后重试。')
  const at = currentBusinessTime()
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction
    try { tx = db.transaction(['records', 'operations'], 'readwrite') } catch (error) { db.close(); reject(error); return }
    const records = tx.objectStore('records')
    const operations = tx.objectStore('operations')
    let failure: unknown
    let result: FinishedOutboundOrder[] = []
    const fail = (error: unknown) => { failure = error; tx.abort() }
    const readResult = () => {
      const request = records.getAll()
      request.onsuccess = () => { result = mergeOverrides(request.result as FinishedOutboundOrder[]) }
    }
    tx.oncomplete = () => { db.close(); resolve(result) }
    tx.onabort = () => { db.close(); reject(failure ?? tx.error ?? new Error('保存失败，原数据未改变，请保留当前输入后重试。')) }
    tx.onerror = () => { /* 原生请求失败会中止整个事务；只由 onabort 报告。 */ }
    const previous = operations.get(operationId)
    previous.onsuccess = () => {
      const receipt = previous.result as OperationReceipt | undefined
      if (receipt) {
        if (receipt.action !== action || JSON.stringify(receipt.ids) !== JSON.stringify(targets)) { fail(new Error('操作标识与先前操作不一致，请重新打开操作。')); return }
        readResult()
        return
      }
      const changed: FinishedOutboundOrder[] = []
      let remaining = targets.length
      for (const id of targets) {
        const request = records.get(id)
        request.onsuccess = () => {
          if (failure) return
          try {
            const current = (request.result as FinishedOutboundOrder | undefined) ?? FINISHED_OUTBOUND_SEED.find(row => row.id === id)
            if (!current) throw new Error('出库单不存在，请重新读取。')
            if (expectedVersions[id] !== current.version) throw new Error('出库单已被其他页面更新，请重新读取后重试。')
            changed.push(applyFinishedOutboundAction(current, action, at))
            remaining -= 1
            if (remaining === 0) {
              for (const row of changed) records.put(row)
              operations.add({ id: operationId, action, ids: targets, at } satisfies OperationReceipt)
              readResult()
            }
          } catch (error) { fail(error) }
        }
      }
    }
  })
}

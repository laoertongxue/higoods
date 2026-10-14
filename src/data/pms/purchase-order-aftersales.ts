import { pmsCoreOperationSignature, assertPmsCoreDraftVersion, pmsCoreStableCode } from './core-write-contract.ts'
import { PMS_STORES, pmsAll, pmsCommitRecords } from './idb-storage.ts'
import { PmsDomainError, PMS_BUYER_ACTOR } from './runtime.ts'
import { getPmsProductPurchaseOrder, hydratePmsProductPurchaseOrdersFromIdb, listPmsProductPurchaseOrders, publishPmsProductPurchaseOrders, type PmsProductPurchaseOrder, type PmsProductPurchaseType } from './product-purchase-orders.ts'

/**
 * 商品采购售后(原型 mock,跟随 manage.higood.ai /pms/product_purchase_order_aftersales/index)。
 * 采购售后及关联采购单按当前动作原子保存，固定演示记录不落盘。
 */

export type PmsAftersaleStatus = '待处理' | '售后中' | '已完成' | '已驳回'

export interface PmsAftersaleTrackingEntry {
  carrier: string
  trackingNo: string
  pickedUpAt: string
  signedAt: string
}

export interface PmsAftersaleActionLog {
  action: string
  actorName: string
  occurredAt: string
  remark: string
}

export interface PmsPurchaseOrderAftersale {
  id: string
  aftersalesNo?: string
  spu: string
  productName: string
  imageUrl: string
  costPrice: number
  supplierName: string
  recipientName: string
  platform: '淘宝' | '天猫' | '拼多多' | '1688' | '其他'
  purchaseType: PmsProductPurchaseType
  purchaseOrderNo: string
  purchaseRemark: string
  specs: string
  purchaser: string
  status: PmsAftersaleStatus
  reason: string
  inboundTrackings: PmsAftersaleTrackingEntry[]
  returnAddress: string
  returnTrackings: PmsAftersaleTrackingEntry[]
  createdAt: string
  applicant: string
  remark: string
  logs: PmsAftersaleActionLog[]
  returnApproved?: boolean
  skuLines?: Array<{ sku: string; qty: number; price: number }>
  _pmsBaseVersion?: number
}

interface AftersaleRuntime {
  aftersales: PmsPurchaseOrderAftersale[]
}

function getRuntime(): AftersaleRuntime {
  if (!aftersaleInitialized) {
    aftersaleInitialized = true
    const orders = listPmsProductPurchaseOrders()
    aftersaleRuntime.aftersales = aftersaleRuntime.aftersales.map((row, index) => {
      const order = orders[index % orders.length]
      return { ...row, aftersalesNo: row.id, ...(order ? { spu: order.spu, productName: order.productName, imageUrl: order.imageUrl,
        purchaseOrderNo: order.purchaseOrderNo, purchaseType: order.purchaseType, supplierName: order.supplierName,
        specs: order.lines.map(line => `${line.color}/${line.size}：1`).join('；'), skuLines: order.lines.map(line => ({ sku: line.sku, qty: 1, price: line.actualPrice })) } : {}) }
    })
  }
  return aftersaleRuntime
}
let aftersaleInitialized = false
let aftersaleHydration: Promise<void> | null = null
export function hydratePmsPurchaseOrderAftersalesFromIdb(): Promise<void> {
  if (aftersaleHydration) return aftersaleHydration
  aftersaleHydration = pmsAll<PmsPurchaseOrderAftersale>(PMS_STORES.pmsPurchaseOrderAftersales)
    .then(publishPmsPurchaseOrderAftersales).catch((error: unknown) => { aftersaleHydration = null; throw error })
  return aftersaleHydration
}
export function publishPmsPurchaseOrderAftersales(rows: PmsPurchaseOrderAftersale[]): void {
  const all = getRuntime().aftersales
  for (const row of rows) {
    const id = row.id || row.aftersalesNo || ''
    const index = all.findIndex(item => item.id === id)
    if (index >= 0) all[index] = { ...row, id, aftersalesNo: id }
    else all.unshift({ ...row, id, aftersalesNo: id })
  }
}

const aftersaleRuntime: AftersaleRuntime = {
  aftersales: [
    {
      id: 'AS-84081',
      spu: 'CHCXX26100913',
      productName: 'atasan wanita blouse lengan panjang motif kotak korean style',
      imageUrl: '',
      costPrice: 208.34,
      supplierName: 'BULEEBOOM张爆爆',
      recipientName: '猩猩',
      platform: '淘宝',
      purchaseType: '样衣',
      purchaseOrderNo: 'PO-359580',
      purchaseRemark: '5127780420080064934\nGreen：1',
      specs: 'Green：1',
      purchaser: '小满',
      status: '待处理',
      reason: '8',
      inboundTrackings: [
        { carrier: 'STO', trackingNo: '773445843891662', pickedUpAt: '2026-10-10 22:20:00', signedAt: '2026-10-12 09:47:00' },
      ],
      returnAddress: '',
      returnTrackings: [],
      createdAt: '2026-10-13 10:38:21',
      applicant: 'waiwai',
      remark: '',
      logs: [],
    },
    {
      id: 'AS-84080',
      spu: 'ASYKL26100819',
      productName: 'stelan atasan motif cetak gaya baru di padukan dengan celana panjang',
      imageUrl: '',
      costPrice: 20.30,
      supplierName: '淇小姐服饰',
      recipientName: '可粒',
      platform: '淘宝',
      purchaseType: '样衣',
      purchaseOrderNo: 'PO-359029',
      purchaseRemark: '5127497462092192145\nBlack：1',
      specs: 'Black：1',
      purchaser: '小满',
      status: '待处理',
      reason: '6',
      inboundTrackings: [
        { carrier: 'ZTO', trackingNo: '79038570622926', pickedUpAt: '2026-10-10 00:10:00', signedAt: '2026-10-10 18:27:00' },
      ],
      returnAddress: '',
      returnTrackings: [],
      createdAt: '2026-10-13 10:37:18',
      applicant: 'waiwai',
      remark: '',
      logs: [],
    },
    {
      id: 'AS-84078',
      spu: 'FADUU26092942',
      productName: 'Jumpsuit Wanita Elegan Motif Cetak Blok Warna Ikat Pinggang',
      imageUrl: '',
      costPrice: 87.48,
      supplierName: '拉14',
      recipientName: '圆圆',
      platform: '拼多多',
      purchaseType: '样衣',
      purchaseOrderNo: 'PO-357111',
      purchaseRemark: '发错 \n261006-285978202542084\nApricot：1',
      specs: 'Apricot：1',
      purchaser: '阿昊.王昊',
      status: '待处理',
      reason: '发错',
      inboundTrackings: [
        { carrier: 'yt', trackingNo: 'YT0715359555352', pickedUpAt: '', signedAt: '' },
      ],
      returnAddress: '',
      returnTrackings: [],
      createdAt: '2026-10-13 10:15:48',
      applicant: '泳如',
      remark: '',
      logs: [],
    },
    {
      id: 'AS-84077',
      spu: 'FADUU26092910',
      productName: 'Atasan Kemeja Lengan Pajang Motif Striped dengan kancing Aktif Bergaya Kasual',
      imageUrl: '',
      costPrice: 47.60,
      supplierName: '布衣坊清新女装',
      recipientName: '圆圆',
      platform: '拼多多',
      purchaseType: '样衣',
      purchaseOrderNo: 'PO-357148',
      purchaseRemark: '缺灰色。\n261006-641015540142084\nGreen：1\ngrey：1',
      specs: 'Green：1\ngrey：1',
      purchaser: '阿昊.王昊',
      status: '待处理',
      reason: '退1件绿色',
      inboundTrackings: [
        { carrier: 'yt', trackingNo: 'YT0715318359863', pickedUpAt: '2026-10-09 15:32:00', signedAt: '2026-10-11 11:37:00' },
      ],
      returnAddress: '',
      returnTrackings: [],
      createdAt: '2026-10-13 09:14:53',
      applicant: '泳如',
      remark: '',
      logs: [],
    },
    {
      id: 'AS-84075',
      spu: 'CHCLL26092201',
      productName: 'Gaun Lengan Panjang Model A-Line Motif Cetak Gaya Kekinian Wanita Modis Cantik Manis',
      imageUrl: '',
      costPrice: 119.99,
      supplierName: '啸日系女装店',
      recipientName: '朝群',
      platform: '拼多多',
      purchaseType: '样衣',
      purchaseOrderNo: 'PO-355363',
      purchaseRemark: '260928-682329455022084\nGray：1\nPurple：1',
      specs: 'Gray：1\nPurple：1',
      purchaser: '阿昊.王昊',
      status: '售后中',
      reason: '1',
      inboundTrackings: [
        { carrier: 'zt', trackingNo: '465720050075170', pickedUpAt: '', signedAt: '' },
      ],
      returnAddress: '广东省广州市天河区珠江新城 A 座 18 楼',
      returnTrackings: [],
      createdAt: '2026-10-12 18:14:23',
      applicant: '蓝莓',
      remark: '已通知供应商补寄 Gray',
      logs: [
        { action: '同意退货', actorName: '蓝莓', occurredAt: '2026-10-12 18:30:00', remark: '等待供应商收件' },
      ],
    },
    {
      id: 'AS-84074',
      spu: 'CHCLL26091412',
      productName: 'Atasan Lengan Panjang Oversize Resleting Setengah Gaya Modish',
      imageUrl: '',
      costPrice: 193.00,
      supplierName: '榜喜旗舰店',
      recipientName: '复购',
      platform: '天猫',
      purchaseType: '样衣',
      purchaseOrderNo: 'PO-357090',
      purchaseRemark: '5127804253014192145\nApricot：1',
      specs: 'Apricot：1',
      purchaser: '小满',
      status: '售后中',
      reason: '1',
      inboundTrackings: [
        { carrier: 'YTO', trackingNo: 'YT7647339069089', pickedUpAt: '2026-10-01 00:57:00', signedAt: '2026-10-01 16:43:00' },
      ],
      returnAddress: '广东省广州市天河区珠江新城 A 座 18 楼',
      returnTrackings: [],
      createdAt: '2026-10-12 18:10:59',
      applicant: '蓝莓',
      remark: '',
      logs: [
        { action: '同意退货', actorName: '蓝莓', occurredAt: '2026-10-12 18:25:00', remark: '' },
      ],
    },
    {
      id: 'AS-84073',
      spu: 'CHCLL26092923',
      productName: 'Gaun Gaya Korea dengan Desain Unik Leher V Berikat Lengan Pendek untuk Wanita',
      imageUrl: '',
      costPrice: 93.30,
      supplierName: '星之语服饰',
      recipientName: '朝群',
      platform: '拼多多',
      purchaseType: '样衣',
      purchaseOrderNo: 'PO-358032',
      purchaseRemark: '261007-260602673582084\nApricot：1',
      specs: 'Apricot：1',
      purchaser: '阿昊.王昊',
      status: '售后中',
      reason: '1',
      inboundTrackings: [
        { carrier: 'zt', trackingNo: '79147577329965', pickedUpAt: '2026-10-07 15:50:00', signedAt: '2026-10-08 18:19:00' },
      ],
      returnAddress: '广东省广州市天河区珠江新城 A 座 18 楼',
      returnTrackings: [],
      createdAt: '2026-10-12 18:06:41',
      applicant: '蓝莓',
      remark: '',
      logs: [
        { action: '同意退货', actorName: '蓝莓', occurredAt: '2026-10-12 18:30:00', remark: '等待供应商收件' },
      ],
    },
    {
      id: 'AS-84071',
      spu: 'ASYQU26100811',
      productName: 'Atasan T-shirt lengan pendek dengan kerah bulat bergaya kasual, lembut, tipis, dan bermotif',
      imageUrl: '',
      costPrice: 8.84,
      supplierName: '达丽女装服饰',
      recipientName: '莎莎',
      platform: '拼多多',
      purchaseType: '样衣',
      purchaseOrderNo: 'PO-358763',
      purchaseRemark: '261009-430398564782084\nGray：1\nWhite：1',
      specs: 'Gray：1\nWhite：1',
      purchaser: '阿昊.王昊',
      status: '售后中',
      reason: '2',
      inboundTrackings: [
        { carrier: 'zt', trackingNo: '79148171816434', pickedUpAt: '2026-10-09 18:10:00', signedAt: '2026-10-10 18:28:00' },
      ],
      returnAddress: '广东省广州市天河区珠江新城 A 座 18 楼',
      returnTrackings: [],
      createdAt: '2026-10-12 18:03:02',
      applicant: '曲奇',
      remark: '',
      logs: [
        { action: '同意退货', actorName: '曲奇', occurredAt: '2026-10-12 18:25:00', remark: '' },
      ],
    },
    {
      id: 'AS-84069',
      spu: 'CHCAY26092413',
      productName: 'atasan wanita blouse lengan panjang model terbaru gaya feminine kerah bulat',
      imageUrl: '',
      costPrice: 34.80,
      supplierName: 'VICTORIAVERA服饰鞋包官方旗舰',
      recipientName: '朝群',
      platform: '拼多多',
      purchaseType: '样衣',
      purchaseOrderNo: 'PO-355693',
      purchaseRemark: '260928-658904246702084\nBlack：1\nBlue：1\nWhite：1\nYellow：1',
      specs: 'Black：1\nBlue：1\nWhite：1\nYellow：1',
      purchaser: '阿昊.王昊',
      status: '售后中',
      reason: '1',
      inboundTrackings: [
        { carrier: 'jt', trackingNo: 'JT5531416061717', pickedUpAt: '', signedAt: '' },
      ],
      returnAddress: '广东省广州市天河区珠江新城 A 座 18 楼',
      returnTrackings: [],
      createdAt: '2026-10-12 17:53:10',
      applicant: '月月',
      remark: '',
      logs: [
        { action: '同意退货', actorName: '月月', occurredAt: '2026-10-12 18:00:00', remark: '' },
      ],
    },
    {
      id: 'AS-84066',
      spu: 'ASYSA26092415',
      productName: 'kaus wanita feminime model baru dengan lengan pendek gaya korean kekinian',
      imageUrl: '',
      costPrice: 24.80,
      supplierName: '优梦妍女装',
      recipientName: '莎莎',
      platform: '拼多多',
      purchaseType: '样衣',
      purchaseOrderNo: 'PO-357733',
      purchaseRemark: '缺黑色。\n261006-679739441582084\nBlack：1\nRed：1',
      specs: 'Black：1\nRed：1',
      purchaser: '阿昊.王昊',
      status: '售后中',
      reason: '1',
      inboundTrackings: [
        { carrier: 'zt', trackingNo: 'YT0713721793814', pickedUpAt: '', signedAt: '' },
      ],
      returnAddress: '广东省广州市天河区珠江新城 A 座 18 楼',
      returnTrackings: [],
      createdAt: '2026-10-12 16:04:58',
      applicant: '莎莎',
      remark: '',
      logs: [
        { action: '同意退货', actorName: '莎莎', occurredAt: '2026-10-12 16:30:00', remark: '' },
      ],
    },
    {
      id: 'AS-84062',
      spu: 'ASYSA26092401',
      productName: 'Atasan Kemeja Wanita Motif Blok Warna Gaya Mewah',
      imageUrl: '',
      costPrice: 19.90,
      supplierName: '乐依酷三',
      recipientName: '莎莎',
      platform: '拼多多',
      purchaseType: '样衣',
      purchaseOrderNo: 'PO-357725',
      purchaseRemark: '0755上衣\n261006-651752948142084\nSameAsPhoto：1',
      specs: 'SameAsPhoto：1',
      purchaser: '阿昊.王昊',
      status: '售后中',
      reason: '1',
      inboundTrackings: [
        { carrier: 'zt', trackingNo: 'YT0713600455167', pickedUpAt: '', signedAt: '' },
      ],
      returnAddress: '广东省广州市天河区珠江新城 A 座 18 楼',
      returnTrackings: [],
      createdAt: '2026-10-12 16:04:58',
      applicant: '莎莎',
      remark: '',
      logs: [
        { action: '同意退货', actorName: '莎莎', occurredAt: '2026-10-12 16:20:00', remark: '' },
      ],
    },
  ],
}

export function listPmsPurchaseOrderAftersales(): PmsPurchaseOrderAftersale[] {
  return getRuntime().aftersales.slice()
}

export function getPmsPurchaseOrderAftersale(id: string): PmsPurchaseOrderAftersale | undefined {
  return getRuntime().aftersales.find((a) => a.id === id)
}

export interface PmsAftersaleFilter {
  productCode?: string
  status?: '' | PmsAftersaleStatus
  purchaser?: string
  platform?: '' | PmsPurchaseOrderAftersale['platform']
  recipients?: string[]
  purchasers?: string[]
}

export function filterPmsPurchaseOrderAftersales(filter: PmsAftersaleFilter): PmsPurchaseOrderAftersale[] {
  return listPmsPurchaseOrderAftersales().filter((row) => {
    if (filter.productCode) {
      const code = filter.productCode.toLowerCase()
      const hit = [row.spu, row.productName, row.purchaseOrderNo, row.id, ...(row.skuLines?.map(line => line.sku) ?? [])].some(value => value.toLowerCase().includes(code))
      if (!hit) return false
    }
    if (filter.status && row.status !== filter.status) return false
    if (filter.purchaser && row.purchaser !== filter.purchaser) return false
    if (filter.recipients?.length && !filter.recipients.includes(row.recipientName)) return false
    if (filter.purchasers?.length && !filter.purchasers.includes(row.purchaser)) return false
    if (filter.platform && row.platform !== filter.platform) return false
    return true
  })
}

function appendLog(aftersale: PmsPurchaseOrderAftersale, action: string, actorName: string, remark: string): void {
  aftersale.logs.unshift({
    action,
    actorName,
    occurredAt: new Date().toISOString(),
    remark,
  })
}

export interface PmsBatchUpdateResult { updatedCount: number; rejectedCount: number }
export type PmsAftersaleAction = '开始售后' | '驳回' | '同意退货' | '更新状态' | '完善退货地址' | '更新退货快递' | '备注'

export async function commitPmsAftersaleBatch(ids: string[], action: PmsAftersaleAction, fields: { status?: PmsAftersaleStatus; remark?: string; address?: string; carrier?: string; trackingNo?: string }, actorName: string, operationId: string, expectedVersions?: Record<string, number>): Promise<PmsBatchUpdateResult> {
  await hydratePmsPurchaseOrderAftersalesFromIdb()
  if (!ids.length) throw new PmsDomainError('PMS_AFTERSALE_EMPTY', '请先选择售后单')
  const rows = [...new Set(ids)].map(id => {
    const old = getPmsPurchaseOrderAftersale(id)
    if (!old) throw new PmsDomainError('PMS_AFTERSALE_NOT_FOUND', '售后单不存在')
    assertPmsCoreDraftVersion(old, expectedVersions?.[id])
    const next = structuredClone(old); next.aftersalesNo = next.id
    const remark = fields.remark?.trim() ?? ''
    if (action === '开始售后') {
      if (old.status !== '待处理') throw new PmsDomainError('PMS_AFTERSALE_STATUS', `${id}当前状态不能开始售后`)
      next.status = '售后中'
    } else if (action === '驳回') {
      if (old.status !== '待处理') throw new PmsDomainError('PMS_AFTERSALE_STATUS', `${id}当前状态不能驳回`)
      if (!remark) throw new PmsDomainError('PMS_AFTERSALE_REASON', '请填写驳回原因')
      next.status = '已驳回'
    } else if (action === '同意退货') {
      if (!['待处理', '售后中'].includes(old.status)) throw new PmsDomainError('PMS_AFTERSALE_STATUS', `${id}当前状态不能同意退货`)
      if (!next.returnAddress.trim()) throw new PmsDomainError('PMS_AFTERSALE_ADDRESS', `${id}缺少退货地址，请先完善退货信息`)
      next.returnApproved = true; next.status = '售后中'
    } else if (action === '完善退货地址') {
      if (!fields.address?.trim()) throw new PmsDomainError('PMS_AFTERSALE_ADDRESS', '请填写退货地址')
      next.returnAddress = fields.address.trim()
    } else if (action === '更新退货快递') {
      if (!fields.carrier?.trim() || !fields.trackingNo?.trim()) throw new PmsDomainError('PMS_AFTERSALE_TRACKING', '请填写快递公司与单号')
      if (next.returnTrackings.some(item => item.trackingNo === fields.trackingNo?.trim())) throw new PmsDomainError('PMS_AFTERSALE_DUPLICATE_TRACKING', '此退货运单已登记')
      next.returnTrackings.unshift({ carrier: fields.carrier.trim(), trackingNo: fields.trackingNo.trim(), pickedUpAt: new Date().toISOString(), signedAt: '' })
    } else if (action === '备注') next.remark = remark
    else {
      const status = fields.status
      if (!status) throw new PmsDomainError('PMS_AFTERSALE_STATUS', '请选择目标状态')
      if (old.status === '待处理' && !['售后中', '已驳回'].includes(status)) throw new PmsDomainError('PMS_AFTERSALE_STATUS', '待处理只能开始售后或驳回')
      if (old.status === '售后中' && ['待处理', '已驳回'].includes(status)) throw new PmsDomainError('PMS_AFTERSALE_STATUS', '售后中不能回退')
      if (['已完成', '已驳回'].includes(old.status) && status !== old.status) throw new PmsDomainError('PMS_AFTERSALE_STATUS', '已结束的售后不能重新变更状态')
      next.status = status
    }
    appendLog(next, action, actorName, remark)
    return next
  })
  await pmsCommitRecords(rows.map(value => ({ store: PMS_STORES.pmsPurchaseOrderAftersales, value })), { operationId, operationSignature: pmsCoreOperationSignature(action, { ids: [...new Set(ids)], fields }),
    log: { objectType: 'purchase-order-aftersale', objectId: rows[0].id, action, beforeValue: '', afterValue: rows.map(row => `${row.id}/${row.status}`).join('、'), reason: fields.remark ?? '', actorId: actorName, actorName, actorRole: '采购员', relatedPurchaseOrderNo: rows[0].purchaseOrderNo, secondConfirmation: ['驳回', '同意退货', '更新状态'].includes(action) } })
  publishPmsPurchaseOrderAftersales(rows)
  return { updatedCount: rows.length, rejectedCount: 0 }
}

export async function startPmsAftersale(id: string, actorName: string, remark: string, operationId = `aftersale-start-${crypto.randomUUID()}`): Promise<PmsPurchaseOrderAftersale> {
  await commitPmsAftersaleBatch([id], '开始售后', { remark }, actorName, operationId); return getPmsPurchaseOrderAftersale(id)!
}
export async function rejectPmsAftersale(id: string, actorName: string, reason: string, operationId = `aftersale-reject-${crypto.randomUUID()}`): Promise<PmsPurchaseOrderAftersale> {
  await commitPmsAftersaleBatch([id], '驳回', { remark: reason }, actorName, operationId); return getPmsPurchaseOrderAftersale(id)!
}
export async function updatePmsAftersaleReturnAddress(id: string, address: string, actorName: string, operationId = `aftersale-address-${crypto.randomUUID()}`): Promise<PmsPurchaseOrderAftersale> {
  await commitPmsAftersaleBatch([id], '完善退货地址', { address }, actorName, operationId); return getPmsPurchaseOrderAftersale(id)!
}
export async function addPmsAftersaleReturnTracking(id: string, carrier: string, trackingNo: string, actorName: string, operationId = `aftersale-tracking-${crypto.randomUUID()}`): Promise<PmsPurchaseOrderAftersale> {
  await commitPmsAftersaleBatch([id], '更新退货快递', { carrier, trackingNo }, actorName, operationId); return getPmsPurchaseOrderAftersale(id)!
}
export async function updatePmsAftersaleStatus(id: string, status: PmsAftersaleStatus, actorName: string, remark: string, operationId = `aftersale-status-${crypto.randomUUID()}`): Promise<PmsPurchaseOrderAftersale> {
  await commitPmsAftersaleBatch([id], '更新状态', { status, remark }, actorName, operationId); return getPmsPurchaseOrderAftersale(id)!
}
export async function updatePmsAftersaleRemark(id: string, remark: string, actorName: string, operationId = `aftersale-note-${crypto.randomUUID()}`): Promise<PmsPurchaseOrderAftersale> {
  await commitPmsAftersaleBatch([id], '备注', { remark }, actorName, operationId); return getPmsPurchaseOrderAftersale(id)!
}
export function batchStartPmsAftersales(ids: string[], actorName: string, remark: string, operationId = `aftersale-start-${crypto.randomUUID()}`): Promise<PmsBatchUpdateResult> {
  return commitPmsAftersaleBatch(ids, '开始售后', { remark }, actorName, operationId)
}
export function batchApprovePmsAftersales(ids: string[], actorName: string, remark: string, operationId = `aftersale-return-${crypto.randomUUID()}`): Promise<PmsBatchUpdateResult> {
  return commitPmsAftersaleBatch(ids, '同意退货', { remark }, actorName, operationId)
}
export function batchUpdatePmsAftersaleStatus(ids: string[], status: PmsAftersaleStatus, actorName: string, remark: string, operationId = `aftersale-status-${crypto.randomUUID()}`): Promise<PmsBatchUpdateResult> {
  return commitPmsAftersaleBatch(ids, '更新状态', { status, remark }, actorName, operationId)
}

export function preparePmsAftersalesFromOrders(orderNos: string[], reason: string, actorName: string, operationId: string): PmsPurchaseOrderAftersale[] {
  if (!orderNos.length || !reason.trim()) throw new PmsDomainError('PMS_AFTERSALE_REASON', '请选择采购单并填写售后原因')
  return [...new Set(orderNos)].map((no, index) => {
    const order = getPmsProductPurchaseOrder(no)
    if (!order || order.status === '已关闭') throw new PmsDomainError('PMS_AFTERSALE_ORDER', '采购单不存在或已关闭')
    const id = `AS-2026-${pmsCoreStableCode(operationId)}-${index + 1}`
    return { id, aftersalesNo: id, spu: order.spu, productName: order.productName, imageUrl: order.imageUrl, costPrice: order.lines.reduce((sum, line) => sum + line.qty * line.actualPrice, 0), supplierName: order.supplierName, recipientName: order.recipientName ?? actorName, platform: '其他', purchaseType: order.purchaseType, purchaseOrderNo: no, purchaseRemark: order.remark, specs: order.lines.map(line => `${line.color}/${line.size}：${line.qty}`).join('；'), purchaser: order.purchaser ?? order.creator, status: '待处理', reason: reason.trim(), inboundTrackings: [], returnAddress: '', returnTrackings: [], createdAt: new Date().toISOString(), applicant: actorName, remark: '', logs: [{ action: '发起售后', actorName, occurredAt: new Date().toISOString(), remark: reason.trim() }], skuLines: order.lines.map(line => ({ sku: line.sku, qty: line.qty, price: line.actualPrice })), _pmsBaseVersion: 0 }
  })
}

export async function createPmsAftersalesFromOrders(orderNos: string[], reason: string, actorName: string, operationId: string): Promise<PmsPurchaseOrderAftersale[]> {
  await Promise.all([hydratePmsPurchaseOrderAftersalesFromIdb(), hydratePmsProductPurchaseOrdersFromIdb()])
  const rows = preparePmsAftersalesFromOrders(orderNos, reason, actorName, operationId)
  const orders = rows.map(row => {
    const order = structuredClone(getPmsProductPurchaseOrder(row.purchaseOrderNo)!)
    order.aftersaleIds = [...new Set([...(order.aftersaleIds ?? []), row.id])]
    return order
  })
  await pmsCommitRecords([...rows.map(value => ({ store: PMS_STORES.pmsPurchaseOrderAftersales, value })), ...orders.map(value => ({ store: PMS_STORES.pmsProductPurchaseOrders, value }))], { operationId, operationSignature: pmsCoreOperationSignature('发起售后', { orderNos, reason }), log: { objectType: 'purchase-order-aftersale', objectId: rows[0].id, action: '发起售后', beforeValue: '', afterValue: `${rows.length}张售后单`, reason: reason.trim(), actorId: PMS_BUYER_ACTOR.id, actorName, actorRole: PMS_BUYER_ACTOR.role, relatedPurchaseOrderNo: rows[0].purchaseOrderNo } })
  publishPmsPurchaseOrderAftersales(rows)
  publishPmsProductPurchaseOrders(orders as PmsProductPurchaseOrder[])
  return rows
}

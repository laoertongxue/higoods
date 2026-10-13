/**
 * 商品采购售后(原型 mock,跟随 manage.higood.ai /pms/product_purchase_order_aftersales/index)。
 * 仅做内存态,管理新商品采购单的售后履约:开始售后、驳回、完善退货地址、同意退货、更新状态、备注。
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
  spu: string
  productName: string
  imageUrl: string
  costPrice: number
  supplierName: string
  recipientName: string
  platform: '淘宝' | '天猫' | '拼多多' | '1688' | '其他'
  purchaseType: '做货' | '成衣' | '样衣'
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
}

interface AftersaleRuntime {
  aftersales: PmsPurchaseOrderAftersale[]
}

function getRuntime(): AftersaleRuntime {
  return aftersaleRuntime
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
}

export function filterPmsPurchaseOrderAftersales(filter: PmsAftersaleFilter): PmsPurchaseOrderAftersale[] {
  return listPmsPurchaseOrderAftersales().filter((row) => {
    if (filter.productCode) {
      const code = filter.productCode.toLowerCase()
      const hit = row.spu.toLowerCase().includes(code) || row.purchaseOrderNo.toLowerCase().includes(code) || row.id.toLowerCase().includes(code)
      if (!hit) return false
    }
    if (filter.status && row.status !== filter.status) return false
    if (filter.purchaser && row.purchaser !== filter.purchaser) return false
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

export function startPmsAftersale(id: string, actorName: string, remark: string): PmsPurchaseOrderAftersale {
  const row = getPmsPurchaseOrderAftersale(id)
  if (!row) throw new Error(`售后单 ${id} 不存在`)
  if (row.status !== '待处理') throw new Error(`售后单 ${id} 状态 ${row.status},不可开始售后`)
  row.status = '售后中'
  appendLog(row, '开始售后', actorName, remark)
  return row
}

export function rejectPmsAftersale(id: string, actorName: string, reason: string): PmsPurchaseOrderAftersale {
  const row = getPmsPurchaseOrderAftersale(id)
  if (!row) throw new Error(`售后单 ${id} 不存在`)
  if (row.status !== '待处理') throw new Error(`售后单 ${id} 状态 ${row.status},不可驳回`)
  row.status = '已驳回'
  appendLog(row, '驳回', actorName, reason)
  return row
}

export function updatePmsAftersaleReturnAddress(id: string, address: string, actorName: string): PmsPurchaseOrderAftersale {
  const row = getPmsPurchaseOrderAftersale(id)
  if (!row) throw new Error(`售后单 ${id} 不存在`)
  row.returnAddress = address
  appendLog(row, '完善退货地址', actorName, '')
  return row
}

export function addPmsAftersaleReturnTracking(
  id: string,
  carrier: string,
  trackingNo: string,
  actorName: string,
): PmsPurchaseOrderAftersale {
  const row = getPmsPurchaseOrderAftersale(id)
  if (!row) throw new Error(`售后单 ${id} 不存在`)
  row.returnTrackings.unshift({ carrier, trackingNo, pickedUpAt: new Date().toISOString(), signedAt: '' })
  appendLog(row, '更新退货快递', actorName, `${carrier} : ${trackingNo}`)
  return row
}

export function updatePmsAftersaleStatus(
  id: string,
  status: PmsAftersaleStatus,
  actorName: string,
  remark: string,
): PmsPurchaseOrderAftersale {
  const row = getPmsPurchaseOrderAftersale(id)
  if (!row) throw new Error(`售后单 ${id} 不存在`)
  if (row.status === '待处理' && status !== '售后中' && status !== '已驳回') {
    throw new Error(`待处理状态只能转为售后中或已驳回,不可为 ${status}`)
  }
  if (row.status === '售后中' && (status === '待处理' || status === '已驳回')) {
    throw new Error(`售后中状态不可回退为 ${status}`)
  }
  row.status = status
  appendLog(row, `更新状态为${status}`, actorName, remark)
  return row
}

export function updatePmsAftersaleRemark(id: string, remark: string, actorName: string): PmsPurchaseOrderAftersale {
  const row = getPmsPurchaseOrderAftersale(id)
  if (!row) throw new Error(`售后单 ${id} 不存在`)
  row.remark = remark
  appendLog(row, '备注', actorName, '')
  return row
}

export interface PmsBatchUpdateResult {
  updatedCount: number
  rejectedCount: number
}

export function batchStartPmsAftersales(ids: string[], actorName: string, remark: string): PmsBatchUpdateResult {
  const result: PmsBatchUpdateResult = { updatedCount: 0, rejectedCount: 0 }
  for (const id of ids) {
    const row = getPmsPurchaseOrderAftersale(id)
    if (!row) {
      result.rejectedCount += 1
      continue
    }
    if (row.status !== '待处理') {
      result.rejectedCount += 1
      continue
    }
    startPmsAftersale(id, actorName, remark)
    result.updatedCount += 1
  }
  return result
}

export function batchApprovePmsAftersales(ids: string[], actorName: string, remark: string): PmsBatchUpdateResult {
  const result: PmsBatchUpdateResult = { updatedCount: 0, rejectedCount: 0 }
  for (const id of ids) {
    const row = getPmsPurchaseOrderAftersale(id)
    if (!row) {
      result.rejectedCount += 1
      continue
    }
    if (row.status !== '待处理') {
      result.rejectedCount += 1
      continue
    }
    row.status = '售后中'
    appendLog(row, '同意退货', actorName, remark)
    result.updatedCount += 1
  }
  return result
}

export function batchUpdatePmsAftersaleStatus(ids: string[], status: PmsAftersaleStatus, actorName: string, remark: string): PmsBatchUpdateResult {
  const result: PmsBatchUpdateResult = { updatedCount: 0, rejectedCount: 0 }
  for (const id of ids) {
    try {
      updatePmsAftersaleStatus(id, status, actorName, remark)
      result.updatedCount += 1
    } catch {
      result.rejectedCount += 1
    }
  }
  return result
}

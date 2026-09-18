import {
  applyPmsMaterialRequirementPush,
  getPmsMaterialRequirement,
  listPmsMaterialRequirements,
  type PmsMaterialRequirement,
  type PmsMaterialRequirementLine,
} from './material-requirements.ts'
import { markPmsProductPurchaseOrderMaterialPushed } from './product-purchase-orders.ts'
import { appendPmsLog, listPmsLogs, nextPmsSequence, PmsDomainError, roundPmsQty, type PmsActorRole, type PmsOperationLog } from './runtime.ts'
import { PMS_MATERIAL_IMAGES, PMS_STYLE_IMAGES } from './images.ts'

export type PmsMaterialPurchaseOrderStatus = '待采购' | '已采购' | '部分到货' | '已到货' | '已入库' | '已关闭'

export interface PmsMaterialPurchaseOrder {
  purchaseOrderNo: string
  requirementNo: string
  sourceRequirementLineNo: string
  sourceProductPurchaseOrderNo: string
  materialCode: string
  materialName: string
  materialType: string
  materialImageUrl: string
  unit: string
  styleCode: string
  styleName: string
  styleImageUrl: string
  supplierName: string
  warehouse: string
  orderedQty: number
  receivedQty: number
  unitPrice: number
  currency: 'RMB'
  status: PmsMaterialPurchaseOrderStatus
  orderDate: string
  expectedArrivalDate: string
  buyerName: string
  supplierConfirmed: boolean
  supplierConfirmedAt: string
  remark: string
}

export interface PmsLogisticsImportRow {
  purchaseOrderNo: string
  company: string
  trackingNo: string
  shipDate: string
  estimatedArrival: string
  boxCount: number
  rolls: number
  qty: number
  fee: number
  remark: string
}

export interface PmsMaterialLogisticsRecord extends PmsLogisticsImportRow {
  recordNo: string
  materialCode: string
  materialName: string
  materialImageUrl: string
  unit: string
  styleCode: string
  styleName: string
  styleImageUrl: string
  supplierName: string
  domesticSigned: boolean
  domesticSignedAt: string
  headLogisticsQty: number
  headLogisticsRolls: number
  headBatchNo: string
  headSigned: boolean
  headSignedAt: string
}

interface PmsMaterialPurchaseRuntime {
  orders: PmsMaterialPurchaseOrder[]
  logisticsRecords: PmsMaterialLogisticsRecord[]
}

let runtime: PmsMaterialPurchaseRuntime | null = null
let orderSequence = 8

function buildOrder(
  purchaseOrderNo: string,
  source: {
    materialCode: string
    materialName: string
    materialType: string
    materialImageUrl: string
    unit: string
    styleCode: string
    styleName: string
    styleImageUrl: string
    supplierName: string
    warehouse: string
  },
  orderedQty: number,
  unitPrice: number,
  status: PmsMaterialPurchaseOrderStatus,
  dates: { orderDate: string; expectedArrivalDate: string },
  extra: { requirementNo?: string; sourceRequirementLineNo?: string; sourceProductPurchaseOrderNo?: string; receivedQty?: number; remark?: string; supplierConfirmed?: boolean; supplierConfirmedAt?: string } = {},
): PmsMaterialPurchaseOrder {
  return {
    purchaseOrderNo,
    requirementNo: extra.requirementNo ?? '',
    sourceRequirementLineNo: extra.sourceRequirementLineNo ?? '',
    sourceProductPurchaseOrderNo: extra.sourceProductPurchaseOrderNo ?? '',
    materialCode: source.materialCode,
    materialName: source.materialName,
    materialType: source.materialType,
    materialImageUrl: source.materialImageUrl,
    unit: source.unit,
    styleCode: source.styleCode,
    styleName: source.styleName,
    styleImageUrl: source.styleImageUrl,
    supplierName: source.supplierName,
    warehouse: source.warehouse,
    orderedQty,
    receivedQty: extra.receivedQty ?? 0,
    unitPrice,
    currency: 'RMB',
    status,
    orderDate: dates.orderDate,
    expectedArrivalDate: dates.expectedArrivalDate,
    buyerName: '王采购',
    supplierConfirmed: extra.supplierConfirmed ?? false,
    supplierConfirmedAt: extra.supplierConfirmedAt ?? '',
    remark: extra.remark ?? '',
  }
}

function buildLogisticsRecord(
  recordNo: string,
  order: PmsMaterialPurchaseOrder,
  input: PmsLogisticsImportRow,
  extra: { domesticSigned?: boolean; domesticSignedAt?: string; headLogisticsQty?: number; headLogisticsRolls?: number; headBatchNo?: string; headSigned?: boolean; headSignedAt?: string } = {},
): PmsMaterialLogisticsRecord {
  return {
    ...input,
    recordNo,
    purchaseOrderNo: order.purchaseOrderNo,
    materialCode: order.materialCode,
    materialName: order.materialName,
    materialImageUrl: order.materialImageUrl,
    unit: order.unit,
    styleCode: order.styleCode,
    styleName: order.styleName,
    styleImageUrl: order.styleImageUrl,
    supplierName: order.supplierName,
    domesticSigned: extra.domesticSigned ?? false,
    domesticSignedAt: extra.domesticSignedAt ?? '',
    headLogisticsQty: extra.headLogisticsQty ?? 0,
    headLogisticsRolls: extra.headLogisticsRolls ?? 0,
    headBatchNo: extra.headBatchNo ?? '',
    headSigned: extra.headSigned ?? false,
    headSignedAt: extra.headSignedAt ?? '',
  }
}

function buildInitialRuntime(): PmsMaterialPurchaseRuntime {
  const fleece = { materialCode: 'FAB-2026-0002', materialName: '220g 涤棉卫衣布', materialType: '面料', materialImageUrl: PMS_MATERIAL_IMAGES.fleece, unit: '米', styleCode: 'HD-2603', styleName: '连帽卫衣', styleImageUrl: PMS_STYLE_IMAGES.hoodie, supplierName: '绍兴锦达纺织有限公司', warehouse: '广州原料仓' }
  const cotton = { materialCode: 'FAB-2026-0001', materialName: '180g 纯棉针织布', materialType: '面料', materialImageUrl: PMS_MATERIAL_IMAGES.cottonJersey, unit: '米', styleCode: 'SH-2607', styleName: '商务衬衫', styleImageUrl: PMS_STYLE_IMAGES.shirt, supplierName: '广州华盛面料有限公司', warehouse: '广州原料仓' }
  const button = { materialCode: 'ACC-2026-0002', materialName: '黑色四眼纽扣', materialType: '辅料', materialImageUrl: PMS_MATERIAL_IMAGES.button, unit: '个', styleCode: 'SH-2607', styleName: '商务衬衫', styleImageUrl: PMS_STYLE_IMAGES.shirt, supplierName: '东莞宏远辅料有限公司', warehouse: '广州原料仓' }
  const dressFabric = { ...cotton, styleCode: 'SK-2604', styleName: '女款连衣裙', styleImageUrl: PMS_STYLE_IMAGES.dress }
  const thread = { materialCode: 'ACC-2026-0004', materialName: '涤纶缝纫线', materialType: '辅料', materialImageUrl: PMS_MATERIAL_IMAGES.stitchingYarn, unit: '卷', styleCode: 'HD-2603', styleName: '连帽卫衣', styleImageUrl: PMS_STYLE_IMAGES.hoodie, supplierName: '泉州瑞达服装辅料有限公司', warehouse: '广州原料仓' }
  const label = { materialCode: 'ACC-2026-0003', materialName: '白色织唛', materialType: '辅料', materialImageUrl: PMS_MATERIAL_IMAGES.label, unit: '个', styleCode: 'HD-2603', styleName: '连帽卫衣', styleImageUrl: PMS_STYLE_IMAGES.hoodie, supplierName: '东莞宏远辅料有限公司', warehouse: '广州原料仓' }
  const yarn = { materialCode: 'YAR-2026-0001', materialName: '32S 棉纱', materialType: '纱线', materialImageUrl: PMS_MATERIAL_IMAGES.yarnCone, unit: '公斤', styleCode: 'HD-2603', styleName: '连帽卫衣', styleImageUrl: PMS_STYLE_IMAGES.hoodie, supplierName: '宁波恒源纱线有限公司', warehouse: '广州原料仓' }
  const polyBag = { materialCode: 'PKG-2026-0002', materialName: '40×60cm 透明胶袋', materialType: '包材', materialImageUrl: PMS_MATERIAL_IMAGES.polyBag, unit: '个', styleCode: 'HD-2603', styleName: '连帽卫衣', styleImageUrl: PMS_STYLE_IMAGES.hoodie, supplierName: '深圳优品包材有限公司', warehouse: '广州原料仓' }

  const orders: PmsMaterialPurchaseOrder[] = [
    buildOrder('CGF-2026-0001', cotton, 552, 26.5, '已采购', { orderDate: '2026-06-09', expectedArrivalDate: '2026-06-25' }, { requirementNo: 'MREQ-0002', sourceRequirementLineNo: 'MREQ-0002-01', sourceProductPurchaseOrderNo: 'CG-2026-0020' }),
    buildOrder('CGF-2026-0002', button, 996, 0.18, '部分到货', { orderDate: '2026-06-09', expectedArrivalDate: '2026-06-22' }, { requirementNo: 'MREQ-0002', sourceRequirementLineNo: 'MREQ-0002-02', sourceProductPurchaseOrderNo: 'CG-2026-0020', receivedQty: 600 }),
    buildOrder('CGF-2026-0003', dressFabric, 1443.6, 26.5, '已入库', { orderDate: '2026-06-05', expectedArrivalDate: '2026-06-20' }, { requirementNo: 'MREQ-0003', sourceRequirementLineNo: 'MREQ-0003-01', sourceProductPurchaseOrderNo: 'CG-2026-0021', receivedQty: 1443.6 }),
    buildOrder('CGF-2026-0004', fleece, 800, 29.8, '已采购', { orderDate: '2026-06-10', expectedArrivalDate: '2026-06-28' }),
    buildOrder('CGF-2026-0005', thread, 60, 13, '部分到货', { orderDate: '2026-06-08', expectedArrivalDate: '2026-06-21' }, { receivedQty: 40 }),
    buildOrder('CGF-2026-0006', label, 5000, 0.23, '已入库', { orderDate: '2026-05-30', expectedArrivalDate: '2026-06-12' }, { receivedQty: 5000 }),
    buildOrder('CGF-2026-0007', yarn, 300, 21.2, '待采购', { orderDate: '2026-06-11', expectedArrivalDate: '2026-07-02' }),
    buildOrder('CGF-2026-0008', polyBag, 8000, 0.3, '已关闭', { orderDate: '2026-05-26', expectedArrivalDate: '2026-06-15' }, { remark: '供应商产能不足，改由其他批次采购' }),
  ]

  const byNo = (no: string): PmsMaterialPurchaseOrder => {
    const order = orders.find((item) => item.purchaseOrderNo === no)
    if (!order) throw new Error(`面辅料采购单不存在: ${no}`)
    return order
  }

  const logisticsRecords: PmsMaterialLogisticsRecord[] = [
    buildLogisticsRecord('LOG-2026-0001', byNo('CGF-2026-0001'), { purchaseOrderNo: 'CGF-2026-0001', company: '顺丰速运', trackingNo: 'SF1368000123456', shipDate: '2026-06-10', estimatedArrival: '2026-06-13', boxCount: 6, rolls: 6, qty: 552, fee: 380, remark: '' }, { domesticSigned: true, domesticSignedAt: '2026-06-13T10:20:00+07:00' }),
    buildLogisticsRecord('LOG-2026-0002', byNo('CGF-2026-0002'), { purchaseOrderNo: 'CGF-2026-0002', company: '跨越速运', trackingNo: 'KY9988771122', shipDate: '2026-06-09', estimatedArrival: '2026-06-12', boxCount: 3, rolls: 0, qty: 996, fee: 210, remark: '' }, { domesticSigned: true, domesticSignedAt: '2026-06-12T15:00:00+07:00' }),
    buildLogisticsRecord('LOG-2026-0003', byNo('CGF-2026-0004'), { purchaseOrderNo: 'CGF-2026-0004', company: '德邦物流', trackingNo: 'DB6600123987', shipDate: '2026-06-11', estimatedArrival: '2026-06-14', boxCount: 5, rolls: 5, qty: 500, fee: 460, remark: '首批已发头程' }, { domesticSigned: true, domesticSignedAt: '2026-06-14T09:40:00+07:00' }),
    buildLogisticsRecord('LOG-2026-0004', byNo('CGF-2026-0005'), { purchaseOrderNo: 'CGF-2026-0005', company: '中通快递', trackingNo: 'ZT7856001234', shipDate: '2026-06-09', estimatedArrival: '2026-06-12', boxCount: 2, rolls: 0, qty: 60, fee: 96, remark: '分两批发货，本单先到 40 卷' }, { domesticSigned: true, domesticSignedAt: '2026-06-12T11:10:00+07:00' }),
    buildLogisticsRecord('LOG-2026-0005', byNo('CGF-2026-0006'), { purchaseOrderNo: 'CGF-2026-0006', company: '京东物流', trackingNo: 'JD5566778899', shipDate: '2026-06-01', estimatedArrival: '2026-06-04', boxCount: 5, rolls: 0, qty: 5000, fee: 260, remark: '' }, { domesticSigned: true, domesticSignedAt: '2026-06-04T14:30:00+07:00' }),
    buildLogisticsRecord('LOG-2026-0006', byNo('CGF-2026-0004'), { purchaseOrderNo: 'CGF-2026-0004', company: '安能物流', trackingNo: 'AN5566001122', shipDate: '2026-06-15', estimatedArrival: '2026-06-18', boxCount: 3, rolls: 3, qty: 300, fee: 180, remark: '第二批尾货，等待国内签收' }),
  ]

  runtime = { orders, logisticsRecords }
  applyPmsMaterialRequirementPush('MREQ-0002', [
    { lineNo: 'MREQ-0002-01', actualQty: 552, purchaseOrderNo: 'CGF-2026-0001' },
    { lineNo: 'MREQ-0002-02', actualQty: 996, purchaseOrderNo: 'CGF-2026-0002' },
  ])
  applyPmsMaterialRequirementPush('MREQ-0003', [{ lineNo: 'MREQ-0003-01', actualQty: 1443.6, purchaseOrderNo: 'CGF-2026-0003' }])
  markPmsProductPurchaseOrderMaterialPushed('CG-2026-0020')
  markPmsProductPurchaseOrderMaterialPushed('CG-2026-0021')
  return runtime
}

function getRuntime(): PmsMaterialPurchaseRuntime {
  if (!runtime) {
    listPmsMaterialRequirements()
    runtime = buildInitialRuntime()
  }
  return runtime
}

export function listPmsMaterialPurchaseOrders(): PmsMaterialPurchaseOrder[] {
  return getRuntime().orders
}

export function getPmsMaterialPurchaseOrder(purchaseOrderNo: string): PmsMaterialPurchaseOrder | undefined {
  return getRuntime().orders.find((order) => order.purchaseOrderNo === purchaseOrderNo)
}

export function listPmsMaterialLogisticsRecords(): PmsMaterialLogisticsRecord[] {
  return getRuntime().logisticsRecords
}

export function getPmsMaterialLogisticsRecord(recordNo: string): PmsMaterialLogisticsRecord | undefined {
  return getRuntime().logisticsRecords.find((record) => record.recordNo === recordNo)
}

export function listPmsMaterialPurchaseLogs(purchaseOrderNo: string): PmsOperationLog[] {
  return listPmsLogs('material-purchase-order', purchaseOrderNo)
}

export interface PmsRequirementPushLineInput {
  lineNo: string
  actualQty: number
  unitPrice: number
}

export function checkPmsMaterialRequirementPush(requirementNo: string): { ok: boolean; reason: string; pushableLines: PmsMaterialRequirementLine[] } {
  const requirement = getPmsMaterialRequirement(requirementNo)
  if (!requirement) return { ok: false, reason: '面辅料需求单不存在', pushableLines: [] }
  if (requirement.status === '已下推') return { ok: false, reason: '该需求已经全部下推生成采购单', pushableLines: [] }
  const pushableLines = requirement.lines.filter((line) => line.pushStatus === '待下推')
  if (pushableLines.length === 0) return { ok: false, reason: '没有待下推的物料行', pushableLines: [] }
  if (pushableLines.every((line) => line.suggestedQty <= 0)) {
    return { ok: false, reason: '全部待下推行的建议采购量为 0，无需下推', pushableLines }
  }
  return { ok: true, reason: '', pushableLines }
}

export function pushPmsMaterialRequirement(
  requirementNo: string,
  lineInputs: PmsRequirementPushLineInput[],
  actor: { id: string; name: string; role: PmsActorRole },
): PmsMaterialPurchaseOrder[] {
  const check = checkPmsMaterialRequirementPush(requirementNo)
  if (!check.ok) throw new PmsDomainError('MREQ_PUSH_BLOCKED', check.reason)
  const requirement = getPmsMaterialRequirement(requirementNo)
  if (!requirement) throw new PmsDomainError('MREQ_NOT_FOUND', `面辅料需求 ${requirementNo} 不存在`)

  const inputs = lineInputs.filter((input) => input.actualQty > 0)
  if (inputs.length === 0) throw new PmsDomainError('MREQ_QTY_REQUIRED', '请至少填写一行实际采购数量')

  const created: PmsMaterialPurchaseOrder[] = []
  inputs.forEach((input) => {
    const line = requirement.lines.find((item) => item.lineNo === input.lineNo)
    if (!line) throw new PmsDomainError('MREQ_LINE_NOT_FOUND', `面辅料需求行 ${input.lineNo} 不存在`)
    if (line.pushStatus === '已下推') throw new PmsDomainError('MREQ_LINE_PUSHED', `${line.materialName} 已经下推，不能重复生成采购单`)
    if (!line.suggestedQty || line.suggestedQty <= 0) throw new PmsDomainError('MREQ_SUGGESTED_ZERO', `${line.materialName} 建议采购量为 0，不能下推`)
    if (!line.supplierName.trim()) throw new PmsDomainError('MREQ_SUPPLIER_REQUIRED', `${line.materialName} 缺少默认供应商，不能下推`)
    if (!Number.isFinite(input.actualQty) || input.actualQty <= 0) throw new PmsDomainError('MREQ_QTY_INVALID', `${line.materialName} 的实际采购数量必须大于 0`)
    if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) throw new PmsDomainError('MREQ_PRICE_INVALID', `${line.materialName} 的采购单价不能为负数`)
    orderSequence += 1
    const materialOrder = buildOrder(
      `CGF-2026-${String(orderSequence).padStart(4, '0')}`,
      {
        materialCode: line.materialCode,
        materialName: line.materialName,
        materialType: line.materialType,
        materialImageUrl: line.imageUrl,
        unit: line.unit,
        styleCode: line.styleCode,
        styleName: line.styleName,
        styleImageUrl: line.styleImageUrl,
        supplierName: line.supplierName,
        warehouse: line.warehouse,
      },
      roundPmsQty(input.actualQty, 2),
      input.unitPrice,
      '待采购',
      { orderDate: new Date().toISOString().slice(0, 10), expectedArrivalDate: '' },
      {
        requirementNo,
        sourceRequirementLineNo: line.lineNo,
        sourceProductPurchaseOrderNo: requirement.sourcePurchaseOrderNo,
        remark: `由面辅料需求 ${requirementNo} 下推`,
      },
    )
    getRuntime().orders.unshift(materialOrder)
    created.push(materialOrder)
  })

  applyPmsMaterialRequirementPush(
    requirementNo,
    created.map((order) => ({ lineNo: order.sourceRequirementLineNo, actualQty: order.orderedQty, purchaseOrderNo: order.purchaseOrderNo })),
  )
  const updated = getPmsMaterialRequirement(requirementNo)
  if (updated?.status === '已下推') markPmsProductPurchaseOrderMaterialPushed(updated.sourcePurchaseOrderNo)

  appendPmsLog({
    objectType: 'material-requirement',
    objectId: requirementNo,
    action: '下推采购单',
    beforeValue: `${inputs.length} 行待下推`,
    afterValue: `生成 ${created.map((order) => order.purchaseOrderNo).join('、')}`,
    reason: '按物料行生成面辅料采购单',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
  })
  created.forEach((order) => {
    appendPmsLog({
      objectType: 'material-purchase-order',
      objectId: order.purchaseOrderNo,
      action: '创建',
      beforeValue: '',
      afterValue: `${order.materialName} · ${order.orderedQty} ${order.unit} · 待采购`,
      reason: `由面辅料需求 ${requirementNo} 下推`,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
    })
  })
  return created
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function validatePmsLogisticsImportRow(row: PmsLogisticsImportRow, existingTrackingNos: Set<string>, seenTrackingNos: Set<string>): string {
  if (!row.purchaseOrderNo.trim()) return '缺少采购单号'
  if (!getPmsMaterialPurchaseOrder(row.purchaseOrderNo.trim())) return `采购单 ${row.purchaseOrderNo} 不存在`
  if (!row.company.trim()) return '缺少物流公司'
  if (!row.trackingNo.trim()) return '缺少物流单号'
  if (existingTrackingNos.has(row.trackingNo.trim()) || seenTrackingNos.has(row.trackingNo.trim())) return `物流单号 ${row.trackingNo} 已存在`
  if (row.shipDate && !DATE_PATTERN.test(row.shipDate)) return '发货日期格式应为 YYYY-MM-DD'
  if (row.estimatedArrival && !DATE_PATTERN.test(row.estimatedArrival)) return '预计到达日期格式应为 YYYY-MM-DD'
  if (!Number.isInteger(row.boxCount) || row.boxCount < 0) return '箱数必须是非负整数'
  if (!Number.isInteger(row.rolls) || row.rolls < 0) return '卷数必须是非负整数'
  if (!Number.isFinite(row.qty) || row.qty <= 0) return '物流数量必须大于 0'
  if (!Number.isFinite(row.fee) || row.fee < 0) return '运费不能为负数'
  return ''
}

export function importPmsMaterialLogistics(
  rows: PmsLogisticsImportRow[],
  actor: { id: string; name: string; role: PmsActorRole },
): PmsMaterialLogisticsRecord[] {
  const logistics = getRuntime().logisticsRecords
  const existing = new Set(logistics.map((record) => record.trackingNo))
  const seen = new Set<string>()
  const imported: PmsMaterialLogisticsRecord[] = []

  rows.forEach((row) => {
    const error = validatePmsLogisticsImportRow(row, existing, seen)
    if (error) throw new PmsDomainError('LOGISTICS_IMPORT_INVALID', error)
    seen.add(row.trackingNo.trim())
  })

  rows.forEach((row) => {
    const order = getPmsMaterialPurchaseOrder(row.purchaseOrderNo.trim())
    if (!order) throw new PmsDomainError('MPO_NOT_FOUND', `采购单 ${row.purchaseOrderNo} 不存在`)
    const record = buildLogisticsRecord(nextPmsSequence('LOG', 4), order, { ...row, purchaseOrderNo: order.purchaseOrderNo, company: row.company.trim(), trackingNo: row.trackingNo.trim() })
    logistics.unshift(record)
    imported.push(record)
    appendPmsLog({
      objectType: 'material-purchase-order',
      objectId: order.purchaseOrderNo,
      action: '导入物流',
      beforeValue: '',
      afterValue: `${record.company} ${record.trackingNo} · ${record.qty} ${record.unit}`,
      reason: record.remark,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
    })
  })
  return imported
}

export function signPmsMaterialLogistics(
  recordNos: string[],
  stage: 'domestic' | 'head',
  actor: { id: string; name: string; role: PmsActorRole },
): PmsMaterialLogisticsRecord[] {
  if (recordNos.length === 0) throw new PmsDomainError('LOGISTICS_SIGN_EMPTY', '请至少选择一条物流记录')
  const signed: PmsMaterialLogisticsRecord[] = []
  recordNos.forEach((recordNo) => {
    const record = getPmsMaterialLogisticsRecord(recordNo)
    if (!record) throw new PmsDomainError('LOGISTICS_NOT_FOUND', `物流记录 ${recordNo} 不存在`)
    const before = stage === 'domestic' ? record.domesticSigned : record.headSigned
    if (before) return
    if (stage === 'domestic') {
      record.domesticSigned = true
      record.domesticSignedAt = new Date().toISOString()
    } else {
      if (!record.headBatchNo) throw new PmsDomainError('LOGISTICS_HEAD_NOT_JOINED', `${record.trackingNo} 还没有加入头程，不能签收头程`)
      record.headSigned = true
      record.headSignedAt = new Date().toISOString()
    }
    signed.push(record)
    appendPmsLog({
      objectType: 'material-logistics',
      objectId: recordNo,
      action: stage === 'domestic' ? '国内物流签收' : '头程签收',
      beforeValue: '未签收',
      afterValue: '已签收',
      reason: '',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
    })
  })
  return signed
}

export function applyPmsLogisticsHeadAllocation(recordNo: string, qty: number, rolls: number, batchNo: string): void {
  const record = getPmsMaterialLogisticsRecord(recordNo)
  if (!record) throw new PmsDomainError('LOGISTICS_NOT_FOUND', `物流记录 ${recordNo} 不存在`)
  record.headLogisticsQty = roundPmsQty(record.headLogisticsQty + qty, 2)
  record.headLogisticsRolls += rolls
  if (!record.headBatchNo) record.headBatchNo = batchNo
}

export function signPmsMaterialLogisticsByBatch(batchNo: string, actor: { id: string; name: string; role: PmsActorRole }): number {
  const records = getRuntime().logisticsRecords.filter((record) => record.headBatchNo === batchNo && !record.headSigned)
  records.forEach((record) => {
    record.headSigned = true
    record.headSignedAt = new Date().toISOString()
  })
  if (records.length > 0) {
    appendPmsLog({
      objectType: 'first-leg-batch',
      objectId: batchNo,
      action: '到仓签收',
      beforeValue: `${records.length} 条头程未签收`,
      afterValue: `${records.length} 条已签收`,
      reason: '',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
    })
  }
  return records.length
}

export function applyPmsSupplierConfirmation(purchaseOrderNo: string, actor: { id: string; name: string; role: PmsActorRole }): void {
  const order = getPmsMaterialPurchaseOrder(purchaseOrderNo)
  if (!order) throw new PmsDomainError('MPO_NOT_FOUND', `面辅料采购单 ${purchaseOrderNo} 不存在`)
  order.supplierConfirmed = true
  order.supplierConfirmedAt = new Date().toISOString()
  appendPmsLog({
    objectType: 'material-purchase-order',
    objectId: purchaseOrderNo,
    action: '供应商确认',
    beforeValue: order.supplierConfirmed ? '已确认' : '未确认',
    afterValue: '已确认',
    reason: '供应商确认单同步采购单',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
  })
}

export function registerPmsMaterialPurchaseArrival(
  purchaseOrderNo: string,
  receivedQty: number,
  actor: { id: string; name: string; role: PmsActorRole },
): PmsMaterialPurchaseOrder {
  const order = getPmsMaterialPurchaseOrder(purchaseOrderNo)
  if (!order) throw new PmsDomainError('MPO_NOT_FOUND', `面辅料采购单 ${purchaseOrderNo} 不存在`)
  if (order.status === '已关闭') throw new PmsDomainError('MPO_CLOSED_BLOCKED', '已关闭的采购单不能登记到货')
  if (order.status === '待采购') throw new PmsDomainError('MPO_NOT_PURCHASED', '请先标记已采购后再登记到货')
  if (!Number.isFinite(receivedQty) || receivedQty <= 0) throw new PmsDomainError('MPO_RECEIVED_QTY_INVALID', '到货数量必须大于 0')
  if (receivedQty > order.orderedQty) throw new PmsDomainError('MPO_RECEIVED_OVER', `到货数量不能超过采购数量 ${order.orderedQty} ${order.unit}`)
  const before = `${order.receivedQty} ${order.unit} · ${order.status}`
  order.receivedQty = roundPmsQty(receivedQty, 2)
  order.status = order.receivedQty >= order.orderedQty ? '已到货' : '部分到货'
  appendPmsLog({
    objectType: 'material-purchase-order',
    objectId: purchaseOrderNo,
    action: '登记到货',
    beforeValue: before,
    afterValue: `${order.receivedQty} ${order.unit} · ${order.status}`,
    reason: '',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
  })
  return order
}

const MPO_STATUS_TRANSITIONS: Record<PmsMaterialPurchaseOrderStatus, PmsMaterialPurchaseOrderStatus[]> = {
  待采购: ['已采购', '已关闭'],
  已采购: ['部分到货', '已到货', '已关闭'],
  部分到货: ['已到货', '已入库', '已关闭'],
  已到货: ['已入库'],
  已入库: [],
  已关闭: [],
}

export function pmsAllowedMaterialOrderNextStatuses(status: PmsMaterialPurchaseOrderStatus): PmsMaterialPurchaseOrderStatus[] {
  return MPO_STATUS_TRANSITIONS[status]
}

export function advancePmsMaterialPurchaseOrderStatus(
  purchaseOrderNo: string,
  nextStatus: PmsMaterialPurchaseOrderStatus,
  actor: { id: string; name: string; role: PmsActorRole },
): PmsMaterialPurchaseOrder {
  const order = getPmsMaterialPurchaseOrder(purchaseOrderNo)
  if (!order) throw new PmsDomainError('MPO_NOT_FOUND', `面辅料采购单 ${purchaseOrderNo} 不存在`)
  if (!MPO_STATUS_TRANSITIONS[order.status].includes(nextStatus)) {
    throw new PmsDomainError('MPO_TRANSITION_BLOCKED', `${order.status} 不能直接流转到 ${nextStatus}`)
  }
  if (nextStatus === '已入库' && order.receivedQty <= 0) {
    throw new PmsDomainError('MPO_RECEIVE_REQUIRED', '请先登记到货数量再入库')
  }
  const before = order.status
  order.status = nextStatus
  if (nextStatus === '已到货' && order.receivedQty <= 0) order.receivedQty = order.orderedQty
  appendPmsLog({
    objectType: 'material-purchase-order',
    objectId: purchaseOrderNo,
    action: `状态流转 · ${nextStatus}`,
    beforeValue: before,
    afterValue: nextStatus,
    reason: '',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
  })
  return order
}

export function batchAdvancePmsMaterialPurchaseOrders(
  purchaseOrderNos: string[],
  nextStatus: PmsMaterialPurchaseOrderStatus,
  actor: { id: string; name: string; role: PmsActorRole },
): PmsMaterialPurchaseOrder[] {
  if (purchaseOrderNos.length === 0) throw new PmsDomainError('MPO_BATCH_EMPTY', '请至少选择一张采购单')
  return purchaseOrderNos.map((purchaseOrderNo) => advancePmsMaterialPurchaseOrderStatus(purchaseOrderNo, nextStatus, actor))
}

export function closePmsMaterialPurchaseOrder(
  purchaseOrderNo: string,
  reason: string,
  actor: { id: string; name: string; role: PmsActorRole },
): PmsMaterialPurchaseOrder {
  const order = getPmsMaterialPurchaseOrder(purchaseOrderNo)
  if (!order) throw new PmsDomainError('MPO_NOT_FOUND', `面辅料采购单 ${purchaseOrderNo} 不存在`)
  if (!reason.trim()) throw new PmsDomainError('MPO_REASON_REQUIRED', '关闭采购单必须填写原因')
  if (order.status === '已关闭') throw new PmsDomainError('MPO_CLOSED_BLOCKED', '该采购单已经关闭')
  if (order.status === '已入库') throw new PmsDomainError('MPO_INBOUND_BLOCKED', '已入库的采购单不可关闭')
  const before = order.status
  order.status = '已关闭'
  order.remark = reason.trim()
  appendPmsLog({
    objectType: 'material-purchase-order',
    objectId: purchaseOrderNo,
    action: '关闭',
    beforeValue: before,
    afterValue: '已关闭',
    reason: reason.trim(),
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    secondConfirmation: true,
  })
  return order
}

export function resetPmsMaterialPurchaseRuntimeForTest(): void {
  runtime = null
  orderSequence = 0
}

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
import { PMS_STORES, getPmsDb, pmsAll, pmsDelete, pmsGet, pmsPut, pmsTx, broadcastPmsDataChanged } from './idb-storage.ts'
import { getMaterialArchiveById, getMaterialSkuRecordById, listMaterialUnitRelations, listMaterialPackageSpecs, isMaterialSkuAvailableForNewUse } from '../pcs-material-archive-repository.ts'
import { listPmsSuppliers } from './suppliers.ts'
import {
  getTmfPurchaseState, listTmfSupplyPurchaseProjections, listTmfMaterialPurchases, getTmfMaterialPurchase, releaseTmfMaterialPurchase,
  confirmTmfPurchaseSupplier, reviseTmfMaterialPurchase, cancelTmfMaterialPurchaseAfterDisposition, type TmfPurchaseActor,
} from './tmf-material-purchases.ts'
import { assertTmfTipMaterialMaster } from './tmf-master-registry.ts'

export type PmsMaterialPurchaseOrderStatus = '草稿' | '待采购' | '已采购' | '部分到货' | '已到货' | '已入库' | '已关闭'

export interface PmsPcsMaterialPurchaseSource {
  source: 'PCS_MATERIAL_SKU'
  materialId: string
  materialSkuId: string
  materialSkuCode: string
  /** Frozen source description captured when this draft first adopts the SKU. */
  specName?: string
  returnPath: string
  mainUnit: string
  mainUnitVersion: number
  purchaseUnit: string
  mainQtyPerPurchaseUnit: number
  relationId: string | null
  relationVersion: number | null
  packageSnapshot?: { packageSpecId: string; version: number; contentQty: number; contentUnitId: string; measurementBasis: string }
  basis: string
  capturedAt: string
}

export interface PmsPcsMaterialPurchaseDraftInput {
  materialSkuId: string
  unitRelationId: string | null
  quantity: number
  supplierCode: string
  purchaseRegion: string
  unitPrice: number
  currency: 'RMB' | 'IDR' | 'USD'
  warehouse: string
  expectedArrivalDate: string
  buyerName: string
  remark: string
  purchaseOrderNo?: string
  expectedVersion?: number
}

export interface PmsMaterialPurchaseOrder {
  pcsSource?: PmsPcsMaterialPurchaseSource
  draftVersion?: number
  supplierCode?: string
  purchaseRegion?: string
  taxIncluded?: true
  mainUnitQuantity?: number
  tmfTipSource?: { demandId: string; materialBomItemId: string; productionOrderNo: string; snapshotId: string; versionId: string; operationId: string; signature: string; masterRef?: { masterId: string; code: string; name: string; source: string } }

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
  currency: 'RMB' | 'IDR' | 'USD'
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

// R1 §7: PCS supplies identity and a unit reference; the purchase and actual price belong to PMS.
const pcsPurchaseDrafts = new Map<string, PmsMaterialPurchaseOrder>()
const pcsPurchaseLogs = new Map<string, PmsOperationLog>()
let pcsPurchaseReadPromise: Promise<void> | null = null
let hydratedPurchaseOrders: PmsMaterialPurchaseOrder[] | null = null

export function getPmsPcsPurchaseUnitOptions(materialSkuId: string): PmsPcsMaterialPurchaseSource[] {
  const sku = getMaterialSkuRecordById(materialSkuId)
  const root = sku && getMaterialArchiveById(sku.materialId)
  if (!sku || !root) throw new PmsDomainError('MPO_SOURCE_MISSING', '来源物料不存在，请返回物料档案重新选择。')
  const mainUnit = sku.mainUnit || sku.pricingUnit
  const base: PmsPcsMaterialPurchaseSource = {
    source: 'PCS_MATERIAL_SKU', materialId: sku.materialId, materialSkuId,
    materialSkuCode: sku.materialSkuCode, specName: sku.specName,
    returnPath: `/pcs/materials/${root.kind}/${sku.materialId}/skus/${materialSkuId}`,
    mainUnit, mainUnitVersion: sku.mainUnitVersion || 1, purchaseUnit: mainUnit,
    mainQtyPerPurchaseUnit: 1, relationId: null, relationVersion: null,
    basis: '物料 SKU 主计量单位', capturedAt: '',
  }
  return [base, ...listMaterialUnitRelations(materialSkuId)
    .filter(relation => relation.status === 'ACTIVE' && relation.uses.includes('PURCHASE'))
    .map(relation => {
      const packaging = relation.packageSpecId ? listMaterialPackageSpecs(materialSkuId, true).find(item => item.packageSpecId === relation.packageSpecId) : undefined
      return { ...base, purchaseUnit: relation.auxUnitId,
        mainQtyPerPurchaseUnit: relation.mainQtyPerAux, relationId: relation.relationId,
        relationVersion: relation.version, basis: relation.basisReference || relation.basisType,
        ...(packaging ? { packageSnapshot: { packageSpecId: packaging.packageSpecId, version: packaging.version, contentQty: packaging.contentQty, contentUnitId: packaging.contentUnitId, measurementBasis: packaging.measurementBasis } } : {}) }
    })]
}

/** Read-only hydration: no seed copies, no legacy source deletion, no fallback writes. */
export function hydratePmsMaterialPurchaseOrdersFromIdb(force = false): Promise<void> {
  if (pcsPurchaseReadPromise && !force) return pcsPurchaseReadPromise
  const reading = Promise.all([
    pmsAll<PmsMaterialPurchaseOrder>(PMS_STORES.pmsMaterialPurchaseOrderDeltas),
    pmsAll<PmsOperationLog>(PMS_STORES.pmsOperationLogs),
  ]).then(([orders, logs]) => {
    hydratedPurchaseOrders = orders
    for (const order of orders) {
      if (order.pcsSource) {
        const previous = pcsPurchaseDrafts.get(order.purchaseOrderNo)
        if (!previous || (order.draftVersion || 0) >= (previous.draftVersion || 0)) pcsPurchaseDrafts.set(order.purchaseOrderNo, order)
      } else if (runtime) mergeSavedUpdates(runtime, [order])
    }
    logs.filter(log => log.id.startsWith('PMS-PCS-PURCHASE:')).forEach(log => pcsPurchaseLogs.set(log.id, log))
  }).catch(error => { pcsPurchaseReadPromise = null; throw error })
  pcsPurchaseReadPromise = reading
  return reading
}

/** One strict PMS transaction for the draft, its log and the idempotency receipt. */
export async function savePmsPcsMaterialPurchaseDraft(
  input: PmsPcsMaterialPurchaseDraftInput,
  actor: { id: string; name: string; role: PmsActorRole },
  operationId: string,
): Promise<PmsMaterialPurchaseOrder> {
  if (!['采购员', '采购主管'].includes(actor.role) || !actor.id.trim() || !actor.name.trim()) throw new PmsDomainError('MPO_ROLE_BLOCKED', '当前角色不能维护采购草稿。')
  if (!operationId.trim()) throw new PmsDomainError('MPO_OPERATION_REQUIRED', '缺少本次保存标识，请重新打开采购表单。')
  const normalized = { ...input, materialSkuId: input.materialSkuId.trim(), unitRelationId: input.unitRelationId || null,
    supplierCode: input.supplierCode.trim(), purchaseRegion: input.purchaseRegion.trim(), warehouse: input.warehouse.trim(),
    expectedArrivalDate: input.expectedArrivalDate.trim(), buyerName: input.buyerName.trim(), remark: input.remark.trim() }
  if (!Number.isFinite(normalized.quantity) || normalized.quantity <= 0) throw new PmsDomainError('MPO_QUANTITY_INVALID', '采购数量必须大于 0。')
  if (!Number.isFinite(normalized.unitPrice) || normalized.unitPrice < 0) throw new PmsDomainError('MPO_PRICE_INVALID', '请填写非负的实际含税采购单价。')
  if (!['RMB', 'IDR', 'USD'].includes(normalized.currency)) throw new PmsDomainError('MPO_CURRENCY_INVALID', '请选择采购币种。')
  if (![normalized.purchaseRegion, normalized.warehouse, normalized.buyerName].every(Boolean)) throw new PmsDomainError('MPO_FIELDS_REQUIRED', '请填写采购区域、收货仓和采购负责人。')
  const arrival = new Date(`${normalized.expectedArrivalDate}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized.expectedArrivalDate) || Number.isNaN(arrival.getTime()) || arrival.toISOString().slice(0, 10) !== normalized.expectedArrivalDate) throw new PmsDomainError('MPO_DATE_INVALID', '请填写有效的预计到货日期。')
  const sku = getMaterialSkuRecordById(normalized.materialSkuId)
  const previous = normalized.purchaseOrderNo ? pcsPurchaseDrafts.get(normalized.purchaseOrderNo) : undefined
  if (normalized.purchaseOrderNo && (!previous?.pcsSource || previous.status !== '草稿')) throw new PmsDomainError('MPO_DRAFT_NOT_FOUND', '采购草稿不存在或已不允许修改，请重新读取。')
  if (!sku || (previous?.pcsSource?.materialSkuId !== sku.materialSkuId && !isMaterialSkuAvailableForNewUse(sku))) throw new PmsDomainError('MPO_SOURCE_INACTIVE', '物料 SKU 及其主档须已审核并启用，才能新增选用。')
  const supplier = listPmsSuppliers().find(item => item.supplierCode === normalized.supplierCode && item.status === '已启用')
  if (!supplier) throw new PmsDomainError('MPO_SUPPLIER_REQUIRED', '请选择已启用的供应商。')
  const selected = previous?.pcsSource?.materialSkuId === sku.materialSkuId && previous.pcsSource.relationId === normalized.unitRelationId
    ? previous.pcsSource
    : getPmsPcsPurchaseUnitOptions(sku.materialSkuId).find(option => option.relationId === normalized.unitRelationId)
  if (!selected || !Number.isFinite(selected.mainQtyPerPurchaseUnit) || selected.mainQtyPerPurchaseUnit <= 0) throw new PmsDomainError('MPO_UNIT_INVALID', '所选采购单位关系不可用，请重新选择物料的采购单位。')
  if (!Number.isFinite(normalized.quantity * selected.mainQtyPerPurchaseUnit) || !Number.isFinite(normalized.quantity * normalized.unitPrice)) throw new PmsDomainError('MPO_QUANTITY_INVALID', '采购数量或金额超出可计算范围。')
  const now = new Date().toISOString(), year = now.slice(0, 4)
  const source = { ...selected, capturedAt: selected.capturedAt || now }
  const materialType = getMaterialArchiveById(sku.materialId)?.categoryName || ''
  const signature = JSON.stringify({ input: normalized, actor: actor.id })
  const receiptKey = `MPO:PCS:OP:${operationId}`, sequenceKey = `MPO:PCS:SEQUENCE:${year}`
  const db = await getPmsDb()
  let committedLog: PmsOperationLog | undefined
  const committed = await new Promise<PmsMaterialPurchaseOrder>((resolve, reject) => {
    const tx = db.transaction([PMS_STORES.pmsMaterialPurchaseOrderDeltas, PMS_STORES.pmsOperationLogs, PMS_STORES.pmsVersionSnapshots], 'readwrite')
    const orders = tx.objectStore(PMS_STORES.pmsMaterialPurchaseOrderDeltas), receipts = tx.objectStore(PMS_STORES.pmsVersionSnapshots)
    let result: PmsMaterialPurchaseOrder | undefined, failure: Error | undefined
    const stop = (message: string) => { failure = new PmsDomainError('MPO_DRAFT_CONFLICT', message); tx.abort() }
    tx.oncomplete = () => result ? resolve(result) : reject(new PmsDomainError('MPO_DRAFT_FAILED', '采购草稿未保存，请重试。'))
    tx.onabort = () => reject(failure || new PmsDomainError('MPO_DRAFT_FAILED', '采购草稿未保存，原有记录保持不变。请保留当前输入并重试。'))
    tx.onerror = () => { failure ||= new PmsDomainError('MPO_DRAFT_FAILED', `采购草稿未保存：${tx.error?.message || '存储不可用'}。请保留当前输入并重试。`) }
    const operation = receipts.get(receiptKey)
    operation.onsuccess = () => {
      const receipt = operation.result as { signature: string; purchaseOrderNo: string } | undefined
      if (receipt) {
        if (receipt.signature !== signature) { stop('同一次保存的内容已变化，请重新保存。'); return }
        const existing = orders.get(receipt.purchaseOrderNo)
        existing.onsuccess = () => { result = existing.result; if (!result) stop('已保存草稿无法读取，请重新读取采购单。') }
        return
      }
      const target = normalized.purchaseOrderNo ? orders.get(normalized.purchaseOrderNo) : receipts.get(sequenceKey)
      target.onsuccess = () => {
        const existing = normalized.purchaseOrderNo ? target.result as PmsMaterialPurchaseOrder | undefined : undefined
        if (normalized.purchaseOrderNo && (!existing?.pcsSource || existing.status !== '草稿' || existing.draftVersion !== normalized.expectedVersion)) { stop('采购草稿已被其他页面修改，请重新读取后再保存。'); return }
        const sequence = Number(target.result?.sequence || 0) + 1
        const purchaseOrderNo = normalized.purchaseOrderNo || `CGF-${year}-P${String(sequence).padStart(5, '0')}`
        result = {
          purchaseOrderNo, requirementNo: '', sourceRequirementLineNo: '', sourceProductPurchaseOrderNo: '',
          materialCode: sku.materialSkuCode, materialName: sku.materialName,
          materialType,
          // User image bytes and their ownership remain in PCS; the PMS view resolves the source SKU.
          materialImageUrl: /^(blob:|pcs-file:|data:)/.test(sku.skuImageUrl) ? '' : sku.skuImageUrl,
          unit: source.purchaseUnit, styleCode: '', styleName: '', styleImageUrl: '',
          supplierCode: supplier.supplierCode, supplierName: supplier.supplierName,
          warehouse: normalized.warehouse, purchaseRegion: normalized.purchaseRegion,
          orderedQty: normalized.quantity, mainUnitQuantity: roundPmsQty(normalized.quantity * source.mainQtyPerPurchaseUnit, 6),
          receivedQty: 0, unitPrice: normalized.unitPrice, currency: normalized.currency, taxIncluded: true,
          status: '草稿', orderDate: existing?.orderDate || now.slice(0, 10), expectedArrivalDate: normalized.expectedArrivalDate,
          buyerName: normalized.buyerName, supplierConfirmed: false, supplierConfirmedAt: '', remark: normalized.remark,
          pcsSource: source, draftVersion: (existing?.draftVersion || 0) + 1,
        }
        committedLog = { id: `PMS-PCS-PURCHASE:${operationId}`, objectType: 'material-purchase-order', objectId: purchaseOrderNo,
          action: existing ? '修改采购草稿' : '创建采购草稿', beforeValue: existing ? `草稿 V${existing.draftVersion}` : '',
          afterValue: `${result.orderedQty} ${result.unit} · ${result.unitPrice} ${result.currency} / ${result.unit}（含税）`,
          reason: '从物料档案发起采购', actorId: actor.id, actorName: actor.name, actorRole: actor.role,
          occurredAt: now, timeZone: 'Asia/Jakarta', source: 'PMS' }
        if (existing) orders.put(result)
        else orders.add(result)
        tx.objectStore(PMS_STORES.pmsOperationLogs).put(committedLog)
        receipts.put({ snapshotKey: receiptKey, signature, purchaseOrderNo })
        if (!normalized.purchaseOrderNo) receipts.put({ snapshotKey: sequenceKey, sequence })
      }
    }
  })
  pcsPurchaseDrafts.set(committed.purchaseOrderNo, committed)
  if (committedLog) pcsPurchaseLogs.set(committedLog.id, committedLog)
  try { broadcastPmsDataChanged(PMS_STORES.pmsMaterialPurchaseOrderDeltas, committed.purchaseOrderNo, actor.id) } catch { /* the transaction is already committed */ }
  return structuredClone(committed)
}

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

export const PMS_MATERIAL_PURCHASE_UPDATES_KEY = 'higood-pms-material-purchase-updates-v1'

/**
 * 旧版 localStorage 键的迁移:启动时一次性把数据搬到 IDB,然后删除 localStorage 键。
 * 迁移完成后,运行期不再使用 PMS_MATERIAL_PURCHASE_UPDATES_KEY。
 * 符合 AGENTS § 2.4.6 旧数据迁移固定顺序:读回校验 → 删除源数据。
 */
let migrationChecked = false
export async function migrateMaterialPurchaseUpdatesFromLocalStorage(): Promise<{ migrated: number; removed: boolean }> {
  if (migrationChecked || typeof window === 'undefined') return { migrated: 0, removed: false }
  migrationChecked = true
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(PMS_MATERIAL_PURCHASE_UPDATES_KEY)
  } catch {
    // localStorage 不可用,跳过迁移
    return { migrated: 0, removed: false }
  }
  if (!raw) return { migrated: 0, removed: false }
  let orders: unknown
  try {
    orders = JSON.parse(raw)
  } catch {
    // 旧数据损坏:留待用户手动清理,不静默覆盖
    throw new PmsDomainError('MPO_LEGACY_INVALID', '旧版面辅料采购变更数据格式不符,请恢复后重试;不会用演示初始状态覆盖。')
  }
  if (!Array.isArray(orders) || orders.some((o: unknown) => !o || typeof (o as { purchaseOrderNo?: unknown }).purchaseOrderNo !== 'string')) {
    throw new PmsDomainError('MPO_LEGACY_INVALID', '旧版面辅料采购变更数据格式不符,请恢复后重试;不会用演示初始状态覆盖。')
  }
  const valid = orders as PmsMaterialPurchaseOrder[]
  let migrated = 0
  try {
    await pmsTx(PMS_STORES.pmsMaterialPurchaseOrderDeltas, 'readwrite', (tx) => {
      const store = tx.objectStore(PMS_STORES.pmsMaterialPurchaseOrderDeltas)
      for (const order of valid) {
        store.put(order)
        migrated += 1
      }
    })
    window.localStorage.removeItem(PMS_MATERIAL_PURCHASE_UPDATES_KEY)
    return { migrated, removed: true }
  } catch (error) {
    // 迁移失败保留旧源,§ 2.4.6 "失败保留源数据"
    throw error instanceof PmsDomainError
      ? error
      : new PmsDomainError('MPO_MIGRATION_FAILED', `面辅料采购变更迁移失败:${error instanceof Error ? error.message : 'unknown'};旧源数据保留。`)
  }
}

/**
 * 读取已保存的采购变更。缓存优化 + corrupted storage 抛错。
 *
 * 缓存策略(§ 2.4.3.5 性能优化):
 * - cachedRaw 缓存上一次读取的 raw 字符串
 * - cachedParsed 缓存对应的解析结果
 * - 写入路径(savePurchaseUpdate)同时更新内存缓存,避免下次读盘
 * - 外部写入(其他标签页)替换 raw 时,自动重新解析
 * - corrupted storage 抛错后,下次调用仍然重新读,符合 base 行为
 */
let cachedRaw: string | null = null
let cachedParsed: PmsMaterialPurchaseOrder[] | null = null

function readSavedPurchaseUpdates(): PmsMaterialPurchaseOrder[] {
  // § 2.4.6 迁移期:同步从旧键读;hydrate 后 migrate 函数会删除旧键。
  // hydrate 完成后,运行时改读 IDB pmsMaterialPurchaseOrderDeltas。
  if (typeof window === 'undefined') return []
  let raw: string | null
  try { raw = window.localStorage.getItem(PMS_MATERIAL_PURCHASE_UPDATES_KEY) }
  catch { return [] } // Unavailable legacy storage does not become a save fallback or block IDB drafts.
  if (!raw) {
    cachedRaw = null
    cachedParsed = []
    return []
  }
  // 缓存命中:raw 与上次相同,直接返回
  if (raw === cachedRaw && cachedParsed !== null) {
    return cachedParsed
  }
  // 缓存未命中或首次读取
  try {
    const orders: unknown = JSON.parse(raw)
    if (!Array.isArray(orders) || orders.some((order) => {
      const o = order as Partial<PmsMaterialPurchaseOrder> | null
      return !o || typeof o.purchaseOrderNo !== 'string'
        || !['待采购','已采购','部分到货','已到货','已入库','已关闭'].includes(String(o.status))
        || !Number.isFinite(o.orderedQty) || !Number.isFinite(o.receivedQty)
    })) throw new Error('invalid purchases')
    cachedRaw = raw
    cachedParsed = orders as PmsMaterialPurchaseOrder[]
    return cachedParsed
  } catch {
    // 解析失败:不缓存,下次重新读,保留 base 的"立即抛错"语义。
    throw new PmsDomainError('MPO_STORAGE_READ_FAILED', '无法读取已保存的采购变更，请恢复存储后重试；不会用演示初始状态覆盖。')
  }
}

/**
 * 显式使缓存失效。
 * - 测试 resetPmsMaterialPurchaseRuntimeForTest 调用
 * - 跨标签页 storage 事件触发(可选)
 */
export function invalidateReadSavedPurchaseUpdatesCache(): void {
  cachedRaw = null
  cachedParsed = null
}

/**
 * 写入一条采购变更到 IDB。
 * - 同步签名(不破坏现有调用方);内部 fire-and-forget IDB 写入。
 * - 内存中的 order 立即更新,保证页面响应。
 * - IDB 写入失败时,通过 PmsDomainError 抛出并由全局未捕获处理器显示提示。
 * - 严格遵守 § 2.4.3.5 "禁止静默回退 localStorage 或只更新内存后显示已保存"。
 */
function savePurchaseUpdate(order: PmsMaterialPurchaseOrder, patch: Partial<PmsMaterialPurchaseOrder>): void {
  if (order.pcsSource) throw new PmsDomainError('MPO_DRAFT_ACTION_BLOCKED', '该采购单当前为草稿，请通过采购草稿表单维护。')
  const next = { ...order, ...patch }
  // § 2.4.6 迁移期兼容:同步写旧键保证测试/老浏览器场景下能抛"未保存";运行期 hydrate 后会删除。
  if (typeof window !== 'undefined') {
    const saved = readSavedPurchaseUpdates().filter((item) => item.purchaseOrderNo !== order.purchaseOrderNo)
    const newSaved = [...saved, next]
    try {
      const newRaw = JSON.stringify(newSaved)
      window.localStorage.setItem(PMS_MATERIAL_PURCHASE_UPDATES_KEY, newRaw)
      // 同步更新缓存,避免下次 readSavedUpdates 重复解析整组数据
      cachedRaw = newRaw
      cachedParsed = newSaved
    } catch { throw new PmsDomainError('MPO_STORAGE_SAVE_FAILED', '采购变更未保存，请恢复存储后重试；当前状态未改变。') }
  }
  // 写盘成功后再更新内存(避免抛错时残留 half-modified 状态)。
  Object.assign(order, next)
  // fire-and-forget IDB 镜像写入;失败 console.error 暴露,不静默回退
  pmsPut(PMS_STORES.pmsMaterialPurchaseOrderDeltas, next).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'unknown'
    console.error('[PMS_IDB_SAVE_FAILED]', { purchaseOrderNo: next.purchaseOrderNo, message })
  })
}

let pendingDeltasPromise: Promise<PmsMaterialPurchaseOrder[]> | null = null

/**
 * 加载已保存变更并合并到 runtime。idempotent;只触发一次实际加载。
 */
async function loadSavedPurchaseUpdates(): Promise<PmsMaterialPurchaseOrder[]> {
  if (!pendingDeltasPromise) {
    pendingDeltasPromise = pmsAll<PmsMaterialPurchaseOrder>(PMS_STORES.pmsMaterialPurchaseOrderDeltas)
      .catch(error => { pendingDeltasPromise = null; throw error })
  }
  return pendingDeltasPromise
}

function mergeSavedUpdates(runtimeRef: PmsMaterialPurchaseRuntime, saved: PmsMaterialPurchaseOrder[]): void {
  for (const savedOrder of saved) {
    const sequence = /^CGF-2026-(\d+)$/.exec(savedOrder.purchaseOrderNo)
    if (sequence) orderSequence = Math.max(orderSequence, Number(sequence[1]))
    const existing = runtimeRef.orders.find(order => order.purchaseOrderNo === savedOrder.purchaseOrderNo)
    if (existing) Object.assign(existing, savedOrder)
    else runtimeRef.orders.push(savedOrder)
  }
}

function getRuntime(): PmsMaterialPurchaseRuntime {
  if (!runtime) {
    listPmsMaterialRequirements()
    runtime = buildInitialRuntime()
    if (hydratedPurchaseOrders) mergeSavedUpdates(runtime, hydratedPurchaseOrders)
    // 启动时触发 IDB 异步加载;不阻塞首次访问,失败不抛。
    if (!hydratedPurchaseOrders) loadSavedPurchaseUpdates()
      .then((saved) => {
        hydratedPurchaseOrders = saved
        if (runtime) mergeSavedUpdates(runtime, saved)
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'unknown'
        console.error('[PMS_IDB_LOAD_FAILED]', { message })
      })
  }
  // § 2.4.6 迁移期 + base 行为兼容:每次调用都从 localStorage 旧键读 saved updates 并应用,
  // 让 corrupted storage 立即抛错(测试场景);hydrate 后迁移函数会删除该键。
  mergeSavedUpdates(runtime, readSavedPurchaseUpdates())
  return runtime
}

/** 从生产单已采用的端头BOM生成普通PMS采购；不创建辅材SKU、不自动增加库存。 */
export function createPmsTmfTipPurchase(
  input: { demandId: string; materialBomItemId: string; quantity: number; supplierName: string; warehouse: string; unitPrice: number; expectedArrivalDate: string; reason: string },
  actor: { id: string; name: string; role: PmsActorRole }, operationId: string,
): PmsMaterialPurchaseOrder {
  if (!['采购员','采购主管'].includes(actor.role) || !actor.id.trim() || !actor.name.trim()) throw new PmsDomainError('TMF_ROLE_BLOCKED','当前角色不能创建端头辅材采购。')
  if (!operationId.trim()) throw new PmsDomainError('TMF_OPERATION_REQUIRED','缺少本次操作编号。')
  const signature = JSON.stringify([input,actor.id,actor.role])
  const previous = getRuntime().orders.find(order => order.tmfTipSource?.operationId === operationId)
  if (previous) {
    if (previous.tmfTipSource!.signature !== signature) throw new PmsDomainError('TMF_OPERATION_CONFLICT','此操作已保存其他采购内容，请查看原单。')
    return getPmsMaterialPurchaseOrder(previous.purchaseOrderNo)!
  }
  const state = getTmfPurchaseState(), demand = state.demands.find(item => item.id === input.demandId)
  if (!demand || !demand.specification.tippingRequired) throw new PmsDomainError('TMF_SOURCE_REQUIRED','请选择已生成且要求打头的生产加工需求。')
  const control = state.productionControls.find(item => item.productionOrderId === demand.productionOrderId)
  if (control && control.status !== 'ACTIVE') throw new PmsDomainError('TMF_SOURCE_BLOCKED','生产单暂停或取消，不能新增端头辅材采购。')
  const material = demand.tipMaterialSources?.find(item => item.bomItemId === input.materialBomItemId)
  const ends = [demand.specification.endA,demand.specification.endB].filter(end => end.method !== 'NONE' && end.materialBomItemId === input.materialBomItemId)
  if (!material?.materialSkuId || !material.materialName?.trim() || !ends.length || ends.some(end => end.materialUnit !== material.unit)) throw new PmsDomainError('TMF_BOM_REQUIRED','采用版本缺少端头辅材SKU、名称或一致的计量单位，请先确认技术资料；不能按名称猜测物料。')
  if (!['个','kg','g'].includes(material.unit) || !Number.isFinite(input.quantity) || input.quantity <= 0
    || (material.unit === '个' ? !Number.isSafeInteger(input.quantity) : Math.abs(input.quantity*1000-Math.round(input.quantity*1000)) > 0.000001)) throw new PmsDomainError('TMF_QUANTITY_INVALID','采购数量须为有效正数；端头按整数个，重量最多三位小数。')
  if (![input.supplierName,input.warehouse,input.reason].every(value => value.trim()) || !Number.isFinite(input.unitPrice) || input.unitPrice < 0) throw new PmsDomainError('TMF_PURCHASE_REQUIRED','请填写供应方、目标仓、采购依据和有效单价。')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expectedArrivalDate) || !Number.isFinite(Date.parse(input.expectedArrivalDate)) || new Date(input.expectedArrivalDate).toISOString().slice(0,10) !== input.expectedArrivalDate) throw new PmsDomainError('TMF_DATE_INVALID','请填写有效的预计到货日期。')
  // 端头辅材主档映射：不能借用织带／绳子半成品 SKU，单位必须一致。
  let tipMasterRef: { masterId: string; code: string; name: string; source: string }
  try {
    const reference = assertTmfTipMaterialMaster(material.materialSkuId, material.unit)
    tipMasterRef = { masterId: reference.masterId, code: reference.code, name: reference.name, source: reference.source }
  } catch (error) {
    if (error instanceof PmsDomainError) throw error
    throw new PmsDomainError('TMF_MASTER_REQUIRED', error instanceof Error ? error.message : '端头辅材主档映射失败，请核对物料档案。')
  }
  const sequence = orderSequence+1, no = `CGF-2026-${String(sequence).padStart(4,'0')}`
  if (getPmsMaterialPurchaseOrder(no)) throw new PmsDomainError('TMF_NUMBER_CONFLICT','采购编号已存在，请刷新后重新生成。')
  const order = buildOrder(no,{materialCode:material.materialSkuId,materialName:material.materialName,materialType:'辅料',materialImageUrl:material.imageUrl,unit:material.unit,styleCode:'',styleName:'',styleImageUrl:'',supplierName:input.supplierName.trim(),warehouse:input.warehouse.trim()},input.quantity,input.unitPrice,'待采购',{orderDate:new Date().toISOString().slice(0,10),expectedArrivalDate:input.expectedArrivalDate},{requirementNo:demand.productionOrderNo,sourceRequirementLineNo:demand.id,remark:input.reason.trim()})
  order.buyerName=actor.name
  order.tmfTipSource={demandId:demand.id,materialBomItemId:material.bomItemId,productionOrderNo:demand.productionOrderNo,snapshotId:demand.techPackSnapshotId,versionId:demand.techPackVersionId,operationId,signature,masterRef:tipMasterRef}
  savePurchaseUpdate(order,{})
  if (!getRuntime().orders.some(item => item.purchaseOrderNo === no)) getRuntime().orders.unshift(order)
  orderSequence=sequence
  appendPmsLog({objectType:'material-purchase-order',objectId:no,action:'从端头辅材需求创建采购',beforeValue:'',afterValue:`${input.quantity} ${material.unit}`,reason:input.reason.trim(),actorId:actor.id,actorName:actor.name,actorRole:actor.role})
  return order
}

export function listPmsMaterialPurchaseOrders(): PmsMaterialPurchaseOrder[] {
  const supplies=listTmfSupplyPurchaseProjections(),tmf=listTmfMaterialPurchases(),ids=new Set([...supplies,...tmf].map(o=>o.purchaseOrderNo))
  return [...pcsPurchaseDrafts.values(), ...getRuntime().orders.filter(o=>!ids.has(o.purchaseOrderNo) && !pcsPurchaseDrafts.has(o.purchaseOrderNo)), ...tmf,...supplies]
}

/** 原型启动时注册真实存在于 PMS 运行时的采购来源；列表页面不得用它造数。 */
export function registerPmsMaterialPurchaseOrderPrototype(order: PmsMaterialPurchaseOrder): void {
  const existing = getRuntime().orders.find((item) => item.purchaseOrderNo === order.purchaseOrderNo)
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(order)) throw new Error(`PMS 面辅料采购 ${order.purchaseOrderNo} 已存在其他内容。`)
    return
  }
  if (![order.purchaseOrderNo, order.requirementNo, order.sourceRequirementLineNo, order.sourceProductPurchaseOrderNo, order.materialCode].every((value) => value.trim())) throw new Error('PMS 原型采购必须保留需求、需求行和来源生产采购单。')
  getRuntime().orders.unshift(structuredClone(order))
}

export function getPmsMaterialPurchaseOrder(purchaseOrderNo: string): PmsMaterialPurchaseOrder | undefined {
  return pcsPurchaseDrafts.get(purchaseOrderNo) ?? listTmfSupplyPurchaseProjections().find(o=>o.purchaseOrderNo===purchaseOrderNo) ?? getRuntime().orders.find((order) => order.purchaseOrderNo === purchaseOrderNo) ?? getTmfMaterialPurchase(purchaseOrderNo)
}

export function listPmsMaterialLogisticsRecords(): PmsMaterialLogisticsRecord[] {
  return getRuntime().logisticsRecords
}

export function getPmsMaterialLogisticsRecord(recordNo: string): PmsMaterialLogisticsRecord | undefined {
  return getRuntime().logisticsRecords.find((record) => record.recordNo === recordNo)
}

export function listPmsMaterialPurchaseLogs(purchaseOrderNo: string): PmsOperationLog[] {
  const logs = new Map(listPmsLogs('material-purchase-order', purchaseOrderNo).map(log => [log.id, log]))
  for (const log of pcsPurchaseLogs.values()) if (log.objectId === purchaseOrderNo) logs.set(log.id, log)
  return [...logs.values()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
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
  const purchase = getPmsMaterialPurchaseOrder(row.purchaseOrderNo.trim())
  if (!purchase) return `采购单 ${row.purchaseOrderNo} 不存在`
  if (purchase.pcsSource && purchase.status === '草稿') return '采购草稿尚未下达，不能导入物流。'
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
  if(listTmfSupplyPurchaseProjections().some(o=>o.purchaseOrderNo===purchaseOrderNo))throw new PmsDomainError('TMF_SUPPLY_RECEIPT_FACT_REQUIRED','该投入料采购已产生仓库实收；履约从实收记录回读，不能手改累计、关闭或覆盖来源，请先处理执行影响。')
  const tmf = getTmfMaterialPurchase(purchaseOrderNo)
  if (tmf) {
    if (actor.role !== '采购员' && actor.role !== '采购主管') throw new PmsDomainError('TMF_ROLE_BLOCKED', '当前角色不能确认织带采购。')
    confirmTmfPurchaseSupplier(purchaseOrderNo, actor as TmfPurchaseActor, `PMS-CONFIRM:${purchaseOrderNo}:${tmf.version}`)
    return
  }
  const order = getPmsMaterialPurchaseOrder(purchaseOrderNo)
  if (!order) throw new PmsDomainError('MPO_NOT_FOUND', `面辅料采购单 ${purchaseOrderNo} 不存在`)
  const beforeConfirmed = order.supplierConfirmed
  savePurchaseUpdate(order, { supplierConfirmed: true, supplierConfirmedAt: new Date().toISOString() })
  appendPmsLog({
    objectType: 'material-purchase-order',
    objectId: purchaseOrderNo,
    action: '供应商确认',
    beforeValue: beforeConfirmed ? '已确认' : '未确认',
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
  if(listTmfSupplyPurchaseProjections().some(o=>o.purchaseOrderNo===purchaseOrderNo))throw new PmsDomainError('TMF_SUPPLY_RECEIPT_FACT_REQUIRED','该投入料采购已产生仓库实收；履约从实收记录回读，不能手改累计、关闭或覆盖来源，请先处理执行影响。')
  if (getTmfMaterialPurchase(purchaseOrderNo)) throw new PmsDomainError('TMF_WAREHOUSE_RECEIPT_REQUIRED', '织带厂基础采购请从辅料仓按上游交出批次实收，不能手改累计到货数量。')
  const order = getPmsMaterialPurchaseOrder(purchaseOrderNo)
  if (!order) throw new PmsDomainError('MPO_NOT_FOUND', `面辅料采购单 ${purchaseOrderNo} 不存在`)
  if (order.tmfTipSource) throw new PmsDomainError('TMF_WAREHOUSE_RECEIPT_REQUIRED', '端头辅材采购须从辅料仓按实际收货登记，不能手改累计到货。')
  if (order.status === '已关闭') throw new PmsDomainError('MPO_CLOSED_BLOCKED', '已关闭的采购单不能登记到货')
  if (order.status === '待采购') throw new PmsDomainError('MPO_NOT_PURCHASED', '请先标记已采购后再登记到货')
  if (!Number.isFinite(receivedQty) || receivedQty <= 0) throw new PmsDomainError('MPO_RECEIVED_QTY_INVALID', '到货数量必须大于 0')
  if (receivedQty > order.orderedQty) throw new PmsDomainError('MPO_RECEIVED_OVER', `到货数量不能超过采购数量 ${order.orderedQty} ${order.unit}`)
  const before = `${order.receivedQty} ${order.unit} · ${order.status}`
  const actualQty = roundPmsQty(receivedQty, 2)
  savePurchaseUpdate(order, { receivedQty: actualQty, status: actualQty >= order.orderedQty ? '已到货' : '部分到货' })
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
  草稿: [],
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
  if(listTmfSupplyPurchaseProjections().some(o=>o.purchaseOrderNo===purchaseOrderNo))throw new PmsDomainError('TMF_SUPPLY_RECEIPT_FACT_REQUIRED','该投入料采购已产生仓库实收；履约从实收记录回读，不能手改累计、关闭或覆盖来源，请先处理执行影响。')
  const tmf = getTmfMaterialPurchase(purchaseOrderNo)
  if (tmf) {
    if (nextStatus !== '已采购') throw new PmsDomainError('TMF_FACT_REQUIRED', '织带采购的到货与入库由仓库实收形成；关闭请填写原因并确认。')
    if (actor.role !== '采购员' && actor.role !== '采购主管') throw new PmsDomainError('TMF_ROLE_BLOCKED', '当前角色不能下达织带采购。')
    releaseTmfMaterialPurchase(purchaseOrderNo, actor as TmfPurchaseActor, `PMS-RELEASE:${purchaseOrderNo}:${tmf.version}`)
    return getTmfMaterialPurchase(purchaseOrderNo)!
  }
  const order = getPmsMaterialPurchaseOrder(purchaseOrderNo)
  if (!order) throw new PmsDomainError('MPO_NOT_FOUND', `面辅料采购单 ${purchaseOrderNo} 不存在`)
  if (order.tmfTipSource && nextStatus !== '已采购') throw new PmsDomainError('TMF_FACT_REQUIRED','端头采购到货和入库来自仓库实收；关闭请填写原因。')
  if (!MPO_STATUS_TRANSITIONS[order.status].includes(nextStatus)) {
    throw new PmsDomainError('MPO_TRANSITION_BLOCKED', `${order.status} 不能直接流转到 ${nextStatus}`)
  }
  if (nextStatus === '已入库' && order.receivedQty <= 0) {
    throw new PmsDomainError('MPO_RECEIVE_REQUIRED', '请先登记到货数量再入库')
  }
  const before = order.status
  savePurchaseUpdate(order, { status: nextStatus, receivedQty: nextStatus === '已到货' && order.receivedQty <= 0 ? order.orderedQty : order.receivedQty })
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
  if (purchaseOrderNos.some(orderNo => getPmsMaterialPurchaseOrder(orderNo)?.pcsSource)) throw new PmsDomainError('MPO_DRAFT_ACTION_BLOCKED', '采购草稿请通过草稿表单维护，本次未推进状态。')
  return purchaseOrderNos.map((purchaseOrderNo) => advancePmsMaterialPurchaseOrderStatus(purchaseOrderNo, nextStatus, actor))
}

export function closePmsMaterialPurchaseOrder(
  purchaseOrderNo: string,
  reason: string,
  actor: { id: string; name: string; role: PmsActorRole },
): PmsMaterialPurchaseOrder {
  if(listTmfSupplyPurchaseProjections().some(o=>o.purchaseOrderNo===purchaseOrderNo))throw new PmsDomainError('TMF_SUPPLY_RECEIPT_FACT_REQUIRED','该投入料采购已产生仓库实收；履约从实收记录回读，不能手改累计、关闭或覆盖来源，请先处理执行影响。')
  const tmf = getTmfMaterialPurchase(purchaseOrderNo)
  if (tmf) {
    if (actor.role !== '采购员' && actor.role !== '采购主管') throw new PmsDomainError('TMF_ROLE_BLOCKED', '当前角色不能关闭织带采购。')
    cancelTmfMaterialPurchaseAfterDisposition(purchaseOrderNo, { reason, confirmed: true }, actor as TmfPurchaseActor, `PMS-CLOSE:${purchaseOrderNo}:${tmf.version}`)
    return getTmfMaterialPurchase(purchaseOrderNo)!
  }
  const order = getPmsMaterialPurchaseOrder(purchaseOrderNo)
  if (!order) throw new PmsDomainError('MPO_NOT_FOUND', `面辅料采购单 ${purchaseOrderNo} 不存在`)
  if (!reason.trim()) throw new PmsDomainError('MPO_REASON_REQUIRED', '关闭采购单必须填写原因')
  if (order.status === '已关闭') throw new PmsDomainError('MPO_CLOSED_BLOCKED', '该采购单已经关闭')
  if (order.status === '已入库') throw new PmsDomainError('MPO_INBOUND_BLOCKED', '已入库的采购单不可关闭')
  const before = order.status
  savePurchaseUpdate(order, { status: '已关闭', remark: reason.trim() })
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
  pcsPurchaseDrafts.clear(); pcsPurchaseLogs.clear(); pcsPurchaseReadPromise = null; pendingDeltasPromise = null; hydratedPurchaseOrders = null
  invalidateReadSavedPurchaseUpdatesCache()
}

// § 2.4.3.6 跨标签页同步:监听 storage 事件,其他标签页写入该键时刷新缓存。
// 声明必须在 if 之前:原先放在 if 之后,`typeof window !== 'undefined'` 为真时会命中 let 的 TDZ,
// 模块加载即抛 ReferenceError,导致监听从未注册(Node 下因 window 短路才未暴露)。
let storageListenerInstalled = false
if (typeof window !== 'undefined' && !storageListenerInstalled) {
  storageListenerInstalled = true
  window.addEventListener('storage', (event) => {
    if (event.key === PMS_MATERIAL_PURCHASE_UPDATES_KEY) {
      invalidateReadSavedPurchaseUpdatesCache()
    }
  })
}

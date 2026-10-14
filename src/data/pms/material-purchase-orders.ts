import {
  publishPmsMaterialRequirements,
  hydratePmsMaterialRequirementsFromIdb,
  getPmsMaterialRequirement,
  listPmsMaterialRequirements,
  type PmsMaterialRequirement,
  type PmsMaterialRequirementLine,
} from './material-requirements.ts'
import { getPmsProductPurchaseOrder, hydratePmsProductPurchaseOrdersFromIdb, publishPmsProductPurchaseOrders } from './product-purchase-orders.ts'
import { createPmsOperationLog, publishPmsOperationLog, listPmsLogs, nextPmsSequence, PmsDomainError, roundPmsQty, type PmsActorRole, type PmsOperationLog } from './runtime.ts'
import { PMS_MATERIAL_IMAGES, PMS_STYLE_IMAGES } from './images.ts'
import { PMS_STORES, getPmsDb, pmsAll, pmsDelete, pmsGet, pmsPut, pmsTx, pmsCommitRecords, type PmsCommitRecord, type PmsAttachment, broadcastPmsDataChanged } from './idb-storage.ts'
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
  _pmsBaseVersion?: number
  inventoryPosting?:PmsMaterialPurchaseInventoryPosting
  defectInventoryPosting?:PmsMaterialPurchaseInventoryPosting
  priceConfirmed?:boolean
  isStockProduction?:boolean
  purchasedAt?:string
  arrivedAt?:string
  inspection?:{sampleQty:number;qualifiedQty:number;defectQty:number;reason:string;warehouse:string;inspector:string;inspectedAt:string;labelLength?:number;actualLength?:number;shortageRate?:number}
  weightKg?: number
  volumeM3?: number
  dyeFee?: number
  usageType?: string
  supplementReason?:string
  dedicatedSpu?:string
  factoryName?: string
  inspector?: string
  inspectionConclusion?: string
  rejectedReason?:string
  printingFactory?:string
  cuttingFactory?:string
  printingProcess?:string
  defectQty?:number
  defectWarehouse?:string
  detailBarcodes?:Array<{code:string;quantity:number;unit:string;warehouse:string;status:'有效'|'已下架';createdAt?:string;printedAt?:string;printedBy?:string;targetArea?:'待出库区';movedAt?:string;movedBy?:string}>
  attachments?:Array<{fileId:string;name:string;type:string;size:number;category:'物流凭证'|'附加图片'}>
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
  transportMethod?:string
  contact?:string
  sellerBoxNo?:string
  boxNo?:string
  lengthCm?:number
  widthCm?:number
  heightCm?:number
  weightKg?:number
  transferCenter?:string
  estimatedTransferDays?:number
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
  id?: string
  _pmsBaseVersion?: number
  weightKg?: number
  volumeM3?: number
  boxNo?: string
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
  domesticSignCompany?:string
  headLogisticsQty: number
  headLogisticsRolls: number
  headAllocations?:Array<{batchNo:string;qty:number;rolls:number;signed:boolean}>
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
    pmsAll<PmsMaterialLogisticsRecord>(PMS_STORES.pmsPurchaseTracking),
  ]).then(([orders, logs, logistics]) => {
    const rt=getRuntime()
    for(const row of logistics){const old=rt.logisticsRecords.find(r=>r.recordNo===row.recordNo);if(old) Object.assign(old,row);else rt.logisticsRecords.push(row)}
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
  extra: { requirementNo?: string; sourceRequirementLineNo?: string; sourceProductPurchaseOrderNo?: string; receivedQty?: number; remark?: string; supplierConfirmed?: boolean; supplierConfirmedAt?: string;detailBarcodes?:PmsMpoDetailBarcode[] } = {},
): PmsMaterialPurchaseOrder {
  return {
    purchaseOrderNo,
    detailBarcodes:extra.detailBarcodes,
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
  const yarn = { materialCode: 'MAT-YN-00000001-B01', materialName: '针织棉纱 · 白色 · -', materialType: '纱线', materialImageUrl: '/materials/process-orders/cotton-yarn-cone.jpg', unit: 'KG', styleCode: 'HD-2603', styleName: '连帽卫衣', styleImageUrl: PMS_STYLE_IMAGES.hoodie, supplierName: '宁波恒源纱线有限公司', warehouse: '广州原料仓' }
  const polyBag = { materialCode: 'PKG-2026-0002', materialName: '40×60cm 透明胶袋', materialType: '包材', materialImageUrl: PMS_MATERIAL_IMAGES.polyBag, unit: '个', styleCode: 'HD-2603', styleName: '连帽卫衣', styleImageUrl: PMS_STYLE_IMAGES.hoodie, supplierName: '深圳优品包材有限公司', warehouse: '广州原料仓' }

  const orders: PmsMaterialPurchaseOrder[] = [
    buildOrder('CGF-2026-0001', cotton, 552, 26.5, '已采购', { orderDate: '2026-06-09', expectedArrivalDate: '2026-06-25' }, { requirementNo: 'MREQ-0002', sourceRequirementLineNo: 'MREQ-0002-01', sourceProductPurchaseOrderNo: 'CG-2026-0020' }),
    buildOrder('CGF-2026-0002', button, 996, 0.18, '部分到货', { orderDate: '2026-06-09', expectedArrivalDate: '2026-06-22' }, { requirementNo: 'MREQ-0002', sourceRequirementLineNo: 'MREQ-0002-02', sourceProductPurchaseOrderNo: 'CG-2026-0020', receivedQty: 600 }),
    buildOrder('CGF-2026-0003', dressFabric, 1443.6, 26.5, '已入库', { orderDate: '2026-06-05', expectedArrivalDate: '2026-06-20' }, { requirementNo: 'MREQ-0003', sourceRequirementLineNo: 'MREQ-0003-01', sourceProductPurchaseOrderNo: 'CG-2026-0021', receivedQty: 1443.6 }),
    buildOrder('CGF-2026-0004', fleece, 800, 29.8, '已采购', { orderDate: '2026-06-10', expectedArrivalDate: '2026-06-28' }),
    buildOrder('CGF-2026-0005', thread, 60, 13, '部分到货', { orderDate: '2026-06-08', expectedArrivalDate: '2026-06-21' }, { receivedQty: 40,supplierConfirmed:true,supplierConfirmedAt:'2026-06-12T16:20:00+07:00' }),
    buildOrder('CGF-2026-0006', label, 5000, 0.23, '已入库', { orderDate: '2026-05-30', expectedArrivalDate: '2026-06-12' }, { receivedQty: 5000 }),
    buildOrder('CGF-2026-0007', yarn, 300, 21.2, '待采购', { orderDate: '2026-06-11', expectedArrivalDate: '2026-07-02' },{detailBarcodes:Array.from({length:6},(_,i)=>({code:`BC-YARN-DEMO-${i+1}`,quantity:50,unit:'KG',warehouse:'广州原料仓',status:'有效' as const,createdAt:'2026-06-11T09:00:00+07:00'}))}),
    buildOrder('CGF-2026-0008', polyBag, 8000, 0.3, '已关闭', { orderDate: '2026-05-26', expectedArrivalDate: '2026-06-15' }, { remark: '供应商产能不足，改由其他批次采购' }),
  ]

  const byNo = (no: string): PmsMaterialPurchaseOrder => {
    const order = orders.find((item) => item.purchaseOrderNo === no)
    if (!order) throw new Error(`面辅料采购单不存在: ${no}`)
    return order
  }

  const logisticsRecords: PmsMaterialLogisticsRecord[] = [
    buildLogisticsRecord('LOG-2026-0001', byNo('CGF-2026-0001'), { purchaseOrderNo: 'CGF-2026-0001', company: '顺丰速运', trackingNo: 'SF1368000123456', shipDate: '2026-06-10', estimatedArrival: '2026-06-13', boxCount: 6, rolls: 6, qty: 552, fee: 380, remark: '' }, { domesticSigned: true, domesticSignedAt: '2026-06-13T10:20:00+07:00', headLogisticsQty:552,headLogisticsRolls:6,headBatchNo:'FL-2026-0001' }),
    buildLogisticsRecord('LOG-2026-0002', byNo('CGF-2026-0002'), { purchaseOrderNo: 'CGF-2026-0002', company: '跨越速运', trackingNo: 'KY9988771122', shipDate: '2026-06-09', estimatedArrival: '2026-06-12', boxCount: 3, rolls: 0, qty: 996, fee: 210, remark: '' }, { domesticSigned: true, domesticSignedAt: '2026-06-12T15:00:00+07:00',headLogisticsQty:996,headBatchNo:'FL-2026-0002' }),
    buildLogisticsRecord('LOG-2026-0003', byNo('CGF-2026-0004'), { purchaseOrderNo: 'CGF-2026-0004', company: '德邦物流', trackingNo: 'DB6600123987', shipDate: '2026-06-11', estimatedArrival: '2026-06-14', boxCount: 5, rolls: 5, qty: 500, fee: 460, remark: '首批已发头程' }, { domesticSigned: true, domesticSignedAt: '2026-06-14T09:40:00+07:00',headLogisticsQty:500,headLogisticsRolls:5,headBatchNo:'FL-2026-0003',headSigned:true,headSignedAt:'2026-06-11T09:10:00+07:00' }),
    buildLogisticsRecord('LOG-2026-0004', byNo('CGF-2026-0005'), { purchaseOrderNo: 'CGF-2026-0005', company: '中通快递', trackingNo: 'ZT7856001234', shipDate: '2026-06-09', estimatedArrival: '2026-06-12', boxCount: 2, rolls: 0, qty: 60, fee: 96, remark: '分两批发货，本单先到 40 卷' }, { domesticSigned: true, domesticSignedAt: '2026-06-12T11:10:00+07:00' }),
    buildLogisticsRecord('LOG-2026-0005', byNo('CGF-2026-0006'), { purchaseOrderNo: 'CGF-2026-0006', company: '京东物流', trackingNo: 'JD5566778899', shipDate: '2026-06-01', estimatedArrival: '2026-06-04', boxCount: 5, rolls: 0, qty: 5000, fee: 260, remark: '' }, { domesticSigned: true, domesticSignedAt: '2026-06-04T14:30:00+07:00',headLogisticsQty:5000,headBatchNo:'FL-2026-0002' }),
    buildLogisticsRecord('LOG-2026-0006', byNo('CGF-2026-0004'), { purchaseOrderNo: 'CGF-2026-0004', company: '安能物流', trackingNo: 'AN5566001122', shipDate: '2026-06-15', estimatedArrival: '2026-06-18', boxCount: 3, rolls: 3, qty: 300, fee: 180, remark: '第二批尾货，等待国内签收' }),
  ]

  runtime = { orders, logisticsRecords }
  return runtime
}

export { PMS_LEGACY_MPO_KEY as PMS_MATERIAL_PURCHASE_UPDATES_KEY } from './legacy-purchase-migration.ts'

/** Prepare one record change; the surrounding action commits it atomically. */
function savePurchaseUpdate(order:PmsMaterialPurchaseOrder,patch:Partial<PmsMaterialPurchaseOrder>):void {
  if(!preparingPurchase) throw new PmsDomainError('MPO_ATOMIC_REQUIRED','采购修改须通过保存动作提交')
  if(order.pcsSource) throw new PmsDomainError('MPO_DRAFT_ACTION_BLOCKED','采购草稿请从草稿表单修改')
  Object.assign(order,patch)
}
let preparingPurchase:{logs:PmsOperationLog[];related:PmsCommitRecord[];publish:Array<()=>void>;operationId:string}|null=null
function appendPmsLog(entry:Parameters<typeof createPmsOperationLog>[0]):void {
  if(!preparingPurchase) throw new PmsDomainError('MPO_ATOMIC_REQUIRED','采购修改须通过保存动作提交')
  preparingPurchase.logs.push(createPmsOperationLog(entry))
}
async function commitPurchase<T>(prepare:()=>T,operationId:string,operationSignature:string,files:{attachments?:PmsAttachment[];attachmentDeletes?:string[]}={}):Promise<T> {
  await Promise.all([hydratePmsMaterialPurchaseOrdersFromIdb(),hydratePmsMaterialRequirementsFromIdb()])
  const before=getRuntime(),draft=structuredClone(before),changes={logs:[] as PmsOperationLog[],related:[] as PmsCommitRecord[],publish:[] as Array<()=>void>,operationId}
  let result:T
  runtime=draft;preparingPurchase=changes
  try{result=prepare()}finally{runtime=before;preparingPurchase=null}
  const orders=draft.orders.filter(row=>JSON.stringify(row)!==JSON.stringify(before.orders.find(old=>old.purchaseOrderNo===row.purchaseOrderNo)))
  const logistics=draft.logisticsRecords.filter(row=>JSON.stringify(row)!==JSON.stringify(before.logisticsRecords.find(old=>old.recordNo===row.recordNo))).map(row=>({...row,id:row.recordNo}))
  changes.logs.forEach((log,index)=>{log.id=`${operationId}:log:${index}`})
  await pmsCommitRecords([...orders.map(value=>({store:PMS_STORES.pmsMaterialPurchaseOrderDeltas,value})),...logistics.map(value=>({store:PMS_STORES.pmsPurchaseTracking,value})),...changes.related,...changes.logs.map(value=>({store:PMS_STORES.pmsOperationLogs,value}))],{operationId,operationSignature,...files,attachmentReferences:orders.map(order=>({store:PMS_STORES.pmsMaterialPurchaseOrderDeltas,key:order.purchaseOrderNo,fileIds:(order.attachments || []).map(file=>file.fileId)}))})
  for(const row of orders){const old=before.orders.find(r=>r.purchaseOrderNo===row.purchaseOrderNo);if(old) Object.assign(old,row);else before.orders.unshift(row)}
  publishPmsMaterialLogisticsRecords(logistics);changes.publish.forEach(fn=>fn());changes.logs.forEach(publishPmsOperationLog)
  return result!
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
  }
  return runtime
}

/** 从生产单已采用的端头BOM生成普通PMS采购；不创建辅材SKU、不自动增加库存。 */
function prepareCreatePmsTmfTipPurchase(
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
  let operationHash=2166136261;for(const char of operationId){operationHash^=char.charCodeAt(0);operationHash=Math.imul(operationHash,16777619)}const no=`CGF-2026-${(operationHash>>>0).toString().padStart(10,'0')}`
  if (getPmsMaterialPurchaseOrder(no)) throw new PmsDomainError('TMF_NUMBER_CONFLICT','采购编号已存在，请刷新后重新生成。')
  const order = buildOrder(no,{materialCode:material.materialSkuId,materialName:material.materialName,materialType:'辅料',materialImageUrl:material.imageUrl,unit:material.unit,styleCode:'',styleName:'',styleImageUrl:'',supplierName:input.supplierName.trim(),warehouse:input.warehouse.trim()},input.quantity,input.unitPrice,'待采购',{orderDate:new Date().toISOString().slice(0,10),expectedArrivalDate:input.expectedArrivalDate},{requirementNo:demand.productionOrderNo,sourceRequirementLineNo:demand.id,remark:input.reason.trim()})
  order.buyerName=actor.name
  order.tmfTipSource={demandId:demand.id,materialBomItemId:material.bomItemId,productionOrderNo:demand.productionOrderNo,snapshotId:demand.techPackSnapshotId,versionId:demand.techPackVersionId,operationId,signature,masterRef:tipMasterRef}
  savePurchaseUpdate(order,{})
  if (!getRuntime().orders.some(item => item.purchaseOrderNo === no)) getRuntime().orders.unshift(order)
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
  if(requirement.rejectedReason) return {ok:false,reason:'需求已驳回，不能生成采购单',pushableLines:[]}
  if (requirement.status === '已下推') return { ok: false, reason: '该需求已经全部下推生成采购单', pushableLines: [] }
  const pushableLines = requirement.lines.filter((line) => line.pushStatus === '待下推')
  if (pushableLines.length === 0) return { ok: false, reason: '没有待下推的物料行', pushableLines: [] }
  if (pushableLines.every((line) => line.suggestedQty <= 0)) {
    return { ok: false, reason: '全部待下推行的建议采购量为 0，无需下推', pushableLines }
  }
  return { ok: true, reason: '', pushableLines }
}

function preparePushPmsMaterialRequirement(
  requirementNo: string,
  lineInputs: PmsRequirementPushLineInput[],
  actor: { id: string; name: string; role: PmsActorRole },
): PmsMaterialPurchaseOrder[] {
  const check = checkPmsMaterialRequirementPush(requirementNo)
  if (!check.ok) throw new PmsDomainError('MREQ_PUSH_BLOCKED', check.reason)
  const requirement = getPmsMaterialRequirement(requirementNo)
  if (!requirement) throw new PmsDomainError('MREQ_NOT_FOUND', `面辅料需求 ${requirementNo} 不存在`)

  if(new Set(lineInputs.map(row=>row.lineNo)).size!==lineInputs.length) throw new PmsDomainError('MREQ_DUPLICATE_LINE','同一物料行不能重复下推')
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
      `CGF-${preparingPurchase!.operationId}-${created.length+1}`,
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

  const updated=structuredClone(requirement)
  for(const order of created){const line=updated.lines.find(l=>l.lineNo===order.sourceRequirementLineNo)!;line.actualQty=order.orderedQty;line.unitPrice=order.unitPrice;line.priceConfirmed=true;line.pushStatus='已下推';line.generatedPurchaseOrderNo=order.purchaseOrderNo}
  updated.status=updated.lines.every(l=>l.pushStatus==='已下推'||l.suggestedQty<=0)?'已下推':'部分下推'
  preparingPurchase!.related.push({store:PMS_STORES.pmsMaterialRequirements,value:updated})
  preparingPurchase!.publish.push(()=>publishPmsMaterialRequirements([updated]))
  if(updated.status==='已下推') {
    const current=getPmsProductPurchaseOrder(updated.sourcePurchaseOrderNo)
    if(current){const next=structuredClone(current);next.lines.forEach(line=>{if(line.needBom && line.materialStatus==='已生成') line.materialStatus='已下推'});preparingPurchase!.related.push({store:PMS_STORES.pmsProductPurchaseOrders,value:next});preparingPurchase!.publish.push(()=>publishPmsProductPurchaseOrders([next]))}
  }


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
  for(const key of ['lengthCm','widthCm','heightCm','weightKg','estimatedTransferDays'] as const)if(row[key]!==undefined&&(!Number.isFinite(row[key])||row[key]!<0))return '尺寸、重量及预计转运天数须为非负数'
  if(row.transportMethod&&!['快递','自提','货拉拉','海运','空运'].includes(row.transportMethod))return '选择有效货运方式'
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
  if(row.qty>purchase.orderedQty) return `物流数量不能超过采购数量 ${purchase.orderedQty} ${purchase.unit}`
  if(row.shipDate && !Number.isFinite(Date.parse(row.shipDate)) || row.estimatedArrival && !Number.isFinite(Date.parse(row.estimatedArrival))) return '填写有效日期'
  if(row.shipDate && row.estimatedArrival && row.estimatedArrival<row.shipDate) return '预计到达日期不能早于发货日期'
  if (!Number.isFinite(row.fee) || row.fee < 0) return '运费不能为负数'
  return ''
}

function prepareImportPmsMaterialLogistics(
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

  for(const purchaseOrderNo of new Set(rows.map(row=>row.purchaseOrderNo.trim()))){const order=getPmsMaterialPurchaseOrder(purchaseOrderNo)!;const total=logistics.filter(record=>record.purchaseOrderNo===purchaseOrderNo).reduce((sum,record)=>sum+record.qty,0)+rows.filter(row=>row.purchaseOrderNo.trim()===purchaseOrderNo).reduce((sum,row)=>sum+row.qty,0);if(total>order.orderedQty) throw new PmsDomainError('LOGISTICS_IMPORT_OVER_QTY',`采购单 ${purchaseOrderNo} 累计物流数量 ${total} 超过采购数量 ${order.orderedQty} ${order.unit}`)}

  rows.forEach((row) => {
    const order = getPmsMaterialPurchaseOrder(row.purchaseOrderNo.trim())
    if (!order) throw new PmsDomainError('MPO_NOT_FOUND', `采购单 ${row.purchaseOrderNo} 不存在`)
    const record = buildLogisticsRecord(`LOG-${preparingPurchase!.operationId}-${imported.length+1}`, order, { ...row, purchaseOrderNo: order.purchaseOrderNo, company: row.company.trim(), trackingNo: row.trackingNo.trim() })
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

function prepareSignPmsMaterialLogistics(
  recordNos: string[],
  stage: 'domestic' | 'head',
  actor: { id: string; name: string; role: PmsActorRole },
  input?:{company:string;signedDate:string},
): PmsMaterialLogisticsRecord[] {
  if(input && (!input.company.trim() || !DATE_PATTERN.test(input.signedDate) || !Number.isFinite(Date.parse(input.signedDate)))) throw new PmsDomainError('LOGISTICS_SIGN_INPUT','填写签收公司和有效签收日期')
  if (recordNos.length === 0) throw new PmsDomainError('LOGISTICS_SIGN_EMPTY', '请至少选择一条物流记录')
  const signed: PmsMaterialLogisticsRecord[] = []
  recordNos.forEach((recordNo) => {
    const record = getPmsMaterialLogisticsRecord(recordNo)
    if (!record) throw new PmsDomainError('LOGISTICS_NOT_FOUND', `物流记录 ${recordNo} 不存在`)
    const before = stage === 'domestic' ? record.domesticSigned : record.headSigned
    if (before) throw new PmsDomainError('LOGISTICS_ALREADY_SIGNED',`${record.trackingNo} 已签收，重新选择未签收记录`)
    if (stage === 'domestic') {
      record.domesticSigned = true
      record.domesticSignedAt = input?.signedDate ? `${input.signedDate}T12:00:00+07:00` : new Date().toISOString()
      record.domesticSignCompany=input?.company.trim() || record.company
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
      reason: input?`${input.company} · ${input.signedDate}`:'',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      secondConfirmation:true,
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

function prepareApplyPmsSupplierConfirmation(purchaseOrderNo: string, actor: { id: string; name: string; role: PmsActorRole }): void {
  if(listTmfSupplyPurchaseProjections().some(o=>o.purchaseOrderNo===purchaseOrderNo))throw new PmsDomainError('TMF_SUPPLY_RECEIPT_FACT_REQUIRED','该投入料采购已产生仓库实收；履约从实收记录回读，不能手改累计、关闭或覆盖来源，请先处理执行影响。')
  const tmf = getTmfMaterialPurchase(purchaseOrderNo)
  if (tmf) {
    if (actor.role !== '采购员' && actor.role !== '采购主管') throw new PmsDomainError('TMF_ROLE_BLOCKED', '当前角色不能确认织带采购。')
    confirmTmfPurchaseSupplier(purchaseOrderNo, actor as TmfPurchaseActor, `PMS-CONFIRM:${purchaseOrderNo}:${tmf.version}`)
    return
  }
  const order = getPmsMaterialPurchaseOrder(purchaseOrderNo)
  if(order?.rejectedReason) throw new PmsDomainError('MPO_REJECTED','采购单已驳回，不能推进或登记到货')
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

function prepareRegisterPmsMaterialPurchaseArrival(
  purchaseOrderNo: string,
  receivedQty: number,
  actor: { id: string; name: string; role: PmsActorRole },
): PmsMaterialPurchaseOrder {
  if(listTmfSupplyPurchaseProjections().some(o=>o.purchaseOrderNo===purchaseOrderNo))throw new PmsDomainError('TMF_SUPPLY_RECEIPT_FACT_REQUIRED','该投入料采购已产生仓库实收；履约从实收记录回读，不能手改累计、关闭或覆盖来源，请先处理执行影响。')
  if (getTmfMaterialPurchase(purchaseOrderNo)) throw new PmsDomainError('TMF_WAREHOUSE_RECEIPT_REQUIRED', '织带厂基础采购请从辅料仓按上游交出批次实收，不能手改累计到货数量。')
  const order = getPmsMaterialPurchaseOrder(purchaseOrderNo)
  if(order?.rejectedReason) throw new PmsDomainError('MPO_REJECTED','采购单已驳回，不能推进或登记到货')
  if (!order) throw new PmsDomainError('MPO_NOT_FOUND', `面辅料采购单 ${purchaseOrderNo} 不存在`)
  if (order.tmfTipSource) throw new PmsDomainError('TMF_WAREHOUSE_RECEIPT_REQUIRED', '端头辅材采购须从辅料仓按实际收货登记，不能手改累计到货。')
  if (order.status === '已关闭' || order.status==='已入库') throw new PmsDomainError('MPO_CLOSED_BLOCKED', '已关闭或全部入库的采购单不能登记到货')
  if (order.status === '待采购') throw new PmsDomainError('MPO_NOT_PURCHASED', '请先标记已采购后再登记到货')
  if (!Number.isFinite(receivedQty) || receivedQty <= 0) throw new PmsDomainError('MPO_RECEIVED_QTY_INVALID', '到货数量必须大于 0')
  if (receivedQty > order.orderedQty) throw new PmsDomainError('MPO_RECEIVED_OVER', `到货数量不能超过采购数量 ${order.orderedQty} ${order.unit}`)
  const before = `${order.receivedQty} ${order.unit} · ${order.status}`
  const actualQty = roundPmsQty(receivedQty, 2)
  const postedQty=(order.inventoryPosting?.qty||0)+(order.defectInventoryPosting?.qty||0)
  if(actualQty<Math.max(order.receivedQty,postedQty))throw new PmsDomainError('MPO_RECEIVED_REDUCE','累计到货数量不能少于已登记的到货或入库数量')
  order.arrivedAt=new Date().toISOString()
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

function prepareAdvancePmsMaterialPurchaseOrderStatus(
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
  if(order?.rejectedReason) throw new PmsDomainError('MPO_REJECTED','采购单已驳回，不能推进或登记到货')
  if (!order) throw new PmsDomainError('MPO_NOT_FOUND', `面辅料采购单 ${purchaseOrderNo} 不存在`)
  if (order.tmfTipSource && nextStatus !== '已采购') throw new PmsDomainError('TMF_FACT_REQUIRED','端头采购到货和入库来自仓库实收；关闭请填写原因。')
  if (!MPO_STATUS_TRANSITIONS[order.status].includes(nextStatus)) {
    throw new PmsDomainError('MPO_TRANSITION_BLOCKED', `${order.status} 不能直接流转到 ${nextStatus}`)
  }
  if (nextStatus === '已入库' && order.receivedQty <= 0) {
    throw new PmsDomainError('MPO_RECEIVE_REQUIRED', '请先登记到货数量再入库')
  }
  if(nextStatus==='部分到货' && !(order.receivedQty>0 && order.receivedQty<order.orderedQty))throw new PmsDomainError('MPO_PARTIAL_FACT_REQUIRED','部分到货需要已登记的实到数量大于0且小于采购数量')
  if(nextStatus==='已到货' && order.receivedQty<order.orderedQty)throw new PmsDomainError('MPO_ARRIVAL_FACT_REQUIRED','全部到货需要已登记的累计实到数量达到采购数量')
  const before = order.status
  let resultStatus=nextStatus
  if(nextStatus==='已采购')order.purchasedAt=new Date().toISOString()
  if(nextStatus==='已入库'){
    if(!order.warehouse.trim() || !order.materialImageUrl)throw new PmsDomainError('MPO_INVENTORY_SOURCE','入库需要收货仓和对应物料图片')
    const previous=(order.inventoryPosting?.qty||0)+(order.defectInventoryPosting?.qty||0)
    if(order.receivedQty<=previous)throw new PmsDomainError('MPO_INBOUND_NO_REMAINDER','当前实到数量已经登记入库，先登记新增到货数量')
    const defect=order.inspection?.defectQty||0,postedAt=new Date().toISOString()
    const posting={sourcePurchaseOrderNo:order.purchaseOrderNo,materialCode:order.materialCode,materialName:order.materialName,imageUrl:order.materialImageUrl,unit:order.unit,postedAt,operator:actor.name,sourceKind:'local-demo' as const}
    order.inventoryPosting={...posting,quality:'正常',id:`MPO-IN:${order.purchaseOrderNo}`,warehouse:order.warehouse,qty:order.receivedQty-defect}
    if(defect)order.defectInventoryPosting={...posting,quality:'瑕疵',id:`MPO-DEFECT:${order.purchaseOrderNo}`,warehouse:order.inspection!.warehouse,qty:defect}
    resultStatus=order.receivedQty>=order.orderedQty?'已入库':'部分到货'
  }
  savePurchaseUpdate(order, { status: resultStatus, receivedQty: order.receivedQty })
  appendPmsLog({
    objectType: 'material-purchase-order',
    objectId: purchaseOrderNo,
    action: `状态流转 · ${nextStatus}`,
    beforeValue: before,
    afterValue: `${order.status}${nextStatus==='已入库'?` · 累计本地入库 ${order.receivedQty} ${order.unit}`:''}`,
    reason: '',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
  })
  return order
}

function prepareBatchAdvancePmsMaterialPurchaseOrders(
  purchaseOrderNos: string[],
  nextStatus: PmsMaterialPurchaseOrderStatus,
  actor: { id: string; name: string; role: PmsActorRole },
): PmsMaterialPurchaseOrder[] {
  if (purchaseOrderNos.length === 0) throw new PmsDomainError('MPO_BATCH_EMPTY', '请至少选择一张采购单')
  if(purchaseOrderNos.some(isTmfPurchaseOwner)) throw new PmsDomainError('TMF_BATCH_OWNER','织带专项采购须通过本对象单独操作，本次整批未保存')
  if (purchaseOrderNos.some(orderNo => getPmsMaterialPurchaseOrder(orderNo)?.pcsSource)) throw new PmsDomainError('MPO_DRAFT_ACTION_BLOCKED', '采购草稿请通过草稿表单维护，本次未推进状态。')
  return purchaseOrderNos.map((purchaseOrderNo) => prepareAdvancePmsMaterialPurchaseOrderStatus(purchaseOrderNo, nextStatus, actor))
}

function prepareClosePmsMaterialPurchaseOrder(
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
  if(order?.rejectedReason) throw new PmsDomainError('MPO_REJECTED','采购单已驳回，不能推进或登记到货')
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
  orderSequence = 8
  pcsPurchaseDrafts.clear(); pcsPurchaseLogs.clear(); pcsPurchaseReadPromise = null; pendingDeltasPromise = null; hydratedPurchaseOrders = null
}

/** Publish logistics candidates only after their shared purchase/first-leg transaction completes. */
export function publishPmsMaterialLogisticsRecords(rows:PmsMaterialLogisticsRecord[]):void {
  for(const row of rows) {const old=getRuntime().logisticsRecords.find(r=>r.recordNo===row.recordNo);if(old) Object.assign(old,row);else getRuntime().logisticsRecords.unshift(row)}
}

export async function pushPmsMaterialRequirement(...args:[...Parameters<typeof preparePushPmsMaterialRequirement>,operationId?:string]):Promise<ReturnType<typeof preparePushPmsMaterialRequirement>> {
 const operationId=args.length>3?String(args.pop()):crypto.randomUUID()
 await hydratePmsProductPurchaseOrdersFromIdb()
 return commitPurchase(()=>preparePushPmsMaterialRequirement(...args as Parameters<typeof preparePushPmsMaterialRequirement>),operationId,JSON.stringify(args))
}

export async function importPmsMaterialLogistics(...args:[...Parameters<typeof prepareImportPmsMaterialLogistics>,operationId?:string]):Promise<ReturnType<typeof prepareImportPmsMaterialLogistics>> {
 const operationId=args.length>2?String(args.pop()):crypto.randomUUID()
 return commitPurchase(()=>prepareImportPmsMaterialLogistics(...args as Parameters<typeof prepareImportPmsMaterialLogistics>),operationId,JSON.stringify(args))
}

export async function signPmsMaterialLogistics(recordNos:string[],stage:'domestic'|'head',actor:{id:string;name:string;role:PmsActorRole},operationId:string=crypto.randomUUID(),input?:{company:string;signedDate:string}):Promise<PmsMaterialLogisticsRecord[]>{
 return commitPurchase(()=>prepareSignPmsMaterialLogistics(recordNos,stage,actor,input),operationId,JSON.stringify([recordNos,stage,actor,input]))
}

function isTmfPurchaseOwner(orderNo:string):boolean{return !!getTmfMaterialPurchase(orderNo)||listTmfSupplyPurchaseProjections().some(row=>row.purchaseOrderNo===orderNo)}
export function applyPmsTmfSupplierConfirmation(orderNo:string,actor:{id:string;name:string;role:PmsActorRole}):void{if(!isTmfPurchaseOwner(orderNo))throw new PmsDomainError('TMF_SOURCE_REQUIRED','该同步适配仅用于织带采购');return prepareApplyPmsSupplierConfirmation(orderNo,actor)}
export function advancePmsTmfMaterialPurchaseOrderStatus(orderNo:string,status:PmsMaterialPurchaseOrderStatus,actor:{id:string;name:string;role:PmsActorRole}):PmsMaterialPurchaseOrder{if(!isTmfPurchaseOwner(orderNo))throw new PmsDomainError('TMF_SOURCE_REQUIRED','该同步适配仅用于织带采购');return prepareAdvancePmsMaterialPurchaseOrderStatus(orderNo,status,actor)}
export function closePmsTmfMaterialPurchaseOrder(orderNo:string,reason:string,actor:{id:string;name:string;role:PmsActorRole}):PmsMaterialPurchaseOrder{if(!isTmfPurchaseOwner(orderNo))throw new PmsDomainError('TMF_SOURCE_REQUIRED','该同步适配仅用于织带采购');return prepareClosePmsMaterialPurchaseOrder(orderNo,reason,actor)}

export async function applyPmsSupplierConfirmation(...args:[...Parameters<typeof prepareApplyPmsSupplierConfirmation>,operationId?:string]):Promise<ReturnType<typeof prepareApplyPmsSupplierConfirmation>> {
 if(isTmfPurchaseOwner(args[0]))return applyPmsTmfSupplierConfirmation(args[0],args[1])
 const operationId=args.length>2?String(args.pop()):crypto.randomUUID()
 return commitPurchase(()=>prepareApplyPmsSupplierConfirmation(...args as Parameters<typeof prepareApplyPmsSupplierConfirmation>),operationId,JSON.stringify(args))
}

export async function registerPmsMaterialPurchaseArrival(...args:[...Parameters<typeof prepareRegisterPmsMaterialPurchaseArrival>,operationId?:string]):Promise<ReturnType<typeof prepareRegisterPmsMaterialPurchaseArrival>> {
 const operationId=args.length>3?String(args.pop()):crypto.randomUUID()
 return commitPurchase(()=>prepareRegisterPmsMaterialPurchaseArrival(...args as Parameters<typeof prepareRegisterPmsMaterialPurchaseArrival>),operationId,JSON.stringify(args))
}

export async function advancePmsMaterialPurchaseOrderStatus(...args:[...Parameters<typeof prepareAdvancePmsMaterialPurchaseOrderStatus>,operationId?:string]):Promise<ReturnType<typeof prepareAdvancePmsMaterialPurchaseOrderStatus>> {
 if(isTmfPurchaseOwner(args[0]))return advancePmsTmfMaterialPurchaseOrderStatus(args[0],args[1],args[2])
 const operationId=args.length>3?String(args.pop()):crypto.randomUUID()
 return commitPurchase(()=>prepareAdvancePmsMaterialPurchaseOrderStatus(...args as Parameters<typeof prepareAdvancePmsMaterialPurchaseOrderStatus>),operationId,JSON.stringify(args))
}

export async function batchAdvancePmsMaterialPurchaseOrders(...args:[...Parameters<typeof prepareBatchAdvancePmsMaterialPurchaseOrders>,operationId?:string]):Promise<ReturnType<typeof prepareBatchAdvancePmsMaterialPurchaseOrders>> {
 const operationId=args.length>3?String(args.pop()):crypto.randomUUID()
 return commitPurchase(()=>prepareBatchAdvancePmsMaterialPurchaseOrders(...args as Parameters<typeof prepareBatchAdvancePmsMaterialPurchaseOrders>),operationId,JSON.stringify(args))
}

export async function closePmsMaterialPurchaseOrder(...args:[...Parameters<typeof prepareClosePmsMaterialPurchaseOrder>,operationId?:string]):Promise<ReturnType<typeof prepareClosePmsMaterialPurchaseOrder>> {
 if(isTmfPurchaseOwner(args[0]))return closePmsTmfMaterialPurchaseOrder(args[0],args[1],args[2])
 const operationId=args.length>3?String(args.pop()):crypto.randomUUID()
 return commitPurchase(()=>prepareClosePmsMaterialPurchaseOrder(...args as Parameters<typeof prepareClosePmsMaterialPurchaseOrder>),operationId,JSON.stringify(args))
}

export async function createPmsTmfTipPurchase(...args:Parameters<typeof prepareCreatePmsTmfTipPurchase>):Promise<PmsMaterialPurchaseOrder> {
 await hydratePmsMaterialPurchaseOrdersFromIdb()
 const previous=getRuntime().orders.find(order=>order.tmfTipSource?.operationId===args[2])
 if(previous){if(previous.tmfTipSource!.signature!==JSON.stringify([args[0],args[1].id,args[1].role]))throw new PmsDomainError('TMF_OPERATION_CONFLICT','此操作已保存其它采购内容，请查看原单');const stored=await pmsGet<PmsMaterialPurchaseOrder>(PMS_STORES.pmsMaterialPurchaseOrderDeltas,previous.purchaseOrderNo);if(!stored)throw new PmsDomainError('TMF_PURCHASE_UNSAVED','采购记录未保存，重新打开表单');publishPmsMaterialPurchaseOrders([stored]);return stored}
 return commitPurchase(()=>prepareCreatePmsTmfTipPurchase(...args),args[2],JSON.stringify(args))
}

export async function updatePmsMaterialPurchaseOrder(orderNo:string,patch:Partial<Pick<PmsMaterialPurchaseOrder,'orderedQty'|'unitPrice'|'currency'|'weightKg'|'volumeM3'|'dyeFee'|'usageType'|'purchaseRegion'|'buyerName'|'supplierName'|'factoryName'|'remark'|'expectedArrivalDate'|'inspector'|'inspectionConclusion'>>,actor:{id:string;name:string;role:PmsActorRole},operationId:string):Promise<PmsMaterialPurchaseOrder> {
 return commitPurchase(()=>{
  const order=getPmsMaterialPurchaseOrder(orderNo)
  if(!order || order.status==='已关闭' || order.status==='已入库' || order.pcsSource) throw new PmsDomainError('MPO_EDIT_LOCKED','当前采购单不允许修改')
  for(const key of ['orderedQty','unitPrice','weightKg','volumeM3','dyeFee'] as const) if(patch[key]!==undefined && (!Number.isFinite(patch[key]) || patch[key]!<0)) throw new PmsDomainError('MPO_VALUE_INVALID','数量、费用及尺寸须为非负数')
  if(patch.orderedQty!==undefined && (patch.orderedQty<=0 || patch.orderedQty<order.receivedQty)) throw new PmsDomainError('MPO_QUANTITY_BLOCKED','采购数量须大于0且不能低于已收货数量')
  if(patch.currency && !['RMB','USD','IDR'].includes(patch.currency)) throw new PmsDomainError('MPO_CURRENCY_INVALID','选择有效币种')
  savePurchaseUpdate(order,patch)
  appendPmsLog({objectType:'material-purchase-order',objectId:orderNo,action:'修改采购信息',beforeValue:'',afterValue:JSON.stringify(patch),reason:'',actorId:actor.id,actorName:actor.name,actorRole:actor.role})
  return order
 },operationId,JSON.stringify([orderNo,patch,actor]))
}
export async function copyPmsMaterialPurchaseOrder(orderNo:string,actor:{id:string;name:string;role:PmsActorRole},operationId:string):Promise<PmsMaterialPurchaseOrder> {
 return commitPurchase(()=>{const source=getPmsMaterialPurchaseOrder(orderNo);if(!source || source.pcsSource || source.tmfTipSource) throw new PmsDomainError('MPO_COPY_SOURCE','请选择普通面辅料采购单');const row={...structuredClone(source),detailBarcodes:[],inventoryPosting:undefined,defectInventoryPosting:undefined,inspection:undefined,defectQty:0,defectWarehouse:'',rejectedReason:'',closedReason:'',purchasedAt:undefined,arrivedAt:undefined,purchaseOrderNo:`CGF-${operationId}`,requirementNo:'',sourceRequirementLineNo:'',sourceProductPurchaseOrderNo:'',status:'待采购' as const,receivedQty:0,supplierConfirmed:false,supplierConfirmedAt:'',orderDate:new Date().toISOString().slice(0,10),_pmsBaseVersion:0};getRuntime().orders.unshift(row);appendPmsLog({objectType:'material-purchase-order',objectId:row.purchaseOrderNo,action:'复制采购单',beforeValue:orderNo,afterValue:row.purchaseOrderNo,reason:'',actorId:actor.id,actorName:actor.name,actorRole:actor.role});return row},operationId,JSON.stringify([orderNo,actor]))
}

export function preparePmsSupplierPurchaseConfirmation(orderNo:string):PmsMaterialPurchaseOrder {
  const before=getPmsMaterialPurchaseOrder(orderNo)
  if(!before || before.pcsSource || before.tmfTipSource || getTmfMaterialPurchase(orderNo) || before.status==='已关闭') throw new PmsDomainError('MPO_CONFIRM_BLOCKED','当前来源采购单不允许供应商确认')
  return {...structuredClone(before),supplierConfirmed:true,supplierConfirmedAt:new Date().toISOString()}
}
export function publishPmsMaterialPurchaseOrders(rows:PmsMaterialPurchaseOrder[]):void {
  for(const row of rows){const old=getRuntime().orders.find(r=>r.purchaseOrderNo===row.purchaseOrderNo);if(old) Object.assign(old,row);else getRuntime().orders.unshift(row)}
}

export interface PmsNewMaterialPurchaseInput {
  usageType?:'成衣做货'|'补采'|'成衣做货备货'|'样衣采购'
  supplementReason?:string
  dedicatedSpu?:string
  kind:'原料'|'面料'|'辅料'|'样衣'
  materialCode:string
  quantity:number
  unitPrice:number
  currency:'RMB'|'USD'|'IDR'
  supplierName:string
  purchaseRegion:string
  warehouse:string
  buyerName:string
  expectedArrivalDate:string
  remark:string
}
export async function createPmsMaterialPurchaseOrder(input:PmsNewMaterialPurchaseInput,actor:{id:string;name:string;role:PmsActorRole},operationId:string):Promise<PmsMaterialPurchaseOrder> {
  const {getPurchaseGoodsReference}=await import('./canonical-purchase-references.ts')
  const reference=getPurchaseGoodsReference(input.materialCode)
  if(!reference?.active || !reference.imageUrl) throw new PmsDomainError('MPO_SOURCE_UNAVAILABLE','选择已启用且有对应图片的商品或物料 SKU')
  if(input.kind==='样衣' ? reference.category!=='成衣' : input.kind==='面料' ? reference.category!=='面料' : input.kind==='辅料' ? reference.category!=='辅料' : reference.category==='成衣') throw new PmsDomainError('MPO_SOURCE_KIND','所选 SKU 类型与采购类型不匹配')
  if(!Number.isFinite(input.quantity) || input.quantity<=0 || !Number.isFinite(input.unitPrice) || input.unitPrice<0) throw new PmsDomainError('MPO_INPUT_NUMBER','数量须大于0，单价不能为负数')
  if(![input.supplierName,input.purchaseRegion,input.warehouse,input.buyerName].every(value=>value.trim())) throw new PmsDomainError('MPO_INPUT_REQUIRED','填写供应商、采购区域、收货仓和采购员')
  if(input.expectedArrivalDate && (!DATE_PATTERN.test(input.expectedArrivalDate) || !Number.isFinite(Date.parse(input.expectedArrivalDate)))) throw new PmsDomainError('MPO_DATE_INVALID','填写有效的预计到货日期')
  if(!['RMB','USD','IDR'].includes(input.currency)) throw new PmsDomainError('MPO_CURRENCY_INVALID','选择采购币种')
  if(input.usageType==='补采'&&(!input.supplementReason?.trim()||!input.remark.trim()||!input.dedicatedSpu?.trim()))throw new PmsDomainError('MPO_SUPPLEMENT_REQUIRED','补采须填写原因、采购备注和专用SPU')
  let dedicated:{styleCode:string;styleName:string;skuImageUrl:string}|undefined
  if(input.dedicatedSpu){const {listSkuArchives}=await import('../pcs-sku-archive-repository.ts');dedicated=listSkuArchives().find(row=>row.styleCode===input.dedicatedSpu&&row.archiveStatus==='ACTIVE');if(!dedicated)throw new PmsDomainError('MPO_SPU_UNKNOWN','选择已有且启用的商品SPU')}
  return commitPurchase(()=>{
    const row=buildOrder(`CGF-${operationId}`,{materialCode:reference.materialCode,materialName:reference.materialName,materialType:input.kind,materialImageUrl:reference.imageUrl,unit:reference.unit,styleCode:'',styleName:'',styleImageUrl:'',supplierName:input.supplierName,warehouse:input.warehouse},input.quantity,input.unitPrice,'待采购',{orderDate:new Date().toISOString().slice(0,10),expectedArrivalDate:input.expectedArrivalDate},{remark:input.remark})
    row.currency=input.currency;row.purchaseRegion=input.purchaseRegion;row.buyerName=input.buyerName;row.usageType=input.usageType||'成衣做货';row.isStockProduction=input.usageType==='成衣做货备货';row.supplementReason=input.supplementReason?.trim();row.dedicatedSpu=input.dedicatedSpu?.trim();if(dedicated){row.styleCode=dedicated.styleCode;row.styleName=dedicated.styleName;row.styleImageUrl=dedicated.skuImageUrl}getRuntime().orders.unshift(row)
    appendPmsLog({objectType:'material-purchase-order',objectId:row.purchaseOrderNo,action:'创建采购单',beforeValue:'',afterValue:`${reference.materialName} ${input.quantity} ${reference.unit}`,reason:input.remark,actorId:actor.id,actorName:actor.name,actorRole:actor.role})
    return row
  },operationId,JSON.stringify([input,actor]))
}

export async function batchUpdatePmsMaterialPurchaseOrders(orderNos:string[],field:'buyerName'|'supplierName'|'purchaseRegion'|'remark'|'unitPrice'|'printingFactory'|'cuttingFactory'|'printingProcess'|'dyeFee'|'rejectedReason',value:string,actor:{id:string;name:string;role:PmsActorRole},operationId:string):Promise<PmsMaterialPurchaseOrder[]>{
 if(!orderNos.length || new Set(orderNos).size!==orderNos.length)throw new PmsDomainError('MPO_BATCH_EMPTY','选择采购单，同一采购单不能重复')
 if(!value.trim())throw new PmsDomainError('MPO_BATCH_VALUE','填写要设置的内容')
 if(['unitPrice','dyeFee'].includes(field)&&(!Number.isFinite(Number(value))||Number(value)<0))throw new PmsDomainError('MPO_PRICE_INVALID','金额须为非负数')
 return commitPurchase(()=>{const rows=orderNos.map(no=>getPmsMaterialPurchaseOrder(no));if(rows.some(row=>!row || row.pcsSource || row.tmfTipSource || getTmfMaterialPurchase(row.purchaseOrderNo) || ['已关闭','已入库'].includes(row.status)))throw new PmsDomainError('MPO_BATCH_LOCKED','全部所选采购单须可修改，已关闭、已入库或专项采购须单独处理')
  return (rows as PmsMaterialPurchaseOrder[]).map(row=>{const before=String(row[field] ?? '');Object.assign(row,{[field]:['unitPrice','dyeFee'].includes(field)?Number(value):value.trim()});if(field==='rejectedReason')row.remark=`采购驳回：${value.trim()}`;appendPmsLog({objectType:'material-purchase-order',objectId:row.purchaseOrderNo,action:field==='rejectedReason'?'驳回采购':'批量修改采购信息',beforeValue:before,afterValue:`${field==='unitPrice'?'实际采购单价':field==='dyeFee'?'染色费用':field} ${value}`,reason:field==='rejectedReason'?value:'',actorId:actor.id,actorName:actor.name,actorRole:actor.role,secondConfirmation:true});return row})
 },operationId,JSON.stringify([orderNos,field,value,actor]))
}
export async function batchPushPmsMaterialRequirements(entries:Array<{requirementNo:string;lines:PmsRequirementPushLineInput[]}>,actor:{id:string;name:string;role:PmsActorRole},operationId:string):Promise<PmsMaterialPurchaseOrder[]>{
 if(!entries.length || new Set(entries.map(row=>row.requirementNo)).size!==entries.length)throw new PmsDomainError('MREQ_BATCH_EMPTY','选择不重复的面辅料需求')
 await hydratePmsProductPurchaseOrdersFromIdb()
 return commitPurchase(()=>entries.flatMap(row=>preparePushPmsMaterialRequirement(row.requirementNo,row.lines,actor)),operationId,JSON.stringify([entries,actor]))
}

export interface PmsMaterialPurchaseInventoryPosting {id:string;sourcePurchaseOrderNo:string;materialCode:string;materialName:string;imageUrl:string;warehouse:string;qty:number;unit:string;postedAt:string;operator:string;sourceKind:'local-demo';quality?:'正常'|'瑕疵'}
/** Only explicit completed local inbound actions carry this posting; static status labels do not. */
export function listPmsMaterialPurchaseInventoryPostings():PmsMaterialPurchaseInventoryPosting[]{return listPmsMaterialPurchaseOrders().flatMap(order=>[order.inventoryPosting?{...structuredClone(order.inventoryPosting),quality:'正常' as const}:undefined,order.defectInventoryPosting?{...structuredClone(order.defectInventoryPosting),quality:'瑕疵' as const}:undefined].filter((row):row is PmsMaterialPurchaseInventoryPosting & {quality:'正常'|'瑕疵'}=>Boolean(row && row.qty>0)))}

export type PmsMpoDetailBarcode=NonNullable<PmsMaterialPurchaseOrder['detailBarcodes']>[number]
export async function saveMpoDetailBarcodes(orderNo:string,rows:PmsMpoDetailBarcode[],actor:{id:string;name:string;role:PmsActorRole},operationId:string):Promise<PmsMaterialPurchaseOrder>{
 return commitPurchase(()=>{const order=getPmsMaterialPurchaseOrder(orderNo);if(!order || order.pcsSource || order.tmfTipSource || getTmfMaterialPurchase(orderNo) || order.status==='已关闭')throw new PmsDomainError('MPO_BARCODE_LOCKED','当前来源不允许修改采购条码');if(new Set(rows.map(row=>row.code.trim())).size!==rows.length)throw new PmsDomainError('MPO_BARCODE_DUPLICATE','条码不能重复');for(const row of rows){if(!row.code.trim() || !Number.isFinite(row.quantity) || row.quantity<=0 || row.unit!==order.unit || !row.warehouse.trim() || !['有效','已下架'].includes(row.status))throw new PmsDomainError('MPO_BARCODE_INVALID','条码、仓库必填；数量须为正数且单位须与采购单相同');const old=order.detailBarcodes?.find(item=>item.code===row.code);if(row.createdAt && !Number.isFinite(Date.parse(row.createdAt)))throw new PmsDomainError('MPO_BARCODE_DATE','条码创建时间无效');if(old?.status==='已下架' && (row.status!=='已下架' || row.targetArea!==old.targetArea || row.movedAt!==old.movedAt || row.movedBy!==old.movedBy))throw new PmsDomainError('MPO_BARCODE_MOVED_LOCK','已下架条码的搬移动作不能覆盖或恢复');if(row.status==='已下架' && (!old || row.targetArea!=='待出库区' || !row.movedAt || !Number.isFinite(Date.parse(row.movedAt)) || !row.movedBy?.trim()))throw new PmsDomainError('MPO_BARCODE_MOVE_REQUIRED','选择有效条码并填写下架到待出库区的操作记录');if(listPmsMaterialPurchaseOrders().some(other=>other.purchaseOrderNo!==orderNo && other.detailBarcodes?.some(barcode=>barcode.code===row.code)))throw new PmsDomainError('MPO_BARCODE_DUPLICATE','条码已属于其它采购单')}
 const total=rows.reduce((sum,row)=>sum+row.quantity,0);if(total>order.orderedQty+0.000001)throw new PmsDomainError('MPO_BARCODE_OVER_QTY',`条码总数量 ${total} 不能超过采购数量 ${order.orderedQty} ${order.unit}`)
 const before=order.detailBarcodes || [];order.detailBarcodes=rows.map(row=>({...row,code:row.code.trim(),warehouse:row.warehouse.trim()}));appendPmsLog({objectType:'material-purchase-order',objectId:orderNo,action:'保存采购条码明细',beforeValue:`${before.length} 个条码`,afterValue:`${rows.length} 个条码 · ${total} ${order.unit}`,reason:'本地原型条码记录，不代表实际仓库上架',actorId:actor.id,actorName:actor.name,actorRole:actor.role,secondConfirmation:true});return order
 },operationId,JSON.stringify([orderNo,rows,actor]))
}
export async function addPmsMaterialPurchaseAttachment(orderNo:string,file:File,category:'物流凭证'|'附加图片',actor:{id:string;name:string;role:PmsActorRole},operationId:string):Promise<PmsMaterialPurchaseOrder>{
 if(!(file instanceof Blob)||!file.size||file.size>20*1024*1024||! /\.(png|jpe?g|webp|pdf)$/i.test(file.name))throw new PmsDomainError('MPO_FILE_INVALID','选择图片或PDF，大小须为1字节至20MB')
 const bytes=await file.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(value=>value.toString(16).padStart(2,'0')).join(''),fileId=`MPO-FILE:${operationId}`
 return commitPurchase(()=>{const order=getPmsMaterialPurchaseOrder(orderNo);if(!order || order.status==='已关闭')throw new PmsDomainError('MPO_FILE_LOCKED','当前采购单不能添加附件');order.attachments ||= [];if(!order.attachments.some(item=>item.fileId===fileId))order.attachments.push({fileId,name:file.name,type:file.type,size:file.size,category});appendPmsLog({objectType:'material-purchase-order',objectId:orderNo,action:`上传${category}`,beforeValue:'',afterValue:file.name,reason:'',actorId:actor.id,actorName:actor.name,actorRole:actor.role});return order},operationId,JSON.stringify([orderNo,category,file.name,file.type,file.size,hash,actor]),{attachments:[{id:fileId,name:file.name,type:file.type,size:file.size,blob:file}]})
}
export async function removePmsMaterialPurchaseAttachment(orderNo:string,fileId:string,actor:{id:string;name:string;role:PmsActorRole},operationId:string):Promise<PmsMaterialPurchaseOrder>{return commitPurchase(()=>{const order=getPmsMaterialPurchaseOrder(orderNo);const attachment=order?.attachments?.find(file=>file.fileId===fileId);if(!order || !attachment || order.status==='已关闭')throw new PmsDomainError('MPO_FILE_UNAVAILABLE','附件不存在或采购单已关闭');order.attachments=order.attachments!.filter(file=>file.fileId!==fileId);appendPmsLog({objectType:'material-purchase-order',objectId:orderNo,action:'删除采购附件',beforeValue:attachment.name,afterValue:'',reason:'',actorId:actor.id,actorName:actor.name,actorRole:actor.role,secondConfirmation:true});return order},operationId,JSON.stringify([orderNo,fileId,actor]),{attachmentDeletes:[fileId]})}
export async function readPmsMaterialPurchaseAttachment(fileId:string):Promise<Blob>{const row=await pmsGet<PmsAttachment>(PMS_STORES.pmsAttachments,fileId);if(!row?.blob)throw new PmsDomainError('MPO_FILE_MISSING','原文件不可读，重新上传');return row.blob}

export async function inspectPmsMaterialPurchaseOrder(orderNo:string,input:{sampleQty:number;qualifiedQty:number;defectQty:number;reason:string;warehouse:string;inspector:string;labelLength?:number;actualLength?:number},actor:{id:string;name:string;role:PmsActorRole},operationId:string):Promise<PmsMaterialPurchaseOrder>{
 return commitPurchase(()=>{
  const order=getPmsMaterialPurchaseOrder(orderNo)
  if(!order || !['部分到货','已到货'].includes(order.status) || order.inventoryPosting || order.pcsSource || order.tmfTipSource || getTmfMaterialPurchase(orderNo))throw new PmsDomainError('MPO_QC_LOCKED','已到货且尚未入库的普通采购单可以登记质检')
  if(!input.inspector.trim() || !Number.isFinite(input.sampleQty) || input.sampleQty<=0 || input.sampleQty>order.receivedQty || !Number.isFinite(input.qualifiedQty) || !Number.isFinite(input.defectQty) || input.qualifiedQty<0 || input.defectQty<0 || Math.abs(input.qualifiedQty+input.defectQty-input.sampleQty)>0.000001)throw new PmsDomainError('MPO_QC_QUANTITY','填写质检员；抽检数量须在实到数量内，合格与瑕疵数量之和须等于抽检数量')
  if(input.defectQty>0 && (!input.reason.trim() || !input.warehouse.trim() || input.warehouse.trim()===order.warehouse))throw new PmsDomainError('MPO_DEFECT_REQUIRED','发现瑕疵时填写原因，并选择与收货仓不同的瑕疵仓')
  if([input.labelLength,input.actualLength].some(value=>value!==undefined&&(!Number.isFinite(value)||value<0)))throw new PmsDomainError('MPO_QC_LENGTH','标签长度和实际长度须为非负数')
  if(input.actualLength!==undefined&&input.labelLength!==undefined&&input.labelLength===0&&input.actualLength>0)throw new PmsDomainError('MPO_QC_LENGTH','计算空差率需要大于0的标签长度')
  const before=order.inspection?`${order.inspection.sampleQty} ${order.unit}`:'未质检'
  order.inspection={...input,shortageRate:input.labelLength?Math.max(0,(input.labelLength-(input.actualLength||0))/input.labelLength*100):undefined,inspector:input.inspector.trim(),reason:input.reason.trim(),warehouse:input.warehouse.trim(),inspectedAt:new Date().toISOString()};order.inspector=input.inspector.trim();order.defectQty=input.defectQty;order.defectWarehouse=input.warehouse.trim();order.inspectionConclusion=input.defectQty?'发现瑕疵':'抽检合格'
  appendPmsLog({objectType:'material-purchase-order',objectId:orderNo,action:'登记采购质检',beforeValue:before,afterValue:`抽检 ${input.sampleQty}，合格 ${input.qualifiedQty}，瑕疵 ${input.defectQty} ${order.unit}`,reason:input.reason.trim(),actorId:actor.id,actorName:actor.name,actorRole:actor.role});return order
 },operationId,JSON.stringify([orderNo,input,actor]))
}
export async function updatePmsMaterialLogistics(recordNo:string,patch:Omit<PmsLogisticsImportRow,'purchaseOrderNo'>,actor:{id:string;name:string;role:PmsActorRole},operationId:string):Promise<PmsMaterialLogisticsRecord>{
 return commitPurchase(()=>{const row=getPmsMaterialLogisticsRecord(recordNo);if(!row || row.domesticSigned || row.headBatchNo)throw new PmsDomainError('MPO_LOGISTICS_LOCKED','已签收或加入头程的物流记录不能修改');const input={...patch,purchaseOrderNo:row.purchaseOrderNo};const error=validatePmsLogisticsImportRow(input,new Set(listPmsMaterialLogisticsRecords().filter(item=>item.recordNo!==recordNo).map(item=>item.trackingNo)),new Set());if(error)throw new PmsDomainError('MPO_LOGISTICS_INVALID',error);const order=getPmsMaterialPurchaseOrder(row.purchaseOrderNo)!;if(listPmsMaterialLogisticsRecords().filter(item=>item.recordNo!==recordNo && item.purchaseOrderNo===row.purchaseOrderNo).reduce((sum,item)=>sum+item.qty,0)+input.qty>order.orderedQty)throw new PmsDomainError('MPO_LOGISTICS_OVER','累计物流数量不能超过采购数量');const before=`${row.trackingNo} · ${row.qty} ${row.unit}`;Object.assign(row,input);appendPmsLog({objectType:'material-purchase-order',objectId:row.purchaseOrderNo,action:'修改采购物流信息',beforeValue:before,afterValue:`${row.trackingNo} · ${row.qty} ${row.unit}`,reason:'',actorId:actor.id,actorName:actor.name,actorRole:actor.role});return row},operationId,JSON.stringify([recordNo,patch,actor]))
}

export async function registerAndInboundPmsMaterialPurchases(entries:Array<{purchaseOrderNo:string;materialCode:string;quantity:number}>,actor:{id:string;name:string;role:PmsActorRole},operationId:string):Promise<PmsMaterialPurchaseOrder[]>{
 if(!entries.length||new Set(entries.map(row=>row.purchaseOrderNo)).size!==entries.length)throw new PmsDomainError('MPO_INBOUND_DUPLICATE','选择不重复的采购单')
 return commitPurchase(()=>entries.map(entry=>{const order=getPmsMaterialPurchaseOrder(entry.purchaseOrderNo);if(!order||order.materialCode!==entry.materialCode)throw new PmsDomainError('MPO_INBOUND_SKU','采购单和SKU须一致');prepareRegisterPmsMaterialPurchaseArrival(entry.purchaseOrderNo,entry.quantity,actor);return prepareAdvancePmsMaterialPurchaseOrderStatus(entry.purchaseOrderNo,'已入库',actor)}),operationId,JSON.stringify([entries,actor]))
}

export async function convertPmsMaterialPurchaseToRaw(orderNo:string,actor:{id:string;name:string;role:PmsActorRole},operationId:string):Promise<PmsMaterialPurchaseOrder>{
 return commitPurchase(()=>{const order=getPmsMaterialPurchaseOrder(orderNo);if(!order||order.pcsSource||order.tmfTipSource||getTmfMaterialPurchase(orderNo)||['已关闭','已入库'].includes(order.status)||order.materialType==='样衣'||order.materialType==='原料')throw new PmsDomainError('MPO_RAW_LOCKED','选择未关闭、未全部入库的普通物料采购单');const before=order.materialType;order.materialType='原料';appendPmsLog({objectType:'material-purchase-order',objectId:orderNo,action:'转原料采购',beforeValue:before,afterValue:'原料',reason:'保留原SKU、单位和数量；仅调整本地采购分类，不改变物料档案或实际仓库',actorId:actor.id,actorName:actor.name,actorRole:actor.role,secondConfirmation:true});return order},operationId,JSON.stringify([orderNo,actor]))
}

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
import { pmsBusinessNumber } from '../../utils/pms-business-number.ts'
import {
  getTmfPurchaseState, listTmfSupplyPurchaseProjections, listTmfMaterialPurchases, getTmfMaterialPurchase, releaseTmfMaterialPurchase,
  confirmTmfPurchaseSupplier, reviseTmfMaterialPurchase, cancelTmfMaterialPurchaseAfterDisposition, type TmfPurchaseActor,
} from './tmf-material-purchases.ts'
import { assertTmfTipMaterialMaster } from './tmf-master-registry.ts'
import { getPmsMaterialPurchaseOrderLines, findPmsMaterialPurchaseOrderLine, pmsMaterialPurchaseBarcodeLimit, pmsMaterialPurchaseSellerArrivalStatus, syncPmsMaterialPurchaseLineProjection, type PmsMaterialPurchaseOrderLine } from './material-purchase-lines.ts'
export { getPmsMaterialPurchaseOrderLines, findPmsMaterialPurchaseOrderLine, pmsMaterialPurchaseOrderAmount, pmsMaterialPurchaseQuantityGroups, pmsMaterialPurchaseBarcodeLimit, pmsMaterialPurchaseSellerArrivalStatus, type PmsMaterialPurchaseOrderLine } from './material-purchase-lines.ts'

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
  /** Present only on the new multi-SKU contract; legacy fields are derived display values. */
  lines?: PmsMaterialPurchaseOrderLine[]
  materialSpu?: string
  plannedRolls?: number
  actualPurchasedQty?: number
  actualPurchasedRolls?:number
  sellerReceivedQty?: number
  orderPlacementStatus?: '待下单' | '已下单' | '驳回'
  priceConfirmedAt?: string
  inventoryPostings?: PmsMaterialPurchaseInventoryPosting[]
  sourceCopyOrderNo?: string
  updatedAt?: string
  lastOperationId?: string
  inspections?:Array<PmsMaterialPurchaseInspection & {purchaseLineId:string}>
  transferVouchers?:Array<{voucherId:string;transferDate:string;transferFee:number;fileIds:string[];operator:string;createdAt:string}>
  defectDisposals?:Array<{purchaseLineId:string;defectQty:number;defectRolls:number;warehouseRolls:number;moveToDefectWarehouse:boolean;warehouse:string;remark:string;operator:string;recordedAt:string}>
  _pmsBaseVersion?: number
  inventoryPosting?:PmsMaterialPurchaseInventoryPosting
  defectInventoryPosting?:PmsMaterialPurchaseInventoryPosting
  priceConfirmed?:boolean
  isStockProduction?:boolean
  purchasedAt?:string
  arrivedAt?:string
  inspection?:PmsMaterialPurchaseInspection
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
  detailBarcodes?:Array<{purchaseLineId?:string;materialCode?:string;code:string;quantity:number;unit:string;warehouse:string;status:'有效'|'已下架';createdAt?:string;printedAt?:string;printedBy?:string;targetArea?:'待出库区';movedAt?:string;movedBy?:string}>
  attachments?:Array<{fileId:string;name:string;type:string;size:number;category:'物流凭证'|'附加图片';transferDate?:string;transferFee?:number;purchaseLineId?:string;purpose?:'采购抽检'}>
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
export interface PmsMaterialPurchaseInspection {
  sampleQty:number
  qualifiedQty:number
  defectQty:number
  reason:string
  warehouse:string
  inspector:string
  inspectedAt:string
  labelLength?:number
  actualLength?:number
  shortageRate?:number
  conclusion?:'合格'|'不合格'|'部分合格'
  remark?:string
  photoFileIds?:string[]
}

export interface PmsLogisticsImportRow {
  purchaseLineId?:string
  materialCode?:string
  actualPurchasedQty?:number
  actualPurchasedRolls?:number
  unitPrice?:number
  currency?:'RMB'|'IDR'|'USD'
  quantityUnit?:string
  packagingUnit?:string
  metersPerRoll?:number
  unitWeightKg?:number
  unitVolumeM3?:number
  freightChannel?:string
  volumeM3?:number
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
  kind?:'add'|'supplement'
  deleted?:true
  deletedAt?:string
  deletedBy?:string
  updatedAt?:string
  lastOperationId?:string
  inboundQty?:number
  inboundWarehouse?:string
  inboundAt?:string
  inboundBy?:string
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
  const line=resolveLogisticsPurchaseLine(order,input)
  return {
    ...input,
    recordNo,
    purchaseOrderNo: order.purchaseOrderNo,
    purchaseLineId:line.lineId,
    materialCode: line.materialCode,
    materialName: line.materialName,
    materialImageUrl: line.imageUrl,
    unit: line.unit,
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
type PurchaseActor={id:string;name:string;role:PmsActorRole}
function assertPurchaseActor(actor:PurchaseActor):void {
  if(!actor.id.trim() || !actor.name.trim() || !['采购员','采购主管'].includes(actor.role))throw new PmsDomainError('MPO_ROLE_BLOCKED','当前角色不能维护采购单')
}
/** Repeated explicit actions return committed records before state guards or new writes. */
async function readPurchaseActionReplay(operationId:string,signature:string):Promise<PmsMaterialPurchaseOrder[]|undefined> {
  if(!operationId.trim())throw new PmsDomainError('MPO_OPERATION_REQUIRED','重新打开表单后提交')
  await hydratePmsMaterialPurchaseOrdersFromIdb()
  const receipt=await pmsGet<{signature:string}>(PMS_STORES.pmsCommittedOperations,operationId)
  if(!receipt)return undefined
  const saved=JSON.parse(receipt.signature) as {input:string;keys:Array<[Parameters<typeof pmsGet>[0],string]>}
  if(saved.input!==signature)throw new PmsDomainError('PMS_IDB_OPERATION_CONFLICT','此提交已保存其他内容，重新打开表单后重试')
  const rows=await Promise.all(saved.keys.filter(([store])=>store===PMS_STORES.pmsMaterialPurchaseOrderDeltas).map(([,key])=>pmsGet<PmsMaterialPurchaseOrder>(PMS_STORES.pmsMaterialPurchaseOrderDeltas,key)))
  if(!rows.length || rows.some(row=>!row))throw new PmsDomainError('MPO_REPLAY_MISSING','原采购记录不可读，重新打开列表核对')
  publishPmsMaterialPurchaseOrders(rows as PmsMaterialPurchaseOrder[])
  return rows as PmsMaterialPurchaseOrder[]
}
function editableOrdinaryPurchase(orderNo:string,actor:PurchaseActor,allowCompletedPriceEdit=false):PmsMaterialPurchaseOrder {
  assertPurchaseActor(actor)
  const row=getPmsMaterialPurchaseOrder(orderNo)
  if(!row || row.pcsSource || row.tmfTipSource || isTmfPurchaseOwner(orderNo) || row.status==='已关闭' || row.status==='已入库'&&!allowCompletedPriceEdit)throw new PmsDomainError('MPO_EDIT_LOCKED','当前状态或来源不允许此操作；专项来源须通过对应入口维护')
  return row
}
function logPurchaseEdit(row:PmsMaterialPurchaseOrder,action:string,beforeValue:string,afterValue:string,actor:PurchaseActor,reason=''):void {
  row.lastOperationId=preparingPurchase?.operationId
  appendPmsLog({objectType:'material-purchase-order',objectId:row.purchaseOrderNo,action,beforeValue,afterValue,reason,actorId:actor.id,actorName:actor.name,actorRole:actor.role,secondConfirmation:true})
}
async function readLogisticsActionReplay(operationId:string,signature:string):Promise<PmsMaterialLogisticsRecord[]|undefined> {
  if(!operationId.trim())throw new PmsDomainError('MPO_OPERATION_REQUIRED','重新打开表单后提交')
  await hydratePmsMaterialPurchaseOrdersFromIdb()
  const receipt=await pmsGet<{signature:string}>(PMS_STORES.pmsCommittedOperations,operationId)
  if(!receipt)return undefined
  const saved=JSON.parse(receipt.signature) as {input:string;keys:Array<[Parameters<typeof pmsGet>[0],string]>}
  if(saved.input!==signature)throw new PmsDomainError('PMS_IDB_OPERATION_CONFLICT','此提交已保存其他内容，重新打开表单后重试')
  const rows=await Promise.all(saved.keys.filter(([store])=>store===PMS_STORES.pmsPurchaseTracking).map(([,key])=>pmsGet<PmsMaterialLogisticsRecord>(PMS_STORES.pmsPurchaseTracking,key)))
  if(!rows.length || rows.some(row=>!row))throw new PmsDomainError('MPO_REPLAY_MISSING','原物流记录不可读，重新打开列表核对')
  publishPmsMaterialLogisticsRecords(rows as PmsMaterialLogisticsRecord[])
  const orders=await Promise.all(saved.keys.filter(([store])=>store===PMS_STORES.pmsMaterialPurchaseOrderDeltas).map(([,key])=>pmsGet<PmsMaterialPurchaseOrder>(PMS_STORES.pmsMaterialPurchaseOrderDeltas,key)))
  if(orders.some(order=>!order))throw new PmsDomainError('MPO_REPLAY_MISSING','物流关联采购记录不可读，重新打开列表核对')
  publishPmsMaterialPurchaseOrders(orders as PmsMaterialPurchaseOrder[])
  return rows as PmsMaterialLogisticsRecord[]
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
  for(const row of logistics){const prepared=draft.logisticsRecords.find(item=>item.recordNo===row.recordNo);if(prepared)Object.assign(prepared,row)}
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
  const exact=pcsPurchaseDrafts.get(purchaseOrderNo) ?? listTmfSupplyPurchaseProjections().find(o=>o.purchaseOrderNo===purchaseOrderNo) ?? getRuntime().orders.find((order) => order.purchaseOrderNo === purchaseOrderNo) ?? getTmfMaterialPurchase(purchaseOrderNo)
  if(exact)return exact
  const matches=getRuntime().orders.filter(order=>!order.pcsSource&&!order.tmfTipSource&&!isTmfPurchaseOwner(order.purchaseOrderNo)&&pmsBusinessNumber(order.purchaseOrderNo)===purchaseOrderNo)
  return matches.length===1?matches[0]:undefined
}

export function listPmsMaterialLogisticsRecords(): PmsMaterialLogisticsRecord[] {
  return getRuntime().logisticsRecords.filter(row=>!row.deleted)
}

export function getPmsMaterialLogisticsRecord(recordNo: string): PmsMaterialLogisticsRecord | undefined {
  return getRuntime().logisticsRecords.find((record) => record.recordNo === recordNo && !record.deleted)
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

function resolveLogisticsPurchaseLine(order:PmsMaterialPurchaseOrder,input:{purchaseLineId?:string;materialCode?:string}):PmsMaterialPurchaseOrderLine {
 const lines=getPmsMaterialPurchaseOrderLines(order),line=input.purchaseLineId?lines.find(item=>item.lineId===input.purchaseLineId):input.materialCode?lines.find(item=>item.materialCode===input.materialCode):lines.length===1?lines[0]:undefined
 if(!line || input.materialCode && input.materialCode!==line.materialCode)throw new PmsDomainError('MPO_LOGISTICS_SKU','多SKU采购的每条物流须明确归属于本单SKU')
 return line
}
export function pmsMaterialLogisticsIdentity(row:{purchaseOrderNo:string;purchaseLineId?:string;materialCode?:string;trackingNo:string}):string {
 const order=getPmsMaterialPurchaseOrder(row.purchaseOrderNo.trim())
 const line=order?resolveLogisticsPurchaseLine(order,row):undefined
 return JSON.stringify([row.purchaseOrderNo.trim(),line?.lineId||row.purchaseLineId||row.materialCode||'',row.trackingNo.trim()])
}
function logisticsPhysicalLimit(order:PmsMaterialPurchaseOrder,line:PmsMaterialPurchaseOrderLine):number|undefined {
 return line.actualPurchasedQty>0?line.actualPurchasedQty:line.legacy?line.orderedQty:undefined
}
export function validatePmsLogisticsImportRow(row:PmsLogisticsImportRow,existingTrackingNos:Set<string>,seenTrackingNos:Set<string>):string {
 for(const key of ['lengthCm','widthCm','heightCm','weightKg','volumeM3','estimatedTransferDays','metersPerRoll','unitWeightKg','unitVolumeM3'] as const)if(row[key]!==undefined&&(!Number.isFinite(row[key])||row[key]!<0))return '尺寸、重量、单卷米数及预计转运天数须为非负数'
 if(row.transportMethod&&!['快递','自提','货拉拉','海运','空运'].includes(row.transportMethod))return '选择有效货运方式'
 if(!row.purchaseOrderNo.trim())return '缺少采购单号'
 const purchase=getPmsMaterialPurchaseOrder(row.purchaseOrderNo.trim())
 if(!purchase)return `采购单 ${row.purchaseOrderNo} 不存在`
 if(purchase.pcsSource&&purchase.status==='草稿')return '采购草稿尚未下达，不能导入物流。'
 let line:PmsMaterialPurchaseOrderLine
 try{line=resolveLogisticsPurchaseLine(purchase,row)}catch(error){return error instanceof Error?error.message:'选择物流归属SKU'}
 if(row.quantityUnit!==undefined && row.quantityUnit!==line.unit)return '数量单位须与采购SKU一致，不支持自由换算'
 if(row.actualPurchasedQty!==undefined&&(!Number.isFinite(row.actualPurchasedQty)||row.actualPurchasedQty<row.qty))return '实际采购量须为非负数且不能少于本次装运量'
 if(row.actualPurchasedRolls!==undefined&&(!Number.isInteger(row.actualPurchasedRolls)||row.actualPurchasedRolls<0))return '实际采购卷数须为非负整数'
 if(row.unitPrice!==undefined&&(!Number.isFinite(row.unitPrice)||row.unitPrice<0))return '实际采购价须为非负数'
 if(row.currency!==undefined&&row.currency!==purchase.currency)return '采购币种须与所属采购单一致，不能通过物流更换币种'
 if(!row.company.trim())return '缺少物流公司'
 if(!row.trackingNo.trim())return '缺少物流单号'
 const key=pmsMaterialLogisticsIdentity(row)
 if(existingTrackingNos.has(key)||seenTrackingNos.has(key)||line.legacy&&(existingTrackingNos.has(row.trackingNo.trim())||seenTrackingNos.has(row.trackingNo.trim())))return `采购单和SKU的物流单号 ${row.trackingNo} 已存在`
 if(row.shipDate&&!DATE_PATTERN.test(row.shipDate))return '发货日期格式应为 YYYY-MM-DD'
 if(row.estimatedArrival&&!DATE_PATTERN.test(row.estimatedArrival))return '预计到达日期格式应为 YYYY-MM-DD'
 if(!Number.isInteger(row.boxCount)||row.boxCount<0)return '箱数必须是非负整数'
 if(!Number.isInteger(row.rolls)||row.rolls<0)return '卷数必须是非负整数'
 if(!Number.isFinite(row.qty)||row.qty<=0)return '物流数量必须大于 0'
 const limit=logisticsPhysicalLimit(purchase,line)
 if(limit!==undefined&&row.qty>limit)return `物流数量不能超过${line.actualPurchasedQty>0?'实际采购量':'采购数量'} ${limit} ${line.unit}`
 if(row.shipDate&&!Number.isFinite(Date.parse(row.shipDate))||row.estimatedArrival&&!Number.isFinite(Date.parse(row.estimatedArrival)))return '填写有效日期'
 if(row.shipDate&&row.estimatedArrival&&row.estimatedArrival<row.shipDate)return '预计到达日期不能早于发货日期'
 if(!Number.isFinite(row.fee)||row.fee<0)return '运费不能为负数'
 return ''
}
function assertLogisticsTotals(records:PmsMaterialLogisticsRecord[]):void {
 const totals=new Map<string,{order:PmsMaterialPurchaseOrder;line:PmsMaterialPurchaseOrderLine;qty:number}>()
 for(const record of records.filter(row=>!row.deleted)){
  const order=getPmsMaterialPurchaseOrder(record.purchaseOrderNo);if(!order)throw new PmsDomainError('MPO_NOT_FOUND','采购单不存在')
  const line=resolveLogisticsPurchaseLine(order,record),key=JSON.stringify([order.purchaseOrderNo,line.lineId]),row=totals.get(key)||{order,line,qty:0}
  row.qty+=record.qty;totals.set(key,row)
 }
 for(const {order,line,qty} of totals.values()){
  const limit=logisticsPhysicalLimit(order,line)
  if(limit!==undefined&&qty>limit+0.000001)throw new PmsDomainError('LOGISTICS_IMPORT_OVER_QTY',`${order.purchaseOrderNo} ${line.materialCode} 累计物流数量 ${qty} 超过${line.actualPurchasedQty>0?'实际采购量':'采购数量'} ${limit} ${line.unit}`)
 }
}
function applyLogisticsPurchaseFacts(order:PmsMaterialPurchaseOrder,input:PmsLogisticsImportRow,actor:PurchaseActor):void {
 if([input.actualPurchasedQty,input.actualPurchasedRolls,input.unitPrice,input.currency,input.quantityUnit,input.unitWeightKg,input.unitVolumeM3].every(value=>value===undefined))return
 editableOrdinaryPurchase(order.purchaseOrderNo,actor)
 const lines=getPmsMaterialPurchaseOrderLines(order),line=resolveLogisticsPurchaseLine(order,input),target=lines.find(row=>row.lineId===line.lineId)!,before=JSON.stringify(target)
 if(input.quantityUnit!==undefined&&input.quantityUnit!==line.unit)throw new PmsDomainError('MPO_LOGISTICS_UNIT','数量单位须与采购SKU一致，不支持自由换算')
 if(input.currency!==undefined&&input.currency!==order.currency)throw new PmsDomainError('MPO_LOGISTICS_CURRENCY','采购币种须与所属采购单一致，不能通过物流更换币种')
 if(input.actualPurchasedQty!==undefined){
  const barcodeQty=(order.detailBarcodes||[]).filter(row=>row.purchaseLineId===line.lineId||!row.purchaseLineId&&(row.materialCode===line.materialCode||lines.length===1)).reduce((sum,row)=>sum+row.quantity,0)
  if(!Number.isFinite(input.actualPurchasedQty)||input.actualPurchasedQty<Math.max(input.qty,line.inboundQty,line.sellerReceivedQty,barcodeQty))throw new PmsDomainError('MPO_ACTUAL_REDUCE','实际采购量不能少于装运、商家到货、入库或细码数量')
  target.actualPurchasedQty=input.actualPurchasedQty
 }
 if(input.actualPurchasedRolls!==undefined){if(!Number.isInteger(input.actualPurchasedRolls)||input.actualPurchasedRolls<0)throw new PmsDomainError('MPO_ROLLS_INVALID','实际采购卷数须为非负整数');target.actualPurchasedRolls=input.actualPurchasedRolls}
 if(input.unitPrice!==undefined){if(!Number.isFinite(input.unitPrice)||input.unitPrice<0)throw new PmsDomainError('MPO_PRICE_INVALID','实际采购价须为非负数');target.unitPrice=input.unitPrice;target.priceConfirmed=true}
 for(const [inputKey,lineKey] of [['unitWeightKg','weightKg'],['unitVolumeM3','volumeM3']] as const)if(input[inputKey]!==undefined){if(!Number.isFinite(input[inputKey])||input[inputKey]!<0)throw new PmsDomainError('MPO_SIZE_INVALID','单位重量和体积须为非负数');target[lineKey]=input[inputKey]}
 order.lines=lines;order.updatedAt=new Date().toISOString();syncPmsMaterialPurchaseLineProjection(order);if(input.unitPrice!==undefined)order.priceConfirmedAt=order.priceConfirmed?order.updatedAt:undefined
 logPurchaseEdit(order,'物流录入实际采购信息',before,JSON.stringify(target),actor)
}
function prepareImportPmsMaterialLogistics(rows:PmsLogisticsImportRow[],actor:PurchaseActor,mode:'add'|'supplement'='add'):PmsMaterialLogisticsRecord[] {
 if(!rows.length)throw new PmsDomainError('LOGISTICS_IMPORT_EMPTY','填写物流明细')
 const active=listPmsMaterialLogisticsRecords(),existing=new Set(active.map(row=>pmsMaterialLogisticsIdentity(row))),seen=new Set<string>(),imported:PmsMaterialLogisticsRecord[]=[]
 const factSignatures=new Map<string,string>()
 for(const row of rows){
  const order=getPmsMaterialPurchaseOrder(row.purchaseOrderNo.trim());if(!order)throw new PmsDomainError('MPO_NOT_FOUND','采购单不存在')
  if([row.actualPurchasedQty,row.actualPurchasedRolls,row.unitPrice,row.currency,row.quantityUnit,row.unitWeightKg,row.unitVolumeM3].some(value=>value!==undefined)){
   const key=JSON.stringify([order.purchaseOrderNo,resolveLogisticsPurchaseLine(order,row).lineId]),signature=JSON.stringify([row.actualPurchasedQty,row.actualPurchasedRolls,row.unitPrice,row.currency,row.quantityUnit,row.unitWeightKg,row.unitVolumeM3])
   if(factSignatures.has(key)&&factSignatures.get(key)!==signature)throw new PmsDomainError('MPO_LOGISTICS_FACT_CONFLICT','同一SKU的实际采购量、卷数、价格或币种在本次录入中不一致')
   if(!factSignatures.has(key))applyLogisticsPurchaseFacts(order,row,actor)
   factSignatures.set(key,signature)
  }
 }
 for(const row of rows){const error=validatePmsLogisticsImportRow(row,mode==='add'?existing:new Set(),mode==='add'?seen:new Set());if(error)throw new PmsDomainError('LOGISTICS_IMPORT_INVALID',error);seen.add(pmsMaterialLogisticsIdentity(row))}
 rows.forEach((row,index)=>{
  const order=getPmsMaterialPurchaseOrder(row.purchaseOrderNo.trim())!,record=buildLogisticsRecord(`LOG-${preparingPurchase!.operationId}-${index+1}`,order,{...row,purchaseOrderNo:order.purchaseOrderNo,company:row.company.trim(),trackingNo:row.trackingNo.trim()})
  record.kind=mode;record.updatedAt=new Date().toISOString();record.lastOperationId=preparingPurchase!.operationId
  imported.push(record)
  appendPmsLog({objectType:'material-purchase-order',objectId:order.purchaseOrderNo,action:mode==='supplement'?'补录采购物流':'添加采购物流',beforeValue:'',afterValue:`${record.materialCode} · ${record.company} ${record.trackingNo} · ${record.qty} ${record.unit}`,reason:record.remark,actorId:actor.id,actorName:actor.name,actorRole:actor.role})
 })
 assertLogisticsTotals([...active,...imported])
 getRuntime().logisticsRecords.unshift(...imported)
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
  if(order.lines && order.lines.length>1)throw new PmsDomainError('MPO_LINE_REQUIRED','多SKU采购须按明细登记商家到货，不能填写一项主单总数')
  if (order.status === '已关闭' || order.status==='已入库') throw new PmsDomainError('MPO_CLOSED_BLOCKED', '已关闭或全部入库的采购单不能登记到货')
  if (order.status === '待采购') throw new PmsDomainError('MPO_NOT_PURCHASED', '请先标记已采购后再登记到货')
  if (!Number.isFinite(receivedQty) || receivedQty <= 0) throw new PmsDomainError('MPO_RECEIVED_QTY_INVALID', '到货数量必须大于 0')
  const limit=order.lines?.[0]?.actualPurchasedQty || order.orderedQty
  if (receivedQty > limit) throw new PmsDomainError('MPO_RECEIVED_OVER', `到货数量不能超过${order.lines?.[0]?.actualPurchasedQty?'实际采购量':'采购数量'} ${limit} ${order.unit}`)
  const before = `${order.receivedQty} ${order.unit} · ${order.status}`
  const actualQty = roundPmsQty(receivedQty, 2)
  const postedQty=(order.inventoryPosting?.qty||0)+(order.defectInventoryPosting?.qty||0)
  if(actualQty<Math.max(order.receivedQty,postedQty))throw new PmsDomainError('MPO_RECEIVED_REDUCE','累计到货数量不能少于已登记的到货或入库数量')
  order.arrivedAt=new Date().toISOString()
  if(order.lines?.length===1)order.lines[0].sellerReceivedQty=actualQty
  savePurchaseUpdate(order, { receivedQty: actualQty, sellerReceivedQty:actualQty, status: actualQty >= limit ? '已到货' : '部分到货' });syncPmsMaterialPurchaseLineProjection(order)
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
  if(order.lines && order.lines.length>1 && nextStatus!=='已采购' && nextStatus!=='已关闭')throw new PmsDomainError('MPO_LINE_REQUIRED','多SKU采购须按明细登记到货和入库')
  const arrivalTarget=order.lines?.[0]?.actualPurchasedQty || order.orderedQty
  if (!MPO_STATUS_TRANSITIONS[order.status].includes(nextStatus)) {
    throw new PmsDomainError('MPO_TRANSITION_BLOCKED', `${order.status} 不能直接流转到 ${nextStatus}`)
  }
  if (nextStatus === '已入库' && order.receivedQty <= 0) {
    throw new PmsDomainError('MPO_RECEIVE_REQUIRED', '请先登记到货数量再入库')
  }
  if(nextStatus==='部分到货' && !(order.receivedQty>0 && order.receivedQty<arrivalTarget))throw new PmsDomainError('MPO_PARTIAL_FACT_REQUIRED','部分到货需要已登记的实到数量大于0且小于采购数量')
  if(nextStatus==='已到货' && order.receivedQty<arrivalTarget)throw new PmsDomainError('MPO_ARRIVAL_FACT_REQUIRED','全部到货需要已登记的累计实到数量达到采购数量')
  const before = order.status
  let resultStatus=nextStatus
  if(nextStatus==='已采购'){order.purchasedAt=new Date().toISOString();order.orderPlacementStatus='已下单'}
  if(nextStatus==='已入库'){
    if(!order.warehouse.trim() || !order.materialImageUrl)throw new PmsDomainError('MPO_INVENTORY_SOURCE','入库需要收货仓和对应物料图片')
    const previous=(order.inventoryPosting?.qty||0)+(order.defectInventoryPosting?.qty||0)
    if(order.receivedQty<=previous)throw new PmsDomainError('MPO_INBOUND_NO_REMAINDER','当前实到数量已经登记入库，先登记新增到货数量')
    const defect=order.inspection?.defectQty||0,postedAt=new Date().toISOString()
    const posting={sourcePurchaseOrderNo:order.purchaseOrderNo,materialCode:order.materialCode,materialName:order.materialName,imageUrl:order.materialImageUrl,unit:order.unit,postedAt,operator:actor.name,sourceKind:'local-demo' as const}
    order.inventoryPosting={...posting,quality:'正常',id:`MPO-IN:${order.purchaseOrderNo}`,warehouse:order.warehouse,qty:order.receivedQty-defect}
    if(defect)order.defectInventoryPosting={...posting,quality:'瑕疵',id:`MPO-DEFECT:${order.purchaseOrderNo}`,warehouse:order.inspection!.warehouse,qty:defect}
    if(order.lines?.length===1)order.lines[0].inboundQty=order.receivedQty
    resultStatus=order.receivedQty>=arrivalTarget?'已入库':'部分到货'
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

export async function importPmsMaterialLogistics(rows:PmsLogisticsImportRow[],actor:PurchaseActor,operationId:string=crypto.randomUUID()):Promise<PmsMaterialLogisticsRecord[]> {
 const signature=JSON.stringify([rows,actor]),replay=await readLogisticsActionReplay(operationId,signature)
 if(replay)return replay
 return commitPurchase(()=>prepareImportPmsMaterialLogistics(rows,actor),operationId,signature)
}
export async function batchAddPmsMaterialLogistics(rows:PmsLogisticsImportRow[],mode:'add'|'supplement',actor:PurchaseActor,operationId:string):Promise<PmsMaterialLogisticsRecord[]> {
 const signature=JSON.stringify([rows,mode,actor]),replay=await readLogisticsActionReplay(operationId,signature);if(replay)return replay
 assertPurchaseActor(actor)
 if(!['add','supplement'].includes(mode))throw new PmsDomainError('LOGISTICS_MODE_INVALID','选择添加或补录物流')
 return commitPurchase(()=>prepareImportPmsMaterialLogistics(rows,actor,mode),operationId,signature)
}
export async function deletePmsMaterialLogistics(recordNo:string,actor:PurchaseActor,operationId:string):Promise<PmsMaterialLogisticsRecord> {
 const signature=JSON.stringify([recordNo,actor]),replay=await readLogisticsActionReplay(operationId,signature);if(replay)return replay[0]
 assertPurchaseActor(actor)
 return commitPurchase(()=>{
  const row=getPmsMaterialLogisticsRecord(recordNo)
  if(!row || row.domesticSigned || row.headBatchNo || row.headLogisticsQty>0 || row.headSigned || (row.inboundQty||0)>0)throw new PmsDomainError('LOGISTICS_DELETE_LOCKED','已签收、加入头程或入库的物流不能删除')
  row.deleted=true;row.deletedAt=new Date().toISOString();row.deletedBy=actor.name;row.lastOperationId=operationId
  appendPmsLog({objectType:'material-purchase-order',objectId:row.purchaseOrderNo,action:'删除采购物流',beforeValue:`${row.materialCode} ${row.trackingNo} · ${row.qty} ${row.unit}`,afterValue:'已删除',reason:'',actorId:actor.id,actorName:actor.name,actorRole:actor.role,secondConfirmation:true})
  return row
 },operationId,signature)
}

export async function signPmsMaterialLogistics(recordNos:string[],stage:'domestic'|'head',actor:{id:string;name:string;role:PmsActorRole},operationId:string=crypto.randomUUID(),input?:{company:string;signedDate:string}):Promise<PmsMaterialLogisticsRecord[]>{
 return commitPurchase(()=>prepareSignPmsMaterialLogistics(recordNos,stage,actor,input),operationId,JSON.stringify([recordNos,stage,actor,input]))
}

export function isTmfPurchaseOwner(orderNo:string):boolean{return !!getTmfMaterialPurchase(orderNo)||listTmfSupplyPurchaseProjections().some(row=>row.purchaseOrderNo===orderNo)}
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

export type PmsMaterialPurchaseOrderEditPatch=Partial<Pick<PmsMaterialPurchaseOrder,'orderedQty'|'unitPrice'|'currency'|'weightKg'|'volumeM3'|'dyeFee'|'usageType'|'purchaseRegion'|'buyerName'|'supplierName'|'factoryName'|'remark'|'expectedArrivalDate'|'inspector'|'inspectionConclusion'|'warehouse'|'supplementReason'|'dedicatedSpu'|'isStockProduction'>> & {linePatches?:PmsMaterialPurchaseLinePatch[];expectedVersion?:number}
export async function updatePmsMaterialPurchaseOrder(orderNo:string,patch:PmsMaterialPurchaseOrderEditPatch,actor:{id:string;name:string;role:PmsActorRole},operationId:string):Promise<PmsMaterialPurchaseOrder> {
 const signature=JSON.stringify([orderNo,patch,actor]),replay=await readPurchaseActionReplay(operationId,signature);if(replay)return replay[0]
 return commitPurchase(()=>{
  assertPurchaseActor(actor)
  const order=getPmsMaterialPurchaseOrder(orderNo)
  if(!order || order.status==='已关闭' || order.status==='已入库' || order.pcsSource || order.tmfTipSource || isTmfPurchaseOwner(orderNo)) throw new PmsDomainError('MPO_EDIT_LOCKED','当前采购单不允许修改')
  for(const key of ['orderedQty','unitPrice','weightKg','volumeM3','dyeFee'] as const) if(patch[key]!==undefined && (!Number.isFinite(patch[key]) || patch[key]!<0)) throw new PmsDomainError('MPO_VALUE_INVALID','数量、费用及尺寸须为非负数')
  if(patch.orderedQty!==undefined && (patch.orderedQty<=0 || patch.orderedQty<order.receivedQty)) throw new PmsDomainError('MPO_QUANTITY_BLOCKED','采购数量须大于0且不能低于已收货数量')
  if(patch.currency && !['RMB','USD','IDR'].includes(patch.currency)) throw new PmsDomainError('MPO_CURRENCY_INVALID','选择有效币种')
  if(order.lines?.length){
    if(order.lines.length>1 && ['orderedQty','unitPrice','weightKg','volumeM3'].some(key=>key in patch))throw new PmsDomainError('MPO_LINE_REQUIRED','多SKU采购须按明细修改数量、单价、重量和体积')
    if(order.lines.length===1){const line=order.lines[0];for(const key of ['orderedQty','unitPrice','weightKg','volumeM3'] as const)if(patch[key]!==undefined)line[key]=patch[key]!;if(patch.unitPrice!==undefined)line.priceConfirmed=false}
  }
  if(patch.unitPrice!==undefined){order.priceConfirmed=false;order.priceConfirmedAt=undefined}
  if(patch.expectedVersion!==undefined && patch.expectedVersion!==(order._pmsBaseVersion||0))throw new PmsDomainError('PMS_IDB_VERSION_CONFLICT','此记录已在其他页面修改，重新读取后重试')
  if(patch.linePatches)applyPurchaseLinePatches(order,patch.linePatches)
  const {linePatches:_,expectedVersion:__,...metadata}=patch
  if(metadata.warehouse!==undefined && !metadata.warehouse.trim())throw new PmsDomainError('MPO_WAREHOUSE_REQUIRED','选择收货仓')
  if(metadata.expectedArrivalDate && (!DATE_PATTERN.test(metadata.expectedArrivalDate)||!Number.isFinite(Date.parse(metadata.expectedArrivalDate))))throw new PmsDomainError('MPO_DATE_INVALID','填写有效预计到货日期')
  savePurchaseUpdate(order,metadata);syncPmsMaterialPurchaseLineProjection(order)
  if(patch.supplierName!==undefined){const supplier=listPmsSuppliers().find(row=>row.supplierCode===patch.supplierName || row.supplierName===patch.supplierName);if(supplier && supplier.status!=='已启用')throw new PmsDomainError('MPO_SUPPLIER_UNAVAILABLE','选择已启用的供应商');order.supplierName=supplier?.supplierName || patch.supplierName.trim();order.supplierCode=supplier?.supplierCode}
  if(patch.usageType!==undefined&&patch.isStockProduction===undefined)order.isStockProduction=patch.usageType==='成衣做货备货'
  order.updatedAt=new Date().toISOString();logPurchaseEdit(order,'修改采购信息','',JSON.stringify(patch),actor)
  return order
 },operationId,signature)
}
export type PmsMaterialPurchaseLinePatch={lineId:string;orderedQty?:number;plannedRolls?:number;unitPrice?:number;weightKg?:number;volumeM3?:number}
function applyPurchaseLinePatches(row:PmsMaterialPurchaseOrder,patches:PmsMaterialPurchaseLinePatch[]):void {
  const lines=getPmsMaterialPurchaseOrderLines(row)
    if(!patches.length || new Set(patches.map(line=>line.lineId)).size!==patches.length)throw new PmsDomainError('MPO_LINES_INVALID','选择不重复的SKU明细')
    for(const patch of patches){
      const line=lines.find(item=>item.lineId===patch.lineId);if(!line)throw new PmsDomainError('MPO_LINE_MISSING','采购明细不存在')
      for(const key of ['orderedQty','unitPrice','weightKg','volumeM3'] as const)if(patch[key]!==undefined && (!Number.isFinite(patch[key]) || patch[key]!<0))throw new PmsDomainError('MPO_VALUE_INVALID','数量、费用及尺寸须为非负数')
      if(patch.orderedQty!==undefined && (patch.orderedQty<=0 || line.legacy && patch.orderedQty<line.sellerReceivedQty))throw new PmsDomainError('MPO_QUANTITY_BLOCKED','计划采购量须大于0；旧单计划量不能低于已登记实到')
      if(patch.plannedRolls!==undefined && (!Number.isInteger(patch.plannedRolls)||patch.plannedRolls<0))throw new PmsDomainError('MPO_ROLLS_INVALID','计划卷数须为非负整数')
      for(const key of ['orderedQty','plannedRolls','unitPrice','weightKg','volumeM3'] as const)if(patch[key]!==undefined)line[key]=patch[key]!
      if(patch.unitPrice!==undefined){line.priceConfirmed=false;row.priceConfirmedAt=undefined}
    }
    row.lines=lines;syncPmsMaterialPurchaseLineProjection(row)
}
export async function updatePmsMaterialPurchaseLines(orderNo:string,patches:PmsMaterialPurchaseLinePatch[],actor:PurchaseActor,operationId:string):Promise<PmsMaterialPurchaseOrder> {
  const signature=JSON.stringify([orderNo,patches,actor]),replay=await readPurchaseActionReplay(operationId,signature);if(replay)return replay[0]
  return commitPurchase(()=>{
    const row=editableOrdinaryPurchase(orderNo,actor),lines=getPmsMaterialPurchaseOrderLines(row),before=JSON.stringify(lines)
    applyPurchaseLinePatches(row,patches);row.updatedAt=new Date().toISOString()
    logPurchaseEdit(row,'修改采购SKU明细',before,JSON.stringify(getPmsMaterialPurchaseOrderLines(row)),actor);return row
  },operationId,signature)
}

export function preparePmsMaterialPurchasePriceConfirmation(order:PmsMaterialPurchaseOrder,prices:Array<{lineId:string;unitPrice:number}>):PmsMaterialPurchaseOrder {
  if(order.pcsSource || order.tmfTipSource || isTmfPurchaseOwner(order.purchaseOrderNo) || order.status==='已关闭')throw new PmsDomainError('MPO_EDIT_LOCKED','当前来源或状态不允许确认采购价')
  const row=structuredClone(order),lines=getPmsMaterialPurchaseOrderLines(row)
  if(!prices.length || new Set(prices.map(line=>line.lineId)).size!==prices.length)throw new PmsDomainError('MPO_PRICE_LINES','选择不重复的SKU价格')
  for(const price of prices){const line=lines.find(item=>item.lineId===price.lineId);if(!line || !Number.isFinite(price.unitPrice)||price.unitPrice<0)throw new PmsDomainError('MPO_PRICE_INVALID','SKU须属于本单，实际采购价须为非负数');line.unitPrice=price.unitPrice;line.priceConfirmed=true}
  row.lines=lines;row.updatedAt=new Date().toISOString();syncPmsMaterialPurchaseLineProjection(row);row.priceConfirmedAt=row.priceConfirmed?row.updatedAt:undefined
  return row
}
export async function confirmPmsMaterialPurchasePrices(orderNo:string,prices:Array<{lineId:string;unitPrice:number}>,actor:PurchaseActor,operationId:string):Promise<PmsMaterialPurchaseOrder> {
  const signature=JSON.stringify([orderNo,prices,actor]),replay=await readPurchaseActionReplay(operationId,signature);if(replay)return replay[0]
  return commitPurchase(()=>{
    const row=editableOrdinaryPurchase(orderNo,actor,true),before=JSON.stringify(getPmsMaterialPurchaseOrderLines(row).map(line=>({lineId:line.lineId,unitPrice:line.unitPrice,priceConfirmed:line.priceConfirmed})))
    Object.assign(row,preparePmsMaterialPurchasePriceConfirmation(row,prices))
    logPurchaseEdit(row,'确认实际采购价',before,JSON.stringify(prices),actor);return row
  },operationId,signature)
}
export async function batchConfirmPmsMaterialPurchasePrices(inputs:Array<{orderNo:string;prices:Array<{lineId:string;unitPrice:number}>}>,actor:PurchaseActor,operationId:string):Promise<PmsMaterialPurchaseOrder[]> {
  const signature=JSON.stringify([inputs,actor]),replay=await readPurchaseActionReplay(operationId,signature);if(replay)return replay
  return commitPurchase(()=>{
    if(!inputs.length||new Set(inputs.map(input=>input.orderNo)).size!==inputs.length)throw new PmsDomainError('MPO_BATCH_EMPTY','选择不重复的采购单')
    return inputs.map(input=>{const row=editableOrdinaryPurchase(input.orderNo,actor,true),before=JSON.stringify(getPmsMaterialPurchaseOrderLines(row).map(line=>({lineId:line.lineId,unitPrice:line.unitPrice,priceConfirmed:line.priceConfirmed})));Object.assign(row,preparePmsMaterialPurchasePriceConfirmation(row,input.prices));logPurchaseEdit(row,'批量确认实际采购价',before,JSON.stringify(input.prices),actor);return row})
  },operationId,signature)
}

export async function recordPmsMaterialPurchaseQuantities(orderNo:string,stage:'actualPurchased'|'sellerReceived',quantities:Array<{lineId:string;quantity:number}>,actor:PurchaseActor,operationId:string):Promise<PmsMaterialPurchaseOrder> {
  const signature=JSON.stringify([orderNo,stage,quantities,actor]),replay=await readPurchaseActionReplay(operationId,signature);if(replay)return replay[0]
  return commitPurchase(()=>{
    const row=editableOrdinaryPurchase(orderNo,actor),lines=getPmsMaterialPurchaseOrderLines(row),before=JSON.stringify(lines)
    if(row.rejectedReason || row.status==='待采购' || row.status==='草稿')throw new PmsDomainError('MPO_NOT_PURCHASED','先下单，再登记实际采购或商家到货')
    if(!['actualPurchased','sellerReceived'].includes(stage)||!quantities.length||new Set(quantities.map(line=>line.lineId)).size!==quantities.length)throw new PmsDomainError('MPO_QUANTITY_LINES','选择不重复的SKU数量')
    for(const entry of quantities){
      const line=lines.find(item=>item.lineId===entry.lineId);if(!line || !Number.isFinite(entry.quantity)||entry.quantity<0)throw new PmsDomainError('MPO_QUANTITY_INVALID','SKU须属于本单，数量须为非负数')
      if(stage==='actualPurchased'){
        const shippedQty=listPmsMaterialLogisticsRecords().filter(record=>record.purchaseOrderNo===orderNo).reduce((sum,record)=>{
          if(resolveLogisticsPurchaseLine(row,record).lineId!==line.lineId)return sum
          if(record.unit!==line.unit)throw new PmsDomainError('MPO_LOGISTICS_UNIT','此SKU物流单位与采购单位不一致，先核对物流记录')
          return sum+record.qty
        },0)
        if(entry.quantity<Math.max(line.sellerReceivedQty,line.inboundQty,shippedQty,(row.detailBarcodes||[]).filter(barcode=>barcode.purchaseLineId===line.lineId||!barcode.purchaseLineId&&barcode.materialCode===line.materialCode).reduce((sum,barcode)=>sum+barcode.quantity,0)))throw new PmsDomainError('MPO_ACTUAL_REDUCE','实际采购量不能少于已登记的商家到货、入库、细码或累计装运数量')
        line.actualPurchasedQty=entry.quantity
      }else{
        if(entry.quantity<Math.max(line.sellerReceivedQty,line.inboundQty))throw new PmsDomainError('MPO_RECEIVED_REDUCE','累计商家到货量不能少于已登记到货或入库量')
        if(line.actualPurchasedQty>0 && entry.quantity>line.actualPurchasedQty || line.legacy && !line.actualPurchasedQty && entry.quantity>line.orderedQty)throw new PmsDomainError('MPO_RECEIVED_OVER','商家到货量不能超过已明确的实际采购量')
        line.sellerReceivedQty=entry.quantity
      }
    }
    row.lines=lines;row.updatedAt=new Date().toISOString();syncPmsMaterialPurchaseLineProjection(row)
    if(stage==='sellerReceived')row.arrivedAt=row.updatedAt
    const arrivalState=pmsMaterialPurchaseSellerArrivalStatus(row)
    row.status=arrivalState==='全部到货'?'已到货':arrivalState==='部分到货'?'部分到货':'已采购'
    logPurchaseEdit(row,stage==='actualPurchased'?'登记实际采购数量':'登记商家到货数量',before,JSON.stringify(quantities),actor);return row
  },operationId,signature)
}

export async function markPmsMaterialPurchaseOrdersPlaced(orderNos:string[],actor:PurchaseActor,operationId:string):Promise<PmsMaterialPurchaseOrder[]> {
  const signature=JSON.stringify([orderNos,actor]),replay=await readPurchaseActionReplay(operationId,signature);if(replay)return replay
  return commitPurchase(()=>{
    if(!orderNos.length||new Set(orderNos).size!==orderNos.length)throw new PmsDomainError('MPO_BATCH_EMPTY','选择不重复的采购单')
    return orderNos.map(no=>{const row=editableOrdinaryPurchase(no,actor);if(row.rejectedReason||row.status!=='待采购')throw new PmsDomainError('MPO_PLACE_BLOCKED','仅待采购且未驳回的普通采购单可以下单');const before=row.orderPlacementStatus||'待下单';row.status='已采购';row.orderPlacementStatus='已下单';row.purchasedAt=new Date().toISOString();row.updatedAt=row.purchasedAt;logPurchaseEdit(row,'设置为已下单',before,'已下单',actor);return row})
  },operationId,signature)
}

export async function rejectPmsMaterialPurchaseOrders(orderNos:string[],reason:string,actor:PurchaseActor,operationId:string):Promise<PmsMaterialPurchaseOrder[]> {
  const signature=JSON.stringify([orderNos,reason,actor]),replay=await readPurchaseActionReplay(operationId,signature);if(replay)return replay
  if(!reason.trim())throw new PmsDomainError('MPO_REASON_REQUIRED','填写驳回原因')
  return commitPurchase(()=>{
    if(!orderNos.length||new Set(orderNos).size!==orderNos.length)throw new PmsDomainError('MPO_BATCH_EMPTY','选择不重复的采购单')
    return orderNos.map(no=>{const row=editableOrdinaryPurchase(no,actor);if(getPmsMaterialPurchaseOrderLines(row).some(line=>line.inboundQty>0))throw new PmsDomainError('MPO_REJECT_INBOUND','已有实际入库，不能驳回覆盖履约事实');const before=row.orderPlacementStatus||row.status;row.rejectedReason=reason.trim();row.orderPlacementStatus='驳回';row.updatedAt=new Date().toISOString();logPurchaseEdit(row,'驳回采购',before,'驳回',actor,reason.trim());return row})
  },operationId,signature)
}

export async function copyPmsMaterialPurchaseOrder(orderNo:string,actor:PurchaseActor,operationId:string):Promise<PmsMaterialPurchaseOrder> {
  assertPurchaseActor(actor)
  const signature=JSON.stringify([orderNo,actor]),replay=await readPurchaseActionReplay(operationId,signature);if(replay)return replay[0]
  return commitPurchase(()=>{
    const source=getPmsMaterialPurchaseOrder(orderNo);if(!source || source.pcsSource || source.tmfTipSource || isTmfPurchaseOwner(orderNo))throw new PmsDomainError('MPO_COPY_SOURCE','请选择普通面辅料采购单')
    const row:PmsMaterialPurchaseOrder={...structuredClone(source),detailBarcodes:[],attachments:[],transferVouchers:[],inventoryPosting:undefined,defectInventoryPosting:undefined,inventoryPostings:[],inspection:undefined,inspections:[],defectDisposals:[],inspector:undefined,inspectionConclusion:undefined,defectQty:0,defectWarehouse:'',rejectedReason:'',purchasedAt:undefined,arrivedAt:undefined,purchaseOrderNo:`CGF-${operationId}`,sourceCopyOrderNo:orderNo,requirementNo:'',sourceRequirementLineNo:'',sourceProductPurchaseOrderNo:'',status:'待采购',orderPlacementStatus:'待下单',receivedQty:0,actualPurchasedQty:0,actualPurchasedRolls:0,sellerReceivedQty:0,priceConfirmed:false,priceConfirmedAt:undefined,supplierConfirmed:false,supplierConfirmedAt:'',orderDate:new Date().toISOString().slice(0,10),updatedAt:new Date().toISOString(),_pmsBaseVersion:0}
    // closedReason predates the typed order contract and is retained only for old records.
    Object.assign(row,{closedReason:''})
    row.lines=getPmsMaterialPurchaseOrderLines(source).map((line,index)=>{const {legacy:_,sourceRequirementLineNo:__,...plan}=line;return {...plan,lineId:`${row.purchaseOrderNo}:L${index+1}`,actualPurchasedQty:0,actualPurchasedRolls:0,sellerReceivedQty:0,inboundQty:0,priceConfirmed:false}})
    syncPmsMaterialPurchaseLineProjection(row)
    if(getPmsMaterialPurchaseOrder(row.purchaseOrderNo))throw new PmsDomainError('MPO_NUMBER_CONFLICT','采购编号已存在，重新打开复制表单')
    getRuntime().orders.unshift(row);logPurchaseEdit(row,'复制采购单',orderNo,row.purchaseOrderNo,actor);return row
  },operationId,signature)
}

export function preparePmsSupplierPurchaseConfirmation(orderNo:string):PmsMaterialPurchaseOrder {
  const before=getPmsMaterialPurchaseOrder(orderNo)
  if(!before || before.pcsSource || before.tmfTipSource || isTmfPurchaseOwner(orderNo) || before.status==='已关闭') throw new PmsDomainError('MPO_CONFIRM_BLOCKED','当前来源采购单不允许供应商确认')
  return {...structuredClone(before),supplierConfirmed:true,supplierConfirmedAt:new Date().toISOString()}
}
export function publishPmsMaterialPurchaseOrders(rows:PmsMaterialPurchaseOrder[]):void {
  for(const row of rows){const old=getRuntime().orders.find(r=>r.purchaseOrderNo===row.purchaseOrderNo);if(old) Object.assign(old,row);else getRuntime().orders.unshift(row)}
}

export interface PmsNewMaterialPurchaseInput {
  isStockProduction?:boolean
  usageType?:'成衣做货'|'补采'|'成衣做货补采'|'成衣做货备货'|'样衣采购'|'样衣做货'|'kol样品小单'
  supplementReason?:string
  dedicatedSpu?:string
  kind:'原料'|'物料'|'面料'|'辅料'|'样衣'
  materialCode?:string
  quantity?:number
  unitPrice?:number
  plannedRolls?:number
  lines?:Array<{materialCode:string;quantity:number;plannedRolls?:number;unitPrice:number;weightKg?:number;volumeM3?:number}>
  currency:'RMB'|'USD'|'IDR'
  supplierName:string
  supplierCode?:string
  purchaseRegion:string
  warehouse:string
  buyerName:string
  expectedArrivalDate:string
  remark:string
}
export async function createPmsMaterialPurchaseOrder(input:PmsNewMaterialPurchaseInput,actor:{id:string;name:string;role:PmsActorRole},operationId:string):Promise<PmsMaterialPurchaseOrder> {
  const {getPurchaseGoodsReference}=await import('./canonical-purchase-references.ts')
  assertPurchaseActor(actor)
  if(!['原料','物料','面料','辅料','样衣'].includes(input.kind))throw new PmsDomainError('MPO_SOURCE_KIND','选择有效采购类型')
  const signature=JSON.stringify([input,actor]),replay=await readPurchaseActionReplay(operationId,signature)
  if(replay) return replay[0]
  const requested=input.lines ?? [{materialCode:input.materialCode || '',quantity:input.quantity!,plannedRolls:input.plannedRolls,unitPrice:input.unitPrice!}]
  const selectedSupplier=listPmsSuppliers().find(supplier=>input.supplierCode ? supplier.supplierCode===input.supplierCode : supplier.supplierName===input.supplierName || supplier.supplierCode===input.supplierName)
  if(input.supplierCode && !selectedSupplier || selectedSupplier && selectedSupplier.status!=='已启用')throw new PmsDomainError('MPO_SUPPLIER_UNAVAILABLE','选择已启用的供应商')
  if(!requested.length || new Set(requested.map(line=>line.materialCode)).size!==requested.length) throw new PmsDomainError('MPO_LINES_INVALID','选择不重复的SKU')
  const lines:PmsMaterialPurchaseOrderLine[]=requested.map((entry,index)=>{
    const reference=getPurchaseGoodsReference(entry.materialCode)
    if(!reference?.active || !reference.imageUrl || !reference.materialSkuId) throw new PmsDomainError('MPO_SOURCE_UNAVAILABLE','选择已启用且有对应图片的商品或物料 SKU')
    if(input.kind==='样衣' ? reference.category!=='成衣' : input.kind==='面料' ? reference.category!=='面料' : input.kind==='辅料' ? reference.category!=='辅料' : reference.category==='成衣') throw new PmsDomainError('MPO_SOURCE_KIND','所选 SKU 类型与采购类型不匹配')
    if(!Number.isFinite(entry.quantity) || entry.quantity<=0 || !Number.isFinite(entry.unitPrice) || entry.unitPrice<0 || !Number.isInteger(entry.plannedRolls ?? 0) || (entry.plannedRolls ?? 0)<0) throw new PmsDomainError('MPO_INPUT_NUMBER','数量须大于0，单价不能为负数，计划卷数须为非负整数')
    if([entry.weightKg,entry.volumeM3].some(value=>value!==undefined&&(!Number.isFinite(value)||value<0)))throw new PmsDomainError('MPO_INPUT_DIMENSIONS','SKU重量和体积须为非负有限数')
    return {lineId:`CGF-${operationId}:L${index+1}`,materialCode:reference.materialCode,materialName:reference.materialName,materialSpu:reference.materialSpu || '',materialSkuId:reference.materialSkuId,materialId:reference.materialId,imageUrl:reference.imageUrl,unit:reference.unit,orderedQty:entry.quantity,plannedRolls:entry.plannedRolls ?? 0,unitPrice:entry.unitPrice,weightKg:entry.weightKg,volumeM3:entry.volumeM3,actualPurchasedQty:0,sellerReceivedQty:0,inboundQty:0,priceConfirmed:false,colorName:reference.colorName,specName:reference.specName}
  })
  if(new Set(lines.map(line=>line.materialCode)).size!==lines.length) throw new PmsDomainError('MPO_LINES_INVALID','同一SKU不能重复选择')
  if(![input.supplierName,input.purchaseRegion,input.warehouse,input.buyerName].every(value=>value.trim())) throw new PmsDomainError('MPO_INPUT_REQUIRED','填写供应商、采购区域、收货仓和采购员')
  if(input.expectedArrivalDate && (!DATE_PATTERN.test(input.expectedArrivalDate) || !Number.isFinite(Date.parse(input.expectedArrivalDate)))) throw new PmsDomainError('MPO_DATE_INVALID','填写有效的预计到货日期')
  if(!['RMB','USD','IDR'].includes(input.currency)) throw new PmsDomainError('MPO_CURRENCY_INVALID','选择采购币种')
  if(['补采','成衣做货补采'].includes(input.usageType || '')&&(!input.supplementReason?.trim()||!input.remark.trim()||!input.dedicatedSpu?.trim()))throw new PmsDomainError('MPO_SUPPLEMENT_REQUIRED','补采须填写原因、采购备注和专用SPU')
  let dedicated:{styleCode:string;styleName:string;skuImageUrl:string}|undefined
  if(input.dedicatedSpu){const {listSkuArchives}=await import('../pcs-sku-archive-repository.ts');dedicated=listSkuArchives().find(row=>row.styleCode===input.dedicatedSpu&&row.archiveStatus==='ACTIVE');if(!dedicated)throw new PmsDomainError('MPO_SPU_UNKNOWN','选择已有且启用的商品SPU')}
  return commitPurchase(()=>{
    const first=lines[0]
    const row=buildOrder(`CGF-${operationId}`,{materialCode:first.materialCode,materialName:first.materialName,materialType:input.kind,materialImageUrl:first.imageUrl,unit:first.unit,styleCode:'',styleName:'',styleImageUrl:'',supplierName:selectedSupplier?.supplierName || input.supplierName.trim(),warehouse:input.warehouse.trim()},first.orderedQty,first.unitPrice,'待采购',{orderDate:new Date().toISOString().slice(0,10),expectedArrivalDate:input.expectedArrivalDate},{remark:input.remark})
    if(getPmsMaterialPurchaseOrder(row.purchaseOrderNo))throw new PmsDomainError('MPO_NUMBER_CONFLICT','采购编号已存在，重新打开建单表单')
    row.lines=lines;row.supplierCode=selectedSupplier?.supplierCode;row.orderPlacementStatus='待下单';syncPmsMaterialPurchaseLineProjection(row)
    row.currency=input.currency;row.purchaseRegion=input.purchaseRegion;row.buyerName=input.buyerName;row.usageType=input.usageType||'成衣做货';row.isStockProduction=input.isStockProduction ?? (input.usageType==='成衣做货备货');row.supplementReason=input.supplementReason?.trim();row.dedicatedSpu=input.dedicatedSpu?.trim();if(dedicated){row.styleCode=dedicated.styleCode;row.styleName=dedicated.styleName;row.styleImageUrl=dedicated.skuImageUrl}getRuntime().orders.unshift(row)
    appendPmsLog({objectType:'material-purchase-order',objectId:row.purchaseOrderNo,action:'创建采购单',beforeValue:'',afterValue:lines.map(line=>`${line.materialCode} ${line.orderedQty} ${line.unit}`).join('；'),reason:input.remark,actorId:actor.id,actorName:actor.name,actorRole:actor.role})
    return row
  },operationId,signature)
}

export async function batchUpdatePmsMaterialPurchaseOrders(orderNos:string[],field:'buyerName'|'supplierName'|'purchaseRegion'|'remark'|'unitPrice'|'printingFactory'|'cuttingFactory'|'printingProcess'|'dyeFee'|'rejectedReason',value:string,actor:{id:string;name:string;role:PmsActorRole},operationId:string):Promise<PmsMaterialPurchaseOrder[]>{
 const signature=JSON.stringify([orderNos,field,value,actor]),replay=await readPurchaseActionReplay(operationId,signature);if(replay)return replay
 assertPurchaseActor(actor)
 if(!orderNos.length || new Set(orderNos).size!==orderNos.length)throw new PmsDomainError('MPO_BATCH_EMPTY','选择采购单，同一采购单不能重复')
 if(!value.trim())throw new PmsDomainError('MPO_BATCH_VALUE','填写要设置的内容')
 if(['unitPrice','dyeFee'].includes(field)&&(!Number.isFinite(Number(value))||Number(value)<0))throw new PmsDomainError('MPO_PRICE_INVALID','金额须为非负数')
 return commitPurchase(()=>{const rows=orderNos.map(no=>getPmsMaterialPurchaseOrder(no));if(rows.some(row=>!row || row.pcsSource || row.tmfTipSource || isTmfPurchaseOwner(row.purchaseOrderNo) || ['已关闭','已入库'].includes(row.status)))throw new PmsDomainError('MPO_BATCH_LOCKED','全部所选采购单须可修改，已关闭、已入库或专项采购须单独处理')
  return (rows as PmsMaterialPurchaseOrder[]).map(row=>{const before=String(row[field] ?? '');Object.assign(row,{[field]:['unitPrice','dyeFee'].includes(field)?Number(value):value.trim()});if(field==='unitPrice'){if(row.lines)row.lines.forEach(line=>{line.unitPrice=Number(value);line.priceConfirmed=true});row.priceConfirmed=true;row.priceConfirmedAt=new Date().toISOString();syncPmsMaterialPurchaseLineProjection(row)}if(field==='supplierName'){const supplier=listPmsSuppliers().find(item=>item.supplierCode===value.trim()||item.supplierName===value.trim());if(supplier&&supplier.status!=='已启用')throw new PmsDomainError('MPO_SUPPLIER_UNAVAILABLE','选择已启用的供应商');row.supplierName=supplier?.supplierName||value.trim();row.supplierCode=supplier?.supplierCode}if(field==='rejectedReason'){if(getPmsMaterialPurchaseOrderLines(row).some(line=>line.inboundQty>0))throw new PmsDomainError('MPO_REJECT_INBOUND','已有实际入库，不能驳回覆盖履约事实');row.orderPlacementStatus='驳回'}row.updatedAt=new Date().toISOString();row.lastOperationId=operationId;appendPmsLog({objectType:'material-purchase-order',objectId:row.purchaseOrderNo,action:field==='rejectedReason'?'驳回采购':'批量修改采购信息',beforeValue:before,afterValue:`${field==='unitPrice'?'实际采购单价':field==='dyeFee'?'染色费用':field} ${value}`,reason:field==='rejectedReason'?value:'',actorId:actor.id,actorName:actor.name,actorRole:actor.role,secondConfirmation:true});return row})
 },operationId,signature)
}
export async function batchPushPmsMaterialRequirements(entries:Array<{requirementNo:string;lines:PmsRequirementPushLineInput[]}>,actor:{id:string;name:string;role:PmsActorRole},operationId:string):Promise<PmsMaterialPurchaseOrder[]>{
 if(!entries.length || new Set(entries.map(row=>row.requirementNo)).size!==entries.length)throw new PmsDomainError('MREQ_BATCH_EMPTY','选择不重复的面辅料需求')
 await hydratePmsProductPurchaseOrdersFromIdb()
 return commitPurchase(()=>entries.flatMap(row=>preparePushPmsMaterialRequirement(row.requirementNo,row.lines,actor)),operationId,JSON.stringify([entries,actor]))
}

export interface PmsMaterialPurchaseInventoryPosting {id:string;purchaseLineId?:string;sourceLogisticsRecordNo?:string;sourcePurchaseOrderNo:string;materialCode:string;materialName:string;imageUrl:string;warehouse:string;qty:number;unit:string;postedAt:string;operator:string;sourceKind:'local-demo';quality?:'正常'|'瑕疵'}
/** Only explicit completed local inbound actions carry this posting; static status labels do not. */
export function listPmsMaterialPurchaseInventoryPostings():PmsMaterialPurchaseInventoryPosting[]{
 const postings=new Map<string,PmsMaterialPurchaseInventoryPosting>()
 for(const order of listPmsMaterialPurchaseOrders())for(const row of [order.inventoryPosting?{...order.inventoryPosting,quality:'正常' as const}:undefined,order.defectInventoryPosting?{...order.defectInventoryPosting,quality:'瑕疵' as const}:undefined,...(order.inventoryPostings||[])])if(row && row.qty>0)postings.set(row.id,{...structuredClone(row),quality:row.quality||'正常'})
 return [...postings.values()]
}

export type PmsMpoDetailBarcode=NonNullable<PmsMaterialPurchaseOrder['detailBarcodes']>[number]
export async function saveMpoDetailBarcodes(orderNo:string,rows:PmsMpoDetailBarcode[],actor:PurchaseActor,operationId:string):Promise<PmsMaterialPurchaseOrder>{
 const signature=JSON.stringify([orderNo,rows,actor]),replay=await readPurchaseActionReplay(operationId,signature);if(replay)return replay[0]
 return commitPurchase(()=>{
  assertPurchaseActor(actor)
  const order=getPmsMaterialPurchaseOrder(orderNo)
  if(!order || order.pcsSource || order.tmfTipSource || isTmfPurchaseOwner(orderNo) || order.status==='已关闭')throw new PmsDomainError('MPO_BARCODE_LOCKED','当前来源不允许修改采购条码')
  if(new Set(rows.map(row=>row.code.trim())).size!==rows.length)throw new PmsDomainError('MPO_BARCODE_DUPLICATE','条码不能重复')
  const lines=getPmsMaterialPurchaseOrderLines(order),totals=new Map<string,number>()
  const normalized=rows.map(row=>{
   const line=row.purchaseLineId?lines.find(item=>item.lineId===row.purchaseLineId):row.materialCode?lines.find(item=>item.materialCode===row.materialCode):lines.length===1?lines[0]:undefined
   if(!line || row.materialCode && row.materialCode!==line.materialCode)throw new PmsDomainError('MPO_BARCODE_SKU','每个条码须明确归属于本采购单的SKU')
   if(!row.code.trim() || !Number.isFinite(row.quantity) || row.quantity<=0 || row.unit!==line.unit || !row.warehouse.trim() || !['有效','已下架'].includes(row.status))throw new PmsDomainError('MPO_BARCODE_INVALID','条码、仓库必填；数量须为正数且单位须与所选SKU相同')
   const old=order.detailBarcodes?.find(item=>item.code===row.code.trim())
   if(old){const original=old.purchaseLineId?lines.find(item=>item.lineId===old.purchaseLineId):old.materialCode?lines.find(item=>item.materialCode===old.materialCode):lines.length===1?lines[0]:undefined;if(!original || original.lineId!==line.lineId)throw new PmsDomainError('MPO_BARCODE_SKU_LOCKED','已有条码不能更换SKU')}
   if(row.createdAt && !Number.isFinite(Date.parse(row.createdAt)))throw new PmsDomainError('MPO_BARCODE_DATE','条码创建时间无效')
   if(old?.status==='已下架' && (row.status!=='已下架' || row.targetArea!==old.targetArea || row.movedAt!==old.movedAt || row.movedBy!==old.movedBy))throw new PmsDomainError('MPO_BARCODE_MOVED_LOCK','已下架条码的搬移动作不能覆盖或恢复')
   if(row.status==='已下架' && (!old || row.targetArea!=='待出库区' || !row.movedAt || !Number.isFinite(Date.parse(row.movedAt)) || !row.movedBy?.trim()))throw new PmsDomainError('MPO_BARCODE_MOVE_REQUIRED','选择有效条码并填写下架到待出库区的操作记录')
   if(listPmsMaterialPurchaseOrders().some(other=>other.purchaseOrderNo!==orderNo && other.detailBarcodes?.some(barcode=>barcode.code===row.code.trim())))throw new PmsDomainError('MPO_BARCODE_DUPLICATE','条码已属于其它采购单')
   totals.set(line.lineId,(totals.get(line.lineId)||0)+row.quantity)
   return {...row,code:row.code.trim(),warehouse:row.warehouse.trim(),purchaseLineId:line.lineId,materialCode:line.materialCode}
  })
  for(const line of lines){const limit=pmsMaterialPurchaseBarcodeLimit(order,line.lineId),total=totals.get(line.lineId)||0;if(limit!==undefined&&total>limit+0.000001)throw new PmsDomainError('MPO_BARCODE_OVER_QTY',`${line.materialCode}条码总数量 ${total} 不能超过${line.actualPurchasedQty>0?'实际采购量':'采购数量'} ${limit} ${line.unit}`)}
  const before=order.detailBarcodes || [];order.detailBarcodes=normalized;order.updatedAt=new Date().toISOString()
  logPurchaseEdit(order,'保存采购条码明细',`${before.length} 个条码`,`${rows.length} 个条码`,actor)
  return order
 },operationId,signature)
}
export async function addPmsMaterialPurchaseAttachments(orderNo:string,files:File[],category:'物流凭证'|'附加图片',actor:PurchaseActor,operationId:string,input?:{transferDate?:string;transferFee?:number}):Promise<PmsMaterialPurchaseOrder>{
 assertPurchaseActor(actor)
 if(!files.length||files.length>10||files.some(file=>!(file instanceof Blob)||!file.size||file.size>20*1024*1024||! /\.(png|jpe?g|webp|pdf)$/i.test(file.name)))throw new PmsDomainError('MPO_FILE_INVALID','选择1至10张图片或PDF，每个文件大小须为1字节至20MB')
 if(input && (category!=='物流凭证'||files.some(file=>! /\.(png|jpe?g)$/i.test(file.name))))throw new PmsDomainError('MPO_TRANSFER_FILE_INVALID','转运凭证支持jpg、jpeg或png图片，最多10张')
 if(input?.transferDate && (!DATE_PATTERN.test(input.transferDate)||!Number.isFinite(Date.parse(input.transferDate))))throw new PmsDomainError('MPO_TRANSFER_DATE','填写有效转运日期')
 if(input?.transferFee!==undefined&&(!Number.isFinite(input.transferFee)||input.transferFee<0))throw new PmsDomainError('MPO_TRANSFER_FEE','转运费用须为非负数')
 const entries=await Promise.all(files.map(async(file,index)=>{const bytes=await file.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(value=>value.toString(16).padStart(2,'0')).join('');return {file,hash,fileId:`MPO-FILE:${operationId}:${index+1}`}}))
 const signature=JSON.stringify([orderNo,category,entries.map(({file,hash})=>[file.name,file.type,file.size,hash]),actor,input]),replay=await readPurchaseActionReplay(operationId,signature);if(replay)return replay[0]
 return commitPurchase(()=>{
  const order=getPmsMaterialPurchaseOrder(orderNo);if(!order||order.status==='已关闭'||order.pcsSource||order.tmfTipSource||isTmfPurchaseOwner(orderNo))throw new PmsDomainError('MPO_FILE_LOCKED','通用附件仅用于未关闭的普通采购单，专项来源使用对应入口')
  order.attachments ||= []
  for(const {file,fileId} of entries)order.attachments.push({fileId,name:file.name,type:file.type,size:file.size,category})
  if(input){order.transferVouchers ||= [];order.transferVouchers.push({voucherId:`MPO-VOUCHER:${operationId}`,transferDate:input.transferDate||'',transferFee:input.transferFee||0,fileIds:entries.map(entry=>entry.fileId),operator:actor.name,createdAt:new Date().toISOString()})}
  order.updatedAt=new Date().toISOString();logPurchaseEdit(order,input?'上传转运凭证':`上传${category}`,'',entries.map(entry=>entry.file.name).join('、'),actor)
  return order
 },operationId,signature,{attachments:entries.map(({file,fileId})=>({id:fileId,name:file.name,type:file.type,size:file.size,blob:file}))})
}
export async function addPmsMaterialPurchaseAttachment(orderNo:string,file:File,category:'物流凭证'|'附加图片',actor:PurchaseActor,operationId:string,input?:{transferDate?:string;transferFee?:number}):Promise<PmsMaterialPurchaseOrder>{return addPmsMaterialPurchaseAttachments(orderNo,[file],category,actor,operationId,input)}
export async function removePmsMaterialPurchaseAttachment(orderNo:string,fileId:string,actor:{id:string;name:string;role:PmsActorRole},operationId:string):Promise<PmsMaterialPurchaseOrder>{assertPurchaseActor(actor);return commitPurchase(()=>{const order=getPmsMaterialPurchaseOrder(orderNo);const attachment=order?.attachments?.find(file=>file.fileId===fileId);if(!order || !attachment || order.status==='已关闭' || order.pcsSource || order.tmfTipSource || isTmfPurchaseOwner(orderNo))throw new PmsDomainError('MPO_FILE_UNAVAILABLE','附件不存在、采购单已关闭或属于专项来源，使用对应入口');order.attachments=order.attachments!.filter(file=>file.fileId!==fileId);order.transferVouchers=order.transferVouchers?.map(voucher=>({...voucher,fileIds:voucher.fileIds.filter(id=>id!==fileId)}));order.inspections=order.inspections?.map(inspection=>({...inspection,photoFileIds:inspection.photoFileIds?.filter(id=>id!==fileId)}));if(order.inspection)order.inspection.photoFileIds=order.inspection.photoFileIds?.filter(id=>id!==fileId);appendPmsLog({objectType:'material-purchase-order',objectId:orderNo,action:'删除采购附件',beforeValue:attachment.name,afterValue:'',reason:'',actorId:actor.id,actorName:actor.name,actorRole:actor.role,secondConfirmation:true});return order},operationId,JSON.stringify([orderNo,fileId,actor]),{attachmentDeletes:[fileId]})}
export async function readPmsMaterialPurchaseAttachment(fileId:string):Promise<Blob>{const row=await pmsGet<PmsAttachment>(PMS_STORES.pmsAttachments,fileId);if(!row?.blob)throw new PmsDomainError('MPO_FILE_MISSING','原文件不可读，重新上传');return row.blob}

export type PmsMaterialPurchaseInspectionInput=Omit<PmsMaterialPurchaseInspection,'inspectedAt'|'shortageRate'> & {purchaseLineId?:string;photoFiles?:File[]}
export async function inspectPmsMaterialPurchaseOrder(orderNo:string,input:PmsMaterialPurchaseInspectionInput,actor:PurchaseActor,operationId:string):Promise<PmsMaterialPurchaseOrder>{
 const {photoFiles,...businessInput}=input
 const photos=photoFiles||[]
 if(photos.length>10||photos.some(file=>!(file instanceof Blob)||!file.size||file.size>20*1024*1024||! /\.(png|jpe?g)$/i.test(file.name)))throw new PmsDomainError('MPO_QC_PHOTOS','抽检支持最多10张jpg、jpeg或png图片，每张不超过20MB')
 const preparedPhotos=await Promise.all(photos.map(async(file,index)=>{const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(byte=>byte.toString(16).padStart(2,'0')).join('');return {file,hash,fileId:`MPO-QC-FILE:${operationId}:${index+1}`}}))
 const signature=JSON.stringify(preparedPhotos.length?[orderNo,businessInput,actor,preparedPhotos.map(({file,hash})=>[file.name,file.type,file.size,hash])]:[orderNo,businessInput,actor]),replay=await readPurchaseActionReplay(operationId,signature);if(replay)return replay[0]
 return commitPurchase(()=>{
  assertPurchaseActor(actor)
  const order=getPmsMaterialPurchaseOrder(orderNo)
  if(!order || order.pcsSource || order.tmfTipSource || isTmfPurchaseOwner(orderNo) || (!order.lines && (!['部分到货','已到货'].includes(order.status)||order.inventoryPosting)) || order.lines && ['草稿','待采购','已关闭'].includes(order.status))throw new PmsDomainError('MPO_QC_LOCKED','选择已下单且有实际数量的普通采购单；旧单保持已到货、尚未入库的抽检范围')
  const lines=getPmsMaterialPurchaseOrderLines(order),line=input.purchaseLineId?lines.find(item=>item.lineId===input.purchaseLineId):lines.length===1?lines[0]:undefined
  if(!line)throw new PmsDomainError('MPO_QC_SKU','选择本单需要抽检的SKU')
  const actualQty=line.sellerReceivedQty||line.inboundQty||line.actualPurchasedQty
  if(!input.inspector.trim()||!Number.isFinite(input.sampleQty)||input.sampleQty<=0||input.sampleQty>actualQty||!Number.isFinite(input.qualifiedQty)||!Number.isFinite(input.defectQty)||input.qualifiedQty<0||input.defectQty<0||Math.abs(input.qualifiedQty+input.defectQty-input.sampleQty)>0.000001)throw new PmsDomainError('MPO_QC_QUANTITY','填写质检员；抽检数量须在此SKU实际数量内，合格与瑕疵数量之和须等于抽检数量')
  if(input.defectQty>0&&(!input.reason.trim()||!input.warehouse.trim()||input.warehouse.trim()===order.warehouse))throw new PmsDomainError('MPO_DEFECT_REQUIRED','发现瑕疵时填写原因，并选择与收货仓不同的瑕疵仓')
  if([input.labelLength,input.actualLength].some(value=>value!==undefined&&(!Number.isFinite(value)||value<0)))throw new PmsDomainError('MPO_QC_LENGTH','标签长度和实际长度须为非负数')
  if(input.actualLength!==undefined&&input.labelLength!==undefined&&input.labelLength===0&&input.actualLength>0)throw new PmsDomainError('MPO_QC_LENGTH','计算空差率需要大于0的标签长度')
  if(input.conclusion&&!['合格','不合格','部分合格'].includes(input.conclusion))throw new PmsDomainError('MPO_QC_CONCLUSION','选择有效抽检结论')
  if(input.conclusion==='合格'&&input.defectQty!==0 || input.conclusion==='不合格'&&input.qualifiedQty!==0 || input.conclusion==='部分合格'&&!(input.qualifiedQty>0&&input.defectQty>0))throw new PmsDomainError('MPO_QC_CONCLUSION_QUANTITY','抽检结论与合格、瑕疵数量不一致，核对后保存')
  order.attachments ||= []
  for(const {file,fileId} of preparedPhotos)order.attachments.push({fileId,name:file.name,type:file.type,size:file.size,category:'附加图片',purchaseLineId:line.lineId,purpose:'采购抽检'})
  const photoFileIds=[...(input.photoFileIds||[]),...preparedPhotos.map(photo=>photo.fileId)]
  if(photoFileIds.length>10||new Set(photoFileIds).size!==photoFileIds.length||photoFileIds.some(id=>!order.attachments?.some(file=>file.fileId===id&&file.category==='附加图片'&&(!file.purchaseLineId||file.purchaseLineId===line.lineId))))throw new PmsDomainError('MPO_QC_PHOTOS','抽检图片最多10张，已有图片须属于本采购单')
  const {purchaseLineId:_,...inspectionInput}=businessInput,inspection={...inspectionInput,photoFileIds,shortageRate:input.labelLength?Math.max(0,(input.labelLength-(input.actualLength||0))/input.labelLength*100):undefined,inspector:input.inspector.trim(),reason:input.reason.trim(),warehouse:input.warehouse.trim(),remark:input.remark?.trim(),inspectedAt:new Date().toISOString()}
  const before=order.inspections?.find(item=>item.purchaseLineId===line.lineId)||(lines.length===1?order.inspection:undefined)
  if(order.lines){order.inspections=(order.inspections||[]).filter(item=>item.purchaseLineId!==line.lineId);order.inspections.push({...inspection,purchaseLineId:line.lineId})}
  if(lines.length===1){order.inspection=inspection;order.inspector=inspection.inspector;order.defectQty=inspection.defectQty;order.defectWarehouse=inspection.warehouse;order.inspectionConclusion=input.conclusion||(input.defectQty?'发现瑕疵':'抽检合格')}
  order.updatedAt=inspection.inspectedAt
  logPurchaseEdit(order,'登记采购质检',before?JSON.stringify(before):'未质检',JSON.stringify({materialCode:line.materialCode,...inspection}),actor,input.reason.trim());return order
 },operationId,signature,{attachments:preparedPhotos.map(({file,fileId})=>({id:fileId,name:file.name,type:file.type,size:file.size,blob:file}))})
}
export async function disposePmsMaterialPurchaseDefects(orderNo:string,input:{purchaseLineId?:string;defectQty:number;defectRolls?:number;warehouseRolls?:number;moveToDefectWarehouse:boolean;warehouse?:string;remark:string},actor:PurchaseActor,operationId:string):Promise<PmsMaterialPurchaseOrder>{
 const signature=JSON.stringify([orderNo,input,actor]),replay=await readPurchaseActionReplay(operationId,signature);if(replay)return replay[0]
 return commitPurchase(()=>{
  assertPurchaseActor(actor)
  const order=getPmsMaterialPurchaseOrder(orderNo)
  if(!order||order.pcsSource||order.tmfTipSource||isTmfPurchaseOwner(orderNo)||order.status==='已关闭')throw new PmsDomainError('MPO_DEFECT_LOCKED','选择普通采购单的SKU登记瑕疵')
  const lines=getPmsMaterialPurchaseOrderLines(order),line=input.purchaseLineId?lines.find(item=>item.lineId===input.purchaseLineId):lines.length===1?lines[0]:undefined
  if(!line)throw new PmsDomainError('MPO_DEFECT_SKU','选择本单需要处理的SKU')
  if(!Number.isFinite(input.defectQty)||input.defectQty<=0||!Number.isInteger(input.defectRolls||0)||(input.defectRolls||0)<0||!Number.isInteger(input.warehouseRolls||0)||(input.warehouseRolls||0)<0||!input.remark.trim())throw new PmsDomainError('MPO_DEFECT_INPUT','填写瑕疵数量与备注，卷数须为非负整数')
  const physical=line.inboundQty||line.sellerReceivedQty||line.actualPurchasedQty
  if(input.defectQty>physical)throw new PmsDomainError('MPO_DEFECT_OVER','瑕疵数量不能超过此SKU实际数量')
  const inspection=order.inspections?.find(item=>item.purchaseLineId===line.lineId)||(lines.length===1?order.inspection:undefined),warehouse=input.warehouse?.trim()||inspection?.warehouse?.trim()||'布料瑕疵品仓'
  if(input.moveToDefectWarehouse){
   if(!line.inboundQty)throw new PmsDomainError('MPO_DEFECT_INBOUND_REQUIRED','先确认实际入库，再从正常库存移入瑕疵仓')
   const postings=order.inventoryPostings ||= []
   for(const previous of [order.inventoryPosting?{...order.inventoryPosting,quality:'正常' as const}:undefined,order.defectInventoryPosting?{...order.defectInventoryPosting,quality:'瑕疵' as const}:undefined])if(previous&&!postings.some(row=>row.id===previous.id))postings.push({...structuredClone(previous),purchaseLineId:line.lineId})
   const good=postings.filter(row=>(row.purchaseLineId===line.lineId||!row.purchaseLineId&&row.materialCode===line.materialCode)&&row.quality!=='瑕疵'),available=good.reduce((sum,row)=>sum+row.qty,0)
   if(input.defectQty>available)throw new PmsDomainError('MPO_DEFECT_OVER','此SKU正常库存不足，不能重复移入瑕疵仓')
   if(good.some(row=>row.warehouse===warehouse))throw new PmsDomainError('MPO_DEFECT_WAREHOUSE','瑕疵仓须与正常仓不同')
   let remainder=input.defectQty
   for(const row of good){const qty=Math.min(row.qty,remainder);row.qty-=qty;remainder-=qty;if(!remainder)break}
   postings.push({id:`MPO-DEFECT:${operationId}`,purchaseLineId:line.lineId,sourcePurchaseOrderNo:orderNo,materialCode:line.materialCode,materialName:line.materialName,imageUrl:line.imageUrl,warehouse,qty:input.defectQty,unit:line.unit,postedAt:new Date().toISOString(),operator:actor.name,sourceKind:'local-demo',quality:'瑕疵'})
   order.inventoryPosting=undefined;order.defectInventoryPosting=undefined
  }
  const result={purchaseLineId:line.lineId,defectQty:input.defectQty,defectRolls:input.defectRolls||0,warehouseRolls:input.warehouseRolls||0,moveToDefectWarehouse:input.moveToDefectWarehouse,warehouse,remark:input.remark.trim(),operator:actor.name,recordedAt:new Date().toISOString()}
  order.defectDisposals=(order.defectDisposals||[]).filter(row=>row.purchaseLineId!==line.lineId);order.defectDisposals.push(result);order.updatedAt=result.recordedAt
  if(input.moveToDefectWarehouse){order.lines=lines;syncPmsMaterialPurchaseLineProjection(order)}
  logPurchaseEdit(order,'登记瑕疵布料处理','',JSON.stringify(result),actor,input.remark.trim());return order
 },operationId,signature)
}
export async function updatePmsMaterialLogistics(recordNo:string,patch:Omit<PmsLogisticsImportRow,'purchaseOrderNo'>,actor:PurchaseActor,operationId:string):Promise<PmsMaterialLogisticsRecord>{
 const signature=JSON.stringify([recordNo,patch,actor]),replay=await readLogisticsActionReplay(operationId,signature);if(replay)return replay[0]
 assertPurchaseActor(actor)
 return commitPurchase(()=>{
  const row=getPmsMaterialLogisticsRecord(recordNo)
  if(!row || row.domesticSigned || row.headBatchNo || row.headLogisticsQty>0 || row.headSigned || (row.inboundQty||0)>0)throw new PmsDomainError('MPO_LOGISTICS_LOCKED','已签收、加入头程或入库的物流记录不能修改')
  const order=getPmsMaterialPurchaseOrder(row.purchaseOrderNo)!,original=resolveLogisticsPurchaseLine(order,row),input={...patch,purchaseOrderNo:row.purchaseOrderNo,purchaseLineId:patch.purchaseLineId||row.purchaseLineId,materialCode:patch.materialCode||row.materialCode}
  const line=resolveLogisticsPurchaseLine(order,input)
  if(line.lineId!==original.lineId)throw new PmsDomainError('MPO_LOGISTICS_SKU_LOCKED','已有物流不能更换采购单或SKU')
  const duplicateKeys=row.kind==='supplement'||input.trackingNo.trim()===row.trackingNo?new Set<string>():new Set(listPmsMaterialLogisticsRecords().filter(item=>item.recordNo!==recordNo).map(item=>pmsMaterialLogisticsIdentity(item)))
  applyLogisticsPurchaseFacts(order,input,actor)
  const error=validatePmsLogisticsImportRow(input,duplicateKeys,new Set());if(error)throw new PmsDomainError('MPO_LOGISTICS_INVALID',error)
  const before=`${row.trackingNo} · ${row.qty} ${row.unit}`
  Object.assign(row,input,{company:input.company.trim(),trackingNo:input.trackingNo.trim(),updatedAt:new Date().toISOString(),lastOperationId:operationId})
  assertLogisticsTotals(listPmsMaterialLogisticsRecords())
  appendPmsLog({objectType:'material-purchase-order',objectId:row.purchaseOrderNo,action:'修改采购物流信息',beforeValue:before,afterValue:`${row.trackingNo} · ${row.qty} ${row.unit}`,reason:'',actorId:actor.id,actorName:actor.name,actorRole:actor.role});return row
 },operationId,signature)
}

export function pmsMaterialPurchaseInboundAvailability(order:PmsMaterialPurchaseOrder,lineId:string):{source:'实际采购量'|'商家到货量'|'未登记实际量';quantity:number;remaining:number} {
 const line=findPmsMaterialPurchaseOrderLine(order,lineId)
 if(!line)throw new PmsDomainError('MPO_LINE_MISSING','采购SKU不存在')
 const source=line.actualPurchasedQty>0?'实际采购量':line.sellerReceivedQty>0?'商家到货量':'未登记实际量',quantity=line.actualPurchasedQty>0?line.actualPurchasedQty:line.sellerReceivedQty
 return {source,quantity,remaining:Math.max(0,quantity-line.inboundQty)}
}
export async function inboundPmsMaterialPurchaseLogistics(inputs:Array<{recordNo:string;quantity:number;warehouse:string}>,actor:PurchaseActor,operationId:string):Promise<PmsMaterialPurchaseOrder[]> {
 const signature=JSON.stringify([inputs,actor]),replay=await readPurchaseActionReplay(operationId,signature);if(replay)return replay
 return commitPurchase(()=>{
  assertPurchaseActor(actor)
  if(!inputs.length||new Set(inputs.map(input=>input.recordNo)).size!==inputs.length)throw new PmsDomainError('MPO_INBOUND_DUPLICATE','选择不重复的运单明细')
  const touched=new Map<string,PmsMaterialPurchaseOrder>()
  for(const input of inputs){
   const record=getPmsMaterialLogisticsRecord(input.recordNo);if(!record)throw new PmsDomainError('MPO_LOGISTICS_MISSING','运单明细不存在或已删除')
   const order=editableOrdinaryPurchase(record.purchaseOrderNo,actor)
   if(order.rejectedReason || ['待采购','草稿'].includes(order.status))throw new PmsDomainError('MPO_INBOUND_NOT_PLACED','已下单且未驳回的普通采购单可以按运单入库')
   const lines=getPmsMaterialPurchaseOrderLines(order),identity=resolveLogisticsPurchaseLine(order,record).lineId,line=lines.find(item=>item.lineId===identity)!,available=pmsMaterialPurchaseInboundAvailability(order,line.lineId),recordRemainder=record.qty-(record.inboundQty||0)
   if(!input.warehouse.trim() || !Number.isFinite(input.quantity)||input.quantity<=0)throw new PmsDomainError('MPO_INBOUND_INVALID','选择入库仓，本次入库量须大于0')
   if(!available.quantity)throw new PmsDomainError('MPO_INBOUND_SOURCE_REQUIRED','先登记此SKU的实际采购量或商家到货量，不能按计划量入库')
   if(input.quantity>recordRemainder+0.000001 || input.quantity>available.remaining+0.000001)throw new PmsDomainError('MPO_INBOUND_OVER',`${line.materialCode} 本次入库不能超过运单余量 ${recordRemainder} ${line.unit} 或${available.source}可入库量 ${available.remaining} ${line.unit}`)
   if(!line.imageUrl)throw new PmsDomainError('MPO_INVENTORY_SOURCE','入库SKU需要对应物料图片')
   const postings=order.inventoryPostings ||= []
   for(const old of [order.inventoryPosting?{...order.inventoryPosting,quality:'正常' as const}:undefined,order.defectInventoryPosting?{...order.defectInventoryPosting,quality:'瑕疵' as const}:undefined])if(old&&!postings.some(item=>item.id===old.id))postings.push({...structuredClone(old),purchaseLineId:lines.length===1?line.lineId:old.purchaseLineId})
   const inspection=order.inspections?.find(item=>item.purchaseLineId===line.lineId)||(lines.length===1?order.inspection:undefined),knownDefect=inspection?.defectQty||0,previousDefect=postings.filter(item=>item.purchaseLineId===line.lineId&&item.quality==='瑕疵').reduce((sum,item)=>sum+item.qty,0),defect=Math.min(input.quantity,Math.max(0,knownDefect-previousDefect)),normal=input.quantity-defect,postedAt=new Date().toISOString()
   const addPosting=(quality:'正常'|'瑕疵',qty:number,warehouse:string)=>{
    if(!qty)return
    const id=`MPO-IN:${record.recordNo}:${quality}`,previous=postings.find(item=>item.id===id)
    if(previous&&previous.warehouse!==warehouse)throw new PmsDomainError('MPO_INBOUND_WAREHOUSE_LOCK','同一运单明细已入此仓，后续入库使用相同仓库')
    const candidate={id,purchaseLineId:line.lineId,sourceLogisticsRecordNo:record.recordNo,sourcePurchaseOrderNo:order.purchaseOrderNo,materialCode:line.materialCode,materialName:line.materialName,imageUrl:line.imageUrl,warehouse,qty:(previous?.qty||0)+qty,unit:line.unit,postedAt,operator:actor.name,sourceKind:'local-demo' as const,quality}
    if(previous)Object.assign(previous,candidate);else postings.push(candidate)
   }
   addPosting('正常',normal,input.warehouse.trim())
   if(defect){if(!inspection?.warehouse?.trim()||inspection.warehouse.trim()===input.warehouse.trim())throw new PmsDomainError('MPO_DEFECT_WAREHOUSE_REQUIRED','该SKU已登记瑕疵，选择与正常入库仓不同的瑕疵仓');addPosting('瑕疵',defect,inspection.warehouse.trim())}
   line.inboundQty+=input.quantity;order.lines=lines;order.updatedAt=postedAt;syncPmsMaterialPurchaseLineProjection(order)
   order.status=lines.every(item=>item.inboundQty>=(item.actualPurchasedQty||item.orderedQty))?'已入库':'部分到货'
   record.inboundQty=(record.inboundQty||0)+input.quantity;record.inboundWarehouse=input.warehouse.trim();record.inboundAt=postedAt;record.inboundBy=actor.name;record.lastOperationId=operationId
   logPurchaseEdit(order,'运单入库',`${record.trackingNo} ${line.materialCode} 已入 ${record.inboundQty-input.quantity} ${line.unit}`,`本次 ${input.quantity} ${line.unit} → ${input.warehouse.trim()}；依据${available.source}`,actor)
   touched.set(order.purchaseOrderNo,order)
  }
  return [...touched.values()]
 },operationId,signature)
}

export async function registerAndInboundPmsMaterialPurchases(entries:Array<{purchaseOrderNo:string;materialCode:string;quantity:number}>,actor:{id:string;name:string;role:PmsActorRole},operationId:string):Promise<PmsMaterialPurchaseOrder[]>{
 if(!entries.length||new Set(entries.map(row=>row.purchaseOrderNo)).size!==entries.length)throw new PmsDomainError('MPO_INBOUND_DUPLICATE','选择不重复的采购单')
 return commitPurchase(()=>entries.map(entry=>{const order=getPmsMaterialPurchaseOrder(entry.purchaseOrderNo);if(!order||order.materialCode!==entry.materialCode)throw new PmsDomainError('MPO_INBOUND_SKU','采购单和SKU须一致');prepareRegisterPmsMaterialPurchaseArrival(entry.purchaseOrderNo,entry.quantity,actor);return prepareAdvancePmsMaterialPurchaseOrderStatus(entry.purchaseOrderNo,'已入库',actor)}),operationId,JSON.stringify([entries,actor]))
}

export async function convertPmsMaterialPurchaseType(orderNo:string,kind:'原料'|'辅料',actor:PurchaseActor,operationId:string):Promise<PmsMaterialPurchaseOrder>{
  const signature=JSON.stringify([orderNo,kind,actor]),replay=await readPurchaseActionReplay(operationId,signature);if(replay)return replay[0]
  return commitPurchase(()=>{const order=editableOrdinaryPurchase(orderNo,actor);if(!['原料','辅料'].includes(kind)||order.materialType==='样衣'||order.materialType===kind)throw new PmsDomainError('MPO_TYPE_LOCKED','选择尚未转换的普通物料采购单');const before=order.materialType;order.materialType=kind;order.updatedAt=new Date().toISOString();logPurchaseEdit(order,`转${kind}采购`,before,kind,actor,'保留SKU、单位和数量，仅调整采购分类');return order},operationId,signature)
}
export async function convertPmsMaterialPurchaseToRaw(orderNo:string,actor:PurchaseActor,operationId:string):Promise<PmsMaterialPurchaseOrder>{return convertPmsMaterialPurchaseType(orderNo,'原料',actor,operationId)}

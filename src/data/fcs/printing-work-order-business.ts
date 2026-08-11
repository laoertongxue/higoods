export type PrintingDemandSourceType = 'PRODUCTION' | 'PURCHASE' | 'STOCK' | 'SUPPLEMENT'
export type PrintingProcessingStatus = 'WAIT_ASSIGN' | 'WAIT_INPUT_RECEIPT' | 'PROCESSING' | 'PROCESS_COMPLETED' | 'CANCELLED'
export type PrintingHandoverStatus = 'NOT_STARTED' | 'WAIT_HANDOVER' | 'PARTIAL_HANDOVER' | 'HANDOVER_WAIT_RECEIVE' | 'PARTIAL_RECEIVED' | 'RECEIVED'
export type PrintingQtyUnit = 'Yard'

export const PRINTING_DEMAND_SOURCE_LABEL: Record<PrintingDemandSourceType, string> = {
  PRODUCTION: '生产',
  PURCHASE: '采购',
  STOCK: '备货',
  SUPPLEMENT: '补料',
}

export const PRINTING_PROCESSING_STATUSES: ReadonlyArray<{ value: PrintingProcessingStatus; label: string }> = [
  { value: 'WAIT_ASSIGN', label: '待分配' },
  { value: 'WAIT_INPUT_RECEIPT', label: '待接收投入' },
  { value: 'PROCESSING', label: '加工中' },
  { value: 'PROCESS_COMPLETED', label: '加工完成' },
  { value: 'CANCELLED', label: '已取消' },
]

export const PRINTING_HANDOVER_STATUSES: ReadonlyArray<{ value: PrintingHandoverStatus; label: string }> = [
  { value: 'NOT_STARTED', label: '未开始' },
  { value: 'WAIT_HANDOVER', label: '待交出' },
  { value: 'PARTIAL_HANDOVER', label: '部分交出' },
  { value: 'HANDOVER_WAIT_RECEIVE', label: '已交出待接收' },
  { value: 'PARTIAL_RECEIVED', label: '部分接收' },
  { value: 'RECEIVED', label: '已接收' },
]

export const PRINTING_PROCESSING_STATUS_LABEL = Object.fromEntries(
  PRINTING_PROCESSING_STATUSES.map((item) => [item.value, item.label]),
) as Record<PrintingProcessingStatus, string>

export const PRINTING_HANDOVER_STATUS_LABEL = Object.fromEntries(
  PRINTING_HANDOVER_STATUSES.map((item) => [item.value, item.label]),
) as Record<PrintingHandoverStatus, string>

export interface PrintingImageIdentity {
  imageUrl: string
  imageAlt: string
}

export interface PrintingProductIdentity extends PrintingImageIdentity {
  spu: string
  productName: string
}

export interface PrintingDemandSource {
  type: PrintingDemandSourceType
  sourceNo: string
  sourceLabel: string
  demandNo?: string
  productionOrderNo?: string
  purchaseOrderNo?: string
  stockPlanNo?: string
  supplementOrderNo?: string
  originalProductionOrderNo?: string
}

export interface PrintingUsageBasis {
  calculationMode: 'BY_USAGE' | 'DIRECT'
  demandBaseQty: number
  demandBaseUnit: string
  standardUnitUsage: number | null
  orderUnitUsage: number | null
  usageUnit: string
  formulaLabel: string
}

export interface PrintingMaterialIdentity extends PrintingImageIdentity {
  objectType: '面料'
  materialName: string
  spu: string
  sku: string
  gsm: number
  widthCm: number
}

export interface PrintingPlannedInput extends PrintingMaterialIdentity {
  plannedQty: number
  qtyUnit: PrintingQtyUnit
  supplySource: string
  sourceWarehouseName: string
  sourceWarehouseStockQty: number
  pendingWarehouseStockQty: number
  whiteStockQty: number
  currentStockQty: number
  pendingPrintQty: number
}

export interface PrintingActualInput {
  actualSku: string
  receivedQty: number
  receivedRollCount: number
  usedQty: number
  usedRollCount: number
  receiverName: string
  receivedAt?: string
}

export interface PrintingPatternIdentity extends PrintingImageIdentity {
  patternNo: string
  patternVersion: string
  patternName: string
}

export interface PrintingRequirement {
  craftName: string
  type: string
  shade: string
  temperature: string
  printSide: '单面' | '双面'
  frontPattern: PrintingPatternIdentity
  insidePattern?: PrintingPatternIdentity
}

export interface PrintingOutput extends PrintingMaterialIdentity {
  plannedQty: number
  completedQty: number
  completedRollCount: number
  qtyUnit: PrintingQtyUnit
}

export interface PrintingHandoverFacts {
  handedOverQty: number
  receivedQty: number
  diffQty: number
  objectionQty: number
  handoverNo?: string
  receiverName: string
  handedOverAt?: string
  receivedAt?: string
  differenceReason?: string
}

export interface PrintingInputChangeRecord {
  changeId: string
  originalInput: PrintingPlannedInput
  newInput: PrintingPlannedInput
  originalStandardUnitUsage: number | null
  newStandardUnitUsage: number | null
  originalOrderUnitUsage: number | null
  newOrderUnitUsage: number | null
  reason: string
  operatorName: string
  changedAt: string
  crossSpecification: boolean
}

export interface PrintingOperationLog {
  logId: string
  action: string
  operatorName: string
  operatedAt: string
  remark: string
}

export interface PrintingDocumentHistory {
  historyId: string
  documentName: '印花信息单' | '印花确认单' | '加工产出卷条码'
  action: '打印' | '下载' | '补打' | '标记需重印'
  operatorName: string
  operatedAt: string
  versionNo: string
  remark?: string
}

export interface PrintingRollBarcode {
  id: string
  barcode: string
  printOrderNo: string
  sku: string
  status: '草稿' | '已打印' | '已交出' | '已入库'
  rollNo: string
  lengthY: number
  meters: number
  weightKg: number
  gsm: number
  widthCm: number
  vatNo: string
  warehouseName: string
  inboundStatus: '待上架' | '已上架'
  inboundAt?: string
  printedBy?: string
  printedAt?: string
  remark?: string
}

export interface PrintingWorkOrderBusinessRecord {
  workOrderId: string
  printOrderNo: string
  taskNo: string
  salesType: string
  creationMethod: string
  materialType: string
  historicalSupplement: boolean
  legacyProgressHint: string
  demandSource: PrintingDemandSource
  product: PrintingProductIdentity
  usage: PrintingUsageBasis
  plannedInput: PrintingPlannedInput
  actualInput: PrintingActualInput
  requirement: PrintingRequirement
  output: PrintingOutput
  processingStatus: PrintingProcessingStatus
  handoverStatus: PrintingHandoverStatus
  handover: PrintingHandoverFacts
  printFactoryId: string
  printFactoryName: string
  printerNo: string
  transferCompletedQty: number
  pendingWritebackQty: number
  historicalLossQty: number
  orderedAt: string
  inputReceivedAt?: string
  completedAt?: string
  deliveryAt?: string
  remark: string
  inputChanges: PrintingInputChangeRecord[]
  barcodes: PrintingRollBarcode[]
  documentHistory: PrintingDocumentHistory[]
  operationLogs: PrintingOperationLog[]
  printingDocumentsNeedReprint: boolean
}

export interface PrintingWorkOrderSummary {
  orderCount: number
  plannedInputQty: number
  usedInputQty: number
  completedOutputQty: number
  handedOverQty: number
  receivedQty: number
}

function round(value: number, precision: number): number {
  const scale = 10 ** precision
  return Math.round((value + Number.EPSILON) * scale) / scale
}

export function metersFromYards(yards: number): number {
  return round(yards * 0.9144, 2)
}

export function yardsFromMeters(meters: number): number {
  return round(meters / 0.9144, 2)
}

export function weightKgFromMeters(meters: number, widthCm: number, gsm: number): number {
  return round(meters * (widthCm / 100) * (gsm / 1000), 3)
}

export function formatPrintingQty(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00'
}

export function formatPrintingUsage(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '直接数量'
  return value.toFixed(4)
}

export function formatPrintingWeightKg(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : '0.000'
}

function nowTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function calculatePlannedInput(usage: PrintingUsageBasis, directQty: number): number {
  if (usage.calculationMode === 'DIRECT') return round(directQty, 2)
  if (usage.orderUnitUsage === null) throw new Error('按用量计算时必须填写加工单单位用量')
  return round(usage.demandBaseQty * usage.orderUnitUsage, 2)
}

function makeBarcode(input: {
  printOrderNo: string
  outputSku: string
  rollIndex: number
  lengthY: number
  gsm: number
  widthCm: number
  status?: PrintingRollBarcode['status']
}): PrintingRollBarcode {
  const rollNo = String(input.rollIndex + 1).padStart(4, '0')
  const meters = metersFromYards(input.lengthY)
  return {
    id: `ROLL-${input.printOrderNo}-${rollNo}`,
    barcode: `M_${input.printOrderNo.replace(/\D/g, '') || 'PRINT'}_${input.printOrderNo}_${rollNo}`,
    printOrderNo: input.printOrderNo,
    sku: input.outputSku,
    status: input.status || '草稿',
    rollNo,
    lengthY: round(input.lengthY, 2),
    meters,
    weightKg: weightKgFromMeters(meters, input.widthCm, input.gsm),
    gsm: input.gsm,
    widthCm: input.widthCm,
    vatNo: '',
    warehouseName: 'HILON-面料仓',
    inboundStatus: '待上架',
  }
}

function makeBarcodes(input: {
  printOrderNo: string
  outputSku: string
  completedQty: number
  completedRollCount: number
  plannedRollCount: number
  gsm: number
  widthCm: number
  handedOver?: boolean
  received?: boolean
}): PrintingRollBarcode[] {
  const count = Math.max(input.completedRollCount || input.plannedRollCount || 1, 1)
  const lengthY = input.completedQty > 0 ? round(input.completedQty / count, 2) : 0
  return Array.from({ length: count }, (_, rollIndex) => {
    const status: PrintingRollBarcode['status'] = input.received ? '已入库' : input.handedOver ? '已交出' : '草稿'
    const record = makeBarcode({ ...input, rollIndex, lengthY, status })
    if (input.received) {
      record.inboundStatus = '已上架'
      record.inboundAt = '2026-08-10 10:30:00'
    }
    return record
  })
}

const fabricInputImage = '/materials/fabric-main.jpg'
const fabricOutputImage = '/materials/fabric-contrast.jpg'
const fabricInsideImage = '/materials/fabric-lining.jpg'

function createRecord(input: {
  workOrderId: string
  printOrderNo: string
  taskNo: string
  source: PrintingDemandSource
  product: PrintingProductIdentity
  usage: PrintingUsageBasis
  directPlannedQty?: number
  plannedInput: Omit<PrintingPlannedInput, 'plannedQty' | 'qtyUnit'>
  output: Omit<PrintingOutput, 'plannedQty' | 'qtyUnit'>
  requirement: PrintingRequirement
  processingStatus: PrintingProcessingStatus
  handoverStatus: PrintingHandoverStatus
  actualInput?: Partial<PrintingActualInput>
  handover?: Partial<PrintingHandoverFacts>
  salesType: string
  creationMethod: string
  historicalSupplement?: boolean
  legacyProgressHint: string
  printFactoryName?: string
  printFactoryId?: string
  printerNo?: string
  plannedRollCount?: number
  transferCompletedQty?: number
  pendingWritebackQty?: number
  historicalLossQty?: number
  orderedAt: string
  inputReceivedAt?: string
  completedAt?: string
  deliveryAt?: string
  remark?: string
}): PrintingWorkOrderBusinessRecord {
  const plannedQty = calculatePlannedInput(input.usage, input.directPlannedQty || input.output.completedQty || 0)
  const plannedInput: PrintingPlannedInput = { ...input.plannedInput, plannedQty, qtyUnit: 'Yard' }
  const output: PrintingOutput = { ...input.output, plannedQty, qtyUnit: 'Yard' }
  const actualInput: PrintingActualInput = {
    actualSku: '',
    receivedQty: 0,
    receivedRollCount: 0,
    usedQty: 0,
    usedRollCount: 0,
    receiverName: '未接收',
    ...input.actualInput,
  }
  const handover: PrintingHandoverFacts = {
    handedOverQty: 0,
    receivedQty: 0,
    diffQty: 0,
    objectionQty: 0,
    receiverName: '未指定',
    ...input.handover,
  }
  const barcodes = makeBarcodes({
    printOrderNo: input.printOrderNo,
    outputSku: output.sku,
    completedQty: output.completedQty,
    completedRollCount: output.completedRollCount,
    plannedRollCount: input.plannedRollCount || 1,
    gsm: output.gsm,
    widthCm: output.widthCm,
    handedOver: handover.handedOverQty > 0,
    received: handover.receivedQty >= output.completedQty && output.completedQty > 0,
  })
  return {
    workOrderId: input.workOrderId,
    printOrderNo: input.printOrderNo,
    taskNo: input.taskNo,
    salesType: input.salesType,
    creationMethod: input.creationMethod,
    materialType: '主面料',
    historicalSupplement: Boolean(input.historicalSupplement),
    legacyProgressHint: input.legacyProgressHint,
    demandSource: input.source,
    product: input.product,
    usage: input.usage,
    plannedInput,
    actualInput,
    requirement: input.requirement,
    output,
    processingStatus: input.processingStatus,
    handoverStatus: input.handoverStatus,
    handover,
    printFactoryId: input.printFactoryId || 'F090',
    printFactoryName: input.printFactoryName || 'FLOWER 印花厂',
    printerNo: input.printerNo || '未分配',
    transferCompletedQty: input.transferCompletedQty || 0,
    pendingWritebackQty: input.pendingWritebackQty || 0,
    historicalLossQty: input.historicalLossQty || 0,
    orderedAt: input.orderedAt,
    inputReceivedAt: input.inputReceivedAt,
    completedAt: input.completedAt,
    deliveryAt: input.deliveryAt,
    remark: input.remark || '',
    inputChanges: [],
    barcodes,
    documentHistory: [],
    operationLogs: [
      {
        logId: `LOG-${input.printOrderNo}-CREATE`,
        action: '创建印花加工单',
        operatorName: '生产计划员',
        operatedAt: input.orderedAt,
        remark: `${PRINTING_DEMAND_SOURCE_LABEL[input.source.type]}需求创建`,
      },
    ],
    printingDocumentsNeedReprint: false,
  }
}

function buildSeedRecords(): PrintingWorkOrderBusinessRecord[] {
  return [
    createRecord({
      workOrderId: 'PWO-25336', printOrderNo: 'YH25336', taskNo: 'TK78836',
      source: { type: 'PRODUCTION', sourceNo: 'PO16381', sourceLabel: '生产单 PO16381', demandNo: '338235', productionOrderNo: 'PO16381' },
      product: { spu: 'ASYSA26070918', productName: '条纹女装上衣', imageUrl: '/shirt-sample.jpg', imageAlt: 'ASYSA26070918 条纹女装上衣实拍图' },
      usage: { calculationMode: 'BY_USAGE', demandBaseQty: 350, demandBaseUnit: '件', standardUnitUsage: 1.1800, orderUnitUsage: 1.1917, usageUnit: 'Yard/件', formulaLabel: '350 件 × 1.1917 Yard/件' },
      plannedInput: { objectType: '面料', materialName: '细冰丝坑条 Td-s025 白胚', spu: 'CNIDML009', sku: 'CNIDML009-white', imageUrl: fabricInputImage, imageAlt: '细冰丝坑条白胚面料实拍图', gsm: 220, widthCm: 165, supplySource: '印花待加工仓备料', sourceWarehouseName: 'HILON 普通仓', sourceWarehouseStockQty: 0, pendingWarehouseStockQty: 5.71, whiteStockQty: 3689.57, currentStockQty: 0, pendingPrintQty: 417.10 },
      output: { objectType: '面料', materialName: '细冰丝坑条乱印面料', spu: 'CNIDML009', sku: 'CNIDML009-ge001103', imageUrl: fabricOutputImage, imageAlt: '细冰丝坑条乱印成品面料实拍图', gsm: 220, widthCm: 165, completedQty: 0, completedRollCount: 0 },
      requirement: { craftName: '乱印', type: '数码印花', shade: '标准', temperature: '按工艺卡', printSide: '单面', frontPattern: { patternNo: 'GE001103', patternVersion: 'V1', patternName: '几何条纹', imageUrl: fabricOutputImage, imageAlt: 'GE001103 几何条纹花型图' } },
      processingStatus: 'WAIT_INPUT_RECEIPT', handoverStatus: 'NOT_STARTED', salesType: '预售', creationMethod: '生产单创建', legacyProgressHint: '等打印', plannedRollCount: 3, orderedAt: '2026-08-06 14:26:39', remark: '首批生产面料，按确认花型执行',
    }),
    createRecord({
      workOrderId: 'PWO-25337', printOrderNo: 'YH25337', taskNo: 'TK78837',
      source: { type: 'PURCHASE', sourceNo: 'CG-260806-118', sourceLabel: '采购单 CG-260806-118', purchaseOrderNo: 'CG-260806-118' },
      product: { spu: 'ASYSA26070918', productName: '双面印花女装上衣', imageUrl: '/dress-sample-1.jpg', imageAlt: 'ASYSA26070918 双面印花女装实拍图' },
      usage: { calculationMode: 'DIRECT', demandBaseQty: 130.29, demandBaseUnit: 'Yard', standardUnitUsage: null, orderUnitUsage: null, usageUnit: '直接数量', formulaLabel: '采购需求直接指定 130.29 Yard' },
      directPlannedQty: 130.29,
      plannedInput: { objectType: '面料', materialName: '细冰丝坑条 Td-s025 白胚', spu: 'CNIDML009', sku: 'CNIDML009-white', imageUrl: fabricInputImage, imageAlt: '细冰丝坑条白胚面料实拍图', gsm: 220, widthCm: 165, supplySource: '采购到货直送印花待加工仓', sourceWarehouseName: '供应商直送', sourceWarehouseStockQty: 130.29, pendingWarehouseStockQty: 0, whiteStockQty: 0, currentStockQty: 130.29, pendingPrintQty: 130.29 },
      output: { objectType: '面料', materialName: '细冰丝坑条双面印花面料', spu: 'CNIDML009', sku: 'CNIDML009-ge001105-st001106-AB', imageUrl: fabricInsideImage, imageAlt: '细冰丝坑条双面印花成品面料实拍图', gsm: 220, widthCm: 165, completedQty: 0, completedRollCount: 0 },
      requirement: { craftName: '乱印', type: '数码印花', shade: '标准', temperature: '按工艺卡', printSide: '双面', frontPattern: { patternNo: 'GE001105', patternVersion: 'V1', patternName: '正面几何花型', imageUrl: fabricOutputImage, imageAlt: 'GE001105 正面几何花型图' }, insidePattern: { patternNo: 'ST001106', patternVersion: 'V1', patternName: '里面条纹花型', imageUrl: fabricInsideImage, imageAlt: 'ST001106 里面条纹花型图' } },
      processingStatus: 'WAIT_ASSIGN', handoverStatus: 'NOT_STARTED', salesType: '采购备料', creationMethod: '采购单创建', legacyProgressHint: '等待处理', plannedRollCount: 2, orderedAt: '2026-08-06 14:26:39', remark: '采购目标为双面印花成品面料',
    }),
    createRecord({
      workOrderId: 'PWO-25347', printOrderNo: 'YH25347', taskNo: 'TK78874',
      source: { type: 'PRODUCTION', sourceNo: 'PO16385', sourceLabel: '生产单 PO16385', demandNo: '333819', productionOrderNo: 'PO16385' },
      product: { spu: 'ASYXL121866', productName: '定向印花连衣裙', imageUrl: '/lace-dress-sample.jpg', imageAlt: 'ASYXL121866 定向印花连衣裙实拍图' },
      usage: { calculationMode: 'BY_USAGE', demandBaseQty: 1200, demandBaseUnit: '件', standardUnitUsage: 1.5200, orderUnitUsage: 1.5600, usageUnit: 'Yard/件', formulaLabel: '1,200 件 × 1.5600 Yard/件' },
      plannedInput: { objectType: '面料', materialName: '四面弹 120g S98 白胚', spu: 'CNIDML076', sku: 'CNIDML076-white', imageUrl: fabricInputImage, imageAlt: '四面弹 120g S98 白胚面料实拍图', gsm: 120, widthCm: 152, supplySource: 'HILON 普通仓配料', sourceWarehouseName: 'HILON 普通仓', sourceWarehouseStockQty: 5022, pendingWarehouseStockQty: 160176.95, whiteStockQty: 0, currentStockQty: 0, pendingPrintQty: 0 },
      output: { objectType: '面料', materialName: '四面弹定向印花面料', spu: 'CNIDML076', sku: 'CNIDML076-asyxl121866-s98-sameasphoto', imageUrl: fabricOutputImage, imageAlt: '四面弹定向印花成品面料实拍图', gsm: 120, widthCm: 152, completedQty: 1858.05, completedRollCount: 12 },
      requirement: { craftName: '定向印', type: '热转印', shade: '跟图', temperature: '200℃', printSide: '单面', frontPattern: { patternNo: 'ASYXL121866', patternVersion: 'V2', patternName: '跟图定向花型', imageUrl: fabricOutputImage, imageAlt: 'ASYXL121866 跟图定向花型图' } },
      processingStatus: 'PROCESS_COMPLETED', handoverStatus: 'HANDOVER_WAIT_RECEIVE', actualInput: { receivedQty: 1872, receivedRollCount: 12, usedQty: 1872, usedRollCount: 12, receiverName: 'Hilon', receivedAt: '2026-08-07 08:10:00' }, handover: { handedOverQty: 1858.05, receivedQty: 0, receiverName: '裁床面料接收人', handoverNo: 'JC-260810-047', handedOverAt: '2026-08-10 19:56:25' }, salesType: '预售', creationMethod: '生产单创建', legacyProgressHint: '待审核（历史）', printFactoryName: 'FLOWER 印花厂', printerNo: 'PR-03', plannedRollCount: 12, transferCompletedQty: 1858.05, orderedAt: '2026-08-06 15:56:34', inputReceivedAt: '2026-08-07 08:10:00', completedAt: '2026-08-10 18:40:00', deliveryAt: '2026-08-10 19:56:25', remark: '已加工完成并全部交出，等待下游清点接收',
    }),
    createRecord({
      workOrderId: 'PWO-25358', printOrderNo: 'YH25358', taskNo: 'TK78984',
      source: { type: 'STOCK', sourceNo: 'BH-260806-021', sourceLabel: '备货计划 BH-260806-021', stockPlanNo: 'BH-260806-021' },
      product: { spu: 'CHCMY26062204', productName: '备货印花短袖', imageUrl: '/tshirt-sample.jpg', imageAlt: 'CHCMY26062204 备货印花短袖实拍图' },
      usage: { calculationMode: 'DIRECT', demandBaseQty: 1412.43, demandBaseUnit: 'Yard', standardUnitUsage: null, orderUnitUsage: null, usageUnit: '直接数量', formulaLabel: '备货计划直接指定 1,412.43 Yard' },
      directPlannedQty: 1412.43,
      plannedInput: { objectType: '面料', materialName: '平纹 120g S573 白胚', spu: 'CNIDML002', sku: 'CNIDML002-white', imageUrl: fabricInputImage, imageAlt: '平纹 120g S573 白胚面料实拍图', gsm: 120, widthCm: 152, supplySource: '印花待加工仓库存', sourceWarehouseName: '印花待加工仓', sourceWarehouseStockQty: 46944.03, pendingWarehouseStockQty: 0, whiteStockQty: 0, currentStockQty: 1412.43, pendingPrintQty: 1412.43 },
      output: { objectType: '面料', materialName: '平纹乱印成品面料', spu: 'CNIDML002', sku: 'CNIDML002-ge000748', imageUrl: fabricOutputImage, imageAlt: '平纹乱印成品面料实拍图', gsm: 120, widthCm: 152, completedQty: 0, completedRollCount: 0 },
      requirement: { craftName: '乱印', type: '数码印花', shade: '标准', temperature: '按工艺卡', printSide: '单面', frontPattern: { patternNo: 'GE000748', patternVersion: 'V1', patternName: '备货几何花型', imageUrl: fabricOutputImage, imageAlt: 'GE000748 备货几何花型图' } },
      processingStatus: 'PROCESSING', handoverStatus: 'NOT_STARTED', actualInput: { receivedQty: 1412.43, receivedRollCount: 9, usedQty: 980.00, usedRollCount: 6, receiverName: 'Hilon', receivedAt: '2026-08-07 09:20:00' }, salesType: '备货', creationMethod: '备货计划创建', legacyProgressHint: '等打印（历史）', printerNo: 'PR-05', plannedRollCount: 9, orderedAt: '2026-08-06 22:42:40', inputReceivedAt: '2026-08-07 09:20:00', remark: '现场正在加工，只维护加工中状态',
    }),
    createRecord({
      workOrderId: 'PWO-25359', printOrderNo: 'YH25359', taskNo: 'TK78985',
      source: { type: 'SUPPLEMENT', sourceNo: 'BL-260806-009', sourceLabel: '补料单 BL-260806-009', demandNo: '338505', productionOrderNo: 'PO16396', supplementOrderNo: 'BL-260806-009', originalProductionOrderNo: 'PO16396' },
      product: { spu: 'CHCMY26062204', productName: '补料印花短袖', imageUrl: '/jacket-sample.jpg', imageAlt: 'CHCMY26062204 补料印花商品实拍图' },
      usage: { calculationMode: 'BY_USAGE', demandBaseQty: 420, demandBaseUnit: '件', standardUnitUsage: 1.5400, orderUnitUsage: 1.5624, usageUnit: 'Yard/件', formulaLabel: '420 件 × 1.5624 Yard/件' },
      plannedInput: { objectType: '面料', materialName: '平纹 120g S573 白胚', spu: 'CNIDML002', sku: 'CNIDML002-white', imageUrl: fabricInputImage, imageAlt: '平纹 120g S573 补料白胚面料实拍图', gsm: 120, widthCm: 152, supplySource: '原生产单补料配料', sourceWarehouseName: 'HILON 普通仓', sourceWarehouseStockQty: 11759, pendingWarehouseStockQty: 46944.03, whiteStockQty: 0, currentStockQty: 656.21, pendingPrintQty: 0 },
      output: { objectType: '面料', materialName: '平纹补料乱印面料', spu: 'CNIDML002', sku: 'CNIDML002-ge000747', imageUrl: fabricOutputImage, imageAlt: '平纹补料乱印成品面料实拍图', gsm: 120, widthCm: 152, completedQty: 640, completedRollCount: 5 },
      requirement: { craftName: '乱印', type: '数码印花', shade: '标准', temperature: '按工艺卡', printSide: '单面', frontPattern: { patternNo: 'GE000747', patternVersion: 'V1', patternName: '补料几何花型', imageUrl: fabricOutputImage, imageAlt: 'GE000747 补料几何花型图' } },
      processingStatus: 'PROCESS_COMPLETED', handoverStatus: 'PARTIAL_RECEIVED', actualInput: { receivedQty: 656.21, receivedRollCount: 5, usedQty: 650, usedRollCount: 5, receiverName: 'Hilon', receivedAt: '2026-08-07 09:25:00' }, handover: { handedOverQty: 640, receivedQty: 500, diffQty: 0, objectionQty: 1, receiverName: '裁床面料接收人', handoverNo: 'JC-260810-059', handedOverAt: '2026-08-10 20:20:00', receivedAt: '2026-08-10 20:50:00', differenceReason: '余下 140.00 Yard 待清点' }, salesType: '补料', creationMethod: '补料单创建', historicalSupplement: true, legacyProgressHint: '部分入库（历史）', printerNo: 'PR-05', plannedRollCount: 5, transferCompletedQty: 640, pendingWritebackQty: 140, orderedAt: '2026-08-06 22:42:40', inputReceivedAt: '2026-08-07 09:25:00', completedAt: '2026-08-10 19:30:00', deliveryAt: '2026-08-10 20:20:00', remark: '补料印花已交出，存在一条待处理异议',
    }),
    createRecord({
      workOrderId: 'PWO-24013', printOrderNo: 'YH24013', taskNo: 'TK69923',
      source: { type: 'PRODUCTION', sourceNo: 'PO15501', sourceLabel: '生产单 PO15501', demandNo: '326679', productionOrderNo: 'PO15501' },
      product: { spu: 'ASYYA88061501', productName: 'KOL 样衣印花上衣', imageUrl: '/cardigan-sample.jpg', imageAlt: 'ASYYA88061501 KOL 样衣实拍图' },
      usage: { calculationMode: 'BY_USAGE', demandBaseQty: 40, demandBaseUnit: '件', standardUnitUsage: 1.1800, orderUnitUsage: 1.2000, usageUnit: 'Yard/件', formulaLabel: '40 件 × 1.2000 Yard/件' },
      plannedInput: { objectType: '面料', materialName: '四面弹 120g S98 白胚', spu: 'CNIDML076', sku: 'CNIDML076-white', imageUrl: fabricInputImage, imageAlt: '四面弹 120g S98 白胚面料实拍图', gsm: 120, widthCm: 152, supplySource: 'HILON 普通仓配料', sourceWarehouseName: 'HILON 普通仓', sourceWarehouseStockQty: 5022, pendingWarehouseStockQty: 164272.97, whiteStockQty: 0, currentStockQty: 0, pendingPrintQty: 0 },
      output: { objectType: '面料', materialName: '四面弹乱印成品面料', spu: 'CNIDML076', sku: 'CNIDML076-cnidml076-st000863', imageUrl: fabricOutputImage, imageAlt: '四面弹乱印成品面料实拍图', gsm: 120, widthCm: 152, completedQty: 47.03, completedRollCount: 1 },
      requirement: { craftName: '乱印', type: '数码印花', shade: '标准', temperature: '按工艺卡', printSide: '单面', frontPattern: { patternNo: 'ST000863', patternVersion: 'V1', patternName: '样衣条纹花型', imageUrl: fabricOutputImage, imageAlt: 'ST000863 样衣条纹花型图' } },
      processingStatus: 'PROCESS_COMPLETED', handoverStatus: 'RECEIVED', actualInput: { receivedQty: 48, receivedRollCount: 1, usedQty: 48, usedRollCount: 1, receiverName: 'goto', receivedAt: '2026-07-21 17:00:00' }, handover: { handedOverQty: 47.03, receivedQty: 47.03, diffQty: 0, objectionQty: 0, receiverName: 'goto', handoverNo: 'JC-24013', handedOverAt: '2026-07-22 09:03:16', receivedAt: '2026-07-22 10:10:00' }, salesType: 'KOL 样衣', creationMethod: '生产单创建', legacyProgressHint: '已完成（历史）', printerNo: 'PR-01', plannedRollCount: 1, transferCompletedQty: 47.03, orderedAt: '2026-07-21 16:08:48', inputReceivedAt: '2026-07-21 17:00:00', completedAt: '2026-07-22 08:40:00', deliveryAt: '2026-07-22 09:03:16', remark: '样衣面料已完成交出和接收',
    }),
  ]
}

let printingWorkOrders = buildSeedRecords()

function cloneRecord(record: PrintingWorkOrderBusinessRecord): PrintingWorkOrderBusinessRecord {
  return structuredClone(record)
}

function mutableRecord(workOrderId: string): PrintingWorkOrderBusinessRecord {
  const record = printingWorkOrders.find((item) => item.workOrderId === workOrderId || item.printOrderNo === workOrderId)
  if (!record) throw new Error('未找到印花加工单')
  return record
}

function addOperation(record: PrintingWorkOrderBusinessRecord, action: string, operatorName: string, remark: string): void {
  record.operationLogs.unshift({
    logId: `LOG-${record.printOrderNo}-${Date.now()}-${record.operationLogs.length + 1}`,
    action,
    operatorName,
    operatedAt: nowTimestamp(),
    remark,
  })
}

export function resetPrintingWorkOrderBusinessStore(): void {
  printingWorkOrders = buildSeedRecords()
}

export function listPrintingWorkOrders(): PrintingWorkOrderBusinessRecord[] {
  return printingWorkOrders.map(cloneRecord)
}

export function getPrintingWorkOrderById(workOrderId: string): PrintingWorkOrderBusinessRecord | undefined {
  const record = printingWorkOrders.find((item) => item.workOrderId === workOrderId || item.printOrderNo === workOrderId)
  return record ? cloneRecord(record) : undefined
}

export function getPrintingWorkOrderSummary(records = printingWorkOrders): PrintingWorkOrderSummary {
  return records.reduce<PrintingWorkOrderSummary>((summary, record) => ({
    orderCount: summary.orderCount + 1,
    plannedInputQty: round(summary.plannedInputQty + record.plannedInput.plannedQty, 2),
    usedInputQty: round(summary.usedInputQty + record.actualInput.usedQty, 2),
    completedOutputQty: round(summary.completedOutputQty + record.output.completedQty, 2),
    handedOverQty: round(summary.handedOverQty + record.handover.handedOverQty, 2),
    receivedQty: round(summary.receivedQty + record.handover.receivedQty, 2),
  }), { orderCount: 0, plannedInputQty: 0, usedInputQty: 0, completedOutputQty: 0, handedOverQty: 0, receivedQty: 0 })
}

export function isPrintingWorkOrderBusinessCompleted(record: PrintingWorkOrderBusinessRecord): boolean {
  return record.processingStatus === 'PROCESS_COMPLETED'
    && record.handoverStatus === 'RECEIVED'
    && record.handover.objectionQty === 0
}

export function assignPrintingWorkOrder(workOrderId: string, input: { factoryId: string; factoryName: string; operatorName: string }): void {
  const record = mutableRecord(workOrderId)
  if (record.processingStatus !== 'WAIT_ASSIGN') throw new Error('当前加工状态不能重新分配')
  if (!input.factoryId.trim() || !input.factoryName.trim()) throw new Error('必须选择加工厂')
  record.printFactoryId = input.factoryId.trim()
  record.printFactoryName = input.factoryName.trim()
  record.processingStatus = 'WAIT_INPUT_RECEIPT'
  addOperation(record, '分配加工厂', input.operatorName, `分配至 ${record.printFactoryName}`)
}

export function changePrintingInput(workOrderId: string, input: {
  newSku: string
  newMaterialName: string
  newImageUrl: string
  newGsm: number
  newWidthCm: number
  newStandardUnitUsage?: number | null
  newOrderUnitUsage?: number | null
  newPlannedQty?: number
  reason: string
  operatorName: string
}): PrintingInputChangeRecord {
  const record = mutableRecord(workOrderId)
  if (record.output.completedQty > 0) throw new Error('已产生完成数量，不能整单换料；请拆分剩余数量并创建新印花加工单')
  if (!input.newSku.trim() || !input.newMaterialName.trim()) throw new Error('新投入面料与 SKU 必填')
  if (!input.reason.trim()) throw new Error('必须填写投入调整原因')
  if (!(input.newGsm > 0) || !(input.newWidthCm > 0)) throw new Error('克重和幅宽必须大于 0')
  const originalInput = structuredClone(record.plannedInput)
  const crossSpecification = input.newGsm !== originalInput.gsm || input.newWidthCm !== originalInput.widthCm
  const nextStandardUsage = input.newStandardUnitUsage === undefined ? record.usage.standardUnitUsage : input.newStandardUnitUsage
  const nextOrderUsage = input.newOrderUnitUsage === undefined ? record.usage.orderUnitUsage : input.newOrderUnitUsage
  if (
    crossSpecification
    && record.usage.calculationMode === 'BY_USAGE'
    && (input.newOrderUnitUsage === undefined || input.newOrderUnitUsage === null || !(input.newOrderUnitUsage > 0))
  ) {
    throw new Error('跨规格换料必须重新确认加工单单位用量')
  }
  const nextUsage: PrintingUsageBasis = {
    ...record.usage,
    standardUnitUsage: nextStandardUsage ?? null,
    orderUnitUsage: nextOrderUsage ?? null,
  }
  const nextPlannedQty = nextUsage.calculationMode === 'DIRECT'
    ? round(input.newPlannedQty ?? record.plannedInput.plannedQty, 2)
    : calculatePlannedInput(nextUsage, record.plannedInput.plannedQty)
  if (!(nextPlannedQty > 0)) throw new Error('计划投入数量必须大于 0')
  const newInput: PrintingPlannedInput = {
    ...record.plannedInput,
    sku: input.newSku.trim(),
    materialName: input.newMaterialName.trim(),
    imageUrl: input.newImageUrl.trim() || record.plannedInput.imageUrl,
    imageAlt: `${input.newMaterialName.trim()}实拍图`,
    gsm: input.newGsm,
    widthCm: input.newWidthCm,
    plannedQty: nextPlannedQty,
  }
  const change: PrintingInputChangeRecord = {
    changeId: `PIC-${record.printOrderNo}-${Date.now()}`,
    originalInput,
    newInput: structuredClone(newInput),
    originalStandardUnitUsage: record.usage.standardUnitUsage,
    newStandardUnitUsage: nextUsage.standardUnitUsage,
    originalOrderUnitUsage: record.usage.orderUnitUsage,
    newOrderUnitUsage: nextUsage.orderUnitUsage,
    reason: input.reason.trim(),
    operatorName: input.operatorName,
    changedAt: nowTimestamp(),
    crossSpecification,
  }
  record.usage = nextUsage
  record.plannedInput = newInput
  record.output.plannedQty = nextPlannedQty
  if (record.actualInput.receivedQty > 0) record.actualInput.actualSku = newInput.sku
  record.inputChanges.unshift(change)
  record.printingDocumentsNeedReprint = true
  record.documentHistory.unshift({
    historyId: `PDH-${record.printOrderNo}-${Date.now()}`,
    documentName: '印花信息单',
    action: '标记需重印',
    operatorName: input.operatorName,
    operatedAt: change.changedAt,
    versionNo: `V${record.inputChanges.length + 1}`,
    remark: '加工投入发生变化；印花信息单与印花确认单需重新打印',
  })
  addOperation(record, '调整加工投入', input.operatorName, `${originalInput.sku} → ${newInput.sku}；${input.reason.trim()}`)
  return structuredClone(change)
}

export function receivePrintingInput(workOrderId: string, input: {
  actualSku: string
  receivedQty: number
  receivedRollCount: number
  receiverName: string
}): void {
  const record = mutableRecord(workOrderId)
  if (!['WAIT_INPUT_RECEIPT', 'PROCESSING'].includes(record.processingStatus)) throw new Error('当前加工状态不能接收投入')
  if (input.actualSku.trim() !== record.plannedInput.sku) throw new Error('实际投入 SKU 与计划不同，请先登记投入调整')
  if (!(input.receivedQty > 0) || !Number.isInteger(input.receivedRollCount) || input.receivedRollCount <= 0) throw new Error('接收数量和卷数必须大于 0')
  record.actualInput.actualSku = input.actualSku.trim()
  record.actualInput.receivedQty = round(record.actualInput.receivedQty + input.receivedQty, 2)
  record.actualInput.receivedRollCount += input.receivedRollCount
  record.actualInput.receiverName = input.receiverName.trim() || '加工厂接收人'
  record.actualInput.receivedAt = nowTimestamp()
  record.inputReceivedAt = record.actualInput.receivedAt
  record.processingStatus = 'PROCESSING'
  addOperation(record, '接收加工投入', record.actualInput.receiverName, `${formatPrintingQty(input.receivedQty)} Yard / ${input.receivedRollCount} 卷`)
}

export function completePrintingWorkOrder(workOrderId: string, input: {
  usedQty: number
  usedRollCount: number
  completedQty: number
  completedRollCount: number
  printerNo: string
  operatorName: string
}): void {
  const record = mutableRecord(workOrderId)
  if (record.processingStatus !== 'PROCESSING') throw new Error('只有加工中的印花单可以填报完成')
  if (!(input.usedQty > 0) || !(input.completedQty > 0)) throw new Error('实际使用和完成数量必须大于 0')
  if (input.usedQty > record.actualInput.receivedQty) throw new Error('实际使用数量不能超过实际接收数量')
  if (input.completedQty > input.usedQty) throw new Error('完成数量不能超过实际使用数量')
  if (!Number.isInteger(input.usedRollCount) || input.usedRollCount <= 0 || !Number.isInteger(input.completedRollCount) || input.completedRollCount <= 0) throw new Error('使用卷数和完成卷数必须为正整数')
  record.actualInput.usedQty = round(input.usedQty, 2)
  record.actualInput.usedRollCount = input.usedRollCount
  record.output.completedQty = round(input.completedQty, 2)
  record.output.completedRollCount = input.completedRollCount
  record.processingStatus = 'PROCESS_COMPLETED'
  record.handoverStatus = 'WAIT_HANDOVER'
  record.printerNo = input.printerNo.trim() || '未填写'
  record.transferCompletedQty = record.output.completedQty
  record.completedAt = nowTimestamp()
  record.barcodes = makeBarcodes({
    printOrderNo: record.printOrderNo,
    outputSku: record.output.sku,
    completedQty: record.output.completedQty,
    completedRollCount: record.output.completedRollCount,
    plannedRollCount: record.output.completedRollCount,
    gsm: record.output.gsm,
    widthCm: record.output.widthCm,
  })
  addOperation(record, '填报加工完成', input.operatorName, `使用 ${formatPrintingQty(input.usedQty)} Yard；完成 ${formatPrintingQty(input.completedQty)} Yard / ${input.completedRollCount} 卷`)
}

export function handoverPrintingOutput(workOrderId: string, input: {
  qty: number
  barcodeIds: string[]
  operatorName: string
  receiverName: string
}): void {
  const record = mutableRecord(workOrderId)
  if (record.processingStatus !== 'PROCESS_COMPLETED') throw new Error('加工未完成，不能交出')
  const remainingQty = round(record.output.completedQty - record.handover.handedOverQty, 2)
  if (!(input.qty > 0) || input.qty > remainingQty) throw new Error(`交出数量不能超过剩余可交 ${formatPrintingQty(remainingQty)} Yard`)
  if (input.barcodeIds.length === 0) throw new Error('至少选择一个产出卷条码')
  const selected = record.barcodes.filter((barcode) => input.barcodeIds.includes(barcode.id))
  if (selected.length !== input.barcodeIds.length) throw new Error('存在无效产出卷条码')
  if (selected.some((barcode) => barcode.sku !== record.output.sku)) throw new Error('交出条码必须绑定固定产出 SKU')
  selected.forEach((barcode) => { barcode.status = '已交出' })
  record.handover.handedOverQty = round(record.handover.handedOverQty + input.qty, 2)
  record.handover.receiverName = input.receiverName.trim() || record.handover.receiverName
  record.handover.handoverNo ||= `JC-${record.printOrderNo}-${String(Date.now()).slice(-4)}`
  record.handover.handedOverAt = nowTimestamp()
  record.deliveryAt = record.handover.handedOverAt
  record.handoverStatus = record.handover.handedOverQty < record.output.completedQty ? 'PARTIAL_HANDOVER' : 'HANDOVER_WAIT_RECEIVE'
  addOperation(record, '交出加工产出', input.operatorName, `${formatPrintingQty(input.qty)} Yard；${input.barcodeIds.length} 卷`)
}

export function receivePrintingHandover(workOrderId: string, input: {
  receivedQty: number
  receiverName: string
  differenceReason?: string
  objectionQty?: number
}): void {
  const record = mutableRecord(workOrderId)
  if (!['PARTIAL_HANDOVER', 'HANDOVER_WAIT_RECEIVE', 'PARTIAL_RECEIVED'].includes(record.handoverStatus)) throw new Error('当前交出状态不能接收')
  const remaining = round(record.handover.handedOverQty - record.handover.receivedQty, 2)
  if (!(input.receivedQty > 0) || input.receivedQty > remaining) throw new Error(`接收数量不能超过待接收 ${formatPrintingQty(remaining)} Yard`)
  record.handover.receivedQty = round(record.handover.receivedQty + input.receivedQty, 2)
  record.handover.diffQty = round(record.handover.handedOverQty - record.handover.receivedQty, 2)
  record.handover.objectionQty = Math.max(0, input.objectionQty || 0)
  record.handover.receiverName = input.receiverName.trim() || '下游接收人'
  record.handover.receivedAt = nowTimestamp()
  record.handover.differenceReason = input.differenceReason?.trim() || (record.handover.diffQty > 0 ? '仍有待接收数量' : '')
  const fullyReceived = record.handover.receivedQty >= record.output.completedQty && record.handover.diffQty === 0
  record.handoverStatus = fullyReceived ? 'RECEIVED' : 'PARTIAL_RECEIVED'
  if (fullyReceived) {
    record.barcodes.forEach((barcode) => {
      barcode.status = '已入库'
      barcode.inboundStatus = '已上架'
      barcode.inboundAt = record.handover.receivedAt
    })
  }
  addOperation(record, '接收加工产出', record.handover.receiverName, `${formatPrintingQty(input.receivedQty)} Yard；差异 ${formatPrintingQty(record.handover.diffQty)} Yard`)
}

export function cancelPrintingWorkOrder(workOrderId: string, input: { operatorName: string; reason: string }): void {
  const record = mutableRecord(workOrderId)
  if (record.output.completedQty > 0 || record.handover.handedOverQty > 0) throw new Error('已有完成或交出事实，不能直接取消')
  if (!input.reason.trim()) throw new Error('取消原因必填')
  record.processingStatus = 'CANCELLED'
  record.handoverStatus = 'NOT_STARTED'
  addOperation(record, '取消印花加工单', input.operatorName, input.reason.trim())
}

export function addPrintingRollBarcode(workOrderId: string): PrintingRollBarcode {
  const record = mutableRecord(workOrderId)
  const barcode = makeBarcode({
    printOrderNo: record.printOrderNo,
    outputSku: record.output.sku,
    rollIndex: record.barcodes.length,
    lengthY: 0,
    gsm: record.output.gsm,
    widthCm: record.output.widthCm,
  })
  record.barcodes.push(barcode)
  addOperation(record, '补充产出卷条码', '印花执行员', barcode.barcode)
  return structuredClone(barcode)
}

export function updatePrintingRollBarcode(workOrderId: string, barcodeId: string, input: {
  lengthY?: number
  meters?: number
  weightKg?: number
  gsm: number
  widthCm: number
  vatNo: string
  warehouseName: string
  remark: string
}): void {
  const record = mutableRecord(workOrderId)
  const barcode = record.barcodes.find((item) => item.id === barcodeId)
  if (!barcode) throw new Error('未找到产出卷条码')
  if (barcode.sku !== record.output.sku) throw new Error('条码 SKU 与固定加工产出不一致')
  if (!(input.gsm > 0) || !(input.widthCm > 0)) throw new Error('克重和幅宽必须大于 0')
  const hasLength = input.lengthY !== undefined && input.lengthY > 0
  const hasMeters = input.meters !== undefined && input.meters > 0
  const hasWeight = input.weightKg !== undefined && input.weightKg > 0
  if (!hasLength && !hasMeters && !hasWeight) throw new Error('卷长、米数或重量至少填写一项')
  const meters = hasMeters ? round(input.meters!, 2) : hasLength ? metersFromYards(input.lengthY!) : round((input.weightKg! * 1000) / ((input.widthCm / 100) * input.gsm), 2)
  const lengthY = hasLength ? round(input.lengthY!, 2) : yardsFromMeters(meters)
  const weightKg = hasWeight ? round(input.weightKg!, 3) : weightKgFromMeters(meters, input.widthCm, input.gsm)
  barcode.lengthY = lengthY
  barcode.meters = meters
  barcode.weightKg = weightKg
  barcode.gsm = input.gsm
  barcode.widthCm = input.widthCm
  barcode.vatNo = input.vatNo.trim()
  barcode.warehouseName = input.warehouseName.trim() || barcode.warehouseName
  barcode.remark = input.remark.trim()
  addOperation(record, '编辑产出卷属性', '印花执行员', `${barcode.barcode}；${formatPrintingQty(lengthY)} Yard / ${formatPrintingWeightKg(weightKg)} KG`)
}

export function batchUpdatePrintingRollBarcodes(workOrderId: string, barcodeIds: string[], input: {
  gsm: number
  widthCm: number
  vatNo: string
  warehouseName: string
}): void {
  const record = mutableRecord(workOrderId)
  const selected = record.barcodes.filter((barcode) => barcodeIds.includes(barcode.id))
  if (selected.length === 0) throw new Error('请选择要批量修改的产出卷条码')
  if (!(input.gsm > 0) || !(input.widthCm > 0)) throw new Error('克重和幅宽必须大于 0')
  selected.forEach((barcode) => {
    if (barcode.sku !== record.output.sku) throw new Error('条码 SKU 与固定加工产出不一致')
    barcode.gsm = input.gsm
    barcode.widthCm = input.widthCm
    barcode.vatNo = input.vatNo.trim()
    barcode.warehouseName = input.warehouseName.trim() || barcode.warehouseName
    if (barcode.meters > 0) barcode.weightKg = weightKgFromMeters(barcode.meters, input.widthCm, input.gsm)
  })
  addOperation(record, '批量修改产出卷属性', '印花执行员', `${selected.length} 卷；${input.gsm}g/㎡ / ${input.widthCm}cm`)
}

export function markPrintingRollBarcodesPrinted(workOrderId: string, barcodeIds: string[], operatorName: string): void {
  const record = mutableRecord(workOrderId)
  const selected = record.barcodes.filter((barcode) => barcodeIds.includes(barcode.id))
  if (selected.length === 0) throw new Error('请选择要打印的产出卷条码')
  const printedAt = nowTimestamp()
  selected.forEach((barcode) => {
    if (barcode.sku !== record.output.sku) throw new Error('条码 SKU 与固定加工产出不一致')
    barcode.status = '已打印'
    barcode.printedBy = operatorName
    barcode.printedAt = printedAt
  })
  record.documentHistory.unshift({
    historyId: `PDH-${record.printOrderNo}-${Date.now()}`,
    documentName: '加工产出卷条码',
    action: '打印',
    operatorName,
    operatedAt: printedAt,
    versionNo: `LABEL-${record.documentHistory.filter((item) => item.documentName === '加工产出卷条码').length + 1}`,
    remark: `${selected.length} 个卷条码`,
  })
  addOperation(record, '打印产出卷条码', operatorName, `${selected.length} 个条码`)
}

export function recordPrintingDocumentAction(workOrderId: string, input: {
  documentName: PrintingDocumentHistory['documentName']
  action: '打印' | '下载' | '补打'
  operatorName: string
  remark?: string
}): void {
  const record = mutableRecord(workOrderId)
  const versionIndex = record.documentHistory.filter((item) => item.documentName === input.documentName).length + 1
  record.documentHistory.unshift({
    historyId: `PDH-${record.printOrderNo}-${Date.now()}`,
    documentName: input.documentName,
    action: input.action,
    operatorName: input.operatorName,
    operatedAt: nowTimestamp(),
    versionNo: `V${versionIndex}`,
    remark: input.remark,
  })
  if (input.documentName !== '加工产出卷条码') record.printingDocumentsNeedReprint = false
  addOperation(record, `${input.action}${input.documentName}`, input.operatorName, input.remark || '')
}

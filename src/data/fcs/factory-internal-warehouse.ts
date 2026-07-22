import type { Factory, FactoryType } from './factory-types.ts'
import { factoryTypeConfig } from './factory-types.ts'
import { mockFactories } from './factory-mock-data.ts'
import { getProcessDefinitionByCode } from './process-craft-dict.ts'
import type { WarehouseIssueLine, WarehouseIssueOrder } from './warehouse-material-execution.ts'
import { listWarehouseIssueOrders } from './warehouse-material-execution.ts'
import type { PdaHandoverHead, PdaHandoverRecord, PdaPickupRecord } from './pda-handover-events.ts'
import {
  getPdaPickupRecordsByHead,
  getPdaHandoverRecordsByHead,
  listPdaHandoverHeads,
} from './pda-handover-events.ts'

export type FactoryInternalWarehouseKind = 'WAIT_PROCESS' | 'WAIT_HANDOVER'
export type FactoryWarehouseLocationStatus = 'AVAILABLE' | 'STOPPED'
export type FactoryWarehouseSourceRecordType = 'MATERIAL_PICKUP' | 'HANDOVER_RECEIVE' | 'TRANSFER_RECEIVE' | 'STOCKTAKE_ADJUSTMENT'
export type FactoryWarehouseSourceObjectKind =
  | '面辅料仓'
  | '中转仓'
  | '裁床厂'
  | '印花厂'
  | '染厂'
  | '特殊工艺厂'
  | '后道工厂'
  | '上游工厂仓'
export type FactoryWarehouseItemKind = '面料' | '辅料' | '裁片' | '成衣' | '其他半成品'
export type FactoryWaitProcessStockStatus = '待领料' | '已入待加工仓' | '差异待处理'
export type FactoryWaitHandoverStockStatus = '待交出' | '已交出' | '已回写' | '差异' | '异议中'
export type FactoryInboundRecordStatus = '待确认' | '已入库' | '差异待处理' | '已作废'
export type FactoryOutboundRecordStatus = '已出库' | '已回写' | '差异' | '异议中' | '已作废'
export type FactoryWarehouseReceiverKind =
  | '中转仓'
  | '裁床厂'
  | '裁片仓'
  | '特殊工艺厂'
  | '后道工厂'
  | '成衣仓'
  | '其他接收方'
export type FactoryWarehouseStocktakeScope = '全盘'
export type FactoryWarehouseStocktakeStatus = '盘点中' | '待确认' | '已完成' | '已取消'
export type FactoryWarehouseStocktakeLineStatus = '未盘' | '已盘' | '差异'
export type FactoryWarehouseStocktakeReviewStatus = '待审核' | '审核通过' | '已驳回' | '已调整'
export type FactoryWarehouseAdjustmentOrderStatus = '待执行' | '已完成' | '已作废'

export interface FactoryWarehouseLocation {
  locationId: string
  locationNo: string
  locationName: string
  status: FactoryWarehouseLocationStatus
  remark?: string
}

export interface FactoryWarehouseShelf {
  shelfId: string
  shelfNo: string
  shelfName: string
  locationList: FactoryWarehouseLocation[]
  status: FactoryWarehouseLocationStatus
  remark?: string
}

export interface FactoryWarehouseArea {
  areaId: string
  areaName: string
  shelfList: FactoryWarehouseShelf[]
  status: FactoryWarehouseLocationStatus
  remark?: string
}

export interface FactoryInternalWarehouse {
  warehouseId: string
  factoryId: string
  factoryName: string
  factoryKind: FactoryType
  warehouseKind: FactoryInternalWarehouseKind
  warehouseName: string
  warehouseShortName: '待加工仓' | '待交出仓'
  isDefault: boolean
  isEnabled: boolean
  areaList: FactoryWarehouseArea[]
  createdAt: string
  updatedAt: string
}

interface FactoryWarehouseBaseItem {
  stockItemId: string
  warehouseId: string
  factoryId: string
  factoryName: string
  factoryKind: FactoryType
  warehouseName: string
  processCode?: string
  processName?: string
  craftCode?: string
  craftName?: string
  itemKind: FactoryWarehouseItemKind
  itemName: string
  materialSku?: string
  partName?: string
  fabricColor?: string
  sizeCode?: string
  feiTicketNo?: string
  transferBagNo?: string
  fabricRollNo?: string
  unit: string
  areaName: string
  shelfNo: string
  locationNo: string
  locationText: string
  abnormalReason?: string
  photoList: string[]
  remark?: string
}

export interface FactoryWaitProcessStockItem extends FactoryWarehouseBaseItem {
  sourceRecordId: string
  sourceRecordNo: string
  sourceRecordType: FactoryWarehouseSourceRecordType
  sourceObjectKind: FactoryWarehouseSourceObjectKind
  sourceObjectName: string
  taskId?: string
  taskNo?: string
  productionOrderId?: string
  productionOrderNo?: string
  expectedQty: number
  receivedQty: number
  differenceQty: number
  receiverName: string
  receivedAt: string
  status: FactoryWaitProcessStockStatus
}

export interface FactoryWaitHandoverStockItem extends FactoryWarehouseBaseItem {
  taskId?: string
  taskNo?: string
  sourceType?: 'PRODUCTION_ORDER' | 'STOCK'
  productionOrderId?: string
  productionOrderNo?: string
  stockMaterialId?: string
  stockMaterialName?: string
  completedQty: number
  lossQty: number
  waitHandoverQty: number
  receiverKind: FactoryWarehouseReceiverKind
  receiverName: string
  handoverOrderId?: string
  handoverOrderNo?: string
  handoverRecordId?: string
  handoverRecordNo?: string
  handoverRecordQrValue?: string
  receiverWrittenQty?: number
  differenceQty?: number
  objectionStatus?: string
  status: FactoryWaitHandoverStockStatus
}

export interface FactoryWarehouseInboundRecord {
  inboundRecordId: string
  inboundRecordNo: string
  warehouseId: string
  warehouseName: string
  factoryId: string
  factoryName: string
  factoryKind: FactoryType
  processCode?: string
  processName?: string
  craftCode?: string
  craftName?: string
  sourceRecordId: string
  sourceRecordNo: string
  sourceRecordType: FactoryWarehouseSourceRecordType
  sourceObjectName: string
  taskId?: string
  taskNo?: string
  itemKind: FactoryWarehouseItemKind
  itemName: string
  materialSku?: string
  partName?: string
  fabricColor?: string
  sizeCode?: string
  feiTicketNo?: string
  transferBagNo?: string
  fabricRollNo?: string
  expectedQty: number
  receivedQty: number
  differenceQty: number
  unit: string
  receiverName: string
  receivedAt: string
  areaName: string
  shelfNo: string
  locationNo: string
  status: FactoryInboundRecordStatus
  abnormalReason?: string
  photoList: string[]
  generatedStockItemId?: string
  remark?: string
}

export interface FactoryWarehouseOutboundRecord {
  outboundRecordId: string
  outboundRecordNo: string
  warehouseId: string
  warehouseName: string
  factoryId: string
  factoryName: string
  factoryKind: FactoryType
  processCode?: string
  processName?: string
  craftCode?: string
  craftName?: string
  sourceTaskId?: string
  sourceTaskNo?: string
  sourceType?: 'PRODUCTION_ORDER' | 'STOCK'
  productionOrderId?: string
  productionOrderNo?: string
  stockMaterialId?: string
  stockMaterialName?: string
  handoverOrderId?: string
  handoverOrderNo?: string
  handoverRecordId?: string
  handoverRecordNo?: string
  handoverRecordQrValue?: string
  receiverKind: FactoryWarehouseReceiverKind
  receiverName: string
  itemKind: FactoryWarehouseItemKind
  itemName: string
  materialSku?: string
  partName?: string
  fabricColor?: string
  sizeCode?: string
  feiTicketNo?: string
  transferBagNo?: string
  fabricRollNo?: string
  outboundQty: number
  receiverWrittenQty?: number
  differenceQty?: number
  unit: string
  operatorName: string
  outboundAt: string
  status: FactoryOutboundRecordStatus
  abnormalReason?: string
  photoList: string[]
  relatedWaitHandoverStockItemId?: string
  remark?: string
}

export interface FactoryWarehouseStocktakeLine {
  lineId: string
  stocktakeOrderId: string
  stockItemId: string
  itemKind: FactoryWarehouseItemKind
  itemName: string
  materialSku?: string
  partName?: string
  fabricColor?: string
  sizeCode?: string
  feiTicketNo?: string
  transferBagNo?: string
  fabricRollNo?: string
  bookQty: number
  countedQty?: number
  differenceQty?: number
  unit: string
  areaName: string
  shelfNo: string
  locationNo: string
  differenceReason?: string
  photoList: string[]
  status: FactoryWarehouseStocktakeLineStatus
  reviewStatus?: FactoryWarehouseStocktakeReviewStatus
  differenceReviewId?: string
  adjustmentOrderId?: string
  adjustedAt?: string
}

export interface FactoryWarehouseStocktakeOrder {
  stocktakeOrderId: string
  stocktakeOrderNo: string
  factoryId: string
  factoryName: string
  warehouseId: string
  warehouseName: string
  warehouseKind: FactoryInternalWarehouseKind
  stocktakeScope: FactoryWarehouseStocktakeScope
  stocktakeMethod?: FactoryWarehouseStocktakeScope
  isBlindStocktake?: boolean
  ownerNames?: string[]
  plannedAt?: string
  status: FactoryWarehouseStocktakeStatus
  createdBy: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  lineList: FactoryWarehouseStocktakeLine[]
  remark?: string
}

export interface FactoryWarehouseStocktakeDifferenceReview {
  reviewId: string
  stocktakeOrderId: string
  stocktakeOrderNo: string
  lineId: string
  stockItemId: string
  warehouseId: string
  warehouseName: string
  factoryId: string
  factoryName: string
  warehouseKind: FactoryInternalWarehouseKind
  itemKind: FactoryWarehouseItemKind
  itemName: string
  materialSku?: string
  partName?: string
  fabricColor?: string
  sizeCode?: string
  feiTicketNo?: string
  transferBagNo?: string
  fabricRollNo?: string
  bookQty: number
  countedQty: number
  differenceQty: number
  unit: string
  reviewStatus: FactoryWarehouseStocktakeReviewStatus
  reviewRemark?: string
  reviewedBy?: string
  reviewedAt?: string
  adjustmentOrderId?: string
  createdAt: string
}

export interface FactoryWarehouseAdjustmentOrder {
  adjustmentOrderId: string
  adjustmentOrderNo: string
  adjustmentType?: '盘盈单' | '盘亏单'
  sourceStocktakeOrderId: string
  sourceStocktakeOrderNo: string
  sourceLineId: string
  reviewId: string
  warehouseId: string
  warehouseName: string
  factoryId: string
  factoryName: string
  warehouseKind: FactoryInternalWarehouseKind
  stockItemId: string
  itemKind: FactoryWarehouseItemKind
  itemName: string
  materialSku?: string
  partName?: string
  fabricColor?: string
  sizeCode?: string
  feiTicketNo?: string
  transferBagNo?: string
  fabricRollNo?: string
  bookQty: number
  countedQty: number
  adjustmentQty: number
  unit: string
  status: FactoryWarehouseAdjustmentOrderStatus
  createdAt: string
  createdBy: string
  executedAt?: string
  executedBy?: string
  remark?: string
}

export interface FactoryWarehouseNodeRow {
  rowType: 'AREA' | 'SHELF' | 'LOCATION'
  warehouseId: string
  warehouseName: string
  factoryId: string
  factoryName: string
  areaId: string
  areaName: string
  shelfId?: string
  shelfNo?: string
  shelfName?: string
  locationId?: string
  locationNo?: string
  locationName?: string
  status: FactoryWarehouseLocationStatus
  remark?: string
}

interface FactoryInternalWarehouseStore {
  warehouses: FactoryInternalWarehouse[]
  waitProcessStockItems: FactoryWaitProcessStockItem[]
  waitHandoverStockItems: FactoryWaitHandoverStockItem[]
  inboundRecords: FactoryWarehouseInboundRecord[]
  outboundRecords: FactoryWarehouseOutboundRecord[]
  stocktakeOrders: FactoryWarehouseStocktakeOrder[]
  stocktakeDifferenceReviews: FactoryWarehouseStocktakeDifferenceReview[]
  adjustmentOrders: FactoryWarehouseAdjustmentOrder[]
}

const DEFAULT_AREA_NAMES = ['A区', 'B区', 'C区', 'D区', 'E区', 'F区', '异常区', '待确认区'] as const
const NORMAL_AREA_NAMES = ['A区', 'B区', 'C区', 'D区', 'E区', 'F区'] as const
const SEWING_FACTORY_TYPES = new Set<FactoryType>(['CENTRAL_GARMENT', 'SATELLITE_SEWING', 'THIRD_SEWING'])
let internalWarehouseStore: FactoryInternalWarehouseStore | null = null

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function roundQty(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(Number(value) * 100) / 100
}

function hashCode(text: string): number {
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

function isSewingFactory(factory: Factory): boolean {
  return SEWING_FACTORY_TYPES.has(factory.factoryType)
}

function isNonSewingFactory(factory: Factory): boolean {
  return !isSewingFactory(factory)
}

function getWarehouseShortName(warehouseKind: FactoryInternalWarehouseKind): '待加工仓' | '待交出仓' {
  return warehouseKind === 'WAIT_PROCESS' ? '待加工仓' : '待交出仓'
}

function getWarehouseKindLabel(warehouseKind: FactoryInternalWarehouseKind): '待加工仓' | '待交出仓' {
  return getWarehouseShortName(warehouseKind)
}

function getWarehouseLocationStatusLabel(status: FactoryWarehouseLocationStatus): '可用' | '停用' {
  return status === 'AVAILABLE' ? '可用' : '停用'
}

function resolvePrimaryFactoryProcess(factory: Factory): { processCode?: string; processName?: string } {
  const explicitProcessCode =
    factory.factoryType === 'CENTRAL_PRINT'
      ? 'PRINT'
      : factory.factoryType === 'CENTRAL_DYE'
        ? 'DYE'
        : factory.factoryType === 'CENTRAL_CUTTING'
          ? 'CUT_PANEL'
          : factory.factoryType === 'SATELLITE_FINISHING' || factory.factoryType === 'CENTRAL_AUX' || factory.factoryType === 'CENTRAL_LACE'
            ? 'POST_FINISHING'
            : factory.factoryType === 'CENTRAL_DENIM_WASH' || factory.factoryType === 'CENTRAL_SPECIAL'
              ? 'SPECIAL_CRAFT'
              : factory.factoryType === 'CENTRAL_WOOL'
                ? 'PLEATING'
                : undefined
  if (explicitProcessCode) {
    const processDefinition = getProcessDefinitionByCode(explicitProcessCode)
    return {
      processCode: explicitProcessCode,
      processName: processDefinition?.processName ?? explicitProcessCode,
    }
  }

  const ability = factory.processAbilities.find((item) => item.processCode !== 'SEW') || factory.processAbilities[0]
  if (!ability) return {}
  return {
    processCode: ability.processCode,
    processName: ability.processName || getProcessDefinitionByCode(ability.processCode)?.processName || ability.processCode,
  }
}

function buildDefaultLocations(areaName: string): FactoryWarehouseLocation[] {
  const prefix = areaName.replace('区', '')
  return [
    {
      locationId: `LOC-${prefix}-01-01`,
      locationNo: `${prefix}-01-01`,
      locationName: `${prefix}-01-01`,
      status: 'AVAILABLE',
      remark: areaName === '异常区' ? '用于差异与破损暂存' : areaName === '待确认区' ? '待领料或待确认明细' : '',
    },
    {
      locationId: `LOC-${prefix}-01-02`,
      locationNo: `${prefix}-01-02`,
      locationName: `${prefix}-01-02`,
      status: 'AVAILABLE',
      remark: '',
    },
  ]
}

function buildDefaultShelf(areaName: string): FactoryWarehouseShelf[] {
  const prefix = areaName.replace('区', '')
  return [
    {
      shelfId: `SHELF-${prefix}-01`,
      shelfNo: `${prefix}-01`,
      shelfName: `${prefix}-01`,
      locationList: buildDefaultLocations(areaName),
      status: 'AVAILABLE',
      remark: areaName === '异常区' ? '异常件集中放置' : '',
    },
  ]
}

function buildDefaultAreaList(): FactoryWarehouseArea[] {
  return DEFAULT_AREA_NAMES.map((areaName) => ({
    areaId: `AREA-${areaName}`,
    areaName,
    shelfList: buildDefaultShelf(areaName),
    status: 'AVAILABLE',
    remark: areaName === '待确认区' ? '待接收或待复核' : '',
  }))
}

export function buildDefaultFactoryInternalWarehouses(factories: Factory[] = mockFactories): FactoryInternalWarehouse[] {
  return factories
    .filter((factory) => isNonSewingFactory(factory))
    .flatMap((factory) => {
      const createdAt = factory.createdAt || '2026-04-01 08:00:00'
      const updatedAt = factory.updatedAt || createdAt
      return (['WAIT_PROCESS', 'WAIT_HANDOVER'] as const).map((warehouseKind) => {
        const warehouseShortName = getWarehouseShortName(warehouseKind)
        return {
          warehouseId: `FIW-${factory.id}-${warehouseKind}`,
          factoryId: factory.id,
          factoryName: factory.name,
          factoryKind: factory.factoryType,
          warehouseKind,
          warehouseName: `${factory.name} · ${warehouseShortName}`,
          warehouseShortName,
          isDefault: true,
          isEnabled: true,
          areaList: buildDefaultAreaList(),
          createdAt,
          updatedAt,
        } satisfies FactoryInternalWarehouse
      })
    })
}

const ONBOARDING_CUTTING_FACTORIES = [
  { factoryId: 'FACTORY-ONBOARD-0034', factoryName: '定向裁演示工厂34', seedNo: '034' },
  { factoryId: 'FACTORY-ONBOARD-0035', factoryName: '定位裁演示工厂35', seedNo: '035' },
] as const

const ONBOARDING_CUTTING_FACTORY_ID = ONBOARDING_CUTTING_FACTORIES[0].factoryId
const ONBOARDING_CUTTING_FACTORY_NAME = ONBOARDING_CUTTING_FACTORIES[0].factoryName

function getOnboardingCuttingSeedNo(factoryId: string): string {
  return ONBOARDING_CUTTING_FACTORIES.find((factory) => factory.factoryId === factoryId)?.seedNo || '034'
}

function buildOnboardingCuttingInternalWarehouses(): FactoryInternalWarehouse[] {
  return ONBOARDING_CUTTING_FACTORIES.flatMap((factory) =>
    (['WAIT_PROCESS', 'WAIT_HANDOVER'] as const).map((warehouseKind) => {
      const warehouseShortName = getWarehouseShortName(warehouseKind)
      return {
        warehouseId: `FIW-${factory.factoryId}-${warehouseKind}`,
        factoryId: factory.factoryId,
        factoryName: factory.factoryName,
        factoryKind: 'CENTRAL_CUTTING',
        warehouseKind,
        warehouseName: `${factory.factoryName} · ${warehouseShortName}`,
        warehouseShortName,
        isDefault: true,
        isEnabled: true,
        areaList: buildDefaultAreaList(),
        createdAt: '2026-04-20 08:00:00',
        updatedAt: '2026-04-20 08:00:00',
      } satisfies FactoryInternalWarehouse
    }),
  )
}

function pickWarehouseLocation(
  warehouse: FactoryInternalWarehouse,
  seed: string,
  status: FactoryWaitProcessStockStatus | FactoryWaitHandoverStockStatus | FactoryInboundRecordStatus | FactoryOutboundRecordStatus,
): { areaName: string; shelfNo: string; locationNo: string; locationText: string } {
  const preferredAreaName =
    status === '差异待处理' || status === '差异' || status === '异议中'
      ? '异常区'
      : status === '待领料' || status === '待确认'
        ? '待确认区'
        : NORMAL_AREA_NAMES[hashCode(seed) % NORMAL_AREA_NAMES.length]

  const area = warehouse.areaList.find((item) => item.areaName === preferredAreaName) || warehouse.areaList[0]
  const shelf = area.shelfList[0]
  const location = shelf.locationList[hashCode(seed) % shelf.locationList.length]

  return {
    areaName: area.areaName,
    shelfNo: shelf.shelfNo,
    locationNo: location.locationNo,
    locationText: `${area.areaName} / ${shelf.shelfNo} / ${location.locationNo}`,
  }
}

function resolvePickupRecordStatus(doc: WarehouseIssueOrder, line: WarehouseIssueLine): FactoryInboundRecordStatus {
  const receivedQty = doc.status === 'RECEIVED' ? roundQty(line.issuedQty || line.transferredQty || line.preparedQty) : 0
  const differenceQty = roundQty(receivedQty - line.plannedQty)
  if (differenceQty !== 0) return '差异待处理'
  return doc.status === 'RECEIVED' ? '已入库' : '待确认'
}

function resolveWaitProcessStockStatus(record: FactoryWarehouseInboundRecord): FactoryWaitProcessStockStatus {
  if (record.status === '差异待处理') return '差异待处理'
  if (record.status === '已入库') return '已入待加工仓'
  return '待领料'
}

function resolveHandoutStatus(record: PdaHandoverRecord): FactoryOutboundRecordStatus {
  if (record.status === 'OBJECTION_REPORTED' || record.status === 'OBJECTION_PROCESSING') return '异议中'
  const handoverDiffQty = roundQty(
    record.diffQty ?? (
      typeof record.receiverWrittenQty === 'number'
        ? record.receiverWrittenQty - (record.submittedQty ?? record.plannedQty ?? 0)
        : 0
    ),
  )
  if (typeof record.receiverWrittenQty === 'number' && handoverDiffQty !== 0) return '差异'
  if (typeof record.receiverWrittenQty === 'number') return '已回写'
  return '已出库'
}

function resolveWaitHandoverStatus(record: FactoryWarehouseOutboundRecord): FactoryWaitHandoverStockStatus {
  if (record.status === '异议中') return '异议中'
  if (record.status === '差异') return '差异'
  if (record.status === '已回写') return '已回写'
  return '已交出'
}

function resolveFactoryByName(factoryName: string | undefined, fallbackType?: FactoryType): Factory | undefined {
  if (factoryName) {
    const exact = mockFactories.find((factory) => factory.name === factoryName)
    if (exact) return exact
  }
  if (factoryName?.includes('后道')) {
    return mockFactories.find((factory) => factory.factoryType === 'SATELLITE_FINISHING')
  }
  if (fallbackType) {
    return mockFactories.find((factory) => factory.factoryType === fallbackType)
  }
  return undefined
}

function normalizeWarehouseReceiverKind(head: PdaHandoverHead): FactoryWarehouseReceiverKind {
  const receiverText = `${head.receiverName || ''}${head.targetName || ''}`
  if (receiverText.includes('中转')) return '中转仓'
  if (receiverText.includes('裁片仓')) return '裁片仓'
  if (receiverText.includes('裁床')) return '裁床厂'
  if (receiverText.includes('成衣仓')) return '成衣仓'
  if (receiverText.includes('后道')) return '后道工厂'
  return '其他接收方'
}

function resolveSourceObjectKindFromHead(head: PdaHandoverHead): FactoryWarehouseSourceObjectKind {
  if ((head.processBusinessCode || '').includes('CUT')) return '裁床厂'
  if (head.processBusinessCode === 'PRINT') return '印花厂'
  if (head.processBusinessCode === 'DYE') return '染厂'
  if (head.processBusinessCode === 'POST_FINISHING' || head.sourceFactoryName.includes('后道')) return '后道工厂'
  if (head.isSpecialCraft || head.sourceFactoryName.includes('特')) return '特殊工艺厂'
  if (head.sourceFactoryName.includes('中转')) return '中转仓'
  return '上游工厂仓'
}

function deriveFactoryItemKind(input: {
  lineMaterialName?: string
  partName?: string
  processCode?: string
  handoutObjectType?: string
}): FactoryWarehouseItemKind {
  if (input.handoutObjectType === 'CUT_PIECE' || input.partName) return '裁片'
  if (input.handoutObjectType === 'SEMI_FINISHED_GARMENT') return '成衣'
  if (input.handoutObjectType === 'FABRIC') return '面料'
  if (input.processCode === 'POST_FINISHING') return '成衣'
  const materialName = input.lineMaterialName || ''
  if (materialName.includes('面料') || materialName.includes('布')) return '面料'
  if (materialName.includes('辅')) return '辅料'
  return '其他半成品'
}

function buildInboundRecordFromPickupInput(input: {
  warehouse: FactoryInternalWarehouse
  factory: Factory
  doc: WarehouseIssueOrder
  line: WarehouseIssueLine
  lineIndex: number
}): FactoryWarehouseInboundRecord {
  const { warehouse, factory, doc, line, lineIndex } = input
  const status = resolvePickupRecordStatus(doc, line)
  const receivedQty = status === '已入库' || status === '差异待处理' ? roundQty(line.issuedQty || line.transferredQty || line.preparedQty) : 0
  const differenceQty = roundQty(receivedQty - line.plannedQty)
  const location = pickWarehouseLocation(warehouse, `${doc.id}-${line.lineId}`, status)
  const factoryProcess = resolvePrimaryFactoryProcess(factory)

  return {
    inboundRecordId: `INB-${doc.id}-${String(lineIndex + 1).padStart(3, '0')}`,
    inboundRecordNo: `RK-${doc.docNo}-${String(lineIndex + 1).padStart(2, '0')}`,
    warehouseId: warehouse.warehouseId,
    warehouseName: warehouse.warehouseName,
    factoryId: factory.id,
    factoryName: factory.name,
    factoryKind: factory.factoryType,
    processCode: factoryProcess.processCode,
    processName: factoryProcess.processName,
    sourceRecordId: doc.id,
    sourceRecordNo: doc.docNo,
    sourceRecordType: 'MATERIAL_PICKUP',
    sourceObjectName: doc.warehouseName || '面辅料仓',
    taskId: doc.runtimeTaskId,
    taskNo: doc.taskNo,
    itemKind: deriveFactoryItemKind({ lineMaterialName: line.materialName }),
    itemName: line.materialName,
    materialSku: line.materialCode,
    partName: line.pieceName,
    fabricColor: line.skuColor,
    sizeCode: line.skuSize,
    fabricRollNo: line.materialSpec,
    expectedQty: roundQty(line.plannedQty),
    receivedQty,
    differenceQty,
    unit: line.unit,
    receiverName: factory.name,
    receivedAt: doc.updatedAt,
    areaName: location.areaName,
    shelfNo: location.shelfNo,
    locationNo: location.locationNo,
    status,
    abnormalReason: differenceQty !== 0 ? '数量不符' : undefined,
    photoList: differenceQty !== 0 ? ['/placeholder.svg'] : [],
    remark: '由领料记录生成',
  }
}

export function buildInboundRecordFromPickup(
  doc: WarehouseIssueOrder,
  line: WarehouseIssueLine,
  factory: Factory,
  warehouse: FactoryInternalWarehouse,
  lineIndex = 0,
): FactoryWarehouseInboundRecord {
  return buildInboundRecordFromPickupInput({ doc, line, factory, warehouse, lineIndex })
}

function shouldSeedInboundFromPickupRecord(record: PdaPickupRecord): boolean {
  return ['RECEIVED', 'OBJECTION_REPORTED', 'OBJECTION_PROCESSING', 'OBJECTION_RESOLVED'].includes(record.status)
}

function resolveInboundStatusFromPickupRecord(record: PdaPickupRecord): FactoryInboundRecordStatus {
  return record.status === 'RECEIVED' ? '已入库' : '差异待处理'
}

function resolvePickupRecordReceivedQty(record: PdaPickupRecord): number {
  if (typeof record.finalResolvedQty === 'number') return roundQty(record.finalResolvedQty)
  if (typeof record.factoryReportedQty === 'number') return roundQty(record.factoryReportedQty)
  if (typeof record.factoryConfirmedQty === 'number') return roundQty(record.factoryConfirmedQty)
  if (typeof record.warehouseHandedQty === 'number') return roundQty(record.warehouseHandedQty)
  return roundQty(record.qtyExpected)
}

function buildInboundRecordFromPickupRecordInput(input: {
  warehouse: FactoryInternalWarehouse
  factory: Factory
  head: PdaHandoverHead
  record: PdaPickupRecord
  recordIndex: number
}): FactoryWarehouseInboundRecord {
  const { warehouse, factory, head, record, recordIndex } = input
  const expectedQty = roundQty(record.qtyExpected)
  const receivedQty = resolvePickupRecordReceivedQty(record)
  const differenceQty = roundQty(receivedQty - expectedQty)
  const status = resolveInboundStatusFromPickupRecord(record)
  const location = pickWarehouseLocation(warehouse, `${head.handoverId}-${record.recordId}`, status)
  const factoryProcess = resolvePrimaryFactoryProcess(factory)

  return {
    inboundRecordId: `INB-${head.handoverId}-${String(recordIndex + 1).padStart(3, '0')}`,
    inboundRecordNo: `RK-${head.handoverOrderNo || head.handoverId}-${String(recordIndex + 1).padStart(2, '0')}`,
    warehouseId: warehouse.warehouseId,
    warehouseName: warehouse.warehouseName,
    factoryId: factory.id,
    factoryName: factory.name,
    factoryKind: factory.factoryType,
    processCode: factoryProcess.processCode,
    processName: factoryProcess.processName,
    sourceRecordId: record.recordId,
    sourceRecordNo: record.recordId,
    sourceRecordType: 'MATERIAL_PICKUP',
    sourceObjectName: head.sourceFactoryName || '上游仓库',
    taskId: head.taskId,
    taskNo: head.taskNo,
    itemKind: deriveFactoryItemKind({
      lineMaterialName: record.materialName,
      partName: record.pieceName,
      processCode: head.processBusinessCode,
    }),
    itemName: record.materialSummary || record.materialName || head.processName,
    materialSku: record.materialCode || record.skuCode,
    partName: record.pieceName,
    fabricColor: record.skuColor,
    sizeCode: record.skuSize,
    expectedQty,
    receivedQty,
    differenceQty,
    unit: record.qtyUnit,
    receiverName: head.targetName || factory.name,
    receivedAt: record.factoryConfirmedAt || record.finalResolvedAt || record.submittedAt,
    areaName: location.areaName,
    shelfNo: location.shelfNo,
    locationNo: location.locationNo,
    status,
    abnormalReason: differenceQty !== 0 ? record.objectionReason || '数量不符' : undefined,
    photoList:
      differenceQty !== 0
        ? ((record.objectionProofFiles?.length || 0) > 0 ? record.objectionProofFiles!.map(() => '/placeholder.svg') : ['/placeholder.svg'])
        : [],
    remark: '由领料记录生成',
  }
}

function derivePartNameFromRecord(record: PdaHandoverRecord): string | undefined {
  return record.pieceName || record.cutPieceLines?.[0]?.piecePartLabel
}

function deriveSkuFromRecord(record: PdaHandoverRecord): {
  materialSku?: string
  fabricColor?: string
  sizeCode?: string
  feiTicketNo?: string
} {
  const firstLine = record.recordLines?.[0]
  return {
    materialSku: record.materialCode || firstLine?.materialSku || record.skuCode || firstLine?.garmentSkuCode,
    fabricColor: record.skuColor || firstLine?.garmentColor,
    sizeCode: record.skuSize || firstLine?.sizeCode,
    feiTicketNo: firstLine?.feiTicketNo,
  }
}

function buildInboundRecordFromHandoverReceiveInput(input: {
  warehouse: FactoryInternalWarehouse
  factory: Factory
  head: PdaHandoverHead
  record: PdaHandoverRecord
  recordIndex: number
}): FactoryWarehouseInboundRecord {
  const { warehouse, factory, head, record, recordIndex } = input
  const expectedQty = roundQty(record.submittedQty ?? record.plannedQty ?? 0)
  const receivedQty = roundQty(record.receiverWrittenQty ?? 0)
  const differenceQty = roundQty(receivedQty - expectedQty)
  const status: FactoryInboundRecordStatus =
    typeof record.receiverWrittenQty !== 'number'
      ? '待确认'
      : differenceQty !== 0
        ? '差异待处理'
        : '已入库'
  const location = pickWarehouseLocation(warehouse, `${head.handoverId}-${record.recordId}`, status)
  const skuInfo = deriveSkuFromRecord(record)
  const factoryProcess = resolvePrimaryFactoryProcess(factory)

  return {
    inboundRecordId: `INB-${head.handoverId}-${String(recordIndex + 1).padStart(3, '0')}`,
    inboundRecordNo: `RK-${head.handoverOrderNo || head.handoverId}-${String(recordIndex + 1).padStart(2, '0')}`,
    warehouseId: warehouse.warehouseId,
    warehouseName: warehouse.warehouseName,
    factoryId: factory.id,
    factoryName: factory.name,
    factoryKind: factory.factoryType,
    processCode: factoryProcess.processCode,
    processName: factoryProcess.processName,
    sourceRecordId: record.handoverRecordId || record.recordId,
    sourceRecordNo: record.handoverRecordNo || head.handoverOrderNo || head.handoverId,
    sourceRecordType: 'HANDOVER_RECEIVE',
    sourceObjectName: head.sourceFactoryName,
    taskId: head.taskId,
    taskNo: head.taskNo,
    itemKind: deriveFactoryItemKind({
      partName: derivePartNameFromRecord(record),
      handoutObjectType: record.objectType,
      processCode: head.processBusinessCode,
    }),
    itemName: record.handoutItemLabel || record.materialName || head.processName,
    materialSku: skuInfo.materialSku,
    partName: derivePartNameFromRecord(record),
    fabricColor: skuInfo.fabricColor,
    sizeCode: skuInfo.sizeCode,
    feiTicketNo: skuInfo.feiTicketNo,
    expectedQty,
    receivedQty,
    differenceQty,
    unit: record.qtyUnit || head.qtyUnit || '件',
    receiverName: head.receiverName || head.targetName,
    receivedAt: record.receiverWrittenAt || record.factorySubmittedAt,
    areaName: location.areaName,
    shelfNo: location.shelfNo,
    locationNo: location.locationNo,
    status,
    abnormalReason: differenceQty !== 0 ? record.diffReason || '数量不符' : undefined,
    photoList: differenceQty !== 0 ? ['/placeholder.svg'] : [],
    remark: '由交出接收生成',
  }
}

export function buildInboundRecordFromHandoverReceive(
  head: PdaHandoverHead,
  record: PdaHandoverRecord,
  factory: Factory,
  warehouse: FactoryInternalWarehouse,
  recordIndex = 0,
): FactoryWarehouseInboundRecord {
  return buildInboundRecordFromHandoverReceiveInput({ head, record, factory, warehouse, recordIndex })
}

function buildWaitProcessStockItemFromInbound(
  record: FactoryWarehouseInboundRecord,
): FactoryWaitProcessStockItem {
  return {
    stockItemId: `WPS-${record.inboundRecordId}`,
    warehouseId: record.warehouseId,
    factoryId: record.factoryId,
    factoryName: record.factoryName,
    factoryKind: record.factoryKind,
    warehouseName: record.warehouseName,
    processCode: record.processCode,
    processName: record.processName,
    craftCode: record.craftCode,
    craftName: record.craftName,
    sourceRecordId: record.sourceRecordId,
    sourceRecordNo: record.sourceRecordNo,
    sourceRecordType: record.sourceRecordType,
    sourceObjectKind:
      record.sourceRecordType === 'MATERIAL_PICKUP'
        ? '面辅料仓'
        : record.sourceRecordType === 'STOCKTAKE_ADJUSTMENT'
          ? '上游工厂仓'
        : resolveSourceObjectKindFromHead({
          handoverId: '',
          headType: 'HANDOUT',
          qrCodeValue: '',
          taskId: record.taskId || '',
          taskNo: record.taskNo || '',
          productionOrderNo: '',
          processName: record.processName || '',
          sourceFactoryName: record.sourceObjectName,
          targetName: record.factoryName,
          targetKind: 'FACTORY',
          qtyUnit: record.unit,
          factoryId: record.factoryId,
          taskStatus: 'DONE',
          summaryStatus: 'WRITTEN_BACK',
          recordCount: 1,
          pendingWritebackCount: 0,
          writtenBackQtyTotal: record.receivedQty,
          objectionCount: 0,
          completionStatus: 'COMPLETED',
          qtyExpectedTotal: record.expectedQty,
          qtyActualTotal: record.receivedQty,
          qtyDiffTotal: record.differenceQty,
        }),
    sourceObjectName: record.sourceObjectName,
    taskId: record.taskId,
    taskNo: record.taskNo,
    productionOrderId: record.taskId,
    productionOrderNo: record.taskNo,
    itemKind: record.itemKind,
    itemName: record.itemName,
    materialSku: record.materialSku,
    partName: record.partName,
    fabricColor: record.fabricColor,
    sizeCode: record.sizeCode,
    feiTicketNo: record.feiTicketNo,
    transferBagNo: record.transferBagNo,
    fabricRollNo: record.fabricRollNo,
    expectedQty: record.expectedQty,
    receivedQty: record.receivedQty,
    differenceQty: record.differenceQty,
    unit: record.unit,
    receiverName: record.receiverName,
    receivedAt: record.receivedAt,
    locationText: `${record.areaName} / ${record.shelfNo} / ${record.locationNo}`,
    areaName: record.areaName,
    shelfNo: record.shelfNo,
    locationNo: record.locationNo,
    status: resolveWaitProcessStockStatus(record),
    abnormalReason: record.abnormalReason,
    photoList: [...record.photoList],
    remark: record.remark,
  }
}

function buildOutboundRecordFromHandoverRecordInput(input: {
  warehouse: FactoryInternalWarehouse
  factory: Factory
  head: PdaHandoverHead
  record: PdaHandoverRecord
  recordIndex: number
}): FactoryWarehouseOutboundRecord {
  const { warehouse, factory, head, record, recordIndex } = input
  const outboundQty = roundQty(record.submittedQty ?? record.plannedQty ?? 0)
  const receiverWrittenQty = typeof record.receiverWrittenQty === 'number' ? roundQty(record.receiverWrittenQty) : undefined
  const differenceQty = typeof receiverWrittenQty === 'number' ? roundQty(receiverWrittenQty - outboundQty) : undefined
  const status = resolveHandoutStatus(record)
  const skuInfo = deriveSkuFromRecord(record)
  const factoryProcess = resolvePrimaryFactoryProcess(factory)
  const sourceType = head.sourceType || record.sourceType
  const sourceFields = sourceType === 'STOCK'
    ? {
        sourceType: 'STOCK' as const,
        stockMaterialId: head.stockMaterialId || record.stockMaterialId,
        stockMaterialName: head.stockMaterialName || record.stockMaterialName,
        productionOrderId: undefined,
        productionOrderNo: undefined,
      }
    : {
        sourceType: 'PRODUCTION_ORDER' as const,
        productionOrderId: head.productionOrderId,
        productionOrderNo: head.productionOrderNo,
        stockMaterialId: undefined,
        stockMaterialName: undefined,
      }

  return {
    outboundRecordId: `OUT-${head.handoverId}-${String(recordIndex + 1).padStart(3, '0')}`,
    outboundRecordNo: `CK-${head.handoverOrderNo || head.handoverId}-${String(recordIndex + 1).padStart(2, '0')}`,
    warehouseId: warehouse.warehouseId,
    warehouseName: warehouse.warehouseName,
    factoryId: factory.id,
    factoryName: factory.name,
    factoryKind: factory.factoryType,
    processCode: factoryProcess.processCode,
    processName: factoryProcess.processName,
    sourceTaskId: head.taskId,
    sourceTaskNo: head.taskNo,
    ...sourceFields,
    handoverOrderId: head.handoverOrderId || head.handoverId,
    handoverOrderNo: head.handoverOrderNo || head.handoverId,
    handoverRecordId: record.handoverRecordId || record.recordId,
    handoverRecordNo: record.handoverRecordNo || record.recordId,
    handoverRecordQrValue: record.handoverRecordQrValue,
    receiverKind: normalizeWarehouseReceiverKind(head),
    receiverName: head.receiverName || head.targetName,
    itemKind: deriveFactoryItemKind({
      partName: derivePartNameFromRecord(record),
      handoutObjectType: record.objectType,
      processCode: head.processBusinessCode,
    }),
    itemName: record.handoutItemLabel || record.materialName || head.processName,
    materialSku: skuInfo.materialSku,
    partName: derivePartNameFromRecord(record),
    fabricColor: skuInfo.fabricColor,
    sizeCode: skuInfo.sizeCode,
    feiTicketNo: skuInfo.feiTicketNo,
    outboundQty,
    receiverWrittenQty,
    differenceQty,
    unit: record.qtyUnit || head.qtyUnit || '件',
    operatorName: record.factorySubmittedBy || head.sourceFactoryName,
    outboundAt: record.factorySubmittedAt,
    status,
    abnormalReason: differenceQty ? record.diffReason || '数量不符' : record.objectionReason,
    photoList: record.receiverProofFiles?.map((file) => file.name) || [],
    remark: '由交出记录生成',
  }
}

export function buildOutboundRecordFromHandoverRecord(
  head: PdaHandoverHead,
  record: PdaHandoverRecord,
  factory: Factory,
  warehouse: FactoryInternalWarehouse,
  recordIndex = 0,
): FactoryWarehouseOutboundRecord {
  return buildOutboundRecordFromHandoverRecordInput({ head, record, factory, warehouse, recordIndex })
}

function buildWaitHandoverStockItemFromOutbound(
  record: FactoryWarehouseOutboundRecord,
): FactoryWaitHandoverStockItem {
  return {
    stockItemId: `WHS-${record.outboundRecordId}`,
    warehouseId: record.warehouseId,
    factoryId: record.factoryId,
    factoryName: record.factoryName,
    factoryKind: record.factoryKind,
    warehouseName: record.warehouseName,
    processCode: record.processCode,
    processName: record.processName,
    craftCode: record.craftCode,
    craftName: record.craftName,
    taskId: record.sourceTaskId,
    taskNo: record.sourceTaskNo,
    sourceType: record.sourceType,
    productionOrderId: record.productionOrderId,
    productionOrderNo: record.productionOrderNo,
    stockMaterialId: record.stockMaterialId,
    stockMaterialName: record.stockMaterialName,
    itemKind: record.itemKind,
    itemName: record.itemName,
    materialSku: record.materialSku,
    partName: record.partName,
    fabricColor: record.fabricColor,
    sizeCode: record.sizeCode,
    feiTicketNo: record.feiTicketNo,
    transferBagNo: record.transferBagNo,
    fabricRollNo: record.fabricRollNo,
    completedQty: record.outboundQty,
    lossQty: record.differenceQty && record.differenceQty < 0 ? Math.abs(record.differenceQty) : 0,
    waitHandoverQty: 0,
    unit: record.unit,
    receiverKind: record.receiverKind,
    receiverName: record.receiverName,
    handoverOrderId: record.handoverOrderId,
    handoverOrderNo: record.handoverOrderNo,
    handoverRecordId: record.handoverRecordId,
    handoverRecordNo: record.handoverRecordNo,
    handoverRecordQrValue: record.handoverRecordQrValue,
    receiverWrittenQty: record.receiverWrittenQty,
    differenceQty: record.differenceQty,
    objectionStatus: record.status === '异议中' ? '处理中' : undefined,
    areaName: record.status === '已出库' ? '待确认区' : record.status === '差异' || record.status === '异议中' ? '异常区' : 'B区',
    shelfNo: record.status === '已出库' ? '待确认-01' : record.status === '差异' || record.status === '异议中' ? '异常-01' : 'B-01',
    locationNo: record.status === '已出库' ? '待确认-01-01' : record.status === '差异' || record.status === '异议中' ? '异常-01-01' : 'B-01-01',
    status: resolveWaitHandoverStatus(record),
    abnormalReason: record.abnormalReason,
    photoList: [...record.photoList],
    remark: record.remark,
  }
}

function buildPendingWaitHandoverStockItem(input: {
  warehouse: FactoryInternalWarehouse
  factory: Factory
  head: PdaHandoverHead
}): FactoryWaitHandoverStockItem | null {
  const { warehouse, factory, head } = input
  const remainingQty = roundQty(head.qtyExpectedTotal - (head.submittedQtyTotal ?? 0))
  if (remainingQty <= 0) return null
  const location = pickWarehouseLocation(warehouse, head.handoverId, '待交出')
  const factoryProcess = resolvePrimaryFactoryProcess(factory)
  const sourceFields = head.sourceType === 'STOCK'
    ? {
        sourceType: 'STOCK' as const,
        stockMaterialId: head.stockMaterialId,
        stockMaterialName: head.stockMaterialName,
        productionOrderId: undefined,
        productionOrderNo: undefined,
      }
    : {
        sourceType: 'PRODUCTION_ORDER' as const,
        productionOrderId: head.productionOrderId,
        productionOrderNo: head.productionOrderNo,
        stockMaterialId: undefined,
        stockMaterialName: undefined,
      }

  return {
    stockItemId: `WHS-${head.handoverId}-PENDING`,
    warehouseId: warehouse.warehouseId,
    factoryId: factory.id,
    factoryName: factory.name,
    factoryKind: factory.factoryType,
    warehouseName: warehouse.warehouseName,
    processCode: factoryProcess.processCode,
    processName: factoryProcess.processName,
    taskId: head.taskId,
    taskNo: head.taskNo,
    ...sourceFields,
    itemKind: deriveFactoryItemKind({
      processCode: head.processBusinessCode,
    }),
    itemName: `${head.processName}待交出`,
    completedQty: roundQty(head.qtyExpectedTotal),
    lossQty: 0,
    waitHandoverQty: remainingQty,
    unit: head.qtyUnit,
    receiverKind: normalizeWarehouseReceiverKind(head),
    receiverName: head.receiverName || head.targetName,
    handoverOrderId: head.handoverOrderId || head.handoverId,
    handoverOrderNo: head.handoverOrderNo || head.handoverId,
    areaName: location.areaName,
    shelfNo: location.shelfNo,
    locationNo: location.locationNo,
    status: '待交出',
    photoList: [],
    remark: '待交出库存',
  }
}

function buildMockCompletedWaitHandoverStockItem(input: {
  warehouse: FactoryInternalWarehouse
  factory: Factory
  taskId: string
  taskNo: string
  productionOrderId: string
  productionOrderNo: string
  itemKind: FactoryWarehouseItemKind
  itemName: string
  materialSku?: string
  partName?: string
  fabricColor?: string
  sizeCode?: string
  completedQty: number
  lossQty: number
  waitHandoverQty: number
  unit: string
  receiverKind: FactoryWarehouseReceiverKind
  receiverName: string
  remark: string
}): FactoryWaitHandoverStockItem {
  const { warehouse, factory } = input
  const location = pickWarehouseLocation(warehouse, input.taskId, '待交出')
  const factoryProcess = resolvePrimaryFactoryProcess(factory)

  return {
    stockItemId: `WHS-${input.taskId}-PENDING`,
    warehouseId: warehouse.warehouseId,
    factoryId: factory.id,
    factoryName: factory.name,
    factoryKind: factory.factoryType,
    warehouseName: warehouse.warehouseName,
    processCode: factoryProcess.processCode,
    processName: factoryProcess.processName,
    taskId: input.taskId,
    taskNo: input.taskNo,
    sourceType: 'PRODUCTION_ORDER',
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo,
    itemKind: input.itemKind,
    itemName: input.itemName,
    materialSku: input.materialSku,
    partName: input.partName,
    fabricColor: input.fabricColor,
    sizeCode: input.sizeCode,
    completedQty: roundQty(input.completedQty),
    lossQty: roundQty(input.lossQty),
    waitHandoverQty: roundQty(input.waitHandoverQty),
    unit: input.unit,
    receiverKind: input.receiverKind,
    receiverName: input.receiverName,
    areaName: location.areaName,
    shelfNo: location.shelfNo,
    locationNo: location.locationNo,
    status: '待交出',
    photoList: [],
    remark: input.remark,
  }
}

function buildStocktakeLineFromWaitProcess(
  orderId: string,
  item: FactoryWaitProcessStockItem,
): FactoryWarehouseStocktakeLine {
  const bookQty = roundQty(item.receivedQty || item.expectedQty)
  const countedQty = item.status === '差异待处理' ? roundQty(Math.max(bookQty - 1, 0)) : bookQty
  const differenceQty = roundQty((countedQty ?? 0) - bookQty)
  return {
    lineId: `${orderId}-${item.stockItemId}`,
    stocktakeOrderId: orderId,
    stockItemId: item.stockItemId,
    itemKind: item.itemKind,
    itemName: item.itemName,
    materialSku: item.materialSku,
    partName: item.partName,
    fabricColor: item.fabricColor,
    sizeCode: item.sizeCode,
    feiTicketNo: item.feiTicketNo,
    transferBagNo: item.transferBagNo,
    fabricRollNo: item.fabricRollNo,
    bookQty,
    countedQty,
    differenceQty,
    unit: item.unit,
    areaName: item.areaName,
    shelfNo: item.shelfNo,
    locationNo: item.locationNo,
    differenceReason: differenceQty !== 0 ? '数量不符' : '',
    photoList: differenceQty !== 0 ? ['/placeholder.svg'] : [],
    status: differenceQty !== 0 ? '差异' : '已盘',
    reviewStatus: differenceQty !== 0 ? '待审核' : undefined,
  }
}

function buildStocktakeLineFromWaitHandover(
  orderId: string,
  item: FactoryWaitHandoverStockItem,
): FactoryWarehouseStocktakeLine {
  const bookQty = roundQty(item.waitHandoverQty || item.completedQty)
  const countedQty = item.status === '异议中' ? roundQty(Math.max(bookQty - 2, 0)) : bookQty
  const differenceQty = roundQty((countedQty ?? 0) - bookQty)
  return {
    lineId: `${orderId}-${item.stockItemId}`,
    stocktakeOrderId: orderId,
    stockItemId: item.stockItemId,
    itemKind: item.itemKind,
    itemName: item.itemName,
    materialSku: item.materialSku,
    partName: item.partName,
    fabricColor: item.fabricColor,
    sizeCode: item.sizeCode,
    feiTicketNo: item.feiTicketNo,
    transferBagNo: item.transferBagNo,
    fabricRollNo: item.fabricRollNo,
    bookQty,
    countedQty,
    differenceQty,
    unit: item.unit,
    areaName: item.areaName,
    shelfNo: item.shelfNo,
    locationNo: item.locationNo,
    differenceReason: differenceQty !== 0 ? '漏扫' : '',
    photoList: differenceQty !== 0 ? ['/placeholder.svg'] : [],
    status: differenceQty !== 0 ? '差异' : '已盘',
    reviewStatus: differenceQty !== 0 ? '待审核' : undefined,
  }
}

function buildStocktakeDifferenceReview(
  order: FactoryWarehouseStocktakeOrder,
  line: FactoryWarehouseStocktakeLine,
  createdAt = nowTimestamp(),
): FactoryWarehouseStocktakeDifferenceReview {
  return {
    reviewId: `STR-${line.lineId.replace(/[^A-Za-z0-9]/g, '').slice(-16)}`,
    stocktakeOrderId: order.stocktakeOrderId,
    stocktakeOrderNo: order.stocktakeOrderNo,
    lineId: line.lineId,
    stockItemId: line.stockItemId,
    warehouseId: order.warehouseId,
    warehouseName: order.warehouseName,
    factoryId: order.factoryId,
    factoryName: order.factoryName,
    warehouseKind: order.warehouseKind,
    itemKind: line.itemKind,
    itemName: line.itemName,
    materialSku: line.materialSku,
    partName: line.partName,
    fabricColor: line.fabricColor,
    sizeCode: line.sizeCode,
    feiTicketNo: line.feiTicketNo,
    transferBagNo: line.transferBagNo,
    fabricRollNo: line.fabricRollNo,
    bookQty: line.bookQty,
    countedQty: roundQty(line.countedQty ?? 0),
    differenceQty: roundQty(line.differenceQty ?? 0),
    unit: line.unit,
    reviewStatus: line.reviewStatus || '待审核',
    reviewRemark: line.differenceReason,
    adjustmentOrderId: line.adjustmentOrderId,
    createdAt,
  }
}

function ensureStocktakeDifferenceReviewForLine(
  store: FactoryInternalWarehouseStore,
  order: FactoryWarehouseStocktakeOrder,
  line: FactoryWarehouseStocktakeLine,
): FactoryWarehouseStocktakeDifferenceReview {
  const existed = store.stocktakeDifferenceReviews.find(
    (item) => item.stocktakeOrderId === order.stocktakeOrderId && item.lineId === line.lineId,
  )
  if (existed) {
    existed.bookQty = line.bookQty
    existed.countedQty = roundQty(line.countedQty ?? 0)
    existed.differenceQty = roundQty(line.differenceQty ?? 0)
    existed.reviewRemark = line.differenceReason || existed.reviewRemark
    existed.reviewStatus = line.reviewStatus || existed.reviewStatus
    existed.adjustmentOrderId = line.adjustmentOrderId || existed.adjustmentOrderId
    line.differenceReviewId = existed.reviewId
    line.reviewStatus = existed.reviewStatus
    return existed
  }
  const review = buildStocktakeDifferenceReview(order, line)
  store.stocktakeDifferenceReviews.unshift(review)
  line.differenceReviewId = review.reviewId
  line.reviewStatus = review.reviewStatus
  return review
}

function refreshStocktakeOrderStatusAfterAdjustment(order: FactoryWarehouseStocktakeOrder): void {
  const differenceLines = order.lineList.filter((line) => (line.differenceQty ?? 0) !== 0)
  if (differenceLines.length === 0) {
    order.status = '已完成'
    return
  }
  order.status = differenceLines.every((line) => line.reviewStatus === '已调整') ? '已完成' : '待确认'
}

function seedFactoryWarehouseStore(): FactoryInternalWarehouseStore {
  const warehouses = [
    ...buildDefaultFactoryInternalWarehouses(mockFactories),
    ...buildOnboardingCuttingInternalWarehouses(),
  ]
  const warehouseMap = new Map<string, FactoryInternalWarehouse>()
  const waitProcessWarehouseMap = new Map<string, FactoryInternalWarehouse>()
  const waitHandoverWarehouseMap = new Map<string, FactoryInternalWarehouse>()
  const factoryMap = new Map(mockFactories.map((factory) => [factory.id, factory]))

  warehouses.forEach((warehouse) => {
    warehouseMap.set(warehouse.warehouseId, warehouse)
    if (warehouse.warehouseKind === 'WAIT_PROCESS') {
      waitProcessWarehouseMap.set(warehouse.factoryId, warehouse)
    } else {
      waitHandoverWarehouseMap.set(warehouse.factoryId, warehouse)
    }
  })

  const inboundRecords: FactoryWarehouseInboundRecord[] = []
  const pickupFallbackFactories = mockFactories.filter((factory) => isNonSewingFactory(factory))
  listWarehouseIssueOrders().forEach((doc, docIndex) => {
    const targetFactory =
      (doc.targetFactoryId ? factoryMap.get(doc.targetFactoryId) : undefined)
      || pickupFallbackFactories[docIndex % pickupFallbackFactories.length]
    if (!targetFactory || !isNonSewingFactory(targetFactory)) return
    const warehouse = waitProcessWarehouseMap.get(targetFactory.id)
    if (!warehouse) return
    doc.lines.forEach((line, index) => {
      inboundRecords.push(buildInboundRecordFromPickup(doc, line, targetFactory, warehouse, index))
    })
  })

  listPdaHandoverHeads()
    .filter((head) => head.headType === 'PICKUP' && !!head.factoryId)
    .forEach((head) => {
      const targetFactory = factoryMap.get(head.factoryId)
      if (!targetFactory || !isNonSewingFactory(targetFactory)) return
      const warehouse = waitProcessWarehouseMap.get(targetFactory.id)
      if (!warehouse) return
      getPdaPickupRecordsByHead(head.handoverId)
        .filter((record) => shouldSeedInboundFromPickupRecord(record))
        .forEach((record, index) => {
          inboundRecords.push(buildInboundRecordFromPickupRecordInput({ head, record, warehouse, factory: targetFactory, recordIndex: index }))
        })
    })

  listPdaHandoverHeads()
    .filter((head) => head.headType === 'HANDOUT')
    .forEach((head) => {
      const receivingFactory = resolveFactoryByName(head.receiverName || head.targetName, head.targetName.includes('后道') ? 'SATELLITE_FINISHING' : undefined)
      if (!receivingFactory || !isNonSewingFactory(receivingFactory)) return
      const warehouse = waitProcessWarehouseMap.get(receivingFactory.id)
      if (!warehouse) return
      getPdaHandoverRecordsByHead(head.handoverId).forEach((record, index) => {
        inboundRecords.push(buildInboundRecordFromHandoverReceive(head, record, receivingFactory, warehouse, index))
      })
    })

  const firstWarehouseFactory = factoryMap.get('ID-F002')
  const firstWaitProcessWarehouse = firstWarehouseFactory ? waitProcessWarehouseMap.get(firstWarehouseFactory.id) : undefined
  if (firstWarehouseFactory && firstWaitProcessWarehouse && !inboundRecords.some((record) => record.factoryId === firstWarehouseFactory.id)) {
    const location = pickWarehouseLocation(firstWaitProcessWarehouse, 'TASK-PRINT-COMPLETE-SEED-001', '已入库')
    const factoryProcess = resolvePrimaryFactoryProcess(firstWarehouseFactory)
    inboundRecords.push({
      inboundRecordId: 'INB-TASK-PRINT-COMPLETE-SEED-001',
      inboundRecordNo: 'RK-WL-PRINT-SEED-001',
      warehouseId: firstWaitProcessWarehouse.warehouseId,
      warehouseName: firstWaitProcessWarehouse.warehouseName,
      factoryId: firstWarehouseFactory.id,
      factoryName: firstWarehouseFactory.name,
      factoryKind: firstWarehouseFactory.factoryType,
      processCode: factoryProcess.processCode,
      processName: factoryProcess.processName,
      sourceRecordId: 'ISSUE-PRINT-SEED-001',
      sourceRecordNo: 'WL-PRINT-SEED-001',
      sourceRecordType: 'MATERIAL_PICKUP',
      sourceObjectName: '面辅料仓',
      taskId: 'TASK-PRINT-COMPLETE-SEED-001',
      taskNo: 'TASK-PRINT-COMPLETE-SEED-001',
      itemKind: '面料',
      itemName: '印花底布',
      materialSku: 'FAB-PRINT-COMPLETE-001',
      fabricColor: '青石灰',
      sizeCode: '整匹',
      expectedQty: 180,
      receivedQty: 180,
      differenceQty: 0,
      unit: '匹',
      receiverName: firstWarehouseFactory.name,
      receivedAt: '2026-04-15 09:00:00',
      areaName: location.areaName,
      shelfNo: location.shelfNo,
      locationNo: location.locationNo,
      status: '已入库',
      photoList: [],
      remark: '由领料记录生成',
    })
  }

  if (firstWarehouseFactory && firstWaitProcessWarehouse) {
    ;([
      {
        processCode: 'DYE',
        processName: '染色',
        suffix: 'DYE-001',
        itemName: '40S 精梳棉染色备货面料',
        materialSku: 'FAB-STOCK-DYE-001',
        receivedQty: 360,
      },
      {
        processCode: 'PRINT',
        processName: '印花',
        suffix: 'PRINT-001',
        itemName: '数码印花备货底布',
        materialSku: 'FAB-STOCK-PRINT-001',
        receivedQty: 280,
      },
    ] as const).forEach((seed) => {
      const location = pickWarehouseLocation(firstWaitProcessWarehouse, `STOCK-${seed.suffix}`, '已入库')
      inboundRecords.push({
        inboundRecordId: `INB-STOCK-${seed.suffix}`,
        inboundRecordNo: `RK-STOCK-${seed.suffix}`,
        warehouseId: firstWaitProcessWarehouse.warehouseId,
        warehouseName: firstWaitProcessWarehouse.warehouseName,
        factoryId: firstWarehouseFactory.id,
        factoryName: firstWarehouseFactory.name,
        factoryKind: firstWarehouseFactory.factoryType,
        processCode: seed.processCode,
        processName: seed.processName,
        sourceRecordId: `ISSUE-STOCK-${seed.suffix}`,
        sourceRecordNo: `WL-STOCK-${seed.suffix}`,
        sourceRecordType: 'MATERIAL_PICKUP',
        sourceObjectName: '面辅料仓',
        itemKind: '面料',
        itemName: seed.itemName,
        materialSku: seed.materialSku,
        expectedQty: seed.receivedQty,
        receivedQty: seed.receivedQty,
        differenceQty: 0,
        unit: '米',
        receiverName: firstWarehouseFactory.name,
        receivedAt: '2026-07-15 08:30:00',
        areaName: location.areaName,
        shelfNo: location.shelfNo,
        locationNo: location.locationNo,
        status: '已入库',
        photoList: [],
        remark: '平台按备货创建演示库存',
      })
    })
  }

  ONBOARDING_CUTTING_FACTORIES.forEach((demoFactory) => {
    const onboardingWaitProcessWarehouse = waitProcessWarehouseMap.get(demoFactory.factoryId)
    if (!onboardingWaitProcessWarehouse) return
    ;[
      {
        lineNo: '01',
        taskSuffix: '101-01',
        itemName: 'Black 弹力斜纹主面料',
        materialSku: 'tdv_demand_SPU_2024_010-bom-black-stretch-twill',
        fabricColor: 'Black',
        fabricRollNo: 'ROLL-CUT-101-01',
        expectedQty: demoFactory.seedNo === '035' ? 1260 : 1320,
        receivedQty: demoFactory.seedNo === '035' ? 1260 : 1320,
      },
      {
        lineNo: '02',
        taskSuffix: '101-02',
        itemName: 'Charcoal 弹力斜纹主面料',
        materialSku: 'tdv_demand_SPU_2024_010-bom-charcoal-stretch-twill',
        fabricColor: 'Charcoal',
        fabricRollNo: 'ROLL-CUT-101-02',
        expectedQty: demoFactory.seedNo === '035' ? 840 : 900,
        receivedQty: demoFactory.seedNo === '035' ? 840 : 900,
      },
    ].forEach((item) => {
      const taskId = `CUT-${demoFactory.seedNo}-260306-${item.taskSuffix}`
      const location = pickWarehouseLocation(onboardingWaitProcessWarehouse, taskId, '已入库')
      inboundRecords.push({
        inboundRecordId: `INB-ONBOARD-${demoFactory.seedNo}-CUT-260306-${item.taskSuffix}`,
        inboundRecordNo: `RK-CUT-${demoFactory.seedNo}-260306-${item.taskSuffix}`,
        warehouseId: onboardingWaitProcessWarehouse.warehouseId,
        warehouseName: onboardingWaitProcessWarehouse.warehouseName,
        factoryId: demoFactory.factoryId,
        factoryName: demoFactory.factoryName,
        factoryKind: 'CENTRAL_CUTTING',
        processCode: 'CUT_PANEL',
        processName: '裁床',
        sourceRecordId: `PICKUP-CUT-${demoFactory.seedNo}-260306-${item.taskSuffix}`,
        sourceRecordNo: `LL-CUT-${demoFactory.seedNo}-260306-${item.taskSuffix}`,
        sourceRecordType: 'MATERIAL_PICKUP',
        sourceObjectName: '中央仓-中转仓',
        taskId,
        taskNo: taskId,
        itemKind: '面料',
        itemName: item.itemName,
        materialSku: item.materialSku,
        fabricColor: item.fabricColor,
        sizeCode: '整匹',
        fabricRollNo: item.fabricRollNo,
        expectedQty: item.expectedQty,
        receivedQty: item.receivedQty,
        differenceQty: 0,
        unit: '米',
        receiverName: '裁床仓管',
        receivedAt: `2026-04-20 09:${demoFactory.seedNo === '035' ? '45' : '30'}:00`,
        areaName: location.areaName,
        shelfNo: location.shelfNo,
        locationNo: location.locationNo,
        status: '已入库',
        photoList: [],
        remark: 'PDA 领料入仓演示数据',
      })
    })
  })

  const waitProcessStockItems = inboundRecords.map((record) => buildWaitProcessStockItemFromInbound(record))
  inboundRecords.forEach((record, index) => {
    record.generatedStockItemId = waitProcessStockItems[index]?.stockItemId
  })

  const outboundRecords: FactoryWarehouseOutboundRecord[] = []
  const waitHandoverStockItems: FactoryWaitHandoverStockItem[] = []

  listPdaHandoverHeads()
    .filter((head) => head.headType === 'HANDOUT')
    .forEach((head) => {
      const sourceFactory = resolveFactoryByName(
        head.sourceFactoryName,
        head.processBusinessCode === 'POST_FINISHING' ? 'SATELLITE_FINISHING' : undefined,
      )
      if (!sourceFactory || !isNonSewingFactory(sourceFactory)) return
      const warehouse = waitHandoverWarehouseMap.get(sourceFactory.id)
      if (!warehouse) return

      const pendingItem = buildPendingWaitHandoverStockItem({ factory: sourceFactory, warehouse, head })
      if (pendingItem) {
        waitHandoverStockItems.push(pendingItem)
      }

      getPdaHandoverRecordsByHead(head.handoverId).forEach((record, index) => {
        const outbound = buildOutboundRecordFromHandoverRecord(head, record, sourceFactory, warehouse, index)
        outboundRecords.push(outbound)
        const stockItem = buildWaitHandoverStockItemFromOutbound(outbound)
        waitHandoverStockItems.push(stockItem)
        outbound.relatedWaitHandoverStockItemId = stockItem.stockItemId
      })
    })

  if (!outboundRecords.some((record) => record.status === '差异')) {
    const baseOutbound = outboundRecords.find((record) => record.status === '已回写') || outboundRecords[0]
    if (baseOutbound) {
      const diffOutbound: FactoryWarehouseOutboundRecord = {
        ...baseOutbound,
        outboundRecordId: 'OUT-FIW-DIFF-SEED-001',
        outboundRecordNo: 'CK-FIW-DIFF-SEED-001',
        handoverOrderId: 'HOH-FIW-DIFF-SEED',
        handoverOrderNo: 'HDO-FIW-DIFF-SEED',
        handoverRecordId: 'HOR-FIW-DIFF-SEED-001',
        handoverRecordNo: 'HDR-FIW-DIFF-SEED-001',
        receiverWrittenQty: Math.max(baseOutbound.outboundQty - 1, 0),
        differenceQty: -1,
        status: '差异',
        abnormalReason: '数量不符',
      }
      const diffWaitHandoverStockItem: FactoryWaitHandoverStockItem = {
        ...buildFactoryWaitHandoverStockItemFromOutboundRecord(diffOutbound),
        stockItemId: 'WHS-FIW-DIFF-SEED-001',
        handoverOrderId: diffOutbound.handoverOrderId,
        handoverOrderNo: diffOutbound.handoverOrderNo,
        handoverRecordId: diffOutbound.handoverRecordId,
        handoverRecordNo: diffOutbound.handoverRecordNo,
        receiverWrittenQty: diffOutbound.receiverWrittenQty,
        differenceQty: diffOutbound.differenceQty,
        status: '差异',
        abnormalReason: '数量不符',
      }
      diffOutbound.relatedWaitHandoverStockItemId = diffWaitHandoverStockItem.stockItemId
      outboundRecords.push(diffOutbound)
      waitHandoverStockItems.push(diffWaitHandoverStockItem)
    }
  }

  ONBOARDING_CUTTING_FACTORIES.forEach((demoFactory) => {
    const onboardingWaitHandoverWarehouse = waitHandoverWarehouseMap.get(demoFactory.factoryId)
    if (!onboardingWaitHandoverWarehouse) return
    ;[
      {
        lineNo: '001',
        itemName: '前片待交出',
        partName: '前片',
        completedQty: demoFactory.seedNo === '035' ? 96 : 80,
        waitHandoverQty: demoFactory.seedNo === '035' ? 96 : 80,
      },
      {
        lineNo: '002',
        itemName: '后片待交出',
        partName: '后片',
        completedQty: demoFactory.seedNo === '035' ? 96 : 80,
        waitHandoverQty: demoFactory.seedNo === '035' ? 96 : 80,
      },
    ].forEach((item) => {
      const feiTicketNo = `FT-ONBOARD-${demoFactory.seedNo}-${item.lineNo}`
      const transferBagNo = `TB-ONBOARD-${demoFactory.seedNo}-001`
      const location = pickWarehouseLocation(onboardingWaitHandoverWarehouse, feiTicketNo, '待交出')
      waitHandoverStockItems.push({
        stockItemId: `WHS-ONBOARD-${demoFactory.seedNo}-PB-001-FEI-${item.lineNo}`,
        warehouseId: onboardingWaitHandoverWarehouse.warehouseId,
        factoryId: demoFactory.factoryId,
        factoryName: demoFactory.factoryName,
        factoryKind: 'CENTRAL_CUTTING',
        warehouseName: onboardingWaitHandoverWarehouse.warehouseName,
        processCode: 'CUT_PANEL',
        processName: '裁床',
        taskId: `PB-ONBOARD-${demoFactory.seedNo}-001`,
        taskNo: `PB-ONBOARD-${demoFactory.seedNo}-001`,
        productionOrderId: 'PO-202603-0004',
        productionOrderNo: 'PO-202603-0004',
        itemKind: '裁片',
        itemName: item.itemName,
        materialSku: 'tdv_demand_SPU_2024_010-bom-black-stretch-twill',
        partName: item.partName,
        fabricColor: 'Black',
        sizeCode: 'M',
        feiTicketNo,
        transferBagNo,
        completedQty: item.completedQty,
        lossQty: 0,
        waitHandoverQty: item.waitHandoverQty,
        unit: '片',
        receiverKind: '后道工厂',
        receiverName: '后道工厂',
        areaName: location.areaName,
        shelfNo: location.shelfNo,
        locationNo: location.locationNo,
        locationText: location.locationText,
        status: '待交出',
        photoList: [],
        remark: '菲票入仓演示库存',
      })
    })
  })

  const completionSeedFactory = factoryMap.get('ID-F002')
  const completionSeedWarehouse = completionSeedFactory ? waitHandoverWarehouseMap.get(completionSeedFactory.id) : undefined
  if (completionSeedFactory && completionSeedWarehouse) {
    waitHandoverStockItems.push(
      buildMockCompletedWaitHandoverStockItem({
        warehouse: completionSeedWarehouse,
        factory: completionSeedFactory,
        taskId: 'TASK-PRINT-COMPLETE-SEED-001',
        taskNo: 'TASK-PRINT-COMPLETE-SEED-001',
        productionOrderId: 'PO-20260330-PRINT-001',
        productionOrderNo: 'PO-20260330-PRINT-001',
        itemKind: '面料',
        itemName: '印花面料待交出',
        materialSku: 'FAB-PRINT-COMPLETE-001',
        fabricColor: '青石灰',
        sizeCode: '整匹',
        completedQty: 180,
        lossQty: 6,
        waitHandoverQty: 174,
        unit: '匹',
        receiverKind: '中转仓',
        receiverName: '中转仓',
        remark: '任务完工后待交出',
      }),
    )

    if (!outboundRecords.some((record) => record.factoryId === completionSeedFactory.id)) {
      const factoryProcess = resolvePrimaryFactoryProcess(completionSeedFactory)
      const outbound: FactoryWarehouseOutboundRecord = {
        outboundRecordId: 'OUT-TASK-PRINT-COMPLETE-SEED-001',
        outboundRecordNo: 'CK-PRINT-SEED-001',
        warehouseId: completionSeedWarehouse.warehouseId,
        warehouseName: completionSeedWarehouse.warehouseName,
        factoryId: completionSeedFactory.id,
        factoryName: completionSeedFactory.name,
        factoryKind: completionSeedFactory.factoryType,
        processCode: factoryProcess.processCode,
        processName: factoryProcess.processName,
        sourceTaskId: 'TASK-PRINT-COMPLETE-SEED-001',
        sourceTaskNo: 'TASK-PRINT-COMPLETE-SEED-001',
        sourceType: 'PRODUCTION_ORDER',
        productionOrderId: 'PO-20260330-PRINT-001',
        productionOrderNo: 'PO-20260330-PRINT-001',
        handoverOrderId: 'HOH-PRINT-SEED-001',
        handoverOrderNo: 'HDO-PRINT-SEED-001',
        handoverRecordId: 'HOR-PRINT-SEED-001',
        handoverRecordNo: 'HDR-PRINT-SEED-001',
        handoverRecordQrValue: 'QR:HDR-PRINT-SEED-001',
        receiverKind: '中转仓',
        receiverName: '中转仓',
        itemKind: '面料',
        itemName: '印花面料待交出',
        materialSku: 'FAB-PRINT-COMPLETE-001',
        fabricColor: '青石灰',
        sizeCode: '整匹',
        outboundQty: 120,
        receiverWrittenQty: 120,
        differenceQty: 0,
        unit: '匹',
        operatorName: '印花工厂仓管',
        outboundAt: '2026-04-16 16:30:00',
        status: '已回写',
        photoList: [],
        remark: '由交出记录生成',
      }
      outboundRecords.push(outbound)
      const stockItem = buildWaitHandoverStockItemFromOutbound(outbound)
      outbound.relatedWaitHandoverStockItemId = stockItem.stockItemId
      waitHandoverStockItems.push(stockItem)
    }
  }

  const completedStocktakeOrderId = 'STO-FIW-001'
  const pendingStocktakeOrderId = 'STO-FIW-002'
  const completedWarehouse = warehouses.find((warehouse) => warehouse.factoryId === 'ID-F002' && warehouse.warehouseKind === 'WAIT_PROCESS') || warehouses[0]
  const pendingWarehouse = warehouses.find((warehouse) => warehouse.factoryId === 'ID-F004' && warehouse.warehouseKind === 'WAIT_HANDOVER') || warehouses[1]

  const completedLines = waitProcessStockItems
    .filter((item) => item.warehouseId === completedWarehouse.warehouseId)
    .slice(0, 3)
    .map((item) => buildStocktakeLineFromWaitProcess(completedStocktakeOrderId, item))
  const pendingLines = waitHandoverStockItems
    .filter((item) => item.warehouseId === pendingWarehouse.warehouseId)
    .slice(0, 3)
    .map((item) => buildStocktakeLineFromWaitHandover(pendingStocktakeOrderId, item))

  const stocktakeOrders: FactoryWarehouseStocktakeOrder[] = [
    {
      stocktakeOrderId: completedStocktakeOrderId,
      stocktakeOrderNo: 'PD-202604-001',
      factoryId: completedWarehouse.factoryId,
      factoryName: completedWarehouse.factoryName,
      warehouseId: completedWarehouse.warehouseId,
      warehouseName: completedWarehouse.warehouseName,
      warehouseKind: completedWarehouse.warehouseKind,
      stocktakeScope: '全盘',
      stocktakeMethod: '全盘',
      isBlindStocktake: false,
      ownerNames: ['仓库专员'],
      plannedAt: '2026-04-18 09:00:00',
      status: '已完成',
      createdBy: '仓库专员',
      createdAt: '2026-04-18 09:10:00',
      startedAt: '2026-04-18 09:20:00',
      completedAt: '2026-04-18 10:05:00',
      lineList: completedLines,
      remark: '默认全盘',
    },
    {
      stocktakeOrderId: pendingStocktakeOrderId,
      stocktakeOrderNo: 'PD-202604-002',
      factoryId: pendingWarehouse.factoryId,
      factoryName: pendingWarehouse.factoryName,
      warehouseId: pendingWarehouse.warehouseId,
      warehouseName: pendingWarehouse.warehouseName,
      warehouseKind: pendingWarehouse.warehouseKind,
      stocktakeScope: '全盘',
      stocktakeMethod: '全盘',
      isBlindStocktake: true,
      ownerNames: ['仓库专员', '仓库主管'],
      plannedAt: '2026-04-20 14:00:00',
      status: '待确认',
      createdBy: '仓库专员',
      createdAt: '2026-04-20 14:10:00',
      startedAt: '2026-04-20 14:20:00',
      completedAt: '2026-04-20 16:05:00',
      lineList: pendingLines,
      remark: '存在差异待确认',
    },
  ]
  const buildOnboardingProcessLines = (
    orderId: string,
    stockItems: FactoryWaitProcessStockItem[],
    countedQtyList: Array<number | undefined>,
  ): FactoryWarehouseStocktakeLine[] =>
    stockItems.map((item, index) => {
      const countedQty = countedQtyList[index]
      const line = buildStocktakeLineFromWaitProcess(orderId, item)
      const differenceQty = typeof countedQty === 'number' ? roundQty(countedQty - line.bookQty) : undefined
      return {
        ...line,
        lineId: `${orderId}-${item.stockItemId}`,
        stocktakeOrderId: orderId,
        countedQty,
        differenceQty,
        differenceReason:
          typeof differenceQty === 'number' && differenceQty > 0
            ? '现场多出一卷已补录'
            : typeof differenceQty === 'number' && differenceQty < 0
              ? '现场短少一卷待复核'
              : '',
        status: countedQty === undefined ? '未盘' : differenceQty === 0 ? '已盘' : '差异',
        reviewStatus: countedQty !== undefined && differenceQty !== 0 ? '待审核' : undefined,
        photoList: countedQty !== undefined && differenceQty !== 0 ? ['/placeholder.svg'] : [],
      }
    })
  const buildOnboardingHandoverLines = (
    orderId: string,
    stockItems: FactoryWaitHandoverStockItem[],
    countedQtyList: Array<number | undefined>,
  ): FactoryWarehouseStocktakeLine[] =>
    stockItems.map((item, index) => {
      const countedQty = countedQtyList[index]
      const line = buildStocktakeLineFromWaitHandover(orderId, item)
      const differenceQty = typeof countedQty === 'number' ? roundQty(countedQty - line.bookQty) : undefined
      return {
        ...line,
        lineId: `${orderId}-${item.stockItemId}`,
        stocktakeOrderId: orderId,
        countedQty,
        differenceQty,
        differenceReason:
          typeof differenceQty === 'number' && differenceQty > 0
            ? '菲票实物多出，待生成盘盈单'
            : typeof differenceQty === 'number' && differenceQty < 0
              ? '暂存袋漏扫，待生成盘亏单'
              : '',
        status: countedQty === undefined ? '未盘' : differenceQty === 0 ? '已盘' : '差异',
        reviewStatus: countedQty !== undefined && differenceQty !== 0 ? '待审核' : undefined,
        photoList: countedQty !== undefined && differenceQty !== 0 ? ['/placeholder.svg'] : [],
      }
    })

  ONBOARDING_CUTTING_FACTORIES.forEach((demoFactory) => {
    const seedNo = getOnboardingCuttingSeedNo(demoFactory.factoryId)
    const onboardingWaitProcessWarehouse = waitProcessWarehouseMap.get(demoFactory.factoryId)
    const onboardingProcessStockItems = waitProcessStockItems
      .filter((item) => item.factoryId === demoFactory.factoryId)
      .slice(0, 2)

    if (onboardingWaitProcessWarehouse && onboardingProcessStockItems.length > 0) {
      const inProgressOrderId = `STO-ONBOARD-${seedNo}-PDA-001`
      const pendingOrderId = `STO-ONBOARD-${seedNo}-PDA-002`
      const completedOrderId = `STO-ONBOARD-${seedNo}-PDA-003`
      const cancelledOrderId = `STO-ONBOARD-${seedNo}-PDA-004`
      const completedAdjustedLines = buildOnboardingProcessLines(
        completedOrderId,
        onboardingProcessStockItems,
        onboardingProcessStockItems.map((item, index) => (index === 0 ? item.receivedQty + 8 : Math.max(item.receivedQty - 12, 0))),
      )
      completedAdjustedLines.forEach((line) => {
        if ((line.differenceQty ?? 0) !== 0) {
          line.reviewStatus = '已调整'
          line.adjustedAt = `2026-04-20 16:${seedNo === '035' ? '35' : '20'}:00`
          line.adjustmentOrderId = `ADJ-${seedNo}-${line.lineId.replace(/[^A-Za-z0-9]/g, '').slice(-12)}`
        }
      })

      stocktakeOrders.push(
        {
          stocktakeOrderId: inProgressOrderId,
          stocktakeOrderNo: `PD-CUT-${seedNo}-001`,
          factoryId: demoFactory.factoryId,
          factoryName: demoFactory.factoryName,
          warehouseId: onboardingWaitProcessWarehouse.warehouseId,
          warehouseName: onboardingWaitProcessWarehouse.warehouseName,
          warehouseKind: 'WAIT_PROCESS',
          stocktakeScope: '全盘',
          stocktakeMethod: '全盘',
          isBlindStocktake: true,
          ownerNames: ['申请人3', '裁床仓管'],
          plannedAt: '2026-04-20 14:00:00',
          status: '盘点中',
          createdBy: '申请人3',
          createdAt: '2026-04-20 13:50:00',
          startedAt: '2026-04-20 14:00:00',
          lineList: buildOnboardingProcessLines(inProgressOrderId, onboardingProcessStockItems, onboardingProcessStockItems.map(() => undefined)),
          remark: 'PDA 盲盘演示单',
        },
        {
          stocktakeOrderId: pendingOrderId,
          stocktakeOrderNo: `PD-CUT-${seedNo}-002`,
          factoryId: demoFactory.factoryId,
          factoryName: demoFactory.factoryName,
          warehouseId: onboardingWaitProcessWarehouse.warehouseId,
          warehouseName: onboardingWaitProcessWarehouse.warehouseName,
          warehouseKind: 'WAIT_PROCESS',
          stocktakeScope: '全盘',
          stocktakeMethod: '全盘',
          isBlindStocktake: false,
          ownerNames: ['申请人3', '仓库主管'],
          plannedAt: '2026-04-20 15:00:00',
          status: '待确认',
          createdBy: '申请人3',
          createdAt: '2026-04-20 14:45:00',
          startedAt: '2026-04-20 15:00:00',
          completedAt: '2026-04-20 15:40:00',
          lineList: buildOnboardingProcessLines(
            pendingOrderId,
            onboardingProcessStockItems,
            onboardingProcessStockItems.map((item, index) => item.receivedQty + (index === 0 ? 15 : -20)),
          ),
          remark: '待加工仓盘盈盘亏待审核',
        },
        {
          stocktakeOrderId: completedOrderId,
          stocktakeOrderNo: `PD-CUT-${seedNo}-003`,
          factoryId: demoFactory.factoryId,
          factoryName: demoFactory.factoryName,
          warehouseId: onboardingWaitProcessWarehouse.warehouseId,
          warehouseName: onboardingWaitProcessWarehouse.warehouseName,
          warehouseKind: 'WAIT_PROCESS',
          stocktakeScope: '全盘',
          stocktakeMethod: '全盘',
          isBlindStocktake: false,
          ownerNames: ['仓库主管'],
          plannedAt: '2026-04-20 16:00:00',
          status: '已完成',
          createdBy: '仓库主管',
          createdAt: '2026-04-20 15:50:00',
          startedAt: '2026-04-20 16:00:00',
          completedAt: '2026-04-20 16:25:00',
          lineList: completedAdjustedLines,
          remark: '盘盈盘亏已调整演示单',
        },
        {
          stocktakeOrderId: cancelledOrderId,
          stocktakeOrderNo: `PD-CUT-${seedNo}-004`,
          factoryId: demoFactory.factoryId,
          factoryName: demoFactory.factoryName,
          warehouseId: onboardingWaitProcessWarehouse.warehouseId,
          warehouseName: onboardingWaitProcessWarehouse.warehouseName,
          warehouseKind: 'WAIT_PROCESS',
          stocktakeScope: '全盘',
          stocktakeMethod: '全盘',
          isBlindStocktake: true,
          ownerNames: ['裁床仓管'],
          plannedAt: '2026-04-21 09:00:00',
          status: '已取消',
          createdBy: '裁床仓管',
          createdAt: '2026-04-21 08:50:00',
          lineList: buildOnboardingProcessLines(cancelledOrderId, onboardingProcessStockItems, onboardingProcessStockItems.map(() => undefined)),
          remark: '演示取消盘点单',
        },
      )
    }

    const onboardingWaitHandoverWarehouse = waitHandoverWarehouseMap.get(demoFactory.factoryId)
    const onboardingHandoverStockItems = waitHandoverStockItems
      .filter((item) => item.factoryId === demoFactory.factoryId)
      .slice(0, 2)

    if (onboardingWaitHandoverWarehouse && onboardingHandoverStockItems.length > 0) {
      const handoverOrderId = `STO-ONBOARD-${seedNo}-PDA-005`
      stocktakeOrders.push({
        stocktakeOrderId: handoverOrderId,
        stocktakeOrderNo: `PD-CUT-${seedNo}-005`,
        factoryId: demoFactory.factoryId,
        factoryName: demoFactory.factoryName,
        warehouseId: onboardingWaitHandoverWarehouse.warehouseId,
        warehouseName: onboardingWaitHandoverWarehouse.warehouseName,
        warehouseKind: 'WAIT_HANDOVER',
        stocktakeScope: '全盘',
        stocktakeMethod: '全盘',
        isBlindStocktake: false,
        ownerNames: ['申请人3', '裁床仓管'],
        plannedAt: '2026-04-21 10:00:00',
        status: '待确认',
        createdBy: '申请人3',
        createdAt: '2026-04-21 09:50:00',
        startedAt: '2026-04-21 10:00:00',
        completedAt: '2026-04-21 10:30:00',
        lineList: buildOnboardingHandoverLines(
          handoverOrderId,
          onboardingHandoverStockItems,
          onboardingHandoverStockItems.map((item, index) => item.waitHandoverQty + (index === 0 ? -3 : 2)),
        ),
        remark: '待交出仓菲票盘点演示单',
      })
    }
  })
  const stocktakeDifferenceReviews: FactoryWarehouseStocktakeDifferenceReview[] = []
  const adjustmentOrders: FactoryWarehouseAdjustmentOrder[] = []
  stocktakeOrders
    .filter((order) => order.status === '待确认')
    .forEach((order) => {
      order.lineList
        .filter((line) => (line.differenceQty ?? 0) !== 0)
        .forEach((line) => {
          const review = buildStocktakeDifferenceReview(order, line, order.completedAt || nowTimestamp())
          line.differenceReviewId = review.reviewId
          line.reviewStatus = review.reviewStatus
          stocktakeDifferenceReviews.push(review)
        })
    })
  stocktakeOrders.forEach((order) => {
    order.lineList
      .filter((line) => line.reviewStatus === '已调整' && line.adjustmentOrderId && (line.differenceQty ?? 0) !== 0)
      .forEach((line) => {
        const review = buildStocktakeDifferenceReview(order, line, line.adjustedAt || order.completedAt || nowTimestamp())
        review.reviewStatus = '已调整'
        review.adjustmentOrderId = line.adjustmentOrderId
        review.reviewedBy = '仓库主管'
        review.reviewedAt = line.adjustedAt || order.completedAt
        review.reviewRemark = line.differenceReason || '盘点差异已审核并调整库存'
        stocktakeDifferenceReviews.push(review)
        adjustmentOrders.unshift({
          adjustmentOrderId: line.adjustmentOrderId as string,
          adjustmentOrderNo: `${(line.differenceQty ?? 0) > 0 ? 'PY' : 'PK'}-${order.stocktakeOrderNo.replace(/[^A-Za-z0-9]/g, '').slice(-8)}-${String(adjustmentOrders.length + 1).padStart(3, '0')}`,
          adjustmentType: (line.differenceQty ?? 0) > 0 ? '盘盈单' : '盘亏单',
          sourceStocktakeOrderId: order.stocktakeOrderId,
          sourceStocktakeOrderNo: order.stocktakeOrderNo,
          sourceLineId: line.lineId,
          reviewId: review.reviewId,
          warehouseId: order.warehouseId,
          warehouseName: order.warehouseName,
          factoryId: order.factoryId,
          factoryName: order.factoryName,
          warehouseKind: order.warehouseKind,
          stockItemId: line.stockItemId,
          itemKind: line.itemKind,
          itemName: line.itemName,
          materialSku: line.materialSku,
          partName: line.partName,
          fabricColor: line.fabricColor,
          sizeCode: line.sizeCode,
          feiTicketNo: line.feiTicketNo,
          transferBagNo: line.transferBagNo,
          fabricRollNo: line.fabricRollNo,
          bookQty: line.bookQty,
          countedQty: roundQty(line.countedQty ?? 0),
          adjustmentQty: roundQty(line.differenceQty ?? 0),
          unit: line.unit,
          status: '已完成',
          createdAt: review.createdAt,
          createdBy: '仓库主管',
          executedAt: line.adjustedAt || order.completedAt,
          executedBy: '仓库主管',
          remark: '盘点差异审核通过后生成库存调整单据',
        })
      })
  })

  return {
    warehouses,
    waitProcessStockItems,
    waitHandoverStockItems,
    inboundRecords,
    outboundRecords,
    stocktakeOrders,
    stocktakeDifferenceReviews,
    adjustmentOrders,
  }
}

function applyFactoryWarehouseAdjustmentToStock(
  store: FactoryInternalWarehouseStore,
  adjustment: FactoryWarehouseAdjustmentOrder,
): void {
  if (adjustment.warehouseKind === 'WAIT_PROCESS') {
    const stockItem = store.waitProcessStockItems.find((item) => item.stockItemId === adjustment.stockItemId)
    if (stockItem) {
      stockItem.receivedQty = roundQty(adjustment.countedQty)
      stockItem.differenceQty = roundQty(stockItem.receivedQty - stockItem.expectedQty)
      stockItem.status = stockItem.differenceQty === 0 ? '已入待加工仓' : '差异待处理'
    }
    return
  }

  const stockItem = store.waitHandoverStockItems.find((item) => item.stockItemId === adjustment.stockItemId)
  if (stockItem) {
    stockItem.waitHandoverQty = roundQty(adjustment.countedQty)
    stockItem.differenceQty = roundQty(stockItem.waitHandoverQty - stockItem.completedQty)
    stockItem.status = stockItem.differenceQty === 0 ? '待交出' : '差异'
  }
}

function appendFactoryWarehouseAdjustmentFlowRecords(
  store: FactoryInternalWarehouseStore,
  adjustment: FactoryWarehouseAdjustmentOrder,
  input: {
    operatedBy: string
    operatedAt: string
  },
): void {
  const warehouse = store.warehouses.find((item) => item.warehouseId === adjustment.warehouseId)
  const waitProcessItem = store.waitProcessStockItems.find((item) => item.stockItemId === adjustment.stockItemId)
  const waitHandoverItem = store.waitHandoverStockItems.find((item) => item.stockItemId === adjustment.stockItemId)
  const baseLocation = {
    areaName: waitProcessItem?.areaName || waitHandoverItem?.areaName || warehouse?.areaList[0]?.areaName || '待确认区',
    shelfNo: waitProcessItem?.shelfNo || waitHandoverItem?.shelfNo || warehouse?.areaList[0]?.shelfList[0]?.shelfNo || '待确认-01',
    locationNo:
      waitProcessItem?.locationNo
      || waitHandoverItem?.locationNo
      || warehouse?.areaList[0]?.shelfList[0]?.locationList[0]?.locationNo
      || '待确认-01-01',
  }
  const flowQty = roundQty(Math.abs(adjustment.adjustmentQty))
  if (flowQty <= 0) return

  if (adjustment.adjustmentQty > 0) {
    const inboundRecordId = `INB-${adjustment.adjustmentOrderId}`
    if (store.inboundRecords.some((record) => record.inboundRecordId === inboundRecordId)) return
    store.inboundRecords.unshift({
      inboundRecordId,
      inboundRecordNo: `RK-${adjustment.adjustmentOrderNo}`,
      warehouseId: adjustment.warehouseId,
      warehouseName: adjustment.warehouseName,
      factoryId: adjustment.factoryId,
      factoryName: adjustment.factoryName,
      factoryKind: warehouse?.factoryKind || waitProcessItem?.factoryKind || waitHandoverItem?.factoryKind || 'CENTRAL_CUTTING',
      processCode: waitProcessItem?.processCode || waitHandoverItem?.processCode,
      processName: waitProcessItem?.processName || waitHandoverItem?.processName,
      sourceRecordId: adjustment.adjustmentOrderId,
      sourceRecordNo: adjustment.adjustmentOrderNo,
      sourceRecordType: 'STOCKTAKE_ADJUSTMENT',
      sourceObjectName: '盘点调整',
      taskId: adjustment.sourceStocktakeOrderId,
      taskNo: adjustment.sourceStocktakeOrderNo,
      itemKind: adjustment.itemKind,
      itemName: adjustment.itemName,
      materialSku: adjustment.materialSku,
      partName: adjustment.partName,
      fabricColor: adjustment.fabricColor,
      sizeCode: adjustment.sizeCode,
      feiTicketNo: adjustment.feiTicketNo,
      transferBagNo: adjustment.transferBagNo,
      fabricRollNo: adjustment.fabricRollNo,
      expectedQty: flowQty,
      receivedQty: flowQty,
      differenceQty: 0,
      unit: adjustment.unit,
      receiverName: input.operatedBy,
      receivedAt: input.operatedAt,
      areaName: baseLocation.areaName,
      shelfNo: baseLocation.shelfNo,
      locationNo: baseLocation.locationNo,
      status: '已入库',
      photoList: [],
      generatedStockItemId: adjustment.stockItemId,
      remark: '盘盈审核通过后生成库存调整入库流水',
    })
    return
  }

  const outboundRecordId = `OUT-${adjustment.adjustmentOrderId}`
  if (store.outboundRecords.some((record) => record.outboundRecordId === outboundRecordId)) return
  store.outboundRecords.unshift({
    outboundRecordId,
    outboundRecordNo: `CK-${adjustment.adjustmentOrderNo}`,
    warehouseId: adjustment.warehouseId,
    warehouseName: adjustment.warehouseName,
    factoryId: adjustment.factoryId,
    factoryName: adjustment.factoryName,
    factoryKind: warehouse?.factoryKind || waitProcessItem?.factoryKind || waitHandoverItem?.factoryKind || 'CENTRAL_CUTTING',
    processCode: waitProcessItem?.processCode || waitHandoverItem?.processCode,
    processName: waitProcessItem?.processName || waitHandoverItem?.processName,
    sourceTaskId: adjustment.sourceStocktakeOrderId,
    sourceTaskNo: adjustment.sourceStocktakeOrderNo,
    receiverKind: '其他接收方',
    receiverName: '盘点调整',
    itemKind: adjustment.itemKind,
    itemName: adjustment.itemName,
    materialSku: adjustment.materialSku,
    partName: adjustment.partName,
    fabricColor: adjustment.fabricColor,
    sizeCode: adjustment.sizeCode,
    feiTicketNo: adjustment.feiTicketNo,
    transferBagNo: adjustment.transferBagNo,
    fabricRollNo: adjustment.fabricRollNo,
    outboundQty: flowQty,
    receiverWrittenQty: flowQty,
    differenceQty: 0,
    unit: adjustment.unit,
    operatorName: input.operatedBy,
    outboundAt: input.operatedAt,
    status: '已回写',
    photoList: [],
    relatedWaitHandoverStockItemId: adjustment.warehouseKind === 'WAIT_HANDOVER' ? adjustment.stockItemId : undefined,
    remark: '盘亏审核通过后生成库存调整出库流水',
  })
}

function hydrateCompletedStocktakeAdjustmentFlows(store: FactoryInternalWarehouseStore): void {
  store.adjustmentOrders
    .filter((adjustment) => adjustment.status === '已完成')
    .forEach((adjustment) => {
      applyFactoryWarehouseAdjustmentToStock(store, adjustment)
      appendFactoryWarehouseAdjustmentFlowRecords(store, adjustment, {
        operatedBy: adjustment.executedBy || adjustment.createdBy,
        operatedAt: adjustment.executedAt || adjustment.createdAt,
      })
    })
}

function ensureFactoryInternalWarehouseStore(): FactoryInternalWarehouseStore {
  if (!internalWarehouseStore) {
    internalWarehouseStore = seedFactoryWarehouseStore()
    hydrateCompletedStocktakeAdjustmentFlows(internalWarehouseStore)
  }
  return internalWarehouseStore
}

function findWarehouseByFactoryAndKindInternal(
  factoryId: string,
  warehouseKind: FactoryInternalWarehouseKind,
): FactoryInternalWarehouse | undefined {
  return ensureFactoryInternalWarehouseStore().warehouses.find(
    (warehouse) => warehouse.factoryId === factoryId && warehouse.warehouseKind === warehouseKind,
  )
}

function findWaitProcessStockIndexBySourceRecordId(
  sourceRecordId: string,
): number {
  return ensureFactoryInternalWarehouseStore().waitProcessStockItems.findIndex(
    (item) => item.sourceRecordId === sourceRecordId,
  )
}

function findWaitHandoverStockIndexByHandoverRecordId(
  handoverRecordId: string,
): number {
  return ensureFactoryInternalWarehouseStore().waitHandoverStockItems.findIndex(
    (item) => item.handoverRecordId === handoverRecordId,
  )
}

function findPendingWaitHandoverStockIndexByOrderId(
  handoverOrderId: string,
): number {
  return ensureFactoryInternalWarehouseStore().waitHandoverStockItems.findIndex(
    (item) =>
      item.handoverOrderId === handoverOrderId
      && !item.handoverRecordId
      && item.status === '待交出',
  )
}

export function listFactoryInternalWarehouses(): FactoryInternalWarehouse[] {
  return cloneValue(ensureFactoryInternalWarehouseStore().warehouses)
}

export function listFactoryInternalWarehouseFactoryOptions(): Factory[] {
  return cloneValue(mockFactories.filter((factory) => isNonSewingFactory(factory)))
}

export function listFactoryWaitProcessStockItems(): FactoryWaitProcessStockItem[] {
  return cloneValue(ensureFactoryInternalWarehouseStore().waitProcessStockItems)
}

export function listFactoryWaitHandoverStockItems(): FactoryWaitHandoverStockItem[] {
  return cloneValue(ensureFactoryInternalWarehouseStore().waitHandoverStockItems)
}

export function listFactoryWarehouseInboundRecords(): FactoryWarehouseInboundRecord[] {
  return cloneValue(ensureFactoryInternalWarehouseStore().inboundRecords)
}

export function listFactoryWarehouseOutboundRecords(): FactoryWarehouseOutboundRecord[] {
  return cloneValue(ensureFactoryInternalWarehouseStore().outboundRecords)
}

export function listFactoryWarehouseStocktakeOrders(): FactoryWarehouseStocktakeOrder[] {
  return cloneValue(ensureFactoryInternalWarehouseStore().stocktakeOrders)
}

export function listFactoryWarehouseStocktakeDifferenceReviews(): FactoryWarehouseStocktakeDifferenceReview[] {
  return cloneValue(ensureFactoryInternalWarehouseStore().stocktakeDifferenceReviews)
}

export function listFactoryWarehouseStocktakeDifferenceReviewsByOrder(stocktakeOrderId: string): FactoryWarehouseStocktakeDifferenceReview[] {
  return cloneValue(ensureFactoryInternalWarehouseStore().stocktakeDifferenceReviews.filter((item) => item.stocktakeOrderId === stocktakeOrderId))
}

export function getFactoryWarehouseStocktakeDifferenceReview(reviewId: string): FactoryWarehouseStocktakeDifferenceReview | undefined {
  const review = ensureFactoryInternalWarehouseStore().stocktakeDifferenceReviews.find((item) => item.reviewId === reviewId)
  return review ? cloneValue(review) : undefined
}

export function listFactoryWarehouseAdjustmentOrders(): FactoryWarehouseAdjustmentOrder[] {
  return cloneValue(ensureFactoryInternalWarehouseStore().adjustmentOrders)
}

export function listFactoryWarehouseAdjustmentOrdersByStocktake(stocktakeOrderId: string): FactoryWarehouseAdjustmentOrder[] {
  return cloneValue(ensureFactoryInternalWarehouseStore().adjustmentOrders.filter((item) => item.sourceStocktakeOrderId === stocktakeOrderId))
}

export function getFactoryWarehouseAdjustmentOrder(adjustmentOrderId: string): FactoryWarehouseAdjustmentOrder | undefined {
  const order = ensureFactoryInternalWarehouseStore().adjustmentOrders.find((item) => item.adjustmentOrderId === adjustmentOrderId)
  return order ? cloneValue(order) : undefined
}

export function getFactoryWarehouseSourceRecordTypeLabel(sourceRecordType: FactoryWarehouseSourceRecordType): string {
  if (sourceRecordType === 'MATERIAL_PICKUP') return '领料记录'
  if (sourceRecordType === 'HANDOVER_RECEIVE') return '交出接收'
  if (sourceRecordType === 'STOCKTAKE_ADJUSTMENT') return '盘点调整'
  return '转入接收'
}

export function getFactoryWarehouseInboundSourceLabel(sourceRecordType: FactoryWarehouseSourceRecordType): string {
  if (sourceRecordType === 'MATERIAL_PICKUP') return '由领料记录生成'
  if (sourceRecordType === 'HANDOVER_RECEIVE') return '由交出接收生成'
  if (sourceRecordType === 'STOCKTAKE_ADJUSTMENT') return '由盘点调整生成'
  return '由转入接收生成'
}

export function getFactoryWarehouseOutboundSourceLabel(): string {
  return '由交出记录生成'
}

export function findFactoryInternalWarehouseByFactoryAndKind(
  factoryId: string,
  warehouseKind: FactoryInternalWarehouseKind,
): FactoryInternalWarehouse | undefined {
  const warehouse = findWarehouseByFactoryAndKindInternal(factoryId, warehouseKind)
  return warehouse ? cloneValue(warehouse) : undefined
}

export function findFactoryWarehouseInboundRecordBySourceRecordId(
  sourceRecordId: string,
): FactoryWarehouseInboundRecord | undefined {
  const record = ensureFactoryInternalWarehouseStore().inboundRecords.find(
    (item) => item.sourceRecordId === sourceRecordId,
  )
  return record ? cloneValue(record) : undefined
}

export function findFactoryWarehouseOutboundRecordByHandoverRecordId(
  handoverRecordId: string,
): FactoryWarehouseOutboundRecord | undefined {
  const record = ensureFactoryInternalWarehouseStore().outboundRecords.find(
    (item) => item.handoverRecordId === handoverRecordId,
  )
  return record ? cloneValue(record) : undefined
}

export function findFactoryWaitProcessStockItemBySourceRecordId(
  sourceRecordId: string,
): FactoryWaitProcessStockItem | undefined {
  const record = ensureFactoryInternalWarehouseStore().waitProcessStockItems.find(
    (item) => item.sourceRecordId === sourceRecordId,
  )
  return record ? cloneValue(record) : undefined
}

export function findFactoryWaitHandoverStockItemByHandoverRecordId(
  handoverRecordId: string,
): FactoryWaitHandoverStockItem | undefined {
  const record = ensureFactoryInternalWarehouseStore().waitHandoverStockItems.find(
    (item) => item.handoverRecordId === handoverRecordId,
  )
  return record ? cloneValue(record) : undefined
}

export function findPendingFactoryWaitHandoverStockItemByOrderId(
  handoverOrderId: string,
): FactoryWaitHandoverStockItem | undefined {
  const record = ensureFactoryInternalWarehouseStore().waitHandoverStockItems.find(
    (item) => item.handoverOrderId === handoverOrderId && !item.handoverRecordId,
  )
  return record ? cloneValue(record) : undefined
}

export function buildFactoryWaitProcessStockItemFromInboundRecord(
  record: FactoryWarehouseInboundRecord,
): FactoryWaitProcessStockItem {
  return cloneValue(buildWaitProcessStockItemFromInbound(record))
}

export function buildFactoryWaitHandoverStockItemFromOutboundRecord(
  record: FactoryWarehouseOutboundRecord,
): FactoryWaitHandoverStockItem {
  return cloneValue(buildWaitHandoverStockItemFromOutbound(record))
}

export function buildFactoryPendingWaitHandoverStockItem(
  head: PdaHandoverHead,
  factory: Factory,
  warehouse: FactoryInternalWarehouse,
): FactoryWaitHandoverStockItem | null {
  const item = buildPendingWaitHandoverStockItem({ head, factory, warehouse })
  return item ? cloneValue(item) : null
}

export function syncFactoryWarehouseHandoverSourceByTaskId(taskId: string): void {
  if (!internalWarehouseStore) return
  const store = internalWarehouseStore

  store.outboundRecords = store.outboundRecords.filter(
    (record) => record.sourceTaskId !== taskId,
  )
  store.waitHandoverStockItems = store.waitHandoverStockItems.filter(
    (item) => item.taskId !== taskId,
  )

  listPdaHandoverHeads()
    .filter((head) => head.headType === 'HANDOUT' && head.taskId === taskId)
    .forEach((head) => {
      const sourceFactory = resolveFactoryByName(
        head.sourceFactoryName,
        head.processBusinessCode === 'POST_FINISHING' ? 'SATELLITE_FINISHING' : undefined,
      )
      if (!sourceFactory || !isNonSewingFactory(sourceFactory)) return
      const warehouse = store.warehouses.find(
        (item) => item.factoryId === sourceFactory.id && item.warehouseKind === 'WAIT_HANDOVER',
      )
      if (!warehouse) return

      const pendingItem = buildPendingWaitHandoverStockItem({ factory: sourceFactory, warehouse, head })
      if (pendingItem) store.waitHandoverStockItems.push(pendingItem)

      getPdaHandoverRecordsByHead(head.handoverId).forEach((record, index) => {
        const outbound = buildOutboundRecordFromHandoverRecord(head, record, sourceFactory, warehouse, index)
        const stockItem = buildWaitHandoverStockItemFromOutbound(outbound)
        outbound.relatedWaitHandoverStockItemId = stockItem.stockItemId
        store.outboundRecords.push(outbound)
        store.waitHandoverStockItems.push(stockItem)
      })
    })
}

export function upsertFactoryWarehouseInboundRecord(
  record: FactoryWarehouseInboundRecord,
): FactoryWarehouseInboundRecord {
  const store = ensureFactoryInternalWarehouseStore()
  const index = store.inboundRecords.findIndex(
    (item) => item.inboundRecordId === record.inboundRecordId || item.sourceRecordId === record.sourceRecordId,
  )
  const nextRecord = cloneValue(record)
  if (index >= 0) {
    store.inboundRecords[index] = nextRecord
  } else {
    store.inboundRecords.unshift(nextRecord)
  }
  return cloneValue(nextRecord)
}

export function upsertFactoryWaitProcessStockItem(
  item: FactoryWaitProcessStockItem,
): FactoryWaitProcessStockItem {
  const store = ensureFactoryInternalWarehouseStore()
  const index = store.waitProcessStockItems.findIndex(
    (stockItem) => stockItem.stockItemId === item.stockItemId || stockItem.sourceRecordId === item.sourceRecordId,
  )
  const nextItem = cloneValue(item)
  if (index >= 0) {
    store.waitProcessStockItems[index] = nextItem
  } else {
    store.waitProcessStockItems.unshift(nextItem)
  }
  return cloneValue(nextItem)
}

export function upsertFactoryWarehouseOutboundRecord(
  record: FactoryWarehouseOutboundRecord,
): FactoryWarehouseOutboundRecord {
  const store = ensureFactoryInternalWarehouseStore()
  const index = store.outboundRecords.findIndex(
    (item) =>
      item.outboundRecordId === record.outboundRecordId
      || (item.handoverRecordId && item.handoverRecordId === record.handoverRecordId),
  )
  const nextRecord = cloneValue(record)
  if (index >= 0) {
    store.outboundRecords[index] = nextRecord
  } else {
    store.outboundRecords.unshift(nextRecord)
  }
  return cloneValue(nextRecord)
}

export function upsertFactoryWaitHandoverStockItem(
  item: FactoryWaitHandoverStockItem,
): FactoryWaitHandoverStockItem {
  const store = ensureFactoryInternalWarehouseStore()
  const index = store.waitHandoverStockItems.findIndex(
    (stockItem) =>
      stockItem.stockItemId === item.stockItemId
      || (!!item.handoverRecordId && stockItem.handoverRecordId === item.handoverRecordId),
  )
  const nextItem = cloneValue(item)
  if (index >= 0) {
    store.waitHandoverStockItems[index] = nextItem
  } else {
    store.waitHandoverStockItems.unshift(nextItem)
  }
  return cloneValue(nextItem)
}

export function decreasePendingFactoryWaitHandoverQty(
  handoverOrderId: string,
  handoverQty: number,
): FactoryWaitHandoverStockItem | null {
  const store = ensureFactoryInternalWarehouseStore()
  const index = findPendingWaitHandoverStockIndexByOrderId(handoverOrderId)
  if (index < 0) return null
  const item = store.waitHandoverStockItems[index]
  item.waitHandoverQty = roundQty(Math.max(item.waitHandoverQty - handoverQty, 0))
  if (item.waitHandoverQty === 0) {
    item.status = '已交出'
  }
  return cloneValue(item)
}

export function findFactoryInternalWarehouseById(warehouseId: string): FactoryInternalWarehouse | undefined {
  return cloneValue(ensureFactoryInternalWarehouseStore().warehouses.find((warehouse) => warehouse.warehouseId === warehouseId))
}

export function listFactoryWarehouseNodeRows(factoryId?: string): FactoryWarehouseNodeRow[] {
  return listFactoryInternalWarehouses()
    .filter((warehouse) => (factoryId ? warehouse.factoryId === factoryId : true))
    .flatMap((warehouse) =>
      warehouse.areaList.flatMap((area) => {
        const areaRow: FactoryWarehouseNodeRow = {
          rowType: 'AREA',
          warehouseId: warehouse.warehouseId,
          warehouseName: warehouse.warehouseName,
          factoryId: warehouse.factoryId,
          factoryName: warehouse.factoryName,
          areaId: area.areaId,
          areaName: area.areaName,
          status: area.status,
          remark: area.remark,
        }
        const shelfRows = area.shelfList.flatMap((shelf) => {
          const shelfRow: FactoryWarehouseNodeRow = {
            rowType: 'SHELF',
            warehouseId: warehouse.warehouseId,
            warehouseName: warehouse.warehouseName,
            factoryId: warehouse.factoryId,
            factoryName: warehouse.factoryName,
            areaId: area.areaId,
            areaName: area.areaName,
            shelfId: shelf.shelfId,
            shelfNo: shelf.shelfNo,
            shelfName: shelf.shelfName,
            status: shelf.status,
            remark: shelf.remark,
          }
          const locationRows = shelf.locationList.map<FactoryWarehouseNodeRow>((location) => ({
            rowType: 'LOCATION',
            warehouseId: warehouse.warehouseId,
            warehouseName: warehouse.warehouseName,
            factoryId: warehouse.factoryId,
            factoryName: warehouse.factoryName,
            areaId: area.areaId,
            areaName: area.areaName,
            shelfId: shelf.shelfId,
            shelfNo: shelf.shelfNo,
            shelfName: shelf.shelfName,
            locationId: location.locationId,
            locationNo: location.locationNo,
            locationName: location.locationName,
            status: location.status,
            remark: location.remark,
          }))
          return [shelfRow, ...locationRows]
        })
        return [areaRow, ...shelfRows]
      }),
    )
}

function mutateWarehouseNode(
  rowType: FactoryWarehouseNodeRow['rowType'],
  ids: { warehouseId: string; areaId: string; shelfId?: string; locationId?: string },
  updater: (target: FactoryWarehouseArea | FactoryWarehouseShelf | FactoryWarehouseLocation) => void,
): boolean {
  const store = ensureFactoryInternalWarehouseStore()
  const warehouse = store.warehouses.find((item) => item.warehouseId === ids.warehouseId)
  if (!warehouse) return false
  const area = warehouse.areaList.find((item) => item.areaId === ids.areaId)
  if (!area) return false
  if (rowType === 'AREA') {
    updater(area)
    warehouse.updatedAt = nowTimestamp()
    return true
  }
  const shelf = area.shelfList.find((item) => item.shelfId === ids.shelfId)
  if (!shelf) return false
  if (rowType === 'SHELF') {
    updater(shelf)
    warehouse.updatedAt = nowTimestamp()
    return true
  }
  const location = shelf.locationList.find((item) => item.locationId === ids.locationId)
  if (!location) return false
  updater(location)
  warehouse.updatedAt = nowTimestamp()
  return true
}

export function createFactoryWarehouseArea(warehouseId: string): FactoryWarehouseArea | null {
  const store = ensureFactoryInternalWarehouseStore()
  const warehouse = store.warehouses.find((item) => item.warehouseId === warehouseId)
  if (!warehouse) return null
  const nextIndex = warehouse.areaList.length + 1
  const areaName = `扩展区${nextIndex}`
  const area: FactoryWarehouseArea = {
    areaId: `AREA-${warehouseId}-${nextIndex}`,
    areaName,
    shelfList: [
      {
        shelfId: `SHELF-${warehouseId}-${nextIndex}-01`,
        shelfNo: `扩展-${nextIndex}-01`,
        shelfName: `扩展-${nextIndex}-01`,
        locationList: [
          {
            locationId: `LOC-${warehouseId}-${nextIndex}-01-01`,
            locationNo: `扩展-${nextIndex}-01-01`,
            locationName: `扩展-${nextIndex}-01-01`,
            status: 'AVAILABLE',
            remark: '',
          },
        ],
        status: 'AVAILABLE',
        remark: '',
      },
    ],
    status: 'AVAILABLE',
    remark: '',
  }
  warehouse.areaList.push(area)
  warehouse.updatedAt = nowTimestamp()
  return cloneValue(area)
}

export function createFactoryWarehouseShelf(warehouseId: string, areaId?: string): FactoryWarehouseShelf | null {
  const store = ensureFactoryInternalWarehouseStore()
  const warehouse = store.warehouses.find((item) => item.warehouseId === warehouseId)
  if (!warehouse) return null
  const area = warehouse.areaList.find((item) => item.areaId === areaId) || warehouse.areaList[0]
  if (!area) return null
  const nextIndex = area.shelfList.length + 1
  const prefix = area.areaName.replace('区', '')
  const shelf: FactoryWarehouseShelf = {
    shelfId: `SHELF-${area.areaId}-${nextIndex}`,
    shelfNo: `${prefix}-${String(nextIndex).padStart(2, '0')}`,
    shelfName: `${prefix}-${String(nextIndex).padStart(2, '0')}`,
    locationList: [
      {
        locationId: `LOC-${area.areaId}-${nextIndex}-01`,
        locationNo: `${prefix}-${String(nextIndex).padStart(2, '0')}-01`,
        locationName: `${prefix}-${String(nextIndex).padStart(2, '0')}-01`,
        status: 'AVAILABLE',
        remark: '',
      },
    ],
    status: 'AVAILABLE',
    remark: '',
  }
  area.shelfList.push(shelf)
  warehouse.updatedAt = nowTimestamp()
  return cloneValue(shelf)
}

export function createFactoryWarehouseLocation(warehouseId: string, areaId?: string, shelfId?: string): FactoryWarehouseLocation | null {
  const store = ensureFactoryInternalWarehouseStore()
  const warehouse = store.warehouses.find((item) => item.warehouseId === warehouseId)
  if (!warehouse) return null
  const area = warehouse.areaList.find((item) => item.areaId === areaId) || warehouse.areaList[0]
  if (!area) return null
  const shelf = area.shelfList.find((item) => item.shelfId === shelfId) || area.shelfList[0]
  if (!shelf) return null
  const nextIndex = shelf.locationList.length + 1
  const location: FactoryWarehouseLocation = {
    locationId: `LOC-${shelf.shelfId}-${nextIndex}`,
    locationNo: `${shelf.shelfNo}-${String(nextIndex).padStart(2, '0')}`,
    locationName: `${shelf.shelfNo}-${String(nextIndex).padStart(2, '0')}`,
    status: 'AVAILABLE',
    remark: '',
  }
  shelf.locationList.push(location)
  warehouse.updatedAt = nowTimestamp()
  return cloneValue(location)
}

export function updateFactoryWarehouseNodeRemark(
  rowType: FactoryWarehouseNodeRow['rowType'],
  ids: { warehouseId: string; areaId: string; shelfId?: string; locationId?: string },
  remark: string,
): boolean {
  return mutateWarehouseNode(rowType, ids, (target) => {
    target.remark = remark.trim()
  })
}

export function toggleFactoryWarehouseNodeStatus(
  rowType: FactoryWarehouseNodeRow['rowType'],
  ids: { warehouseId: string; areaId: string; shelfId?: string; locationId?: string },
): boolean {
  return mutateWarehouseNode(rowType, ids, (target) => {
    target.status = target.status === 'AVAILABLE' ? 'STOPPED' : 'AVAILABLE'
  })
}

export function updateWaitProcessStockLocation(
  stockItemId: string,
  input: { areaName: string; shelfNo: string; locationNo: string; remark?: string },
): boolean {
  const store = ensureFactoryInternalWarehouseStore()
  const item = store.waitProcessStockItems.find((stockItem) => stockItem.stockItemId === stockItemId)
  if (!item) return false
  item.areaName = input.areaName
  item.shelfNo = input.shelfNo
  item.locationNo = input.locationNo
  item.locationText = `${input.areaName} / ${input.shelfNo} / ${input.locationNo}`
  if (typeof input.remark === 'string') {
    item.remark = input.remark.trim()
  }
  store.inboundRecords
    .filter((record) => record.generatedStockItemId === stockItemId)
    .forEach((record) => {
      record.areaName = input.areaName
      record.shelfNo = input.shelfNo
      record.locationNo = input.locationNo
      if (typeof input.remark === 'string') {
        record.remark = input.remark.trim() || record.remark
      }
    })
  return true
}

export function updateWaitHandoverStockLocation(
  stockItemId: string,
  input: { areaName: string; shelfNo: string; locationNo: string; remark?: string },
): boolean {
  const store = ensureFactoryInternalWarehouseStore()
  const item = store.waitHandoverStockItems.find((stockItem) => stockItem.stockItemId === stockItemId)
  if (!item) return false
  item.areaName = input.areaName
  item.shelfNo = input.shelfNo
  item.locationNo = input.locationNo
  if (typeof input.remark === 'string') {
    item.remark = input.remark.trim()
  }
  store.outboundRecords
    .filter((record) => record.relatedWaitHandoverStockItemId === stockItemId)
    .forEach((record) => {
      record.remark = input.remark?.trim() || `${record.remark || ''}`.trim() || '由交出记录生成'
    })
  return true
}

export function createFactoryWarehouseStocktakeOrder(
  factoryId: string,
  warehouseId: string,
  createdBy = '仓库专员',
  options: {
    stocktakeMethod?: FactoryWarehouseStocktakeScope
    isBlindStocktake?: boolean
    ownerNames?: string[]
    plannedAt?: string
  } = {},
): FactoryWarehouseStocktakeOrder | null {
  const store = ensureFactoryInternalWarehouseStore()
  const warehouse = store.warehouses.find((item) => item.warehouseId === warehouseId && item.factoryId === factoryId)
  if (!warehouse) return null
  const orderId = `STO-${factoryId}-${String(store.stocktakeOrders.length + 1).padStart(3, '0')}`
  const sourceItems =
    warehouse.warehouseKind === 'WAIT_PROCESS'
      ? store.waitProcessStockItems.filter((item) => item.warehouseId === warehouseId)
      : store.waitHandoverStockItems.filter((item) => item.warehouseId === warehouseId)
  const lineList = sourceItems.map((item) =>
    'expectedQty' in item
      ? buildStocktakeLineFromWaitProcess(orderId, item)
      : buildStocktakeLineFromWaitHandover(orderId, item),
  )
  const now = nowTimestamp()
  const order: FactoryWarehouseStocktakeOrder = {
    stocktakeOrderId: orderId,
    stocktakeOrderNo: `PD-${factoryId.slice(-3)}-${String(store.stocktakeOrders.length + 1).padStart(3, '0')}`,
    factoryId,
    factoryName: warehouse.factoryName,
    warehouseId,
    warehouseName: warehouse.warehouseName,
    warehouseKind: warehouse.warehouseKind,
    stocktakeScope: options.stocktakeMethod || '全盘',
    stocktakeMethod: options.stocktakeMethod || '全盘',
    isBlindStocktake: Boolean(options.isBlindStocktake),
    ownerNames: options.ownerNames?.length ? options.ownerNames : [createdBy],
    plannedAt: options.plannedAt || now,
    status: '盘点中',
    createdBy,
    createdAt: now,
    startedAt: now,
    lineList: lineList.map((line) => ({
      ...line,
      countedQty: undefined,
      differenceQty: undefined,
      differenceReason: '',
      photoList: [],
      status: '未盘',
      reviewStatus: undefined,
      differenceReviewId: undefined,
      adjustmentOrderId: undefined,
      adjustedAt: undefined,
    })),
    remark: '全盘',
  }
  store.stocktakeOrders.unshift(order)
  return cloneValue(order)
}

export function updateFactoryWarehouseStocktakeLine(
  stocktakeOrderId: string,
  lineId: string,
  input: { countedQty?: number; differenceReason?: string },
): boolean {
  const store = ensureFactoryInternalWarehouseStore()
  const order = store.stocktakeOrders.find((item) => item.stocktakeOrderId === stocktakeOrderId)
  if (!order) return false
  const line = order.lineList.find((item) => item.lineId === lineId)
  if (!line) return false
  if (typeof input.countedQty === 'number') {
    line.countedQty = roundQty(input.countedQty)
  }
  if (typeof input.differenceReason === 'string') {
    line.differenceReason = input.differenceReason.trim()
  }
  const countedQty = roundQty(line.countedQty ?? 0)
  line.differenceQty = line.countedQty === undefined ? undefined : roundQty(countedQty - line.bookQty)
  if (line.countedQty === undefined) {
    line.status = '未盘'
    line.reviewStatus = undefined
    line.differenceReviewId = undefined
    line.adjustmentOrderId = undefined
    line.adjustedAt = undefined
  } else if (line.differenceQty !== 0) {
    line.status = '差异'
    line.reviewStatus = '待审核'
    line.adjustedAt = undefined
  } else {
    line.status = '已盘'
    line.reviewStatus = undefined
    line.differenceReviewId = undefined
    line.adjustmentOrderId = undefined
    line.adjustedAt = undefined
  }
  return true
}

export function completeFactoryWarehouseStocktakeOrder(stocktakeOrderId: string): boolean {
  const store = ensureFactoryInternalWarehouseStore()
  const order = store.stocktakeOrders.find((item) => item.stocktakeOrderId === stocktakeOrderId)
  if (!order) return false
  const differenceLines = order.lineList.filter((line) => (line.differenceQty ?? 0) !== 0)
  if (differenceLines.length > 0) {
    differenceLines.forEach((line) => {
      line.reviewStatus = line.reviewStatus || '待审核'
      ensureStocktakeDifferenceReviewForLine(store, order, line)
    })
    order.status = '待确认'
  } else {
    order.status = '已完成'
  }
  order.completedAt = nowTimestamp()
  return true
}

export function getFactoryWarehouseCurrentQtyByStockItemId(stockItemId: string): number {
  const store = ensureFactoryInternalWarehouseStore()
  const waitProcessItem = store.waitProcessStockItems.find((item) => item.stockItemId === stockItemId)
  if (waitProcessItem) return waitProcessItem.receivedQty
  const waitHandoverItem = store.waitHandoverStockItems.find((item) => item.stockItemId === stockItemId)
  if (waitHandoverItem) return waitHandoverItem.waitHandoverQty
  return 0
}

export function approveFactoryWarehouseStocktakeDifferenceReview(input: {
  reviewId: string
  reviewedBy: string
  reviewedAt?: string
  reviewRemark?: string
}): FactoryWarehouseAdjustmentOrder | null {
  const store = ensureFactoryInternalWarehouseStore()
  const review = store.stocktakeDifferenceReviews.find((item) => item.reviewId === input.reviewId)
  if (!review) return null
  const order = store.stocktakeOrders.find((item) => item.stocktakeOrderId === review.stocktakeOrderId)
  const line = order?.lineList.find((item) => item.lineId === review.lineId)
  if (!order || !line) return null
  const now = input.reviewedAt || nowTimestamp()
  review.reviewStatus = '审核通过'
  review.reviewedBy = input.reviewedBy
  review.reviewedAt = now
  review.reviewRemark = input.reviewRemark?.trim() || review.reviewRemark || '盘点差异审核通过'
  line.reviewStatus = '审核通过'
  line.differenceReviewId = review.reviewId
  const adjustmentOrderId = `ADJ-${review.reviewId.replace(/[^A-Za-z0-9]/g, '').slice(-12)}`
  let adjustment = store.adjustmentOrders.find((item) => item.adjustmentOrderId === adjustmentOrderId)
  if (!adjustment) {
    adjustment = {
      adjustmentOrderId,
      adjustmentOrderNo: `${review.countedQty - review.bookQty > 0 ? 'PY' : 'PK'}-${review.stocktakeOrderNo.replace(/[^A-Za-z0-9]/g, '').slice(-8)}-${String(store.adjustmentOrders.length + 1).padStart(3, '0')}`,
      adjustmentType: review.countedQty - review.bookQty > 0 ? '盘盈单' : '盘亏单',
      sourceStocktakeOrderId: review.stocktakeOrderId,
      sourceStocktakeOrderNo: review.stocktakeOrderNo,
      sourceLineId: review.lineId,
      reviewId: review.reviewId,
      warehouseId: review.warehouseId,
      warehouseName: review.warehouseName,
      factoryId: review.factoryId,
      factoryName: review.factoryName,
      warehouseKind: review.warehouseKind,
      stockItemId: review.stockItemId,
      itemKind: review.itemKind,
      itemName: review.itemName,
      materialSku: review.materialSku,
      partName: review.partName,
      fabricColor: review.fabricColor,
      sizeCode: review.sizeCode,
      feiTicketNo: review.feiTicketNo,
      transferBagNo: review.transferBagNo,
      fabricRollNo: review.fabricRollNo,
      bookQty: review.bookQty,
      countedQty: review.countedQty,
      adjustmentQty: roundQty(review.countedQty - review.bookQty),
      unit: review.unit,
      status: '待执行',
      createdAt: now,
      createdBy: input.reviewedBy,
      remark: review.reviewRemark,
    }
    store.adjustmentOrders.unshift(adjustment)
  }
  review.adjustmentOrderId = adjustment.adjustmentOrderId
  line.adjustmentOrderId = adjustment.adjustmentOrderId
  return cloneValue(adjustment)
}

export function rejectFactoryWarehouseStocktakeDifferenceReview(input: {
  reviewId: string
  reviewedBy: string
  reviewedAt?: string
  reviewRemark?: string
}): FactoryWarehouseStocktakeDifferenceReview | null {
  const store = ensureFactoryInternalWarehouseStore()
  const review = store.stocktakeDifferenceReviews.find((item) => item.reviewId === input.reviewId)
  if (!review) return null
  const order = store.stocktakeOrders.find((item) => item.stocktakeOrderId === review.stocktakeOrderId)
  const line = order?.lineList.find((item) => item.lineId === review.lineId)
  const now = input.reviewedAt || nowTimestamp()
  review.reviewStatus = '已驳回'
  review.reviewedBy = input.reviewedBy
  review.reviewedAt = now
  review.reviewRemark = input.reviewRemark?.trim() || '盘点差异已驳回'
  if (line) {
    line.reviewStatus = '已驳回'
  }
  if (order) {
    order.status = '待确认'
  }
  return cloneValue(review)
}

export function executeFactoryWarehouseAdjustmentOrder(input: {
  adjustmentOrderId: string
  executedBy: string
  executedAt?: string
  remark?: string
}): FactoryWarehouseAdjustmentOrder | null {
  const store = ensureFactoryInternalWarehouseStore()
  const adjustment = store.adjustmentOrders.find((item) => item.adjustmentOrderId === input.adjustmentOrderId)
  if (!adjustment || adjustment.status !== '待执行') return adjustment ? cloneValue(adjustment) : null
  const now = input.executedAt || nowTimestamp()
  if (adjustment.warehouseKind === 'WAIT_PROCESS') {
    const stockItem = store.waitProcessStockItems.find((item) => item.stockItemId === adjustment.stockItemId)
    if (stockItem) {
      stockItem.receivedQty = roundQty(adjustment.countedQty)
      stockItem.differenceQty = roundQty(stockItem.receivedQty - stockItem.expectedQty)
      stockItem.status = stockItem.differenceQty === 0 ? '已入待加工仓' : '差异待处理'
    }
  } else {
    const stockItem = store.waitHandoverStockItems.find((item) => item.stockItemId === adjustment.stockItemId)
    if (stockItem) {
      stockItem.waitHandoverQty = roundQty(adjustment.countedQty)
      stockItem.differenceQty = roundQty(stockItem.waitHandoverQty - stockItem.completedQty)
      stockItem.status = stockItem.differenceQty === 0 ? '待交出' : '差异'
    }
  }
  const warehouse = store.warehouses.find((item) => item.warehouseId === adjustment.warehouseId)
  const waitProcessItem = store.waitProcessStockItems.find((item) => item.stockItemId === adjustment.stockItemId)
  const waitHandoverItem = store.waitHandoverStockItems.find((item) => item.stockItemId === adjustment.stockItemId)
  const baseLocation = {
    areaName: waitProcessItem?.areaName || waitHandoverItem?.areaName || warehouse?.areaList[0]?.areaName || '待确认区',
    shelfNo: waitProcessItem?.shelfNo || waitHandoverItem?.shelfNo || warehouse?.areaList[0]?.shelfList[0]?.shelfNo || '待确认-01',
    locationNo:
      waitProcessItem?.locationNo
      || waitHandoverItem?.locationNo
      || warehouse?.areaList[0]?.shelfList[0]?.locationList[0]?.locationNo
      || '待确认-01-01',
  }
  const flowQty = roundQty(Math.abs(adjustment.adjustmentQty))
  if (flowQty > 0 && adjustment.adjustmentQty > 0) {
    const inboundRecordId = `INB-${adjustment.adjustmentOrderId}`
    if (!store.inboundRecords.some((record) => record.inboundRecordId === inboundRecordId)) {
      store.inboundRecords.unshift({
        inboundRecordId,
        inboundRecordNo: `RK-${adjustment.adjustmentOrderNo}`,
        warehouseId: adjustment.warehouseId,
        warehouseName: adjustment.warehouseName,
        factoryId: adjustment.factoryId,
        factoryName: adjustment.factoryName,
        factoryKind: warehouse?.factoryKind || waitProcessItem?.factoryKind || waitHandoverItem?.factoryKind || 'CENTRAL_CUTTING',
        processCode: waitProcessItem?.processCode || waitHandoverItem?.processCode,
        processName: waitProcessItem?.processName || waitHandoverItem?.processName,
        sourceRecordId: adjustment.adjustmentOrderId,
        sourceRecordNo: adjustment.adjustmentOrderNo,
        sourceRecordType: 'STOCKTAKE_ADJUSTMENT',
        sourceObjectName: '盘点调整',
        taskId: adjustment.sourceStocktakeOrderId,
        taskNo: adjustment.sourceStocktakeOrderNo,
        itemKind: adjustment.itemKind,
        itemName: adjustment.itemName,
        materialSku: adjustment.materialSku,
        partName: adjustment.partName,
        fabricColor: adjustment.fabricColor,
        sizeCode: adjustment.sizeCode,
        feiTicketNo: adjustment.feiTicketNo,
        transferBagNo: adjustment.transferBagNo,
        fabricRollNo: adjustment.fabricRollNo,
        expectedQty: flowQty,
        receivedQty: flowQty,
        differenceQty: 0,
        unit: adjustment.unit,
        receiverName: input.executedBy,
        receivedAt: now,
        areaName: baseLocation.areaName,
        shelfNo: baseLocation.shelfNo,
        locationNo: baseLocation.locationNo,
        status: '已入库',
        photoList: [],
        generatedStockItemId: adjustment.stockItemId,
        remark: '盘盈审核通过后生成库存调整入库流水',
      })
    }
  } else if (flowQty > 0 && adjustment.adjustmentQty < 0) {
    const outboundRecordId = `OUT-${adjustment.adjustmentOrderId}`
    if (!store.outboundRecords.some((record) => record.outboundRecordId === outboundRecordId)) {
      store.outboundRecords.unshift({
        outboundRecordId,
        outboundRecordNo: `CK-${adjustment.adjustmentOrderNo}`,
        warehouseId: adjustment.warehouseId,
        warehouseName: adjustment.warehouseName,
        factoryId: adjustment.factoryId,
        factoryName: adjustment.factoryName,
        factoryKind: warehouse?.factoryKind || waitProcessItem?.factoryKind || waitHandoverItem?.factoryKind || 'CENTRAL_CUTTING',
        processCode: waitProcessItem?.processCode || waitHandoverItem?.processCode,
        processName: waitProcessItem?.processName || waitHandoverItem?.processName,
        sourceTaskId: adjustment.sourceStocktakeOrderId,
        sourceTaskNo: adjustment.sourceStocktakeOrderNo,
        receiverKind: '其他接收方',
        receiverName: '盘点调整',
        itemKind: adjustment.itemKind,
        itemName: adjustment.itemName,
        materialSku: adjustment.materialSku,
        partName: adjustment.partName,
        fabricColor: adjustment.fabricColor,
        sizeCode: adjustment.sizeCode,
        feiTicketNo: adjustment.feiTicketNo,
        transferBagNo: adjustment.transferBagNo,
        fabricRollNo: adjustment.fabricRollNo,
        outboundQty: flowQty,
        receiverWrittenQty: flowQty,
        differenceQty: 0,
        unit: adjustment.unit,
        operatorName: input.executedBy,
        outboundAt: now,
        status: '已回写',
        photoList: [],
        relatedWaitHandoverStockItemId: adjustment.warehouseKind === 'WAIT_HANDOVER' ? adjustment.stockItemId : undefined,
        remark: '盘亏审核通过后生成库存调整出库流水',
      })
    }
  }
  adjustment.status = '已完成'
  adjustment.executedAt = now
  adjustment.executedBy = input.executedBy
  adjustment.remark = input.remark?.trim() || adjustment.remark
  const review = store.stocktakeDifferenceReviews.find((item) => item.reviewId === adjustment.reviewId)
  const order = store.stocktakeOrders.find((item) => item.stocktakeOrderId === adjustment.sourceStocktakeOrderId)
  const line = order?.lineList.find((item) => item.lineId === adjustment.sourceLineId)
  if (review) {
    review.reviewStatus = '已调整'
    review.adjustmentOrderId = adjustment.adjustmentOrderId
    review.reviewRemark = input.remark?.trim() || review.reviewRemark
  }
  if (line) {
    line.reviewStatus = '已调整'
    line.adjustmentOrderId = adjustment.adjustmentOrderId
    line.adjustedAt = now
  }
  if (order) {
    refreshStocktakeOrderStatusAfterAdjustment(order)
  }
  return cloneValue(adjustment)
}

export function approveAndExecuteFactoryWarehouseStocktakeDifferenceReview(input: {
  reviewId: string
  operatorName: string
  operatedAt?: string
  remark?: string
}): FactoryWarehouseAdjustmentOrder | null {
  const operatedAt = input.operatedAt || nowTimestamp()
  const adjustment = approveFactoryWarehouseStocktakeDifferenceReview({
    reviewId: input.reviewId,
    reviewedBy: input.operatorName,
    reviewedAt: operatedAt,
    reviewRemark: input.remark || 'PDA 确认盘点差异',
  })
  if (!adjustment) return null
  return executeFactoryWarehouseAdjustmentOrder({
    adjustmentOrderId: adjustment.adjustmentOrderId,
    executedBy: input.operatorName,
    executedAt: operatedAt,
    remark: input.remark || 'PDA 确认盘点差异并执行库存调整',
  })
}

export function getFactoryWarehousePositionStatusOptions(): Array<{ value: FactoryWarehouseLocationStatus; label: string }> {
  return [
    { value: 'AVAILABLE', label: '可用' },
    { value: 'STOPPED', label: '停用' },
  ]
}

export function getFactoryWarehouseSummary(input: {
  factoryId?: string
  processCode?: string
  warehouseKind?: '' | FactoryInternalWarehouseKind
  status?: string
  keyword?: string
  timeRange?: '7D' | '30D' | 'ALL'
}): {
  waitReceiveQty: number
  waitProcessQty: number
  waitHandoverQty: number
  handedOutQty: number
  differenceQty: number
  abnormalCount: number
  stocktakeDifferenceCount: number
  stocktakeWaitReviewCount: number
  stocktakeAdjustedCount: number
} {
  const store = ensureFactoryInternalWarehouseStore()
  const keyword = input.keyword?.trim().toLowerCase() || ''
  const now = Date.now()
  const rangeMs = input.timeRange === '7D' ? 7 * 24 * 3600 * 1000 : input.timeRange === '30D' ? 30 * 24 * 3600 * 1000 : Number.POSITIVE_INFINITY
  const withinRange = (value?: string): boolean => {
    if (!value || !Number.isFinite(rangeMs)) return true
    const time = new Date(value.replace(' ', 'T')).getTime()
    if (!Number.isFinite(time)) return true
    return now - time <= rangeMs
  }

  const byFactory = <T extends { factoryId: string; processCode?: string; warehouseId?: string; warehouseName?: string }>(item: T): boolean => {
    if (input.factoryId && item.factoryId !== input.factoryId) return false
    if (input.processCode && item.processCode !== input.processCode) return false
    if (input.warehouseKind) {
      const warehouse = store.warehouses.find((entry) => entry.warehouseId === item.warehouseId || entry.warehouseName === item.warehouseName)
      if (!warehouse || warehouse.warehouseKind !== input.warehouseKind) return false
    }
    return true
  }

  const matchesKeyword = (tokens: Array<string | undefined>): boolean => {
    if (!keyword) return true
    return tokens.some((token) => token?.toLowerCase().includes(keyword))
  }

  const waitReceiveQty = store.inboundRecords
    .filter((record) => byFactory(record))
    .filter((record) => withinRange(record.receivedAt))
    .filter((record) => matchesKeyword([record.inboundRecordNo, record.sourceRecordNo, record.materialSku, record.feiTicketNo, record.fabricRollNo]))
    .filter((record) => (input.status ? record.status === input.status : record.status === '待确认'))
    .reduce((sum, record) => sum + record.expectedQty, 0)

  const waitProcessQty = store.waitProcessStockItems
    .filter((item) => byFactory(item))
    .filter((item) => withinRange(item.receivedAt))
    .filter((item) => matchesKeyword([item.sourceRecordNo, item.taskNo, item.feiTicketNo, item.transferBagNo, item.fabricRollNo]))
    .filter((item) => (input.status ? item.status === input.status : item.status === '已入待加工仓'))
    .reduce((sum, item) => sum + item.receivedQty, 0)

  const waitHandoverQty = store.waitHandoverStockItems
    .filter((item) => byFactory(item))
    .filter((item) => matchesKeyword([item.taskNo, item.handoverOrderNo, item.handoverRecordNo, item.feiTicketNo, item.transferBagNo, item.fabricRollNo]))
    .filter((item) => (input.status ? item.status === input.status : item.status === '待交出'))
    .reduce((sum, item) => sum + item.waitHandoverQty, 0)

  const handedOutQty = store.outboundRecords
    .filter((item) => byFactory(item))
    .filter((item) => withinRange(item.outboundAt))
    .filter((item) => matchesKeyword([item.handoverOrderNo, item.handoverRecordNo, item.feiTicketNo, item.transferBagNo, item.fabricRollNo]))
    .filter((item) => (input.status ? item.status === input.status : item.status !== '已作废'))
    .reduce((sum, item) => sum + item.outboundQty, 0)

  const differenceQty =
    store.inboundRecords
      .filter((item) => byFactory(item))
      .reduce((sum, item) => sum + Math.abs(item.differenceQty), 0)
    + store.outboundRecords
      .filter((item) => byFactory(item))
      .reduce((sum, item) => sum + Math.abs(item.differenceQty || 0), 0)

  const abnormalCount =
    store.waitProcessStockItems.filter((item) => byFactory(item) && item.status === '差异待处理').length
    + store.waitHandoverStockItems.filter((item) => byFactory(item) && (item.status === '差异' || item.status === '异议中')).length

  const stocktakeDifferenceCount = store.stocktakeOrders
    .filter((order) => (!input.factoryId || order.factoryId === input.factoryId))
    .reduce((sum, order) => sum + order.lineList.filter((line) => (line.differenceQty ?? 0) !== 0).length, 0)
  const stocktakeWaitReviewCount = store.stocktakeDifferenceReviews
    .filter((review) => (!input.factoryId || review.factoryId === input.factoryId))
    .filter((review) => review.reviewStatus === '待审核' || review.reviewStatus === '审核通过' || review.reviewStatus === '已驳回')
    .length
  const stocktakeAdjustedCount = store.stocktakeDifferenceReviews
    .filter((review) => (!input.factoryId || review.factoryId === input.factoryId))
    .filter((review) => review.reviewStatus === '已调整')
    .length

  return {
    waitReceiveQty: roundQty(waitReceiveQty),
    waitProcessQty: roundQty(waitProcessQty),
    waitHandoverQty: roundQty(waitHandoverQty),
    handedOutQty: roundQty(handedOutQty),
    differenceQty: roundQty(differenceQty),
    abnormalCount,
    stocktakeDifferenceCount,
    stocktakeWaitReviewCount,
    stocktakeAdjustedCount,
  }
}

export function getFactoryWarehouseFilterStatusOptions(): Array<{ value: string; label: string }> {
  return [
    { value: 'ALL', label: '全部' },
    { value: '待领料', label: '待领料' },
    { value: '已入待加工仓', label: '已入待加工仓' },
    { value: '差异待处理', label: '差异待处理' },
    { value: '待交出', label: '待交出' },
    { value: '已交出', label: '已交出' },
    { value: '已回写', label: '已回写' },
    { value: '差异', label: '差异' },
    { value: '异议中', label: '异议中' },
  ]
}

export function getFactoryWarehouseTimeRangeOptions(): Array<{ value: '7D' | '30D' | 'ALL'; label: string }> {
  return [
    { value: '7D', label: '最近 7 天' },
    { value: '30D', label: '最近 30 天' },
    { value: 'ALL', label: '全部' },
  ]
}

export function getFactoryWarehouseKindOptions(): Array<{ value: '' | FactoryInternalWarehouseKind; label: string }> {
  return [
    { value: '', label: '全部' },
    { value: 'WAIT_PROCESS', label: '待加工仓' },
    { value: 'WAIT_HANDOVER', label: '待交出仓' },
  ]
}

export function getFactoryWarehouseProcessOptions(factoryId?: string): Array<{ value: string; label: string }> {
  const factories = listFactoryInternalWarehouseFactoryOptions()
  const selectedFactory = factoryId ? factories.find((factory) => factory.id === factoryId) : undefined
  const abilitySource = selectedFactory ? selectedFactory.processAbilities : factories.flatMap((factory) => factory.processAbilities)
  const entries = abilitySource
    .map((ability) => ({
      value: ability.processCode,
      label: ability.processName || getProcessDefinitionByCode(ability.processCode)?.processName || ability.processCode,
    }))
    .filter((item, index, list) => list.findIndex((entry) => entry.value === item.value) === index)
  return entries
}

export function getFactoryWarehouseKindLabel(warehouseKind: FactoryInternalWarehouseKind): string {
  return getWarehouseKindLabel(warehouseKind)
}

export function getFactoryWarehousePositionLabel(status: FactoryWarehouseLocationStatus): string {
  return getWarehouseLocationStatusLabel(status)
}

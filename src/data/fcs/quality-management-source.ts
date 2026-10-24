import { productionOrders } from './production-orders.ts'
import { resolveQualityStyleContext } from './quality-management-style-context.ts'
import { getStyleArchiveById, listStyleArchives } from '../pcs-style-archive-repository.ts'
import { getMaterialArchiveByCode, getMaterialArchiveById, getMaterialSkuRecordById, listAllMaterialSkuRecords } from '../pcs-material-archive-repository.ts'
import { getSewingExecutionHistoryForTask } from './sewing-execution-history.ts'
import type { InitialFullInspectionConditions, InspectionSnapshot } from './quality-management-types.ts'

export interface ProductionInspectionSourceInput { productionOrderId?: string; productionOrderNo?: string; taskId: string; factoryId: string }
export interface ProductionInspectionSource {
  productionOrderId: string
  productionOrderNo: string
  taskId: string
  factoryId: string
  styleId: string
  styleCode: string
  styleCategory?: string
  styleCategoryAliases?: string[]
  productPosition?: string
  productPositionIds: string[]
  techPackVersionId?: string
  difficulty?: string
  difficultyPresent: boolean
  fabrics: Array<{ bomItemId: string; materialSkuId?: string; originalCode?: string; materialId?: string; spu?: string; status: 'RESOLVED' | 'UNRESOLVED'; path?: string }>
  sizeMeasurements: Array<{ sizeCode: string; measurementPart: string; measurementValue: number | string; measurementUnit: string; tolerance?: number | string }>
  executionOrdinal: number
  executionStatus: 'RECORDED' | 'NO_HISTORY'
  executionFactId?: string
  unresolved: string[]
}
export interface InitialFullInspectionReason {
  code: 'BASIC_STYLE' | 'HIGH_DIFFICULTY' | 'OUTSIDE_FABRIC_WHITELIST' | 'FIRST_FACTORY_TASKS'
  label: string
  scope: 'PRODUCTION_ORDER' | 'FACTORY_PRODUCTION_ORDER'
  productionOrderId: string
  productionOrderNo: string
  styleId: string
  styleCode: string
  factoryId?: string
  techPackVersionId?: string
  taskId?: string
  executionOrdinal?: number
  executionFactId?: string
  fabricSpus?: string[]
}
/** Reads the order-bound original snapshot, never the latest style tech pack or an execution substitute. */
export function resolveProductionInspectionSource(input: ProductionInspectionSourceInput): ProductionInspectionSource {
  const order = productionOrders.find(row => input.productionOrderId ? row.productionOrderId === input.productionOrderId : row.productionOrderNo === input.productionOrderNo)
  if (!order) throw new Error('生产回货没有找到明确关联的生产单，不能推测全检来源。')
  const snapshot = order.techPackSnapshot
  const validSnapshot = !!snapshot && (!order.selectedTechPackVersionId || snapshot.sourceTechPackVersionId === order.selectedTechPackVersionId)
  const unresolved: string[] = []
  if (!snapshot || (order.selectedTechPackVersionId && snapshot.sourceTechPackVersionId !== order.selectedTechPackVersionId)) unresolved.push('生产单绑定正式技术包缺失或版本关联不一致')
  const styleId = validSnapshot ? snapshot!.styleId : '', styleCode = validSnapshot ? snapshot!.styleCode : order.demandSnapshot.spuCode
  const exact = styleId ? getStyleArchiveById(styleId) : null
  const codeMatches = exact ? [] : listStyleArchives().filter(row => row.styleCode === styleCode)
  const style = exact || (codeMatches.length === 1 ? codeMatches[0] : null)
  if (!style) unresolved.push('正式商品身份缺失或款号不唯一')
  const productPosition = style?.productPosition
  const productPositionIds = style?.productConfigRefs?.productPositioning ?? []
  if (!productPosition) unresolved.push('正式商品定位未登记')
  const difficultyPresent = validSnapshot && !!snapshot && (snapshot.garmentDifficultyGradeSourcePresent ?? Object.hasOwn(snapshot, 'garmentDifficultyGrade')) && !!snapshot.garmentDifficultyGrade
  if (!difficultyPresent) unresolved.push('正式技术包做货难度未登记')
  const fabrics: ProductionInspectionSource['fabrics'] = (snapshot?.bomItems ?? []).filter(row => row.type === '面料').map(row => {
    const byId = row.materialSkuId ? getMaterialSkuRecordById(row.materialSkuId) : null
    const code = row.materialCode?.replace(/^pcs-material-sku:/, '').trim()
    const exactSkus = !row.materialSkuId && code ? listAllMaterialSkuRecords().filter(sku => [sku.materialSkuId, sku.materialSkuCode, sku.barcode, ...(sku.barcodeAliases || [])].includes(code)) : []
    const sku = byId || (exactSkus.length === 1 ? exactSkus[0] : null)
    const root = sku ? getMaterialArchiveById(sku.materialId) : (!row.materialSkuId && !exactSkus.length && row.materialCode ? getMaterialArchiveByCode(row.materialCode) : null)
    const valid = validSnapshot && exactSkus.length <= 1 && !!root && root.kind === 'fabric'
    if (!valid) unresolved.push(`面料BOM行${row.id}未能精确解析根SPU（${row.materialSkuId || row.materialCode || '无编号'}）`)
    return { bomItemId: row.id, materialSkuId: row.materialSkuId, originalCode: row.materialCode, materialId: valid ? root.materialId : undefined, spu: valid ? root.materialCode : undefined, status: valid ? 'RESOLVED' : 'UNRESOLVED', path: valid ? sku ? `${byId ? 'materialSkuId' : 'exactSkuCode'}→materialId→root.materialCode` : 'exactRootCode→root.materialCode' : undefined }
  })
  const execution = getSewingExecutionHistoryForTask({ factoryId: input.factoryId, taskId: input.taskId, productionOrderId: order.productionOrderId, styleCode })
  const sizeMeasurements = (snapshot?.sizeMeasurements ?? []).filter(row => row && row.sizeCode && row.measurementPart && row.measurementValue !== undefined && row.measurementUnit).map(row => ({ sizeCode: row.sizeCode, measurementPart: row.measurementPart, measurementValue: row.measurementValue, measurementUnit: row.measurementUnit, ...(row.tolerance !== undefined ? { tolerance: row.tolerance } : {}) }))
  return { productionOrderId: order.productionOrderId, productionOrderNo: order.productionOrderNo, factoryId: input.factoryId, taskId: input.taskId, styleId, styleCode, ...resolveQualityStyleContext({styleId,styleCode}), productPosition, productPositionIds: [...productPositionIds], techPackVersionId: snapshot?.sourceTechPackVersionId, difficulty: difficultyPresent ? snapshot?.garmentDifficultyGrade : undefined, difficultyPresent, fabrics, sizeMeasurements, executionOrdinal: execution.ordinal, executionStatus: execution.status, executionFactId: execution.status === 'RECORDED' ? execution.fact.id : undefined, unresolved }
}
/** Resolve typed measurement items against the order-bound technical pack snapshot. */
export function bindInspectionMeasurements(snapshot: InspectionSnapshot, source?: Pick<ProductionInspectionSource, 'sizeMeasurements' | 'techPackVersionId'>): InspectionSnapshot {
  const bind = (value: InspectionSnapshot): InspectionSnapshot => {
    for (const item of value.items) {
      if (item.kind !== 'MEASUREMENT') continue
      const part = item.measurement?.techPackPart?.trim() || item.name
      const rows = (source?.sizeMeasurements || []).filter(row => row.measurementPart === part)
      if (rows.length) {
        item.measurement = { ...item.measurement, techPackPart: part, unit: item.measurement?.unit || rows[0].measurementUnit, tolerance: item.measurement?.tolerance ?? rows[0].tolerance, nominalBySize: Object.fromEntries(rows.map(row => [row.sizeCode, row.measurementValue])), source: 'TECH_PACK' }
      } else if (item.measurement?.nominalBySize && Object.keys(item.measurement.nominalBySize).length) {
        item.measurement = { ...item.measurement, source: 'STANDARD' }
      } else {
        item.measurement = { ...item.measurement, source: 'NONE' }
      }
    }
    value.snapshotSchemaVersion = 2
    if (source?.techPackVersionId) value.techPackVersionId = source.techPackVersionId
    return value
  }
  bind(snapshot)
  for (const row of snapshot.skuSnapshots || []) bind(row.snapshot)
  return snapshot
}
export function evaluateInitialFullInspection(source: ProductionInspectionSource, conditions: InitialFullInspectionConditions | null): { fullInspection: boolean; reasons: InitialFullInspectionReason[]; unresolved: string[]; source: ProductionInspectionSource } {
  const reasons: InitialFullInspectionReason[] = []
  const shared = { productionOrderId: source.productionOrderId, productionOrderNo: source.productionOrderNo, styleId: source.styleId, styleCode: source.styleCode, techPackVersionId: source.techPackVersionId }
  const basicPosition=[source.productPosition,...(source.styleCategoryAliases || [])].find(value=>['基础款','冷启动基础款'].includes(value || ''))
  if (conditions?.basicStyle && basicPosition) reasons.push({ ...shared, code: 'BASIC_STYLE', label: `正式定位：${basicPosition}`, scope: 'PRODUCTION_ORDER' })
  if (conditions?.highDifficulty && source.difficultyPresent && ['A','A+','A++'].includes(source.difficulty || '')) reasons.push({ ...shared, code: 'HIGH_DIFFICULTY', label: `正式做货难度：${source.difficulty}`, scope: 'PRODUCTION_ORDER' })
  const outside = source.fabrics.filter(row => row.status === 'RESOLVED' && row.spu && !conditions?.fabricSpuWhitelist.includes(row.spu)).map(row => row.spu!)
  if (conditions?.outsideFabricWhitelist && outside.length) reasons.push({ ...shared, code: 'OUTSIDE_FABRIC_WHITELIST', label: `正式BOM面料SPU不在范围：${outside.join('、')}`, scope: 'PRODUCTION_ORDER', fabricSpus: [...new Set(outside)] })
  if (conditions?.firstFactoryTasks && source.executionOrdinal <= conditions.firstTaskCount) reasons.push({ ...shared, code: 'FIRST_FACTORY_TASKS', label: source.executionStatus === 'NO_HISTORY' ? '没有真实历史，本次按第一次车缝任务全检' : `该厂真正执行的第${source.executionOrdinal}个车缝任务`, scope: 'FACTORY_PRODUCTION_ORDER', factoryId: source.factoryId, taskId: source.taskId, executionOrdinal: source.executionOrdinal, executionFactId: source.executionFactId })
  const enabled = !!conditions && (conditions.basicStyle || conditions.highDifficulty || conditions.outsideFabricWhitelist || conditions.firstFactoryTasks)
  const unresolved = source.unresolved.filter(message => {
    if (!enabled) return false
    if (message.includes('商品定位')) return !!conditions?.basicStyle
    if (message.includes('做货难度')) return !!conditions?.highDifficulty
    if (message.includes('面料BOM')) return !!conditions?.outsideFabricWhitelist
    if (message.includes('技术包')) return !!conditions && (conditions.highDifficulty || conditions.outsideFabricWhitelist)
    return true
  })
  return { fullInspection: reasons.length > 0, reasons, unresolved, source: structuredClone(source) }
}
export function evaluateProductionInitialFullInspection(input: ProductionInspectionSourceInput & { conditions: InitialFullInspectionConditions | null }): ReturnType<typeof evaluateInitialFullInspection> { return evaluateInitialFullInspection(resolveProductionInspectionSource(input), input.conditions) }

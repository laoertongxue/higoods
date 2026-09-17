import { productionDemands, type ProductionDemand } from './production-demands.ts'
import {
  cancelProductionDemandDyeWorkOrder,
  linkProductionDemandDyeReplacement,
  listDyeWorkOrders,
  runDyeProcessMutation,
  prepareProductionDemandDyeMatch,
  type DyeWorkOrder,
} from './dyeing-task-domain.ts'
import {
  cancelProductionDemandPrintWorkOrder,
  linkProductionDemandPrintReplacement,
  listPrintWorkOrders,
  runPrintProcessMutation,
  prepareProductionDemandPrintMatch,
  type PrintWorkOrder,
} from './printing-task-domain.ts'
import {
  ensureProcessWorkOrders,
  type ProcessWorkOrderGenerationInput,
} from './process-work-order-generation-service.ts'
import type {
  FormalProductionOrderProcessSnapshot,
  ProcessWorkOrderSourceSnapshot,
  ProductionDemandProcessMatchDecision,
  ProductionDemandProcessMatchStatus,
} from './process-work-order-domain.ts'

export type EarlyProcessCode = 'DYE' | 'PRINT'

export interface EarlyProcessCreateCandidate {
  demand: ProductionDemand
  processCode: EarlyProcessCode
  professionalTaskId: string
  professionalTaskNo: string
  professionalResultId: string
  professionalResultVersion: string
  professionalResultApprovedAt: string
  professionalResultApprovedBy: string
  professionalResultAttachments: NonNullable<ProcessWorkOrderSourceSnapshot['professionalResultAttachments']>
  defaultInputSku: string
  defaultOutputSku: string
  defaultMaterialName: string
  defaultMaterialImageUrl: string
  defaultTargetColor: string
  defaultUnitConsumption: number
  defaultLossRate: number
  defaultQtyUnit: string
  requiresWaterSoluble: boolean
  eligible: boolean
  ineligibleReason?: string
}

export interface CreateProductionDemandEarlyProcessInput {
  processCode: EarlyProcessCode
  productionDemandId: string
  professionalTaskId: string
  inputMaterialSkuCode: string
  outputMaterialSkuCode: string
  materialName: string
  materialImageUrl: string
  targetColor: string
  estimatedUnitConsumption: number
  estimatedLossRate: number
  qtyUnit: string
  requiresWaterSoluble?: boolean
  plannedFinishAt?: string
  factoryId: string
  factoryName: string
  operatorName: string
  operatorRole: string
  generationRevision?: number
  replacesWorkOrderId?: string
}

export interface EarlyProcessCreatedResult {
  processCode: EarlyProcessCode
  workOrderId: string
  workOrderNo: string
  plannedQty: number
  qtyUnit: string
}

export interface EarlyProcessAcceptanceRow {
  scenarioId: string
  scenarioName: string
  processCode: EarlyProcessCode
  productionDemandId: string
  matchStatus: ProductionDemandProcessMatchStatus
  inputSku: string
  outputSku: string
  unitConsumption: number
  lossRate: number
  requiresWaterSoluble?: boolean
  generationRevision?: number
  productionOrderId?: string
  productionOrderNo?: string
  techPackVersionId?: string
  techPackVersionLabel?: string
  matchFailureReason?: string
  replacesScenarioId?: string
}

const ARTWORK_ATTACHMENTS = [
  { fileId: 'ART-IMG-001', fileName: '正面花型图.png', mimeType: 'image/png', sizeBytes: 186420, dataUrl: '/materials/fei-ticket/blue-white-print-cotton.png' },
  { fileId: 'ART-IMG-002', fileName: '背面花型图.png', mimeType: 'image/png', sizeBytes: 172330, dataUrl: '/materials/process-orders/rose-cotton-jersey.png' },
  { fileId: 'ART-FILE-001', fileName: '花型源文件-A.ai', mimeType: 'application/postscript', sizeBytes: 942180, dataUrl: '/materials/fei-ticket/blue-white-print-cotton.png' },
  { fileId: 'ART-FILE-002', fileName: '花型分色说明.pdf', mimeType: 'application/pdf', sizeBytes: 426780, dataUrl: '/materials/process-orders/rose-cotton-jersey.png' },
]

export const EARLY_PROCESS_ACCEPTANCE_ROWS: EarlyProcessAcceptanceRow[] = [
  { scenarioId: 'DYE-01', scenarioName: '染色正常匹配', processCode: 'DYE', productionDemandId: 'DEM-202603-0001', matchStatus: 'MATCHED', inputSku: 'FAB-GREIGE-001', outputSku: 'FAB-DYED-NAVY-001', unitConsumption: 1.45, lossRate: 0.06, productionOrderId: 'PO-EARLY-MERGED-001', productionOrderNo: 'PO-EARLY-MERGED-001', techPackVersionId: 'TP-EARLY-001', techPackVersionLabel: 'V1.0' },
  { scenarioId: 'DYE-02', scenarioName: '生产单已生成等待技术包', processCode: 'DYE', productionDemandId: 'DEM-202603-0002', matchStatus: 'WAIT_TECH_PACK', inputSku: 'FAB-GREIGE-002', outputSku: 'FAB-DYED-RED-002', unitConsumption: 1.28, lossRate: 0.05, productionOrderId: 'PO-EARLY-MERGED-001', productionOrderNo: 'PO-EARLY-MERGED-001' },
  { scenarioId: 'DYE-03', scenarioName: 'BOM 与 SKU 匹配异常', processCode: 'DYE', productionDemandId: 'DEM-202603-0003', matchStatus: 'MATCH_FAILED', inputSku: 'FAB-GREIGE-003', outputSku: 'FAB-DYED-BLACK-003', unitConsumption: 1.62, lossRate: 0.08, productionOrderId: 'PO-EARLY-003', productionOrderNo: 'PO-EARLY-003', techPackVersionId: 'TP-EARLY-003', techPackVersionLabel: 'V1.0', matchFailureReason: '正式 BOM 未包含投入 SKU FAB-GREIGE-003，且正式产出 SKU 与提前单不一致。' },
  { scenarioId: 'DYE-04', scenarioName: '水溶与染色同道', processCode: 'DYE', productionDemandId: 'DEM-202603-0004', matchStatus: 'WAIT_PRODUCTION_ORDER', inputSku: 'LACE-WHITE-004', outputSku: 'LACE-DYED-BLUE-004', unitConsumption: 2.1, lossRate: 0.09, requiresWaterSoluble: true },
  { scenarioId: 'DYE-05', scenarioName: '未完成单已取消', processCode: 'DYE', productionDemandId: 'DEM-202603-0005', matchStatus: 'CANCELLED', inputSku: 'FAB-GREIGE-005', outputSku: 'FAB-DYED-GREY-005', unitConsumption: 1.8, lossRate: 0.07, generationRevision: 1 },
  { scenarioId: 'DYE-06', scenarioName: '取消后重建替代单', processCode: 'DYE', productionDemandId: 'DEM-202603-0005', matchStatus: 'WAIT_PRODUCTION_ORDER', inputSku: 'FAB-GREIGE-005', outputSku: 'FAB-DYED-GREY-005-R2', unitConsumption: 1.8, lossRate: 0.07, generationRevision: 2, replacesScenarioId: 'DYE-05' },
  { scenarioId: 'DYE-07', scenarioName: '合并生产单匹配第二张染色单', processCode: 'DYE', productionDemandId: 'DEM-202603-0092', matchStatus: 'MATCHED', inputSku: 'FAB-GREIGE-092', outputSku: 'FAB-DYED-BLACK-092', unitConsumption: 1.36, lossRate: 0.04, productionOrderId: 'PO-EARLY-MERGED-001', productionOrderNo: 'PO-EARLY-MERGED-001', techPackVersionId: 'TP-EARLY-001', techPackVersionLabel: 'V1.0' },
  { scenarioId: 'PRINT-01', scenarioName: '多图多文件印花正常匹配', processCode: 'PRINT', productionDemandId: 'DEM-202603-0012', matchStatus: 'MATCHED', inputSku: 'FAB-DYED-WHITE-012', outputSku: 'FAB-PRINT-FLORAL-012', unitConsumption: 1.34, lossRate: 0.05, productionOrderId: 'PO-EARLY-012', productionOrderNo: 'PO-EARLY-012', techPackVersionId: 'TP-EARLY-012', techPackVersionLabel: 'V2.0' },
  { scenarioId: 'PRINT-02', scenarioName: '染色后印花 SKU 连续', processCode: 'PRINT', productionDemandId: 'DEM-202603-0008', matchStatus: 'WAIT_PRODUCTION_ORDER', inputSku: 'FAB-DYED-BLUE-008', outputSku: 'FAB-PRINT-PLAID-008', unitConsumption: 1.48, lossRate: 0.06 },
  { scenarioId: 'PRINT-03', scenarioName: '印花等待技术包核验', processCode: 'PRINT', productionDemandId: 'DEM-202603-0009', matchStatus: 'WAIT_TECH_PACK', inputSku: 'FAB-DYED-WHITE-009', outputSku: 'FAB-PRINT-LOGO-009', unitConsumption: 1.2, lossRate: 0.03, productionOrderId: 'PO-EARLY-009', productionOrderNo: 'PO-EARLY-009' },
  { scenarioId: 'PRINT-04', scenarioName: '印花路线或 SKU 匹配异常', processCode: 'PRINT', productionDemandId: 'DEM-202603-0010', matchStatus: 'MATCH_FAILED', inputSku: 'FAB-DYED-BLACK-010', outputSku: 'FAB-PRINT-GRAPHIC-010', unitConsumption: 1.56, lossRate: 0.07, productionOrderId: 'PO-EARLY-010', productionOrderNo: 'PO-EARLY-010', techPackVersionId: 'TP-EARLY-010', techPackVersionLabel: 'V1.0', matchFailureReason: '正式工艺路线未找到对应印花节点。' },
  { scenarioId: 'PRINT-05', scenarioName: '未完成印花单已取消', processCode: 'PRINT', productionDemandId: 'DEM-202603-0011', matchStatus: 'CANCELLED', inputSku: 'YARN-DYED-CREAM-011', outputSku: 'YARN-PRINT-MELANGE-011', unitConsumption: 0.42, lossRate: 0.04, generationRevision: 1 },
  { scenarioId: 'PRINT-06', scenarioName: '取消后重建印花替代单', processCode: 'PRINT', productionDemandId: 'DEM-202603-0011', matchStatus: 'WAIT_PRODUCTION_ORDER', inputSku: 'YARN-DYED-CREAM-011', outputSku: 'YARN-PRINT-MELANGE-011-R2', unitConsumption: 0.42, lossRate: 0.04, generationRevision: 2, replacesScenarioId: 'PRINT-05' },
  { scenarioId: 'PRINT-07', scenarioName: '合并生产单匹配第一张印花单', processCode: 'PRINT', productionDemandId: 'DEM-202603-0091', matchStatus: 'MATCHED', inputSku: 'FAB-DYED-WHITE-091', outputSku: 'FAB-PRINT-SPRING-091', unitConsumption: 1.31, lossRate: 0.05, productionOrderId: 'PO-EARLY-MERGED-001', productionOrderNo: 'PO-EARLY-MERGED-001', techPackVersionId: 'TP-EARLY-001', techPackVersionLabel: 'V1.0' },
  { scenarioId: 'PRINT-08', scenarioName: '合并生产单匹配第二张印花单', processCode: 'PRINT', productionDemandId: 'DEM-202603-0001', matchStatus: 'MATCHED', inputSku: 'FAB-DYED-NAVY-001', outputSku: 'FAB-PRINT-GEOMETRIC-001', unitConsumption: 1.42, lossRate: 0.06, productionOrderId: 'PO-EARLY-MERGED-001', productionOrderNo: 'PO-EARLY-MERGED-001', techPackVersionId: 'TP-EARLY-001', techPackVersionLabel: 'V1.0' },
]

function demandById(demandId: string): ProductionDemand {
  const demand = productionDemands.find((item) => item.demandId === demandId)
  if (!demand) throw new Error(`生产需求单 ${demandId} 不存在`)
  return demand
}

export function calculateEarlyProcessPlannedQty(demandQty: number, unitConsumption: number, lossRate: number): number {
  if (![demandQty, unitConsumption, lossRate].every(Number.isFinite) || demandQty <= 0 || unitConsumption <= 0 || lossRate < 0) {
    throw new Error('需求数量、预估单耗必须大于 0，损耗率必须大于等于 0')
  }
  return Number((demandQty * unitConsumption * (1 + lossRate)).toFixed(2))
}

function candidateFor(demand: ProductionDemand, processCode: EarlyProcessCode, variant = 1): EarlyProcessCreateCandidate {
  const color = demand.skuLines[0]?.color || '按专业成果'
  const suffix = demand.demandId.replace(/\D/g, '').slice(-4)
  const isPrint = processCode === 'PRINT'
  const professionalResultApproved = demand.demandId !== 'DEM-202603-0006'
  const demandEligible = demand.demandStatus !== 'CANCELLED'
  const variantSuffix = variant > 1 ? `-${variant}` : ''
  const targetColor = variant > 1 ? `${color}（备选方案 ${variant}）` : color
  return {
    demand,
    processCode,
    professionalTaskId: `${processCode}-TASK-${suffix}${variantSuffix}`,
    professionalTaskNo: `${isPrint ? '花型' : '调色'}任务-${suffix}${variantSuffix}`,
    professionalResultId: `${processCode}-RESULT-${suffix}${variantSuffix}`,
    professionalResultVersion: variant > 1 ? `V${variant}.0` : 'V1.0',
    professionalResultApprovedAt: professionalResultApproved ? '2026-09-16 10:00:00' : '',
    professionalResultApprovedBy: professionalResultApproved ? '买手-王明' : '',
    professionalResultAttachments: isPrint ? structuredClone(ARTWORK_ATTACHMENTS).map(file => variant > 1 ? ({ ...file, fileId: `${file.fileId}-${variant}`, fileName: `备选${variant}-${file.fileName}` }) : file) : [
      { fileId: `COLOR-${suffix}-${variant}`, fileName: `${targetColor}调色结果.jpg`, mimeType: 'image/jpeg', sizeBytes: 148620, dataUrl: variant > 1 ? '/materials/process-orders/rose-cotton-jersey.png' : '/materials/process-orders/fog-blue-woven.png' },
    ],
    defaultInputSku: `${isPrint ? 'FAB-DYED' : 'FAB-GREIGE'}-${suffix}`,
    defaultOutputSku: `${isPrint ? 'FAB-PRINT' : 'FAB-DYED'}-${suffix}${variantSuffix}`,
    defaultMaterialName: isPrint ? '已染主面料' : '坯布主面料',
    defaultMaterialImageUrl: isPrint ? '/materials/fei-ticket/blue-white-print-cotton.png' : '/materials/process-orders/greige-cotton-polyester-woven.jpg',
    defaultTargetColor: targetColor,
    defaultUnitConsumption: 1.35,
    defaultLossRate: 0.05,
    defaultQtyUnit: '米',
    requiresWaterSoluble: false,
    eligible: demandEligible && professionalResultApproved,
    ineligibleReason: !demandEligible ? '生产需求单已取消' : !professionalResultApproved ? `${isPrint ? '花型' : '调色'}专业成果待买手审核通过` : undefined,
  }
}

function candidatesForDemand(demand: ProductionDemand, processCode: EarlyProcessCode): EarlyProcessCreateCandidate[] {
  const candidates = [candidateFor(demand, processCode)]
  const hasAlternative = (processCode === 'DYE' && demand.demandId === 'DEM-202603-0093')
    || (processCode === 'PRINT' && demand.demandId === 'DEM-202603-0094')
  if (hasAlternative) candidates.push(candidateFor(demand, processCode, 2))
  return candidates
}

export function listEarlyProcessCreateCandidates(processCode: EarlyProcessCode): EarlyProcessCreateCandidate[] {
  const preferredIds = processCode === 'DYE'
    ? ['DEM-202603-0093', 'DEM-202603-0094', 'DEM-202603-0006']
    : ['DEM-202603-0094', 'DEM-202603-0093', 'DEM-202603-0006']
  return preferredIds.flatMap((id) => candidatesForDemand(demandById(id), processCode))
}

function listEarlyOrders(processCode: EarlyProcessCode): Array<DyeWorkOrder | PrintWorkOrder> {
  return (processCode === 'DYE' ? listDyeWorkOrders() : listPrintWorkOrders())
    .filter((order) => order.sourceSnapshot?.sourceType === 'PRODUCTION_DEMAND')
}

function createSource(
  candidate: EarlyProcessCreateCandidate,
  input: CreateProductionDemandEarlyProcessInput,
  plannedQty: number,
  createdAt: string,
): ProcessWorkOrderSourceSnapshot {
  const revision = Math.max(1, input.generationRevision || 1)
  const source: ProcessWorkOrderSourceSnapshot = {
    sourceType: 'PRODUCTION_DEMAND',
    productionDemandId: candidate.demand.demandId,
    productionDemandNo: candidate.demand.demandId,
    demandQty: candidate.demand.requiredQtyTotal,
    demandQtyUnit: '件',
    estimatedUnitConsumption: input.estimatedUnitConsumption,
    estimatedLossRate: input.estimatedLossRate,
    estimatedProcessQty: plannedQty,
    matchStatus: 'WAIT_PRODUCTION_ORDER',
    generationRevision: revision,
    professionalTaskId: candidate.professionalTaskId,
    professionalTaskNo: candidate.professionalTaskNo,
    professionalResultId: candidate.professionalResultId,
    professionalResultVersion: candidate.professionalResultVersion,
    professionalResultApprovedAt: candidate.professionalResultApprovedAt,
    professionalResultApprovedBy: candidate.professionalResultApprovedBy,
    professionalResultAttachments: structuredClone(candidate.professionalResultAttachments),
    targetSpuCode: candidate.demand.spuCode,
    targetSpuName: candidate.demand.spuName,
    targetSpuImageUrl: candidate.demand.imageUrl,
    bomItemId: `BOM-${candidate.demand.demandId}-${input.processCode}`,
    bomItemIds: [`BOM-${candidate.demand.demandId}-${input.processCode}`],
    materialSkuCode: input.inputMaterialSkuCode,
    inputMaterialSkuCode: input.inputMaterialSkuCode,
    outputMaterialSkuCode: input.outputMaterialSkuCode,
    materialName: input.materialName,
    materialImageUrl: input.materialImageUrl,
    targetColorName: input.targetColor,
    replacesWorkOrderId: input.replacesWorkOrderId,
    operationFacts: [{
      operationId: `OP-${candidate.demand.demandId}-${input.processCode}-${createdAt}-CREATE`,
      action: input.replacesWorkOrderId ? 'REBUILD' : 'CREATE',
      operatedAt: createdAt,
      operatorName: input.operatorName,
      operatorRole: input.operatorRole,
      detail: `${input.operatorRole === '管理员' ? '管理员代操作；' : ''}基于审核通过的${input.processCode === 'DYE' ? '调色' : '花型'}成果创建大货提前加工单。`,
    }],
  }
  return source
}

export function createProductionDemandEarlyProcessWorkOrder(
  input: CreateProductionDemandEarlyProcessInput,
  createdAt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date()),
): EarlyProcessCreatedResult {
  const demand = demandById(input.productionDemandId)
  const candidate = candidatesForDemand(demand, input.processCode).find(item => item.professionalTaskId === input.professionalTaskId)
  if (!candidate) throw new Error(`请选择属于生产需求单 ${demand.demandId} 的${input.processCode === 'DYE' ? '调色' : '花型'}任务`)
  if (!candidate.eligible) throw new Error(candidate.ineligibleReason || '当前生产需求单不可创建提前加工单')
  if (!input.factoryId.trim() || !input.factoryName.trim()) throw new Error('创建提前加工单时必须明确加工厂')
  const inputSku = input.inputMaterialSkuCode.trim()
  const outputSku = input.outputMaterialSkuCode.trim()
  if (!inputSku || !outputSku) throw new Error('投入 SKU 和产出 SKU 必填')
  if (inputSku === outputSku) throw new Error('染色或印花必然变更 SKU，投入与产出 SKU 不能相同')
  if (input.replacesWorkOrderId) {
    const replaced = listEarlyOrders(input.processCode).find((order) => (
      (input.processCode === 'DYE' ? (order as DyeWorkOrder).dyeOrderId : (order as PrintWorkOrder).printOrderId) === input.replacesWorkOrderId
    ))
    if (!replaced || replaced.sourceSnapshot?.matchStatus !== 'CANCELLED') throw new Error('替代单必须关联同一类型的已取消提前加工单')
    if (replaced.sourceSnapshot.productionDemandId !== demand.demandId) throw new Error('替代单与原单必须属于同一生产需求单')
  }
  const activeDuplicate = listEarlyOrders(input.processCode).find((order) => {
    const source = order.sourceSnapshot
    return source?.productionDemandId === demand.demandId
      && source.professionalTaskId === candidate.professionalTaskId
      && source.matchStatus !== 'CANCELLED'
      && source.inputMaterialSkuCode === inputSku
  })
  if (activeDuplicate) throw new Error(`相同生产需求和专业成果已有有效加工单 ${input.processCode === 'DYE' ? (activeDuplicate as DyeWorkOrder).dyeOrderNo : (activeDuplicate as PrintWorkOrder).printOrderNo}`)
  const plannedQty = calculateEarlyProcessPlannedQty(demand.requiredQtyTotal, input.estimatedUnitConsumption, input.estimatedLossRate)
  const source = createSource(candidate, input, plannedQty, createdAt)
  const generation: ProcessWorkOrderGenerationInput = {
    source,
    processCodes: [input.processCode],
    orderedAt: createdAt,
    materialId: inputSku,
    materialName: input.materialName.trim(),
    materialItems: [{ sourceBomItemId: source.bomItemId!, materialId: inputSku, materialName: input.materialName.trim(), materialType: '面料' }],
    inputMaterialSkuId: inputSku,
    inputMaterialSkuCode: inputSku,
    inputMaterialName: input.materialName.trim(),
    inputMaterialImageUrl: input.materialImageUrl,
    outputMaterialSkuId: outputSku,
    outputMaterialSkuCode: outputSku,
    outputMaterialName: `${input.materialName.trim()}（加工后）`,
    outputMaterialImageUrl: input.processCode === 'PRINT' ? '/materials/fei-ticket/blue-white-print-cotton.png' : '/materials/process-orders/fog-blue-woven.png',
    targetColor: input.targetColor.trim() || '按专业成果执行',
    plannedQty,
    qtyUnit: input.qtyUnit.trim(),
    dyeProcessName: input.processCode === 'DYE' ? (input.requiresWaterSoluble ? '水溶＋染色' : '染色') : undefined,
    printProcessName: input.processCode === 'PRINT' ? '印花' : undefined,
    requiresWaterSoluble: input.processCode === 'DYE' && input.requiresWaterSoluble === true,
    factoryId: input.factoryId,
    factoryName: input.factoryName,
    spuCode: demand.spuCode,
    spuName: demand.spuName,
    requiredDeliveryDate: demand.requiredDeliveryDate || input.plannedFinishAt || createdAt.slice(0, 10),
    plannedFinishAt: input.plannedFinishAt,
    createdBy: input.operatorName,
    dyeSampleWaitType: 'NONE',
  }
  const mutate = input.processCode === 'DYE' ? runDyeProcessMutation : runPrintProcessMutation
  return mutate(() => {
    const result = ensureProcessWorkOrders(generation)
    const workOrder = input.processCode === 'DYE'
      ? listDyeWorkOrders().find((order) => order.dyeOrderId === result.dyeWorkOrderId)
      : listPrintWorkOrders().find((order) => order.printOrderId === result.printWorkOrderId)
    if (!workOrder) throw new Error('提前加工单创建后未能读取')
    const workOrderId = input.processCode === 'DYE' ? (workOrder as DyeWorkOrder).dyeOrderId : (workOrder as PrintWorkOrder).printOrderId
    if (input.replacesWorkOrderId) {
      if (input.processCode === 'DYE') linkProductionDemandDyeReplacement(input.replacesWorkOrderId, workOrderId, createdAt)
      else linkProductionDemandPrintReplacement(input.replacesWorkOrderId, workOrderId, createdAt)
    }
    return {
      processCode: input.processCode,
      workOrderId,
      workOrderNo: input.processCode === 'DYE' ? (workOrder as DyeWorkOrder).dyeOrderNo : (workOrder as PrintWorkOrder).printOrderNo,
      plannedQty,
      qtyUnit: input.qtyUnit,
    }
  })
}

function applyAcceptanceState(row: EarlyProcessAcceptanceRow, result: EarlyProcessCreatedResult, replacementByScenario: Map<string, string>): void {
  const decision: ProductionDemandProcessMatchDecision = {
    matchStatus: row.matchStatus,
    checkedAt: `2026-09-16 ${row.processCode === 'DYE' ? '14' : '15'}:${row.scenarioId.slice(-2)}:00`,
    operatorName: row.matchStatus === 'MATCHED' ? '系统自动匹配' : '计划员-验收',
    operatorRole: row.matchStatus === 'MATCHED' ? '系统' : '计划员',
    failureReason: row.matchFailureReason,
    productionOrderId: row.productionOrderId,
    productionOrderNo: row.productionOrderNo,
    techPackVersionId: row.techPackVersionId,
    techPackVersionLabel: row.techPackVersionLabel,
  }
  if (row.matchStatus === 'CANCELLED') {
    if (row.processCode === 'DYE') cancelProductionDemandDyeWorkOrder(result.workOrderId, { operatorName: '管理员', operatorRole: '管理员', reason: '验收场景：原预估参数有误，取消后重建。', cancelledAt: decision.checkedAt })
    else cancelProductionDemandPrintWorkOrder(result.workOrderId, { operatorName: '管理员', operatorRole: '管理员', reason: '验收场景：原花型版本有误，取消后重建。', cancelledAt: decision.checkedAt })
  } else if (row.matchStatus !== 'WAIT_PRODUCTION_ORDER') {
    const prepared = row.processCode === 'DYE'
      ? prepareProductionDemandDyeMatch(result.workOrderId, decision)
      : prepareProductionDemandPrintMatch(result.workOrderId, decision)
    prepared.commit()
  }
  replacementByScenario.set(row.scenarioId, result.workOrderId)
}

let acceptanceDataEnsured = false

export function ensureProductionDemandEarlyProcessAcceptanceData(): void {
  if (acceptanceDataEnsured) return
  const replacementByScenario = new Map<string, string>()
  for (const row of EARLY_PROCESS_ACCEPTANCE_ROWS) {
    const demand = demandById(row.productionDemandId)
    const candidate = candidateFor(demand, row.processCode)
    const replacesWorkOrderId = row.replacesScenarioId ? replacementByScenario.get(row.replacesScenarioId) : undefined
    const existing = listEarlyOrders(row.processCode).find((order) => {
      const source = order.sourceSnapshot
      return source?.productionDemandId === row.productionDemandId
        && source.generationRevision === (row.generationRevision || 1)
        && source.inputMaterialSkuCode === row.inputSku
        && source.outputMaterialSkuCode === row.outputSku
    })
    if (existing) {
      replacementByScenario.set(row.scenarioId, row.processCode === 'DYE' ? (existing as DyeWorkOrder).dyeOrderId : (existing as PrintWorkOrder).printOrderId)
      continue
    }
    const result = createProductionDemandEarlyProcessWorkOrder({
      processCode: row.processCode,
      productionDemandId: row.productionDemandId,
      professionalTaskId: candidate.professionalTaskId,
      inputMaterialSkuCode: row.inputSku,
      outputMaterialSkuCode: row.outputSku,
      materialName: candidate.defaultMaterialName,
      materialImageUrl: candidate.defaultMaterialImageUrl,
      targetColor: candidate.defaultTargetColor,
      estimatedUnitConsumption: row.unitConsumption,
      estimatedLossRate: row.lossRate,
      qtyUnit: candidate.defaultQtyUnit,
      requiresWaterSoluble: row.requiresWaterSoluble,
      plannedFinishAt: demand.requiredDeliveryDate || undefined,
      factoryId: row.processCode === 'DYE' ? 'F090' : 'FAC-FLOWER',
      factoryName: row.processCode === 'DYE' ? '全能力测试工厂（F090）' : 'FLOWER',
      operatorName: '管理员',
      operatorRole: '管理员',
      generationRevision: row.generationRevision,
      replacesWorkOrderId,
    }, `2026-09-16 ${row.processCode === 'DYE' ? '09' : '10'}:${row.scenarioId.slice(-2)}:00`)
    applyAcceptanceState(row, result, replacementByScenario)
  }
  acceptanceDataEnsured = true
}

export interface ProductionDemandEarlyMatchGroup {
  demands: Array<Pick<ProductionDemand, 'demandId' | 'requiredQtyTotal' | 'techPackStatus'>>
  productionOrderId: string
  productionOrderNo: string
}

export interface PreparedProductionDemandEarlyMatchBatch {
  remainingSnapshots: FormalProductionOrderProcessSnapshot[]
  matchedWorkOrderIds: string[]
  failedWorkOrderIds: string[]
  commit: () => void
  rollback: () => void
}

function sourceMatchesSnapshot(source: ProcessWorkOrderSourceSnapshot, snapshot: FormalProductionOrderProcessSnapshot): boolean {
  const formalBomIds = new Set((snapshot.materialItems || []).map((item) => item.sourceBomItemId))
  const sourceBomIds = source.bomItemIds || []
  const sourceUsesProvisionalBom = sourceBomIds.length > 0 && sourceBomIds.every((id) => id.startsWith('BOM-DEM-'))
  const bomMatches = sourceUsesProvisionalBom || sourceBomIds.some((id) => formalBomIds.has(id))
  const inputMatches = source.inputMaterialSkuCode === snapshot.inputMaterialSkuCode
  const outputMatches = source.outputMaterialSkuCode === snapshot.outputMaterialSkuCode
  return bomMatches && inputMatches && outputMatches
}

export function prepareProductionDemandEarlyMatches(
  group: ProductionDemandEarlyMatchGroup,
  snapshots: FormalProductionOrderProcessSnapshot[],
  checkedAt: string,
): PreparedProductionDemandEarlyMatchBatch {
  const demandIds = new Set(group.demands.map((demand) => demand.demandId))
  const operations: Array<{ commit: () => void; rollback: () => void }> = []
  const matchedWorkOrderIds: string[] = []
  const failedWorkOrderIds: string[] = []
  const processCoverage = new Map<FormalProductionOrderProcessSnapshot, Set<string>>()

  const stage = (processCode: EarlyProcessCode, order: DyeWorkOrder | PrintWorkOrder): void => {
    const source = order.sourceSnapshot!
    const processSnapshots = snapshots.filter((snapshot) => snapshot.processCodes.includes(processCode))
    const exactCandidates = processSnapshots.filter((snapshot) => sourceMatchesSnapshot(source, snapshot))
    const exact = exactCandidates.length === 1 ? exactCandidates[0] : undefined
    const identityCandidates = exactCandidates.length > 0
      ? exactCandidates
      : processSnapshots.filter((snapshot) => (
          snapshot.inputMaterialSkuCode === source.inputMaterialSkuCode
          || snapshot.outputMaterialSkuCode === source.outputMaterialSkuCode
        ))
    const claimedSnapshots = exact
      ? [exact]
      : identityCandidates.length > 0
        ? identityCandidates
        : processSnapshots.length === 1 ? processSnapshots : []
    const techPackMissing = group.demands.find((demand) => demand.demandId === source.productionDemandId)?.techPackStatus !== 'RELEASED'
    const decision: ProductionDemandProcessMatchDecision = exact ? {
      matchStatus: 'MATCHED', checkedAt, operatorName: '系统自动匹配', operatorRole: '系统',
      productionOrderId: group.productionOrderId, productionOrderNo: group.productionOrderNo,
      techPackVersionId: exact.techPackVersionId, techPackVersionLabel: exact.techPackVersionLabel, formalSnapshot: exact,
    } : techPackMissing ? {
      matchStatus: 'WAIT_TECH_PACK', checkedAt, operatorName: '系统自动匹配', operatorRole: '系统',
      productionOrderId: group.productionOrderId, productionOrderNo: group.productionOrderNo,
      failureReason: '生产单已生成，等待技术包 BOM 和工艺路线发布后自动重试。',
    } : {
      matchStatus: 'MATCH_FAILED', checkedAt, operatorName: '系统自动匹配', operatorRole: '系统',
      productionOrderId: group.productionOrderId, productionOrderNo: group.productionOrderNo,
      techPackVersionId: processSnapshots[0]?.techPackVersionId, techPackVersionLabel: processSnapshots[0]?.techPackVersionLabel,
      failureReason: exactCandidates.length > 1
        ? '正式技术包中存在多条相同投入/产出 SKU 的工艺路线，无法唯一匹配。'
        : processSnapshots.length === 0
          ? `已发布技术包没有${processCode === 'DYE' ? '染色' : '印花'}工艺路线。`
          : '正式 BOM、工艺路线或投入/产出 SKU 与提前加工单快照不一致。',
    }
    const workOrderId = processCode === 'DYE' ? (order as DyeWorkOrder).dyeOrderId : (order as PrintWorkOrder).printOrderId
    operations.push(processCode === 'DYE'
      ? prepareProductionDemandDyeMatch(workOrderId, decision)
      : prepareProductionDemandPrintMatch(workOrderId, decision))
    claimedSnapshots.forEach((snapshot) => {
      const coverage = processCoverage.get(snapshot) || new Set<string>()
      coverage.add(source.productionDemandId!)
      processCoverage.set(snapshot, coverage)
    })
    if (exact) {
      matchedWorkOrderIds.push(workOrderId)
    } else if (decision.matchStatus === 'MATCH_FAILED') failedWorkOrderIds.push(workOrderId)
  }

  listDyeWorkOrders().filter((order) => {
    const source = order.sourceSnapshot
    return source?.sourceType === 'PRODUCTION_DEMAND' && source.matchStatus !== 'CANCELLED' && source.matchStatus !== 'MATCHED' && demandIds.has(source.productionDemandId || '')
  }).forEach((order) => stage('DYE', order))
  listPrintWorkOrders().filter((order) => {
    const source = order.sourceSnapshot
    return source?.sourceType === 'PRODUCTION_DEMAND' && source.matchStatus !== 'CANCELLED' && source.matchStatus !== 'MATCHED' && demandIds.has(source.productionDemandId || '')
  }).forEach((order) => stage('PRINT', order))

  const totalDemandQty = group.demands.reduce((sum, demand) => sum + demand.requiredQtyTotal, 0)
  const remainingSnapshots = snapshots.flatMap((snapshot) => {
    const covered = processCoverage.get(snapshot) || new Set<string>()
    const uncovered = group.demands.filter((demand) => !covered.has(demand.demandId))
    if (uncovered.length === 0) return []
    if (uncovered.length === group.demands.length || totalDemandQty <= 0) return [snapshot]
    const uncoveredQty = uncovered.reduce((sum, demand) => sum + demand.requiredQtyTotal, 0)
    return [{ ...snapshot, plannedQty: Number((snapshot.plannedQty * uncoveredQty / totalDemandQty).toFixed(2)) }]
  })

  let committed = false
  return {
    remainingSnapshots,
    matchedWorkOrderIds,
    failedWorkOrderIds,
    commit: () => {
      if (committed) return
      const committedOps: typeof operations = []
      try {
        operations.forEach((operation) => { operation.commit(); committedOps.push(operation) })
        committed = true
      } catch (error) {
        committedOps.reverse().forEach((operation) => operation.rollback())
        throw error
      }
    },
    rollback: () => {
      if (!committed) return
      operations.slice().reverse().forEach((operation) => operation.rollback())
      committed = false
    },
  }
}

import type {
  FormalProductionOrderProcessSnapshot,
  ProcessWorkOrderSourceSnapshot,
} from './process-work-order-domain.ts'
import {
  buildProcessWorkOrderSourceKey,
  normalizeProcessWorkOrderGenerationInput,
  type ProcessWorkOrderGenerationInput,
} from './process-work-order-generation-key.ts'

export type GeneratedProcessCode = 'DYE' | 'PRINT'

export interface ProcessWorkOrderRegistrationInput extends FormalProductionOrderProcessSnapshot {
  workOrderId: string
  workOrderNo: string
  processName: string
  sourceSnapshot: ProcessWorkOrderSourceSnapshot
  sourceKey: string
  plannedFinishAt?: string
  createdBy?: string
  requiresWaterSoluble?: boolean
  sampleWaitType?: 'NONE' | 'WAIT_SAMPLE_GARMENT' | 'WAIT_COLOR_CARD'
}

export interface PreparedProcessWorkOrderRegistration {
  workOrderId: string
  commit: () => void
  rollback: () => void
}

export interface ProcessWorkOrderGenerationRegistrar {
  processCode: GeneratedProcessCode
  findBySourceKey: (sourceKey: string) => string | undefined
  issueIdentity: (orderedAt: string) => { workOrderId: string; workOrderNo: string }
  prepare: (input: ProcessWorkOrderRegistrationInput) => PreparedProcessWorkOrderRegistration
}

const registrars = new Map<GeneratedProcessCode, ProcessWorkOrderGenerationRegistrar>()
let commitFailureForTest: GeneratedProcessCode | null = null

export function registerProcessWorkOrderGenerationRegistrar(registrar: ProcessWorkOrderGenerationRegistrar): void {
  registrars.set(registrar.processCode, registrar)
}

export function getProcessWorkOrderGenerationRegistrar(processCode: GeneratedProcessCode): ProcessWorkOrderGenerationRegistrar {
  const registrar = registrars.get(processCode)
  if (!registrar) throw new Error(`${processCode === 'DYE' ? '染色' : '印花'}加工单生成器尚未注册`)
  return registrar
}

export interface EnsuredProcessWorkOrders {
  dyeWorkOrderId?: string
  printWorkOrderId?: string
}

export function setProcessWorkOrderGenerationCommitFailureForTest(processCode: GeneratedProcessCode | null): void {
  commitFailureForTest = processCode
}

export function ensureProcessWorkOrders(input: ProcessWorkOrderGenerationInput): EnsuredProcessWorkOrders {
  const normalized = normalizeProcessWorkOrderGenerationInput(input)
  const processCodes = new Set(normalized.processCodes)
  const sourceSnapshot = structuredClone(normalized.source)
  const common = {
    productionOrderId: sourceSnapshot.productionOrderId || '',
    productionOrderNo: sourceSnapshot.productionOrderNo || '',
    orderedAt: normalized.orderedAt,
    techPackVersionId: sourceSnapshot.techPackVersionId || '',
    techPackVersionLabel: sourceSnapshot.techPackVersionLabel || (sourceSnapshot.sourceType === 'STOCK' ? '备货创建' : ''),
    materialId: normalized.materialId,
    materialName: normalized.materialName,
    materialItems: structuredClone(normalized.materialItems),
    targetColor: normalized.targetColor,
    plannedQty: normalized.plannedQty,
    qtyUnit: normalized.qtyUnit,
    processCodes: [...normalized.processCodes],
    factoryId: normalized.factoryId,
    factoryName: normalized.factoryName,
    spuCode: normalized.spuCode,
    spuName: normalized.spuName,
    requiredDeliveryDate: normalized.requiredDeliveryDate,
    plannedFinishAt: normalized.plannedFinishAt,
    createdBy: normalized.createdBy,
    sourceSnapshot,
  }
  const result: EnsuredProcessWorkOrders = {}
  const prepared: Array<{ processCode: GeneratedProcessCode; plan: PreparedProcessWorkOrderRegistration }> = []
  for (const processCode of ['DYE', 'PRINT'] as const) {
    if (!processCodes.has(processCode)) continue
    const registrar = getProcessWorkOrderGenerationRegistrar(processCode)
    const sourceKey = buildProcessWorkOrderSourceKey(normalized, processCode)
    const existingId = registrar.findBySourceKey(sourceKey)
    if (existingId) {
      if (processCode === 'DYE') result.dyeWorkOrderId = existingId
      else result.printWorkOrderId = existingId
      continue
    }
    const registrationInput: ProcessWorkOrderRegistrationInput = {
      ...common,
      ...registrar.issueIdentity(normalized.orderedAt),
      sourceKey,
      processName: processCode === 'DYE' ? normalized.dyeProcessName || '染色' : normalized.printProcessName || '印花',
      requiresWaterSoluble: processCode === 'DYE' && normalized.requiresWaterSoluble === true,
      sampleWaitType: processCode === 'DYE' ? normalized.dyeSampleWaitType : undefined,
    }
    const plan = registrar.prepare(registrationInput)
    prepared.push({ processCode, plan })
    if (processCode === 'DYE') result.dyeWorkOrderId = plan.workOrderId
    else result.printWorkOrderId = plan.workOrderId
  }
  const attempted: PreparedProcessWorkOrderRegistration[] = []
  try {
    for (const { processCode, plan } of prepared) {
      attempted.push(plan)
      if (commitFailureForTest === processCode) throw new Error(`模拟${processCode === 'DYE' ? '染色' : '印花'}加工单提交失败`)
      plan.commit()
    }
  } catch (error) {
    attempted.reverse().forEach((plan) => plan.rollback())
    throw error
  }
  return result
}

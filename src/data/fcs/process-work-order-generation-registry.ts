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
  issueIdentity: (
    orderedAt: string,
    reserved: { workOrderIds: ReadonlySet<string>; workOrderNos: ReadonlySet<string> },
  ) => { workOrderId: string; workOrderNo: string }
  prepare: (input: ProcessWorkOrderRegistrationInput) => PreparedProcessWorkOrderRegistration
}

const registrars = new Map<GeneratedProcessCode, ProcessWorkOrderGenerationRegistrar>()
let commitFailureForTest: { processCode: GeneratedProcessCode; occurrence: number; seen: number } | null = null

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

export function setProcessWorkOrderGenerationCommitFailureForTest(
  processCode: GeneratedProcessCode | null,
  occurrence = 1,
): void {
  commitFailureForTest = processCode
    ? { processCode, occurrence: Math.max(Math.floor(occurrence), 1), seen: 0 }
    : null
}

export function ensureProcessWorkOrders(input: ProcessWorkOrderGenerationInput): EnsuredProcessWorkOrders {
  return ensureProcessWorkOrderBatch([input])[0] ?? {}
}

export function ensureProcessWorkOrderBatch(
  inputs: ProcessWorkOrderGenerationInput[],
): EnsuredProcessWorkOrders[] {
  const normalizedInputs = inputs.map(normalizeProcessWorkOrderGenerationInput)
  const results: EnsuredProcessWorkOrders[] = normalizedInputs.map(() => ({}))
  const prepared: Array<{ processCode: GeneratedProcessCode; plan: PreparedProcessWorkOrderRegistration }> = []
  const plannedIdsBySourceKey = new Map<string, string>()
  const reserved = { workOrderIds: new Set<string>(), workOrderNos: new Set<string>() }

  normalizedInputs.forEach((normalized, inputIndex) => {
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
    for (const processCode of ['DYE', 'PRINT'] as const) {
      if (!processCodes.has(processCode)) continue
      const registrar = getProcessWorkOrderGenerationRegistrar(processCode)
      const sourceKey = buildProcessWorkOrderSourceKey(normalized, processCode)
      const batchSourceKey = `${processCode}\u0000${sourceKey}`
      const existingId = registrar.findBySourceKey(sourceKey) || plannedIdsBySourceKey.get(batchSourceKey)
      if (existingId) {
        if (processCode === 'DYE') results[inputIndex].dyeWorkOrderId = existingId
        else results[inputIndex].printWorkOrderId = existingId
        continue
      }
      const identity = registrar.issueIdentity(normalized.orderedAt, reserved)
      reserved.workOrderIds.add(identity.workOrderId)
      reserved.workOrderNos.add(identity.workOrderNo)
      const registrationInput: ProcessWorkOrderRegistrationInput = {
        ...common,
        ...identity,
        sourceKey,
        processName: processCode === 'DYE' ? normalized.dyeProcessName || '染色' : normalized.printProcessName || '印花',
        requiresWaterSoluble: processCode === 'DYE' && normalized.requiresWaterSoluble === true,
        sampleWaitType: processCode === 'DYE' ? normalized.dyeSampleWaitType : undefined,
      }
      const plan = registrar.prepare(registrationInput)
      prepared.push({ processCode, plan })
      plannedIdsBySourceKey.set(batchSourceKey, plan.workOrderId)
      if (processCode === 'DYE') results[inputIndex].dyeWorkOrderId = plan.workOrderId
      else results[inputIndex].printWorkOrderId = plan.workOrderId
    }
  })

  const attempted: PreparedProcessWorkOrderRegistration[] = []
  try {
    for (const { processCode, plan } of prepared) {
      attempted.push(plan)
      if (commitFailureForTest?.processCode === processCode) {
        commitFailureForTest.seen += 1
        if (commitFailureForTest.seen === commitFailureForTest.occurrence) {
          const processName = processCode === 'DYE' ? '染色' : '印花'
          throw new Error(commitFailureForTest.occurrence === 1
            ? `模拟${processName}加工单提交失败`
            : `模拟第 ${commitFailureForTest.occurrence} 张${processName}加工单提交失败`)
        }
      }
      plan.commit()
    }
  } catch (error) {
    attempted.reverse().forEach((plan) => plan.rollback())
    throw error
  }
  return results
}

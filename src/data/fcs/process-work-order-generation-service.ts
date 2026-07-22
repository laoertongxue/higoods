import { registerDyeProcessWorkOrderGenerationRegistrar } from './dyeing-task-domain.ts'
import { registerPrintProcessWorkOrderGenerationRegistrar } from './printing-task-domain.ts'
import {
  ensureProcessWorkOrders as ensureRegisteredProcessWorkOrders,
  ensureProcessWorkOrderBatch as ensureRegisteredProcessWorkOrderBatch,
  prepareProcessWorkOrderBatch as prepareRegisteredProcessWorkOrderBatch,
  setProcessWorkOrderGenerationCommitFailureForTest,
  setProcessWorkOrderGenerationPrepareFailureForTest,
  setProcessWorkOrderGenerationRollbackFailureForTest,
  type EnsuredProcessWorkOrders,
  type PreparedProcessWorkOrderBatch,
} from './process-work-order-generation-registry.ts'
import type { ProcessWorkOrderGenerationInput } from './process-work-order-generation-key.ts'
import type { TechPackBomItemSnapshot } from './production-tech-pack-snapshot-types.ts'

export {
  buildProcessWorkOrderSourceKey,
  type ProcessWorkOrderGenerationInput,
} from './process-work-order-generation-key.ts'
export {
  setProcessWorkOrderGenerationCommitFailureForTest,
  setProcessWorkOrderGenerationPrepareFailureForTest,
  setProcessWorkOrderGenerationRollbackFailureForTest,
  type EnsuredProcessWorkOrders,
  type PreparedProcessWorkOrderBatch,
}

export function bootstrapProcessWorkOrderGeneration(): void {
  registerDyeProcessWorkOrderGenerationRegistrar()
  registerPrintProcessWorkOrderGenerationRegistrar()
}

export function ensureProcessWorkOrders(input: ProcessWorkOrderGenerationInput): EnsuredProcessWorkOrders {
  bootstrapProcessWorkOrderGeneration()
  return ensureRegisteredProcessWorkOrders(input)
}

export function ensureProcessWorkOrderBatch(
  inputs: ProcessWorkOrderGenerationInput[],
): EnsuredProcessWorkOrders[] {
  bootstrapProcessWorkOrderGeneration()
  return ensureRegisteredProcessWorkOrderBatch(inputs)
}

export function prepareProcessWorkOrderBatch(
  inputs: ProcessWorkOrderGenerationInput[],
): PreparedProcessWorkOrderBatch {
  bootstrapProcessWorkOrderGeneration()
  return prepareRegisteredProcessWorkOrderBatch(inputs)
}

export function resolveUniqueSupplementBomItem(input: {
  bomItems: TechPackBomItemSnapshot[]
  sourceBomItemId?: string
  materialSku: string
  materialName: string
}): { ok: true; bomItem: TechPackBomItemSnapshot } | { ok: false; message: string } {
  const sourceBomItemId = input.sourceBomItemId?.trim() || ''
  const materialSku = input.materialSku.trim().toLowerCase()
  const materialName = input.materialName.trim().toLowerCase()
  const candidates = input.bomItems.filter((item) => {
    if (sourceBomItemId) return item.id === sourceBomItemId
    const itemCode = item.materialCode?.trim().toLowerCase() || ''
    const itemName = item.name.trim().toLowerCase()
    return Boolean(materialSku && (item.id.toLowerCase() === materialSku || itemCode === materialSku))
      || Boolean(materialName && itemName === materialName)
  })
  if (candidates.length !== 1) {
    return {
      ok: false,
      message: `补料物料 ${input.materialSku || input.materialName || '未命名物料'} 无法唯一匹配冻结技术包 BOM，请先确认物料关系。`,
    }
  }
  const bomItem = candidates[0]
  if (!Number.isFinite(bomItem.unitConsumption) || bomItem.unitConsumption <= 0) {
    return { ok: false, message: `冻结技术包 BOM ${bomItem.id} 的单耗必须是大于 0 的有限数。` }
  }
  if (!Number.isFinite(bomItem.lossRate) || bomItem.lossRate < 0 || bomItem.lossRate > 100) {
    return { ok: false, message: `冻结技术包 BOM ${bomItem.id} 的损耗率必须在 0% 至 100% 之间。` }
  }
  return { ok: true, bomItem: structuredClone(bomItem) }
}

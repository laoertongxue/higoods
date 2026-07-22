import { registerDyeProcessWorkOrderGenerationRegistrar } from './dyeing-task-domain.ts'
import { registerPrintProcessWorkOrderGenerationRegistrar } from './printing-task-domain.ts'
import {
  ensureProcessWorkOrders as ensureRegisteredProcessWorkOrders,
  ensureProcessWorkOrderBatch as ensureRegisteredProcessWorkOrderBatch,
  setProcessWorkOrderGenerationCommitFailureForTest,
  type EnsuredProcessWorkOrders,
} from './process-work-order-generation-registry.ts'
import type { ProcessWorkOrderGenerationInput } from './process-work-order-generation-key.ts'
import type { TechPackBomItemSnapshot } from './production-tech-pack-snapshot-types.ts'

export {
  buildProcessWorkOrderSourceKey,
  type ProcessWorkOrderGenerationInput,
} from './process-work-order-generation-key.ts'
export { setProcessWorkOrderGenerationCommitFailureForTest, type EnsuredProcessWorkOrders }

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
  return { ok: true, bomItem: structuredClone(candidates[0]) }
}

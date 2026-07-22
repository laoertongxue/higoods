import { registerDyeProcessWorkOrderGenerationRegistrar } from './dyeing-task-domain.ts'
import { registerPrintProcessWorkOrderGenerationRegistrar } from './printing-task-domain.ts'
import {
  ensureProcessWorkOrders as ensureRegisteredProcessWorkOrders,
  setProcessWorkOrderGenerationCommitFailureForTest,
  type EnsuredProcessWorkOrders,
} from './process-work-order-generation-registry.ts'
import type { ProcessWorkOrderGenerationInput } from './process-work-order-generation-key.ts'

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

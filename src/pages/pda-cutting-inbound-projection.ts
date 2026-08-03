import { getPdaCuttingTaskSnapshot } from '../data/fcs/pda-cutting-execution-source.ts'
import {
  resolveTransferBagCurrentUse,
} from '../data/fcs/cutting/transfer-bag-operations.ts'
import {
  getBrowserLocalStorage,
  type BrowserStorageLike,
} from '../data/browser-storage.ts'

export function buildPdaCuttingInboundProjection(taskId: string, executionKey?: string) {
  return getPdaCuttingTaskSnapshot(taskId, executionKey)
}

export function buildPdaCuttingInboundBagProjection(
  bagCode: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
) {
  return resolveTransferBagCurrentUse(bagCode, storage)
}

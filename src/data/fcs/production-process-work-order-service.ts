import {
  prepareFormalProductionOrderDyeWorkOrderSync,
  registerFormalProductionOrderDyeWorkOrder,
} from './dyeing-task-domain.ts'
import {
  type FormalProductionOrderProcessSnapshot,
} from './process-work-order-domain.ts'
import {
  prepareFormalProductionOrderPrintWorkOrderSync,
  registerFormalProductionOrderPrintWorkOrder,
} from './printing-task-domain.ts'
import { prepareCombinedDyeingProductionChangeImpact } from './combined-dyeing-domain.ts'
import {
  deriveFormalProductionOrderMaterialFields,
  normalizeFormalProductionOrderMaterialItems,
} from './formal-production-order-material-items.ts'
import { deriveFormalProductionOrderProcessSnapshots } from './production-process-snapshot-derivation.ts'
import type { ProductionOrder } from './production-orders.ts'
import {
  ensureProcessWorkOrders,
  type EnsuredProcessWorkOrders,
} from './process-work-order-generation-service.ts'

export type { FormalProductionOrderProcessSnapshot } from './process-work-order-domain.ts'

export type EnsuredProductionProcessWorkOrders = EnsuredProcessWorkOrders

export interface ProductionOrderChangeWorkOrderSyncOptions {
  changeRecordId?: string
  recordedAt?: string
  beforeCommitPreparation?: (index: number) => void
}

export interface ProductionOrderChangeWorkOrderSyncResult {
  autoSynced: string[]
  protected: string[]
  unchanged: string[]
}

export interface PreparedProductionOrderChangeWorkOrderSyncBatch {
  result: ProductionOrderChangeWorkOrderSyncResult
  commit: () => void
  rollback: () => void
}

export function validateFormalProductionOrderProcessSnapshot(
  snapshot: FormalProductionOrderProcessSnapshot,
): void {
  if (!snapshot.productionOrderId.trim()) throw new Error('正式生产单 ID 不能为空')
  if (!snapshot.productionOrderNo.trim()) throw new Error('正式生产单号不能为空')
  if (!snapshot.techPackVersionId.trim() || !snapshot.techPackVersionLabel.trim()) {
    throw new Error('正式生产单必须携带已发布技术包版本快照')
  }
  if (!snapshot.materialId.trim() || !snapshot.materialName.trim()) {
    throw new Error('正式生产单必须携带 BOM 面料快照')
  }
  const materialItems = normalizeFormalProductionOrderMaterialItems(snapshot)
  if (materialItems.some((item) => (
    !item.sourceBomItemId.trim() || !item.materialId.trim() || !item.materialName.trim()
  ))) {
    throw new Error('正式生产单 BOM 物料构成的来源行、物料 ID 和名称不能为空')
  }
  if (new Set(materialItems.map((item) => item.sourceBomItemId)).size !== materialItems.length) {
    throw new Error('正式生产单 BOM 物料构成的来源行不能重复')
  }
  if (snapshot.materialItems?.length) {
    const derived = deriveFormalProductionOrderMaterialFields(materialItems)
    if (snapshot.materialId !== derived.materialId || snapshot.materialName !== derived.materialName) {
      throw new Error('正式生产单 BOM 聚合物料字段必须由物料构成稳定派生')
    }
  }
  if (!Number.isFinite(snapshot.plannedQty) || snapshot.plannedQty <= 0 || !snapshot.qtyUnit.trim()) {
    throw new Error('正式生产单加工数量和单位必须有效')
  }
  if (snapshot.processCodes.length === 0) throw new Error('正式生产单加工工艺不能为空')
  const unsupportedProcessCodes = snapshot.processCodes
    .map((code) => String(code).trim())
    .filter((code) => code !== 'DYE' && code !== 'PRINT')
  if (unsupportedProcessCodes.length > 0) {
    throw new Error(`不支持的生产工艺：${[...new Set(unsupportedProcessCodes)].join('、')}`)
  }
}

export function buildFormalProductionOrderProcessSnapshots(
  order: ProductionOrder,
): FormalProductionOrderProcessSnapshot[] {
  return deriveFormalProductionOrderProcessSnapshots(order).map((snapshot) => {
    validateFormalProductionOrderProcessSnapshot(snapshot)
    return snapshot
  })
}

export function ensureProcessWorkOrdersForFormalProductionOrder(
  snapshot: FormalProductionOrderProcessSnapshot,
): EnsuredProductionProcessWorkOrders {
  validateFormalProductionOrderProcessSnapshot(snapshot)
  const materialItems = normalizeFormalProductionOrderMaterialItems(snapshot)
  const materialFields = deriveFormalProductionOrderMaterialFields(materialItems)
  return ensureProcessWorkOrders({
    source: {
      sourceType: 'PRODUCTION_ORDER',
      productionOrderId: snapshot.productionOrderId,
      productionOrderNo: snapshot.productionOrderNo,
      techPackVersionId: snapshot.techPackVersionId,
      techPackVersionLabel: snapshot.techPackVersionLabel,
      bomItemIds: materialItems.map((item) => item.sourceBomItemId),
    },
    processCodes: [...snapshot.processCodes],
    orderedAt: snapshot.orderedAt,
    materialId: materialFields.materialId,
    materialName: materialFields.materialName,
    materialItems,
    targetColor: snapshot.targetColor,
    plannedQty: snapshot.plannedQty,
    qtyUnit: snapshot.qtyUnit,
    dyeProcessName: snapshot.dyeProcessName,
    printProcessName: snapshot.printProcessName,
    requiresWaterSoluble: snapshot.requiresWaterSoluble === true,
    factoryId: snapshot.factoryId,
    factoryName: snapshot.factoryId ? (snapshot.factoryName || snapshot.factoryId) : undefined,
    spuCode: snapshot.spuCode,
    spuName: snapshot.spuName,
    requiredDeliveryDate: snapshot.requiredDeliveryDate,
  })
}

function createDefaultChangeRecordId(snapshot: FormalProductionOrderProcessSnapshot): string {
  return [
    'PRODUCTION-CHANGE',
    snapshot.productionOrderId,
    snapshot.orderedAt,
    snapshot.techPackVersionId,
    snapshot.materialId,
    snapshot.targetColor,
    snapshot.plannedQty,
    snapshot.qtyUnit,
    snapshot.dyeProcessName ?? '',
    snapshot.printProcessName ?? '',
    snapshot.requiresWaterSoluble === true ? 'WATER' : 'NO_WATER',
  ].join('|')
}

export function syncProcessWorkOrdersAfterProductionOrderChange(
  snapshot: FormalProductionOrderProcessSnapshot,
  options: ProductionOrderChangeWorkOrderSyncOptions = {},
): ProductionOrderChangeWorkOrderSyncResult {
  const prepared = prepareSyncProcessWorkOrdersAfterProductionOrderChanges([snapshot], options)
  prepared.commit()
  return prepared.result
}

export function prepareSyncProcessWorkOrdersAfterProductionOrderChanges(
  snapshots: FormalProductionOrderProcessSnapshot[],
  options: ProductionOrderChangeWorkOrderSyncOptions = {},
): PreparedProductionOrderChangeWorkOrderSyncBatch {
  snapshots.forEach(validateFormalProductionOrderProcessSnapshot)
  const snapshotKeys = snapshots.flatMap((snapshot) => (
    [...new Set(snapshot.processCodes)].map((processCode) => `${snapshot.productionOrderId}:${processCode}`)
  ))
  if (new Set(snapshotKeys).size !== snapshotKeys.length) {
    throw new Error('同一生产单的同一加工工艺不能重复同步')
  }
  const batchRecordId = options.changeRecordId?.trim()
  const recordedAt = options.recordedAt?.trim() || new globalThis.Date().toISOString()
  const preparations: Array<{ commit: () => void; rollback: () => void }> = []
  const result: ProductionOrderChangeWorkOrderSyncResult = { autoSynced: [], protected: [], unchanged: [] }

  snapshots.forEach((snapshot) => {
    const changeRecordId = batchRecordId || createDefaultChangeRecordId(snapshot)
    const processCodes = new Set(snapshot.processCodes)

    if (processCodes.has('DYE')) {
      const prepared = prepareFormalProductionOrderDyeWorkOrderSync(snapshot, { changeRecordId, recordedAt })
      preparations.push(prepared)
      if (prepared.workOrderId && prepared.outcome === 'AUTO_SYNCED') result.autoSynced.push(prepared.workOrderId)
      if (prepared.workOrderId && prepared.outcome === 'PROTECTED') result.protected.push(prepared.workOrderId)
      if (prepared.workOrderId && prepared.outcome === 'UNCHANGED') result.unchanged.push(prepared.workOrderId)
      if (
        prepared.outcome === 'PROTECTED'
        && prepared.protectedCombinedMembership
        && prepared.before
        && prepared.after
        && prepared.impact
        && prepared.workOrderId
      ) {
        preparations.push(prepareCombinedDyeingProductionChangeImpact(
          prepared.protectedCombinedMembership.taskId,
          {
            changeRecordId,
            dyeWorkOrderId: prepared.workOrderId,
            before: prepared.before,
            after: prepared.after,
            reason: '已加入合并染色',
            recordedAt,
            suggestedAction: prepared.impact.suggestedAction,
          },
        ))
      }
    }

    if (processCodes.has('PRINT')) {
      const prepared = prepareFormalProductionOrderPrintWorkOrderSync(snapshot, { changeRecordId, recordedAt })
      preparations.push(prepared)
      if (prepared.workOrderId && prepared.outcome === 'AUTO_SYNCED') result.autoSynced.push(prepared.workOrderId)
      if (prepared.workOrderId && prepared.outcome === 'PROTECTED') result.protected.push(prepared.workOrderId)
      if (prepared.workOrderId && prepared.outcome === 'UNCHANGED') result.unchanged.push(prepared.workOrderId)
    }
  })

  let committed = false
  let rolledBack = false
  let committedPreparations: Array<{ commit: () => void; rollback: () => void }> = []
  const rollbackCommittedPreparations = (): void => {
    committedPreparations.slice().reverse().forEach((prepared) => prepared.rollback())
    committedPreparations = []
    committed = false
    rolledBack = true
  }
  return {
    result,
    commit: () => {
      if (committed || rolledBack) return
      try {
        preparations.forEach((prepared, index) => {
          options.beforeCommitPreparation?.(index)
          prepared.commit()
          committedPreparations.push(prepared)
        })
        committed = true
      } catch (error) {
        rollbackCommittedPreparations()
        throw error
      }
    },
    rollback: rollbackCommittedPreparations,
  }
}

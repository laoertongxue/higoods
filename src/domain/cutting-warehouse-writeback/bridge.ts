import { getBrowserLocalStorage } from '../../data/browser-storage.ts'
import {
  appendCutPieceWarehouseWritebackRecord,
  appendSampleWarehouseWritebackRecord,
  type CutPieceWarehouseWritebackRecord,
  type SampleWarehouseWritebackRecord,
} from '../../data/fcs/cutting/warehouse-writeback-ledger.ts'
import { buildCuttingCoreRegistry } from '../cutting-core/index.ts'

export interface CuttingWarehouseWritebackResult {
  success: boolean
  writebackId: string
  issues: string[]
}

function buildFailure(issues: string[], writebackId = ''): CuttingWarehouseWritebackResult {
  return {
    success: false,
    writebackId,
    issues,
  }
}

function buildSuccess(writebackId: string): CuttingWarehouseWritebackResult {
  return {
    success: true,
    writebackId,
    issues: [],
  }
}

function validateFormalIdentity(input: {
  productionOrderId: string
  productionOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  materialSku: string
}): string[] {
  const issues: string[] = []
  const registry = buildCuttingCoreRegistry()
  const productionOrder = registry.productionOrdersById[input.productionOrderId] || registry.productionOrdersByNo[input.productionOrderNo]
  const cutOrder = registry.cutOrdersById[input.cutOrderId] || registry.cutOrdersByNo[input.cutOrderNo]

  if (!productionOrder) issues.push('未找到对应生产单，无法提交正式仓务写回。')
  if (!cutOrder) issues.push('未找到对应裁片单，无法提交正式仓务写回。')

  if (productionOrder && cutOrder && cutOrder.productionOrderId !== productionOrder.productionOrderId) {
    issues.push('裁片单与生产单绑定不一致，已拒绝提交。')
  }

  if (cutOrder && input.materialSku && cutOrder.materialSku && cutOrder.materialSku !== input.materialSku) {
    issues.push('当前仓务动作的面料 SKU 与正式裁片单不一致，已拒绝提交。')
  }

  return issues
}

export function submitCutPieceWarehouseWriteback(
  payload: CutPieceWarehouseWritebackRecord,
): CuttingWarehouseWritebackResult {
  const issues = validateFormalIdentity(payload)
  if (!payload.warehouseRecordId.trim()) issues.push('缺少裁片仓记录主键，无法提交。')
  if (!payload.cutOrderId.trim()) issues.push('缺少裁片单 ID，无法提交。')
  if (!payload.productionOrderId.trim()) issues.push('缺少生产单 ID，无法提交。')
  if (!payload.operatorAccountId.trim()) issues.push('缺少仓务操作人账号，无法提交。')

  if (issues.length > 0) return buildFailure(issues, payload.writebackId)

  appendCutPieceWarehouseWritebackRecord(payload, getBrowserLocalStorage() || undefined)
  return buildSuccess(payload.writebackId)
}

export function submitSampleWarehouseWriteback(
  payload: SampleWarehouseWritebackRecord,
): CuttingWarehouseWritebackResult {
  const issues = validateFormalIdentity(payload)
  if (!payload.sampleRecordId.trim()) issues.push('缺少样衣仓记录主键，无法提交。')
  if (!payload.cutOrderId.trim()) issues.push('缺少裁片单 ID，无法提交。')
  if (!payload.productionOrderId.trim()) issues.push('缺少生产单 ID，无法提交。')
  if (!payload.operatorAccountId.trim()) issues.push('缺少仓务操作人账号，无法提交。')

  if (issues.length > 0) return buildFailure(issues, payload.writebackId)

  appendSampleWarehouseWritebackRecord(payload, getBrowserLocalStorage() || undefined)
  return buildSuccess(payload.writebackId)
}

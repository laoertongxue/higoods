import { installSewingMaterialReadinessCheck } from './runtime-task-read-bridge.ts'
import { classifyTaskFulfillmentPolicy } from './task-fulfillment-policy.ts'
import { getMaterialPrepDispatchReadinessForTask } from './cutting/production-material-prep.ts'
import { getCutPieceDispatchReadinessForTask } from './cut-piece-release.ts'
import type { RuntimeProcessTask } from './runtime-process-tasks.ts'

export function getSewingAssignmentReadiness(task: RuntimeProcessTask, skuLines = task.scopeSkuLines) {
  const policy = classifyTaskFulfillmentPolicy(task)
  const reasons: string[] = []
  const materials = []
  if (policy.involvesSewingOutsourcing) {
    for (const processCode of policy.startsWithSewing ? ['SEW'] : ['CUTTING', 'SEW']) {
      const label = processCode === 'SEW' ? '车缝配料' : '裁剪配料'
      const material = getMaterialPrepDispatchReadinessForTask({
        taskId: processCode, taskNo: processCode, processCode, processBusinessCode: processCode,
        processNameZh: processCode === 'SEW' ? '车缝' : '裁剪', productionOrderId: task.productionOrderId,
      })
      materials.push(material)
      if (!material.hasMaterialPrepScope || !material.lines.length) reasons.push(`${label}缺少有效物料范围，请核对生产单配料明细`)
      else if (!material.ready) reasons.push(`${label}未配齐：${material.summaryText}`)
      else if (material.lines.some((line) => !line.unit || !Number.isFinite(line.requiredQty) || line.requiredQty <= 0)) reasons.push(`${label}数量或单位不完整`)
    }
    if (policy.startsWithSewing) {
      const release = getCutPieceDispatchReadinessForTask({ productionOrderId: task.productionOrderId, productionOrderNo: task.productionOrderNo, skuLines })
      if (!release.canDispatch) reasons.push('有效裁片放行不足，请查看裁片放行明细')
    }
  }
  return { ready: reasons.length === 0, reasons, materials }
}

export function assertSewingAssignmentMaterialReadiness(task: RuntimeProcessTask): void {
  const result = getSewingAssignmentReadiness(task)
  const materialReasons = result.reasons.filter((reason) => !reason.startsWith('有效裁片放行'))
  if (materialReasons.length) throw new Error(materialReasons.join('；'))
}

installSewingMaterialReadinessCheck((task) => assertSewingAssignmentMaterialReadiness(task as RuntimeProcessTask))

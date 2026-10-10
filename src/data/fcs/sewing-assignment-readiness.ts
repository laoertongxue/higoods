import { installSewingMaterialReadinessCheck } from './runtime-task-read-bridge.ts'
import { classifyTaskFulfillmentPolicy } from './task-fulfillment-policy.ts'
import { getMaterialPrepDispatchReadinessForTask, type MaterialPrepDispatchReadiness } from './cutting/production-material-prep.ts'
import { getCutPieceDispatchReadinessForTask } from './cut-piece-release.ts'
import type { RuntimeProcessTask } from './runtime-process-tasks.ts'

/** 配料完成度与资料有效性分别判断；从车缝开始的任务允许 PPIC 跟进欠料。 */
export function evaluateSewingMaterialReadiness(
  material: MaterialPrepDispatchReadiness,
  label: string,
  requireComplete: boolean,
): { reasons: string[]; warnings: string[] } {
  const reasons: string[] = []
  const warnings: string[] = []
  if (!material.hasMaterialPrepScope || !material.lines.length) {
    const message = requireComplete
      ? `${label}缺少有效物料范围，请核对生产单配料明细`
      : `${label}尚未读取到有效物料范围，请 PPIC 核对生产单配料明细`
    ;(requireComplete ? reasons : warnings).push(message)
  } else {
    if (material.lines.some((line) => !line.unit?.trim() || !line.materialSku?.trim() || !Number.isFinite(line.requiredQty) || line.requiredQty <= 0 || !Number.isFinite(line.confirmedPrepQty) || line.confirmedPrepQty < 0)) {
      reasons.push(`${label}物料身份、数量或单位不完整，请核对配料明细`)
    }
    if (!material.ready) {
      const message = `${label}未配齐：${material.summaryText}`
      ;(requireComplete ? reasons : warnings).push(message)
    }
  }
  return { reasons, warnings }
}

export function getSewingAssignmentReadiness(task: RuntimeProcessTask, skuLines?: RuntimeProcessTask['scopeSkuLines']) {
  const policy = classifyTaskFulfillmentPolicy(task)
  const reasons: string[] = []
  const warnings: string[] = []
  const materials = []
  if (policy.involvesSewingOutsourcing) {
    for (const processCode of policy.startsWithSewing ? ['SEW'] : ['CUTTING', 'SEW']) {
      const label = processCode === 'SEW' ? '车缝配料' : '裁剪配料'
      const material = getMaterialPrepDispatchReadinessForTask({
        taskId: processCode, taskNo: processCode, processCode, processBusinessCode: processCode,
        processNameZh: processCode === 'SEW' ? '车缝' : '裁剪', productionOrderId: task.productionOrderId,
      })
      materials.push(material)
      const checks = evaluateSewingMaterialReadiness(material, label, !policy.startsWithSewing)
      reasons.push(...checks.reasons)
      warnings.push(...checks.warnings)
    }
    if (policy.startsWithSewing) {
      const requestedLines = skuLines ?? (task.scopeSkuLines.length ? task.scopeSkuLines : [{ skuCode: task.skuCode || 'SKU-ALL', color: task.skuColor || '混色', size: task.skuSize || '混码', qty: task.scopeQty }])
      const release = getCutPieceDispatchReadinessForTask({ productionOrderId: task.productionOrderId, productionOrderNo: task.productionOrderNo, skuLines: requestedLines })
      // 待分配入口允许选择一个完整且有余量的 SKU；提交传入所选范围后逐格严格校验。
      const hasAssignableSku = skuLines == null && policy.assignmentGranularity === 'SKU' && release.lines.some((line) => line.dispatchAllowed)
      if (!release.canDispatch && !hasAssignableSku) reasons.push('有效裁片放行不足，请查看裁片放行明细')
      else if (!release.canDispatch) warnings.push('部分 SKU 放行余量不足，请只选择已放行且余量足够的完整 SKU')
      for (const line of release.lines) {
        if (line.riskReleaseQty != null && line.riskReleaseQty > 0) warnings.push(`${line.color} / ${line.size} 当前风险放行 ${line.riskReleaseQty} 件，请 PPIC 跟进裁片与工艺回仓`)
      }
    }
  }
  return { ready: reasons.length === 0, reasons, warnings, materials }
}

export function assertSewingAssignmentMaterialReadiness(task: RuntimeProcessTask): void {
  const result = getSewingAssignmentReadiness(task)
  const materialReasons = result.reasons.filter((reason) => !reason.startsWith('有效裁片放行'))
  if (materialReasons.length) throw new Error(materialReasons.join('；'))
}

installSewingMaterialReadinessCheck((task) => assertSewingAssignmentMaterialReadiness(task as RuntimeProcessTask))

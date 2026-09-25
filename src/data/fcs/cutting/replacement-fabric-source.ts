import { productionOrders, getProductionOrderTechPackSnapshot, type ProductionOrder } from '../production-orders.ts'
import { getRuntimeTaskById, listRuntimeProcessTasks } from '../runtime-process-tasks.ts'
import { classifyTaskFulfillmentPolicy } from '../task-fulfillment-policy.ts'
import { isCuttingProcessTask, resolveCuttingTaskAssigneeType } from './cutting-task-routing.ts'
import { resolveProductionOrderTaskBoundary } from '../task-generation-boundaries.ts'
import { resolveProductionMaterialImageUrl } from '../production-material-image-assets.ts'
import type { ProductionOrderTechPackSnapshot } from '../production-tech-pack-snapshot-types.ts'
import type { DispatchTaskSheetData } from '../dispatch-task-sheet.ts'
import { isReplacementFabricMaterial, replacementFabricMaterialKey, type ReplacementFabricMaterial,
  type ReplacementFabricScope, type ReplacementFabricHandoverContext } from './replacement-fabric-fei-tickets.ts'

const clean = (value: string | undefined) => (value || '').trim()
export function resolveReplacementFabricMaterials(input: {
  techPack: ProductionOrderTechPackSnapshot | null
  skuLines: Array<{ skuCode: string; color: string }>
  bomItemIds?: string[]
}): { materials: ReplacementFabricMaterial[]; issues: string[] } {
  const { techPack } = input
  if (!techPack) return { materials: [], issues: ['缺少生产单技术资料，请主管补齐后再打印或交出。'] }
  if (!input.skuLines.length) return { materials: [], issues: ['任务没有明确 SKU 范围，请计划人员核对。'] }
  const issues = new Set<string>(); const materials = new Map<string, ReplacementFabricMaterial>()
  for (const sku of input.skuLines) {
    const mappings = (techPack.colorMaterialMappings || []).filter(mapping =>
      [mapping.colorCode, mapping.colorName].some(color => clean(color).toLowerCase() === clean(sku.color).toLowerCase()))
    if (!mappings.length) { issues.add(`SKU ${sku.skuCode} 缺少颜色用料映射，请主管核对。`); continue }
    let matchedLine = false
    for (const mapping of mappings) for (const line of mapping.lines) {
      if (line.applicableSkuCodes?.length && !line.applicableSkuCodes.includes(sku.skuCode)) continue
      const candidates = techPack.bomItems.filter(item => line.bomItemId ? item.id === line.bomItemId
        : !!line.materialCode && [item.materialCode, item.materialSkuId].includes(line.materialCode))
      if (candidates.length !== 1) { issues.add(`SKU ${sku.skuCode} 的物料 ${line.materialName || '未命名'} 无法唯一对应 BOM，请主管核对。`); continue }
      const bom = candidates[0]
      if (input.bomItemIds?.length && !input.bomItemIds.includes(bom.id)) continue
      if (bom.applicableSkuCodes?.length && !bom.applicableSkuCodes.includes(sku.skuCode)) continue
      matchedLine = true
      if (!clean(bom.name)) { issues.add(`物料 ${bom.materialCode || bom.id} 缺少名称，无法判断是否为朴。`); continue }
      if (!isReplacementFabricMaterial(bom.name, bom.type)) continue
      const code = clean(bom.materialSkuId) || clean(bom.variantId) || clean(bom.materialCode) || clean(line.materialCode)
      if (!code) { issues.add(`面料 ${bom.name} 缺少唯一物料编码，请主管核对。`); continue }
      const color = clean(bom.colorLabel) || clean(mapping.colorName) || clean(mapping.colorCode)
      const key = replacementFabricMaterialKey(code, color)
      const material = materials.get(key) || { key, code, name: bom.name, color,
        imageUrl: bom.materialImageUrl || resolveProductionMaterialImageUrl({ materialSku: code, materialName: bom.name, materialColor: color }), skuCodes: [] }
      if (material.name !== bom.name) issues.add(`物料 ${code} 存在不同名称，请主管核对技术资料。`)
      if (!material.skuCodes.includes(sku.skuCode)) material.skuCodes.push(sku.skuCode)
      materials.set(key, material)
    }
    if (!matchedLine && !input.bomItemIds?.length) issues.add(`SKU ${sku.skuCode} 没有可核对的用料明细。`)
  }
  return { materials: [...materials.values()], issues: [...issues] }
}

export interface ReplacementFabricOrderRow {
  order: ProductionOrder; scopes: ReplacementFabricScope[]; materials: ReplacementFabricMaterial[]; issues: string[]
}
export function listReplacementFabricOrderRows(factoryId?: string): ReplacementFabricOrderRow[] {
  const tasks = listRuntimeProcessTasks().filter(task => isCuttingProcessTask(task)
    && task.executionEnabled !== false && !task.isSplitSource && !task.mergedIntoTaskId
    && ['ASSIGNED', 'AWARDED'].includes(task.assignmentStatus)
    && resolveCuttingTaskAssigneeType(task.assignedFactoryId || '') === 'OWN_CUTTING_FACTORY'
    && (!factoryId || task.assignedFactoryId === factoryId))
  return productionOrders.flatMap(order => {
    if (['WHOLE_ORDER', 'CUTTING_SEWING_IRON_PACK'].includes(resolveProductionOrderTaskBoundary(order).kind)
      || order.status === 'CANCELLED') return []
    const current = tasks.filter(task => task.productionOrderId === order.productionOrderId || task.productionOrderId === order.productionOrderNo)
    if (!current.length) return []
    const techPack = getProductionOrderTechPackSnapshot(order.productionOrderId)
    const taskScopes = current.map((task): ReplacementFabricScope => {
      const bomItemIds = task.consumedBomItemIds || []
      const skuLines = task.scopeSkuLines?.length ? task.scopeSkuLines : order.demandSnapshot.skuLines
      const materialScope = resolveReplacementFabricMaterials({ techPack, skuLines, bomItemIds })
      // 分配时间使用真实派单事实；普通任务更新／PPIC 显示变化不重建票。
      const assignmentKey = JSON.stringify([task.taskId, task.assignedFactoryId,
        task.businessAssignedAt || task.dispatchedAt || task.awardedAt || task.createdAt])
      return { productionOrderId: order.productionOrderId, productionOrderNo: order.productionOrderNo,
        factoryId: task.assignedFactoryId!, assignmentKey, ...materialScope }
    })
    // 同一面料可能同时被本裁床多个子任务使用；默认备布按生产单面料生成一份。
    const grouped = new Map<string, ReplacementFabricScope[]>()
    for (const scope of taskScopes) for (const material of scope.materials) {
      const key = JSON.stringify([scope.factoryId, material.key])
      grouped.set(key, [...(grouped.get(key) || []), { ...scope, materials: [material] }])
    }
    const scopes: ReplacementFabricScope[] = [...grouped.values()].map(group => ({ ...group[0],
      assignmentKey: group.length === 1 ? group[0].assignmentKey : JSON.stringify(group.map(scope => scope.assignmentKey).sort()),
      materials: [{ ...group[0].materials[0], skuCodes: [...new Set(group.flatMap(scope => scope.materials[0].skuCodes))] }],
      issues: [...new Set(group.flatMap(scope => scope.issues))],
    }))
    scopes.push(...taskScopes.filter(scope => !scope.materials.length))
    const byMaterial = new Map<string, ReplacementFabricMaterial>(); const issues = new Set(scopes.flatMap(scope => scope.issues))
    for (const scope of scopes) for (const material of scope.materials) {
      const previous = byMaterial.get(material.key)
      byMaterial.set(material.key, { ...material, skuCodes: [...new Set([...(previous?.skuCodes || []), ...material.skuCodes])] })
      const competing = scopes.filter(other => other.factoryId !== scope.factoryId && other.materials.some(item => item.key === material.key))
      if (competing.length) issues.add(`面料 ${material.name} 分配到多个裁床，请计划人员明确备布责任。`)
    }
    if (issues.size) scopes.forEach(scope => { scope.issues = [...new Set([...scope.issues, ...issues])] })
    return [{ order, scopes, materials: [...byMaterial.values()], issues: [...issues] }]
  })
}
export function resolveReplacementFabricTaskContext(sheet: DispatchTaskSheetData): ReplacementFabricHandoverContext {
  const scope = resolveReplacementFabricMaterials({ techPack: sheet.techPack, skuLines: sheet.assignment.skuLines })
  return { taskId: sheet.assignment.runtimeTaskId, receiverFactoryId: sheet.assignment.factoryId,
    productionOrderId: sheet.assignment.productionOrderId, requiredMaterials: scope.materials, issues: scope.issues,
    inScope: sheet.supportsCutPieceHandover }
}

export function resolveReplacementFabricRuntimeTaskContext(taskId: string, receiverFactoryId: string): ReplacementFabricHandoverContext {
  const task = getRuntimeTaskById(taskId)
  if (!task) throw new Error(`车缝任务 ${taskId} 不存在，请核对当前任务单。`)
  const policy = classifyTaskFulfillmentPolicy(task)
  const order = productionOrders.find(order => order.productionOrderId === task.productionOrderId || order.productionOrderNo === task.productionOrderId)
  const scope = resolveReplacementFabricMaterials({ techPack: order ? getProductionOrderTechPackSnapshot(order.productionOrderId) : null, skuLines: task.scopeSkuLines || [] })
  if (task.assignedFactoryId !== receiverFactoryId) scope.issues.push('任务接收工厂已变化，请重新核对任务单。')
  if (!['ASSIGNED', 'AWARDED'].includes(task.assignmentStatus)) scope.issues.push('任务尚未有效分配，请计划人员核对。')
  return { taskId, receiverFactoryId, productionOrderId: order?.productionOrderId || task.productionOrderId,
    requiredMaterials: scope.materials, issues: scope.issues, inScope: policy.startsWithSewing }
}

/** 上游尚使用旧存储的派单事实，在本次 IDB 写事务内再核对；改派不能穿过异步提交窗口。 */
export function captureReplacementFabricSourceGuard(): () => void {
  const keys = ['higood.runtime-process-task-actions.v1', 'higood.formal-created-production-orders.v1', 'higood.effective-task-assignments.v2', 'cuttingRuntimeEventLedger']
  const read = () => keys.map(key => {
    try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(key) }
    catch { throw new Error('上游分配或来源记录无法读取，本次未保存。请恢复浏览器存储访问后重新核对，不要清除网站数据。') }
  })
  const before = read()
  return () => { if (read().some((value, index) => value !== before[index])) throw new Error('生产单分配或来源记录已变化，本次未保存，请刷新并重新核对。') }
}

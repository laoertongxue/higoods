#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  completeDyeMaterialReady,
  completeDyeMaterialWait,
  completeDyeNode,
  completeDyeing,
  completeDyeSampleTest,
  completeDyeSampleWait,
  createDyeWorkOrderFromDemands,
  executeDyeWaterSolublePdaAction,
  getDyeExecutionNodeRecord,
  getDyeWorkOrderById,
  listDyeVatOptions,
  listDyeWorkOrders,
  planDyeVat,
  startDyeMaterialReady,
  startDyeMaterialWait,
  startDyeNode,
  startDyeSampleTest,
  startDyeSampleWait,
  startDyeing,
  validateDyeStartPrerequisite,
} from '../src/data/fcs/dyeing-task-domain.ts'
import {
  acceptHandoverRecordDiff,
  createFactoryHandoverRecord,
  ensureHandoverOrderForStartedTask,
  getHandoverOrderById,
  getPdaHandoverRecordsByHead,
  listHandoverOrdersByTaskId,
  writeBackHandoverRecord,
} from '../src/data/fcs/pda-handover-events.ts'
import {
  getMobileExecutionTaskById,
  getMobileExecutionTaskByNo,
  getMobileExecutionTaskBySource,
  getMobileExecutionTaskSourceInfo,
  listMobileExecutionTasks,
} from '../src/data/fcs/mobile-execution-task-index.ts'
import {
  getMobileTaskProcessType,
  getPdaMobileExecutionTaskById,
  listInvalidProcessMobileTaskBindings,
  listPdaMobileExecutionTasks,
  validateProcessMobileTaskBinding,
} from '../src/data/fcs/process-mobile-task-binding.ts'
import {
  getProcessWorkOrderById,
  listProcessWorkOrders,
} from '../src/data/fcs/process-work-order-domain.ts'
import {
  createFactoryPdaUser,
  createPdaSessionFromUser,
  listFactoryPdaUsers,
  updateFactoryPdaUser,
} from '../src/data/fcs/store-domain-pda.ts'
import {
  executeMobileProcessAction,
  getProcessActionOperationRecordsByTask,
} from '../src/data/fcs/process-action-writeback-service.ts'
import {
  assignWaterSolubleFactory,
  executeWaterSolublePdaAction,
  getWaterSolubleCurrentAction,
  getWaterSolubleHandoverQtyUnit,
  getWaterSolubleWorkOrderById,
  linkWaterSolubleHandoverOrder,
  listWaterSolubleWorkOrders,
  markWaterSolubleMaterialReady,
  resetWaterSolubleDomainForChecks,
} from '../src/data/fcs/water-soluble-task-domain.ts'
import type { ProcessTask } from '../src/data/fcs/process-tasks.ts'
import { listPdaGenericProcessTasks } from '../src/data/fcs/pda-task-mock-factory.ts'
import { appStore } from '../src/state/store.ts'

const memoryStorage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => memoryStorage.set(key, value),
    removeItem: (key: string) => memoryStorage.delete(key),
  },
})

class FakeInputElement {
  dataset: Record<string, string> = { pdaExecField: 'searchKeyword' }
  value: string
  constructor(value = '') {
    this.value = value
  }
  closest(selector: string): FakeInputElement | null {
    if (selector === '[data-pda-exec-field]' && this.dataset.pdaExecField) return this
    if (selector === '[data-pda-execd-field]' && this.dataset.pdaExecdField) return this
    return null
  }
}
class FakeSelectElement {}
class FakeTextAreaElement extends FakeInputElement {}
Object.defineProperty(globalThis, 'HTMLInputElement', { configurable: true, value: FakeInputElement })
Object.defineProperty(globalThis, 'HTMLSelectElement', { configurable: true, value: FakeSelectElement })
Object.defineProperty(globalThis, 'HTMLTextAreaElement', { configurable: true, value: FakeTextAreaElement })

function countBy<T>(items: T[], keyOf: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>()
  items.forEach((item) => {
    const key = keyOf(item)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  return counts
}

function assertUnique<T>(items: T[], keyOf: (item: T) => string, message: string): void {
  const duplicates = [...countBy(items, keyOf)].filter(([, count]) => count !== 1)
  assert.deepEqual(duplicates, [], message)
}

async function main(): Promise<void> {
  let lockedUserId = ''
  resetWaterSolubleDomainForChecks({ seedDemo: true })
  try {
    for (const unit of ['公斤', '卷', '米']) {
      assert.equal(getWaterSolubleHandoverQtyUnit(unit), unit, `水溶通用交接必须原样保留 ${unit}，不得转成“打”或成衣件数`)
    }
    const waterOrders = listWaterSolubleWorkOrders()
    assert(waterOrders.length > 0, '确定性 seed 必须包含独立水溶加工单')

    const processOrdersFirst = listProcessWorkOrders()
    const processOrdersSecond = listProcessWorkOrders()
    assert.deepEqual(processOrdersSecond, processOrdersFirst, '统一加工单列表多次读取必须稳定且不得修改 store')
    assertUnique(processOrdersFirst, (order) => order.workOrderId, '统一加工单不得重复映射同一加工单')
    waterOrders.forEach((waterOrder) => {
      const matches = processOrdersFirst.filter((order) => order.workOrderId === waterOrder.waterOrderId)
      assert.equal(matches.length, 1, `独立水溶加工单必须恰好映射一次：${waterOrder.waterOrderId}`)
      const unified = matches[0]
      assert.equal(unified.processType, 'WATER_SOLUBLE')
      assert.deepEqual(unified.sourceDemandIds, waterOrder.sourceDemandIds)
      assert.deepEqual(unified.sourceArtifactIds, [waterOrder.sourceArtifactId])
      assert.deepEqual(unified.productionOrderIds, [waterOrder.productionOrderId])
      assert.equal(unified.workOrderNo, waterOrder.waterOrderNo)
      assert.equal(unified.taskId, waterOrder.taskId)
      assert.equal(unified.taskNo, waterOrder.taskNo)
      assert.equal(unified.materialSku, waterOrder.materialCode)
      assert.equal(unified.materialName, waterOrder.materialName)
      assert.equal(unified.plannedQty, waterOrder.plannedQty)
      assert.equal(unified.plannedUnit, waterOrder.qtyUnit)
      assert.equal(unified.status, waterOrder.status)
      assert.equal(unified.statusLabel.length > 0, true)
      assert.equal(unified.waterSolublePayload?.waterOrderId, waterOrder.waterOrderId)
      assert.equal(unified.waterSolublePayload?.productionOrderNo, waterOrder.productionOrderNo)
      assert.deepEqual(getProcessWorkOrderById(waterOrder.waterOrderId), unified)
    })

    const combinedDyeOrder = listDyeWorkOrders().find((order) => order.requiresWaterSoluble)
    assert(combinedDyeOrder, '必须存在含水溶步骤的染色加工单用于对抗性检查')
    const combinedUnified = getProcessWorkOrderById(combinedDyeOrder.dyeOrderId)
    assert.equal(combinedUnified?.processType, 'DYE', '含水溶染色加工单仍必须是 DYE')
    assert.equal(
      processOrdersFirst.filter((order) => order.workOrderId === combinedDyeOrder.dyeOrderId).length,
      1,
      '含水溶染色加工单不得重复映射为独立水溶加工单',
    )
    const combinedMobileTask = getPdaMobileExecutionTaskById(combinedDyeOrder.taskId)
    assert(combinedMobileTask, '含水溶染色加工单必须保留既有移动任务')
    assert.equal(getMobileTaskProcessType(combinedMobileTask), 'DYE', 'processName 含水溶时仍应优先按显式 DYE 业务字段识别')

    const pdaExecDetailSource = readFileSync('src/pages/pda-exec-detail.ts', 'utf8')
    assert(
      pdaExecDetailSource.includes("window.prompt(`请输入染色投入数量（${getDyeWorkOrderQtyUnit(order)}）`")
        || pdaExecDetailSource.includes("window.prompt(`请输入染色投入数量（${order.qtyUnit}）`"),
      'PDA 开始染色输入提示必须显示当前加工单单位',
    )

    const classificationBase = {
      taskId: 'TASK-CLASSIFY-PROBE',
      taskNo: 'TASK-CLASSIFY-PROBE',
      productionOrderId: 'PO-CLASSIFY-PROBE',
      processNameZh: '未知工序',
    } as ProcessTask
    assert.equal(getMobileTaskProcessType({ ...classificationBase, processBusinessCode: 'DYE', processNameZh: '染色加工（含水溶）' }), 'DYE')
    assert.equal(getMobileTaskProcessType({ ...classificationBase, taskId: waterOrders[0].taskId, processCode: 'UNKNOWN' }), 'WATER_SOLUBLE')
    assert.equal(getMobileTaskProcessType({
      ...classificationBase,
      processCode: 'UNKNOWN',
      coveredProcesses: [{ processCode: 'WATER_SOLUBLE', processName: '水溶', sourceArtifactIds: ['ART-WATER'] }],
    }), 'WATER_SOLUBLE')
    assert.equal(getMobileTaskProcessType({
      ...classificationBase,
      processCode: 'UNKNOWN',
      processNameZh: '连续加工',
      coveredProcesses: [
        { processCode: 'WATER_SOLUBLE', processName: '水溶', sourceArtifactIds: ['ART-WATER'] },
        { processCode: 'DYE', processName: '染色', sourceArtifactIds: ['ART-DYE'] },
      ],
    }), 'DYE', '结构化水溶加染色覆盖必须按联合染色主业务识别为 DYE')
    assert.equal(getMobileTaskProcessType({
      ...classificationBase,
      taskUnitType: 'COMBINED_PROCESS_TASK',
      processBusinessCode: 'DYE',
      processNameZh: '染色加工（含水溶）',
    }), 'DYE')
    assert.equal(getMobileTaskProcessType({
      ...classificationBase,
      taskUnitType: 'COMBINED_PROCESS_TASK',
      processCode: 'UNKNOWN',
      processNameZh: '水溶组合任务',
      coveredProcesses: [
        { processCode: 'WATER_SOLUBLE', processName: '水溶', sourceArtifactIds: ['ART-WATER'] },
        { processCode: 'CUTTING', processName: '裁片', sourceArtifactIds: ['ART-CUTTING'] },
      ],
    }), 'UNKNOWN', '水溶加裁片组合任务不得被文本兜底误判为独立水溶')
    assert.equal(getMobileTaskProcessType({
      ...classificationBase,
      taskUnitType: 'WHOLE_ORDER_TASK',
      processCode: 'UNKNOWN',
      processNameZh: '整单含水溶说明',
    }), 'UNKNOWN', '整单任务不得被水溶文案兜底误判')
    assert.equal(getMobileTaskProcessType({
      ...classificationBase,
      taskUnitType: 'COMBINED_PROCESS_TASK',
      processCode: 'UNKNOWN',
      processNameZh: '水溶连续任务',
      coveredProcesses: [{ processCode: 'UNCLASSIFIED', processName: '待识别', sourceArtifactIds: ['ART-UNKNOWN'] }],
    }), 'UNKNOWN', '未知组合任务不得被水溶文案兜底误判')
    assert.equal(getMobileTaskProcessType(classificationBase), 'UNKNOWN')

    const pdaTasks = listPdaMobileExecutionTasks()
    assertUnique(pdaTasks, (task) => task.taskId, 'PDA 聚合不得重复 taskId')
    const artifactIds = waterOrders.map((order) => order.sourceArtifactId)
    artifactIds.forEach((artifactId) => {
      const consumers = pdaTasks.filter((task) => {
        if ((task as typeof task & { sourceArtifactId?: string }).sourceArtifactId === artifactId) return true
        return task.coveredProcesses?.some((process) => process.sourceArtifactIds.includes(artifactId))
      })
      assert.equal(consumers.length, 1, `独立水溶来源产物必须只被一个 PDA 任务消费：${artifactId}`)
    })

    const waterTasks = listMobileExecutionTasks({ processType: 'WATER_SOLUBLE' })
    const visibleWaterOrders = waterOrders.filter((order) => order.factoryId === 'F090')
    assert.equal(waterTasks.length, visibleWaterOrders.length, 'WATER_SOLUBLE 过滤必须只返回当前默认工厂的独立水溶任务')
    assert(waterTasks.length > 0, 'PDA 执行列表缺少独立水溶任务')
    waterTasks.forEach((task) => assert.equal(getMobileTaskProcessType(task), 'WATER_SOLUBLE'))

    const targetTask = waterTasks[0]
    const targetOrder = waterOrders.find((order) => order.taskId === targetTask.taskId)
    assert(targetOrder, '水溶移动任务必须可回溯领域加工单')
    const source = getMobileExecutionTaskSourceInfo(targetTask)
    assert.equal(source.sourceType, 'WATER_SOLUBLE_WORK_ORDER')
    assert.equal(source.sourceId, targetOrder.waterOrderId)
    assert.equal(source.sourceWorkOrderId, targetOrder.waterOrderId)
    assert.equal(source.sourceWorkOrderNo, targetOrder.waterOrderNo)
    assert.equal(source.workOrderNo, targetOrder.waterOrderNo)
    assert.equal(source.waterSolubleOrderNo, targetOrder.waterOrderNo)
    assert.equal(source.productionOrderNo, targetOrder.productionOrderNo)
    assert.equal(source.materialSku, targetOrder.materialCode)
    assert.equal(source.materialName, targetOrder.materialName)
    assert.equal(source.operationName, '水溶')

    const validBinding = validateProcessMobileTaskBinding({ processType: 'WATER_SOLUBLE', sourceId: targetOrder.waterOrderId })
    assert.equal(validBinding.reasonCode, 'OK', '合法已派厂水溶任务必须通过统一绑定校验')
    assert.equal(validBinding.actualTaskId, targetOrder.taskId)
    assert.equal(validBinding.sourceType, 'WATER_SOLUBLE_WORK_ORDER')
    const invalidWaterBindings = listInvalidProcessMobileTaskBindings({ processType: 'WATER_SOLUBLE' })
    const assignedWaterOrderIds = new Set(waterOrders.filter((order) => order.factoryId).map((order) => order.waterOrderId))
    assert.equal(
      invalidWaterBindings.filter((binding) => assignedWaterOrderIds.has(binding.workOrderId)).length,
      0,
      '真实合法已派厂水溶任务不得进入统一无效绑定列表',
    )
    const unassignedWaterOrder = waterOrders.find((order) => !order.factoryId)
    assert(unassignedWaterOrder, '确定性 seed 必须包含未派厂水溶单')
    assert(
      invalidWaterBindings.some((binding) => binding.workOrderId === unassignedWaterOrder.waterOrderId),
      '未派厂水溶单必须保留在管理校验结果中并明确不可执行',
    )
    const missingBinding = validateProcessMobileTaskBinding({ processType: 'WATER_SOLUBLE', sourceId: 'WATER-FAKE-MISSING' })
    assert.equal(missingBinding.reasonCode, 'SOURCE_OBJECT_MISSING', '伪造水溶来源必须返回明确的来源缺失错误')
    const otherWaterTask = waterTasks.find((task) => task.taskId !== targetTask.taskId)
    assert(otherWaterTask, '确定性 seed 必须提供另一个水溶任务用于 taskId 错配探针')
    const mismatchedTaskBinding = validateProcessMobileTaskBinding({
      processType: 'WATER_SOLUBLE',
      sourceId: targetOrder.waterOrderId,
      taskId: otherWaterTask.taskId,
    })
    assert.equal(mismatchedTaskBinding.reasonCode, 'TASK_NOT_BOUND', '水溶来源绑定错误 taskId 必须明确返回未绑定')
    const missingTaskBinding = validateProcessMobileTaskBinding({
      processType: 'WATER_SOLUBLE',
      sourceId: targetOrder.waterOrderId,
      taskId: 'TASK-WATER-FAKE-MISSING',
    })
    assert.equal(missingTaskBinding.reasonCode, 'TASK_MISSING', '水溶来源指向不存在 taskId 必须返回移动任务不存在')
    const foreignFactoryBinding = validateProcessMobileTaskBinding({
      processType: 'WATER_SOLUBLE',
      sourceId: targetOrder.waterOrderId,
      currentFactoryId: 'FOREIGN-WATER-FACTORY',
    })
    assert.equal(foreignFactoryBinding.reasonCode, 'TASK_FACTORY_MISMATCH', '水溶任务跨厂校验必须返回工厂不一致')

    for (const sourceType of ['WATER_SOLUBLE_WORK_ORDER', 'WATER_SOLUBLE_ORDER']) {
      const filtered = listMobileExecutionTasks({
        currentFactoryId: 'F090',
        processType: 'WATER_SOLUBLE',
        sourceType,
        sourceId: targetOrder.waterOrderId,
      })
      assert.deepEqual(filtered.map((task) => task.taskId), [targetTask.taskId], `${sourceType} 来源过滤必须精确定位水溶任务`)
    }

    for (const keyword of [
      targetTask.taskNo,
      targetOrder.waterOrderNo,
      targetOrder.productionOrderNo,
      targetOrder.materialCode,
      targetOrder.materialName,
      `  ${targetOrder.materialCode.toLowerCase()}  `,
    ]) {
      const located = listMobileExecutionTasks({
        currentFactoryId: 'F090',
        processType: 'WATER_SOLUBLE',
        sourceType: 'WATER_SOLUBLE_ORDER',
        keyword,
      })
      assert(located.some((task) => task.taskId === targetTask.taskId), `关键词必须定位水溶任务：${keyword}`)
    }
    assert.equal(getMobileExecutionTaskById(targetTask.taskId)?.taskId, targetTask.taskId)
    assert.equal(getMobileExecutionTaskByNo(targetTask.taskNo)?.taskId, targetTask.taskId)
    assert.equal(getMobileExecutionTaskBySource('WATER_SOLUBLE_ORDER', targetOrder.waterOrderId)?.taskId, targetTask.taskId)

    assert.equal(
      listMobileExecutionTasks({ currentFactoryId: 'NOT-F090', processType: 'WATER_SOLUBLE' }).length,
      0,
      '独立水溶任务不得跨厂可见',
    )
    waterOrders.filter((order) => !order.factoryId).forEach((order) => {
      assert(!listMobileExecutionTasks({ currentFactoryId: 'F090' }).some((task) => task.taskId === order.taskId), '未派厂水溶任务不得进入工厂可执行列表')
      assert(getMobileExecutionTaskById(order.taskId), '管理索引按 ID 仍应能定位未派厂水溶任务')
    })

    const user = listFactoryPdaUsers('F090').find((item) => item.status === 'ACTIVE')
    assert(user, 'F090 必须有可建立可信 PDA session 的启用用户')
    memoryStorage.set('fcs_pda_session', JSON.stringify(createPdaSessionFromUser(user)))
    appStore.navigate('/fcs/pda/exec?tab=IN_PROGRESS')
    const { handlePdaExecEvent, renderPdaExecPage, renderWaterSolubleCard } = await import('../src/pages/pda-exec.ts')
    const { handlePdaExecDetailEvent, renderPdaExecDetailPage } = await import('../src/pages/pda-exec-detail.ts')
    const { renderPdaHandoverPage } = await import('../src/pages/pda-handover.ts')
    const { renderPdaHandoverDetailPage } = await import('../src/pages/pda-handover-detail.ts')
    const setExecDetailDraftField = (field: string, value: string, textarea = false) => {
      const fieldNode = textarea ? new FakeTextAreaElement(value) : new FakeInputElement(value)
      fieldNode.dataset = { pdaExecdField: field }
      assert.equal(handlePdaExecDetailEvent(fieldNode as unknown as HTMLElement), true, `详情字段 ${field} 必须由真实 handler 消费`)
    }
    const guardedCombinedTask = pdaTasks.find((task) => task.taskUnitType === 'COMBINED_PROCESS_TASK')
    assert(guardedCombinedTask, '真实 PDA 聚合必须包含可验证的组合任务')
    const aggregateCountBeforeGuardProbe = pdaTasks.length
    assert.notEqual(getMobileTaskProcessType(guardedCombinedTask), 'WATER_SOLUBLE', '无独立水溶领域单的真实组合任务不得误判为 WATER_SOLUBLE')
    assert.equal(renderWaterSolubleCard(guardedCombinedTask), '', '无独立水溶领域单时水溶专用 renderer 必须返回空')
    const aggregateAfterGuardProbe = listPdaMobileExecutionTasks()
    assert.equal(aggregateAfterGuardProbe.length, aggregateCountBeforeGuardProbe, '类型兜底不得让 PDA 聚合列表丢任务')
    assert.equal(aggregateAfterGuardProbe.filter((task) => task.taskId === guardedCombinedTask.taskId).length, 1, '真实组合任务必须在 PDA 聚合中保留且不重复')
    const html = renderPdaExecPage()
    assert(html.includes('data-testid="pda-exec-page"'), '必须通过真实 PDA 页面渲染入口输出执行页')
    assert(html.includes('水溶加工单'), '水溶卡片必须显示“水溶加工单”')
    assert(html.includes(targetOrder.materialName) && html.includes(targetOrder.materialCode), '水溶卡片必须显示物料名称和编码')
    assert(html.includes(`${targetOrder.plannedQty.toLocaleString('zh-CN')} ${targetOrder.qtyUnit}`), '水溶卡片必须显示计划量和原 BOM 单位')
    assert(html.includes(getWaterSolubleCurrentAction(targetOrder.waterOrderId)?.actionName || ''), '水溶卡片必须只读显示下一步提示')
    assert(/>\s*查看任务\s*<\/button>/.test(html), '水溶卡片唯一按钮必须是中性“查看任务”')
    assert(!/>\s*上报完成数量\s*<\/button>/.test(html), '水溶列表不得把领域动作伪装成可执行按钮')
    assert(html.includes('placeholder="搜索任务号 / 加工单号 / 生产单号 / 物料"'), '搜索提示必须覆盖物料')
    assert(!html.includes('data-pda-nav="water-soluble"'), '不得新增独立水溶底部导航')

    const pausedOrder = visibleWaterOrders.find((order) => order.status === 'PRODUCTION_PAUSED')
    assert(pausedOrder, '确定性 seed 必须包含生产暂停水溶单')
    appStore.navigate('/fcs/pda/exec?tab=BLOCKED')
    const blockedHtml = renderPdaExecPage()
    assert(blockedHtml.includes(pausedOrder.materialName), '生产暂停 tab 必须展示水溶卡片')
    assert(blockedHtml.includes('生产暂停'), '生产暂停水溶卡片必须明确异常提示')
    assert(blockedHtml.includes('查看主管处理'), '生产暂停水溶卡片必须只读提示主管处理')
    assert(/>\s*查看任务\s*<\/button>/.test(blockedHtml), '生产暂停水溶卡片唯一按钮仍必须是“查看任务”')

    const detailHtml = renderPdaExecDetailPage(targetTask.taskId)
    assert(detailHtml.includes(targetOrder.waterOrderNo), '水溶详情必须显示加工单号')
    assert(detailHtml.includes(targetOrder.materialName) && detailHtml.includes(targetOrder.materialCode), '水溶详情必须显示物料')
    assert(detailHtml.includes(`${targetOrder.plannedQty}`) && detailHtml.includes(targetOrder.qtyUnit), '水溶详情必须显示计划数量原单位')
    assert(detailHtml.includes(`${targetOrder.completedQty}`), '水溶详情必须显示完成数量')
    assert(detailHtml.includes('当前步骤') && detailHtml.includes('现在要做'), '水溶详情必须显示当前步骤和当前动作')
    assert(detailHtml.includes('data-testid="pda-water-soluble-detail"'), '水溶详情必须进入真实执行版详情')
    assert(detailHtml.includes('data-pda-execd-action="water-complete"'), '水溶中详情必须只显示完成水溶主动作')
    assert.equal((detailHtml.match(/data-water-primary-action="true"/g) || []).length, 1, '水溶详情首屏必须只有一个主动作')
    assert(!detailHtml.includes('data-pda-execd-action="finish-task"'), '水溶详情不得渲染通用完工动作')

    const beforeInjectedFinish = getWaterSolubleWorkOrderById(targetOrder.waterOrderId)
    const injectedFinishNode = { dataset: { pdaExecdAction: 'finish-task', taskId: targetTask.taskId } }
    const injectedFinishTarget = {
      closest: (selector: string) => selector === '[data-pda-execd-action]' ? injectedFinishNode : null,
    } as unknown as HTMLElement
    assert.equal(handlePdaExecDetailEvent(injectedFinishTarget), true, '水溶通用完工注入必须被详情 handler 消费并拒绝')
    assert.deepEqual(getWaterSolubleWorkOrderById(targetOrder.waterOrderId), beforeInjectedFinish, '水溶通用完工注入不得修改领域单或日志')

    const listNode = { innerHTML: '旧列表' }
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        querySelector: (selector: string) => selector === '[data-testid="pda-exec-card-list"]' ? listNode : null,
      },
    })
    const input = new FakeInputElement(pausedOrder.materialCode)
    assert.equal(handlePdaExecEvent(input as unknown as HTMLElement), false, '搜索输入必须由 PDA 页面局部处理')
    assert.notEqual(listNode.innerHTML, '旧列表', '搜索输入必须局部刷新卡片列表')
    assert(listNode.innerHTML.includes(pausedOrder.materialCode), '局部搜索结果必须保留目标水溶任务')
    assert.equal(input.value, pausedOrder.materialCode, '局部搜索不得丢失输入值')

    const escapedOrder = visibleWaterOrders[0]
    const maliciousCard = renderWaterSolubleCard(targetTask, {
      ...escapedOrder,
      materialName: '<img src=x onerror=alert(1)>',
      materialCode: '<script>alert(2)</script>',
      qtyUnit: '<svg onload=alert(3)>',
    })
    assert(!maliciousCard.includes('<script') && !maliciousCard.includes('<img') && !maliciousCard.includes('<svg'), '水溶卡片可控恶意业务字段必须真实转义')
    assert(maliciousCard.includes('&lt;script&gt;') && maliciousCard.includes('&lt;img'), '水溶卡片必须保留转义后的可读文本')
    assert(escapedOrder.qtyUnit.length > 0, '原 BOM 单位不得丢失')

    const operatorUser = listFactoryPdaUsers(targetOrder.factoryId || '').find((item) => item.status === 'ACTIVE' && item.roleId === 'ROLE_OPERATOR')
    const supervisorUser = listFactoryPdaUsers(targetOrder.factoryId || '').find((item) =>
      item.status === 'ACTIVE' && ['ROLE_PRODUCTION', 'ROLE_ADMIN'].includes(item.roleId),
    )
    assert(operatorUser && supervisorUser, '必须动态取得本厂操作员和生产主管账号')
    const operator = createPdaSessionFromUser(operatorUser)
    const supervisor = createPdaSessionFromUser(supervisorUser)
    const handoverUser = listFactoryPdaUsers(targetOrder.factoryId || '').find((item) => item.status === 'ACTIVE' && item.roleId === 'ROLE_HANDOVER')
      || await createFactoryPdaUser({
        factoryId: targetOrder.factoryId || '',
        name: '水溶专项交接员',
        loginId: `${targetOrder.factoryId || 'factory'}_water_handover_check`,
        password: '123456',
        roleId: 'ROLE_HANDOVER',
        createdBy: '水溶专项检查',
      })
    const handoverActor = createPdaSessionFromUser(handoverUser)

    resetWaterSolubleDomainForChecks({ seedDemo: false })
    const executableOrder = listWaterSolubleWorkOrders()[0]
    assert(executableOrder, '必须存在可准备为待水溶的独立水溶加工单')
    assert.equal(assignWaterSolubleFactory(executableOrder.waterOrderId, operator.factoryId).ok, true)
    assert.equal(markWaterSolubleMaterialReady(executableOrder.waterOrderId).ok, true)
    assert.equal(getWaterSolubleCurrentAction(executableOrder)?.actionCode, 'START')
    assert.throws(
      () => ensureHandoverOrderForStartedTask(executableOrder.taskId),
      /待交出|不能创建交出单/,
      '独立水溶未到待交出时不得创建通用交出单',
    )
    assert.equal(listHandoverOrdersByTaskId(executableOrder.taskId).length, 0)

    memoryStorage.set('fcs_pda_session', JSON.stringify(operator))
    appStore.navigate(`/fcs/pda/exec/${encodeURIComponent(executableOrder.taskId)}`)
    const offlineStartHtml = renderPdaExecDetailPage(executableOrder.taskId)
    const offlineStartToken = offlineStartHtml.match(/data-pda-execd-action="water-start"[\s\S]{0,700}?data-action-token="([^"]+)"/)
    assert(offlineStartToken, '待水溶详情必须生成可校验的开始水溶动作令牌')
    const offlineStartNode = {
      dataset: {
        pdaExecdAction: 'water-start',
        orderId: executableOrder.waterOrderId,
        taskId: executableOrder.taskId,
        expectedStatus: 'WAIT_WATER_SOLUBLE',
        actionToken: offlineStartToken[1],
      },
      disabled: false,
      isConnected: true,
      textContent: '开始水溶',
    }
    const offlineStartTarget = {
      closest: (selector: string) => selector === '[data-pda-execd-action]' ? offlineStartNode : null,
    } as unknown as HTMLElement
    const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    const beforeOfflineHandler = getWaterSolubleWorkOrderById(executableOrder.waterOrderId)!
    const offlineHeadCount = listHandoverOrdersByTaskId(executableOrder.taskId).length
    try {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } })
      assert.equal(handlePdaExecDetailEvent(offlineStartTarget), true, 'PDA 详情 handler 必须消费离线开始动作')
      assert.deepEqual(
        getWaterSolubleWorkOrderById(executableOrder.waterOrderId),
        beforeOfflineHandler,
        '真实 handler 离线失败不得修改状态、数量、原因、时间或日志',
      )
      assert.equal(listHandoverOrdersByTaskId(executableOrder.taskId).length, offlineHeadCount, '真实 handler 离线失败不得生成交接单头或记录')

      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } })
      assert.equal(handlePdaExecDetailEvent(offlineStartTarget), true, '恢复在线后必须可用同一动作和令牌直接重试')
      const afterOnlineHandlerRetry = getWaterSolubleWorkOrderById(executableOrder.waterOrderId)!
      assert.equal(afterOnlineHandlerRetry.status, 'WATER_SOLUBLE_IN_PROGRESS')
      assert.equal(afterOnlineHandlerRetry.completedQty, beforeOfflineHandler.completedQty)
      assert.equal(afterOnlineHandlerRetry.actionLogs.length, beforeOfflineHandler.actionLogs.length + 1, '在线重试只能新增一条开始水溶日志')
      assert.equal(afterOnlineHandlerRetry.actionLogs.at(-1)?.action, '开始水溶')
      assert.equal(listHandoverOrdersByTaskId(executableOrder.taskId).length, offlineHeadCount)

      assert.equal(handlePdaExecDetailEvent(offlineStartTarget), true, '旧令牌重复请求必须由 handler 消费并拒绝')
      assert.deepEqual(getWaterSolubleWorkOrderById(executableOrder.waterOrderId), afterOnlineHandlerRetry, '旧令牌重复请求不得二次写日志或加工单记录')
      assert.equal(listHandoverOrdersByTaskId(executableOrder.taskId).length, offlineHeadCount, '旧令牌重复请求不得生成交接记录')
    } finally {
      if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor)
      else Reflect.deleteProperty(globalThis, 'navigator')
    }

    resetWaterSolubleDomainForChecks({ seedDemo: false })
    assert.equal(assignWaterSolubleFactory(executableOrder.waterOrderId, operator.factoryId).ok, true)
    assert.equal(markWaterSolubleMaterialReady(executableOrder.waterOrderId).ok, true)

    memoryStorage.delete('fcs_pda_session')
    const beforeNoSession = getWaterSolubleWorkOrderById(executableOrder.waterOrderId)
    const noSessionStart = executeWaterSolublePdaAction({
      action: 'START',
      orderId: executableOrder.waterOrderId,
      taskId: executableOrder.taskId,
      expectedStatus: 'WAIT_WATER_SOLUBLE',
      expectedNode: 'START',
      actor: operator,
    })
    assert.equal(noSessionStart.ok, false, '没有当前真实 session 时启用用户对象也不能替代登录身份')
    assert.deepEqual(getWaterSolubleWorkOrderById(executableOrder.waterOrderId), beforeNoSession, '无 session 拒绝不得修改领域')
    memoryStorage.set('fcs_pda_session', JSON.stringify(operator))

    const foreignActor = { ...operator, factoryId: 'FOREIGN-FACTORY', factoryName: '其他工厂' }
    const foreignStart = executeWaterSolublePdaAction({
      action: 'START',
      orderId: executableOrder.waterOrderId,
      taskId: executableOrder.taskId,
      expectedStatus: 'WAIT_WATER_SOLUBLE',
      expectedNode: 'START',
      actor: foreignActor,
    })
    assert.equal(foreignStart.ok, false)
    assert.match(foreignStart.message, /登录信息已变化|不属于当前工厂/)

    memoryStorage.set('fcs_pda_session', JSON.stringify(supervisor))
    const beforeStaleActor = getWaterSolubleWorkOrderById(executableOrder.waterOrderId)
    assert.equal(executeWaterSolublePdaAction({ action: 'START', orderId: executableOrder.waterOrderId, taskId: executableOrder.taskId, expectedStatus: 'WAIT_WATER_SOLUBLE', expectedNode: 'START', actor: operator }).ok, false, '切换 session 后旧 actor 必须失效')
    assert.equal(executeWaterSolublePdaAction({ action: 'START', orderId: executableOrder.waterOrderId, taskId: executableOrder.taskId, expectedStatus: 'WAIT_WATER_SOLUBLE', expectedNode: 'START', actor: supervisor }).ok, false, '生产主管或管理员不得执行普通水溶动作')
    assert.deepEqual(getWaterSolubleWorkOrderById(executableOrder.waterOrderId), beforeStaleActor, '旧 actor 拒绝不得修改领域')

    memoryStorage.set('fcs_pda_session', JSON.stringify(operator))
    lockedUserId = operatorUser.userId
    updateFactoryPdaUser(lockedUserId, { status: 'LOCKED', updatedBy: '水溶专项检查' })
    const beforeLockedActor = getWaterSolubleWorkOrderById(executableOrder.waterOrderId)
    assert.equal(executeWaterSolublePdaAction({ action: 'START', orderId: executableOrder.waterOrderId, taskId: executableOrder.taskId, expectedStatus: 'WAIT_WATER_SOLUBLE', expectedNode: 'START', actor: operator }).ok, false, '锁定用户必须拒绝')
    assert.deepEqual(getWaterSolubleWorkOrderById(executableOrder.waterOrderId), beforeLockedActor, '锁定用户拒绝不得修改领域')
    updateFactoryPdaUser(lockedUserId, { status: 'ACTIVE', updatedBy: '水溶专项检查恢复' })
    memoryStorage.set('fcs_pda_session', JSON.stringify(operator))

    const wrongTaskStart = executeWaterSolublePdaAction({
      action: 'START',
      orderId: executableOrder.waterOrderId,
      taskId: 'TASK-WATER-WRONG',
      expectedStatus: 'WAIT_WATER_SOLUBLE',
      expectedNode: 'START',
      actor: operator,
    })
    assert.equal(wrongTaskStart.ok, false)
    assert.match(wrongTaskStart.message, /任务.*不一致/)
    const wrongNodeStart = executeWaterSolublePdaAction({
      action: 'START',
      orderId: executableOrder.waterOrderId,
      taskId: executableOrder.taskId,
      expectedStatus: 'WAIT_WATER_SOLUBLE',
      expectedNode: 'COMPLETE',
      actor: operator,
    })
    assert.equal(wrongNodeStart.ok, false)
    assert.match(wrongNodeStart.message, /当前动作.*不一致/)

    const retryStartInput = {
      action: 'START',
      orderId: executableOrder.waterOrderId,
      taskId: executableOrder.taskId,
      expectedStatus: 'WAIT_WATER_SOLUBLE',
      expectedNode: 'START',
      actor: operator,
    } as const
    const beforeSessionLoss = getWaterSolubleWorkOrderById(executableOrder.waterOrderId)!
    const handoverHeadCountBeforeRetry = listHandoverOrdersByTaskId(executableOrder.taskId).length
    memoryStorage.delete('fcs_pda_session')
    const sessionLossFailure = executeWaterSolublePdaAction(retryStartInput)
    assert.equal(sessionLossFailure.ok, false, '会话暂失时，本次开始水溶必须可安全失败')
    assert.match(sessionLossFailure.message, /登录|身份/, '会话暂失失败必须给出中文身份修复提示')
    assert.deepEqual(
      getWaterSolubleWorkOrderById(executableOrder.waterOrderId),
      beforeSessionLoss,
      '会话暂失失败不得修改加工单状态、数量、原因、时间或日志',
    )
    assert.equal(
      listHandoverOrdersByTaskId(executableOrder.taskId).length,
      handoverHeadCountBeforeRetry,
      '会话暂失失败不得生成交接单头或记录',
    )

    memoryStorage.set('fcs_pda_session', JSON.stringify(operator))
    const retriedStart = executeWaterSolublePdaAction(retryStartInput)
    assert.equal(retriedStart.ok, true, '恢复同一 session 后，同 order/action/输入重试必须成功')
    const afterRetrySuccess = getWaterSolubleWorkOrderById(executableOrder.waterOrderId)!
    assert.equal(afterRetrySuccess.status, 'WATER_SOLUBLE_IN_PROGRESS')
    assert.equal(afterRetrySuccess.completedQty, beforeSessionLoss.completedQty, '开始水溶不得改写完成数量')
    assert.equal(afterRetrySuccess.exceptionReason, beforeSessionLoss.exceptionReason, '开始水溶不得改写异常原因')
    assert.equal(
      afterRetrySuccess.actionLogs.length,
      beforeSessionLoss.actionLogs.length + 1,
      '会话恢复后重试成功必须只新增一条开始水溶日志',
    )
    assert.equal(afterRetrySuccess.actionLogs.at(-1)?.action, '开始水溶')
    assert.equal(
      listHandoverOrdersByTaskId(executableOrder.taskId).length,
      handoverHeadCountBeforeRetry,
      '开始水溶成功仍不得提前生成交接单头或记录',
    )

    const duplicateStart = executeWaterSolublePdaAction(retryStartInput)
    assert.equal(duplicateStart.ok, false, '同一请求再次到达必须由幂等状态门槛拒绝')
    assert.match(duplicateStart.message, /已经处理|已失效|当前状态/, '重复请求必须返回中文状态门槛提示')
    assert.deepEqual(
      getWaterSolubleWorkOrderById(executableOrder.waterOrderId),
      afterRetrySuccess,
      '重复请求不得追加第二条日志或改写加工单记录',
    )
    assert.equal(
      listHandoverOrdersByTaskId(executableOrder.taskId).length,
      handoverHeadCountBeforeRetry,
      '重复请求不得生成交接单头或记录',
    )

    const runningWaterHtml = renderPdaExecDetailPage(executableOrder.taskId)
    const waterCompleteToken = runningWaterHtml.match(/data-pda-execd-action="water-complete"[\s\S]{0,1200}?data-action-token="([^"]+)"/)
    assert(waterCompleteToken, '水溶中详情必须提供真实完成动作令牌')
    const openWaterCompletionNode = {
      dataset: {
        pdaExecdAction: 'water-complete',
        orderId: executableOrder.waterOrderId,
        taskId: executableOrder.taskId,
        expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS',
        actionToken: waterCompleteToken[1],
      },
    }
    assert.equal(handlePdaExecDetailEvent({ closest: (selector: string) => selector === '[data-pda-execd-action]' ? openWaterCompletionNode : null } as unknown as HTMLElement), true)
    const waterCompletionOverlayHtml = renderPdaExecDetailPage(executableOrder.taskId)
    const waterCompletionOverlayToken = waterCompletionOverlayHtml.match(/data-pda-execd-action="water-confirm-completion"[\s\S]{0,1200}?data-overlay-token="([^"]+)"/)
    assert(waterCompletionOverlayToken, '独立水溶完成弹层必须生成真实确认令牌')
    setExecDetailDraftField('waterCompletedQty', '0')
    setExecDetailDraftField('waterReason', '', true)
    const confirmWaterCompletionNode = {
      dataset: {
        pdaExecdAction: 'water-confirm-completion',
        orderId: executableOrder.waterOrderId,
        taskId: executableOrder.taskId,
        expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS',
        overlayToken: waterCompletionOverlayToken[1],
      },
      disabled: false,
      isConnected: true,
      textContent: '确认完成',
    }
    const confirmWaterCompletionTarget = { closest: (selector: string) => selector === '[data-pda-execd-action]' ? confirmWaterCompletionNode : null } as unknown as HTMLElement
    assert.equal(handlePdaExecDetailEvent(confirmWaterCompletionTarget), true)
    assert.equal(getWaterSolubleWorkOrderById(executableOrder.waterOrderId)?.status, 'WATER_SOLUBLE_IN_PROGRESS', '独立水溶 0 无原因必须由真实 handler 阻断')
    setExecDetailDraftField('waterReason', '本批物料全部不可用', true)
    assert.equal(handlePdaExecDetailEvent(confirmWaterCompletionTarget), true)
    assert.equal(getWaterSolubleWorkOrderById(executableOrder.waterOrderId)?.status, 'PRODUCTION_PAUSED', '独立水溶 0 有原因必须经真实 handler 进入生产暂停')

    resetWaterSolubleDomainForChecks({ seedDemo: false })
    assert.equal(assignWaterSolubleFactory(executableOrder.waterOrderId, operator.factoryId).ok, true)
    assert.equal(markWaterSolubleMaterialReady(executableOrder.waterOrderId).ok, true)
    assert.equal(executeWaterSolublePdaAction(retryStartInput).ok, true)

    const missingReason = executeWaterSolublePdaAction({
      action: 'COMPLETE',
      orderId: executableOrder.waterOrderId,
      taskId: executableOrder.taskId,
      expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS',
      expectedNode: 'COMPLETE',
      completedQty: executableOrder.plannedQty - 1,
      reason: '',
      actor: operator,
    })
    assert.equal(missingReason.ok, false)
    assert.match(missingReason.message, /填写原因/)
    const shortage = executeWaterSolublePdaAction({
      action: 'COMPLETE',
      orderId: executableOrder.waterOrderId,
      taskId: executableOrder.taskId,
      expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS',
      expectedNode: 'COMPLETE',
      completedQty: executableOrder.plannedQty - 1,
      reason: '现场实测原料不足',
      actor: operator,
    })
    assert.equal(shortage.ok, true)
    assert.equal(shortage.order?.status, 'PRODUCTION_PAUSED')
    const operatorResolve = executeWaterSolublePdaAction({
      action: 'RESOLVE_PAUSE',
      orderId: executableOrder.waterOrderId,
      taskId: executableOrder.taskId,
      expectedStatus: 'PRODUCTION_PAUSED',
      expectedNode: 'SUPERVISOR',
      decision: 'CONTINUE_WITH_ACTUAL_QTY',
      actor: operator,
    })
    assert.equal(operatorResolve.ok, false)
    assert.match(operatorResolve.message, /主管/)
    memoryStorage.set('fcs_pda_session', JSON.stringify(supervisor))
    assert.equal(executeWaterSolublePdaAction({
      action: 'RESOLVE_PAUSE',
      orderId: executableOrder.waterOrderId,
      taskId: executableOrder.taskId,
      expectedStatus: 'PRODUCTION_PAUSED',
      expectedNode: 'SUPERVISOR',
      decision: 'CONTINUE_WITH_ACTUAL_QTY',
      actor: supervisor,
    }).ok, true)
    const approvedOrder = getWaterSolubleWorkOrderById(executableOrder.waterOrderId)!
    memoryStorage.set('fcs_pda_session', JSON.stringify(handoverActor))
    const wrapperBypass = executeWaterSolublePdaAction({ action: 'HANDOVER', orderId: executableOrder.waterOrderId, taskId: executableOrder.taskId, expectedStatus: 'WAIT_HANDOVER', expectedNode: 'HANDOVER', handoverQty: approvedOrder.handoverQty!, actor: handoverActor })
    assert.equal(wrapperBypass.ok, false, 'actor wrapper 也不得绕过通用交接事件直接交出')
    assert.match(wrapperBypass.message, /通用交接单/)
    appStore.navigate(`/fcs/pda/exec/${encodeURIComponent(executableOrder.taskId)}`)
    const waitHandoverDetail = renderPdaExecDetailPage(executableOrder.taskId)
    const goHandoverButton = waitHandoverDetail.match(/data-pda-execd-action="water-go-handover"[\s\S]{0,1200}?data-action-token="([^"]+)"/)
    assert(goHandoverButton, '合法交接员必须在独立水溶详情看到唯一“去交出”动作')
    const goHandoverNode = {
      dataset: {
        pdaExecdAction: 'water-go-handover',
        orderId: executableOrder.waterOrderId,
        taskId: executableOrder.taskId,
        expectedStatus: 'WAIT_HANDOVER',
        actionToken: goHandoverButton[1],
      },
    }
    const goHandoverTarget = { closest: (selector: string) => selector === '[data-pda-execd-action]' ? goHandoverNode : null } as unknown as HTMLElement
    assert.equal(handlePdaExecDetailEvent(goHandoverTarget), true)
    const ensuredWaterHandover = ensureHandoverOrderForStartedTask(executableOrder.taskId)
    assert.match(appStore.getState().pathname, new RegExp(`/fcs/pda/handover/${ensuredWaterHandover.handoverOrderId}\\?action=new-record$`), '去交出必须精确打开唯一通用交出单')
    const repeatedWaterHandover = ensureHandoverOrderForStartedTask(executableOrder.taskId)
    assert.equal(ensuredWaterHandover.created, false, '页面 handler 已负责首次创建通用交出单')
    assert.equal(repeatedWaterHandover.created, false)
    assert.equal(repeatedWaterHandover.handoverOrderId, ensuredWaterHandover.handoverOrderId)
    assert.equal(listHandoverOrdersByTaskId(executableOrder.taskId).length, 1, '重复 ensure 只能保留一张通用交出单')
    const waterHandoverHead = getHandoverOrderById(ensuredWaterHandover.handoverOrderId)!
    assert.equal(waterHandoverHead.sourceBusinessType, 'WATER_SOLUBLE_WORK_ORDER')
    assert.equal(waterHandoverHead.sourceDocId, executableOrder.waterOrderId)
    assert.equal(waterHandoverHead.productionOrderNo, executableOrder.productionOrderNo)
    assert.equal(waterHandoverHead.materialCode, executableOrder.materialCode)
    assert.equal(waterHandoverHead.materialName, executableOrder.materialName)
    assert.equal(waterHandoverHead.qtyExpectedTotal, approvedOrder.handoverQty)
    assert.equal(waterHandoverHead.qtyUnit, executableOrder.qtyUnit, '通用交接必须保留原 BOM 单位')
    assert.equal(getWaterSolubleWorkOrderById(executableOrder.waterOrderId)?.handoverOrderId, ensuredWaterHandover.handoverOrderId, 'ensure 必须由领域层回写唯一交出单 ID')
    assert(['AUTO_CREATED', 'OPEN'].includes(waterHandoverHead.handoverOrderStatus ?? ''), 'ensure 后交出单头必须处于合法待交出初态')
    const linkedOrderSnapshot = getWaterSolubleWorkOrderById(executableOrder.waterOrderId)
    assert.equal(linkWaterSolubleHandoverOrder(executableOrder.waterOrderId, executableOrder.taskId, ensuredWaterHandover.handoverOrderId).ok, true, '同一交出单 ID 重复关联必须幂等')
    assert.deepEqual(getWaterSolubleWorkOrderById(executableOrder.waterOrderId), linkedOrderSnapshot, '幂等关联不得追加日志或修改时间')
    assert.equal(linkWaterSolubleHandoverOrder(executableOrder.waterOrderId, `${executableOrder.taskId}-OTHER`, ensuredWaterHandover.handoverOrderId).ok, false, '跨任务关联必须拒绝')
    assert.equal(linkWaterSolubleHandoverOrder(executableOrder.waterOrderId, executableOrder.taskId, `${ensuredWaterHandover.handoverOrderId}-OTHER`).ok, false, '已关联订单不得改绑到另一张交出单')
    assert.deepEqual(getWaterSolubleWorkOrderById(executableOrder.waterOrderId), linkedOrderSnapshot, '关联失败必须保持水溶单原子不变')
    assert.equal(listHandoverOrdersByTaskId(executableOrder.taskId).length, 1, '关联失败不得新增交出单头')
    appStore.navigate('/fcs/pda/handover?tab=handout')
    const handoverListHtml = renderPdaHandoverPage()
    assert(handoverListHtml.includes('水溶加工单'))
    assert(handoverListHtml.includes(executableOrder.materialName) && handoverListHtml.includes(executableOrder.materialCode))
    assert(handoverListHtml.includes(`${approvedOrder.handoverQty}`) && handoverListHtml.includes(executableOrder.qtyUnit))
    appStore.navigate(`/fcs/pda/handover/${ensuredWaterHandover.handoverOrderId}`)
    const handoverDetailHtml = renderPdaHandoverDetailPage(ensuredWaterHandover.handoverOrderId)
    assert(handoverDetailHtml.includes('水溶加工单'))
    assert(handoverDetailHtml.includes(executableOrder.materialName) && handoverDetailHtml.includes(executableOrder.materialCode))
    assert(handoverDetailHtml.includes('计划交出') && handoverDetailHtml.includes(executableOrder.qtyUnit))
    assert(handoverDetailHtml.includes(`计划交出物料数量（${executableOrder.qtyUnit}）`), '物料数量标签必须保留原 BOM 中文单位，不得改写为通用 m / 打 / 件')
    assert(handoverDetailHtml.includes(`${approvedOrder.handoverQty} ${executableOrder.qtyUnit}`), '计划交出数量必须使用原 BOM 单位')
    assert(handoverDetailHtml.includes('交出物类型：物料'), '独立水溶交出对象必须是物料，不能伪装为面料或成衣')
    assert(!handoverDetailHtml.includes('data-pda-handoverd-field="newRecordUnit"'), '水溶交出单位必须只读，不得渲染可编辑单位输入框')
    const beforeForgedUnit = getWaterSolubleWorkOrderById(executableOrder.waterOrderId)
    assert.throws(() => createFactoryHandoverRecord({
      handoverOrderId: ensuredWaterHandover.handoverOrderId,
      submittedQty: approvedOrder.handoverQty!,
      qtyUnit: '打',
      factorySubmittedAt: '2026-07-11 11:59:00',
      factorySubmittedBy: handoverActor.userName,
      actor: handoverActor,
      scanCode: executableOrder.materialCode,
    }), /原 BOM 单位|单位/)
    assert.deepEqual(getWaterSolubleWorkOrderById(executableOrder.waterOrderId), beforeForgedUnit, '伪造单位失败不得修改水溶领域')
    assert.equal(getPdaHandoverRecordsByHead(waterHandoverHead.handoverId).length, 0, '伪造单位失败不得生成通用交出记录')
    assert.throws(() => createFactoryHandoverRecord({
      handoverOrderId: ensuredWaterHandover.handoverOrderId,
      submittedQty: (approvedOrder.handoverQty ?? 0) - 1,
      factorySubmittedAt: '2026-07-11 12:00:00',
      factorySubmittedBy: handoverActor.userName,
      actor: handoverActor,
      scanCode: executableOrder.materialCode,
    }), /批准数量|部分交出/)
    const waterRecord = createFactoryHandoverRecord({
      handoverOrderId: ensuredWaterHandover.handoverOrderId,
      submittedQty: approvedOrder.handoverQty!,
      factorySubmittedAt: '2026-07-11 12:01:00',
      factorySubmittedBy: handoverActor.userName,
      actor: handoverActor,
      scanCode: executableOrder.materialCode,
    })
    assert.equal(waterRecord.qtyUnit, executableOrder.qtyUnit, '合法交出记录必须强制使用原 BOM 单位')
    assert.equal(getWaterSolubleWorkOrderById(executableOrder.waterOrderId)?.status, 'HANDOVER_WAIT_RECEIVE')
    const submittedWaterHead = getHandoverOrderById(ensuredWaterHandover.handoverOrderId)!
    assert.equal(submittedWaterHead.completionStatus, 'COMPLETED', '独立水溶单生成唯一交出记录后，交出方必须自动完成单头')
    assert.equal(submittedWaterHead.factoryMarkedComplete, true)
    assert.equal(submittedWaterHead.handoverOrderStatus, 'WAIT_RECEIVER_WRITEBACK')
    assert.equal(submittedWaterHead.submittedQtyTotal, approvedOrder.handoverQty)
    assert(!renderPdaHandoverDetailPage(ensuredWaterHandover.handoverOrderId).includes('data-pda-handoverd-action="complete-handout-head"'), '独立水溶单不得再出现隐藏的“完成交出单”动作')
    assert.throws(() => createFactoryHandoverRecord({
      handoverOrderId: ensuredWaterHandover.handoverOrderId,
      submittedQty: approvedOrder.handoverQty!,
      factorySubmittedAt: '2026-07-11 12:02:00',
      factorySubmittedBy: handoverActor.userName,
      actor: handoverActor,
      scanCode: executableOrder.materialCode,
    }), /已交出|重复|已完成/)
    const beforeInvalidWritebackOrder = getWaterSolubleWorkOrderById(executableOrder.waterOrderId)
    const beforeInvalidWritebackHead = getHandoverOrderById(ensuredWaterHandover.handoverOrderId)
    const beforeInvalidWritebackRecords = getPdaHandoverRecordsByHead(ensuredWaterHandover.handoverOrderId)
    for (const invalidQty of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      assert.throws(() => writeBackHandoverRecord({
        handoverRecordId: waterRecord.recordId,
        receiverWrittenQty: invalidQty,
        receiverWrittenAt: '2026-07-11 12:09:00',
        receiverWrittenBy: '接收方扫码员',
      }), /大于或等于 0 的有限数字/)
      assert.deepEqual(getWaterSolubleWorkOrderById(executableOrder.waterOrderId), beforeInvalidWritebackOrder, '非法实收数量失败不得修改水溶单')
      assert.deepEqual(getHandoverOrderById(ensuredWaterHandover.handoverOrderId), beforeInvalidWritebackHead, '非法实收数量失败不得修改交出单头')
      assert.deepEqual(getPdaHandoverRecordsByHead(ensuredWaterHandover.handoverOrderId), beforeInvalidWritebackRecords, '非法实收数量失败不得修改交出记录')
    }
    const waterWriteback = writeBackHandoverRecord({
      handoverRecordId: waterRecord.recordId,
      receiverWrittenQty: 0,
      receiverWrittenAt: '2026-07-11 12:10:00',
      receiverWrittenBy: '接收方扫码员',
      diffReason: '现场复点实收为零',
    })
    const zeroReceiptOrder = getWaterSolubleWorkOrderById(executableOrder.waterOrderId)!
    assert.equal(zeroReceiptOrder.status, 'RECEIPT_DIFFERENCE')
    assert.equal(zeroReceiptOrder.receivedQty, 0)
    assert.match(zeroReceiptOrder.actionLogs.at(-1)?.detail ?? '', new RegExp(`实际收货 0 ${executableOrder.qtyUnit}`))
    assert.equal(waterWriteback.receiverWrittenQty, 0)
    const differenceWaterHead = getHandoverOrderById(ensuredWaterHandover.handoverOrderId)!
    assert.equal(differenceWaterHead.completionStatus, 'COMPLETED')
    assert.equal(differenceWaterHead.handoverOrderStatus, 'DIFF_WAIT_FACTORY_CONFIRM')
    assert.equal(differenceWaterHead.writtenBackQtyTotal, 0)
    const beforeRepeatedWriteback = {
      order: getWaterSolubleWorkOrderById(executableOrder.waterOrderId),
      head: getHandoverOrderById(ensuredWaterHandover.handoverOrderId),
      records: getPdaHandoverRecordsByHead(ensuredWaterHandover.handoverOrderId),
    }
    assert.throws(() => writeBackHandoverRecord({
      handoverRecordId: waterRecord.recordId,
      receiverWrittenQty: 0,
      receiverWrittenAt: '2026-07-11 12:11:00',
      receiverWrittenBy: '接收方扫码员',
    }), /已经处理|当前状态|确认收货/)
    assert.deepEqual({
      order: getWaterSolubleWorkOrderById(executableOrder.waterOrderId),
      head: getHandoverOrderById(ensuredWaterHandover.handoverOrderId),
      records: getPdaHandoverRecordsByHead(ensuredWaterHandover.handoverOrderId),
    }, beforeRepeatedWriteback, '重复回写不得产生任何副作用')
    assert(acceptHandoverRecordDiff(waterWriteback.recordId), '主管必须可通过通用差异确认完成水溶单')
    assert.equal(getWaterSolubleWorkOrderById(executableOrder.waterOrderId)?.status, 'DONE')
    const acceptedWaterHead = getHandoverOrderById(ensuredWaterHandover.handoverOrderId)!
    assert.equal(acceptedWaterHead.completionStatus, 'COMPLETED')
    assert.equal(acceptedWaterHead.handoverOrderStatus, 'CLOSED')
    assert(acceptedWaterHead.receiverClosedAt, '主管接受差异后交出单头必须记录接收闭环时间')
    const beforeRepeatedAccept = {
      order: getWaterSolubleWorkOrderById(executableOrder.waterOrderId),
      head: getHandoverOrderById(ensuredWaterHandover.handoverOrderId),
      records: getPdaHandoverRecordsByHead(ensuredWaterHandover.handoverOrderId),
    }
    assert.equal(acceptHandoverRecordDiff(waterWriteback.recordId), null)
    assert.deepEqual({
      order: getWaterSolubleWorkOrderById(executableOrder.waterOrderId),
      head: getHandoverOrderById(ensuredWaterHandover.handoverOrderId),
      records: getPdaHandoverRecordsByHead(ensuredWaterHandover.handoverOrderId),
    }, beforeRepeatedAccept, '重复接受差异不得产生任何副作用')
    memoryStorage.set('fcs_pda_session', JSON.stringify(operator))
    assert.equal(executeWaterSolublePdaAction({
      action: 'HANDOVER',
      orderId: executableOrder.waterOrderId,
      taskId: executableOrder.taskId,
      expectedStatus: 'WAIT_HANDOVER',
      expectedNode: 'HANDOVER',
      handoverQty: executableOrder.plannedQty - 1,
      actor: operator,
    }).ok, false)
    memoryStorage.set('fcs_pda_session', JSON.stringify(supervisor))
    const handoverResult = executeWaterSolublePdaAction({
      action: 'HANDOVER',
      orderId: executableOrder.waterOrderId,
      taskId: executableOrder.taskId,
      expectedStatus: 'WAIT_HANDOVER',
      expectedNode: 'HANDOVER',
      handoverQty: executableOrder.plannedQty - 1,
      actor: supervisor,
    })
    assert.equal(handoverResult.ok, false, '页面或 PDA actor wrapper 不得绕过通用交接重复写领域')

    const handoverRoleOrder = listWaterSolubleWorkOrders().find((item) => item.waterOrderId !== executableOrder.waterOrderId)
    assert(handoverRoleOrder, '必须存在第二张独立水溶单验证交接角色')
    assert.equal(assignWaterSolubleFactory(handoverRoleOrder.waterOrderId, operator.factoryId).ok, true)
    assert.equal(markWaterSolubleMaterialReady(handoverRoleOrder.waterOrderId).ok, true)
    memoryStorage.set('fcs_pda_session', JSON.stringify(operator))
    assert.equal(executeWaterSolublePdaAction({ action: 'START', orderId: handoverRoleOrder.waterOrderId, taskId: handoverRoleOrder.taskId, expectedStatus: 'WAIT_WATER_SOLUBLE', expectedNode: 'START', actor: operator }).ok, true)
    assert.equal(executeWaterSolublePdaAction({ action: 'COMPLETE', orderId: handoverRoleOrder.waterOrderId, taskId: handoverRoleOrder.taskId, expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS', expectedNode: 'COMPLETE', completedQty: handoverRoleOrder.plannedQty, reason: '', actor: operator }).ok, true)
    memoryStorage.set('fcs_pda_session', JSON.stringify(handoverActor))
    const handoverRoleHead = ensureHandoverOrderForStartedTask(handoverRoleOrder.taskId)
    const handoverRoleRecord = createFactoryHandoverRecord({ handoverOrderId: handoverRoleHead.handoverOrderId, submittedQty: handoverRoleOrder.plannedQty, factorySubmittedAt: '2026-07-11 13:00:00', factorySubmittedBy: handoverActor.userName, actor: handoverActor, scanCode: handoverRoleOrder.materialCode })
    assert.equal(getWaterSolubleWorkOrderById(handoverRoleOrder.waterOrderId)?.status, 'HANDOVER_WAIT_RECEIVE')
    writeBackHandoverRecord({ handoverRecordId: handoverRoleRecord.recordId, receiverWrittenQty: handoverRoleOrder.plannedQty, receiverWrittenAt: '2026-07-11 13:10:00', receiverWrittenBy: '接收方扫码员' })
    assert.equal(getWaterSolubleWorkOrderById(handoverRoleOrder.waterOrderId)?.status, 'DONE')
    const matchedWaterHead = getHandoverOrderById(handoverRoleHead.handoverOrderId)!
    assert.equal(matchedWaterHead.completionStatus, 'COMPLETED')
    assert.equal(matchedWaterHead.handoverOrderStatus, 'CLOSED', '实收一致后水溶单与交出单头必须同时闭环')
    assert.equal(matchedWaterHead.submittedQtyTotal, handoverRoleOrder.plannedQty)
    assert.equal(matchedWaterHead.writtenBackQtyTotal, handoverRoleOrder.plannedQty)
    assert.equal(matchedWaterHead.diffQtyTotal, 0)

    memoryStorage.set('fcs_pda_session', JSON.stringify(operator))
    const waitMaterialOrder = listDyeWorkOrders().find((order) => order.status === 'WAIT_MATERIAL')
    assert(waitMaterialOrder, '必须存在待原料染色单验证后处理越序阻断')
    const beforeIllegalPackOrder = getDyeWorkOrderById(waitMaterialOrder.dyeOrderId)
    const beforeIllegalPackNode = getDyeExecutionNodeRecord(waitMaterialOrder.dyeOrderId, 'PACK')
    const beforeIllegalPackHandovers = listHandoverOrdersByTaskId(waitMaterialOrder.taskId)
    assert.throws(() => startDyeNode(waitMaterialOrder.dyeOrderId, 'PACK', '越序探针'), /状态|前序|顺序/, 'WAIT_MATERIAL 不得直接开始包装')
    assert.throws(() => completeDyeNode(waitMaterialOrder.dyeOrderId, 'PACK', { outputQty: 1 }), /状态|前序|顺序/, 'WAIT_MATERIAL 不得直接完成包装')
    assert.deepEqual(getDyeWorkOrderById(waitMaterialOrder.dyeOrderId), beforeIllegalPackOrder, '越序开始包装失败不得修改加工单')
    assert.deepEqual(getDyeExecutionNodeRecord(waitMaterialOrder.dyeOrderId, 'PACK'), beforeIllegalPackNode, '越序开始包装失败不得创建节点')
    assert.deepEqual(listHandoverOrdersByTaskId(waitMaterialOrder.taskId), beforeIllegalPackHandovers, '越序开始包装失败不得生成交出单')

    const combined = getDyeWorkOrderById(combinedDyeOrder.dyeOrderId)
    assert(combined, '含水溶染色加工单必须仍可读取')
    const combinedGenericTask = listPdaGenericProcessTasks().find((task) => task.taskId === combined.taskId)
    assert(combinedGenericTask, '联合染色必须存在通用移动任务')
    combinedGenericTask.qtyDisplayUnit = '公斤'
    assert.equal(validateDyeStartPrerequisite(combined.dyeOrderId, 80).ok, false)
    if (combined.isFirstOrder && combined.sampleWaitType !== 'NONE') {
      startDyeSampleWait(combined.dyeOrderId, { waitType: combined.sampleWaitType, operatorName: operator.userName })
      completeDyeSampleWait(combined.dyeOrderId, operator.userName)
      startDyeSampleTest(combined.dyeOrderId, operator.userName)
      completeDyeSampleTest(combined.dyeOrderId, { colorNo: 'WS-TEST', operatorName: operator.userName })
    }
    startDyeMaterialWait(combined.dyeOrderId, operator.userName)
    completeDyeMaterialWait(combined.dyeOrderId, operator.userName)
    startDyeMaterialReady(combined.dyeOrderId, operator.userName)
    completeDyeMaterialReady(combined.dyeOrderId, { outputQty: combined.plannedQty, operatorName: operator.userName })
    const dyeVat = listDyeVatOptions(combined.dyeFactoryId)[0]
    assert(dyeVat, '含水溶染色单工厂必须存在可用染缸')
    planDyeVat(combined.dyeOrderId, { dyeVatNo: dyeVat.dyeVatNo, operatorName: operator.userName })

    appStore.navigate(`/fcs/pda/exec/${encodeURIComponent(combined.taskId)}`)
    const combinedWaitWaterHtml = renderPdaExecDetailPage(combined.taskId)
    assert(combinedWaitWaterHtml.includes('data-testid="pda-combined-dye-current-action"'), '含水溶染色详情必须显示统一当前动作区')
    assert(combinedWaitWaterHtml.includes('data-pda-execd-action="dye-water-start"'), '待水溶时必须只显示开始水溶')
    assert.equal((combinedWaitWaterHtml.match(/data-combined-primary-action="true"/g) || []).length, 1, '含水溶染色首屏必须只有一个主动作')

    assert.equal(executeDyeWaterSolublePdaAction({
      action: 'START',
      dyeOrderId: combined.dyeOrderId,
      taskId: combined.taskId,
      expectedStatus: 'WAIT_WATER_SOLUBLE',
      expectedNode: 'WATER_SOLUBLE',
      actor: operator,
    }).ok, true)
    assert.equal(listHandoverOrdersByTaskId(combined.taskId).length, 0, '含水溶染色完成内部水溶后不得生成中间交出')
    const combinedWaterRunningHtml = renderPdaExecDetailPage(combined.taskId)
    assert(combinedWaterRunningHtml.includes('data-pda-execd-action="dye-water-complete"'), '水溶中必须显示完成水溶')
    const combinedWaterCompleteToken = combinedWaterRunningHtml.match(/data-pda-execd-action="dye-water-complete"[\s\S]{0,1200}?data-action-token="([^"]+)"/)
    assert(combinedWaterCompleteToken, '联合水溶中详情必须提供真实完成动作令牌')
    const openCombinedWaterCompletionNode = {
      dataset: {
        pdaExecdAction: 'dye-water-complete',
        dyeOrderId: combined.dyeOrderId,
        taskId: combined.taskId,
        expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS',
        expectedNode: 'WATER_SOLUBLE',
        actionToken: combinedWaterCompleteToken[1],
      },
    }
    assert.equal(handlePdaExecDetailEvent({ closest: (selector: string) => selector === '[data-pda-execd-action]' ? openCombinedWaterCompletionNode : null } as unknown as HTMLElement), true)
    const combinedWaterOverlayHtml = renderPdaExecDetailPage(combined.taskId)
    const combinedWaterOverlayToken = combinedWaterOverlayHtml.match(/data-pda-execd-action="dye-water-confirm-completion"[\s\S]{0,3000}?data-overlay-token="([^"]+)"/)
    assert(combinedWaterOverlayToken, `联合水溶完成弹层必须生成真实确认令牌；动作=${(combinedWaterOverlayHtml.match(/data-pda-execd-action="[^"]+"/g) || []).join('、')}`)
    setExecDetailDraftField('dyeWaterOutputQty', '0')
    setExecDetailDraftField('dyeWaterReason', '', true)
    const confirmCombinedWaterNode = {
      dataset: {
        pdaExecdAction: 'dye-water-confirm-completion',
        dyeOrderId: combined.dyeOrderId,
        taskId: combined.taskId,
        expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS',
        expectedNode: 'WATER_SOLUBLE',
        overlayToken: combinedWaterOverlayToken[1],
      },
      disabled: false,
      isConnected: true,
      textContent: '确认完成',
    }
    const confirmCombinedWaterTarget = { closest: (selector: string) => selector === '[data-pda-execd-action]' ? confirmCombinedWaterNode : null } as unknown as HTMLElement
    assert.equal(handlePdaExecDetailEvent(confirmCombinedWaterTarget), true)
    assert.equal(getDyeWorkOrderById(combined.dyeOrderId)?.status, 'WATER_SOLUBLE_IN_PROGRESS', '联合水溶 0 无原因必须由真实 handler 阻断')
    setExecDetailDraftField('dyeWaterReason', '本批物料全部不可用', true)
    assert.equal(handlePdaExecDetailEvent(confirmCombinedWaterTarget), true)
    assert.equal(getDyeWorkOrderById(combined.dyeOrderId)?.status, 'PRODUCTION_PAUSED', '联合水溶 0 有原因必须经真实 handler 进入生产暂停')
    memoryStorage.set('fcs_pda_session', JSON.stringify(supervisor))
    assert.equal(executeDyeWaterSolublePdaAction({
      action: 'RESOLVE_PAUSE',
      dyeOrderId: combined.dyeOrderId,
      taskId: combined.taskId,
      expectedStatus: 'PRODUCTION_PAUSED',
      expectedNode: 'WATER_SOLUBLE',
      decision: 'CONTINUE_PROCESSING',
      actor: supervisor,
    }).ok, true)
    memoryStorage.set('fcs_pda_session', JSON.stringify(operator))
    assert.equal(executeDyeWaterSolublePdaAction({
      action: 'START',
      dyeOrderId: combined.dyeOrderId,
      taskId: combined.taskId,
      expectedStatus: 'WAIT_WATER_SOLUBLE',
      expectedNode: 'WATER_SOLUBLE',
      actor: operator,
    }).ok, true)
    assert.equal(executeDyeWaterSolublePdaAction({
      action: 'COMPLETE',
      dyeOrderId: combined.dyeOrderId,
      taskId: combined.taskId,
      expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS',
      expectedNode: 'WATER_SOLUBLE',
      outputQty: 80,
      reason: '物料实际可水溶数量不足',
      actor: operator,
    }).ok, true)
    memoryStorage.set('fcs_pda_session', JSON.stringify(supervisor))
    assert.equal(executeDyeWaterSolublePdaAction({
      action: 'RESOLVE_PAUSE',
      dyeOrderId: combined.dyeOrderId,
      taskId: combined.taskId,
      expectedStatus: 'PRODUCTION_PAUSED',
      expectedNode: 'WATER_SOLUBLE',
      decision: 'CONTINUE_WITH_ACTUAL_QTY',
      actor: supervisor,
    }).ok, true)
    memoryStorage.set('fcs_pda_session', JSON.stringify(operator))
    const combinedWaitDyeHtml = renderPdaExecDetailPage(combined.taskId)
    assert(combinedWaitDyeHtml.includes('data-pda-execd-action="dye-water-start-dye"'), '主管按实际继续后必须显示开始染色')
    assert(!combinedWaitDyeHtml.includes('水溶后交接'), '水溶完成后不得出现中间交接入口')
    assert.equal(validateDyeStartPrerequisite(combined.dyeOrderId, 100).ok, false)
    assert.match(validateDyeStartPrerequisite(combined.dyeOrderId, 100).message, /不能超过水溶完成数量/)
    assert.equal(validateDyeStartPrerequisite(combined.dyeOrderId, 80).ok, true)
    startDyeing(combined.dyeOrderId, { dyeVatNo: dyeVat.dyeVatNo, inputQty: 80, operatorName: operator.userName })
    assert.equal(listHandoverOrdersByTaskId(combined.taskId).length, 0, '含水溶染色开始染色后仍不得生成中间交出')
    assert.equal(getDyeExecutionNodeRecord(combined.dyeOrderId, 'DYE')?.inputQty, 80)
    const dyeNodeAfterStart = getDyeExecutionNodeRecord(combined.dyeOrderId, 'DYE')
    assert.throws(
      () => startDyeing(combined.dyeOrderId, { dyeVatNo: dyeVat.dyeVatNo, inputQty: 80, operatorName: operator.userName }),
      /已经开始|重复/,
    )
    assert.deepEqual(getDyeExecutionNodeRecord(combined.dyeOrderId, 'DYE'), dyeNodeAfterStart, '重复开始染色不得修改节点事实')
    const beforeOverInputOrder = getDyeWorkOrderById(combined.dyeOrderId)
    const beforeOverInputNode = getDyeExecutionNodeRecord(combined.dyeOrderId, 'DYE')
    const beforeOverInputLogs = structuredClone(getProcessActionOperationRecordsByTask(combined.taskId))
    assert.throws(
      () => completeDyeing(combined.dyeOrderId, { inputQty: 100, outputQty: 81, operatorName: operator.userName }),
      /不能超过.*投入|完成数量.*投入/,
      '染色产出 81 不能超过真实投入 80',
    )
    assert.deepEqual(getDyeWorkOrderById(combined.dyeOrderId), beforeOverInputOrder, '产出超过真实投入失败不得修改加工单状态')
    assert.deepEqual(getDyeExecutionNodeRecord(combined.dyeOrderId, 'DYE'), beforeOverInputNode, '产出超过真实投入失败不得修改染色节点')
    assert.deepEqual(getProcessActionOperationRecordsByTask(combined.taskId), beforeOverInputLogs, '产出超过真实投入失败不得新增操作日志')

    const adminUser = listFactoryPdaUsers(combined.dyeFactoryId).find((item) => item.status === 'ACTIVE' && item.roleId === 'ROLE_ADMIN')
    const productionUser = listFactoryPdaUsers(combined.dyeFactoryId).find((item) => item.status === 'ACTIVE' && item.roleId === 'ROLE_PRODUCTION')
      || await createFactoryPdaUser({
        factoryId: combined.dyeFactoryId,
        name: '水溶专项生产主管',
        loginId: `${combined.dyeFactoryId}_water_production_check`,
        password: '123456',
        roleId: 'ROLE_PRODUCTION',
        createdBy: '水溶专项检查',
      })
    assert(adminUser && productionUser, '含水溶染色完成防护必须有本厂管理员和生产主管账号用于越权测试')
    const admin = createPdaSessionFromUser(adminUser)
    const production = createPdaSessionFromUser(productionUser)
    const completionSnapshot = () => structuredClone({
      order: getDyeWorkOrderById(combined.dyeOrderId),
      node: getDyeExecutionNodeRecord(combined.dyeOrderId, 'DYE'),
      logs: getProcessActionOperationRecordsByTask(combined.taskId),
    })
    const makeCompletionTarget = (token: string, overrides: Record<string, string> = {}) => {
      const node = {
        dataset: {
          pdaExecdAction: 'dye-complete-dye',
          dyeOrderId: combined.dyeOrderId,
          taskId: combined.taskId,
          expectedStatus: 'DYEING',
          expectedNode: 'DYE',
          actionToken: token,
          ...overrides,
        },
        disabled: false,
        isConnected: true,
        textContent: '完成染色',
      }
      return { closest: (selector: string) => selector === '[data-pda-execd-action]' ? node : null } as unknown as HTMLElement
    }
    const getCompletionToken = () => {
      const html = renderPdaExecDetailPage(combined.taskId)
      const match = html.match(/data-pda-execd-action="dye-complete-dye"[\s\S]{0,1200}?data-action-token="([^"]+)"/)
      assert(match, '含水溶染色完成按钮必须提供真实一次性动作令牌')
      return match[1]
    }
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
    const promptDefaults: string[] = []
    let promptAnswers: string[] = []
    Object.defineProperty(globalThis, 'document', { configurable: true, value: undefined })
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { search: '', pathname: `/fcs/pda/exec/${encodeURIComponent(combined.taskId)}` },
        history: { pushState: () => undefined, replaceState: () => undefined },
        prompt: (_message: string, defaultValue?: string) => {
          promptDefaults.push(String(defaultValue ?? ''))
          return promptAnswers.shift() ?? String(defaultValue ?? '')
        },
      },
    })
    try {
      appStore.navigate(`/fcs/pda/exec/${encodeURIComponent(combined.taskId)}`)
      memoryStorage.set('fcs_pda_session', JSON.stringify(operator))
      const initialToken = getCompletionToken()

      memoryStorage.delete('fcs_pda_session')
      const beforeNoSessionCompletion = completionSnapshot()
      assert.equal(handlePdaExecDetailEvent(makeCompletionTarget(initialToken)), true, '无 session 的组合染色完成请求必须被 handler 消费')
      assert.deepEqual(completionSnapshot(), beforeNoSessionCompletion, '无 session 拒绝不得修改状态、节点或日志')

      memoryStorage.set('fcs_pda_session', JSON.stringify(admin))
      const beforeAdminCompletion = completionSnapshot()
      assert.equal(handlePdaExecDetailEvent(makeCompletionTarget(initialToken)), true, '管理员组合染色完成请求必须被 handler 消费')
      assert.deepEqual(completionSnapshot(), beforeAdminCompletion, '管理员不得代替普通操作员完成组合染色')

      memoryStorage.set('fcs_pda_session', JSON.stringify(production))
      const beforeProductionCompletion = completionSnapshot()
      assert.equal(handlePdaExecDetailEvent(makeCompletionTarget(initialToken)), true, '生产主管组合染色完成请求必须被 handler 消费')
      assert.deepEqual(completionSnapshot(), beforeProductionCompletion, '生产主管不得代替普通操作员完成组合染色')

      memoryStorage.set('fcs_pda_session', JSON.stringify(handoverActor))
      const beforeHandoverCompletion = completionSnapshot()
      assert.equal(handlePdaExecDetailEvent(makeCompletionTarget(initialToken)), true, '交接员组合染色完成请求必须被 handler 消费')
      assert.deepEqual(completionSnapshot(), beforeHandoverCompletion, '交接员不得完成组合染色')

      const otherTask = listDyeWorkOrders().find((item) => item.taskId !== combined.taskId && item.dyeFactoryId === combined.dyeFactoryId)
      assert(otherTask, '必须存在同厂任务 A 验证注入组合染色任务 B')
      memoryStorage.set('fcs_pda_session', JSON.stringify(operator))
      appStore.navigate(`/fcs/pda/exec/${encodeURIComponent(otherTask.taskId)}`)
      const beforeWrongPageCompletion = completionSnapshot()
      assert.equal(handlePdaExecDetailEvent(makeCompletionTarget(initialToken)), true, '任务 A 页面注入任务 B 完成请求必须被 handler 消费')
      assert.deepEqual(completionSnapshot(), beforeWrongPageCompletion, '同厂任务 A 页面不得注入任务 B 完成染色')

      appStore.navigate(`/fcs/pda/exec/${encodeURIComponent(combined.taskId)}`)
      const staleToken = getCompletionToken()
      const currentToken = getCompletionToken()
      assert.notEqual(currentToken, staleToken, '组合染色完成令牌必须每次渲染更新，旧令牌不能复用')
      const beforeStaleTokenCompletion = completionSnapshot()
      assert.equal(handlePdaExecDetailEvent(makeCompletionTarget(staleToken)), true, '旧令牌请求必须被 handler 消费')
      assert.deepEqual(completionSnapshot(), beforeStaleTokenCompletion, '旧令牌不得修改状态、节点或日志')

      promptDefaults.length = 0
      promptAnswers = ['80', '81']
      const beforeHandlerOverInput = completionSnapshot()
      assert.equal(handlePdaExecDetailEvent(makeCompletionTarget(currentToken)), true, '产出 81 的组合染色请求必须由真实 handler 阻断')
      assert.deepEqual(completionSnapshot(), beforeHandlerOverInput, '真实 handler 产出超投入失败不得修改状态、节点或日志')
      assert.deepEqual(promptDefaults, ['80', '80'], '短量继续后完成染色的两个输入默认值都必须来自 DYE 节点真实投入 80')

      promptDefaults.length = 0
      promptAnswers = ['80', '80']
      assert.equal(handlePdaExecDetailEvent(makeCompletionTarget(currentToken)), true, '失败后必须可用页面原按钮和同一令牌改正为 80 完成组合染色')
      const completedDyeNode = getDyeExecutionNodeRecord(combined.dyeOrderId, 'DYE')
      assert.equal(getDyeWorkOrderById(combined.dyeOrderId)?.status, 'DEHYDRATING', '完成染色后必须进入脱水')
      assert.equal(completedDyeNode?.inputQty, 80, '完成染色不得被输入框或计划量改写真实投入')
      assert.equal(completedDyeNode?.outputQty, 80)
      assert.equal(completedDyeNode?.lossQty, 0, '染色损耗不得为负数')
      assert.deepEqual(promptDefaults, ['80', '80'], '成功完成时两个输入默认值仍必须是 DYE 节点真实投入')

      const afterSuccessfulCompletion = completionSnapshot()
      assert.equal(handlePdaExecDetailEvent(makeCompletionTarget(currentToken)), true, '双击/重复提交必须由 handler 消费并拒绝')
      assert.deepEqual(completionSnapshot(), afterSuccessfulCompletion, '双击/重复提交不得二次修改状态、节点或日志')
    } finally {
      if (originalWindowDescriptor) Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
      else Reflect.deleteProperty(globalThis, 'window')
      if (originalDocumentDescriptor) Object.defineProperty(globalThis, 'document', originalDocumentDescriptor)
      else Reflect.deleteProperty(globalThis, 'document')
    }
    for (const nodeCode of ['DEHYDRATE', 'DRY', 'SET', 'ROLL'] as const) {
      startDyeNode(combined.dyeOrderId, nodeCode, operator.userName)
      const startedNode = getDyeExecutionNodeRecord(combined.dyeOrderId, nodeCode)
      assert.throws(() => startDyeNode(combined.dyeOrderId, nodeCode, operator.userName), /已经开始|重复/, `${nodeCode} 不得重复开始`)
      assert.deepEqual(getDyeExecutionNodeRecord(combined.dyeOrderId, nodeCode), startedNode, `${nodeCode} 重复开始失败不得改写节点`)
      completeDyeNode(combined.dyeOrderId, nodeCode, { outputQty: 80, operatorName: operator.userName })
      const completedNode = getDyeExecutionNodeRecord(combined.dyeOrderId, nodeCode)
      assert.throws(() => completeDyeNode(combined.dyeOrderId, nodeCode, { outputQty: 79, operatorName: operator.userName }), /状态|已经完成|重复/, `${nodeCode} 不得重复完成`)
      assert.deepEqual(getDyeExecutionNodeRecord(combined.dyeOrderId, nodeCode), completedNode, `${nodeCode} 重复完成失败不得改写节点`)
      assert.equal(listHandoverOrdersByTaskId(combined.taskId).length, 0, `${nodeCode} 完成后仍不得生成交出单`)
    }
    startDyeNode(combined.dyeOrderId, 'PACK', operator.userName)
    assert.equal(listHandoverOrdersByTaskId(combined.taskId).length, 0, '包装未完成不得生成最终交出单')
    completeDyeNode(combined.dyeOrderId, 'PACK', { outputQty: 80, operatorName: operator.userName })
    const combinedFinalOrders = listHandoverOrdersByTaskId(combined.taskId)
    assert.equal(combinedFinalOrders.length, 1, '只有 PACK 完成后可生成一张最终交出单')
    assert.equal(combinedFinalOrders[0].sourceBusinessType, 'DYE_WORK_ORDER', '联合染色最终交出必须保持染色加工单来源语义')
    assert.equal(combinedFinalOrders[0].qtyUnit, '公斤', '联合染色最终交出单头必须优先使用任务权威显示单位')
    assert.equal(ensureHandoverOrderForStartedTask(combined.taskId).created, false)
    assert.equal(listHandoverOrdersByTaskId(combined.taskId).length, 1, '联合染色重复 ensure 不得重复创建')

    const prepareCombinedCompletionProbe = (suffix: string) => {
      const created = createDyeWorkOrderFromDemands({
        demands: [{
          demandId: `DYE-${suffix}-DEMAND`,
          sourceArtifactId: `DYE-${suffix}-ARTIFACT`,
          sourceProductionOrderId: `PO-DYE-${suffix}`,
          bomItemId: `BOM-DYE-${suffix}`,
          materialCode: `MAT-DYE-${suffix}`,
          materialName: `${suffix} 专项面料`,
          requiredQty: 100,
          unit: combined.qtyUnit,
          requiresWaterSoluble: true,
          processRoute: ['WATER_SOLUBLE', 'DYE'],
        }],
        factoryId: combined.dyeFactoryId,
        plannedFinishAt: '2026-07-20 18:00:00',
        createdBy: `${suffix} 专项检查`,
      })
      assert.equal(created.ok, true, created.message)
      const order = created.order
      assert(order, `必须创建 ${suffix} 含水溶染色单`)
      startDyeMaterialWait(order.dyeOrderId, operator.userName)
      completeDyeMaterialWait(order.dyeOrderId, operator.userName)
      startDyeMaterialReady(order.dyeOrderId, operator.userName)
      completeDyeMaterialReady(order.dyeOrderId, { outputQty: order.plannedQty, operatorName: operator.userName })
      const vat = listDyeVatOptions(order.dyeFactoryId)[0]
      assert(vat, `${suffix} 探针必须有可用染缸`)
      planDyeVat(order.dyeOrderId, { dyeVatNo: vat.dyeVatNo, operatorName: operator.userName })
      memoryStorage.set('fcs_pda_session', JSON.stringify(operator))
      assert.equal(executeDyeWaterSolublePdaAction({
        action: 'START', dyeOrderId: order.dyeOrderId, taskId: order.taskId,
        expectedStatus: 'WAIT_WATER_SOLUBLE', expectedNode: 'WATER_SOLUBLE', actor: operator,
      }).ok, true)
      assert.equal(executeDyeWaterSolublePdaAction({
        action: 'COMPLETE', dyeOrderId: order.dyeOrderId, taskId: order.taskId,
        expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS', expectedNode: 'WATER_SOLUBLE', outputQty: 80,
        reason: `${suffix} 专项检查的水溶短量`, actor: operator,
      }).ok, true)
      memoryStorage.set('fcs_pda_session', JSON.stringify(supervisor))
      assert.equal(executeDyeWaterSolublePdaAction({
        action: 'RESOLVE_PAUSE', dyeOrderId: order.dyeOrderId, taskId: order.taskId,
        expectedStatus: 'PRODUCTION_PAUSED', expectedNode: 'WATER_SOLUBLE', decision: 'CONTINUE_WITH_ACTUAL_QTY', actor: supervisor,
      }).ok, true)
      memoryStorage.set('fcs_pda_session', JSON.stringify(operator))
      startDyeing(order.dyeOrderId, { dyeVatNo: vat.dyeVatNo, inputQty: 80, operatorName: operator.userName })
      return order
    }

    const serviceCombined = prepareCombinedCompletionProbe('SERVICE-ACTOR')
    const servicePayload = {
      sourceType: 'DYE' as const,
      sourceId: serviceCombined.dyeOrderId,
      taskId: serviceCombined.taskId,
      actionCode: 'DYE_FINISH_DYEING',
      operatorName: operator.userName,
      operatedAt: '2026-07-12 12:00:00',
      objectType: '面料',
      objectQty: 80,
      qtyUnit: serviceCombined.qtyUnit,
    }
    const serviceSnapshot = () => structuredClone({
      order: getDyeWorkOrderById(serviceCombined.dyeOrderId),
      node: getDyeExecutionNodeRecord(serviceCombined.dyeOrderId, 'DYE'),
      logs: getProcessActionOperationRecordsByTask(serviceCombined.taskId),
    })
    const beforeMissingActor = serviceSnapshot()
    assert.throws(() => executeMobileProcessAction(servicePayload), /身份|登录|操作员/, '组合移动写回缺少 actor 必须阻断')
    assert.deepEqual(serviceSnapshot(), beforeMissingActor, '缺少 actor 的移动写回不得修改状态、节点或日志')
    const beforeFakeActor = serviceSnapshot()
    assert.throws(() => executeMobileProcessAction({ ...servicePayload, actor: { ...operator, userId: 'FAKE-USER' } }), /身份|登录|变化/, '伪 actor 必须阻断')
    assert.deepEqual(serviceSnapshot(), beforeFakeActor, '伪 actor 移动写回不得修改状态、节点或日志')
    const beforeFakeTask = serviceSnapshot()
    assert.throws(() => executeMobileProcessAction({ ...servicePayload, taskId: 'TASK-FAKE', actor: operator }), /任务|不一致/, '伪 taskId 必须阻断')
    assert.deepEqual(serviceSnapshot(), beforeFakeTask, '伪 taskId 移动写回不得修改状态、节点或日志')
    executeMobileProcessAction({ ...servicePayload, actor: operator })
    assert.equal(getDyeWorkOrderById(serviceCombined.dyeOrderId)?.status, 'DEHYDRATING', '可信 actor 与真实 taskId 必须可经移动写回完成组合染色')

    const zeroCombined = prepareCombinedCompletionProbe('ZERO-HANDLER')
    appStore.navigate(`/fcs/pda/exec/${encodeURIComponent(zeroCombined.taskId)}`)
    const zeroHtml = renderPdaExecDetailPage(zeroCombined.taskId)
    const zeroToken = zeroHtml.match(/data-pda-execd-action="dye-complete-dye"[\s\S]{0,1200}?data-action-token="([^"]+)"/)
    assert(zeroToken, '产出 0 的组合染色完成按钮必须有一次性令牌')
    const zeroNode = {
      dataset: {
        pdaExecdAction: 'dye-complete-dye', dyeOrderId: zeroCombined.dyeOrderId, taskId: zeroCombined.taskId,
        expectedStatus: 'DYEING', expectedNode: 'DYE', actionToken: zeroToken[1],
      },
      disabled: false, isConnected: true, textContent: '完成染色',
    }
    const zeroTarget = { closest: (selector: string) => selector === '[data-pda-execd-action]' ? zeroNode : null } as unknown as HTMLElement
    const zeroWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const zeroDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
    const zeroAnswers = ['80', '0']
    Object.defineProperty(globalThis, 'document', { configurable: true, value: undefined })
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { search: '', pathname: `/fcs/pda/exec/${encodeURIComponent(zeroCombined.taskId)}` },
        history: { pushState: () => undefined, replaceState: () => undefined },
        prompt: () => zeroAnswers.shift() ?? '',
      },
    })
    try {
      assert.equal(handlePdaExecDetailEvent(zeroTarget), true, '组合染色真实 handler 必须接收产出 0')
      const zeroCompletedOrder = getDyeWorkOrderById(zeroCombined.dyeOrderId)
      const zeroCompletedNode = getDyeExecutionNodeRecord(zeroCombined.dyeOrderId, 'DYE')
      assert.equal(zeroCompletedOrder?.status, 'DEHYDRATING', '组合染色产出 0 后必须进入脱水')
      assert.equal(zeroCompletedNode?.inputQty, 80)
      assert.equal(zeroCompletedNode?.outputQty, 0, '真实写回不得把产出 0 替换为计划量')
      assert.equal(zeroCompletedNode?.lossQty, 80, '产出 0 时损耗必须等于真实投入')
      assert.equal(getProcessActionOperationRecordsByTask(zeroCombined.taskId)[0]?.objectQty, 0, '操作日志必须记录真实产出 0')
      const afterZeroCompletion = structuredClone({
        order: zeroCompletedOrder,
        node: zeroCompletedNode,
        logs: getProcessActionOperationRecordsByTask(zeroCombined.taskId),
      })
      assert.equal(handlePdaExecDetailEvent(zeroTarget), true, '产出 0 成功后的旧令牌必须被消费')
      assert.deepEqual({
        order: getDyeWorkOrderById(zeroCombined.dyeOrderId),
        node: getDyeExecutionNodeRecord(zeroCombined.dyeOrderId, 'DYE'),
        logs: getProcessActionOperationRecordsByTask(zeroCombined.taskId),
      }, afterZeroCompletion, '产出 0 成功后的旧令牌不得重复写入')
    } finally {
      if (zeroWindowDescriptor) Object.defineProperty(globalThis, 'window', zeroWindowDescriptor)
      else Reflect.deleteProperty(globalThis, 'window')
      if (zeroDocumentDescriptor) Object.defineProperty(globalThis, 'document', zeroDocumentDescriptor)
      else Reflect.deleteProperty(globalThis, 'document')
    }
  } finally {
    if (lockedUserId) updateFactoryPdaUser(lockedUserId, { status: 'ACTIVE', updatedBy: '水溶专项检查 finally 恢复' })
    memoryStorage.clear()
    resetWaterSolubleDomainForChecks()
  }
}

main()
  .then(() => console.log('water-soluble PDA check passed'))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })

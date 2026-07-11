#!/usr/bin/env node

import assert from 'node:assert/strict'

import {
  completeDyeMaterialReady,
  completeDyeMaterialWait,
  completeDyeSampleTest,
  completeDyeSampleWait,
  executeDyeWaterSolublePdaAction,
  getDyeExecutionNodeRecord,
  getDyeWorkOrderById,
  listDyeVatOptions,
  listDyeWorkOrders,
  planDyeVat,
  startDyeMaterialReady,
  startDyeMaterialWait,
  startDyeSampleTest,
  startDyeSampleWait,
  startDyeing,
  validateDyeStartPrerequisite,
} from '../src/data/fcs/dyeing-task-domain.ts'
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
  createPdaSessionFromUser,
  listFactoryPdaUsers,
} from '../src/data/fcs/store-domain-pda.ts'
import {
  assignWaterSolubleFactory,
  executeWaterSolublePdaAction,
  getWaterSolubleCurrentAction,
  getWaterSolubleWorkOrderById,
  listWaterSolubleWorkOrders,
  markWaterSolubleMaterialReady,
  resetWaterSolubleDomainForChecks,
} from '../src/data/fcs/water-soluble-task-domain.ts'
import type { ProcessTask } from '../src/data/fcs/process-tasks.ts'
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
  dataset = { pdaExecField: 'searchKeyword' }
  value: string
  constructor(value = '') {
    this.value = value
  }
  closest(selector: string): FakeInputElement | null {
    return selector === '[data-pda-exec-field]' ? this : null
  }
}
class FakeSelectElement {}
class FakeTextAreaElement {}
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
  resetWaterSolubleDomainForChecks({ seedDemo: true })
  try {
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

    resetWaterSolubleDomainForChecks({ seedDemo: false })
    const executableOrder = listWaterSolubleWorkOrders()[0]
    assert(executableOrder, '必须存在可准备为待水溶的独立水溶加工单')
    assert.equal(assignWaterSolubleFactory(executableOrder.waterOrderId, operator.factoryId).ok, true)
    assert.equal(markWaterSolubleMaterialReady(executableOrder.waterOrderId).ok, true)
    assert.equal(getWaterSolubleCurrentAction(executableOrder)?.actionCode, 'START')

    const foreignActor = { ...operator, factoryId: 'FOREIGN-FACTORY', factoryName: '其他工厂' }
    const foreignStart = executeWaterSolublePdaAction({
      action: 'START',
      orderId: executableOrder.waterOrderId,
      expectedStatus: 'WAIT_WATER_SOLUBLE',
      actor: foreignActor,
    })
    assert.equal(foreignStart.ok, false)
    assert.match(foreignStart.message, /登录信息已变化|不属于当前工厂/)

    const firstStart = executeWaterSolublePdaAction({
      action: 'START',
      orderId: executableOrder.waterOrderId,
      expectedStatus: 'WAIT_WATER_SOLUBLE',
      actor: operator,
    })
    const duplicateStart = executeWaterSolublePdaAction({
      action: 'START',
      orderId: executableOrder.waterOrderId,
      expectedStatus: 'WAIT_WATER_SOLUBLE',
      actor: operator,
    })
    assert.equal(firstStart.ok, true)
    assert.equal(duplicateStart.ok, false)
    assert.match(duplicateStart.message, /已经开始|当前状态/)

    const missingReason = executeWaterSolublePdaAction({
      action: 'COMPLETE',
      orderId: executableOrder.waterOrderId,
      expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS',
      completedQty: executableOrder.plannedQty - 1,
      reason: '',
      actor: operator,
    })
    assert.equal(missingReason.ok, false)
    assert.match(missingReason.message, /填写原因/)
    const shortage = executeWaterSolublePdaAction({
      action: 'COMPLETE',
      orderId: executableOrder.waterOrderId,
      expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS',
      completedQty: executableOrder.plannedQty - 1,
      reason: '现场实测原料不足',
      actor: operator,
    })
    assert.equal(shortage.ok, true)
    assert.equal(shortage.order?.status, 'PRODUCTION_PAUSED')
    const operatorResolve = executeWaterSolublePdaAction({
      action: 'RESOLVE_PAUSE',
      orderId: executableOrder.waterOrderId,
      expectedStatus: 'PRODUCTION_PAUSED',
      decision: 'CONTINUE_WITH_ACTUAL_QTY',
      actor: operator,
    })
    assert.equal(operatorResolve.ok, false)
    assert.match(operatorResolve.message, /主管/)
    assert.equal(executeWaterSolublePdaAction({
      action: 'RESOLVE_PAUSE',
      orderId: executableOrder.waterOrderId,
      expectedStatus: 'PRODUCTION_PAUSED',
      decision: 'CONTINUE_WITH_ACTUAL_QTY',
      actor: supervisor,
    }).ok, true)

    const combined = getDyeWorkOrderById(combinedDyeOrder.dyeOrderId)
    assert(combined, '含水溶染色加工单必须仍可读取')
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
    const combinedWaterRunningHtml = renderPdaExecDetailPage(combined.taskId)
    assert(combinedWaterRunningHtml.includes('data-pda-execd-action="dye-water-complete"'), '水溶中必须显示完成水溶')
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
    assert.equal(executeDyeWaterSolublePdaAction({
      action: 'RESOLVE_PAUSE',
      dyeOrderId: combined.dyeOrderId,
      taskId: combined.taskId,
      expectedStatus: 'PRODUCTION_PAUSED',
      expectedNode: 'WATER_SOLUBLE',
      decision: 'CONTINUE_WITH_ACTUAL_QTY',
      actor: supervisor,
    }).ok, true)
    const combinedWaitDyeHtml = renderPdaExecDetailPage(combined.taskId)
    assert(combinedWaitDyeHtml.includes('data-pda-execd-action="dye-water-start-dye"'), '主管按实际继续后必须显示开始染色')
    assert(!combinedWaitDyeHtml.includes('水溶后交接'), '水溶完成后不得出现中间交接入口')
    assert.equal(validateDyeStartPrerequisite(combined.dyeOrderId, 100).ok, false)
    assert.match(validateDyeStartPrerequisite(combined.dyeOrderId, 100).message, /不能超过水溶完成数量/)
    assert.equal(validateDyeStartPrerequisite(combined.dyeOrderId, 80).ok, true)
    startDyeing(combined.dyeOrderId, { dyeVatNo: dyeVat.dyeVatNo, inputQty: 80, operatorName: operator.userName })
    assert.equal(getDyeExecutionNodeRecord(combined.dyeOrderId, 'DYE')?.inputQty, 80)
  } finally {
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

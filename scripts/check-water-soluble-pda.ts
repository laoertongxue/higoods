#!/usr/bin/env node

import assert from 'node:assert/strict'

import { listDyeWorkOrders } from '../src/data/fcs/dyeing-task-domain.ts'
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
  listPdaMobileExecutionTasks,
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
  getWaterSolubleCurrentAction,
  listWaterSolubleWorkOrders,
  resetWaterSolubleDomainForChecks,
} from '../src/data/fcs/water-soluble-task-domain.ts'
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
    const { handlePdaExecEvent, renderPdaExecPage } = await import('../src/pages/pda-exec.ts')
    const html = renderPdaExecPage()
    assert(html.includes('data-testid="pda-exec-page"'), '必须通过真实 PDA 页面渲染入口输出执行页')
    assert(html.includes('水溶加工单'), '水溶卡片必须显示“水溶加工单”')
    assert(html.includes(targetOrder.materialName) && html.includes(targetOrder.materialCode), '水溶卡片必须显示物料名称和编码')
    assert(html.includes(`${targetOrder.plannedQty.toLocaleString('zh-CN')} ${targetOrder.qtyUnit}`), '水溶卡片必须显示计划量和原 BOM 单位')
    assert(html.includes(getWaterSolubleCurrentAction(targetOrder.waterOrderId)?.actionName || ''), '水溶卡片必须显示当前唯一主动作')
    assert(html.includes('placeholder="搜索任务号 / 加工单号 / 生产单号 / 物料"'), '搜索提示必须覆盖物料')
    assert(!html.includes('data-pda-nav="water-soluble"'), '不得新增独立水溶底部导航')

    const pausedOrder = visibleWaterOrders.find((order) => order.status === 'PRODUCTION_PAUSED')
    assert(pausedOrder, '确定性 seed 必须包含生产暂停水溶单')
    appStore.navigate('/fcs/pda/exec?tab=BLOCKED')
    const blockedHtml = renderPdaExecPage()
    assert(blockedHtml.includes(pausedOrder.materialName), '生产暂停 tab 必须展示水溶卡片')
    assert(blockedHtml.includes('生产暂停'), '生产暂停水溶卡片必须明确异常提示')
    assert(blockedHtml.includes('查看主管处理'), '生产暂停水溶卡片必须只有查看主管处理主动作')

    class FakeInputElement {
      dataset = { pdaExecField: 'searchKeyword' }
      value = pausedOrder.materialCode
      closest(selector: string): FakeInputElement | null {
        return selector === '[data-pda-exec-field]' ? this : null
      }
    }
    class FakeSelectElement {}
    Object.defineProperty(globalThis, 'HTMLInputElement', { configurable: true, value: FakeInputElement })
    Object.defineProperty(globalThis, 'HTMLSelectElement', { configurable: true, value: FakeSelectElement })
    const pageRoot = { innerHTML: '根节点不得重绘' }
    const listNode = { innerHTML: '旧列表' }
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        querySelector: (selector: string) => selector === '[data-testid="pda-exec-card-list"]' ? listNode : null,
      },
    })
    const input = new FakeInputElement()
    assert.equal(handlePdaExecEvent(input as unknown as HTMLElement), false, '搜索输入必须由 PDA 页面局部处理')
    assert.equal(pageRoot.innerHTML, '根节点不得重绘', '搜索输入不得重绘页面根节点')
    assert.notEqual(listNode.innerHTML, '旧列表', '搜索输入必须局部刷新卡片列表')
    assert(listNode.innerHTML.includes(pausedOrder.materialCode), '局部搜索结果必须保留目标水溶任务')
    assert.equal(input.value, pausedOrder.materialCode, '局部搜索不得丢失输入值')

    const escapedOrder = visibleWaterOrders[0]
    assert(!html.includes('<script>alert('), '水溶卡片业务字段必须经过 HTML 转义')
    assert(escapedOrder.qtyUnit.length > 0, '原 BOM 单位不得丢失')
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

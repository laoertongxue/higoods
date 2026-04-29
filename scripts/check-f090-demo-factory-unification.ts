import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  TEST_FACTORY_DISPLAY_NAME,
  TEST_FACTORY_ID,
  TEST_FACTORY_NAME,
  formatFactoryDisplayName,
  mockFactories,
} from '../src/data/fcs/factory-mock-data.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import { listPrintWorkOrders } from '../src/data/fcs/printing-task-domain.ts'
import { listDyeWorkOrders } from '../src/data/fcs/dyeing-task-domain.ts'
import { cloneCutPieceOrderRecords } from '../src/data/fcs/cutting/cut-piece-orders.ts'
import { listSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'
import {
  listPdaGenericTasksByFactory,
  listPdaGenericTasksByProcess,
} from '../src/data/fcs/pda-task-mock-factory.ts'
import { listPdaTaskFlowTasks } from '../src/data/fcs/pda-cutting-execution-source.ts'

const root = process.cwd()
const oldFactoryNames = [
  'PT Prima Printing Center',
  'PT Cahaya Dyeing Sejahtera',
  '鸿辉印花厂',
  '嘉泽印花中心',
  '盛彩印花厂',
  '万隆染色厂',
  '雅加达染整中心',
  '泗水染色厂',
  '晋江盛鸿裁片厂',
  '石狮恒泰裁片厂',
  '南安协丰裁片厂',
  '泗水裁片厂',
  '泗水裁片一厂',
  '雅加达裁片中心',
  '万隆裁片二厂',
  '泗水样衣裁片组',
  '泗水裁片三厂',
  '日惹包装厂',
  '雅加达绣花专工厂',
  '小飞裁片厂',
]

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`F090 演示工厂统一检查失败：${message}`)
  }
}

function assertIncludes(path: string, needles: string[]): void {
  const source = read(path)
  for (const needle of needles) {
    assert(source.includes(needle), `${path} 缺少 ${needle}`)
  }
}

function assertNoOldFactoryNames(paths: string[]): void {
  for (const path of paths) {
    const source = read(path)
    for (const oldName of oldFactoryNames) {
      assert(!source.includes(oldName), `${path} 仍保留旧演示工厂名：${oldName}`)
    }
  }
}

function assertAll<T>(items: T[], message: string, predicate: (item: T) => boolean): void {
  const failed = items.filter((item) => !predicate(item))
  assert(failed.length === 0, `${message}，异常数量：${failed.length}`)
}

const factories = mockFactories.filter((factory) => factory.id === TEST_FACTORY_ID || factory.code === TEST_FACTORY_ID)
assert(factories.length === 1, '必须且只能存在一条 F090 工厂主数据')
assert(factories[0]?.name === TEST_FACTORY_NAME, 'F090 工厂名称必须为“全能力测试工厂”')

const masterFactories = listFactoryMasterRecords()
const f090Masters = masterFactories.filter((factory) => factory.id === TEST_FACTORY_ID || factory.code === TEST_FACTORY_ID)
const testNameMasters = masterFactories.filter((factory) => factory.name === TEST_FACTORY_NAME)
assert(f090Masters.length === 1, '工厂主数据 store 中必须且只能存在一条 F090')
assert(testNameMasters.length === 1, '工厂主数据 store 中“全能力测试工厂”必须唯一')
assert(testNameMasters[0]?.id === TEST_FACTORY_ID && testNameMasters[0]?.code === TEST_FACTORY_ID, '全能力测试工厂必须对应 F090')
assert(formatFactoryDisplayName(TEST_FACTORY_NAME, TEST_FACTORY_ID) === TEST_FACTORY_DISPLAY_NAME, '工厂展示格式必须为全能力测试工厂（F090）')

const printOrders = listPrintWorkOrders()
assert(printOrders.length > 0, '印花演示加工单不能为空')
assertAll(printOrders, '印花加工单演示数据必须使用 F090', (order) => order.printFactoryId === TEST_FACTORY_ID && order.printFactoryName === TEST_FACTORY_NAME)

const dyeOrders = listDyeWorkOrders()
assert(dyeOrders.length > 0, '染色演示加工单不能为空')
assertAll(dyeOrders, '染色加工单演示数据必须使用 F090', (order) => order.dyeFactoryId === TEST_FACTORY_ID && order.dyeFactoryName === TEST_FACTORY_NAME)

const cutOrders = cloneCutPieceOrderRecords()
assert(cutOrders.length > 0, '裁片演示单据不能为空')
assertAll(cutOrders, '裁片演示数据必须使用全能力测试工厂', (order) => order.assignedFactoryName === TEST_FACTORY_NAME)

const specialOrders = listSpecialCraftTaskOrders()
assert(specialOrders.length > 0, '特殊工艺演示任务不能为空')
assertAll(specialOrders, '特殊工艺演示数据必须使用 F090', (order) => order.factoryId === TEST_FACTORY_ID && order.factoryName === TEST_FACTORY_NAME)

const pdaPrintTasks = listPdaGenericTasksByProcess('PRINTING')
const pdaDyeTasks = listPdaGenericTasksByProcess('DYEING')
const pdaFlowTasks = listPdaTaskFlowTasks()
const pdaCuttingTasks = pdaFlowTasks.filter((task) => task.processNameZh === '裁片')
const pdaSpecialTasks = pdaFlowTasks.filter((task) => String(task.processNameZh).includes('特殊工艺') || String(task.processBusinessName).includes('特殊工艺'))
assert(pdaPrintTasks.length > 0, 'PDA 印花任务不能为空')
assert(pdaDyeTasks.length > 0, 'PDA 染色任务不能为空')
assert(pdaCuttingTasks.length > 0, 'PDA 裁片任务不能为空')
assert(pdaSpecialTasks.length > 0, 'PDA 特殊工艺任务不能为空')
assertAll(pdaPrintTasks, 'PDA 印花任务必须属于 F090', (task) => task.assignedFactoryId === TEST_FACTORY_ID && task.assignedFactoryName === TEST_FACTORY_NAME)
assertAll(pdaDyeTasks, 'PDA 染色任务必须属于 F090', (task) => task.assignedFactoryId === TEST_FACTORY_ID && task.assignedFactoryName === TEST_FACTORY_NAME)
assertAll(pdaCuttingTasks, 'PDA 裁片任务必须属于 F090', (task) => task.assignedFactoryId === TEST_FACTORY_ID && task.assignedFactoryName === TEST_FACTORY_NAME)
assertAll(pdaSpecialTasks, 'PDA 特殊工艺任务必须属于 F090', (task) => task.assignedFactoryId === TEST_FACTORY_ID && task.assignedFactoryName === TEST_FACTORY_NAME)

const f090PdaTasks = listPdaGenericTasksByFactory(TEST_FACTORY_ID)
assert(f090PdaTasks.some((task) => task.taskId.startsWith('TASK-PRINT')), 'F090 移动端执行列表必须能检索到印花任务')
assert(f090PdaTasks.some((task) => task.taskId.startsWith('TASK-DYE')), 'F090 移动端执行列表必须能检索到染色任务')
assert(pdaCuttingTasks.some((task) => task.assignedFactoryId === TEST_FACTORY_ID), 'F090 移动端执行列表必须能检索到裁片任务')
assert(pdaSpecialTasks.some((task) => task.assignedFactoryId === TEST_FACTORY_ID), 'F090 移动端执行列表必须能检索到特殊工艺任务')

assertIncludes('src/pages/process-factory/printing/work-orders.ts', ['formatFactoryDisplayName', 'order.printFactoryName', 'order.printFactoryId'])
assertIncludes('src/pages/process-factory/printing/work-order-detail.ts', ['formatFactoryDisplayName', '工厂'])
assertIncludes('src/pages/process-factory/dyeing/work-orders.ts', ['formatFactoryDisplayName', 'order.dyeFactoryName', 'order.dyeFactoryId'])
assertIncludes('src/pages/process-factory/dyeing/work-order-detail.ts', ['formatFactoryDisplayName', '工厂'])
assertIncludes('src/pages/process-factory/cutting/merge-batches.ts', ['formatFactoryDisplayName', '工厂'])
assertIncludes('src/pages/process-factory/cutting/material-prep-model.ts', ['formatFactoryDisplayName'])
assertIncludes('src/pages/process-factory/special-craft/task-orders.ts', ['formatSpecialCraftFactoryLabel', 'taskOrder.factoryName', 'taskOrder.factoryId'])
assertIncludes('src/pages/process-factory/special-craft/task-detail.ts', ['formatSpecialCraftFactoryLabel', '执行工厂'])
assertIncludes('src/pages/process-factory/special-craft/work-order-detail.ts', ['formatSpecialCraftFactoryLabel', '工厂'])
assertIncludes('src/pages/pda-exec.ts', ['formatFactoryDisplayName', '当前工厂'])
assertIncludes('src/pages/pda-task-receive.ts', ['formatFactoryDisplayName', '当前工厂'])
assertIncludes('src/pages/pda-task-receive-detail.ts', ['formatFactoryDisplayName', '当前工厂'])

assertNoOldFactoryNames([
  'src/data/fcs/printing-task-domain.ts',
  'src/data/fcs/dyeing-task-domain.ts',
  'src/data/fcs/cutting/cut-piece-orders.ts',
  'src/data/fcs/cutting/material-prep.ts',
  'src/data/fcs/cutting/order-progress.ts',
  'src/data/fcs/cutting/pda-cutting-mock-matrix.ts',
  'src/data/fcs/cutting/pda-cutting-task-scenarios.ts',
  'src/data/fcs/cutting/special-craft-fei-ticket-flow.ts',
  'src/data/fcs/cutting/transfer-bag-runtime.ts',
  'src/data/fcs/pda-cutting-execution-source.ts',
  'src/data/fcs/pda-handover-events.ts',
  'src/data/fcs/pda-task-mock-factory.ts',
  'src/data/fcs/process-execution-writeback.ts',
  'src/data/fcs/runtime-process-tasks.ts',
  'src/data/fcs/special-craft-task-generation.ts',
  'src/data/fcs/special-craft-task-orders.ts',
  'src/data/fcs/warehouse-material-execution.ts',
])

for (const path of [
  'src/router/routes-fcs.ts',
  'src/router/route-renderers-fcs.ts',
  'src/data/fcs/fcs-route-links.ts',
]) {
  assert(existsSync(join(root, path)), `${path} 不存在`)
}

assert(read('docs/fcs-f090-demo-factory-unification.md').includes('统一演示工厂为全能力测试工厂F090'), '缺少 F090 统一说明文档')

console.log('F090 demo factory unification checks passed')

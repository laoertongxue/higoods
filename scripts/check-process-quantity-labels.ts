import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  listDyeWorkOrders,
  registerFormalProductionOrderDyeWorkOrder,
} from '../src/data/fcs/dyeing-task-domain.ts'
import { listPrintWorkOrders } from '../src/data/fcs/printing-task-domain.ts'
import { listProcessWorkOrders } from '../src/data/fcs/process-work-order-domain.ts'
import {
  buildQuantityField,
  formatProcessQuantity,
  formatProcessQuantityWithUnit,
  getProcessObjectType,
  getProcessQtyUnit,
  getQuantityLabel,
  isCutPieceQuantity,
  isFabricQuantity,
  isGarmentQuantity,
  isRollQuantity,
} from '../src/data/fcs/process-quantity-labels.ts'
import { validatePrintWorkOrderMobileTaskBinding } from '../src/data/fcs/process-mobile-task-binding.ts'
import { listMobileExecutionTasks } from '../src/data/fcs/mobile-execution-task-index.ts'
import { mapCraftStatusToPlatformStatus } from '../src/data/fcs/process-platform-status-adapter.ts'
import { listAvailableWebActions } from '../src/data/fcs/process-web-status-actions.ts'
import { executeProcessAction } from '../src/data/fcs/process-action-writeback-service.ts'
import { listGeneratedCutOrderSourceRecords } from '../src/data/fcs/cutting/generated-cut-orders.ts'
import { listSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'
import {
  deriveHandoutObjectProfile,
  type PdaHandoverHead,
} from '../src/data/fcs/pda-handover-events.ts'
import type { RuntimeProcessTask } from '../src/data/fcs/runtime-process-tasks.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`加工对象与数量单位检查失败：${message}`)
}

function assertIncludes(path: string, expected: string, message: string): void {
  const content = read(path)
  assert(content.includes(expected), `${message}：${path} 缺少 ${expected}`)
}

function assertNotIncludes(path: string, forbidden: string, message: string): void {
  const content = read(path)
  assert(!content.includes(forbidden), `${message}：${path} 不应出现 ${forbidden}`)
}

const modulePath = 'src/data/fcs/process-quantity-labels.ts'
assert(existsSync(join(root, modulePath)), '缺少 process-quantity-labels 模块')
assert(typeof getProcessObjectType === 'function', '缺少 getProcessObjectType')
assert(typeof getProcessQtyUnit === 'function', '缺少 getProcessQtyUnit')
assert(typeof getQuantityLabel === 'function', '缺少 getQuantityLabel')
assert(typeof formatProcessQuantity === 'function', '缺少 formatProcessQuantity')
assert(typeof formatProcessQuantityWithUnit === 'function', '缺少 formatProcessQuantityWithUnit')
assert(typeof buildQuantityField === 'function', '缺少 buildQuantityField')
assert(typeof isFabricQuantity === 'function', '缺少 isFabricQuantity')
assert(typeof isCutPieceQuantity === 'function', '缺少 isCutPieceQuantity')
assert(typeof isGarmentQuantity === 'function', '缺少 isGarmentQuantity')
assert(typeof isRollQuantity === 'function', '缺少 isRollQuantity')

assert(getQuantityLabel({ processType: 'PRINT', objectType: '面料', qtyUnit: '米', qtyPurpose: '计划' }) === '计划印花面料米数', '印花面料计划文案错误')
assert(getQuantityLabel({ processType: 'PRINT', objectType: '织带', qtyUnit: '米', qtyPurpose: '计划' }) === '计划印花织带米数', '印花织带计划文案错误')
assert(getQuantityLabel({ processType: 'PRINT', objectType: '花边', qtyUnit: '米', operationCode: 'PRINT_FINISH_TRANSFER', qtyPurpose: '已完成' }) === '转印完成花边米数', '印花花边转印文案错误')
assert(getProcessObjectType({ processType: 'PRINT', objectType: '裁片', qtyUnit: '片' }) === 'BOM原物料', '印花不得把已裁衣片解析为加工对象')
assert(getProcessObjectType({ processType: 'PRINT', objectType: '包装材料', qtyUnit: '个' }) === 'BOM原物料', '包装材料不得被“包”子串误判为数量包')
assert(getProcessQtyUnit({ processType: 'PRINT', objectType: 'BOM原物料', qtyUnit: '片' }) === '片', '印花单位必须保留实际 BOM 计量单位，不得用片数反推裁片对象')
assert(getQuantityLabel({ processType: 'DYE', qtyUnit: '米', qtyPurpose: '计划' }) === '计划染色面料米数', '染色计划文案错误')
assert(getQuantityLabel({ processType: 'DYE', qtyUnit: '卷', qtyPurpose: '已交出' }) === '交出卷数', '染色卷数文案错误')
assert(getProcessQtyUnit({ processType: 'DYE', objectType: '纱线', qtyUnit: 'kg' }) === '公斤', '纱线染色必须保留公斤单位')
assert(getQuantityLabel({ processType: 'DYE', objectType: '纱线', qtyUnit: 'kg', qtyPurpose: '计划' }) === '计划染色纱线公斤数', '纱线染色数量文案错误')
assert(getProcessQtyUnit({ processType: 'DYE', objectType: '花边', qtyUnit: '米' }) === '米', '花边染色必须保留米单位')
assert(getQuantityLabel({ processType: 'DYE', objectType: '花边', qtyUnit: '米', qtyPurpose: '已交出' }) === '已交出花边米数', '花边染色数量文案错误')
assert(getQuantityLabel({ processType: 'CUTTING', qtyUnit: '片', qtyPurpose: '计划' }) === '计划裁片数量', '裁片计划文案错误')
assert(getQuantityLabel({ processType: 'SPECIAL_CRAFT', qtyUnit: '片', qtyPurpose: '计划' }) === '计划特殊工艺裁片数量', '特殊工艺计划文案错误')
assert(getQuantityLabel({ processType: 'SPECIAL_CRAFT', objectType: '菲票', qtyUnit: '张', qtyPurpose: '绑定' }) === '绑定菲票数量', '菲票绑定文案错误')
assert(formatProcessQuantityWithUnit(320, { processType: 'PRINT', objectType: '花边', qtyUnit: '米' }) === '320 米', '数量格式必须带单位')
assert(buildQuantityField({ processType: 'SPECIAL_CRAFT', qtyUnit: '片', qtyPurpose: '已完成' }, 18).label === '加工完成裁片数量', 'buildQuantityField 标签错误')

const printOrders = listPrintWorkOrders()
const printMaterialOrders = printOrders.filter((order) => getProcessObjectType({
  processType: 'PRINT',
  objectType: order.objectType,
  qtyUnit: order.qtyUnit,
}) !== '裁片')
assert(printMaterialOrders.length === printOrders.length && printOrders.length >= 3, '印花演示数据必须全部是 BOM 原物料')
assert(printOrders.every((order) => order.qtyUnit !== '片'), '印花种子不得使用已裁衣片或片数单位')

const dyeOrders = listDyeWorkOrders()
assert(dyeOrders.length >= 3, '染色演示数据不足 3 条')
assert(dyeOrders.every((order) => getProcessObjectType({ processType: 'DYE', qtyUnit: order.qtyUnit }) === '面料'), '染色默认对象必须为面料')
assert(dyeOrders.every((order) => getProcessQtyUnit({ processType: 'DYE', qtyUnit: order.qtyUnit }) === '米'), '染色默认单位必须为米')
assert(dyeOrders.some((order) => Number(order.plannedRollCount || 0) > 0), '染色演示数据必须有卷数字段')

for (const material of [
  { suffix: 'YARN', type: '纱线', unit: 'kg', expectedLabel: '计划染色纱线公斤数' },
  { suffix: 'LACE', type: '花边', unit: '米', expectedLabel: '计划染色花边米数' },
] as const) {
  const workOrderId = `DYE-QTY-${material.suffix}`
  registerFormalProductionOrderDyeWorkOrder({
    workOrderId,
    workOrderNo: `RSJG-QTY-${material.suffix}`,
    sourceKey: `CHECK-QTY-${material.suffix}`,
    productionOrderId: `PO-QTY-${material.suffix}`,
    productionOrderNo: `PO-QTY-${material.suffix}`,
    orderedAt: '2026-09-07 09:00:00',
    techPackVersionId: `TP-QTY-${material.suffix}`,
    techPackVersionLabel: '对象数量专项技术包',
    materialId: `MAT-QTY-${material.suffix}`,
    materialName: `${material.type}染色物料`,
    materialItems: [{
      sourceBomItemId: `BOM-QTY-${material.suffix}`,
      materialId: `MAT-QTY-${material.suffix}`,
      materialName: `${material.type}染色物料`,
      materialType: material.type,
    }],
    targetColor: '藏青',
    plannedQty: 12,
    qtyUnit: material.unit,
    processCodes: ['DYE'],
    processName: '染色',
    factoryId: 'F090',
    factoryName: '全能力测试工厂',
    spuCode: `SPU-QTY-${material.suffix}`,
    spuName: `${material.type}染色专项款`,
    requiredDeliveryDate: '2026-09-15',
  })
  const mapped = listProcessWorkOrders('DYE').find((order) => order.workOrderId === workOrderId)
  assert(mapped?.objectType === material.type, `${material.type}染色加工单必须保存并展示实际 BOM 类型`)
  assert(mapped?.qtyLabel === material.expectedLabel, `${material.type}染色加工单数量标签必须跟随实际 BOM 单位`)
}

const dyeHandoverHead: PdaHandoverHead = {
  handoverId: 'CHECK-DYE-HANDOUT-OBJECT',
  headType: 'HANDOUT',
  qrCodeValue: 'CHECK-DYE-HANDOUT-OBJECT',
  taskId: 'CHECK-DYE-HANDOUT-TASK',
  taskNo: 'CHECK-DYE-HANDOUT-TASK',
  processName: '染色',
  processBusinessCode: 'DYE',
  sourceFactoryName: '染色工厂',
  targetName: '中转区域',
  targetKind: 'WAREHOUSE',
  qtyUnit: 'kg',
  factoryId: 'F090',
  taskStatus: 'IN_PROGRESS',
  summaryStatus: 'NONE',
  recordCount: 0,
  pendingWritebackCount: 0,
  writtenBackQtyTotal: 0,
  objectionCount: 0,
  completionStatus: 'OPEN',
  qtyExpectedTotal: 12,
  qtyActualTotal: 0,
  qtyDiffTotal: 12,
}
assert(
  deriveHandoutObjectProfile(
    dyeHandoverHead,
    [],
    { processBusinessCode: 'DYE', outputObjectType: 'YARN' } as RuntimeProcessTask,
  ).objectType === 'MATERIAL',
  '纱线、花边等非面料染色交出必须保持原物料对象，不能硬编码为面料',
)
assert(
  deriveHandoutObjectProfile(
    { ...dyeHandoverHead, qtyUnit: '米' },
    [],
    { processBusinessCode: 'DYE', outputObjectType: 'FABRIC' } as RuntimeProcessTask,
  ).objectType === 'FABRIC',
  '只有明确的面料染色任务才应进入面料交出视图',
)

const generatedCutOrders = listGeneratedCutOrderSourceRecords()
assert(generatedCutOrders.length >= 3, '正式裁片单演示数据不足 3 条')
assert(generatedCutOrders.filter((record) => record.requiredQty > 0 && record.pieceRows.length > 0).length >= 3, '正式裁片单必须能从生产单技术包快照取得裁片数量和部位')
const specialOrders = listSpecialCraftTaskOrders()
assert(specialOrders.length >= 3, '特殊工艺演示数据不足 3 条')
assert(specialOrders.every((order) => ['片', '件', '个', '条', '张'].includes(order.unit)), '特殊工艺执行单位必须匹配裁片、成衣或辅件产出口径')
assert(specialOrders.some((order) => order.feiTicketNos.length > 0), '特殊工艺必须能展示菲票数量')

assertIncludes('src/pages/process-factory/printing/work-orders.ts', 'formatPrintingQty', '印花列表必须使用统一数量格式')
assertIncludes('src/pages/process-factory/printing/work-orders.ts', 'order.plannedInput.objectType', '印花列表必须展示实际 BOM 原物料类型')
assertIncludes('src/pages/process-factory/printing/work-order-detail.ts', 'formatPrintingQty', '印花详情必须使用统一数量格式')
assertIncludes('src/pages/process-factory/printing/work-order-detail.ts', 'order.plannedInput.objectType', '印花详情必须展示实际 BOM 原物料类型')
assertIncludes('src/pages/pda-exec.ts', 'formatProcessQuantityWithUnit', '移动端列表必须使用统一数量文案')
assertIncludes('src/pages/pda-exec-detail.ts', 'qtyLabel', '移动端写回必须携带 qtyLabel')
assertIncludes('src/pages/process-print-orders.ts', 'plannedQtyLabel', '平台印花页必须展示对象化数量标签')
assertIncludes('src/pages/process-dye-orders.ts', 'plannedQtyLabel', '平台染色页必须使用加工单运行时数量标签')
assertIncludes('src/pages/print/task-card-shared.ts', '完成对象数量（按单据单位）', '打印模板不得只写完成数量')
assertIncludes('src/data/fcs/task-print-cards.ts', 'getQuantityLabel', '打印卡片必须使用统一数量文案')
assertIncludes('src/pages/process-factory/special-craft/task-orders.ts', '数量进度', '特殊工艺列表必须显示数量进度')
assertIncludes('src/pages/process-factory/special-craft/task-detail.ts', '菲票号', '裁片特殊工艺任务详情必须展示菲票关系')

assertIncludes('src/data/fcs/process-action-writeback-service.ts', 'objectType', '写回 payload 必须包含 objectType')
assertIncludes('src/data/fcs/process-action-writeback-service.ts', 'objectQty', '写回 payload 必须包含 objectQty')
assertIncludes('src/data/fcs/process-action-writeback-service.ts', 'qtyUnit', '写回 payload 必须包含 qtyUnit')
assertIncludes('src/data/fcs/process-action-writeback-service.ts', 'qtyLabel', '写回 payload 必须包含 qtyLabel')
assertIncludes('src/pages/pda-exec-detail.ts', 'objectType', '移动端状态操作必须传 objectType')
assertIncludes('src/pages/pda-exec-detail.ts', 'objectQty', '移动端状态操作必须传 objectQty')
assertIncludes('src/pages/pda-exec-detail.ts', 'qtyUnit', '移动端状态操作必须传 qtyUnit')

assertNotIncludes('src/pages/process-dye-orders.ts', '染色裁片数量', '染色不得显示裁片数量')
assertNotIncludes('src/pages/pda-exec-detail.ts', '计划印花面料米数：320 片', '印花对象与数量单位不得矛盾')
assertIncludes('src/data/fcs/process-action-writeback-service.ts', 'objectQty: qty', '统一写回服务必须把数量收口为 objectQty')
assertNotIncludes('src/data/fcs/process-action-writeback-service.ts', '开扣眼', '特殊工艺动作不得新增开扣眼')
assertNotIncludes('src/data/fcs/process-action-writeback-service.ts', '装扣子', '特殊工艺动作不得新增装扣子')
assertNotIncludes('src/data/fcs/process-action-writeback-service.ts', '烫包', '特殊工艺动作不得新增后道烫包')

const printMobileBinding = validatePrintWorkOrderMobileTaskBinding('PWO-PRINT-001')
assert(printMobileBinding.isBound && printMobileBinding.isTaskFound, '第 2 步加工单与来源任务绑定校验回退')
const f090MobileTasks = listMobileExecutionTasks({ currentFactoryId: 'F090' })
assert(
  printMobileBinding.canOpenMobileExecution
    ? f090MobileTasks.some((task) => task.taskId === printMobileBinding.actualTaskId)
    : !f090MobileTasks.some((task) => task.taskId === printMobileBinding.actualTaskId),
  '第 3 步移动端执行列表必须服从接单门禁',
)
assert(mapCraftStatusToPlatformStatus({ processType: 'PRINT', craftStatusLabel: '打印中' }).platformStatusLabel === '加工中', '第 4 步平台状态映射回退')
assert(listAvailableWebActions('PRINT_WORK_ORDER', 'PWO-PRINT-011').some((action) => action.actionCode === 'PRINT_START_PRINTING'), '第 5 步 Web 状态操作回退')
assert(typeof executeProcessAction === 'function', '第 6 步共用写回服务回退')

assertIncludes('docs/fcs-process-quantity-labels.md', '读取工艺类型', '缺少数量文案文档流程图')
assertIncludes('docs/fcs-process-quantity-labels.md', '待识别', '缺少数量文案文档状态机')

console.log('process quantity label checks passed')

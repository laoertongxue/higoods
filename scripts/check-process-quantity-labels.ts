import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { listDyeWorkOrders } from '../src/data/fcs/dyeing-task-domain.ts'
import { listPrintWorkOrders } from '../src/data/fcs/printing-task-domain.ts'
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
import { cutPieceOrderRecords } from '../src/data/fcs/cutting/cut-piece-orders.ts'
import { listSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'

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
assert(getQuantityLabel({ processType: 'PRINT', objectType: '裁片', qtyUnit: '片', qtyPurpose: '计划' }) === '计划印花裁片数量', '印花裁片计划文案错误')
assert(getQuantityLabel({ processType: 'PRINT', objectType: '裁片', qtyUnit: '片', operationCode: 'PRINT_FINISH_TRANSFER', qtyPurpose: '已完成' }) === '转印完成裁片数量', '印花裁片转印文案错误')
assert(getQuantityLabel({ processType: 'DYE', qtyUnit: '米', qtyPurpose: '计划' }) === '计划染色面料米数', '染色计划文案错误')
assert(getQuantityLabel({ processType: 'DYE', qtyUnit: '卷', qtyPurpose: '已交出' }) === '交出卷数', '染色卷数文案错误')
assert(getQuantityLabel({ processType: 'CUTTING', qtyUnit: '片', qtyPurpose: '计划' }) === '计划裁片数量', '裁片计划文案错误')
assert(getQuantityLabel({ processType: 'SPECIAL_CRAFT', qtyUnit: '片', qtyPurpose: '计划' }) === '计划特殊工艺裁片数量', '特殊工艺计划文案错误')
assert(getQuantityLabel({ processType: 'SPECIAL_CRAFT', objectType: '菲票', qtyUnit: '张', qtyPurpose: '绑定' }) === '绑定菲票数量', '菲票绑定文案错误')
assert(formatProcessQuantityWithUnit(320, { processType: 'PRINT', objectType: '裁片', qtyUnit: '片' }) === '320 片', '数量格式必须带单位')
assert(buildQuantityField({ processType: 'SPECIAL_CRAFT', qtyUnit: '片', qtyPurpose: '已完成' }, 18).label === '加工完成裁片数量', 'buildQuantityField 标签错误')

const printOrders = listPrintWorkOrders()
const fabricPrintOrders = printOrders.filter((order) => getProcessObjectType({
  processType: 'PRINT',
  objectType: order.objectType,
  qtyUnit: order.qtyUnit,
  isFabricPrinting: order.isFabricPrinting,
  isPiecePrinting: order.isPiecePrinting,
}) === '面料')
const piecePrintOrders = printOrders.filter((order) => getProcessObjectType({
  processType: 'PRINT',
  objectType: order.objectType,
  qtyUnit: order.qtyUnit,
  isFabricPrinting: order.isFabricPrinting,
  isPiecePrinting: order.isPiecePrinting,
}) === '裁片')
assert(fabricPrintOrders.length >= 3, '印花面料场景演示数据不足 3 条')
assert(piecePrintOrders.length >= 3, '印花裁片场景演示数据不足 3 条')
assert(piecePrintOrders.every((order) => getQuantityLabel({
  processType: 'PRINT',
  objectType: order.objectType,
  qtyUnit: order.qtyUnit,
  qtyPurpose: '计划',
}) === '计划印花裁片数量'), '印花裁片场景不得显示面料米数')

const dyeOrders = listDyeWorkOrders()
assert(dyeOrders.length >= 3, '染色演示数据不足 3 条')
assert(dyeOrders.every((order) => getProcessObjectType({ processType: 'DYE', qtyUnit: order.qtyUnit }) === '面料'), '染色默认对象必须为面料')
assert(dyeOrders.every((order) => getProcessQtyUnit({ processType: 'DYE', qtyUnit: order.qtyUnit }) === '米'), '染色默认单位必须为米')
assert(dyeOrders.some((order) => Number(order.plannedRollCount || 0) > 0), '染色演示数据必须有卷数字段')

assert(cutPieceOrderRecords.length >= 3, '裁片演示数据不足 3 条')
assert(cutPieceOrderRecords.filter((record) => (record.markerInfo.totalPieces || record.orderQty || 0) > 0).length >= 3, '裁片执行数量必须能取到裁片数量')
const specialOrders = listSpecialCraftTaskOrders()
assert(specialOrders.length >= 3, '特殊工艺演示数据不足 3 条')
assert(specialOrders.every((order) => order.unit === '片'), '特殊工艺执行单位必须为片')
assert(specialOrders.some((order) => order.feiTicketNos.length > 0), '特殊工艺必须能展示菲票数量')

assertIncludes('src/pages/process-factory/printing/work-orders.ts', 'getPrintQuantityLabel', '印花列表必须使用统一数量文案')
assertIncludes('src/pages/process-factory/printing/work-order-detail.ts', 'getPrintQuantityLabel', '印花详情必须使用统一数量文案')
assertIncludes('src/pages/pda-exec.ts', 'formatProcessQuantityWithUnit', '移动端列表必须使用统一数量文案')
assertIncludes('src/pages/pda-exec-detail.ts', 'qtyLabel', '移动端写回必须携带 qtyLabel')
assertIncludes('src/pages/process-print-orders.ts', 'plannedQtyLabel', '平台印花页必须展示对象化数量标签')
assertIncludes('src/pages/process-dye-orders.ts', '计划染色面料米数', '平台染色页必须展示面料米数')
assertIncludes('src/pages/print/task-card-shared.ts', '完成对象数量（按单据单位）', '打印模板不得只写完成数量')
assertIncludes('src/data/fcs/task-print-cards.ts', 'getQuantityLabel', '打印卡片必须使用统一数量文案')
assertIncludes('src/pages/process-factory/special-craft/task-orders.ts', '当前裁片数量', '特殊工艺列表必须显示裁片数量')
assertIncludes('src/pages/process-factory/special-craft/work-order-detail.ts', '绑定菲票', '特殊工艺详情必须展示菲票关系')

assertIncludes('src/data/fcs/process-action-writeback-service.ts', 'objectType', '写回 payload 必须包含 objectType')
assertIncludes('src/data/fcs/process-action-writeback-service.ts', 'objectQty', '写回 payload 必须包含 objectQty')
assertIncludes('src/data/fcs/process-action-writeback-service.ts', 'qtyUnit', '写回 payload 必须包含 qtyUnit')
assertIncludes('src/data/fcs/process-action-writeback-service.ts', 'qtyLabel', '写回 payload 必须包含 qtyLabel')
assertIncludes('src/pages/pda-exec-detail.ts', 'objectType', '移动端状态操作必须传 objectType')
assertIncludes('src/pages/pda-exec-detail.ts', 'objectQty', '移动端状态操作必须传 objectQty')
assertIncludes('src/pages/pda-exec-detail.ts', 'qtyUnit', '移动端状态操作必须传 qtyUnit')

assertNotIncludes('src/pages/process-dye-orders.ts', '染色裁片数量', '染色不得显示裁片数量')
assertNotIncludes('src/pages/pda-exec-detail.ts', '计划印花面料米数：320 片', '印花裁片不得显示为面料米数')
assertIncludes('src/data/fcs/process-action-writeback-service.ts', 'objectQty: qty', '统一写回服务必须把数量收口为 objectQty')
assertNotIncludes('src/data/fcs/process-action-writeback-service.ts', '开扣眼', '特殊工艺动作不得新增开扣眼')
assertNotIncludes('src/data/fcs/process-action-writeback-service.ts', '装扣子', '特殊工艺动作不得新增装扣子')
assertNotIncludes('src/data/fcs/process-action-writeback-service.ts', '熨烫', '特殊工艺动作不得新增熨烫')

assert(validatePrintWorkOrderMobileTaskBinding('PWO-PRINT-001').reasonCode === 'OK', '第 2 步绑定校验回退')
assert(listMobileExecutionTasks({ currentFactoryId: 'F090' }).some((task) => task.taskId === 'TASK-PRINT-000716'), '第 3 步移动端执行列表回退')
assert(mapCraftStatusToPlatformStatus({ processType: 'PRINT', craftStatusLabel: '打印中' }).platformStatusLabel === '加工中', '第 4 步平台状态映射回退')
assert(listAvailableWebActions('PRINT_WORK_ORDER', 'PWO-PRINT-011').some((action) => action.actionCode === 'PRINT_START_PRINTING'), '第 5 步 Web 状态操作回退')
assert(typeof executeProcessAction === 'function', '第 6 步共用写回服务回退')

assertIncludes('docs/fcs-process-quantity-labels.md', '读取工艺类型', '缺少数量文案文档流程图')
assertIncludes('docs/fcs-process-quantity-labels.md', '待识别', '缺少数量文案文档状态机')

console.log('process quantity label checks passed')

import assert from 'node:assert/strict'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import { assertFirstFormalProduction } from '../src/data/pcs-engineering-first-production-policy.ts'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { productionDemands } from '../src/data/fcs/production-demands.ts'
import * as formalProductionOrderFactIndex from '../src/data/fcs/production-order-formal-fact-index.ts'
import {
  createEngineeringMasterOrder,
  createSystemEngineeringMasterOrder,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
} from '../src/data/pcs-engineering-master-repository.ts'

resetStyleArchiveRepository()
resetEngineeringMasterRepository()

const freshStyle = listStyleArchives()[0]
assert.ok(freshStyle, '应存在正式款式档案演示数据')

function buildCreateInput(style: typeof freshStyle) {
  return {
    styleId: style.styleId,
    styleCode: style.styleCode,
    merchandiserId: 'USER-M-C',
    merchandiserName: '跟单C',
    createdById: 'USER-M-C',
    createdBy: '跟单C',
    createdByRole: '跟单',
    preparationType: 'PURE_WOVEN' as const,
    qualificationFact: {
      styleCode: style.styleCode,
      formalSaleStatus: 'NO_FORMAL_SALE' as const,
      formalProductionStatus: 'NO_FORMAL_PRODUCTION' as const,
      formalSaleSource: '正式销售订单事实',
      formalProductionSource: '正式生产单事实',
      checkedAt: '2026-08-04 09:00:00',
    },
    bulkProductionQualification: {
      basisType: 'TEST_APPROVED' as const,
      triggerBusinessObjectType: '测款结果',
      triggerBusinessObjectId: `TEST-${style.styleCode}`,
      thresholdQuantity: 300,
      reachedQuantity: 320,
      reachedAt: '2026-08-04 09:00:00',
      reason: '已满足做大货要求',
      uniqueTriggerKey: `TEST-${style.styleCode}`,
    },
    creationReason: '跟单核实后人工创建',
  }
}

// 首单门禁必须直接读取生产单运行态事实，而不是维护另一份静态状态副本。
const runtimeOrderFact = structuredClone(productionOrders[0])
runtimeOrderFact.productionOrderId = 'PO-FIRST-ORDER-RUNTIME-FACT'
runtimeOrderFact.productionOrderNo = 'PO-FIRST-ORDER-RUNTIME-FACT'
runtimeOrderFact.demandSnapshot.spuCode = 'SPU-FIRST-ORDER-RUNTIME-FACT'
runtimeOrderFact.status = 'EXECUTING'
productionOrders.push(runtimeOrderFact)
assert.throws(
  () => assertFirstFormalProduction(runtimeOrderFact.demandSnapshot.spuCode),
  /已经正式生产过/,
  '新增执行中生产单必须立即进入首单门禁',
)
runtimeOrderFact.status = 'CANCELLED'
assert.doesNotThrow(
  () => assertFirstFormalProduction(runtimeOrderFact.demandSnapshot.spuCode),
  '同一生产单改为已取消后必须立即退出首单门禁',
)
productionOrders.pop()

const { state: productionRuntimeState } = await import('../src/pages/production/context.ts')
assert.equal(productionRuntimeState.orders, productionOrders, '页面运行态和首单门禁必须共享同一生产单数组')
assert.deepEqual(
  Object.keys(formalProductionOrderFactIndex).sort(),
  ['hasFormalProductionOrderFact', 'listProductionOrderFormalFacts'],
  '正式生产事实索引不得公开注册、替换或清空入口',
)
const restoredRuntimeOrder = structuredClone(productionOrders[0])
restoredRuntimeOrder.productionOrderId = 'PO-FIRST-ORDER-RUNTIME-RESTORE'
restoredRuntimeOrder.productionOrderNo = 'PO-FIRST-ORDER-RUNTIME-RESTORE'
restoredRuntimeOrder.demandSnapshot.spuCode = 'SPU-FIRST-ORDER-RUNTIME-RESTORE'
restoredRuntimeOrder.status = 'EXECUTING'
productionOrders.push(restoredRuntimeOrder)
assert.throws(
  () => assertFirstFormalProduction(restoredRuntimeOrder.demandSnapshot.spuCode),
  /已经正式生产过/,
  '页面上下文加载后，经导出的生产单数组新增正式生产单仍必须立即进入首单门禁',
)
restoredRuntimeOrder.status = 'CANCELLED'
assert.doesNotThrow(
  () => assertFirstFormalProduction(restoredRuntimeOrder.demandSnapshot.spuCode),
  '同一事实源中的生产单改为已取消后必须立即退出首单门禁',
)
productionOrders.splice(productionOrders.indexOf(restoredRuntimeOrder), 1)

// 首次正式生产校验：已正式生产款式必须阻断
assert.throws(() => assertFirstFormalProduction('SPU-2024-001'), /已经正式生产过/)
for (const order of productionOrders.filter((item) => !['DRAFT', 'CANCELLED', 'ON_HOLD'].includes(item.status))) {
  assert.throws(
    () => assertFirstFormalProduction(order.demandSnapshot.spuCode),
    /已经正式生产过/,
    `正式生产单 ${order.productionOrderId} 的款式必须被首单门禁识别`,
  )
}
assert.throws(
  () => assertFirstFormalProduction('ASYSA26060310'),
  /已经正式生产过/,
  '即使生产需求 Seed 缺失，独立正式生产单也必须被首单门禁识别',
)
const derivedDemandFact = {
  ...structuredClone(productionDemands[0]),
  demandId: 'DEM-FIRST-ORDER-GATE-TEST',
  spuCode: 'SPU-FIRST-ORDER-GATE-TEST',
  demandStatus: 'CONVERTED' as const,
  hasProductionOrder: true,
  productionOrderId: 'PO-FIRST-ORDER-GATE-TEST',
}
productionDemands.push(derivedDemandFact)
assert.throws(
  () => assertFirstFormalProduction(derivedDemandFact.spuCode),
  /已经正式生产过/,
  '新增已转单需求必须自动进入正式生产事实索引',
)
productionDemands.pop()
assert.doesNotThrow(() => assertFirstFormalProduction(freshStyle.styleCode))

// 无商品／款式档案禁止创建工程主单
assert.throws(
  () =>
    createEngineeringMasterOrder({
      ...buildCreateInput(freshStyle),
      styleId: 'STYLE-NOT-EXIST',
      styleCode: 'SPU-NOT-EXIST',
      qualificationFact: { ...buildCreateInput(freshStyle).qualificationFact, styleCode: 'SPU-NOT-EXIST' },
    }),
  /档案/,
  '无款式档案必须阻断创建',
)

const systemMaster = createSystemEngineeringMasterOrder({
  ...buildCreateInput(freshStyle),
  creationReason: '达到做大货条件后由系统自动创建',
})
assert.equal(systemMaster.creationMode, 'SYSTEM', '系统触发必须留下自动创建方式')
assert.equal(systemMaster.status, '草稿', '自动创建后也必须先进入任务方案确认')
const repeatedSystemMaster = createSystemEngineeringMasterOrder({
  ...buildCreateInput(freshStyle),
  creationReason: '重复消费同一做大货资格事件',
})
assert.equal(repeatedSystemMaster.masterOrderId, systemMaster.masterOrderId, '同一系统触发标识必须幂等复用原主单')
resetEngineeringMasterRepository()

// 创建工程主单：初始为草稿，不生成任务骨架
const master = createEngineeringMasterOrder(buildCreateInput(freshStyle))
assert.equal(master.status, '草稿')
assert.equal(master.tasks.length, 0, '草稿阶段不生成任务骨架')

// 同一款式重复创建未关闭主单必须阻断
assert.throws(
  () =>
    createEngineeringMasterOrder(buildCreateInput(freshStyle)),
  /未关闭的工程主单/,
  '同一款式已存在未关闭主单必须阻断',
)

// 发布主单：一次性生成 10 张专业任务骨架
const published = publishEngineeringMasterOrder(master.masterOrderId)
assert.equal(published.status, '已发布')
assert.equal(published.tasks.length, 10, '发布时一次性生成 10 类专业任务')

const statusByType = Object.fromEntries(published.tasks.map((task) => [task.taskType, task.status]))
assert.equal(statusByType.BASE_PATTERN_WOVEN, '待开始', '基码无前置，初始待开始')
assert.equal(statusByType.BASE_PATTERN_KNIT, '未启用', '纯梭织不启用毛织基码')
assert.equal(statusByType.PRE_PRODUCTION_SAMPLE, '待前置', '首单样衣等待梭织基码')
assert.equal(statusByType.SIZE_PATTERN_WOVEN, '待前置', '齐码等待首单样衣')
assert.equal(statusByType.PATTERN_ARTWORK, '未启用', '花型为条件任务，初始未启用')
assert.equal(statusByType.COLOR_YARN, '未启用', '纱线调色为条件任务，初始未启用')
assert.equal(statusByType.COLOR_FABRIC, '未启用', '面料调色为条件任务，初始未启用')
assert.equal(statusByType.ACCESSORY_PURCHASE, '未启用', '无 BOM 采购需求时辅料下单不启用')
assert.equal(statusByType.TECH_PACK_CONFIRMATION, '待前置', '技术包确认有前置，初始待前置')

// 任务依赖必须指向同主单内任务，且只从固定策略复制
const sampleTask = published.tasks.find((task) => task.taskType === 'PRE_PRODUCTION_SAMPLE')
assert.ok(sampleTask, '应存在首单样衣任务')
assert.deepEqual(sampleTask.dependsOnTaskIds, [
  `${master.masterOrderId}-BASE_PATTERN_WOVEN`,
])

const techPackTask = published.tasks.find((task) => task.taskType === 'TECH_PACK_CONFIRMATION')
assert.ok(techPackTask, '应存在技术包确认任务')
assert.equal(techPackTask.dependsOnTaskIds.length, 3, '技术包确认只依赖纯梭织已启用的三张专业任务')

// 重复发布阻断
assert.throws(() => publishEngineeringMasterOrder(master.masterOrderId), /草稿/)

console.log('pcs-engineering-master-domain.spec.ts PASS')

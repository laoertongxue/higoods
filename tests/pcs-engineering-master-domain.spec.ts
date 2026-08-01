import assert from 'node:assert/strict'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import { assertFirstFormalProduction } from '../src/data/pcs-engineering-first-production-policy.ts'
import {
  createEngineeringMasterOrder,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
} from '../src/data/pcs-engineering-master-repository.ts'

resetStyleArchiveRepository()
resetEngineeringMasterRepository()

const freshStyle = listStyleArchives()[0]
assert.ok(freshStyle, '应存在正式款式档案演示数据')

// 首次正式生产校验：已正式生产款式必须阻断
assert.throws(() => assertFirstFormalProduction('SPU-2024-001'), /已经正式生产过/)
assert.doesNotThrow(() => assertFirstFormalProduction(freshStyle.styleCode))

// 无商品／款式档案禁止创建工程主单
assert.throws(
  () =>
    createEngineeringMasterOrder({
      styleId: 'STYLE-NOT-EXIST',
      styleCode: 'SPU-NOT-EXIST',
      merchandiserName: '跟单C',
    }),
  /档案/,
  '无款式档案必须阻断创建',
)

// 创建工程主单：初始为草稿，不生成任务骨架
const master = createEngineeringMasterOrder({
  styleId: freshStyle.styleId,
  styleCode: freshStyle.styleCode,
  merchandiserName: '跟单C',
})
assert.equal(master.status, '草稿')
assert.equal(master.tasks.length, 0, '草稿阶段不生成任务骨架')

// 同一款式重复创建未关闭主单必须阻断
assert.throws(
  () =>
    createEngineeringMasterOrder({
      styleId: freshStyle.styleId,
      styleCode: freshStyle.styleCode,
      merchandiserName: '跟单C',
    }),
  /未关闭的工程主单/,
  '同一款式已存在未关闭主单必须阻断',
)

// 发布主单：一次性生成 10 张专业任务骨架
const published = publishEngineeringMasterOrder(master.masterOrderId)
assert.equal(published.status, '已发布')
assert.equal(published.tasks.length, 10, '发布时一次性生成 10 类专业任务')

const statusByType = Object.fromEntries(published.tasks.map((task) => [task.taskType, task.status]))
assert.equal(statusByType.BASE_PATTERN_WOVEN, '待开始', '基码无前置，初始待开始')
assert.equal(statusByType.BASE_PATTERN_KNIT, '待开始', '毛织基码无前置，初始待开始')
assert.equal(statusByType.PRE_PRODUCTION_SAMPLE, '待前置', '产前版样衣等待全部基码')
assert.equal(statusByType.SIZE_PATTERN_WOVEN, '待前置', '齐码等待产前版样衣')
assert.equal(statusByType.PATTERN_ARTWORK, '未启用', '花型为条件任务，初始未启用')
assert.equal(statusByType.COLOR_YARN, '未启用', '纱线调色为条件任务，初始未启用')
assert.equal(statusByType.COLOR_FABRIC, '未启用', '面料调色为条件任务，初始未启用')
assert.equal(statusByType.ACCESSORY_PURCHASE, '待开始', '辅料下单与纸样链并行，初始待开始')
assert.equal(statusByType.TECH_PACK_CONFIRMATION, '待前置', '技术包确认有前置，初始待前置')

// 任务依赖必须指向同主单内任务，且只从固定策略复制
const sampleTask = published.tasks.find((task) => task.taskType === 'PRE_PRODUCTION_SAMPLE')
assert.ok(sampleTask, '应存在产前版样衣任务')
assert.deepEqual(sampleTask.dependsOnTaskIds, [
  `${master.masterOrderId}-BASE_PATTERN_WOVEN`,
  `${master.masterOrderId}-BASE_PATTERN_KNIT`,
])

const techPackTask = published.tasks.find((task) => task.taskType === 'TECH_PACK_CONFIRMATION')
assert.ok(techPackTask, '应存在技术包确认任务')
assert.equal(techPackTask.dependsOnTaskIds.length, 9, '技术包确认依赖其余全部专业任务')

// 重复发布阻断
assert.throws(() => publishEngineeringMasterOrder(master.masterOrderId), /草稿/)

console.log('pcs-engineering-master-domain.spec.ts PASS')

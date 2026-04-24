import assert from 'node:assert/strict'

import { resetPatternTaskRepository } from '../src/data/pcs-pattern-task-repository.ts'
import { resetPlateMakingTaskRepository } from '../src/data/pcs-plate-making-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import { createPatternTask, createPlateMakingTask } from '../src/data/pcs-task-project-relation-writeback.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetStyleArchiveRepository()
resetPlateMakingTaskRepository()
resetPatternTaskRepository()

const style = listStyleArchives()[0]
assert.ok(style, '应存在正式款式档案演示数据')

const standalonePlate = createPlateMakingTask({
  projectId: '',
  styleId: style.styleId,
  title: '独立制版任务',
  sourceType: '人工创建',
  ownerName: '王版师',
  patternMakerName: '王版师',
  productHistoryType: '未卖过',
  patternArea: '印尼',
  patternType: '常规制版',
  sizeRange: 'S-XL',
  operatorName: '测试用户',
})

assert.equal(standalonePlate.ok, true, '独立制版任务应允许仅关联正式款式档案创建')
if (standalonePlate.ok) {
  assert.equal(standalonePlate.task.projectId, '', '独立制版任务不应强制关联商品项目')
  assert.equal(standalonePlate.task.styleId, style.styleId, '独立制版任务应写入正式款式档案')
  assert.equal(standalonePlate.relation, null, '独立制版任务不应写项目关系')
}

const standalonePattern = createPatternTask({
  projectId: '',
  styleId: style.styleId,
  title: '独立花型任务',
  sourceType: '人工创建',
  ownerName: '林小美',
  demandSourceType: '设计师款',
  processType: '数码印',
  requestQty: 1,
  fabricSku: 'FAB-001',
  demandImageIds: ['mock://pattern-demand-1.png'],
  assignedTeamCode: 'CN_TEAM',
  assignedMemberId: 'cn_bing_bing',
  artworkName: '热带花型',
  operatorName: '测试用户',
})

assert.equal(standalonePattern.ok, true, '独立花型任务应允许仅关联正式款式档案创建')
if (standalonePattern.ok) {
  assert.equal(standalonePattern.task.projectId, '', '独立花型任务不应强制关联商品项目')
  assert.equal(standalonePattern.task.styleId, style.styleId, '独立花型任务应写入正式款式档案')
  assert.equal(standalonePattern.relation, null, '独立花型任务不应写项目关系')
}

const noStylePlate = createPlateMakingTask({
  projectId: '',
  title: '缺款式档案制版任务',
  sourceType: '人工创建',
  ownerName: '王版师',
  patternMakerName: '王版师',
  productHistoryType: '未卖过',
  patternArea: '印尼',
  patternType: '常规制版',
  sizeRange: 'S-XL',
  operatorName: '测试用户',
})
assert.equal(noStylePlate.ok, false, '独立制版任务未选款式档案时应失败')

const noStylePattern = createPatternTask({
  projectId: '',
  title: '缺款式档案花型任务',
  sourceType: '人工创建',
  ownerName: '林小美',
  demandSourceType: '设计师款',
  processType: '数码印',
  requestQty: 1,
  fabricSku: 'FAB-001',
  demandImageIds: ['mock://pattern-demand-1.png'],
  assignedTeamCode: 'CN_TEAM',
  assignedMemberId: 'cn_bing_bing',
  artworkName: '热带花型',
  operatorName: '测试用户',
})
assert.equal(noStylePattern.ok, false, '独立花型任务未选款式档案时应失败')

console.log('pcs-engineering-task-binding-mode.spec.ts PASS')

import assert from 'node:assert/strict'

import { getLiveProductLineById } from '../src/data/pcs-live-testing-repository.ts'
import {
  listProjectRelationsByProject,
  listProjectRelationsByVideoRecord,
} from '../src/data/pcs-project-relation-repository.ts'
import { getProjectStoreSnapshot } from '../src/data/pcs-project-repository.ts'
import { buildProjectDetailViewModel } from '../src/data/pcs-project-view-model.ts'
import { buildLiveProductLineProjectRelation } from '../src/data/pcs-testing-relation-normalizer.ts'
import { resetProjectBusinessChainRepositories } from './pcs-project-formal-chain-helper.ts'

resetProjectBusinessChainRepositories()

const project025 = getProjectStoreSnapshot().projects.find((item) => item.projectCode === 'PRJ-20251216-025')
assert.ok(project025, '应存在历史淘汰项目 025')

const detail025 = buildProjectDetailViewModel(project025!.projectId)
assert.ok(detail025, '项目详情首次渲染应成功')
assert.ok(
  detail025!.relationSection.totalCount > 0,
  '项目详情首次渲染时应已准备好正式关系，不依赖其他页面链路预热',
)

const replayedRelations025 = listProjectRelationsByProject(project025!.projectId)
const liveRelation025 = replayedRelations025.find(
  (item) =>
    item.sourceModule === '直播' &&
    item.sourceObjectType === '直播商品明细' &&
    item.sourceLineCode === 'LS-20260406-025-L01',
)
assert.ok(liveRelation025, '历史淘汰项目 025 应回放正式直播测款关系')
assert.ok(
  detail025!.timeline.some(
    (item) => item.time === '2026-04-06 09:50' && /(渠道商品已作废|当前节点已取消|当前阶段已终止)/u.test(item.title),
  ),
  '终止项目 025 的项目动态应出现 2026-04-06 09:50 的真实业务事件',
)

const project024 = getProjectStoreSnapshot().projects.find((item) => item.projectCode === 'PRJ-20251216-024')
assert.ok(project024, '应存在历史混合测款项目 024')

buildProjectDetailViewModel(project024!.projectId)
const replayedRelations024 = listProjectRelationsByProject(project024!.projectId)
assert.ok(
  replayedRelations024.some(
    (item) =>
      item.sourceModule === '直播' &&
      item.sourceObjectType === '直播商品明细' &&
      item.sourceLineCode === 'LS-20260405-024-L01',
  ),
  '历史混合项目 024 应回放正式直播测款关系',
)
assert.ok(
  replayedRelations024.some(
    (item) =>
      item.sourceModule === '短视频' &&
      item.sourceObjectType === '短视频记录' &&
      item.sourceObjectCode === 'SV-PJT-024',
  ),
  '历史混合项目 024 应回放正式短视频测款关系',
)
assert.ok(
  listProjectRelationsByVideoRecord('SV-PJT-024').some((item) => item.projectId === project024!.projectId),
  '短视频正式关系查询也应能命中历史混合项目 024',
)

const currentGateLine025 = getLiveProductLineById('LS-20260406-025__item-001')
assert.ok(currentGateLine025, '应存在 025 的历史直播商品明细')
const currentGateResult025 = buildLiveProductLineProjectRelation(currentGateLine025!, project025!.projectId, {
  operatorName: '测试用户',
})
assert.equal(currentGateResult025.relation, null, '当前用户入口仍应保留正式门禁，不应放开历史淘汰项目')
assert.match(
  currentGateResult025.errorMessage || '',
  /(已作废|不能建立正式直播测款关系)/u,
  '当前用户入口应继续返回明确中文门禁原因',
)

console.log('pcs-project-detail-formal-relation-replay.spec.ts PASS')

import assert from 'node:assert/strict'

import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
  updateProjectNodeRecord,
  updateProjectRecord,
} from '../src/data/pcs-project-repository.ts'
import {
  replaceLiveProductLineProjectRelations,
  replaceVideoRecordProjectRelations,
  resetProjectRelationRepository,
} from '../src/data/pcs-project-relation-repository.ts'
import {
  createProjectChannelProductFromListingNode,
  launchProjectChannelProductListing,
  listProjectChannelProductsByProjectId,
  resetProjectChannelProductRepository,
  submitProjectTestingConclusion,
  submitProjectTestingSummary,
} from '../src/data/pcs-channel-product-project-repository.ts'
import { getRevisionTaskById, resetRevisionTaskRepository } from '../src/data/pcs-revision-task-repository.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'

function resetRepositories() {
  resetProjectRepository()
  resetProjectRelationRepository()
  resetProjectChannelProductRepository()
  resetRevisionTaskRepository()
  resetStyleArchiveRepository()
}

function prepareProjects(count: number) {
  resetRepositories()
  const projects = listProjects().filter(
    (item) =>
      !listProjectChannelProductsByProjectId(item.projectId).length &&
      Boolean(getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'CHANNEL_PRODUCT_LISTING')) &&
      Boolean(getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'TEST_DATA_SUMMARY')) &&
      Boolean(getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'TEST_CONCLUSION')),
  )
  assert.ok(projects.length >= count, `至少需要 ${count} 个可用商品项目用于结论分支校验`)

  return projects.slice(0, count).map((project, index) => {
    updateProjectRecord(
      project.projectId,
      {
        projectStatus: '进行中',
        currentPhaseCode: 'PHASE_03',
        currentPhaseName: '商品上架与市场测款',
        blockedFlag: false,
        blockedReason: '',
      },
      '测试用户',
    )
    ;['SAMPLE_CONFIRM', 'SAMPLE_COST_REVIEW', 'SAMPLE_PRICING'].forEach((code) => {
      const node = getProjectNodeRecordByWorkItemTypeCode(project.projectId, code)
      if (!node) return
      updateProjectNodeRecord(
        project.projectId,
        node.projectNodeId,
        {
          currentStatus: '已完成',
          latestResultType: '已完成',
          latestResultText: `${node.workItemTypeName}已完成。`,
          updatedAt: `2026-04-11 11:0${index}`,
        },
        '测试用户',
      )
    })
    return getProjectById(project.projectId)!
  })
}

const [adjustProject, pausedProject, eliminatedProject] = prepareProjects(3)

const prepareTestingChain = (
  projectId: string,
  testingRelation: { type: 'live' | 'video'; id: string },
) => {
  const created = createProjectChannelProductFromListingNode(projectId, {}, '测试用户')
  assert.equal(created.ok, true, '应能创建正式渠道商品')
  const launched = launchProjectChannelProductListing(created.record!.channelProductId, '测试用户')
  assert.equal(launched.ok, true, '应能发起正式上架')

  if (testingRelation.type === 'live') {
    replaceLiveProductLineProjectRelations(testingRelation.id, [projectId], '测试用户')
  } else {
    replaceVideoRecordProjectRelations(testingRelation.id, [projectId], '测试用户')
  }

  const summary = submitProjectTestingSummary(projectId, {}, '测试用户')
  assert.equal(summary.ok, true, '存在正式测款关系后应能提交测款汇总')
  return launched.record!
}

const adjustRecord = prepareTestingChain(adjustProject.projectId, {
  type: 'live',
  id: 'LS-20260404-011__item-001',
})
const adjustResult = submitProjectTestingConclusion(
  adjustProject.projectId,
  {
    conclusion: '调整',
    note: '测款结论为调整，创建改版任务并作废当前渠道商品。',
  },
  '测试用户',
)
assert.equal(adjustResult.ok, true, '应能提交调整结论')
assert.equal(adjustResult.record?.channelProductStatus, '已作废', '调整结论后渠道商品必须作废')
assert.ok(adjustResult.revisionTaskId && getRevisionTaskById(adjustResult.revisionTaskId), '调整结论后必须创建正式改版任务')
assert.equal(getProjectById(adjustProject.projectId)?.projectStatus, '进行中', '调整结论后项目不能终止')

const pausedRecord = prepareTestingChain(pausedProject.projectId, {
  type: 'video',
  id: 'SV-PJT-019',
})
const pausedResult = submitProjectTestingConclusion(
  pausedProject.projectId,
  {
    conclusion: '暂缓',
    note: '测款结论为暂缓，当前项目阻塞等待重新评估。',
  },
  '测试用户',
)
assert.equal(pausedResult.ok, true, '应能提交暂缓结论')
assert.equal(pausedResult.record?.channelProductStatus, '已作废', '暂缓结论后渠道商品必须作废')
assert.equal(getProjectById(pausedProject.projectId)?.blockedFlag, true, '暂缓结论后项目必须写阻塞标记')
assert.match(getProjectById(pausedProject.projectId)?.blockedReason || '', /暂缓/, '暂缓结论后必须写阻塞原因')

const eliminatedRecord = prepareTestingChain(eliminatedProject.projectId, {
  type: 'live',
  id: 'LS-20260405-014__item-001',
})
const eliminatedResult = submitProjectTestingConclusion(
  eliminatedProject.projectId,
  {
    conclusion: '淘汰',
    note: '测款结论为淘汰，当前项目关闭。',
  },
  '测试用户',
)
assert.equal(eliminatedResult.ok, true, '应能提交淘汰结论')
assert.equal(eliminatedResult.record?.channelProductStatus, '已作废', '淘汰结论后渠道商品必须作废')
assert.equal(getProjectById(eliminatedProject.projectId)?.projectStatus, '已终止', '淘汰结论后项目必须终止')

const eliminatedNode = getProjectNodeRecordByWorkItemTypeCode(eliminatedProject.projectId, 'TEST_CONCLUSION')
assert.equal(eliminatedNode?.pendingActionType, '项目关闭', '淘汰结论后节点待处理事项必须为项目关闭')

assert.notEqual(adjustRecord.channelProductCode, pausedRecord.channelProductCode, '不同项目应生成不同渠道商品编码')
assert.notEqual(pausedRecord.channelProductCode, eliminatedRecord.channelProductCode, '不同项目应生成不同渠道商品编码')

console.log('check-pcs-project-testing-branches.ts PASS')

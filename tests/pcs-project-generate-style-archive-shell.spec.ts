import assert from 'node:assert/strict'

import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  getProjectStoreSnapshot,
  replaceProjectStore,
  updateProjectNodeRecord,
  updateProjectRecord,
} from '../src/data/pcs-project-repository.ts'
import { listProjectRelationsByProject } from '../src/data/pcs-project-relation-repository.ts'
import { generateStyleArchiveShellFromProject } from '../src/data/pcs-project-style-archive-writeback.ts'
import { getStyleArchiveById, listStyleArchives } from '../src/data/pcs-style-archive-repository.ts'
import { getStyleArchiveStatusLabel } from '../src/data/pcs-style-archive-view-model.ts'
import {
  createProjectForBusinessChain,
  prepareProjectWithLaunchedChannelProduct,
  prepareProjectWithPassedTesting,
  resetProjectBusinessChainRepositories,
} from './pcs-project-formal-chain-helper.ts'

const eligibleProject = prepareProjectWithPassedTesting('款式档案壳生成测试项目')
const beforeCount = listStyleArchives().length
const result = generateStyleArchiveShellFromProject(eligibleProject.projectId, '测试用户')
assert.equal(result.ok, true, '只有完成商品上架且测款通过的项目才应生成款式档案壳')
assert.equal(result.existed, false, '首次生成不应返回已存在结果')
assert.ok(result.style, '生成成功后应返回正式款式档案主记录')
assert.equal(listStyleArchives().length, beforeCount + 1, '生成成功后应写入正式款式档案仓储')

const createdStyle = getStyleArchiveById(result.style!.styleId)
assert.ok(createdStyle, '应能通过主键读取新生成的款式档案')
assert.equal(createdStyle!.archiveStatus, 'DRAFT', '测款通过后首次生成的款式档案壳必须保持草稿状态')
assert.equal(getStyleArchiveStatusLabel(createdStyle!.archiveStatus), '技术包待完善', '草稿款式档案展示文案应为技术包待完善')
assert.equal(createdStyle!.baseInfoStatus, '已继承', '新生成壳记录应继承基础信息')
assert.equal(createdStyle!.techPackVersionCount, 0, '生成款式档案壳时不应自动生成技术包版本')

const updatedProject = getProjectById(eligibleProject.projectId)
assert.equal(updatedProject!.linkedStyleId, createdStyle!.styleId, '商品项目主记录应回写正式款式档案主关联')
assert.equal(updatedProject!.linkedStyleCode, createdStyle!.styleCode, '商品项目主记录应回写正式款式档案编码')

const styleNode = getProjectNodeRecordByWorkItemTypeCode(eligibleProject.projectId, 'STYLE_ARCHIVE_CREATE')
assert.equal(styleNode!.currentStatus, '已完成', '生成成功后应回写生成款式档案节点状态')
assert.equal(styleNode!.latestInstanceId, createdStyle!.styleId, '生成节点应回写最新档案实例 ID')
assert.equal(styleNode!.latestResultType, '已生成款式档案', '生成节点应回写结果类型')
assert.equal(styleNode!.pendingActionType, '推进技术包完善', '生成节点应回写下一步待处理事项')

const transferNode = getProjectNodeRecordByWorkItemTypeCode(eligibleProject.projectId, 'PROJECT_TRANSFER_PREP')
if (transferNode) {
  assert.equal(transferNode.currentStatus, '进行中', '存在项目转档准备节点时应同步回写进行中状态')
  assert.equal(transferNode.latestResultType, '项目资料已同步', '项目转档准备节点应同步项目资料归档状态')
  assert.equal(transferNode.pendingActionType, '补齐缺失资料', '项目转档准备节点应写入当前缺失项提示')
}

const styleRelations = listProjectRelationsByProject(eligibleProject.projectId).filter(
  (item) => item.sourceModule === '款式档案' && item.sourceObjectId === createdStyle!.styleId,
)
assert.equal(styleRelations.length, 1, '生成成功后应写入一条正式款式档案项目关系')

const secondResult = generateStyleArchiveShellFromProject(eligibleProject.projectId, '测试用户')
assert.equal(secondResult.ok, true, '重复发起时应返回已有款式档案')
assert.equal(secondResult.existed, true, '重复发起时不应再次创建壳记录')
assert.equal(secondResult.style?.styleId, createdStyle!.styleId, '重复发起时应返回同一条正式款式档案')

const terminatedProject = prepareProjectWithPassedTesting('已终止项目测试')
updateProjectRecord(terminatedProject.projectId, { projectStatus: '已终止' }, '测试用户')
const terminatedResult = generateStyleArchiveShellFromProject(terminatedProject.projectId, '测试用户')
assert.equal(terminatedResult.ok, false, '已终止项目不应生成款式档案壳')
assert.match(terminatedResult.message, /已终止/, '已终止项目应返回明确中文提示')

const phaseProject = prepareProjectWithPassedTesting('阶段未到测试')
updateProjectRecord(phaseProject.projectId, { currentPhaseCode: 'PHASE_03', currentPhaseName: '商品上架与市场测款' }, '测试用户')
const phaseResult = generateStyleArchiveShellFromProject(phaseProject.projectId, '测试用户')
assert.equal(phaseResult.ok, false, '未进入款式档案阶段的项目不应生成款式档案壳')
assert.match(phaseResult.message, /尚未进入款式档案生成阶段/, '未进入生成阶段时应返回明确提示')

const canceledNodeProject = prepareProjectWithPassedTesting('节点取消测试')
const canceledNode = getProjectNodeRecordByWorkItemTypeCode(canceledNodeProject.projectId, 'STYLE_ARCHIVE_CREATE')
updateProjectNodeRecord(canceledNodeProject.projectId, canceledNode!.projectNodeId, { currentStatus: '已取消' }, '测试用户')
const canceledNodeResult = generateStyleArchiveShellFromProject(canceledNodeProject.projectId, '测试用户')
assert.equal(canceledNodeResult.ok, false, '节点已取消时不应生成款式档案壳')
assert.match(canceledNodeResult.message, /节点已取消/, '节点已取消时应返回明确提示')

const noChannelProject = createProjectForBusinessChain('缺少渠道商品链路测试')
updateProjectRecord(noChannelProject.projectId, { currentPhaseCode: 'PHASE_04', currentPhaseName: '款式档案与开发推进' }, '测试用户')
const noChannelResult = generateStyleArchiveShellFromProject(noChannelProject.projectId, '测试用户')
assert.equal(noChannelResult.ok, false, '没有有效渠道商品链路时不应生成款式档案壳')
assert.match(noChannelResult.message, /尚未建立用于测款的渠道商品/, '缺少渠道商品时应返回明确提示')

const noConclusionProject = prepareProjectWithLaunchedChannelProduct('未提交测款结论测试')
updateProjectRecord(noConclusionProject.projectId, { currentPhaseCode: 'PHASE_04', currentPhaseName: '款式档案与开发推进' }, '测试用户')
const noConclusionResult = generateStyleArchiveShellFromProject(noConclusionProject.projectId, '测试用户')
assert.equal(noConclusionResult.ok, false, '仅完成商品上架但未形成通过结论时不应生成款式档案壳')
assert.match(noConclusionResult.message, /尚未形成通过的测款结论/, '未形成通过结论时应返回明确提示')

resetProjectBusinessChainRepositories()
const sourceProject = createProjectForBusinessChain('缺少生成款式档案节点项目')
updateProjectRecord(sourceProject.projectId, { currentPhaseCode: 'PHASE_04', currentPhaseName: '款式档案与开发推进' }, '测试用户')
const refreshedSourceProject = getProjectById(sourceProject.projectId)
assert.ok(refreshedSourceProject, '应能回读更新后的测试项目')
const snapshot = getProjectStoreSnapshot()
const sourcePhases = snapshot.phases.filter((item) => item.projectId === sourceProject.projectId)
const sourceNodes = snapshot.nodes.filter((item) => item.projectId === sourceProject.projectId)
const customProjectId = 'prj_missing_style_node'
replaceProjectStore({
  version: snapshot.version,
  projects: [
    ...snapshot.projects,
    {
      ...refreshedSourceProject,
      projectId: customProjectId,
      projectCode: 'PRJ-CUSTOM-NODE',
      projectName: '缺少生成款式档案节点项目',
      linkedStyleId: '',
      linkedStyleCode: '',
      linkedStyleName: '',
      linkedStyleGeneratedAt: '',
    },
  ],
  phases: [
    ...snapshot.phases,
    ...sourcePhases.map((phase) => ({
      ...phase,
      projectId: customProjectId,
      projectPhaseId: `${phase.projectPhaseId}_copy`,
    })),
  ],
  nodes: [
    ...snapshot.nodes,
    ...sourceNodes
      .filter((item) => item.workItemTypeCode !== 'STYLE_ARCHIVE_CREATE')
      .map((item) => ({
        ...item,
        projectId: customProjectId,
        projectNodeId: `${item.projectNodeId}_copy`,
      })),
  ],
})
assert.equal(getProjectNodeRecordByWorkItemTypeCode(customProjectId, 'STYLE_ARCHIVE_CREATE'), null, '测试用项目应缺少生成款式档案节点')
const missingNodeResult = generateStyleArchiveShellFromProject(customProjectId, '测试用户')
assert.equal(missingNodeResult.ok, false, '缺少生成款式档案节点时不应生成壳记录')
assert.match(missingNodeResult.message, /未配置“生成款式档案”节点/, '缺少节点时应返回明确提示')

console.log('pcs-project-generate-style-archive-shell.spec.ts PASS')

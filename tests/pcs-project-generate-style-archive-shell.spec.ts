import assert from 'node:assert/strict'
import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  getProjectStoreSnapshot,
  replaceProjectStore,
  resetProjectRepository,
  updateProjectNodeRecord,
  updateProjectRecord,
} from '../src/data/pcs-project-repository.ts'
import {
  listProjectRelationsByProject,
  resetProjectRelationRepository,
} from '../src/data/pcs-project-relation-repository.ts'
import { generateStyleArchiveShellFromProject } from '../src/data/pcs-project-style-archive-writeback.ts'
import {
  getStyleArchiveById,
  listStyleArchives,
  resetStyleArchiveRepository,
} from '../src/data/pcs-style-archive-repository.ts'

function prepareProject(projectId?: string) {
  resetProjectRepository()
  resetProjectRelationRepository()
  resetStyleArchiveRepository()

  const project =
    (projectId ? getProjectById(projectId) : null) ||
    getProjectStoreSnapshot().projects.find((item) => getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'STYLE_ARCHIVE_CREATE')) ||
    null
  assert.ok(project, '应存在可用于生成款式档案的初始化项目')

  updateProjectRecord(
    project!.projectId,
    {
      projectStatus: '进行中',
      currentPhaseCode: 'PHASE_04',
      currentPhaseName: '开发推进',
      linkedStyleId: '',
      linkedStyleCode: '',
      linkedStyleName: '',
      linkedStyleGeneratedAt: '',
    },
    '测试用户',
  )
  const node = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'STYLE_ARCHIVE_CREATE')
  assert.ok(node, '项目应存在生成款式档案节点')
  updateProjectNodeRecord(
    project!.projectId,
    node!.projectNodeId,
    {
      currentStatus: '未开始',
      updatedAt: '2026-04-10 10:00',
    },
    '测试用户',
  )
  return getProjectById(project!.projectId)!
}

const eligibleProject = prepareProject()
const beforeCount = listStyleArchives().length
const result = generateStyleArchiveShellFromProject(eligibleProject.projectId, '测试用户')
assert.equal(result.ok, true, '符合条件的项目应能生成款式档案壳')
assert.equal(result.existed, false, '首次生成不应返回已存在结果')
assert.ok(result.style, '生成成功后应返回正式款式档案主记录')
assert.equal(listStyleArchives().length, beforeCount + 1, '生成成功后应写入正式款式档案仓储')

const createdStyle = getStyleArchiveById(result.style!.styleId)
assert.ok(createdStyle, '应能通过主键读取新生成的款式档案')
assert.equal(createdStyle!.archiveStatus, 'DRAFT', '新生成款式档案壳应为待补全状态')
assert.equal(createdStyle!.baseInfoStatus, '已继承', '新生成壳记录应继承基础信息')
assert.equal(createdStyle!.technicalVersionCount, 0, '本轮不应自动生成技术资料版本')

const updatedProject = getProjectById(eligibleProject.projectId)
assert.equal(updatedProject!.linkedStyleId, createdStyle!.styleId, '商品项目主记录应回写正式款式档案主关联')
assert.equal(updatedProject!.linkedStyleCode, createdStyle!.styleCode, '商品项目主记录应回写正式款式档案编码')

const styleNode = getProjectNodeRecordByWorkItemTypeCode(eligibleProject.projectId, 'STYLE_ARCHIVE_CREATE')
assert.equal(styleNode!.currentStatus, '已完成', '生成成功后应回写生成款式档案节点状态')
assert.equal(styleNode!.latestInstanceId, createdStyle!.styleId, '生成节点应回写最新档案实例 ID')
assert.equal(styleNode!.latestResultType, '已生成款式档案', '生成节点应回写结果类型')
assert.equal(styleNode!.pendingActionType, '补全款式资料', '生成节点应回写下一步待处理事项')

const transferNode = getProjectNodeRecordByWorkItemTypeCode(eligibleProject.projectId, 'PROJECT_TRANSFER_PREP')
if (transferNode) {
  assert.equal(transferNode.currentStatus, '进行中', '存在项目转档准备节点时应同步回写进行中状态')
  assert.equal(transferNode.pendingActionType, '补全转档资料', '项目转档准备节点应写入下一步提示')
}

const styleRelations = listProjectRelationsByProject(eligibleProject.projectId).filter(
  (item) => item.sourceModule === '款式档案' && item.sourceObjectId === createdStyle!.styleId,
)
assert.equal(styleRelations.length, 1, '生成成功后应写入一条正式款式档案项目关系')

const secondResult = generateStyleArchiveShellFromProject(eligibleProject.projectId, '测试用户')
assert.equal(secondResult.ok, true, '重复发起时应返回已有款式档案')
assert.equal(secondResult.existed, true, '重复发起时不应再次创建壳记录')
assert.equal(secondResult.style?.styleId, createdStyle!.styleId, '重复发起时应返回同一条正式款式档案')

const terminatedProject = prepareProject()
updateProjectRecord(terminatedProject.projectId, { projectStatus: '已终止' }, '测试用户')
const terminatedResult = generateStyleArchiveShellFromProject(terminatedProject.projectId, '测试用户')
assert.equal(terminatedResult.ok, false, '已终止项目不应生成款式档案壳')
assert.match(terminatedResult.message, /已终止/, '已终止项目应返回明确中文提示')

const phaseProject = prepareProject()
updateProjectRecord(phaseProject.projectId, { currentPhaseCode: 'PHASE_03', currentPhaseName: '市场测款' }, '测试用户')
const phaseResult = generateStyleArchiveShellFromProject(phaseProject.projectId, '测试用户')
assert.equal(phaseResult.ok, false, '未进入开发推进阶段的项目不应生成款式档案壳')
assert.match(phaseResult.message, /尚未进入款式档案生成阶段/, '未进入生成阶段时应返回明确提示')

const canceledNodeProject = prepareProject()
const canceledNode = getProjectNodeRecordByWorkItemTypeCode(canceledNodeProject.projectId, 'STYLE_ARCHIVE_CREATE')
updateProjectNodeRecord(canceledNodeProject.projectId, canceledNode!.projectNodeId, { currentStatus: '已取消' }, '测试用户')
const canceledNodeResult = generateStyleArchiveShellFromProject(canceledNodeProject.projectId, '测试用户')
assert.equal(canceledNodeResult.ok, false, '节点已取消时不应生成款式档案壳')
assert.match(canceledNodeResult.message, /节点已取消/, '节点已取消时应返回明确提示')

const missingNodeProject = prepareProject()
const snapshot = getProjectStoreSnapshot()
const sourceProject = getProjectById(missingNodeProject.projectId)!
const sourcePhases = snapshot.phases.filter((item) => item.projectId === missingNodeProject.projectId)
const sourceNodes = snapshot.nodes.filter((item) => item.projectId === missingNodeProject.projectId)
const customProjectId = 'prj_missing_style_node'
replaceProjectStore({
  version: snapshot.version,
  projects: [
    ...snapshot.projects,
    {
      ...sourceProject,
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

import assert from 'node:assert/strict'
import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  getProjectStoreSnapshot,
  replaceProjectStore,
  updateProjectNodeRecord,
} from '../src/data/pcs-project-repository.ts'
import { listProjectRelationsByProject } from '../src/data/pcs-project-relation-repository.ts'
import {
  getProjectArchiveByProjectId,
  listProjectArchiveDocumentsByArchiveId,
  listProjectArchiveFilesByArchiveId,
} from '../src/data/pcs-project-archive-repository.ts'
import { createProjectArchive } from '../src/data/pcs-project-archive-sync.ts'
import {
  createArchiveTestProject,
  generateStyleShellForArchiveProject,
  resetArchiveScenarioRepositories,
} from './pcs-project-archive-test-helper.ts'

resetArchiveScenarioRepositories()
const context = createArchiveTestProject('create')

const withoutStyle = createProjectArchive(context.projectId, '测试用户')
assert.equal(withoutStyle.ok, false, '未生成正式款式档案时不应允许创建项目资料归档对象')
assert.match(withoutStyle.message, /尚未生成正式款式档案/, '缺少款式档案时应返回明确提示')

generateStyleShellForArchiveProject(context.projectId)
const result = createProjectArchive(context.projectId, '测试用户')
assert.equal(result.ok, true, '符合条件的项目应能创建正式项目资料归档对象')
assert.equal(result.existed, false, '首次创建不应返回已存在结果')
assert.ok(result.archive, '创建成功后应返回正式归档对象')

const archive = getProjectArchiveByProjectId(context.projectId)
assert.ok(archive, '应能按项目读取正式归档对象')
assert.equal(archive!.projectId, context.projectId, '归档对象应绑定正式商品项目')
assert.ok(archive!.archiveNo.startsWith('ARC-'), '归档编号应为系统生成的正式归档编号')

const documents = listProjectArchiveDocumentsByArchiveId(archive!.projectArchiveId)
const files = listProjectArchiveFilesByArchiveId(archive!.projectArchiveId)
assert.ok(documents.length > 0, '创建归档对象后应写入正式归档资料记录')
assert.ok(files.length >= 0, '创建归档对象后应完成正式归档文件记录初始化')
assert.ok(
  documents.some((item) => item.documentGroup === 'PROJECT_BASE'),
  '归档对象应自动收集项目基础资料',
)
assert.ok(
  documents.some((item) => item.documentGroup === 'STYLE_ARCHIVE'),
  '归档对象应自动收集正式款式档案资料',
)

const project = getProjectById(context.projectId)
assert.equal(project!.projectArchiveId, archive!.projectArchiveId, '商品项目主记录应回写正式归档主关联')
assert.equal(project!.projectArchiveNo, archive!.archiveNo, '商品项目主记录应回写归档编号')
assert.equal(project!.projectArchiveStatus, archive!.archiveStatus, '商品项目主记录应回写归档状态')

const transferNode = getProjectNodeRecordByWorkItemTypeCode(context.projectId, 'PROJECT_TRANSFER_PREP')
assert.ok(transferNode, '测试项目必须存在项目转档准备节点')
assert.equal(transferNode!.latestInstanceId, archive!.projectArchiveId, '项目转档准备节点应回写归档实例 ID')
assert.equal(transferNode!.latestResultType, '已建立项目资料归档', '项目转档准备节点应回写正式结果类型')
assert.equal(transferNode!.pendingActionType, '补齐归档资料', '创建后应提示补齐归档资料')

const relations = listProjectRelationsByProject(context.projectId).filter(
  (item) => item.sourceModule === '项目资料归档' && item.sourceObjectId === archive!.projectArchiveId,
)
assert.equal(relations.length, 1, '创建归档对象后应写入一条正式项目关系记录')

resetArchiveScenarioRepositories()
const missingNodeContext = createArchiveTestProject('missing-node')
generateStyleShellForArchiveProject(missingNodeContext.projectId)
const snapshot = getProjectStoreSnapshot()
replaceProjectStore({
  version: snapshot.version,
  projects: snapshot.projects,
  phases: snapshot.phases,
  nodes: snapshot.nodes.filter(
    (item) => !(item.projectId === missingNodeContext.projectId && item.workItemTypeCode === 'PROJECT_TRANSFER_PREP'),
  ),
})
const missingNodeResult = createProjectArchive(missingNodeContext.projectId, '测试用户')
assert.equal(missingNodeResult.ok, false, '缺少项目转档准备节点时不应创建归档对象')
assert.match(missingNodeResult.message, /未配置“项目转档准备”节点/, '缺少节点时应返回明确提示')

resetArchiveScenarioRepositories()
const canceledNodeContext = createArchiveTestProject('canceled-node')
generateStyleShellForArchiveProject(canceledNodeContext.projectId)
const canceledNode = getProjectNodeRecordByWorkItemTypeCode(canceledNodeContext.projectId, 'PROJECT_TRANSFER_PREP')
updateProjectNodeRecord(canceledNodeContext.projectId, canceledNode!.projectNodeId, { currentStatus: '已取消' }, '测试用户')
const canceledNodeResult = createProjectArchive(canceledNodeContext.projectId, '测试用户')
assert.equal(canceledNodeResult.ok, false, '项目转档准备节点已取消时不应创建归档对象')
assert.match(canceledNodeResult.message, /节点已取消/, '节点已取消时应返回明确提示')

console.log('pcs-project-archive-create.spec.ts PASS')

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildProjectDetailViewModel, buildProjectDetailViewModelFromRecords } from '../src/data/pcs-project-view-model.ts'
import { getProjectStoreSnapshot, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import type { PcsProjectNodeRecord, PcsProjectPhaseRecord, PcsProjectRecord } from '../src/data/pcs-project-types.ts'

resetProjectRepository()

const detailPageSource = readFileSync(new URL('../src/pages/pcs-project-detail.ts', import.meta.url), 'utf8')
assert.ok(detailPageSource.includes('buildProjectDetailViewModel'), '详情页应读取项目视图模型')
assert.ok(!detailPageSource.includes('PROJECT_INDEX'), '详情页不应再以内置 PROJECT_INDEX 作为主渲染源')
assert.ok(!detailPageSource.includes('WORK_ITEM_SEED'), '详情页不应再以内置 WORK_ITEM_SEED 作为主渲染源')
assert.ok(!detailPageSource.includes('getPhaseIdByName'), '详情页不应再按中文阶段名称猜当前阶段')

const nodeDetailPageSource = readFileSync(new URL('../src/pages/pcs-project-work-item-detail.ts', import.meta.url), 'utf8')
assert.ok(nodeDetailPageSource.includes('buildProjectNodeDetailViewModel'), '节点详情页应直接读取真实项目节点')
assert.ok(!nodeDetailPageSource.includes('getPcsProjectDetailSnapshot'), '节点详情页不应再通过详情页固定快照取数')

const snapshot = getProjectStoreSnapshot()
const firstProjectId = snapshot.projects[0]?.projectId
assert.ok(firstProjectId, '应存在初始化项目')

const detail = buildProjectDetailViewModel(firstProjectId!)
assert.ok(detail, '详情页应能读取真实项目主记录')
assert.ok(detail!.phases.length > 0, '详情页应能读取真实阶段记录')
assert.ok(detail!.phases.every((phase, index, list) => index === 0 || list[index - 1].phaseOrder <= phase.phaseOrder), '阶段顺序应来自 phaseOrder')
assert.ok(detail!.phases.some((phase) => phase.nodes.length > 0), '阶段下的节点列表应来自真实项目节点')

const customProject: PcsProjectRecord = {
  ...snapshot.projects[0],
  projectId: 'custom-project',
  projectCode: 'PRJ-CUSTOM-001',
  projectName: '阶段编码验证项目',
  currentPhaseCode: 'PHASE_BETA',
  currentPhaseName: '第二阶段完全不含关键词',
}

const customPhases: PcsProjectPhaseRecord[] = [
  {
    projectPhaseId: 'custom-phase-1',
    projectId: 'custom-project',
    phaseCode: 'PHASE_ALPHA',
    phaseName: '阶段甲',
    phaseOrder: 1,
    phaseStatus: '已完成',
    startedAt: '2026-04-01 10:00',
    finishedAt: '2026-04-01 18:00',
    ownerId: customProject.ownerId,
    ownerName: customProject.ownerName,
  },
  {
    projectPhaseId: 'custom-phase-2',
    projectId: 'custom-project',
    phaseCode: 'PHASE_BETA',
    phaseName: '第二阶段完全不含关键词',
    phaseOrder: 2,
    phaseStatus: '进行中',
    startedAt: '2026-04-02 10:00',
    finishedAt: '',
    ownerId: customProject.ownerId,
    ownerName: customProject.ownerName,
  },
]

const customNodes: PcsProjectNodeRecord[] = [
  {
    projectNodeId: 'custom-node-1',
    projectId: 'custom-project',
    phaseCode: 'PHASE_ALPHA',
    phaseName: '阶段甲',
    workItemTypeCode: 'PROJECT_INIT',
    workItemTypeName: '商品项目立项',
    sequenceNo: 1,
    requiredFlag: true,
    multiInstanceFlag: false,
    currentStatus: '已完成',
    currentOwnerId: customProject.ownerId,
    currentOwnerName: customProject.ownerName,
    validInstanceCount: 1,
    latestInstanceId: 'instance-1',
    latestInstanceCode: 'INSTANCE-1',
    latestResultType: '立项完成',
    latestResultText: '主记录已生成。',
    currentIssueType: '',
    currentIssueText: '',
    pendingActionType: '已完成',
    pendingActionText: '节点已完成',
    sourceTemplateNodeId: 'TPL-NODE-1',
    sourceTemplateVersion: 'V1',
  },
  {
    projectNodeId: 'custom-node-2',
    projectId: 'custom-project',
    phaseCode: 'PHASE_BETA',
    phaseName: '第二阶段完全不含关键词',
    workItemTypeCode: 'VIDEO_TEST',
    workItemTypeName: '短视频测款',
    sequenceNo: 1,
    requiredFlag: true,
    multiInstanceFlag: false,
    currentStatus: '进行中',
    currentOwnerId: customProject.ownerId,
    currentOwnerName: customProject.ownerName,
    validInstanceCount: 0,
    latestInstanceId: '',
    latestInstanceCode: '',
    latestResultType: '',
    latestResultText: '',
    currentIssueType: '',
    currentIssueText: '',
    pendingActionType: '待执行',
    pendingActionText: '当前请处理：短视频测款',
    sourceTemplateNodeId: 'TPL-NODE-2',
    sourceTemplateVersion: 'V1',
  },
]

const customDetail = buildProjectDetailViewModelFromRecords(customProject, customPhases, customNodes)
const currentPhase = customDetail.phases.find((phase) => phase.isCurrent)
assert.equal(currentPhase?.phaseCode, 'PHASE_BETA', '当前阶段高亮应来自结构化字段，而不是中文阶段名猜测')

console.log('pcs-project-detail-real-source.spec.ts PASS')

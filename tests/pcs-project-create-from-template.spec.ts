import assert from 'node:assert/strict'
import {
  buildProjectDetailViewModel,
  buildProjectNodeDetailViewModel,
} from '../src/data/pcs-project-view-model.ts'
import {
  createEmptyProjectDraft,
  createProject,
  getProjectCreateCatalog,
  listProjectNodes,
  listProjectPhases,
  listProjects,
  listActiveProjectTemplates,
  resetProjectRepository,
  validateProjectCreateDraft,
} from '../src/data/pcs-project-repository.ts'
import { createProjectTemplate } from '../src/data/pcs-templates.ts'
import { getProjectPhaseDefinitionByCode } from '../src/data/pcs-project-phase-definitions.ts'

function buildValidDraft(templateId: string) {
  const catalog = getProjectCreateCatalog()
  const category = catalog.categories[0]
  const subCategory = category.children[0]
  const brand = catalog.brands[0]
  const owner = catalog.owners[0]
  const team = catalog.teams[0]
  const collaborator = catalog.collaborators[0]

  return {
    ...createEmptyProjectDraft(),
    projectName: '模板统一校验项目',
    projectType: '商品开发' as const,
    projectSourceType: '企划提案' as const,
    templateId,
    categoryId: category.id,
    categoryName: category.name,
    subCategoryId: subCategory.id,
    subCategoryName: subCategory.name,
    brandId: brand.id,
    brandName: brand.name,
    styleNumber: 'STYLE-UNIFY-001',
    styleType: '基础款' as const,
    yearTag: '2026',
    seasonTags: ['夏季'],
    styleTags: ['通勤'],
    targetAudienceTags: ['通勤白领'],
    priceRangeLabel: '两百元主销带',
    targetChannelCodes: ['tiktok-shop'],
    sampleSourceType: '外采' as const,
    sampleSupplierId: catalog.sampleSuppliers[0]?.id ?? '',
    sampleSupplierName: catalog.sampleSuppliers[0]?.name ?? '',
    sampleLink: 'https://example.com/sample',
    ownerId: owner.id,
    ownerName: owner.name,
    teamId: team.id,
    teamName: team.name,
    collaboratorIds: [collaborator.id],
    collaboratorNames: [collaborator.name],
    priorityLevel: '高' as const,
    remark: '验证模板节点正式来源',
  }
}

resetProjectRepository()

const activeTemplate = listActiveProjectTemplates()[0]
assert.ok(activeTemplate, '应存在可用模板')

const created = createProject(buildValidDraft(activeTemplate.id), '测试创建人')

assert.ok(created.phases.length > 0, '创建项目时应生成阶段记录')
assert.ok(created.nodes.length > 0, '创建项目时应生成节点记录')
assert.ok(
  created.nodes.every((node) => Boolean(node.sourceTemplateNodeId) && Boolean(node.workItemTypeCode) && Boolean(node.workItemId)),
  '新建项目后的节点应保留模板节点来源和正式工作项身份',
)

const storedPhases = listProjectPhases(created.project.projectId)
const storedNodes = listProjectNodes(created.project.projectId)
assert.equal(storedPhases.length, created.phases.length, '阶段记录应持久化')
assert.equal(storedNodes.length, created.nodes.length, '节点记录应持久化')

const detail = buildProjectDetailViewModel(created.project.projectId)
assert.ok(detail, '新建项目后应能打开真实项目详情')
assert.ok(
  detail?.phases.every((phase, index, list) => index === 0 || phase.phaseOrder >= list[index - 1].phaseOrder),
  '详情页阶段顺序应来自结构化 phaseOrder',
)

const nodeDetail = buildProjectNodeDetailViewModel(created.project.projectId, created.nodes[0].projectNodeId)
assert.ok(nodeDetail, '应能用真实 projectNodeId 打开节点详情')
assert.equal(nodeDetail?.node.projectNodeId, created.nodes[0].projectNodeId)
assert.equal(nodeDetail?.node.sourceTemplateNodeId, created.nodes[0].sourceTemplateNodeId)

const phase = getProjectPhaseDefinitionByCode('PHASE_01')
if (!phase) {
  throw new Error('缺少 PHASE_01')
}

const pendingTemplate = createProjectTemplate({
  name: '待补充模板',
  styleType: ['基础款'],
  description: '用于校验待补充节点阻断创建',
  stages: [
    {
      templateStageId: '',
      templateId: '',
      phaseCode: phase.phaseCode,
      phaseName: phase.phaseName,
      phaseOrder: phase.phaseOrder,
      requiredFlag: true,
      description: phase.description,
    },
  ],
  nodes: [],
  pendingNodes: [
    {
      pendingNodeId: 'pending-001',
      templateId: '',
      templateStageId: '',
      phaseCode: phase.phaseCode,
      phaseName: phase.phaseName,
      legacyStageName: '立项获取',
      legacyWorkItemName: '未知旧节点',
      unresolvedReason: '旧工作项名称未收录到正式映射表。',
      templateVersion: '',
    },
  ],
})

const blockedErrors = validateProjectCreateDraft(buildValidDraft(pendingTemplate.id))
assert.ok(
  blockedErrors.includes('当前模板存在未完成标准化的节点，请先处理模板中的待补充标准工作项。'),
  '模板存在待补充标准工作项时，项目创建页必须禁止提交',
)

assert.ok(
  listProjects().some((item) => item.projectId === created.project.projectId),
  '第一期第二步已切换的列表页仍应能读取新生成项目',
)

console.log('pcs-project-create-from-template.spec.ts PASS')

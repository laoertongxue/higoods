import assert from 'node:assert/strict'
import {
  createEmptyProjectDraft,
  createProject,
  getProjectById,
  getProjectCreateCatalog,
  listActiveProjectTemplates,
  listProjectNodes,
  listProjectPhases,
  listProjects,
  resetProjectRepository,
  validateProjectCreateDraft,
} from '../src/data/pcs-project-repository.ts'

function buildValidDraft() {
  const catalog = getProjectCreateCatalog()
  const template = listActiveProjectTemplates().find((item) => item.id === 'TPL-004') ?? listActiveProjectTemplates()[0]
  if (!template) {
    throw new Error('未找到可用项目模板')
  }

  const category = catalog.categories[0]
  const subCategory = category.children[0]
  const brand = catalog.brands[0]
  const owner = catalog.owners[0]
  const team = catalog.teams[0]
  const collaborator = catalog.collaborators[0]

  return {
    ...createEmptyProjectDraft(),
    projectName: '二期测试商品项目',
    projectType: '商品开发' as const,
    projectSourceType: '企划提案' as const,
    templateId: template.id,
    categoryId: category.id,
    categoryName: category.name,
    subCategoryId: subCategory.id,
    subCategoryName: subCategory.name,
    brandId: brand.id,
    brandName: brand.name,
    styleNumber: 'STYLE-2026-001',
    styleType: template.styleType[0] ?? '设计款',
    yearTag: '2026',
    seasonTags: ['夏季'],
    styleTags: ['通勤'],
    targetAudienceTags: ['通勤白领'],
    priceRangeLabel: '两百元主销带',
    targetChannelCodes: ['tiktok-shop'],
    sampleSourceType: '外采' as const,
    sampleSupplierId: catalog.sampleSuppliers[0]?.id ?? '',
    sampleSupplierName: catalog.sampleSuppliers[0]?.name ?? '',
    sampleLink: 'https://example.com/sample-link',
    ownerId: owner.id,
    ownerName: owner.name,
    teamId: team.id,
    teamName: team.name,
    collaboratorIds: [collaborator.id],
    collaboratorNames: [collaborator.name],
    priorityLevel: '高' as const,
    remark: '用于验证商品项目创建链路。',
  }
}

resetProjectRepository()

const draftErrors = validateProjectCreateDraft(createEmptyProjectDraft())
assert.ok(draftErrors.includes('请填写项目名称。'), '项目名称应为必填项')
assert.ok(draftErrors.includes('请选择项目类型。'), '项目类型应为必填项')
assert.ok(draftErrors.includes('请选择项目模板。'), '项目模板应为必填项')
assert.ok(draftErrors.includes('请选择一级分类。'), '一级分类应为必填项')
assert.ok(draftErrors.includes('请选择负责人。'), '负责人应为必填项')

const created = createProject(buildValidDraft(), '测试创建人')

assert.equal(created.project.projectStatus, '已立项', '新建项目应写入初始项目状态')
assert.equal(created.project.currentPhaseCode, created.phases[0]?.phaseCode, '当前阶段编码应来自结构化阶段记录')
assert.equal(created.project.currentPhaseName, created.phases[0]?.phaseName, '当前阶段名称应来自阶段记录')
assert.equal(created.project.templateId, 'TPL-004', '新建项目应写入所选模板')
assert.equal(created.project.createdBy, '测试创建人', '创建人应写入项目主记录')
assert.ok(created.project.projectCode.startsWith('PRJ-'), '项目编号应系统生成')

assert.ok(created.phases.length > 0, '创建项目时应生成阶段记录')
assert.ok(created.nodes.length > 0, '创建项目时应生成工作项节点')
assert.equal(created.phases[0]?.phaseStatus, '进行中', '第一阶段应自动进入进行中')
assert.ok(
  created.nodes.some((node) => node.phaseCode === created.phases[0]?.phaseCode && Boolean(node.workItemTypeCode)),
  '应按模板生成首阶段工作项节点',
)
assert.ok(
  created.nodes.every((node) => typeof node.requiredFlag === 'boolean' && typeof node.multiInstanceFlag === 'boolean'),
  '生成节点时应写入是否必做和是否允许多次执行',
)
assert.ok(
  created.nodes.every((node) => node.projectId === created.project.projectId),
  '生成的工作项节点应归属于同一项目',
)

const storedProject = getProjectById(created.project.projectId)
assert.ok(storedProject, '创建后应能查询到项目主记录')
assert.equal(storedProject?.currentPhaseCode, created.phases[0]?.phaseCode, '读取项目时应继续使用结构化阶段编码')

const storedPhases = listProjectPhases(created.project.projectId)
const storedNodes = listProjectNodes(created.project.projectId)
assert.equal(storedPhases.length, created.phases.length, '阶段记录应持久化')
assert.equal(storedNodes.length, created.nodes.length, '工作项节点应持久化')

const projectList = listProjects()
assert.ok(projectList.some((item) => item.projectId === created.project.projectId), '项目列表应包含新建项目')
assert.equal(projectList[0]?.projectId, created.project.projectId, '新建项目应出现在列表顶部')

console.log('pcs-project-flow.spec.ts PASS')

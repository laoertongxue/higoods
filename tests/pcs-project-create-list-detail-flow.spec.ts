import assert from 'node:assert/strict'
import {
  createEmptyProjectDraft,
  createProject,
  getProjectCreateCatalog,
  listActiveProjectTemplates,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import {
  buildProjectDetailViewModel,
  buildProjectListViewModels,
  buildProjectNodeDetailViewModel,
} from '../src/data/pcs-project-view-model.ts'

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
    projectName: '真实链路验证项目',
    projectType: '商品开发' as const,
    projectSourceType: '企划提案' as const,
    templateId: template.id,
    categoryId: category.id,
    categoryName: category.name,
    subCategoryId: subCategory.id,
    subCategoryName: subCategory.name,
    brandId: brand.id,
    brandName: brand.name,
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
    remark: '用于验证列表、详情、节点详情真实链路。',
  }
}

resetProjectRepository()

const created = createProject(buildValidDraft(), '流程测试用户')

const listRows = buildProjectListViewModels()
const createdRow = listRows.find((item) => item.projectId === created.project.projectId)
assert.ok(createdRow, '新建项目后列表页应显示新项目')
assert.equal(createdRow?.projectName, created.project.projectName, '列表页项目名称应来自真实主记录')
assert.ok(createdRow?.totalNodeCount, '列表页完成情况应来自真实节点推导')

const detail = buildProjectDetailViewModel(created.project.projectId)
assert.ok(detail, '新建项目后详情页应可读取真实项目')
assert.equal(detail?.projectName, created.project.projectName, '详情页头部应展示真实项目名称')
assert.equal(detail?.templateName, created.project.templateName, '详情页应展示真实模板来源')
assert.equal(detail?.currentPhaseCode, created.project.currentPhaseCode, '详情页当前阶段应来自结构化字段')
assert.ok(detail?.phases.length, '详情页应展示真实阶段记录')
assert.ok(detail?.phases[0]?.nodes.length, '详情页节点列表应展示真实项目节点')

const firstNodeId = detail?.phases[0]?.nodes[0]?.projectNodeId
assert.ok(firstNodeId, '新建项目应生成真实 projectNodeId')

const nodeDetail = buildProjectNodeDetailViewModel(created.project.projectId, firstNodeId!)
assert.ok(nodeDetail, '节点详情页应能根据真实 projectNodeId 打开节点')
assert.equal(nodeDetail?.node.projectNodeId, firstNodeId, '节点详情页应读取真实节点记录')
assert.equal(nodeDetail?.projectId, created.project.projectId, '节点详情页应归属于真实项目')

console.log('pcs-project-create-list-detail-flow.spec.ts PASS')

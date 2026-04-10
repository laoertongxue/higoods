import assert from 'node:assert/strict'
import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
  updateProjectNodeRecord,
  updateProjectRecord,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { createTechnicalDataVersionFromStyle } from '../src/data/pcs-project-technical-data-writeback.ts'
import { generateStyleArchiveShellFromProject } from '../src/data/pcs-project-style-archive-writeback.ts'
import {
  getStyleArchiveById,
  resetStyleArchiveRepository,
} from '../src/data/pcs-style-archive-repository.ts'
import { resetTechnicalDataVersionRepository } from '../src/data/pcs-technical-data-version-repository.ts'
import {
  handleProductStyleDetailEvent,
  renderProductStyleDetailPage,
} from '../src/pages/pcs-product-style-detail.ts'

function prepareStyleShell() {
  resetProjectRepository()
  resetProjectRelationRepository()
  resetStyleArchiveRepository()
  resetTechnicalDataVersionRepository()

  const project = listProjects().find(
    (item) =>
      getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'STYLE_ARCHIVE_CREATE') &&
      getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'PROJECT_TRANSFER_PREP'),
  )
  assert.ok(project, '应存在既可生成款式档案又可建立技术资料版本的商品项目')

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
      linkedTechnicalVersionId: '',
      linkedTechnicalVersionCode: '',
      linkedTechnicalVersionLabel: '',
      linkedTechnicalVersionStatus: '',
      linkedTechnicalVersionPublishedAt: '',
    },
    '测试用户',
  )

  const styleNode = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'STYLE_ARCHIVE_CREATE')
  const transferNode = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'PROJECT_TRANSFER_PREP')
  assert.ok(styleNode && transferNode, '项目节点应完整')
  updateProjectNodeRecord(project!.projectId, styleNode!.projectNodeId, { currentStatus: '未开始' }, '测试用户')
  updateProjectNodeRecord(project!.projectId, transferNode!.projectNodeId, { currentStatus: '未开始' }, '测试用户')

  const styleResult = generateStyleArchiveShellFromProject(project!.projectId, '测试用户')
  assert.ok(styleResult.ok && styleResult.style, '应先生成正式款式档案壳')

  return {
    project: getProjectById(project!.projectId)!,
    style: getStyleArchiveById(styleResult.style!.styleId)!,
  }
}

const prepared = prepareStyleShell()
const created = createTechnicalDataVersionFromStyle(prepared.style.styleId, '测试用户')

assert.equal(created.record.styleId, prepared.style.styleId, '技术资料版本应正式绑定到款式档案')
assert.equal(created.record.sourceProjectId, prepared.project.projectId, '技术资料版本应正式绑定到来源商品项目')
assert.equal(created.record.versionLabel, 'V1', '第一版技术资料应使用 V1 标签')

const style = getStyleArchiveById(prepared.style.styleId)
assert.ok(style, '应能回读正式款式档案')
assert.equal(style!.technicalVersionCount, 1, '建立第一版技术资料后应回写款式档案版本数量')
assert.equal(style!.technicalDataStatus, '草稿中', '建立草稿技术资料后款式档案技术资料状态应为草稿中')
assert.equal(style!.effectiveTechnicalVersionId, '', '草稿版本建立后不应直接成为当前生效版本')

renderProductStyleDetailPage(prepared.style.styleId)
const technicalButton = {
  closest: () => ({
    dataset: { styleDetailAction: 'set-tab', tabKey: 'technical' },
  }),
} as unknown as Element
handleProductStyleDetailEvent(technicalButton)
const technicalHtml = renderProductStyleDetailPage(prepared.style.styleId)
assert.ok(technicalHtml.includes(created.record.technicalVersionCode), '款式档案详情页技术资料区域应展示正式技术资料版本编号')
assert.ok(technicalHtml.includes(created.record.versionLabel), '款式档案详情页技术资料区域应展示正式版本标签')
assert.ok(technicalHtml.includes('复制为新版本'), '款式档案详情页技术资料区域应提供复制版本动作')

console.log('pcs-style-technical-version-link.spec.ts PASS')

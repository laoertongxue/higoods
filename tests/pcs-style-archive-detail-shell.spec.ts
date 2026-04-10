import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
  updateProjectNodeRecord,
  updateProjectRecord,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { generateStyleArchiveShellFromProject } from '../src/data/pcs-project-style-archive-writeback.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  handleProductStyleDetailEvent,
  renderProductStyleDetailPage,
} from '../src/pages/pcs-product-style-detail.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetStyleArchiveRepository()

const project = listProjects().find(
  (item) => getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'STYLE_ARCHIVE_CREATE'),
)
assert.ok(project, '应存在可生成款式档案的项目')
updateProjectRecord(project!.projectId, {
  projectStatus: '进行中',
  currentPhaseCode: 'PHASE_04',
  currentPhaseName: '开发推进',
}, '测试用户')
const node = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'STYLE_ARCHIVE_CREATE')
updateProjectNodeRecord(project!.projectId, node!.projectNodeId, { currentStatus: '未开始' }, '测试用户')

const result = generateStyleArchiveShellFromProject(project!.projectId, '测试用户')
assert.ok(result.ok && result.style, '应先生成正式款式档案壳')

const source = readFileSync(new URL('../src/pages/pcs-product-style-detail.ts', import.meta.url), 'utf8')
assert.ok(!source.includes('STYLE_EXTRA_BY_ID'), '款式档案详情页不应继续以内置 STYLE_EXTRA_BY_ID 作为主来源')

const html = renderProductStyleDetailPage(result.style!.styleId)
assert.ok(html.includes('款式档案编号'), '款式档案详情页应正常渲染基础资料')

const specButton = {
  closest: () => ({
    dataset: { styleDetailAction: 'set-tab', tabKey: 'specifications' },
  }),
} as unknown as Element
handleProductStyleDetailEvent(specButton)
const specHtml = renderProductStyleDetailPage(result.style!.styleId)
assert.ok(specHtml.includes('暂无规格档案'), '新生成壳记录的规格清单区域应显示明确空状态')
assert.ok(specHtml.includes('当前仅完成款式档案初始建档'), '新生成壳记录的空状态说明应统一')

const technicalButton = {
  closest: () => ({
    dataset: { styleDetailAction: 'set-tab', tabKey: 'technical' },
  }),
} as unknown as Element
handleProductStyleDetailEvent(technicalButton)
const technicalHtml = renderProductStyleDetailPage(result.style!.styleId)
assert.ok(technicalHtml.includes('暂无技术资料版本'), '新生成壳记录的技术资料区域应显示明确空状态')

const costButton = {
  closest: () => ({
    dataset: { styleDetailAction: 'set-tab', tabKey: 'cost' },
  }),
} as unknown as Element
handleProductStyleDetailEvent(costButton)
const costHtml = renderProductStyleDetailPage(result.style!.styleId)
assert.ok(costHtml.includes('暂无成本核价版本'), '新生成壳记录的成本核价区域应显示明确空状态')

console.log('pcs-style-archive-detail-shell.spec.ts PASS')

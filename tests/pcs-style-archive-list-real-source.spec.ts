import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { appStore } from '../src/state/store.ts'
import {
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
  updateProjectNodeRecord,
  updateProjectRecord,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  handleProductSpuEvent,
  handleProductSpuInput,
  renderProductSpuPage,
} from '../src/pages/pcs-product-spu.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetStyleArchiveRepository()

const source = readFileSync(new URL('../src/pages/pcs-product-spu.ts', import.meta.url), 'utf8')
assert.ok(!source.includes('mockSPUs'), '款式档案列表页不应继续以内置 mockSPUs 作为主来源')
assert.ok(source.includes('generateStyleArchiveShellFromProject'), '从项目生成入口应调用正式写入服务')
assert.ok(!source.includes('同时创建技术资料版本 V1（草稿）'), '从项目生成模式不应再显示超出本轮范围的技术资料版本选项')
assert.ok(source.includes('从商品项目生成款式档案初始记录'), '列表页源码应包含新的项目生成说明口径')

const html = renderProductSpuPage()
assert.ok(html.includes('款式档案'), '款式档案列表页应正常渲染')
assert.ok(html.includes('SPU-2024-001'), '款式档案列表页应从旧 FCS 技术包种子补齐正式款式档案')
assert.ok(html.includes('TDV-LEGACY-001'), '已启用的旧 FCS 技术包应补齐当前生效技术包版本编号')

const project = listProjects().find((item) => getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'STYLE_ARCHIVE_CREATE'))
assert.ok(project, '从项目生成入口应存在可选项目')
updateProjectRecord(project!.projectId, {
  projectStatus: '进行中',
  currentPhaseCode: 'PHASE_04',
  currentPhaseName: '开发推进',
  linkedStyleId: '',
  linkedStyleCode: '',
  linkedStyleName: '',
  linkedStyleGeneratedAt: '',
}, '测试用户')
const styleNode = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'STYLE_ARCHIVE_CREATE')
updateProjectNodeRecord(project!.projectId, styleNode!.projectNodeId, { currentStatus: '未开始' }, '测试用户')

const beforeCount = listStyleArchives().length
handleProductSpuEvent({
  closest: () => ({ dataset: { spuAction: 'open-project-drawer' } }),
} as unknown as Element)
handleProductSpuInput({
  closest: () => ({ dataset: { spuField: 'projectId' }, value: project!.projectId }),
} as unknown as Element)
handleProductSpuEvent({
  closest: () => ({ dataset: { spuAction: 'submit-create' } }),
} as unknown as Element)

assert.equal(listStyleArchives().length, beforeCount + 1, '从款式档案页的从项目生成入口应正式写入款式档案主记录')
assert.match(appStore.getState().pathname, /\/pcs\/products\/styles\//, '从款式档案页生成成功后应跳转款式档案详情页')

console.log('pcs-style-archive-list-real-source.spec.ts PASS')

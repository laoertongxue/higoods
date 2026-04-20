import assert from 'node:assert/strict'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import {
  renderPcsStyleArchiveDetailPage,
  resetPcsProductArchiveState,
} from '../src/pages/pcs-product-archives.ts'
import {
  renderPcsProjectDetailPage,
  renderPcsProjectWorkItemDetailPage,
} from '../src/pages/pcs-projects.ts'

resetProjectRepository()
resetStyleArchiveRepository()
resetPcsProductArchiveState()

const legacyCreateLabel = ['新建', '技术包版本'].join('')
const legacyCopyLabel = ['复制为', '新版本'].join('')

const style = listStyleArchives()[0]
assert.ok(style, '应存在款式档案演示数据')

const styleHtml = renderPcsStyleArchiveDetailPage(style!.styleId)
assert.ok(!styleHtml.includes(legacyCreateLabel), '款式档案详情不应再显示旧直建入口')
assert.ok(!styleHtml.includes(legacyCopyLabel), '款式档案详情不应再显示旧复制入口')
assert.match(styleHtml, /技术包版本/, '款式档案详情应保留技术包版本查看区')

const project = listProjects().find((item) => item.linkedStyleId)
assert.ok(project, '应存在已关联款式档案的商品项目演示数据')

const projectHtml = await renderPcsProjectDetailPage(project!.projectId)
assert.ok(!projectHtml.includes(legacyCreateLabel), '商品项目详情不应再显示旧直建入口')
assert.ok(!projectHtml.includes(legacyCopyLabel), '商品项目详情不应再显示旧复制入口')

const transferPrepNode = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'PROJECT_TRANSFER_PREP')
assert.ok(transferPrepNode, '应存在项目转档准备节点')

const projectWorkItemHtml = await renderPcsProjectWorkItemDetailPage(
  project!.projectId,
  transferPrepNode!.projectNodeId,
)
assert.ok(!projectWorkItemHtml.includes(legacyCreateLabel), '项目节点详情不应再显示旧直建入口')
assert.ok(!projectWorkItemHtml.includes(legacyCopyLabel), '项目节点详情不应再显示旧复制入口')

console.log('pcs-remove-project-style-tech-pack-entry.spec.ts PASS')

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

const style = listStyleArchives()[0]
assert.ok(style, '应存在款式档案演示数据')

const styleHtml = renderPcsStyleArchiveDetailPage(style!.styleId)
assert.doesNotMatch(styleHtml, /新建技术包版本/, '款式档案详情不应再显示新建技术包版本入口')
assert.doesNotMatch(styleHtml, /复制为新版本/, '款式档案详情不应再显示复制为新版本入口')
assert.match(styleHtml, /技术包版本/, '款式档案详情应保留技术包版本查看区')

const project = listProjects().find((item) => item.linkedStyleId)
assert.ok(project, '应存在已关联款式档案的商品项目演示数据')

const projectHtml = await renderPcsProjectDetailPage(project!.projectId)
assert.doesNotMatch(projectHtml, /新建技术包版本/, '商品项目详情不应再显示新建技术包版本入口')
assert.doesNotMatch(projectHtml, /复制为新版本/, '商品项目详情不应再显示复制技术包版本入口')

const transferPrepNode = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'PROJECT_TRANSFER_PREP')
assert.ok(transferPrepNode, '应存在项目转档准备节点')

const projectWorkItemHtml = await renderPcsProjectWorkItemDetailPage(
  project!.projectId,
  transferPrepNode!.projectNodeId,
)
assert.doesNotMatch(projectWorkItemHtml, /新建技术包版本/, '项目节点详情不应再显示新建技术包版本入口')
assert.doesNotMatch(projectWorkItemHtml, /复制为新版本/, '项目节点详情不应再显示复制技术包版本入口')

console.log('pcs-remove-project-style-tech-pack-entry.spec.ts PASS')

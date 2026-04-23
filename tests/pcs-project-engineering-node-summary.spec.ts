import assert from 'node:assert/strict'
import fs from 'node:fs'

import { resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'
import { findLatestNodeInstance } from '../src/data/pcs-project-instance-model.ts'
import { resetProjectInlineNodeRecordRepository } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { listProjectNodes, listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-projects.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetProjectInlineNodeRecordRepository()
resetProjectChannelProductRepository()

const source = fs.readFileSync(new URL('../src/pages/pcs-projects.ts', import.meta.url), 'utf8')
assert.doesNotMatch(
  source,
  /任务补齐完成度|实例详情补齐|完成前校验|节点创建必须填写|实例详情继续补齐|完成后回写项目节点/,
  '商品项目中的工程任务节点不应再保留补齐说明壳',
)

const cases = [
  {
    workItemTypeCode: 'REVISION_TASK',
    moduleName: '改版任务',
    objectType: '改版任务',
    viewLabel: '查看改版任务',
    fieldLabel: '改版范围',
  },
  {
    workItemTypeCode: 'PATTERN_TASK',
    moduleName: '制版任务',
    objectType: '制版任务',
    viewLabel: '查看制版任务',
    fieldLabel: '版型类型',
  },
  {
    workItemTypeCode: 'PATTERN_ARTWORK_TASK',
    moduleName: '花型任务',
    objectType: '花型任务',
    viewLabel: '查看花型任务',
    fieldLabel: '需求来源',
  },
] as const

for (const item of cases) {
  const matched =
    listProjects()
      .flatMap((project) =>
        listProjectNodes(project.projectId)
          .filter((node) => node.workItemTypeCode === item.workItemTypeCode)
          .map((node) => ({
            project,
            node,
            instance: findLatestNodeInstance(
              project.projectId,
              node.projectNodeId,
              (instance) =>
                instance.sourceLayer === '正式业务对象' &&
                instance.moduleName === item.moduleName &&
                instance.objectType === item.objectType &&
                Boolean(instance.targetRoute),
            ),
          })),
      )
      .find((candidate) => candidate.instance) || null

  assert.ok(matched, `${item.workItemTypeCode} 应存在可查看详情的已创建任务节点`)

  const html = await renderPcsProjectWorkItemDetailPage(matched.project.projectId, matched.node.projectNodeId)

  assert.match(html, new RegExp(item.viewLabel), `${item.workItemTypeCode} 节点应提供查看任务入口`)
  assert.match(html, new RegExp(item.fieldLabel), `${item.workItemTypeCode} 节点应展示创建时必填的基础字段`)
  assert.doesNotMatch(
    html,
    /任务补齐完成度|实例详情补齐|完成前校验|保存正式字段|填写字段|暂无正式记录/,
    `${item.workItemTypeCode} 节点不应再显示补齐壳或内嵌编辑入口`,
  )
}

console.log('pcs-project-engineering-node-summary.spec.ts PASS')

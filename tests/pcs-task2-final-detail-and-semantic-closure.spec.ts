import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  renderPcsLiveTestingDetailPage,
} from '../src/pages/pcs-live-testing.ts'
import {
  renderPcsVideoTestingDetailPage,
} from '../src/pages/pcs-video-testing.ts'
import { renderPcsSampleInventoryPage } from '../src/pages/pcs-sample-management.ts'
import { renderPcsPatternTaskPage } from '../src/pages/pcs-engineering-tasks.ts'
import { listLiveSessionRecords } from '../src/data/pcs-live-testing-repository.ts'
import { listVideoTestRecords } from '../src/data/pcs-video-testing-repository.ts'
import { resolvePage } from '../src/router/routes.ts'

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')

const liveId = listLiveSessionRecords()[0]?.liveSessionId
assert.ok(liveId, '直播测款列表必须提供详情路由')
const liveDetailHtml = renderPcsLiveTestingDetailPage(liveId)
assert.match(liveDetailHtml, /返回列表/, '直播测款详情必须渲染详情页头')
assert.match(liveDetailHtml, /data-pcs-live-testing-action="set-detail-tab"/, '直播测款详情必须渲染详情页签')
assert.doesNotMatch(liveDetailHtml, /data-pcs-live-testing-list-page/, '直播测款详情路由不得返回列表')
const liveRouteHtml = await resolvePage(`/pcs/testing/live/${liveId}`)
assert.match(liveRouteHtml, /data-pcs-live-testing-action="set-detail-tab"/, '直播测款动态路由必须调用真实详情渲染器')
assert.doesNotMatch(liveRouteHtml, /data-route-redirect/, '直播测款动态路由不得重定向回列表')

const videoId = listVideoTestRecords()[0]?.videoRecordId
assert.ok(videoId, '短视频测款列表必须提供详情路由')
const videoDetailHtml = renderPcsVideoTestingDetailPage(videoId)
assert.match(videoDetailHtml, /返回列表/, '短视频测款详情必须渲染详情页头')
assert.match(videoDetailHtml, /data-pcs-video-testing-action="set-detail-tab"/, '短视频测款详情必须渲染详情页签')
assert.doesNotMatch(videoDetailHtml, /data-pcs-video-testing-list-page/, '短视频测款详情路由不得返回列表')
const videoRouteHtml = await resolvePage(`/pcs/testing/video/${videoId}`)
assert.match(videoRouteHtml, /data-pcs-video-testing-action="set-detail-tab"/, '短视频测款动态路由必须调用真实详情渲染器')
assert.doesNotMatch(videoRouteHtml, /data-route-redirect/, '短视频测款动态路由不得重定向回列表')

for (const relativePath of [
  'src/pages/pcs-live-testing.ts',
  'src/pages/pcs-video-testing.ts',
]) {
  const source = readSource(relativePath)
  assert.doesNotMatch(
    source,
    /get\w*WorkItem\w*|workItemSnapshot|工作项/,
    `${relativePath} 必须使用商品项目与测款步骤事实，不得保留工作项语义`,
  )
  assert.match(source, /项目步骤字段/, `${relativePath} 必须将详情事实明确为项目步骤字段`)
}

const samplePageSource = readSource('src/pages/pcs-sample-management.ts')
const sampleDataSource = readSource('src/data/pcs-sample-management.ts')
assert.doesNotMatch(samplePageSource, /关联项目|工作项/, '样衣管理页面必须使用商品项目和来源步骤口径')
assert.doesNotMatch(
  `${samplePageSource}\n${sampleDataSource}`,
  /relatedStepName|stepDefinitionName/,
  '样衣管理模型必须使用来源步骤字段，不得保留工作项定义字段',
)
const sampleHtml = renderPcsSampleInventoryPage()
assert.match(sampleHtml, /商品项目/, '样衣库存必须展示商品项目归属')
assert.match(sampleHtml, /来源步骤/, '样衣库存必须展示来源步骤')

const patternPageSource = readSource('src/pages/pcs-engineering-tasks.ts')
assert.match(
  patternPageSource,
  /\{ key: 'project', title: '商品项目'[^}]*required: true/,
  '花型标准列表必须声明不可隐藏的商品项目列',
)
const patternHtml = renderPcsPatternTaskPage()
assert.match(patternHtml, />商品项目</, '花型列表必须展示商品项目列')
assert.match(patternHtml, /data-nav="\/pcs\/projects\//, '花型列表必须提供商品项目详情入口')

for (const relativePath of [
  'src/data/pcs-revision-task-repository.ts',
  'src/data/pcs-pattern-task-repository.ts',
  'src/data/pcs-first-sample-repository.ts',
  'src/data/pcs-plate-making-repository.ts',
  'src/data/pcs-first-order-sample-repository.ts',
]) {
  assert.doesNotMatch(
    readSource(relativePath),
    /\w+ByProjectNode/,
    `${relativePath} 不得保留零调用的项目节点查询兼容 API`,
  )
  assert.doesNotMatch(
    readSource(relativePath),
    /从项目节点生成|项目节点生成档案/,
    `${relativePath} 不得表述为从项目节点生成商品档案`,
  )
}

for (const relativePath of [
  'src/pages/pcs-product-archives.ts',
  'src/pages/pcs-projects.ts',
  'src/data/pcs-project-inline-node-record-bootstrap.ts',
  'src/data/pcs-channel-product-project-repository.ts',
  'src/data/pcs-project-closure-view-model.ts',
]) {
  assert.doesNotMatch(
    readSource(relativePath),
    /完善商品档案节点|完善商品档案/,
    `${relativePath} 必须统一为商品档案资料完善或已有档案口径`,
  )
}

const taskBootstrapSource = readSource('src/data/pcs-task-bootstrap.ts')
assert.doesNotMatch(
  taskBootstrapSource,
  /WI-LEGACY|(?:RT|AT|FS|PP)-LEGACY|历史(?:改版|既有商品改款|花型|首版样衣打样|首单样衣打样)任务|任务已迁移|任务迁移/,
  '专业任务 bootstrap 只提供当前项目级演示数据，不得包含老任务迁移 Mock、工作项引用或迁移文案',
)

console.log('pcs-task2-final-detail-and-semantic-closure.spec.ts PASS')

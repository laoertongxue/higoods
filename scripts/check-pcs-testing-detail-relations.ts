import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const liveTypesSource = read('src/data/pcs-live-testing-types.ts')
assert.ok(liveTypesSource.includes('liveLineId'), '直播商品明细正式对象必须包含 liveLineId')
assert.ok(liveTypesSource.includes('liveLineCode'), '直播商品明细正式对象必须包含 liveLineCode')

const normalizerSource = read('src/data/pcs-testing-relation-normalizer.ts')
assert.ok(normalizerSource.includes("sourceObjectType: '直播商品明细'"), '直播正式关系对象类型必须是“直播商品明细”')
assert.ok(normalizerSource.includes("sourceObjectType: '短视频记录'"), '短视频正式关系对象类型必须是“短视频记录”')
assert.ok(normalizerSource.includes('sourceLineId: line.liveLineId'), '直播正式关系写入时必须使用 sourceLineId')

const relationRepositorySource = read('src/data/pcs-project-relation-repository.ts')
assert.ok(relationRepositorySource.includes('listProjectRelationsByLiveProductLine('), '项目关系仓储必须支持按直播商品明细查询')
assert.ok(relationRepositorySource.includes('listProjectRelationsByVideoRecord('), '项目关系仓储必须支持按短视频记录查询')
assert.ok(relationRepositorySource.includes('replaceLiveProductLineProjectRelations('), '项目关系仓储必须支持替换直播商品明细的全部项目关系')
assert.ok(relationRepositorySource.includes('replaceVideoRecordProjectRelations('), '项目关系仓储必须支持替换短视频记录的全部项目关系')

const testingBootstrapSource = read('src/data/pcs-testing-relation-bootstrap.ts')
assert.ok(!testingBootstrapSource.includes("sourceObjectType: '直播场次'"), '不得把直播场次头直接写成正式项目关系对象')

const livePageSource = read('src/pages/pcs-testing-live.ts')
assert.ok(livePageSource.includes('直播商品明细'), '直播页必须显式区分直播场次头与直播商品明细')
assert.ok(livePageSource.includes('关联商品项目'), '直播商品明细必须提供关联商品项目操作')
assert.ok(!livePageSource.includes('projectRef'), '直播页不得继续把场次头 projectRef 作为正式项目关系主来源')

const videoPageSource = read('src/pages/pcs-testing-video.ts')
assert.ok(videoPageSource.includes('关联商品项目'), '短视频记录必须提供关联商品项目操作')
assert.ok(!videoPageSource.includes('projectRef'), '短视频页不得继续把旧 projectRef 直接作为正式项目标签主来源')

const liveDetailPageSource = read('src/pages/pcs-testing-live-detail.ts')
assert.ok(liveDetailPageSource.includes('listProjectRelationsByLiveProductLine'), '直播详情页明细项目展示必须回读正式项目关系仓储')

const videoDetailPageSource = read('src/pages/pcs-testing-video-detail.ts')
assert.ok(videoDetailPageSource.includes('listProjectRelationsByVideoRecord'), '短视频详情页项目展示必须回读正式项目关系仓储')

const detailPageSource = read('src/pages/pcs-project-detail.ts')
assert.ok(detailPageSource.includes('renderRelationTestingDetails'), '项目详情页测款关系展示必须来自正式关系视图数据')

const nodeDetailPageSource = read('src/pages/pcs-project-work-item-detail.ts')
assert.ok(nodeDetailPageSource.includes('renderRelationTestingDetails'), '项目工作项详情页测款关系展示必须来自正式关系视图数据')

console.log('check-pcs-testing-detail-relations.ts PASS')

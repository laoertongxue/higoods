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

const ownershipSource = read('src/data/pcs-testing-ownership.ts')
assert.ok(ownershipSource.includes('正式项目测款'), '测款归属辅助模块必须包含“正式项目测款”标签')
assert.ok(ownershipSource.includes('独立历史测款样本'), '测款归属辅助模块必须包含“独立历史测款样本”标签')
assert.ok(ownershipSource.includes('历史迁移测款样本'), '测款归属辅助模块必须包含“历史迁移测款样本”标签')

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
assert.ok(livePageSource.includes('getLiveSessionOwnershipSummary'), '直播页必须接入统一的测款归属标签')
assert.ok(livePageSource.includes('getLiveLineOwnershipSummary'), '直播商品明细必须接入统一的测款归属标签')
assert.ok(!livePageSource.includes('item.projectRef'), '直播页不得继续把场次头或商品明细原始 projectRef 作为正式项目关系主来源')

const videoPageSource = read('src/pages/pcs-testing-video.ts')
assert.ok(videoPageSource.includes('关联商品项目'), '短视频记录必须提供关联商品项目操作')
assert.ok(videoPageSource.includes('getVideoRecordOwnershipSummary'), '短视频页必须接入统一的测款归属标签')
assert.ok(!videoPageSource.includes('item.projectRef'), '短视频页不得继续把旧 projectRef 直接作为正式项目标签主来源')

const liveDetailPageSource = read('src/pages/pcs-testing-live-detail.ts')
assert.ok(liveDetailPageSource.includes('listProjectRelationsByLiveProductLine'), '直播详情页明细项目展示必须回读正式项目关系仓储')
assert.ok(liveDetailPageSource.includes('findProjectChannelProductByLiveLine'), '直播详情页必须显示引用的渠道商品编码与上游渠道商品编码')
assert.ok(liveDetailPageSource.includes('样本归属'), '直播详情页必须展示样本归属')

const videoDetailPageSource = read('src/pages/pcs-testing-video-detail.ts')
assert.ok(videoDetailPageSource.includes('listProjectRelationsByVideoRecord'), '短视频详情页项目展示必须回读正式项目关系仓储')
assert.ok(videoDetailPageSource.includes('findProjectChannelProductByVideoRecord'), '短视频详情页必须显示引用的渠道商品编码与上游渠道商品编码')
assert.ok(videoDetailPageSource.includes('样本归属'), '短视频详情页必须展示样本归属')

const detailPageSource = read('src/pages/pcs-project-detail.ts')
assert.ok(detailPageSource.includes('renderRelationTestingDetails'), '项目详情页测款关系展示必须来自正式关系视图数据')

const nodeDetailPageSource = read('src/pages/pcs-project-work-item-detail.ts')
assert.ok(nodeDetailPageSource.includes('renderRelationTestingDetails'), '项目工作项详情页测款关系展示必须来自正式关系视图数据')

console.log('check-pcs-testing-detail-relations.ts PASS')

import fs from 'node:fs'
import path from 'node:path'
import { listProjectFlowStageContracts } from '../src/data/pcs-project-domain-contract.ts'

const root = process.cwd()

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

const projectContractSource = read('src/data/pcs-project-domain-contract.ts')
const listingRepositorySource = read('src/data/pcs-channel-product-project-repository.ts')
const projectPageSource = read('src/pages/pcs-projects.ts')
const channelProductsPageSource = read('src/pages/pcs-channel-products.ts')
const projectInitSection = projectContractSource.match(/PROJECT_INIT[\s\S]*?CHANNEL_PRODUCT_LISTING/)
const forbiddenSpecPlanPattern = new RegExp(['plannedColor', 'plannedSize', 'plannedPrint', 'plannedSpec', '规格计划', '预期颜色', '预期尺码', '预期花型'].join('|'))
assert(projectInitSection, '未找到商品项目立项与商品上架工作项定义片段')
assert(
  !forbiddenSpecPlanPattern.test(projectInitSection![0]),
  '商品项目立项中仍存在规格计划相关字段或文案',
)

const listingFieldSection = projectContractSource.match(/const channelListingFields = \[[\s\S]*?\n\]/)
assert(listingFieldSection, '未找到商品上架字段定义')
assert(!/skuId|skuCode|skuName/.test(listingFieldSection![0]), '商品上架字段定义仍以单规格字段为主')

assert(!/resolveChannelProductSku|fallbackSku|SKU-AUTO|normalizeSkuBaseCode/.test(listingRepositorySource), '仍存在 fallback 生成 SKU 逻辑')
assert(/specLines/.test(listingRepositorySource), '商品上架记录缺少规格明细字段')
assert(/markProjectChannelProductListingCompleted/.test(listingRepositorySource), '缺少商品上架标记完成方法')
assert(
  /当前款式尚未成功上传到渠道，不能标记完成。|存在未上传成功的规格，不能标记完成。/.test(listingRepositorySource),
  '商品上架完成前检查上传状态的逻辑缺失',
)

assert(!/请选择规格档案/.test(projectPageSource), '商品上架节点页面仍要求选择正式规格档案')
assert(/规格明细/.test(projectPageSource), '商品上架节点页面缺少规格明细区')
assert(/上传到渠道/.test(projectPageSource), '商品上架节点页面缺少上传动作')
assert(/完成商品上架|标记商品上架完成/.test(projectPageSource), '商品上架节点页面缺少完成动作')

assert(/商品上架批次/.test(channelProductsPageSource), '渠道商品页面未切换到款式上架批次口径')
assert(/规格数量/.test(channelProductsPageSource), '渠道商品页面缺少规格数量展示')

const fixedTaskCodes = listProjectFlowStageContracts().flatMap((step) => step.stepCodes)
const listingIndex = fixedTaskCodes.indexOf('CHANNEL_PRODUCT_LISTING')
const liveTestIndex = fixedTaskCodes.indexOf('LIVE_TEST')
const videoTestIndex = fixedTaskCodes.indexOf('VIDEO_TEST')
assert(listingIndex >= 0, '固定五步缺少商品上架任务')
assert(liveTestIndex >= 0 && videoTestIndex >= 0, '固定五步缺少直播或短视频测款任务')
assert(listingIndex < liveTestIndex, '商品上架必须早于直播测款')
assert(listingIndex < videoTestIndex, '商品上架必须早于短视频测款')
assert(fixedTaskCodes.includes('PROJECT_INIT'), '商品／款式档案应由项目与档案建立步骤同步建立')

console.log('check-pcs-channel-listing-style-specs.ts PASS')

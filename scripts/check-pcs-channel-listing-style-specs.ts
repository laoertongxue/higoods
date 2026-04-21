import fs from 'node:fs'
import path from 'node:path'
import { listProjectTemplates } from '../src/data/pcs-templates.ts'

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
assert(/上传款式到渠道/.test(projectPageSource), '商品上架节点页面缺少上传动作')
assert(/标记商品上架完成/.test(projectPageSource), '商品上架节点页面缺少标记完成动作')

assert(/渠道商品上架批次/.test(channelProductsPageSource), '渠道商品页面未切换到款式上架批次口径')
assert(/规格数量/.test(channelProductsPageSource), '渠道商品页面缺少规格数量展示')

for (const templateName of [
  '基础款 - 完整测款转档模板',
  '快时尚款 - 直播快反模板',
  '改版款 - 改版测款转档模板',
  '设计款 - 设计验证模板',
]) {
  const template = listProjectTemplates().find((item) => item.name === templateName)
  assert(template, `未找到模板：${templateName}`)
  const sortedNodes = template!.nodes
    .slice()
    .sort((a, b) => (a.phaseCode === b.phaseCode ? a.sequenceNo - b.sequenceNo : a.phaseCode.localeCompare(b.phaseCode)))
  const listingIndex = sortedNodes.findIndex((node) => node.workItemTypeCode === 'CHANNEL_PRODUCT_LISTING')
  const styleArchiveIndex = sortedNodes.findIndex((node) => node.workItemTypeCode === 'STYLE_ARCHIVE_CREATE')
  assert(listingIndex >= 0, `${templateName} 缺少商品上架节点`)
  assert(styleArchiveIndex >= 0, `${templateName} 缺少生成款式档案节点`)
  assert(listingIndex < styleArchiveIndex, `${templateName} 把生成款式档案提前到了商品上架之前`)
}

console.log('check-pcs-channel-listing-style-specs.ts PASS')

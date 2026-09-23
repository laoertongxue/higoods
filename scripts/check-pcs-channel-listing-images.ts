import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

const projectDomainContract = read('src/data/pcs-project-domain-contract.ts')
const listingRepository = read('src/data/pcs-channel-product-project-repository.ts')
const listingImageTypes = read('src/data/pcs-channel-listing-image-types.ts')
const listingImageUtils = read('src/data/pcs-channel-listing-image-utils.ts')
const projectImageTypes = read('src/data/pcs-project-image-types.ts')
const channelProductsPage = read('src/pages/pcs-channel-products.ts')

const listingFieldSection = projectDomainContract.match(/const channelListingFields = \[[\s\S]*?\n\]/)
assert(listingFieldSection, '未找到商品上架字段定义')
assert(/listingMainImageId/.test(listingFieldSection![0]), '商品上架字段定义缺少上架主图')
assert(/listingImageIds/.test(listingFieldSection![0]), '商品上架字段定义缺少上架图片集合')
assert(/listingImageSource/.test(listingFieldSection![0]), '商品上架字段定义缺少图片来源')
assert(!/fieldKey: 'mainImageUrls'|fieldKey: 'detailImageUrls'/.test(listingFieldSection![0]), '商品上架字段定义仍把旧 URL 数组作为主输入')

assert(/export interface ChannelListingImageRecord/.test(listingImageTypes), '缺少商品上架图片引用类型')
assert(/'上架图'/.test(projectImageTypes), '项目图片资产类型中缺少上架图')
assert(/'可用于上架'/.test(projectImageTypes), '项目图片资产状态中缺少可用于上架')

assert(/validateChannelListingImagesForUpload/.test(listingRepository), '商品上架仓储缺少上传前图片校验')
assert(/请先选择或上传上架图片。/.test(listingImageUtils), '商品上架图片工具缺少图片集合校验提示')
assert(/请设置上架主图。/.test(listingImageUtils), '商品上架图片工具缺少主图校验提示')
assert(/请确认图片可用于商品上架。/.test(listingImageUtils), '商品上架图片工具缺少图片用途校验提示')
assert(/markProjectChannelProductListingCompleted/.test(listingRepository), '商品上架仓储缺少标记完成方法')

assert(/上架主图/.test(channelProductsPage), '渠道商品页缺少上架主图展示')

console.log('check-pcs-channel-listing-images.ts PASS')

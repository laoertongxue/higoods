import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

const domainContract = read('src/data/pcs-project-domain-contract.ts')
const imageTypes = read('src/data/pcs-project-image-types.ts')
const imageRepository = read('src/data/pcs-project-image-repository.ts')
const imageService = read('src/data/pcs-sample-shoot-image-service.ts')
const inlineTypes = read('src/data/pcs-project-inline-node-record-types.ts')

assert.match(domainContract, /sampleFlatImageIds/, '样衣拍摄与试穿字段定义中应存在样衣平铺图字段')
assert.match(domainContract, /sampleTryOnImageIds/, '样衣拍摄与试穿字段定义中应存在试穿图字段')
assert.match(domainContract, /sampleDetailImageIds/, '样衣拍摄与试穿字段定义中应存在细节图字段')
assert.match(domainContract, /listingCandidateImageIds/, '样衣拍摄与试穿字段定义中应存在商品上架候选图字段')
assert.match(domainContract, /styleArchiveCandidateImageIds/, '样衣拍摄与试穿字段定义中应存在款式档案候选图字段')

assert.match(imageTypes, /'样衣平铺图'/, '项目图片资产类型中应存在样衣平铺图')
assert.match(imageTypes, /'试穿图'/, '项目图片资产类型中应存在试穿图')
assert.match(imageTypes, /'细节图'/, '项目图片资产类型中应存在细节图')
assert.match(imageTypes, /'可用于上架'/, '项目图片资产状态中应存在可用于上架')
assert.match(imageTypes, /'可用于款式档案'/, '项目图片资产状态中应存在可用于款式档案')

assert.match(imageService, /appendSampleShootImages/, '应存在样衣拍摄图片上传服务')
assert.match(imageService, /updateSampleShootImageUsage/, '应存在样衣拍摄图片用途标记服务')
assert.match(imageRepository, /listProjectImageAssetsBySourceNode/, '项目图片资产仓储应支持按节点读取图片')
assert.match(inlineTypes, /sampleFlatImageIds: string\[\]/, '样衣拍摄记录中应保留样衣平铺图字段')

assert.ok(
  !existsSync(path.join(root, 'src/pages/pcs-projects.ts')),
  '商品项目详情页应已删除，不得恢复项目参考图自动转样衣图逻辑',
)

console.log('check-pcs-sample-shoot-images.ts PASS')

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

const projectPage = read('src/pages/pcs-projects.ts')
const projectDomainContract = read('src/data/pcs-project-domain-contract.ts')
const imageTypes = read('src/data/pcs-project-image-types.ts')
const imageRepository = read('src/data/pcs-project-image-repository.ts')
const imageMigration = read('src/data/pcs-project-image-migration.ts')

assert.doesNotMatch(projectPage, /项目图册链接|参考图片链接|每行一个链接|create-project-album-urls/, '商品项目创建页不应保留图片链接文本输入')
assert.match(projectPage, /上传参考图片/, '商品项目创建页应提供上传参考图片入口')
assert.match(projectDomainContract, /label: '参考图片'/, '商品项目立项字段应改为参考图片')
assert.match(imageTypes, /export interface PcsProjectImageAssetRecord/, '应存在项目图片资产对象')
assert.match(imageTypes, /'项目参考图'/, '项目图片资产应支持项目参考图类型')
assert.match(imageRepository, /replaceProjectInitReferenceImages/, '应存在项目立项参考图片写入方法')
assert.match(imageMigration, /projectAlbumUrls/, '应存在旧 projectAlbumUrls 迁移逻辑')

console.log('check-pcs-project-image-assets.ts PASS')

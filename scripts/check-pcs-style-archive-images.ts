import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function assertIncludes(content: string, pattern: string, label: string): void {
  if (!content.includes(pattern)) {
    throw new Error(`缺少 ${label}: ${pattern}`)
  }
}

function assertNotIncludes(content: string, pattern: string, label: string): void {
  if (content.includes(pattern)) {
    throw new Error(`不应保留 ${label}: ${pattern}`)
  }
}

const generation = read('src/data/pcs-project-style-archive-generation.ts')
const selection = read('src/data/pcs-style-archive-image-selection.ts')
const archiveTypes = read('src/data/pcs-style-archive-types.ts')

assertIncludes(archiveTypes, 'mainImageId', '款式档案唯一主图资产字段')
assertIncludes(archiveTypes, 'galleryImageIds', '款式档案唯一图册资产字段')
assertIncludes(archiveTypes, 'imageSource', '款式档案唯一图片来源字段')

assertIncludes(selection, 'listStyleArchiveImageCandidates', '款式档案候选图片读取')
assertIncludes(selection, 'listingImageIds', '商品上架图片候选优先级')
assertIncludes(selection, '项目参考图', '项目参考图候选')
assertIncludes(selection, '款式档案图', '款式档案补充图候选')
assertIncludes(selection, 'resolveStyleArchiveImageSelection', '款式档案图片选择解析')
assertIncludes(selection, 'mainImageId: mainImage.imageId', '主图资产回写结果')
assertIncludes(selection, 'galleryImageIds: galleryAssets.map', '图册资产回写结果')
assertIncludes(selection, 'imageSource,', '图片来源回写结果')

assertIncludes(generation, 'applyStyleArchiveImageSelection', '款式档案图片唯一写入口')
assertIncludes(generation, 'mainImageId: selection.mainImageId', '款式档案主图写回')
assertIncludes(generation, 'galleryImageIds: selection.galleryImageIds', '款式档案图册写回')
assertIncludes(generation, 'imageSource: selection.imageSource', '款式档案图片来源写回')
assertNotIncludes(generation, 'buildStyleFixture', '旧 fixture 图片逻辑')
assertNotIncludes(generation, 'styleMainImageId', '项目主记录图片兼容字段')
assertNotIncludes(generation, 'styleGalleryImageIds', '项目主记录图册兼容字段')

console.log('check-pcs-style-archive-images.ts PASS')

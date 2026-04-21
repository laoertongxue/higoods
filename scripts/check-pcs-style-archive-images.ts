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

const contract = read('src/data/pcs-project-domain-contract.ts')
const generation = read('src/data/pcs-project-style-archive-generation.ts')
const selection = read('src/data/pcs-style-archive-image-selection.ts')
const styleTypes = read('src/data/pcs-style-archive-types.ts')
const archiveCollector = read('src/data/pcs-project-archive-collector.ts')
const projectsPage = read('src/pages/pcs-projects.ts')

assertIncludes(contract, 'styleMainImageId', '生成款式档案主图字段')
assertIncludes(contract, 'styleGalleryImageIds', '生成款式档案图册字段')
assertIncludes(contract, 'styleImageSource', '生成款式档案图片来源字段')
assertIncludes(contract, 'styleImageConfirmedAt', '生成款式档案确认时间字段')
assertIncludes(contract, 'styleImageConfirmedBy', '生成款式档案确认人字段')

assertIncludes(styleTypes, 'mainImageId', '款式档案主图图片资产字段')
assertIncludes(styleTypes, 'galleryImageIds', '款式档案图册图片资产字段')
assertIncludes(styleTypes, 'imageSource', '款式档案图片来源字段')

assertNotIncludes(generation, 'buildStyleFixture', '新生成款式档案默认 fixture 图片逻辑')
assertNotIncludes(generation, 'fixture.mainImageUrl', '新生成款式档案默认主图')
assertNotIncludes(generation, 'fixture.galleryImageUrls', '新生成款式档案默认图册')

assertIncludes(selection, 'listingImageIds', '商品上架图片候选读取')
assertIncludes(selection, '项目参考图', '项目参考图候选')
assertIncludes(selection, '款式档案图', '款式档案补充图候选')
assertIncludes(selection, '可用于款式档案', '款式档案用途标记')

assertIncludes(projectsPage, '需确认后使用', '项目参考图确认提示')
assertIncludes(projectsPage, '确认可用于款式档案并加入', '参考图确认按钮')
assertIncludes(projectsPage, 'style-archive-supplement-images', '档案补充图片上传字段')

assertIncludes(archiveCollector, 'mainImageId', '项目资料归档采集款式主图资产')
assertIncludes(archiveCollector, 'galleryImageIds', '项目资料归档采集款式图册资产')
assertIncludes(archiveCollector, '款式档案图', '项目资料归档款式图片类型')

console.log('check-pcs-style-archive-images.ts PASS')

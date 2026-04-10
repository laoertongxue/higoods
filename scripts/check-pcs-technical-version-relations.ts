import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const contextSource = read('src/pages/tech-pack/context.ts')
assert.ok(!contextSource.includes('getOrCreateTechPack'), '技术资料页面上下文不应再以旧 FCS 技术包作为正式主来源')
assert.ok(!contextSource.includes('updateTechPack('), '技术资料页面上下文不应再直接写旧 FCS 技术包对象')

const repositorySource = read('src/data/pcs-technical-data-version-repository.ts')
assert.ok(repositorySource.includes('createTechnicalDataVersionDraft'), '必须存在正式技术资料版本仓储')

const writebackSource = read('src/data/pcs-project-technical-data-writeback.ts')
assert.ok(writebackSource.includes('upsertProjectRelation'), '技术资料版本正式写入必须写项目关系仓储')
assert.ok(writebackSource.includes('updateProjectNodeRecord'), '技术资料版本正式写入必须回写项目节点')
assert.ok(writebackSource.includes('updateStyleArchive'), '技术资料版本正式写入必须回写款式档案')
assert.ok(writebackSource.includes('updateProjectRecord'), '技术资料版本正式写入必须回写商品项目主记录')

const qualitySource = read('src/pages/tech-pack/quality-domain.ts')
assert.ok(qualitySource.includes('质检标准'), '必须存在正式质检标准域页面')

const styleDetailSource = read('src/pages/pcs-product-style-detail.ts')
assert.ok(!styleDetailSource.includes('STYLE_EXTRA_BY_ID'), '款式档案详情页不应再用 STYLE_EXTRA_BY_ID 主导技术资料版本显示')
assert.ok(styleDetailSource.includes('buildTechnicalVersionListByStyle'), '款式档案详情页应读取正式技术资料版本视图模型')

const styleListSource = read('src/pages/pcs-product-spu.ts')
assert.ok(!styleListSource.includes('mockSPUs'), '款式档案列表页不应再以内置 mockSPUs 作为正式主来源')
assert.ok(styleListSource.includes('effectiveTechnicalVersionText'), '款式档案列表页应展示正式当前生效技术资料版本信息')

const routeSource = read('src/router/routes.ts')
assert.ok(routeSource.includes('technical-data') && routeSource.includes('renderTechPackPage'), '必须存在 PCS 正式技术资料版本详情路由')
assert.ok(routeSource.includes('fcs\\/tech-pack'), '必须保留 FCS 技术资料兼容入口')
assert.ok(routeSource.includes('compatibilityMode: true'), 'FCS 技术资料兼容入口应显式进入兼容模式')

const coreSource = read('src/pages/tech-pack/core.ts')
assert.ok(coreSource.includes('技术资料版本 -'), '技术资料页面主标题应统一为技术资料版本')
assert.ok(!coreSource.includes('技术包 -'), '技术资料页面主标题不应继续使用技术包')

assert.ok(!contextSource.includes("key: 'cost'"), '成本页签不应进入技术资料正式关键项校验')

const projectDetailSource = read('src/pages/pcs-project-detail.ts')
assert.ok(projectDetailSource.includes('create-technical-version'), '项目详情页必须提供正式新建技术资料版本入口')
assert.ok(projectDetailSource.includes('go-technical-version'), '项目详情页必须提供正式查看技术资料版本入口')
assert.ok(projectDetailSource.includes('technicalVersionDetail'), '项目详情页必须读取正式技术资料版本关系视图数据')

const nodeDetailSource = read('src/pages/pcs-project-work-item-detail.ts')
assert.ok(nodeDetailSource.includes('create-technical-version'), '项目节点详情页必须提供正式新建技术资料版本入口')
assert.ok(nodeDetailSource.includes('go-technical-version'), '项目节点详情页必须提供正式查看技术资料版本入口')
assert.ok(nodeDetailSource.includes('technicalVersionDetail'), '项目节点详情页必须读取正式技术资料版本关系视图数据')

console.log('check-pcs-technical-version-relations.ts PASS')

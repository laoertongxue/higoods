import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const listPageSource = read('src/pages/pcs-product-spu.ts')
assert.ok(!listPageSource.includes('mockSPUs'), '款式档案列表页不允许继续以内置 mockSPUs 作为主渲染来源')
assert.ok(listPageSource.includes('generateStyleArchiveShellFromProject'), '从项目生成入口必须调用正式写入服务')
assert.ok(!listPageSource.includes('同时创建技术资料版本 V1（草稿）'), '从项目生成模式不应再显示超出本轮范围的技术资料版本选项')
assert.ok(!listPageSource.includes('生成商品档案'), '页面可见文案应统一为生成款式档案')

const detailPageSource = read('src/pages/pcs-product-style-detail.ts')
assert.ok(!detailPageSource.includes('STYLE_EXTRA_BY_ID'), '款式档案详情页不允许继续以内置 STYLE_EXTRA_BY_ID 作为主详情来源')
assert.ok(detailPageSource.includes('暂无技术资料版本'), '款式档案详情页应包含壳记录空状态文案')

const writebackSource = read('src/data/pcs-project-style-archive-writeback.ts')
assert.ok(writebackSource.includes('upsertProjectRelation'), '项目生成款式档案后必须写入项目关系仓储')
assert.ok(writebackSource.includes('updateProjectRecord'), '项目生成款式档案后必须回写商品项目主记录')
assert.ok(writebackSource.includes('updateProjectNodeRecord'), '项目生成款式档案后必须回写项目节点')

const projectDetailSource = read('src/pages/pcs-project-detail.ts')
assert.ok(projectDetailSource.includes('generate-style-archive'), '项目详情页必须提供正式生成款式档案入口')
assert.ok(projectDetailSource.includes('go-style-archive'), '项目详情页必须提供查看款式档案入口')
assert.ok(!projectDetailSource.includes('生成商品档案'), '项目详情页不应继续使用生成商品档案旧口径')

const projectNodeDetailSource = read('src/pages/pcs-project-work-item-detail.ts')
assert.ok(projectNodeDetailSource.includes('generate-style-archive'), '项目节点详情页必须提供正式生成款式档案入口')
assert.ok(projectNodeDetailSource.includes('go-style-archive'), '项目节点详情页必须提供查看款式档案入口')

console.log('check-pcs-style-archive-shell-generation.ts PASS')

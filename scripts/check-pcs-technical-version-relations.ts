import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const serviceSource = read('src/data/pcs-tech-pack-task-generation.ts')
assert.ok(serviceSource.includes('generateTechPackVersionFromRevisionTask'), '必须存在改版任务生成技术包版本服务')
assert.ok(serviceSource.includes('generateTechPackVersionFromPlateTask'), '必须存在制版任务生成技术包版本服务')
assert.ok(serviceSource.includes('generateTechPackVersionFromPatternTask'), '必须存在花型任务生成技术包版本服务')
assert.ok(!serviceSource.includes('createTechnicalDataVersionFromStyle'), '不应保留从款式直接生成技术包版本旧方法')
assert.ok(!serviceSource.includes('createTechnicalDataVersionFromProject'), '不应保留从项目直接生成技术包版本旧方法')

const typesSource = read('src/data/pcs-technical-data-version-types.ts')
assert.ok(typesSource.includes('linkedRevisionTaskIds'), '技术包版本类型必须包含 linkedRevisionTaskIds')
assert.ok(typesSource.includes('createdFromTaskType'), '技术包版本类型必须包含 createdFromTaskType')
assert.ok(typesSource.includes('baseTechnicalVersionId'), '技术包版本类型必须包含 baseTechnicalVersionId')

const styleDetailSource = read('src/pages/pcs-product-style-detail.ts')
assert.ok(!styleDetailSource.includes('新建技术包版本'), '款式档案页不应保留新建技术包版本按钮')
assert.ok(!styleDetailSource.includes('复制为新版本'), '款式档案页不应保留复制为新版本按钮')
assert.ok(styleDetailSource.includes('查看来源任务'), '款式档案页应保留来源任务查看入口')

const activationSource = read('src/data/pcs-tech-pack-version-activation.ts')
assert.ok(activationSource.includes("archiveStatus: 'ACTIVE'"), '启用技术包版本后必须把款式档案切为可生产')
assert.ok(activationSource.includes('syncProjectChannelProductAfterTechPackActivation'), '启用技术包版本后必须同步上游最终更新')

const projectDetailSource = read('src/pages/pcs-project-detail.ts')
assert.ok(!projectDetailSource.includes('新建技术包版本'), '商品项目页不应保留新建技术包版本按钮')
assert.ok(projectDetailSource.includes('查看技术包版本'), '商品项目页应保留查看技术包版本入口')
assert.ok(projectDetailSource.includes('来源任务链'), '商品项目页应展示来源任务链')

const projectNodeSource = read('src/pages/pcs-project-work-item-detail.ts')
assert.ok(!projectNodeSource.includes('新建技术包版本'), '项目节点页不应保留新建技术包版本按钮')
assert.ok(projectNodeSource.includes('最近关联技术包版本编号'), '项目节点页应保留技术包版本链路字段')
assert.ok(projectNodeSource.includes('来源任务链'), '项目节点页应展示来源任务链')

console.log('check-pcs-technical-version-relations.ts PASS')

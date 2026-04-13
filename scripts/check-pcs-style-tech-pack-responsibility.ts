import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

function searchInSrc(pattern: string): string {
  try {
    return execSync(`rg -n "${pattern}" src`, {
      cwd: new URL('..', import.meta.url),
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    }).trim()
  } catch (error) {
    const output = (error as { stdout?: string }).stdout || ''
    return output.trim()
  }
}

const versionTypeSource = read('src/data/pcs-technical-data-version-types.ts')
const styleTypeSource = read('src/data/pcs-style-archive-types.ts')
const styleDetailSource = read('src/pages/pcs-product-style-detail.ts')
const projectDetailSource = read('src/pages/pcs-project-detail.ts')
const projectNodeSource = read('src/pages/pcs-project-work-item-detail.ts')
const techPackCoreSource = read('src/pages/tech-pack/core.ts')
const writebackSource = read('src/data/pcs-project-technical-data-writeback.ts')
const activationSource = read('src/data/pcs-tech-pack-version-activation.ts')
const publishSection = writebackSource.match(/export function publishTechnicalDataVersion[\s\S]*?\n}\n?/)?.[0] || ''

assert.equal(searchInSrc('effectiveFlag'), '', '源码中不应再存在 effectiveFlag')
assert.equal(searchInSrc('effectiveTechnicalVersion'), '', '源码中不应再存在 effectiveTechnicalVersion*')
assert.equal(searchInSrc('linkedTechnicalVersion'), '', '源码中不应再存在 linkedTechnicalVersion*')

assert.ok(styleTypeSource.includes('currentTechPackVersionStatus'), '款式档案类型必须包含当前生效版本状态字段')
assert.ok(styleTypeSource.includes('currentTechPackVersionActivatedAt'), '款式档案类型必须包含启用时间字段')
assert.ok(styleTypeSource.includes('currentTechPackVersionActivatedBy'), '款式档案类型必须包含启用人字段')
assert.ok(!versionTypeSource.includes('effectiveFlag'), '技术包版本类型中不应保留 effectiveFlag')

assert.ok(!styleDetailSource.includes('新建技术包版本'), '款式档案页不应再渲染新建技术包版本按钮')
assert.ok(!styleDetailSource.includes('复制为新版本'), '款式档案页不应再渲染复制为新版本按钮')
assert.ok(styleDetailSource.includes('启用为当前生效版本'), '款式档案页必须提供启用为当前生效版本按钮')

assert.ok(!projectDetailSource.includes('新建技术包版本'), '项目详情页不应再渲染新建技术包版本按钮')
assert.ok(!projectNodeSource.includes('新建技术包版本'), '项目节点详情页不应再渲染新建技术包版本按钮')
assert.ok(projectDetailSource.includes('当前生效版本编号'), '项目详情页必须展示当前生效版本字段')
assert.ok(projectNodeSource.includes('当前生效版本编号'), '项目节点详情页必须展示当前生效版本字段')

assert.ok(techPackCoreSource.includes('发布后不会自动启用为当前生效版本'), '技术包版本页必须明确发布与启用分离')
assert.ok(!publishSection.includes('activateTechPackVersionForStyle'), '发布逻辑不应直接启用当前生效版本')
assert.ok(!publishSection.includes('currentTechPackVersionId'), '发布逻辑不应直接写款式档案当前生效版本字段')
assert.ok(!publishSection.includes('syncProjectTransferPrepNodeFromTechPackVersion('), '发布逻辑不应自动回写项目节点启用结果')
assert.ok(activationSource.includes('activateTechPackVersionForStyle'), '必须存在正式启用当前生效版本服务')

console.log('check-pcs-style-tech-pack-responsibility.ts PASS')

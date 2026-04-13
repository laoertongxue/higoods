import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  generateTechPackVersionFromPlateTask,
  publishTechnicalDataVersion,
} from '../src/data/pcs-project-technical-data-writeback.ts'
import { renderTechPackPage } from '../src/pages/tech-pack.ts'
import {
  fillCoreTechPackContent,
  prepareTechPackTaskScenario,
} from './pcs-tech-pack-test-helper.ts'

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const contextSource = read('src/pages/tech-pack/context.ts')
assert.ok(!contextSource.includes('getOrCreateTechPack'), '技术包页面上下文不应再依赖旧 FCS 技术包对象作为正式主来源')
assert.ok(!contextSource.includes('updateTechPack('), '技术包页面上下文不应再直接更新旧 FCS 技术包对象')

const pageSource = read('src/pages/tech-pack/core.ts')
assert.ok(pageSource.includes('技术包版本 -'), '技术包页面主标题应统一为技术包版本')

const scenario = prepareTechPackTaskScenario()
const created = generateTechPackVersionFromPlateTask(scenario.plateTaskId, '测试用户')
fillCoreTechPackContent(created.record.technicalVersionId, scenario.styleCode)
const published = publishTechnicalDataVersion(created.record.technicalVersionId, '测试用户')

const html = renderTechPackPage(scenario.styleCode, {
  styleId: scenario.styleId,
  technicalVersionId: published.technicalVersionId,
})
assert.ok(html.includes(`技术包版本 - ${published.technicalVersionCode}`), '正式技术包页面应展示正式版本编号')
assert.ok(html.includes('质检标准'), '正式技术包页面应包含质检标准页签')
assert.ok(!html.includes('技术资料版本 -'), '正式技术包页面不应继续使用旧口径主标题')

console.log('pcs-tech-pack-page-real-source.spec.ts PASS')

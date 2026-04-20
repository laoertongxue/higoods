import assert from 'node:assert/strict'
import { listTechnicalDataVersions, resetTechnicalDataVersionRepository } from '../src/data/pcs-technical-data-version-repository.ts'
import { renderTechPackPage } from '../src/pages/tech-pack/core.ts'

resetTechnicalDataVersionRepository()

const version = listTechnicalDataVersions()[0]
assert.ok(version, '应存在技术包版本数据')

const html = renderTechPackPage(version.styleCode, {
  styleId: version.styleId,
  technicalVersionId: version.technicalVersionId,
})

assert.doesNotMatch(html, /技术包状态口径|业务场景|当前可操作项|兼容说明|本页用于|该模块用于/, '技术包页面不应再出现说明型文案')
assert.match(html, /技术包版本 - /, '技术包页面应保留版本标题')
assert.match(html, /技术包版本日志/, '技术包页面应保留版本日志')
assert.match(html, /纸样管理|物料清单|工序工艺/, '技术包页面应保留核心内容页签')

console.log('pcs-page-slimming-tech-pack.spec.ts PASS')

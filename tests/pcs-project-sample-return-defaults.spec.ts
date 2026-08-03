import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pageSource = readFileSync(new URL('../src/pages/pcs-projects.ts', import.meta.url), 'utf8')
const sampleReturnDefaultsSource = pageSource.slice(
  pageSource.indexOf('function buildSampleReturnHandleDraftDefaults'),
  pageSource.indexOf('function normalizeDraftFieldValue'),
)

assert.doesNotMatch(
  sampleReturnDefaultsSource,
  /project\.templateId|DOMESTIC_PURCHASE_SAMPLE_TEMPLATE_ID|WANLONG_REVISION_SAMPLE_TEMPLATE_ID/,
  '样衣退回默认值不得依赖历史模板 ID',
)

const { resolveSampleReturnDestination } = await import(
  '../src/data/pcs-project-sample-return-defaults.ts'
)

assert.equal(resolveSampleReturnDestination('退回供应商', '委托打样'), '退回供应商')
assert.equal(resolveSampleReturnDestination('', '外采'), '退回供应商')
assert.equal(resolveSampleReturnDestination('', '委托打样'), '退回版房')
assert.equal(resolveSampleReturnDestination('', ''), '样衣库存留样')

console.log('pcs-project-sample-return-defaults.spec.ts PASS')

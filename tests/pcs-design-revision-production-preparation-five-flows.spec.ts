import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * The 2026-09-23 design-revision contract replaced the old temporary-SPU,
 * online artwork/color-design and professional rework scenarios. Keep this
 * named entry point for callers that run the five-flow gate, with five
 * independently executable current-business scenarios instead.
 */
const scenarios = [
  {
    id: 'FLOW-01',
    name: '已建档目标款、复用纸样、无印染、样衣提交即完成并归档',
    file: 'tests/unit/pcs-design-revision-current-flow.test.ts',
    pattern: '复用既有纸样与参照 BOM 的无印染任务可直接提交样衣',
  },
  {
    id: 'FLOW-02',
    name: '仅染或仅印各生成一单及唯一仓库首道调拨计划',
    file: 'tests/unit/fcs-design-revision-result-readiness.test.ts',
    pattern: '仅染与仅印分别创建一张加工单',
  },
  {
    id: 'FLOW-03',
    name: '同一 BOM 中面料 Yard 与辅料 PCS 独立计量',
    file: 'tests/unit/pcs-design-revision-current-flow.test.ts',
    pattern: '一张设计改款 BOM 同时有 Yard 面料和 PCS 辅料',
  },
  {
    id: 'FLOW-04',
    name: '先染后印同批实物交接、中央工厂接收、样衣完成与归档',
    file: 'tests/unit/fcs-design-revision-result-readiness.test.ts',
    pattern: '同一 BOM 行真实染色交出后由印花厂按卷实收',
  },
  {
    id: 'FLOW-05',
    name: '仅印实物交中央工厂，未接单不得开工',
    file: 'tests/unit/fcs-design-revision-result-readiness.test.ts',
    pattern: '印花实际交出生成中央工厂待接收原单',
  },
] as const

const recordPath = process.env.PCS_FIVE_FLOW_RECORD_PATH?.trim()
  || '/tmp/pcs-design-revision-production-preparation-five-flows.json'
const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim()
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const records = scenarios.map((scenario) => {
  const run = spawnSync(process.execPath, [
    '--experimental-strip-types', '--test',
    `--test-name-pattern=${scenario.pattern}`, scenario.file,
  ], { encoding: 'utf8', timeout: 120_000 })
  const output = `${run.stdout || ''}\n${run.stderr || ''}`
  const pass = run.status === 0 && /[ℹ#]\s*pass 1(?:\s|$)/m.test(output)
    && /[ℹ#]\s*fail 0(?:\s|$)/m.test(output)
  console.log(`${scenario.id} ${pass ? 'PASS' : 'FAIL'} ${scenario.name}`)
  if (!pass) console.error(output.slice(-3500))
  return {
    id: scenario.id, name: scenario.name, result: pass ? '通过' : '失败',
    testFile: scenario.file, testNamePattern: scenario.pattern,
    exitCode: run.status, signal: run.signal, error: run.error?.message || '',
    outputTail: pass ? '' : output.slice(-3500),
  }
})
mkdirSync(dirname(recordPath), { recursive: true })
writeFileSync(recordPath, JSON.stringify({
  title: 'PCS 设计改款当前业务五场景专项测试记录',
  branch, head, executedAt: new Date().toISOString(),
  overallResult: records.every((record) => record.result === '通过') ? '通过' : '失败',
  scenarioCount: records.length, records,
}, null, 2))
assert.equal(records.length, 5)
assert.ok(records.every((record) => record.result === '通过'), '设计改款当前业务五场景存在失败')
console.log(`pcs-design-revision-production-preparation-five-flows.spec PASS (${records.length}/5)`)
console.log(`record: ${recordPath}`)

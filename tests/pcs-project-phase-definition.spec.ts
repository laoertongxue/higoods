import assert from 'node:assert/strict'
import {
  PCS_PROJECT_PHASE_DEFINITIONS,
  resolveProjectPhaseCodeFromLegacyName,
} from '../src/data/pcs-project-phase-definitions.ts'

assert.equal(PCS_PROJECT_PHASE_DEFINITIONS.length, 5, '商品项目正式阶段目录应固定为 5 个')
assert.deepEqual(
  PCS_PROJECT_PHASE_DEFINITIONS.map((item) => item.phaseCode),
  ['PHASE_01', 'PHASE_02', 'PHASE_03', 'PHASE_04', 'PHASE_05'],
  '正式阶段编码顺序应固定',
)
assert.deepEqual(
  PCS_PROJECT_PHASE_DEFINITIONS.map((item) => item.phaseName),
  ['立项获取', '样衣与评估', '市场测款', '开发推进', '项目收尾'],
  '正式阶段名称应固定',
)
assert.ok(
  PCS_PROJECT_PHASE_DEFINITIONS.every((item) => !['已归档', '已终止'].includes(item.phaseName)),
  '阶段目录中不应混入项目状态型文案',
)

assert.equal(resolveProjectPhaseCodeFromLegacyName('立项阶段'), 'PHASE_01')
assert.equal(resolveProjectPhaseCodeFromLegacyName('评估定价'), 'PHASE_02')
assert.equal(resolveProjectPhaseCodeFromLegacyName('测款阶段'), 'PHASE_03')
assert.equal(resolveProjectPhaseCodeFromLegacyName('结论与推进'), 'PHASE_04')
assert.equal(resolveProjectPhaseCodeFromLegacyName('资产处置'), 'PHASE_05')

console.log('pcs-project-phase-definition.spec.ts PASS')

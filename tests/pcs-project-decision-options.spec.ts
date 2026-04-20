import assert from 'node:assert/strict'
import fs from 'node:fs'

import { getProjectWorkItemContract } from '../src/data/pcs-project-domain-contract.ts'

for (const code of ['FEASIBILITY_REVIEW', 'SAMPLE_CONFIRM', 'TEST_CONCLUSION'] as const) {
  const contract = getProjectWorkItemContract(code)
  const decisionField = contract.fieldDefinitions.find((field) =>
    ['reviewConclusion', 'confirmResult', 'conclusion'].includes(field.fieldKey),
  )
  assert.ok(decisionField, `${code} 应存在决策字段`)
  assert.deepEqual(
    (decisionField?.options || []).map((item) => item.value),
    ['通过', '淘汰'],
    `${code} 决策选项只允许通过和淘汰`,
  )
  assert.equal(decisionField?.required, true, `${code} 决策字段必须必填`)
}

const pageSource = fs.readFileSync(new URL('../src/pages/pcs-projects.ts', import.meta.url), 'utf8')
assert.ok(pageSource.includes('通过'))
assert.ok(pageSource.includes('淘汰'))
for (const legacyValue of ['调整', '暂缓', '继续调整', '改版后重测', '继续开发']) {
  assert.ok(!pageSource.includes(`>${legacyValue}<`), `页面不应渲染旧决策选项 ${legacyValue}`)
}

console.log('pcs-project-decision-options.spec.ts PASS')

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getProjectWorkItemContract } from '../src/data/pcs-project-domain-contract.ts'

const root = fileURLToPath(new URL('..', import.meta.url))

function read(filePath: string): string {
  return fs.readFileSync(path.join(root, filePath), 'utf8')
}

function assertCheck(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`检查失败：${message}`)
    process.exitCode = 1
  }
}

const projectPageSource = read('src/pages/pcs-projects.ts')
const channelRepoSource = read('src/data/pcs-channel-product-project-repository.ts')
const decisionFlowSource = read('src/data/pcs-project-decision-flow-service.ts')
const migrationSource = read('src/data/pcs-project-decision-migration.ts')
const flowServiceSource = read('src/data/pcs-project-flow-service.ts')

for (const workItemCode of ['FEASIBILITY_REVIEW', 'SAMPLE_CONFIRM', 'TEST_CONCLUSION']) {
  const contract = getProjectWorkItemContract(workItemCode)
  assertCheck(Boolean(contract), `工作项定义仍需包含 ${workItemCode}`)
  const decisionField = contract.fieldDefinitions.find((field) =>
    ['reviewConclusion', 'confirmResult', 'conclusion'].includes(field.fieldKey),
  )
  assertCheck(Boolean(decisionField), `${workItemCode} 必须存在决策字段`)
  assertCheck(
    JSON.stringify((decisionField?.options || []).map((item) => item.value)) === JSON.stringify(['通过', '淘汰']),
    `${workItemCode} 决策结果只允许通过 / 淘汰`,
  )
  assertCheck(decisionField?.required === true, `${workItemCode} 决策字段必须必填`)
}

for (const legacyOption of ['>调整<', '>暂缓<', '>继续调整<', '>改版后重测<', '>继续开发<', '>终止<']) {
  assertCheck(!projectPageSource.includes(legacyOption), `页面中不应再渲染旧决策选项 ${legacyOption}`)
}

for (const legacyBranchFn of ['activateTestingAdjustBranchNodes', 'applyTestConclusionBranch']) {
  assertCheck(!channelRepoSource.includes(legacyBranchFn) && !flowServiceSource.includes(legacyBranchFn), `数据层不应再保留旧分支函数 ${legacyBranchFn}`)
}

assertCheck(!/测款结论.*改版任务/.test(channelRepoSource), '测款结论不应再自动触发改版任务文案或逻辑')
const conclusionContract = getProjectWorkItemContract('TEST_CONCLUSION')
assertCheck(
  !conclusionContract.fieldDefinitions.some((field) => ['revisionTaskId', 'revisionTaskCode', 'projectTerminated', 'projectTerminatedAt'].includes(field.fieldKey)),
  '测款结论字段定义不应再包含旧分支字段',
)

assertCheck(decisionFlowSource.includes('completeDecisionNodeWithResult'), '统一决策流转服务必须存在 completeDecisionNodeWithResult')
assertCheck(decisionFlowSource.includes('routeProjectToSampleReturnHandle'), '统一决策流转服务必须存在 routeProjectToSampleReturnHandle')
assertCheck(decisionFlowSource.includes('SAMPLE_RETURN_HANDLE'), '淘汰流转必须进入样衣退回处理')

assertCheck(!/projectStatus:\s*'已终止'/.test(decisionFlowSource), '决策流转服务不应在淘汰时直接把项目写为已终止')
assertCheck(migrationSource.includes('LEGACY_DECISION_RESULTS'), '旧决策迁移函数必须存在')
assertCheck(read('src/data/pcs-project-repository.ts').includes('migrateProjectDecisionSnapshot'), '项目仓储必须调用旧决策迁移函数')

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode)
}

console.log('check-pcs-project-decision-flow.ts PASS')

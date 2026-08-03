import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getProjectStepDefinition } from '../src/data/pcs-project-domain-contract.ts'

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
const flowServiceSource = read('src/data/pcs-project-flow-service.ts')

for (const stepDefinitionCode of ['FEASIBILITY_REVIEW', 'SAMPLE_CONFIRM', 'TEST_CONCLUSION']) {
  const contract = getProjectStepDefinition(stepDefinitionCode)
  assertCheck(Boolean(contract), `项目步骤定义仍需包含 ${stepDefinitionCode}`)
  const decisionField = contract.fieldDefinitions.find((field) =>
    ['reviewConclusion', 'confirmResult', 'conclusion'].includes(field.fieldKey),
  )
  assertCheck(Boolean(decisionField), `${stepDefinitionCode} 必须存在决策字段`)
  const expectedOptions =
    stepDefinitionCode === 'TEST_CONCLUSION'
      ? ['通过', '不通过', '暂保留']
      : stepDefinitionCode === 'FEASIBILITY_REVIEW'
        ? ['进入测款', '样衣退回']
        : ['通过', '不通过']
  assertCheck(
    JSON.stringify((decisionField?.options || []).map((item) => item.value)) === JSON.stringify(expectedOptions),
    `${stepDefinitionCode} 决策结果应为 ${expectedOptions.join(' / ')}`,
  )
  assertCheck(decisionField?.required === true, `${stepDefinitionCode} 决策字段必须必填`)
}

for (const legacyOption of ['>调整<', '>暂缓<', '>继续调整<', '>改版后重测<', '>继续开发<', '>终止<']) {
  assertCheck(!projectPageSource.includes(legacyOption), `页面中不应再渲染旧决策选项 ${legacyOption}`)
}

for (const legacyBranchFn of ['activateTestingAdjustBranchNodes', 'applyTestConclusionBranch']) {
  assertCheck(!channelRepoSource.includes(legacyBranchFn) && !flowServiceSource.includes(legacyBranchFn), `数据层不应再保留旧分支函数 ${legacyBranchFn}`)
}

assertCheck(!/测款结论.*改版任务/.test(channelRepoSource), '测款结论不应再自动触发改版任务文案或逻辑')
const conclusionContract = getProjectStepDefinition('TEST_CONCLUSION')
assertCheck(
  !conclusionContract.fieldDefinitions.some((field) => ['revisionTaskId', 'revisionTaskCode', 'projectTerminated', 'projectTerminatedAt'].includes(field.fieldKey)),
  '测款结论字段定义不应再包含旧分支字段',
)

assertCheck(decisionFlowSource.includes('completeDecisionNodeWithResult'), '统一决策流转服务必须存在 completeDecisionNodeWithResult')
assertCheck(decisionFlowSource.includes('routeProjectToSampleReturnHandle'), '统一决策流转服务必须存在 routeProjectToSampleReturnHandle')
assertCheck(decisionFlowSource.includes('SAMPLE_RETURN_HANDLE'), '不通过流转必须进入样衣退回处理')
assertCheck(decisionFlowSource.includes('holdProjectDecisionForLater'), '暂保留必须保留当前事实并等待稍后再判断')
assertCheck(!decisionFlowSource.includes('routeProjectToAdditionalTesting'), '暂保留不得回到测款执行或重启测试节点')
assertCheck(!decisionFlowSource.includes('routeProjectToRevisionTask'), '商品测款可行性判断不得创建或查找改版任务')
assertCheck(!decisionFlowSource.includes('重新改版出样衣'), '商品测款可行性判断不得包含重新改版出样衣分支')

assertCheck(!/projectStatus:\s*'已终止'/.test(decisionFlowSource), '决策流转服务不应在不通过时直接把项目写为已终止')
assertCheck(!fs.existsSync(path.join(root, 'src/data/pcs-project-decision-migration.ts')), '旧决策迁移模块必须删除')
assertCheck(!read('src/data/pcs-project-repository.ts').includes('migrateProjectDecision'), '项目仓储不得再调用旧决策迁移')
assertCheck(!read('src/data/pcs-project-inline-node-record-repository.ts').includes('migrateProjectDecision'), '项目节点记录仓储不得再调用旧决策迁移')

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode)
}

console.log('check-pcs-project-decision-flow.ts PASS')

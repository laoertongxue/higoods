import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  PPIC_TEAM_LEADER_JIEGE,
  PPIC_TEAM_LEADER_LINGYUN,
} from '../src/data/fcs/factory-onboarding-ppic.ts'
import {
  loadPostFinishingDemoData,
  resetPostFinishingFullFlow,
} from '../src/data/fcs/post-finishing-full-flow.ts'
import { ensureSewingCutPieceResponsibilityOverviewDemos } from '../src/data/fcs/sewing-cut-piece-responsibility.ts'
import {
  listSewingOutsourcingWorkbenchPpicOptions,
  listSewingOutsourcingWorkbenchRows,
  type SewingOutsourcingNextResponsibleParty,
  type SewingOutsourcingTaskHealth,
} from '../src/data/fcs/sewing-outsourcing-workbench.ts'
import {
  renderSewingOutsourcingTeamWorkbenchPage,
  renderSewingOutsourcingWorkbenchPage,
} from '../src/pages/sewing-outsourcing/workbench.ts'

const leaderRows = listSewingOutsourcingWorkbenchRows({
  viewerPpicId: PPIC_TEAM_LEADER_LINGYUN.ppicId,
  leaderView: true,
})
assert.ok(leaderRows.length >= 7, '团队汇总至少覆盖七条不同阶段的执行任务')
assert.equal(new Set(leaderRows.map((row) => row.rowId)).size, leaderRows.length)

const expectedHealth: SewingOutsourcingTaskHealth[] = ['ABNORMAL', 'ATTENTION', 'NORMAL', 'DATA_INCOMPLETE']
expectedHealth.forEach((health) => assert.ok(leaderRows.some((row) => row.health === health), `汇总来源缺少${health}场景`))
const expectedParties: SewingOutsourcingNextResponsibleParty[] = ['PPIC', 'CUTTING', 'SEWING_FACTORY', 'SAMPLE_APPROVER', 'POST_FINISHING']
expectedParties.forEach((party) => assert.ok(leaderRows.some((row) => row.nextResponsibleParty === party), `汇总来源缺少${party}责任场景`))
assert.ok(leaderRows.every((row) => row.timeline.length > 0))
assert.ok(leaderRows.every((row) => row.styleImageUrl && row.styleImageAlt))

const ppicOptions = listSewingOutsourcingWorkbenchPpicOptions()
const chenlin = ppicOptions.find((option) => option.ppicName === '陈琳')
assert.ok(chenlin, '演示任务必须能定位到当前PPIC陈琳')
const personalRows = listSewingOutsourcingWorkbenchRows({ viewerPpicId: chenlin!.ppicId })
assert.ok(personalRows.length > 0 && personalRows.length < leaderRows.length)
assert.ok(personalRows.every((row) => row.ppicId === chenlin!.ppicId))
for (const manager of [PPIC_TEAM_LEADER_LINGYUN, PPIC_TEAM_LEADER_JIEGE]) {
  const selectedRows = listSewingOutsourcingWorkbenchRows({ viewerPpicId: manager.ppicId, leaderView: true, selectedPpicId: chenlin!.ppicId })
  assert.deepEqual(selectedRows.map((row) => row.rowId), personalRows.map((row) => row.rowId), `${manager.ppicName}应能查看同一成员汇总`)
}
assert.throws(() => listSewingOutsourcingWorkbenchRows({ viewerPpicId: chenlin!.ppicId, leaderView: true }), /团队负责人/)

const handoverStates = ensureSewingCutPieceResponsibilityOverviewDemos()
assert.ok(handoverStates.some((item) => item.totalHandedOverPieceQty === 0), '工作台必须有未交出来源')
assert.ok(handoverStates.some((item) => item.totalHandedOverPieceQty > 0 && item.totalDebtPieceQty === 0), '工作台必须有已交出不欠片来源')
assert.ok(handoverStates.some((item) => item.totalHandedOverPieceQty > 0 && item.totalDebtPieceQty > 0), '工作台必须有已交出且欠片来源')

const page = readFileSync('src/pages/sewing-outsourcing/workbench.ts', 'utf8')
const workbenchDomain = readFileSync('src/data/fcs/sewing-outsourcing-workbench.ts', 'utf8')
const personalHtml = renderSewingOutsourcingWorkbenchPage()
const leaderHtml = renderSewingOutsourcingTeamWorkbenchPage()
for (const text of [
  '车缝任务还未交出',
  '已交出且仍欠片',
  '产前版样衣待批版闭环',
  '回货节点临近或未达成',
  '尚未完成的车缝任务',
  '下一步需要跟进谁',
]) assert.ok(personalHtml.includes(text), `我的工作台缺少汇总入口：${text}`)
assert.ok(personalHtml.includes('当前登录：陈琳（PPIC）'))
assert.ok(!personalHtml.includes('管理人员<select') && !personalHtml.includes('整个PPIC团队'))
assert.ok(!personalHtml.includes('<table') && !personalHtml.includes('车缝外发执行任务主清单'), '工作台不得渲染任务列表')
assert.ok(leaderHtml.includes('PPIC管理人员') && leaderHtml.includes('凌云') && leaderHtml.includes('婕哥'))
assert.ok(leaderHtml.includes('整个PPIC团队') && !leaderHtml.includes('<table'))
assert.ok(personalHtml.includes('data-workbench-summary="UNHANDED"'))
assert.ok(page.includes('/fcs/sewing-outsourcing/tasks?status=UNFINISHED'))
assert.ok(!page.includes('renderStandardListTable') && !page.includes('renderTablePagination'))
assert.ok(workbenchDomain.includes('halfOrMoreMissingLineCount > 0'))
assert.doesNotMatch(workbenchDomain, /totalDebtPieceQty\s*>=\s*\d+/)

// 先打开后道待加工仓会装载 3×5×5 回货事实；随后进入PPIC工作台只能读取，不能用PPIC演示数量覆盖并触发确认门禁。
resetPostFinishingFullFlow()
loadPostFinishingDemoData()
assert.doesNotThrow(() => listSewingOutsourcingWorkbenchRows({ viewerPpicId: chenlin!.ppicId }))

console.log('check-sewing-outsourcing-workbench: ok')

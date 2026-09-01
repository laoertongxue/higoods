import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

import { menusBySystem } from '../src/data/app-shell-config.ts'
import {
  FACTORY_ONBOARDING_PPIC_OPTIONS,
  PPIC_TEAM_LEADER_LINGYUN,
} from '../src/data/fcs/factory-onboarding-ppic.ts'
import { listSewingOutsourcingWorkbenchRows } from '../src/data/fcs/sewing-outsourcing-workbench.ts'
import { renderSampleApprovalSuggestionsPage } from '../src/pages/sewing-outsourcing/sample-approval-suggestions.ts'
import { renderSewingCutPieceHandoverPage } from '../src/pages/sewing-outsourcing/cut-piece-handover.ts'
import { renderSewingOutsourcingCutPieceReturnsPage } from '../src/pages/sewing-outsourcing/cut-piece-returns.ts'
import { renderSewingOutsourcingResponsibilityTransfersPage } from '../src/pages/sewing-outsourcing/responsibility-transfers.ts'
import { renderSewingOutsourcingTasksPage } from '../src/pages/sewing-outsourcing/tasks.ts'
import {
  renderSewingOutsourcingTeamWorkbenchPage,
  renderSewingOutsourcingWorkbenchPage,
} from '../src/pages/sewing-outsourcing/workbench.ts'

const group = menusBySystem.fcs.find((item) => item.title === '车缝外发协同')
assert.ok(group, 'FCS必须保留“车缝外发协同”一级菜单')
const expectedMenu = [
  ['我的工作台', '/fcs/sewing-outsourcing/workbench'],
  ['车缝任务', '/fcs/sewing-outsourcing/tasks'],
  ['交出与欠片', '/fcs/sewing-outsourcing/cut-piece-handover'],
  ['批版建议', '/fcs/sewing-outsourcing/sample-approval-suggestions'],
  ['回货跟进', '/fcs/sewing-outsourcing/returns'],
  ['补料跟进', '/fcs/sewing-outsourcing/supplements'],
  ['裁片退仓', '/fcs/sewing-outsourcing/cut-piece-returns'],
  ['责任移交', '/fcs/sewing-outsourcing/responsibility-transfers'],
]
assert.deepEqual(group!.items.map((item) => [item.title, item.href]), expectedMenu, '一级菜单必须严格保留八个当前入口')
assert.ok(!group!.items.some((item) => item.title === 'PPIC管理'), '一级菜单不能命名为PPIC管理')
assert.ok(!group!.items.some((item) => item.title === '综合查询'), '独立综合查询菜单必须删除')
assert.ok(!group!.items.some((item) => item.title === '对数与结算跟进'), '对数与结算跟进必须完整删除')
assert.equal(group!.items.find((item) => item.title === '补料跟进')?.icon, 'PackagePlus')
assert.equal(group!.items.find((item) => item.title === '责任移交')?.icon, 'UserRoundCog')

const managers = FACTORY_ONBOARDING_PPIC_OPTIONS.filter((item) => item.role === 'TEAM_LEADER' && item.status === '启用')
assert.deepEqual(managers.map((item) => item.ppicName).sort(), ['凌云', '婕哥'].sort(), '当前PPIC管理人员必须且至少覆盖婕哥和凌云')

const taskKinds = new Set(listSewingOutsourcingWorkbenchRows({
  viewerPpicId: PPIC_TEAM_LEADER_LINGYUN.ppicId,
  leaderView: true,
}).map((row) => row.taskKind))
assert.ok(taskKinds.has('INDEPENDENT_SEWING'))
assert.ok(taskKinds.has('SEWING_IRON_PACK'))
assert.ok(taskKinds.has('CUTTING_SEWING_IRON_PACK'))

const routes = readFileSync('src/router/routes-fcs.ts', 'utf8')
const renderers = readFileSync('src/router/route-renderers-fcs.ts', 'utf8')
const handlers = readFileSync('src/main-handlers/fcs-handlers.ts', 'utf8')
for (const [, href] of expectedMenu) assert.ok(routes.includes(`'${href}'`), `菜单路由未注册：${href}`)
assert.ok(routes.includes("'/fcs/sewing-outsourcing/team-workbench'"), '管理人员团队工作台必须使用独立权限路由')
for (const page of ['tasks', 'responsibility-transfers']) assert.ok(renderers.includes(`import('../pages/sewing-outsourcing/${page}')`))
for (const href of ['/fcs/sewing-outsourcing/tasks', '/fcs/sewing-outsourcing/responsibility-transfers']) assert.ok(handlers.includes(`pathname.startsWith('${href}')`))
for (const source of [routes, renderers, handlers]) {
  assert.ok(!source.includes('sewing-outsourcing/query'), '综合查询必须删除')
  assert.ok(!source.includes('sewing-outsourcing/settlement'), 'PPIC结算入口必须删除')
}
assert.ok(!existsSync('src/pages/sewing-outsourcing/query.ts'))
assert.ok(!existsSync('src/data/fcs/sewing-outsourcing-query.ts'))
assert.ok(!existsSync('src/pages/sewing-outsourcing/settlement.ts'))
assert.ok(!existsSync('src/data/fcs/sewing-outsourcing-settlement-readiness.ts'))
assert.ok(!existsSync('scripts/check-sewing-outsourcing-settlement-readiness.ts'))

const taskHtml = renderSewingOutsourcingTasksPage()
const personalWorkbenchHtml = renderSewingOutsourcingWorkbenchPage()
const managerWorkbenchHtml = renderSewingOutsourcingTeamWorkbenchPage()
const handoverHtml = renderSewingCutPieceHandoverPage()
const sampleHtml = renderSampleApprovalSuggestionsPage()
const returnHtml = renderSewingOutsourcingCutPieceReturnsPage()
const returnSource = readFileSync('src/pages/sewing-outsourcing/cut-piece-returns.ts', 'utf8')
const transferHtml = renderSewingOutsourcingResponsibilityTransfersPage()
assert.ok(!taskHtml.includes('>专业来源<'))
assert.ok(taskHtml.includes('批版建议') && taskHtml.includes('全链详情'))
assert.ok(personalWorkbenchHtml.includes('我的工作台') && personalWorkbenchHtml.includes('车缝任务还未交出'))
assert.ok(!personalWorkbenchHtml.includes('<table') && !personalWorkbenchHtml.includes('任务时间线'), '我的工作台不得再渲染车缝任务列表')
assert.ok(managerWorkbenchHtml.includes('婕哥') && managerWorkbenchHtml.includes('凌云') && managerWorkbenchHtml.includes('整个PPIC团队'))
for (const label of ['未交出', '已交出不欠片', '已交出且欠片']) assert.ok(handoverHtml.includes(label), `交出与欠片缺少${label}Tab`)
assert.ok(sampleHtml.includes('data-sample-approval-action="receive-sample"'))
assert.ok(returnHtml.includes('data-ppic-return-action="create"') && returnSource.includes('操作角色：任务PPIC'))
assert.ok(returnHtml.includes('待仓库接收') && returnHtml.includes('接收异常') && returnHtml.includes('已入仓'))
assert.ok(transferHtml.includes('团队负责人'))

console.log('check-sewing-outsourcing-information-architecture: ok')

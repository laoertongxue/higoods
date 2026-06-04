import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  completeFeiTicketNumbering,
  FEI_TICKET_NUMBERING_BLOCK_MESSAGE,
  filterFeiTicketNumberingRecords,
  getFeiTicketNumberingDemoCases,
  getFeiTicketNumberingStatus,
  isBindingStripFeiTicketNo,
  listFeiTicketNumberingRecords,
  resolveFeiTicketNumberingScan,
  summarizeFeiTicketNumberingByOperator,
  validateFeiTicketNumberingBeforeBagging,
} from '../src/data/fcs/cutting/fei-ticket-numbering.ts'

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

function assertContains(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotContains(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

const cases = getFeiTicketNumberingDemoCases()

assert(cases.completedTicket, '缺少已完成打编号的普通菲票 mock')
assert(cases.pendingTicket, '缺少未完成打编号的普通菲票 mock')
assert(cases.missingRangeTicket, '缺少缺编号区间的普通菲票 mock')
assert(isBindingStripFeiTicketNo(cases.bindingStripFeiTicketNo), '缺少捆条菲票免打编号样例')

const completedScan = resolveFeiTicketNumberingScan(cases.completedTicket!.feiTicketNo)
assert.equal(completedScan.status, '已完成', '已完成普通菲票扫描状态错误')
assert(completedScan.record?.operatorName, '已完成普通菲票缺少操作员工')
assert(completedScan.numberCount > 0, '已完成普通菲票编号数量必须大于 0')

const pendingScan = resolveFeiTicketNumberingScan(cases.pendingTicket!.feiTicketNo)
assert.equal(pendingScan.status, '未打编号', '未完成普通菲票扫描状态错误')
assert.equal(validateFeiTicketNumberingBeforeBagging(cases.pendingTicket).ok, false, '未完成普通菲票不应允许装袋')
assert.equal(
  validateFeiTicketNumberingBeforeBagging(cases.pendingTicket).reason,
  FEI_TICKET_NUMBERING_BLOCK_MESSAGE,
  '未完成普通菲票拦截提示不一致',
)

const completeResult = completeFeiTicketNumbering({
  feiTicketNoOrId: cases.pendingTicket!.feiTicketNo,
  operatorId: 'CUT-NUM-OP-CHECK',
  operatorName: '校验员工',
  completedAt: '2026-06-05 14:30',
  source: 'WEB',
})
assert.equal(completeResult.status, '已完成', '完成打编号后状态应为已完成')
assert.equal(validateFeiTicketNumberingBeforeBagging(cases.pendingTicket).ok, true, '已完成普通菲票应允许装袋')
assert.equal(getFeiTicketNumberingStatus(cases.pendingTicket), '已完成', '完成后状态 helper 未更新')

const missingScan = resolveFeiTicketNumberingScan(cases.missingRangeTicket!.feiTicketNo)
assert.equal(missingScan.status, '缺少编号区间', '缺编号区间菲票状态错误')
assert.equal(missingScan.ok, false, '缺编号区间菲票不能完成打编号')

const bindingScan = resolveFeiTicketNumberingScan(cases.bindingStripFeiTicketNo)
assert.equal(bindingScan.status, '免打编号', '捆条菲票必须免打编号')
assert.equal(validateFeiTicketNumberingBeforeBagging({ feiTicketNo: cases.bindingStripFeiTicketNo }).ok, true, '捆条菲票不应被打编号拦截')

const records = listFeiTicketNumberingRecords()
assert(records.length >= 3, '打编号记录不足，不能支撑计件展示')
assert(records.every((record) => record.numberCount > 0), '所有普通打编号记录都必须有编号数量')
assert(records.some((record) => record.operatorName === '校验员工'), '完成动作没有落员工记录')
assert(filterFeiTicketNumberingRecords({ status: '已完成' }).length >= 3, '状态筛选为已完成时必须返回计件记录')
assert.equal(filterFeiTicketNumberingRecords({ status: '未打编号' }).length, 0, '计件记录汇总不应混入未打编号状态')

const summaries = summarizeFeiTicketNumberingByOperator(records)
assert(summaries.some((item) => item.operatorName === '校验员工' && item.ticketCount >= 1 && item.numberCount > 0), '员工计件汇总缺少校验员工')

const dataSource = read('src/data/fcs/cutting/fei-ticket-numbering.ts')
const webRouteSource = read('src/router/routes-fcs.ts')
const pdaRouteSource = read('src/router/routes-pda.ts')
const menuSource = read('src/data/app-shell-config.ts')
const pdaWarehouseSource = read('src/pages/pda-warehouse.ts')
const pdaWaitHandoverSource = read('src/pages/pda-warehouse-wait-handover.ts')
const pdaInboundSource = read('src/pages/pda-cutting-inbound.ts')
const pdaHandoverSource = read('src/pages/pda-cutting-handover.ts')
const waitHandoverSource = read('src/pages/process-factory/cutting/warehouse-hub.ts')
const transferBagsSource = read('src/pages/process-factory/cutting/transfer-bags-model.ts')
const pageEventSource = read('src/main-handlers/fcs-handlers.ts')
const feiTicketsPageSource = read('src/pages/process-factory/cutting/fei-tickets.ts')
const webNumberingPageSource = read('src/pages/process-factory/cutting/fei-ticket-numbering.ts')
const pdaNumberingPageSource = read('src/pages/pda-cutting-fei-ticket-numbering.ts')

assertContains(dataSource, 'FEI_TICKET_NUMBERING_BLOCK_MESSAGE', '数据模块缺少统一拦截提示')
assertContains(dataSource, 'summarizeFeiTicketNumberingByOperator', '数据模块缺少员工计件汇总')
assertContains(menuSource, '菲票打编号', '裁后处理菜单缺少菲票打编号')
assertContains(webRouteSource, '/fcs/craft/cutting/fei-ticket-numbering', 'Web 缺少菲票打编号路由')
assertContains(webRouteSource, '/fcs/craft/cutting/fei-ticket-numbering/summary', 'Web 缺少员工计件汇总新窗口路由')
assertContains(pdaRouteSource, '/fcs/pda/cutting/fei-ticket-numbering', 'PDA 缺少菲票打编号路由')
assertContains(pdaWarehouseSource, '菲票打编号', '裁床厂 PDA 仓管首页缺少菲票打编号入口')
assertContains(pdaWaitHandoverSource, 'numbering', 'PDA 待交出仓动作缺少打编号入口')
assertContains(pdaInboundSource, 'validateFeiTicketNumberingBeforeBagging', 'PDA 入仓暂存未接入打编号校验')
assertContains(pdaHandoverSource, 'validateFeiTicketNumberingBeforeBagging', 'PDA 交出装袋未接入打编号校验')
assertContains(waitHandoverSource, 'validateFeiTicketNumberingBeforeBagging', 'Web 待交出仓未接入打编号校验')
assertContains(transferBagsSource, 'validateFeiTicketNumberingBeforeBagging', '中转袋装袋未接入打编号校验')
assertContains(pageEventSource, 'handleCraftCuttingFeiTicketNumberingEvent', 'Web 打编号页面事件未接入')
assertContains(feiTicketsPageSource, '打编号状态', '菲票打印详情缺少打编号状态展示')
assertContains(feiTicketsPageSource, 'getFeiTicketNumberingStatus', '菲票打印详情未复用统一打编号状态')
assertContains(webNumberingPageSource, 'data-skip-page-rerender="true"', 'Web 打编号输入必须避免 input 后整页重渲染')
assertContains(webNumberingPageSource, 'renderKpiCards(rows)', 'Web 打编号 KPI 必须与当前筛选结果口径一致')
assertContains(webNumberingPageSource, 'data-fei-ticket-numbering-action="open-scan-dialog"', 'Web 打编号扫码区必须收入口按钮和弹窗')
assertContains(webNumberingPageSource, 'renderScanDialog', 'Web 打编号缺少扫码弹窗')
assertContains(webNumberingPageSource, 'href="/fcs/craft/cutting/fei-ticket-numbering/summary"', 'Web 打编号缺少员工计件汇总入口')
assertContains(webNumberingPageSource, 'target="_blank"', '员工计件汇总必须以新窗口打开')
assertContains(webNumberingPageSource, 'renderCraftCuttingFeiTicketNumberingSummaryPage', '缺少员工计件汇总独立页面')
assertContains(webNumberingPageSource, 'buildOperatorPeriodSummaries', '员工计件汇总缺少员工+周期汇总')
assertContains(webNumberingPageSource, 'const key = `${record.operatorName}|${period.key}`', '员工计件汇总必须按员工姓名+时间周期合并')
assertContains(webNumberingPageSource, '按周汇总', '员工计件汇总缺少周维度')
assertContains(webNumberingPageSource, '按月汇总', '员工计件汇总缺少月维度')
assertNotContains(webNumberingPageSource, '${renderScanPanel()}', '主页面不应直接渲染扫码输入模块')
assertContains(pdaNumberingPageSource, 'data-skip-page-rerender="true"', 'PDA 打编号输入必须避免 input 后整页重渲染')
assertNotContains(dataSource, 'forEach((number', '打编号不得逐编号落明细')

console.log('check:cutting-fei-ticket-numbering passed')

#!/usr/bin/env node

import fs from 'node:fs'
import process from 'node:process'
import {
  canStatementEnterPrepayment,
  createPrepaymentBatch,
  getOpenStatementAppeal,
  getStatementConfirmationSourceLabel,
  getStatementSettlementProgressView,
  initialStatementDrafts,
  resolveStatementAppeal,
  submitStatementFactoryConfirmation,
  submitStatementFactoryAppeal,
  submitStatementMerchandiserProxyConfirmation,
} from '../src/data/fcs/store-domain-settlement-seeds.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function getPendingStatement() {
  return initialStatementDrafts.find(
    (statement) =>
      statement.status === 'PENDING_FACTORY_CONFIRM' &&
      statement.factoryFeedbackStatus === 'PENDING_FACTORY_CONFIRM' &&
      !getOpenStatementAppeal(statement),
  )
}

function main(): void {
  const statement = getPendingStatement()
  assert(statement, '缺少可用于跟单审核代确认的待工厂反馈对账单')

  const missingReason = submitStatementMerchandiserProxyConfirmation({
    statementId: statement!.statementId,
    by: '跟单A',
    reason: '',
    method: 'WHATSAPP',
    at: '2026-03-27 09:00:00',
  })
  assert(!missingReason.ok, '缺少代确认原因时仍允许提交')

  const result = submitStatementMerchandiserProxyConfirmation({
    statementId: statement!.statementId,
    by: '跟单A',
    reason: '三方工厂未在 PDA 操作，跟单已通过 WhatsApp 与负责人核对无异议',
    method: 'WHATSAPP',
    remark: '已核对本期金额、质量扣款和计划预付款日',
    notificationStatus: 'NOTIFIED',
    notificationRemark: '已在三方工厂端展示跟单审核代确认结果',
    at: '2026-03-27 09:10:00',
  })
  assert(result.ok && result.data, result.message ?? '跟单审核代确认失败')

  const confirmed = result.data!
  assert(confirmed.status === 'READY_FOR_PREPAYMENT', '代确认后对账单未进入待入预付款')
  assert(confirmed.factoryFeedbackStatus === 'FACTORY_CONFIRMED', '代确认后工厂反馈轴未进入已确认')
  assert(confirmed.confirmationSource === 'MERCHANDISER_PROXY_CONFIRMATION', '确认来源未标记为跟单审核代确认')
  assert(getStatementConfirmationSourceLabel(confirmed) === '跟单审核代确认', '确认来源展示文案不正确')
  assert(confirmed.proxyConfirmedBy === '跟单A', '未记录代确认跟单')
  assert(confirmed.proxyConfirmMethod === 'WHATSAPP', '未记录线下确认方式')
  assert(confirmed.proxyConfirmNotificationStatus === 'NOTIFIED', '未记录三方工厂通知状态')
  assert(confirmed.statementAuditLogs?.some((log) => log.action === '跟单审核代确认'), '未写入跟单审核代确认操作日志')
  assert(confirmed.statementAuditLogs?.some((log) => log.visibleToFactory), '操作日志未标记三方工厂可见')
  assert(canStatementEnterPrepayment(confirmed), '代确认后不能进入预付款批次')

  const progress = getStatementSettlementProgressView(confirmed)
  assert(progress.canEnterSettlement, '代确认后的进度视图未允许进入预付款')
  assert(progress.detail.includes('跟单审核代确认'), '进度说明未提示跟单审核代确认')

  const batchResult = createPrepaymentBatch({
    statementIds: [confirmed.statementId],
    batchName: '脚本校验跟单代确认批次',
    by: '脚本校验',
    at: '2026-03-27 09:20:00',
  })
  assert(batchResult.ok && batchResult.data, batchResult.message ?? '代确认对账单无法入预付款批次')
  assert(
    batchResult.data!.items.some((item) => item.confirmationSource === 'MERCHANDISER_PROXY_CONFIRMATION'),
    '预付款批次明细未保留跟单审核代确认来源',
  )

  const appealStatement = getPendingStatement()
  assert(appealStatement, '缺少可用于代确认后异议的待工厂反馈对账单')
  const appealProxy = submitStatementMerchandiserProxyConfirmation({
    statementId: appealStatement!.statementId,
    by: '跟单B',
    reason: '三方工厂长期未操作，跟单线下核对后代确认',
    method: 'PHONE',
    notificationStatus: 'NOTIFIED',
    at: '2026-03-27 09:30:00',
  })
  assert(appealProxy.ok && appealProxy.data, '代确认异议样例创建失败')
  const appealResult = submitStatementFactoryAppeal({
    statementId: appealProxy.data!.statementId,
    by: '三方工厂',
    reason: '对代确认结果有异议',
    description: '工厂认为本期质量扣款需重新核对',
    evidenceSummary: '已补充 WhatsApp 截图说明',
    at: '2026-03-27 09:40:00',
  })
  assert(appealResult.ok && appealResult.data, appealResult.message ?? '代确认后未入批单据无法发起异议')
  const appealedStatement = appealResult.data!
  const appealFeedbackAfterSubmit = appealedStatement.factoryFeedbackStatus
  assert(appealedStatement.status === 'PENDING_FACTORY_CONFIRM', '代确认异议后未退出待入预付款状态')
  assert(appealFeedbackAfterSubmit === 'FACTORY_APPEALED', '代确认异议后工厂反馈轴未进入已申诉')
  assert(
    getStatementConfirmationSourceLabel(appealedStatement).includes('工厂已提出异议'),
    '代确认异议后确认来源未提示工厂已提出异议',
  )
  assert(!canStatementEnterPrepayment(appealedStatement), '代确认异议后仍可进入预付款批次')
  assert(
    appealedStatement.statementAuditLogs?.some((log) => log.action === '三方工厂对代确认结果提出异议'),
    '代确认异议未写入操作日志',
  )
  const directConfirmAfterAppeal = submitStatementFactoryConfirmation({
    statementId: appealedStatement.statementId,
    by: '三方工厂',
    remark: '已有异议时不应允许直接确认',
    at: '2026-03-27 09:45:00',
  })
  assert(!directConfirmAfterAppeal.ok, '代确认异议后仍允许绕过平台处理直接确认')
  const resolutionResult = resolveStatementAppeal({
    statementId: appealedStatement.statementId,
    appealId: appealedStatement.factoryAppealRecord!.appealId,
    result: 'UPHELD',
    by: '平台结算专员',
    comment: '平台复核后维持跟单审核代确认口径，可继续进入预付款链路',
    at: '2026-03-27 10:00:00',
  })
  assert(resolutionResult.ok && resolutionResult.data, resolutionResult.message ?? '代确认异议平台处理失败')
  assert(resolutionResult.data!.confirmationSource === 'PLATFORM_APPEAL_RESOLUTION', '平台维持口径后确认来源未切到平台申诉处理确认')
  assert(canStatementEnterPrepayment(resolutionResult.data!), '平台维持口径后未恢复进入预付款资格')
  assert(
    resolutionResult.data!.statementAuditLogs?.some((log) => log.action === '平台申诉处理确认' && log.visibleToFactory),
    '平台维持口径后未写入三方工厂可见日志',
  )

  const statementsSource = fs.readFileSync(new URL('../src/pages/statements.ts', import.meta.url), 'utf8')
  assert(statementsSource.includes('跟单审核代确认'), 'Web 对账单页未展示跟单审核代确认文案')
  assert(statementsSource.includes('ST-LINK-2026-0003'), 'Web 对账单页缺少跟单审核代确认 mock 样例')
  assert(statementsSource.includes('STATEMENT_PAGE_SAMPLE_LIMIT = 15'), 'Web 对账单页未限制默认列表为 15 条业务样例')
  assert(statementsSource.includes('data-stm-action="open-proxy-confirm"'), 'Web 对账单列表或详情缺少跟单审核代确认操作入口')
  assert(statementsSource.includes('data-fast-page-render="true"'), 'Web 对账单页未启用内容区快速刷新')
  assert(statementsSource.includes('三方工厂已对代确认结果提出异议，平台处理前不会继续进入预付款'), 'Web 对账单页未提示代确认异议暂停预付款')
  assert(statementsSource.includes('操作日志'), 'Web 对账单页未展示操作日志')
  assert(statementsSource.includes('通知三方工厂状态'), 'Web 代确认弹窗未要求记录通知状态')

  const pdaSource = fs.readFileSync(new URL('../src/pages/pda-settlement.ts', import.meta.url), 'utf8')
  assert(pdaSource.includes('该对账单已由跟单审核代确认，不是工厂本人 PDA 确认'), 'PDA 端未明确区分代确认与工厂本人确认')
  assert(pdaSource.includes('三方工厂已对代确认结果提出异议，平台处理前该单不会继续进入预付款'), 'PDA 端未提示代确认异议暂停预付款')
  assert(pdaSource.includes('对代确认结果有异议'), 'PDA 端未保留代确认异议入口')
  assert(pdaSource.includes('三方工厂可见操作记录'), 'PDA 端未展示三方工厂可见操作记录')
  assert(pdaSource.includes('visibleToFactory'), 'PDA 端操作记录未按三方工厂可见范围过滤')
  assert(pdaSource.includes('三方工厂可在对账单详情中查看跟单、时间、原因和通知状态'), 'PDA 周期总览未提示三方工厂可见')

  const batchesSource = fs.readFileSync(new URL('../src/pages/batches.ts', import.meta.url), 'utf8')
  assert(batchesSource.includes('确认来源'), '预付款批次页未展示确认来源')
  assert(batchesSource.includes('getStatementConfirmationSourceLabel'), '预付款批次页未使用确认来源标签')

  console.log(
    JSON.stringify(
      {
        动作: '跟单审核代确认',
        对账单: confirmed.statementNo ?? confirmed.statementId,
        确认来源: getStatementConfirmationSourceLabel(confirmed),
        日志: confirmed.statementAuditLogs?.map((log) => log.action) ?? [],
        通知状态: confirmed.proxyConfirmNotificationStatus,
        入批校验: batchResult.data!.batchNo,
        异议回退: appealFeedbackAfterSubmit,
        平台裁决后确认来源: getStatementConfirmationSourceLabel(resolutionResult.data!),
      },
      null,
      2,
    ),
  )
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
}

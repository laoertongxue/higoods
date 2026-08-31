#!/usr/bin/env node

import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

import { AUX_SPECIAL_ACCESSORY_CHAINS } from './aux-special-accessory-test-catalog.ts'

type SuiteEvidence = {
  suite: string
  passLabel: string
  generatedAt: string
  totals: {
    all: number
    passed: number
    failed: number
    notApplicable?: number
    blockedExternal?: number
  }
  workOrderCount?: number
  perWorkOrderDataTests?: number
  results: Array<{
    chainId: string
    workOrderId?: string
    workOrderNo?: string
    status: string
    evidence?: Record<string, unknown>
  }>
}

type BrowserEvidence = {
  suite: string
  passLabel: string
  generatedAt: string
  totals: { all: number; passed: number; failed: number }
  results: Array<{
    chainId: string
    workOrderId: string
    workOrderNo: string
    sourceType: string
    pdaApplicable: boolean
    status: string
    webScreenshot?: string
    pdaScreenshot?: string
  }>
}

type PlaywrightEvidence = {
  errors: unknown[]
  stats: {
    expected: number
    skipped: number
    unexpected: number
    flaky: number
  }
}

type PhysicalEvidence = {
  schemaVersion: number
  runs: Array<{
    passLabel: string
    localBrowserGeneratedAt: string
    testDataResetAt: string
    testDataResetBy: string
    baseUrl: string
    device: {
      kind: string
      manufacturer: string
      model: string
      serialNo: string
      androidVersion: string
      screenResolution: string
    }
    verifier: { name: string; employeeId: string }
    entries: Array<{
      gateId: string
      chainId: string
      workOrderId: string
      workOrderNo: string
      sourceType: string
      sourceTaskId: string
      sourceTaskNo: string
      factoryId: string
      enteredUrl: string
      scannedCode: string
      actions: Array<{
        action: string
        result: string
        beforeStatus: string
        afterStatus: string
        actualQty: number | null
        unit: string
        operatorName: string
        verifiedAt: string
        photoPath: string
        businessRecordId?: string
        note?: string
      }>
    }>
  }>
}

const evidenceRoot = resolve('output/verification/aux-special-accessory')
const passLabels = ['pass-1', 'pass-2'] as const
const requiredSuites = [
  'scope-boundary',
  'work-order-identity',
  'task-auto-completion',
  'per-craft-full-flow',
  'downstream-ledgers',
  'named-scenarios',
] as const
const chainIds = AUX_SPECIAL_ACCESSORY_CHAINS.map((chain) => chain.id)
const physicalChainIds = chainIds.filter((chainId) => chainId !== 'ACC-LACE-01')
const requiredActions = [
  '扫码定位加工单',
  '确认接收-第1批',
  '确认接收-第2批',
  '加工填报-第1批',
  '加工填报-第2批',
  '发起交出-第1批',
  '发起交出-第2批',
  '完成加工单',
]

function recordsFromEvidence(result: SuiteEvidence['results'][number], key: string): Array<Record<string, unknown>> {
  const value = result.evidence?.[key]
  assert(Array.isArray(value), `${result.chainId}/${result.workOrderId || 'UNKNOWN'} 缺少 ${key} 业务记录`)
  return value as Array<Record<string, unknown>>
}

function assertActionCount(
  records: Array<Record<string, unknown>>,
  codeKey: string,
  expected: Record<string, number>,
  label: string,
): void {
  for (const [actionCode, minimum] of Object.entries(expected)) {
    const count = records.filter((record) => record[codeKey] === actionCode).length
    assert(count >= minimum, `${label}/${actionCode} 只有 ${count} 条，至少需要 ${minimum} 条`)
  }
}

function loadJson<T>(path: string, missingMessage: string): T {
  assert(existsSync(path), `${missingMessage}：${path}`)
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function assertNonEmpty(value: string | undefined, message: string): asserts value is string {
  assert(value?.trim(), message)
}

function assertPhoto(path: string, message: string): void {
  assertNonEmpty(path, message)
  const absolutePath = resolve(path)
  assert(existsSync(absolutePath), `${message}，文件不存在：${absolutePath}`)
  assert(statSync(absolutePath).size > 0, `${message}，文件为空：${absolutePath}`)
}

const passEvidence = new Map<string, Map<string, SuiteEvidence>>()
const browserEvidence = new Map<string, BrowserEvidence>()

for (const passLabel of passLabels) {
  const suites = new Map<string, SuiteEvidence>()
  for (const suite of requiredSuites) {
    const path = resolve(evidenceRoot, passLabel, `${suite}.json`)
    const document = loadJson<SuiteEvidence>(path, `${passLabel} 缺少 ${suite} 证据`)
    assert.equal(document.suite, suite, `${passLabel}/${suite} 套件名不一致`)
    assert.equal(document.passLabel, passLabel, `${passLabel}/${suite} 轮次标签不一致`)
    assert.equal(document.totals.failed, 0, `${passLabel}/${suite} 存在失败`)
    if (suite !== 'named-scenarios') {
      assert.equal(document.totals.blockedExternal || 0, 0, `${passLabel}/${suite} 不应有外部门禁`)
      assert.equal(document.totals.passed, document.totals.all, `${passLabel}/${suite} 未全部通过`)
    } else {
      assert.equal(document.totals.blockedExternal, 18, `${passLabel}/named-scenarios 现实 PDA 门禁不是 18 条`)
      assert.equal(document.totals.passed + (document.totals.blockedExternal || 0), document.totals.all)
    }
    suites.set(suite, document)
  }
  passEvidence.set(passLabel, suites)

  const identity = suites.get('work-order-identity')!
  assert(Number(identity.workOrderCount || 0) > 0, `${passLabel} 未记录加工单总数`)
  const fullFlow = suites.get('per-craft-full-flow')!
  assert.equal(fullFlow.workOrderCount, identity.workOrderCount, `${passLabel} 全流程加工单数与逐单清单不一致`)
  const expectedWorkOrderIds = new Set(identity.results.map((result) => result.workOrderId).filter(Boolean) as string[])
  const flowResults = fullFlow.results.filter((result) => result.status === 'passed')
  const flowWorkOrderIds = flowResults.map((result) => result.workOrderId).filter(Boolean) as string[]
  assert.equal(flowWorkOrderIds.length, Number(identity.workOrderCount), `${passLabel} 不是每张加工单都有全流程结果`)
  assert.equal(new Set(flowWorkOrderIds).size, flowWorkOrderIds.length, `${passLabel} 同一加工单被重复计数`)
  assert.deepEqual([...new Set(flowWorkOrderIds)].sort(), [...expectedWorkOrderIds].sort(), `${passLabel} 全流程加工单清单不完整`)
  for (const result of flowResults) {
    assertNonEmpty(result.workOrderId, `${passLabel}/${result.chainId} 缺少加工单 ID`)
    assertNonEmpty(result.workOrderNo, `${passLabel}/${result.chainId}/${result.workOrderId} 缺少加工单号`)
    if (result.chainId === 'BIND-01') {
      const records = recordsFromEvidence(result, 'actionRecords')
      assertActionCount(records, 'actionCode', {
        BINDING_CONFIRM_RECEIVE: 2,
        BINDING_PROCESS_REPORT: 2,
        BINDING_SUBMIT_HANDOVER: 2,
        BINDING_COMPLETE_ORDER: 1,
      }, `${passLabel}/${result.workOrderId}`)
      assert(records.every((record) => String(record.actionRecordId || '').trim()), `${passLabel}/${result.workOrderId} 捆条动作缺少业务记录 ID`)
      assert(records.every((record) => Number(record.qty) > 0 || record.actionCode === 'BINDING_COMPLETE_ORDER'), `${passLabel}/${result.workOrderId} 存在无效捆条动作数量`)
      continue
    }
    if (result.chainId === 'ACC-LACE-01') {
      const reports = recordsFromEvidence(result, 'reports')
      const handovers = recordsFromEvidence(result, 'handovers')
      const receipts = recordsFromEvidence(result, 'receipts')
      const logs = recordsFromEvidence(result, 'operationLogs')
      assert(reports.length >= 3, `${passLabel}/${result.workOrderId} 花边加工填报不足 3 批`)
      assert(handovers.length >= 2, `${passLabel}/${result.workOrderId} 花边交出不足 2 批`)
      assert(receipts.length >= 2, `${passLabel}/${result.workOrderId} 花边实收不足 2 批`)
      assertActionCount(logs, 'action', { 确认接收: 1, 加工填报: 3, 发起交出: 2, 完成加工单: 1 }, `${passLabel}/${result.workOrderId}`)
      assert(reports.every((record) => String(record.reportId || '').trim() && record.workOrderId === result.workOrderId && Number(record.qty) > 0), `${passLabel}/${result.workOrderId} 花边填报缺少有效业务记录`)
      assert(handovers.every((record) => String(record.handoverId || '').trim() && record.workOrderId === result.workOrderId && Number(record.qty) > 0), `${passLabel}/${result.workOrderId} 花边交出缺少有效业务记录`)
      assert(receipts.every((record) => String(record.receiptId || '').trim() && record.workOrderId === result.workOrderId && Number(record.actualQty) > 0), `${passLabel}/${result.workOrderId} 花边实收缺少有效业务记录`)
      assert(logs.every((record) => String(record.logId || '').trim() && String(record.beforeValue || '').trim() && String(record.afterValue || '').trim()), `${passLabel}/${result.workOrderId} 花边操作日志缺少记录 ID 或状态前后`)
      continue
    }
    const records = recordsFromEvidence(result, 'operationRecords')
    assertActionCount(records, 'actionCode', {
      SPECIAL_CRAFT_CONFIRM_RECEIVE: 2,
      SPECIAL_CRAFT_PROCESS_REPORT: 2,
      SPECIAL_CRAFT_SUBMIT_HANDOVER: 2,
      SPECIAL_CRAFT_COMPLETE_ORDER: 1,
    }, `${passLabel}/${result.workOrderId}`)
    assert(records.every((record) => String(record.operationRecordId || '').trim()), `${passLabel}/${result.workOrderId} 动作缺少业务记录 ID`)
    assert(records.every((record) => record.sourceId === result.workOrderId), `${passLabel}/${result.workOrderId} 存在跨加工单动作记录`)
    assert(records.every((record) => Number(record.objectQty) > 0), `${passLabel}/${result.workOrderId} 存在无效动作数量`)
    assert(records.every((record) => String(record.previousStatus || '').trim() && String(record.nextStatus || '').trim()), `${passLabel}/${result.workOrderId} 动作缺少状态前后`)
  }

  const browserPath = resolve(evidenceRoot, passLabel, 'browser', 'browser-results.json')
  const browser = loadJson<BrowserEvidence>(browserPath, `${passLabel} 缺少浏览器证据`)
  assert.equal(browser.passLabel, passLabel)
  assert.equal(browser.totals.all, identity.workOrderCount, `${passLabel} 浏览器不是每张加工单一条 UI 结果`)
  assert.equal(browser.totals.passed, identity.workOrderCount, `${passLabel} 浏览器逐加工单 UI 未全部通过`)
  assert.equal(browser.totals.failed, 0, `${passLabel} 浏览器存在失败`)
  assert.deepEqual([...new Set(browser.results.map((result) => result.chainId))].sort(), [...chainIds].sort())
  const browserWorkOrderIds = browser.results.map((result) => result.workOrderId)
  assert.equal(new Set(browserWorkOrderIds).size, browserWorkOrderIds.length, `${passLabel} 浏览器重复验收同一加工单`)
  assert.deepEqual([...browserWorkOrderIds].sort(), [...expectedWorkOrderIds].sort(), `${passLabel} 浏览器未覆盖全部加工单`)
  const flowResultByWorkOrderId = new Map(fullFlow.results.map((result) => [result.workOrderId, result]))
  for (const result of browser.results) {
    const flowResult = flowResultByWorkOrderId.get(result.workOrderId)
    assert(flowResult, `${passLabel}/${result.workOrderId} 浏览器结果不属于逐加工单全流程清单`)
    assert.equal(result.chainId, flowResult.chainId, `${passLabel}/${result.workOrderId} 浏览器工艺链不一致`)
    assert.equal(result.workOrderNo, flowResult.workOrderNo, `${passLabel}/${result.workOrderId} 浏览器加工单号不一致`)
    assert.equal(result.status, 'passed', `${passLabel}/${result.workOrderId} 浏览器逐单 UI 未通过`)
    assert.equal(result.pdaApplicable, result.chainId !== 'ACC-LACE-01', `${passLabel}/${result.workOrderId} PDA 适用性错误`)
    assertPhoto(result.webScreenshot || '', `${passLabel}/${result.chainId}/${result.workOrderId} 缺少逐单 Web 截图`)
    if (result.pdaApplicable) {
      assertPhoto(result.pdaScreenshot || '', `${passLabel}/${result.chainId}/${result.workOrderId} 缺少逐单 PDA 小屏截图`)
    } else {
      assert(!result.pdaScreenshot, `${passLabel}/${result.chainId}/${result.workOrderId} Web-only 花边不应伪造 PDA 截图`)
    }
  }
  browserEvidence.set(passLabel, browser)

  const playwrightPath = resolve(evidenceRoot, passLabel, 'playwright-results.json')
  const playwright = loadJson<PlaywrightEvidence>(playwrightPath, `${passLabel} 缺少完整 Playwright 证据`)
  assert.equal(playwright.errors.length, 0, `${passLabel} Playwright 报告存在顶层错误`)
  assert.equal(playwright.stats.expected, 178, `${passLabel} Playwright 完整用例不是 178 条`)
  assert.equal(playwright.stats.skipped, 0, `${passLabel} Playwright 存在跳过用例`)
  assert.equal(playwright.stats.unexpected, 0, `${passLabel} Playwright 存在失败用例`)
  assert.equal(playwright.stats.flaky, 0, `${passLabel} Playwright 依靠重试才通过`)

}

const firstIdentity = passEvidence.get('pass-1')!.get('work-order-identity')!
const secondIdentity = passEvidence.get('pass-2')!.get('work-order-identity')!
assert.equal(firstIdentity.workOrderCount, secondIdentity.workOrderCount, '两轮加工单总数不一致')
assert.equal(firstIdentity.totals.passed, secondIdentity.totals.passed, '两轮加工单数据测试数不一致')
const firstFlowIds = passEvidence.get('pass-1')!.get('per-craft-full-flow')!.results.map((result) => result.workOrderId).filter(Boolean).sort()
const secondFlowIds = passEvidence.get('pass-2')!.get('per-craft-full-flow')!.results.map((result) => result.workOrderId).filter(Boolean).sort()
assert.deepEqual(firstFlowIds, secondFlowIds, '两轮全流程加工单清单不一致')

const physicalPath = resolve(
  process.env.AUX_SPECIAL_PHYSICAL_EVIDENCE || resolve(evidenceRoot, 'physical-device-evidence.json'),
)
assert(
  existsSync(physicalPath),
  `缺少现实 iData PDA 双轮证据：${physicalPath}。请先运行 npm run create:aux-special-accessory:physical-template，填写后另存为 physical-device-evidence.json；桌面小屏证据不能替代。`,
)
const physical = loadJson<PhysicalEvidence>(physicalPath, '现实 PDA 证据不可读')
assert.equal(physical.schemaVersion, 2, '现实 PDA 证据版本不兼容')
assert.equal(physical.runs.length, 2, '现实 PDA 必须完整核验两遍')

for (const passLabel of passLabels) {
  const run = physical.runs.find((item) => item.passLabel === passLabel)
  assert(run, `现实 PDA 缺少 ${passLabel}`)
  const browser = browserEvidence.get(passLabel)!
  assert.equal(run.localBrowserGeneratedAt, browser.generatedAt, `${passLabel} 实机证据未绑定当前浏览器轮次`)
  assertNonEmpty(run.testDataResetAt, `${passLabel} 缺少测试数据重置时间`)
  assertNonEmpty(run.testDataResetBy, `${passLabel} 缺少测试数据重置人`)
  assertNonEmpty(run.baseUrl, `${passLabel} 缺少现实 PDA 访问地址`)
  assert(/^https?:\/\//.test(run.baseUrl), `${passLabel} 现实 PDA 地址格式错误`)
  assert.equal(run.device.kind, 'PHYSICAL_IDATA_PDA', `${passLabel} 不能用模拟器或桌面小屏代替现实 PDA`)
  assert(/idata/i.test(`${run.device.manufacturer} ${run.device.model}`), `${passLabel} 设备不是 iData PDA`)
  for (const [field, value] of Object.entries(run.device)) assertNonEmpty(value, `${passLabel} 设备字段 ${field} 为空`)
  assertNonEmpty(run.verifier.name, `${passLabel} 缺少实机核验人`)
  assertNonEmpty(run.verifier.employeeId, `${passLabel} 缺少核验人工号`)
  const fullFlow = passEvidence.get(passLabel)!.get('per-craft-full-flow')!
  const physicalFlowResults = fullFlow.results.filter((result) => result.chainId !== 'ACC-LACE-01')
  assert.equal(run.entries.length, physicalFlowResults.length, `${passLabel} 实机未覆盖全部适用加工单`)
  const flowByWorkOrderId = new Map(physicalFlowResults.map((result) => [result.workOrderId, result]))
  assert.deepEqual([...new Set(run.entries.map((entry) => entry.workOrderId))].sort(), [...flowByWorkOrderId.keys()].sort())
  assert.deepEqual([...new Set(run.entries.map((entry) => entry.chainId))].sort(), [...physicalChainIds].sort())

  for (const entry of run.entries) {
    const expected = flowByWorkOrderId.get(entry.workOrderId)
    assert(expected, `${passLabel}/${entry.workOrderId} 不属于现实 PDA 全流程清单`)
    assert.equal(entry.gateId, `DEVICE-${entry.chainId}-${entry.workOrderId}`)
    assert.equal(entry.workOrderId, expected.workOrderId, `${passLabel}/${entry.chainId} 加工单 ID 不一致`)
    assert.equal(entry.workOrderNo, expected.workOrderNo, `${passLabel}/${entry.chainId} 加工单号不一致`)
    assertNonEmpty(entry.factoryId, `${passLabel}/${entry.chainId} 缺少执行工厂`)
    assertNonEmpty(entry.sourceTaskId, `${passLabel}/${entry.chainId} 缺少来源任务 ID`)
    assertNonEmpty(entry.sourceTaskNo, `${passLabel}/${entry.chainId} 缺少来源任务号`)
    assertNonEmpty(entry.enteredUrl, `${passLabel}/${entry.chainId} 缺少进入 URL`)
    const decodedEnteredUrl = decodeURIComponent(entry.enteredUrl)
    assert(decodedEnteredUrl.includes(`/fcs/pda/exec/${entry.sourceType}/${entry.workOrderId}`), `${passLabel}/${entry.chainId} URL 未保留具体加工单 ID`)
    assertNonEmpty(entry.scannedCode, `${passLabel}/${entry.chainId} 缺少实扫码值`)
    assert.equal(entry.actions.length, requiredActions.length, `${passLabel}/${entry.chainId} 动作数量不完整`)
    assert.deepEqual(entry.actions.map((action) => action.action), requiredActions, `${passLabel}/${entry.chainId} 动作顺序或名称错误`)
    for (const action of entry.actions) {
      assert.equal(action.result, 'passed', `${passLabel}/${entry.chainId}/${action.action} 未通过`)
      assertNonEmpty(action.beforeStatus, `${passLabel}/${entry.chainId}/${action.action} 缺少动作前状态`)
      assertNonEmpty(action.afterStatus, `${passLabel}/${entry.chainId}/${action.action} 缺少动作后状态`)
      assertNonEmpty(action.operatorName, `${passLabel}/${entry.chainId}/${action.action} 缺少操作人`)
      assertNonEmpty(action.verifiedAt, `${passLabel}/${entry.chainId}/${action.action} 缺少核验时间`)
      assertPhoto(action.photoPath, `${passLabel}/${entry.chainId}/${action.action} 缺少现实 PDA 照片`)
      if (action.action !== '扫码定位加工单') {
        assert(Number(action.actualQty) > 0, `${passLabel}/${entry.chainId}/${action.action} 实际数量必须大于 0`)
        assertNonEmpty(action.unit, `${passLabel}/${entry.chainId}/${action.action} 缺少单位`)
        assertNonEmpty(action.businessRecordId, `${passLabel}/${entry.chainId}/${action.action} 缺少业务记录 ID`)
      }
    }
  }
}

console.log(`辅助工艺、特殊工艺、捆条和花边完成门禁通过：${firstIdentity.workOrderCount} 张加工单两轮逐单全流程；现实 iData 对全部适用加工单执行双批接收、双批填报、双批交出和完成。`)

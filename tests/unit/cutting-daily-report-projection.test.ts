import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test, { after } from 'node:test'
import type { CuttingDomainSnapshot } from '../../src/domain/fcs-cutting-runtime/types.ts'
import type { CuttingSummaryBuildOptions } from '../../src/pages/process-factory/cutting/summary-model.ts'
import type { CuttingDailyProductionReport, CuttingDailyProductionReportQuery } from '../../src/pages/process-factory/cutting/cutting-daily-production-report-model.ts'
import type { CuttingDailyReportBuildOptions } from '../../src/pages/process-factory/cutting/runtime-projections.ts'

// Count actual reads/derived builds without adding instrumentation to product code.
const counts: Record<string, number> = {}
const instrumented = new Set<string>()
const counterKey = '__cuttingDailyProjectionTestCounts'
;(globalThis as unknown as Record<string, unknown>)[counterKey] = counts
const hooks = registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context)
    const targets = url.endsWith('/transfer-bags-model.ts')
      ? ['buildTransferBagStageLedgerItems', 'buildCutPieceSortingTasks']
      : url.endsWith('/domain-snapshot.ts')
        ? ['buildFcsCuttingDomainSnapshot']
        : url.endsWith('/runtime-inputs.ts')
          ? ['readCuttingRuntimeInputs']
          : []
    if (!targets.length) return result
    let source = typeof result.source === 'string'
      ? result.source
      : Buffer.from(result.source as Uint8Array).toString('utf8')
    for (const name of targets) {
      const signature = new RegExp(`function ${name}\\([\\s\\S]*?\\)\\s*\\{`)
      assert.match(source, signature, `loader must find ${name}`)
      source = source.replace(signature, (match) => `${match}globalThis.${counterKey}.${name} = (globalThis.${counterKey}.${name} || 0) + 1;`)
      instrumented.add(name)
    }
    return { ...result, source }
  },
})

const reportModel = await import('../../src/pages/process-factory/cutting/cutting-daily-production-report-model.ts')
const projections = await import('../../src/pages/process-factory/cutting/runtime-projections.ts')
const { buildFcsCuttingDomainSnapshot } = await import('../../src/domain/fcs-cutting-runtime/domain-snapshot.ts')
const { buildSystemSeedTransferBagStore } = await import('../../src/pages/process-factory/cutting/transfer-bags-model.ts')
const { createReturnReceiptDraft, validateReturnReceiptPayload } = await import('../../src/pages/process-factory/cutting/transfer-bag-return-model.ts')
const evidence: Record<string, unknown> = {}

after(() => {
  hooks.deregister()
  Reflect.deleteProperty(globalThis, counterKey)
  if (process.env.CUTTING_DAILY_PROJECTION_TEST_OUTPUT) {
    mkdirSync(process.env.CUTTING_DAILY_PROJECTION_TEST_OUTPUT, { recursive: true })
    writeFileSync(join(process.env.CUTTING_DAILY_PROJECTION_TEST_OUTPUT, 'equality-and-calls.json'), JSON.stringify(evidence, null, 2))
  }
})

function normalizeClock(report: CuttingDailyProductionReport) {
  return { ...report, generatedAt: '[wall-clock]' }
}

function reportHash(report: CuttingDailyProductionReport): string {
  return createHash('sha256').update(JSON.stringify(normalizeClock(report))).digest('hex')
}

function reportSources(full: CuttingSummaryBuildOptions): CuttingDailyReportBuildOptions {
  return {
    productionRows: full.productionRows,
    cutOrderRows: full.cutOrderRows,
    materialPrepRows: full.materialPrepRows,
    markerPlanSources: full.markerPlanSources,
    markerStore: full.markerStore,
    feiViewModel: { ticketRecords: full.feiViewModel.ticketRecords },
    cutPieceWarehouseView: { items: full.cutPieceWarehouseView.items },
    transferBagView: { usages: full.transferBagView.usages },
  }
}

function onlyDeclaredFields<T extends object>(value: T): T {
  return new Proxy(value, {
    get(target, property, receiver) {
      if (typeof property === 'string') assert.ok(Object.hasOwn(target, property), `unexpected source read: ${property}`)
      return Reflect.get(target, property, receiver)
    },
  })
}

function guardedSources(sources: CuttingDailyReportBuildOptions): CuttingDailyReportBuildOptions {
  return onlyDeclaredFields({
    ...sources,
    feiViewModel: onlyDeclaredFields(sources.feiViewModel),
    cutPieceWarehouseView: onlyDeclaredFields(sources.cutPieceWarehouseView),
    transferBagView: onlyDeclaredFields(sources.transferBagView),
  })
}

const queries: CuttingDailyProductionReportQuery[] = [
  { reportDate: '2026-03-24', factoryId: 'ALL', keyword: '', executionOwner: 'ALL', includeDemoData: true, timezone: 'Asia/Jakarta' },
  { reportDate: '2026-03-24', factoryId: 'ALL', keyword: 'PO-202603-0004', executionOwner: 'ALL', includeDemoData: true, timezone: 'Asia/Jakarta' },
  { reportDate: '2026-03-24', factoryId: 'ALL', keyword: '', executionOwner: 'THIRD_PARTY', includeDemoData: true, timezone: 'Asia/Jakarta' },
  { reportDate: '2026-10-20', factoryId: 'ALL', keyword: '', executionOwner: 'ALL', includeDemoData: true, timezone: 'Asia/Jakarta' },
  { reportDate: '2026-03-24', factoryId: 'ALL', keyword: '', executionOwner: 'ALL', includeDemoData: false, timezone: 'Asia/Jakarta' },
]

function assertEquivalent(snapshot: CuttingDomainSnapshot, label: string) {
  const beforeFull = { ...counts }
  const full = projections.mapCuttingDomainSnapshotToSummaryBuildOptions(snapshot)
  assert.equal(counts.buildTransferBagStageLedgerItems, (beforeFull.buildTransferBagStageLedgerItems || 0) + 1, 'full summary keeps its stage ledger')
  assert.equal(counts.buildCutPieceSortingTasks, (beforeFull.buildCutPieceSortingTasks || 0) + 1, 'full summary keeps its sorting queue')
  const afterFull = { ...counts }
  const scoped = projections.mapCuttingDomainSnapshotToDailyReportBuildOptions(snapshot)
  assert.deepEqual(counts, afterFull, 'daily projection must not read another snapshot or build sewing stage projections')
  assert.deepEqual(scoped, reportSources(full), 'all fields consumed by the report must match the complete projection')
  const results = queries.map((query) => {
    const expected = reportModel.buildCuttingDailyProductionReportFromSources(query, full)
    const actual = reportModel.buildCuttingDailyProductionReportFromSources(query, guardedSources(scoped))
    assert.deepEqual(normalizeClock(actual), normalizeClock(expected), `${label}: full report values, rows, units, links and coverage`)
    return { query, fullHash: reportHash(expected), dailyHash: reportHash(actual), detailRows: actual.totals.totalDetailCount }
  })
  evidence[label] = {
    productionRows: scoped.productionRows.length,
    cutOrderRows: scoped.cutOrderRows.length,
    materialRows: scoped.materialPrepRows.length,
    feiTickets: scoped.feiViewModel.ticketRecords.length,
    bagUsages: scoped.transferBagView.usages.length,
    stageRowsKeptInSummary: full.transferBagView.stageLedgerItems.length,
    sortingRowsKeptInSummary: full.transferBagView.sortingTasks.length,
    queries: results,
  }
  return { full, scoped }
}

test('日报首读仅取一个运行快照，不建立未展示的车缝分拣和交出派生', () => {
  Object.keys(counts).forEach((key) => delete counts[key])
  const report = reportModel.buildCuttingDailyProductionReport({
    reportDate: reportModel.CUTTING_DAILY_DEMO_REPORT_DATE,
    includeDemoData: true,
  })
  assert.ok(report.productionContributions.length > 0)
  assert.equal(instrumented.size, 4)
  assert.equal(counts.buildFcsCuttingDomainSnapshot, 1)
  assert.equal(counts.readCuttingRuntimeInputs, 1)
  assert.equal(counts.buildTransferBagStageLedgerItems || 0, 0)
  assert.equal(counts.buildCutPieceSortingTasks || 0, 0)
  evidence.firstReadCalls = { ...counts }
})

test('当前全量 Mock 的日报所有字段、数量单位和明细与原完整投影等价', () => {
  assertEquivalent(buildFcsCuttingDomainSnapshot(), 'allStaticMock')
})

test('保存的装袋、回收差异与菲票覆盖保留同源结果；下一快照变化立即反映', () => {
  const snapshot = buildFcsCuttingDomainSnapshot()
  const base = projections.mapCuttingDomainSnapshotToDailyReportBuildOptions(snapshot)
  const store = buildSystemSeedTransferBagStore({
    cutOrderRows: base.cutOrderRows,
    ticketRecords: base.feiViewModel.ticketRecords,
    markerPlanSources: base.markerPlanSources,
  })
  const usage = store.usages.find((item) => store.bindings.some((binding) => binding.usageId === item.usageId))!
  assert.ok(usage, 'fixture must use an existing bound bag cycle')
  const bindings = store.bindings.filter((item) => item.usageId === usage.usageId)
  usage.usageStatus = 'RETURN_INSPECTING'
  usage.finishedPackingAt = '2026-03-24 10:05:00'
  usage.dispatchAt = '2026-03-24 11:05:00'
  usage.dispatchBy = '实际装袋登记人'
  usage.receiverName = '实际接收工厂'
  const receipt = {
    ...createReturnReceiptDraft({ usage, bindingsCount: bindings.length, cutOrderCount: new Set(bindings.map((item) => item.cutOrderId)).size, nowText: '2026-03-24 16:20:00' }),
    returnedBy: '实际返仓人',
    receivedBy: '实际回收确认人',
    returnedTicketCountSummary: Math.max(0, bindings.length - 1),
    discrepancyType: 'QTY_MISMATCH' as const,
    discrepancyNote: '实收少一张，保留原交出数量与回收差异',
  }
  assert.deepEqual(validateReturnReceiptPayload({ usage, bag: store.masters.find((bag) => bag.bagId === usage.bagId)!, receipt }), { ok: true, reason: '' })
  store.returnReceipts.push(receipt)
  store.conditionRecords.push({
    conditionRecordId: `inspection:${usage.cycleId}`, cycleId: usage.cycleId, carrierId: usage.carrierId,
    carrierCode: usage.carrierCode, usageId: usage.usageId, bagId: usage.bagId, bagCode: usage.bagCode,
    conditionStatus: 'MINOR_DAMAGE', cleanlinessStatus: 'CLEAN', damageType: '袋口磨损', repairNeeded: true,
    reusableDecision: 'REUSABLE', inspectedAt: receipt.returnAt, inspectedBy: receipt.receivedBy, note: '修补后可继续使用',
  })
  const storedTicket = { ...base.feiViewModel.ticketRecords[0], printedAt: '2026-03-24 09:35:00', printedBy: '实际打印登记人' }
  const storedSnapshot: CuttingDomainSnapshot = {
    ...snapshot,
    feiTicketState: { ...snapshot.feiTicketState, ticketRecords: [storedTicket] },
    transferBagState: { store: { ...store } },
  }
  const { full, scoped } = assertEquivalent(storedSnapshot, 'savedBagAndReturnDifference')
  const returnUsage = full.transferBagReturnView.waitingReturnUsages.find((item) => item.usageId === usage.usageId)!
  assert.equal(returnUsage.latestReturnReceipt?.receivedBy, receipt.receivedBy)
  assert.equal(returnUsage.latestReturnReceipt?.discrepancyType, 'QTY_MISMATCH')
  assert.ok(returnUsage.returnDiscrepancyMeta, 'saved return discrepancy remains visible in the complete summary')
  assert.equal(scoped.transferBagView.usages.find((item) => item.usageId === usage.usageId)?.dispatchBy, usage.dispatchBy)
  assert.equal(scoped.feiViewModel.ticketRecords.find((ticket) => ticket.ticketRecordId === storedTicket.ticketRecordId)?.printedBy, storedTicket.printedBy)

  const nextStore = structuredClone(store)
  const nextUsage = nextStore.usages.find((item) => item.usageId === usage.usageId)!
  nextUsage.usageStatus = 'CLOSED'
  nextUsage.receiverName = '更新后的实际接收工厂'
  nextUsage.finishedPackingAt = '2026-03-25 12:30:00'
  const nextSnapshot: CuttingDomainSnapshot = { ...storedSnapshot, transferBagState: { store: { ...nextStore } } }
  const next = assertEquivalent(nextSnapshot, 'nextSnapshot')
  const previousReport = reportModel.buildCuttingDailyProductionReportFromSources(queries[0], scoped)
  const nextReport = reportModel.buildCuttingDailyProductionReportFromSources(queries[0], next.scoped)
  const bagRowId = `bag:${usage.cycleId}`
  const previousRow = previousReport.detailRowsByTab.tickets.find((item) => item.id === bagRowId)!
  const nextRow = nextReport.detailRowsByTab.tickets.find((item) => item.id === bagRowId)!
  assert.ok(previousRow && nextRow)
  assert.notEqual(nextRow.status, previousRow.status)
  assert.notEqual(nextRow.summary, previousRow.summary)
  assert.equal(nextRow.occurredAt, nextUsage.finishedPackingAt)
  assert.equal(previousRow.occurredAt, usage.finishedPackingAt, 'previous snapshot results must remain unchanged')
  evidence.sourceRefresh = { cycleId: usage.cycleId, before: previousRow, after: nextRow }
})

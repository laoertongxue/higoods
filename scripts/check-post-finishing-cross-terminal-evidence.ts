#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

type StageEvidence = {
  stage: string
  skuCount: number
}

type ChainEvidence = {
  chainIndex: number
  productionOrderNo: string
  returnIndex: number
  label: string
  stages: StageEvidence[]
  authorizationStages: string[]
  finalScreenshot?: string
}

type AcceptanceEvidence = {
  suite: string
  passLabel: string
  startedAt: string
  finishedAt?: string
  writeBoundary: string
  expected: {
    productionOrders: number
    skuPerProductionOrder: number
    returnsPerProductionOrder: number
    chains: number
  }
  chains: ChainEvidence[]
  surfaceScreenshots: string[]
  finalSnapshot?: {
    totals: Record<string, number>
    chains: Array<{ warehouseReceived: boolean; waitHandoverStatus?: string }>
  }
}

const evidenceRoot = resolve(process.cwd(), 'output/verification/post-finishing-full-flow')
const passes = [
  { directory: '2026-09-01-online-baseline-final-pass-1', label: 'online-baseline-final-pass-1' },
  { directory: '2026-09-01-online-baseline-final-pass-2', label: 'online-baseline-final-pass-2' },
] as const
const expectedTotals = {
  productionOrders: 3,
  deliveries: 15,
  skuReturnLines: 75,
  qcTasks: 15,
  postTasks: 12,
  recheckOrders: 15,
  outboundOrders: 15,
  warehouseReceipts: 15,
  waitProcessWarehouseRecords: 15,
  waitProcessWarehouseMovements: 30,
  waitHandoverWarehouseRecords: 15,
  waitHandoverWarehouseMovements: 30,
  defects: 2,
  operationLogs: 271,
  authorizationConsumptions: 5,
}
const expectedScenarioLabels = [
  '正常一致',
  '回货 -5%边界且质检直达复检',
  '回货超过5%复点与动态授权',
  '质检瑕疵守恒后进入后道',
  'SKU错码重贴与复扫恢复',
  '回货 +5%边界及买手资料',
  '质检少1件授权后直达复检',
  '后道少1件动态授权',
  '复检少1件动态授权',
  '仓库少1件动态授权',
  '质检返厂守恒及资料冻结',
  '无后道直达复检正常链',
  '后道新增瑕疵守恒',
  '第二组SKU错码重贴复扫',
  '复检退领重领及重复收货幂等',
]
const expectedAuthorizationStages = ['PDA仓库收货', 'PDA后道', 'PDA复检', 'Web质检', 'Web回货确认'].sort()

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root).flatMap((name) => {
    const path = resolve(root, name)
    return statSync(path).isDirectory() ? walkFiles(path) : [path]
  })
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function readEvidence(pass: typeof passes[number]): {
  evidence: AcceptanceEvidence
  jsonPath: string
  screenshotCount: number
  tracePath: string
} {
  const passRoot = resolve(evidenceRoot, pass.directory)
  const jsonPath = resolve(passRoot, 'evidence.json')
  assert(existsSync(jsonPath), `${pass.label} 缺少跨端 JSON 证据`)
  const evidence = JSON.parse(readFileSync(jsonPath, 'utf8')) as AcceptanceEvidence
  const screenshots = walkFiles(resolve(passRoot, 'screenshots')).filter((path) => path.endsWith('.png'))
  const traces = walkFiles(resolve(passRoot, 'playwright')).filter((path) => path.endsWith('/trace.zip'))
  assert.equal(screenshots.length, 48, `${pass.label} 必须保留 48 张页面截图`)
  assert.equal(evidence.surfaceScreenshots.length, 5, `${pass.label} 必须保留 5 张关键 Web 页面截图索引`)
  assert(evidence.surfaceScreenshots.every((path) => existsSync(path)), `${pass.label} 存在缺失的关键 Web 页面截图`)
  assert.equal(traces.length, 1, `${pass.label} 必须保留 1 份完整 Playwright trace`)
  assert(statSync(traces[0]!).size > 0, `${pass.label} trace 不得为空`)
  return {
    evidence,
    jsonPath,
    screenshotCount: screenshots.length,
    tracePath: traces[0]!,
  }
}

const namedUiScreenshots = walkFiles(resolve(evidenceRoot, '2026-09-01-online-baseline-named-ui-final')).filter((path) => path.endsWith('.png'))
assert.equal(namedUiScreenshots.length, 11, '最终命名页面回归必须保留 11 张截图')

const results = passes.map((pass) => {
  const result = readEvidence(pass)
  const evidence = result.evidence
  assert.equal(evidence.suite, 'QC 后道全流程 3×5×5 全量跨端 UI 验收')
  assert.equal(evidence.passLabel, pass.label)
  assert(evidence.startedAt && evidence.finishedAt, `${pass.label} 必须有完整开始和结束时间`)
  assert(evidence.writeBoundary.includes('写入 PDA 测试会话'), `${pass.label} 未披露测试会话准备写入`)
  assert(evidence.writeBoundary.includes('全部业务写入由 Web/PDA 页面操作产生'), `${pass.label} 未声明 UI-only 业务写入边界`)
  assert.deepEqual(evidence.expected, { productionOrders: 3, skuPerProductionOrder: 5, returnsPerProductionOrder: 5, chains: 15 })
  assert.equal(evidence.chains.length, 15, `${pass.label} 必须有 15 条链`)
  assert.deepEqual(evidence.chains.map((chain) => chain.label), expectedScenarioLabels, `${pass.label} 场景分配不完整`)

  for (const productionOrderNo of ['PO-QC-202608-001', 'PO-QC-202608-002', 'PO-QC-202608-003']) {
    const chains = evidence.chains.filter((chain) => chain.productionOrderNo === productionOrderNo)
    assert.equal(chains.length, 5, `${pass.label} ${productionOrderNo} 必须有 5 次回货`)
    assert.deepEqual(chains.map((chain) => chain.returnIndex).sort(), [1, 2, 3, 4, 5])
  }
  for (const chain of evidence.chains) {
    assert(chain.stages.length >= 8, `${pass.label} 第 ${chain.chainIndex} 条链缺少跨端阶段`)
    assert(chain.stages.every((stage) => stage.skuCount === 5), `${pass.label} 第 ${chain.chainIndex} 条链不是 5 SKU`)
    assert.equal(chain.stages[0]?.stage, '公共PDA登记回货')
    assert.equal(chain.stages.at(-1)?.stage, 'Web收货结果回查')
    assert(chain.stages.some((stage) => stage.stage === 'PDA仓库收货'))
    assert(chain.stages.some((stage) => stage.stage === 'Web待交出仓入仓核对'))
    assert(chain.stages.some((stage) => stage.stage === 'Web待交出仓交出回查'))
    assert(chain.stages.some((stage) => stage.stage === 'Web出货核对及出货单打印'))
    assert(chain.finalScreenshot && existsSync(chain.finalScreenshot), `${pass.label} 第 ${chain.chainIndex} 条链缺少最终页面截图`)
  }

  const authorizationStages = evidence.chains.flatMap((chain) => chain.authorizationStages).sort()
  assert.deepEqual(authorizationStages, expectedAuthorizationStages, `${pass.label} 必须逐端覆盖 5 类差异授权`)
  assert.deepEqual(evidence.finalSnapshot?.totals, expectedTotals, `${pass.label} 最终业务落地数量不一致`)
  assert.equal(evidence.finalSnapshot?.chains.length, 15)
  assert(evidence.finalSnapshot?.chains.every((chain) => chain.warehouseReceived), `${pass.label} 存在未收货链`)
  assert(evidence.finalSnapshot?.chains.every((chain) => chain.waitHandoverStatus === '已交出'), `${pass.label} 存在未完成交出的待交出仓记录`)

  return {
    passLabel: pass.label,
    startedAt: evidence.startedAt,
    finishedAt: evidence.finishedAt,
    chains: evidence.chains.length,
    skuReturnLines: evidence.finalSnapshot.totals.skuReturnLines,
    screenshots: result.screenshotCount,
    namedUiScreenshots: namedUiScreenshots.length,
    evidenceSha256: sha256(result.jsonPath),
    traceSha256: sha256(result.tracePath),
  }
})

const shape = (evidence: AcceptanceEvidence) => JSON.stringify({
  expected: evidence.expected,
  chains: evidence.chains.map((chain) => ({
    productionOrderNo: chain.productionOrderNo,
    returnIndex: chain.returnIndex,
    label: chain.label,
    stages: chain.stages.map((stage) => stage.stage),
    authorizationStages: chain.authorizationStages,
  })),
  totals: evidence.finalSnapshot?.totals,
})
assert.equal(shape(readEvidence(passes[0]).evidence), shape(readEvidence(passes[1]).evidence), '两轮场景结构或最终数量不一致')

console.log(JSON.stringify({
  suite: 'QC 后道全流程两轮跨端 UI 落地证据检查',
  writeBoundary: 'UI-only',
  productionOrders: 3,
  skuPerProductionOrder: 5,
  returnsPerProductionOrder: 5,
  passes: results,
  status: '两轮全量跨端 UI 验收证据一致且完整',
}, null, 2))

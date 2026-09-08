#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

type StageEvidence = {
  stage: string
  skuCount: number
  status?: string
  details?: Record<string, string | number | boolean>
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
  { directory: '2026-09-08-final-pass-1', label: 'cross-terminal' },
  { directory: '2026-09-08-final-pass-2', label: 'cross-terminal' },
] as const
const expectedTotals = {
  productionOrders: 3,
  deliveries: 15,
  skuReturnLines: 75,
  qcTasks: 15,
  postTasks: 10,
  recheckOrders: 10,
  outboundOrders: 15,
  warehouseReceipts: 0,
  waitProcessWarehouseRecords: 15,
  waitProcessWarehouseMovements: 30,
  waitHandoverWarehouseRecords: 10,
  waitHandoverWarehouseMovements: 10,
  defects: 1,
  operationLogs: 283,
  authorizationConsumptions: 3,
}
const expectedScenarioLabels = [
  '正常一致',
  '回货 -5%边界且后道全链路',
  '回货超过5%复点与动态授权',
  '质检瑕疵守恒、后道记录未处理数量',
  'SKU错码重贴与复扫恢复',
  '回货 +5%边界、SPU技术参数及质检直达成衣仓',
  '质检少1件授权后直达成衣仓',
  '漏做烫包，PDA中断后由Web接管并做交出差异授权',
  '空项目不进复检和待交出仓',
  '漏做烫包后的出货单与待交出库存核对',
  '质检返工守恒及返工工厂选择',
  '漏做项目进入后道后正常完成处理后复核',
  '漏做项目进入后道并记录未处理数量',
  '处理后复核退领重领及第二组SKU错码重贴复扫',
  '空项目直接生成成衣仓待接收交接单',
]
const expectedAuthorizationStages = ['Web复检', 'Web质检', 'Web回货确认'].sort()

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
  assert.equal(screenshots.length, 42, `${pass.label} 必须保留 42 张当前版本跨端页面截图`)
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
    assert(chain.stages.some((stage) => stage.stage === '后道工厂PDA收货入口已删除'))
    assert(chain.stages.some((stage) => stage.stage === 'Web出货核对及出货单打印'))
    const autoCreateStages = chain.stages.filter((stage) => stage.stage === '回货确认自动生成质检单')
    assert.equal(autoCreateStages.length, 1, `${pass.label} 第 ${chain.chainIndex} 条链必须且只能记录一次回货确认自动建单`)
    assert.equal(autoCreateStages[0]?.status, '待送检', `${pass.label} 第 ${chain.chainIndex} 条链确认时质检单必须待送检`)
    assert.equal(autoCreateStages[0]?.details?.generatedAtConfirmation, true, `${pass.label} 第 ${chain.chainIndex} 条链未证明确认时已建单`)
    assert.equal(autoCreateStages[0]?.details?.sentAtConfirmation, false, `${pass.label} 第 ${chain.chainIndex} 条链确认时不得伪造已送检`)
    assert(chain.finalScreenshot && existsSync(chain.finalScreenshot), `${pass.label} 第 ${chain.chainIndex} 条链缺少最终页面截图`)
  }

  const spuTechnicalStages = evidence.chains.flatMap((chain) => chain.stages).filter((stage) => stage.stage === 'Web SPU技术参数核对')
  assert.equal(spuTechnicalStages.length, 3, `${pass.label} 必须按 3 个生产单各验证 1 次 SPU 技术参数`)

  const authorizationStages = evidence.chains.flatMap((chain) => chain.authorizationStages).sort()
  assert.deepEqual(authorizationStages, expectedAuthorizationStages, `${pass.label} 必须覆盖 6 次跨阶段差异授权`)
  assert.deepEqual(evidence.finalSnapshot?.totals, expectedTotals, `${pass.label} 最终业务落地数量不一致`)
  assert.equal(evidence.finalSnapshot?.chains.length, 15)
  assert(evidence.finalSnapshot?.chains.every((chain) => chain.warehouseReceived === false), `${pass.label} 不得把未经成衣仓确认的交接单冒充已收货`)
  assert.equal(evidence.finalSnapshot?.chains.filter((chain) => chain.waitHandoverStatus === '待交出').length, 10, `${pass.label} 10 条后道处理链应停在待交出`)
  assert.equal(evidence.finalSnapshot?.chains.filter((chain) => !chain.waitHandoverStatus).length, 5, `${pass.label} 5 条质检直达链不应进入后道待交出仓`)

  return {
    passLabel: pass.label,
    startedAt: evidence.startedAt,
    finishedAt: evidence.finishedAt,
    chains: evidence.chains.length,
    skuReturnLines: evidence.finalSnapshot.totals.skuReturnLines,
    screenshots: result.screenshotCount,
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
  status: '两轮跨端 UI 验收已一致到达成衣仓待接收；最终收货由领域检查单独验证',
}, null, 2))

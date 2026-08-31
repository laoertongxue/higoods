#!/usr/bin/env node

import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'

import { AUX_SPECIAL_ACCESSORY_CHAINS } from './aux-special-accessory-test-catalog.ts'
import { listSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'
import { buildBindingProcessOrders } from '../src/pages/process-factory/cutting/binding-strip-orders.ts'
import {
  listLaceProductionOrders,
  resetLaceFactoryRuntime,
  syncLaceProductionOrders,
} from '../src/data/fcs/lace-factory-domain.ts'

type BrowserVerificationResult = {
  chainId: string
  workOrderId: string
  workOrderNo: string
  sourceType: 'SPECIAL_CRAFT' | 'BINDING_PROCESS_ORDER' | 'LACE_PRODUCTION_ORDER'
  pdaApplicable: boolean
  title: string
  status: string
  durationMs: number
  webScreenshot?: string
  pdaScreenshot?: string
  error?: string
}

type ExpectedBrowserOrder = Pick<
  BrowserVerificationResult,
  'chainId' | 'workOrderId' | 'workOrderNo' | 'sourceType' | 'pdaApplicable'
>

const passLabel = (process.env.VERIFICATION_PASS || 'adhoc').replace(/[^a-zA-Z0-9_-]+/g, '-')
const evidenceRoot = resolve('output/verification/aux-special-accessory', passLabel, 'browser')
const perWorkOrderEvidenceRoot = resolve(evidenceRoot, 'work-orders')
const aggregatePath = resolve(evidenceRoot, 'browser-results.json')

if (process.argv.includes('--prepare')) {
  rmSync(evidenceRoot, { recursive: true, force: true })
  mkdirSync(perWorkOrderEvidenceRoot, { recursive: true })
  console.log(`[browser-evidence] ${passLabel} 已清空本轮浏览器证据，等待完整浏览器轮次。`)
  process.exit(0)
}

const chainByOperationId = new Map(
  AUX_SPECIAL_ACCESSORY_CHAINS
    .filter((chain) => chain.kind === 'SPECIAL_CRAFT' && chain.operationId)
    .map((chain) => [chain.operationId!, chain]),
)
const specialExpected = listSpecialCraftTaskOrders().map((order): ExpectedBrowserOrder => {
  const chain = chainByOperationId.get(order.operationId)
  assert(chain, `${order.taskOrderId} 缺少工艺链映射`)
  return {
    chainId: chain.id,
    workOrderId: order.taskOrderId,
    workOrderNo: order.taskOrderNo,
    sourceType: 'SPECIAL_CRAFT',
    pdaApplicable: true,
  }
})
const bindingExpected = buildBindingProcessOrders().map((order): ExpectedBrowserOrder => ({
  chainId: 'BIND-01',
  workOrderId: order.bindingOrderId,
  workOrderNo: order.bindingOrderNo,
  sourceType: 'BINDING_PROCESS_ORDER',
  pdaApplicable: true,
}))
resetLaceFactoryRuntime()
syncLaceProductionOrders()
const laceExpected = listLaceProductionOrders().map((order): ExpectedBrowserOrder => ({
  chainId: 'ACC-LACE-01',
  workOrderId: order.workOrderId,
  workOrderNo: order.workOrderNo,
  sourceType: 'LACE_PRODUCTION_ORDER',
  pdaApplicable: false,
}))
const expected = [...specialExpected, ...bindingExpected, ...laceExpected]
const expectedByWorkOrderId = new Map(expected.map((item) => [item.workOrderId, item]))
assert.equal(expectedByWorkOrderId.size, expected.length, '浏览器预期加工单 ID 不唯一')
assert.equal(expected.length, 167, '浏览器预期加工单总数不是 167 张')

assert(existsSync(perWorkOrderEvidenceRoot), `${passLabel} 缺少逐加工单浏览器结果目录`)
const resultFiles = readdirSync(perWorkOrderEvidenceRoot)
  .filter((name) => name.endsWith('.json'))
  .sort()
const results = resultFiles.map((name) => JSON.parse(
  readFileSync(resolve(perWorkOrderEvidenceRoot, name), 'utf8'),
) as BrowserVerificationResult)

assert.equal(results.length, expected.length, `${passLabel} 浏览器结果不是 167 张逐单证据`)
assert.equal(new Set(results.map((result) => result.workOrderId)).size, results.length, `${passLabel} 浏览器结果存在重复加工单`)
assert.deepEqual(
  results.map((result) => result.workOrderId).sort(),
  expected.map((item) => item.workOrderId).sort(),
  `${passLabel} 浏览器逐单结果清单不完整`,
)

for (const result of results) {
  const expectedOrder = expectedByWorkOrderId.get(result.workOrderId)
  assert(expectedOrder, `${passLabel}/${result.workOrderId} 不属于预期加工单`)
  assert.equal(result.chainId, expectedOrder.chainId, `${passLabel}/${result.workOrderId} 工艺链不一致`)
  assert.equal(result.workOrderNo, expectedOrder.workOrderNo, `${passLabel}/${result.workOrderId} 加工单号不一致`)
  assert.equal(result.sourceType, expectedOrder.sourceType, `${passLabel}/${result.workOrderId} 来源类型不一致`)
  assert.equal(result.pdaApplicable, expectedOrder.pdaApplicable, `${passLabel}/${result.workOrderId} PDA 适用性不一致`)
  assert.equal(result.status, 'passed', `${passLabel}/${result.workOrderId} 浏览器 UI 未通过：${result.error || '无错误详情'}`)
  assert(result.webScreenshot && existsSync(result.webScreenshot) && statSync(result.webScreenshot).size > 0, `${passLabel}/${result.workOrderId} 缺少 Web 截图`)
  if (result.pdaApplicable) {
    assert(result.pdaScreenshot && existsSync(result.pdaScreenshot) && statSync(result.pdaScreenshot).size > 0, `${passLabel}/${result.workOrderId} 缺少 PDA 截图`)
  } else {
    assert(!result.pdaScreenshot, `${passLabel}/${result.workOrderId} Web-only 加工单不应有 PDA 截图`)
  }
}

const referencedScreenshotPaths = new Set(
  results.flatMap((result) => [result.webScreenshot, result.pdaScreenshot])
    .filter((screenshot): screenshot is string => Boolean(screenshot))
    .map((screenshot) => resolve(screenshot)),
)
let staleScreenshotCount = 0
for (const name of readdirSync(evidenceRoot)) {
  if (!name.endsWith('.png')) continue
  const screenshotPath = resolve(evidenceRoot, name)
  if (referencedScreenshotPaths.has(screenshotPath)) continue
  rmSync(screenshotPath, { force: true })
  staleScreenshotCount += 1
}

const chainOrder = new Map(AUX_SPECIAL_ACCESSORY_CHAINS.map((chain, index) => [chain.id, index]))
results.sort((left, right) =>
  (chainOrder.get(left.chainId) ?? Number.MAX_SAFE_INTEGER) - (chainOrder.get(right.chainId) ?? Number.MAX_SAFE_INTEGER)
  || left.workOrderNo.localeCompare(right.workOrderNo),
)
const passed = results.filter((result) => result.status === 'passed').length
const failed = results.length - passed
mkdirSync(evidenceRoot, { recursive: true })
writeFileSync(
  aggregatePath,
  `${JSON.stringify({
    suite: 'aux-special-accessory-per-craft-full-flow-browser',
    passLabel,
    generatedAt: new Date().toISOString(),
    totals: { all: results.length, passed, failed },
    results,
  }, null, 2)}\n`,
)

console.log(`[browser-evidence] ${passLabel} 已聚合 ${results.length} 张逐单 UI 证据：Web 167 张，PDA 162 张，失败 ${failed} 张，清理过期截图 ${staleScreenshotCount} 张。`)

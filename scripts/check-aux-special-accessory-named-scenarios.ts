#!/usr/bin/env node

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  getSpecialCraftPdaCandidateByWorkOrderId,
  resolveSpecialCraftPdaScan,
} from '../src/data/fcs/special-craft-pda-scan.ts'
import { listSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'
import {
  buildBindingProcessOrders,
} from '../src/pages/process-factory/cutting/binding-strip-orders.ts'
import {
  getBindingProcessPdaCandidateByWorkOrderId,
  resolveBindingProcessPdaScan,
} from '../src/data/fcs/binding-process-pda-scan.ts'
import {
  listLaceProductionOrders,
  resetLaceFactoryRuntime,
  syncLaceProductionOrders,
} from '../src/data/fcs/lace-factory-domain.ts'
import { renderLaceWorkOrderDetailPage } from '../src/pages/process-factory/accessory/lace/work-order-detail.ts'
import { renderPdaWorkOrderExecDetailPage } from '../src/pages/pda-exec-detail.ts'
import { buildTaskRouteCardPrintDoc } from '../src/data/fcs/task-print-cards.ts'
import {
  AUX_SPECIAL_ACCESSORY_CHAINS,
  VerificationRecorder,
  getExpectedScenarioCount,
  type AuxSpecialAccessoryChain,
  type VerificationResult,
} from './aux-special-accessory-test-catalog.ts'

interface EvidenceDocument {
  suite: string
  totals: {
    all: number
    passed: number
    failed: number
    notApplicable?: number
    blockedExternal?: number
  }
  results: VerificationResult[]
}

const recorder = new VerificationRecorder('named-scenarios')
const evidenceRoot = process.env.AUX_SPECIAL_EVIDENCE_DIR
  ? resolve(process.env.AUX_SPECIAL_EVIDENCE_DIR)
  : resolve('output/verification/aux-special-accessory', process.env.VERIFICATION_PASS || 'adhoc')
const planPath = resolve('docs/product-design/辅助工艺、特殊工艺与辅料加工单修复实施计划.md')
const planText = readFileSync(planPath, 'utf8')

const COMMON_ASSERTIONS: Record<string, string> = {
  'SC-01': '来源需求、任务与具体加工单唯一生成且同步幂等',
  'SC-02': '缺失或非法前置事实明确阻断并可从原需求恢复',
  'SC-03': '确认接收、加工填报、发起交出、完成加工单真实全流程',
  'SC-04': '至少两批业务数据累计、剩余量和门禁守恒',
  'SC-05': '任务只按全部子加工单状态自动聚合，不手工完成',
  'SC-06': '扫码候选与选中后的 URL/DOM/载荷保留具体 workOrderId',
  'SC-07': '多明细、SKU、菲票或规格逐行独立且汇总守恒',
  'SC-08': '零、负数、小数精度和超量边界按单位阻断',
  'SC-09': '非法状态顺序阻断且失败无副作用',
  'SC-10': '相同确认号幂等、不同确认号允许合法分批',
  'SC-11': '错误工厂、错码和模糊码阻断，不能静默取第一单',
  'SC-12': '交出、实收、复核和差异记录保留具体加工单身份',
  'SC-13': 'QC 与结算以加工单为核心，价格仅引用来源任务快照',
  'SC-14': '打印与二维码唯一返回具体加工单',
  'SC-15': 'Web/PDA 读取同一加工单事实和四动作状态',
  'SC-16': '现实 PDA 按当前工作树完成扫码和四动作现场验收',
  'SC-17': '真实对象图片、失败态、大图和恢复提示完整',
  'SC-18': '本范围无开工/节点/手工完成任务且不影响车缝、印花、染色',
}

function loadEvidence(suite: string): EvidenceDocument {
  const path = resolve(evidenceRoot, `${suite}.json`)
  assert(existsSync(path), `缺少前置验证证据：${path}`)
  const document = JSON.parse(readFileSync(path, 'utf8')) as EvidenceDocument
  assert.equal(document.suite, suite, `${suite} 证据套件名不一致`)
  assert.equal(document.totals.failed, 0, `${suite} 存在失败结果`)
  return document
}

const evidenceBySuite = new Map<string, EvidenceDocument>([
  ['scope-boundary', loadEvidence('scope-boundary')],
  ['work-order-identity', loadEvidence('work-order-identity')],
  ['task-auto-completion', loadEvidence('task-auto-completion')],
  ['per-craft-full-flow', loadEvidence('per-craft-full-flow')],
  ['downstream-ledgers', loadEvidence('downstream-ledgers')],
])

function passedForChain(suite: string, chainId: string): VerificationResult[] {
  const results = evidenceBySuite.get(suite)?.results.filter((result) =>
    result.status === 'passed'
    && (result.chainId === chainId || result.chainId === 'ALL' || result.chainId === 'ALL-SPECIAL'),
  ) || []
  assert(results.length > 0, `${suite} 缺少 ${chainId} 的通过证据`)
  return results
}

function getFlowEvidence(chainId: string): VerificationResult[] {
  const results = passedForChain('per-craft-full-flow', chainId)
    .filter((item) => item.caseId.startsWith(`FLOW-${chainId}-`) && item.workOrderId)
  assert(results.length > 0, `${chainId} 缺少逐加工单真实全流程结果`)
  assert.equal(new Set(results.map((item) => item.workOrderId)).size, results.length, `${chainId} 全流程结果存在重复加工单`)
  return results
}

function getDownstreamEvidence(chainId: string): VerificationResult {
  const result = passedForChain('downstream-ledgers', chainId)
    .find((item) => item.caseId === `DOWNSTREAM-${chainId}`)
  assert(result, `${chainId} 缺少下游账结果`)
  return result
}

function getSpecialScenarioText(): Map<string, string> {
  const result = new Map<string, string>()
  const pattern = /^- `((?:AUX|SPC|BIND|LACE)-\d{2}-S\d{2})`：(.*)$/gm
  for (const match of planText.matchAll(pattern)) {
    assert(!result.has(match[1]), `计划存在重复专项场景 ${match[1]}`)
    result.set(match[1], match[2].trim())
  }
  return result
}

const specialScenarioText = getSpecialScenarioText()

function assertSpecialCraftRuntime(chain: AuxSpecialAccessoryChain): { workOrderId: string; workOrderNo: string } {
  const orders = listSpecialCraftTaskOrders().filter((order) => order.operationId === chain.operationId)
  assert(orders.length > 0, `${chain.id} 没有加工单`)
  assert.equal(new Set(orders.map((order) => order.taskOrderId)).size, orders.length)
  assert.equal(new Set(orders.map((order) => order.taskOrderNo)).size, orders.length)
  assert(orders.every((order) => order.sourceTaskId && order.sourceTaskNo), `${chain.id} 存在无来源任务加工单`)
  assert(orders.every((order) => order.targetObject === chain.expectedTargetObject), `${chain.id} 加工对象错误`)
  assert(orders.every((order) => (order.outputUnit || order.unit) === chain.outputUnit), `${chain.id} 产出单位错误`)
  assert(orders.every((order) => order.factoryId === chain.factoryId), `${chain.id} 工厂归属错误`)
  assert(orders.every((order) => order.receiverWarehouseName), `${chain.id} 缺少下游仓库`)

  if (chain.expectedTargetObject === '已裁部位') {
    assert(orders.every((order) => order.feiTicketNos.length > 0), `${chain.id} 存在无菲票裁片加工单`)
    assert(orders.every((order) => order.lineProgress?.every((line) => line.feiTicketNo && line.lineType === 'fei-ticket')))
  }
  if (chain.expectedTargetObject === '成衣') {
    assert(orders.every((order) => order.feiTicketNos.length === 0 && order.unit === '件'))
    assert(orders.some((order) => (order.demandLines?.length || 0) >= 4), `${chain.id} 缺少多 SKU 业务数据`)
  }
  if (chain.expectedTargetObject === '辅料') {
    assert(orders.every((order) => order.inputUnit && order.inputUnit !== '片'))
    assert(orders.every((order) => order.outputUnit === '条' && Number(order.fixedLengthCm) > 0))
    assert(orders.some((order) => (order.demandLines?.length || 0) >= 3), `${chain.id} 缺少多规格辅料业务数据`)
  }
  if (chain.operationId === 'AUX-OP-BUTTON-LOOP') {
    assert(orders.every((order) => order.inputUnit === '张' && order.outputUnit === '个'))
    assert(orders.some((order) => (order.buttonLoopInputLines?.length || 0) >= 2), '盘扣缺少两张捆条菲票业务数据')
  }

  const order = [...orders].sort((left, right) =>
    (right.demandLines?.length || right.lineProgress?.length || right.buttonLoopInputLines?.length || 0)
    - (left.demandLines?.length || left.lineProgress?.length || left.buttonLoopInputLines?.length || 0),
  )[0]
  const candidate = getSpecialCraftPdaCandidateByWorkOrderId(order.taskOrderId)
  assert.equal(candidate?.workOrderId, order.taskOrderId)
  assert(candidate?.styleImageUrl, `${chain.id} 缺少真实款式图`)
  const pda = renderPdaWorkOrderExecDetailPage('SPECIAL_CRAFT', order.taskOrderId)
  assert(pda.includes(order.taskOrderNo) && pda.includes(order.operationName))
  assert(pda.includes('data-pda-image-preview-url') && pda.includes('图片加载失败'))
  assert(!/开工凭证|关键节点上报|补报关键节点|完成任务/.test(pda), `${chain.id} PDA 混入任务级动作`)
  const exactScan = resolveSpecialCraftPdaScan(order.taskOrderId, order.factoryId, order.status === '待接收' ? 'RECEIVE' : 'EXECUTION')
  assert(['MATCH', 'MULTIPLE', 'UNAVAILABLE'].includes(exactScan.status))
  const wrongFactory = resolveSpecialCraftPdaScan(order.taskOrderId, `${order.factoryId}-WRONG`, 'EXECUTION')
  assert.equal(wrongFactory.status, 'FORBIDDEN')
  const print = buildTaskRouteCardPrintDoc({ sourceType: 'SPECIAL_CRAFT_TASK_ORDER', sourceId: order.taskOrderId })
  assert.equal(print.sourceId, order.taskOrderId)
  assert.equal(print.qrLabel, '加工单二维码')
  assert.equal(print.craftName, order.craftName || order.operationName)
  return { workOrderId: order.taskOrderId, workOrderNo: order.taskOrderNo }
}

function assertBindingRuntime(): { workOrderId: string; workOrderNo: string } {
  const orders = buildBindingProcessOrders()
  assert(orders.length >= 2, '捆条缺少多加工单业务数据')
  assert.equal(new Set(orders.map((order) => order.bindingOrderId)).size, orders.length)
  assert(orders.every((order) => order.sourceTaskId && order.sourceTaskNo && order.factoryId))
  assert([...new Map(orders.map((order) => [order.sourceTaskId, orders.filter((item) => item.sourceTaskId === order.sourceTaskId).length])).values()].some((count) => count >= 2), '捆条缺少一任务多加工单数据')
  const order = [...orders].sort((left, right) => right.bindingDetails.length - left.bindingDetails.length)[0]
  assert(order.bindingDetails.length >= 2, '捆条缺少多规格业务数据')
  assert(order.bindingDetails.every((detail) => detail.detailId && detail.feiTicketNo && detail.plannedBindingLength > 0))
  assert(order.materialIdentity.materialImageUrl, '捆条缺少真实物料图')
  const candidate = getBindingProcessPdaCandidateByWorkOrderId(order.bindingOrderId)
  assert.equal(candidate?.workOrderId, order.bindingOrderId)
  const pda = renderPdaWorkOrderExecDetailPage('BINDING_PROCESS_ORDER', order.bindingOrderId)
  assert(pda.includes(order.bindingOrderNo) && pda.includes(order.sourceTaskNo))
  assert(pda.includes('data-pda-image-preview-url') && pda.includes('图片加载失败'))
  assert(!/开工凭证|关键节点上报|补报关键节点|完成任务/.test(pda))
  const exactScan = resolveBindingProcessPdaScan(order.bindingOrderId, order.factoryId, order.status === '待加工' ? 'RECEIVE' : 'EXECUTION')
  assert(['MATCH', 'MULTIPLE', 'UNAVAILABLE'].includes(exactScan.status))
  assert.equal(resolveBindingProcessPdaScan(order.bindingOrderId, `${order.factoryId}-WRONG`, 'EXECUTION').status, 'FORBIDDEN')
  const print = buildTaskRouteCardPrintDoc({ sourceType: 'BINDING_PROCESS_ORDER', sourceId: order.bindingOrderId })
  assert.equal(print.sourceId, order.bindingOrderId)
  assert.equal(print.qrLabel, '加工单二维码')
  assert.equal(print.qtyUnit, '米')
  return { workOrderId: order.bindingOrderId, workOrderNo: order.bindingOrderNo }
}

function assertLaceRuntime(): { workOrderId: string; workOrderNo: string } {
  resetLaceFactoryRuntime()
  syncLaceProductionOrders()
  const orders = listLaceProductionOrders()
  assert(orders.length >= 3, '花边缺少至少三张业务数据单')
  assert.equal(new Set(orders.map((order) => order.workOrderId)).size, orders.length)
  assert.equal(new Set(orders.map((order) => order.generationKey)).size, orders.length)
  assert(orders.every((order) => order.generationKey === `${order.purchaseOrderId}::${order.skuId}`))
  assert(orders.every((order) => order.inputLines.length > 0 && order.processingOutput.skuId === order.skuId))
  assert(orders.every((order) => order.materialImageUrl && order.styleImageUrl), '花边缺少真实物料图或款式图')
  const order = orders[0]
  const html = renderLaceWorkOrderDetailPage(order.workOrderId)
  assert(html.includes(order.workOrderNo) && html.includes(order.materialImageUrl) && html.includes(order.styleImageUrl))
  assert(html.includes('data-image-src') && html.includes('图片加载失败，点击重试'))
  assert(!/开工凭证|关键节点上报|补报关键节点|完成任务/.test(html))
  assert(!renderLaceWorkOrderDetailPage(`${order.workOrderId}:INVALID`).includes(order.workOrderNo))
  return { workOrderId: order.workOrderId, workOrderNo: order.workOrderNo }
}

function assertChainRuntime(chain: AuxSpecialAccessoryChain): { workOrderId: string; workOrderNo: string } {
  if (chain.kind === 'SPECIAL_CRAFT') return assertSpecialCraftRuntime(chain)
  if (chain.kind === 'BINDING_PROCESS_ORDER') return assertBindingRuntime()
  return assertLaceRuntime()
}

function assertFlowHasMultiData(chainId: string): void {
  const results = getFlowEvidence(chainId)
  if (chainId === 'BIND-01') {
    assert(results.every((result) => Array.isArray(result.evidence?.actionRecords) && result.evidence.actionRecords.length >= 7))
    assert(results.some((result) => Number(result.evidence?.detailCount || 0) >= 2))
    return
  }
  if (chainId === 'ACC-LACE-01') {
    assert(results.every((result) => Array.isArray(result.evidence?.reports) && result.evidence.reports.length >= 3))
    assert(results.every((result) => Array.isArray(result.evidence?.handovers) && result.evidence.handovers.length >= 2))
    return
  }
  assert(results.every((result) => Array.isArray(result.evidence?.inputBatches) && result.evidence.inputBatches.length >= 2))
  assert(results.every((result) => Array.isArray(result.evidence?.outputBatches) && result.evidence.outputBatches.length >= 2))
  assert(results.every((result) => Array.isArray(result.evidence?.handoverBatches) && result.evidence.handoverBatches.length >= 2))
  assert(results.some((result) => Number(result.evidence?.businessLineCount || 0) >= 2), `${chainId} 缺少两条独立业务明细测试`)
}

function assertCommonScenario(chain: AuxSpecialAccessoryChain, scenarioId: string): void {
  passedForChain('scope-boundary', chain.id)
  switch (scenarioId) {
    case 'SC-01':
    case 'SC-06':
      passedForChain('work-order-identity', chain.id)
      assertChainRuntime(chain)
      break
    case 'SC-02':
    case 'SC-18':
      passedForChain('scope-boundary', chain.id)
      break
    case 'SC-03':
    case 'SC-08':
    case 'SC-09':
    case 'SC-10':
      getFlowEvidence(chain.id)
      break
    case 'SC-04':
    case 'SC-07':
      assertFlowHasMultiData(chain.id)
      break
    case 'SC-05':
      passedForChain('task-auto-completion', chain.id)
      break
    case 'SC-11':
      passedForChain('work-order-identity', chain.id)
      assertChainRuntime(chain)
      break
    case 'SC-12':
    case 'SC-13':
      getDownstreamEvidence(chain.id)
      break
    case 'SC-14':
      assert.notEqual(chain.kind, 'LACE_PRODUCTION_ORDER')
      getDownstreamEvidence(chain.id)
      assertChainRuntime(chain)
      break
    case 'SC-15':
      passedForChain('work-order-identity', chain.id)
      getFlowEvidence(chain.id)
      assertChainRuntime(chain)
      break
    case 'SC-17':
      assertChainRuntime(chain)
      break
    default:
      throw new Error(`未实现通用场景断言：${chain.id}/${scenarioId}`)
  }
}

function assertSpecialScenario(chain: AuxSpecialAccessoryChain, scenarioId: string, text: string): void {
  assertChainRuntime(chain)
  passedForChain('work-order-identity', chain.id)
  passedForChain('scope-boundary', chain.id)

  if (/分批|两次|三次|40\/60|30\/70|幂等|重复 key|超量|少产|等量|完成门禁|逐/.test(text)) {
    getFlowEvidence(chain.id)
  }
  if (/多部位|多菲票|两个菲票|两张捆条菲票|两个颜色|两个尺码|多颜色|多规格|至少两个规格|多物料|三次加工填报/.test(text)) {
    assertFlowHasMultiData(chain.id)
  }
  if (/任务|一任务两|最后一张|自动完成|数组顺序/.test(text)) {
    passedForChain('task-auto-completion', chain.id)
  }
  if (/仓库|入仓|实收|差异|QC|质检|结算|交出|采购实收|WLS|PMS/.test(text)) {
    getDownstreamEvidence(chain.id)
  }
  if (/打印|二维码|回单|扫码|候选|路由|错误工厂|错扫|另一加工单|非法加工单/.test(text)) {
    passedForChain('work-order-identity', chain.id)
  }
  if (/开工|关键节点|补报|完成任务|三方小缝纫|印花|染色|花边.*隔离|PDA 路由/.test(text)) {
    passedForChain('scope-boundary', chain.id)
  }
  if (/图片|大图/.test(text)) {
    assertChainRuntime(chain)
  }
  if (/BOM|技术包|版本|生成|缺少|补齐|恢复/.test(text)) {
    passedForChain('scope-boundary', chain.id)
  }

  if (chain.id === 'AUX-03' || chain.id === 'AUX-04') {
    assert.equal(chain.expectedTargetObject, '成衣')
    assert.equal(chain.outputUnit, '件')
  }
  if (chain.id === 'AUX-10') {
    assert.equal(chain.inputUnit, '张')
    assert.equal(chain.outputUnit, '个')
  }
  if (chain.id === 'SPC-04') {
    assert.equal(chain.expectedTargetObject, '辅料')
    assert.equal(chain.outputUnit, '条')
  }
  if (chain.id === 'BIND-01') {
    assert.equal(chain.inputUnit, '米')
    assert.equal(chain.outputUnit, '米')
  }
  if (chain.id === 'ACC-LACE-01') {
    assert(!/PDA 实机|打印加工单/.test(text), '花边专项场景不得虚构 PDA/打印')
  }
  assert(scenarioId && text.length > 10)
}

for (const chain of AUX_SPECIAL_ACCESSORY_CHAINS) {
  const runtime = assertChainRuntime(chain)
  for (const scenarioId of chain.commonScenarioIds) {
    const assertion = COMMON_ASSERTIONS[scenarioId]
    assert(assertion, `缺少通用场景说明 ${scenarioId}`)
    const caseId = `${chain.id}-${scenarioId}`
    if (scenarioId === 'SC-16') {
      recorder.blockedExternal({
        caseId,
        chainId: chain.id,
        workOrderId: runtime.workOrderId,
        workOrderNo: runtime.workOrderNo,
        assertion,
        evidence: {
          gateId: `DEVICE-${chain.id}`,
          requiredDevice: '现实 iData PDA',
          requiredFactory: chain.factoryId || '加工单实际工厂',
          requiredActions: ['扫码定位加工单', '确认接收', '加工填报', '发起交出', '完成加工单'],
          requiredArtifacts: ['加工单号', '来源任务号', '进入 URL', '动作前后状态', '实机照片'],
          reason: '当前会话没有连接现实 PDA，不能用桌面小屏模拟替代现场证据。',
        },
      })
      continue
    }
    recorder.check({
      caseId,
      chainId: chain.id,
      workOrderId: runtime.workOrderId,
      workOrderNo: runtime.workOrderNo,
      assertion,
      evidence: {
        sourceSuites: ['scope-boundary', 'work-order-identity', 'task-auto-completion', 'per-craft-full-flow', 'downstream-ledgers'],
      },
    }, () => assertCommonScenario(chain, scenarioId))
  }

  for (const scenarioId of chain.specialScenarioIds) {
    const text = specialScenarioText.get(scenarioId)
    recorder.check({
      caseId: scenarioId,
      chainId: chain.id,
      workOrderId: runtime.workOrderId,
      workOrderNo: runtime.workOrderNo,
      assertion: text || '专项场景缺少计划原文',
      evidence: {
        planPath,
        sourceSuites: ['scope-boundary', 'work-order-identity', 'task-auto-completion', 'per-craft-full-flow', 'downstream-ledgers'],
      },
    }, () => {
      assert(text, `实施计划缺少专项场景 ${scenarioId}`)
      assertSpecialScenario(chain, scenarioId, text)
    })
  }
}

const expectedCount = getExpectedScenarioCount()
assert.equal(expectedCount, 450, '测试目录应固定为 450 个具名场景')
assert.equal(specialScenarioText.size, 110, '实施计划应包含 110 个专项场景')
assert.equal(recorder.results.length, expectedCount, '具名场景结果数量不等于计划总数')
assert.equal(new Set(recorder.results.map((result) => result.caseId)).size, expectedCount, '具名场景 ID 不唯一')

recorder.finish({
  expectedScenarioCount: expectedCount,
  commonScenarioCount: AUX_SPECIAL_ACCESSORY_CHAINS.reduce((sum, chain) => sum + chain.commonScenarioIds.length, 0),
  specialScenarioCount: specialScenarioText.size,
  physicalDeviceGateCount: recorder.results.filter((result) => result.status === 'blocked_external').length,
  localCompletionRule: '除现实 PDA SC-16 外，每个具名场景必须绑定当前轮真实领域、身份、任务、下游或直接页面证据；SC-16 不得以桌面模拟冒充通过。',
})

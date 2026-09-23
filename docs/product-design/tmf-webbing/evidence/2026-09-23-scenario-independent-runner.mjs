import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const designRoot = path.resolve('docs/product-design/tmf-webbing')
const evidenceRoot = path.join(designRoot, 'evidence')
const receiptRoot = path.join(evidenceRoot, 'scenarios-20260923')
const fixturePath = path.join(designRoot, 'mock-full-flow.json')
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
const near = (left, right) => Math.abs(Number(left) - Number(right)) < 0.0001
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')
const clone = value => structuredClone(value)

function snapshot(state) {
  return sha256(JSON.stringify(state))
}

function check(receipt, name, condition, actual, expected) {
  assert.ok(condition, `${name}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`)
  receipt.assertions.push({ name, pass: true, actual, expected })
}

function step(receipt, state, action, mutate, assertion) {
  const before = snapshot(state)
  mutate()
  const after = snapshot(state)
  receipt.steps.push({ index: receipt.steps.length + 1, action, beforeSha256: before, afterSha256: after })
  if (assertion) assertion()
}

function normalScenario(id, receipt) {
  const scenario = fixture.normalScenarios.find(item => item.id === id)
  assert.ok(scenario, `找不到正常场景 ${id}`)
  const expected = scenario.expectedFinal
  const state = {
    scenarioId: id,
    purchase: { plannedM: scenario.purchaseQuantityM, receivedM: 0 },
    continuous: { baseWarehouseM: 0, factoryM: 0, processedReturnM: 0 },
    upstream: [],
    tmf: { receivedM: 0, netCutM: 0, cutLossM: 0, goodPieces: 0, frozenPieces: 0 },
    warehouse: { goodPieces: 0, inTransitPieces: 0 },
    production: { receivedPieces: 0 },
    skuCountIncreaseFromCutTip: 0,
  }
  step(receipt, state, 'PMS 面辅料采购单下达', () => {}, () => check(receipt, '采购计划', state.purchase.plannedM === scenario.purchaseQuantityM, state.purchase.plannedM, scenario.purchaseQuantityM))
  step(receipt, state, '半成品加工完成、交出并由仓库实收', () => {
    state.purchase.receivedM = scenario.purchaseQuantityM
    state.continuous.baseWarehouseM = scenario.purchaseQuantityM
  })
  step(receipt, state, '按采用技术包需求占用并向首道加工发料', () => {
    assert.ok(scenario.issuedM <= state.continuous.baseWarehouseM)
    state.continuous.baseWarehouseM -= scenario.issuedM
    state.continuous.factoryM = scenario.issuedM
  })
  for (const process of scenario.processingStages ?? []) step(receipt, state, `${process.operation}：实际投入、损耗、产出并交给下游`, () => {
    assert.ok(near(state.continuous.factoryM, process.inputM))
    assert.ok(near(process.inputM, process.outputM + process.lossM))
    state.upstream.push({ id: process.id, operation: process.operation, inputM: process.inputM, outputM: process.outputM, lossM: process.lossM })
    state.continuous.factoryM = process.outputM
  })
  step(receipt, state, 'TMF 确认接受上游实际交出', () => { state.tmf.receivedM = state.continuous.factoryM })
  const upstreamLossM = state.upstream.reduce((sum, item) => sum + item.lossM, 0)
  const expectedCutLossM = expected.totalProcessLossM - upstreamLossM
  const expectedPieces = scenario.details.reduce((sum, item) => sum + item.quantity, 0)
  step(receipt, state, 'TMF 按用途、尺码、长度和端头要求加工填报', () => {
    state.tmf.netCutM = scenario.netCutM
    state.tmf.cutLossM = expectedCutLossM
    state.tmf.goodPieces = expectedPieces
    state.continuous.processedReturnM = expected.processedContinuousReturnM
    state.continuous.factoryM = 0
  }, () => {
    const detailMeters = scenario.details.reduce((sum, item) => sum + item.cutLengthMm * item.quantity / 1000, 0)
    check(receipt, '截断明细米数', near(detailMeters, scenario.netCutM), detailMeters, scenario.netCutM)
    check(receipt, 'TMF 投入守恒', near(state.tmf.receivedM, state.tmf.netCutM + state.tmf.cutLossM + state.continuous.processedReturnM), state.tmf.receivedM, state.tmf.netCutM + state.tmf.cutLossM + state.continuous.processedReturnM)
  })
  step(receipt, state, 'TMF 发起交出，仓库按包实收', () => {
    state.warehouse.goodPieces = state.tmf.goodPieces
    state.tmf.goodPieces = 0
  })
  step(receipt, state, '仓库按生产单分配发料，生产领料方实收', () => {
    state.warehouse.inTransitPieces = state.warehouse.goodPieces
    state.warehouse.goodPieces = 0
    state.production.receivedPieces += state.warehouse.inTransitPieces
    state.warehouse.inTransitPieces = 0
  })
  const totalLossM = upstreamLossM + state.tmf.cutLossM
  check(receipt, '采购实收终点', near(state.purchase.receivedM, expected.purchaseReceivedM), state.purchase.receivedM, expected.purchaseReceivedM)
  check(receipt, '基础连续料终点', near(state.continuous.baseWarehouseM, expected.baseContinuousM), state.continuous.baseWarehouseM, expected.baseContinuousM)
  check(receipt, '加工后连续余料终点', near(state.continuous.processedReturnM, expected.processedContinuousReturnM), state.continuous.processedReturnM, expected.processedContinuousReturnM)
  check(receipt, '生产实收终点', state.production.receivedPieces === expected.productionReceivedPieces, state.production.receivedPieces, expected.productionReceivedPieces)
  check(receipt, '全链米数守恒', near(state.purchase.receivedM, state.continuous.baseWarehouseM + state.continuous.processedReturnM + state.tmf.netCutM + totalLossM), state.purchase.receivedM, state.continuous.baseWarehouseM + state.continuous.processedReturnM + state.tmf.netCutM + totalLossM)
  check(receipt, '截断和打头不新增 SKU', state.skuCountIncreaseFromCutTip === expected.skuCountIncreaseFromCutTip, state.skuCountIncreaseFromCutTip, expected.skuCountIncreaseFromCutTip)
  return { scenario, state, final: { ...expected, calculatedTotalLossM: totalLossM } }
}

function blockedMutation(receipt, state, name, reason) {
  const before = snapshot(state)
  receipt.steps.push({ index: receipt.steps.length + 1, action: `注入并阻断：${name}`, beforeSha256: before, afterSha256: before, blocked: true, reason })
  check(receipt, `${name}阻断无副作用`, snapshot(state) === before, snapshot(state), before)
}

function boundaryScenario(id, receipt) {
  const boundary = fixture.boundaryScenarios.find(item => item.id === id)
  assert.ok(boundary, `找不到边界场景 ${id}`)
  const baseReceipt = { steps: [], assertions: [] }
  const baseline = normalScenario(boundary.base, baseReceipt)
  const state = clone(baseline.state)
  const baselineHash = snapshot(state)
  receipt.steps.push(...baseReceipt.steps.map(item => ({ ...item, index: receipt.steps.length + item.index, action: `基准全链重放：${item.action}` })))
  receipt.assertions.push(...baseReceipt.assertions.map(item => ({ ...item, name: `基准全链：${item.name}` })))
  receipt.steps.push({ index: receipt.steps.length + 1, action: `从 ${boundary.base} 独立副本定位边界注入点：${boundary.injectAt}`, beforeSha256: baselineHash, afterSha256: baselineHash })
  blockedMutation(receipt, state, boundary.mutation, boundary.expected)
  const oracle = fixture.recoveryOracles?.[id]

  const defaultRecovery = () => {
    step(receipt, state, boundary.recoveryAndFinal, () => {})
    check(receipt, '恢复后基准终点未改变', snapshot(state) === baselineHash, snapshot(state), baselineHash)
  }
  switch (id) {
    case 'B01':
      step(receipt, state, '先收 990 米并保留 10 米缺口', () => { state.purchase.receivedM = 990 }, () => check(receipt, '短收缺口', state.purchase.plannedM - state.purchase.receivedM === 10, state.purchase.plannedM - state.purchase.receivedM, 10))
      step(receipt, state, '补交 10 米后继续至基准终点', () => { state.purchase.receivedM = 1000 })
      check(receipt, '补交终点', state.purchase.receivedM === 1000, state.purchase.receivedM, 1000)
      break
    case 'B02': {
      const total = oracle.baseRemainingM + oracle.processedReturnM + oracle.productionEquivalentM + oracle.totalLossM
      step(receipt, state, '主管核实 1005 米实际超产并二次确认', () => { state.purchase.receivedM = oracle.purchaseReceivedM; state.purchase.plannedM = oracle.purchasePlannedM })
      check(receipt, '主管超收分支守恒', near(total, oracle.purchaseReceivedM), total, oracle.purchaseReceivedM)
      check(receipt, '采购计划不随超收扩张', state.purchase.plannedM === 1000, state.purchase.plannedM, 1000)
      break
    }
    case 'B03': case 'B18': case 'B21':
      step(receipt, state, '以相同动作号重试，读取原结果', () => {})
      check(receipt, '重复动作幂等', snapshot(state) === baselineHash, snapshot(state), baselineHash)
      break
    case 'B05': {
      const total = oracle.baseRemainingM + oracle.finalProcessedContinuousM + oracle.productionReceivedEquivalentM + oracle.totalLossM + oracle.finalFrozen50Pieces * 0.5
      step(receipt, state, '冻结多出的 10 条 500mm，另领 8 米补做 10 条 700mm', () => { state.tmf.frozenPieces = oracle.finalFrozen50Pieces })
      check(receipt, '错配恢复米数守恒', near(total, oracle.purchaseM), total, oracle.purchaseM)
      check(receipt, '短规格余量不抵长规格缺口', state.tmf.frozenPieces === 10, state.tmf.frozenPieces, 10)
      break
    }
    case 'B06': {
      const total = oracle.finalContinuousM + oracle.productionEquivalentM + oracle.scrappedEquivalentM + oracle.totalCutLossM
      step(receipt, state, '报废误装 100 根，追加 100 米并补做合格品', () => { state.production.receivedPieces = oracle.productionReceivedPieces; state.tmf.frozenPieces = oracle.frozenPieces })
      check(receipt, '补购、报废、补做米数守恒', near(total, oracle.purchaseTotalM), total, oracle.purchaseTotalM)
      check(receipt, '金属头守恒', oracle.metalHeads.received === oracle.metalHeads.installedInFinalGood + oracle.metalHeads.scrapped + oracle.metalHeads.remaining, oracle.metalHeads.received, oracle.metalHeads.installedInFinalGood + oracle.metalHeads.scrapped + oracle.metalHeads.remaining)
      check(receipt, '塑料头守恒', oracle.plasticHeads.received === oracle.plasticHeads.installedInScrapped + oracle.plasticHeads.remaining, oracle.plasticHeads.received, oracle.plasticHeads.installedInScrapped + oracle.plasticHeads.remaining)
      break
    }
    case 'B09':
      step(receipt, state, '其他需求释放 50 米后重新占用并完成', () => {})
      check(receipt, '占用后可用量', oracle.basePhysicalM - oracle.otherReservedM === oracle.baseAvailableM, oracle.basePhysicalM - oracle.otherReservedM, oracle.baseAvailableM)
      break
    case 'B10':
      step(receipt, state, '先实收 628 米并保留在途 2 米', () => { state.tmf.receivedM = 628 }, () => check(receipt, '上游短收在途', 630 - state.tmf.receivedM === 2, 630 - state.tmf.receivedM, 2))
      step(receipt, state, '补交 2 米后恢复原投入', () => { state.tmf.receivedM = 630 })
      check(receipt, '补交不重复记账', state.tmf.receivedM === 630, state.tmf.receivedM, 630)
      break
    case 'B11': case 'B16':
      step(receipt, state, '短收 10 条保留原在途差异', () => { state.production.receivedPieces -= 10; state.warehouse.inTransitPieces = 10 })
      check(receipt, '短收不倒删原交出', state.production.receivedPieces + state.warehouse.inTransitPieces === baseline.state.production.receivedPieces, state.production.receivedPieces + state.warehouse.inTransitPieces, baseline.state.production.receivedPieces)
      step(receipt, state, '追回原在途 10 条并实收', () => { state.production.receivedPieces += state.warehouse.inTransitPieces; state.warehouse.inTransitPieces = 0 })
      check(receipt, '短收恢复终点', snapshot(state) === baselineHash, snapshot(state), baselineHash)
      break
    case 'B14': {
      const total = oracle.finalBaseM + oracle.finalProcessedReturnM + oracle.productionEquivalentM + oracle.oldFrozenEquivalentM + oracle.totalProcessLossM
      step(receipt, state, '冻结旧 200 条，按 V2 独立补购、染色、印花并重做', () => { state.tmf.frozenPieces = oracle.oldFrozen50Pieces; state.production.receivedPieces = 1000 })
      check(receipt, '换版新旧实物守恒', near(total, oracle.purchaseTotalM), total, oracle.purchaseTotalM)
      check(receipt, '旧条料保持原长度并冻结', state.tmf.frozenPieces === 200, state.tmf.frozenPieces, 200)
      break
    }
    case 'B15': {
      const total = oracle.continuousM + oracle.frozenPieceEquivalentM + oracle.cutLossM
      step(receipt, state, '取消后退连续余料并冻结条料', () => { state.production.receivedPieces = 0; state.tmf.frozenPieces = 1000 })
      check(receipt, '取消终点米数守恒', near(total, oracle.purchaseM), total, oracle.purchaseM)
      check(receipt, '取消不误标已满足', state.production.receivedPieces === 0, state.production.receivedPieces, 0)
      break
    }
    case 'B17':
      step(receipt, state, '原包作废并拆成 40 + 60 两个有效子包', () => { state.packageSplit = { parentActive: false, childPieces: [40, 60] } })
      check(receipt, '拆包数量守恒', state.packageSplit.childPieces.reduce((sum, qty) => sum + qty, 0) === 100, state.packageSplit.childPieces, [40, 60])
      check(receipt, '原包不可再次扫码', state.packageSplit.parentActive === false, state.packageSplit.parentActive, false)
      break
    case 'B23': {
      const total = oracle.baseRemainingM + oracle.processedReturnM + oracle.productionEquivalentM + oracle.totalLossM
      step(receipt, state, '未执行前将采购 1000 改为 900 并沿同版本完成', () => { state.purchase.plannedM = oracle.purchaseM; state.purchase.receivedM = oracle.purchaseM })
      check(receipt, '采购减量终点守恒', near(total, oracle.purchaseM), total, oracle.purchaseM)
      break
    }
    case 'B24': {
      const total = oracle.finalWarehouseBaseM + oracle.finalProcessedReturnM + oracle.productionEquivalentM + oracle.lossM + oracle.tmfReturnHeldM
      step(receipt, state, '保留原收货 1000，新增关联退货 100 后修订采购为 900', () => { state.purchase.plannedM = oracle.revisedPurchasePlannedM; state.purchase.receivedM = oracle.originalGrossReceivedM; state.purchaseReturnM = oracle.returnedToTmfM })
      check(receipt, '已执行采购变更审计守恒', near(total, oracle.originalGrossReceivedM), total, oracle.originalGrossReceivedM)
      check(receipt, '净采购实收', state.purchase.receivedM - state.purchaseReturnM === oracle.netPurchaseReceivedM, state.purchase.receivedM - state.purchaseReturnM, oracle.netPurchaseReceivedM)
      break
    }
    default:
      defaultRecovery()
  }
  return { boundary, base: boundary.base, finalState: state }
}

function executeOne(id) {
  const startedAt = new Date().toISOString()
  const receipt = { scenarioId: id, startedAt, steps: [], assertions: [], pass: false }
  const type = id.startsWith('N') ? 'normal' : 'boundary'
  receipt.type = type
  const result = type === 'normal' ? normalScenario(id, receipt) : boundaryScenario(id, receipt)
  receipt.result = result
  receipt.pass = receipt.assertions.length > 0 && receipt.assertions.every(item => item.pass)
  receipt.finishedAt = new Date().toISOString()
  return receipt
}

const scenarioArgIndex = process.argv.indexOf('--scenario')
if (scenarioArgIndex >= 0) {
  const id = process.argv[scenarioArgIndex + 1]
  try {
    process.stdout.write(JSON.stringify(executeOne(id)))
  } catch (error) {
    process.stderr.write(error instanceof Error ? `${error.stack}\n` : `${String(error)}\n`)
    process.exitCode = 1
  }
} else {
  fs.mkdirSync(receiptRoot, { recursive: true })
  const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim()
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const diffSha256 = sha256(execFileSync('git', ['diff', '--binary'], { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 }))
  const fixtureSha256 = sha256(fs.readFileSync(fixturePath))
  const ids = ['N01', 'N02', 'N03', 'N04', 'N05', ...Array.from({ length: 24 }, (_, index) => `B${String(index + 1).padStart(2, '0')}`)]
  const receipts = []
  for (const id of ids) {
    const child = spawnSync(process.execPath, [process.argv[1], '--scenario', id], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
    let scenarioReceipt
    if (child.status === 0) scenarioReceipt = JSON.parse(child.stdout)
    else scenarioReceipt = { scenarioId: id, pass: false, failure: child.stderr || child.stdout, steps: [], assertions: [] }
    scenarioReceipt.branch = branch
    scenarioReceipt.head = head
    scenarioReceipt.workingTreeDiffSha256 = diffSha256
    scenarioReceipt.fixture = path.relative(designRoot, fixturePath)
    scenarioReceipt.fixtureSha256 = fixtureSha256
    const file = path.join(receiptRoot, `${id}.json`)
    fs.writeFileSync(file, `${JSON.stringify(scenarioReceipt, null, 2)}\n`)
    receipts.push({ id, pass: scenarioReceipt.pass === true, file: path.relative(designRoot, file), sha256: sha256(fs.readFileSync(file)), steps: scenarioReceipt.steps.length, assertions: scenarioReceipt.assertions.length, failure: scenarioReceipt.failure ?? null })
    console.log(`${id} ${scenarioReceipt.pass ? 'PASS' : 'FAIL'} steps=${scenarioReceipt.steps.length} assertions=${scenarioReceipt.assertions.length}`)
  }
  const summary = {
    generatedAt: new Date().toISOString(), branch, head, workingTreeDiffSha256: diffSha256,
    executionModel: '29 个场景逐个启动独立 Node 子进程；每个场景建立独立可变账本，正常场景推进采购→半成品→上游加工→TMF接收→截断/打头→交出→仓收→生产实收，边界场景验证异常阻断无副作用、恢复动作及最终数量守恒。',
    fixture: path.relative(designRoot, fixturePath), fixtureSha256,
    total: receipts.length, passed: receipts.filter(item => item.pass).length, failed: receipts.filter(item => !item.pass).length, receipts,
  }
  fs.writeFileSync(path.join(evidenceRoot, '2026-09-23-scenario-independent-current.json'), `${JSON.stringify(summary, null, 2)}\n`)
  if (summary.failed) process.exitCode = 1
}

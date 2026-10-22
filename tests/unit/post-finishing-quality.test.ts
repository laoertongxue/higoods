import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ensureQualityManagementRecords, readPreparedInspectionSnapshot } from '../../src/data/fcs/quality-management-records.ts'
import { createPostQcInspection, submitPostQcRound, getPostQcSummary, upgradePostQcInspection, assertPostQcCompletable, applyPostQcFullCoverage } from '../../src/data/fcs/post-finishing-quality.ts'
const at = '2026-10-22T00:00:00.000Z'
async function inspection(min = 0) { await ensureQualityManagementRecords(); const snapshot = readPreparedInspectionSnapshot({ sourceKind: 'PRODUCTION_RETURN' }); snapshot.ruleSnapshot!.minQuantity = min; return createPostQcInspection(snapshot) }
const issues = [{ itemId: 'garment-clean', note: '污渍及线头：同件只计一件' }]
const round = (operationId: string, passedQty: number, defectQty: number, returnQty = 0, skuId = 'SKU-A') => ({ operationId, actorId: 'QC-A', submittedAt: at, lines: [{ skuId, passedQty, defectQty, returnQty, issues: defectQty + returnQty ? issues : [] }] })
test('SQ03-05: 100件只补30/20/50，轮次独立触发，不能同档结束或降档，全检不再稽查', async () => {
  const item = await inspection(), supply = [{ skuId: 'SKU-A', quantity: 100 }]
  submitPostQcRound(item,supply,round('r1',27,3))
  assert.equal(getPostQcSummary(item,supply).pendingAudit?.unqualifiedQty,3)
  assert.throws(() => assertPostQcCompletable(item,supply,false),/稽查/)
  assert.throws(() => upgradePostQcInspection(item,{nextPercent:30,decidedAt:at,note:'同档'}),/不能维持或降低/)
  upgradePostQcInspection(item,{nextPercent:50,decidedAt:at,note:'升50%'})
  assert.equal(getPostQcSummary(item,supply).remainingQty,20)
  submitPostQcRound(item,supply,round('r2',18,2))
  assert.equal(getPostQcSummary(item,supply).inspectedQty,50)
  assert.equal(getPostQcSummary(item,supply).defectQty,5)
  upgradePostQcInspection(item,{nextPercent:100,decidedAt:at,note:'全检'})
  submitPostQcRound(item,supply,round('r3',44,6))
  assert.equal(getPostQcSummary(item,supply).pendingAudit,undefined)
  assert.equal(assertPostQcCompletable(item,supply,false).inspectedQty,100)
})
test('SQ10/SQ15: 29实检合格+70未检=99正常放行；重复提交不重复计量且不能修改旧轮',async () => {
  const item = await inspection(), supply = [{skuId:'SKU-A',quantity:100}], input = round('same',29,1)
  submitPostQcRound(item,supply,input);submitPostQcRound(item,supply,input)
  assert.equal(item.rounds.length,1)
  assert.deepEqual(Object.fromEntries(Object.entries(getPostQcSummary(item,supply)).filter(([k]) => ['inspectedQty','passedQty','releasedQty','uninspectedQty'].includes(k))),{inspectedQty:30,passedQty:29,uninspectedQty:70,releasedQty:99})
  assert.throws(() => submitPostQcRound(item,supply,round('same',28,2)),/不允许更正/)
  assert.throws(() => assertPostQcCompletable(item,supply,true),/双签/)
  item.papers.push({id:'paper',version:1,name:'隔离测试纸单',url:'/fixtures/paper.png',uploadedAt:at})
  assert.equal(assertPostQcCompletable(item,supply,true).releasedQty,99)
})
test('SQ01: 最低量封顶后为全检，坏件再多也不触发抽检稽查',async () => {
  const item=await inspection(40),supply=[{skuId:'SKU-A',quantity:12}]
  assert.equal(getPostQcSummary(item,supply).target,12)
  submitPostQcRound(item,supply,round('full',6,6))
  assert.equal(getPostQcSummary(item,supply).pendingAudit,undefined)
})
test('SQ02b: A只有1件不能填A检30，允许只抽B30且不要求各SKU至少一件',async () => {
  const item=await inspection(), supply=[{skuId:'SKU-A',quantity:1},{skuId:'SKU-B',quantity:99}]
  assert.throws(()=>submitPostQcRound(item,supply,round('wrong',30,0)),/该SKU剩余/)
  assert.equal(item.rounds.length,0)
  submitPostQcRound(item,supply,round('correct',30,0,0,'SKU-B'))
  assert.equal(getPostQcSummary(item,supply).lines[0].uninspectedQty,1)
  assert.equal(getPostQcSummary(item,supply).releasedQty,100)
})
test('FQ09: 在检全检覆盖抵扣已检、承接待稽查、保留标准，已全检后不降',async () => {
  const item=await inspection(), supply=[{skuId:'SKU-A',quantity:100}], snapshotId=item.snapshot.id
  submitPostQcRound(item,supply,round('r1',27,3))
  applyPostQcFullCoverage(item,['基础款全单'],at)
  assert.equal(item.snapshot.id,snapshotId)
  assert.equal(getPostQcSummary(item,supply).remainingQty,70)
  assert.equal(getPostQcSummary(item,supply).pendingAudit,undefined)
  assert.throws(()=>upgradePostQcInspection(item,{nextPercent:50,decidedAt:at,note:'误升降低'}),/没有待处理稽查/)
})

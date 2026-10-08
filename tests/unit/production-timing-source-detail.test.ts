import assert from 'node:assert/strict'
import test from 'node:test'
import { getTimingBranch, getTimingCaseByScene, listTimingCases, timingCaseHref, timingDocumentHref } from '../../src/data/production-timing/source'
import { resolveTimingSourceDetail } from '../../src/pages/production-fulfillment/source-document-detail'

test('timing documents resolve directly at their native route with the same shared static facts', () => {
  const documentIds = new Set<string>(), nativePaths = new Set<string>(), kinds = new Set<string>()
  let count = 0
  for (const order of listTimingCases()) {
    const branch = getTimingBranch(order)!
    for (const document of Object.values(branch.docs)) {
      assert.ok(!documentIds.has(document.id), `Duplicate source ID: ${document.id}`)
      documentIds.add(document.id)
      const path = timingDocumentHref(document.id)
      assert.match(path, /^\/(?:pcs|pms|fcs|wls)\//)
      assert.ok(!nativePaths.has(path), `Duplicate native path: ${path}`)
      nativePaths.add(path)
      const html = resolveTimingSourceDetail(path)
      assert.ok(html, `Direct route failed: ${path}`)
      assert.ok(html.includes(document.no), `Document number differs: ${document.id}`)
      assert.ok(html.includes(document.status), `Document status differs: ${document.id}`)
      assert.ok(html.includes(timingCaseHref(order)), `Missing correct production order backlink: ${document.id}`)
      assert.doesNotMatch(html, /\bundefined\b|\bNaN\b|工程BOM|工程单/)
      if (order.imageUrl) assert.ok(html.includes('data-timing-source-image'), `Missing product image preview: ${document.id}`)
      else assert.ok(html.includes('对应实图待补'), `Missing honest image gap: ${document.id}`)
      for (const relatedId of document.related) assert.ok(branch.docs[relatedId], `Broken document relationship: ${document.id} -> ${relatedId}`)
      kinds.add(document.type)
      count++
    }
  }
  assert.ok(count > 1500, `Expected all scenario documents, got ${count}`)
  for (const type of ['生产准备单', 'BOM物料明细', '商品采购单', '物料采购单', '原料入库单', '原料调拨单', '大货染色加工单', '大货印花加工单', '水洗加工单', '裁剪单', '绣花加工单', '交出记录', '接收记录', '质检交接记录', '交接单', '车缝任务分配合同', '工厂产前版样衣']) assert.ok(kinds.has(type), `Missing document type: ${type}`)
})

test('source detail does not resolve unrelated records or a registered record at a wrong module path', () => {
  assert.equal(resolveTimingSourceDetail('/pcs/production-preparation/orders/EM-001'), null)
  assert.equal(resolveTimingSourceDetail('/pms/material-purchase-orders/%ZZ'), null)
  const order = getTimingCaseByScene('live'), branch = getTimingBranch(order)!
  const prep = Object.values(branch.docs).find(document => document.type === '生产准备单')!
  assert.equal(resolveTimingSourceDetail('/pms/material-purchase-orders/' + encodeURIComponent(prep.id)), null)
})

test('a handover belongs to its original outgoing work rather than a linked next process', () => {
  const order = getTimingCaseByScene('live'), branch = getTimingBranch(order)!
  const dyeHandover = Object.values(branch.docs).find(document => document.type === '交接单' && document.id.endsWith('ho-F01-dye'))!
  assert.ok(timingDocumentHref(dyeHandover.id).startsWith('/fcs/craft/dyeing/handover-records/'))
  const firstCutHandover = Object.values(branch.docs).find(document => document.type === '交接单' && document.id.endsWith('ho-CUT-F-01-first'))!
  assert.ok(timingDocumentHref(firstCutHandover.id).startsWith('/fcs/craft/cutting/handover-records/'))
})

test('contract details retain natural-day deadlines and late achievement history', () => {
  const order = getTimingCaseByScene('reachedLate'), branch = getTimingBranch(order)!
  const contract = Object.values(branch.docs).find(document => document.type === '车缝任务分配合同' && document.object.startsWith('B厂'))!
  const html = resolveTimingSourceDetail(timingDocumentHref(contract.id))!
  assert.ok(html.includes('2026-10-04 23:59'), 'Independent sewing day 4 must include Sunday')
  assert.ok(html.includes('逾期达成 12小时'))
  assert.ok(html.includes('工厂实领') && html.includes('后道累计实收'))
  assert.ok(html.includes('同厂其他任务不抵扣本任务缺口'))
})

test('partially received material retains unknown purchase receipt instead of inventing zero or full stock', () => {
  const order = getTimingCaseByScene('materialPartial'), branch = getTimingBranch(order)!
  const purchase = Object.values(branch.docs).find(document => document.type === '物料采购单' && document.object.startsWith('F01'))!
  assert.equal(purchase.quantities?.仓库实收, null)
  const html = resolveTimingSourceDetail(timingDocumentHref(purchase.id))!
  assert.ok(html.includes('600米') && html.includes('900米') && html.includes('待核实'))
  assert.ok(!html.includes('仓库实收</dt><dd class="mt-1 text-lg font-semibold text-slate-900">0米'))
})

test('production preparation details include parallel requirements and BOM quantities', () => {
  const order = getTimingCaseByScene('live'), branch = getTimingBranch(order)!
  const html = resolveTimingSourceDetail(timingDocumentHref(branch.master))!
  for (const text of ['BOM物料明细', '调色', '花型', '首单样衣', '前期输入', '正式发布', '1,500米', '9,000粒']) assert.ok(html.includes(text), `Missing preparation detail: ${text}`)
})

test('work remaining quantity follows known required and completed quantities in the same unit', () => {
  const branch = getTimingBranch(getTimingCaseByScene('late'))!
  const completed = Object.values(branch.docs).find(document => document.id.endsWith('wo-F01-dye'))!
  const incomplete = Object.values(branch.docs).find(document => document.id.endsWith('aux-CUT-S-01-emb'))!
  const completedHtml = resolveTimingSourceDetail(timingDocumentHref(completed.id))!
  const incompleteHtml = resolveTimingSourceDetail(timingDocumentHref(incomplete.id))!
  assert.match(completedHtml, /加工对象明细[\s\S]*?1,500米<\/td>[\s\S]*?1,500米<\/td>[\s\S]*?0米<\/td>/)
  assert.match(incompleteHtml, /加工对象明细[\s\S]*?3,000片<\/td>[\s\S]*?2,400片<\/td>[\s\S]*?600片<\/td>/)
})

test('missing factory sample uses the recorded requirement date and keeps sample approval outside return milestones', () => {
  const order = getTimingCaseByScene('samplePending'), branch = getTimingBranch(order)!
  const sample = Object.values(branch.docs).find(document => document.type === '工厂产前版样衣' && document.object.startsWith('B厂'))!
  const html = resolveTimingSourceDetail(timingDocumentHref(sample.id))!
  assert.ok(html.includes('2026-10-05'))
  assert.ok(html.includes('待核实'))
  assert.ok(html.includes('样衣是否通过不改变合同回货进度判断与要求'))
  assert.ok(html.includes('日内截止时刻待确认'))
})

test('purchase-only scenario resolves to the existing merchandise purchase and pending-purchase backlink', () => {
  const order = getTimingCaseByScene('unknown'), branch = getTimingBranch(order)!
  assert.equal(Object.keys(branch.docs).length, 1)
  const purchase = Object.values(branch.docs)[0]
  const html = resolveTimingSourceDetail(timingDocumentHref(purchase.id))!
  assert.ok(html.includes('240776') && html.includes('2026-03-01 09:00'))
  assert.ok(html.includes('/pending-purchases/240776'))
  assert.ok(!html.includes('生产准备任务'))
})

#!/usr/bin/env node
// 本轮性能依据：用户2026-10-22确认不超过2秒、功能优先；保留原负载及逐样本验证。
/** Execution-only formal collector. Node fixture construction; native IDB preload; trusted UI thereafter. */
import { chromium } from '@playwright/test'
import {createQualityRuntimeAssetProof} from './quality-runtime-asset-proof.mjs'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cpus, totalmem, freemem, loadavg } from 'node:os'
import { buildQualityPerformanceFixture, QUALITY_PERFORMANCE_SHAPE, QUALITY_PERFORMANCE_SEED, startQualityPerformanceFixtureServer, installQualityPerformanceNativeFixture } from './quality-performance-fixture.mjs'
const args = process.argv.slice(2), opt = (name, fallback) => args.find(x => x.startsWith(name + '='))?.slice(name.length + 1) || fallback
const base = (process.env.BASE_URL || opt('--base', 'http://127.0.0.1:43527')).replace(/\/$/, '')
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname)) throw Error('Only isolated localhost prototype services are accepted.')
const output = resolve(opt('--output', 'output/qc-implementation-20261022/execution-performance')), dist = resolve(opt('--dist-dir', 'dist'))
const diagnostic = args.includes('--diagnostic'), trials = Number(opt('--trials', '5')), limitMs = Number(opt('--limit-ms','2000'))
if(!Number.isFinite(limitMs)||limitMs<1||limitMs>2000)throw Error('The per-sample limit must tighten the approved 2000ms ceiling, never raise it')
const cpuProfile = args.includes('--cpu-profile')
if (cpuProfile && !diagnostic) throw Error('CPU profiling adds overhead and is diagnostic only; it cannot pass formal performance acceptance.')
if (!Number.isInteger(trials) || trials < 1 || (!diagnostic && trials < 5)) throw Error('Formal families require at least five samples; smaller runs require --diagnostic.')
const PCS = 'higood-pcs-records', CUT = 'higood-cutting-records-v1', POST = 'higood-fcs-post-finishing-records', INV = 'higood-finished-inventory'
const iso = '2026-10-22T01:00:00.000Z', id = { inv: 'QEXEC-INV-QC-24', app: 'QEXEC-INV-APP-24', prod: 'QEXEC-PROD-QC-5', delivery: 'QEXEC-DELIVERY-5', post: 'QEXEC-POST-5', outbound: 'QEXEC-OUT-5' }
const key = (collection, identifier) => `${POST}/flow/${collection}/${encodeURIComponent(identifier)}`
const invKey = (collection, identifier) => `${INV}/${collection}/${encodeURIComponent(identifier)}`
const invPath = `/fcs/craft/post-finishing/qc-workbench?taskNo=${id.inv}`, prodPath = `/fcs/craft/post-finishing/qc-workbench?taskNo=${id.prod}`
const postNo = 'QEXEC-PROD-5-ZJ-HD', outboundNo = 'QEXEC-PROD-5-CH-001'
const handoverId = `HOH-POST-${outboundNo.replace(/[^A-Za-z0-9]/g, '').slice(-16)}`
const postPath = `/fcs/craft/post-finishing/work-orders/${postNo}`, pdaPost = `/fcs/pda/post-finishing/execute?id=${postNo}`
const receiptPath = `/fcs/pda/handover/${handoverId}`, outboundPath = `/fcs/craft/post-finishing/outbound-orders/${id.outbound}`
const qcSelector = '[data-qc-workbench-task]', pdaSession = { userId: 'ID-F002_operator', loginId: 'ID-F002_operator', userName: '后道工厂_操作工', roleId: 'ROLE_OPERATOR', factoryId: 'ID-F002', factoryName: '后道工厂', loggedAt: iso }
const pageFamilies = {
  'qc-scan': { phase: 'pending', actor: 'PF-USER-QC-MGR', path: invPath, selector: '[data-post-finishing-field="qc-task-input"]', images: 0 },
  'qc-inventory24': { phase: 'inv-open', actor: 'PF-USER-QC-MGR', path: invPath, selector: qcSelector, images: 24, text: id.inv },
  'qc-production5': { phase: 'prod-open', actor: 'PF-USER-QC-B', path: prodPath, selector: qcSelector, images: 5, text: id.prod },
  'web-process5': { phase: 'process-open', actor: 'PF-USER-POST', path: postPath, selector: '[data-web-post-task]', images: 5 },
  'web-outbound5': { phase: 'prepared', actor: 'PF-USER-POST', path: outboundPath, selector: '[data-post-outbound-dispatch]', images: 5 },
  'pda-process5': { phase: 'process-open', actor: 'PF-USER-POST', path: pdaPost, selector: '[data-pda-post-task]', images: 5, pda: true },
  'pda-shipped': { phase: 'dispatched', path: '/fcs/pda/handover?tab=shipped', selector: `[data-pda-post-outbound-card="${outboundNo}"]`, images: 5, pda: true },
  'pda-original-receipt5': { phase: 'dispatched', path: receiptPath, selector: '[data-post-original-outbound]', images: 5, pda: true },
  'print-dedicated-master24': { phase: 'inv-complete', path: `/fcs/craft/post-finishing/print?type=QC_ORDER&id=${id.inv}`, selector: '[data-testid="post-finishing-qc-master-print"]', images: 1, code: true, print: true },
  'print-dedicated-detail24': { phase: 'inv-complete', path: `/fcs/craft/post-finishing/print?type=QC_DETAIL&id=${id.inv}`, selector: '[data-testid="post-finishing-qc-detail-print"]', images: 0, requiredSkuText: true, code: true, print: true },
  'print-generic-master-production5': { phase: 'process-open', path: '', selector: '[data-testid="post-finishing-qc-master-print"]', images: 2, code: true, print: true, actualSourceSkuCount: 5, note: 'Original five formal SKUs and original production order, 20 garments per SKU, complete own BOM, frozen40-item QC/round/current paper Blob. This is the original five-SKU family, not the separate PO082 source.' },
  'print-generic-master-formal4': { phase: 'print-formal4', path: '', selector: '[data-testid="post-finishing-qc-master-print"]', images: 4, code: true, print: true, actualSourceSkuCount: 4, note: 'Additional retained PO-202603-082 four-SKU positive print family. Its complete original QC/process/outbound rows remain additions; it does not replace any of the original62 families.' },
  'print-generic-detail24': { phase: 'inv-complete', path: `/fcs/print/preview?documentType=POST_FINISHING_QC_ORDER&sourceType=POST_FINISHING_QC_ORDER&sourceId=${id.inv}`, selector: '[data-testid="post-finishing-qc-detail-print"]', images: 0, requiredSkuText: true, code: true, print: true },
}
const extraPrints = Object.fromEntries([['outbound-document', 'OUTBOUND'], ['sku-barcode', 'OUTBOUND_BARCODE'], ['hangtag', 'OUTBOUND_HANGTAG']].map(([name, type]) => [name, { phase: 'dispatched', path: `/fcs/craft/post-finishing/print?type=${type}&id=${id.outbound}`, selector: type === 'OUTBOUND' ? '[data-print-document-no]' : '[data-outbound-unit-label]', images: type === 'OUTBOUND_BARCODE' ? 0 : type === 'OUTBOUND_HANGTAG' ? 100 : 5, code: true, print: true, unitLabels: type !== 'OUTBOUND' }]))
const actionFamilies = ['claim-inventory24', 'claim-production5', 'select-ten-photos', 'inventory-round30-photos', 'inventory-audit50', 'inventory-round50', 'inventory-audit100', 'inventory-round100', 'inventory-complete', 'production-round', 'select-paper2MiB', 'save-paper2MiB', 'production-complete', 'web-process-increment', 'pda-process-increment', 'web-prepare-outbound', 'pda-prepare-outbound', 'web-dispatch', 'pda-dispatch', 'pda-scan-process', 'pda-open-original-outbound', 'pda-receive', 'pda-authorized-difference-receive']
const families = [...Object.keys(pageFamilies).flatMap(name => ['cold', 'refresh', 'spa'].map(mode => `entry:${mode}:${name}`)), ...Object.keys(extraPrints).map(name => `print:direct:${name}`), ...actionFamilies.map(name => `action:${name}`)]
if (families.length !== 65 || actionFamilies.length !== 23) throw Error('Original62 families plus3 declared formal-four-SKU entry families must remain65.')
const config = { base, dist, diagnostic, trials, limitMs, expectedFamilies: 65, expectedSamples: 325, families, pageFamilies, extraPrints, actionFamilies,
  load: QUALITY_PERFORMANCE_SHAPE, seed: QUALITY_PERFORMANCE_SEED, pp: { status: 'pending-separate-collector', countedAsPassed: false },
  endpoint: 'Browser navigation origin/trusted action -> actual reads and computation -> applicable native transaction complete -> independent narrow native record/Blob readback -> full business DOM, decoded corresponding images, real code SVG and two mutation-stable painted frames. Human preparation and tool polling/screenshots excluded.',
  cold: 'Fresh browser context/HTTP cache and first app evaluation. Full native-IDB installation precedes app evaluation and is excluded; this is not a claim of a physically cold disk.',
  equivalence: 'Original62 families remain:8 execution pages plus4 original QC outputs each get cold/refresh/SPA, including the original generic master with its own five formal SKUs/production/BOM and100 garments. Added PO082 generic master with four exact formal SKUs retains its prior positive phase and adds3 explicit cold/refresh/SPA families, giving65 families/325 formal samples. Inventory QC outputs retain24 SKUs; outbound labels retain100 units/20 per original production SKU. Three actual outbound/label outputs keep direct-entry samples. Original business writers/file/receipt endpoints are unchanged.',
  boundary: 'Node-only shared original 10k/20k fixture plus declared stage additions. After native preinstallation only actual UI actions; no /src import, business test hook, fake provider, role-switch UI, external database or production access.' }
const hash = value => createHash('sha256').update(value).digest('hex'), clone = value => structuredClone(value)
if (!args.includes('--run') && !args.includes('--prepare-fixture') && !args.includes('--check-fixture')) { console.log(JSON.stringify({ prepared: true, executed: false, config, usage: 'BASE_URL=http://127.0.0.1:PORT node --import tsx scripts/verification/quality-execution-performance.mjs --prepare-fixture|--run --dist-dir=FIXED_BUILD [--diagnostic --trials=1 --families=substring]' }, null, 2)); process.exit(0) }

async function buildExecutionFixture() {
  const history = await buildQualityPerformanceFixture(), flow = await import('../../src/data/fcs/post-finishing-full-flow.ts'), engine = await import('../../src/data/fcs/post-finishing-quality.ts')
  const skuRepo = await import('../../src/data/pcs-sku-archive-repository.ts'), print = await import('../../src/data/fcs/print-service.ts')
  const template = flow.listPostFinishingFullFlowQcTasks().find(row => row.status === '待质检' && row.lines.length === 5)
  if (!template) throw Error('Current formal five-SKU production QC template missing; cannot replace it with synthetic production identity.')
  const deliveryTemplate = flow.getPostFinishingFactoryReturn(template.deliveryId), postTemplate = flow.listPostFinishingFullFlowPostTasks().find(row => row.lines.length === 5)
  const formal = template.lines.map(row => clone(row.sku)), tee = skuRepo.listSkuArchives().filter(row => row.styleId === 'style_r1_wms_tee')
  if (formal.length !== 5 || tee.length !== 2 || formal.some(sku => !existsSync(resolve('public', sku.imageUrl.slice(1))))) throw Error('Corresponding official garment images or source SKU relation missing.')
  const actor = flow.POST_FINISHING_ACCEPTANCE_ACTORS.qcSupervisor, prodActor = flow.POST_FINISHING_ACCEPTANCE_ACTORS.qcB, postActor = flow.POST_FINISHING_ACCEPTANCE_ACTORS.postOperator
  const inventorySkus = Array.from({ length: 24 }, (_, n) => { const original = tee[n % tee.length]; return { skuId: `QEXEC-INV-SKU-${n}`, skuCode: `QEXEC-INV-SKU-${n}`, spuCode: original.styleCode, spuName: original.styleName, colorName: original.colorName, sizeName: `性能尺码${Math.floor(n / 2) + 1}`, imageUrl: original.skuImageUrl, barcode: `QEXECINV${String(n).padStart(3, '0')}`, plannedQty: 100, qtyUnit: '件' } })
  const baseConfigs = history.pcs.filter(row => row.collection === 'quality/config').map(row => row.value), basic = baseConfigs.find(row => row.kind === 'BASIC' && row.objectType === 'GARMENT')
  const snapshotFor = (kind, skus, productionStyleId = template.styleId) => {
    const rule = baseConfigs.find(row => row.kind === 'RULE' && row.applicability.sourceKinds.includes(kind)), { id: ruleId, version, quantityBasis, defaultPercent, minQuantity, percentSteps, roundThresholds, initialFullInspection } = rule
    const value = { id: `QEXEC-SNAPSHOT-${kind}`, selectedAt: iso, configRevision: 1, context: { sourceKind: kind, stage: kind === 'WAREHOUSE_STOCK' ? 'WAREHOUSE_STOCK_QC' : 'POST_FINISHING_QC', objectType: 'GARMENT', styleId: kind === 'WAREHOUSE_STOCK' ? tee[0].styleId : productionStyleId, styleCode: skus[0].spuCode }, basicStandard: { id: basic.id, version: 1, name: basic.name }, additionalStandards: [], items: basic.items.map(item => ({ ...clone(item), sourceStandardId: basic.id, sourceStandardVersion: 1, overriddenBy: [] })), references: [], ruleSnapshot: { id: ruleId, version, quantityBasis, defaultPercent, minQuantity, percentSteps, roundThresholds, initialFullInspection } }
    value.skuSnapshots = skus.map(sku => ({ skuId: sku.skuId, snapshot: { ...value, id: `${value.id}:${sku.skuId}`, context: { ...value.context, attributes: { size: sku.sizeName, color: sku.colorName } } } }))
    return value
  }
  const invPending = { ...clone(template), qcTaskId: id.inv, qcTaskNo: id.inv, sourceKind: 'WAREHOUSE_STOCK', inventoryApplicationId: id.app, deliveryId: '', deliveryOrderNo: id.app, productionOrderId: '', productionOrderNo: '', styleId: tee[0].styleId, sourceWarehouseId: 'WH-L1-GMT-001', sourceWarehouseName: '中央总仓-成衣仓', returnIndex: 1, status: '待质检', claimedBy: undefined, claimedAt: undefined, completedAt: undefined, inspection: undefined, results: undefined, referenceIds: [], postTaskId: undefined, postTaskNo: undefined, lines: inventorySkus.map(sku => ({ sku, expectedQty: 100 })) }
  const prodPending = { ...clone(template), qcTaskId: id.prod, qcTaskNo: id.prod, deliveryId: id.delivery, deliveryOrderNo: 'QEXEC-DELIVERY-5', status: '待质检', claimedBy: undefined, claimedAt: undefined, completedAt: undefined, inspection: undefined, results: undefined, postTaskId: undefined, postTaskNo: undefined, referenceIds: [], lines: formal.map(sku => ({ sku, expectedQty: 20 })) }
  const delivery = { ...clone(deliveryTemplate), deliveryId: id.delivery, deliveryOrderNo: prodPending.deliveryOrderNo, qcTaskId: id.prod, qcTaskNo: id.prod, lines: formal.map(sku => ({ sku, registeredQty: 20, firstCountQty: 20, confirmedQty: 20, differenceQty: 0, differenceRate: 0 })) }
  const open = (pending, who) => ({ ...clone(pending), status: '质检中', claimedBy: clone(who), claimedAt: iso, inspection: engine.createPostQcInspection(snapshotFor(pending.sourceKind || 'PRODUCTION_RETURN', pending.lines.map(row => row.sku))) })
  const invOpen = open(invPending, actor), prodOpen = open(prodPending, prodActor)
  prodOpen.inspection.percent = 100 // Declared initialized production full-inspection stage, not a new rule/default.
  const supply = task => task.lines.map(row => ({ skuId: row.sku.skuId, quantity: row.expectedQty }))
  const addRound = (task, qty, bad, number) => {
    let left = qty, badLeft = bad
    const remaining = engine.getPostQcSummary(task.inspection, supply(task)).lines
    const lines = remaining.map(row => { const count = Math.min(left, row.uninspectedQty); left -= count; const d = Math.min(count, badLeft); badLeft -= d; return { skuId: row.skuId, passedQty: count - d, defectQty: d, returnQty: 0, issues: d ? [{ itemId: basic.items[0].id, note: '隔离性能实物问题' }] : [] } })
    if (left || badLeft) throw Error('Fixture quantity overflow')
    engine.submitPostQcRound(task.inspection, supply(task), { operationId: `QEXEC:${task.qcTaskId}:${number}`, actorId: task.claimedBy.actorId, submittedAt: iso, lines })
  }
  const audit50 = clone(invOpen); addRound(audit50, 720, 3, 1)
  const round50 = clone(audit50); engine.upgradePostQcInspection(round50.inspection, { nextPercent: 50, note: '隔离夹具首轮升级', decidedAt: iso })
  const audit100 = clone(round50); addRound(audit100, 480, 2, 2)
  const round100 = clone(audit100); engine.upgradePostQcInspection(round100.inspection, { nextPercent: 100, note: '隔离夹具第二轮升级', decidedAt: iso })
  const invCompletable = clone(round100); addRound(invCompletable, 1200, 0, 3)
  const invComplete = clone(invCompletable); invComplete.status = '质检完成'; invComplete.completedAt = iso
  invComplete.results = engine.getPostQcSummary(invComplete.inspection, supply(invComplete)).lines.map(row => ({ ...row, sku: inventorySkus.find(sku => sku.skuId === row.skuId), expectedQty: row.quantity }))
  const prodPaper = clone(prodOpen); addRound(prodPaper, 100, 0, 1)
  const prodCompletable = clone(prodPaper); prodCompletable.inspection.papers.push({ id: 'QEXEC-SHARED-PAPER', version: prodCompletable.inspection.paperVersion, name: '历史共享性能文件（不代表真实签字）.jpg', url: 'pcs-file:qexec-shared-history', uploadedAt: iso })
  const prodComplete = clone(prodCompletable); prodComplete.status = '质检完成'; prodComplete.completedAt = iso; prodComplete.postTaskId = id.post; prodComplete.postTaskNo = postNo; prodComplete.frozenProcessItems = ['熨烫', '包装']
  prodComplete.results = engine.getPostQcSummary(prodComplete.inspection, supply(prodComplete)).lines.map(row => ({ ...row, sku: formal.find(sku => sku.skuId === row.skuId), expectedQty: row.quantity }))
  const post = { ...clone(postTemplate), postTaskId: id.post, postTaskNo: postNo, deliveryId: id.delivery, deliveryOrderNo: delivery.deliveryOrderNo, productionOrderNo: template.productionOrderNo, qcTaskId: id.prod, qcTaskNo: id.prod, returnIndex: prodPending.returnIndex, sourceType: '任务后道', executionModel: 'ITEMS_V1', processItems: ['熨烫', '包装'], lines: formal.map(sku => ({ sku, expectedQty: 20 })), status: '待后道', results: undefined, completedAt: undefined, startedAt: undefined, legacyCarryover: undefined }
  const processRows = post.processItems.map((processItem, n) => ({ recordId: `QEXEC-PC-${n}`, operationId: `QEXEC-PC-${n}`, intent: `declared fixture ${processItem}`, postTaskId: id.post, processItem, quantities: formal.map(sku => ({ skuId: sku.skuId, quantity: 20 })), responsible: postActor, recordedBy: postActor, recordedAt: iso }))
  const outbound = { outboundOrderId: id.outbound, outboundOrderNo: outboundNo, deliveryId: id.delivery, deliveryOrderNo: delivery.deliveryOrderNo, productionOrderNo: template.productionOrderNo, qcTaskId: id.prod, qcTaskNo: id.prod, postTaskId: id.post, postTaskNo: postNo, responsibility: clone(post.responsibility), sourceType: '后道加工后', returnIndex: post.returnIndex, status: '待出货', executionModel: 'DIRECT_V2', createdAt: iso, sequence: 1, operationId: 'QEXEC-PREPARED', lines: formal.map(sku => ({ sku, outboundQty: 20 })) }
  const stock = { warehouseRecordId: 'QEXEC-HANDOUT-STOCK', deliveryId: id.delivery, deliveryOrderNo: delivery.deliveryOrderNo, productionOrderNo: template.productionOrderNo, returnIndex: post.returnIndex, qcTaskId: id.prod, qcTaskNo: id.prod, postTaskId: id.post, postTaskNo: postNo, responsibility: post.responsibility, sourceType: '后道加工后', outboundOrderId: id.outbound, outboundOrderNo: outboundNo, areaName: '处理后待交出区', locationCode: 'QEXEC-HO-001', status: '待交出', createdAt: iso, createdBy: postActor, lines: formal.map(sku => ({ sku, inboundQty: 20, availableQty: 20, handedOverQty: 0 })) }
  const app = { id: id.app, applicationNo: id.app, operationId: id.app, warehouseId: invPending.sourceWarehouseId, warehouseName: invPending.sourceWarehouseName, styleId: tee[0].styleId, styleNo: tee[0].styleCode, styleName: tee[0].styleName, imageUrl: tee[0].skuImageUrl, lines: inventorySkus.map(sku => ({ skuId: sku.skuId, skuCode: sku.skuCode, styleId: tee[0].styleId, styleNo: sku.spuCode, styleName: sku.spuName, colorName: sku.colorName, sizeName: sku.sizeName, imageUrl: sku.imageUrl, barcode: sku.barcode, outboundQty: 100, receivedQty: 100, allocations: [{ lotId: `QEXEC-SOURCE:${sku.skuId}`, quantity: 100, locationCode: 'QEXEC-SOURCE-01' }] })), createdAt: iso, createdBy: '隔离性能仓管', outboundId: 'QEXEC-SENT', receivedAt: iso, receivedBy: '隔离性能接收员', qcTaskId: id.inv, qcTaskNo: id.inv }
  const row = (col, value, identity) => ({ id: key(col, identity), collection: `flow/${col}`, value, version: 1 })
  const invRow = (col, value, identity) => ({ id: invKey(col, identity), collection: `${INV}/${col}`, value, version: 1 })
  const sent = { id: 'QEXEC-SENT', applicationId: id.app, applicationNo: id.app, category: '送后道', sourceWarehouseId: app.warehouseId, sourceWarehouseName: app.warehouseName, targetId: 'ID-F002', targetName: '后道工厂', lines: app.lines.map(line => ({ ...line, quantity: 100, receivedQty: 100 })), createdAt: iso, createdBy: app.createdBy, shippedAt: iso, shippedBy: app.createdBy, receivedAt: iso, receivedBy: app.receivedBy }
  const baseAdditions = [row('deliveries', delivery, id.delivery), row('qcTasks', invPending, id.inv), row('qcTasks', prodPending, id.prod), invRow('applications', app, id.app), invRow('transfers', sent, sent.id)]
  const classified = [['正常返仓', `${id.app}-正常返仓`, app.warehouseId, app.warehouseName], ['瑕疵入仓', `${id.app}-瑕疵入仓`, 'WH-FINISHED-DEFECT-001', '独立瑕疵品仓']].map(([category, transferId, targetId, targetName]) => {
    const lines = invComplete.results.map(result => { const source = app.lines.find(line => line.skuId === result.skuId); const { outboundQty, receivedQty, allocations, ...sku } = source; return { ...sku, quantity: category === '正常返仓' ? result.releasedQty : result.defectQty } }).filter(line => line.quantity > 0)
    return invRow('transfers', { id: transferId, applicationId: id.app, applicationNo: id.app, category, sourceWarehouseId: 'ID-F002', sourceWarehouseName: '后道工厂', targetId, targetName, lines, createdAt: iso, createdBy: actor.actorName }, transferId)
  })
  // Two declared historical consumers share the same raw Blob; retain their references through current uploads.
  for (const suffix of ['A', 'B']) { const historical = clone(prodCompletable); historical.qcTaskId = historical.qcTaskNo = `QEXEC-SHARED-HISTORY-${suffix}`; historical.status = '质检完成'; historical.completedAt = iso; historical.results = engine.getPostQcSummary(historical.inspection, supply(historical)).lines.map(line => ({ ...line, sku: formal.find(sku => sku.skuId === line.skuId), expectedQty: line.quantity })); baseAdditions.push(row('qcTasks', historical, historical.qcTaskId)) }
  const phases = {
    pending: [], 'inv-open': [row('qcTasks', invOpen, id.inv)], 'inv-audit50': [row('qcTasks', audit50, id.inv)], 'inv-round50': [row('qcTasks', round50, id.inv)], 'inv-audit100': [row('qcTasks', audit100, id.inv)], 'inv-round100': [row('qcTasks', round100, id.inv)], 'inv-completable': [row('qcTasks', invCompletable, id.inv)],
    'inv-complete': [row('qcTasks', invComplete, id.inv), invRow('applications', { ...app, qcCompletedAt: iso, qcResults: invComplete.results.map(line => ({ skuId: line.skuId, inspectedQty: line.inspectedQty, passedQty: line.passedQty, defectQty: line.defectQty, reworkQty: line.returnQty, uninspectedQty: line.uninspectedQty, releasedQty: line.releasedQty })) }, id.app), ...classified],
    'prod-open': [row('qcTasks', prodOpen, id.prod)], 'prod-paper': [row('qcTasks', prodPaper, id.prod)], 'prod-completable': [row('qcTasks', prodCompletable, id.prod)],
    'process-open': [row('qcTasks', prodComplete, id.prod), row('postTasks', post, id.post)],
    'process-ready': [row('qcTasks', prodComplete, id.prod), row('postTasks', { ...post, status: '后道完成', completedAt: iso }, id.post), ...processRows.map(value => row('processCompletions', value, value.recordId))],
  }
  phases.prepared = [...phases['process-ready'], row('outboundOrders', outbound, id.outbound), row('waitHandoverWarehouseRecords', stock, stock.warehouseRecordId)]
  phases.dispatched = [...phases['process-ready'], row('outboundOrders', { ...outbound, status: '待仓库接收', dispatchedAt: iso, dispatchedBy: postActor }, id.outbound), row('waitHandoverWarehouseRecords', { ...stock, status: '已交出', handedOverAt: iso, handedOverBy: postActor, lines: stock.lines.map(line => ({ ...line, handedOverQty: line.inboundQty, availableQty: 0 })) }, stock.warehouseRecordId)]
  // User-authorized static completion now supplies the three original demo
  // orders' own declared main-material identities/images. Validate that exact
  // source revision; never manufacture a missing-image negative from them.
  // The original five-SKU QC/process chain remains the original master family.
  // Retain the separately declared PO082 four-SKU chain as additive coverage.
  const { productionOrders } = await import('../../src/data/fcs/production-orders.ts')
  const { buildProductionConfirmationSnapshot } = await import('../../src/data/fcs/production-confirmation.ts')
  const { LEGACY_QC_MATERIAL_BINDINGS, LEGACY_QC_MATERIAL_DEMO_REVISION } = await import('../../src/data/pcs-legacy-qc-demo-materials.ts')
  const printOrder = productionOrders.find(order => order.productionOrderId === 'PO-202603-082')
  if (!printOrder) throw Error('Verified complete-BOM formal print order PO-202603-082 is absent; no substitute source is allowed.')
  const printSource = buildProductionConfirmationSnapshot(printOrder.productionOrderId), originalPrintSource = buildProductionConfirmationSnapshot(template.productionOrderId)
  if (printSource.bomSnapshot.length !== 3 || printSource.bomSnapshot.some(material => !material.materialImageUrl)) throw Error('Formal print order has missing/changed actual BOM bindings; do not insert a fallback.')
  const materialCompleteness = LEGACY_QC_MATERIAL_BINDINGS.map(binding => {
    const order = productionOrders.find(row => row.productionOrderId === binding.productionOrderId)
    if (!order || order.demandSnapshot.spuCode !== binding.styleCode || order.techPackSnapshot?.sourceTechPackVersionId !== binding.technicalVersionId) throw Error('Original three demo material check lost its exact production/style/technical-version identity.')
    const source = buildProductionConfirmationSnapshot(binding.productionOrderId), material = source.bomSnapshot[0], originalBom = order.techPackSnapshot.bomItems[0]
    if (source.bomSnapshot.length !== 1 || material.materialSku !== binding.technicalVersionId + '-bom-main' || material.materialCode !== binding.materialCode || material.materialName !== binding.materialName || material.materialImageUrl !== binding.imageUrl || originalBom.materialSkuId !== binding.materialSkuId) throw Error(`Original demo main-material identity is incomplete: ${binding.styleCode}; do not insert a fallback.`)
    if (!binding.imageUrl.startsWith('/') || !existsSync(resolve('public', binding.imageUrl.slice(1)))) throw Error(`Original demo material image is absent: ${binding.styleCode}`)
    const bytes = readFileSync(resolve('public', binding.imageUrl.slice(1))), actualSha256 = hash(bytes)
    if (actualSha256 !== binding.imageSha256) throw Error(`Original demo material image bytes changed: ${binding.styleCode}`)
    return { revision: LEGACY_QC_MATERIAL_DEMO_REVISION, productionOrderId: order.productionOrderId, productionOrderNo: order.productionOrderNo, styleCode: binding.styleCode, techPackVersionId: binding.technicalVersionId, mainMaterialId: binding.materialId, mainMaterialSkuId: originalBom.materialSkuId, mainMaterialCode: material.materialCode, mainMaterialName: material.materialName, bomRowId: material.materialSku, imageUrl: material.materialImageUrl, imageSha256: actualSha256, imageBytes: bytes.length, complete: true, boundary: 'Static prototype raw-material relation authorized for these three templates; does not represent dyeing, field usage, or rewriting a persisted QC snapshot.' }
  })
  if (materialCompleteness.length !== 3 || !materialCompleteness.some(row => row.productionOrderId === template.productionOrderId)) throw Error('All three exact original demo material sources must be complete; the five-SKU source must be one of them.')
  const ownOrder = productionOrders.find(order => order.productionOrderId === template.productionOrderId)
  if (!ownOrder || ownOrder.productionOrderNo !== template.productionOrderNo || ownOrder.demandSnapshot.skuLines.length !== 5 || new Set(formal.map(sku => sku.skuId)).size !== 5 || originalPrintSource.bomSnapshot.length !== 1 || originalPrintSource.bomSnapshot.some(material => !material.materialImageUrl) || formal.some(sku => sku.spuCode !== ownOrder.demandSnapshot.spuCode || !ownOrder.demandSnapshot.skuLines.some(line => line.skuCode === sku.skuCode))) throw Error('Original five-SKU master must use its own production order, formal SKU set and completed BOM.')

  const archives = skuRepo.listSkuArchives()
  const printSkus = printOrder.demandSnapshot.skuLines.map(line => {
    const archive = archives.find(sku => sku.skuCode === line.skuCode && sku.styleCode === printOrder.demandSnapshot.spuCode && sku.colorName === line.color && sku.sizeName === line.size)
    if (!archive?.barcode || !archive.skuImageUrl) throw Error('Formal print source SKU/code/color/size/barcode/image relationship is incomplete.')
    return { skuId: archive.skuId, skuCode: archive.skuCode, spuCode: archive.styleCode, spuName: archive.styleName, colorName: archive.colorName, sizeName: archive.sizeName, imageUrl: archive.skuImageUrl, barcode: archive.barcode, plannedQty: line.qty, qtyUnit: '件' }
  })
  if (printSkus.length !== 4 || new Set(printSkus.map(sku => sku.skuId)).size !== 4) throw Error('Verified print source must retain exactly four distinct formal SKU identities.')
  const printAssetUrls = [...new Set([printOrder.demandSnapshot.styleImageUrl, printSource.productImageUrl, ...printSkus.map(sku => sku.imageUrl), ...printSource.bomSnapshot.map(material => material.materialImageUrl)].filter(Boolean))]
  const printAssets = printAssetUrls.map(url => {
    if (!url.startsWith('/') || !existsSync(resolve('public', url.slice(1)))) throw Error(`Corresponding formal print asset is absent: ${url}`)
    const bytes = readFileSync(resolve('public', url.slice(1)))
    return { url, bytes: bytes.length, sha256: hash(bytes) }
  })
  const printIds = { delivery: 'QEXEC-PRINT-DELIVERY-082', qc: 'QEXEC-PRINT-QC-082', post: 'QEXEC-PRINT-POST-082', outbound: 'QEXEC-PRINT-OUT-082', stock: 'QEXEC-PRINT-STOCK-082' }, printQty = 25
  const printDelivery = { ...clone(deliveryTemplate), deliveryId: printIds.delivery, deliveryOrderNo: printIds.delivery, productionOrderId: printOrder.productionOrderId, productionOrderNo: printOrder.productionOrderNo, returnIndex: 1, idempotencyKey: 'QEXEC-PRINT-ISOLATED-RETURN-082', executionTaskId: 'QEXEC-PRINT-ISOLATED-EXECUTION-082', sewingTaskNo: 'QEXEC-PRINT-ISOLATED-SEW-082', assignmentId: undefined, status: '已送检', qcTaskId: printIds.qc, qcTaskNo: printIds.qc, evidenceImageUrls: [printSkus[0].imageUrl], registeredAt: iso, confirmedAt: iso, lines: printSkus.map(sku => ({ sku, registeredQty: printQty, firstCountQty: printQty, confirmedQty: printQty, differenceQty: 0, differenceRate: 0 })) }
  const printQc = { ...clone(prodPending), qcTaskId: printIds.qc, qcTaskNo: printIds.qc, productionOrderId: printOrder.productionOrderId, productionOrderNo: printOrder.productionOrderNo, styleId: printOrder.techPackSnapshot.styleId, deliveryId: printIds.delivery, deliveryOrderNo: printIds.delivery, returnIndex: 1, status: '质检中', claimedBy: clone(prodActor), claimedAt: iso, completedAt: undefined, postTaskId: undefined, postTaskNo: undefined, independentChecks: [], lines: printSkus.map(sku => ({ sku, expectedQty: printQty })), inspection: engine.createPostQcInspection(snapshotFor('PRODUCTION_RETURN', printSkus, printOrder.techPackSnapshot.styleId)) }
  printQc.inspection.percent = 100; addRound(printQc, 100, 0, 1)
  printQc.inspection.papers.push({ id: 'QEXEC-PRINT-PAPER-082', version: printQc.inspection.paperVersion, name: '隔离验收纸单文件，不代表现场签字.jpg', url: 'pcs-file:qexec-shared-history', uploadedAt: iso })
  printQc.status = '质检完成'; printQc.completedAt = iso; printQc.postTaskId = printIds.post; printQc.postTaskNo = printIds.post; printQc.frozenProcessItems = ['熨烫', '包装']
  printQc.results = engine.getPostQcSummary(printQc.inspection, supply(printQc)).lines.map(result => ({ ...result, sku: printSkus.find(sku => sku.skuId === result.skuId), expectedQty: result.quantity }))
  const printPost = { ...clone(post), postTaskId: printIds.post, postTaskNo: printIds.post, deliveryId: printIds.delivery, deliveryOrderNo: printIds.delivery, productionOrderNo: printOrder.productionOrderNo, qcTaskId: printIds.qc, qcTaskNo: printIds.qc, returnIndex: 1, status: '后道完成', startedAt: iso, completedAt: iso, lines: printSkus.map(sku => ({ sku, expectedQty: printQty })) }
  const printOutbound = { ...clone(outbound), outboundOrderId: printIds.outbound, outboundOrderNo: printIds.outbound, deliveryId: printIds.delivery, deliveryOrderNo: printIds.delivery, productionOrderNo: printOrder.productionOrderNo, qcTaskId: printIds.qc, qcTaskNo: printIds.qc, postTaskId: printIds.post, postTaskNo: printIds.post, operationId: 'QEXEC-PRINT-ISOLATED-PREPARED-082', returnIndex: 1, lines: printSkus.map(sku => ({ sku, outboundQty: printQty })) }
  const printStock = { ...clone(stock), warehouseRecordId: printIds.stock, deliveryId: printIds.delivery, deliveryOrderNo: printIds.delivery, productionOrderNo: printOrder.productionOrderNo, qcTaskId: printIds.qc, qcTaskNo: printIds.qc, postTaskId: printIds.post, postTaskNo: printIds.post, outboundOrderId: printIds.outbound, outboundOrderNo: printIds.outbound, returnIndex: 1, locationCode: 'QEXEC-PRINT-082', lines: printSkus.map(sku => ({ sku, inboundQty: printQty, availableQty: printQty, handedOverQty: 0 })) }
  const printProcessRows = printPost.processItems.map((processItem, index) => ({ recordId: `QEXEC-PRINT-PC-082-${index}`, operationId: `QEXEC-PRINT-PC-082-${index}`, intent: 'Declared isolated print fixture; not an actual factory operation', postTaskId: printIds.post, processItem, quantities: printSkus.map(sku => ({ skuId: sku.skuId, quantity: printQty })), responsible: postActor, recordedBy: postActor, recordedAt: iso }))
  const formalPrintRows = [row('deliveries', printDelivery, printIds.delivery), row('qcTasks', printQc, printIds.qc), row('postTasks', printPost, printIds.post), row('outboundOrders', printOutbound, printIds.outbound), row('waitHandoverWarehouseRecords', printStock, printIds.stock), ...printProcessRows.map(value => row('processCompletions', value, value.recordId))]
  if (formalPrintRows.some(extra => history.pcs.some(original => original.id === extra.id))) throw Error('Formal print additions collide with original historical records.')
  phases['print-formal4'] = [...phases['process-open'], ...formalPrintRows]
  pageFamilies['print-generic-master-production5'].path = print.buildUnifiedPrintPreviewLink({ documentType: 'PRODUCTION_QC_MASTER', sourceType: 'POST_FINISHING_TASK', sourceId: template.productionOrderNo })
  pageFamilies['print-generic-master-production5'].images = 1 + originalPrintSource.bomSnapshot.length
  pageFamilies['print-generic-master-production5'].requiredImageUrls = originalPrintSource.bomSnapshot.map(material => material.materialImageUrl)
  pageFamilies['print-generic-master-production5'].requiredTexts = [template.productionOrderNo, ownOrder.demandSnapshot.spuCode, ...basic.items.map(item => item.name)]
  pageFamilies['print-generic-master-formal4'].path = print.buildUnifiedPrintPreviewLink({ documentType: 'PRODUCTION_QC_MASTER', sourceType: 'POST_FINISHING_TASK', sourceId: printOrder.productionOrderNo })
  pageFamilies['print-generic-master-formal4'].requiredImageUrls = printSource.bomSnapshot.map(material => material.materialImageUrl)
  pageFamilies['print-generic-master-formal4'].requiredTexts = [printOrder.productionOrderNo, printOrder.demandSnapshot.spuCode, ...basic.items.map(item => item.name)]
  const sourceImage = readFileSync(resolve('public', tee[0].skuImageUrl.slice(1)))
  function file(name, size) { if (sourceImage.length > size) throw Error('Corresponding original image exceeds approved fixture size'); const buffer = Buffer.concat([sourceImage, Buffer.alloc(size - sourceImage.length)]); return { name, mimeType: 'image/jpeg', buffer, size, sha256: hash(buffer), imageSource: tee[0].skuImageUrl } }
  const photos = Array.from({ length: 10 }, (_, i) => file(`隔离性能照片${i + 1}.jpg`, 512 * 1024)), paper = file('隔离性能纸单素材-非工厂签字.jpg', 2 * 1024 * 1024)
  const sharedFile = { id: 'qexec-shared-history', ...file('历史共享照片.jpg', 512 * 1024) }
  const originalHash = hash(history.pcs.map(row => JSON.stringify(row)).join('\n'))
  if (history.manifest.actual.rounds !== 20000 || history.manifest.actual.production + history.manifest.actual.inventory + history.manifest.actual.sample !== 10000 || inventorySkus.length !== 24 || formal.length !== 5) throw Error('Complete history/current shape cardinality invalid.')
  if (engine.getPostQcSummary(invCompletable.inspection, supply(invCompletable)).inspectedQty !== 2400) throw Error('Heavy inspection fixture not complete.')
  const ownAssetUrls = [...new Set([ownOrder.demandSnapshot.styleImageUrl, originalPrintSource.productImageUrl, ...formal.map(sku => sku.imageUrl), ...originalPrintSource.bomSnapshot.map(material => material.materialImageUrl)].filter(Boolean))]
  const ownAssets = ownAssetUrls.map(url => {
    if (!url.startsWith('/') || !existsSync(resolve('public', url.slice(1)))) throw Error(`Original five-SKU print asset is absent: ${url}`)
    const bytes = readFileSync(resolve('public', url.slice(1)))
    return { url, bytes: bytes.length, sha256: hash(bytes) }
  })
  for (const [task, expectedSkus] of [[prodComplete, formal], [printQc, printSkus]]) {
    const summary = engine.assertPostQcCompletable(task.inspection, supply(task), true)
    if (task.status !== '质检完成' || task.inspection.snapshot.items.length !== 40 || task.inspection.snapshot.skuSnapshots.length !== expectedSkus.length || task.inspection.rounds.length !== 1 || summary.inspectedQty !== 100 || summary.passedQty !== 100 || task.results.length !== expectedSkus.length || task.results.some(result => result.inspectedQty !== result.expectedQty || result.passedQty !== result.expectedQty || result.defectQty || result.returnQty || result.uninspectedQty) || !task.inspection.papers.some(paper => paper.version === task.inspection.paperVersion && paper.url === 'pcs-file:qexec-shared-history')) throw Error('Positive master requires its complete original fixed40-item/SKU snapshots, actual round/results and current-version original Blob reference.')
  }
  const paperManifest = (task, paperId) => ({ id: paperId, version: task.inspection.paperVersion, name: task.inspection.papers.find(paper => paper.id === paperId).name, url: 'pcs-file:qexec-shared-history', bytes: sharedFile.size, sha256: sharedFile.sha256, referenceOwnership: 'Current-version paper reuses original shared Blob entity/bytes. Both historical consumers remain. Isolated validation document, never evidence of a field signature.' })
  const manifest = {
    inherited: history.manifest, historyPcsSha256: originalHash, additionalRows: baseAdditions.length,
    phases: Object.fromEntries(Object.entries(phases).map(([name, rows]) => [name, { rowCount: rows.length, sha256: hash(JSON.stringify(rows)) }])),
    current: { inventorySkus: 24, inventoryReceived: 2400, productionSkus: 5, productionReceived: 100, productionOrderId: template.productionOrderId, productionOrderNo: template.productionOrderNo, executionTaskId: delivery.executionTaskId, assignmentId: delivery.assignmentId, images: inventorySkus.map(sku => ({ id: sku.skuId, sourceFormalSku: tee.find(row => row.skuImageUrl === sku.imageUrl)?.skuId, imageUrl: sku.imageUrl, colorName: sku.colorName })), aliases: 'QEXEC inventory SKU/size identities are explicit performance-only copies of the matching original garment/color. Production five SKUs retain real current formal IDs/source.' },
    productionPrintPositive: { isolatedFixture: true, meaning: 'Declared completed QC/current-process stage for original five-SKU output validation only; not evidence this real order underwent field operations.', phase: 'process-open', families: ['entry:cold:print-generic-master-production5', 'entry:refresh:print-generic-master-production5', 'entry:spa:print-generic-master-production5'], productionOrderId: template.productionOrderId, productionOrderNo: template.productionOrderNo, qcTaskId: id.prod, styleId: template.styleId, styleCode: ownOrder.demandSnapshot.spuCode, techPackVersionId: ownOrder.techPackSnapshot.sourceTechPackVersionId, skuCount: formal.length, quantityPerSku: 20, totalQuantity: 100, skus: formal, fixedStandardItems: prodComplete.inspection.snapshot.items.length, fixedSkuSnapshots: prodComplete.inspection.snapshot.skuSnapshots.length, rounds: prodComplete.inspection.rounds.length, materialBindings: originalPrintSource.bomSnapshot.map(material => ({ sku: material.materialSku, materialCode: material.materialCode, name: material.materialName, imageUrl: material.materialImageUrl })), assets: ownAssets, records: phases['process-open'].map(value => ({ id: value.id, collection: value.collection })), paper: paperManifest(prodComplete, 'QEXEC-SHARED-PAPER') },
    additionalProductionPrintPositive: { isolatedFixture: true, meaning: 'Retained additional complete QC/process/outbound stage for PO082 four-SKU output validation; not a substitute for original five-SKU family or a field operation.', phase: 'print-formal4', families: ['entry:cold:print-generic-master-formal4', 'entry:refresh:print-generic-master-formal4', 'entry:spa:print-generic-master-formal4'], productionOrderId: printOrder.productionOrderId, productionOrderNo: printOrder.productionOrderNo, qcTaskId: printIds.qc, styleId: printOrder.techPackSnapshot.styleId, styleCode: printOrder.demandSnapshot.spuCode, techPackVersionId: printOrder.techPackSnapshot.sourceTechPackVersionId, skuCount: printSkus.length, quantityPerSku: printQty, totalQuantity: printSkus.length * printQty, skus: printSkus, fixedStandardItems: printQc.inspection.snapshot.items.length, fixedSkuSnapshots: printQc.inspection.snapshot.skuSnapshots.length, rounds: printQc.inspection.rounds.length, materialBindings: printSource.bomSnapshot.map(material => ({ sku: material.materialSku, name: material.materialName, imageUrl: material.materialImageUrl })), assets: printAssets, records: formalPrintRows.map(value => ({ id: value.id, collection: value.collection })), outboundPreview: `/fcs/craft/post-finishing/print?type=OUTBOUND&id=${printIds.outbound}`, paper: paperManifest(printQc, 'QEXEC-PRINT-PAPER-082') },
    productionMaterialCompleteness: materialCompleteness,
    productionMissingMaterialGuard: { fixture: 'Dedicated isolated missing-material negative only, owned by root; the original three completed demo orders are positive sources.', unit: 'tests/unit/quality-print-material-image-identity.test.ts', browser: 'tests/quality-management-print-ready.spec.ts', passedByThisCollector: false },
    files: { paper: { bytes: paper.size, sha256: paper.sha256 }, photos: photos.map(f => ({ bytes: f.size, sha256: f.sha256 })), historicalShared: { id: sharedFile.id, bytes: sharedFile.size, sha256: sharedFile.sha256, consumers: 2, additionalConsumersByPhase: Object.fromEntries(Object.entries(phases).map(([name, rows]) => [name, rows.filter(row => row.collection === 'flow/qcTasks' && row.value.inspection?.papers.some(paper => paper.url === 'pcs-file:qexec-shared-history')).length])) } },
    pp: config.pp, notes: 'All original10000/20000 rows/trees remain unchanged. Original five-SKU execution/print/action/outbound/100-label loads are retained. PO082 complete-formal-source seven-row phase and three entry families are additions. Node construction is not evidence of business UI execution.'
  }
  return { ...history, baseAdditions, phases, manifest, photos, paper, sharedFile, formal, inventorySkus, actor, prodActor, postActor, expectedInventoryTransfers: [sent, ...classified.map(row => row.value)] }
}
mkdirSync(output, { recursive: true })
const fixture = await buildExecutionFixture()
writeFileSync(resolve(output, 'fixture-manifest.json'), JSON.stringify(fixture.manifest, null, 2))
writeFileSync(resolve(output, 'family-plan.json'), JSON.stringify(config, null, 2))
if (args.includes('--check-fixture')) {
  // Existing narrow Node IDB contract facility. Exercises the ORIGINAL full
  // restore/domain validator; this is expressly not native-browser IDB evidence.
  const { installPmsMemoryIdb } = await import('../../tests/helpers/pms-memory-idb.ts')
  const memory = installPmsMemoryIdb(), prior = new Map(['window', 'document', 'localStorage', 'IDBKeyRange'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
  const values = new Map(), local = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }
  const checkedPhase = opt('--check-phase', 'inv-open'), rows = new Map([...fixture.pcs.filter(row => row.id.startsWith(POST + '/')), ...fixture.baseAdditions.filter(row => row.id.startsWith(POST + '/')), ...fixture.phases[checkedPhase].filter(row => row.id.startsWith(POST + '/'))].map(row => [row.id, row]))
  const check = { nativeBrowserIdb: false, facility: 'existing tests/helpers/pms-memory-idb.ts; original readPcsRecords/ensurePostFinishingRecordState/registered domain validators unchanged', checkedPhase, originalManifest: fixture.manifest.inherited, installedPostRows: rows.size, passed: false }
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local })
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: local, addEventListener() {}, dispatchEvent() { return true } } })
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {} })
    Object.defineProperty(globalThis, 'IDBKeyRange', { configurable: true, value: { bound: (lower, upper, lowerOpen = false, upperOpen = false) => ({ lower, upper, lowerOpen, upperOpen }) } })
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open(PCS, 2); request.onupgradeneeded = () => { for (const name of ['records','files','operations','meta']) request.result.createObjectStore(name, { keyPath: 'id' }) }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const records = [...rows.values()]
    for (let offset = 0; offset < records.length; offset += 150) await new Promise((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); records.slice(offset, offset + 150).forEach(row => tx.objectStore('records').put(row)); tx.oncomplete = resolve; tx.onabort = () => reject(tx.error) })
    await new Promise((resolve, reject) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put({ id: fixture.sharedFile.id, blob: new Blob([fixture.sharedFile.buffer], { type: fixture.sharedFile.mimeType }) }); tx.oncomplete = resolve; tx.onabort = () => reject(tx.error) })
    const repository = await import('../../src/data/fcs/post-finishing-records.ts'), flow = await import('../../src/data/fcs/post-finishing-full-flow.ts')
    await repository.ensurePostFinishingRecordState()
    if (repository.getPostFinishingStorageFailure()) throw Error(repository.getPostFinishingStorageFailure())
    const loaded = flow.listPostFinishingFullFlowQcTasks(), original = loaded.filter(row => row.qcTaskId.startsWith('QPERF-QC-'))
    check.originalQc = original.length; check.originalRounds = original.reduce((sum,row) => sum + row.inspection.rounds.length,0)
    check.extraSharedConsumers = loaded.filter(row => row.qcTaskId.startsWith('QEXEC-SHARED-HISTORY-')).length
    if (check.originalQc !== 8000 || check.originalRounds !== 20000 || check.extraSharedConsumers !== 2) throw Error('Original full restore dropped required history/rounds/shared consumers')
    const execution = loaded.find(task => task.qcTaskId === id.prod)
    check.originalExecutionLoad = { skuCount: execution?.lines.length, quantities: execution?.lines.map(line => line.expectedQty), total: execution?.lines.reduce((sum, line) => sum + line.expectedQty, 0) }
    if (check.originalExecutionLoad.skuCount !== 5 || check.originalExecutionLoad.quantities.some(quantity => quantity !== 20) || check.originalExecutionLoad.total !== 100) throw Error('Original five-SKU execution load changed while preparing a separate print source')
    if (['process-open', 'print-formal4'].includes(checkedPhase)) {
      const expected = checkedPhase === 'print-formal4' ? fixture.manifest.additionalProductionPrintPositive : fixture.manifest.productionPrintPositive, task = loaded.find(task => task.qcTaskId === expected.qcTaskId)
      check.formalPrintSource = { qcTaskId: task?.qcTaskId, productionOrderId: task?.productionOrderId, productionOrderNo: task?.productionOrderNo, skuCount: task?.lines.length, skuIds: task?.lines.map(line => line.sku.skuId), quantities: task?.lines.map(line => line.expectedQty), status: task?.status, resultTotal: task?.results.reduce((sum, line) => sum + line.passedQty, 0), assets: expected.assets, materialBindings: expected.materialBindings }
      if (!task || task.productionOrderId !== expected.productionOrderId || task.productionOrderNo !== expected.productionOrderNo || task.lines.length !== expected.skuCount || task.lines.some((line, index) => line.sku.skuId !== expected.skus[index].skuId || line.sku.barcode !== expected.skus[index].barcode || line.sku.imageUrl !== expected.skus[index].imageUrl || line.expectedQty !== expected.quantityPerSku) || task.status !== '质检完成' || check.formalPrintSource.resultTotal !== 100) throw Error('Full domain restore changed/dropped the selected exact complete-BOM five/four-SKU print source')
      check.formalPrintSource.fixedStandardItems = task.inspection?.snapshot.items.length
      check.formalPrintSource.fixedSkuSnapshots = task.inspection?.snapshot.skuSnapshots.length
      check.formalPrintSource.rounds = task.inspection?.rounds.length
      check.formalPrintSource.paperVersion = task.inspection?.paperVersion
      // Original restoration resolves pcs-file IDs to temporary object URLs.
      // Validate the durable reference with an actual native-store read, not
      // by mistaking that valid in-memory URL resolution for persistent data.
      const persistedQcRow = await new Promise((resolve, reject) => { const tx = db.transaction('records', 'readonly'), request = tx.objectStore('records').get(key('qcTasks', task.qcTaskId)); let value; request.onsuccess = () => { value = request.result }; tx.oncomplete = () => resolve(value); tx.onabort = () => reject(tx.error) })
      const printPaper = persistedQcRow?.value.inspection?.papers.find(paper => paper.id === expected.paper.id), loadedPaper = task.inspection?.papers.find(paper => paper.id === expected.paper.id)
      if (check.formalPrintSource.fixedStandardItems !== 40 || check.formalPrintSource.fixedSkuSnapshots !== expected.skuCount || check.formalPrintSource.rounds !== 1 || printPaper?.version !== task.inspection?.paperVersion || loadedPaper?.version !== task.inspection?.paperVersion || printPaper?.url !== expected.paper.url) throw Error('Formal print fixture lost its current fixed standard/round/paper-version reference')
      check.formalPrintSource.paperDurableReference = { id: printPaper.id, url: printPaper.url, version: printPaper.version, temporaryUrlResolved: typeof loadedPaper.url === 'string' && loadedPaper.url.startsWith('blob:') }
      const fileRow = await new Promise((resolve, reject) => { const tx = db.transaction('files', 'readonly'), request = tx.objectStore('files').get(printPaper.url.slice(9)); let value; request.onsuccess = () => { value = request.result }; tx.oncomplete = () => resolve(value); tx.onabort = () => reject(tx.error) })
      const fileBytes = fileRow?.blob instanceof Blob ? Buffer.from(await fileRow.blob.arrayBuffer()) : undefined
      check.formalPrintSource.paperFile = { id: fileRow?.id, bytes: fileBytes?.length, sha256: fileBytes ? hash(fileBytes) : undefined, name: printPaper.name, version: printPaper.version, declaredNotFieldSignature: true }
      if (!fileBytes || fileBytes.length !== expected.paper.bytes || hash(fileBytes) !== expected.paper.sha256) throw Error('Formal print paper reference does not resolve to the declared actual original Blob bytes')
      if (fixture.manifest.productionMaterialCompleteness.length !== 3 || fixture.manifest.productionMaterialCompleteness.some(row => !row.complete)) throw Error('Original three demo material-completeness checks must remain explicit positive checks.')
    }
    check.passed = true
  } catch (error) { check.error = { name: error.name, message: error.message, stack: error.stack } }
  finally { memory.restore(); for (const [name, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name) } }
  writeFileSync(resolve(output, opt('--check-report', 'fixture-full-restore.json')), JSON.stringify(check, null, 2)); console.log(JSON.stringify(check, null, 2)); process.exit(check.passed ? 0 : 1)
}
if (!args.includes('--run')) { console.log(JSON.stringify({ prepared: true, executed: false, families: families.length, formalSamples: families.length * 5, originalHistory: fixture.manifest.inherited.actual, originalBytes: fixture.manifest.inherited.serializedRowBytes, phaseNames: Object.keys(fixture.phases), pp: config.pp }, null, 2)); process.exit(0) }

const indexResponse = await fetch(base + '/'), indexText = await indexResponse.text()
if (!indexResponse.ok || (!diagnostic && (indexText.includes('/@vite/client') || !/\/assets\/[^"']+\.js/.test(indexText)))) throw Error('Formal execution requires a fixed production preview; Vite is diagnostic only.')
if (!diagnostic && (!existsSync(resolve(dist, 'index.html')) || hash(readFileSync(resolve(dist, 'index.html'))) !== hash(indexText))) throw Error('Served index does not match --dist-dir.')
// A real static response establishes Chromium's loopback address space. A
// route.fulfill-created synthetic document must not be used for this preload.
function buildArtifactHashes() {
  const paths = ['index.html']
  const walk = directory => { for (const entry of readdirSync(resolve(dist, directory), { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) { const path = `${directory}/${entry.name}`; if (entry.isDirectory()) walk(path); else if (entry.isFile()) paths.push(path) } }
  if (existsSync(resolve(dist, 'assets'))) walk('assets')
  return Object.fromEntries(paths.map(path => [path, hash(readFileSync(resolve(dist, path)))]))
}
const buildBeforePreload = buildArtifactHashes(), preloadPath = '/__quality-execution-preload.html', preloadFile = resolve(dist, preloadPath.slice(1))
const preloadHtml = '<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>质量夹具隔离预装</title><link rel="icon" href="data:,"></head><body><main>隔离空白预装页；没有加载业务应用</main></body></html>'
const preloadCreated = !existsSync(preloadFile)
if (preloadCreated) writeFileSync(preloadFile, preloadHtml, { flag: 'wx' })
else if (!readFileSync(preloadFile).equals(Buffer.from(preloadHtml))) throw Error('Existing verification preload HTML has different bytes; refusing to overwrite it.')
const preloadDefinition = { path: preloadFile, url: base + preloadPath, bytes: Buffer.byteLength(preloadHtml), sha256: hash(preloadHtml), created: preloadCreated, responseKind: 'real static preview GET', routeInterception: false, applicationIndexAndAssetHashesBefore: buildBeforePreload }
const runId = new Date().toISOString().replaceAll(':', '-'), runDir = resolve(output, runId)
mkdirSync(runDir, { recursive: true })
// Chromium's native disk-file selection emits a trusted change event. The
// Playwright in-memory payload path emits a synthetic event, which must not
// bypass this collector's trusted-event origin. Keep every original byte.
const selectedFilesDir = resolve(runDir, 'selected-files')
mkdirSync(selectedFilesDir, { recursive: true })
const saveSelection = file => {
  const path = resolve(selectedFilesDir, file.name)
  if (!path.startsWith(selectedFilesDir + '/')) throw Error('Unexpected fixture file name')
  writeFileSync(path, file.buffer)
  if (hash(readFileSync(path)) !== hash(file.buffer)) throw Error('Original selection bytes changed')
  return path
}
const photoSelectionPaths = fixture.photos.map(saveSelection), paperSelectionPath = saveSelection(fixture.paper)
const sourcePaths = ['scripts/verification/quality-execution-performance.mjs', 'scripts/verification/quality-performance-fixture.mjs', 'scripts/verification/quality-runtime-asset-proof.mjs', 'src/main.ts', 'src/data/fcs/post-finishing-full-flow.ts', 'src/data/fcs/post-finishing-records.ts', 'src/pages/process-factory/post-finishing/qc-workbench.ts', 'src/pages/process-factory/post-finishing/work-order-detail.ts', 'src/pages/pda-handover-detail.ts', 'src/pages/print/print-preview.ts']
const sourceHashes = () => Object.fromEntries(sourcePaths.map(path => [path, hash(readFileSync(path))]))
const report = { runId, config, startedAt: new Date().toISOString(), fixture: fixture.manifest, head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim(), sourceBefore: sourceHashes(), indexSha256: hash(indexText), host: { cpu: cpus()[0]?.model, cpus: cpus().length, ram: totalmem(), freeRam: freemem(), load: loadavg() }, samples: [], errors: [], assets: {}, installations: [], printArtifacts: [], browserDiagnostics: [], preloadDefinition, preloadDocuments: [], completed: false, passed: false, diagnosticOnly: diagnostic }
function checkpoint() {
  report.familyResults = families.map(family => { const samples = report.samples.filter(row => row.family === family), values = samples.filter(row => row.valid).map(row => row.ms).sort((a, b) => a - b); return { family, expected: 5, attempted: samples.length, valid: values.length, p50: values[Math.floor(values.length * .5)] ?? null, p95: values[Math.min(values.length - 1, Math.floor(values.length * .95))] ?? null, max: values.at(-1) ?? null, pass: samples.length >= 5 && samples.every(row => row.valid && row.ms <= limitMs) } })
  writeFileSync(resolve(runDir, 'report.json'), JSON.stringify(report, null, 2)); writeFileSync(resolve(output, 'latest.json'), JSON.stringify({ runId, report: resolve(runDir, 'report.json'), completed: report.completed, passed: report.passed }, null, 2))
}
checkpoint()
// Observation only: native trusted event, native IDB lifecycle, DOM paint and original Blob reads.
function installCollector() {
  const c = window.__executionPerf = { samples: [], armed: null, active: null, mutation: 0, transactions: [], longTasks: [], dialogsMs: 0, errors: [] }
  new MutationObserver(() => c.mutation++).observe(document, { subtree: true, childList: true, attributes: true, characterData: true })
  try { new PerformanceObserver(list => c.longTasks.push(...list.getEntries().map(row => ({ start: row.startTime, duration: row.duration })))).observe({ type: 'longtask', buffered: true }) } catch {}
  const nativeConfirm = window.confirm
  window.confirm = function(...values) { const start = performance.now(); try { return nativeConfirm.apply(this, values) } finally { c.dialogsMs += performance.now() - start } }
  const nativeTransaction = IDBDatabase.prototype.transaction
  IDBDatabase.prototype.transaction = function(...values) {
    const tx = nativeTransaction.apply(this, values), record = { database: this.name, mode: tx.mode, stores: [...tx.objectStoreNames], start: performance.now(), end: null, status: 'pending' }
    if(window.__qualityTraceNativeReads && this.name==='higood-cutting-records-v1')record.stack=new Error('diagnostic native read').stack
    c.transactions.push(record)
    tx.addEventListener('complete', () => { record.end = performance.now(); record.status = 'complete'; if (tx.mode === 'readwrite' && c.active) c.active.commits++ })
    tx.addEventListener('abort', () => { record.end = performance.now(); record.status = 'abort' }); return tx
  }
  const get = (obj, path) => path.split('.').reduce((value, part) => value?.[part], obj)
  const nativeRead = async (database, store, requestSpec) => {
    const db = await new Promise((resolve, reject) => { const req = indexedDB.open(database); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) })
    try { return await new Promise((resolve, reject) => { const tx = db.transaction(store, 'readonly'), request = requestSpec.id ? tx.objectStore(store).get(requestSpec.id) : tx.objectStore(store).getAll(requestSpec.prefix ? IDBKeyRange.bound(requestSpec.prefix, requestSpec.prefix + '\uffff') : undefined); let value; request.onsuccess = () => { value = request.result }; tx.oncomplete = () => resolve(value); tx.onabort = () => reject(tx.error) }) } finally { db.close() }
  }
  const readback = async spec => {
    const facts = []
    for (const check of spec.checks || []) {
      const prefix = check.prefix || (check.collection?.startsWith('flow/') ? `higood-fcs-post-finishing-records/${check.collection}/` : check.collection?.startsWith('higood-finished-inventory/') ? `${check.collection}/` : undefined)
      const data = await nativeRead(check.database || 'higood-pcs-records', check.store || 'records', { ...check, prefix })
      let rows = check.id ? (data ? [data] : []) : data.filter(row => (!check.collection || row.collection === check.collection) && Object.entries(check.where || {}).every(([path, value]) => get(row, path) === value))
      if (check.count !== undefined && rows.length !== check.count) return null
      if ((!rows.length && check.count !== 0) || (check.fields && !Object.entries(check.fields).every(([path, value]) => get(rows[0], path) === value))) return null
      facts.push({ id: check.id, collection: check.collection, count: rows.length, fields: Object.fromEntries(Object.keys(check.fields || {}).map(path => [path, get(rows[0], path)])) })
    }
    if (spec.files) {
      const source = await nativeRead('higood-pcs-records', 'records', { id: spec.files.recordId })
      if (!source) return null
      const ids = new Set(); function refs(value) { if (typeof value === 'string' && value.startsWith('pcs-file:')) ids.add(value.slice(9)); else if (Array.isArray(value)) value.forEach(refs); else if (value && typeof value === 'object') Object.values(value).forEach(refs) } refs(source.value)
      const blobs = []
      for (const id of ids) { const row = await nativeRead('higood-pcs-records', 'files', { id }); if (!(row?.blob instanceof Blob)) return null; const bytes = await row.blob.arrayBuffer(), digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join(''); blobs.push({ id, size: bytes.byteLength, sha256: digest, type: row.blob.type }) }
      for (const expected of spec.files.expected) if (blobs.filter(row => row.size === expected.bytes && row.sha256 === expected.sha256).length !== expected.count) return null
      const shared = await nativeRead('higood-pcs-records', 'files', { id: 'qexec-shared-history' }); if (!(shared?.blob instanceof Blob) || shared.blob.size !== 512 * 1024) return null
      facts.push({ blobs, sharedFileRetained: true })
    }
    return facts
  }
  function begin(spec, origin) {
    const active = c.active = { spec, origin, dialogsStart: c.dialogsMs, commits: 0, previous: -1, frames: 0, reading: false }
    async function frame() {
      if (c.active !== active) return
      const host = document.body, selectorReady = !spec.selector || !!document.querySelector(spec.selector), text = host?.innerText || ''
      const loadFailure = /页面(?:内容)?加载失败|当前记录未能读取，暂不能继续操作/.test(text)
      if (loadFailure) {
        c.samples.push({ family: spec.family, trial: spec.trial, valid: false, failureKind: 'actual-page-load-failure', error: 'Actual application rendered its page-load failure; no valid performance sample.', diagnosticElapsedMs: performance.now() - origin, route: location.pathname + location.search, text: text.slice(-4000), transactions: c.transactions.filter(row => (row.end ?? performance.now()) >= origin), longTasks: c.longTasks.filter(row => row.start + row.duration >= origin) })
        c.active = null; return
      }
      const printRootReady = spec.print && selectorReady && (!spec.matchPath || location.pathname + location.search === spec.matchPath)
      const missingPrintImages = printRootReady ? [...document.querySelectorAll('[data-print-image-missing]')] : []
      if (missingPrintImages.length) {
        c.samples.push({ family: spec.family, trial: spec.trial, valid: false, failureKind: 'required-print-image-missing', error: 'Actual print document declares missing necessary source image(s); other decoded images cannot make this a valid positive sample.', diagnosticElapsedMs: performance.now() - origin, route: location.pathname + location.search, missingImages: missingPrintImages.map(node => ({ text: node.textContent, html: node.outerHTML })), transactions: c.transactions.filter(row => (row.end ?? performance.now()) >= origin) })
        c.active = null; return
      }
      let ready = !!host && selectorReady && (!spec.text || text.includes(spec.text)) && (!spec.absentSelector || !document.querySelector(spec.absentSelector)) && (!spec.notText || !text.includes(spec.notText)) && document.fonts?.status !== 'loading' && (!spec.minCommits || active.commits >= spec.minCommits)
      if (spec.matchPath && location.pathname + location.search !== spec.matchPath) ready = false
      if (spec.requiredTexts?.some(value => !text.includes(value))) ready = false
      const images = [...(host?.querySelectorAll('img') || [])]
      if (images.length < (spec.images || 0) || images.some(image => !image.complete || image.naturalWidth <= 0 || image.hidden)) ready = false
      if (spec.requiredImageUrls?.some(url => !images.some(image => new URL(image.currentSrc || image.src, location.href).pathname === new URL(url, location.href).pathname))) ready = false
      if (spec.selectedFiles) { const input = document.querySelector(spec.selectedFiles.selector); if (input?.files?.length !== spec.selectedFiles.count) ready = false; if (spec.selectedFiles.preview && [...host.querySelectorAll('img')].filter(image => image.src.startsWith('blob:') && image.naturalWidth > 0 && !image.hidden).length < spec.selectedFiles.count) ready = false }
      const labels = [...host.querySelectorAll('[data-outbound-unit-label]')]
      if (spec.unitLabels) {
        if (labels.length !== 100 || document.querySelector('[data-label-count]')?.getAttribute('data-label-count') !== '100') ready = false
        for (const expected of spec.expectedUnitLabels || []) {
          const matching = labels.filter(node => node.dataset.skuId === expected.skuId)
          if (matching.length !== 20 || matching.some(node => !node.innerText.includes(expected.skuCode) || node.querySelector('svg[data-real-barcode]')?.getAttribute('data-barcode-value') !== expected.barcode)) ready = false
        }
        if (new Set(labels.map(node => node.dataset.skuId)).size !== 5) ready = false
      }
      const codes = [...host.querySelectorAll('svg[data-real-barcode]')]
      if (spec.code && (!codes.length || codes.some(node => !node.querySelector('rect')))) ready = false
      for (const qr of host.querySelectorAll('[data-real-qr]')) if (!qr.querySelector('svg path,svg rect')) ready = false
      if (ready && images.some(image => !image.__executionDecoded)) { try { await Promise.all(images.map(async image => { await image.decode(); image.__executionDecoded = true })) } catch { ready = false } }
      active.frames = ready && c.mutation === active.previous ? active.frames + 1 : 0; active.previous = c.mutation
      if (active.frames >= 2 && !active.reading) {
        active.reading = true
        try { const facts = await readback(spec); if (facts === null) { active.reading = false; requestAnimationFrame(frame); return }
          const end = performance.now(), dialogWait = c.dialogsMs - active.dialogsStart
          c.samples.push({ family: spec.family, ms: end - origin - dialogWait, grossMs: end - origin, excludedNativeDialogMs: dialogWait, valid: true, route: location.pathname + location.search, images: images.length, decodedImages: images.filter(image => image.__executionDecoded).length, ...(spec.print ? { imageEvidence: images.map(image => ({ src: image.currentSrc || image.src, width: image.naturalWidth, height: image.naturalHeight, hidden: image.hidden })), requiredImageUrls: spec.requiredImageUrls || [], missingPrintImageMarkers: 0 } : {}), codeSvgs: codes.length, unitLabels: labels.length, labelSkuCounts: Object.fromEntries([...new Set(labels.map(node => node.dataset.skuId))].map(id => [id, labels.filter(node => node.dataset.skuId === id).length])), domNodes: host.querySelectorAll('*').length, commits: active.commits, nativeReadback: facts, longTasks: c.longTasks.filter(row => row.start + row.duration >= origin), transactions: c.transactions.filter(row => (row.end ?? end) >= origin) }); c.active = null
        } catch (error) { c.samples.push({ family: spec.family, valid: false, error: String(error) }); c.active = null }
      } else requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }
  c.arm = spec => { c.armed = spec }; c.navigate = spec => begin(spec, 0)
  for (const eventType of ['click', 'change', 'keydown']) document.addEventListener(eventType, event => { if (event.isTrusted && c.armed && (!c.armed.eventType || c.armed.eventType === eventType) && (eventType !== 'keydown' || event.key === 'Enter')) { const spec = c.armed; c.armed = null; begin(spec, performance.now()) } }, true)
}
const fixtureTransport = await startQualityPerformanceFixtureServer({ fixture: { pcs: fixture.pcs, cutting: fixture.cutting, manifest: fixture.manifest.inherited }, allowedOrigin: new URL(base).origin, overlays: Object.fromEntries(Object.entries(fixture.phases).map(([name, rows]) => [name, [...fixture.baseAdditions, ...rows]])), files: [fixture.sharedFile] })
report.fixtureTransport = { mechanism: 'isolated preload fetches localhost readonly NDJSON and original Blob bytes directly; no Playwright serialization of the 211MiB rows', origin: fixtureTransport.baseUrl, originalManifestSha256: fixtureTransport.manifest.original.sha256, streams: fixtureTransport.manifest.streams }
const browser = await chromium.launch({ headless: true }).catch(async error => { await fixtureTransport.close(); throw error }); report.browserVersion = browser.version()
const assetReads = [], diagnosticReads = [], pendingEvidence = new Set(), contextEvidence = new WeakMap()
function trackEvidence(page, promise) {
  const context = page.context(), pending = contextEvidence.get(context) || new Set()
  contextEvidence.set(context, pending); pending.add(promise); pendingEvidence.add(promise)
  const settled = () => { pending.delete(promise); pendingEvidence.delete(promise) }
  promise.then(settled, settled)
  return promise
}
async function drainEvidence(context, reason) {
  const pending = context ? contextEvidence.get(context) : pendingEvidence
  const startedAt = Date.now(), initialReads = pending?.size || 0
  // Response handlers can start another body read while an earlier one settles.
  // Drain the live set, rather than one stale snapshot, before closing its CDP target.
  while (pending?.size) await Promise.allSettled([...pending])
  report.evidenceDrains ||= []
  report.evidenceDrains.push({ reason, initialReads, remainingReads: pending?.size || 0, elapsedMs: Date.now() - startedAt, outsidePerformanceMeasurement: true })
  checkpoint()
}
async function closeContextWithEvidence(context, reason) {
  await drainEvidence(context, reason)
  await context.close()
}
function attachPageDiagnostics(page, phase) {
  page.on('pageerror', error => { const item = { phase, type: 'pageerror', route: page.url(), message: error.message, stack: error.stack }; report.errors.push(item); report.browserDiagnostics.push(item) })
  page.on('console', message => {
    if (message.type() !== 'error') return
    const item = { phase, type: 'console-error', route: page.url(), text: message.text(), location: message.location(), arguments: [] }
    report.errors.push(item); report.browserDiagnostics.push(item)
    diagnosticReads.push(trackEvidence(page, (async () => { item.arguments = await Promise.all(message.args().map(arg => arg.evaluate(value => value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : typeof value === 'object' && value !== null ? JSON.parse(JSON.stringify(value)) : String(value)).catch(error => ({ unavailable: String(error) })))); checkpoint() })().catch(error => { report.errors.push({ phase, type: 'diagnostic-evidence', message: String(error) }); checkpoint() })))
  })
  page.on('requestfailed', request => { const item = { phase, type: 'requestfailed', route: page.url(), url: request.url(), method: request.method(), resourceType: request.resourceType(), failure: request.failure() }; report.errors.push(item); report.browserDiagnostics.push(item); checkpoint() })
}
async function openContext(phase, actor = 'PF-USER-QC-MGR', pda = false) {
  const context = await browser.newContext({ viewport: pda ? { width: 390, height: 844 } : { width: 1024, height: 768 }, timezoneId: 'Asia/Jakarta' }), preload = await context.newPage()
  attachPageDiagnostics(preload, `fixture-preload:${phase}`)
  const preloadEvidence = { phase, requests: [], responses: [], document: null, noApplicationAssets: false }
  const preloadResponseCompletions = []
  report.preloadDocuments.push(preloadEvidence)
  preload.on('request', request => preloadEvidence.requests.push({ url: request.url(), method: request.method(), resourceType: request.resourceType() }))
  preload.on('response', response => {
    const headers = response.headers()
    preloadEvidence.responses.push({ url: response.url(), status: response.status(), resourceType: response.request().resourceType(), contentType: headers['content-type'] || null, contentLength: headers['content-length'] ? Number(headers['content-length']) : null })
    // Native readback can precede Chromium's request-finished event. The load
    // state alone may already be satisfied by the initial static document.
    preloadResponseCompletions.push(response.finished().then(error => ({ url: response.url(), error: error ? String(error) : null })))
  })
  const documentResponse = await preload.goto(preloadDefinition.url, { waitUntil: 'load' })
  if (!documentResponse) throw Error('Real fixture preload document did not return an HTTP response')
  const documentBytes = await documentResponse.body(), documentHeaders = documentResponse.headers()
  preloadEvidence.document = { url: documentResponse.url(), status: documentResponse.status(), contentType: documentHeaders['content-type'] || '', bytes: documentBytes.length, sha256: hash(documentBytes), serverAddress: await documentResponse.serverAddr(), fromServiceWorker: documentResponse.fromServiceWorker(), actualStaticBytesMatch: hash(documentBytes) === preloadDefinition.sha256 }
  checkpoint()
  if (documentResponse.status() !== 200 || !documentHeaders['content-type']?.includes('text/html') || !preloadEvidence.document.actualStaticBytesMatch || documentResponse.url() !== preloadDefinition.url) throw Error('Preview must return the exact verification-only static HTML; app fallback/interception is not accepted')
  if (await preload.locator('script[src],link[rel="stylesheet"],img').count()) throw Error('Fixture preload document unexpectedly includes application assets')
  let installation, rejectPreload, preloadTimer
  const failed=request=>rejectPreload(new Error(`Native fixture request failed before app timing: ${request.url()} ${request.failure()?.errorText || ''}`))
  const transportFailure=new Promise((_,reject)=>{rejectPreload=reject;preload.on('requestfailed',failed)})
  const timeout=new Promise((_,reject)=>{preloadTimer=setTimeout(()=>reject(new Error(`Native fixture preload timed out before app timing: ${phase}`)),90000)})
  try { installation=await Promise.race([preload.evaluate(installQualityPerformanceNativeFixture,fixtureTransport.descriptor(phase)),transportFailure,timeout]) }
  finally {clearTimeout(preloadTimer);preload.off('requestfailed',failed)}
  preloadEvidence.resourceTiming = await preload.evaluate(() => performance.getEntriesByType('resource').map(entry => ({ name: entry.name, initiatorType: entry.initiatorType, duration: entry.duration, transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize })))
  preloadEvidence.noApplicationAssets = preloadEvidence.requests.every(request => !/(?:\/src\/|\/assets\/|\.(?:js|mjs|css)(?:[?#]|$))/.test(request.url) && (request.url === preloadDefinition.url || new URL(request.url).origin === fixtureTransport.baseUrl))
  if (!preloadEvidence.noApplicationAssets) throw Error('Fixture preload requested application assets; cold entry would be preheated')
  await preload.evaluate(({ actor, pdaSession }) => { localStorage.setItem('higood-fcs-post-finishing-current-actor-v1', actor); localStorage.setItem('fcs_pda_session', JSON.stringify(pdaSession)); localStorage.setItem('higood-fcs-post-finishing-current-authorizer-v1', 'AUTH-WH-001') }, { actor, pdaSession })
  report.installations.push({ phase, ...installation, phaseSha256: fixture.manifest.phases[phase].sha256, excludedFromPerformanceMeasurement: true })
  // A consumed stream can finish its browser network event after native IDB
  // readback. Let the real request finish before closing its document; do not
  // hide aborted requests from evidence or warm any application assets.
  preloadEvidence.finishedResponses = await Promise.all(preloadResponseCompletions)
  if (preloadEvidence.finishedResponses.some(response => response.error)) throw Error('Fixture response did not finish; raw preload diagnostics retained')
  await preload.waitForLoadState('networkidle')
  preloadEvidence.networkIdleBeforeClose = true
  await drainEvidence(context, `preload-close:${phase}`); await preload.close(); await context.addInitScript(installCollector);await context.addInitScript(trace=>{window.__qualityTraceNativeReads=trace},cpuProfile&&diagnostic)
  context.on('page', page => attachPageDiagnostics(page, phase))
  const page = await context.newPage()
  const assetProof=createQualityRuntimeAssetProof(dist)
  page.on('dialog', dialog => dialog.accept())
  page.on('response',response=>{
    if(!/\/assets\/.*\.(?:js|css)(?:\?|$)/.test(response.url()))return
    assetReads.push(trackEvidence(page,assetProof(response).then(proof=>{
      report.assets[new URL(response.url()).pathname]=proof
      report.assetProofs ||= [];report.assetProofs.push(proof)
      if(!proof.matches)report.errors.push({phase,type:'asset-mismatch',proof})
    }).catch(error=>{report.errors.push({phase,type:'asset',url:response.url(),status:response.status(),responseHeaders:response.headers(),requestHeaders:response.request().headers(),message:String(error)});checkpoint()})))
  })
  return { context, page }
}
async function waitForUntimedBusinessReady(page, spec, reason) {
  const startedAt = Date.now()
  // load only describes the document. Wait for the actual asynchronous business
  // content before a refresh or the trusted SPA click; never use this for cold entry.
  await page.waitForFunction(spec => {
    const text = document.body?.innerText || ''
    if (/页面(?:内容)?加载失败|当前记录未能读取，暂不能继续操作/.test(text)) throw Error('Business preparation rendered its actual load failure.')
    if (spec.print && document.querySelector('[data-print-image-missing]')) throw Error('Business preparation has a required missing print image.')
    if (!document.body || (spec.matchPath && location.pathname + location.search !== spec.matchPath) || (spec.selector && !document.querySelector(spec.selector)) || (spec.text && !text.includes(spec.text)) || spec.requiredTexts?.some(value => !text.includes(value)) || document.fonts?.status === 'loading') return false
    if (spec.heading && ![...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].some(node => node.textContent.trim() === spec.heading)) return false
    const images = [...document.images]
    if (images.length < (spec.images || 0) || images.some(image => !image.complete || image.naturalWidth <= 0 || image.hidden)) return false
    if (spec.requiredImageUrls?.some(url => !images.some(image => new URL(image.currentSrc || image.src, location.href).pathname === new URL(url, location.href).pathname))) return false
    const codes = [...document.querySelectorAll('svg[data-real-barcode]')]
    if (spec.code && (!codes.length || codes.some(node => !node.querySelector('rect')))) return false
    for (const qr of document.querySelectorAll('[data-real-qr]')) if (!qr.querySelector('svg path,svg rect')) return false
    return !window.__executionPerf?.transactions.some(tx => tx.status === 'pending')
  }, spec, { timeout: 90000, polling: 'raf' })
  await page.locator(spec.selector).first().waitFor({ state: 'visible', timeout: 90000 })
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode())) })
  await page.waitForFunction(() => {
    const collector = window.__executionPerf
    if (!collector || collector.transactions.some(tx => tx.status === 'pending')) return false
    const prior = collector.untimedReadiness
    collector.untimedReadiness = { mutation: collector.mutation, frames: prior?.mutation === collector.mutation ? prior.frames + 1 : 0 }
    return collector.untimedReadiness.frames >= 2
  }, undefined, { timeout: 90000, polling: 'raf' })
  await drainEvidence(page.context(), `prepared:${reason}`)
  report.untimedPreparations ||= []
  report.untimedPreparations.push({ reason, route: page.url(), selector: spec.selector, heading: spec.heading || null, elapsedMs: Date.now() - startedAt, outsidePerformanceMeasurement: true, readyBeforeMeasuredAction: true })
  checkpoint()
}
async function collect(page, spec, action, navigation = false) {
  const previous = navigation ? 0 : await page.evaluate(() => window.__executionPerf.samples.length)
  const profiler = cpuProfile ? await page.context().newCDPSession(page) : undefined
  try {
    if (profiler) { await profiler.send('Profiler.enable'); await profiler.send('Profiler.start') }
    if (navigation) { await action(); await page.evaluate(spec => window.__executionPerf.navigate(spec), spec) } else { await page.evaluate(spec => window.__executionPerf.arm(spec), spec); await action() }
    await page.waitForFunction(count => window.__executionPerf.samples.length > count, previous, { timeout: 90000, polling: 100 })
    const sample = await page.evaluate(() => window.__executionPerf.samples.at(-1)); sample.cpuProfiling = cpuProfile; report.samples.push(sample)
    if (!sample.valid) { await page.screenshot({ path: resolve(runDir, `failure-${report.samples.length}.png`), fullPage: true }).catch(() => {}); sample.browserDiagnostics = report.browserDiagnostics.filter(item => item.route === page.url()) }
  } catch (error) {
    const observed = await page.evaluate(() => ({ route: location.href, text: document.body.innerText.slice(0, 2400), images: [...document.images].map(image => ({ src: image.currentSrc || image.src, complete: image.complete, width: image.naturalWidth, hidden: image.hidden })), transactions: window.__executionPerf?.transactions, longTasks: window.__executionPerf?.longTasks })).catch(() => ({}))
    report.samples.push({ family: spec.family, valid: false, error: String(error), observed }); await page.screenshot({ path: resolve(runDir, `failure-${report.samples.length}.png`), fullPage: true }).catch(() => {})
  } finally {
    if (profiler) {
      const {profile} = await profiler.send('Profiler.stop')
      const path = resolve(runDir, `${spec.family.replace(/[^a-zA-Z0-9_-]/g, '_')}-${report.samples.length}.cpuprofile`)
      writeFileSync(path, JSON.stringify(profile)); report.cpuProfiles ||= []; report.cpuProfiles.push({family:spec.family,path,diagnosticOverhead:true})
      await profiler.detach()
    }
  }
  await drainEvidence(page.context(),'sample-byte-evidence-before-reuse')
  checkpoint()
  if(report.errors.some(error=>['asset','asset-mismatch'].includes(error.type)))throw Error('Runtime byte proof failed; stop this batch before repeating it')
}
async function capturePrintedArtifact(page, name, descriptor) {
  // Saved after collect(): PDF rendering, screenshot and metadata are deliberately outside the timed sample.
  if (!report.samples.at(-1)?.valid || await page.locator('[data-print-image-missing]').count()) throw Error(`Cannot label an invalid/missing-image document as a positive printed artifact: ${name}`)
  const pdfPath = resolve(runDir, `${name}.pdf`), screenshotPath = resolve(runDir, `${name}.png`)
  const rendered = await page.locator(descriptor.unitLabels ? '[data-testid="post-finishing-outbound-label-print"]' : descriptor.selector).first().evaluate(node => ({ text: node.innerText, display: getComputedStyle(node).display, visibility: getComputedStyle(node).visibility, rect: { width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }, imageCount: node.querySelectorAll('img').length, imageReadiness: [...node.querySelectorAll('img')].map(image => ({ src: image.currentSrc || image.src, width: image.naturalWidth, height: image.naturalHeight, hidden: image.hidden })), unitLabelCount: document.querySelectorAll('[data-outbound-unit-label]').length, codeCount: document.querySelectorAll('svg[data-real-barcode]').length }))
  if (rendered.display === 'none' || rendered.visibility === 'hidden' || rendered.rect.width <= 0 || rendered.rect.height <= 0 || !rendered.text.trim()) throw Error(`Print media hides or empties the actual business document: ${name}`)
  const bytes = await page.pdf({ path: pdfPath, format: 'A4', printBackground: true })
  await page.screenshot({ path: screenshotPath, fullPage: true })
  const artifact = { name, route: page.url(), pdfPath, screenshotPath, pdfBytes: bytes.length, pdfSha256: hash(bytes), rendered, measuredSampleFamily: report.samples.at(-1)?.family, outsidePerformanceMeasurement: true, media: 'print', format: 'A4', physicalPrintAcceptance: false }
  report.printArtifacts.push(artifact); writeFileSync(resolve(runDir, `${name}.print-metadata.json`), JSON.stringify(artifact, null, 2)); checkpoint()
}
async function navigateTrusted(page, path) {
  const before = await page.evaluate(path => { const app = document.querySelector('#app'); if (!app) throw Error('Actual application navigation root is missing'); const link = document.createElement('a'); link.dataset.executionPerformanceNavigation = ''; link.dataset.nav = path; link.href = path; link.textContent = '性能进入'; link.style.cssText = 'position:fixed;right:0;bottom:0;z-index:99999;background:white;padding:8px'; app.append(link); return { timeOrigin: performance.timeOrigin, route: location.pathname + location.search } }, path)
  await page.locator('[data-execution-performance-navigation]').last().click()
  const after = await page.evaluate(() => ({ timeOrigin: performance.timeOrigin, route: location.pathname + location.search }))
  if (after.timeOrigin !== before.timeOrigin) throw Error('Expected trusted SPA transition replaced the document; this is not a valid SPA performance sample.')
  report.spaTransitions ||= []
  report.spaTransitions.push({ before, after, expectedRoute: path, sameDocument: true })
}
const qcCheck = (which, fields) => ({ id: key('qcTasks', which), fields: Object.fromEntries(Object.entries(fields).map(([field, value]) => ['value.' + field, value])) })
const diagnosticFamilyPattern = opt('--families-regex', '')
if ((opt('--families', '') || diagnosticFamilyPattern) && !diagnostic) throw Error('A partial family run is diagnostic and cannot pass formal acceptance.')
const diagnosticFamilyMatcher = diagnosticFamilyPattern ? new RegExp(diagnosticFamilyPattern) : undefined
report.diagnosticSelection = { substring: opt('--families', ''), pattern: diagnosticFamilyPattern }
const selected = family => (!opt('--families', '') || family.includes(opt('--families', '')))
  && (!diagnosticFamilyMatcher || diagnosticFamilyMatcher.test(family))

const actions = {
  'claim-inventory24': { phase: 'pending', path: invPath, selector: qcSelector, actor: 'PF-USER-QC-MGR', minCommits: 1, checks: [qcCheck(id.inv, { status: '质检中' })] },
  'claim-production5': { phase: 'pending', path: prodPath, selector: qcSelector, actor: 'PF-USER-QC-B', minCommits: 1, checks: [qcCheck(id.prod, { status: '质检中' })] },
  'select-ten-photos': { phase: 'inv-open', path: invPath, selector: qcSelector, eventType: 'change', selectedFiles: { selector: '[data-qc-result-line] [data-qc-issue-files]', count: 10, preview: true } },
  'inventory-round30-photos': { phase: 'inv-open', path: invPath, selector: '[data-qc-upgrade-percent]', minCommits: 1, checks: [qcCheck(id.inv, { 'inspection.rounds.length': 1 })], files: { recordId: key('qcTasks', id.inv), expected: [{ bytes: 512 * 1024, count: 10, sha256: fixture.photos[0].sha256 }] } },
  'inventory-audit50': { phase: 'inv-audit50', path: invPath, selector: '[data-qc-result-line]', minCommits: 1, checks: [qcCheck(id.inv, { 'inspection.percent': 50 })] },
  'inventory-round50': { phase: 'inv-round50', path: invPath, selector: '[data-qc-upgrade-percent]', minCommits: 1, checks: [qcCheck(id.inv, { 'inspection.rounds.length': 2 })] },
  'inventory-audit100': { phase: 'inv-audit100', path: invPath, selector: '[data-qc-result-line]', minCommits: 1, checks: [qcCheck(id.inv, { 'inspection.percent': 100 })] },
  'inventory-round100': { phase: 'inv-round100', path: invPath, selector: '[data-post-finishing-action="full-flow-complete-qc"]', minCommits: 1, checks: [qcCheck(id.inv, { 'inspection.rounds.length': 3 })] },
  'inventory-complete': { phase: 'inv-completable', path: invPath, selector: '[data-post-finishing-field="qc-task-input"]', minCommits: 1, checks: [qcCheck(id.inv, { status: '质检完成' }), { id: invKey('applications', id.app), fields: { 'value.qcTaskId': id.inv } }, ...fixture.expectedInventoryTransfers.map(transfer => ({ id: invKey('transfers', transfer.id), count: 1, fields: { 'value.applicationId': id.app, 'value.category': transfer.category, 'value.targetId': transfer.targetId, 'value.lines.length': transfer.lines.length, ...Object.fromEntries(transfer.lines.flatMap((line, index) => [[`value.lines.${index}.skuId`, line.skuId], [`value.lines.${index}.quantity`, line.quantity]])) } })), { id: invKey('transfers', `${id.app}-返工交接`), count: 0 }] },
  'production-round': { phase: 'prod-open', path: prodPath, actor: 'PF-USER-QC-B', selector: '[data-post-finishing-action="full-flow-complete-qc"]', minCommits: 1, checks: [qcCheck(id.prod, { 'inspection.rounds.length': 1 })] },
  'select-paper2MiB': { phase: 'prod-paper', path: prodPath, actor: 'PF-USER-QC-B', selector: qcSelector, eventType: 'change', selectedFiles: { selector: '[data-qc-paper-file]', count: 1, preview: true } },
  'save-paper2MiB': { phase: 'prod-paper', path: prodPath, actor: 'PF-USER-QC-B', selector: qcSelector, minCommits: 1, checks: [qcCheck(id.prod, { 'inspection.papers.length': 1 })], files: { recordId: key('qcTasks', id.prod), expected: [{ bytes: 2 * 1024 * 1024, count: 1, sha256: fixture.paper.sha256 }] } },
  'production-complete': { phase: 'prod-completable', path: prodPath, actor: 'PF-USER-QC-B', selector: '[data-post-finishing-field="qc-task-input"]', minCommits: 1, checks: [qcCheck(id.prod, { status: '质检完成' }), { collection: 'flow/postTasks', where: { 'value.qcTaskId': id.prod }, count: 1 }] },
  'web-process-increment': { phase: 'process-open', path: postPath, actor: 'PF-USER-POST', selector: '[data-web-post-task]', absentSelector: '[data-post-entry-form]', minCommits: 1, checks: [{ collection: 'flow/processCompletions', where: { 'value.postTaskId': id.post }, count: 1 }, { id: key('postTasks', id.post), fields: { 'value.status': '后道中' } }] },
  'pda-process-increment': { phase: 'process-open', path: pdaPost, actor: 'PF-USER-POST', pda: true, selector: '[data-pda-post-task]', text: '熨烫本次已保存', minCommits: 1, checks: [{ collection: 'flow/processCompletions', where: { 'value.postTaskId': id.post }, count: 1 }] },
  'web-prepare-outbound': { phase: 'process-ready', path: postPath, actor: 'PF-USER-POST', selector: '[data-web-post-task]', absentSelector: '[data-post-entry-form]', minCommits: 1, checks: [{ collection: 'flow/outboundOrders', where: { 'value.postTaskId': id.post }, count: 1, fields: { 'value.status': '待出货' } }] },
  'pda-prepare-outbound': { phase: 'process-ready', path: pdaPost, actor: 'PF-USER-POST', pda: true, selector: '[data-pda-post-task]', text: '已准备出货', minCommits: 1, checks: [{ collection: 'flow/outboundOrders', where: { 'value.postTaskId': id.post }, count: 1, fields: { 'value.status': '待出货' } }] },
  'web-dispatch': { phase: 'prepared', path: outboundPath, actor: 'PF-USER-POST', selector: 'a[data-nav^="/fcs/craft/post-finishing/print?type=OUTBOUND&"]', text: '待仓库接收', minCommits: 1, checks: [{ id: key('outboundOrders', id.outbound), fields: { 'value.status': '待仓库接收' } }] },
  'pda-dispatch': { phase: 'prepared', path: pdaPost, actor: 'PF-USER-POST', pda: true, selector: '[data-pda-post-task]', text: '实际发出已保存', minCommits: 1, checks: [{ id: key('outboundOrders', id.outbound), fields: { 'value.status': '待仓库接收' } }] },
  'pda-scan-process': { phase: 'process-open', path: '/fcs/pda/post-finishing/execute', pda: true, eventType: 'keydown', selector: '[data-pda-post-task]', images: 5 },
  'pda-open-original-outbound': { phase: 'dispatched', path: '/fcs/pda/handover?tab=shipped', pda: true, selector: '[data-post-original-outbound]', images: 5 },
  'pda-receive': { phase: 'dispatched', path: receiptPath, pda: true, selector: '[data-post-original-outbound]', text: '成衣仓实收已保存', minCommits: 1, checks: [{ id: key('outboundOrders', id.outbound), fields: { 'value.status': '已接收入库' } }, { collection: 'flow/warehouseReceipts', where: { 'value.outboundOrderId': id.outbound }, count: 1 }] },
  'pda-authorized-difference-receive': { phase: 'dispatched', path: receiptPath, pda: true, selector: '[data-post-original-outbound]', text: '成衣仓实收已保存', minCommits: 1, checks: [{ id: key('outboundOrders', id.outbound), fields: { 'value.status': '已接收入库', 'value.lines.0.receivedQty': 19, 'value.lines.1.receivedQty': 21 } }, { collection: 'flow/warehouseReceipts', where: { 'value.outboundOrderId': id.outbound }, count: 1 }] },
}
async function fillQcRound(page, qty, bad) {
  const cards = page.locator('[data-qc-result-line]'); let left = qty, badLeft = bad
  for (const card of await cards.all()) {
    const capacity = Number(await card.getAttribute('data-remaining')), count = Math.min(left, capacity); left -= count; const defect = Math.min(badLeft, count); badLeft -= defect
    await card.locator('[data-qc-result-field="passedQty"]').fill(String(count - defect)); await card.locator('[data-qc-result-field="defectQty"]').fill(String(defect)); await card.locator('[data-qc-result-field="returnQty"]').fill('0')
    if (defect) await card.locator('[data-qc-issue]').first().check()
  }
  if (left || badLeft) throw Error('Real QC form remaining capacity cannot contain the declared round.')
}
async function runAction(name, trial) {
  const descriptor = actions[name], { context, page } = await openContext(descriptor.phase, descriptor.actor, descriptor.pda)
  let action
  try {
    await page.goto(base + descriptor.path)
    // Preparation is untimed, but must await the actual asynchronously hydrated form.
    const initialSelector = descriptor.path.includes('/qc-workbench') ? name.startsWith('claim-') ? '[data-post-finishing-field="qc-task-input"]' : qcSelector
      : name === 'pda-scan-process' ? '[data-pda-post-field="postScan"]'
      : name === 'pda-open-original-outbound' ? `[data-pda-post-outbound-card="${outboundNo}"]`
      : descriptor.path === receiptPath ? '[data-post-original-outbound]'
      : descriptor.path === outboundPath ? '[data-post-outbound-dispatch]'
      : descriptor.pda ? '[data-pda-post-task]' : '[data-web-post-task]'
    await page.waitForFunction(selector => !!document.querySelector(selector) || /页面(?:内容)?加载失败|当前记录未能读取，暂不能继续操作/.test(document.body.innerText), initialSelector, { timeout: 90000 })
    if (/页面(?:内容)?加载失败|当前记录未能读取，暂不能继续操作/.test(await page.locator('body').innerText())) throw Error('Actual page-load failure before the requested business action; action was not executed.')
    await page.locator(initialSelector).first().waitFor({ state: 'visible', timeout: 90000 })
    if (name.startsWith('claim-')) action = () => page.getByRole('button', { name: '领取并固定本次检查要求', exact: true }).click()
    else if (name === 'select-ten-photos') action = () => page.locator('[data-qc-issue-files]').first().setInputFiles(photoSelectionPaths)
    else if (name === 'select-paper2MiB') action = () => page.locator('[data-qc-paper-file]').setInputFiles(paperSelectionPath)
    else if (name.startsWith('inventory-round') || name === 'production-round') {
      const [qty, bad] = name === 'inventory-round30-photos' ? [720, 3] : name === 'inventory-round50' ? [480, 2] : name === 'inventory-round100' ? [1200, 0] : [100, 0]
      await fillQcRound(page, qty, bad)
      if (name === 'inventory-round30-photos') await page.locator('[data-qc-issue-files]').first().setInputFiles(photoSelectionPaths)
      action = () => page.locator('[data-post-finishing-action="full-flow-submit-qc-round"]').click()
    } else if (name.startsWith('inventory-audit')) {
      await page.locator('[data-qc-upgrade-percent]').selectOption(name.endsWith('50') ? '50' : '100'); await page.locator('[data-qc-upgrade-note]').fill('隔离性能测试本轮真实稽查决定')
      action = () => page.locator('[data-post-finishing-action="full-flow-upgrade-qc"]').click()
    } else if (name.endsWith('-complete')) {
      if (name === 'production-complete') { for (const input of await page.locator('[data-qc-process-item]').all()) { if (['熨烫', '包装'].includes(await input.getAttribute('value'))) await input.check(); else await input.uncheck() } }
      action = () => page.locator('[data-post-finishing-action="full-flow-complete-qc"]').click()
    } else if (name === 'save-paper2MiB') {
      await page.locator('[data-qc-paper-file]').setInputFiles(paperSelectionPath)
      action = () => page.locator('[data-post-finishing-action="full-flow-upload-qc-paper"]').click()
    } else if (name === 'web-process-increment' || name === 'web-prepare-outbound') {
      await page.locator(name === 'web-process-increment' ? '[data-post-finishing-work-order-detail-action="open-register"][data-process-item="熨烫"]' : '[data-post-finishing-work-order-detail-action="open-outbound"]').click()
      const entry = page.locator('[data-post-entry-form]')
      await entry.waitFor({ state: 'visible', timeout: 90000 })
      await page.waitForFunction(() => document.querySelectorAll('[data-post-entry-form] [data-post-entry-quantity]').length === 5)
      for (const input of await entry.locator('[data-post-entry-quantity]').all()) await input.fill(name === 'web-process-increment' ? '10' : '20')
      action = () => page.locator('[data-post-finishing-work-order-detail-action="save-entry"]').click()
    } else if (name === 'pda-process-increment') {
      const card = page.locator('[data-post-process="熨烫"]'); if (await card.getAttribute('open') === null) await card.locator(':scope > summary').click()
      for (const input of await card.locator('[data-post-process-qty]').all()) if (!await input.isDisabled()) await input.fill('10')
      action = () => card.locator('[data-pda-post-action="save-process-completion"]').click()
    } else if (name === 'pda-prepare-outbound') {
      const form = page.locator('[data-post-outbound-form]'); if (await form.getAttribute('open') === null) await form.locator(':scope > summary').click()
      for (const input of await form.locator('[data-post-outbound-qty]').all()) await input.fill('20')
      action = () => form.locator('[data-pda-post-action="submit-for-outbound"]').click()
    } else if (name === 'web-dispatch') action = () => page.locator('[data-post-outbound-dispatch]').click()
    else if (name === 'pda-dispatch') action = () => page.locator('[data-pda-post-action="dispatch-outbound"]').click()
    else if (name === 'pda-scan-process') { await page.locator('[data-pda-post-field="postScan"]').fill(postNo); action = () => page.locator('[data-pda-post-field="postScan"]').press('Enter') }
    else if (name === 'pda-open-original-outbound') action = () => page.locator(`[data-pda-post-outbound-card="${outboundNo}"] [data-post-outbound-receipt-entry]`).click()
    else if (name === 'pda-receive' || name === 'pda-authorized-difference-receive') {
      await page.locator('[data-post-receipt-responsibility]').check()
      for (const [index, sku] of fixture.formal.entries()) await page.locator(`[data-post-receipt-sku="${sku.skuId}"]`).fill(String(20 + (name === 'pda-authorized-difference-receive' ? index === 0 ? -1 : index === 1 ? 1 : 0 : 0)))
      if (name === 'pda-authorized-difference-receive') {
        await page.locator('[data-post-receipt-reason]').fill('隔离性能：第一SKU短1、第二SKU超1，逐SKU保留差异')
        const auth = await context.newPage(); await auth.goto(base + '/fcs/craft/post-finishing/authorization-code')
        await auth.locator('[data-authorization-scan-payload]').waitFor({ state: 'visible' }); const payload = await auth.locator('[data-authorization-scan-payload]').innerText(); await drainEvidence(context, 'authorization-page-close'); await auth.close()
        // Read the real authorization UI. Never calculate a token or import the business module from the browser.
        await page.locator('[data-post-receipt-authorization]').fill(payload.trim())
      }
      action = () => page.getByRole('button', { name: '确认本单成衣仓实际接收', exact: true }).click()
    }
    if (!action) throw Error(`Missing concrete UI action: ${name}`)
    await collect(page, { ...descriptor, family: `action:${name}`, trial }, action)
  } catch (error) { report.samples.push({ family: `action:${name}`, trial, valid: false, error: String(error), phase: descriptor.phase, route: page.url(), browserDiagnostics: report.browserDiagnostics.filter(item => item.route === page.url()) }); await page.screenshot({ path: resolve(runDir, `failure-${report.samples.length}.png`), fullPage: true }).catch(() => {}); checkpoint() }
  finally { await closeContextWithEvidence(context, `action-close:${name}`) }
}
try {
  for (const [name, descriptor] of Object.entries(pageFamilies)) for (const mode of ['cold', 'refresh', 'spa']) {
    const family = `entry:${mode}:${name}`; if (!selected(family)) continue
    // Refresh/SPA repeat on one installed context; cold always creates a new HTTP cache and new application instance.
    let shared
    for (let trial = 0; trial < trials; trial++) {
      const holder = mode === 'cold' ? await openContext(descriptor.phase, descriptor.actor, descriptor.pda) : shared ??= await openContext(descriptor.phase, descriptor.actor, descriptor.pda)
      const { page, context } = holder
      try {
        if (descriptor.print) await page.emulateMedia({ media: 'print' })
        const spec = { ...descriptor, family, trial, matchPath: descriptor.path, ...(descriptor.requiredSkuText ? { requiredTexts: fixture.inventorySkus.map(row => row.skuCode) } : {}) }
        if (mode === 'cold') await collect(page, spec, () => page.goto(base + descriptor.path), true)
        else if (mode === 'refresh') { await page.goto(base + descriptor.path); await waitForUntimedBusinessReady(page, spec, `refresh:${name}:${trial}`); await collect(page, spec, () => page.reload(), true) }
        else { await page.goto(base + '/fcs/craft/post-finishing/qc-orders'); await waitForUntimedBusinessReady(page, { matchPath: '/fcs/craft/post-finishing/qc-orders', selector: 'table tbody tr', heading: '质检清单' }, `spa-source:${name}:${trial}`); await collect(page, spec, () => navigateTrusted(page, descriptor.path)) }
        if (descriptor.print && trial === 0) await capturePrintedArtifact(page, `${name}-${mode}`, descriptor).catch(error => report.errors.push({ type: 'pdf', message: String(error) }))
      } catch (error) { report.samples.push({ family, trial, valid: false, error: String(error) }); checkpoint();throw error }
      finally { if (mode === 'cold') await closeContextWithEvidence(context, `cold-close:${name}:${trial}`) }
    }
    if (shared) await closeContextWithEvidence(shared.context, `shared-close:${name}:${mode}`)
    if(!diagnostic&&!report.familyResults.find(row=>row.family===family)?.pass)throw Error(`Performance family failed ${limitMs}ms boundary: ${family}; remaining families paused for repair`)
  }
  for (const [name, descriptor] of Object.entries(extraPrints)) {
    const family = `print:direct:${name}`; if (!selected(family)) continue
    for (let trial = 0; trial < trials; trial++) { const { context, page } = await openContext(descriptor.phase)
      try { await page.emulateMedia({ media: 'print' }); await collect(page, { ...descriptor, family, trial, matchPath: descriptor.path, ...(descriptor.unitLabels ? { expectedUnitLabels: fixture.formal.map(sku => ({ skuId: sku.skuId, skuCode: sku.skuCode, barcode: sku.barcode })) } : {}) }, () => page.goto(base + descriptor.path), true); if (trial === 0) await capturePrintedArtifact(page, name, descriptor) }
      catch (error) { report.samples.push({ family, trial, valid: false, error: String(error) }); checkpoint();throw error } finally { await closeContextWithEvidence(context, `extra-print-close:${name}:${trial}`) }
    }
  }
  for (const name of actionFamilies) if (selected(`action:${name}`)){
    for (let trial = 0; trial < trials; trial++){await runAction(name, trial);if(report.samples.at(-1)?.valid===false)throw Error(`Invalid action sample: ${name}; pause before repeating it`)}
    if(!diagnostic&&!report.familyResults.find(row=>row.family===`action:${name}`)?.pass)throw Error(`Performance action failed ${limitMs}ms boundary: ${name}; remaining families paused for repair`)
  }
} catch (error) { report.errors.push({ type: 'collector-fatal', message: String(error) }) }
finally {
  await drainEvidence(undefined, 'collector-final-body-reads'); report.sourceAfter = sourceHashes(); report.sourceUnchanged = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter)
  report.applicationBuildHashesAfter = buildArtifactHashes(); report.applicationBuildUnchanged = JSON.stringify(buildBeforePreload) === JSON.stringify(report.applicationBuildHashesAfter)
  report.completed = true; checkpoint(); report.passed = !diagnostic && report.applicationBuildUnchanged && report.sourceUnchanged && !report.errors.length && Object.values(report.assets).every(asset => asset.matches) && report.familyResults.every(family => family.pass)
  report.finishedAt = new Date().toISOString(); checkpoint(); try { await browser.close(); await drainEvidence(undefined, 'browser-closed-diagnostics') } finally { await fixtureTransport.close(); checkpoint() }
}
console.log(JSON.stringify({ runId, formalPassed: report.passed, diagnosticOnly: diagnostic, samples: report.samples.length, valid: report.samples.filter(row => row.valid).length, overLimit: report.samples.filter(row => row.valid && row.ms > limitMs).length, failedFamilies: report.familyResults.filter(row => !row.pass).map(row => row.family), pp: config.pp, report: resolve(runDir, 'report.json') }, null, 2))
process.exitCode = report.passed || diagnostic ? 0 : 1

/** Node-only isolated performance fixture. Importing this module does not open a browser or write any store. */
import { createHash } from 'node:crypto'
const namespace = 'higood-fcs-quality-management', postNamespace = 'higood-fcs-post-finishing-records', invNamespace = 'higood-finished-inventory'
const stage = { PRODUCTION_RETURN: 'POST_FINISHING_QC', WAREHOUSE_STOCK: 'WAREHOUSE_STOCK_QC', PRE_PRODUCTION_SAMPLE: 'PRE_PRODUCTION_SAMPLE_APPROVAL' }
export const QUALITY_PERFORMANCE_SEED = 20261022
export const QUALITY_PERFORMANCE_SHAPE = { basicStandards: 100, itemsPerBasic: 40, additionalStandards: 300, productionRecords: 3000, inventoryRecords: 5000, sampleRecords: 2000, rounds: 20000, heavyRecordSkus: 24, warehouses: 10 }
const seed = QUALITY_PERFORMANCE_SEED, shape = QUALITY_PERFORMANCE_SHAPE
const clone = value => structuredClone(value)
const iso = '2026-10-22T01:00:00.000Z', openedIso = '2026-10-21T01:00:00.000Z'

export async function buildQualityPerformanceFixture() {
  const q = await import('../../src/data/fcs/quality-management-records.ts')
  const engine = await import('../../src/data/fcs/post-finishing-quality.ts')
  const flow = await import('../../src/data/fcs/post-finishing-full-flow.ts')
  const demo = await import('../../src/data/fcs/sewing-outsourcing-demo.ts')
  const samples = await import('../../src/data/fcs/sewing-sample-approval-suggestion.ts')
  const assignments = await import('../../src/data/fcs/effective-task-assignments.ts')
  const context = await import('../../src/data/fcs/production-context-records.ts')
  const defaults = q.getDefaultQualityConfigurations(), basic = defaults.find(row => row.kind === 'BASIC')
  // Frozen record snapshots predate publication of the current additional
  // standards. They correctly retain their older basic-only requirements.
  for (const config of defaults) { config.createdAt = '2026-10-20T01:00:00.000Z'; config.effectiveAt = config.createdAt; config.updatedAt = config.createdAt }
  while (basic.items.length < shape.itemsPerBasic) {
    const n = basic.items.length + 1
    basic.items.push({ id: `perf-item-${n}`, dimension: '性能夹具检查', name: `正式夹具项目${n}`, content: `隔离性能资料检查项${n}`, criterion: `按隔离资料${n}核对`, references: [] })
  }
  const configs = [basic, ...defaults.filter(row => row.kind === 'RULE')]
  for (let i = 1; i < shape.basicStandards; i++) configs.push({ ...clone(basic), id: `qperf-basic-${i}`, familyId: `qperf-process-standard-${i}`, version: 1,
    name: `性能工序基本标准${i}`, status: 'EFFECTIVE', objectType: `QPERF_PROCESS_OBJECT_${i}`,
    applicability: { sourceKinds: ['PRODUCTION_RETURN'], stages: [`QPERF_PROCESS_STAGE_${i}`] },
    items: Array.from({ length: 40 }, (_, index) => ({ id: `qperf-process-${i}-item-${index}`, dimension: `工序${i}检查`, name: `工序项目${index + 1}`,
      content: '按隔离工序正式资料核对', criterion: '按本工序标准检查', references: [] })) })
  for (let i = 0; i < shape.additionalStandards; i++) {
    const category = i < 150, n = i % 150
    configs.push({ id: `qperf-additional-${i}`, familyId: `qperf-additional-family-${i}`, version: 1,
      name: `性能${category ? '类别' : '指定款'}附加标准${n}`, status: i === 150 || i >= 295 ? 'DRAFT' : 'EFFECTIVE', objectType: 'GARMENT', kind: 'ADDITIONAL',
      createdAt: iso, updatedAt: iso, effectiveAt: iso, level: category ? 'STYLE_CATEGORY' : 'STYLE',
      applicability: { sourceKinds: ['PRODUCTION_RETURN', 'WAREHOUSE_STOCK'], stages: [stage.PRODUCTION_RETURN, stage.WAREHOUSE_STOCK], ...(category ? { styleCategories: [`QPERF-CATEGORY-${n}`] } : { styleIds: [`QPERF-STYLE-${n}`] }) },
      items: [{ id: `qperf-added-${i}`, dimension: '附加要求', name: `附加核对${i}`, content: '隔离性能场景的独立要求', criterion: '按夹具资料核对', references: [] }],
      overrides: [{ targetItemId: 'garment-size-chest', fields: ['criterion'], values: { criterion: `M码性能胸围要求${i}` }, applicability: { attributes: [{ key: 'size', value: 'M' }] } }],
    })
  }
  const pcs = configs.map(value => ({ id: `${namespace}/config/${encodeURIComponent(value.id)}`, collection: 'quality/config', value, version: 1 }))
  pcs.push({ id: `${namespace}/scope/revision`, collection: 'quality/scope', value: { revision: 1 }, version: 1 })
  const template = flow.listPostFinishingFullFlowQcTasks().find(row => row.status === '待质检')
  const deliveryTemplate = flow.listPostFinishingFactoryReturns().find(row => row.deliveryId === template.deliveryId)
  const itemPrototype = basic.items.map(item => ({ ...item, basicItemId: item.id, sourceStandardId: basic.id, sourceStandardVersion: 1, overriddenBy: [] }))
  const actor = { actorId: 'QPERF-QC', actorName: '隔离性能QC', roleName: 'QC质检员' }
  const inspections = [], inventoryRows = []; let roundsCount = 0
  const ruleFor = kind => defaults.find(row => row.kind === 'RULE' && row.applicability.sourceKinds.includes(kind))
  const addPost = (collection, value, id) => pcs.push({ id: `${postNamespace}/flow/${collection}/${encodeURIComponent(id)}`, collection: `flow/${collection}`, value, version: 1 })
  for (let i = 0; i < shape.productionRecords + shape.inventoryRecords; i++) {
    const kind = i < shape.productionRecords ? 'PRODUCTION_RETURN' : 'WAREHOUSE_STOCK', heavy = i === 0, count = heavy ? 24 : 1
    const id = `QPERF-QC-${String(i).padStart(5, '0')}`, styleCode = `QPERF-STYLE-${i % 150}`, deliveryId = `QPERF-DELIVERY-${i}`
    const skus = Array.from({ length: count }, (_, n) => ({ ...template.lines[n % template.lines.length].sku,
      skuId: `${id}-SKU-${n}`, skuCode: `${id}-SKU-${n}`, spuCode: styleCode, spuName: `隔离性能衬衫${i % 150}` }))
    const rule = ruleFor(kind), { id: ruleId, version, quantityBasis, defaultPercent, minQuantity, percentSteps, roundThresholds, initialFullInspection } = rule
    const snapshot = { id: `snapshot:${id}`, selectedAt: openedIso, configRevision: 1, context: { sourceKind: kind, stage: stage[kind], objectType: 'GARMENT', styleId: styleCode, styleCode },
      basicStandard: { id: basic.id, version: 1, name: basic.name }, additionalStandards: [], items: itemPrototype, references: [],
      ruleSnapshot: { id: ruleId, version, quantityBasis, defaultPercent, minQuantity, percentSteps, roundThresholds, initialFullInspection } }
    if (heavy) snapshot.skuSnapshots = skus.map(sku => ({ skuId: sku.skuId, snapshot: { ...snapshot, id: `snapshot:${sku.skuId}`, context: { ...snapshot.context, attributes: { size: sku.sizeName, color: sku.colorName } } } }))
    const inspection = engine.createPostQcInspection(snapshot), supply = skus.map(sku => ({ skuId: sku.skuId, quantity: 100 }))
    const total = count * 100, three = i < 4000
    const addRound = (number, quantity, bad) => {
      let passed = quantity - bad, defect = bad
      const remaining = engine.getPostQcSummary(inspection, supply)
      const lines = remaining.lines.map(line => {
        let available = line.uninspectedQty
        const d = Math.min(defect, available); defect -= d; available -= d
        const p = Math.min(passed, available); passed -= p
        return { skuId: line.skuId, passedQty: p, defectQty: d, returnQty: 0, issues: d ? [{ itemId: basic.items[0].id, note: '隔离性能瑕疵记录' }] : [] }
      })
      if (passed + defect) throw Error('Invalid performance round allocation')
      engine.submitPostQcRound(inspection, supply, { operationId: `${id}:round:${number}`, actorId: actor.actorId, submittedAt: iso, lines }); roundsCount++
    }
    addRound(1, Math.ceil(total * .3), 2)
    engine.upgradePostQcInspection(inspection, { nextPercent: three ? 50 : 100, note: '隔离性能稽查升级', decidedAt: iso })
    addRound(2, three ? Math.ceil(total * .5) - Math.ceil(total * .3) : total - Math.ceil(total * .3), three ? 2 : 0)
    if (three) { engine.upgradePostQcInspection(inspection, { nextPercent: 100, note: '隔离性能本批全检', decidedAt: iso }); addRound(3, total - Math.ceil(total * .5), 0) }
    // A labelled static fixture paper is not a claim of a real human signature.
    if (kind === 'PRODUCTION_RETURN') inspection.papers.push({ id: `${id}:paper`, version: inspection.paperVersion, name: '隔离性能纸单.png', url: skus[0].imageUrl, uploadedAt: iso })
    const summary = engine.assertPostQcCompletable(inspection, supply, kind === 'PRODUCTION_RETURN')
    const results = summary.lines.map(line => ({ sku: skus.find(sku => sku.skuId === line.skuId), expectedQty: line.quantity, ...line }))
    const task = { ...clone(template), qcTaskId: id, qcTaskNo: id, deliveryId, deliveryOrderNo: deliveryId, productionOrderId: `QPERF-PO-${i}`, productionOrderNo: `QPERF-PO-${i}`,
      sourceKind: kind, styleId: styleCode, inventoryApplicationId: kind === 'WAREHOUSE_STOCK' ? `QPERF-APP-${i}` : undefined,
      sourceWarehouseId: kind === 'WAREHOUSE_STOCK' ? `QPERF-WH-${i % 10}` : undefined, sourceWarehouseName: kind === 'WAREHOUSE_STOCK' ? `性能成衣仓${i % 10}` : undefined,
      status: '质检完成', claimedBy: actor, claimedAt: openedIso, completedAt: iso, lines: skus.map(sku => ({ sku, expectedQty: 100 })), referenceIds: [], inspection, results,
      postTaskId: undefined, postTaskNo: undefined, recheckOrderId: undefined, recheckOrderNo: undefined, outboundOrderId: undefined, outboundOrderNo: undefined }
    addPost('qcTasks', task, id); inspections.push({ id, sourceKind: kind, rounds: inspection.rounds.length })
    if (kind === 'PRODUCTION_RETURN') {
      addPost('deliveries', { ...clone(deliveryTemplate), deliveryId, deliveryOrderNo: deliveryId, productionOrderId: task.productionOrderId, productionOrderNo: task.productionOrderNo,
        sewingFactoryName: `性能车缝厂${i % 10}`, returnIndex: 1, lines: skus.map(sku => ({ sku, registeredQty: 100, confirmedQty: 100 })) }, deliveryId)
    } else {
      const appId = task.inventoryApplicationId, lines = skus.map(sku => ({ skuId: sku.skuId, skuCode: sku.skuCode, styleId: styleCode, styleNo: styleCode, styleName: sku.spuName,
        colorName: sku.colorName, sizeName: sku.sizeName, imageUrl: sku.imageUrl, outboundQty: 100, receivedQty: 100, allocations: [{ lotId: `QPERF-LOT-${i}`, quantity: 100, locationCode: 'PERF-A01' }] }))
      const app = { id: appId, applicationNo: appId, operationId: appId, warehouseId: task.sourceWarehouseId, warehouseName: task.sourceWarehouseName,
        styleId: styleCode, styleNo: styleCode, styleName: skus[0].spuName, imageUrl: skus[0].imageUrl, lines, createdAt: iso, createdBy: '隔离仓管',
        receivedAt: iso, receivedBy: '隔离后道接收员', outboundId: `${appId}:sent`, qcTaskId: id, qcTaskNo: id, qcCompletedAt: iso,
        qcResults: summary.lines.map(line => ({ skuId: line.skuId, inspectedQty: line.inspectedQty, passedQty: line.passedQty, defectQty: line.defectQty, reworkQty: line.returnQty, uninspectedQty: line.uninspectedQty, releasedQty: line.releasedQty })) }
      inventoryRows.push({ id: `${invNamespace}/applications/${encodeURIComponent(appId)}`, collection: `${invNamespace}/applications`, value: app, version: 1 })
      for (const [category, suffix, quantity] of [['送后道', 'sent', total], ['正常返仓', 'normal', summary.releasedQty], ['瑕疵入仓', 'defect', summary.defectQty]]) {
        const transferLine = { ...lines[0], quantity }
        delete transferLine.outboundQty; delete transferLine.allocations
        if (suffix !== 'sent') delete transferLine.receivedQty
        const transferId = `${appId}:${suffix}`, value = { id: transferId, applicationId: appId, applicationNo: appId, category,
          sourceWarehouseId: task.sourceWarehouseId, sourceWarehouseName: task.sourceWarehouseName, targetId: suffix === 'defect' ? 'QPERF-DEFECT-WH' : task.sourceWarehouseId,
          targetName: suffix === 'defect' ? '性能瑕疵品仓' : task.sourceWarehouseName, lines: [transferLine], createdAt: iso, createdBy: '隔离仓管',
          ...(suffix === 'sent' ? { shippedAt: iso, receivedAt: iso, shippedBy: '隔离仓管', receivedBy: '隔离后道接收员' } : {}) }
        inventoryRows.push({ id: `${invNamespace}/transfers/${encodeURIComponent(transferId)}`, collection: `${invNamespace}/transfers`, value, version: 1 })
      }
    }
  }
  pcs.push(...inventoryRows)
  demo.ensureSewingOutsourcingSampleDemo()
  const sampleState = samples.captureSewingSampleState(), assignmentState = assignments.captureEffectiveTaskAssignmentState()
  const sampleTemplate = sampleState.records.map(([, value]) => value).find(row => row.suggestionVersions.length)
  const assignmentTemplate = assignmentState.assignments.find(([id]) => id === sampleTemplate.assignmentId)[1]
  const sampleRecords = [], assignmentRecords = [], current = []
  for (let i = 0; i < shape.sampleRecords; i++) {
    const id = `QPERF-ASG-${i}`, runtimeTaskId = `QPERF-SEW-${i}`, sampleId = `QPERF-SAMPLE-${i}`, productionOrderId = `QPERF-SAMPLE-PO-${i}`
    const record = clone(sampleTemplate), styleCode = `QPERF-STYLE-${i % 150}`
    Object.assign(record, { assignmentId: id, assignmentAliases: [{ assignmentId: id, runtimeTaskId }], qualitySchemaVersion: 1,
      inspectionStandardSnapshot: { id: `snapshot:${sampleId}`, selectedAt: openedIso, configRevision: 1, context: { sourceKind: 'PRE_PRODUCTION_SAMPLE', stage: stage.PRE_PRODUCTION_SAMPLE, objectType: 'GARMENT' },
        basicStandard: { id: basic.id, version: 1, name: basic.name }, additionalStandards: [], items: itemPrototype, references: [], ruleSnapshot: null } })
    Object.assign(record.sample, { sampleId, sampleNo: sampleId, assignmentId: id, runtimeTaskId, productionOrderId, productionOrderNo: productionOrderId, taskNo: runtimeTaskId,
      styleCode, styleName: `隔离性能衬衫${i % 150}`, factoryName: `性能车缝厂${i % 10}`, status: 'FEEDBACK_SENT', approverReceivedInstant: openedIso, factoryTimeZone: 'Asia/Jakarta' })
    delete record.sample.roundNo
    const suggestion = { ...record.suggestionVersions[0], suggestionVersionId: `QPERF-SUGGESTION-${i}`, suggestionNo: `QPERF-SUGGESTION-${i}`,
      assignmentId: id, runtimeTaskId, sampleId, conclusion: i % 2 ? 'NO_PROBLEM' : 'HAS_PROBLEM', issues: i % 2 ? [] : [{ itemId: basic.items[0].id, note: '隔离性能问题项' }],
      uploadedAt: iso, uploadedInstant: iso, feedbackSentAt: iso, feedbackNote: '隔离性能反馈' }
    delete suggestion.roundNo; delete suggestion.requiresAnotherApproval
    record.suggestionVersions = [suggestion]; record.latestSuggestionVersionId = suggestion.suggestionVersionId
    sampleRecords.push(record)
    assignmentRecords.push([id, { ...clone(assignmentTemplate), assignmentId: id, runtimeTaskId, productionOrderId, productionOrderNo: productionOrderId, taskNo: runtimeTaskId, factoryId: record.sample.factoryId, factoryName: record.sample.factoryName, status: 'EFFECTIVE' }])
    current.push([runtimeTaskId, [id]])
  }
  const cutting = [
    ...context.decodeProductionContextRecords(context.PRODUCTION_CONTEXT_KEYS.samples, JSON.stringify({ version: 3, records: sampleRecords, commands: [], sequence: shape.sampleRecords })),
    ...context.decodeProductionContextRecords(context.PRODUCTION_CONTEXT_KEYS.assignments, JSON.stringify({ version: 2, assignments: assignmentRecords, current, auditLogs: [], assignmentSeq: shape.sampleRecords, auditSeq: 0 })),
  ]
  const manifest = { seed, shape, actual: { basic: configs.filter(row => row.kind === 'BASIC').length, basicItemCounts: [...new Set(configs.filter(row => row.kind === 'BASIC').map(row => row.items.length))],
    distinctBasicItemIds: new Set(configs.filter(row => row.kind === 'BASIC').flatMap(row => row.items.map(item => item.id))).size,
    additional: configs.filter(row => row.kind === 'ADDITIONAL').length, production: inspections.filter(row => row.sourceKind === 'PRODUCTION_RETURN').length,
    inventory: inspections.filter(row => row.sourceKind === 'WAREHOUSE_STOCK').length, sample: sampleRecords.length, rounds: roundsCount, heavySkus: 24 },
    storeRows: { pcs: pcs.length, cutting: cutting.length },
    staticBaseline: 'Original static demonstration objects remain separately identifiable. Every measured record filter uses QPERF; all 10000 QPERF records and 20000 rounds are persisted and loaded. No static object is cleared to improve timing.',
    definitions: '100 independent effective basic-standard families each contain 40 items: the existing garment standard is shared by three garment stages; 99 process standards have distinct explicit process objects/stages supported by the current matching engine. Editors derive real drafts through product controls. The 300 category/style additional standards have disjoint same-level scopes and target production/inventory where real size/color exists; samples keep the shared garment basic standard; M-only original-item coverage and original-vs-L preview are exercised. Each of 8000 QCs persists its real fixed 40-item snapshot; the heaviest QC also has 24 SKU snapshots. The 2000 canonical sample records and assignment/current indexes use the actual decoder. Synthetic images and paper paths derive from the matching original style fixture; this is no claim of field acceptance.',
    sampleSchemaValidated: true }
  if (manifest.actual.basic !== 100 || manifest.actual.distinctBasicItemIds !== 4000 || manifest.actual.additional !== 300 || roundsCount !== 20000 || manifest.actual.production + manifest.actual.inventory + manifest.actual.sample !== 10000) throw Error('Fixture cardinality does not meet the accepted performance load')
  const digest = createHash('sha256'); let jsonBytes = 0
  for (const row of [...pcs, ...cutting]) { const text = JSON.stringify(row); digest.update(text); jsonBytes += Buffer.byteLength(text) }
  manifest.serializedRowBytes = jsonBytes
  manifest.sha256 = digest.digest('hex')
  return { pcs, cutting, manifest }
}


/** Verification-only localhost transport. Explicit start/close; never imported by the app. */
export async function startQualityPerformanceFixtureServer({ fixture, allowedOrigin, overlays = {}, files = [] }) {
  const { createServer } = await import('node:http'), { randomUUID } = await import('node:crypto')
  const origin = new URL(allowedOrigin)
  if (origin.origin !== allowedOrigin || origin.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)) throw Error('Fixture CORS origin must be an exact isolated localhost HTTP origin')
  const token = randomUUID(), prefix = `/quality-fixture-${token}`
  const definitions = { pcs: { name: 'higood-pcs-records', version: 4, stores: ['records','files','operations','meta'], rows: fixture.pcs }, cutting: { name: 'higood-cutting-records-v1', version: 1, stores: ['records','files','commands','meta'], rows: fixture.cutting } }
  const streams = {}, combined = createHash('sha256')
  for (const [kind, definition] of Object.entries(definitions)) {
    const digest = createHash('sha256'); let serializedRowBytes = 0
    for (const row of definition.rows) { const value = JSON.stringify(row); digest.update(value); combined.update(value); serializedRowBytes += Buffer.byteLength(value) }
    streams[kind] = { name: definition.name, version: definition.version, stores: definition.stores, count: definition.rows.length, serializedRowBytes, ndjsonBytes: serializedRowBytes + definition.rows.length, sha256: digest.digest('hex'), path: `${prefix}/${kind}.ndjson` }
  }
  if (combined.digest('hex') !== fixture.manifest.sha256 || streams.pcs.serializedRowBytes + streams.cutting.serializedRowBytes !== fixture.manifest.serializedRowBytes) throw Error('Fixture transport input differs from the original shared manifest')
  const phases = new Map(Object.entries(overlays).map(([name, rows]) => [name, [...new Map(rows.map(row => [row.id,row])).values()]]))
  const fileMap = new Map(files.map(file => [file.id, { id: file.id, buffer: Buffer.from(file.buffer), mimeType: file.mimeType || 'application/octet-stream' }]))
  if (fileMap.size !== files.length) throw Error('Duplicate fixture Blob identity')
  const manifest = { format: 'quality-performance-transport-v1', original: fixture.manifest, streams, overlays: Object.fromEntries([...phases].map(([name, rows]) => [name, { count: rows.length, sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex') }])), files: [...fileMap.values()].map(file => ({ id: file.id, bytes: file.buffer.length, mimeType: file.mimeType, sha256: createHash('sha256').update(file.buffer).digest('hex'), path: `${prefix}/files/${encodeURIComponent(file.id)}` })) }
  const server = createServer(async (request, response) => {
    if (request.headers.origin !== allowedOrigin) { response.writeHead(403); response.end('Fixture origin rejected'); return }
    response.setHeader('Access-Control-Allow-Origin', allowedOrigin); response.setHeader('Vary', 'Origin'); response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff')
    if (request.method === 'OPTIONS') { response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': 'Content-Type' }); response.end(); return }
    if (request.method !== 'GET') { response.writeHead(405, { Allow: 'GET' }); response.end('Read-only fixture transport'); return }
    const path = new URL(request.url, 'http://127.0.0.1').pathname
    try {
      if (path === `${prefix}/manifest.json`) { response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(manifest)); return }
      const kind = Object.keys(streams).find(key => path === streams[key].path)
      if (kind) {
        response.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Content-Length': streams[kind].ndjsonBytes, 'X-Fixture-Rows': streams[kind].count, 'X-Fixture-Source-Sha256': streams[kind].sha256 })
        for (const row of definitions[kind].rows) { if (response.destroyed) return; if (!response.write(JSON.stringify(row) + '\n')) await new Promise(resolve => { const done = () => { response.off('drain', done); response.off('close', done); resolve() }; response.once('drain', done); response.once('close', done) }) }
        response.end(); return
      }
      if (path.startsWith(`${prefix}/overlays/`)) { const name = decodeURIComponent(path.slice(`${prefix}/overlays/`.length)); if (phases.has(name)) { response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(phases.get(name))); return } }
      if (path.startsWith(`${prefix}/files/`)) { const file = fileMap.get(decodeURIComponent(path.slice(`${prefix}/files/`.length))); if (file) { response.writeHead(200, { 'Content-Type': file.mimeType, 'Content-Length': file.buffer.length }); response.end(file.buffer); return } }
      response.writeHead(404); response.end('Unknown fixture resource')
    } catch (error) { if (!response.headersSent) response.writeHead(500); response.destroy(error instanceof Error ? error : new Error(String(error))) }
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  return { manifest, baseUrl, descriptor: phase => { if (!phases.has(phase)) throw Error(`Unknown fixture phase: ${phase}`); return { manifestUrl: `${baseUrl}${prefix}/manifest.json`, baseUrl, allowedOrigin, phase, expectedManifestSha256: fixture.manifest.sha256 } },
    close: () => new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeIdleConnections?.() }) }
}

/** Serialize this one function with page.evaluate. It fetches no app/module assets. */
export async function installQualityPerformanceNativeFixture(descriptor) {
  if (location.origin !== descriptor.allowedOrigin) throw Error('Fixture preload page has the wrong origin')
  const started = performance.now(), json = async path => { const response = await fetch(path, { cache: 'no-store', credentials: 'omit' }); if (!response.ok) throw Error(`Fixture HTTP ${response.status}: ${path}`); return response.json() }
  const manifest = await json(descriptor.manifestUrl)
  if (manifest.format !== 'quality-performance-transport-v1' || manifest.original.sha256 !== descriptor.expectedManifestSha256 || !manifest.overlays[descriptor.phase]) throw Error('Original fixture manifest/phase mismatch')
  const requestValue = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
  const complete = tx => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error || Error('Fixture native transaction aborted')); tx.onerror = () => {} })
  const open = definition => new Promise((resolve, reject) => {
    const request = indexedDB.open(definition.name, definition.version)
    request.onupgradeneeded = () => { for (const name of definition.stores) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'id' }); if (definition.name === 'higood-pcs-records') { const records=request.transaction.objectStore('records'); if(!records.indexNames.contains('lookup:qualityHeader'))records.createIndex('lookup:qualityHeader',['collection','value.status','value.qcTaskNo','value.productionOrderId','value.productionOrderNo']); const operations = request.transaction.objectStore('operations'); if (!operations.indexNames.contains('createdAt')) operations.createIndex('createdAt', 'createdAt') } }
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); request.onblocked = () => reject(Error('Fixture preload cannot upgrade a database held by another page'))
  })
  const databases = new Map(), transport = []
  if (indexedDB.databases) { const existing = await indexedDB.databases(); if (existing.some(row => Object.values(manifest.streams).some(definition => definition.name === row.name))) throw Error('Fixture preload refuses existing databases; use a fresh isolated context, existing data was left untouched') }
  try {
    // Refuse ANY prior facts or files. This helper never clears or replaces a user's database.
    for (const definition of Object.values(manifest.streams)) {
      const db = await open(definition); databases.set(definition.name, db)
      const tx = db.transaction(definition.stores, 'readonly'), done = complete(tx), counts = await Promise.all(definition.stores.map(name => requestValue(tx.objectStore(name).count()))); await done
      if (counts.some(count => count !== 0)) throw Error(`Fixture preload requires a fresh isolated context; existing ${definition.name} data was left untouched`)
    }
    for (const definition of Object.values(manifest.streams)) {
      const db = databases.get(definition.name), response = await fetch(descriptor.baseUrl + definition.path, { cache: 'no-store', credentials: 'omit' })
      if (!response.ok || !response.body) throw Error(`Fixture stream failed: ${definition.name}`)
      // Drain the complete HTTP response before asynchronous IndexedDB writes.
      // Interleaving a paused body reader with native transactions left Chromium
      // cancelling the second response; no app asset or sample has started here.
      const buffer=await response.text(),encoder=new TextEncoder();let batch=[],count=0,bytes=0,offset=0,end
      const flush=async()=>{if(!batch.length)return;const tx=db.transaction('records','readwrite'),done=complete(tx);for(const row of batch)tx.objectStore('records').put(row);await done;batch=[]}
      while((end=buffer.indexOf('\n',offset))>=0){
        const line=buffer.slice(offset,end);offset=end+1
        if(!line)throw Error('Unexpected blank fixture record')
        const row=JSON.parse(line);if(!row.id || !row.collection)throw Error('Fixture record identity missing')
        batch.push(row);count++;bytes+=encoder.encode(line).byteLength
        if(batch.length===512)await flush()
      }
      if(offset!==buffer.length)throw Error('Fixture NDJSON ended inside a record');await flush()
      if (count !== definition.count || bytes !== definition.serializedRowBytes) throw Error(`Fixture stream cardinality/byte mismatch: ${definition.name}`)
      transport.push({ database: definition.name, rows: count, serializedRowBytes: bytes, sourceSha256: definition.sha256 })
    }
    const overlays = await json(`${descriptor.baseUrl}${new URL(descriptor.manifestUrl).pathname.replace('/manifest.json', '')}/overlays/${encodeURIComponent(descriptor.phase)}`)
    const overlayBytes = new TextEncoder().encode(JSON.stringify(overlays)), overlaySha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', overlayBytes))].map(value => value.toString(16).padStart(2, '0')).join('')
    if (overlays.length !== manifest.overlays[descriptor.phase].count || overlaySha256 !== manifest.overlays[descriptor.phase].sha256) throw Error('Fixture overlay mismatch')
    const files = []
    for (const file of manifest.files) { const response = await fetch(descriptor.baseUrl + file.path, { cache: 'no-store', credentials: 'omit' }); if (!response.ok) throw Error('Fixture Blob fetch failed'); const blob = await response.blob(), sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(value => value.toString(16).padStart(2, '0')).join(''); if (blob.size !== file.bytes || sha256 !== file.sha256) throw Error('Fixture Blob original bytes changed'); files.push({ id: file.id, blob }) }
    const pcs = databases.get('higood-pcs-records'), overlayTx = pcs.transaction(['records','files'], 'readwrite'), overlayDone = complete(overlayTx)
    for (const row of overlays) overlayTx.objectStore('records').put(row)
    for (const file of files) overlayTx.objectStore('files').put(file)
    await overlayDone
    const cutting = databases.get('higood-cutting-records-v1'), revisionTx = cutting.transaction('meta', 'readwrite'), revisionDone = complete(revisionTx); revisionTx.objectStore('meta').put({ id: 'revision', value: 1 }); await revisionDone
    const tx = pcs.transaction('records', 'readonly'), counted = complete(tx), prefix = 'higood-fcs-post-finishing-records/flow/qcTasks/QPERF-QC-', cursor = tx.objectStore('records').openCursor(IDBKeyRange.bound(prefix, prefix + '\uffff')); let originalQcRecords = 0, originalRounds = 0
    cursor.onsuccess = () => { const item = cursor.result; if (item) { originalQcRecords++; originalRounds += item.value.value.inspection.rounds.length; item.continue() } }; await counted
    if (originalQcRecords !== 8000 || originalRounds !== 20000) throw Error('Native fixture readback lost original 8000 QC / 20000 rounds')
    const sampleTx = cutting.transaction('records', 'readonly'), sampleDone = complete(sampleTx), samplePrefix = 'production-context:samples:', sampleCount = requestValue(sampleTx.objectStore('records').count(IDBKeyRange.bound(samplePrefix, samplePrefix + '\uffff'))); const originalSampleRecords = await sampleCount; await sampleDone
    if (originalSampleRecords !== 2000) throw Error('Native fixture readback lost original 2000 samples')
    return { phase: descriptor.phase, originalQcRecords, originalRounds, originalSampleRecords, originalCuttingRows: manifest.streams.cutting.count, originalManifestSha256: manifest.original.sha256, originalSerializedRowBytes: manifest.original.serializedRowBytes, overlaySha256, files: manifest.files.map(({ id, bytes, sha256 }) => ({ id, bytes, sha256 })), transport, installationMs: performance.now() - started, applicationAssetsLoadedByHelper: false, existingUserDataCleared: false }
  } finally { for (const db of databases.values()) db.close() }
}

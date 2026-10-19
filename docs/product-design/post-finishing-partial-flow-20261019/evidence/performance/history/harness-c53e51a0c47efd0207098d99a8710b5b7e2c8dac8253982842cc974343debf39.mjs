#!/usr/bin/env node
/**
 * Post-finishing D10 performance harness.
 * This only writes isolated Playwright browser contexts and this task's evidence.
 * Fixture preparation uses public domain commands; it is never an interaction sample.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { platform, release, arch, cpus, totalmem } from 'node:os';
import { gzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const value = args.find(item => item.startsWith(name + '='));
  return value ? value.slice(name.length + 1) : fallback;
};
const sourceOrigin = option('--source', 'http://127.0.0.1:43197');
const targetOrigin = option('--target', 'http://127.0.0.1:43198');
const output = resolve(option('--output', 'docs/product-design/post-finishing-partial-flow-20261019/evidence/performance'));
const calibration=args.includes('--calibration');
const profileRequested=args.includes('--profile');
const profileFamilies=option('--profile-family','qc:claim,process:开扣眼:save').split(',');
const preflight=args.includes('--preflight');
const selected = new Set(option('--families', calibration?'pages,actions,print':'pages,actions,storage,print').split(','));
const routeFilter=option('--route',calibration?'work-list':'').split(',').filter(Boolean);
const printTypes=option('--print-types',calibration?'OUTBOUND_BARCODE':'OUTBOUND,OUTBOUND_BARCODE,OUTBOUND_HANGTAG,GENERIC_OUTBOUND,GENERIC_BARCODE').split(',');
const trials = Number(option('--trials', calibration?'1':'5'));
const maxMs = 1000;
const namespace = 'higood-fcs-post-finishing-records';
const prefix = '/fcs/craft/post-finishing/';
const fixtureFile = resolve(option('--fixture', output + '/d10-fixture.json'));
const config = { arguments:args, sourceOrigin, targetOrigin, calibration, preflight, profileRequested, routeFilter, printTypes, trials, maxMs, selected: [...selected], coldDefinition:'Fresh isolated browser context with empty application HTTP cache; a static CSS document establishes the origin for IndexedDB fixture preparation before app navigation. No main app assets or images are loaded during origin preparation.',
  D10: { parentOrders: 100, skusPerOrder: 5, quantityPerSku: 200, items: 4, entriesPerItem: 10, incrementPerSku: 20, processRecords: 4000, rechecks: 1000, outbounds: 1000 },
  additionalActions: { parents: 5, purpose: 'Independent pending-QC parents, then genuine UI process/recheck/outbound actions; do not reduce the D10 backbone.' },
  fixturePreparationTransport:'The unchanged public-command backup JSON is gzip-encoded only across the test-controller/browser boundary, then decoded before native IndexedDB preparation. No app routing/cache policy changes; outside all response timing.',
  boundary: 'Mock browser only. No test/production database access, no factory/scanner/printer execution.',
};
if (args.includes('--help') || !args.includes('--run')) {
  console.log(JSON.stringify({ prepared: true, executed: false, config,
    usage: 'node scripts/verification/post-finishing-partial-performance.mjs --run [--source=http://127.0.0.1:43197] [--target=http://127.0.0.1:43198] [--reuse-fixture] [--prepare-fixture] [--calibration] [--preflight] [--profile] [--full-actions] [--route=work-list] [--families=pages,actions,storage,print]',
    families: ['cold / refresh / in-app navigation per named route', 'QC claim / QC complete', 'four item completions', 'create recheck', 'claim / release / SKU barcode / complete recheck', 'warehouse actual receipt', 'invalid quantity / aborted save input preservation', 'image open / close', 'A4 / barcode / hangtag at 100 and 1000 labels', 'PDF generation', 'backup download / restore / explicit schema migration'],
  }, null, 2));
  process.exit(0);
}
if(profileRequested && !calibration)throw new Error('CPU profiling is diagnostic-only; use --calibration --profile.');
if (!Number.isSafeInteger(trials) || trials < 1 || !calibration && !preflight && trials < 5) throw new Error('At least five trials are mandatory; the D10 volume cannot be reduced.');
mkdirSync(output, { recursive: true });
if(existsSync(resolve(output,'report.json'))){
  const prior=readFileSync(resolve(output,'report.json'));
  mkdirSync(resolve(output,'history'),{recursive:true});
  writeFileSync(resolve(output,'history','report-'+new Date().toISOString().replaceAll(':','-')+'.json'),prior);
}
const sha = value => createHash('sha256').update(value).digest('hex');
const fixturePayloadCache=new WeakMap();
const report = { version: 1, startedAt: new Date().toISOString(), timezone: 'Asia/Shanghai',
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim(),
  scriptSha256: sha(readFileSync(new URL(import.meta.url))), config, fixture: null,
  host: { platform:platform(), release:release(), arch:arch(), cpu:cpus()[0]?.model, logicalCpus:cpus().length, ramBytes:totalmem() },
  browser: '', samples: [], coverage: [], assets: [], errors: [], completed: false, passed: false,
};
function checkpoint() {
  report.families = Object.values(Object.groupBy(report.samples, row => row.family)).map(rows => ({
    family: rows[0].family, total: rows.length, valid: rows.filter(row => Number.isFinite(row.ms)).length,
    maxMs: Math.max(...rows.filter(row => Number.isFinite(row.ms)).map(row => row.ms), 0),
    passed: rows.length >= trials && rows.every(row => row.pass),
  }));
  writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
}
const browser = await chromium.launch({ headless: true });
report.browser = browser.version();
let fixture;

async function generateFixture() {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', event => { if (event.text().startsWith('D10:')) console.log(event.text()); });
  page.on('pageerror', error => report.errors.push({ phase: 'fixture', error: error.message }));
  await page.goto(sourceOrigin + prefix + 'work-orders', { waitUntil: 'networkidle' });
  await page.waitForSelector('main h1');
  const result = await page.evaluate(async () => {
    const f = await import('/src/data/fcs/post-finishing-full-flow.ts');
    const r = await import('/src/data/fcs/post-finishing-records.ts');
    await r.ensurePostFinishingRecordState();
    const items = ['开扣眼', '装扣子', '熨烫', '包装'], a = f.POST_FINISHING_ACCEPTANCE_ACTORS;
    const template = structuredClone(f.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]);
    let clock = Date.parse('2026-10-19T08:00:00+08:00');
    const at = () => clock += 1000;
    const manifest = { backbone: [], actions: [] };
    const startedAt = performance.now();
    await r.runPostFinishingCommand(() => {
      f.resetPostFinishingFullFlow();
      for (let orderIndex = 1; orderIndex <= 105; orderIndex++) {
        // The same reviewed product identity is retained. Each isolated source
        // task and return index is unique; only public source inputs are cloned.
        const source = structuredClone(template);
        source.executionTaskId = 'PF-D10-SOURCE-' + String(orderIndex).padStart(3, '0');
        source.sewingTaskNo = 'PF-D10-SEW-' + String(orderIndex).padStart(3, '0');
        source.assignmentId = 'PF-D10-ASG-' + String(orderIndex).padStart(3, '0');
        source.sewingTaskType = 'INDEPENDENT_SEWING';
        source.skus = source.skus.map(sku => ({ ...sku, plannedQty: 200 }));
        f.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.push(source);
        const delivery = f.registerPostFinishingFactoryReturn({ productionOrderNo: source.productionOrderNo, executionTaskId: source.executionTaskId,
          returnIndex: orderIndex, triggerSource: '车缝正常交出', idempotencyKey: 'D10-RETURN-' + orderIndex,
          quantities: source.skus.map(sku => ({ skuId: sku.skuId, registeredQty: 200 })),
          deliveryPersonName: 'D10隔离来源送货人', deliveryPersonPhone: '', evidenceImageUrls: [source.skus[0].imageUrl], actor: a.factoryCourier, nowMs: at() });
        f.confirmPostFinishingFactoryReturn({ deliveryId: delivery.deliveryId, firstCounts: delivery.lines.map(line => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })), actor: a.returnConfirmer, nowMs: at() });
        const qc = f.sendPostFinishingFactoryReturnToQc({ deliveryId: delivery.deliveryId, actor: a.sender, nowMs: at() });
        const identity = { orderIndex, sourceTaskId: source.executionTaskId, productionOrderNo: source.productionOrderNo, deliveryId: delivery.deliveryId, deliveryNo: delivery.deliveryOrderNo,
          qcId: qc.qcTaskId, qcNo: qc.qcTaskNo, skus: source.skus };
        if (orderIndex > 100) { manifest.actions.push(identity); continue; }
        f.claimPostFinishingQcTask({ qcTaskNo: qc.qcTaskNo, actor: a.qcA, nowMs: at() });
        f.completePostFinishingQcTask({ qcTaskId: qc.qcTaskId, actor: a.qcA, processItems: items,
          results: qc.lines.map(line => ({ skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0, returnQty: 0 })), nowMs: at() });
        const task = f.listPostFinishingFullFlowPostTasks().find(row => row.qcTaskId === qc.qcTaskId);
        identity.taskId = task.postTaskId; identity.taskNo = task.postTaskNo; identity.rechecks = []; identity.outbounds = [];
        for (const item of items) for (let entry = 1; entry <= 10; entry++) {
          f.appendPostFinishingProcessCompletion({ postTaskId: task.postTaskId, processItem: item, quantities: source.skus.map(sku => ({ skuId: sku.skuId, quantity: 20 })),
            responsible: a.postOperator, actor: a.postOperator, operationId: 'D10-PC-' + orderIndex + '-' + item + '-' + entry, nowMs: at() });
        }
        for (let sequence = 1; sequence <= 10; sequence++) {
          const rc = f.submitPostFinishingForRecheck({ postTaskId: task.postTaskId, quantities: source.skus.map(sku => ({ skuId: sku.skuId, quantity: 20 })),
            actor: a.postOperator, operationId: 'D10-RC-' + orderIndex + '-' + sequence, nowMs: at() });
          f.claimPostFinishingRecheckOrder({ recheckOrderNo: rc.recheckOrderNo, actor: a.recheckerA, nowMs: at() });
          for (const sku of source.skus) f.scanPostFinishingRecheckSkuBarcode({ recheckOrderId: rc.recheckOrderId, skuId: sku.skuId, scannedBarcode: sku.barcode, actor: a.recheckerA, nowMs: at() });
          const finished = f.completePostFinishingRecheckOrderFullFlow({ recheckOrderId: rc.recheckOrderId, results: rc.lines.map(line => ({ skuId: line.sku.skuId, handoverQty: line.expectedQty })), actor: a.recheckerA, nowMs: at() });
          const outbound = f.getPostFinishingFullFlowOutboundOrder(finished.outboundOrderId);
          // One valid pending receipt per parent remains for page and action states.
          if (sequence < 10) f.receivePostFinishingOutboundOrder({ outboundOrderNo: outbound.outboundOrderNo, receivedQuantities: outbound.lines.map(line => ({ skuId: line.sku.skuId, receivedQty: line.outboundQty })), actor: a.warehouseReceiver, nowMs: at() });
          identity.rechecks.push({ id: rc.recheckOrderId, no: rc.recheckOrderNo });
          identity.outbounds.push({ id: outbound.outboundOrderId, no: outbound.outboundOrderNo });
        }
        manifest.backbone.push(identity);
        if (orderIndex % 5 === 0) console.info('D10: public-command source generation ' + orderIndex + '/100');
      }
    });
    const backup = JSON.parse(await (await r.exportPostFinishingBackup()).text());
    const getCount = collection => backup.records.filter(row => !row.deleted && row.collection === 'flow/' + collection).length;
    const counts = Object.fromEntries(['postTasks','processCompletions','recheckOrders','outboundOrders','warehouseReceipts','qcTasks'].map(name => [name, getCount(name)]));
    if (counts.postTasks !== 100 || counts.processCompletions !== 4000 || counts.recheckOrders !== 1000 || counts.outboundOrders !== 1000 || counts.qcTasks !== 105) throw new Error('D10 generated counts do not match the fixed contract: ' + JSON.stringify(counts));
    // A separate, explicitly named snapshot supplies a 1000-piece electronic
    // print document. The D10 backbone is retained without removing any row.
    const printIdentity = manifest.actions.at(-1);
    await r.runPostFinishingCommand(() => {
      f.claimPostFinishingQcTask({ qcTaskNo: printIdentity.qcNo, actor: a.qcA, nowMs: at() });
      f.completePostFinishingQcTask({ qcTaskId: printIdentity.qcId, actor: a.qcA, processItems: items, results: printIdentity.skus.map(sku => ({ skuId: sku.skuId, passedQty: 200, defectQty: 0, returnQty: 0 })), nowMs: at() });
      const task = f.listPostFinishingFullFlowPostTasks().find(row => row.qcTaskId === printIdentity.qcId);
      for (const item of items) f.appendPostFinishingProcessCompletion({ postTaskId: task.postTaskId, processItem: item, quantities: printIdentity.skus.map(sku => ({ skuId: sku.skuId, quantity: 200 })), responsible: a.postOperator, actor: a.postOperator, operationId: 'D10-PRINT-' + item, nowMs: at() });
      const rc = f.submitPostFinishingForRecheck({ postTaskId: task.postTaskId, quantities: printIdentity.skus.map(sku => ({ skuId: sku.skuId, quantity: 200 })), actor: a.postOperator, operationId: 'D10-PRINT-RC', nowMs: at() });
      f.claimPostFinishingRecheckOrder({ recheckOrderNo: rc.recheckOrderNo, actor: a.recheckerA, nowMs: at() });
      for (const sku of printIdentity.skus) f.scanPostFinishingRecheckSkuBarcode({ recheckOrderId: rc.recheckOrderId, skuId: sku.skuId, scannedBarcode: sku.barcode, actor: a.recheckerA, nowMs: at() });
      const finished = f.completePostFinishingRecheckOrderFullFlow({ recheckOrderId: rc.recheckOrderId, actor: a.recheckerA, results: rc.lines.map(line => ({ skuId: line.sku.skuId, handoverQty: line.expectedQty })), nowMs: at() });
      manifest.print1000 = { taskId: task.postTaskId, recheckId: rc.recheckOrderId, outboundId: finished.outboundOrderId, outboundNo: finished.outboundOrderNo };
    });
    const printBackup = JSON.parse(await (await r.exportPostFinishingBackup()).text());
    return { backup, printBackup, manifest, counts, preparationMs: performance.now() - startedAt,
      sourceMethod: 'Public source fixture clones -> register return -> confirm -> send QC -> claim/complete QC -> 4000 append commands -> 1000 submit -> barcode -> complete recheck -> 900 receipts. One fixture-preparation transaction; not a UI performance sample.' };
  });
  await context.close();
  return result;
}

function installMeasurement() {
  window.__pfPerf = { pendingHandlers: 0, pendingTransactions: 0, externalPending: 0, mutationAt: 0, samples: [], errors: [], transactionLog: [], handlerLog: [], generation: 0 };
  const state = window.__pfPerf;
  const add = EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener,wrappedListeners=new WeakMap();
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if ((this === document || this instanceof Element && this.id === 'app') && ['click','input','change','keydown','submit'].includes(type) && typeof listener === 'function' && listener.constructor.name === 'AsyncFunction') {
      let byListener=wrappedListeners.get(this);if(!byListener){byListener=new WeakMap();wrappedListeners.set(this,byListener);}
      let byKey=byListener.get(listener);if(!byKey){byKey=new Map();byListener.set(listener,byKey);}
      const key=type+':'+Boolean(typeof options==='boolean'?options:options?.capture);
      if(byKey.has(key))return add.call(this,type,byKey.get(key),options);
      const wrapped = function(event) {
        const handlerStarted=performance.now(),generation=state.generation;
        const result = listener.call(this, event);
        if (result?.then) {
          state.pendingHandlers++;
          Promise.resolve(result).catch(error => state.errors.push(String(error))).finally(() => { state.pendingHandlers--; state.mutationAt = performance.now(); state.handlerLog.push({type,generation,start:handlerStarted,end:performance.now(),ms:performance.now()-handlerStarted}); });
        }
        return result;
      };
      byKey.set(key,wrapped);
      return add.call(this, type, wrapped, options);
    }
    return add.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener=function(type,listener,options){
    const key=type+':'+Boolean(typeof options==='boolean'?options:options?.capture),wrapped=listener&&typeof listener==='function'?wrappedListeners.get(this)?.get(listener)?.get(key):undefined;
    return remove.call(this,type,wrapped||listener,options);
  };
  const originalTransaction = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function(...args) {
    const tx = originalTransaction.apply(this, args);
    state.pendingTransactions++;const started=performance.now(),generation=state.generation,mode=tx.mode,stores=[...tx.objectStoreNames];
    const finish = () => { state.pendingTransactions--; state.mutationAt = performance.now(); state.transactionLog.push({generation,mode,stores,start:started,end:performance.now(),ms:performance.now()-started}); };
    tx.addEventListener('complete', finish, { once: true }); tx.addEventListener('abort', finish, { once: true });
    return tx;
  };
  new MutationObserver(() => { state.mutationAt = performance.now(); }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
  const visible = element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight && getComputedStyle(element).visibility !== 'hidden'; };
  async function readback(spec) {
    if (!spec) return { valid: true, checked: false };
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('higood-pcs-records', 2); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      const tx = originalTransaction.call(db, 'records', 'readonly');
      const lower = 'higood-fcs-post-finishing-records/flow/' + spec.collection + '/';
      const rows = await new Promise((resolve, reject) => {
        const request = tx.objectStore('records').getAll(IDBKeyRange.bound(lower, lower + '\uffff'));
        request.onsuccess = () => resolve(request.result.filter(row => !row.deleted));
        request.onerror = () => reject(request.error);
      });
      const matching = rows.filter(row => Object.entries(spec.where || {}).every(([key,value]) => row.value[key] === value));
      const valid = matching.length >= (spec.min || 1) && (spec.max === undefined || matching.length <= spec.max)
        && (!spec.field || matching.some(row => row.value[spec.field] === spec.equals))
        && (spec.valueEquals === undefined || matching.some(row => row.value === spec.valueEquals))
        && (!spec.lineStatus || matching.some(row => row.value.lines?.some(line => line.sku.skuId === spec.lineStatus.skuId && line.barcodeStatus === spec.lineStatus.barcodeStatus)));
      return { valid, checked: true, collection: spec.collection, matching: matching.length, expected: spec };
    } finally { db.close(); }
  }
  function ready(spec) {
    if (document.fonts && document.fonts.status !== 'loaded') return false;
    if (spec.selector && !document.querySelector(spec.selector)) return false;
    if (spec.gone && document.querySelector(spec.gone)) return false;
    if (spec.title && ![...document.querySelectorAll('main h1, h1, h2')].some(element => element.textContent.trim() === spec.title)) return false;
    if (spec.contains && !document.body.textContent.includes(spec.contains)) return false;
    if (spec.rows && document.querySelectorAll('main tbody tr').length < spec.rows) return false;
    if(spec.count && document.querySelectorAll(spec.count.selector).length!==spec.count.expected)return false;
    const images = spec.allImages ? [...document.images] : [...document.querySelectorAll('main img,[role="dialog"] img,[data-testid] img')].filter(visible);
    if (images.some(element => !element.complete || !element.naturalWidth)) return false;
    const qr = [...document.querySelectorAll('[data-real-qr]')].filter(visible);
    return qr.every(element => element.querySelector('svg'));
  }
  window.pfReady = ready;
  window.pfMeasureBegin = (family, spec, start = performance.now()) => {
    const generation = ++state.generation;
    state.active = { family, spec, generation, start };
    let checking = false;
    const check = async () => {
      if (generation !== state.generation || checking) return;
      if (!ready(spec) || state.pendingHandlers || state.pendingTransactions || state.externalPending || performance.now() - state.mutationAt < 25) { requestAnimationFrame(check); return; }
      checking = true;
      try {
        const readyAt=performance.now();
        const proof = await readback(spec.readback),proofAt=performance.now();
        if (!proof.valid) { checking = false; requestAnimationFrame(check); return; }
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (generation !== state.generation) return;
          if (state.pendingHandlers || state.pendingTransactions || state.externalPending || !ready(spec)) { checking = false; requestAnimationFrame(check); return; }
          state.samples.push({ family, generation, completionPhases:{readyAt:readyAt-start,readbackMs:proofAt-readyAt,paintMs:performance.now()-proofAt},transactions:state.transactionLog.filter(row=>row.generation===generation),handlers:state.handlerLog.filter(row=>row.generation===generation), ms: performance.now() - start, start, end: performance.now(), proof, event: state.lastEvent,
            images: [...document.images].filter(visible).map(image => ({ src: image.currentSrc, loaded: image.complete, width: image.naturalWidth })) });
        }));
      } catch(error) { state.errors.push(String(error)); checking = false; requestAnimationFrame(check); }
    };
    requestAnimationFrame(check);
    return generation;
  };
  window.pfMeasureArm = (family, spec, eventType = 'click') => { state.armed = { family, spec, eventType }; };
  for (const type of ['click','change','keydown']) add.call(document, type, event => {
    if (!state.armed || state.armed.eventType !== type) return;
    const armed = state.armed; state.armed = undefined;
    state.lastEvent = { type: event.type, isTrusted: event.isTrusted, target: event.target?.getAttribute?.('data-post-finishing-action') || event.target?.getAttribute?.('data-pda-post-action') || event.target?.tagName };
    window.pfMeasureBegin(armed.family, armed.spec, performance.now());
  }, true);
  add.call(document, 'DOMContentLoaded', () => {
    let expected = window.__pfLoadExpected;
    try { expected = JSON.parse(window.name || '{}').pfLoad || expected; } catch {}
    if (expected) window.pfMeasureBegin(expected.family, expected.spec, 0);
  }, { once: true });
}

async function injectBackup(page, backup, { legacy = false, method = 'put' } = {}) {
  if(!fixturePayloadCache.has(backup)){
    const json=JSON.stringify(backup),keys=['processCompletions','recheckOrders','outboundOrders','qcTasks'];
    const counts={records:backup.records.length,files:backup.files.length,...Object.fromEntries(keys.map(key=>[key,backup.records.filter(row=>!row.deleted&&row.collection==='flow/'+key).length]))};
    fixturePayloadCache.set(backup,{payload:gzipSync(json,{level:1}).toString('base64'),expected:{sha256:sha(json),counts}});
  }
  const proof=await page.evaluate(async ({ payload, expected, legacy, method }) => {
    const preparationStarted=performance.now();
    const compressed=Uint8Array.from(atob(payload),character=>character.charCodeAt(0));
    const decoded=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',decoded))].map(value=>value.toString(16).padStart(2,'0')).join('');
    const backup=JSON.parse(new TextDecoder().decode(decoded)),keys=['processCompletions','recheckOrders','outboundOrders','qcTasks'];
    const counts={records:backup.records.length,files:backup.files.length,...Object.fromEntries(keys.map(key=>[key,backup.records.filter(row=>!row.deleted&&row.collection==='flow/'+key).length]))};
    if(digest!==expected.sha256||JSON.stringify(counts)!==JSON.stringify(expected.counts))throw new Error('Decoded test fixture differs from the original public-command backup.');
    const decodedAt=performance.now();
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('higood-pcs-records', 2);
      request.onupgradeneeded = () => { for (const name of ['records','files','operations','meta']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'id' }); const ops = request.transaction.objectStore('operations'); if (!ops.indexNames.contains('createdAt')) ops.createIndex('createdAt','createdAt'); };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    let transactionMs;
    try {
      const started=performance.now(),tx=db.transaction(['records','files'],'readwrite');
      const complete=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
      const pending=[];
      const requestPromise=request=>new Promise((resolve,reject)=>{request.onsuccess=resolve;request.onerror=()=>reject(request.error);});
      if(legacy&&!backup.records.some(row=>row.collection==='flow/schemaVersion'))tx.objectStore('records').put({id:'higood-fcs-post-finishing-records/flow/schemaVersion/value',collection:'flow/schemaVersion',value:2,version:1});
      for(const row of backup.records){
        const value=legacy&&row.collection==='flow/schemaVersion'?{...row,value:2}:row;
        const request=method==='put'?tx.objectStore('records').put(value):tx.objectStore('records').add(value);
        if(method==='add-promises')pending.push(requestPromise(request));
        if(method==='add-serial')await requestPromise(request);
      }
      for(const file of backup.files)tx.objectStore('files').put({id:file.id,blob:new Blob([new Uint8Array(file.bytes)],{type:file.type})});
      if(pending.length)await Promise.all(pending);
      await complete;transactionMs=performance.now()-started;
    } finally {db.close();}
    return {sha256:digest,counts,transactionComplete:true,legacyVersionMarker:legacy,method,transactionMs,decodeAndVerifyMs:decodedAt-preparationStarted,totalPreparationMs:performance.now()-preparationStarted};
  }, {...fixturePayloadCache.get(backup),legacy,method});
  report.fixturePreparationProofs||=[];report.fixturePreparationProofs.push(proof);
  return proof;
}
const session = { userId:'F090_operator',loginId:'F090_operator',userName:'全能力测试工厂_操作工',roleId:'ROLE_OPERATOR',factoryId:'F090',factoryName:'全能力测试工厂',loggedAt:'2026-10-19 08:00:00' };
async function isolated(backup = fixture.backup, expected, actor = 'PF-USER-POST', viewport = { width: 1366, height: 768 }, legacy = false) {
  const context = await browser.newContext({ viewport, acceptDownloads: true, timezoneId:'Asia/Shanghai' });
  await context.addInitScript(installMeasurement);
  await context.addInitScript(({ actor, session, expected }) => {
    if (!localStorage.getItem('higood-fcs-post-finishing-current-actor-v1')) localStorage.setItem('higood-fcs-post-finishing-current-actor-v1', actor);
    if (!localStorage.getItem('fcs_pda_session')) localStorage.setItem('fcs_pda_session', JSON.stringify(session));
    window.__pfLoadExpected = expected;
  }, { actor, session, expected });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('response',response=>{
    const url=response.url();if(url.startsWith(targetOrigin+'/assets/')&&!report.assets.some(item=>item.url===url)){
      const local=resolve('dist',new URL(url).pathname.slice(1));
      report.assets.push({url,status:response.status(),...(existsSync(local)?{localSha256:sha(readFileSync(local))}:{})});
    }
  });
  page.on('dialog', dialog => dialog.accept());
  page.on('pageerror', error => report.errors.push({ url: page.url(), error: error.message }));
  // Static asset document establishes an origin before the app starts reading.
  await page.goto(targetOrigin + '/newpda/post-flow.css', { waitUntil: 'domcontentloaded' });
  if (backup) await injectBackup(page, backup, { legacy });
  return { context, page };
}
async function recorded(page, family, trial, spec, trigger, kind = 'action', eventType = 'click') {
  let profiler;
  if(profileRequested && profileFamilies.includes(family)){
    profiler=await page.context().newCDPSession(page);await profiler.send('Profiler.enable');await profiler.send('Profiler.setSamplingInterval',{interval:1000});await profiler.send('Profiler.start');
  }
  async function stopProfile(){
    if(!profiler)return;
    const {profile}=await profiler.send('Profiler.stop');await profiler.detach();profiler=undefined;
    const name='cpu-'+family.replaceAll(':','-')+'-'+trial;
    writeFileSync(resolve(output,name+'.cpuprofile'),JSON.stringify(profile));
    const nodes=new Map(profile.nodes.map(node=>[node.id,node]));
    const total=node=>(node.hitCount||0)+(node.children||[]).reduce((sum,id)=>sum+total(nodes.get(id)),0);
    const top=profile.nodes.map(node=>({function:node.callFrame.functionName,url:node.callFrame.url,line:node.callFrame.lineNumber,column:node.callFrame.columnNumber,selfSamples:node.hitCount||0,inclusiveSamples:total(node)})).sort((a,b)=>b.selfSamples-a.selfSamples).slice(0,25);
    for(const row of top)if(row.url.startsWith(targetOrigin+'/assets/')){try{const source=await(await fetch(row.url)).text();const line=source.split('\n')[row.line]||'';row.sourceExcerpt=line.slice(Math.max(0,row.column-80),row.column+600);}catch{}}
    const parents=new Map(profile.nodes.flatMap(node=>(node.children||[]).map(id=>[id,node.id]))),aggregated=new Map;
    for(const node of profile.nodes){
      const frame=node.callFrame,key=JSON.stringify(frame),row=aggregated.get(key)||{frame,selfSamples:0,stacks:new Map};
      row.selfSamples+=node.hitCount||0;const stack=[];let current=node.id;
      while(nodes.has(current)){stack.push(nodes.get(current).callFrame.functionName||'<anonymous>');current=parents.get(current);}
      const path=stack.join(' <- ');row.stacks.set(path,(row.stacks.get(path)||0)+(node.hitCount||0));aggregated.set(key,row);
    }
    const aggregatedTop=[...aggregated.values()].sort((a,b)=>b.selfSamples-a.selfSamples).slice(0,15).map(row=>({...row,stacks:[...row.stacks].sort((a,b)=>b[1]-a[1]).slice(0,5)}));
    const value={family,trial,samplingIntervalUs:1000,profiledTiming:true,durationUs:profile.endTime-profile.startTime,top,aggregatedTop};
    writeFileSync(resolve(output,name+'-top.json'),JSON.stringify(value,null,2));report.profiles||=[];report.profiles.push(value);checkpoint();
  }

  const before = await page.evaluate(() => window.__pfPerf.generation);
  try {
    await page.evaluate(({ family, spec, eventType }) => window.pfMeasureArm(family, spec, eventType), { family, spec, eventType });
    await trigger();
    await page.waitForFunction(({ family, before }) => window.__pfPerf.samples.some(row => row.family === family && row.generation > before), { family, before }, { timeout: 30000 });
    const sample = await page.evaluate(({ family, before }) => window.__pfPerf.samples.find(row => row.family === family && row.generation > before), { family, before });
    await stopProfile();
    const result = { ...sample, profiled:profileRequested && profileFamilies.includes(family), family, trial, kind, url: page.url(), viewport: page.viewportSize(), pass: sample.ms <= maxMs };
    report.samples.push(result); checkpoint();
    console.log(family + ' #' + trial + ': ' + sample.ms.toFixed(1) + 'ms' + (result.pass ? '' : ' FAIL'));
    return result;
  } catch(error) {
    await stopProfile();
    const diagnostic = await page.evaluate(() => ({ title: document.title, text: document.body.innerText.slice(-2000), active: window.__pfPerf.active, pendingHandlers: window.__pfPerf.pendingHandlers, pendingTransactions: window.__pfPerf.pendingTransactions, handlerErrors: window.__pfPerf.errors })).catch(() => ({}));
    report.samples.push({ family, trial, kind, url: page.url(), ms: null, pass: false, error: error.message, diagnostic }); checkpoint();
    console.log(family + ' #' + trial + ': ERROR ' + error.message);
    return null;
  }
}
async function loaded(page, family, trial, trigger) {
  try {
    await trigger();
    await page.waitForFunction(family => window.__pfPerf.samples.some(row => row.family === family), family, { timeout: 30000 });
    const sample = await page.evaluate(family => window.__pfPerf.samples.find(row => row.family === family), family);
    report.samples.push({ ...sample, family, trial, kind: family.split(':').at(-1), url: page.url(), viewport: page.viewportSize(), pass: sample.ms <= maxMs }); checkpoint();
    console.log(family + ' #' + trial + ': ' + sample.ms.toFixed(1) + 'ms');
  } catch(error) { report.samples.push({ family, trial, ms: null, pass: false, error: error.message }); checkpoint(); }
}
async function navigate(page, path) {
  await page.evaluate(path => {
    const prior = document.getElementById('pf-performance-navigation'); prior?.remove();
    const link = document.createElement('a'); link.id = 'pf-performance-navigation'; link.dataset.nav = path; link.href = path;
    link.textContent = '验证站内切换'; link.style.cssText = 'position:fixed;top:2px;left:50%;z-index:99999;background:white;padding:4px';
    document.querySelector('#app').appendChild(link);
  }, path);
  await page.locator('#pf-performance-navigation').click();
}
function routes() {
  const item = fixture.manifest.backbone[0], last = item.outbounds.at(-1);
  return [
    { key:'work-list', path:prefix+'work-orders', spec:{title:'后道加工单',rows:1} },
    { key:'work-detail', path:prefix+'work-orders/'+encodeURIComponent(item.taskId), spec:{selector:'[data-web-post-task]',contains:item.taskNo} },
    { key:'qc-list', path:prefix+'qc-orders', spec:{title:'质检清单',rows:1} },
    { key:'recheck-list', path:prefix+'recheck-orders', spec:{title:'复检单',rows:1} },
    { key:'outbound-list', path:prefix+'outbound-orders', spec:{title:'后道出货单列表',rows:1} },
    { key:'warehouse-waitprocess', path:prefix+'wait-process-warehouse', spec:{title:'后道待加工仓'} },
    { key:'warehouse-waitout', path:prefix+'wait-handover-warehouse', spec:{title:'后道待交出仓'} },
    { key:'task-overview', path:prefix+'tasks', spec:{title:'后道生产任务'} },
    { key:'audit-list', path:prefix+'audit-records', spec:{title:'差异与操作日志'} },
    { key:'audit-detail', path:prefix+'audit-records?deliveryId='+encodeURIComponent(item.deliveryId)+'&keyword='+encodeURIComponent(last.no), spec:{title:'差异与操作日志',contains:last.no} },
    { key:'statistics', path:prefix+'statistics', spec:{title:'后道统计'} },
    { key:'garment-receive', path:'/wls/finished-inbound', spec:{selector:'[data-wls-finished-inbound-root]'} },
    { key:'pda-process', path:'/fcs/pda/post-finishing/execute?id='+encodeURIComponent(item.taskNo), spec:{selector:'[data-pda-post-task]'},pda:true },
    { key:'pda-recheck', path:'/fcs/pda/post-finishing/recheck?id='+encodeURIComponent(item.rechecks[0].no), spec:{selector:'[data-pda-recheck-task]'},pda:true },
    { key:'pda-exec-detail', path:'/fcs/pda/exec/'+encodeURIComponent(item.taskId), spec:{contains:'实际工序执行'},pda:true },
  ];
}
async function routePreflight() {
  report.preflight=[];
  const {context,page}=await isolated();
  try{
    for(const route of routes().filter(route=>!routeFilter.length||routeFilter.includes(route.key))){
      await page.setViewportSize(route.pda?{width:390,height:844}:{width:1366,height:768});
      const item={key:route.key,path:route.path,spec:route.spec,valid:false};
      try{
        await page.goto(targetOrigin+route.path,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(spec=>window.pfReady(spec),route.spec,{timeout:10000});
        item.valid=true;item.title=await page.locator('h1').allTextContents();
      }catch(error){item.error=error.message;item.actual=await page.locator('main').innerText().catch(()=> '');await page.screenshot({path:resolve(output,'preflight-'+route.key+'-failed.png')});}
      report.preflight.push(item);checkpoint();console.log('preflight '+route.key+': '+(item.valid?'OK':'INVALID'));
    }
  }finally{await context.close();}
  report.preflightValid=report.preflight.every(item=>item.valid);
}
async function pageFamilies() {
  for (const route of routes().filter(route=>!routeFilter.length||routeFilter.includes(route.key))) {
    route.spec.readback={collection:'processCompletions',min:4000};
    report.coverage.push({ family:route.key, path:route.path, dataset:'D10 + five pending-QC action fixtures', spec:route.spec });
    for (let trial=1; trial<=trials; trial++) {
      const cold = route.key+':cold', refresh = route.key+':refresh', navigation = route.key+':navigation';
      const { context, page } = await isolated(fixture.backup,{family:cold,spec:route.spec},'PF-USER-POST',route.pda?{width:390,height:844}:undefined);
      try {
        await loaded(page,cold,trial,()=>page.goto(targetOrigin+route.path,{waitUntil:'domcontentloaded'}));
        await page.evaluate(({family,spec})=>{window.name=JSON.stringify({pfLoad:{family,spec}});},{family:refresh,spec:route.spec});
        await loaded(page,refresh,trial,()=>page.reload({waitUntil:'domcontentloaded'}));
        await navigate(page,prefix+'authorization-code'); await page.waitForTimeout(50);
        await recorded(page,navigation,trial,route.spec,()=>navigate(page,route.path),'navigation');
        if(trial===1){await page.screenshot({path:resolve(output,route.key+'.png'),fullPage:false});report.coverage.at(-1).assets=await page.evaluate(()=>performance.getEntriesByType('resource').filter(row=>row.name.includes('/assets/')).map(row=>({name:row.name,duration:row.duration,bytes:row.transferSize})));checkpoint();}
      } finally { await context.close(); }
    }
  }
}

const detailAction = name=>'[data-post-finishing-work-order-detail-action="'+name+'"]';
async function actionFamilies() {
  const { context, page } = await isolated();
  try {
    if(args.includes('--image-only')){
      const target=fixture.manifest.backbone[0];await page.goto(targetOrigin+prefix+'work-orders/'+encodeURIComponent(target.taskId),{waitUntil:'networkidle'});
      await recorded(page,'image:open',1,{selector:'[data-post-image-overlay] img'},()=>page.locator('[data-post-finishing-action="full-flow-zoom-image"]').first().click());
      await recorded(page,'image:close',1,{gone:'[data-post-image-overlay]',selector:'[data-web-post-task]'},()=>page.keyboard.press('Escape'),'action','keydown');return;
    }
    const actors = {qc:'PF-USER-QC-A',post:'PF-USER-POST',recheck:'PF-USER-RC-A'};
    const changeActor=actor=>page.evaluate(actor=>localStorage.setItem('higood-fcs-post-finishing-current-actor-v1',actor),actor);
    for(let index=0;index<Math.min(trials,fixture.manifest.actions.length);index++){
      const target=fixture.manifest.actions[index], trial=index+1;
      await changeActor(actors.qc);await page.goto(targetOrigin+prefix+'qc-workbench',{waitUntil:'networkidle'});
      await page.locator('[data-post-finishing-field="qc-task-input"]').fill(target.qcNo);
      await recorded(page,'qc:claim',trial,{contains:target.qcNo,readback:{collection:'qcTasks',where:{qcTaskId:target.qcId},field:'status',equals:'质检中'}},()=>page.locator('[data-post-finishing-action="full-flow-claim-qc"]').click());
      for(const checkbox of await page.locator('[data-qc-process-item]').all())await checkbox.check();
      await recorded(page,'qc:complete',trial,{contains:'质检完成',readback:{collection:'postTasks',where:{qcTaskId:target.qcId}}},()=>page.locator('[data-post-finishing-action="full-flow-complete-qc"]').click());
      if(args.includes('--qc-only'))continue;
      // Task identity is obtained from native persisted rows, not from a bundle-private API.
      target.taskId=await page.evaluate(async qcId=>{
        const db=await new Promise(resolve=>{const q=indexedDB.open('higood-pcs-records',2);q.onsuccess=()=>resolve(q.result);});
        const value=await new Promise(resolve=>{const q=db.transaction('records').objectStore('records').getAll();q.onsuccess=()=>resolve(q.result.find(row=>!row.deleted&&row.collection==='flow/postTasks'&&row.value.qcTaskId===qcId)?.value);});db.close();return value.postTaskId;
      },target.qcId);
      await changeActor(actors.post);await page.goto(targetOrigin+prefix+'work-orders/'+encodeURIComponent(target.taskId),{waitUntil:'networkidle'});
      for(const item of ['开扣眼','装扣子','熨烫','包装']){
        await page.locator(detailAction('open-register')+'[data-process-item="'+item+'"]').click();
        await page.locator('[data-post-entry-quantity]').first().waitFor();
        for(const input of await page.locator('[data-post-entry-quantity]').all())await input.fill('20');
        await recorded(page,'process:'+item+':save',trial,{gone:'[data-post-entry-form]',readback:{collection:'processCompletions',where:{postTaskId:target.taskId,processItem:item}}},()=>page.locator(detailAction('save-entry')).click());
      }
      await page.locator(detailAction('open-recheck')).click();
      await page.locator('[data-post-entry-quantity]').first().waitFor();
        for(const input of await page.locator('[data-post-entry-quantity]').all())await input.fill('20');
      await recorded(page,'recheck:create',trial,{gone:'[data-post-entry-form]',readback:{collection:'recheckOrders',where:{postTaskId:target.taskId}}},()=>page.locator(detailAction('save-entry')).click());
      target.recheck=await page.evaluate(async taskId=>{
        const db=await new Promise(resolve=>{const q=indexedDB.open('higood-pcs-records',2);q.onsuccess=()=>resolve(q.result);});
        const value=await new Promise(resolve=>{const q=db.transaction('records').objectStore('records').getAll();q.onsuccess=()=>resolve(q.result.find(row=>!row.deleted&&row.collection==='flow/recheckOrders'&&row.value.postTaskId===taskId)?.value);});db.close();return value;
      },target.taskId);
      if(calibration&&!args.includes('--full-actions')){report.calibrationAction={taskId:target.taskId,recheckNo:target.recheck.recheckOrderNo,quantity:target.recheck.lines.reduce((sum,line)=>sum+line.expectedQty,0)};checkpoint();continue;}
      if(!args.includes('--failure-only')){
      await changeActor(actors.recheck);await page.goto(targetOrigin+prefix+'recheck-orders',{waitUntil:'networkidle'});
      await page.locator('[data-post-finishing-recheck-action="open-claim"]').click();await page.locator('[data-recheck-claim-task-no]').fill(target.recheck.recheckOrderNo);
      await recorded(page,'recheck:claim',trial,{selector:'[data-recheck-web-form]',readback:{collection:'recheckOrders',where:{recheckOrderId:target.recheck.recheckOrderId},field:'status',equals:'复检中'}},()=>page.locator('[data-post-finishing-recheck-action="confirm-claim"]').click());
      await recorded(page,'recheck:release',trial,{contains:'待复检',readback:{collection:'recheckOrders',where:{recheckOrderId:target.recheck.recheckOrderId},field:'status',equals:'待复检'}},()=>page.locator('[data-post-finishing-recheck-action="release"]').first().click());
      await page.setViewportSize({width:390,height:844});
      await page.goto(targetOrigin+'/fcs/pda/post-finishing/recheck?id='+encodeURIComponent(target.recheck.recheckOrderNo),{waitUntil:'networkidle'});
      await recorded(page,'recheck:pda-claim',trial,{selector:'[data-recheck-barcode-input]',readback:{collection:'recheckOrders',where:{recheckOrderId:target.recheck.recheckOrderId},field:'status',equals:'复检中'}},()=>page.locator('[data-pda-post-action="claim-recheck"]').click());
      for(const sku of target.skus){
        const line=page.locator('[data-recheck-result-line="'+sku.skuId+'"]');
        await line.locator('[data-recheck-barcode-input]').fill(sku.barcode);
        await recorded(page,'recheck:barcode',trial,{selector:'[data-pda-recheck-task]',readback:{collection:'recheckOrders',where:{recheckOrderId:target.recheck.recheckOrderId},lineStatus:{skuId:sku.skuId,barcodeStatus:'正确'}}},()=>line.locator('[data-pda-post-action="scan-recheck-barcode"]').click());
      }
      await recorded(page,'recheck:complete',trial,{contains:'已进入后道待交出仓',readback:{collection:'outboundOrders',where:{recheckOrderId:target.recheck.recheckOrderId}}},()=>page.locator('[data-pda-post-action="complete-recheck"]').click());
      await page.setViewportSize({width:1366,height:768});
      target.outbound=await page.evaluate(async recheckId=>{
        const db=await new Promise(resolve=>{const q=indexedDB.open('higood-pcs-records',2);q.onsuccess=()=>resolve(q.result);});
        const value=await new Promise(resolve=>{const q=db.transaction('records').objectStore('records').getAll();q.onsuccess=()=>resolve(q.result.find(row=>!row.deleted&&row.collection==='flow/outboundOrders'&&row.value.recheckOrderId===recheckId)?.value);});db.close();return value;
      },target.recheck.recheckOrderId);
      await page.goto(targetOrigin+'/wls/finished-inbound',{waitUntil:'networkidle'});
      await page.locator('[data-wls-finished-inbound-field="role"]').selectOption('GARMENT_RECEIVER');await page.locator('[data-wls-finished-inbound-field="name"]').fill('D10性能验收成衣仓收货员');
      await page.locator('[data-wls-finished-inbound-field="keyword"]').fill(target.outbound.outboundOrderNo);await page.locator('[data-wls-finished-inbound-action="query"]').click();
      await page.locator('[data-wls-finished-inbound-action="open"][data-order-no="'+target.outbound.outboundOrderNo+'"]').click();
      for(const line of target.outbound.lines)await page.locator('[data-wls-finished-inbound-field="qty"][data-sku-id="'+line.sku.skuId+'"]').fill(String(line.outboundQty));
      await recorded(page,'garment:receive',trial,{contains:'实收已保存',readback:{collection:'outboundOrders',where:{outboundOrderId:target.outbound.outboundOrderId},field:'status',equals:'已接收入库'}},()=>page.locator('[data-wls-finished-inbound-action="save"]').click());
      }
      await changeActor(actors.post);await page.goto(targetOrigin+prefix+'work-orders/'+encodeURIComponent(target.taskId),{waitUntil:'networkidle'});
      if(!args.includes('--failure-only')){
      const image=page.locator('[data-post-finishing-action="full-flow-zoom-image"]').first();
      await recorded(page,'image:open',trial,{selector:'[role="dialog"] img'},()=>image.click());
      await recorded(page,'image:close',trial,{gone:'[role="dialog"] img',selector:'[data-web-post-task]'},()=>page.keyboard.press('Escape'),'action','keydown');
      }
      await page.locator(detailAction('open-register')+'[data-process-item="开扣眼"]').click();
      await page.locator('[data-post-entry-quantity]').first().fill('201');
      await recorded(page,'process:invalid-input',trial,{selector:'[data-post-finishing-action-error]',contains:'最多可登记'},()=>page.locator(detailAction('save-entry')).click());
      const retained=await page.locator('[data-post-entry-quantity]').first().inputValue();if(retained!=='201')throw new Error('Invalid input was not retained.');
      await page.locator(detailAction('close-entry')).first().click();
      for(const failureKind of ['AbortError','QuotaExceededError']){
      await page.locator(detailAction('open-register')+'[data-process-item="开扣眼"]').click();
      await page.locator('[data-post-entry-quantity]').first().fill('1');
      await page.evaluate(failureKind=>{
        const original=IDBObjectStore.prototype.put;window.__pfOriginalPut=original;
        IDBObjectStore.prototype.put=function(value,...rest){if(value.collection==='flow/processCompletions')throw new DOMException('D10 save failure injection',failureKind);return original.call(this,value,...rest);};
      },failureKind);
      await recorded(page,'process:failed-save:'+failureKind,trial,{selector:'[data-post-finishing-action-error]',readback:{collection:'processCompletions',where:{postTaskId:target.taskId},min:4,max:4}},()=>page.locator(detailAction('save-entry')).click());
      if(await page.locator('[data-post-entry-quantity]').first().inputValue()!=='1')throw new Error('Aborted save discarded recoverable input.');
      await page.evaluate(()=>{IDBObjectStore.prototype.put=window.__pfOriginalPut;delete window.__pfOriginalPut;});
      await page.locator(detailAction('close-entry')).first().click();
      }
    }
  } finally { await context.close(); }
}
async function printFamilies() {
  const small=fixture.manifest.backbone[0].outbounds[0],large=fixture.manifest.print1000;
  for(const quantity of calibration?[1000]:[100,1000])for(const type of printTypes){
    const id=quantity===100?small.id:large.outboundId,backup=quantity===100?fixture.backup:fixture.printBackup;
    const key='print:'+type+':'+quantity;
    for(let trial=1;trial<=trials;trial++){
      const path=type.startsWith('GENERIC_')?'/fcs/print/preview?documentType='+(type==='GENERIC_OUTBOUND'?'POST_FINISHING_OUTBOUND_ORDER':'POST_FINISHING_OUTBOUND_BARCODE')+'&sourceType=POST_FINISHING_OUTBOUND_ORDER&sourceId='+encodeURIComponent(id):prefix+'print?type='+type+'&id='+encodeURIComponent(id),spec={readback:{collection:'processCompletions',min:4000},selector:type.startsWith('GENERIC_')?'.print-preview-root':type==='OUTBOUND'?'[data-testid="post-finishing-full-flow-print"]':'[data-testid="post-finishing-outbound-label-print"][data-label-count="'+quantity+'"]',allImages:true,...(type==='GENERIC_BARCODE'?{count:{selector:'.online-sku-barcode',expected:quantity}}:type==='OUTBOUND_BARCODE'||type==='OUTBOUND_HANGTAG'?{count:{selector:'[data-outbound-unit-label]',expected:quantity}}:{})};
      const {context,page}=await isolated(backup,{family:key+':cold',spec});
      try{
        await loaded(page,key+':cold',trial,()=>page.goto(targetOrigin+path,{waitUntil:'domcontentloaded'}));
        const begin=await page.evaluate(()=>performance.now());
        await page.pdf({path:resolve(output,key.replaceAll(':','-')+'-'+trial+'.pdf'),format:'A4',printBackground:true,timeout:30000});
        const end=await page.evaluate(()=>performance.now());
        report.samples.push({family:key+':pdf',trial,kind:'pdf-generation',ms:end-begin,pass:end-begin<=maxMs,url:page.url(),boundary:'Browser monotonic timestamps surround Chromium PDF rendering and local result delivery; no physical printer.'});checkpoint();
        if(trial===1)await page.screenshot({path:resolve(output,key.replaceAll(':','-')+'.png'),fullPage:false});
      }catch(error){report.samples.push({family:key+':pdf',trial,ms:null,pass:false,error:error.message});checkpoint();}
      finally{await context.close();}
    }
  }  const parent=fixture.manifest.backbone[0];
  if(!calibration)for(const [type,id] of [['POST_ORDER',parent.taskId],['QC_ORDER',parent.qcId],['QC_DETAIL',parent.qcId]]){
    const key='print:'+type;
    for(let trial=1;trial<=trials;trial++){
      const spec={readback:{collection:'processCompletions',min:4000},selector:type==='POST_ORDER'?'[data-testid="post-finishing-full-flow-print"]':type==='QC_ORDER'?'[data-testid="post-finishing-qc-master-print"]':'[data-testid="post-finishing-qc-detail-print"]',allImages:true};
      const {context,page}=await isolated(fixture.backup,{family:key+':cold',spec});
      try{await loaded(page,key+':cold',trial,()=>page.goto(targetOrigin+prefix+'print?type='+type+'&id='+encodeURIComponent(id),{waitUntil:'domcontentloaded'}));}
      finally{await context.close();}
    }
  }

}
async function storageFamilies() {
  const source=fixture.manifest.backbone[0],auditPath=prefix+'audit-records?keyword='+encodeURIComponent(source.outbounds.at(-1).no),detailSelector='main tbody tr a[data-nav*="deliveryId='+encodeURIComponent(source.deliveryId)+'"]';
  const backupPath=resolve(output,'restore-input.json');writeFileSync(backupPath,JSON.stringify(fixture.backup));
  const storageKinds=option('--storage-kind','export,restore,migration').split(',');
  for(let trial=1;trial<=trials;trial++){
    let handle,page;
    if(storageKinds.includes('export')){
    handle=await isolated();page=handle.page;
    try{
      await page.goto(targetOrigin+auditPath,{waitUntil:'networkidle'});
      const file=resolve(output,'download-'+trial+'.json');
      await page.evaluate(()=>window.__pfPerf.externalPending++);
      await recorded(page,'storage:export',trial,{selector:'main h1'},async()=>{try{const [download]=await Promise.all([page.waitForEvent('download',{timeout:30000}),page.locator('[data-post-finishing-action="storage-export"]').click()]);await download.saveAs(file);}finally{await page.evaluate(()=>window.__pfPerf.externalPending--);}});
      const parsed=JSON.parse(readFileSync(file,'utf8'));if(parsed.records.filter(row=>!row.deleted&&row.collection==='flow/processCompletions').length!==4000)throw new Error('Export omitted D10 process records.');
    }finally{await handle.context.close();}
    }
    if(storageKinds.includes('restore')){
    handle=await isolated(null);page=handle.page;
    try{
      await page.goto(targetOrigin+auditPath,{waitUntil:'networkidle'});
      // Timing begins at the browser change event. The report records whether
      // that Playwright file event is trusted; selection/upload transport is outside timing.
      const input=page.locator('[data-post-finishing-field="storage-import"]');
      await recorded(page,'storage:restore',trial,{title:'差异与操作日志',selector:detailSelector,contains:source.deliveryNo,readback:{collection:'processCompletions',min:4000}},()=>input.setInputFiles(backupPath),'action','change');
    }finally{await handle.context.close();}
    }
    if(storageKinds.includes('migration')){
    handle=await isolated(fixture.backup,undefined,'PF-USER-POST',undefined,true);page=handle.page;
    try{
      await page.goto(targetOrigin+auditPath,{waitUntil:'networkidle'});await page.waitForSelector('[data-post-finishing-action="storage-migrate"]');
      report.migrationBoundary='D10 performance input uses schema-version 2 marker on the generated version-3 rows to exercise explicit migration/save cost. Historical conversion correctness is covered by separate migration contracts, not this synthetic input.';
      await recorded(page,'storage:explicit-migration',trial,{gone:'[data-post-finishing-storage-notice]',selector:detailSelector,contains:source.deliveryNo,readback:{collection:'schemaVersion',valueEquals:3,min:1}},()=>page.locator('[data-post-finishing-action="storage-migrate"]').click());
    }finally{await handle.context.close();}
    }
  }
}
try {
  fixture = args.includes('--reuse-fixture') && existsSync(fixtureFile) ? JSON.parse(readFileSync(fixtureFile,'utf8')) : await generateFixture();
  if (!args.includes('--reuse-fixture') || !existsSync(fixtureFile)) writeFileSync(fixtureFile,JSON.stringify(fixture));
  report.fixture={file:fixtureFile,sha256:sha(readFileSync(fixtureFile)),counts:fixture.counts,preparationMs:fixture.preparationMs,sourceMethod:fixture.sourceMethod};
  checkpoint();console.log('D10 prepared: '+JSON.stringify(report.fixture.counts));
  if(args.includes('--prepare-fixture'))report.prepared=true;
  else if(args.includes('--diagnose-import-requests')){
    report.diagnosticBoundary='Isolated empty test IndexedDB raw write diagnostics; identical public-generated bytes and rows; not a product restore or acceptance sample.';report.writeDiagnostics=[];
    for(const method of ['put','add','add-promises','add-serial']){
      const {context,page}=await isolated(null);try{const proof=await injectBackup(page,fixture.backup,{method});report.writeDiagnostics.push(proof);checkpoint();console.log('raw '+method+': '+proof.transactionMs.toFixed(1)+'ms');}finally{await context.close();}
    }
  }
  else if(preflight){await routePreflight();}
  else{
    for(const [name,runner] of [['pages',pageFamilies],['actions',actionFamilies],['print',printFamilies],['storage',storageFamilies]])if(selected.has(name)){
      try{await runner();}catch(error){report.errors.push({phase:name,error:error.stack||String(error)});checkpoint();}
    }
    report.completed=report.errors.length===0;
  }
} catch(error) { report.errors.push({phase:'runner',error:error.stack||String(error)}); }
finally {
  report.finishedAt=new Date().toISOString();checkpoint();
  report.passed=!calibration&&report.completed&&report.errors.length===0&&report.families.length>0&&report.families.every(family=>family.passed);checkpoint();
  await browser.close();
}
console.log(JSON.stringify({report:resolve(output,'report.json'),calibration,completed:report.completed,passed:report.passed,families:report.families,errors:report.errors},null,2));
if(!report.passed&&!args.includes('--prepare-fixture')&&!calibration&&!preflight)process.exitCode=1;

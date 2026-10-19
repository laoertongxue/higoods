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
import { gzipSync, gunzipSync } from 'node:zlib';

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
const stopOnFailure=args.includes('--stop-on-failure')||!calibration&&!preflight;
const selected = new Set(option('--families', calibration?'pages,actions,print':'pages,actions,storage,print,delta,startup').split(','));
const routeFilter=option('--route',calibration?'work-list':'').split(',').filter(Boolean);
const printTypes=option('--print-types',calibration?'OUTBOUND_BARCODE':'OUTBOUND,OUTBOUND_BARCODE,OUTBOUND_HANGTAG,GENERIC_OUTBOUND,GENERIC_BARCODE').split(',');
const trials = Number(option('--trials', calibration?'1':'5'));
const maxMs = 1000;
const restoreAuthorization={date:'2026-10-19',source:'User confirmation in the current session, relayed by the root agent',quote:'仅该规模完整恢复采用≤10秒，其余仍≤1秒',family:'storage:restore',maxMs:10000,scope:{records:27548,jsonBytes:36178108,sha256:'78adb8de3cac155fd32499707c4d7d703f0f7f9e48e8bad72d0642f12bb1d586'}};
function familyThreshold(family){const scope=restoreAuthorization.scope;return family==='storage:restore'&&report.fixture?.backupRecordRows===scope.records&&report.fixture?.backupJsonBytes===scope.jsonBytes&&report.fixture?.backupJsonSha256===scope.sha256?restoreAuthorization.maxMs:maxMs;}
const namespace = 'higood-fcs-post-finishing-records';
const prefix = '/fcs/craft/post-finishing/';
const fixtureFile = resolve(option('--fixture', output + '/d10-fixture.json'));
const config = { restoreAuthorization, arguments:args, sourceOrigin, targetOrigin, calibration, preflight,stopOnFailure,profileRequested, routeFilter, printTypes, trials, maxMs, selected: [...selected], coldDefinition:'Fresh isolated browser context with empty application HTTP cache; a static CSS document establishes the origin for IndexedDB fixture preparation before app navigation. No main app assets or images are loaded during origin preparation.',
  acceptancePlan:{finalNew:{families:100,samples:520},explicitPdfReuse:{families:0,samples:0},combined:{families:100,samples:520},newBreakdown:{pages:{families:45,samples:225},actions:{families:18,samples:110},printCold:{families:13,samples:65},printPdf:{families:10,samples:50},storage:{families:3,samples:15},delta:{families:10,samples:50},startup:{families:1,samples:5}},formalArguments:'--families=pages,actions,print,storage,delta,startup (five trials, no route/type filters, no --skip-pdf)',boundary:'This is the final full-run coverage plan. A selected-family/calibration report proves only its actual samples; final counts must be verified from observed unique families and sample rows. Old PDF timings are historical only; all 50 PDF actions are measured again on final assets.'},
  D10: { parentOrders: 100, skusPerOrder: 5, quantityPerSku: 200, items: 4, entriesPerItem: 10, incrementPerSku: 20, processRecords: 4000, rechecks: 1000, outbounds: 1000 },
  dateBoundary:{fixtureBusinessDate:'2026-10-19',runtimeDate:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'}),clockOverride:false,statisticsScope:'ALL: the actual statistics page calls getPostFinishingExecutionStatistics() with no filter; the default {} has no time range and matchTimeRange returns true. No date selector exists on this route. Original return/processing/recheck/receipt D10 facts remain dated 2026-10-19; added UI actions use actual current date and are separate.'},
  additionalActions: { parents: 5, purpose: 'Independent pending-QC parents, then genuine UI process/recheck/outbound actions; do not reduce the D10 backbone.' },
  fixturePreparationTransport:'The unchanged public-command backup JSON is gzip-encoded only across the test-controller/browser boundary, then decoded before native IndexedDB preparation. No app routing/cache policy changes; outside all response timing.',
  boundary: 'Mock browser only. No test/production database access, no factory/scanner/printer execution.',
};
if (args.includes('--help') || !args.includes('--run')) {
  console.log(JSON.stringify({ prepared: true, executed: false, config,
    usage: 'node scripts/verification/post-finishing-partial-performance.mjs --run [--source=http://127.0.0.1:43197] [--target=http://127.0.0.1:43198] [--reuse-fixture] [--prepare-fixture] [--calibration] [--preflight] [--profile] [--full-actions] [--route=work-list] [--families=pages,actions,storage,print,delta,startup] [--skip-pdf] [--stop-on-failure] [--prepare-delta-fixture] [--delta-fixture=/path/to/file.json.gz]',
    families: ['cold / refresh / in-app navigation per named route', 'QC claim / QC complete', 'four item completions', 'create recheck', 'claim / release / SKU barcode / complete recheck', 'warehouse actual receipt', 'invalid quantity / aborted save input preservation', 'image open / close', 'A4 / barcode / hangtag at 100 and 1000 labels', 'PDF generation', 'backup download / restore / explicit schema migration', 'supervisor correction / reason failure / form open-cancel / real list query-reset-pagination / H400-N600 legacy UI save', 'real old-tab blocked-upgrade notice and preserved common-record recovery'],
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
  distIndexSha256:existsSync(resolve('dist/index.html'))?sha(readFileSync(resolve('dist/index.html'))):null,
  host: { platform:platform(), release:release(), arch:arch(), cpu:cpus()[0]?.model, logicalCpus:cpus().length, ramBytes:totalmem() },
  browser: '', samples: [], coverage: [], assets: [], errors: [], completed: false, passed: false,
};
const reuseFile=resolve('docs/product-design/post-finishing-partial-flow-20261019/evidence/performance/formal-original-1s-report.json');
if(existsSync(reuseFile)){
  const priorBytes=readFileSync(reuseFile),prior=JSON.parse(priorBytes),reusable=family=>family.startsWith('print:')&&family.endsWith(':pdf');
  report.reuse={sourceReport:reuseFile,sourceReportSha256:sha(priorBytes),sourceScriptSha256:prior.scriptSha256,sourceStartedAt:prior.startedAt,sourceAssets:prior.assets,
    unchangedFamilies:[],
    pdfArtifacts:prior.samples.filter(row=>row.kind==='pdf-generation'&&reusable(row.family)).map(row=>{const path=resolve(reuseFile,'..',row.family.replace(/:pdf$/,'').replaceAll(':','-')+'-'+row.trial+'.pdf');return {family:row.family,trial:row.trial,path,sha256:existsSync(path)?sha(readFileSync(path)):null};}),
    reasons:{readPages:'All 45 cold/refresh/navigation families are re-tested. New outbound/receipt/warehouse/source-QC relationship validation executes in the ordinary ensure callback and changes every full hydration.',actions:'All 18 original action families are re-tested after integrating main eb1b8c92 because the new persistence/source guard also affects already-ready commands. The prior plan to inherit 13 local families has been withdrawn; no old local action timing is counted toward final acceptance.',print:'All 13 print cold families and all 10 independent PDF-generation families are re-tested on final assets. Old PDF paths/hashes remain history and visual-reference provenance only. New DOM/source/print-media geometry is checked before new PDF actions; no old timing samples count toward final acceptance.',storage:'All three storage families are re-tested. Restore is bound to stricter external-import/relationship validation and the exact scope-only user authorization.'},
    boundary:'Historical reference only: no old samples are inherited in final performance acceptance. Prior asset/PDF bindings and old 1s restore failures remain unchanged.'};
}
function checkpoint() {
  report.families = Object.values(Object.groupBy(report.samples, row => row.family)).map(rows => ({
    family: rows[0].family, total: rows.length, valid: rows.filter(row => Number.isFinite(row.ms)).length,
    thresholdMs:rows[0].thresholdMs||1000,
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

const deltaFile=resolve(option('--delta-fixture','docs/product-design/post-finishing-partial-flow-20261019/evidence/performance/d10-delta-fixture.json.gz'));
async function prepareDeltaFixture(){
  const context=await browser.newContext(),page=await context.newPage();
  try{
    await page.goto(sourceOrigin+'/newpda/post-flow.css',{waitUntil:'domcontentloaded'});await injectBackup(page,fixture.backup);
    await page.goto(sourceOrigin+prefix+'work-orders',{waitUntil:'networkidle'});
    const value=await page.evaluate(async actions=>{
      const f=await import('/src/data/fcs/post-finishing-full-flow.ts'),r=await import('/src/data/fcs/post-finishing-records.ts');await r.ensurePostFinishingRecordState();
      const actors=f.POST_FINISHING_ACCEPTANCE_ACTORS,items=['开扣眼','装扣子','熨烫','包装'];let clock=Date.now();const at=()=>++clock,manifest=[];
      await r.runPostFinishingCommand(()=>{
        for(const action of actions){const qc=f.claimPostFinishingQcTask({qcTaskNo:action.qcNo,actor:actors.qcA,nowMs:at()});
          f.completePostFinishingQcTask({qcTaskId:qc.qcTaskId,actor:actors.qcA,processItems:items,results:qc.lines.map(line=>({skuId:line.sku.skuId,passedQty:line.expectedQty,defectQty:0,returnQty:0})),nowMs:at()});
          const task=f.listPostFinishingFullFlowPostTasks().find(task=>task.qcTaskId===qc.qcTaskId);manifest.push({...action,taskId:task.postTaskId,taskNo:task.postTaskNo});}
      });
      const qcOnly=JSON.parse(await(await r.exportPostFinishingBackup()).text());
      await r.runPostFinishingCommand(()=>{
        for(const target of manifest){
          for(const item of items)f.appendPostFinishingProcessCompletion({postTaskId:target.taskId,processItem:item,quantities:target.skus.map(sku=>({skuId:sku.skuId,quantity:20})),responsible:actors.postOperator,actor:actors.postOperator,operationId:'D10-DELTA-'+target.orderIndex+'-'+item,nowMs:at()});
          f.submitPostFinishingForRecheck({postTaskId:target.taskId,quantities:target.skus.map(sku=>({skuId:sku.skuId,quantity:10})),actor:actors.postOperator,operationId:'D10-DELTA-RC-'+target.orderIndex,nowMs:at()});
          const operationId='D10-DELTA-ROOM-'+target.orderIndex;
          f.appendPostFinishingProcessCompletion({postTaskId:target.taskId,processItem:'开扣眼',quantities:target.skus.map(sku=>({skuId:sku.skuId,quantity:10})),responsible:actors.postOperator,actor:actors.postOperator,operationId,nowMs:at()});
          target.correctionRecordId=f.getPostFinishingProcessProgress(target.taskId).records.find(record=>record.operationId===operationId).recordId;
        }
      });
      return {backup:JSON.parse(await(await r.exportPostFinishingBackup()).text()),qcOnly,manifest};
    },fixture.manifest.actions);
    const legacyBackup=structuredClone(value.qcOnly),legacyTarget=value.manifest.at(-1),row=legacyBackup.records.find(row=>!row.deleted&&row.collection==='flow/postTasks'&&row.value.postTaskId===legacyTarget.taskId);
    delete row.value.executionModel;delete row.value.legacyCarryover;row.value.status='后道中';row.value.results=row.value.lines.map(line=>({sku:line.sku,expectedQty:line.expectedQty,processedQty:80,unprocessedQty:120}));
    const result={backup:value.backup,legacyBackup,manifest:value.manifest,legacyTarget,provenance:{source:'Public-generated fixed D10 backup plus five existing pending-QC source records; public claim/QC/append/submit commands only for new facts.',mainFixtureSha256:sha(readFileSync(fixtureFile)),mainBackupSha256:sha(JSON.stringify(fixture.backup)),legacy:'Declared historical test input: only one added postTask is mapped to old execution shape with five SKU H80/N120 (H400/N600). No process completion records are invented for that historical task; original results remain after UI carryover.'}};
    writeFileSync(deltaFile,gzipSync(JSON.stringify(result),{level:1}));report.deltaFixture={file:deltaFile,sha256:sha(readFileSync(deltaFile)),provenance:result.provenance};checkpoint();return result;
  }finally{await context.close();}
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
      const valid = matching.length >= (spec.min ?? 1) && (spec.max === undefined || matching.length <= spec.max)
        && (!spec.field || matching.some(row => row.value[spec.field] === spec.equals))
        && (spec.valueEquals === undefined || matching.some(row => row.value === spec.valueEquals))
        && (!spec.lineStatus || matching.some(row => row.value.lines?.some(line => line.sku.skuId === spec.lineStatus.skuId && line.barcodeStatus === spec.lineStatus.barcodeStatus)));
      const quantitiesMatch=(row,expected)=>expected.every(line=>row?.value?.quantities?.some(value=>value.skuId===line.skuId&&value.quantity===line.quantity));
      const extraValid=(!spec.quantities||matching.some(row=>quantitiesMatch(row,spec.quantities)))&&(!spec.requiredRecords||spec.requiredRecords.every(required=>quantitiesMatch(rows.find(row=>row.value.recordId===required.recordId),required.quantities)))&&(!spec.historyTotal||matching.some(row=>row.value.legacyCarryover?.history?.reduce((sum,line)=>sum+line.completedQty,0)===spec.historyTotal))&&(!spec.oldResultTotal||matching.some(row=>row.value.results?.reduce((sum,line)=>sum+line.processedQty,0)===spec.oldResultTotal));
      const secondary=spec.secondary?await readback(spec.secondary):undefined;
      return { valid:valid&&extraValid&&(!secondary||secondary.valid), checked: true, collection: spec.collection, matching: matching.length, expected: spec,secondary };
    } finally { db.close(); }
  }
  function ready(spec) {
    if (document.fonts && document.fonts.status !== 'loaded') return false;
    if (spec.selector && !document.querySelector(spec.selector)) return false;
    if (spec.gone && document.querySelector(spec.gone)) return false;
    if(spec.focus&&!document.activeElement?.matches(spec.focus))return false;
    if (spec.title && ![...document.querySelectorAll('main h1, h1, h2')].some(element => element.textContent.trim() === spec.title)) return false;
    if (spec.contains && !document.body.textContent.includes(spec.contains)) return false;
    if (spec.rows && document.querySelectorAll('main tbody tr').length < spec.rows) return false;
    if(spec.footerContains&&!document.querySelector('main footer')?.textContent.includes(spec.footerContains))return false;
    if(spec.count && document.querySelectorAll(spec.count.selector).length!==spec.count.expected)return false;
    if(spec.rowIds){
      const values=[...document.querySelectorAll('main tbody tr')].map(row=>row.querySelector('a[data-nav^="/fcs/craft/post-finishing/work-orders/"]')?.getAttribute('data-nav')).filter(Boolean).map(path=>decodeURIComponent(path.split('/work-orders/')[1].split(/[?#]/)[0]));
      const rule=spec.rowIds;if(rule.count!==undefined&&values.length!==rule.count||new Set(values).size!==values.length)return false;
      if(rule.exact&&JSON.stringify(values)!==JSON.stringify(rule.exact))return false;
      if(rule.noneOf&&values.some(value=>rule.noneOf.includes(value)))return false;
      if(rule.allowed&&values.some(value=>!rule.allowed.includes(value)))return false;
    }
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
        const decodeStart=performance.now();if(spec.allImages)await Promise.all([...document.images].map(image=>image.decode()));const decodeMs=performance.now()-decodeStart;
        const proof = await readback(spec.readback),proofAt=performance.now();
        if (!proof.valid) { checking = false; requestAnimationFrame(check); return; }
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (generation !== state.generation) return;
          if (state.pendingHandlers || state.pendingTransactions || state.externalPending || !ready(spec)) { checking = false; requestAnimationFrame(check); return; }
          state.samples.push({ family, generation, handlerErrors:state.errors.slice(), completionPhases:{readyAt:readyAt-start,imageDecodeMs:decodeMs,readbackMs:proofAt-readyAt-decodeMs,paintMs:performance.now()-proofAt},transactions:state.transactionLog.filter(row=>row.generation===generation),handlers:state.handlerLog.filter(row=>row.generation===generation), ms: performance.now() - start, start, end: performance.now(), proof, event: state.lastEvent,
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
async function startCpuProfile(page,family,trial) {
  let profiler;
  if(profileRequested && profileFamilies.includes(family)){
    profiler=await page.context().newCDPSession(page);await profiler.send('Profiler.enable');await profiler.send('Profiler.setSamplingInterval',{interval:1000});await profiler.send('Profiler.start');
  }
  return async function stopProfile(){
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
  };
}
async function recorded(page, family, trial, spec, trigger, kind = 'action', eventType = 'click') {
  const stopProfile=await startCpuProfile(page,family,trial);
  const before = await page.evaluate(() => window.__pfPerf.generation);
  try {
    await page.evaluate(({ family, spec, eventType }) => window.pfMeasureArm(family, spec, eventType), { family, spec, eventType });
    await trigger();
    await page.waitForFunction(({ family, before }) => window.__pfPerf.samples.some(row => row.family === family && row.generation > before), { family, before }, { timeout: 30000 });
    const sample = await page.evaluate(({ family, before }) => window.__pfPerf.samples.find(row => row.family === family && row.generation > before), { family, before });
    await stopProfile();
    const thresholdMs=familyThreshold(family);
    if(sample.handlerErrors?.length)report.errors.push({phase:'handler',family,errors:sample.handlerErrors});
    const result = { ...sample, thresholdMs, profiled:profileRequested && profileFamilies.includes(family), family, trial, kind, url: page.url(), viewport: page.viewportSize(), pass: sample.ms <= thresholdMs && !sample.handlerErrors?.length };
    report.samples.push(result); checkpoint();
    console.log(family + ' #' + trial + ': ' + sample.ms.toFixed(1) + 'ms' + (result.pass ? '' : ' FAIL'));
    if(stopOnFailure&&!result.pass){const failure=new Error('Stop after valid failed sample: '+family+' #'+trial+' '+sample.ms.toFixed(1)+'ms > '+thresholdMs+'ms or handler failure.');failure.pfValidFailure=true;throw failure;}
    return result;
  } catch(error) {
    if(error.pfValidFailure)throw error;
    await stopProfile();
    const diagnostic = await page.evaluate(() => ({ title: document.title, text: document.body.innerText.slice(-2000), active: window.__pfPerf.active, pendingHandlers: window.__pfPerf.pendingHandlers, pendingTransactions: window.__pfPerf.pendingTransactions, handlerErrors: window.__pfPerf.errors })).catch(() => ({}));
    report.samples.push({ family, trial, kind, url: page.url(), ms: null, pass: false, error: error.message, diagnostic }); checkpoint();
    console.log(family + ' #' + trial + ': ERROR ' + error.message);
    if(stopOnFailure)throw error;
    return null;
  }
}
async function loaded(page, family, trial, trigger) {
  const stopProfile=await startCpuProfile(page,family,trial);
  try {
    await trigger();
    await page.waitForFunction(family => window.__pfPerf.samples.some(row => row.family === family), family, { timeout: 30000 });
    const sample = await page.evaluate(family => window.__pfPerf.samples.find(row => row.family === family), family);
    const thresholdMs=familyThreshold(family);if(sample.handlerErrors?.length)report.errors.push({phase:'handler',family,errors:sample.handlerErrors});
    const resourceTimings=await page.evaluate(()=>performance.getEntriesByType('resource').map(row=>({name:row.name,initiatorType:row.initiatorType,startTime:row.startTime,duration:row.duration,responseEnd:row.responseEnd,transferSize:row.transferSize})).sort((a,b)=>b.duration-a.duration).slice(0,30));
    const result={ ...sample, thresholdMs, family, trial, profiled:profileRequested&&profileFamilies.includes(family),resourceTimings,kind: family.split(':').at(-1), url: page.url(), viewport: page.viewportSize(), pass: sample.ms <= thresholdMs && !sample.handlerErrors?.length };
    report.samples.push(result);checkpoint();
    console.log(family + ' #' + trial + ': ' + sample.ms.toFixed(1) + 'ms');
    if(stopOnFailure&&!result.pass){const failure=new Error('Stop after valid failed sample: '+family+' #'+trial+' '+sample.ms.toFixed(1)+'ms > '+thresholdMs+'ms or handler failure.');failure.pfValidFailure=true;throw failure;}
    return result;
  } catch(error) { if(error.pfValidFailure)throw error;report.samples.push({ family, trial, ms: null, pass: false, error: error.message }); checkpoint();if(stopOnFailure)throw error;return null; }
  finally{await stopProfile();}
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
        await navigate(page,prefix+'authorization-code');
        // Preparing the previous route is outside the next navigation sample.
        // A fixed delay can insert the next anchor into a still-rendering shell.
        await page.waitForFunction(()=>window.pfReady({selector:'[data-testid="post-finishing-authorization-page"]'})&&!window.__pfPerf.pendingHandlers&&!window.__pfPerf.pendingTransactions&&performance.now()-window.__pfPerf.mutationAt>=25,undefined,{timeout:15000});
        await recorded(page,navigation,trial,route.spec,()=>navigate(page,route.path),'navigation');
        if(trial===1){await page.screenshot({path:resolve(output,route.key+'.png'),fullPage:false});report.coverage.at(-1).assets=await page.evaluate(()=>performance.getEntriesByType('resource').filter(row=>row.name.includes('/assets/')).map(row=>({name:row.name,duration:row.duration,bytes:row.transferSize})));checkpoint();}
      } finally { await context.close(); }
    }
  }
}

const detailAction = name=>'[data-post-finishing-work-order-detail-action="'+name+'"]';
async function actionFamilies() {
  if(args.includes('--recheck-navigation-only'))return recheckNavigationFamilies();
  const { context, page } = await isolated();
  try {
    if(args.includes('--image-only')){
      const target=fixture.manifest.backbone[0];await page.goto(targetOrigin+prefix+'work-orders/'+encodeURIComponent(target.taskId),{waitUntil:'networkidle'});
      await recorded(page,'image:open',1,{selector:'[data-post-image-overlay] img'},()=>page.locator('[data-post-finishing-action="full-flow-zoom-image"]').first().click());
      const imageKey=option('--image-key','Escape');
      if(imageKey==='Enter'&&!await page.locator('[data-post-image-close]').evaluate(button=>document.activeElement===button))throw new Error('Enter calibration requires the actual focused image close button.');
      await recorded(page,imageKey==='Enter'?'image:enter-close':'image:close',1,{gone:'[data-post-image-overlay]',selector:'[data-web-post-task]',focus:'[data-post-finishing-action="full-flow-zoom-image"]'},()=>page.keyboard.press(imageKey),'action','keydown');return;
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
async function recheckNavigationFamilies(){
  if(!existsSync(deltaFile))throw new Error('Prepare the public-command delta fixture first.');
  const delta=JSON.parse(gunzipSync(readFileSync(deltaFile)).toString());report.deltaFixture={file:deltaFile,sha256:sha(readFileSync(deltaFile)),provenance:delta.provenance};
  report.coverage.push({family:'recheck-navigation-actions',dataset:'Fixed full D10 backbone plus five added postTasks/5 pending 5-SKU rechecks generated through public commands. Child quantities are 50 total per added task; DOM/SKU count matches the earlier 100-total action case.',reason:'These claim/release actions call appStore.navigate, so ordinary ensure/relationship validation must be included in the response endpoint.'});
  const {context,page}=await isolated(delta.backup,undefined,'PF-USER-RC-A');
  try{
    for(let index=0;index<Math.min(trials,delta.manifest.length);index++){
      const target=delta.manifest[index],trial=index+1,recheck=delta.backup.records.find(row=>!row.deleted&&row.collection==='flow/recheckOrders'&&row.value.postTaskId===target.taskId)?.value;
      if(!recheck)throw new Error('Delta pending child was not found.');
      await page.setViewportSize({width:1366,height:768});await page.goto(targetOrigin+prefix+'recheck-orders',{waitUntil:'networkidle'});
      await page.locator('[data-post-finishing-recheck-action="open-claim"]').click();await page.locator('[data-recheck-claim-task-no]').fill(recheck.recheckOrderNo);
      await recorded(page,'recheck:claim',trial,{selector:'[data-recheck-web-form]',readback:{collection:'recheckOrders',where:{recheckOrderId:recheck.recheckOrderId},field:'status',equals:'复检中'}},()=>page.locator('[data-post-finishing-recheck-action="confirm-claim"]').click());
      await recorded(page,'recheck:release',trial,{contains:'待复检',readback:{collection:'recheckOrders',where:{recheckOrderId:recheck.recheckOrderId},field:'status',equals:'待复检'}},()=>page.locator('[data-post-finishing-recheck-action="release"]').first().click());
      await page.setViewportSize({width:390,height:844});await page.goto(targetOrigin+'/fcs/pda/post-finishing/recheck?id='+encodeURIComponent(recheck.recheckOrderNo),{waitUntil:'networkidle'});
      await recorded(page,'recheck:pda-claim',trial,{selector:'[data-recheck-barcode-input]',readback:{collection:'recheckOrders',where:{recheckOrderId:recheck.recheckOrderId},field:'status',equals:'复检中'}},()=>page.locator('[data-pda-post-action="claim-recheck"]').click());
    }
  }finally{await context.close();}
}
async function deltaFamilies(){
  if(!existsSync(deltaFile))throw new Error('Prepare the public-command delta fixture first.');
  const delta=JSON.parse(gunzipSync(readFileSync(deltaFile)).toString());report.deltaFixture={file:deltaFile,sha256:sha(readFileSync(deltaFile)),provenance:delta.provenance};
  let handle=await isolated(delta.backup,undefined,'PF-USER-POST-MGR'),page=handle.page;
  try{
    for(let index=0;index<Math.min(trials,delta.manifest.length);index++){
      const target=delta.manifest[index],trial=index+1;
      await page.goto(targetOrigin+prefix+'work-orders/'+encodeURIComponent(target.taskId),{waitUntil:'networkidle'});
      await page.locator(detailAction('open-correct')+'[data-record-id="'+target.correctionRecordId+'"]').click();await page.locator('[data-post-entry-quantity]').first().waitFor();
      for(const input of await page.locator('[data-post-entry-quantity]').all())await input.fill('5');
      await recorded(page,'correction:missing-reason',trial,{selector:'[data-post-entry-form][data-mode="correct"]',contains:'请填写订正原因',readback:{collection:'processCompletions',where:{postTaskId:target.taskId},min:5,max:5}},()=>page.locator(detailAction('save-entry')).click());
      if(await page.locator('[data-post-entry-quantity]').first().inputValue()!=='5')throw new Error('Correction failure discarded input.');
      await page.locator('[data-post-entry-reason]').fill('D10主管核对：该次每SKU实际5件，原10件误录。');
      await recorded(page,'correction:save',trial,{gone:'[data-post-entry-form]',contains:'本次订正已保存',readback:{collection:'processCompletions',where:{postTaskId:target.taskId,correctionOf:target.correctionRecordId},quantities:target.skus.map(sku=>({skuId:sku.skuId,quantity:-5})),requiredRecords:[{recordId:target.correctionRecordId,quantities:target.skus.map(sku=>({skuId:sku.skuId,quantity:10}))}]}},()=>page.locator(detailAction('save-entry')).click());
      const unchanged={collection:'processCompletions',where:{postTaskId:target.taskId},min:6,max:6,secondary:{collection:'recheckOrders',where:{postTaskId:target.taskId},min:1,max:1}};
      await recorded(page,'form:register-open',trial,{selector:'[data-post-entry-form][data-mode="register"]',focus:'[data-post-entry-quantity]',count:{selector:'[data-post-entry-quantity]',expected:5},readback:unchanged},()=>page.locator(detailAction('open-register')+'[data-process-item="开扣眼"]').click());
      await page.locator(detailAction('close-entry')).first().click();await page.locator('[data-post-entry-form]').waitFor({state:'detached'});
      await recorded(page,'form:recheck-open',trial,{selector:'[data-post-entry-form][data-mode="recheck"]',focus:'[data-post-entry-quantity]',count:{selector:'[data-post-entry-quantity]',expected:5},readback:unchanged},()=>page.locator(detailAction('open-recheck')).click());
      for(const input of await page.locator('[data-post-entry-quantity]').all())await input.fill('1');
      await recorded(page,'form:dirty-cancel',trial,{gone:'[data-post-entry-form]',selector:'[data-web-post-task]',readback:unchanged},()=>page.locator(detailAction('close-entry')).first().click());
    }
  }finally{await handle.context.close();}
  // Each legacy save uses a fresh copy of the same declared H400/N600 input.
  for(let trial=1;trial<=trials;trial++){
    handle=await isolated(delta.legacyBackup,undefined,'PF-USER-POST-MGR');page=handle.page;const target=delta.legacyTarget;
    try{
      await page.goto(targetOrigin+prefix+'work-orders/'+encodeURIComponent(target.taskId),{waitUntil:'networkidle'});
      await recorded(page,'legacy:form-open',trial,{selector:'[data-post-entry-form][data-mode="legacy"]',count:{selector:'[data-post-legacy-history]',expected:5},readback:{collection:'postTasks',where:{postTaskId:target.taskId},oldResultTotal:400,secondary:{collection:'processCompletions',where:{postTaskId:target.taskId},min:0,max:0}}},()=>page.locator(detailAction('open-legacy')).click());await page.locator('[data-post-legacy-baseline]').first().waitFor();
      const histories=await page.locator('[data-post-legacy-history]').evaluateAll(inputs=>inputs.map(input=>({value:input.value,readOnly:input.readOnly})));if(histories.length!==5||histories.some(input=>input.value!=='80'||!input.readOnly))throw new Error('Legacy input no longer matches the declared H400 evidence.');
      for(const input of await page.locator('[data-post-legacy-baseline]').all())await input.fill('0');
      await page.locator('[data-post-entry-reason]').fill('固定历史样本核对：原记录H400件（每SKU80），剩余N600件分项尚未加工；核对人非历史加工责任人。');
      await recorded(page,'legacy:carryover-save',trial,{gone:'[data-post-entry-form]',selector:'[data-web-post-task]',contains:'历史承接已保存',readback:{collection:'postTasks',where:{postTaskId:target.taskId},historyTotal:400,oldResultTotal:400,secondary:{collection:'processCompletions',where:{postTaskId:target.taskId},min:0,max:0}}},()=>page.locator(detailAction('save-entry')).click());
      if(await page.locator(detailAction('open-legacy')).count())throw new Error('Legacy carryover gate remained active.');
    }finally{await handle.context.close();}
  }
  handle=await isolated();page=handle.page;
  const rowIds=()=>page.locator('main tbody tr').evaluateAll(rows=>rows.map(row=>row.querySelector('a[data-nav^="/fcs/craft/post-finishing/work-orders/"]')?.getAttribute('data-nav')).filter(Boolean).map(path=>decodeURIComponent(path.split('/work-orders/')[1].split(/[?#]/)[0])));
  const allowed=fixture.manifest.backbone.map(row=>row.taskId),form='form[action="'+prefix+'work-orders"]';
  try{
    for(let trial=1;trial<=trials;trial++){
      await page.goto(targetOrigin+prefix+'work-orders',{waitUntil:'networkidle'});const first=await rowIds();if(first.length!==20)throw new Error('List baseline did not expose 20 real rows.');
      const target=fixture.manifest.backbone[trial-1];await page.locator(form+' input[name="keyword"]').fill(target.taskNo);
      await recorded(page,'list:query',trial,{rowIds:{exact:[target.taskId]},footerContains:'共 1 条，当前 1-1',contains:'1 张',readback:{collection:'processCompletions',min:4000}},()=>page.locator(form+' button').click());
      await recorded(page,'list:reset',trial,{rowIds:{exact:first},footerContains:'共 100 条，当前 1-20',contains:'100 张',readback:{collection:'processCompletions',min:4000}},()=>page.locator(form+' a[data-nav="'+prefix+'work-orders"]').click());
      await recorded(page,'list:next-page',trial,{rowIds:{count:20,noneOf:first,allowed},footerContains:'共 100 条，当前 21-40',contains:'100 张',readback:{collection:'processCompletions',min:4000}},()=>page.locator('[data-post-finishing-work-orders-action="next-page"]').click());
      const second=await rowIds();await page.locator('[data-post-finishing-work-orders-action="next-page"]').click();await page.waitForFunction(({first,second})=>window.pfReady({rowIds:{count:20,noneOf:[...first,...second]},footerContains:'共 100 条，当前 41-60',contains:'100 张'}),{first,second});
      report.paginationEvidence||=[];report.paginationEvidence.push({trial,first,second,third:await rowIds(),footer:await page.locator('main footer').innerText(),total:100});checkpoint();
    }
  }finally{await handle.context.close();}
}

async function startupFamilies(){
  const family='startup:blocked-notice',spec={selector:'[data-post-finishing-entry-storage-failure][data-post-finishing-storage-notice]',title:'后道资料暂时无法读取',contains:'数据库升级被其他标签页阻止'};
  report.coverage.push({family,dataset:'Explicit PCS version-1 upgrade fixture: records/files stores, one common quantity-7 sentinel, held by an actual separate old browser tab. Failure-state case; not a reduced D10 business case.',start:'Cold new-app navigation while the old tab actually retains the version-1 IndexedDB connection.',end:'Readable blocked-upgrade cause, close-old-page instruction, native reload recovery button and completed drawing. No IndexedDB readback while upgrade is intentionally blocked.',cleanup:'Close the old browser tab, use the actual retry button, then independently verify version 2, four stores, unchanged common quantity 7 and zero post-finishing seed rows. Deliberate old-tab hold/user wait and cleanup are outside the notice response sample.'});
  for(let trial=1;trial<=trials;trial++){
    const {context,page}=await isolated(null,{family,spec});
    try{
      const oldTab=await context.newPage();await oldTab.goto(targetOrigin+'/shirt-sample.jpg',{waitUntil:'domcontentloaded'});
      const initial=await oldTab.evaluate(async()=>{
        const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('higood-pcs-records',1);request.onupgradeneeded=()=>{request.result.createObjectStore('records',{keyPath:'id'});request.result.createObjectStore('files',{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
        window.__pfOldUpgradeConnection=db;window.__pfVersionChangeEvents=[];
        db.onversionchange=event=>window.__pfVersionChangeEvents.push({oldVersion:event.oldVersion,newVersion:event.newVersion});
        await new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put({id:'pcs-common/upgrade-sentinel',collection:'pcs-common',value:{quantity:7},version:1});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
        return {version:db.version,stores:[...db.objectStoreNames]};
      });
      if(initial.version!==1||initial.stores.length!==2)throw new Error('Blocked-upgrade fixture did not start at the exact version-1 boundary.');
      await loaded(page,family,trial,()=>page.goto(targetOrigin+prefix+'work-orders',{waitUntil:'domcontentloaded'}));
      const notice=page.locator(spec.selector),text=await notice.innerText();
      if(!text.includes('关闭旧页面后重试')||!await page.locator('[data-pcs-storage-retry]').isVisible())throw new Error('Blocked notice omitted its actual recovery action.');
      const versionChanges=await oldTab.evaluate(()=>window.__pfVersionChangeEvents);
      if(JSON.stringify(versionChanges)!==JSON.stringify([{oldVersion:1,newVersion:2}]))throw new Error('Fixture did not reproduce a real version-1 to version-2 blocked upgrade.');
      if(trial===1)await page.screenshot({path:resolve(output,'startup-blocked-notice.png'),fullPage:false});
      await oldTab.close();await page.evaluate(()=>{window.name='';});
      await page.locator('[data-pcs-storage-retry]').click();
      await page.waitForFunction(()=>window.pfReady({title:'后道加工单',gone:'[data-post-finishing-entry-storage-failure]'}),undefined,{timeout:15000});
      const recovered=await page.evaluate(async namespace=>{
        const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('higood-pcs-records');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
        try{const rows=await new Promise((resolve,reject)=>{const request=db.transaction('records','readonly').objectStore('records').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return {version:db.version,stores:[...db.objectStoreNames],common:rows.find(row=>row.id==='pcs-common/upgrade-sentinel')?.value,postRows:rows.filter(row=>row.id.startsWith(namespace+'/')).length};}finally{db.close();}
      },namespace);
      if(recovered.version!==2||!['records','files','operations','meta'].every(name=>recovered.stores.includes(name))||recovered.common?.quantity!==7||recovered.postRows!==0)throw new Error('Closing the old tab and retrying did not preserve the exact common-record/no-seed boundary: '+JSON.stringify(recovered));
      report.startupRecoveryEvidence||=[];report.startupRecoveryEvidence.push({trial,initial,notice:text,versionChanges,oldTabClosed:true,recovered});checkpoint();
    }finally{await context.close();}
  }
}

function printExpectation(type,id,backup){
  const rows=collection=>backup.records.filter(row=>!row.deleted&&row.collection==='flow/'+collection).map(row=>row.value);
  if(type==='POST_ORDER'||type==='QC_ORDER'||type==='QC_DETAIL'){
    const task=rows(type==='POST_ORDER'?'postTasks':'qcTasks').find(row=>(row.postTaskId||row.qcTaskId)===id);if(!task)throw new Error('Print fixture source was not found: '+id);
    const delivery=rows('deliveries').find(row=>row.deliveryId===task.deliveryId);
    if(task.productionOrderNo!=='PO-QC-202608-001')throw new Error('This fixed print reference only applies to the reviewed first production fixture.');
    return {type,id,documentNo:task.postTaskNo||task.qcTaskNo,productionOrderNo:task.productionOrderNo,factory:delivery?.managedPostFactoryName,processItems:task.processItems||[],lines:task.lines.map(line=>({sku:line.sku,quantity:line.expectedQty})),rechecks:type==='POST_ORDER'?rows('recheckOrders').filter(row=>row.postTaskId===id).map(row=>row.recheckOrderNo):[],outbounds:type==='POST_ORDER'?rows('outboundOrders').filter(row=>row.postTaskId===id).map(row=>row.outboundOrderNo):[],tagPrice:264000,styleNo:'HG-QC-001',materials:[['FLSZ24116-black','/materials/accessory-label.jpg'],['WLID009-fadfad','/materials/accessory-label.jpg'],['FLSZ25111845-black-322','/materials/accessory-button.jpg'],['FLBF2609001-white','/materials/accessory-label.jpg'],['IDSZFL24093-b349','/materials/yarn-stitching.jpg'],['IDSZFL24092-b349','/materials/yarn-stitching.jpg']]};
  }
  const order=rows('outboundOrders').find(row=>row.outboundOrderId===id);if(!order)throw new Error('Print outbound source was not found: '+id);
  const delivery=rows('deliveries').find(row=>row.deliveryId===order.deliveryId);
  return {type,id,documentNo:order.outboundOrderNo,productionOrderNo:order.productionOrderNo,factory:delivery?.managedPostFactoryName,recheckNo:order.recheckOrderNo,qcNo:order.qcTaskNo,lines:order.lines.map(line=>({sku:line.sku,quantity:line.outboundQty,receivedQty:line.receivedQty||0})),tagPrice:264000};
}
async function checkPrintPage(page,family,trial,expected){
  const content=await page.evaluate(expected=>{
    const errors=[],text=document.body.textContent||'',counts={},sequence={},isGeneric=expected.type==='GENERIC_BARCODE',isLabels=isGeneric||expected.type==='OUTBOUND_BARCODE'||expected.type==='OUTBOUND_HANGTAG';
    const assert=(value,message)=>{if(!value)errors.push(message);},imageMatches=(image,url)=>Boolean(image&&(image.currentSrc||image.src)===new URL(url,location.href).href);
    if(isLabels){
      const labels=[...document.querySelectorAll(isGeneric?'.online-sku-barcode':'[data-outbound-unit-label]')];assert(labels.length===expected.lines.reduce((n,line)=>n+line.quantity,0),'Wrong total label count');
      for(const label of labels){const key=isGeneric?label.querySelector('.online-sku-barcode-sku')?.textContent.trim():label.dataset.skuId,line=expected.lines.find(line=>(isGeneric?line.sku.skuCode:line.sku.skuId)===key);if(!line){errors.push('Unknown SKU label '+key);continue;}const sku=line.sku;counts[sku.skuId]=(counts[sku.skuId]||0)+1;const barcode=label.querySelector('[data-real-barcode]')?.getAttribute('data-barcode-value');assert(barcode===sku.barcode,'Frozen barcode mismatch '+sku.skuId);assert((label.textContent||'').includes(sku.skuCode),'Missing SKU code '+sku.skuId);
        if(!isGeneric){const n=counts[sku.skuId],caption=label.children[expected.type==='OUTBOUND_HANGTAG'?4:2]?.textContent||'';assert(caption.trim().endsWith(n+'/'+line.quantity),'Non-contiguous per-SKU sequence '+sku.skuId+' #'+n);sequence[sku.skuId]={first:1,last:n};assert(label.textContent.includes(sku.colorName)&&label.textContent.includes(sku.sizeName),'Missing frozen color/size '+sku.skuId);}
        if(expected.type==='OUTBOUND_HANGTAG'){assert(imageMatches(label.querySelector('img'),sku.imageUrl),'Hangtag image mismatch '+sku.skuId);assert(label.textContent.includes('吊牌价：'+expected.tagPrice),'Hangtag source price mismatch '+sku.skuId);}
      }
      for(const line of expected.lines)assert(counts[line.sku.skuId]===line.quantity,'Per-SKU copies mismatch '+line.sku.skuId);
    }else{
      assert(text.includes(expected.documentNo)&&text.includes(expected.productionOrderNo),'Printed document identity mismatch');if(expected.factory)assert(text.includes(expected.factory),'Printed factory mismatch');
      if(expected.type!=='GENERIC_OUTBOUND')assert([...document.querySelectorAll('[data-real-barcode]')].some(node=>node.getAttribute('data-barcode-value')===expected.documentNo),'Printed business barcode mismatch');
      if(expected.type==='OUTBOUND'||expected.type==='GENERIC_OUTBOUND'){
        if(expected.recheckNo)assert(text.includes(expected.recheckNo),'Printed child recheck mismatch');assert(!document.querySelector('[data-pickup-slip-preview]'),'Wrong pickup-slip wrapper');
        const rows=[...document.querySelectorAll(expected.type==='OUTBOUND'?'[data-print-sheet] table:last-of-type tbody tr':'.post-outbound-print tbody tr')];assert(rows.length===expected.lines.length,'Outbound SKU row count mismatch');
        rows.forEach((row,index)=>{const line=expected.lines[index];if(!line)return;const cells=[...row.children].map(cell=>cell.textContent.trim()),sku=line.sku;assert(cells[3]===sku.skuCode,'Outbound frozen SKU mismatch');assert(Number(cells[expected.type==='OUTBOUND'?7:6])===line.quantity,'Outbound quantity mismatch '+sku.skuId);assert(Number(cells[expected.type==='OUTBOUND'?8:7])===line.receivedQty,'Outbound received quantity mismatch '+sku.skuId);assert(imageMatches(row.querySelector('img'),sku.imageUrl),'Outbound SKU image mismatch '+sku.skuId);});
      }else if(expected.type==='POST_ORDER'){
        const rows=[...document.querySelectorAll('[data-print-sheet] table tbody tr')];assert(rows.length===expected.lines.length,'Parent SKU row count mismatch');rows.forEach((row,index)=>{const line=expected.lines[index];if(!line)return;const cells=[...row.children].map(cell=>cell.textContent.trim());assert(cells[1]===line.sku.skuCode&&cells[3]===line.quantity+' 件'&&cells[4]===line.sku.barcode,'Parent frozen line mismatch '+line.sku.skuId);assert(imageMatches(row.querySelector('img'),line.sku.imageUrl),'Parent image mismatch');});
        for(const no of [...expected.rechecks,...expected.outbounds])assert(text.includes(no),'Parent omitted child '+no);const metadata=[...document.querySelectorAll('dl>div')].map(node=>({label:node.querySelector('dt')?.textContent,value:node.querySelector('dd')?.textContent}));for(const item of expected.processItems)assert(metadata.some(row=>row.label===item+'完成量'&&row.value==='1000 / 1000 件'),'Parent process total mismatch '+item);assert(metadata.some(row=>row.label==='全部后道完成 / 可交复检'&&row.value==='1000 / 0 件'),'Parent total/available mismatch');
      }else if(expected.type==='QC_DETAIL'){
        const rows=[...document.querySelectorAll('.pf-qc-sku-table tbody tr')];assert(rows.length===expected.lines.length,'QC SKU count mismatch');rows.forEach((row,index)=>{const line=expected.lines[index],cells=[...row.children].map(cell=>cell.textContent.trim());assert(cells[0]===line.sku.skuCode&&Number(cells[3])===line.quantity,'Frozen QC inspected qty mismatch');});
      }else if(expected.type==='QC_ORDER'){
        assert(text.includes(expected.styleNo),'QC style source mismatch');assert(imageMatches(document.querySelector('.pf-qc-product-cell img'),expected.lines[0].sku.imageUrl),'QC product source image mismatch');assert(text.includes('吊牌价：'+expected.tagPrice.toFixed(2)),'QC source price mismatch');const materials=[...document.querySelectorAll('.pf-qc-material tbody tr')];assert(materials.length===6&&document.querySelectorAll('.pf-qc-size tbody tr').length===5,'QC material/size row count mismatch');materials.forEach((row,index)=>{const reference=expected.materials[index];assert(reference&&row.children[1]?.textContent===reference[0]&&imageMatches(row.querySelector('img'),reference[1]),'QC material source/image mismatch #'+index);});
      }
    }
    return {valid:errors.length===0,errors:errors.slice(0,30),documentNo:expected.documentNo,sourceId:expected.id,type:expected.type,perSkuCopies:counts,sequence,total:expected.lines.reduce((n,line)=>n+line.quantity,0),fontsReady:document.fonts.status,images:[...document.images].map(image=>({src:image.currentSrc,loaded:image.complete&&image.naturalWidth>0}))};
  },expected);
  const priorViewport=page.viewportSize();await page.emulateMedia({media:'print'});await page.setViewportSize({width:expected.type==='QC_ORDER'||expected.type==='QC_DETAIL'?748:expected.type==='GENERIC_OUTBOUND'?718:794,height:1123});
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode()));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
  const geometry=await page.evaluate(expected=>{
    const mm=96/25.4,errors=[],assert=(value,message)=>{if(!value)errors.push(message);},rect=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};},isLabels=['OUTBOUND_BARCODE','OUTBOUND_HANGTAG','GENERIC_BARCODE'].includes(expected.type),selector=expected.type==='GENERIC_BARCODE'?'.online-sku-barcode':isLabels?'[data-outbound-unit-label]':expected.type==='GENERIC_OUTBOUND'?'.post-outbound-print':expected.type.startsWith('QC_')?'.pf-qc-paper':'[data-print-sheet]',nodes=[...document.querySelectorAll(selector)],groups=new Map;
    for(const node of nodes){const key=expected.type==='GENERIC_BARCODE'?node.querySelector('.online-sku-barcode-sku')?.textContent.trim():node.dataset.skuId||'sheet';const group=groups.get(key)||[];group.push(node);groups.set(key,group);}
    const samples=[...groups].flatMap(([key,group])=>[group[0],...(group.length>1?[group.at(-1)]:[])].map(node=>{
      const box=rect(node),style=getComputedStyle(node),svg=node.querySelector('[data-real-barcode]'),svgBox=svg?rect(svg):null,image=node.querySelector('img'),imageBox=image?rect(image):null;
      if(isLabels){const w=expected.type==='OUTBOUND_HANGTAG'?50:40,h=expected.type==='OUTBOUND_HANGTAG'?90:30;assert(Math.abs(box.width-w*mm)<1&&Math.abs(box.height-h*mm)<1,'Label mm geometry mismatch '+key);if(expected.type!=='OUTBOUND_HANGTAG')assert(svgBox&&Math.abs(svgBox.height-(expected.type==='GENERIC_BARCODE'?7.5:9)*mm)<1,'Barcode stripe height mismatch '+key);if(imageBox&&expected.type==='OUTBOUND_HANGTAG')assert(Math.abs(imageBox.height-30*mm)<1,'Hangtag image height mismatch '+key);assert(style.breakInside==='avoid'||expected.type==='GENERIC_BARCODE','Label internal break policy mismatch '+key);}
      else if(expected.type==='GENERIC_OUTBOUND')assert(Math.abs(box.width-190*mm)<1,'Generic A4 body width mismatch');else if(!expected.type.startsWith('QC_'))assert(Math.abs(box.width-210*mm)<1&&Math.abs(parseFloat(style.paddingLeft)-12*mm)<1,'Specialized A4 width/padding mismatch');
      const children=[...node.children].filter(child=>getComputedStyle(child).display!=='none').map(child=>({tag:child.tagName,box:rect(child),fontSize:getComputedStyle(child).fontSize,lineHeight:getComputedStyle(child).lineHeight}));
      if(isLabels)for(const child of children)assert(child.box.x>=box.x-.75&&child.box.right<=box.right+.75&&child.box.y>=box.y-.75&&child.box.bottom<=box.bottom+.75,'Label content escapes print frame '+key);
      return{key,box,width:style.width,height:style.height,padding:style.padding,fontFamily:style.fontFamily,fontSize:style.fontSize,breakInside:style.breakInside,breakAfter:style.breakAfter,pageBreakAfter:style.pageBreakAfter,svgBox,imageBox,imageFit:image?getComputedStyle(image).objectFit:null,children};
    }));
    if(expected.type==='GENERIC_BARCODE'){assert(samples[0]?.breakAfter==='page','Generic label pagination missing');const last=getComputedStyle(nodes.at(-1));assert(last.breakAfter==='auto','Last generic label forces an extra page');}
    const tables=[...document.querySelectorAll(selector+' table')].map(table=>({box:rect(table),tableLayout:getComputedStyle(table).tableLayout,columns:table.querySelector('thead tr')?.children.length,rows:table.querySelectorAll('tbody tr').length}));
    if(!isLabels&&nodes[0]){const box=rect(nodes[0]);for(const table of tables)assert(table.box.x>=box.x-.75&&table.box.right<=box.right+.75,'Print table exceeds paper body');}
    const pageRules=[];for(const style of document.querySelectorAll('style'))if(style.textContent.includes('@page'))pageRules.push(style.textContent.match(/@page[^}]*}/g));
    return{valid:errors.length===0,errors,media:matchMedia('print').matches?'print':'screen',viewport:{width:innerWidth,height:innerHeight},fontsStatus:document.fonts.status,count:nodes.length,samples,tables,pageRules,qr:[...document.querySelectorAll('[data-real-qr]')].map(node=>({attributes:Object.fromEntries([...node.attributes].map(attr=>[attr.name,attr.value])),box:rect(node),svg:Boolean(node.querySelector('svg'))}))};
  },expected);
  report.printChecks||=[];report.printChecks.push({family,trial,content,geometry,sourceReference:{scope:'First reviewed production fixture only; fixed source metadata, no changed D10 facts',tagPrice:264000,fixturesSha256:sha(readFileSync(resolve('src/data/fcs/post-finishing-production-source-fixtures.ts')))}});
  const sample=report.samples.find(row=>row.family===family&&row.trial===trial);if(sample){sample.printContentValid=content.valid;sample.printGeometryValid=geometry.valid;sample.pass&&=content.valid&&geometry.valid;}
  checkpoint();if(!content.valid||!geometry.valid)throw new Error('Print source/geometry mismatch: '+JSON.stringify({family,content:content.errors,geometry:geometry.errors}));
  if(trial===1)await page.screenshot({path:resolve(output,family.replaceAll(':','-')+'-print-media.png'),fullPage:false});
  await page.emulateMedia({media:'screen'});await page.setViewportSize(priorViewport);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
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
        await checkPrintPage(page,key+':cold',trial,printExpectation(type,id,backup));
        if(!args.includes('--skip-pdf')){
          const begin=await page.evaluate(()=>performance.now());
          await page.pdf({path:resolve(output,key.replaceAll(':','-')+'-'+trial+'.pdf'),format:'A4',printBackground:true,timeout:30000});
          const end=await page.evaluate(()=>performance.now());
          report.samples.push({family:key+':pdf',trial,kind:'pdf-generation',thresholdMs:1000,ms:end-begin,pass:end-begin<=maxMs,url:page.url(),boundary:'Browser monotonic timestamps surround Chromium PDF rendering and local result delivery; no physical printer.'});checkpoint();
          if(stopOnFailure&&end-begin>maxMs){const failure=new Error('Stop after valid failed PDF sample: '+key+' #'+trial+' '+(end-begin).toFixed(1)+'ms.');failure.pfValidFailure=true;throw failure;}
        }
        if(trial===1)await page.screenshot({path:resolve(output,key.replaceAll(':','-')+'.png'),fullPage:false});
      }catch(error){if(error.pfValidFailure||stopOnFailure)throw error;report.samples.push({family:key+':pdf',trial,ms:null,pass:false,error:error.message});checkpoint();}
      finally{await context.close();}
    }
  }  const parent=fixture.manifest.backbone[0];
  if(!calibration&&!args.includes('--skip-extra-print'))for(const [type,id] of [['POST_ORDER',parent.taskId],['QC_ORDER',parent.qcId],['QC_DETAIL',parent.qcId]]){
    const key='print:'+type;
    for(let trial=1;trial<=trials;trial++){
      const spec={readback:{collection:'processCompletions',min:4000},selector:type==='POST_ORDER'?'[data-testid="post-finishing-full-flow-print"]':type==='QC_ORDER'?'[data-testid="post-finishing-qc-master-print"]':'[data-testid="post-finishing-qc-detail-print"]',allImages:true};
      const {context,page}=await isolated(fixture.backup,{family:key+':cold',spec});
      try{await loaded(page,key+':cold',trial,()=>page.goto(targetOrigin+prefix+'print?type='+type+'&id='+encodeURIComponent(id),{waitUntil:'domcontentloaded'}));await checkPrintPage(page,key+':cold',trial,printExpectation(type,id,fixture.backup));}
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
  const backupJson=JSON.stringify(fixture.backup);
  report.fixture={backupJsonSha256:sha(backupJson),backupJsonBytes:Buffer.byteLength(backupJson),backupRecordRows:fixture.backup.records.length,file:fixtureFile,sha256:sha(readFileSync(fixtureFile)),counts:fixture.counts,preparationMs:fixture.preparationMs,sourceMethod:fixture.sourceMethod};
  checkpoint();console.log('D10 prepared: '+JSON.stringify(report.fixture.counts));
  if(args.includes('--prepare-fixture'))report.prepared=true;
  else if(args.includes('--prepare-delta-fixture')){await prepareDeltaFixture();report.prepared=true;}
  else if(args.includes('--snapshot-statistics')){
    const {context,page}=await isolated();try{
      await page.goto(targetOrigin+prefix+'statistics',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.pfReady({title:'后道统计'}),undefined,{timeout:15000});
      report.statisticCards=await page.locator('main article').evaluateAll(cards=>cards.map(card=>({label:card.children[0]?.textContent?.trim(),value:card.children[1]?.textContent?.trim(),description:card.children[2]?.textContent?.trim()})));
      report.statisticScope={mode:'ALL',reason:config.dateBoundary.statisticsScope,dateControls:await page.locator('main input[type="date"],main input[type="datetime-local"]').count()};
      report.snapshotBoundary='Read-only actual DOM card snapshot on D10; no user business action or formal timing sample.';await page.screenshot({path:resolve(output,'statistics-cards.png'),fullPage:true});checkpoint();console.log(JSON.stringify(report.statisticCards));
    }finally{await context.close();}
  }
  else if(args.includes('--diagnose-import-requests')){
    report.diagnosticBoundary='Isolated empty test IndexedDB raw write diagnostics; identical public-generated bytes and rows; not a product restore or acceptance sample.';report.writeDiagnostics=[];
    for(const method of ['put','add','add-promises','add-serial']){
      const {context,page}=await isolated(null);try{const proof=await injectBackup(page,fixture.backup,{method});report.writeDiagnostics.push(proof);checkpoint();console.log('raw '+method+': '+proof.transactionMs.toFixed(1)+'ms');}finally{await context.close();}
    }
  }
  else if(preflight){await routePreflight();}
  else{
    for(const [name,runner] of [['pages',pageFamilies],['actions',actionFamilies],['print',printFamilies],['storage',storageFamilies],['delta',deltaFamilies],['startup',startupFamilies]])if(selected.has(name)){
      try{await runner();}catch(error){report.errors.push({phase:name,error:error.stack||String(error)});checkpoint();if(stopOnFailure)break;}
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
if(!report.passed&&!args.includes('--prepare-fixture')&&!args.includes('--prepare-delta-fixture')&&!calibration&&!preflight)process.exitCode=1;

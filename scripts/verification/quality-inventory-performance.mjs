#!/usr/bin/env node
// 本轮性能依据：用户2026-10-22确认不超过2秒、功能优先；保留原负载及逐样本验证。
/**
 * Inventory QC performance collector, acceptance plan §10.3 (2026-10-22).
 * Only fresh isolated browser contexts and task evidence are written. No remote DB.
 * --help is read-only. --prepare-fixture runs public domain commands in Node, not UI.
 * Formal measurements use fixed production-preview assets; Vite is diagnostic only.
 */
import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpus, platform, release, arch, totalmem } from 'node:os'

const args = process.argv.slice(2)
const option = (name, fallback) => args.find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? fallback
const diagnostic = args.includes('--diagnostic')
const base = option('--base-url', process.env.BASE_URL || '')?.replace(/\/$/, '')
const trials = Number(option('--trials', '5'))
const output = resolve(option('--output', 'output/playwright/quality-management-20261022/inventory-performance'))
const fixturePath = resolve(option('--fixture', `${output}/inventory-fixture.json`))
const distDir = resolve(option('--dist-dir', 'dist'))
const chosen = option('--families', 'pages,actions').split(',').filter(Boolean)
const thresholdMs = Number(option('--limit-ms','2000'))
if(!Number.isFinite(thresholdMs)||thresholdMs<1||thresholdMs>2000)throw Error('The per-sample limit must tighten the approved 2000ms ceiling, never raise it')
const sourceFiles = ['src/data/wls/finished-inventory-quality.ts','src/data/wls/finished-inventory-records.ts','src/data/wls/finished-inventory-quality-seed.ts','src/pages/wls/finished/inventory-quality.ts','src/pages/wls/finished/stock-realtime.ts','src/pages/wls/finished/stock-transfer.ts','src/pages/wls/finished/stock-location.ts','src/pages/wls/finished/stock-flow.ts','src/pages/wls/stock-online/warehouse-stock.ts','src/pages/wls/finished/pre-inbound.ts','src/pages/wls/finished/putaway.ts','src/pages/wls/finished/outbound-orders.ts','src/data/fcs/post-finishing-inventory-bridge.ts','src/data/fcs/post-finishing-full-flow.ts','src/data/fcs/post-finishing-records.ts','src/data/pcs-record-db.ts','src/data/pcs-sku-archive-repository.ts','src/data/wls/seed/shared-seed.ts','src/main.ts','src/router/routes.ts']
const sha = value => createHash('sha256').update(value).digest('hex')
const hashes = () => Object.fromEntries(sourceFiles.map(path => [path, sha(readFileSync(resolve(path)))]))
const plan = {
  scope: 'WLS finished inventory and inventory-QC handoff only; QC inspection UI, sample approval, PDA and print are measured by the coordinator.',
  fixture: { randomSeed: 20261022, normalWarehouses: 10, uniqueSkus: 1000, sourceLocationsPerSku: 4, specialStyleSkus: 24, quantityPerSku: 100,
    specialStyleExclusionPerSku: 5, phases: ['stock','eligibilityChanged','applied','received','qcComplete','shipped','classReceived','completed','difference'],
    imagePolicy: 'Synthetic performance-only SKU identities retain their source reviewed garment/color and image. Generated size labels are explicitly performance specifications, never represented as catalog/user stock. Source mapping is saved per SKU.',
    exclusions: 'One stable orderLine per SKU has order-reserved/picked/pending-outbound projections, 5 each; actual eligibility excludes only 5 once, not 15. All are persisted fixture facts.',
    preparation: 'Node public domain commands create application, actual receipt, real QC rounds/upgrade/completion, three transfers and actual receipts/putaway. Preparing fixture is not an interaction timing sample.',
    portability: 'Current-format rows in native PCS IndexedDB version 4 are preinstalled into a new same-origin context before app assets. Production preview needs no /src imports, test API or cloud endpoint.' },
  pageFamilies: [
    ['realtime','/wls/finished/stock/realtime','stock','即时库存查询 — 成衣'],
    ['location','/wls/finished/stock/location','stock','仓位库存查询'],
    ['flow','/wls/finished/stock/flow','completed','库存流水查询'],
    ['old-transfer-guard','/wls/finished/stock/transfer','stock','移货操作'],
    ['online','/wls/online/warehouse-stock','stock','仓库库存管理'],
    ['application-list','/wls/finished/inventory-quality','qcComplete','成衣库存送检'],
    ['application-preview','PREVIEW','stock','确认整批库存送检'],
    ['application-detail','DETAIL','qcComplete','库存送检流转详情'],
    ['outbound','/wls/finished/outbound-orders','applied','出库单'],
    ['pre-inbound','/wls/finished/pre-inbound','shipped','入库'],
    ['putaway','/wls/finished/putaway','classReceived','入库单列表'],
  ].map(([name,path,phase,title]) => ({name,path,phase,title, modes:['cold','refresh','spa'], requiredSamplesPerMode:5})),
  actionFamilies: ['eligibility-preview','eligibility-preview-after-change','whole-application','whole-post-receipt','normal-ship','defect-ship','rework-ship','normal-receive','defect-receive','rework-receive','normal-putaway','defect-putaway','difference-confirm'],
  equivalence: [
    'Realtime total is the exact union of physical warehouse/SKU keys and existing main linked readonly stock keys; source lot/SKU counts remain independently asserted, reference rows never become inventory-QC lots.',
    'No affected WLS page route is omitted. Each of the eleven page members gets five cold, five refresh and five real SPA-click samples; minimum165 page samples. The old stock-transfer member verifies the necessary migrated-stock writer guard and retains its original UI.',
    'Normal/defect/rework classification are distinct action families because receivers and completion conditions differ. Normal receive/putaway uses all24 SKU and up to96 original allocations; defect/rework retain nonzero real categories.',
    'The eligibility preview and application use the24-SKU style with four source locations per SKU and all three projections of each real fixture order exclusion. Smaller one-SKU paths cannot substitute.',
    'A separate eligibilityChanged fixture adds a new stable orderLine exclusion1 and advances the warehouse/style scope. Real preview must show2279, not the baseline2280. This deliberate source-membership change is prepared outside timing; stale/CAS correctness remains in the business browser contract.',
    'The original outbound/pre-inbound/putaway entries still include their existing static records plus the actual inventory-transfer panel. Their full rendered DOM and required images, not just the new panel heading, must settle.',
    'No cross-route equivalence reduces members. Page title checks are accompanied by exact pathname, a route-specific content selector and a changed content-root identity on SPA navigation.' ],
  endpoint: 'Trusted click/input or navigationStart → app reads/computation → complete native PCS write transaction for saving → narrow native persistent readback confirms business facts → all rendered main images decode → unchanged DOM for two animation frames. Browser controller polling/screenshots are outside the measured interval.',
  perSampleMaxMs: thresholdMs, requiredTrials:5, devices: { pages:{width:1366,height:768}, actions:{width:1024,height:768} },
  command: 'BASE_URL=http://127.0.0.1:<preview-port> node scripts/verification/quality-inventory-performance.mjs --prepare-fixture --run --dist-dir=<fixed-build-dir>',
  diagnosticCommand: 'BASE_URL=http://127.0.0.1:<vite-port> node scripts/verification/quality-inventory-performance.mjs --prepare-fixture --run --diagnostic --trials=1',
}
if (args.includes('--help') || !args.some(value => ['--run','--prepare-fixture'].includes(value))) {
  console.log(JSON.stringify({ prepared:true, executed:false, plan, options:['--base-url=URL or BASE_URL','--fixture=FILE','--prepare-fixture','--run','--dist-dir=DIR','--output=DIR','--diagnostic','--trials=N','--families=pages,actions'] },null,2))
  process.exit(0)
}
if (!Number.isSafeInteger(trials) || trials < 1 || !diagnostic && trials < 5) throw Error('Formal acceptance requires at least5 trials for every family; diagnostic runs never pass formal acceptance.')
if (chosen.some(family => !['pages','actions'].includes(family))) throw Error('Unknown family selection.')
if (!diagnostic && chosen.join(',') !== 'pages,actions') throw Error('Formal acceptance cannot omit pages or actions; use --diagnostic for a selected run.')
mkdirSync(output,{recursive:true})

// Serialized into a child Node process with the repository tsx loader. No browser,
// storage reset, source mutation or test/production server database is used here.
async function generateFixtureInNode() {
  const { pathToFileURL } = await import('node:url')
  const moduleAt = path => import(pathToFileURL(process.cwd() + '/' + path).href)
  const seed = await moduleAt('src/data/wls/finished-inventory-quality-seed.ts')
  const records = await moduleAt('src/data/wls/finished-inventory-records.ts')
  const api = await moduleAt('src/data/wls/finished-inventory-quality.ts')
  const flow = await moduleAt('src/data/fcs/post-finishing-full-flow.ts')
  const quality = await moduleAt('src/data/fcs/quality-management-records.ts')
  const master = await moduleAt('src/data/pcs-sku-archive-repository.ts')
  const shared = await moduleAt('src/data/wls/seed/shared-seed.ts')
  const { QC_SHIPPING_STOCK_SEEDS } = await moduleAt('src/data/fcs/post-finishing-qc-shipping-seeds.ts')
  const linkedStockKeys = QC_SHIPPING_STOCK_SEEDS.map(row=>`${row.warehouseId}|${row.sku}`)
  await quality.ensureQualityManagementRecords()
  const originals = seed.createFinishedInventorySeed(), formal = master.listSkuArchives().filter(row => row.archiveStatus === 'ACTIVE' && row.skuImageUrl?.startsWith('/materials/pcs-reviewed/') && !row.bundleComponents?.length)
  const black = formal.find(row => row.skuId === 'sku_r1_wms_tee_black_s'), white = formal.find(row => row.skuId === 'sku_r1_tee_white_m')
  if (!black || !white || !formal.length) throw Error('Reviewed source SKU/image identities required for performance fixtures are missing.')
  const sourceWarehouse = shared.warehouseSeed.find(row => row.code === seed.FINISHED_INVENTORY_NORMAL_WAREHOUSE.id)
  const actualLocations = sourceWarehouse?.zones?.flatMap(zone => zone.locations.map(location => ({zoneName:zone.name,locationCode:location}))).slice(0,4)
  if (actualLocations?.length !== 4) throw Error('The original warehouse must have four actual source locations; do not invent them or silently lower volume.')
  const state = {lots:[],exclusions:[],applications:[],transfers:[],movements:[],differences:[],scopes:[]}, mapping=[]
  const warehouses = Array.from({length:10},(_,i) => i === 0 ? {id:sourceWarehouse.code,name:sourceWarehouse.name} : {id:`PERF-WH-${String(i+1).padStart(2,'0')}`,name:`隔离性能成衣仓${i+1}`})
  const heavyStyleId='style_r1_wms_tee', heavyStyleNo='SPU-GC-1001', heavySkuIds=[]
  for (let index=0;index<1000;index++) {
    const warehouse=warehouses[Math.floor(index/100)], heavy=index<24
    const source=heavy ? index%2 ? white : black : formal[index%formal.length]
    const skuId=`PERF-INV-SKU-${String(index+1).padStart(4,'0')}`, skuCode=`PERF-INV-${String(index+1).padStart(4,'0')}`
    const styleId=heavy ? heavyStyleId : `PERF-STYLE-${source.styleId}-${Math.floor(index/formal.length)}`
    const styleNo=heavy ? heavyStyleNo : `PERF-${source.styleCode}-${Math.floor(index/formal.length)}`
    const sizeName=heavy ? `性能规格${Math.floor(index/2)+1}` : `${source.sizeName || '均码'}·性能${index+1}`
    const sku={skuId,skuCode,styleId,styleNo,styleName:source.styleName,colorName:source.colorName,sizeName,imageUrl:source.skuImageUrl,barcode:`PERFINV${String(index+1).padStart(6,'0')}`}
    mapping.push({skuId,sourceSkuId:source.skuId,sourceStyleId:source.styleId,colorName:source.colorName,imageUrl:source.skuImageUrl,warehouseId:warehouse.id,performanceOnly:true})
    if (heavy) heavySkuIds.push(skuId)
    for(let location=0;location<4;location++) state.lots.push({...sku,id:`PERF-LOT-${index+1}-${location+1}`,warehouseId:warehouse.id,warehouseName:warehouse.name,
      zoneName:index<100 ? actualLocations[location].zoneName : '性能隔离库区',locationCode:index<100 ? actualLocations[location].locationCode : `PERF-WH${Math.floor(index/100)+1}-L${location+1}`,
      quality:'正常',putaway:true,quantity:25,updatedAt:'2026-10-22T08:00:00+07:00',sourceRef:`PERFORMANCE-ONLY:reviewed:${source.skuId}`,identityVerified:true})
    for(const [stageNumber,stage] of ['订单占用','已拣货','待出库'].entries()) state.exclusions.push({id:`PERF-EX-${index+1}-${stageNumber}`,orderLineId:`PERF-ORDER-LINE-${index+1}`,warehouseId:warehouse.id,skuId,
      quantity:5,stage,active:true,sourceRef:`PERFORMANCE-ONLY:ORDER-${index+1}:same-physical-line`})
  }
  const baselineState=structuredClone(state)
  records.restoreFinishedInventoryState(structuredClone(baselineState))
  api.registerFinishedInventoryQcBridge({receiveIntoQc:flow.createInventoryPostFinishingQcTask})
  flow.registerPostFinishingInventoryQcCompletion(api.completeFinishedInventoryQc)
  const actor={actorId:'PERF-WAREHOUSE',actorName:'隔离性能仓管',roleName:'仓库收货人员'}, qcActor=flow.POST_FINISHING_ACCEPTANCE_ACTORS.qcSupervisor
  const phases={}, namespace='higood-finished-inventory', postNamespace='higood-fcs-post-finishing-records'
  const currentRows = (snapshot,qc) => {
    const rows=[]
    for(const [collection,values] of Object.entries(snapshot)) for(const value of values) rows.push({id:`${namespace}/${collection}/${encodeURIComponent(value.id)}`,collection:`${namespace}/${collection}`,value,version:1})
    // Tombstone only original static inventory IDs in this NEW isolated fixture,
    // never a user's existing database. Avoid a second current-stock seed source.
    for(const [collection,values] of Object.entries(originals)) for(const value of values) if (!snapshot[collection].some(row=>row.id===value.id)) rows.push({id:`${namespace}/${collection}/${encodeURIComponent(value.id)}`,collection:'deleted',value:null,version:1,deleted:true})
    if(qc) rows.push({id:`${postNamespace}/flow/qcTasks/${encodeURIComponent(qc.qcTaskId)}`,collection:'flow/qcTasks',value:qc,version:1})
    return rows
  }
  const capture=(name,application) => {
    const snapshot=records.captureFinishedInventoryState(),qc=application?.qcTaskId ? flow.getPostFinishingFullFlowQcTask(application.qcTaskId) : undefined
    phases[name]={records:currentRows(snapshot,qc),applicationId:application?.id,applicationNo:application?.applicationNo,qcTaskId:application?.qcTaskId,
      transferIds:Object.fromEntries(snapshot.transfers.filter(row=>row.category!=='送后道').map(row=>[row.category,row.id])),
      stats:{realtimeRows:new Set([...snapshot.lots.map(row=>`${row.warehouseId}|${row.skuCode}`),...linkedStockKeys]).size,lots:snapshot.lots.length,uniqueSkus:new Set(snapshot.lots.map(row=>row.skuId)).size,warehouses:new Set(snapshot.lots.map(row=>row.warehouseId)).size,
        positiveSourceLots:snapshot.lots.filter(row=>row.quantity>0).length,exclusionRows:snapshot.exclusions.length,movements:snapshot.movements.length,applications:snapshot.applications.length},
      expectedNormalReceived:application?.qcResults?.reduce((n,row)=>n+row.releasedQty,0)}
  }
  capture('stock')
  // The exact same 1000-SKU physical stock with one additional logical order
  // line is a declared alternative fixture, never a hidden product mutation.
  records.readFinishedInventoryState().exclusions.push({id:'PERF-EX-NEW-MEMBERSHIP',orderLineId:'PERF-NEW-ORDER-LINE',warehouseId:warehouses[0].id,skuId:heavySkuIds[0],quantity:1,stage:'订单占用',active:true,sourceRef:'PERFORMANCE-ONLY:new-logical-order-membership'})
  records.readFinishedInventoryState().scopes.push({id:`${warehouses[0].id}::${heavyStyleId}`,warehouseId:warehouses[0].id,styleId:heavyStyleId,revision:1})
  if(api.previewFinishedInventoryQuality(warehouses[0].id,heavyStyleId).eligibleQty!==2279)throw Error('Changed exclusion membership was not included by the actual eligibility function.')
  capture('eligibilityChanged');phases.eligibilityChanged.expectedEligibleQty=2279
  records.restoreFinishedInventoryState(structuredClone(baselineState))
  let app=api.createFinishedInventoryQualityApplication({preview:api.previewFinishedInventoryQuality(warehouses[0].id,heavyStyleId),operationId:'PERFORMANCE-HEAVY-APPLICATION',actor})
  if(app.lines.length!==24 || app.lines.reduce((n,line)=>n+line.outboundQty,0)!==2280 || app.lines.some(line=>line.allocations.length!==4)) throw Error('24-SKU/four-location/exclusion baseline was reduced.')
  capture('applied',app)
  app=api.receiveFinishedInventoryQualityApplication({applicationId:app.id,quantities:app.lines.map(line=>({skuId:line.skuId,quantity:line.outboundQty})),actor})
  capture('received',app)
  flow.claimPostFinishingQcTask({qcTaskNo:app.qcTaskNo,actor:qcActor})
  const before=flow.getPostFinishingQcInspectionSummary(app.qcTaskId), inspected=new Map();let remaining=before.target
  const first=app.lines.map((line,index)=>{const count=Math.min(remaining,line.receivedQty);remaining-=count;inspected.set(line.skuId,count);return {skuId:line.skuId,passedQty:count-(index===0?5:0),defectQty:index===0?2:0,returnQty:index===0?3:0,issues:index===0?[{itemId:'garment-clean'}]:[]}})
  flow.submitPostFinishingQcRound({qcTaskId:app.qcTaskId,actor:qcActor,operationId:'PERFORMANCE-ROUND1',lines:first})
  flow.upgradePostFinishingQcInspection({qcTaskId:app.qcTaskId,actor:qcActor,nextPercent:100,note:'隔离性能夹具，保留真实稽查升全检及三类去向'})
  flow.submitPostFinishingQcRound({qcTaskId:app.qcTaskId,actor:qcActor,operationId:'PERFORMANCE-ROUND2',lines:app.lines.map(line=>({skuId:line.skuId,passedQty:line.receivedQty-inspected.get(line.skuId),defectQty:0,returnQty:0,issues:[]}))})
  flow.completePostFinishingQcTask({qcTaskId:app.qcTaskId,actor:qcActor,processItems:[]})
  app=api.getFinishedInventoryApplication(app.id);capture('qcComplete',app)
  for(const transfer of api.listFinishedInventoryTransfers(app.id).filter(row=>row.category!=='送后道')) api.shipFinishedInventoryTransfer({transferId:transfer.id,actor})
  capture('shipped',app)
  for(const transfer of api.listFinishedInventoryTransfers(app.id).filter(row=>row.category!=='送后道')) api.receiveFinishedInventoryTransfer({transferId:transfer.id,targetId:transfer.targetId,quantities:transfer.lines.map(line=>({skuId:line.skuId,quantity:line.quantity})),actor})
  capture('classReceived',app)
  for(const transfer of api.listFinishedInventoryTransfers(app.id).filter(row=>row.category!=='送后道'&&row.category!=='返工交接')) api.putawayFinishedInventoryTransfer({transferId:transfer.id,locations:transfer.lines.map(line=>({skuId:line.skuId,locationCode:seed.FINISHED_INVENTORY_LOCATIONS.find(location=>location.warehouseId===transfer.targetId).locationCode})),actor})
  app=api.getFinishedInventoryApplication(app.id);capture('completed',app)
  records.restoreFinishedInventoryState(structuredClone(baselineState))
  let differenceApp=api.createFinishedInventoryQualityApplication({preview:api.previewFinishedInventoryQuality(warehouses[0].id,heavyStyleId),operationId:'PERFORMANCE-DIFFERENCE-APPLICATION',actor})
  differenceApp=api.receiveFinishedInventoryQualityApplication({applicationId:differenceApp.id,quantities:differenceApp.lines.map((line,index)=>({skuId:line.skuId,quantity:line.outboundQty+(index===0?1:0)})),actor})
  capture('difference',differenceApp)
  const difference=records.captureFinishedInventoryState().differences[0]
  return {format:'quality-inventory-performance-fixture-v1',seed:20261022,baseline:{normalWarehouses:10,uniqueSkus:1000,sourceLots:4000,maxSourceLocationsPerSku:4,heavyStyleSkus:24,normalQtyPerSku:100,uniqueOrderExcludedPerSku:5,projectedExclusionRows:3000,heavyEligibleQty:2280},
    heavy:{warehouseId:warehouses[0].id,warehouseName:warehouses[0].name,styleId:heavyStyleId,styleNo:heavyStyleNo,skuIds:heavySkuIds,firstSkuCode:'PERF-INV-0001',differenceId:difference.id,putawayLocation:seed.FINISHED_INVENTORY_LOCATIONS[2].locationCode},
    linkedReadonlyStock:{source:'src/data/fcs/post-finishing-qc-shipping-seeds.ts',keys:linkedStockKeys},mapping,phases}
}
if(args.includes('--prepare-fixture')) {
  const beforePreparationHashes=hashes()
  const expression=`(${generateFixtureInNode.toString()})().then(value=>process.stdout.write(JSON.stringify(value))).catch(error=>{console.error(error);process.exitCode=1})`
  const bytes=execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',expression],{cwd:process.cwd(),maxBuffer:256*1024*1024})
  const generated=JSON.parse(bytes.toString())
  const afterPreparationHashes=hashes();if(JSON.stringify(afterPreparationHashes)!==JSON.stringify(beforePreparationHashes))throw Error('Source changed during fixture preparation. Wait for the fixed-version window and regenerate; old fixture is preserved.')
  generated.sourceHashes=afterPreparationHashes;generated.preparedAt=new Date().toISOString();generated.head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
  mkdirSync(dirname(fixturePath),{recursive:true});writeFileSync(fixturePath,JSON.stringify(generated))
  console.log(JSON.stringify({fixturePrepared:true,path:fixturePath,bytes:bytes.length,baseline:generated.baseline,phases:Object.fromEntries(Object.entries(generated.phases).map(([key,value])=>[key,value.stats]))}))
}
if(!args.includes('--run')) process.exit(0)
if(!base) throw Error('Set BASE_URL or --base-url to the actual fixed target; no hard-coded target port is assumed.')
if(!['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname))throw Error('This fixture collector runs only against an isolated local preview/dev origin, never a production or test-site database.')
if(!existsSync(fixturePath)) throw Error('Prepare the independent native IDB fixture first with --prepare-fixture, or supply --fixture=FILE.')
const fixtureBytes=readFileSync(fixturePath), fixture=JSON.parse(fixtureBytes)
if(!Number.isSafeInteger(fixture.phases.stock.stats.realtimeRows)||!fixture.linkedReadonlyStock?.keys?.length)throw Error('Regenerate fixture with explicit unified realtime count and linked reference source; do not remove the count assertion.')
if(fixture.format!=='quality-inventory-performance-fixture-v1' || fixture.baseline.normalWarehouses<10 || fixture.baseline.uniqueSkus<1000 || fixture.baseline.sourceLots<4000 || fixture.baseline.heavyStyleSkus<24 || fixture.baseline.maxSourceLocationsPerSku!==4 || fixture.phases.eligibilityChanged?.expectedEligibleQty!==2279) throw Error('Fixture does not meet the approved load/membership-change contract; regenerate it instead of silently reducing volume.')
const sourceHashes=hashes()
if(JSON.stringify(fixture.sourceHashes)!==JSON.stringify(sourceHashes)) throw Error('Fixture source fingerprints differ from the current working tree. Regenerate instead of reusing stale business facts.')
const runDir=resolve(output,`${diagnostic?'diagnostic':'formal'}-${new Date().toISOString().replaceAll(':','-')}`);mkdirSync(runDir,{recursive:true})
const report={format:'quality-inventory-performance-report-v1',startedAt:new Date().toISOString(),base,diagnostic,formalAcceptance:false,thresholdMs,trials,selected:chosen,plan,scriptSha256:sha(readFileSync(new URL(import.meta.url))),
  fixture:{path:fixturePath,sha256:sha(fixtureBytes),bytes:fixtureBytes.length,baseline:fixture.baseline,phaseCounts:Object.fromEntries(Object.entries(fixture.phases).map(([key,value])=>[key,value.stats]))},
  head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--short'],{encoding:'utf8'}).trim(),sourceHashes,
  host:{platform:platform(),release:release(),arch:arch(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,ramBytes:totalmem()},assets:[],samples:[],errors:[],completed:false,passed:false}
const allFamilyNames=[...plan.pageFamilies.flatMap(row=>row.modes.map(mode=>`page:${row.name}:${mode}`)),...plan.actionFamilies.map(name=>`action:${name}`)]
const selectedFamilyNames=allFamilyNames.filter(family=>chosen.includes(family.startsWith('page:')?'pages':'actions'))
function checkpoint(){
  report.families=allFamilyNames.map(family=>{const rows=report.samples.filter(row=>row.family===family),times=rows.filter(row=>Number.isFinite(row.ms)).map(row=>row.ms).sort((a,b)=>a-b);return {family,samples:rows.length,valid:rows.filter(row=>row.valid).length,p50:times[Math.ceil(times.length*.5)-1]??null,p95:times[Math.ceil(times.length*.95)-1]??null,max:times.at(-1)??null,passed:rows.length>=trials&&rows.every(row=>row.valid&&row.pass)}})
  writeFileSync(resolve(runDir,'report.json'),JSON.stringify(report,null,2));writeFileSync(resolve(output,'latest.json'),JSON.stringify({runDir,report:resolve(runDir,'report.json'),completed:report.completed,passed:report.passed,formalAcceptance:report.formalAcceptance},null,2))
}
checkpoint()

/** Installed before app code. It never calls a product business mutation. */
function installCollector() {
  const data=window.__qualityInventoryPerf={sequence:0,armed:null,active:null,finished:[],transactions:[],longTasks:[],generation:0,errors:[]}
  const decoded=new WeakSet(),decoding=new WeakSet(),txInfo=new WeakMap();let txSeq=0
  new MutationObserver(()=>data.generation++).observe(document,{subtree:true,childList:true,attributes:true,characterData:true})
  try{new PerformanceObserver(list=>data.longTasks.push(...list.getEntries().map(entry=>({start:entry.startTime,duration:entry.duration})))).observe({type:'longtask',buffered:true})}catch{}
  const nativeTransaction=IDBDatabase.prototype.transaction
  IDBDatabase.prototype.transaction=function(...args){
    const tx=nativeTransaction.apply(this,args),info={id:++txSeq,database:this.name,mode:args[1]||'readonly',start:performance.now(),end:null,status:'active',writeIds:[],token:data.active?.token||null}
    txInfo.set(tx,info);data.transactions.push(info)
    tx.addEventListener('complete',()=>{info.end=performance.now();info.status='complete'})
    tx.addEventListener('abort',()=>{info.end=performance.now();info.status='abort';info.error=tx.error?.name||'abort'})
    return tx
  }
  const nativePut=IDBObjectStore.prototype.put
  IDBObjectStore.prototype.put=function(value,...rest){const info=txInfo.get(this.transaction);if(info&&this.name==='records'&&typeof value?.id==='string')info.writeIds.push(value.id);return nativePut.call(this,value,...rest)}
  const root=()=>document.querySelector('[data-page-content-root="true"]')||document.querySelector('main')
  const imagesReady=()=>{
    const images=[...(root()?.querySelectorAll('img')||[])]
    let ready=true
    for(const image of images){if(!image.complete||!image.naturalWidth){ready=false;continue}if(!decoded.has(image)){ready=false;if(!decoding.has(image)){decoding.add(image);image.decode().then(()=>decoded.add(image)).catch(error=>data.errors.push({kind:'image-decode',url:image.currentSrc,error:String(error)}))}}}
    return ready&&document.fonts?.status!=='loading'
  }
  const requestValue=request=>new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
  async function durableProof(spec){
    if(!spec.persist)return {pass:true,value:null}
    const opening=indexedDB.open('higood-pcs-records'),db=await requestValue(opening)
    try{
      const tx=db.transaction('records','readonly'),done=new Promise((resolve,reject)=>{tx.addEventListener('complete',resolve);tx.addEventListener('abort',()=>reject(tx.error))}),store=tx.objectStore('records')
      const ns='higood-finished-inventory',appId=spec.applicationId||new URLSearchParams(location.search).get('id')||document.querySelector('[data-fiq-form="receive"]')?.dataset.applicationId
      if(!appId){await done;return {pass:false,value:{why:'application-id-not-in-result'}}}
      const appRow=await requestValue(store.get(`${ns}/applications/${encodeURIComponent(appId)}`)),app=appRow?.value
      if(!app){await done;return {pass:false,value:{why:'application-not-persisted',appId}}}
      const transferId=spec.transferId||app.outboundId,transferRow=await requestValue(store.get(`${ns}/transfers/${encodeURIComponent(transferId)}`)),transfer=transferRow?.value
      let qc,lotRows=[],difference
      if(spec.persist==='receive'&&app.qcTaskId)qc=(await requestValue(store.get(`higood-fcs-post-finishing-records/flow/qcTasks/${encodeURIComponent(app.qcTaskId)}`)))?.value
      if(spec.persist==='apply')lotRows=await Promise.all(app.lines.flatMap(line=>line.allocations.map(item=>requestValue(store.get(`${ns}/lots/${encodeURIComponent(item.lotId)}`)))))
      if(['receive-transfer','putaway'].includes(spec.persist))lotRows=await Promise.all((transfer?.lines||[]).filter(line=>line.receivedQty>0).map(line=>requestValue(store.get(`${ns}/lots/${encodeURIComponent(`${transfer.id}::${line.skuId}`)}`))))
      if(spec.persist==='difference')difference=(await requestValue(store.get(`${ns}/differences/${encodeURIComponent(spec.differenceId)}`)))?.value
      await done
      const total=(lines,key)=>lines.reduce((n,line)=>n+(line[key]||0),0)
      let pass=false
      if(spec.persist==='apply')pass=app.styleId===spec.styleId&&app.warehouseId===spec.warehouseId&&app.lines.length===24&&total(app.lines,'outboundQty')===2280&&!!transfer?.shippedAt&&!transfer?.receivedAt&&lotRows.length===96&&lotRows.reduce((n,row)=>n+(row?.value?.quantity||0),0)===120
      if(spec.persist==='receive')pass=!!app.receivedAt&&!!app.qcTaskId&&total(app.lines,'receivedQty')===2280&&qc?.sourceKind==='WAREHOUSE_STOCK'&&total(qc.lines,'expectedQty')===2280&&qc.lines.length===24&&qc.lines.every(line=>app.lines.some(source=>source.skuId===line.sku.skuId&&source.receivedQty===line.expectedQty))
      if(spec.persist==='ship')pass=!!transfer?.shippedAt&&!transfer.receivedAt&&total(transfer.lines,'quantity')===spec.expectedTransferQty&&transfer.category===spec.category&&transfer.targetId===spec.targetId
      const actualLines=(transfer?.lines||[]).filter(line=>line.receivedQty>0)
      const correctReceivedLot=(row,index)=>row?.value?.quantity===actualLines[index]?.receivedQty&&row.value.warehouseId===transfer.targetId&&row.value.skuId===actualLines[index].skuId&&row.value.quality===(transfer.category==='瑕疵入仓'?'瑕疵':'正常')
      if(spec.persist==='receive-transfer')pass=!!transfer?.receivedAt&&total(transfer.lines,'receivedQty')===spec.expectedTransferQty&&transfer.category===spec.category&&transfer.targetId===spec.targetId&&(transfer.category==='返工交接'?lotRows.every(row=>!row):lotRows.length===actualLines.length&&lotRows.every((row,index)=>correctReceivedLot(row,index)&&row.value.putaway===false))
      if(spec.persist==='putaway')pass=!!transfer?.putawayAt&&total(transfer.lines,'receivedQty')===spec.expectedTransferQty&&transfer.category===spec.category&&transfer.targetId===spec.targetId&&lotRows.length===actualLines.length&&lotRows.every((row,index)=>correctReceivedLot(row,index)&&row.value.putaway===true&&row.value.locationCode!=='待上架')
      if(spec.persist==='difference')pass=!!difference?.resolvedAt&&!!difference.reason&&!!difference.disposition&&difference.quantity===1&&total(app.lines,'receivedQty')===2281&&total(app.lines,'outboundQty')===2280
      return {pass,value:{app:{id:app.id,skuCount:app.lines.length,outboundQty:total(app.lines,'outboundQty'),receivedQty:total(app.lines,'receivedQty'),receivedAt:app.receivedAt,qcTaskId:app.qcTaskId,qcCompletedAt:app.qcCompletedAt,completedAt:app.completedAt},
        transfer:transfer?{id:transfer.id,category:transfer.category,skuCount:transfer.lines.length,quantity:total(transfer.lines,'quantity'),receivedQty:total(transfer.lines,'receivedQty'),shippedAt:transfer.shippedAt,receivedAt:transfer.receivedAt,putawayAt:transfer.putawayAt}:null,
        qc:qc?{id:qc.qcTaskId,sourceKind:qc.sourceKind,quantity:total(qc.lines,'expectedQty')}:null,lotCount:lotRows.filter(Boolean).length,lots:lotRows.filter(Boolean).map(row=>({id:row.id,skuId:row.value.skuId,quantity:row.value.quantity,quality:row.value.quality,warehouseId:row.value.warehouseId,locationCode:row.value.locationCode,putaway:row.value.putaway})),difference}}
    }finally{db.close()}
  }
  function domReady(spec){
    if(location.pathname!==spec.pathname||spec.search&&!location.search.includes(spec.search))return false
    const content=root();if(!content||spec.previousRoot&&spec.previousRoot===content.firstElementChild)return false
    if(spec.title&&![...content.querySelectorAll('h1,h2')].some(node=>node.textContent.includes(spec.title)))return false
    if(spec.selector&&!document.querySelector(spec.selector))return false
    if(spec.absentSelector&&document.querySelector(spec.absentSelector))return false
    if(spec.text&&!content.textContent.includes(spec.text))return false
    if(spec.compactText&&!content.textContent.replace(/\s/g,'').includes(spec.compactText))return false
    if(spec.minSkuRows&&content.querySelectorAll(spec.skuSelector||'[data-fiq-form="receive"] input[name="quantity"]').length<spec.minSkuRows)return false
    return imagesReady()
  }
  function begin(family,spec,start,event){
    const token=++data.sequence;data.active={family,spec,start,event,token};let checking=false
    const check=async()=>{
      if(data.active?.token!==token||checking)return
      if(!domReady(spec))return requestAnimationFrame(check)
      const writes=data.transactions.filter(tx=>tx.token===token&&tx.database==='higood-pcs-records'&&tx.mode==='readwrite')
      if(writes.some(tx=>tx.status==='active'))return requestAnimationFrame(check)
      if(spec.persist&&(!writes.length||writes.some(tx=>tx.status!=='complete')))return requestAnimationFrame(check)
      if(spec.commonTransactionPrefixes&&!writes.some(tx=>spec.commonTransactionPrefixes.every(prefix=>tx.writeIds.some(id=>id.startsWith(prefix)))))return requestAnimationFrame(check)
      checking=true
      try{
        const proof=await durableProof(spec)
        if(!proof.pass){checking=false;return requestAnimationFrame(check)}
        const generation=data.generation
        requestAnimationFrame(()=>requestAnimationFrame(()=>{
          if(data.active?.token!==token)return
          if(data.generation!==generation||!domReady(spec)){checking=false;return requestAnimationFrame(check)}
          const end=performance.now();data.finished.push({family,token,event,start,end,ms:end-start,proof:proof.value,
            transactions:writes.map(tx=>({...tx})),images:[...(root()?.querySelectorAll('img')||[])].map(image=>({src:image.currentSrc,complete:image.complete,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,decoded:decoded.has(image)})),
            longTasks:data.longTasks.filter(entry=>entry.start>=start&&entry.start<=end),collectorErrors:[...data.errors],domGeneration:generation,
            layout:{viewportWidth:innerWidth,viewportHeight:innerHeight,documentScrollWidth:document.documentElement.scrollWidth,mainScrollWidth:root()?.scrollWidth}});data.active=null
        }))
      }catch(error){data.errors.push({kind:'readback',message:String(error)});checking=false;requestAnimationFrame(check)}
    }
    requestAnimationFrame(check);return token
  }
  data.arm=(family,spec,selector,eventType='click')=>{data.armed={family,spec,selector,eventType};return data.sequence+1}
  for(const type of ['click','input'])window.addEventListener(type,event=>{const armed=data.armed;if(!armed||armed.eventType!==event.type||armed.selector&&!event.target.closest(armed.selector))return;data.armed=null;begin(armed.family,armed.spec,performance.now(),{type:event.type,isTrusted:event.isTrusted,selector:armed.selector})},true)
  data.prepareSpa=(family,spec,selector)=>data.arm(family,{...spec,previousRoot:root()?.firstElementChild},selector)
  window.addEventListener('DOMContentLoaded',()=>{try{const load=JSON.parse(window.name||'{}').inventoryPerfLoad;if(load&&location.pathname!=='/__quality_inventory_perf_origin__')begin(load.family,load.spec,0,{type:'navigation',navigationType:performance.getEntriesByType('navigation')[0]?.type})}catch(error){data.errors.push({kind:'navigation-spec',message:String(error)})}},{once:true})
}
const browser=await chromium.launch({headless:true});report.browser=browser.version()
const runtimeAssetChecks=[],seenRuntimeAssets=new Set()
function pageSpec(route,phase){
  const path=route.path==='PREVIEW'?`/wls/finished/inventory-quality?warehouseId=${encodeURIComponent(fixture.heavy.warehouseId)}&styleId=${encodeURIComponent(fixture.heavy.styleId)}`:route.path==='DETAIL'?`/wls/finished/inventory-quality?id=${encodeURIComponent(phase.applicationId)}`:route.path
  const parsed=new URL(path,base),selectors={realtime:'[data-wls-stock-realtime-root]',location:'[data-wls-finished-stock-location-root]',flow:'[data-wls-stock-flow-root]',online:'[data-wls-online-warehouse-stock-root]','application-list':'[data-fiq-workspace]','application-preview':'[data-fiq-form="apply"]','application-detail':'[data-fiq-workspace]',outbound:'[data-outbound-content]','pre-inbound':'[data-fiq-tasks-panel="inbound"]',putaway:'[data-fiq-tasks-panel="putaway"]','old-transfer-guard':'[data-wls-stock-transfer-root]'}
  const expectedTotals={realtime:phase.stats.realtimeRows,location:phase.stats.lots,online:phase.stats.lots,flow:phase.stats.movements,'application-list':phase.stats.applications}
  const spec={path,pathname:parsed.pathname,search:parsed.search,title:route.title,selector:selectors[route.name]}
  if(expectedTotals[route.name]!==undefined)spec.compactText=`${expectedTotals[route.name]}条`
  if(['application-preview','application-detail'].includes(route.name)){spec.minSkuRows=24;spec.skuSelector='[data-fiq-workspace] tbody tr'}
  if(route.name==='pre-inbound'){spec.minSkuRows=26;spec.skuSelector='[data-fiq-tasks-panel="inbound"] input[name="quantity"]'}
  if(route.name==='putaway'){spec.minSkuRows=25;spec.skuSelector='[data-fiq-tasks-panel="putaway"] select[name="location"]'}
  if(route.name==='outbound')spec.text=phase.applicationNo
  return spec
}
async function contextWithPhase(phaseName,viewport){
  const phase=fixture.phases[phaseName],context=await browser.newContext({viewport,timezoneId:'Asia/Jakarta'})
  await context.addInitScript(installCollector)
  await context.route(`${base}/__quality_inventory_perf_origin__`,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Isolated inventory fixture origin</title>'}))
  const page=await context.newPage();page.setDefaultTimeout(15000)
  page.on('pageerror',error=>report.errors.push({kind:'pageerror',message:error.message,phaseName}))
  page.on('response',response=>{
    const url=new URL(response.url());if(report.targetType!=='production-assets'||url.origin!==new URL(base).origin||! /\.(?:js|css)$/.test(url.pathname)||seenRuntimeAssets.has(url.href))return
    seenRuntimeAssets.add(url.href)
    runtimeAssetChecks.push((async()=>{try{const bytes=await response.body(),file=resolve(distDir,url.pathname.replace(/^\//,'')),actualHash=sha(bytes),asset={url:url.href,status:response.status(),sha256:actualHash,bytes:bytes.length,matchesLocal:existsSync(file)&&sha(readFileSync(file))===actualHash,runtime:true};report.assets.push(asset);if(!asset.matchesLocal||asset.status!==200)report.errors.push({kind:'runtime-asset-mismatch',asset})}catch(error){report.errors.push({kind:'runtime-asset-read',url:url.href,message:String(error)})}})())
  })
  await page.goto(`${base}/__quality_inventory_perf_origin__`)
  await page.evaluate(async rows=>{
    const request=indexedDB.open('higood-pcs-records',4)
    request.onupgradeneeded=()=>{for(const name of ['records','files','operations','meta'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,{keyPath:'id'});const records=request.transaction.objectStore('records');if(!records.indexNames.contains('lookup:qualityHeader'))records.createIndex('lookup:qualityHeader',['collection','value.status','value.qcTaskNo','value.productionOrderId','value.productionOrderNo']);const store=request.transaction.objectStore('operations');if(!store.indexNames.contains('createdAt'))store.createIndex('createdAt','createdAt')}
    const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
    try{const tx=db.transaction(['records','files','operations','meta'],'readwrite'),store=tx.objectStore('records'),done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)})
      const count=await new Promise((resolve,reject)=>{const req=store.count();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})
      if(count!==0){tx.abort();throw Error('Fixture installation only accepts a fresh isolated empty context; existing data is never cleared.')}
      for(const row of rows)store.put(row);await done
    }finally{db.close()}
  },phase.records)
  await context.unroute(`${base}/__quality_inventory_perf_origin__`)
  return {context,page,phase}
}
async function collect(page,family,token,extra={}){
  try{
    await page.waitForFunction(({family,token})=>window.__qualityInventoryPerf?.finished.some(row=>row.family===family&&row.token===token),{family,token},{polling:'raf',timeout:20000})
    const sample=await page.evaluate(({family,token})=>window.__qualityInventoryPerf.finished.find(row=>row.family===family&&row.token===token),{family,token})
    const valid=(sample.event.type==='navigation'||sample.event.isTrusted===true)&&!sample.collectorErrors?.length
    const row={...sample,...extra,valid,pass:valid&&sample.ms<=thresholdMs};report.samples.push(row);checkpoint();return row
  }catch(error){const diagnostics=await page.evaluate(()=>({pending:window.__qualityInventoryPerf?.active,transactions:window.__qualityInventoryPerf?.transactions,collectorErrors:window.__qualityInventoryPerf?.errors,headings:[...document.querySelectorAll('h1,h2')].map(node=>node.textContent),images:[...document.querySelectorAll('main img')].map(image=>({src:image.currentSrc,complete:image.complete,naturalWidth:image.naturalWidth})),url:location.href})).catch(()=>null)
    report.samples.push({family,token,...extra,valid:false,pass:false,ms:null,error:String(error),diagnostics});report.errors.push({family,error:String(error)});checkpoint();throw error}
}
async function load(page,family,spec,refresh=false,extra={}){
  await page.evaluate(({family,spec})=>{window.name=JSON.stringify({inventoryPerfLoad:{family,spec}})},{family,spec})
  if(refresh)await page.reload({waitUntil:'domcontentloaded'});else await page.goto(base+spec.path,{waitUntil:'domcontentloaded'})
  return collect(page,family,1,extra)
}
async function clickSample(page,family,selector,spec,extra={}){
  const token=await page.evaluate(({family,selector,spec})=>window.__qualityInventoryPerf.arm(family,spec,selector),{family,selector,spec})
  await page.locator(selector).first().click();return collect(page,family,token,extra)
}
async function preparedPage(phaseName,path,selector){
  const current=await contextWithPhase(phaseName,plan.devices.actions)
  await load(current.page,'preparation:page',{path,pathname:new URL(path,base).pathname,selector},false,{preparation:true})
  // Preparation rows are explicitly removed from acceptance family counts, while
  // their diagnostics are retained separately rather than silently timed away.
  report.preparationSamples??=[];report.preparationSamples.push(report.samples.pop());checkpoint();return current
}
try{
  const response=await fetch(base,{cache:'no-store'});if(!response.ok)throw Error(`Target HTML unavailable: ${response.status}`)
  const html=await response.text();report.targetType=html.includes('/@vite/client')?'vite-development':'production-assets';report.indexSha256=sha(Buffer.from(html))
  if(report.targetType==='vite-development'&&!diagnostic)throw Error('Vite/HMR is diagnostic only; formal acceptance requires a fixed production preview build.')
  if(report.targetType==='production-assets'){
    const indexPath=resolve(distDir,'index.html');if(!existsSync(indexPath)||sha(readFileSync(indexPath))!==report.indexSha256)throw Error('Served production index differs from --dist-dir; bind the actual fixed asset version first.')
    for(const match of html.matchAll(/(?:src|href)="([^"#?]+\.(?:js|css))(?:\?[^\"]*)?"/g)){
      const url=new URL(match[1],base),assetResponse=await fetch(url),bytes=Buffer.from(await assetResponse.arrayBuffer()),file=resolve(distDir,url.pathname.replace(/^\//,'')),actualHash=sha(bytes)
      const item={url:url.href,status:assetResponse.status,bytes:bytes.length,sha256:actualHash,matchesLocal:existsSync(file)&&sha(readFileSync(file))===actualHash};report.assets.push(item);if(!item.matchesLocal||!assetResponse.ok)throw Error('Served JS/CSS does not match the fixed local build: '+url.href)
    }
  }
  checkpoint()
  if(chosen.includes('pages'))for(const route of plan.pageFamilies)for(let trial=1;trial<=trials;trial++){
    const current=await contextWithPhase(route.phase,plan.devices.pages),{page,context,phase}=current,spec=pageSpec(route,phase)
    try{
      await load(page,`page:${route.name}:cold`,spec,false,{trial,phase:route.phase,device:plan.devices.pages})
      await load(page,`page:${route.name}:refresh`,spec,true,{trial,phase:route.phase,device:plan.devices.pages})
      const hub=route.name==='application-list'?'/wls/finished/stock/realtime':'/wls/finished/inventory-quality'
      await load(page,'preparation:spa-hub',{path:hub,pathname:hub,selector:hub.endsWith('inventory-quality')?'[data-fiq-workspace]':'[data-wls-stock-realtime-root]'},false,{preparation:true})
      report.preparationSamples??=[];report.preparationSamples.push(report.samples.pop())
      let selector=`[data-nav="${spec.path}"], [data-tab-href="${spec.path}"]`
      if(route.name==='application-preview'){
        await load(page,'preparation:preview-origin',{path:'/wls/finished/stock/realtime',pathname:'/wls/finished/stock/realtime',selector:'[data-wls-stock-realtime-root]'},false,{preparation:true});report.preparationSamples.push(report.samples.pop())
      }
      const parentKey=route.name==='old-transfer-guard'?'wls-stock-move':route.name==='outbound'?'wls-garment-outbound':['pre-inbound','putaway'].includes(route.name)?'wls-garment-inbound':'wls-garment-stock-query'
      if(!await page.locator(`:is(${selector}):visible`).count())await page.locator(`[data-action="toggle-menu-item"][data-item-key="${parentKey}"]`).click()
      const link=page.locator(`:is(${selector}):visible`).first();await link.scrollIntoViewIfNeeded()
      const token=await page.evaluate(({family,spec,selector})=>window.__qualityInventoryPerf.prepareSpa(family,spec,selector),{family:`page:${route.name}:spa`,spec,selector})
      await link.click();await collect(page,`page:${route.name}:spa`,token,{trial,phase:route.phase,device:plan.devices.pages})
    }finally{await context.close()}
  }
  if(chosen.includes('actions'))for(const name of plan.actionFamilies)for(let trial=1;trial<=trials;trial++){
    const category=name.startsWith('normal-')?'正常返仓':name.startsWith('defect-')?'瑕疵入仓':name.startsWith('rework-')?'返工交接':null
    const phaseName=name==='eligibility-preview-after-change'?'eligibilityChanged':name==='eligibility-preview'||name==='whole-application'?'stock':name==='whole-post-receipt'?'applied':name.endsWith('-ship')?'qcComplete':name.endsWith('-receive')?'shipped':name.endsWith('-putaway')?'classReceived':'difference'
    const phase=fixture.phases[phaseName],detail=`/wls/finished/inventory-quality?id=${encodeURIComponent(phase.applicationId||'')}`,preview=pageSpec(plan.pageFamilies.find(row=>row.name==='application-preview'),phase).path
    const path=name.startsWith('eligibility-preview')?'/wls/finished/stock/realtime':name==='whole-application'?preview:name.endsWith('-receive')?'/wls/finished/pre-inbound':name.endsWith('-putaway')?'/wls/finished/putaway':detail
    const entrySelector=path.includes('stock/realtime')?'[data-wls-stock-realtime-root]':path.endsWith('/pre-inbound')?'[data-fiq-tasks-panel="inbound"]':path.endsWith('/putaway')?'[data-fiq-tasks-panel="putaway"]':'[data-fiq-workspace]'
    const {context,page}=await preparedPage(phaseName,path,entrySelector)
    try{
      const family=`action:${name}`,transferId=category?phase.transferIds[category]:undefined,baseSpec={pathname:new URL(path,base).pathname,applicationId:phase.applicationId,transferId,styleId:fixture.heavy.styleId,warehouseId:fixture.heavy.warehouseId}
      if(transferId){const transfer=phase.records.find(row=>row.value?.id===transferId)?.value;if(!transfer)throw Error('Required nonzero category fixture missing: '+category);Object.assign(baseSpec,{expectedTransferQty:transfer.lines.reduce((n,line)=>n+line.quantity,0),category,targetId:transfer.targetId})}
      let selector,spec
      if(name.startsWith('eligibility-preview')){
        selector=`a[data-nav="${preview}"]`;spec={pathname:'/wls/finished/inventory-quality',selector:'[data-fiq-form="apply"]',title:'确认整批库存送检',text:`${phase.expectedEligibleQty||2280} 件`}
        // At least24 rows with all source allocations must be in the result DOM.
        spec.skuSelector='[data-fiq-workspace] tbody tr';spec.minSkuRows=24
      }else if(name==='whole-application'){
        await page.locator('[data-fiq-form="apply"] input[name="operator"]').fill('隔离性能出库人');selector='[data-fiq-action="apply"]'
        spec={...baseSpec,pathname:'/wls/finished/inventory-quality',selector:'[data-fiq-form="receive"]',persist:'apply',commonTransactionPrefixes:['higood-finished-inventory/applications/','higood-finished-inventory/lots/','higood-finished-inventory/transfers/']}
      }else if(name==='whole-post-receipt'){
        const form=page.locator('[data-fiq-form="receive"]');for(const input of await form.locator('input[name="quantity"]').all())await input.fill('95')
        await form.locator('input[name="operator"]').fill('隔离性能后道接收员');selector='[data-fiq-action="receive"]'
        spec={...baseSpec,selector:'a[href*="qc-workbench?taskNo="]',absentSelector:'[data-fiq-form="receive"]',persist:'receive',commonTransactionPrefixes:['higood-finished-inventory/applications/','higood-fcs-post-finishing-records/flow/qcTasks/']}
      }else if(name.endsWith('-ship')){
        const form=`[data-fiq-form="ship"][data-transfer-id="${transferId}"]`;await page.locator(`${form} input[name="operator"]`).fill('隔离性能交出员');selector=`${form} [data-fiq-action="ship"]`
        spec={...baseSpec,selector:`[data-fiq-form="receive-transfer"][data-transfer-id="${transferId}"]`,absentSelector:form,persist:'ship'}
      }else if(name.endsWith('-receive')){
        const form=`[data-fiq-form="receive-transfer"][data-transfer-id="${transferId}"]`,stored=phase.records.find(row=>row.value?.id===transferId).value
        for(const line of stored.lines)await page.locator(`${form} input[name="quantity"][data-sku-id="${line.skuId}"]`).fill(String(line.quantity))
        await page.locator(`${form} input[name="operator"]`).fill('隔离性能分类接收员');selector=`${form} [data-fiq-action="receive-transfer"]`
        spec={...baseSpec,selector:'[data-fiq-tasks-panel="inbound"]',absentSelector:form,persist:'receive-transfer'}
      }else if(name.endsWith('-putaway')){
        const form=`[data-fiq-form="putaway"][data-transfer-id="${transferId}"]`;for(const select of await page.locator(`${form} select[name="location"]`).all())await select.selectOption({index:1})
        await page.locator(`${form} input[name="operator"]`).fill('隔离性能上架员');selector=`${form} [data-fiq-action="putaway"]`
        spec={...baseSpec,selector:'[data-fiq-tasks-panel="putaway"]',absentSelector:form,persist:'putaway'}
      }else{
        const form=`[data-fiq-form="difference"][data-difference-id="${fixture.heavy.differenceId}"]`;await page.locator(`${form} input[name="reason"]`).fill('隔离性能夹具：实点多1件')
        await page.locator(`${form} input[name="disposition"]`).fill('隔离性能夹具：按实收2281检查，保留原出2280');await page.locator(`${form} input[name="operator"]`).fill('隔离性能差异确认员')
        selector=`${form} [data-fiq-action="difference"]`;spec={...baseSpec,selector:'[data-fiq-workspace]',absentSelector:form,persist:'difference',differenceId:fixture.heavy.differenceId}
      }
      await page.locator(selector).first().scrollIntoViewIfNeeded();await clickSample(page,family,selector,spec,{trial,phase:phaseName,category,device:plan.devices.actions})
    }finally{await context.close()}
  }
  await Promise.allSettled(runtimeAssetChecks)
  report.completed=true;report.finalSourceHashes=hashes();report.sourceUnchanged=JSON.stringify(report.finalSourceHashes)===JSON.stringify(sourceHashes)
  const allSelectedFamiliesComplete=selectedFamilyNames.every(family=>{const rows=report.samples.filter(row=>row.family===family);return rows.length===trials&&new Set(rows.map(row=>row.trial)).size===trials&&rows.every(row=>row.valid&&row.pass)})
  report.passed=report.sourceUnchanged&&report.errors.length===0&&report.samples.length===selectedFamilyNames.length*trials&&allSelectedFamiliesComplete
  report.formalAcceptance=report.passed&&!diagnostic&&report.targetType==='production-assets';checkpoint()
}catch(error){report.errors.push({kind:'run',message:String(error)});checkpoint();process.exitCode=1}
finally{await browser.close()}
if(!report.passed)process.exitCode=1
console.log(JSON.stringify({report:resolve(runDir,'report.json'),samples:report.samples.length,expected:selectedFamilyNames.length*trials,passed:report.passed,formalAcceptance:report.formalAcceptance,failures:report.samples.filter(row=>!row.pass).map(row=>({family:row.family,trial:row.trial,ms:row.ms,error:row.error}))},null,2))

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

// Separate processes reproduce a browser reload: no domain maps survive between stages.
test('MIG-007: early dye/print creation and cancellation survive reload', () => {
  const dir = mkdtempSync(join(tmpdir(), 'early-process-persistence-'))
  const script = `
    import assert from 'node:assert/strict';
    import {readFileSync,writeFileSync,existsSync} from 'node:fs';
    const file=process.env.EARLY_STORAGE_FILE, stage=Number(process.env.EARLY_STAGE);
    const storage=new Map(existsSync(file)?JSON.parse(readFileSync(file,'utf8')):[]);
    globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
    const early=await import('./src/data/fcs/production-demand-early-process-work-orders.ts');
    const dye=await import('./src/data/fcs/dyeing-task-domain.ts');
    const print=await import('./src/data/fcs/printing-task-domain.ts');
    early.ensureProductionDemandEarlyProcessAcceptanceData();
    for(const code of ['DYE','PRINT']) {
      const sku='MIG-PERSIST-'+code;
      if(stage===1){
        const c=early.listEarlyProcessCreateCandidates(code).find(item=>item.eligible);
        early.createProductionDemandEarlyProcessWorkOrder({processCode:code,productionDemandId:c.demand.demandId,professionalTaskId:c.professionalTaskId,inputMaterialSkuCode:sku,outputMaterialSkuCode:sku+'-OUT',materialName:c.defaultMaterialName,materialImageUrl:c.defaultMaterialImageUrl,targetColor:c.defaultTargetColor,estimatedUnitConsumption:1.5,estimatedLossRate:0.1,qtyUnit:c.defaultQtyUnit,factoryId:code==='DYE'?'F090':'FAC-FLOWER',factoryName:code==='DYE'?'全能力测试工厂（F090）':'FLOWER',operatorName:'管理员',operatorRole:'管理员'});
      }
      const rows=code==='DYE'?dye.listDyeWorkOrders():print.listPrintWorkOrders();
      const matches=rows.filter(row=>row.sourceSnapshot?.inputMaterialSkuCode===sku);
      assert.equal(matches.length,1,code+' persisted exactly once');
      const order=matches[0];
      assert.equal(order.sourceSnapshot.matchStatus,stage===3?'CANCELLED':'WAIT_PRODUCTION_ORDER');
      assert.ok(order.plannedQty>0);
      if(stage===2){
        const cancel=code==='DYE'?dye.cancelProductionDemandDyeWorkOrder:print.cancelProductionDemandPrintWorkOrder;
        cancel(code==='DYE'?order.dyeOrderId:order.printOrderId,{operatorName:'管理员',operatorRole:'管理员',reason:'迁移刷新验收',cancelledAt:'2026-09-17 17:00:00'});
      }
    }
    writeFileSync(file,JSON.stringify([...storage]));
  `
  try {
    for (const stage of [1, 2, 3]) {
      const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
        cwd: new URL('../../', import.meta.url), encoding: 'utf8', timeout: 60000,
        env: { ...process.env, EARLY_STORAGE_FILE: join(dir, 'storage.json'), EARLY_STAGE: String(stage) },
      })
      assert.equal(result.status, 0, `reload stage ${stage}: ${result.stderr || result.error || result.stdout}`)
    }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

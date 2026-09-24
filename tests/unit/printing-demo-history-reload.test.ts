import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isKnownPrintingFactoryDemoIdentity, PRINTING_FACTORY_DEMO_CODES } from '../../src/data/fcs/printing-factories.ts'

test('PRINT-HISTORY-001: demo identities remain fixed and reject another factory or task', () => {
  assert.equal(PRINTING_FACTORY_DEMO_CODES['ID-FAC-001165'], '10')
  assert.equal(PRINTING_FACTORY_DEMO_CODES['DYE-GOTO-GLOBAL'], undefined)
  for (const [code, factory] of [['09','DYE-GOTO-GLOBAL'],['09','ID-FAC-001165'],['10','ID-FAC-001165']]) {
    assert.ok(isKnownPrintingFactoryDemoIdentity(`PWO-PRINT-DEMO-${code}-5`, `TASK-PRINT-DEMO-${code}-5`, factory))
  }
  assert.equal(isKnownPrintingFactoryDemoIdentity('PWO-PRINT-DEMO-09-5','TASK-PRINT-DEMO-09-5','FAC-FLOWER'), false)
  assert.equal(isKnownPrintingFactoryDemoIdentity('PWO-PRINT-DEMO-10-5','TASK-PRINT-DEMO-10-4','ID-FAC-001165'), false)
  assert.equal(isKnownPrintingFactoryDemoIdentity('PWO-PRINT-DEMO-99-5','TASK-PRINT-DEMO-99-5','ID-FAC-001165'), false)
})

for (const historicalFactory of ['DYE-GOTO-GLOBAL','ID-FAC-001165']) {
  test(`PRINT-HISTORY-002: ${historicalFactory} historical slot 09 survives independent reloads without overwriting`, () => {
    const dir=mkdtempSync(join(tmpdir(),'printing-history-'))
    const script=`
      import assert from 'node:assert/strict';
      import {readFileSync,writeFileSync,existsSync} from 'node:fs';
      const file=process.env.HISTORY_FILE, stage=Number(process.env.HISTORY_STAGE);
      const storage=new Map(existsSync(file)?JSON.parse(readFileSync(file,'utf8')):[]);
      globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
      const before=storage.get('higood.formal-merged-handout-actions.v1');
      const p=await import('./src/data/fcs/printing-task-domain.ts');
      const orders=p.listPrintWorkOrders();
      if(stage===1){
        assert.equal(orders.some(o=>o.printOrderId.startsWith('PWO-PRINT-DEMO-09-')),false);
        assert.equal(orders.find(o=>o.printOrderId==='PWO-PRINT-DEMO-10-5').plannedQty,190);
        // Simulate both released slot-09 histories using real persisted execution and handover structures.
        for(const [k,v] of storage){
          storage.set(k,v.replaceAll('DEMO-10','DEMO-09').replaceAll('DEMO-260914-10','DEMO-260914-09').replaceAll('TEST-10','TEST-09').replaceAll('RAW-10','RAW-09').replaceAll('IN-10','IN-09').replaceAll('RCV-10','RCV-09').replaceAll('PRINTDEMO10','PRINTDEMO09').replaceAll('ID-FAC-001165',process.env.HISTORY_FACTORY));
        }
      } else {
        const order=orders.find(o=>o.printOrderId==='PWO-PRINT-DEMO-09-5');
        assert.equal(order.printFactoryId,process.env.HISTORY_FACTORY);
        assert.equal(order.businessView.handover.handedOverQty,188);
        const h=await import('./src/data/fcs/pda-handover-events.ts');
        const oldHeads=JSON.parse(before).handoverHeadAdditions;
        const restored=new Map(h.capturePdaHandoverState().handoverHeadAdditions);
        for(const [id,head] of oldHeads)assert.deepEqual(JSON.parse(JSON.stringify(restored.get(id))),head);
        h.persistPdaHandoverState();
        const saved=new Map(JSON.parse(storage.get('higood.formal-merged-handout-actions.v1')).handoverHeadAdditions);
        for(const [id,head] of oldHeads)assert.deepEqual(saved.get(id),head);
        globalThis.window={};
        const key='higood.formal-merged-handout-actions.v1', raw=storage.get(key);
        const changed=JSON.parse(raw);changed.handoverHeadAdditions[0][1].sourceDocNo='STORAGE-CHANGED';
        storage.set(key,JSON.stringify(changed));
        h.readCurrentPreparationHandoverRecord('NOT-A-RECORD');
        h.readCurrentPreparationHandoverRecord('NOT-A-RECORD');
        assert.equal(new Map(h.capturePdaHandoverState().handoverHeadAdditions).get(changed.handoverHeadAdditions[0][0]).sourceDocNo,'STORAGE-CHANGED');
        storage.set(key,raw);h.readCurrentPreparationHandoverRecord('NOT-A-RECORD');
        assert.deepEqual(JSON.parse(JSON.stringify(new Map(h.capturePdaHandoverState().handoverHeadAdditions).get(oldHeads[0][0]))),oldHeads[0][1]);
        delete globalThis.window;

      }
      writeFileSync(file,JSON.stringify([...storage]));
    `
    try {
      for (const stage of [1,2,3]) {
        const run=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',script],{cwd:new URL('../../',import.meta.url),encoding:'utf8',timeout:60000,env:{...process.env,HISTORY_FILE:join(dir,'storage.json'),HISTORY_STAGE:String(stage),HISTORY_FACTORY:historicalFactory}})
        assert.equal(run.status,0,run.stderr||run.stdout)
      }
    } finally {rmSync(dir,{recursive:true,force:true})}
  })
}

import assert from 'node:assert/strict'
import test from 'node:test'
import {processTasks} from '../../src/data/fcs/process-tasks.ts'

test('非 KOL PDA 导入不生成 KOL 领交料；首次 KOL 访问生成完整且幂等的演示记录',async()=>{
 const before=JSON.stringify(processTasks)
 const domain=await import('../../src/data/fcs/kol-goto-pda-domain.ts')
 assert.equal(JSON.stringify(processTasks),before)
 const tasks=domain.listKolGotoTasks()
 const completed=tasks.find(t=>t.productionOrderId==='PO-202603-081')!
 assert.ok(completed)
 assert.equal(completed.status,'DONE')
 assert.equal(domain.getKolGotoHandoutQty(completed.taskId),completed.qty)
 const partial=tasks.find(t=>t.productionOrderId==='PO-202603-0009')!
 assert.equal(domain.getKolGotoHandoutQty(partial.taskId),300)
 const snapshot=JSON.stringify(domain.listKolGotoPickupBatches())
 domain.ensureKolGotoPdaScenarios()
 assert.equal(JSON.stringify(domain.listKolGotoPickupBatches()),snapshot)
 assert.equal(domain.getKolGotoHandoutQty(partial.taskId),300)
})

test('PDA 单任务读取保持普通任务、测试工厂与 KOL 任务内容和查找优先级', async () => {
 const {listPdaGenericProcessTasks,getPdaGenericProcessTaskById}=await import('../../src/data/fcs/pda-task-mock-factory.ts')
 const all=listPdaGenericProcessTasks()
 for(const id of new Set(all.map(task=>task.taskId)))assert.deepEqual(getPdaGenericProcessTaskById(id),all.find(task=>task.taskId===id),id)
 assert.equal(getPdaGenericProcessTaskById('DOES-NOT-EXIST'),undefined)
})

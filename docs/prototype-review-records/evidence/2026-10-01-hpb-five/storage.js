async(page)=>{
 const c=await page.context().browser().newContext(),p=await c.newPage();await p.goto('http://127.0.0.1:43235/fcs/craft/cutting/replacement-fabric-fei-tickets');await p.waitForSelector('[data-hpb-action=detail]');
 const result=await p.evaluate(async()=>{
 const repo=await import('/src/data/fcs/cutting/replacement-fabric-repository.ts'),source=await import('/src/data/fcs/cutting/replacement-fabric-source.ts'),db=await import('/src/data/fcs/cutting/cutting-record-repository.ts');
 const initial=await db.readCuttingRecords();if(initial.records.length)throw Error('Read seeded records');
 const state=await repo.loadReplacementFabricState(),row=source.listReplacementFabricOrderRows().find(x=>x.order.productionOrderId==='PO-202610-9002');const ticket=state.tickets.find(t=>t.productionOrderId===row.order.productionOrderId);
 await repo.saveReplacementFabricPrint([ticket.id],row.scopes,{id:'test-reprint',at:'2026-10-01 10:00:00',operator:'测试'});
 await repo.addReplacementFabricTickets(row.scopes[0],ticket.material.key,1,{id:'test-add',at:'2026-10-01 10:01:00',operator:'测试'});
 const after=await db.readCuttingRecords();const hpb=after.records.filter(r=>r.collection.startsWith('replacement-'));
 if(hpb.some(r=>JSON.stringify(r.value).includes('PO-202610-9001')))throw Error('Unmodified mock persisted');
 const fresh=await repo.loadReplacementFabricState();if(fresh.prints.filter(p=>p.ticketId===ticket.id).length!==3)throw Error('Reprint lost');if(fresh.tickets.filter(t=>t.productionOrderId===row.order.productionOrderId).length!==2)throw Error('Added ticket lost');
 return {initialRecordCount:initial.records.length,changedReplacementRecords:hpb.length,printCount:3,ticketCount:2};
 });await p.reload();await p.waitForSelector('[data-hpb-action=detail]');const row=p.locator('tbody tr').filter({hasText:'PO-202610-9002'});if(!(await row.innerText()).includes('2 张 / 1 张'))throw Error('Reload did not retain mutation');await c.close();return result;
}

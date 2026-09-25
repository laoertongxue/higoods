async(original)=>{
const context=await original.context().browser().newContext(),page=await context.newPage();await page.routeWebSocket('**',()=>{});await page.route('**/source-core',r=>r.fulfill({contentType:'text/html',body:'Sources'}));await page.goto('http://127.0.0.1:43235/source-core');
const result=await page.evaluate(async()=>{
const m=await import('/src/data/fcs/cutting/part-ticket-records.ts'),r=await import('/src/data/fcs/cutting/cutting-record-repository.ts'),K=m.PART_TICKET_KEYS;
const assert=(x,msg)=>{if(!x)throw Error(msg)};
const baseline={markers:[{markerId:'static1',markerNo:'STATIC'}],sessions:[{spreadingSessionId:'static2',status:'DRAFT'}]};
await m.hydratePartTicketRecords();
const next=structuredClone(baseline);next.sessions[0].status='DONE';next.sessions.push({spreadingSessionId:'user1',status:'DRAFT'});
const prepared=m.preparePartTicketMutation(()=>m.stagePartTicketSpreadingStore(next,baseline));assert(m.readPartTicketValue(K.spreading)===null,'preparation does not publish');assert(prepared.change.puts.length===2,'only2changed sessions no static marker');assert((await r.readCuttingRecords()).records.length===0,'preparation does not persist');
const event={id:'cutting-event:test',collection:'cutting-events',value:{eventId:'test'}};
await r.commitCuttingRecords({revision:0,change:{puts:[...prepared.change.puts,event,...m.partTicketInitializationRecords()]},command:{id:'combo',intent:'combo',result:true,at:'now'}});await m.hydratePartTicketRecords();
assert(JSON.parse(m.readPartTicketValue(K.spreading)).sessions.length===2,'published sessions');const snapshot=await r.readCuttingRecords();assert(snapshot.records.some(x=>x.id===event.id),'same transaction event');
Storage.prototype.getItem=()=>{throw Error('disabled')};Storage.prototype.setItem=()=>{throw Error('disabled')};await m.hydratePartTicketRecords();await m.savePartTicketAction({id:'source-again',intent:'source-again',action:()=>m.stagePartTicketSpreadingStore({...next,sessions:next.sessions.map(x=>({...x,status:'CUTTING_DONE'}))},next)});
return {records:snapshot.records.map(x=>({id:x.id,collection:x.collection})),state:JSON.parse(m.readPartTicketValue(K.spreading)),passed:true};
});await context.close();return result;
}

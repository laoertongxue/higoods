async page=>{
 const results=[];
 for(const scene of ['migration','conflict','cleanup-retry','late-writer']){
  const context=await page.context().browser().newContext(),p=await context.newPage();await p.route('**/retired-history',r=>r.fulfill({contentType:'text/html',body:'<html>retired history</html>'}));await p.goto('http://127.0.0.1:43235/retired-history');
  const result=await p.evaluate(async scene=>{
   const history=await import('/src/data/fcs/cutting/retired-cut-piece-pickup-history.ts'),repo=await import('/src/data/fcs/cutting/cutting-record-repository.ts');
   const key='higood:ppic:sewing-pickup-slips:v1',assert=(v,m)=>{if(!v)throw Error(m)},version=(i,kind='CUT_PIECE')=>({versionId:'V'+i,slipId:'S'+i,assignmentId:'ASG',objectKind:kind,lines:[{lineId:'L'+i,objectCode:'SKU',color:'灰',size:'M',part:'前片',sourcePartCode:'FRONT'}]}),quantity=i=>({commandId:'C'+i,versionId:'V'+i,sourceRecordId:'HR'+i,quantities:[{lineId:'L'+i,actualQty:10}]});
   const versions=Array.from({length:101},(_,i)=>version(i)),handoverResults=versions.map((_,i)=>quantity(i));versions.push(version('other','ACCESSORY'));handoverResults.push(quantity('other'));const raw=JSON.stringify({version:1,versions,handoverResults});localStorage.setItem(key,raw);
   if(scene==='conflict'){await repo.commitCuttingRecords({revision:0,change:{puts:[{id:'retired-cut-piece-pickup-versions:V0',collection:'retired-cut-piece-pickup-versions',value:{...version(0),assignmentId:'different'}}]},command:{id:'conflict',intent:'conflict',result:true,at:'now'}})}
   const remove=Storage.prototype.setItem,put=IDBObjectStore.prototype.put;let failure='';
   try{
    if(scene==='cleanup-retry')Storage.prototype.setItem=function(k,v){if(k===key)throw Error('cleanup blocked');return remove.call(this,k,v)};
    await history.migrateRetiredCutPiecePickupHistory({otherPagesClosed:true,progress:()=>{if(scene==='migration')throw Error('interrupt');if(scene==='late-writer')localStorage.setItem(key,raw+' ')}})
   }catch(e){failure=String(e)}finally{Storage.prototype.setItem=remove;IDBObjectStore.prototype.put=put}
   assert(failure,'expected failure');assert(localStorage.getItem(key)?.trim()===raw,'legacy retained');
   if(scene==='conflict')return{scene,failure,unchanged:true};
   const migrated=await history.migrateRetiredCutPiecePickupHistory({otherPagesClosed:true,progress:()=>{}});assert(migrated===202,'202 selected records');const retained=JSON.parse(localStorage.getItem(key));assert(retained.versions.length===1&&retained.versions[0].objectKind==='ACCESSORY'&&retained.handoverResults.length===1,'other module preserved');
   const snapshot=await repo.readCuttingRecords();history.prepareRetiredCutPiecePickupHistory(snapshot.records);assert(history.listRetiredCutPieceHandoverHistory('ASG').reduce((sum,r)=>sum+r.lines[0].pieceQty,0)===1010,'historical real quantities preserved');
   const get=Storage.prototype.getItem;Storage.prototype.getItem=()=>{throw Error('old denied')};try{history.prepareRetiredCutPiecePickupHistory(snapshot.records);assert(history.listRetiredCutPieceHandoverHistory('ASG').length===101,'migrated history no old storage')}finally{Storage.prototype.getItem=get}
   return{scene,failure,migrated,retained:1,quantities:1010};
  },scene);results.push(result);await context.close();
 }
 return{passed:results.length,results};
}

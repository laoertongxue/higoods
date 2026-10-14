import assert from 'node:assert/strict'
import { installPmsMemoryIdb } from '/Users/laoer/.codex/worktrees/7eaf/higoods/tests/helpers/pms-memory-idb.ts'
import {pmsCommitRecords,pmsPutWithVersion,pmsGet,PMS_STORES,pmsAll,pmsGetEntityVersion} from '/Users/laoer/.codex/worktrees/7eaf/higoods/src/data/pms/idb-storage.ts'
const fixture=installPmsMemoryIdb(),mode=process.argv[2]??'constructor'
const observations:unknown[]=[]
try{
 if(mode==='constructor'){
  const seed={supplierCode:'CLOSURE-STALE',supplierName:'initial',_pmsBaseVersion:0}
  await pmsCommitRecords([{store:PMS_STORES.pmsSuppliers,value:seed}],{operationId:'closure-seed'})
  const one=structuredClone(await pmsGet<typeof seed>(PMS_STORES.pmsSuppliers,seed.supplierCode))!,stale=structuredClone(one)
  await pmsGetEntityVersion(PMS_STORES.pmsSuppliers,seed.supplierCode)
  one.supplierName='fresh_saved_A';await pmsPutWithVersion(PMS_STORES.pmsSuppliers,one,'closure')
  stale.supplierName='stale_draft_B'
  await assert.rejects(pmsPutWithVersion(PMS_STORES.pmsSuppliers,stale,'closure'),error=>Boolean(error&&typeof error==='object'&&'code' in error&&error.code==='PMS_IDB_VERSION_CONFLICT'))
  const after=await pmsGet<typeof seed>(PMS_STORES.pmsSuppliers,seed.supplierCode)
  assert.equal(after?.supplierName,'fresh_saved_A');assert.equal(after?._pmsBaseVersion,2);assert.equal(stale._pmsBaseVersion,1)
  observations.push({findingId:'ROOT-FOUNDATION-002',result:'closed',observed:{staleVersion:stale._pmsBaseVersion,staleRejected:true,persisted:after},passed:true})
  const owner={supplierCode:'CLOSURE-FILE-OWNER',supplierName:'files',_pmsBaseVersion:0}
  const A={id:'CLOSURE-A',name:'A.txt',type:'text/plain',size:1,blob:new Blob(['A'],{type:'text/plain'})},B={id:'CLOSURE-B',name:'B.txt',type:'text/plain',size:1,blob:new Blob(['B'],{type:'text/plain'})}
  await assert.rejects(pmsCommitRecords([{store:PMS_STORES.pmsSuppliers,value:owner}],{operationId:'closure-duplicate-owner',attachments:[A,B],attachmentReferences:[{store:PMS_STORES.pmsSuppliers,key:owner.supplierCode,fileIds:[A.id]},{store:PMS_STORES.pmsSuppliers,key:owner.supplierCode,fileIds:[B.id]}]}),error=>Boolean(error&&typeof error==='object'&&'code' in error&&error.code==='PMS_IDB_ATTACHMENT_DUPLICATE_OWNER'))
  const files=await pmsAll<{id:string}>(PMS_STORES.pmsAttachments),refs=await pmsAll<{id:string}>(PMS_STORES.pmsAttachmentReferences),rejectedOwner=await pmsGet(PMS_STORES.pmsSuppliers,owner.supplierCode),receipt=await pmsGet(PMS_STORES.pmsCommittedOperations,'closure-duplicate-owner')
  assert.equal(files.length,0);assert.equal(refs.length,0);assert.equal(rejectedOwner,undefined);assert.equal(receipt,undefined)
  observations.push({findingId:'ROOT-FOUNDATION-003',result:'closed',observed:{duplicateOwnerRejected:true,files:files.length,references:refs.length,ownerAbsent:true,receiptAbsent:true},passed:true})
  const normalOwner={supplierCode:'CLOSURE-BLOB-SIGNATURE',supplierName:'digest',_pmsBaseVersion:0},file={id:'CLOSURE-DIGEST',name:'same.txt',type:'text/plain',size:2,blob:new Blob(['AB'],{type:'text/plain'})}
  const options={operationId:'closure-blob-signature',operationSignature:'same normalized input',attachments:[file],attachmentReferences:[{store:PMS_STORES.pmsSuppliers,key:normalOwner.supplierCode,fileIds:[file.id]}]}
  await pmsCommitRecords([{store:PMS_STORES.pmsSuppliers,value:normalOwner}],options)
  const replay=await pmsCommitRecords([{store:PMS_STORES.pmsSuppliers,value:normalOwner}],options);assert.equal(replay.replayed,true)
  await assert.rejects(pmsCommitRecords([{store:PMS_STORES.pmsSuppliers,value:normalOwner}],{...options,attachments:[{...file,blob:new Blob(['AC'],{type:'text/plain'})}]}),/已保存其他内容/)
  assert.equal(await (await pmsGet<{blob:Blob}>(PMS_STORES.pmsAttachments,file.id))!.blob.text(),'AB')
  observations.push({id:'BLOB-REGRESSION',sameBytesReplay:true,changedSameNameSameSizeBytesRejected:true,originalBytesRetained:'AB',passed:true})
  for(const key of ['', ' ', NaN, Infinity])await assert.rejects(pmsCommitRecords([{store:PMS_STORES.pmsSuppliers,value:{supplierCode:key,_pmsBaseVersion:0}}]),error=>Boolean(error&&typeof error==='object'&&'code' in error&&error.code==='PMS_IDB_KEY_REQUIRED'))
  observations.push({id:'IDENTITY-REGRESSION',emptyWhitespaceNonfiniteKeysRejected:true,passed:true})
 }
 const originalBC=globalThis.BroadcastChannel
 try{
  if(mode==='constructor')globalThis.BroadcastChannel=class{constructor(){throw new DOMException('BroadcastChannel constructor blocked by policy','SecurityError')}} as typeof BroadcastChannel
  else globalThis.BroadcastChannel=class{addEventListener(){}postMessage(){throw new DOMException('BroadcastChannel postMessage unavailable','InvalidStateError')}} as typeof BroadcastChannel
  const row={supplierCode:'CLOSURE-BC-'+mode,supplierName:'success_after_complete',_pmsBaseVersion:0}
  const result=await pmsCommitRecords([{store:PMS_STORES.pmsSuppliers,value:row}],{operationId:'closure-notification-'+mode})
  const persisted=await pmsGet<typeof row>(PMS_STORES.pmsSuppliers,row.supplierCode)
  assert.equal(result.replayed,false);assert.equal(result.values.length,1);assert.equal(persisted?.supplierName,'success_after_complete');assert.equal(persisted?._pmsBaseVersion,1)
  observations.push({findingId:'ROOT-FOUNDATION-001',mode,result:'closed',observed:{resolved:true,replayed:false,persisted},passed:true})
 }finally{globalThis.BroadcastChannel=originalBC}
 console.log(JSON.stringify({environment:'isolated_node_memory_idb',mode,realBrowserStorageWritten:false,productSourceMutation:false,observations},null,2))
}finally{fixture.restore()}

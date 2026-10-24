import type { Page } from '@playwright/test'
import mock from '../../src/data/wls/finished-inventory-quality-mock.json' with {type:'json'}
import { createFinishedInventoryBaseSeed } from '../../src/data/wls/finished-inventory-quality-seed.ts'

/** Existing command contracts start with no stock applications. Tombstone only
 * these new fixed examples in their isolated contexts; the default-Mock suite
 * deliberately does not call this helper and verifies the real initial pages. */
export async function useEmptyInventoryQualityFixture(page:Page, baseURL?:string):Promise<void>{
 const original=page.url(),origin=baseURL||new URL(original).origin
 // Finish the existing configuration's one-off switch before authoring this
 // isolated fixture, so a later center visit cannot remove its tombstones.
 await page.goto(new URL('/fcs/quality-management/basic-standards',origin).href)
 await page.getByRole('heading',{name:'基本质检标准',exact:true}).waitFor({state:'visible'})
 const ids=Object.entries(mock.inventory).flatMap(([collection,rows])=>(rows as Array<{id:string}>).map(row=>`higood-finished-inventory/${collection}/${encodeURIComponent(row.id)}`))
 // Completed default examples now consume base bins. Isolated command tests
 // restore those bins, while removing the examples and their returned lots.
 const baseLots=new Map(createFinishedInventoryBaseSeed().lots.map(row=>[row.id,row]))
 const restoredBins=mock.inventory.lots.filter(row=>baseLots.has(row.id)).map(row=>({id:`higood-finished-inventory/lots/${encodeURIComponent(row.id)}`,collection:'higood-finished-inventory/lots',value:baseLots.get(row.id)!,version:1}))
 for(const [collection,rows,key] of [['qcTasks',mock.post.qcTasks,'qcTaskId'],['postTasks',mock.post.postTasks,'postTaskId'],['processCompletions',mock.post.processCompletions,'recordId'],['logs',mock.post.logs,'logId']] as const)for(const row of rows){
  ids.push(`higood-fcs-post-finishing-records/${collection==='logs'?'logs/records':'flow/'+collection}/${encodeURIComponent((row as any)[key])}`)
 }
 await page.route('**/__inventory-quality-empty-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}))
 await page.goto(new URL('/__inventory-quality-empty-fixture',origin).href)
 await page.evaluate(async ({ids,restoredBins})=>{
  const request=indexedDB.open('higood-pcs-records',4)
  request.onupgradeneeded=()=>{for(const name of ['records','files','operations','meta'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,{keyPath:'id'})}
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
  try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('records','readwrite');for(const id of ids)tx.objectStore('records').put({id,collection:'deleted',value:null,deleted:true,version:1});for(const bin of restoredBins)tx.objectStore('records').put(bin);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error)})}finally{db.close()}
 },{ids,restoredBins})
 if(original!=='about:blank')await page.goto(original)
}

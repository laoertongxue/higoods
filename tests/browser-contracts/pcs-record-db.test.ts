import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { chromium } from '@playwright/test'
import ts from 'typescript'

test('PCS readonly projection: exact prefixes, tombstones, metadata, attachment isolation and failure propagation', async () => {
  const source = await readFile(new URL('../../src/data/pcs-record-db.ts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/storage.js' ? 'text/javascript' : 'text/html')
    res.end(req.url === '/storage.js' ? code : '<!doctype html><title>PCS readonly projection contract</title>')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.addInitScript('globalThis.__name = value => value')
    await page.goto(`http://127.0.0.1:${(server.address() as { port: number }).port}`)
    const result = await page.evaluate(async () => {
      const api = await import('/storage.js')
      await api.commitPcsRecords({ puts: [
        { id: 'qc/a', collection: 'qc', value: { quantity: 80, inspected: 24, snapshot: { items: Array(40).fill({ requirement: '固定标准' }) }, fileId: 'qc-photo' }, expectedVersion: 0 },
        { id: 'qc/b', collection: 'qc', value: { quantity: 81 }, expectedVersion: 0 },
        { id: 'qcx/not-selected', collection: 'unrelated', value: { quantity: 999 }, expectedVersion: 0 },
        { id: 'revision/qc', collection: 'revision', value: 7, expectedVersion: 0 },
      ], deletes: [], files: [{ id: 'qc-photo', blob: new Blob(['real photo bytes'], { type: 'image/png' }) }], operationId: 'fixture-create', intent: 'projection fixture' })
      await api.commitPcsRecords({ puts: [], deletes: [{ id: 'qc/b', expectedVersion: 1 }], operationId: 'fixture-delete', intent: 'retain deletion identity' })
      await api.commitPcsRecords({puts:Array.from({length:2050},(_,index)=>({id:`stream/${String(index).padStart(4,'0')}`,collection:'stream',value:{index,note:'原始中文资料'},expectedVersion:0})),deletes:[],operationId:'fixture-stream',intent:'projection spans multiple bounded native reads'})
      const before = await api.readPcsRecords()
      let writes = 0, attachmentReads = 0
      const originalPut = IDBObjectStore.prototype.put, originalGetAll = IDBObjectStore.prototype.getAll, originalGet = IDBObjectStore.prototype.get
      IDBObjectStore.prototype.put = function (...args) { writes++; return originalPut.apply(this, args) }
      IDBObjectStore.prototype.getAll = function (...args) { if (this.name === 'files') { attachmentReads++; throw Error('unselected attachment scan') }; return originalGetAll.apply(this, args) }
      IDBObjectStore.prototype.get = function (...args) { if (this.name === 'files') { attachmentReads++; throw Error('unselected attachment read') }; return originalGet.apply(this, args) }
      let projected: unknown[], projectionRejected = false, storageRejected = false
      const ranges:number[]=[],guardedGetAll=IDBObjectStore.prototype.getAll
      IDBObjectStore.prototype.getAll=function(...args){if(this.name==='records')ranges.push(args[1] ?? 0);return guardedGetAll.apply(this,args)}
      const streamed=await api.readPcsRecordProjection([{prefix:'stream/'}],row=>({id:row.id,index:row.value.index}))
      const bounded=ranges.length>=3 && ranges.every(count=>count>0 && count<=256)
      ranges.length=0
      const nativeRows=await api.readPcsRecords(['stream'])
      const boundedFullRead=ranges.length>=3 && ranges.every(count=>count>0 && count<=1024)
      if(!boundedFullRead || nativeRows.records.length!==2050)throw Error('Full readonly namespace must retain every row through bounded requests')
      let seen=0,selectionRejected=false
      const selection=await api.readPcsRecords(['stream'],{retain:row=>{seen++;return row.value.index===7},additionalIds:()=>['stream/0007','stream/0500','stream/0500','stream/missing']})
      try{await api.readPcsRecords(['stream'],{retain:()=>{throw Error('invalid scoped source identity')},additionalIds:()=>[]})}catch(error){selectionRejected=/invalid scoped source identity/.test(String(error))}
      if(seen!==2050 || selection.records.length!==2 || selection.records[0].value.index!==7 || selection.records[1].value.index!==500 || !selectionRejected)throw Error('Selection must retain the complete identity scan, exact related rows, deduplication and failure propagation')



      try {
        projected = await api.readPcsRecordProjection([{ id: 'revision/qc' }, { prefix: 'qc/' }, { id: 'missing' }], row => ({ id: row.id, version: row.version, deleted: !!row.deleted, value: row.id.startsWith('revision/') ? row.value : row.value?.quantity }))
        try { await api.readPcsRecordProjection([{ prefix: 'qc/' }], () => { throw Error('invalid persisted quality fact') }) } catch (error) { projectionRejected = /invalid persisted quality fact/.test(String(error)) }
        const realGetAll = IDBObjectStore.prototype.getAll
        IDBObjectStore.prototype.getAll = function (...args) { if (this.name === 'records') throw new DOMException('isolated denied projection read', 'SecurityError'); return realGetAll.apply(this, args) }
        try { await api.readPcsRecordProjection([{ prefix: 'qc/' }], row => row) } catch (error) { storageRejected = /SecurityError|denied projection read/.test(String(error)) }
      } finally { IDBObjectStore.prototype.put = originalPut; IDBObjectStore.prototype.getAll = originalGetAll; IDBObjectStore.prototype.get = originalGet }
      const after = await api.readPcsRecords()
      const detail = await api.readPcsRecordProjection([{ id: 'qc/a' }], row => row.value)
      detail[0].snapshot.items[0].requirement = 'only detached caller changed'
      const reread = await api.readPcsRecordProjection([{ id: 'qc/a' }], row => row.value)
      return { projected, writes, attachmentReads, projectionRejected, storageRejected, bounded, streamed,
        unchanged: JSON.stringify(before.records) === JSON.stringify(after.records), detached: reread[0].snapshot.items[0].requirement,
        originalBytes: await after.files[0].blob.text() }
    })
    assert.deepEqual(result.projected, [
      { id: 'revision/qc', version: 1, deleted: false, value: 7 },
      { id: 'qc/a', version: 1, deleted: false, value: 80 },
      { id: 'qc/b', version: 2, deleted: true, value: undefined },
    ])
    assert.equal(result.bounded,true,'readonly projections must consume bounded native batches, preserving the full result')
    assert.deepEqual(result.streamed,Array.from({length:2050},(_,index)=>({id:`stream/${String(index).padStart(4,'0')}`,index})))
    assert.equal(result.writes, 0); assert.equal(result.attachmentReads, 0)
    assert.equal(result.projectionRejected, true); assert.equal(result.storageRejected, true)
    assert.equal(result.unchanged, true); assert.equal(result.detached, '固定标准')
    assert.equal(result.originalBytes, 'real photo bytes')
  } finally {
    await browser?.close()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})

test('PCS real IndexedDB: atomic writes, versions, retry, attachment references and backup', async () => {
  const source = await readFile(new URL('../../src/data/pcs-record-db.ts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/storage.js' ? 'text/javascript' : 'text/html')
    res.end(req.url === '/storage.js' ? code : '<!doctype html><title>PCS storage test</title>')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.addInitScript('globalThis.__name = (value) => value')
    await page.goto(`http://127.0.0.1:${address.port}`)
    const checks = await page.evaluate(async () => {
      const api = await import('/storage.js')
      const passed: string[] = []
      function check(ok: boolean, label: string) { if (!ok) throw new Error(label); passed.push(label) }
      async function rejected(action: () => Promise<unknown>, text: string) {
        try { await action() } catch (error) { check(String(error).includes(text), text); return }
        throw new Error(`Expected failure: ${text}`)
      }
      const initial = await api.readPcsRecords()
      check(initial.records.length === 0 && initial.files.length === 0, 'fresh read never seeds')
      const create = { puts: [{ id: 'one', collection: 'orders', value: { nested: { fileId: 'file-one' } }, expectedVersion: 0 }], deletes: [], files: [{ id: 'file-one', blob: new Blob(['real file']) }], operationId: 'create', intent: 'create-one' }
      const originalGetAll = IDBObjectStore.prototype.getAll
      IDBObjectStore.prototype.getAll = function (...args) { if (this.name === 'records') throw new Error('ordinary commit must not scan unrelated records'); return originalGetAll.apply(this, args) }
      try { await api.commitPcsRecords(create) } finally { IDBObjectStore.prototype.getAll = originalGetAll }
      check((await api.readPcsFiles(['file-one']))[0].blob.size === 9, 'file preparation reads only requested files')
      await api.commitPcsRecords(create)
      check((await api.readPcsRecords()).records[0].version === 1, 'same intent retry deduplicated')
      await rejected(() => api.commitPcsRecords({ ...create, intent: 'other' }), '操作编号已用于其他操作')
      await rejected(() => api.commitPcsRecords({ puts: [{ id: 'two', collection: 'orders', value: {}, expectedVersion: 0 }, { id: 'one', collection: 'orders', value: {}, expectedVersion: 0 }], deletes: [], operationId: 'conflict', intent: 'conflict' }), '已被其他页面修改')
      check((await api.readPcsRecords()).records.length === 1, 'conflict rolls back other writes')
      await rejected(() => api.commitPcsRecords({ puts: [], deletes: [], deleteFileIds: ['file-one'], operationId: 'file-delete', intent: 'file-delete' }), '仍被记录或历史版本引用')
      check(await api.cleanupUnreferencedPcsFiles() === 0, 'cleanup preserves referenced blob')
      await api.commitPcsRecords({ puts: [], deletes: [{ id: 'one', expectedVersion: 1 }], operationId: 'delete', intent: 'delete' })
      const deleted = (await api.readPcsRecords()).records[0]
      check(deleted.deleted === true && deleted.version === 2, 'delete retains version tombstone')
      await rejected(() => api.commitPcsRecords({ puts: [{ id: 'one', collection: 'orders', value: {}, expectedVersion: 0 }], deletes: [], operationId: 'aba', intent: 'aba' }), '已被其他页面修改')
      check(await api.cleanupUnreferencedPcsFiles() === 1, 'cleanup removes unreferenced blob')
      await rejected(() => api.commitPcsRecords({ puts: [{ id: 'bad', collection: 'orders', value: { fileId: 'missing' }, expectedVersion: 0 }], deletes: [], operationId: 'bad', intent: 'bad' }), '附件引用不完整')
      await api.commitPcsRecords({ puts: [{ id: 'one', collection: 'orders', value: { url: 'pcs-file:file-two' }, expectedVersion: 2 }], deletes: [], files: [{ id: 'file-two', blob: new Blob(['restorable']) }], operationId: 'restore', intent: 'restore' })
      const backup = await api.exportPcsBackup()
      check(backup.version === 1 && await backup.files[0].blob.text() === 'restorable', 'backup includes original file bytes')
      await rejected(() => api.restorePcsBackup(backup), '当前已有本地数据')
      await new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase('higood-pcs-records'); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error) })
      await api.restorePcsBackup(backup)
      const restored = await api.readPcsRecords()
      check(restored.records[0].version === 3 && await restored.files[0].blob.text() === 'restorable', 'backup restores versions and blobs')
      await rejected(() => api.commitPcsRecords({ puts: [{ id: 'base64', collection: 'orders', value: { url: 'data:image/png;base64,ABC' }, expectedVersion: 0 }], deletes: [], operationId: 'base64', intent: 'base64' }), '不能保存 Base64')
      await rejected(() => api.commitPcsRecords({ puts: [{ id: 'array-base64', collection: 'orders', value: { values: ['ordinary text', 'data:image/png;base64,ABC'] }, expectedVersion: 0 }], deletes: [], operationId: 'array-base64', intent: 'array-base64' }), '不能保存 Base64')
      await rejected(() => api.commitPcsRecords({ puts: [{ id: 'array-blob', collection: 'orders', value: { values: [new Blob(['not-json'])] }, expectedVersion: 0 }], deletes: [], operationId: 'array-blob', intent: 'array-blob' }), '业务记录只保留文件引用')
      const arrayRefs = api.pcsFileReferences({ nested: ['unrelated', 'file-two', 'pcs-file:file-two'] }, new Set(['file-two']))
      check(arrayRefs.size === 1 && arrayRefs.has('file-two'), 'array bare known file ID and durable URL retain the original attachment relation')
      const contenders = await Promise.allSettled(['a', 'b'].map(id => api.commitPcsRecords({ puts: [{ id: 'race', collection: 'orders', value: id, expectedVersion: 0 }], deletes: [], operationId: `race-${id}`, intent: id })))
      check(contenders.filter(outcome => outcome.status === 'fulfilled').length === 1, 'concurrent transactions reject lost update')
      const originalPut = IDBObjectStore.prototype.put
      IDBObjectStore.prototype.put = function (...args) { if (this.name === 'records') throw new DOMException('full', 'QuotaExceededError'); return originalPut.apply(this, args) }
      try {
        await rejected(() => api.commitPcsRecords({ puts: [{ id: 'quota', collection: 'orders', value: {}, expectedVersion: 0 }], deletes: [], operationId: 'quota', intent: 'quota' }), '浏览器空间不足')
      } finally { IDBObjectStore.prototype.put = originalPut }
      check(!(await api.readPcsRecords()).records.some(record => record.id === 'quota'), 'quota failure leaves records unchanged')
      const originalOpen = IDBFactory.prototype.open
      IDBFactory.prototype.open = function () { throw new DOMException('denied', 'SecurityError') }
      try { await rejected(() => api.readPcsRecords(), 'SecurityError') } finally { IDBFactory.prototype.open = originalOpen }
      check((await api.readPcsRecords()).records.length === 2, 'open failure can retry with a new connection')
      const newGroup = (name: string, ids: string[]) => ({ puts: ids.map(id => ({ id, collection: 'imports', value: { name }, expectedVersion: 0 })), deletes: [], operationId: `import-${name}`, intent: name })
      const firstGroups = [newGroup('conflict', ['partial-root', 'one']), newGroup('valid', ['group-root', 'group-sku']), { ...newGroup('missing-file', ['file-root', 'file-sku']), puts: [{ id: 'file-root', collection: 'imports', value: {}, expectedVersion: 0 }, { id: 'file-sku', collection: 'imports', value: { fileId: 'missing' }, expectedVersion: 0 }] }]
      const groupResults = await api.commitPcsNewRecordGroups(firstGroups)
      check(!groupResults[0].ok && groupResults[1].ok && !groupResults[2].ok, 'new import group failure does not cancel valid groups')
      const groupRecords = (await api.readPcsRecords()).records
      check(!groupRecords.some(row => ['partial-root', 'file-root', 'file-sku'].includes(row.id)) && groupRecords.some(row => row.id === 'group-sku'), 'late collision and missing attachment roll back the whole affected group')
      const replay = await api.commitPcsNewRecordGroups([firstGroups[1], { ...firstGroups[1], intent: 'changed' }])
      check(replay[0].ok && !replay[1].ok && replay[1].message.includes('其他操作'), 'new group retry deduplicates same intent and rejects changed intent')
      const racing = await Promise.all(['left', 'right'].map(name => api.commitPcsNewRecordGroups([newGroup(name, ['race-root', 'race-sku'])])))
      check(racing.filter(result => result[0].ok).length === 1, 'new group unique-key writes reject cross-tab overwrite atomically')
      const referenceResult = await api.commitPcsNewRecordGroups([{ ...newGroup('valid-ref', ['ref-root']), puts: [{ id: 'ref-root', collection: 'imports', value: { fileId: 'file-two' }, expectedVersion: 0 }] }])
      check(referenceResult[0].ok, 'new groups reuse existing attachment bytes')
      const originalAdd = IDBObjectStore.prototype.add
      IDBObjectStore.prototype.add = function (value, ...args) { if (this.name === 'records' && value.id === 'quota-child') throw new DOMException('full', 'QuotaExceededError'); return originalAdd.call(this, value, ...args) }
      try {
        const quota = await api.commitPcsNewRecordGroups([newGroup('quota-before', ['quota-before-root', 'quota-before-sku']), newGroup('quota-group', ['quota-root', 'quota-child']), newGroup('quota-after', ['quota-after-root', 'quota-after-sku'])])
        const afterQuota = (await api.readPcsRecords()).records
        check(!quota[1].ok && quota[1].message.includes('空间不足') && !afterQuota.some(row => row.id === 'quota-root'), 'new group quota failure keeps the complete group unsaved')
        check(quota[0].ok && quota[2].ok && ['quota-before-root', 'quota-before-sku', 'quota-after-root', 'quota-after-sku'].every(id => afterQuota.some(row => row.id === id)), 'a failed cohort excludes the failed group and fully saves both unaffected neighbors')
      } finally { IDBObjectStore.prototype.add = originalAdd }
      const receiptLoad = await api.commitPcsNewRecordGroups(Array.from({ length: 1002 }, (_, index) => newGroup(`receipt-${index}`, [`receipt-${index}`])))
      check(receiptLoad.every(row => row.ok), 'thousand new groups commit independently')
      const receiptCount = await new Promise<number>((resolve, reject) => { const open = indexedDB.open('higood-pcs-records'); open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result; const tx = db.transaction('operations'); const count = tx.objectStore('operations').count(); count.onsuccess = () => { resolve(count.result); db.close() }; count.onerror = () => { reject(count.error); db.close() } } })
      check(receiptCount === 1000, 'batch receipt retention is bounded after completion')
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('higood-pcs-records')
        request.onsuccess = () => {
          const db = request.result, tx = db.transaction('operations', 'readwrite'), store = tx.objectStore('operations')
          for (const [id, createdAt] of [['import-receipt-498', '1900-01-01'], ['import-receipt-499', '2100-01-01'], ['import-receipt-500', '1900-01-01']]) {
            const read = store.get(id); read.onsuccess = () => store.put({ ...read.result, id, createdAt })
          }
          tx.oncomplete = () => { db.close(); resolve() }; tx.onabort = () => { db.close(); reject(tx.error) }
        }; request.onerror = () => reject(request.error)
      })
      await api.commitPcsNewRecordGroups([newGroup('retention-final-a', ['retention-final-a']), newGroup('retention-final-b', ['retention-final-b'])])
      const remainingReceipts = await new Promise<IDBValidKey[]>((resolve, reject) => {
        const request = indexedDB.open('higood-pcs-records')
        request.onsuccess = () => { const db = request.result, tx = db.transaction('operations'), keys = tx.objectStore('operations').getAllKeys(); keys.onsuccess = () => { resolve(keys.result); db.close() }; keys.onerror = () => reject(keys.error) }; request.onerror = () => reject(request.error)
      })
      check(remainingReceipts.length === 1000 && remainingReceipts.includes('import-receipt-499') && !remainingReceipts.includes('import-receipt-498') && !remainingReceipts.includes('import-receipt-500'), 'receipt range pruning preserves a newer primary key between two expired keys')
      return passed
    })
    assert.equal(checks.length, 34)
    await page.reload()
    assert.equal(await page.evaluate(async () => (await (await import('/storage.js')).readPcsRecords()).records.find(row => row.id === 'one').version), 3)
  } finally {
    await browser?.close()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})

test('PCS旧库不重建大索引：原记录/Blob/操作不变，旧库分批投影与现有索引读取一致且错误不写',async()=>{
 const source=await readFile(new URL('../../src/data/pcs-record-db.ts',import.meta.url),'utf8'),code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
 const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/storage.js'?'text/javascript':'text/html');res.end(req.url==='/storage.js'?code:'<!doctype html><body>native upgrade</body>')})
 await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));const browser=await chromium.launch({headless:true})
 try{
  for(const oldVersion of [2,3,4]){
  const page=await browser.newPage();await page.addInitScript('globalThis.__name=value=>value');await page.goto('http://127.0.0.1:'+(server.address()as{port:number}).port)
  const result=await page.evaluate(async oldVersion=>{
   const req=(q:IDBRequest<any>)=>new Promise<any>((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)})
   const ns='native-scope',prefix=ns+'/flow/qcTasks/',archive=prefix+'ARCHIVE',current=prefix+'CURRENT'
   const original=[{id:archive,collection:'flow/qcTasks',version:7,value:{qcTaskId:'ARCHIVE',qcTaskNo:'OLD-NUMBER',status:'质检完成',productionOrderId:'P-OLD',productionOrderNo:'PO-OLD',fileId:'keep-blob'}},{id:current,collection:'flow/qcTasks',version:3,value:{qcTaskId:'CURRENT',qcTaskNo:'NEW-NUMBER',status:'待质检',productionOrderId:'P-NOW',productionOrderNo:'PO-NOW'}},{id:prefix+'DELETED',collection:'deleted',version:9,deleted:true,value:null},{id:prefix+'MISSING',collection:'flow/qcTasks',version:2,value:{qcTaskId:'MISSING',qcTaskNo:'MISSING-NUMBER'}},{id:ns+'/flow/deliveries/D',collection:'flow/deliveries',version:2,value:{deliveryId:'D'}}]
   const old=indexedDB.open('higood-pcs-records',oldVersion);old.onupgradeneeded=()=>{for(const s of ['records','files','operations','meta'])old.result.createObjectStore(s,{keyPath:'id'});old.transaction!.objectStore('operations').createIndex('createdAt','createdAt');if(oldVersion===4)old.transaction!.objectStore('records').createIndex('lookup:qualityHeader',['collection','value.status','value.qcTaskNo','value.productionOrderId','value.productionOrderNo']);if(oldVersion===3)for(const field of ['status','qcTaskNo','productionOrderId','productionOrderNo'])old.transaction!.objectStore('records').createIndex('lookup:'+field,['collection','value.'+field])}
   const db=await req(old),tx=db.transaction(['records','files','operations','meta'],'readwrite');for(const row of original)tx.objectStore('records').put(row);tx.objectStore('files').put({id:'keep-blob',blob:new Blob(['原附件不可改'],{type:'text/plain'})});tx.objectStore('operations').put({id:'original-operation',createdAt:'2026-10-21'});tx.objectStore('meta').put({id:'original-meta',value:29});await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error)});if(oldVersion!==3)db.close()
   let archiveBodyReads=0,writes=0;const get=IDBObjectStore.prototype.get,getAll=IDBObjectStore.prototype.getAll,transaction=IDBDatabase.prototype.transaction
   IDBObjectStore.prototype.get=function(...args){if(this.name==='records'&&args[0]===archive)archiveBodyReads++;return get.apply(this,args)}
   IDBObjectStore.prototype.getAll=function(...args){const q=getAll.apply(this,args);if(this.name==='records')q.addEventListener('success',()=>{if(q.result.some(row=>row.id===archive))archiveBodyReads++});return q}
   IDBDatabase.prototype.transaction=function(...args){const t=transaction.apply(this,args);if(t.mode==='readwrite')writes++;return t}
   const api=await import('/storage.js')
   let blocked='',heldVersion=0,heldArchiveVersion=0
   if(oldVersion===3){
    try{await api.readPcsRecordProjection([{id:archive}],row=>row.version)}catch(error){blocked=String(error)}
    heldVersion=db.version
    heldArchiveVersion=(await req(db.transaction('records','readonly').objectStore('records').get(archive))).version
    db.close()
   }
   // The blocked-connection integrity probe deliberately read the old archive.
   // Start the independent no-history-body assertion at the scoped-read boundary.
   archiveBodyReads=0
   const selected=await api.readPcsRecords([ns],{excludedPrefix:prefix,retain:()=>true,additionalIds:async(_rows,lookup)=>{const [all,complete]=await Promise.all([lookup.ids(prefix),lookup.idsByField('status','flow/qcTasks','质检完成')]);return all.filter(id=>!complete.includes(id))}})
   const noArchiveBody=archiveBodyReads===0
   const byNumber=await api.readPcsRecords([ns],{excludedPrefix:prefix,retain:()=>true,additionalIds:(_rows,lookup)=>lookup.idsByField('qcTaskNo','flow/qcTasks','OLD-NUMBER')})
   const byProduction=await api.readPcsRecords([ns],{excludedPrefix:prefix,retain:()=>true,additionalIds:async(_rows,lookup)=>[...await lookup.idsByField('productionOrderId','flow/qcTasks','P-OLD'),...await lookup.idsByField('productionOrderNo','flow/qcTasks','PO-NOW')]})
   let rejected='';try{await api.readPcsRecords([ns],{excludedPrefix:prefix,retain:()=>true,additionalIds:async(_rows,lookup)=>{await lookup.ids(prefix);throw Error('native-key-selection-failed')}})}catch(error){rejected=String(error)}
   const after=await api.readPcsRecords(),native=await req(indexedDB.open('higood-pcs-records')),check=native.transaction(['records','operations','meta'],'readonly'),indexes=[...check.objectStore('records').indexNames],operations=await req(check.objectStore('operations').getAll()),meta=await req(check.objectStore('meta').getAll());const version=native.version;native.close()
   return{blocked,heldVersion,heldArchiveVersion,selected:selected.records.map(row=>row.id),noArchiveBody,number:byNumber.records.map(row=>row.id),production:byProduction.records.map(row=>row.id),paper:await byNumber.files[0].blob.text(),type:byNumber.files[0].blob.type,rejected,writes,after:after.records,original,indexes,operations,meta,version}
  },oldVersion)
  if(oldVersion===3){assert.match(result.blocked,/升级被其他标签页阻止/);assert.equal(result.heldVersion,3);assert.equal(result.heldArchiveVersion,7)}
  assert.equal(result.version,4);assert.deepEqual(result.indexes.sort(),oldVersion===4?['lookup:qualityHeader']:[]);assert.equal(result.noArchiveBody,oldVersion===4);assert.equal(result.writes,0);assert.ok(!result.selected.some(id=>id.endsWith('/ARCHIVE')));assert.ok(result.selected.some(id=>id.endsWith('/DELETED')));assert.ok(result.selected.some(id=>id.endsWith('/MISSING')));assert.ok(result.number.some(id=>id.endsWith('/ARCHIVE')));assert.ok(result.production.some(id=>id.endsWith('/ARCHIVE')));assert.ok(result.production.some(id=>id.endsWith('/CURRENT')));assert.equal(result.paper,'原附件不可改');assert.equal(result.type,'text/plain');assert.match(result.rejected,/native-key-selection-failed/);assert.deepEqual(result.after.sort((a,b)=>a.id.localeCompare(b.id)),result.original.sort((a,b)=>a.id.localeCompare(b.id)));assert.deepEqual(result.operations,[{id:'original-operation',createdAt:'2026-10-21'}]);assert.deepEqual(result.meta,[{id:'original-meta',value:29}])
 await page.close()}
 }finally{await browser.close();await new Promise<void>(done=>server.close(()=>done()))}
})

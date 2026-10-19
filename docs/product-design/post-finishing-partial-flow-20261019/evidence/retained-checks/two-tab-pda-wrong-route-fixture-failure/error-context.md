# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-migration.spec.ts >> A20: two isolated tabs report a blocked database upgrade and preserve old records after the old connection closes (PDA)
- Location: tests/post-finishing-migration.spec.ts:274:4

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: '后道加工', exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('heading', { name: '后道加工', exact: true })

```

```yaml
- heading "页面未找到" [level=1]
- paragraph: 未匹配的路由：/fcs/pda/post-finishing/post
```

# Test source

```ts
  230 |   await openLegacy(page, fixture)
  231 |   const result = await page.evaluate(async ({ ns, archiveKey, inline, oldKey }) => {
  232 |     const r = await import('/src/data/fcs/post-finishing-records.ts')
  233 |     const db = await import('/src/data/pcs-record-db.ts')
  234 |     localStorage.setItem(archiveKey, JSON.stringify({ raw: JSON.stringify({ oldDraft: { quantity: 600, image: inline }, oldOutbound: { no: 'OLD-OUT', image: inline } }) }))
  235 |     await db.commitPcsRecords({ puts: [{ id: 'pcs-common/KEEP', collection: 'pcs-common', value: { quantity: 7 }, expectedVersion: 0 }], deletes: [], operationId: 'TEST-COMMON', intent: 'preserve unrelated record' })
  236 |     const original = IDBObjectStore.prototype.put
  237 |     let writes = 0
  238 |     IDBObjectStore.prototype.put = function (...args: any[]) {
  239 |       if (this.name === 'records' && ++writes === 110) throw new DOMException('验收中断第二批转换', 'AbortError')
  240 |       return original.apply(this, args as any)
  241 |     }
  242 |     let error = ''
  243 |     try { await r.migratePostFinishingLegacyData() } catch (e) { error=String(e) }
  244 |     finally { IDBObjectStore.prototype.put = original }
  245 |     const partial = await db.readPcsRecords([ns])
  246 |     const oldPreserved = Boolean(localStorage.getItem(oldKey) && localStorage.getItem(archiveKey))
  247 |     let oldWriteRejected = false
  248 |     try { await r.runPostFinishingCommand(() => true) } catch { oldWriteRejected=true }
  249 |     await r.migratePostFinishingLegacyData()
  250 |     const final = await db.readPcsRecords([ns])
  251 |     const backup = JSON.parse(await (await r.exportPostFinishingBackup()).text())
  252 |     await r.importPostFinishingBackup(new File([JSON.stringify(backup)], 'archive-with-blob.json'))
  253 |     return { error, partialCount: partial.records.length, oldPreserved, oldWriteRejected,
  254 |       common: (await db.readPcsRecords(['pcs-common'])).records[0]?.value,
  255 |       idsUnique: new Set(final.records.map(row => row.id)).size===final.records.length,
  256 |       archives: final.records.filter(row => row.collection==='archive').map(row=>row.value), fileCount: final.files.length,
  257 |       bytes: await Promise.all(final.files.map(async row => (await row.blob.arrayBuffer()).byteLength)),
  258 |       noInline: !JSON.stringify(final.records).includes('data:image'), sourcesRemoved: !localStorage.getItem(oldKey) && !localStorage.getItem(archiveKey) }
  259 |   }, { ns: namespace, archiveKey, inline, oldKey })
  260 |   expect(result.error).toContain('AbortError')
  261 |   expect(result.partialCount).toBeGreaterThan(0)
  262 |   expect(result.oldPreserved).toBe(true)
  263 |   expect(result.oldWriteRejected).toBe(true)
  264 |   expect(result.common).toEqual({ quantity: 7 })
  265 |   expect(result.idsUnique && result.noInline && result.sourcesRemoved).toBe(true)
  266 |   expect(result.fileCount).toBe(1)
  267 |   expect(result.bytes[0]).toBeGreaterThan(0)
  268 |   mkdirSync(evidence, { recursive: true })
  269 | })
  270 | 
  271 | for (const entry of [
  272 |   { name: 'Web', route: '/fcs/craft/post-finishing/work-orders', heading: '后道加工单', file: 'two-tab-upgrade-recovery' },
  273 |   { name: 'PDA', route: '/fcs/pda/post-finishing/post', heading: '后道加工', file: 'two-tab-upgrade-pda-recovery' },
  274 | ]) test(`A20: two isolated tabs report a blocked database upgrade and preserve old records after the old connection closes (${entry.name})`, async ({ page, context }) => {
  275 |   // A static same-origin asset starts no application bootstrap. The version-1
  276 |   // connection is an explicit old-storage fixture, held by a separate old tab.
  277 |   await page.goto('/shirt-sample.jpg')
  278 |   if (entry.name === 'PDA') {
  279 |     await page.evaluate(() => localStorage.setItem('fcs_pda_session', JSON.stringify({
  280 |       userId: 'ID-F002_operator', loginId: 'ID-F002_operator', userName: '后道工厂_操作工', roleId: 'ROLE_OPERATOR',
  281 |       factoryId: 'ID-F002', factoryName: '后道工厂', loggedAt: '2026-09-03 10:00:00',
  282 |     })))
  283 |   }
  284 |   const initial = await page.evaluate(async () => {
  285 |     const db = await new Promise<IDBDatabase>((resolve, reject) => {
  286 |       const request = indexedDB.open('higood-pcs-records', 1)
  287 |       request.onupgradeneeded = () => {
  288 |         request.result.createObjectStore('records', { keyPath: 'id' })
  289 |         request.result.createObjectStore('files', { keyPath: 'id' })
  290 |       }
  291 |       request.onerror = () => reject(request.error)
  292 |       request.onsuccess = () => resolve(request.result)
  293 |     })
  294 |     ;(window as any).__pfOldUpgradeConnection = db
  295 |     ;(window as any).__pfVersionChangeEvents = []
  296 |     db.onversionchange = event => {
  297 |       ;(window as any).__pfVersionChangeEvents.push({ oldVersion: event.oldVersion, newVersion: event.newVersion })
  298 |       // Simulate an old tab that has not yet obeyed the close/reload instruction.
  299 |     }
  300 |     await new Promise<void>((resolve, reject) => {
  301 |       const transaction = db.transaction('records', 'readwrite')
  302 |       transaction.objectStore('records').put({ id: 'pcs-common/upgrade-sentinel', collection: 'pcs-common', value: { quantity: 7 }, version: 1 })
  303 |       transaction.oncomplete = () => resolve()
  304 |       transaction.onabort = () => reject(transaction.error)
  305 |     })
  306 |     return db.version
  307 |   })
  308 |   expect(initial).toBe(1)
  309 |   const newTab = await context.newPage()
  310 |   if (entry.name === 'PDA') await newTab.setViewportSize({ width: 390, height: 844 })
  311 |   const pageErrors: string[] = []
  312 |   newTab.on('pageerror', error => pageErrors.push(error.message))
  313 |   await newTab.goto(entry.route)
  314 |   const notice = newTab.locator('[data-post-finishing-storage-notice]')
  315 |   await expect(notice).toHaveAttribute('data-post-finishing-entry-storage-failure', '')
  316 |   await expect(notice).toContainText('数据库升级被其他标签页阻止')
  317 |   await expect(notice).toContainText('关闭旧页面后重试')
  318 |   await expect(notice.locator('[data-pcs-storage-retry]')).toHaveText('重新读取')
  319 |   const blocked = await notice.innerText()
  320 |   mkdirSync(evidence, { recursive: true })
  321 |   await newTab.screenshot({ path: `${evidence}/${entry.file}-blocked.png`, fullPage: true })
  322 |   const versionChanges = await page.evaluate(() => (window as any).__pfVersionChangeEvents)
  323 |   expect(versionChanges).toEqual([{ oldVersion: 1, newVersion: 2 }])
  324 |   await page.evaluate(() => {
  325 |     ;(window as any).__pfOldUpgradeConnection.close()
  326 |     delete (window as any).__pfOldUpgradeConnection
  327 |   })
  328 |   await newTab.locator('[data-pcs-storage-retry]').click()
  329 |   await expect(notice).toHaveCount(0)
> 330 |   await expect(newTab.getByRole('heading', { name: entry.heading, exact: true })).toBeVisible()
      |                                                                                   ^ Error: expect(locator).toBeVisible() failed
  331 |   const recovered = await newTab.evaluate(async ns => {
  332 |     const records = await import('/src/data/pcs-record-db.ts')
  333 |     const data = await records.readPcsRecords(['pcs-common'])
  334 |     const db = await new Promise<IDBDatabase>((resolve, reject) => {
  335 |       const request = indexedDB.open('higood-pcs-records')
  336 |       request.onerror = () => reject(request.error)
  337 |       request.onsuccess = () => resolve(request.result)
  338 |     })
  339 |     const result = { version: db.version, stores: [...db.objectStoreNames], common: data.records[0]?.value,
  340 |       postRows: (await records.readPcsRecords([ns])).records.length }
  341 |     db.close()
  342 |     return result
  343 |   }, namespace)
  344 |   expect(recovered.version).toBe(2)
  345 |   expect(recovered.stores).toEqual(expect.arrayContaining(['records', 'files', 'operations', 'meta']))
  346 |   expect(recovered.common).toEqual({ quantity: 7 })
  347 |   expect(recovered.postRows).toBe(0)
  348 |   expect(pageErrors).toEqual([])
  349 |   await newTab.screenshot({ path: `${evidence}/${entry.file}-recovered.png`, fullPage: true })
  350 |   const { writeFileSync } = await import('node:fs')
  351 |   writeFileSync(`${evidence}/${entry.file}.json`, JSON.stringify({ entry: entry.name, route: entry.route, blocked, versionChanges, recovered, pageErrors }, null, 2))
  352 |   await newTab.close()
  353 | })
  354 | 
```
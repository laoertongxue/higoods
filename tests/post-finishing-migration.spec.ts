import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
// Historical filename retained for the existing test command; current backup
// and shared database blocked-open recovery only. Demo migration is retired.
const namespace='higood-fcs-post-finishing-records'
const evidence=`${process.env.POST_FINISHING_EVIDENCE_ROOT || 'output/qc-demo-reset-20261023'}/storage`
test('当前后道备份回读与恢复：错误格式、重复记录、孤立加工拒绝，原记录不变',async({page})=>{
  await page.goto('/fcs/craft/post-finishing/work-orders')
  await expect(page.locator('main h1')).toHaveText('后道加工单')
  const result=await page.evaluate(async()=>{
    const f=await import('/src/data/fcs/post-finishing-full-flow.ts'),r=await import('/src/data/fcs/post-finishing-records.ts'),db=await import('/src/data/pcs-record-db.ts')
    await r.ensurePostFinishingRecordState()
    const task=f.listPostFinishingFullFlowPostTasks().find(row=>row.status==='待后道')!
    await r.runPostFinishingCommand(()=>f.startPostFinishingPostTask({postTaskNo:task.postTaskNo,actor:f.POST_FINISHING_ACCEPTANCE_ACTORS.postOperator}))
    const backup=JSON.parse(await(await r.exportPostFinishingBackup()).text()),before=JSON.stringify((await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records)
    await r.importPostFinishingBackup(new File([JSON.stringify(backup)],'current.json'))
    const errors=[]
    for(const bad of [{...backup,version:99},{...backup,records:[...backup.records,backup.records[0]]},{...backup,records:[...backup.records,{id:'higood-fcs-post-finishing-records/flow/processCompletions/ORPHAN',collection:'flow/processCompletions',version:1,value:{recordId:'ORPHAN',postTaskId:'MISSING'}}]}]) {
      try{await r.importPostFinishingBackup(new File([JSON.stringify(bad)],'invalid.json'));errors.push('UNEXPECTED_SUCCESS')}catch(e){errors.push(String(e))}
    }
    return {errors,unchanged:before===JSON.stringify((await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records),id:task.postTaskId}
  })
  expect(result.errors).toHaveLength(3);expect(result.errors.every(error=>error!=='UNEXPECTED_SUCCESS')).toBe(true);expect(result.unchanged).toBe(true)
  await page.reload();await expect(page.locator('[data-post-finishing-storage-notice]')).toHaveCount(0)
})

for (const entry of [
  { name: 'Web', route: '/fcs/craft/post-finishing/work-orders', heading: '后道加工单', file: 'two-tab-upgrade-recovery' },
  { name: 'PDA', route: '/fcs/pda/post-finishing/execute', heading: '后道加工', file: 'two-tab-upgrade-pda-recovery' },
]) test(`A20: two isolated tabs report a blocked database upgrade and preserve old records after the old connection closes (${entry.name})`, async ({ page, context }) => {
  // A static same-origin asset starts no application bootstrap. The version-1
  // connection is an explicit old-storage fixture, held by a separate old tab.
  await page.goto('/shirt-sample.jpg')
  if (entry.name === 'PDA') {
    await page.evaluate(() => localStorage.setItem('fcs_pda_session', JSON.stringify({
      userId: 'ID-F002_operator', loginId: 'ID-F002_operator', userName: '后道工厂_操作工', roleId: 'ROLE_OPERATOR',
      factoryId: 'ID-F002', factoryName: '后道工厂', loggedAt: '2026-09-03 10:00:00',
    })))
  }
  const initial = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('higood-pcs-records', 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore('records', { keyPath: 'id' })
        request.result.createObjectStore('files', { keyPath: 'id' })
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    ;(window as any).__pfOldUpgradeConnection = db
    ;(window as any).__pfVersionChangeEvents = []
    db.onversionchange = event => {
      ;(window as any).__pfVersionChangeEvents.push({ oldVersion: event.oldVersion, newVersion: event.newVersion })
      // Simulate an old tab that has not yet obeyed the close/reload instruction.
    }
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('records', 'readwrite')
      transaction.objectStore('records').put({ id: 'pcs-common/upgrade-sentinel', collection: 'pcs-common', value: { quantity: 7 }, version: 1 })
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error)
    })
    return db.version
  })
  expect(initial).toBe(1)
  const newTab = await context.newPage()
  if (entry.name === 'PDA') await newTab.setViewportSize({ width: 390, height: 844 })
  const pageErrors: string[] = []
  newTab.on('pageerror', error => pageErrors.push(error.message))
  await newTab.goto(entry.route)
  const notice = newTab.locator('[data-post-finishing-storage-notice]')
  await expect(notice).toHaveAttribute('data-post-finishing-entry-storage-failure', '')
  await expect(notice).toContainText('数据库升级被其他标签页阻止')
  await expect(notice).toContainText('关闭旧页面后重试')
  await expect(notice.locator('[data-pcs-storage-retry]')).toHaveText('重新读取')
  const blocked = await notice.innerText()
  mkdirSync(evidence, { recursive: true })
  await newTab.screenshot({ path: `${evidence}/${entry.file}-blocked.png`, fullPage: true })
  const versionChanges = await page.evaluate(() => (window as any).__pfVersionChangeEvents)
  expect(versionChanges).toEqual([{ oldVersion: 1, newVersion: 4 }])
  await page.evaluate(() => {
    ;(window as any).__pfOldUpgradeConnection.close()
    delete (window as any).__pfOldUpgradeConnection
  })
  await newTab.locator('[data-pcs-storage-retry]').click()
  await expect(notice).toHaveCount(0)
  await expect(newTab.getByRole('heading', { name: entry.heading, exact: true })).toBeVisible()
  const recovered = await newTab.evaluate(async ns => {
    const records = await import('/src/data/pcs-record-db.ts')
    const data = await records.readPcsRecords(['pcs-common'])
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('higood-pcs-records')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    const result = { version: db.version, stores: [...db.objectStoreNames], common: data.records[0]?.value,
      postRows: (await records.readPcsRecords([ns])).records.length }
    db.close()
    return result
  }, namespace)
  expect(recovered.version).toBe(4)
  expect(recovered.stores).toEqual(expect.arrayContaining(['records', 'files', 'operations', 'meta']))
  expect(recovered.common).toEqual({ quantity: 7 })
  expect(recovered.postRows).toBe(0)
  expect(pageErrors).toEqual([])
  await newTab.screenshot({ path: `${evidence}/${entry.file}-recovered.png`, fullPage: true })
  const { writeFileSync } = await import('node:fs')
  writeFileSync(`${evidence}/${entry.file}.json`, JSON.stringify({ entry: entry.name, route: entry.route, blocked, versionChanges, recovered, pageErrors }, null, 2))
  await newTab.close()
})

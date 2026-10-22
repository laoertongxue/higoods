import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

/**
 * 原 PPIC 批版页面专项。每例使用 Playwright 隔离 browser context。
 * 正常流程和重试均通过真实页面动作保存；读取模块仅核对同库结果。
 * 旧数据用例显式以原 production-context 事务预装旧记录，不能作为现场已发生步骤。
 * 上传照片来自当前款式已绑定的静态图，仅为上传/Blob/预览的隔离素材，不能冒称现场实拍。
 * PDF 是浏览器对原建议卡页面的打印采证，不声称产品另有 PDF 导出或纸签功能。
 */
const route = '/fcs/sewing-outsourcing/sample-approval-suggestions'
const paths = {
  samples: '/src/data/fcs/sewing-sample-approval-suggestion.ts',
  context: '/src/data/fcs/production-context-records.ts',
  actions: '/src/data/fcs/production-context-actions.ts',
  repository: '/src/data/fcs/cutting/cutting-record-repository.ts',
  quality: '/src/data/fcs/quality-management-records.ts',
  styleContext: '/src/data/fcs/quality-management-style-context.ts',
}
const independent = 'ASG-PPIC-SAMPLE-DEMO-INDEPENDENT'
const handedFixture = 'ASG-PPIC-SAMPLE-DEMO-SEW-IRON'
const approver = '浏览器专项批版人'
const claimAt = '2026-10-16T08:15:00.000Z' // 星期五，工厂雅加达15:15
const dueAt = '2026-10-18T08:15:00.000Z' // 周日连续48小时，不跳过周末
const dialog = (page: Page, name: string) => page.getByRole('dialog', { name, exact: true })
const sampleAction = (page: Page, action: string, id = independent) => page.locator(`[data-sample-approval-action="${action}"][data-assignment-id="${id}"]`)
const row = (page: Page, id = independent) => page.locator('tr').filter({ has: page.locator(`[data-assignment-id="${id}"]`) }).first()
const field = (root: Locator, name: string) => root.locator(`[data-sample-approval-field="${name}"]`)

test.use({ timezoneId: 'America/Los_Angeles', actionTimeout: 15000, navigationTimeout: 30000 })
test.describe.configure({ mode: 'serial' })
const loadedModules = new WeakMap<Page, Map<string, string>>()
test.beforeEach(async ({ page }) => {
  const modules = new Map<string, string>()
  loadedModules.set(page, modules)
  page.on('response', response => {
    const url = new URL(response.url())
    if (Object.values(paths).includes(url.pathname) && (!modules.has(url.pathname) || url.searchParams.has('t'))) modules.set(url.pathname, url.href)
  })
})

async function open(page: Page) {
  console.log('SAMPLE browser: open')
  await page.goto(route)
  await expect(page.getByRole('heading', { name: '批版建议', exact: true })).toBeVisible()
  await expect(page.locator('[data-sample-approval-page]')).toBeVisible()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[data-sample-approval-page]')).toBeVisible()
}
async function tab(page: Page, key: 'PENDING_RETURN' | 'PENDING_APPROVAL' | 'PENDING_FEEDBACK' | 'COMPLETED') {
  await page.locator(`[data-sample-approval-action="switch-tab:${key}"]`).click()
}
// Vite HMR rewrites app imports with ?t=. Reuse the page's loaded module URL
// so assertions observe the same business source rather than creating a second instance.
async function livePaths(page: Page) {
  return Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, loadedModules.get(page)?.get(path) ?? path]))
}
async function read(page: Page, id = independent) {
  console.log('SAMPLE browser: read',id,(await livePaths(page)).samples)
  return page.evaluate(async ({ paths, id }) => {
    const samples = await import(paths.samples)
    return samples.getSewingSampleApprovalRecord(id)
  }, { paths: await livePaths(page), id })
}
async function storage(page: Page) {
  return page.evaluate(async paths => {
    const repository = await import(paths.repository)
    const snapshot = await repository.readCuttingRecords()
    const db = await repository.openCuttingRecordDatabase()
    const files = await new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction('files', 'readonly'), request = tx.objectStore('files').getAll()
      let values: any[] = []
      request.onsuccess = () => { values = request.result }
      tx.oncomplete = () => resolve(values)
      tx.onabort = () => reject(tx.error)
    })
    return {
      revision: snapshot.revision,
      samples: snapshot.records.filter((item: any) => item.collection === 'production-context:samples'),
      files: await Promise.all(files.map(async item => ({ id: item.id, size: item.blob.size, type: item.blob.type, bytes: Array.from(new Uint8Array(await item.blob.arrayBuffer())) }))),
    }
  }, await livePaths(page))
}
async function attachJson(testInfo: TestInfo, name: string, value: unknown) {
  const path = testInfo.outputPath(`${name}.json`)
  await writeFile(path, JSON.stringify(value, null, 2))
  await testInfo.attach(name, { path, contentType: 'application/json' })
}
async function matchingImage(page: Page, id = independent) {
  const record = await read(page, id)
  expect(record.sample.styleImageUrl, '素材必须来自本款绑定图片，缺图应暴露而不是补通用占位').toMatch(/^\//)
  const response = await page.request.get(record.sample.styleImageUrl)
  expect(response.ok()).toBeTruthy()
  return { name: `${record.sample.styleCode}-isolated-upload.jpg`, mimeType: response.headers()['content-type'].split(';')[0], buffer: await response.body() }
}
async function receive(page: Page, id = independent) {
  console.log('SAMPLE browser: receive')
  await tab(page, 'PENDING_RETURN')
  await sampleAction(page, 'receive-sample', id).click()
  const form = dialog(page, 'PPIC接收产前版样衣')
  await form.locator('[data-sample-approval-action="select-received-photos"]').setInputFiles(await matchingImage(page, id))
  await expect(form.getByRole('button', { name: '查看待保存实收照片1大图' })).toBeVisible()
  await form.getByRole('button', { name: '保存照片并确认接收', exact: true }).click()
  await expect(form).toHaveCount(0)
  expect((await read(page, id)).sample.status).toBe('PPIC_RECEIVED')
}
async function claim(page: Page, id = independent, name = approver) {
  await tab(page, 'PENDING_APPROVAL')
  await sampleAction(page, 'start-approval', id).click()
  const form = dialog(page, '领取批版')
  await field(form, 'startApproverName').fill(name)
  await field(form, 'startConfirmed').check()
  await form.getByRole('button', { name: '确认领取', exact: true }).click()
  await expect(form).toHaveCount(0)
  expect((await read(page, id)).sample.status).toBe('APPROVAL_IN_PROGRESS')
}
async function handoffAndClaim(page: Page, id = independent, name = approver) {
  console.log('SAMPLE browser: handoff and claim')
  await tab(page, 'PENDING_APPROVAL')
  await sampleAction(page, 'handoff-approver', id).click()
  await expect(sampleAction(page, 'start-approval', id)).toBeVisible()
  await claim(page, id, name)
}
async function fillOpinion(page: Page, id = independent, name = approver) {
  console.log('SAMPLE browser: fill opinion')
  await sampleAction(page, 'open-approval', id).click()
  const form = dialog(page, '填写批版建议')
  await expect(form.locator('[data-sample-inspection-standard]')).toContainText('本次检查要求')
  await field(form, 'conclusion').selectOption('HAS_PROBLEM')
  await field(form, 'approverName').fill(name)
  await field(form, 'approverConfirmed').check()
  return form
}
async function selectSpecificIssue(form: Locator, note: string) {
  const first = form.locator('[data-sample-issue-id]').first()
  const itemId = await first.getAttribute('data-sample-issue-id')
  expect(itemId).toBeTruthy()
  await first.check()
  await form.locator(`[data-sample-issue-note="${itemId}"]`).fill(note)
  return itemId!
}
async function failFiles(page: Page, enabled: boolean) {
  await page.evaluate(enabled => {
    const scope = window as any
    if (enabled) {
      scope.__sampleOriginalPut = IDBObjectStore.prototype.put
      IDBObjectStore.prototype.put = function (value: any, ...args: any[]) {
        if (this.name === 'files') throw new DOMException('样衣隔离附件保存故障', 'QuotaExceededError')
        return scope.__sampleOriginalPut.call(this, value, ...args)
      }
    } else if (scope.__sampleOriginalPut) {
      IDBObjectStore.prototype.put = scope.__sampleOriginalPut
      delete scope.__sampleOriginalPut
    }
  }, enabled)
}
async function cardEvidence(page: Page, testInfo: TestInfo, id = independent) {
  await sampleAction(page, 'show-card', id).click()
  const card = page.locator('[data-sample-approval-screenshot-card]')
  await expect(card).toBeVisible()
  await expect(card).toContainText('批版建议')
  await expect(card).toContainText('提交 2026-10-18 15:15:00 Asia/Jakarta')
  await expect(card).not.toContainText('提交 2026-10-18T08:15:00.000Z')
  const picture = card.locator('img').first()
  await expect(picture).toBeVisible()
  await expect.poll(() => picture.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBeTruthy()
  const screenshot = testInfo.outputPath('sample-opinion-card.png')
  await card.screenshot({ path: screenshot })
  await testInfo.attach('sample-opinion-card-image', { path: screenshot, contentType: 'image/png' })
  const pdf = testInfo.outputPath('sample-opinion-card-browser-page.pdf')
  // Fixed scrolling dialogs clip under default A4. This evidence is explicitly a
  // full-height browser card capture, not a promised product A4 print template.
  const cardHeight = await card.evaluate(element => element.scrollHeight)
  await page.pdf({ path: pdf, width: `${page.viewportSize()!.width}px`, height: `${cardHeight + 220}px`, printBackground: true })
  await testInfo.attach('sample-opinion-card-browser-page-pdf', { path: pdf, contentType: 'application/pdf' })
  // Esc closes only the enlarged photograph; the underlying opinion card remains.
  await card.locator('[data-sample-approval-action="preview-image"]').first().click()
  await expect(dialog(page, '图片大图')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog(page, '图片大图')).toHaveCount(0)
  await expect(card).toBeVisible()
  await dialog(page, '批版建议卡').getByRole('button', { name: '关闭', exact: true }).click()
}

// Legacy scenarios explicitly preinstall original facts. Conversion/supplement/feedback remains genuine UI work.
async function legacyFixture(page: Page, kind: 'UNRECEIVED' | 'CLAIMED' | 'SUGGESTION' | 'NEXT_RECEIVED' | 'NEXT_CLAIMED') {
  return page.evaluate(async ({ paths, kind, id }) => {
    const samples = await import(paths.samples), context = await import(paths.context), actions = await import(paths.actions)
    const original = samples.getSewingSampleApprovalRecord(id)
    const record = structuredClone(original)
    delete record.qualitySchemaVersion
    delete record.inspectionStandardSnapshot
    record.sample.roundNo = 1
    record.sample.factoryTimeZone = 'Asia/Jakarta'
    if (kind === 'UNRECEIVED') {
      record.sample.status = 'WAITING_FACTORY_PRODUCTION'
      record.suggestionVersions = []
    } else {
      record.sample.ppicReceivedAt = '2026-10-16 15:00:00'
      record.sample.ppicReceivedBy = record.sample.currentPpicName
      record.sample.ppicReceivedSamplePhotoUrls = [record.sample.styleImageUrl]
      record.sample.handedToApproverAt = '2026-10-16 15:10:00'
      record.sample.handedToApproverBy = record.sample.currentPpicName
      record.sample.approverReceivedAt = '2026-10-16 15:15:00'
      delete record.sample.approverReceivedInstant
      record.currentApproverId = 'LEGACY-APPROVER-ISOLATED'
      record.currentApproverName = '遗留批版人员'
      record.sample.status = kind === 'CLAIMED' || kind === 'NEXT_CLAIMED' ? 'APPROVAL_IN_PROGRESS' : kind === 'NEXT_RECEIVED' ? 'PPIC_RECEIVED' : 'SUGGESTION_UPLOADED'
      record.suggestionVersions = kind === 'CLAIMED' ? [] : [{
        suggestionVersionId: 'LEGACY-OPINION-ISOLATED', suggestionNo: 'LEGACY-OPINION-NO', assignmentId: id,
        runtimeTaskId: record.sample.runtimeTaskId, sampleId: record.sample.sampleId, roundNo: 1, conclusion: 'HAS_PROBLEM',
        structuredComments: { fabricApprovalComment: '旧面料意见原文', processComment: '旧工艺意见原文', materialUsageComment: '', otherComment: '' },
        approvalSheetPhotoUrls: [record.sample.styleImageUrl], referenceSnapshots: structuredClone(record.referenceSnapshots), requiresAnotherApproval: true,
        uploadedAt: '2026-10-16 16:00:00', uploadedById: record.currentApproverId, uploadedByName: record.currentApproverName,
      }]
      if(kind==='NEXT_RECEIVED' || kind==='NEXT_CLAIMED') {
        record.sample.roundNo=2
        record.sample.ppicReceivedAt='2026-10-17 09:00:00'
        record.suggestionVersions[0].feedbackSentAt='2026-10-16 17:00:00'
        record.latestSuggestionVersionId=record.suggestionVersions[0].suggestionVersionId
        if(kind==='NEXT_RECEIVED') {
          delete record.sample.approverReceivedAt;delete record.sample.approverReceivedBy
          delete record.sample.handedToApproverAt;delete record.sample.handedToApproverBy
          delete record.currentApproverId;delete record.currentApproverName
        } else record.sample.approverReceivedAt='2026-10-17 09:15:00'
      }
    }
    await actions.saveProductionSourceAction({ id: `ISOLATED-LEGACY-SAMPLE:${kind}`, intent: JSON.stringify({kind,id}), action: () => {
      const state = samples.captureSewingSampleState()
      state.records = state.records.map(([key, value]: any) => [key, key === id ? record : value])
      samples.restoreSewingSampleState(state)
      context.productionContextStorage.setItem(context.PRODUCTION_CONTEXT_KEYS.samples, JSON.stringify({version:3, records:state.records.map(([,value]:any)=>value), commands:state.commands, sequence:state.sequence}))
      return record
    } })
    return record
  }, { paths: await livePaths(page), kind, id: independent })
}

test('PPIC原页接收→转交→领取→固定标准问题→一次意见→原反馈，附件刷新后回读及三尺寸布局', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date(claimAt))
  await open(page)
  expect((await storage(page)).samples, '首次查看静态样衣不整包落盘').toHaveLength(0)
  await attachJson(testInfo,'runtime-loaded-sample-modules',{resolved:await livePaths(page),networkModuleUrls:[...(loadedModules.get(page)?.values() ?? [])]})
  const before = await read(page)
  expect(before.sample.status).toBe('WAITING_PPIC_RECEIVE')
  await expect(page.locator('[data-sample-approval-page]')).not.toContainText('完成制作并送出')
  await receive(page)
  const received = await storage(page)
  expect(received.samples).toHaveLength(1)
  expect(JSON.stringify(received.samples)).not.toMatch(/data:image|base64,/)
  expect(JSON.stringify(received.samples)).toContain('$productionFile')
  expect(received.files).toHaveLength(1)
  expect(received.files[0].size).toBeGreaterThan(0)
  await page.reload(); await expect(page.getByRole('heading', { name:'批版建议', exact:true })).toBeVisible()
  await handoffAndClaim(page)
  const claimed = await read(page), standard = claimed.inspectionStandardSnapshot
  expect(standard.context.sourceKind).toBe('PRE_PRODUCTION_SAMPLE')
  expect(standard.ruleSnapshot).toBeNull()
  expect(standard.items.length).toBeGreaterThan(5)
  expect(claimed.sample.approverReceivedInstant).toBe(claimAt)
  expect(claimed.sample.factoryTimeZone).toBe('Asia/Jakarta')
  await expect(row(page)).toContainText('2026-10-18 15:15:00')
  await expect(row(page)).toContainText('Asia/Jakarta')
  const form = await fillOpinion(page)
  await form.getByRole('button', { name:'提交批版建议', exact:true }).click()
  await expect(form.getByRole('alert')).toContainText('具体标准项目')
  const selectedId = await selectSpecificIssue(form, '按封版尺寸核对：本件领围偏大，须调整')
  await field(form,'processComment').fill('专项首次工艺意见')
  await form.locator('[data-sample-approval-action="select-approval-sheet-photos"]').setInputFiles(await matchingImage(page))
  await expect(form.getByRole('button', {name:'查看补充批版资料1大图'})).toBeVisible()
  await page.clock.setFixedTime(new Date(dueAt))
  await form.getByRole('button', { name:'提交批版建议', exact:true }).click()
  await expect(form).toHaveCount(0)
  const submitted = await read(page)
  expect(submitted.suggestionVersions).toHaveLength(1)
  expect(submitted.suggestionVersions[0].issues).toEqual([{itemId:selectedId,note:'按封版尺寸核对：本件领围偏大，须调整'}])
  expect(submitted.suggestionVersions[0].requiresAnotherApproval).toBeUndefined()
  expect(submitted.inspectionStandardSnapshot.id).toBe(standard.id)
  await tab(page,'PENDING_FEEDBACK')
  await expect(sampleAction(page,'feedback-factory')).toBeVisible()
  await expect(page.locator('[data-sample-approval-page]')).not.toContainText('再次批版')
  await page.clock.setFixedTime(new Date('2026-10-21T08:15:00.000Z'))
  await sampleAction(page,'feedback-factory').click();await expect(page.getByRole('status')).toContainText('已登记截图反馈时间和责任人')
  await tab(page,'COMPLETED')
  await expect(row(page)).toContainText('已反馈工厂')
  await cardEvidence(page,testInfo)
  for(const viewport of [{width:1366,height:768},{width:1280,height:720},{width:1024,height:768}]) {
    await page.setViewportSize(viewport)
    await expect(row(page)).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy()
    const imagePath=testInfo.outputPath(`sample-list-${viewport.width}x${viewport.height}.png`)
    await page.screenshot({path:imagePath,fullPage:true})
    await testInfo.attach(`sample-list-${viewport.width}`,{path:imagePath,contentType:'image/png'})
  }
  await page.reload();await tab(page,'COMPLETED')
  const final = await read(page), persisted = await storage(page)
  expect(final.sample.status).toBe('FEEDBACK_SENT');expect(final.suggestionVersions).toHaveLength(1)
  expect(final.suggestionVersions[0].feedbackNote).toContain('已从系统截取批版建议卡')
  expect(final.inspectionStandardSnapshot.id).toBe(standard.id)
  const timing=await page.evaluate(async ({paths,id})=>{const api=await import(paths.samples);return api.getSampleApprovalTiming(api.getSewingSampleApprovalRecord(id),'2026-10-22T08:15:00Z')},{paths:await livePaths(page),id:independent})
  expect(timing.overdue,'48h终点为恰好到期时首次意见提交，后续反馈不延长批版').toBe(false)
  expect(timing.timeVerified).toBe(true)
  await attachJson(testInfo,'sample-original-ui-persisted-result',{fixture:'原静态已分配记录；照片为对应款式静态上传素材',before,claimed,submitted,final,timing,persisted})
})

test('接收照片与意见补充照片保存失败均不半套，保留输入并原确认重试一次',async({page},testInfo)=>{
  await page.clock.setFixedTime(new Date(claimAt));await open(page)
  await sampleAction(page,'receive-sample').click()
  let form=dialog(page,'PPIC接收产前版样衣')
  await form.locator('[data-sample-approval-action="select-received-photos"]').setInputFiles(await matchingImage(page))
  await expect(form.getByRole('button',{name:'查看待保存实收照片1大图'})).toBeVisible()
  const before=await storage(page)
  await failFiles(page,true)
  await form.getByRole('button',{name:'保存照片并确认接收',exact:true}).click()
  await expect(form.getByRole('alert')).toContainText(/未保存|撤回|故障|空间|quota/i)
  expect(await storage(page)).toEqual(before)
  expect((await read(page)).sample.status).toBe('WAITING_PPIC_RECEIVE')
  await expect(form.getByRole('button',{name:'查看待保存实收照片1大图'})).toBeVisible()
  await failFiles(page,false)
  await form.getByRole('button',{name:'保存照片并确认接收',exact:true}).click()
  await expect(form).toHaveCount(0)
  await handoffAndClaim(page)
  form=await fillOpinion(page)
  const itemId=await selectSpecificIssue(form,'失败后必须保留的具体问题')
  await field(form,'otherComment').fill('失败后必须保留的备注')
  // Different bytes are required here: identical uploads correctly reuse the first Blob,
  // so no new files.put would occur. Capture the displayed matching garment image as an
  // isolated PNG upload; this is declared screen material, never a physical photo.
  const matchingGarment = form.locator('img').first()
  await expect.poll(() => matchingGarment.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBeTruthy()
  await form.locator('[data-sample-approval-action="select-approval-sheet-photos"]').setInputFiles({name:'matching-garment-isolated-screen-material.png',mimeType:'image/png',buffer:await matchingGarment.screenshot()})
  await expect(form.getByRole('button',{name:'查看补充批版资料1大图'})).toBeVisible()
  const beforeOpinion=await storage(page)
  await failFiles(page,true)
  await form.getByRole('button',{name:'提交批版建议',exact:true}).click()
  await expect(form.getByRole('alert')).toContainText(/未保存|撤回|故障|空间|quota/i)
  await expect(field(form,'otherComment')).toHaveValue('失败后必须保留的备注')
  await expect(form.locator(`[data-sample-issue-note="${itemId}"]`)).toHaveValue('失败后必须保留的具体问题')
  expect(await storage(page)).toEqual(beforeOpinion)
  expect((await read(page)).suggestionVersions).toHaveLength(0)
  const failureImage=testInfo.outputPath('sample-attachment-failed-input-retained.png')
  await form.screenshot({path:failureImage});await testInfo.attach('sample-attachment-failure',{path:failureImage,contentType:'image/png'})
  await failFiles(page,false)
  await form.getByRole('button',{name:'提交批版建议',exact:true}).click()
  await expect(form).toHaveCount(0)
  const saved=await storage(page)
  expect((await read(page)).suggestionVersions).toHaveLength(1)
  await page.reload();const afterReload=await storage(page)
  expect(afterReload).toEqual(saved)
  expect((await read(page)).suggestionVersions).toHaveLength(1)
  await attachJson(testInfo,'sample-file-failure-atomic-retry',{before,beforeOpinion,saved,afterReload})
})

test('旧未领取记录显式转换后才进入PPIC实收，不补造工厂完成',async({page},testInfo)=>{
  await open(page);const original=await legacyFixture(page,'UNRECEIVED');await page.reload()
  await expect(sampleAction(page,'convert')).toBeVisible()
  await expect(sampleAction(page,'receive-sample')).toHaveCount(0)
  await sampleAction(page,'convert').click()
  await dialog(page,'核对并转换旧样衣记录').getByRole('button',{name:'确认转换并保留历史'}).click();await expect(dialog(page,'核对并转换旧样衣记录')).toHaveCount(0)
  await expect(sampleAction(page,'receive-sample')).toBeVisible()
  const converted=await read(page)
  expect(converted.qualitySchemaVersion).toBe(1);expect(converted.sample.status).toBe('WAITING_PPIC_RECEIVE')
  expect(converted.legacyHistory.original).toEqual(original)
  expect(converted.sample.ppicReceivedAt).toBeUndefined()
  await page.reload();expect((await read(page)).legacyHistory.original).toEqual(original)
  await attachJson(testInfo,'legacy-unreceived-explicit-conversion',{fixture:'通过原库事务预装旧未领取格式，不代表真实工厂完成或收样',original,converted,persisted:await storage(page)})
})

test('旧已领取无快照显式补定，原领取人/墙上时间保留，不能把旧时间推定为新时效',async({page},testInfo)=>{
  await page.clock.setFixedTime(new Date('2026-10-22T01:00:00Z'));await open(page)
  const original=await legacyFixture(page,'CLAIMED');await page.reload();await tab(page,'PENDING_APPROVAL')
  await sampleAction(page,'convert').click();await dialog(page,'核对并转换旧样衣记录').getByRole('button',{name:'确认转换并保留历史'}).click();await expect(dialog(page,'核对并转换旧样衣记录')).toHaveCount(0)
  const converted=await read(page)
  expect(converted.currentApproverId).toBe(original.currentApproverId)
  expect(converted.sample.approverReceivedAt).toBe('2026-10-16 15:15:00')
  expect(converted.sample.approverReceivedInstant).toBeUndefined()
  await expect(row(page)).toContainText('旧时间来源待核对')
  await sampleAction(page,'supplement-standard').click()
  const form=dialog(page,'补定本次检查要求')
  await field(form,'supplementReason').fill('')
  await form.getByRole('button',{name:'明确补定本次要求'}).click();await expect(form.getByRole('alert')).toContainText('原因')
  await field(form,'supplementReason').fill('旧单无检查快照，本次依据有效标准补定并保留原领取事实')
  await form.getByRole('button',{name:'明确补定本次要求'}).click();await expect(form).toHaveCount(0)
  const supplemented=await read(page)
  expect(supplemented.inspectionStandardSnapshot.context.sourceKind).toBe('PRE_PRODUCTION_SAMPLE')
  expect(supplemented.currentApproverId).toBe(original.currentApproverId)
  expect(supplemented.sample.approverReceivedAt).toBe(original.sample.approverReceivedAt)
  expect(supplemented.standardSupplement.reason).toContain('旧单无检查快照')
  const opinion=await fillOpinion(page,independent,'遗留批版人员')
  await field(opinion,'conclusion').selectOption('NO_PROBLEM')
  await opinion.getByRole('button',{name:'提交批版建议',exact:true}).click();await expect(opinion).toHaveCount(0)
  await page.reload();await tab(page,'PENDING_FEEDBACK')
  const final=await read(page)
  expect(final.currentApproverId).toBe(original.currentApproverId);expect(final.suggestionVersions).toHaveLength(1)
  expect(final.legacyHistory.original).toEqual(original)
  await attachJson(testInfo,'legacy-claimed-standard-supplement',{fixture:'原库事务隔离旧已领取事实；转换、补定及意见由页面完成',original,converted,supplemented,final,persisted:await storage(page)})
})

test('旧已有意见保留原文/图片并仅沿原反馈结束，不产生再次批版',async({page},testInfo)=>{
  await open(page);const original=await legacyFixture(page,'SUGGESTION');await page.reload();await tab(page,'PENDING_FEEDBACK')
  await sampleAction(page,'convert').click();await dialog(page,'核对并转换旧样衣记录').getByRole('button',{name:'确认转换并保留历史'}).click();await expect(dialog(page,'核对并转换旧样衣记录')).toHaveCount(0)
  const converted=await read(page)
  expect(converted.suggestionVersions).toHaveLength(1)
  expect(converted.suggestionVersions[0].structuredComments).toEqual(original.suggestionVersions[0].structuredComments)
  expect(converted.suggestionVersions[0].approvalSheetPhotoUrls).toEqual(original.suggestionVersions[0].approvalSheetPhotoUrls)
  expect(converted.suggestionVersions[0].requiresAnotherApproval).toBeUndefined()
  expect(converted.legacyHistory.original.suggestionVersions[0].requiresAnotherApproval).toBe(true)
  await sampleAction(page,'show-card').click()
  const card=page.locator('[data-sample-approval-screenshot-card]')
  await expect(card).toContainText('旧工艺意见原文');await expect(card.getByText('转换前历史原文与附件')).toBeVisible()
  await dialog(page,'批版建议卡').getByRole('button',{name:'关闭',exact:true}).click()
  await sampleAction(page,'feedback-factory').click();await expect(page.getByRole('status')).toContainText('已登记截图反馈时间和责任人');await tab(page,'COMPLETED')
  await expect(row(page)).toContainText('已反馈工厂')
  await expect(sampleAction(page,'start-approval')).toHaveCount(0);await expect(sampleAction(page,'open-approval')).toHaveCount(0)
  const final=await read(page);expect(final.suggestionVersions).toHaveLength(1);expect(final.sample.roundNo).toBeUndefined()
  await attachJson(testInfo,'legacy-opinion-single-feedback',{fixture:'原库事务隔离旧意见与再批标记；不假称历史照片为新上传',original,converted,final,persisted:await storage(page)})
})

test('连续48h跨周末边界和工厂时区显示：到期不超时，超过1秒标红',async({page},testInfo)=>{
  await page.clock.setFixedTime(new Date(claimAt));await open(page)
  // 此单的实收与转交来自页面公开静态场景；本例只验实际UI领取与时效，不冒称执行前两步。
  await claim(page,handedFixture,'时效边界批版人')
  const claimed=await read(page,handedFixture)
  await expect(row(page,handedFixture)).toContainText('领取：2026-10-16 15:15:00')
  await expect(row(page,handedFixture)).toContainText('截止：2026-10-18 15:15:00 Asia/Jakarta')
  await page.clock.setFixedTime(new Date(dueAt));await page.reload();await tab(page,'PENDING_APPROVAL')
  await expect(row(page,handedFixture).locator('p').filter({hasText:'截止：'})).not.toHaveClass(/text-red-700/)
  await page.clock.setFixedTime(new Date('2026-10-18T08:15:01.000Z'));await page.reload();await tab(page,'PENDING_APPROVAL')
  await expect(row(page,handedFixture).locator('p').filter({hasText:'截止：'})).toHaveClass(/text-red-700/)
  const timing=await page.evaluate(async({paths,id})=>{const api=await import(paths.samples);const record=api.getSewingSampleApprovalRecord(id);return{exact:api.getSampleApprovalTiming(record,'2026-10-18T08:15:00Z'),late:api.getSampleApprovalTiming(record,'2026-10-18T08:15:01Z'),browserTimeZone:Intl.DateTimeFormat().resolvedOptions().timeZone}},{paths:await livePaths(page),id:handedFixture})
  expect(timing.browserTimeZone).toBe('America/Los_Angeles')
  expect(timing.exact.overdue).toBe(false);expect(timing.late.overdue).toBe(true)
  expect(timing.exact.deadlineAt).toBe('2026-10-18 15:15:00')
  await attachJson(testInfo,'sample-48h-factory-time-boundaries',{fixture:'已转交静态场景；真实UI领取；Playwright固定时钟，不是现场耗时',claimed,timing})
})

test('原配置页发布正式类别附加标准后产前版领取固定，三成衣入口使用同一正式类别',async({page},testInfo)=>{
  await open(page)
  const original=await read(page)
  const formal=await page.evaluate(async({paths,styleCode})=>{
    const context=await import(paths.styleContext);await context.prepareQualityInspectionScopeIdentityAliases()
    return context.resolveQualityStyleContext({styleCode})
  },{paths:await livePaths(page),styleCode:original.sample.styleCode})
  expect(formal.styleId).toBeTruthy();expect(formal.styleCategory).toBeTruthy()
  expect(formal.styleCategoryAliases).toContain(formal.styleCategory)
  const standardName='样衣专项正式类别附加标准',criterion='三成衣入口统一采用本类别胸围附加要求'
  await page.goto('/fcs/quality-management/additional-standards')
  await page.locator('[data-qm-action="new"]').click();await expect(page.locator('[data-qm-editor]')).toBeVisible()
  const draftId=new URL(page.url()).pathname.split('/').at(-2)!
  await page.locator('[data-qm-edit="name"]').fill(standardName)
  for(const kind of ['PRODUCTION_RETURN','WAREHOUSE_STOCK','PRE_PRODUCTION_SAMPLE'])await page.locator(`[data-qm-array="applicability.sourceKinds"][value="${kind}"]`).check()
  await page.locator('[data-qm-edit="level"]').selectOption('STYLE_CATEGORY')
  await page.locator('[data-qm-list="applicability.styleCategories"]').fill(formal.styleCategory!)
  await page.locator('[data-qm-list="applicability.styleIds"]').fill('')
  await page.locator('[data-qm-action="add-item"]').click()
  for(const [name,value] of [['dimension','缝制工艺'],['name','本类别额外加固检查'],['content','检查此类别指定加固点'],['criterion','按此类别附加要求核对加固完整']])await page.locator(`[data-qm-edit="items.0.${name}"]`).fill(value)
  await page.locator('[data-qm-action="add-override"]').click()
  await page.locator('[data-qm-edit="overrides.0.targetItemId"]').selectOption('garment-size-chest')
  await page.locator('[data-qm-edit="overrides.0.values.criterion"]').fill(criterion)
  await page.locator('[data-qm-action="save"]').click();await expect(page.locator('[data-qm-feedback]')).toContainText('草稿已保存')
  await page.locator('[data-qm-action="publish"]').click();await page.locator('[data-qm-action="confirm-publish"]').click()
  await expect(page).toHaveURL(new RegExp(`/additional-standards/${draftId}$`))
  const published=await page.evaluate(async({paths,id})=>{const quality=await import(paths.quality);await quality.ensureQualityManagementConfiguration();return quality.getQualityConfiguration(id)},{paths:await livePaths(page),id:draftId})
  expect(published.status).toBe('EFFECTIVE');expect(published.level).toBe('STYLE_CATEGORY')
  expect(published.applicability.styleCategories).toEqual([formal.styleCategory])
  await page.goto(route);await expect(page.locator('[data-sample-approval-page]')).toBeVisible()
  await tab(page,'PENDING_RETURN');await receive(page);await handoffAndClaim(page)
  const claimed=await read(page),snapshot=claimed.inspectionStandardSnapshot
  expect(snapshot.additionalStandards.some((standard:any)=>standard.id===draftId)).toBe(true)
  expect(snapshot.context.styleId).toBe(formal.styleId);expect(snapshot.context.styleCode).toBe(formal.styleCode)
  expect(snapshot.context.styleCategoryAliases).toEqual(formal.styleCategoryAliases)
  expect(snapshot.items.find((item:any)=>item.id==='garment-size-chest').criterion).toBe(criterion)
  const addedId=published.items[0].id
  expect(snapshot.items.find((item:any)=>item.id===addedId).name).toBe('本类别额外加固检查')
  expect(snapshot.items.some((item:any)=>item.id==='garment-clean')).toBe(true)
  expect(snapshot.ruleSnapshot).toBeNull()
  const threeEntries=await page.evaluate(async({paths,formal})=>{
    const quality=await import(paths.quality),context=await import(paths.styleContext)
    const stages={PRODUCTION_RETURN:'POST_FINISHING_QC',WAREHOUSE_STOCK:'WAREHOUSE_STOCK_QC',PRE_PRODUCTION_SAMPLE:'PRE_PRODUCTION_SAMPLE_APPROVAL'}
    return Promise.all(Object.entries(stages).map(async([sourceKind,stage])=>{
      const identity=context.resolveQualityStyleContext({styleId:formal.styleId,styleCode:formal.styleCode})
      const snapshot=await quality.readInspectionSnapshot({sourceKind,stage,objectType:'GARMENT',...identity})
      return {sourceKind,identity,snapshot}
    }))
  },{paths:await livePaths(page),formal})
  for(const entry of threeEntries){
    expect(entry.identity).toEqual(formal)
    expect(entry.snapshot.additionalStandards.some((standard:any)=>standard.id===draftId)).toBe(true)
    expect(entry.snapshot.items.find((item:any)=>item.id==='garment-size-chest').criterion).toBe(criterion)
    expect(entry.snapshot.items.find((item:any)=>item.id===addedId)).toBeTruthy()
  }
  const form=await fillOpinion(page)
  await form.locator(`[data-sample-issue-id="${addedId}"]`).check()
  await form.locator(`[data-sample-issue-note="${addedId}"]`).fill('按本类别额外加固要求发现本件加固不足')
  await form.getByRole('button',{name:'提交批版建议',exact:true}).click();await expect(form).toHaveCount(0)
  await page.reload();await tab(page,'PENDING_FEEDBACK')
  const saved=await read(page)
  expect(saved.inspectionStandardSnapshot.id).toBe(snapshot.id)
  expect(saved.suggestionVersions[0].issues).toEqual([{itemId:addedId,note:'按本类别额外加固要求发现本件加固不足'}])
  await attachJson(testInfo,'sample-published-category-standard-real-ui',{fixture:'原配置页面真实新增/编辑/保存/明确生效；原PP页实收、转交、领取和意见；三入口只读标准API核对不冒充另两执行UI',formal,published,claimed,threeEntries,saved,persisted:await storage(page)})
})

for(const kind of ['NEXT_RECEIVED','NEXT_CLAIMED'] as const)test(`旧再批下一件${kind==='NEXT_RECEIVED'?'已实收':'已领取'}原页转换保留当前件，旧意见只归档且无悬空指针`,async({page},testInfo)=>{
  await open(page)
  const original=await legacyFixture(page,kind);await page.reload();await tab(page,'PENDING_APPROVAL')
  await sampleAction(page,'convert').click()
  await dialog(page,'核对并转换旧样衣记录').getByRole('button',{name:'确认转换并保留历史'}).click()
  await expect(dialog(page,'核对并转换旧样衣记录')).toHaveCount(0)
  const converted=await read(page)
  expect(converted.sample.status).toBe(kind==='NEXT_RECEIVED'?'PPIC_RECEIVED':'APPROVAL_IN_PROGRESS')
  expect(converted.sample.ppicReceivedAt).toBe(original.sample.ppicReceivedAt)
  expect(converted.sample.ppicReceivedSamplePhotoUrls).toEqual(original.sample.ppicReceivedSamplePhotoUrls)
  expect(converted.sample.roundNo).toBeUndefined();expect(converted.latestSuggestionVersionId).toBeUndefined()
  expect(converted.suggestionVersions).toHaveLength(0)
  expect(converted.legacyHistory.original).toEqual(original)
  expect(converted.legacyHistory.original.suggestionVersions[0].approvalSheetPhotoUrls).toEqual(original.suggestionVersions[0].approvalSheetPhotoUrls)
  if(kind==='NEXT_CLAIMED'){
    expect(converted.currentApproverId).toBe(original.currentApproverId);expect(converted.currentApproverName).toBe(original.currentApproverName)
    expect(converted.sample.approverReceivedAt).toBe(original.sample.approverReceivedAt)
    await expect(sampleAction(page,'supplement-standard')).toBeVisible();await expect(sampleAction(page,'start-approval')).toHaveCount(0)
  }else{
    expect(converted.currentApproverId).toBeUndefined();await expect(sampleAction(page,'handoff-approver')).toBeVisible()
  }
  await sampleAction(page,'show-card').click();await expect(page.locator('[data-sample-approval-screenshot-card]')).toContainText('转换前历史原文与附件')
  await expect(page.locator('[data-sample-approval-screenshot-card]')).toContainText('尚未提交批版意见')
  await dialog(page,'批版建议卡').getByRole('button',{name:'关闭',exact:true}).click()
  await page.reload();await tab(page,'PENDING_APPROVAL')
  const refreshed=await read(page)
  expect(refreshed.sample.sampleId).toBe(original.sample.sampleId);expect(refreshed.sample.status).toBe(converted.sample.status)
  expect(refreshed.latestSuggestionVersionId).toBeUndefined();expect(refreshed.suggestionVersions).toHaveLength(0)
  expect(refreshed.legacyHistory.original).toEqual(original)
  await attachJson(testInfo,`legacy-${kind.toLowerCase()}-current-physical`,{fixture:'原库显式预装旧round2已发生实物/领取；只转换动作通过真实原页；不是重新送样或工厂操作现场证明',original,converted,refreshed,persisted:await storage(page)})
})

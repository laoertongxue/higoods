import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { chromium } from 'playwright'

const base = process.env.WOOL_BASE_URL || 'http://127.0.0.1:4186'
const output = process.env.WOOL_PERF_OUTPUT || 'docs/product-design/wool-two-stage-adjustment/evidence/acceptance-500/extra-action-performance.json'
const storeKey = 'higood-fcs-wool-stage-store-v3'
const completionId = 'WOOL-STAGE-004:KNITTING'
const machineOrderId = 'WOOL-STAGE-002:KNITTING'
const correctionId = 'WOOL-STAGE-003:KNITTING'
const session = { userId: 'OWN_WOOL_FACTORY_operator', loginId: 'OWN_WOOL_FACTORY_operator', userName: '周哥毛织厂_操作工', roleId: 'ROLE_OPERATOR', factoryId: 'OWN_WOOL_FACTORY', factoryName: '周哥毛织厂', loggedAt: '2026-09-18 10:00:00' }
const buildHash = () => createHash('sha256').update(fs.readFileSync('dist/index.html')).digest('hex')
const q = selector => `document.querySelector(${JSON.stringify(selector)})`
const visible = selector => `(${q(selector)} && ${q(selector)}.getBoundingClientRect().width > 0 && ${q(selector)}.getBoundingClientRect().height > 0)`
const absent = selector => `!${q(selector)}`
const action = (name, id) => `[data-wool-work-orders-action="${name}"]${id ? `[data-wool-order-id="${id}"]` : ''}`
const facts = `JSON.parse(localStorage.getItem(${JSON.stringify(storeKey)}) || 'null')`
const completions = `${facts}?.completions.filter(row => row.woolOrderId === ${JSON.stringify(completionId)})`
const noneCompleted = `${completions}?.length === 0`
const rowText = orderNo => `[...document.querySelectorAll('tbody tr')].find(row => row.textContent.includes(${JSON.stringify(orderNo)}))?.textContent`
const webDialog = '[data-wool-business-dialog]'
const pdaOverlay = '[data-pda-wool-overlay-root]'
const machineDialog = '[data-wool-machine-association-dialog]'

const definitions = {
  'Web完单打开': '004 完单核对弹窗、可保存按钮、备注字段均出现；无完单事实。',
  'Web完单取消': '取消后弹窗消失，004 完单入口仍在；完整毛织事实与取消前完全一致。',
  'Web完单重新打开': '再次出现同一 004 完单核对弹窗；仍无完单事实。',
  'Web完单备注输入': '备注字段显示本次输入；最终保存另核对持久化备注。',
  'Web完单保存': '弹窗关闭、004 行显示已完成、完单入口消失；唯一完单事实的备注与输入相同。',
  'PDA完单打开': '004 完成加工单二次确认出现且可保存；无完单事实。',
  'PDA完单取消': '二次确认关闭，004 完单入口仍在；完整毛织事实与取消前完全一致。',
  'PDA完单重新打开': '再次出现同一 004 二次确认；仍无完单事实。',
  'PDA完单备注输入': '备注字段显示本次输入；最终保存另核对持久化备注。',
  'PDA完单保存': '二次确认关闭、004 页面显示已完成、完单入口消失；唯一完单事实含备注及当前操作人。',
  'Web设备关联打开': '从 002 列表真实设备入口切换页面，关联弹窗锁定 002；WM-003 未选、WM-007 维修禁选。',
  'Web设备关联选择': '选择 WM-003 后实际对话框替换完毕并保持勾选；事实尚未写入，WM-007 仍禁选。',
  'Web设备关联保存': '关联弹窗关闭、保存成功反馈可读；002 与 WM-003 唯一关联已持久化。',
  'Web数量记录打开': '003 数量记录弹窗打开，真实加工填报记录修改入口可见。',
  'Web数量编辑打开': '真实填报记录的数量、原因及保存控件出现。',
  'Web数量更正输入': '数量字段实际变为 35。',
  'Web数量更正原因输入': '原因字段显示本次输入；最终保存另核对日志原因。',
  'Web数量更正保存': '弹窗关闭、成功反馈及 003 行数量 35 可读；横机/缝盘有效填报、内部接收、自动交出均为 35，修改原因已保存。',
}
const report = {
  buildIndexSha256: buildHash(), at: new Date().toISOString(), base,
  branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), cwd: process.cwd(),
  scope: 'Four named real-UI flows only. Interaction measurements, not route-load measurements or overall performance acceptance.',
  measurement: 'Capture click/input/change before application handlers; end only after the named real result, visible image decode, and two animation frames. Every raw sample must be <500ms.',
  conditions: 'Five independent new contexts per flow; normal full prototype data; no request stubs, source-module imports, fact injection, module prewarming, or application-data clearing. Only the real PDA factory session is initialized. Initial navigation is setup outside interaction timing.',
  uncovered: ['Route cold-load/refresh timings', 'Other resolutions', 'Equipment transfer/release and unavailable-device submission', 'Invalid/already-completed order completion', 'Quantity correction after downstream consumption'],
  definitions: Object.fromEntries(Object.entries(definitions).map(([name, finish]) => [name, { finish }])),
  actions: Object.fromEntries(Object.keys(definitions).map(name => [name, []])), errors: [],
}
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2))
let currentSample

async function measure(page, name, operation, ready, type = 'click') {
  report.definitions[name].event = type
  report.definitions[name].predicate = ready
  await page.evaluate(({ ready, type, storeKey }) => {
    window.__woolExtraActionTiming = undefined
    const ctx = { dialog: document.querySelector('[data-wool-machine-association-dialog]'), storeBefore: localStorage.getItem(storeKey) }
    const test = new Function('ctx', `return Boolean(${ready})`)
    document.addEventListener(type, () => {
      const start = performance.now()
      let pending = false, finished = false
      const observer = new MutationObserver(check)
      function check() {
        if (pending || finished) return
        try { if (!test(ctx)) return } catch { return }
        pending = true
        const images = [...document.images].filter(img => {
          const r = img.getBoundingClientRect()
          return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0
        })
        Promise.all(images.map(img => img.decode())).then(() => requestAnimationFrame(() => requestAnimationFrame(() => {
          if (!test(ctx)) { pending = false; check(); return }
          finished = true
          observer.disconnect()
          const ms = performance.now() - start
          const broken = [...document.querySelectorAll('[data-pda-image-preview-url]')].filter(el => {
            const r = el.getBoundingClientRect()
            return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0 && el.querySelector('img') && !el.querySelector('img').naturalWidth
          })
          window.__woolExtraActionTiming = { ms, pass: ms < 500 && broken.length === 0, imageCount: images.length, visibleImageFailures: broken.length }
        }))).catch(error => {
          finished = true
          observer.disconnect()
          window.__woolExtraActionTiming = { error: String(error), pass: false }
        })
      }
      observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true })
      queueMicrotask(check)
    }, { once: true, capture: true })
  }, { ready, type, storeKey })
  try {
    await operation()
    await page.waitForFunction(() => window.__woolExtraActionTiming, null, { timeout: 10000 })
    const result = await page.evaluate(() => window.__woolExtraActionTiming)
    report.actions[name].push({ ...currentSample, ...result })
    if (result.error) throw new Error(result.error)
  } catch (error) {
    if (!report.actions[name].some(sample => sample.iteration === currentSample.iteration)) {
      report.actions[name].push({ ...currentSample, error: String(error), pass: false })
    }
    throw error
  }
}
const click = (page, name, selector, ready) => measure(page, name, () => page.locator(selector).first().click(), ready)
const fill = (page, name, selector, value) => measure(page, name, () => page.locator(selector).fill(value), `${q(selector)}?.value === ${JSON.stringify(value)}`, 'input')

async function webCompletion(page) {
  await page.goto(`${base}/fcs/craft/wool/knitting-orders`)
  const open = action('open-complete', completionId)
  await page.locator(open).waitFor()
  const remark = '[data-wool-dialog-field="remark"]'
  const ready = `${visible(webDialog)} && ${q(webDialog + ' h2')}?.textContent === '横机加工单完单确认' && ${q(webDialog)}?.textContent.includes('HJ260918-004') && ${q(remark)} && ${visible(action('save-complete'))} && !${q(action('save-complete'))}.disabled && ${noneCompleted}`
  await click(page, 'Web完单打开', open, ready)
  await measure(page, 'Web完单取消', () => page.locator(webDialog).getByRole('button', { name: '取消', exact: true }).click(), `${absent(webDialog)} && ${visible(open)} && localStorage.getItem(${JSON.stringify(storeKey)}) === ctx.storeBefore && ${noneCompleted}`)
  await click(page, 'Web完单重新打开', open, ready)
  const note = `Web 完单性能核对 ${currentSample.iteration}`
  await fill(page, 'Web完单备注输入', remark, note)
  await click(page, 'Web完单保存', action('save-complete'), `${absent(webDialog)} && ${absent(open)} && ${rowText('HJ260918-004')}?.includes('已完成') && ${completions}?.length === 1 && ${completions}?.[0].remark === ${JSON.stringify(note)}`)
}

async function pdaCompletion(page) {
  await page.goto(`${base}/fcs/pda/exec/TASK-WOOL-STAGE-004%3AKNITTING`)
  const root = '[data-pda-wool-root]'
  const open = '[data-wool-fact-action="COMPLETE"]'
  const submit = '[data-pda-wool-action="save-fact"]'
  const remark = '[data-draft-field="remark"]'
  await page.locator(open).waitFor()
  const ready = `${visible(submit)} && !${q(submit)}.disabled && ${q(pdaOverlay + ' h2')}?.textContent === '完成加工单二次确认' && ${q(root)}?.dataset.woolOrderId === ${JSON.stringify(completionId)} && ${q(remark)} && ${noneCompleted}`
  await click(page, 'PDA完单打开', open, ready)
  await measure(page, 'PDA完单取消', () => page.locator(pdaOverlay).getByRole('button', { name: '取消', exact: true }).click(), `${absent(submit)} && !${q(pdaOverlay)}?.firstElementChild && ${visible(open)} && localStorage.getItem(${JSON.stringify(storeKey)}) === ctx.storeBefore && ${noneCompleted}`)
  await click(page, 'PDA完单重新打开', open, ready)
  const note = `PDA 完单性能核对 ${currentSample.iteration}`
  await fill(page, 'PDA完单备注输入', remark, note)
  await click(page, 'PDA完单保存', submit, `${absent(submit)} && !${q(pdaOverlay)}?.firstElementChild && ${absent(open)} && ${q(root)}?.textContent.includes('已完成') && ${q(root)}?.dataset.woolOrderId === ${JSON.stringify(completionId)} && ${completions}?.length === 1 && ${completions}?.[0].remark === ${JSON.stringify(note)} && ${completions}?.[0].completedBy === ${JSON.stringify(session.userName)}`)
}

async function equipment(page) {
  await page.goto(`${base}/fcs/craft/wool/knitting-orders`)
  const entry = page.locator('tbody tr').filter({ hasText: 'HJ260918-002' }).getByRole('button', { name: '关联横机设备', exact: true })
  await entry.waitFor()
  const target = '[data-wool-machine-associations-dialog-field="woolOrderId"]'
  const checkbox = '[data-wool-machine-associations-machine-id="WM-003"]'
  const repair = '[data-wool-machine-associations-machine-id="WM-007"]'
  const submit = '[data-wool-machine-associations-action="save-association"]'
  const matching = `${facts}?.machineAssociations.filter(row => row.woolOrderId === ${JSON.stringify(machineOrderId)} && row.machineId === 'WM-003')`
  const dialogReady = `${visible(machineDialog)} && ${q(target)}?.value === ${JSON.stringify(machineOrderId)} && ${q(repair)}?.disabled && ${visible(submit)} && !${q(submit)}.disabled`
  await measure(page, 'Web设备关联打开', () => entry.click(), `${dialogReady} && ${q(checkbox)} && !${q(checkbox)}.checked && ${matching}?.length === 0`)
  await measure(page, 'Web设备关联选择', () => page.locator(checkbox).check(), `${dialogReady} && ${q(machineDialog)} !== ctx.dialog && ${q(checkbox)}?.checked && localStorage.getItem(${JSON.stringify(storeKey)}) === ctx.storeBefore && ${matching}?.length === 0`)
  await click(page, 'Web设备关联保存', submit, `${absent(machineDialog)} && ${visible('[data-wool-machine-associations-root]')} && ${q('[data-wool-machine-associations-feedback]')}?.textContent.includes('横机整组关联已保存') && ${matching}?.length === 1`)
}

async function quantityCorrection(page) {
  await page.goto(`${base}/fcs/craft/wool/knitting-orders`)
  const open = action('open-qty-list', correctionId)
  const edit = action('open-qty-edit') + '[data-record-type="PROCESS_REPORT"]'
  const qty = '[data-wool-dialog-field="qty"]'
  const reason = '[data-wool-dialog-field="reason"]'
  await page.locator(open).waitFor()
  await click(page, 'Web数量记录打开', open, `${visible(webDialog)} && ${visible(edit)}`)
  await click(page, 'Web数量编辑打开', edit, `${visible(qty)} && ${visible(reason)} && ${visible(action('save-qty'))}`)
  await fill(page, 'Web数量更正输入', qty, '35')
  const note = `核对实际件数，性能测量 ${currentSample.iteration}`
  await fill(page, 'Web数量更正原因输入', reason, note)
  const correctedFacts = `(() => {
    const store = ${facts}; if (!store) return false;
    const effective = (type, id, baseQty) => store.qtyChangeLogs.filter(log => log.recordType === type && log.recordId === id).reduce((_, log) => log.afterQty, baseQty);
    const reports = store.processReports.filter(row => row.woolOrderId.startsWith('WOOL-STAGE-003:'));
    const internal = store.internalReceipts.filter(row => row.woolOrderId === 'WOOL-STAGE-003:LINKING');
    const handovers = store.handovers.filter(row => row.woolOrderId === ${JSON.stringify(correctionId)});
    return reports.length === 2 && reports.every(row => effective('PROCESS_REPORT', row.reportId, row.reportedQty) === 35)
      && internal.length === 1 && internal[0].qty === 35
      && handovers.length === 1 && effective('HANDOVER', handovers[0].handoverId, handovers[0].handoverQty) === 35
      && store.qtyChangeLogs.some(log => log.recordType === 'PROCESS_REPORT' && reports.some(row => row.woolOrderId === ${JSON.stringify(correctionId)} && row.reportId === log.recordId) && log.afterQty === 35 && log.reason === ${JSON.stringify(note)});
  })()`
  await click(page, 'Web数量更正保存', action('save-qty'), `${absent(webDialog)} && ${q('[data-wool-work-orders-feedback]')}?.textContent.includes('记录数量已修改') && ${rowText('HJ260918-003')}?.includes('35') && ${correctedFacts}`)
}

// Deliberate negative control: normal performance must fail for a visible failed
// thumbnail even when its onerror handler hides the img and only the wrapper remains.
async function hiddenImageFailureProbe(page) {
  await page.route('**/cardigan-sample.jpg', route => route.abort('failed'))
  await page.goto(base + '/fcs/craft/wool/knitting-orders')
  const wrapper = page.locator('[data-pda-image-preview-url="/cardigan-sample.jpg"]').first()
  await wrapper.waitFor()
  await page.waitForFunction(() => [...document.querySelectorAll('[data-pda-image-preview-url="/cardigan-sample.jpg"]')].some(el => el.textContent.includes('图片加载失败') && el.querySelector('img')?.hidden))
  await measure(page, '隐藏失败图片门禁反例', () => page.locator('[data-wool-work-orders-filters] summary').click(), 'document.querySelector("[data-wool-work-orders-filters] details")?.open')
}
if (process.env.WOOL_IMAGE_FAILURE_PROBE === '1') {
  definitions['隐藏失败图片门禁反例'] = 'Visible failed thumbnail wrapper must make normal measurement fail.'
  report.definitions['隐藏失败图片门禁反例'] = { finish: definitions['隐藏失败图片门禁反例'] }
  report.actions['隐藏失败图片门禁反例'] = []
}
const scenarios = process.env.WOOL_IMAGE_FAILURE_PROBE === '1' ? [{ name: '隐藏失败图片门禁反例', run: hiddenImageFailureProbe, viewport: { width:1366,height:768 }, actions: ['隐藏失败图片门禁反例'] }] : [
  { name: 'Web横机004完单', run: webCompletion, viewport: { width: 1366, height: 768 }, actions: Object.keys(definitions).filter(name => name.startsWith('Web完单')) },
  { name: 'PDA横机004完单', run: pdaCompletion, viewport: { width: 360, height: 800 }, actions: Object.keys(definitions).filter(name => name.startsWith('PDA完单')) },
  { name: 'Web横机002设备关联', run: equipment, viewport: { width: 1366, height: 768 }, actions: Object.keys(definitions).filter(name => name.startsWith('Web设备')) },
  { name: 'Web横机003数量更正', run: quantityCorrection, viewport: { width: 1280, height: 720 }, actions: Object.keys(definitions).filter(name => name.startsWith('Web数量')) },
]
const browser = await chromium.launch()
report.browser = browser.version()
try {
  for (const scenario of scenarios) {
    for (let iteration = 1; iteration <= 5; iteration++) {
      currentSample = { flow: scenario.name, iteration, viewport: scenario.viewport }
      const context = await browser.newContext({ viewport: scenario.viewport })
      const page = await context.newPage()
      page.setDefaultTimeout(10000)
      if (scenario.name.startsWith('PDA')) await page.addInitScript(value => localStorage.setItem('fcs_pda_session', JSON.stringify(value)), session)
      page.on('pageerror', error => report.errors.push({ ...currentSample, error: error.message }))
      try { await scenario.run(page) } catch (error) { report.errors.push({ ...currentSample, error: String(error) }) }
      finally {
        for (const name of scenario.actions) {
          if (!report.actions[name].some(sample => sample.iteration === iteration)) report.actions[name].push({ ...currentSample, error: 'Not reached: setup or an earlier action failed.', pass: false })
        }
        await context.close()
        save()
      }
    }
    console.log(scenario.name, 'five independent contexts recorded')
  }
} finally {
  report.finishedAt = new Date().toISOString()
  report.buildIndexSha256After = buildHash()
  if (report.buildIndexSha256After !== report.buildIndexSha256) report.errors.push({ error: 'Build changed during measurement; evidence is invalid.' })
  report.summary = Object.entries(report.actions).map(([name, samples]) => ({
    name, samples: samples.length,
    maxMs: samples.some(sample => !Number.isFinite(sample.ms)) ? null : Math.max(...samples.map(sample => sample.ms)),
    pass: samples.length === 5 && samples.every(sample => sample.pass && Number.isFinite(sample.ms) && sample.ms < 500),
  }))
  report.pass = report.errors.length === 0 && report.summary.length === Object.keys(definitions).length && report.summary.every(item => item.pass)
  save()
  await browser.close()
}
console.log(JSON.stringify({ actions: report.summary.length, samples: Object.values(report.actions).flat().length, failed: report.summary.filter(item => !item.pass).length, errors: report.errors.length, pass: report.pass }))
if (!report.pass) process.exitCode = 1

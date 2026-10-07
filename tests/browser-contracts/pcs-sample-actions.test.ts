import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
const base = process.env.SAMPLE_TEST_URL || 'http://127.0.0.1:4206'
const out = 'docs/reviews/2026-10-07-sample-action-repair/evidence'
// Browser imports below create isolated Mock fixtures and inspect persistence/faults.
// User business actions themselves always run through rendered controls.
for (let iteration = 1; iteration <= 5; iteration++)
  test(`SAMPLE-FIX browser ${iteration}: all routes, actual actions, persistence and <=1s`, {
    timeout: 240000,
  }, async () => {
    const browser = await chromium.launch({ headless: true }),
      context = await browser.newContext({ viewport: { width: 1366, height: 768 } }),
      page = await context.newPage()
    let complete = false
    page.setDefaultTimeout(10000)
    const checks: string[] = [],
      errors: string[] = [],
      samples: Array<{ name: string; ms: number }> = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(() => {
      ;(globalThis as any).__name = (v: unknown) => v
      for (const n of ['click', 'input', 'change'])
        document.addEventListener(
          n,
          () => {
            ;(globalThis as any).__start = performance.now()
          },
          true,
        )
    })
    const check = (ok: boolean, name: string) => {
      assert.ok(ok, name)
      checks.push(name)
    }
    const paint = async () => {
      await page.waitForFunction(
        () =>
          !!document.querySelector('main h1') &&
          [...document.querySelectorAll<HTMLImageElement>('main img')].every(
            (i) => (i.complete && i.naturalWidth > 0) || (i.hidden && !i.nextElementSibling?.hasAttribute('hidden')),
          ),
      )
      await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
    }
    const measure = async (name: string, fromNav = false) => {
      await paint()
      const ms = await page.evaluate((nav) => performance.now() - (nav ? 0 : (globalThis as any).__start), fromNav)
      samples.push({ name, ms })
      console.log(iteration, name)
      check(ms <= 1000, `${name}: ${ms}ms <=1000`)
    }
    const click = async (selector: string, name: string, ready?: () => Promise<unknown>) => {
      await page.locator(selector).first().click()
      if (ready) await ready()
      await measure(name)
    }
    const goto = async (path: string) => {
      await page.goto(base + path)
      await paint()
    }
    const read = async () =>
      page.evaluate(async () => {
        const s = await import('/src/data/pcs-sample-management.ts')
        return {
          requests: s.listPcsSampleRequests(),
          records: s.listPcsSampleRecords(),
          cases: s.listPcsSampleReturnCases(),
          diffs: s.listPcsSampleStocktakeDiffs(),
          ledger: s.listPcsSampleLedgerEvents(),
          transfers: s.listPcsSampleTransfers(),
        }
      })
    const command = async (kind: string, id: string, action: string, expected: string) => {
      await click(
        `[data-sample-workflow-action="${kind}-action"][data-id="${id}"][data-command="${action}"]`,
        `${kind}:${action}:open`,
        () => page.locator('[data-sample-workflow-modal]').waitFor(),
      )
      await page.locator('[data-sample-workflow-field=actor]').fill('页面验收仓管')
      await measure(`${kind}:actor-input`)
      await page.locator('[data-sample-workflow-field=note]').fill(`Mock ${action} 实际操作已确认`)
      await measure(`${kind}:note-input`)
      await page.locator('[data-sample-workflow-action=save-modal]').click()
      if (['cancel', 'reject', 'execute', 'close'].includes(action))
        await click('[data-dialog-confirm]', `${kind}:${action}:danger-confirm`, () =>
          page.locator('[data-sample-workflow-modal]').waitFor({ state: 'detached' }),
        )
      else {
        await page.locator('[data-sample-workflow-modal]').waitFor({ state: 'detached' })
        await measure(`${kind}:${action}:saved`)
      }
      const data = await read()
      const row = (kind === 'request' ? data.requests : kind === 'case' ? data.cases : data.diffs).find(
        (r: any) => (r.requestId || r.caseId || r.diffId) === id,
      ) as any
      check(row.status === expected, `${kind}:${action}:saved readable ${expected}`)
    }
    try {
      const routes = [
        'inventory',
        'application',
        'application/new',
        'application/req-004/edit',
        'application/req-001',
        'transfer',
        'return',
        'ledger',
        'ledger/stocktake',
        'view',
        'detail/smp-001',
        'label/smp-001',
      ]
      const cdp = await context.newCDPSession(page)
      for (const route of routes) {
        await cdp.send('Network.clearBrowserCache')
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
        await page.goto(base + '/pcs/samples/' + route)
        await measure(`cold:${route}`, true)
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: false })
        await page.reload()
        await measure(`reload:${route}`, true)
        await goto('/pcs/samples/' + (route === 'inventory' ? 'application' : 'inventory'))
        await page.evaluate((path) => {
          const a = document.createElement('a')
          a.dataset.nav = path
          a.href = path
          document.querySelector('main')!.append(a)
          a.click()
          a.remove()
        }, '/pcs/samples/' + route)
        await measure(`spa:${route}`)
      }
      const seedCount = await page.evaluate(async () => {
        const d = await import('/src/data/pcs-record-db.ts')
        return (await d.readPcsRecords()).records.length
      })
      check(seedCount === 0, 'opening every route never writes seeds')
      const ids = await page.evaluate(async () => {
        const rt = await import('/src/data/pcs-record-runtime.ts'),
          s = await import('/src/data/pcs-sample-management.ts'),
          t = await import('/src/data/pcs-testing-order-repository.ts')
        await rt.ensurePcsRecordState([s.PCS_SAMPLE_STORAGE_KEY])
        const ids: string[] = []
        await rt.runPcsRecordCommand(
          () => {
            for (let n = 0; n < 14; n++) {
              const o = {
                ...t.listTestingOrders()[0],
                testingOrderId: 'sample-actions-' + n,
                sampleInboundAt: '2026-10-07 09:00:00',
                labeledAt: '',
                skuCodes: ['MOCK-ACTION-' + n + '-blue-m'],
              }
              s.receiveTestingOrderSamples(o, 'Mock 仓管')
              s.labelTestingOrderSample(o, o.skuCodes[0], 'Mock 仓管')
              ids.push(`testing-${o.testingOrderId}-${o.skuCodes[0]}`)
            }
          },
          crypto.randomUUID(),
          [s.PCS_SAMPLE_STORAGE_KEY],
        )
        return ids.reverse()
      })
      await goto('/pcs/samples/application')
      await click('[data-pcs-sample-action=open-create-request]', 'application:new-entry', () =>
        page.locator('[data-sample-request-editor]').waitFor(),
      )
      await click('[data-sample-workflow-action=save-draft]', 'draft:missing-required', () =>
        page.getByText(/未保存：/).waitFor(),
      )
      check((await read()).requests.length === 4, 'missing fields creates no request')
      for (const [field, value] of Object.entries({
        applicant: '页面验收申请人',
        purpose: '直播试穿',
        receiver: '接收人',
        useStartedAt: '2099-10-07T10:00',
        expectedReturnAt: '2099-10-08T18:00',
        remark: '真实 Mock 申请',
      })) {
        await page.locator(`[data-sample-workflow-field=${field}]`).fill(value)
        await measure('draft:input:' + field)
      }
      for (const [field, value] of Object.entries({
        responsibleSite: '深圳样衣间',
        targetLocationId: 'loc-live-01',
        returnLocationId: 'loc-wh-01',
      })) {
        await page.locator(`[data-sample-workflow-field=${field}]`).selectOption(value)
        await measure('draft:select:' + field)
      }
      await click('[data-sample-workflow-action=editor-samples]', 'draft:tab-samples')
      await page.locator('[data-sample-workflow-field=pick-search]').fill('MOCK-ACTION')
      await measure('draft:search-input')
      await click('[data-sample-workflow-action=pick-query]', 'draft:query')
      await page.locator('[data-sample-workflow-field=pick-search]').fill('NO-MATCH-SAMPLE')
      await click('[data-sample-workflow-action=pick-query]', 'draft:no-results')
      check(
        (await page.locator('[data-sample-workflow-field=sample]').count()) === 0,
        'query with no matches shows no choices',
      )
      await page.locator('[data-sample-workflow-field=pick-search]').fill('MOCK-ACTION')
      await click('[data-sample-workflow-action=pick-query]', 'draft:restore-query')
      await click('[data-sample-workflow-action=pick-next]', 'draft:next-page')
      await click('[data-sample-workflow-action=pick-prev]', 'draft:previous-page')
      for (const id of ids.slice(0, 2)) {
        await page.locator(`[data-sample-workflow-field=sample][value="${id}"]`).check()
        await measure('draft:select-sample')
      }
      await page.locator(`[data-sample-workflow-field=sample][value="${ids[1]}"]`).uncheck()
      await measure('draft:unselect-sample')
      await page.locator(`[data-sample-workflow-field=sample][value="${ids[1]}"]`).check()
      await measure('draft:reselect-sample')
      page.once('dialog', (d) => d.dismiss())
      await click('[data-nav="/pcs/samples/application"]', 'draft:stay-with-unsaved-input')
      check((await page.locator('[data-sample-request-editor]').count()) === 1, 'declining discard retains editor')
      await click('[data-sample-workflow-action=editor-info]', 'draft:tab-info')
      check((await page.getByText('样衣清单（2）', { exact: true }).count()) === 1, 'selected count stays accurate')
      await page.screenshot({ path: `${out}/editor-${iteration}.png` })
      // Quota failure must preserve all input and leave no saved request.
      await page.evaluate(() => {
        ;(globalThis as any).__put = IDBObjectStore.prototype.put
        IDBObjectStore.prototype.put = function (...args: any[]) {
          if (this.name === 'records') throw new DOMException('Mock full', 'QuotaExceededError')
          return (globalThis as any).__put.apply(this, args)
        }
      })
      await click('[data-sample-workflow-action=save-draft]', 'draft:quota-failure', () =>
        page.getByText(/未保存：.*空间/).waitFor(),
      )
      check(
        (await page.locator('[data-sample-workflow-field=applicant]').inputValue()) === '页面验收申请人',
        'failed save retains entered fields',
      )
      check((await read()).requests.length === 4, 'failed save persisted no request')
      await page.evaluate(() => {
        IDBObjectStore.prototype.put = (globalThis as any).__put
      })
      await click('[data-sample-workflow-action=save-draft]', 'draft:saved', () =>
        page.locator('[data-sample-request-detail]').waitFor(),
      )
      const id = page.url().split('/').at(-1)!
      check(
        (await read()).records
          .filter((s) => ids.slice(0, 2).includes(s.sampleId))
          .every((s) => s.occupancyType === '无'),
        'draft does not reserve',
      )
      await page.reload()
      await paint()
      check(
        (await read()).requests.find((r) => r.requestId === id)!.sampleIds.length === 2,
        'draft and two sample links survive reload',
      )
      await click('[data-nav$="/edit"]', 'draft:edit-entry', () =>
        page.locator('[data-sample-request-editor]').waitFor(),
      )
      await page.locator('[data-sample-workflow-field=remark]').fill('刷新可读修改')
      await measure('draft:edit-input')
      await click('[data-sample-workflow-action=save-draft]', 'draft:edit-save', () =>
        page.locator('[data-sample-request-detail]').waitFor(),
      )
      for (const [action, status] of [
        ['submit', '待审批'],
        ['approve', '已批准待领用'],
        ['pickup', '使用中'],
        ['return', '归还中'],
        ['receive', '已完成'],
      ]) {
        await command('request', id, action, status)
        await page.reload()
        await paint()
        check((await read()).requests.find((r) => r.requestId === id)!.status === status, action + ' survives reload')
      }
      let data = await read()
      check(
        data.records
          .filter((s) => ids.slice(0, 2).includes(s.sampleId))
          .every((s) => s.status === '在库可用' && s.currentLocationId === 'loc-wh-01'),
        'both samples actually returned and released',
      )
      check(
        data.ledger.filter((e) => e.sampleId === ids[0]).some((e) => e.eventType === '归还'),
        'request receipt reaches ledger',
      )
      await page.screenshot({ path: `${out}/completed-${iteration}.png` })
      // Two isolated draft fixtures exercise reject/cancel via UI, not domain calls.
      const extra = await page.evaluate(async (ids) => {
        const s = await import('/src/data/pcs-sample-management.ts'),
          rt = await import('/src/data/pcs-record-runtime.ts')
        const result: string[] = []
        for (let i = 0; i < 2; i++) {
          const requestId = crypto.randomUUID()
          await rt.runPcsRecordCommand(
            () =>
              s.savePcsSampleRequestDraft({
                requestId,
                responsibleSite: '深圳样衣间',
                sampleIds: [ids[i]],
                purpose: '边界验收',
                applicant: '申请人',
                receiver: '接收人',
                targetLocationId: 'loc-live-01',
                returnLocationId: 'loc-wh-01',
                useStartedAt: '2099-10-07T10:00',
                expectedReturnAt: '2099-10-08T18:00',
                remark: '',
              }),
            crypto.randomUUID(),
            [s.PCS_SAMPLE_STORAGE_KEY],
          )
          result.push(requestId)
        }
        return result
      }, ids)
      for (let i = 0; i < 2; i++) {
        await goto('/pcs/samples/application/' + extra[i])
        await command('request', extra[i], 'submit', '待审批')
        if (i === 1) {
          await page.evaluate(async () => {
            const los = await import('/src/data/los-live-room-master.ts')
            await los.ensureLosLiveRoomState()
            await los.setLiveRoomEnabled('loc-live-01', false, los.losRecordVersion('rooms', 'loc-live-01'))
          })
          await click(
            `[data-sample-workflow-action=request-action][data-id="${extra[i]}"][data-command=approve]`,
            'request:disabled-room-open',
            () => page.locator('[data-sample-workflow-modal]').waitFor(),
          )
          await page.locator('[data-sample-workflow-field=actor]').fill('仓管')
          await click('[data-sample-workflow-action=save-modal]', 'request:disabled-room-blocked', () =>
            page
              .getByText(/未保存：.*停用/)
              .first()
              .waitFor(),
          )
          check(
            (await read()).requests.find((r) => r.requestId === extra[i])!.status === '待审批',
            'disabled room does not allow approval',
          )
          await page.locator('[data-sample-workflow-action=close-modal]').first().click()
          await click('[data-dialog-confirm]', 'request:discard-blocked-input', () =>
            page.locator('[data-sample-workflow-modal]').waitFor({ state: 'detached' }),
          )
        }
        await command('request', extra[i], i ? 'cancel' : 'reject', i ? '已取消' : '已驳回')
        if (i === 1)
          await page.evaluate(async () => {
            const los = await import('/src/data/los-live-room-master.ts')
            await los.ensureLosLiveRoomState()
            await los.setLiveRoomEnabled('loc-live-01', true, los.losRecordVersion('rooms', 'loc-live-01'))
          })
      }
      await goto('/pcs/samples/return')
      await click('[data-sample-workflow-action=create-case]', 'case:new', () =>
        page.locator('[data-sample-workflow-modal]').waitFor(),
      )
      await page.locator('[data-sample-workflow-field=case-sample]').selectOption(ids[2])
      await measure('case:sample-select')
      await page.locator('[data-sample-workflow-field=case-target]').fill('Mock 退货接收方')
      await measure('case:target-input')
      await page.locator('[data-sample-workflow-field=actor]').fill('仓管')
      await page.locator('[data-sample-workflow-field=note]').fill('质量不符')
      await click('[data-sample-workflow-action=save-modal]', 'case:create-save', () =>
        page.locator('[data-sample-workflow-modal]').waitFor({ state: 'detached' }),
      )
      data = await read()
      const c = data.cases.find((c) => c.sampleId === ids[2])!
      check(c.status === '待审批', 'case actually created')
      await click(`[data-pcs-sample-action=select-return-case][data-return-case-id="${c.caseId}"]`, 'case:detail')
      await command('case', c.caseId, 'approve', '待执行')
      await command('case', c.caseId, 'execute', '已结案')
      await page.reload()
      await paint()
      check(
        (await read()).records.find((s) => s.sampleId === ids[2])!.status === '已退货',
        'retired sample persists, no longer borrowable',
      )
      await goto('/pcs/samples/ledger/stocktake')
      await click('[data-pcs-sample-action=select-stocktake][data-stocktake-diff-id="diff-002"]', 'stocktake:detail')
      await command('stocktake', 'diff-002', 'investigate', '处理中')
      await command('stocktake', 'diff-002', 'close', '已关闭')
      await page.reload()
      await paint()
      check(
        (await read()).diffs.find((d) => d.diffId === 'diff-002')!.status === '已关闭',
        'stocktake conclusion persists',
      )
      // Audit each list's live refresh, filters, reset, quick drawer, and view switching.
      const lists = [
        ['inventory', 'select-sample'],
        ['application', 'select-request'],
        ['transfer', 'select-transfer'],
        ['return', 'select-return-case'],
        ['ledger', 'select-ledger'],
        ['ledger/stocktake', 'select-stocktake'],
        ['view', 'select-sample'],
      ]
      for (const [route, action] of lists) {
        await goto('/pcs/samples/' + route)
        assert.equal(await page.locator('[data-pcs-sample-action=reset-filters]').count(), 1, `${route}: one reset button`)
        await click('[data-pcs-sample-action=reload]', route + ':refresh')
        const input = page.locator('[data-pcs-sample-field=search]')
        if (await input.count()) {
          await input.fill('MOCK')
          await measure(route + ':search')
          await click('[data-pcs-sample-action=reset-filters]', route + ':reset')
        }
        const selects = await page.locator('select[data-pcs-sample-field]').evaluateAll((nodes) =>
          nodes.map((n) => ({
            field: (n as HTMLElement).dataset.pcsSampleField!,
            value: (n as HTMLSelectElement).options[1]?.value,
          })),
        )
        for (const s of selects) {
          if (s.value) {
            await page.locator(`[data-pcs-sample-field="${s.field}"]`).selectOption(s.value)
            await measure(route + ':filter:' + s.field)
            await click('[data-pcs-sample-action=reset-filters]', route + ':filter-reset')
          }
        }
        const drawer = page.locator(`[data-pcs-sample-action=${action}]`).first()
        if (await drawer.count()) {
          await click(`[data-pcs-sample-action=${action}]`, route + ':drawer')
          await click('[data-pcs-sample-action=close-drawers]:not([aria-label])', route + ':drawer-close')
        }
        if (route === 'view') {
          await click('[data-pcs-sample-action=set-view-mode][data-view-mode=table]', 'view:table')
          await click('[data-pcs-sample-action=set-view-mode][data-view-mode=card]', 'view:card')
        }
      }
      // One draft is opened in two tabs; only the newer revision may persist.
      const conflictId = await page.evaluate(async (sampleId) => {
        const s = await import('/src/data/pcs-sample-management.ts'),
          rt = await import('/src/data/pcs-record-runtime.ts')
        const requestId = crypto.randomUUID()
        await rt.runPcsRecordCommand(
          () =>
            s.savePcsSampleRequestDraft({
              requestId,
              responsibleSite: '深圳样衣间',
              sampleIds: [sampleId],
              purpose: '并发验收',
              applicant: '申请人',
              receiver: '接收人',
              targetLocationId: 'loc-live-01',
              returnLocationId: 'loc-wh-01',
              useStartedAt: '2099-10-07T10:00',
              expectedReturnAt: '2099-10-08T18:00',
              remark: '',
            }),
          crypto.randomUUID(),
          [s.PCS_SAMPLE_STORAGE_KEY],
        )
        return requestId
      }, ids[0])
      await goto('/pcs/samples/application/' + conflictId + '/edit')
      const second = await context.newPage()
      await second.addInitScript(() => {
        ;(globalThis as any).__name = (v: unknown) => v
      })
      await second.goto(base + '/pcs/samples/application/' + conflictId + '/edit')
      await second.locator('[data-sample-request-editor]').waitFor()
      await page.locator('[data-sample-workflow-field=purpose]').fill('旧标签未保存用途')
      await measure('draft:stale-input')
      await second.locator('[data-sample-workflow-field=purpose]').fill('另一标签保存的新用途')
      await second.locator('[data-sample-workflow-action=save-draft]').click()
      await second.locator('[data-sample-request-detail]').waitFor()
      await click('[data-sample-workflow-action=save-draft]', 'draft:stale-save-blocked', () =>
        page
          .getByText(/未保存：.*(标签页|修改|更新)/)
          .first()
          .waitFor(),
      )
      check(
        (await page.locator('[data-sample-workflow-field=purpose]').inputValue()) === '旧标签未保存用途',
        'conflict preserves current unsaved input',
      )
      await page.locator('[data-sample-workflow-action=reload-workflow]').click()
      await page.locator('[data-dialog-confirm]').waitFor()
      await click('[data-dialog-confirm]', 'draft:reload-after-conflict')
      check(
        (await page.locator('[data-sample-workflow-field=purpose]').inputValue()) === '另一标签保存的新用途',
        'reload shows winner without overwriting it',
      )
      await second.close()
      await page.setViewportSize({ width: 1280, height: 720 })
      await page.screenshot({ path: `${out}/editor-min-${iteration}.png` })
      await goto('/pcs/samples/inventory')
      await click('[data-pda-image-preview-url]', 'image:open', () =>
        page.locator('[data-pda-image-preview-close]').first().waitFor(),
      )
      await click('[data-pda-image-preview-close]:not([aria-label])', 'image:close')
      await page.route('**/assets/**', (route) => route.continue())
      const failedImage = await page.locator('main img').first().getAttribute('src')
      check(!!failedImage, 'sample has a real image source')
      await page.route('**/*', (route) =>
        route.request().url() === new URL(failedImage!, base).href ? route.abort() : route.continue(),
      )
      await cdp.send('Network.clearBrowserCache')
      await page.reload()
      await measure('image:failure-fallback', true)
      check(
        (await page.getByText('图片加载失败', { exact: true }).count()) > 0,
        'failed image displays explicit fallback',
      )
      await page.unroute('**/*')
      await page.reload()
      await measure('image:retry', true)
      check(
        await page
          .locator('main img')
          .first()
          .evaluate((i) => (i as HTMLImageElement).naturalWidth > 0),
        'retry restores image',
      )
      check(errors.length === 0, 'no uncaught browser errors')
      complete = true
    } catch (err) {
      await page.screenshot({ path: `${out}/failure-${iteration}.png` }).catch(() => {})
      console.log(
        'FAILED',
        iteration,
        page.url(),
        await page
          .locator('main')
          .innerText()
          .catch(() => ''),
      )
      throw err
    } finally {
      await mkdir(out, { recursive: true })
      await writeFile(
        `${out}/browser-${iteration}.json`,
        JSON.stringify(
          {
            iteration,
            base,
            viewport: { width: 1366, height: 768 },
            checks,
            errors,
            samples,
            max: Math.max(0, ...samples.map((s) => s.ms)),
            pass: complete && errors.length === 0 && samples.every((s) => s.ms <= 1000),
          },
          null,
          2,
        ),
      )
      await browser.close()
    }
  })

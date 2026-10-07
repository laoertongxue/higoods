import assert from 'node:assert/strict'
import { test } from 'node:test'
import { writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
const base = process.env.SAMPLE_TEST_URL || 'http://127.0.0.1:4206'
const out = 'docs/reviews/2026-10-07-sample-action-repair/evidence'
for (let iteration = 1; iteration <= 5; iteration++)
  test(`SAMPLE-FIX boundary ${iteration}: discard, dispose, retry and expansion`, { timeout: 90000 }, async () => {
    const b = await chromium.launch(),
      c = await b.newContext({ viewport: { width: 1366, height: 768 } }),
      p = await c.newPage(),
      samples: Array<{ name: string; ms: number }> = [],
      checks: string[] = [],
      errors: string[] = []
    await c.addInitScript(() => {
      ;(globalThis as any).__name = (v: unknown) => v
      for (const e of ['click', 'input', 'change'])
        document.addEventListener(
          e,
          () => {
            ;(globalThis as any).__start = performance.now()
            sessionStorage.setItem('__sample_test_perf_epoch', String(performance.timeOrigin + performance.now()))
          },
          true,
        )
    })
    p.setDefaultTimeout(10000)
    p.on('pageerror', (e) => errors.push(e.message))
    let pass = false
    const ready = async () => {
      await p.waitForFunction(
        () =>
          !!document.querySelector('main h1') &&
          [...document.querySelectorAll<HTMLImageElement>('main img')].every((i) => i.complete && i.naturalWidth > 0),
      )
      await p.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
    }
    const measure = async (name: string) => {
      await ready()
      const ms = await p.evaluate(
        () => performance.timeOrigin + performance.now() - Number(sessionStorage.getItem('__sample_test_perf_epoch')),
      )
      samples.push({ name, ms })
      assert.ok(ms <= 1000, `${name}: ${ms}ms`)
    }
    const click = async (selector: string, name: string, done?: () => Promise<unknown>) => {
      await p.locator(selector).first().click()
      if (done) await done()
      await measure(name)
    }
    const act = async (id: string, action: string) => {
      await click(
        `[data-sample-workflow-action=case-action][data-id="${id}"][data-command=${action}]`,
        `dispose:${action}:open`,
      )
      await p.locator('[data-sample-workflow-field=actor]').fill('Mock 仓管')
      await measure('dispose:actor')
      await p.locator('[data-sample-workflow-field=note]').fill('Mock 实际处理结果')
      await measure('dispose:note')
      await p.locator('[data-sample-workflow-action=save-modal]').click()
      if (['reject', 'execute'].includes(action))
        await click('[data-dialog-confirm]', `dispose:${action}:confirm`, () =>
          p.locator('[data-sample-workflow-modal]').waitFor({ state: 'detached' }),
        )
      else {
        await p.locator('[data-sample-workflow-modal]').waitFor({ state: 'detached' })
        await measure(`dispose:${action}:saved`)
      }
    }
    try {
      await p.goto(base + '/pcs/samples/application/new')
      await ready()
      await p.locator('[data-sample-workflow-field=purpose]').fill('暂未保存的用途')
      await measure('editor:unsaved-input')
      await click('[data-sample-workflow-action=editor-cancel]', 'editor:discard-open')
      await click('[data-dialog-cancel]', 'editor:discard-cancel')
      assert.equal(await p.locator('[data-sample-workflow-field=purpose]').inputValue(), '暂未保存的用途')
      checks.push('declining discard retains input')
      await click('[data-sample-workflow-action=editor-cancel]', 'editor:discard-reopen')
      await click('[data-dialog-confirm]', 'editor:discard-confirm', () =>
        p.locator('[data-pcs-sample-page-root]').waitFor(),
      )
      assert.equal(new URL(p.url()).pathname, '/pcs/samples/application')
      checks.push('discard navigates without saving')
      await p.goto(base + '/pcs/samples/application/req-001')
      await ready()
      await click('details summary', 'detail:collapse')
      await click('details summary', 'detail:expand')
      const ids = await p.evaluate(async () => {
        const s = await import('/src/data/pcs-sample-management.ts'),
          t = await import('/src/data/pcs-testing-order-repository.ts'),
          rt = await import('/src/data/pcs-record-runtime.ts')
        const ids: string[] = []
        await rt.runPcsRecordCommand(
          () => {
            for (let n = 0; n < 2; n++) {
              const o = {
                ...t.listTestingOrders()[0],
                testingOrderId: 'dispose-' + n,
                skuCodes: ['DISPOSE-' + n],
                sampleInboundAt: '2026-10-07 09:00:00',
              }
              s.receiveTestingOrderSamples(o, 'Mock')
              s.labelTestingOrderSample(o, o.skuCodes[0], 'Mock')
              ids.push(`testing-${o.testingOrderId}-${o.skuCodes[0]}`)
            }
          },
          crypto.randomUUID(),
          [s.PCS_SAMPLE_STORAGE_KEY],
        )
        return ids
      })
      await p.goto(base + '/pcs/samples/return')
      await ready()
      for (let i = 0; i < 2; i++) {
        await click('[data-sample-workflow-action=create-case]', 'dispose:new')
        await p.locator('[data-sample-workflow-field=case-sample]').selectOption(ids[i])
        await measure('dispose:sample')
        await p.locator('[data-sample-workflow-field=case-type]').selectOption('处置')
        await measure('dispose:type')
        await p.locator('[data-sample-workflow-field=actor]').fill('Mock 仓管')
        await measure('dispose:create-actor')
        await p.locator('[data-sample-workflow-field=note]').fill('破损不可继续使用')
        await measure('dispose:reason')
        await click('[data-sample-workflow-action=save-modal]', 'dispose:create', () =>
          p.locator('[data-sample-workflow-modal]').waitFor({ state: 'detached' }),
        )
        const id = await p.evaluate(
          async (sampleId) =>
            (await import('/src/data/pcs-sample-management.ts'))
              .listPcsSampleReturnCases()
              .find((r) => r.sampleId === sampleId)!.caseId,
          ids[i],
        )
        await click(`[data-pcs-sample-action=select-return-case][data-return-case-id="${id}"]`, 'dispose:drawer')
        if (i === 0) await act(id, 'reject')
        else {
          await act(id, 'approve')
          await act(id, 'execute')
        }
        await p.reload()
        await ready()
        const status = await p.evaluate(
          async (id) => (await import('/src/data/pcs-sample-management.ts')).getPcsSampleById(id)!.status,
          ids[i],
        )
        assert.equal(status, i ? '已处置' : '在库可用')
        checks.push(i ? 'dispose execution ends usability after reload' : 'case rejection restores original usability')
      }
      await p.goto(base + '/pcs/samples/application/new')
      await ready()
      await p.locator('[data-sample-workflow-field=purpose]').fill('读取失败不能丢失的输入')
      await measure('editor:read-failure-input')
      await click('[data-sample-workflow-action=editor-samples]', 'editor:read-failure-picker')
      await p.locator('[data-sample-workflow-field=sample][value=smp-001]').check()
      await measure('editor:read-failure-selected')
      await click('[data-sample-workflow-action=editor-info]', 'editor:read-failure-info')
      await p.evaluate(() => {
        ;(globalThis as any).__editorGetAll = IDBObjectStore.prototype.getAll
        IDBObjectStore.prototype.getAll = function () {
          if (this.name === 'records') throw new DOMException('Mock editor read fault', 'UnknownError')
          return (globalThis as any).__editorGetAll.apply(this, arguments)
        }
      })
      await click('[data-sample-workflow-action=reload-workflow]', 'editor:read-failure-confirm-open')
      await click('[data-dialog-confirm]', 'editor:read-failure', () =>
        p
          .getByText(/重新读取失败/)
          .first()
          .waitFor(),
      )
      assert.equal(await p.locator('[data-sample-workflow-field=purpose]').inputValue(), '读取失败不能丢失的输入')
      assert.match(await p.locator('[data-sample-workflow-action=editor-samples]').innerText(), /（1）/)
      assert.equal(await p.locator('[data-sample-workflow-action=editor-samples]').isDisabled(), true)
      assert.equal(await p.locator('[data-sample-workflow-action=save-draft]').isDisabled(), true)
      await p.locator('[data-sample-workflow-field=purpose]').fill('失败后仍能保留输入')
      await measure('editor:read-failure-continue-input')
      assert.equal(await p.locator('[data-sample-workflow-field=purpose]').inputValue(), '失败后仍能保留输入')
      checks.push(
        'editor read failure retains selected samples and editable unsaved input; dependent commands disabled',
      )
      await p.evaluate(() => {
        IDBObjectStore.prototype.getAll = (globalThis as any).__editorGetAll
      })
      await click('[data-sample-workflow-action=reload-workflow]', 'editor:read-retry-confirm-open')
      await click('[data-dialog-confirm]', 'editor:read-retry')
      assert.equal(await p.locator('[data-sample-workflow-field=purpose]').inputValue(), '')
      checks.push('editor recovers and discards input only after explicit confirmation')
      await p.goto(base + '/pcs/samples/inventory')
      await ready()
      const before = await p.evaluate(async () =>
        JSON.stringify((await (await import('/src/data/pcs-record-db.ts')).readPcsRecords()).records),
      )
      await p.evaluate(() => {
        ;(globalThis as any).__getAll = IDBObjectStore.prototype.getAll
        IDBObjectStore.prototype.getAll = function () {
          if (this.name === 'records') throw new DOMException('Mock read fault', 'UnknownError')
          return (globalThis as any).__getAll.apply(this, arguments)
        }
      })
      await click('[data-pcs-sample-action=reload]', 'refresh:failed', () =>
        p.getByText('资料暂时无法读取', { exact: true }).first().waitFor(),
      )
      await p.evaluate(() => {
        IDBObjectStore.prototype.getAll = (globalThis as any).__getAll
      })
      await click('[data-pcs-storage-retry]', 'refresh:recover-page', () =>
        p.locator('[data-pcs-sample-page-root]').waitFor(),
      )
      await click('[data-pcs-sample-action=reload]', 'refresh:retry', () =>
        p.getByText('已重新读取样衣资料。', { exact: true }).waitFor(),
      )
      const after = await p.evaluate(async () =>
        JSON.stringify((await (await import('/src/data/pcs-record-db.ts')).readPcsRecords()).records),
      )
      assert.equal(after, before)
      checks.push('read failure/retry never changes existing records')
      await click('[data-pcs-sample-action=close-notice]', 'refresh:close-notice')
      assert.deepEqual(errors, [])
      pass = true
    } catch (error) {
      console.log(await p.locator('main').innerText())
      await p.screenshot({ path: `${out}/boundary-failure-${iteration}.png` })
      throw error
    } finally {
      await writeFile(
        `${out}/boundaries-${iteration}.json`,
        JSON.stringify(
          { iteration, base, samples, checks, errors, pass, max: Math.max(0, ...samples.map((s) => s.ms)) },
          null,
          2,
        ),
      )
      await b.close()
    }
  })

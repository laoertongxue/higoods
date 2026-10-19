/**
 * Additional, bounded accessory-flow performance families.
 * The owning collector supplies trusted-event timing, fixed-dist navigation,
 * isolated contexts and readonly persistence assertions. No source-module
 * imports, fixture-file writes, build, or automatic batch runs live here.
 * Web demo-role switches are retired UI families; real PDA session/role and
 * factory-access predicates remain below. Migration/records tests retain the
 * retired maintenance controls' data-protection contracts.
 */
export const ACCESSORY_PERFORMANCE_EXTRA_FAMILIES = [
  ['gtp', '补采GTP排序'],
  ['gtp', '补采GTP拖动列顺序'],
  ['gtp', '补采GTP每页50条'],
  ['gtp', '补采GTP来源库位可用量'],
  ['fcs', '补采FCS只读最重列表投影'],
  ['fcs', '补采FCS只读跟进详情'],
  ['fcs', '补采FCS前往GTP'],
  ['sewing', '补采PPIC补打签发新版本'],
  ['sewing', '补采旧领料凭证PDA阻断'],
  ['sewing', '补采车缝最后领齐保存'],
  ['sewing', '补采D3交出后改厂阻断'],
  ['sewing', '补采FCS实交图片打开'],
  ['sewing', '补采FCS实交图片关闭'],
  ['sewing', '补采PPIC凭证图片打开'],
  ['sewing', '补采PPIC凭证图片失败后重试'],
  ['sewing', '补采PPIC凭证图片关闭'],
  ['sewing', '补采PPIC原生打印就绪'],
  ['sewing', '补采领料凭证新上下文直达'],
  ['post', '补采后道Web刷新'],
  ['post', '补采后道PDA图片打开'],
  ['post', '补采后道PDA图片关闭'],
  ['post', '补采后道PDA刷新'],
  ['post', '补采后道PDA只读角色冷直达'],
  ['post', '补采后道PDA其他工厂冷直达'],
].map(([group, name]) => ({ group, name }))

const GTP = '/wls/accessory-warehouses/gtp/preparation'
const GTP_ROOT = '[data-accessory-preparation-root]'
const GTP_CARD = `${GTP_ROOT} [data-aw-preparation-card]`
const FCS_READ = '/fcs/material-prep/sewing'
const POST_WEB = '/fcs/craft/post-finishing/material-transfers'
const POST_PDA = '/fcs/pda/handover?tab=pickup&materialOrderNo=POST-UI-1'
const PICKUPS = '/wls/accessory-warehouses/hilon/pickups'
const TASKS = '/fcs/sewing-outsourcing/tasks'
const a = (name) => `[data-accessory-action="${name}"]`

function requireValue(value, message) {
  if (!value) throw new Error(message)
}
function sameFacts(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}
async function choose(page, selector, value) {
  // A trusted pointer event starts the clock; option selection is application
  // input without a human reading/filling delay, as in the owning collector.
  const input = typeof selector === 'string' ? page.locator(selector) : selector
  await input.click()
  await input.selectOption(value)
  // Escape is also the product's dialog-cancel key. Tab finishes native-select
  // interaction without accidentally cancelling a modal whose field changed.
  await page.keyboard.press('Tab')
}
async function decoded(image) {
  await image.waitFor({ state: 'visible' })
  await image.evaluate(async (node) => {
    await node.decode()
    if (!node.naturalWidth) throw new Error('Image is not ready')
  })
}
function pdaFixture(source, factoryId, roleId) {
  const fixture = structuredClone(source)
  const sessionKey = 'fcs_pda_session',
    usersKey = 'fcs_pda_user_store_v1'
  const session = JSON.parse(fixture.localStorage?.[sessionKey] || 'null')
  const users = JSON.parse(fixture.localStorage?.[usersKey] || 'null')
  requireValue(session && Array.isArray(users), 'PDA fixture must contain its real user/session records')
  const user = users.find((row) => row.factoryId === factoryId && row.roleId === 'ROLE_ADMIN')
  requireValue(user, `Missing PDA fixture administrator for ${factoryId}`)
  user.roleId = roleId
  Object.assign(session, { factoryId, roleId, userId: user.userId, userName: user.name, loginId: user.loginId })
  if (factoryId !== 'ID-F002') session.factoryName = factoryId
  fixture.localStorage = {
    ...fixture.localStorage,
    [sessionKey]: JSON.stringify(session),
    [usersKey]: JSON.stringify(users),
  }
  return fixture
}
function fixtureWithSnapshot(source, snapshot) {
  const fixture = structuredClone(source)
  const database = fixture.databases.find((row) => row.name === 'higood-cutting-records-v1')
  requireValue(database, 'Missing cutting database in sewing fixture')
  const values = {
    records: snapshot.records,
    commands: snapshot.commands,
    meta: [{ id: 'revision', value: snapshot.revision }],
  }
  for (const [name, records] of Object.entries(values)) {
    if (Array.isArray(database.stores)) {
      const store = database.stores.find((row) => row.name === name)
      requireValue(store, `Missing ${name} fixture store`)
      store.rows = records.map((value) => ({ key: value.id, value }))
    } else database.stores[name] = records
  }
  // Existing fixture files and unrelated stores remain unchanged. These samples
  // use formal static material images, not missing or fabricated attachments.
  return fixture
}

export async function runAccessoryPerformanceExtras(env) {
  const { context, fixtures, db, rows, expect } = env
  const configuredNames = env.extrasNames || process.env.AW_PERF_EXTRAS_NAMES
  const nameList = configuredNames
    ? (Array.isArray(configuredNames) ? configuredNames : configuredNames.split(',')).filter(Boolean)
    : []
  const names = nameList.length ? new Set(nameList) : null
  const wanted = (name) => !names || names.has(name)
  if (names)
    for (const name of names)
      requireValue(
        ACCESSORY_PERFORMANCE_EXTRA_FAMILIES.some((row) => row.name === name),
        `Unknown extra family: ${name}`,
      )
  const configuredGroups = new Set(env.extrasGroups || ['gtp', 'fcs', 'sewing', 'post'])
  const groups = new Set(
    ACCESSORY_PERFORMANCE_EXTRA_FAMILIES.filter((row) => configuredGroups.has(row.group) && wanted(row.name)).map(
      (row) => row.group,
    ),
  )
  const action = async (page, name, trigger, end, options = {}) => {
    if (wanted(name)) return env.action(page, name, trigger, end, options)
    // Only prerequisite operations use this path (e.g. issue V1/V2 before an
    // obsolete-version sample). It is setup, never a fabricated timed sample.
    await trigger()
    if (typeof end === 'string') await page.locator(end).first().waitFor({ state: 'visible' })
    else await end()
    if (options.durable) await options.durable()
  }
  const selectAction = (page, name, selector, value, end, options = {}) =>
    action(page, name, () => choose(page, selector, value), end, {
      type: 'click',
      definition:
        'Trusted native-select pointer → option choice without user delay, application result, required images and two frames',
      ...options,
    })
  const withContext = async (fixture, viewport, run) => {
    const { c, page } = await context(fixture, viewport)
    try {
      await run(page)
    } finally {
      await c.close()
    }
  }
  const setupNav = async (page, route, selector) => {
    await page.goto(env.base + route, { waitUntil: 'commit' })
    await page.locator(selector).first().waitFor({ state: 'visible' })
  }
  const nav = async (page, name, route, end, method = 'goto') => {
    if (wanted(name)) return env.nav(page, name, route, end, method)
    if (method === 'reload') await page.reload({ waitUntil: 'commit' })
    else await page.goto(env.base + route, { waitUntil: 'commit' })
    if (typeof end === 'string') await page.locator(end).first().waitFor({ state: 'visible' })
    else await end()
  }

  if (groups.has('gtp'))
    await withContext(undefined, { width: 1366, height: 768 }, async (page) => {
      await setupNav(page, GTP, GTP_ROOT)
      const firstPage = await page.locator(GTP_CARD).count()
      await selectAction(page, '补采GTP每页50条', '[data-accessory-field="pageSize"]', '50', async () => {
        await expect(page.locator('[data-accessory-field="pageSize"]')).toHaveValue('50')
        await expect.poll(() => page.locator(GTP_CARD).count()).toBeGreaterThan(firstPage)
        const total = await page.locator(GTP_CARD).count()
        requireValue(
          total > firstPage && total <= 50,
          'GTP page-size representative must actually include the complete larger list',
        )
        await expect(page.locator(a('next-page'))).toBeDisabled()
      })
      const sheetNumbers = () =>
        page.locator(GTP_CARD).evaluateAll((cards) =>
          cards.map((card) => {
            const label = [...card.querySelectorAll('header span')].find((node) => node.textContent === '配料单号')
            if (!label?.nextElementSibling) throw Error('Missing visible preparation number')
            return label.nextElementSibling.textContent
          }),
        )
      const identities = await sheetNumbers()
      await choose(page, '[data-accessory-sort-field]', 'number')
      await selectAction(
        page,
        '补采GTP排序',
        '[data-accessory-sort-direction]',
        'asc',
        async () => {
          await expect(page.locator('[data-accessory-sort-field]')).toHaveValue('number')
          await expect(page.locator('[data-accessory-sort-direction]')).toHaveValue('asc')
          await expect
            .poll(sheetNumbers)
            .toEqual([...identities].sort((x, y) => x.localeCompare(y, 'zh-CN', { numeric: true })))
        },
      )
      await page.locator(a('open-column-settings')).click()
      const source = page.locator('[data-standard-list-column-drag][data-drag-source="required"]')
      const target = page.locator('[data-standard-list-column-drag][data-drop-target="source"]')
      await action(
        page,
        '补采GTP拖动列顺序',
        () => source.dragTo(target),
        async () => {
          await expect
            .poll(async () => {
              const names = await page.locator(GTP_CARD).first().locator('thead th').allTextContents()
              const required = names.findIndex((name) => name.includes('计划数量'))
              const source = names.findIndex((name) => name.includes('来源'))
              return required >= 0 && source >= 0 && required < source
            })
            .toBe(true)
          const preference = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('/wls/accessory-warehouses/gtp/preparation:list-columns') || 'null'),
          )
          requireValue(
            preference?.order?.indexOf('required') >= 0 &&
              preference?.order?.indexOf('source') >= 0 &&
              preference.order.indexOf('required') < preference.order.indexOf('source'),
            'Column order is not durable',
          )
        },
        {
          type: 'drop',
          definition:
            'Trusted native drop → column order and preference updated, visible images and two frames; excludes human drag time',
        },
      )
      await page
        .locator(`button${a('close-column-settings')}`)
        .last()
        .click()
      await page.locator('[data-accessory-field="keyword"]').fill('PO-AW-202610-F01')
      await page.locator(a('query')).click()
      await expect(page.locator(GTP_CARD)).toHaveCount(1)
      await page.locator(a('prepare')).click()
      const location = page.getByLabel('拉链来源库位', { exact: true })
      const lineId = await location.getAttribute('data-aw-location')
      // This fixed catalogue has 600 zipper pieces in A-01 and none in A-02.
      await location.selectOption({ label: 'GTP-A-01' })
      await expect(page.locator(`[data-aw-available="${lineId}"]`)).toHaveText('600 条')
      await selectAction(page, '补采GTP来源库位可用量', location, { label: 'GTP-A-02' }, () =>
        expect(page.locator(`[data-aw-available="${lineId}"]`)).toHaveText('0 条'),
      )
    })

  if (groups.has('fcs'))
    await withContext(undefined, { width: 1366, height: 768 }, async (page) => {
      await setupNav(page, FCS_READ, '[data-fcs-accessory-readonly]')
      const before = await page.locator('[data-fcs-accessory-readonly] tbody tr').count()
      await selectAction(
        page,
        '补采FCS只读最重列表投影',
        '[data-fcs-accessory-readonly-field="pageSize"]',
        '50',
        async () => {
          await expect
            .poll(() => page.locator('[data-fcs-accessory-readonly] tbody tr').count())
            .toBeGreaterThan(before)
          const all = await page.locator('[data-fcs-accessory-readonly] tbody tr').count()
          requireValue(all > before && all <= 50, 'FCS projection representative must display its larger complete list')
          await expect(page.locator('[data-fcs-accessory-readonly-action="next-page"]')).toBeDisabled()
        },
        {
          definition:
            'Same readonly source-array/filter/pagination renderer family; page-size50 is the heaviest current list member; query/reset/page functional coverage is retained separately',
        },
      )
      const row = page.locator('[data-fcs-accessory-readonly] tbody tr').filter({ hasText: 'PO-AW-202610-F01' })
      const target = row.locator('button[data-nav*="prepOrderId="]')
      await action(
        page,
        '补采FCS只读跟进详情',
        () => target.click(),
        async () => {
          await expect(page.locator('[data-fcs-accessory-readonly]')).toContainText('PO-AW-202610-F01')
          await expect(page.locator('[data-fcs-accessory-readonly] tbody tr')).toHaveCount(6)
          await expect(page.locator('[data-fcs-accessory-readonly]')).toContainText('配料记录')
        },
      )
      await action(
        page,
        '补采FCS前往GTP',
        () => page.locator(`[data-fcs-accessory-readonly] [data-nav="${GTP}"]`).click(),
        GTP_ROOT,
      )
    })

  if (groups.has('sewing')) {
    const fixture = structuredClone(fixtures.sew)
    fixture.localStorage = {
      ...fixture.localStorage,
      ...pdaFixture(fixtures.post, 'ID-F004', 'ROLE_ADMIN').localStorage,
    }
    await withContext(fixture, { width: 1024, height: 768 }, async (page) => {
      await setupNav(page, PICKUPS, '[data-accessory-pickup-root]')
      await page.locator('[data-accessory-pickup-action="create"]').click()
      await expect(page.getByRole('status')).toContainText('已按有效车缝任务建立')
      const openTask = async () => {
        await setupNav(page, TASKS, '[data-ppic-task-page]')
        await page.locator('[data-ppic-task-field="keyword"]').fill('AW-SEW-A')
        await page.locator('[data-ppic-task-action="query"]').click()
        await expect(page.locator('[data-ppic-task-page] tbody tr')).toHaveCount(1)
      }
      await openTask()
      await page.locator('[data-ppic-task-action="print-pickup"]').click()
      await page.locator('.print-preview-root img').first().waitFor()
      let snapshot = await db(page)
      const first = rows(snapshot, 'sewing-slip').find(
        (row) => row.assignmentId === 'AW-TEST-ASG-0' && row.status === 'CURRENT',
      )
      requireValue(first?.versionNo === 1, 'Initial pickup version is not V1')
      await openTask()
      await action(
        page,
        '补采PPIC补打签发新版本',
        () => page.locator('[data-ppic-task-action="print-pickup"]').click(),
        async () => {
          await expect(page.locator('.print-preview-root')).not.toContainText('打印预览无法生成')
          await expect(page.locator('.print-preview-root')).toContainText('V2')
          await expect(page.locator('.print-preview-root img')).toHaveCount(5)
          await expect(page.locator('[data-real-qr] svg')).toHaveCount(1)
        },
        {
          durable: async () => {
            const versions = rows(await db(page), 'sewing-slip').filter((row) => row.assignmentId === 'AW-TEST-ASG-0')
            requireValue(
              versions.length === 2 &&
                versions.some((row) => row.versionNo === 2 && row.status === 'CURRENT') &&
                versions.some((row) => row.versionNo === 1 && row.status !== 'CURRENT'),
              'Reprint did not persist the new version and retire V1',
            )
          },
        },
      )
      const printRoute = page.url().slice(env.base.length)
      snapshot = await db(page)
      const second = rows(snapshot, 'sewing-slip').find(
        (row) => row.assignmentId === 'AW-TEST-ASG-0' && row.status === 'CURRENT',
      )
      const coldFixture = fixtureWithSnapshot(fixture, snapshot)
      if (['补采PPIC凭证图片打开', '补采PPIC凭证图片失败后重试', '补采PPIC凭证图片关闭'].some(wanted)) {
        const printImage = page.locator('[data-print-image-url]').first()
        await action(
          page,
          '补采PPIC凭证图片打开',
          () => printImage.click(),
          async () => {
            await expect(page.locator('[data-print-large-image-status]')).toHaveText('')
            await decoded(page.getByRole('dialog').locator('img'))
          },
        )
        await action(
          page,
          '补采PPIC凭证图片关闭',
          () => page.locator('[data-print-image-close]').click(),
          () => expect(page.locator('[data-print-image-close]')).toHaveCount(0),
        )
        if (wanted('补采PPIC凭证图片失败后重试')) {
          const imageUrl = await printImage.getAttribute('data-print-image-url')
          const absoluteImageUrl = new URL(imageUrl, env.base).href
          const imageMatch = (url) => url.href === absoluteImageUrl
          await page.route(imageMatch, (route) =>
            route.fulfill({ status: 404, contentType: 'text/plain', body: 'Isolated expected image failure' }),
          )
          try {
            await printImage.click()
            await expect(page.locator('[data-print-large-retry]')).toBeVisible()
          } finally {
            await page.unroute(imageMatch)
          }
          await action(
            page,
            '补采PPIC凭证图片失败后重试',
            () => page.locator('[data-print-large-retry]').click(),
            async () => {
              await expect(page.locator('[data-print-large-image-status]')).toHaveText('')
              await expect(page.locator('[data-print-large-retry]')).toBeHidden()
              await decoded(page.getByRole('dialog').locator('img'))
            },
          )
          await page.locator('[data-print-image-close]').click()
        }
      }
      if (wanted('补采PPIC原生打印就绪')) {
        const beforePrint = await db(page)
        await page.evaluate(() => {
          window.__awExtrasAfterPrint = false
          addEventListener(
            'afterprint',
            () => {
              window.__awExtrasAfterPrint = true
            },
            { once: true },
          )
        })
        await action(
          page,
          '补采PPIC原生打印就绪',
          () => page.locator('[data-print-preview-action="print"]').click(),
          () => page.waitForFunction(() => window.__awExtrasAfterPrint),
          {
            durable: async () =>
              requireValue(sameFacts(await db(page), beforePrint), 'Native print changed business facts'),
          },
        )
      }
      if (wanted('补采领料凭证新上下文直达'))
        await withContext(coldFixture, { width: 1366, height: 768 }, async (cold) => {
          await nav(cold, '补采领料凭证新上下文直达', printRoute, async () => {
            await expect(cold.locator('.print-preview-root')).toContainText('V2')
            await expect(cold.locator('.print-preview-root')).not.toContainText('打印预览无法生成')
            await expect(cold.locator('.print-preview-root img')).toHaveCount(5)
            await expect(cold.locator('[data-real-qr] svg')).toHaveCount(1)
          })
        })
      if (wanted('补采旧领料凭证PDA阻断')) {
        const beforeOld = await db(page)
        await nav(
          page,
          '补采旧领料凭证PDA阻断',
          `/fcs/pda/handover?sewingPickupVersionId=${encodeURIComponent(first.versionId)}`,
          async () => {
            await expect(page.locator('main')).toContainText('该凭证已失效或领料清单已变更')
            await expect(page.locator('[data-pda-handover-action="confirm-sewing-pickup"]')).toHaveCount(0)
            requireValue(sameFacts(await db(page), beforeOld), 'Opening obsolete version changed business facts')
          },
        )
      }
      if (!['补采车缝最后领齐保存', '补采D3交出后改厂阻断', '补采FCS实交图片打开', '补采FCS实交图片关闭'].some(wanted))
        return
      let pickup = rows(await db(page), 'pickup').find((row) => row.assignmentId === 'AW-TEST-ASG-0')
      requireValue(pickup, 'Missing current pickup')
      const pickupRoute = `${PICKUPS}?pickupId=${encodeURIComponent(pickup.id)}&versionId=${encodeURIComponent(second.versionId)}`
      await setupNav(page, pickupRoute, '[data-aw-pickup-qty]')
      // Set up a real prior partial handover, rather than labelling a first full
      // issue as the final instalment. The owning collector already times the
      // partial-success family; this setup is outside the additional sample.
      await page.getByLabel('价格吊牌本次实交', { exact: true }).fill('5')
      await page.getByRole('button', { name: '确认本次实交', exact: true }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      pickup = rows(await db(page), 'pickup').find((row) => row.id === pickup.id)
      requireValue(pickup?.status === '领料中', 'Final-instalment sample requires an actual partial handover')
      await setupNav(page, pickupRoute, '[data-aw-pickup-qty]')
      for (const line of pickup.lines)
        await page.locator(`[data-aw-pickup-qty="${line.id}"]`).fill(String(line.requiredQty - line.handedQty))
      await action(
        page,
        '补采车缝最后领齐保存',
        () => page.getByRole('button', { name: '确认本次实交', exact: true }).click(),
        () => expect(page.getByRole('dialog')).toHaveCount(0),
        {
          durable: async () => {
            const saved = rows(await db(page), 'pickup').find((row) => row.id === pickup.id)
            requireValue(
              saved?.status === '已领料' && saved.lines.every((line) => line.requiredQty === line.handedQty),
              'Final pickup is not durably complete',
            )
          },
        },
      )
      if (['补采FCS实交图片打开', '补采FCS实交图片关闭'].some(wanted)) {
        await setupNav(
          page,
          '/fcs/sewing-outsourcing/material-handover?assignmentId=AW-TEST-ASG-0',
          '[data-sewing-material-page]',
        )
        await action(
          page,
          '补采FCS实交图片打开',
          () => page.locator('[data-sewing-material-action="preview-image"]').first().click(),
          () => decoded(page.getByRole('dialog').locator('img')),
        )
        await action(
          page,
          '补采FCS实交图片关闭',
          () => page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click(),
          () => expect(page.getByRole('dialog')).toHaveCount(0),
        )
      }
      if (!wanted('补采D3交出后改厂阻断')) return
      await setupNav(page, '/fcs/dispatch/workbench?type=NON_SEWING', '[data-unified-field="keyword"]')
      await page.locator('[data-unified-field="keyword"]').fill('PO-AW-SEW-CONTRACT')
      await page.locator('[data-unified-action="open-reassign"][data-task-id="PO-AW-SEW-CONTRACT:CUT_PANEL"]').click()
      await page.locator('[data-unified-field="factoryId"]').selectOption('SEA-CUTTING-002')
      await page.locator('[data-unified-field="price"]').fill('1000')
      await page.locator('[data-unified-field="reassignReason"]').fill('验证实交后改厂阻断')
      await page.locator('[data-unified-action="confirm-dispatch"]').click()
      const beforeD3 = await db(page)
      await action(
        page,
        '补采D3交出后改厂阻断',
        () => page.getByRole('button', { name: '确认提交并冻结价格', exact: true }).click(),
        () =>
          expect(
            page.getByText('已有辅料交给三方或后道，不能按原整包改厂；请先核对实际去向', { exact: true }),
          ).toBeVisible(),
        {
          durable: async () =>
            requireValue(sameFacts(await db(page), beforeD3), 'Blocked D3 reassignment changed business facts'),
        },
      )
    })
  }

  if (groups.has('post')) {
    await withContext(fixtures.post, { width: 1024, height: 768 }, async (page) => {
      await setupNav(page, POST_WEB, '[data-post-material-workspace]')
      await nav(page, '补采后道Web刷新', '', '[data-post-material-workspace]', 'reload')
    })
    await withContext(fixtures.post, { width: 390, height: 844 }, async (page) => {
      await setupNav(page, POST_PDA, '[data-managed-accessory-post-root]')
      await nav(page, '补采后道PDA刷新', '', '[data-managed-accessory-post-root]', 'reload')
      await action(
        page,
        '补采后道PDA图片打开',
        () => page.locator('[data-pda-image-preview-url]').first().click(),
        () => decoded(page.locator('[data-pda-image-preview-root] img')),
      )
      await action(
        page,
        '补采后道PDA图片关闭',
        () => page.locator('[data-pda-image-preview-root]').getByRole('button', { name: '关闭', exact: true }).click(),
        () => expect(page.locator('[data-pda-image-preview-root]')).toHaveCount(0),
      )
    })
    await withContext(
      pdaFixture(fixtures.post, 'ID-F002', 'ROLE_VIEWER'),
      { width: 390, height: 844 },
      async (page) => {
        await nav(page, '补采后道PDA只读角色冷直达', POST_PDA, async () => {
          await expect(page.locator('[data-managed-accessory-post-root]')).toBeVisible()
          await expect(page.locator('[data-pda-post-qty]').first()).toBeDisabled()
          await expect(page.locator('[data-pda-handover-action="confirm-material-inbound"]')).toHaveCount(0)
        })
      },
    )
    await withContext(pdaFixture(fixtures.post, 'ID-F001', 'ROLE_ADMIN'), { width: 390, height: 844 }, async (page) => {
      await nav(page, '补采后道PDA其他工厂冷直达', POST_PDA, async () => {
        await expect(page.locator('[data-managed-accessory-post-access-blocked]')).toContainText(
          '当前账号不属于后道工厂',
        )
        await expect(page.locator('[data-pda-handover-action="confirm-material-inbound"]')).toHaveCount(0)
        await expect(page.getByRole('link', { name: '返回本厂交接' })).toBeVisible()
      })
    })
  }
  return { families: ACCESSORY_PERFORMANCE_EXTRA_FAMILIES.filter((row) => groups.has(row.group) && wanted(row.name)) }
}

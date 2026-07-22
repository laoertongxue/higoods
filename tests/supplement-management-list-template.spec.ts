import { expect, test, type Locator, type Page } from '@playwright/test'

const route = '/fcs/craft/cutting/supplement-management'
const storageKey = 'higood:list-page:/fcs/craft/cutting/supplement-management'
const browserErrors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  await page.addInitScript((key) => {
    const resetMarker = '__supplementListAcceptanceReset'
    if (window.sessionStorage.getItem(resetMarker)) return
    window.localStorage.removeItem(key)
    window.sessionStorage.setItem(resetMarker, 'true')
  }, storageKey)
})

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? []).toEqual([])
})

async function waitForList(page: Page): Promise<void> {
  await expect(page.locator('[data-standard-list-page]')).toBeVisible()
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
}

async function openList(page: Page): Promise<void> {
  await page.goto(route)
  await waitForList(page)
}

async function openReleaseSnapshotCreate(page: Page): Promise<string> {
  await page.goto(`${route}?mode=create&releaseSnapshotId=cpr-target-po-14671-v9`)
  const url = new URL(page.url())
  const snapshotId = url.searchParams.get('releaseSnapshotId') || ''
  expect(snapshotId).not.toBe('')
  return snapshotId
}

test('放行目标快照直接预填多物料多部位缺口且不进入A/B分析', async ({ page }) => {
  await openReleaseSnapshotCreate(page)

  await expect(page.getByText('来源：裁片放行目标快照')).toBeVisible()
  await expect(page.getByText('生产单 PO14671')).toBeVisible()
  await expect(page.getByText('目标依据矩阵版本 V9')).toBeVisible()
  await expect(page.getByText('2026-06-03 17:00:00')).toBeVisible()
  const rows = page.locator('[data-release-snapshot-shortage-row]')
  await expect(rows).toHaveCount(19)
  const bm = rows.filter({ hasText: 'Black' }).filter({ hasText: 'M' }).filter({ hasText: '面料 B · 白色条' })
  await expect(bm).toContainText('前片')
  await expect(bm).toContainText('实际缺片 16 片')
  await expect(bm).toContainText('建议补料 8 件')
  const dxl = rows.filter({ hasText: 'Black' }).filter({ hasText: 'XL' }).filter({ hasText: '面料 D · 灰色条' })
  await expect(dxl).toContainText('袖口')
  await expect(dxl).toContainText('实际缺片 20 片')
  await expect(dxl).toContainText('建议补料 20 件')
  const bPointKeys = await rows.filter({ hasText: 'Black' }).filter({ hasText: '面料 B · 白色条' }).evaluateAll((items) =>
    items.map((item) => item.getAttribute('data-release-snapshot-point-key')),
  )
  expect(bPointKeys).toHaveLength(2)
  expect(bPointKeys[0]).not.toBe(bPointKeys[1])
  await expect(page.getByText('A/B 基准分析')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /生产单 \d+/ })).toHaveCount(0)
})

test('同一快照URL重新初始化时会复查实时有效性且仍可独立创建', async ({ page }) => {
  const snapshotId = 'cpr-target-po-14671-v9'
  await page.goto(`${route}?mode=create&releaseSnapshotId=${snapshotId}`)
  await expect(page.getByText('来源：裁片放行目标快照')).toBeVisible()

  await page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    repository.recordCutOrderReleaseStatusChange({
      eventId: 'browser-stale-target-restore-b',
      cutOrderId: 'cut-14671-b',
      cutOrderNo: 'CUT14671-B',
      status: '持续更新',
      occurredAt: '2026-06-04 07:00:00',
      operator: '裁床主管 王敏',
      reason: '目标确认后恢复裁片单',
    })
    const { appStore } = await import('/src/state/store.ts')
    appStore.navigate(`/fcs/craft/cutting/supplement-management?mode=create&releaseSnapshotId=${encodeURIComponent('cpr-target-po-14671-v9')}&recheck=1`)
  })

  await expect(page.getByText('来源：裁片放行目标快照')).toHaveCount(0)
  await expect(page.getByText('目标依据已过期，请回裁片放行重新确认。')).toBeVisible()
  await page.getByRole('button', { name: '返回独立创建' }).click()
  await expect(page.getByRole('heading', { name: '选择裁片单' })).toBeVisible()
  await expect(page.getByText('裁片单搜索')).toBeVisible()
})

test('快照草稿填写期间过期时直接提交会被即时阻断', async ({ page }) => {
  await openReleaseSnapshotCreate(page)
  await page.locator('[data-supplement-reason]').selectOption('尺码齐套不足')
  await page.locator('[data-supplement-reason-detail]').fill('提交前制造目标过期。')

  await page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    repository.recordCutOrderReleaseStatusChange({
      eventId: 'submit-gap-stale-target',
      cutOrderId: 'cut-14671-b',
      cutOrderNo: 'CUT14671-B',
      status: '持续更新',
      occurredAt: '2026-06-04 07:10:00',
      operator: '裁床主管 王敏',
      reason: '补料草稿提交前目标过期',
    })
  })
  const submitResult = await page.evaluate(async () => {
    const pageModule = await import('/src/pages/process-factory/cutting/supplement-management.ts')
    const button = document.querySelector<HTMLElement>('[data-cutting-supplement-action="submit-release-snapshot-draft"]')
    if (!button) throw new Error('未找到快照补料提交按钮')
    return {
      handled: pageModule.handleCraftCuttingSupplementManagementEvent(button),
      dialogOpen: pageModule.isCraftCuttingSupplementManagementDialogOpen(),
    }
  })

  expect(submitResult).toEqual({ handled: true, dialogOpen: false })
  await page.evaluate(async () => {
    const { appStore } = await import('/src/state/store.ts')
    appStore.navigate('/fcs/craft/cutting/supplement-management?mode=create&releaseSnapshotId=cpr-target-po-14671-v9&submitCheck=1')
  })
  await expect(page.getByRole('heading', { name: '二次确认补料' })).toHaveCount(0)
  await expect(page.getByText('来源：裁片放行目标快照')).toHaveCount(0)
  await expect(page.getByText('目标依据已过期，请回裁片放行重新确认。')).toBeVisible()
  await page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    repository.resetCutPieceReleasePrototypeStoreForTesting()
  })
})

test('快照草稿二次确认期间过期时最终确认不生成补料单', async ({ page }) => {
  await openList(page)
  const initialRecordCount = await page.locator('[data-standard-list-stats] > div').first().locator('strong').textContent()
  await page.evaluate(async () => {
    const { appStore } = await import('/src/state/store.ts')
    appStore.navigate('/fcs/craft/cutting/supplement-management?mode=create&releaseSnapshotId=cpr-target-po-14671-v9')
  })
  await expect(page.getByText('来源：裁片放行目标快照')).toBeVisible()
  await page.locator('[data-supplement-reason]').selectOption('尺码齐套不足')
  await page.locator('[data-supplement-reason-detail]').fill('二次确认前制造目标过期。')
  await page.getByRole('button', { name: '提交补料' }).click()
  await expect(page.getByRole('heading', { name: '二次确认补料' })).toBeVisible()

  await page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    repository.recordCutOrderReleaseStatusChange({
      eventId: 'confirm-gap-stale-target',
      cutOrderId: 'cut-14671-b',
      cutOrderNo: 'CUT14671-B',
      status: '持续更新',
      occurredAt: '2026-06-04 07:20:00',
      operator: '裁床主管 王敏',
      reason: '补料二次确认前目标过期',
    })
  })
  await page.getByRole('button', { name: '确认生成补料单' }).click()

  await expect(page.getByRole('heading', { name: '二次确认补料' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '补料单详情' })).toHaveCount(0)
  await expect(page.getByText('目标依据已过期，请回裁片放行重新确认。')).toBeVisible()
  await page.getByRole('button', { name: '返回独立创建' }).click()
  await page.getByRole('button', { name: '返回补料列表' }).click()
  await expect(page.locator('[data-standard-list-stats] > div').first().locator('strong')).toHaveText(initialRecordCount || '')
  await page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    repository.resetCutPieceReleasePrototypeStoreForTesting()
  })
})

test('独立新增补料直接选择裁片单且不再提供双入口', async ({ page }) => {
  await page.goto(`${route}?mode=create`)
  await expect(page.getByRole('heading', { name: '选择裁片单' })).toBeVisible()
  await expect(page.getByText('裁片单搜索')).toBeVisible()
  await expect(page.getByRole('button', { name: /按生产单选择|按裁片单选择/ })).toHaveCount(0)
  await expect(page.getByText('按生产单或裁片单发起补料')).toHaveCount(0)

  await page.evaluate(() => {
    const main = document.querySelector('main')
    const keywordInput = document.querySelector('[data-cutting-supplement-field="sourcePickerKeyword"]')
    const sourcePicker = keywordInput?.closest('section')
    if (!main || !keywordInput || !sourcePicker) throw new Error('缺少裁片单选择器局部刷新验收区域')
    window.scrollTo(0, 180)
    ;(window as typeof window & {
      __supplementSourcePickerAcceptance?: {
        main: Element
        sourcePicker: Element
        keywordInput: Element
        scrollY: number
      }
    }).__supplementSourcePickerAcceptance = {
      main,
      sourcePicker,
      keywordInput,
      scrollY: window.scrollY,
    }
  })
  const sourcePickerStability = () => page.evaluate(() => {
    const state = (window as typeof window & {
      __supplementSourcePickerAcceptance?: {
        main: Element
        sourcePicker: Element
        keywordInput: Element
        scrollY: number
      }
    }).__supplementSourcePickerAcceptance
    if (!state) throw new Error('缺少裁片单选择器局部刷新验收状态')
    const keywordInput = document.querySelector('[data-cutting-supplement-field="sourcePickerKeyword"]')
    return {
      mainSame: document.querySelector('main') === state.main,
      sourcePickerSame: keywordInput?.closest('section') === state.sourcePicker,
      keywordInputSame: keywordInput === state.keywordInput,
      scrollSame: window.scrollY === state.scrollY,
    }
  })
  const stableSourcePickerResult = {
    mainSame: true,
    sourcePickerSame: true,
    keywordInputSame: true,
    scrollSame: true,
  }

  const candidateRadios = page.locator('[data-cutting-supplement-action="toggle-source-candidate"]')
  await expect(candidateRadios).toHaveCount(12)
  await expect(page.getByText('共 23 条，当前 1-12', { exact: true })).toBeVisible()
  await expect(page.locator('[data-cutting-supplement-field="sourcePickerPageSize"]')).toHaveValue('12')
  await expect(page.getByText('1 / 2', { exact: true })).toBeVisible()
  const firstPageCandidateIds = await candidateRadios.evaluateAll((radios) =>
    radios.map((radio) => radio.getAttribute('data-candidate-id')),
  )
  const nextPageResponseMs = await page.evaluate(() => {
    const nextPageButton = document.querySelector<HTMLButtonElement>('[data-cutting-supplement-action="source-picker-next-page"]')
    if (!nextPageButton) throw new Error('缺少裁片单候选下一页按钮')
    const startedAt = performance.now()
    nextPageButton.click()
    return performance.now() - startedAt
  })
  expect(nextPageResponseMs).toBeLessThan(200)
  await expect(candidateRadios).toHaveCount(11)
  await expect(page.getByText('共 23 条，当前 13-23', { exact: true })).toBeVisible()
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible()
  expect(await sourcePickerStability()).toEqual(stableSourcePickerResult)
  const secondPageCandidateIds = await candidateRadios.evaluateAll((radios) =>
    radios.map((radio) => radio.getAttribute('data-candidate-id')),
  )
  expect(new Set([...firstPageCandidateIds, ...secondPageCandidateIds]).size).toBe(23)
  await page.getByRole('button', { name: '上一页' }).click()
  await expect(page.getByText('1 / 2', { exact: true })).toBeVisible()
  expect(await sourcePickerStability()).toEqual(stableSourcePickerResult)

  const keywordInput = page.locator('[data-cutting-supplement-field="sourcePickerKeyword"]')
  const searchButton = page.getByRole('button', { name: '搜索', exact: true })
  const availableCandidate = page.getByRole('radio', { name: '选择裁片单 CUT14671-A' })
  const searchCases = [
    { field: '裁片单号', keyword: 'CUT14671-A' },
    { field: '生产单号', keyword: 'PO14671' },
    { field: '款式名称', keyword: '女式基础圆领短袖' },
    { field: 'SPU', keyword: 'ASYSA26060310' },
  ]

  for (const searchCase of searchCases) {
    await test.step(`按${searchCase.field}搜索裁片单候选`, async () => {
      await keywordInput.fill(searchCase.keyword)
      expect(await sourcePickerStability()).toEqual(stableSourcePickerResult)
      await searchButton.click()
      await expect(availableCandidate).toBeVisible()
      await expect(availableCandidate.locator('xpath=ancestor::tr')).toContainText(searchCase.keyword)
      expect(await sourcePickerStability()).toEqual(stableSourcePickerResult)
    })
  }

  const availableRow = availableCandidate.locator('xpath=ancestor::tr')
  await expect(page.getByRole('columnheader', { name: '裁片单' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '所属生产单' })).toBeVisible()
  await expect(availableRow.locator('td').nth(4).getByText('PO14671', { exact: true })).toBeVisible()
  await expect(availableRow.locator('td').nth(4).locator('input, select, button')).toHaveCount(0)
  await expect(page.getByRole('radio', { name: /选择生产单/ })).toHaveCount(0)

  await page.getByRole('button', { name: '重置', exact: true }).click()
  await expect(keywordInput).toHaveValue('')
  await expect(page.getByText('共 23 条，当前 1-12', { exact: true })).toBeVisible()
  expect(await sourcePickerStability()).toEqual(stableSourcePickerResult)

  await keywordInput.fill('CUT14671-B')
  await searchButton.click()
  const closedCandidate = page.getByRole('radio', { name: '选择裁片单 CUT14671-B' })
  const closedRow = closedCandidate.locator('xpath=ancestor::tr')
  await expect(closedCandidate).toBeDisabled()
  await expect(closedRow).toContainText('裁片单已关闭，不能新增补料。')
  await expect(page.getByRole('button', { name: '下一步' })).toBeDisabled()

  await keywordInput.fill('CUT14671-A')
  await searchButton.click()
  await availableCandidate.check()
  await expect(availableCandidate).toBeChecked()
  expect(await sourcePickerStability()).toEqual(stableSourcePickerResult)
  await availableCandidate.click()
  await expect(availableCandidate).toBeChecked()
  expect(await sourcePickerStability()).toEqual(stableSourcePickerResult)
  await page.getByRole('button', { name: '下一步' }).click()
  await expect(page.getByRole('heading', { name: '填写补料信息' })).toBeVisible()
  await expect(page.getByText('裁片单 CUT14671-A / PO14671 / 女式基础圆领短袖')).toBeVisible()
  await expect(page.getByText('补料明细与本次补料件数')).toBeVisible()
})

test('无效放行快照给出中文错误并可返回独立创建', async ({ page }) => {
  await page.goto(`${route}?mode=create&releaseSnapshotId=${encodeURIComponent('missing/snapshot')}`)
  await expect(page.getByText('目标依据已过期，请回裁片放行重新确认。')).toBeVisible()
  await page.getByRole('button', { name: '返回独立创建' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/supplement-management\?mode=create$/)
  await expect(page.getByRole('heading', { name: '选择裁片单' })).toBeVisible()
  await expect(page.getByText('裁片单搜索')).toBeVisible()
})

test('快照补料确认后冻结来源与数量且创建补料不改变放行矩阵', async ({ page }) => {
  const snapshotId = await openReleaseSnapshotCreate(page)
  const before = await page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    return {
      matrix: repository.getCutPieceReleaseMatrix('po-14671'),
      versions: repository.listCutPieceReleaseMatrixVersions('po-14671'),
    }
  })

  await page.locator('[data-supplement-reason]').selectOption('尺码齐套不足')
  await page.locator('[data-supplement-reason-detail]').fill('按已确认放行目标补齐裁片。')
  await page.getByRole('button', { name: '提交补料' }).click()
  await page.getByRole('button', { name: '确认生成补料单' }).click()

  await expect(page.getByRole('heading', { name: '补料单详情' })).toBeVisible()
  await expect(page.getByText(`快照编号 ${snapshotId}`)).toBeVisible()
  await expect(page.getByText('目标依据矩阵版本 V9')).toBeVisible()
  await expect(page.getByText('目标确认时间 2026-06-03 17:00:00')).toBeVisible()
  await expect(page.getByText('实际缺片 16 片')).toBeVisible()

  const afterCreate = await page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    return {
      matrix: repository.getCutPieceReleaseMatrix('po-14671'),
      versions: repository.listCutPieceReleaseMatrixVersions('po-14671'),
    }
  })
  expect(afterCreate).toEqual(before)

  await page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    repository.recordCutOrderReleaseStatusChange({
      eventId: 'supplement-snapshot-freeze-check',
      cutOrderId: 'cut-14671-b',
      cutOrderNo: 'CUT14671-B',
      status: '持续更新',
      occurredAt: '2026-06-03 17:00:00',
      operator: '裁床主管 Dewi',
      reason: '验证补料记录不随矩阵变化',
    })
  })
  await expect(page.getByText('目标依据矩阵版本 V9')).toBeVisible()
  await expect(page.getByText('实际缺片 16 片')).toBeVisible()
})

test('创建来源切换会清理旧快照确认草稿与覆盖层', async ({ page }) => {
  await openReleaseSnapshotCreate(page)
  await page.locator('[data-supplement-reason]').selectOption('尺码齐套不足')
  await page.locator('[data-supplement-reason-detail]').fill('待切换来源的旧快照草稿。')
  await page.getByRole('button', { name: '提交补料' }).click()
  await expect(page.getByRole('heading', { name: '二次确认补料' })).toBeVisible()

  await page.evaluate(async () => {
    const { appStore } = await import('/src/state/store.ts')
    appStore.navigate('/fcs/craft/cutting/supplement-management?mode=create')
  })
  await expect(page).toHaveURL(/supplement-management\?mode=create$/)
  await expect(page.getByRole('heading', { name: '二次确认补料' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '选择裁片单' })).toBeVisible()
  await expect(page.getByText('裁片单搜索')).toBeVisible()
  await expect(page.getByRole('button', { name: '确认生成补料单' })).toHaveCount(0)
})

test('快照A切到快照B会清理A草稿并只显示B的结果', async ({ page }) => {
  await openReleaseSnapshotCreate(page)
  await page.locator('[data-supplement-reason]').selectOption('尺码齐套不足')
  await page.locator('[data-supplement-reason-detail]').fill('快照A旧草稿。')
  await page.getByRole('button', { name: '提交补料' }).click()
  await expect(page.getByRole('heading', { name: '二次确认补料' })).toBeVisible()

  await page.evaluate(async () => {
    const { appStore } = await import('/src/state/store.ts')
    appStore.navigate('/fcs/craft/cutting/supplement-management?mode=create&releaseSnapshotId=missing-B')
  })
  await expect(page.getByText('目标依据已过期，请回裁片放行重新确认。')).toBeVisible()
  await expect(page.getByRole('heading', { name: '二次确认补料' })).toHaveCount(0)
  await expect(page.getByText('快照A旧草稿。')).toHaveCount(0)
})

test('同一创建来源保留确认态，离开页面再返回则清理旧草稿', async ({ page }) => {
  const snapshotId = await openReleaseSnapshotCreate(page)
  await page.locator('[data-supplement-reason]').selectOption('尺码齐套不足')
  await page.locator('[data-supplement-reason-detail]').fill('同一来源应保留，离开后应清理。')
  await page.getByRole('button', { name: '提交补料' }).click()
  await expect(page.getByRole('heading', { name: '二次确认补料' })).toBeVisible()

  await page.evaluate(async (id) => {
    const { appStore } = await import('/src/state/store.ts')
    appStore.navigate(`/fcs/craft/cutting/supplement-management?mode=create&releaseSnapshotId=${encodeURIComponent(id)}&from=matrix`)
  }, snapshotId)
  await expect(page.getByRole('heading', { name: '二次确认补料' })).toBeVisible()

  await page.evaluate(async () => {
    const { appStore } = await import('/src/state/store.ts')
    appStore.navigate('/fcs/craft/cutting/production-progress')
  })
  await expect(page).toHaveURL(/production-progress$/)
  await expect(page.locator('[data-testid="cutting-production-progress-main-table"]')).toBeVisible()
  await page.evaluate(async (id) => {
    const { appStore } = await import('/src/state/store.ts')
    appStore.navigate(`/fcs/craft/cutting/supplement-management?mode=create&releaseSnapshotId=${encodeURIComponent(id)}`)
  }, snapshotId)
  await expect(page.locator('[data-release-snapshot-create]')).toBeVisible()
  await expect(page.locator('[data-release-snapshot-trace]')).toHaveCount(1)
  await expect(page.locator('[data-release-snapshot-trace]').getByText('来源：裁片放行目标快照')).toBeVisible()
  await expect(page.getByRole('heading', { name: '二次确认补料' })).toHaveCount(0)
  await expect(page.getByText('同一来源应保留，离开后应清理。')).toHaveCount(0)
})

test('快照逐点业务键覆盖颜色尺码物料部位且特殊字符不碰撞', async ({ page }) => {
  await page.goto(`${route}?mode=create`)
  const result = await page.evaluate(async () => {
    const pageModule = await import('/src/pages/process-factory/cutting/supplement-management.ts')
    const fixtures = [
      { garmentColor: 'Black', size: 'M', materialId: 'B', partId: 'front' },
      { garmentColor: 'Black', size: 'XL', materialId: 'B', partId: 'front' },
      { garmentColor: 'Black::M', size: 'XL', materialId: 'B', partId: 'front' },
      { garmentColor: 'Black', size: 'M::XL', materialId: 'B', partId: 'front' },
      { garmentColor: 'Black', size: 'M', materialId: 'B', partId: 'front::side' },
    ]
    return pageModule.buildReleaseSnapshotPointKeys(fixtures)
  })
  expect(new Set(result).size).toBe(result.length)
  expect(result[0]).not.toBe(result[1])
})

test('快照URL只解码一次并采用第一个非空重复参数', async ({ page }) => {
  await page.goto(`${route}?mode=create`)
  const result = await page.evaluate(async () => {
    const pageModule = await import('/src/pages/process-factory/cutting/supplement-management.ts')
    return {
      repeated: pageModule.parseReleaseSnapshotIdFromSearch('?releaseSnapshotId=%20&releaseSnapshotId=first&releaseSnapshotId=second'),
      encodedLiteral: pageModule.parseReleaseSnapshotIdFromSearch('?releaseSnapshotId=literal%252Fvalue'),
      malformed: pageModule.parseReleaseSnapshotIdFromSearch('?releaseSnapshotId=%E0%A4%A'),
    }
  })
  expect(result.repeated).toBe('first')
  expect(result.encodedLiteral).toBe('literal%2Fvalue')
  expect(result.malformed).not.toContain('/')
})

async function rememberStableRegions(page: Page): Promise<void> {
  await page.evaluate(() => {
    const main = document.querySelector('main')
    const stats = document.querySelector('[data-cutting-supplement-region="stats"]')
    const pagination = document.querySelector('[data-cutting-supplement-region="pagination"]')
    if (!main || !stats || !pagination) throw new Error('缺少列表局部刷新验收区域')
    const acceptanceWindow = window as typeof window & {
      __supplementAcceptance?: {
        main: Element
        stats: Element
        pagination: Element
        statsMutations: number
        paginationMutations: number
      }
    }
    acceptanceWindow.__supplementAcceptance = {
      main,
      stats,
      pagination,
      statsMutations: 0,
      paginationMutations: 0,
    }
    new MutationObserver((records) => {
      if (acceptanceWindow.__supplementAcceptance) {
        acceptanceWindow.__supplementAcceptance.statsMutations += records.length
      }
    }).observe(stats, { attributes: true, childList: true, characterData: true, subtree: true })
    new MutationObserver((records) => {
      if (acceptanceWindow.__supplementAcceptance) {
        acceptanceWindow.__supplementAcceptance.paginationMutations += records.length
      }
    }).observe(pagination, { attributes: true, childList: true, characterData: true, subtree: true })
  })
}

async function stableRegionResult(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  return page.evaluate(() => {
    const state = (window as typeof window & {
      __supplementAcceptance?: {
        main: Element
        stats: Element
        pagination: Element
        statsMutations: number
        paginationMutations: number
      }
    }).__supplementAcceptance
    if (!state) throw new Error('缺少列表局部刷新验收状态')
    return {
      mainSame: document.querySelector('main') === state.main,
      statsSame: document.querySelector('[data-cutting-supplement-region="stats"]') === state.stats,
      paginationSame: document.querySelector('[data-cutting-supplement-region="pagination"]') === state.pagination,
      statsMutations: state.statsMutations,
      paginationMutations: state.paginationMutations,
    }
  })
}

function tableHeaders(page: Page): Locator {
  return page.locator('[data-standard-list-table-section] thead th[data-column-key]')
}

async function headerOrder(page: Page): Promise<(string | null)[]> {
  return tableHeaders(page).evaluateAll((headers) => headers.map((header) => header.getAttribute('data-column-key')))
}

async function openColumnSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: '列设置' }).click()
  await expect(page.getByRole('heading', { name: '列设置' })).toBeVisible()
}

function settingRow(page: Page, columnKey: string): Locator {
  return page.locator(`[data-standard-list-column-key="${columnKey}"]`)
}

async function visibleBox(locator: Locator, label: string) {
  await expect(locator, `${label}必须可见`).toBeVisible()
  const box = await locator.boundingBox()
  expect(box, `${label}必须有可测量的边界`).not.toBeNull()
  return box!
}

async function rememberFilterRefreshBoundary(page: Page): Promise<void> {
  await page.evaluate(() => {
    const main = document.querySelector('main')
    const stats = document.querySelector('[data-cutting-supplement-region="stats"]')
    const pagination = document.querySelector('[data-cutting-supplement-region="pagination"]')
    const overlay = document.querySelector('[data-cutting-supplement-region="overlay"]')
    if (!main || !stats || !pagination || !overlay) throw new Error('缺少筛选刷新边界验收区域')
    const acceptanceWindow = window as typeof window & {
      __supplementFilterBoundary?: {
        main: Element
        statsMutations: number
        paginationMutations: number
        overlay: Element
        overlayMutations: number
      }
    }
    acceptanceWindow.__supplementFilterBoundary = {
      main,
      statsMutations: 0,
      paginationMutations: 0,
      overlay,
      overlayMutations: 0,
    }
    new MutationObserver((records) => {
      if (acceptanceWindow.__supplementFilterBoundary) {
        acceptanceWindow.__supplementFilterBoundary.statsMutations += records.length
      }
    }).observe(stats, { childList: true, subtree: true })
    new MutationObserver((records) => {
      if (acceptanceWindow.__supplementFilterBoundary) {
        acceptanceWindow.__supplementFilterBoundary.paginationMutations += records.length
      }
    }).observe(pagination, { childList: true, subtree: true })
    new MutationObserver((records) => {
      if (acceptanceWindow.__supplementFilterBoundary) {
        acceptanceWindow.__supplementFilterBoundary.overlayMutations += records.length
      }
    }).observe(overlay, { attributes: true, childList: true, characterData: true, subtree: true })
  })
}

async function filterRefreshBoundaryResult(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  return page.evaluate(() => {
    const state = (window as typeof window & {
      __supplementFilterBoundary?: {
        main: Element
        statsMutations: number
        paginationMutations: number
        overlay: Element
        overlayMutations: number
      }
    }).__supplementFilterBoundary
    if (!state) throw new Error('缺少筛选刷新边界验收状态')
    return {
      mainSame: document.querySelector('main') === state.main,
      statsMutations: state.statsMutations,
      paginationMutations: state.paginationMutations,
      overlaySame: document.querySelector('[data-cutting-supplement-region="overlay"]') === state.overlay,
      overlayMutations: state.overlayMutations,
    }
  })
}

for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }]) {
  test(`补料管理模板在 ${viewport.width}×${viewport.height} 无页面横向溢出`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openList(page)

    await expect(page.getByText('工艺工厂运营系统 / 裁床厂管理 / 裁后处理 / 补料管理')).toHaveCount(0)
    await expect(page.getByText('列表对象是补料单；新增补料填写后会弹窗确认。')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '新增补料' })).toBeVisible()
    await expect(page.getByRole('button', { name: '列设置' })).toBeVisible()
    await expect(page.locator('[data-cutting-supplement-field="pageSize"]')).toHaveValue('10')
    await expect(page.getByRole('button', { name: '下一页' })).toBeVisible()

    const statCards = page.locator('[data-standard-list-stats] > div')
    await expect(statCards).toHaveCount(3)
    for (const card of await statCards.all()) {
      const cardBox = await visibleBox(card, '标准列表摘要卡片')
      expect(cardBox.height).toBeGreaterThanOrEqual(47)
      expect(cardBox.height).toBeLessThanOrEqual(49)
      const labelBox = await visibleBox(card.locator('span'), '摘要标签')
      const valueBox = await visibleBox(card.locator('strong'), '摘要数值')
      expect(Math.abs((labelBox.y + labelBox.height / 2) - (valueBox.y + valueBox.height / 2))).toBeLessThanOrEqual(1)
    }

    const overflow = await page.evaluate(() => ({
      body: [document.body.scrollWidth, document.body.clientWidth],
      document: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
    }))
    expect(overflow.body[0]).toBe(overflow.body[1])
    expect(overflow.document[0]).toBe(overflow.document[1])
    const tableScroll = page.locator('[data-standard-list-scroll]')
    const tableOverflow = await tableScroll.evaluate((element) => [element.scrollWidth, element.clientWidth])
    expect(tableOverflow[0]).toBeGreaterThan(tableOverflow[1])
  })
}

test('默认分页、三态排序及临时状态刷新后回到默认', async ({ page }) => {
  await openList(page)
  await rememberStableRegions(page)

  const rows = page.locator('[data-standard-list-table-section] tbody tr')
  await expect(rows).toHaveCount(10)
  await expect(page.getByText('1 / 2', { exact: true })).toBeVisible()
  const defaultFirstRecord = (await rows.first().locator('td').first().innerText()).trim()

  const firstClickDuration = await page.evaluate((currentFirstRecordNo) => new Promise<number>((resolve, reject) => {
    const table = document.querySelector('[data-cutting-supplement-region="table"]')
    const next = document.querySelector<HTMLButtonElement>('[data-cutting-supplement-action="next-page"]')
    if (!table || !next) {
      reject(new Error('缺少首次翻页性能验收元素'))
      return
    }
    requestAnimationFrame(() => {
      const startedAt = performance.now()
      const observer = new MutationObserver(() => {
        if (table.textContent?.includes(currentFirstRecordNo)) return
        observer.disconnect()
        resolve(performance.now() - startedAt)
      })
      observer.observe(table, { childList: true, subtree: true })
      next.click()
    })
  }), defaultFirstRecord)
  expect(firstClickDuration).toBeLessThan(200)
  console.log(`首次下一页实际 DOM 响应：${firstClickDuration.toFixed(1)}ms`)
  await expect(rows).toHaveCount(2)
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible()
  let stability = await stableRegionResult(page)
  expect(stability.mainSame).toBe(true)
  expect(stability.statsSame).toBe(true)
  expect(stability.statsMutations).toBe(0)

  await page.getByRole('button', { name: '上一页' }).click()
  const quantityHeader = page.locator('th[data-column-key="supplementQty"]')
  const quantitySort = quantityHeader.getByRole('button')
  await expect(quantityHeader.locator('[data-standard-list-sort-icon="none"] svg')).toBeVisible()
  const quantityColumnIndex = await tableHeaders(page).evaluateAll(
    (headers) => headers.findIndex((header) => header.getAttribute('data-column-key') === 'supplementQty'),
  )
  const quantities = async () => rows.locator(`td:nth-child(${quantityColumnIndex + 1})`).evaluateAll((cells) =>
    cells.map((cell) => Number(cell.textContent?.replace(/\D/g, '') ?? '0')),
  )

  await quantitySort.click()
  await expect(quantityHeader).toHaveAttribute('aria-sort', 'ascending')
  await expect(quantityHeader.locator('[data-standard-list-sort-icon="asc"] svg')).toBeVisible()
  expect(await quantities()).toEqual([...await quantities()].sort((a, b) => a - b))
  await quantitySort.click()
  await expect(quantityHeader).toHaveAttribute('aria-sort', 'descending')
  await expect(quantitySort).toHaveAttribute('aria-label', '恢复补料数量默认顺序')
  await expect(quantityHeader.locator('[data-standard-list-sort-icon="desc"] svg')).toBeVisible()
  expect(await quantities()).toEqual([...await quantities()].sort((a, b) => b - a))
  await quantitySort.click()
  await expect(quantityHeader).toHaveAttribute('aria-sort', 'none')
  await expect(quantityHeader.locator('[data-standard-list-sort-icon="none"] svg')).toBeVisible()
  await expect(rows.first().locator('td').first()).toContainText(defaultFirstRecord)

  await quantitySort.click()
  await expect(quantityHeader).toHaveAttribute('aria-sort', 'ascending')
  await quantitySort.click()
  await expect(quantityHeader).toHaveAttribute('aria-sort', 'descending')
  expect(await quantities()).toEqual([...await quantities()].sort((a, b) => b - a))

  await page.getByRole('button', { name: '下一页' }).click()
  stability = await stableRegionResult(page)
  expect(stability.mainSame).toBe(true)
  expect(stability.statsSame).toBe(true)
  expect(stability.statsMutations).toBe(0)
  await page.reload()
  await expect(page.getByText('1 / 2', { exact: true })).toBeVisible()
  await expect(page.locator('th[data-column-key="supplementQty"]')).toHaveAttribute('aria-sort', 'none')
})

test('筛选与重置改变结果并回到第 1 页，且不刷新无关覆盖层', async ({ page }) => {
  await openList(page)
  const rows = page.locator('[data-standard-list-table-section] tbody tr')
  await page.getByRole('button', { name: '下一页' }).click()
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible()
  const targetRecordNo = (await rows.first().locator('td').first().innerText()).trim()
  const targetSourceType = (await rows.first().locator('td').nth(1).innerText()).includes('裁片单')
    ? 'cut-order'
    : 'production-order'

  await rememberFilterRefreshBoundary(page)
  await page.locator('[data-cutting-supplement-field="sourceType"]').selectOption(targetSourceType)
  await page.locator('[data-cutting-supplement-field="keyword"]').fill(targetRecordNo)
  await page.getByRole('button', { name: '筛选', exact: true }).click()
  await expect(rows).toHaveCount(1)
  await expect(rows.first().locator('td').first()).toContainText(targetRecordNo)
  await expect(page.getByText('1 / 1', { exact: true })).toBeVisible()
  await expect(page.locator('[data-standard-list-stats]').getByText('1', { exact: true }).first()).toBeVisible()
  let boundary = await filterRefreshBoundaryResult(page)
  expect(boundary.mainSame).toBe(true)
  expect(boundary.statsMutations).toBeGreaterThan(0)
  expect(boundary.paginationMutations).toBeGreaterThan(0)
  expect(boundary.overlaySame).toBe(true)
  expect(boundary.overlayMutations).toBe(0)

  await rememberFilterRefreshBoundary(page)
  await page.getByRole('button', { name: '重置', exact: true }).click()
  await expect(rows).toHaveCount(10)
  await expect(page.getByText('1 / 2', { exact: true })).toBeVisible()
  await expect(page.locator('[data-cutting-supplement-field="sourceType"]')).toHaveValue('ALL')
  await expect(page.locator('[data-cutting-supplement-field="keyword"]')).toHaveValue('')
  boundary = await filterRefreshBoundaryResult(page)
  expect(boundary.mainSame).toBe(true)
  expect(boundary.statsMutations).toBeGreaterThan(0)
  expect(boundary.paginationMutations).toBeGreaterThan(0)
  expect(boundary.overlaySame).toBe(true)
  expect(boundary.overlayMutations).toBe(0)
})

test('列显示、顺序、冻结和每页条数持久化，且列操作只刷新相关区域', async ({ page }) => {
  await openList(page)
  await rememberStableRegions(page)
  await openColumnSettings(page)

  await settingRow(page, 'processDemand').getByLabel('显示').uncheck()
  await expect(page.locator('th[data-column-key="processDemand"]')).toHaveCount(0)
  let stability = await stableRegionResult(page)
  expect(stability).toEqual({
    mainSame: true,
    statsSame: true,
    paginationSame: true,
    statsMutations: 0,
    paginationMutations: 0,
  })

  await settingRow(page, 'created').dragTo(settingRow(page, 'recordNo'))
  expect((await headerOrder(page)).slice(0, 2)).toEqual(['created', 'recordNo'])
  stability = await stableRegionResult(page)
  expect(stability).toEqual({
    mainSame: true,
    statsSame: true,
    paginationSame: true,
    statsMutations: 0,
    paginationMutations: 0,
  })

  await settingRow(page, 'recordNo').getByLabel('冻结').check()
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await page.locator('[data-cutting-supplement-field="pageSize"]').selectOption('20')
  await expect(page.locator('[data-standard-list-table-section] tbody tr')).toHaveCount(12)
  stability = await stableRegionResult(page)
  expect(stability.mainSame).toBe(true)
  expect(stability.statsSame).toBe(true)
  expect(stability.statsMutations).toBe(0)

  const preferences = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), storageKey)
  expect(preferences.visibleKeys).not.toContain('processDemand')
  expect(preferences.order.slice(0, 2)).toEqual(['created', 'recordNo'])
  expect(preferences.frozenKeys).toContain('recordNo')
  expect(preferences.pageSize).toBe(20)

  await page.reload()
  await waitForList(page)
  await expect(page.locator('th[data-column-key="processDemand"]')).toHaveCount(0)
  expect((await headerOrder(page)).slice(0, 2)).toEqual(['recordNo', 'created'])
  await expect(page.locator('th[data-column-key="recordNo"]')).toHaveClass(/sticky/)
  const reloadedPreferences = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), storageKey)
  expect(reloadedPreferences.order.slice(0, 2)).toEqual(['created', 'recordNo'])
  await expect(page.locator('[data-cutting-supplement-field="pageSize"]')).toHaveValue('20')
  await expect(page.getByText('1 / 1', { exact: true })).toBeVisible()
})

test('列设置与每页条数一次用户操作只写入并刷新一次', async ({ page }) => {
  await openList(page)
  await openColumnSettings(page)
  await page.evaluate((key) => {
    const table = document.querySelector('[data-cutting-supplement-region="table"]')
    const pagination = document.querySelector('[data-cutting-supplement-region="pagination"]')
    const overlay = document.querySelector('[data-cutting-supplement-region="overlay"]')
    if (!table || !pagination || !overlay) throw new Error('缺少事件去重验收区域')
    const acceptanceWindow = window as typeof window & {
      __supplementSingleDispatch?: {
        storageWrites: number
        tableMutations: number
        paginationMutations: number
        overlayMutations: number
        reset(): void
      }
    }
    const state = {
      storageWrites: 0,
      tableMutations: 0,
      paginationMutations: 0,
      overlayMutations: 0,
      reset() {
        this.storageWrites = 0
        this.tableMutations = 0
        this.paginationMutations = 0
        this.overlayMutations = 0
      },
    }
    acceptanceWindow.__supplementSingleDispatch = state
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function patchedSetItem(storageKey, value) {
      if (storageKey === key) state.storageWrites += 1
      return originalSetItem.call(this, storageKey, value)
    }
    new MutationObserver((records) => { state.tableMutations += records.length })
      .observe(table, { childList: true })
    new MutationObserver((records) => { state.paginationMutations += records.length })
      .observe(pagination, { childList: true })
    new MutationObserver((records) => { state.overlayMutations += records.length })
      .observe(overlay, { childList: true })
  }, storageKey)

  await settingRow(page, 'processDemand').getByLabel('显示').uncheck()
  await expect(page.locator('th[data-column-key="processDemand"]')).toHaveCount(0)
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  expect(await page.evaluate(() => {
    const state = (window as typeof window & { __supplementSingleDispatch?: Record<string, number> })
      .__supplementSingleDispatch
    return state && {
      storageWrites: state.storageWrites,
      tableMutations: state.tableMutations,
      paginationMutations: state.paginationMutations,
      overlayMutations: state.overlayMutations,
    }
  })).toEqual({ storageWrites: 1, tableMutations: 1, paginationMutations: 0, overlayMutations: 1 })

  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.getByRole('heading', { name: '列设置' })).toHaveCount(0)
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => {
    const state = (window as typeof window & { __supplementSingleDispatch?: { reset(): void } })
      .__supplementSingleDispatch
    state?.reset()
    resolve()
  })))
  await page.locator('[data-cutting-supplement-field="pageSize"]').selectOption('20')
  await expect(page.locator('[data-standard-list-table-section] tbody tr')).toHaveCount(12)
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  expect(await page.evaluate(() => {
    const state = (window as typeof window & { __supplementSingleDispatch?: Record<string, number> })
      .__supplementSingleDispatch
    return state && {
      storageWrites: state.storageWrites,
      tableMutations: state.tableMutations,
      paginationMutations: state.paginationMutations,
      overlayMutations: state.overlayMutations,
    }
  })).toEqual({ storageWrites: 1, tableMutations: 1, paginationMutations: 1, overlayMutations: 0 })
})

test('SPA 离开补料管理后返回重置页码和排序但保留列偏好', async ({ page }) => {
  await openList(page)
  await openColumnSettings(page)
  await settingRow(page, 'processDemand').getByLabel('显示').uncheck()
  await page.getByRole('button', { name: '关闭', exact: true }).click()

  const quantityHeader = page.locator('th[data-column-key="supplementQty"]')
  await quantityHeader.getByRole('button').click()
  await expect(quantityHeader).toHaveAttribute('aria-sort', 'ascending')
  await page.getByRole('button', { name: '下一页' }).click()
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible()

  const spaNavigate = async (pathname: string) => {
    await page.evaluate((nextPathname) => {
      const button = document.createElement('button')
      button.dataset.nav = nextPathname
      button.dataset.spaAcceptanceNav = 'true'
      document.querySelector('#app')?.append(button)
      button.click()
    }, pathname)
  }
  await spaNavigate('/fcs/craft/cutting/production-progress')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/production-progress$/)
  await spaNavigate(route)
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/supplement-management$/)
  await waitForList(page)

  await expect(page.getByText('1 / 2', { exact: true })).toBeVisible()
  await expect(page.locator('th[data-column-key="supplementQty"]')).toHaveAttribute('aria-sort', 'none')
  await expect(page.locator('th[data-column-key="processDemand"]')).toHaveCount(0)
})

test('冻结中间列立即进入左侧固定区，多列冻结不重叠且取消后恢复普通位置', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openList(page)
  await openColumnSettings(page)
  await settingRow(page, 'supplementQty').getByLabel('冻结').check()
  await page.getByRole('button', { name: '关闭', exact: true }).click()

  expect(await headerOrder(page)).toEqual([
    'supplementQty', 'recordNo', 'target', 'materialDemand', 'processDemand', 'status', 'created', 'actions',
  ])

  const scroll = page.locator('[data-standard-list-scroll]')
  const supplementQty = page.locator('th[data-column-key="supplementQty"]')
  const actions = page.locator('th[data-column-key="actions"]')
  const scrollBefore = await visibleBox(scroll, '表格横向滚动容器')
  const supplementQtyBefore = await visibleBox(supplementQty, '冻结补料数量表头')
  const actionsBefore = await visibleBox(actions, '固定操作列表头')
  expect(Math.abs(actionsBefore.x + actionsBefore.width - (scrollBefore.x + scrollBefore.width))).toBeLessThanOrEqual(1)
  await scroll.evaluate((element) => { element.scrollLeft = element.scrollWidth })
  await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
  const scrollAfter = await visibleBox(scroll, '滚动后的表格横向滚动容器')
  const supplementQtyAfter = await visibleBox(supplementQty, '滚动后的冻结补料数量表头')
  const actionsAfter = await visibleBox(actions, '滚动后的固定操作列表头')
  expect(Math.abs(supplementQtyAfter.x - supplementQtyBefore.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(actionsAfter.x + actionsAfter.width - (scrollAfter.x + scrollAfter.width))).toBeLessThanOrEqual(1)

  await openColumnSettings(page)
  await settingRow(page, 'recordNo').getByLabel('冻结').check()
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  expect((await headerOrder(page)).slice(0, 2)).toEqual(['recordNo', 'supplementQty'])
  const recordNoBox = await visibleBox(page.locator('th[data-column-key="recordNo"]'), '首个冻结补料单号表头')
  const supplementQtyBox = await visibleBox(supplementQty, '第二个冻结补料数量表头')
  expect(Math.abs(supplementQtyBox.x - (recordNoBox.x + recordNoBox.width))).toBeLessThanOrEqual(1)

  await openColumnSettings(page)
  await settingRow(page, 'supplementQty').getByLabel('冻结').uncheck()
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  expect(await headerOrder(page)).toEqual([
    'recordNo', 'target', 'supplementQty', 'materialDemand', 'processDemand', 'status', 'created', 'actions',
  ])
})

test('恢复默认清除列偏好并保持 main 节点', async ({ page }) => {
  await openList(page)
  await openColumnSettings(page)
  await settingRow(page, 'processDemand').getByLabel('显示').uncheck()
  await settingRow(page, 'created').dragTo(settingRow(page, 'recordNo'))
  await settingRow(page, 'recordNo').getByLabel('冻结').check()
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await page.locator('[data-cutting-supplement-field="pageSize"]').selectOption('20')
  await rememberStableRegions(page)

  await openColumnSettings(page)
  await page.getByRole('button', { name: '恢复默认' }).click()
  await expect(page.locator('th[data-column-key="processDemand"]')).toBeVisible()
  expect(await headerOrder(page)).toEqual([
    'recordNo', 'target', 'supplementQty', 'materialDemand', 'processDemand', 'status', 'created', 'actions',
  ])
  await expect(page.locator('th[data-column-key="recordNo"]')).not.toHaveClass(/sticky/)
  await expect(page.locator('[data-cutting-supplement-field="pageSize"]')).toHaveValue('10')
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull()
  expect((await stableRegionResult(page)).mainSame).toBe(true)
})

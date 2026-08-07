import { expect, test, type Page } from '@playwright/test'

const PDA_SESSION = {
  userId: 'F090_operator',
  loginId: 'F090_operator',
  userName: '全能力测试工厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'F090',
  factoryName: '全能力测试工厂',
  loggedAt: '2026-05-23 10:00:00',
}

const OLD_VISIBLE_TEXTS = [
  '可裁排产',
  '原始裁片单',
  '合并裁剪',
  '合并批次',
  '裁片批次',
  '裁剪总结',
  '裁剪总表',
  '唛架方案列表',
  '铺布列表',
  '交出车缝',
  '车缝中转袋',
  '特殊工艺中转袋',
  '未齐套不能交出',
  '齐套后才能交出',
  '特殊工艺未回仓不能交出',
]

const WEB_PAGES: Array<{ path: string; title: string; required: string[]; forbidden?: string[] }> = [
  {
    path: '/fcs/craft/cutting/production-progress',
    title: '生产单总览',
    required: ['生产单号', '需求单号', '需求数量', '工厂', '类型', '接单', '领取', '接收工厂', '唛架完成', '铺布完成', '裁剪完成', '已入仓'],
  },
  {
    path: '/fcs/craft/cutting/cut-orders',
    title: '裁片单',
    required: ['未开工', '已开工', '已关闭', '需求用量', '中转仓已配数量', '裁床已领数量', '可用余额', '面料', '纸样'],
  },
  {
    path: '/fcs/craft/cutting/marker-list',
    title: '唛架方案',
    required: ['裁片单号', '方案编号', '计划数量 / 用量', '来源任务 / 裁片单', '可交接铺布'],
    forbidden: ['来源类型'],
  },
  {
    path: '/fcs/craft/cutting/marker-create',
    title: '新建唛架方案',
    required: ['选择裁片单', '确认组合规则', '维护唛架编号', '确认并保存'],
    forbidden: ['来源类型'],
  },
  {
    path: '/fcs/craft/cutting/spreading-list',
    title: '铺布单',
    required: ['计划层数', '实铺层数', '计划用量', '实际用量', '裁剪数量', '最近同步'],
  },
  {
    path: '/fcs/craft/cutting/fei-tickets',
    title: '菲票打印',
    required: ['待打印', '已打印', '需补打', '铺布单', '菲票明细', '特殊工艺', '承接工厂', '编号 1-80'],
    forbidden: ['交出单号', '车缝任务号', '齐套说明'],
  },
  {
    path: '/fcs/craft/cutting/warehouse-management/wait-process',
    title: '裁床待加工仓',
    required: ['裁床已领数量', '已消耗数量', '可用余额', '库存明细', '查看流水记录'],
  },
  {
    path: '/fcs/craft/cutting/warehouse-management/wait-handover',
    title: '裁床待交出仓',
    required: ['待入仓菲票', '在库裁片', '已占用裁片', '已装袋待交出', '交出差异', '特殊工艺回仓', '菲票装袋', '中转袋入仓', '中转袋交出', '库位图'],
  },
  {
    path: '/fcs/craft/cutting/transfer-bags',
    title: '中转袋流转',
    required: ['中转袋档案', '中转袋二维码', '中转袋状态', '当前流转阶段', '当前所在', '当前装载', '最近记录', '报废记录', '查看使用周期'],
    forbidden: ['车缝中转袋', '特殊工艺中转袋'],
  },
  {
    path: '/fcs/craft/cutting/handover-orders',
    title: '交出单',
    required: ['交出单数', '交出记录数', '接收对象类型', '待回写记录', '差异 / 异议', '查看交出单', '查看交出记录'],
    forbidden: ['交出车缝'],
  },
  {
    path: '/fcs/craft/cutting/summary',
    title: '裁剪结果核查',
    required: ['待处理差异', '已关闭裁片单', '交出后缺口', '特殊工艺未回仓', '样衣异常', '捆条异常'],
  },
  {
    path: '/fcs/craft/cutting/sample-warehouse',
    title: '裁床样衣仓',
    required: ['样衣总数', '裁剪中使用', '待归还', '异常样衣', '流转记录数', '裁片单', '纸样', '唛架方案', '样衣流转记录'],
  },
  {
    path: '/fcs/craft/cutting/special-processes',
    title: '捆条加工单',
    required: ['加工单', '加工中', '已完成', '待打印菲票', '已入仓', '存在差异', '来源对象', '捆条明细', '菲票 / 入仓 / 交出', '记录裁剪', '结束加工', '打印菲票'],
  },
]

async function seedPdaSession(page: Page) {
  await page.addInitScript((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, PDA_SESSION)
  await page.goto('/fcs/pda/login', { waitUntil: 'domcontentloaded' })
  await page.evaluate((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, PDA_SESSION)
}

async function gotoPda(page: Page, path: string) {
  await page.evaluate((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, PDA_SESSION).catch(() => undefined)
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(200)
  const bodyText = await page.locator('body').innerText().catch(() => '')
  if (bodyText.trim().length < 20) {
    await page.reload({ waitUntil: 'domcontentloaded' })
  }
}

async function gotoWithRecovery(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(200)
  const bodyText = await page.locator('body').innerText().catch(() => '')
  if (bodyText.trim().length < 20) {
    await page.reload({ waitUntil: 'domcontentloaded' })
  }
}

function collectBrowserErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

async function expectNoMainHorizontalScroll(page: Page) {
  const result = await page.evaluate(() => {
    const doc = document.documentElement
    const main = document.querySelector('main') as HTMLElement | null
    return {
      documentWidth: doc.scrollWidth,
      viewportWidth: doc.clientWidth,
      mainWidth: main?.scrollWidth ?? 0,
      mainClientWidth: main?.clientWidth ?? 0,
    }
  })

  expect(result.documentWidth, `document scroll width ${result.documentWidth} > ${result.viewportWidth}`).toBeLessThanOrEqual(result.viewportWidth + 2)
  if (result.mainClientWidth > 0) {
    expect(result.mainWidth, `main scroll width ${result.mainWidth} > ${result.mainClientWidth}`).toBeLessThanOrEqual(result.mainClientWidth + 2)
  }
}

async function expectNoOldVisibleText(page: Page) {
  const body = page.locator('body')
  for (const text of OLD_VISIBLE_TEXTS) {
    await expect(body, `旧口径残留：${text}`).not.toContainText(text)
  }
}

async function openAndCheck(page: Page, item: { path: string; title: string; required: string[]; forbidden?: string[] }) {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(item.path, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('h1').filter({ hasText: item.title }).first()).toBeVisible({ timeout: 60_000 })
  for (const text of item.required) {
    await expect(page.locator('body'), `${item.path} 缺少 ${text}`).toContainText(text)
  }
  for (const text of item.forbidden || []) {
    await expect(page.locator('body'), `${item.path} 不应展示 ${text}`).not.toContainText(text)
  }
  await expectNoOldVisibleText(page)
  await expectNoMainHorizontalScroll(page)
}

async function readDataNav(page: Page, selector: string): Promise<string> {
  const target = page.locator(selector).first()
  await expect(target).toBeVisible()
  const nav = await target.getAttribute('data-nav')
  expect(nav, `缺少 data-nav: ${selector}`).toBeTruthy()
  return nav!
}

async function openFirstStandaloneFeiTicket(page: Page): Promise<string> {
  await gotoWithRecovery(page, '/fcs/craft/cutting/fei-tickets')
  const spreadingDetailPath = await readDataNav(page, 'button[data-nav*="/fcs/craft/cutting/fei-tickets/spreading%3A"]')
  await gotoWithRecovery(page, spreadingDetailPath)
  const ticketDetailPath = await readDataNav(page, 'button[data-nav*="/fcs/craft/cutting/fei-tickets/"]:has-text("单条详情")')
  await gotoWithRecovery(page, ticketDetailPath)
  await expect(page.locator('body')).toContainText('菲票详情')
  return ticketDetailPath
}

test.describe('阶段 8 裁床 Web 页面全量收口', () => {
  for (const item of WEB_PAGES) {
    test(`${item.title} 可达且 1440px 无横向滚动`, async ({ page }) => {
      const errors = collectBrowserErrors(page)
      await openAndCheck(page, item)
      expect(errors).toEqual([])
    })
  }
})

test('阶段 8 生产单总览和裁片单完整详情使用独立页面', async ({ page }) => {
  const errors = collectBrowserErrors(page)
  await openAndCheck(page, WEB_PAGES.find((item) => item.path === '/fcs/craft/cutting/production-progress')!)
  await page.locator('button[data-nav*="/fcs/craft/cutting/production-progress-detail/"]').first().click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/production-progress-detail\/[^/]+$/)
  await expect(page.locator('[data-testid="cutting-production-progress-detail-page"]')).toBeVisible()
  for (const text of ['生产单详情', '裁片单', '唛架 / 铺布', '待交出仓 / 中转袋', '交出', '差异 / 关闭', '配料 / 接收记录']) {
    await expect(page.locator('body')).toContainText(text)
  }
  await expectNoMainHorizontalScroll(page)

  await page.goto('/fcs/craft/cutting/cut-orders', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '查看详情' }).first().click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/cut-orders\/[^/]+$/)
  await expect(page.locator('[data-testid="cut-order-detail-page"]')).toBeVisible()
  for (const text of ['裁片单详情', '数量账', '需求用量', '中转仓已配数量', '裁床已领数量', '已消耗数量', '可用余额', '最近关系']) {
    await expect(page.locator('body')).toContainText(text)
  }
  await expectNoOldVisibleText(page)
  await expectNoMainHorizontalScroll(page)
  expect(errors).toEqual([])
})

test('阶段 8 交出单可挂多条交出记录并进入独立详情页', async ({ page }) => {
  const errors = collectBrowserErrors(page)
  await openAndCheck(page, WEB_PAGES.find((item) => item.path === '/fcs/craft/cutting/handover-orders')!)

  await page.getByRole('button', { name: '查看交出单' }).first().click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/handover-orders\/[^/]+$/)
  await expect(page.getByRole('heading', { level: 1, name: '交出单详情' }).first()).toBeVisible()
  await expect(page.locator('body')).toContainText('一个交出单下可多次交出')
  await expect(page.locator('body')).toContainText('交出记录')
  await expectNoMainHorizontalScroll(page)

  await page.getByRole('button', { name: '查看记录详情' }).first().click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/handover-records\/[^/]+$/)
  await expect(page.getByRole('heading', { level: 1, name: '交出记录详情' }).first()).toBeVisible()
  for (const text of ['交出记录号', '交出单', '接收对象', '之前已交', '本次交出', '累计交出', '交出后缺口', '接收回写', '差异', '异议']) {
    await expect(page.locator('body')).toContainText(text)
  }
  await expectNoOldVisibleText(page)
  await expectNoMainHorizontalScroll(page)
  expect(errors).toEqual([])
})

test('阶段 8 铺布单详情从列表进入后展示计划、实际、卷记录和人员记录', async ({ page }) => {
  const errors = collectBrowserErrors(page)
  await openAndCheck(page, WEB_PAGES.find((item) => item.path === '/fcs/craft/cutting/spreading-list')!)

  await page.locator('[data-cutting-marker-action="open-spreading-detail"]').first().click()
  await expect(page.locator('h1').filter({ hasText: '铺布单详情' }).first()).toBeVisible()
  for (const text of ['基本信息', '计划信息', '实际信息', '卷记录', '换班与人员', '人员（按层）', 'PDA 执行记录', '差异']) {
    await expect(page.locator('body')).toContainText(text)
  }
  await expectNoOldVisibleText(page)
  await expectNoMainHorizontalScroll(page)
  expect(errors).toEqual([])
})

test('阶段 8 菲票详情使用独立页面并按铺布单展开明细', async ({ page }) => {
  const errors = collectBrowserErrors(page)
  await openAndCheck(page, WEB_PAGES.find((item) => item.path === '/fcs/craft/cutting/fei-tickets')!)

  const spreadingDetailPath = await readDataNav(
    page,
    'button[data-nav*="/fcs/craft/cutting/fei-tickets/spreading%3A"]',
  )
  await gotoWithRecovery(page, spreadingDetailPath)
  await expect(page.locator('body')).toContainText('铺布单菲票明细')
  for (const text of ['铺布单菲票概况', '来源与特殊工艺', '该铺布单下全部部位明细', '部位裁片编号范围', '单条详情']) {
    await expect(page.locator('body')).toContainText(text)
  }
  await expectNoOldVisibleText(page)
  await expectNoMainHorizontalScroll(page)
  expect(errors).toEqual([])
})

test('阶段 8 菲票打印页保留打印投影字段', async ({ page }) => {
  const errors = collectBrowserErrors(page)
  const ticketDetailPath = await openFirstStandaloneFeiTicket(page)
  await gotoWithRecovery(page, `${ticketDetailPath}/print`)
  await expect(page.locator('h1').filter({ hasText: '菲票打印' }).first()).toBeVisible()
  for (const text of ['10cm x 10cm', '15cm x 10cm', '二维码', '编号范围', '特殊工艺', '承接工厂']) {
    await expect(page.locator('body')).toContainText(text)
  }
  for (const text of ['交出单号', '车缝任务号', '齐套说明', '长备注']) {
    await expect(page.locator('body')).not.toContainText(text)
  }
  await expectNoOldVisibleText(page)
  await expectNoMainHorizontalScroll(page)
  expect(errors).toEqual([])
})

test('阶段 8 菲票补打页要求补打原因并展示影响范围', async ({ page }) => {
  const errors = collectBrowserErrors(page)
  const ticketDetailPath = await openFirstStandaloneFeiTicket(page)
  await gotoWithRecovery(page, `${ticketDetailPath}/reprint`)
  await expect(page.locator('h1').filter({ hasText: '菲票补打' }).first()).toBeVisible()
  for (const text of ['补打原因', '影响范围', '编号范围', '特殊工艺']) {
    await expect(page.locator('body')).toContainText(text)
  }
  await expectNoOldVisibleText(page)
  await expectNoMainHorizontalScroll(page)
  expect(errors).toEqual([])
})

test('阶段 8 菲票不暴露脱离事实链的作废入口', async ({ page }) => {
  const errors = collectBrowserErrors(page)
  await openFirstStandaloneFeiTicket(page)
  await expect(page.locator('[data-nav$="/void"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /作废/ })).toHaveCount(0)
  await expectNoOldVisibleText(page)
  await expectNoMainHorizontalScroll(page)
  expect(errors).toEqual([])
})

test('阶段 8 独立详情页覆盖中转袋和捆条，不使用侧边栏承载完整内容', async ({ page }) => {
  const errors = collectBrowserErrors(page)
  await page.setViewportSize({ width: 1440, height: 1000 })

  await page.goto('/fcs/craft/cutting/transfer-bags')
  await page.getByRole('button', { name: '查看详情' }).first().click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/transfer-bag-detail/)
  await expect(page.locator('body')).toContainText('中转袋详情')
  await expect(page.locator('body')).toContainText('使用周期')
  await expectNoMainHorizontalScroll(page)

  await page.goto('/fcs/craft/cutting/special-processes')
  await page.locator('a[href^="/fcs/craft/cutting/special-processes/"]').first().click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/special-processes\/[^/]+/)
  await expect(page.getByRole('heading', { level: 1, name: '捆条加工单详情' })).toBeVisible()
  for (const text of ['来源对象', '分批裁剪记录', '差异记录', '菲票 / 入仓 / 装袋交出']) {
    await expect(page.locator('body')).toContainText(text)
  }
  await expectNoMainHorizontalScroll(page)

  expect(errors).toEqual([])
})

test('阶段 8 PDA 裁床执行按当前投影阻断未接收任务', async ({ page }) => {
  const errors = collectBrowserErrors(page)
  await seedPdaSession(page)
  await page.setViewportSize({ width: 390, height: 844 })

  const taskIds = [
    'TASK-CUT-PDA-NO-PICKUP-0301',
    'TASK-CUT-PDA-PICKED-NOT-STARTED-0302',
    'TASK-CUT-PDA-WAIT-SPREAD-0303',
    'TASK-CUT-PDA-SPREADING-0304',
    'TASK-CUT-PDA-WAIT-CUT-0305',
    'TASK-CUT-PDA-CUTTING-0306',
    'TASK-CUT-PDA-CUT-DONE-0307',
  ]
  for (const taskId of taskIds) {
    await gotoPda(page, `/fcs/pda/cutting/spreading/${taskId}`)
    await expect(page.locator('body')).toContainText('去接收')
    await expect(page.locator('body')).toContainText('没有接收记录，不能开工、铺布或裁剪。')
    for (const forbidden of ['开始铺布', '完成铺布', '开始裁剪', '完成裁剪']) {
      await expect(page.locator('body')).not.toContainText(forbidden)
    }
  }

  expect(errors).toEqual([])
})

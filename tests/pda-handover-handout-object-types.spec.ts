import { expect, test } from '@playwright/test'

import { getPdaHandoutHeads } from '../src/data/fcs/pda-handover-events'
import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const garmentProcessNames = ['车缝', '整烫', '包装', '质检', '后整理'] as const
const printingHead = getPdaHandoutHeads('ID-F002').find((head) => head.processName === '印花')
const dyeingHead = getPdaHandoutHeads('ID-F003').find((head) => head.processName === '染色')

test('交出物信息按成衣、裁片、面料三种对象类型显示', async ({ page }) => {
  const errors = collectPageErrors(page)
  expect(printingHead).toBeTruthy()
  expect(dyeingHead).toBeTruthy()

  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })
  await page.goto('/fcs/pda/handover?tab=handout', { waitUntil: 'commit' })
  await page.locator('[data-testid="handout-head-card"]').first().waitFor({ timeout: 30_000 })

  for (const processName of garmentProcessNames) {
    const card = page.locator('[data-testid="handout-head-card"]').filter({ hasText: processName }).first()
    await expect(card).toBeVisible()
    await expect(card).toContainText('交出物类型：成衣')
    await expect(card).toContainText('计划交出成衣件数（件）')
    await expect(card).toContainText('仓库回写成衣件数（件）')
  }
  await expectNoPageErrors(errors)

  const printingPage = await page.context().newPage()
  const printingErrors = collectPageErrors(printingPage)
  await seedLocalStorage(printingPage, { fcs_pda_factory_id: 'ID-F002' })
  await printingPage.goto('/fcs/pda/handover?tab=handout', { waitUntil: 'commit' })
  await printingPage.locator('[data-testid="handout-head-card"]').first().waitFor({ timeout: 30_000 })
  const printingCard = printingPage
    .locator('[data-testid="handout-head-card"]')
    .filter({ hasText: printingHead!.handoverId })
    .first()
  await expect(printingCard).toBeVisible()
  await expect(printingCard).toContainText('交出物类型：裁片')
  await expect(printingCard).toContainText('可折算成衣件数')
  await printingCard.getByRole('button', { name: '查看交出详情', exact: true }).click()
  await expect(printingPage.locator('body')).toContainText('SKU 编码')
  await expect(printingPage.locator('body')).toContainText('部位名称')
  await expect(printingPage.locator('body')).toContainText('计划交出裁片片数（片）')
  await expect(printingPage.locator('body')).toContainText('可折算成衣件数')
  await expectNoPageErrors(printingErrors)
  await printingPage.close()

  const dyeingPage = await page.context().newPage()
  const dyeingErrors = collectPageErrors(dyeingPage)
  await seedLocalStorage(dyeingPage, { fcs_pda_factory_id: 'ID-F003' })
  await dyeingPage.goto('/fcs/pda/handover?tab=handout', { waitUntil: 'commit' })
  await dyeingPage.locator('[data-testid="handout-head-card"]').first().waitFor({ timeout: 30_000 })
  const dyeingCard = dyeingPage
    .locator('[data-testid="handout-head-card"]')
    .filter({ hasText: dyeingHead!.handoverId })
    .first()
  await expect(dyeingCard).toBeVisible()
  await expect(dyeingCard).toContainText('交出物类型：面料')
  await expect(dyeingCard).toContainText('计划交出面料卷数（卷）')
  await expect(dyeingCard).toContainText('仓库回写面料卷数（卷）')
  await expectNoPageErrors(dyeingErrors)
  await dyeingPage.close()
})

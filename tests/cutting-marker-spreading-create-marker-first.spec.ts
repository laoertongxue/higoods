import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('铺布创建页按 marker-first 创建，并从唛架入口自动带入 markerId', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/spreading-create?markerId=missing-marker')
  await expect(page.getByTestId('cutting-spreading-create-page')).toBeVisible()
  await expect(page.getByRole('button', { name: '下一步' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '已选中' })).toHaveCount(0)

  await page.goto('/fcs/craft/cutting/spreading-create')
  await expect(page.getByTestId('cutting-spreading-create-page')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: '新建铺布' })).toBeVisible()
  await expect(page.getByRole('button', { name: '下一步' })).toBeDisabled()

  const sourceTable = page.getByTestId('cutting-spreading-create-source-table')
  const rows = sourceTable.locator('tbody tr')
  expect(await rows.count()).toBeGreaterThanOrEqual(6)
  await expect(sourceTable).toContainText('原始裁片单')
  await expect(sourceTable).toContainText('合并裁剪批次')
  await expect(sourceTable).toContainText('普通模式')
  await expect(sourceTable).toContainText('高低层模式')
  await expect(sourceTable).toContainText('对折-普通模式')
  await expect(sourceTable).toContainText('对折-高低层模式')
  await expect(sourceTable.locator('p.font-mono').first()).toBeVisible()

  await rows.first().getByRole('button', { name: '选中' }).click()
  await expect(page.getByRole('button', { name: '下一步' })).toBeEnabled()
  await page.getByRole('button', { name: '下一步' }).click()

  await expect(page.getByTestId('cutting-spreading-create-confirmation')).toBeVisible()
  await expect(page.getByText('来源唛架编号')).toBeVisible()
  await expect(page.getByText('计划裁剪成衣件数（件）')).toBeVisible()
  await expect(page.getByText('计划铺布总长度（m）')).toBeVisible()
  await expect(page.getByTestId('cutting-spreading-create-confirmation').locator('p.font-mono').first()).toBeVisible()

  await page.getByRole('button', { name: '确认创建并进入编辑' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-edit\?/)
  await expect(page).toHaveURL(/sessionId=/)
  await expect(page.getByRole('heading', { level: 1, name: '铺布编辑' })).toBeVisible()

  const sessionId = new URL(page.url()).searchParams.get('sessionId')
  expect(sessionId).toBeTruthy()

  const created = await page.evaluate(({ currentSessionId }) => {
    const raw = window.localStorage.getItem('cuttingMarkerSpreadingLedger')
    if (!raw || !currentSessionId) return null
    const parsed = JSON.parse(raw)
    const session = Array.isArray(parsed?.sessions)
      ? parsed.sessions.find((item: Record<string, unknown>) => item.spreadingSessionId === currentSessionId)
      : null
    if (!session) return null
    return {
      sourceMarkerId: session.sourceMarkerId,
      sourceMarkerNo: session.sourceMarkerNo,
      isExceptionBackfill: Boolean(session.isExceptionBackfill),
      planUnitsLength: Array.isArray(session.planUnits) ? session.planUnits.length : 0,
    }
  }, { currentSessionId: sessionId })

  expect(created).toBeTruthy()
  expect(created?.sourceMarkerId).toBeTruthy()
  expect(created?.sourceMarkerNo).toBeTruthy()
  expect(created?.isExceptionBackfill).toBe(false)
  expect(created?.planUnitsLength).toBeGreaterThan(0)

  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '已建唛架' }).click()
  const readyRow = page.getByTestId('marker-plan-list-table').locator('tbody tr').filter({ hasText: '可交接铺布' }).first()
  await readyRow.getByRole('button', { name: '交给铺布' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-create\?/)
  await expect(page).toHaveURL(/markerId=/)
  await expect(page.getByRole('button', { name: '已选中' })).toBeVisible()

  await expectNoPageErrors(errors)
})

test('异常补录铺布必须填写原因，创建后仍会生成 session 与 planUnits', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/spreading-list')
  await expect(page.getByRole('button', { name: '按唛架新建铺布' })).toBeVisible()
  await page.getByRole('button', { name: '异常补录铺布' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-create\?/)
  await expect(page).toHaveURL(/exceptionEntry=1/)
  await expect(page.getByTestId('cutting-spreading-create-page')).toBeVisible()

  await page.getByRole('button', { name: '下一步' }).click()
  await expect(page.getByTestId('cutting-spreading-create-confirmation')).toBeVisible()

  await page.getByRole('button', { name: '确认创建并进入编辑' }).click()
  await expect(page.getByText('异常补录铺布必须填写异常补录原因。')).toBeVisible()

  await page.getByLabel('异常补录原因').fill('现场补录：换卷后补记本次铺布。')
  await page.getByRole('button', { name: '确认创建并进入编辑' }).click()

  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-edit\?/)
  const sessionId = new URL(page.url()).searchParams.get('sessionId')
  expect(sessionId).toBeTruthy()

  const created = await page.evaluate(({ currentSessionId }) => {
    const raw = window.localStorage.getItem('cuttingMarkerSpreadingLedger')
    if (!raw || !currentSessionId) return null
    const parsed = JSON.parse(raw)
    const session = Array.isArray(parsed?.sessions)
      ? parsed.sessions.find((item: Record<string, unknown>) => item.spreadingSessionId === currentSessionId)
      : null
    if (!session) return null
    return {
      sourceMarkerId: session.sourceMarkerId,
      isExceptionBackfill: Boolean(session.isExceptionBackfill),
      exceptionReason: session.exceptionReason,
      planUnitsLength: Array.isArray(session.planUnits) ? session.planUnits.length : 0,
    }
  }, { currentSessionId: sessionId })

  expect(created).toBeTruthy()
  expect(created?.sourceMarkerId || '').toBe('')
  expect(created?.isExceptionBackfill).toBe(true)
  expect(created?.exceptionReason).toContain('现场补录')
  expect(created?.planUnitsLength).toBeGreaterThan(0)

  await expectNoPageErrors(errors)
})

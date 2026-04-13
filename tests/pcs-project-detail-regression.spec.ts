import { expect, test } from '@playwright/test'

import { listProjects } from '../src/data/pcs-project-repository.ts'

const terminatedProject = listProjects().find((project) => project.projectId === 'prj_20251216_025')

if (!terminatedProject) {
  throw new Error('未找到可用于项目详情回归的已终止项目样本 prj_20251216_025')
}

test('商品项目列表可从项目名称和查看详情进入项目详情页', async ({ page }) => {
  const detailPath = `/pcs/projects/${terminatedProject.projectId}`

  await page.goto('/pcs/projects', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '商品项目列表', exact: true })).toBeVisible()

  const entryButtons = page.locator(`button[data-nav="${detailPath}"]`)
  await expect(entryButtons).toHaveCount(2)

  await entryButtons.first().click()
  await expect(page).toHaveURL(new RegExp(`${terminatedProject.projectId}$`))
  await expect(page.getByRole('heading', { name: terminatedProject.projectName, exact: true })).toBeVisible()

  await page.goto('/pcs/projects', { waitUntil: 'domcontentloaded' })
  await entryButtons.last().click()
  await expect(page).toHaveURL(new RegExp(`${terminatedProject.projectId}$`))
  await expect(page.getByRole('heading', { name: terminatedProject.projectName, exact: true })).toBeVisible()
})

test('已终止项目详情页默认回到当前节点并屏蔽前推动作', async ({ page }) => {
  await page.goto(`/pcs/projects/${terminatedProject.projectId}`, { waitUntil: 'domcontentloaded' })

  const summary = page.locator('[data-pcs-project-current-position="summary"]')
  await expect(summary).toBeVisible()
  await expect(summary).toContainText('已终止')
  await expect(summary).toContainText('商品上架与市场测款')
  await expect(summary).toContainText('测款结论判定')
  await expect(summary).toContainText('已取消')

  await expect(
    page.locator('button').filter({ hasText: '测款结论判定' }).filter({ hasText: '当前' }).first(),
  ).toBeVisible()

  await expect(page.getByRole('button', { name: '生成款式档案', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '创建项目资料归档', exact: true })).toHaveCount(0)
})

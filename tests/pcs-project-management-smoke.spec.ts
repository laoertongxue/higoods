import { expect, test } from '@playwright/test'

import { listProjectInlineNodeRecordsByWorkItemType } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { listProjects } from '../src/data/pcs-project-repository.ts'
import { listPcsWorkItemLibraryRows } from '../src/data/pcs-work-item-library-view-model.ts'

const projectWithLinkedTechPack = listProjects().find((project) => project.linkedTechPackVersionId)
const sampleAcquireRecord = listProjectInlineNodeRecordsByWorkItemType('SAMPLE_ACQUIRE')[0]
const projectInitWorkItem = listPcsWorkItemLibraryRows().find((row) => row.code === 'PROJECT_INIT')

if (!projectWithLinkedTechPack) {
  throw new Error('未找到可用于商品项目详情页 smoke test 的技术包项目样本')
}

if (!sampleAcquireRecord) {
  throw new Error('未找到可用于节点详情页 smoke test 的样衣获取正式记录样本')
}

if (!projectInitWorkItem) {
  throw new Error('未找到可用于工作项详情页 smoke test 的商品项目立项定义')
}

test('商品项目详情页能稳定展示技术包链路与项目动态', async ({ page }) => {
  await page.goto(`/pcs/projects/${projectWithLinkedTechPack.projectId}`, { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: projectWithLinkedTechPack.projectName, exact: true })).toBeVisible()
  await expect(page.getByText('渠道商品、款式档案与技术包链路', { exact: true })).toBeVisible()
  await expect(page.getByText('技术包版本链路', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '查看技术包版本', exact: true }).first()).toBeVisible()
  await expect(page.getByText('项目动态', { exact: true })).toBeVisible()
  await expect(page.locator('[data-pcs-project-current-position="summary"]')).toBeVisible()
})

test('商品项目节点详情页对 inline 节点默认展示字段与记录区块', async ({ page }) => {
  await page.goto(
    `/pcs/projects/${sampleAcquireRecord.projectId}/work-items/${sampleAcquireRecord.projectNodeId}`,
    { waitUntil: 'domcontentloaded' },
  )

  await expect(page.getByText('当前状态说明', { exact: true })).toBeVisible()
  await expect(page.getByText('当前可操作', { exact: true })).toBeVisible()
  await expect(page.locator('[data-pcs-node-detail-section="field-definitions"]')).toBeVisible()
  await expect(page.locator('[data-pcs-node-detail-section="statuses"]')).toBeVisible()
  await expect(page.locator('[data-pcs-node-detail-section="operations"]')).toBeVisible()
  await expect(page.getByText('记录列表', { exact: true }).first()).toBeVisible()

  await page.getByRole('button', { name: '记录', exact: true }).click()
  await expect(page.locator('article, section, div').filter({ hasText: sampleAcquireRecord.recordCode }).first()).toBeVisible()
  await expect(page.getByText('当前暂无正式记录', { exact: true })).toHaveCount(0)
})

test('工作项库列表与详情页展示只读元数据说明', async ({ page }) => {
  await page.goto('/pcs/work-items', { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: '工作项库', exact: true })).toBeVisible()
  await expect(page.getByText('字段', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('状态', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('操作', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('实例承载方式', { exact: true })).toBeVisible()
  await expect(page.getByText('独立实例列表', { exact: true })).toBeVisible()
  await expect(page.getByText('主实例模块 / 项目内展示方式', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '新增工作项', exact: true })).toHaveCount(0)

  await page.goto(`/pcs/work-items/${projectInitWorkItem.id}`, { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: projectInitWorkItem.name, exact: true })).toBeVisible()
  await expect(page.getByText(/字段清单/).first()).toBeVisible()
  await expect(page.getByText(/状态定义/).first()).toBeVisible()
  await expect(page.getByText(/可操作项/).first()).toBeVisible()
  await expect(page.getByText(/实例承载方式/).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '编辑工作项', exact: true })).toHaveCount(0)
})

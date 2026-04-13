import { expect, test } from '@playwright/test'

import { getProjectNodeRecordByWorkItemTypeCode, listProjects } from '../src/data/pcs-project-repository.ts'

const listingProject = listProjects().find((project) =>
  getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'CHANNEL_PRODUCT_LISTING'),
)
const aggregateProject = listProjects().find(
  (project) =>
    project.linkedTechPackVersionId &&
    getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'PROJECT_TRANSFER_PREP'),
)

const listingNode = listingProject
  ? getProjectNodeRecordByWorkItemTypeCode(listingProject.projectId, 'CHANNEL_PRODUCT_LISTING')
  : null
const aggregateNode = aggregateProject
  ? getProjectNodeRecordByWorkItemTypeCode(aggregateProject.projectId, 'PROJECT_TRANSFER_PREP')
  : null

if (!listingProject || !listingNode) {
  throw new Error('未找到可用于独立实例节点回归的商品上架节点样本')
}

if (!aggregateProject || !aggregateNode) {
  throw new Error('未找到可用于聚合节点回归的项目转档准备节点样本')
}

test('独立实例节点默认展示关联实例摘要与查看入口', async ({ page }) => {
  await page.goto(`/pcs/projects/${listingProject.projectId}/work-items/${listingNode.projectNodeId}`, {
    waitUntil: 'domcontentloaded',
  })

  await expect(page.getByText('当前状态说明', { exact: true })).toBeVisible()
  await expect(page.getByText('当前可操作', { exact: true })).toBeVisible()
  await expect(page.getByText('关联实例', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('相关去向 / 查看入口', { exact: true })).toBeVisible()
  await expect(page.locator('[data-pcs-node-detail-section="field-definitions"]')).toHaveCount(0)

  await page.getByRole('button', { name: '记录', exact: true }).click()
  await expect(page.getByText('当前节点以独立实例模块承载，请通过关联实例入口查看。', { exact: true })).toBeVisible()
})

test('聚合节点默认展示技术包与项目归档聚合区块', async ({ page }) => {
  await page.goto(`/pcs/projects/${aggregateProject.projectId}/work-items/${aggregateNode.projectNodeId}`, {
    waitUntil: 'domcontentloaded',
  })

  await expect(page.getByText('技术包版本关联', { exact: true })).toBeVisible()
  await expect(page.getByText('项目资料归档', { exact: true }).first()).toBeVisible()
  await expect(page.locator('[data-pcs-node-detail-section="field-definitions"]')).toHaveCount(0)

  await page.getByRole('button', { name: '记录', exact: true }).click()
  await expect(page.getByText('当前节点通过聚合对象承载，不单独维护记录列表。', { exact: true })).toBeVisible()
})

import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.addInitScript('globalThis.__name = (value) => value')
  await page.goto(`${process.env.PCS_CHECK_URL || 'http://127.0.0.1:5173'}/pcs/testing/orders/create`)
  await page.selectOption('#testing-create-style', 'style_demand_PRJ_202603_010')
  await page.getByRole('button', { name: '创建测款单', exact: true }).click()
  await page.getByText('TO-0006', { exact: true }).first().waitFor()
  const records = await page.evaluate(async () => {
    // @ts-ignore Browser module URL served by Vite.
    return (await (await import('/src/data/pcs-record-db.ts')).readPcsRecords()).records
  })
  const styles = records.filter((record: any) => record.collection === 'higood-pcs-style-archive-store-v3/records')
  assert.equal(styles.length, 1, 'creating a testing order must not persist normalization changes for all demo styles')
  assert.ok(styles[0].id.endsWith('/style_demand_PRJ_202603_010'))
  assert.equal(records.filter((record: any) => record.collection === 'higood-pcs-testing-orders-v1/items').length, 1)
  assert.equal(records.length, 4, 'only the new order, linked style and their metadata may be written')
  await page.reload()
  await page.getByText('TO-0006', { exact: true }).first().waitFor()
  const after = await page.evaluate(async () => {
    // @ts-ignore Browser module URL served by Vite.
    return (await (await import('/src/data/pcs-record-db.ts')).readPcsRecords()).records
  })
  assert.deepEqual(after, records, 'refresh must not copy seed records or rewrite the saved records')
  console.log('PCS 新建测款按关联记录落盘与刷新无种子写入：通过')
} finally { await browser.close() }

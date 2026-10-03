import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.addInitScript('globalThis.__name = (value) => value')
  await page.goto('http://127.0.0.1:5173/pcs/products/styles')
  await page.locator('[data-pcs-product-archive-field="style-list-search"]').waitFor()
  const result = await page.evaluate(async () => {
    // @ts-ignore Vite-only isolated storage regression.
    const runtime = await import('/src/data/pcs-record-runtime.ts')
    // @ts-ignore Vite-only module.
    const sku = await import('/src/data/pcs-sku-archive-repository.ts')
    // @ts-ignore Vite-only module.
    const db = await import('/src/data/pcs-record-db.ts')
    await runtime.ensurePcsRecordState()
    const original = sku.listSkuArchives()[0]
    const before = await db.readPcsRecords()
    await runtime.runPcsRecordCommand(() => sku.createSkuArchive({ ...original, skuId: 'QA-ROW-SCOPE', skuCode: 'QA-ROW-SCOPE', updatedAt: '2099-01-01 00:00:00' }))
    const after = await db.readPcsRecords()
    const rows = after.records.filter((row: any) => !row.id.endsWith('/meta'))
    if (rows.length !== 2 || !rows.some((row: any) => row.value?.data?.skuId === 'QA-ROW-SCOPE') || !rows.some((row: any) => row.value?.data?.styleId === original.styleId && !row.value?.data?.skuId)) throw Error('新增单个SKU复制了未修改的静态记录：' + rows.map((row: any) => row.id).join(','))
    if (sku.listSkuArchives()[0].skuId !== 'QA-ROW-SCOPE') throw Error('新增SKU展示顺序改变')
    const versions = new Map(after.records.map((row: any) => [row.id, row.version]))
    await runtime.runPcsRecordCommand(() => sku.updateSkuArchive('QA-ROW-SCOPE', { mappingHealth: 'CONFLICT' }))
    const updated = await db.readPcsRecords()
    const changed = updated.records.filter((row: any) => row.version !== versions.get(row.id))
    if (changed.length !== 1 || changed[0].value?.data?.skuId !== 'QA-ROW-SCOPE') throw Error('单条修改重写了其他记录')
    return { initialRows: before.records.length, createdRows: after.records.length, dataRows: rows.length, changedIds: changed.map((row: any) => row.id) }
  })
  assert.equal(result.initialRows, 0)
  await page.reload()
  await page.locator('[data-pcs-product-archive-field="style-list-search"]').waitFor()
  const persisted = await page.evaluate(async () => {
    // @ts-ignore Vite-only module.
    const sku = await import('/src/data/pcs-sku-archive-repository.ts')
    return { first: sku.listSkuArchives()[0].skuId, conflict: sku.getSkuArchiveById('QA-ROW-SCOPE')?.mappingHealth }
  })
  assert.deepEqual(persisted, { first: 'QA-ROW-SCOPE', conflict: 'CONFLICT' })
  await writeFile('output/playwright/pcs-consistency/record-write-scope.json', JSON.stringify({ ...result, persisted }, null, 2))
  console.log('PCS单记录新增/修改仅落必要记录，排序及刷新保持一致', result)
} finally { await browser.close() }

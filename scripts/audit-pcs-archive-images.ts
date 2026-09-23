#!/usr/bin/env tsx

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { listMaterialArchives, listMaterialSkuRecordsByMaterialId } from '../src/data/pcs-material-archive-repository.ts'
import { listSkuArchives } from '../src/data/pcs-sku-archive-repository.ts'
import { listStyleArchives } from '../src/data/pcs-style-archive-repository.ts'
import { PCS_IMAGE_PATHS, PCS_MATERIAL_IMAGE_KEYS, PCS_STYLE_IMAGE_KEYS } from '../src/data/pcs-reviewed-image-catalog.ts'

const ledger = JSON.parse(readFileSync('docs/product-design/PCS图片素材来源清单.json', 'utf8'))
const rows: string[][] = [['对象', '编码', '名称', '颜色', '现有图片', '素材键', '来源', '文件状态', '校对结论']]
function add(kind: string, code: string, name: string, color: string, url: string, key: string): void {
  assert.ok(key, `${code} 缺少固定素材绑定`)
  const source = ledger.assets[key]
  assert.ok(source?.sourcePage && source?.review, `${code} 缺少来源或逐图校对记录`)
  assert.equal(url, PCS_IMAGE_PATHS[key], `${code} 当前读取的图片与固定绑定不符`)
  assert.equal(url, source.localPath)
  const bytes = readFileSync(`public${url}`)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256, `${code} 图片发生变化，必须重新校对`)
  rows.push([kind, code, name, color, url, key, source.sourcePage, '本地存在且哈希一致', '已校对 Mock 品类/颜色实拍；不作为真实实物身份或尺寸凭据'])
}

for (const style of listStyleArchives()) {
  add('款式', style.styleCode, style.styleName, Object.keys(PCS_STYLE_IMAGE_KEYS[style.styleCode] || {})[0], style.mainImageUrl,
    Object.values(PCS_STYLE_IMAGE_KEYS[style.styleCode] || {})[0])
}
for (const sku of listSkuArchives()) {
  add('成衣 SKU', sku.skuCode, sku.styleName, sku.colorName, sku.skuImageUrl, PCS_STYLE_IMAGE_KEYS[sku.styleCode]?.[sku.colorName])
}
for (const material of listMaterialArchives()) {
  for (const sku of listMaterialSkuRecordsByMaterialId(material.materialId)) {
    add('物料 SKU', sku.materialSkuCode, sku.materialName, sku.colorName || '', sku.skuImageUrl, PCS_MATERIAL_IMAGE_KEYS[sku.materialSkuCode])
  }
}
process.stdout.write(rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n') + '\n')
console.error(`PCS 图片固定绑定检查通过：${rows.length - 1} 个对象；本地文件、当前读取值、来源、校对哈希一致。`)

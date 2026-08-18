#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { matchesWarehouseInventoryQueryCode } from '../src/pages/pda-warehouse-query-code.ts'

const stocktakeSource = readFileSync(new URL('../src/pages/pda-warehouse-stocktake.ts', import.meta.url), 'utf8')
const warehouseSource = readFileSync(new URL('../src/pages/pda-warehouse.ts', import.meta.url), 'utf8')
const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')

assert(matchesWarehouseInventoryQueryCode(['SKU-A', 'PO-001', 'TB-001'], 'po-001'), '编码查询必须忽略大小写并精确命中')
assert(!matchesWarehouseInventoryQueryCode(['SKU-A', 'PO-001'], 'PO-00'), '编码查询不得使用模糊包含匹配')
assert(!matchesWarehouseInventoryQueryCode(['SKU-A'], ''), '空编码不得返回库存')

for (const token of ['物料码', '生产单', '中转袋', '菲票码', '库位码', '加工单号']) {
  assert(stocktakeSource.includes(token), `扫码查询输入缺少编码类型：${token}`)
  assert(warehouseSource.includes(token), `仓管首页扫码查询说明缺少编码类型：${token}`)
}
assert(!stocktakeSource.includes('载具'), '扫码查询页必须统一使用“中转袋”，不得保留“载具”')
assert(!warehouseSource.includes('载具'), '仓管首页必须统一使用“中转袋”，不得保留“载具”')

for (const codeField of [
  'item.materialSku',
  'item.productionOrderNo',
  'item.transferBagNo',
  'item.feiTicketNo',
  'item.locationNo',
  'item.taskNo',
  'woolOrder?.woolOrderNo',
]) {
  assert(stocktakeSource.includes(codeField), `统一编码索引缺少：${codeField}`)
}
const searchCodeBlock = stocktakeSource.match(/function buildInventorySearchCodes[\s\S]+?\n}\n/)?.[0] || ''
for (const forbiddenCodeField of [
  'item.stockMaterialId',
  'item.productionOrderId',
  'item.taskId',
  'item.sourceRecordNo',
  'item.fabricRollNo',
  'item.areaName',
  'item.shelfNo',
  'item.locationText',
]) {
  assert(!searchCodeBlock.includes(forbiddenCodeField), `统一编码索引不得混入非六类现场编码：${forbiddenCodeField}`)
}

assert(stocktakeSource.includes('inventoryQueryDraft'), '手动输入必须使用独立草稿，不能直接触发结果过滤')
assert(stocktakeSource.includes('data-skip-page-rerender="true"'), '手动输入不得逐字重绘或查询')
assert(!stocktakeSource.includes('state.inventoryQueryDraft = value'), '输入事件不得写回查询草稿，避免与扫码回车提交竞争')
assert(stocktakeSource.includes('data-pda-warehouse-action="run-inventory-query"'), '手动输入必须点击查询按钮提交')
assert(stocktakeSource.includes("submitInventoryQuery(inputNode?.value ?? state.inventoryQueryDraft, 'manual')"), '查询按钮必须提交当前手动输入')
assert(stocktakeSource.includes('data-pda-scan-enter="true"'), '扫码输入必须支持扫码枪回车自动查询')
assert(stocktakeSource.includes("event?.type === 'keydown'"), '扫码自动查询必须由回车事件触发')
assert(mainSource.includes('[data-pda-scan-enter="true"]'), '全局 PDA 键盘路由必须识别扫码回车输入')
assert(stocktakeSource.includes("state.inventoryQueryOrigin === 'scan' ? '扫码结果' : '查询结果'"), '结果必须区分扫码与手动查询')
assert(stocktakeSource.includes('submittedQuery ?'), '未执行查询前不得展示全量库存结果')
assert(!stocktakeSource.includes('确认扫码查询'), '页面不得保留多余的“确认扫码查询”文案')
assert(!stocktakeSource.includes('扫描后展示匹配到的当前库存对象'), '页面不得保留无关扫码说明')
assert(stocktakeSource.includes('data-pda-image-preview-url'), '库存物料结果必须支持查看真实图片大图')
assert(stocktakeSource.includes('图片加载失败'), '库存物料图片必须提供加载失败反馈')

console.log('PDA 仓管统一编码查询、手输提交与扫码自动查询检查通过')

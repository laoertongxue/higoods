#!/usr/bin/env node

import {
  appendAutoPrepRecordForOrder,
  classifyPrepLineType,
  getMaterialPrepRecordItems,
  listMaterialPrepOrderProjections,
  type MaterialPrepLine,
} from '../src/data/fcs/cutting/production-material-prep.ts'
import { renderFcsCuttingPrepPage } from '../src/pages/fcs/material-prep/cutting.ts'

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function categoryOf(line: Pick<MaterialPrepLine, 'materialType' | 'upstreamSourceType' | 'upstreamProgressStatus'>): string {
  return classifyPrepLineType(line)
}

const projections = listMaterialPrepOrderProjections(null)
const projection = projections.find((item) =>
  item.lines.some((line) => categoryOf(line) === '裁片配料') &&
  item.lines.some((line) => categoryOf(line) !== '裁片配料' && line.canPrepQty > 0),
)

assert(projection, '缺少同时覆盖裁片物料和非裁片可配物料的配料单样例')

const cuttingLines = projection.lines.filter((line) => categoryOf(line) === '裁片配料')
const nonCuttingLines = projection.lines.filter((line) => categoryOf(line) !== '裁片配料')

assert(cuttingLines.length > 0, `${projection.order.productionOrderNo} 缺少裁片配料物料`)
assert(nonCuttingLines.length > 0, `${projection.order.productionOrderNo} 缺少非裁片物料，无法验证裁片页过滤`)

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    location: {
      search: `?prepOrderId=${encodeURIComponent(projection.order.prepOrderId)}&prepModal=1`,
    },
  },
})

const html = renderFcsCuttingPrepPage()

assert(!html.includes('min-w-[1500px]'), '新增配料弹窗不应再使用 1500px 宽表导致横向滑动')
assert(html.includes('data-fcs-prep-line-card'), '新增配料弹窗应按物料卡片/两行结构展示')
assert(html.includes('配料操作'), '新增配料弹窗应把本次数量和卷/件数放进可见操作区')
assert(html.includes('填当前可配'), '新增配料弹窗应提供填当前可配的快捷动作')

cuttingLines.forEach((line) => {
  assert(html.includes(line.materialSku), `裁片配料弹窗缺少裁片物料：${line.materialSku}`)
})

nonCuttingLines.forEach((line) => {
  assert(!html.includes(line.materialSku), `裁片配料弹窗不应包含非裁片物料：${line.materialSku}`)
})

const storage = new MemoryStorage()
const record = appendAutoPrepRecordForOrder(projection.order.prepOrderId, '配料小组 周敏', storage, '裁片配料')

assert(record, '裁片配料应能生成待拣货记录')

const lineById = new Map(projection.lines.map((line) => [line.prepLineId, line]))
getMaterialPrepRecordItems(record).forEach((item) => {
  const line = lineById.get(item.prepLineId)
  assert(line, `配料记录引用了不存在的物料行：${item.prepLineId}`)
  assert(categoryOf(line) === '裁片配料', `裁片配料记录不应写入非裁片物料：${line.materialSku}`)
})

console.log(`FCS 裁片配料范围和弹窗布局检查通过：${projection.order.productionOrderNo}`)

#!/usr/bin/env node

import { listMaterialPrepOrderProjections } from '../src/data/fcs/cutting/production-material-prep.ts'
import { renderFcsCuttingPrepPage } from '../src/pages/fcs/material-prep/cutting.ts'
import { renderFcsDyeingPrepPage } from '../src/pages/fcs/material-prep/dyeing.ts'
import { renderFcsOtherPrepPage } from '../src/pages/fcs/material-prep/other.ts'
import { renderFcsPrintingPrepPage } from '../src/pages/fcs/material-prep/printing.ts'
import { renderFcsSewingPrepPage } from '../src/pages/fcs/material-prep/sewing.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

type PageCase = {
  label: string
  pathname: string
  render: () => string
}

const pageCases: PageCase[] = [
  { label: '染色配料', pathname: '/fcs/material-prep/dyeing', render: renderFcsDyeingPrepPage },
  { label: '印花配料', pathname: '/fcs/material-prep/printing', render: renderFcsPrintingPrepPage },
  { label: '裁片配料', pathname: '/fcs/material-prep/cutting', render: renderFcsCuttingPrepPage },
  { label: '车缝配料', pathname: '/fcs/material-prep/sewing', render: renderFcsSewingPrepPage },
  { label: '其他配料', pathname: '/fcs/material-prep/other', render: renderFcsOtherPrepPage },
]

const originalWindow = (globalThis as typeof globalThis & { window?: unknown }).window

function withWindow(pathname: string, search: string, render: () => string): string {
  ;(globalThis as typeof globalThis & { window: unknown }).window = {
    location: { pathname, search },
    history: { pushState() {}, replaceState() {} },
    addEventListener() {},
    removeEventListener() {},
  }
  return render()
}

function beforeDetailTabs(html: string, label: string): string {
  const markers = ['detailTab=inventory', 'detailTab=records', 'detailTab=tasks', 'detailTab=pickup']
  const tabIndexes = markers.map((marker) => html.indexOf(marker)).filter((index) => index >= 0)
  assert(tabIndexes.length > 0, `${label} 详情必须渲染详情 Tab`)
  return html.slice(0, Math.min(...tabIndexes))
}

try {
  const firstOrder = listMaterialPrepOrderProjections()[0]
  assert(firstOrder, '检查脚本需要至少一条配料单 mock 数据')

  for (const item of pageCases) {
    const baseSearch = `?prepOrderId=${encodeURIComponent(firstOrder.order.prepOrderId)}`
    const html = withWindow(item.pathname, baseSearch, item.render)
    assert(html.includes('生产需求信息'), `${item.label} 详情必须保留 Tab`)
    const summaryBeforeTabs = beforeDetailTabs(html, item.label)
    ;['配料状态', '领料状态', '物料行', '缺料缺口', 'BOM 来源', '暂存区台账', '仓库拣货进度', '完成通知', '分配回写'].forEach((text) => {
      assert(!summaryBeforeTabs.includes(text), `${item.label} Tab 上方不能再展示摘要字段：${text}`)
    })

    const demandHtml = withWindow(item.pathname, `${baseSearch}&detailTab=demand`, item.render)
    assert(demandHtml.includes('BOM 来源'), `${item.label} 生产需求信息 Tab 必须展示 BOM 来源`)

    const inventoryHtml = withWindow(item.pathname, `${baseSearch}&detailTab=inventory`, item.render)
    assert(inventoryHtml.includes('缺料缺口'), `${item.label} 库存与上游 Tab 必须展示缺料缺口`)

    const recordsHtml = withWindow(item.pathname, `${baseSearch}&detailTab=records`, item.render)
    assert(recordsHtml.includes('暂存区台账'), `${item.label} 配料记录 Tab 必须展示暂存区台账`)
    assert(recordsHtml.includes('完成通知'), `${item.label} 配料记录 Tab 必须展示完成通知`)

    const tasksHtml = withWindow(item.pathname, `${baseSearch}&detailTab=tasks`, item.render)
    assert(tasksHtml.includes('分配回写'), `${item.label} 按任务查看 Tab 必须展示分配回写`)

    const pickupHtml = withWindow(item.pathname, `${baseSearch}&detailTab=pickup`, item.render)
    assert(pickupHtml.includes('领料状态'), `${item.label} 领料记录 Tab 必须展示领料状态`)
    assert(pickupHtml.includes('仓库拣货进度'), `${item.label} 领料记录 Tab 必须展示仓库拣货进度`)
  }
} finally {
  if (originalWindow === undefined) {
    delete (globalThis as typeof globalThis & { window?: unknown }).window
  } else {
    ;(globalThis as typeof globalThis & { window: unknown }).window = originalWindow
  }
}

console.log('配料详情摘要区清理检查通过')

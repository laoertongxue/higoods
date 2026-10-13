// @page-pattern: pda
// 线上 PDA 管理入口。已有手持页直接进入，其余入口保留名称并说明尚未接入。

import { escapeHtml } from '../../utils.ts'

const GROUPS: Array<{ title: string; items: Array<{ title: string; href?: string; note?: string }> }> = [
  {
    title: '成衣仓',
    items: [
      { title: '收货', href: '/wls/finished/pda' },
      { title: '上架', href: '/wls/finished/pda' },
      { title: '拣货', href: '/wls/finished/pda' },
      { title: '出库', href: '/wls/finished/pda-ship-scan' },
    ],
  },
  {
    title: '原料仓',
    items: [
      { title: '面料上架', href: '/wls/raw/pda' },
      { title: '辅料上架', href: '/wls/raw/pda' },
      { title: '调拨', href: '/wls/raw/pda' },
      { title: '盘点', href: '/wls/raw/pda' },
    ],
  },
  {
    title: '裁床中转仓',
    items: [
      { title: '扫码收货', href: '/wls/transit/pda' },
      { title: '扫描配料', href: '/wls/transit/pda' },
    ],
  },
  {
    title: '待加工仓 / 样衣仓 / 货物交接 / 固定资产仓',
    items: [
      { title: '待加工仓盘点', note: '尚未接入' },
      { title: '样衣售后 / 入库 / 出库', note: '尚未接入' },
      { title: '扫印染交出单 / 确认交出', note: '尚未接入' },
      { title: '固定资产领取 / 回收', note: '尚未接入' },
    ],
  },
]

export function renderWlsPdaHomePage(): string {
  return `<div class="space-y-4" data-wls-pda-home="true">
    <h1 class="text-lg font-semibold">PDA 管理</h1>
    <div class="grid gap-3 md:grid-cols-2">
      ${GROUPS.map((group) => `<section class="rounded-md border border-slate-200 bg-white p-4"><h2 class="text-sm font-semibold text-slate-800">${escapeHtml(group.title)}</h2><div class="mt-3 grid gap-2">${group.items.map((item) => item.href
        ? `<a class="rounded border border-slate-200 px-3 py-2 text-sm text-blue-700" data-nav="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a>`
        : `<p class="rounded border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500">${escapeHtml(item.title)} · ${escapeHtml(item.note || '')}</p>`).join('')}</div></section>`).join('')}
    </div>
  </div>`
}

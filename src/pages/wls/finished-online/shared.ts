// 成衣出库域线上页（L1 泳道）列表公共片段。
// 仅提供单元格/页签渲染等纯展示辅助；标准列表骨架、表格与分页仍复用 src/components/ui/。
import { escapeHtml } from '../../../utils.ts'
import { toActionAttr } from '../../../components/ui/types.ts'

export type StatusTone = 'blue' | 'amber' | 'green' | 'slate' | 'red'

const TONE_CLASSES: Record<StatusTone, string> = {
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  green: 'bg-emerald-50 text-emerald-700',
  slate: 'bg-slate-100 text-slate-600',
  red: 'bg-rose-50 text-rose-700',
}

export function renderStatusBadge(label: string, tone: StatusTone): string {
  return `<span class="inline-block rounded-full px-2 py-0.5 text-xs ${TONE_CLASSES[tone]}">${escapeHtml(label)}</span>`
}

export type ProductCellInput = {
  image?: string
  name: string
  spu: string
  sku?: string
}

/** 商品信息单元格：有实拍图则展示缩略图，无图对象只展示文字（不用色块冒充图片）。 */
export function renderProductCell(product: ProductCellInput): string {
  const image = product.image
    ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" class="h-10 w-10 shrink-0 rounded-md border border-slate-200 object-cover" onerror="this.style.display='none'">`
    : ''
  const skuLine = product.sku
    ? `<div class="font-mono text-[11px] text-slate-500">${escapeHtml(product.sku)}</div>`
    : ''
  return `<div class="flex items-center gap-2">${image}<div class="min-w-0">
    <div class="truncate text-xs text-slate-700" title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</div>
    <div class="font-mono text-[11px] text-blue-600">${escapeHtml(product.spu)}</div>
    ${skuLine}
  </div></div>`
}

export type StatusTab = {
  key: string
  label: string
  count?: number
}

/** 状态页签按钮组：点击只按 route 触发局部刷新，不整页重绘。 */
export function renderStatusTabs(config: {
  prefix: string
  action: string
  activeKey: string
  tabs: readonly StatusTab[]
}): string {
  return `<div class="flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1">${config.tabs
    .map((tab) => {
      const active = tab.key === config.activeKey
      const tone = active
        ? 'bg-blue-600 text-white'
        : 'text-slate-600 hover:bg-slate-100'
      const count = typeof tab.count === 'number' ? `<span class="ml-1 tabular-nums">${tab.count}</span>` : ''
      return `<button type="button" class="rounded-md px-3 py-1.5 text-sm font-medium ${tone}" ${toActionAttr(
        { prefix: config.prefix, action: `${config.action}:${tab.key}`, skipPageRerender: true },
      )}>${escapeHtml(tab.label)}${count}</button>`
    })
    .join('')}</div>`
}

/** 解析页签/动作里携带的 key（action 形如 tab:all）。 */
export function parseActionKey(action: string, prefix: string): string | null {
  if (!action.startsWith(`${prefix}:`)) return null
  return action.slice(prefix.length + 1)
}

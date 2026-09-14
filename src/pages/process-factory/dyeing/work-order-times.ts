import { escapeHtml } from '../../../utils.ts'
import { formatDyeTimeItem, type DyeTimeSection } from '../../../data/fcs/dye-work-order-times.ts'

export function renderDyeWorkOrderTimes(sections: DyeTimeSection[], detail = false): string {
  return `<div class="divide-y divide-gray-200 text-xs" ${detail ? 'data-dye-time-detail' : 'data-dye-cell="time"'}>${sections.map(section => `
    <section class="py-3 first:pt-0 last:pb-0" data-dye-time-section="${section.key}">
      <div class="mb-2 text-xs font-medium text-slate-600">${escapeHtml(section.label)}</div>
      <div class="space-y-2">${section.items.map(item => `<div data-dye-time-key="${item.key}">
        <div class="flex items-start justify-between gap-2 leading-5"><span class="shrink-0 text-[11px] text-muted-foreground">${escapeHtml(item.label)}</span><div class="text-right tabular-nums text-slate-800">${formatDyeTimeItem(item).split('；').map(part => `<span class="block">${escapeHtml(part)}</span>`).join('')}</div></div>
        ${detail && item.events.length ? `<details class="mt-1" data-skip-page-rerender="true"><summary class="cursor-pointer text-blue-700">查看${escapeHtml(item.label)}记录（${item.events.length}）</summary><ul class="mt-1 space-y-1 border-l border-slate-200 pl-3">${item.events.map(event => `<li><span class="block break-all text-muted-foreground">${escapeHtml(event.reference)}</span><span class="tabular-nums">${escapeHtml(event.at || '历史时间未记录')}</span></li>`).join('')}</ul></details>` : ''}
      </div>`).join('')}</div>
    </section>`).join('')}</div>`
}

import { escapeHtml } from '../../utils.ts'
import { renderSecondaryButton } from './button.ts'

export function renderProcessOrderStats(items: Array<{ label: string; value: string | number }>): string {
  return `<div class="grid grid-cols-3 gap-2 xl:grid-cols-6" data-standard-list-stats>${items.map(item => `<div class="flex min-h-[72px] min-w-0 flex-col justify-start gap-1 rounded-lg border bg-card px-3 py-2" data-process-stat><span class="text-xs text-muted-foreground">${escapeHtml(item.label)}</span><strong class="break-words text-xs font-semibold tabular-nums">${String(item.value).split(' / ').map(part => `<span class="inline-block whitespace-nowrap">${escapeHtml(part)}</span>`).join(' / ')}</strong></div>`).join('')}</div>`
}

export function renderProcessSelectionHeader(ids: readonly string[], selected: ReadonlySet<string>, prefix: string): string {
  const count = ids.filter(id => selected.has(id)).length
  return `<div class="flex items-center gap-1"><input type="checkbox" aria-label="全选本页" aria-checked="${count && count < ids.length ? 'mixed' : Boolean(ids.length && count === ids.length)}" ${ids.length && count === ids.length ? 'checked' : ''} ${ids.length ? '' : 'disabled'} data-${prefix}-action="toggle-page" data-skip-page-rerender="true"><select aria-label="批量选择范围" class="h-7 w-7 cursor-pointer rounded border bg-background text-xs" data-${prefix}-field="selection-scope" data-skip-page-rerender="true"><option value="">▾</option><option value="page">全选本页</option><option value="all">全选筛选结果</option><option value="clear">清空选择</option></select></div>`
}

export function renderProcessFilterToggle(count = 0, appearance: 'link' | 'button' = 'link'): string {
  if (appearance === 'button') {
    return renderSecondaryButton(count > 0 ? '收起更多' : '更多筛选')
      .replace('<button', `<button data-process-filter-toggle data-process-filter-label aria-expanded="${count > 0}" data-skip-page-rerender="true"`)
  }
  return `<button type="button" class="inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-md px-3 text-sm text-blue-700 hover:bg-blue-50" data-process-filter-toggle aria-expanded="${count > 0}" data-skip-page-rerender="true">更多筛选<span data-process-filter-count>${count ? `（已选 ${count} 项）` : ''}</span><span data-process-filter-chevron>⌄</span></button>`
}

export function handleProcessFilterPresentation(root: HTMLElement, target: HTMLElement): boolean {
  const toggle = root.querySelector<HTMLButtonElement>('[data-process-filter-toggle]')
  const panel = root.querySelector<HTMLElement>('[data-process-advanced]')
  if (toggle && panel && target.closest('[data-process-filter-toggle]')) {
    panel.hidden = !panel.hidden
    toggle.setAttribute('aria-expanded', String(!panel.hidden))
    if (toggle.hasAttribute('data-process-filter-label')) toggle.textContent = panel.hidden ? '更多筛选' : '收起更多'
    const chevron = toggle.querySelector('[data-process-filter-chevron]')
    if (chevron) chevron.textContent = panel.hidden ? '⌄' : '⌃'
    return true
  }
  if (panel && toggle && target.matches('input,select')) {
    const count = [...panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select')].filter(field => field.value && !['ORDERED','orderedAt'].includes(field.value)).length
    const badge = toggle.querySelector('[data-process-filter-count]')
    if (badge) badge.textContent = count ? `（已选 ${count} 项）` : ''
  }
  return false
}

export function syncProcessSelectionHeader(root: HTMLElement): void {
  const box = root.querySelector<HTMLInputElement>('thead input[type="checkbox"]')
  if (box) box.indeterminate = box.getAttribute('aria-checked') === 'mixed'
}

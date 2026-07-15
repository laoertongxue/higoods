import { escapeHtml } from '../../utils.ts'
import { renderSecondaryButton } from './button.ts'
import { renderDrawer } from './drawer.ts'
import type { StandardListColumnPreferences, StandardListSortState } from './list-table-model.ts'
import { toActionAttr, toDataPrefix } from './types.ts'

export interface StandardListColumn<T> {
  key: string
  title: string
  width: number
  minWidth?: number
  align?: 'left' | 'center' | 'right'
  required?: boolean
  freezeable?: boolean
  sortable?: boolean
  actionColumn?: boolean
  /**
   * 返回可信 HTML。调用方必须先对来自业务数据的纯文本执行 HTML 转义。
   */
  render(row: T, index: number): string
  sortValue?: (row: T) => unknown
}

export interface StandardListTableConfig<T> {
  columns: readonly StandardListColumn<T>[]
  rows: readonly T[]
  preferences: Readonly<StandardListColumnPreferences>
  sort: StandardListSortState | null
  eventPrefix: string
  emptyText?: string
}

export interface StandardListColumnSettingsConfig<T> {
  title: string
  columns: readonly StandardListColumn<T>[]
  preferences: Readonly<StandardListColumnPreferences>
  eventPrefix: string
  maxFrozenWidth: number
}

function orderedColumns<T>(
  columns: readonly StandardListColumn<T>[],
  orderedKeys: readonly string[],
): StandardListColumn<T>[] {
  if (columns.filter((column) => column.actionColumn).length > 1) {
    throw new Error('标准列表最多只能定义一个操作列')
  }

  const byKey = new Map(columns.map((column) => [column.key, column]))
  const seen = new Set<string>()
  const regular: StandardListColumn<T>[] = []

  for (const key of orderedKeys) {
    const column = byKey.get(key)
    if (!column || column.actionColumn || seen.has(key)) continue
    seen.add(key)
    regular.push(column)
  }
  for (const column of columns) {
    if (column.actionColumn || seen.has(column.key)) continue
    seen.add(column.key)
    regular.push(column)
  }

  return [...regular, ...columns.filter((column) => column.actionColumn)]
}

function alignmentClass(align: 'left' | 'center' | 'right' | undefined): string {
  if (align === 'center') return 'text-center'
  if (align === 'right') return 'text-right'
  return 'text-left'
}

function columnWidth(column: Pick<StandardListColumn<never>, 'width' | 'minWidth'>): number {
  return Math.max(column.width, column.minWidth ?? 0)
}

function isColumnVisible(
  column: Pick<StandardListColumn<never>, 'key' | 'required' | 'actionColumn'>,
  visibleKeys: ReadonlySet<string>,
): boolean {
  return visibleKeys.has(column.key) || Boolean(column.required) || Boolean(column.actionColumn)
}

function frozenClass(
  column: Pick<StandardListColumn<never>, 'actionColumn'>,
  left: number,
  header: boolean,
): string {
  if (column.actionColumn) {
    return `sticky right-0 bg-background border-l ${header ? 'z-30' : 'z-20'}`
  }
  return `sticky ${left === 0 ? 'left-0' : ''} bg-background ${header ? 'z-20' : 'z-10'}`
}

function renderSortIcon(direction: 'asc' | 'desc' | null): string {
  const body = direction === 'asc'
    ? '<path d="m18 15-6-6-6 6"/><path d="M12 9v12"/>'
    : direction === 'desc'
      ? '<path d="m6 9 6 6 6-6"/><path d="M12 15V3"/>'
      : '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>'
  const state = direction ?? 'none'
  const tone = direction ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border bg-background text-muted-foreground'

  return `
    <span class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border ${tone}" data-standard-list-sort-icon="${state}">
      <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>
    </span>
  `
}

function renderSortHeader<T>(
  column: StandardListColumn<T>,
  sort: StandardListSortState | null,
  eventPrefix: string,
): string {
  const activeDirection = sort?.key === column.key ? sort.direction : null
  const nextDirection = activeDirection === 'asc' ? 'desc' : 'asc'
  const actionAttr = toActionAttr({ prefix: eventPrefix, action: 'sort-column' })

  return `
    <button
      type="button"
      class="inline-flex w-full items-center gap-1.5 font-medium"
      ${actionAttr}
      data-column-key="${escapeHtml(column.key)}"
      aria-label="按${escapeHtml(column.title)}${nextDirection === 'asc' ? '升序' : '降序'}排列"
    >
      <span>${escapeHtml(column.title)}</span>
      ${renderSortIcon(activeDirection)}
    </button>
  `
}

export function renderStandardListTable<T>(config: StandardListTableConfig<T>): string {
  const visibleKeys = new Set(config.preferences.visibleKeys)
  const columns = orderedColumns(config.columns, config.preferences.order).filter(
    (column) => isColumnVisible(column, visibleKeys),
  )
  const frozenKeys = new Set(config.preferences.frozenKeys)
  const leftOffsets = new Map<string, number>()
  let frozenWidth = 0
  for (const column of columns) {
    if (!column.actionColumn && column.freezeable && frozenKeys.has(column.key)) {
      leftOffsets.set(column.key, frozenWidth)
      frozenWidth += columnWidth(column)
    }
  }
  const minWidth = columns.reduce((sum, column) => sum + columnWidth(column), 0)

  const headers = columns.map((column) => {
    const left = leftOffsets.get(column.key)
    const isFrozen = left !== undefined || column.actionColumn
    const classes = [
      'h-10 px-3 text-xs font-medium text-muted-foreground align-middle whitespace-nowrap',
      alignmentClass(column.align),
      isFrozen ? frozenClass(column, left ?? 0, true) : '',
    ].filter(Boolean).join(' ')
    const ariaSort = column.sortable
      ? config.sort?.key === column.key
        ? config.sort.direction === 'asc' ? 'ascending' : 'descending'
        : 'none'
      : undefined

    return `
      <th
        class="${classes}"
        style="width: ${column.width}px; min-width: ${columnWidth(column)}px;${left && !column.actionColumn ? ` left: ${left}px;` : ''}"
        data-column-key="${escapeHtml(column.key)}"
        ${ariaSort ? `aria-sort="${ariaSort}"` : ''}
      >
        ${column.sortable ? renderSortHeader(column, config.sort, config.eventPrefix) : escapeHtml(column.title)}
      </th>
    `
  }).join('')

  const body = config.rows.length > 0
    ? config.rows.map((row, rowIndex) => `
        <tr class="border-b last:border-b-0 hover:bg-muted/40">
          ${columns.map((column) => {
            const left = leftOffsets.get(column.key)
            const isFrozen = left !== undefined || column.actionColumn
            const classes = [
              'px-3 py-2 text-sm align-middle',
              alignmentClass(column.align),
              isFrozen ? frozenClass(column, left ?? 0, false) : '',
            ].filter(Boolean).join(' ')
            return `
              <td
                class="${classes}"
                style="width: ${column.width}px; min-width: ${columnWidth(column)}px;${left && !column.actionColumn ? ` left: ${left}px;` : ''}"
              >${column.render(row, rowIndex)}</td>
            `
          }).join('')}
        </tr>
      `).join('')
    : `
        <tr>
          <td class="h-24 px-3 text-center text-sm text-muted-foreground" colspan="${columns.length}">
            ${escapeHtml(config.emptyText ?? '暂无数据')}
          </td>
        </tr>
      `

  return `
    <div class="max-w-full overflow-x-auto" data-standard-list-scroll>
      <table class="w-full border-collapse" style="min-width: ${minWidth}px">
        <thead class="border-b bg-muted/50">
          <tr>${headers}</tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `
}

function renderSettingCheckbox(options: {
  label: string
  checked: boolean
  disabled: boolean
  eventPrefix: string
  action: string
  columnKey: string
}): string {
  return `
    <label class="inline-flex items-center gap-1.5 text-xs ${options.disabled ? 'text-muted-foreground' : ''}">
      <input
        type="checkbox"
        class="h-4 w-4 rounded border-input"
        ${options.checked ? 'checked' : ''}
        ${options.disabled ? 'disabled' : ''}
        ${toActionAttr({ prefix: options.eventPrefix, action: options.action })}
        data-${toDataPrefix(options.eventPrefix)}-column-key="${escapeHtml(options.columnKey)}"
      >
      <span>${options.label}</span>
    </label>
  `
}

export function renderStandardListColumnSettings<T>(
  config: StandardListColumnSettingsConfig<T>,
): string {
  const columns = orderedColumns(config.columns, config.preferences.order)
  const visibleKeys = new Set(config.preferences.visibleKeys)
  const frozenKeys = new Set(config.preferences.frozenKeys)
  const frozenWidth = columns.reduce(
    (sum, column) => sum + (
      isColumnVisible(column, visibleKeys) && frozenKeys.has(column.key) && !column.actionColumn
        ? columnWidth(column)
        : 0
    ),
    0,
  )
  const prefix = toDataPrefix(config.eventPrefix)

  const content = `
    <div class="space-y-2">
      ${columns.map((column) => {
        const isAction = Boolean(column.actionColumn)
        const isFrozen = frozenKeys.has(column.key)
        const freezeDisabled = !column.freezeable || (
          !isFrozen && frozenWidth + columnWidth(column) > config.maxFrozenWidth
        )
        const dragAttributes = isAction
          ? 'draggable="false"'
          : `draggable="true" data-standard-list-column-drag data-drag-source="${escapeHtml(column.key)}" data-drop-target="${escapeHtml(column.key)}"`

        return `
          <div
            class="flex min-h-12 items-center gap-3 rounded-md border px-3 py-2"
            data-standard-list-column-key="${escapeHtml(column.key)}"
            data-${prefix}-column-key="${escapeHtml(column.key)}"
            ${dragAttributes}
          >
            ${isAction ? '' : '<i data-lucide="grip-vertical" class="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden="true"></i>'}
            <span class="min-w-0 flex-1 truncate text-sm font-medium">${escapeHtml(column.title)}</span>
            ${isAction ? '' : renderSettingCheckbox({
              label: '显示',
              checked: isColumnVisible(column, visibleKeys),
              disabled: Boolean(column.required),
              eventPrefix: config.eventPrefix,
              action: 'toggle-column-visibility',
              columnKey: column.key,
            })}
            ${isAction ? '' : renderSettingCheckbox({
              label: '冻结',
              checked: isFrozen,
              disabled: freezeDisabled,
              eventPrefix: config.eventPrefix,
              action: 'toggle-column-freeze',
              columnKey: column.key,
            })}
          </div>
        `
      }).join('')}
    </div>
  `

  return renderDrawer(
    {
      title: config.title,
      closeAction: { prefix: config.eventPrefix, action: 'close-column-settings' },
      width: 'sm',
    },
    content,
    {
      extra: renderSecondaryButton(
        '恢复默认',
        { prefix: config.eventPrefix, action: 'restore-column-settings' },
      ),
      cancel: {
        prefix: config.eventPrefix,
        action: 'close-column-settings',
        label: '关闭',
      },
    },
  )
}

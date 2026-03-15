import { escapeHtml } from '../utils'
import {
  CHANNEL_OPTIONS,
  MAPPING_RECORDS,
  MAPPING_STATUS_META,
  MAPPING_TYPE_META,
  STORE_OPTIONS,
  listMappingRecords,
  type MappingRecord,
} from '../data/pcs-channels'

interface PageState {
  searchKeyword: string
  filterType: string
  filterChannel: string
  filterStatus: string
  currentPage: number
  pageSize: number
  createDialogOpen: boolean
  endDialog: { open: boolean; mappingId: string | null }
  replaceDialog: { open: boolean; mappingId: string | null }
  conflictDialog: { open: boolean; mappingId: string | null }
  createForm: {
    type: string
    sourceKey: string
    targetKey: string
    channel: string
    store: string
    remark: string
  }
  replaceTargetKey: string
  notice: string | null
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

let mappings: MappingRecord[] = listMappingRecords()

const state: PageState = {
  searchKeyword: '',
  filterType: 'all',
  filterChannel: 'all',
  filterStatus: 'all',
  currentPage: 1,
  pageSize: 10,
  createDialogOpen: false,
  endDialog: { open: false, mappingId: null },
  replaceDialog: { open: false, mappingId: null },
  conflictDialog: { open: false, mappingId: null },
  createForm: {
    type: 'SKU_TO_INTERNAL',
    sourceKey: '',
    targetKey: '',
    channel: '',
    store: '',
    remark: '',
  },
  replaceTargetKey: '',
  notice: null,
}

function getFilteredRows(): MappingRecord[] {
  const keyword = state.searchKeyword.trim().toLowerCase()

  return mappings.filter((row) => {
    if (state.filterType !== 'all' && row.type !== state.filterType) return false
    if (state.filterChannel !== 'all' && row.channel !== state.filterChannel) return false
    if (state.filterStatus !== 'all' && row.status !== state.filterStatus) return false

    if (
      keyword &&
      !row.sourceKey.toLowerCase().includes(keyword) &&
      !row.targetKey.toLowerCase().includes(keyword) &&
      !row.id.toLowerCase().includes(keyword)
    ) {
      return false
    }

    return true
  })
}

function getPaging(rows: MappingRecord[]) {
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize))
  const currentPage = Math.min(Math.max(1, state.currentPage), totalPages)
  const start = (currentPage - 1) * state.pageSize
  const end = start + state.pageSize

  return {
    rows: rows.slice(start, end),
    total,
    totalPages,
    currentPage,
    from: total === 0 ? 0 : start + 1,
    to: total === 0 ? 0 : Math.min(end, total),
  }
}

function getStats() {
  return {
    total: MAPPING_RECORDS.length,
    active: MAPPING_RECORDS.filter((item) => item.status === 'ACTIVE').length,
    expired: MAPPING_RECORDS.filter((item) => item.status === 'EXPIRED').length,
    conflict: MAPPING_RECORDS.filter((item) => item.status === 'CONFLICT').length,
  }
}

function getMapping(mappingId: string | null): MappingRecord | null {
  if (!mappingId) return null
  return mappings.find((item) => item.id === mappingId) ?? null
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-channel-mapping-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">编码映射管理</h1>
        <p class="mt-1 text-sm text-muted-foreground">迁移旧版映射管理能力，支持新建、结束、替换和冲突处理弹窗。</p>
      </div>
      <button class="inline-flex h-8 items-center rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50" data-pcs-channel-mapping-action="open-create">
        <i data-lucide="plus" class="mr-1 h-3.5 w-3.5"></i>新增映射
      </button>
    </header>
  `
}

function renderStats(): string {
  const stats = getStats()

  return `
    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article class="rounded-lg border bg-card p-3">
        <p class="text-xs text-muted-foreground">全部映射</p>
        <p class="mt-1 text-xl font-semibold">${stats.total}</p>
      </article>
      <article class="rounded-lg border bg-card p-3">
        <p class="text-xs text-muted-foreground">有效映射</p>
        <p class="mt-1 text-xl font-semibold text-emerald-700">${stats.active}</p>
      </article>
      <article class="rounded-lg border bg-card p-3">
        <p class="text-xs text-muted-foreground">已过期</p>
        <p class="mt-1 text-xl font-semibold text-slate-600">${stats.expired}</p>
      </article>
      <article class="rounded-lg border bg-card p-3">
        <p class="text-xs text-muted-foreground">冲突映射</p>
        <p class="mt-1 text-xl font-semibold text-rose-700">${stats.conflict}</p>
      </article>
    </section>
  `
}

function renderFilters(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
          <div class="relative">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
            <input class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" placeholder="源键 / 目标键 / 映射ID" value="${escapeHtml(state.searchKeyword)}" data-pcs-channel-mapping-field="searchKeyword" />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">映射类型</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-mapping-field="filterType">
            <option value="all" ${state.filterType === 'all' ? 'selected' : ''}>全部</option>
            ${Object.entries(MAPPING_TYPE_META)
              .map(([key, meta]) => `<option value="${key}" ${state.filterType === key ? 'selected' : ''}>${meta.label}</option>`)
              .join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">渠道</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-mapping-field="filterChannel">
            <option value="all" ${state.filterChannel === 'all' ? 'selected' : ''}>全部</option>
            ${CHANNEL_OPTIONS.map((channel) => `<option value="${channel.id}" ${state.filterChannel === channel.id ? 'selected' : ''}>${channel.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">状态</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-mapping-field="filterStatus">
            <option value="all" ${state.filterStatus === 'all' ? 'selected' : ''}>全部</option>
            ${Object.entries(MAPPING_STATUS_META)
              .map(([key, meta]) => `<option value="${key}" ${state.filterStatus === key ? 'selected' : ''}>${meta.label}</option>`)
              .join('')}
          </select>
        </div>
      </div>
      <div class="mt-3 flex justify-end">
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-channel-mapping-action="reset-filters">重置筛选</button>
      </div>
    </section>
  `
}

function renderRows(rows: MappingRecord[]): string {
  if (!rows.length) {
    return `
      <tr>
        <td colspan="10" class="px-4 py-12 text-center text-muted-foreground">
          <i data-lucide="workflow" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
          <p class="mt-2 text-sm">暂无映射数据</p>
        </td>
      </tr>
    `
  }

  return rows
    .map((row) => {
      const channel = row.channel ? CHANNEL_OPTIONS.find((item) => item.id === row.channel) : null
      const store = row.store ? STORE_OPTIONS.find((item) => item.id === row.store) : null
      const statusMeta = MAPPING_STATUS_META[row.status]

      return `
        <tr class="border-b last:border-b-0 ${row.status === 'CONFLICT' ? 'bg-rose-50/60' : ''}">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.id)}</td>
          <td class="px-3 py-3"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${MAPPING_TYPE_META[row.type].color}">${MAPPING_TYPE_META[row.type].label}</span></td>
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.sourceKey)}</td>
          <td class="px-3 py-3 font-mono text-xs text-blue-700">${escapeHtml(row.targetKey)}</td>
          <td class="px-3 py-3 text-xs">${row.channel ? `${escapeHtml(channel?.name ?? row.channel)} / ${escapeHtml(store?.name ?? row.store ?? '-')}` : '全局映射'}</td>
          <td class="px-3 py-3 text-xs">${escapeHtml(row.effectiveFrom)}${row.effectiveTo ? `<br/><span class="text-muted-foreground">至 ${escapeHtml(row.effectiveTo)}</span>` : ''}</td>
          <td class="px-3 py-3"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${statusMeta.color}">${statusMeta.label}</span></td>
          <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.remark)}</td>
          <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.updatedAt)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-1">
              ${row.status === 'ACTIVE' ? `<button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-channel-mapping-action="open-end" data-mapping-id="${escapeHtml(row.id)}">结束映射</button>` : ''}
              ${row.status === 'ACTIVE' ? `<button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-channel-mapping-action="open-replace" data-mapping-id="${escapeHtml(row.id)}">替换目标</button>` : ''}
              ${row.status === 'CONFLICT' ? `<button class="inline-flex h-7 items-center rounded-md border border-rose-300 px-2 text-xs text-rose-700 hover:bg-rose-50" data-pcs-channel-mapping-action="open-conflict" data-mapping-id="${escapeHtml(row.id)}">解决冲突</button>` : ''}
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderTable(): string {
  const filtered = getFilteredRows()
  const paging = getPaging(filtered)
  state.currentPage = paging.currentPage

  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1320px] text-sm">
          <thead>
            <tr class="border-b bg-muted/30 text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">映射ID</th>
              <th class="px-3 py-2 font-medium">类型</th>
              <th class="px-3 py-2 font-medium">源键</th>
              <th class="px-3 py-2 font-medium">目标键</th>
              <th class="px-3 py-2 font-medium">作用域</th>
              <th class="px-3 py-2 font-medium">有效期</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium">备注</th>
              <th class="px-3 py-2 font-medium">更新时间</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${renderRows(paging.rows)}</tbody>
        </table>
      </div>
      <footer class="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-3">
        <p class="text-xs text-muted-foreground">共 ${paging.total} 条${paging.total ? `，当前 ${paging.from}-${paging.to}` : ''}</p>
        <div class="flex flex-wrap items-center gap-2">
          <select class="h-8 rounded-md border bg-background px-2 text-xs" data-pcs-channel-mapping-field="pageSize">
            ${PAGE_SIZE_OPTIONS.map((size) => `<option value="${size}" ${size === state.pageSize ? 'selected' : ''}>${size} 条/页</option>`).join('')}
          </select>
          <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${paging.currentPage <= 1 ? 'cursor-not-allowed opacity-60' : ''}" data-pcs-channel-mapping-action="prev-page" ${paging.currentPage <= 1 ? 'disabled' : ''}>上一页</button>
          <span class="text-xs text-muted-foreground">${paging.currentPage} / ${paging.totalPages}</span>
          <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${paging.currentPage >= paging.totalPages ? 'cursor-not-allowed opacity-60' : ''}" data-pcs-channel-mapping-action="next-page" ${paging.currentPage >= paging.totalPages ? 'disabled' : ''}>下一页</button>
        </div>
      </footer>
    </section>
  `
}

function renderCreateDialog(): string {
  if (!state.createDialogOpen) return ''

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section class="w-full max-w-lg rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">新增编码映射</h3>
        </header>
        <div class="space-y-3 p-4 text-sm">
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">映射类型</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-mapping-field="create-type">
              ${Object.entries(MAPPING_TYPE_META).map(([key, meta]) => `<option value="${key}" ${state.createForm.type === key ? 'selected' : ''}>${meta.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">源键</label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.sourceKey)}" data-pcs-channel-mapping-field="create-source" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">目标键</label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.targetKey)}" data-pcs-channel-mapping-field="create-target" />
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-xs text-muted-foreground">渠道</label>
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-mapping-field="create-channel">
                <option value="">可留空（全局）</option>
                ${CHANNEL_OPTIONS.map((channel) => `<option value="${channel.id}" ${state.createForm.channel === channel.id ? 'selected' : ''}>${channel.name}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs text-muted-foreground">店铺</label>
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-mapping-field="create-store">
                <option value="">可留空</option>
                ${STORE_OPTIONS.filter((store) => !state.createForm.channel || store.channel === state.createForm.channel)
                  .map((store) => `<option value="${store.id}" ${state.createForm.store === store.id ? 'selected' : ''}>${store.name}</option>`)
                  .join('')}
              </select>
            </div>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">备注</label>
            <textarea class="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm" data-pcs-channel-mapping-field="create-remark">${escapeHtml(state.createForm.remark)}</textarea>
          </div>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-channel-mapping-action="close-create">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-channel-mapping-action="confirm-create">确认创建</button>
        </footer>
      </section>
    </div>
  `
}

function renderSimpleDialog(title: string, message: string, closeAction: string, confirmAction: string): string {
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section class="w-full max-w-lg rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">${title}</h3>
        </header>
        <div class="p-4 text-sm text-muted-foreground">${message}</div>
        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-channel-mapping-action="${closeAction}">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-channel-mapping-action="${confirmAction}">确认</button>
        </footer>
      </section>
    </div>
  `
}

function renderEndDialog(): string {
  if (!state.endDialog.open) return ''
  const mapping = getMapping(state.endDialog.mappingId)
  if (!mapping) return ''
  return renderSimpleDialog(
    '结束映射',
    `确认结束映射 ${escapeHtml(mapping.id)} 吗？系统将写入结束时间。`,
    'close-end',
    'confirm-end',
  )
}

function renderReplaceDialog(): string {
  if (!state.replaceDialog.open) return ''
  const mapping = getMapping(state.replaceDialog.mappingId)
  if (!mapping) return ''

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section class="w-full max-w-lg rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">替换映射目标</h3>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(mapping.id)} ｜ 当前目标 ${escapeHtml(mapping.targetKey)}</p>
        </header>
        <div class="space-y-3 p-4 text-sm">
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">新目标键</label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.replaceTargetKey)}" data-pcs-channel-mapping-field="replace-target" />
          </div>
          <p class="text-xs text-muted-foreground">确认后将结束旧映射并创建新映射。</p>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-channel-mapping-action="close-replace">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-channel-mapping-action="confirm-replace">确认替换</button>
        </footer>
      </section>
    </div>
  `
}

function renderConflictDialog(): string {
  if (!state.conflictDialog.open) return ''
  const mapping = getMapping(state.conflictDialog.mappingId)
  if (!mapping) return ''
  return renderSimpleDialog(
    '解决映射冲突',
    `将映射 ${escapeHtml(mapping.id)} 标记为最终生效，并结束冲突集合中的其他映射。`,
    'close-conflict',
    'confirm-conflict',
  )
}

function closeAllDialogs(): void {
  state.createDialogOpen = false
  state.endDialog = { open: false, mappingId: null }
  state.replaceDialog = { open: false, mappingId: null }
  state.conflictDialog = { open: false, mappingId: null }
}

export function renderPcsChannelProductMappingPage(): string {
  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderNotice()}
      ${renderStats()}
      ${renderFilters()}
      ${renderTable()}
      ${renderCreateDialog()}
      ${renderEndDialog()}
      ${renderReplaceDialog()}
      ${renderConflictDialog()}
    </div>
  `
}

export function handlePcsChannelProductMappingEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-channel-mapping-field]')

  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.pcsChannelMappingField
    if (field === 'searchKeyword') {
      state.searchKeyword = fieldNode.value
      state.currentPage = 1
      return true
    }
    if (field === 'create-source') state.createForm.sourceKey = fieldNode.value
    if (field === 'create-target') state.createForm.targetKey = fieldNode.value
    if (field === 'replace-target') state.replaceTargetKey = fieldNode.value
    return true
  }

  if (fieldNode instanceof HTMLTextAreaElement) {
    if (fieldNode.dataset.pcsChannelMappingField === 'create-remark') {
      state.createForm.remark = fieldNode.value
      return true
    }
  }

  if (fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pcsChannelMappingField
    if (field === 'filterType') state.filterType = fieldNode.value
    if (field === 'filterChannel') state.filterChannel = fieldNode.value
    if (field === 'filterStatus') state.filterStatus = fieldNode.value
    if (field === 'pageSize') state.pageSize = Number(fieldNode.value) || 10
    if (field === 'create-type') state.createForm.type = fieldNode.value
    if (field === 'create-channel') {
      state.createForm.channel = fieldNode.value
      state.createForm.store = ''
    }
    if (field === 'create-store') state.createForm.store = fieldNode.value
    if (field?.startsWith('filter') || field === 'pageSize') state.currentPage = 1
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-channel-mapping-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsChannelMappingAction
  if (!action) return false

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'open-create') {
    state.createDialogOpen = true
    return true
  }

  if (action === 'close-create') {
    state.createDialogOpen = false
    return true
  }

  if (action === 'confirm-create') {
    if (!state.createForm.sourceKey.trim() || !state.createForm.targetKey.trim()) {
      state.notice = '请填写源键和目标键。'
      return true
    }

    const newMapping: MappingRecord = {
      id: `MAP-${String(mappings.length + 1).padStart(3, '0')}`,
      type: state.createForm.type as MappingRecord['type'],
      sourceKey: state.createForm.sourceKey,
      targetKey: state.createForm.targetKey,
      channel: state.createForm.channel || null,
      store: state.createForm.store || null,
      effectiveFrom: new Date().toISOString().slice(0, 16).replace('T', ' '),
      effectiveTo: null,
      status: 'ACTIVE',
      remark: state.createForm.remark || '手动创建',
      updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    }

    mappings = [newMapping, ...mappings]
    state.createDialogOpen = false
    state.notice = `${newMapping.id} 已创建（演示态）。`
    state.createForm = {
      type: 'SKU_TO_INTERNAL',
      sourceKey: '',
      targetKey: '',
      channel: '',
      store: '',
      remark: '',
    }
    return true
  }

  if (action === 'open-end') {
    const mappingId = actionNode.dataset.mappingId
    if (!mappingId) return false
    state.endDialog = { open: true, mappingId }
    return true
  }

  if (action === 'close-end') {
    state.endDialog = { open: false, mappingId: null }
    return true
  }

  if (action === 'confirm-end') {
    const mapping = getMapping(state.endDialog.mappingId)
    if (!mapping) return false
    mapping.status = 'EXPIRED'
    mapping.effectiveTo = new Date().toISOString().slice(0, 16).replace('T', ' ')
    mapping.updatedAt = mapping.effectiveTo
    state.endDialog = { open: false, mappingId: null }
    state.notice = `${mapping.id} 已结束（演示态）。`
    return true
  }

  if (action === 'open-replace') {
    const mappingId = actionNode.dataset.mappingId
    if (!mappingId) return false
    state.replaceDialog = { open: true, mappingId }
    state.replaceTargetKey = ''
    return true
  }

  if (action === 'close-replace') {
    state.replaceDialog = { open: false, mappingId: null }
    state.replaceTargetKey = ''
    return true
  }

  if (action === 'confirm-replace') {
    const mapping = getMapping(state.replaceDialog.mappingId)
    if (!mapping) return false
    if (!state.replaceTargetKey.trim()) {
      state.notice = '请先填写新目标键。'
      return true
    }

    mapping.status = 'EXPIRED'
    mapping.effectiveTo = new Date().toISOString().slice(0, 16).replace('T', ' ')
    mapping.updatedAt = mapping.effectiveTo

    const replacement: MappingRecord = {
      ...mapping,
      id: `MAP-${String(mappings.length + 1).padStart(3, '0')}`,
      targetKey: state.replaceTargetKey,
      status: 'ACTIVE',
      effectiveFrom: new Date().toISOString().slice(0, 16).replace('T', ' '),
      effectiveTo: null,
      remark: '替换目标后自动生成',
      updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    }

    mappings = [replacement, ...mappings]
    state.replaceDialog = { open: false, mappingId: null }
    state.replaceTargetKey = ''
    state.notice = `${mapping.id} 已替换目标（演示态）。`
    return true
  }

  if (action === 'open-conflict') {
    const mappingId = actionNode.dataset.mappingId
    if (!mappingId) return false
    state.conflictDialog = { open: true, mappingId }
    return true
  }

  if (action === 'close-conflict') {
    state.conflictDialog = { open: false, mappingId: null }
    return true
  }

  if (action === 'confirm-conflict') {
    const mapping = getMapping(state.conflictDialog.mappingId)
    if (!mapping) return false
    mappings = mappings.map((item) => {
      if (item.id === mapping.id) return { ...item, status: 'ACTIVE' }
      if (item.sourceKey === mapping.sourceKey && item.id !== mapping.id) {
        return { ...item, status: 'EXPIRED', effectiveTo: new Date().toISOString().slice(0, 16).replace('T', ' ') }
      }
      return item
    })
    state.conflictDialog = { open: false, mappingId: null }
    state.notice = `${mapping.id} 冲突已解决（演示态）。`
    return true
  }

  if (action === 'reset-filters') {
    state.searchKeyword = ''
    state.filterType = 'all'
    state.filterChannel = 'all'
    state.filterStatus = 'all'
    state.currentPage = 1
    return true
  }

  if (action === 'prev-page') {
    state.currentPage = Math.max(1, state.currentPage - 1)
    return true
  }

  if (action === 'next-page') {
    const totalPages = Math.max(1, Math.ceil(getFilteredRows().length / state.pageSize))
    state.currentPage = Math.min(totalPages, state.currentPage + 1)
    return true
  }

  if (action === 'close-dialog') {
    closeAllDialogs()
    return true
  }

  return false
}

export function isPcsChannelProductMappingDialogOpen(): boolean {
  return state.createDialogOpen || state.endDialog.open || state.replaceDialog.open || state.conflictDialog.open
}

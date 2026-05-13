import { escapeHtml } from '../../../utils.ts'

export function formatGarmentQty(value: number | undefined, unit = '件'): string {
  const safeValue = Number.isFinite(value) ? Number(value) : 0
  return `${safeValue.toLocaleString('zh-CN')} ${unit}`
}

export function renderPostFinishingPageHeader(title: string, description = '', actionHtml = ''): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-foreground">${escapeHtml(title)}</h1>
        ${description ? `<p class="mt-1 text-sm text-muted-foreground">${escapeHtml(description)}</p>` : ''}
      </div>
      ${actionHtml}
    </header>
  `
}

export function renderPostMetricCard(label: string, value: string, description: string): string {
  return `
    <article class="rounded-lg border bg-card px-4 py-3">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-2 text-2xl font-semibold text-foreground">${escapeHtml(value)}</div>
      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(description)}</div>
    </article>
  `
}

export function renderPostSection(title: string, body: string): string {
  return `
    <section class="rounded-lg border bg-card">
      <header class="border-b px-4 py-3">
        <h2 class="text-sm font-semibold">${escapeHtml(title)}</h2>
      </header>
      <div class="p-4">${body}</div>
    </section>
  `
}

export function renderPostStatusBadge(status: string): string {
  const tone = status.includes('差异')
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : status.includes('完成') || status.includes('已回写')
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status.includes('中')
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-amber-200 bg-amber-50 text-amber-700'
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${tone}">${escapeHtml(status)}</span>`
}

export function renderPostTable(headers: string[], rows: string, minWidth = 'min-w-[1120px]'): string {
  return `
    <div class="overflow-x-auto">
      <table class="${minWidth} w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs text-muted-foreground">
          <tr>${headers.map((header) => `<th class="px-3 py-2 font-medium">${escapeHtml(header)}</th>`).join('')}</tr>
        </thead>
        <tbody class="divide-y">${rows}</tbody>
      </table>
    </div>
  `
}

export function renderPostAction(label: string, href: string, disabled = false): string {
  if (disabled) return `<button type="button" class="rounded-md border px-2 py-1 text-xs opacity-50" disabled>${escapeHtml(label)}</button>`
  return `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${escapeHtml(href)}">${escapeHtml(label)}</button>`
}

export interface PostListFilters {
  keyword: string
  status: string
  source: string
  factory: string
  page: number
  pageSize: number
}

export interface PostPaginationResult<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  start: number
  end: number
}

const POST_PAGE_SIZE_OPTIONS = [10, 20, 50]

function safeSearchParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams()
  return new URLSearchParams(window.location.search)
}

function currentPathname(): string {
  if (typeof window === 'undefined') return ''
  return window.location.pathname
}

function normalizePageNumber(value: string | null, fallback: number): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback
}

export function getPostListFilters(): PostListFilters {
  const params = safeSearchParams()
  const pageSize = POST_PAGE_SIZE_OPTIONS.includes(Number(params.get('pageSize')))
    ? Number(params.get('pageSize'))
    : 20
  return {
    keyword: (params.get('keyword') || '').trim(),
    status: (params.get('status') || '全部').trim() || '全部',
    source: (params.get('source') || '全部').trim() || '全部',
    factory: (params.get('factory') || '全部').trim() || '全部',
    page: normalizePageNumber(params.get('page'), 1),
    pageSize,
  }
}

export function postFilterTextMatches(keyword: string, values: Array<string | number | undefined | null>): boolean {
  const normalizedKeyword = keyword.trim().toLowerCase()
  if (!normalizedKeyword) return true
  return values.some((value) => String(value ?? '').toLowerCase().includes(normalizedKeyword))
}

export function paginatePostRows<T>(rows: T[], filters: PostListFilters): PostPaginationResult<T> {
  const total = rows.length
  const pageSize = filters.pageSize
  const pageCount = Math.max(Math.ceil(total / pageSize), 1)
  const page = Math.min(Math.max(filters.page, 1), pageCount)
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageSize,
    pageCount,
    start,
    end,
  }
}

function buildPostQueryLink(overrides: Partial<PostListFilters>): string {
  const current = getPostListFilters()
  const next = { ...current, ...overrides }
  const params = safeSearchParams()
  ;(['keyword', 'status', 'source', 'factory'] as const).forEach((key) => {
    const value = next[key]
    if (!value || value === '全部') params.delete(key)
    else params.set(key, value)
  })
  params.set('page', String(next.page || 1))
  params.set('pageSize', String(next.pageSize || current.pageSize))
  const query = params.toString()
  return `${currentPathname()}${query ? `?${query}` : ''}`
}

function uniqueOptions(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right, 'zh-CN'))
}

function renderOption(value: string, currentValue: string): string {
  return `<option value="${escapeHtml(value)}" ${value === currentValue ? 'selected' : ''}>${escapeHtml(value)}</option>`
}

export function renderPostFilterPanel(options: {
  filters: PostListFilters
  statusOptions: string[]
  sourceOptions?: string[]
  factoryOptions?: string[]
  keywordPlaceholder?: string
}): string {
  const filters = options.filters
  const preservedPostOrderId = safeSearchParams().get('postOrderId') || ''
  const preservedPostTaskId = safeSearchParams().get('postTaskId') || ''
  const preservedTab = safeSearchParams().get('tab') || ''
  const statusOptions = ['全部', ...uniqueOptions(options.statusOptions)]
  const sourceOptions = ['全部', ...uniqueOptions(options.sourceOptions || [])]
  const factoryOptions = ['全部', ...uniqueOptions(options.factoryOptions || [])]
  return `
    <form class="rounded-lg border bg-card p-4" method="get" action="${escapeHtml(currentPathname())}">
      <input type="hidden" name="page" value="1" />
      ${preservedPostOrderId ? `<input type="hidden" name="postOrderId" value="${escapeHtml(preservedPostOrderId)}" />` : ''}
      ${preservedPostTaskId ? `<input type="hidden" name="postTaskId" value="${escapeHtml(preservedPostTaskId)}" />` : ''}
      ${preservedTab ? `<input type="hidden" name="tab" value="${escapeHtml(preservedTab)}" />` : ''}
      <div class="grid gap-3 md:grid-cols-4">
        <label class="space-y-1 text-sm">
          <span class="text-xs text-muted-foreground">关键词</span>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" name="keyword" value="${escapeHtml(filters.keyword)}" placeholder="${escapeHtml(options.keywordPlaceholder || '单号 / 生产单 / 工厂 / 状态')}" />
        </label>
        <label class="space-y-1 text-sm">
          <span class="text-xs text-muted-foreground">当前状态</span>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" name="status">${statusOptions.map((value) => renderOption(value, filters.status)).join('')}</select>
        </label>
        <label class="space-y-1 text-sm">
          <span class="text-xs text-muted-foreground">后道来源</span>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" name="source">${sourceOptions.map((value) => renderOption(value, filters.source)).join('')}</select>
        </label>
        <label class="space-y-1 text-sm">
          <span class="text-xs text-muted-foreground">工厂</span>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" name="factory">${factoryOptions.map((value) => renderOption(value, filters.factory)).join('')}</select>
        </label>
      </div>
      <div class="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(currentPathname())}">重置</button>
        <button type="submit" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">查询</button>
      </div>
    </form>
  `
}

export function renderPostPagination<T>(pagination: PostPaginationResult<T>): string {
  const pageSizeOptions = POST_PAGE_SIZE_OPTIONS.map((size) => `
    <option value="${size}" ${size === pagination.pageSize ? 'selected' : ''}>${size} 条/页</option>
  `).join('')
  const prevDisabled = pagination.page <= 1
  const nextDisabled = pagination.page >= pagination.pageCount
  return `
    <footer class="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-3 text-xs text-muted-foreground">
      <div>共 ${pagination.total.toLocaleString('zh-CN')} 条记录，当前 ${pagination.start}-${pagination.end}</div>
      <div class="flex flex-wrap items-center gap-2">
        <select class="h-8 rounded-md border bg-background px-2 text-xs" data-post-page-size>
          ${pageSizeOptions}
        </select>
        <button type="button" class="rounded-md border px-2.5 py-1 ${prevDisabled ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}" ${prevDisabled ? 'disabled' : `data-nav="${escapeHtml(buildPostQueryLink({ page: pagination.page - 1 }))}"`}>上一页</button>
        <span class="rounded-md border border-blue-500 bg-blue-50 px-2.5 py-1 text-blue-700">${pagination.page}</span>
        <span>/ ${pagination.pageCount}</span>
        <button type="button" class="rounded-md border px-2.5 py-1 ${nextDisabled ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}" ${nextDisabled ? 'disabled' : `data-nav="${escapeHtml(buildPostQueryLink({ page: pagination.page + 1 }))}"`}>下一页</button>
      </div>
    </footer>
    <script>
      document.querySelectorAll('[data-post-page-size]').forEach(function(select) {
        select.addEventListener('change', function(event) {
          var value = event.target.value;
          var url = new URL(window.location.href);
          url.searchParams.set('page', '1');
          url.searchParams.set('pageSize', value);
          window.location.href = url.pathname + '?' + url.searchParams.toString();
        });
      });
    </script>
  `
}

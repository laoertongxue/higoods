import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { renderTablePagination } from '../components/ui/pagination'
import {
  DEFAULT_PAGE_SIZE_OPTIONS,
  getNextPage,
  getPrevPage,
  paginateRows,
  parsePageSize,
} from '../utils/paging'
import {
  CHANNEL_OPTIONS,
  CHANNEL_PRODUCT_GROUPS,
  CONTENT_STATUS_META,
  GROUP_STATUS_META,
  INTERNAL_REF_META,
  MAPPING_HEALTH_META,
  PRICING_MODE_META,
  PROJECT_SOURCES,
  STORE_OPTIONS,
  listChannelProductGroups,
  type ChannelProductGroup,
} from '../data/pcs-channels'

type CreateMode = 'project' | 'new'

interface CreateForm {
  mode: CreateMode
  projectId: string
  channel: string
  stores: string[]
  inheritContent: boolean
  inheritPrice: boolean
  pricingMode: 'UNIFIED' | 'STORE_OVERRIDE'
  defaultPrice: string
}

interface MigrationState {
  open: boolean
  groupId: string | null
  step: 1 | 2 | 3
  selectedTargetSpu: string
}

interface PageState {
  searchKeyword: string
  filterChannel: string
  filterRefType: string
  filterMappingHealth: string
  filterGroupStatus: string
  selectedGroups: string[]
  currentPage: number
  pageSize: number
  createDrawerOpen: boolean
  createForm: CreateForm
  migration: MigrationState
  notice: string | null
}

let groups: ChannelProductGroup[] = listChannelProductGroups()

const state: PageState = {
  searchKeyword: '',
  filterChannel: 'all',
  filterRefType: 'all',
  filterMappingHealth: 'all',
  filterGroupStatus: 'all',
  selectedGroups: [],
  currentPage: 1,
  pageSize: 10,
  createDrawerOpen: false,
  createForm: {
    mode: 'project',
    projectId: '',
    channel: '',
    stores: [],
    inheritContent: true,
    inheritPrice: true,
    pricingMode: 'UNIFIED',
    defaultPrice: '',
  },
  migration: {
    open: false,
    groupId: null,
    step: 1,
    selectedTargetSpu: '',
  },
  notice: '已迁移渠道商品管理：列表、创建抽屉、转档迁移向导，以及映射/店铺内页入口。',
}

function getFilteredGroups(): ChannelProductGroup[] {
  const keyword = state.searchKeyword.trim().toLowerCase()

  return groups.filter((group) => {
    if (
      keyword &&
      !group.internalRefName.toLowerCase().includes(keyword) &&
      !group.internalRefCode.toLowerCase().includes(keyword) &&
      !group.originProjectName.toLowerCase().includes(keyword)
    ) {
      return false
    }

    if (state.filterChannel !== 'all' && group.channel !== state.filterChannel) return false
    if (state.filterRefType !== 'all' && group.internalRefType !== state.filterRefType) return false
    if (state.filterMappingHealth !== 'all' && group.mappingHealth !== state.filterMappingHealth) return false

    if (state.filterGroupStatus !== 'all') {
      if (state.filterGroupStatus === 'ONLINE' && group.onlineStoreCount === 0) return false
      if (state.filterGroupStatus === 'ALL_OFFLINE' && group.onlineStoreCount > 0) return false
      if (state.filterGroupStatus === 'HAS_BLOCKED' && group.groupStatus !== 'HAS_BLOCKED') return false
    }

    return true
  })
}

function getPaging(rows: ChannelProductGroup[]) {
  return paginateRows(rows, state.currentPage, state.pageSize)
}

function getStats() {
  return {
    total: CHANNEL_PRODUCT_GROUPS.length,
    hasOnline: CHANNEL_PRODUCT_GROUPS.filter((group) => group.onlineStoreCount > 0).length,
    allOffline: CHANNEL_PRODUCT_GROUPS.filter((group) => group.onlineStoreCount === 0).length,
    hasBlocked: CHANNEL_PRODUCT_GROUPS.filter((group) => group.groupStatus === 'HAS_BLOCKED').length,
    pendingMigration: CHANNEL_PRODUCT_GROUPS.filter((group) => group.groupStatus === 'PENDING_MIGRATION').length,
    mappingIssue: CHANNEL_PRODUCT_GROUPS.filter((group) => group.mappingHealth !== 'OK').length,
  }
}

function formatPrice(price: number, currency: string): string {
  return `${price.toLocaleString()} ${currency}`
}

function renderNotice(): string {
  if (!state.notice) return ''

  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-channel-group-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">渠道商品管理</h1>
        <p class="mt-1 text-sm text-muted-foreground">迁移旧版渠道商品组视图，覆盖项目转档、映射健康、多店铺在售状态。</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-channel-group-action="go-mapping">
          <i data-lucide="map" class="mr-1 h-3.5 w-3.5"></i>编码映射管理
        </button>
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-channel-group-action="go-store-view">
          <i data-lucide="store" class="mr-1 h-3.5 w-3.5"></i>店铺视图
        </button>
        <button class="inline-flex h-8 items-center rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50" data-pcs-channel-group-action="open-create">
          <i data-lucide="plus" class="mr-1 h-3.5 w-3.5"></i>新建渠道商品组
        </button>
      </div>
    </header>
  `
}

function renderStats(): string {
  const stats = getStats()

  const cards: Array<{ key: string; title: string; value: number; tone: string }> = [
    { key: 'all', title: '渠道商品组总数', value: stats.total, tone: 'text-foreground' },
    { key: 'online', title: '有在售店铺', value: stats.hasOnline, tone: 'text-emerald-700' },
    { key: 'offline', title: '全部下架', value: stats.allOffline, tone: 'text-orange-700' },
    { key: 'blocked', title: '有受限', value: stats.hasBlocked, tone: 'text-rose-700' },
    { key: 'migration', title: '待迁移', value: stats.pendingMigration, tone: 'text-violet-700' },
    { key: 'mapping', title: '映射异常', value: stats.mappingIssue, tone: 'text-amber-700' },
  ]

  return `
    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      ${cards
        .map(
          (card) => `
            <article class="rounded-lg border bg-card p-3">
              <p class="text-xs text-muted-foreground">${card.title}</p>
              <p class="mt-1 text-xl font-semibold ${card.tone}">${card.value}</p>
            </article>
          `,
        )
        .join('')}
    </section>
  `
}

function renderFilters(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
          <div class="relative">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
            <input class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" placeholder="内部编码 / 商品名称 / 来源项目" value="${escapeHtml(state.searchKeyword)}" data-pcs-channel-group-field="searchKeyword" />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">渠道</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-group-field="filterChannel">
            <option value="all" ${state.filterChannel === 'all' ? 'selected' : ''}>全部渠道</option>
            ${CHANNEL_OPTIONS.map((channel) => `<option value="${channel.id}" ${state.filterChannel === channel.id ? 'selected' : ''}>${channel.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">内部绑定类型</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-group-field="filterRefType">
            <option value="all" ${state.filterRefType === 'all' ? 'selected' : ''}>全部类型</option>
            <option value="SPU" ${state.filterRefType === 'SPU' ? 'selected' : ''}>SPU</option>
            <option value="CANDIDATE" ${state.filterRefType === 'CANDIDATE' ? 'selected' : ''}>候选商品</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">映射健康</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-group-field="filterMappingHealth">
            <option value="all" ${state.filterMappingHealth === 'all' ? 'selected' : ''}>全部</option>
            <option value="OK" ${state.filterMappingHealth === 'OK' ? 'selected' : ''}>正常</option>
            <option value="MISSING" ${state.filterMappingHealth === 'MISSING' ? 'selected' : ''}>缺映射</option>
            <option value="CONFLICT" ${state.filterMappingHealth === 'CONFLICT' ? 'selected' : ''}>冲突</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">组状态</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-group-field="filterGroupStatus">
            <option value="all" ${state.filterGroupStatus === 'all' ? 'selected' : ''}>全部</option>
            <option value="ONLINE" ${state.filterGroupStatus === 'ONLINE' ? 'selected' : ''}>有在售</option>
            <option value="ALL_OFFLINE" ${state.filterGroupStatus === 'ALL_OFFLINE' ? 'selected' : ''}>全部下架</option>
            <option value="HAS_BLOCKED" ${state.filterGroupStatus === 'HAS_BLOCKED' ? 'selected' : ''}>有受限</option>
          </select>
        </div>
      </div>
      <div class="mt-3 flex justify-end gap-2">
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-channel-group-action="reset-filters">重置筛选</button>
      </div>
    </section>
  `
}

function renderRows(rows: ChannelProductGroup[]): string {
  if (!rows.length) {
    return `
      <tr>
        <td colspan="12" class="px-4 py-12 text-center text-muted-foreground">
          <i data-lucide="folder-search-2" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
          <p class="mt-2 text-sm">暂无渠道商品组数据</p>
        </td>
      </tr>
    `
  }

  return rows
    .map((group) => {
      const channel = CHANNEL_OPTIONS.find((item) => item.id === group.channel)
      const selected = state.selectedGroups.includes(group.id)
      return `
        <tr class="border-b last:border-b-0 hover:bg-muted/40">
          <td class="px-3 py-3 align-top">
            <input type="checkbox" class="h-4 w-4 rounded border" ${selected ? 'checked' : ''} data-pcs-channel-group-action="toggle-select" data-group-id="${escapeHtml(group.id)}" />
          </td>
          <td class="px-3 py-3 align-top">
            <button class="font-medium text-blue-700 hover:underline" data-pcs-channel-group-action="go-detail" data-group-id="${escapeHtml(group.id)}">${escapeHtml(group.id)}</button>
            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(group.originProjectName)}</p>
          </td>
          <td class="px-3 py-3 align-top">${escapeHtml(channel?.name ?? group.channel)}</td>
          <td class="px-3 py-3 align-top">
            <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${INTERNAL_REF_META[group.internalRefType].color}">${INTERNAL_REF_META[group.internalRefType].label}</span>
          </td>
          <td class="px-3 py-3 align-top text-xs">
            <p class="font-medium text-foreground">${escapeHtml(group.internalRefCode)}</p>
            <p class="text-muted-foreground">${escapeHtml(group.internalRefName)}</p>
          </td>
          <td class="px-3 py-3 align-top">
            <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${PRICING_MODE_META[group.pricingMode].color}">${PRICING_MODE_META[group.pricingMode].label}</span>
            <p class="mt-1 text-xs">${formatPrice(group.channelDefaultPrice, group.currency)}</p>
          </td>
          <td class="px-3 py-3 text-center align-top">${group.coverStoreCount}</td>
          <td class="px-3 py-3 text-center align-top">${group.onlineStoreCount}</td>
          <td class="px-3 py-3 align-top"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${MAPPING_HEALTH_META[group.mappingHealth].color}">${MAPPING_HEALTH_META[group.mappingHealth].label}</span></td>
          <td class="px-3 py-3 align-top"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${GROUP_STATUS_META[group.groupStatus].color}">${GROUP_STATUS_META[group.groupStatus].label}</span></td>
          <td class="px-3 py-3 align-top text-xs text-muted-foreground">${escapeHtml(group.updatedAt)}</td>
          <td class="px-3 py-3 align-top">
            <div class="flex flex-wrap gap-1">
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-channel-group-action="go-detail" data-group-id="${escapeHtml(group.id)}">详情</button>
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-channel-group-action="go-store-view">店铺视图</button>
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-channel-group-action="go-mapping">映射管理</button>
              ${group.internalRefType === 'CANDIDATE' ? `<button class="inline-flex h-7 items-center rounded-md border border-violet-300 px-2 text-xs text-violet-700 hover:bg-violet-50" data-pcs-channel-group-action="open-migration" data-group-id="${escapeHtml(group.id)}">转档迁移</button>` : ''}
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderTable(): string {
  const filtered = getFilteredGroups()
  const paging = getPaging(filtered)
  state.currentPage = paging.currentPage

  const allSelected = filtered.length > 0 && filtered.every((item) => state.selectedGroups.includes(item.id))

  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="border-b px-3 py-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <label class="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" class="h-4 w-4 rounded border" ${allSelected ? 'checked' : ''} data-pcs-channel-group-action="toggle-select-all" />
            全选当前筛选结果
          </label>
          <div class="flex flex-wrap gap-2">
            <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-channel-group-action="batch-refresh">批量刷新状态</button>
            <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-channel-group-action="batch-export">导出</button>
          </div>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1480px] text-sm">
          <thead>
            <tr class="border-b bg-muted/30 text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">选择</th>
              <th class="px-3 py-2 font-medium">组ID / 来源项目</th>
              <th class="px-3 py-2 font-medium">渠道</th>
              <th class="px-3 py-2 font-medium">绑定类型</th>
              <th class="px-3 py-2 font-medium">内部对象</th>
              <th class="px-3 py-2 font-medium">定价模式</th>
              <th class="px-3 py-2 text-center font-medium">覆盖店铺</th>
              <th class="px-3 py-2 text-center font-medium">在售店铺</th>
              <th class="px-3 py-2 font-medium">映射健康</th>
              <th class="px-3 py-2 font-medium">组状态</th>
              <th class="px-3 py-2 font-medium">更新时间</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${renderRows(paging.rows)}</tbody>
        </table>
      </div>
      ${renderTablePagination({
        total: paging.total,
        from: paging.from,
        to: paging.to,
        currentPage: paging.currentPage,
        totalPages: paging.totalPages,
        pageSize: state.pageSize,
        actionPrefix: 'pcs-channel-group',
        pageSizeOptions: DEFAULT_PAGE_SIZE_OPTIONS,
      })}
    </section>
  `
}

function renderStoreOptions(channelId: string): string {
  const stores = STORE_OPTIONS.filter((store) => store.channel === channelId)
  if (!stores.length) {
    return '<p class="text-xs text-muted-foreground">请先选择渠道</p>'
  }

  return stores
    .map((store) => {
      const checked = state.createForm.stores.includes(store.id)
      return `
        <label class="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs ${checked ? 'border-blue-300 bg-blue-50 text-blue-700' : ''}">
          <input type="checkbox" class="h-4 w-4 rounded border" ${checked ? 'checked' : ''} data-pcs-channel-group-action="toggle-store" data-store-id="${store.id}" />
          <span>${escapeHtml(store.name)}（${escapeHtml(store.country)}）</span>
        </label>
      `
    })
    .join('')
}

function renderCreateDrawer(): string {
  if (!state.createDrawerOpen) return ''

  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-pcs-channel-group-action="close-create" aria-label="关闭"></button>
      <section class="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l bg-background shadow-2xl">
        <header class="sticky top-0 border-b bg-background px-4 py-3">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-base font-semibold">新建渠道商品组</h3>
              <p class="mt-1 text-xs text-muted-foreground">支持按项目生成或手动新建，保留旧 PCS 创建逻辑。</p>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-pcs-channel-group-action="close-create" aria-label="关闭"><i data-lucide="x" class="h-4 w-4"></i></button>
          </div>
        </header>
        <div class="space-y-3 p-4">
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">创建方式</label>
            <div class="grid grid-cols-2 gap-2">
              <button class="inline-flex h-9 items-center justify-center rounded-md border text-sm ${state.createForm.mode === 'project' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-pcs-channel-group-action="set-create-mode" data-create-mode="project">按项目生成</button>
              <button class="inline-flex h-9 items-center justify-center rounded-md border text-sm ${state.createForm.mode === 'new' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-pcs-channel-group-action="set-create-mode" data-create-mode="new">手动新建</button>
            </div>
          </div>

          ${
            state.createForm.mode === 'project'
              ? `
                <div>
                  <label class="mb-1 block text-xs text-muted-foreground">来源项目</label>
                  <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-group-field="projectId">
                    <option value="">请选择来源项目</option>
                    ${PROJECT_SOURCES.map((project) => `<option value="${project.id}" ${state.createForm.projectId === project.id ? 'selected' : ''}>${project.id} ｜ ${project.name}</option>`).join('')}
                  </select>
                </div>
              `
              : ''
          }

          <div>
            <label class="mb-1 block text-xs text-muted-foreground">渠道</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-group-field="channel">
              <option value="">请选择渠道</option>
              ${CHANNEL_OPTIONS.map((channel) => `<option value="${channel.id}" ${state.createForm.channel === channel.id ? 'selected' : ''}>${channel.name}</option>`).join('')}
            </select>
          </div>

          <div>
            <label class="mb-1 block text-xs text-muted-foreground">覆盖店铺</label>
            <div class="grid gap-2 rounded-md border bg-background p-2">
              ${renderStoreOptions(state.createForm.channel)}
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" class="h-4 w-4 rounded border" ${state.createForm.inheritContent ? 'checked' : ''} data-pcs-channel-group-field="inheritContent" />
              <span>继承项目内容版本</span>
            </label>
            <label class="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" class="h-4 w-4 rounded border" ${state.createForm.inheritPrice ? 'checked' : ''} data-pcs-channel-group-field="inheritPrice" />
              <span>继承项目价格策略</span>
            </label>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-xs text-muted-foreground">定价模式</label>
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-group-field="pricingMode">
                <option value="UNIFIED" ${state.createForm.pricingMode === 'UNIFIED' ? 'selected' : ''}>渠道统一价</option>
                <option value="STORE_OVERRIDE" ${state.createForm.pricingMode === 'STORE_OVERRIDE' ? 'selected' : ''}>店铺差异价</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs text-muted-foreground">渠道默认价</label>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="如：199000" value="${escapeHtml(state.createForm.defaultPrice)}" data-pcs-channel-group-field="defaultPrice" />
            </div>
          </div>
        </div>
        <footer class="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-channel-group-action="close-create">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-channel-group-action="confirm-create">${state.createForm.mode === 'project' ? '生成渠道商品' : '创建渠道商品组'}</button>
        </footer>
      </section>
    </div>
  `
}

function getMigrationGroup(): ChannelProductGroup | null {
  if (!state.migration.groupId) return null
  return groups.find((item) => item.id === state.migration.groupId) ?? null
}

function renderMigrationDialog(): string {
  if (!state.migration.open) return ''

  const group = getMigrationGroup()
  if (!group) return ''

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section class="w-full max-w-2xl rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">转档迁移向导</h3>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(group.id)} ｜ ${escapeHtml(group.internalRefCode)} → SPU</p>
        </header>
        <div class="space-y-3 p-4 text-sm">
          <div class="rounded-md border bg-muted/30 p-2 text-xs">步骤 ${state.migration.step} / 3</div>

          ${
            state.migration.step === 1
              ? `
                <article class="space-y-2 rounded-md border bg-background p-3">
                  <p class="font-medium">1. 选择目标 SPU</p>
                  <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-channel-group-field="migrationTargetSpu">
                    <option value="">请选择目标SPU</option>
                    <option value="SPU-20260115-001" ${state.migration.selectedTargetSpu === 'SPU-20260115-001' ? 'selected' : ''}>SPU-20260115-001 ｜ 波西米亚风印花半身裙</option>
                    <option value="SPU-20260115-011" ${state.migration.selectedTargetSpu === 'SPU-20260115-011' ? 'selected' : ''}>SPU-20260115-011 ｜ 波西米亚风印花半身裙（新版本）</option>
                  </select>
                </article>
              `
              : ''
          }

          ${
            state.migration.step === 2
              ? `
                <article class="space-y-2 rounded-md border bg-background p-3">
                  <p class="font-medium">2. 映射与影响预览</p>
                  <p>将同步更新候选商品到 SPU 的映射关系，并保持现有店铺商品组不下架。</p>
                  <ul class="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                    <li>影响店铺：${group.coverStoreCount} 个</li>
                    <li>当前在售店铺：${group.onlineStoreCount} 个</li>
                    <li>映射健康：${MAPPING_HEALTH_META[group.mappingHealth].label}</li>
                  </ul>
                </article>
              `
              : ''
          }

          ${
            state.migration.step === 3
              ? `
                <article class="space-y-2 rounded-md border bg-background p-3">
                  <p class="font-medium">3. 执行确认</p>
                  <p>目标SPU：<span class="font-medium text-blue-700">${escapeHtml(state.migration.selectedTargetSpu || '-')}</span></p>
                  <p class="text-xs text-muted-foreground">执行后将记录迁移日志，可在详情页与映射页追溯。</p>
                </article>
              `
              : ''
          }
        </div>
        <footer class="flex items-center justify-between gap-2 border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-channel-group-action="close-migration">取消</button>
          <div class="flex items-center gap-2">
            <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted ${state.migration.step <= 1 ? 'cursor-not-allowed opacity-60' : ''}" data-pcs-channel-group-action="migration-prev" ${state.migration.step <= 1 ? 'disabled' : ''}>上一步</button>
            ${
              state.migration.step < 3
                ? '<button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-channel-group-action="migration-next">下一步</button>'
                : '<button class="inline-flex h-9 items-center rounded-md border border-emerald-300 px-3 text-sm text-emerald-700 hover:bg-emerald-50" data-pcs-channel-group-action="migration-confirm">确认迁移</button>'
            }
          </div>
        </footer>
      </section>
    </div>
  `
}

function resetCreateForm(): void {
  state.createForm = {
    mode: 'project',
    projectId: '',
    channel: '',
    stores: [],
    inheritContent: true,
    inheritPrice: true,
    pricingMode: 'UNIFIED',
    defaultPrice: '',
  }
}

function closeAllDialogs(): void {
  state.createDrawerOpen = false
  state.migration = {
    open: false,
    groupId: null,
    step: 1,
    selectedTargetSpu: '',
  }
}

function createGroup(): boolean {
  if (state.createForm.mode === 'project' && !state.createForm.projectId) {
    state.notice = '请选择来源项目。'
    return false
  }
  if (!state.createForm.channel) {
    state.notice = '请选择渠道。'
    return false
  }
  if (!state.createForm.stores.length) {
    state.notice = '请至少选择一个店铺。'
    return false
  }

  const source = PROJECT_SOURCES.find((item) => item.id === state.createForm.projectId)
  const refCode = source?.hasSpu ? source.spuId ?? source.id : source?.candidateId ?? source?.id ?? 'CAND-NEW'
  const refName = source?.name ?? '手动创建商品组'
  const newGroupId = `CPG-${String(groups.length + 1).padStart(3, '0')}`

  const newGroup: ChannelProductGroup = {
    id: newGroupId,
    channel: state.createForm.channel,
    internalRefType: source?.hasSpu ? 'SPU' : 'CANDIDATE',
    internalRefId: refCode,
    internalRefCode: refCode,
    internalRefName: refName,
    originProjectId: source?.id ?? '-',
    originProjectName: source?.name ?? '手动创建',
    pricingMode: state.createForm.pricingMode,
    channelDefaultPrice: Number(state.createForm.defaultPrice || 0),
    currency: 'IDR',
    coverStoreCount: state.createForm.stores.length,
    onlineStoreCount: 0,
    contentStatus: state.createForm.inheritContent ? 'PUBLISHED' : 'DRAFT',
    contentVersionId: `CV-${String(groups.length + 1).padStart(3, '0')}`,
    mappingHealth: 'OK',
    groupStatus: 'PENDING_MIGRATION',
    createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
  }

  groups = [newGroup, ...groups]
  state.currentPage = 1
  state.createDrawerOpen = false
  state.notice = `${newGroup.id} 已创建（演示态）。`
  resetCreateForm()
  return true
}

export function renderPcsChannelProductsPage(): string {
  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderNotice()}
      ${renderStats()}
      ${renderFilters()}
      ${renderTable()}
      ${renderCreateDrawer()}
      ${renderMigrationDialog()}
    </div>
  `
}

export function handlePcsChannelProductsEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-channel-group-field]')

  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.pcsChannelGroupField
    if (field === 'searchKeyword') {
      state.searchKeyword = fieldNode.value
      state.currentPage = 1
      return true
    }
    if (field === 'defaultPrice') state.createForm.defaultPrice = fieldNode.value
    if (field === 'inheritContent') state.createForm.inheritContent = fieldNode.checked
    if (field === 'inheritPrice') state.createForm.inheritPrice = fieldNode.checked
    return true
  }

  if (fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pcsChannelGroupField
    if (field === 'filterChannel') state.filterChannel = fieldNode.value
    if (field === 'filterRefType') state.filterRefType = fieldNode.value
    if (field === 'filterMappingHealth') state.filterMappingHealth = fieldNode.value
    if (field === 'filterGroupStatus') state.filterGroupStatus = fieldNode.value
    if (field === 'pageSize') state.pageSize = parsePageSize(fieldNode.value)
    if (field === 'projectId') state.createForm.projectId = fieldNode.value
    if (field === 'channel') {
      state.createForm.channel = fieldNode.value
      state.createForm.stores = []
    }
    if (field === 'pricingMode') state.createForm.pricingMode = fieldNode.value as CreateForm['pricingMode']
    if (field === 'migrationTargetSpu') state.migration.selectedTargetSpu = fieldNode.value
    if (field?.startsWith('filter') || field === 'pageSize') state.currentPage = 1
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-channel-group-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsChannelGroupAction
  if (!action) return false

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'go-detail') {
    const groupId = actionNode.dataset.groupId
    if (!groupId) return false
    appStore.navigate(`/pcs/channels/products/${groupId.replace('CPG', 'CP')}`)
    return true
  }

  if (action === 'go-mapping') {
    appStore.navigate('/pcs/channels/products/mapping')
    return true
  }

  if (action === 'go-store-view') {
    appStore.navigate('/pcs/channels/products/store')
    return true
  }

  if (action === 'open-create') {
    state.createDrawerOpen = true
    return true
  }

  if (action === 'close-create') {
    state.createDrawerOpen = false
    return true
  }

  if (action === 'set-create-mode') {
    const mode = actionNode.dataset.createMode as CreateMode | undefined
    if (!mode) return false
    state.createForm.mode = mode
    state.createForm.projectId = ''
    return true
  }

  if (action === 'toggle-store') {
    const storeId = actionNode.dataset.storeId
    if (!storeId) return false
    if (state.createForm.stores.includes(storeId)) {
      state.createForm.stores = state.createForm.stores.filter((item) => item !== storeId)
    } else {
      state.createForm.stores = [...state.createForm.stores, storeId]
    }
    return true
  }

  if (action === 'confirm-create') {
    createGroup()
    return true
  }

  if (action === 'open-migration') {
    const groupId = actionNode.dataset.groupId
    if (!groupId) return false
    state.migration = {
      open: true,
      groupId,
      step: 1,
      selectedTargetSpu: '',
    }
    return true
  }

  if (action === 'close-migration') {
    state.migration = {
      open: false,
      groupId: null,
      step: 1,
      selectedTargetSpu: '',
    }
    return true
  }

  if (action === 'migration-prev') {
    state.migration.step = Math.max(1, state.migration.step - 1) as 1 | 2 | 3
    return true
  }

  if (action === 'migration-next') {
    if (state.migration.step === 1 && !state.migration.selectedTargetSpu) {
      state.notice = '请先选择目标SPU。'
      return true
    }
    state.migration.step = Math.min(3, state.migration.step + 1) as 1 | 2 | 3
    return true
  }

  if (action === 'migration-confirm') {
    if (!state.migration.selectedTargetSpu) {
      state.notice = '请先选择目标SPU。'
      return true
    }
    const group = getMigrationGroup()
    state.migration = {
      open: false,
      groupId: null,
      step: 1,
      selectedTargetSpu: '',
    }
    state.notice = `${group?.id ?? ''} 已完成转档迁移（演示态）。`
    return true
  }

  if (action === 'toggle-select') {
    const groupId = actionNode.dataset.groupId
    if (!groupId) return false
    if (state.selectedGroups.includes(groupId)) {
      state.selectedGroups = state.selectedGroups.filter((item) => item !== groupId)
    } else {
      state.selectedGroups = [...state.selectedGroups, groupId]
    }
    return true
  }

  if (action === 'toggle-select-all') {
    const filtered = getFilteredGroups()
    const allSelected = filtered.length > 0 && filtered.every((item) => state.selectedGroups.includes(item.id))
    if (allSelected) {
      state.selectedGroups = state.selectedGroups.filter((id) => !filtered.some((item) => item.id === id))
    } else {
      const merged = new Set([...state.selectedGroups, ...filtered.map((item) => item.id)])
      state.selectedGroups = Array.from(merged)
    }
    return true
  }

  if (action === 'batch-refresh') {
    state.notice = `已提交批量刷新（${state.selectedGroups.length} 项，演示态）。`
    return true
  }

  if (action === 'batch-export') {
    state.notice = `已导出选中渠道商品组（${state.selectedGroups.length} 项，演示态）。`
    return true
  }

  if (action === 'reset-filters') {
    state.searchKeyword = ''
    state.filterChannel = 'all'
    state.filterRefType = 'all'
    state.filterMappingHealth = 'all'
    state.filterGroupStatus = 'all'
    state.currentPage = 1
    return true
  }

  if (action === 'prev-page') {
    state.currentPage = getPrevPage(state.currentPage)
    return true
  }

  if (action === 'next-page') {
    state.currentPage = getNextPage(state.currentPage, getFilteredGroups().length, state.pageSize)
    return true
  }

  if (action === 'close-dialog') {
    closeAllDialogs()
    return true
  }

  return false
}

export function isPcsChannelProductsDialogOpen(): boolean {
  return state.createDrawerOpen || state.migration.open
}

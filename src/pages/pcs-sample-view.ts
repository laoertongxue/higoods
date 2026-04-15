import { ensurePcsProjectDemoDataReady } from '../data/pcs-project-demo-seed-service.ts'
import { ensurePcsSampleDemoDataReady } from '../data/pcs-sample-demo.ts'
import { listSampleAssets } from '../data/pcs-sample-asset-repository.ts'
import { listSampleUseRequests } from '../data/pcs-sample-application-repository.ts'
import type { SampleAssetRecord, SampleInventoryStatus } from '../data/pcs-sample-types.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'

type SampleViewMode = 'card' | 'kanban' | 'list'
type SampleViewStatusFilter = 'all' | '在库可用' | '预占锁定' | '借出占用' | '在途待签收' | '维修中' | '待处置' | '已退货' | '已处置'
type SampleAvailabilityFilter = 'all' | '可用' | '不可用'
type SampleLocationFilter = 'all' | 'warehouse' | 'external' | 'in_transit' | 'disposal'
type SampleRiskFilter = 'all' | '超期未归还' | '在途超时' | '冻结' | '待处置'
type SampleSortKey = 'updatedAt' | 'expectedReturnAt' | 'riskFirst'

interface SampleViewModel {
  sampleAssetId: string
  sampleCode: string
  sampleName: string
  responsibleSite: string
  inventoryStatus: SampleInventoryStatus
  availability: string
  availabilityReason: string
  locationType: SampleLocationFilter
  locationDisplay: string
  custodianDisplay: string
  expectedReturnAt: string
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  workItemName: string
  lastEventTime: string
  lastEventType: string
  riskFlags: string[]
}

interface SampleViewState {
  notice: string | null
  mode: SampleViewMode
  selectedSampleIds: string[]
  detailSampleAssetId: string | null
  filters: {
    search: string
    site: string
    status: SampleViewStatusFilter
    availability: SampleAvailabilityFilter
    locationType: SampleLocationFilter
    risk: SampleRiskFilter
    sort: SampleSortKey
  }
}

const STATUS_META: Record<SampleInventoryStatus, string> = {
  在途: 'bg-blue-100 text-blue-700',
  在库待核对: 'bg-sky-100 text-sky-700',
  在库可用: 'bg-emerald-100 text-emerald-700',
  预占锁定: 'bg-violet-100 text-violet-700',
  借出占用: 'bg-orange-100 text-orange-700',
  在途待签收: 'bg-blue-100 text-blue-700',
  待处置: 'bg-rose-100 text-rose-700',
  已退货: 'bg-slate-100 text-slate-600',
  维修中: 'bg-amber-100 text-amber-700',
  已处置: 'bg-slate-100 text-slate-600',
}

const state: SampleViewState = {
  notice: null,
  mode: 'card',
  selectedSampleIds: [],
  detailSampleAssetId: null,
  filters: {
    search: '',
    site: 'all',
    status: 'all',
    availability: 'all',
    locationType: 'all',
    risk: 'all',
    sort: 'updatedAt',
  },
}

function ensurePageDataReady(): void {
  ensurePcsProjectDemoDataReady()
  ensurePcsSampleDemoDataReady()
}

function getTodayDateText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function buildRiskFlags(asset: SampleAssetRecord): string[] {
  const flags: string[] = []
  if (asset.inventoryStatus === '待处置') flags.push('待处置')
  if (asset.inventoryStatus === '维修中') flags.push('冻结')
  if (asset.inventoryStatus === '在途待签收') flags.push('在途超时')
  if (asset.inventoryStatus === '借出占用') {
    const request = listSampleUseRequests().find(
      (item) =>
        item.sampleAssetIds.includes(asset.sampleAssetId) &&
        (item.status === 'ACTIVE' || item.status === 'RETURNING') &&
        item.expectedReturnAt &&
        item.expectedReturnAt.slice(0, 10) < getTodayDateText(),
    )
    if (request) flags.push('超期未归还')
  }
  return flags
}

function mapLocationType(asset: SampleAssetRecord): SampleLocationFilter {
  if (asset.locationType === '在途') return 'in_transit'
  if (asset.locationType === '外部保管') return 'external'
  if (asset.locationType === '处置区') return 'disposal'
  return 'warehouse'
}

function getExpectedReturnAt(sampleAssetId: string): string {
  const request = listSampleUseRequests().find(
    (item) =>
      item.sampleAssetIds.includes(sampleAssetId) &&
      (item.status === 'APPROVED' || item.status === 'ACTIVE' || item.status === 'RETURNING') &&
      item.expectedReturnAt,
  )
  return request?.expectedReturnAt || ''
}

function getSamples(): SampleViewModel[] {
  ensurePageDataReady()
  return listSampleAssets().map((asset) => ({
    sampleAssetId: asset.sampleAssetId,
    sampleCode: asset.sampleCode,
    sampleName: asset.sampleName,
    responsibleSite: asset.responsibleSite,
    inventoryStatus: asset.inventoryStatus,
    availability: asset.availabilityStatus,
    availabilityReason:
      asset.availabilityStatus === '不可用'
        ? asset.inventoryStatus === '预占锁定'
          ? '已被申请预占'
          : asset.inventoryStatus === '借出占用'
            ? '已借出使用中'
            : asset.inventoryStatus === '在途待签收'
              ? '当前仍在物流途中'
              : asset.inventoryStatus === '维修中'
                ? '维修处理中'
                : asset.inventoryStatus === '待处置'
                  ? '待退货或处置'
                  : '暂不可用'
        : '',
    locationType: mapLocationType(asset),
    locationDisplay: asset.locationDisplay,
    custodianDisplay: asset.custodianName,
    expectedReturnAt: getExpectedReturnAt(asset.sampleAssetId),
    projectId: asset.projectId,
    projectCode: asset.projectCode,
    projectName: asset.projectName,
    projectNodeId: asset.projectNodeId,
    workItemName: asset.workItemTypeName,
    lastEventTime: asset.lastEventTime,
    lastEventType: asset.lastEventType,
    riskFlags: buildRiskFlags(asset),
  }))
}

function getFilteredSamples(): SampleViewModel[] {
  const keyword = state.filters.search.trim().toLowerCase()
  const filtered = getSamples().filter((item) => {
    if (keyword) {
      const haystack = [
        item.sampleCode,
        item.sampleName,
        item.projectCode,
        item.projectName,
        item.locationDisplay,
        item.custodianDisplay,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    if (state.filters.site !== 'all' && item.responsibleSite !== state.filters.site) return false
    if (state.filters.status !== 'all' && item.inventoryStatus !== state.filters.status) return false
    if (state.filters.availability !== 'all' && item.availability !== state.filters.availability) return false
    if (state.filters.locationType !== 'all' && item.locationType !== state.filters.locationType) return false
    if (state.filters.risk !== 'all' && !item.riskFlags.includes(state.filters.risk)) return false
    return true
  })

  const sorted = [...filtered]
  if (state.filters.sort === 'expectedReturnAt') {
    sorted.sort((a, b) => (a.expectedReturnAt || '9999').localeCompare(b.expectedReturnAt || '9999'))
  } else if (state.filters.sort === 'riskFirst') {
    sorted.sort((a, b) => Number(b.riskFlags.length > 0) - Number(a.riskFlags.length > 0) || b.lastEventTime.localeCompare(a.lastEventTime))
  } else {
    sorted.sort((a, b) => b.lastEventTime.localeCompare(a.lastEventTime))
  }
  return sorted
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="font-medium">样衣视图</p>
          <p class="mt-1">${escapeHtml(state.notice)}</p>
        </div>
        <button type="button" class="inline-flex h-7 items-center rounded-md px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-sample-view-action="close-notice">关闭</button>
      </div>
    </section>
  `
}

function renderHeader(): string {
  return `
    <section class="rounded-xl border bg-white px-6 py-5 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs text-slate-500">商品中心 / 样衣资产管理</p>
          <h1 class="mt-1 text-2xl font-semibold text-slate-900">样衣视图</h1>
          <p class="mt-1 text-sm text-slate-500">按卡片、看板和列表三种视角浏览样衣资产，适合快速筛查风险、位置与可调用状态。</p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <div class="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1">
            ${[
              { key: 'card', label: '卡片' },
              { key: 'kanban', label: '看板' },
              { key: 'list', label: '列表' },
            ]
              .map(
                (item) => `
                  <button type="button" class="${escapeHtml(
                    toClassName(
                      'inline-flex h-9 items-center rounded-md px-3 text-sm',
                      state.mode === item.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white',
                    ),
                  )}" data-pcs-sample-view-action="set-mode" data-value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</button>
                `,
              )
              .join('')}
          </div>
          <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-view-action="refresh"><i data-lucide="refresh-cw" class="h-4 w-4"></i>刷新</button>
        </div>
      </div>
    </section>
  `
}

function renderFilters(): string {
  const samples = getSamples()
  const sites = Array.from(new Set(samples.map((item) => item.responsibleSite)))
  return `
    <section class="rounded-xl border bg-white px-6 py-5 shadow-sm">
      <div class="grid gap-4 xl:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))]">
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>搜索</span>
          <input type="search" class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" placeholder="样衣编号 / SPU / 项目 / 保管人" value="${escapeHtml(state.filters.search)}" data-pcs-sample-view-field="search" />
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>责任站点</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-view-field="site">
            <option value="all">全部站点</option>
            ${sites.map((site) => `<option value="${escapeHtml(site)}" ${state.filters.site === site ? 'selected' : ''}>${escapeHtml(site)}</option>`).join('')}
          </select>
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>库存状态</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-view-field="status">
            ${['all', '在库可用', '预占锁定', '借出占用', '在途待签收', '维修中', '待处置', '已退货', '已处置']
              .map((status) => `<option value="${escapeHtml(status)}" ${state.filters.status === status ? 'selected' : ''}>${escapeHtml(status === 'all' ? '全部状态' : status)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>可用性</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-view-field="availability">
            <option value="all">全部</option>
            <option value="可用" ${state.filters.availability === '可用' ? 'selected' : ''}>可用</option>
            <option value="不可用" ${state.filters.availability === '不可用' ? 'selected' : ''}>不可用</option>
          </select>
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>位置类型</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-view-field="locationType">
            <option value="all">全部位置</option>
            <option value="warehouse" ${state.filters.locationType === 'warehouse' ? 'selected' : ''}>在库</option>
            <option value="external" ${state.filters.locationType === 'external' ? 'selected' : ''}>外部保管</option>
            <option value="in_transit" ${state.filters.locationType === 'in_transit' ? 'selected' : ''}>在途</option>
            <option value="disposal" ${state.filters.locationType === 'disposal' ? 'selected' : ''}>处置区</option>
          </select>
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-2 text-sm text-slate-600">
            <span>风险筛选</span>
            <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-view-field="risk">
              ${['all', '超期未归还', '在途超时', '冻结', '待处置']
                .map((risk) => `<option value="${escapeHtml(risk)}" ${state.filters.risk === risk ? 'selected' : ''}>${escapeHtml(risk === 'all' ? '全部' : risk)}</option>`)
                .join('')}
            </select>
          </label>
          <label class="flex flex-col gap-2 text-sm text-slate-600">
            <span>排序</span>
            <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-view-field="sort">
              <option value="updatedAt" ${state.filters.sort === 'updatedAt' ? 'selected' : ''}>最近变更</option>
              <option value="expectedReturnAt" ${state.filters.sort === 'expectedReturnAt' ? 'selected' : ''}>预计归还时间</option>
              <option value="riskFirst" ${state.filters.sort === 'riskFirst' ? 'selected' : ''}>风险优先</option>
            </select>
          </label>
        </div>
      </div>
      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div class="text-xs text-slate-500">当前筛选出 ${escapeHtml(getFilteredSamples().length)} 件样衣，支持批量选中后发起使用申请。</div>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" ${getFilteredSamples().length > 0 && getFilteredSamples().every((item) => state.selectedSampleIds.includes(item.sampleAssetId)) ? 'checked' : ''} data-pcs-sample-view-action="toggle-select-all" />
            <span>全选当前筛选结果</span>
          </label>
          <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-sample-view-action="batch-apply">发起使用申请</button>
          <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-view-action="reset">重置</button>
        </div>
      </div>
    </section>
  `
}

function renderSummary(): string {
  const samples = getFilteredSamples()
  const total = samples.length
  const available = samples.filter((item) => item.inventoryStatus === '在库可用').length
  const reserved = samples.filter((item) => item.inventoryStatus === '预占锁定').length
  const occupied = samples.filter((item) => item.inventoryStatus === '借出占用').length
  const transit = samples.filter((item) => item.inventoryStatus === '在途待签收').length
  const risk = samples.filter((item) => item.riskFlags.length > 0).length
  const cards = [
    { label: '总样衣数', value: total, helper: '当前视图样衣总量', tone: 'border-slate-200 bg-white text-slate-900' },
    { label: '在库可用', value: available, helper: '可直接申请调用', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    { label: '预占锁定', value: reserved, helper: '已被申请锁定', tone: 'border-violet-200 bg-violet-50 text-violet-700' },
    { label: '借出占用', value: occupied, helper: '外部或业务占用中', tone: 'border-orange-200 bg-orange-50 text-orange-700' },
    { label: '在途待签收', value: transit, helper: '物流流转未签收', tone: 'border-blue-200 bg-blue-50 text-blue-700' },
    { label: '风险样衣', value: risk, helper: '超期、冻结或待处置', tone: 'border-rose-200 bg-rose-50 text-rose-700' },
  ]
  return `
    <section class="grid gap-4 xl:grid-cols-6">
      ${cards
        .map(
          (card) => `
            <article class="${escapeHtml(toClassName('rounded-xl border px-5 py-4 shadow-sm', card.tone))}">
              <p class="text-sm font-medium">${escapeHtml(card.label)}</p>
              <p class="mt-3 text-3xl font-semibold">${escapeHtml(card.value)}</p>
              <p class="mt-2 text-xs opacity-80">${escapeHtml(card.helper)}</p>
            </article>
          `,
        )
        .join('')}
    </section>
  `
}

function renderRiskBadges(flags: string[]): string {
  if (flags.length === 0) return ''
  return flags
    .map((flag) => `<span class="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">${escapeHtml(flag)}</span>`)
    .join('')
}

function renderCardView(samples: SampleViewModel[]): string {
  if (samples.length === 0) {
    return '<section class="rounded-xl border border-dashed bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm">当前筛选条件下暂无样衣。</section>'
  }

  return `
    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      ${samples
        .map(
          (sample) => `
            <article class="rounded-xl border bg-white p-4 shadow-sm">
              <div class="flex items-start justify-between gap-3">
                <label class="inline-flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" ${state.selectedSampleIds.includes(sample.sampleAssetId) ? 'checked' : ''} data-pcs-sample-view-action="toggle-select-sample" data-sample-asset-id="${escapeHtml(sample.sampleAssetId)}" />
                  <span>选择</span>
                </label>
                <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-sample-view-action="open-detail" data-sample-asset-id="${escapeHtml(sample.sampleAssetId)}">查看详情</button>
              </div>
              <div class="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center">
                <i data-lucide="shirt" class="mx-auto h-8 w-8 text-slate-400"></i>
                <p class="mt-3 text-sm font-medium text-slate-900">${escapeHtml(sample.sampleCode)}</p>
                <p class="mt-1 text-xs text-slate-500">${escapeHtml(sample.sampleName)}</p>
              </div>
              <div class="mt-4 flex flex-wrap gap-2">
                <span class="${escapeHtml(toClassName('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_META[sample.inventoryStatus]))}">${escapeHtml(sample.inventoryStatus)}</span>
                <span class="inline-flex rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">${escapeHtml(sample.availability)}</span>
                <span class="inline-flex rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">${escapeHtml(sample.responsibleSite)}</span>
              </div>
              <div class="mt-4 space-y-2 text-sm">
                <p><span class="text-slate-500">位置：</span>${escapeHtml(sample.locationDisplay)}</p>
                <p><span class="text-slate-500">保管：</span>${escapeHtml(sample.custodianDisplay || '-')}</p>
                <p><span class="text-slate-500">项目：</span>${sample.projectId ? `<button type="button" class="text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(sample.projectId)}">${escapeHtml(sample.projectCode || sample.projectName)}</button>` : '公共样衣'}</p>
              </div>
              ${sample.riskFlags.length > 0 ? `<div class="mt-4 flex flex-wrap gap-2">${renderRiskBadges(sample.riskFlags)}</div>` : ''}
            </article>
          `,
        )
        .join('')}
    </section>
  `
}

function renderKanbanView(samples: SampleViewModel[]): string {
  const columns = [
    { key: '在库可用', label: '在库可用' },
    { key: '预占锁定', label: '预占锁定' },
    { key: '借出占用', label: '借出占用' },
    { key: '在途待签收', label: '在途待签收' },
    { key: 'risk', label: '风险待处理' },
  ] as const

  return `
    <section class="grid gap-4 xl:grid-cols-5">
      ${columns
        .map((column) => {
          const items =
            column.key === 'risk'
              ? samples.filter((item) => item.riskFlags.length > 0)
              : samples.filter((item) => item.inventoryStatus === column.key)
          return `
            <article class="rounded-xl border bg-white p-4 shadow-sm">
              <div class="flex items-center justify-between gap-3">
                <h3 class="text-sm font-medium text-slate-900">${escapeHtml(column.label)}</h3>
                <span class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">${escapeHtml(items.length)}</span>
              </div>
              <div class="mt-4 space-y-3">
                ${
                  items.length === 0
                    ? '<div class="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-slate-400">暂无样衣</div>'
                    : items
                        .map(
                          (sample) => `
                            <button type="button" class="w-full rounded-lg border border-slate-200 p-3 text-left hover:border-blue-300 hover:bg-blue-50/40" data-pcs-sample-view-action="open-detail" data-sample-asset-id="${escapeHtml(sample.sampleAssetId)}">
                              <p class="text-sm font-medium text-slate-900">${escapeHtml(sample.sampleCode)}</p>
                              <p class="mt-1 text-xs text-slate-500">${escapeHtml(sample.sampleName)}</p>
                              <p class="mt-2 text-xs text-slate-500">${escapeHtml(sample.locationDisplay)}</p>
                              ${sample.riskFlags.length > 0 ? `<div class="mt-2 flex flex-wrap gap-2">${renderRiskBadges(sample.riskFlags)}</div>` : ''}
                            </button>
                          `,
                        )
                        .join('')
                }
              </div>
            </article>
          `
        })
        .join('')}
    </section>
  `
}

function renderListView(samples: SampleViewModel[]): string {
  return `
    <section class="rounded-xl border bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-3">选择</th>
              <th class="px-4 py-3">样衣</th>
              <th class="px-4 py-3">库存状态</th>
              <th class="px-4 py-3">位置</th>
              <th class="px-4 py-3">项目 / 工作项</th>
              <th class="px-4 py-3">风险</th>
              <th class="px-4 py-3">最近变更</th>
              <th class="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${
              samples.length === 0
                ? '<tr><td colspan="8" class="px-4 py-12 text-center text-sm text-slate-500">当前筛选条件下暂无样衣。</td></tr>'
                : samples
                    .map(
                      (sample) => `
                        <tr class="hover:bg-slate-50/80">
                          <td class="px-4 py-3 align-top"><input type="checkbox" class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" ${state.selectedSampleIds.includes(sample.sampleAssetId) ? 'checked' : ''} data-pcs-sample-view-action="toggle-select-sample" data-sample-asset-id="${escapeHtml(sample.sampleAssetId)}" /></td>
                          <td class="px-4 py-3 align-top">
                            <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-pcs-sample-view-action="open-detail" data-sample-asset-id="${escapeHtml(sample.sampleAssetId)}">${escapeHtml(sample.sampleCode)}</button>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(sample.sampleName)}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <span class="${escapeHtml(toClassName('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_META[sample.inventoryStatus]))}">${escapeHtml(sample.inventoryStatus)}</span>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(sample.availability)}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <p class="text-slate-900">${escapeHtml(sample.locationDisplay)}</p>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(sample.custodianDisplay || '-')}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            ${sample.projectId ? `<button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(sample.projectId)}">${escapeHtml(sample.projectCode || sample.projectName)}</button>` : '<p class="text-slate-500">公共样衣</p>'}
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(sample.workItemName || '-')}</p>
                          </td>
                          <td class="px-4 py-3 align-top"><div class="flex flex-wrap gap-2">${renderRiskBadges(sample.riskFlags)}</div></td>
                          <td class="px-4 py-3 align-top">${escapeHtml(formatDateTime(sample.lastEventTime))}</td>
                          <td class="px-4 py-3 align-top text-right">
                            <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-sample-view-action="open-detail" data-sample-asset-id="${escapeHtml(sample.sampleAssetId)}">查看详情</button>
                          </td>
                        </tr>
                      `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderDrawerShell(title: string, body: string): string {
  return `
    <div class="fixed inset-0 z-40 flex justify-end">
      <button type="button" class="absolute inset-0 bg-slate-900/35" data-pcs-sample-view-action="close-detail"></button>
      <section class="relative flex h-full w-full max-w-3xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div class="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p class="text-xs text-slate-500">样衣详情</p>
            <h2 class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(title)}</h2>
          </div>
          <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-view-action="close-detail">关闭</button>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-5">${body}</div>
      </section>
    </div>
  `
}

function renderDetailDrawer(): string {
  if (!state.detailSampleAssetId) return ''
  const sample = getSamples().find((item) => item.sampleAssetId === state.detailSampleAssetId)
  if (!sample) return ''

  const body = `
    <div class="space-y-6">
      <section class="rounded-lg border bg-slate-50 p-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="${escapeHtml(toClassName('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_META[sample.inventoryStatus]))}">${escapeHtml(sample.inventoryStatus)}</span>
          <span class="inline-flex rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">${escapeHtml(sample.availability)}</span>
          <span class="inline-flex rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">${escapeHtml(sample.responsibleSite)}</span>
        </div>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p class="text-xs text-slate-500">样衣编号</p>
            <p class="mt-1 font-medium text-slate-900">${escapeHtml(sample.sampleCode)}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">样衣名称</p>
            <p class="mt-1 font-medium text-slate-900">${escapeHtml(sample.sampleName)}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">当前位置</p>
            <p class="mt-1 text-slate-900">${escapeHtml(sample.locationDisplay)}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">保管人</p>
            <p class="mt-1 text-slate-900">${escapeHtml(sample.custodianDisplay || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">关联项目</p>
            ${sample.projectId ? `<button type="button" class="mt-1 text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(sample.projectId)}">${escapeHtml(sample.projectCode || sample.projectName)}</button>` : '<p class="mt-1 text-slate-500">公共样衣</p>'}
          </div>
          <div>
            <p class="text-xs text-slate-500">关联工作项</p>
            ${
              sample.projectId && sample.projectNodeId
                ? `<button type="button" class="mt-1 text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(sample.projectId)}/work-items/${escapeHtml(sample.projectNodeId)}">${escapeHtml(sample.workItemName || '-')}</button>`
                : `<p class="mt-1 text-slate-900">${escapeHtml(sample.workItemName || '-')}</p>`
            }
          </div>
        </div>
      </section>
      ${
        sample.riskFlags.length > 0
          ? `<section class="rounded-lg border border-rose-200 bg-rose-50 p-4"><p class="text-sm font-medium text-rose-700">风险标签</p><div class="mt-3 flex flex-wrap gap-2">${renderRiskBadges(sample.riskFlags)}</div></section>`
          : ''
      }
      <section class="rounded-lg border bg-white p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-slate-900">快捷动作</p>
            <p class="mt-1 text-xs text-slate-500">从样衣视图直接跳到申请、台账和库存详情。</p>
          </div>
        </div>
        <div class="mt-4 grid gap-3 md:grid-cols-3">
          <button type="button" class="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-nav="/pcs/samples/application">发起使用申请</button>
          <button type="button" class="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/ledger">查看台账</button>
          <button type="button" class="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/inventory">查看库存页</button>
        </div>
      </section>
    </div>
  `

  return renderDrawerShell(`${sample.sampleCode} · ${sample.sampleName}`, body)
}

export function renderPcsSampleViewPage(): string {
  ensurePageDataReady()
  const samples = getFilteredSamples()
  return `
    <div class="space-y-6">
      ${renderNotice()}
      ${renderHeader()}
      ${renderFilters()}
      ${renderSummary()}
      ${state.mode === 'card' ? renderCardView(samples) : state.mode === 'kanban' ? renderKanbanView(samples) : renderListView(samples)}
      ${renderDetailDrawer()}
    </div>
  `
}

export function handlePcsSampleViewInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-sample-view-field]')
  if (!fieldNode) return false
  const field = fieldNode.dataset.pcsSampleViewField
  if (!field) return false

  if (field === 'search' && fieldNode instanceof HTMLInputElement) {
    state.filters.search = fieldNode.value
    return true
  }
  if (fieldNode instanceof HTMLSelectElement) {
    if (field === 'site') state.filters.site = fieldNode.value
    if (field === 'status') state.filters.status = fieldNode.value as SampleViewStatusFilter
    if (field === 'availability') state.filters.availability = fieldNode.value as SampleAvailabilityFilter
    if (field === 'locationType') state.filters.locationType = fieldNode.value as SampleLocationFilter
    if (field === 'risk') state.filters.risk = fieldNode.value as SampleRiskFilter
    if (field === 'sort') state.filters.sort = fieldNode.value as SampleSortKey
    return true
  }
  return false
}

function toggleSampleSelection(sampleAssetId: string): void {
  if (state.selectedSampleIds.includes(sampleAssetId)) {
    state.selectedSampleIds = state.selectedSampleIds.filter((item) => item !== sampleAssetId)
  } else {
    state.selectedSampleIds = [...state.selectedSampleIds, sampleAssetId]
  }
}

export function handlePcsSampleViewEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-sample-view-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsSampleViewAction
  if (!action) return false

  if (action === 'close-notice') {
    state.notice = null
    return true
  }
  if (action === 'refresh') {
    ensurePageDataReady()
    state.notice = '已刷新样衣视图。'
    return true
  }
  if (action === 'set-mode') {
    state.mode = (actionNode.dataset.value as SampleViewMode) || 'card'
    return true
  }
  if (action === 'reset') {
    state.filters = { search: '', site: 'all', status: 'all', availability: 'all', locationType: 'all', risk: 'all', sort: 'updatedAt' }
    state.selectedSampleIds = []
    return true
  }
  if (action === 'toggle-select-sample') {
    const sampleAssetId = actionNode.dataset.sampleAssetId
    if (!sampleAssetId) return true
    toggleSampleSelection(sampleAssetId)
    return true
  }
  if (action === 'toggle-select-all') {
    const filteredIds = getFilteredSamples().map((item) => item.sampleAssetId)
    const allSelected = filteredIds.length > 0 && filteredIds.every((item) => state.selectedSampleIds.includes(item))
    state.selectedSampleIds = allSelected
      ? state.selectedSampleIds.filter((item) => !filteredIds.includes(item))
      : Array.from(new Set([...state.selectedSampleIds, ...filteredIds]))
    return true
  }
  if (action === 'batch-apply') {
    const selected = getSamples().filter((item) => state.selectedSampleIds.includes(item.sampleAssetId))
    if (selected.length === 0) {
      state.notice = '请至少选择一件样衣。'
      return true
    }
    const siteSet = new Set(selected.map((item) => item.responsibleSite))
    if (siteSet.size > 1) {
      state.notice = '批量发起使用申请时，所选样衣必须属于同一责任站点。'
      return true
    }
    state.notice = `已选择 ${selected.length} 件样衣，请前往样衣使用申请继续提交。`
    return true
  }
  if (action === 'open-detail') {
    const sampleAssetId = actionNode.dataset.sampleAssetId
    if (!sampleAssetId) return true
    state.detailSampleAssetId = sampleAssetId
    return true
  }
  if (action === 'close-detail') {
    state.detailSampleAssetId = null
    return true
  }
  return false
}

export function isPcsSampleViewDialogOpen(): boolean {
  return Boolean(state.detailSampleAssetId)
}

export function resetPcsSampleViewState(): void {
  state.notice = null
  state.mode = 'card'
  state.selectedSampleIds = []
  state.detailSampleAssetId = null
  state.filters = { search: '', site: 'all', status: 'all', availability: 'all', locationType: 'all', risk: 'all', sort: 'updatedAt' }
}

import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { renderFormDialog } from '../components/ui/dialog'
import { renderDrawer as uiDrawer } from '../components/ui'
import { renderTablePagination } from '../components/ui/pagination'
import {
  getProjectRelationProjectLabel,
  listVideoRecordProjectRelationCandidates,
  listProjectRelationsByVideoRecord,
  replaceVideoRecordProjectRelations,
  unlinkVideoRecordProjectRelation,
  type TestingProjectRelationCandidate,
} from '../data/pcs-project-relation-repository.ts'
import { getVideoTestRecordById } from '../data/pcs-video-testing-repository.ts'
import {
  DEFAULT_PAGE_SIZE_OPTIONS,
  getNextPage,
  getPrevPage,
  paginateRows,
  parsePageSize,
} from '../utils/paging'
import {
  ACCOUNTING_STATUS_META,
  SESSION_STATUS_META,
  VIDEO_PLATFORM_META,
  VIDEO_PURPOSE_META,
  listVideoRecords,
  type AccountingStatus,
  type SessionStatus,
  type VideoPurpose,
  type VideoRecord,
} from '../data/pcs-testing'
import {
  getVideoRecordOwnershipSummary,
  matchTestingOwnershipFilter,
  type TestingOwnershipFilter,
} from '../data/pcs-testing-ownership.ts'

type QuickFilter = 'all' | 'reconciling' | 'canClose' | 'pendingAccounting' | 'accounted'

interface CreateFormState {
  title: string
  owner: string
  recorder: string
  platform: VideoRecord['platform'] | ''
  account: string
  creator: string
  publishedAt: string
  videoUrl: string
  purposes: VideoPurpose[]
  isTestAccountingEnabled: boolean
  note: string
}

interface DialogState {
  open: boolean
  recordId: string | null
}

interface PageState {
  searchKeyword: string
  ownershipFilter: TestingOwnershipFilter
  statusFilter: 'all' | SessionStatus
  purposeFilter: 'all' | VideoPurpose
  platformFilter: 'all' | VideoRecord['platform']
  accountingFilter: 'all' | AccountingStatus
  quickFilter: QuickFilter
  currentPage: number
  pageSize: number
  createDrawerOpen: boolean
  closeDialog: DialogState
  accountingDialog: DialogState
  relationDialogOpen: boolean
  relationTargetRecordId: string | null
  relationSelectedProjectIds: string[]
  createForm: CreateFormState
  closeReason: string
  closeNote: string
  accountingNote: string
  accountingConfirmed: boolean
  notice: string | null
}

let records: VideoRecord[] = listVideoRecords()

const state: PageState = {
  searchKeyword: '',
  ownershipFilter: 'all',
  statusFilter: 'all',
  purposeFilter: 'all',
  platformFilter: 'all',
  accountingFilter: 'all',
  quickFilter: 'all',
  currentPage: 1,
  pageSize: 10,
  createDrawerOpen: false,
  closeDialog: { open: false, recordId: null },
  accountingDialog: { open: false, recordId: null },
  relationDialogOpen: false,
  relationTargetRecordId: null,
  relationSelectedProjectIds: [],
  createForm: {
    title: '',
    owner: '',
    recorder: '',
    platform: '',
    account: '',
    creator: '',
    publishedAt: '',
    videoUrl: '',
    purposes: [],
    isTestAccountingEnabled: false,
    note: '',
  },
  closeReason: '',
  closeNote: '',
  accountingNote: '',
  accountingConfirmed: false,
  notice: '已迁移短视频记录：列表、创建抽屉、关账弹窗、测款入账弹窗、详情内页。',
}

function getVideoRecordProjectRelations(videoRecordId: string) {
  return listProjectRelationsByVideoRecord(videoRecordId).map((relation) => ({
    projectId: relation.projectId,
    projectLabel: getProjectRelationProjectLabel(relation.projectId),
  }))
}

function getRecordById(recordId: string | null): VideoRecord | null {
  if (!recordId) return null
  return records.find((item) => item.id === recordId) ?? null
}

function getKpis() {
  return {
    reconciling: records.filter((item) => item.status === 'RECONCILING').length,
    canClose: records.filter((item) => item.status === 'RECONCILING' && item.itemCount > 0).length,
    pendingAccounting: records.filter((item) => item.testAccountingStatus === 'PENDING').length,
    accounted: records.filter((item) => item.testAccountingStatus === 'ACCOUNTED').length,
  }
}

function getFilteredRows(): VideoRecord[] {
  const keyword = state.searchKeyword.trim().toLowerCase()

  return records.filter((row) => {
    if (
      keyword &&
      !row.id.toLowerCase().includes(keyword) &&
      !row.title.toLowerCase().includes(keyword) &&
      !row.account.toLowerCase().includes(keyword)
    ) {
      return false
    }

    if (state.statusFilter !== 'all' && row.status !== state.statusFilter) return false
    if (state.purposeFilter !== 'all' && !row.purposes.includes(state.purposeFilter)) return false
    if (state.platformFilter !== 'all' && row.platform !== state.platformFilter) return false
    if (state.accountingFilter !== 'all' && row.testAccountingStatus !== state.accountingFilter) return false
    const ownershipRecord = getVideoTestRecordById(row.id)
    const ownershipSummary = getVideoRecordOwnershipSummary(
      ownershipRecord ?? {
        videoRecordId: row.id,
        videoRecordCode: row.id,
        videoTitle: row.title,
        channelName: '',
        businessDate: '',
        publishedAt: row.publishedAt ?? '',
        recordStatus: row.status,
        styleCode: '',
        spuCode: '',
        skuCode: '',
        colorCode: '',
        sizeCode: '',
        exposureQty: row.views,
        clickQty: row.likes,
        orderQty: 0,
        gmvAmount: row.gmv,
        ownerName: row.owner,
        legacyProjectRef: null,
        legacyProjectId: null,
      },
    )
    if (!matchTestingOwnershipFilter(ownershipSummary, state.ownershipFilter)) {
      return false
    }

    if (state.quickFilter === 'reconciling' && row.status !== 'RECONCILING') return false
    if (state.quickFilter === 'canClose' && !(row.status === 'RECONCILING' && row.itemCount > 0)) return false
    if (state.quickFilter === 'pendingAccounting' && row.testAccountingStatus !== 'PENDING') return false
    if (state.quickFilter === 'accounted' && row.testAccountingStatus !== 'ACCOUNTED') return false

    return true
  })
}

function getPaging(rows: VideoRecord[]) {
  return paginateRows(rows, state.currentPage, state.pageSize)
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-video-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">短视频记录</h1>
        <p class="mt-1 text-sm text-muted-foreground">迁移旧版短视频测款链路，保留内容记录、关账、测款入账和详情审计。</p>
      </div>
      <button class="inline-flex h-8 items-center rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50" data-pcs-video-action="open-create">
        <i data-lucide="plus" class="mr-1 h-3.5 w-3.5"></i>新建记录
      </button>
    </header>
  `
}

function renderKpis(): string {
  const kpis = getKpis()
  const cards: Array<{ key: QuickFilter; title: string; value: number; tone: string }> = [
    { key: 'reconciling', title: '核对中', value: kpis.reconciling, tone: 'text-blue-700' },
    { key: 'canClose', title: '可关账', value: kpis.canClose, tone: 'text-emerald-700' },
    { key: 'pendingAccounting', title: '待入账', value: kpis.pendingAccounting, tone: 'text-amber-700' },
    { key: 'accounted', title: '已入账', value: kpis.accounted, tone: 'text-emerald-700' },
  ]

  return `
    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      ${cards
        .map(
          (card) => `
            <button class="rounded-lg border bg-card p-3 text-left transition hover:border-blue-300 ${state.quickFilter === card.key ? 'border-blue-300 bg-blue-50' : ''}" data-pcs-video-action="set-quick" data-quick-key="${card.key}">
              <p class="text-xs text-muted-foreground">${card.title}</p>
              <p class="mt-1 text-xl font-semibold ${card.tone}">${card.value}</p>
            </button>
          `,
        )
        .join('')}
    </section>
  `
}

function renderOwnershipQuickFilters(): string {
  const options: Array<{ key: TestingOwnershipFilter; label: string; desc: string }> = [
    { key: 'all', label: '全部样本', desc: '查看正式项目测款与历史样本' },
    { key: 'formal', label: '正式项目测款', desc: '只看已纳入正式商品项目链路的短视频测款' },
    { key: 'history', label: '历史样本', desc: '只看独立历史样本和历史迁移样本' },
  ]

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold">样本归属快捷筛选</h2>
          <p class="mt-1 text-xs text-muted-foreground">顶部标签用于快速切换正式项目测款和历史样本视图。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          ${options
            .map(
              (option) => `
                <button
                  class="rounded-md border px-3 py-2 text-left text-xs transition ${
                    state.ownershipFilter === option.key
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'hover:border-blue-200 hover:bg-muted'
                  }"
                  data-pcs-video-action="set-ownership-filter"
                  data-ownership-filter="${option.key}"
                >
                  <span class="block font-medium">${option.label}</span>
                  <span class="mt-1 block text-muted-foreground">${option.desc}</span>
                </button>
              `,
            )
            .join('')}
        </div>
      </div>
    </section>
  `
}

function renderFilters(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <div class="xl:col-span-2">
          <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
          <div class="relative">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
            <input class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" placeholder="记录ID / 标题 / 账号" value="${escapeHtml(state.searchKeyword)}" data-pcs-video-field="searchKeyword" />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">记录状态</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-video-field="statusFilter">
            <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>全部状态</option>
            ${Object.entries(SESSION_STATUS_META)
              .map(([key, meta]) => `<option value="${key}" ${state.statusFilter === key ? 'selected' : ''}>${meta.label}</option>`)
              .join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">用途</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-video-field="purposeFilter">
            <option value="all" ${state.purposeFilter === 'all' ? 'selected' : ''}>全部用途</option>
            ${Object.entries(VIDEO_PURPOSE_META)
              .map(([key, meta]) => `<option value="${key}" ${state.purposeFilter === key ? 'selected' : ''}>${meta.label}</option>`)
              .join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">平台</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-video-field="platformFilter">
            <option value="all" ${state.platformFilter === 'all' ? 'selected' : ''}>全部平台</option>
            ${Object.entries(VIDEO_PLATFORM_META)
              .map(([key, meta]) => `<option value="${key}" ${state.platformFilter === key ? 'selected' : ''}>${meta.label}</option>`)
              .join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">样本归属</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-video-field="ownershipFilter">
            <option value="all" ${state.ownershipFilter === 'all' ? 'selected' : ''}>全部样本</option>
            <option value="formal" ${state.ownershipFilter === 'formal' ? 'selected' : ''}>正式项目测款</option>
            <option value="history" ${state.ownershipFilter === 'history' ? 'selected' : ''}>历史样本</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">测款入账</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-video-field="accountingFilter">
            <option value="all" ${state.accountingFilter === 'all' ? 'selected' : ''}>全部</option>
            ${Object.entries(ACCOUNTING_STATUS_META)
              .map(([key, meta]) => `<option value="${key}" ${state.accountingFilter === key ? 'selected' : ''}>${meta.label}</option>`)
              .join('')}
          </select>
        </div>
      </div>
      <div class="mt-3 flex justify-end gap-2">
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-video-action="reset-filters">重置筛选</button>
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-video-action="set-quick" data-quick-key="all">清除快捷筛选</button>
      </div>
    </section>
  `
}

function renderPurposeTags(purposes: VideoPurpose[]): string {
  return purposes
    .map((purpose) => `<span class="inline-flex rounded-full px-2 py-0.5 text-xs ${VIDEO_PURPOSE_META[purpose].color}">${VIDEO_PURPOSE_META[purpose].label}</span>`)
    .join('')
}

function renderProjectTags(recordId: string, legacyProjectRef: string | null): string {
  const record = getVideoTestRecordById(recordId)
  const ownership = record ? getVideoRecordOwnershipSummary(record) : null
  const relations = getVideoRecordProjectRelations(recordId)
  if (relations.length === 0) {
    return `
      <div class="space-y-1">
        ${
          ownership
            ? `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${ownership.badgeTone}">${ownership.label}</span>`
            : '<span class="text-sm text-muted-foreground">暂无正式项目关联</span>'
        }
        ${ownership ? `<p class="text-[11px] text-muted-foreground">${escapeHtml(ownership.detailText)}</p>` : ''}
        ${ownership?.legacyHintText || legacyProjectRef ? `<p class="text-[11px] text-amber-700">${escapeHtml(ownership?.legacyHintText || `历史项目字段：${legacyProjectRef}，当前仅保留为迁移痕迹。`)}</p>` : ''}
      </div>
    `
  }

  return `
    <div class="space-y-1">
      ${ownership ? `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${ownership.badgeTone}">${ownership.label}</span>` : ''}
      <div class="flex flex-wrap gap-2">
      ${relations
        .map(
          (relation) => `
            <span class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
              ${escapeHtml(relation.projectLabel)}
              <button class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-blue-200 text-[10px] hover:bg-blue-100" data-pcs-video-action="unlink-project" data-record-id="${escapeHtml(recordId)}" data-project-id="${escapeHtml(relation.projectId)}">×</button>
            </span>
          `,
        )
        .join('')}
      </div>
    </div>
  `
}

function renderRows(rows: VideoRecord[]): string {
  if (!rows.length) {
    return `
      <tr>
        <td colspan="15" class="px-4 py-12 text-center text-muted-foreground">
          <i data-lucide="video-off" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
          <p class="mt-2 text-sm">暂无符合条件的短视频记录</p>
        </td>
      </tr>
    `
  }

  return rows
    .map((row) => {
      const canClose = row.status === 'RECONCILING'
      const canAccounting =
        (row.status === 'RECONCILING' || row.status === 'COMPLETED') && row.testAccountingStatus === 'PENDING'
      const testingRecord = getVideoTestRecordById(row.id)
      const ownership = testingRecord ? getVideoRecordOwnershipSummary(testingRecord) : null

      return `
        <tr class="border-b last:border-b-0 hover:bg-muted/40">
          <td class="px-3 py-3 align-top">
            <button class="font-medium text-blue-700 hover:underline" data-pcs-video-action="go-detail" data-record-id="${escapeHtml(row.id)}">${escapeHtml(row.id)}</button>
            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.title)}</p>
          </td>
          <td class="px-3 py-3 align-top"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${SESSION_STATUS_META[row.status].color}">${SESSION_STATUS_META[row.status].label}</span></td>
          <td class="px-3 py-3 align-top"><div class="flex flex-wrap gap-1">${renderPurposeTags(row.purposes)}</div></td>
          <td class="px-3 py-3 align-top text-xs">${escapeHtml(testingRecord?.publishedAt || '待发布')}</td>
          <td class="px-3 py-3 align-top"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${VIDEO_PLATFORM_META[row.platform].color}">${VIDEO_PLATFORM_META[row.platform].label}</span></td>
          <td class="px-3 py-3 align-top text-xs">
            ${ownership ? `<span class="inline-flex rounded-full border px-2 py-0.5 ${ownership.badgeTone}">${ownership.label}</span><p class="mt-1 text-muted-foreground">${escapeHtml(ownership.detailText)}</p>` : '—'}
          </td>
          <td class="px-3 py-3 align-top text-xs">${escapeHtml(testingRecord?.styleCode || '—')}</td>
          <td class="px-3 py-3 align-top text-xs">${escapeHtml(testingRecord?.colorCode || '—')}</td>
          <td class="px-3 py-3 align-top text-xs">${escapeHtml(testingRecord?.sizeCode || '—')}</td>
          <td class="px-3 py-3 text-right align-top">${(testingRecord?.exposureQty ?? row.views).toLocaleString()}</td>
          <td class="px-3 py-3 text-right align-top">${(testingRecord?.clickQty ?? row.likes).toLocaleString()}</td>
          <td class="px-3 py-3 text-right align-top">${(testingRecord?.orderQty ?? 0).toLocaleString()}</td>
          <td class="px-3 py-3 text-right align-top">${(testingRecord?.gmvAmount ?? row.gmv).toLocaleString()}</td>
          <td class="px-3 py-3 align-top">${renderProjectTags(row.id, testingRecord?.legacyProjectRef ?? null)}</td>
          <td class="px-3 py-3 align-top">
            <div class="flex flex-wrap gap-1">
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-video-action="go-detail" data-record-id="${escapeHtml(row.id)}">查看</button>
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-video-action="open-project-relation" data-record-id="${escapeHtml(row.id)}">关联商品项目</button>
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-video-action="open-project-relation" data-record-id="${escapeHtml(row.id)}">查看已关联项目</button>
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-video-action="import-data" data-record-id="${escapeHtml(row.id)}">导入数据</button>
              ${canClose ? `<button class="inline-flex h-7 items-center rounded-md border border-emerald-300 px-2 text-xs text-emerald-700 hover:bg-emerald-50" data-pcs-video-action="open-close" data-record-id="${escapeHtml(row.id)}">完成关账</button>` : ''}
              ${canAccounting ? `<button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-50" data-pcs-video-action="open-accounting" data-record-id="${escapeHtml(row.id)}">完成测款入账</button>` : ''}
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
        <table class="w-full min-w-[1340px] text-sm">
          <thead>
            <tr class="border-b bg-muted/30 text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">记录ID / 标题</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium">用途</th>
              <th class="px-3 py-2 font-medium">发布时间</th>
              <th class="px-3 py-2 font-medium">平台</th>
              <th class="px-3 py-2 font-medium">样本归属</th>
              <th class="px-3 py-2 font-medium">款号 / 款式编码</th>
              <th class="px-3 py-2 font-medium">颜色</th>
              <th class="px-3 py-2 font-medium">规格</th>
              <th class="px-3 py-2 text-right font-medium">曝光量</th>
              <th class="px-3 py-2 text-right font-medium">点击量</th>
              <th class="px-3 py-2 text-right font-medium">下单量</th>
              <th class="px-3 py-2 text-right font-medium">销售额</th>
              <th class="px-3 py-2 font-medium">已关联项目</th>
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
        actionPrefix: 'pcs-video',
        pageSizeOptions: DEFAULT_PAGE_SIZE_OPTIONS,
      })}
    </section>
  `
}

function renderProjectRelationDrawer(): string {
  if (!state.relationDialogOpen || !state.relationTargetRecordId) return ''
  const record = getVideoTestRecordById(state.relationTargetRecordId)
  if (!record) return ''

  const projectOptions = listVideoRecordProjectRelationCandidates(record.videoRecordId)
  const enabledProjects = projectOptions.filter((item) => item.eligible)
  const disabledProjects = projectOptions.filter((item) => !item.eligible)

  const content = `
    <div class="space-y-4">
      <div class="rounded-md border bg-muted/20 p-3 text-sm">
        <p class="font-medium">${escapeHtml(record.videoTitle)}</p>
        <p class="mt-1 text-xs text-muted-foreground">记录 ${escapeHtml(record.videoRecordCode)} · 渠道 ${escapeHtml(record.channelName || '—')}</p>
      </div>
      <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
        仅已完成商品上架且渠道商品状态为“已上架待测款”的项目，才允许建立正式短视频测款关系。
      </div>
      <div class="space-y-2">
        <p class="text-xs font-medium text-foreground">可测款项目</p>
        <div class="max-h-[220px] space-y-2 overflow-y-auto rounded-md border bg-background p-2">
          ${
            enabledProjects.length > 0
              ? enabledProjects.map(renderVideoRelationCandidate).join('')
              : '<div class="rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground">当前没有满足商品上架前置门禁的项目。</div>'
          }
        </div>
      </div>
      ${
        disabledProjects.length > 0
          ? `
            <div class="space-y-2">
              <p class="text-xs font-medium text-foreground">暂不可测款项目</p>
              <div class="max-h-[200px] space-y-2 overflow-y-auto rounded-md border bg-background p-2">
                ${disabledProjects.map(renderVideoRelationCandidate).join('')}
              </div>
            </div>
          `
          : ''
      }
      ${
        state.relationSelectedProjectIds.length > 0
          ? `
            <div class="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              已选择 ${state.relationSelectedProjectIds.length} 个项目。保存时会再次执行仓储校验，不满足商品上架门禁的项目不会写入正式关系。
            </div>
          `
          : ''
      }
    </div>
  `

  return uiDrawer(
    {
      title: '关联商品项目',
      subtitle: '优先展示可测款项目；保存时仍会再次执行正式仓储校验。',
      closeAction: { prefix: 'pcs-video', action: 'close-project-relation' },
      width: 'lg',
    },
    content,
    {
      cancel: { prefix: 'pcs-video', action: 'close-project-relation', label: '取消' },
      confirm: { prefix: 'pcs-video', action: 'save-project-relation', label: '保存项目关联', variant: 'primary' },
    },
  )
}

function renderVideoRelationCandidate(project: TestingProjectRelationCandidate): string {
  const checked = state.relationSelectedProjectIds.includes(project.projectId)
  if (!project.eligible) {
    return `
      <div class="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="font-medium">${escapeHtml(project.projectCode)} · ${escapeHtml(project.projectName)}</p>
            <p class="mt-1 text-[11px]">当前阶段：${escapeHtml(project.currentPhaseName || '未进入测款阶段')}</p>
          </div>
          <span class="rounded-full border px-2 py-0.5 text-[11px]">${checked ? '历史已选' : '不可选择'}</span>
        </div>
        <p class="mt-2 text-[11px] text-amber-700">${escapeHtml(project.disabledReason || '当前项目不满足正式短视频测款门禁。')}</p>
      </div>
    `
  }

  return `
    <button class="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${checked ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-pcs-video-action="toggle-project" data-project-id="${escapeHtml(project.projectId)}">
      <span>
        <span class="block font-medium">${escapeHtml(project.projectCode)} · ${escapeHtml(project.projectName)}</span>
        <span class="mt-1 block text-[11px] text-muted-foreground">当前阶段：${escapeHtml(project.currentPhaseName)}</span>
      </span>
      <span class="text-xs">${checked ? '已选中' : '点击选择'}</span>
    </button>
  `
}

function renderPurposeSelector(): string {
  return `
    <div>
      <label class="mb-1 block text-xs text-muted-foreground">记录用途</label>
      <div class="grid grid-cols-2 gap-2 rounded-md border bg-background p-2">
        ${Object.entries(VIDEO_PURPOSE_META)
          .map(([key, meta]) => {
            const checked = state.createForm.purposes.includes(key as VideoPurpose)
            return `<button class="inline-flex h-8 items-center justify-center rounded-md border text-xs ${checked ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-pcs-video-action="toggle-purpose" data-purpose="${key}">${meta.label}</button>`
          })
          .join('')}
      </div>
    </div>
  `
}

function renderCreateDrawer(): string {
  if (!state.createDrawerOpen) return ''

  const formContent = `
    <div class="space-y-3">
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">记录标题</label>
        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.title)}" data-pcs-video-field="create-title" />
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">负责人</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.owner)}" data-pcs-video-field="create-owner" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">记录人</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.recorder)}" data-pcs-video-field="create-recorder" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">平台</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-video-field="create-platform">
            <option value="">请选择平台</option>
            ${Object.entries(VIDEO_PLATFORM_META).map(([key, meta]) => `<option value="${key}" ${state.createForm.platform === key ? 'selected' : ''}>${meta.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">账号</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.account)}" data-pcs-video-field="create-account" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">创作者</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.creator)}" data-pcs-video-field="create-creator" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">发布时间</label>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="2026-01-25 10:00" value="${escapeHtml(state.createForm.publishedAt)}" data-pcs-video-field="create-published-at" />
        </div>
      </div>
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">视频链接</label>
        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.createForm.videoUrl)}" data-pcs-video-field="create-video-url" />
      </div>
      ${renderPurposeSelector()}
      <label class="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" class="h-4 w-4 rounded border" ${state.createForm.isTestAccountingEnabled ? 'checked' : ''} data-pcs-video-field="create-accounting-enabled" />
        <span>启用测款入账</span>
      </label>
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">备注</label>
        <textarea class="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm" data-pcs-video-field="create-note">${escapeHtml(state.createForm.note)}</textarea>
      </div>
    </div>
  `

  return uiDrawer(
    {
      title: '新建短视频记录',
      subtitle: '支持草稿保存和直接进入核对。',
      closeAction: { prefix: 'pcs-video', action: 'close-create' },
      width: 'lg',
    },
    formContent,
    {
      extra: '<button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-video-action="save-draft">保存草稿</button>',
      cancel: { prefix: 'pcs-video', action: 'close-create', label: '取消' },
      confirm: { prefix: 'pcs-video', action: 'save-reconciling', label: '创建并进入核对', variant: 'primary' },
    }
  )
}

function renderCloseDialog(): string {
  if (!state.closeDialog.open) return ''
  const selected = getRecordById(state.closeDialog.recordId)
  if (!selected) return ''

  const formContent = `
    <div class="space-y-3">
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">未发布原因（可选）</label>
        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.closeReason)}" data-pcs-video-field="close-reason" />
      </div>
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">关账备注</label>
        <textarea class="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm" data-pcs-video-field="close-note">${escapeHtml(state.closeNote)}</textarea>
      </div>
    </div>
  `

  return renderFormDialog(
    {
      title: '完成记录（关账）',
      description: `${selected.id} ｜ ${selected.title}`,
      closeAction: { prefix: 'pcs-video', action: 'close-close' },
      submitAction: { prefix: 'pcs-video', action: 'confirm-close', label: '确认关账' },
      width: 'md',
    },
    formContent
  )
}

function renderAccountingDialog(): string {
  if (!state.accountingDialog.open) return ''
  const selected = getRecordById(state.accountingDialog.recordId)
  if (!selected) return ''

  const formContent = `
    <div class="space-y-3">
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">入账说明</label>
        <textarea class="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm" data-pcs-video-field="accounting-note">${escapeHtml(state.accountingNote)}</textarea>
      </div>
      <label class="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" class="h-4 w-4 rounded border" ${state.accountingConfirmed ? 'checked' : ''} data-pcs-video-field="accounting-confirmed" />
        <span>确认测款条目已核对</span>
      </label>
    </div>
  `

  return renderFormDialog(
    {
      title: '完成测款核对（入账）',
      description: `${selected.id} ｜ 测款条目 ${selected.testItemCount} 条`,
      closeAction: { prefix: 'pcs-video', action: 'close-accounting' },
      submitAction: { prefix: 'pcs-video', action: 'confirm-accounting', label: '确认入账' },
      width: 'md',
    },
    formContent
  )
}

function resetCreateForm(): void {
  state.createForm = {
    title: '',
    owner: '',
    recorder: '',
    platform: '',
    account: '',
    creator: '',
    publishedAt: '',
    videoUrl: '',
    purposes: [],
    isTestAccountingEnabled: false,
    note: '',
  }
}

function createRecord(status: SessionStatus): void {
  const id = `SV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(records.length + 1).padStart(3, '0')}`

  const newRecord: VideoRecord = {
    id,
    title: state.createForm.title || '新短视频记录',
    status,
    purposes: state.createForm.purposes.length ? state.createForm.purposes : ['OTHER'],
    platform: (state.createForm.platform || 'OTHER') as VideoRecord['platform'],
    account: state.createForm.account || '待补充账号',
    creator: state.createForm.creator || '待补充创作者',
    publishedAt: state.createForm.publishedAt || null,
    owner: state.createForm.owner || '未填写',
    recorder: state.createForm.recorder || '未填写',
    itemCount: 0,
    testItemCount: 0,
    testAccountingStatus: state.createForm.isTestAccountingEnabled ? 'PENDING' : 'NONE',
    sampleCount: 0,
    views: 0,
    likes: 0,
    gmv: 0,
    isTestAccountingEnabled: state.createForm.isTestAccountingEnabled,
    videoUrl: state.createForm.videoUrl,
    updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    note: state.createForm.note,
  }

  records = [newRecord, ...records]
  state.createDrawerOpen = false
  state.currentPage = 1
  state.notice = `${newRecord.id} 已${status === 'DRAFT' ? '保存为草稿' : '创建并进入核对'}（演示态）。`
  resetCreateForm()
}

function closeAllDialogs(): void {
  state.createDrawerOpen = false
  state.closeDialog = { open: false, recordId: null }
  state.accountingDialog = { open: false, recordId: null }
  state.relationDialogOpen = false
  state.relationTargetRecordId = null
  state.relationSelectedProjectIds = []
}

export function renderPcsVideoRecordsPage(): string {
  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderNotice()}
      ${renderKpis()}
      ${renderOwnershipQuickFilters()}
      ${renderFilters()}
      ${renderTable()}
      ${renderCreateDrawer()}
      ${renderCloseDialog()}
      ${renderAccountingDialog()}
      ${renderProjectRelationDrawer()}
    </div>
  `
}

export function handlePcsVideoRecordsEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-video-field]')

  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.pcsVideoField
    if (field === 'searchKeyword') {
      state.searchKeyword = fieldNode.value
      state.currentPage = 1
      return true
    }
    if (field === 'create-title') state.createForm.title = fieldNode.value
    if (field === 'create-owner') state.createForm.owner = fieldNode.value
    if (field === 'create-recorder') state.createForm.recorder = fieldNode.value
    if (field === 'create-account') state.createForm.account = fieldNode.value
    if (field === 'create-creator') state.createForm.creator = fieldNode.value
    if (field === 'create-published-at') state.createForm.publishedAt = fieldNode.value
    if (field === 'create-video-url') state.createForm.videoUrl = fieldNode.value
    if (field === 'create-accounting-enabled') state.createForm.isTestAccountingEnabled = fieldNode.checked
    if (field === 'close-reason') state.closeReason = fieldNode.value
    if (field === 'accounting-confirmed') state.accountingConfirmed = fieldNode.checked
    return true
  }

  if (fieldNode instanceof HTMLTextAreaElement) {
    const field = fieldNode.dataset.pcsVideoField
    if (field === 'create-note') state.createForm.note = fieldNode.value
    if (field === 'close-note') state.closeNote = fieldNode.value
    if (field === 'accounting-note') state.accountingNote = fieldNode.value
    return true
  }

  if (fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pcsVideoField
    if (field === 'statusFilter') state.statusFilter = fieldNode.value as PageState['statusFilter']
    if (field === 'ownershipFilter') state.ownershipFilter = fieldNode.value as TestingOwnershipFilter
    if (field === 'purposeFilter') state.purposeFilter = fieldNode.value as PageState['purposeFilter']
    if (field === 'platformFilter') state.platformFilter = fieldNode.value as PageState['platformFilter']
    if (field === 'accountingFilter') state.accountingFilter = fieldNode.value as PageState['accountingFilter']
    if (field === 'pageSize') state.pageSize = parsePageSize(fieldNode.value)
    if (field === 'create-platform') state.createForm.platform = fieldNode.value as CreateFormState['platform']
    state.currentPage = 1
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-video-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsVideoAction
  if (!action) return false

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'set-quick') {
    state.quickFilter = (actionNode.dataset.quickKey as QuickFilter | undefined) ?? 'all'
    state.currentPage = 1
    return true
  }

  if (action === 'set-ownership-filter') {
    state.ownershipFilter = (actionNode.dataset.ownershipFilter as TestingOwnershipFilter) ?? 'all'
    state.currentPage = 1
    return true
  }

  if (action === 'reset-filters') {
    state.searchKeyword = ''
    state.ownershipFilter = 'all'
    state.statusFilter = 'all'
    state.purposeFilter = 'all'
    state.platformFilter = 'all'
    state.accountingFilter = 'all'
    state.quickFilter = 'all'
    state.currentPage = 1
    return true
  }

  if (action === 'go-detail') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return false
    appStore.navigate(`/pcs/testing/video/${recordId}`)
    return true
  }

  if (action === 'import-data') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return false
    state.notice = `${recordId} 已触发导入数据（演示态）。`
    return true
  }

  if (action === 'open-project-relation') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return false
    state.relationTargetRecordId = recordId
    state.relationSelectedProjectIds = listProjectRelationsByVideoRecord(recordId).map((relation) => relation.projectId)
    state.relationDialogOpen = true
    return true
  }

  if (action === 'close-project-relation') {
    state.relationDialogOpen = false
    state.relationTargetRecordId = null
    state.relationSelectedProjectIds = []
    return true
  }

  if (action === 'toggle-project') {
    const projectId = actionNode.dataset.projectId
    if (!projectId) return false
    if (state.relationSelectedProjectIds.includes(projectId)) {
      state.relationSelectedProjectIds = state.relationSelectedProjectIds.filter((item) => item !== projectId)
    } else {
      state.relationSelectedProjectIds = [...state.relationSelectedProjectIds, projectId]
    }
    return true
  }

  if (action === 'save-project-relation') {
    if (!state.relationTargetRecordId) return false
    const result = replaceVideoRecordProjectRelations(state.relationTargetRecordId, state.relationSelectedProjectIds)
    if (result.errors.length === 0) {
      state.relationDialogOpen = false
      state.relationTargetRecordId = null
      state.relationSelectedProjectIds = []
      state.notice = '短视频记录的项目关联已更新，结果已写入正式项目关系记录。'
    } else {
      state.notice = result.errors[0]
    }
    return true
  }

  if (action === 'unlink-project') {
    const recordId = actionNode.dataset.recordId
    const projectId = actionNode.dataset.projectId
    if (!recordId || !projectId) return false
    unlinkVideoRecordProjectRelation(recordId, projectId)
    state.notice = '已解除短视频记录与商品项目的正式关联。'
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

  if (action === 'toggle-purpose') {
    const purpose = actionNode.dataset.purpose as VideoPurpose | undefined
    if (!purpose) return false
    if (state.createForm.purposes.includes(purpose)) {
      state.createForm.purposes = state.createForm.purposes.filter((item) => item !== purpose)
    } else {
      state.createForm.purposes = [...state.createForm.purposes, purpose]
    }
    state.createForm.isTestAccountingEnabled = state.createForm.purposes.includes('TEST')
    return true
  }

  if (action === 'save-draft') {
    createRecord('DRAFT')
    return true
  }

  if (action === 'save-reconciling') {
    createRecord('RECONCILING')
    return true
  }

  if (action === 'open-close') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return false
    state.closeDialog = { open: true, recordId }
    state.closeReason = ''
    state.closeNote = ''
    return true
  }

  if (action === 'close-close') {
    state.closeDialog = { open: false, recordId: null }
    state.closeReason = ''
    state.closeNote = ''
    return true
  }

  if (action === 'confirm-close') {
    const selected = getRecordById(state.closeDialog.recordId)
    if (!selected) return false
    if (!state.closeNote.trim()) {
      state.notice = '请先填写关账备注。'
      return true
    }
    selected.status = 'COMPLETED'
    selected.updatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
    state.closeDialog = { open: false, recordId: null }
    state.notice = `${selected.id} 已完成关账（演示态）。`
    return true
  }

  if (action === 'open-accounting') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return false
    state.accountingDialog = { open: true, recordId }
    state.accountingNote = ''
    state.accountingConfirmed = false
    return true
  }

  if (action === 'close-accounting') {
    state.accountingDialog = { open: false, recordId: null }
    state.accountingNote = ''
    state.accountingConfirmed = false
    return true
  }

  if (action === 'confirm-accounting') {
    const selected = getRecordById(state.accountingDialog.recordId)
    if (!selected) return false
    if (!state.accountingNote.trim()) {
      state.notice = '请先填写入账说明。'
      return true
    }
    if (!state.accountingConfirmed) {
      state.notice = '请确认测款条目已核对。'
      return true
    }
    selected.testAccountingStatus = 'ACCOUNTED'
    selected.updatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
    state.accountingDialog = { open: false, recordId: null }
    state.notice = `${selected.id} 已完成测款入账（演示态）。`
    return true
  }

  if (action === 'prev-page') {
    state.currentPage = getPrevPage(state.currentPage)
    return true
  }

  if (action === 'next-page') {
    state.currentPage = getNextPage(state.currentPage, getFilteredRows().length, state.pageSize)
    return true
  }

  if (action === 'close-dialog') {
    closeAllDialogs()
    return true
  }

  return false
}

export function isPcsVideoRecordsDialogOpen(): boolean {
  return state.createDrawerOpen || state.closeDialog.open || state.accountingDialog.open || state.relationDialogOpen
}

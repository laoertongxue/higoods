import {
  getChannelNamesByCodes,
  listProjectListRecords,
  type PcsProjectListRecord,
  type ProjectListStyleType,
} from '../data/pcs-project-list-store.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'

type ProjectListViewMode = 'list' | 'grid'
type ProjectListSort = 'updatedAt' | 'pendingDecision' | 'risk' | 'progressLow'
type ProjectDateRange = '全部时间' | '今天' | '最近一周' | '最近一月'

interface ProjectListState {
  search: string
  styleType: string
  status: string
  owner: string
  phase: string
  riskStatus: string
  dateRange: ProjectDateRange
  pendingDecisionOnly: boolean
  advancedOpen: boolean
  viewMode: ProjectListViewMode
  sortBy: ProjectListSort
  currentPage: number
  pageSize: number
}

interface ProjectListViewModel {
  project: PcsProjectListRecord
  channelNames: string[]
}

const STYLE_TYPE_OPTIONS: Array<'全部' | ProjectListStyleType> = ['全部', '基础款', '快时尚款', '改版款', '设计款']
const PROJECT_STATUS_OPTIONS = ['全部', '已立项', '进行中', '已终止', '已归档']
const RISK_STATUS_OPTIONS = ['全部', '正常', '延期']
const DATE_RANGE_OPTIONS: ProjectDateRange[] = ['全部时间', '今天', '最近一周', '最近一月']

const initialState: ProjectListState = {
  search: '',
  styleType: '全部',
  status: '全部',
  owner: '全部负责人',
  phase: '全部阶段',
  riskStatus: '全部',
  dateRange: '全部时间',
  pendingDecisionOnly: false,
  advancedOpen: false,
  viewMode: 'list',
  sortBy: 'updatedAt',
  currentPage: 1,
  pageSize: 8,
}

const state: { list: ProjectListState } = {
  list: { ...initialState },
}

function getProjectStatusBadgeClass(status: PcsProjectListRecord['projectStatus']): string {
  if (status === '已立项') return 'bg-blue-100 text-blue-700'
  if (status === '进行中') return 'bg-emerald-100 text-emerald-700'
  if (status === '已终止') return 'bg-rose-100 text-rose-700'
  return 'bg-slate-100 text-slate-600'
}

function getStyleTypeBadgeClass(styleType: ProjectListStyleType): string {
  if (styleType === '快时尚款') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (styleType === '改版款') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (styleType === '设计款') return 'border-violet-200 bg-violet-50 text-violet-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function buildProjectListViewModels(): ProjectListViewModel[] {
  return listProjectListRecords().map((project) => ({
    project,
    channelNames: getChannelNamesByCodes(project.targetChannelCodes),
  }))
}

function matchesDateRange(updatedAt: string, range: ProjectDateRange): boolean {
  if (range === '全部时间') return true

  const targetDate = new Date(updatedAt.replace(' ', 'T'))
  if (Number.isNaN(targetDate.getTime())) {
    return false
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (range === '今天') {
    return targetDate >= todayStart
  }

  const dayRange = range === '最近一周' ? 7 : 30
  const from = new Date(todayStart)
  from.setDate(from.getDate() - (dayRange - 1))
  return targetDate >= from
}

function getFilteredProjects(): ProjectListViewModel[] {
  const keyword = state.list.search.trim().toLowerCase()

  return buildProjectListViewModels()
    .filter((item) => {
      const project = item.project
      if (state.list.styleType !== '全部' && project.styleType !== state.list.styleType) return false
      if (state.list.status !== '全部' && project.projectStatus !== state.list.status) return false
      if (state.list.owner !== '全部负责人' && project.ownerName !== state.list.owner) return false
      if (state.list.phase !== '全部阶段' && (project.currentPhaseName || '-') !== state.list.phase) return false
      if (state.list.riskStatus !== '全部' && project.riskStatus !== state.list.riskStatus) return false
      if (state.list.pendingDecisionOnly && !project.pendingDecisionFlag) return false
      if (!matchesDateRange(project.updatedAt, state.list.dateRange)) return false
      if (!keyword) return true

      const haystack = [
        project.projectName,
        project.projectCode,
        project.categoryName,
        project.subCategoryName,
        project.brandName,
        project.ownerName,
        project.currentPhaseName,
        project.nextWorkItemName,
        ...project.styleTagNames,
        ...item.channelNames,
      ]
        .join('|')
        .toLowerCase()

      return haystack.includes(keyword)
    })
    .sort((left, right) => {
      if (state.list.sortBy === 'pendingDecision') {
        const decisionDiff = Number(right.project.pendingDecisionFlag) - Number(left.project.pendingDecisionFlag)
        if (decisionDiff !== 0) return decisionDiff
      }
      if (state.list.sortBy === 'risk') {
        const riskDiff = Number(right.project.riskStatus === '延期') - Number(left.project.riskStatus === '延期')
        if (riskDiff !== 0) return riskDiff
      }
      if (state.list.sortBy === 'progressLow') {
        const leftProgress = left.project.progressTotal === 0 ? 1 : left.project.progressDone / left.project.progressTotal
        const rightProgress = right.project.progressTotal === 0 ? 1 : right.project.progressDone / right.project.progressTotal
        if (leftProgress !== rightProgress) return leftProgress - rightProgress
      }
      return right.project.updatedAt.localeCompare(left.project.updatedAt)
    })
}

function getPagedProjects(): { filtered: ProjectListViewModel[]; totalPages: number; paged: ProjectListViewModel[] } {
  const filtered = getFilteredProjects()
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.list.pageSize))
  if (state.list.currentPage > totalPages) state.list.currentPage = totalPages
  if (state.list.currentPage < 1) state.list.currentPage = 1
  const startIndex = (state.list.currentPage - 1) * state.list.pageSize
  return {
    filtered,
    totalPages,
    paged: filtered.slice(startIndex, startIndex + state.list.pageSize),
  }
}

function buildOwnerOptions(projects: ProjectListViewModel[]): string[] {
  return ['全部负责人', ...Array.from(new Set(projects.map((item) => item.project.ownerName).filter(Boolean)))]
}

function buildPhaseOptions(projects: ProjectListViewModel[]): string[] {
  return ['全部阶段', ...Array.from(new Set(projects.map((item) => item.project.currentPhaseName || '-')))]
}

function renderProjectProgress(project: ProjectListViewModel): string {
  const percent =
    project.project.progressTotal === 0 ? 0 : Math.round((project.project.progressDone / project.project.progressTotal) * 100)

  return `
    <div class="space-y-1">
      <div class="flex items-center gap-2">
        <div class="h-2 w-24 rounded-full bg-slate-100">
          <div class="h-2 rounded-full bg-blue-600" style="width:${percent}%"></div>
        </div>
        <span class="text-xs text-slate-500">${project.project.progressDone}/${project.project.progressTotal}</span>
      </div>
      ${
        project.project.nextWorkItemName && project.project.nextWorkItemName !== '-'
          ? `<p class="text-xs text-slate-500">下一步：${escapeHtml(project.project.nextWorkItemName)}${project.project.nextWorkItemStatus !== '-' ? `（${escapeHtml(project.project.nextWorkItemStatus)}）` : ''}</p>`
          : '<p class="text-xs text-slate-500">已完成全部节点</p>'
      }
    </div>
  `
}

function renderPagination(totalPages: number): string {
  if (totalPages <= 1) return ''
  const pages = new Set<number>([1, totalPages, state.list.currentPage, state.list.currentPage - 1, state.list.currentPage + 1])
  const visiblePages = Array.from(pages).filter((item) => item >= 1 && item <= totalPages).sort((a, b) => a - b)

  return `
    <div class="flex items-center justify-between border-t bg-white px-4 py-3">
      <p class="text-xs text-slate-500">第 ${state.list.currentPage} / ${totalPages} 页</p>
      <div class="flex items-center gap-2">
        <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50 ${state.list.currentPage === 1 ? 'cursor-not-allowed opacity-50' : ''}" data-pcs-project-list-action="set-page" data-page="${state.list.currentPage - 1}" ${state.list.currentPage === 1 ? 'disabled' : ''}>上一页</button>
        ${visiblePages
          .map(
            (page) => `
              <button type="button" class="${toClassName(
                'inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs',
                page === state.list.currentPage
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              )}" data-pcs-project-list-action="set-page" data-page="${page}">${page}</button>
            `,
          )
          .join('')}
        <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50 ${state.list.currentPage === totalPages ? 'cursor-not-allowed opacity-50' : ''}" data-pcs-project-list-action="set-page" data-page="${state.list.currentPage + 1}" ${state.list.currentPage === totalPages ? 'disabled' : ''}>下一页</button>
      </div>
    </div>
  `
}

function renderToolbar(filteredCount: number, projects: ProjectListViewModel[]): string {
  const ownerOptions = buildOwnerOptions(projects)
  const phaseOptions = buildPhaseOptions(projects)

  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="grid gap-3 xl:grid-cols-[minmax(240px,1.5fr)_160px_auto_auto]">
        <label class="space-y-1">
          <span class="text-xs text-slate-500">搜索项目</span>
          <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="搜索项目名称、编码或关键词" value="${escapeHtml(state.list.search)}" data-pcs-project-list-field="list-search" />
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">排序方式</span>
          <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-project-list-field="list-sort">
            <option value="updatedAt" ${state.list.sortBy === 'updatedAt' ? 'selected' : ''}>最近更新</option>
            <option value="pendingDecision" ${state.list.sortBy === 'pendingDecision' ? 'selected' : ''}>待决策优先</option>
            <option value="risk" ${state.list.sortBy === 'risk' ? 'selected' : ''}>风险优先</option>
            <option value="progressLow" ${state.list.sortBy === 'progressLow' ? 'selected' : ''}>进度最低优先</option>
          </select>
        </label>
        <div class="flex items-end gap-2">
          <button type="button" class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-project-list-action="query">查询</button>
          <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" data-pcs-project-list-action="reset-list">重置筛选</button>
        </div>
        <div class="flex items-end justify-end gap-2">
          <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" data-pcs-project-list-action="toggle-advanced">${state.list.advancedOpen ? '收起高级筛选' : '高级筛选'}</button>
        </div>
      </div>
      <div class="mt-4 flex flex-wrap items-center gap-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-slate-500">款式类型</span>
          ${STYLE_TYPE_OPTIONS.map(
            (option) => `
              <button type="button" class="${toClassName(
                'inline-flex h-8 items-center rounded-md px-3 text-xs',
                state.list.styleType === option ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}" data-pcs-project-list-action="set-style-filter" data-value="${escapeHtml(option)}">${escapeHtml(option)}</button>
            `,
          ).join('')}
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-slate-500">状态</span>
          ${PROJECT_STATUS_OPTIONS.map(
            (option) => `
              <button type="button" class="${toClassName(
                'inline-flex h-8 items-center rounded-md px-3 text-xs',
                state.list.status === option ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}" data-pcs-project-list-action="set-status-filter" data-value="${escapeHtml(option)}">${escapeHtml(option)}</button>
            `,
          ).join('')}
        </div>
        <button type="button" class="${toClassName(
          'inline-flex h-8 items-center rounded-md px-3 text-xs',
          state.list.pendingDecisionOnly ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
        )}" data-pcs-project-list-action="toggle-pending-decision">待决策</button>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-slate-500">风险</span>
          ${RISK_STATUS_OPTIONS.map(
            (option) => `
              <button type="button" class="${toClassName(
                'inline-flex h-8 items-center rounded-md px-3 text-xs',
                state.list.riskStatus === option ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}" data-pcs-project-list-action="set-risk-filter" data-value="${escapeHtml(option)}">${escapeHtml(option)}</button>
            `,
          ).join('')}
        </div>
      </div>
      ${
        state.list.advancedOpen
          ? `
            <div class="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-3">
              <label class="space-y-1">
                <span class="text-xs text-slate-500">负责人</span>
                <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-project-list-field="list-owner">
                  ${ownerOptions
                    .map(
                      (option) =>
                        `<option value="${escapeHtml(option)}" ${state.list.owner === option ? 'selected' : ''}>${escapeHtml(option)}</option>`,
                    )
                    .join('')}
                </select>
              </label>
              <label class="space-y-1">
                <span class="text-xs text-slate-500">当前阶段</span>
                <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-project-list-field="list-phase">
                  ${phaseOptions
                    .map(
                      (option) =>
                        `<option value="${escapeHtml(option)}" ${state.list.phase === option ? 'selected' : ''}>${escapeHtml(option)}</option>`,
                    )
                    .join('')}
                </select>
              </label>
              <label class="space-y-1">
                <span class="text-xs text-slate-500">最近更新范围</span>
                <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-project-list-field="list-date-range">
                  ${DATE_RANGE_OPTIONS.map(
                    (option) =>
                      `<option value="${escapeHtml(option)}" ${state.list.dateRange === option ? 'selected' : ''}>${escapeHtml(option)}</option>`,
                  ).join('')}
                </select>
              </label>
            </div>
          `
          : ''
      }
      <div class="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <p class="text-sm text-slate-500">共 ${filteredCount} 个项目</p>
        <div class="inline-flex items-center rounded-md bg-slate-100 p-1">
          <button type="button" class="${toClassName('inline-flex h-7 items-center rounded-md px-2 text-xs', state.list.viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}" data-pcs-project-list-action="set-view-mode" data-value="list">列表</button>
          <button type="button" class="${toClassName('inline-flex h-7 items-center rounded-md px-2 text-xs', state.list.viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}" data-pcs-project-list-action="set-view-mode" data-value="grid">卡片</button>
        </div>
      </div>
    </section>
  `
}

function renderProjectTable(projects: ProjectListViewModel[], totalPages: number): string {
  return `
    <section class="overflow-hidden rounded-lg border bg-white">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-50">
            <tr class="border-b border-slate-200 text-left text-slate-600">
              <th class="px-4 py-3 font-medium">操作</th>
              <th class="px-4 py-3 font-medium min-w-[260px]">项目名称</th>
              <th class="px-4 py-3 font-medium">项目编码</th>
              <th class="px-4 py-3 font-medium">款式类型</th>
              <th class="px-4 py-3 font-medium">分类</th>
              <th class="px-4 py-3 font-medium">风格</th>
              <th class="px-4 py-3 font-medium">当前阶段</th>
              <th class="px-4 py-3 font-medium min-w-[180px]">项目进度</th>
              <th class="px-4 py-3 font-medium">风险</th>
              <th class="px-4 py-3 font-medium">负责人</th>
              <th class="px-4 py-3 font-medium">最近更新</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${
              projects.length === 0
                ? `
                  <tr>
                    <td colspan="11" class="px-4 py-16 text-center">
                      <p class="text-sm font-medium text-slate-700">暂无符合条件的商品项目</p>
                      <button type="button" class="mt-4 inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-nav="/pcs/projects/create">新建商品项目</button>
                    </td>
                  </tr>
                `
                : projects
                    .map(
                      (item) => `
                        <tr class="align-top hover:bg-slate-50">
                          <td class="px-4 py-3">
                            <button type="button" class="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/projects/${escapeHtml(item.project.projectId)}">查看</button>
                          </td>
                          <td class="px-4 py-3">
                            <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(item.project.projectId)}">${escapeHtml(item.project.projectName)}</button>
                            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs">
                              <span class="inline-flex rounded-full px-2 py-0.5 ${getProjectStatusBadgeClass(item.project.projectStatus)}">${escapeHtml(item.project.projectStatus)}</span>
                              ${item.project.pendingDecisionFlag ? '<span class="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">待决策</span>' : ''}
                            </div>
                          </td>
                          <td class="px-4 py-3 text-slate-500">${escapeHtml(item.project.projectCode)}</td>
                          <td class="px-4 py-3"><span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${getStyleTypeBadgeClass(item.project.styleType)}">${escapeHtml(item.project.styleType)}</span></td>
                          <td class="px-4 py-3">
                            <p class="text-slate-700">${escapeHtml(item.project.categoryName)}</p>
                            <p class="mt-1 text-xs text-slate-400">${escapeHtml(item.project.subCategoryName || '-')}</p>
                          </td>
                          <td class="px-4 py-3">
                            <div class="flex flex-wrap gap-1">
                              ${item.project.styleTagNames.length > 0 ? item.project.styleTagNames.map((tag) => `<span class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">${escapeHtml(tag)}</span>`).join('') : '<span class="text-slate-400">-</span>'}
                            </div>
                          </td>
                          <td class="px-4 py-3">
                            <p class="text-slate-700">${escapeHtml(item.project.currentPhaseName || '-')}</p>
                            <p class="mt-1 text-xs text-slate-400">${escapeHtml(item.project.nextWorkItemName || '无待执行节点')}</p>
                          </td>
                          <td class="px-4 py-3">${renderProjectProgress(item)}</td>
                          <td class="px-4 py-3">
                            <div class="inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs ${item.project.riskStatus === '延期' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}">
                              <span class="h-1.5 w-1.5 rounded-full ${item.project.riskStatus === '延期' ? 'bg-amber-500' : 'bg-emerald-500'}"></span>
                              ${escapeHtml(item.project.riskStatus)}
                            </div>
                            ${
                              item.project.riskStatus === '延期' && item.project.riskReason
                                ? `<p class="mt-1 max-w-[180px] text-xs text-slate-500">${escapeHtml(item.project.riskReason)}</p>`
                                : ''
                            }
                          </td>
                          <td class="px-4 py-3 text-slate-700">${escapeHtml(item.project.ownerName)}</td>
                          <td class="px-4 py-3 text-slate-500">${escapeHtml(formatDateTime(item.project.updatedAt))}</td>
                        </tr>
                      `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
      ${renderPagination(totalPages)}
    </section>
  `
}

function renderProjectGrid(projects: ProjectListViewModel[], totalPages: number): string {
  return `
    <section class="space-y-4">
      ${
        projects.length === 0
          ? `
            <div class="rounded-lg border bg-white p-16 text-center">
              <p class="text-sm font-medium text-slate-700">暂无符合条件的商品项目</p>
              <button type="button" class="mt-4 inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-nav="/pcs/projects/create">新建商品项目</button>
            </div>
          `
          : `
            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              ${projects
                .map(
                  (item) => `
                    <article class="rounded-lg border bg-white p-4">
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <button type="button" class="text-left text-base font-semibold text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(item.project.projectId)}">${escapeHtml(item.project.projectName)}</button>
                          <p class="mt-1 text-xs text-slate-400">${escapeHtml(item.project.projectCode)}</p>
                        </div>
                        <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getProjectStatusBadgeClass(item.project.projectStatus)}">${escapeHtml(item.project.projectStatus)}</span>
                      </div>
                      <div class="mt-4 flex flex-wrap gap-2">
                        <span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${getStyleTypeBadgeClass(item.project.styleType)}">${escapeHtml(item.project.styleType)}</span>
                        <span class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">${escapeHtml(item.project.categoryName)}</span>
                        ${item.project.pendingDecisionFlag ? '<span class="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">待决策</span>' : ''}
                      </div>
                      <div class="mt-4 space-y-3 text-sm text-slate-600">
                        <div class="flex items-center justify-between"><span>当前阶段</span><span class="font-medium text-slate-900">${escapeHtml(item.project.currentPhaseName || '-')}</span></div>
                        <div class="flex items-center justify-between"><span>负责人</span><span class="font-medium text-slate-900">${escapeHtml(item.project.ownerName)}</span></div>
                        <div class="flex items-center justify-between"><span>风险状态</span><span class="font-medium ${item.project.riskStatus === '延期' ? 'text-amber-600' : 'text-emerald-600'}">${escapeHtml(item.project.riskStatus)}</span></div>
                      </div>
                      <div class="mt-4">${renderProjectProgress(item)}</div>
                      <div class="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
                        <span class="text-xs text-slate-400">${escapeHtml(formatDateTime(item.project.updatedAt))}</span>
                        <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/projects/${escapeHtml(item.project.projectId)}">查看详情</button>
                      </div>
                    </article>
                  `,
                )
                .join('')}
            </div>
          `
      }
      ${renderPagination(totalPages)}
    </section>
  `
}

function renderHeader(): string {
  return `
    <section class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs text-slate-500">商品中心 / 商品项目</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900">商品项目列表</h1>
      </div>
      <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-nav="/pcs/projects/create">
        <i data-lucide="plus" class="h-4 w-4"></i>新建商品项目
      </button>
    </section>
  `
}

export async function renderPcsProjectListPage(): Promise<string> {
  const { filtered, totalPages, paged } = getPagedProjects()

  return `
    <div class="space-y-5 p-4 pb-24">
      ${renderHeader()}
      ${renderToolbar(filtered.length, filtered)}
      ${state.list.viewMode === 'grid' ? renderProjectGrid(paged, totalPages) : renderProjectTable(paged, totalPages)}
    </div>
  `
}

export function handlePcsProjectListInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-project-list-field]')
  if (!fieldNode) return false
  const field = fieldNode.dataset.pcsProjectListField
  if (!field) return false

  if (field === 'list-search' && fieldNode instanceof HTMLInputElement) {
    state.list.search = fieldNode.value
    state.list.currentPage = 1
    return true
  }
  if (field === 'list-sort' && fieldNode instanceof HTMLSelectElement) {
    state.list.sortBy = fieldNode.value as ProjectListSort
    state.list.currentPage = 1
    return true
  }
  if (field === 'list-owner' && fieldNode instanceof HTMLSelectElement) {
    state.list.owner = fieldNode.value
    state.list.currentPage = 1
    return true
  }
  if (field === 'list-phase' && fieldNode instanceof HTMLSelectElement) {
    state.list.phase = fieldNode.value
    state.list.currentPage = 1
    return true
  }
  if (field === 'list-date-range' && fieldNode instanceof HTMLSelectElement) {
    state.list.dateRange = fieldNode.value as ProjectDateRange
    state.list.currentPage = 1
    return true
  }

  return false
}

export function handlePcsProjectListEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-project-list-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsProjectListAction
  if (!action) return false

  if (action === 'query') {
    state.list.currentPage = 1
    return true
  }
  if (action === 'reset-list') {
    state.list = { ...initialState }
    return true
  }
  if (action === 'toggle-advanced') {
    state.list.advancedOpen = !state.list.advancedOpen
    return true
  }
  if (action === 'set-style-filter') {
    state.list.styleType = actionNode.dataset.value || '全部'
    state.list.currentPage = 1
    return true
  }
  if (action === 'set-status-filter') {
    state.list.status = actionNode.dataset.value || '全部'
    state.list.currentPage = 1
    return true
  }
  if (action === 'set-risk-filter') {
    state.list.riskStatus = actionNode.dataset.value || '全部'
    state.list.currentPage = 1
    return true
  }
  if (action === 'toggle-pending-decision') {
    state.list.pendingDecisionOnly = !state.list.pendingDecisionOnly
    state.list.currentPage = 1
    return true
  }
  if (action === 'set-view-mode') {
    state.list.viewMode = actionNode.dataset.value === 'grid' ? 'grid' : 'list'
    return true
  }
  if (action === 'set-page') {
    const page = Number.parseInt(actionNode.dataset.page ?? '', 10)
    if (Number.isFinite(page) && page > 0) {
      state.list.currentPage = page
    }
    return true
  }

  return false
}

export function isPcsProjectListDialogOpen(): boolean {
  return false
}

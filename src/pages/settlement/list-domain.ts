import {
  PAGE_SIZE,
  state,
  cycleTypeConfig,
  pricingModeConfig,
  settlementStatusConfig,
  getSettlementStatusClass,
  getSettlementStatusLabel,
  escapeHtml,
  maskBankAccountNo,
  getChangedFieldsSummary,
  syncSettlementRequestState,
  getFilteredSummaries,
  getPagedSummaries,
  getFilteredRequests,
  getPagedRequests,
  type SettlementChangeRequest,
  type CycleType,
  type SettlementStatus,
} from './context'
import { getSettlementPageBoundary } from '../../data/fcs/settlement-flow-boundaries'
import { renderInitFactoryPickerDialog } from './init-domain'
import { renderSettlementRequestDetailDialog, renderSettlementRequestPrintDialog } from './request-domain'

function renderPagination(total: number): string {
  const totalPages = Math.ceil(total / PAGE_SIZE)
  if (totalPages <= 1) return ''

  return `
    <div class="flex items-center gap-1">
      <button data-settle-action="prev-page" class="rounded-md border px-3 py-1 text-sm ${state.currentPage === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}">上一页</button>
      ${Array.from({ length: totalPages }, (_, index) => index + 1)
        .map(
          (page) =>
            `<button data-settle-action="goto-page" data-page="${page}" class="rounded-md border px-3 py-1 text-sm ${page === state.currentPage ? 'bg-blue-600 text-white' : 'hover:bg-muted'}">${page}</button>`,
        )
        .join('')}
      <button data-settle-action="next-page" class="rounded-md border px-3 py-1 text-sm ${state.currentPage === totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}">下一页</button>
    </div>
  `
}

function renderRequestPagination(total: number): string {
  const totalPages = Math.ceil(total / PAGE_SIZE)
  if (totalPages <= 1) return ''

  return `
    <div class="flex items-center gap-1">
      <button data-settle-action="request-prev-page" class="rounded-md border px-3 py-1 text-sm ${state.requestPage === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}">上一页</button>
      ${Array.from({ length: totalPages }, (_, index) => index + 1)
        .map(
          (page) =>
            `<button data-settle-action="request-goto-page" data-page="${page}" class="rounded-md border px-3 py-1 text-sm ${page === state.requestPage ? 'bg-blue-600 text-white' : 'hover:bg-muted'}">${page}</button>`,
        )
        .join('')}
      <button data-settle-action="request-next-page" class="rounded-md border px-3 py-1 text-sm ${state.requestPage === totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}">下一页</button>
    </div>
  `
}

function renderRequestStats(requests: SettlementChangeRequest[]): string {
  const pendingReview = requests.filter((item) => item.status === 'PENDING_REVIEW').length
  const approvedCount = requests.filter((item) => item.status === 'APPROVED').length
  const rejectedCount = requests.filter((item) => item.status === 'REJECTED').length
  const today = new Date().toISOString().slice(0, 10)
  const todayCount = requests.filter((item) => item.submittedAt.startsWith(today)).length

  const stats = [
    { label: '待审核', value: pendingReview, status: 'PENDING_REVIEW' as const },
    { label: '已通过', value: approvedCount, status: 'APPROVED' as const },
    { label: '未通过', value: rejectedCount, status: 'REJECTED' as const },
    { label: '今日新增', value: todayCount, status: null },
  ]

  return `
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      ${stats
        .map((item) => {
          const clickable = item.status !== null
          return `
            <button
              class="rounded-lg border bg-card px-4 py-3 text-left ${clickable ? 'hover:bg-muted/40' : 'cursor-default'}"
              ${clickable ? `data-settle-action="filter-request-status-quick" data-status="${item.status}"` : 'disabled'}
            >
              <p class="text-xs text-muted-foreground">${item.label}</p>
              <p class="mt-1 text-xl font-semibold">${item.value}</p>
            </button>
          `
        })
        .join('')}
    </div>
  `
}


export function renderSettlementListPage(): string {
  const pageBoundary = getSettlementPageBoundary('settlement-master-data')
  syncSettlementRequestState()
  const filteredSummaries = getFilteredSummaries()
  const pagedSummaries = getPagedSummaries(filteredSummaries)
  const filteredRequests = getFilteredRequests()
  const pagedRequests = getPagedRequests(filteredRequests)

  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">结算信息</h1>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(pageBoundary.pageIntro)}</p>
        </div>
        ${
          state.listView === 'effective'
            ? `
              <button class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-settle-action="open-init-factory-picker">
                <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
                新增结算信息
              </button>
            `
            : ''
        }
      </div>

      <div class="inline-flex rounded-md border bg-muted/30 p-1">
        <button class="rounded px-3 py-1.5 text-sm ${state.listView === 'effective' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-settle-action="switch-list-view" data-view="effective">生效信息</button>
        <button class="rounded px-3 py-1.5 text-sm ${state.listView === 'requests' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-settle-action="switch-list-view" data-view="requests">变更申请</button>
      </div>

      ${
        state.listView === 'effective'
          ? `
            <div class="rounded-lg border bg-card p-4">
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <label class="space-y-2">
                  <span class="text-xs text-muted-foreground">工厂名称/编码</span>
                  <div class="relative">
                    <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
                    <input
                      data-settle-filter="search"
                      value="${escapeHtml(state.searchKeyword)}"
                      placeholder="搜索工厂名称或编码"
                      class="w-full rounded-md border py-2 pl-9 pr-3 text-sm"
                    />
                  </div>
                </label>

                <label class="space-y-2">
                  <span class="text-xs text-muted-foreground">结算周期</span>
                  <select data-settle-filter="cycleType" class="w-full rounded-md border px-3 py-2 text-sm">
                    <option value="all" ${state.filterCycleType === 'all' ? 'selected' : ''}>全部周期</option>
                    ${(Object.keys(cycleTypeConfig) as CycleType[])
                      .map(
                        (cycleType) =>
                          `<option value="${cycleType}" ${state.filterCycleType === cycleType ? 'selected' : ''}>${escapeHtml(
                            cycleTypeConfig[cycleType].label,
                          )}</option>`,
                      )
                      .join('')}
                  </select>
                </label>

                <label class="space-y-2">
                  <span class="text-xs text-muted-foreground">状态</span>
                  <select data-settle-filter="status" class="w-full rounded-md border px-3 py-2 text-sm">
                    <option value="all" ${state.filterStatus === 'all' ? 'selected' : ''}>全部状态</option>
                    ${(Object.keys(settlementStatusConfig) as SettlementStatus[])
                      .map(
                        (status) =>
                          `<option value="${status}" ${state.filterStatus === status ? 'selected' : ''}>${escapeHtml(
                            settlementStatusConfig[status].label,
                          )}</option>`,
                      )
                      .join('')}
                  </select>
                </label>

                <div class="space-y-2">
                  <span class="invisible text-xs">操作</span>
                  <button data-settle-action="reset" class="w-full rounded-md border px-3 py-2 text-sm hover:bg-muted">重置</button>
                </div>
              </div>
            </div>

            <div class="overflow-x-auto rounded-md border">
              <table class="w-full text-sm">
                <thead class="border-b bg-muted/30">
                  <tr>
                    <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">工厂名称</th>
                    <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">结算周期</th>
                    <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">计价方式</th>
                    <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">默认币种</th>
                    <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">默认收款账户</th>
                    <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">当前版本号</th>
                    <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">当前生效银行账号</th>
                    <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">状态</th>
                    <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">最近更新</th>
                    <th class="px-3 py-3 text-right text-xs font-medium text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    pagedSummaries.length === 0
                      ? '<tr><td colspan="10" class="h-24 px-3 text-center text-muted-foreground">暂无数据</td></tr>'
                      : pagedSummaries
                          .map((summary) => {
                            const status = settlementStatusConfig[summary.status]
                            const effectiveInfo =
                              state.effectiveInfos.find((item) => item.factoryId === summary.factoryId) ?? null
                            return `
                              <tr class="border-b last:border-0">
                                <td class="px-3 py-3">
                                  <p class="font-medium">${escapeHtml(summary.factoryName)}</p>
                                  <p class="text-xs text-muted-foreground">${escapeHtml(summary.factoryId)}</p>
                                </td>
                                <td class="px-3 py-3">${escapeHtml(cycleTypeConfig[summary.cycleType].label)}</td>
                                <td class="px-3 py-3">${escapeHtml(pricingModeConfig[summary.pricingMode].label)}</td>
                                <td class="px-3 py-3">${escapeHtml(summary.currency)}</td>
                                <td class="px-3 py-3">
                                  ${
                                    summary.hasDefaultAccount
                                      ? `<span class="inline-flex items-center rounded border px-2 py-0.5 text-xs bg-green-50 text-green-700 border-green-200"><i data-lucide="check" class="mr-1 h-3 w-3"></i>已配置</span>`
                                      : `<span class="inline-flex items-center rounded border px-2 py-0.5 text-xs bg-amber-50 text-amber-700 border-amber-200"><i data-lucide="x" class="mr-1 h-3 w-3"></i>未配置</span>`
                                  }
                                </td>
                                <td class="px-3 py-3">${escapeHtml(effectiveInfo?.versionNo || 'V1')}</td>
                                <td class="px-3 py-3">${escapeHtml(effectiveInfo ? maskBankAccountNo(effectiveInfo.bankAccountNo) : '—')}</td>
                                <td class="px-3 py-3">
                                  <span class="inline-flex rounded border px-2 py-0.5 text-xs ${status.color}">${escapeHtml(
                              status.label,
                            )}</span>
                                </td>
                                <td class="px-3 py-3 text-muted-foreground">${escapeHtml(summary.updatedAt)}</td>
                                <td class="px-3 py-3 text-right">
                                  <button class="inline-flex items-center rounded-md px-3 py-1.5 text-sm hover:bg-muted" data-nav="/fcs/factories/settlement/${summary.factoryId}">
                                    <i data-lucide="eye" class="mr-1 h-4 w-4"></i>
                                    详情
                                  </button>
                                </td>
                              </tr>
                            `
                          })
                          .join('')
                  }
                </tbody>
              </table>
            </div>

            <div class="flex items-center justify-between">
              <p class="text-sm text-muted-foreground">共 ${filteredSummaries.length} 条记录</p>
              ${renderPagination(filteredSummaries.length)}
            </div>
          `
          : `
            ${renderRequestStats(state.changeRequests)}

            <div class="rounded-lg border bg-card p-4">
              <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label class="space-y-2">
                  <span class="text-xs text-muted-foreground">申请搜索</span>
                  <div class="relative">
                    <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
                    <input data-settle-request-filter="search" value="${escapeHtml(state.requestSearchKeyword)}" placeholder="申请号/工厂/银行账号" class="w-full rounded-md border py-2 pl-9 pr-3 text-sm" />
                  </div>
                </label>
                <label class="space-y-2">
                  <span class="text-xs text-muted-foreground">申请状态</span>
                  <select data-settle-request-filter="status" class="w-full rounded-md border px-3 py-2 text-sm">
                    <option value="all" ${state.requestFilterStatus === 'all' ? 'selected' : ''}>全部状态</option>
                    <option value="PENDING_REVIEW" ${state.requestFilterStatus === 'PENDING_REVIEW' ? 'selected' : ''}>待审核</option>
                    <option value="APPROVED" ${state.requestFilterStatus === 'APPROVED' ? 'selected' : ''}>已通过</option>
                    <option value="REJECTED" ${state.requestFilterStatus === 'REJECTED' ? 'selected' : ''}>未通过</option>
                  </select>
                </label>
                <div class="space-y-2">
                  <span class="invisible text-xs">操作</span>
                  <button data-settle-action="reset-request-filter" class="w-full rounded-md border px-3 py-2 text-sm hover:bg-muted">重置</button>
                </div>
              </div>
            </div>

            <div class="overflow-x-auto rounded-md border">
              <table class="w-full text-sm">
                <thead class="border-b bg-muted/30">
                  <tr>
                    <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">申请号</th>
                    <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">工厂</th>
                    <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">申请时间</th>
                    <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">当前状态</th>
                    <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">当前版本号</th>
                    <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">目标版本号</th>
                    <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">变更内容</th>
                    <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">生效账号</th>
                    <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">申请新账号</th>
                    <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">签字证明</th>
                    <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">负责人</th>
                    <th class="px-3 py-3 text-right text-xs font-medium text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    pagedRequests.length === 0
                      ? '<tr><td colspan="12" class="h-24 px-3 text-center text-muted-foreground">暂无申请数据</td></tr>'
                      : pagedRequests
                          .map((request) => {
                            const isOpenRequest = request.status === 'PENDING_REVIEW'

                            return `
                            <tr class="border-b last:border-0">
                              <td class="px-3 py-3 font-medium">${escapeHtml(request.requestId)}</td>
                              <td class="px-3 py-3">
                                <p class="font-medium">${escapeHtml(request.factoryName)}</p>
                                <p class="text-xs text-muted-foreground">${escapeHtml(request.factoryId)}</p>
                              </td>
                              <td class="px-3 py-3 text-muted-foreground">${escapeHtml(request.submittedAt)}</td>
                              <td class="px-3 py-3">
                                <span class="inline-flex rounded border px-2 py-0.5 text-xs ${getSettlementStatusClass(request.status)}">${escapeHtml(getSettlementStatusLabel(request.status))}</span>
                              </td>
                              <td class="px-3 py-3">${escapeHtml(request.currentVersionNo)}</td>
                              <td class="px-3 py-3">${escapeHtml(request.targetVersionNo || '待生成')}</td>
                              <td class="px-3 py-3">${escapeHtml(getChangedFieldsSummary(request))}</td>
                              <td class="px-3 py-3">${escapeHtml(maskBankAccountNo(request.before.bankAccountNo))}</td>
                              <td class="px-3 py-3">${escapeHtml(maskBankAccountNo(request.after.bankAccountNo))}</td>
                              <td class="px-3 py-3">
                                ${
                                  request.signedProofFiles.length > 0
                                    ? '<span class="inline-flex rounded border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700">已上传</span>'
                                    : '<span class="inline-flex rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">未上传</span>'
                                }
                              </td>
                              <td class="px-3 py-3 text-muted-foreground">${escapeHtml(request.effectiveBy || '平台运营')}</td>
                              <td class="px-3 py-3 text-right">
                                ${
                                  isOpenRequest
                                    ? `<button class="inline-flex items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted" data-settle-action="print-settlement-change-form" data-request-id="${escapeHtml(request.requestId)}">打印申请单</button>`
                                    : ''
                                }
                                <button class="inline-flex items-center rounded-md px-3 py-1.5 text-sm hover:bg-muted" data-settle-action="open-settlement-request-detail" data-request-id="${escapeHtml(request.requestId)}">处理</button>
                              </td>
                            </tr>
                          `
                          })
                          .join('')
                  }
                </tbody>
              </table>
            </div>

            <div class="flex items-center justify-between">
              <p class="text-sm text-muted-foreground">共 ${filteredRequests.length} 条申请</p>
              ${renderRequestPagination(filteredRequests.length)}
            </div>
          `
      }

      ${renderSettlementRequestDetailDialog()}
      ${renderSettlementRequestPrintDialog()}
      ${renderInitFactoryPickerDialog()}
    </div>
  `
}

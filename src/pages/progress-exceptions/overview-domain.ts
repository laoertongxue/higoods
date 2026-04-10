import {
  state,
  OWNER_OPTIONS,
  REASON_LABEL,
  SEVERITY_COLOR_CLASS,
  CATEGORY_LABEL,
  SUB_CATEGORY_LABEL,
  getFactoryById,
  getProcessTypeByCode,
  getSubCategoryOptions,
  getExceptionCases,
  getExceptionTotalPages,
  getCaseFactoryId,
  getPagedCases,
  getTaskById,
  getUnifiedCategory,
  getSubCategoryKey,
  getSubCategoryLabel,
  getCaseFactoryName,
  getCaseProcessName,
  getRelatedObjects,
  getSpuFromCase,
  hasUpstreamFilter,
  renderBadge,
  renderStatusBadge,
  escapeAttr,
  escapeHtml,
  type ExceptionCase,
  type ReasonCode,
  type UnifiedCategory,
} from './context'
import { getClaimDisputeStatusLabel } from '../../helpers/fcs-claim-dispute'
import { getClaimDisputeByCaseId } from '../../state/fcs-claim-dispute-store'

export function renderActionMenu(exc: ExceptionCase): string {
  const isOpen = state.rowActionMenuCaseId === exc.caseId
  const firstTaskId = exc.relatedTaskIds[0] || ''
  const firstOrderId = exc.relatedOrderIds[0] || ''
  const isPauseReport = exc.sourceType === 'FACTORY_PAUSE_REPORT'
  const unifiedCategory = getUnifiedCategory(exc)

  return `
    <div class="relative inline-flex" data-pe-menu="true">
      <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-pe-action="toggle-row-menu" data-case-id="${escapeAttr(exc.caseId)}" data-pe-stop="true">
        <i data-lucide="more-horizontal" class="h-4 w-4"></i>
      </button>
      ${
        isOpen
              ? `
            <div class="absolute right-0 top-9 z-30 w-52 rounded-md border bg-popover p-1 shadow-lg">
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-pe-action="row-view" data-case-id="${escapeAttr(exc.caseId)}" data-pe-stop="true">
                <i data-lucide="eye" class="mr-2 h-4 w-4"></i>处理
              </button>

              ${
                isPauseReport && exc.caseStatus !== 'CLOSED'
                  ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-pe-action="row-pause-followup" data-case-id="${escapeAttr(exc.caseId)}" data-pe-stop="true"><i data-lucide="message-square" class="mr-2 h-4 w-4"></i>记录跟进</button>`
                  : ''
              }

              ${
                isPauseReport && exc.caseStatus !== 'CLOSED'
                  ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-pe-action="row-pause-continue" data-case-id="${escapeAttr(exc.caseId)}" data-pe-stop="true"><i data-lucide="play" class="mr-2 h-4 w-4"></i>允许继续</button>`
                  : ''
              }

              ${
                !isPauseReport && exc.reasonCode.startsWith('BLOCKED_')
                  ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-pe-action="row-unblock" data-case-id="${escapeAttr(exc.caseId)}" data-pe-stop="true"><i data-lucide="play" class="mr-2 h-4 w-4"></i>恢复执行</button>`
                  : ''
              }

              ${
                ['TENDER_OVERDUE', 'TENDER_NEAR_DEADLINE'].includes(exc.reasonCode) && exc.relatedTenderIds.length > 0
                  ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-pe-action="row-extend" data-case-id="${escapeAttr(exc.caseId)}" data-pe-stop="true"><i data-lucide="clock" class="mr-2 h-4 w-4"></i>延长竞价</button>`
                  : ''
              }

              ${
                ['TENDER_OVERDUE', 'NO_BID', 'DISPATCH_REJECTED', 'ACK_TIMEOUT'].includes(exc.reasonCode)
                  ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-pe-action="row-reassign" data-task-id="${escapeAttr(firstTaskId)}" data-order-id="${escapeAttr(firstOrderId)}" data-pe-stop="true"><i data-lucide="send" class="mr-2 h-4 w-4"></i>重新分配</button>`
                  : ''
              }

              ${
                exc.reasonCode === 'TECH_PACK_NOT_RELEASED'
                  ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-pe-action="row-tech-pack" data-case-id="${escapeAttr(exc.caseId)}" data-pe-stop="true"><i data-lucide="file-text" class="mr-2 h-4 w-4"></i>查看技术资料</button>`
                  : ''
              }

              <div class="my-1 h-px bg-border"></div>
              ${
                unifiedCategory === 'MATERIAL'
                  ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-pe-action="row-material" data-order-id="${escapeAttr(firstOrderId)}" data-pe-stop="true"><i data-lucide="package" class="mr-2 h-4 w-4"></i>查看领料进度</button>`
                  : ''
              }
              ${
                unifiedCategory === 'HANDOUT'
                  ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-pe-action="row-handover" data-order-id="${escapeAttr(firstOrderId)}" data-task-id="${escapeAttr(firstTaskId)}" data-pe-stop="true"><i data-lucide="scan-line" class="mr-2 h-4 w-4"></i>查看交接链路</button>`
                  : ''
              }
              ${
                unifiedCategory === 'HANDOUT'
                  ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-pe-action="row-handover-objection" data-order-id="${escapeAttr(firstOrderId)}" data-task-id="${escapeAttr(firstTaskId)}" data-pe-stop="true"><i data-lucide="alert-circle" class="mr-2 h-4 w-4"></i>查看数量异议</button>`
                  : ''
              }
            </div>
          `
          : ''
      }
    </div>
  `
}

export function renderHeader(): string {
  return `
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold">异常定位与处理</h1>
      </div>
      <div class="flex items-center gap-2">
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="refresh">
          <i data-lucide="refresh-cw" class="mr-1.5 h-4 w-4"></i>刷新
        </button>
        <button class="inline-flex h-8 cursor-not-allowed items-center rounded-md border px-3 text-sm text-muted-foreground" disabled>
          <i data-lucide="download" class="mr-1.5 h-4 w-4"></i>导出
        </button>
      </div>
    </header>
  `
}

export function renderUpstreamHint(): string {
  if (!state.showUpstreamHint || !hasUpstreamFilter()) return ''

  return `
    <section class="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
      <div class="flex flex-wrap items-center gap-2 text-sm text-blue-700">
        <i data-lucide="alert-circle" class="h-4 w-4"></i>
        <span>来自上一步筛选：</span>
        ${state.upstreamTaskId ? renderBadge(`任务: ${state.upstreamTaskId}`, 'border-blue-200 bg-white text-blue-700') : ''}
        ${state.upstreamPo ? renderBadge(`生产单: ${state.upstreamPo}`, 'border-blue-200 bg-white text-blue-700') : ''}
        ${state.upstreamTenderId ? renderBadge(`招标单: ${state.upstreamTenderId}`, 'border-blue-200 bg-white text-blue-700') : ''}
        ${state.upstreamReasonCode ? renderBadge(`原因: ${REASON_LABEL[state.upstreamReasonCode as ReasonCode] || state.upstreamReasonCode}`, 'border-blue-200 bg-white text-blue-700') : ''}
        ${state.upstreamSeverity ? renderBadge(`严重度: ${state.upstreamSeverity}`, 'border-blue-200 bg-white text-blue-700') : ''}
        ${state.upstreamCaseId ? renderBadge(`异常号: ${state.upstreamCaseId}`, 'border-blue-200 bg-white text-blue-700') : ''}
      </div>
      <button class="inline-flex h-8 items-center rounded-md px-2 text-sm text-blue-700 hover:bg-blue-100" data-pe-action="clear-filters">
        <i data-lucide="x" class="mr-1 h-4 w-4"></i>清除筛选
      </button>
    </section>
  `
}

export function renderKpiCards(kpis: { open: number; inProgress: number; s1: number; todayNew: number; todayClosed: number }): string {
  return `
    <section class="grid grid-cols-5 gap-4">
      <button class="rounded-lg border bg-card p-4 text-left hover:border-primary" data-pe-action="kpi-open">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-muted-foreground">待处理</p>
            <p class="text-2xl font-bold text-red-600">${kpis.open}</p>
          </div>
          <i data-lucide="alert-circle" class="h-8 w-8 text-red-200"></i>
        </div>
      </button>

      <button class="rounded-lg border bg-card p-4 text-left hover:border-primary" data-pe-action="kpi-in-progress">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-muted-foreground">处理中</p>
            <p class="text-2xl font-bold text-blue-600">${kpis.inProgress}</p>
          </div>
          <i data-lucide="play" class="h-8 w-8 text-blue-200"></i>
        </div>
      </button>

      <button class="rounded-lg border bg-card p-4 text-left hover:border-primary" data-pe-action="kpi-s1">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-muted-foreground">S1 异常</p>
            <p class="text-2xl font-bold text-red-600">${kpis.s1}</p>
          </div>
          <i data-lucide="alert-triangle" class="h-8 w-8 text-red-200"></i>
        </div>
      </button>

      <article class="rounded-lg border bg-card p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-muted-foreground">今日新增</p>
            <p class="text-2xl font-bold">${kpis.todayNew}</p>
          </div>
          <i data-lucide="plus" class="h-8 w-8 text-slate-200"></i>
        </div>
      </article>

      <article class="rounded-lg border bg-card p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-muted-foreground">今日关闭</p>
            <p class="text-2xl font-bold text-green-600">${kpis.todayClosed}</p>
          </div>
          <i data-lucide="check-circle-2" class="h-8 w-8 text-green-200"></i>
        </div>
      </article>
    </section>
  `
}

export function renderAggregateCards(aggregates: {
  topReasons: Array<[SubCategoryKey, number]>
  topFactories: Array<[string, number]>
  topProcesses: Array<[string, number]>
}): string {
  return `
    <section class="grid grid-cols-3 gap-4">
      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3 text-sm font-medium">异常原因 TOP5</header>
        <div class="space-y-1 px-4 py-3">
          ${
            aggregates.topReasons.length === 0
              ? '<p class="text-sm text-muted-foreground">暂无数据</p>'
              : aggregates.topReasons
                  .map(
                    ([key, count]) => `
                      <button class="flex w-full items-center justify-between rounded px-2 py-1 text-sm hover:bg-muted" data-pe-action="aggregate-reason" data-value="${escapeAttr(key)}">
                        <span class="truncate">${escapeHtml(SUB_CATEGORY_LABEL[key])}</span>
                        ${renderBadge(String(count), 'border-border bg-background text-foreground')}
                      </button>
                    `,
                  )
                  .join('')
          }
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3 text-sm font-medium">异常工厂 TOP5</header>
        <div class="space-y-1 px-4 py-3">
          ${
            aggregates.topFactories.length === 0
              ? '<p class="text-sm text-muted-foreground">暂无数据</p>'
              : aggregates.topFactories
                  .map(
                    ([factoryId, count]) => `
                      <button class="flex w-full items-center justify-between rounded px-2 py-1 text-sm hover:bg-muted" data-pe-action="aggregate-factory" data-value="${escapeAttr(factoryId)}">
                        <span class="truncate">${escapeHtml(getFactoryById(factoryId)?.name || factoryId)}</span>
                        ${renderBadge(String(count), 'border-border bg-background text-foreground')}
                      </button>
                    `,
                  )
                  .join('')
          }
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3 text-sm font-medium">异常工艺 TOP5</header>
        <div class="space-y-1 px-4 py-3">
          ${
            aggregates.topProcesses.length === 0
              ? '<p class="text-sm text-muted-foreground">暂无数据</p>'
              : aggregates.topProcesses
                  .map(
                    ([processCode, count]) => `
                      <button class="flex w-full items-center justify-between rounded px-2 py-1 text-sm hover:bg-muted" data-pe-action="aggregate-process" data-value="${escapeAttr(processCode)}">
                        <span class="truncate">${escapeHtml(getProcessTypeByCode(processCode)?.nameZh || processCode)}</span>
                        ${renderBadge(String(count), 'border-border bg-background text-foreground')}
                      </button>
                    `,
                  )
                  .join('')
          }
        </div>
      </article>
    </section>
  `
}

export function renderCategoryQuickSwitch(): string {
  const options: Array<{ key: 'ALL' | UnifiedCategory; label: string }> = [
    { key: 'ALL', label: '全部' },
    { key: 'ASSIGNMENT', label: '分配异常' },
    { key: 'EXECUTION', label: '执行异常' },
    { key: 'TECH_PACK', label: '技术资料异常' },
    { key: 'MATERIAL', label: '领料异常' },
    { key: 'HANDOUT', label: '交出异常' },
  ]

  return `
    <section class="rounded-lg border bg-card p-3">
      <div class="flex flex-wrap items-center gap-2">
        ${options
          .map((item) => {
            const active = state.categoryFilter === item.key
            return `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm ${active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-pe-action="quick-category" data-category="${item.key}">${item.label}</button>`
          })
          .join('')}
      </div>
    </section>
  `
}

export function getFactoryFilterOptions(): Array<{ id: string; name: string }> {
  const map = new Map<string, string>()
  for (const exc of getExceptionCases()) {
    const factoryId = getCaseFactoryId(exc)
    if (!factoryId) continue
    map.set(factoryId, getFactoryById(factoryId)?.name || factoryId)
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
}

export function getProcessFilterOptions(): Array<{ code: string; name: string }> {
  const map = new Map<string, string>()
  for (const exc of getExceptionCases()) {
    const taskId = exc.relatedTaskIds[0]
    if (!taskId) continue
    const task = getTaskById(taskId)
    if (!task?.processCode) continue
    map.set(task.processCode, getProcessTypeByCode(task.processCode)?.nameZh || task.processNameZh || task.processCode)
  }
  return Array.from(map.entries())
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
}

export function renderFilters(): string {
  const subCategoryOptions = getSubCategoryOptions(state.categoryFilter)
  const factoryOptions = getFactoryFilterOptions()
  const processOptions = getProcessFilterOptions()

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center gap-3">
        <div class="min-w-[220px] flex-1">
          <input
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            placeholder="异常单号 / 生产单 / 任务 / SPU / 概况"
            value="${escapeAttr(state.keyword)}"
            data-pe-field="keyword"
          />
        </div>

        <select class="h-9 w-[120px] rounded-md border bg-background px-3 text-sm" data-pe-field="severityFilter">
          <option value="ALL" ${state.severityFilter === 'ALL' ? 'selected' : ''}>全部严重度</option>
          <option value="S1" ${state.severityFilter === 'S1' ? 'selected' : ''}>S1</option>
          <option value="S2" ${state.severityFilter === 'S2' ? 'selected' : ''}>S2</option>
          <option value="S3" ${state.severityFilter === 'S3' ? 'selected' : ''}>S3</option>
        </select>

        <select class="h-9 w-[130px] rounded-md border bg-background px-3 text-sm" data-pe-field="categoryFilter">
          <option value="ALL" ${state.categoryFilter === 'ALL' ? 'selected' : ''}>全部分类</option>
          <option value="ASSIGNMENT" ${state.categoryFilter === 'ASSIGNMENT' ? 'selected' : ''}>分配异常</option>
          <option value="EXECUTION" ${state.categoryFilter === 'EXECUTION' ? 'selected' : ''}>执行异常</option>
          <option value="TECH_PACK" ${state.categoryFilter === 'TECH_PACK' ? 'selected' : ''}>技术资料异常</option>
          <option value="MATERIAL" ${state.categoryFilter === 'MATERIAL' ? 'selected' : ''}>领料异常</option>
          <option value="HANDOUT" ${state.categoryFilter === 'HANDOUT' ? 'selected' : ''}>交出异常</option>
        </select>

        <select class="h-9 w-[170px] rounded-md border bg-background px-3 text-sm" data-pe-field="subCategoryFilter">
          <option value="ALL" ${state.subCategoryFilter === 'ALL' ? 'selected' : ''}>全部二级分类</option>
          ${subCategoryOptions
            .map((option) => `<option value="${option.key}" ${state.subCategoryFilter === option.key ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
            .join('')}
        </select>

        <select class="h-9 w-[120px] rounded-md border bg-background px-3 text-sm" data-pe-field="statusFilter">
          <option value="ALL" ${state.statusFilter === 'ALL' ? 'selected' : ''}>全部状态</option>
          <option value="OPEN" ${state.statusFilter === 'OPEN' ? 'selected' : ''}>待处理</option>
          <option value="IN_PROGRESS" ${state.statusFilter === 'IN_PROGRESS' ? 'selected' : ''}>处理中</option>
          <option value="RESOLVED" ${state.statusFilter === 'RESOLVED' ? 'selected' : ''}>已解决</option>
          <option value="CLOSED" ${state.statusFilter === 'CLOSED' ? 'selected' : ''}>已关闭</option>
        </select>

        <select class="h-9 w-[120px] rounded-md border bg-background px-3 text-sm" data-pe-field="ownerFilter">
          <option value="ALL" ${state.ownerFilter === 'ALL' ? 'selected' : ''}>全部责任人</option>
          ${OWNER_OPTIONS.map((item) => `<option value="${item.id}" ${state.ownerFilter === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
        </select>

        <select class="h-9 w-[160px] rounded-md border bg-background px-3 text-sm" data-pe-field="factoryFilter">
          <option value="ALL" ${state.factoryFilter === 'ALL' ? 'selected' : ''}>全部工厂</option>
          ${factoryOptions.map((item) => `<option value="${item.id}" ${state.factoryFilter === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
        </select>

        <select class="h-9 w-[140px] rounded-md border bg-background px-3 text-sm" data-pe-field="processFilter">
          <option value="ALL" ${state.processFilter === 'ALL' ? 'selected' : ''}>全部工序</option>
          ${processOptions.map((item) => `<option value="${item.code}" ${state.processFilter === item.code ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
        </select>

        <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="clear-filters">重置</button>
      </div>

      ${
        state.aggregateFilter
          ? `
            <div class="mt-2 flex items-center gap-2">
              <span class="text-sm text-muted-foreground">聚合筛选：</span>
              ${renderBadge(
                state.aggregateFilter.type === 'reason'
                  ? SUB_CATEGORY_LABEL[state.aggregateFilter.value]
                  : state.aggregateFilter.type === 'factory'
                    ? getFactoryById(state.aggregateFilter.value)?.name || state.aggregateFilter.value
                    : getProcessTypeByCode(state.aggregateFilter.value)?.nameZh || state.aggregateFilter.value,
                'border-border bg-background text-foreground',
              )}
              <button class="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-muted" data-pe-action="clear-aggregate"><i data-lucide="x" class="h-3 w-3"></i></button>
            </div>
          `
          : ''
      }
    </section>
  `
}

export function renderTable(cases: ExceptionCase[]): string {
  const emptyText = state.upstreamTaskId
    ? '当前任务暂无异常，可继续在任务页跟进'
    : '暂无数据'
  const pagedCases = getPagedCases(cases)
  const totalPages = getExceptionTotalPages(cases.length)
  const currentPage = state.currentPage

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="mb-2 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>共 ${cases.length} 条</span>
        <span>第 ${currentPage} / ${totalPages} 页</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1760px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-left">
              <th class="w-[130px] px-3 py-2 font-medium">异常号</th>
              <th class="w-[80px] px-3 py-2 font-medium">严重度</th>
              <th class="w-[110px] px-3 py-2 font-medium">状态</th>
              <th class="w-[120px] px-3 py-2 font-medium">一级分类</th>
              <th class="w-[170px] px-3 py-2 font-medium">二级分类</th>
              <th class="px-3 py-2 font-medium">关联对象</th>
              <th class="w-[130px] px-3 py-2 font-medium">工厂</th>
              <th class="w-[120px] px-3 py-2 font-medium">工序</th>
              <th class="w-[110px] px-3 py-2 font-medium">SPU</th>
              <th class="w-[100px] px-3 py-2 font-medium">责任人</th>
              <th class="w-[145px] px-3 py-2 font-medium">最近更新</th>
              <th class="w-[90px] px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              cases.length === 0
                ? `<tr><td colspan="12" class="px-3 py-10 text-center text-muted-foreground">${emptyText}</td></tr>`
                : pagedCases
                    .map((exc) => {
                      const firstOrderId = exc.relatedOrderIds[0] || ''
                      const firstTaskId = exc.relatedTaskIds[0] || ''
                      const unifiedCategory = getUnifiedCategory(exc)
                      const subCategory = getSubCategoryLabel(exc)
                      const relatedObjects = getRelatedObjects(exc)
                      const processName = getCaseProcessName(exc)
                      const linkedFactory = getCaseFactoryName(exc)
                      const claimDispute = exc.sourceModule === 'CUTTING_CLAIM_DISPUTE' ? getClaimDisputeByCaseId(exc.caseId) : null

                      return `
                        <tr class="cursor-pointer border-b hover:bg-muted/50" data-pe-action="open-detail" data-case-id="${escapeAttr(exc.caseId)}">
                          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(exc.caseId)}</td>
                          <td class="px-3 py-2">${renderBadge(exc.severity, SEVERITY_COLOR_CLASS[exc.severity])}</td>
                          <td class="px-3 py-2">${renderStatusBadge(exc.caseStatus)}</td>
                          <td class="px-3 py-2 text-xs">${escapeHtml(CATEGORY_LABEL[unifiedCategory])}</td>
                          <td class="px-3 py-2 text-xs">${escapeHtml(subCategory)}</td>
                          <td class="px-3 py-2">
                            <div class="space-y-1">
                              ${relatedObjects
                                .slice(0, 3)
                                .map((item) => `<div class="text-xs text-muted-foreground">${escapeHtml(item.typeLabel)}：${escapeHtml(item.id)}</div>`)
                                .join('')}
                              ${relatedObjects.length > 3 ? `<div class="text-xs text-muted-foreground">+${relatedObjects.length - 3} 条</div>` : ''}
                              ${
                                claimDispute
                                  ? `
                                    <div class="text-xs text-muted-foreground">原始裁片单：${escapeHtml(claimDispute.originalCutOrderNo)}</div>
                                    <div class="text-xs text-muted-foreground">面料编码：${escapeHtml(claimDispute.materialSku)}</div>
                                    <div class="text-xs text-muted-foreground">配置 / 实领 / 差异：${escapeHtml(`${claimDispute.configuredQty} / ${claimDispute.actualClaimQty} / ${claimDispute.discrepancyQty} 米`)}</div>
                                    <div class="text-xs text-muted-foreground">提交人 / 状态：${escapeHtml(`${claimDispute.submittedBy} / ${getClaimDisputeStatusLabel(claimDispute.status)}`)}</div>
                                  `
                                  : ''
                              }
                            </div>
                          </td>
                          <td class="px-3 py-2 text-xs">${escapeHtml(linkedFactory)}</td>
                          <td class="px-3 py-2 text-xs">${escapeHtml(processName)}</td>
                          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(getSpuFromCase(exc))}</td>
                          <td class="px-3 py-2 text-xs">${escapeHtml(exc.ownerUserName || '-')}</td>
                          <td class="px-3 py-2 text-xs">${escapeHtml(exc.updatedAt.slice(5, 16))}</td>
                          <td class="px-3 py-2 text-right" data-pe-stop="true">
                            <div class="flex items-center justify-end gap-2">
                              <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="open-detail" data-case-id="${escapeAttr(exc.caseId)}" data-pe-stop="true">处理</button>
                              ${renderActionMenu(exc)}
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
      ${
        cases.length > 0 && totalPages > 1
          ? `
            <div class="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <p class="text-xs text-muted-foreground">每页 20 条</p>
              <div class="flex flex-wrap items-center gap-2">
                <button
                  class="inline-flex h-8 items-center rounded-md border px-3 text-sm ${currentPage <= 1 ? 'cursor-not-allowed text-muted-foreground' : 'hover:bg-muted'}"
                  data-pe-action="prev-page"
                  ${currentPage <= 1 ? 'disabled' : ''}
                >
                  上一页
                </button>
                ${Array.from({ length: totalPages }, (_, index) => {
                  const page = index + 1
                  const active = page === currentPage
                  return `
                    <button
                      class="inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm ${active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'}"
                      data-pe-action="goto-page"
                      data-page="${page}"
                    >
                      ${page}
                    </button>
                  `
                }).join('')}
                <button
                  class="inline-flex h-8 items-center rounded-md border px-3 text-sm ${currentPage >= totalPages ? 'cursor-not-allowed text-muted-foreground' : 'hover:bg-muted'}"
                  data-pe-action="next-page"
                  ${currentPage >= totalPages ? 'disabled' : ''}
                >
                  下一页
                </button>
              </div>
            </div>
          `
          : ''
      }
    </section>
  `
}

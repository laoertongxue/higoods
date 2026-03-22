import {
  RETURN_INBOUND_PROCESS_LABEL,
  RETURN_INBOUND_QC_POLICY_LABEL,
  escapeHtml,
  formatDateTime,
  RESULT_LABEL,
  RESULT_CLASS,
  STATUS_LABEL,
  STATUS_CLASS,
  DISPOSITION_LABEL,
  DISPOSITION_CLASS,
  listState,
  toInputValue,
  getFilteredQcRows,
  getFactoryOptions,
  getWarehouseOptions,
  type QcResult,
  type QcDisposition,
  type ReturnInboundQcPolicy,
} from './context'

function renderResultBadge(result: QcResult): string {
  return `<span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${RESULT_CLASS[result]}">${RESULT_LABEL[result]}</span>`
}

function renderDispositionBadge(disposition?: QcDisposition): string {
  if (!disposition) {
    return '<span class="text-muted-foreground">-</span>'
  }
  return `<span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${DISPOSITION_CLASS[disposition]}">${DISPOSITION_LABEL[disposition]}</span>`
}

function renderPolicyBadge(policy: ReturnInboundQcPolicy): string {
  return `<span class="inline-flex rounded-md border px-2 py-0.5 text-xs">${RETURN_INBOUND_QC_POLICY_LABEL[policy]}</span>`
}

export function renderQcRecordsPage(): string {
  const filtered = getFilteredQcRows()
  const factoryOptions = getFactoryOptions()
  const warehouseOptions = getWarehouseOptions()

  return `
    <div class="flex flex-col gap-6 p-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">质检记录</h1>
          <p class="mt-1 text-sm text-muted-foreground">默认展示回货入仓质检，共 ${filtered.length} 条</p>
        </div>
      </div>

      <section class="rounded-md border bg-card p-4">
        <div class="flex flex-wrap items-end gap-3">
          <div class="min-w-[220px] flex-1">
            <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              data-qcr-filter="keyword"
              value="${toInputValue(listState.keyword)}"
              placeholder="质检单号 / 回货批次号 / 生产单号 / 来源任务ID"
            />
          </div>

          <div class="w-36">
            <label class="mb-1 block text-xs text-muted-foreground">回货环节</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="processType">
              <option value="ALL" ${listState.filterProcessType === 'ALL' ? 'selected' : ''}>全部</option>
              ${Object.entries(RETURN_INBOUND_PROCESS_LABEL)
                .map(
                  ([key, label]) =>
                    `<option value="${key}" ${listState.filterProcessType === key ? 'selected' : ''}>${label}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div class="w-32">
            <label class="mb-1 block text-xs text-muted-foreground">质检策略</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="policy">
              <option value="ALL" ${listState.filterPolicy === 'ALL' ? 'selected' : ''}>全部</option>
              ${Object.entries(RETURN_INBOUND_QC_POLICY_LABEL)
                .map(
                  ([key, label]) =>
                    `<option value="${key}" ${listState.filterPolicy === key ? 'selected' : ''}>${label}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div class="w-32">
            <label class="mb-1 block text-xs text-muted-foreground">结果</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="result">
              <option value="ALL" ${listState.filterResult === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="PASS" ${listState.filterResult === 'PASS' ? 'selected' : ''}>合格</option>
              <option value="FAIL" ${listState.filterResult === 'FAIL' ? 'selected' : ''}>不合格</option>
            </select>
          </div>

          <div class="w-36">
            <label class="mb-1 block text-xs text-muted-foreground">状态</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="status">
              <option value="ALL" ${listState.filterStatus === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="DRAFT" ${listState.filterStatus === 'DRAFT' ? 'selected' : ''}>草稿</option>
              <option value="SUBMITTED" ${listState.filterStatus === 'SUBMITTED' ? 'selected' : ''}>已提交</option>
              <option value="CLOSED" ${listState.filterStatus === 'CLOSED' ? 'selected' : ''}>已结案</option>
            </select>
          </div>

          <div class="w-40">
            <label class="mb-1 block text-xs text-muted-foreground">处置方式</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="disposition">
              <option value="ALL" ${listState.filterDisposition === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="ACCEPT_AS_DEFECT" ${listState.filterDisposition === 'ACCEPT_AS_DEFECT' ? 'selected' : ''}>接受瑕疵品</option>
              <option value="SCRAP" ${listState.filterDisposition === 'SCRAP' ? 'selected' : ''}>报废</option>
              <option value="ACCEPT" ${listState.filterDisposition === 'ACCEPT' ? 'selected' : ''}>接受无扣款</option>
            </select>
          </div>

          ${
            factoryOptions.length > 0
              ? `
                <div class="w-40">
                  <label class="mb-1 block text-xs text-muted-foreground">回货工厂</label>
                  <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="factory">
                    <option value="ALL" ${listState.filterFactory === 'ALL' ? 'selected' : ''}>全部</option>
                    ${factoryOptions
                      .map(
                        (item) => `<option value="${escapeHtml(item)}" ${listState.filterFactory === item ? 'selected' : ''}>${escapeHtml(item)}</option>`,
                      )
                      .join('')}
                  </select>
                </div>
              `
              : ''
          }

          ${
            warehouseOptions.length > 0
              ? `
                <div class="w-40">
                  <label class="mb-1 block text-xs text-muted-foreground">入仓仓库</label>
                  <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="warehouse">
                    <option value="ALL" ${listState.filterWarehouse === 'ALL' ? 'selected' : ''}>全部</option>
                    ${warehouseOptions
                      .map(
                        (item) => `<option value="${escapeHtml(item)}" ${listState.filterWarehouse === item ? 'selected' : ''}>${escapeHtml(item)}</option>`,
                      )
                      .join('')}
                  </select>
                </div>
              `
              : ''
          }

          <label class="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
            <input type="checkbox" data-qcr-filter="showLegacy" ${listState.showLegacy ? 'checked' : ''} />
            显示旧质检记录
          </label>

          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-qcr-action="reset-filters">
            <i data-lucide="rotate-ccw" class="mr-1 h-4 w-4"></i>
            重置
          </button>
        </div>
      </section>

      ${
        filtered.length === 0
          ? `
            <section class="rounded-md border bg-card">
              <div class="py-16 text-center text-sm text-muted-foreground">当前筛选下暂无回货入仓质检记录</div>
            </section>
          `
          : `
            <section class="overflow-x-auto rounded-md border bg-card">
              <table class="w-full min-w-[1560px] text-sm">
                <thead>
                  <tr class="border-b bg-muted/40 text-left">
                    <th class="px-4 py-2 font-medium">质检单号</th>
                    <th class="px-4 py-2 font-medium">回货批次号</th>
                    <th class="px-4 py-2 font-medium">生产单号</th>
                    <th class="px-4 py-2 font-medium">回货环节</th>
                    <th class="px-4 py-2 font-medium">回货工厂</th>
                    <th class="px-4 py-2 font-medium">入仓仓库</th>
                    <th class="px-4 py-2 font-medium">质检策略</th>
                    <th class="px-4 py-2 font-medium">结果</th>
                    <th class="px-4 py-2 font-medium">质检状态</th>
                    <th class="px-4 py-2 font-medium">处置方式</th>
                    <th class="px-4 py-2 text-right font-medium">受影响数量</th>
                    <th class="px-4 py-2 font-medium">来源任务</th>
                    <th class="px-4 py-2 font-medium">质检时间</th>
                    <th class="px-4 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered
                    .map((row) => {
                      return `
                        <tr class="cursor-pointer border-b last:border-b-0 hover:bg-muted/50" data-nav="/fcs/quality/qc-records/${escapeHtml(row.qcId)}">
                          <td class="px-4 py-3">
                            <div class="font-mono text-xs font-semibold text-primary">${escapeHtml(row.qcId)}</div>
                            ${row.isLegacy ? '<div class="mt-1 inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">旧质检记录</div>' : ''}
                          </td>
                          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(row.batchId || '-')}</td>
                          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(row.productionOrderId || '-')}</td>
                          <td class="px-4 py-3">${escapeHtml(row.processLabel)}</td>
                          <td class="px-4 py-3">${escapeHtml(row.returnFactoryName || '-')}</td>
                          <td class="px-4 py-3">${escapeHtml(row.warehouseName || '-')}</td>
                          <td class="px-4 py-3">${renderPolicyBadge(row.qcPolicy)}</td>
                          <td class="px-4 py-3">${renderResultBadge(row.result)}</td>
                          <td class="px-4 py-3"><span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${STATUS_CLASS[row.status]}">${STATUS_LABEL[row.status]}</span></td>
                          <td class="px-4 py-3">${renderDispositionBadge(row.disposition as QcDisposition | undefined)}</td>
                          <td class="px-4 py-3 text-right">${row.affectedQty ?? '-'}</td>
                          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(row.sourceTaskId || '-')}</td>
                          <td class="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">${escapeHtml(formatDateTime(row.inspectedAt || row.qc.updatedAt))}</td>
                          <td class="px-4 py-3">
                            <button class="inline-flex h-8 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/quality/qc-records/${escapeHtml(row.qcId)}">
                              查看
                              <i data-lucide="chevron-right" class="ml-1 h-3.5 w-3.5"></i>
                            </button>
                          </td>
                        </tr>
                      `
                    })
                    .join('')}
                </tbody>
              </table>
            </section>
          `
      }
    </div>
  `
}

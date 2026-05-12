import {
  buildPostFinishingQcDeductionRecord,
  listPostFinishingQcOrders,
  listPostFinishingSourceStyleOptions,
  listPostFinishingSourceTaskOptions,
  listPostFinishingWaitQcItems,
  type PostFinishingActionRecord,
  type PostFinishingSkuLine,
  type PostFinishingWaitQcItem,
} from '../../../data/fcs/post-finishing-domain.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatGarmentQty,
  getPostListFilters,
  paginatePostRows,
  postFilterTextMatches,
  renderPostAction,
  renderPostFilterPanel,
  renderPostPagination,
  renderPostSection,
  renderPostStatusBadge,
  renderPostTable,
} from './shared.ts'

function currentPath(): string {
  return typeof window === 'undefined' ? '/fcs/craft/post-finishing/qc-orders' : window.location.pathname
}

function currentParams(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function linkWith(overrides: Record<string, string | undefined>): string {
  const params = currentParams()
  Object.entries(overrides).forEach(([key, value]) => {
    if (!value) params.delete(key)
    else params.set(key, value)
  })
  const query = params.toString()
  return `${currentPath()}${query ? `?${query}` : ''}`
}

function closeDialogLink(): string {
  return linkWith({ createQc: undefined, completeQc: undefined, viewQc: undefined })
}

function isCreateDialogOpen(): boolean {
  return currentParams().get('createQc') === '1'
}

function getCompleteId(): string {
  return currentParams().get('completeQc') || ''
}

function getViewId(): string {
  return currentParams().get('viewQc') || ''
}

function renderPageHeader(): string {
  return `
    <header class="rounded-2xl border bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl font-semibold text-foreground">质检单</h1>
        <button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-nav="${escapeHtml(linkWith({ createQc: '1', completeQc: undefined, viewQc: undefined }))}">创建质检单</button>
      </div>
    </header>
  `
}

function renderModal(title: string, body: string): string {
  const closeHref = escapeHtml(closeDialogLink())
  return `
    <div class="fixed inset-0 z-[120]">
      <button class="absolute inset-0 bg-black/45" data-nav="${closeHref}" aria-label="关闭弹窗"></button>
      <section class="absolute left-1/2 top-1/2 max-h-[88vh] w-[min(1080px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-white shadow-2xl">
        <div class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white px-5 py-4">
          <h2 class="text-lg font-semibold text-foreground">${escapeHtml(title)}</h2>
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50" data-nav="${closeHref}">关闭</button>
        </div>
        <div class="p-5">${body}</div>
      </section>
    </div>
  `
}

function renderSkuRows(lines: PostFinishingSkuLine[], readonly = false): string {
  return lines.map((line) => `
    <tr>
      <td class="px-3 py-2"><input type="checkbox" ${readonly ? 'disabled' : ''} checked /></td>
      <td class="px-3 py-2 font-medium">${escapeHtml(line.skuCode)}</td>
      <td class="px-3 py-2">${escapeHtml(line.colorName)}</td>
      <td class="px-3 py-2">${escapeHtml(line.sizeName)}</td>
      <td class="px-3 py-2"><input class="h-8 w-28 rounded-md border px-2 text-sm disabled:bg-slate-100" value="${line.plannedQty}" ${readonly ? 'disabled' : ''} /></td>
    </tr>
  `).join('')
}

function renderCreateQcDialog(): string {
  if (!isCreateDialogOpen()) return ''
  const styles = listPostFinishingSourceStyleOptions()
  const first = styles[0]
  const tasks = listPostFinishingSourceTaskOptions(first?.styleId)
  return renderModal('创建质检单', `
    <div class="space-y-4">
      <div class="grid gap-4 lg:grid-cols-3">
        <label class="space-y-1 text-sm">
          <span class="text-xs text-muted-foreground">款式衣服</span>
          <select class="h-10 w-full rounded-md border px-3 text-sm">
            ${styles.map((item) => `<option value="${escapeHtml(item.styleId)}">${escapeHtml(item.spuCode)} / ${escapeHtml(item.spuName)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-sm">
          <span class="text-xs text-muted-foreground">关联生产单 / 工厂 / 任务</span>
          <select class="h-10 w-full rounded-md border px-3 text-sm">
            <option value="">不关联来源任务，直接选择 SKU</option>
            ${tasks.map((item) => `<option value="${escapeHtml(item.sourceTaskId || '')}">${escapeHtml(item.productionOrderNo)} / ${escapeHtml(item.sourceFactoryName || '未关联工厂')} / ${escapeHtml(item.sourceTaskNo || '未关联任务')}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-sm">
          <span class="text-xs text-muted-foreground">质检台</span>
          <select class="h-10 w-full rounded-md border px-3 text-sm">
            <option>后道质检台 A</option>
            <option>后道质检台 B</option>
            <option>后道质检台 C</option>
          </select>
        </label>
      </div>
      <div class="overflow-x-auto rounded-xl border">
        <table class="min-w-[720px] w-full text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground"><tr><th class="px-3 py-2 text-left">选择</th><th class="px-3 py-2 text-left">SKU</th><th class="px-3 py-2 text-left">颜色</th><th class="px-3 py-2 text-left">尺码</th><th class="px-3 py-2 text-left">质检数量</th></tr></thead>
          <tbody>${first ? renderSkuRows(first.skuLines) : '<tr><td colspan="5" class="px-3 py-6 text-center text-muted-foreground">暂无可选 SKU</td></tr>'}</tbody>
        </table>
      </div>
      <div class="flex justify-end gap-2">
        <button class="rounded-md border px-3 py-2 text-sm">保存草稿</button>
        <button class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white">创建质检单</button>
      </div>
    </div>
  `)
}

function normalizeResult(value?: string): '全数合规' | '部分不合格' | '全数不合格' {
  if (value === '全数合格' || value === '全数合规') return '全数合规'
  if (value === '全数不合格') return '全数不合格'
  return '部分不合格'
}

function renderSelect(label: string, options: string[], selected = '', attrs = ''): string {
  return `
    <label class="space-y-1 text-sm">
      <span class="text-xs text-muted-foreground">${escapeHtml(label)}</span>
      <select class="h-10 w-full rounded-md border px-3 text-sm disabled:bg-slate-100 disabled:text-slate-400" ${attrs}>
        ${options.map((option) => `<option ${option === selected ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
      </select>
    </label>
  `
}

function renderInput(label: string, value = '', attrs = ''): string {
  return `
    <label class="space-y-1 text-sm">
      <span class="text-xs text-muted-foreground">${escapeHtml(label)}</span>
      <input class="h-10 w-full rounded-md border px-3 text-sm disabled:bg-slate-100 disabled:text-slate-400" value="${escapeHtml(value)}" ${attrs} />
    </label>
  `
}

function renderTextarea(label: string, value = '', attrs = ''): string {
  return `
    <label class="space-y-1 text-sm lg:col-span-2">
      <span class="text-xs text-muted-foreground">${escapeHtml(label)}</span>
      <textarea class="min-h-20 w-full rounded-md border px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400" ${attrs}>${escapeHtml(value)}</textarea>
    </label>
  `
}

function renderPostNeeds(record: PostFinishingActionRecord, readonly = false): string {
  const disabled = readonly ? 'disabled' : ''
  return `
    <div class="grid gap-3 md:grid-cols-4">
      ${[
        ['开扣眼', record.needButtonhole],
        ['装扣子', record.needButton],
        ['熨烫', record.needIroning],
        ['包装', record.needPackaging],
      ].map(([label, checked]) => `
        <label class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <input type="checkbox" ${checked ? 'checked' : ''} ${disabled} />
          <span>${escapeHtml(String(label))}</span>
        </label>
      `).join('')}
    </div>
  `
}

function renderCompleteQcDialog(): string {
  const recordId = getCompleteId()
  if (!recordId) return ''
  const record = listPostFinishingQcOrders().find((item) => item.actionRecordId === recordId)
  if (!record) return renderModal('完成质检', '<div class="text-sm text-muted-foreground">未找到质检单</div>')
  const result = normalizeResult(record.qcResult)
  const isAllGood = result === '全数合规'
  const disabled = isAllGood ? 'disabled data-qc-defect-field="1"' : 'data-qc-defect-field="1"'
  return renderModal('完成质检', `
    <div class="space-y-5">
      <div class="grid gap-3 lg:grid-cols-3">
        ${renderInput('质检单号', record.actionRecordNo, 'disabled')}
        ${renderSelect('质检台', ['后道质检台 A', '后道质检台 B', '后道质检台 C'], record.qcStationName || '后道质检台 A')}
        ${renderInput('质检数量', String(record.inspectedGarmentQty ?? record.submittedGarmentQty), 'disabled')}
        ${renderSelect('质检结果', ['全数合规', '部分不合格', '全数不合格'], result, 'data-qc-result-select="1"')}
        ${renderInput('合格数量', String(record.passedGarmentQty ?? record.acceptedGarmentQty))}
        ${renderInput('不合格数量', String(record.defectiveGarmentQty ?? record.rejectedGarmentQty), disabled)}
      </div>
      <section class="space-y-3 rounded-xl border p-4" data-qc-defect-section>
        <h3 class="text-sm font-semibold text-foreground">数量与处理</h3>
        <div class="grid gap-3 lg:grid-cols-3">
          ${renderSelect('不合格品处置方式', ['', '返修', '让步接收', '报废', '退回上游'], record.unqualifiedDisposition || '', disabled)}
          ${renderSelect('根因类型', ['', '工厂加工问题', '来料问题', '技术资料问题', '平台判定'], record.rootCauseType || '', disabled)}
          ${renderTextarea('不合格原因说明', record.unqualifiedReasonSummary || '', disabled)}
        </div>
      </section>
      <section class="space-y-3 rounded-xl border p-4" data-qc-liability-section>
        <h3 class="text-sm font-semibold text-foreground">责任与扣款依据</h3>
        <div class="grid gap-3 lg:grid-cols-3">
          ${renderSelect('责任方', ['', '工厂', '平台', '供应商', '无责任'], record.responsiblePartyType || '', disabled)}
          ${renderInput('责任对象', record.responsiblePartyName || '', disabled)}
          ${renderSelect('扣款决策', ['', '暂不扣款', '建议扣款', '确认扣款'], record.deductionDecision || '', disabled)}
          ${renderTextarea('扣款说明', record.deductionDecisionRemark || '', disabled)}
        </div>
      </section>
      <section class="space-y-3 rounded-xl border p-4">
        <h3 class="text-sm font-semibold text-foreground">后道项目判断</h3>
        ${renderPostNeeds(record)}
      </section>
      <div class="flex justify-end gap-2">
        <button class="rounded-md border px-3 py-2 text-sm" data-nav="${escapeHtml(closeDialogLink())}">取消</button>
        <button class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white">确认完成质检</button>
      </div>
    </div>
    <script>
      (function(){
        var select = document.querySelector('[data-qc-result-select]');
        if (!select) return;
        function sync(){
          var allGood = select.value === '全数合规';
          document.querySelectorAll('[data-qc-defect-field]').forEach(function(el){ el.disabled = allGood; if (allGood && el.tagName !== 'TEXTAREA') el.value = ''; });
          document.querySelectorAll('[data-qc-defect-section], [data-qc-liability-section]').forEach(function(el){ el.classList.toggle('opacity-50', allGood); });
        }
        select.addEventListener('change', sync);
        sync();
      })();
    </script>
  `)
}

function renderReadonlyField(label: string, value: string): string {
  return `<div class="rounded-lg border bg-slate-50 px-3 py-2"><div class="text-xs text-muted-foreground">${escapeHtml(label)}</div><div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(value || '—')}</div></div>`
}

function renderPrintButton(record: PostFinishingActionRecord): string {
  const snapshot = buildPostFinishingQcDeductionRecord(record)
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(record.actionRecordNo)} 纸质质检单</title><style>body{font-family:Arial,'Microsoft YaHei',sans-serif;margin:24px;color:#111827}h1{font-size:22px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.box{border:1px solid #d1d5db;border-radius:8px;padding:10px}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #d1d5db;padding:8px;text-align:left}th{background:#f3f4f6}@media print{button{display:none}}</style></head><body><button onclick="window.print()">打印</button><h1>纸质质检单</h1><div class="grid"><div class="box">质检单号<br/><strong>${escapeHtml(record.actionRecordNo)}</strong></div><div class="box">质检台<br/><strong>${escapeHtml(record.qcStationName || '—')}</strong></div><div class="box">质检人<br/><strong>${escapeHtml(record.operatorName || '—')}</strong></div></div><table><thead><tr><th>质检数量</th><th>合格数量</th><th>不合格数量</th><th>质检结果</th><th>责任方</th><th>扣款决策</th></tr></thead><tbody><tr><td>${record.inspectedGarmentQty ?? record.submittedGarmentQty}</td><td>${record.passedGarmentQty ?? record.acceptedGarmentQty}</td><td>${record.defectiveGarmentQty ?? record.rejectedGarmentQty}</td><td>${escapeHtml(normalizeResult(record.qcResult))}</td><td>${escapeHtml(snapshot?.responsiblePartyName || '—')}</td><td>${escapeHtml(snapshot?.deductionDecision || '—')}</td></tr></tbody></table></body></html>`
  const script = `var w=window.open('', '_blank', 'noopener,noreferrer'); if(w){w.document.write(${JSON.stringify(html)});w.document.close();} window.__lastQcPrint='${escapeHtml(record.actionRecordNo)}';`
  return `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" onclick="${escapeHtml(script)}">打印纸质质检单</button>`
}

function renderViewDialog(): string {
  const recordId = getViewId()
  if (!recordId) return ''
  const record = listPostFinishingQcOrders().find((item) => item.actionRecordId === recordId)
  if (!record) return renderModal('质检单详情', '<div class="text-sm text-muted-foreground">未找到质检单</div>')
  const snapshot = buildPostFinishingQcDeductionRecord(record)
  return renderModal('质检单详情', `
    <div class="space-y-5">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        ${renderReadonlyField('质检单号', record.actionRecordNo)}
        ${renderReadonlyField('质检台', record.qcStationName || '—')}
        ${renderReadonlyField('质检状态', record.status)}
        ${renderReadonlyField('质检数量', formatGarmentQty(record.inspectedGarmentQty ?? record.submittedGarmentQty, record.qtyUnit))}
        ${renderReadonlyField('合格数量', formatGarmentQty(record.passedGarmentQty ?? record.acceptedGarmentQty, record.qtyUnit))}
        ${renderReadonlyField('不合格数量', formatGarmentQty(record.defectiveGarmentQty ?? record.rejectedGarmentQty, record.qtyUnit))}
        ${renderReadonlyField('质检结果', normalizeResult(record.qcResult))}
        ${renderReadonlyField('责任方', snapshot?.responsiblePartyName || '—')}
        ${renderReadonlyField('扣款决策', snapshot?.deductionDecision || '—')}
      </div>
      <div class="rounded-xl border p-4">
        <div class="mb-3 text-sm font-semibold">后道项目判断</div>
        ${renderPostNeeds(record, true)}
      </div>
      <div class="flex justify-end">${renderPrintButton(record)}</div>
    </div>
  `)
}

function renderWaitRows(rows: PostFinishingWaitQcItem[]): string {
  return rows.map((item) => `
    <tr class="align-top">
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(item.waitQcId)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(item.productionOrderNo)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(item.sourceFactoryName)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(item.sourceTaskNo)}</td>
      <td class="px-3 py-3 text-sm"><div class="font-semibold">${escapeHtml(item.spuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(item.spuName)}</div></td>
      <td class="px-3 py-3 text-sm">${escapeHtml(item.skuSummary)}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(item.waitQcQty, item.qtyUnit)}</td>
      <td class="px-3 py-3">${renderPostStatusBadge(item.status)}</td>
      <td class="px-3 py-3"><div class="flex flex-wrap gap-2">${item.status === '待创建质检单' ? renderPostAction('创建质检单', linkWith({ createQc: '1' })) : renderPostAction('查看质检单', linkWith({ viewQc: item.createdQcOrderId }))}</div></td>
    </tr>
  `).join('')
}

function renderQcRows(rows: PostFinishingActionRecord[]): string {
  return rows.map((record) => {
    const snapshot = buildPostFinishingQcDeductionRecord(record)
    const canFinish = !record.status.includes('完成')
    return `
      <tr class="align-top">
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.actionRecordNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.postOrderNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(snapshot?.productionOrderNo || '—')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceFactoryName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.qcStationName || '—')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.skuLines[0]?.spuCode || '—')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.skuLines.map((line) => `${line.skuCode}/${line.colorName}/${line.sizeName}`).join('、'))}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(record.inspectedGarmentQty ?? record.submittedGarmentQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(record.passedGarmentQty ?? record.acceptedGarmentQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(record.defectiveGarmentQty ?? record.rejectedGarmentQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(normalizeResult(record.qcResult))}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(snapshot?.responsiblePartyName || '—')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(snapshot?.deductionDecision || '—')}</td>
        <td class="px-3 py-3">${renderPostStatusBadge(record.status)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.operatorName || '—')}</td>
        <td class="px-3 py-3"><div class="flex flex-wrap gap-2">${canFinish ? renderPostAction('完成质检', linkWith({ completeQc: record.actionRecordId, viewQc: undefined, createQc: undefined })) : ''}${renderPostAction('查看质检单', linkWith({ viewQc: record.actionRecordId, completeQc: undefined, createQc: undefined }))}${renderPrintButton(record)}</div></td>
      </tr>
    `
  }).join('')
}

function filterQc(records: PostFinishingActionRecord[], filters: ReturnType<typeof getPostListFilters>): PostFinishingActionRecord[] {
  return records.filter((record) => {
    if (filters.status !== '全部' && record.status !== filters.status) return false
    if (filters.factory !== '全部' && record.targetFactoryName !== filters.factory) return false
    return postFilterTextMatches(filters.keyword, [record.actionRecordNo, record.postOrderNo, record.sourceFactoryName, record.targetFactoryName, record.qcStationName, record.skuLines[0]?.spuCode, record.skuLines[0]?.spuName, record.status])
  })
}

export function renderPostFinishingQcOrdersPage(): string {
  const filters = getPostListFilters()
  const waitItems = listPostFinishingWaitQcItems()
  const allQc = listPostFinishingQcOrders()
  const filteredQc = filterQc(allQc, filters)
  const pagination = paginatePostRows(filteredQc, filters)
  const waitRows = renderWaitRows(waitItems)
  const qcRows = renderQcRows(pagination.rows)
  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader()}
      ${renderPostFilterPanel({
        filters,
        statusOptions: allQc.map((item) => item.status),
        sourceOptions: ['待质检', '质检单'],
        factoryOptions: allQc.map((item) => item.targetFactoryName),
        keywordPlaceholder: '质检单 / 后道单 / 生产单 / 质检台 / SKU',
      })}
      ${renderPostSection('待质检列表', renderPostTable(
        ['待质检编号', '生产单', '来源工厂', '来源任务', '款式衣服', 'SKU 明细', '待质检数量', '状态', '操作'],
        waitRows || '<tr><td colspan="9" class="px-3 py-8 text-center text-sm text-muted-foreground">暂无待质检数据</td></tr>',
        'min-w-[1280px]',
      ))}
      ${renderPostSection('质检单列表', `${renderPostTable(
        ['质检单号', '后道单号', '生产单', '来源工厂', '质检台', '款式衣服', 'SKU 明细', '质检数量', '合格数量', '不合格数量', '质检结果', '责任方', '扣款决策', '状态', '质检人', '操作'],
        qcRows || '<tr><td colspan="16" class="px-3 py-8 text-center text-sm text-muted-foreground">暂无质检单</td></tr>',
        'min-w-[1800px]',
      )}<div class="mt-4">${renderPostPagination(pagination)}</div>`)}
      ${renderCreateQcDialog()}
      ${renderCompleteQcDialog()}
      ${renderViewDialog()}
    </div>
  `
}

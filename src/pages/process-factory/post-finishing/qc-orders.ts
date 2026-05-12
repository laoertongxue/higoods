import {
  buildPostFinishingQcDeductionRecord,
  completePostFinishingQcOrder,
  createPostFinishingQcOrder,
  listPostFinishingQcOrders,
  listPostFinishingWaitQcSkuItems,
  type PostFinishingActionRecord,
  type PostFinishingWaitQcSkuItem,
} from '../../../data/fcs/post-finishing-domain.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatGarmentQty,
  getPostListFilters,
  paginatePostRows,
  postFilterTextMatches,
  renderPostAction,
  renderPostFilterPanel,
  renderPostFinishingPageHeader,
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

function navigateInPrototype(url: string): void {
  appStore.navigate(url)
}

function isCreateDialogOpen(): boolean {
  return Boolean(currentParams().get('createQc'))
}

function getCompleteId(): string {
  return currentParams().get('completeQc') || ''
}

function getViewId(): string {
  return currentParams().get('viewQc') || ''
}

type QcTabKey = 'wait' | 'qc'

function getActiveQcTab(): QcTabKey {
  return currentParams().get('tab') === 'qc' ? 'qc' : 'wait'
}

function renderQcTabs(activeTab: QcTabKey, waitCount: number, qcCount: number): string {
  const tabs: Array<{ key: QcTabKey; label: string; count: number }> = [
    { key: 'wait', label: '待质检列表', count: waitCount },
    { key: 'qc', label: '质检单列表', count: qcCount },
  ]
  return `
    <nav class="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1">
      ${tabs.map((tab) => `
        <button
          type="button"
          class="rounded px-3 py-1.5 text-sm ${tab.key === activeTab ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}"
          data-nav="${escapeHtml(linkWith({ tab: tab.key, page: '1', createQc: undefined, completeQc: undefined, viewQc: undefined }))}"
        >${escapeHtml(tab.label)} <span class="ml-1 text-xs">${tab.count}</span></button>
      `).join('')}
    </nav>
  `
}

function registerQcPageActions(): void {
  if (typeof window === 'undefined') return
  const win = window as Window & {
    __postCreateQcOrder?: () => void
    __postCompleteQcOrder?: (qcOrderId: string) => void
    __syncQcCompleteForm?: (select: HTMLSelectElement) => void
  }
  win.__postCreateQcOrder = () => {
    const station = (document.querySelector('[data-qc-create-station]') as HTMLSelectElement | null)?.value || '后道质检台 A'
    const allocations = Array.from(document.querySelectorAll<HTMLElement>('[data-qc-source-row]'))
      .filter((row) => (row.querySelector('[data-qc-source-check]') as HTMLInputElement | null)?.checked)
      .map((row) => ({
        warehouseRecordId: row.dataset.warehouseRecordId || '',
        qcQty: Number((row.querySelector('[data-qc-source-qty]') as HTMLInputElement | null)?.value || 0),
      }))
      .filter((item) => item.warehouseRecordId && item.qcQty > 0)
    if (!allocations.length) {
      window.alert('请至少选择一个待质检 SKU，并填写质检数量。')
      return
    }
    try {
      const created = createPostFinishingQcOrder({ allocations, qcStationName: station, inspectorName: '后道质检员' })
      navigateInPrototype(`/fcs/craft/post-finishing/qc-orders?viewQc=${encodeURIComponent(created.qcOrderId)}`)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '创建质检单失败。')
    }
  }
  win.__postCompleteQcOrder = (qcOrderId: string) => {
    const valueOf = (selector: string) => (document.querySelector(selector) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null)?.value || ''
    const checked = (selector: string) => Boolean((document.querySelector(selector) as HTMLInputElement | null)?.checked)
    const result = normalizeResult(valueOf('[data-qc-result-select]'))
    const completed = completePostFinishingQcOrder({
      qcOrderId,
      qcStationName: valueOf('[data-qc-complete-station]') || '后道质检台 A',
      inspectorName: '后道质检员',
      inspectedGarmentQty: Number(valueOf('[data-qc-inspected-qty]') || 0),
      passedGarmentQty: Number(valueOf('[data-qc-passed-qty]') || 0),
      defectiveGarmentQty: result === '全数合规' ? 0 : Number(valueOf('[data-qc-defective-qty]') || 0),
      qcResult: result,
      unqualifiedDisposition: result === '全数合规' ? '' : valueOf('[data-qc-disposition]') as any,
      unqualifiedReasonSummary: result === '全数合规' ? '' : valueOf('[data-qc-reason]'),
      rootCauseType: result === '全数合规' ? '' : valueOf('[data-qc-root-cause]') as any,
      responsiblePartyType: result === '全数合规' ? '' : valueOf('[data-qc-responsible-party]') as any,
      responsiblePartyName: result === '全数合规' ? '' : valueOf('[data-qc-responsible-name]'),
      deductionDecision: result === '全数合规' ? '' : valueOf('[data-qc-deduction-decision]') as any,
      deductionDecisionRemark: result === '全数合规' ? '' : valueOf('[data-qc-deduction-remark]'),
      needButtonhole: checked('[data-post-need-buttonhole]'),
      needButton: checked('[data-post-need-button]'),
      needIroning: checked('[data-post-need-ironing]'),
      needPackaging: checked('[data-post-need-packaging]'),
    })
    if (completed.generatedPostOrderId) {
      navigateInPrototype(`/fcs/craft/post-finishing/work-orders?keyword=${encodeURIComponent(completed.generatedPostOrderId)}`)
      return
    }
    if (completed.generatedRecheckOrderId) {
      navigateInPrototype(`/fcs/craft/post-finishing/recheck-orders?keyword=${encodeURIComponent(completed.generatedRecheckOrderId)}`)
      return
    }
    navigateInPrototype('/fcs/craft/post-finishing/qc-orders?status=质检完成')
  }
  win.__syncQcCompleteForm = (select: HTMLSelectElement) => {
    const allGood = select.value === '全数合规'
    document.querySelectorAll<HTMLElement>('[data-qc-defect-section], [data-qc-liability-section]').forEach((section) => {
      section.hidden = allGood
    })
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-qc-defect-field]').forEach((field) => {
      field.disabled = allGood
      if (allGood) field.value = ''
    })
  }
}

function renderPageHeader(): string {
  return renderPostFinishingPageHeader(
    '质检单',
    '',
    `<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-nav="${escapeHtml(linkWith({ createQc: '1', completeQc: undefined, viewQc: undefined }))}">创建质检单</button>`,
  )
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

function renderCreateQcDialog(): string {
  if (!isCreateDialogOpen()) return ''
  const waitItems = listPostFinishingWaitQcSkuItems().filter((item) => item.waitQcQty > 0)
  const selectedKey = currentParams().get('createQc') || ''
  const rows = waitItems.map((item) => {
    const checked = item.waitQcSkuKey === selectedKey || item.warehouseRecordId === selectedKey
    const locationLabel = item.locationCode ? `${item.areaName || '未分区'} / ${item.locationCode}` : item.areaName || '未分区'
    return `
      <tr data-qc-source-row data-warehouse-record-id="${escapeHtml(item.warehouseRecordId)}" class="align-top ${checked ? 'bg-blue-50/60' : ''}">
        <td class="px-3 py-3"><input type="checkbox" data-qc-source-check ${checked ? 'checked' : ''} /></td>
        <td class="px-3 py-3 text-sm"><div class="font-semibold">${escapeHtml(item.skuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(item.colorName)} / ${escapeHtml(item.sizeName)}</div></td>
        <td class="px-3 py-3 text-sm"><div>${escapeHtml(item.productionOrderNo)}</div><div class="text-xs text-muted-foreground">${escapeHtml(item.sourceTaskNo)}</div></td>
        <td class="px-3 py-3 text-sm">${escapeHtml(item.sourceFactoryName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(locationLabel)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(item.currentStockQty, item.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(item.waitQcQty, item.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(item.qcInProgressQty, item.qtyUnit)}</td>
        <td class="px-3 py-3"><input class="h-9 w-28 rounded-md border px-2 text-sm" data-qc-source-qty type="number" min="1" max="${item.waitQcQty}" value="${item.waitQcQty}" /></td>
      </tr>
    `
  }).join('')
  return renderModal('创建质检单', `
    <div class="space-y-4">
      <div class="grid gap-4 lg:grid-cols-2">
        <label class="space-y-1 text-sm">
          <span class="text-xs text-muted-foreground">质检台</span>
          <select class="h-10 w-full rounded-md border px-3 text-sm" data-qc-create-station>
            <option>后道质检台 A</option>
            <option>后道质检台 B</option>
            <option>后道质检台 C</option>
          </select>
        </label>
        <div class="rounded-lg border bg-slate-50 px-3 py-2 text-sm">
          <div class="text-xs text-muted-foreground">创建范围</div>
          <div class="mt-1 font-medium text-foreground">同一张质检单只能选择同一生产单下的同一款式 SKU</div>
        </div>
      </div>
      <div class="overflow-x-auto rounded-xl border">
        <table class="min-w-[1180px] w-full text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground"><tr><th class="px-3 py-2 text-left">选择</th><th class="px-3 py-2 text-left">SKU</th><th class="px-3 py-2 text-left">生产单 / 上游任务</th><th class="px-3 py-2 text-left">上游工厂</th><th class="px-3 py-2 text-left">取货库区 / 库位</th><th class="px-3 py-2 text-left">当前库存</th><th class="px-3 py-2 text-left">待质检数量</th><th class="px-3 py-2 text-left">质检中数量</th><th class="px-3 py-2 text-left">本次质检数量</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="9" class="px-3 py-8 text-center text-sm text-muted-foreground">暂无可创建质检单的库存 SKU</td></tr>'}</tbody>
        </table>
      </div>
      <div class="flex justify-end gap-2">
        <button class="rounded-md border px-3 py-2 text-sm">保存草稿</button>
        <button class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" ${rows ? 'onclick="window.__postCreateQcOrder()"' : 'disabled'}>创建质检单</button>
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
  const needAttrs: Record<string, string> = {
    开扣眼: 'data-post-need-buttonhole',
    装扣子: 'data-post-need-button',
    熨烫: 'data-post-need-ironing',
    包装: 'data-post-need-packaging',
  }
  return `
    <div class="grid gap-3 md:grid-cols-4">
      ${[
        ['开扣眼', record.needButtonhole],
        ['装扣子', record.needButton],
        ['熨烫', record.needIroning],
        ['包装', record.needPackaging],
      ].map(([label, checked]) => `
        <label class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <input type="checkbox" ${checked ? 'checked' : ''} ${disabled} ${needAttrs[String(label)] || ''} />
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
        ${renderSelect('质检台', ['后道质检台 A', '后道质检台 B', '后道质检台 C'], record.qcStationName || '后道质检台 A', 'data-qc-complete-station')}
        ${renderInput('质检数量', String(record.inspectedGarmentQty ?? record.submittedGarmentQty), 'disabled data-qc-inspected-qty')}
        ${renderSelect('质检结果', ['全数合规', '部分不合格', '全数不合格'], result, 'data-qc-result-select="1" onchange="window.__syncQcCompleteForm(this)"')}
        ${renderInput('合格数量', String(record.passedGarmentQty ?? record.acceptedGarmentQty), 'data-qc-passed-qty')}
        ${renderInput('不合格数量', String(record.defectiveGarmentQty ?? record.rejectedGarmentQty), `${disabled} data-qc-defective-qty`)}
      </div>
      <section class="space-y-3 rounded-xl border p-4" data-qc-defect-section ${isAllGood ? 'hidden' : ''}>
        <h3 class="text-sm font-semibold text-foreground">数量与处理</h3>
        <div class="grid gap-3 lg:grid-cols-3">
          ${renderSelect('不合格品处置方式', ['', '返修', '让步接收', '报废', '退回上游'], record.unqualifiedDisposition || '', `${disabled} data-qc-disposition`)}
          ${renderSelect('根因类型', ['', '工厂加工问题', '来料问题', '技术资料问题', '平台判定'], record.rootCauseType || '', `${disabled} data-qc-root-cause`)}
          ${renderTextarea('不合格原因说明', record.unqualifiedReasonSummary || '', `${disabled} data-qc-reason`)}
        </div>
      </section>
      <section class="space-y-3 rounded-xl border p-4" data-qc-liability-section ${isAllGood ? 'hidden' : ''}>
        <h3 class="text-sm font-semibold text-foreground">责任与扣款依据</h3>
        <div class="grid gap-3 lg:grid-cols-3">
          ${renderSelect('责任方', ['', '工厂', '平台', '供应商', '无责任'], record.responsiblePartyType || '', `${disabled} data-qc-responsible-party`)}
          ${renderInput('责任对象', record.responsiblePartyName || '', `${disabled} data-qc-responsible-name`)}
          ${renderSelect('扣款决策', ['', '暂不扣款', '建议扣款', '确认扣款'], record.deductionDecision || '', `${disabled} data-qc-deduction-decision`)}
          ${renderTextarea('扣款说明', record.deductionDecisionRemark || '', `${disabled} data-qc-deduction-remark`)}
        </div>
      </section>
      <section class="space-y-3 rounded-xl border p-4">
        <h3 class="text-sm font-semibold text-foreground">后道项目判断</h3>
        ${renderPostNeeds(record)}
      </section>
      <div class="flex justify-end gap-2">
        <button class="rounded-md border px-3 py-2 text-sm" data-nav="${escapeHtml(closeDialogLink())}">取消</button>
        <button class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white" onclick="window.__postCompleteQcOrder('${escapeHtml(record.actionRecordId)}')">确认完成质检</button>
      </div>
    </div>
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
  const allocationRows = (record.warehouseAllocations || []).map((allocation) => `
    <tr>
      <td class="px-3 py-2 font-mono text-xs">${escapeHtml(allocation.warehouseRecordNo)}</td>
      <td class="px-3 py-2">${escapeHtml(allocation.skuCode)}</td>
      <td class="px-3 py-2">${escapeHtml(allocation.colorName)} / ${escapeHtml(allocation.sizeName)}</td>
      <td class="px-3 py-2">${escapeHtml(allocation.productionOrderNo)}</td>
      <td class="px-3 py-2">${escapeHtml(allocation.sourceTaskNo)}</td>
      <td class="px-3 py-2">${escapeHtml(allocation.locationCode ? `${allocation.areaName || '未分区'} / ${allocation.locationCode}` : allocation.areaName || '未分区')}</td>
      <td class="px-3 py-2">${formatGarmentQty(allocation.qcQty, allocation.qtyUnit)}</td>
    </tr>
  `).join('')
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
      <div class="overflow-x-auto rounded-xl border">
        <div class="border-b px-4 py-3 text-sm font-semibold">质检取货明细</div>
        <table class="min-w-[960px] w-full text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground"><tr><th class="px-3 py-2 text-left">库存流水</th><th class="px-3 py-2 text-left">SKU</th><th class="px-3 py-2 text-left">颜色 / 尺码</th><th class="px-3 py-2 text-left">生产单</th><th class="px-3 py-2 text-left">上游任务</th><th class="px-3 py-2 text-left">取货库区 / 库位</th><th class="px-3 py-2 text-left">质检数量</th></tr></thead>
          <tbody>${allocationRows || '<tr><td colspan="7" class="px-3 py-6 text-center text-muted-foreground">暂无取货明细</td></tr>'}</tbody>
        </table>
      </div>
      <div class="rounded-xl border p-4">
        <div class="mb-3 text-sm font-semibold">后道项目判断</div>
        ${renderPostNeeds(record, true)}
      </div>
      <div class="flex justify-end">${renderPrintButton(record)}</div>
    </div>
  `)
}

function renderWaitRows(rows: PostFinishingWaitQcSkuItem[]): string {
  return rows.map((item) => {
    const action = item.waitQcQty > 0
      ? renderPostAction('创建质检单', linkWith({ createQc: item.waitQcSkuKey }))
      : '<span class="rounded-full border bg-slate-50 px-2 py-1 text-xs text-muted-foreground">质检中</span>'
    return `
      <tr class="align-top">
        <td class="px-3 py-3 text-sm"><div class="font-semibold">${escapeHtml(item.skuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(item.colorName)} / ${escapeHtml(item.sizeName)}</div></td>
        <td class="px-3 py-3 text-sm"><div class="font-semibold">${escapeHtml(item.spuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(item.spuName)}</div></td>
        <td class="px-3 py-3 text-sm"><div>${escapeHtml(item.productionOrderNo)}</div><div class="text-xs text-muted-foreground">${escapeHtml(item.sourceTaskNo)}</div></td>
        <td class="px-3 py-3 text-sm"><div>${escapeHtml(item.sourceFactoryName)}</div><div class="text-xs text-muted-foreground">${escapeHtml(item.sourceFactoryType)}</div></td>
        <td class="px-3 py-3 text-sm">${escapeHtml(item.locationCode ? `${item.areaName || '未分区'} / ${item.locationCode}` : item.areaName || '未分区')}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(item.currentStockQty, item.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(item.waitQcQty, item.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(item.qcInProgressQty, item.qtyUnit)}</td>
        <td class="px-3 py-3"><div class="flex flex-wrap gap-2">${action}</div></td>
      </tr>
    `
  }).join('')
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
    if (filters.source !== '全部' && filters.source !== '质检单') return false
    if (filters.status !== '全部' && record.status !== filters.status) return false
    if (filters.factory !== '全部' && record.targetFactoryName !== filters.factory) return false
    return postFilterTextMatches(filters.keyword, [record.actionRecordNo, record.postOrderNo, record.sourceFactoryName, record.targetFactoryName, record.qcStationName, record.skuLines[0]?.spuCode, record.skuLines[0]?.spuName, record.status])
  })
}

function filterWaitQc(records: PostFinishingWaitQcSkuItem[], filters: ReturnType<typeof getPostListFilters>): PostFinishingWaitQcSkuItem[] {
  return records.filter((record) => {
    if (filters.source !== '全部' && record.sourceFactoryType !== filters.source) return false
    if (filters.factory !== '全部' && record.sourceFactoryName !== filters.factory) return false
    return postFilterTextMatches(filters.keyword, [
      record.waitQcSkuKey,
      record.warehouseRecordNo,
      record.productionOrderNo,
      record.sourceFactoryName,
      record.sourceTaskNo,
      record.spuCode,
      record.spuName,
      record.skuCode,
      record.colorName,
      record.sizeName,
      record.areaName,
      record.locationCode,
    ])
  })
}

export function renderPostFinishingQcOrdersPage(): string {
  registerQcPageActions()
  const filters = getPostListFilters()
  const waitItems = listPostFinishingWaitQcSkuItems()
  const allQc = listPostFinishingQcOrders()
  const activeTab = getActiveQcTab()
  const filteredWaitItems = filterWaitQc(waitItems, filters)
  const filteredQc = filterQc(allQc, filters)
  const pagination = paginatePostRows(filteredQc, filters)
  const waitPagination = paginatePostRows(filteredWaitItems, filters)
  const waitRows = renderWaitRows(waitPagination.rows)
  const qcRows = renderQcRows(pagination.rows)
  const activeSection = activeTab === 'wait'
    ? renderPostSection('待质检列表', `${renderPostTable(
        ['SKU', '款式衣服', '生产单 / 上游任务', '上游工厂', '库区 / 库位', '当前库存', '待质检数量', '质检中数量', '操作'],
        waitRows || '<tr><td colspan="9" class="px-3 py-8 text-center text-sm text-muted-foreground">暂无待质检库存</td></tr>',
        'min-w-[1280px]',
      )}<div class="mt-4">${renderPostPagination(waitPagination)}</div>`)
    : renderPostSection('质检单列表', `${renderPostTable(
        ['质检单号', '后道单号', '生产单', '来源工厂', '质检台', '款式衣服', 'SKU 明细', '质检数量', '合格数量', '不合格数量', '质检结果', '责任方', '扣款决策', '状态', '质检人', '操作'],
        qcRows || '<tr><td colspan="16" class="px-3 py-8 text-center text-sm text-muted-foreground">暂无质检单</td></tr>',
        'min-w-[1800px]',
      )}<div class="mt-4">${renderPostPagination(pagination)}</div>`)
  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader()}
      ${renderPostFilterPanel({
        filters,
        statusOptions: activeTab === 'wait' ? [] : allQc.map((item) => item.status),
        sourceOptions: activeTab === 'wait' ? waitItems.map((item) => item.sourceFactoryType) : ['质检单'],
        factoryOptions: [...waitItems.map((item) => item.sourceFactoryName), ...allQc.map((item) => item.targetFactoryName)],
        keywordPlaceholder: '质检单 / 后道单 / 生产单 / 质检台 / SKU',
      })}
      ${renderQcTabs(activeTab, filteredWaitItems.length, filteredQc.length)}
      ${activeSection}
      ${renderCreateQcDialog()}
      ${renderCompleteQcDialog()}
      ${renderViewDialog()}
    </div>
  `
}

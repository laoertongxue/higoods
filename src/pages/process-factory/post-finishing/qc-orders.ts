import {
  POST_FINISHING_QC_DEFECT_REASONS,
  buildPostFinishingQcDeductionRecord,
  completePostFinishingQcOrder,
  createPostFinishingQcOrder,
  getPostFinishingTaskById,
  listPostFinishingQcOrders,
  listPostFinishingWaitQcSkuItems,
  type PostFinishingActionRecord,
  type PostFinishingQcPostProjectJudgement,
  type PostFinishingQcSkuResult,
  type PostFinishingWaitQcSkuItem,
} from '../../../data/fcs/post-finishing-domain.ts'
import { appStore } from '../../../state/store.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../../../data/fcs/production-order-identity.ts'
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

function getCurrentPostTaskId(): string {
  return currentParams().get('postTaskId') || ''
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
    __syncQcCompleteForm?: () => void
  }
  win.__postCreateQcOrder = () => {
    const postTaskId = getCurrentPostTaskId() || undefined
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
      const created = createPostFinishingQcOrder({ postTaskId, allocations, qcStationName: station, inspectorName: '后道质检员' })
      const taskQuery = created.postTaskId ? `&postTaskId=${encodeURIComponent(created.postTaskId)}` : ''
      navigateInPrototype(`/fcs/craft/post-finishing/qc-orders?viewQc=${encodeURIComponent(created.qcOrderId)}${taskQuery}`)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '创建质检单失败。')
    }
  }
  win.__postCompleteQcOrder = (qcOrderId: string) => {
    const valueOf = (selector: string) => (document.querySelector(selector) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null)?.value || ''
    let invalidMessage = ''
    const skuRows = Array.from(document.querySelectorAll<HTMLElement>('[data-qc-sku-result-row]'))
    const result = deriveQcResultFromSkuRows(skuRows)
    const qcSkuResults = skuRows.map((row): PostFinishingQcSkuResult => {
      const defectRow = row.nextElementSibling instanceof HTMLElement && row.nextElementSibling.matches('[data-qc-sku-defect-row]')
        ? row.nextElementSibling
        : null
      const fieldOf = <T extends HTMLElement>(selector: string) => (
        row.querySelector<T>(selector) || defectRow?.querySelector<T>(selector) || null
      )
      const numberOf = (selector: string) => Number(fieldOf<HTMLInputElement>(selector)?.value || 0)
      const inspectedQty = numberOf('[data-qc-sku-inspected]')
      const qualifiedQty = numberOf('[data-qc-sku-qualified]')
      if (!invalidMessage && qualifiedQty > inspectedQty) {
        invalidMessage = `${row.dataset.skuCode || 'SKU'} 的合格数量不能大于质检数量`
      }
      const reworkQty = result === '全数合规' ? 0 : numberOf('[data-qc-sku-rework]')
      const defectAcceptedQty = result === '全数合规' ? 0 : numberOf('[data-qc-sku-defect-accepted]')
      const unqualifiedQty = reworkQty + defectAcceptedQty
      const reworkFactory = fieldOf<HTMLSelectElement>('[data-qc-sku-rework-factory]')?.selectedOptions[0]
      const reworkReceiveFactoryId = reworkQty > 0 ? reworkFactory?.dataset.factoryId || undefined : undefined
      const reworkReceiveFactoryName = reworkQty > 0 ? reworkFactory?.dataset.factoryName || row.dataset.sourceFactoryName || undefined : undefined
      const isExternalRework = reworkQty > 0 && reworkFactory?.value !== 'source'
      const reworkDeductionUnitAmountIdr = isExternalRework ? Math.max(Number(fieldOf<HTMLInputElement>('[data-qc-rework-deduction-unit-amount]')?.value || 0) || 0, 0) : 0
      if (!invalidMessage && isExternalRework && reworkDeductionUnitAmountIdr <= 0) {
        invalidMessage = `${row.dataset.skuCode || 'SKU'} 的返工接收工厂不是原工厂，请填写每件扣款金额`
      }
      const defectReasonItems = result === '全数合规'
        ? []
        : Array.from((defectRow || row).querySelectorAll<HTMLInputElement>('[data-qc-defect-reason]'))
          .map((input, reasonIndex) => ({
            reasonItemId: `${row.dataset.qcSkuResultId || row.dataset.skuId || 'QC'}-REASON-${reasonIndex + 1}`,
            reasonName: input.dataset.reasonName || '',
            qty: Number(input.value || 0),
            liabilityType: '工厂' as const,
            responsibleFactoryId: row.dataset.sourceFactoryId || undefined,
            responsibleFactoryName: row.dataset.sourceFactoryName || valueOf('[data-qc-responsible-name]') || undefined,
          }))
          .filter((item) => item.reasonName && item.qty > 0)
      const reasonQty = defectReasonItems.reduce((sum, item) => sum + item.qty, 0)
      if (!invalidMessage && defectAcceptedQty > 0 && reasonQty !== defectAcceptedQty) {
        invalidMessage = `${row.dataset.skuCode || 'SKU'} 的瑕疵原因合计必须等于瑕疵数量`
      }
      const postProjectJudgements: PostFinishingQcPostProjectJudgement[] = Array.from((defectRow || row).querySelectorAll<HTMLInputElement>('[data-qc-post-project]')).map((checkbox) => ({
        projectName: checkbox.value as PostFinishingQcPostProjectJudgement['projectName'],
        needed: checkbox.checked,
        qty: checkbox.checked ? Math.max(numberOf('[data-qc-sku-qualified]'), 0) : 0,
      }))
      return {
        qcSkuResultId: row.dataset.qcSkuResultId || '',
        skuLineId: row.dataset.skuLineId || '',
        skuId: row.dataset.skuId || '',
        skuCode: row.dataset.skuCode || '',
        skuImageUrl: row.dataset.skuImageUrl || undefined,
        colorName: row.dataset.colorName || '',
        sizeName: row.dataset.sizeName || '',
        inspectedQty,
        qualifiedQty,
        unqualifiedQty,
        reworkQty,
        defectAcceptedQty,
        platformReasonQty: 0,
        factoryReasonQty: unqualifiedQty,
        reworkReceiveFactoryId,
        reworkReceiveFactoryName,
        reworkDeductionUnitAmountIdr,
        reworkDeductionAmountIdr: Math.round(reworkQty * reworkDeductionUnitAmountIdr),
        responsibleFactoryId: result === '全数合规' ? undefined : row.dataset.sourceFactoryId || undefined,
        responsibleFactoryName: result === '全数合规' ? undefined : row.dataset.sourceFactoryName,
        defectReasonItems,
        postProjectJudgements,
        qtyUnit: row.dataset.qtyUnit || '件',
      }
    })
    if (invalidMessage) {
      window.alert(invalidMessage)
      return
    }
    const reworkTotal = qcSkuResults.reduce((sum, item) => sum + (item.reworkQty || 0), 0)
    const defectAcceptedTotal = qcSkuResults.reduce((sum, item) => sum + (item.defectAcceptedQty || 0), 0)
    const reasonSummary = qcSkuResults.flatMap((item) => item.defectReasonItems)
      .filter((item) => item.qty > 0)
      .map((item) => `${item.reasonName}${item.qty}`)
      .join('、')
    const responsibleFactoryName = qcSkuResults.find((item) => (item.reworkQty || item.defectAcceptedQty) > 0)?.responsibleFactoryName || ''
    const completed = completePostFinishingQcOrder({
      qcOrderId,
      qcStationName: valueOf('[data-qc-complete-station]') || '后道质检台 A',
      inspectorName: '后道质检员',
      qcResult: result,
      unqualifiedDisposition: result === '全数合规' ? '' : reworkTotal > 0 ? '返修' : '让步接收',
      unqualifiedReasonSummary: result === '全数合规' ? '' : reasonSummary || `返工 ${reworkTotal}，瑕疵 ${defectAcceptedTotal}`,
      rootCauseType: result === '全数合规' ? '' : '工厂加工问题',
      responsiblePartyType: result === '全数合规' ? '' : '工厂',
      responsiblePartyName: result === '全数合规' ? '' : responsibleFactoryName,
      deductionDecision: result === '全数合规' ? '' : '建议扣款',
      deductionDecisionRemark: result === '全数合规' ? '' : `本期扣加工费数量 ${reworkTotal}，瑕疵数量 ${defectAcceptedTotal} 按原因追溯。`,
      qcSkuResults,
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
  win.__syncQcCompleteForm = () => {
    const result = deriveQcResultFromSkuRows(Array.from(document.querySelectorAll<HTMLElement>('[data-qc-sku-result-row]')))
    const allGood = result === '全数合规'
    const display = document.querySelector<HTMLInputElement>('[data-qc-result-display]')
    if (display) display.value = result
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-qc-defect-field]').forEach((field) => {
      field.disabled = allGood
      if (allGood && !(field instanceof HTMLSelectElement)) field.value = ''
    })
    document.querySelectorAll<HTMLElement>('[data-qc-sku-result-row]').forEach((row) => {
      const select = row.querySelector<HTMLSelectElement>('[data-qc-sku-rework-factory]')
      const reworkQty = Number(row.querySelector<HTMLInputElement>('[data-qc-sku-rework]')?.value || 0)
      const amount = row.querySelector<HTMLInputElement>('[data-qc-rework-deduction-unit-amount]')
      const disabled = allGood || select?.value === 'source' || reworkQty <= 0
      if (amount) {
        amount.disabled = disabled
        if (disabled) amount.value = ''
      }
    })
  }
}

function renderPageHeader(): string {
  const task = getCurrentPostTaskId() ? getPostFinishingTaskById(getCurrentPostTaskId()) : undefined
  return renderPostFinishingPageHeader(
    '质检单',
    task ? `${task.postTaskNo} / ${task.productionOrderNo}` : '',
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
  const postTaskId = getCurrentPostTaskId() || undefined
  const waitItems = listPostFinishingWaitQcSkuItems({ postTaskId }).filter((item) => item.waitQcQty > 0)
  const task = postTaskId ? getPostFinishingTaskById(postTaskId) : undefined
  const selectedKey = currentParams().get('createQc') || ''
  const rows = waitItems.map((item) => {
    const checked = item.waitQcSkuKey === selectedKey || item.warehouseRecordId === selectedKey
    const locationLabel = item.locationCode ? `${item.areaName || '未分区'} / ${item.locationCode}` : item.areaName || '未分区'
    return `
      <tr data-qc-source-row data-warehouse-record-id="${escapeHtml(item.warehouseRecordId)}" class="align-top ${checked ? 'bg-blue-50/60' : ''}">
        <td class="px-3 py-3"><input type="checkbox" data-qc-source-check ${checked ? 'checked' : ''} /></td>
        <td class="px-3 py-3">
          <img class="h-14 w-14 rounded-lg border object-cover" src="${escapeHtml(item.skuImageUrl || 'https://placehold.co/96x96?text=SKU')}" alt="${escapeHtml(item.skuCode)}" />
        </td>
        <td class="px-3 py-3 text-sm"><div class="font-semibold">${escapeHtml(item.skuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(item.colorName)} / ${escapeHtml(item.sizeName)}</div></td>
        <td class="px-3 py-3 text-sm">${renderProductionOrderIdentityCell(item.productionOrderNo)}<div class="text-xs text-muted-foreground">${escapeHtml(item.sourceTaskNo)}</div></td>
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
          <div class="mt-1 font-medium text-foreground">${escapeHtml(task ? `${task.postTaskNo} / ${task.productionOrderNo}` : '同一张质检单只能选择同一生产单下的同一款式 SKU')}</div>
        </div>
      </div>
      <div class="overflow-x-auto rounded-xl border">
        <table class="min-w-[1280px] w-full text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground"><tr><th class="px-3 py-2 text-left">选择</th><th class="px-3 py-2 text-left">图片</th><th class="px-3 py-2 text-left">SKU</th><th class="px-3 py-2 text-left">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE} / 上游任务</th><th class="px-3 py-2 text-left">上游工厂</th><th class="px-3 py-2 text-left">取货库区 / 库位</th><th class="px-3 py-2 text-left">当前库存</th><th class="px-3 py-2 text-left">待质检数量</th><th class="px-3 py-2 text-left">质检中数量</th><th class="px-3 py-2 text-left">本次质检数量</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="10" class="px-3 py-8 text-center text-sm text-muted-foreground">暂无可创建质检单的库存 SKU</td></tr>'}</tbody>
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

function deriveQcResultFromTotals(inspectedQty: number, qualifiedQty: number): '全数合规' | '部分不合格' | '全数不合格' {
  if (qualifiedQty <= 0) return '全数不合格'
  if (qualifiedQty >= inspectedQty) return '全数合规'
  return '部分不合格'
}

function deriveQcResultFromSkuRows(rows: HTMLElement[]): '全数合规' | '部分不合格' | '全数不合格' {
  const totals = rows.reduce((sum, row) => {
    sum.inspected += Number((row.querySelector('[data-qc-sku-inspected]') as HTMLInputElement | null)?.value || 0)
    sum.qualified += Number((row.querySelector('[data-qc-sku-qualified]') as HTMLInputElement | null)?.value || 0)
    return sum
  }, { inspected: 0, qualified: 0 })
  return deriveQcResultFromTotals(totals.inspected, totals.qualified)
}

function deriveQcResultFromRecord(record: PostFinishingActionRecord): '全数合规' | '部分不合格' | '全数不合格' {
  const results = normalizeRecordSkuResults(record)
  const totals = results.reduce((sum, result) => {
    sum.inspected += result.inspectedQty || 0
    sum.qualified += result.qualifiedQty || 0
    return sum
  }, { inspected: 0, qualified: 0 })
  return deriveQcResultFromTotals(totals.inspected, totals.qualified)
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

const QC_POST_PROJECTS: PostFinishingQcPostProjectJudgement['projectName'][] = ['开扣眼', '装扣子', '熨烫', '包装']

function normalizeRecordSkuResults(record: PostFinishingActionRecord): PostFinishingQcSkuResult[] {
  if (record.qcSkuResults?.length) return record.qcSkuResults
  return record.skuLines.map((line, index) => ({
    qcSkuResultId: `${record.actionRecordId}-SKU-${index + 1}`,
    skuLineId: line.skuLineId,
    skuId: line.skuId,
    skuCode: line.skuCode,
    skuImageUrl: line.imageUrl,
    colorName: line.colorName,
    sizeName: line.sizeName,
    inspectedQty: line.plannedQty,
    qualifiedQty: line.plannedQty,
    unqualifiedQty: 0,
    reworkQty: 0,
    defectAcceptedQty: 0,
    reworkDeductionUnitAmountIdr: 0,
    reworkDeductionAmountIdr: 0,
    platformReasonQty: 0,
    factoryReasonQty: 0,
    defectReasonItems: [],
    postProjectJudgements: [],
    qtyUnit: line.qtyUnit,
  }))
}

function renderSkuQcResultRows(record: PostFinishingActionRecord, disableDefectFields = false): string {
  return normalizeRecordSkuResults(record).map((result) => {
    const checkedProjects = new Set(result.postProjectJudgements.filter((item) => item.needed).map((item) => item.projectName))
    const reasonQtyByName = new Map(result.defectReasonItems.map((item) => [item.reasonName, item.qty]))
    const reworkQty = result.reworkQty ?? result.unqualifiedQty
    const defectAcceptedQty = result.defectAcceptedQty ?? 0
    const disabledAttr = disableDefectFields ? 'disabled' : ''
    const sourceFactoryName = result.responsibleFactoryName || record.sourceFactoryName || '原工厂'
    const sourceFactoryId = result.responsibleFactoryId || ''
    const targetFactoryName = record.targetFactoryName || result.reworkReceiveFactoryName || '当前后道工厂'
    const selectedFactory = result.reworkReceiveFactoryName === targetFactoryName ? 'post' : 'source'
    const reworkDeductionUnitAmountIdr = result.reworkDeductionUnitAmountIdr ?? 0
    const deductionDisabledAttr = disableDefectFields || selectedFactory === 'source' || reworkQty <= 0 ? 'disabled' : ''
    const reasonInputs = POST_FINISHING_QC_DEFECT_REASONS.map((reason) => `
      <label class="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] items-center gap-2 text-xs">
        <span class="text-muted-foreground">${escapeHtml(reason)}</span>
        <input class="h-8 min-w-0 rounded-md border px-2 text-sm" type="number" min="0" step="1" data-qc-defect-field="1" data-qc-defect-reason data-reason-name="${escapeHtml(reason)}" value="${reasonQtyByName.get(reason) || ''}" ${disabledAttr} />
      </label>
    `).join('')
    return `
      <article
        data-qc-sku-result-row
        data-qc-sku-card
        data-qc-sku-result-id="${escapeHtml(result.qcSkuResultId)}"
        data-sku-line-id="${escapeHtml(result.skuLineId)}"
        data-sku-id="${escapeHtml(result.skuId)}"
        data-sku-code="${escapeHtml(result.skuCode)}"
        data-sku-image-url="${escapeHtml(result.skuImageUrl || '')}"
        data-color-name="${escapeHtml(result.colorName)}"
        data-size-name="${escapeHtml(result.sizeName)}"
        data-qty-unit="${escapeHtml(result.qtyUnit)}"
        data-source-factory-id="${escapeHtml(sourceFactoryId)}"
        data-source-factory-name="${escapeHtml(sourceFactoryName)}"
        data-target-factory-name="${escapeHtml(targetFactoryName)}"
        class="space-y-4 rounded-xl border bg-white p-4"
      >
        <div class="flex min-w-0 gap-3">
          <img class="h-14 w-14 rounded-lg border object-cover" src="${escapeHtml(result.skuImageUrl || 'https://placehold.co/96x96?text=SKU')}" alt="${escapeHtml(result.skuCode)}" />
          <div class="min-w-0">
            <div class="font-semibold text-sm">${escapeHtml(result.skuCode)}</div>
            <div class="text-xs text-muted-foreground">${escapeHtml(result.colorName)} / ${escapeHtml(result.sizeName)}</div>
          </div>
        </div>
        <div data-qc-sku-main-row class="space-y-3 rounded-lg bg-slate-50 p-3">
          <div class="text-xs font-medium text-muted-foreground">质检与返工</div>
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label class="space-y-1 text-sm"><span class="text-xs text-muted-foreground">质检数量</span><input class="h-9 w-full rounded-md border px-2 text-sm" type="number" min="0" data-qc-sku-inspected value="${result.inspectedQty || record.submittedGarmentQty}" oninput="window.__syncQcCompleteForm()" /></label>
            <label class="space-y-1 text-sm"><span class="text-xs text-muted-foreground">合格数量</span><input class="h-9 w-full rounded-md border px-2 text-sm" type="number" min="0" data-qc-sku-qualified value="${result.qualifiedQty || result.inspectedQty}" oninput="window.__syncQcCompleteForm()" /></label>
            <label class="space-y-1 text-sm"><span class="text-xs text-muted-foreground">返工数量</span><input class="h-9 w-full rounded-md border px-2 text-sm" type="number" min="0" data-qc-defect-field="1" data-qc-sku-rework value="${reworkQty || ''}" oninput="window.__syncQcCompleteForm()" ${disabledAttr} /></label>
            <label class="space-y-1 text-sm"><span class="text-xs text-muted-foreground">返工接收工厂</span><select class="h-9 w-full rounded-md border px-2 text-sm" data-qc-defect-field="1" data-qc-sku-rework-factory onchange="window.__syncQcCompleteForm()" ${disabledAttr}>
              <option value="source" data-factory-id="${escapeHtml(sourceFactoryId)}" data-factory-name="${escapeHtml(sourceFactoryName)}" ${selectedFactory === 'source' ? 'selected' : ''}>原工厂（${escapeHtml(sourceFactoryName)}）</option>
              <option value="post" data-factory-id="" data-factory-name="${escapeHtml(targetFactoryName)}" ${selectedFactory === 'post' ? 'selected' : ''}>当前后道工厂（${escapeHtml(targetFactoryName)}）</option>
            </select></label>
            <label class="space-y-1 text-sm"><span class="text-xs text-muted-foreground">每件扣款金额（印尼盾）</span><input class="h-9 w-full rounded-md border px-2 text-sm" type="number" min="0" step="1" data-qc-defect-field="1" data-qc-rework-deduction-unit-amount value="${reworkDeductionUnitAmountIdr || ''}" ${deductionDisabledAttr} /></label>
          </div>
        </div>
        <div data-qc-sku-defect-row class="space-y-3 rounded-lg bg-slate-50 p-3">
          <div class="text-xs font-medium text-muted-foreground">瑕疵与后道</div>
          <div class="grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)_260px]">
            <label class="space-y-1 text-sm"><span class="text-xs text-muted-foreground">瑕疵数量</span><input class="h-9 w-full rounded-md border px-2 text-sm" type="number" min="0" data-qc-defect-field="1" data-qc-sku-defect-accepted value="${defectAcceptedQty || ''}" ${disabledAttr} /></label>
            <div class="min-w-0 space-y-1">
              <div class="text-xs text-muted-foreground">瑕疵原因</div>
              <div class="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">${reasonInputs}</div>
            </div>
            <div class="space-y-1">
              <div class="text-xs text-muted-foreground">后道项目</div>
              <div class="grid gap-2 sm:grid-cols-2">
            ${QC_POST_PROJECTS.map((project) => `
              <label class="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
                <input type="checkbox" data-qc-post-project value="${escapeHtml(project)}" ${checkedProjects.has(project) ? 'checked' : ''} />
                <span>${escapeHtml(project)}</span>
              </label>
            `).join('')}
              </div>
            </div>
          </div>
        </div>
      </article>
    `
  }).join('')
}

function renderCompleteQcDialog(): string {
  const recordId = getCompleteId()
  if (!recordId) return ''
  const record = listPostFinishingQcOrders().find((item) => item.actionRecordId === recordId)
  if (!record) return renderModal('完成质检', '<div class="text-sm text-muted-foreground">未找到质检单</div>')
  const result = deriveQcResultFromRecord(record)
  const isAllGood = result === '全数合规'
  return renderModal('完成质检', `
    <div class="space-y-5">
      <div class="grid gap-3 lg:grid-cols-3">
        ${renderInput('质检单号', record.actionRecordNo, 'disabled')}
        ${renderSelect('质检台', ['后道质检台 A', '后道质检台 B', '后道质检台 C'], record.qcStationName || '后道质检台 A', 'data-qc-complete-station')}
        ${renderInput('质检结果', result, 'disabled data-qc-result-display')}
      </div>
      <section class="space-y-3 rounded-xl border p-4">
        <h3 class="text-sm font-semibold text-foreground">SKU 质检结果与后道项目判断</h3>
        <div class="space-y-3">${renderSkuQcResultRows(record, isAllGood)}</div>
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

function uniqueText(values: Array<string | undefined>): string {
  return Array.from(new Set(values.map((item) => item?.trim()).filter(Boolean) as string[])).join('、') || '—'
}

function summarizeReworkFactories(record: PostFinishingActionRecord): string {
  return uniqueText(normalizeRecordSkuResults(record)
    .filter((item) => (item.reworkQty || 0) > 0)
    .map((item) => item.reworkReceiveFactoryName))
}

function summarizeDefectReasons(record: PostFinishingActionRecord): string {
  const reasons = normalizeRecordSkuResults(record).flatMap((result) => result.defectReasonItems || [])
    .filter((item) => item.qty > 0)
    .map((item) => `${item.reasonName}${item.qty}`)
  return reasons.join('、') || '—'
}

function formatIdrAmount(value: number | undefined): string {
  const amount = Number(value || 0)
  return amount > 0 ? `${Math.round(amount).toLocaleString('id-ID')} 印尼盾` : '—'
}

function summarizeReworkDeductionAmount(record: PostFinishingActionRecord): string {
  const amount = normalizeRecordSkuResults(record).reduce((sum, result) => sum + (Number(result.reworkDeductionAmountIdr) || 0), 0)
  return formatIdrAmount(amount)
}

function renderPrintButton(record: PostFinishingActionRecord): string {
  const snapshot = buildPostFinishingQcDeductionRecord(record)
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(record.actionRecordNo)} 纸质质检单</title><style>body{font-family:Arial,'Microsoft YaHei',sans-serif;margin:24px;color:#111827}h1{font-size:22px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.box{border:1px solid #d1d5db;border-radius:8px;padding:10px}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #d1d5db;padding:8px;text-align:left}th{background:#f3f4f6}@media print{button{display:none}}</style></head><body><button onclick="window.print()">打印</button><h1>纸质质检单</h1><div class="grid"><div class="box">质检单号<br/><strong>${escapeHtml(record.actionRecordNo)}</strong></div><div class="box">质检台<br/><strong>${escapeHtml(record.qcStationName || '—')}</strong></div><div class="box">质检人<br/><strong>${escapeHtml(record.operatorName || '—')}</strong></div></div><table><thead><tr><th>质检数量</th><th>合格数量</th><th>返工数量</th><th>返工接收工厂</th><th>返工扣款金额</th><th>瑕疵数量</th><th>瑕疵原因</th><th>本期扣加工费数量</th><th>质检结果</th></tr></thead><tbody><tr><td>${record.inspectedGarmentQty ?? record.submittedGarmentQty}</td><td>${record.passedGarmentQty ?? record.acceptedGarmentQty}</td><td>${record.reworkGarmentQty ?? 0}</td><td>${escapeHtml(summarizeReworkFactories(record))}</td><td>${escapeHtml(summarizeReworkDeductionAmount(record))}</td><td>${record.defectAcceptedGarmentQty ?? 0}</td><td>${escapeHtml(summarizeDefectReasons(record))}</td><td>${snapshot?.processingFeeDeductionQty ?? record.processingFeeDeductionQty ?? 0}</td><td>${escapeHtml(normalizeResult(record.qcResult))}</td></tr></tbody></table></body></html>`
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
      <td class="px-3 py-2">${renderProductionOrderIdentityCell(allocation.productionOrderNo)}</td>
      <td class="px-3 py-2">${escapeHtml(allocation.sourceTaskNo)}</td>
      <td class="px-3 py-2">${escapeHtml(allocation.locationCode ? `${allocation.areaName || '未分区'} / ${allocation.locationCode}` : allocation.areaName || '未分区')}</td>
      <td class="px-3 py-2">${formatGarmentQty(allocation.qcQty, allocation.qtyUnit)}</td>
    </tr>
  `).join('')
  const skuResultRows = normalizeRecordSkuResults(record).map((result) => {
    const reasonSummary = result.defectReasonItems
      .filter((item) => item.qty > 0)
      .map((item) => `${item.reasonName}${item.qty}`)
      .join('、') || '—'
    const projectSummary = result.postProjectJudgements.filter((item) => item.needed).map((item) => item.projectName).join('、') || '—'
    return `
      <article data-qc-detail-sku-card class="space-y-3 rounded-xl border p-4">
        <div class="flex min-w-0 gap-3">
          <img class="h-12 w-12 rounded border object-cover" src="${escapeHtml(result.skuImageUrl || 'https://placehold.co/96x96?text=SKU')}" alt="${escapeHtml(result.skuCode)}" />
          <div class="min-w-0">
            <div class="font-medium text-sm">${escapeHtml(result.skuCode)}</div>
            <div class="text-xs text-muted-foreground">${escapeHtml(result.colorName)} / ${escapeHtml(result.sizeName)}</div>
          </div>
        </div>
        <div class="grid gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-2 xl:grid-cols-4">
          <div><div class="text-xs text-muted-foreground">质检数量</div><div class="mt-1 text-sm font-medium">${formatGarmentQty(result.inspectedQty, result.qtyUnit)}</div></div>
          <div><div class="text-xs text-muted-foreground">合格数量</div><div class="mt-1 text-sm font-medium">${formatGarmentQty(result.qualifiedQty, result.qtyUnit)}</div></div>
          <div><div class="text-xs text-muted-foreground">返工数量</div><div class="mt-1 text-sm font-medium">${formatGarmentQty(result.reworkQty, result.qtyUnit)}</div></div>
          <div><div class="text-xs text-muted-foreground">返工接收工厂</div><div class="mt-1 text-sm font-medium">${escapeHtml(result.reworkReceiveFactoryName || '—')}</div></div>
          <div><div class="text-xs text-muted-foreground">每件扣款金额</div><div class="mt-1 text-sm font-medium">${escapeHtml(formatIdrAmount(result.reworkDeductionUnitAmountIdr))}</div></div>
          <div><div class="text-xs text-muted-foreground">返工扣款金额</div><div class="mt-1 text-sm font-medium">${escapeHtml(formatIdrAmount(result.reworkDeductionAmountIdr))}</div></div>
        </div>
        <div class="grid gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-[160px_minmax(0,1fr)_220px]">
          <div><div class="text-xs text-muted-foreground">瑕疵数量</div><div class="mt-1 text-sm font-medium">${formatGarmentQty(result.defectAcceptedQty, result.qtyUnit)}</div></div>
          <div class="min-w-0"><div class="text-xs text-muted-foreground">瑕疵原因</div><div class="mt-1 text-sm">${escapeHtml(reasonSummary)}</div></div>
          <div><div class="text-xs text-muted-foreground">后道项目</div><div class="mt-1 text-sm">${escapeHtml(projectSummary)}</div></div>
        </div>
      </article>
    `
  }).join('')
  return renderModal('质检单详情', `
    <div class="space-y-5">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        ${renderReadonlyField('质检单号', record.actionRecordNo)}
        ${renderReadonlyField('质检台', record.qcStationName || '—')}
        ${renderReadonlyField('质检状态', record.status)}
        ${renderReadonlyField('质检数量', formatGarmentQty(record.inspectedGarmentQty ?? record.submittedGarmentQty, record.qtyUnit))}
        ${renderReadonlyField('合格数量', formatGarmentQty(record.passedGarmentQty ?? record.acceptedGarmentQty, record.qtyUnit))}
        ${renderReadonlyField('返工数量', formatGarmentQty(record.reworkGarmentQty ?? 0, record.qtyUnit))}
        ${renderReadonlyField('返工接收工厂', summarizeReworkFactories(record))}
        ${renderReadonlyField('返工扣款金额', summarizeReworkDeductionAmount(record))}
        ${renderReadonlyField('瑕疵数量', formatGarmentQty(record.defectAcceptedGarmentQty ?? 0, record.qtyUnit))}
        ${renderReadonlyField('瑕疵原因', summarizeDefectReasons(record))}
        ${renderReadonlyField('本期扣加工费数量', formatGarmentQty(snapshot?.processingFeeDeductionQty ?? record.processingFeeDeductionQty ?? 0, record.qtyUnit))}
        ${renderReadonlyField('质检结果', normalizeResult(record.qcResult))}
      </div>
      <div class="rounded-xl border">
        <div class="border-b px-4 py-3 text-sm font-semibold">SKU 级质检结果</div>
        <div class="space-y-3 p-4">${skuResultRows}</div>
      </div>
      <div class="rounded-xl border">
        <div class="border-b px-4 py-3 text-sm font-semibold">质检取货明细</div>
        <table class="w-full table-fixed text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground"><tr><th class="px-3 py-2 text-left">库存流水</th><th class="px-3 py-2 text-left">SKU</th><th class="px-3 py-2 text-left">颜色 / 尺码</th><th class="px-3 py-2 text-left">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th><th class="px-3 py-2 text-left">上游任务</th><th class="px-3 py-2 text-left">库位</th><th class="px-3 py-2 text-left">数量</th></tr></thead>
          <tbody>${allocationRows || '<tr><td colspan="7" class="px-3 py-6 text-center text-muted-foreground">暂无取货明细</td></tr>'}</tbody>
        </table>
      </div>
      <div class="flex justify-end">${renderPrintButton(record)}</div>
    </div>
  `)
}

function renderWaitRows(rows: PostFinishingWaitQcSkuItem[]): string {
  return rows.map((item) => {
    const action = item.waitQcQty > 0
      ? renderPostAction('创建质检单', linkWith({ createQc: item.waitQcSkuKey, postTaskId: item.postTaskId }))
      : '<span class="rounded-full border bg-slate-50 px-2 py-1 text-xs text-muted-foreground">质检中</span>'
    return `
      <tr class="align-top">
        <td class="px-3 py-3 text-sm"><div class="font-semibold">${escapeHtml(item.skuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(item.colorName)} / ${escapeHtml(item.sizeName)}</div></td>
        <td class="px-3 py-3 text-sm"><div class="font-semibold">${escapeHtml(item.spuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(item.spuName)}</div></td>
        <td class="px-3 py-3 text-sm">${renderProductionOrderIdentityCell(item.productionOrderNo)}<div class="text-xs text-muted-foreground">${escapeHtml(item.sourceTaskNo)}</div></td>
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
    const skuSummary = record.skuLines.map((line) => `${line.skuCode}/${line.colorName}/${line.sizeName}`).join('、')
    return `
      <article data-qc-list-card class="rounded-xl border bg-white p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="font-mono text-xs text-muted-foreground">${escapeHtml(record.actionRecordNo)}</div>
            <div class="mt-1 text-sm font-semibold">${escapeHtml(record.postOrderNo)} · ${escapeHtml(record.qcStationName || '—')}</div>
            <div class="mt-2">${renderProductionOrderIdentityCell(snapshot?.productionOrderNo || '—')}</div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            ${renderPostStatusBadge(record.status)}
            <span class="rounded-full border px-2 py-0.5 text-xs">${escapeHtml(normalizeResult(record.qcResult))}</span>
          </div>
        </div>
        <div class="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div class="rounded-lg bg-slate-50 p-3">
            <div class="text-xs text-muted-foreground">来源与 SKU</div>
            <div class="mt-1 text-sm">${escapeHtml(record.sourceFactoryName)} / ${escapeHtml(record.skuLines[0]?.spuCode || '—')}</div>
            <div class="mt-1 break-words text-xs text-muted-foreground">${escapeHtml(skuSummary || '—')}</div>
          </div>
          <div class="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-sm">
            <div><div class="text-xs text-muted-foreground">质检</div><div class="font-medium">${formatGarmentQty(record.inspectedGarmentQty ?? record.submittedGarmentQty, record.qtyUnit)}</div></div>
            <div><div class="text-xs text-muted-foreground">合格</div><div class="font-medium">${formatGarmentQty(record.passedGarmentQty ?? record.acceptedGarmentQty, record.qtyUnit)}</div></div>
            <div><div class="text-xs text-muted-foreground">返工</div><div class="font-medium">${formatGarmentQty(record.reworkGarmentQty ?? 0, record.qtyUnit)}</div></div>
            <div><div class="text-xs text-muted-foreground">瑕疵</div><div class="font-medium">${formatGarmentQty(record.defectAcceptedGarmentQty ?? 0, record.qtyUnit)}</div></div>
            <div class="col-span-2"><div class="text-xs text-muted-foreground">本期扣加工费数量</div><div class="font-medium">${formatGarmentQty(snapshot?.processingFeeDeductionQty ?? record.processingFeeDeductionQty ?? 0, record.qtyUnit)}</div></div>
          </div>
          <div class="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
            <div><span class="text-xs text-muted-foreground">返工接收工厂</span><div class="mt-1">${escapeHtml(summarizeReworkFactories(record))}</div></div>
            <div><span class="text-xs text-muted-foreground">返工扣款金额</span><div class="mt-1">${escapeHtml(summarizeReworkDeductionAmount(record))}</div></div>
            <div><span class="text-xs text-muted-foreground">瑕疵原因</span><div class="mt-1 break-words">${escapeHtml(summarizeDefectReasons(record))}</div></div>
            <div><span class="text-xs text-muted-foreground">质检人</span><div class="mt-1">${escapeHtml(record.operatorName || '—')}</div></div>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap justify-end gap-2">${canFinish ? renderPostAction('完成质检', linkWith({ completeQc: record.actionRecordId, viewQc: undefined, createQc: undefined })) : ''}${renderPostAction('查看质检单', linkWith({ viewQc: record.actionRecordId, completeQc: undefined, createQc: undefined }))}${renderPrintButton(record)}</div>
      </article>
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
  const postTaskId = getCurrentPostTaskId() || undefined
  const waitItems = listPostFinishingWaitQcSkuItems({ postTaskId })
  const allQc = listPostFinishingQcOrders().filter((record) => (
    !postTaskId || record.warehouseAllocations?.some((allocation) => allocation.postTaskId === postTaskId)
  ))
  const activeTab = getActiveQcTab()
  const filteredWaitItems = filterWaitQc(waitItems, filters)
  const filteredQc = filterQc(allQc, filters)
  const pagination = paginatePostRows(filteredQc, filters)
  const waitPagination = paginatePostRows(filteredWaitItems, filters)
  const waitRows = renderWaitRows(waitPagination.rows)
  const qcRows = renderQcRows(pagination.rows)
  const activeSection = activeTab === 'wait'
    ? renderPostSection('待质检列表', `${renderPostTable(
        ['SKU', '款式衣服', `${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE} / 上游任务`, '上游工厂', '库区 / 库位', '当前库存', '待质检数量', '质检中数量', '操作'],
        waitRows || '<tr><td colspan="9" class="px-3 py-8 text-center text-sm text-muted-foreground">暂无待质检库存</td></tr>',
        'min-w-[1280px]',
      )}<div class="mt-4">${renderPostPagination(waitPagination)}</div>`)
    : renderPostSection('质检单列表', `
        <div class="space-y-3">${qcRows || '<div class="rounded-xl border bg-slate-50 px-4 py-8 text-center text-sm text-muted-foreground">暂无质检单</div>'}</div>
        <div class="mt-4">${renderPostPagination(pagination)}</div>
      `)
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

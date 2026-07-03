import {
  POST_FINISHING_QC_DEFECT_REASONS,
  buildPostFinishingQcDeductionRecord,
  completePostFinishingQcOrder,
  createPostFinishingQcOrder,
  getPostFinishingTaskById,
  getPostFinishingRecheckOrderById,
  listPostFinishingQcOrderEntities,
  listPostFinishingQcOrders,
  listPostFinishingWaitQcSkuItems,
  submitPostFinishingPdaQcResult,
  type PostFinishingActionRecord,
  type PostFinishingQcOrder,
  type PostFinishingQcPostProjectJudgement,
  type PostFinishingQcSkuResult,
  type PostFinishingWaitQcSkuItem,
} from '../../../data/fcs/post-finishing-domain.ts'
import { buildUnifiedPrintPreviewLink } from '../../../data/fcs/print-service.ts'
import { appStore } from '../../../state/store.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionObjectCodeButton,
  renderProductionOrderIdentityCell,
} from '../../../data/fcs/production-order-identity.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatGarmentQty,
  getPostListFilters,
  paginatePostRows,
  postFilterTextMatches,
  renderPostAction,
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
  return linkWith({ createQc: undefined, completeQc: undefined, viewQc: undefined, inputQc: undefined, qcProductionOrderNo: undefined })
}

function navigateInPrototype(url: string): void {
  appStore.navigate(url)
}

function parseProductionOrderQrValue(value: string): string {
  return value.match(/PO-\d{6}-\d{4}/)?.[0] || value.trim()
}

function isCreateDialogOpen(): boolean {
  return Boolean(currentParams().get('createQc'))
}

function isQuickInputDialogOpen(): boolean {
  return Boolean(currentParams().get('inputQc'))
}

function getQuickProductionOrderNo(): string {
  return currentParams().get('qcProductionOrderNo') || ''
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

function renderProductionOrderCode(productionOrderNo: string): string {
  return renderProductionObjectCodeButton({
    objectType: 'PRODUCTION_ORDER',
    objectId: productionOrderNo,
    defaultTab: 'overview',
    highlightKey: `PRODUCTION_ORDER:${productionOrderNo}`,
  })
}

function renderQcMasterOrderCode(objectId: string, productionOrderNo: string, label = objectId): string {
  return renderProductionObjectCodeButton({
    objectType: 'QC_MASTER_ORDER',
    objectId,
    label,
    relatedProductionOrderNo: productionOrderNo,
    defaultTab: 'quantity',
    highlightKey: `QC_MASTER_ORDER:${label}`,
  })
}

function renderQcOrderCode(qcOrderNo: string, productionOrderNo?: string): string {
  return renderProductionObjectCodeButton({
    objectType: 'QC_ORDER',
    objectId: qcOrderNo,
    relatedProductionOrderNo: productionOrderNo,
    defaultTab: 'quantity',
    highlightKey: `QC_ORDER:${qcOrderNo}`,
  })
}

function renderRecheckOrderCode(recheckOrderNo: string, productionOrderNo: string): string {
  return renderProductionObjectCodeButton({
    objectType: 'RECHECK_ORDER',
    objectId: recheckOrderNo,
    relatedProductionOrderNo: productionOrderNo,
    defaultTab: 'quantity',
    highlightKey: `RECHECK_ORDER:${recheckOrderNo}`,
  })
}

function renderReadonlyHtmlField(label: string, valueHtml: string): string {
  return `<div class="rounded-lg border bg-slate-50 px-3 py-2"><div class="text-xs text-muted-foreground">${escapeHtml(label)}</div><div class="mt-1 text-sm font-medium text-foreground">${valueHtml || '—'}</div></div>`
}

type QcTabKey = 'wait' | 'qc'
type ButtonModeFilter = '全部' | '人工装扣' | '机器装扣'
type PendingDefectReasonFilter = '全部' | '需要补齐' | '无需补齐'

function getActiveQcTab(): QcTabKey {
  return currentParams().get('tab') === 'qc' ? 'qc' : 'wait'
}

function getButtonModeFilter(): ButtonModeFilter {
  const value = currentParams().get('buttonMode')
  if (value === 'manual') return '人工装扣'
  if (value === 'machine') return '机器装扣'
  return '全部'
}

function getPendingDefectReasonFilter(): PendingDefectReasonFilter {
  const value = currentParams().get('pendingDefectReason')
  if (value === 'required') return '需要补齐'
  if (value === 'none') return '无需补齐'
  return '全部'
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

function uniqueFilterOptions(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right, 'zh-CN'))
}

function renderFilterOption(value: string, currentValue: string): string {
  return `<option value="${escapeHtml(value)}" ${value === currentValue ? 'selected' : ''}>${escapeHtml(value)}</option>`
}

function renderQcFilterPanel(options: {
  filters: ReturnType<typeof getPostListFilters>
  activeTab: QcTabKey
  statusOptions: string[]
  sourceOptions: string[]
  factoryOptions: string[]
}): string {
  const statusOptions = ['全部', ...uniqueFilterOptions(options.statusOptions)]
  const sourceOptions = ['全部', ...uniqueFilterOptions(options.sourceOptions)]
  const factoryOptions = ['全部', ...uniqueFilterOptions(options.factoryOptions)]
  const buttonMode = getButtonModeFilter()
  const pendingDefectReason = getPendingDefectReasonFilter()
  const resetHref = linkWith({
    keyword: undefined,
    status: undefined,
    source: undefined,
    factory: undefined,
    buttonMode: undefined,
    pendingDefectReason: undefined,
    page: '1',
    pageSize: undefined,
    createQc: undefined,
    completeQc: undefined,
    viewQc: undefined,
  })
  return `
    <form class="rounded-lg border bg-card p-4" method="get" action="${escapeHtml(currentPath())}">
      <input type="hidden" name="page" value="1" />
      ${getCurrentPostTaskId() ? `<input type="hidden" name="postTaskId" value="${escapeHtml(getCurrentPostTaskId())}" />` : ''}
      <input type="hidden" name="tab" value="${escapeHtml(options.activeTab)}" />
      <div data-qc-filter-row class="grid items-end gap-3 ${options.activeTab === 'qc' ? 'grid-cols-[minmax(140px,1.3fr)_repeat(5,minmax(96px,.75fr))_auto]' : 'grid-cols-[minmax(180px,1fr)_minmax(120px,.8fr)_minmax(120px,.8fr)_minmax(140px,.8fr)_auto]'}">
        <label class="min-w-0 space-y-1 text-sm">
          <span class="whitespace-nowrap text-xs text-muted-foreground">关键词</span>
          <input class="h-9 w-full min-w-0 rounded-md border bg-background px-3 text-sm" name="keyword" value="${escapeHtml(options.filters.keyword)}" placeholder="质检单 / 后道单 / 生产单 / 质检台 / SKU" />
        </label>
        <label class="min-w-0 space-y-1 text-sm">
          <span class="whitespace-nowrap text-xs text-muted-foreground">当前状态</span>
          <select class="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm" name="status">${statusOptions.map((value) => renderFilterOption(value, options.filters.status)).join('')}</select>
        </label>
        <label class="min-w-0 space-y-1 text-sm">
          <span class="whitespace-nowrap text-xs text-muted-foreground">后道来源</span>
          <select class="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm" name="source">${sourceOptions.map((value) => renderFilterOption(value, options.filters.source)).join('')}</select>
        </label>
        <label class="min-w-0 space-y-1 text-sm">
          <span class="whitespace-nowrap text-xs text-muted-foreground">工厂</span>
          <select class="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm" name="factory">${factoryOptions.map((value) => renderFilterOption(value, options.filters.factory)).join('')}</select>
        </label>
        ${options.activeTab === 'qc' ? `
          <label class="min-w-0 space-y-1 text-sm">
            <span class="whitespace-nowrap text-xs text-muted-foreground">装扣方式</span>
            <select class="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm" name="buttonMode">
              <option value="" ${buttonMode === '全部' ? 'selected' : ''}>全部装扣方式</option>
              <option value="manual" ${buttonMode === '人工装扣' ? 'selected' : ''}>人工装扣</option>
              <option value="machine" ${buttonMode === '机器装扣' ? 'selected' : ''}>机器装扣</option>
            </select>
          </label>
          <label class="min-w-0 space-y-1 text-sm">
            <span class="whitespace-nowrap text-xs text-muted-foreground">待补瑕疵原因</span>
            <select class="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm" name="pendingDefectReason">
              <option value="" ${pendingDefectReason === '全部' ? 'selected' : ''}>全部</option>
              <option value="required" ${pendingDefectReason === '需要补齐' ? 'selected' : ''}>需要补齐</option>
              <option value="none" ${pendingDefectReason === '无需补齐' ? 'selected' : ''}>无需补齐</option>
            </select>
          </label>
        ` : ''}
        <div data-qc-filter-actions class="flex justify-end gap-2">
          <button type="button" class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-nav="${escapeHtml(resetHref)}">重置</button>
          <button type="submit" class="h-9 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700">查询</button>
        </div>
      </div>
    </form>
  `
}

function collectQuickQcInput(): { allocations: Array<{ warehouseRecordId: string; qcQty: number }>; resultsBySkuId: Map<string, Omit<PostFinishingQcSkuResult, 'qcSkuResultId' | 'skuLineId'>>; invalidMessage: string } {
  let invalidMessage = ''
  const allocations: Array<{ warehouseRecordId: string; qcQty: number }> = []
  const resultsBySkuId = new Map<string, Omit<PostFinishingQcSkuResult, 'qcSkuResultId' | 'skuLineId'>>()
  Array.from(document.querySelectorAll<HTMLElement>('[data-qc-quick-source-row]')).forEach((row) => {
    const numberOf = (selector: string) => Number((row.querySelector(selector) as HTMLInputElement | null)?.value || 0)
    const inspectedQty = numberOf('[data-qc-quick-inspected]')
    if (inspectedQty <= 0) return
    const waitQty = Number(row.dataset.waitQcQty || 0)
    const qualifiedQty = numberOf('[data-qc-quick-qualified]')
    const reworkQty = numberOf('[data-qc-quick-rework]')
    const defectAcceptedQty = numberOf('[data-qc-quick-defect]')
    if (!invalidMessage && inspectedQty > waitQty) invalidMessage = `${row.dataset.skuCode || 'SKU'} 的送检数量不能超过待质检数量`
    if (!invalidMessage && qualifiedQty > inspectedQty) invalidMessage = `${row.dataset.skuCode || 'SKU'} 的合格数量不能大于送检数量`
    if (!invalidMessage && inspectedQty !== qualifiedQty + reworkQty + defectAcceptedQty) invalidMessage = `${row.dataset.skuCode || 'SKU'} 的送检数量必须等于合格数量、返工数量、瑕疵数量之和`
    const postProjectJudgements: PostFinishingQcPostProjectJudgement[] = Array.from(row.querySelectorAll<HTMLInputElement>('[data-qc-quick-post-project]')).map((checkbox) => ({
      projectName: checkbox.value as PostFinishingQcPostProjectJudgement['projectName'],
      needed: checkbox.checked,
      qty: checkbox.checked ? qualifiedQty : 0,
      buttonAttachMode: checkbox.value === '装扣子' && checkbox.checked
        ? row.querySelector<HTMLInputElement>('[data-qc-quick-button-mode]:checked')?.value as PostFinishingQcPostProjectJudgement['buttonAttachMode'] | undefined
        : undefined,
    }))
    const needsButtonMode = postProjectJudgements.some((item) => item.projectName === '装扣子' && item.needed)
    if (!invalidMessage && needsButtonMode && !postProjectJudgements.find((item) => item.projectName === '装扣子')?.buttonAttachMode) {
      invalidMessage = `${row.dataset.skuCode || 'SKU'} 选择装扣子时必须选择人工装扣或机器装扣`
    }
    const reworkFactory = row.querySelector<HTMLSelectElement>('[data-qc-sku-rework-factory]')?.selectedOptions[0]
    const reworkReceiveFactoryId = reworkQty > 0 ? reworkFactory?.dataset.factoryId || undefined : undefined
    const reworkReceiveFactoryName = reworkQty > 0 ? reworkFactory?.dataset.factoryName || row.dataset.sourceFactoryName || undefined : undefined
    const isExternalRework = reworkQty > 0 && reworkFactory?.value !== 'source'
    const reworkDeductionUnitAmountIdr = isExternalRework ? Math.max(numberOf('[data-qc-rework-deduction-unit-amount]') || 0, 0) : 0
    const reworkDeductionAmountIdr = Math.round(reworkQty * reworkDeductionUnitAmountIdr)
    const sourceChargeback = reworkDeductionAmountIdr > 0
      ? {
          currency: 'IDR' as const,
          unitAmount: reworkDeductionUnitAmountIdr,
          amount: reworkDeductionAmountIdr,
          reason: '后道工厂接收返工' as const,
        }
      : undefined
    const defectReasonItems = Array.from(row.querySelectorAll<HTMLInputElement>('[data-qc-defect-reason]'))
      .map((input, reasonIndex) => ({
        reasonItemId: `${row.dataset.skuId || 'QC'}-QUICK-REASON-${reasonIndex + 1}`,
        reasonName: input.dataset.reasonName || '',
        qty: Number(input.value || 0),
        liabilityType: '工厂' as const,
        responsibleFactoryId: row.dataset.sourceFactoryId || undefined,
        responsibleFactoryName: row.dataset.sourceFactoryName || undefined,
      }))
      .filter((item) => item.reasonName && item.qty > 0)
    const reasonQty = defectReasonItems.reduce((sum, item) => sum + item.qty, 0)
    if (!invalidMessage && defectAcceptedQty > 0 && reasonQty !== defectAcceptedQty) {
      invalidMessage = `${row.dataset.skuCode || 'SKU'} 的瑕疵原因合计必须等于瑕疵数量`
    }
    allocations.push({ warehouseRecordId: row.dataset.warehouseRecordId || '', qcQty: inspectedQty })
    resultsBySkuId.set(row.dataset.skuId || '', {
      skuId: row.dataset.skuId || '',
      skuCode: row.dataset.skuCode || '',
      skuImageUrl: row.dataset.skuImageUrl || undefined,
      colorName: row.dataset.colorName || '',
      sizeName: row.dataset.sizeName || '',
      inspectedQty,
      qualifiedQty,
      unqualifiedQty: reworkQty + defectAcceptedQty,
      reworkQty,
      defectAcceptedQty,
      platformReasonQty: 0,
      factoryReasonQty: reworkQty + defectAcceptedQty,
      responsibleFactoryId: reworkQty + defectAcceptedQty > 0 ? row.dataset.sourceFactoryId : undefined,
      responsibleFactoryName: reworkQty + defectAcceptedQty > 0 ? row.dataset.sourceFactoryName : undefined,
      reworkReceiveFactoryId,
      reworkReceiveFactoryName,
      reworkDeductionUnitAmountIdr,
      reworkDeductionAmountIdr,
      sourceChargeback,
      defectReasonItems,
      postProjectJudgements,
      qtyUnit: row.dataset.qtyUnit || '件',
    })
  })
  if (!invalidMessage && !allocations.length) invalidMessage = '请至少填写一个 SKU 的送检数量。'
  return { allocations: allocations.filter((item) => item.warehouseRecordId), resultsBySkuId, invalidMessage }
}

function buildQuickQcResults(created: PostFinishingQcOrder, resultsBySkuId: Map<string, Omit<PostFinishingQcSkuResult, 'qcSkuResultId' | 'skuLineId'>>): PostFinishingQcSkuResult[] {
  return created.skuLines.map((line, index) => {
    const result = resultsBySkuId.get(line.skuId)
    return {
      qcSkuResultId: `${created.qcOrderId}-QUICK-${index + 1}`,
      skuLineId: line.skuLineId,
      skuId: line.skuId,
      skuCode: line.skuCode,
      skuImageUrl: line.imageUrl,
      colorName: line.colorName,
      sizeName: line.sizeName,
      inspectedQty: result?.inspectedQty ?? line.plannedQty,
      qualifiedQty: result?.qualifiedQty ?? line.plannedQty,
      unqualifiedQty: result?.unqualifiedQty ?? 0,
      reworkQty: result?.reworkQty ?? 0,
      defectAcceptedQty: result?.defectAcceptedQty ?? 0,
      platformReasonQty: 0,
      factoryReasonQty: result?.factoryReasonQty ?? 0,
      responsibleFactoryId: result?.responsibleFactoryId,
      responsibleFactoryName: result?.responsibleFactoryName,
      reworkReceiveFactoryId: result?.reworkReceiveFactoryId,
      reworkReceiveFactoryName: result?.reworkReceiveFactoryName,
      reworkDeductionUnitAmountIdr: result?.reworkDeductionUnitAmountIdr,
      reworkDeductionAmountIdr: result?.reworkDeductionAmountIdr,
      sourceChargeback: result?.sourceChargeback,
      defectReasonItems: result?.defectReasonItems ?? [],
      postProjectJudgements: result?.postProjectJudgements ?? [],
      qtyUnit: line.qtyUnit,
    }
  })
}

function navigateAfterQcSubmit(qc: PostFinishingQcOrder): void {
  if (qc.qcStatus !== '质检完成') {
    navigateInPrototype('/fcs/craft/post-finishing/qc-orders?tab=qc&pendingDefectReason=required')
    return
  }
  if (qc.generatedPostOrderId) {
    navigateInPrototype(`/fcs/craft/post-finishing/work-orders?keyword=${encodeURIComponent(qc.generatedPostOrderId)}`)
    return
  }
  if (qc.generatedRecheckOrderId) {
    navigateInPrototype(`/fcs/craft/post-finishing/recheck-orders?keyword=${encodeURIComponent(qc.generatedRecheckOrderId)}`)
    return
  }
  navigateInPrototype('/fcs/craft/post-finishing/qc-orders?tab=qc&status=质检完成')
}

function registerQcPageActions(): void {
  if (typeof window === 'undefined') return
  const win = window as Window & {
    __postCreateQcOrder?: () => void
    __postQuickInputQcScan?: (rawValue?: string) => void
    __postQuickInputQcPreview?: () => void
    __postQuickInputQcOrder?: () => void
    __postCompleteQcOrder?: (qcOrderId: string) => void
    __syncQcCompleteForm?: () => void
    __syncQuickQcInput?: () => void
  }
  win.__postQuickInputQcScan = (rawValue) => {
    const scannedOrderNo = parseProductionOrderQrValue(rawValue || listPostFinishingWaitQcSkuItems().find((item) => item.waitQcQty > 0)?.productionOrderNo || '')
    const input = document.querySelector<HTMLInputElement>('[data-qc-production-order-no]')
    if (input) input.value = scannedOrderNo
    win.__postQuickInputQcPreview?.()
  }
  win.__postQuickInputQcPreview = () => {
    const productionOrderNo = (document.querySelector('[data-qc-production-order-no]') as HTMLInputElement | null)?.value || ''
    const nextUrl = linkWith({
      inputQc: '1',
      qcProductionOrderNo: productionOrderNo,
      createQc: undefined,
      completeQc: undefined,
      viewQc: undefined,
    })
    const preview = document.querySelector<HTMLElement>('[data-qc-quick-preview]')
    if (preview) preview.innerHTML = renderQuickInputQcPreview(productionOrderNo)
    const submit = document.querySelector<HTMLButtonElement>('[data-qc-quick-submit]')
    if (submit) submit.disabled = !resolveQuickInputWaitItems(productionOrderNo).length
    window.history.pushState({}, '', nextUrl)
  }
  win.__postQuickInputQcOrder = () => {
    const station = (
      document.querySelector('[data-qc-quick-station]') as HTMLSelectElement | null
      || document.querySelector('[data-qc-create-station]') as HTMLSelectElement | null
    )?.value || '后道质检台 A'
    const { allocations, resultsBySkuId, invalidMessage } = collectQuickQcInput()
    if (invalidMessage) {
      window.alert(invalidMessage)
      return
    }
    try {
      const created = createPostFinishingQcOrder({ allocations, qcStationName: station, inspectorName: '后道质检员' })
      const qcSkuResults = buildQuickQcResults(created, resultsBySkuId)
      const hasDefectAcceptedQty = qcSkuResults.some((item) => item.defectAcceptedQty > 0)
      const submitted = hasDefectAcceptedQty
        ? submitPostFinishingPdaQcResult({ qcOrderId: created.qcOrderId, qcStationName: station, inspectorName: '后道质检员', qcSkuResults })
        : completePostFinishingQcOrder({ qcOrderId: created.qcOrderId, qcStationName: station, inspectorName: '后道质检员', qcSkuResults })
      navigateAfterQcSubmit(submitted)
    } catch (error) {
      window.alert(String(error).replace(/^Error:\s*/, '') || '录入质检数据失败。')
    }
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
      const reworkDeductionAmountIdr = Math.round(reworkQty * reworkDeductionUnitAmountIdr)
      const sourceChargeback = reworkDeductionAmountIdr > 0
        ? {
            currency: 'IDR' as const,
            unitAmount: reworkDeductionUnitAmountIdr,
            amount: reworkDeductionAmountIdr,
            reason: '后道工厂接收返工' as const,
          }
        : undefined
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
        buttonAttachMode: checkbox.value === '装扣子' && checkbox.checked
          ? fieldOf<HTMLInputElement>('[data-qc-button-mode]:checked')?.value as PostFinishingQcPostProjectJudgement['buttonAttachMode'] | undefined
          : undefined,
      }))
      const needsButtonMode = postProjectJudgements.some((item) => item.projectName === '装扣子' && item.needed)
      if (!invalidMessage && needsButtonMode && !postProjectJudgements.find((item) => item.projectName === '装扣子')?.buttonAttachMode) {
        invalidMessage = `${row.dataset.skuCode || 'SKU'} 选择装扣子时必须选择人工装扣或机器装扣`
      }
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
        reworkDeductionAmountIdr,
        sourceChargeback,
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
    let completed: ReturnType<typeof completePostFinishingQcOrder>
    try {
      completed = completePostFinishingQcOrder({
        qcOrderId,
        qcStationName: valueOf('[data-qc-complete-station]') || '后道质检台 A',
        inspectorName: '后道质检员',
        qcResult: result,
        unqualifiedDisposition: result === '全数合规' ? '' : reworkTotal > 0 ? '返修' : '让步接收',
        unqualifiedReasonSummary: result === '全数合规' ? '' : reasonSummary || `返工 ${reworkTotal}，瑕疵 ${defectAcceptedTotal}`,
        rootCauseType: result === '全数合规' ? '' : '工厂加工问题',
        responsiblePartyType: result === '全数合规' ? '' : '工厂',
        responsiblePartyName: result === '全数合规' ? '' : responsibleFactoryName,
        deductionDecisionRemark: result === '全数合规' ? '' : `后道接收返工数量 ${reworkTotal}，瑕疵数量 ${defectAcceptedTotal} 按原因追溯；扣款由对账单确认。`,
        qcSkuResults,
      })
    } catch (error) {
      window.alert(String(error).replace(/^Error:\s*/, ''))
      return
    }
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
      const buttonhole = row.querySelector<HTMLInputElement>('[data-qc-post-project][value="开扣眼"]')
      const button = row.querySelector<HTMLInputElement>('[data-qc-post-project][value="装扣子"]')
      const forceIroningAndPackaging = Boolean(buttonhole?.checked || button?.checked)
      row.querySelectorAll<HTMLInputElement>('[data-qc-post-project-lockable]').forEach((checkbox) => {
        checkbox.checked = forceIroningAndPackaging || checkbox.checked
        checkbox.disabled = forceIroningAndPackaging
      })
      row.querySelectorAll<HTMLInputElement>('[data-qc-button-mode]').forEach((radio) => {
        radio.disabled = !button?.checked
        if (!button?.checked) radio.checked = false
      })
    })
  }
  win.__syncQuickQcInput = () => {
    document.querySelectorAll<HTMLElement>('[data-qc-quick-source-row]').forEach((row) => {
      const button = row.querySelector<HTMLInputElement>('[data-qc-quick-post-project][value="装扣子"]')
      const buttonhole = row.querySelector<HTMLInputElement>('[data-qc-quick-post-project][value="开扣眼"]')
      const forceIroningAndPackaging = Boolean(button?.checked || buttonhole?.checked)
      row.querySelectorAll<HTMLInputElement>('[data-qc-quick-post-project-lockable]').forEach((checkbox) => {
        checkbox.checked = forceIroningAndPackaging || checkbox.checked
        checkbox.disabled = forceIroningAndPackaging
      })
      row.querySelectorAll<HTMLInputElement>('[data-qc-quick-button-mode]').forEach((radio) => {
        radio.disabled = !button?.checked
        if (!button?.checked) radio.checked = false
      })
      const reworkQty = Number(row.querySelector<HTMLInputElement>('[data-qc-quick-rework]')?.value || 0)
      const reworkFactory = row.querySelector<HTMLSelectElement>('[data-qc-sku-rework-factory]')
      const deductionUnitAmount = row.querySelector<HTMLInputElement>('[data-qc-rework-deduction-unit-amount]')
      if (deductionUnitAmount) {
        const disabled = reworkQty <= 0 || reworkFactory?.value === 'source'
        deductionUnitAmount.disabled = disabled
        if (disabled) deductionUnitAmount.value = ''
      }
    })
  }
}

function renderPageHeader(): string {
  const task = getCurrentPostTaskId() ? getPostFinishingTaskById(getCurrentPostTaskId()) : undefined
  const actions = [
    task
      ? `<button type="button" class="rounded-md border px-3 py-2 text-sm font-medium hover:bg-slate-50" data-nav="${escapeHtml(buildUnifiedPrintPreviewLink({ documentType: 'PRODUCTION_QC_MASTER', sourceType: 'POST_FINISHING_TASK', sourceId: task.postTaskId }))}">打印生产单质检总单</button>`
      : '',
    `<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-nav="${escapeHtml(linkWith({ inputQc: '1', createQc: undefined, completeQc: undefined, viewQc: undefined }))}">创建质检单</button>`,
  ].filter(Boolean).join('')
  const header = renderPostFinishingPageHeader(
    '质检单',
    task ? `${task.postTaskNo} / ${task.productionOrderNo}` : '',
    `<div class="flex flex-wrap gap-2">${actions}</div>`,
  )
  if (!task) return header
  return `${header}
    <div class="rounded-lg border bg-slate-50 px-4 py-3 text-sm">
      <span class="text-xs text-muted-foreground">生产单质检总单</span>
      <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        <span>质检总单：${renderQcMasterOrderCode(task.postTaskNo || task.postTaskId, task.productionOrderNo, task.postTaskNo || task.postTaskId)}</span>
        <span>生产单：${renderProductionOrderCode(task.productionOrderNo)}</span>
      </div>
    </div>`
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

function renderQuickQcSkuRow(item: PostFinishingWaitQcSkuItem, index: number, checked = false): string {
  const locationLabel = item.locationCode ? `${item.areaName || '未分区'} / ${item.locationCode}` : item.areaName || '未分区'
  const targetFactoryName = getPostFinishingTaskById(item.postTaskId)?.managedPostFactoryName || '当前后道工厂'
  const reasonInputs = POST_FINISHING_QC_DEFECT_REASONS.map((reason) => `
    <label class="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] items-center gap-2 text-xs">
      <span class="text-muted-foreground">${escapeHtml(reason)}</span>
      <input class="h-8 min-w-0 rounded-md border px-2 text-sm" type="number" min="0" step="1" data-qc-defect-reason data-reason-name="${escapeHtml(reason)}" />
    </label>
  `).join('')
  return `
    <article
      data-qc-quick-source-row
      data-warehouse-record-id="${escapeHtml(item.warehouseRecordId)}"
      data-wait-qc-qty="${item.waitQcQty}"
      data-sku-id="${escapeHtml(item.skuId)}"
      data-sku-code="${escapeHtml(item.skuCode)}"
      data-sku-image-url="${escapeHtml(item.skuImageUrl || '')}"
      data-color-name="${escapeHtml(item.colorName)}"
      data-size-name="${escapeHtml(item.sizeName)}"
      data-source-factory-id=""
      data-source-factory-name="${escapeHtml(item.sourceFactoryName)}"
      data-qty-unit="${escapeHtml(item.qtyUnit)}"
      class="space-y-4 rounded-xl border bg-white p-4 ${checked ? 'ring-1 ring-blue-200' : ''}"
    >
      <div class="flex min-w-0 gap-3">
        <img class="h-14 w-14 rounded-lg border object-cover" src="${escapeHtml(item.skuImageUrl || 'https://placehold.co/96x96?text=SKU')}" alt="${escapeHtml(item.skuCode)}" />
        <div class="min-w-0 flex-1">
          <div class="text-xs text-muted-foreground">商品图片</div>
          <div class="mt-1 text-sm font-semibold">${escapeHtml(item.skuCode)}</div>
          <div class="text-xs text-muted-foreground">${escapeHtml(item.colorName)} / ${escapeHtml(item.sizeName)}</div>
          <div class="mt-1 text-xs text-muted-foreground">${renderProductionOrderIdentityCell(item.productionOrderNo)} / ${escapeHtml(item.sourceTaskNo)}</div>
        </div>
        <div class="text-right text-xs text-muted-foreground">
          <div>${escapeHtml(item.sourceFactoryName)}</div>
          <div>${escapeHtml(locationLabel)}</div>
        </div>
      </div>
      <div class="space-y-3 rounded-lg bg-slate-50 p-3">
        <div class="text-xs font-medium text-muted-foreground">质检与返工</div>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label class="space-y-1 text-sm"><span class="text-xs text-muted-foreground">送检数量</span><input class="h-9 w-full rounded-md border px-2 text-sm" data-qc-quick-inspected type="number" min="0" max="${item.waitQcQty}" value="${item.waitQcQty}" /></label>
          <label class="space-y-1 text-sm"><span class="text-xs text-muted-foreground">合格数量</span><input class="h-9 w-full rounded-md border px-2 text-sm" data-qc-quick-qualified type="number" min="0" value="${item.waitQcQty}" /></label>
          <label class="space-y-1 text-sm"><span class="text-xs text-muted-foreground">返工数量</span><input class="h-9 w-full rounded-md border px-2 text-sm" data-qc-quick-rework type="number" min="0" value="" oninput="window.__syncQuickQcInput()" /></label>
          <label class="space-y-1 text-sm"><span class="text-xs text-muted-foreground">返工接收工厂</span><select class="h-9 w-full rounded-md border px-2 text-sm" data-qc-sku-rework-factory onchange="window.__syncQuickQcInput()">
            <option value="source" data-factory-id="" data-factory-name="${escapeHtml(item.sourceFactoryName)}">原工厂（${escapeHtml(item.sourceFactoryName)}）</option>
            <option value="post" data-factory-id="" data-factory-name="${escapeHtml(targetFactoryName)}">当前后道工厂（${escapeHtml(targetFactoryName)}）</option>
          </select></label>
          <label class="space-y-1 text-sm"><span class="text-xs text-muted-foreground">返工扣款单价（IDR）</span><input class="h-9 w-full rounded-md border px-2 text-sm" data-qc-rework-deduction-unit-amount type="number" min="0" step="1" value="" /></label>
        </div>
        <p class="text-xs text-muted-foreground">返工接收工厂不是原工厂时填写返工扣款；对账单确认后才影响本期应付。</p>
      </div>
      <div class="space-y-3 rounded-lg bg-slate-50 p-3">
        <div class="text-xs font-medium text-muted-foreground">瑕疵与后道</div>
        <div class="grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)_260px]">
          <label class="space-y-1 text-sm"><span class="text-xs text-muted-foreground">瑕疵数量</span><input class="h-9 w-full rounded-md border px-2 text-sm" data-qc-quick-defect type="number" min="0" value="" /></label>
          <div class="min-w-0 space-y-1">
            <div class="text-xs text-muted-foreground">瑕疵原因</div>
            <div class="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">${reasonInputs}</div>
          </div>
          <div class="space-y-1">
            <div class="text-xs text-muted-foreground">后道项目</div>
            <div class="grid gap-2 sm:grid-cols-2">
              ${QC_POST_PROJECTS.map((project) => {
                const lockable = project === '熨烫' || project === '包装'
                return `<label class="flex items-center gap-2 rounded-md border bg-white px-2 py-1.5 text-xs">
                  <input type="checkbox" data-qc-quick-post-project ${lockable ? 'data-qc-quick-post-project-lockable="1"' : ''} value="${escapeHtml(project)}" onchange="window.__syncQuickQcInput()" />
                  <span>${escapeHtml(project)}</span>
                </label>`
              }).join('')}
              <div class="col-span-full grid gap-2 rounded-md border bg-white p-2 text-xs sm:grid-cols-2">
                <label class="flex items-center gap-2"><input type="radio" name="quick-button-mode-${escapeHtml(item.waitQcSkuKey)}-${index}" value="人工装扣" data-qc-quick-button-mode disabled /><span>人工装扣</span></label>
                <label class="flex items-center gap-2"><input type="radio" name="quick-button-mode-${escapeHtml(item.waitQcSkuKey)}-${index}" value="机器装扣" data-qc-quick-button-mode disabled /><span>机器装扣</span></label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  `
}

function resolveQuickInputWaitItems(productionOrderNo: string): PostFinishingWaitQcSkuItem[] {
  const matchedWaitItems = productionOrderNo ? listPostFinishingWaitQcSkuItems({ productionOrderNo }).filter((item) => item.waitQcQty > 0) : []
  return productionOrderNo
    ? matchedWaitItems.length ? matchedWaitItems : listPostFinishingWaitQcSkuItems().filter((item) => item.waitQcQty > 0)
    : []
}

function renderQuickInputQcPreview(productionOrderNo: string): string {
  const waitItems = resolveQuickInputWaitItems(productionOrderNo)
  const grouped = waitItems.reduce((map, item) => {
    const key = `${item.productionOrderNo}__${item.spuId}`
    const rows = map.get(key) || []
    rows.push(item)
    map.set(key, rows)
    return map
  }, new Map<string, PostFinishingWaitQcSkuItem[]>())
  const firstTask = getPostFinishingTaskById(waitItems[0]?.postTaskId || '')
  const summary = waitItems.length
    ? `<div class="grid gap-3 md:grid-cols-5">
        ${renderReadonlyField('生产单号', productionOrderNo)}
        ${renderReadonlyField('待质检 SKU', `${waitItems.length} 个`)}
        ${renderReadonlyField('待质检数量', formatGarmentQty(waitItems.reduce((sum, item) => sum + item.waitQcQty, 0), waitItems[0]?.qtyUnit || '件'))}
        ${renderReadonlyField('生产时间', firstTask?.createdAt || '—')}
        ${renderReadonlyField('后道工厂', firstTask?.managedPostFactoryName || '当前后道工厂')}
      </div>`
    : ''
  const groups = Array.from(grouped.values()).map((items) => {
    const first = items[0]
    const task = getPostFinishingTaskById(first.postTaskId)
    const rows = items.map((item, index) => renderQuickQcSkuRow(item, index)).join('')
    return `
      <section class="space-y-3 rounded-xl border bg-slate-50 p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div class="text-sm font-semibold">${escapeHtml(first.spuName)}</div>
            <div class="text-xs text-muted-foreground">${escapeHtml(first.spuCode)} / 质检总单 ${renderQcMasterOrderCode(first.postTaskNo || first.postTaskId, first.productionOrderNo, first.postTaskNo || first.postTaskId)}</div>
          </div>
          <div class="text-xs text-muted-foreground">${escapeHtml(task?.managedPostFactoryName || '当前后道工厂')} / 来源 ${escapeHtml(first.sourceFactoryName)}</div>
        </div>
        <div class="space-y-3">${rows}</div>
      </section>
    `
  }).join('')
  return `
    ${summary}
    ${groups || (!productionOrderNo ? '<div class="rounded-xl border bg-slate-50 px-4 py-8 text-center text-sm text-muted-foreground">输入生产单号后展示待质检 SKU</div>' : '')}
  `
}

function renderQuickInputQcDialog(): string {
  if (!isQuickInputDialogOpen()) return ''
  const productionOrderNo = getQuickProductionOrderNo()
  const waitItems = resolveQuickInputWaitItems(productionOrderNo)
  return renderModal('创建质检单', `
    <div data-qc-quick-input-dialog class="space-y-4">
      <div class="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <input type="hidden" name="inputQc" value="1" />
        <label class="space-y-1 text-sm">
          <span class="text-xs text-muted-foreground">条码/二维码 / 生产单号</span>
          <input class="h-10 w-full rounded-md border px-3 text-sm" data-qc-production-order-no name="qcProductionOrderNo" value="${escapeHtml(productionOrderNo)}" placeholder="扫描条码/二维码，或输入生产单号" />
        </label>
        <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-slate-50" onclick="window.__postQuickInputQcScan()"><i data-lucide="scan-line" class="h-4 w-4"></i>扫码读取条码/二维码</button>
        <button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" onclick="window.__postQuickInputQcPreview()">查看</button>
        <button type="button" class="h-10 rounded-md border px-4 text-sm hover:bg-slate-50" data-nav="${escapeHtml(linkWith({ inputQc: '1', qcProductionOrderNo: undefined }))}">重置</button>
      </div>
      <div data-qc-quick-preview class="space-y-4">${renderQuickInputQcPreview(productionOrderNo)}</div>
      <div class="flex justify-end gap-2">
        <button class="rounded-md border px-3 py-2 text-sm" data-nav="${escapeHtml(closeDialogLink())}">取消</button>
        <button data-qc-quick-submit class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" ${waitItems.length ? 'onclick="window.__postQuickInputQcOrder()"' : 'disabled'}>确认完成质检</button>
      </div>
    </div>
  `)
}

function renderCreateQcDialog(): string {
  if (!isCreateDialogOpen()) return ''
  const postTaskId = getCurrentPostTaskId() || undefined
  const waitItems = listPostFinishingWaitQcSkuItems({ postTaskId }).filter((item) => item.waitQcQty > 0)
  const task = postTaskId ? getPostFinishingTaskById(postTaskId) : undefined
  const selectedKey = currentParams().get('createQc') || ''
  const rows = waitItems.map((item, index) => {
    const checked = item.waitQcSkuKey === selectedKey || item.warehouseRecordId === selectedKey
    return renderQuickQcSkuRow(item, index, checked)
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
          <div class="mt-1 font-medium text-foreground">${task ? `${renderQcMasterOrderCode(task.postTaskNo || task.postTaskId, task.productionOrderNo, task.postTaskNo || task.postTaskId)} / ${renderProductionOrderCode(task.productionOrderNo)}` : '同一张质检单只能选择同一生产单下的同一款式 SKU'}</div>
        </div>
      </div>
      <div class="space-y-3">${rows || '<div class="rounded-xl border bg-slate-50 px-4 py-8 text-center text-sm text-muted-foreground">暂无可创建质检单的库存 SKU</div>'}</div>
      <div class="flex justify-end gap-2">
        <button class="rounded-md border px-3 py-2 text-sm" data-nav="${escapeHtml(closeDialogLink())}">取消</button>
        <button class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" ${rows ? 'onclick="window.__postQuickInputQcOrder()"' : 'disabled'}>确认完成质检</button>
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
    const selectedButtonMode = result.postProjectJudgements.find((item) => item.projectName === '装扣子')?.buttonAttachMode
    const forceIroningAndPackaging = checkedProjects.has('开扣眼') || checkedProjects.has('装扣子')
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
            <label class="space-y-1 text-sm"><span class="text-xs text-muted-foreground">返工扣款单价（IDR）</span><input class="h-9 w-full rounded-md border px-2 text-sm" type="number" min="0" step="1" data-qc-defect-field="1" data-qc-rework-deduction-unit-amount value="${reworkDeductionUnitAmountIdr || ''}" ${deductionDisabledAttr} /></label>
          </div>
          <p class="text-xs text-muted-foreground">返工接收工厂不是原工厂时填写返工扣款；对账单确认后才影响本期应付。</p>
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
            ${QC_POST_PROJECTS.map((project) => {
              const lockable = project === '熨烫' || project === '包装'
              const checked = lockable && forceIroningAndPackaging ? true : checkedProjects.has(project)
              const disabled = lockable && forceIroningAndPackaging
              return `
                <label class="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
                  <input type="checkbox" data-qc-post-project ${lockable ? 'data-qc-post-project-lockable="1"' : ''} value="${escapeHtml(project)}" onchange="window.__syncQcCompleteForm()" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
                  <span>${escapeHtml(project)}</span>
                </label>
                ${project === '装扣子' ? `
                  <div class="col-span-full grid gap-2 rounded-md border bg-white p-2 text-xs sm:grid-cols-2">
                    <label class="flex items-center gap-2">
                      <input type="radio" name="button-mode-${escapeHtml(result.qcSkuResultId)}" value="人工装扣" data-qc-button-mode="manual" ${selectedButtonMode === '人工装扣' ? 'checked' : ''} ${checkedProjects.has('装扣子') ? '' : 'disabled'} />
                      <span>人工装扣</span>
                    </label>
                    <label class="flex items-center gap-2">
                      <input type="radio" name="button-mode-${escapeHtml(result.qcSkuResultId)}" value="机器装扣" data-qc-button-mode="machine" ${selectedButtonMode === '机器装扣' ? 'checked' : ''} ${checkedProjects.has('装扣子') ? '' : 'disabled'} />
                      <span>机器装扣</span>
                    </label>
                  </div>
                ` : ''}
              `
            }).join('')}
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
  const snapshot = buildPostFinishingQcDeductionRecord(record)
  const productionOrderNo = resolveRecordProductionOrderNo(record, snapshot)
  const result = deriveQcResultFromRecord(record)
  const isAllGood = result === '全数合规'
  return renderModal('完成质检', `
    <div class="space-y-5">
      <div class="grid gap-3 lg:grid-cols-3">
        ${renderReadonlyHtmlField('质检单号', renderQcOrderCode(record.actionRecordNo, productionOrderNo))}
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

function formatPostProjectJudgement(item: PostFinishingQcPostProjectJudgement): string {
  return item.projectName === '装扣子' && item.buttonAttachMode
    ? `${item.projectName}（${item.buttonAttachMode}）`
    : item.projectName
}

function summarizeButtonAttachModes(record: PostFinishingActionRecord): string {
  const modes = normalizeRecordSkuResults(record)
    .flatMap((result) => result.postProjectJudgements)
    .filter((item) => item.projectName === '装扣子' && item.needed && item.qty > 0)
    .map((item) => item.buttonAttachMode || '未选择')
  return uniqueText(modes)
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

function getPendingDefectReasonQty(record: PostFinishingActionRecord): number {
  return normalizeRecordSkuResults(record).reduce((sum, result) => {
    const reasonQty = (result.defectReasonItems || []).reduce((reasonSum, item) => reasonSum + (Number(item.qty) || 0), 0)
    return sum + Math.max((Number(result.defectAcceptedQty) || 0) - reasonQty, 0)
  }, 0)
}

function formatIdrAmount(value: number | undefined): string {
  const amount = Number(value || 0)
  return amount > 0 ? `${Math.round(amount).toLocaleString('id-ID')} 印尼盾` : '—'
}

function summarizeReworkDeductionAmount(record: PostFinishingActionRecord): string {
  const amount = normalizeRecordSkuResults(record).reduce((sum, result) => sum + (Number(result.reworkDeductionAmountIdr) || 0), 0)
  return formatIdrAmount(amount)
}

function resolveQcMasterPrintSourceId(record: PostFinishingActionRecord, snapshot?: ReturnType<typeof buildPostFinishingQcDeductionRecord>): string {
  return record.warehouseAllocations?.find((allocation) => allocation.postTaskId)?.postTaskId
    || snapshot?.refTaskId
    || snapshot?.productionOrderNo
    || ''
}

function resolveRecordProductionOrderNo(record: PostFinishingActionRecord, snapshot?: ReturnType<typeof buildPostFinishingQcDeductionRecord>): string {
  return snapshot?.productionOrderNo || record.warehouseAllocations?.[0]?.productionOrderNo || ''
}

function resolveRecordPostTask(record: PostFinishingActionRecord, snapshot?: ReturnType<typeof buildPostFinishingQcDeductionRecord>): ReturnType<typeof getPostFinishingTaskById> {
  const postTaskId = record.warehouseAllocations?.find((allocation) => allocation.postTaskId)?.postTaskId
    || snapshot?.refTaskId
    || snapshot?.taskId
    || ''
  return postTaskId ? getPostFinishingTaskById(postTaskId) : undefined
}

function resolveRecordRecheckOrder(record: PostFinishingActionRecord): ReturnType<typeof getPostFinishingRecheckOrderById> {
  const qcOrder = listPostFinishingQcOrderEntities().find((item) => item.qcOrderId === record.actionRecordId || item.qcOrderNo === record.actionRecordNo)
  const recheckOrderId = qcOrder?.generatedRecheckOrderId || record.linkedRecheckOrderId || ''
  return recheckOrderId ? getPostFinishingRecheckOrderById(recheckOrderId) : undefined
}

function resolveRecordQcOrder(record: PostFinishingActionRecord): PostFinishingQcOrder | undefined {
  return listPostFinishingQcOrderEntities().find((item) => item.qcOrderId === record.actionRecordId || item.qcOrderId === record.linkedQcOrderId || item.qcOrderNo === record.actionRecordNo)
}

function renderMasterPrintButton(record: PostFinishingActionRecord, snapshot?: ReturnType<typeof buildPostFinishingQcDeductionRecord>): string {
  const sourceId = resolveQcMasterPrintSourceId(record, snapshot)
  if (!sourceId) return ''
  return `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${escapeHtml(buildUnifiedPrintPreviewLink({ documentType: 'PRODUCTION_QC_MASTER', sourceType: 'POST_FINISHING_TASK', sourceId }))}">打印生产单质检总单</button>`
}

function renderPrintButton(record: PostFinishingActionRecord): string {
  return `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${escapeHtml(buildUnifiedPrintPreviewLink({ documentType: 'POST_FINISHING_QC_ORDER', sourceType: 'POST_FINISHING_QC_ORDER', sourceId: record.actionId }))}">打印质检单</button>`
}

function renderViewDialog(): string {
  const recordId = getViewId()
  if (!recordId) return ''
  const record = listPostFinishingQcOrders().find((item) => item.actionRecordId === recordId)
  if (!record) return renderModal('质检单详情', '<div class="text-sm text-muted-foreground">未找到质检单</div>')
  const snapshot = buildPostFinishingQcDeductionRecord(record)
  const productionOrderNo = resolveRecordProductionOrderNo(record, snapshot)
  const task = resolveRecordPostTask(record, snapshot)
  const recheckOrder = resolveRecordRecheckOrder(record)
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
    const projectSummary = result.postProjectJudgements.filter((item) => item.needed).map(formatPostProjectJudgement).join('、') || '—'
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
          <div><div class="text-xs text-muted-foreground">返工扣款单价</div><div class="mt-1 text-sm font-medium">${escapeHtml(formatIdrAmount(result.sourceChargeback?.unitAmount ?? result.reworkDeductionUnitAmountIdr))}</div></div>
          <div><div class="text-xs text-muted-foreground">返工扣款金额</div><div class="mt-1 text-sm font-medium">${escapeHtml(formatIdrAmount(result.sourceChargeback?.amount ?? result.reworkDeductionAmountIdr))}</div></div>
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
        ${renderReadonlyHtmlField('质检单号', renderQcOrderCode(record.actionRecordNo, productionOrderNo))}
        ${task ? renderReadonlyHtmlField('生产单质检总单', renderQcMasterOrderCode(task.postTaskNo || task.postTaskId, task.productionOrderNo, task.postTaskNo || task.postTaskId)) : ''}
        ${productionOrderNo ? renderReadonlyHtmlField('生产单号', renderProductionOrderCode(productionOrderNo)) : ''}
        ${recheckOrder ? renderReadonlyHtmlField('复检单号', renderRecheckOrderCode(recheckOrder.recheckOrderNo, recheckOrder.productionOrderNo)) : ''}
        ${renderReadonlyField('质检台', record.qcStationName || '—')}
        ${renderReadonlyField('质检状态', record.status)}
        ${renderReadonlyField('质检数量', formatGarmentQty(record.inspectedGarmentQty ?? record.submittedGarmentQty, record.qtyUnit))}
        ${renderReadonlyField('合格数量', formatGarmentQty(record.passedGarmentQty ?? record.acceptedGarmentQty, record.qtyUnit))}
        ${renderReadonlyField('返工数量', formatGarmentQty(record.reworkGarmentQty ?? 0, record.qtyUnit))}
        ${renderReadonlyField('返工接收工厂', summarizeReworkFactories(record))}
        ${renderReadonlyField('返工扣款金额', summarizeReworkDeductionAmount(record))}
        ${renderReadonlyField('瑕疵数量', formatGarmentQty(record.defectAcceptedGarmentQty ?? 0, record.qtyUnit))}
        ${renderReadonlyField('瑕疵原因', summarizeDefectReasons(record))}
        ${renderReadonlyField('后道接收返工数量', formatGarmentQty(snapshot?.processingFeeDeductionQty ?? record.processingFeeDeductionQty ?? 0, record.qtyUnit))}
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
      <div class="flex flex-wrap justify-end gap-2">${renderMasterPrintButton(record, snapshot)}${renderPrintButton(record)}</div>
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
        <td class="px-3 py-3 text-sm">${renderProductionOrderIdentityCell(item.productionOrderNo)}<div class="text-xs text-muted-foreground">质检总单：${renderQcMasterOrderCode(item.postTaskNo || item.postTaskId, item.productionOrderNo, item.postTaskNo || item.postTaskId)}</div><div class="text-xs text-muted-foreground">上游任务：${escapeHtml(item.sourceTaskNo)}</div></td>
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
    const pendingDefectReasonQty = getPendingDefectReasonQty(record)
    const skuSummary = record.skuLines.map((line) => `${line.skuCode}/${line.colorName}/${line.sizeName}`).join('、')
    const productionOrderNo = resolveRecordProductionOrderNo(record, snapshot)
    const task = resolveRecordPostTask(record, snapshot)
    const recheckOrder = resolveRecordRecheckOrder(record)
    return `
      <article data-qc-list-card class="rounded-xl border bg-white p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="font-mono text-xs text-muted-foreground">${renderQcOrderCode(record.actionRecordNo, productionOrderNo)}</div>
            <div class="mt-1 text-sm font-semibold">${escapeHtml(record.postOrderNo)} · ${escapeHtml(record.qcStationName || '—')}</div>
            <div class="mt-2">${renderProductionOrderIdentityCell(productionOrderNo || '—')}</div>
            ${task ? `<div class="mt-1 text-xs text-muted-foreground">质检总单：${renderQcMasterOrderCode(task.postTaskNo || task.postTaskId, task.productionOrderNo, task.postTaskNo || task.postTaskId)}</div>` : ''}
            ${recheckOrder ? `<div class="mt-1 text-xs text-muted-foreground">复检单：${renderRecheckOrderCode(recheckOrder.recheckOrderNo, recheckOrder.productionOrderNo)}</div>` : ''}
          </div>
          <div class="flex flex-wrap items-center gap-2">
            ${renderPostStatusBadge(record.status)}
            ${pendingDefectReasonQty > 0 ? '<span class="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">待补瑕疵原因</span>' : ''}
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
            <div class="col-span-2"><div class="text-xs text-muted-foreground">后道接收返工数量</div><div class="font-medium">${formatGarmentQty(snapshot?.processingFeeDeductionQty ?? record.processingFeeDeductionQty ?? 0, record.qtyUnit)}</div></div>
          </div>
          <div class="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
            <div><span class="text-xs text-muted-foreground">返工接收工厂</span><div class="mt-1">${escapeHtml(summarizeReworkFactories(record))}</div></div>
            <div><span class="text-xs text-muted-foreground">返工扣款金额</span><div class="mt-1">${escapeHtml(summarizeReworkDeductionAmount(record))}</div></div>
            <div><span class="text-xs text-muted-foreground">瑕疵原因</span><div class="mt-1 break-words">${escapeHtml(pendingDefectReasonQty > 0 ? `待补瑕疵原因，还差 ${pendingDefectReasonQty} 件` : summarizeDefectReasons(record))}</div></div>
            <div><span class="text-xs text-muted-foreground">装扣方式</span><div class="mt-1">${escapeHtml(summarizeButtonAttachModes(record))}</div></div>
            <div><span class="text-xs text-muted-foreground">质检人</span><div class="mt-1">${escapeHtml(record.operatorName || '—')}</div></div>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap justify-end gap-2">${canFinish ? renderPostAction(pendingDefectReasonQty > 0 ? '补齐瑕疵原因' : '完成质检', linkWith({ completeQc: record.actionRecordId, viewQc: undefined, createQc: undefined })) : ''}${renderPostAction('查看质检单', linkWith({ viewQc: record.actionRecordId, completeQc: undefined, createQc: undefined }))}${renderMasterPrintButton(record, snapshot)}${renderPrintButton(record)}</div>
      </article>
    `
  }).join('')
}

function filterQc(
  records: PostFinishingActionRecord[],
  filters: ReturnType<typeof getPostListFilters>,
  buttonMode: ButtonModeFilter,
  pendingDefectReason: PendingDefectReasonFilter,
): PostFinishingActionRecord[] {
  return records.filter((record) => {
    if (filters.source !== '全部' && filters.source !== '质检单') return false
    if (filters.status !== '全部' && record.status !== filters.status) return false
    if (filters.factory !== '全部' && record.targetFactoryName !== filters.factory) return false
    const hasPendingDefectReason = getPendingDefectReasonQty(record) > 0
    if (pendingDefectReason === '需要补齐' && !hasPendingDefectReason) return false
    if (pendingDefectReason === '无需补齐' && hasPendingDefectReason) return false
    const buttonModes = summarizeButtonAttachModes(record)
    if (buttonMode !== '全部' && !buttonModes.includes(buttonMode)) return false
    const qcOrder = resolveRecordQcOrder(record)
    return postFilterTextMatches(filters.keyword, [record.actionRecordNo, record.postOrderNo, qcOrder?.postTaskId, qcOrder?.postTaskNo, qcOrder?.productionOrderNo, record.sourceFactoryName, record.targetFactoryName, record.qcStationName, record.skuLines[0]?.spuCode, record.skuLines[0]?.spuName, record.status, buttonModes])
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
    !postTaskId || resolveRecordQcOrder(record)?.postTaskId === postTaskId || record.warehouseAllocations?.some((allocation) => allocation.postTaskId === postTaskId)
  ))
  const activeTab = getActiveQcTab()
  const buttonMode = getButtonModeFilter()
  const pendingDefectReason = getPendingDefectReasonFilter()
  const filteredWaitItems = filterWaitQc(waitItems, filters)
  const filteredQc = filterQc(allQc, filters, buttonMode, pendingDefectReason)
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
      ${renderQcTabs(activeTab, filteredWaitItems.length, filteredQc.length)}
      ${renderQcFilterPanel({
        filters,
        activeTab,
        statusOptions: activeTab === 'wait' ? [] : allQc.map((item) => item.status),
        sourceOptions: activeTab === 'wait' ? waitItems.map((item) => item.sourceFactoryType) : ['质检单'],
        factoryOptions: [...waitItems.map((item) => item.sourceFactoryName), ...allQc.map((item) => item.targetFactoryName)],
      })}
      ${activeSection}
      ${renderQuickInputQcDialog()}
      ${renderCreateQcDialog()}
      ${renderCompleteQcDialog()}
      ${renderViewDialog()}
    </div>
  `
}

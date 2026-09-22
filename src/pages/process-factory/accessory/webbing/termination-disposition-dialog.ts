import { renderDialog } from '../../../../components/ui/dialog.ts'
import { hydrateIcons } from '../../../../components/shell.ts'
import { escapeHtml as e } from '../../../../utils.ts'
import {
  closeTmfTermination, getTmfTerminationReview, retainTmfFrozenPackage, scrapTmfContinuousRemaining, scrapTmfDefectiveOutput, scrapTmfFactoryCutPieces,
  scrapTmfFrozenPackage, writeOffTmfProductionTransit, writeOffTmfUpstreamTransit,
  type TmfPurchaseActor, type TmfTerminationItem,
} from '../../../../data/pms/tmf-material-purchases.ts'

const prefix = 'tmf-termination'
const planner: TmfPurchaseActor = { id: 'TMF-DEMO-PLAN', name: '生产计划（演示）', role: '生产计划' }
const factorySupervisor: TmfPurchaseActor = { id: 'TMF-DEMO-SUPERVISOR', name: '织带厂主管（演示）', role: '织带厂主管' }
const warehouseSupervisor: TmfPurchaseActor = { id: 'TMF-DEMO-WAREHOUSE-SUPERVISOR', name: '仓库主管（演示）', role: '仓库主管' }
const button = (action: string, label: string, id = '') => `<button type="button" class="rounded border px-3 py-2 text-xs ${['confirm-item', 'confirm-close', 'pick-close'].includes(action) ? 'bg-blue-600 text-white' : ''}" data-${prefix}-action="${action}" data-id="${e(id)}" data-skip-page-rerender="true">${label}</button>`

const labels: Record<TmfTerminationItem['category'], string> = {
  CONTINUOUS_REMAINING: '厂内连续余料', FACTORY_CUT: '厂内在制条料', DEFECTIVE: '待处置不良',
  FROZEN_PACKAGE: '冻结产出', UPSTREAM_TRANSIT: '上游未收在途', PRODUCTION_TRANSIT: '生产领料在途',
}

/** 终止处置台：逐项决定实物与在途去向，未处置不得结案。 */
export function openTmfTerminationDispositionDialog(surface: HTMLElement, productionOrderId: string, onDone: () => void): void {
  let selectedKey = ''
  const itemKey = (item: TmfTerminationItem) => JSON.stringify([item.category, item.objectId, item.tipResultId ?? null])
  let action = '' as '' | 'SCRAP' | 'TRANSIT_WRITE_OFF' | 'RETAIN_FROZEN' | 'CLOSE'
  let operationId = ''
  let message = ''
  const root = () => surface.querySelector<HTMLElement>(`[data-${prefix}-root]`)
  const fail = (text: string) => { message = text; render() }
  const close = () => { surface.replaceChildren(); onDone() }

  const itemActions = (item: TmfTerminationItem) => {
    if (selectedKey !== itemKey(item)) return item.actions.map((candidate) => button(candidate === 'SCRAP' ? 'pick-scrap' : candidate === 'RETAIN_FROZEN' ? 'pick-retain' : 'pick-writeoff', candidate === 'SCRAP' ? '报废' : candidate === 'RETAIN_FROZEN' ? '受控保留' : '确认在途去向', item.objectId)).join('')
    const fields = action === 'TRANSIT_WRITE_OFF'
      ? `<label class="block text-sm mt-2">去向原因<input name="reason" class="mt-1 w-full rounded border p-2" data-skip-page-rerender="true"></label><label class="flex gap-2 text-sm mt-2"><input name="confirmed" type="checkbox" data-skip-page-rerender="true">已核对差异数量与去向，确认结清本项待处置</label>`
      : `<label class="block text-sm mt-2">本次${action === 'RETAIN_FROZEN' ? '保留' : '报废'}数量（${e(item.unit)}）<input name="quantity" type="number" min="1" step="1" value="${item.quantity}" class="mt-1 w-full rounded border p-2" data-skip-page-rerender="true" ${action === 'RETAIN_FROZEN' ? 'readonly' : ''}></label><label class="block text-sm mt-2">${action === 'RETAIN_FROZEN' ? '保留原因' : '报废原因'}<input name="reason" class="mt-1 w-full rounded border p-2" data-skip-page-rerender="true"></label><label class="flex gap-2 text-sm mt-2"><input name="confirmed" type="checkbox" data-skip-page-rerender="true">已核对实物与数量，确认${action === 'RETAIN_FROZEN' ? '受控保留待后续处置' : '实际报废'}</label>`
    return `${fields}<div class="flex gap-2 mt-2">${button('confirm-item', '确认')}${button('cancel-item', '取消')}</div>`
  }

  const render = () => {
    let review: ReturnType<typeof getTmfTerminationReview> | null = null
    let reviewError = ''
    try { review = getTmfTerminationReview(productionOrderId) } catch (error) { reviewError = error instanceof Error ? error.message : '终止处置读取失败。' }
    const items = review?.items ?? []
    const content = `<div data-${prefix}-root class="max-h-[64vh] overflow-y-auto space-y-3">
      <p class="text-sm">操作身份：生产计划（演示）；实物报废与保留按保管方主管身份登记（当前演示）。</p>
      <p class="text-sm">主单状态：${e(review?.controlStatus ?? '未知')}；${review?.closure ? `已于 ${e(review.closure.occurredAt)} 结案（${e(review.closure.reason)}）` : `待处置 ${items.length} 项${(review?.shortagePieces ?? 0) > 0 ? `；生产需求缺口 ${review!.shortagePieces} 条/根` : ''}`}</p>
      ${reviewError ? `<p class="text-sm text-red-700">${e(reviewError)}</p>` : ''}
      ${items.length ? items.map((item) => `<article class="rounded border p-3" data-termination-item="${e(item.objectId)}">
        <div class="flex flex-wrap items-center justify-between gap-2"><strong>${e(labels[item.category])}</strong><span class="text-xs text-slate-500">${e(item.objectId)}</span></div>
        <p class="text-sm">${e(item.label)}：${item.quantity} ${e(item.unit)}</p>
        <p class="text-xs text-slate-500">${e(item.detail)}</p>
        ${review?.closure ? '' : `<div class="mt-2 flex flex-wrap gap-2">${itemActions(item)}</div>`}
      </article>`).join('') : '<p class="rounded border p-3 text-sm text-green-700">全部实物与在途均已处置，可以进行终止结案。</p>'}
      ${review?.closure || reviewError ? '' : `<div class="rounded border p-3"><p class="text-sm">结案：全部处置完成且数量对账后，标记终止已处置；结案不改变生产需求满足状态。</p>${action === 'CLOSE' ? `<label class="block text-sm mt-2">结案原因<input name="reason" class="mt-1 w-full rounded border p-2" data-skip-page-rerender="true" placeholder="有缺口时填写“终止不足”或关联补做单号"></label>${(review?.shortagePieces ?? 0) > 0 ? `<label class="block text-sm mt-2">关联补做单号（缺口结案时必填，或原因中明确终止不足）<input name="makeupOrderNo" class="mt-1 w-full rounded border p-2" data-skip-page-rerender="true"></label>` : ''}<label class="flex gap-2 text-sm mt-2"><input name="confirmed" type="checkbox" data-skip-page-rerender="true">已核对全部处置记录，确认结案；结案不改变需求满足状态</label><div class="mt-2">${button('confirm-close', '确认结案')}${button('cancel-item', '取消')}</div>` : `<div class="mt-2">${button('pick-close', '终止结案', productionOrderId)}</div>`}</div>`}
      <p role="alert" class="text-sm text-red-700">${e(message)}</p>
    </div>`
    surface.innerHTML = renderDialog({ title: '终止处置与结案', width: 'lg', closeAction: { prefix, action: 'close', skipPageRerender: true } }, content, button('close', '关闭'))
    hydrateIcons(surface)
    root()?.querySelector<HTMLElement>('input,select,button')?.focus()
  }

  render()

  surface.onclick = (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(`[data-${prefix}-action]`)
    if (!target) return
    event.stopPropagation()
    const name = target.dataset.tmfTerminationAction
    const value = (field: string) => root()?.querySelector<HTMLInputElement>(`[name="${field}"]`)?.value.trim() ?? ''
    const confirmed = () => !!root()?.querySelector<HTMLInputElement>('[name="confirmed"]')?.checked
    message = ''
    try {
      if (name === 'close') { close(); return }
      const item = (reviewItems() ?? []).find((candidate) => candidate.objectId === target.dataset.id)
      if (name === 'pick-scrap' || name === 'pick-retain' || name === 'pick-writeoff') {
        if (!item) throw new Error('处置项已变化，请重新打开核对。')
        selectedKey = itemKey(item)
        action = name === 'pick-retain' ? 'RETAIN_FROZEN' : name === 'pick-writeoff' ? 'TRANSIT_WRITE_OFF' : 'SCRAP'
        operationId = `${prefix}:${crypto.randomUUID()}`
        render(); return
      }
      if (name === 'pick-close') { action = 'CLOSE'; operationId = `${prefix}:close:${crypto.randomUUID()}`; render(); return }
      if (name === 'cancel-item') { selectedKey = ''; action = ''; render(); return }
      if (name === 'confirm-item') {
        const selected = (reviewItems() ?? []).find((candidate) => itemKey(candidate) === selectedKey)
        if (!selected) throw new Error('请选择处置项。')
        const quantity = Number(value('quantity'))
        const reason = value('reason')
        const ok = confirmed()
        const custodian = selected.custodian === 'WAREHOUSE' ? warehouseSupervisor : selected.custodian === 'PLAN' ? planner : factorySupervisor
        if (selected.category === 'CONTINUOUS_REMAINING') scrapTmfContinuousRemaining({ id: operationId, issueId: selected.objectId, meters: quantity, reason, confirmed: ok }, custodian, operationId)
        else if (selected.category === 'FACTORY_CUT') scrapTmfFactoryCutPieces({ id: operationId, cutOutputId: selected.objectId, pieces: quantity, reason, confirmed: ok }, custodian, operationId)
        else if (selected.category === 'DEFECTIVE') scrapTmfDefectiveOutput({ id: operationId, cutOutputId: selected.objectId, tipResultId: selected.tipResultId, pieces: quantity, expectedAvailablePieces: selected.quantity, reason, confirmed: ok }, custodian, operationId)
        else if (selected.category === 'FROZEN_PACKAGE' && action === 'RETAIN_FROZEN') retainTmfFrozenPackage({ id: operationId, packageId: selected.objectId, reason, confirmed: ok }, custodian, operationId)
        else if (selected.category === 'FROZEN_PACKAGE') scrapTmfFrozenPackage({ id: operationId, packageId: selected.objectId, pieces: quantity, reason, confirmed: ok }, custodian, operationId)
        else if (selected.category === 'UPSTREAM_TRANSIT') writeOffTmfUpstreamTransit({ id: operationId, issueId: selected.objectId, reason, confirmed: ok }, custodian, operationId)
        else if (selected.category === 'PRODUCTION_TRANSIT') writeOffTmfProductionTransit({ id: operationId, issueId: selected.objectId, reason, confirmed: ok }, custodian, operationId)
        else throw new Error('此处置项请在加工单详情按原流程处理（退回或装包交出）。')
        selectedKey = ''; action = ''; operationId = ''
        message = '处置已保存；请继续处理其余项或结案。'
        render(); return
      }
      if (name === 'confirm-close') {
        closeTmfTermination({ id: `${operationId}:case`, productionOrderId, reason: value('reason'), confirmed: confirmed(), expectedReview: JSON.stringify(reviewForSignature()), makeupOrderNo: value('makeupOrderNo') }, planner, operationId)
        close(); return
      }
    } catch (error) {
      fail(error instanceof Error ? error.message : '处置未保存，请重试。')
    }
  }

  function reviewItems(): TmfTerminationItem[] | null {
    try { return getTmfTerminationReview(productionOrderId).items } catch { return null }
  }
  function reviewForSignature() {
    const review = getTmfTerminationReview(productionOrderId)
    return { productionOrderId, controlStatus: review.controlStatus, closure: review.closure, items: review.items, outstandingCount: review.outstandingCount, shortagePieces: review.shortagePieces, disposals: review.disposals }
  }
}

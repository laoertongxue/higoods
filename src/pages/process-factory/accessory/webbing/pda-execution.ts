import { escapeHtml as e } from '../../../../utils.ts'
import { getTmfWorkOrder, listTmfWorkOrders } from '../../../../data/fcs/tmf-work-order-view.ts'
import {
  dispatchTmfOutputPackage, dispatchTmfTipMaterial, getTmfProcessingInputBalance, getTmfPurchaseState, packTmfOutput, receiveTmfDyeMaterial,
  receiveTmfPrintMaterial, receiveTmfProcessingMaterial, reportTmfCutOutput, reportTmfTipping, reloadTmfPurchaseRuntime,
  type TmfPurchaseActor,
} from '../../../../data/pms/tmf-material-purchases.ts'
import { readTmfTippingForm, renderTmfTippingForm } from './tipping-form.ts'

const prefix = 'tmf-pda-exec'
const root = () => document.querySelector<HTMLElement>('[data-tmf-pda-exec-root]')
const actor: TmfPurchaseActor = { id: 'TMF-DEMO-WORKER', name: '织带厂员工（演示）', role: '织带厂员工' }
const button = (action: string, label: string, id = '', primary = false) => `<button type="button" class="mt-2 w-full rounded-lg border px-4 py-3 text-base ${primary ? 'bg-blue-600 text-white' : 'bg-white'}" data-${prefix}-action="${action}" data-id="${e(id)}" data-skip-page-rerender="true">${label}</button>`
const field = (name: string, label: string, type = 'text', value = '') => `<label class="mt-3 block text-sm">${e(label)}<input name="${name}" type="${type}" value="${e(value)}" ${type === 'number' ? 'inputmode="decimal"' : ''} class="mt-1 w-full rounded border p-3" data-skip-page-rerender="true"></label>`

function bind(): void {
  const el = root(); if (!el || el.dataset.bound) return
  el.dataset.bound = 'true'
  let productionOrderNo = '', workOrderId = '', operationId = '', pendingAction = ''
  const host = el.querySelector<HTMLElement>('[data-tmf-pda-exec-content]')!
  const error = (text: string) => { const node = el.querySelector<HTMLElement>('[data-tmf-pda-exec-error]'); if (node) node.textContent = text }
  const value = (name: string) => host.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value.trim() ?? ''
  const render = () => { if (typeof window !== 'undefined') reloadTmfPurchaseRuntime(); selectScreen() }

  function selectScreen() {
    const orders = [...new Set(listTmfWorkOrders().map((order) => order.productionOrderNo))]
    host.innerHTML = `<p class="text-lg font-semibold">1 / 3 选择当前任务</p><p class="mt-2 text-sm text-slate-500">输入或扫描生产单号；仅显示已生成织带加工需求的任务。</p>${field('orderNo', '生产单号', 'text', productionOrderNo)}${button('load', '进入任务卡', '', true)}<p class="mt-3 text-xs text-slate-500">可选演示任务：${orders.slice(0, 4).map((no) => e(no)).join('、') || '暂无'}</p>`
    host.querySelector<HTMLInputElement>('[name="orderNo"]')?.focus()
  }

  function taskScreen() {
    const orders = listTmfWorkOrders().filter((order) => order.productionOrderNo === productionOrderNo)
    if (!orders.length) throw new Error('没有该生产单的织带加工需求，请核对生产单号。')
    workOrderId = orders[0].id
    const order = getTmfWorkOrder(workOrderId)!
    const data = getTmfPurchaseState()
    const inputs = order.inputs.map((issue) => ({ issue, balance: getTmfProcessingInputBalance(issue.id) }))
    const outputs = order.outputs
    const pendingTip = outputs.filter((output) => output.pendingTipPieces > 0)
    const packages = data.packages.filter((pkg) => order.demands.some((demand) => demand.id === pkg.demandId) && !pkg.splitAt && !pkg.warehouseId && !data.outputHandovers.some((handover) => handover.packageId === pkg.id))
    host.innerHTML = `<p class="text-lg font-semibold">2 / 3 任务卡 · ${e(order.productionOrderNo)}</p>
      <p class="mt-1 text-sm">${e(order.receiptStatus)} / ${e(order.processingStatus)} / ${e(order.handoverStatus)}</p>
      <section class="mt-3 rounded-lg bg-white p-3"><h3 class="font-medium">待接收投入</h3>${inputs.filter(({ issue, balance }) => issue.dispatchedMeters - balance.receivedMeters > 0.000001).map(({ issue, balance }) => `<div class="mt-2 rounded border p-2"><p class="text-sm">${e(issue.materialSkuId)} · 未收 ${Math.round((issue.dispatchedMeters - balance.receivedMeters) * 1000) / 1000} 米</p><p class="text-xs text-slate-500">${e(issue.id)} · ${e(issue.printHandover ? '印花回料' : issue.dyeHandover ? '染色回料' : '印染首道')}</p>${button('receive', '登记实收', issue.id)}</div>`).join('') || '<p class="text-sm text-slate-500">没有待接收投入。</p>'}</section>
      <section class="mt-3 rounded-lg bg-white p-3"><h3 class="font-medium">可截断投入</h3>${inputs.filter(({ balance }) => balance.receivedMeters > 0 && balance.remainingMeters > 0.000001).map(({ issue, balance }) => `<div class="mt-2 rounded border p-2"><p class="text-sm">${e(issue.materialSkuId)} · 可加工 ${Math.round(balance.remainingMeters * 1000) / 1000} 米</p>${button('cut', '填报截断产出', issue.id, true)}</div>`).join('') || '<p class="text-sm text-slate-500">暂无可截断的已收投入。</p>'}</section>
      <section class="mt-3 rounded-lg bg-white p-3"><h3 class="font-medium">待打头</h3>${pendingTip.map((output) => `<div class="mt-2 rounded border p-2"><p class="text-sm">${e(output.specification.garmentSize)} · ${output.actualCutLengthMm}mm · 待打头 ${output.pendingTipPieces} ${e(output.unit)}</p>${button('tip', '填报实际打头', output.id, true)}</div>`).join('') || '<p class="text-sm text-slate-500">没有待打头条料。</p>'}</section>
      <section class="mt-3 rounded-lg bg-white p-3"><h3 class="font-medium">待交出合格包</h3>${packages.map((pkg) => `<div class="mt-2 rounded border p-2"><p class="text-sm">包 ${e(pkg.id)} · ${pkg.pieces} ${e(pkg.unit)} · 成品 ${pkg.actualFinishedLengthMm}mm</p>${button('dispatch', '交回辅料仓', pkg.id, true)}</div>`).join('') || '<p class="text-sm text-slate-500">没有待交出的合格包。</p>'}</section>
      ${button('back', '返回选择任务')}`
  }

  function formScreen(title: string, action: string, issueId: string, fieldsHtml: string) {
    pendingAction = action
    host.innerHTML = `<p class="text-lg font-semibold">3 / 3 ${e(title)}</p>${fieldsHtml}<p class="mt-2 text-xs text-slate-500">实收、产出与交出都以实际数量为准；数量不符时先叫主管。</p>${button('confirm', '确认保存', issueId, true)}${button('back-card', '返回任务卡')}`
  }

  function open(action: string, id: string) {
    operationId = `${prefix}:${crypto.randomUUID()}`
    error('')
    const data = getTmfPurchaseState()
    if (action === 'receive') {
      const issue = data.processingIssues.find((item) => item.id === id)!
      formScreen('登记投入实收', 'receive', id, `<p class="mt-2 text-sm">${e(issue.materialSkuId)}；未收 ${Math.round((issue.dispatchedMeters - getTmfProcessingInputBalance(id).receivedMeters) * 1000) / 1000} 米</p>${field('quantity', '本次实际接收（米）', 'number')}`)
    } else if (action === 'cut') {
      const issue = data.processingIssues.find((item) => item.id === id)!
      const demand = data.demands.find((item) => item.id === issue.demandId)!
      const tipping = demand.specification.tippingRequired
      formScreen('截断产出填报', 'cut', id, `<p class="mt-2 text-sm">要求下料 ${demand.specification.cutLengthMm}mm；成品 ${demand.specification.finishedLengthMm}mm${tipping ? '（需打头，暂不填成品长度）' : ''}</p>${field('quantity', `本次截断（${demand.specification.usage}·${demand.specification.garmentSize}，条/根）`, 'number')}${field('length', '实际下料长度（mm）', 'number')}${tipping ? '' : field('finished', '实际成品长度（mm）', 'number')}${field('defective', '本次不良（条/根，可填0）', 'number', '0')}${field('loss', '切割损耗（米，可填0）', 'number', '0')}${field('reason', '不良、损耗或超需求原因（必要时）')}`)
    } else if (action === 'tip') {
      const output = data.cutOutputs.find((item) => item.id === id)!
      const materials = data.tipMaterialIssues.filter((item) => item.demandId === output.demandId)
      pendingAction = 'tip'
      host.innerHTML = `<p class="text-lg font-semibold">3 / 3 实际打头填报</p>${renderTmfTippingForm(output, materials)}${button('confirm-tip', '确认保存', id, true)}${button('back-card', '返回任务卡')}`
    } else if (action === 'dispatch') {
      const pkg = data.packages.find((item) => item.id === id)!
      formScreen('合格产出交回辅料仓', 'dispatch', id, `<p class="mt-2 text-sm">包 ${e(pkg.id)} · ${pkg.pieces} ${e(pkg.unit)} · 成品 ${pkg.actualFinishedLengthMm}mm</p>${field('handover', '本次交出单号')}<label class="mt-3 flex gap-2 text-sm"><input name="confirmed" type="checkbox" data-skip-page-rerender="true">已核对实物数量、规格和包号一致</label>`)
    }
  }

  el.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(`[data-${prefix}-action]`); if (!target) return
    event.stopPropagation()
    const name = target.getAttribute(`data-${prefix}-action`)!
    error('')
    try {
      if (name === 'load') { productionOrderNo = value('orderNo'); taskScreen(); return }
      if (name === 'back') { productionOrderNo = ''; selectScreen(); return }
      if (name === 'back-card') { taskScreen(); return }
      if (name === 'receive' || name === 'cut' || name === 'tip' || name === 'dispatch') { open(name, target.dataset.id || ''); return }
      if (name === 'confirm') {
        const data = getTmfPurchaseState()
        if (pendingAction === 'receive') {
          const row = getTmfWorkOrder(workOrderId)!.inputs.find((item) => item.id === target.dataset.id)!
          const quantity = Number(value('quantity'))
          if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('请填写正整数米数。')
          if (row.dyeHandover) void receiveTmfDyeMaterial({ issueId: row.id, materialSkuId: row.materialSkuId, receivedMeters: quantity }, actor, operationId).then(taskScreen)
          else if (row.printHandover) void receiveTmfPrintMaterial({ issueId: row.id, materialSkuId: row.materialSkuId, receivedMeters: quantity }, actor, operationId).then(taskScreen)
          else { receiveTmfProcessingMaterial({ issueId: row.id, factoryId: 'FAC-TMF', materialSkuId: row.materialSkuId, receivedMeters: quantity }, actor, operationId); taskScreen() }
          return
        }
        if (pendingAction === 'cut') {
          const issue = getTmfWorkOrder(workOrderId)!.inputs.find((item) => item.id === target.dataset.id)!
          const demand = data.demands.find((item) => item.id === issue.demandId)!
          reportTmfCutOutput({ outputId: `${operationId}:out`, issueId: issue.id, cutPieces: Number(value('quantity')), defectivePieces: Number(value('defective') || 0), actualCutLengthMm: Number(value('length')), actualFinishedLengthMm: demand.specification.tippingRequired ? null : Number(value('finished')), lossMeters: Number(value('loss') || 0), reason: value('reason') }, actor, operationId)
          taskScreen(); return
        }
        if (pendingAction === 'dispatch') {
          const pkg = data.packages.find((item) => item.id === target.dataset.id)!
          if (!host.querySelector<HTMLInputElement>('[name="confirmed"]')?.checked) throw new Error('请核对实物后勾选确认。')
          dispatchTmfOutputPackage({ handoverId: value('handover'), packageId: pkg.id, warehouseId: pkg.warehouseId || orderWarehouse(pkg.demandId) }, actor, operationId)
          taskScreen(); return
        }
      }
      if (name === 'confirm-tip') {
        const outputId = target.dataset.id || ''
        const order = getTmfWorkOrder(workOrderId)!
        const output = order.outputs.find((item) => item.id === outputId)!
        const data = getTmfPurchaseState()
        const actual = readTmfTippingForm(host, data.tipMaterialIssues.filter((item) => item.demandId === output.demandId))
        reportTmfTipping({ id: `${operationId}:tip`, cutOutputId: output.id, ...actual }, actor, operationId)
        taskScreen(); return
      }
    } catch (err) { error(err instanceof Error ? err.message : '未保存，请重试。') }
  })

  function orderWarehouse(demandId: string): string {
    const data = getTmfPurchaseState()
    const issue = data.processingIssues.find((item) => item.demandId === demandId)
    const lot = data.lots.find((item) => item.id === issue?.lotId)
    return lot?.warehouseId || ''
  }

  render()
}

export function renderTmfPdaExecution(): string {
  if (typeof window !== 'undefined') requestAnimationFrame(bind)
  return `<div data-tmf-pda-exec-root data-skip-page-rerender="true" class="mx-auto min-h-screen max-w-md bg-slate-100 p-4"><header class="mb-4"><h1 class="text-lg font-semibold">织带厂执行</h1><p class="text-xs text-slate-500">织带厂员工（演示）· 接收／截断／打头／交出</p></header><div data-tmf-pda-exec-content class="rounded-lg bg-white p-4"></div><p data-tmf-pda-exec-error role="alert" class="mt-3 break-words text-sm text-red-700"></p></div>`
}

import { getFactoryMasterRecordById } from '../../data/fcs/factory-master-store.ts'
import { isCentralPdaFactory } from '../../data/fcs/pda-experience-scope.ts'
import { readFactoryPdaExecutionUsers, type FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { TMF_FACTORY_ID } from '../../data/fcs/central-craft-factories.ts'
import { getTmfPurchaseState, receiveTmfDyeMaterial, receiveTmfPrintMaterial, receiveTmfProcessingMaterial, receiveTmfTipMaterial, reportTmfCutOutput, packTmfOutput, dispatchTmfOutputPackage, dispatchTmfContinuousReturn, reportTmfTipping, dispatchTmfTipMaterialReturn, getTmfProcessingInputBalance, getTmfTipMaterialBalance, getTmfBaseMaterialBalance, type TmfProcessingMaterialIssue, type TmfPurchaseActor, type TmfTipMaterialIssue, type TmfCutOutput, type TmfOutputPackage } from '../../data/pms/tmf-material-purchases.ts'
import { getTmfWorkOrder, listTmfWorkOrders } from '../../data/fcs/tmf-work-order-view.ts'

export type CentralWebbingAction = 'receive' | 'cut' | 'tip' | 'pack' | 'dispatch' | 'return' | 'tipReturn'
export type WebbingOrder = ReturnType<typeof listTmfWorkOrders>[number]
export interface WebbingTipIssue extends TmfTipMaterialIssue { remainingQty: number }
export interface WebbingInput extends TmfProcessingMaterialIssue { receivedQty: number; remainingMeters: number }

/** The weaving factory is the TMF central accessory factory; never infer it from a name. */
export function centralWebbingFactory(factoryId: string) {
  const factory = getFactoryMasterRecordById(factoryId)
  return factory && factory.status === 'active' && isCentralPdaFactory(factory) && factory.id === TMF_FACTORY_ID ? factory : undefined
}
export function centralWebbingOrders(factoryId: string): WebbingOrder[] {
  return centralWebbingFactory(factoryId) ? listTmfWorkOrders() : []
}
export function centralWebbingOrder(factoryId: string, workOrderId: string) {
  return centralWebbingOrders(factoryId).find(order => order.id === workOrderId)
}
export function webbingInputs(order: WebbingOrder): WebbingInput[] {
  return order.inputs.map(input => ({ ...input, receivedQty: input.receivedMeters, remainingMeters: round(input.dispatchedMeters - input.receivedMeters) }))
}
export function webbingTipIssues(order: WebbingOrder): WebbingTipIssue[] {
  const demandIds = new Set(order.demands.map(demand => demand.id))
  return getTmfPurchaseState().tipMaterialIssues.filter(issue => demandIds.has(issue.demandId))
    .map(issue => ({ ...issue, remainingQty: round(issue.dispatchedQty - issue.receivedQty) }))
}
export function webbingUnpackedPieces(order: WebbingOrder, output: TmfCutOutput) {
  if (output.specification.tippingRequired) return 0
  return Math.max(0, output.goodPieces - order.packages.filter(pkg => !pkg.splitAt && pkg.cutOutputId === output.id).reduce((sum, pkg) => sum + pkg.pieces, 0))
}
export function webbingTipReturnCandidates(order: WebbingOrder) {
  const demandIds = new Set(order.demands.map(demand => demand.id))
  return getTmfPurchaseState().tipMaterialIssues.filter(issue => demandIds.has(issue.demandId) && issue.stockLotId)
    .map(issue => ({ ...issue, availableQty: getTmfTipMaterialBalance(issue.id).availableQty }))
    .filter(issue => issue.availableQty > 0)
}
export function webbingTipCandidates(order: WebbingOrder) {
  return order.outputs.filter(output => output.specification.tippingRequired && output.pendingTipPieces > 0)
}
export function webbingTipMaterials(order: WebbingOrder, output: TmfCutOutput) {
  return getTmfPurchaseState().tipMaterialIssues.filter(issue => issue.demandId === output.demandId)
    .map(issue => ({ ...issue, availableQty: getTmfTipMaterialBalance(issue.id).availableQty }))
    .filter(issue => issue.availableQty > 0)
}
export function webbingTipEndCount(output: TmfCutOutput, materialBomItemId: string) {
  return [output.specification.endA, output.specification.endB].filter(end => end.method !== 'NONE' && end.materialBomItemId === materialBomItemId).length
}
export function webbingPackCandidates(order: WebbingOrder) {
  return order.outputs.filter(output => webbingUnpackedPieces(order, output) > 0)
}
export function webbingDispatchCandidates(order: WebbingOrder): TmfOutputPackage[] {
  return order.packages.filter(pkg => !pkg.splitAt && !pkg.warehouseId && !order.handovers.some(handover => handover.packageId === pkg.id))
}
export function webbingReturnBalance(order: WebbingOrder, inputId: string) {
  return getTmfProcessingInputBalance(inputId).remainingMeters
}
/** Actions follow the original Web state; no processing action is offered before
 * the actual material is received or a good output exists. */
export function centralWebbingActions(order: WebbingOrder): CentralWebbingAction[] {
  const actions: CentralWebbingAction[] = []
  if (webbingInputs(order).some(input => input.remainingMeters > 0) || webbingTipIssues(order).some(issue => issue.remainingQty > 0)) actions.push('receive')
  if (webbingInputs(order).some(input => webbingReturnBalance(order, input.id) > 0)) actions.push('cut', 'return')
  if (webbingTipCandidates(order).some(output => webbingTipMaterials(order, output).length)) actions.push('tip')
  if (webbingTipReturnCandidates(order).length) actions.push('tipReturn')
  if (webbingPackCandidates(order).length) actions.push('pack')
  if (webbingDispatchCandidates(order).length) actions.push('dispatch')
  return actions
}
/** Paper order, production order, issued input or tip issue may identify the same current order. */
export function centralWebbingScan(raw: string, factoryId: string): WebbingOrder[] {
  const key = raw.trim().toLowerCase()
  if (!key) return []
  return centralWebbingOrders(factoryId).filter(order => [order.id, order.workOrderNo, order.productionOrderNo, ...order.demands.map(demand => demand.id),
    ...webbingInputs(order).map(input => input.id), ...webbingTipIssues(order).map(issue => issue.id)]
    .some(value => String(value).toLowerCase() === key))
}
/** Keep the original TMF role names; the PDA account must still match the active factory user. */
export function centralWebbingActor(user: FactoryPdaUser): TmfPurchaseActor {
  const actual = readFactoryPdaExecutionUsers(user.factoryId).find(row => row.userId === user.userId)
  if (!centralWebbingFactory(user.factoryId) || !actual || actual.status !== 'ACTIVE' || actual.name !== user.name || actual.factoryId !== user.factoryId) {
    throw new Error('实际操作账号与本厂不一致，请重新登录。')
  }
  const role: TmfPurchaseActor['role'] = actual.roleId === 'ROLE_ADMIN' || /主管/.test(actual.roleName || '') ? '织带厂主管' : '织带厂员工'
  return { id: actual.userId, name: actual.name, role }
}
export interface CentralWebbingReceipt {
  workOrderId: string
  operationId: string
  inputId?: string
  tipIssueId?: string
  quantity: number
}
/** Await the original row command; the page only reports success after the transaction completes. */
export async function saveCentralWebbingReceipt(command: CentralWebbingReceipt, user: FactoryPdaUser) {
  const actor = centralWebbingActor(user), order = centralWebbingOrder(user.factoryId, command.workOrderId)
  if (!order) throw new Error('本厂没有这张织带加工单。')
  if (!!command.inputId === !!command.tipIssueId) throw new Error('请选择一条实际来料或辅材记录。')
  if (!(command.quantity > 0) || Math.abs(command.quantity * 1000 - Math.round(command.quantity * 1000)) > 0.000001) throw new Error('实收数量须为大于 0 的数值，最多三位小数。')
  if (command.inputId) {
    const input = webbingInputs(order).find(row => row.id === command.inputId)
    if (!input) throw new Error('来料不属于当前加工单。')
    if (input.printHandover) {
      await receiveTmfPrintMaterial({ issueId: input.id, materialSkuId: input.materialSkuId, receivedMeters: command.quantity }, actor, command.operationId)
      return
    }
    if (input.dyeHandover) {
      await receiveTmfDyeMaterial({ issueId: input.id, materialSkuId: input.materialSkuId, receivedMeters: command.quantity }, actor, command.operationId)
      return
    }
    await receiveTmfProcessingMaterial({ issueId: input.id, factoryId: TMF_FACTORY_ID, materialSkuId: input.materialSkuId, receivedMeters: command.quantity }, actor, command.operationId, true)
    return
  }
  const issue = webbingTipIssues(order).find(row => row.id === command.tipIssueId)
  if (!issue) throw new Error('辅材不属于当前加工单。')
  if (!Number.isSafeInteger(command.quantity)) throw new Error('辅材实收须为整数。')
  await receiveTmfTipMaterial(issue.id, command.quantity, actor, command.operationId, true)
}
export interface CentralWebbingExecution {
  workOrderId: string
  action: 'cut' | 'tip' | 'pack' | 'dispatch' | 'return' | 'tipReturn'
  operationId: string
  inputId?: string
  cutOutputId?: string
  packageId?: string
  packageNo?: string
  quantity: number
  lengthMm?: number
  finishedMm?: number
  defectivePieces?: number
  lossMeters?: number
  reason?: string
  tipUsed?: Record<string, number>
  tipIssueId?: string
}
/** All execution actions await the original TMF row transaction. */
export async function saveCentralWebbingExecution(command: CentralWebbingExecution, user: FactoryPdaUser) {
  const actor = centralWebbingActor(user), order = centralWebbingOrder(user.factoryId, command.workOrderId)
  if (!order) throw new Error('本厂没有这张织带加工单。')
  if (command.action === 'tipReturn') {
    const issue = webbingTipReturnCandidates(order).find(row => row.id === command.tipIssueId)
    if (!issue) throw new Error('当前没有可退回的未用端头辅材。')
    if (!command.reason?.trim()) throw new Error('请填写辅材退回原因。')
    await dispatchTmfTipMaterialReturn({ id: `TMF-TR-${command.operationId}`, sourceIssueId: issue.id, quantity: command.quantity, reason: command.reason.trim() }, actor, command.operationId, true)
    return
  }
  if (command.action === 'cut') {
    const input = webbingInputs(order).find(row => row.id === command.inputId)
    if (!input) throw new Error('加工投入不属于当前加工单。')
    const demand = order.demands.find(row => row.id === input.demandId)!
    await reportTmfCutOutput({
      outputId: `TMF-OUT-${command.operationId}`, issueId: input.id,
      cutPieces: command.quantity, defectivePieces: command.defectivePieces ?? 0,
      actualCutLengthMm: command.lengthMm ?? demand.specification.cutLengthMm,
      actualFinishedLengthMm: demand.specification.tippingRequired ? null : command.finishedMm ?? demand.specification.finishedLengthMm,
      lossMeters: command.lossMeters ?? 0, reason: command.reason || '',
    }, actor, command.operationId, true)
    return
  }
  if (command.action === 'tip') {
    const output = webbingTipCandidates(order).find(row => row.id === command.cutOutputId)
    if (!output) throw new Error('没有待打头的当前产出。')
    const materials = webbingTipMaterials(order, output).map(issue => ({
      issueId: issue.id,
      usedQty: command.tipUsed?.[issue.id] ?? (issue.unit === '个' ? command.quantity * webbingTipEndCount(output, issue.materialBomItemId) : 0),
      scrapQty: 0,
    }))
    await reportTmfTipping({ id: `TMF-TIP-${command.operationId}`, cutOutputId: output.id, pieces: command.quantity,
      defectivePieces: command.defectivePieces ?? 0, actualFinishedLengthMm: command.finishedMm ?? output.specification.finishedLengthMm,
      endA: output.specification.endA, endB: output.specification.endB, materials, reason: command.reason || '' }, actor, command.operationId, true)
    return
  }
  if (command.action === 'pack') {
    const output = order.outputs.find(row => row.id === command.cutOutputId)
    if (!output) throw new Error('加工产出不属于当前加工单。')
    if (!command.packageNo?.trim()) throw new Error('请填写实物包号。')
    await packTmfOutput({ packageId: command.packageNo.trim(), cutOutputId: output.id, pieces: command.quantity }, actor, command.operationId, true)
    return
  }
  if (command.action === 'dispatch') {
    const pkg = webbingDispatchCandidates(order).find(row => row.id === command.packageId)
    if (!pkg) throw new Error('当前没有可交出的有效包。')
    const output = order.outputs.find(row => row.id === pkg.cutOutputId)!
    const issue = order.inputs.find(row => row.id === output.sourceIssueId)!
    const lot = getTmfPurchaseState().lots.find(row => row.id === issue.lotId)
    if (!lot) throw new Error('包的来源仓库批次不存在。')
    await dispatchTmfOutputPackage({ handoverId: `TMF-HO-${command.operationId}`, packageId: pkg.id, warehouseId: lot.warehouseId }, actor, command.operationId, true)
    return
  }
  const input = webbingInputs(order).find(row => row.id === command.inputId)
  if (!input) throw new Error('退料投入不属于当前加工单。')
  if (!command.reason?.trim()) throw new Error('请填写退料原因。')
  await dispatchTmfContinuousReturn({
    returnId: `TMF-RET-${command.operationId}`, issueId: input.id, batchId: `TMF-RB-${command.operationId}`,
    returnedMeters: command.quantity, reason: command.reason.trim(),
  }, actor, command.operationId, true)
}
/** Base material keeps its own kg/g lot and issue ledger; never converted to webbing meters. */
export function centralWebbingBaseLedger() {
  const data = getTmfPurchaseState()
  return data.baseOrders.map(order => ({
    id: order.id,
    purchaseOrderNo: order.purchaseOrderNo,
    plannedMeters: order.plannedMeters,
    producedMeters: order.producedMeters,
    lots: data.baseMaterialLots.filter(lot => lot.sourceReceiptNo.startsWith(order.purchaseOrderNo)),
    issues: data.baseMaterialIssues.filter(issue => issue.baseOrderId === order.id).map(issue => {
      const balance = getTmfBaseMaterialBalance(issue.id)
      return { ...issue, ...balance }
    }),
  }))
}
export function refreshCentralWebbingOrder(factoryId: string, workOrderId: string) {
  return getTmfWorkOrder(workOrderId) ? centralWebbingOrder(factoryId, workOrderId) : undefined
}
export function webbingQty(qty: number, unit: string) { return `${round(qty)} ${unit}` }
function round(value: number) { return Math.round(value * 1000) / 1000 }

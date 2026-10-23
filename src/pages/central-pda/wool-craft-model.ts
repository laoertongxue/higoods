import { getFactoryMasterRecordById, listFactoryMasterRecords } from '../../data/fcs/factory-master-store.ts'
import { isCentralPdaFactory } from '../../data/fcs/pda-experience-scope.ts'
import { readFactoryPdaExecutionUsers, type FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { eligibleReceivingSource, getDefaultFactoryReceiptPosition, listFactoryReceivingSources, listFactoryReceipts,
  prepareFactoryReceipt, type FactoryReceivingSource, type FactoryReceivingSourceLine, type FactoryReceiptInput } from '../../data/fcs/factory-receiving.ts'
import { confirmFactoryMaterialReceipt } from '../../data/fcs/factory-receiving-links.ts'
import { listWoolCraftTaskOrders, woolCraftOrderId, executeWoolCraftAction } from '../../data/fcs/wool-domain/craft-flow.ts'
import { getDedicatedSpecialCraftFactoryId } from '../../data/fcs/special-craft-dedicated-factories.ts'
import { readWoolQuerySnapshot } from '../../data/fcs/wool-domain/queries.ts'
import { readWoolStore, runWoolRecordCommand } from '../../data/fcs/wool-domain/store.ts'
import type { SpecialCraftTaskOrder } from '../../data/fcs/special-craft-task-orders.ts'
import type { WoolWorkOrder, WoolExternalPiece, WoolPieceRouteNode, WoolCraftRecord } from '../../data/fcs/wool-domain/types.ts'
import { prepareCentralWool } from './wool-model.ts'

export interface CentralWoolCraftIncoming {
  key: string; taskOrderId: string; source: FactoryReceivingSource; line: FactoryReceivingSourceLine;
  receivedQty: number; remainingQty: number; canReceive: boolean;
  receipts: Array<{ id: string; qty: number; at: string; operatorId: string; operatorName: string }>;
}
export interface CentralWoolCraftContext {
  task: SpecialCraftTaskOrder; owner: WoolWorkOrder; piece: WoolExternalPiece; node: WoolPieceRouteNode;
  next?: WoolPieceRouteNode; completed: boolean; currentFactory: boolean;
  incoming: CentralWoolCraftIncoming[]; records: WoolCraftRecord[];
}
export function assertCentralWoolCraftActor(actor: FactoryPdaUser) {
  const factory = getFactoryMasterRecordById(actor.factoryId)
  const actual = readFactoryPdaExecutionUsers(actor.factoryId).find(user => user.userId === actor.userId)
  if (!factory || factory.status !== 'active' || !isCentralPdaFactory(factory) || !actual
    || actual.status !== 'ACTIVE' || actual.name !== actor.name) throw new Error('WOOL_CRAFT_actor')
  return actual
}
/** Keep each original part and node. A craft task is not a yarn receipt, a
 * garment report or an ordinary special-craft aggregate receiving action. */
/** Factory/operation menus need task ownership, not every receiving projection. */
export function centralWoolCraftAssignments(factoryId?: string, operationId?: string) {
  const factories = new Set(listFactoryMasterRecords().filter(factory => factory.status === 'active' && isCentralPdaFactory(factory)).map(factory => factory.id))
  return listWoolCraftTaskOrders().filter(task => factories.has(task.factoryId)
    && (!factoryId || task.factoryId === factoryId) && (!operationId || task.operationId === operationId))
}
export function centralWoolCraftContexts(factoryId?: string, operationId?: string): CentralWoolCraftContext[] {
  const factories = new Set(listFactoryMasterRecords().filter(factory => factory.status === 'active' && isCentralPdaFactory(factory)).map(factory => factory.id))
  const tasks = centralWoolCraftAssignments(factoryId, operationId)
  if (!tasks.length) return []
  const store = readWoolQuerySnapshot(), sources = listFactoryReceivingSources(factoryId, true), receipts = listFactoryReceipts(factoryId)
  return tasks.flatMap(task => {
    if (!factories.has(task.factoryId) || factoryId && task.factoryId !== factoryId || operationId && task.operationId !== operationId) return []
    const owner = store.workOrders[task.woolOrderId || ''], piece = owner?.externalPieces.find(piece => piece.pieceKey === task.woolPieceKey)
    const index = piece?.routeNodes.findIndex(node => node.sourceEntryId === task.woolRouteNodeId && woolCraftOrderId(owner, piece!, node) === task.taskOrderId) ?? -1
    const node = piece?.routeNodes[index]
    if (!owner || owner.stage !== 'KNITTING' || !piece || !node) return []
    const records = store.craftRecords.filter(record => record.taskOrderId === task.taskOrderId)
    const completed = records.some(record => record.action === 'COMPLETE')
    const currentFactory = task.factoryId === getDedicatedSpecialCraftFactoryId(task.operationId)
    const incoming = sources.filter(source => source.targetFactoryId === task.factoryId).flatMap(source => source.lines
      .filter(line => line.material.kind === 'WOOL_PIECE' && line.unit === '片'
        && line.woolCraftOrderId === task.taskOrderId && line.woolPieceKey === piece.pieceKey && line.woolRouteNodeId === node.sourceEntryId)
      .map(line => {
        const actual = receipts.filter(receipt => receipt.factoryId === task.factoryId).flatMap(receipt => receipt.lines
          .filter(saved => saved.sourceId === source.id && saved.sourceLineId === line.id)
          .map(saved => ({ id: receipt.id, qty: saved.qty, at: receipt.receivedAt, operatorId: receipt.operatorId, operatorName: receipt.operatorName })))
        const receivedQty = actual.reduce((sum, receipt) => sum + receipt.qty, 0), remainingQty = Math.max(0, line.sentQty - receivedQty)
        return { key: JSON.stringify([source.id, line.id]), taskOrderId: task.taskOrderId, source, line, receipts: actual,
          receivedQty, remainingQty, canReceive: !completed && currentFactory && eligibleReceivingSource(source) && remainingQty > 0 }
      }))
    return [{ task, owner, piece, node, next: piece.routeNodes[index + 1], records, completed, currentFactory, incoming }]
  })
}
export function centralWoolCraftReceiptSource(context: CentralWoolCraftContext, row: CentralWoolCraftIncoming) {
  return JSON.stringify([context.task.taskOrderId, context.task.factoryId, context.task.operationId, context.node,
    context.completed, context.currentFactory, row.source, row.line, row.receipts])
}
export function centralWoolCraftReceiptRequest(context: CentralWoolCraftContext, row: CentralWoolCraftIncoming,
  quantity: number, actor: FactoryPdaUser, commandId: string, receivedAt: string) {
  assertCentralWoolCraftActor(actor)
  if (actor.factoryId !== context.task.factoryId || row.taskOrderId !== context.task.taskOrderId
    || !context.incoming.some(incoming => incoming.key === row.key) || row.source.targetFactoryId !== actor.factoryId) throw new Error('WOOL_CRAFT_source')
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('WOOL_CRAFT_quantity')
  if (context.completed || !context.currentFactory || !row.canReceive) throw new Error('WOOL_CRAFT_changed')
  if (quantity > row.remainingQty) throw new Error('WOOL_CRAFT_receiveLimit')
  const input: FactoryReceiptInput = { id: commandId, factoryId: actor.factoryId, operatorId: actor.userId,
    operatorName: actor.name, receivedAt, remark: '', lines: [{ sourceId: row.source.id, sourceLineId: row.line.id,
      businessQty: quantity, businessUnit: '片', ...getDefaultFactoryReceiptPosition(actor.factoryId) }] }
  return { taskOrderId: context.task.taskOrderId, sourceKey: row.key, expectedSource: centralWoolCraftReceiptSource(context, row),
    input, prepared: prepareFactoryReceipt(input) }
}
export type CentralWoolCraftReceiptRequest = ReturnType<typeof centralWoolCraftReceiptRequest>
export async function saveCentralWoolCraftReceipt(request: CentralWoolCraftReceiptRequest, actor: FactoryPdaUser) {
  await prepareCentralWool(); assertCentralWoolCraftActor(actor)
  const input = request.input
  if (input.factoryId !== actor.factoryId || input.operatorId !== actor.userId || input.operatorName !== actor.name) throw new Error('WOOL_CRAFT_actor')
  try { return await runWoolRecordCommand(() => {
    assertCentralWoolCraftActor(actor)
    const saved = listFactoryReceipts(actor.factoryId).find(receipt => receipt.id === input.id)
    if (saved) {
      if (saved.lines.length !== 1 || saved.lines[0].woolCraftOrderId !== request.taskOrderId
        || JSON.stringify([saved.lines[0].sourceId, saved.lines[0].sourceLineId]) !== request.sourceKey) throw new Error('WOOL_CRAFT_source')
    } else {
      const context = centralWoolCraftContexts(actor.factoryId).find(context => context.task.taskOrderId === request.taskOrderId)
      const row = context?.incoming.find(row => row.key === request.sourceKey)
      if (!context || !row || centralWoolCraftReceiptSource(context, row) !== request.expectedSource) throw new Error('WOOL_CRAFT_changed')
      const canonical = centralWoolCraftReceiptRequest(context, row, input.lines[0]?.businessQty ?? NaN, actor, input.id, input.receivedAt)
      if (JSON.stringify(canonical.input) !== JSON.stringify(input)) throw new Error('WOOL_CRAFT_source')
    }
    const result = confirmFactoryMaterialReceipt(input, actor)
    readWoolStore()
    return result
  }) } catch (error) { return woolCraftCommandError(error) }
}
export type CentralWoolCraftAction = 'work' | 'handoff' | 'finish'
const actions = { work: 'SPECIAL_CRAFT_PROCESS_REPORT', handoff: 'SPECIAL_CRAFT_SUBMIT_HANDOVER', finish: 'SPECIAL_CRAFT_COMPLETE_ORDER' } as const
export function centralWoolCraftActionSource(context: CentralWoolCraftContext) {
  return JSON.stringify([context.task, context.owner, context.piece, context.completed, context.currentFactory, context.incoming, context.records])
}
export function centralWoolCraftActionRequest(context: CentralWoolCraftContext, action: CentralWoolCraftAction,
  quantity: number, actor: FactoryPdaUser, commandId: string, operatedAt: string) {
  assertCentralWoolCraftActor(actor)
  if (context.task.factoryId !== actor.factoryId) throw new Error('WOOL_CRAFT_actor')
  if (context.completed || !context.currentFactory) throw new Error('WOOL_CRAFT_changed')
  if (!Object.hasOwn(actions, action)) throw new Error('WOOL_CRAFT_source')
  if (action !== 'finish' && (!Number.isSafeInteger(quantity) || quantity <= 0)) throw new Error('WOOL_CRAFT_quantity')
  if (action === 'work' && quantity > context.task.receivedQty - context.task.completedQty) throw new Error('WOOL_CRAFT_workLimit')
  if (action === 'handoff' && quantity > context.task.completedQty - (context.task.returnedQty || 0)) throw new Error('WOOL_CRAFT_handoffLimit')
  if (action === 'finish' && !(context.task.returnedQty! > 0)) throw new Error('WOOL_CRAFT_finishBlocked')
  return { taskOrderId: context.task.taskOrderId, actorId: actor.userId, expectedSource: centralWoolCraftActionSource(context),
    input: { taskOrderId: context.task.taskOrderId, actionCode: actions[action], ...(action === 'finish' ? {} : { qty: quantity }),
      operatorName: actor.name, operatedAt, commandId } }
}
export type CentralWoolCraftActionRequest = ReturnType<typeof centralWoolCraftActionRequest>
export async function saveCentralWoolCraftAction(request: CentralWoolCraftActionRequest, actor: FactoryPdaUser) {
  await prepareCentralWool(); assertCentralWoolCraftActor(actor)
  if (request.actorId !== actor.userId || request.input.operatorName !== actor.name || request.input.taskOrderId !== request.taskOrderId) throw new Error('WOOL_CRAFT_actor')
  try { return await runWoolRecordCommand(() => {
    assertCentralWoolCraftActor(actor)
    const context = centralWoolCraftContexts(actor.factoryId).find(context => context.task.taskOrderId === request.taskOrderId)
    if (!context) throw new Error('WOOL_CRAFT_source')
    if (!context.records.some(record => record.commandId === request.input.commandId)) {
      if (centralWoolCraftActionSource(context) !== request.expectedSource) throw new Error('WOOL_CRAFT_changed')
      const action = (Object.keys(actions) as CentralWoolCraftAction[]).find(action => actions[action] === request.input.actionCode)
      if (!action) throw new Error('WOOL_CRAFT_source')
      const canonical = centralWoolCraftActionRequest(context, action, request.input.qty || 0, actor, request.input.commandId, request.input.operatedAt)
      if (JSON.stringify(canonical.input) !== JSON.stringify(request.input)) throw new Error('WOOL_CRAFT_source')
    }
    executeWoolCraftAction(request.input)
    return readWoolStore()
  }) } catch (error) { return woolCraftCommandError(error) }
}
function woolCraftCommandError(error: unknown): never {
  if (!(error as { committed?: boolean })?.committed && error instanceof Error
    && /记录已被其他页面修改|其他标签页已更新/.test(error.message)) throw new Error('WOOL_CRAFT_changed', { cause: error })
  throw error
}

export function centralWoolCraftOutgoing(context: CentralWoolCraftContext) {
  const sources = listFactoryReceivingSources(undefined, true), receipts = listFactoryReceipts()
  return context.records.filter(record => record.action === 'HANDOVER').map(record => {
    const source = sources.find(source => source.originalRecordId === record.recordId && source.targetFactoryId === record.targetFactoryId)
    const actual = source ? receipts.filter(receipt => receipt.factoryId === source.targetFactoryId).flatMap(receipt => receipt.lines
      .filter(line => line.sourceId === source.id && line.woolPieceKey === context.piece.pieceKey)
      .map(line => ({ qty: line.qty, at: receipt.receivedAt, operatorId: receipt.operatorId, operatorName: receipt.operatorName }))) : []
    return { record, source, receipts: actual, actualQty: actual.length ? actual.reduce((sum, receipt) => sum + receipt.qty, 0) : undefined }
  })
}
/** Same completion requirements as executeWoolCraftAction; the original
 * command rechecks them at save time. This only controls its PDA affordance. */
export function centralWoolCraftCanFinish(context: CentralWoolCraftContext) {
  return !context.completed && context.currentFactory && context.task.completedQty >= context.task.planQty
    && context.task.completedQty === context.task.returnedQty && context.task.receivedQty === context.task.completedQty
    && (context.task.returnedQty || 0) > 0 && centralWoolCraftOutgoing(context).every(batch => batch.actualQty === batch.record.qty)
}

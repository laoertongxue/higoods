import { captureProcessWarehouseMutationState, restoreProcessWarehouseMutationState } from './process-warehouse-domain.ts'
import { withBindingProcessCommandScope } from './binding-process-command-scope.ts'
import { captureBindingProcessOrderStore, restoreBindingProcessOrderStore, getBindingProcessOrderById, type ExecuteBindingProcessActionInput } from '../../pages/process-factory/cutting/binding-strip-orders.ts'
import { executeBindingProcessActionWithWarehouse } from './binding-process-warehouse-linkage-service.ts'
import { ensureSpecialCraftRecords, registerBindingExecutionRecordHooks, runSpecialCraftRecordCommand } from './special-craft-records.ts'
import { readFactoryPdaExecutionUsers, type FactoryPdaUser } from './store-domain-pda.ts'

registerBindingExecutionRecordHooks({ capture: captureBindingProcessOrderStore, restore: restoreBindingProcessOrderStore })
export async function hydrateBindingProcessRecords() { await ensureSpecialCraftRecords(true, 'binding') }

/** Keep each original order and its actual process warehouse/handout changes in one existing PCS transaction. */
export async function runBindingProcessRecordCommand(input: ExecuteBindingProcessActionInput | ExecuteBindingProcessActionInput[], actor?: FactoryPdaUser, expectedRevision?: string) {
  const inputs = Array.isArray(input) ? input : [input], id = inputs[0]?.bindingOrderId
  if (!id || inputs.some(row => row.bindingOrderId !== id)) throw new Error('本次操作必须属于同一捆条加工单。')
  const operationId = inputs.length === 1 ? inputs[0].confirmationKey : 'binding-batch:' + JSON.stringify(inputs.map(row => row.confirmationKey))
  const intent = JSON.stringify(inputs.map(({ operatedAt: _at, ...row }) => ({ ...row, actor: actor?.userId })))
  const perform = () => withBindingProcessCommandScope(() => {
    const order = getBindingProcessOrderById(id)
    if (!order) throw new Error('捆条加工单不存在。')
    if (expectedRevision !== undefined && JSON.stringify(order) !== expectedRevision) throw new Error('单据已变化，本次未保存。重新读取后核对数量再提交。')
    const actual = actor && readFactoryPdaExecutionUsers(order.factoryId).find(user => user.userId === actor.userId)
    if (actor && (!actual || actual.status !== 'ACTIVE' || actual.factoryId !== actor.factoryId || order.factoryId !== actor.factoryId || actual.name !== actor.name)) throw new Error('实际操作账号与本厂不一致，请重新登录。')
    for (const row of inputs) executeBindingProcessActionWithWarehouse({ ...row, ...(actual ? {
      operatorName: actual.name, operatorUserId: actual.userId, operatorFactoryId: actual.factoryId,
      operatorRoleId: actual.roleId, operatorRoleName: actual.roleName,
    } : {}) })
    return { bindingOrderId: id }
  })
  if (typeof window === 'undefined') {
    const originalOrders = captureBindingProcessOrderStore(), originalWarehouse = captureProcessWarehouseMutationState()
    try { perform(); return getBindingProcessOrderById(id)! } catch (error) {
      restoreBindingProcessOrderStore(originalOrders); restoreProcessWarehouseMutationState(originalWarehouse); throw error
    }
  }
  await hydrateBindingProcessRecords()
  await runSpecialCraftRecordCommand(id, perform, operationId, intent, ['binding/' + id], 'binding')
  return getBindingProcessOrderById(id)!
}

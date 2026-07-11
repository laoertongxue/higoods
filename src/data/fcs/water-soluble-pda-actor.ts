import { getFactoryPdaUserById, type FactoryPdaSession } from './store-domain-pda.ts'

export type WaterSolublePdaActor = Pick<FactoryPdaSession, 'userId' | 'userName' | 'roleId' | 'factoryId'>
export type WaterSolublePdaRoleAction = 'OPERATE' | 'SUPERVISE' | 'HANDOVER'

const ALLOWED_ROLES: Record<WaterSolublePdaRoleAction, readonly string[]> = {
  OPERATE: ['ROLE_OPERATOR', 'ROLE_PRODUCTION', 'ROLE_ADMIN'],
  SUPERVISE: ['ROLE_PRODUCTION', 'ROLE_ADMIN'],
  HANDOVER: ['ROLE_HANDOVER', 'ROLE_ADMIN'],
}

const ROLE_ERROR: Record<WaterSolublePdaRoleAction, string> = {
  OPERATE: '当前账号不能执行水溶现场操作。',
  SUPERVISE: '请由生产主管处理水溶异常。',
  HANDOVER: '请由交接人员执行交出。',
}

export function validateWaterSolublePdaActor(
  actor: WaterSolublePdaActor,
  orderFactoryId: string | undefined,
  action: WaterSolublePdaRoleAction,
): string | null {
  if (!actor.userId?.trim() || !actor.userName?.trim() || !actor.roleId?.trim() || !actor.factoryId?.trim()) {
    return '当前登录信息不完整，请重新登录。'
  }
  const currentUser = getFactoryPdaUserById(actor.userId)
  if (!currentUser || currentUser.status !== 'ACTIVE') return '当前账号已失效，请重新登录。'
  if (
    currentUser.factoryId !== actor.factoryId
    || currentUser.roleId !== actor.roleId
    || currentUser.name !== actor.userName
  ) return '当前登录信息已变化，请重新登录。'
  if (!orderFactoryId || orderFactoryId !== actor.factoryId) return '当前加工单不属于当前工厂，不能操作。'
  if (!ALLOWED_ROLES[action].includes(actor.roleId)) return ROLE_ERROR[action]
  return null
}

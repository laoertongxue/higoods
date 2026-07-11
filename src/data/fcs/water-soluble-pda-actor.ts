import { getCurrentPdaUser, getPdaSession, type FactoryPdaSession } from './store-domain-pda.ts'

export type WaterSolublePdaActor = Pick<FactoryPdaSession, 'userId' | 'loginId' | 'userName' | 'roleId' | 'factoryId'>
export type WaterSolublePdaRoleAction = 'OPERATE' | 'SUPERVISE' | 'HANDOVER'

const ALLOWED_ROLES: Record<WaterSolublePdaRoleAction, readonly string[]> = {
  OPERATE: ['ROLE_OPERATOR'],
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
  if (!actor.userId?.trim() || !actor.loginId?.trim() || !actor.userName?.trim() || !actor.roleId?.trim() || !actor.factoryId?.trim()) {
    return '当前登录信息不完整，请重新登录。'
  }
  const session = getPdaSession()
  const currentUser = getCurrentPdaUser()
  if (!session || !currentUser || currentUser.status !== 'ACTIVE') return '当前账号已失效，请重新登录。'
  if (
    session.userId !== actor.userId
    || session.loginId !== actor.loginId
    || session.userName !== actor.userName
    || session.roleId !== actor.roleId
    || session.factoryId !== actor.factoryId
    || currentUser.userId !== session.userId
    || currentUser.loginId !== session.loginId
    || currentUser.factoryId !== session.factoryId
    || currentUser.roleId !== session.roleId
    || currentUser.name !== session.userName
  ) return '当前登录信息已变化，请重新登录。'
  if (!orderFactoryId || orderFactoryId !== actor.factoryId) return '当前加工单不属于当前工厂，不能操作。'
  if (!ALLOWED_ROLES[action].includes(actor.roleId)) return ROLE_ERROR[action]
  return null
}

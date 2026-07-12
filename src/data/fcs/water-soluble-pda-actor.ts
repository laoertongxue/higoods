import { getCurrentPdaUser, getPdaSession, type FactoryPdaSession } from './store-domain-pda.ts'

export type WaterSolublePdaActor = Pick<FactoryPdaSession, 'userId' | 'loginId' | 'userName' | 'roleId' | 'factoryId'>
export type WaterSolublePdaRoleAction = 'OPERATE' | 'SUPERVISE' | 'HANDOVER'

const ALLOWED_ROLES: Record<WaterSolublePdaRoleAction, readonly string[]> = {
  OPERATE: ['ROLE_OPERATOR'],
  SUPERVISE: ['ROLE_PRODUCTION', 'ROLE_ADMIN'],
  HANDOVER: ['ROLE_HANDOVER', 'ROLE_ADMIN'],
}

export const WATER_SOLUBLE_ROLE_ERROR: Record<WaterSolublePdaRoleAction, string> = {
  OPERATE: '当前账号不能执行水溶现场操作。',
  SUPERVISE: '当前账号不能处理水溶生产暂停，请由生产主管或管理员处理。',
  HANDOVER: '当前账号不能执行水溶交出，请由交接员或管理员处理。',
}

export function canWaterSolubleRolePerform(roleId: string, action: WaterSolublePdaRoleAction): boolean {
  return ALLOWED_ROLES[action].includes(roleId)
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
  if (!canWaterSolubleRolePerform(actor.roleId, action)) return WATER_SOLUBLE_ROLE_ERROR[action]
  return null
}

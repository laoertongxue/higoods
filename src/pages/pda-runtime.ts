import { getCurrentPdaUser, getPdaSession } from '../data/fcs/store-domain-pda.ts'
import { renderRouteRedirect } from '../router/route-utils'
import { appStore } from '../state/store'

export interface PdaRuntimeContext {
  factoryId: string
  factoryName: string
  loginId: string
  roleId: string
  userId: string
  userName: string
}

export function getPdaRuntimeContext(): PdaRuntimeContext | null {
  const session = getPdaSession()
  const user = getCurrentPdaUser()
  if (!session || !user) return null

  return {
    factoryId: session.factoryId,
    factoryName: session.factoryName,
    loginId: session.loginId,
    roleId: session.roleId,
    userId: session.userId,
    userName: session.userName,
  }
}

export function renderPdaLoginRedirect(title = '工厂端移动应用登录'): string {
  return renderRouteRedirect('/fcs/pda/login', title)
}

export function ensurePdaSessionForAction(): boolean {
  const runtime = getPdaRuntimeContext()
  if (runtime) return true
  appStore.navigate('/fcs/pda/login', { historyMode: 'replace' })
  return false
}

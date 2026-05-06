import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  authenticateFactoryPdaUserByCredentials,
  clearPdaSession,
  createPdaSessionFromUser,
  setPdaSession,
} from '../data/fcs/store-domain-pda.ts'
import { clearFactoryOnboardingApplicantSession, setFactoryOnboardingApplicantSession } from '../data/fcs/factory-onboarding-store.ts'
import {
  authenticateFactoryOnboardingAdmin,
  createPdaOnboardingSessionFromApplication,
  getPdaCurrentAuthSession,
  resolvePdaPostLoginRoute,
} from '../data/fcs/factory-onboarding-flow.ts'

interface LoginState {
  loginId: string
  password: string
  errorText: string
}

const state: LoginState = {
  loginId: '',
  password: '',
  errorText: '',
}

function getCurrentSearchParams(): URLSearchParams {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return new URLSearchParams(query || '')
}

function getReturnTo(): string {
  return getCurrentSearchParams().get('returnTo') || ''
}

function syncLoggedInRedirect(): string | null {
  const session = getPdaCurrentAuthSession()
  if (!session) return null
  return resolvePdaPostLoginRoute(session, getReturnTo())
}

async function submitLogin(): Promise<void> {
  const loginId = state.loginId.trim()
  const password = state.password.trim()
  state.errorText = ''

  if (!loginId) {
    state.errorText = '请输入登录账户'
    return
  }
  if (!password) {
    state.errorText = '请输入登录密码'
    return
  }

  const officialResult = await authenticateFactoryPdaUserByCredentials(loginId, password)
  if (!officialResult.error && officialResult.user) {
    const session = createPdaSessionFromUser(officialResult.user)
    clearFactoryOnboardingApplicantSession()
    setPdaSession(session)
    appStore.navigate(resolvePdaPostLoginRoute({ kind: 'PDA', session }, getReturnTo()), { historyMode: 'replace' })
    return
  }

  const onboardingApplication = authenticateFactoryOnboardingAdmin(loginId, password)
  if (onboardingApplication) {
    const session = createPdaOnboardingSessionFromApplication(onboardingApplication)
    clearPdaSession()
    setFactoryOnboardingApplicantSession(session)
    appStore.navigate(
      resolvePdaPostLoginRoute({ kind: 'ONBOARDING', session, application: onboardingApplication }, getReturnTo()),
      { historyMode: 'replace' },
    )
    return
  }

  state.errorText = '账号或密码错误'
}

export function renderPdaLoginPage(): string {
  const redirectTo = syncLoggedInRedirect()
  if (redirectTo) {
    queueMicrotask(() => {
      if (appStore.getState().pathname !== redirectTo) {
        appStore.navigate(redirectTo, { historyMode: 'replace' })
      }
    })
  }

  return `
    <section class="min-h-screen bg-slate-50 px-4 py-8">
      <div class="mx-auto max-w-md space-y-4">
        <header class="space-y-1 text-center">
          <h1 class="text-2xl font-semibold text-foreground">工厂入驻&登录</h1>
          <p class="text-sm text-muted-foreground">已合作工厂登录后进入业务页，未合作工厂将进入入驻流程。</p>
        </header>

        <article class="rounded-3xl border bg-card p-5 shadow-sm">
          <div class="mb-5 space-y-1">
            <h2 class="text-lg font-semibold text-foreground">工厂登录</h2>
            <p class="text-xs text-muted-foreground">请输入登录账户和登录密码。</p>
          </div>

          ${state.errorText ? `<div class="mb-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(state.errorText)}</div>` : ''}

          <div class="space-y-4">
            <label class="block space-y-1.5 text-sm">
              <span class="font-medium text-foreground">登录账户</span>
              <input
                class="h-11 w-full rounded-2xl border px-3"
                placeholder="请输入登录账户"
                autocomplete="username"
                data-pda-login-field="loginId"
                value="${escapeHtml(state.loginId)}"
              />
            </label>

            <label class="block space-y-1.5 text-sm">
              <span class="font-medium text-foreground">登录密码</span>
              <input
                type="password"
                class="h-11 w-full rounded-2xl border px-3"
                placeholder="请输入登录密码"
                autocomplete="current-password"
                data-pda-login-field="password"
                value="${escapeHtml(state.password)}"
              />
            </label>
          </div>

          <div class="mt-5 grid grid-cols-1 gap-3">
            <button
              type="button"
              class="h-11 rounded-2xl bg-primary text-sm font-medium text-primary-foreground"
              data-pda-login-action="submit"
            >
              登录
            </button>
            <button
              type="button"
              class="h-11 rounded-2xl border bg-background text-sm font-medium"
              data-pda-login-action="go-onboarding"
            >
              去入驻
            </button>
          </div>
        </article>
      </div>
    </section>
  `
}

export async function handlePdaLoginEvent(target: HTMLElement): Promise<boolean> {
  const fieldNode = target.closest<HTMLElement>('[data-pda-login-field]')
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLTextAreaElement) {
    const field = fieldNode.dataset.pdaLoginField || ''
    if (field === 'loginId') state.loginId = fieldNode.value
    if (field === 'password') state.password = fieldNode.value
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-login-action]')
  const action = actionNode?.dataset.pdaLoginAction
  if (!action) return false

  if (action === 'submit') {
    await submitLogin()
    return true
  }

  if (action === 'go-onboarding') {
    appStore.navigate('/fcs/pda/auth/onboarding')
    return true
  }

  return false
}

import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  authenticateFactoryPdaUserByCredentials,
  authenticateFactoryPdaUserByLoginId,
  clearPdaSession,
  createPdaSessionFromUser,
  setPdaSession,
} from '../data/fcs/store-domain-pda.ts'
import { clearFactoryOnboardingApplicantSession, setFactoryOnboardingApplicantSession } from '../data/fcs/factory-onboarding-store.ts'
import {
  authenticateFactoryOnboardingAdmin,
  createPdaOnboardingSessionFromApplication,
  getFactoryOnboardingLoginFailureMessage,
  getPdaCurrentAuthSession,
  resolvePdaPostLoginRoute,
} from '../data/fcs/factory-onboarding-flow.ts'

void import('./pda-exec')
void import('../router/routes-pda')

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

function renderImmediatePdaExecLoading(): void {
  const host = document.querySelector('[data-page-content-root="true"]')
  if (!(host instanceof HTMLElement)) return
  host.innerHTML = `
    <section class="min-h-[720px] bg-background p-4" data-testid="pda-exec-page">
      <div class="rounded-2xl border bg-card p-4 shadow-sm">
        <h1 class="text-lg font-semibold text-foreground">执行</h1>
        <div class="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-700" data-testid="pda-exec-card-list">
          正在进入执行页
        </div>
      </div>
    </section>
  `
}

async function submitLogin(): Promise<void> {
  const loginId = state.loginId.trim()
  const password = state.password.trim()
  state.errorText = ''

  if (!loginId) {
    state.errorText = '请输入登录账号'
    return
  }
  if (!password) {
    state.errorText = '请输入密码'
    return
  }

  const previewResult = authenticateFactoryPdaUserByLoginId(loginId)
  const returnTo = getReturnTo()
  if (!previewResult.error && previewResult.user && (!returnTo || returnTo.startsWith('/fcs/pda/exec'))) {
    renderImmediatePdaExecLoading()
  }

  const officialResult = await authenticateFactoryPdaUserByCredentials(loginId, password)
  if (!officialResult.error && officialResult.user) {
    const session = createPdaSessionFromUser(officialResult.user)
    clearFactoryOnboardingApplicantSession()
    setPdaSession(session)
    const nextRoute = resolvePdaPostLoginRoute({ kind: 'PDA', session }, returnTo)
    if (nextRoute.startsWith('/fcs/pda/exec')) {
      renderImmediatePdaExecLoading()
    }
    appStore.navigate(nextRoute, { historyMode: 'replace' })
    return
  }

  const onboardingApplication = authenticateFactoryOnboardingAdmin(loginId, password)
  if (onboardingApplication) {
    const session = createPdaOnboardingSessionFromApplication(onboardingApplication)
    clearPdaSession()
    setFactoryOnboardingApplicantSession(session)
    appStore.navigate(
      resolvePdaPostLoginRoute({ kind: 'ONBOARDING', session, application: onboardingApplication }, returnTo),
      { historyMode: 'replace' },
    )
    return
  }

  state.errorText = getFactoryOnboardingLoginFailureMessage(loginId, password)
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
    <section class="min-h-screen bg-[linear-gradient(180deg,#eef5ff_0%,#f8fafc_28%,#f8fafc_100%)] px-4 py-6" data-testid="pda-auth-login-page">
      <div class="space-y-4">
        <header class="space-y-3 text-center">
          <div class="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
            <img
              src="/higood-logo.png"
              alt="HiGood"
              class="mx-auto h-auto w-full max-w-[220px] object-contain drop-shadow-sm"
            />
          </div>
          <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-slate-900">工厂入驻&登录</h1>
            <p class="text-sm text-slate-500">已转正式合作工厂直接登录，未合作工厂从这里进入入驻流程。</p>
          </div>
        </header>

        <article class="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <div class="mb-5 space-y-1">
            <h2 class="text-lg font-semibold text-slate-900">工厂登录</h2>
            <p class="text-xs text-slate-500">请输入登录账号和密码。</p>
          </div>

          ${state.errorText ? `<div class="mb-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(state.errorText)}</div>` : ''}

          <div class="space-y-4">
            <label class="block space-y-1.5 text-sm">
              <span class="font-medium text-slate-900">登录账号</span>
              <input
                class="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-[15px]"
                placeholder="请输入登录账号"
                autocomplete="username"
                data-pda-login-field="loginId"
                value="${escapeHtml(state.loginId)}"
              />
            </label>

            <label class="block space-y-1.5 text-sm">
              <span class="font-medium text-slate-900">密码</span>
              <input
                type="password"
                class="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-[15px]"
                placeholder="请输入密码"
                autocomplete="current-password"
                data-pda-login-field="password"
                value="${escapeHtml(state.password)}"
              />
            </label>
          </div>

          <div class="mt-5 grid grid-cols-1 gap-3">
            <button
              type="button"
              class="h-12 rounded-2xl bg-slate-900 text-sm font-medium text-white"
              data-fast-page-render="true"
              data-pda-login-action="submit"
            >
              登录
            </button>
            <button
              type="button"
              class="h-12 rounded-2xl border border-slate-200 bg-white text-sm font-medium text-slate-700"
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

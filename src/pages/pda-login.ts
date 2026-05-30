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

  const officialResult = authenticateFactoryPdaUserByCredentials(loginId, password)
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
    <section class="relative min-h-screen overflow-hidden bg-[#f5f7fb] px-5 py-8 text-[#0b1b38]" data-testid="pda-auth-login-page">
      <div class="pointer-events-none absolute inset-x-0 top-0 h-48 bg-white/70"></div>

      <div class="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[420px] flex-col pt-20">
        <header class="mb-6 text-center">
          <div class="text-[34px] font-bold leading-none text-[#0d2b55]">
            HiGOOD
          </div>
          <div class="mt-5 space-y-2">
            <h1 class="text-[28px] font-semibold leading-tight text-[#0b1b38]">工厂登录</h1>
            <p class="mx-auto max-w-[340px] text-sm leading-6 text-[#617087]">已合作工厂请登录，未合作工厂可申请入驻。</p>
          </div>
        </header>

        <article class="rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-[0_16px_40px_rgba(15,35,72,0.08)]">

          ${state.errorText ? `<div class="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(state.errorText)}</div>` : ''}

          <div class="space-y-5">
            <label class="block space-y-2 text-sm">
              <span class="font-semibold text-[#0b1b38]">登录账号</span>
              <div class="relative">
                <i data-lucide="user-round" class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#93a0b4]"></i>
                <input
                  class="h-12 w-full rounded-xl border border-[#cfd7e3] bg-white px-11 text-sm text-[#0b1b38] outline-none transition placeholder:text-[#98a3b3] focus:border-[#0d2b55] focus:ring-4 focus:ring-[#0d2b55]/10"
                  placeholder="请输入登录账号"
                  autocomplete="username"
                  data-pda-login-field="loginId"
                  value="${escapeHtml(state.loginId)}"
                />
              </div>
            </label>

            <label class="block space-y-2 text-sm">
              <span class="font-semibold text-[#0b1b38]">密码</span>
              <div class="relative">
                <i data-lucide="lock-keyhole" class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#93a0b4]"></i>
                <input
                  type="password"
                  class="h-12 w-full rounded-xl border border-[#cfd7e3] bg-white px-11 pr-12 text-sm text-[#0b1b38] outline-none transition placeholder:text-[#98a3b3] focus:border-[#0d2b55] focus:ring-4 focus:ring-[#0d2b55]/10"
                  placeholder="请输入密码"
                  autocomplete="current-password"
                  data-pda-login-field="password"
                  value="${escapeHtml(state.password)}"
                />
                <i data-lucide="eye-off" class="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#93a0b4]"></i>
              </div>
            </label>
          </div>

          <div class="mt-7 grid grid-cols-1 gap-3">
            <button
              type="button"
              class="h-12 rounded-xl bg-[#071327] text-base font-semibold text-white shadow-[0_10px_20px_rgba(7,19,39,0.16)] active:translate-y-px"
              data-fast-page-render="true"
              data-pda-login-action="submit"
            >
              登录
            </button>
            <button
              type="button"
              class="h-12 rounded-xl border border-[#c9d3e1] bg-white text-base font-semibold text-[#071327] active:translate-y-px"
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

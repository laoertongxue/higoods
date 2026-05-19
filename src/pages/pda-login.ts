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
    <section class="relative min-h-screen overflow-hidden bg-[#f7faff] px-5 py-16 text-[#0b1b38]" data-testid="pda-auth-login-page">
      <div class="pointer-events-none absolute -left-[28%] -top-[10%] h-[62vh] w-[96vw] rounded-full bg-white/80 shadow-[inset_0_0_80px_rgba(15,23,42,0.035)]"></div>
      <div class="pointer-events-none absolute -right-[22%] bottom-[7%] h-[54vh] w-[86vw] rounded-full bg-white/70 shadow-[inset_0_0_80px_rgba(15,23,42,0.03)]"></div>
      <div class="pointer-events-none absolute -bottom-[9%] -left-[12%] h-[24vh] w-[72vw] rounded-[50%] bg-white/60"></div>

      <div class="relative mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-[660px] flex-col justify-center">
        <header class="mb-9 text-center">
          <div class="text-[44px] font-bold leading-none tracking-[0.02em] text-[#0d2b55] drop-shadow-[0_10px_22px_rgba(13,43,85,0.08)]">
            HiGOOD
          </div>
          <div class="mt-9 space-y-3">
            <h1 class="text-[38px] font-semibold leading-tight tracking-[0.08em] text-[#0b1b38]">工厂入驻登录</h1>
            <p class="text-[17px] leading-7 text-[#617087]">已在平台合作的工厂请登录，未合作工厂请去入驻，开启合作之旅。</p>
          </div>
        </header>

        <article class="rounded-[24px] border border-white/80 bg-white/90 p-10 shadow-[0_28px_70px_rgba(15,35,72,0.12)] backdrop-blur">

          ${state.errorText ? `<div class="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-700">${escapeHtml(state.errorText)}</div>` : ''}

          <div class="space-y-8">
            <label class="block space-y-4 text-[17px]">
              <span class="font-semibold text-[#0b1b38]">登录账号</span>
              <div class="relative">
                <i data-lucide="user-round" class="pointer-events-none absolute left-6 top-1/2 h-6 w-6 -translate-y-1/2 text-[#93a0b4]"></i>
                <input
                  class="h-[84px] w-full rounded-[18px] border border-[#cfd7e3] bg-white/90 px-16 text-[19px] text-[#0b1b38] outline-none transition focus:border-[#0d2b55] focus:ring-4 focus:ring-[#0d2b55]/10"
                  placeholder="请输入登录账号"
                  autocomplete="username"
                  data-pda-login-field="loginId"
                  value="${escapeHtml(state.loginId)}"
                />
              </div>
            </label>

            <label class="block space-y-4 text-[17px]">
              <span class="font-semibold text-[#0b1b38]">密码</span>
              <div class="relative">
                <i data-lucide="lock-keyhole" class="pointer-events-none absolute left-6 top-1/2 h-6 w-6 -translate-y-1/2 text-[#93a0b4]"></i>
                <input
                  type="password"
                  class="h-[84px] w-full rounded-[18px] border border-[#cfd7e3] bg-white/90 px-16 pr-20 text-[19px] text-[#0b1b38] outline-none transition focus:border-[#0d2b55] focus:ring-4 focus:ring-[#0d2b55]/10"
                  placeholder="请输入密码"
                  autocomplete="current-password"
                  data-pda-login-field="password"
                  value="${escapeHtml(state.password)}"
                />
                <i data-lucide="eye-off" class="pointer-events-none absolute right-6 top-1/2 h-6 w-6 -translate-y-1/2 text-[#93a0b4]"></i>
              </div>
            </label>
          </div>

          <div class="mt-10 grid grid-cols-1 gap-5">
            <button
              type="button"
              class="h-[78px] rounded-[16px] bg-[#071327] text-[20px] font-semibold text-white shadow-[0_14px_28px_rgba(7,19,39,0.2)] active:translate-y-px"
              data-fast-page-render="true"
              data-pda-login-action="submit"
            >
              登录
            </button>
            <button
              type="button"
              class="h-[78px] rounded-[16px] border border-[#b9c4d3] bg-white/80 text-[20px] font-semibold text-[#071327] active:translate-y-px"
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

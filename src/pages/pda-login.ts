import {
  authenticateFactoryPdaUserByCredentials,
  createPdaSessionFromUser,
  getPdaSession,
  setPdaSession,
} from '../data/fcs/store-domain-pda.ts'
import { renderRouteRedirect } from '../router/route-utils'
import { appStore } from '../state/store'
import { escapeHtml } from '../utils'

interface PdaLoginState {
  loginId: string
  password: string
  errorText: string
}

const state: PdaLoginState = {
  loginId: '',
  password: '',
  errorText: '',
}

function requestPdaLoginRender(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('higood:request-render'))
  }
}

async function submitLogin(): Promise<void> {
  if (!state.loginId.trim()) {
    state.errorText = '请输入登录账户'
    requestPdaLoginRender()
    return
  }

  if (!state.password.trim()) {
    state.errorText = '请输入登录密码'
    requestPdaLoginRender()
    return
  }

  const result = await authenticateFactoryPdaUserByCredentials(state.loginId, state.password)
  if (!result.user) {
    state.errorText =
      result.error === 'LOCKED'
        ? '账户已锁定，无法登录'
        : result.error === 'INVALID_CREDENTIALS'
          ? '账户或密码错误'
          : '账户不存在'
    requestPdaLoginRender()
    return
  }

  setPdaSession(createPdaSessionFromUser(result.user))
  state.password = ''
  state.errorText = ''
  appStore.navigate('/fcs/pda/notify', { historyMode: 'replace' })
  requestPdaLoginRender()
}

export function renderPdaLoginPage(): string {
  if (getPdaSession()) {
    return renderRouteRedirect('/fcs/pda/notify', '工厂端移动应用')
  }

  return `
    <section class="mx-auto flex min-h-[760px] max-w-[420px] items-center justify-center bg-muted/20 px-5 py-10">
      <div class="w-full space-y-5 rounded-3xl border bg-background p-6 shadow-sm">
        <div class="space-y-2 text-center">
          <div class="text-xs text-muted-foreground">FCS</div>
          <h1 class="text-2xl font-semibold text-foreground">工厂端移动应用登录</h1>
        </div>

        <div class="space-y-2">
          <label class="space-y-1.5">
            <span class="text-sm text-muted-foreground">登录账户</span>
            <input
              type="text"
              value="${escapeHtml(state.loginId)}"
              placeholder="请输入登录账户"
              autocomplete="off"
              data-pda-login-field="loginId"
              class="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </label>
          <label class="space-y-1.5">
            <span class="text-sm text-muted-foreground">登录密码</span>
            <input
              type="password"
              value="${escapeHtml(state.password)}"
              placeholder="请输入登录密码"
              autocomplete="off"
              data-pda-login-field="password"
              class="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </label>
          ${
            state.errorText
              ? `<p class="text-sm text-destructive">${escapeHtml(state.errorText)}</p>`
              : '<p class="text-sm text-muted-foreground">登录账户在所有工厂中唯一</p>'
          }
        </div>

        <button
          type="button"
          data-pda-login-action="submit"
          class="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          登录
        </button>
      </div>
    </section>
  `
}

export function handlePdaLoginEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pda-login-field]')
  if (fieldNode instanceof HTMLInputElement) {
    if (fieldNode.dataset.pdaLoginField === 'loginId') {
      state.loginId = fieldNode.value
      state.errorText = ''
      return true
    }
    if (fieldNode.dataset.pdaLoginField === 'password') {
      state.password = fieldNode.value
      state.errorText = ''
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-login-action]')
  if (!actionNode) return false

  if (actionNode.dataset.pdaLoginAction === 'submit') {
    void submitLogin()
    return true
  }

  return false
}

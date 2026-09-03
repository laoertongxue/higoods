// @page-pattern: dashboard

import {
  getCurrentPostFinishingAuthorizedPerson,
  getPostFinishingAuthorizationDisplay,
} from '../../../data/fcs/post-finishing-authorization.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPostFinishingPageHeader } from './shared.ts'

let refreshTimer: number | undefined

function scheduleRefresh(validUntilMs: number): void {
  if (typeof window === 'undefined') return
  window.clearTimeout(refreshTimer)
  refreshTimer = window.setTimeout(() => {
    appStore.navigate(`/fcs/craft/post-finishing/authorization-code?refresh=${Date.now()}`)
  }, Math.max(250, validUntilMs - Date.now() + 80))
}

export function renderPostFinishingAuthorizationCodePage(): string {
  const person = getCurrentPostFinishingAuthorizedPerson()
  if (!person) {
    if (typeof window !== 'undefined') window.clearTimeout(refreshTimer)
    return `<div class="space-y-4 p-4" data-testid="post-finishing-authorization-page">
      ${renderPostFinishingPageHeader('我的动态授权码', '仅指定授权人员本人可见')}
      <section class="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <div class="text-lg font-semibold text-amber-950">当前账号没有授权权限</div>
        <p class="mt-2 text-sm text-amber-800">授权码只向指定的 QC 主管、后道经理和仓库主管显示。请使用本人账号登录，不通过网址参数切换身份。</p>
      </section>
    </div>`
  }

  const display = getPostFinishingAuthorizationDisplay(person.authorizerId)
  scheduleRefresh(display.validUntilMs)
  return `<div class="space-y-4 p-4" data-testid="post-finishing-authorization-page">
    ${renderPostFinishingPageHeader('我的动态授权码', '30 秒自动刷新 · 每个授权码只能使用一次')}
    <section class="mx-auto max-w-3xl rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div><div class="text-sm text-muted-foreground">当前授权人</div><div class="mt-1 text-xl font-semibold">${escapeHtml(display.authorizerName)}</div><div class="mt-1 text-sm text-blue-700">${escapeHtml(display.roleName)}</div></div>
        <div class="rounded-xl border bg-white px-4 py-3 text-center"><div class="text-xs text-muted-foreground">本时段剩余</div><strong class="mt-1 block text-2xl text-blue-700" data-authorization-countdown>${display.remainingSeconds} 秒</strong></div>
      </div>
      <div class="mt-6 rounded-2xl bg-slate-950 px-5 py-7 text-center text-white">
        <div class="text-xs text-slate-300">六位动态授权码</div>
        <div class="mt-3 font-mono text-5xl font-bold tracking-[0.22em]" data-authorization-code>${escapeHtml(display.code)}</div>
      </div>
      <div class="mt-4 rounded-xl border bg-white p-4"><div class="text-xs font-medium text-slate-600">完整授权内容（现场扫码或复制使用）</div><div class="mt-2 break-all rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-700" data-authorization-scan-payload>${escapeHtml(display.scanPayload)}</div></div>
      <div class="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">授权只确认当前业务差异，不代替操作人员本人的账号和操作记录；已使用、已过期或非授权人员生成的码都会被阻断。</div>
    </section>
  </div>`
}

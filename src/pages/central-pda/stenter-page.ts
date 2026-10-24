// @page-pattern: pda
import { appStore } from '../../state/store.ts'
import { escapeHtml } from '../../utils.ts'
import { getFactoryMasterRecordById } from '../../data/fcs/factory-master-store.ts'
import { isCentralPdaFactory } from '../../data/fcs/pda-experience-scope.ts'
import { createPdaSessionFromUser, setPdaSession } from '../../data/fcs/store-domain-pda.ts'
import { getStenterHandfeelOrder, STENTER_FACTORY } from '../../data/fcs/stenter-handfeel.ts'
import { handleStenterHandfeelEvent, renderStenterHandfeelDetailPage, renderStenterHandfeelListPage } from '../process-factory/dyeing/stenter-handfeel/work-orders.ts'
import { renderCentralPdaFrame, type CentralPdaFrameInput, type CentralPdaTab } from './frame.ts'
import { centralSession as session, ensureCentralSessionAccount, saveCentralSessionPreference } from './session.ts'
import { centralFormalName } from './ui.ts'
import { renderCentralOperationMenu } from './operation-menu.ts'

const prefix = '/fcs/pda/central/stenter'

function route(path: string) {
  const url = new URL(path || prefix + '/receive', 'https://pda.local'), parts = url.pathname.split('/')
  let id = ''
  try { id = decodeURIComponent(parts[6] || '') } catch { }
  const tab = (['receive', 'execute', 'warehouse'].includes(parts[5]) ? parts[5] : 'receive') as CentralPdaTab
  return { tab, id, factoryId: url.searchParams.get('factoryId') || '' }
}

function centralFactoryId(candidate: string): string | undefined {
  const factory = candidate ? getFactoryMasterRecordById(candidate) : undefined
  return factory && factory.status === 'active' && isCentralPdaFactory(factory) ? factory.id : undefined
}

function resolveFactoryId(path: string): string {
  return centralFactoryId(route(path).factoryId)
    || centralFactoryId(session.currentFactory)
    || centralFactoryId(session.preference.factoryId || '')
    || STENTER_FACTORY.id
}

function syncPdaSession(): void {
  setPdaSession(session.account ? createPdaSessionFromUser(session.account) : null)
}

function frameBase(factoryId: string, tab: CentralPdaTab): CentralPdaFrameInput {
  const factory = getFactoryMasterRecordById(factoryId)
  return {
    family: 'stenter',
    accountName: session.account ? centralFormalName(session.account.name, session.account.loginId, session.language) : (session.language === 'id' ? 'Belum masuk' : '未登录'),
    accountNo: '',
    factoryName: centralFormalName(factory?.name, factory?.code || factoryId, session.language),
    operationName: session.language === 'id' ? 'Hasil rabaan' : '定型机手感',
    language: session.language,
    tab,
    tabPathPrefix: prefix,
    content: '',
  }
}

async function rerender(): Promise<void> {
  const root = document.querySelector<HTMLElement>('[data-central-pda-root][data-central-family="stenter"]')
  if (!root) return
  const html = await renderCentralStenterPage(appStore.getState().pathname, () => true)
  const template = document.createElement('template')
  template.innerHTML = html
  const next = template.content.firstElementChild
  if (next) root.replaceWith(next)
}

export async function renderCentralStenterPage(path: string, current: () => boolean): Promise<string> {
  const r = route(path), factoryId = resolveFactoryId(path)
  session.currentFactory = factoryId
  const account = ensureCentralSessionAccount(factoryId)
  syncPdaSession()
  const base = frameBase(factoryId, r.tab)
  if (!account) {
    return renderCentralPdaFrame({ ...base, heading: base.operationName, content: `<p class="p-4 text-sm text-amber-800">${session.language === 'id' ? 'Masuk akun pabrik pusat terlebih dahulu.' : '请先登录中央工厂账号后再处理定型机手感。'}</p>` })
  }
  try { await (await import('../../data/pcs-record-runtime.ts')).ensurePcsRecordState() }
  catch (error) {
    return renderCentralPdaFrame({ ...base, heading: base.operationName, content: `<p class="p-4 text-sm text-red-700" role="alert">${session.language === 'id' ? 'Data belum dapat dimuat.' : '资料无法读取，请重新进入页面。'} ${escapeHtml(error instanceof Error ? error.message : String(error))}</p>` })
  }
  if (r.id) {
    const order = getStenterHandfeelOrder(r.id)
    const html = await renderStenterHandfeelDetailPage(r.id, true, { shell: false, route: prefix, tab: r.tab, embedded: true, mobile: true })
    if (!current()) return ''
    return renderCentralPdaFrame({ ...base, heading: order?.no || base.operationName, backPath: prefix + '/' + r.tab, content: html })
  }
  const html = await renderStenterHandfeelListPage(true, { shell: false, route: prefix, tab: r.tab, embedded: true, mobile: true })
  if (!current()) return ''
  return renderCentralPdaFrame({ ...base, heading: base.operationName, content: html })
}
export function mountCentralStenterPage(): void {
  document.querySelector<HTMLInputElement>('[data-central-content] [data-stenter-filter="query"]')?.focus({ preventScroll: true })
}
function closeDialogIfOpen(): boolean {
  const dialog = document.querySelector<HTMLElement>('[data-stenter-dialog]')
  if (!dialog) return false
  dialog.querySelector<HTMLButtonElement>('[data-stenter-dialog-action="close"]')?.click()
  return true
}

export async function handleCentralStenterEvent(target: Element, event?: Event): Promise<boolean> {
  const action = target.closest<HTMLElement>('[data-central-action]')?.dataset.centralAction
  if (['language', 'logout', 'operation'].includes(action || '') && closeDialogIfOpen()) return true
  if (action === 'language') {
    session.language = session.language === 'id' ? 'zh' : 'id'
    saveCentralSessionPreference()
    await rerender()
    return true
  }
  if (action === 'logout') {
    session.account = undefined
    session.signedOut = true
    saveCentralSessionPreference()
    setPdaSession(null)
    await rerender()
    return true
  }
  if (target.closest('[data-stenter-operation-close]')) {
    document.querySelector('[data-stenter-operation-menu]')?.remove()
    return true
  }
  if (action === 'operation') {
    document.querySelector('[data-stenter-operation-menu]')?.remove()
    const menu = document.createElement('div')
    menu.dataset.stenterOperationMenu = ''
    menu.className = 'fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-2'
    menu.innerHTML = `<section role="dialog" aria-modal="true" class="max-h-[90dvh] w-full max-w-[420px] overflow-y-auto rounded-2xl bg-white p-3">${renderCentralOperationMenu({ language: session.language, tab: route(appStore.getState().pathname).tab, factoryId: session.currentFactory, currentPath: appStore.getState().pathname })}<div class="mt-3"><button type="button" class="min-h-[52px] w-full rounded-xl border border-[#ccd8e7] bg-white px-3 text-[15px] font-semibold text-[#62748a]" data-stenter-operation-close>${session.language === 'id' ? 'Tutup' : '关闭'}</button></div></section>`
    menu.addEventListener('click', event => { if (event.target === menu) menu.remove() })
    document.body.append(menu)
    return true
  }
  const nav = target.closest<HTMLElement>('[data-central-nav]')
  if (nav?.dataset.centralNav) {
    if (closeDialogIfOpen()) return true
    appStore.navigate(nav.dataset.centralNav)
    return true
  }
  return handleStenterHandfeelEvent(target as HTMLElement, event)
}
export function closeCentralStenterOverlay(): void {
  document.querySelector('[data-stenter-dialog]')?.remove()
  document.querySelector('[data-stenter-operation-slot]')?.replaceChildren()
}

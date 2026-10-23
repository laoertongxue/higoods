// @page-pattern: pda
import { appStore } from '../../state/store.ts'
let woolCraft: typeof import('./wool-craft-page.ts') | undefined
let wool: typeof import('./wool-page.ts') | undefined
let woolStock: typeof import('./wool-warehouse-page.ts') | undefined
let cutting: typeof import('./cutting-page.ts') | undefined
let special: typeof import('./page.ts') | undefined
let dye: typeof import('./dye-page.ts') | undefined
let water: typeof import('./water-page.ts') | undefined
let print: typeof import('./print-page.ts') | undefined
let washing: typeof import('./washing-page.ts') | undefined
let binding: typeof import('./binding-page.ts') | undefined
let webbing: typeof import('./webbing-page.ts') | undefined
let post: typeof import('./post-page.ts') | undefined
let lace: typeof import('./lace-page.ts') | undefined
let renderSequence = 0
const visibleFamily = (target?: Element) => (target?.closest<HTMLElement>('[data-central-pda-root]') || document.querySelector<HTMLElement>('[data-central-pda-root]'))?.dataset.centralFamily

// These two process domains read part tickets at import time. Prepare records
// before importing them, retaining a usable PDA retry and account bar on failure.
let processEntryFailure: { path: string; error: unknown } | undefined
async function failedProcessEntry(path: string, error: unknown) {
  processEntryFailure = { path, error }
  const family = /^\/fcs\/pda\/central\/print(?:\/|$)/.test(path.split('?')[0]) ? 'print' : 'dye'
  const [{ renderCentralPdaFrame }, ui, { centralSession: session, ensureCentralSessionAccount }, { getFactoryMasterRecordById }, { dt }] = await Promise.all([
    import('./frame.ts'), import('./ui.ts'), import('./session.ts'), import('../../data/fcs/factory-master-store.ts'), import('./dye-ui.ts'),
  ])
  const language = session.language, factoryId = session.currentFactory || session.preference.factoryId || ''
  const factory = getFactoryMasterRecordById(factoryId), part = path.split(/[?#]/)[0].split('/')[5]
  if (factory) ensureCentralSessionAccount(factoryId)
  return renderCentralPdaFrame({ family, language,
    accountName: session.account ? ui.centralFormalName(session.account.name, session.account.loginId, language) : session.signedOut ? ui.ct(language, 'account') : session.preference.accountId || ui.ct(language, 'account'), accountNo: '',
    factoryName: ui.centralFormalName(factory?.name, factory?.code || factoryId, language), operationName: family === 'print' ? language === 'id' ? 'Pencetakan' : '印花' : language === 'id' ? 'Pencelupan' : '染色',
    tab: part === 'execute' || part === 'warehouse' ? part : 'receive', tabPathPrefix: '/fcs/pda/central/' + family,
    content: `<div data-central-${family}-entry-failure>${ui.centralNotice(dt(language, 'readFailed'), true)}</div>`,
    primary: { action: 'reload', label: ui.ct(language, 'reload') } })
}

export async function renderCentralPdaPage(path: string) {
  const sequence = ++renderSequence
  const current = () => sequence === renderSequence && appStore.getState().pathname.split(/[?#]/)[0] === path.split(/[?#]/)[0]
  if (/^\/fcs\/pda\/central\/lace(?:\/|$)/.test(path.split('?')[0])) {
    lace ??= await import('./lace-page.ts')
    if (!current()) return ''
    return lace.renderCentralLacePage(path, current)
  }
  if (/^\/fcs\/pda\/central\/post(?:\/|$)/.test(path.split('?')[0])) {
    post ??= await import('./post-page.ts')
    if (!current()) return ''
    return post.renderCentralPostPage(path, current)
  }
  if (/^\/fcs\/pda\/central\/webbing(?:\/|$)/.test(path.split('?')[0])) {
    webbing ??= await import('./webbing-page.ts')
    if (!current()) return ''
    return webbing.renderCentralWebbingPage(path, current)
  }
  if (/^\/fcs\/pda\/central\/binding(?:\/|$)/.test(path.split('?')[0])) {
    binding ??= await import('./binding-page.ts')
    if (!current()) return ''
    return binding.renderCentralBindingPage(path, current)
  }
  if (/^\/fcs\/pda\/central\/wool-craft(?:\/|$)/.test(path.split('?')[0])) {
    woolCraft ??= await import('./wool-craft-page.ts')
    if (!current()) return ''
    return woolCraft.renderCentralWoolCraftPage(path, current)
  }
  if (/^\/fcs\/pda\/central\/wool\/warehouse(?:\/|$)/.test(path.split('?')[0])) {
    woolStock ??= await import('./wool-warehouse-page.ts')
    if (!current()) return ''
    return woolStock.renderCentralWoolWarehousePage(path, current)
  }
  if (/^\/fcs\/pda\/central\/wool(?:\/|$)/.test(path.split('?')[0])) {
    wool ??= await import('./wool-page.ts')
    if (!current()) return ''
    return wool.renderCentralWoolPage(path, current)
  }
  if (/^\/fcs\/pda\/central\/cut(?:\/|$)/.test(path.split('?')[0])) {
    cutting ??= await import('./cutting-page.ts')
    if (!current()) return ''
    return cutting.renderCentralCuttingPage(path, current)
  }
  if (/^\/fcs\/pda\/central\/wash(?:\/|$)/.test(path.split('?')[0])) {
    washing ??= await import('./washing-page.ts')
    if (!current()) return ''
    return washing.renderCentralWashingPage(path, current)
  }
  if (/^\/fcs\/pda\/central\/print(?:\/|$)/.test(path.split('?')[0])) {
    if (!print) try {
      await (await import('../../data/pcs-record-runtime.ts')).ensurePcsRecordState()
      await (await import('../../data/fcs/cutting/part-ticket-records.ts')).hydratePartTicketRecords()
      print = await import('./print-page.ts')
    } catch (error) { return current() ? failedProcessEntry(path, error) : '' }
    if (!current()) return ''
    processEntryFailure = undefined
    return print.renderCentralPrintPage(path, current)
  }
  if (/^\/fcs\/pda\/central\/water(?:\/|$)/.test(path.split('?')[0])) {
    water ??= await import('./water-page.ts')
    if (!current()) return ''
    return water.renderCentralWaterPage(path, current)
  }
  if (/^\/fcs\/pda\/central\/dye(?:\/|$)/.test(path.split('?')[0])) {
    if (!dye) try {
      await (await import('../../data/pcs-record-runtime.ts')).ensurePcsRecordState()
      await (await import('../../data/fcs/cutting/part-ticket-records.ts')).hydratePartTicketRecords()
      dye = await import('./dye-page.ts')
    } catch (error) { return current() ? failedProcessEntry(path, error) : '' }
    if (!current()) return ''
    processEntryFailure = undefined
    return dye.renderCentralDyePage(path, current)
  }
  special ??= await import('./page.ts')
  if (!current()) return ''
  return special.renderCentralPdaPage(path, current)
}
export function mountCentralPdaPage() {
  if (document.querySelector('[data-central-dye-entry-failure], [data-central-print-entry-failure]')) {
    document.querySelectorAll<HTMLButtonElement>('[data-central-pda-root] [data-central-nav], [data-central-pda-root] [data-central-action="operation"]').forEach(button => { button.disabled = true })
    document.querySelector<HTMLButtonElement>('[data-central-pda-root] [data-central-footer] button')?.focus({ preventScroll: true })
    return
  }
  if (visibleFamily() === 'lace') lace?.mountCentralLacePage()
  else if (visibleFamily() === 'webbing') webbing?.mountCentralWebbingPage()
  else if (visibleFamily() === 'post') post?.mountCentralPostPage()
  else if (visibleFamily() === 'binding') binding?.mountCentralBindingPage()
  else if (visibleFamily() === 'wool-stock') woolStock?.mountCentralWoolWarehousePage()
  else if (visibleFamily() === 'wool-craft') woolCraft?.mountCentralWoolCraftPage()
  else if (visibleFamily() === 'wool') wool?.mountCentralWoolPage()
  else if (visibleFamily() === 'cutting') cutting?.mountCentralCuttingPage()
  else if (visibleFamily() === 'washing') washing?.mountCentralWashingPage()
  else if (visibleFamily() === 'print') print?.mountCentralPrintPage()
  else if (visibleFamily() === 'water') water?.mountCentralWaterPage()
  else if (visibleFamily() === 'dye') dye?.mountCentralDyePage()
  else special?.mountCentralPdaPage()
}
export async function handleCentralPdaEvent(target: Element, event?: Event) {
  if (processEntryFailure && target.closest('[data-central-pda-root]')?.querySelector('[data-central-dye-entry-failure], [data-central-print-entry-failure]')) {
    if (event?.type === 'keydown' && (event as KeyboardEvent).key === 'F1') {
      event.preventDefault(); target.closest('[data-central-pda-root]')?.querySelector<HTMLButtonElement>('[data-central-footer] button')?.focus(); return true
    }
    const control = target.closest<HTMLButtonElement>('[data-central-action]')
    if (event?.type !== 'click' || !control) return true
    const { centralSession: session, saveCentralSessionPreference, discardCentralDrafts } = await import('./session.ts')
    if (control.dataset.centralAction === 'reload') window.location.reload()
    else if (['language', 'logout'].includes(control.dataset.centralAction || '')) {
      if (control.dataset.centralAction === 'language') session.language = session.language === 'id' ? 'zh' : 'id'
      else { discardCentralDrafts(); session.account = undefined; session.signedOut = true }
      saveCentralSessionPreference()
      const html = await failedProcessEntry(processEntryFailure.path, processEntryFailure.error), template = document.createElement('template')
      template.innerHTML = html
      const root = target.closest<HTMLElement>('[data-central-pda-root]')!, next = template.content.firstElementChild!
      root.lang = next.getAttribute('lang') || ''
      for (const selector of [':scope > header', '[data-central-heading]', '[data-central-content]', '[data-central-footer]', ':scope > nav']) {
        const old = root.querySelector(selector), replacement = next.querySelector(selector)
        if (old && replacement) old.replaceWith(replacement)
      }
      mountCentralPdaPage()
    }
    return true
  }
  return visibleFamily(target) === 'lace' ? lace?.handleCentralLaceEvent(target, event) : visibleFamily(target) === 'post' ? post?.handleCentralPostEvent(target, event) : visibleFamily(target) === 'webbing' ? webbing?.handleCentralWebbingEvent(target, event) : visibleFamily(target) === 'binding' ? binding?.handleCentralBindingEvent(target, event) : visibleFamily(target) === 'wool-stock' ? woolStock?.handleCentralWoolWarehouseEvent(target, event) : visibleFamily(target) === 'wool-craft' ? woolCraft?.handleCentralWoolCraftEvent(target, event) : visibleFamily(target) === 'wool' ? wool?.handleCentralWoolEvent(target, event) : visibleFamily(target) === 'cutting' ? cutting?.handleCentralCuttingEvent(target, event) : visibleFamily(target) === 'washing' ? washing?.handleCentralWashingEvent(target, event) : visibleFamily(target) === 'print' ? print?.handleCentralPrintEvent(target, event) : visibleFamily(target) === 'water' ? water?.handleCentralWaterEvent(target, event) : visibleFamily(target) === 'dye' ? dye?.handleCentralDyeEvent(target, event) : special?.handleCentralPdaEvent(target, event)
}
export function closeCentralPdaOverlay() {
  return visibleFamily() === 'lace' ? lace?.closeCentralLaceOverlay() : visibleFamily() === 'post' ? post?.closeCentralPostOverlay() : visibleFamily() === 'webbing' ? webbing?.closeCentralWebbingOverlay() : visibleFamily() === 'binding' ? binding?.closeCentralBindingOverlay() : visibleFamily() === 'wool-stock' ? woolStock?.closeCentralWoolWarehouseOverlay() : visibleFamily() === 'wool-craft' ? woolCraft?.closeCentralWoolCraftOverlay() : visibleFamily() === 'wool' ? wool?.closeCentralWoolOverlay() : visibleFamily() === 'cutting' ? cutting?.closeCentralCuttingOverlay() : visibleFamily() === 'washing' ? washing?.closeCentralWashingOverlay() : visibleFamily() === 'print' ? print?.closeCentralPrintOverlay() : visibleFamily() === 'water' ? water?.closeCentralWaterOverlay() : visibleFamily() === 'dye' ? dye?.closeCentralDyeOverlay() : special?.closeCentralPdaOverlay()
}

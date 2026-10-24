// @page-pattern: pda
import { appStore } from '../../state/store.ts'
import { hydrateIcons } from '../../components/shell.ts'
import { getFactoryMasterRecordById, listFactoryMasterRecords } from '../../data/fcs/factory-master-store.ts'
import { isCentralPdaFactory } from '../../data/fcs/pda-experience-scope.ts'
import { readFactoryPdaExecutionUsers, normalizePdaLoginId, verifyPdaPassword } from '../../data/fcs/store-domain-pda.ts'
import type { PostFinishingFactoryReturnDelivery } from '../../data/fcs/post-finishing-full-flow.ts'
import { centralSession as session, ensureCentralSessionAccount, saveCentralSessionPreference, discardCentralDrafts, registerCentralDraftDiscard } from './session.ts'
import { renderCentralPdaFrame, type CentralPdaFrameInput } from './frame.ts'
import { cb, ce, ct, centralNotice, centralFormalName } from './ui.ts'
import { centralSewingSources, centralSewingSource, centralSewingRemaining, centralSewingRecent, saveCentralSewingReturn, centralSewingPhoto, releaseCentralSewingPhoto, centralSewingCanDiscard, discardCentralSewingReturn } from './post-sewing-model.ts'

const prefix = '/fcs/pda/central/post', pathPrefix = prefix + '/sewing-return'
let path = '', generation = 0, saving = false, locked = false, sourceValue = '', source: ReturnType<typeof centralSewingSource> | undefined
let person = '', phone = '', photoUrl = '', message: unknown, success = '', scan = '', operationId = '', current: PostFinishingFactoryReturnDelivery | undefined, discardReason = ''
let login = { account: '', password: '' }
const quantities = new Map<string, string>()
const root = () => document.querySelector<HTMLElement>('[data-central-family="post"]')
const lang = () => session.language, t = (key: Parameters<typeof ct>[1]) => ct(lang(), key)
const dirty = () => locked && (!!sourceValue || !!person.trim() || !!phone.trim() || !!photoUrl || [...quantities.values()].some(value => Number(value) > 0))
registerCentralDraftDiscard(() => { reset(); locked = false }, dirty)

function frame(): CentralPdaFrameInput {
  const factory = getFactoryMasterRecordById(session.currentFactory)
  const base: CentralPdaFrameInput = { family: 'post', language: lang(), tab: 'warehouse', tabPathPrefix: prefix, accountName: centralFormalName(session.account?.name, session.account?.loginId || '', lang()), accountNo: '', factoryName: centralFormalName(factory?.name, factory?.code || '', lang()), operationName: lang() === 'id' ? 'Finishing' : '后道', content: '' }
  let content = message ? centralNotice(message instanceof Error ? message.message : t('notSaved'), true) : success ? centralNotice(success) : ''
  if (!session.account) {
    base.heading = t('login')
    base.content = content + `<label class="mb-3 block">${t('account')}<input class="mt-2 min-h-12 w-full rounded-xl border bg-white p-3" data-sewing-login="account" value="${ce(login.account)}" autocomplete="username"></label><label class="mb-3 block">${t('password')}<input type="password" class="mt-2 min-h-12 w-full rounded-xl border bg-white p-3" data-sewing-login="password" value="${ce(login.password)}" autocomplete="current-password"></label>`
    base.primary = { label: t('login'), action: 'sewing-login' }; return base
  }
  base.heading = lang() === 'id' ? 'Kembali jahit' : '车缝回货'
  base.backPath = prefix + '/warehouse'
  if (!locked) {
    content += `<section class="mb-3 rounded-xl border bg-white p-3"><h2 class="text-lg font-bold">${lang() === 'id' ? 'Pengiriman jahit ke pabrik' : '车缝送货到厂'}</h2><p class="mt-1 text-sm">${lang() === 'id' ? 'Mesin publik · didaftarkan oleh pengirim.' : '公共机 · 送货人登记'}</p><p class="mt-2 text-sm text-slate-600">${lang() === 'id' ? 'Pendaftaran terpisah dari penerimaan finishing.' : '送货登记与后道点收分别记录。'}</p></section>`
    if (current) content += record(current)
    if (centralSewingRecent(session.currentFactory, session.account.userId).length) content += `<h2 class="mb-2 mt-4 text-lg font-bold">${lang() === 'id' ? 'Terakhir di perangkat ini' : '本机最近登记'}</h2>` + centralSewingRecent(session.currentFactory, session.account.userId).map(record).join('')
    base.primary = { label: lang() === 'id' ? 'Mulai mode kembali jahit' : '开启车缝回货模式', action: 'sewing-start', disabled: saving }
    base.content = content; return base
  }
  if (current) {
    content += record(current) + `<p class="mt-2 text-sm text-slate-600">${lang() === 'id' ? 'Diterima terpisah oleh finishing.' : '已登记，待后道点收；实收由后道独立填写。'}</p>`
    if (session.account && centralSewingCanDiscard(current, session.account)) content += `<details class="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-2"><summary class="min-h-8 font-semibold">${lang() === 'id' ? 'Salah daftar? Batalkan' : '登记有误？废弃本次'}</summary><label class="mt-1 block text-sm">${lang() === 'id' ? 'Alasan' : '废弃原因'}<input class="mt-1 min-h-12 w-full rounded-xl border bg-white p-2" data-sewing-discard-reason value="${ce(discardReason)}"></label><div class="mt-1">${cb(lang() === 'id' ? 'Batalkan pendaftaran' : '废弃本次登记', 'sewing-discard-return')}</div></details>`
    base.primary = { label: lang() === 'id' ? 'Lanjut pendaftaran berikutnya' : '继续下一次登记', action: 'sewing-next', disabled: saving }
    base.content = content; return base
  }
  if (!source) {
    content += `<section class="mb-3 rounded-xl border bg-white p-3"><div class="text-3xl">⌁</div><h2 class="mt-2 text-lg font-bold">${lang() === 'id' ? 'Pindai kode sumber kembali' : '扫本次回货来源码'}</h2><p class="text-sm text-slate-600">${lang() === 'id' ? 'Pabrik, tugas, dan urutan terisi otomatis.' : '来源工厂、任务和回货序号自动带出。'}</p></section>`
      + `<label class="mb-3 block font-semibold">${lang() === 'id' ? 'Kode sumber' : '回货来源码'}<div class="mt-2 flex gap-2"><input class="min-h-14 min-w-0 flex-1 rounded-xl border bg-white p-3 text-lg" data-sewing-scan value="${ce(scan)}" placeholder="PFRETURN:..." autocomplete="off">${cb(lang() === 'id' ? 'Pindai' : '识别', 'sewing-scan')}</div></label>`
      + `<details class="mb-3 rounded-xl border bg-white p-3"><summary class="min-h-8 font-semibold">${lang() === 'id' ? 'Kode rusak? Cari tugas' : '码损坏？按任务找'}</summary><div class="mt-2 grid gap-2">${centralSewingSources(session.currentFactory).slice(0, 12).map(row => cb(`${row.productionOrderNo} · ${row.returnIndex}`, 'sewing-source', row.scanValue)).join('') || centralNotice(lang() === 'id' ? 'Tidak ada sumber.' : '当前没有可回货来源。')}</div></details>`
    base.content = content; return base
  }
  const order = source.productionOrder, remaining = centralSewingRemaining(order)
  content += `<section class="mb-3 rounded-xl border bg-white p-3"><div class="text-sm">${ce(order.sewingFactoryName)} → ${lang() === 'id' ? 'Finishing' : '后道'}</div><strong class="block break-words">${ce(order.productionOrderNo)} · ${lang() === 'id' ? 'Ke' : '第'} ${source.returnIndex} ${lang() === 'id' ? 'kali' : '次'}</strong></section>`
    + `<h2 class="mb-2 text-lg font-bold">${lang() === 'id' ? 'Jumlah kirim' : '本次送货数量'}</h2>`
    + remaining.map(sku => `<label class="mb-2 block text-sm">${ce(sku.skuCode)} · ${lang() === 'id' ? 'Sisa' : '还可登记'} ${sku.remaining} ${lang() === 'id' ? 'buah' : '件'}<input class="mt-1 min-h-12 w-full rounded-xl border bg-white p-2 text-base" data-sewing-qty="${ce(sku.skuId)}" inputmode="numeric" value="${ce(quantities.get(sku.skuId) ?? '0')}"></label>`).join('')
    + `<label class="mb-2 block text-sm">${lang() === 'id' ? 'Nama pengirim' : '送货人姓名'}<input class="mt-1 min-h-12 w-full rounded-xl border bg-white p-2 text-base" data-sewing-person value="${ce(person)}"></label>`
    + `<label class="mb-2 block text-sm">${lang() === 'id' ? 'Telepon (opsional)' : '联系方式 (选填)'}<input class="mt-1 min-h-12 w-full rounded-xl border bg-white p-2 text-base" data-sewing-phone value="${ce(phone)}"></label>`
    + `<section class="mb-3 rounded-xl border bg-white p-3"><div class="font-semibold">${lang() === 'id' ? 'Bukti lapangan' : '现场凭证'} <span class="text-sm text-slate-500">${lang() === 'id' ? 'min. 1 foto' : '至少 1 张'}</span></div>${photoUrl ? `<img class="mt-2 h-24 w-24 rounded border object-cover" src="${ce(photoUrl)}" alt="${lang() === 'id' ? 'Bukti' : '现场凭证'}"><div class="mt-2">${cb(lang() === 'id' ? 'Ganti foto' : '重拍 / 更换', 'sewing-photo')}</div>` : `<label class="mt-2 block">${cb(lang() === 'id' ? 'Ambil / pilih foto' : '拍照 / 选择照片', 'sewing-photo')}<input type="file" accept="image/*" capture="environment" data-sewing-file hidden></label>`}</section>`
    + `<p class="text-sm text-slate-600">${lang() === 'id' ? 'Setelah daftar, serahkan ke petugas finishing untuk dihitung.' : '登记后交后道人员点收，实收数量由对方填写。'}</p>`
  base.primary = { label: saving ? t('saving') : (lang() === 'id' ? 'Daftarkan pengiriman' : '登记本次回货'), action: 'sewing-submit', disabled: saving }
  base.content = content; return base
}
function record(row: PostFinishingFactoryReturnDelivery) {
  const total = row.lines.reduce((sum, line) => sum + line.registeredQty, 0)
  return `<article class="mb-2 rounded-xl border bg-white p-3"><div class="flex justify-between gap-2"><strong>${ce(row.deliveryOrderNo)}</strong><span>${ce(postLabel(row.status))}</span></div><div class="text-sm">${ce(row.productionOrderNo)} · ${lang() === 'id' ? 'Ke' : '第'} ${row.returnIndex} ${lang() === 'id' ? 'kali' : '次'} · ${total} ${lang() === 'id' ? 'buah' : '件'}</div><div class="text-xs text-slate-600">${ce(row.deliveryPersonName)}</div>${row.status === '待后道确认' ? `<div class="text-sm text-blue-700">${lang() === 'id' ? 'Menunggu hitung finishing' : '待后道点收'}</div>` : ''}</article>`
}
function postLabel(status: string) { return lang() === 'id' ? ({ '待后道确认': 'Menunggu konfirmasi', '已确认待送检': 'Siap kirim QC', '已送检': 'Sudah kirim QC', '已完成': 'Selesai', '已废弃': 'Dibatalkan' } as Record<string, string>)[status] || status : status }
function patch() { const host = root(); if (!host) return; const main = host.querySelector<HTMLElement>('[data-central-content]')!, top = main.scrollTop, template = document.createElement('template'); template.innerHTML = renderCentralPdaFrame(frame()); const next = template.content.firstElementChild!; host.lang = next.getAttribute('lang') || ''; host.querySelector('header')!.replaceWith(next.querySelector('header')!); host.querySelector('[data-central-heading]')!.replaceWith(next.querySelector('[data-central-heading]')!); main.replaceChildren(...next.querySelector('[data-central-content]')!.childNodes); host.querySelector('[data-central-footer]')?.remove(); host.querySelector('nav')?.remove(); for (const selector of ['[data-central-footer]', 'nav']) { const el = next.querySelector(selector); if (el) host.append(el) } main.scrollTop = top; mountCentralPostSewingPage(); hydrateIcons(host); if (message) host.querySelector('[role="alert"]')?.scrollIntoView({ block: 'start' }) }
function navigate(next: string) { message = undefined; success = ''; scan = ''; path = next; if (appStore.getState().pathname === next) patch(); else appStore.navigate(next) }
function reset() { releaseCentralSewingPhoto(photoUrl); photoUrl = ''; person = ''; discardReason = ''; phone = ''; sourceValue = ''; source = undefined; quantities.clear(); operationId = ''; current = undefined; scan = ''; message = undefined; success = '' }
function exitMode() { if (dirty()) openExitConfirm(); else finish() }
function finish() { reset(); locked = false; navigate(prefix + '/warehouse') }
function openExitConfirm() { const el = document.createElement('div'); el.dataset.sewingOverlay = ''; el.className = 'fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-2'; el.innerHTML = `<section role="dialog" aria-modal="true" class="w-full max-w-[420px] rounded-2xl bg-white p-3"><h2 class="mb-2 text-lg font-bold">${lang() === 'id' ? 'Akhiri pendaftaran' : '结束本次回货登记'}</h2><p class="mb-3">${lang() === 'id' ? 'Jumlah, pengirim, dan foto belum dikirim. Keluar akan membuang isian.' : '本次数量、送货人和照片尚未提交。结束后放弃这些填写。'}</p>${cb(lang() === 'id' ? 'Lanjut isi' : '继续填写', 'sewing-close')}${cb(lang() === 'id' ? 'Buang & keluar' : '放弃填写并结束', 'sewing-discard')}</section>`; el.addEventListener('click', e => { if (e.target === el) el.remove() }); (root()?.parentElement ?? document.body).append(el); hydrateIcons(el) }
function closeOverlay() { document.querySelector('[data-sewing-overlay]')?.remove() }
function identify(raw = scan) { try { source = centralSewingSource(raw, session.currentFactory); sourceValue = raw; scan = raw; quantities.clear(); operationId = crypto.randomUUID(); message = undefined; success = ''; patch() } catch (error) { message = error; source = undefined; patch() } }
async function submit() {
  if (!source || !session.account || saving) return
  const lines = centralSewingRemaining(source.productionOrder).map(sku => ({ skuId: sku.skuId, registeredQty: Number(quantities.get(sku.skuId) || 0) }))
  if (!lines.some(line => line.registeredQty > 0)) { message = new Error(lang() === 'id' ? 'Isi minimal 1 buah.' : '本次至少登记 1 件。'); patch(); return }
  if (!person.trim()) { message = new Error(lang() === 'id' ? 'Isi nama pengirim.' : '填写本次实际送货人姓名。'); patch(); return }
  if (!photoUrl) { message = new Error(lang() === 'id' ? 'Ambil minimal 1 foto.' : '拍摄或选择至少 1 张现场凭证。'); patch(); return }
  saving = true; message = undefined; success = ''; patch()
  try { current = await saveCentralSewingReturn({ scanValue: sourceValue, quantities: lines, person, phone, evidenceUrl: photoUrl, operationId }, session.account); success = lang() === 'id' ? 'Pengiriman terdaftar.' : '回货已登记，待后道点收。'; source = undefined; sourceValue = ''; photoUrl = ''; person = ''; phone = ''; quantities.clear() }
  catch (error) { message = error } finally { saving = false; if (root()) patch() }
}
export async function renderCentralPostSewingPage(next: string, isCurrent = () => true) {
  const token = ++generation; path = next
  try { const preferred = session.currentFactory || session.preference.factoryId || ''; const valid = listFactoryMasterRecords().some(factory => factory.id === preferred && factory.status === 'active' && isCentralPdaFactory(factory)); ensureCentralSessionAccount(valid ? preferred : listFactoryMasterRecords().find(factory => factory.status === 'active' && isCentralPdaFactory(factory))?.id || ''); if (token !== generation || !isCurrent()) return ''; return renderCentralPdaFrame(frame()) }
  catch (error) { if (token !== generation || !isCurrent()) return ''; message = error; return renderCentralPdaFrame(frame()) }
}
export async function handleCentralPostSewingEvent(target: Element, event?: Event): Promise<boolean> {
  if (!root()) return false
  if (event instanceof KeyboardEvent && event.key === 'Enter' && !event.isComposing) {
    if (target.matches('[data-sewing-scan]')) { event.preventDefault(); identify(); return true }
    if (target.matches('[data-sewing-login="account"]')) { event.preventDefault(); root()?.querySelector<HTMLInputElement>('[data-sewing-login="password"]')?.focus(); return true }
    if (target.matches('[data-sewing-login="password"]')) { event.preventDefault(); root()?.querySelector<HTMLButtonElement>('[data-central-action="sewing-login"]')?.click(); return true }
  }
  const input = target.closest<HTMLInputElement>('[data-sewing-scan],[data-sewing-login],[data-sewing-qty],[data-sewing-person],[data-sewing-phone],[data-sewing-discard-reason]')
  if (input && (event?.type === 'input' || event?.type === 'change')) {
    if (input.dataset.sewingLogin) { login[input.dataset.sewingLogin as 'account' | 'password'] = input.value; return true }
    if (input.dataset.sewingScan !== undefined) { scan = input.value; return true }
    if (input.dataset.sewingQty) { quantities.set(input.dataset.sewingQty, input.value); return true }
    if (input.dataset.sewingPerson !== undefined) person = input.value
    if (input.dataset.sewingPhone !== undefined) phone = input.value
    if (input.dataset.sewingDiscardReason !== undefined) discardReason = input.value
    return true
  }
  const file = target.closest<HTMLInputElement>('[data-sewing-file]')
  if (file && event?.type === 'change') { const picked = file.files?.[0]; if (picked) { try { releaseCentralSewingPhoto(photoUrl); photoUrl = centralSewingPhoto(picked); message = undefined } catch (error) { message = error } patch() } return true }
  const nav = target.closest<HTMLElement>('[data-central-nav]')?.dataset.centralNav
  if (nav) { if (nav.endsWith('/warehouse')) { if (dirty()) { openExitConfirm(); return true } finish(); return true } navigate(nav); return true }
  const control = target.closest<HTMLElement>('[data-central-action]'), action = control?.dataset.centralAction, value = control?.dataset.centralValue
  if (!action) return false
  switch (action) {
    case 'language': session.language = session.language === 'id' ? 'zh' : 'id'; saveCentralSessionPreference(); patch(); break
    case 'logout': discardCentralDrafts(); session.signedOut = true; session.account = undefined; saveCentralSessionPreference(); reset(); navigate(pathPrefix); break
    case 'sewing-login': { const user = readFactoryPdaExecutionUsers().find(row => normalizePdaLoginId(row.loginId) === normalizePdaLoginId(login.account)); if (!user || !verifyPdaPassword(login.password, user.passwordHash) || user.status !== 'ACTIVE' || !listFactoryMasterRecords().some(factory => factory.id === user.factoryId && factory.status === 'active' && isCentralPdaFactory(factory))) { message = new Error(t('loginFail')); patch(); break } session.account = user; session.currentFactory = user.factoryId; session.signedOut = false; login = { account: '', password: '' }; saveCentralSessionPreference(); navigate(pathPrefix); break }
    case 'sewing-start': locked = true; message = undefined; patch(); break
    case 'sewing-scan': identify(); break
    case 'sewing-source': identify(value || ''); break
    case 'sewing-photo': root()?.querySelector<HTMLInputElement>('[data-sewing-file]')?.click(); break
    case 'sewing-submit': await submit(); break
    case 'sewing-next': reset(); locked = true; patch(); break
    case 'sewing-close': closeOverlay(); break
    case 'sewing-discard': closeOverlay(); finish(); break
    case 'sewing-discard-return': { if (!current || !session.account) break; saving = true; message = undefined; patch(); try { await discardCentralSewingReturn(current, discardReason, session.account); current = undefined; success = lang() === 'id' ? 'Pendaftaran dibatalkan.' : '本次登记已废弃。' } catch (error) { message = error } finally { saving = false; if (root()) patch() } break }
    case 'sewing-exit': exitMode(); break
  }
  return true
}
let mounted = false
export function mountCentralPostSewingPage() { const host = root(); if (!host) return; const size = () => { if (root()) root()!.style.height = `${Math.round(window.visualViewport?.height || innerHeight)}px` }; if (!mounted) { mounted = true; window.visualViewport?.addEventListener('resize', size) } size(); if (!document.querySelector('[data-sewing-overlay]')) { const scanInput = host.querySelector<HTMLInputElement>('[data-sewing-scan]'); (scanInput || host.querySelector<HTMLInputElement>('[data-sewing-login="account"]'))?.focus({ preventScroll: true }) } }

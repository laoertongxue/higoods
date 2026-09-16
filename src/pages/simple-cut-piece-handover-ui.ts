import { escapeHtml as e } from '../utils.ts'
import { renderButton } from '../components/ui/button.ts'
import { handlePdaImagePreviewEvent, closePdaImagePreview } from '../components/ui/pda-image-preview.ts'
import { getPdaRuntimeContext } from './pda-runtime.ts'
import { findFactoryPdaRoleById } from '../data/fcs/store-domain-pda.ts'
import { assertSimpleCutPieceWarehouseActor, resolveSimpleCutPieceHandover, confirmSimpleCutPieceHandover, type SimpleCutPieceHandoverPreview, type SimpleCutPieceHandoverActor } from '../data/fcs/cutting/simple-cut-piece-handover.ts'

type Mode = 'WEB' | 'PDA'
type Result = Awaited<ReturnType<typeof confirmSimpleCutPieceHandover>>
interface State { raw: string; preview?: SimpleCutPieceHandoverPreview; result?: Result; busy: boolean; feedback: string; page: number; commandId: string }
const fresh = (): State => ({ raw: '', busy: false, feedback: '', page: 1, commandId: '' })
const states: Record<Mode, State> = { WEB: fresh(), PDA: fresh() }
const button = (label: string, action: string, disabled = false, primary = false) => renderButton({ label, disabled, variant: primary ? 'primary' : 'secondary', className: 'min-h-10', action: { prefix: 'simple-cut', action, skipPageRerender: true } })
export function simpleCutPieceActor(mode: Mode): SimpleCutPieceHandoverActor {
  const session = getPdaRuntimeContext()
  if (!session) throw new Error('请先使用裁床仓管账号登录，再确认交出。')
  const role = findFactoryPdaRoleById(session.roleId, session.factoryId)
  const roleName = role?.roleName || session.roleId
  const operatorRole = /仓管|仓库/.test(roleName) ? 'WAREHOUSE' : session.roleId === 'ROLE_ADMIN' ? 'FACTORY_ADMIN' : session.roleId
  const actor = { factoryId: session.factoryId, operatorId: session.userId, operatorName: session.userName, operatorRole, source: mode }
  assertSimpleCutPieceWarehouseActor(actor)
  return actor
}
function permissionMessage(mode: Mode): string { try { simpleCutPieceActor(mode); return '' } catch (error) { return (error as Error).message } }
function renderPreview(preview: SimpleCutPieceHandoverPreview, state: State, mode: Mode): string {
  const { sheet } = preview
  const tickets = [...preview.tickets].sort((a, b) => [a.skuCode, a.partCode, a.pieceRange, a.feiTicketNo].join('|').localeCompare([b.skuCode, b.partCode, b.pieceRange, b.feiTicketNo].join('|')))
  const pageSize = mode === 'PDA' ? 8 : 15
  const pages = Math.max(1, Math.ceil(tickets.length / pageSize))
  state.page = Math.min(state.page, pages)
  const visible = tickets.slice((state.page - 1) * pageSize, state.page * pageSize)
  const image = sheet.styleImageUrl
    ? `<div data-simple-image class="shrink-0"><button type="button" data-pda-image-preview-url="${e(sheet.styleImageUrl)}" data-pda-image-preview-title="${e(sheet.styleName)}"><img src="${e(sheet.styleImageUrl)}" alt="${e(sheet.styleName)}" class="h-20 w-20 rounded border object-contain" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.hidden=false;this.nextElementSibling.textContent='款图加载失败';this.closest('[data-simple-image]').querySelector('[data-simple-image-retry]').hidden=false"><span class="block w-20 text-xs text-slate-600">款图加载中…</span></button><div hidden data-simple-image-retry>${button('重试款图', 'retry-image')}</div></div>`
    : '<p class="text-red-700">款式图片未维护，请联系计划人员补齐。</p>'

  const cards = visible.map(t => `<article class="rounded border p-3 text-sm break-words"><strong>${e(t.feiTicketNo)}</strong><p>${e(t.skuCode)} · ${e(t.color)} / ${e(t.size)}</p><p>${e(t.partName)} · 编号 ${e(t.pieceRange)}</p><p class="font-semibold text-blue-700">${t.pieceQty} 片</p></article>`).join('')
  const table = `<div class="overflow-x-auto"><table class="w-full text-left text-sm"><thead><tr>${['菲票号','SKU / 颜色 / 尺码','部位','编号范围','本次片数'].map(x => `<th class="border-b p-2">${x}</th>`).join('')}</tr></thead><tbody>${visible.map(t => `<tr>${[e(t.feiTicketNo),`${e(t.skuCode)}<br>${e(t.color)} / ${e(t.size)}`,e(t.partName),e(t.pieceRange),`${t.pieceQty} 片`].map(x => `<td class="border-b p-2 break-words">${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
  return `<section class="space-y-3"><div class="flex flex-wrap items-start gap-3 rounded border p-3">${image}<div class="min-w-0 flex-1 break-words text-sm"><strong>${e(sheet.styleCode)} · ${e(sheet.styleName)}</strong><p>生产单：${e(sheet.productionOrderNo)}</p><p>任务单：${e(sheet.taskSheetNo)} · ${e(sheet.taskTypeLabel)}</p><p>接收工厂：${e(sheet.assignment.factoryName)}</p><p>领取 PPIC：${e(sheet.ppicName)} · 分配 ${sheet.assignment.assignedQty} 件</p></div></div><details class="rounded border p-3"><summary>本厂分配 SKU（${sheet.assignment.skuLines.length} 项）</summary>${sheet.assignment.skuLines.map(s => `<p class="break-words text-sm">${e(s.skuCode)} · ${e(s.color)} / ${e(s.size)} · ${s.qty} 件</p>`).join('')}</details><div class="grid grid-cols-2 gap-2 ${mode === 'WEB' ? 'md:grid-cols-4' : ''}">${[['应交裁片',preview.totalRequiredPieceQty],['此前已交',preview.totalHandedOverPieceQty],['本次可交',preview.totalAvailablePieceQty],['确认后剩余',Math.max(0,preview.totalRemainingPieceQty-preview.totalAvailablePieceQty)]].map(([label,qty]) => `<div class="rounded bg-blue-50 p-2 text-sm">${label}<strong class="block">${qty} 片</strong></div>`).join('')}</div><p class="text-sm font-semibold">本次完整清单：${tickets.length} 张菲票，共 ${preview.totalAvailablePieceQty} 片</p>${tickets.length ? mode === 'PDA' ? `<div class="space-y-2">${cards}</div>` : table : '<p class="rounded bg-amber-50 p-3 text-sm">当前没有可交裁片，请查看暂不可交原因或等待裁剪完成。</p>'}<div class="flex items-center justify-between gap-2 text-xs">${button('上一页','previous',state.page===1)}<span>第 ${state.page} / ${pages} 页 · 共 ${tickets.length} 张</span>${button('下一页','next',state.page===pages)}</div>${preview.excluded.length ? `<details class="rounded border p-3"><summary>另有 ${preview.excluded.length} 张暂不可交</summary><div class="max-h-48 overflow-y-auto">${preview.excluded.map(t => `<p class="my-2 break-words text-xs">${e(t.feiTicketNo)}：${e(t.reason)}</p>`).join('')}</div></details>` : ''}${preview.blockingReasons.map(x => `<p class="text-sm text-red-700">${e(x)}</p>`).join('')}</section>`
}
export function renderSimpleCutPieceContent(mode: Mode): string {
  const state = states[mode]
  const permission = permissionMessage(mode)
  if (state.result) {
    const event = state.result.event
    const p = event.payload
    return `<div data-simple-cut-content class="space-y-4 p-4"><h3 class="text-lg font-semibold text-green-700">已交出 · 工厂已接收</h3><dl class="space-y-2 break-words text-sm"><div>交出单：${e(p.handoverOrderNo)}</div><div>交出记录：${e(p.handoverRecordNo)}</div><div>${p.tickets.length} 张菲票 / ${p.totalPieceQty} 片</div><div>接收工厂：${e(p.factoryName)}</div><div>领取 PPIC：${e(p.ppicName)}</div><div>交出人：${e(event.operatorName || '')}</div><div>时间：${e(event.occurredAt)}</div></dl><a class="block text-blue-700 underline" href="/fcs/craft/cutting/handover-records/${encodeURIComponent(p.handoverRecordId)}">查看交出记录</a>${button(mode==='PDA'?'继续扫描':'继续下一单','reset',false,true)}</div>`
  }
  return `<div data-simple-cut-content class="flex min-h-0 flex-1 flex-col"><div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" data-simple-cut-scroll><label class="block text-sm font-medium">任务单号<input data-simple-cut-input data-skip-page-rerender="true" class="mt-1 h-11 w-full rounded border px-3 text-sm" placeholder="RW-XXXXXXX-XXXXXXX / 条码或二维码内容" value="${e(state.raw)}" ${state.busy?'disabled':''}></label><div class="flex flex-wrap gap-2">${button(mode==='PDA'?'扫描任务单 / 读取':'读取任务','read',state.busy,true)}${mode==='PDA'?'<p class="text-xs text-slate-500">使用扫码枪，或手动输入任务单号后读取。</p>':''}</div><p role="status" aria-live="polite" class="text-sm ${state.busy?'text-blue-700':'text-red-700'}">${e(state.feedback)}</p>${!permission?`<p class="text-xs text-slate-600">当前仓管账号：${e(simpleCutPieceActor(mode).operatorName)} · ${e(simpleCutPieceActor(mode).operatorId)}</p>`:''}${permission?`<p class="rounded bg-amber-50 p-2 text-sm">${e(permission)} <a class="underline" href="/fcs/pda/auth/login?returnTo=${encodeURIComponent(typeof location==='undefined'?'':location.pathname+location.search)}">登录裁床账号</a></p>`:''}${state.preview?renderPreview(state.preview,state,mode):'<p class="py-6 text-center text-sm text-slate-500">读取后核对工厂、PPIC 和裁片清单，再确认交出。</p>'}</div><footer class="shrink-0 space-y-2 border-t bg-white p-3"><p class="text-xs">确认后，本批裁片视为 PPIC 已领取、工厂已接收。确认包含全部分页清单。</p>${button(state.busy?'处理中…':`确认交出（${state.preview?.tickets.length||0} 张菲票 / ${state.preview?.totalAvailablePieceQty||0} 片）`,'confirm',state.busy||!!permission||!state.preview?.tickets.length||!!state.preview?.blockingReasons.length,true)}</footer></div>`
}
function refresh(mode: Mode): void {
  const host = document.querySelector<HTMLElement>(`[data-simple-cut-root="${mode}"]`)
  const old = host?.querySelector<HTMLElement>('[data-simple-cut-content]')
  const focusAction = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.simpleCutAction : undefined
  const scroll = old?.querySelector<HTMLElement>('[data-simple-cut-scroll]')?.scrollTop || 0
  if(old) old.outerHTML = renderSimpleCutPieceContent(mode)
  const next = host?.querySelector<HTMLElement>('[data-simple-cut-scroll]'); if(next)next.scrollTop=scroll
  if (focusAction) host?.querySelector<HTMLButtonElement>(`[data-simple-cut-action="${focusAction}"]`)?.focus({ preventScroll: true })
}
export function prepareSimpleCutPiecePage(mode: Mode, raw = ''): void {
  const autoRead = Boolean(raw && states[mode].raw !== raw)
  if (autoRead) { states[mode] = fresh(); states[mode].raw = raw }
  setTimeout(() => {
    const host = document.querySelector<HTMLElement>(`[data-simple-cut-root="${mode}"]`)
    if (!host || host.dataset.keyBound) return
    host.dataset.keyBound = 'true'
    host.querySelector<HTMLInputElement>('[data-simple-cut-input]')?.focus()
    if (mode === 'WEB') host.addEventListener('click', event => handleSimpleCutPieceUiEvent(event.target as HTMLElement))
    host.addEventListener('keydown', event => {
      if (event.key === 'Enter' && (event.target as HTMLElement).matches('[data-simple-cut-input]')) {
        event.preventDefault()
        event.stopPropagation()
        void perform(mode, 'read', host)
      }
      if (event.key === 'Escape' && mode === 'WEB') {
        if (!closePdaImagePreview()) host.remove()
        event.stopPropagation()
      }
    })
    // A task QR identifies the task only. The user must still confirm the handover.
    if (autoRead) void perform(mode, 'read', host)
  })
}

async function perform(mode: Mode, action: string, host: HTMLElement): Promise<void> {
  const state=states[mode]
  if(state.busy)return
  if(action==='close'){host.remove();return}
  if(action==='reset'){states[mode]=fresh();refresh(mode);host.querySelector<HTMLInputElement>('[data-simple-cut-input]')?.focus();return}
  if(action==='retry-image'){host.querySelectorAll<HTMLImageElement>('img').forEach(img=>{img.hidden=false;if(img.nextElementSibling instanceof HTMLElement){img.nextElementSibling.hidden=false;img.nextElementSibling.textContent='款图加载中…'};img.closest('[data-simple-image]')?.querySelector<HTMLElement>('[data-simple-image-retry]')?.setAttribute('hidden','');img.src=img.src});return}
  if(action==='next'||action==='previous'){state.page+=action==='next'?1:-1;refresh(mode);return}
  if(action!=='read'&&action!=='confirm')return
  state.raw=host.querySelector<HTMLInputElement>('[data-simple-cut-input]')?.value || state.raw
  state.busy=true;state.feedback=action==='read'?'正在读取任务…':'正在保存交出，请稍候…';refresh(mode)
  // Two frames guarantee that the loading feedback paints before synchronous mock matching.
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  try {
    if(action==='read'){state.preview=undefined;state.preview=resolveSimpleCutPieceHandover(state.raw);state.raw=state.preview.sheet.taskSheetNo;state.commandId=`SIMPLE:${state.preview.sheet.taskSheetNo}:${state.preview.candidateFingerprint}`;state.page=1;state.feedback=''}
    else if(state.preview){state.result=await confirmSimpleCutPieceHandover({taskSheetNo:state.preview.sheet.taskSheetNo,candidateFingerprint:state.preview.candidateFingerprint,commandId:state.commandId,actor:simpleCutPieceActor(mode)});state.feedback='';document.dispatchEvent(new CustomEvent('simple-cut-piece-handover-saved'))}
  }catch(error){state.feedback=`${action==='confirm'?'未完成交出，请重试或重新读取核对。':''}${(error as Error).message}`}
  finally {
    state.busy = false
    refresh(mode)
    host.querySelector<HTMLButtonElement>(`[data-simple-cut-action="${state.result ? 'reset' : action === 'confirm' ? 'confirm' : 'read'}"]`)?.focus({ preventScroll: true })
  }
}
export function handleSimpleCutPieceUiEvent(target: HTMLElement): boolean {
  const opener=target.closest('[data-simple-cut-open]')
  if(opener){states.WEB=fresh();document.querySelector('[data-simple-cut-root="WEB"]')?.remove();document.body.insertAdjacentHTML('beforeend',`<div data-simple-cut-root="WEB" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-3" role="dialog" aria-modal="true" aria-label="简易裁片交出"><section class="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"><header class="flex shrink-0 items-center justify-between border-b p-3"><h2 class="font-semibold">简易裁片交出</h2>${button('关闭','close')}</header>${renderSimpleCutPieceContent('WEB')}</section></div>`);prepareSimpleCutPiecePage('WEB');return true}
  const host=target.closest<HTMLElement>('[data-simple-cut-root]');if(!host)return false
  if(handlePdaImagePreviewEvent(target))return true
  const action=target.closest<HTMLElement>('[data-simple-cut-action]')?.dataset.simpleCutAction
  if(action)void perform(host.dataset.simpleCutRoot as Mode,action,host)
  return true
}

let webEntryBound = false
export function bindSimpleCutPieceWebEntry(): void {
  if (typeof document === 'undefined' || webEntryBound) return
  webEntryBound = true
  document.addEventListener('keydown', event => {
    const modal = document.querySelector('[data-simple-cut-root="WEB"]')
    if(event.key !== 'Escape' || !modal) return
    event.preventDefault(); event.stopImmediatePropagation()
    if (!closePdaImagePreview()) modal.remove()
  }, true)
  document.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null
    if (!target?.closest('[data-simple-cut-open]')) return
    event.preventDefault()
    event.stopImmediatePropagation()
    handleSimpleCutPieceUiEvent(target)
  }, true)
}

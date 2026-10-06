import { escapeHtml } from '../utils.ts'

/** Page-scoped confirmation. No business changes occur until the user confirms. */
export function confirmPcsAction(message: string): Promise<boolean> {
  return openPcsActionDialog(message).then(value => value !== null)
}
export function requestPcsActionReason(message: string): Promise<string | null> {
  return openPcsActionDialog(message, true)
}
function openPcsActionDialog(message: string, requireReason = false): Promise<string | null> {
  // A second click must not create a second pending business action.
  if (document.querySelector('[data-pcs-action-dialog]')) return Promise.resolve(null)
  const previousFocus = document.activeElement as HTMLElement | null
  const dialog = document.createElement('dialog')
  dialog.dataset.pcsActionDialog = ''
  dialog.className = 'm-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40'
  dialog.setAttribute('aria-labelledby', 'pcs-action-dialog-title')
  dialog.innerHTML = `<form method="dialog"><header class="border-b px-5 py-4"><h2 id="pcs-action-dialog-title" class="text-lg font-semibold">${requireReason ? '填写驳回原因' : '确认操作'}</h2></header><div class="space-y-3 p-5"><p class="whitespace-pre-wrap text-sm leading-6">${escapeHtml(message)}</p>${requireReason ? '<label class="block text-sm">驳回原因<textarea name="reason" required rows="3" class="mt-2 w-full rounded-md border border-slate-200 p-3" autofocus></textarea></label><p data-dialog-error class="hidden text-sm text-red-600">请填写驳回原因。</p>' : ''}</div><footer class="flex justify-end gap-3 border-t px-5 py-4"><button type="button" data-dialog-cancel class="rounded-md border border-slate-200 px-4 py-2 text-sm">取消</button><button type="button" data-dialog-confirm class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">确认</button></footer></form>`
  document.body.append(dialog)
  return new Promise(resolve => {
    let finished = false
    const finish = (value: string | null) => { if (finished) return; finished = true; dialog.close(); dialog.remove(); if (previousFocus?.isConnected) previousFocus.focus(); resolve(value) }
    dialog.querySelector('[data-dialog-cancel]')!.addEventListener('click', () => finish(null))
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null) })
    dialog.addEventListener('keydown', event => event.stopPropagation())
    const confirm = () => {
      const reason = (dialog.querySelector('textarea')?.value || '').trim()
      if (requireReason && !reason) { dialog.querySelector('[data-dialog-error]')!.classList.remove('hidden'); return }
      finish(requireReason ? reason : '')
    }
    dialog.querySelector('[data-dialog-confirm]')!.addEventListener('click', confirm)
    dialog.querySelector('form')!.addEventListener('submit', event => { event.preventDefault(); confirm() })
    dialog.showModal()
  })
}

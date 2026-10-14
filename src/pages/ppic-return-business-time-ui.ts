import { escapeHtml } from '../utils.ts'
export function renderReturnBusinessTimeFields(value = '', correction = false): string {
  const instant = value ? new Date(value) : null
  const local = instant && Number.isFinite(instant.getTime()) ? new Date(instant.getTime() + 7 * 3600000).toISOString().slice(0, 19) : ''
  return '<div class="mt-3 grid gap-3 rounded-lg border bg-slate-50 p-3"><label class="text-sm">实际后道确认时间（雅加达）<input type="datetime-local" step="1" class="mt-1 h-10 w-full rounded border px-3" data-return-business-confirmed-at' + (correction ? ' data-return-original-business-time="' + escapeHtml(local) + '"' : '') + ' value="' + escapeHtml(local) + '"></label>'
    + (correction ? '' : '<p class="text-xs text-slate-600">现场确认可留空，使用本次确认时间；补录填写实际时间和原因。</p><label class="text-sm">录入延迟原因<textarea class="mt-1 min-h-16 w-full rounded border px-3 py-2" data-return-entry-delay-reason></textarea></label>') + '</div>'
}

/** 数量订正未改时间时保留原始秒和毫秒，避免表单格式化制造时间订正。 */
export function readReturnBusinessTimeCorrection(root: ParentNode): string | undefined {
  const input = root.querySelector<HTMLInputElement>('[data-return-business-confirmed-at]')
  return !input?.value || input.value === input.dataset.returnOriginalBusinessTime ? undefined : input.value
}

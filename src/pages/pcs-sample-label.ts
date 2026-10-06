// @page-pattern: detail
import { getPcsSampleById, getPcsSampleLabelIdentity, registerPcsSampleLabel, PCS_SAMPLE_STORAGE_KEY, type PcsSampleLabelIdentity } from '../data/pcs-sample-management.ts'
import { runPcsRecordCommand } from '../data/pcs-record-runtime.ts'
import { renderCode128Barcode } from '../components/real-barcode.ts'
import { escapeHtml as e } from '../utils.ts'

const settings = { width: '60', height: '40', copies: '1' }
let sampleId = '', message = '', printing = false
export function sampleLabelSettings(input: typeof settings): { width: number; height: number; copies: number } {
  const width = Number(input.width), height = Number(input.height), copies = Number(input.copies)
  if (!Number.isFinite(width) || width < 30 || width > 120 || !Number.isFinite(height) || height < 20 || height > 100) throw Error('标签宽度须为 30–120 mm，高度须为 20–100 mm。')
  if (!Number.isInteger(copies) || copies < 1 || copies > 100) throw Error('打印份数须为 1–100 的整数。')
  return { width, height, copies }
}
export function sampleLabelHtml(identity: PcsSampleLabelIdentity, size: { width: number; height: number }): string {
  if (!/^HG\d+$/.test(identity.hgCode) || !/^\d{4}-\d{2}-\d{2}/.test(identity.registeredAt) || !identity.skuCode) throw Error('标签资料不完整，无法打印。')
  const { width, height } = sampleLabelSettings({ ...size, width: String(size.width), height: String(size.height), copies: '1' })
  const font = Math.min(height * .12, width * .085)
  // Keep the full SKU legible even when long; no ellipsis or text clipping.
  const skuFont = Math.min(font, (height * .27) / (Math.ceil(identity.skuCode.length / Math.max(1, Math.floor((width - 4) / (font * .6)))) * 1.15))
  return `<article class="hg-sample-label" data-hg-sample-label style="width:${width}mm;height:${height}mm;--label-font:${font}mm;--sku-font:${skuFont}mm">
    ${renderCode128Barcode(identity.hgCode, '样衣 HG 条码')}
    <div class="hg-number">${e(identity.hgCode)}</div>
    <div class="hg-date">${e(identity.registeredAt.slice(0, 10))}</div>
    <div class="hg-sku">${e(identity.skuCode)}</div>
  </article>`
}
const labelCss = `.hg-sample-label{box-sizing:border-box;padding:2mm;background:#fff;color:#000;display:flex;flex-direction:column;align-items:center;gap:.5mm;text-align:center;font-family:Arial,sans-serif;break-inside:avoid}.hg-sample-label svg{display:block;width:100%;height:35%;flex-shrink:0;color:#000}.hg-number,.hg-date{font-size:var(--label-font);line-height:1.12}.hg-sku{font-size:var(--sku-font);line-height:1.15;overflow-wrap:anywhere;width:100%;white-space:normal}`
export function sampleLabelDocument(identity: PcsSampleLabelIdentity, input: typeof settings): string {
  const size = sampleLabelSettings(input)
  return `<!doctype html><html><head><meta charset="utf-8"><title>${e(identity.hgCode)}</title><style>@page{size:${size.width}mm ${size.height}mm;margin:0}html,body{margin:0;padding:0}${labelCss}.hg-sample-label{break-after:page}.hg-sample-label:last-child{break-after:auto}</style></head><body>${Array.from({ length: size.copies }, () => sampleLabelHtml(identity, size)).join('')}</body></html>`
}
function content(): string {
  const sample = getPcsSampleById(sampleId)
  if (!sample) return '<p class="rounded border bg-white p-6" role="alert">未找到样衣，请返回库存重新选择。</p>'
  const identity = getPcsSampleLabelIdentity(sample.skuCode)
  if (!identity) return `<section class="rounded border bg-white p-5"><p>该 SKU 尚未生成 HG 样衣编号。</p><p class="mt-2 text-sm text-slate-500">已有入库资料用于核对首次登记日期；生成编号不代表已贴码。</p><button class="mt-4 rounded bg-blue-600 px-4 py-2 text-white" data-skip-page-rerender="true" data-pcs-sample-action="register-label">生成样衣编号</button></section>`
  let preview = ''
  try { preview = sampleLabelHtml(identity, sampleLabelSettings(settings)) } catch (error) { preview = `<p role="alert">${e((error as Error).message)}</p>` }
  return `<section class="rounded border bg-white p-5"><div class="grid gap-4 sm:grid-cols-3">${[['width','标签宽度（mm）',30,120],['height','标签高度（mm）',20,100],['copies','打印份数',1,100]].map(([key,label,min,max]) => `<label class="text-sm">${label}<input type="number" min="${min}" max="${max}" step="${key==='copies'?'1':'0.1'}" class="mt-2 w-full rounded border p-2" data-pcs-sample-field="label-${key}" value="${e(settings[key as keyof typeof settings])}"></label>`).join('')}</div><p class="mt-3 text-sm text-slate-500">纸张尺寸待现场确认，60 × 40 mm 为默认试打尺寸。请按标签纸宽高调整，打印时选择实际大小（100%）。</p><div class="mt-4 flex flex-wrap gap-3"><button class="rounded bg-blue-600 px-4 py-2 text-white" data-skip-page-rerender="true" data-pcs-sample-action="print-label">打印标签</button><button class="rounded border px-4 py-2" data-skip-page-rerender="true" data-pcs-sample-action="reset-label-size">恢复试打尺寸</button></div></section><section class="rounded border bg-slate-100 p-5"><h2 class="mb-4 font-semibold">标签预览</h2><style>${labelCss}</style><div class="overflow-x-auto" data-hg-label-preview>${preview}</div></section>`
}
export function renderPcsSampleLabelPage(id: string): string {
  const decoded = decodeURIComponent(id)
  if (decoded !== sampleId) { sampleId = decoded; message = ''; printing = false }
  const sample = getPcsSampleById(sampleId)
  return `<div class="h-full overflow-auto p-5" data-hg-label-page><div class="mx-auto max-w-4xl space-y-4"><header class="flex flex-wrap items-center justify-between gap-3"><div><h1 class="text-xl font-semibold">样衣标签打印</h1><p class="mt-1 break-all text-sm text-slate-500">${e(sample?.skuCode || '')}</p></div><a class="rounded border bg-white px-4 py-2 text-sm" href="/pcs/samples/detail/${encodeURIComponent(sampleId)}" data-nav="/pcs/samples/detail/${encodeURIComponent(sampleId)}">返回样衣详情</a></header><p class="text-sm text-slate-600">条码内容为 HG 样衣编号；日期为该 SKU 样衣首次登记日期。同 SKU 多件共用编号，打印不会确认已贴码。</p><p role="status" class="text-sm text-amber-700" data-hg-label-feedback>${e(message)}</p><div class="space-y-4" data-hg-label-content>${content()}</div></div></div>`
}
export function handlePcsSampleLabelInput(target: Element): boolean {
  const input = target.closest<HTMLInputElement>('[data-pcs-sample-field^="label-"]')
  if (!input) return false
  const key = input.dataset.pcsSampleField!.slice(6) as keyof typeof settings
  if (!(key in settings)) return false
  settings[key] = input.value
  const identity = getPcsSampleLabelIdentity(getPcsSampleById(sampleId)?.skuCode || '')
  try { const size = sampleLabelSettings(settings); if (identity) document.querySelector('[data-hg-label-preview]')!.innerHTML = sampleLabelHtml(identity, size); message = '' }
  catch (error) { message = (error as Error).message }
  const feedback = document.querySelector('[data-hg-label-feedback]'); if (feedback) feedback.textContent = message
  return false // local update preserves focus and the in-progress numeric input
}
export async function handlePcsSampleLabelAction(action: string): Promise<boolean> {
  if (!['print-label','register-label','reset-label-size'].includes(action)) return false
  try {
    if (action === 'reset-label-size') { Object.assign(settings, { width: '60', height: '40', copies: '1' }); message = ''; document.querySelector('[data-hg-label-content]')!.innerHTML = content() }
    else if (action === 'register-label') { await runPcsRecordCommand(() => registerPcsSampleLabel(sampleId), crypto.randomUUID(), [PCS_SAMPLE_STORAGE_KEY]); document.querySelector('[data-hg-label-content]')!.innerHTML = content(); message = '样衣编号已保存，可预览并打印。' }
    else {
      if (printing) return true
      const identity = getPcsSampleLabelIdentity(getPcsSampleById(sampleId)?.skuCode || '')
      if (!identity) throw Error('请先生成样衣编号。')
      const html = sampleLabelDocument(identity, settings)
      printing = true
      document.querySelectorAll('iframe[data-hg-print-frame]').forEach(frame => frame.remove())
      const frame = document.createElement('iframe'); frame.dataset.hgPrintFrame = ''; frame.title = '样衣标签打印'; frame.style.cssText = 'position:fixed;left:-9999px;width:120mm;height:100mm;border:0'; document.body.append(frame)
      try {
        await new Promise<void>((resolve,reject) => { frame.onload = () => resolve(); frame.onerror = () => reject(Error('打印内容生成失败，请重试。')); frame.srcdoc = html })
        await frame.contentDocument!.fonts.ready
        await new Promise<void>(r => frame.contentWindow!.requestAnimationFrame(() => frame.contentWindow!.requestAnimationFrame(() => r())))
        frame.contentWindow!.addEventListener('afterprint', () => frame.remove(), { once: true })
        window.addEventListener('pagehide', () => frame.remove(), { once: true })
        frame.contentWindow!.focus(); frame.contentWindow!.print(); message = '已打开打印窗口，标签已生成；请确认纸张尺寸与实际大小。'
      } catch (error) { frame.remove(); throw error } finally { printing = false }
    }
  } catch (error) { message = (error as Error).message }
  const feedback = document.querySelector('[data-hg-label-feedback]'); if (feedback) feedback.textContent = message
  return true
}

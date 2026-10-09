import { escapeHtml } from '../utils.ts'
import type { SalesBaseContent } from './pcs-product-archive-rules.ts'
import type { StyleArchiveShellRecord } from './pcs-style-archive-types.ts'
import { STYLE_SIZE_OPTIONS, STYLE_SIZE_PARAMETERS } from './pcs-style-size-chart-options.ts'
export { STYLE_SIZE_OPTIONS, STYLE_SIZE_PARAMETERS }

export const STYLE_SIZE_CHART_PRESETS = {
  top: { name: '上衣', image: '1.jpg' }, tee: { name: 'T恤', image: '13.jpg' },
  skirt: { name: '长裙', image: '3.jpg' }, pants: { name: '裤子', image: '4.jpg' },
  coat: { name: '外套', image: '5.jpg' }, shorts: { name: '半裙', image: '6.jpg' },
  dress: { name: '连衣裙', image: '7.jpg' }, suit: { name: '套装', image: '8.jpg' },
  shortPants: { name: '短裤', image: '9.jpg' }, overalls: { name: '背带连体裤', image: '10.jpg' },
  jumpsuit: { name: '连体裤', image: '11.jpg' }, skirtSuit: { name: '裙套装', image: '12.jpg' },
  mensTee: { name: '男士短袖圆领', image: '13.jpg' }, mensLongTee: { name: '男士长袖圆领', image: '14.jpg' },
} as const
export type StyleSizeChartType = keyof typeof STYLE_SIZE_CHART_PRESETS
export interface StyleSizeChartDraft {
  garmentType: StyleSizeChartType
  columns: string[]
  rows: Array<{ size: string; values: string[]; shaded?: boolean }>
  note: string
  selectedSizes?: string[]
  selectedParameters?: string[]
  reservedSizes?: string[]
  fit?: string
  stretch?: string
  transparency?: string
  generated?: boolean
}
export const STYLE_SIZE_NOTE = '[Perbedaan Ukuran bisa sampai 1-3 cm dari ukuran dasar]'
// Static reference measurements supplied by the user, never production standards.
export const STYLE_DEFAULT_CHART: StyleSizeChartDraft = { garmentType: 'dress', columns: ['LB', 'LD', 'Panjang'], rows: [
  { size: 'M', values: ['36', '97', '123'] }, { size: 'L', values: ['37', '101', '124'] },
  { size: 'XL', values: ['38', '105', '125'] }, { size: '2XL', values: ['39', '109', '126'], shaded: false },
], note: STYLE_SIZE_NOTE }
export const STYLE_DEFAULT_CHART_URL = '/materials/pcs-size-chart/default.svg'
export function createStyleSizeChart(style: Partial<StyleArchiveShellRecord>, _sizes: string[]): StyleSizeChartDraft {
  if (style.sizeChartDraft) {
    const chart = structuredClone(style.sizeChartDraft)
    return { fit: '2', stretch: '1', transparency: '3', reservedSizes: [], generated: chart.rows.length > 0, ...chart, selectedSizes: chart.selectedSizes || chart.rows.map(row => row.size), selectedParameters: chart.selectedParameters || [...chart.columns] }
  }
  const garmentType: StyleSizeChartType = /连衣裙|dress|gaun/i.test(style.styleName || '') ? 'dress' : /裤|pants/i.test(style.styleName || '') ? 'pants' : /裙|skirt/i.test(style.styleName || '') ? 'skirt' : 'top'
  return { garmentType, columns: [], rows: [], selectedSizes: [], selectedParameters: [], reservedSizes: [], fit: '2', stretch: '1', transparency: '3', generated: false, note: STYLE_SIZE_NOTE }
}
export function generateStyleSizeChartDraft(chart: StyleSizeChartDraft): void {
  const sizes = chart.selectedSizes || [], parameters = chart.selectedParameters || []
  if (!sizes.length || !parameters.length) throw new Error('至少选择一个尺码和参数！')
  const ordered = (source: string[], selected: string[]) => [...source.filter(value => selected.includes(value)), ...selected.filter(value => !source.includes(value))]
  const columns = ordered(STYLE_SIZE_PARAMETERS.map(item => item.value), parameters)
  chart.rows = ordered(STYLE_SIZE_OPTIONS, sizes).map(size => ({ size, values: columns.map(column => chart.rows.find(row => row.size === size)?.values[chart.columns.indexOf(column)] || '') }))
  chart.columns = columns; chart.generated = true
}
export function validateStyleSizeChart(chart: StyleSizeChartDraft): void {
  if (!Object.hasOwn(STYLE_SIZE_CHART_PRESETS, chart.garmentType) || !chart.columns.length || !chart.rows.length) throw new Error('至少选择一个尺码和参数！')
  if (chart.columns.length > 41 || chart.rows.length > 372 || chart.columns.some(column => !column.trim())) throw new Error('尺码或参数数量无效，请重新选择。')
  const seen = new Set<string>()
  for (const row of chart.rows) {
    const size = row.size.trim().toUpperCase()
    if (!size || seen.has(size)) throw new Error('请填写尺码，且尺码名称不能重复。')
    seen.add(size)
    if (row.values.length !== chart.columns.length || row.values.some(value => !value.trim())) throw new Error('有属性值为空，请填写全部测量值。')
  }
}
export function styleSizeChartHtml(chart: StyleSizeChartDraft, _factory = false): string {
  validateStyleSizeChart(chart)
  const e = escapeHtml
  return `<div class="content_size_chart"><table style="border-collapse:collapse;width:${Math.max(600, (chart.columns.length + 1) * 150)}px;max-width:100%;margin:0 auto;text-align:center;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:14px;line-height:20px"><caption style="color:black"><p style="font-size:24px;line-height:30px;text-align:center;font-weight:400;margin:0">PILIH UKURAN</p><p style="font-size:14px;line-height:20px;text-align:center;font-weight:700;margin:0 0 10px">${e(chart.note)}</p></caption><tbody><tr>${['SIZE', ...chart.columns].map((column, index) => `<${index ? 'td' : 'th'} style="height:40px;background-color:black;color:white;text-align:center;font-weight:${index ? 400 : 700};padding:0">${e(column)}</${index ? 'td' : 'th'}>`).join('')}</tr>${chart.rows.map((row, index) => `<tr>${[row.size, ...row.values].map(value => `<td style="width:150px;height:40px;text-align:center;font-family:Arial Black;font-weight:400;background-color:${row.shaded === false ? 'white' : index % 2 ? '#f2f2f2' : 'white'};padding:0">${e(value)}</td>`).join('')}</tr>`).join('')}</tbody></table><p style="margin:10px 0 0;text-align:center;font-size:14px;line-height:18px;font-weight:700">Untuk rekomendasi, referensi, atau jika anda memiliki,</p><p style="margin:0;text-align:center;font-size:14px;line-height:18px;font-weight:700">pertanyaan lain anda bisa berkonsultasi dengan custumer servis kami</p></div>`
}
export function defaultStyleDescription(): string {
  return `<div style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:14px;line-height:17px;color:black">${['Size Type: Regular', 'Instruksi Pencucian: Hanya boleh dicuci tangan, Cuci Kering, Cuci Mesin', 'Musim: Semua Musim', 'Bahan: Polyester', 'Petunjuk pembelian', 'Ukur lingkar dada anda. Apabila sesuai dengan label, anda bisa memilih size sesuai label yang kami sediakan, atau anda bisa memilih satu size lebih besar agar lebih longgar dan nyaman.'].map(text => `<p style="font-weight:700;margin:0">${text}</p>`).join('')}<br>${styleSizeChartHtml(STYLE_DEFAULT_CHART)}</div>`
}
export function defaultStyleSalesContent(style: Partial<StyleArchiveShellRecord>, language: SalesBaseContent['language']): SalesBaseContent {
  const existing = style.salesContents?.find(content => content.language === language)
  if (existing) return structuredClone(existing)
  return { language, title: style.styleNameTranslations?.[language as 'en' | 'id' | 'ms'] || (language === 'en' ? style.styleNameEn : '') || style.styleName || '', description: style.detailDescription || defaultStyleDescription(), sellingPoints: style.sellingPointText || '', imageUrls: [...(style.galleryImageUrls || [])], videoUrls: [], sizeChartUrl: STYLE_DEFAULT_CHART_URL, version: 0 }
}
export function applyStyleSizeChart(description: string, chart: StyleSizeChartDraft): string {
  const html = styleSizeChartHtml(chart)
  const block = /<div\b[^>]*class=["']content_size_chart["'][^>]*>[^]*?<\/div>/i
  if (block.test(description)) return description.replace(block, html)
  const previous = /<table\b[^>]*>\s*<caption[^>]*>\s*PILIH UKURAN[^]*?<\/table>/i
  return previous.test(description) ? description.replace(previous, html) : `${description}${html}`
}

import { escapeHtml } from '../utils.ts'
import { STYLE_SIZE_CHART_PRESETS, STYLE_SIZE_OPTIONS, STYLE_SIZE_PARAMETERS, validateStyleSizeChart, type StyleSizeChartDraft } from '../data/pcs-style-size-chart.ts'

const prefix = 'pcs-product-archive', e = escapeHtml
export function styleContentButton(label: string, action: string, extra = ''): string {
  return `<button type="button" class="style-content-button" data-${prefix}-action="${action}" data-skip-page-rerender="true" ${extra}>${e(label)}</button>`
}
const safeCss = (value: string) => value.split(';').map(rule => {
  const split = rule.indexOf(':'), key = rule.slice(0, split).trim().toLowerCase(), val = rule.slice(split + 1).trim()
  const rules: Record<string, RegExp> = {
    'color': /^(#[\da-f]{3,8}|[a-z]+|rgb\([\d ,]+\))$/i, 'background-color': /^(#[\da-f]{3,8}|[a-z]+|rgb\([\d ,]+\))$/i,
    'font-size': /^\d{1,3}(px|pt|em)$/, 'font-weight': /^(normal|bold|[1-9]00)$/, 'font-family': /^[a-z ,"'-]+$/i,
    'font-style': /^(normal|italic)$/, 'text-align': /^(left|right|center|justify)$/, 'text-decoration': /^(none|underline|line-through)$/, 'text-decoration-line': /^(none|underline|line-through)$/,
    'line-height': /^(normal|\d{1,3}(px|em)?)$/, 'width': /^(\d{1,5}px|\d{1,3}%)$/, 'height': /^\d{1,5}px$/, 'max-width': /^(\d{1,5}px|\d{1,3}%)$/,
    'margin': /^(0|auto|\d{1,3}px)( (0|auto|\d{1,3}px)){0,3}$/, 'padding': /^(0|\d{1,3}px)( (0|\d{1,3}px)){0,3}$/, 'border-collapse': /^(collapse|separate)$/, 'border': /^1px solid (#[\da-f]{3,8}|[a-z]+)$/i,
  }
  return rules[key]?.test(val) ? `${key}:${val}` : ''
}).filter(Boolean).join(';')
/** Description-only sanitizer: retain bounded presentation CSS; never application event attributes. */
export function styleContentHtml(value: string): string {
  const allowed = new Set(['p','br','strong','b','em','i','u','s','ul','ol','li','h1','h2','h3','h4','blockquote','table','thead','tbody','tfoot','tr','th','td','caption','hr','img','a','div','span','video','source'])
  const input = value.replace(/<!--[^]*?-->/g, '').replace(/<(script|style|iframe|object|embed|svg|math|form)\b[^>]*>[^]*?<\/\1\s*>/gi, '')
  const text = (raw: string) => e(raw).replace(/&amp;(#[xX][0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos|nbsp);/g, '&$1;')
  let position = 0; const parts: string[] = []
  for (const match of input.matchAll(/<\s*(\/?)\s*([a-z][a-z0-9]*)\b([^>]*)>/gi)) {
    parts.push(text(input.slice(position, match.index))); position = match.index! + match[0].length
    const [, closing, rawName, attributes] = match, name = rawName.toLowerCase(); if (!allowed.has(name)) continue
    if (closing) { if (!['br','hr','img','source'].includes(name)) parts.push(`</${name}>`); continue }
    const values = new Map<string, string>()
    for (const attr of attributes.matchAll(/([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi)) {
      const decoded = (attr[2] ?? attr[3] ?? attr[4] ?? '').replace(/&(quot|apos|amp|lt|gt);/g, (_, entity: string) => ({ quot: '"', apos: "'", amp: '&', lt: '<', gt: '>' })[entity]!)
      values.set(attr[1].toLowerCase(), decoded)
    }
    const extras: string[] = [], css = safeCss(values.get('style') || '')
    if (css) extras.push(`style="${e(css)}"`)
    if (name === 'div' && values.get('class') === 'content_size_chart') extras.push('class="content_size_chart"')
    if (['img','a','video','source'].includes(name)) {
      const key = name === 'a' ? 'href' : 'src', url = values.get(key) || ''
      if (/^(https?:\/\/|\/[^/])/i.test(url) && !/[\u0000-\u0020\u007f]/.test(url)) extras.push(`${key}="${e(url)}"`)
      else if (name !== 'a') continue
      if (name === 'a') extras.push('target="_blank"', 'rel="noopener noreferrer"')
      if (name === 'img') extras.push(`alt="${e(values.get('alt') || '商品描述图片')}"`, 'loading="eager"')
      if (name === 'video') extras.push('controls', 'preload="metadata"')
    }
    if (name === 'th' || name === 'td') for (const key of ['colspan','rowspan']) if (/^\d{1,2}$/.test(values.get(key) || '')) extras.push(`${key}="${values.get(key)}"`)
    parts.push(`<${name}${extras.length ? ' ' + extras.join(' ') : ''}>`)
  }
  parts.push(text(input.slice(position))); return parts.join('')
}
export function renderStyleContent(value: string): string {
  return `<div class="style-rich-content overflow-x-auto" style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:14px;line-height:normal;color:black">${styleContentHtml(value) || '<span class="text-slate-400">未填写</span>'}</div>`
}
function editorTool(key: string, name: string, command: string, display: string, source: boolean): string {
  return `<button type="button" title="${name}" aria-label="${name}" class="style-editor-tool" data-${prefix}-action="rich-format" data-editor="${key}" data-command="${command}" ${source ? 'disabled' : ''}>${display}</button>`
}
export function renderStyleRichEditor(label: string, key: string, value: string, source: boolean): string {
  const tools = [['bold','加粗','<b>B</b>'],['underline','下划线','<u>U</u>'],['removeFormat','清除格式','<i>▱</i>'],['justifyLeft','段落左对齐','☰'],['insertUnorderedList','无序列表','• ≡'],['insertOrderedList','有序列表','1 ≡'],['table','表格','▦'],['link','链接','<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2"/></svg>'],['picture','图片','▧'],['video','视频','<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="5" width="13" height="14" rx="2"/><path d="m16 9 6-4v14l-6-4z"/></svg>']]
  return `<section class="space-y-2" data-style-rich-section="${key}"><h3 class="text-sm font-medium text-slate-700">${e(label)}</h3><div class="style-rich-frame"><div class="style-editor-toolbar" role="toolbar" aria-label="${e(label)}格式工具"><select aria-label="文本样式" data-${prefix}-field="rich.formatBlock" data-editor="${key}" ${source ? 'disabled' : ''}><option value="p">样式</option><option value="p">正文</option><option value="h1">标题 1</option><option value="h2">标题 2</option><option value="h3">标题 3</option><option value="blockquote">引用</option></select>${tools.slice(0,3).map(([command,name,display])=>editorTool(key,name,command,display,source)).join('')}<select aria-label="字体" data-${prefix}-field="rich.fontName" data-editor="${key}" ${source ? 'disabled' : ''}>${['Helvetica Neue','Arial','Arial Black','Times New Roman','Courier New'].map(font=>`<option value="${font}">${font}</option>`).join('')}</select><label class="style-editor-tool" title="文字颜色"><span style="background:#ffff00;color:black;font-weight:bold">A</span><input type="color" aria-label="文字颜色" value="#000000" data-${prefix}-field="rich.foreColor" data-editor="${key}" ${source ? 'disabled' : ''}></label><label class="style-editor-tool" title="背景颜色"><span style="background:#ffff00">▰</span><input type="color" aria-label="背景颜色" value="#ffff00" data-${prefix}-field="rich.hiliteColor" data-editor="${key}" ${source ? 'disabled' : ''}></label><select aria-label="段落对齐" data-${prefix}-field="rich.justify" data-editor="${key}" ${source ? 'disabled' : ''}><option value="justifyLeft">段落</option><option value="justifyLeft">左对齐</option><option value="justifyCenter">居中</option><option value="justifyRight">右对齐</option><option value="justifyFull">两端对齐</option></select>${tools.slice(3).map(([command,name,display])=>editorTool(key,name,command,display,source)).join('')}<button type="button" class="style-editor-tool" aria-label="全屏" title="全屏" data-${prefix}-action="rich-fullscreen" data-editor="${key}">⛶</button><button type="button" class="style-editor-tool" aria-label="${source ? '返回编辑' : 'HTML 源码'}" title="HTML 源码" data-${prefix}-action="rich-source" data-editor="${key}">&lt;/&gt;</button><details class="relative"><summary class="style-editor-tool" aria-label="帮助">?</summary><div class="absolute right-0 z-10 w-64 border bg-white p-3 text-sm">选中文字后使用格式工具。⌘/Ctrl+B 加粗，⌘/Ctrl+U 下划线。尺码表请通过下方工具生成后插入。</div></details></div>${source ? `<textarea aria-label="${e(label)} HTML 源码" class="style-rich-content w-full font-mono" data-${prefix}-field="${key}">${e(value)}</textarea>` : `<div contenteditable="true" role="textbox" aria-multiline="true" aria-label="${e(label)}" class="style-rich-content" data-style-rich-editor="${key}">${styleContentHtml(value)}</div>`}</div></section>`
}
export function renderStyleSizeChartTool(chart: StyleSizeChartDraft, preview: string, imageUrl = '', countries: string[] = []): string {
  const multi = (label: string, kind: string, options: Array<{value:string;label:string}>, selected: string[]) => `<fieldset><legend class="style-chart-label">${label}</legend><div class="style-chart-options">${options.map(item => `<button type="button" class="style-chart-option" aria-pressed="${selected.includes(item.value)}" data-${prefix}-action="chart-select" data-kind="${kind}" data-value="${e(item.value)}">${e(item.label)}</button>`).join('')}</div></fieldset>`
  const radios = (label: string, key: string, values: string[], selected = '') => `<fieldset><legend class="style-chart-label">${label}</legend><div class="style-chart-radios">${values.map((name,index) => `<label><input type="radio" name="chart-${key}" value="${index+1}" data-${prefix}-field="chart.${key}" ${selected === String(index+1) ? 'checked' : ''}>${name}</label>`).join('')}</div></fieldset>`
  return `<details open class="style-chart-tool" data-style-size-chart-tool><summary>尺码表生成工具 <span class="style-chart-arrow">↓</span></summary><div class="style-chart-body"><fieldset><legend class="style-chart-label">示意图</legend><div class="style-chart-diagrams">${Object.entries(STYLE_SIZE_CHART_PRESETS).map(([type,preset]) => `<div><label><input type="radio" name="style-size-chart-type" value="${type}" data-${prefix}-field="chart.type" ${type === chart.garmentType ? 'checked' : ''}>${preset.name}</label><button type="button" aria-label="查看${preset.name}示意图" data-${prefix}-action="image" data-url="/materials/pcs-size-chart/${preset.image}" data-name="${preset.name}示意图"><img src="/materials/pcs-size-chart/${preset.image}" alt="${preset.name}示意图" width="200" height="150"></button></div>`).join('')}</div></fieldset>${radios('瘦身类型','fit',['瘦身型','常规型','松散型'],chart.fit)}${radios('弹性类型','stretch',['没有弹性','有点弹性','非常有弹性'],chart.stretch)}${radios('透明度','transparency',['微透','适中','不透'],chart.transparency)}<fieldset><legend class="style-chart-label">类型</legend><button type="button" class="style-chart-option" aria-pressed="true">尺码纵向</button></fieldset>${multi('尺码','selectedSizes',STYLE_SIZE_OPTIONS.map(value=>({value,label:value})),chart.selectedSizes || [])}${multi('参数','selectedParameters',STYLE_SIZE_PARAMETERS,chart.selectedParameters || [])}${multi('预留尺码','reservedSizes',[{value:'EUR',label:'欧码'},{value:'US',label:'美码'},{value:'UK',label:'英码'}],chart.reservedSizes || [])}<div class="mt-4">${styleContentButton('生成尺码','chart-generate')}</div>${chart.generated ? `<div class="mt-5 overflow-x-auto" data-style-chart-matrix>${renderStyleChartMatrix(chart)}</div><div class="mt-4 flex flex-wrap gap-2">${styleContentButton('插入到商品描述','chart-description')}${styleContentButton('插入到工厂做货尺码表','chart-factory')}${countries.map(country=>styleContentButton(`插入到商品描述_${country}`,'chart-country',`data-country="${country}"`)).join('')}</div>` : ''}<div data-style-chart-preview>${preview ? renderStyleContent(preview) : ''}</div>${imageUrl ? `<div class="mt-5 flex gap-2">${styleContentButton('上传图片','chart-image')}${styleContentButton('删除图片','chart-delete-image')}</div><div class="mt-3" data-style-generated-image><img src="${e(imageUrl)}" alt="生成尺码图片" style="width:600px;max-width:100%;height:auto"></div>` : ''}</div></details>`
}
export function renderStyleChartMatrix(chart: StyleSizeChartDraft): string {
  return `<table class="style-chart-matrix" style="width:${Math.max(600,(chart.columns.length+1)*150)}px"><caption><p style="font-size:24px">PILIH UKURAN</p><p style="font-weight:bold">${e(chart.note)}</p></caption><thead><tr><th>SIZE</th>${chart.columns.map(column=>`<th>${e(column)}</th>`).join('')}</tr></thead><tbody>${chart.rows.map((row,index)=>`<tr><td>${e(row.size)}</td>${chart.columns.map((column,ci)=>`<td><input type="text" aria-label="${e(row.size)} ${e(column)}" value="${e(row.values[ci] || '')}" data-${prefix}-field="chart.value.${index}.${ci}" maxlength="80"></td>`).join('')}</tr>`).join('')}</tbody></table><p style="margin-top:10px;text-align:center;font-weight:bold">Untuk rekomendasi, referensi, atau jika anda memiliki,<br>pertanyaan lain anda bisa berkonsultasi dengan custumer servis kami</p>`
}
export async function generateStyleSizeChartImage(chart: StyleSizeChartDraft): Promise<Blob> {
  validateStyleSizeChart(chart)
  const canvas = document.createElement('canvas'), width = Math.max(600,(chart.columns.length+1)*150), rowHeight = 40, top = 64
  canvas.width = width; canvas.height = Math.max(600,top+(chart.rows.length+1)*rowHeight+60)
  const context = canvas.getContext('2d'); if (!context) throw new Error('尺码图片生成失败，请重试。')
  context.fillStyle = 'white'; context.fillRect(0,0,width,canvas.height); context.textAlign = 'center'; context.fillStyle = 'black'
  context.font = '24px Arial'; context.fillText('PILIH UKURAN',width/2,25)
  context.font = 'bold 14px Arial'; context.fillText(chart.note,width/2,46,width)
  const cellWidth = width/(chart.columns.length+1)
  const rows = [['SIZE',...chart.columns],...chart.rows.map(row=>[row.size,...row.values])]
  rows.forEach((row,index)=>{
    const y = top+index*rowHeight
    context.fillStyle = index === 0 ? 'black' : chart.rows[index-1]?.shaded === false ? 'white' : index%2 === 0 ? '#f2f2f2' : 'white'; context.fillRect(0,y,width,rowHeight)
    context.fillStyle = index === 0 ? 'white' : 'black'; context.font = index === 0 ? '14px Helvetica Neue' : '14px Arial Black'
    row.forEach((value,ci)=>{ if(index === 0) context.font = ci === 0 ? 'bold 14px Helvetica Neue' : '14px Helvetica Neue'; context.fillText(value,(ci+0.5)*cellWidth,y+25,cellWidth-8) })
  })
  context.fillStyle = 'black'; context.font = 'bold 14px Arial'
  const bottom = top+rows.length*rowHeight
  context.fillText('Untuk rekomendasi, referensi, atau jika anda memiliki,',width/2,bottom+25)
  context.fillText('pertanyaan lain anda bisa berkonsultasi dengan custumer servis kami',width/2,bottom+43)
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob ? resolve(blob) : reject(new Error('尺码图片生成失败，请重试。')),'image/png'))
}
export const STYLE_CONTENT_CSS = `<style>
.style-rich-frame{border:1px solid #c6c6c6;background:white}.style-editor-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:2px;background:#f5f5f5;border-bottom:1px solid #eee;padding:5px}.style-editor-toolbar select,.style-editor-tool{height:32px;border:0;border-radius:2px;background:#eee;color:#333;padding:0 10px;font:14px Arial;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.style-editor-tool{min-width:32px;position:relative}.style-editor-tool input[type=color]{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}.style-editor-tool:disabled{opacity:.4}.style-editor-toolbar summary{list-style:none}.style-rich-frame .style-rich-content{height:420px;min-height:260px;overflow:auto;resize:vertical;padding:10px;outline:none;font:14px/normal "Helvetica Neue",Helvetica,Arial,sans-serif;color:black;background:white}.style-rich-content p{margin:0}.style-rich-content ul{list-style:disc;padding-left:24px}.style-rich-content ol{list-style:decimal;padding-left:24px}.style-rich-content img,.style-rich-content video{max-width:100%}.style-rich-content h1{font-size:32px}.style-rich-content h2{font-size:24px}.style-rich-content h3{font-size:18px}.style-rich-content blockquote{border-left:3px solid #ccc;padding-left:10px}.style-rich-fullscreen{position:fixed;inset:0;z-index:60;background:white;padding:16px}.style-rich-fullscreen .style-rich-content{height:calc(100vh - 110px)}.style-content-button{border:1px solid #bbb;background:white;padding:7px 14px;font-size:14px;color:#333;cursor:pointer}.style-content-button:hover{background:#f3f3f3}.style-chart-tool{border:1px solid #d2d6de;background:white;font:14px Arial;color:#333}.style-chart-tool>summary{cursor:pointer;padding:10px;list-style:none;border-bottom:1px solid #ddd}.style-chart-tool:not([open]) .style-chart-arrow{display:inline-block;transform:rotate(180deg)}.style-chart-body{padding:24px 40px}.style-chart-label{color:#4d70b5;margin:15px 0;font-weight:600}.style-chart-diagrams{display:flex;flex-wrap:wrap;gap:10px 40px;margin-left:40px}.style-chart-diagrams>div{width:200px}.style-chart-diagrams label,.style-chart-radios label{display:flex;align-items:center;gap:5px;margin-bottom:4px}.style-chart-diagrams input,.style-chart-radios input{width:20px;height:20px;accent-color:#267bff}.style-chart-diagrams img{width:200px;height:150px;object-fit:fill}.style-chart-radios{display:flex;flex-wrap:wrap;gap:20px;margin-left:40px}.style-chart-radios label{width:170px}.style-chart-options{display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:5px;margin-left:40px}.style-chart-option{border:1px solid #bbb;background:white;color:#444;min-height:28px;font-size:12px;padding:2px;line-height:14px;word-break:break-word;cursor:pointer}.style-chart-option[aria-pressed=true]{background:#0751c9;border-color:#0751c9;color:white}.style-chart-matrix{border-collapse:collapse;text-align:center;margin:0 auto}.style-chart-matrix th{height:40px;background:black;color:white}.style-chart-matrix td{height:40px;font-weight:bold}.style-chart-matrix tr:nth-child(even){background:#f2f2f2}.style-chart-matrix input{width:90%;max-width:130px;text-align:center;border:1px solid #ccc;height:30px;background:white;font-weight:400}.style-chart-matrix caption{margin-bottom:10px}.style-chart-matrix caption p{margin:0}
@media(max-width:1280px){.style-chart-body{padding:20px}.style-chart-diagrams,.style-chart-radios,.style-chart-options{margin-left:15px}}
</style>`

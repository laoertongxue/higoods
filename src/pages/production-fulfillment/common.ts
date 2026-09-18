// @page-pattern: list
import { escapeHtml } from '../../utils'
import { renderButton } from '../../components/ui/button'
import { renderStandardListPage } from '../../components/ui/list-page'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../components/ui/list-table'
import { renderTablePagination } from '../../components/ui/pagination'
import { loadListColumnPreferences, saveListColumnPreferences, sortStandardListRows, paginateStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../components/ui/list-table-model'
import type { ViewState } from './ui-state'
import type { PFTask, PFMaterial } from './model'

export const e = escapeHtml
export const fmt = (value:number|null|undefined):string => value==null||!Number.isFinite(value)?'待判定':value.toLocaleString('zh-CN',{maximumFractionDigits:2})
const dateFormatters=[false,true].map(short=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:short?undefined:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}))
export function dt(value:string|null|undefined, short=false):string {
  if(!value || !Number.isFinite(Date.parse(value)))return '—'
  const text=dateFormatters[short?1:0].format(new Date(value))
  return text.replaceAll('/','-')
}
export function badge(text:string):string {
  const tone=/预计|追回|临期|风险/.test(text)?'amber':/逾期|超时|冲突|阻断/.test(text)?'red':/正常|按期|已完成|已到厂|全部发货/.test(text)?'green':/进行|生产中|部分|处理中/.test(text)?'blue':'slate'
  return `<span class="pf-badge pf-${tone}">${e(text)}</span>`
}
export function button(label:string,action:string,attrs=''):string {
  return renderButton({label,action:{prefix:'pf',action,skipPageRerender:true},size:'sm',className:'pf-button'}).replace('<button','<button '+attrs)
}
export function field(label:string,key:string,value:string|number,type='text'):string {
  return `<label class="pf-field"><span>${e(label)}</span><input type="${e(type)}" data-pf-field="${e(key)}" data-skip-page-rerender="true" value="${e(value)}" ${type==='number'?'min="0" step="0.25"':''}></label>`
}
export function select(label:string,key:string,value:string,options:string[]):string {
  return `<label class="pf-field"><span>${e(label)}</span><select data-pf-field="${e(key)}" data-skip-page-rerender="true">${options.map(v=>`<option value="${e(v)}" ${value===v?'selected':''}>${e(v)}</option>`).join('')}</select></label>`
}
export function card(title:string,html:string,extra=''):string {return `<section class="pf-card ${e(extra)}"><header class="pf-card-heading"><h2>${e(title)}</h2></header><div class="pf-card-body">${html}</div></section>`}
export function tabs(label:string,action:string,values:string[],selected:string):string {
  return `<nav class="pf-tabs pf-context-tabs" role="tablist" aria-label="${e(label)}">${values.map(value=>`<button type="button" role="tab" aria-selected="${selected===value}" data-pf-action="${e(action)}" data-value="${e(value)}" class="${selected===value?'active':''}">${e(value)}</button>`).join('')}</nav>`
}
export function anchor(label:string,path:string):string {return `<a class="pf-link" href="${e(path)}" data-pf-action="navigate" data-path="${e(path)}" data-skip-page-rerender="true">${e(label)}</a>`}
export function imageCell(name:string,code:string,url:string):string {
  const image=url?`<button class="pf-thumbnail" type="button" data-pf-action="image" data-image="${e(url)}" data-label="${e(name)}" data-skip-page-rerender="true" aria-label="查看${e(name)}大图"><img src="${e(url)}" width="44" height="44" alt="${e(name)}" decoding="sync"><span class="pf-image-error" hidden>图片加载失败</span></button>`:'<span class="pf-missing-image">对应实图待补</span>'
  return `<div class="pf-object">${image}<div><strong>${e(name)}</strong><small>${e(code)}</small></div></div>`
}
export function styleCell(task:PFTask):string {return imageCell(task.styleName,task.styleRef,task.imageUrl)}
export function materialCell(material:PFMaterial):string {return imageCell(material.name,material.id,material.imageUrl)}
export interface PFTableContext { id:string; title:string; columns:StandardListColumn<unknown>[]; rows:unknown[]; preferences:StandardListColumnPreferences; sort:StandardListSortState|null; page:number }
export const tableContexts=new Map<string,PFTableContext>()
export let activeTableId=''
export function setActiveTable(id:string):void {activeTableId=id}
function prefsKey(id:string):string {return `dds-pf-columns-v1:${id}`}
export function renderDataTable<T>(id:string,title:string,columns:StandardListColumn<T>[],rows:T[],_state:ViewState,options:{embedded?:boolean}={}):string {
  let ctx=tableContexts.get(id)
  if(!ctx){
    const defaults={order:columns.map(c=>c.key),visibleKeys:columns.map(c=>c.key),frozenKeys:columns.filter(c=>c.required&&c.freezeable).map(c=>c.key).slice(0,1),pageSize:20}
    const preferences=typeof localStorage==='undefined'?defaults:loadListColumnPreferences(localStorage,prefsKey(id),columns,defaults,[10,20,50])
    ctx={id,title,columns:columns as StandardListColumn<unknown>[],rows,preferences,sort:null,page:1};tableContexts.set(id,ctx)
  }
  ctx.columns=columns as StandardListColumn<unknown>[];ctx.rows=rows;ctx.title=title
  const sorted=sortStandardListRows(rows,ctx.sort,(r,key)=>columns.find(c=>c.key===key)?.sortValue?.(r)??String((r as Record<string,unknown>)[key]??''))
  const paging=paginateStandardListRows(sorted,ctx.page,ctx.preferences.pageSize);ctx.page=paging.currentPage
  const tableHtml=renderStandardListTable({columns,rows:paging.rows,preferences:ctx.preferences,sort:ctx.sort,eventPrefix:'pf',skipPageRerender:true,emptyText:'当前查询范围没有记录，可重置筛选或调整统计范围。'})
  const paginationHtml=renderTablePagination({total:paging.total,from:paging.from,to:paging.to,currentPage:paging.currentPage,totalPages:paging.totalPages,pageSize:paging.pageSize,actionPrefix:'pf',skipPageRerender:true})
  const columnSettings=button('列设置','columns',`data-table="${e(id)}"`)
  if(options.embedded)return `<section class="pf-standard-table pf-embedded-table" data-pf-table="${e(id)}" aria-label="${e(title)}">${tableHtml}<div class="pf-embedded-table-footer"><div class="pf-embedded-pagination">${paginationHtml}</div>${columnSettings}</div></section>`
  return `<div data-pf-table="${e(id)}">${renderStandardListPage({title,showHeader:false,filtersHtml:'',listTitle:`${title} · ${rows.length}条`,className:'pf-standard-table',
    listActionsHtml:columnSettings,tableHtml,paginationHtml,
  })}</div>`
}
export function renderColumns(id:string):string {
  const ctx=tableContexts.get(id);if(!ctx)return ''
  activeTableId=id
  let settings=renderStandardListColumnSettings({title:`${ctx.title} · 列设置`,columns:ctx.columns,preferences:ctx.preferences,eventPrefix:'pf',maxFrozenWidth:520,skipPageRerender:true})
  const order=ctx.preferences.order.filter(key=>!ctx.columns.find(c=>c.key===key)?.actionColumn)
  order.forEach((key,i)=>{const title=ctx.columns.find(c=>c.key===key)?.title??key;settings=settings.replace(`${e(title)}</span>`,`${e(title)}</span>${button('↑','column-up',`data-key="${e(key)}" aria-label="${e(title)}上移" ${i===0?'disabled':''}`)}`)})
  return settings.replaceAll('duration-200','duration-0').replaceAll('animate-in','').replaceAll('slide-in-from-right','').replace('</h2>','</h2><p class="text-xs">必需识别列不可隐藏。可拖拽，或使用各行上移按钮调整顺序。</p>')
}
export function saveTablePreferences(ctx:PFTableContext):void {if(typeof localStorage!=='undefined')saveListColumnPreferences(localStorage,prefsKey(ctx.id),ctx.preferences)}
export function resetTablePages():void {tableContexts.forEach(ctx=>{ctx.page=1})}

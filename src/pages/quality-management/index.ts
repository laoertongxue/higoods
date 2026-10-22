// @page-pattern: list
import { escapeHtml as e } from '../../utils.ts'
import { appStore } from '../../state/store.ts'
import { renderStandardListPage, renderStandardListFilters, renderStandardListStats } from '../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../components/ui/list-table.ts'
import { loadListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, saveListColumnPreferences, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../components/ui/pagination.ts'
import { exportStandardListRows } from '../../components/ui/list-export.ts'
import { getDefaultQualityConfigurations, ensureQualityManagementRecords, listQualityConfigurations, getQualityConfiguration, buildQualityConfigurationDraft, saveQualityConfigurationDraft, publishQualityConfiguration, disableQualityConfiguration, listQualityConfigurationOperations } from '../../data/fcs/quality-management-records.ts'
import { ensureQualityInspectionSources, ensureQualityInspectionRecordDetails, listQualityInspectionRecords, getQualityInspectionRecord, listQualityInspectionAudits, calculateQualityInspectionStatistics, registeredQualityInspectionSources, type QualityInspectionQuery } from '../../data/fcs/quality-management-read-model.ts'
import { INSPECTION_STAGES, type InspectionConfiguration, type InspectionConfigurationKind, type InspectionContext, type InspectionSourceKind, type QualityInspectionRecordView, type InspectionReference, type InspectionApplicability, type InspectionStandardItem, type InitialFullInspectionConditions, type InspectionRuleConfig, type AdditionalInspectionStandard } from '../../data/fcs/quality-management-types.ts'
import { renderQualityConfigurationEditor, renderQualityStandardPreview, updateQualityDraftField, qualityDraftPathValue, qualitySourceLabels, qualityStatusLabels, qualityObjectLabel, qualityStageLabel, qualityOverrideFieldLabels } from './editor.ts'

import { calculateInspectionTarget } from '../../data/fcs/quality-management-rules.ts'
import { renderInspectionReference } from './reference.ts'

const rootPath = '/fcs/quality-management'
const sections = { 'basic-standards': ['基本质检标准','BASIC'], 'additional-standards': ['附加质检标准','ADDITIONAL'], 'inspection-rules': ['检验方式与升级规则','RULE'], records: ['质检记录',''], audits: ['稽查与升级记录',''], statistics: ['质检统计分析',''] } as const
type Section = keyof typeof sections
let path = '', section: Section = 'basic-standards', currentId = '', editMode = false, draft: InspectionConfiguration | undefined
let preparationFailure = '', fullConditionsDraft: InitialFullInspectionConditions | null = null
let dirty = false, busy = false, feedback = '', confirmation: 'publish'|'disable'|'' = '', columnsOpen = false
let page = 1, sort: StandardListSortState | null = null, query: QualityInspectionQuery = {}, configStatus = ''
let preferences: StandardListColumnPreferences | undefined, lastColumns: StandardListColumn<any>[] = [], lastRows: any[] = [], dragKey = ''
let previewContext: InspectionContext = { sourceKind: 'PRODUCTION_RETURN', attributes: { size: 'M' } }
const blankStorage = { getItem: (_key:string) => null, setItem: (_key:string,_value:string) => undefined }
function storage() { try { return typeof localStorage === 'undefined' ? blankStorage : localStorage } catch { return blankStorage } }
function button(label: string, action: string, extra = '', primary = false): string { return `<button type="button" class="rounded ${primary?'bg-blue-600 text-white':'border bg-background'} px-3 py-2 text-sm disabled:opacity-50" data-qm-action="${action}" data-qm-busy-control ${extra} ${busy?'disabled':''}>${e(label)}</button>` }
function link(label: string, href: string): string { return `<a class="text-blue-700 hover:underline" href="${e(href)}" data-nav="${e(href)}">${e(label)}</a>` }
function sourceTime(value: string | undefined, timeZone?:string):string { if(!value)return '未完成';if(!timeZone || !/(Z|[+-]\d{2}:?\d{2})$/.test(value))return value;try{return new Intl.DateTimeFormat('zh-CN',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(value))}catch{return value} }
function amount(value?: number): string { return value === undefined ? '未知' : String(value) }
function configPath(kind: InspectionConfigurationKind) { return `${rootPath}/${kind === 'BASIC'?'basic-standards':kind === 'ADDITIONAL'?'additional-standards':'inspection-rules'}` }
function configurationKind(): InspectionConfigurationKind | undefined { return sections[section][1] || undefined }
function feedbackHtml(): string { return `<div data-qm-feedback role="status" class="text-sm ${feedback.includes('未') || feedback.includes('失败') || feedback.includes('冲突')?'text-red-700':'text-blue-700'}">${e(feedback)}</div>` }
function showFeedback(message: string) { feedback = message; const host=document.querySelector('[data-qm-feedback]'); if(host) host.textContent=message }
export function qualityManagementHasUnsavedChanges(): boolean { return dirty }
export async function prepareQualityManagementPage(pathname = typeof location==='undefined'?'':location.pathname): Promise<void> {
  try {
    await ensureQualityManagementRecords()
    const parts = pathname.split('?')[0].split('/').filter(Boolean)
    if (parts[2] === 'records' && parts[3] && parts[4]) await ensureQualityInspectionRecordDetails(parts[3] as InspectionSourceKind, decodeURIComponent(parts[4]))
    else if (parts[2] === 'audits' && parts[3]) { const [kind, id] = decodeURIComponent(parts[3]).split('|'); await ensureQualityInspectionRecordDetails(kind as InspectionSourceKind, id) }
    else if (/\/(records|audits|statistics)(?:\/|$)/.test(pathname.split('?')[0])) await ensureQualityInspectionSources()
    preparationFailure = ''
  } catch (error) { preparationFailure = error instanceof Error ? error.message : '质检资料无法读取，请保留原资料后重新读取。' }
}
function enter(nextPath: string) {
  if (path === nextPath) return
  path = nextPath; const parts = nextPath.split('?')[0].split('/').filter(Boolean)
  section = (parts[2] in sections ? parts[2] : 'basic-standards') as Section
  currentId = parts[3] ? decodeURIComponent(parts[3]) : ''; editMode = parts[4] === 'edit'
  draft = editMode && currentId && !preparationFailure ? getQualityConfiguration(currentId) : undefined
  fullConditionsDraft = draft?.kind==='RULE' && draft.initialFullInspection ? structuredClone(draft.initialFullInspection) : null
  if (draft && draft.status !== 'DRAFT') editMode = false
  dirty=false; feedback=''; confirmation=''; columnsOpen=false; page=1; sort=null; preferences=undefined; query={}; configStatus=''; const params=new URLSearchParams(nextPath.split('?')[1] || ''); for(const key of ['sourceKind','keyword','status','factoryName','warehouseName','dateFrom','dateTo'])if(params.get(key))(query as any)[key]=params.get(key)
}
function filters(): string {
  const kind=configurationKind()
  return renderStandardListFilters({ actionPrefix:'qm', fieldsHtml:`<label class="text-xs">款号、单号或名称<input class="mt-1 block h-9 w-56 rounded border px-2" data-qm-filter="keyword" value="${e(query.keyword || '')}"></label>${kind ? `<label class="text-xs">状态<select class="mt-1 block h-9 rounded border px-2" data-qm-filter="configStatus"><option value="">全部</option>${Object.entries(qualityStatusLabels).map(([id,label])=>`<option value="${id}" ${configStatus===id?'selected':''}>${label}</option>`).join('')}</select></label>` : `<label class="text-xs">业务来源<select class="mt-1 block h-9 rounded border px-2" data-qm-filter="sourceKind"><option value="">全部</option>${Object.entries(qualitySourceLabels).map(([id,label])=>`<option value="${id}" ${query.sourceKind===id?'selected':''}>${label}</option>`).join('')}</select></label><label class="text-xs">状态<input class="mt-1 block h-9 w-32 rounded border px-2" data-qm-filter="status" value="${e(query.status || '')}"></label><label class="text-xs">工厂<input class="mt-1 block h-9 w-36 rounded border px-2" data-qm-filter="factoryName" value="${e(query.factoryName || '')}"></label><label class="text-xs">原成衣仓<input class="mt-1 block h-9 w-36 rounded border px-2" data-qm-filter="warehouseName" value="${e(query.warehouseName || '')}"></label><label class="text-xs">开始日期<input type="date" class="mt-1 block h-9 rounded border px-2" data-qm-filter="dateFrom" value="${e(query.dateFrom || '')}"></label><label class="text-xs">结束日期<input type="date" class="mt-1 block h-9 rounded border px-2" data-qm-filter="dateTo" value="${e(query.dateTo || '')}"></label>`}`, extraActionsHtml:button('导出筛选结果','export') })
}
function configColumns(): StandardListColumn<InspectionConfiguration>[] { return [
  {key:'name',title:'名称 / 编号',width:300,required:true,freezeable:true,sortable:true,render:row=>`${link(row.name,`${configPath(row.kind)}/${encodeURIComponent(row.id)}`)}<p class="mt-1 text-xs text-muted-foreground">${e(row.id)}</p>`},
  {key:'objectType',title:'对象 / 适用环节',width:300,render:row=>`${e(qualityObjectLabel(row.objectType))}<p class="text-xs">${e(row.applicability.stages?.map(qualityStageLabel).join('、') || '未配置')}</p>`},
  {key:'scope',title:'适用范围',width:280,render:row=>e([...(row.applicability.styleCategories || []),...(row.applicability.styleIds || [])].join('、') || '全部适用款')},
  {key:'version',title:'版本',width:90,sortable:true,render:row=>String(row.version)},
  {key:'status',title:'状态',width:100,sortable:true,render:row=>qualityStatusLabels[row.status]},
  {key:'updatedAt',title:'更新时间',width:190,sortable:true,render:row=>e(row.updatedAt)},
  {key:'actions',title:'操作',width:190,actionColumn:true,required:true,render:row=>row.status==='DRAFT'?link('编辑草稿',`${configPath(row.kind)}/${encodeURIComponent(row.id)}/edit`):button('派生新草稿','derive',`data-id="${e(row.id)}"`)},
] }
function styleCell(row: QualityInspectionRecordView): string { return `<div class="flex items-center gap-2">${row.imageUrl?`<button type="button" class="shrink-0" data-qm-action="open-image" data-url="${e(row.imageUrl)}" aria-label="查看${e(row.styleCode)}原图"><img class="h-12 w-12 object-contain" src="${e(row.imageUrl)}" alt="${e(row.styleName)} ${e(row.styleCode)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="text-xs text-red-700">图片加载失败</span></button>`:'<span class="text-xs text-amber-700">图片资料缺失</span>'}<div><p>${e(row.styleName)}</p><p class="text-xs text-muted-foreground">${e(row.styleCode)}</p></div></div>` }
function recordColumns(): StandardListColumn<QualityInspectionRecordView>[] { return [
  {key:'displayNo',title:'质检记录',width:230,required:true,freezeable:true,sortable:true,render:row=>link(row.displayNo,`${rootPath}/records/${row.sourceKind}/${encodeURIComponent(row.id)}`)},
  {key:'styleCode',title:'款式',width:270,required:true,sortable:true,render:styleCell},
  {key:'sourceKind',title:'来源 / 生产单',width:220,render:row=>`${qualitySourceLabels[row.sourceKind]}<p class="text-xs">${e(row.productionOrderNo || '无需生产来源')}</p>`},
  {key:'party',title:'工厂 / 原仓',width:200,render:row=>e(row.factoryName || row.warehouseName || '—')},
  {key:'quantity',title:'送检量（件）',width:120,sortable:true,render:row=>row.sourceKind==='PRE_PRODUCTION_SAMPLE'?'1':amount(row.sourceKind==='WAREHOUSE_STOCK'?row.sentQty:row.quantity)},
  {key:'receivedQty',title:'后道实收（件）',width:130,sortable:true,render:row=>row.sourceKind==='WAREHOUSE_STOCK'?amount(row.receivedQty):'—'},
  {key:'inspectedQty',title:'实检（件）',width:110,sortable:true,render:row=>row.sourceKind==='PRE_PRODUCTION_SAMPLE'?'—':amount(row.inspectedQty)},
  {key:'result',title:'实检合格 / 瑕疵 / 返工',width:230,render:row=>row.sourceKind==='PRE_PRODUCTION_SAMPLE'?(row.sampleResult==='HAS_ISSUE'?'有问题':row.sampleResult==='NO_ISSUE'?'无问题':'尚未提交'):`${amount(row.passedQty)} / ${amount(row.defectQty)} / ${amount(row.returnedQty)}`},
  {key:'release',title:'未检放行 / 正常放行',width:200,render:row=>row.sourceKind==='PRE_PRODUCTION_SAMPLE'?'—':`${amount(row.uninspectedReleaseQty)} / ${amount(row.normalReleaseQty)}`},
  {key:'status',title:'状态',width:130,sortable:true,render:row=>e(row.status)},
  {key:'completedAt',title:'完成时间',width:195,sortable:true,render:row=>e(sourceTime(row.completedAt,row.timeZone))},
  {key:'actions',title:'操作',width:130,actionColumn:true,required:true,render:row=>link('查看原业务',row.sourceHref)},
] }
function tablePage<T>(rows: T[], columns: StandardListColumn<T>[], stats: string, primary=''): string {
  lastColumns=columns; lastRows=rows
  const rules=columns.map(({key,required,freezeable,actionColumn})=>({key,required,freezeable,actionColumn}))
  preferences ||= loadListColumnPreferences(storage(),`higood:quality-list:${section}`,rules,{order:columns.map(row=>row.key),visibleKeys:columns.map(row=>row.key),frozenKeys:[],pageSize:20},[10,20,50])
  const sorted=sortStandardListRows(rows,sort,(row,key)=>columns.find(column=>column.key===key)?.sortValue?.(row) ?? (row as any)[key])
  const slice=paginateStandardListRows(sorted,page,preferences.pageSize); page=slice.currentPage
  return renderStandardListPage({title:sections[section][0],primaryActionsHtml:primary,feedbackHtml:feedbackHtml(),filtersHtml:filters(),statsHtml:stats,listTitle:`${sections[section][0]} · ${rows.length}条`,listActionsHtml:button('列设置','open-column-settings'),tableHtml:renderStandardListTable({columns,rows:slice.rows,preferences,sort,eventPrefix:'qm',skipPageRerender:true,emptyText:'当前条件下没有记录'}),paginationHtml:renderTablePagination({...slice,actionPrefix:'qm',skipPageRerender:true}),overlaysHtml:`<div data-qm-overlays>${columnsOpen?renderStandardListColumnSettings({title:'列表列设置',columns,preferences,eventPrefix:'qm',maxFrozenWidth:500,skipPageRerender:true}):''}</div>`})
}
function renderConfigList(): string {
  const rows=listQualityConfigurations(configurationKind()).filter(row=>(!configStatus || row.status===configStatus) && (!query.keyword || `${row.name} ${row.id}`.includes(query.keyword)))
  return tablePage(rows,configColumns(),renderStandardListStats([{label:'当前范围',value:rows.length},{label:'有效',value:rows.filter(row=>row.status==='EFFECTIVE').length},{label:'草稿',value:rows.filter(row=>row.status==='DRAFT').length}]),button('新增草稿','new','',true))
}
function renderApplicability(scope?: InspectionApplicability): string {
  const parts = [scope?.sourceKinds?.length ? `业务：${scope.sourceKinds.map(kind=>qualitySourceLabels[kind]).join('、')}` : '', scope?.stages?.length ? `环节：${scope.stages.map(qualityStageLabel).join('、')}` : '',scope?.styleCategories?.length ? `款式类别：${scope.styleCategories.join('、')}` : '', scope?.styleIds?.length ? `指定款：${scope.styleIds.join('、')}` : '', ...(scope?.attributes || []).map(row=>`${row.key==='size'?'尺码':row.key==='color'?'颜色':row.key}：${row.value}`)].filter(Boolean)
  return e(parts.join('；') || '全部适用范围')
}
function renderItems(snapshot: {items: InspectionStandardItem[]}): string { return `<div class="space-y-2">${snapshot.items.map(item=>`<article class="rounded border p-3 text-sm"><strong>${e(item.dimension)} · ${e(item.name)}</strong><p class="mt-1">${e(item.content)}</p><p>${e(item.criterion)}</p>${item.unit?`<p>单位：${e(item.unit)}</p>`:''}<p>适用范围：${renderApplicability(item.applicability)}</p><div class="mt-1 text-xs text-muted-foreground">依据：${item.references.map(ref=>renderInspectionReference(ref)).join('') || '未登记'} · 项目${e(item.id)}</div></article>`).join('')}</div>` }
function renderRuleDetails(rule: InspectionRuleConfig): string {
  const full=rule.initialFullInspection
  return `<p>按整批检查${rule.defaultPercent}%，最低${rule.minQuantity}件；档位${rule.percentSteps.join('%、')}%。</p><p>稽查门槛：${e(rule.roundThresholds.map(row=>`第${row.roundNumber}轮${row.unqualifiedQuantity}件`).join('、'))}</p>${full?`<h2 class="font-medium">生产回货初始全检条件</h2>${([['basicStyle','基础款及冷启动基础款'],['highDifficulty','做货难度A以及A以上（当前选项A、A+、A++）'],['outsideFabricWhitelist','正式BOM有面料SPU不在指定范围'],['firstFactoryTasks','车缝工厂前N任务']] as const).map(([key,label])=>`<p>${label}：${full[key]?'启用':'未启用'}</p>`).join('')}<p>该车缝工厂真正执行的前${full.firstTaskCount}个车缝任务。</p><p class="break-words">面料SPU范围：${e(full.fabricSpuWhitelist.join('、'))}</p><p>前三类条件覆盖同款生产单全部回货；前N任务条件覆盖同款、同厂、同生产单全部回货。已完成批次不追检。</p>`:'<p>未配置生产回货初始全检条件。</p>'}<p>抽检升检只覆盖当前批次，升检后不降低比例；全检不触发抽检稽查。</p>`
}
function renderOverrideDetails(config: AdditionalInspectionStandard): string {
  return `<h2 class="font-medium">覆盖关系及新要求</h2>${config.overrides.map(row=>`<article class="space-y-1 rounded border p-3 text-sm"><p>原项：${e(row.targetItemId)}；覆盖范围：${renderApplicability(row.applicability)}</p>${row.fields.map(field=>`<p>${e(qualityOverrideFieldLabels[field] || field)}：${field==='references'?(row.values.references || []).map(ref=>renderInspectionReference(ref)).join('') || '无':field==='applicability'?renderApplicability(row.values.applicability):e(String(row.values[field] ?? '未填写'))}</p>`).join('')}</article>`).join('') || '<p>无覆盖要求。</p>'}`
}
function previewFields(): string { return `<section class="space-y-3 rounded border bg-card p-4"><h2 class="font-semibold">合成预览</h2><div class="grid gap-3 md:grid-cols-4"><label class="text-xs">业务<select class="mt-1 block w-full rounded border p-2" data-qm-preview="sourceKind">${Object.entries(qualitySourceLabels).map(([id,label])=>`<option value="${id}" ${previewContext.sourceKind===id?'selected':''}>${label}</option>`).join('')}</select></label>${[['styleId','款式ID/款号'],['styleCategory','类别/定位编号'],['size','尺码（如M）'],['color','颜色']].map(([key,label])=>`<label class="text-xs">${label}<input class="mt-1 block w-full rounded border p-2" data-qm-preview="${key}" value="${e(String(key==='size'||key==='color'?previewContext.attributes?.[key] ?? '':(previewContext as any)[key] || ''))}"></label>`).join('')}</div>${button('更新合成预览','preview')}<div data-qm-preview-result>${draft?renderQualityStandardPreview(draft,previewContext):''}</div></section>` }
function renderConfigDetail(): string {
  const current=getQualityConfiguration(currentId)
  if(!current) return `<div class="p-4 text-red-700">未找到该质检配置，未使用其他版本代替。</div>`
  if(editMode && !draft){if(current.status==='DRAFT'){draft=structuredClone(current);fullConditionsDraft=draft.kind==='RULE' && draft.initialFullInspection?structuredClone(draft.initialFullInspection):null}else editMode=false}
  const actions=editMode?`${button('保存草稿','save','',true)}${button('明确生效','publish')}`:current.status==='DRAFT'?link('编辑草稿',`${configPath(current.kind)}/${encodeURIComponent(current.id)}/edit`):`${button('派生新草稿','derive',`data-id="${e(current.id)}"`)}${current.status==='EFFECTIVE'?button('停用此版本','disable'):''}`
  return `<div class="space-y-4 p-4"><header class="flex flex-wrap items-center justify-between gap-3"><div><h1 class="text-xl font-semibold">${e(current.name)}</h1><p class="mt-1 text-xs text-muted-foreground">${e(current.id)} · 版本${current.version} · ${qualityStatusLabels[current.status]}</p></div><div class="flex flex-wrap gap-2">${link('返回列表',configPath(current.kind))}${actions}</div></header>${feedbackHtml()}${editMode && draft?`${renderQualityConfigurationEditor(draft,busy)}${previewFields()}`:`<section class="space-y-3 rounded border bg-card p-4"><p class="text-sm">对象：${e(qualityObjectLabel(current.objectType))}；环节：${e(current.applicability.stages?.map(qualityStageLabel).join('、') || '未配置')}</p><p class="text-sm">适用范围：${renderApplicability(current.applicability)}</p>${current.kind==='RULE'?renderRuleDetails(current):renderItems(current)}${current.kind==='ADDITIONAL'?renderOverrideDetails(current):''}</section>`}<section class="rounded border bg-card p-4"><h2 class="mb-2 font-semibold">配置操作记录</h2>${listQualityConfigurationOperations().filter(row=>row.configurationId===current.id).map(row=>`<p class="text-sm">${e(row.at)} · ${{SAVE_DRAFT:'保存草稿',PUBLISH:'明确生效',DISABLE:'停用'}[row.action]}</p>`).join('') || '<p class="text-sm text-muted-foreground">静态默认版本，无用户操作记录。</p>'}</section><div data-qm-confirmation>${renderConfirmation()}</div></div>`
}
function renderConfirmation(): string { if(!confirmation)return '';return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="确认${confirmation==='publish'?'生效':'停用'}"><section class="max-w-lg space-y-4 rounded bg-background p-5"><h2 class="font-semibold">${confirmation==='publish'?'明确生效此版本':'停用此版本'}</h2><p class="text-sm">${e(draft?.name || getQualityConfiguration(currentId)?.name || '')}。${confirmation==='publish'?'新开检采用本次有效要求，同系列旧有效版停止用于新开检。':'后续新开检不再采用此版本。'}已开检记录继续使用原快照。</p><div class="flex justify-end gap-2">${button('返回','close-confirmation')}${button(confirmation==='publish'?'确认生效':'确认停用',`confirm-${confirmation}`,'',true)}</div></section></div>` }
function renderRecordDetail(kind: InspectionSourceKind, id: string): string {
  const row=getQualityInspectionRecord(kind,id)
  if(!row)return '<div class="p-4 text-red-700">未找到此来源的质检记录，未使用旧质量或费用记录代替。</div>'
  return `<div class="space-y-4 p-4"><header class="flex flex-wrap justify-between gap-3"><h1 class="text-xl font-semibold">${e(row.displayNo)}</h1>${link('打开原业务',row.sourceHref)}</header><section class="space-y-2 rounded border bg-card p-4">${styleCell(row)}<p>${qualitySourceLabels[row.sourceKind]} · ${e(row.status)} · ${e(row.factoryName || row.warehouseName || '')}</p>${row.sourceKind==='PRE_PRODUCTION_SAMPLE'?`<p>批版结论：${row.sampleResult==='HAS_ISSUE'?'有问题':row.sampleResult==='NO_ISSUE'?'无问题':'尚未提交'}；截止${e(row.dueAt?sourceTime(row.dueAt,row.timeZone):'未领取')}（${e(row.timeZone || '工厂当地')}）</p>`:`<p>送检${amount(row.sourceKind==='WAREHOUSE_STOCK'?row.sentQty:row.quantity)}${row.sourceKind==='WAREHOUSE_STOCK'?`；后道实收${amount(row.receivedQty)}`:''}；实检${amount(row.inspectedQty)}；合格${amount(row.passedQty)} / 瑕疵${amount(row.defectQty)} / 返工${amount(row.returnedQty)}；未检放行${amount(row.uninspectedReleaseQty)}；正常放行${amount(row.normalReleaseQty)}</p>`}${row.destinationSummary?`<p>实际去向：${e(row.destinationSummary)}</p>`:''}${row.returnReceivedQty!==undefined?`<p>正常返仓实收${row.returnReceivedQty}；正常已上架${amount(row.putawayQty)}；瑕疵仓实收${amount(row.defectReceivedQty)}；瑕疵已上架${amount(row.defectPutawayQty)}；goto_global实收${amount(row.gotoReceivedQty)}</p>`:''}</section><section class="space-y-3 rounded border bg-card p-4"><h2 class="font-semibold">本次固定标准及依据</h2>${row.snapshot?`<p class="text-xs">取用时间${e(sourceTime(row.snapshot.selectedAt,row.timeZone))} · ${e(row.snapshot.basicStandard.name)} v${row.snapshot.basicStandard.version}</p>${renderItems(row.snapshot)}${row.snapshot.references.length?`<h3 class="font-medium">本次实际参照资料</h3>${row.snapshot.references.map(ref=>renderInspectionReference(ref)).join('')}`:''}${(row.snapshot.skuSnapshots || []).map(sku=>`<details class="rounded border p-3"><summary>SKU ${e(sku.skuId)}固定要求</summary>${renderItems(sku.snapshot)}</details>`).join('')}`:row.inventoryApplicationOnly?'<p class="text-blue-700">此处为原库存送检申请；尚未形成质检单时不生成检查结论。当前流转及关联质检请打开原业务查看。</p>':'<p class="text-amber-700">旧记录没有固定标准快照，未补造当时依据。</p>'}</section>${row.basisClarifications?.length?`<section class="rounded border bg-card p-4"><h2 class="font-semibold">依据澄清与实际采用</h2>${row.basisClarifications.map(note=>`<p class="mt-2 text-sm">${e(note.itemId)} · ${e(note.conflictDescription)}<br>实际采用：${e(note.adoptedBasis)}；${e(note.clarificationNote)} · ${e(note.by)} ${e(note.at)}</p>`).join('')}</section>`:''}${row.independentChecks?.length?`<section class="rounded border bg-card p-4"><h2 class="font-semibold">另行安排的独立追检</h2>${row.independentChecks.map(note=>`<p class="mt-2 text-sm">${e(note.at)} · ${e(note.by.actorName)} · 关联原记录${e(note.originalRecordId)}<br>对象${e(note.objectDescription)}；范围${e(note.scopeDescription)}；项目${note.itemIds.map(e).join('、')}<br>原因${e(note.reason)}；实际结果${e(note.result)}</p>`).join('')}</section>`:''}<section class="space-y-2 rounded border bg-card p-4"><h2 class="font-semibold">实际问题项目</h2>${row.issues.map(issue=>`<p class="text-sm">${e(row.issueNames?.[issue.itemId] || row.snapshot?.items.find(item=>item.id===issue.itemId)?.name || issue.itemId)}：${e(issue.note || '已标记问题')}</p>`).join('') || '<p class="text-sm">无已登记问题项</p>'}</section>${(row.rounds || []).length?`<section class="space-y-2 rounded border bg-card p-4"><h2 class="font-semibold">各轮实际检查</h2>${row.rounds!.map(round=>`<p>第${round.roundNumber}轮：合格${round.passedQty}、瑕疵${round.defectQty}、返工${round.returnedQty}；${e(round.submittedAt)}</p>`).join('')}</section>`:''}</div>`
}
function renderRecords(): string { const rows=listQualityInspectionRecords(query); return tablePage(rows,recordColumns(),renderStandardListStats([{label:'当前记录',value:rows.length},{label:'待稽查',value:rows.reduce((n,row)=>n+(row.audits || []).filter(audit=>audit.status==='PENDING').length,0)}])) }
function renderAuditDetail():string {
  const [sourceKind,recordId,auditId]=currentId.split('|'), record=getQualityInspectionRecord(sourceKind as InspectionSourceKind,recordId)
  const audit=record?.audits?.find(row=>row.id===auditId)
  if(!record || !audit)return '<div class="p-4 text-red-700">未找到此稽查记录。</div>'
  const rounds=record.rounds, prior=rounds?.filter(row=>row.roundNumber<=audit.roundNumber)
  const checked=prior?.reduce((sum,row)=>sum+row.passedQty+row.defectQty+row.returnedQty,0)
  const rule=record.snapshot?.ruleSnapshot
  const target=audit.toPercent!==undefined && record.quantity!==undefined && rule ? calculateInspectionTarget({quantity:record.quantity,percent:audit.toPercent,minQuantity:rule.minQuantity}) : undefined
  const needed=target!==undefined && checked!==undefined ? Math.max(0,target-checked) : undefined
  return `<div class="space-y-4 p-4"><h1 class="text-xl font-semibold">稽查与升级记录</h1><section class="space-y-2 rounded border bg-card p-4"><p>质检单：${link(record.displayNo,`${rootPath}/records/${record.sourceKind}/${encodeURIComponent(record.id)}`)}</p><p>触发第${audit.roundNumber}轮；本轮不合格${audit.unqualifiedQty}件；门槛${audit.threshold}件。</p><p>状态：${audit.status==='PENDING'?'待原业务处理':'已升级'}；${audit.fromPercent}% → ${audit.toPercent===undefined?'待决定':`${audit.toPercent}%`}。</p><p>决定：${e(audit.note || '尚无决定')}</p><p>决定时间：${e(audit.decidedAt || '尚未决定')}</p><p>触发时累计已检：${amount(checked)}件；升检后累计应检：${amount(target)}件；本次需补检：${amount(needed)}件。</p><p class="text-xs text-muted-foreground">按本单固定规则和本批数量计算，已检数量抵扣累计应检量。</p>${link('查看原业务',record.sourceHref)}</section><section class="space-y-2 rounded border bg-card p-4"><h2 class="font-semibold">后续各轮检查记录</h2>${rounds?.filter(row=>row.roundNumber>audit.roundNumber).map(row=>`<p>第${row.roundNumber}轮：比例${row.percent===undefined?'未知':row.percent+'%'}，累计应检${amount(row.target)}件；本轮合格${row.passedQty}件、瑕疵${row.defectQty}件、返工${row.returnedQty}件；${e(row.submittedAt)}</p>`).join('') || '<p>尚无后续检查记录。</p>'}</section></div>`
}
function renderAudits(): string {
  const rows=listQualityInspectionAudits(query)
  const columns: StandardListColumn<(typeof rows)[number]>[]=[{key:'displayNo',title:'质检记录',width:230,required:true,sortable:true,render:row=>link(row.displayNo,`${rootPath}/records/${row.sourceKind}/${encodeURIComponent(row.recordId)}`)},{key:'styleCode',title:'款式',width:220,render:row=>e(`${row.styleCode} ${row.styleName}`)},{key:'roundNumber',title:'触发轮次',width:110,sortable:true,render:row=>String(row.roundNumber)},{key:'threshold',title:'门槛 / 本轮坏件',width:170,render:row=>`${row.threshold} / ${row.unqualifiedQty}`},{key:'status',title:'稽查状态',width:140,sortable:true,render:row=>row.status==='PENDING'?'待原业务处理':'已升级'},{key:'decision',title:'比例变化 / 决定',width:270,render:row=>`${row.fromPercent}% → ${row.toPercent===undefined?'待决定':`${row.toPercent}%`}<p>${e(row.note || '')}</p>`},{key:'actions',title:'查看',width:130,actionColumn:true,required:true,render:row=>link('稽查详情',`${rootPath}/audits/${encodeURIComponent(`${row.sourceKind}|${row.recordId}|${row.id}`)}`)}]
  return tablePage(rows,columns,renderStandardListStats([{label:'稽查记录',value:rows.length},{label:'待处理',value:rows.filter(row=>row.status==='PENDING').length}]))
}
function renderStatistics(): string {
  const stats=calculateQualityInspectionStatistics(query)
  const content=stats.map(stat=>{
    const sample=stat.sourceKind==='PRE_PRODUCTION_SAMPLE',inventory=stat.sourceKind==='WAREHOUSE_STOCK'
    const inspection=sample
      ? [{label:'批版记录（件）',value:stat.recordCount},{label:'无问题',value:stat.sampleNoIssueCount},{label:'有问题',value:stat.sampleHasIssueCount},{label:'超过48小时',value:stat.sampleOverdueCount}]
      : [...(inventory?[]:[{label:'送检（件）',value:stat.quantity}]),{label:'实际检查（件）',value:stat.inspectedQty},{label:'实检合格',value:stat.passedQty},{label:'瑕疵',value:stat.defectQty},{label:'返工',value:stat.returnedQty},{label:'未检放行',value:stat.uninspectedReleaseQty},{label:'正常放行',value:stat.normalReleaseQty},{label:'实检不合格率',value:stat.unqualifiedRate===null?'无实检':`${(stat.unqualifiedRate*100).toFixed(2)}%`}]
    const intake=inventory?`<div data-qm-statistics="inventory-intake">${renderStandardListStats([{label:'送检申请（批）',value:stat.inventoryApplicationCount},{label:'送检出库（件）',value:stat.sentQty},{label:'后道实收（件）',value:stat.receivedQty},{label:'待后道接收（批）',value:stat.pendingInventoryReceiptCount}])}</div>`:''
    const audits=sample?'':`<div data-qm-statistics="inspection-audits">${renderStandardListStats([{label:'稽查触发次数',value:stat.auditCount},{label:'待处理稽查',value:stat.pendingAuditCount},{label:'已升检次数',value:stat.upgradedAuditCount}])}</div>`
    const returns=inventory?`<div data-qm-statistics="inventory-return">${renderStandardListStats([{label:'正常返仓实收（件）',value:stat.returnReceivedQty},{label:'正常已上架（件）',value:stat.putawayQty},{label:'瑕疵仓实收（件）',value:stat.defectReceivedQty},{label:'瑕疵已上架（件）',value:stat.defectPutawayQty},{label:'返工实收（件）',value:stat.gotoReceivedQty}])}</div>`:''
    return `<section class="space-y-3 rounded border bg-card p-4" data-qm-statistics-source="${stat.sourceKind}"><header class="flex justify-between"><h2 class="font-semibold">${qualitySourceLabels[stat.sourceKind]}</h2>${link('查看同范围记录',`${rootPath}/records?${new URLSearchParams({...query,sourceKind:stat.sourceKind} as Record<string,string>).toString()}`)}</header>${intake}<div data-qm-statistics="inspection-results">${renderStandardListStats(inspection)}</div>${audits}${returns}${stat.unknownSentQuantityCount?`<p class="text-sm text-amber-700">${stat.unknownSentQuantityCount}条送检出库量未知，未由实收量补算。</p>`:''}${stat.unknownInspectionCount?`<p class="text-sm text-amber-700">${stat.unknownInspectionCount}条记录尚无实检数量，未由送检量补算。</p>`:''}<h3 class="font-medium">问题项目分布（按有此问题的记录数，不是坏衣件数）</h3>${stat.issueDistribution.map(item=>`<p class="text-sm">${e(item.name)}：${item.recordCount}条记录</p>`).join('') || '<p class="text-sm text-muted-foreground">无已登记问题项</p>'}</section>`
  }).join('')
  return `<div class="space-y-3 p-4"><h1 class="text-xl font-semibold">质检统计分析</h1>${feedbackHtml()}${filters()}${content}</div>`
}
function renderCurrentQualityContent(parts: string[]): string {
  if (section==='records' && parts[3] && parts[4]) return renderRecordDetail(parts[3] as InspectionSourceKind,decodeURIComponent(parts[4]))
  if (configurationKind()) {
    if (currentId) return renderConfigDetail()
    return renderConfigList()
  }
  if (section==='audits') {
    if (currentId) return renderAuditDetail()
    return renderAudits()
  }
  if (section==='statistics') return renderStatistics()
  return renderRecords()
}

export function renderQualityManagementPage(pathname = typeof location==='undefined'?`${rootPath}/basic-standards`:location.pathname+location.search): string {
  enter(pathname)
  try {
    if(preparationFailure)throw new Error(preparationFailure)
    const parts=pathname.split('?')[0].split('/').filter(Boolean)
    const html=renderCurrentQualityContent(parts)
    const warning=!configurationKind() && registeredQualityInspectionSources().length<3?'<p class="px-4 pt-3 text-sm text-amber-700">部分业务来源尚未接入读取，不能据空列表判断没有质检。</p>':''
    return `<div class="max-w-full overflow-hidden" data-quality-management-page data-fast-page-render>${warning}${html}<div data-qm-image-host></div></div>`
  } catch(error) {return `<div data-quality-management-page class="space-y-3 p-4"><h1 class="text-xl font-semibold">${sections[section][0]}</h1><p role="alert" class="text-red-700">${e(error instanceof Error?error.message:'质检资料无法读取')}</p>${button('重新读取','reload')}</div>`}
}
function refreshPage() { const root=document.querySelector('[data-quality-management-page]'); if(root) root.outerHTML=renderQualityManagementPage(path) }
function refreshTableAndColumns() { const html=renderQualityManagementPage(path);const template=document.createElement('template');template.innerHTML=html; const next=template.content.querySelector('[data-standard-list-table-section]'), current=document.querySelector('[data-standard-list-table-section]');if(next && current)current.replaceWith(next);refreshColumnsOverlay() }
function refreshColumnsOverlay() { const host=document.querySelector('[data-qm-overlays]');if(host)host.innerHTML=columnsOpen && preferences?renderStandardListColumnSettings({title:'列表列设置',columns:lastColumns,preferences,eventPrefix:'qm',maxFrozenWidth:500,skipPageRerender:true}):'' }
function refreshEditor() { const root=document.querySelector('[data-qm-editor]'); if(root && draft) root.outerHTML=renderQualityConfigurationEditor(draft,busy) }
function refreshPreview() { const host=document.querySelector('[data-qm-preview-result]'); if(host && draft)host.innerHTML=renderQualityStandardPreview(draft,previewContext) }
function setConfigurationBusy(value: boolean) {
  busy=value
  const fields=document.querySelector<HTMLFieldSetElement>('[data-qm-editor-fields]')
  if(fields)fields.disabled=value
  for(const control of document.querySelectorAll<HTMLButtonElement>('[data-quality-management-page] button[data-qm-busy-control]'))control.disabled=value
}
function markLocal(target: HTMLElement) { target.dataset.pmsEventHandledLocally='true' }
function changeCondition(target: HTMLInputElement): boolean {
  if(!draft)return false
  const scopePath=target.dataset.qmCondition
  if(!scopePath)return false
  const scope=qualityDraftPathValue(draft,scopePath) || {}, attrs=[...(scope.attributes || [])]
  const key=target.dataset.conditionKey!; const next=attrs.filter((row:any)=>row.key!==key);if(target.value.trim())next.push({key,value:target.value.trim()}); updateQualityDraftField(draft,scopePath,{...scope,attributes:next})
  dirty=true;return true
}
export async function handleQualityManagementEvent(event: Event): Promise<boolean> {
  if(!(event.target instanceof HTMLElement))return false
  const target=event.target
  if(!target.closest('[data-quality-management-page]'))return false
  markLocal(target)
  if(event.type==='dragstart'){dragKey=target.closest<HTMLElement>('[data-standard-list-column-drag]')?.dataset.dragSource || '';return !!dragKey}
  if(event.type==='dragover' && target.closest('[data-standard-list-column-drag]')){event.preventDefault();return true}
  if(event.type==='drop' && dragKey && preferences){const destination=target.closest<HTMLElement>('[data-standard-list-column-drag]')?.dataset.dropTarget;if(destination && destination!==dragKey){preferences.order=preferences.order.filter(key=>key!==dragKey);preferences.order.splice(preferences.order.indexOf(destination),0,dragKey);saveListColumnPreferences(storage(),`higood:quality-list:${section}`,preferences);refreshTableAndColumns()}event.preventDefault();dragKey='';return true}
  if(event.type==='input' || event.type==='change') {
    if(busy && target.closest('[data-qm-editor-fields]'))return true
    const input=target as HTMLInputElement
    if(input.dataset.qmPreview){const key=input.dataset.qmPreview;if(key==='size'||key==='color')previewContext.attributes={...previewContext.attributes,[key]:input.value};else (previewContext as any)[key]=input.value;return true}
    if(event.type==='input' && (input.type==='checkbox' || input.tagName==='SELECT'))return true
    if(input.dataset.qmField==='pageSize' && preferences){preferences.pageSize=Number(input.value);page=1;saveListColumnPreferences(storage(),`higood:quality-list:${section}`,preferences);refreshPage();return true}
    if(draft && input.dataset.qmEdit){updateQualityDraftField(draft,input.dataset.qmEdit,input.type==='number'?Number(input.value):input.value);dirty=true;return true}
    if(draft && input.dataset.qmList){const values=input.value.split(/[、,，\n]/).map(value=>value.trim()).filter(Boolean);updateQualityDraftField(draft,input.dataset.qmList,input.dataset.qmList==='percentSteps'?values.map(Number):values);dirty=true;return true}
    if(draft && input.dataset.qmReferences){const original=qualityDraftPathValue(draft,input.dataset.qmReferences) || [];updateQualityDraftField(draft,input.dataset.qmReferences,input.value.split('\n').map(name=>name.trim()).filter(Boolean).map((name,index)=>({id:original[index]?.id || `ref-${crypto.randomUUID()}`,name,kind:original[index]?.kind || 'DOCUMENT'})));dirty=true;return true}
    if(draft && input.dataset.qmBoolean){updateQualityDraftField(draft,input.dataset.qmBoolean,input.checked);dirty=true;return true}
    if(draft && input.dataset.qmArray){const field=input.dataset.qmArray, values=Array.from(document.querySelectorAll<HTMLInputElement>(`[data-qm-array="${field}"]:checked`)).map(node=>node.value);updateQualityDraftField(draft,field,values);if(field==='applicability.sourceKinds'){draft.applicability.stages=values.map(kind=>INSPECTION_STAGES[kind as InspectionSourceKind]);if(draft.kind==='RULE'){if(values.length!==1 || values[0]!=='PRODUCTION_RETURN'){if(draft.initialFullInspection)fullConditionsDraft=structuredClone(draft.initialFullInspection);draft.initialFullInspection=null}else if(!draft.initialFullInspection && fullConditionsDraft)draft.initialFullInspection=structuredClone(fullConditionsDraft)}}dirty=true;refreshEditor();return true}
    if(changeCondition(input))return true
    if(input.dataset.qmFilter)return true
  }
  const actionNode=target.closest<HTMLElement>('[data-qm-action]'), action=actionNode?.dataset.qmAction
  if(!action)return false
  if(event.type!=='click' && !(event.type==='change' && action.startsWith('toggle-column')))return false
  if(event.type==='click' && actionNode instanceof HTMLInputElement && action.startsWith('toggle-column'))return true
  event.preventDefault();if(busy)return true
  try {
    if(action==='query'){query={};for(const node of document.querySelectorAll<HTMLInputElement>('[data-qm-filter]')){const key=node.dataset.qmFilter!;if(key==='configStatus')configStatus=node.value;else if(node.value)(query as any)[key]=node.value}page=1;refreshPage()}
    else if(action==='reset'){query={};configStatus='';page=1;refreshPage()}
    else if(action==='export'){if(section==='statistics')exportStandardListRows({fileName:'质检筛选记录',columns:recordColumns(),rows:listQualityInspectionRecords(query)});else exportStandardListRows({fileName:sections[section][0],columns:lastColumns,rows:lastRows})}
    else if(action==='prev-page'||action==='next-page'){page+=action==='next-page'?1:-1;refreshTableAndColumns()}
    else if(action==='sort-column'){const key=actionNode!.dataset.columnKey!;sort=sort?.key===key?(sort.direction==='asc'?{key,direction:'desc'}:null):{key,direction:'asc'};refreshTableAndColumns()}
    else if(action==='open-column-settings'||action==='close-column-settings'){columnsOpen=action==='open-column-settings';refreshColumnsOverlay()}
    else if(action==='restore-column-settings'){preferences=undefined;try{storage().setItem(`higood:quality-list:${section}`,'')}catch{}refreshTableAndColumns()}
    else if(action.startsWith('toggle-column') && preferences){const key=actionNode!.dataset.qmColumnKey!, column=lastColumns.find(row=>row.key===key);if(action==='toggle-column-visibility' && !column?.required)preferences.visibleKeys=preferences.visibleKeys.includes(key)?preferences.visibleKeys.filter(value=>value!==key):[...preferences.visibleKeys,key];if(action==='toggle-column-freeze' && column?.freezeable)preferences.frozenKeys=preferences.frozenKeys.includes(key)?preferences.frozenKeys.filter(value=>value!==key):[...preferences.frozenKeys,key];preferences=normalizeListColumnPreferences(lastColumns,preferences,[10,20,50]);saveListColumnPreferences(storage(),`higood:quality-list:${section}`,preferences);refreshTableAndColumns()}
    else if(action==='new'||action==='derive'){setConfigurationBusy(true);const kind=configurationKind()!;const created=buildQualityConfigurationDraft(kind,actionNode?.dataset.id);await saveQualityConfigurationDraft(created);dirty=false;setConfigurationBusy(false);appStore.navigate(`${configPath(kind)}/${encodeURIComponent(created.id)}/edit`)}
    else if(action==='save' && draft){setConfigurationBusy(true);draft=await saveQualityConfigurationDraft(draft);dirty=false;showFeedback('草稿已保存，明确生效后用于新开检。')}
    else if(action==='publish'||action==='disable'){confirmation=action;const host=document.querySelector('[data-qm-confirmation]');if(host){host.innerHTML=renderConfirmation();host.querySelector<HTMLButtonElement>('button')?.focus()}}
    else if(action==='close-confirmation'){confirmation='';document.querySelector('[data-qm-confirmation]')?.replaceChildren()}
    else if(action==='confirm-publish'){setConfigurationBusy(true);if(draft && dirty)draft=await saveQualityConfigurationDraft(draft);await publishQualityConfiguration(currentId);dirty=false;confirmation='';setConfigurationBusy(false);appStore.navigate(`${configPath(configurationKind()!)}/${encodeURIComponent(currentId)}`)}
    else if(action==='confirm-disable'){setConfigurationBusy(true);await disableQualityConfiguration(currentId);confirmation='';setConfigurationBusy(false);refreshPage();showFeedback('此版本已停用；已开检单继续使用原快照。')}
    else if(action==='configure-full-conditions' && draft?.kind==='RULE' && draft.applicability.sourceKinds?.length===1 && draft.applicability.sourceKinds[0]==='PRODUCTION_RETURN'){const source=getDefaultQualityConfigurations().find(row=>row.kind==='RULE' && row.initialFullInspection);if(source?.kind==='RULE'){draft.initialFullInspection=structuredClone(source.initialFullInspection);fullConditionsDraft=structuredClone(source.initialFullInspection);dirty=true;refreshEditor()}}
    else if(action==='add-item' && draft && draft.kind!=='RULE'){draft.items.push({id:`item-${crypto.randomUUID()}`,dimension:'',name:'',content:'',criterion:'',references:[]});dirty=true;refreshEditor()}
    else if(action==='remove-item' && draft && draft.kind!=='RULE'){draft.items.splice(Number(actionNode!.dataset.index),1);dirty=true;refreshEditor()}
    else if(action==='add-override' && draft?.kind==='ADDITIONAL'){draft.overrides.push({targetItemId:'',fields:['criterion'],values:{criterion:''}});dirty=true;refreshEditor()}
    else if(action==='remove-override' && draft?.kind==='ADDITIONAL'){draft.overrides.splice(Number(actionNode!.dataset.index),1);dirty=true;refreshEditor()}
    else if(action==='clear-unsupported-conditions' && draft){const scopePath=actionNode!.dataset.path!,scope=qualityDraftPathValue(draft,scopePath) || {};updateQualityDraftField(draft,scopePath,{...scope,attributes:(scope.attributes || []).filter((row:any)=>['size','color'].includes(row.key))});dirty=true;refreshEditor()}
    else if(action==='add-threshold' && draft?.kind==='RULE'){draft.roundThresholds.push({roundNumber:Math.max(0,...draft.roundThresholds.map(row=>row.roundNumber))+1,unqualifiedQuantity:2});dirty=true;refreshEditor()}
    else if(action==='remove-threshold' && draft?.kind==='RULE'){draft.roundThresholds.splice(Number(actionNode!.dataset.index),1);dirty=true;refreshEditor()}
    else if(action==='preview')refreshPreview()
    else if(action==='reload'){setConfigurationBusy(true);await prepareQualityManagementPage(path);refreshPage();if(!preparationFailure)showFeedback(dirty?'已重新读取有效配置，未保存的草稿输入仍保留。':'质检资料已重新读取。')}
    else if(action==='open-image'){const url=actionNode!.dataset.url || '';if(!/^(\/|https?:\/\/|blob:)/.test(url))throw new Error('该图片地址不可用。');const host=document.querySelector('[data-qm-image-host]');if(host)host.innerHTML=`<div class="fixed inset-0 z-[180] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="款式原图"><button class="absolute inset-0 bg-black/70" data-qm-action="close-image" aria-label="关闭原图"></button><section class="relative max-h-full max-w-full rounded bg-background p-3">${button('关闭','close-image')}<img src="${e(url)}" alt="当前款式原图" class="max-h-[80vh] max-w-[90vw] object-contain" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><p hidden class="text-red-700">原图加载失败</p></section></div>`}
    else if(action==='close-image')document.querySelector('[data-qm-image-host]')?.replaceChildren()
  } catch(error){showFeedback(error instanceof Error?error.message:'本次操作未保存，请保留输入重试。')}
  finally{setConfigurationBusy(false)}
  return true
}
if(typeof window!=='undefined') {
  // Field updates are synchronous in the page handler. Run that phase before
  // the shell's asynchronous multi-page dispatch: a delayed checkbox refresh
  // must not replace later select/text edits before their events are handled.
  // Click actions and navigation continue through the original shell entry.
  if(typeof document!=='undefined')for(const type of ['input','change'])document.addEventListener(type,event=>{
    const target=event.target
    if(!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) || !target.closest('[data-quality-management-page]'))return
    event.stopPropagation()
    void handleQualityManagementEvent(event).catch(error=>showFeedback(error instanceof Error?error.message:'输入未保存，请保留内容后重试。'))
  },true)
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue=''}})
  window.addEventListener('keydown',event=>{if(event.key==='Escape'){document.querySelector('[data-qm-image-host]')?.replaceChildren();confirmation='';document.querySelector('[data-qm-confirmation]')?.replaceChildren()}})
}

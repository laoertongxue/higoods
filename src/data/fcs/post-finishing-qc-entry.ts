import {getPostFinishingActiveQcTask,getPostFinishingFullFlowQcTask,getCurrentPostFinishingActor,getPostFinishingFullFlowPostTask} from './post-finishing-full-flow.ts'

/** Only already-read inventory QC facts can exclude unrelated production sources.
 * Unknown/scanner/production entries keep their original complete preparation. */
function preparedQcSourceKind(href: string):'WAREHOUSE_STOCK'|'PRODUCTION_RETURN'|undefined {
  const [path,search='']=href.split('?'),params=new URLSearchParams(search)
  let id:string|null=null
  if(path==='/fcs/craft/post-finishing/qc-workbench') {
    // An explicit source link owns its batch. Only an empty scanner resumes
    // the current task; another active task is shown as a separate blocking link.
    if(!params.get('taskNo') && !['detail','followup'].includes(params.get('view') || '')){
      const active=getPostFinishingActiveQcTask(getCurrentPostFinishingActor().actorId)
      if(active)return active.sourceKind || 'PRODUCTION_RETURN'
    }
    id=params.get('taskNo')
  } else if(path==='/fcs/craft/post-finishing/print' && ['QC_ORDER','QC_DETAIL'].includes(params.get('type') || ''))id=params.get('id')
  else if(path==='/fcs/print/preview' && params.get('documentType')==='POST_FINISHING_QC_ORDER')id=params.get('sourceId') || params.get('id')
  const task=id ? getPostFinishingFullFlowQcTask(id) : undefined
  return task ? task.sourceKind || 'PRODUCTION_RETURN' : undefined
}
export function isPreparedInventoryQcRoute(href:string):boolean{return preparedQcSourceKind(href)==='WAREHOUSE_STOCK'}
export function isPreparedQcRoute(href:string):boolean{return preparedQcSourceKind(href)!==undefined}

/** Business origin is independent of processing responsibility and handover route. */
export function postFinishingQualitySourceLabel(sourceKind?: 'WAREHOUSE_STOCK' | 'PRODUCTION_RETURN'): string {
  return sourceKind === 'WAREHOUSE_STOCK' ? '成衣库存质检' : '工厂回货质检'
}

/** Only an explicit inventory list or an already-read inventory processing task
 * can omit production-return/material preparation. Unknown identities retain it. */
export function isPreparedInventoryPostRoute(href:string):boolean {
  if(isPreparedInventoryQcRoute(href))return true
  const [path,search='']=href.split('?'),params=new URLSearchParams(search)
  if(['/fcs/craft/post-finishing/qc-orders','/fcs/craft/post-finishing/work-orders','/fcs/craft/post-finishing/outbound-orders'].includes(path))return params.get('sourceKind')==='WAREHOUSE_STOCK'
  let id=path.startsWith('/fcs/craft/post-finishing/work-orders/') ? path.slice('/fcs/craft/post-finishing/work-orders/'.length) : path==='/fcs/craft/post-finishing/print' && params.get('type')==='POST_ORDER' ? params.get('id') : undefined
  if(!id)return false
  try{id=decodeURIComponent(id)}catch{return false}
  const task=getPostFinishingFullFlowPostTask(id)
  return task?.sourceKind==='WAREHOUSE_STOCK' && Boolean(task.inventoryApplicationId)
}

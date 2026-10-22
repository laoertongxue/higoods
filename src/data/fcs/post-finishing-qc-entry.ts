import {getPostFinishingActiveQcTask,getPostFinishingFullFlowQcTask,getCurrentPostFinishingActor} from './post-finishing-full-flow.ts'

/** Only already-read inventory QC facts can exclude unrelated production sources.
 * Unknown/scanner/production entries keep their original complete preparation. */
function preparedQcSourceKind(href: string):'WAREHOUSE_STOCK'|'PRODUCTION_RETURN'|undefined {
  const [path,search='']=href.split('?'),params=new URLSearchParams(search)
  let id:string|null=null
  if(path==='/fcs/craft/post-finishing/qc-workbench') {
    // Execution displays the current person's active task before the scanned
    // query. Detail/follow-up display the explicit record instead.
    if(!['detail','followup'].includes(params.get('view') || '')){
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


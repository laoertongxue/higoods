import type { PFNode, PFTask } from './model'

/** Preserve every route instance. A numbered branch is identification aid, not an invented material. */
export function workObjectLabel(task:PFTask,node:PFNode):string {
  if(node.sourceDocumentType==='正式技术包')return `正式技术包 ${task.sourceContext?.technicalVersionLabel||'版本待核实'}`
  if(node.material)return `${node.material.name} · ${node.material.id}`
  if(node.inputSku||node.outputSku)return [node.inputSku,node.outputSku].filter(Boolean).join(' → ')
  if(node.origin!=='route'&&!node.sourceEntryId)return node.sourceSummary?.documentNo||node.sourceDocumentId||'对应单据待关联'
  const siblings=task.nodes.filter(n=>n.name===node.name&&(n.origin==='route'||n.sourceEntryId))
  const branch=siblings.length>1?`分支 ${siblings.findIndex(n=>n.id===node.id)+1} · `:''
  return `${branch}${node.inputObjectType||node.outputObjectType||'加工对象'} · 对象明细待核实`
}
export function workLabel(task:PFTask,node:PFNode):string {return `${node.name} · ${workObjectLabel(task,node)}`}
export function releaseLabel(node:PFNode):string {
  if(!node.predecessors.length)return '放行条件以来源单据为准'
  if(!node.releaseMode&&!node.releaseRuleId)return '整批 / 分批放行条件待确认'
  const quantity=node.releaseRequiredQty===undefined?'':` · ${node.releaseRequiredQty} ${node.unit}`
  return `${node.releaseMode||'来源已确认放行规则'}${quantity}${node.releaseReason?' · '+node.releaseReason:''}`
}

'use strict';
// V29: small, read-only transfer context. Example values follow Web order fields;
// no receipt, quantity, stock, or downstream record is created by this display.
(()=>{
 const previous=render;
 const retired=new Set(['handover-objection','complete-order','complete-handout','binding-finish','wh6-wash-exception']);
 for(let i=catalog.length-1;i>=0;i--)if(retired.has(catalog[i][0]))catalog.splice(i,1);
 for(const id of retired){delete renderers[id];delete pageCap[id];}
 if(retired.has(screen))screen='process-list';
 const join=(...a)=>a.filter(Boolean).join(' · ');
 function info(direction,party,document,object,related){return {direction,party,document,object,related};}
 function current(){
  if(screen==='asa-task'){
   const s=auxSpecialAccessoryFlow,o=s.orders[s.order];if(!o||o.op!==selectedOp)return null;
   const f=s.forms[o.id+':'+s.role+':'+s.view]||{},r=o.sources.find(r=>r.id===f.source)||o.sources.find(r=>r.received===null||r.received<r.qty)||o.sources[0];
   if(['receive','material','issue'].includes(s.view)){
    if(s.view==='material')return info('来自',o.materials[0]?.from,'端头辅材发料',o.materials[0]?.id,o.id);
    if(o.kind==='lace')return info('任务来源','辅料采购','CG-HB-001',o.part,join(o.id,'采购版本 V1'));
    if(s.view==='issue')return info('来自',o.factory+' · 待加工仓',r?.doc,r?.id,join(o.id,r?.part));
    if(!r)return info('来自',o.kind==='tip'?'织带截断':o.op==='缝边绣'?'绣花':'上道加工','尚无实际交出来货','',o.id);
    const sourceOrder=r.parentOrder||(o.kind==='ticket'?'KT-082':o.kind==='garment'?'SEW-082':['piece','flower'].includes(o.kind)?'CJ-082':'');
    return info('来自',r.from,r.doc,join(r.id,r.part),join(sourceOrder,o.id));
   }
   if(s.view==='out'){
    const targetOrder=o.needsTip?o.tipOrder:o.op==='绣花'?'FBX-001':o.kind==='tip'||o.kind==='cut'||o.kind==='base'?'':o.kind==='garment'?'PF-082':['piece','flower'].includes(o.kind)?'CJ-082':'';
    return info('交给',o.needsTip?o.tipOrder+' · 织带／绳子打头':o.target,targetOrder,join(f.package||f.batch,o.kind==='ticket'?'盘扣成品':o.kind==='flower'?'花朵辅件':o.part),o.kind==='lace'?'CG-HB-001':o.id);
   }
   if(s.view==='return')return info(s.returnMode==='recover'?'交回':'交给',s.returnMode==='recover'?o.factory+' · 待加工仓':'原辅料仓',r?.doc,r?.id,o.id);
  }
  if(['染色','印花','洗水'].includes(selectedOp)&&screen.startsWith('dpw-')){
   const s=dyePrintWashFlow,o=s.orders[s.order];if(!o)return null;
   const r=s.sources.find(r=>r.id===s.source),b=o.batches.find(b=>b.id===s.batch)||o.batches.at(-1);
   if(screen==='dpw-receive')return r?info('来自',r.from,r.fromDoc,join(r.code,r.batch),join(o.parent,o.id)):null;
   if(s.view==='out'&&screen==='dpw-task'){
    const rolls=o.batches.flatMap(b=>b.rolls||[]).filter(r=>s.selected.includes(r.code));
    const wash=o.op==='印花'&&rolls.some(r=>r.decision==='WASH');
    return info('交给',wash?'GTG · 洗水':o.target,wash?'按所选卷生成洗水单':o.next||'',join(b?.id,o.sku),o.op==='洗水'?join('原印花单',o.parent):o.id);
   }
  }
  if(selectedOp==='毛织'&&screen.startsWith('kl-')){
   const s=knitLinkFlow,p=s.pairs[s.pair],sku=s.skus[s.sku],r=s.sources[s.source],piece=s.pieces[s.piece];
   if(screen==='kl-receive'&&r)return info('来自',r.from,r.handover||r.batch||s.source,join(s.source,r.material||s.pieces[r.piece]?.name),p[r.type==='yarn'?'knit':'link']);
   if(screen==='kl-issue'||screen==='kl-return')return info(screen==='kl-issue'?'来自':'交回','毛织待加工仓',p.knit,s.form.issue||s.form.stock||'',sku.code);
   if(screen==='kl-task'&&s.view==='out')return info('交给',s.stage==='knit'?(piece?piece.route[0]:'毛织缝盘作业区'):p.target,s.stage==='knit'&&!piece?p.link:'',join(piece?.name,sku.name),p[s.stage]);
  }
  if(selectedOp==='裁剪'&&screen.startsWith('cf-')){
   const s=cuttingFlow;
   if(screen==='cf-node'&&s.node)return info('来自','面料中转仓 · Dewi',s.node,s.nodes[s.node]?.material,s.nodes[s.node]?.po);
   if(screen==='cf-issue')return info('来自','裁床待加工仓',s.form.batch,'ML-082','PB-082-03');
   if(screen==='cf-return')return info('交回','裁床待加工仓',s.form.linked===false?'':s.job.spread,s.form.returnKnown||'ML-082',s.job.po);
   if(screen==='cf-craft')return info('来自',s.craft.originalActor,s.craft.source,s.craft.ticket,s.job.po);
   if(screen==='cf-out')return info('交给','车缝 A 厂 · Dewi','JT-CJ082-V'+s.task.version,s.outMode==='simple'?'本次所选菲票':s.bag,'SEW-082 · PO-082');
  }
  if(selectedOp==='后整'){
   const s=postFlow,x=s.batches[s.current];
   if(screen==='post-material')return info('来自','辅料中央仓',s.material.no,'后道辅料','PO-082');
   if(screen==='post-batch'&&x){
    if(!x.counts)return info('来自',x.row.returnRecord?.factory||'Bintang 车缝厂',x.id,join(x.row.returnRecord?.deliveryNo,'PO-082'),'后道点数接收');
    if(!x.sent)return info('交给','质检工作区','QC-'+x.id.slice(3),x.id,'PO-082');
    if(x.qc){
     const recheck=x.rechecks?.find(r=>r.no===x.selectedRecheck);
     const outbound=x.outbounds?.find(o=>o.no===x.selectedOutbound);
     if(x.view==='out')return outbound?info('交给','成衣中央仓',outbound.no,join(outbound.recheckNo||'质检直达',x.id),'PO-082'):null;
     if(x.view==='check')return info('来自','后道作业区',recheck?.no||'',join('JG-'+x.id.slice(3),x.id),'PO-082');
     if(x.view==='submit')return info('交给','复检工作区','JG-'+x.id.slice(3),x.id,'已完成适用加工项的合格品');
     return info('来自','质检工作区','QC-'+x.id.slice(3),x.id,'按质检选定加工项继续');
    }
   }
  }
  if(['水溶','捆条'].includes(selectedOp)&&screen==='wb-task'){
   const s=waterBindingFlow,water=selectedOp==='水溶',o=water?s.water:s.binding;
   if(s.view==='receive')return info('来自',water?'中央原料仓':'裁床原料仓',water?s.source:'KT-082-IN',water?s.source:s.binding.specs[s.spec].name,o.id);
   if(s.view==='out')return info('交给',water?o.target:'中央辅料仓','',water?o.id:s.binding.specs[s.spec].name,o.id);
  }
  return null;
 }
 function card(c){if(!c?.party)return '';const docs=join(c.document,c.related);return `<section id="handoff-context" class="handoff-context" aria-label="${c.direction}"><div><span>${esc(c.direction)}</span><b>${esc(c.party)}</b></div>${docs?`<p><span>单据</span><b>${esc(docs)}</b></p>`:''}${c.object?`<p><span>实物</span><b>${esc(c.object)}</b></p>`:''}</section>`;}
 render=function(){if(retired.has(screen))screen='process-list';previous();$('#handoff-context')?.remove();const c=current();if(c){const content=$('#content');const anchor=content?.querySelector('.panel:has(.product),.product-card');if(anchor)anchor.insertAdjacentHTML('afterend',card(c));else content?.insertAdjacentHTML('afterbegin',card(c));const repeated=new Set([c.party,c.document,c.object].filter(Boolean));for(const row of content?.querySelectorAll('.panel .kv')||[]){if(repeated.has(row.querySelector('b')?.textContent.trim())){const parent=row.parentElement;row.remove();if(!parent.children.length&&!parent.textContent.trim())parent.remove();}}}};
 window.pdaTransferContext=current;
 render();
})();

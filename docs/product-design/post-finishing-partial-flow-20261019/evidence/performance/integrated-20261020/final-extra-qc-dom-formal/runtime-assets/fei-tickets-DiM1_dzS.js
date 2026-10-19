import{bw as je,R as wt,aB as Et,aX as Oa,cl as ie}from"./craft-display-support-BBhuUla2.js";import{N as ne,y as i,ad as wa,z as Ea,L as Da,aj as Aa,a7 as Ba}from"./app-shared-_ZQpMwKQ.js";import{c as Dt}from"./process-order-list-controller-DElZmJJN.js";import{g as Fa,c as Ma,m as bt,d as qa,h as ja,j as _a,f as za,e as Ua,k as Wa,l as Ha,n as Ga,C as ft,s as Qa,o as gt,p as Va,q as Ve,r as Ka,t as We,u as Ja,v as At,w as Ya}from"./transfer-bag-return-model-Bxo60wk6.js";import"./index--GzcKvNw.js";import{r as Re}from"./real-qr-placeholder-VWc7p642.js";import{d as Za,e as Ke}from"./layout.helpers-BeRjmTSY.js";import{r as he}from"./material-identity-B8lzg0QE.js";import{P as Bt,r as Ft,a as Mt}from"./production-order-identity--B6fUb7B.js";import{g as P,r as W,a as oe}from"./meta-DBc_rP17.js";import{e as Xa,b as er,r as qt,s as jt,h as tr}from"./navigation-context-BYrQIf19.js";import{n as xt,o as ar}from"./runtime-inputs-tnyUE6ht.js";import{c as yt}from"./marker-plan-occupancy-1b6zkyNV.js";import{a as rr}from"./marker-plan-source-model-BQEqA5UP.js";import{j as sr}from"./runtime-projections-Duu5Ytgf.js";import{d as _t}from"./marker-spreading-utils-B3ummIcV.js";import{ax as zt,ag as ir,Z as nr,ay as ht,R as lr,g as or,ao as dr,aF as cr,aG as ur,az as Ut,ar as He,F as Wt}from"./generated-fei-tickets-CZopK-73.js";import{b as pr}from"./domain-snapshot-DhggIk8L.js";import{i as mr}from"./production-orders-D8_YHGJ6.js";import{b as br}from"./execution-prep-projection-helpers-B1KJ8WCX.js";import{c as fr,a as gr,u as xr,d as yr,l as hr,b as vr}from"./manual-fei-tickets-B_TpJorq.js";import{b as Ht}from"./marker-plan-projection-De2bYSoZ.js";import{g as Nr}from"./fei-ticket-numbering-C17fovrA.js";import{b as Je,q as kr}from"./transfer-bag-operations-DGBWyPmW.js";import{h as $r}from"./sewing-dispatch-BFCDEMWQ.js";import{a2 as Sr}from"./runtime-process-tasks-C7hsSQbR.js";import{e as Gt}from"./special-craft-task-orders-BJTcz34J.js";let be=null;const vt=new WeakMap;function Ir(e,t){const r=new Map(e.map(a=>[a.ticketRecordId,a]));return t.forEach(a=>r.set(a.ticketRecordId,a)),Array.from(r.values()).sort((a,s)=>{if(a.cutOrderNo!==s.cutOrderNo)return a.cutOrderNo.localeCompare(s.cutOrderNo,"zh-CN");if(a.sequenceNo!==s.sequenceNo)return a.sequenceNo-s.sequenceNo;const d=a.version??a.reprintCount+1,l=s.version??s.reprintCount+1;return d-l})}function Cr(e,t){const r=new Map(e.map(a=>[a.printJobId,a]));return t.forEach(a=>r.set(a.printJobId,a)),Array.from(r.values()).sort((a,s)=>s.printedAt.localeCompare(a.printedAt,"zh-CN"))}function D(e){return Array.from(new Set(e.filter(t=>!!t)))}function Pe(e){return e.trim().replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-+|-+$/g,"").toLowerCase()||"trace"}function Tr(e,t){const r=e.rolls.map(s=>s.color).filter(Boolean);if(r.length)return D(r);const a=t.filter(s=>e.cutOrderIds.includes(s.cutOrderId)).map(s=>s.color);return D(a)}function Rr(e,t,r){var d,l,o;const a=t.filter(p=>e.cutOrderIds.includes(p.cutOrderId)),s=(e.markerPlanId?r.find(p=>p.markerPlanId===e.markerPlanId):r.find(p=>p.markerPlanNo===e.markerPlanNo))||null;return!a.length&&!s?null:{contextType:e.contextType,cutOrderIds:[...e.cutOrderIds],cutOrderNos:a.map(p=>p.cutOrderNo),markerPlanId:e.markerPlanId||(s==null?void 0:s.markerPlanId)||"",markerPlanNo:e.markerPlanNo||(s==null?void 0:s.markerPlanNo)||"",productionOrderNos:D(a.map(p=>p.productionOrderNo)),styleCode:e.styleCode||((d=a[0])==null?void 0:d.styleCode)||(s==null?void 0:s.styleCode)||"",spuCode:e.spuCode||((l=a[0])==null?void 0:l.spuCode)||(s==null?void 0:s.spuCode)||"",techPackSpuCode:D(a.map(p=>p.techPackSpuCode)).length===1?D(a.map(p=>p.techPackSpuCode))[0]:"",styleName:((o=a[0])==null?void 0:o.styleName)||(s==null?void 0:s.styleName)||"",materialSkuSummary:e.materialSkuSummary||(s==null?void 0:s.materialSkuSummary)||D(a.map(p=>p.materialSkuSummary)).join(" / "),materialPrepRows:a}}function Pr(e){const t=[...e.ticketRecords],r=new Set(t.map(a=>a.ticketRecordId));return e.spreadingStore.sessions.filter(a=>a.status==="DONE").forEach((a,s)=>{var o;if(((o=a.prototypeLifecycleOverrides)==null?void 0:o.feiTicketStatusLabel)==="待打印菲票"||t.filter(p=>a.cutOrderIds.includes(p.cutOrderId)).length)return;const l=e.materialPrepRows.filter(p=>a.cutOrderIds.includes(p.cutOrderId)&&mr.has(p.productionOrderId));l.length&&l.forEach((p,c)=>{var I;const b=`trace-ticket-${Pe(a.spreadingSessionId)}-${c+1}`;if(r.has(b))return;const m=`FT-${p.cutOrderNo}-TRACE-${String(c+1).padStart(3,"0")}`,f="均码",u="前后片",y=((I=p.materialLineItems[0])==null?void 0:I.materialSku)||p.materialSkuSummary,g=(a.markerPlanId?e.markerPlanSources.find(T=>T.markerPlanId===a.markerPlanId):e.markerPlanSources.find(T=>T.markerPlanNo===a.markerPlanNo||T.items.some(L=>L.cutOrderId===p.cutOrderId)))||null,S={ticketRecordId:b,ticketNo:m,cutOrderId:p.cutOrderId,cutOrderNo:p.cutOrderNo,productionOrderNo:p.productionOrderNo,styleCode:p.styleCode,spuCode:p.spuCode,materialSku:y,color:p.color,sequenceNo:c+1,status:"PRINTED",qrValue:m,createdAt:a.updatedAt||"2026-04-03 09:00",printedAt:a.completedAt||a.updatedAt||"2026-04-03 09:00",printedBy:a.completedBy||a.updatedBy||"系统示例",reprintCount:0,sourcePrintJobId:`trace-print-job-${Pe(a.spreadingSessionId)}-${c+1}`,sourceContextType:a.contextType==="marker-plan"?"marker-plan":"cut-order",sourceMarkerPlanId:a.markerPlanId||(g==null?void 0:g.markerPlanId)||"",sourceMarkerPlanNo:a.markerPlanNo||(g==null?void 0:g.markerPlanNo)||"",printableUnitId:a.contextType==="marker-plan"?`marker-plan:${a.markerPlanId||a.markerPlanNo}`:`cut-order:${p.cutOrderId}`,printableUnitNo:a.contextType==="marker-plan"?a.markerPlanNo||(g==null?void 0:g.markerPlanNo)||"":p.cutOrderNo,printableUnitType:a.contextType==="marker-plan"?"MARKER_PLAN":"CUT_ORDER",sourceProductionOrderId:p.productionOrderId,partName:u,size:f,quantity:Math.max(Math.round(p.materialLineItems.reduce((T,L)=>T+L.requiredQty,0)/Math.max(l.length,1)),1),processTags:["TRACEABILITY_SEED"],version:1,schemaName:"FCS_FEI_TRACEABILITY_SEED",schemaVersion:"1.0.0",qrSerializedValue:m,schemaNote:`由 ${a.sessionNo||a.spreadingSessionId} 的 traceability 链路自动补齐正式菲票记录。`};t.push(S),r.add(b)})}),t}function Lr(e){let t=e.store;return[t.sessions.find(a=>a.contextType==="cut-order"&&a.status==="DONE")||t.sessions.find(a=>a.contextType==="cut-order")||null,t.sessions.find(a=>a.contextType==="marker-plan"&&a.status==="DONE")||t.sessions.find(a=>a.contextType==="marker-plan")||null].filter(Boolean).forEach((a,s)=>{var p,c,b,m;const d=t.sessions.find(f=>f.spreadingSessionId===a.spreadingSessionId);if(!d)return;const l=Rr(d,e.materialPrepRows,e.markerPlanSources);if(!l)return;const o=t.sessions.find(f=>f.spreadingSessionId===d.spreadingSessionId);if(o&&o.contextType==="marker-plan"&&o.status!=="DONE"){const f=((c=(p=e.markerStore)==null?void 0:p.markers)==null?void 0:c.find(y=>y.markerId===o.markerId))||null,u=ir({session:o,context:l,linkedCutOrderIds:[...l.cutOrderIds],linkedCutOrderNos:[...l.cutOrderNos],productionOrderNos:[...l.productionOrderNos],markerTotalPieces:(f==null?void 0:f.totalPieces)||o.actualCutPieceQty||0,materialAttr:((b=l.materialPrepRows[0])==null?void 0:b.materialLabel)||((m=l.materialPrepRows[0])==null?void 0:m.materialCategory)||"",warningMessages:o.warningMessages,completedBy:`traceability-projection-${s+1}`});t=nr(u,t)}}),t}function Or(e){let t=e.store;const r=new Set(t.usages.map(l=>l.bagId)),a=zt(e.spreadingStore);return e.spreadingStore.sessions.filter(l=>l.status==="DONE"&&(!l.varianceWarning||l.varianceWarning.suggestedAction==="无需处理"||l.varianceWarning.handled)).slice().sort((l,o)=>{const p=(l.sourceWritebackId?8:0)+(l.contextType==="marker-plan"?4:0),c=(o.sourceWritebackId?8:0)+(o.contextType==="marker-plan"?4:0);return p!==c?c-p:o.updatedAt.localeCompare(l.updatedAt,"zh-CN")}).reduce((l,o)=>l.some(c=>c.spreadingSessionId===o.spreadingSessionId)?l:o.sourceWritebackId?(l.push(o),l):(l.some(c=>c.contextType===o.contextType)||l.push(o),l),[]).slice(0,4).forEach((l,o)=>{var mt;const p=l.spreadingSessionId,c=l.sessionNo||l.spreadingSessionId,b=e.materialPrepRows.filter(h=>l.cutOrderIds.includes(h.cutOrderId)),m=Tr(l,e.materialPrepRows),f=a.find(h=>h.spreadingSessionId===p)||ht(a,{cutOrderIds:l.cutOrderIds,markerPlanId:l.markerPlanId,materialSku:l.materialSkuSummary||((mt=b[0])==null?void 0:mt.materialSkuSummary)||"",color:m[0]||""}),u=e.ticketRecords.filter(h=>l.cutOrderIds.includes(h.cutOrderId)),y=t.bindings.filter(h=>l.cutOrderIds.includes(h.cutOrderId));if(D(y.map(h=>h.usageId)).some(h=>{const B=t.bindings.filter(Q=>Q.usageId===h),Ta=D(B.map(Q=>Q.cutOrderId)),Ra=D(B.map(Q=>{const M=e.ticketRecords.find(me=>me.ticketRecordId===Q.ticketRecordId);return(M==null?void 0:M.sourceMarkerPlanId)||""}))[0]||l.markerPlanId||"",Pa=D(B.map(Q=>{const M=e.ticketRecords.find(me=>me.ticketRecordId===Q.ticketRecordId);return(M==null?void 0:M.materialSku)||""}))[0]||"",La=D(B.map(Q=>{const M=e.ticketRecords.find(me=>me.ticketRecordId===Q.ticketRecordId);return(M==null?void 0:M.color)||""}))[0]||"",qe=ht(a,{cutOrderIds:Ta,markerPlanId:Ra,materialSku:Pa,color:La});return(qe==null?void 0:qe.spreadingSessionId)===p}))return;const I=u.filter(h=>!t.bindings.some(B=>B.ticketRecordId===h.ticketRecordId)),T=(I.length?I:u).sort((h,B)=>h.ticketNo.localeCompare(B.ticketNo,"zh-CN"));if(!T.length)return;const L=t.masters.find(h=>!r.has(h.bagId)&&h.currentStatus==="IDLE")||t.masters.find(h=>!r.has(h.bagId))||t.masters.find(h=>h.currentStatus==="IDLE")||t.masters[0]||null,C=(l.markerPlanNo?t.sewingTasks.find(h=>h.sewingTaskId===`sewing-task-${Pe(l.markerPlanNo||"")}`):null)||t.sewingTasks.find(h=>h.styleCode===l.styleCode&&h.spuCode===l.spuCode)||t.sewingTasks.find(h=>h.styleCode===l.styleCode)||t.sewingTasks[0]||null;if(!L)return;const G=l.completedAt||l.updatedFromPdaAt||l.updatedAt||"2026-04-03 09:00",Z=`traceability-usage-${Pe(p)}`,X=`TBU-TRACE-${String(o+1).padStart(3,"0")}-${p.slice(-4)}`,O=l.completedBy||l.updatedBy||"系统示例",R={cycleId:Z,cycleNo:X,carrierId:L.carrierId,carrierCode:L.carrierCode,carrierType:L.carrierType,cycleStatus:"PACKING",usageId:Z,usageNo:X,bagId:L.bagId,bagCode:L.bagCode,boundObjectType:"入仓暂存记录",boundObjectId:Z,boundObjectNo:X,receiverType:"仓库",receiverId:"cutting-wait-handover",receiverName:"裁床待交出仓",sourceWarehouseId:"cutting-wait-handover",sourceWarehouseName:"裁床待交出仓",sewingTaskId:"",sewingTaskNo:"",sewingFactoryId:"",sewingFactoryName:"",styleCode:l.styleCode||(C==null?void 0:C.styleCode)||"混款",spuCode:l.spuCode||(C==null?void 0:C.spuCode)||"多 SKU",skuSummary:D(T.map(h=>h.materialSku)).join(" / ")||l.materialSkuSummary||(C==null?void 0:C.skuSummary)||"混装菲票",colorSummary:m.join(" / ")||(C==null?void 0:C.colorSummary)||"多色",sizeSummary:D(T.map(h=>h.size||"")).join(" / ")||(C==null?void 0:C.sizeSummary)||"多尺码",usageStatus:"PACKING",packedTicketCount:T.length,packedCutOrderCount:D(T.map(h=>h.cutOrderNo)).length,startedAt:G,finishedPackingAt:G,dispatchAt:"",dispatchBy:"",signoffStatus:"PENDING",usageStage:"INBOUND_TEMP",usageStageLabel:"入仓暂存",note:`由 ${c} 完成后自动补齐中转袋链路。`},se=T.map((h,B)=>({bindingId:`${R.usageId}-${h.ticketRecordId}-${B+1}`,cycleId:R.usageId,cycleNo:R.usageNo,carrierId:R.bagId,carrierCode:R.bagCode,feiTicketId:h.ticketRecordId,feiTicketNo:h.feiTicketNo||h.ticketNo,sourceSpreadingSessionId:p,sourceSpreadingSessionNo:c,sourceMarkerId:l.sourceMarkerId||l.markerId||"",sourceMarkerNo:l.sourceMarkerNo||l.markerNo||"",sourceWritebackId:(f==null?void 0:f.sourceWritebackId)||l.sourceWritebackId||"",usageId:R.usageId,usageNo:R.usageNo,bagId:R.bagId,bagCode:R.bagCode,ticketRecordId:h.ticketRecordId,ticketNo:h.ticketNo,cutOrderId:h.cutOrderId,cutOrderNo:h.cutOrderNo,productionOrderNo:h.productionOrderNo,markerPlanNo:h.markerPlanNo||l.markerPlanNo||"",唛架方案No:h.markerPlanNo||l.markerPlanNo||"",qty:Math.max(h.qty||0,1),garmentQty:Math.max(h.qty||0,1),boundAt:G,boundBy:O,operator:O,status:"BOUND",note:`由 ${c} 形成中转袋绑定。`})),re=_a({usageId:R.usageId,action:"TRACEABILITY_AUTOLINK",actionAt:G,actionBy:O,note:"自动补齐中转袋映射，裁片交出前仍需按车缝任务分拣装袋。"}),Ia=t.usages.filter(h=>h.usageId!==R.usageId),Ca=[...t.bindings.filter(h=>!se.some(B=>B.bindingId===h.bindingId)),...se];t={...t,masters:t.masters.map(h=>h.bagId===L.bagId?{...h,latestUsageId:R.usageId,latestUsageNo:R.usageNo,latestCycleId:R.usageId,latestCycleNo:R.usageNo,currentCycleId:R.usageId,currentOwnerTaskId:"",currentStatus:"IN_USE",note:h.note||"当前口袋用于铺布完成后的入仓暂存追溯链。"}:h),usages:[...Ia,R],bindings:Ca,manifests:t.manifests,auditTrail:[...t.auditTrail.filter(h=>h.auditTrailId!==re.auditTrailId),re]},r.add(L.bagId)}),t}function Qt(e,t,r){const a=!e&&!t;if(a){const re=xt();if((be==null?void 0:be.signature)===re)return be.context}if(e&&!t){const re=vt.get(e);if(re)return re}if(e&&!("registry"in e)&&!r)throw new Error("打印来源缺少明确的裁片与面料身份投影。");const s=r&&e?{snapshot:e,sources:r}:br(e),d=s.snapshot,l=s.sources.cutOrderRows,o=s.sources.materialPrepRows,p=s.sources.markerPlanSources,c=s.sources.markerStore,b=_t({rows:o,markerPlanSources:p,stored:c}),m=Lr({store:b,materialPrepRows:o,markerPlanSources:p,markerStore:c}),f=zt(m),u=Fa({cutOrderRows:l,materialPrepRows:o,markerPlanSources:p,markerStore:c}),y=Ir(u.ticketRecords,d.feiTicketState.ticketRecords),g=Pr({ticketRecords:y,materialPrepRows:o,markerPlanSources:p,spreadingStore:m}),S=Cr(u.printJobs,d.feiTicketState.printJobs),I=Ma({cutOrderRows:l,ticketRecords:g,markerPlanSources:p}),T=t?bt(I,t):bt(I,d.transferBagState.store),L=Or({store:T,ticketRecords:g,materialPrepRows:o,spreadingStore:m}),C=qa(g,L),G=ja({cutOrderRows:l,materialPrepRows:o,markerPlanSources:p,markerStore:c,ticketRecords:C,printJobs:S});let Z,X;const O=()=>Z||(Z=Ua({ticketRecords:C,markerPlanSources:p,store:L,spreadingStore:m})),R=()=>X||(X=za({store:L,baseViewModel:O()})),se={snapshot:s.snapshot,cutOrderRows:l,materialPrepRows:o,markerPlanSources:p,markerStore:c,spreadingStore:m,spreadingTraceAnchors:f,rawTicketRecords:g,ticketRecords:C,printJobs:S,transferBagStore:L,printableViewModel:G,get transferBagViewModel(){return O()},get transferBagReturnViewModel(){return R()}};return a&&(be={signature:xt(),context:se}),e&&!t&&vt.set(e,se),se}function wr(e=pr(),t){const r=(t==null?void 0:t.context)||Qt(e,t==null?void 0:t.transferBagStore),a=(t==null?void 0:t.ticketRecords)||r.ticketRecords,s=Wa(r.transferBagStore),d=a.map(l=>{var S;const o=lr(l.ticketRecordId)||or(l.ticketNo),p=Ha(l.qrSerializedValue||l.qrValue),c=(p==null?void 0:p.secondaryCrafts)||(o==null?void 0:o.secondaryCrafts)||l.processTags||[],b=(p==null?void 0:p.craftSequenceVersion)||(o==null?void 0:o.craftSequenceVersion)||dr,m=(p==null?void 0:p.currentCraftStage)||(o==null?void 0:o.currentCraftStage)||"",f=(t==null?void 0:t.currentCraftType)||m||c[0]||"",u=((S=t==null?void 0:t.completedCraftsByTicketId)==null?void 0:S[l.ticketRecordId])||[],y=p&&f?cr(p,f,u):{allowed:c.length===0,reason:c.length?"当前未指定扫码工艺，已保留正式顺序数据。":"当前菲票未配置二级工艺顺序。",currentCraftType:f,requiredPreviousCrafts:[]},g=s[l.ticketRecordId];return{feiTicketId:(o==null?void 0:o.feiTicketId)||l.ticketRecordId,feiTicketNo:(o==null?void 0:o.feiTicketNo)||l.ticketNo,cutOrderId:l.cutOrderId,cutOrderNo:l.cutOrderNo,productionOrderNo:l.productionOrderNo,materialSku:l.materialSku,secondaryCrafts:c,craftSequenceVersion:b,currentCraftStage:m,completedCrafts:u,validation:y,carrierCode:(g==null?void 0:g.pocketNo)||l.boundPocketNo||"",usageNo:(g==null?void 0:g.usageNo)||l.boundUsageNo||"",qrValue:l.qrSerializedValue||l.qrValue}});return{items:d,itemsByTicketId:Object.fromEntries(d.map(l=>[l.feiTicketId,l])),itemsByTicketNo:Object.fromEntries(d.map(l=>[l.feiTicketNo,l]))}}function Er(e){const t=ar();let r;{const a={sourceIdentityOnly:!0},s=yt(t.progressRecords,[],a).rows,d=sr(t,s),l=yt(t.progressRecords,d,a).rows,o=rr(t.progressRecords,d,{...a,includeClaimDisputes:!1}).rows,p=t.markerSpreadingState.store,c=_t({rows:o,markerPlanSources:d,stored:p}).sessions;for(const b of l){const m=c.filter(u=>u.cutOrderIds.includes(b.cutOrderId)),f=m.some(u=>u.cuttingStatus==="CUTTING_DONE"||u.cuttingFinishedAt)?"已裁剪":m.some(u=>u.cuttingStatus==="CUTTING"||u.cuttingStartedAt)?"裁剪中":m.some(u=>u.status==="DONE")?"已铺布":m.some(u=>u.status==="IN_PROGRESS")?"铺布中":"待铺布";b.currentStage={...b.currentStage,key:f==="待铺布"?"NOT_STARTED":"STARTED",label:f,detailText:"依据铺布单与裁剪记录显示打印来源阶段。"},b.currentStageLabel=f}r=Qt(t,void 0,{cutOrderRows:l,materialPrepRows:o,markerPlanSources:d,markerStore:p})}return{snapshot:t,cutOrderRows:r.cutOrderRows,materialPrepRows:r.materialPrepRows,markerPlanSources:r.markerPlanSources,markerStore:r.markerStore,ticketRecords:r.ticketRecords,printJobs:r.printJobs,transferBagStore:r.transferBagStore,printableViewModel:r.printableViewModel,craftTraceProjection:wr(t,{context:r,transferBagStore:r.transferBagStore,ticketRecords:r.ticketRecords})}}function v(e,t=""){return String(e??"").trim()||t}function q(e,t=0){const r=Number(e);return Number.isFinite(r)&&r>0?r:t}function ee(e,t){const r=v(e,t);return r.length<=48?r:t||r.slice(0,48)}function Dr(e){const t=Number(e.version||0);return Number.isFinite(t)&&t>0?`V${t}`:v(e.printVersionNo||e.feiTicketVersion,"V1")}function Ar(e){return(e.specialCrafts||[]).map(t=>({craftCategory:v(t.craftCategory,"待补工艺大类"),craftType:v(t.craftType||t.craftName,"待补工艺类型"),receiverFactoryCode:v(t.receiverFactoryCode,"待补充"),receiverFactoryName:v(t.receiverFactoryName,"承接工厂待补充")}))}function Br(e){const t=e.pieceSequenceRange||null;return{label:v(e.pieceSequenceLabel||(t==null?void 0:t.rangeLabel),"不可生成"),startNo:q(t==null?void 0:t.startNo,0),endNo:q(t==null?void 0:t.endNo,0),layerCount:q(e.layerCount??(t==null?void 0:t.actualLayerCount)??(t==null?void 0:t.endNo),0)}}function Nt(e){return Array.isArray(e)?e.map(t=>v(t)).filter(Boolean):[]}function Fr(e,t="无"){const r=e.map(a=>v(a)).filter(Boolean);return r.length?r.join(" / "):t}function Mr(e,t){const r=e.materialIdentity||{},a=v(r.materialName||e.materialName||e.materialSku||t.materialSku,"面料待补"),s=v(r.materialAlias||e.materialAlias);return{materialName:a,materialAlias:s,materialDisplayLabel:s&&s!==a?`${a}（${s}）`:a}}function qr(e,t){const r=v(e,"面料待补"),a=v(t);return!a||r.includes(a)?r:`${r} / 颜色：${a}`}function Vt(e,t={}){var C,G,Z,X;const r=Ar(e),a=Br(e),s=q(e.quantity??e.actualCutPieceQty??e.qty,0),d=q(e.garmentQty??e.quantity??e.qty,s),l=q(e.garmentInstanceNo??e.pieceSetNoStart,1),o=q(e.layerCount??((C=e.pieceSequenceRange)==null?void 0:C.actualLayerCount)??a.layerCount,a.endNo),p=Nt(e.applicableSkuCodes),c=v(e.applicableSkuLabel,Fr(p,v(e.garmentSkuId||e.skuCode||e.spuCode||e.sourceTechPackSpuCode,"SKU 待补"))),b=v(e.assemblyGroupKey,[v(e.cutOrderNo||e.sourceCutOrderNo),v(e.fabricRollNo),v(e.fabricColor||e.color||e.skuColor),v(e.skuSize||e.size),v(e.bundleNo)].filter(Boolean).join("::")),m=Nt(e.siblingPartTicketNos),f=q(e.partQuantityPerGarment??e.pieceCountPerGarment??((Z=(G=e.patternIdentity)==null?void 0:G.piecePartNames)==null?void 0:Z.length),0),u=v(e.businessSizeLabel,[v(e.size||e.skuSize,"尺码待补"),l,o||a.endNo].filter(Boolean).join("-")),y=Dr(e),g=ur({feiTicketId:ee(e.feiTicketId||e.ticketRecordId,v(e.feiTicketNo||e.ticketNo)),feiTicketNo:v(e.feiTicketNo||e.ticketNo),cutOrderId:ee(e.cutOrderId||e.sourceCutOrderId,v(e.cutOrderNo||e.sourceCutOrderNo)),cutOrderNo:v(e.cutOrderNo||e.sourceCutOrderNo),productionOrderId:ee(e.productionOrderId||e.sourceProductionOrderId,v(e.productionOrderNo||e.sourceProductionOrderNo)),productionOrderNo:v(e.productionOrderNo||e.sourceProductionOrderNo),markerPlanId:ee(e.markerPlanId||e.sourceMarkerPlanId,v(e.markerPlanNo||e.sourceMarkerPlanNo||e.batchNo)),markerPlanNo:v(e.markerPlanNo||e.sourceMarkerPlanNo||e.batchNo),markerNumber:v(e.markerNumber||e.sourceMarkerNo),bedNo:v(e.bedNo||e.sourceMarkerNo),spreadingOrderId:ee(e.spreadingOrderId||e.sourceSpreadingSessionId,v(e.spreadingOrderNo||e.sourceSpreadingSessionNo||e.spreadingSessionNo)),spreadingOrderNo:v(e.spreadingOrderNo||e.sourceSpreadingSessionNo||e.spreadingSessionNo),spuCode:v(e.sourceTechPackSpuCode||e.spuCode||e.styleCode),styleName:v(e.styleName||e.styleCode||e.sourceTechPackSpuCode),color:v(e.color||e.fabricColor||e.garmentColor||e.skuColor),size:v(e.size||e.skuSize),sourceOutputLineId:ee(e.sourceOutputLineId,`${v(e.feiTicketNo||e.ticketNo)}:产出`),fabricRollId:ee(e.fabricRollId,v(e.fabricRollNo)),fabricRollNo:v(e.fabricRollNo),fabricColor:v(e.fabricColor||e.color||e.skuColor),materialSku:v(e.materialSku),garmentSkuId:ee(e.garmentSkuId||e.skuCode,`${v(e.spuCode||e.sourceTechPackSpuCode)}-${v(e.size||e.skuSize)}`),garmentColor:v(e.garmentColor||e.color||e.skuColor),applicableSkuCodes:p,applicableSkuLabel:c,assemblyGroupKey:b,siblingPartTicketNos:m,pieceScope:Array.isArray(e.pieceScope)?e.pieceScope:[v(e.partName||e.pieceGroup)],pieceGroup:v(e.pieceGroup||e.partName),bundleScope:v(e.bundleScope||e.bundleNo),skuColor:v(e.skuColor||e.color||e.fabricColor),skuSize:v(e.skuSize||e.size),partCode:v(e.partCode||e.partName),partName:v(e.partName||e.pieceGroup),garmentInstanceNo:l,layerCount:o,businessSizeLabel:u,partQuantityPerGarment:f,pieceQty:s,garmentQty:d,pieceSequenceLabel:a.label,pieceSequenceStartNo:a.startNo,pieceSequenceEndNo:a.endNo,bundleNo:v(e.bundleNo),bundleQty:q(e.bundleQty??e.quantity,s),pieceSetNoStart:q(e.pieceSetNoStart,1),pieceSetNoEnd:q(e.pieceSetNoEnd,s||1),pieceSetNoRange:v(e.pieceSetNoRange,a.label),bundleTicketType:v(e.bundleTicketType,"扎束菲票"),actualCutPieceQty:s,qty:s,hasSpecialCraft:r.length>0||!!e.hasSpecialCraft,specialCrafts:r,feiTicketVersion:y,secondaryCrafts:Array.isArray(e.secondaryCrafts)?e.secondaryCrafts:r.map(O=>O.craftType),craftSequenceVersion:v(e.craftSequenceVersion,"actual-output-special-craft:v1"),issuedAt:v(e.issuedAt||e.createdAt||e.printedAt,new Date().toISOString()),currentCraftStage:v(e.currentCraftStage||((X=r[0])==null?void 0:X.craftType))}),S=Mr(e,g),I=S.materialDisplayLabel,T=qr(I,g.fabricColor||g.color);return{...{qrPayload:g,qrDisplayValue:JSON.stringify(g),feiTicketNo:g.feiTicketNo,titleLabel:`SPU:${g.spuCode||"SPU 待补"} - ${g.productionOrderNo||"生产单待补"}`,productionOrderNo:g.productionOrderNo,cutOrderNo:g.cutOrderNo,spuCode:g.spuCode,materialNameLabel:S.materialName,materialAliasLabel:S.materialAlias,materialDisplayLabel:I,materialWithColorLabel:T,color:g.color,size:g.size,businessSizeLabel:g.businessSizeLabel,partName:g.partName,partQuantityLabel:g.partQuantityPerGarment>0?`部位数量：${je(g.partQuantityPerGarment,"个")}`:"部位数量：待补",actualCutPieceQtyLabel:`本票裁片：${je(g.actualCutPieceQty||g.pieceQty,"片")}`,applicableSkuLabel:g.applicableSkuLabel,pieceQtyLabel:`裁片数量：${je(g.pieceQty,"片")}`,pieceSequenceLabel:g.pieceSequenceLabel?`编号区间：${g.pieceSequenceLabel}`:"编号区间：不可生成",markerPlanNo:g.markerPlanNo,markerNumber:g.markerNumber,spreadingOrderNo:g.spreadingOrderNo,markerSpreadingLabel:[g.markerNumber,g.spreadingOrderNo].filter(Boolean).join("-")||g.markerPlanNo,versionLabel:y,hasSpecialCraftLabel:g.hasSpecialCraft?"有特殊工艺":"无特殊工艺",specialCraftDisplayLines:r.length?r.map(O=>`${O.craftType} / ${O.craftCategory}`):["无"],receiverFactoryDisplayLines:r.length?r.map(O=>`${O.craftType}：${O.receiverFactoryName||"承接工厂待补充"}`):["无"],specialCraftHandoverLines:r.length?r.map(O=>`${O.craftType}：${O.receiverFactoryName||"承接工厂待补充"}`):["无"]},templateSize:"10cm x 10cm"}}function we(e){return Er()}const jr=["qr","Payload"].join("");function kt(e){const t=e[jr];return typeof t=="string"?t:""}function _r(e){const t=e.generated,r=[e.spreadingOrderNo?`铺布单 ${e.spreadingOrderNo}`:"",e.markerNumber?`唛架编号 ${e.markerNumber}`:"",t.bedNo?`床次 ${t.bedNo}`:""].filter(Boolean).join(" · "),a=[e.partName||t.partName?`部位 ${e.partName||t.partName}`:"",e.size||t.skuSize?`尺码 ${e.size||t.skuSize}`:"",e.pieceSequenceLabel&&e.pieceSequenceLabel!=="不可生成"?`编号范围 ${e.pieceSequenceLabel}`:""].filter(Boolean).join(" · "),s=e.pieceQty>0?`本张菲票裁片数量 ${x(e.pieceQty)} 片`:"";return[r,a,s].filter(Boolean)}function zr(e,t){const r=t.qrPayload,a=[r.productionOrderNo?`生产单 ${r.productionOrderNo}`:"",r.cutOrderNo?`裁片单 ${r.cutOrderNo}`:"",r.spreadingOrderNo?`铺布单 ${r.spreadingOrderNo}`:""].filter(Boolean).join(" · "),s=[r.color?`颜色 ${r.color}`:"",r.size?`尺码 ${r.size}`:"",r.partName?`部位 ${r.partName}`:"",r.pieceSequenceLabel?`编号区间 ${r.pieceSequenceLabel}`:""].filter(Boolean).join(" · "),d=e.hasSpecialCraft?`特殊工艺 ${k(e.specialCraftLines,3)}；承接工厂 ${k(e.receiverFactoryLines,3)}`:"特殊工艺 无";return[a,s,d].filter(Boolean)}function Ye(e){return e.replaceAll("发料","交出")}const Ur={ALL:"全部",MARKER_PLAN:"唛架方案",CUT_ORDER:"裁片单"},Kt={SPREADING_ORDER:"部位菲票",BINDING_STRIP_ORDER:"捆条菲票"},$t={VALID:{label:"有效",className:"border border-emerald-200 bg-emerald-100 text-emerald-700"},VOIDED:{label:"不可用",className:"border border-slate-200 bg-slate-100 text-slate-600"}},Wr={已完成:{label:"已完成",className:"border border-emerald-200 bg-emerald-50 text-emerald-700"},未打编号:{label:"未打编号",className:"border border-amber-200 bg-amber-50 text-amber-700"},免打编号:{label:"免打编号",className:"border border-slate-200 bg-slate-50 text-slate-600"},缺少编号区间:{label:"缺少编号区间",className:"border border-rose-200 bg-rose-50 text-rose-700"}},Jt={keyword:"",printObjectType:"ALL",printableUnitType:"ALL",styleCode:"",fabricSku:"",productionOrderNo:"",printableUnitStatus:"ALL",printedFrom:"",printedTo:""},n={filters:{...Jt},querySignature:"",operationSignature:"",operationDraft:Ee(),manualCreate:{open:!1,search:"",markerPlanId:"",markerMemberId:"",layerCount:1,sizePiecePerLayer:{},remark:""},detail:{scopeKey:"",paperColor:"WHITE",sourceFilter:"ALL",keyword:"",page:1,pageSize:20,selectedTicketIds:[],dialogMode:null,dialogTicketId:"",dialogQty:1,dialogRemark:"",printRequest:null},feedback:null};function St(){return{currentPage:1,sort:null,preferences:{order:[],visibleKeys:[],frozenKeys:[],pageSize:10},preferencesLoaded:!1,showColumnSettings:!1}}const Se={PART:St(),BINDING:St()};let U=null,It=!1;function Ee(){return{operator:"打票员-周莉",printerName:"Zebra ZT411",templateName:"裁片菲票标准模板",reason:"",remark:""}}function A(){return ne.getState().pathname.split("?")[0]||P("fei-tickets")}function Ze(){const e=ne.getState().pathname,[,t]=e.split("?");return t||""}function _(){return new URLSearchParams(Ze())}function Hr(e){return e===P("fei-tickets")||e===P("binding-fei-tickets")}function J(e=A()){return e===P("binding-fei-tickets")||n.filters.printObjectType==="BINDING_STRIP_ORDER"?"BINDING":"PART"}function Xe(e,t){if(!t)return e;const r=new URLSearchParams;Object.entries(t).forEach(([s,d])=>{d&&r.set(s,d)});const a=r.toString();return a?`${e}?${a}`:e}function Yt(e=new Date){const t=e.getFullYear(),r=`${e.getMonth()+1}`.padStart(2,"0"),a=`${e.getDate()}`.padStart(2,"0"),s=`${e.getHours()}`.padStart(2,"0"),d=`${e.getMinutes()}`.padStart(2,"0");return`${t}-${r}-${a} ${s}:${d}`}function N(e){return Array.from(new Set(e.filter(t=>!!t)))}function x(e){return new Intl.NumberFormat("zh-CN").format(Math.max(e,0))}function et(e){return e||"未打印"}function Zt(e){const t=new Map(we().ticketRecords.map(a=>[a.ticketRecordId,JSON.stringify(a)])),r=new Set(JSON.parse(wt(ft)||"[]").map(a=>a.ticketRecordId));Et(ft,Qa(e.filter(a=>r.has(a.ticketRecordId)||t.get(a.ticketRecordId)!==JSON.stringify(a))))}function Xt(e){const t=new Map(we().printJobs.map(a=>[a.printJobId,JSON.stringify(a)])),r=new Set(JSON.parse(wt(gt)||"[]").map(a=>a.printJobId));Et(gt,Va(e.filter(a=>r.has(a.printJobId)||t.get(a.printJobId)!==JSON.stringify(a))))}function Gr(e){const t=new Set(e.sourceIds),r=Ut().filter(d=>d.sourceBasisType===He&&(t.has(d.feiTicketId)||t.has(d.feiTicketNo)));if(!r.length)return 0;const a=we(),s=Ga({tickets:r,ticketRecords:a.ticketRecords,printJobs:a.printJobs,operator:e.operator,operatedAt:Yt(),templateName:e.templateName});return s.printedCount&&(Zt(s.nextRecords),Xt(s.nextJobs)),s.printedCount}function Qr(e){return e?e==="WAITING_PRINT"||e==="PRINTED"||e==="NEED_REPRINT"?e:e==="NOT_GENERATED"?"WAITING_PRINT":e==="REPRINTED"||e==="PENDING_SUPPLEMENT"||e==="PARTIAL_PRINTED"?"NEED_REPRINT":"ALL":"ALL"}function Vr(e){const t=e.get("printableUnitType");return t==="MARKER_PLAN"||t==="CUT_ORDER"?t:e.get("markerPlanId")||e.get("markerPlanNo")?"MARKER_PLAN":e.get("cutOrderId")||e.get("cutOrderNo")?"CUT_ORDER":"ALL"}function Kr(e){return e==="SPREADING_ORDER"||e==="BINDING_STRIP_ORDER"?e:e==="MARKER_PLAN"||e==="CUT_ORDER"?"SPREADING_ORDER":"ALL"}function te(){return qt(_())}function Jr(e,t=te()){if(!t)return e;const r=!!(t.spreadingSessionId||t.spreadingSessionNo);return e.filter(a=>t.spreadingSessionId&&!a.sourceSpreadingSessionIds.includes(t.spreadingSessionId)||t.spreadingSessionNo&&!a.sourceSpreadingSessionNos.includes(t.spreadingSessionNo)?!1:r?!0:!(t.markerPlanId&&a.batchId&&a.batchId!==t.markerPlanId||t.cutOrderId&&!a.sourceCutOrderIds.includes(t.cutOrderId)))}function ea(e,t=te()){if(t!=null&&t.spreadingSessionId){const r=e.sourceSpreadingSessionIds.indexOf(t.spreadingSessionId);if(r>=0)return{id:e.sourceSpreadingSessionIds[r]||"",no:e.sourceSpreadingSessionNos[r]||""}}if(t!=null&&t.spreadingSessionNo){const r=e.sourceSpreadingSessionNos.indexOf(t.spreadingSessionNo);if(r>=0)return{id:e.sourceSpreadingSessionIds[r]||"",no:e.sourceSpreadingSessionNos[r]||""}}return{id:e.sourceSpreadingSessionIds[0]||"",no:e.sourceSpreadingSessionNos[0]||""}}function Yr(e,t=te()){const r=ea(e,t),a=N([r.no,...e.sourceSpreadingSessionNos]),s=N([r.id,...e.sourceSpreadingSessionIds]);return a.join(" / ")||s.join(" / ")||"当前按裁片单参考补足"}function le(){return tr(te())?'<button type="button" data-cutting-fei-action="return-summary" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">返回裁剪结果核查</button>':""}function Zr(e){const t=qt(e),r=!!(t!=null&&t.spreadingSessionId||t!=null&&t.spreadingSessionNo);return{keyword:e.get("keyword")||(r?"":(t==null?void 0:t.printableUnitNo)||(t==null?void 0:t.ticketNo)||(t==null?void 0:t.cutOrderNo)||(t==null?void 0:t.markerPlanNo)||""),printObjectType:Kr(e.get("printObjectType")||e.get("printableUnitType")),printableUnitType:r&&!e.get("printableUnitType")?"ALL":Vr(e),styleCode:e.get("styleCode")||(r?"":(t==null?void 0:t.styleCode)||""),fabricSku:e.get("fabricSku")||e.get("materialSku")||(r?"":(t==null?void 0:t.materialSku)||""),productionOrderNo:e.get("productionOrderNo")||(r?"":(t==null?void 0:t.productionOrderNo)||""),printableUnitStatus:Qr(e.get("printableUnitStatus")||e.get("ticketStatus")),printedFrom:e.get("printedFrom")||"",printedTo:e.get("printedTo")||""}}function ta(){const e=A(),t=`${e}?${Ze()}`;if(!Hr(e)||n.querySignature===t)return;const r=_();n.filters=Zr(r),n.querySignature=t}function Xr(){const e=A(),t=new Set(["fei-ticket-print","fei-ticket-reprint"]).has(oe(e,"fei-tickets").key),r=`${e}?${Ze()}`;if(!t){n.operationSignature="";return}if(n.operationSignature===r)return;const a=Ee();e===P("fei-ticket-reprint")&&(a.reason=""),n.operationDraft=a,n.operationSignature=r}function Y(){ta(),Xr();const e=we(),t=te(),r=Jr(e.printableViewModel.units,t),a={units:r,unitsById:Object.fromEntries(r.map(s=>[s.printableUnitId,s])),statusCounts:{WAITING_PRINT:r.filter(s=>s.printableUnitStatus==="WAITING_PRINT").length,PRINTED:r.filter(s=>s.printableUnitStatus==="PRINTED").length,NEED_REPRINT:r.filter(s=>s.printableUnitStatus==="NEED_REPRINT").length}};return{cutOrderRows:e.cutOrderRows,materialPrepRows:e.materialPrepRows,markerPlanSources:e.markerPlanSources,markerStore:e.markerStore,ticketRecords:e.ticketRecords,printJobs:e.printJobs,transferBagStore:e.transferBagStore,printableViewModel:a,craftTraceProjection:e.craftTraceProjection,filteredUnits:Ja(r,n.filters)}}function aa(e){const t=ea(e);return{spreadingSessionId:t.id||void 0,spreadingSessionNo:t.no||void 0,printableUnitId:e.printableUnitId,printableUnitNo:e.printableUnitNo,printableUnitType:e.printableUnitType,batchId:e.batchId||void 0,batchNo:e.batchNo||void 0,cutOrderId:e.cutOrderId||void 0,cutOrderNo:e.cutOrderNo||void 0,productionOrderId:e.sourceProductionOrderIds[0]||void 0,sourceProductionOrderNo:e.sourceProductionOrderNos[0]||void 0,productionOrderNo:e.sourceProductionOrderNos[0]||void 0,styleCode:e.styleCode||void 0,materialSku:e.fabricSku||void 0,fabricSku:e.fabricSku||void 0}}function Ct(e,t,r){return Xe(P(e),{...jt(te()),...aa(t),...r})}function ve(e,t,r){return Xe(P(e),{...jt(te()),...aa(t),...r})}function tt(e){const t=_(),r=t.get("printableUnitId"),a=t.get("printableUnitNo");return r&&e.printableViewModel.unitsById[r]?e.printableViewModel.unitsById[r]:a&&e.printableViewModel.units.find(s=>s.printableUnitNo===a)||null}function es(e){if(e===P("fei-ticket-printed"))return"printed";const t=_().get("tab");return t==="printed"?t:"split"}function ts(e){if(!e)return null;const t=_(),r=t.get("ticketRecordId")||t.get("ticketId");return r&&e.ticketCards.find(a=>a.ticketId===r)||null}function w(e,t){return`<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${t}">${i(e)}</span>`}function ra(e){const t=e==="MARKER_PLAN"?"border border-violet-200 bg-violet-100 text-violet-700":"border border-slate-200 bg-slate-100 text-slate-700";return w(Ur[e],t)}function sa(e){const t=At(e);return w(t.label,t.className)}function as(e){return w($t[e].label,$t[e].className)}function ia(e){return Nr({feiTicketId:e.ticketId,feiTicketNo:e.ticketNo,partName:e.partName,pieceSequenceRange:e.pieceSequenceRange})}function na(e){const t=Wr[e];return w(t.label,t.className)}function la(){return Za(`
    <div class="space-y-4">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-sm font-semibold text-slate-900">筛选条件</h2>
        <button type="button" data-cutting-fei-action="reset-filters" data-skip-page-rerender="true" class="inline-flex min-h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50">清空筛选</button>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">打印对象号</span>
          <input
            type="text"
            value="${i(n.filters.keyword)}"
            data-cutting-fei-field="keyword"
            data-skip-page-rerender="true"
            placeholder="输入铺布单号 / 捆条加工单号 / 菲票号"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">款号 / SPU</span>
          <input
            type="text"
            value="${i(n.filters.styleCode)}"
            data-cutting-fei-field="styleCode"
            data-skip-page-rerender="true"
            placeholder="输入款号 / SPU"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">面料</span>
          <input
            type="text"
            value="${i(n.filters.fabricSku)}"
            data-cutting-fei-field="fabricSku"
            data-skip-page-rerender="true"
            placeholder="输入面料 SKU / 技术包别名"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">来源生产单号</span>
          <input
            type="text"
            value="${i(n.filters.productionOrderNo)}"
            data-cutting-fei-field="productionOrderNo"
            data-skip-page-rerender="true"
            placeholder="输入来源生产单号"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">打印状态</span>
          <select
            data-cutting-fei-field="printableUnitStatus"
            data-skip-page-rerender="true"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="ALL" ${n.filters.printableUnitStatus==="ALL"?"selected":""}>全部</option>
            ${["WAITING_PRINT","PRINTED","NEED_REPRINT"].map(e=>{const t=At(e);return`<option value="${e}" ${n.filters.printableUnitStatus===e?"selected":""}>${t.label}</option>`}).join("")}
          </select>
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">最近打印开始日期</span>
          <input
            type="date"
            value="${i(n.filters.printedFrom)}"
            data-cutting-fei-field="printedFrom"
            data-skip-page-rerender="true"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">最近打印结束日期</span>
          <input
            type="date"
            value="${i(n.filters.printedTo)}"
            data-cutting-fei-field="printedTo"
            data-skip-page-rerender="true"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
      </div>
    </div>
  `)}function oa(e,t){const r=e.reduce((c,b)=>c+b.ticketCount,0),a=e.reduce((c,b)=>c+b.printedCount,0),s=e.reduce((c,b)=>c+("pendingCount"in b?b.pendingCount:b.missingCount),0),d=e.filter(c=>c.printedCount>0).length,l=e.filter(c=>"hasSpecialCraft"in c&&c.hasSpecialCraft).length,p=(t==="BINDING"?e:[]).reduce((c,b)=>{const m=ce(b);return c.whiteCount+=m.whiteDetails.length,c.yellowCount+=m.yellowDetails.length,m.isMixed&&(c.mixedOrderCount+=1),c},{whiteCount:0,yellowCount:0,mixedOrderCount:0});return Aa([{label:t==="BINDING"?"当前捆条加工单":"当前打印对象",value:`${x(e.length)} 条`},{label:"当前菲票",value:`${x(r)} 张`},{label:"待打印菲票",value:`${x(s)} 张`},{label:"已打印菲票",value:`${x(a)} 张`},...t==="BINDING"?[{label:"白票 / 盘扣黄票",value:`${x(p.whiteCount)} / ${x(p.yellowCount)} 张`},{label:"同单双纸色",value:`${x(p.mixedOrderCount)} 条`}]:[{label:"已产生打印对象",value:`${x(d)} 条`},{label:"含特殊工艺对象",value:`${x(l)} 条`}]])}const rs=["菲票丢失","菲票破损","打印不清晰","数量拆分需要补打","现场复核需要","其他原因"];function Ne(e){let t=String(e||"").trim();for(let r=0;r<3;r+=1)try{const a=decodeURIComponent(t);if(a===t)break;t=a}catch{break}return t}function Ie(e,t=""){return`/fcs/craft/cutting/fei-tickets/${encodeURIComponent(e)}${t}`}function De(e,t=""){return`/fcs/craft/cutting/fei-tickets/${encodeURIComponent(`spreading:${e.spreadingKey}`)}${t}`}function da(e){return e.bindingOrderId.startsWith("binding:")?e.bindingOrderId:`binding:${e.bindingOrderId}`}function ca(e,t=""){return`/fcs/craft/cutting/fei-tickets/${encodeURIComponent(da(e))}${t}`}function ss(e){const t=Number((e==null?void 0:e.version)||0);return Number.isFinite(t)&&t>0?`V${t}`:"V1"}function is(e){const t=e.specialCrafts||[];return t.length?{specialCraftLines:t.map(r=>`${r.craftType} / ${r.craftCategory}`),receiverFactoryLines:t.map(r=>`${r.craftType}：${r.receiverFactoryName||"承接工厂待补充"}`)}:{specialCraftLines:["无"],receiverFactoryLines:["无"]}}function at(e){const t=[...Ut(),...hr()],r=new Map;e.ticketRecords.forEach(s=>{const d=s.sourceOutputLineId||s.ticketNo;if(!d)return;const l=r.get(d)||[];l.push(s),r.set(d,l)});const a=[];return t.forEach(s=>{const o=[...r.get(s.sourceOutputLineId)||[],...e.ticketRecords.filter(f=>f.ticketNo===s.feiTicketNo)].filter((f,u,y)=>y.findIndex(g=>g.ticketRecordId===f.ticketRecordId)===u).sort((f,u)=>{const y=f.version??f.reprintCount+1,g=u.version??u.reprintCount+1;return y!==g?g-y:(u.printedAt||"").localeCompare(f.printedAt||"","zh-CN")}).find(f=>f.status!=="VOIDED")||null,p=s.sourceBasisType===Wt&&(s.printStatus==="PRINTED"||s.printStatus==="REPRINTED"),b=is(o||s),m={tab:o||p?"PRINTED":"WAIT_FIRST",ticketId:(o==null?void 0:o.ticketRecordId)||s.feiTicketId,ticketNo:(o==null?void 0:o.ticketNo)||s.feiTicketNo,versionLabel:ss(o),printStatusLabel:o?o.reprintCount>0||(o.version||1)>1?"已补打":"已打印":p?s.printStatus==="REPRINTED"?"已补打":"已打印":"待打印",productionOrderNo:s.productionOrderNo,cutOrderNo:s.cutOrderNo,markerPlanNo:s.sourceMarkerPlanNo,markerNumber:s.sourceMarkerNo||s.markerNumber,spreadingOrderNo:s.sourceSpreadingSessionNo||s.spreadingOrderNo,spuCode:s.sourceTechPackSpuCode,color:s.skuColor||s.fabricColor,size:s.skuSize,partName:s.partName,pieceQty:s.actualCutPieceQty,pieceSequenceLabel:s.pieceSequenceLabel||"不可生成",hasSpecialCraft:s.hasSpecialCraft,specialCraftLines:b.specialCraftLines,receiverFactoryLines:b.receiverFactoryLines,firstPrintedAt:(o==null?void 0:o.printedAt)||s.manualFirstPrintedAt||"",latestReprintAt:o&&(o.reprintCount>0||(o.version||1)>1)?o.printedAt:s.manualLatestReprintedAt||"",printCount:o?Math.max((o.reprintCount||0)+1,1):Number(s.manualPrintCount||0),printedBy:(o==null?void 0:o.printedBy)||s.manualLastPrintedBy||"",reason:"",record:o,generated:s};a.push(m)}),a}function de(e){return e.generated.manualBatchId||e.generated.sourceSpreadingSessionId||e.generated.spreadingOrderId||e.spreadingOrderNo||e.ticketId}function ns(e){const t=new Map;return e.forEach(r=>{const a=`${r.tab}:${de(r)}`,s=t.get(a)||[];s.push(r),t.set(a,s)}),Array.from(t.values()).map(r=>{const a=[...r].sort((c,b)=>{const m=c.size.localeCompare(b.size,"zh-CN");return m!==0?m:c.partName.localeCompare(b.partName,"zh-CN")}),s=a[0],d=s.tab,l=a.reduce((c,b)=>c+b.printCount,0),o=a.map(c=>c.latestReprintAt).filter(Boolean).sort((c,b)=>b.localeCompare(c,"zh-CN"))[0]||"",p=a.map(c=>c.firstPrintedAt).filter(Boolean).sort((c,b)=>c.localeCompare(b,"zh-CN"))[0]||"";return{tab:d,spreadingKey:de(s),spreadingOrderNo:s.spreadingOrderNo||s.generated.sourceSpreadingSessionNo||"待补铺布单",markerPlanNo:s.markerPlanNo||"待补唛架方案",markerNumber:s.markerNumber||s.generated.markerNumber||"待补唛架编号",productionOrderNos:N(a.map(c=>c.productionOrderNo)),cutOrderNos:N(a.map(c=>c.cutOrderNo)),spuCodes:N(a.map(c=>c.spuCode)),colors:N(a.map(c=>c.color)),sizes:N(a.map(c=>c.size)),partNames:N(a.map(c=>c.partName)),ticketCount:a.length,totalPieceQty:a.reduce((c,b)=>c+b.pieceQty,0),pendingCount:a.filter(c=>c.tab==="WAIT_FIRST").length,printedCount:a.filter(c=>c.tab==="PRINTED"||c.tab==="NEED_REPRINT").length,pieceSequenceLabels:N(a.map(c=>c.pieceSequenceLabel)),hasSpecialCraft:a.some(c=>c.hasSpecialCraft),specialCraftLines:N(a.flatMap(c=>c.specialCraftLines)),receiverFactoryLines:N(a.flatMap(c=>c.receiverFactoryLines)),firstPrintedAt:p,latestReprintAt:o,printCount:l,printedBy:N(a.map(c=>c.printedBy)).join("、"),printStatusLabel:d==="WAIT_FIRST"?`待打印 ${a.length} 条`:d==="PRINTED"?`已打印 ${a.length} 条`:`需补打 ${a.length} 条`,detailRows:a,primaryRow:s,isManualBatch:!!s.generated.manualBatchId}}).sort((r,a)=>r.spreadingOrderNo.localeCompare(a.spreadingOrderNo,"zh-CN"))}function rt(e,t){const r=Ne(t);return at(e).find(s=>s.ticketId===r||s.ticketNo===r||s.generated.feiTicketId===r||s.generated.feiTicketNo===r||s.generated.sourceOutputLineId===r||s.ticketId.replace(/:(reprint-review|void-demo)$/,"")===r)||null}function ua(e,t){const r=Ne(t),a=at(e),s=ns(a);if(r.startsWith("spreading:")){const l=r.split(":"),o=l[1],p=o==="WAIT_FIRST"||o==="PRINTED"||o==="NEED_REPRINT",c=p?l.slice(2).join(":"):l.slice(1).join(":"),b=s.find(m=>m.spreadingKey===c&&(!p||m.tab===o))||s.find(m=>m.spreadingKey===c);return b?Tt(b,a):null}const d=s.find(l=>l.spreadingKey===r||l.spreadingOrderNo===r||l.primaryRow.ticketId===r||l.primaryRow.ticketNo===r)||null;return d?Tt(d,a):null}function ls(e){return[...e].sort((t,r)=>{const a=t.size.localeCompare(r.size,"zh-CN");if(a!==0)return a;const s=t.partName.localeCompare(r.partName,"zh-CN");return s!==0?s:t.ticketNo.localeCompare(r.ticketNo,"zh-CN")})}function pa(e){const t={PRINTED:4,WAIT_FIRST:3,NEED_REPRINT:2},r=new Map;return e.forEach(a=>{const s=a.generated.sourceOutputLineId||a.generated.feiTicketId||a.ticketNo,d=r.get(s);(!d||t[a.tab]>t[d.tab])&&r.set(s,a)}),ls(Array.from(r.values()))}function Tt(e,t){const r=pa(t.filter(a=>de(a)===e.spreadingKey));return r.length?{...e,productionOrderNos:N(r.map(a=>a.productionOrderNo)),cutOrderNos:N(r.map(a=>a.cutOrderNo)),spuCodes:N(r.map(a=>a.spuCode)),colors:N(r.map(a=>a.color)),sizes:N(r.map(a=>a.size)),partNames:N(r.map(a=>a.partName)),ticketCount:r.length,totalPieceQty:r.reduce((a,s)=>a+s.pieceQty,0),pendingCount:r.filter(a=>a.tab==="WAIT_FIRST").length,printedCount:r.filter(a=>a.tab==="PRINTED"||a.tab==="NEED_REPRINT").length,pieceSequenceLabels:N(r.map(a=>a.pieceSequenceLabel)),hasSpecialCraft:r.some(a=>a.hasSpecialCraft),specialCraftLines:N(r.flatMap(a=>a.specialCraftLines)),receiverFactoryLines:N(r.flatMap(a=>a.receiverFactoryLines)),detailRows:r}:e}function ma(e){return N(e).map(t=>t.toLowerCase())}function os(e){return e.some(t=>t.tab==="NEED_REPRINT")?"NEED_REPRINT":e.some(t=>t.tab==="WAIT_FIRST")?"WAIT_FIRST":"PRINTED"}function ds(e){return e==="WAIT_FIRST"?"WAITING_PRINT":e}function cs(e){const t=new Map;return e.forEach(r=>{const a=de(r),s=t.get(a)||[];s.push(r),t.set(a,s)}),Array.from(t.values()).map(r=>{const a=pa(r),s=a[0],d=os(a),l=a.filter(f=>f.tab==="WAIT_FIRST").length,o=a.filter(f=>f.tab==="NEED_REPRINT").length,p=a.filter(f=>f.tab==="PRINTED"||f.tab==="NEED_REPRINT").length,c=a.map(f=>f.latestReprintAt).filter(Boolean).sort((f,u)=>u.localeCompare(f,"zh-CN"))[0]||"",b=a.map(f=>f.firstPrintedAt).filter(Boolean).sort((f,u)=>f.localeCompare(u,"zh-CN"))[0]||"",m=d==="PRINTED"?a.length:d==="NEED_REPRINT"&&o||l;return{tab:d,spreadingKey:de(s),spreadingOrderNo:s.spreadingOrderNo||s.generated.sourceSpreadingSessionNo||"待补铺布单",markerPlanNo:s.markerPlanNo||"待补唛架方案",markerNumber:s.markerNumber||s.generated.markerNumber||"待补唛架编号",productionOrderNos:N(a.map(f=>f.productionOrderNo)),cutOrderNos:N(a.map(f=>f.cutOrderNo)),spuCodes:N(a.map(f=>f.spuCode)),colors:N(a.map(f=>f.color)),sizes:N(a.map(f=>f.size)),partNames:N(a.map(f=>f.partName)),ticketCount:a.length,totalPieceQty:a.reduce((f,u)=>f+u.pieceQty,0),pendingCount:l,printedCount:p,pieceSequenceLabels:N(a.map(f=>f.pieceSequenceLabel)),hasSpecialCraft:a.some(f=>f.hasSpecialCraft),specialCraftLines:N(a.flatMap(f=>f.specialCraftLines)),receiverFactoryLines:N(a.flatMap(f=>f.receiverFactoryLines)),firstPrintedAt:b,latestReprintAt:c,printCount:a.reduce((f,u)=>f+u.printCount,0),printedBy:N(a.map(f=>f.printedBy)).join("、"),printStatusLabel:d==="WAIT_FIRST"?`待打印 ${x(m)} 条`:d==="PRINTED"?`已打印 ${x(m)} 条`:`需补打 ${x(m)} 条`,detailRows:a,primaryRow:s,isManualBatch:!!s.generated.manualBatchId}}).sort((r,a)=>r.spreadingOrderNo.localeCompare(a.spreadingOrderNo,"zh-CN"))}function ae(e){return e.status==="已取消"?[]:e.bindingDetails.filter(t=>t.printStatus!=="未生成")}function ba(e){const t=e.filter(r=>r.printStatus==="已打印").length;return t===e.length&&e.length>0?"PRINTED":t>0?"NEED_REPRINT":"WAITING_PRINT"}function E(e){return e.requiresButtonLoop?"YELLOW":"WHITE"}function ke(e,t){const r=N(e.map(E));if(r.length>1)throw new Error("捆条普通白票与盘扣黄色菲票必须分批打印");const a=t??r[0]??"WHITE",s=e.map(d=>d.feiTicketId||d.feiTicketNo).filter(Boolean);return`/fcs/print/preview?documentType=FEI_TICKET_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=${encodeURIComponent(s.join(","))}&paperColor=${a}`}function fa(e){return ke([e])}function us(e){var l,o,p,c,b;const t=$a(e.detailRows,"all"),r=De(e),a=((l=e.primaryRow.generated.materialIdentity)==null?void 0:l.materialSku)||e.primaryRow.generated.materialSku||"待补面料",s=((o=e.primaryRow.generated.materialIdentity)==null?void 0:o.materialAlias)||"",d=((p=e.primaryRow.generated.materialIdentity)==null?void 0:p.materialColor)||e.colors.join(" / ");return{objectId:`spreading:${e.spreadingKey}`,objectNo:e.spreadingOrderNo,objectType:"SPREADING_ORDER",objectTypeLabel:Kt.SPREADING_ORDER,detailHref:r,allPrintHref:t,sourceLines:[`生产单：${k(e.productionOrderNos,2)}`,`裁片单：${k(e.cutOrderNos,2)}`,`唛架方案：${e.markerPlanNo} / 唛架编号 ${e.markerNumber}`],material:{materialSku:a,materialLabel:((c=e.primaryRow.generated.materialIdentity)==null?void 0:c.materialName)||a,materialAlias:s,materialImageUrl:(b=e.primaryRow.generated.materialIdentity)==null?void 0:b.materialImageUrl,materialColor:d},styleCode:e.spuCodes.join(" / "),materialSearchText:[a,s,d,...e.colors].filter(Boolean).join(" "),ticketCount:e.ticketCount,totalQuantityLabel:`${x(e.totalPieceQty)} 片`,printedCount:e.printedCount,missingCount:Math.max(e.ticketCount-e.printedCount,0),printStatus:ds(e.tab),printStatusLabel:e.printStatusLabel,firstPrintedAt:e.firstPrintedAt,latestReprintAt:e.latestReprintAt,printCount:e.printCount,printedBy:e.printedBy,detailRows:e.detailRows.map(m=>({ticketId:m.ticketId,ticketNo:m.ticketNo,primaryLabel:`${m.partName||"待补部位"} / ${m.size||"待补尺码"}`,secondaryLabel:`编号 ${m.pieceSequenceLabel||"不可生成"}`,quantityLabel:`${x(m.pieceQty)} 片`,printStatusLabel:m.printStatusLabel,printHref:pt(m)})),keywordIndex:ma([e.spreadingOrderNo,e.markerPlanNo,e.markerNumber,...e.productionOrderNos,...e.cutOrderNos,...e.spuCodes,...e.colors,...e.detailRows.map(m=>m.ticketNo)]),sourceOrder:e}}function ps(e){const t=ae(e);if(!t.length)return null;const r=t.filter(c=>E(c)==="WHITE"),a=t.filter(c=>E(c)==="YELLOW"),s=ba(t),d=t.filter(c=>c.printStatus==="已打印").length,l=Math.max(t.length-d,0),o=s==="PRINTED"?t.length:s==="NEED_REPRINT"?l:t.length,p=d?e.completedAt||e.startedAt:"";return{objectId:da(e),objectNo:e.bindingOrderNo,objectType:"BINDING_STRIP_ORDER",objectTypeLabel:Kt.BINDING_STRIP_ORDER,detailHref:ca(e),allPrintHref:ke(r.length?r:a,r.length?"WHITE":"YELLOW"),sourceLines:[`生产单：${e.sourceProductionOrderNo}`,`裁片单：${e.sourceCutOrderNo}`,`纸样：${e.patternIdentity.patternFileName||e.sourcePatternPackageName}`],material:{materialSku:e.materialIdentity.materialSku,materialLabel:e.materialIdentity.materialName,materialAlias:e.materialIdentity.materialAlias,materialImageUrl:e.materialIdentity.materialImageUrl,materialColor:e.materialIdentity.materialColor},styleCode:e.patternIdentity.patternFileName||e.sourcePatternPackageName,materialSearchText:[e.materialIdentity.materialSku,e.materialIdentity.materialName,e.materialIdentity.materialAlias,e.materialIdentity.materialColor,...t.map(c=>`${c.bindingWidth}cm`),...t.map(c=>c.cuttingMethod)].filter(Boolean).join(" "),ticketCount:t.length,totalQuantityLabel:`捆条需要 ${F(e.plannedTotalLength)} / 需要布料 ${F(e.requiredMaterialLength)}`,printedCount:d,missingCount:l,printStatus:s,printStatusLabel:s==="PRINTED"?`已打印 ${x(o)} 张`:s==="NEED_REPRINT"?`需补打 ${x(o)} 张`:`待打印 ${x(o)} 张`,firstPrintedAt:p||"",latestReprintAt:"",printCount:d,printedBy:d?e.operatorName:"",detailRows:t.map(c=>({ticketId:c.feiTicketId,ticketNo:c.feiTicketNo,primaryLabel:`${c.bindingStripName} / ${c.bindingWidth} cm / 切割方式：${c.cuttingMethod}`,secondaryLabel:`${c.requiresButtonLoop?"用途：制作盘扣 / APF - 辅助工艺 / 去向：中央辅料仓":"用途：衣服捆条"} / 捆条需要 ${F(c.plannedBindingLength)} / 每卷长度：${c.rollLength?F(c.rollLength):"待记录"} / 实切卷数：${c.actualRollCount||0} 卷`,quantityLabel:`${c.requiresButtonLoop?"黄色":"白色"}热敏纸 / 100mm × 100mm`,printStatusLabel:c.printStatus==="已打印"?"已打印":"待打印",printHref:fa(c)})),keywordIndex:ma([e.bindingOrderNo,e.sourceProductionOrderNo,e.sourceCutOrderNo,e.sourceMarkerPlanNo,e.sourcePatternPackageName,e.materialIdentity.materialSku,e.materialIdentity.materialName,e.materialIdentity.materialAlias,e.materialIdentity.materialColor,...t.flatMap(c=>[c.feiTicketNo,c.bindingStripName,`${c.bindingWidth}cm`,c.cuttingMethod])]),sourceOrder:e}}function ms(){return Gt().map(ps).filter(e=>!!e)}function ga(e,t={}){const r=n.filters.keyword.trim().toLowerCase(),a=n.filters.styleCode.trim().toLowerCase(),s=n.filters.fabricSku.trim().toLowerCase(),d=n.filters.productionOrderNo.trim().toLowerCase(),l=t.honorTypeFilter??!0;return e.filter(o=>!l||n.filters.printObjectType==="ALL"||o.objectType===n.filters.printObjectType).filter(o=>n.filters.printableUnitStatus==="ALL"||o.printStatus===n.filters.printableUnitStatus).filter(o=>!a||o.styleCode.toLowerCase().includes(a)).filter(o=>!s||o.materialSearchText.toLowerCase().includes(s)).filter(o=>!d||o.sourceLines.some(p=>p.toLowerCase().includes(d))).filter(o=>!n.filters.printedFrom||o.firstPrintedAt&&o.firstPrintedAt.slice(0,10)>=n.filters.printedFrom).filter(o=>!n.filters.printedTo||o.firstPrintedAt&&o.firstPrintedAt.slice(0,10)<=n.filters.printedTo).filter(o=>!r||o.keywordIndex.some(p=>p.includes(r))).sort((o,p)=>{const c={WAITING_PRINT:0,NEED_REPRINT:1,PRINTED:2},b=c[o.printStatus]-c[p.printStatus];return b!==0?b:o.objectType!==p.objectType?o.objectType.localeCompare(p.objectType,"zh-CN"):o.objectNo.localeCompare(p.objectNo,"zh-CN")})}function bs(e){return ga(e.map(us),{honorTypeFilter:!1}).map(t=>t.sourceOrder).filter(t=>!!t)}function fs(e){return ga(e,{honorTypeFilter:!1}).sort((t,r)=>Number(ce(r).isMixed)-Number(ce(t).isMixed))}function Ae(e){return e!=null&&e.length?`
    <div class="space-y-1">
      ${e.map(t=>`
            <div class="rounded-md border border-slate-200 bg-white px-2 py-1">
              <p class="text-xs font-semibold text-slate-900">${i(`${t.craftType} / ${t.craftCategory}`)}</p>
              <p class="text-xs text-slate-500">${i(t.receiverFactoryName||"承接工厂待补充")}</p>
              <p class="text-xs text-slate-500">${i(`${t.affectedPartName||"待补部位"} / ${t.affectedSize||"待补尺码"} / ${x(t.affectedPieceQty)} 片 / ${t.requirementSource}`)}</p>
            </div>
          `).join("")}
    </div>
  `:'<span class="text-slate-500">无</span>'}function st(e){if(!e.pieceSequenceRange)return`<span class="text-amber-700">${i(e.pieceSequenceCannotGenerateReason||"缺少实际裁剪产出")}</span>`;const t=e.pieceSequenceRange.partInstanceNo?`部位实例 ${e.pieceSequenceRange.partInstanceNo}`:"单部位实例";return`
    <div class="space-y-0.5">
      <p class="font-semibold text-slate-900">${i(e.pieceSequenceLabel)}</p>
      <p class="text-xs text-slate-500">${i(`${e.pieceSequenceRange.sizeGroupId} / ${t}`)}</p>
      <p class="text-xs text-slate-500">${i(`依据：${e.pieceSequenceRange.actualLayerSource} ${x(e.pieceSequenceRange.actualLayerCount)} 层序 / 实际 ${x(e.pieceSequenceRange.actualPieceQty)} 片`)}</p>
    </div>
  `}function gs(e){const t=ve("fei-ticket-detail",e),r=ve("fei-ticket-printed",e),a=ie(e.printableUnitId,"first"),s=ie(e.printableUnitId,"reprint");return e.printableUnitStatus==="WAITING_PRINT"?{primary:{label:"打印菲票",href:a},secondary:{label:"查看详情",href:t},more:[]}:e.printableUnitStatus==="NEED_REPRINT"?{primary:{label:"补打",href:s},secondary:{label:"查看详情",href:t},more:[{label:"查看已打印菲票",href:r}]}:{primary:null,secondary:{label:"查看详情",href:t},more:[{label:"查看已打印菲票",href:r}]}}function H(e){return`<div class="space-y-3 p-4">${e}</div>`}function xs(e){const t=e.tab==="WAIT_FIRST"?"border border-slate-200 bg-slate-100 text-slate-700":e.tab==="PRINTED"?"border border-emerald-200 bg-emerald-50 text-emerald-700":e.tab==="NEED_REPRINT"?"border border-amber-200 bg-amber-50 text-amber-700":"border border-slate-200 bg-slate-100 text-slate-700";return w(e.printStatusLabel,t)}function k(e,t=2){const r=e.filter(Boolean);return r.length?r.length<=t?r.join("；"):`${r.slice(0,t).join("；")}；另 ${r.length-t} 项`:"无"}function xa(e){const t=e.tab==="WAIT_FIRST"?"border border-slate-200 bg-slate-100 text-slate-700":e.tab==="PRINTED"?"border border-emerald-200 bg-emerald-50 text-emerald-700":e.tab==="NEED_REPRINT"?"border border-amber-200 bg-amber-50 text-amber-700":"border border-slate-200 bg-slate-100 text-slate-700";return w(e.printStatusLabel,t)}function ys(e){const t=De(e),r=$a(e.detailRows,"all");return`
    <div class="flex flex-wrap gap-1.5">
      <button type="button" data-nav="${i(r)}" class="inline-flex min-h-8 items-center rounded-md border border-blue-600 bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700">全部打印</button>
      <button type="button" data-nav="${i(t)}" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">菲票明细</button>
    </div>
  `}function hs(e){return`
    <button type="button" data-nav="${i(De(e))}" class="text-left font-medium text-blue-600 hover:underline">
      ${i(e.isManualBatch?"手动建票批次":e.spreadingOrderNo)}
    </button>
    <p class="mt-1 text-xs text-muted-foreground">${i(e.isManualBatch?`无铺布单 / 唛架编号 ${e.markerNumber}`:`${e.markerPlanNo} / 唛架编号 ${e.markerNumber}`)}</p>
    <p class="mt-1 text-xs text-muted-foreground">${i(`菲票明细 ${x(e.ticketCount)} 条 / 裁片 ${x(e.totalPieceQty)} 片`)}</p>
  `}function vs(e){return`
    <div class="space-y-1 text-xs text-muted-foreground">
      <p><span>生产单：</span><span class="font-medium text-foreground">${i(k(e.productionOrderNos,2))}</span></p>
      <p><span>裁片单：</span><span class="font-medium text-foreground">${i(k(e.cutOrderNos,2))}</span></p>
      <p><span>SPU：</span><span class="font-medium text-foreground">${i(k(e.spuCodes,2))}</span></p>
      <p><span>颜色：</span><span class="font-medium text-foreground">${i(k(e.colors,2))}</span></p>
    </div>
  `}function Ns(e){const t=e.detailRows.slice(0,3),r=Math.max(e.detailRows.length-t.length,0);return`
    <div class="space-y-1 text-xs text-muted-foreground">
      ${t.map(a=>`
        <p>
          <span class="font-medium text-foreground">${i(`${a.partName||"待补部位"} / ${a.size||"待补尺码"}`)}</span>
          <span> · ${x(a.pieceQty)} 片 · 编号 ${i(a.pieceSequenceLabel||"不可生成")}</span>
        </p>
      `).join("")}
      ${r?`<p>另 ${x(r)} 条明细，进入部位明细查看。</p>`:""}
    </div>
  `}function ks(e){return`
    <div class="space-y-1 text-xs text-muted-foreground">
      <p><span>是否有特殊工艺：</span><span class="font-medium text-foreground">${e.hasSpecialCraft?"是":"无"}</span></p>
      <p><span>特殊工艺类型：</span><span class="font-medium text-foreground">${i(k(e.specialCraftLines,2))}</span></p>
      <p><span>承接工厂：</span><span class="font-medium text-foreground">${i(k(e.receiverFactoryLines,2))}</span></p>
    </div>
  `}function $s(e){return`
    <div class="space-y-1 text-xs text-muted-foreground">
      <p><span>打印时间：</span><span class="font-medium text-foreground">${i(e.firstPrintedAt||"未打印")}</span></p>
      <p><span>最近补打：</span><span class="font-medium text-foreground">${i(e.latestReprintAt||"无")}</span></p>
      <p><span>打印次数：</span><span class="font-medium text-foreground">${x(e.printCount)}</span></p>
      <p><span>打印人：</span><span class="font-medium text-foreground">${i(e.printedBy||"待打印")}</span></p>
    </div>
  `}function F(e){return`${Number(e||0).toFixed(2)} m`}function Ge(e){return e.rollLength>0?e.rollLength:e.actualRollCount?Number((Number(e.actualLength||0)/e.actualRollCount).toFixed(2)):0}function Rt(e){const t=Ge(e);return t>0&&e.actualRollCount>0?Number((t*e.actualRollCount).toFixed(2)):e.cuttingMethod==="直切"?e.straightCutLength||e.actualLength||0:e.cuttingMethod==="横切"?e.crossCutLength||e.actualLength||0:e.biasCutLength||e.actualLength||0}function Ss(e){const t=e.printStatus==="WAITING_PRINT"?"border border-slate-200 bg-slate-100 text-slate-700":e.printStatus==="PRINTED"?"border border-emerald-200 bg-emerald-50 text-emerald-700":"border border-amber-200 bg-amber-50 text-amber-700";return w(e.printStatusLabel,t)}function Is(e){const t=e.detailRows.slice(0,3),r=Math.max(e.detailRows.length-t.length,0);return`
    <div class="space-y-1 text-xs text-muted-foreground">
      ${t.map(a=>`
        <p>
          <span class="font-medium text-foreground">${i(a.primaryLabel)}</span>
          <span> · ${i(a.quantityLabel)}</span>
          <span> · ${i(a.secondaryLabel)}</span>
        </p>
      `).join("")}
      ${r?`<p>另 ${x(r)} 条明细，进入菲票明细查看。</p>`:""}
    </div>
  `}function ce(e){const t=e.sourceOrder,r=t?ae(t):[],a=r.filter(d=>E(d)==="WHITE"),s=r.filter(d=>E(d)==="YELLOW");return{details:r,whiteDetails:a,yellowDetails:s,isMixed:a.length>0&&s.length>0}}function Cs(e){const t=ce(e);return`
    <div class="space-y-1.5 text-xs text-muted-foreground" data-binding-paper-routing="${t.isMixed?"MIXED":t.yellowDetails.length?"YELLOW":"WHITE"}">
      <p><span>是否做盘扣：</span><span class="font-medium ${t.yellowDetails.length?"text-amber-800":"text-foreground"}">${t.yellowDetails.length?`是 · ${x(t.yellowDetails.length)} 张`:"无"}</span></p>
      <p><span>普通白票：</span><span class="font-medium text-blue-700">${x(t.whiteDetails.length)} 张</span></p>
      <p><span>盘扣黄票：</span><span class="font-medium text-amber-800">${x(t.yellowDetails.length)} 张</span></p>
      ${t.isMixed?'<p class="font-semibold text-amber-800">同单双纸色 · 必须分开打印</p>':""}
    </div>
  `}function Ts(e){if(e.objectType==="BINDING_STRIP_ORDER"){const t=e.sourceOrder,r=ae(t),a=r.filter(d=>E(d)==="WHITE"),s=r.filter(d=>E(d)==="YELLOW");return`
      <div class="flex min-w-[216px] flex-wrap gap-1.5">
        ${a.length?`<button type="button" data-nav="${i(ke(a,"WHITE"))}" class="inline-flex min-h-8 items-center rounded-md border border-blue-600 bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700">普通白票（${a.length}）</button>`:""}
        ${s.length?`<button type="button" data-nav="${i(ke(s,"YELLOW"))}" class="inline-flex min-h-8 items-center rounded-md border border-amber-500 bg-amber-400 px-2.5 text-xs font-semibold text-amber-950 hover:bg-amber-500">盘扣黄票（${s.length}）</button>`:""}
        <button type="button" data-nav="${i(e.detailHref)}" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">菲票明细</button>
      </div>
    `}return`
    <div class="flex min-w-[168px] flex-wrap gap-1.5">
      <button type="button" data-nav="${i(e.allPrintHref)}" class="inline-flex min-h-8 items-center rounded-md border border-blue-600 bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700">全部打印</button>
      <button type="button" data-nav="${i(e.detailHref)}" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">菲票明细</button>
    </div>
  `}function Rs(e){const t=e.material.materialSku||"待补面料 SKU",r=e.material.materialLabel||"",a=e.material.materialAlias||"技术包未维护别名",s=e.material.materialColor||"待补",d=r&&r!==t?`${t} ${r}`:t,l=`${d}实物图`;return`
    <div class="space-y-2">
      <div class="flex min-w-0 items-start gap-2">
        ${e.material.materialImageUrl?`
      <button
        type="button"
        class="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-slate-50"
        data-cutting-fei-action="open-binding-material-preview"
        data-image-url="${i(e.material.materialImageUrl)}"
        data-image-title="${i(d)}"
        data-skip-page-rerender="true"
        aria-label="查看${i(d)}高清物料图"
      >
        <img src="${i(e.material.materialImageUrl)}" alt="${i(l)}" class="h-full w-full object-cover" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false" />
        <span hidden class="px-1 text-center text-[10px] text-red-700">图片加载失败</span>
      </button>
    `:'<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-amber-200 bg-amber-50 px-1 text-center text-[10px] text-amber-800">缺少真实图片</div>'}
        <div class="min-w-0 flex-1 overflow-hidden">
          <div class="truncate whitespace-nowrap font-medium text-foreground" data-material-identity-name="true" title="${i(d)}">${i(d)}</div>
          <div class="mt-1 truncate text-xs text-blue-700" title="${i(`颜色：${s} · 技术包别名：${a}`)}">颜色：${i(s)} · 技术包别名：${i(a)}</div>
        </div>
      </div>
      <p class="text-xs text-muted-foreground">纸样：${i(e.styleCode||"待补纸样")}</p>
    </div>
  `}function ya(){return U?`
    <div class="fixed inset-0 z-[90] flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-label="${i(U.title)}大图预览" data-cutting-fei-binding-material-preview>
      <button type="button" class="absolute inset-0 bg-slate-950/75" data-cutting-fei-action="close-binding-material-preview" data-skip-page-rerender="true" aria-label="关闭大图预览"></button>
      <section class="relative z-10 flex max-h-[92vh] max-w-[92vw] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header class="flex items-center justify-between gap-4 border-b px-4 py-3">
          <h2 class="font-semibold text-slate-900">${i(U.title)}</h2>
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm" data-cutting-fei-action="close-binding-material-preview" data-skip-page-rerender="true">关闭</button>
        </header>
        <div class="flex min-h-40 items-center justify-center overflow-auto bg-slate-100 p-4">
          <img src="${i(U.imageUrl)}" alt="${i(U.title)}高清大图" class="max-h-[80vh] max-w-[86vw] object-contain" onerror="this.hidden=true;this.nextElementSibling.classList.remove('hidden')" />
          <div class="hidden min-w-80 rounded-md border border-red-200 bg-red-50 px-8 py-16 text-center text-sm text-red-700">图片加载失败，请核对素材。</div>
        </div>
      </section>
    </div>
  `:""}function Ps(e){return`<div class="space-y-1 text-xs text-muted-foreground">${e.sourceLines.map(t=>`<p>${i(t)}</p>`).join("")}</div>`}function Ls(e){return`
    <div class="space-y-1 text-xs text-muted-foreground">
      <p><span class="font-medium text-foreground">${i(e.firstPrintedAt||"未打印")}</span></p>
      <p>最近补打：${i(e.latestReprintAt||"无")}</p>
      <p>打印次数：${x(e.printCount)} / 打印人：${i(e.printedBy||"待打印")}</p>
    </div>
  `}const Os=[{key:"spreading",title:"铺布单 / 手动批次",width:250,required:!0,freezeable:!0,sortable:!0,sortValue:e=>e.spreadingOrderNo,render:hs},{key:"source",title:"来源",width:270,required:!0,freezeable:!0,sortable:!0,sortValue:e=>e.productionOrderNos.join(" "),render:vs},{key:"details",title:"菲票明细",width:360,required:!0,render:Ns},{key:"specialCraft",title:"特殊工艺",width:250,required:!0,sortable:!0,sortValue:e=>`${e.hasSpecialCraft?1:0}-${e.specialCraftLines.join(" ")}`,render:ks},{key:"printInfo",title:"打印信息",width:240,sortable:!0,sortValue:e=>e.firstPrintedAt,render:$s},{key:"status",title:"状态",width:150,required:!0,sortable:!0,sortValue:e=>e.printStatusLabel,render:xa},{key:"actions",title:"操作",width:190,required:!0,actionColumn:!0,render:e=>`<div class="min-w-[168px]">${ys(e)}</div>`}],ws=[{key:"bindingOrder",title:"捆条加工单",width:230,required:!0,freezeable:!0,sortable:!0,sortValue:e=>e.objectNo,render:e=>{const t=ce(e);return`<button type="button" data-nav="${i(e.detailHref)}" class="text-left font-medium text-blue-600 hover:underline">${i(e.objectNo)}</button><div class="mt-1 text-xs text-muted-foreground">${i(`菲票明细 ${x(e.ticketCount)} 条 / ${e.totalQuantityLabel}`)}</div>${t.isMixed?'<div class="mt-1 inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800" data-binding-mixed-paper-order>同单含普通白票与盘扣黄票</div>':""}`}},{key:"source",title:"来源",width:260,required:!0,freezeable:!0,sortable:!0,sortValue:e=>e.sourceLines.join(" "),render:Ps},{key:"material",title:"物料 / 纸样",width:310,required:!0,freezeable:!0,sortable:!0,sortValue:e=>`${e.material.materialSku} ${e.styleCode}`,render:Rs},{key:"details",title:"捆条明细",width:360,required:!0,render:Is},{key:"paperRouting",title:"盘扣 / 打印用纸",width:220,required:!0,sortable:!0,sortValue:e=>{const t=ce(e);return`${t.yellowDetails.length}-${t.whiteDetails.length}`},render:Cs},{key:"printInfo",title:"打印信息",width:230,sortable:!0,sortValue:e=>e.firstPrintedAt,render:Ls},{key:"status",title:"状态",width:160,required:!0,sortable:!0,sortValue:e=>e.printStatusLabel,render:Ss},{key:"actions",title:"操作",width:190,required:!0,actionColumn:!0,render:Ts}],Be={PART:"cutting-part-fei-list",BINDING:"cutting-binding-fei-list"},it={PART:'[data-cutting-fei-list-root="PART"]',BINDING:'[data-cutting-fei-list-root="BINDING"]'};function nt(){return bs(cs(at(Y())))}function lt(){return fs(ms())}const ha=Dt({state:Se.PART,columns:Os,preferenceKey:"standard-list:/fcs/craft/cutting/fei-tickets",pageSizeOptions:[10,20,50],eventPrefix:Be.PART,rootSelector:it.PART,tableSurfaceSelector:"[data-cutting-fei-list-table-surface]",paginationSurfaceSelector:"[data-cutting-fei-list-pagination-surface]",overlaysSurfaceSelector:"[data-cutting-fei-list-overlays-surface]",defaultFrozenKeys:["spreading"],columnSettingsTitle:"部位菲票打印列设置",emptyText:"当前筛选范围内暂无部位菲票打印对象。",getRows:nt,maxFrozenWidth:520,locallyManagedEvents:!0}),va=Dt({state:Se.BINDING,columns:ws,preferenceKey:"standard-list:/fcs/craft/cutting/binding-fei-tickets",pageSizeOptions:[10,20,50],eventPrefix:Be.BINDING,rootSelector:it.BINDING,tableSurfaceSelector:"[data-cutting-fei-list-table-surface]",paginationSurfaceSelector:"[data-cutting-fei-list-pagination-surface]",overlaysSurfaceSelector:"[data-cutting-fei-list-overlays-surface]",defaultFrozenKeys:["bindingOrder"],columnSettingsTitle:"捆条菲票打印列设置",emptyText:"当前筛选范围内暂无捆条菲票打印对象。",getRows:lt,maxFrozenWidth:520,locallyManagedEvents:!0});function ot(e=J()){return e==="BINDING"?va:ha}function Es(e=J()){return e==="BINDING"?lt():nt()}function dt(){return Ht(void 0,{sourceIdentityOnly:!0}).viewModel.plans.filter(e=>{var t;return e.status!=="CANCELED"&&!!e.markerNo&&!!((t=e.beds)!=null&&t.some(r=>!r.lockedBySpreading))})}function Qe(e=n.manualCreate.markerPlanId){return dt().find(t=>t.id===e||t.markerNo===e)||null}function $e(e){return((e==null?void 0:e.beds)||[]).filter(t=>!t.lockedBySpreading)}function Pt(e){return Object.values((e==null?void 0:e.sizePiecePerLayer)||{}).some(t=>Number(t||0)>0)}function Na(e){const t=$e(e);return t.find(r=>r.bedId===n.manualCreate.markerMemberId)||t[0]||null}function _e(e,t){const r=dt(),a=r.find(l=>l.id===e||l.markerNo===e)||r.find(l=>$e(l).some(Pt))||r[0]||null,s=$e(a),d=s.find(l=>l.bedId===t)||s.find(Pt)||s[0]||null;n.manualCreate={...n.manualCreate,markerPlanId:(a==null?void 0:a.id)||"",markerMemberId:(d==null?void 0:d.bedId)||"",layerCount:Math.max((d==null?void 0:d.plannedLayerCount)||1,1),sizePiecePerLayer:{...(d==null?void 0:d.sizePiecePerLayer)||{}}}}function ct(){return n.feedback?`<div class="mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${n.feedback.tone==="success"?"border-emerald-200 bg-emerald-50 text-emerald-800":"border-rose-200 bg-rose-50 text-rose-800"}"><span>${i(n.feedback.message)}</span><button type="button" data-cutting-fei-action="dismiss-feedback" class="font-medium">关闭</button></div>`:""}function ka(){if(!n.manualCreate.open)return"";const e=dt(),t=n.manualCreate.search.trim().toLowerCase(),r=e.filter(m=>!t||[m.markerNo,m.markerPlanNo,m.productionOrderNos.join(" "),m.spuCode,m.styleName,m.colorSummary].join(" ").toLowerCase().includes(t)),a=Qe(),s=$e(a),d=Na(a),l=Object.entries((d==null?void 0:d.sizePiecePerLayer)||{}).filter(([,m])=>Number(m||0)>0),o=(a==null?void 0:a.productionOrderNos.join("、"))||"选择唛架后带出",p=(d==null?void 0:d.colorName)||(d==null?void 0:d.colorCode)||(a==null?void 0:a.colorSummary)||"选择唛架成员后带出",c=a?N(a.pieceExplosionRows.filter(m=>!(d!=null&&d.colorCode)||!m.colorCode||m.colorCode===d.colorCode).map(m=>m.skuCode)):[],b=l.reduce((m,[f])=>m+Math.max(Number(n.manualCreate.sizePiecePerLayer[f]||0),0),0)*Math.max(n.manualCreate.layerCount,0);return`
    <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 md:p-8" role="dialog" aria-modal="true" aria-label="手动增加打印菲票">
      <div class="w-full max-w-5xl rounded-xl bg-white shadow-2xl">
        <div class="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div><h2 class="text-lg font-semibold text-slate-900">手动增加打印菲票</h2><p class="mt-1 text-sm text-slate-500">选择唛架，生成部位菲票。</p></div>
          <button type="button" data-cutting-fei-action="close-manual-create" class="rounded-md border px-3 py-1.5 text-sm">关闭</button>
        </div>
        <div class="space-y-5 p-5">
          <section class="rounded-lg border border-slate-200 p-4">
            <h3 class="font-semibold text-slate-900">1. 选择现有唛架</h3>
            <div class="mt-3 grid gap-3 md:grid-cols-2">
              <label class="space-y-1 text-sm"><span class="text-slate-600">搜索唛架</span><input data-cutting-fei-manual-field="search" value="${i(n.manualCreate.search)}" class="h-10 w-full rounded-md border px-3" placeholder="唛架号 / 生产单 / SPU / 颜色" /></label>
              <label class="space-y-1 text-sm"><span class="text-slate-600">唛架号</span><select data-cutting-fei-manual-field="markerPlanId" class="h-10 w-full rounded-md border px-3"><option value="">请选择现有可用唛架</option>${r.map(m=>`<option value="${i(m.id)}" ${m.id===(a==null?void 0:a.id)?"selected":""}>${i(m.markerNo)} · ${i(m.productionOrderNos.join("、"))} · ${i(m.spuCode)}</option>`).join("")}</select></label>
              <label class="space-y-1 text-sm md:col-span-2"><span class="text-slate-600">唛架成员</span><select data-cutting-fei-manual-field="markerMemberId" class="h-10 w-full rounded-md border px-3"><option value="">请选择唛架成员</option>${s.map(m=>`<option value="${i(m.bedId)}" ${m.bedId===(d==null?void 0:d.bedId)?"selected":""}>${i(m.bedNo)} · ${i(m.colorName||m.colorCode)} · ${i(m.sizeSummaryText)}</option>`).join("")}</select></label>
            </div>
          </section>
          <section class="rounded-lg border border-slate-200 p-4">
            <h3 class="font-semibold text-slate-900">2. 自动带出来源</h3>
            <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div class="rounded-md bg-slate-50 p-3"><p class="text-xs text-slate-500">生产单</p><p class="mt-1 text-sm font-semibold">${i(o)}</p></div>
              <div class="rounded-md bg-slate-50 p-3"><p class="text-xs text-slate-500">SPU</p><p class="mt-1 text-sm font-semibold">${i((a==null?void 0:a.spuCode)||"—")}</p></div>
              <div class="rounded-md bg-slate-50 p-3"><p class="text-xs text-slate-500">颜色</p><p class="mt-1 text-sm font-semibold">${i(p)}</p></div>
              <div class="rounded-md bg-slate-50 p-3"><p class="text-xs text-slate-500">SKU</p><p class="mt-1 text-sm font-semibold break-all">${i(c.join("、")||"—")}</p></div>
            </div>
          </section>
          <section class="rounded-lg border border-slate-200 p-4">
            <h3 class="font-semibold text-slate-900">3. 填写层数与每层件数</h3>
            <div class="mt-3 grid gap-3 md:grid-cols-[12rem_minmax(0,1fr)]">
              <label class="space-y-1 text-sm"><span class="text-slate-600">铺布层数</span><input type="number" min="1" step="1" data-cutting-fei-manual-field="layerCount" value="${Math.max(n.manualCreate.layerCount,1)}" class="h-10 w-full rounded-md border px-3" /></label>
              <div><p class="text-sm text-slate-600">尺码（每层件数）</p><div class="mt-1 flex flex-wrap gap-3">${l.length?l.map(([m])=>`<label class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><span class="font-medium">${i(m)}</span><input type="number" min="0" step="1" data-cutting-fei-manual-size="${i(m)}" value="${Math.max(Number(n.manualCreate.sizePiecePerLayer[m]||0),0)}" class="w-20 rounded border px-2 py-1" /></label>`).join(""):'<span class="text-sm text-amber-700">该成员没有可用尺码配比。</span>'}</div></div>
            </div>
            <p class="mt-3 text-sm text-slate-600">本次预计覆盖 ${x(b)} 件成衣；每张部位菲票片数由“层数 × 每层该尺码件数”计算，同一成衣需要多片的部位按部位实例分别生成。</p>
            <label class="mt-3 block space-y-1 text-sm"><span class="text-slate-600">备注</span><input data-cutting-fei-manual-field="remark" value="${i(n.manualCreate.remark)}" class="h-10 w-full rounded-md border px-3" placeholder="手动建票原因或说明" /></label>
          </section>
        </div>
        <div class="flex justify-end gap-3 border-t px-5 py-4"><button type="button" data-cutting-fei-action="close-manual-create" class="rounded-md border px-4 py-2 text-sm">取消</button><button type="button" data-cutting-fei-action="confirm-manual-create" ${a&&d&&l.length?"":"disabled"} class="rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:border-slate-200 disabled:bg-slate-200">确认生成菲票</button></div>
      </div>
    </div>
  `}function V(e=J()){return typeof document>"u"?null:document.querySelector(it[e])}function Ds(e=J()){var r;const t=(r=V(e))==null?void 0:r.querySelector("[data-cutting-fei-list-filters-surface]");t&&(t.innerHTML=la())}function As(e=J()){var r;const t=(r=V(e))==null?void 0:r.querySelector("[data-cutting-fei-list-stats-surface]");t&&(t.innerHTML=oa(Es(e),e))}function Le(e=J()){var r;const t=(r=V(e))==null?void 0:r.querySelector("[data-cutting-fei-list-runtime-overlays]");t&&(t.innerHTML=`${e==="PART"?ka():""}${ya()}`)}function Te(e=J()){const t=ot(e);Se[e].currentPage=1;const r=t.refresh();return As(e),r}function Bs(){It||typeof document>"u"||(It=!0,document.addEventListener("keydown",e=>{e.key!=="Escape"||!U||(U=null,Le("BINDING"))}))}function Fs(){ta();const e=A(),t=J(e),r=t==="BINDING"?oe("binding-fei-tickets"):oe(e,"fei-tickets"),a=V(t),s=Se[t];wa(s,!!a),a||(s.showColumnSettings=!1,U=null);const d=ot(t);d.ensurePreferencesLoaded(),d.installColumnDragEvents(),Bs();const l=le(),o=t==="BINDING"?lt():nt(),p=t==="BINDING"?va.getView(o):ha.getView(o),c=`<div class="flex flex-wrap gap-2">${t==="PART"?'<button type="button" data-cutting-fei-action="open-manual-create" class="inline-flex min-h-10 items-center rounded-md border border-amber-500 bg-amber-500 px-4 text-sm font-medium text-white hover:bg-amber-600">手动增加打印菲票</button>':""}${l||""}</div>`,b=Ea("列设置",{prefix:Be[t],action:"open-column-settings",skipPageRerender:!0},"settings-2"),m=Da({title:r.pageTitle,primaryActionsHtml:c,feedbackHtml:`<div data-fei-feedback-surface>${ct()}</div>`,filtersHtml:`<div data-cutting-fei-list-filters-surface>${la()}</div>`,statsHtml:`<div data-cutting-fei-list-stats-surface>${oa(o,t)}</div>`,listTitle:t==="BINDING"?"捆条菲票打印对象":"部位菲票打印对象",listActionsHtml:`<div class="flex flex-wrap items-center gap-3"><span class="text-xs text-muted-foreground">当前筛选共 ${x(o.length)} 条</span>${b}</div>`,tableHtml:`<div data-testid="${t==="BINDING"?"binding-fei-ticket-print-workbench":"part-fei-ticket-print-workbench"}" data-standard-list-table data-cutting-fei-list-table-surface>${p.tableHtml}</div>`,paginationHtml:`<div data-cutting-fei-list-pagination-surface>${p.paginationHtml}</div>`,overlaysHtml:`<div data-cutting-fei-list-overlays-surface>${d.renderColumnSettings()}</div><div data-cutting-fei-list-runtime-overlays>${t==="PART"?ka():""}${ya()}</div>`});return`<div data-cutting-fei-list-root="${t}">${m}</div>`}function Oe(e){return`<button type="button" data-nav="${i(e?ve("fei-tickets",e):P("fei-tickets"))}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">返回部位菲票打印</button>`}function Ms(e){const t=gs(e);return`
    <div class="flex flex-wrap gap-2">
      ${t.primary?`<button type="button" data-nav="${i(t.primary.href)}" class="inline-flex min-h-10 items-center rounded-md border border-blue-600 bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700">${i(t.primary.label)}</button>`:""}
      <button type="button" data-nav="${i(t.secondary.href)}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">${i(t.secondary.label)}</button>
      ${t.more.length?t.more.map(r=>`<button type="button" data-nav="${i(r.href)}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">${i(r.label)}</button>`).join(""):""}
    </div>
  `}function qs(e){const{unit:t}=e,r=t.sourceMarkerNos.join(" / ")||"待补",a=t.sourceCutOrderNos.join(" / ")||"待补",s=t.batchNo||"未关联唛架方案";return`
    <section class="rounded-lg border bg-white p-4 shadow-sm">
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-xs text-slate-500">可打印单元号</p>
            <p class="mt-1 text-sm font-semibold text-slate-900">${i(t.printableUnitNo)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-xs text-slate-500">单元类型</p>
            <div class="mt-1">${ra(t.printableUnitType)}</div>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-xs text-slate-500">款号</p>
            <p class="mt-1 text-sm font-semibold text-slate-900">${i(t.styleCode||"待补款号")}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-xs text-slate-500">面料</p>
            <div class="mt-2">${he({materialSku:t.fabricSku||"待补面料",materialLabel:t.fabricSku||"待补面料",materialAlias:t.materialAlias,materialImageUrl:t.materialImageUrl},{compact:!0})}</div>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">来源生产单数</p>
            <p class="mt-1 text-xl font-semibold text-slate-900">${x(t.sourceProductionOrderCount)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">来源裁片单数</p>
            <p class="mt-1 text-xl font-semibold text-slate-900">${x(t.sourceCutOrderCount)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">应打菲票数</p>
            <p class="mt-1 text-xl font-semibold text-slate-900">${x(t.requiredTicketCount)}</p>
            <div class="mt-1 flex flex-wrap items-center gap-2">
              <span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${t.ticketCountBasisType===He?"border-emerald-200 bg-emerald-50 text-emerald-700":"border-amber-200 bg-amber-50 text-amber-700"}">${i(t.ticketCountBasisLabel)}</span>
              <span class="text-xs text-slate-500">${i(t.ticketCountBasisType===He?"按实际裁片数量拆分":"当前尚未形成实际裁剪产出")}</span>
            </div>
            <p class="mt-1 text-xs text-slate-500">${i(t.ticketCountBasisDetail)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">有效已打印数</p>
            <p class="mt-1 text-xl font-semibold text-slate-900">${x(t.validPrintedTicketCount)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">当前状态</p>
            <div class="mt-1">${sa(t.printableUnitStatus)}</div>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">最近打印时间</p>
            <p class="mt-1 text-sm font-medium text-slate-900">${i(et(t.lastPrintedAt))}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">最近打印人</p>
            <p class="mt-1 text-sm font-medium text-slate-900">${i(t.lastPrintedBy||"未打印")}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3 md:col-span-2 xl:col-span-4">
            <p class="text-xs text-slate-500">来源铺布</p>
            <p class="mt-1 text-sm font-medium text-slate-900">${i(Yr(t))}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">来源唛架</p>
            <p class="mt-1 text-sm font-medium text-slate-900">${i(r)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">来源裁片单</p>
            <p class="mt-1 text-sm font-medium text-slate-900">${i(a)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">来源唛架方案</p>
            <p class="mt-1 text-sm font-medium text-slate-900">${i(s)}</p>
          </div>
        </div>
        ${Ms(t)}
      </div>
    </section>
  `}function js(e,t){return`
    <section class="rounded-lg border bg-white p-3 shadow-sm">
      <div class="flex flex-wrap gap-2">
        ${[{key:"split",label:"菲票拆分明细",href:Ct("fei-ticket-detail",e,{tab:"split"})},{key:"printed",label:"已打印菲票",href:Ct("fei-ticket-printed",e)}].map(a=>{const d=a.key===t?"border-blue-500 bg-blue-50 text-blue-700":"border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50";return`<button type="button" data-nav="${i(a.href)}" class="inline-flex min-h-10 items-center rounded-lg border px-4 text-sm font-medium transition ${d}">${i(a.label)}</button>`}).join("")}
      </div>
    </section>
  `}function $(e,t,r){return`
    <section class="rounded-lg border bg-white shadow-sm">
      <div class="border-b border-slate-200 px-4 py-3">
        <h2 class="text-sm font-semibold text-slate-900">${i(e)}</h2>
      </div>
      <div class="p-4">${r}</div>
    </section>
  `}function _s(e){const t=`
    <table class="min-w-full text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-3 py-3 text-left font-medium">面料卷号</th>
          <th class="px-3 py-3 text-left font-medium">布料颜色</th>
          <th class="px-3 py-3 text-left font-medium">尺码</th>
          <th class="px-3 py-3 text-left font-medium">裁片部位</th>
          <th class="px-3 py-3 text-left font-medium">数量</th>
          <th class="px-3 py-3 text-left font-medium">扎号</th>
          <th class="px-3 py-3 text-left font-medium">配套编号</th>
          <th class="px-3 py-3 text-left font-medium">部位裁片编号范围</th>
          <th class="px-3 py-3 text-left font-medium">特殊工艺 / 承接工厂</th>
          <th class="px-3 py-3 text-left font-medium">裁片单</th>
          <th class="px-3 py-3 text-left font-medium">${Bt}</th>
          <th class="px-3 py-3 text-left font-medium">缺口菲票数</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 bg-white">
        ${e.splitDetails.map(r=>`
              <tr>
                <td class="px-3 py-3 font-medium text-slate-900">${i(r.fabricRollNo||"暂无数据")}</td>
                <td class="px-3 py-3 text-slate-700">${i(r.fabricColor||"暂无数据")}</td>
                <td class="px-3 py-3 text-slate-700">${i(r.size||"待补尺码")}</td>
                <td class="px-3 py-3 text-slate-700">${i(r.partName)}</td>
                <td class="px-3 py-3 text-slate-700">${x(r.quantity)}</td>
                <td class="px-3 py-3 text-slate-700">${i(r.bundleNo||"暂无数据")}</td>
                <td class="px-3 py-3 text-slate-700">${i(r.pieceSetNoRange||"暂无数据")}</td>
                <td class="px-3 py-3 text-slate-700">${st(r)}</td>
                <td class="px-3 py-3 text-slate-700">${Ae(r.specialCrafts)}</td>
                <td class="px-3 py-3 text-slate-700">${i(r.sourceCutOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${Mt(r.sourceProductionOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${x(r.gapCount)}</td>
              </tr>
            `).join("")}
      </tbody>
    </table>
  `;return $("菲票拆分明细","",Ke(t,"max-h-[60vh]"))}function zs(e,t){return t&&(e.craftTraceProjection.itemsByTicketId[t.ticketId]||e.craftTraceProjection.itemsByTicketNo[t.ticketNo])||null}function Us(e){const t=kr().find(r=>r.feiTicketNo===e);return t?Ba(t.operationId,t.taskOrderId):"/fcs/craft/cutting/special-processes"}function Ws(e){const t=Je(e);return`
    <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p class="text-xs text-slate-500">特殊工艺流转</p>
      <div class="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <div>
          <p class="text-xs text-slate-500">是否需要特殊工艺</p>
          <p class="text-sm font-semibold text-slate-900">${t.needSpecialCraft?"是":"无"}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">特殊工艺</p>
          <p class="text-sm font-semibold text-slate-900">${i(t.operationNames.join(" / ")||"待绑定")}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">已完成特殊工艺</p>
          <p class="text-sm font-semibold text-slate-900">${i(t.completedOperationNames.join(" / ")||"—")}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">当前特殊工艺</p>
          <p class="text-sm font-semibold text-slate-900">${i(t.currentOperationName)}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">特殊工艺任务</p>
          <p class="text-sm font-semibold text-slate-900">${i(t.taskOrderNos.join(" / ")||"待绑定")}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">交出状态</p>
          <p class="text-sm font-semibold text-slate-900">${i(Ye(t.dispatchStatus))}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">回仓状态</p>
          <p class="text-sm font-semibold text-slate-900">${i(t.returnStatus)}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">当前所在</p>
          <p class="text-sm font-semibold text-slate-900">${i(t.currentLocation)}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">原数量 / 当前数量</p>
          <p class="text-sm font-semibold text-slate-900">${x(t.originalQty)} / ${x(t.currentQty)}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">累计报废 / 累计货损</p>
          <p class="text-sm font-semibold text-slate-900">${x(t.cumulativeScrapQty)} / ${x(t.cumulativeDamageQty)}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">差异状态</p>
          <p class="text-sm font-semibold text-slate-900">${i([t.receiveDifferenceStatus,t.returnDifferenceStatus].filter(r=>r!=="—").join(" / ")||"无")}</p>
        </div>
      </div>
    </div>
  `}function Hs(e,t){if(!t)return"";const r=Y(),a=zs(r,t),s=Je(t.ticketNo),d=_().get("panel")||"qr",l=Ya(t),o=ia(t),p=d==="preview"?"打印预览":"菲票码预览",c=d==="preview"?`
          <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p class="text-xs uppercase tracking-wide text-slate-500">裁片菲票预览</p>
            <div class="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p class="text-lg font-semibold text-slate-900">${i(l)}</p>
            </div>
            <div class="mt-3 grid gap-3 md:grid-cols-[1fr,140px]">
              <div class="grid gap-3 md:grid-cols-2">
                <div>
                  <p class="text-sm text-slate-500">票号</p>
                  <p class="text-lg font-semibold text-slate-900">${Ft({objectType:"FEI_TICKET",objectId:t.ticketNo,label:t.ticketNo,className:"font-mono text-blue-600 hover:underline"})}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">裁片单 / 生产单</p>
                  <p class="text-sm font-semibold text-slate-900">${i(`${(a==null?void 0:a.cutOrderNo)||t.sourceCutOrderNo} / ${(a==null?void 0:a.productionOrderNo)||t.sourceProductionOrderNo||"待补生产单"}`)}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">面料 / 面料卷号</p>
                  ${he({materialSku:(a==null?void 0:a.materialSku)||e.fabricSku||"待补",materialLabel:(a==null?void 0:a.materialSku)||e.fabricSku||"待补",materialAlias:e.materialAlias,materialImageUrl:e.materialImageUrl},{compact:!0})}
                  <p class="mt-1 text-xs text-slate-500">${i(t.fabricRollNo||"暂无数据")}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">布料颜色 / 成衣颜色</p>
                  <p class="text-lg font-semibold text-slate-900">${i(t.fabricColor||"暂无数据")}</p>
                  <p class="mt-1 text-xs text-slate-500">${i(t.color||"暂无数据")}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">裁片部位 / 扎号</p>
                  <p class="text-lg font-semibold text-slate-900">${i(t.partName)}</p>
                  <p class="mt-1 text-xs text-slate-500">${i(t.bundleNo||"暂无数据")}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">配套编号</p>
                  <p class="text-lg font-semibold text-slate-900">${i(t.pieceSetNoRange||"暂无数据")}</p>
                  <p class="mt-1 text-xs text-slate-500">${i(t.bundleTicketType||"扎束菲票")}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">部位裁片编号范围</p>
                  <div class="mt-1 text-sm">${st(t)}</div>
                </div>
                <div>
                  <p class="text-sm text-slate-500">打编号状态</p>
                  <div class="mt-1">${na(o)}</div>
                </div>
                <div>
                  <p class="text-sm text-slate-500">数量 / 裁片数</p>
                  <p class="text-lg font-semibold text-slate-900">${x(t.quantity)}</p>
                  <p class="mt-1 text-xs text-slate-500">${i(`${x(t.actualCutPieceQty)} 片`)}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">工艺顺序</p>
                  <p class="text-sm font-semibold text-slate-900">${i((a==null?void 0:a.secondaryCrafts.join(" → "))||"未配置")}</p>
                  <p class="mt-1 text-xs text-slate-500">${i(`版本 ${(a==null?void 0:a.craftSequenceVersion)||"待补"} / 当前 ${(a==null?void 0:a.currentCraftStage)||"未开始"}`)}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">特殊工艺</p>
                  <p class="text-sm font-semibold text-slate-900">${i(t.specialCraftDisplayLabel||"无")}</p>
                  <div class="mt-1">${Ae(t.specialCrafts)}</div>
                </div>
                <div>
                  <p class="text-sm text-slate-500">交出状态 / 回仓状态</p>
                  <p class="text-sm font-semibold text-slate-900">${i(`${Ye(s.dispatchStatus)} / ${s.returnStatus}`)}</p>
                  <p class="mt-1 text-xs text-slate-500">${i(s.currentLocation)}</p>
                </div>
              </div>
              <div>
                ${We(t)?Re({value:kt(t),size:128,title:"菲票二维码",label:`菲票 ${t.ticketNo}`}):'<div class="inline-flex h-[128px] w-[128px] items-center justify-center rounded-lg border border-dashed text-xs text-slate-500">缺少数据</div>'}
                <p class="mt-2 text-center text-xs text-slate-500">菲票二维码</p>
              </div>
            </div>
          </div>
        `:`
          <div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div class="flex flex-wrap items-start gap-4">
              ${We(t)?Re({value:kt(t),size:128,title:"菲票二维码",label:`菲票 ${t.ticketNo}`}):'<div class="inline-flex h-[128px] w-[128px] items-center justify-center rounded-lg border border-dashed text-xs text-blue-600">缺少数据</div>'}
              <div class="grid flex-1 gap-2 text-sm text-blue-900">
                <div class="font-semibold">${i(l)}</div>
                <div>裁片单：${i((a==null?void 0:a.cutOrderNo)||t.sourceCutOrderNo)}</div>
                <div>生产单：${i((a==null?void 0:a.productionOrderNo)||t.sourceProductionOrderNo||"待补")}</div>
                <div class="rounded-md bg-white/70 p-2">
                  ${he({materialSku:(a==null?void 0:a.materialSku)||e.fabricSku||"待补",materialLabel:(a==null?void 0:a.materialSku)||e.fabricSku||"待补",materialAlias:e.materialAlias,materialImageUrl:e.materialImageUrl},{compact:!0,imageSizeClass:"h-9 w-9",showCategory:!1})}
                </div>
                <div>扎号：${i(t.bundleNo||"暂无数据")}</div>
                <div>配套编号：${i(t.pieceSetNoRange||"暂无数据")}</div>
                <div>打编号状态：${i(o)}</div>
              </div>
            </div>
          </div>
        `;return $(p,"",`${c}${Ws(t.ticketNo)}`)}function Gs(e,t){const r=ts(t),a=`
    <table class="min-w-full text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-3 py-3 text-left font-medium">菲票号</th>
          <th class="px-3 py-3 text-left font-medium">裁片单</th>
          <th class="px-3 py-3 text-left font-medium">${Bt}</th>
          <th class="px-3 py-3 text-left font-medium">面料卷号</th>
          <th class="px-3 py-3 text-left font-medium">布料颜色</th>
          <th class="px-3 py-3 text-left font-medium">尺码</th>
          <th class="px-3 py-3 text-left font-medium">裁片部位</th>
          <th class="px-3 py-3 text-left font-medium">数量</th>
          <th class="px-3 py-3 text-left font-medium">扎号</th>
          <th class="px-3 py-3 text-left font-medium">配套编号</th>
          <th class="px-3 py-3 text-left font-medium">部位裁片编号范围</th>
          <th class="px-3 py-3 text-left font-medium">打编号状态</th>
          <th class="px-3 py-3 text-left font-medium">是否需要特殊工艺</th>
          <th class="px-3 py-3 text-left font-medium">特殊工艺</th>
          <th class="px-3 py-3 text-left font-medium">特殊工艺顺序</th>
          <th class="px-3 py-3 text-left font-medium">已完成特殊工艺</th>
          <th class="px-3 py-3 text-left font-medium">当前特殊工艺</th>
          <th class="px-3 py-3 text-left font-medium">特殊工艺任务</th>
          <th class="px-3 py-3 text-left font-medium">原数量</th>
          <th class="px-3 py-3 text-left font-medium">当前数量</th>
          <th class="px-3 py-3 text-left font-medium">累计报废</th>
          <th class="px-3 py-3 text-left font-medium">累计货损</th>
          <th class="px-3 py-3 text-left font-medium">接收差异状态</th>
          <th class="px-3 py-3 text-left font-medium">回仓差异状态</th>
          <th class="px-3 py-3 text-left font-medium">交出状态</th>
          <th class="px-3 py-3 text-left font-medium">回仓状态</th>
          <th class="px-3 py-3 text-left font-medium">当前所在</th>
          <th class="px-3 py-3 text-left font-medium">中转单号</th>
          <th class="px-3 py-3 text-left font-medium">中转袋号</th>
          <th class="px-3 py-3 text-left font-medium">袋内状态</th>
          <th class="px-3 py-3 text-left font-medium">所属交出记录</th>
          <th class="px-3 py-3 text-left font-medium">交出状态</th>
          <th class="px-3 py-3 text-left font-medium">是否已装袋</th>
          <th class="px-3 py-3 text-left font-medium">是否已交出</th>
          <th class="px-3 py-3 text-left font-medium">车缝回写状态</th>
          <th class="px-3 py-3 text-left font-medium">特殊工艺回仓状态</th>
          <th class="px-3 py-3 text-left font-medium">打印版本号</th>
          <th class="px-3 py-3 text-left font-medium">打印状态</th>
          <th class="px-3 py-3 text-left font-medium">中转袋绑定</th>
          <th class="px-3 py-3 text-left font-medium">打印时间</th>
          <th class="px-3 py-3 text-left font-medium">打印人</th>
          <th class="px-3 py-3 text-left font-medium">操作</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 bg-white">
        ${t.ticketCards.filter(s=>s.status==="VALID").map(s=>{var c,b,m,f,u;const d=Je(s.ticketNo),l=$r(s.ticketNo),o=ia(s),p=[{label:"查看菲票码",href:ie(s.ticketId,"first")},{label:"查看打印预览",href:ie(s.ticketId,"first")},{label:"打印菲票标签",href:ie(s.ticketId,"first")},{label:"补打标签",href:ie(s.ticketId,"reprint")},{label:"查看交出单",href:`${P("sewing-dispatch")}?keyword=${encodeURIComponent(s.ticketNo)}`},{label:"查看中转袋",href:`${P("transfer-bags")}?keyword=${encodeURIComponent(((c=l.transferBag)==null?void 0:c.transferBagNo)||s.ticketNo)}`},{label:(b=l.transferBag)!=null&&b.editableBeforeHandover?"已装袋未交出可移出":"已交出后不可移出",href:`${P("sewing-dispatch")}?keyword=${encodeURIComponent(s.ticketNo)}`},...d.needSpecialCraft?[{label:"查看特殊工艺任务",href:Us(s.ticketNo)},{label:"查看特殊工艺交出",href:`${P("special-craft-dispatch")}?keyword=${encodeURIComponent(s.ticketNo)}`},{label:"查看特殊工艺回仓",href:`${P("special-craft-return")}?keyword=${encodeURIComponent(s.ticketNo)}`}]:[]];return`
              <tr>
                <td class="px-3 py-3 font-medium text-slate-900">${Ft({objectType:"FEI_TICKET",objectId:s.ticketNo,label:s.ticketNo,className:"font-mono text-blue-600 hover:underline"})}</td>
                <td class="px-3 py-3 text-slate-700">${i(s.sourceCutOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${Mt(s.sourceProductionOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${i(s.fabricRollNo||"暂无数据")}</td>
                <td class="px-3 py-3 text-slate-700">${i(s.fabricColor||"暂无数据")}</td>
                <td class="px-3 py-3 text-slate-700">${i(s.size)}</td>
                <td class="px-3 py-3 text-slate-700">${i(s.partName)}</td>
                <td class="px-3 py-3 text-slate-700">${x(s.quantity)}</td>
                <td class="px-3 py-3 text-slate-700">${i(s.bundleNo||"暂无数据")}</td>
                <td class="px-3 py-3 text-slate-700">${i(s.pieceSetNoRange||"暂无数据")}</td>
                <td class="px-3 py-3 text-slate-700">${st(s)}</td>
                <td class="px-3 py-3">${na(o)}</td>
                <td class="px-3 py-3 text-slate-700">${s.hasSpecialCraft?"是":"无"}</td>
                <td class="px-3 py-3 text-slate-700">${Ae(s.specialCrafts)}</td>
                <td class="px-3 py-3 text-slate-700">${i(s.specialCrafts.map(y=>y.craftType).join(" → ")||"无")}</td>
                <td class="px-3 py-3 text-slate-700">${i(d.completedOperationNames.join(" / ")||"—")}</td>
                <td class="px-3 py-3 text-slate-700">${i(d.currentOperationName)}</td>
                <td class="px-3 py-3 text-slate-700">${i(d.taskOrderNos.join(" / ")||"待绑定")}</td>
                <td class="px-3 py-3 text-slate-700">${x(d.originalQty)}</td>
                <td class="px-3 py-3 text-slate-700">${x(d.currentQty)}</td>
                <td class="px-3 py-3 text-slate-700">${x(d.cumulativeScrapQty)}</td>
                <td class="px-3 py-3 text-slate-700">${x(d.cumulativeDamageQty)}</td>
                <td class="px-3 py-3 text-slate-700">${i(d.receiveDifferenceStatus)}</td>
                <td class="px-3 py-3 text-slate-700">${i(d.returnDifferenceStatus)}</td>
                <td class="px-3 py-3 text-slate-700">${i(Ye(d.dispatchStatus))}</td>
                <td class="px-3 py-3 text-slate-700">${i(d.returnStatus)}</td>
                <td class="px-3 py-3 text-slate-700">${i(d.currentLocation)}</td>
                <td class="px-3 py-3 text-slate-700">${i(((m=l.dispatchBatch)==null?void 0:m.transferOrderNo)||"未装袋")}</td>
                <td class="px-3 py-3 text-slate-700">${i(((f=l.transferBag)==null?void 0:f.transferBagNo)||"未装袋")}</td>
                <td class="px-3 py-3 text-slate-700">${i(l.transferBag?l.transferBag.packStatus:"未装袋")}</td>
                <td class="px-3 py-3 text-slate-700">${i(((u=l.dispatchBatch)==null?void 0:u.handoverRecordNo)||"待提交")}</td>
                <td class="px-3 py-3 text-slate-700">${i(l.feiTicketSewingStatus)}</td>
                <td class="px-3 py-3 text-slate-700">${i(l.transferBag?"已装袋":"未装袋")}</td>
                <td class="px-3 py-3 text-slate-700">${i(["已交出","已回写","差异","异议中"].includes(l.feiTicketSewingStatus)?"已交出":"未交出")}</td>
                <td class="px-3 py-3 text-slate-700">${i(l.feiTicketSewingStatus==="已回写"?"已回写":l.feiTicketSewingStatus==="差异"?"差异":l.feiTicketSewingStatus==="异议中"?"异议中":"待回写")}</td>
                <td class="px-3 py-3 text-slate-700">${i(l.specialCraftReturnStatus)}</td>
                <td class="px-3 py-3 text-slate-700">V${x(s.version)}</td>
                <td class="px-3 py-3">
                  <div class="space-y-1">
                    ${as(s.status)}
                    ${s.downstreamLocked?`<p class="text-xs text-rose-600">${i(s.downstreamLockedReason||"下游已锁定")}</p>`:""}
                  </div>
                </td>
                <td class="px-3 py-3 text-slate-700">${s.boundPocketNo?i(`${s.boundPocketNo} / ${s.boundUsageNo||"待补使用周期号"}`):"未绑定中转袋"}</td>
                <td class="px-3 py-3 text-slate-700">${i(et(s.printedAt))}</td>
                <td class="px-3 py-3 text-slate-700">${i(s.printedBy||"未打印")}</td>
                <td class="px-3 py-3">
                  <div class="flex min-w-[240px] flex-wrap gap-2">
                    ${p.map(y=>`<button type="button" data-nav="${i(y.href)}" class="inline-flex min-h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50">${i(y.label)}</button>`).join("")}
                  </div>
                </td>
              </tr>
            `}).join("")}
      </tbody>
    </table>
  `;return`
    <div class="space-y-4">
      ${Hs(e,r)}
      ${$("已打印菲票","",Ke(a,"max-h-[60vh]"))}
    </div>
  `}function Qs(e){const t=Y(),r=A(),a=oe(r,"fei-ticket-detail"),s=tt(t);if(!s)return H(`
      ${W(a,{actionsHtml:le()?`<div class="flex flex-wrap gap-2">${le()}</div>`:""})}
      ${$("未找到打印单元","",`<div class="space-y-3"><p class="text-sm text-slate-600">请先从菲票进入。</p>${Oe(null)}</div>`)}
    `);const d=Ve({unit:s,cutOrderRows:t.cutOrderRows,materialPrepRows:t.materialPrepRows,markerPlanSources:t.markerPlanSources,markerStore:t.markerStore,ticketRecords:t.ticketRecords,printJobs:t.printJobs}),l=e==="fei-ticket-printed"?"printed":es(r),o=l==="printed"?Gs(s,d):_s(d);return H(`
    ${W(a,{actionsHtml:`<div class="flex flex-wrap gap-2">${Oe(s)}${le()}</div>`})}
    ${qs(d)}
    ${js(s,l)}
    ${o}
  `)}function Vs(e){const t=`
    <table class="min-w-full text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-3 py-3 text-left font-medium">面料卷号</th>
          <th class="px-3 py-3 text-left font-medium">布料颜色</th>
          <th class="px-3 py-3 text-left font-medium">尺码</th>
          <th class="px-3 py-3 text-left font-medium">裁片部位</th>
          <th class="px-3 py-3 text-left font-medium">数量</th>
          <th class="px-3 py-3 text-left font-medium">扎号</th>
          <th class="px-3 py-3 text-left font-medium">配套编号</th>
          <th class="px-3 py-3 text-left font-medium">部位裁片编号范围</th>
          <th class="px-3 py-3 text-left font-medium">特殊工艺</th>
          <th class="px-3 py-3 text-left font-medium">裁片单</th>
          <th class="px-3 py-3 text-left font-medium">当前缺口数</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 bg-white">
        ${e.map(r=>`
              <tr>
                <td class="px-3 py-3 font-medium text-slate-900">${i(r.fabricRollNo||"暂无数据")}</td>
                <td class="px-3 py-3 text-slate-700">${i(r.fabricColor||"暂无数据")}</td>
                <td class="px-3 py-3 text-slate-700">${i(r.size)}</td>
                <td class="px-3 py-3 text-slate-700">${i(r.partName)}</td>
                <td class="px-3 py-3 text-slate-700">${x(r.quantity)}</td>
                <td class="px-3 py-3 text-slate-700">${i(r.bundleNo||"暂无数据")}</td>
                <td class="px-3 py-3 text-slate-700">${i(r.pieceSetNoRange||"暂无数据")}</td>
                <td class="px-3 py-3 text-slate-700">${i(r.pieceSequenceLabel||r.pieceSequenceCannotGenerateReason||"不可生成")}</td>
                <td class="px-3 py-3 text-slate-700">${i(r.specialCraftDisplayLabel||"无")}</td>
                <td class="px-3 py-3 text-slate-700">${i(r.sourceCutOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${x(r.gapCount)}</td>
              </tr>
            `).join("")}
      </tbody>
    </table>
  `;return Ke(t,"max-h-[50vh]")}function Ks(e){const t=e==="fei-ticket-reprint";return`
    <div class="grid gap-4 lg:grid-cols-2">
      <label class="space-y-1 text-sm text-slate-600">
        <span class="font-medium text-slate-700">操作人</span>
        <input type="text" value="${i(n.operationDraft.operator)}" data-cutting-fei-op-field="operator" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />
      </label>
      <label class="space-y-1 text-sm text-slate-600"><span class="font-medium text-slate-700">打印机</span><input type="text" value="${i(n.operationDraft.printerName)}" data-cutting-fei-op-field="printerName" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" /></label>
      <label class="space-y-1 text-sm text-slate-600"><span class="font-medium text-slate-700">模板</span><input type="text" value="${i(n.operationDraft.templateName)}" data-cutting-fei-op-field="templateName" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" /></label>
      <label class="space-y-1 text-sm text-slate-600">
        <span class="font-medium text-slate-700">${t?"原因（必填）":"原因（可选）"}</span>
        <input type="text" value="${i(n.operationDraft.reason)}" data-cutting-fei-op-field="reason" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" placeholder="${t?"请输入原因":"可选填写"}" />
      </label>
      <label class="space-y-1 text-sm text-slate-600 lg:col-span-2">
        <span class="font-medium text-slate-700">备注</span>
        <textarea rows="3" data-cutting-fei-op-field="remark" class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200">${i(n.operationDraft.remark)}</textarea>
      </label>
    </div>
  `}function Ce(e,t,r){const a=oe(A(),r);return H(`
    ${W(a,{actionsHtml:`<div class="flex flex-wrap gap-2">${Oe(t)}${le()}</div>`})}
    ${$("当前操作不可执行","",`<p class="text-sm text-slate-600">${i(e)}</p>`)}
  `)}function Js(e){return e==="fei-ticket-print"?{label:"确认首打",action:"confirm-first-print"}:{label:"确认补打",action:"confirm-reprint"}}function Ys(e){const t=Y(),r=oe(A(),e),a=tt(t);if(!a)return Ce("未找到当前 printableUnit。",null,e);const s=Ve({unit:a,cutOrderRows:t.cutOrderRows,materialPrepRows:t.materialPrepRows,markerPlanSources:t.markerPlanSources,markerStore:t.markerStore,ticketRecords:t.ticketRecords,printJobs:t.printJobs});if(e==="fei-ticket-print"&&a.printableUnitStatus!=="WAITING_PRINT")return Ce("只有待打印状态才能进入首打页。",a,e);if(e==="fei-ticket-reprint"&&a.printableUnitStatus!=="NEED_REPRINT")return Ce("只有需补打状态才能进入补打页。",a,e);const d=e==="fei-ticket-print"||e==="fei-ticket-reprint"?s.missingSplitDetails:[];if(d.filter(m=>!We(m)).length)return Ce("当前存在缺少五维字段的菲票，不能打印。",a,e);const o=d.length,p=Js(e),c=`
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">可打印单元号</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(a.printableUnitNo)}</p></div>
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">单元类型</p><div class="mt-1">${ra(a.printableUnitType)}</div></div>
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">当前状态</p><div class="mt-1">${sa(a.printableUnitStatus)}</div></div>
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">来源裁片单数</p><p class="mt-1 text-sm font-semibold text-slate-900">${x(a.sourceCutOrderCount)}</p></div>
    </div>
  `,b=`
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">本次生成菲票数（张）</p><p class="mt-1 text-sm font-semibold text-slate-900">${x(o)}</p></div>
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">当前缺口总数</p><p class="mt-1 text-sm font-semibold text-slate-900">${x(a.missingTicketCount)}</p></div>
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">最近打印时间</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(et(a.lastPrintedAt))}</p></div>
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">最近打印人</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(a.lastPrintedBy||"未打印")}</p></div>
        </div>
      `;return H(`
    ${W(r,{actionsHtml:`<div class="flex flex-wrap gap-2">${Oe(a)}${le()}</div>`})}
    ${$("当前打印单元基础信息","",`${c}${b}`)}
    ${$("实际裁剪产出明细预览","",Vs(d))}
    ${$("操作设置","",Ks(e))}
    ${$("动作区","",`<div class="flex flex-wrap gap-2"><button type="button" data-cutting-fei-action="${p.action}" class="inline-flex min-h-10 items-center rounded-md border border-blue-600 bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">${i(p.label)}</button><button type="button" data-nav="${i(ve("fei-ticket-detail",a))}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">取消</button></div>`)}
  `)}function Fe(e){const t=e?Ie(e.ticketId):P("fei-tickets");return`<div class="flex flex-wrap gap-2"><button type="button" data-nav="${i(P("fei-tickets"))}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">返回部位菲票打印</button>${e?`<button type="button" data-nav="${i(t)}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">返回详情</button>`:""}</div>`}function Zs(){return`<div class="flex flex-wrap gap-2"><button type="button" data-nav="${i(P("fei-tickets"))}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">返回部位菲票打印</button></div>`}function Xs(){return`<div class="flex flex-wrap gap-2"><button type="button" data-nav="${i(P("binding-fei-tickets"))}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">返回捆条菲票打印</button></div>`}function ut(e){return H(`
    ${W({canonicalPath:P("fei-tickets"),pageTitle:"菲票详情"},{actionsHtml:Fe(null)})}
    ${$("未找到菲票","",`<p class="text-sm text-slate-600">没有找到 ${i(e)} 对应的菲票。</p>`)}
  `)}function j(e){return e.tab==="PRINTED"||e.tab==="NEED_REPRINT"}function ei(e){return e.tab==="NEED_REPRINT"?w("已打印，需补打","border border-amber-200 bg-amber-50 text-amber-700"):j(e)?w("已打印","border border-emerald-200 bg-emerald-50 text-emerald-700"):w("未打印","border border-slate-200 bg-slate-100 text-slate-700")}function K(e){return e.hasSpecialCraft?"YELLOW":"WHITE"}function ue(e){return e.generated.sourceBasisType===Wt}function ti(e){return ue(e)&&e.tab==="WAIT_FIRST"&&!e.record}function Me(e){return e.hasSpecialCraft?(e.generated.specialCrafts||[]).some(t=>!t.receiverFactoryId||t.receiverFactoryId==="PENDING-SPECIAL-CRAFT-FACTORY"||!t.receiverFactoryName||t.receiverFactoryName.includes("待补")):!1}function pt(e,t,r){const a=Array.isArray(e)?e:[e],s=t||(a.every(j)?"FEI_TICKET_REPRINT_LABEL":"FEI_TICKET_LABEL"),d=r||K(a[0]),l=a.map(o=>{var p;return((p=o.record)==null?void 0:p.ticketRecordId)||o.generated.feiTicketId||o.generated.feiTicketNo||o.ticketNo}).filter(Boolean);return`/fcs/print/preview?documentType=${s}&sourceType=FEI_TICKET_RECORD&sourceId=${encodeURIComponent(l.join(","))}&paperColor=${d}`}function $a(e,t){const r=t==="missing"?e.filter(o=>!j(o)):e,a=r[0]?Ie(`spreading:${de(r[0])}`):"/fcs/craft/cutting/fei-tickets";if(!r.length)return a;const s=N(r.map(K)),d=N(r.map(o=>j(o)?"PRINTED":"WAIT_FIRST"));if(s.length!==1||d.length!==1||r.some(Me))return a;const l=d[0]==="PRINTED"?"FEI_TICKET_REPRINT_LABEL":"FEI_TICKET_LABEL";return pt(r,l,s[0])}function ai(e){const t=e.detailRows.filter(s=>K(s)==="WHITE"),r=e.detailRows.filter(s=>K(s)==="YELLOW");if(n.detail.scopeKey!==e.spreadingKey){n.detail={...n.detail,scopeKey:e.spreadingKey,paperColor:t.length?"WHITE":"YELLOW",sourceFilter:"ALL",keyword:"",page:1,selectedTicketIds:[],dialogMode:null,dialogTicketId:"",printRequest:null};return}n.detail.paperColor==="WHITE"&&!t.length&&r.length&&(n.detail.paperColor="YELLOW"),n.detail.paperColor==="YELLOW"&&!r.length&&t.length&&(n.detail.paperColor="WHITE");const a=new Set(e.detailRows.map(s=>s.ticketId));n.detail.selectedTicketIds=n.detail.selectedTicketIds.filter(s=>a.has(s))}function ye(e){const t=n.detail.keyword.trim().toLocaleLowerCase("zh-CN");return e.detailRows.filter(r=>K(r)!==n.detail.paperColor||n.detail.sourceFilter==="MANUAL"&&!ue(r)||n.detail.sourceFilter==="SYSTEM"&&ue(r)?!1:t?[r.ticketNo,r.partName,r.size,r.productionOrderNo,r.cutOrderNo,r.generated.applicableSkuLabel,...r.specialCraftLines,...r.receiverFactoryLines].join(" ").toLocaleLowerCase("zh-CN").includes(t):!0)}function ri(){const e=/^\/fcs\/craft\/cutting\/fei-tickets\/([^/]+)$/.exec(A());return e?ua(Y(),e[1]):null}function ze(e,t){if(!e.length){n.feedback={tone:"error",message:`${t}没有符合条件的菲票。`};return}const r=N(e.map(K));if(r.length!==1){n.feedback={tone:"error",message:"一次打印只能包含同一种纸张的菲票，请分别在白纸和黄纸 Tab 操作。"};return}const a=N(e.map(o=>j(o)?"PRINTED":"WAIT_FIRST"));if(a.length!==1){n.feedback={tone:"error",message:"首次打印与补打不能合并为同一打印任务，请分开操作。"};return}const s=e.find(Me);if(s){n.feedback={tone:"error",message:`${s.ticketNo} 存在特殊工艺但尚未明确承接工厂，已阻断正式打印。`};return}const d=r[0],l=a[0]==="PRINTED"?"FEI_TICKET_REPRINT_LABEL":"FEI_TICKET_LABEL";n.feedback=null,n.detail.printRequest={href:pt(e,l,d),paperColor:d,ticketCount:e.length,modeLabel:t,requiresReason:l==="FEI_TICKET_REPRINT_LABEL",reason:""}}function si(e){const t=e.filter(s=>!j(s)).length,r=e.filter(j).length,a=n.detail.selectedTicketIds.length;return`
    <div class="flex flex-wrap gap-2">
      <button type="button" data-cutting-fei-action="open-detail-add" ${e.length?"":"disabled"} class="inline-flex min-h-9 items-center rounded-md border border-orange-500 bg-orange-500 px-3 text-xs font-medium text-white disabled:border-slate-200 disabled:bg-slate-200">新增菲票</button>
      <button type="button" data-cutting-fei-action="request-detail-selected-print" ${a?"":"disabled"} class="inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-medium ${a?"border-blue-600 bg-blue-600 text-white hover:bg-blue-700":"border-slate-200 bg-slate-100 text-slate-400"}">批量打印${a?`（${a}）`:""}</button>
      <button type="button" data-cutting-fei-action="request-detail-all-print" ${t?"":"disabled"} class="inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-medium ${t?"border-blue-600 bg-white text-blue-700 hover:bg-blue-50":"border-slate-200 bg-slate-100 text-slate-400"}">全部打印（${t}）</button>
      <button type="button" data-cutting-fei-action="request-detail-all-reprint" ${r?"":"disabled"} class="inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-medium ${r?"border-slate-300 bg-white text-slate-700 hover:bg-slate-50":"border-slate-200 bg-slate-100 text-slate-400"}">补打（${r}）</button>
    </div>
  `}function ii(e){if(n.detail.paperColor==="WHITE")return'<div class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"><strong>白色热敏纸：</strong>当前仅展示没有特殊工艺的部位菲票。打印前请确认打印机已装入白色热敏纸。</div>';const t=e.filter(Me).length;return`<div class="rounded-lg border ${t?"border-rose-300 bg-rose-50 text-rose-800":"border-amber-300 bg-amber-50 text-amber-900"} px-4 py-3 text-sm"><strong>黄色热敏纸：</strong>当前仅展示含辅助工艺或特种工艺的部位菲票。打印前请确认打印机已装入黄色热敏纸。${t?` 有 ${t} 张菲票缺少承接工厂，正式打印已阻断。`:""}</div>`}function ni(e){const t=Math.max(Math.ceil(e.length/n.detail.pageSize),1);n.detail.page=Math.min(Math.max(n.detail.page,1),t);const r=(n.detail.page-1)*n.detail.pageSize,a=e.slice(r,r+n.detail.pageSize),s=a.map(o=>o.ticketId),d=s.length>0&&s.every(o=>n.detail.selectedTicketIds.includes(o)),l=n.detail.paperColor==="YELLOW";return a.length?`
    <div class="overflow-x-auto rounded-lg border border-slate-200">
      <table class="min-w-[1180px] w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs text-slate-600"><tr>
          <th class="px-3 py-2"><input type="checkbox" data-cutting-fei-action="toggle-detail-page-selection" ${d?"checked":""} aria-label="选择当前页" /></th>
          <th class="px-3 py-2">部位 / 尺码 / 菲票号</th>
          <th class="px-3 py-2">适用成衣 SKU</th>
          <th class="px-3 py-2">裁片数量</th>
          <th class="px-3 py-2">部位裁片编号范围</th>
          <th class="px-3 py-2">来源</th>
          ${l?'<th class="px-3 py-2">特殊工艺 / 承接工厂</th>':""}
          <th class="px-3 py-2">打印状态</th>
          <th class="px-3 py-2">建票方式</th>
          <th class="px-3 py-2 text-right">操作</th>
        </tr></thead>
        <tbody class="divide-y divide-slate-100 bg-white">
          ${a.map(o=>{const p=n.detail.selectedTicketIds.includes(o.ticketId),c=ti(o),b=Me(o);return`<tr class="align-top">
              <td class="px-3 py-3"><input type="checkbox" data-cutting-fei-detail-select="${i(o.ticketId)}" ${p?"checked":""} aria-label="选择 ${i(o.ticketNo)}" /></td>
              <td class="px-3 py-3"><p class="font-semibold text-slate-900">${i(o.partName||"待补部位")} / ${i(o.size||"待补尺码")}</p><p class="mt-1 font-mono text-xs text-slate-500">${i(o.ticketNo)}</p></td>
              <td class="px-3 py-3 text-slate-700">${i(o.generated.applicableSkuLabel||k(o.generated.applicableSkuCodes||[],3)||"待补")}</td>
              <td class="px-3 py-3 font-semibold text-slate-900">${x(o.pieceQty)} 片</td>
              <td class="px-3 py-3 text-slate-700">${i(o.pieceSequenceLabel||"不可生成")}</td>
              <td class="px-3 py-3"><p class="font-medium text-slate-800">${i(o.cutOrderNo||"无裁片单")}</p><p class="mt-1 text-xs text-slate-500">${i(o.productionOrderNo||"待补生产单")}</p></td>
              ${l?`<td class="px-3 py-3"><p class="font-semibold text-amber-900">${i(k(o.specialCraftLines,3))}</p><p class="mt-1 text-xs ${b?"font-semibold text-rose-700":"text-slate-500"}">${i(k(o.receiverFactoryLines,3))}${b?"（禁止打印）":""}</p></td>`:""}
              <td class="px-3 py-3">${ei(o)}</td>
              <td class="px-3 py-3">${w(ue(o)?"手动增加":"系统生成",ue(o)?"border border-orange-200 bg-orange-50 text-orange-700":"border border-slate-200 bg-slate-50 text-slate-600")}<p class="mt-1 text-xs text-slate-500">${i(o.generated.manualRemark||"")}</p></td>
              <td class="px-3 py-3"><div class="flex flex-wrap justify-end gap-1.5">
                <button type="button" data-cutting-fei-action="request-detail-row-print" data-ticket-id="${i(o.ticketId)}" class="inline-flex min-h-8 items-center rounded-md border border-blue-600 bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700">${j(o)?"补打":"打印"}</button>
                ${c?`<button type="button" data-cutting-fei-action="open-detail-edit" data-ticket-id="${i(o.ticketId)}" class="inline-flex min-h-8 items-center rounded-md border border-amber-300 bg-amber-50 px-2.5 text-xs font-medium text-amber-800">修改数量</button>`:""}
                <button type="button" data-cutting-fei-action="open-detail-single" data-ticket-id="${i(o.ticketId)}" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700">单条详情</button>
                ${c?`<button type="button" data-cutting-fei-action="open-detail-delete" data-ticket-id="${i(o.ticketId)}" class="inline-flex min-h-8 items-center rounded-md border border-rose-200 bg-white px-2.5 text-xs font-medium text-rose-700">删除</button>`:""}
              </div></td>
            </tr>`}).join("")}
        </tbody>
      </table>
    </div>
    <div class="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"><span>共 ${e.length} 条，第 ${n.detail.page} / ${t} 页，每页 ${n.detail.pageSize} 条</span><div class="flex gap-2"><button type="button" data-cutting-fei-action="detail-prev-page" ${n.detail.page<=1?"disabled":""} class="rounded-md border px-3 py-1.5 disabled:bg-slate-100 disabled:text-slate-400">上一页</button><button type="button" data-cutting-fei-action="detail-next-page" ${n.detail.page>=t?"disabled":""} class="rounded-md border px-3 py-1.5 disabled:bg-slate-100 disabled:text-slate-400">下一页</button></div></div>
  `:'<div class="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">当前纸张分类和筛选条件下没有菲票。</div>'}function li(e){const t=n.detail.dialogMode;if(!t)return"";const r=ye(e),a=e.detailRows.find(l=>l.ticketId===n.detail.dialogTicketId)||r[0]||null,s='<button type="button" data-cutting-fei-action="close-detail-dialog" class="rounded-md border px-4 py-2 text-sm">取消</button>';if(t==="ADD")return`<div class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/55 p-4"><div class="w-full max-w-xl rounded-xl bg-white shadow-2xl"><div class="border-b px-5 py-4"><h3 class="text-lg font-semibold">新增菲票</h3><p class="mt-1 text-sm text-slate-500">从当前${n.detail.paperColor==="WHITE"?"白纸":"黄纸"}分类选择一个现有部位对象，新增一张未打印菲票。</p></div><div class="space-y-4 p-5"><label class="block space-y-1 text-sm"><span>菲票对象</span><select data-cutting-fei-detail-dialog-field="ticketId" class="h-10 w-full rounded-md border px-3">${r.map(l=>`<option value="${i(l.ticketId)}" ${l.ticketId===(a==null?void 0:a.ticketId)?"selected":""}>${i(`${l.partName} / ${l.size} / ${l.ticketNo}`)}</option>`).join("")}</select></label><label class="block space-y-1 text-sm"><span>数量（片）</span><input type="number" min="1" step="1" data-cutting-fei-detail-dialog-field="qty" value="${Math.max(n.detail.dialogQty,1)}" class="h-10 w-full rounded-md border px-3" /></label><label class="block space-y-1 text-sm"><span>备注</span><input data-cutting-fei-detail-dialog-field="remark" value="${i(n.detail.dialogRemark)}" class="h-10 w-full rounded-md border px-3" placeholder="请填写新增原因" /></label></div><div class="flex justify-end gap-3 border-t px-5 py-4">${s}<button type="button" data-cutting-fei-action="confirm-detail-add" ${a?"":"disabled"} class="rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-200">确定新增</button></div></div></div>`;if(!a)return"";if(t==="EDIT")return`<div class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/55 p-4"><div class="w-full max-w-lg rounded-xl bg-white shadow-2xl"><div class="border-b px-5 py-4"><h3 class="text-lg font-semibold">修改数量 · ${i(a.ticketNo)}</h3><p class="mt-1 text-sm text-amber-700">仅未打印的手动菲票可修改；修改后二维码数量和编号范围同步更新。</p></div><div class="space-y-4 p-5"><label class="block space-y-1 text-sm"><span>数量（片）</span><input type="number" min="1" step="1" data-cutting-fei-detail-dialog-field="qty" value="${Math.max(n.detail.dialogQty,1)}" class="h-10 w-full rounded-md border px-3" /></label><label class="block space-y-1 text-sm"><span>修改原因 <em class="text-rose-600">*</em></span><input data-cutting-fei-detail-dialog-field="remark" value="${i(n.detail.dialogRemark)}" class="h-10 w-full rounded-md border px-3" placeholder="请填写修改数量原因" /></label></div><div class="flex justify-end gap-3 border-t px-5 py-4">${s}<button type="button" data-cutting-fei-action="confirm-detail-edit" ${n.detail.dialogRemark.trim()?"":"disabled"} class="rounded-md border px-4 py-2 text-sm font-medium ${n.detail.dialogRemark.trim()?"border-blue-600 bg-blue-600 text-white":"border-slate-200 bg-slate-100 text-slate-400"}">确认修改</button></div></div></div>`;if(t==="DELETE")return`<div class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/55 p-4"><div class="w-full max-w-lg rounded-xl bg-white shadow-2xl"><div class="border-b px-5 py-4"><h3 class="text-lg font-semibold text-rose-700">删除未打印菲票</h3></div><div class="p-5 text-sm text-slate-700">确认删除手动菲票 <strong>${i(a.ticketNo)}</strong>？已打印、已交接或系统生成的历史菲票不提供删除入口。</div><div class="flex justify-end gap-3 border-t px-5 py-4">${s}<button type="button" data-cutting-fei-action="confirm-detail-delete" class="rounded-md border border-rose-600 bg-rose-600 px-4 py-2 text-sm font-medium text-white">确认删除</button></div></div></div>`;const d=vr(a.generated.feiTicketId);return`<div class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/55 p-4"><div class="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl"><div class="border-b px-5 py-4"><h3 class="text-lg font-semibold">单条详情 · ${i(a.ticketNo)}</h3></div><div class="grid gap-3 p-5 md:grid-cols-2"><div class="rounded-lg border p-3"><p class="text-xs text-slate-500">部位 / 尺码</p><p class="mt-1 font-semibold">${i(a.partName)} / ${i(a.size)}</p></div><div class="rounded-lg border p-3"><p class="text-xs text-slate-500">数量 / 状态</p><p class="mt-1 font-semibold">${x(a.pieceQty)} 片 / ${i(a.printStatusLabel)}</p></div><div class="rounded-lg border p-3"><p class="text-xs text-slate-500">建票来源</p><p class="mt-1 font-semibold">${ue(a)?"手动唛架建票 / 无铺布单":"实际裁剪产出 / 系统生成"}</p></div><div class="rounded-lg border p-3"><p class="text-xs text-slate-500">打印用纸</p><p class="mt-1 font-semibold">${K(a)==="WHITE"?"白色热敏纸":"黄色热敏纸"}</p></div>${a.hasSpecialCraft?`<div class="rounded-lg border border-amber-200 bg-amber-50 p-3 md:col-span-2"><p class="text-xs text-amber-700">特殊工艺 / 承接工厂</p><p class="mt-1 font-semibold text-amber-950">${i(k(a.specialCraftLines,5))} / ${i(k(a.receiverFactoryLines,5))}</p></div>`:""}<div class="rounded-lg border p-3 md:col-span-2"><p class="text-xs text-slate-500">操作记录</p>${d.length?`<ul class="mt-2 space-y-2 text-sm">${d.map(l=>`<li><strong>${i(l.action)}</strong> · ${i(l.operatedAt)} · ${i(l.operatedBy)}<br/><span class="text-slate-600">${i(l.detail)}</span></li>`).join("")}</ul>`:'<p class="mt-1 text-sm text-slate-500">系统生成菲票，无手动变更记录。</p>'}</div></div><div class="flex justify-end border-t px-5 py-4"><button type="button" data-cutting-fei-action="close-detail-dialog" class="rounded-md border px-4 py-2 text-sm">关闭</button></div></div></div>`}function oi(){const e=n.detail.printRequest;if(!e)return"";const t=e.paperColor==="WHITE"?"白色热敏纸":"黄色热敏纸",r=e.paperColor==="WHITE"?"border-blue-300 bg-blue-50 text-blue-900":"border-amber-400 bg-amber-50 text-amber-950",a=!e.requiresReason||!!e.reason.trim();return`<div class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-4"><div class="w-full max-w-lg rounded-xl bg-white shadow-2xl"><div class="border-b px-5 py-4"><h3 class="text-lg font-semibold">${e.requiresReason?"补打原因与纸张确认":"打印前确认"}</h3></div><div class="space-y-4 p-5"><div class="rounded-lg border ${r} p-4"><p class="text-lg font-bold">请装入${t}</p><p class="mt-2 text-sm">${i(e.modeLabel)}共 ${e.ticketCount} 张。浏览器无法识别打印机中的纸张，必须由现场人员确认。</p></div>${e.requiresReason?`<label class="block space-y-1 text-sm"><span>补打原因 <em class="text-rose-600">*</em></span><input data-cutting-fei-detail-print-field="reason" value="${i(e.reason)}" class="h-10 w-full rounded-md border px-3" placeholder="请填写菲票丢失、破损或打印不清晰等原因" /></label>`:""}<p class="text-sm text-slate-600">确认后进入打印预览；白纸和黄纸不会被合并为同一打印任务。</p></div><div class="flex justify-end gap-3 border-t px-5 py-4"><button type="button" data-cutting-fei-action="cancel-detail-print" class="rounded-md border px-4 py-2 text-sm">取消</button><button type="button" data-cutting-fei-action="confirm-detail-print" ${a?"":"disabled"} class="rounded-md border px-4 py-2 text-sm font-medium ${a?"border-blue-600 bg-blue-600 text-white":"border-slate-200 bg-slate-100 text-slate-400"}">已装入${t}，进入预览</button></div></div></div>`}function di(e){const t=ye(e),r=e.detailRows.filter(s=>K(s)==="WHITE").length,a=e.detailRows.filter(s=>K(s)==="YELLOW").length;return`
    <section class="rounded-lg border bg-white shadow-sm">
      <div class="border-b border-slate-200 px-4 pt-4">
        <div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-sm font-semibold text-slate-900">${e.isManualBatch?"该手动建票批次":"该铺布单"}下全部部位明细</h2><p class="mt-1 text-xs text-slate-500">特殊工艺包括辅助工艺和特种工艺；系统按每张菲票事实分纸。</p></div>${si(t)}</div>
        <div class="mt-4 flex flex-wrap gap-2"><button type="button" data-cutting-fei-action="set-detail-paper" data-paper-color="WHITE" class="rounded-t-lg border px-4 py-2 text-sm font-medium ${n.detail.paperColor==="WHITE"?"border-blue-400 bg-blue-50 text-blue-700":"border-slate-200 bg-white text-slate-600"}">无特殊工艺 · 白色热敏纸（${r}）</button><button type="button" data-cutting-fei-action="set-detail-paper" data-paper-color="YELLOW" class="rounded-t-lg border px-4 py-2 text-sm font-medium ${n.detail.paperColor==="YELLOW"?"border-amber-400 bg-amber-50 text-amber-800":"border-slate-200 bg-white text-slate-600"}">有特殊工艺 · 黄色热敏纸（${a}）</button></div>
      </div>
      <div class="space-y-4 p-4">
        ${ii(t)}
        <div class="grid gap-3 md:grid-cols-[13rem_1fr_auto]"><label class="space-y-1 text-sm"><span class="text-slate-500">建票方式</span><select data-cutting-fei-detail-field="sourceFilter" class="h-10 w-full rounded-md border px-3"><option value="ALL" ${n.detail.sourceFilter==="ALL"?"selected":""}>全部</option><option value="SYSTEM" ${n.detail.sourceFilter==="SYSTEM"?"selected":""}>系统生成</option><option value="MANUAL" ${n.detail.sourceFilter==="MANUAL"?"selected":""}>手动增加</option></select></label><label class="space-y-1 text-sm"><span class="text-slate-500">搜索</span><input data-cutting-fei-detail-field="keyword" value="${i(n.detail.keyword)}" class="h-10 w-full rounded-md border px-3" placeholder="菲票号 / 部位 / 尺码 / SKU / 生产单" /></label><button type="button" data-cutting-fei-action="reset-detail-filters" class="mt-6 h-10 rounded-md border px-4 text-sm">重置</button></div>
        ${ni(t)}
      </div>
    </section>
    ${li(e)}
    ${oi()}
  `}function ci(e){return ai(e),`
    ${$(e.isManualBatch?"手动建票批次概况":"铺布单菲票概况","",`
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">${e.isManualBatch?"建票来源":"铺布单"}</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(e.isManualBatch?"手动唛架建票 / 无铺布单":e.spreadingOrderNo)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">唛架方案 / 编号</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(e.markerPlanNo)} / ${i(e.markerNumber)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">菲票明细</p><p class="mt-1 text-sm font-semibold text-slate-900">${x(e.ticketCount)} 条</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">裁片数量</p><p class="mt-1 text-sm font-semibold text-slate-900">${x(e.totalPieceQty)} 片</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">打印状态</p><div class="mt-1">${xa(e)}</div></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">是否有特殊工艺</p><p class="mt-1 text-sm font-semibold text-slate-900">${e.hasSpecialCraft?"是":"无"}</p></div>
      </div>
    `)}
    ${$("来源与工艺概况","",`
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">生产单</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(k(e.productionOrderNos,6))}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">裁片单</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(k(e.cutOrderNos,6))}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">SPU / 颜色</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(k(e.spuCodes,4))} / ${i(k(e.colors,4))}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">辅助工艺、特种工艺 / 承接工厂</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(k(e.specialCraftLines,4))}</p><p class="mt-1 text-xs text-slate-500">${i(k(e.receiverFactoryLines,4))}</p></div>
      </div>
    `)}
    ${di(e)}
  `}function Sa(e){var t;return e.record?{...e.generated,...e.record,specialCrafts:(t=e.generated.specialCrafts)!=null&&t.length?e.generated.specialCrafts:e.record.specialCrafts,pieceSequenceRange:e.generated.pieceSequenceRange||e.record.pieceSequenceRange,pieceSequenceLabel:e.generated.pieceSequenceLabel||e.record.pieceSequenceLabel,applicableSkuCodes:e.generated.applicableSkuCodes,applicableSkuLabel:e.generated.applicableSkuLabel,assemblyGroupKey:e.generated.assemblyGroupKey,siblingPartTicketNos:e.generated.siblingPartTicketNos,garmentInstanceNo:e.generated.garmentInstanceNo,layerCount:e.generated.layerCount,businessSizeLabel:e.generated.businessSizeLabel,partQuantityPerGarment:e.generated.partQuantityPerGarment,materialIdentity:e.generated.materialIdentity,patternIdentity:e.generated.patternIdentity,markerNumber:e.generated.markerNumber,spreadingOrderNo:e.generated.spreadingOrderNo,sourceTechPackSpuCode:e.generated.sourceTechPackSpuCode}:e.generated}function ui(e){var d,l,o,p,c,b,m,f,u,y,g;const t=Sa(e),r=Vt(t),a=_r(e),s=zr(e,r);return`
    ${$("基本信息","",`
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">菲票号</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(e.ticketNo)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">版本</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(e.versionLabel)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">打印状态</p><div class="mt-1">${xs(e)}</div></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">生成时间 / 生成人</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(e.generated.issuedAt||"待补")} / ${i((d=e.record)!=null&&d.printedBy||(l=e.generated.qrPayload)!=null&&l.generatedAt?"系统生成":"待补")}</p></div>
      </div>
    `)}
    ${$("来源信息","",`
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">生产单 / 裁片单</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(e.productionOrderNo)} / ${i(e.cutOrderNo)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">面料</p>${he({materialSku:((o=e.generated.materialIdentity)==null?void 0:o.materialSku)||e.generated.materialSku,materialLabel:((p=e.generated.materialIdentity)==null?void 0:p.materialName)||e.generated.materialSku,materialAlias:(c=e.generated.materialIdentity)==null?void 0:c.materialAlias,materialImageUrl:(b=e.generated.materialIdentity)==null?void 0:b.materialImageUrl,materialColor:(m=e.generated.materialIdentity)==null?void 0:m.materialColor},{compact:!0})}</div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">纸样</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(((f=e.generated.patternIdentity)==null?void 0:f.patternFileName)||"待补纸样")}</p><p class="mt-1 text-xs text-slate-500">${i(`${((u=e.generated.patternIdentity)==null?void 0:u.patternVersion)||"待补版本"} / ${((y=e.generated.patternIdentity)==null?void 0:y.effectiveWidthValue)||""}${((g=e.generated.patternIdentity)==null?void 0:g.effectiveWidthUnit)||""}`)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">唛架方案 / 唛架编号</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(e.markerPlanNo||"待补")} / ${i(e.markerNumber||"待补")}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">铺布单</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(e.spreadingOrderNo||"待补")}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">裁剪产出来源</p>${a.length?a.map((S,I)=>`<p class="${I===0?"mt-1 text-sm font-semibold text-slate-900":"mt-1 text-xs text-slate-600"}">${i(S)}</p>`).join(""):'<p class="mt-1 text-sm font-semibold text-slate-900">待补充裁剪产出</p>'}</div>
      </div>
    `)}
    ${$("裁片信息","",`
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">颜色</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(e.color)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">尺码</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(e.size)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">部位</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(e.partName)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">裁片数量</p><p class="mt-1 text-sm font-semibold text-slate-900">${x(e.pieceQty)} 片</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">部位裁片编号范围</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(e.pieceSequenceLabel)}</p></div>
      </div>
    `)}
    ${$("特殊工艺","",`
      <div class="grid gap-3 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">是否有特殊工艺</p><p class="mt-1 text-sm font-semibold text-slate-900">${e.hasSpecialCraft?"是":"无"}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">承接工厂</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(k(e.receiverFactoryLines,4))}</p></div>
        <div class="md:col-span-2 rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">特殊工艺明细</p><div class="mt-2">${Ae(e.generated.specialCrafts)}</div></div>
      </div>
    `)}
    ${$("二维码信息","",`
      <div class="grid gap-4 md:grid-cols-[160px_1fr]">
        <div>
          ${Re({value:r.qrDisplayValue,size:140,title:"菲票二维码",label:`菲票 ${e.ticketNo}`})}
          <p class="mt-2 text-center text-xs text-slate-500">二维码预览</p>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">二维码版本</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(r.qrPayload.payloadVersion)}</p></div>
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">业务类型</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(r.qrPayload.qrType||"菲票")}</p></div>
          <div class="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">业务追踪信息</p>${s.map((S,I)=>`<p class="${I===0?"mt-1 text-sm font-semibold text-slate-900":"mt-1 text-xs text-slate-600"}">${i(S)}</p>`).join("")}</div>
        </div>
      </div>
    `)}
    ${$("打印信息","",`
      <div class="grid gap-3 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">首次打印时间</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(e.firstPrintedAt||"未打印")}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">最近补打时间</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(e.latestReprintAt||"无")}</p></div>
      </div>
    `)}
	  `}function pi(e){const t=Ne(e),r=t.startsWith("binding:")?t.replace(/^binding:/,""):t;return Gt().find(a=>a.bindingOrderId===t||a.bindingOrderId===r||a.bindingOrderNo===r||a.bindingDetails.some(s=>s.feiTicketId===r||s.feiTicketNo===r||s.detailId===r))||null}function mi(e){return e.printStatus==="已打印"?w("已打印","border border-emerald-200 bg-emerald-50 text-emerald-700"):w("待打印","border border-slate-200 bg-slate-100 text-slate-700")}function bi(e){const t=ba(ae(e));return t==="PRINTED"?w("已打印","border border-emerald-200 bg-emerald-50 text-emerald-700"):t==="NEED_REPRINT"?w("部分已打印","border border-amber-200 bg-amber-50 text-amber-700"):w("待打印","border border-slate-200 bg-slate-100 text-slate-700")}function fi(e){const t=ae(e),r=t.filter(d=>E(d)==="WHITE"),a=t.filter(d=>E(d)==="YELLOW"),s=`binding-detail:${e.bindingOrderId}`;if(n.detail.scopeKey!==s){n.detail={...n.detail,scopeKey:s,paperColor:r.length?"WHITE":"YELLOW",sourceFilter:"ALL",keyword:"",page:1,selectedTicketIds:[],dialogMode:null,dialogTicketId:"",printRequest:null};return}n.detail.paperColor==="WHITE"&&!r.length&&a.length&&(n.detail.paperColor="YELLOW"),n.detail.paperColor==="YELLOW"&&!a.length&&r.length&&(n.detail.paperColor="WHITE")}function gi(e){const t=n.detail.keyword.trim().toLocaleLowerCase("zh-CN");return ae(e).filter(r=>E(r)!==n.detail.paperColor?!1:t?[r.feiTicketNo,r.bindingStripName,r.cuttingMethod,r.cuttingMethodIndonesian,e.sourceProductionOrderNo,e.sourceCutOrderNo,e.materialIdentity.materialSku,r.requiresButtonLoop?"盘扣 黄色热敏纸 APF 辅助工艺 中央辅料仓":"普通捆条 白色热敏纸"].join(" ").toLocaleLowerCase("zh-CN").includes(t):!0)}function xi(e){const t=n.detail.paperColor,r=t==="WHITE"?"打印当前普通白票":"打印当前盘扣黄票",a=t==="WHITE"?"border-blue-600 bg-blue-600 text-white hover:bg-blue-700":"border-amber-500 bg-amber-400 text-amber-950 hover:bg-amber-500";return e.length?`<button type="button" data-nav="${i(ke(e,t))}" class="inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-semibold ${a}">${r}（${x(e.length)}）</button>`:`<button type="button" disabled class="inline-flex min-h-9 items-center rounded-md border border-slate-200 bg-slate-100 px-3 text-xs font-medium text-slate-400">${r}（0）</button>`}function yi(){return n.detail.paperColor==="WHITE"?'<div class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"><strong>白色热敏纸：</strong>当前仅展示不需要做盘扣、直接用于衣服的捆条菲票。打印前请确认打印机已装入白色热敏纸。</div>':'<div class="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>黄色热敏纸：</strong>当前仅展示需要做盘扣的捆条菲票；票面标记盘扣、APF - 辅助工艺和中央辅料仓。打印前请确认打印机已装入黄色热敏纸。</div>'}function hi(e){const t=Math.max(Math.ceil(e.length/n.detail.pageSize),1);n.detail.page=Math.min(Math.max(n.detail.page,1),t);const r=(n.detail.page-1)*n.detail.pageSize,a=e.slice(r,r+n.detail.pageSize);return a.length?`
    <div class="overflow-x-auto rounded-lg border border-slate-200">
      <table class="min-w-[1180px] w-full text-left text-sm" data-binding-fei-detail-table>
        <thead class="bg-slate-50 text-xs text-slate-600"><tr>
          <th class="px-3 py-2">捆条 / 菲票号</th>
          <th class="px-3 py-2">盘扣 / 打印用纸</th>
          <th class="px-3 py-2">宽度 / 切割方式</th>
          <th class="px-3 py-2">捆条需要 / 实际完成</th>
          <th class="px-3 py-2">需要布料 / 已接收</th>
          <th class="px-3 py-2">每卷长度 / 实切卷数</th>
          <th class="px-3 py-2">切割长度</th>
          <th class="px-3 py-2">打印状态</th>
          <th class="px-3 py-2 text-right">操作</th>
        </tr></thead>
        <tbody class="divide-y divide-slate-100 bg-white">
          ${a.map(s=>`
            <tr class="align-top" data-binding-fei-detail-paper="${E(s)}">
              <td class="px-3 py-3"><p class="font-semibold text-slate-900">${i(s.bindingStripName)}</p><p class="mt-1 font-mono text-xs text-slate-500">${i(s.feiTicketNo)}</p></td>
              <td class="px-3 py-3">${w(s.requiresButtonLoop?"需要盘扣":"不需要盘扣",s.requiresButtonLoop?"border border-amber-300 bg-amber-50 text-amber-800":"border border-slate-200 bg-slate-50 text-slate-600")}<p class="mt-1 text-xs ${s.requiresButtonLoop?"font-medium text-amber-800":"text-slate-500"}">${s.requiresButtonLoop?"黄色热敏纸 · APF - 辅助工艺 · 中央辅料仓":"白色热敏纸 · 衣服捆条"}</p></td>
              <td class="px-3 py-3"><p class="font-semibold text-slate-900">${i(`${s.bindingWidth} cm / ${s.cuttingMethod}`)}</p><p class="mt-1 text-xs text-slate-500">${i(s.cuttingMethodIndonesian)}</p></td>
              <td class="px-3 py-3"><p class="font-semibold text-slate-900">${i(F(s.plannedBindingLength))} / ${i(s.actualLength?F(s.actualLength):"待回写")}</p></td>
              <td class="px-3 py-3"><p class="font-semibold text-slate-900">${i(F(s.requiredLength))} / ${i(s.receivedMaterialLength?F(s.receivedMaterialLength):"待记录")}</p></td>
              <td class="px-3 py-3"><p class="font-semibold text-slate-900">${i(`${Ge(s)?F(Ge(s)):"待记录"} / ${x(s.actualRollCount)} 卷`)}</p><p class="mt-1 text-xs text-slate-500">切割长度 = 每卷长度 × 实切卷数</p></td>
              <td class="px-3 py-3"><p class="font-semibold text-slate-900">${i(`${s.cuttingMethod} ${Rt(s)?F(Rt(s)):"待记录"}`)}</p></td>
              <td class="px-3 py-3">${mi(s)}<p class="mt-1 text-xs text-slate-500">${i(s.sufficiencyStatus)}${s.shortageLength?` / 缺口 ${i(F(s.shortageLength))}`:""}</p></td>
              <td class="px-3 py-3"><div class="flex justify-end"><button type="button" data-nav="${i(fa(s))}" class="inline-flex min-h-8 items-center rounded-md border px-2.5 text-xs font-medium ${s.requiresButtonLoop?"border-amber-500 bg-amber-400 text-amber-950 hover:bg-amber-500":"border-blue-600 bg-blue-600 text-white hover:bg-blue-700"}">${s.printStatus==="已打印"?"补打":"打印"}</button></div></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <div class="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"><span>共 ${x(e.length)} 条，第 ${n.detail.page} / ${t} 页，每页 ${n.detail.pageSize} 条</span><div class="flex gap-2"><button type="button" data-cutting-fei-action="detail-prev-page" ${n.detail.page<=1?"disabled":""} class="rounded-md border px-3 py-1.5 disabled:bg-slate-100 disabled:text-slate-400">上一页</button><button type="button" data-cutting-fei-action="detail-next-page" ${n.detail.page>=t?"disabled":""} class="rounded-md border px-3 py-1.5 disabled:bg-slate-100 disabled:text-slate-400">下一页</button></div></div>
  `:'<div class="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">当前纸张分类和筛选条件下没有捆条菲票。</div>'}function vi(e){const t=ae(e),r=t.filter(d=>E(d)==="WHITE").length,a=t.filter(d=>E(d)==="YELLOW").length,s=gi(e);return`
    <section class="rounded-lg border bg-white shadow-sm" data-binding-fei-detail-section>
      <div class="border-b border-slate-200 px-4 pt-4">
        <div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-sm font-semibold text-slate-900">该捆条加工单下全部菲票明细</h2><p class="mt-1 text-xs text-slate-500">沿用部位打印页结构；普通捆条和盘扣捆条仍按每张菲票事实分纸。</p></div>${xi(s)}</div>
        <div class="mt-4 flex flex-wrap gap-2"><button type="button" data-cutting-fei-action="set-detail-paper" data-paper-color="WHITE" class="rounded-t-lg border px-4 py-2 text-sm font-medium ${n.detail.paperColor==="WHITE"?"border-blue-400 bg-blue-50 text-blue-700":"border-slate-200 bg-white text-slate-600"}">普通捆条 · 白色热敏纸（${x(r)}）</button><button type="button" data-cutting-fei-action="set-detail-paper" data-paper-color="YELLOW" class="rounded-t-lg border px-4 py-2 text-sm font-medium ${n.detail.paperColor==="YELLOW"?"border-amber-400 bg-amber-50 text-amber-800":"border-slate-200 bg-white text-slate-600"}">盘扣捆条 · 黄色热敏纸（${x(a)}）</button></div>
      </div>
      <div class="space-y-4 p-4">
        ${yi()}
        <div class="grid gap-3 md:grid-cols-[1fr_auto]"><label class="space-y-1 text-sm"><span class="text-slate-500">搜索</span><input data-cutting-fei-detail-field="keyword" value="${i(n.detail.keyword)}" class="h-10 w-full rounded-md border px-3" placeholder="菲票号 / 捆条名称 / 切割方式 / 生产单 / 裁片单" /></label><button type="button" data-cutting-fei-action="reset-detail-filters" class="mt-6 h-10 rounded-md border px-4 text-sm">重置</button></div>
        ${hi(s)}
      </div>
    </section>
  `}function Ni(e){const t=ae(e),r=t.filter(s=>E(s)==="WHITE"),a=t.filter(s=>E(s)==="YELLOW");return fi(e),`
    ${$("捆条加工单菲票概况","",`
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">捆条加工单</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(e.bindingOrderNo)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">来源裁片单</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(e.sourceCutOrderNo)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">菲票明细</p><p class="mt-1 text-sm font-semibold text-slate-900">${x(t.length)} 条</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">捆条需要长度</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(F(e.plannedTotalLength))}</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">打印状态</p><div class="mt-1">${bi(e)}</div></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">是否有盘扣捆条</p><p class="mt-1 text-sm font-semibold ${a.length?"text-amber-800":"text-slate-900"}">${a.length?`是 · ${x(a.length)} 张`:"无"}</p>${r.length&&a.length?'<p class="mt-1 text-xs font-medium text-amber-700" data-binding-detail-mixed-paper>同单同时有普通白票</p>':""}</div>
      </div>
    `)}
    ${$("来源与工艺概况","",`
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">生产单 / 裁片单</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(e.sourceProductionOrderNo)} / ${i(e.sourceCutOrderNo)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="mb-2 text-xs text-slate-500">物料</p>${he({materialSku:e.materialIdentity.materialSku,materialLabel:e.materialIdentity.materialName,materialAlias:e.materialIdentity.materialAlias,materialImageUrl:e.materialIdentity.materialImageUrl,materialColor:e.materialIdentity.materialColor},{compact:!0})}</div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">纸样</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(e.patternIdentity.patternFileName||e.sourcePatternPackageName)}</p><p class="mt-1 text-xs text-slate-500">${i(e.patternIdentity.patternVersion||"待补版本")}</p></div>
        <div class="rounded-lg border ${a.length?"border-amber-200 bg-amber-50":"border-slate-200 bg-white"} p-3"><p class="text-xs ${a.length?"text-amber-700":"text-slate-500"}">盘扣 / 承接工厂 / 去向</p><p class="mt-1 text-sm font-semibold ${a.length?"text-amber-950":"text-slate-900"}">${a.length?"盘扣 / APF - 辅助工艺":"无盘扣工艺"}</p><p class="mt-1 text-xs ${a.length?"text-amber-800":"text-slate-500"}">${a.length?"盘扣成品交中央辅料仓":"普通捆条用于衣服"}</p></div>
      </div>
    `)}
    ${vi(e)}
  `}function ki(e){const t=Y(),r=pi(e);if(r&&Ne(e).startsWith("binding:"))return H(`
      ${W({canonicalPath:ca(r),pageTitle:"捆条菲票明细"},{actionsHtml:Xs()})}
      ${Ni(r)}
    `);const a=ua(t,e);if(a&&Ne(e).startsWith("spreading:"))return H(`
      ${W({canonicalPath:De(a),pageTitle:a.isManualBatch?"手动菲票批次明细":"铺布单菲票明细"},{actionsHtml:Zs()})}
      ${ct()}
      ${ci(a)}
    `);const s=rt(t,e);return s?H(`
    ${W({canonicalPath:Ie(s.ticketId),pageTitle:"菲票详情"},{actionsHtml:Fe(s)})}
    ${ui(s)}
  `):ut(e)}function $i(e,t){return'<div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900"><strong>固定 10cm × 10cm</strong><span class="ml-2">普通菲票与特殊工艺菲票尺寸一致；特殊工艺仅使用黄色热敏纸。</span></div>'}function Ue(e){return e.replace(/^(裁片数量|部位数量|编号范围|编号区间|本票裁片)：/,"")}function z(e,t,r={}){return`
    <div class="min-h-[11mm] border-b border-r border-slate-900 p-[1.4mm] ${r.className||""}">
      <span class="text-[8px] font-medium text-slate-700">${i(e)}</span>
      <strong class="ml-1 whitespace-pre-line break-words ${r.strong?"text-[15px] font-black":"text-[10.5px] font-extrabold"} leading-tight text-slate-950">${i(t||"—")}</strong>
    </div>
  `}function Si(e,t){const r=Vt(Sa(e),{}),s=k(r.specialCraftHandoverLines,2);return`
    <div class="overflow-hidden rounded-lg border bg-slate-50 p-4">
      <div class="w-[100mm] min-h-[100mm] max-w-full rounded-md border border-slate-900 bg-white p-[2mm] text-slate-900 shadow-sm">
        <div class="border border-slate-900">
          <div class="border-b border-slate-900 px-[2mm] py-[2.2mm] text-[22px] font-black leading-none">
            ${i(r.titleLabel)}
          </div>
          <div class="grid grid-cols-[1fr_32mm]">
            <div class="grid grid-cols-2">
              ${z("面料",`${r.materialDisplayLabel}
颜色：${r.color}`,{strong:!0})}
              ${z("唛架编号",`${r.markerNumber||r.markerPlanNo}
铺布单号：${r.spreadingOrderNo||"—"}`,{strong:!0})}
              ${z("部位",r.partName,{strong:!0})}
              ${z("尺码",r.businessSizeLabel,{strong:!0})}
              ${z("部位数量",Ue(r.partQuantityLabel),{strong:!0})}
              ${z("编号区间",Ue(r.pieceSequenceLabel),{strong:!0})}
              ${z("适用SKU",r.applicableSkuLabel,{className:"col-span-2"})}
              ${z("特殊工艺 / 承接工厂",s,{className:"col-span-2",strong:!0})}
              ${z("菲票号",r.feiTicketNo,{strong:!0})}
              ${z("本票裁片",Ue(r.actualCutPieceQtyLabel))}
            </div>
            <div class="flex flex-col items-center justify-center gap-[1.5mm] border-l border-slate-900 p-[1.5mm] text-center">
              <div class="flex min-h-[31mm] w-full items-center justify-center border border-slate-900">${Re({value:r.qrDisplayValue,size:116,title:"菲票二维码",label:`菲票 ${e.ticketNo}`})}</div>
              <div class="text-[8px] font-semibold text-slate-800">菲票二维码</div>
              <div class="break-all text-[7px] leading-tight text-slate-500">${i(r.versionLabel)} / 扫码查看菲票</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `}function Ii(e){var a;const t=Y(),r=rt(t,e);return r?H(`
    ${W({canonicalPath:Ie(r.ticketId,"/print"),pageTitle:"菲票打印"},{actionsHtml:Fe(r)})}
    ${$("模板尺寸","",$i())}
    ${$("打印模板预览","",Si(r))}
    ${$("打印内容核对","",`
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">菲票号</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(r.ticketNo)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">裁片数量</p><p class="mt-1 text-sm font-semibold text-slate-900">${x(r.pieceQty)} 片</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">编号范围</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(r.pieceSequenceLabel)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">特殊工艺 / 承接工厂</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(k(r.specialCraftLines,2))} / ${i(k(r.receiverFactoryLines,2))}</p></div>
      </div>
    `)}
    ${$("动作区","",`<button type="button" data-nav="${i(`/fcs/print/preview?documentType=FEI_TICKET_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=${encodeURIComponent(((a=r.record)==null?void 0:a.ticketRecordId)||r.generated.feiTicketNo)}`)}" class="inline-flex min-h-10 items-center rounded-md border border-blue-600 bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">打印</button>`)}
  `):ut(e)}function Ci(e,t=!1){return`
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">菲票号</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(e.ticketNo)}</p></div>
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">裁片数量</p><p class="mt-1 text-sm font-semibold text-slate-900">${x(e.pieceQty)} 片</p></div>
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">部位裁片编号范围</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(e.pieceSequenceLabel)}</p></div>
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">是否有特殊工艺</p><p class="mt-1 text-sm font-semibold text-slate-900">${e.hasSpecialCraft?"是":"无"}</p></div>
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">特殊工艺类型</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(k(e.specialCraftLines,3))}</p></div>
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">承接工厂</p><p class="mt-1 text-sm font-semibold text-slate-900">${i(k(e.receiverFactoryLines,3))}</p></div>
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">是否已打印</p><p class="mt-1 text-sm font-semibold text-slate-900">${e.firstPrintedAt?"是":"否"}</p></div>
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">是否已入仓 / 已装袋 / 已进入交出记录</p><p class="mt-1 text-sm font-semibold text-slate-900">${t?"当前阶段仅提示影响范围，未接入后续对象":"如已有后续对象，需同步核对"}</p></div>
    </div>
  `}function Ti(e){const t=A(),r=_().get("reason")||n.operationDraft.reason;return`<div class="flex flex-wrap gap-2">${e.map(a=>{const s=a===r;return`<button type="button" data-nav="${i(Xe(t,{reason:a}))}" class="rounded-md border px-3 py-1.5 text-xs ${s?"border-blue-500 bg-blue-50 text-blue-700":"border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}">${i(a)}</button>`}).join("")}</div>`}function Lt(){const e=!!n.operationDraft.reason.trim();document.querySelectorAll('[data-cutting-fei-op-field="reason"]').forEach(t=>{t.value!==n.operationDraft.reason&&(t.value=n.operationDraft.reason)}),document.querySelectorAll('[data-cutting-fei-action="standalone-reprint-confirm"]').forEach(t=>{t.toggleAttribute("disabled",!e),t.className=`inline-flex min-h-10 items-center rounded-md border px-4 text-sm font-medium ${e?"border-blue-600 bg-blue-600 text-white hover:bg-blue-700":"border-slate-200 bg-slate-100 text-slate-400"}`})}function Ri(e){const t=Y(),r=rt(t,e);if(!r)return ut(e);const a=_().get("reason")||n.operationDraft.reason,s=!!a.trim();return H(`
    ${W({canonicalPath:Ie(r.ticketId,"/reprint"),pageTitle:"菲票补打"},{actionsHtml:Fe(r)})}
    ${$("影响范围","",Ci(r))}
    ${$("补打原因","",`
      ${Ti(rs)}
      <label class="mt-3 block space-y-1 text-sm text-slate-600">
        <span class="font-medium text-slate-700">补打原因（必填）</span>
        <input type="text" value="${i(a)}" data-cutting-fei-op-field="reason" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" placeholder="请选择或输入补打原因" />
      </label>
    `)}
    ${$("动作区","",`<button type="button" data-cutting-fei-action="standalone-reprint-confirm" ${s?"":"disabled"} class="inline-flex min-h-10 items-center rounded-md border px-4 text-sm font-medium ${s?"border-blue-600 bg-blue-600 text-white hover:bg-blue-700":"border-slate-200 bg-slate-100 text-slate-400"}">确认补打</button>`)}
  `)}function pe(e){return e==="fei-tickets"?Fs():e==="fei-ticket-detail"||e==="fei-ticket-printed"?Qs(e):Ys(e)}let fe=null;async function ge(e){(!fe||fe.intent!==e.intent)&&(fe={id:`PART-FEI:${Date.now()}:${Math.random().toString(36).slice(2)}`,intent:e.intent});const t=await Oa({...e,id:fe.id});return fe=null,t}function xe(e){return JSON.stringify({action:e,manualCreate:n.manualCreate,detail:n.detail,operationDraft:n.operationDraft})}async function Ot(e){const t=await ge({intent:xe(e)+_().toString(),action:()=>{const r=Y(),a=tt(r);if(!a)return;const s=Ve({unit:a,cutOrderRows:r.cutOrderRows,materialPrepRows:r.materialPrepRows,markerPlanSources:r.markerPlanSources,markerStore:r.markerStore,ticketRecords:r.ticketRecords,printJobs:r.printJobs});if(!s.missingSplitDetails.length||!n.operationDraft.operator.trim()||!n.operationDraft.printerName.trim()||!n.operationDraft.templateName.trim()||e==="fei-ticket-reprint"&&!n.operationDraft.reason.trim())return;const d=e==="fei-ticket-print"?"FIRST_PRINT":"REPRINT",l=_(),o=Ka({unit:a,splitDetails:s.missingSplitDetails,cutOrderRows:r.cutOrderRows,materialPrepRows:r.materialPrepRows,markerPlanSources:r.markerPlanSources,markerStore:r.markerStore,ticketRecords:r.ticketRecords,printJobs:r.printJobs,operationType:d,operator:n.operationDraft.operator.trim(),operatedAt:Yt(),printerName:n.operationDraft.printerName.trim(),templateName:n.operationDraft.templateName.trim(),reason:n.operationDraft.reason.trim(),remark:n.operationDraft.remark.trim(),fromTicketId:l.get("ticketRecordId")||void 0});return Zt(o.nextRecords),Xt(o.nextJobs),ve("fei-ticket-printed",a)}});t&&(n.operationDraft=Ee(),n.operationSignature="",ne.navigate(t))}function Pi(){return pe("fei-tickets")}function Li(){return pe("fei-tickets")}function Oi(){const e=A(),t=/^\/fcs\/craft\/cutting\/fei-tickets\/([^/]+)$/.exec(e);return t?ki(t[1]):pe("fei-ticket-detail")}function wi(){return pe("fei-ticket-printed")}function Ei(){const e=A(),t=/^\/fcs\/craft\/cutting\/fei-tickets\/([^/]+)\/print$/.exec(e);return t?Ii(t[1]):pe("fei-ticket-print")}function Di(){const e=A(),t=/^\/fcs\/craft\/cutting\/fei-tickets\/([^/]+)\/reprint$/.exec(e);return t?Ri(t[1]):pe("fei-ticket-reprint")}function Ai(){n.filters={...Jt}}function Bi(e){var p;const t=J();if(!V(t))return!1;const r=Be[t],a=ot(t),s=Se[t],d=e.closest(`[data-${r}-field]`);if(d&&d.getAttribute(`data-${r}-field`)==="pageSize")return a.setPageSize(Number(d.value)),a.refresh(),!0;const l=e.closest(`[data-${r}-action]`),o=l==null?void 0:l.getAttribute(`data-${r}-action`);if(!l||!o)return!1;if(o==="prev-page"||o==="next-page")return a.stepPage(o==="prev-page"?-1:1),a.refresh(),!0;if(o==="sort-column")return a.cycleSort(l.dataset.columnKey||""),a.refresh(),!0;if(o==="open-column-settings"&&(s.showColumnSettings=!0),o==="close-column-settings"&&(s.showColumnSettings=!1),o==="restore-column-settings"&&a.restorePreferences(),o==="toggle-column-visibility"||o==="toggle-column-freeze"){const c=l.closest("input"),b=l.getAttribute(`data-${r}-column-key`)||((p=l.closest(`[data-${r}-column-key]`))==null?void 0:p.getAttribute(`data-${r}-column-key`))||"";a.updateColumnPreference(o,b,c==null?void 0:c.checked)}return["open-column-settings","close-column-settings","restore-column-settings","toggle-column-visibility","toggle-column-freeze"].includes(o)?(a.refresh({overlays:!0}),!0):!1}async function Fi(e){var f;if(Bi(e))return!0;const t=e.closest("[data-cutting-fei-detail-select]");if(t){const u=t.dataset.cuttingFeiDetailSelect||"";return u?(n.detail.selectedTicketIds=t.checked?N([...n.detail.selectedTicketIds,u]):n.detail.selectedTicketIds.filter(y=>y!==u),!0):!1}const r=e.closest("[data-cutting-fei-detail-field]");if(r){const u=r.dataset.cuttingFeiDetailField;if(u==="sourceFilter")return n.detail={...n.detail,sourceFilter:r.value,page:1,selectedTicketIds:[]},!0;if(u==="keyword")return n.detail={...n.detail,keyword:r.value,page:1,selectedTicketIds:[]},!0}const a=e.closest("[data-cutting-fei-detail-dialog-field]");if(a){const u=a.dataset.cuttingFeiDetailDialogField;return u==="ticketId"&&(n.detail.dialogTicketId=a.value),u==="qty"&&(n.detail.dialogQty=Math.max(Math.floor(Number(a.value||0)),0)),u==="remark"&&(n.detail.dialogRemark=a.value),!0}const s=e.closest("[data-cutting-fei-detail-print-field]");if(s&&n.detail.printRequest)return s.dataset.cuttingFeiDetailPrintField==="reason"&&(n.detail.printRequest.reason=s.value),!0;const d=e.closest("[data-cutting-fei-manual-size]");if(d){const u=d.dataset.cuttingFeiManualSize||"";return u?(n.manualCreate={...n.manualCreate,sizePiecePerLayer:{...n.manualCreate.sizePiecePerLayer,[u]:Math.max(Math.floor(Number(d.value||0)),0)}},!0):!1}const l=e.closest("[data-cutting-fei-manual-field]");if(l){const u=l.dataset.cuttingFeiManualField;if(u==="markerPlanId")return _e(l.value),!0;if(u==="markerMemberId"){const y=Qe();return _e(y==null?void 0:y.id,l.value),!0}if(u==="layerCount")return n.manualCreate={...n.manualCreate,layerCount:Math.max(Math.floor(Number(l.value||0)),0)},!0;if(u==="search"||u==="remark")return n.manualCreate={...n.manualCreate,[u]:l.value},!0}const o=e.closest("[data-cutting-fei-field]");if(o){const u=o.dataset.cuttingFeiField;if(!u)return!1;const y=o;return u==="printObjectType"?n.filters={...n.filters,printObjectType:y.value}:u==="printableUnitType"?n.filters={...n.filters,printableUnitType:y.value}:u==="printableUnitStatus"?n.filters={...n.filters,printableUnitStatus:y.value}:n.filters={...n.filters,[u]:y.value},Te(),!0}const p=e.closest("[data-cutting-fei-op-field]");if(p){const u=p.dataset.cuttingFeiOpField;if(!u)return!1;const y=p;return n.operationDraft={...n.operationDraft,[u]:y.value},Lt(),!0}const c=e.closest("[data-cutting-fei-action]");if(!c)return!1;const b=c.dataset.cuttingFeiAction;if(!b)return!1;if(b==="set-status"){const u=c.dataset.status;return u?(n.filters={...n.filters,printableUnitStatus:u},V()&&Te(),!0):!1}if(b==="reset-filters")return Ai(),V()&&(Ds(),Te()),!0;if(b==="open-binding-material-preview"){const u=c.dataset.imageUrl||"";return u?(U={imageUrl:u,title:c.dataset.imageTitle||"捆条物料"},Le("BINDING"),!0):!1}if(b==="close-binding-material-preview")return U=null,Le("BINDING"),!0;if(b==="dismiss-feedback")return n.feedback=null,!0;if(b==="open-manual-create")return n.feedback=null,n.manualCreate={...n.manualCreate,open:!0,search:"",remark:""},_e(),!0;if(b==="close-manual-create")return n.manualCreate={...n.manualCreate,open:!1},!0;if(b==="confirm-manual-create"){const u=Qe(),y=Na(u);if(!u||!y)return n.feedback={tone:"error",message:"请选择现有可用唛架和唛架成员。"},!0;try{const g=await ge({intent:xe("createManualFeiTicketBatch"),action:()=>{const S=Sr(()=>Ht().viewModel.plans.find(T=>T.id===u.id)),I=S?$e(S).find(T=>T.bedId===y.bedId):null;if(!S||S.status==="CANCELED"||!I)throw new Error("所选唛架或成员已变化，请重新读取后选择。");return fr({markerPlan:S,markerMember:I,layerCount:n.manualCreate.layerCount,sizePiecePerLayer:n.manualCreate.sizePiecePerLayer,createdBy:n.operationDraft.operator||"裁床打票员",remark:n.manualCreate.remark})}});n.manualCreate={...n.manualCreate,open:!1},n.feedback={tone:"success",message:`已生成 ${g.records.length} 张待打印菲票。`}}catch(g){n.feedback={tone:"error",message:g instanceof Error?g.message:String(g)}}return!0}const m=ri();if(b==="set-detail-paper"){const u=c.dataset.paperColor;return u?(n.detail={...n.detail,paperColor:u,page:1,selectedTicketIds:[],dialogMode:null,printRequest:null},n.feedback=null,!0):!1}if(b==="reset-detail-filters")return n.detail={...n.detail,sourceFilter:"ALL",keyword:"",page:1,selectedTicketIds:[]},!0;if(b==="detail-prev-page")return n.detail.page=Math.max(n.detail.page-1,1),!0;if(b==="detail-next-page")return n.detail.page+=1,!0;if(b==="toggle-detail-page-selection"){if(!m)return!1;const u=ye(m),y=(n.detail.page-1)*n.detail.pageSize,g=u.slice(y,y+n.detail.pageSize).map(I=>I.ticketId),S=c.checked;return n.detail.selectedTicketIds=S?N([...n.detail.selectedTicketIds,...g]):n.detail.selectedTicketIds.filter(I=>!g.includes(I)),!0}if(b==="open-detail-add"){if(!m)return!1;const u=ye(m)[0];return n.detail={...n.detail,dialogMode:"ADD",dialogTicketId:(u==null?void 0:u.ticketId)||"",dialogQty:1,dialogRemark:""},!0}if(b==="open-detail-edit"||b==="open-detail-single"||b==="open-detail-delete"){const u=c.dataset.ticketId||"";if(!m||!u)return!1;const y=m.detailRows.find(g=>g.ticketId===u);return y?(n.detail={...n.detail,dialogMode:b==="open-detail-edit"?"EDIT":b==="open-detail-delete"?"DELETE":"DETAIL",dialogTicketId:y.ticketId,dialogQty:y.pieceQty,dialogRemark:b==="open-detail-edit"?"":y.generated.manualRemark||""},!0):!1}if(b==="close-detail-dialog")return n.detail={...n.detail,dialogMode:null,dialogTicketId:"",dialogRemark:""},!0;if(b==="confirm-detail-add"){if(!m)return!1;const u=m.detailRows.find(y=>y.ticketId===n.detail.dialogTicketId);if(!u)return n.feedback={tone:"error",message:"请选择要复制的菲票对象。"},!0;try{const y=await ge({intent:xe("appendManualFeiTicket"),action:()=>gr({sourceRecord:u.generated,qty:n.detail.dialogQty,remark:n.detail.dialogRemark,operatedBy:n.operationDraft.operator||"裁床打票员",manualBatchId:m.spreadingKey})});n.detail={...n.detail,dialogMode:null,dialogTicketId:"",dialogRemark:""},n.feedback={tone:"success",message:`已新增未打印菲票 ${y.feiTicketNo}，保留当前批次、部位和纸张分类。`}}catch(y){n.feedback={tone:"error",message:y instanceof Error?y.message:String(y)}}return!0}if(b==="confirm-detail-edit"){try{const u=await ge({intent:xe("updateUnprintedManualFeiTicketQuantity"),action:()=>xr({feiTicketId:n.detail.dialogTicketId,qty:n.detail.dialogQty,reason:n.detail.dialogRemark,operatedBy:n.operationDraft.operator||"裁床打票员"})});n.detail={...n.detail,dialogMode:null,dialogTicketId:"",dialogRemark:""},n.feedback={tone:"success",message:`已将 ${u.feiTicketNo} 的数量修改为 ${u.qty}片，二维码数量和编号范围同步更新。`}}catch(u){n.feedback={tone:"error",message:u instanceof Error?u.message:String(u)}}return!0}if(b==="confirm-detail-delete"){try{await ge({intent:xe("deleteUnprintedManualFeiTicket"),action:()=>yr({feiTicketId:n.detail.dialogTicketId,operatedBy:n.operationDraft.operator||"裁床打票员"})}),n.detail.selectedTicketIds=n.detail.selectedTicketIds.filter(u=>u!==n.detail.dialogTicketId),n.detail={...n.detail,dialogMode:null,dialogTicketId:""},n.feedback={tone:"success",message:"已删除该未打印手动菲票，并保留操作记录。"}}catch(u){n.feedback={tone:"error",message:u instanceof Error?u.message:String(u)}}return!0}if(b==="request-detail-row-print"){if(!m)return!1;const u=m.detailRows.find(y=>y.ticketId===c.dataset.ticketId);return u?(ze([u],j(u)?"单张补打":"单张打印"),!0):!1}if(b==="request-detail-selected-print")return m?(ze(m.detailRows.filter(u=>n.detail.selectedTicketIds.includes(u.ticketId)),"批量打印"),!0):!1;if(b==="request-detail-all-print"||b==="request-detail-all-reprint"){if(!m)return!1;const u=ye(m),y=b==="request-detail-all-print"?u.filter(g=>!j(g)):u.filter(j);return ze(y,b==="request-detail-all-print"?"当前分类全部打印":"当前分类全部补打"),!0}if(b==="cancel-detail-print")return n.detail.printRequest=null,!0;if(b==="confirm-detail-print"){const u=n.detail.printRequest;if(u!=null&&u.requiresReason&&!u.reason.trim())return n.feedback={tone:"error",message:"请填写补打原因。"},!0;const y=u?`${u.href}${u.requiresReason?`&reason=${encodeURIComponent(u.reason.trim())}`:""}`:"";return n.detail.printRequest=null,y?(ne.navigate(y),!0):!1}if(b==="set-operation-reason"){const u=c.dataset.reason||"";return n.operationDraft={...n.operationDraft,reason:u},Lt(),!0}if(b==="return-summary"){const u=Xa(te());return u?(ne.navigate(er("summary",u)),!0):!1}if(b==="confirm-first-print")return await Ot("fei-ticket-print"),!0;if(b==="confirm-reprint")return await Ot("fei-ticket-reprint"),!0;if(b==="standalone-reprint-confirm"){const u=(_().get("reason")||n.operationDraft.reason).trim();if(!u)return!0;const g=((f=A().split("/fei-tickets/")[1])==null?void 0:f.split("/")[0])||"",S=`/fcs/print/preview?documentType=FEI_TICKET_REPRINT_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=${encodeURIComponent(g)}&reason=${encodeURIComponent(u)}`;return n.operationDraft=Ee(),ne.navigate(S),!0}return!1}async function Mi(e){var s,d,l,o;let t=!1;try{t=await Fi(e)}catch(p){n.feedback={tone:"error",message:`尚未保存：${p instanceof Error?p.message:String(p)}`},t=!0}const r=(s=e.closest("[data-cutting-fei-action]"))==null?void 0:s.dataset.cuttingFeiAction,a=(d=e.closest("[data-cutting-fei-manual-field]"))==null?void 0:d.dataset.cuttingFeiManualField;if(t&&V()){(["open-manual-create","close-manual-create","confirm-manual-create"].includes(r||"")||["markerPlanId","markerMemberId"].includes(a||""))&&Le(),r==="confirm-manual-create"&&((l=n.feedback)==null?void 0:l.tone)==="success"&&Te();const p=(o=V())==null?void 0:o.querySelector("[data-fei-feedback-surface]");p&&(p.innerHTML=ct())}return t}const mn=Object.freeze(Object.defineProperty({__proto__:null,handleCraftCuttingFeiTicketsEvent:Mi,recordActualFeiTicketFirstPrintFromPreview:Gr,renderCraftCuttingBindingFeiTicketsPage:Li,renderCraftCuttingFeiTicketDetailPage:Oi,renderCraftCuttingFeiTicketPrintPage:Ei,renderCraftCuttingFeiTicketPrintedPage:wi,renderCraftCuttingFeiTicketReprintPage:Di,renderCraftCuttingFeiTicketsPage:Pi},Symbol.toStringTag,{value:"Module"}));export{we as a,Vt as b,mn as f,Mi as h,Gr as r};

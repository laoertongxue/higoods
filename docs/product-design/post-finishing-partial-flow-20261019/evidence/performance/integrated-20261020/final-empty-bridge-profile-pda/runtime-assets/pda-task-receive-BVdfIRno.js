import{runDesignRevisionFcsCommand as H}from"./design-revision-pcs-command-CdS_bkCv.js";import{saveProductionSourceUiAction as O}from"./production-context-actions-xyeJ4RCo.js";import{T as R,M as g,f as De,aO as $e,x as s,ah as E,b3 as ke,p as Pe}from"./app-shared-DDMaqtkq.js";import{p as Ee}from"./production-orders-B2zW2PhJ.js";import{c as b}from"./task-execution-adapter-C49Xdxb8.js";import{r as Ne}from"./task-chain-pages-adapter-Bp0Uawlh.js";import{f as Se,h as we,i as Ae}from"./warehouse-runtime-CZ8hVkSQ.js";import{bk as V,bl as Z,bm as X,bn as Oe,bo as Re,bp as Ce}from"./pda-handover-events-UcnOWl8d.js";import{l as C,b as q,d as qe,e as je,f as Ue}from"./runtime-task-tenders-kbJDCqqI.js";import{a as ee,e as te,i as N,g as _e}from"./pda-cutting-execution-source-BtQG_CPO.js";import{e as j,g as Fe,f as re}from"./process-mobile-task-binding-RlLsKsXN.js";import{r as ae}from"./pda-shell-B6HvNKDb.js";import{e as Le,a as Be,b as Ke,r as Ge,f as Me}from"./pda-cutting-nav-context-Lb7Jv7R_.js";import{c as ne}from"./special-craft-pda-scope-CpsSE7FW.js";import{bN as We,bO as Qe,bP as He,bQ as Ye}from"./printing-task-domain-XoVf2Yk7.js";import{e as ze,f as Je}from"./dye-work-order-online-domain-B1rReB8o.js";import{g as D,bi as Ve,bj as Ze}from"./runtime-process-tasks-CsQOZ2XB.js";import{m as w,q as S}from"./craft-display-support-BApnCE-Y.js";import{ensurePdaSessionForAction as Xe,getPdaRuntimeContext as U,renderPdaLoginRedirect as et}from"./pda-runtime-BlCMwqBh.js";import{f as _,a as tt}from"./post-finishing-full-flow-D_giM7Ur.js";import{e as rt}from"./kol-goto-pda-domain-CB3jtKjS.js";const at=[{tenderId:"TENDER-PDA-SEW-118",taskId:"TASK-SEW-BID-118",productionOrderId:"PO-20260322-032",processName:"车缝",qty:880,qtyUnit:"件",factoryPoolCount:5,biddingDeadline:"2026-03-22 20:00:00",taskDeadline:"2026-03-25 18:00:00",minPrice:4.3,currency:"CNY",factoryId:"ID-F001"},{tenderId:"TENDER-PDA-IRON-PACK-071",taskId:"TASK-IRON-PACK-BID-071",productionOrderId:"PO-20260322-033",processName:"烫包",qty:540,qtyUnit:"件",factoryPoolCount:3,biddingDeadline:"2026-03-23 10:00:00",taskDeadline:"2026-03-25 20:00:00",minPrice:1.8,currency:"CNY",factoryId:"ID-F001"}],nt=[{tenderId:"TENDER-PDA-SEW-113",taskId:"TASK-SEW-BID-113",productionOrderId:"PO-20260321-018",processName:"车缝",qty:760,qtyUnit:"件",quotedPrice:4.6,quotedAt:"2026-03-22 09:10:00",deliveryDays:3,currency:"CNY",unit:"件",biddingDeadline:"2026-03-22 12:00:00",taskDeadline:"2026-03-25 20:00:00",tenderStatusLabel:"招标中",remark:"可安排双线并行，支持夜班赶货。",factoryId:"ID-F001"},{tenderId:"TENDER-PDA-IRON-PACK-009",taskId:"TASK-IRON-PACK-BID-009",productionOrderId:"PO-20260321-020",processName:"烫包",qty:920,qtyUnit:"件",quotedPrice:1.2,quotedAt:"2026-03-21 17:40:00",deliveryDays:2,currency:"CNY",unit:"件",biddingDeadline:"2026-03-22 09:30:00",taskDeadline:"2026-03-24 16:00:00",tenderStatusLabel:"招标中",remark:"烫包线空档可承接，支持分批交付。",factoryId:"ID-F001"}],it=[{tenderId:"TENDER-PDA-SEW-113",taskId:"TASK-SEW-000238",processName:"车缝",qty:360,notifiedAt:"2026-03-22 07:45:00",productionOrderId:"PO-20260318-008",factoryId:"ID-F001"},{tenderId:"TENDER-PDA-IRON-PACK-011",taskId:"TASK-IRON-PACK-000241",processName:"烫包",qty:680,notifiedAt:"2026-03-22 09:20:00",productionOrderId:"PO-20260322-034",factoryId:"ID-F001"}],dt=X().slice(0,3).map((e,a)=>({...e,tenderId:`TENDER-PDA-TEST-${a+1}`,taskId:`TASK-TEST-BID-${a+1}`,factoryId:R})),st=V().slice(0,3).map((e,a)=>({...e,tenderId:`TENDER-PDA-TEST-QUOTED-${a+1}`,taskId:`TASK-TEST-QUOTED-${a+1}`,factoryId:R})),ot=Z().slice(0,2).map((e,a)=>({...e,tenderId:`TENDER-PDA-TEST-AWARDED-${a+1}`,taskId:`TASK-TEST-AWARDED-${a+1}`,factoryId:R})),ct=[...Ae(),...X(),...at,...dt],F=[...Se(),...V(),...nt,...st],ut=[...we(),...Z(),...it,...ot];function lt(e){const a=C().filter(t=>q(t)==="BIDDING").filter(t=>t.factoryPool.some(n=>n.factoryId===e)).filter(t=>!t.quotes.some(n=>n.factoryId===e)).map(t=>({tenderId:t.tenderId,taskId:t.taskId,productionOrderId:t.taskSnapshot.productionOrderNo||t.taskSnapshot.productionOrderId,processName:t.taskSnapshot.processName,qty:t.taskSnapshot.qty,qtyUnit:t.taskSnapshot.qtyUnit,factoryPoolCount:t.factoryPool.length,biddingDeadline:t.biddingDeadline,taskDeadline:t.taskDeadline,minPrice:t.minPrice,currency:t.currency,factoryId:e,skuCount:t.taskSnapshot.skuLines.length,runtimeShared:!0})),r=[...ct.filter(t=>t.factoryId===e),...a];return[...new Map(r.map(t=>[t.tenderId,t])).values()].map(t=>({...t}))}function pt(e){const a=C().flatMap(t=>{const n=t.quotes.find(o=>o.factoryId===e);if(!n)return[];const d=q(t);return[{tenderId:t.tenderId,taskId:t.taskId,productionOrderId:t.taskSnapshot.productionOrderNo||t.taskSnapshot.productionOrderId,processName:t.taskSnapshot.processName,qty:t.taskSnapshot.qty,qtyUnit:t.taskSnapshot.qtyUnit,quotedPrice:n.quotePrice,quotedAt:n.quoteTime,deliveryDays:n.deliveryDays||0,currency:t.currency,unit:t.unit,biddingDeadline:t.biddingDeadline,taskDeadline:t.taskDeadline,tenderStatusLabel:qe[d],remark:n.remark||"",factoryId:e,skuCount:t.taskSnapshot.skuLines.length,runtimeShared:!0}]}),r=[...F.filter(t=>t.factoryId===e),...a];return[...new Map(r.map(t=>[t.tenderId,t])).values()].map(t=>({...t}))}function mt(e){const a=C().filter(t=>q(t)==="AWARDED"&&t.awardedFactoryId===e).map(t=>({tenderId:t.tenderId,taskId:t.taskId,processName:t.taskSnapshot.processName,qty:t.taskSnapshot.qty,notifiedAt:t.awardedAt||t.assignmentOperatedAt,productionOrderId:t.taskSnapshot.productionOrderNo||t.taskSnapshot.productionOrderId,factoryId:e})),r=[...ut.filter(t=>t.factoryId===e),...a];return[...new Map(r.map(t=>[t.tenderId,t])).values()].map(t=>({...t}))}function ft(e,a={}){const r=typeof a=="string"?{returnTo:a}:a;return e.taskReadyForDirectExec&&(e.defaultExecutionOrderId||e.defaultExecutionOrderNo)?{label:"继续处理",href:r.execHref||ee(e.taskId,r.returnTo),helperText:"",directExec:!0}:{label:"查看任务",href:r.detailHref||te(e.taskId,r.returnTo),helperText:e.hasMultipleCutPieceOrders?"需先选择执行单":"",directExec:!1}}function gt(e){return e==="已完成"?"border-emerald-200 bg-emerald-50 text-emerald-700":e==="有异常"?"border-destructive/20 bg-destructive text-destructive-foreground":e!=null&&e.includes("部分")?"border-amber-200 bg-amber-50 text-amber-700":e==="进行中"?"border-blue-200 bg-blue-50 text-blue-700":"border-border bg-background text-muted-foreground"}const bt=["印花"],xt=["PRINT"];function ie(e){return(e??"").trim()}function yt(e){const a=ie(e);return bt.some(r=>a===r||a.includes(r))}function It(e){const a=ie(e).toUpperCase();return xt.some(r=>a.includes(r))}function de(e,a){return!yt(e)&&!It(a)}function L(e,a){return!e||!(!a||ne(a,e))?!1:e.defaultDocType==="PREPARATION_ORDER"?!0:de(e.processNameZh,e.processCode)}function se(e,a,r){return(a==null?void 0:a.defaultDocType)==="PREPARATION_ORDER"?!1:a?L(a,r):de(e.processName,e.processCode)&&(!r||ne(r,e))}function vt(){return new Set(F.map(e=>e.tenderId))}function ht(e,a){return e.filter(r=>r.assignedFactoryId===a&&r.assignmentMode==="DIRECT"&&(!r.acceptanceStatus||r.acceptanceStatus==="PENDING")&&L(r,a))}function Tt(e,a,r,t){return e.filter(n=>!a.has(n.tenderId)&&se(n,n.taskId?r(n.taskId):null,t))}function Dt(e,a,r,t){return e.filter(n=>(a.has(n.tenderId)||n.runtimeShared===!0)&&se(n,n.taskId?r(n.taskId):null,t))}function $t(e,a){return e.filter(r=>r.assignmentMode==="BIDDING"&&r.assignmentStatus==="AWARDED"&&r.acceptanceStatus!=="REJECTED"&&r.assignedFactoryId===a&&L(r,a))}const B=[{key:"pending-accept",label:"待接单任务"},{key:"pending-quote",label:"待报价招标单"},{key:"quoted",label:"已报价招标单"},{key:"awarded",label:"已中标任务"}],i={selectedFactoryId:"",activeTab:"pending-accept",keyword:"",quoteDialogOpen:!1,quotingTenderId:null,quoteAmount:"",deliveryDays:"",quoteRemark:"",submittingQuote:!1,submittedTenderIds:vt(),rejectDialogOpen:!1,rejectingTaskId:"",rejectReason:"",acceptDialogTaskId:"",acceptDialogAcceptedAt:"",kolImageUrl:"",kolImageAlt:""};function kt(){return i.kolImageUrl?(i.kolImageUrl="",i.kolImageAlt="",!0):!1}const oe=new Map(F.map(e=>[e.tenderId,{quotedPrice:e.quotedPrice,quotedAt:e.quotedAt,deliveryDays:e.deliveryDays,remark:e.remark}]));let Y="";const ce=new Map;function A(e){const a=ce.get(e.taskId);return a?{...e,acceptanceStatus:"ACCEPTED",acceptedAt:a.acceptedAt,acceptedBy:a.acceptedBy,updatedAt:a.acceptedAt,auditLogs:[...e.auditLogs,{id:`AL-LEGACY-ACCEPT-${e.taskId}`,action:"ACCEPT_TASK",detail:"旧版非履约考核 Mock 任务确认接单",at:a.acceptedAt,by:a.acceptedBy}]}:e}let v=null,y=null;function K(){return v?[...v.values()]:re(T(),!0).map(A)}function f(e){if(v!=null&&v.has(e))return v.get(e);if(y!=null&&y.has(e))return y.get(e);const a=Fe(e)??_e(e)??null,r=a?A(a):null;return y==null||y.set(e,r),r}function Pt(e){return e===Pe}function $(e){return e?e.taskNo||e.taskId:"-"}function h(e){return e&&(e.productionOrderNo||e.productionOrderId)||"-"}function G(e){return e?e.rootTaskNo||e.taskNo||e.taskId:"-"}function Et(){const e=g.getState().pathname,[,a]=e.split("?");return a||""}function ue(){return new URLSearchParams(Et())}function Nt(){const e=ue().get("tab");if(!e){i.activeTab="pending-accept";return}B.some(a=>a.key===e)?i.activeTab=e:i.activeTab="pending-accept"}function St(e){const a=ue().get("quoteTenderId");if(!a||i.activeTab!=="pending-quote")return;const r=e.find(t=>t.tenderId===a);r&&(i.quotingTenderId=r.tenderId,i.quoteDialogOpen=!0)}function wt(e=new Date){return S(e)}function At(e){return new Date(e.replace(" ","T")).getTime()}function T(){const e=U();return i.selectedFactoryId=(e==null?void 0:e.factoryId)??"",i.selectedFactoryId}function P(e){const a=De(e);return $e(a==null?void 0:a.name,(a==null?void 0:a.code)||(a==null?void 0:a.id)||e)}function le(e){if(!e)return{label:"正常",variant:"secondary"};const a=At(e)-Date.now(),r=a/36e5;return a<0?{label:"接单逾期",variant:"destructive"}:r<4?{label:"即将逾期",variant:"default"}:{label:"正常",variant:"secondary"}}function pe(e){return e==="destructive"?"bg-destructive text-white border-destructive/20":e==="default"?"bg-primary text-primary-foreground border-primary/20":e==="outline"?"bg-background text-foreground border-border":"bg-muted text-muted-foreground border-border"}function Ot(e){const a=e.directPrice??e.dispatchPrice,r=e.currency||e.dispatchPriceCurrency||e.standardPriceCurrency||"IDR",t=e.dispatchPriceUnit||e.standardPriceUnit||e.qtyUnit||"件";return{directPrice:a,currency:r,unit:t}}function me(e,a,r,t=S()){const n=f(e);if(!n)throw new Error("任务不存在或已被移除");const d=j(n);if(d==="PRINT")return We(e,r,t),f(e)??n;if(d==="DYE")return Qe(e,r,t),f(e)??n;if(d==="WATER_SOLUBLE"){const l=Oe(e,r);if(!l.ok)throw new Error(l.message);return f(e)??n}if(n.processBusinessCode==="POST_FINISHING"||n.processCode==="POST_FINISHING"||n.processNameZh==="后道")throw new Error("当前后道任务由回货确认或 QC 生成，不在通用任务接收页接单。");if(D(e))return Ve(e,{factoryId:a,acceptedAt:t,acceptedBy:r});if(w(n)!==null)throw new Error("任务尚未进入统一运行时任务仓，请联系主管处理");if(n.assignedFactoryId&&n.assignedFactoryId!==a)throw new Error("当前登录工厂与任务归属不一致，不能接单");const o=Re(e,{acceptedAt:t,acceptedBy:r});return o||(ce.set(e,{acceptedAt:t,acceptedBy:r}),A(n))}function fe(e,a,r,t,n){if(D(e))return Ze(e,{factoryId:a,reason:r,rejectedAt:t,rejectedBy:n});const o=f(e);if(!o)throw new Error("任务不存在或已被移除");if(w(o)!==null)throw new Error("任务尚未进入统一运行时任务仓，请联系主管处理");if(o.assignedFactoryId&&o.assignedFactoryId!==a)throw new Error("当前登录工厂与任务归属不一致，无权拒单");if(o.acceptanceStatus==="REJECTED")throw new Error("任务已拒单，不可重复拒单");const l=j(o);if(l==="PRINT")return He(e,n,r,t),f(e)??o;if(l==="DYE")return Ye(e,n,r,t),f(e)??o;if(l==="WATER_SOLUBLE"){const m=Ce(e,n,r);if(!m.ok)throw new Error(m.message);const p=f(e);if(!p)throw new Error("水溶加工单拒单后投影失败");return p}if(o.processBusinessCode==="POST_FINISHING"||o.processCode==="POST_FINISHING"||o.processNameZh==="后道")throw new Error("当前后道任务不支持在通用任务接收页拒单，请返回后道专用页面。");return o.acceptanceStatus="REJECTED",o.assignmentStatus="UNASSIGNED",o.assignedFactoryId=void 0,o.assignedFactoryName=void 0,o.updatedAt=t,o.auditLogs=[...o.auditLogs,{id:`AL-REJ-${Date.now()}`,action:"REJECT_TASK",detail:`工厂拒绝接单，原因：${r}`,at:t,by:n}],o}function x(e){if(typeof document>"u"||typeof window>"u")return;const a="pda-task-receive-toast-root";let r=document.getElementById(a);r||(r=document.createElement("div"),r.id=a,r.className="pointer-events-none fixed right-6 top-20 z-[130] flex max-w-sm flex-col gap-2",document.body.appendChild(r));const t=document.createElement("div");t.className="pointer-events-auto rounded-md border bg-background px-4 py-3 text-sm text-foreground shadow-md transition-all duration-200",t.textContent=e,t.style.opacity="0",t.style.transform="translateY(-6px)",r.appendChild(t),window.requestAnimationFrame(()=>{t.style.opacity="1",t.style.transform="translateY(0)"}),window.setTimeout(()=>{t.style.opacity="0",t.style.transform="translateY(-6px)",window.setTimeout(()=>{t.remove(),r&&r.childElementCount===0&&r.remove()},180)},2200)}function Rt(e,a,r,t){return{"pending-accept":e.length,"pending-quote":a.length,quoted:r.length,awarded:t.length}}function Ct(e){const a=pt(e);return Dt(a,i.submittedTenderIds,f,e).map(r=>{const t=r.taskId?f(r.taskId):null,n=oe.get(r.tenderId),d=r.runtimeShared?r.qtyUnit:(t==null?void 0:t.qtyUnit)||r.qtyUnit||r.unit,o=(t==null?void 0:t.standardPriceCurrency)||(t==null?void 0:t.dispatchPriceCurrency)||r.currency;return{tenderId:r.tenderId,taskId:r.taskId,productionOrderId:(t==null?void 0:t.productionOrderId)||r.productionOrderId,processName:t?b(t):r.processName,qty:r.runtimeShared?r.qty:(t==null?void 0:t.qty)??r.qty,qtyUnit:d,quotedPrice:(n==null?void 0:n.quotedPrice)??r.quotedPrice,quotedAt:(n==null?void 0:n.quotedAt)??r.quotedAt,deliveryDays:(n==null?void 0:n.deliveryDays)??r.deliveryDays,tenderStatus:r.tenderStatusLabel,currency:o,unit:d,biddingDeadline:r.biddingDeadline,taskDeadline:(t==null?void 0:t.taskDeadline)||r.taskDeadline,remark:(n==null?void 0:n.remark)??r.remark}}).sort((r,t)=>t.quotedAt.localeCompare(r.quotedAt))}function ge(){const e=T(),a=lt(e);return Tt(a,i.submittedTenderIds,f,e).map(r=>{const t=r.taskId?f(r.taskId):null,n=r.runtimeShared?r.qtyUnit:(t==null?void 0:t.qtyUnit)||r.qtyUnit,d=t?b(t):r.processName;return{tenderId:r.tenderId,taskId:r.taskId,productionOrderId:(t==null?void 0:t.productionOrderId)||r.productionOrderId,processName:d,qty:r.runtimeShared?r.qty:(t==null?void 0:t.qty)??r.qty,qtyUnit:n,biddingDeadline:r.biddingDeadline,taskDeadline:(t==null?void 0:t.taskDeadline)||r.taskDeadline,currency:(t==null?void 0:t.standardPriceCurrency)||(t==null?void 0:t.dispatchPriceCurrency)||r.currency,skuCount:r.skuCount,minPrice:r.minPrice}}).sort((r,t)=>r.biddingDeadline.localeCompare(t.biddingDeadline))}function be(e){const a=K(),r=new Set(mt(e).map(t=>t.taskId));return $t(a,e).filter(t=>D(t.taskId)||r.has(t.taskId)&&w(t)===null).map(t=>({tenderId:Ne(t)||`TENDER-${t.taskId}`,taskId:t.taskId,productionOrderId:t.productionOrderId||"",processName:b(t),qty:t.qty,qtyUnit:t.qtyUnit,awardedPrice:t.dispatchPrice??t.standardPrice??0,currency:t.dispatchPriceCurrency||t.standardPriceCurrency||"CNY",unit:t.dispatchPriceUnit||t.standardPriceUnit||t.qtyUnit||"件",taskDeadline:t.taskDeadline||"",notifiedAt:t.awardedAt||t.updatedAt||t.createdAt,awardNote:t.priceDiffReason||"",execStatus:t.acceptanceStatus==="REJECTED"?"已拒接":t.acceptanceStatus==="PENDING"?"待接单":t.status==="NOT_STARTED"?"待开工":t.status==="IN_PROGRESS"?"进行中":t.status==="BLOCKED"?"生产暂停":t.status==="CANCELLED"?"已中止":"已完工"})).sort((t,n)=>n.notifiedAt.localeCompare(t.notifiedAt))}function qt(e){const a=ht(K(),e);return Pt(e)?a.filter(r=>r.defaultDocType==="PREPARATION_ORDER"||j(r)==="DYE"):a}function jt(e){return e.filter(a=>{var n,d;const r=i.keyword.trim(),t=b(a);return!(r&&!a.taskId.includes(r)&&!(a.taskNo||"").includes(r)&&![h(a),(n=a.sourceSnapshot)==null?void 0:n.designRevisionTaskNo,(d=a.sourceSnapshot)==null?void 0:d.designRevisionTaskId].some(o=>o==null?void 0:o.includes(r))&&!(a.productionOrderId||"").includes(r)&&!t.includes(r))})}function c(e,a,r=!1){return`
    <div>
      <span class="text-muted-foreground">${s(e)}：</span>
      <span class="${r?"font-medium text-primary":"font-medium"}">${s(a)}</span>
    </div>
  `}function M(e){const a=e.coveredProcesses??[];if(a.length===0)return"";const r=a.map(t=>t.craftName?`${t.processName}/${t.craftName}`:t.processName).join("、");return`
    <div class="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">
      覆盖工序：${s(r)}
    </div>
  `}function k(e){return`
    <div class="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <i data-lucide="clipboard-list" class="mb-3 h-12 w-12 opacity-30"></i>
      <p class="text-sm">${s(e)}</p>
    </div>
  `}function xe(e){const a=e.qtyDisplayUnit||e.qtyUnit,r=a==="PIECE"?"件":a==="METER"?"米":a==="BUNDLE"?"扎":a;return`${e.qty} ${r||"单位未记录"}`}function Ut(e){const a=Ot(e);if(a.directPrice==null)return"-";const r=e.dispatchPriceUnit||a.unit;return`${a.directPrice.toLocaleString()} ${a.currency}/${r}`}function ye(e){var a,r;return`
    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
      ${c(((a=e.sourceSnapshot)==null?void 0:a.sourceType)==="DESIGN_REVISION"?"设计改款任务":"生产单号",((r=e.sourceSnapshot)==null?void 0:r.sourceType)==="DESIGN_REVISION"?e.sourceSnapshot.designRevisionTaskNo||e.sourceSnapshot.designRevisionTaskId||"来源未记录":h(e))}
      ${c("工序",b(e))}
      ${c("任务数量",xe(e))}
      ${c("接单截止",e.acceptDeadline||"-")}
      ${c("任务截止",e.taskDeadline||"-")}
      ${c("派单价",Ut(e),!0)}
    </div>
  `}function Ie(){const e=Ge();return e.highlightTask&&(e.focusTaskId||e.taskId)||null}function ve(e){return Ie()===e}function _t(e){if(!e||typeof document>"u"||typeof window>"u")return;const a=`${g.getState().pathname}::${e}`;Y!==a&&(Y=a,window.requestAnimationFrame(()=>{const r=ke(e),t=document.querySelector(`[data-pda-cutting-task-card-id="${r}"]`);t==null||t.scrollIntoView({block:"center"})}))}function Ft(e){return Me(g.getState().pathname,{sourcePageKey:"task-list",taskId:e,focusTaskId:e,highlightTask:!0,autoFocus:!0})}function W(e){return Le(e.taskId,{sourcePageKey:"task-list",taskNo:e.taskNo,productionOrderNo:h(e),focusTaskId:e.taskId,returnTo:g.getState().pathname,highlightTask:!0,autoFocus:!0})}function Lt(e){return Ke(e.taskId,{sourcePageKey:"task-list",taskNo:e.taskNo,productionOrderNo:h(e),focusTaskId:e.taskId,executionOrderId:e.defaultExecutionOrderId,executionOrderNo:e.defaultExecutionOrderNo,returnTo:Ft(e.taskId),highlightTask:!0,autoFocus:!0})}function he(e){return Be(e.taskId,{sourcePageKey:"task-list",taskNo:e.taskNo,productionOrderNo:h(e),focusTaskId:e.taskId,executionOrderId:e.defaultExecutionOrderId,executionOrderNo:e.defaultExecutionOrderNo,focusExecutionOrderId:e.defaultExecutionOrderId,focusExecutionOrderNo:e.defaultExecutionOrderNo,returnTo:Lt(e),highlightTask:!0,autoFocus:!0})}function Bt(e){return`
    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
      ${c("生产单号",h(e))}
      ${c("当前状态",e.taskStateLabel||"待开始")}
      ${c("裁片单数量",`${e.cutPieceOrderCount||0} 张`)}
      ${c("已完成",`${e.completedCutPieceOrderCount||0} 张`)}
      ${c("未完成",`${e.pendingCutPieceOrderCount||0} 张`)}
      ${c("下一步",e.taskNextActionLabel||"查看任务",!0)}
      ${e.exceptionCutPieceOrderCount?c("异常裁片单",`${e.exceptionCutPieceOrderCount} 张`):""}
      ${e.taskProgressLabel?c("进度",e.taskProgressLabel):""}
    </div>
  `}function Kt(e,a){const r=le(e.acceptDeadline||""),t=ve(e.taskId),n=W(e);return`
    <article class="overflow-hidden rounded-lg border bg-card ${t?"border-blue-300 ring-2 ring-blue-100":""}" data-pda-cutting-task-card-id="${s(e.taskId)}">
      <div class="space-y-2 p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate font-mono text-sm font-semibold">${s($(e))}</span>
          <span class="inline-flex shrink-0 items-center rounded border px-1.5 text-[10px] ${E(pe(r.variant))}">${s(r.label)}</span>
        </div>

        ${ye(e)}
        ${M(e)}
        <div class="rounded bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
          当前工厂：<span class="font-medium text-foreground">${s(a)}</span>
        </div>

        ${e.dispatchRemark?`<p class="rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">派单备注：${s(e.dispatchRemark)}</p>`:""}
      </div>

      <div class="border-t px-3 py-2">
        <div class="flex items-center gap-2">
          <button
            class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted"
            data-nav="${s(n)}"
          >接单详情</button>

          <button
            class="inline-flex h-8 min-w-[4rem] items-center justify-center rounded-md border border-destructive/20 bg-destructive px-3 text-xs font-medium text-white hover:bg-destructive/90"
            data-pda-tr-action="open-reject"
            data-task-id="${s(e.taskId)}"
          >拒单</button>

          <button
            class="inline-flex h-8 flex-1 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            data-pda-tr-action="accept-task"
            data-task-id="${s(e.taskId)}"
          >接单</button>
        </div>
      </div>
    </article>
  `}function Gt(e,a){if(N(e))return Kt(e,a);const r=le(e.acceptDeadline||"");return`
    <article class="overflow-hidden rounded-lg border bg-card">
      <div class="space-y-2 p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate font-mono text-sm font-semibold">${s($(e))}</span>
          <span class="inline-flex shrink-0 items-center rounded border px-1.5 text-[10px] ${E(pe(r.variant),r.label==="即将逾期"?"bg-amber-500 text-white border-amber-500":"")}">${s(r.label)}</span>
        </div>

        ${ye(e)}
        ${M(e)}
        <div class="rounded bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
          当前工厂：<span class="font-medium text-foreground">${s(a)}</span>
        </div>

        ${e.dispatchRemark?`<p class="rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">派单备注：${s(e.dispatchRemark)}</p>`:""}
      </div>

      <div class="border-t px-3 py-2">
        <div class="flex items-center gap-2">
          <button
            class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted"
            data-pda-tr-action="open-detail"
            data-task-id="${s(e.taskId)}"
          >查看详情</button>

          <button
            class="inline-flex h-8 min-w-[4rem] items-center justify-center rounded-md border border-destructive/20 bg-destructive px-3 text-xs font-medium text-white hover:bg-destructive/90"
            data-pda-tr-action="open-reject"
            data-task-id="${s(e.taskId)}"
          >拒单</button>

          <button
            class="inline-flex h-8 flex-1 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            data-pda-tr-action="accept-task"
            data-task-id="${s(e.taskId)}"
          >接单</button>
        </div>
      </div>
    </article>
  `}function Mt(e){const a=f(e.taskId),r=a?b(a):e.processName;return`
    <article class="overflow-hidden rounded-lg border bg-card">
      <div class="space-y-2 p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate font-mono text-sm font-semibold">${s(e.tenderId)}</span>
          <span class="inline-flex items-center rounded border border-blue-200 bg-blue-500 px-1.5 text-[10px] text-white">招标中</span>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          ${c("任务编号",$(a))}
          ${c("原始任务",G(a))}
          ${c("生产单号",e.productionOrderId)}
          ${c("工序",r)}
          ${c("任务范围",`${e.skuCount??"-"} 个 SKU（整任务）`)}
          ${c("数量",`${e.qty} ${e.qtyUnit}`)}
          ${c("竞价截止",e.biddingDeadline)}
          ${c("任务截止",e.taskDeadline)}
          ${c("最低允许报价",`${e.minPrice.toLocaleString()} ${e.currency}/${e.qtyUnit}`)}
        </div>
      </div>

      <div class="border-t px-3 py-2">
        <div class="flex items-center gap-2">
          <button
            class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted"
            data-pda-tr-action="open-detail"
            data-task-id="${s(e.taskId)}"
          >查看详情</button>

          <button
            class="inline-flex h-8 flex-1 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            data-pda-tr-action="open-quote"
            data-tender-id="${s(e.tenderId)}"
          >立即报价</button>
        </div>
      </div>
    </article>
  `}function Wt(e){const a=f(e.taskId),r=a?b(a):e.processName;return`
    <article class="overflow-hidden rounded-lg border bg-card">
      <div class="space-y-2 p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate font-mono text-sm font-semibold">${s(e.tenderId)}</span>
          <span class="inline-flex items-center rounded border border-border bg-background px-1.5 text-[10px] text-muted-foreground">${s(e.tenderStatus)}</span>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          ${c("任务编号",$(a))}
          ${c("原始任务",G(a))}
          ${c("生产单号",e.productionOrderId)}
          ${c("工序",r)}
          ${c("数量",`${e.qty} ${e.unit}`)}
          ${c("报价金额",`${e.quotedPrice.toLocaleString()} ${e.currency}/${e.unit}`,!0)}
          ${c("报价时间",e.quotedAt)}
          ${e.deliveryDays?c("交付承诺",`${e.deliveryDays} 天`):""}
          ${c("竞价截止",e.biddingDeadline)}
          ${c("任务截止",e.taskDeadline)}
        </div>
      </div>

      <div class="border-t px-3 py-2">
        <button
          class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted"
          data-pda-tr-action="open-detail"
          data-task-id="${s(e.taskId)}"
        >查看详情</button>
      </div>
    </article>
  `}function Qt(e,a){const r=ft(e,g.getState().pathname),t=ve(e.taskId),n=W(e),d=he(e);return`
    <article class="overflow-hidden rounded-lg border border-green-200 bg-card ${t?"border-blue-300 ring-2 ring-blue-100":""}" data-pda-cutting-task-card-id="${s(e.taskId)}">
      <div class="space-y-3 p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate font-mono text-sm font-semibold">${s($(e))}</span>
          <div class="flex items-center gap-1.5">
            ${t?'<span class="inline-flex shrink-0 items-center rounded border border-blue-200 bg-blue-50 px-1.5 text-[10px] text-blue-700">当前任务</span>':""}
            ${a.execStatus?`<span class="inline-flex shrink-0 items-center rounded border border-border bg-background px-1.5 text-[10px] text-muted-foreground">${s(a.execStatus)}</span>`:""}
            <span class="inline-flex shrink-0 items-center rounded border px-1.5 text-[10px] ${s(gt(e.taskStateLabel))}">${s(e.taskStateLabel||"待开始")}</span>
          </div>
        </div>

        ${Bt(e)}

        ${c("任务截止",a.taskDeadline||"-")}

        ${r.helperText?`<p class="rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">${s(r.helperText)}</p>`:""}
      </div>

      <div class="border-t px-3 py-2">
        ${r.directExec?`
                <div class="flex items-center gap-2">
                  <button
                    class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted"
                    data-nav="${s(n)}"
                  >接单详情</button>

                  <button
                    class="inline-flex h-8 flex-1 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    data-nav="${s(d)}"
                  >
                    ${s(r.label)}
                    <i data-lucide="chevron-right" class="ml-0.5 h-3.5 w-3.5"></i>
                  </button>
                </div>
              `:`
                <button
                  class="inline-flex h-8 w-full items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  data-nav="${s(n)}"
                >
                  ${s(r.label)}
                  <i data-lucide="chevron-right" class="ml-0.5 h-3.5 w-3.5"></i>
                </button>
              `}
      </div>
    </article>
  `}function Ht(e){const a=D(e.taskId),r=f(e.taskId)??a;if(r&&N(r))return Qt(r,e);const t=r?b(r):e.processName,n=!!(r&&r.acceptanceStatus==="PENDING"&&((a==null?void 0:a.assignmentStatus)==="AWARDED"||w(r)!==null));return`
    <article class="overflow-hidden rounded-lg border border-green-200 bg-card">
      <div class="space-y-2 p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate font-mono text-sm font-semibold">${s(e.tenderId)}</span>
          <div class="flex shrink-0 items-center gap-1">
            ${e.execStatus?`<span class="inline-flex items-center rounded border border-border bg-background px-1.5 text-[10px] text-muted-foreground">${s(e.execStatus)}</span>`:""}
            <span class="inline-flex items-center rounded border border-green-600 bg-green-600 px-1.5 text-[10px] text-white">已中标</span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          ${c("任务编号",$(r))}
          ${c("原始任务",G(r))}
          ${c("生产单号",e.productionOrderId)}
          ${c("工序",t)}
          ${c("数量",`${e.qty} ${e.unit}`)}
          ${c("中标价格",`${e.awardedPrice.toLocaleString()} ${e.currency}/${e.unit}`,!0)}
          ${c("任务截止",e.taskDeadline)}
          ${c("平台通知时间",e.notifiedAt)}
        </div>

        ${e.awardNote?`<p class="rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">中标说明：${s(e.awardNote)}</p>`:""}
      </div>

      <div class="border-t px-3 py-2">
        <div class="flex items-center gap-2">
          <button
            class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted"
            data-pda-tr-action="open-detail"
            data-task-id="${s(e.taskId)}"
          >查看任务详情</button>

          ${n?`<button
                  class="inline-flex h-8 flex-1 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  data-pda-tr-action="accept-task"
                  data-task-id="${s(e.taskId)}"
                >确认接单</button>`:`<button
                  class="inline-flex h-8 flex-1 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  data-pda-tr-action="open-exec"
                  data-task-id="${s(e.taskId)}"
                >
                  去执行
                  <i data-lucide="chevron-right" class="ml-0.5 h-3.5 w-3.5"></i>
                </button>`}
        </div>
      </div>
    </article>
  `}function Yt(){if(!i.acceptDialogTaskId)return"";const e=f(i.acceptDialogTaskId)??D(i.acceptDialogTaskId);return e?`
    <div class="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3" data-pda-tr-accept-dialog="true">
      <article class="w-full max-w-md rounded-xl bg-background shadow-xl">
        <header class="border-b px-4 py-3">
          <h2 class="font-semibold">确认接单</h2>
          <p class="mt-1 text-xs text-muted-foreground">请确认任务与接单时间；提交后将以该时间作为履约起点。</p>
        </header>
        <div class="space-y-2 px-4 py-3 text-sm">
          ${c("任务编号",$(e))}
          ${c("工序",b(e))}
          ${c("数量",xe(e))}
          ${c("确认接单时间",i.acceptDialogAcceptedAt,!0)}
        </div>
        <footer class="flex gap-2 border-t px-4 py-3">
          <button class="inline-flex h-9 flex-1 items-center justify-center rounded-md border px-3 text-sm" data-pda-tr-action="close-accept-dialog">取消</button>
          <button class="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-pda-tr-action="confirm-accept-task" data-task-id="${s(e.taskId)}">确认接单</button>
        </footer>
      </article>
    </div>
  `:""}function zt(e){if(!i.quoteDialogOpen)return"";const a=e?f(e.taskId):null,r=a?b(a):(e==null?void 0:e.processName)||"";return`
    <div class="fixed inset-0 z-[120] bg-black/35" data-pda-tr-action="close-quote"></div>
    <div class="fixed inset-0 z-[121] flex items-center justify-center p-4">
      <article class="w-full max-w-sm rounded-lg border bg-background shadow-lg">
        <header class="space-y-1 border-b px-4 py-3">
          <h3 class="text-base font-semibold">立即报价</h3>
          <p class="text-xs text-muted-foreground">
            ${s((e==null?void 0:e.tenderId)||"")} · ${s(r)}
            <br />
            <span class="font-medium text-blue-700">本次报价覆盖整个任务：${(e==null?void 0:e.skuCount)??"-"} 个 SKU，共 ${(e==null?void 0:e.qty)??0} ${s((e==null?void 0:e.qtyUnit)||"件")}，不支持拆分报价。</span>
            <br />
            <span class="font-medium text-amber-600">同一招标单内只允许报价一次，提交后不可修改。</span>
          </p>
        </header>

        <div class="space-y-4 px-4 py-3">
          <div class="space-y-1.5">
            <label class="text-sm font-medium" for="pda-tr-quote-amount">
              报价金额（${s((e==null?void 0:e.currency)||"CNY")}/${s((e==null?void 0:e.qtyUnit)||"件")}）<span class="text-destructive">*</span>
            </label>
            <input
              id="pda-tr-quote-amount"
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              type="number"
              placeholder="请输入报价金额"
              data-pda-tr-field="quoteAmount"
              data-skip-page-rerender="true"
              value="${s(i.quoteAmount)}"
            />
            ${e?`<div class="space-y-1 text-xs text-muted-foreground">
                    <p>最低允许报价：${e.minPrice.toLocaleString()} ${s(e.currency)}/${s(e.qtyUnit)}</p>
                    <p>报价达到最低允许报价即可提交；提交后不可修改。</p>
                  </div>`:""}
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium" for="pda-tr-delivery-days">交付承诺天数（选填）</label>
            <input
              id="pda-tr-delivery-days"
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              type="number"
              placeholder="例如：10"
              data-pda-tr-field="deliveryDays"
              data-skip-page-rerender="true"
              value="${s(i.deliveryDays)}"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium" for="pda-tr-quote-remark">报价备注（选填）</label>
            <textarea
              id="pda-tr-quote-remark"
              class="min-h-[72px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="可填写报价说明或补充说明"
              data-pda-tr-field="quoteRemark"
              data-skip-page-rerender="true"
            >${s(i.quoteRemark)}</textarea>
          </div>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pda-tr-action="close-quote">取消</button>
          <button
            class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            data-pda-tr-action="submit-quote"
            ${i.quoteAmount?"":"disabled"}
          >${i.submittingQuote?"提交中...":"确认提交报价"}</button>
        </footer>
      </article>
    </div>
  `}function Jt(){return i.rejectDialogOpen?`
    <div class="fixed inset-0 z-[120] bg-black/35" data-pda-tr-action="close-reject"></div>
    <div class="fixed inset-0 z-[121] flex items-center justify-center p-4">
      <article class="w-full max-w-sm rounded-lg border bg-background shadow-lg">
        <header class="space-y-1 border-b px-4 py-3">
          <h3 class="text-base font-semibold">拒绝接单</h3>
          <p class="text-xs text-muted-foreground">请填写拒绝原因（必填）</p>
        </header>

        <div class="px-4 py-3">
          <textarea
            class="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="请输入拒绝原因"
            data-pda-tr-field="rejectReason"
          >${s(i.rejectReason)}</textarea>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pda-tr-action="close-reject">取消</button>
          <button
            class="inline-flex h-8 min-w-[5.5rem] items-center justify-center rounded-md bg-destructive px-3 text-sm font-medium text-white hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60"
            data-pda-tr-action="confirm-reject"
            ${i.rejectReason.trim()?"":"disabled"}
          >确认拒单</button>
        </footer>
      </article>
    </div>
  `:""}function Vt(e){const a=re().filter(t=>tt(t)).filter(t=>t.assignedFactoryId&&_(t.assignedFactoryId)).filter(t=>{var d;const n=i.keyword.trim().toLowerCase();return n?[t.taskId,t.taskNo,t.productionOrderId,h(t),(d=t.sourceSnapshot)==null?void 0:d.designRevisionTaskNo,t.saleTypeSnapshot].some(o=>String(o||"").toLowerCase().includes(n)):!0}),r=`
    <div class="flex min-h-[760px] flex-col bg-background">
      <header class="sticky top-0 z-20 space-y-3 border-b bg-background px-4 py-3">
        <div>
          <h1 class="text-base font-semibold">接单查看</h1>
          <p class="mt-1 text-xs text-muted-foreground">${s(e)} 的 KOL 整单任务由系统固定分配并自动接收；本页仅供查看。</p>
        </div>
        <div class="relative">
          <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
          <input class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" placeholder="搜索任务号 / 生产单号" data-pda-tr-field="keyword" value="${s(i.keyword)}" />
        </div>
      </header>
      <main class="flex-1 space-y-3 p-4">
        ${a.length===0?k("暂无 KOL 整单任务"):a.map(t=>{var l,m,p,u,I,Q;const n=Ee.find(Te=>Te.productionOrderId===t.productionOrderId),d=((l=n==null?void 0:n.techPackSnapshot)==null?void 0:l.imageSnapshot.styleImages[0])||((m=n==null?void 0:n.techPackSnapshot)==null?void 0:m.imageSnapshot.productImages[0])||((p=n==null?void 0:n.techPackSnapshot)==null?void 0:p.imageSnapshot.sampleImages[0])||"",o=`${((u=n==null?void 0:n.techPackSnapshot)==null?void 0:u.styleName)||(n==null?void 0:n.demandSnapshot.spuName)||"KOL样衣"}款式图`;return`
          <article class="overflow-hidden rounded-lg border border-blue-200 bg-card">
            <div class="space-y-3 p-3">
              <div class="flex items-center justify-between gap-2">
                <span class="font-mono text-sm font-semibold">${s(t.taskNo||t.taskId)}</span>
                <span class="rounded bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">已自动接收</span>
              </div>
              <div class="flex gap-3">
                ${d?`<button class="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted" data-pda-tr-action="open-kol-image" data-image-url="${s(d)}" data-image-alt="${s(o)}"><img src="${s(d)}" alt="${s(o)}" class="h-full w-full object-cover" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><span hidden class="px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>`:'<div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 p-2 text-center text-[11px] text-red-700">缺少对应款式图</div>'}
                <div class="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-1 text-xs">
                ${c(((I=t.sourceSnapshot)==null?void 0:I.sourceType)==="DESIGN_REVISION"?"设计改款任务":"生产单号",((Q=t.sourceSnapshot)==null?void 0:Q.sourceType)==="DESIGN_REVISION"?t.sourceSnapshot.designRevisionTaskNo||t.sourceSnapshot.designRevisionTaskId||"来源未记录":h(t))}
                ${c("售卖类型",t.saleTypeSnapshot||"-")}
                ${c("任务",b(t))}
                ${c("数量",`${t.qty} ${t.qtyDisplayUnit||"件"}`)}
                ${c("固定总价",`${Number(t.fixedTotalPrice||0).toLocaleString()} ${t.fixedTotalPriceCurrency||"IDR"}/${t.fixedTotalPriceUnit||"整单"}`,!0)}
                ${c("任务截止",t.taskDeadline||"-")}
                </div>
              </div>
              ${M(t)}
            </div>
            <div class="border-t px-3 py-2">
              <button class="inline-flex h-8 w-full items-center justify-center rounded-md border px-3 text-xs" data-pda-tr-action="open-detail" data-task-id="${s(t.taskId)}">查看任务详情</button>
            </div>
          </article>
        `}).join("")}
      </main>
      ${i.kolImageUrl?`<div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4" data-pda-tr-action="close-kol-image"><button class="absolute right-4 top-4 rounded-full bg-white px-3 py-2 text-sm" data-pda-tr-action="close-kol-image">关闭</button><img src="${s(i.kolImageUrl)}" alt="${s(i.kolImageAlt)}" class="max-h-[85vh] max-w-full rounded-xl object-contain" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><div hidden class="rounded-xl bg-white p-8 text-sm text-red-700">图片加载失败，请核对原图素材。</div></div>`:""}
    </div>
  `;return ae(r,"task-receive")}function Zt(){y=new Map;try{return Xt()}finally{v=null,y=null}}function Xt(){if(!U())return et();Nt();const e=T(),a=P(e);if(_t(Ie()),_(e))return rt(),Vt(a);v=new Map(K().map(u=>[u.taskId,u]));const r=qt(e),t=ge();St(t);const n=Ct(e),d=be(e),o=jt(r),l=Rt(r,t,n,d),m=t.find(u=>u.tenderId===i.quotingTenderId)??null,p=`
    <div class="flex min-h-[760px] flex-col bg-background">
      <header class="sticky top-0 z-30 border-b bg-background px-4 py-3">
        <div class="relative">
          <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
          <input
            class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
            placeholder="搜索任务号 / 招标单号 / 生产单号"
            data-pda-tr-field="keyword"
            value="${s(i.keyword)}"
          />
        </div>
      </header>

      <div class="sticky top-[auto] z-20 flex border-b bg-background">
        ${B.map(u=>{const I=u.key===i.activeTab;return`
            <button
              class="flex-1 border-b-2 py-2.5 text-xs font-medium transition-colors ${E(I?"border-primary text-primary":"border-transparent text-muted-foreground")}"
              data-pda-tr-action="switch-tab"
              data-tab="${u.key}"
            >
              ${s(u.label)}
              ${l[u.key]>0?`<span class="ml-1 inline-block rounded-full px-1.5 py-0 text-[10px] leading-4 ${E(I?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground")}">${l[u.key]}</span>`:""}
            </button>
          `}).join("")}
      </div>

      <div class="flex-1 space-y-3 p-4">
        ${i.activeTab==="pending-accept"?o.length===0?k("暂无待接单任务"):o.map(u=>Gt(u,a)).join(""):""}

        ${i.activeTab==="pending-quote"?`
              <div class="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-muted-foreground">
                <i data-lucide="info" class="h-3.5 w-3.5 shrink-0 text-blue-500"></i>
                同一招标单内，同一工厂只允许报价一次，提交后不可修改。
              </div>
              ${t.length===0?k("暂无待报价招标单"):t.map(u=>Mt(u)).join("")}
            `:""}

        ${i.activeTab==="quoted"?`
              <div class="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <i data-lucide="alert-circle" class="h-3.5 w-3.5 shrink-0"></i>
                同一招标单内同一工厂只允许报价一次，不支持再次报价或修改报价。
              </div>
              ${n.length===0?k("暂无已报价记录"):n.map(u=>Wt(u)).join("")}
            `:""}

        ${i.activeTab==="awarded"?`
              <div class="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-muted-foreground">
                <i data-lucide="info" class="h-3.5 w-3.5 shrink-0 text-green-600"></i>
                含车缝任务中标后请先确认接单；确认时间将作为交付时效起点。
              </div>
              ${d.length===0?k("暂无已中标任务"):d.map(u=>Ht(u)).join("")}
            `:""}
      </div>

      ${zt(m)}
      ${Jt()}
      ${Yt()}
    </div>
  `;return ae(p,"task-receive")}function z(){i.quoteDialogOpen=!1,i.quotingTenderId=null,i.quoteAmount="",i.deliveryDays="",i.quoteRemark="",i.submittingQuote=!1,g.getState().pathname.includes("quoteTenderId=")&&g.navigate("/fcs/pda/task-receive?tab=pending-quote")}function J(){i.rejectDialogOpen=!1,i.rejectingTaskId="",i.rejectReason=""}async function er(e){var n;if(!Xe())return!0;const a=e.closest("[data-pda-tr-field]");if(a instanceof HTMLInputElement||a instanceof HTMLSelectElement||a instanceof HTMLTextAreaElement){const d=a.dataset.pdaTrField;if(!d)return!0;if(d==="keyword")return i.keyword=a.value,!0;if(d==="quoteAmount"){i.quoteAmount=a.value;const o=(n=a.closest("article"))==null?void 0:n.querySelector('[data-pda-tr-action="submit-quote"]');return o&&(o.disabled=!i.quoteAmount),!0}if(d==="deliveryDays")return i.deliveryDays=a.value,!0;if(d==="quoteRemark")return i.quoteRemark=a.value,!0;if(d==="rejectReason")return i.rejectReason=a.value,!0}const r=e.closest("[data-pda-tr-action]");if(!r)return!1;const t=r.dataset.pdaTrAction;if(!t)return!1;if(t==="open-kol-image")return i.kolImageUrl=r.dataset.imageUrl||"",i.kolImageAlt=r.dataset.imageAlt||"",!0;if(t==="close-kol-image")return i.kolImageUrl="",i.kolImageAlt="",!0;if(_(T())&&["open-reject","confirm-reject","accept-task","confirm-accept-task","open-quote","submit-quote"].includes(t))return x("KOL-GOTO 接单页仅支持查看"),!0;if(t==="switch-tab"){const d=r.dataset.tab;return d&&B.some(o=>o.key===d)&&(i.activeTab=d,g.navigate(`/fcs/pda/task-receive?tab=${d}`)),!0}if(t==="open-detail"){const d=r.dataset.taskId;if(d){const o=f(d);N(o)?g.navigate(W(o)):g.navigate(te(d,g.getState().pathname))}return!0}if(t==="open-exec"){const d=r.dataset.taskId;if(d){const o=f(d);N(o)?g.navigate(he(o)):g.navigate(ee(d,g.getState().pathname))}return!0}if(t==="open-reject"){const d=r.dataset.taskId;return d&&(i.rejectingTaskId=d,i.rejectReason="",i.rejectDialogOpen=!0),!0}if(t==="close-reject")return J(),!0;if(t==="confirm-reject"){if(!i.rejectReason.trim()||!i.rejectingTaskId)return!0;const d=T(),o=P(d);try{const l=i.rejectingTaskId,m=i.rejectReason.trim(),p=()=>fe(l,d,m,S(),o);D(l)?await O(JSON.stringify({action:"reject-runtime",taskId:l,factoryId:d,reason:m}),p):await H(l,p),J(),x("已拒绝接单")}catch(l){x(l instanceof Error?l.message:"拒单失败，请联系主管处理")}return!0}if(t==="accept-task"){const d=r.dataset.taskId;return d&&(i.acceptDialogTaskId=d,i.acceptDialogAcceptedAt=S()),!0}if(t==="close-accept-dialog")return i.acceptDialogTaskId="",i.acceptDialogAcceptedAt="",!0;if(t==="confirm-accept-task"){const d=r.dataset.taskId||i.acceptDialogTaskId,o=T(),l=P(o);if(d&&d===i.acceptDialogTaskId)try{const m=U(),p=i.acceptDialogAcceptedAt;ze(d);const u=()=>{me(d,o,l,p),Je(d,(m==null?void 0:m.userName)||l,p)};D(d)?await O(JSON.stringify({action:"accept-runtime",taskId:d,factoryId:o,acceptedAt:p}),u):await H(d,u),i.acceptDialogTaskId="",i.acceptDialogAcceptedAt="",x("接单成功")}catch(m){x(m instanceof Error?m.message:"接单失败，请联系主管处理")}return!0}if(t==="open-quote"){const d=r.dataset.tenderId;return d&&(i.quotingTenderId=d,i.quoteDialogOpen=!0,i.quoteAmount="",i.deliveryDays="",i.quoteRemark=""),!0}if(t==="close-quote")return z(),!0;if(t==="submit-quote"){if(!i.quoteAmount||Number.isNaN(Number(i.quoteAmount))||Number(i.quoteAmount)<=0)return x("请填写有效的报价金额"),!0;const d=i.quotingTenderId;if(!d)return!0;const o=je(d),l=o?{minPrice:o.minPrice,currency:o.currency,qtyUnit:o.unit}:ge().find(u=>u.tenderId===d);if(l&&Number(i.quoteAmount)<l.minPrice)return x(`报价不能低于最低允许报价 ${l.minPrice.toLocaleString()} ${l.currency}/${l.qtyUnit}`),!0;const m=wt(),p={quotedPrice:Number(i.quoteAmount),quotedAt:m,deliveryDays:Number(i.deliveryDays||"0")||0,remark:i.quoteRemark.trim()};try{if(o){const u=T(),I={factoryId:u,factoryName:P(u),quotePrice:p.quotedPrice,quoteTime:p.quotedAt,deliveryDays:p.deliveryDays,remark:p.remark};await O(JSON.stringify({action:"quote-runtime",taskId:o.taskId,...I}),()=>Ue(o.taskId,I))}i.submittedTenderIds=new Set([...i.submittedTenderIds,d]),oe.set(d,p),z(),x("报价提交成功，同一招标单内只允许报价一次，不可修改。")}catch(u){x(u instanceof Error?u.message:"报价提交失败，请刷新后重试")}return!0}return!1}const Tr=Object.freeze(Object.defineProperty({__proto__:null,acceptPdaTaskWithRuntimeFallback:me,closePdaTaskReceiveDialogsOnEscape:kt,handlePdaTaskReceiveEvent:er,listPdaAwardedTendersForFactory:be,projectPdaTaskLegacyAcceptance:A,rejectPdaTaskWithRuntimeFallback:fe,renderPdaTaskReceivePage:Zt},Symbol.toStringTag,{value:"Module"}));export{F as P,me as a,ct as b,ft as c,Tr as d,gt as g,A as p,fe as r};

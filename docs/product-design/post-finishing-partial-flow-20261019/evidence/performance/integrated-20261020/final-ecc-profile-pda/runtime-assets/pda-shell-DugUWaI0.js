import{l as h}from"./pda-cutting-execution-source-uIq8FEqe.js";import{p as z,q as V,m as q,a1 as Y,z as Z,ah as J,V as X}from"./pda-handover-events-B831zbrP.js";import{C as tt}from"./store-domain-settlement-seeds-BweK6w0L.js";import{f as g,F as S,a as et,u as ot}from"./post-finishing-full-flow-B0RbQ2h7.js";import{l as rt}from"./process-mobile-task-binding-DLqmlvIx.js";import{S as dt,f as at,B as nt}from"./runtime-process-tasks-CbZsymnr.js";import{l as st,b as it}from"./runtime-task-tenders-DidPsf9Y.js";import{p as lt,g as ct}from"./production-orders-CPoChzPl.js";import{a as ut}from"./production-order-runtime-store-_3ND_kP3.js";import{l as $}from"./special-craft-task-orders-2PruoLXM.js";import{K as P,M as I,ah as pt,x as s,aO as B,f as ft}from"./app-shared-DDMaqtkq.js";import{e as mt,P as bt}from"./factory-onboarding-flow-DZ9Gz-dC.js";import{aM as Tt}from"./craft-display-support-CQLa2Q19.js";import{s as yt,P as gt}from"./pda-sewing-self-return-mode-CVT5AEl1.js";import{r as E}from"./index-BYi5bqw5.js";import{getPdaRuntimeContext as T}from"./pda-runtime-WjdrOLOn.js";function It(t){switch(t.todoType){case"待报价":return t.detailRoute||"/fcs/pda/task-receive?tab=pending-quote";case"待接单":return t.relatedTaskId?`/fcs/pda/task-receive/${t.relatedTaskId}`:"/fcs/pda/task-receive";case"待交出":return(t.executionProcessType==="WOOL"||t.executionProcessType==="SPECIAL_CRAFT")&&t.relatedTaskId?`/fcs/pda/handover?tab=handout&taskId=${encodeURIComponent(t.relatedTaskId)}`:t.relatedHandoverOrderId?`/fcs/pda/handover/${t.relatedHandoverOrderId}`:"/fcs/pda/handover";case"待接收":return t.relatedHandoverOrderId?`/fcs/pda/handover/${t.relatedHandoverOrderId}`:"/fcs/pda/handover";case"待开工":case"待完工":case"待加工填报":case"加工领料":case"异常待处理":return t.relatedTaskId?`/fcs/pda/exec/${t.relatedTaskId}`:"/fcs/pda/exec";case"待确认接收":return(t.executionProcessType==="WOOL"||t.executionProcessType==="SPECIAL_CRAFT")&&t.relatedTaskId?`/fcs/pda/handover?tab=pickup&taskId=${encodeURIComponent(t.relatedTaskId)}`:t.relatedTaskId?`/fcs/pda/exec/${t.relatedTaskId}`:"/fcs/pda/exec";case"差异待处理":return t.relatedOutboundRecordId?"/fcs/pda/warehouse/outbound-records":t.relatedInboundRecordId?"/fcs/pda/warehouse/inbound-records":"/fcs/pda/handover";case"对账待确认":return"/fcs/pda/settlement";default:return"/fcs/pda/task-receive"}}function H(t){const e=t.trim().toLocaleUpperCase(),o="FCS:WORK_ORDER:V1:";return e.startsWith(o)?e.slice(o.length):e}function j(t,e){return H(t||"")===e}function Nt(t,e){return[t.taskOrderNo,t.taskOrderId,t.sourceTaskNo,t.sourceTaskId].some(o=>j(o,e))}function xt(t,e){return[t.productionOrderNo,t.productionOrderId].some(o=>j(o,e))}function $t(t,e){return e==="RECEIVE"?t.status==="待接收":e==="HANDOVER"?["加工中","已完结"].includes(t.status)&&t.completedQty>(t.returnedQty||0):t.status==="加工中"}function vt(t){return t==="RECEIVE"?"该加工单当前不能确认接收，请核对是否已接收或已完结。":t==="HANDOVER"?"当前没有可交出的加工成品，请先到“执行”完成加工填报。":"当前没有可执行动作，请先到“交接”确认接收，或核对加工单是否已完成。"}function R(t){var n;const e=lt.find(d=>d.productionOrderId===t.productionOrderId||d.productionOrderNo===t.productionOrderNo),o=ut.find(d=>d.demandId===(e==null?void 0:e.demandId)||d.productionOrderId===t.productionOrderId),a=(n=ct(t.productionOrderId))==null?void 0:n.imageSnapshot,r=[...(a==null?void 0:a.styleImages)||[],...(a==null?void 0:a.productImages)||[],(o==null?void 0:o.imageUrl)||""].find(d=>/^(?:https?:\/\/|\/|data:image\/)/i.test(d.trim()))||"";return{sourceType:"SPECIAL_CRAFT",workOrderId:t.taskOrderId,workOrderNo:t.taskOrderNo,order:t,sourceTaskId:t.sourceTaskId||"",sourceTaskNo:t.sourceTaskNo||"",styleNo:(e==null?void 0:e.demandSnapshot.spuCode)||(o==null?void 0:o.spuCode)||t.productionOrderNo,styleName:(e==null?void 0:e.demandSnapshot.spuName)||(o==null?void 0:o.spuName)||t.operationName,styleImageUrl:r}}function me(t,e,o){const a=H(t);if(!a)return{status:"EMPTY",message:"请扫描生产单码或加工单码。",candidates:[]};const r=$(),n=r.filter(l=>Nt(l,a)),d=n.length>0?n:r.filter(l=>xt(l,a));if(d.length===0)return{status:"NOT_FOUND",message:`未识别到生产单或加工单：${t.trim()}`,candidates:[]};const b=d.filter(l=>l.factoryId===e);if(b.length===0)return{status:"FORBIDDEN",message:"该单不属于当前登录工厂，不能操作。",candidates:[]};const c=b.filter(l=>$t(l,o)).map(R).sort((l,i)=>l.order.taskOrderNo.localeCompare(i.order.taskOrderNo,"zh-CN"));return c.length===0?{status:"UNAVAILABLE",message:vt(o),candidates:[]}:c.length===1?{status:"MATCH",message:"已识别加工单。",candidates:[c[0]]}:{status:"MULTIPLE",message:`该生产单包含 ${c.length} 张可操作加工单，请选择加工单。`,candidates:c}}function be(t){return $().some(e=>e.factoryId===t)}function Te(t){const e=$().find(o=>o.taskOrderId===t);return e?R(e):null}function At(t){return $().filter(e=>e.sourceTaskId===t).map(R).sort((e,o)=>e.workOrderNo.localeCompare(o.workOrderNo,"zh-CN"))}function Ot(t){const e=At(t);return e.length===1?e[0]:null}function N(t){if(!t)return Number.NaN;const e=t.includes("T")?t:t.replace(" ","T"),o=new Date(e).getTime();return Number.isFinite(o)?o:Number.NaN}function ht(t,e=new Date){const o=N(t);if(!Number.isFinite(o))return!1;const a=new Date(o);return a.getFullYear()===e.getFullYear()&&a.getMonth()===e.getMonth()&&a.getDate()===e.getDate()}function u(t,e="待处理"){if(e==="处理中")return"加急";const o=N(t)-Date.now();return Number.isFinite(o)&&o<=12*3600*1e3?"紧急":Number.isFinite(o)&&o<=24*3600*1e3?"加急":"普通"}function St(t){return t.status==="DONE"?"已处理":t.status==="BLOCKED"?"处理中":"待处理"}function y(t,e){return`${t.taskUnitType==="WHOLE_ORDER_TASK"?t.taskCategoryZh||t.processNameZh||"整单任务":t.taskUnitType==="MERGED_PRODUCTION_TASK"?t.taskCategoryZh||t.processNameZh||"合并任务":t.processNameZh||"工序"}${e}`}function K(t){return st().filter(e=>it(e)==="BIDDING").filter(e=>e.factoryPool.some(o=>o.factoryId===t)).filter(e=>!e.quotes.some(o=>o.factoryId===t)).map((e,o)=>{const a=e.factoryPool.find(r=>r.factoryId===t);return{todoId:`todo-tender-quote-${e.tenderId}-${t}`,todoNo:`TD-BID-${String(o+1).padStart(3,"0")}`,todoType:"待报价",todoTitle:`${e.taskSnapshot.processName}任务竞价邀请`,todoSubtitle:`${e.taskSnapshot.productionOrderNo||e.taskSnapshot.productionOrderId} · ${e.taskSnapshot.skuLines.length} 个 SKU · ${e.taskSnapshot.qty} ${e.taskSnapshot.qtyUnit}`,factoryId:t,factoryName:(a==null?void 0:a.factoryName)||t,relatedTaskId:e.taskId,relatedTaskNo:e.taskSnapshot.taskNo||e.taskId,relatedTenderId:e.tenderId,priority:u(e.biddingDeadline),status:"待处理",dueAt:e.biddingDeadline,createdAt:e.assignmentOperatedAt,detailRoute:`/fcs/pda/task-receive?tab=pending-quote&quoteTenderId=${encodeURIComponent(e.tenderId)}`,actionLabel:"去报价"}})}function k(t){return t.taskUnitType==="MERGED_PRODUCTION_TASK"}function x(t){return t.processBusinessCode==="WOOL"||t.processCode==="PROC_WOOL"}function C(t){const e=t,o=e.woolAllowedActions||[],a=at().workOrders[e.woolOrderId||""],r=(a==null?void 0:a.stage)==="LINKING"?"缝盘加工单":"横机加工单";return a&&o.every(n=>n==="DETAIL")&&nt(a).length?{todoType:"异常待处理",title:`${r}资料不完整，请核对技术包`}:o.includes("COMPLETE")?{todoType:"待完工",title:`${r}待确认完单`}:o.includes("HANDOVER")?{todoType:"待交出",title:`${r}待发起交出`}:o.includes("REPORT_PROCESS")?{todoType:"待加工填报",title:`${r}可加工填报`}:o.includes("RECEIVE_PIECES")?{todoType:"待确认接收",title:`${r}待确认接收外加工回货片`}:o.includes("RECEIVE_YARN")?{todoType:"待确认接收",title:`${r}待确认接收纱线`}:{todoType:"待开工",title:(a==null?void 0:a.stage)==="LINKING"&&!a.externalPieces.length?`${r}等待横机填报同步`:`${r}等待上游准备`}}function F(t){var o;const e=(o=Ot(t.taskId))==null?void 0:o.order;return e?e.status==="待接收"?{todoType:"待确认接收",title:`${e.operationName}加工单待确认接收`}:e.status==="已完结"&&e.completedQty>(e.returnedQty||0)?{todoType:"待交出",title:`${e.operationName}已完结加工单仍有成品待交出`}:e.status!=="加工中"?null:e.completedQty>(e.returnedQty||0)?{todoType:"待交出",title:`${e.operationName}加工单待发起交出`}:e.completedQty>=e.planQty?{todoType:"待完工",title:`${e.operationName}加工单待确认完成`}:{todoType:"待加工填报",title:`${e.operationName}加工单可加工填报`}:null}function Rt(t,e){return e.filter(o=>o.assignedFactoryId===t&&!x(o)&&(!o.acceptanceStatus||o.acceptanceStatus==="PENDING")&&o.assignmentMode==="DIRECT").map((o,a)=>({todoId:`todo-accept-${o.taskId}`,todoNo:`TD-AC-${String(a+1).padStart(3,"0")}`,todoType:"待接单",todoTitle:y(o,"待接单"),todoSubtitle:`${o.productionOrderNo||o.productionOrderId} · ${o.taskNo||o.taskId}`,factoryId:t,factoryName:o.assignedFactoryName||o.assignedFactoryId||t,relatedTaskId:o.taskId,relatedTaskNo:o.taskNo||o.taskId,priority:u(o.acceptDeadline),status:"待处理",dueAt:o.acceptDeadline,createdAt:o.dispatchedAt||o.createdAt||o.acceptDeadline||"",detailRoute:`/fcs/pda/notify/todo-accept-${o.taskId}`,actionLabel:"去处理"}))}function Dt(t){return ot().filter(e=>e.managedPostFactoryId===t&&e.acceptanceStatus==="PENDING").map((e,o)=>({todoId:`todo-post-accept-${e.postTaskId}`,todoNo:`TD-PA-${String(o+1).padStart(3,"0")}`,todoType:"待接单",todoTitle:"后道生产任务待接单",todoSubtitle:`${e.productionOrderNo} · ${e.postTaskNo} · ${e.spuName}`,factoryId:t,factoryName:e.managedPostFactoryName,relatedTaskId:e.postTaskId,relatedTaskNo:e.postTaskNo,priority:u(e.createdAt),status:"待处理",dueAt:e.createdAt,createdAt:e.createdAt,detailRoute:`/fcs/pda/notify/todo-post-accept-${e.postTaskId}`,actionLabel:"去处理"}))}function U(t,e){return e.filter(o=>o.assignedFactoryId===t&&(x(o)||o.acceptanceStatus==="ACCEPTED")&&["NOT_STARTED","IN_PROGRESS","BLOCKED"].includes(o.status))}function Pt(t,e){const o=U(t,e),a=o.filter(d=>d.status==="NOT_STARTED").map((d,b)=>{const c=x(d)?C(d):null,l=c?null:F(d),i=c||l;return{todoId:`todo-start-${d.taskId}`,todoNo:`TD-ST-${String(b+1).padStart(3,"0")}`,todoType:(i==null?void 0:i.todoType)||"待开工",todoTitle:(i==null?void 0:i.title)||y(d,"待开工"),todoSubtitle:`${d.productionOrderNo||d.productionOrderId} · ${d.taskNo||d.taskId}`,factoryId:t,factoryName:d.assignedFactoryName||d.assignedFactoryId||t,relatedTaskId:d.taskId,relatedTaskNo:d.taskNo||d.taskId,executionProcessType:c?"WOOL":l?"SPECIAL_CRAFT":void 0,priority:u(d.taskDeadline),status:St(d),dueAt:d.taskDeadline,createdAt:d.acceptedAt||d.createdAt||d.taskDeadline||"",detailRoute:i?`/fcs/pda/exec/${d.taskId}`:`/fcs/pda/notify/todo-start-${d.taskId}`,actionLabel:"去处理"}}),r=o.filter(d=>d.status==="IN_PROGRESS").map((d,b)=>{const c=x(d)?C(d):null,l=c?null:F(d),i=c||l;return{todoId:`todo-finish-${d.taskId}`,todoNo:`TD-FN-${String(b+1).padStart(3,"0")}`,todoType:(i==null?void 0:i.todoType)||(k(d)?"待交出":"待完工"),todoTitle:(i==null?void 0:i.title)||(k(d)?`${y(d,"待交出")}，交出即结束本次合并任务`:y(d,"待完工")),todoSubtitle:`${d.productionOrderNo||d.productionOrderId} · ${d.taskNo||d.taskId}`,factoryId:t,factoryName:d.assignedFactoryName||d.assignedFactoryId||t,relatedTaskId:d.taskId,relatedTaskNo:d.taskNo||d.taskId,executionProcessType:c?"WOOL":l?"SPECIAL_CRAFT":void 0,priority:u(d.taskDeadline,"处理中"),status:"处理中",dueAt:d.taskDeadline,createdAt:d.startedAt||d.acceptedAt||d.taskDeadline||"",detailRoute:i?`/fcs/pda/exec/${d.taskId}`:`/fcs/pda/notify/todo-finish-${d.taskId}`,actionLabel:"去处理"}}),n=o.filter(d=>d.status==="BLOCKED").map((d,b)=>({todoId:`todo-exception-${d.taskId}`,todoNo:`TD-EX-${String(b+1).padStart(3,"0")}`,todoType:"异常待处理",todoTitle:y(d,"异常待处理"),todoSubtitle:`${d.productionOrderNo||d.productionOrderId} · ${d.blockReason||"待确认原因"}`,factoryId:t,factoryName:d.assignedFactoryName||d.assignedFactoryId||t,relatedTaskId:d.taskId,relatedTaskNo:d.taskNo||d.taskId,priority:"紧急",status:"处理中",dueAt:d.taskDeadline,createdAt:d.blockedAt||d.updatedAt||d.taskDeadline||"",detailRoute:`/fcs/pda/notify/todo-exception-${d.taskId}`,actionLabel:"去处理"}));return[...a,...r,...n]}function Et(t){return rt().filter(o=>o.assignedFactoryId===t&&o.acceptanceStatus==="ACCEPTED").filter(o=>o.status!=="DONE").map((o,a)=>{const r=o.status==="BLOCKED"||o.status==="IN_PROGRESS"?"处理中":"待处理",n=o.status==="BLOCKED"?"异常待处理":o.status==="IN_PROGRESS"?"待完工":"待开工";return{todoId:`todo-post-exec-${o.taskId}`,todoNo:`TD-PE-${String(a+1).padStart(3,"0")}`,todoType:n,todoTitle:`后道生产任务${n}`,todoSubtitle:`${o.productionOrderId} · ${o.taskNo||o.taskId}`,factoryId:t,factoryName:o.assignedFactoryName||t,relatedTaskId:o.taskId,relatedTaskNo:o.taskNo||o.taskId,priority:o.status==="BLOCKED"?"紧急":u(o.taskDeadline,r),status:r,dueAt:o.taskDeadline||o.updatedAt||o.createdAt,createdAt:o.startedAt||o.acceptedAt||o.createdAt||"",detailRoute:`/fcs/pda/notify/todo-post-exec-${o.taskId}`,actionLabel:"去处理"}})}function kt(t){return X(t).map((e,o)=>({todoId:`todo-pickup-${e.handoverId}`,todoNo:`TD-PU-${String(o+1).padStart(3,"0")}`,todoType:"待接收",todoTitle:`${e.processName}待接收`,todoSubtitle:`${e.productionOrderNo||e.productionOrderId} · ${e.objectSummary}`,factoryId:t,factoryName:e.factoryName||t,relatedTaskId:e.taskId,relatedTaskNo:e.taskNo,relatedHandoverOrderId:e.handoverId,priority:u(e.deadlineAt),status:"待处理",dueAt:e.deadlineAt,createdAt:e.createdAt||"",detailRoute:`/fcs/pda/notify/todo-pickup-${e.handoverId}`,actionLabel:"确认"}))}function Ct(t){return z().map((e,o)=>({todoId:`todo-post-pickup-${e.handoverId}`,todoNo:`TD-PP-${String(o+1).padStart(3,"0")}`,todoType:"待接收",todoTitle:"后道待接收上游交出",todoSubtitle:`${e.productionOrderNo||"-"} · ${e.sourceDocNo||e.objectSummary||e.scopeLabel||""}`,factoryId:t,factoryName:e.factoryName||e.targetName||t,relatedTaskId:e.taskId,relatedTaskNo:e.taskNo,relatedHandoverOrderId:e.handoverId,priority:u(e.deadlineAt||e.lastRecordAt||e.completedByWarehouseAt),status:"待处理",dueAt:e.deadlineAt||e.lastRecordAt||e.completedByWarehouseAt,createdAt:e.lastRecordAt||e.completedByWarehouseAt||"",detailRoute:`/fcs/pda/notify/todo-post-pickup-${e.handoverId}`,actionLabel:"确认"}))}function Ft(t){return q(t).map((e,o)=>({todoId:`todo-handout-${e.handoverId}`,todoNo:`TD-HO-${String(o+1).padStart(3,"0")}`,todoType:"待交出",todoTitle:`${e.processName}待交出`,todoSubtitle:`${e.productionOrderNo||e.productionOrderId} · ${e.objectSummary}`,factoryId:t,factoryName:e.factoryName||t,relatedTaskId:e.taskId,relatedTaskNo:e.taskNo,relatedHandoverOrderId:e.handoverId,priority:u(e.deadlineAt,"处理中"),status:"处理中",dueAt:e.deadlineAt,createdAt:e.createdAt||"",detailRoute:`/fcs/pda/notify/todo-handout-${e.handoverId}`,actionLabel:"去处理"}))}function Lt(t){return V().map((e,o)=>({todoId:`todo-post-handout-${e.handoverId}`,todoNo:`TD-PH-${String(o+1).padStart(3,"0")}`,todoType:"待交出",todoTitle:"后道待交出",todoSubtitle:`${e.productionOrderNo||"-"} · ${e.sourceDocNo||e.scopeLabel||e.objectSummary||""}`,factoryId:t,factoryName:e.factoryName||e.sourceFactoryName||t,relatedTaskId:e.taskId,relatedTaskNo:e.taskNo,relatedHandoverOrderId:e.handoverId,priority:u(e.deadlineAt||e.lastRecordAt,"处理中"),status:"处理中",dueAt:e.deadlineAt||e.lastRecordAt,createdAt:e.lastRecordAt||"",detailRoute:`/fcs/pda/notify/todo-post-handout-${e.handoverId}`,actionLabel:"去处理"}))}function wt(t){const e=Y().filter(r=>r.factoryId===t&&r.status==="差异待处理").map((r,n)=>({todoId:`todo-inbound-diff-${r.stockItemId}`,todoNo:`TD-ID-${String(n+1).padStart(3,"0")}`,todoType:"差异待处理",todoTitle:`${r.warehouseName}差异待处理`,todoSubtitle:`${r.sourceRecordNo} · ${r.itemName} · 差异 ${r.differenceQty}`,factoryId:t,factoryName:r.factoryName,relatedTaskId:r.taskId,relatedTaskNo:r.taskNo,priority:"紧急",status:"处理中",dueAt:r.receivedAt,createdAt:r.receivedAt,detailRoute:`/fcs/pda/notify/todo-inbound-diff-${r.stockItemId}`,actionLabel:"去处理",relatedInboundRecordId:r.sourceRecordId})),o=Z().filter(r=>r.factoryId===t&&(r.status==="差异"||r.status==="异议中")).map((r,n)=>({todoId:`todo-outbound-diff-${r.outboundRecordId}`,todoNo:`TD-OD-${String(n+1).padStart(3,"0")}`,todoType:"差异待处理",todoTitle:`${r.warehouseName}${r.status==="异议中"?"异议处理中":"差异待处理"}`,todoSubtitle:`${r.handoverRecordNo||r.handoverOrderNo} · 差异 ${r.differenceQty??0}`,factoryId:t,factoryName:r.factoryName,relatedTaskId:r.sourceTaskId,relatedTaskNo:r.sourceTaskNo,relatedHandoverOrderId:r.handoverOrderId,relatedHandoverRecordId:r.handoverRecordId,relatedOutboundRecordId:r.outboundRecordId,priority:"紧急",status:"处理中",dueAt:r.outboundAt,createdAt:r.outboundAt,detailRoute:`/fcs/pda/notify/todo-outbound-diff-${r.outboundRecordId}`,actionLabel:"去处理"})),a=J().filter(r=>r.factoryId===t&&r.status!=="OBJECTION_RESOLVED").map((r,n)=>({todoId:`todo-objection-${r.objectionId}`,todoNo:`TD-OB-${String(n+1).padStart(3,"0")}`,todoType:"差异待处理",todoTitle:"数量异议待处理",todoSubtitle:`${r.objectionNo} · 差异 ${r.diffQty}${r.qtyUnit}`,factoryId:t,factoryName:r.factoryName,relatedTaskId:r.sourceTaskId,relatedHandoverOrderId:r.handoverOrderId,relatedHandoverRecordId:r.handoverRecordId,priority:"紧急",status:r.status==="SUBMITTED"?"待处理":"处理中",dueAt:r.raisedAt,createdAt:r.raisedAt||"",detailRoute:`/fcs/pda/notify/todo-objection-${r.objectionId}`,actionLabel:"去处理"}));return[...e,...o,...a]}function _t(t){return[]}function O(t){return tt(t).filter(e=>e.status==="PENDING_FACTORY_CONFIRM"||e.factoryFeedbackStatus==="PENDING_FACTORY_CONFIRM").map((e,o)=>({todoId:`todo-settlement-${e.statementId}`,todoNo:`TD-STL-${String(o+1).padStart(3,"0")}`,todoType:"对账待确认",todoTitle:`${e.settlementCycleLabel||e.statementNo||e.statementId}待确认`,todoSubtitle:`${e.statementNo||e.statementId} · 应付 ${e.netPayableAmount??e.totalAmount}`,factoryId:t,factoryName:e.factoryName||t,relatedSettlementId:e.statementId,priority:"加急",status:"待处理",dueAt:e.sentToFactoryAt||e.createdAt,createdAt:e.createdAt,detailRoute:`/fcs/pda/notify/todo-settlement-${e.statementId}`,actionLabel:"确认"}))}function Mt(){return h().filter(t=>et(t)&&t.status!=="DONE").map((t,e)=>{const o=t.status==="NOT_STARTED";return{todoId:`todo-kol-exec-${t.taskId}`,todoNo:`TD-KOL-${String(e+1).padStart(3,"0")}`,todoType:o?"加工领料":"待交出",todoTitle:o?"KOL 整单任务可加工领料":"KOL 整单任务继续执行",todoSubtitle:o?`${t.productionOrderNo||t.productionOrderId} · 加工领料后自动开工`:`${t.productionOrderNo||t.productionOrderId} · 可继续加工领料、发起交出或完成`,factoryId:P,factoryName:t.assignedFactoryName||P,relatedTaskId:t.taskId,relatedTaskNo:t.taskNo||t.taskId,priority:u(t.taskDeadline,o?"待处理":"处理中"),status:o?"待处理":"处理中",dueAt:t.taskDeadline,createdAt:t.startedAt||t.acceptedAt||t.createdAt||"",detailRoute:`/fcs/pda/exec/${t.taskId}`,actionLabel:"去处理"}})}function v(t,e){const o={紧急:3,加急:2,普通:1},a=o[t.priority]||0,r=o[e.priority]||0;return a!==r?r-a:N(t.dueAt||t.createdAt)-N(e.dueAt||e.createdAt)}function Bt(t){return It(t)}function W(t){const e=K(t);dt();const o=h(void 0,t);return{tasks:o,beforeExecution:[...e,...Rt(t,o),...kt(t)],readAfterExecution:()=>[...Ft(t),...wt(t),...O(t)]}}function D(t,e){if(g(t))return[...Mt(),...e==="ROLE_ADMIN"?O(t):[]].sort(v);if(t===S)return[...K(t),...Dt(t),...Ct(t),...Et(t),...Lt(t),..._t(),...O(t)].sort(v);const{tasks:o,beforeExecution:a,readAfterExecution:r}=W(t);return[...a,...Pt(t,o),...r()].sort(v)}function Ht(t,e){if(g(t)||t===S)return D(t,e).filter(n=>n.status==="待处理"||n.status==="处理中").length;const{tasks:o,beforeExecution:a,readAfterExecution:r}=W(t);return[...a,...r()].filter(n=>n.status==="待处理"||n.status==="处理中").length+U(t,o).length}function ye(t){return Array.from(new Set([S,...h().map(o=>o.assignedFactoryId).filter(o=>!!o)])).flatMap(o=>D(o,g(o)?"ROLE_ADMIN":void 0)).find(o=>o.todoId===t)??null}function ge(t){return{total:t.filter(e=>e.status==="待处理"||e.status==="处理中").length,urgent:t.filter(e=>e.priority==="紧急").length,dueToday:t.filter(e=>ht(e.dueAt)).length,difference:t.filter(e=>e.todoType==="差异待处理").length,settlement:t.filter(e=>e.todoType==="对账待确认").length}}const A=[{key:"task-receive",label:"接单",href:"/fcs/pda/task-receive",icon:"clipboard-list"},{key:"exec",label:"执行",href:"/fcs/pda/exec",icon:"play"},{key:"handover",label:"交接",href:"/fcs/pda/handover",icon:"arrow-left-right"},{key:"warehouse",label:"仓管",href:"/fcs/pda/warehouse",icon:"warehouse"},{key:"settlement",label:"结算",href:"/fcs/pda/settlement",icon:"wallet"}];function G(){const t=T();if(g(t==null?void 0:t.factoryId))return A.filter(o=>o.key!=="settlement"||(t==null?void 0:t.roleId)==="ROLE_ADMIN");const e=t?ft(t.factoryId):void 0;return(e==null?void 0:e.factoryTier)==="THIRD_PARTY"&&e.factoryType==="THIRD_SEWING"?A.filter(o=>o.key!=="warehouse"):A}let f=!1,m=!1,p=!1,L=null,w=null;function jt(){const t=T();return t?[t.factoryId,t.loginId,t.userId].join(":"):null}function Kt(t=!1){const e=T(),o=jt(),a=I.getState().pathname||"";o!==L&&(L=o,f=!1,m=!1,p=!1),a!==w&&(w=a,f=!1,m=!1,p=!1)}function _(t,e){var o;return e||(t?((o=G().find(a=>a.key===t))==null?void 0:o.label)??"工厂端移动应用":"工厂端移动应用")}function M(t){return`
    <button
      type="button"
      class="relative inline-flex h-9 items-center justify-center rounded-full border bg-background px-3 text-foreground transition hover:bg-muted"
      data-pda-shell-action="open-todo-modal"
      data-pda-todo-trigger="true"
      aria-label="打开当前待办"
      title="当前待办"
    >
      <i data-lucide="bell" class="h-4 w-4"></i>
      <span class="ml-1 text-xs font-medium">待办</span>
      ${t>0?`<span class="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">${t}</span>`:""}
    </button>
  `}function Ut(t,e){var o;return((o=Tt(t,e))==null?void 0:o.roleName)||"仓管"}function Wt(){const t=T();if(!t)return"";const e=t.userName.trim()||t.loginId;return`
    <button
      type="button"
      class="inline-flex h-9 max-w-[112px] items-center gap-1 rounded-full border bg-background px-2.5 text-xs font-medium text-foreground transition hover:bg-muted"
      data-pda-shell-action="open-account-modal"
      aria-label="打开账号信息"
      title="${s(`${t.userName} / ${t.loginId}`)}"
    >
      <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">${s(e.slice(0,1))}</span>
      <span class="min-w-0 truncate">${s(e.slice(0,4))}</span>
      <i data-lucide="chevron-down" class="h-3.5 w-3.5 shrink-0"></i>
    </button>
  `}function Gt(t){return t?t==="ID-F090"?"F090":t:""}function Qt(t,e){const o=T();let a=M(0);if(o)try{a=M(Ht(o.factoryId,o.roleId))}catch{a='<span role="status" class="max-w-[112px] text-xs text-amber-800" title="待办来源暂不可读，请恢复浏览器存储访问后刷新。">待办暂不可用</span>'}const r=(o==null?void 0:o.factoryName)||"工厂端移动应用",n=o?Gt(o.factoryId):"",d=o&&n?`${_(t,e)} · ${n}`:_(t,e);return`
    <header class="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur">
      <div class="flex items-center gap-3">
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-semibold text-foreground" title="${s(o?B(o.factoryName,o.factoryId):r)}">${s(r)}</div>
          <div class="truncate text-[11px] text-muted-foreground">${s(d)}</div>
        </div>
        ${a}
        ${Wt()}
      </div>
    </header>
  `}function zt(){const t=T();if(!t||!f)return"";const e=D(t.factoryId,t.roleId).slice(0,5),o=g(t.factoryId)?"优先处理加工领料、交出和可完成任务。":"优先处理待接单、待接收、待交出和差异项。";return`
    <div class="fixed inset-0 z-[120]" data-pda-todo-modal="true">
      <button
        type="button"
        class="absolute inset-0 bg-black/45"
        data-pda-shell-action="close-todo-modal"
        aria-label="关闭当前待办"
      ></button>
      <section class="absolute bottom-[72px] left-0 right-0 rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-foreground">当前待办</h2>
            <p class="mt-1 text-xs text-muted-foreground">${s(o)}</p>
          </div>
          <button
            type="button"
            class="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
            data-pda-shell-action="close-todo-modal"
          >
            关闭
          </button>
        </div>

        <div class="mt-4 space-y-3">
          ${e.length>0?e.map(a=>`
                      <article class="rounded-2xl border bg-card px-3 py-3 shadow-sm">
                        <div class="flex items-start justify-between gap-3">
                          <div class="min-w-0 flex-1">
                            <button
                              type="button"
                              class="text-left text-sm font-semibold text-foreground hover:text-primary"
                              data-pda-shell-action="open-todo-route"
                              data-href="${s(a.detailRoute)}"
                            >
                              ${s(a.todoTitle)}
                            </button>
                            <div class="mt-1 text-xs text-muted-foreground">${s(a.todoType)} · ${s(a.todoNo)}</div>
                            <div class="mt-1 text-xs text-muted-foreground">${s(a.todoSubtitle)}</div>
                            <div class="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              <span class="rounded-full bg-muted px-2 py-0.5">${s(a.priority)}</span>
                              <span>到期：${s(a.dueAt||"待安排")}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            class="inline-flex h-8 items-center justify-center rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground"
                            data-pda-shell-action="open-todo-route"
                            data-href="${s(Bt(a))}"
                          >
                            ${s(a.actionLabel)}
                          </button>
                        </div>
                      </article>
                    `).join(""):'<div class="rounded-2xl border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">暂无待办</div>'}
        </div>

        <div class="mt-4 flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-xl border px-3 py-2.5 text-sm hover:bg-muted"
            data-pda-shell-action="open-todo-route"
            data-href="/fcs/pda/notify"
          >
            查看全部
          </button>
          <button
            type="button"
            class="flex-1 rounded-xl border px-3 py-2.5 text-sm hover:bg-muted"
            data-pda-shell-action="close-todo-modal"
          >
            关闭
          </button>
        </div>
      </section>
    </div>
  `}function Vt(){const t=T();if(!t||!m)return"";const e=Ut(t.roleId,t.factoryId),o=B(t.factoryName,t.factoryId);return`
    <div class="fixed inset-0 z-[125]" data-pda-account-modal="true">
      <button
        type="button"
        class="absolute inset-0 bg-black/45"
        data-pda-shell-action="close-account-modal"
        aria-label="关闭账号信息"
      ></button>
      <section class="absolute bottom-[72px] left-0 right-0 rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-foreground">当前账号</h2>
            <p class="mt-1 text-xs text-muted-foreground">账号信息只用于现场确认身份。</p>
          </div>
          <button
            type="button"
            class="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
            data-pda-shell-action="close-account-modal"
          >
            关闭
          </button>
        </div>

        <div class="mt-4 rounded-2xl border bg-card px-4 py-4">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
              ${s(t.userName.trim().slice(0,1)||t.loginId.slice(0,1))}
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold text-foreground">${s(t.userName)}</div>
              <div class="truncate text-xs text-muted-foreground">账号：${s(t.loginId)}</div>
            </div>
          </div>
          <div class="mt-4 grid grid-cols-1 gap-2 text-xs">
            <div class="rounded-xl bg-muted/60 px-3 py-2">
              <div class="text-muted-foreground">角色</div>
              <div class="mt-1 font-medium text-foreground">${s(e)}</div>
            </div>
            <div class="rounded-xl bg-muted/60 px-3 py-2">
              <div class="text-muted-foreground">工厂</div>
              <div class="mt-1 font-medium text-foreground">${s(o)}</div>
            </div>
          </div>
        </div>

        ${p?`
              <div class="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4">
                <div class="text-sm font-semibold text-destructive">确认退出当前账号？</div>
                <div class="mt-1 text-xs leading-5 text-muted-foreground">退出后需要重新登录才能继续使用 PDA。</div>
                <div class="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    class="rounded-xl border bg-background px-3 py-2.5 text-sm"
                    data-pda-shell-action="cancel-logout"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    class="rounded-xl bg-destructive px-3 py-2.5 text-sm font-medium text-destructive-foreground"
                    data-pda-shell-action="confirm-logout"
                  >
                    退出登录
                  </button>
                </div>
              </div>
            `:`
              <button
                type="button"
                class="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive"
                data-pda-shell-action="request-logout"
              >
                退出登录
              </button>
            `}
      </section>
    </div>
  `}function Q(t){return`
    <nav class="absolute bottom-0 left-0 right-0 z-10 flex h-[72px] items-center justify-around border-t bg-background px-1" data-pda-bottom-nav="true">
      ${G().map(e=>{const o=e.key===t;return`
          <button
            type="button"
            class="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 transition-colors ${pt(o?"text-primary":"text-muted-foreground hover:text-foreground")}"
            data-nav="${e.href}"
            data-pda-tab="${e.key}"
          >
            <i data-lucide="${e.icon}" class="h-5 w-5 shrink-0"></i>
            <span class="text-center text-[10px] font-medium leading-tight">${s(e.label)}</span>
          </button>
        `}).join("")}
    </nav>
  `}function qt(t,e,o={}){const a=I.getState().pathname||"/fcs/pda/exec",r=mt(a);return r.allowed?yt(a)?E(gt,"车缝现场交货登记模式"):(Kt(!!o.disableTodoAutoOpen),`
    <section class="relative flex h-screen min-h-0 flex-col overflow-hidden bg-background">
      ${Qt(e,o.headerTitle)}
      <div class="min-h-0 flex-1 overflow-y-auto pb-[72px]" data-pda-scroll-container="true">
        ${t}
      </div>
      ${Q(e)}
      ${zt()}
      ${Vt()}
    </section>
  `):E(r.redirectPath||"/fcs/pda/auth/login",r.reasonLabel||"工厂入驻&登录")}function Yt(t){const e=t.closest("[data-pda-shell-action]"),o=e==null?void 0:e.dataset.pdaShellAction;return o?o==="open-todo-modal"?(f=!0,m=!1,p=!1,!0):o==="close-todo-modal"?(f=!1,!0):o==="open-account-modal"?(m=!0,f=!1,p=!1,!0):o==="close-account-modal"?(m=!1,p=!1,!0):o==="request-logout"?(p=!0,!0):o==="cancel-logout"?(p=!1,!0):o==="confirm-logout"?(bt(),f=!1,m=!1,p=!1,I.navigate("/fcs/pda/auth/login",{historyMode:"replace"}),!0):o==="open-todo-route"&&e.dataset.href?(I.navigate(e.dataset.href),f=!1,!0):!1:!1}function Zt(){return!f&&!m?!1:(f=!1,m=!1,p=!1,!0)}const Ie=Object.freeze(Object.defineProperty({__proto__:null,closePdaShellDialogsOnEscape:Zt,handlePdaShellEvent:Yt,renderPdaBottomNav:Q,renderPdaFrame:qt},Symbol.toStringTag,{value:"Module"}));export{be as a,me as b,Zt as c,Bt as d,ye as e,Te as f,D as g,Yt as h,At as i,Ot as j,Ie as p,qt as r,ge as s};

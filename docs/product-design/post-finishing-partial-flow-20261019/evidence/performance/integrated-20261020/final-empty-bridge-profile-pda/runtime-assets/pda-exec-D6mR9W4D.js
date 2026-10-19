import{M as m,x as a,ah as be,p as We}from"./app-shared-DDMaqtkq.js";import{M as Ge,aK as He,aL as Qe}from"./runtime-process-tasks-CsQOZ2XB.js";import{c as I}from"./task-execution-adapter-C49Xdxb8.js";import{a as D,g as ze,i as $,e as Ye,f as Xe,d as Ze}from"./pda-cutting-execution-source-BtQG_CPO.js";import{h as Je,f as et,K as tt}from"./pda-handover-events-UcnOWl8d.js";import{i as E,h as O,g as rt,as as ie,aX as ne}from"./printing-task-domain-XoVf2Yk7.js";import{a as xe,g as at,l as it,m as ge}from"./mobile-execution-task-index-C8owom0g.js";import{e as S,d as nt}from"./process-mobile-task-binding-RlLsKsXN.js";import"./production-orders-B2zW2PhJ.js";import"./factory-receiving-DVz0KTOW.js";import{r as st}from"./wool-pda-scan-BjxkMrmk.js";import{f as V,r as q,b as se}from"./pda-shell-B6HvNKDb.js";import{e as dt,l as ot}from"./special-craft-task-orders-DRSqPh0t.js";import{g as ve,r as de}from"./binding-process-pda-scan-Bcam-aHZ.js";import{e as H,g as ct}from"./kol-goto-pda-domain-CB3jtKjS.js";import{a as L,f as T,x as lt}from"./post-finishing-full-flow-D_giM7Ur.js";import{s as ut,a as ye,f as pt,b as mt}from"./pda-start-link-DtClMJrg.js";import{i as ft,s as bt,g as xt,a as gt,b as vt}from"./pda-exec-link-CH-3NJDy.js";import{ensurePdaSessionForAction as yt,getPdaRuntimeContext as he,renderPdaLoginRedirect as ht}from"./pda-runtime-BlCMwqBh.js";import"./tmf-domain-shared-DboXqEqI.js";import"./production-order-runtime-store-Dcy-f66x.js";import"./craft-display-support-BApnCE-Y.js";import"./index-D-gyE31p.js";import"./cut-piece-release-VazPsROq.js";import"./effective-task-assignments-6GqO3CTT.js";import"./pcs-record-core-SMF8snTa.js";import"./design-revision-pcs-storage-BjfzS8H8.js";import"./domain-snapshot-DIR7lJLE.js";import"./runtime-inputs-Be5XDBRb.js";import"./warehouse-runtime-CZ8hVkSQ.js";import"./generated-fei-tickets-BYQ1hy_Q.js";import"./production-tech-pack-change-domain-sbNbYeFm.js";import"./store-domain-progress-C98VkE0q.js";import"./ppic-return-quantity-basis-3RI_BVqn.js";import"./sewing-outsourcing-responsibility-x9e0h03B.js";import"./sewing-cut-piece-responsibility-Bg8jLWFo.js";import"./craft-image-storage-CJy6TDhq.js";import"./production-material-prep-DBHpLEmX.js";import"./pcs-tech-pack-review-BJAgRE4U.js";import"./pcs-tech-pack-bootstrap-C7eVceqo.js";import"./pcs-config-workspace-repository-Dds7dQMI.js";import"./pcs-product-archive-fixtures-BqZbKhPP.js";import"./pcs-pattern-library-CRd2CAP7.js";import"./pcs-tech-pack-review-notification-repository-DO2Z9PTF.js";import"./pcs-tech-pack-version-log-repository-B_RnOrAr.js";import"./los-live-room-master-RUB9Xwf5.js";import"./pcs-engineering-task-upload-repository-CGy-PChT.js";import"./pcs-engineering-bom-snapshot-source-CVLToAt6.js";import"./pcs-part-template-library-O6xJDNlv.js";import"./marker-plan-projection-BtM8wurt.js";import"./marker-plan-source-model-Dnbmtwcp.js";import"./marker-plan-occupancy-V5v4fnko.js";import"./supplement-order-registry-CHnc7juB.js";import"./index-CLpHjaZ2.js";import"./marker-plan-model-1bENh5Qr.js";import"./task-chain-pages-adapter-Bp0Uawlh.js";import"./water-soluble-relation-sources-BmqEILGl.js";import"./factory-capacity-profile-mock-Dv5YtZGT.js";import"./tmf-process-continuation-zBbGFh6j.js";import"./tmf-reference-images-6geKcU1B.js";import"./special-craft-pda-scope-CpsSE7FW.js";import"./store-domain-settlement-seeds-DdB-0ZSU.js";import"./quality-deduction-repository-BpofrZf6.js";import"./settlement-linked-mock-factory-ChNmQ8yp.js";import"./runtime-task-tenders-kbJDCqqI.js";import"./factory-onboarding-flow-DMRBtBR3.js";import"./pda-sewing-self-return-mode-CVT5AEl1.js";import"./kol-goto-fixed-total-ledger-DtZzGycu.js";import"./post-finishing-authorization-BYplhYHy.js";import"./milestone-configs-CsHGNcWw.js";import"./progress-exception-lifecycle-BJx0gSBY.js";function M(e,t,r){const s=Math.max(1,Math.floor(r)),n=e.length,d=n===0?0:Math.min(Math.max(Math.floor(t),s),n),o=Math.max(n-d,0);return{rows:e.slice(0,d),visibleCount:d,total:n,batchSize:s,remainingCount:o,hasMore:o>0}}function _(e,t){if(!e.hasMore)return"";const r=Math.min(e.visibleCount+e.batchSize,e.total);return`
    <div
      class="h-px w-full"
      data-pda-exec-auto-load-sentinel="${t}"
      data-list-key="${t}"
      data-next-visible-count="${r}"
      aria-hidden="true"
    ></div>`}const $e=[{key:"NOT_STARTED",label:"待开工"},{key:"IN_PROGRESS",label:"进行中"},{key:"BLOCKED",label:"生产暂停"},{key:"DONE",label:"已完工"}],i={selectedFactoryId:"",activeTab:"NOT_STARTED",searchKeyword:"",riskParam:"",specialCraftVisibleCount:10,bindingVisibleCount:10,generalVisibleCount:10,woolScanMessage:"",woolScanTone:"info",woolScanCandidates:[],woolLastResolvedCode:"",specialCraftScanMessage:"",specialCraftScanTone:"info",specialCraftScanCandidates:[],specialCraftLastResolvedCode:"",specialCraftScanKeyword:"",specialCraftTab:"IN_PROGRESS",bindingScanKeyword:"",bindingScanMessage:"",bindingScanTone:"info",bindingScanCandidates:[],bindingLastResolvedCode:"",bindingTab:"IN_PROGRESS"};let oe=!1,B=null;const b=10;function Se(){i.specialCraftVisibleCount=b,i.bindingVisibleCount=b,i.generalVisibleCount=b}function we(e){return at(e)}function y(e){return e.taskNo||e.taskId}function C(e){return e.rootTaskNo||e.taskNo||e.taskId}function Q(e,t=I(e)){var o;if(S(e)==="WOOL"){const c=e.woolKind==="PART_PANEL"?"本单毛织部位片数（片）":"本单毛织整件数（件）",u=e.qtyDisplayUnit||(e.woolKind==="PART_PANEL"?"片":"件");return{label:c,valueText:`${c.replace(/（.*$/,"")}：${e.qty} ${u}`}}const r=E(e.taskId);if(r){const c={processType:"PRINT",sourceId:r.printOrderId,objectType:r.objectType,qtyUnit:r.qtyUnit,qtyPurpose:"计划"},u=ie(c);return{label:u,valueText:`${u}：${ne(r.plannedQty,c)}`}}const s=O(e.taskId);if(s){const c={processType:"DYE",sourceId:s.dyeOrderId,objectType:"面料",qtyUnit:s.qtyUnit,qtyPurpose:"计划"},u=ie(c);return{label:u,valueText:`${u}：${ne(s.plannedQty,c)}`}}const n=He(e);return(o=e.qtyDisplayUnit)!=null&&o.trim()?Qe(e):n==="卷"?{label:"本单布卷数（卷）",valueText:`本单布卷数：${e.qty} 卷`}:n==="层"?{label:"本单铺布层数（层）",valueText:`本单铺布层数：${e.qty} 层`}:n==="片"||n==="件"&&($(e)||S(e)==="SPECIAL_CRAFT"||/裁片|入仓|交接/.test(t))?{label:"本单裁片片数（片）",valueText:`本单裁片片数：${e.qty} 片`}:{label:"本单成衣件数（件）",valueText:`本单成衣件数：${e.qty} 件`}}const $t={blocked:"BLOCKED",BLOCKED:"BLOCKED","in-progress":"IN_PROGRESS",IN_PROGRESS:"IN_PROGRESS","not-started":"NOT_STARTED",NOT_STARTED:"NOT_STARTED",done:"DONE",DONE:"DONE"};function St(){const e=m.getState().pathname,[,t]=e.split("?");return t||""}function wt(){return new URLSearchParams(St())}function Tt(){const e=wt(),t=e.has("keyword"),r=e.get("tab")||"",s=$t[r]||"NOT_STARTED",n=e.get("risk")||"",d=t?e.get("keyword")||"":i.searchKeyword;(i.activeTab!==s||i.riskParam!==n||i.searchKeyword!==d)&&Se(),i.activeTab=s,i.riskParam=n,i.searchKeyword=d,t&&(i.specialCraftScanKeyword=d,i.bindingScanKeyword=d)}function Ct(e=i.activeTab){const t=new URLSearchParams;return t.set("tab",e),i.riskParam&&t.set("risk",i.riskParam),i.searchKeyword.trim()&&t.set("keyword",i.searchKeyword.trim()),`/fcs/pda/exec?${t.toString()}`}function ce(e,t){return`${e}${e.includes("?")?"&":"?"}action=${encodeURIComponent(t)}`}function A(e){return new Date(e.replace(" ","T")).getTime()}function It(e=new Date){return e.toISOString().replace("T"," ").slice(0,19)}function v(){const e=he();return i.selectedFactoryId=(e==null?void 0:e.factoryId)??"",i.selectedFactoryId}function Te(e){return e?{MATERIAL:"物料",CAPACITY:"产能/排期",QUALITY:"质量处理",TECH:"工艺/技术资料",EQUIPMENT:"设备",OTHER:"其他",ALLOCATION_GATE:"分配开始条件"}[e]??e:"未知原因"}function z(e,t){if(!e||t)return null;const r=A(e)-Date.now();return r<0?{label:"执行逾期",textClass:"text-destructive font-medium",hintClass:"bg-red-50 text-red-700"}:r<24*3600*1e3?{label:"即将逾期",textClass:"text-amber-600 font-medium",hintClass:"bg-amber-50 text-amber-700"}:{label:"正常",textClass:"text-muted-foreground",hintClass:""}}function R(e){if(typeof document>"u"||typeof window>"u")return;const t="pda-exec-toast-root";let r=document.getElementById(t);r||(r=document.createElement("div"),r.id=t,r.className="pointer-events-none fixed right-6 top-20 z-[130] flex max-w-sm flex-col gap-2",document.body.appendChild(r));const s=document.createElement("div");s.className="pointer-events-auto rounded-md border bg-background px-4 py-3 text-sm text-foreground shadow-md transition-all duration-200",s.textContent=e,s.style.opacity="0",s.style.transform="translateY(-6px)",r.appendChild(s),window.requestAnimationFrame(()=>{s.style.opacity="1",s.style.transform="translateY(0)"}),window.setTimeout(()=>{s.style.opacity="0",s.style.transform="translateY(-6px)",window.setTimeout(()=>{s.remove(),r&&r.childElementCount===0&&r.remove()},180)},2200)}function Et(e,t){const r=It(),s=we(e);s&&(E(e)||O(e)||S(s)==="WOOL"||(s.status="DONE",s.finishedAt=r,s.updatedAt=r,s.auditLogs=[...s.auditLogs,{id:`AL-FINISH-${Date.now()}`,action:"FINISH_TASK",detail:"任务完工",at:r,by:t}]))}function Y(e){const t=lt(e)??e;return it({currentFactoryId:t}).filter(r=>{const s=S(r);return s==="SPECIAL_CRAFT"?!1:s!=="WOOL"||r.woolProcessingStatus==="COMPLETED"?!0:["REPORT_PROCESS","ASSOCIATE_MACHINE","COMPLETE"].some(n=>{var d;return(d=r.woolAllowedActions)==null?void 0:d.includes(n)})})}let F=new WeakMap;function Ce(e){const t=F.get(e);if(t)return t;const r=mt(e),s={prerequisite:r,due:ye(e,Date.now(),r)};return F.set(e,s),s}function X(e,t){F=new WeakMap;let r=e[t];if(t==="IN_PROGRESS"&&i.riskParam==="due-soon"){const n=Date.now();r=r.filter(d=>{const o=d.taskDeadline;if(!o)return!1;const c=A(o)-n;return c>=0&&c<24*3600*1e3})}t==="NOT_STARTED"&&i.riskParam==="start-due-soon"&&(r=r.filter(n=>ye(n).startRiskStatus==="DUE_SOON")),t==="NOT_STARTED"&&(r=Lt(r));const s=i.searchKeyword.trim();return s?r.filter(n=>ge(n,s)):r}function K(e){return e==="DIRECT"?`
      <span class="inline-flex items-center gap-0.5 rounded border border-blue-200 bg-blue-50 px-1.5 py-0 text-[10px] font-medium text-blue-700">
        <i data-lucide="tag" class="h-2.5 w-2.5"></i>
        直接派发
      </span>
    `:`
    <span class="inline-flex items-center gap-0.5 rounded border border-green-200 bg-green-50 px-1.5 py-0 text-[10px] font-medium text-green-700">
      <i data-lucide="tag" class="h-2.5 w-2.5"></i>
      分配接收
    </span>
  `}function j(e){const t=e.coveredProcesses??[];if(t.length===0)return"";const r=t.map(s=>s.craftName?`${s.processName}/${s.craftName}`:s.processName).join("、");return`<div class="rounded-md border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs text-blue-700">覆盖工序：${a(r)}</div>`}function Ot(e){const t=E(e.taskId);if((t==null?void 0:t.status)==="HANDOVER_WAIT_RECEIVE")return"待对方收货";const r=O(e.taskId);return(r==null?void 0:r.status)==="HANDOVER_WAIT_RECEIVE"?"待对方收货":nt(e)}function N(e){return`
    <span class="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
      执行：${a(Ot(e))}
    </span>
  `}function Ie(e){const t={NOT_STARTED:[],IN_PROGRESS:[],BLOCKED:[],DONE:[]};for(const r of e)t[xe(r)].push(r);return t}function Nt(e){return $(e)?Ze(e.taskId)[0]??null:null}function Ee(e){return $(e)?Xe(e.taskId):null}function kt(e){return e?`${e.cutOrderGroups.length} 张裁片单 · ${e.cutPieceOrderCount} 张铺布单 · 下一步 ${e.nextRecommendedAction}`:""}function U(e){return e.map(t=>String(t||"").trim()).filter(Boolean).join(" · ")}function Rt(e){return e.met?"可开工":/接收|收货|入仓|来料/.test(e.blocker)?"待接收确认":/绑定/.test(e.blocker)?"待绑定裁片单":/执行明细|同步/.test(e.blocker)?"待执行明细同步":(/上游|连续流转/.test(e.blocker),"待前置完成")}function Pt(e,t){return L(e)?{label:"去加工领料",icon:"package-open",action:"go-prerequisite",className:"bg-primary text-primary-foreground hover:bg-primary/90"}:t.met?{label:$(e)?"进入裁片任务":"开工",icon:"play",action:"go-start",className:"bg-primary text-primary-foreground hover:bg-primary/90"}:$(e)&&/接收|入仓|来料/.test(t.blocker)?{label:"去交接确认",icon:"arrow-left-right",action:"go-prerequisite",className:"border border-amber-300 text-amber-700 hover:bg-amber-50"}:$(e)&&/绑定/.test(t.blocker)?{label:"处理绑定",icon:"link",action:"go-prerequisite",className:"border border-amber-300 text-amber-700 hover:bg-amber-50"}:{label:"查看前置状态",icon:"eye",action:"go-prerequisite",className:"border border-amber-300 text-amber-700 hover:bg-amber-50"}}function Dt(e){const{prerequisite:t,due:r}=Ce(e);return t.met&&r.startRiskStatus==="OVERDUE"?0:t.met&&r.startRiskStatus==="DUE_SOON"?1:t.met?2:/接收|收货|入仓|来料/.test(t.blocker)?3:/绑定/.test(t.blocker)?4:5}function At(e,t){const r=e?A(e):Number.POSITIVE_INFINITY,s=t?A(t):Number.POSITIVE_INFINITY;return Number.isNaN(r)&&Number.isNaN(s)?0:Number.isNaN(r)?1:Number.isNaN(s)?-1:r-s}function Lt(e){const t=new Map(e.map(r=>[r.taskId,Dt(r)]));return[...e].sort((r,s)=>{const n=t.get(r.taskId)-t.get(s.taskId);if(n!==0)return n;const d=r.taskDeadline,o=s.taskDeadline,c=At(d,o);return c!==0?c:y(r).localeCompare(y(s),"zh-Hans-CN")})}function Oe(e){return e.length===0?"当前工厂暂无可执行任务":i.searchKeyword.trim()?"当前关键词未找到任务":i.activeTab==="IN_PROGRESS"&&i.riskParam==="due-soon"?"当前暂无即将逾期任务":i.activeTab==="NOT_STARTED"&&i.riskParam==="start-due-soon"?"当前暂无开工预期任务":"当前筛选条件下暂无任务"}function Mt(e){var u;const t=["COMPLETE","REPORT_PROCESS","ASSOCIATE_MACHINE"].find(l=>{var p;return(p=e.woolAllowedActions)==null?void 0:p.includes(l)}),r=t==="REPORT_PROCESS"?"加工填报":t==="ASSOCIATE_MACHINE"?"关联横机设备":t==="COMPLETE"?"完成加工单":"查看加工单",s=e.woolReadyOutputSkuCodes||[],n=e.woolMissingYarnSkus||[],d=s.length?`已有可填报款色：${s.join("、")}`:n.length?`尚缺纱线：${n.join("、")}`:"等待确认接收纱线",o=/^(?:https?:\/\/|\/|data:image\/)/i.test(((u=e.woolStyleImageUrl)==null?void 0:u.trim())||"")?e.woolStyleImageUrl.trim():"",c=e.woolStyleNo||"毛织款式";return`
    <article class="cursor-pointer rounded-lg border transition-colors hover:border-primary" data-testid="pda-exec-task-card" data-pda-exec-action="open-detail" data-task-id="${a(e.taskId)}">
      <div class="flex gap-3 p-3">
        ${o?`<button type="button" class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30" data-pda-image-preview-url="${a(o)}" data-pda-image-preview-title="${a(c)}" data-skip-page-rerender="true" aria-label="查看${a(c)}大图"><img class="h-full w-full object-cover" src="${a(o)}" alt="${a(e.woolStyleNo||"")}款式图" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>`:'<div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border bg-muted/30"><span class="text-xs text-muted-foreground">暂无款式图</span></div>'}
        <div class="min-w-0 flex-1 space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold">${a(e.woolOrderNo||e.taskNo)}</div>
              <div class="mt-0.5 truncate text-[11px] text-muted-foreground">${a(e.woolStyleNo||"")} · ${a(e.productionOrderNo)}</div>
            </div>
            <span class="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">${a(e.woolProcessingStatusLabel||"待处理")}</span>
          </div>
          <div class="text-xs">加工对象：${a(e.woolOutputSummary||"待确认")}</div>
          <div class="rounded-md border px-2 py-1.5 text-xs ${s.length?"border-green-200 bg-green-50 text-green-700":"border-amber-200 bg-amber-50 text-amber-700"}">${a(d)}</div>
          <button type="button" class="h-9 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground" data-pda-exec-action="open-detail" data-task-id="${a(e.taskId)}">${a(r)}</button>
        </div>
      </div>
    </article>
  `}const Ne=[{key:"IN_PROGRESS",label:"加工中"},{key:"DONE",label:"已完成"}];function w(e){return e==="IN_PROGRESS"||e==="DONE"}function g(e){const{order:t}=e;return t.status==="待接收"?"NOT_STARTED":t.status==="已完结"?"DONE":"IN_PROGRESS"}function W(e){const t=g(e),r="/fcs/pda/exec";return t==="NOT_STARTED"?"/fcs/pda/handover?tab=pickup":`/fcs/pda/exec/${e.sourceType}/${encodeURIComponent(e.workOrderId)}?returnTo=${encodeURIComponent(r)}`}function ke(e){const t=i.searchKeyword.trim().toLocaleLowerCase();return ot().filter(r=>r.factoryId===e).map(r=>V(r.taskOrderId)).filter(r=>!!r).filter(r=>t?[r.workOrderNo,r.workOrderId,r.sourceTaskNo,r.sourceTaskId,r.order.productionOrderNo,r.order.productionOrderId,r.order.operationName,r.order.targetObject].some(s=>s.toLocaleLowerCase().includes(t)):!0).sort((r,s)=>(s.order.updatedAt||"").localeCompare(r.order.updatedAt||""))}function Re(e){const{order:t}=e,r=`${e.styleNo} · ${e.styleName}`,n=g(e)==="DONE"?"查看加工记录":"加工填报";return`
    <article class="cursor-pointer rounded-lg border transition-colors hover:border-primary" data-testid="pda-exec-work-order-card" data-pda-exec-action="open-special-craft-work-order" data-source-type="${e.sourceType}" data-work-order-id="${a(e.workOrderId)}" data-source-task-id="${a(e.sourceTaskId)}">
      <div class="flex gap-3 p-3">
        ${e.styleImageUrl?`<button type="button" class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30" data-pda-image-preview-url="${a(e.styleImageUrl)}" data-pda-image-preview-title="${a(r)}" data-skip-page-rerender="true" aria-label="查看${a(r)}大图"><img class="h-full w-full object-cover" src="${a(e.styleImageUrl)}" alt="${a(r)}款式图" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>`:'<div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border bg-muted/30"><span class="text-xs text-muted-foreground">款式图缺失</span></div>'}
        <div class="min-w-0 flex-1 space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold">${a(t.taskOrderNo)}</div>
              <div class="mt-0.5 truncate text-[11px] text-muted-foreground">${a(e.styleNo)} · ${a(t.productionOrderNo)}</div>
            </div>
            <span class="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">${a(t.status)}</span>
          </div>
          <div class="text-xs">${a(t.operationName)} · ${a(t.targetObject)}</div>
          <div class="rounded-md border bg-muted/20 px-2 py-1.5 text-xs">已接收 ${t.receivedQty} / 已完成 ${t.completedQty} ${a(t.unit)}</div>
          <button type="button" class="h-9 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground" data-pda-exec-action="open-special-craft-work-order" data-source-type="${e.sourceType}" data-work-order-id="${a(e.workOrderId)}" data-source-task-id="${a(e.sourceTaskId)}">${a(n)}</button>
        </div>
      </div>
    </article>
  `}function Pe(e){const t=ke(e);if(!t.length)return"";const r=t.filter(c=>w(g(c))),s={IN_PROGRESS:0,DONE:0};r.forEach(c=>{s[g(c)]+=1});const n=[...new Set(r.map(c=>g(c)))];i.searchKeyword.trim()&&n.length===1&&(i.specialCraftTab=n[0]);const d=r.filter(c=>g(c)===i.specialCraftTab),o=M(d,i.specialCraftVisibleCount,b);return i.specialCraftVisibleCount=o.visibleCount||b,`
    <section class="-mx-4 -mt-4 space-y-3 pb-4" data-pda-special-craft-work-order-list>
      <div class="grid grid-cols-2 border-b bg-background" data-testid="pda-exec-special-craft-tabs">
        ${Ne.map(c=>`<button type="button" class="border-b-2 py-2 text-[11px] ${c.key===i.specialCraftTab?"border-primary text-primary":"border-transparent text-muted-foreground"}" data-pda-exec-action="switch-special-craft-tab" data-tab="${c.key}" data-skip-page-rerender="true">${c.label}<span class="ml-1 opacity-70">(${s[c.key]})</span></button>`).join("")}
      </div>
      <div class="px-4">${zt()}</div>
      <div class="space-y-3 px-4" data-pda-exec-card-container="special-craft">${o.rows.length?o.rows.map(Re).join(""):'<div class="rounded-lg border bg-muted/20 py-8 text-center text-sm text-muted-foreground">当前没有此状态的加工单</div>'}</div>
      <div class="px-4">${_(o,"special-craft")}</div>
    </section>
  `}function h(e){const{order:t}=e;return t.status==="已完成"?"DONE":t.status==="待加工"?"NOT_STARTED":"IN_PROGRESS"}function Z(e){return e.order.status!=="已取消"&&w(h(e))}function De(e){return h(e)==="NOT_STARTED"?"/fcs/pda/handover?tab=pickup":`/fcs/pda/exec/${e.sourceType}/${encodeURIComponent(e.workOrderId)}?returnTo=${encodeURIComponent("/fcs/pda/exec")}`}function Ae(e){const t=i.searchKeyword.trim().toLocaleLowerCase();return dt().filter(r=>r.factoryId===e).map(r=>ve(r.bindingOrderId)).filter(r=>!!r).filter(r=>!t||[r.workOrderId,r.workOrderNo,r.sourceTaskId,r.sourceTaskNo,r.order.sourceProductionOrderId,r.order.sourceProductionOrderNo,r.order.materialIdentity.materialSku,...r.order.sourceFeiTicketNos].some(s=>s.toLocaleLowerCase().includes(t))).sort((r,s)=>s.workOrderNo.localeCompare(r.workOrderNo,"zh-CN"))}function Le(e){const{order:t}=e,s=h(e)==="DONE"?"查看加工记录":"加工填报",n=`${t.materialIdentity.materialSku} · ${t.materialIdentity.materialName}`;return`
    <article class="cursor-pointer rounded-lg border transition-colors hover:border-primary" data-testid="pda-exec-binding-work-order-card" data-pda-exec-action="open-binding-work-order" data-source-type="${e.sourceType}" data-work-order-id="${a(e.workOrderId)}">
      <div class="flex gap-3 p-3">
        ${t.materialIdentity.materialImageUrl?`<button type="button" class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30" data-pda-image-preview-url="${a(t.materialIdentity.materialImageUrl)}" data-pda-image-preview-title="${a(n)}" data-skip-page-rerender="true" aria-label="查看${a(n)}大图"><img class="h-full w-full object-cover" src="${a(t.materialIdentity.materialImageUrl)}" alt="${a(n)}物料图" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>`:'<div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border bg-muted/30"><span class="px-1 text-center text-xs text-muted-foreground">物料图缺失</span></div>'}
        <div class="min-w-0 flex-1 space-y-2">
          <div class="flex items-start justify-between gap-2"><div class="min-w-0"><div class="truncate text-sm font-semibold">${a(t.bindingOrderNo)}</div><div class="mt-0.5 truncate text-[11px] text-muted-foreground">${a(t.sourceProductionOrderNo)} · ${a(t.materialIdentity.materialSku)}</div></div><span class="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">${a(t.status)}</span></div>
          <div class="text-xs">${t.bindingSpecificationCount} 个规格 · 计划 ${t.plannedOutputQty} 米</div>
          <div class="rounded-md border bg-muted/20 px-2 py-1.5 text-xs">实收 ${t.receivedMaterialLength} / 已加工 ${t.actualOutputQty} / 已交出 ${t.handedOverQty||0} 米</div>
          <button type="button" class="h-9 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground" data-pda-exec-action="open-binding-work-order" data-source-type="${e.sourceType}" data-work-order-id="${a(e.workOrderId)}">${a(s)}</button>
        </div>
      </div>
    </article>`}function Me(e){const t=Ae(e);if(!t.length)return"";const r=t.filter(Z),s={IN_PROGRESS:0,DONE:0};r.forEach(c=>{s[h(c)]+=1});const n=[...new Set(r.map(c=>h(c)))];i.searchKeyword.trim()&&n.length===1&&(i.bindingTab=n[0]);const d=r.filter(c=>h(c)===i.bindingTab),o=M(d,i.bindingVisibleCount,b);return i.bindingVisibleCount=o.visibleCount||b,`<section class="-mx-4 -mt-4 space-y-3 pb-4" data-pda-binding-work-order-list>
    <div class="grid grid-cols-2 border-b bg-background" data-testid="pda-exec-binding-tabs">${Ne.map(c=>`<button type="button" class="border-b-2 py-2 text-[11px] ${c.key===i.bindingTab?"border-primary text-primary":"border-transparent text-muted-foreground"}" data-pda-exec-action="switch-binding-tab" data-tab="${c.key}" data-skip-page-rerender="true">${c.label}<span class="ml-1 opacity-70">(${s[c.key]})</span></button>`).join("")}</div>
    <div class="px-4">${Xt()}</div>
    <div class="space-y-3 px-4" data-pda-exec-card-container="binding">${o.rows.length?o.rows.map(Le).join(""):'<div class="rounded-lg border bg-muted/20 py-8 text-center text-sm text-muted-foreground">当前没有此状态的捆条加工单</div>'}</div>
    <div class="px-4">${_(o,"binding")}</div>
  </section>`}function _e(e){return S(e)==="WOOL"?Mt(e):S(e)==="WATER_SOLUBLE"?_t(e):i.activeTab==="NOT_STARTED"?Ut(e):i.activeTab==="IN_PROGRESS"?Vt(e):i.activeTab==="BLOCKED"?qt(e):Ft(e)}function Ke(e,t){const r=M(e,i.generalVisibleCount,b);return i.generalVisibleCount=r.visibleCount||b,`<div class="space-y-3" data-pda-exec-card-container="general">${r.rows.length?r.rows.map(_e).join(""):`<div class="py-10 text-center text-sm text-muted-foreground">${a(t)}</div>`}</div>
    ${_(r,"general")}`}function _t(e,t=tt(e.taskId)){if(!t)return"";const r=Je(t.waterOrderId),s=t.status==="PRODUCTION_PAUSED"?"查看主管处理":(r==null?void 0:r.actionName)||"查看任务",n=t.status==="PRODUCTION_PAUSED",d=rt(t.waterOrderId);return`
    <article class="cursor-pointer rounded-lg border ${n?"border-red-200":""} transition-colors hover:border-primary" data-testid="pda-exec-task-card" data-pda-exec-action="open-detail" data-task-id="${a(e.taskId)}">
      <div class="space-y-2.5 p-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-sm font-semibold">水溶加工单</div>
            <div class="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">${a(t.waterOrderNo)}</div>
          </div>
          ${N(e)}
        </div>

        <div class="flex gap-3"><button type="button" class="relative h-16 w-16 shrink-0 cursor-zoom-in overflow-hidden rounded-lg border bg-white" data-pda-image-preview-url="${a(d.material)}" data-pda-image-preview-title="${a(`${t.materialName} 实物图`)}" data-skip-page-rerender="true" aria-label="查看${a(t.materialName)}大图"><img class="h-full w-full object-cover" src="${a(d.material)}" alt="${a(`${t.materialName} 实物图`)}" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"><span class="absolute inset-0 flex items-center justify-center bg-white px-1 text-center text-[10px] text-muted-foreground">图片加载中</span></button><div class="min-w-0 flex-1"><div class="font-medium">${a(t.materialName)}</div><div class="mt-1 break-all text-[11px] text-muted-foreground">${a(t.materialCode)}</div><div class="mt-1 text-xs">计划 ${a(`${t.plannedQty.toLocaleString("zh-CN")} ${t.qtyUnit}`)}</div></div></div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div class="text-muted-foreground">当前步骤</div>
          <div class="font-medium">${a(et[t.status])}</div>
          <div class="text-muted-foreground">下一步</div>
          <div class="font-medium">${a(s)}</div>
          <div class="text-muted-foreground">生产单号</div>
          <div class="truncate font-medium">${a(t.productionOrderNo)}</div>
        </div>

        ${n?`<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"><div class="font-medium">生产暂停</div><p class="mt-1">${a(t.exceptionReason||"等待主管处理")}</p></div>`:""}

        <button
          class="inline-flex min-h-8 w-full items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          data-pda-exec-action="open-detail"
          data-task-id="${a(e.taskId)}"
        >
          查看任务
        </button>
      </div>
    </article>
  `}function P(){const e=document.querySelector('[data-testid="pda-exec-card-list"]');if(!e)return;const t=v();T(t)&&H();const r=Y(t);if(T(t)){e.innerHTML=je(r);return}const s=Ie(r),n=X(s,i.activeTab);e.innerHTML=`${Me(t)}${Pe(t)}${r.length?`<section class="space-y-3" data-pda-general-task-list><h2 class="text-sm font-semibold">其他执行任务</h2>${Ke(n,Oe(r))}</section>`:""}`,queueMicrotask(J)}function Kt(e,t){const r=v(),s=document.querySelector(`[data-pda-exec-card-container="${e}"]`),n=document.querySelector(`[data-pda-exec-auto-load-sentinel="${e}"]`);if(!s||!n)return;let d=i.generalVisibleCount,o="",c=0;if(e==="special-craft"){d=i.specialCraftVisibleCount;const p=ke(r).filter(x=>w(g(x))).filter(x=>g(x)===i.specialCraftTab);c=p.length;const f=Math.min(Math.max(b,t),c);o=p.slice(d,f).map(Re).join(""),i.specialCraftVisibleCount=f}else if(e==="binding"){d=i.bindingVisibleCount;const p=Ae(r).filter(Z).filter(x=>h(x)===i.bindingTab);c=p.length;const f=Math.min(Math.max(b,t),c);o=p.slice(d,f).map(Le).join(""),i.bindingVisibleCount=f}else{T(r)&&H();const p=Y(r),f=Ie(p),x=X(f,i.activeTab);c=x.length;const k=Math.min(Math.max(b,t),c);o=x.slice(d,k).map(_e).join(""),i.generalVisibleCount=k}o&&s.insertAdjacentHTML("beforeend",o);const u=e==="special-craft"?i.specialCraftVisibleCount:e==="binding"?i.bindingVisibleCount:i.generalVisibleCount,l=M(new Array(c).fill(null),u,b);n.outerHTML=_(l,e),queueMicrotask(J)}function jt(){if(typeof document>"u")return;const e=document.querySelector('[data-testid="pda-exec-card-list"]'),t=e==null?void 0:e.closest('[data-pda-scroll-container="true"]');if(!e||!t)return;const r=t.getBoundingClientRect(),s=Array.from(e.querySelectorAll("[data-pda-exec-auto-load-sentinel]")).find(o=>{if(o.dataset.autoLoading==="true")return!1;const c=o.getBoundingClientRect();return c.top<=r.bottom+240&&c.bottom>=r.top-32});if(!s)return;const n=s.dataset.listKey,d=Number(s.dataset.nextVisibleCount);!n||!Number.isFinite(d)||(s.dataset.autoLoading="true",Kt(n,d))}function le(){typeof window>"u"||B!==null||(B=window.requestAnimationFrame(()=>{B=null,jt()}))}function J(){typeof document>"u"||typeof window>"u"||(oe||(oe=!0,document.addEventListener("scroll",le,{capture:!0,passive:!0})),le())}function je(e){const t=Array.from(new Map(e.filter(n=>L(n)).map(n=>[n.taskId,n])).values()),r=i.searchKeyword.trim(),s=r?t.filter(n=>ge(n,r)):t;return s.length===0?`<div class="py-12 text-center text-sm text-muted-foreground">${r?"当前关键词未找到 KOL 整单任务":"当前暂无 KOL 整单任务"}</div>`:s.map(n=>{const d=ct(n.taskId),o=Math.max(n.qty-d,0),c=n.status==="IN_PROGRESS"&&o>0,u=n.status!=="DONE"&&d===n.qty,l=n.status==="DONE"?"已完成":n.status==="IN_PROGRESS"?"加工中":"未开工";return`
      <article class="rounded-xl border bg-card p-4" data-testid="pda-exec-task-card">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0"><div class="truncate text-sm font-semibold">KOL 整单任务</div><div class="mt-1 truncate font-mono text-xs text-muted-foreground">${a(n.taskNo||n.taskId)}</div></div>
          <span class="shrink-0 rounded-full px-2 py-1 text-[11px] ${n.status==="DONE"?"bg-green-50 text-green-700":n.status==="IN_PROGRESS"?"bg-blue-50 text-blue-700":"bg-amber-50 text-amber-700"}">${l}</span>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div class="text-muted-foreground">生产单</div><div class="truncate font-medium">${a(n.productionOrderNo||n.productionOrderId||"-")}</div>
          <div class="text-muted-foreground">售卖类型</div><div class="font-medium">${a(n.saleTypeSnapshot||"-")}</div>
          <div class="text-muted-foreground">任务数量</div><div class="font-medium">${n.qty} 件</div>
          <div class="text-muted-foreground">已加工 / 已交出</div><div class="font-medium">${d} 件</div>
          <div class="text-muted-foreground">固定总价</div><div class="font-medium">${Number(n.fixedTotalPrice||0).toLocaleString("id-ID")} ${a(n.fixedTotalPriceCurrency||"IDR")} / 整单</div>
        </div>
        <div class="mt-4 grid grid-cols-3 gap-2">
          <button class="min-h-11 rounded-xl border px-2 text-xs font-semibold ${n.status==="DONE"?"opacity-40":""}" data-pda-exec-action="open-detail" data-task-id="${a(n.taskId)}" ${n.status==="DONE"?"disabled":""}>去加工领料</button>
          <button class="min-h-11 rounded-xl border px-2 text-xs font-semibold ${c?"border-blue-300 text-blue-700":"opacity-40"}" data-pda-exec-action="open-detail" data-task-id="${a(n.taskId)}" ${c?"":"disabled"}>发起交出</button>
          <button class="min-h-11 rounded-xl bg-primary px-2 text-xs font-semibold text-primary-foreground ${u?"":n.status==="DONE"?"bg-green-600":"opacity-40"}" data-pda-exec-action="open-detail" data-task-id="${a(n.taskId)}" ${u?"":"disabled"}>${n.status==="DONE"?"已完成":"完成"}</button>
        </div>
      </article>
    `}).join("")}function Bt(e){const t=`
    <div class="flex min-h-[760px] flex-col bg-background" data-testid="pda-exec-page" data-kol-exec-list>
      <header class="sticky top-0 z-30 space-y-3 border-b bg-background p-4">
        <div><h1 class="text-base font-semibold">执行</h1><p class="mt-1 text-xs text-muted-foreground">仅保留加工领料、发起交出和完成；加工领料与发起交出均可多次。</p></div>
        <div class="relative"><i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i><input class="h-10 w-full rounded-xl border bg-background pl-9 pr-3 text-sm" placeholder="搜索任务号 / 生产单号" data-pda-exec-field="searchKeyword" data-skip-page-rerender="true" value="${a(i.searchKeyword)}" /></div>
      </header>
      <main class="flex-1 space-y-3 p-4" data-testid="pda-exec-card-list">${je(e)}</main>
    </div>
  `;return q(t,"exec",{disableTodoAutoOpen:!0})}function G(e){const t=m.getState().pathname,r=ze(e);return r&&$(r)?Ye(e,t):D(e,t)}function Ut(e){var re,ae;const t=I(e),r=Q(e,t),{prerequisite:s,due:n}=Ce(e),d=e.taskDeadline,o=z(d,e.finishedAt),c=n.startDueAt||"—",u=Ee(e),l=Nt(e),p=Rt(s),f=Pt(e,s),x=u?y(e):l?`${e.productionOrderId}｜${l.executionOrderNo}`:y(e),k=u?kt(u):l?U([y(e),l.cutOrderNo?`裁片单 ${l.cutOrderNo}`:"裁片单待绑定",l.markerPlanNo?`唛架 ${l.markerPlanNo}`:""]):C(e),ee=u?U([u.materialAlias||u.materialSku,u.materialTypeLabel])||"待确认":l?U([l.materialAlias||l.materialSku,l.colorLabel,l.materialTypeLabel])||"待确认":"",Fe=u?`${(u.orderQty||e.qty).toLocaleString("zh-CN")} 件`:l?`${e.qty.toLocaleString("zh-CN")} 片`:r.valueText,te=n.startRiskStatus==="DUE_SOON"&&typeof n.remainingMs=="number"?`距开工时限不足 ${pt(n.remainingMs)} 小时，请尽快补齐开工信息`:n.startRiskStatus==="OVERDUE"?"开工已逾期，请立即补录开工信息":"";return`
    <article class="cursor-pointer rounded-lg border transition-colors hover:border-primary" data-testid="pda-exec-task-card" data-pda-exec-action="open-detail" data-task-id="${a(e.taskId)}">
      <div class="space-y-2.5 p-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold">${a(x)}</div>
            <div class="mt-0.5 truncate text-[11px] text-muted-foreground">${a(k)}</div>
          </div>
          <div class="flex shrink-0 items-center gap-1.5">
            ${N(e)}
            ${K(e.assignmentMode)}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          ${u?`
                  <div class="text-muted-foreground">当前工序</div>
                  <div class="font-medium">${a(t)}</div>
                  <div class="text-muted-foreground">裁片单</div>
                  <div class="truncate font-medium">${a(`${u.cutOrderGroups.length} 张`)}</div>
                  <div class="text-muted-foreground">铺布单</div>
                  <div class="truncate font-medium">${a(`${u.cutPieceOrderCount} 张`)}</div>
                  <div class="text-muted-foreground">下一步</div>
                  <div class="truncate font-medium">${a(u.nextRecommendedAction)}</div>
                  <div class="text-muted-foreground">面料</div>
                  <div class="truncate font-medium">${a(ee)}</div>
                `:l?`
                  <div class="text-muted-foreground">当前工序</div>
                  <div class="font-medium">${a(t)}</div>
                  <div class="text-muted-foreground">铺布单</div>
                  <div class="truncate font-medium">${a(l.executionOrderNo)}</div>
                  <div class="text-muted-foreground">裁片单</div>
                  <div class="truncate font-medium">${a(l.cutOrderNo||"待绑定")}</div>
                  <div class="text-muted-foreground">唛架</div>
                  <div class="truncate font-medium">${a(l.markerPlanNo||"待确认")}</div>
                  <div class="text-muted-foreground">面料</div>
                  <div class="truncate font-medium">${a(ee)}</div>
                `:`
                  <div class="text-muted-foreground">${((re=e.sourceSnapshot)==null?void 0:re.sourceType)==="DESIGN_REVISION"?"设计改款任务":"生产单号"}</div>
                  <div class="truncate font-medium">${a(((ae=e.sourceSnapshot)==null?void 0:ae.sourceType)==="DESIGN_REVISION"?e.sourceSnapshot.designRevisionTaskNo||e.sourceSnapshot.designRevisionTaskId||"来源未记录":e.productionOrderId)}</div>
                  <div class="text-muted-foreground">原始任务</div>
                  <div class="truncate font-medium">${a(C(e))}</div>
                  <div class="text-muted-foreground">当前工序</div>
                  <div class="font-medium">${a(t)}</div>
                `}
          <div class="text-muted-foreground">数量</div>
          <div class="font-medium">${a(Fe)}</div>
          ${d?`
                  <div class="text-muted-foreground">任务截止</div>
                  <div class="font-medium ${o&&o.label!=="正常"?o.textClass:""}">${a(d||"")}</div>
                `:""}
          <div class="text-muted-foreground">开工时限</div>
          <div class="font-medium ${n.startRiskStatus==="OVERDUE"?"text-red-700":n.startRiskStatus==="DUE_SOON"?"text-amber-700":""}">${a(c)}</div>
        </div>

        ${j(e)}

        <div class="space-y-0.5 rounded-md border px-3 py-2 text-xs ${be(s.met?"border-green-200 bg-green-50":"border-amber-200 bg-amber-50")}">
          <div class="flex items-center justify-between gap-2">
            <span class="text-muted-foreground">开工条件</span>
            <span class="rounded px-1.5 py-0.5 font-medium ${s.met?"bg-green-100 text-green-700":"bg-amber-100 text-amber-700"}">${a(p)}</span>
          </div>
          <p class="mt-1 font-medium ${s.met?"text-green-700":"text-amber-700"}">${a(s.statusLabel)}</p>
        </div>

        ${te?`<div class="rounded-md border px-3 py-1.5 text-xs ${n.startRiskStatus==="OVERDUE"?"border-red-200 bg-red-50 text-red-700":"border-amber-200 bg-amber-50 text-amber-700"}">${a(te)}</div>`:""}

        <div class="flex gap-2 pt-1">
          <button
            class="inline-flex min-h-8 items-center rounded-md px-3 text-xs font-medium ${f.className}"
            data-pda-exec-action="${f.action}"
            data-task-id="${a(e.taskId)}"
            ${f.action==="go-handover"?'data-tab="pickup"':""}
          >
            <i data-lucide="${f.icon}" class="mr-1 h-3 w-3"></i>
            ${a(f.label)}
          </button>

          <button
            class="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
            data-pda-exec-action="open-detail"
            data-task-id="${a(e.taskId)}"
          >
            <i data-lucide="eye" class="h-3.5 w-3.5"></i>
          </button>
        </div>
      </div>
    </article>
  `}function Vt(e){var p,f;const t=I(e),r=Q(e,t),s=Ee(e),n=!!(s||E(e.taskId)||O(e.taskId)),d=z(e.taskDeadline,e.finishedAt),o=xt(e),c=gt(e),u=o.required?o.status==="REPORTED"?'<span class="inline-flex items-center rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">已上报关键节点</span>':'<span class="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">待上报关键节点</span>':"",l=L(e);return`
    <article class="cursor-pointer rounded-lg border transition-colors hover:border-primary" data-testid="pda-exec-task-card" data-pda-exec-action="open-detail" data-task-id="${a(e.taskId)}">
      <div class="space-y-2.5 p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate font-mono text-sm font-semibold">${a(y(e))}</span>
          <div class="flex items-center gap-1.5">
            ${N(e)}
            ${K(e.assignmentMode)}
            ${l?"":u}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          ${s?`
                  <div class="text-muted-foreground">生产单号</div>
                  <div class="truncate font-medium">${a(s.productionOrderNo)}</div>
                  <div class="text-muted-foreground">裁片单</div>
                  <div class="truncate font-medium">${a(`${s.cutOrderGroups.length} 张`)}</div>
                  <div class="text-muted-foreground">铺布单</div>
                  <div class="font-medium">${a(`${s.cutPieceOrderCount} 张`)}</div>
                  <div class="text-muted-foreground">下一步</div>
                  <div class="truncate font-medium">${a(s.nextRecommendedAction)}</div>
                `:`
                  <div class="text-muted-foreground">${((p=e.sourceSnapshot)==null?void 0:p.sourceType)==="DESIGN_REVISION"?"设计改款任务":"生产单号"}</div>
                  <div class="truncate font-medium">${a(((f=e.sourceSnapshot)==null?void 0:f.sourceType)==="DESIGN_REVISION"?e.sourceSnapshot.designRevisionTaskNo||e.sourceSnapshot.designRevisionTaskId||"来源未记录":e.productionOrderId)}</div>
                  <div class="text-muted-foreground">原始任务</div>
                  <div class="truncate font-medium">${a(C(e))}</div>
                  <div class="text-muted-foreground">当前工序</div>
                  <div class="font-medium">${a(t)}</div>
                  <div class="text-muted-foreground">${a(r.label)}</div>
                  <div class="font-medium">${a(r.valueText)}</div>
                `}

          ${e.startedAt?`
                  <div class="text-muted-foreground">开工时间</div>
                  <div class="flex items-center gap-0.5 font-medium">
                    <i data-lucide="clock" class="h-3 w-3 text-muted-foreground"></i>
                    ${a(e.startedAt)}
                  </div>
                `:""}

          ${e.taskDeadline?`
                  <div class="text-muted-foreground">任务截止</div>
                  <div class="font-medium ${d?d.textClass:""}">${a(e.taskDeadline||"")}</div>
                `:""}
        </div>

        ${j(e)}

        ${d&&d.label!=="正常"?`<div class="rounded px-2 py-1 text-xs ${d.hintClass}">时限状态：${a(d.label)}</div>`:""}

        ${!l&&o.required&&o.status!=="REPORTED"&&c?`<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">需${a(c)}</div>`:""}

        ${e.blockReason?`
                <div class="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                  当前卡点：${a(Te(e.blockReason))}
                  ${e.blockRemark?` — ${a(e.blockRemark)}`:""}
                </div>
              `:""}

        <div class="flex gap-2 pt-1">
          ${l?"":`
            <button
              class="inline-flex h-7 items-center rounded-md border px-3 text-xs hover:bg-muted"
              data-pda-exec-action="open-detail-action"
              data-task-id="${a(e.taskId)}"
              data-action="pause"
            >
              <i data-lucide="alert-triangle" class="mr-1 h-3 w-3"></i>
              上报暂停
            </button>
          `}

          ${s?`
                  <button
                    class="inline-flex h-7 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
                    data-pda-exec-action="open-detail"
                    data-task-id="${a(e.taskId)}"
                  >
                    <i data-lucide="play" class="mr-1 h-3 w-3"></i>
                    进入裁片
                  </button>
                `:l?`
                  <button
                    class="inline-flex h-7 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
                    data-pda-exec-action="open-detail"
                    data-task-id="${a(e.taskId)}"
                  >
                    <i data-lucide="play" class="mr-1 h-3 w-3"></i>
                    继续处理
                  </button>
                `:n?"":`
                  <button
                    class="inline-flex h-7 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
                    data-pda-exec-action="finish-task"
                    data-task-id="${a(e.taskId)}"
                  >
                    <i data-lucide="check-circle" class="mr-1 h-3 w-3"></i>
                    完工
                  </button>
                `}

          <button
            class="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
            data-pda-exec-action="open-detail"
            data-task-id="${a(e.taskId)}"
          >
            <i data-lucide="eye" class="h-3.5 w-3.5"></i>
          </button>
        </div>
      </div>
    </article>
  `}function qt(e){var o,c;const t=I(e),r=z(e.taskDeadline,e.finishedAt),s=vt(e),n=e.pauseReasonLabel,d=e.pauseReportedAt;return`
    <article class="cursor-pointer rounded-lg border border-red-200 transition-colors hover:border-red-400" data-testid="pda-exec-task-card" data-pda-exec-action="open-detail" data-task-id="${a(e.taskId)}">
      <div class="space-y-2.5 p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate font-mono text-sm font-semibold">${a(y(e))}</span>
          <div class="flex shrink-0 items-center gap-1.5">
            ${N(e)}
            ${K(e.assignmentMode)}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div class="text-muted-foreground">${((o=e.sourceSnapshot)==null?void 0:o.sourceType)==="DESIGN_REVISION"?"设计改款任务":"生产单号"}</div>
          <div class="truncate font-medium">${a(((c=e.sourceSnapshot)==null?void 0:c.sourceType)==="DESIGN_REVISION"?e.sourceSnapshot.designRevisionTaskNo||e.sourceSnapshot.designRevisionTaskId||"来源未记录":e.productionOrderId)}</div>
          <div class="text-muted-foreground">原始任务</div>
          <div class="truncate font-medium">${a(C(e))}</div>
          <div class="text-muted-foreground">当前工序</div>
          <div class="font-medium">${a(t)}</div>
          ${e.taskDeadline?`
                  <div class="text-muted-foreground">任务截止</div>
                  <div class="font-medium ${r?r.textClass:""}">${a(e.taskDeadline||"")}</div>
                `:""}
        </div>

        ${j(e)}

        <div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-medium text-red-700">${a(n||Te(e.blockReason)||"已上报暂停")}</span>
            <span class="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] ${s.className}">${s.label}</span>
          </div>
          ${e.blockRemark?`<p class="mt-1 text-red-600">${a(e.blockRemark)}</p>`:""}
          ${d?`<p class="mt-1 flex items-center gap-1 text-muted-foreground"><i data-lucide="clock" class="h-3 w-3"></i>上报时间：${a(d)}</p>`:""}
        </div>

        <div class="flex gap-2 pt-1">
          <button
            class="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
            data-pda-exec-action="open-detail"
            data-task-id="${a(e.taskId)}"
          >
            <i data-lucide="eye" class="h-3.5 w-3.5"></i>
          </button>
        </div>
      </div>
    </article>
  `}function Ft(e){var d,o;const t=I(e),r=Q(e,t),s=e.handoutStatus||"PENDING",n=s==="HANDED_OUT"?"已交出":"待交出";return`
    <article class="cursor-pointer rounded-lg border transition-colors hover:border-primary" data-testid="pda-exec-task-card" data-pda-exec-action="open-detail" data-task-id="${a(e.taskId)}">
      <div class="space-y-2.5 p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate font-mono text-sm font-semibold">${a(y(e))}</span>
          <div class="flex shrink-0 items-center gap-1.5">
            ${N(e)}
            ${K(e.assignmentMode)}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div class="text-muted-foreground">${((d=e.sourceSnapshot)==null?void 0:d.sourceType)==="DESIGN_REVISION"?"设计改款任务":"生产单号"}</div>
          <div class="truncate font-medium">${a(((o=e.sourceSnapshot)==null?void 0:o.sourceType)==="DESIGN_REVISION"?e.sourceSnapshot.designRevisionTaskNo||e.sourceSnapshot.designRevisionTaskId||"来源未记录":e.productionOrderId)}</div>
          <div class="text-muted-foreground">原始任务</div>
          <div class="truncate font-medium">${a(C(e))}</div>
          <div class="text-muted-foreground">当前工序</div>
          <div class="font-medium">${a(t)}</div>
          <div class="text-muted-foreground">${a(r.label)}</div>
          <div class="font-medium">${a(r.valueText)}</div>

          ${e.finishedAt?`
                  <div class="text-muted-foreground">完工时间</div>
                  <div class="flex items-center gap-0.5 font-medium">
                    <i data-lucide="clock" class="h-3 w-3 text-muted-foreground"></i>
                    ${a(e.finishedAt)}
                  </div>
                `:""}

          <div class="text-muted-foreground">交接状态</div>
          <div class="font-medium ${s==="HANDED_OUT"?"text-green-700":"text-amber-700"}">${n}</div>
        </div>

        ${j(e)}

        ${s!=="HANDED_OUT"?'<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">完工不等于结束，请尽快完成交出交接</div>':""}

        <div class="flex gap-2 pt-1">
          <button
            class="inline-flex h-7 items-center rounded-md border border-amber-300 px-3 text-xs text-amber-700 hover:bg-amber-50"
            data-pda-exec-action="go-handover"
            data-tab="handout"
          >
            <i data-lucide="arrow-left-right" class="mr-1 h-3 w-3"></i>
            去交出
          </button>

          <button
            class="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
            data-pda-exec-action="open-detail"
            data-task-id="${a(e.taskId)}"
          >
            <i data-lucide="eye" class="h-3.5 w-3.5"></i>
          </button>
        </div>
      </div>
    </article>
  `}function Be(e){return Ge().some(t=>t.factoryId===e)}function Wt(e){var d;const t=e.order,r=/^(?:https?:\/\/|\/|data:image\/)/i.test(((d=t.styleImageUrl)==null?void 0:d.trim())||"")?t.styleImageUrl.trim():"",s=t.outputPlanLines.map(o=>[o.colorName,o.sizeCode,o.woolPartName].filter(Boolean).join("/")).filter(Boolean).join("、")||"待核对加工对象",n=`${t.styleNo} · ${t.styleName}`;return`<article class="rounded-lg border bg-background p-3" data-pda-wool-scan-candidate>
    <div class="flex gap-3">
      ${r?`<button type="button" class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/30" data-pda-image-preview-url="${a(r)}" data-pda-image-preview-title="${a(n)}" data-skip-page-rerender="true" aria-label="查看${a(n)}大图"><img class="h-full w-full object-cover" src="${a(r)}" alt="${a(`${t.styleName}款式图片`)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>`:'<div class="flex h-16 w-16 shrink-0 items-center justify-center rounded border bg-muted/30"><span class="px-1 text-center text-[10px] text-muted-foreground">暂无款式图</span></div>'}
      <div class="min-w-0 flex-1 text-xs">
        <div class="font-semibold">${a(t.woolOrderNo)}</div>
        <div class="mt-1 text-muted-foreground">生产单：${a(t.productionOrderNo)}</div>
        <div class="mt-1">${a(t.styleNo)} · ${a(s)}</div>
      </div>
    </div>
    <button type="button" class="mt-3 h-10 w-full rounded bg-primary text-sm font-medium text-primary-foreground" data-pda-exec-action="open-detail" data-task-id="${a(t.taskId)}">选择此加工单</button>
  </article>`}function Ue(){const e=i.woolScanMessage?`<div class="rounded border px-3 py-2 text-xs ${i.woolScanTone==="error"?"border-red-200 bg-red-50 text-red-700":"border-blue-200 bg-blue-50 text-blue-800"}">${a(i.woolScanMessage)}</div>`:"",t=i.woolScanCandidates.length>0?`<div class="space-y-2">${i.woolScanCandidates.map(Wt).join("")}</div>`:"";return`<div class="mt-3 space-y-2" data-pda-exec-wool-scan-feedback>${e}${t}</div>`}function Gt(){return`<section class="rounded-xl border border-blue-200 bg-blue-50/70 p-3" data-pda-exec-wool-scan>
    <div class="flex items-start gap-2">
      <i data-lucide="scan-line" class="mt-0.5 h-5 w-5 shrink-0 text-blue-700"></i>
      <div><div class="text-sm font-semibold text-blue-950">扫码进入加工填报</div><div class="mt-1 text-xs text-blue-800">优先扫描生产单码或毛织加工单码；一个生产单有多张加工单时再选择。</div></div>
    </div>
    <div class="mt-3 flex gap-2">
      <input
        class="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
        placeholder="扫描生产单 / 加工单"
        data-pda-exec-field="searchKeyword"
        data-pda-scan-enter="true"
        data-skip-page-rerender="true"
        value="${a(i.searchKeyword)}"
      />
      <button type="button" class="h-10 shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-pda-exec-action="scan-wool-order">识别加工单</button>
    </div>
    <div class="mt-2 text-[11px] text-blue-700">“执行”只处理加工填报、关联横机设备、完成加工单。</div>
    ${Ue()}
  </section>`}function ue(e){i.woolLastResolvedCode=e.trim();const t=st(e,v(),"EXECUTION");i.woolScanMessage=t.message,i.woolScanTone=t.status==="MATCH"||t.status==="MULTIPLE"?"info":"error",i.woolScanCandidates=t.candidates,t.status==="MATCH"&&m.navigate(G(t.candidates[0].order.taskId))}function Ht(){const e=document.querySelector("[data-pda-exec-wool-scan-feedback]");e&&(e.outerHTML=Ue())}function Qt(e){const{order:t}=e,r=`${e.styleNo} · ${e.styleName}`;return`<article class="rounded-lg border bg-background p-3" data-pda-special-craft-scan-candidate>
    <div class="flex gap-3">
      ${e.styleImageUrl?`<button type="button" class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/30" data-pda-image-preview-url="${a(e.styleImageUrl)}" data-pda-image-preview-title="${a(r)}" data-skip-page-rerender="true" aria-label="查看${a(r)}大图"><img class="h-full w-full object-cover" src="${a(e.styleImageUrl)}" alt="${a(r)}款式图" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>`:'<div class="flex h-16 w-16 shrink-0 items-center justify-center rounded border bg-muted/30"><span class="px-1 text-center text-[10px] text-muted-foreground">款式图缺失</span></div>'}
      <div class="min-w-0 flex-1 text-xs">
        <div class="font-semibold">${a(t.taskOrderNo)}</div>
        <div class="mt-1 text-muted-foreground">生产单：${a(t.productionOrderNo)}</div>
        <div class="mt-1">${a(t.operationName)} · ${a(t.targetObject)} · ${t.planQty} ${a(t.unit)}</div>
      </div>
    </div>
    <button type="button" class="mt-3 h-10 w-full rounded bg-primary text-sm font-medium text-primary-foreground" data-pda-exec-action="select-special-craft-order" data-source-type="${e.sourceType}" data-work-order-id="${a(e.workOrderId)}" data-source-task-id="${a(e.sourceTaskId)}">选择此加工单</button>
  </article>`}function Ve(){const e=i.specialCraftScanMessage?`<div class="rounded border px-3 py-2 text-xs ${i.specialCraftScanTone==="error"?"border-red-200 bg-red-50 text-red-700":"border-blue-200 bg-blue-50 text-blue-800"}">${a(i.specialCraftScanMessage)}</div>`:"",t=i.specialCraftScanCandidates.length>0?`<div class="space-y-2">${i.specialCraftScanCandidates.map(Qt).join("")}</div>`:"";return`<div class="mt-3 space-y-2" data-pda-exec-special-craft-scan-feedback>${e}${t}</div>`}function zt(){return`<section class="rounded-xl border border-blue-200 bg-blue-50/70 p-3" data-pda-exec-special-craft-scan>
    <div class="flex items-start gap-2">
      <i data-lucide="scan-line" class="mt-0.5 h-5 w-5 shrink-0 text-blue-700"></i>
      <div class="text-sm font-semibold text-blue-950">扫码加工单</div>
    </div>
    <div class="mt-3 flex gap-2">
      <input
        class="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
        placeholder="扫描生产单 / 加工单"
        data-pda-exec-field="specialCraftScanKeyword"
        data-pda-scan-enter="true"
        data-skip-page-rerender="true"
        value="${a(i.specialCraftScanKeyword)}"
      />
      <button type="button" class="h-10 shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-pda-exec-action="scan-special-craft-order">识别加工单</button>
    </div>
    ${Ve()}
  </section>`}function pe(e){i.specialCraftLastResolvedCode=e.trim();const t=se(e,v(),"EXECUTION"),r=t.candidates.filter(n=>w(g(n)));if(i.specialCraftScanCandidates=r,r.length===1){i.specialCraftScanMessage=t.message,i.specialCraftScanTone="info",m.navigate(W(r[0]));return}if(r.length>1){i.specialCraftScanMessage=`找到 ${r.length} 张可执行加工单，请选择。`,i.specialCraftScanTone="info";return}if(t.candidates.length>0){const n=new Set(t.candidates.map(g));i.specialCraftScanMessage=n.size===1&&n.has("NOT_STARTED")?"该加工单待接收，请到“交接-待接收”处理。":n.size===1&&n.has("BLOCKED")?"该加工单待交出，请到“交接-待交出”处理。":"这些加工单属于接收或交出环节，请到“交接”处理。",i.specialCraftScanTone="info";return}if(se(e,v(),"RECEIVE").candidates.length>0){i.specialCraftScanMessage="该加工单待接收，请到“交接-待接收”处理。",i.specialCraftScanTone="info";return}i.specialCraftScanMessage=t.message,i.specialCraftScanTone="error"}function me(){const e=document.querySelector("[data-pda-exec-special-craft-scan-feedback]");e&&(e.outerHTML=Ve())}function Yt(e){const{order:t}=e;return`<article class="rounded-lg border bg-background p-3" data-pda-binding-scan-candidate>
    <div class="text-xs"><div class="font-semibold">${a(t.bindingOrderNo)}</div><div class="mt-1 text-muted-foreground">生产单：${a(t.sourceProductionOrderNo)}</div><div class="mt-1">${a(t.materialIdentity.materialSku)} · ${t.bindingSpecificationCount} 个规格 · ${t.plannedOutputQty} 米</div><div class="mt-1 text-muted-foreground">来源任务：${a(t.sourceTaskNo)}</div></div>
    <button type="button" class="mt-3 h-10 w-full rounded bg-primary text-sm font-medium text-primary-foreground" data-pda-exec-action="select-binding-order" data-source-type="${e.sourceType}" data-work-order-id="${a(e.workOrderId)}">选择此捆条加工单</button>
  </article>`}function qe(){const e=i.bindingScanMessage?`<div class="rounded border px-3 py-2 text-xs ${i.bindingScanTone==="error"?"border-red-200 bg-red-50 text-red-700":"border-blue-200 bg-blue-50 text-blue-800"}">${a(i.bindingScanMessage)}</div>`:"",t=i.bindingScanCandidates.length?`<div class="space-y-2">${i.bindingScanCandidates.map(Yt).join("")}</div>`:"";return`<div class="mt-3 space-y-2" data-pda-exec-binding-scan-feedback>${e}${t}</div>`}function Xt(){return`<section class="rounded-xl border border-blue-200 bg-blue-50/70 p-3" data-pda-exec-binding-scan>
    <div class="flex items-start gap-2"><i data-lucide="scan-line" class="mt-0.5 h-5 w-5 shrink-0 text-blue-700"></i><div class="text-sm font-semibold text-blue-950">扫码捆条加工单</div></div>
    <div class="mt-3 flex gap-2"><input class="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" placeholder="扫描捆条加工单 / 菲票" data-pda-exec-field="bindingSearchKeyword" data-pda-scan-enter="true" data-skip-page-rerender="true" value="${a(i.bindingScanKeyword)}"><button type="button" class="h-10 shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-pda-exec-action="scan-binding-order">识别加工单</button></div>
    ${qe()}
  </section>`}function fe(e){i.bindingLastResolvedCode=e.trim();const t=de(e,v(),"EXECUTION"),r=t.candidates.filter(Z);if(i.bindingScanCandidates=r,r.length===1){i.bindingScanMessage=t.message,i.bindingScanTone="info",m.navigate(De(r[0]));return}if(r.length>1){i.bindingScanMessage=`找到 ${r.length} 张可执行捆条加工单，请选择。`,i.bindingScanTone="info";return}if(t.candidates.length>0){const n=new Set(t.candidates.map(h));i.bindingScanMessage=n.size===1&&n.has("NOT_STARTED")?"该加工单待接收，请到“交接-待接收”处理。":n.size===1&&n.has("BLOCKED")?"该加工单待交出，请到“交接-待交出”处理。":"这些加工单属于接收或交出环节，请到“交接”处理。",i.bindingScanTone="info";return}if(de(e,v(),"RECEIVE").candidates.length>0){i.bindingScanMessage="该捆条加工单待接收，请到“交接-待接收”处理。",i.bindingScanTone="info";return}i.bindingScanMessage=t.message,i.bindingScanTone="error"}function Zt(){const e=document.querySelector("[data-pda-exec-binding-scan-feedback]");e&&(e.outerHTML=qe())}function xa(){if(!he())return ht();Tt();const t=v();T(t)&&H();const r=Y(t);if(T(t))return Bt(r);if(t===We||t==="ID-F002")return q(`
      <div class="flex min-h-[760px] flex-col bg-background" data-testid="pda-exec-page">
        <main class="flex-1 p-4">
          <section class="rounded-2xl border border-blue-200 bg-blue-50 p-4" data-pda-post-finishing-entry>
            <h1 class="text-base font-semibold text-blue-950">后道现场执行</h1>
            <p class="mt-1 text-xs leading-5 text-blue-800">精确扫描后道加工单或复检单；质检只在 Web 端进行。</p>
            <div class="mt-4 grid grid-cols-2 gap-3">
              <button type="button" class="h-12 rounded-2xl bg-blue-600 text-sm font-semibold text-white" data-nav="/fcs/pda/post-finishing/execute">后道加工</button>
              <button type="button" class="h-12 rounded-2xl border border-blue-300 bg-white text-sm font-semibold text-blue-800" data-nav="/fcs/pda/post-finishing/recheck">后道复检</button>
            </div>
          </section>
        </main>
      </div>
    `,"exec",{disableTodoAutoOpen:!0});queueMicrotask(()=>{ut(),bt()});const s=Be(t),n={NOT_STARTED:[],IN_PROGRESS:[],BLOCKED:[],DONE:[]};for(const l of r){const p=xe(l);n[p].push(l)}const d=X(n,i.activeTab),o=Oe(r),c=s?Gt():`<div class="relative">
          <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
          <input
            class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
            placeholder="搜索任务号 / 加工单号 / 生产单号 / 物料"
            data-pda-exec-field="searchKeyword"
            data-skip-page-rerender="true"
            value="${a(i.searchKeyword)}"
          />
        </div>`,u=`
    <div class="flex min-h-[760px] flex-col bg-background" data-testid="pda-exec-page">
      ${r.length?`<div class="z-20 grid grid-cols-4 border-b bg-background" data-testid="pda-exec-tabs">
        ${$e.map(l=>{const p=l.key===i.activeTab;return`
            <button
              class="border-b-2 py-2.5 text-xs font-medium transition-colors ${be(p?"border-primary text-primary":"border-transparent text-muted-foreground")}"
              data-pda-exec-action="switch-tab"
              data-tab="${l.key}"
            >
              ${a(l.label)}
              <span class="ml-1 text-[10px] opacity-70">(${n[l.key].length})</span>
            </button>
          `}).join("")}
      </div>`:""}

      ${c?`<header class="z-10 space-y-3 border-b bg-background p-4">${c}</header>`:""}

      <div class="flex-1 space-y-3 p-4" data-testid="pda-exec-card-list">
        ${Me(t)}
        ${Pe(t)}
        ${r.length?`<section class="space-y-3" data-pda-general-task-list><h2 class="text-sm font-semibold">其他执行任务</h2>${Ke(d,o)}</section>`:""}
      </div>
    </div>
  `;return queueMicrotask(J),q(u,"exec",{disableTodoAutoOpen:!0})}function ga(e,t){if(!yt())return!0;const r=e.closest("[data-pda-exec-field]");if(r instanceof HTMLInputElement||r instanceof HTMLSelectElement){const d=r.dataset.pdaExecField;if(!d)return!0;if(d==="searchKeyword"){if(i.searchKeyword=r.value,Se(),(t==null?void 0:t.type)==="keydown"&&t.key==="Enter"){const o=v();return Be(o)?ue(r.value):P(),!0}return r.value.trim()!==i.woolLastResolvedCode&&(i.woolScanMessage="",i.woolScanCandidates=[]),r.value.trim()!==i.specialCraftLastResolvedCode&&(i.specialCraftScanMessage="",i.specialCraftScanCandidates=[]),P(),Ht(),me(),!0}if(d==="specialCraftScanKeyword")return i.specialCraftScanKeyword=r.value,(t==null?void 0:t.type)==="keydown"&&t.key==="Enter"?(pe(r.value),!0):(r.value.trim()!==i.specialCraftLastResolvedCode&&(i.specialCraftScanMessage="",i.specialCraftScanCandidates=[]),me(),!0);if(d==="bindingSearchKeyword")return i.bindingScanKeyword=r.value,(t==null?void 0:t.type)==="keydown"&&t.key==="Enter"?(fe(r.value),!0):(r.value.trim()!==i.bindingLastResolvedCode&&(i.bindingScanMessage="",i.bindingScanCandidates=[]),Zt(),!0)}const s=e.closest("[data-pda-exec-action]");if(!s)return!1;const n=s.dataset.pdaExecAction;if(!n)return!1;if(n==="scan-wool-order"){const d=document.querySelector('[data-pda-exec-wool-scan] [data-pda-exec-field="searchKeyword"]');return i.searchKeyword=(d==null?void 0:d.value)||i.searchKeyword,ue(i.searchKeyword),!0}if(n==="scan-special-craft-order"){const d=document.querySelector('[data-pda-exec-special-craft-scan] [data-pda-exec-field="specialCraftScanKeyword"]');return i.specialCraftScanKeyword=(d==null?void 0:d.value)||i.specialCraftScanKeyword,pe(i.specialCraftScanKeyword),!0}if(n==="scan-binding-order"){const d=document.querySelector('[data-pda-exec-binding-scan] [data-pda-exec-field="bindingSearchKeyword"]');return i.bindingScanKeyword=(d==null?void 0:d.value)||i.bindingScanKeyword,fe(i.bindingScanKeyword),!0}if(n==="select-binding-order"||n==="open-binding-work-order"){const d=s.dataset.workOrderId;if(d){const o=ve(d);o&&m.navigate(De(o))}return!0}if(n==="select-special-craft-order"){const d=s.dataset.workOrderId;if(d){const o=V(d);o&&m.navigate(W(o))}return!0}if(n==="open-special-craft-work-order"){const d=s.dataset.workOrderId;if(d){const o=V(d);o&&m.navigate(W(o))}return!0}if(n==="switch-special-craft-tab"){const d=s.dataset.tab;return d&&w(d)&&(i.specialCraftTab=d,i.specialCraftVisibleCount=b,P()),!0}if(n==="switch-binding-tab"){const d=s.dataset.tab;return d&&w(d)&&(i.bindingTab=d,i.bindingVisibleCount=b,P()),!0}if(n==="switch-tab"){const d=s.dataset.tab;return d&&$e.some(o=>o.key===d)&&(i.activeTab=d,i.generalVisibleCount=b,m.navigate(Ct(d))),!0}if(n==="open-detail"){const d=s.dataset.taskId;return d&&m.navigate(G(d)),!0}if(n==="open-detail-action"){const d=s.dataset.taskId,o=s.dataset.action;if(d&&o){const c=D(d,m.getState().pathname);m.navigate(c.includes("/fcs/pda/cutting/")?c:ce(c,o))}return!0}if(n==="go-start"){const d=s.dataset.taskId;if(d){const o=D(d,m.getState().pathname);m.navigate(o.includes("/fcs/pda/cutting/")?o:ce(o,"start"))}return!0}if(n==="go-prerequisite"){const d=s.dataset.taskId;return d&&m.navigate(D(d,m.getState().pathname)),!0}if(n==="go-handover"){const d=s.dataset.tab||"wait-process";return m.navigate(`/fcs/pda/handover?tab=${d}`),!0}if(n==="go-warehouse")return m.navigate("/fcs/pda/warehouse/wait-process"),!0;if(n==="finish-task"){const d=s.dataset.taskId;if(!d)return!0;const o=we(d);return o?E(d)||O(d)||S(o)==="WOOL"?(R("请进入任务详情按当前节点操作"),!0):L(o)?(R("请进入任务详情，通过“完成”按钮结束整单任务"),m.navigate(G(d)),!0):ft(o)?(Et(d,"PDA"),R("完工成功"),!0):(R("请先完成关键节点上报"),!0):!0}return!1}export{ga as handlePdaExecEvent,xa as renderPdaExecPage,_t as renderWaterSolubleCard};

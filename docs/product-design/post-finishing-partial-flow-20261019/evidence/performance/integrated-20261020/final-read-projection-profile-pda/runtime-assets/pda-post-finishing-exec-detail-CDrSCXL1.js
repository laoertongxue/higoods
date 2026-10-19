import{r as h}from"./pda-shell-BkC1XeMk.js";import{getPdaRuntimeContext as g}from"./pda-runtime-i-BdJ_u-.js";import{d as b}from"./printing-task-domain-TS1czlPT.js";import{s as y}from"./pda-start-link-BmoLRg_T.js";import{s as v}from"./pda-exec-link-DNKG0gkc.js";import{x as s,aO as u}from"./app-shared-DDMaqtkq.js";import{aE as $,aF as P,W as x,_ as O,ah as k,p as F,F as I,w as N,aw as R}from"./post-finishing-full-flow-Dh24S5yB.js";import{g as j,a as A}from"./process-action-writeback-service-BTn5_N6F.js";import{r as S}from"./production-order-identity-D1P4st2b.js";import{d as T,r as f}from"./production-object-overview-BfKtAE_t.js";import"./pda-cutting-execution-source-C88dm0OL.js";import"./domain-snapshot-Fdv5D7sL.js";import"./runtime-inputs-D76Uw-y1.js";import"./craft-display-support-CvsYnyTE.js";import"./index-CGtp3ZVA.js";import"./runtime-process-tasks-CJu_ZvrR.js";import"./factory-receiving-DVz0KTOW.js";import"./design-revision-pcs-storage-BjfzS8H8.js";import"./tmf-domain-shared-DboXqEqI.js";import"./production-orders-CaqheHIM.js";import"./production-order-runtime-store-BEkhNaUU.js";import"./cut-piece-release-BwyKuTvR.js";import"./effective-task-assignments-BasrWhfx.js";import"./pcs-record-core-BxQ0eFLU.js";import"./warehouse-runtime-Ci5PfCBw.js";import"./generated-fei-tickets-D1YHI7wu.js";import"./production-tech-pack-change-domain-DoFncct_.js";import"./pda-handover-events-CcbPoPTF.js";import"./special-craft-task-orders-BgTD5Zqd.js";import"./store-domain-progress-CYhEwzXk.js";import"./ppic-return-quantity-basis-B3_Heoe6.js";import"./sewing-outsourcing-responsibility-CoALbokX.js";import"./sewing-cut-piece-responsibility-Dadx_FEy.js";import"./craft-image-storage-DabG65wK.js";import"./production-material-prep-DtM2N0bA.js";import"./pcs-tech-pack-review-BNgZQATg.js";import"./pcs-tech-pack-bootstrap-B-0uxCy9.js";import"./pcs-config-workspace-repository-OW3ldWf9.js";import"./pcs-product-archive-fixtures-DVARwvu0.js";import"./pcs-pattern-library-BJCeNw1f.js";import"./pcs-tech-pack-review-notification-repository-DD7aOfHw.js";import"./pcs-tech-pack-version-log-repository-BL_Qirnc.js";import"./los-live-room-master-B5DO8597.js";import"./pcs-engineering-task-upload-repository-CIxOcb4x.js";import"./pcs-engineering-bom-snapshot-source-CVLToAt6.js";import"./pcs-part-template-library-O6xJDNlv.js";import"./marker-plan-projection-D5kef-eP.js";import"./marker-plan-source-model-DsGBdpUM.js";import"./marker-plan-occupancy-B3YDUgFh.js";import"./supplement-order-registry-CHnc7juB.js";import"./index-BVjiAYfU.js";import"./marker-plan-model-B8rS42-Z.js";import"./task-chain-pages-adapter-C9zY6CSO.js";import"./task-execution-adapter-D5HWm-1n.js";import"./store-domain-settlement-seeds-D-ADeQuT.js";import"./quality-deduction-repository-CfpSiOBT.js";import"./settlement-linked-mock-factory-BWdbKsQu.js";import"./process-mobile-task-binding-D7xilrAs.js";import"./runtime-task-tenders-CXysZPgg.js";import"./factory-onboarding-flow-DPXXqO4N.js";import"./factory-capacity-profile-mock-Dv5YtZGT.js";import"./pda-sewing-self-return-mode-CVT5AEl1.js";import"./water-soluble-relation-sources-DveW3F9Q.js";import"./tmf-process-continuation-zBbGFh6j.js";import"./tmf-reference-images-6geKcU1B.js";import"./milestone-configs-CkV-y_yj.js";import"./progress-exception-lifecycle-BJx0gSBY.js";import"./post-finishing-authorization-pB636eep.js";import"./dyeing-material-receipts-Dmvu-FUn.js";import"./preparation-material-receipt-sources-CVhQiEQv.js";import"./process-order-task-links-1RbgOI_k.js";import"./process-order-task-link-core-ThfowmC4.js";import"./lace-factory-domain-3hpLRn04.js";import"./process-warehouse-domain-DldGOCq8.js";import"./dye-work-order-online-domain-j_x6pIQ5.js";import"./dye-work-order-times-w7U4XCtx.js";import"./transfer-bag-operations-CIyS2COv.js";import"./manual-fei-tickets-D65v3iNb.js";let l=new Map;function m({objectType:i,objectId:t,label:o,relatedProductionOrderNo:a}){const r=(o||t||"").trim(),n=(t||"").trim();if(!n||!r)return s(r||"-");l.has(i)||l.set(i,T(i));const p=l.get(i),e=f({objectType:i,objectId:n,relatedProductionOrderNo:a},p),d=e.status==="READY"||!a?e:f({objectType:i,objectId:n},p);return d.status!=="READY"?s(r):S({objectType:d.indexItem.objectType,objectId:d.indexItem.primaryNo,label:r,relatedProductionOrderNo:d.indexItem.relatedProductionOrderNo,defaultTab:d.clickedRef.defaultTab,highlightKey:d.clickedRef.highlightKey,className:"text-left font-mono text-blue-600 hover:underline"})}function pe(i){var o;y(),v(),((o=g())==null?void 0:o.factoryId)!==I&&b();const t=N(i)||R(i);return t?E(i,t):h('<div class="p-4 text-sm text-muted-foreground">任务不存在</div>',"exec",{disableTodoAutoOpen:!0})}function w(i){const t=x(i.postOrderId)||x(i.postOrderNo),o=t?O(t):void 0,a=t?new Set([t.postTaskId]):void 0,r=t?k(void 0,a):[],n=t?F(void 0,a):[];return{task:t,progress:o,rechecks:r,outbounds:n}}function C(i,t){const o=[],{task:a,progress:r,rechecks:n,outbounds:p}=t;return i.receiveAction.finishedAt||o.push('<a class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" href="/fcs/pda/post-finishing/return-confirm">扫描送货单确认实收</a>'),(i.qcStatus==="待质检"||i.qcStatus==="质检中")&&o.push('<a class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-medium" href="/fcs/craft/post-finishing/qc-workbench">前往 Web 执行质检</a>'),a&&o.push(`<a class="inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" href="/fcs/pda/post-finishing/execute?id=${encodeURIComponent(a.postTaskNo)}">${r&&r.availableForRecheckQty>0?`登记加工／交复检（可交 ${r.availableForRecheckQty} 件）`:a.status==="后道完成"?"查看加工及后续记录":"按项登记本次加工数量"}</a>`),a&&n.some(e=>e.status!=="复检完成")&&o.push(`<a class="inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" href="/fcs/pda/post-finishing/recheck?id=${encodeURIComponent(a.postTaskNo)}">选择待处理复检单（${n.filter(e=>e.status!=="复检完成").length} 张）</a>`),(p.some(e=>e.status==="待仓库接收")||!a&&i.handoverStatus==="待交出")&&o.push('<a class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-medium" href="/fcs/pda/handover?tab=handout">前往待交出</a>'),o.length?`<div class="grid gap-2">${o.join("")}</div>`:'<div class="rounded-md border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">当前没有可执行动作；后道实际操作只在专用页面完成。</div>'}function Q(i){const{task:t,rechecks:o,outbounds:a}=i;if(!t)return"";const r=i.progress,n=t.executionModel!=="ITEMS_V1"&&!t.legacyCarryover,p=r.lines.reduce((e,d)=>e+d.historyCompletedQty,0);return`<article class="rounded-lg border bg-card"><header class="border-b px-4 py-3"><h2 class="text-sm font-semibold">分项加工与多次交出</h2></header><div class="space-y-3 p-4">
    <div class="grid grid-cols-2 gap-2">${r.processes.map(e=>`<div class="rounded-md border p-3 text-xs"><div class="font-medium">${s(e.processItem)}</div><div class="mt-2 text-sm">${n?"历史未分项":e.applicable?`${p>0?"新增 ":""}${e.completedQty} / ${e.expectedQty} 件`:"不涉及"}</div></div>`).join("")}</div>
    ${r.legacyPending?'<div class="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">历史加工尚未分项，需核对承接后继续登记。</div>':""}
    ${p>0?`<div class="rounded-md border p-3 text-xs text-muted-foreground">历史合并完成 ${p} 件，历史未分项；分项数量仅表示剩余新加工范围。</div>`:""}
    <div class="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-900">全部后道完成 ${r.totalCompletedQty} 件 · 已交复检占用 ${r.totalReservedQty} 件 · 可交 ${r.availableForRecheckQty} 件</div>
    <details class="rounded-md border p-3"><summary class="min-h-8 cursor-pointer text-xs font-medium">加工责任记录（${r.records.length} 次）</summary><div class="mt-2 space-y-2">${r.records.length?r.records.map(e=>`<div class="rounded-md bg-muted/30 p-2 text-xs"><div>${s(e.processItem)} · ${e.correctionOf?"订正增减":"本次完成"} ${e.quantities.reduce((d,c)=>d+c.quantity,0)} 件 · 责任人 ${s(e.responsible.actorName)}</div><div class="mt-1 text-muted-foreground">录入 ${s(e.recordedBy.actorName)} · ${s(e.recordedAt)}</div>${e.reason?`<div class="mt-1 text-amber-800">订正原因：${s(e.reason)}</div>`:""}</div>`).join(""):'<p class="text-muted-foreground">尚无分项登记。</p>'}</div></details>
    <h3 class="text-xs font-semibold">复检（${o.length} 张）</h3><div class="space-y-2">${o.length?o.map(e=>`<a class="block min-h-12 rounded-md border p-3 text-xs" href="/fcs/pda/post-finishing/recheck?id=${encodeURIComponent(e.recheckOrderNo)}"><div class="break-all font-mono text-blue-700">${s(e.recheckOrderNo)}</div><div class="mt-1">${s(e.status)} · 本次 ${e.lines.reduce((d,c)=>d+c.expectedQty,0)} 件</div></a>`).join(""):'<p class="text-xs text-muted-foreground">尚未交复检。</p>'}</div>
    <h3 class="text-xs font-semibold">出货（${a.length} 张）</h3><div class="space-y-2">${a.length?a.map(e=>`<div class="rounded-md border p-3 text-xs"><div class="break-all font-mono">${s(e.outboundOrderNo)}</div><div class="mt-1">${s(e.status)} · 本次 ${e.lines.reduce((d,c)=>d+c.outboundQty,0)} 件</div></div>`).join(""):'<p class="text-xs text-muted-foreground">尚未生成出货单。</p>'}</div>
  </div></article>`}function q(i){const t=j("POST_FINISHING",i.postOrderId),o=i.sourceTaskId?A(i.sourceTaskId):[];return Array.from(new Map([...t,...o].map(a=>[a.operationRecordId,a])).values()).sort((a,r)=>r.operatedAt.localeCompare(a.operatedAt))}function D(i){const t=q(i);return t.length===0?'<div class="rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">暂无操作记录</div>':`
    <div class="overflow-x-auto">
      <table class="min-w-[720px] text-left text-xs">
        <thead class="bg-muted text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">操作动作</th>
            <th class="px-3 py-2 font-medium">状态变化</th>
            <th class="px-3 py-2 font-medium">操作人</th>
            <th class="px-3 py-2 font-medium">成衣件数</th>
            <th class="px-3 py-2 font-medium">来源</th>
            <th class="px-3 py-2 font-medium">备注</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          ${t.map(o=>`
            <tr data-testid="operation-record-row">
              <td class="px-3 py-2 font-medium">${s(o.actionLabel)}</td>
              <td class="px-3 py-2">${s(o.previousStatus)} -> ${s(o.nextStatus)}</td>
              <td class="px-3 py-2">${s(o.operatorName)}</td>
              <td class="px-3 py-2">${o.objectQty} ${s(o.qtyUnit)}</td>
              <td class="px-3 py-2">${s(o.sourceChannel)}</td>
              <td class="px-3 py-2">${s(o.remark||"—")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `}function E(i,t){l=new Map;const o=w(t),a=[t.receiveAction,t.qcAction,t.postAction].filter(Boolean).map(n=>`
      <tr>
        <td class="px-3 py-2">${s(n.actionType)}</td>
        <td class="px-3 py-2">${s(n.status)}</td>
        <td class="px-3 py-2">${n.acceptedGarmentQty} ${s(n.qtyUnit)}</td>
        <td class="px-3 py-2">${s(n.operatorName||"—")}</td>
      </tr>
    `).join(""),r=`
    <div class="space-y-4 bg-background p-4 pb-6">
      <div class="flex items-center gap-2">
        <button class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-pda-execd-action="back">
          <i data-lucide="arrow-left" class="mr-1 h-4 w-4"></i>
          返回
        </button>
        <h1 class="text-base font-semibold">实际工序执行</h1>
      </div>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-semibold">${m({objectType:"PROCESS_DOC",objectId:t.postOrderNo,relatedProductionOrderNo:t.sourceProductionOrderNo})}</span>
            <span class="inline-flex rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">${s(t.currentStatus)}</span>
          </div>
        </header>
        <div class="grid gap-3 p-4 text-sm">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span class="text-muted-foreground">生产单</span>
            <span class="font-medium">${m({objectType:"PRODUCTION_ORDER",objectId:t.sourceProductionOrderNo})}</span>
            <span class="text-muted-foreground">来源任务</span>
            <span class="font-medium">${m({objectType:"PROCESS_DOC",objectId:t.sourceTaskNo,relatedProductionOrderNo:t.sourceProductionOrderNo})}</span>
            <span class="text-muted-foreground">来源车缝任务</span>
            <span class="font-medium">${m({objectType:"PROCESS_DOC",objectId:t.sourceSewingTaskNo,relatedProductionOrderNo:t.sourceProductionOrderNo})}</span>
            <span class="text-muted-foreground">当前工厂</span>
            <span>${s(u(t.currentFactoryName,t.currentFactoryId))}</span>
            <span class="text-muted-foreground">后道工厂</span>
            <span>${s(u(t.managedPostFactoryName,t.managedPostFactoryId))}</span>
            <span class="text-muted-foreground">后道来源</span>
            <span>${s($(t))}</span>
            <span class="text-muted-foreground">当前流程</span>
            <span>${s(P(t))}</span>
            <span class="text-muted-foreground">计划成衣件数</span>
            <span>${t.plannedGarmentQty} ${s(t.plannedGarmentQtyUnit)}</span>
            <span class="text-muted-foreground">接收成衣件数</span>
            <span>${t.receiveAction.acceptedGarmentQty} ${s(t.receiveAction.qtyUnit)}</span>
            <span class="text-muted-foreground">已完成实际工序成衣件数</span>
            <span>${t.postAction.acceptedGarmentQty} ${s(t.postAction.qtyUnit)}</span>
            <span class="text-muted-foreground">当前状态</span>
            <span>${s(t.currentStatus)}</span>
            <span class="text-muted-foreground">任务模式</span>
            <span>${s(t.routeMode)}</span>
            <span class="text-muted-foreground">是否需要质检</span>
            <span>${t.linkedQcOrderId?"需要":"不需要"}</span>
            <span class="text-muted-foreground">是否需要后道</span>
            <span>${t.requiresPostFinishing?"需要":"不需要后道加工"}</span>
            <span class="text-muted-foreground">是否需要复检</span>
            <span>${t.requiresPostFinishing?"需要，按已完成量交复检":"不需要"}</span>
          </div>
        </div>
      </article>

      ${Q(o)}

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">当前可执行动作</h2>
        </header>
        <div class="space-y-3 p-4">
          ${C(t,o)}
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">收货、质检与后道摘要</h2>
        </header>
        <div class="overflow-x-auto p-4">
          <table class="min-w-[640px] text-left text-xs">
            <thead class="bg-muted text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">动作</th>
                <th class="px-3 py-2 font-medium">状态</th>
                <th class="px-3 py-2 font-medium">确认成衣件数</th>
                <th class="px-3 py-2 font-medium">操作人</th>
              </tr>
            </thead>
            <tbody class="divide-y">${a}</tbody>
          </table>
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">操作记录</h2>
        </header>
        <div class="p-4">
          ${D(t)}
        </div>
      </article>
    </div>
  `;return h(r,"exec",{disableTodoAutoOpen:!0})}export{pe as renderPdaPostFinishingExecDetailPage,E as renderPdaPostFinishingExecutionPage};

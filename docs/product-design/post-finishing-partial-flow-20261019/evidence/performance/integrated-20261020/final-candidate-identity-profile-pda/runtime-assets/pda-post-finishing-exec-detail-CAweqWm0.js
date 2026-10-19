import{r as h}from"./pda-shell-BS6H9et2.js";import{getPdaRuntimeContext as v}from"./pda-runtime-BybyDVvG.js";import{d as $}from"./printing-task-domain-CCbqY4Ab.js";import{s as P}from"./pda-start-link-Bo2kWqm7.js";import{s as O}from"./pda-exec-link-BVsiLcRO.js";import{x as s,aO as x}from"./app-shared-DDMaqtkq.js";import{aE as k,aF as I,W as u,_ as g,ah as b,p as y,F,w as N,aw as T}from"./post-finishing-full-flow-BCq7ip6w.js";import{g as R,a as j}from"./process-action-writeback-service-INMTegMR.js";import{r as A}from"./production-order-identity-Da_cFHB2.js";import{d as C,r as f}from"./production-object-overview-V_TN1QF8.js";import"./pda-cutting-execution-source-thkDYO8l.js";import"./domain-snapshot-BhJ0626s.js";import"./runtime-inputs-Br6XecWN.js";import"./craft-display-support-DHjgvyJJ.js";import"./index-1rjfwAvh.js";import"./runtime-process-tasks-CbqNqZKK.js";import"./factory-receiving-DVz0KTOW.js";import"./design-revision-pcs-storage-BjfzS8H8.js";import"./tmf-domain-shared-DboXqEqI.js";import"./production-orders-D4qs1_dh.js";import"./production-order-runtime-store-DrwUj0s7.js";import"./cut-piece-release-BXagoZ-d.js";import"./effective-task-assignments-Ub04Tv8U.js";import"./pcs-record-core-B0Lbe0dL.js";import"./warehouse-runtime-CP_CCFI7.js";import"./generated-fei-tickets-BtExtdYQ.js";import"./production-tech-pack-change-domain-CPrfigWe.js";import"./pda-handover-events-BtBq6ngh.js";import"./special-craft-task-orders-dQXCZpfp.js";import"./store-domain-progress-2mKXxnWT.js";import"./ppic-return-quantity-basis-DK2Xm8Xg.js";import"./sewing-outsourcing-responsibility-BTZqOvJ8.js";import"./sewing-cut-piece-responsibility-DL0brL6O.js";import"./craft-image-storage-DnSN26Lx.js";import"./production-material-prep-uC1c-qw8.js";import"./pcs-tech-pack-review-CewVNa2t.js";import"./pcs-tech-pack-bootstrap-BtZ3N836.js";import"./pcs-config-workspace-repository-D4HgjaMQ.js";import"./pcs-product-archive-fixtures-DWRKOgf4.js";import"./pcs-pattern-library-DwkCsDJw.js";import"./pcs-tech-pack-review-notification-repository-BX86eUae.js";import"./pcs-tech-pack-version-log-repository-w1UO1MD_.js";import"./los-live-room-master-zD8LNj76.js";import"./pcs-engineering-task-upload-repository-WAQEHa3u.js";import"./pcs-engineering-bom-snapshot-source-CVLToAt6.js";import"./pcs-part-template-library-O6xJDNlv.js";import"./marker-plan-projection-DITshrBO.js";import"./marker-plan-source-model-DA1npaq7.js";import"./marker-plan-occupancy-BZEBqHD1.js";import"./supplement-order-registry-CHnc7juB.js";import"./index-BckQB7YT.js";import"./marker-plan-model-C68FqKzx.js";import"./task-chain-pages-adapter-BS-7s4ze.js";import"./task-execution-adapter-D9-sVnf8.js";import"./store-domain-settlement-seeds-CmTdnMcs.js";import"./quality-deduction-repository-y6JEfMcd.js";import"./settlement-linked-mock-factory-CoWqJ32R.js";import"./process-mobile-task-binding-Ci1V3zg-.js";import"./runtime-task-tenders-DyRfy5tl.js";import"./factory-onboarding-flow-DAr4niQP.js";import"./factory-capacity-profile-mock-Dv5YtZGT.js";import"./pda-sewing-self-return-mode-CVT5AEl1.js";import"./water-soluble-relation-sources-D9gS9FOD.js";import"./tmf-process-continuation-zBbGFh6j.js";import"./tmf-reference-images-6geKcU1B.js";import"./milestone-configs-D6fwXmWY.js";import"./progress-exception-lifecycle-BJx0gSBY.js";import"./post-finishing-authorization-Bru2PHx6.js";import"./dyeing-material-receipts-BtgllOnV.js";import"./preparation-material-receipt-sources-BRn2u3Iy.js";import"./process-order-task-links-CNI-O6VH.js";import"./process-order-task-link-core-B-LgWb0H.js";import"./lace-factory-domain-3hpLRn04.js";import"./process-warehouse-domain-CiJDzcm-.js";import"./dye-work-order-online-domain-DpJU-Z05.js";import"./dye-work-order-times-w7U4XCtx.js";import"./transfer-bag-operations-uy5n0j-A.js";import"./manual-fei-tickets-BfSmF_X9.js";let l=new Map;function m({objectType:a,objectId:t,label:e,relatedProductionOrderNo:n}){const r=(e||t||"").trim(),p=(t||"").trim();if(!p||!r)return s(r||"-");l.has(a)||l.set(a,C(a));const i=l.get(a),o=f({objectType:a,objectId:p,relatedProductionOrderNo:n},i),d=o.status==="READY"||!n?o:f({objectType:a,objectId:p},i);return d.status!=="READY"?s(r):A({objectType:d.indexItem.objectType,objectId:d.indexItem.primaryNo,label:r,relatedProductionOrderNo:d.indexItem.relatedProductionOrderNo,defaultTab:d.clickedRef.defaultTab,highlightKey:d.clickedRef.highlightKey,className:"text-left font-mono text-blue-600 hover:underline"})}function de(a){var e;P(),O(),((e=v())==null?void 0:e.factoryId)!==F&&$();const t=N(a)||T(a);return t?E(a,t):h('<div class="p-4 text-sm text-muted-foreground">任务不存在</div>',"exec",{disableTodoAutoOpen:!0})}function S(a){const t=[],e=u(a.postOrderId)||u(a.postOrderNo),n=e?g(e):void 0,r=e?b().filter(i=>i.postTaskId===e.postTaskId):[],p=e?y().filter(i=>i.postTaskId===e.postTaskId):[];return a.receiveAction.finishedAt||t.push('<a class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" href="/fcs/pda/post-finishing/return-confirm">扫描送货单确认实收</a>'),(a.qcStatus==="待质检"||a.qcStatus==="质检中")&&t.push('<a class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-medium" href="/fcs/craft/post-finishing/qc-workbench">前往 Web 执行质检</a>'),e&&t.push(`<a class="inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" href="/fcs/pda/post-finishing/execute?id=${encodeURIComponent(e.postTaskNo)}">${n&&n.availableForRecheckQty>0?`登记加工／交复检（可交 ${n.availableForRecheckQty} 件）`:e.status==="后道完成"?"查看加工及后续记录":"按项登记本次加工数量"}</a>`),e&&r.some(i=>i.status!=="复检完成")&&t.push(`<a class="inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" href="/fcs/pda/post-finishing/recheck?id=${encodeURIComponent(e.postTaskNo)}">选择待处理复检单（${r.filter(i=>i.status!=="复检完成").length} 张）</a>`),(p.some(i=>i.status==="待仓库接收")||!e&&a.handoverStatus==="待交出")&&t.push('<a class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-medium" href="/fcs/pda/handover?tab=handout">前往待交出</a>'),t.length?`<div class="grid gap-2">${t.join("")}</div>`:'<div class="rounded-md border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">当前没有可执行动作；后道实际操作只在专用页面完成。</div>'}function w(a){const t=u(a.postOrderId)||u(a.postOrderNo);if(!t)return"";const e=g(t),n=t.executionModel!=="ITEMS_V1"&&!t.legacyCarryover,r=e.lines.reduce((o,d)=>o+d.historyCompletedQty,0),p=b().filter(o=>o.postTaskId===t.postTaskId),i=y().filter(o=>o.postTaskId===t.postTaskId);return`<article class="rounded-lg border bg-card"><header class="border-b px-4 py-3"><h2 class="text-sm font-semibold">分项加工与多次交出</h2></header><div class="space-y-3 p-4">
    <div class="grid grid-cols-2 gap-2">${e.processes.map(o=>`<div class="rounded-md border p-3 text-xs"><div class="font-medium">${s(o.processItem)}</div><div class="mt-2 text-sm">${n?"历史未分项":o.applicable?`${r>0?"新增 ":""}${o.completedQty} / ${o.expectedQty} 件`:"不涉及"}</div></div>`).join("")}</div>
    ${e.legacyPending?'<div class="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">历史加工尚未分项，需核对承接后继续登记。</div>':""}
    ${r>0?`<div class="rounded-md border p-3 text-xs text-muted-foreground">历史合并完成 ${r} 件，历史未分项；分项数量仅表示剩余新加工范围。</div>`:""}
    <div class="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-900">全部后道完成 ${e.totalCompletedQty} 件 · 已交复检占用 ${e.totalReservedQty} 件 · 可交 ${e.availableForRecheckQty} 件</div>
    <details class="rounded-md border p-3"><summary class="min-h-8 cursor-pointer text-xs font-medium">加工责任记录（${e.records.length} 次）</summary><div class="mt-2 space-y-2">${e.records.length?e.records.map(o=>`<div class="rounded-md bg-muted/30 p-2 text-xs"><div>${s(o.processItem)} · ${o.correctionOf?"订正增减":"本次完成"} ${o.quantities.reduce((d,c)=>d+c.quantity,0)} 件 · 责任人 ${s(o.responsible.actorName)}</div><div class="mt-1 text-muted-foreground">录入 ${s(o.recordedBy.actorName)} · ${s(o.recordedAt)}</div>${o.reason?`<div class="mt-1 text-amber-800">订正原因：${s(o.reason)}</div>`:""}</div>`).join(""):'<p class="text-muted-foreground">尚无分项登记。</p>'}</div></details>
    <h3 class="text-xs font-semibold">复检（${p.length} 张）</h3><div class="space-y-2">${p.length?p.map(o=>`<a class="block min-h-12 rounded-md border p-3 text-xs" href="/fcs/pda/post-finishing/recheck?id=${encodeURIComponent(o.recheckOrderNo)}"><div class="break-all font-mono text-blue-700">${s(o.recheckOrderNo)}</div><div class="mt-1">${s(o.status)} · 本次 ${o.lines.reduce((d,c)=>d+c.expectedQty,0)} 件</div></a>`).join(""):'<p class="text-xs text-muted-foreground">尚未交复检。</p>'}</div>
    <h3 class="text-xs font-semibold">出货（${i.length} 张）</h3><div class="space-y-2">${i.length?i.map(o=>`<div class="rounded-md border p-3 text-xs"><div class="break-all font-mono">${s(o.outboundOrderNo)}</div><div class="mt-1">${s(o.status)} · 本次 ${o.lines.reduce((d,c)=>d+c.outboundQty,0)} 件</div></div>`).join(""):'<p class="text-xs text-muted-foreground">尚未生成出货单。</p>'}</div>
  </div></article>`}function Q(a){const t=R("POST_FINISHING",a.postOrderId),e=a.sourceTaskId?j(a.sourceTaskId):[];return Array.from(new Map([...t,...e].map(n=>[n.operationRecordId,n])).values()).sort((n,r)=>r.operatedAt.localeCompare(n.operatedAt))}function q(a){const t=Q(a);return t.length===0?'<div class="rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">暂无操作记录</div>':`
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
          ${t.map(e=>`
            <tr data-testid="operation-record-row">
              <td class="px-3 py-2 font-medium">${s(e.actionLabel)}</td>
              <td class="px-3 py-2">${s(e.previousStatus)} -> ${s(e.nextStatus)}</td>
              <td class="px-3 py-2">${s(e.operatorName)}</td>
              <td class="px-3 py-2">${e.objectQty} ${s(e.qtyUnit)}</td>
              <td class="px-3 py-2">${s(e.sourceChannel)}</td>
              <td class="px-3 py-2">${s(e.remark||"—")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `}function E(a,t){l=new Map;const e=[t.receiveAction,t.qcAction,t.postAction].filter(Boolean).map(r=>`
      <tr>
        <td class="px-3 py-2">${s(r.actionType)}</td>
        <td class="px-3 py-2">${s(r.status)}</td>
        <td class="px-3 py-2">${r.acceptedGarmentQty} ${s(r.qtyUnit)}</td>
        <td class="px-3 py-2">${s(r.operatorName||"—")}</td>
      </tr>
    `).join(""),n=`
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
            <span>${s(x(t.currentFactoryName,t.currentFactoryId))}</span>
            <span class="text-muted-foreground">后道工厂</span>
            <span>${s(x(t.managedPostFactoryName,t.managedPostFactoryId))}</span>
            <span class="text-muted-foreground">后道来源</span>
            <span>${s(k(t))}</span>
            <span class="text-muted-foreground">当前流程</span>
            <span>${s(I(t))}</span>
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

      ${w(t)}

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">当前可执行动作</h2>
        </header>
        <div class="space-y-3 p-4">
          ${S(t)}
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
            <tbody class="divide-y">${e}</tbody>
          </table>
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">操作记录</h2>
        </header>
        <div class="p-4">
          ${q(t)}
        </div>
      </article>
    </div>
  `;return h(n,"exec",{disableTodoAutoOpen:!0})}export{de as renderPdaPostFinishingExecDetailPage,E as renderPdaPostFinishingExecutionPage};

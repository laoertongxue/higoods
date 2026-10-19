import{M as G,h as W,f as le,x as s,aE as A,ah as _}from"./app-shared-DDMaqtkq.js";import{r as Y}from"./pda-shell-BS6H9et2.js";import{f as F,x as ce}from"./post-finishing-full-flow-BCq7ip6w.js";import{e as me}from"./kol-goto-pda-domain-BSFoo_eI.js";import{a as pe}from"./store-domain-quality-bootstrap-ah1q7S0H.js";import{j as C,k as B,m as fe,g as xe,n as be,o as L,p as J,q as ye}from"./quality-deduction-repository-y6JEfMcd.js";import{z as ge,A as $e,B as j,C as X,D as ve,d as I,g as Re,j as Ne,k as Q,l as H}from"./store-domain-settlement-seeds-CmTdnMcs.js";import{a as Z}from"./pre-settlement-ledger-repository-C822S3vY.js";import{c as Ae,p as Se}from"./settlement-linked-mock-factory-CoWqJ32R.js";import{J as Ie,al as he}from"./craft-display-support-DHjgvyJJ.js";import{ensurePdaSessionForAction as ke,getPdaRuntimeContext as V,renderPdaLoginRedirect as qe}from"./pda-runtime-BybyDVvG.js";import{l as Ee,g as Te}from"./fact-view-D9yNh_GP.js";import"./tmf-domain-shared-DboXqEqI.js";import"./pda-cutting-execution-source-thkDYO8l.js";import"./domain-snapshot-BhJ0626s.js";import"./runtime-inputs-Br6XecWN.js";import"./runtime-process-tasks-CbqNqZKK.js";import"./factory-receiving-DVz0KTOW.js";import"./design-revision-pcs-storage-BjfzS8H8.js";import"./production-orders-D4qs1_dh.js";import"./production-order-runtime-store-DrwUj0s7.js";import"./cut-piece-release-BXagoZ-d.js";import"./index-1rjfwAvh.js";import"./effective-task-assignments-Ub04Tv8U.js";import"./pcs-record-core-B0Lbe0dL.js";import"./warehouse-runtime-CP_CCFI7.js";import"./generated-fei-tickets-BtExtdYQ.js";import"./production-tech-pack-change-domain-CPrfigWe.js";import"./pda-handover-events-BtBq6ngh.js";import"./special-craft-task-orders-dQXCZpfp.js";import"./store-domain-progress-2mKXxnWT.js";import"./ppic-return-quantity-basis-DK2Xm8Xg.js";import"./sewing-outsourcing-responsibility-BTZqOvJ8.js";import"./sewing-cut-piece-responsibility-DL0brL6O.js";import"./craft-image-storage-DnSN26Lx.js";import"./production-material-prep-uC1c-qw8.js";import"./printing-task-domain-CCbqY4Ab.js";import"./water-soluble-relation-sources-D9gS9FOD.js";import"./factory-capacity-profile-mock-Dv5YtZGT.js";import"./tmf-process-continuation-zBbGFh6j.js";import"./tmf-reference-images-6geKcU1B.js";import"./pcs-engineering-task-upload-repository-WAQEHa3u.js";import"./pcs-tech-pack-review-CewVNa2t.js";import"./pcs-tech-pack-bootstrap-BtZ3N836.js";import"./pcs-config-workspace-repository-D4HgjaMQ.js";import"./pcs-product-archive-fixtures-DWRKOgf4.js";import"./pcs-pattern-library-DwkCsDJw.js";import"./pcs-tech-pack-review-notification-repository-BX86eUae.js";import"./pcs-tech-pack-version-log-repository-w1UO1MD_.js";import"./los-live-room-master-zD8LNj76.js";import"./pcs-engineering-bom-snapshot-source-CVLToAt6.js";import"./pcs-part-template-library-O6xJDNlv.js";import"./marker-plan-projection-DITshrBO.js";import"./marker-plan-source-model-DA1npaq7.js";import"./marker-plan-occupancy-BZEBqHD1.js";import"./supplement-order-registry-CHnc7juB.js";import"./index-BckQB7YT.js";import"./marker-plan-model-C68FqKzx.js";import"./task-chain-pages-adapter-BS-7s4ze.js";import"./task-execution-adapter-D9-sVnf8.js";import"./process-mobile-task-binding-Ci1V3zg-.js";import"./runtime-task-tenders-DyRfy5tl.js";import"./factory-onboarding-flow-DAr4niQP.js";import"./pda-sewing-self-return-mode-CVT5AEl1.js";import"./post-finishing-authorization-Bru2PHx6.js";import"./kol-goto-fixed-total-ledger-Da4pTE6P.js";import"./process-work-order-quality-settlement-1Lb8zqKV.js";import"./process-warehouse-domain-CiJDzcm-.js";import"./quality-deduction-selectors-Bnb2OJ6X.js";pe();const n={lastRouteSyncKey:"",pageMode:"home",statementFilterView:"all",qualityRecordFilterView:"all",qualitySearch:"",qualityDrawerId:null,settlementRequestDrawerMode:null,settlementRequestDetailId:null,settlementRequestErrors:{},settlementRequestErrorText:"",settlementRequestForm:{accountHolderName:"",idNumber:"",bankName:"",bankAccountNo:"",bankBranch:"",submitRemark:""},statementDrawerMode:null,statementDetailId:null,statementErrorText:"",statementAppealForm:{reason:"",description:"",evidenceSummary:""}};function y(e){const t=V();if(!t)return!1;const r=Ie(),a=(r==null?void 0:r.roleId)||t.roleId;if(F(t.factoryId)&&a!=="ROLE_ADMIN")return!1;const u=he(t.factoryId).find(l=>l.roleId===a&&l.status==="ACTIVE");return!!(u!=null&&u.permissionKeys.includes(e))}function Fe(){return`
    <div class="space-y-3 p-4">
      <section class="rounded-lg border bg-card px-4 py-5">
        <h1 class="text-base font-semibold">结算</h1>
        <p class="mt-2 text-xs leading-5 text-muted-foreground">当前账号没有结算查看权限，请联系工厂管理员调整 PDA 角色权限。</p>
      </section>
    </div>
  `}function K(e){if(!e)return 0;const t=e.includes("T")?e:e.replace(" ","T"),r=new Date(t).getTime();return Number.isFinite(r)?r:0}function g(){const e=V(),t=(e==null?void 0:e.factoryId)||"",r=ce(t),a=W.find(d=>d.id===t||d.code===t),u=le(r??t),l=(e==null?void 0:e.userName)||"工厂处理人";return{factoryId:r??(a==null?void 0:a.id)??(u==null?void 0:u.id)??t,factoryCode:(a==null?void 0:a.code)??(u==null?void 0:u.code)??t,factoryName:((a==null?void 0:a.name)??(u==null?void 0:u.name)??t)||"未知工厂",settlementPartyId:r??(a==null?void 0:a.id)??(u==null?void 0:u.id)??t,operatorName:l}}function T(e){return xe(e)}function Ce(e){const t=new Map,r=a=>{const u=a.settlementCycleId||a.settlementCycleLabel||"未分组",l=t.get(u);if(l)return l;const d={settlementCycleId:a.settlementCycleId||u,settlementCycleLabel:a.settlementCycleLabel||"未分组",settlementCycleStartAt:a.settlementCycleStartAt,settlementCycleEndAt:a.settlementCycleEndAt,ledgers:[],statements:[],taskEarningAmount:0,qualityDeductionAmount:0};return t.set(u,d),d};for(const a of Z({factoryId:e.settlementPartyId})){const u=r(a);u.ledgers.push(a),a.direction==="DEDUCTION"||a.ledgerType==="QUALITY_DEDUCTION"?u.qualityDeductionAmount+=Math.abs(a.settlementAmount):u.taskEarningAmount+=a.settlementAmount}for(const a of X(e.settlementPartyId))r(a).statements.push(a);return[...t.values()].sort((a,u)=>(u.settlementCycleEndAt||"").localeCompare(a.settlementCycleEndAt||""))}function S(e){const t=e.prepaymentBatchId?j(e.prepaymentBatchId):U(e.statementId);return!!(e.prepaidAt||e.paymentWritebackId||e.status==="PREPAID"||z(e.prepaymentBatchStatus)||t!=null&&t.prepaidAt||t!=null&&t.paymentWritebackId||z(t==null?void 0:t.status))}function z(e){return e==="PREPAID"||e==="FEISHU_PAID_PENDING_WRITEBACK"}function ee(e){return S(e)?"已付款":"未付款"}function D(e){return e.netPayableAmount??e.totalAmount??0}function te(e,t){return e.prepaidAt??(t==null?void 0:t.paymentAt)??(t==null?void 0:t.prepaidAt)}function re(e){return e==="PRODUCTION_ORDER"?"按生产单":"按结算明细"}function ne(e){return(e??"").trim().toLowerCase().replace(/\s+/g," ")}function q(e,t){const r=ne(t);r&&e.add(r)}function De(e){const t=new Set;[e.factoryName,e.factoryCode].forEach(l=>q(t,l));const r=W.find(l=>l.id===e.factoryId||l.code===e.factoryCode);[r==null?void 0:r.name,r==null?void 0:r.code].forEach(l=>q(t,l));const a=Z({factoryId:e.settlementPartyId}),u=X(e.settlementPartyId);return a.forEach(l=>q(t,l.factoryName)),u.forEach(l=>{q(t,l.factoryName),q(t,l.settlementProfileSnapshot.sourceFactoryName)}),t}function se(e){const t=De(e);return Ee({includeLegacy:!1}).filter(r=>t.has(ne(r.sourceFactoryName)))}function ae(e){const t=Ce(e),r=t.flatMap(i=>i.statements.filter(we).map(c=>({statement:c,summary:i}))),a=new Set(r.map(({statement:i})=>i.statementId)),l=t.flatMap(i=>i.ledgers).filter(i=>!i.statementId||!a.has(i.statementId)),d=se(e);return{accumulatedIncome:r.reduce((i,c)=>i+(c.statement.totalEarningAmount??c.summary.taskEarningAmount),0),accumulatedDeduction:r.reduce((i,c)=>i+(c.statement.totalDeductionAmount??c.summary.qualityDeductionAmount),0),paidAmount:r.filter(i=>S(i.statement)).reduce((i,c)=>i+D(c.statement),0),unpaidAmount:r.filter(i=>!S(i.statement)).reduce((i,c)=>i+D(c.statement),0),unsettledReferenceAmount:l.reduce((i,c)=>i+(c.direction==="DEDUCTION"?-c.settlementAmount:c.settlementAmount),0),openLedgers:l,statements:r,qcRows:d}}function we(e){return e.status!=="DRAFT"&&e.factoryFeedbackStatus!=="NOT_SENT"}function f(e,t="IDR"){return`${e.toLocaleString("zh-CN")} ${t}`}function o(e,t,r={}){return`
    <div class="flex items-center justify-between gap-3 py-0.5">
      <span class="text-xs text-muted-foreground">${s(e)}</span>
      <span class="${_("text-xs text-right tabular-nums",r.bold?"font-semibold text-foreground":"text-foreground",r.red?"text-red-600":"",r.green?"text-emerald-700":"",r.orange?"text-amber-700":"")}">${s(t)}</span>
    </div>
  `}function Pe(e,t,r=""){return`
    <section class="${_("rounded-lg border bg-card shadow-none",r)}">
      <header class="border-b px-4 py-3">
        <h3 class="text-sm font-semibold text-foreground">${s(e)}</h3>
      </header>
      <div class="space-y-2 px-4 py-3">${t}</div>
    </section>
  `}function R(e,t,r){return`
    <div class="fixed inset-0 z-50 flex flex-col bg-background">
      <div class="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <button class="rounded p-1 hover:bg-muted" data-pda-sett-action="${r}">
          <i data-lucide="x" class="h-5 w-5"></i>
        </button>
        <h2 class="flex-1 truncate text-sm font-semibold">${s(e)}</h2>
      </div>
      <div class="flex-1 space-y-4 overflow-y-auto p-4">${t}</div>
    </div>
  `}function w(e){const t=e.replace(/\s+/g,"");return t.length<=8?t:`${t.slice(0,4)} **** **** ${t.slice(-4)}`}function M(e){return e==="DRAFT"?"草稿中":e==="PENDING_FACTORY_CONFIRM"?"待工厂确认":e==="FACTORY_CONFIRMED"?"工厂已确认":e==="READY_FOR_PREPAYMENT"?"待付款":e==="IN_PREPAYMENT_BATCH"?"付款处理中":e==="PREPAID"?"已付款":"已关闭"}function E(e){return e==="NOT_SENT"?"未下发":e==="PENDING_FACTORY_CONFIRM"?"待工厂反馈":e==="FACTORY_CONFIRMED"?"工厂已确认":e==="FACTORY_APPEALED"?"工厂已申诉":e==="PLATFORM_HANDLING"?"平台处理中":"已处理完成"}function Le(e,t){return e.slice().sort((r,a)=>K(t(a))-K(t(r)))}function oe(){return"/fcs/pda/settlement"}function b(e="all"){const t=new URLSearchParams;return t.set("tab","statements"),e!=="all"&&t.set("view",e),`/fcs/pda/settlement?${t.toString()}`}function h(e="all"){const t=new URLSearchParams;return t.set("tab","quality"),e!=="all"&&t.set("view",e),`/fcs/pda/settlement?${t.toString()}`}function Me(){const e=typeof window>"u"?"":window.location.search;if(n.lastRouteSyncKey===e)return;n.lastRouteSyncKey=e;const t=new URLSearchParams(e),r=t.get("tab"),a=t.get("view");if(r==="statements"){n.pageMode="statement-list",n.statementFilterView=Oe(a)?a:"all";return}if(r==="quality"){n.pageMode="quality-list",n.qualityRecordFilterView=_e(a)?a:"all";return}n.pageMode="home",n.statementFilterView="all",n.qualityRecordFilterView="all"}function Oe(e){return e==="all"||e==="pending-confirm"||e==="disputing"||e==="unpaid"||e==="paid"}function _e(e){return e==="all"||e==="not-in-statement"||e==="in-statement"||e==="rework"||e==="deducted"}function Be(e){return e==="pending-confirm"?"待确认对账单":e==="disputing"?"异议中对账单":e==="unpaid"?"未付款对账单":e==="paid"?"已付款对账单":"全部对账单"}function je(e){return e==="not-in-statement"?"未进对账":e==="in-statement"?"已进对账":e==="rework"?"有返工":e==="deducted"?"有扣款":"全部质检记录"}function Qe(e,t){return t==="pending-confirm"?e.filter(({statement:r})=>r.factoryFeedbackStatus==="PENDING_FACTORY_CONFIRM"):t==="disputing"?e.filter(({statement:r})=>r.factoryFeedbackStatus==="FACTORY_APPEALED"):t==="paid"?e.filter(({statement:r})=>S(r)):t==="unpaid"?e.filter(({statement:r})=>!S(r)):e}function He(e,t){return t==="not-in-statement"?e.filter(r=>r.settlementTrace.statusLabel!=="已进入对账"):t==="in-statement"?e.filter(r=>r.settlementTrace.statusLabel==="已进入对账"):t==="rework"?e.filter(r=>r.reworkQty>0):t==="deducted"?e.filter(r=>r.reworkChargebackAmountText!=="—"):e}function Ve(e,t){const r=t.trim().toLowerCase();return r?[e.displayNo,e.productionOrderNo,e.skuSummary,e.sourceFactoryName,e.reworkReceivers,e.settlementTrace.statementNo].some(a=>String(a??"").toLowerCase().includes(r)):!0}function P(){n.statementAppealForm={reason:"",description:"",evidenceSummary:""}}function Ue(){const e=g(),t=T(e.factoryCode);t&&(n.settlementRequestForm={accountHolderName:t.accountHolderName,idNumber:t.idNumber,bankName:t.bankName,bankAccountNo:t.bankAccountNo,bankBranch:t.bankBranch,submitRemark:""},n.settlementRequestErrors={},n.settlementRequestErrorText="")}function Ge(){const e={};return n.settlementRequestForm.accountHolderName.trim()||(e.accountHolderName="请填写开户名"),n.settlementRequestForm.idNumber.trim()||(e.idNumber="请填写证件号"),n.settlementRequestForm.bankName.trim()||(e.bankName="请填写银行名称"),n.settlementRequestForm.bankAccountNo.trim()?/^[0-9]{8,30}$/.test(n.settlementRequestForm.bankAccountNo.trim())||(e.bankAccountNo="银行账号需为 8 到 30 位数字"):e.bankAccountNo="请填写银行账号",e}function de(e){return ye(e)}function Ye(e){return n.settlementRequestDetailId?de(e).find(t=>t.requestId===n.settlementRequestDetailId)??null:C(e)??B(e)}function O(e){const t=[];return e.before.accountHolderName!==e.after.accountHolderName&&t.push("开户名"),e.before.idNumber!==e.after.idNumber&&t.push("证件号"),e.before.bankName!==e.after.bankName&&t.push("银行名称"),e.before.bankAccountNo!==e.after.bankAccountNo&&t.push("银行账号"),e.before.bankBranch!==e.after.bankBranch&&t.push("开户支行"),t.length>0?t.join("、"):"资料核对"}function Ke(e){return e.status==="PENDING_REVIEW"?"平台正在审核申请，待线下签字资料齐备后继续处理。":e.status==="APPROVED"?"申请已通过，新版本用于后续新单据，已生成单据继续沿用原快照。":e.rejectReason||"申请未通过，可根据平台意见重新发起。"}function ze(e){return e.length===0?'<div class="rounded-md border border-dashed bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">暂无结算资料申请记录</div>':`
    <div class="space-y-2">
      ${e.map(t=>`
            <button
              class="w-full rounded-md border bg-background px-3 py-3 text-left hover:bg-muted/30"
              data-pda-sett-action="open-settlement-request-detail"
              data-request-id="${s(t.requestId)}"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold">${s(t.requestId)}</span>
                    <span class="inline-flex rounded border px-2 py-0.5 text-[10px] ${J(t.status)}">${s(L(t.status))}</span>
                  </div>
                  <p class="mt-1 text-[10px] text-muted-foreground">提交时间：${s(t.submittedAt)} · 提交人：${s(t.submittedBy)}</p>
                  <p class="mt-1 text-[10px] text-muted-foreground">版本：${s(`${t.currentVersionNo} -> ${t.targetVersionNo}`)}</p>
                  <p class="mt-1 text-[10px] text-muted-foreground">变更字段：${s(O(t))}</p>
                </div>
                <i data-lucide="chevron-right" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"></i>
              </div>
            </button>
          `).join("")}
    </div>
  `}function We(e){return e.length===0?'<div class="rounded-md border border-dashed bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">暂无版本沿革</div>':`
    <div class="space-y-2">
      ${e.slice().sort((r,a)=>a.effectiveAt.localeCompare(r.effectiveAt)).map(r=>`
            <div class="rounded-md border bg-background px-3 py-3">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold">${s(r.versionNo)}</span>
                    <span class="inline-flex rounded border px-2 py-0.5 text-[10px] ${r.status==="EFFECTIVE"?"border-emerald-200 bg-emerald-50 text-emerald-700":"border-zinc-200 bg-zinc-100 text-zinc-700"}">${s(r.status==="EFFECTIVE"?"生效中":"已失效")}</span>
                  </div>
                  <p class="mt-1 text-[10px] text-muted-foreground">生效时间：${s(r.effectiveAt)} · 生效人：${s(r.effectiveBy)}</p>
                  <p class="mt-1 text-[10px] text-muted-foreground">收款账户：${s(r.bankName)} · 尾号 ${s(r.bankAccountNo.slice(-4))}</p>
                </div>
              </div>
            </div>
          `).join("")}
    </div>
  `}function Je(){const e=n.settlementRequestDrawerMode;if(!e)return"";const t=g(),r=T(t.factoryCode),a=de(t.factoryCode),u=be(t.factoryCode),l=C(t.factoryCode),d=B(t.factoryCode),i=Ye(t.factoryCode),c=l??d,$=y("SETTLEMENT_CHANGE_REQUEST");return e==="profile"?r?R("结算资料",`
        <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] leading-5 text-blue-700">
          工厂端只查看当前生效资料并发起变更申请。申请提交后不会立即改写当前生效资料；新版本只影响后续新单据，已生成单据继续沿用原快照。
        </div>
        <div class="rounded-md border bg-muted/20 px-3 py-3">
          ${o("当前生效版本",r.versionNo,{bold:!0})}
          ${o("最近生效时间",A(r.effectiveAt))}
          ${o("结算币种",r.settlementConfigSnapshot.currency)}
          ${o("收款银行",`${r.bankName} · 尾号 ${r.bankAccountNo.slice(-4)}`)}
        </div>
        <div class="rounded-md border p-3">
          <p class="mb-2 text-xs font-medium">当前生效资料</p>
          <div class="grid gap-2">
            <div class="space-y-1 rounded-md bg-muted/20 p-2">
              <p class="text-[10px] text-muted-foreground">收款账户</p>
              <p class="text-xs">开户名：${s(r.accountHolderName)}</p>
              <p class="text-xs">证件号：${s(r.idNumber)}</p>
              <p class="text-xs">银行：${s(r.bankName)}</p>
              <p class="text-xs">账号：${s(w(r.bankAccountNo))}</p>
              <p class="text-xs">支行：${s(r.bankBranch||"—")}</p>
            </div>
            <div class="space-y-1 rounded-md bg-muted/20 p-2">
              <p class="text-[10px] text-muted-foreground">结算配置快照</p>
              <p class="text-xs">周期类型：${s(Ae[r.settlementConfigSnapshot.cycleType].label)}</p>
              <p class="text-xs">结算规则：${s(r.settlementConfigSnapshot.settlementDayRule)}</p>
              <p class="text-xs">计价方式：${s(Se[r.settlementConfigSnapshot.pricingMode].label)}</p>
              <p class="text-xs">结算币种：${s(r.settlementConfigSnapshot.currency)}</p>
            </div>
          </div>
        </div>
        <div class="rounded-md border p-3">
          <div class="mb-2 flex items-center justify-between">
            <p class="text-xs font-medium">默认扣款规则概况</p>
            <button
              class="rounded-md border px-2.5 py-1 text-[10px] hover:bg-muted"
              data-pda-sett-action="open-settlement-version-history"
            >
              查看版本沿革
            </button>
          </div>
          <div class="space-y-1.5">
            ${r.defaultDeductionRulesSnapshot.map(x=>`
                  <div class="rounded-md bg-muted/20 px-2.5 py-2 text-[10px] text-muted-foreground">
                    <span class="font-medium text-foreground">${s(x.ruleType)}</span>
                    · ${s(x.ruleMode)} · ${s(String(x.ruleValue))}
                    <span class="ml-2">${s(x.effectiveFrom)} 起</span>
                  </div>
                `).join("")}
          </div>
        </div>
        ${c?`
              <div class="rounded-md border bg-muted/20 px-3 py-3">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-xs font-medium">${s(l?"当前申请":"最近申请")}</p>
                    <p class="mt-1 text-[10px] text-muted-foreground">${s(c.requestId)} · ${s(L(c.status))}</p>
                    <p class="mt-1 text-[10px] text-muted-foreground">变更字段：${s(O(c))}</p>
                  </div>
                  <button
                    class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
                    data-pda-sett-action="open-settlement-request-detail"
                    data-request-id="${s(c.requestId)}"
                  >
                    查看申请
                  </button>
                </div>
              </div>
            `:'<div class="rounded-md border border-dashed bg-muted/20 px-3 py-3 text-xs text-muted-foreground">当前暂无结算资料申请记录，可直接发起变更申请。</div>'}
        <div class="grid grid-cols-2 gap-2">
          <button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-pda-sett-action="open-settlement-request-history">
            历史申请（${a.length}）
          </button>
          <button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-pda-sett-action="open-settlement-version-history">
            版本沿革（${u.length}）
          </button>
        </div>
        <button
          class="inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          data-pda-sett-action="${l?"open-settlement-request-detail":"open-settlement-change-request"}"
          ${l?`data-request-id="${s(l.requestId)}"`:""}
          ${l||$?"":"disabled"}
        >
          ${l?"查看当前申请":"申请修改结算资料"}
        </button>
      `,"close-settlement-request-drawer"):"":e==="history"?R("历史申请",`
        <div class="rounded-md border bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground">
          这里仅查看历史申请记录。当前生效资料仍以平台审核通过后的版本为准。
        </div>
        ${ze(a)}
        <button class="inline-flex w-full items-center justify-center rounded-md border px-3 py-2 text-xs hover:bg-muted" data-pda-sett-action="back-to-settlement-profile">
          返回结算资料
        </button>
      `,"close-settlement-request-drawer"):e==="versions"?R("版本沿革",`
        ${We(u)}
        <button class="inline-flex w-full items-center justify-center rounded-md border px-3 py-2 text-xs hover:bg-muted" data-pda-sett-action="back-to-settlement-profile">
          返回结算资料
        </button>
      `,"close-settlement-request-drawer"):e==="create"?R("申请修改结算资料",`
        <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          提交后进入待处理，不会立即改写当前生效资料；已生成单据继续沿用原快照。
        </div>
        ${n.settlementRequestErrorText?`<div class="rounded-md border ${Object.keys(n.settlementRequestErrors).length>0?"border-red-200 bg-red-50 text-red-700":"border-blue-200 bg-blue-50 text-blue-700"} px-3 py-2 text-xs">${s(n.settlementRequestErrorText)}</div>`:""}
        <div class="space-y-3">
          <label class="block space-y-1">
            <span class="text-xs font-medium">开户名 *</span>
            <input class="h-9 w-full rounded-md border px-3 text-xs ${n.settlementRequestErrors.accountHolderName?"border-red-500":""}" value="${s(n.settlementRequestForm.accountHolderName)}" data-pda-sett-field="request.accountHolderName" />
            ${n.settlementRequestErrors.accountHolderName?`<p class="text-[10px] text-red-600">${s(n.settlementRequestErrors.accountHolderName)}</p>`:""}
          </label>
          <label class="block space-y-1">
            <span class="text-xs font-medium">证件号 *</span>
            <input class="h-9 w-full rounded-md border px-3 text-xs ${n.settlementRequestErrors.idNumber?"border-red-500":""}" value="${s(n.settlementRequestForm.idNumber)}" data-pda-sett-field="request.idNumber" />
            ${n.settlementRequestErrors.idNumber?`<p class="text-[10px] text-red-600">${s(n.settlementRequestErrors.idNumber)}</p>`:""}
          </label>
          <label class="block space-y-1">
            <span class="text-xs font-medium">银行名称 *</span>
            <input class="h-9 w-full rounded-md border px-3 text-xs ${n.settlementRequestErrors.bankName?"border-red-500":""}" value="${s(n.settlementRequestForm.bankName)}" data-pda-sett-field="request.bankName" />
            ${n.settlementRequestErrors.bankName?`<p class="text-[10px] text-red-600">${s(n.settlementRequestErrors.bankName)}</p>`:""}
          </label>
          <label class="block space-y-1">
            <span class="text-xs font-medium">银行账号 *</span>
            <input class="h-9 w-full rounded-md border px-3 text-xs ${n.settlementRequestErrors.bankAccountNo?"border-red-500":""}" value="${s(n.settlementRequestForm.bankAccountNo)}" data-pda-sett-field="request.bankAccountNo" />
            ${n.settlementRequestErrors.bankAccountNo?`<p class="text-[10px] text-red-600">${s(n.settlementRequestErrors.bankAccountNo)}</p>`:""}
          </label>
          <label class="block space-y-1">
            <span class="text-xs font-medium">开户支行</span>
            <input class="h-9 w-full rounded-md border px-3 text-xs" value="${s(n.settlementRequestForm.bankBranch)}" data-pda-sett-field="request.bankBranch" />
          </label>
          <label class="block space-y-1">
            <span class="text-xs font-medium">申请说明</span>
            <textarea class="min-h-[72px] w-full rounded-md border px-3 py-2 text-xs" data-pda-sett-field="request.submitRemark">${s(n.settlementRequestForm.submitRemark)}</textarea>
          </label>
        </div>
        <button class="inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50" data-pda-sett-action="submit-settlement-change-request" ${$?"":"disabled"}>
          提交申请
        </button>
      `,"close-settlement-request-drawer"):i?R("查看申请",`
      <div class="rounded-md border bg-muted/20 px-3 py-3">
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs font-medium">${s(i.requestId)}</p>
          <span class="inline-flex rounded border px-2 py-0.5 text-[10px] ${J(i.status)}">${s(L(i.status))}</span>
        </div>
        <p class="mt-1 text-[10px] text-muted-foreground">申请时间：${s(i.submittedAt)} · 提交人：${s(i.submittedBy)}</p>
        <p class="mt-1 text-[10px] text-muted-foreground">当前版本：${s(i.currentVersionNo)} · 目标版本：${s(i.targetVersionNo)}</p>
        <p class="mt-1 text-[10px] text-muted-foreground">变更字段：${s(O(i))}</p>
        <p class="mt-1 text-[10px] text-muted-foreground">下一步：${s(Ke(i))}</p>
      </div>
      <div class="rounded-md border p-3">
        <p class="mb-2 text-xs font-medium">变更前后</p>
        <div class="grid gap-2">
          <div class="space-y-1 rounded-md bg-muted/20 p-2">
            <p class="text-[10px] text-muted-foreground">变更前（当前生效）</p>
            <p class="text-xs">开户名：${s(i.before.accountHolderName)}</p>
            <p class="text-xs">证件号：${s(i.before.idNumber)}</p>
            <p class="text-xs">银行：${s(i.before.bankName)}</p>
            <p class="text-xs">账号：${s(w(i.before.bankAccountNo))}</p>
          </div>
          <div class="space-y-1 rounded-md bg-muted/20 p-2">
            <p class="text-[10px] text-muted-foreground">申请修改后</p>
            <p class="text-xs">开户名：${s(i.after.accountHolderName)}</p>
            <p class="text-xs">证件号：${s(i.after.idNumber)}</p>
            <p class="text-xs">银行：${s(i.after.bankName)}</p>
            <p class="text-xs">账号：${s(w(i.after.bankAccountNo))}</p>
          </div>
        </div>
      </div>
      <div class="rounded-md border p-3">
        <p class="mb-2 text-xs font-medium">申请进度</p>
        <div class="space-y-2">
          ${i.logs.map(x=>`
                <div class="rounded-md border bg-muted/20 px-2.5 py-2">
                  <div class="flex items-center justify-between text-[10px]">
                    <span class="font-medium">${s(x.action)}</span>
                    <span class="text-muted-foreground">${s(x.createdAt)}</span>
                  </div>
                  <p class="mt-1 text-[10px] text-muted-foreground">操作人：${s(x.actor)}</p>
                  <p class="text-[10px] text-muted-foreground">${s(x.remark)}</p>
                </div>
              `).join("")}
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-pda-sett-action="back-to-settlement-profile">
          返回结算资料
        </button>
        <button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-pda-sett-action="open-settlement-request-history">
          查看历史申请
        </button>
      </div>
    `,"close-settlement-request-drawer"):R("查看申请",`
        <div class="rounded-md border border-dashed bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">当前暂无申请记录</div>
        <button class="inline-flex w-full items-center justify-center rounded-md border px-3 py-2 text-xs hover:bg-muted" data-pda-sett-action="back-to-settlement-profile">
          返回结算资料
        </button>
      `,"close-settlement-request-drawer")}function ie(e){return{earningAmount:e.totalEarningAmount??e.items.filter(t=>t.sourceItemType==="TASK_EARNING").reduce((t,r)=>t+(r.earningAmount??r.deductionAmount),0),deductionAmount:e.totalDeductionAmount??e.items.filter(t=>t.sourceItemType==="QUALITY_DEDUCTION").reduce((t,r)=>t+Math.abs(r.qualityDeductionAmount??r.deductionAmount),0),netAmount:e.netPayableAmount??e.totalAmount}}function Xe(e){var t;return(t=e.appealRecords)!=null&&t.length?e.appealRecords.slice().reverse():e.factoryAppealRecord?[e.factoryAppealRecord]:[]}function Ze(e){const t=(e.statementAuditLogs??[]).filter(r=>r.visibleToFactory).slice().reverse();return t.length?t.map(r=>`
        <div class="rounded-md border bg-muted/20 px-3 py-2 text-[10px] leading-5">
          <div class="flex items-center justify-between gap-2">
            <span class="font-medium text-foreground">${s(r.action)}</span>
            <span class="text-muted-foreground">${s(r.operatedAt)}</span>
          </div>
          <div class="text-muted-foreground">操作人：${s(r.actor)}</div>
          ${r.toStatus?`<div class="text-muted-foreground">对账单状态：${s(r.fromStatus?M(r.fromStatus):"-")} -> ${s(M(r.toStatus))}</div>`:""}
          ${r.toFactoryFeedbackStatus?`<div class="text-muted-foreground">工厂反馈：${s(r.fromFactoryFeedbackStatus?E(r.fromFactoryFeedbackStatus):"-")} -> ${s(E(r.toFactoryFeedbackStatus))}</div>`:""}
          ${r.reason?`<div class="text-muted-foreground">原因：${s(r.reason)}</div>`:""}
          ${r.method?`<div class="text-muted-foreground">线下确认方式：${s(Q(r.method))}</div>`:""}
          ${r.notificationStatus?`<div class="text-muted-foreground">通知状态：${s(H(r.notificationStatus))}</div>`:""}
          ${r.remark?`<div class="text-muted-foreground">备注：${s(r.remark)}</div>`:""}
        </div>
      `).join(""):'<div class="rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-[10px] text-muted-foreground">当前暂无三方工厂可见操作记录</div>'}function et(e){if(!I(e))return"";const t=e.factoryFeedbackStatus==="FACTORY_APPEALED";return`
    <div class="mt-2 rounded-md border ${t?"border-amber-200 bg-amber-50 text-amber-700":"border-blue-200 bg-blue-50 text-blue-700"} px-3 py-2 text-[10px] leading-5">
      该对账单已由跟单审核代确认，不是工厂本人 PDA 确认。
      跟单：${s(e.proxyConfirmedBy??"-")}；
      时间：${s(e.proxyConfirmedAt?A(e.proxyConfirmedAt):"-")}；
      方式：${s(Q(e.proxyConfirmMethod))}；
      通知：${s(H(e.proxyConfirmNotificationStatus))}。
      ${t?"三方工厂已对代确认结果提出异议，平台处理前该单不会继续进入付款处理。":""}
    </div>
  `}function U(e){return Le(ve(e),t=>t.paymentAt??t.prepaidAt??t.updatedAt??t.createdAt)[0]??null}function ue(e){const t=`${e.remark??""}${e.sourceRefLabel??""}${e.processLabel??""}`;return e.deductionLineType==="DELAY"||t.includes("延误")?"延误扣款":e.qcRecordId||e.deductionLineType||e.sourceItemType==="QUALITY_DEDUCTION"||t.includes("瑕疵")?e.deductionLineType==="POST_FACTORY_REWORK_CHARGEBACK"||t.includes("返工")?"返工扣款":"瑕疵扣款":"任务收入"}function tt(e){return ue(e)==="任务收入"?e.earningAmount??e.deductionAmount??0:Math.abs(e.qualityDeductionAmount??e.deductionAmount??0)}function rt(e){return e.sourceRefLabel??e.returnInboundBatchNo??e.taskNo??e.sourceItemId}function nt(e){const t=["任务收入","返工扣款","瑕疵扣款","延误扣款"],r=e.settlementCurrency??"IDR";return t.map(u=>{const l=e.items.filter(d=>ue(d)===u);return l.length?`
        <div class="space-y-2">
          <div class="text-xs font-semibold text-foreground">${s(u)}</div>
          ${l.map(d=>{const i=tt(d),c=`${u==="任务收入"?"":"-"}${f(i,r)}`;return`
                <div class="rounded-md border bg-muted/20 px-3 py-2 text-[10px] leading-5">
                  ${o("生产单",d.productionOrderNo??d.productionOrderId??"—")}
                  ${o("SKU",rt(d))}
                  ${o("质检记录",d.qcRecordId??"—")}
                  ${o("金额",c,{bold:!0,red:u!=="任务收入"})}
                  ${o("说明",d.remark??d.processLabel??d.sourceLabelZh??u)}
                </div>
              `}).join("")}
        </div>
      `:""}).join("")||'<div class="rounded-md border border-dashed bg-muted/20 px-3 py-5 text-center text-xs text-muted-foreground">当前对账单没有结算明细</div>'}function N(e,t){return Pe(e,t)}function st(){if(!n.statementDrawerMode||!n.statementDetailId)return"";const e=Re(n.statementDetailId);if(!e)return"";const t=ie(e),r=e.prepaymentBatchId?j(e.prepaymentBatchId):U(e.statementId),a=g(),u=T(a.factoryCode),l=Xe(e),d=e.status==="PENDING_FACTORY_CONFIRM"&&e.factoryFeedbackStatus==="PENDING_FACTORY_CONFIRM",i=d||I(e)&&!e.prepaymentBatchId,c=d&&y("SETTLEMENT_CONFIRM"),$=i&&y("SETTLEMENT_DISPUTE"),x=S(e),k=te(e,r),m=u&&u.versionNo!==e.settlementProfileVersionNo?`当前生效：${u.versionNo}；对账单使用：${e.settlementProfileVersionNo}。新版本用于后续新单据，本期已生成单据继续沿用原快照。`:"";if(n.statementDrawerMode==="appeal"){const v=I(e);return R(`发起申诉 · ${e.statementNo??e.statementId}`,`
        <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] leading-5 text-blue-700">
          ${v?"该对账单已由跟单审核代确认。如金额、扣款或确认依据有异议，可在这里提交；平台处理前，该单不会继续进入付款处理。":"对账单异议会记录在当前对账单上。平台处理前，该单不会继续进入付款处理。"}
        </div>
        <div class="space-y-3">
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">异议原因</label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-xs" value="${s(n.statementAppealForm.reason)}" data-pda-sett-field="statement-appeal-reason" />
          </div>
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">异议说明</label>
            <textarea class="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-xs" data-pda-sett-field="statement-appeal-description">${s(n.statementAppealForm.description)}</textarea>
          </div>
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">证据说明（选填）</label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-xs" value="${s(n.statementAppealForm.evidenceSummary)}" data-pda-sett-field="statement-appeal-evidence" />
          </div>
          ${n.statementErrorText?`<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[10px] text-red-700">${s(n.statementErrorText)}</div>`:""}
          <div class="grid grid-cols-2 gap-2">
            <button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-pda-sett-action="close-statement-drawer">取消</button>
            <button class="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50" data-pda-sett-action="submit-statement-appeal" data-statement-id="${s(e.statementId)}" ${$?"":"disabled"}>${v?"提交代确认异议":"提交异议"}</button>
          </div>
        </div>
      `,"close-statement-drawer")}return R(`对账单 · ${e.statementNo??e.statementId}`,`
      ${N("基本信息 / 概况",`
          ${o("对账单号",e.statementNo??e.statementId,{bold:!0})}
          ${o("对账单状态",M(e.status))}
          ${o("工厂反馈状态",E(e.factoryFeedbackStatus))}
          ${o("确认来源",Ne(e))}
          ${o("所属范围",e.settlementCycleLabel??"—")}
          ${o("结算对象",re(e.settlementObjectMode))}
          ${o("创建时间",A(e.createdAt))}
          ${I(e)?`
                ${o("代确认跟单",e.proxyConfirmedBy??"—")}
                ${o("代确认时间",e.proxyConfirmedAt?A(e.proxyConfirmedAt):"—")}
                ${o("代确认方式",Q(e.proxyConfirmMethod))}
                ${o("通知状态",H(e.proxyConfirmNotificationStatus))}
              `:""}
        `)}
      ${et(e)}
      ${N("金额概况",`
          ${o("应付",f(t.earningAmount),{bold:!0})}
          ${o("扣款",t.deductionAmount>0?f(t.deductionAmount):"—",{red:t.deductionAmount>0})}
          ${o("本期净额",f(t.netAmount),{bold:!0})}
          ${o("付款状态",ee(e),{green:x})}
          ${x?o("付款金额",f(D(e),e.settlementCurrency??"IDR"),{bold:!0}):""}
          ${k?o("付款时间",A(k)):""}
        `)}
      ${N("结算明细",nt(e))}
      ${N("工厂反馈",`
          ${o("反馈状态",E(e.factoryFeedbackStatus))}
          ${o("反馈时间",e.factoryFeedbackAt?A(e.factoryFeedbackAt):"当前未反馈")}
          ${o("反馈人",e.factoryFeedbackBy??"当前未反馈")}
          ${I(e)?o("代确认原因",e.proxyConfirmReason??"未记录"):""}
          ${I(e)?o("通知说明",e.proxyConfirmNotificationRemark??"未记录"):""}
          ${o("处理结果",e.resolutionResult==="UPHELD"?"维持当前口径":e.resolutionResult==="REOPEN_REQUIRED"?"退回重算":"当前未处理")}
          ${o("处理意见",e.resolutionComment||"当前未处理")}
          ${l.length>0?`<div class="space-y-2 pt-1">${l.map(v=>`
                      <div class="rounded-md border bg-muted/20 px-2.5 py-2">
                        <div class="flex items-center justify-between gap-2">
                          <span class="text-[10px] font-medium">${s(v.reasonName)}</span>
                          <span class="text-[10px] text-muted-foreground">${s(v.status==="RESOLVED"?"已处理完成":v.status==="PLATFORM_HANDLING"?"平台处理中":"已提交")}</span>
                        </div>
                        <div class="mt-1 text-[10px] text-muted-foreground">提交时间 ${s(v.submittedAt)} · ${s(v.submittedBy)}</div>
                        <div class="text-[10px] text-muted-foreground">处理意见 ${s(v.resolutionComment||"当前未处理")}</div>
                      </div>
                    `).join("")}</div>`:""}
        `)}
      ${N("三方工厂可见操作记录",Ze(e))}
      ${N("结算资料快照",`
          ${o("对账单使用版本",e.settlementProfileVersionNo)}
          ${o("当前生效版本",(u==null?void 0:u.versionNo)??"当前未初始化")}
          ${o("结算币种",e.settlementProfileSnapshot.settlementConfigSnapshot.currency)}
          ${o("收款银行",`${e.settlementProfileSnapshot.receivingAccountSnapshot.bankName} · 尾号 ${e.settlementProfileSnapshot.receivingAccountSnapshot.bankAccountNo.slice(-4)}`)}
          ${m?`<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-5 text-amber-700">${s(m)}</div>`:'<p class="text-[10px] leading-5 text-muted-foreground">当前对账单已冻结生成时的资料快照，后续主数据变更不会影响本单。</p>'}
        `)}
      <div class="grid grid-cols-2 gap-2">
        <button
          class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          data-pda-sett-action="confirm-statement"
          data-statement-id="${s(e.statementId)}"
          ${c?"":"disabled"}
        >
          确认对账单
        </button>
        <button
          class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          data-pda-sett-action="open-statement-appeal"
          data-statement-id="${s(e.statementId)}"
          ${$?"":"disabled"}
        >
          发起申诉
        </button>
        <button class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-xs hover:bg-muted" data-pda-sett-action="close-statement-drawer">关闭</button>
      </div>
    `,"close-statement-drawer")}function p(e,t,r){return`
    <button class="rounded-lg border bg-background px-3 py-2 text-left" ${r.includes("tab=quality")?'data-pda-sett-action="open-quality-list"':'data-pda-sett-action="open-statement-list"'} data-nav="${s(r)}">
      <div class="text-[11px] text-muted-foreground">${s(e)}</div>
      <div class="mt-1 text-sm font-bold text-foreground">${s(t)}</div>
    </button>
  `}function at(){return`<div class="flex gap-2 overflow-x-auto pb-1">${[["all","全部"],["pending-confirm","待确认"],["disputing","异议中"],["unpaid","未付款"],["paid","已付款"]].map(([t,r])=>`
        <button class="shrink-0 rounded-full border px-3 py-1.5 text-xs ${n.statementFilterView===t?"border-primary bg-primary text-primary-foreground":"bg-background text-muted-foreground"}" data-nav="${s(b(t))}">${s(r)}</button>
      `).join("")}</div>`}function ot(){return`<div class="flex gap-2 overflow-x-auto pb-1">${[["all","全部"],["not-in-statement","未进对账"],["in-statement","已进对账"],["rework","有返工"],["deducted","有扣款"]].map(([t,r])=>`
        <button class="shrink-0 rounded-full border px-3 py-1.5 text-xs ${n.qualityRecordFilterView===t?"border-primary bg-primary text-primary-foreground":"bg-background text-muted-foreground"}" data-nav="${s(h(t))}">${s(r)}</button>
      `).join("")}</div>`}function dt(e,t){const r=ie(e),a=e.prepaymentBatchId?j(e.prepaymentBatchId):U(e.statementId),u=S(e),l=te(e,a),d=e.status==="PENDING_FACTORY_CONFIRM"&&e.factoryFeedbackStatus==="PENDING_FACTORY_CONFIRM",i=d||I(e)&&!e.prepaymentBatchId,c=d&&y("SETTLEMENT_CONFIRM"),$=i&&y("SETTLEMENT_DISPUTE");return`
    <section class="rounded-lg border bg-card px-4 py-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="truncate text-sm font-semibold">${s(e.statementNo??e.statementId)}</h2>
          <p class="mt-1 text-[11px] text-muted-foreground">${s(t.settlementCycleLabel??e.settlementCycleLabel??"—")}</p>
        </div>
        <span class="shrink-0 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">${s(E(e.factoryFeedbackStatus))}</span>
      </div>
      <div class="mt-3 space-y-1">
        ${o("结算对象",re(e.settlementObjectMode))}
        ${o("任务收入",f(r.earningAmount,e.settlementCurrency??"IDR"))}
        ${o("扣款",r.deductionAmount>0?f(r.deductionAmount,e.settlementCurrency??"IDR"):"—",{red:r.deductionAmount>0})}
        ${o("本期净额",f(r.netAmount,e.settlementCurrency??"IDR"),{bold:!0})}
        ${o("付款状态",ee(e),{green:u})}
        ${u?o("付款金额",f(D(e),e.settlementCurrency??"IDR"),{bold:!0}):""}
        ${l?o("付款时间",A(l)):""}
      </div>
      <div class="mt-3 grid grid-cols-3 gap-2">
        <button class="inline-flex h-9 items-center justify-center rounded-md border px-2 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-pda-sett-action="confirm-statement" data-statement-id="${s(e.statementId)}" ${c?"":"disabled"}>
          确认
        </button>
        <button class="inline-flex h-9 items-center justify-center rounded-md border px-2 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-pda-sett-action="open-statement-appeal" data-statement-id="${s(e.statementId)}" ${$?"":"disabled"}>
          申诉
        </button>
        <button class="inline-flex h-9 items-center justify-center rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground" data-pda-sett-action="open-statement-detail" data-statement-id="${s(e.statementId)}">
          查看详情
        </button>
      </div>
    </section>
  `}function it(e){const t=e.settlementTrace.statusLabel==="已进入对账";return`
    <button class="w-full rounded-lg border bg-card px-4 py-3 text-left" data-pda-sett-action="open-quality-record-detail" data-qc-id="${s(e.id)}">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="truncate text-sm font-semibold">${s(e.displayNo)}</div>
          <div class="mt-1 text-[11px] text-muted-foreground">${s(e.productionOrderNo)} · ${s(e.skuSummary)}</div>
        </div>
        <span class="${_("shrink-0 rounded-full border px-2 py-0.5 text-[10px]",t?"border-emerald-200 bg-emerald-50 text-emerald-700":"bg-background text-muted-foreground")}">${s(e.settlementTrace.statusLabel)}</span>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        ${o("质检数量",`${e.inspectedQty} 件`)}
        ${o("合格数量",`${e.qualifiedQty} 件`)}
        ${o("返工数量",`${e.reworkQty} 件`,{orange:e.reworkQty>0})}
        ${o("瑕疵数量",`${e.defectQty} 件`,{orange:e.defectQty>0})}
      </div>
      <div class="mt-2 text-[11px] leading-5 text-muted-foreground">
        对账单引用：${s(e.settlementTrace.statementNo??"未进入对账")} · 返工接收对象：${s(e.reworkReceivers)}
      </div>
    </button>
  `}function ut(){const e=g(),t=ae(e),r=T(e.factoryCode),a=t.statements.filter(({statement:m})=>m.factoryFeedbackStatus==="PENDING_FACTORY_CONFIRM"),u=t.statements.filter(({statement:m})=>m.factoryFeedbackStatus==="FACTORY_APPEALED"),l=t.statements.filter(({statement:m})=>S(m)),d=t.statements.filter(({statement:m})=>!S(m)),i=t.qcRows.filter(m=>m.settlementTrace.statusLabel==="已进入对账"),c=t.qcRows.filter(m=>m.settlementTrace.statusLabel!=="已进入对账"),$=t.qcRows.filter(m=>m.reworkQty>0),x=t.qcRows.filter(m=>m.reworkChargebackAmountText!=="—"),k=F(e.factoryId)?t.openLedgers.filter(m=>m.sourceType==="TASK_COMPLETION"&&m.priceSourceType==="TASK_FIXED_TOTAL"&&m.direction==="INCOME"):[];return`
    <div class="space-y-3 px-4 py-4">
      <section class="bg-card px-4 py-4">
        <h2 class="text-sm font-semibold">收入</h2>
        <p class="mt-1 text-[11px] text-muted-foreground">未结算为未入单净额参考，不等同于应付款。</p>
        <div class="mt-3 grid grid-cols-2 gap-2">
          ${p("累计收入",f(t.accumulatedIncome,"IDR"),b("all"))}
          ${p("累计扣款",f(t.accumulatedDeduction,"IDR"),b("all"))}
          ${p("已付款",f(t.paidAmount,"IDR"),b("paid"))}
          ${p("未付款",f(t.unpaidAmount,"IDR"),b("unpaid"))}
          ${p("未结算参考金额",f(t.unsettledReferenceAmount,"IDR"),b("all"))}
        </div>
      </section>
      ${F(e.factoryId)?`
        <section class="bg-card px-4 py-4" data-kol-unsettled-ledgers>
          <div class="flex items-start justify-between gap-3">
            <div><h2 class="text-sm font-semibold">未结算收入流水</h2><p class="mt-1 text-[11px] text-muted-foreground">每张已完成整单任务按冻结总价计一次，进入对账单后从这里移除。</p></div>
            <span class="rounded-full bg-blue-50 px-2 py-1 text-[11px] text-blue-700">${k.length} 笔</span>
          </div>
          ${k.length?`
            <div class="mt-3 space-y-2">
              ${k.map(m=>`
                <article class="rounded-lg border bg-background px-3 py-3" data-kol-unsettled-ledger="${s(m.ledgerId)}">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0"><div class="truncate text-xs font-semibold">${s(m.productionOrderNo||m.productionOrderId||"-")}</div><div class="mt-1 truncate font-mono text-[11px] text-muted-foreground">${s(m.taskNo||m.taskId||"-")}</div></div>
                    <div class="shrink-0 text-right"><div class="text-sm font-bold text-blue-700">${s(f(m.settlementAmount,m.settlementCurrency))}</div><div class="mt-1 text-[10px] text-muted-foreground">整单固定总价</div></div>
                  </div>
                  <div class="mt-2 flex items-center justify-between gap-3 text-[10px] text-muted-foreground"><span>${s(A(m.occurredAt))}</span><span>待进入对账单</span></div>
                </article>
              `).join("")}
            </div>
          `:'<div class="mt-3 rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">暂无未结算整单任务收入。</div>'}
        </section>
      `:""}
      <section class="bg-card px-4 py-4">
        <h2 class="text-sm font-semibold">对账单</h2>
        <div class="mt-3 grid grid-cols-2 gap-2">
          ${p("全部",String(t.statements.length),b("all"))}
          ${p("待确认对账单",String(a.length),b("pending-confirm"))}
          ${p("异议中对账单",String(u.length),b("disputing"))}
          ${p("未付款对账单",String(d.length),b("unpaid"))}
          ${p("已付款对账单",String(l.length),b("paid"))}
        </div>
      </section>
      <section class="bg-card px-4 py-4">
        <h2 class="text-sm font-semibold">质检记录</h2>
        <div class="mt-3 grid grid-cols-2 gap-2">
          ${p("全部",String(t.qcRows.length),h("all"))}
          ${p("未进对账",String(c.length),h("not-in-statement"))}
          ${p("已进对账",String(i.length),h("in-statement"))}
          ${p("有返工",String($.length),h("rework"))}
          ${p("有扣款",String(x.length),h("deducted"))}
        </div>
      </section>
      <section class="bg-card px-4 py-4">
        <h2 class="text-sm font-semibold">结算资料</h2>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button class="rounded-lg border bg-background px-3 py-2 text-left" data-pda-sett-action="open-settlement-profile">
            <div class="text-[11px] text-muted-foreground">当前版本</div>
            <div class="mt-1 text-sm font-bold text-foreground">${s((r==null?void 0:r.versionNo)??"未初始化")}</div>
          </button>
          <button class="rounded-lg border bg-background px-3 py-2 text-left" data-pda-sett-action="open-settlement-version-history">历史版本记录</button>
        </div>
      </section>
      ${Je()}
    </div>
  `}function lt(){const e=g(),t=ae(e),r=Qe(t.statements,n.statementFilterView);return`
    <div class="space-y-3 px-4 py-4">
      <button class="text-xs text-muted-foreground" data-nav="${s(oe())}">返回结算首页</button>
      <section class="rounded-lg border bg-card px-4 py-4">
        <h1 class="text-base font-bold">${s(Be(n.statementFilterView))}</h1>
        <p class="mt-1 text-[11px] leading-5 text-muted-foreground">付款状态只说明对账单是否付款，工厂端这里只做查看。</p>
        <div class="mt-3">${at()}</div>
      </section>
      ${r.length>0?r.map(({statement:a,summary:u})=>dt(a,u)).join(""):'<div class="rounded-lg border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">当前筛选下没有对账单</div>'}
      ${st()}
    </div>
  `}function ct(){if(!n.qualityDrawerId)return"";const e=Te(n.qualityDrawerId);return e?R(`质检记录 · ${e.displayNo}`,`
      ${N("质检事实",`
        ${o("质检单",e.displayNo,{bold:!0})}
        ${o("来源类型",e.sourceTypeLabel)}
        ${o("生产单",e.productionOrderNo)}
        ${o("SKU",e.skuSummary)}
        ${o("来源工厂",e.sourceFactoryName)}
        ${o("接收对象",e.receiverName)}
        ${o("质检点",e.qcStationName)}
        ${o("质检人",e.inspectorName)}
        ${o("质检时间",A(e.inspectedAt))}
        ${o("质检结果",e.resultLabel)}
        ${o("质检数量",`${e.inspectedQty} 件`)}
        ${o("合格数量",`${e.qualifiedQty} 件`)}
        ${o("返工数量",`${e.reworkQty} 件`,{orange:e.reworkQty>0})}
        ${o("瑕疵数量",`${e.defectQty} 件`,{orange:e.defectQty>0})}
        ${o("返工接收对象",e.reworkReceivers)}
      `)}
      ${N("SKU 明细",e.skuResults.length>0?e.skuResults.map(t=>`
        <div class="rounded-md border bg-muted/20 px-3 py-2">
          <div class="text-xs font-semibold">${s(t.skuCode)}</div>
          ${o("颜色 / 尺码",`${t.colorName} / ${t.sizeName}`)}
          <div class="mt-1 text-[11px] leading-5 text-muted-foreground">
            质检 ${t.inspectedQty} ${s(t.qtyUnit)} · 合格 ${t.qualifiedQty} ${s(t.qtyUnit)} · 返工 ${t.reworkQty} ${s(t.qtyUnit)} · 瑕疵 ${t.defectQty} ${s(t.qtyUnit)}
          </div>
          <div class="mt-1 text-[11px] leading-5 text-muted-foreground">
            返工接收对象：${s(t.reworkReceiveFactoryName)} · 瑕疵原因：${s(t.defectReasonSummary)}
          </div>
          ${t.reworkChargebackAmountText!=="—"?`<div class="mt-1 text-[11px] font-medium text-red-600">返工扣款金额：${s(t.reworkChargebackAmountText)}</div>`:""}
        </div>
      `).join(""):'<div class="rounded-md border border-dashed bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">暂无 SKU 明细</div>')}
      ${N("对账引用",`
        ${o("是否进入对账",e.settlementTrace.statusLabel)}
        ${o("对账单",e.settlementTrace.statementNo??"未进入对账")}
        ${o("扣款明细",e.settlementTrace.deductionLineNo??"—")}
        ${e.reworkChargebackAmountText!=="—"?o("返工扣款金额",e.reworkChargebackAmountText,{red:!0}):""}
      `)}
    `,"close-quality-record-drawer"):""}function mt(){const e=g(),t=He(se(e),n.qualityRecordFilterView).filter(r=>Ve(r,n.qualitySearch));return`
    <div class="space-y-3 px-4 py-4">
      <button class="text-xs text-muted-foreground" data-nav="${s(oe())}">返回结算首页</button>
      <section class="rounded-lg border bg-card px-4 py-4">
        <h1 class="text-base font-bold">${s(je(n.qualityRecordFilterView))}</h1>
        <p class="mt-1 text-[11px] leading-5 text-muted-foreground">只看质检事实和对账单引用，扣款只展示对账引用，不在 PDA 端重新计算。</p>
        <div class="mt-3">${ot()}</div>
        <input class="mt-3 h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="质检单 / 生产单 / SKU / 来源工厂 / 返工接收对象 / 对账单" value="${s(n.qualitySearch)}" data-pda-sett-field="quality-search" data-fast-page-render />
      </section>
      ${t.length>0?t.map(it).join(""):'<div class="rounded-lg border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">当前筛选下没有质检记录</div>'}
      ${ct()}
    </div>
  `}function pt(){return Me(),n.pageMode==="statement-list"?lt():n.pageMode==="quality-list"?mt():ut()}function Er(){const e=V();return e?(F(e.factoryId)&&me(),y("SETTLEMENT_VIEW")?Y(pt(),"settlement"):Y(Fe(),"settlement")):qe()}function Tr(e){var u,l;if(!ke())return!0;const t=e.closest("[data-pda-sett-action]"),r=e.closest("[data-pda-sett-field]");if(r){const d=r.dataset.pdaSettField;if(d==="quality-search")return n.qualitySearch=r.value,!0;if(d==="statement-appeal-reason")return n.statementAppealForm.reason=r.value,!0;if(d==="statement-appeal-description")return n.statementAppealForm.description=r.value,!0;if(d==="statement-appeal-evidence")return n.statementAppealForm.evidenceSummary=r.value,!0;if(d==="request.accountHolderName")return n.settlementRequestForm.accountHolderName=r.value,!0;if(d==="request.idNumber")return n.settlementRequestForm.idNumber=r.value,!0;if(d==="request.bankName")return n.settlementRequestForm.bankName=r.value,!0;if(d==="request.bankAccountNo")return n.settlementRequestForm.bankAccountNo=r.value,!0;if(d==="request.bankBranch")return n.settlementRequestForm.bankBranch=r.value,!0;if(d==="request.submitRemark")return n.settlementRequestForm.submitRemark=r.value,!0}if(!t)return!1;const a=t.dataset.pdaSettAction;if(!a)return!1;if(a==="open-statement-list")return G.navigate(t.dataset.nav||b("all")),!0;if(a==="open-quality-list")return G.navigate(t.dataset.nav||h("all")),!0;if(a==="open-quality-record-detail"){const d=t.dataset.qcId;return d&&(n.qualityDrawerId=d),!0}if(a==="close-quality-record-drawer")return n.qualityDrawerId=null,!0;if(a==="open-statement-detail"){const d=t.dataset.statementId;return d&&(n.statementDrawerMode="detail",n.statementDetailId=d,n.statementErrorText=""),!0}if(a==="open-statement-appeal"){if(!y("SETTLEMENT_DISPUTE"))return n.statementErrorText="当前账号没有发起申诉权限",!0;const d=t.dataset.statementId||n.statementDetailId;return d&&(P(),n.statementDrawerMode="appeal",n.statementDetailId=d,n.statementErrorText=""),!0}if(a==="close-statement-drawer")return n.statementDrawerMode=null,n.statementDetailId=null,n.statementErrorText="",P(),!0;if(a==="confirm-statement"){if(!y("SETTLEMENT_CONFIRM"))return n.statementErrorText="当前账号没有确认对账单权限",!0;const d=t.dataset.statementId||n.statementDetailId;if(!d)return!0;const i=g(),c=ge({statementId:d,by:i.operatorName,remark:"工厂端已确认本期对账单口径"});return n.statementErrorText=c.message||"",c.ok&&(n.statementDrawerMode="detail",n.statementDetailId=d),!0}if(a==="submit-statement-appeal"){if(!y("SETTLEMENT_DISPUTE"))return n.statementErrorText="当前账号没有发起申诉权限",!0;const d=t.dataset.statementId||n.statementDetailId;if(!d)return!0;if(!n.statementAppealForm.reason.trim()||!n.statementAppealForm.description.trim())return n.statementErrorText="请先补全异议原因和异议说明",!0;const i=g(),c=$e({statementId:d,by:i.operatorName,reason:n.statementAppealForm.reason.trim(),description:n.statementAppealForm.description.trim(),evidenceSummary:n.statementAppealForm.evidenceSummary.trim()});return n.statementErrorText=c.message||"",c.ok&&(n.statementDrawerMode="detail",n.statementDetailId=d,P()),!0}if(a==="open-settlement-change-request"){if(!y("SETTLEMENT_CHANGE_REQUEST"))return n.settlementRequestErrorText="当前账号没有变更结算资料权限",!0;const d=g();if(!T(d.factoryCode))return n.settlementRequestDrawerMode=null,n.settlementRequestDetailId=null,n.settlementRequestErrorText="当前工厂尚未初始化结算资料",!0;const c=C(d.factoryCode);return c?(n.settlementRequestDrawerMode="detail",n.settlementRequestDetailId=c.requestId,n.settlementRequestErrorText="当前已有申请处理中",!0):(Ue(),n.settlementRequestDrawerMode="create",n.settlementRequestDetailId=null,!0)}if(a==="open-settlement-profile")return n.settlementRequestDrawerMode="profile",n.settlementRequestDetailId=null,n.settlementRequestErrorText="",!0;if(a==="open-settlement-request-detail"){const d=g(),i=t.dataset.requestId||((u=C(d.factoryCode))==null?void 0:u.requestId)||((l=B(d.factoryCode))==null?void 0:l.requestId)||null;return n.settlementRequestDrawerMode="detail",n.settlementRequestDetailId=i,n.settlementRequestErrorText=i?"":"当前暂无申请记录",!0}if(a==="open-settlement-request-history")return n.settlementRequestDrawerMode="history",n.settlementRequestDetailId=null,n.settlementRequestErrorText="",!0;if(a==="open-settlement-version-history")return n.settlementRequestDrawerMode="versions",n.settlementRequestDetailId=null,n.settlementRequestErrorText="",!0;if(a==="back-to-settlement-profile")return n.settlementRequestDrawerMode="profile",n.settlementRequestDetailId=null,n.settlementRequestErrorText="",!0;if(a==="close-settlement-request-drawer")return n.settlementRequestDrawerMode=null,n.settlementRequestDetailId=null,n.settlementRequestErrorText="",n.settlementRequestErrors={},!0;if(a==="submit-settlement-change-request"){if(!y("SETTLEMENT_CHANGE_REQUEST"))return n.settlementRequestErrorText="当前账号没有变更结算资料权限",!0;const d=g(),i=Ge();if(Object.keys(i).length>0)return n.settlementRequestErrors=i,n.settlementRequestErrorText="请先补全必填项",!0;const c=fe({factoryId:d.factoryCode,submittedBy:d.operatorName,submitRemark:n.settlementRequestForm.submitRemark,after:{accountHolderName:n.settlementRequestForm.accountHolderName.trim(),idNumber:n.settlementRequestForm.idNumber.trim(),bankName:n.settlementRequestForm.bankName.trim(),bankAccountNo:n.settlementRequestForm.bankAccountNo.trim(),bankBranch:n.settlementRequestForm.bankBranch.trim()}});return n.settlementRequestErrorText=c.message,c.ok&&(n.settlementRequestErrors={},n.settlementRequestDrawerMode="detail",n.settlementRequestDetailId=c.data.requestId),!0}return!1}export{Tr as handlePdaSettlementEvent,Er as renderPdaSettlementPage};

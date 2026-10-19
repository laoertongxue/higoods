import{a as N,b as F,h as C}from"./presentation-BZioemJq.js";import{p as R}from"./relations-falvlOpU.js";import{t as E}from"./printing-task-domain-Acq7bS9n.js";import{bi as _,bj as U,b7 as M}from"./craft-display-support-utD1tc2j.js";import"./index--GzcKvNw.js";import{r as G}from"./real-qr-placeholder-VWc7p642.js";import{y as d}from"./app-shared-_ZQpMwKQ.js";import{l as j}from"./pcs-product-archive-fixtures-Bv7NTmp1.js";import{p as O}from"./fabric-washing-views-BWRpR2L_.js";const z="PRINTING_INFO_SHEET_V3",Q="PRINTING_CONFIRMATION_V3",I=t=>t.map(([n,r,i])=>({label:n,value:r,emphasized:i})),c=t=>String(Number(t.toFixed(4)));function w(t){const n=[...new Set(t.split(",").map(r=>decodeURIComponent(r.trim())).filter(Boolean))];if(!n.length)throw new Error("未找到印花加工单，无法生成打印单据");return n.map(r=>{const i=E(r);if(!i)throw new Error(`所选印花加工单不存在：${r}，请重新选择`);return i})}function x(t,n){return M({documentType:n,sourceType:"PRINTING_WORK_ORDER",sourceId:t.workOrderId,businessNo:t.printOrderNo,targetRoute:`/fcs/craft/printing/work-orders/${encodeURIComponent(t.workOrderId)}`,extra:{taskNo:t.taskNo,outputSku:t.output.sku}})}function P(t){const n=t.plannedInput.plannedQty,r=t.plannedInput.qtyUnit;return/^(yard|码)$/i.test(r)?[`${c(n)} Yard`,`${c(n*.9144)} Meter`]:/^(m|meter|米)$/i.test(r)?[`${c(n/.9144)} Yard`,`${c(n)} Meter`]:[`${c(n)} ${r}`,"—"]}function T(t,n){const r=(i,o,m)=>({title:i,...o,imageUrl:j(o.imageUrl),imageLabel:o.imageAlt,sourceLabel:m,fallbackLabel:`${i}待补充`});return n==="PRINTING_CONFIRMATION"&&t.demandSource.type==="DESIGN_REVISION"?[r("正",t.requirement.frontPattern,t.requirement.frontPattern.patternNo),...t.requirement.printSide==="双面"&&t.requirement.insidePattern?[r("里",t.requirement.insidePattern,t.requirement.insidePattern.patternNo)]:[]]:n==="PRINTING_CONFIRMATION"&&t.requirement.printSide==="双面"?[r("正",t.requirement.frontPattern,t.requirement.frontPattern.patternNo),...t.requirement.insidePattern?[r("里",t.requirement.insidePattern,t.requirement.insidePattern.patternNo)]:[{title:"里",imageUrl:"",imageLabel:"里面花型待补充",sourceLabel:"",fallbackLabel:"里面花型待补充"}]]:t.demandSource.type==="STOCK"?[r("Photo",t.output,t.output.sku)]:[r("Photo",t.product,t.product.spu)]}function k(t,n){const r=w(t.sourceId),i=r[0],o=n==="PRINTING_CONFIRMATION",m=_(),l=o?Q:z,h=o?"印花确认单":"印花信息单",s=P(i),f=new Map(N(i)),u=i.demandSource.type==="DESIGN_REVISION",g=u?f.get("设计改款任务")||i.demandSource.sourceNo:f.get(o?"需求单":"生产单");return{printDocumentId:U(t,l),documentType:n,documentTitle:r.length>1?`${h}（批量 ${r.length} 张）`:h,sourceType:"PRINTING_WORK_ORDER",sourceId:t.sourceId,templateCode:l,paperType:"A4",orientation:"portrait",printTitle:h,printSubtitle:"",relatedObjectIds:r.map(p=>p.workOrderId),headerFields:I([["Printing order",i.printOrderNo],["Printing order time",i.orderedAt],["SPU",i.product.spu||"—"],["Requirement / Need",s.join(" / ")],["Fabric",i.plannedInput.materialName],[u?"设计改款任务号":o?"需求单号":"Purchase Order (PO)",g||"—"],[o?"面料 SKU":"Fabric SKU",R(i.output.sku,!0)]]),imageBlocks:T(i,n),qrCodes:[{title:"QR",value:x(i,n),description:"扫码查看印花加工单",sizeMm:o?25:26}],barcodes:[],sections:o?[{sectionId:"source",title:"印花来源",fields:I([["印花来源",i.salesType||"—"],["工艺名称",i.requirement.craftName],[u?"计划接收方":"收货人",u?O(i).join("、")||"—":i.handover.receiverName||"—"]])}]:[{sectionId:"usage",title:"原料使用",fields:I([["The quantity of raw materials used",`${c(i.actualInput.usedQty)} ${i.plannedInput.qtyUnit}`],["The roll of raw materials used",i.historicalRollQuantitiesUnknown||i.actualInput.usedQty>0&&!i.actualInput.usedRollCount?"—":String(i.actualInput.usedRollCount)]])}],tables:[],signatureBlocks:[],differenceBlocks:[],footerFields:[],printMeta:{generatedAt:m,generatedBy:"Web 打印操作员",printNotice:"按线上印花纸单打印；签字格留给现场签认。",returnHref:`/fcs/craft/printing/work-orders/${encodeURIComponent(i.workOrderId)}`}}}const tt=t=>k(t,"PRINTING_INFO_SHEET"),et=t=>k(t,"PRINTING_CONFIRMATION");function v(t){return t.imageUrl?`<button type="button" data-skip-page-rerender="true" data-pda-image-preview-url="${d(t.imageUrl)}" data-pda-image-preview-title="${d(t.imageLabel)}" aria-label="查看${d(t.imageLabel)}大图" style="border:0;background:white;max-width:100%;padding:0"><img src="${d(t.imageUrl)}" alt="${d(t.imageLabel)}" style="max-width:100%;max-height:76pt;object-fit:contain" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败'"><span>加载中</span></button>`:`<span>${d(t.fallbackLabel||"图片待补充")}</span>`}function A(t,n){return G({value:x(t,n),size:100,title:"QR",label:`${t.printOrderNo} QR`})}const e=(t,n=1,r=1,i="")=>`<td colspan="${n}" rowspan="${r}" class="${i}">${t}</td>`,a=t=>d(t||"—");function D(t){var g;const n=F(t),r=new Map(N(t)),[i,o]=P(t),m=t.requirement.printSide==="双面",l=t.demandSource.type==="DESIGN_REVISION",h=T(t,"PRINTING_CONFIRMATION").map(p=>`<div class="pp-photo">${v(p)}${m?`<div>${p.title}</div>`:""}</div>`).join(""),s=(p,b)=>{var S,y;return a(p==="ARTWORK"?b==="FINISH"?t.artworkConfirmedAt:(y=(S=t.productionActions)==null?void 0:S.filter($=>$.stage===p&&$.action===b&&($.requirementVersion||1)===(t.requirementVersion||1)).at(-1))==null?void 0:y.at:p==="PRINT"?b==="START"?n.printStartedAt:n.printFinishedAt:b==="START"?n.transferStartedAt:n.transferFinishedAt)},f=C(t),u=r.get("是否补料")==="是";return`<article class="pp-confirm" data-printing-confirmation="${d(t.workOrderId)}">${u?'<div class="pp-supplement">补料 / Bahan Tambahan</div><div class="pp-stamp">补料 / Bahan Tambahan</div>':""}<table class="pp-confirm-table"><colgroup>${Array(7).fill("<col>").join("")}</colgroup><tbody>
    <tr>${e("Printing order")}${e(a(t.printOrderNo))}${e("Printing order time")}${e(a(t.orderedAt),2)}<td colspan="2" rowspan="8" class="pp-media"><div class="pp-photos ${m?"pp-double":""}">${h}</div><div class="pp-qr">${A(t,"PRINTING_CONFIRMATION")}</div></td></tr>
    <tr>${e("SPU")}${e(a(t.product.spu))}${e("Requirement / Need")}${e(i)}${e(o)}</tr>
    <tr>${e("Fabric")}${e(a(t.plannedInput.materialName))}${e(l?"设计改款任务号":"需求单号")}${e(`${l?"设计改款任务号":"需求单号"}：${a(l?r.get("设计改款任务"):r.get("需求单"))}`,2)}</tr>
    <tr>${e("面料 SKU")}${e(a(R(t.output.sku,!0)),4)}</tr>
    <tr><td colspan="5" class="pp-source"><div>${["印花来源",a(t.salesType),"工艺名称",a(t.requirement.craftName),l?"计划接收方":"收货人",a(l?O(t).join("、"):t.handover.receiverName)].map(p=>`<span>${p}</span>`).join("")}</div></td></tr>
    <tr>${e("Urgent")}${e("")}${e("Printing accuracy")}${e("—",2)}</tr>
    <tr>${e(l?"目标花型由 SKU 确定":"Edit confirmation",1,2,"pp-section")}${e(l?a(t.requirement.frontPattern.patternNo):"",1,2)}${e(l?"目标 SKU":"Confirmation time")}${e(l?a(t.output.sku):s("ARTWORK","START"),2)}</tr>
    <tr>${e(l?"花型编号":"Completion time")}${e(l?a(t.requirement.frontPattern.patternNo):s("ARTWORK","FINISH"),2)}</tr>
    <tr>${e("Print confirmation",1,2,"pp-section")}${e("",1,2)}${e("Confirmation time")}${e(s("PRINT","START"))}${e("Printing length")}${e("Printing width")}${e("Qty (roll)")}</tr>
    <tr>${e("Confirmation time")}${e(s("PRINT","FINISH"))}${e("M",1,1,"pp-unit")}${e("CM",1,1,"pp-unit")}${e("")}</tr>
    <tr>${e("Pattern transfer<br>confirmation",1,2,"pp-section")}${e("",1,2)}${e("Confirmation time")}${e(f?s("TRANSFER","START"):"—")}${e("Printing length")}${e("Printing width")}${e("Qty (roll)")}</tr>
    <tr>${e("Completion time")}${e(f?s("TRANSFER","FINISH"):"—")}${e("M",1,1,"pp-unit")}${e("CM",1,1,"pp-unit")}${e("")}</tr>
    <tr>${e("Storage time")}${e(a(t.barcodes.map(p=>p.inboundAt).filter(p=>!!p).sort().at(-1)))}${e("Gudang")}${e(a((g=t.barcodes.find(p=>p.warehouseName))==null?void 0:g.warehouseName))}${e("M",1,1,"pp-unit")}${e("")}${e("")}</tr>
    <tr class="pp-remark">${e("Remark")}${e(d(t.remark||""),6)}</tr>
  </tbody></table></article>`}function K(t){const[n,r]=P(t),i=new Map(N(t)),o=t.demandSource.type==="DESIGN_REVISION";return`<article class="pp-info" data-printing-info="${d(t.workOrderId)}"><table><tbody>
    <tr>${e("Printing order")}${e(a(t.printOrderNo))}${e("Printing order time")}${e(a(t.orderedAt),2)}${e("Photo",2)}</tr>
    <tr>${e("SPU")}${e(a(t.product.spu))}${e("Requirement / Need")}${e(n)}${e(r)}<td colspan="2" rowspan="4"><div class="pp-info-media">${A(t,"PRINTING_INFO_SHEET")}${T(t,"PRINTING_INFO_SHEET").map(v).join("")}</div></td></tr>
    <tr>${e("Fabric")}${e(a(t.plannedInput.materialName))}${e(o?"设计改款任务号":"Purchase Order (PO)")}${e(a(o?i.get("设计改款任务"):i.get("生产单")),2)}</tr>
    <tr>${e("Fabric SKU")}${e(a(R(t.output.sku,!0)),4)}</tr>
    <tr>${e("The quantity of raw materials used")}${e(`${c(t.actualInput.usedQty)} ${d(t.plannedInput.qtyUnit)}`)}${e("The roll of raw materials used")}${e(t.historicalRollQuantitiesUnknown||t.actualInput.usedQty>0&&!t.actualInput.usedRollCount?"—":String(t.actualInput.usedRollCount),2)}</tr>
  </tbody></table></article>`}function q(){return`<style>
  @page { size:A4 portrait; margin:0 }
  .pp-confirm,.pp-info {
    box-sizing:border-box; color:#1f2937; background:#fff;
    font-family:Arial,"PingFang SC","Microsoft YaHei",sans-serif;
    font-variant-numeric:tabular-nums; margin:0 auto; position:relative; break-inside:avoid;
  }
  .pp-confirm {
    width:210mm; height:148.5mm; padding:2.5mm 3mm;
    display:flex; flex-direction:column;
  }
  .pp-confirm-table {
    table-layout:fixed; width:100%; border-collapse:collapse;
    border:1pt solid #475569; flex:1 1 0; height:0; min-height:0;
    max-height:calc(100% - 1px); font-size:8pt; line-height:1.35;
  }
  .pp-confirm-table td {
    border:.6pt solid #94a3b8; padding:2pt 3pt; word-break:normal; overflow-wrap:anywhere;
    text-align:center; vertical-align:middle; height:20pt;
  }
  .pp-confirm-table tr:nth-child(-n+6)>td { height:24pt }
  .pp-confirm-table tr>td:first-child,
  .pp-confirm-table tr:nth-child(-n+3)>td:nth-child(3),
  .pp-confirm-table tr:nth-child(6)>td:nth-child(3),
  .pp-confirm-table tr:nth-child(7)>td:nth-child(3),
  .pp-confirm-table tr:nth-child(9)>td:nth-child(n+3),
  .pp-confirm-table tr:nth-child(11)>td:nth-child(n+3),
  .pp-confirm-table tr:nth-child(13)>td:nth-child(3) {
    color:#475569; font-weight:600;
  }
  .pp-confirm-table tr:first-child>td:nth-child(2),
  .pp-confirm-table tr:nth-child(4)>td:nth-child(2) { color:#111827; font-weight:600 }
  .pp-confirm-table .pp-section { color:#334155; font-weight:600; background:#f1f5f9 }
  .pp-confirm-table .pp-unit { text-align:right; color:#64748b; padding-right:5pt }
  .pp-confirm-table .pp-media { padding:0; vertical-align:top }
  .pp-photos { height:126pt; display:flex; align-items:center; justify-content:center; padding:4pt; box-sizing:border-box }
  .pp-photos.pp-double { flex-direction:column; gap:3pt }
  .pp-double .pp-photo img { max-height:36pt!important }
  .pp-double .pp-photo { font-size:7pt; line-height:1.25 }
  .pp-qr { border-top:.6pt solid #94a3b8; display:flex; justify-content:center; padding:2pt 0; height:54pt; box-sizing:border-box }
  .pp-qr svg { width:50pt; height:50pt }
  .pp-confirm-table .pp-source { padding:0 }
  .pp-source>div { display:flex; height:100%; min-height:24pt }
  .pp-source span { display:flex; align-items:center; justify-content:center; flex:1; border-right:.6pt solid #94a3b8; padding:2pt 3pt }
  .pp-source span:nth-child(odd) { font-weight:600; color:#475569; background:#f8fafc }
  .pp-source span:last-child { border:0 }
  .pp-confirm-table .pp-remark td { height:68pt; vertical-align:top; text-align:left; padding:6pt; line-height:1.5 }
  .pp-supplement { background:#fff1f2; color:#9f1239; border:.6pt solid #fda4af; font-size:10pt; line-height:1.4; font-weight:700; text-align:center; padding:1pt 0; margin-bottom:1.5mm }
  .pp-stamp { position:absolute; right:58pt; top:28pt; color:#b91c1c; border:1.5pt solid #b91c1c; border-radius:2pt; transform:rotate(-12deg); font-size:8pt; font-weight:700; padding:3pt 6pt; background:#fff; z-index:1 }

  .pp-info { width:191.7mm; min-height:150mm; padding:4mm }
  .pp-info table { table-layout:fixed; border-collapse:collapse; width:100%; height:150mm; border:1pt solid #475569; text-align:center; font-size:11pt; line-height:1.55; margin:0 }
  .pp-info td { border:.6pt solid #94a3b8; padding:7pt 6pt; vertical-align:middle; word-break:normal; overflow-wrap:anywhere }
  .pp-info tr:first-child>td:nth-child(1) { width:16% }
  .pp-info tr:first-child>td:nth-child(2) { width:20% }
  .pp-info tr:first-child>td:nth-child(3) { width:21% }
  .pp-info tr:first-child>td:nth-child(4) { width:22%; font-size:10.5pt }
  .pp-info tr:first-child>td:nth-child(5) { width:21% }
  .pp-info td:first-child,.pp-info tr:nth-child(-n+3)>td:nth-child(3),
  .pp-info tr:last-child>td:nth-child(3),.pp-info tr:first-child>td:last-child {
    font-size:10pt; font-weight:600; color:#475569; background:#f8fafc;
  }
  .pp-info tr:first-child>td:nth-child(2),.pp-info tr:nth-child(2)>td:nth-child(2),
  .pp-info tr:nth-child(4)>td:nth-child(2) { font-weight:600; color:#111827 }
  .pp-info tr:nth-child(4)>td:nth-child(2) { text-align:left; padding-left:10pt }
  .pp-info tr:nth-child(2)>td:nth-child(4),.pp-info tr:nth-child(2)>td:nth-child(5) { font-size:10.5pt; padding:7pt 3pt }
  .pp-info tr:last-child>td:nth-child(even) { font-size:12pt; font-weight:600; color:#111827 }
  .pp-info-media { width:100%; display:flex; flex-direction:column; align-items:center; gap:12pt }
  .pp-info-media img { max-height:80pt!important; max-width:100%!important }
  .pp-info-media svg { max-width:100%; height:auto }

  .pp-confirm:nth-of-type(2n),.pp-confirm:last-child { margin-bottom:12px }
  @media screen { .pp-confirm,.pp-info { box-shadow:0 1px 5px rgb(15 23 42 / 10%) } }
  @media print {
    .pp-confirm,.pp-info { margin:0 auto!important; box-shadow:none; -webkit-print-color-adjust:exact; print-color-adjust:exact }
    .pp-confirm:nth-of-type(2n) { break-after:page }
    .pp-confirm:last-child { break-after:auto }
    .pp-info { break-after:page }
    .pp-info:last-child { break-after:auto }
  }
  </style>`}function it(t){return q()+w(t.sourceId).map(K).join("")}function nt(t){return q()+w(t.sourceId).map(D).join("")}export{tt as a,et as b,it as c,P as p,nt as r};

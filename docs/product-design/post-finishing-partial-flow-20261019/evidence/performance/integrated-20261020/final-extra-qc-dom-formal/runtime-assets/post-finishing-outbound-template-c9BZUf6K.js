import{y as s,D as y}from"./app-shared-_ZQpMwKQ.js";import{f as v,c1 as k}from"./pcs-tech-pack-review-CGzks-v2.js";import{bi as g,bj as p}from"./craft-display-support-BBhuUla2.js";import{a0 as T,g as N}from"./post-finishing-full-flow-zmZz6Spx.js";import{r as B}from"./real-barcode-BJdGy9l6.js";import{l as S}from"./garment-spu-replacement-CtEYcdc6.js";const O="GB/T 2660 2017",_="B";function h(t){const e=/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(t);return e?`${e[1]}-${e[2].padStart(2,"0")}-${e[3].padStart(2,"0")}`:t.slice(0,10)}function I(t){const e=t>0&&t<1e4?t*1e3:t;return`Rp. ${Math.round(Math.max(e,0)).toLocaleString("en-US")}`}function $(t,e){var l;const n=S(t.sourceId),a=(l=t.skuData)==null?void 0:l.reduce((o,d)=>{const u=Math.floor(Number(d.qty));return d.skuCode&&Number.isFinite(u)&&u>0&&o.set(d.skuCode,(o.get(d.skuCode)||0)+u),o},new Map),r=n.flatMap(o=>{const d=a?a.get(o.identity.skuCode)||0:1;return Array.from({length:d},()=>o)});if(!r.length)throw new Error("当前单据没有可打印的成衣 SKU。");const i=t.documentType==="GARMENT_HANGTAG";return r.map(o=>{const d=v(o.identity.spuCode),u=(d==null?void 0:d.brandName)||(d==null?void 0:d.styleNameEn)||o.identity.spuName||o.identity.spuCode,b=(d==null?void 0:d.subCategoryName)||(d==null?void 0:d.categoryName)||"Women's Tops";return{labelTitle:i?u:o.identity.skuCode,labelSubtitle:i?b:h(e),labelFields:i?[{label:"Kategori",value:b},{label:"SPU",value:o.identity.spuCode},{label:"Metode pencucian",value:""},{label:"Standar implementasi",value:O},{label:"Kategori keamanan",value:_},{label:"Harga",value:I(o.identity.suggestedRetailPrice)}]:[{label:"日期",value:h(e)},{label:"SKU",value:o.identity.skuCode}],barcode:{title:i?`${o.identity.shipmentBarcode}-0`:o.identity.shipmentBarcode,value:i?`${o.identity.shipmentBarcode}-0`:o.identity.shipmentBarcode,description:i?`${o.identity.shipmentBarcode}-0`:o.identity.shipmentBarcode},secondaryBarcode:i?{title:o.identity.retailBarcode,value:o.identity.retailBarcode,description:o.identity.retailBarcode}:void 0,labelWarnings:[]}})}function j(t){const e=g(),n=$(t,e),a=t.documentType==="GARMENT_HANGTAG",r=a?"GARMENT_HANGTAG_V2":"GARMENT_SKU_BARCODE_V2";return{printDocumentId:p(t,r),documentType:t.documentType,documentTitle:a?"商品标签":"SKU 条码",sourceType:t.sourceType,sourceId:t.sourceId,templateCode:r,paperType:a?"LABEL_40_100":"LABEL_40_30",orientation:"portrait",printTitle:a?"商品标签":"SKU 条码",printSubtitle:"",headerFields:[],imageBlocks:[],qrCodes:[],barcodes:n.flatMap(i=>[i.barcode,i.secondaryBarcode].filter(Boolean)),sections:[],tables:[],signatureBlocks:[],differenceBlocks:[],footerFields:[],printMeta:{generatedAt:e,generatedBy:"当前登录用户",printNotice:"",returnHref:t.sourceType==="GARMENT_WAREHOUSE_RELABEL_TASK"?"/wls/garment-relabel-tasks":"/fcs/production/orders"},labelSize:a?"LABEL_40_100":"LABEL_40_30",labelLayout:"单张标签",printMode:"普通打印",labelItems:n,relatedObjectIds:[t.sourceId],totalCopies:n.length}}function c(t,e){var n;return((n=t.labelFields.find(a=>a.label===e))==null?void 0:n.value)||""}function m(t,e,n){return`<div class="${n}" data-online-barcode>${B(t,e)}</div>`}function A(){return`<div class="online-hangtag-washing-icons" aria-label="洗涤方式图标">
    <svg viewBox="0 0 24 20" aria-hidden="true"><path d="M3 7h18l-2 11H5L3 7Zm2-4c2 3 4 3 7 0 3 3 5 3 7 0"/></svg>
    <svg viewBox="0 0 24 20" aria-hidden="true"><path d="m12 2 9 16H3L12 2Z"/><path d="m8 14 8-8"/></svg>
    <svg viewBox="0 0 24 20" aria-hidden="true"><rect x="3" y="2" width="18" height="16" rx="1"/><circle cx="12" cy="10" r="5"/></svg>
    <svg viewBox="0 0 24 20" aria-hidden="true"><path d="M3 14h18l-3-8H8l-5 8Zm5-8V3h7"/><path d="M7 17h10"/></svg>
  </div>`}function C(t){var r;const e=c(t,"日期"),n=c(t,"SKU"),a=((r=t.barcode)==null?void 0:r.value)||"";return`<article class="online-sku-barcode" data-online-print-layout="sku-barcode">
    ${m(a,`SKU 条码 ${a}`,"online-sku-barcode-bars")}
    <div class="online-sku-barcode-code">${s(a)}</div>
    <div class="online-sku-barcode-date">${s(e)}</div>
    <div class="online-sku-barcode-sku">${s(n)}</div>
  </article>`}function x(t){var a,r;const e=((a=t.barcode)==null?void 0:a.value)||"",n=((r=t.secondaryBarcode)==null?void 0:r.value)||"";return`<article class="online-garment-hangtag" data-online-print-layout="garment-hangtag">
    <div class="online-hangtag-color-dot" data-online-color-dot aria-hidden="true"></div>
    <strong class="online-hangtag-brand">${s(t.labelTitle)}</strong>
    <div class="online-hangtag-field"><span>Kategori:</span> ${s(c(t,"Kategori"))}</div>
    <div class="online-hangtag-field"><span>SPU:</span> ${s(c(t,"SPU"))}</div>
    <div class="online-hangtag-field online-hangtag-washing"><span>Metode pencucian:</span></div>
    ${A()}
    <div class="online-hangtag-field online-hangtag-standard"><span>Standar implementasi:</span><b>${s(c(t,"Standar implementasi"))}</b></div>
    <div class="online-hangtag-field"><span>Kategori keamanan:</span> ${s(c(t,"Kategori keamanan"))}</div>
    ${m(e,`HG 条码 ${e}`,"online-hangtag-barcode online-hangtag-shipment")}
    <div class="online-hangtag-code">${s(e)}</div>
    ${m(n,`零售条码 ${n}`,"online-hangtag-barcode online-hangtag-retail")}
    <strong class="online-hangtag-price">${s(c(t,"Harga"))}</strong>
  </article>`}function w(t){const e=t.documentType==="GARMENT_HANGTAG";return`<style>
    @media print {
      @page { size: ${e?"40mm 100mm":"40mm 30mm"}; margin: 0; }
      .online-sku-barcode, .online-garment-hangtag { break-after: page; page-break-after: always; }
      .online-sku-barcode:last-child, .online-garment-hangtag:last-child { break-after: auto; page-break-after: auto; }
    }
    .online-sku-barcode, .online-garment-hangtag { box-sizing: border-box; overflow: hidden; color: #111; background: #fff; font-family: Arial, Helvetica, sans-serif; }
    .online-sku-barcode { width: 40mm; height: 30mm; padding: 3mm 1mm 2mm; text-align: center; }
    .online-sku-barcode-bars { height: 7.5mm; overflow: hidden; }
    .online-sku-barcode-bars svg { display: block; width: 100%; height: 7.5mm; }
    .online-sku-barcode-code { margin-top: .5mm; font-size: 7.5pt; line-height: 1.05; }
    .online-sku-barcode-date { margin-top: .5mm; font-size: 8.5pt; line-height: 1.05; }
    .online-sku-barcode-sku { margin: .6mm auto 0; max-width: 38mm; font-size: 9pt; font-weight: 400; line-height: 1.05; overflow-wrap: anywhere; }
    .online-garment-hangtag { width: 40mm; height: 100mm; padding: 5mm 3mm 2.5mm; text-align: left; font-size: 6.4pt; line-height: 1.25; }
    .online-hangtag-color-dot { width: 5.5mm; height: 5.5mm; margin: 0 auto 3.5mm; border-radius: 50%; background: #666; }
    .online-hangtag-brand { display: block; margin-bottom: 1.7mm; text-align: center; font-size: 9.2pt; line-height: 1.1; }
    .online-hangtag-field { margin-top: 1.1mm; white-space: normal; }
    .online-hangtag-field span { font-weight: 400; }
    .online-hangtag-washing { margin-top: 1.5mm; }
    .online-hangtag-washing-icons { display: flex; justify-content: center; gap: 1.3mm; margin: 1.4mm 0; }
    .online-hangtag-washing-icons svg { width: 4.5mm; height: 4mm; fill: none; stroke: currentColor; stroke-width: 1.3; }
    .online-hangtag-standard { margin-top: 1.4mm; }
    .online-hangtag-standard span, .online-hangtag-standard b { display: block; font-weight: 400; }
    .online-hangtag-standard b { margin-top: .7mm; text-align: center; }
    .online-hangtag-barcode { width: 29mm; height: 8mm; margin: 2mm auto 0; overflow: hidden; }
    .online-hangtag-barcode svg { display: block; width: 100%; height: 8mm; }
    .online-hangtag-code { margin-top: .4mm; text-align: center; font-size: 5.8pt; line-height: 1; }
    .online-hangtag-retail { margin-top: 1.8mm; }
    .online-hangtag-price { display: block; margin-top: .9mm; text-align: center; font-size: 8.2pt; }
    .hidden { display: none !important; }
  </style>${(t.labelItems||[]).map(a=>e?x(a):C(a)).join("")}`}function f(t){const e=N(t);if(!e)throw new Error(`未找到后道出货单：${t}`);return e}function E(t){var a,r;const e=f(t.sourceId),n=g();return{printDocumentId:p(t,"POST_FINISHING_OUTBOUND_ORDER_V1"),documentType:t.documentType,documentTitle:`后道出货单 ${e.outboundOrderNo}`,sourceType:"POST_FINISHING_OUTBOUND_ORDER",sourceId:e.outboundOrderId,templateCode:"POST_FINISHING_OUTBOUND_ORDER_V1",paperType:"A4",orientation:"portrait",printTitle:"后道出货单",printSubtitle:e.outboundOrderNo,headerFields:[{label:"出货单号",value:e.outboundOrderNo,emphasis:!0},{label:"状态",value:e.status},{label:"工厂",value:((a=T(e.deliveryId))==null?void 0:a.managedPostFactoryName)||y},{label:"来源动作",value:e.sourceType},{label:"出库仓",value:e.sourceType==="后道加工后"?"处理后待交出区":"QC 合格交接区"},{label:"接收仓",value:"成衣仓"},{label:"生产单号",value:e.productionOrderNo},{label:"任务单号",value:e.postTaskNo||e.qcTaskNo},{label:"来源对象",value:e.recheckOrderNo||e.qcTaskNo},{label:"创建时间",value:e.createdAt}],imageBlocks:[],qrCodes:[],barcodes:[{title:"后道出货单条码",value:e.outboundOrderNo,description:e.outboundOrderNo}],sections:[],tables:[{tableId:"post-finishing-outbound-lines",title:"出货明细",headers:["序号","图片 / 名称","类型","SKU","颜色","尺码","计划数量","已入库数量","单位"],rows:e.lines.map((i,l)=>[String(l+1),`${i.sku.imageUrl||""}
${i.sku.spuName}`,"成衣",i.sku.skuCode,i.sku.colorName,i.sku.sizeName,String(i.outboundQty),String(i.receivedQty||0),i.sku.qtyUnit])}],signatureBlocks:[],differenceBlocks:[],footerFields:[],printMeta:{generatedAt:n,generatedBy:((r=e.receivedBy)==null?void 0:r.actorName)||"后道全流程",printNotice:"",returnHref:`/fcs/craft/post-finishing/outbound-orders/${encodeURIComponent(e.outboundOrderId)}`},relatedObjectIds:[e.recheckOrderId||"",e.qcTaskId,e.postTaskId||""].filter(Boolean)}}function U(t){let e=0;for(const n of t)e=(e*31+n.charCodeAt(0))%1e7;return`HG${String(e).padStart(7,"0")}`}function F(t){var i;const e=f(t.sourceId),n=g(),a=n.slice(0,10),r=e.lines.flatMap(l=>Array.from({length:l.outboundQty},()=>{const o=k(l.sku.skuCode),d=l.sku.barcode||(o==null?void 0:o.barcode)||U(l.sku.skuCode);return{labelTitle:l.sku.skuCode,labelFields:[{label:"日期",value:a},{label:"SKU",value:l.sku.skuCode}],barcode:{title:d,value:d,description:d},labelWarnings:[]}}));return{printDocumentId:p(t,"POST_FINISHING_OUTBOUND_BARCODE_V1"),documentType:t.documentType,documentTitle:"SKU 条码",sourceType:"POST_FINISHING_OUTBOUND_ORDER",sourceId:e.outboundOrderId,templateCode:"POST_FINISHING_OUTBOUND_BARCODE_V1",paperType:"LABEL_40_30",orientation:"portrait",printTitle:"SKU 条码",printSubtitle:"",headerFields:[],imageBlocks:[],qrCodes:[],barcodes:r.flatMap(l=>l.barcode?[l.barcode]:[]),sections:[],tables:[],signatureBlocks:[],differenceBlocks:[],footerFields:[],printMeta:{generatedAt:n,generatedBy:((i=e.receivedBy)==null?void 0:i.actorName)||"后道全流程",printNotice:"",returnHref:`/fcs/craft/post-finishing/outbound-orders/${encodeURIComponent(e.outboundOrderId)}`},labelSize:"LABEL_40_30",labelLayout:"单张标签",printMode:"普通打印",labelItems:r,relatedObjectIds:[e.recheckOrderId||e.qcTaskId],totalCopies:r.length}}function R(t){const[e,...n]=t.split(`
`),a=n.join(`
`);return`<div class="outbound-print-product">${e?`<img src="${s(e)}" alt="${s(a)}" onerror="this.classList.add('hidden');this.nextElementSibling.classList.remove('hidden')"><span class="hidden">图片加载失败</span>`:"<span>无图</span>"}<b>${s(a)}</b></div>`}function G(t){const e=t.tables[0],n=a=>{var r;return((r=t.headerFields.find(i=>i.label===a))==null?void 0:r.value)||""};return`<style>
    @media print { @page { size: A4 portrait; margin: 10mm; } }
    .post-outbound-print { box-sizing: border-box; width: 190mm; min-height: 277mm; margin: 0 auto; padding: 4mm 5mm; background: #fff; color: #111; font-family: Arial, "Microsoft YaHei", sans-serif; }
    .post-outbound-print h1 { margin: 0 0 4mm; text-align: center; font-size: 18pt; }
    .post-outbound-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-left: 1px solid #222; border-top: 1px solid #222; font-size: 9pt; }
    .post-outbound-meta div { display: grid; grid-template-columns: 28mm 1fr; border-right: 1px solid #222; border-bottom: 1px solid #222; }
    .post-outbound-meta span, .post-outbound-meta b { padding: 2mm; font-weight: 400; }
    .post-outbound-meta span { background: #f5f5f5; }
    .post-outbound-print h2 { margin: 5mm 0 2mm; font-size: 11pt; }
    .post-outbound-print table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 7.5pt; }
    .post-outbound-print th, .post-outbound-print td { border: 1px solid #222; padding: 1.5mm; text-align: center; overflow-wrap: anywhere; }
    .post-outbound-print th { background: #f1f1f1; }
    .outbound-print-product { display: flex; align-items: center; gap: 1.5mm; text-align: left; }
    .outbound-print-product img { width: 10mm; height: 13mm; object-fit: cover; }
    .outbound-print-product b { font-weight: 400; }
    .post-outbound-footer { margin-top: 5mm; text-align: right; font-size: 7pt; color: #444; }
    .hidden { display: none !important; }
  </style><article class="post-outbound-print" data-post-finishing-outbound-print>
    <h1>后道出货单</h1>
    <section class="post-outbound-meta">
      ${t.headerFields.map(a=>`<div><span>${s(a.label)}</span><b>${s(a.value)}</b></div>`).join("")}
    </section>
    <h2>${s((e==null?void 0:e.title)||"出货明细")}</h2>
    <table><thead><tr>${((e==null?void 0:e.headers)||[]).map(a=>`<th>${s(a)}</th>`).join("")}</tr></thead><tbody>
      ${((e==null?void 0:e.rows)||[]).map(a=>`<tr>${a.map((r,i)=>`<td>${i===1?R(r):s(r)}</td>`).join("")}</tr>`).join("")}
    </tbody></table>
    <div class="post-outbound-footer">打印时间：${s(t.printMeta.generatedAt)} · ${s(n("出货单号"))}</div>
  </article>`}function H(t){return w(t)}const q=Object.freeze(Object.defineProperty({__proto__:null,buildPostFinishingOutboundBarcodePrintDocument:F,buildPostFinishingOutboundOrderPrintDocument:E,renderPostFinishingOutboundBarcodeTemplate:H,renderPostFinishingOutboundOrderTemplate:G},Symbol.toStringTag,{value:"Module"}));export{H as a,E as b,F as c,w as d,j as e,q as p,G as r};

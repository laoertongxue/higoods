import{bi as v,bj as m,bw as o}from"./craft-display-support-utD1tc2j.js";import"./index--GzcKvNw.js";import{r as g}from"./real-qr-placeholder-VWc7p642.js";import{y as a}from"./app-shared-_ZQpMwKQ.js";const $={prep:"MATERIAL_PREP_SLIP",pickup:"PICKUP_SLIP",issue:"ISSUE_SLIP"};function n(e){return e.map(t=>({label:t.label,value:t.value,emphasis:t.emphasis}))}function f(e){return new URLSearchParams({documentType:e.documentType,sourceId:e.sourceId,slipNo:e.slipNo,sourceProductionOrderNo:e.sourceProductionOrderNo,targetRoute:e.targetRoute}).toString()}function P(e){const t=v(),i=$[e.kind];return{printDocumentId:m(e.buildInput,i),documentType:e.buildInput.documentType,documentTitle:e.title,sourceType:e.buildInput.sourceType,sourceId:e.sourceId,templateCode:i,paperType:"A4",orientation:"portrait",printTitle:e.title,printSubtitle:e.subtitle,headerFields:e.headerFields,imageBlocks:e.imageBlocks||[{title:"款式信息",imageUrl:e.imageUrl||"",imageLabel:e.imageLabel||"暂无商品图",sourceLabel:e.imageSourceLabel||"无业务图片",fallbackLabel:"暂无商品图"}],qrCodes:[{title:`${e.title}二维码`,value:e.qrValue,description:e.qrDescription,sizeMm:30}],barcodes:[],sections:e.sections,tables:e.tables,differenceBlocks:[],signatureBlocks:e.signatureBlocks,footerFields:[...e.footerFields,{label:"打印时间",value:t},{label:"统一打印服务",value:"PrintDocument"}],printMeta:{generatedAt:t,generatedBy:"系统自动生成",printNotice:"打印前请在浏览器打印设置中关闭页眉和页脚",returnHref:e.returnHref}}}function d(e){return`
    <div class="print-field-grid">
      ${e.map(t=>`
        <div class="print-field ${t.emphasis?"print-field-emphasis":""}">
          <div class="print-field-label">${a(t.label)}</div>
          <div class="print-field-value">${a(t.value||"—")}</div>
        </div>
      `).join("")}
    </div>
  `}function I(e){const t=[...e.rows];for(;t.length<(e.minRows||0);)t.push(Array.from({length:e.headers.length},()=>""));return`
    <section class="print-section">
      <div class="print-section-title">${a(e.title)}</div>
      <table class="print-table">
        <thead><tr>${e.headers.map(i=>`<th>${a(i)}</th>`).join("")}</tr></thead>
        <tbody>
          ${t.map(i=>`<tr>${e.headers.map((l,s)=>`<td>${a(i[s]||"")}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </section>
  `}function h(e){return`
    <section class="print-section print-avoid-break">
      <div class="print-section-title">签字区</div>
      <div class="print-signature-grid">
        ${e.map(t=>`
          <div class="print-signature-cell">
            <div class="print-signature-label">${a(t.label)}</div>
            <div class="print-signature-role">${a(t.signerRole)}</div>
          </div>
        `).join("")}
      </div>
    </section>
  `}function c(e){return e.imageUrl?`<div data-print-image-frame><button type="button" class="print-image-frame" style="width:100%;padding:0;border-radius:0" data-print-image-url="${a(e.imageUrl)}" data-print-image-title="${a(e.imageLabel)}" aria-label="查看${a(e.imageLabel)}大图"><img data-print-image src="${a(e.imageUrl)}" alt="${a(e.imageLabel)}" loading="eager"></button><span data-print-image-loading class="print-hidden">图片加载中…</span><span data-print-image-error hidden class="print-hidden">图片加载失败：${a(e.imageLabel)} <button type="button" data-print-image-retry>重试图片</button></span></div>`:`<div class="print-image-placeholder" data-print-image-missing>${a(e.fallbackLabel)}</div>`}function y(e,t){return e.length?`<section class="print-section print-avoid-break"><div class="print-section-title">物料图片</div><div class="grid grid-cols-3 gap-3">${e.map(i=>`<div class="rounded border p-2">${t?c(i):i.imageUrl?`<div class="print-image-frame"><img src="${a(i.imageUrl)}" alt="${a(i.imageLabel)}"></div>`:`<div class="print-image-placeholder">${a(i.fallbackLabel)}</div>`}<div class="print-note">${a(i.sourceLabel)}</div></div>`).join("")}</div></section>`:""}function L(e){const t=e.imageBlocks[0],i=e.qrCodes[0];return`
    <article class="print-paper-a4">
      <div class="print-card-sheet">
        <header>
          <div class="print-card-title">${a(e.printTitle)}</div>
          <div class="print-card-subtitle">${a(e.printSubtitle)}</div>
        </header>

        <div class="print-main-grid">
          <section class="print-image-box">
            <div class="print-section-title">${a((t==null?void 0:t.title)||"款式信息")}</div>
            ${e.documentType==="PICKUP_SLIP"&&t?c(t):t!=null&&t.imageUrl?`<div class="print-image-frame"><img src="${a(t.imageUrl)}" alt="${a(t.imageLabel)}"></div>`:`<div class="print-image-placeholder">${a((t==null?void 0:t.fallbackLabel)||"暂无商品图")}</div>`}
            <div class="print-note">${a((t==null?void 0:t.sourceLabel)||"图片信息")}</div>
          </section>
          <section>
            <div class="print-section-title">页头区</div>
            ${d(e.headerFields)}
          </section>
          <section class="print-qr-box">
            <div class="print-section-title">${a((i==null?void 0:i.title)||"二维码区")}</div>
            <div class="print-qr-inner">
              ${i?g({value:i.value,size:112,title:i.title,label:i.title}):""}
            </div>
            <div class="print-note">${a((i==null?void 0:i.description)||"扫码查看单据")}</div>
          </section>
        </div>

        ${e.sections.map(l=>`
          <section class="print-section">
            <div class="print-section-title">${a(l.title)}</div>
            ${d(l.fields)}
            ${l.note?`<div class="print-note">${a(l.note)}</div>`:""}
          </section>
        `).join("")}

        ${y(e.imageBlocks.slice(1),e.documentType==="PICKUP_SLIP")}

        ${e.tables.map(I).join("")}
        ${h(e.signatureBlocks)}

        <footer class="print-footer-fields">
          ${e.footerFields.map(l=>`<span>${a(l.label)}：${a(l.value||"—")}</span>`).join("")}
        </footer>
      </div>
    </article>
  `}function k(e,t){const i=t.objectKind==="CUT_PIECE"?"裁片":t.objectKind==="ACCESSORY"?"辅料":"面辅料",l=`/fcs/pda/handover?tab=handout&sewingPickupVersionId=${encodeURIComponent(t.versionId)}`,s=[{title:"款式信息",imageUrl:t.styleImageUrl,imageLabel:`${t.styleCode} ${t.styleName}款式图`,sourceLabel:`${t.styleCode} · ${t.styleName}`,fallbackLabel:"款式图加载失败"},...t.lines.filter(r=>r.objectType!=="裁片").filter((r,u,p)=>p.findIndex(b=>b.objectCode===r.objectCode)===u).map(r=>({title:`${r.objectType}图片`,imageUrl:r.imageUrl,imageLabel:`${r.objectCode} ${r.objectName}正式物料图`,sourceLabel:`${r.objectCode} · ${r.objectName}`,fallbackLabel:"物料图加载失败"}))];return P({buildInput:e,kind:"pickup",sourceId:t.versionId,title:`${i}领料单`,subtitle:"PPIC持单领取；交出仓扫描当前有效版本后记录本次实交，打印本身不改变数量。",headerFields:n([{label:"领料单号",value:t.slipNo,emphasis:!0},{label:"打印版本",value:`${t.versionLabel} · ${t.status==="CURRENT"?"当前有效":"已失效"}`},{label:"执行任务",value:t.taskNo},{label:"生产单",value:t.productionOrderNo},{label:"任务类型",value:t.taskKindLabel},{label:"承接工厂",value:t.factoryName},{label:"任务PPIC",value:t.ppicName},{label:"交出仓库",value:t.warehouseName},{label:"打印时间",value:t.printedAt},{label:"打印人",value:t.printedByPpicName}]),sections:[{sectionId:"quantity-rule",title:"现场核对口径",fields:n([{label:"领料对象",value:i},{label:"应领",value:"执行任务冻结需求"},{label:"此前已领",value:"此前有效交出累计"},{label:"本次可领",value:"应领减此前已领，不小于0"},{label:"本次实领",value:"由交出仓扫码后填写"},{label:"差异",value:"扫码确认时按明细保存"}])}],tables:[{tableId:"ppic-pickup-lines",title:`${i}领料明细`,headers:["对象","编码 / SKU","颜色 / 规格","尺码","部位","应领","此前已领","本次可领","本次实领","差异","单位"],rows:t.lines.map(r=>[`${r.objectType} · ${r.objectName}`,r.objectCode,r.color,r.size,r.part,o(r.requiredQty,r.unit),o(r.previouslyHandedOverQty,r.unit),o(r.availableQty,r.unit),"现场扫码填写","扫码后计算",r.unit]),minRows:5}],qrDescription:"交出仓扫描后核对当前有效版本并记录本次实交",qrValue:f({documentType:"PICKUP_SLIP",sourceId:t.versionId,slipNo:t.slipNo,sourceProductionOrderNo:t.productionOrderNo,targetRoute:l}),signatureBlocks:[{label:"交出人签字",signerRole:t.warehouseName},{label:"领取人签字",signerRole:`任务PPIC ${t.ppicName}`},{label:"复核人签字",signerRole:"仓库复核人"},{label:"现场备注",signerRole:"差异与批次说明"}],footerFields:[{label:"领料单号",value:t.slipNo},{label:"二维码版本",value:t.versionLabel}],returnHref:"/fcs/sewing-outsourcing/tasks",imageBlocks:s})}const S=Object.freeze(Object.defineProperty({__proto__:null,buildPpicPickupSlipPrintDocument:k,renderMaterialSlipTemplate:L},Symbol.toStringTag,{value:"Module"}));export{n as a,P as b,k as c,f as m,S as p,L as r};

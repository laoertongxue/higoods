import{y as r}from"./app-shared-_ZQpMwKQ.js";import{a as m,c}from"./production-order-runtime-store-Deta7oA7.js";import{p as f}from"./production-orders-CzvEBHRB.js";const D="生产单号 / 需求单号 / 售卖类型";function x(e){return Array.from(new Set(e.map(t=>(t??"").trim()).filter(Boolean)))}function O(e){return!!(e&&c.includes(e))}function y(e,t){const o=(t[0]||e).match(/(\d+)$/),d=o?Number(o[1]):1;return c[(Math.max(1,d)-1)%c.length]}function $(e){const t=typeof e=="string"?e:e.productionOrderId||e.productionOrderNo||"";return t?f.find(n=>n.productionOrderId===t||n.productionOrderNo===t)??null:null}function I(e,t){if(O(t))return t;for(const n of e){const o=m.find(d=>d.demandId===n);if(o!=null&&o.saleType)return o.saleType}return null}function N({objectType:e,objectId:t,label:n,className:o="font-mono text-blue-600 hover:underline",relatedProductionOrderNo:d,defaultTab:a,highlightKey:s}){const i=(n||t||"-").trim(),u=(t||"").trim();if(!u||i==="-")return r(i||"-");const p=`
        ${d?`data-related-production-order-no="${r(d)}"`:""}
        ${a?`data-default-tab="${r(a)}"`:""}
        ${s?`data-highlight-key="${r(s)}"`:""}
  `;return e==="MATERIAL"?`
      <button
        type="button"
        class="${o}"
        data-production-object-action="open-material-resource"
        data-object-type="MATERIAL"
        data-object-id="${r(u)}"
        data-material-sku="${r(u)}"
        ${p}
        data-skip-page-rerender="true"
      >${r(i)}</button>
    `:`
    <button
      type="button"
      class="${o}"
      data-production-object-action="open"
      data-object-type="${e}"
      data-object-id="${r(u)}"
      ${p}
      data-skip-page-rerender="true"
    >${r(i)}</button>
  `}function l(e,t,n){return N({objectType:e,objectId:t,className:n})}function g(e){const t=$(e),n=typeof e=="string"?{}:e,o=typeof e=="string"?e:null,d=(n.productionOrderNo||n.productionOrderId||(t==null?void 0:t.productionOrderNo)||(t==null?void 0:t.productionOrderId)||o||"-").trim(),a=x([...n.demandNos??[],n.demandNo,...(t==null?void 0:t.sourceDemandIds)??[],t==null?void 0:t.demandSnapshot.demandId,t==null?void 0:t.demandId]),s=I(a,n.saleType)||(t==null?void 0:t.demandSnapshot.saleType)||y(d,a);return{productionOrderNo:d,demandNos:a.length>0?a:["-"],saleType:s}}function h(e){const t=g(e);return`
    <div class="min-w-[12rem] space-y-1 text-sm leading-5">
      <div><span class="text-xs text-muted-foreground">生产单号</span><div class="font-mono font-medium">${l("PRODUCTION_ORDER",t.productionOrderNo,"text-left text-blue-600 hover:underline")}</div></div>
      <div><span class="text-xs text-muted-foreground">需求单号</span><div class="flex flex-wrap gap-x-1 font-mono text-xs">${t.demandNos.map(n=>l("DEMAND",n,"text-left text-blue-600 hover:underline")).join('<span class="text-muted-foreground">、</span>')}</div></div>
      <div><span class="text-xs text-muted-foreground">售卖类型</span><div class="text-xs text-foreground">${r(t.saleType)}</div></div>
    </div>
  `}export{D as P,h as a,g,N as r};

import{y as s}from"./app-shared-_ZQpMwKQ.js";function x(e,n,t,r,a=""){return`
    <article data-cutting-kpi-card="true" class="inline-flex min-h-10 max-w-full items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm shadow-sm">
      <span class="shrink-0 text-muted-foreground" title="${s(e)}">${s(e)}：</span>
      <span class="min-w-0 truncate font-semibold tabular-nums ${r}" title="${s(String(n))}">${s(String(n))}</span>
      ${a?`<span class="min-w-0 truncate font-mono text-[11px] leading-4 text-muted-foreground" title="${s(a)}">${s(a)}</span>`:""}
      ${t?`<span class="min-w-0 truncate text-[11px] leading-4 text-muted-foreground" title="${s(t)}">${s(t)}</span>`:""}
    </article>
  `}function m(e,n="",t=""){return`
    <section data-cutting-kpi-group="true" ${t} class="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 ${n}">
      ${e}
    </section>
  `}function g(e,n,t="blue"){const r=t==="amber"?"border-amber-200 bg-amber-50 text-amber-700":t==="emerald"?"border-emerald-200 bg-emerald-50 text-emerald-700":t==="rose"?"border-rose-200 bg-rose-50 text-rose-700":"border-blue-200 bg-blue-50 text-blue-700";return`
    <button type="button" ${n} title="${s(e)}" class="inline-flex max-w-[12rem] items-center rounded-full border px-3 py-1 text-xs font-medium ${r}">
      <span class="truncate">${s(e)}</span>
    </button>
  `}function b(e){return e.chips.length?`
    <section class="flex flex-nowrap items-center justify-between gap-2 overflow-hidden rounded-lg border border-dashed bg-muted/20 px-3 py-2">
      <div class="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
        <span class="shrink-0 text-xs font-medium text-muted-foreground">${s(e.summary)}</span>
        ${e.chips.join("")}
      </div>
      <button type="button" ${e.clearAttrs} class="shrink-0 rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
        清除当前视图条件
      </button>
    </section>
  `:""}function $(e,n="",t=""){return`
    <section ${t} data-cutting-filter-shell="true" class="sticky top-2 z-20 rounded-lg border bg-card/95 p-2.5 shadow-sm backdrop-blur ${n}">
      <div class="cutting-filter-single-line">
        ${e}
      </div>
    </section>
  `}function f(e,n="max-h-[62vh]"){return`
    <div class="${n} overflow-auto">
      ${e}
    </div>
  `}function h(e,n,t){const r=t>0?t:20,a=e.length,i=Math.max(1,Math.ceil(a/r)),l=Math.min(Math.max(n,1),i),o=(l-1)*r,c=e.slice(o,o+r);return{items:c,page:l,pageSize:r,total:a,totalPages:i,start:a===0?0:o+1,end:a===0?0:o+c.length}}function u(e,n){if(n<=7)return Array.from({length:n},(i,l)=>l+1);const t=[1],r=Math.max(2,e-1),a=Math.min(n-1,e+1);r>2&&t.push("ellipsis");for(let i=r;i<=a;i+=1)t.push(i);return a<n-1&&t.push("ellipsis"),t.push(n),t}function v(e){const n=e.pageSizeOptions??[20,50,100],t=Math.max(1,Math.ceil(e.total/e.pageSize)),r=Math.min(Math.max(e.page,1),t),a=e.extraAttrs?` ${e.extraAttrs}`:"",i=u(r,t),l=e.total===0?0:(r-1)*e.pageSize+1,o=e.total===0?0:Math.min(e.total,r*e.pageSize),c=e.itemUnit??"条";return`
    <div class="flex flex-col gap-2 border-t px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
      <div class="text-xs text-muted-foreground">
        显示 ${l}-${o} ${s(c)}，共 ${e.total} ${s(c)}，第 ${r} / ${t} 页
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <label class="flex items-center gap-2 text-xs text-muted-foreground">
          <span>每页</span>
          <select ${e.pageSizeAttr}="true"${a} class="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500">
            ${n.map(d=>`<option value="${d}" ${d===e.pageSize?"selected":""}>${d}</option>`).join("")}
          </select>
        </label>
        <div class="flex flex-wrap items-center gap-1">
          <button type="button" ${e.actionAttr}="${e.pageAction}" data-page="${Math.max(1,r-1)}"${a} class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted ${r===1?"pointer-events-none opacity-50":""}">
            上一页
          </button>
          ${i.map(d=>d==="ellipsis"?'<span class="px-1 text-xs text-muted-foreground">…</span>':`<button type="button" ${e.actionAttr}="${e.pageAction}" data-page="${d}"${a} class="rounded-md border px-2.5 py-1 text-xs ${d===r?"border-blue-500 bg-blue-50 text-blue-700":"hover:bg-muted"}">${d}</button>`).join("")}
          <button type="button" ${e.actionAttr}="${e.pageAction}" data-page="${Math.min(t,r+1)}"${a} class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted ${r===t?"pointer-events-none opacity-50":""}">
            下一页
          </button>
        </div>
      </div>
    </div>
  `}export{x as a,b,g as c,$ as d,f as e,v as f,h as p,m as r};

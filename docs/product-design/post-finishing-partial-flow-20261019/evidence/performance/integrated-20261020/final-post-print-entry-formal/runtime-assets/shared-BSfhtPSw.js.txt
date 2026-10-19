import{y as n}from"./app-shared-_ZQpMwKQ.js";function a(e,t="件"){return`${(Number.isFinite(e)?Number(e):0).toLocaleString("zh-CN")} ${t}`}function o(e,t="",r=""){return`
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-foreground">${n(e)}</h1>
        ${t?`<p class="mt-1 text-sm text-muted-foreground">${n(t)}</p>`:""}
      </div>
      ${r}
    </header>
  `}function d(e=""){const t="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50";return e?`<div class="flex flex-wrap gap-2" data-post-finishing-qc-print-actions>
      <a data-nav="/fcs/craft/post-finishing/print?type=QC_ORDER&id=${encodeURIComponent(e)}" class="${t}">打印质检单</a>
      <a data-nav="/fcs/craft/post-finishing/print?type=QC_DETAIL&id=${encodeURIComponent(e)}" class="${t}">打印质检单详情</a>
    </div>`:`<div class="flex flex-wrap gap-2" data-post-finishing-qc-print-actions>
    <button type="button" class="${t}" data-post-finishing-action="open-qc-print-dialog" data-qc-print-type="QC_ORDER" data-skip-page-rerender="true">打印质检单</button>
    <button type="button" class="${t}" data-post-finishing-action="open-qc-print-dialog" data-qc-print-type="QC_DETAIL" data-skip-page-rerender="true">打印质检单详情</button>
  </div>`}function i(e,t,r){return`
    <article class="rounded-lg border bg-card px-4 py-3">
      <div class="text-xs text-muted-foreground">${n(e)}</div>
      <div class="mt-2 text-2xl font-semibold text-foreground">${n(t)}</div>
      <div class="mt-1 text-xs text-muted-foreground">${n(r)}</div>
    </article>
  `}function c(e,t){return`
    <section class="rounded-lg border bg-card">
      <header class="border-b px-4 py-3">
        <h2 class="text-sm font-semibold">${n(e)}</h2>
      </header>
      <div class="p-4">${t}</div>
    </section>
  `}function l(e){return`<span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${e.includes("废弃")?"border-slate-200 bg-slate-100 text-slate-600":e.includes("差异")?"border-rose-200 bg-rose-50 text-rose-700":e.includes("完成")||e.includes("已回写")?"border-emerald-200 bg-emerald-50 text-emerald-700":e.includes("中")?"border-blue-200 bg-blue-50 text-blue-700":"border-amber-200 bg-amber-50 text-amber-700"}">${n(e)}</span>`}function p(e,t,r=!1){return r?`<button type="button" class="rounded-md border px-2 py-1 text-xs opacity-50" disabled>${n(e)}</button>`:`<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${n(t)}">${n(e)}</button>`}export{l as a,d as b,p as c,c as d,i as e,a as f,o as r};

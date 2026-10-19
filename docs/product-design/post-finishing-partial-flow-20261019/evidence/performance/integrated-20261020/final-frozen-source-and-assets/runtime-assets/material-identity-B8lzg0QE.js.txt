import{y as e}from"./app-shared-_ZQpMwKQ.js";function u(t,l,a){return t?`
    <img
      src="${e(t)}"
      alt="${e(l)}"
      class="${a} shrink-0 rounded-md border bg-slate-50 object-cover"
      loading="lazy"
    />
  `:`
      <div class="${a} flex shrink-0 items-center justify-center rounded-md border bg-slate-50 text-[10px] font-medium text-slate-400">
        暂无图
      </div>
    `}function f(t,l={}){const a=t.materialSku||"待补面料 SKU",r=t.materialName||t.materialLabel||"",o=!!(r&&r!==a),s=t.materialColor||"待补",i=t.materialAlias||"技术包未维护别名",c=l.imageSizeClass||(l.compact?"h-10 w-10":"h-12 w-12"),d=t.materialUnit||"",n=[t.materialCategory||"",d?`单位：${d}`:""].filter(Boolean).join(" · "),m=o?`面料 SKU：${a}；面料名称：${r}`:`面料 SKU：${a}`;return`
    <div class="flex w-full min-w-0 max-w-full items-start gap-2">
      ${u(t.materialImageUrl,i,c)}
      <div class="min-w-0 flex-1 overflow-hidden">
        <div class="truncate whitespace-nowrap font-medium text-foreground" data-material-identity-name="true" title="${e(m)}">${e(a)}${o?` <span class="font-normal text-muted-foreground">${e(r)}</span>`:""}</div>
        <div class="mt-1 truncate text-xs text-blue-700" title="${e(`颜色：${s} · 技术包别名：${i}`)}">
          颜色：${e(s)} · 技术包别名：${e(i)}
        </div>
        ${l.showCategory===!1||!n?"":`<div class="mt-1 truncate text-[11px] text-muted-foreground" title="${e(n)}">${e(n)}</div>`}
      </div>
    </div>
  `}export{f as r};

import { escapeHtml } from '../../../utils.ts'
import type { QcShippingPriorityDocument } from '../../../data/fcs/post-finishing-qc-shipping-priority-runtime.ts'

function jakartaTime(value: string): string {
  const instant = new Date(value)
  if (Number.isNaN(instant.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(instant)
}

/** 同一 DTO 用于主单、明细及两套电子打印入口；数量始终是共享需求参考。 */
export function renderPostFinishingQcPriorityBlock(priority?: QcShippingPriorityDocument): string {
  if (!priority) return ''
  const status = priority.ready
    ? `${'★'.repeat(Math.max(0, Math.min(5, priority.stars)))} ${priority.label}`.trim()
    : '需求需核对'
  return `<section class="pf-qc-priority" data-testid="post-finishing-qc-shipping-priority" data-priority-ready="${priority.ready}" aria-label="QC 发货紧急参考">
    <style>
      .pf-qc-priority { margin:4mm 0; padding:2.5mm; border:1.5px solid #111; color:#111; font-size:11px; line-height:1.45; overflow-wrap:anywhere; }
      .pf-qc-priority-head { display:flex; flex-wrap:wrap; justify-content:space-between; gap:2mm; font-weight:700; font-size:13px; }
      .pf-qc-priority p { margin:1.5mm 0 0; }
      .pf-qc-priority table { width:100%; margin-top:2mm; border-collapse:collapse; table-layout:fixed; }
      .pf-qc-priority th,.pf-qc-priority td { border:1px solid #555; padding:1.5mm; text-align:center; overflow-wrap:anywhere; }
      .pf-qc-priority th { font-weight:700; }
      .pf-qc-priority th:first-child { width:27%; }
      .pf-qc-priority th:nth-child(2) { width:19%; }
      .pf-qc-priority tr { break-inside:avoid; }
      .pf-qc-priority thead { display:table-header-group; }
      .pf-qc-priority-meta { font-size:10px; }
      @media print { .pf-qc-priority { background:#fff; color:#000; } }
    </style>
    <div class="pf-qc-priority-head"><span>发货紧急参考：${escapeHtml(status)}</span><span>单位：件</span></div>
    ${priority.ready ? `<p>历史超期 ${priority.overdueTotal} · 今日需发 ${priority.todayTotal} · 明日需发 ${priority.tomorrowTotal}</p>
    <table aria-label="按 SKU 与履约仓的待发需求参考"><thead><tr><th>有效 SKU</th><th>履约仓</th><th>历史超期</th><th>今日需发</th><th>其中今日已超时</th><th>明日需发</th></tr></thead><tbody>${priority.rows.map(row => `<tr><td>${escapeHtml(row.sku)}</td><td>${escapeHtml(row.warehouseName)}</td><td>${row.overdue}</td><td>${row.today}</td><td>${row.todayOverdue}</td><td>${row.tomorrow}</td></tr>`).join('') || '<tr><td colspan="6">本款对应 SKU 近两日无待补需求</td></tr>'}</tbody></table>` : `<p><strong>相关需求、库存或供给信息尚未核对完成，当前不能确定紧急程度。</strong></p>`}
    ${priority.issues.length ? `<ul>${priority.issues.map(issue => `<li>${escapeHtml(issue)}</li>`).join('')}</ul>` : ''}
    <p>以上为本款对应 SKU 扣除库存及后道合格量后的共享需求参考，未分配到本批；多张 QC 单的相同参考数量不可相加。“其中今日已超时”已包含在今日需发数量中。</p>
    <p class="pf-qc-priority-meta">统计截至：${escapeHtml(jakartaTime(priority.asOf))}（雅加达 / Asia/Jakarta） · 规则 V${priority.ruleVersion}</p>
  </section>`
}

// @page-pattern: detail

import { getProductionContract, recordProductionContractPrint } from '../data/fcs/production-contracts.ts'
import { escapeHtml } from '../utils.ts'

function renderMilestoneRows(contractId: string): string {
  const contract = getProductionContract(contractId)
  if (!contract) return ''
  return contract.returnRuleSnapshot.milestones.map((item) => `
    <tr><td>第 ${item.naturalDay} 个自然日内<br/>Within natural day ${item.naturalDay}</td><td>累计不少于 ${Math.round(item.ratio * 100)}%<br/>Cumulative return ≥ ${Math.round(item.ratio * 100)}%</td><td>${item.targetQty} 件<br/>${item.targetQty} pcs</td><td>${escapeHtml(item.deadlineDate)}</td></tr>
  `).join('')
}

export function renderProductionContractPrintPage(): string {
  const contractId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('contractId') || '' : ''
  const contract = getProductionContract(contractId)
  if (!contract) return '<main class="p-8 text-center">未找到生产合同，请返回任务分配工作台重试。</main>'
  const renderSkuRows = (lines: typeof contract.skuLines) => lines.map((line) => `<tr><td>${escapeHtml(line.skuCode)}</td><td>${escapeHtml(line.color)}</td><td>${escapeHtml(line.size)}</td><td>${line.qty} 件</td></tr>`).join('')
  const skuRows = renderSkuRows(contract.skuLines.slice(0, 12))
  const extraSkuLines = contract.skuLines.slice(12)
  const extraSkuPages = Array.from({ length: Math.ceil(extraSkuLines.length / 22) }, (_, pageIndex) => extraSkuLines.slice(pageIndex * 22, pageIndex * 22 + 22))
  const processText = contract.processNames.join(' → ')
  const totalPages = 2 + extraSkuPages.length
  const invalidWatermark = contract.status === 'INVALIDATED' ? '<div class="pointer-events-none absolute inset-0 z-20 flex rotate-[-25deg] items-center justify-center text-7xl font-bold text-red-500/20">已失效 · 历史版本</div>' : ''
  return `
    <main class="mx-auto bg-white text-slate-900 print:m-0 print:w-full" style="width:210mm">
      <section class="relative min-h-[297mm] p-[14mm] print:break-after-page">${invalidWatermark}
        <div class="absolute right-[14mm] top-[10mm] z-30 flex gap-2 print:hidden">${contract.status === 'EFFECTIVE' ? `<button data-production-contract-print="${escapeHtml(contract.contractId)}" class="rounded bg-blue-600 px-4 py-2 text-sm text-white">打印合同</button>` : '<span class="rounded bg-red-50 px-3 py-2 text-sm text-red-700">历史失效版本仅供追溯</span>'}<button onclick="window.close()" class="rounded border px-4 py-2 text-sm">关闭</button></div>
        <header class="border-b-2 border-slate-900 pb-4 text-center"><h1 class="text-2xl font-bold">生产加工合同</h1><p class="mt-1 text-base font-semibold">PRODUCTION PROCESSING CONTRACT</p><p class="mt-3 text-sm">合同编号 Contract No.: ${escapeHtml(contract.contractNo)}　版本 Version: V${contract.version}</p></header>
        <div class="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <p><b>甲方 Party A：</b>HiGood</p><p><b>乙方 Party B：</b>${escapeHtml(contract.factoryName)}</p>
          <p><b>生产单 Production Order：</b>${escapeHtml(contract.productionOrderNo || contract.productionOrderId)}</p><p><b>任务 Task：</b>${escapeHtml(contract.taskNo || contract.runtimeTaskId)}</p>
          <p class="col-span-2"><b>工序链 Process Route：</b>${escapeHtml(processText)}</p>
          <p><b>分配日期 Assignment Date：</b>${escapeHtml(contract.assignmentDate)}</p><p><b>合同数量 Contract Qty：</b>${contract.assignedQty} 件 / pcs</p>
        </div>
        <h2 class="mt-7 text-base font-bold">一、SKU 明细 / SKU Details</h2>
        <table class="mt-2 w-full border-collapse text-sm"><thead><tr><th>SKU</th><th>颜色 Color</th><th>尺码 Size</th><th>数量 Qty</th></tr></thead><tbody>${skuRows}</tbody></table>
        <h2 class="mt-7 text-base font-bold">二、阶段性回货要求 / Staged Return Requirements</h2>
        <p class="mt-2 text-sm leading-6">分配日期为第 1 个自然日；合同仅打印日期，不打印具体时间。The assignment date is natural day 1; deadlines are stated by date without a specific time.</p>
        <table class="mt-3 w-full border-collapse text-sm"><thead><tr><th>期限 Deadline</th><th>累计比例 Ratio</th><th>应回数量 Target</th><th>应回日期 Date</th></tr></thead><tbody>${renderMilestoneRows(contract.contractId)}</tbody></table>
        <p class="mt-8 text-xs leading-5 text-slate-600">本合同用于说明生产范围、分阶段回货日期及应回数量。This contract states the production scope and staged return requirements.</p>
        <p class="absolute bottom-[8mm] left-0 w-full text-center text-xs">${escapeHtml(contract.contractNo)} · V${contract.version} · 1/${totalPages}</p>
      </section>
      <section class="relative min-h-[297mm] p-[14mm] print:break-after-page">${invalidWatermark}
        <header class="border-b pb-3 text-center"><h1 class="text-xl font-bold">生产履约约定与签署页</h1><p>FULFILLMENT TERMS AND SIGNATURES</p></header>
        <div class="mt-8 space-y-5 text-sm leading-7">
          <p><b>1. 回货确认 / Return confirmation</b><br/>回货数量以对应加工厂、对应有效分配记录的到货确认日期为准；质检和复检为流程节点，不改变到货确认日期。Returned quantity is counted by the confirmed arrival date of the matching factory and effective assignment; QC and recheck do not change that date.</p>
          <p><b>2. 提醒与逾期 / Reminders and overdue</b><br/>系统在截止前 1 天、截止当天、逾期后首日分别提醒；同一节点各类提醒仅产生一次，不持续升级或重复提醒。The system reminds one day before, on the due date, and on the first overdue day; each reminder type is issued only once for the same milestone.</p>
          <p><b>3. 变更 / Changes</b><br/>改派、数量/SKU/工序/生效日期变化或任务取消后重派时，旧合同失效留痕，新分配生成新合同，不覆盖旧版本。Reassignment or changes create a new contract while the previous version remains traceable and invalid.</p>
          <p><b>4. 质量流程 / Quality flow</b><br/>成衣回到后道工厂后依次经过到货确认、质检、实际所需工序、复检及后续交接；质检、复检不是生产工序。Garments pass arrival confirmation, QC, required processes, recheck and handover; QC and recheck are not production processes.</p>
          <p><b>5. 异常申报 / Exception reporting</b><br/>发现可能影响交期或质量的异常时，应在 48 小时内向甲方申报并说明影响范围。Exceptions affecting delivery or quality must be reported within 48 hours.</p>
          <p><b>6. 延期、转包与文件效力 / Delay, subcontracting and validity</b><br/>延期处理和处罚按双方已确认的规则执行；未经甲方书面同意不得二次转包；本合同打印件及双方签署页共同构成履约依据。Delay handling follows the agreed rules; secondary subcontracting requires written approval; this contract and signed pages form the fulfillment evidence.</p>
        </div>
        <div class="mt-20 grid grid-cols-2 gap-12 text-sm"><div class="border-t pt-3">甲方签章 Party A<br/><br/>日期 Date：</div><div class="border-t pt-3">乙方签章 Party B<br/><br/>日期 Date：</div></div>
        <p class="absolute bottom-[8mm] left-0 w-full text-center text-xs">${escapeHtml(contract.contractNo)} · V${contract.version} · 2/${totalPages}</p>
      </section>
      ${extraSkuPages.map((lines, index) => `<section class="relative min-h-[297mm] p-[14mm] print:break-after-page">${invalidWatermark}<header class="border-b pb-3"><h1 class="text-lg font-bold">SKU 明细续页 / SKU DETAILS CONTINUED</h1><p class="text-sm">${escapeHtml(contract.contractNo)} · V${contract.version}</p></header><table class="mt-6 w-full border-collapse text-sm"><thead><tr><th>SKU</th><th>颜色 Color</th><th>尺码 Size</th><th>数量 Qty</th></tr></thead><tbody>${renderSkuRows(lines)}</tbody></table><p class="absolute bottom-[8mm] left-0 w-full text-center text-xs">${escapeHtml(contract.contractNo)} · V${contract.version} · ${index + 3}/${totalPages}</p></section>`).join('')}
    </main>
    <style>@page{size:A4;margin:0} table th,table td{border:1px solid #475569;padding:8px;text-align:left} @media print{body{background:white}.print\\:hidden{display:none!important}}</style>
  `
}

export function handleProductionContractPrintEvent(target: HTMLElement): boolean {
  const button = target.closest<HTMLElement>('[data-production-contract-print]')
  if (!button) return false
  const contractId = button.dataset.productionContractPrint || ''
  recordProductionContractPrint(contractId, new Date().toISOString(), '生产计划员')
  window.print()
  return true
}

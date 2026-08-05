// @page-pattern: detail

import { getProductionContract, recordProductionContractPrint } from '../data/fcs/production-contracts.ts'
import { renderProductionContractMasterTemplate } from './print/templates/production-contract-master-template.ts'
import { escapeHtml } from '../utils.ts'

export function renderProductionContractPrintPage(): string {
  const contractId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('contractId') || '' : ''
  const contract = getProductionContract(contractId)
  if (!contract) return '<main class="p-8 text-center">未找到生产合同，请返回任务分配工作台重试。</main>'
  const printedAt = new Date().toISOString()
  const disabled = contract.status !== 'EFFECTIVE'
  return `
    <div class="mx-auto flex w-[210mm] items-center justify-between border-b bg-white px-4 py-3 print:hidden">
      <div><p class="font-semibold">${escapeHtml(contract.contractNo)} · V${contract.version}</p><p class="text-xs text-muted-foreground">合同固定条款与版式读取印尼 SPK 母版；任务字段按当前合同快照填充。</p></div>
      <div class="flex gap-2">${disabled
        ? '<span class="rounded bg-red-50 px-3 py-2 text-sm text-red-700">历史失效版本仅供追溯，不允许打印</span>'
        : `<button data-production-contract-print="${escapeHtml(contract.contractId)}" class="rounded bg-blue-600 px-4 py-2 text-sm text-white">打印合同</button>`}
        <button onclick="window.close()" class="rounded border px-4 py-2 text-sm">关闭</button>
      </div>
    </div>
    ${renderProductionContractMasterTemplate(contract, { printedAt, printedBy: '生产计划员' })}
    <style>@media print{.print\:hidden{display:none!important}}</style>
  `
}

export function handleProductionContractPrintEvent(target: HTMLElement): boolean {
  const button = target.closest<HTMLElement>('[data-production-contract-print]')
  if (!button) return false
  const contractId = button.dataset.productionContractPrint || ''
  const contract = getProductionContract(contractId)
  if (!contract || contract.status !== 'EFFECTIVE') return true
  recordProductionContractPrint(contractId, new Date().toISOString(), '生产计划员')
  window.print()
  return true
}

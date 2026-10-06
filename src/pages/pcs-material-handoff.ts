import { escapeHtml } from '../utils.ts'
import { readPcsMaterialHandoff, materialProcessHandoffPath, type PcsMaterialHandoff } from '../data/pcs-material-handoff.ts'
import { MATERIAL_PROCESS_NAMES } from '../data/pcs-material-rules.ts'
export function processMaterialHandoff(code: 'DYE' | 'PRINT'): PcsMaterialHandoff | null {
  const context = readPcsMaterialHandoff()
  return context?.kind === 'PROCESS' && context.process?.processType === (code === 'DYE' ? 'DYEING' : 'PRINTING') ? context : null
}
export function renderPcsMaterialHandoff(expected: 'PURCHASE' | 'DYE' | 'PRINT'): string {
  try {
    const context = expected === 'PURCHASE' ? readPcsMaterialHandoff() : processMaterialHandoff(expected)
    if (!context || expected === 'PURCHASE' && context.kind !== 'PURCHASE') return ''
    const { target, input, process } = context
    const row = (label: string, value: string) => `<div class="min-w-0"><dt class="text-xs text-slate-500">${escapeHtml(label)}</dt><dd class="mt-1 break-all text-sm">${escapeHtml(value)}</dd></div>`
    return `<section class="m-4 rounded-lg border border-blue-200 bg-blue-50 p-4" data-pcs-material-handoff><div class="flex items-start justify-between gap-4"><div><h2 class="text-sm font-semibold text-blue-900">${context.kind === 'PURCHASE' ? '已带入采购物料' : '已带入加工目标'}</h2><p class="mt-1 text-xs text-slate-600">${context.kind === 'PURCHASE' ? '请在采购管理确认采购业务来源、数量与供应商。' : '请进入物料加工计划填写数量、加工工厂和计划日期。'}尚未创建单据。</p></div>${context.kind==='PROCESS'?`<button class="shrink-0 rounded bg-blue-600 px-3 py-1.5 text-xs text-white" data-nav="${escapeHtml(materialProcessHandoffPath(target.materialSkuId))}">填写物料加工计划</button>`:''}<button class="shrink-0 rounded border bg-white px-3 py-1.5 text-xs text-blue-700" data-nav="${escapeHtml(context.returnPath)}">返回物料</button></div><dl class="mt-4 grid gap-3 md:grid-cols-3">${input ? row('直接投入 SKU', input.materialSkuCode) : ''}${row('目标 SKU', target.materialSkuCode)}${row('物料名称 / 主单位', `${target.materialName} / ${target.mainUnit || target.pricingUnit}`)}${process ? row('加工定义 / 资料版本', `${MATERIAL_PROCESS_NAMES[process.processType]} · ${process.processDefinitionId} / ${process.processVersionId}`) : ''}</dl></section>`
  } catch (error) {
    return `<div class="m-4 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">${escapeHtml(error instanceof Error ? error.message : '物料来源无法读取，请返回物料档案重试。')}</div>`
  }
}

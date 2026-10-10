import { getGarmentBomMaterialType, isSimpleBomMaterialSku } from '../data/pcs-engineering-bom-material-resolver.ts'
import { technicalListState as listState, technicalLogModal, technicalAssignmentFeedback, technicalImagePreview, renderTechnicalImagePreview, renderPcsTechnicalDataTechPackListPage } from './pcs-technical-data-tech-pack-list.ts'
export { renderPcsTechnicalDataTechPackListPage } from './pcs-technical-data-tech-pack-list.ts'
import { runPcsRecordCommand } from '../data/pcs-record-runtime.ts'
// @page-pattern: list
// 技术资料统一结果页：技术包、BOM 与价格。
// 技术包列表委托轻量入口，统一复用 renderStandardListPage、renderStandardListTable、renderTablePagination。

import { paginateStandardListRows } from '../components/ui/list-table-model.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import { ensureEngineeringMasterDemoData } from '../data/pcs-engineering-master-view-model.ts'
import { listSkuArchivesByStyleId } from '../data/pcs-sku-archive-repository.ts'
import { assignTechnicalPackResponsible, getTechnicalDataVersionContent } from '../data/pcs-technical-data-version-repository.ts'
import {
  getEngineeringBomPricingPlan,
  getEngineeringBomVersionById,
  listEngineeringBomPricingPlans,
  listEngineeringBomVersions,
  resolveEngineeringBomPricingPlan,
  saveEngineeringBomPricingPlan,
  saveEngineeringBomVersion,
} from '../data/pcs-engineering-bom-repository.ts'
import {
  saveEngineeringMasterBomVersion,
} from '../data/pcs-engineering-master-repository.ts'
import {
  getMaterialStandardCost,
  listMaterialArchives,
  listMaterialSkuRecordsByMaterialId,
  isMaterialSkuAvailableForNewUse,
} from '../data/pcs-material-archive-repository.ts'
import { resolveEngineeringBomDraft } from '../data/pcs-engineering-bom-pricing.ts'
import type {
  EngineeringBomCustomCostDecision,
  EngineeringBomCustomCostDraft,
  EngineeringBomMaterialLineDraft,
  EngineeringBomOwnerStage,
  EngineeringBomPricingPlanRecord,
  EngineeringBomVersionRecord,
} from '../data/pcs-engineering-bom-types.ts'
import { escapeHtml } from '../utils.ts'

const PAGE_SIZE_OPTIONS = [10, 20, 50]
const bomListState = { currentPage: 1, pageSize: 10 }
let bomFeedback = { message: '', ok: true }

export function renderPcsTechnicalDataBomPricingPage(): string {
  ensureEngineeringMasterDemoData()
  const rows = listEngineeringBomPricingPlans()
  const paging = paginateStandardListRows(rows, bomListState.currentPage, bomListState.pageSize)
  bomListState.currentPage = paging.currentPage
  const versions = listEngineeringBomVersions()
  return `<div class="space-y-4 p-4" data-pcs-technical-data-page data-bom-plan-list><header><h1 class="text-xl font-semibold">BOM 与价格</h1><p class="mt-1 text-sm text-slate-500">一张业务单据对应一份整款方案；各颜色分别维护物料，自定义费用只在整款方案中维护一次。</p></header><section class="overflow-hidden rounded-lg border bg-white"><div class="overflow-x-auto"><table class="w-full min-w-[1180px] text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="px-4 py-3">款式</th><th class="px-4 py-3">业务来源</th><th class="px-4 py-3">状态</th><th class="px-4 py-3">颜色物料方案</th><th class="px-4 py-3">物料行</th><th class="px-4 py-3">整款费用</th><th class="px-4 py-3">买手</th><th class="px-4 py-3">更新时间</th><th class="px-4 py-3">操作</th></tr></thead><tbody>${paging.rows.length ? paging.rows.map((plan) => { const ownerVersions = versions.filter((item) => item.ownerStage === plan.ownerStage && item.ownerId === plan.ownerId); const materialCount = ownerVersions.reduce((total, item) => total + item.materialLines.length, 0); return `<tr class="border-t"><td class="px-4 py-3"><div class="flex items-center gap-3"><button type="button" class="h-12 w-12 overflow-hidden rounded border" data-tech-data-action="open-image" data-image-url="${escapeHtml(plan.styleImageUrl)}" data-image-title="${escapeHtml(plan.styleName)}"><img class="h-full w-full object-cover" src="${escapeHtml(plan.styleImageUrl)}" alt="${escapeHtml(plan.styleName)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="text-[10px] text-slate-500">图片失败</span></button><div><p class="font-medium">${escapeHtml(plan.styleName)}</p><p class="text-xs text-slate-500">${escapeHtml(plan.styleCode)}</p></div></div></td><td class="px-4 py-3"><p>${ownerStageText(plan.ownerStage)}</p><p class="text-xs text-slate-500">${escapeHtml(plan.ownerCode)}</p></td><td class="px-4 py-3">${pricingPlanStatusText(plan.status)}</td><td class="px-4 py-3">${ownerVersions.length} 个颜色</td><td class="px-4 py-3">${materialCount}</td><td class="px-4 py-3">${customCostDecisionText(plan)}</td><td class="px-4 py-3">${escapeHtml(plan.buyerName)}</td><td class="px-4 py-3">${escapeHtml(plan.updatedAt)}</td><td class="px-4 py-3"><a class="text-blue-700" href="${pricingPlanHref(plan.ownerStage, plan.ownerId)}">查看整款方案</a></td></tr>` }).join('') : '<tr><td colspan="9" class="px-4 py-12 text-center text-slate-500">暂无 BOM 与价格方案；创建设计改款任务或生产准备单后自动建立。</td></tr>'}</tbody></table></div><div class="border-t p-3">${renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: 'tech-data', pageSizeOptions: PAGE_SIZE_OPTIONS })}</div></section>${renderTechnicalImagePreview()}</div>`
}

function allMaterialSkuOptions() {
  return listMaterialArchives().filter((item) => item.status === 'ACTIVE' && item.kind !== 'parts').flatMap((material) =>
    listMaterialSkuRecordsByMaterialId(material.materialId)
      .filter(isMaterialSkuAvailableForNewUse)
      .map((sku) => ({ material, sku, standardCost: getMaterialStandardCost(sku.materialSkuId) })),
  )
}

function ownerStageText(stage: EngineeringBomOwnerStage): string {
  return ({ INDEPENDENT_SAMPLING: '设计改款', ENGINEERING_MASTER: '生产准备单', TECH_PACK_DRAFT: '技术包草稿' })[stage]
}

function pricingPlanStatusText(status: EngineeringBomPricingPlanRecord['status']): string {
  return ({
    DRAFT: '资料准备中',
    HANDED_OFF: '已交给跟单',
    COMPLETED_CONFIRMED: '已完成确认',
    PUBLISHED_SNAPSHOT: '已形成正式快照',
  })[status]
}

function customCostDecisionText(plan: EngineeringBomPricingPlanRecord): string {
  if (plan.customCostDecision === 'UNDECIDED') return '待买手确认'
  if (plan.customCostDecision === 'NO_CUSTOM_COST') return '本次无自定义费用'
  return `${plan.customCosts.length} 项 · Rp ${plan.customCosts.reduce((total, item) => total + item.amountIdr, 0).toLocaleString('id-ID')}`
}

function pricingPlanHref(ownerStage: EngineeringBomOwnerStage, ownerId: string): string {
  return `/pcs/technical-data/bom-pricing/owner/${encodeURIComponent(ownerStage)}/${encodeURIComponent(ownerId)}`
}

function renderBomMaterialRows(
  record: EngineeringBomVersionRecord,
  resolvedById: Map<string, ReturnType<typeof resolveEngineeringBomDraft>['materialLines'][number]>,
  options: ReturnType<typeof allMaterialSkuOptions>,
  editable: boolean,
): string {
  const styleSkus = listSkuArchivesByStyleId(record.styleId).filter((sku) => record.applicableSkuIds.includes(sku.skuId))
  return record.materialLines.map((line) => {
    const resolvedLine = resolvedById.get(line.bomItemId || line.materialSkuId)
    const skuInfo = options.find((item) => item.sku.materialSkuId === line.materialSkuId)
    const simpleMaterial = isSimpleBomMaterialSku(line.materialSkuId)
    const disabled = editable ? '' : 'disabled'
    const skuScope = new Set(line.applicableSkuIds?.length ? line.applicableSkuIds : record.applicableSkuIds)
    return `<tr class="border-t align-top" data-bom-line="${escapeHtml(line.bomItemId || '')}">
      <td class="p-3"><div class="flex items-center gap-2"><button type="button" class="h-12 w-12 overflow-hidden rounded border" data-tech-data-action="open-image" data-image-url="${escapeHtml(resolvedLine?.materialImageUrl || skuInfo?.sku.skuImageUrl || '')}" data-image-title="${escapeHtml(resolvedLine?.materialName || skuInfo?.sku.materialName || line.materialSkuId)}"><img class="h-full w-full object-cover" src="${escapeHtml(resolvedLine?.materialImageUrl || skuInfo?.sku.skuImageUrl || '')}" alt="${escapeHtml(resolvedLine?.materialName || skuInfo?.sku.materialName || line.materialSkuId)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="text-[10px] text-slate-500">图片失败</span></button><div><p class="font-medium">${escapeHtml(resolvedLine?.materialName || skuInfo?.sku.materialName || line.materialSkuId)}</p><p class="text-xs text-slate-500">${escapeHtml(resolvedLine?.materialSkuCode || skuInfo?.sku.materialSkuCode || line.materialSkuId)}</p><p class="text-xs text-slate-400">${escapeHtml(line.materialType || '')} ${escapeHtml(line.specification || '')}</p></div></div></td>
      <td class="p-3"><input class="h-9 w-24 rounded border px-2" type="number" min="0.0001" step="0.0001" value="${line.usage}" data-bom-line-field="usage" ${disabled}> ${escapeHtml(line.usageUnit)}</td>
      <td class="p-3"><input class="h-9 w-20 rounded border px-2" type="number" min="1" step="1" value="${line.sampleQuantity}" data-bom-line-field="sampleQuantity" ${disabled}></td>
      <td class="p-3"><input class="h-9 w-20 rounded border px-2" type="number" min="0" max="99.99" step="0.01" value="${line.lossRate * 100}" data-bom-line-field="lossRate" ${disabled}>%</td>
      <td class="p-3">${resolvedLine && resolvedLine.conversionToPricingUnit > 0 ? `${resolvedLine.totalRequirementQuantity.toFixed(4)} ${escapeHtml(resolvedLine.pricingUnit)}` : '待校验单位换算'}</td>
      <td class="p-3">${resolvedLine && resolvedLine.standardUnitPriceCny !== null ? `¥${resolvedLine.standardUnitPriceCny.toFixed(4)}` : '<span class="text-red-600">标准单价失效</span>'}<p class="mt-1 max-w-48 text-xs text-slate-500">${escapeHtml(resolvedLine?.standardCostMessage || '')}</p></td>
      <td class="p-3">${simpleMaterial ? '—' : `<input type="checkbox" data-bom-line-field="printRequirement" ${line.printRequirement === '是' ? 'checked' : ''} ${disabled}>`}</td>
      <td class="p-3">${simpleMaterial ? '—' : `<input type="checkbox" data-bom-line-field="dyeRequirement" ${line.dyeRequirement === '是' ? 'checked' : ''} ${disabled}>`}</td>
      <td class="p-3"><input type="checkbox" data-bom-line-field="purchaseRequirement" ${line.purchaseRequirement === '是' ? 'checked' : ''} ${disabled}></td>
      <td class="p-3 text-xs">${styleSkus.length ? `<div class="max-h-24 space-y-1 overflow-auto">${styleSkus.map((sku) => `<label class="flex gap-1"><input type="checkbox" data-bom-sku-scope value="${escapeHtml(sku.skuId)}" ${skuScope.has(sku.skuId) ? 'checked' : ''} ${disabled}><span>${escapeHtml(sku.skuCode)}</span></label>`).join('')}</div>` : '待确认 SKU'}</td>
      <td class="p-3">${editable ? '<button class="text-red-600" data-tech-data-action="bom-remove-material">删除</button>' : '已锁定'}</td>
    </tr>
    <tr class="bg-slate-50/70" data-bom-line-detail="${escapeHtml(line.bomItemId || '')}"><td colspan="11" class="p-3"><div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      ${simpleMaterial ? '' : `
      <label class="text-xs text-slate-500">印花要求<input class="mt-1 h-9 w-full rounded border bg-white px-2 text-sm text-slate-800" value="${escapeHtml(line.printRequirementText || '')}" data-bom-line-field="printRequirementText" ${disabled}></label>
      <label class="text-xs text-slate-500">染色要求<input class="mt-1 h-9 w-full rounded border bg-white px-2 text-sm text-slate-800" value="${escapeHtml(line.dyeRequirementText || '')}" data-bom-line-field="dyeRequirementText" ${disabled}></label>
      <label class="text-xs text-slate-500">水溶要求<input class="mt-1 h-9 w-full rounded border bg-white px-2 text-sm text-slate-800" value="${escapeHtml(line.waterSolubleRequirementText || '无')}" data-bom-line-field="waterSolubleRequirementText" ${disabled}></label>
      <label class="text-xs text-slate-500">印花面<select class="mt-1 h-9 w-full rounded border bg-white px-2 text-sm text-slate-800" data-bom-line-field="printSide" ${disabled}>${['无', '正面', '反面', '双面'].map((value) => `<option value="${value}" ${line.printSide === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      <label class="text-xs text-slate-500">关联花型成果<input class="mt-1 h-9 w-full rounded border bg-white px-2 text-sm text-slate-800" placeholder="多个成果编号用逗号分隔" value="${escapeHtml((line.linkedPatternResultIds || []).join(','))}" data-bom-line-field="linkedPatternResultIds" ${disabled}></label>
      <label class="text-xs text-slate-500">工艺编码<input class="mt-1 h-9 w-full rounded border bg-white px-2 text-sm text-slate-800" value="${escapeHtml(line.processCode || '')}" data-bom-line-field="processCode" ${disabled}></label>
      `}
      <label class="text-xs text-slate-500 xl:col-span-4">备注<input class="mt-1 h-9 w-full rounded border bg-white px-2 text-sm text-slate-800" value="${escapeHtml(line.remark || '')}" data-bom-line-field="remark" ${disabled}></label>
    </div></td></tr>`
  }).join('')
}

export function renderPcsTechnicalDataBomPricingPlanPage(ownerStage: EngineeringBomOwnerStage, ownerId: string): string {
  const plan = getEngineeringBomPricingPlan(ownerStage, ownerId)
  if (!plan) return '<div class="p-6 text-sm text-slate-500">未找到整款 BOM 与价格方案。</div>'
  const versions = listEngineeringBomVersions().filter((item) => item.ownerStage === ownerStage && item.ownerId === ownerId)
  const editable = plan.status === 'DRAFT' && !plan.editingLockedAt
  let resolved: ReturnType<typeof resolveEngineeringBomPricingPlan> | null = null
  try { resolved = resolveEngineeringBomPricingPlan(ownerStage, ownerId) } catch { resolved = null }
  return `<div class="space-y-4 p-4" data-pcs-technical-data-page data-bom-plan-detail="${escapeHtml(plan.pricingPlanId)}">
    <header class="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-white p-4"><div class="flex items-center gap-3"><button type="button" class="h-16 w-16 overflow-hidden rounded border" data-tech-data-action="open-image" data-image-url="${escapeHtml(plan.styleImageUrl)}" data-image-title="${escapeHtml(plan.styleName)}"><img class="h-full w-full object-cover" src="${escapeHtml(plan.styleImageUrl)}" alt="${escapeHtml(plan.styleName)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="text-[10px] text-slate-500">图片失败</span></button><div><h1 class="text-xl font-semibold">${escapeHtml(plan.styleName)} · 整款 BOM 与价格</h1><p class="mt-1 text-sm text-slate-500">${escapeHtml(plan.styleCode)} · ${ownerStageText(plan.ownerStage)} ${escapeHtml(plan.ownerCode)}</p><p class="mt-1 text-xs text-slate-500">${pricingPlanStatusText(plan.status)} · 买手：${escapeHtml(plan.buyerName)}</p></div></div><a class="rounded border px-4 py-2 text-sm" href="/pcs/technical-data/bom-pricing">返回列表</a></header>
    ${bomFeedback.message ? `<p class="rounded border px-3 py-2 text-sm ${bomFeedback.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}">${escapeHtml(bomFeedback.message)}</p>` : ''}
    <section class="rounded-lg border bg-white"><header class="border-b p-4"><h2 class="font-semibold">颜色物料方案</h2><p class="mt-1 text-xs text-slate-500">每个目标颜色单独维护物料；颜色物料页只保存物料，不单独确认。</p></header><div class="overflow-x-auto"><table class="w-full min-w-[800px] text-sm"><thead class="bg-slate-50 text-left text-xs text-slate-500"><tr><th class="p-3">目标颜色</th><th class="p-3">颜色版本</th><th class="p-3">物料行</th><th class="p-3">标准单价状态</th><th class="p-3">操作</th></tr></thead><tbody>${versions.map((version) => { let priceState = '待维护'; try { const colorResolved = resolveEngineeringBomDraft({ versionStatus: version.versionStatus, materialLines: version.materialLines, customCosts: [] }); priceState = colorResolved.materialLines.some((line) => line.priceStatus === '标准单价失效') ? '标准单价失效' : version.materialLines.length ? '有效' : '待维护' } catch { priceState = '标准单价失效' } return `<tr class="border-t"><td class="p-3 font-medium">${escapeHtml(version.productColor)}</td><td class="p-3">${escapeHtml(version.versionCode)}</td><td class="p-3">${version.materialLines.length}</td><td class="p-3 ${priceState === '标准单价失效' ? 'text-red-600' : ''}">${priceState}</td><td class="p-3"><a class="text-blue-700" href="/pcs/technical-data/bom-pricing/${escapeHtml(version.bomDraftVersionId)}">维护该颜色物料</a></td></tr>` }).join('')}</tbody></table></div></section>
    <section class="rounded-lg border bg-white"><header class="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 class="font-semibold">整款自定义费用（IDR）</h2><p class="mt-1 text-xs text-slate-500">例如车位费；统一作用于整个 SPU，只维护、计算一次。</p></div>${editable ? '<button class="rounded border px-4 py-2 text-sm text-blue-700" data-tech-data-action="bom-plan-add-cost">新增费用</button>' : '<span class="text-sm text-slate-500">已锁定，只读</span>'}</header><div class="p-4"><label class="mb-4 block max-w-md text-sm"><span class="mb-1 block text-slate-600">本次费用情况</span><select class="h-9 w-full rounded border px-3" data-tech-data-field="bom-custom-cost-decision" ${editable ? '' : 'disabled'}><option value="UNDECIDED" ${plan.customCostDecision === 'UNDECIDED' ? 'selected' : ''}>请选择</option><option value="NO_CUSTOM_COST" ${plan.customCostDecision === 'NO_CUSTOM_COST' ? 'selected' : ''}>本次无自定义费用</option><option value="HAS_CUSTOM_COST" ${plan.customCostDecision === 'HAS_CUSTOM_COST' ? 'selected' : ''}>本次有自定义费用</option></select></label><div class="divide-y rounded border">${plan.customCosts.length ? plan.customCosts.map((cost) => `<div class="grid gap-3 p-3 md:grid-cols-[1fr_220px_1fr_80px]" data-bom-plan-cost="${escapeHtml(cost.customCostId || '')}"><input class="h-9 rounded border px-3" value="${escapeHtml(cost.title)}" placeholder="费用名称" data-bom-plan-cost-field="title" ${editable ? '' : 'disabled'}><div class="flex items-center gap-2"><span>Rp</span><input class="h-9 w-full rounded border px-3" type="number" min="1" step="1" value="${cost.amountIdr}" data-bom-plan-cost-field="amountIdr" ${editable ? '' : 'disabled'}></div><input class="h-9 rounded border px-3" value="${escapeHtml(cost.note || '')}" placeholder="备注" data-bom-plan-cost-field="note" ${editable ? '' : 'disabled'}>${editable ? '<button class="text-sm text-red-600" data-tech-data-action="bom-plan-remove-cost">删除</button>' : '<span class="text-sm text-slate-500">已锁定</span>'}</div>`).join('') : '<p class="p-6 text-center text-sm text-slate-500">暂无自定义费用明细。</p>'}</div></div></section>
    <section class="grid gap-3 md:grid-cols-5"><article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">整款物料成本</p><p class="mt-2 font-semibold">${resolved ? `¥ ${resolved.resolved.cost.materialCostCny.toFixed(2)}` : '待校验'}</p></article><article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">整款自定义费用</p><p class="mt-2 font-semibold">${resolved ? `Rp ${resolved.resolved.cost.customCostIdr.toLocaleString('id-ID')}` : '待校验'}</p></article><article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">系统最新汇率</p><p class="mt-2 font-semibold">${resolved ? `1 CNY = ${resolved.resolved.cost.exchangeRateIdrPerCny.toLocaleString('id-ID')} IDR` : '待校验'}</p></article><article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">综合成本 CNY</p><p class="mt-2 font-semibold text-blue-700">${resolved ? `¥ ${resolved.resolved.cost.comprehensiveCostCny.toFixed(2)}` : '待校验'}</p></article><article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">综合成本 IDR</p><p class="mt-2 font-semibold text-blue-700">${resolved ? `Rp ${resolved.resolved.cost.comprehensiveCostIdr.toLocaleString('id-ID')}` : '待校验'}</p></article></section>
    ${editable ? '<div class="flex justify-end rounded-lg border bg-white p-4"><button class="rounded bg-blue-600 px-4 py-2 text-sm text-white" data-tech-data-action="bom-plan-save-costs">保存整款费用情况</button></div>' : ''}
    <p class="rounded bg-blue-50 px-3 py-2 text-sm text-blue-700">整款确认仍在所属设计改款任务、生产准备单或技术包审核流程中完成；本页不提供绕过业务流程的确认入口。</p>${renderTechnicalImagePreview()}
  </div>`
}

export function renderPcsTechnicalDataBomPricingDetailPage(versionId: string): string {
  const record = getEngineeringBomVersionById(versionId)
  if (!record) return '<div class="p-6 text-sm text-slate-500">未找到颜色物料方案。</div>'
  const editable = record.versionStatus === 'DRAFT' && !record.editingLockedAt
  let resolved: ReturnType<typeof resolveEngineeringBomDraft> | null = null
  try { resolved = resolveEngineeringBomDraft({ versionStatus: record.versionStatus, materialLines: record.materialLines, customCosts: [] }) } catch { resolved = null }
  const resolvedById = new Map((resolved?.materialLines || []).map((line) => [line.bomItemId || line.materialSkuId, line]))
  const options = allMaterialSkuOptions()
  const siblingVersions = listEngineeringBomVersions().filter((item) => item.ownerStage === record.ownerStage && item.ownerId === record.ownerId)
  return `<div class="space-y-4 p-4" data-pcs-technical-data-page data-bom-version-detail="${escapeHtml(record.bomDraftVersionId)}">
    <header class="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-white p-4"><div class="flex items-center gap-3"><button type="button" class="h-16 w-16 overflow-hidden rounded border" data-tech-data-action="open-image" data-image-url="${escapeHtml(record.styleImageUrl)}" data-image-title="${escapeHtml(record.styleName)}"><img class="h-full w-full object-cover" src="${escapeHtml(record.styleImageUrl)}" alt="${escapeHtml(record.styleName)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="text-[10px] text-slate-500">图片失败</span></button><div><h1 class="text-xl font-semibold">${escapeHtml(record.styleName)} · ${escapeHtml(record.productColor)}</h1><p class="mt-1 text-sm text-slate-500">${escapeHtml(record.styleCode)} · ${escapeHtml(record.versionCode)} · ${ownerStageText(record.ownerStage)} ${escapeHtml(record.ownerCode)}</p><p class="mt-1 text-xs text-slate-500">颜色物料方案 · 买手：${escapeHtml(record.buyerName)}</p></div></div><a class="rounded border px-4 py-2 text-sm" href="${pricingPlanHref(record.ownerStage, record.ownerId)}">返回整款方案</a></header>
    <nav class="flex flex-wrap gap-2 rounded-lg border bg-white p-3" aria-label="同一整款方案的颜色物料">${siblingVersions.map((item) => `<a class="rounded-full border px-3 py-1 text-sm ${item.bomDraftVersionId === record.bomDraftVersionId ? 'border-blue-600 bg-blue-50 text-blue-700' : 'text-slate-600'}" href="/pcs/technical-data/bom-pricing/${escapeHtml(item.bomDraftVersionId)}">${escapeHtml(item.productColor)} · ${escapeHtml(item.versionCode)}</a>`).join('')}</nav>
    ${bomFeedback.message ? `<p class="rounded border px-3 py-2 text-sm ${bomFeedback.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}">${escapeHtml(bomFeedback.message)}</p>` : ''}
    <section class="rounded-lg border bg-white"><header class="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 class="font-semibold">${escapeHtml(record.productColor)} · 物料方案</h2><p class="mt-1 text-xs text-slate-500">本页只维护该颜色的物料、用量、打样数量、损耗及工艺要求；整款费用在上一级方案维护。</p></div>${editable ? `<div class="flex gap-2"><select class="h-9 min-w-72 rounded border px-3 text-sm" data-tech-data-field="bom-material-sku"><option value="">选择物料 SKU</option>${options.map(({ sku, standardCost }) => `<option value="${escapeHtml(sku.materialSkuId)}">${escapeHtml(sku.materialName)} · ${escapeHtml(sku.specName)} · ${escapeHtml(sku.materialSkuCode)} · ${standardCost.totalStandardCny === null ? '成本待维护' : `¥${standardCost.totalStandardCny.toFixed(4)}/${escapeHtml(standardCost.pricingUnit)}`}</option>`).join('')}</select><button class="rounded bg-blue-600 px-4 py-2 text-sm text-white" data-tech-data-action="bom-add-material">加入物料</button></div>` : '<span class="text-sm text-slate-500">已锁定，只读</span>'}</header>
      <div class="overflow-x-auto"><table class="w-full min-w-[1500px] text-sm"><thead class="bg-slate-50 text-left text-xs text-slate-500"><tr><th class="p-3">物料</th><th class="p-3">单位用量</th><th class="p-3">打样数量</th><th class="p-3">损耗率</th><th class="p-3">总需求量</th><th class="p-3">标准单价</th><th class="p-3">印花</th><th class="p-3">染色</th><th class="p-3">需采购</th><th class="p-3">适用 SKU</th><th class="p-3">操作</th></tr></thead><tbody>${record.materialLines.length ? renderBomMaterialRows(record, resolvedById, options, editable) : '<tr><td colspan="11" class="p-10 text-center text-slate-500">暂无物料。买手可从物料档案选择有有效标准单价的 SKU。</td></tr>'}</tbody></table></div>
      ${editable ? '<footer class="flex justify-end border-t p-4"><button class="rounded bg-blue-600 px-4 py-2 text-sm text-white" data-tech-data-action="bom-save">保存该颜色物料</button></footer>' : ''}
    </section>
    <section class="grid gap-3 md:grid-cols-3"><article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">该颜色物料成本</p><p class="mt-2 font-semibold">${resolved ? `¥ ${resolved.cost.materialCostCny.toFixed(2)}` : '待校验'}</p></article><article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">系统最新汇率</p><p class="mt-2 font-semibold">${resolved ? `1 CNY = ${resolved.cost.exchangeRateIdrPerCny.toLocaleString('id-ID')} IDR` : '待校验'}</p></article><article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">整款费用</p><p class="mt-2"><a class="text-blue-700" href="${pricingPlanHref(record.ownerStage, record.ownerId)}">返回整款方案统一维护</a></p></article></section>${renderTechnicalImagePreview()}
  </div>`
}

function rerender(): void {
  const host = document.querySelector<HTMLElement>('[data-pcs-technical-data-page]')
  if (!host) return
  const planMatch = /^\/pcs\/technical-data\/bom-pricing\/owner\/([^/]+)\/([^/]+)$/.exec(window.location.pathname)
  const bomMatch = /^\/pcs\/technical-data\/bom-pricing\/([^/]+)$/.exec(window.location.pathname)
  if (planMatch) host.outerHTML = renderPcsTechnicalDataBomPricingPlanPage(decodeURIComponent(planMatch[1]) as EngineeringBomOwnerStage, decodeURIComponent(planMatch[2]))
  else if (bomMatch) host.outerHTML = renderPcsTechnicalDataBomPricingDetailPage(bomMatch[1])
  else if (window.location.pathname === '/pcs/technical-data/bom-pricing') host.outerHTML = renderPcsTechnicalDataBomPricingPage()
  else host.outerHTML = renderPcsTechnicalDataTechPackListPage()
}

function currentBomPlanRoute(): { ownerStage: EngineeringBomOwnerStage; ownerId: string } | null {
  if (typeof window === 'undefined') return null
  const match = /^\/pcs\/technical-data\/bom-pricing\/owner\/([^/]+)\/([^/]+)$/.exec(window.location.pathname)
  return match ? { ownerStage: decodeURIComponent(match[1]) as EngineeringBomOwnerStage, ownerId: decodeURIComponent(match[2]) } : null
}

function currentBomVersionId(): string {
  if (typeof window === 'undefined') return ''
  return /^\/pcs\/technical-data\/bom-pricing\/([^/]+)$/.exec(window.location.pathname)?.[1] || ''
}

function collectBomLines(record: EngineeringBomVersionRecord): EngineeringBomMaterialLineDraft[] {
  const rows = [...document.querySelectorAll<HTMLElement>('[data-bom-line]')]
  return rows.map((row) => {
    const bomItemId = row.dataset.bomLine || ''
    const current = record.materialLines.find((line) => line.bomItemId === bomItemId)
    if (!current) throw new Error('BOM 物料行不存在，请刷新页面。')
    const detail = document.querySelector<HTMLElement>(`[data-bom-line-detail="${CSS.escape(bomItemId)}"]`)
    const field = (name: string) => row.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-bom-line-field="${name}"]`)
      || detail?.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-bom-line-field="${name}"]`)
    const checked = (name: string) => (field(name) as HTMLInputElement | null)?.checked === true
    const textValue = (name: string) => field(name)?.value.trim() || ''
    return {
      ...current,
      usage: Number(textValue('usage') || 0),
      sampleQuantity: Number(textValue('sampleQuantity') || 0),
      lossRate: Number(textValue('lossRate') || 0) / 100,
      printRequirement: checked('printRequirement') ? '是' : '否',
      dyeRequirement: checked('dyeRequirement') ? '是' : '否',
      purchaseRequirement: checked('purchaseRequirement') ? '是' : '否',
      applicableSkuIds: [...row.querySelectorAll<HTMLInputElement>('[data-bom-sku-scope]:checked')].map((item) => item.value),
      printRequirementText: textValue('printRequirementText'),
      dyeRequirementText: textValue('dyeRequirementText'),
      waterSolubleRequirementText: textValue('waterSolubleRequirementText'),
      printSide: (textValue('printSide') || '无') as EngineeringBomMaterialLineDraft['printSide'],
      linkedPatternResultIds: textValue('linkedPatternResultIds').split(',').map((item) => item.trim()).filter(Boolean),
      processCode: textValue('processCode'),
      remark: textValue('remark'),
      ...(isSimpleBomMaterialSku(current.materialSkuId) ? {
        printRequirement: current.printRequirement, dyeRequirement: current.dyeRequirement,
        printRequirementText: current.printRequirementText, dyeRequirementText: current.dyeRequirementText,
        waterSolubleRequirementText: current.waterSolubleRequirementText, printSide: current.printSide,
        linkedPatternResultIds: current.linkedPatternResultIds, processCode: current.processCode,
      } : {}),
    }
  })
}

function collectBomPlanCosts(plan: EngineeringBomPricingPlanRecord): EngineeringBomCustomCostDraft[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-bom-plan-cost]')).map((row, index) => {
    const customCostId = row.dataset.bomPlanCost || ''
    const current = plan.customCosts.find((item) => item.customCostId === customCostId)
    const input = (field: string) => row.querySelector<HTMLInputElement>(`[data-bom-plan-cost-field="${field}"]`)
    return {
      ...current,
      customCostId,
      title: input('title')?.value.trim() || '',
      amountIdr: Number(input('amountIdr')?.value || 0),
      note: input('note')?.value.trim() || '',
      displayOrder: index + 1,
    }
  })
}

async function saveCurrentBom(record: EngineeringBomVersionRecord, lines: EngineeringBomMaterialLineDraft[]): Promise<void> {
  const input = {
    versionId: record.bomDraftVersionId,
    role: '买手' as const,
    userId: 'BUYER-DEMO',
    userName: '买手-阿乐',
    materialLines: lines,
  }
  if (record.ownerStage === 'ENGINEERING_MASTER') await runPcsRecordCommand(() => saveEngineeringMasterBomVersion(input))
  else await runPcsRecordCommand(() => saveEngineeringBomVersion(input))
}

export function handlePcsTechnicalDataInput(target: Element): boolean {
  const node = target.closest<HTMLInputElement | HTMLSelectElement>('[data-tech-data-field]')
  if (!node) return false
  if (node.dataset.techDataField === 'bom-material-sku') return false
  if (node.dataset.techDataField === 'keyword') listState.keyword = node.value
  if (node.dataset.techDataField === 'status') listState.status = node.value
  if (node.dataset.techDataField === 'review') listState.review = node.value
  if (node.dataset.techDataField === 'brand') listState.brand = node.value
  if (node.dataset.techDataField === 'completeness') listState.completeness = node.value
  if (node.dataset.techDataField === 'difficulty') listState.difficulty = node.value
  if (node.dataset.techDataField === 'merchandiser') listState.merchandiser = node.value
  if (node.dataset.techDataField === 'patternMaker') listState.patternMaker = node.value
  if (node.dataset.techDataField === 'createdFrom') listState.createdFrom = node.value
  if (node.dataset.techDataField === 'createdTo') listState.createdTo = node.value
  if (node.dataset.techDataField === 'needMyAudit') listState.needMyAudit = (node as HTMLInputElement).checked
  if (node.dataset.techDataField === 'spuDistinct') listState.spuDistinct = (node as HTMLInputElement).checked
  return true
}

export async function handlePcsTechnicalDataEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  if (event?.type === 'keydown' && (event as KeyboardEvent).key === 'Escape' && technicalImagePreview.value) { technicalImagePreview.value = null; rerender(); return true }
  const node = target.closest<HTMLElement>('[data-tech-data-action], [data-tech-data-field]')
  const action = node?.dataset.techDataAction || ''
  if (event?.type === 'keydown' && (event as KeyboardEvent).key === 'Escape' && technicalLogModal.versionId) { technicalLogModal.versionId = ''; rerender(); return true }
  if (action === 'open-log') { technicalLogModal.versionId = node?.dataset.technicalVersionId || ''; rerender(); return true }
  if (action === 'close-log') { technicalLogModal.versionId = ''; rerender(); return true }
  if (action === 'assign-person') {
    if (event?.type !== 'change') return false
    try {
      await runPcsRecordCommand(() => assignTechnicalPackResponsible(node?.dataset.technicalVersionId || '', node?.dataset.personRole as '跟单' | '版师', (node as HTMLSelectElement).value), crypto.randomUUID(), ['higood-pcs-technical-data-version-store-v5', 'higood-pcs-tech-pack-version-log-store-v1'])
      technicalAssignmentFeedback.message = '技术包负责人已保存。'; technicalAssignmentFeedback.ok = true
    } catch (error) { technicalAssignmentFeedback.message = error instanceof Error ? error.message : '负责人未保存，请重试。'; technicalAssignmentFeedback.ok = false }
    rerender(); return true
  }
  if (action === 'open-image') { technicalImagePreview.value = { url: node?.dataset.imageUrl || '', title: node?.dataset.imageTitle || '款式图片' }; rerender(); return true }
  if (action === 'close-image') { technicalLogModal.versionId = ''; technicalImagePreview.value = null; rerender(); return true }
  if (action === 'search') { listState.currentPage = 1; rerender(); return true }
  const isBomList = window.location.pathname === '/pcs/technical-data/bom-pricing'
  if (action === 'prev-page') { if (isBomList) bomListState.currentPage = Math.max(1, bomListState.currentPage - 1); else listState.currentPage = Math.max(1, listState.currentPage - 1); rerender(); return true }
  if (action === 'next-page') { if (isBomList) bomListState.currentPage += 1; else listState.currentPage += 1; rerender(); return true }
  if (node?.dataset.techDataField === 'pageSize') { if (isBomList) { bomListState.pageSize = Number((node as HTMLSelectElement).value) || 10; bomListState.currentPage = 1 } else { listState.pageSize = Number((node as HTMLSelectElement).value) || 20; listState.currentPage = 1 } rerender(); return true }
  const planRoute = currentBomPlanRoute()
  const plan = planRoute ? getEngineeringBomPricingPlan(planRoute.ownerStage, planRoute.ownerId) : null
  if (plan && action === 'bom-plan-add-cost') {
    try {
      await runPcsRecordCommand(() => saveEngineeringBomPricingPlan({
        ownerStage: plan.ownerStage,
        ownerId: plan.ownerId,
        role: '买手',
        userId: 'BUYER-DEMO',
        userName: '买手-阿乐',
        customCostDecision: 'HAS_CUSTOM_COST',
        customCosts: [...plan.customCosts, { title: '车位费', amountIdr: 1, note: '' }],
      }))
      bomFeedback = { message: '已新增一项整款费用，请填写实际金额后保存。', ok: true }
    } catch (error) { bomFeedback = { message: error instanceof Error ? error.message : '新增费用失败。', ok: false } }
    rerender(); return true
  }
  if (plan && action === 'bom-plan-remove-cost') {
    const row = node?.closest<HTMLElement>('[data-bom-plan-cost]')
    try {
      const nextCosts = plan.customCosts.filter((item) => item.customCostId !== row?.dataset.bomPlanCost)
      await runPcsRecordCommand(() => saveEngineeringBomPricingPlan({
        ownerStage: plan.ownerStage,
        ownerId: plan.ownerId,
        role: '买手',
        userId: 'BUYER-DEMO',
        userName: '买手-阿乐',
        customCostDecision: nextCosts.length ? 'HAS_CUSTOM_COST' : 'UNDECIDED',
        customCosts: nextCosts,
      }))
      bomFeedback = { message: nextCosts.length ? '整款费用已删除。' : '最后一项费用已删除。请重新确认“本次无自定义费用”或新增费用。', ok: true }
    } catch (error) { bomFeedback = { message: error instanceof Error ? error.message : '删除费用失败。', ok: false } }
    rerender(); return true
  }
  if (plan && action === 'bom-plan-save-costs') {
    try {
      const decision = (document.querySelector<HTMLSelectElement>('[data-tech-data-field="bom-custom-cost-decision"]')?.value || 'UNDECIDED') as EngineeringBomCustomCostDecision
      await runPcsRecordCommand(() => saveEngineeringBomPricingPlan({
        ownerStage: plan.ownerStage,
        ownerId: plan.ownerId,
        role: '买手',
        userId: 'BUYER-DEMO',
        userName: '买手-阿乐',
        customCostDecision: decision,
        customCosts: decision === 'NO_CUSTOM_COST' ? [] : collectBomPlanCosts(plan),
      }))
      bomFeedback = { message: '整款自定义费用已保存。', ok: true }
    } catch (error) { bomFeedback = { message: error instanceof Error ? error.message : '保存整款费用失败。', ok: false } }
    rerender(); return true
  }
  const versionId = currentBomVersionId()
  const record = versionId ? getEngineeringBomVersionById(versionId) : null
  if (record && action === 'bom-add-material') {
    try {
      const select = document.querySelector<HTMLSelectElement>('[data-tech-data-field="bom-material-sku"]')
      const selected = allMaterialSkuOptions().find((item) => item.sku.materialSkuId === select?.value)
      if (!selected) throw new Error('请先选择要加入的物料 SKU。')
      if (record.materialLines.some((line) => line.materialSkuId === selected.sku.materialSkuId)) throw new Error('该物料 SKU 已在当前 BOM 中。')
      const kindText = getGarmentBomMaterialType(selected.sku.materialSkuId) || ''
      ;(await saveCurrentBom(record, [...record.materialLines, {
        bomItemId: `${record.bomDraftVersionId}-LINE-${record.materialLines.length + 1}`,
        materialSkuId: selected.sku.materialSkuId,
        sequenceNo: record.materialLines.length + 1,
        styleCode: record.styleCode,
        productColor: record.productColor,
        materialType: kindText,
        materialImageUrl: selected.sku.skuImageUrl,
        specification: isSimpleBomMaterialSku(selected.sku.materialSkuId) ? selected.sku.specName : [selected.sku.colorName, selected.sku.specName, selected.sku.sizeName].filter(Boolean).join(' / '),
        usage: 1,
        sampleQuantity: 1,
        usageUnit: isSimpleBomMaterialSku(selected.sku.materialSkuId) ? selected.sku.mainUnit || selected.sku.pricingUnit : selected.sku.pricingUnit,
        lossRate: 0,
        applicableSkuIds: [...record.applicableSkuIds],
        printRequirement: '否', dyeRequirement: '否', purchaseRequirement: '否',
        printRequirementText: '', dyeRequirementText: '', waterSolubleRequirementText: '无', printSide: '无', linkedPatternResultIds: [], remark: '',
      }]))
      bomFeedback = { message: '物料已加入并保存。', ok: true }
    } catch (error) { bomFeedback = { message: error instanceof Error ? error.message : '加入物料失败。', ok: false } }
    rerender(); return true
  }
  if (record && action === 'bom-remove-material') {
    const row = node?.closest<HTMLElement>('[data-bom-line]')
    try {
      ;(await saveCurrentBom(record, record.materialLines.filter((line) => line.bomItemId !== row?.dataset.bomLine)))
      bomFeedback = { message: '物料行已删除并保存；保存不会推进任务或完成确认。', ok: true }
    } catch (error) { bomFeedback = { message: error instanceof Error ? error.message : '删除物料失败。', ok: false } }
    rerender(); return true
  }
  if (record && action === 'bom-save') {
    try { (await saveCurrentBom(record, collectBomLines(record))); bomFeedback = { message: '该颜色物料已保存；请在所属业务单据完成整款确认。', ok: true } }
    catch (error) { bomFeedback = { message: error instanceof Error ? error.message : '保存失败。', ok: false } }
    rerender(); return true
  }
  return false
}

export function isPcsTechnicalDataDialogOpen(): boolean { return technicalImagePreview.value !== null || Boolean(technicalLogModal.versionId) }

import {
  escapeHtml,
  state,
  renderBadge,
  renderEmptyRow,
  safeText,
} from './context'
import { appStore } from '../../state/store.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../../data/fcs/production-order-identity'
import {
  effectiveModeLabels,
  getChangeRestrictionSnapshot,
  getProductionOrderTechPackChangeDetail,
  getProductionOrderTechPackRelation,
  getLatestPendingProductionTechPackPublishEvaluationBatch,
  getProductionProgressSnapshot,
  getProductionTechPackPublishEvaluationBatch,
  getTechPackVersionDiffSnapshot,
  listProductionChangeNoticesByOrder,
  listProductionChangeModuleLandingsByOrder,
  listProductionChangeOperationLogsByOrder,
  listProductionOrderTechPackRelations,
  listProductionPatchesByOrder,
  listSelectableTechPackVersionsByOrder,
  listTechPackChangeRequestsByOrder,
  patchEffectivePointLabels,
  productionPatchStatusLabels,
  productionPatchTypeLabels,
  productionPatchTypeModuleMap,
  techPackChangeModuleLabels,
  techPackChangeRequestStatusLabels,
  techPackRelationStatusClasses,
  techPackRelationStatusLabels,
  type ChangeEffectiveMode,
  type PatchEffectivePoint,
  type ProductionChangeModuleLanding,
  type ProductionOrderPatch,
  type ProductionOrderTechPackRelation,
  type ProductionTechPackPublishEvaluationBatch,
  type ProductionPatchType,
  type TechPackChangeModule,
  type TechPackRelationStatus,
} from '../../data/fcs/production-tech-pack-change-domain'

const progressFilterOptions = ['未开始', '已配料', '已领料', '印花中', '染色中', '裁片中', '车缝中', '工艺中']

function renderSelectOption(value: string, label: string, current: string): string {
  return `<option value="${escapeHtml(value)}" ${current === value ? 'selected' : ''}>${escapeHtml(label)}</option>`
}

function getPublishBatchIdFromRoute(): string {
  const pathname = appStore.getState().pathname
  const queryStart = pathname.indexOf('?')
  if (queryStart < 0) return ''
  const queryText = pathname.slice(queryStart + 1).split('#')[0] || ''
  return new URLSearchParams(queryText).get('publishBatchId') || ''
}

function syncPublishGuideFromRoute(): void {
  const batchId = getPublishBatchIdFromRoute()
  if (!batchId) return
  const batch = getProductionTechPackPublishEvaluationBatch(batchId)
  if (!batch || batch.affectedOrders.length === 0 || batch.status !== '待评估') return
  state.techPackChangePublishGuideOpen = true
  state.techPackChangePublishGuideBatchId = batch.batchId
  state.techPackChangeNewVersionFilter = 'YES'
  state.techPackChangeKeyword = batch.spuCode
}

function getCurrentPublishGuideBatch(): ProductionTechPackPublishEvaluationBatch | null {
  if (state.techPackChangePublishGuideBatchId) {
    const batch = getProductionTechPackPublishEvaluationBatch(state.techPackChangePublishGuideBatchId)
    if (batch) return batch
  }
  return getLatestPendingProductionTechPackPublishEvaluationBatch()
}

function getFilteredRelations(): ProductionOrderTechPackRelation[] {
  const keyword = state.techPackChangeKeyword.trim().toLowerCase()
  return listProductionOrderTechPackRelations().filter((relation) => {
    if (keyword) {
      const text = [
        relation.productionOrderNo,
        relation.spuCode,
        relation.styleName,
        relation.currentTechPackVersionNo,
        relation.latestPublishedTechPackVersionNo,
        relation.buyerName,
        relation.merchandiserName,
      ]
        .join(' ')
        .toLowerCase()
      if (!text.includes(keyword)) return false
    }

    if (
      state.techPackChangeCurrentVersionFilter !== 'ALL' &&
      relation.currentTechPackVersionNo !== state.techPackChangeCurrentVersionFilter
    ) {
      return false
    }
    if (state.techPackChangeNewVersionFilter === 'YES' && !relation.hasNewerPublishedVersion) return false
    if (state.techPackChangeNewVersionFilter === 'NO' && relation.hasNewerPublishedVersion) return false
    if (state.techPackChangePatchFilter === 'ACTIVE' && relation.activePatchCount === 0) return false
    if (state.techPackChangePatchFilter === 'PENDING' && relation.pendingPatchCount === 0) return false
    if (state.techPackChangePatchFilter === 'NONE' && (relation.activePatchCount > 0 || relation.pendingPatchCount > 0)) {
      return false
    }
    if (
      state.techPackChangeStatusFilter !== 'ALL' &&
      relation.relationStatus !== state.techPackChangeStatusFilter
    ) {
      return false
    }
    if (
      state.techPackChangeModuleFilter !== 'ALL' &&
      !listProductionChangeModuleLandingsByOrder(relation.productionOrderId).some(
        (item) => item.module === state.techPackChangeModuleFilter,
      )
    ) {
      return false
    }
    if (
      state.techPackChangeProgressFilter !== 'ALL' &&
      !relation.progressSummary.some((item) => item.includes(state.techPackChangeProgressFilter.replace('中', '')))
    ) {
      return false
    }
    if (
      state.techPackChangeOwnerFilter !== 'ALL' &&
      relation.merchandiserName !== state.techPackChangeOwnerFilter
    ) {
      return false
    }
    return true
  })
}

function buildVersionChangeEffectPreviewRows(
  relation: ProductionOrderTechPackRelation,
  diffItems: NonNullable<ReturnType<typeof getTechPackVersionDiffSnapshot>>['items'],
  effectiveMode: ChangeEffectiveMode,
): Array<{
  module: TechPackChangeModule
  documentName: string
  actionText: string
  effectiveText: string
  historyText: string
}> {
  const rows: Array<{
    module: TechPackChangeModule
    documentName: string
    actionText: string
    effectiveText: string
    historyText: string
  }> = []
  const seen = new Set<string>()
  const pushRow = (
    module: TechPackChangeModule,
    documentName: string,
    actionText: string,
    effectiveText: string,
    historyText: string,
  ): void => {
    const key = `${module}-${documentName}-${actionText}`
    if (seen.has(key)) return
    seen.add(key)
    rows.push({ module, documentName, actionText, effectiveText, historyText })
  }

  diffItems.forEach((item) => {
    item.relatedObjects.forEach((documentName) => {
      pushRow(
        item.module,
        documentName,
        item.involvedOccurredBusiness === '是' ? '保留原快照并写入影响提示' : '审批通过后按目标版本重新确认',
        effectiveModeLabels[effectiveMode],
        item.involvedOccurredBusiness === '是' ? '不回写历史业务事实' : '仅影响未开始或后续新建对象',
      )
    })
  })

  const modules = new Set(diffItems.map((item) => item.module))
  const futureDocuments: Record<TechPackChangeModule, string[]> = {
    BOM: ['后续配料任务', '后续领料单', '后续裁片单物料读取'],
    PATTERN: ['后续唛架方案', '后续铺布单', '后续菲票打印'],
    PROCESS: ['后续印花 / 染色 / 工艺任务'],
    SIZE: ['后续尺码放码', '后续裁片编号', '后续菲票数量'],
    COLOR_MATERIAL_MAPPING: ['后续款色用料对应', '后续颜色维度领料'],
    COST: ['后续核价明细', '后续结算口径'],
    DESIGN: ['后续印花工单', '后续染色要求', '后续花型版本读取'],
  }
  modules.forEach((module) => {
    futureDocuments[module].forEach((documentName) => {
      pushRow(
        module,
        documentName,
        `新建时读取 ${relation.latestPublishedTechPackVersionNo}`,
        effectiveModeLabels[effectiveMode],
        '不重算已生成单据',
      )
    })
  })

  return rows.slice(0, 12)
}

function renderVersionChangeEffectPreview(
  relation: ProductionOrderTechPackRelation,
  diff: ReturnType<typeof getTechPackVersionDiffSnapshot>,
  effectiveMode: ChangeEffectiveMode,
): string {
  const rows = buildVersionChangeEffectPreviewRows(relation, diff?.items ?? [], effectiveMode)
  return `
    <section class="border-b pb-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 class="text-sm font-semibold">步骤 5：审批通过后影响预览</h4>
          <p class="mt-1 text-xs text-muted-foreground">预览变更申请通过后会被标记、重新确认或按新版本读取的业务对象；历史已发生对象不会回写。</p>
        </div>
        ${renderBadge(`生效方式：${effectiveModeLabels[effectiveMode]}`, 'bg-blue-100 text-blue-700')}
      </div>
      <div class="mt-3 overflow-x-auto rounded-md border">
        <table class="w-full min-w-[920px] text-sm">
          <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left">影响模块</th>
              <th class="px-3 py-2 text-left">预计影响单据 / 对象</th>
              <th class="px-3 py-2 text-left">通过后动作</th>
              <th class="px-3 py-2 text-left">生效点</th>
              <th class="px-3 py-2 text-left">历史处理</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length === 0
                ? renderEmptyRow(5, '暂无可预览的单据影响')
                : rows.map((row) => `
                  <tr class="border-b last:border-0">
                    <td class="px-3 py-2">${escapeHtml(techPackChangeModuleLabels[row.module])}</td>
                    <td class="px-3 py-2 font-medium">${escapeHtml(row.documentName)}</td>
                    <td class="px-3 py-2">${escapeHtml(row.actionText)}</td>
                    <td class="px-3 py-2">${escapeHtml(row.effectiveText)}</td>
                    <td class="px-3 py-2">${escapeHtml(row.historyText)}</td>
                  </tr>
                `).join('')
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderVersionChangeDialog(): string {
  const productionOrderId = state.techPackChangeVersionDialogOrderId
  if (!productionOrderId) return ''
  const relation = getProductionOrderTechPackRelation(productionOrderId)
  if (!relation) return ''
  const targetOptions = listSelectableTechPackVersionsByOrder(productionOrderId)
  const progress = getProductionProgressSnapshot(productionOrderId)
  const restriction = getChangeRestrictionSnapshot(productionOrderId)
  const form = state.techPackChangeVersionForm
  const defaultTargetVersionId =
    targetOptions.find((item) => item.versionId === relation.latestPublishedTechPackVersionId)?.versionId ||
    targetOptions[0]?.versionId ||
    ''
  const targetSelected = form.targetVersionId || defaultTargetVersionId
  const targetVersion = targetOptions.find((item) => item.versionId === targetSelected)
  const diff = getTechPackVersionDiffSnapshot(productionOrderId, targetSelected)
  const effectiveMode = form.effectiveMode as ChangeEffectiveMode
  const hasBlockingRestriction = Boolean(restriction?.items.some((item) => item.blockVersionChange))

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-tech-pack-version-change" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 flex max-h-[88vh] w-[min(1100px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-5 py-4">
          <h3 class="text-lg font-semibold">变更生产单技术包版本</h3>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(relation.productionOrderNo)} / ${escapeHtml(relation.spuCode)} / ${escapeHtml(relation.styleName)}</p>
        </header>
        <div class="space-y-4 overflow-y-auto px-5 py-4">
          <section class="border-b pb-4">
            <h4 class="text-sm font-semibold">步骤 1：选择目标版本</h4>
            <div class="mt-3 grid gap-3 md:grid-cols-2">
              <div class="border-l pl-3 text-sm">
                <p class="text-xs text-muted-foreground">当前冻结版本</p>
                <p class="font-medium">${escapeHtml(relation.currentTechPackVersionNo)}</p>
              </div>
              <label class="space-y-1 text-sm">
                <span>目标正式版本</span>
                <select data-prod-field="techPackChangeTargetVersionId" class="w-full rounded-md border px-3 py-2 text-sm">
                  ${targetOptions.length === 0 ? renderSelectOption('', '暂无可切换正式版本', targetSelected) : targetOptions.map((version) => renderSelectOption(version.versionId, version.versionNo, targetSelected)).join('')}
                </select>
              </label>
              <div class="border-l pl-3 text-sm"><p class="text-xs text-muted-foreground">目标版本发布时间</p><p>${escapeHtml(targetVersion?.publishedAt || relation.latestPublishedAt)}</p></div>
              <div class="border-l pl-3 text-sm"><p class="text-xs text-muted-foreground">目标版本发布人</p><p>${escapeHtml(targetVersion?.publishedBy || relation.merchandiserName)}</p></div>
              <label class="space-y-1 text-sm">
                <span>申请原因 <span class="text-destructive">*</span></span>
                <textarea data-prod-field="techPackChangeVersionReason" class="min-h-[72px] w-full rounded-md border px-3 py-2 text-sm">${escapeHtml(form.reason)}</textarea>
              </label>
            </div>
          </section>

          <section class="border-b pb-4">
            <h4 class="text-sm font-semibold">步骤 2：查看版本差异</h4>
            <div class="mt-3 overflow-x-auto rounded-md border">
              <table class="w-full min-w-[900px] text-sm">
                <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2 text-left">模块</th>
                    <th class="px-3 py-2 text-left">变更类型</th>
                    <th class="px-3 py-2 text-left">变更对象</th>
                    <th class="px-3 py-2 text-left">当前冻结版本</th>
                    <th class="px-3 py-2 text-left">目标版本</th>
                    <th class="px-3 py-2 text-left">关联进度</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    !diff || diff.items.length === 0
                      ? renderEmptyRow(6, '当前两个版本没有可展示差异')
                      : diff.items.map((item) => `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2">${escapeHtml(techPackChangeModuleLabels[item.module])}</td>
                          <td class="px-3 py-2">${escapeHtml(item.changeType)}</td>
                          <td class="px-3 py-2">${escapeHtml(item.objectName)}</td>
                          <td class="px-3 py-2">${escapeHtml(item.currentValue)}</td>
                          <td class="px-3 py-2">${escapeHtml(item.targetValue)}</td>
                          <td class="px-3 py-2">${escapeHtml(item.relatedObjects.join('、') || '-')}</td>
                        </tr>
                      `).join('')
                  }
                </tbody>
              </table>
            </div>
          </section>

          <section class="border-b pb-4">
            <h4 class="text-sm font-semibold">步骤 3：查看生产进度</h4>
            <div class="mt-3 grid gap-3 md:grid-cols-2">
              ${(progress?.sections ?? []).map((section) => `
                <article class="border-l pl-3">
                  <p class="text-sm font-medium">${escapeHtml(section.sectionName)}</p>
                  <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(section.statusText)}</p>
                </article>
              `).join('')}
            </div>
          </section>

          <section class="border-b pb-4">
            <h4 class="text-sm font-semibold">步骤 4：系统硬限制判断</h4>
            <p class="mt-2 text-sm">${escapeHtml(restriction?.judgementText || '可以提交')}</p>
            ${hasBlockingRestriction ? `
              <div class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                当前存在阻止版本关系变更的硬限制，本申请不能直接提交。请改为发起生产单补丁，或先处理相关已发生单据。
              </div>
            ` : ''}
            <div class="mt-3 space-y-2">
              ${
                !restriction || restriction.items.length === 0
                  ? `<div class="border-l border-emerald-500 pl-3 text-sm text-emerald-700">当前没有硬限制。</div>`
                  : restriction.items.map((item) => `
                    <div class="border-l border-slate-300 pl-3 text-sm">
                      <div class="flex flex-wrap items-center gap-2">
                        ${renderBadge(item.blockVersionChange ? '阻止版本关系变更' : '不阻止提交', item.blockVersionChange ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700')}
                        ${renderBadge(item.allowPatch ? '允许生产补丁' : '不允许补丁', item.allowPatch ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700')}
                      </div>
                      <p class="mt-2 font-medium">${escapeHtml(item.restrictionType)} / ${escapeHtml(techPackChangeModuleLabels[item.affectedModule])}</p>
                      <p class="mt-1 text-muted-foreground">${escapeHtml(item.reason)}</p>
                    </div>
                  `).join('')
              }
            </div>
          </section>

          ${renderVersionChangeEffectPreview(relation, diff, effectiveMode)}

          <section class="pb-1">
            <h4 class="text-sm font-semibold">步骤 6：提交申请</h4>
            <div class="mt-3 grid gap-3 md:grid-cols-2">
              <label class="space-y-1 text-sm">
                <span>生效方式</span>
                <select data-prod-field="techPackChangeEffectiveMode" class="w-full rounded-md border px-3 py-2 text-sm">
                  ${(Object.keys(effectiveModeLabels) as ChangeEffectiveMode[]).map((mode) => renderSelectOption(mode, effectiveModeLabels[mode], form.effectiveMode)).join('')}
                </select>
              </label>
              <label class="space-y-1 text-sm">
                <span>附加说明</span>
                <input data-prod-field="techPackChangeVersionNote" value="${escapeHtml(form.note)}" class="w-full rounded-md border px-3 py-2 text-sm" />
              </label>
              <label class="col-span-full inline-flex items-center gap-2 text-sm">
                <input data-prod-field="techPackChangeVersionConfirmed" type="checkbox" ${form.confirmed ? 'checked' : ''} />
                <span>我已确认版本差异与当前生产进度</span>
              </label>
            </div>
            ${state.techPackChangeVersionError ? `<p class="mt-3 text-sm text-red-600">${escapeHtml(state.techPackChangeVersionError)}</p>` : ''}
          </section>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-5 py-4">
          ${hasBlockingRestriction ? `<p class="mr-auto text-sm text-red-600">存在硬限制，不能提交版本关系变更。</p>` : ''}
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-tech-pack-version-change">取消</button>
          ${hasBlockingRestriction ? `
            <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="open-production-patch" data-order-id="${escapeHtml(productionOrderId)}">改为发起补丁</button>
          ` : `
            <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="submit-tech-pack-version-change">提交变更申请</button>
          `}
        </footer>
      </div>
    </div>
  `
}

type PatchSelectOption = { value: string; label: string }

const productionPatchOptionGroups = {
  colors: [
    { value: 'Black', label: 'Black / 黑色' },
    { value: 'Navy', label: 'Navy / 藏青' },
    { value: 'Charcoal', label: 'Charcoal / 炭灰' },
    { value: 'All Colors', label: '全部颜色' },
  ],
  sizes: [
    { value: 'S', label: 'S' },
    { value: 'M', label: 'M' },
    { value: 'L', label: 'L' },
    { value: 'XL', label: 'XL' },
    { value: 'All Sizes', label: '全部尺码' },
  ],
  materials: [
    { value: 'tdv_demand_SPU_2024_010-bom-black-stretch-twill', label: '黑色弹力斜纹布 / 主面料' },
    { value: 'tdv_demand_SPU_2024_010-bom-waist-elastic', label: '腰头松紧带 / 辅料' },
    { value: 'tdv_demand_SPU_2024_010-bom-charcoal-stretch-twill', label: '炭灰弹力斜纹布 / 替代面料' },
    { value: 'tdv_demand_SPU_2024_010-bom-45mm-elastic', label: '4.5cm 黑色松紧带 / 替代辅料' },
  ],
  usageValues: [
    { value: '1.15m', label: '1.15m / 件' },
    { value: '1.18m', label: '1.18m / 件' },
    { value: '0.82m', label: '0.82m / 件' },
    { value: '0.86m', label: '0.86m / 件' },
  ],
  parts: [
    { value: '前片', label: '前片' },
    { value: '后片', label: '后片' },
    { value: '腰头', label: '腰头' },
    { value: '左腿小标', label: '左腿小标' },
  ],
  processNodes: [
    { value: '印花', label: '印花' },
    { value: '染色', label: '染色' },
    { value: '裁片', label: '裁片' },
    { value: '车缝交出', label: '车缝交出' },
    { value: '辅助工艺', label: '辅助工艺' },
    { value: '特种工艺', label: '特种工艺' },
  ],
  factories: [
    { value: '杭州中转仓', label: '杭州中转仓' },
    { value: '嘉兴裁床一厂', label: '嘉兴裁床一厂' },
    { value: '绍兴印花厂', label: '绍兴印花厂' },
    { value: '南通车缝厂', label: '南通车缝厂' },
  ],
  cutOrders: [
    { value: 'CUT-202603-004', label: 'CUT-202603-004 / 后续裁片单' },
    { value: 'CUT-202604-018', label: 'CUT-202604-018 / 新增裁片单' },
  ],
  markerPlans: [
    { value: 'MK-202603-002', label: 'MK-202603-002 / 已确认唛架' },
    { value: 'MK-202604-018', label: 'MK-202604-018 / 后续唛架' },
  ],
  spreadingOrders: [
    { value: 'SP-202603-003', label: 'SP-202603-003 / 已铺布 2 张' },
    { value: 'SP-202604-018', label: 'SP-202604-018 / 后续铺布' },
  ],
  processOrders: [
    { value: 'PR-202603-004', label: 'PR-202603-004 / 印花工单' },
    { value: 'DY-202604-018', label: 'DY-202604-018 / 染色工单' },
    { value: 'AUX-202604-018', label: 'AUX-202604-018 / 辅助工艺单' },
  ],
  patternFiles: [
    { value: 'front-panel-v1.dxf', label: 'front-panel-v1.dxf / 当前冻结纸样' },
    { value: 'front-panel-v2.dxf', label: 'front-panel-v2.dxf / 新纸样' },
    { value: 'waistband-v2.dxf', label: 'waistband-v2.dxf / 腰头纸样' },
  ],
  processPlans: [
    { value: '印花后回中转仓', label: '印花后回中转仓' },
    { value: '印花后直发车缝厂', label: '印花后直发车缝厂' },
    { value: '染色后重新验布', label: '染色后重新验布' },
  ],
  sizeRules: [
    { value: '常规 S-XL 放码', label: '常规 S-XL 放码' },
    { value: '腰头加宽放码规则', label: '腰头加宽放码规则' },
    { value: '前片修正版放码规则', label: '前片修正版放码规则' },
  ],
  mappings: [
    { value: 'Black -> 黑色弹力斜纹布', label: 'Black -> 黑色弹力斜纹布' },
    { value: 'Black -> 炭灰弹力斜纹布', label: 'Black -> 炭灰弹力斜纹布' },
    { value: 'Navy -> 藏青主面料', label: 'Navy -> 藏青主面料' },
  ],
  costItems: [
    { value: '主面料成本', label: '主面料成本' },
    { value: '印花加工费', label: '印花加工费' },
    { value: '裁床工价', label: '裁床工价' },
    { value: '车缝工价', label: '车缝工价' },
  ],
  costValues: [
    { value: '18.80 元/件', label: '18.80 元/件' },
    { value: '22.60 元/件', label: '22.60 元/件' },
    { value: '3.20 元/件', label: '3.20 元/件' },
    { value: '12.50 元/件', label: '12.50 元/件' },
  ],
  artworkFiles: [
    { value: 'artwork-left-leg-v2.png', label: 'artwork-left-leg-v2.png / 当前花型' },
    { value: 'artwork-left-leg-v3.png', label: 'artwork-left-leg-v3.png / 新花型' },
    { value: 'placement-print-v2.png', label: 'placement-print-v2.png / 定位印花' },
  ],
  reasons: [
    { value: '原物料不再到货，后续批次改用替代物料', label: '原物料不再到货，后续批次改用替代物料' },
    { value: '现场工艺确认后调整后续执行口径', label: '现场工艺确认后调整后续执行口径' },
    { value: '业务确认仅影响后续结算或后续任务', label: '业务确认仅影响后续结算或后续任务' },
  ],
}

function renderProductionPatchTypeCards(currentType: ProductionPatchType): string {
  const typeDescriptions: Record<ProductionPatchType, string> = {
    MATERIAL_REPLACEMENT: '替换后续领料或裁片使用的物料',
    MATERIAL_USAGE_ADJUSTMENT: '调整后续配料 / 领料用量',
    PATTERN_OVERRIDE: '覆盖后续唛架、铺布、菲票纸样',
    PROCESS_OVERRIDE: '调整后续工序节点、参数或承接工厂',
    SIZE_RULE_OVERRIDE: '调整后续放码和菲票数量口径',
    COLOR_MATERIAL_MAPPING_OVERRIDE: '调整颜色与物料 SKU 的对应关系',
    COSTING_OVERRIDE: '调整后续核价或结算口径',
    ARTWORK_OVERRIDE: '替换后续印花 / 染色使用花型',
    OTHER_PRODUCTION_OVERRIDE: '其他只影响后续生产对象的覆盖',
  }
  return `
    <div class="mt-3 grid gap-2 md:grid-cols-3">
      ${(Object.keys(productionPatchTypeLabels) as ProductionPatchType[]).map((type) => `
        <button type="button" class="rounded-md border px-3 py-2 text-left text-sm ${currentType === type ? 'border-blue-500 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-prod-action="set-production-patch-type" data-patch-type="${escapeHtml(type)}">
          <span class="font-medium">${escapeHtml(productionPatchTypeLabels[type])}</span>
          <span class="mt-1 block text-xs text-muted-foreground">${escapeHtml(typeDescriptions[type])}</span>
        </button>
      `).join('')}
    </div>
  `
}

function renderPatchSelect(
  field: string,
  label: string,
  value: string,
  options: PatchSelectOption[],
  placeholder = '请选择',
): string {
  return `
    <label class="space-y-1 text-sm">
      <span>${escapeHtml(label)}</span>
      <select data-prod-field="${escapeHtml(field)}" class="w-full rounded-md border px-3 py-2 text-sm">
        ${renderSelectOption('', placeholder, value)}
        ${options.map((option) => renderSelectOption(option.value, option.label, value)).join('')}
      </select>
    </label>
  `
}

function getPatchEffectivePointOptions(patchType: ProductionPatchType): PatchEffectivePoint[] {
  if (patchType === 'COSTING_OVERRIDE') return ['SETTLEMENT_ONLY', 'FROM_NOW']
  if (patchType === 'PATTERN_OVERRIDE' || patchType === 'SIZE_RULE_OVERRIDE') return ['FROM_NEXT_MARKER_PLAN', 'FROM_NEXT_SPREADING', 'FROM_NEXT_CUTTING']
  if (patchType === 'PROCESS_OVERRIDE') return ['FROM_NEXT_AUX_PROCESS', 'FROM_NEXT_SPECIAL_PROCESS', 'FROM_NEXT_SEWING', 'FROM_NOW']
  if (patchType === 'ARTWORK_OVERRIDE') return ['FROM_NEXT_PRINTING', 'FROM_NEXT_DYEING', 'FROM_NEXT_AUX_PROCESS']
  if (patchType === 'MATERIAL_REPLACEMENT' || patchType === 'MATERIAL_USAGE_ADJUSTMENT' || patchType === 'COLOR_MATERIAL_MAPPING_OVERRIDE') return ['FROM_NEXT_MATERIAL_PREP', 'FROM_NEXT_PICKUP', 'FROM_NEXT_CUTTING']
  return Object.keys(patchEffectivePointLabels) as PatchEffectivePoint[]
}

function renderProductionPatchScopeFields(patchType: ProductionPatchType, form: typeof state.productionPatchForm): string {
  const commonFactory = renderPatchSelect('productionPatchFactory', '承接工厂 / 仓库', form.factory, productionPatchOptionGroups.factories, '不限工厂')
  if (patchType === 'MATERIAL_REPLACEMENT' || patchType === 'MATERIAL_USAGE_ADJUSTMENT' || patchType === 'COLOR_MATERIAL_MAPPING_OVERRIDE') {
    return [
      renderPatchSelect('productionPatchColor', '颜色', form.color, productionPatchOptionGroups.colors, '不限颜色'),
      renderPatchSelect('productionPatchSize', '尺码', form.size, productionPatchOptionGroups.sizes, '不限尺码'),
      renderPatchSelect('productionPatchMaterial', '物料', form.material, productionPatchOptionGroups.materials, '请选择物料'),
      renderPatchSelect('productionPatchCutOrder', '裁片单', form.cutOrder, productionPatchOptionGroups.cutOrders, '不限裁片单'),
      commonFactory,
    ].join('')
  }
  if (patchType === 'PATTERN_OVERRIDE' || patchType === 'SIZE_RULE_OVERRIDE') {
    return [
      renderPatchSelect('productionPatchPart', '部位', form.part, productionPatchOptionGroups.parts, '请选择部位'),
      renderPatchSelect('productionPatchSize', '尺码', form.size, productionPatchOptionGroups.sizes, '不限尺码'),
      renderPatchSelect('productionPatchMarkerPlan', '唛架方案', form.markerPlan, productionPatchOptionGroups.markerPlans, '不限唛架方案'),
      renderPatchSelect('productionPatchSpreadingOrder', '铺布单', form.spreadingOrder, productionPatchOptionGroups.spreadingOrders, '不限铺布单'),
      commonFactory,
    ].join('')
  }
  if (patchType === 'PROCESS_OVERRIDE') {
    return [
      renderPatchSelect('productionPatchProcessNode', '工序节点', form.processNode, productionPatchOptionGroups.processNodes, '请选择工序节点'),
      renderPatchSelect('productionPatchProcessOrder', '工艺单', form.processOrder, productionPatchOptionGroups.processOrders, '不限工艺单'),
      commonFactory,
    ].join('')
  }
  if (patchType === 'COSTING_OVERRIDE') {
    return [
      renderPatchSelect('productionPatchFactory', '结算对象', form.factory, productionPatchOptionGroups.factories, '不限结算对象'),
      renderPatchSelect('productionPatchProcessOrder', '关联工艺单', form.processOrder, productionPatchOptionGroups.processOrders, '不限工艺单'),
    ].join('')
  }
  if (patchType === 'ARTWORK_OVERRIDE') {
    return [
      renderPatchSelect('productionPatchColor', '颜色', form.color, productionPatchOptionGroups.colors, '不限颜色'),
      renderPatchSelect('productionPatchPart', '花型位置 / 部位', form.part, productionPatchOptionGroups.parts, '请选择部位'),
      renderPatchSelect('productionPatchProcessOrder', '印花 / 染色工单', form.processOrder, productionPatchOptionGroups.processOrders, '不限工单'),
      commonFactory,
    ].join('')
  }
  return [
    renderPatchSelect('productionPatchColor', '颜色', form.color, productionPatchOptionGroups.colors, '不限颜色'),
    renderPatchSelect('productionPatchSize', '尺码', form.size, productionPatchOptionGroups.sizes, '不限尺码'),
    renderPatchSelect('productionPatchProcessNode', '业务节点', form.processNode, productionPatchOptionGroups.processNodes, '请选择节点'),
    commonFactory,
  ].join('')
}

function renderProductionPatchContentFields(patchType: ProductionPatchType, form: typeof state.productionPatchForm): string {
  if (patchType === 'MATERIAL_REPLACEMENT') {
    return [
      renderPatchSelect('productionPatchMaterial', '原物料 SKU', form.material, productionPatchOptionGroups.materials, '请选择原物料'),
      renderPatchSelect('productionPatchColor', '原物料颜色', form.color, productionPatchOptionGroups.colors, '请选择颜色'),
      renderPatchSelect('productionPatchTargetMaterial', '替代物料 SKU', form.targetMaterial, productionPatchOptionGroups.materials, '请选择替代物料'),
      renderPatchSelect('productionPatchTargetColor', '替代物料颜色', form.targetColor, productionPatchOptionGroups.colors, '请选择颜色'),
      renderPatchSelect('productionPatchContentText', '替代原因', form.contentText, productionPatchOptionGroups.reasons, '请选择替代原因'),
    ].join('')
  }
  if (patchType === 'MATERIAL_USAGE_ADJUSTMENT') {
    return [
      renderPatchSelect('productionPatchMaterial', '物料 SKU', form.material, productionPatchOptionGroups.materials, '请选择物料'),
      renderPatchSelect('productionPatchUsageValue', '原用量', form.usageValue, productionPatchOptionGroups.usageValues, '请选择原用量'),
      renderPatchSelect('productionPatchTargetUsageValue', '新用量', form.targetUsageValue, productionPatchOptionGroups.usageValues, '请选择新用量'),
      renderPatchSelect('productionPatchContentText', '调整原因', form.contentText, productionPatchOptionGroups.reasons, '请选择调整原因'),
    ].join('')
  }
  if (patchType === 'PATTERN_OVERRIDE') {
    return [
      renderPatchSelect('productionPatchPatternFile', '原纸样文件', form.patternFile, productionPatchOptionGroups.patternFiles, '请选择原纸样'),
      renderPatchSelect('productionPatchTargetPatternFile', '新纸样文件', form.targetPatternFile, productionPatchOptionGroups.patternFiles, '请选择新纸样'),
    ].join('')
  }
  if (patchType === 'PROCESS_OVERRIDE') {
    return [
      renderPatchSelect('productionPatchProcessFrom', '原工序 / 原流向', form.processFrom, productionPatchOptionGroups.processPlans, '请选择原工序'),
      renderPatchSelect('productionPatchProcessTo', '新工序 / 新流向', form.processTo, productionPatchOptionGroups.processPlans, '请选择新工序'),
    ].join('')
  }
  if (patchType === 'SIZE_RULE_OVERRIDE') {
    return [
      renderPatchSelect('productionPatchSizeRule', '原放码规则', form.sizeRule, productionPatchOptionGroups.sizeRules, '请选择原规则'),
      renderPatchSelect('productionPatchTargetSizeRule', '新放码规则', form.targetSizeRule, productionPatchOptionGroups.sizeRules, '请选择新规则'),
    ].join('')
  }
  if (patchType === 'COLOR_MATERIAL_MAPPING_OVERRIDE') {
    return [
      renderPatchSelect('productionPatchColorMaterialMapping', '原款色用料对应', form.colorMaterialMapping, productionPatchOptionGroups.mappings, '请选择原对应'),
      renderPatchSelect('productionPatchTargetColorMaterialMapping', '新款色用料对应', form.targetColorMaterialMapping, productionPatchOptionGroups.mappings, '请选择新对应'),
      renderPatchSelect('productionPatchTargetMaterial', '目标物料', form.targetMaterial, productionPatchOptionGroups.materials, '请选择目标物料'),
    ].join('')
  }
  if (patchType === 'COSTING_OVERRIDE') {
    return [
      renderPatchSelect('productionPatchCostItem', '原核价项', form.costItem, productionPatchOptionGroups.costItems, '请选择核价项'),
      renderPatchSelect('productionPatchTargetCostValue', '新核价值', form.targetCostValue, productionPatchOptionGroups.costValues, '请选择新核价值'),
      renderPatchSelect('productionPatchContentText', '调整原因', form.contentText, productionPatchOptionGroups.reasons, '请选择调整原因'),
    ].join('')
  }
  if (patchType === 'ARTWORK_OVERRIDE') {
    return [
      renderPatchSelect('productionPatchArtworkFile', '原花型文件', form.artworkFile, productionPatchOptionGroups.artworkFiles, '请选择原花型'),
      renderPatchSelect('productionPatchTargetArtworkFile', '新花型文件', form.targetArtworkFile, productionPatchOptionGroups.artworkFiles, '请选择新花型'),
    ].join('')
  }
  return `
    <label class="space-y-1 text-sm md:col-span-2">
      <span>补丁内容 <span class="text-destructive">*</span></span>
      <textarea data-prod-field="productionPatchContentText" class="min-h-[96px] w-full rounded-md border px-3 py-2 text-sm">${escapeHtml(form.contentText)}</textarea>
    </label>
  `
}

function renderProductionPatchDialog(): string {
  const productionOrderId = state.productionPatchDialogOrderId
  if (!productionOrderId) return ''
  const relation = getProductionOrderTechPackRelation(productionOrderId)
  if (!relation) return ''
  const form = state.productionPatchForm
  const patchType = form.patchType as ProductionPatchType
  const effectivePoint = form.effectivePoint as PatchEffectivePoint
  const effectivePointOptions = getPatchEffectivePointOptions(patchType)
  const normalizedEffectivePoint = effectivePointOptions.includes(effectivePoint) ? effectivePoint : effectivePointOptions[0]
  const scopeText = [
    form.color && `颜色：${form.color}`,
    form.size && `尺码：${form.size}`,
    form.material && `物料：${form.material}`,
    form.part && `部位：${form.part}`,
    form.processNode && `节点：${form.processNode}`,
    form.factory && `工厂：${form.factory}`,
    form.cutOrder && `裁片单：${form.cutOrder}`,
    form.markerPlan && `唛架方案：${form.markerPlan}`,
    form.spreadingOrder && `铺布单：${form.spreadingOrder}`,
    form.processOrder && `工艺单：${form.processOrder}`,
  ]
    .filter(Boolean)
    .join(' / ')

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-production-patch" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 flex max-h-[90vh] w-[min(1120px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-5 py-4">
          <h3 class="text-lg font-semibold">发起生产单补丁</h3>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(relation.productionOrderNo)} / 当前主版本 ${escapeHtml(relation.currentTechPackVersionNo)}</p>
        </header>
        <div class="space-y-4 overflow-y-auto px-5 py-4">
          <section class="border-b pb-4">
            <h4 class="text-sm font-semibold">步骤 1：选择补丁类型</h4>
            ${renderProductionPatchTypeCards(patchType)}
          </section>
          <section class="border-b pb-4">
            <h4 class="text-sm font-semibold">步骤 2：选择影响范围</h4>
            <div class="mt-3 grid gap-3 md:grid-cols-3">
              ${renderProductionPatchScopeFields(patchType, form)}
            </div>
            <p class="mt-2 text-xs text-muted-foreground">当前范围：${escapeHtml(scopeText || '尚未明确')}</p>
          </section>
          <section class="border-b pb-4">
            <h4 class="text-sm font-semibold">步骤 3：选择生效点</h4>
            <select data-prod-field="productionPatchEffectivePoint" class="mt-3 w-full rounded-md border px-3 py-2 text-sm">
              ${effectivePointOptions.map((point) => renderSelectOption(point, patchEffectivePointLabels[point], normalizedEffectivePoint)).join('')}
            </select>
            <p class="mt-2 text-xs text-muted-foreground">只影响该生效点之后的新建或未开始对象，已发生业务事实不回写。</p>
          </section>
          <section class="border-b pb-4">
            <h4 class="text-sm font-semibold">步骤 4：填写补丁内容</h4>
            <div class="mt-3 grid gap-3 md:grid-cols-2">
              ${renderProductionPatchContentFields(patchType, form)}
              <label class="space-y-1 text-sm">
                <span>补丁原因 <span class="text-destructive">*</span></span>
                <textarea data-prod-field="productionPatchReason" class="min-h-[96px] w-full rounded-md border px-3 py-2 text-sm" placeholder="填写业务确认原因、审批说明或异常来源">${escapeHtml(form.reason)}</textarea>
              </label>
            </div>
          </section>
          <section class="pb-1">
            <h4 class="text-sm font-semibold">步骤 5：确认影响与通知</h4>
            <div class="mt-3 grid gap-3 md:grid-cols-3">
              <div class="border-l pl-3 text-sm"><p class="text-xs text-muted-foreground">影响模块</p><p>${escapeHtml(techPackChangeModuleLabels[productionPatchTypeModuleMap[patchType]])}</p></div>
              <div class="border-l pl-3 text-sm"><p class="text-xs text-muted-foreground">飞书通知接收人</p><p>${escapeHtml(`${relation.buyerName} / ${relation.merchandiserName} / 模块责任人`)}</p></div>
              <div class="border-l pl-3 text-sm"><p class="text-xs text-muted-foreground">是否需要审批</p><p>需要审批</p></div>
            </div>
            ${state.productionPatchError ? `<p class="mt-3 text-sm text-red-600">${escapeHtml(state.productionPatchError)}</p>` : ''}
          </section>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-5 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-production-patch">取消</button>
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="save-production-patch-draft">保存草稿</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="submit-production-patch">提交补丁</button>
        </footer>
      </div>
    </div>
  `
}

function renderPublishGuideDialog(): string {
  if (!state.techPackChangePublishGuideOpen) return ''
  const batch = getCurrentPublishGuideBatch()
  const affected = batch
    ? batch.affectedOrders
        .map((item) => ({
          affectedOrder: item,
          relation: getProductionOrderTechPackRelation(item.productionOrderId),
        }))
        .filter((item) => Boolean(item.relation))
    : listProductionOrderTechPackRelations()
        .filter((item) => item.hasNewerPublishedVersion)
        .map((relation) => ({
          affectedOrder: {
            productionOrderId: relation.productionOrderId,
            productionOrderNo: relation.productionOrderNo,
            currentTechPackVersionId: relation.currentTechPackVersionId,
            currentTechPackVersionNo: relation.currentTechPackVersionNo,
            latestPublishedTechPackVersionId: relation.latestPublishedTechPackVersionId,
            latestPublishedTechPackVersionNo: relation.latestPublishedTechPackVersionNo,
            progressSummary: relation.progressSummary,
            patchSummary: `生效中 ${relation.activePatchCount} / 待审核 ${relation.pendingPatchCount}`,
            evaluationStatus: techPackRelationStatusLabels[relation.relationStatus],
          },
          relation,
        }))
  const latest = affected[0]?.relation ?? null
  const diffModuleText = batch
    ? batch.diffModules.map((module) => techPackChangeModuleLabels[module]).join('、')
    : '物料清单、纸样管理、花型设计'
  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-tech-pack-publish-guide" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 w-[min(860px,94vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-5 py-4">
          <h3 class="text-lg font-semibold">正式技术包发布完成</h3>
          <p class="mt-1 text-sm text-muted-foreground">以下生产单仍关联旧版本，需要进入生产单变更查看差异和进度。</p>
        </header>
        <div class="max-h-[64vh] overflow-y-auto px-5 py-4">
          <section class="mb-4 border-b pb-4">
            <h4 class="text-sm font-semibold">新版本技术包信息</h4>
            <div class="mt-3 grid gap-3 text-sm md:grid-cols-4">
              <div><span class="text-muted-foreground">SPU</span><div class="font-medium">${escapeHtml(batch?.spuCode || latest?.spuCode || '-')}</div></div>
              <div><span class="text-muted-foreground">版本号</span><div class="font-medium">${escapeHtml(batch ? `${batch.versionLabel} / ${batch.technicalVersionCode}` : latest?.latestPublishedTechPackVersionNo || '-')}</div></div>
              <div><span class="text-muted-foreground">发布时间</span><div class="font-medium">${escapeHtml(batch?.publishedAt || latest?.latestPublishedAt || '-')}</div></div>
              <div><span class="text-muted-foreground">发布人</span><div class="font-medium">${escapeHtml(batch?.publishedBy || '陈静')}</div></div>
            </div>
            <div class="mt-3 text-sm text-muted-foreground">与上一正式版差异模块：${escapeHtml(diffModuleText || '-')}</div>
            ${batch ? `<div class="mt-2 text-xs text-muted-foreground">评估批次：${escapeHtml(batch.batchId)} / ${escapeHtml(batch.status)}</div>` : ''}
          </section>
          <section class="mb-4">
            <h4 class="text-sm font-semibold">受影响生产单</h4>
            <p class="mt-1 text-xs text-muted-foreground">本引导只展示本次正式版本发布影响到的生产单。</p>
          </section>
          <label class="mb-4 block space-y-1 text-sm">
            <span>本次不处理原因</span>
            <select data-prod-field="techPackChangePublishIgnoreReason" class="w-full rounded-md border px-3 py-2 text-sm">
              ${renderSelectOption('', '请选择原因', state.techPackChangePublishIgnoreReason)}
              ${['新版本仅用于后续生产单', '当前生产单已生产过半', '当前生产单已有补丁覆盖', '当前变更与生产无关', '其他'].map((item) => renderSelectOption(item, item, state.techPackChangePublishIgnoreReason)).join('')}
            </select>
          </label>
          <div class="overflow-x-auto rounded-md border">
            <table class="w-full min-w-[760px] text-sm">
              <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 text-left">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
                  <th class="px-3 py-2 text-left">当前冻结版本</th>
                  <th class="px-3 py-2 text-left">最新正式版</th>
                  <th class="px-3 py-2 text-left">生产进度</th>
                  <th class="px-3 py-2 text-left">补丁</th>
                  <th class="px-3 py-2 text-left">评估状态</th>
                </tr>
              </thead>
              <tbody>
                ${affected.map((item) => `
                  <tr class="border-b last:border-0">
                    <td class="px-3 py-2"><div class="cursor-pointer hover:underline" data-prod-action="open-production-change-detail" data-order-id="${escapeHtml(item.affectedOrder.productionOrderId)}">${renderProductionOrderIdentityCell(item.affectedOrder.productionOrderNo)}</div></td>
                    <td class="px-3 py-2">${escapeHtml(item.affectedOrder.currentTechPackVersionNo)}</td>
                    <td class="px-3 py-2">${escapeHtml(item.affectedOrder.latestPublishedTechPackVersionNo)}</td>
                    <td class="px-3 py-2">${escapeHtml(item.affectedOrder.progressSummary[0] || '-')}</td>
                    <td class="px-3 py-2">${escapeHtml(item.affectedOrder.patchSummary)}</td>
                    <td class="px-3 py-2">${escapeHtml(item.affectedOrder.evaluationStatus)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-5 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="mark-tech-pack-publish-ignore">本次不处理</button>
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="generate-tech-pack-evaluation-todo">生成生产单评估待办</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="close-tech-pack-publish-guide">进入生产单变更</button>
        </footer>
      </div>
    </div>
  `
}

function findModuleLandingById(
  landingId: string,
): { landing: ProductionChangeModuleLanding; relation: ProductionOrderTechPackRelation } | null {
  if (!landingId) return null
  for (const relation of listProductionOrderTechPackRelations()) {
    const landing = listProductionChangeModuleLandingsByOrder(relation.productionOrderId).find(
      (item) => item.landingId === landingId,
    )
    if (landing) return { landing, relation }
  }
  return null
}

function getModuleLandingRuleRows(landing: ProductionChangeModuleLanding): Array<[string, string]> {
  const commonRows: Array<[string, string]> = [
    ['读取优先级', '生产单补丁覆盖规则 > 版本关系目标版本 > 生产单冻结快照'],
    ['生效边界', '只影响后续新建或未开始对象，已发生的配料、领料、裁剪、交出、结算记录不回写'],
  ]
  const moduleRows: Record<TechPackChangeModule, Array<[string, string]>> = {
    BOM: [
      ['模块落点', '配料任务、领料单、裁片单物料读取；中转仓和工厂仓管按该标识识别用料口径'],
      ['执行关注', '已配未领需确认是否作废重建；已领或已加工对象保留原物料快照'],
    ],
    PATTERN: [
      ['模块落点', '唛架方案、铺布单、菲票打印；裁床按标识判断纸样版本'],
      ['执行关注', '已确认唛架、已铺布、已裁剪对象保持旧纸样；后续重新排唛架才读取新纸样或补丁'],
    ],
    PROCESS: [
      ['模块落点', '印花、染色、辅助工艺、特种工艺任务；外协任务按生效点重新确认'],
      ['执行关注', '已交出外部工厂任务不直接覆盖，后续未开始节点按新规则生成'],
    ],
    SIZE: [
      ['模块落点', '尺码放码、裁片编号、菲票数量；影响唛架和菲票生成数量'],
      ['执行关注', '已生成菲票或已铺布对象不回算，后续新建对象才读取新放码规则'],
    ],
    COLOR_MATERIAL_MAPPING: [
      ['模块落点', '款色用料对应、颜色维度领料；影响颜色与物料 SKU 的映射'],
      ['执行关注', '已领料颜色保持原映射，后续颜色批次按补丁或目标版本读取'],
    ],
    COST: [
      ['模块落点', '核价明细、结算口径、工厂对账；财务按标识识别后续结算版本'],
      ['执行关注', '已结算或进入对账对象不覆盖，差异通过后续补丁或差异记录处理'],
    ],
    DESIGN: [
      ['模块落点', '花型版本、印花工单、染色要求；印染工厂按标识识别花型图和工艺要求'],
      ['执行关注', '已交出或已完成印花 / 染色对象保留原花型，后续批次按新花型或补丁执行'],
    ],
  }
  return [...moduleRows[landing.module], ...commonRows]
}

function renderModuleLandingDialog(): string {
  const resolved = findModuleLandingById(state.techPackChangeModuleLandingId)
  if (!resolved) return ''

  const { landing, relation } = resolved
  const moduleLabel = techPackChangeModuleLabels[landing.module]
  const diffSnapshot = getTechPackVersionDiffSnapshot(relation.productionOrderId, relation.latestPublishedTechPackVersionId)
  const diffItems = diffSnapshot?.items.filter((item) => item.module === landing.module) ?? []
  const modulePatches = listProductionPatchesByOrder(relation.productionOrderId).filter(
    (patch) => patch.affectedModule === landing.module,
  )
  const patchNos = new Set(modulePatches.map((patch) => patch.patchNo))
  const logs = listProductionChangeOperationLogsByOrder(relation.productionOrderId)
    .filter(
      (log) =>
        log.remark.includes(moduleLabel) ||
        log.operationObject === landing.landingId ||
        log.operationObject === relation.latestChangeRecordId ||
        patchNos.has(log.operationObject),
    )
    .slice(0, 5)

  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/40" data-prod-action="close-change-module-landing" aria-label="关闭模块落地详情"></button>
      <aside class="absolute right-0 top-0 flex h-full w-full max-w-5xl flex-col bg-background shadow-2xl">
        <header class="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-lg font-semibold">${escapeHtml(moduleLabel)}落地模块详情</h2>
              ${renderBadge(techPackRelationStatusLabels[relation.relationStatus], techPackRelationStatusClasses[relation.relationStatus])}
            </div>
            <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(relation.productionOrderNo)} / ${escapeHtml(relation.spuCode)} / ${escapeHtml(landing.landingId)}</p>
          </div>
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="close-change-module-landing">关闭</button>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto">
          <section class="grid border-b md:grid-cols-[1.05fr_1fr]">
            <div class="space-y-4 border-b p-5 md:border-b-0 md:border-r">
              <div>
                <h3 class="text-sm font-semibold">落地标识</h3>
                <div class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p class="text-xs text-muted-foreground">版本关系标识</p>
                    <p class="mt-1 font-medium">${escapeHtml(landing.relationMarker)}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">当前读取规则</p>
                    <p class="mt-1 font-medium">${escapeHtml(landing.currentRule)}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">落地对象</p>
                    <p class="mt-1">${escapeHtml(landing.landingObject)}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">模块入口</p>
                    <p class="mt-1 font-mono text-xs">${escapeHtml(landing.viewUrl)}</p>
                  </div>
                </div>
              </div>
              <div>
                <h3 class="text-sm font-semibold">补丁标识</h3>
                <div class="mt-2 space-y-1 text-sm">
                  ${landing.patchMarkers.length === 0 ? '<p class="text-muted-foreground">暂无生产单补丁覆盖。</p>' : landing.patchMarkers.map((marker) => `<p>${escapeHtml(marker)}</p>`).join('')}
                </div>
              </div>
            </div>

            <div class="space-y-4 p-5">
              <div>
                <h3 class="text-sm font-semibold">责任人与日志</h3>
                <div class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p class="text-xs text-muted-foreground">责任角色</p>
                    <p class="mt-1 font-medium">${escapeHtml(landing.ownerRole)}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">责任人</p>
                    <p class="mt-1 font-medium">${escapeHtml(landing.ownerName)}</p>
                  </div>
                </div>
                <p class="mt-3 text-sm text-muted-foreground">${escapeHtml(landing.lastLog)}</p>
              </div>
              <div>
                <h3 class="text-sm font-semibold">执行口径</h3>
                <dl class="mt-2 divide-y text-sm">
                  ${getModuleLandingRuleRows(landing).map(([label, value]) => `
                    <div class="grid gap-2 py-2 sm:grid-cols-[96px_1fr]">
                      <dt class="text-muted-foreground">${escapeHtml(label)}</dt>
                      <dd>${escapeHtml(value)}</dd>
                    </div>
                  `).join('')}
                </dl>
              </div>
            </div>
          </section>

          <section class="border-b p-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="text-sm font-semibold">本模块版本差异</h3>
                <p class="mt-1 text-xs text-muted-foreground">来自当前冻结版本与目标正式版本的差异快照。</p>
              </div>
              <span class="text-xs text-muted-foreground">${escapeHtml(diffSnapshot?.fromTechPackVersionNo || relation.currentTechPackVersionNo)} → ${escapeHtml(diffSnapshot?.toTechPackVersionNo || relation.latestPublishedTechPackVersionNo)}</span>
            </div>
            <div class="mt-3 overflow-x-auto rounded-md border">
              <table class="w-full min-w-[840px] text-sm">
                <thead class="bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2 text-left">变更类型</th>
                    <th class="px-3 py-2 text-left">变更对象</th>
                    <th class="px-3 py-2 text-left">当前冻结版本</th>
                    <th class="px-3 py-2 text-left">目标版本</th>
                    <th class="px-3 py-2 text-left">影响范围</th>
                    <th class="px-3 py-2 text-left">已发生业务</th>
                    <th class="px-3 py-2 text-left">相关对象</th>
                  </tr>
                </thead>
                <tbody>
                  ${diffItems.length === 0 ? renderEmptyRow(7, '本模块暂无版本差异') : diffItems.map((item) => `
                    <tr class="border-t">
                      <td class="px-3 py-2">${escapeHtml(item.changeType)}</td>
                      <td class="px-3 py-2 font-medium">${escapeHtml(item.objectName)}</td>
                      <td class="px-3 py-2">${escapeHtml(item.currentValue)}</td>
                      <td class="px-3 py-2">${escapeHtml(item.targetValue)}</td>
                      <td class="px-3 py-2">${escapeHtml(item.impactScope)}</td>
                      <td class="px-3 py-2">${escapeHtml(item.involvedOccurredBusiness)}</td>
                      <td class="px-3 py-2">${escapeHtml(item.relatedObjects.join('、'))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </section>

          <section class="grid gap-5 p-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h3 class="text-sm font-semibold">生产补丁覆盖</h3>
              <div class="mt-3 overflow-x-auto rounded-md border">
                <table class="w-full min-w-[680px] text-sm">
                  <thead class="bg-muted/30 text-xs text-muted-foreground">
                    <tr>
                      <th class="px-3 py-2 text-left">补丁编号</th>
                      <th class="px-3 py-2 text-left">补丁类型</th>
                      <th class="px-3 py-2 text-left">生效点</th>
                      <th class="px-3 py-2 text-left">状态</th>
                      <th class="px-3 py-2 text-left">生效范围</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${modulePatches.length === 0 ? renderEmptyRow(5, '暂无补丁覆盖') : modulePatches.map((patch) => `
                      <tr class="border-t">
                        <td class="px-3 py-2 font-mono text-xs">${escapeHtml(patch.patchNo)}</td>
                        <td class="px-3 py-2">${escapeHtml(productionPatchTypeLabels[patch.patchType])}</td>
                        <td class="px-3 py-2">${escapeHtml(patchEffectivePointLabels[patch.effectivePoint])}</td>
                        <td class="px-3 py-2">${escapeHtml(productionPatchStatusLabels[patch.status])}</td>
                        <td class="px-3 py-2">${escapeHtml(safeText(patch.patchScope.color || patch.patchScope.part || patch.patchScope.material || patch.patchScope.processNode || '生产单后续对象'))}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 class="text-sm font-semibold">模块相关日志</h3>
              <div class="mt-3 rounded-md border">
                ${logs.length === 0 ? '<div class="p-4 text-sm text-muted-foreground">暂无模块相关日志。</div>' : logs.map((log) => `
                  <div class="border-b p-3 text-sm last:border-b-0">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <span class="font-medium">${escapeHtml(log.operationType)}</span>
                      <span class="text-xs text-muted-foreground">${escapeHtml(log.operatedAt)}</span>
                    </div>
                    <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(log.operatorName)} / ${escapeHtml(log.operationObject)}</p>
                    <p class="mt-2 text-xs">${escapeHtml(log.remark)}</p>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>
  `
}

function renderLandingModuleChips(landings: ProductionChangeModuleLanding[], limit = 4): string {
  if (landings.length === 0) {
    return '<span class="text-xs text-muted-foreground">暂无模块落地标识</span>'
  }

  const visible = landings.slice(0, limit)
  const restCount = Math.max(0, landings.length - visible.length)
  return `
    <div class="flex flex-wrap gap-1.5">
      ${visible.map((landing) => `
        <button class="rounded-full border px-2.5 py-1 text-xs hover:bg-muted" data-prod-action="open-change-module-landing" data-landing-id="${escapeHtml(landing.landingId)}" data-module="${escapeHtml(landing.module)}" data-module-label="${escapeHtml(techPackChangeModuleLabels[landing.module])}">
          ${escapeHtml(techPackChangeModuleLabels[landing.module])}
        </button>
      `).join('')}
      ${restCount > 0 ? `<span class="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">+${restCount}</span>` : ''}
    </div>
  `
}

function renderRelationWorkItem(relation: ProductionOrderTechPackRelation): string {
  const landings = listProductionChangeModuleLandingsByOrder(relation.productionOrderId)
  const activeDiffs = relation.diffSummary.filter((item) => item.count > 0)
  const restrictionCount = relation.restrictionSummary.includes('无限制项') ? 0 : relation.restrictionSummary.length
  return `
    <article class="grid gap-5 border-b bg-background p-4 last:border-b-0 xl:grid-cols-[1.05fr_1.2fr_1.15fr_0.76fr]">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <div class="cursor-pointer hover:underline" data-prod-action="open-production-change-detail" data-order-id="${escapeHtml(relation.productionOrderId)}">${renderProductionOrderIdentityCell(relation.productionOrderNo)}</div>
          ${renderBadge(techPackRelationStatusLabels[relation.relationStatus], techPackRelationStatusClasses[relation.relationStatus])}
        </div>
        <p class="mt-1 truncate text-sm">${escapeHtml(relation.spuCode)} / ${escapeHtml(relation.styleName)}</p>
        <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>买手：${escapeHtml(relation.buyerName)}</span>
          <span>跟单：${escapeHtml(relation.merchandiserName)}</span>
          <span>颜色 ${relation.colorCount} / 尺码 ${relation.sizeCount}</span>
          <span>交期：${escapeHtml(relation.deliveryDate)}</span>
          <span>快照：${escapeHtml(relation.frozenSnapshotId)}</span>
        </div>
      </div>

      <div class="min-w-0 space-y-3">
        <div class="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1 text-sm">
          <span class="text-muted-foreground">冻结版本</span>
          <span class="font-medium">${escapeHtml(relation.currentTechPackVersionNo)} · ${escapeHtml(relation.frozenAt)}</span>
          <span class="text-muted-foreground">最新正式版</span>
          <span>${escapeHtml(relation.latestPublishedTechPackVersionNo)} · 共 ${relation.publishedVersionCount} 个正式版</span>
          <span class="text-muted-foreground">版本关系</span>
          <span>${relation.hasNewerPublishedVersion ? renderBadge('存在新版本', 'bg-amber-100 text-amber-700') : renderBadge('当前一致', 'bg-emerald-100 text-emerald-700')}</span>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">模块落地标识</p>
          <div class="mt-1">${renderLandingModuleChips(landings)}</div>
        </div>
      </div>

      <div class="min-w-0">
        <div class="flex flex-wrap gap-1.5">
          ${activeDiffs.length === 0 ? '<span class="text-xs text-muted-foreground">暂无版本差异</span>' : activeDiffs.map((item) => `
            <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">${escapeHtml(techPackChangeModuleLabels[item.module])} ${item.count} 项</span>
          `).join('')}
        </div>
        <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <p class="text-muted-foreground">生效补丁</p>
            <p class="mt-1 text-base font-semibold">${relation.activePatchCount}</p>
          </div>
          <div>
            <p class="text-muted-foreground">待审核</p>
            <p class="mt-1 text-base font-semibold">${relation.pendingPatchCount}</p>
          </div>
          <div>
            <p class="text-muted-foreground">历史</p>
            <p class="mt-1 text-base font-semibold">${relation.historyPatchCount}</p>
          </div>
        </div>
        <p class="mt-3 text-xs text-muted-foreground">${escapeHtml(landings[0]?.lastLog || '暂无模块日志')}</p>
      </div>

      <div class="flex min-w-[180px] flex-col gap-3">
        <div class="space-y-1 text-xs text-muted-foreground">
          ${relation.progressSummary.slice(0, 4).map((item) => `<p>${escapeHtml(item)}</p>`).join('')}
        </div>
        <div class="text-xs">
          <span class="font-medium">限制项 ${restrictionCount}</span>
          <span class="ml-2 text-muted-foreground">${escapeHtml(relation.restrictionSummary.filter((item) => item !== '无限制项').slice(0, 2).join('、') || '无硬限制')}</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-prod-action="open-production-change-detail" data-order-id="${escapeHtml(relation.productionOrderId)}">查看判断</button>
          <button class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-prod-action="open-tech-pack-version-change" data-order-id="${escapeHtml(relation.productionOrderId)}">变更版本</button>
          <button class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-prod-action="open-production-patch" data-order-id="${escapeHtml(relation.productionOrderId)}">发起补丁</button>
          <button class="rounded-md px-2.5 py-1.5 text-xs hover:bg-muted" data-prod-action="open-production-change-history" data-order-id="${escapeHtml(relation.productionOrderId)}">日志</button>
        </div>
      </div>
    </article>
  `
}

export function renderProductionChangesPage(): string {
  syncPublishGuideFromRoute()
  const relations = getFilteredRelations()
  const allRelations = listProductionOrderTechPackRelations()
  const currentVersions = Array.from(new Set(allRelations.map((item) => item.currentTechPackVersionNo)))
  const owners = Array.from(new Set(allRelations.map((item) => item.merchandiserName)))
  const stats = {
    total: allRelations.length,
    pending: allRelations.filter((item) => item.relationStatus === 'NEW_VERSION_UNEVALUATED').length,
    reviewing: allRelations.filter((item) => item.relationStatus === 'CHANGE_IN_REVIEW').length,
    patched: allRelations.filter((item) => item.activePatchCount > 0 || item.pendingPatchCount > 0).length,
    locked: allRelations.filter((item) => item.relationStatus === 'LOCKED').length,
  }

  return `
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold">生产单变更</h1>
          <p class="mt-1 text-sm text-muted-foreground">按生产单展示技术包版本关系、生产补丁、进度和硬限制。</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="refresh-tech-pack-change-status">刷新版本状态</button>
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="open-tech-pack-publish-guide">查看发布待评估</button>
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="export-tech-pack-change">导出</button>
        </div>
      </header>

      <section class="grid overflow-hidden rounded-lg border bg-background sm:grid-cols-2 lg:grid-cols-5">
        ${[
          ['生产单数', stats.total],
          ['有新版本未评估', stats.pending],
          ['版本变更审核中', stats.reviewing],
          ['存在生产补丁', stats.patched],
          ['当前进度不可切换', stats.locked],
        ].map(([label, value]) => `
          <article class="border-b px-4 py-3 last:border-b-0 sm:border-r sm:even:border-r-0 lg:border-b-0 lg:even:border-r lg:last:border-r-0">
            <p class="text-xs text-muted-foreground">${escapeHtml(String(label))}</p>
            <p class="mt-1 text-2xl font-semibold">${value}</p>
          </article>
        `).join('')}
      </section>

      <section class="grid gap-3 rounded-lg border bg-background p-3 md:grid-cols-3 xl:grid-cols-5">
        <input data-prod-field="techPackChangeKeyword" value="${escapeHtml(state.techPackChangeKeyword)}" class="rounded-md border px-3 py-2 text-sm" placeholder="生产单号 / SPU / 款式" />
        <select data-prod-field="techPackChangeCurrentVersionFilter" class="rounded-md border px-3 py-2 text-sm">
          ${renderSelectOption('ALL', '全部冻结版本', state.techPackChangeCurrentVersionFilter)}
          ${currentVersions.map((version) => renderSelectOption(version, version, state.techPackChangeCurrentVersionFilter)).join('')}
        </select>
        <select data-prod-field="techPackChangeNewVersionFilter" class="rounded-md border px-3 py-2 text-sm">
          ${renderSelectOption('ALL', '是否存在新正式版', state.techPackChangeNewVersionFilter)}
          ${renderSelectOption('YES', '有新正式版', state.techPackChangeNewVersionFilter)}
          ${renderSelectOption('NO', '无新正式版', state.techPackChangeNewVersionFilter)}
        </select>
        <select data-prod-field="techPackChangePatchFilter" class="rounded-md border px-3 py-2 text-sm">
          ${renderSelectOption('ALL', '是否存在补丁', state.techPackChangePatchFilter)}
          ${renderSelectOption('ACTIVE', '有生效补丁', state.techPackChangePatchFilter)}
          ${renderSelectOption('PENDING', '有待审核补丁', state.techPackChangePatchFilter)}
          ${renderSelectOption('NONE', '无补丁', state.techPackChangePatchFilter)}
        </select>
        <select data-prod-field="techPackChangeStatusFilter" class="rounded-md border px-3 py-2 text-sm">
          ${renderSelectOption('ALL', '版本关系状态', state.techPackChangeStatusFilter)}
          ${(Object.keys(techPackRelationStatusLabels) as TechPackRelationStatus[]).map((status) => renderSelectOption(status, techPackRelationStatusLabels[status], state.techPackChangeStatusFilter)).join('')}
        </select>
        <select data-prod-field="techPackChangeModuleFilter" class="rounded-md border px-3 py-2 text-sm">
          ${renderSelectOption('ALL', '影响模块', state.techPackChangeModuleFilter)}
          ${(Object.keys(techPackChangeModuleLabels) as TechPackChangeModule[]).map((module) => renderSelectOption(module, techPackChangeModuleLabels[module], state.techPackChangeModuleFilter)).join('')}
        </select>
        <select data-prod-field="techPackChangeProgressFilter" class="rounded-md border px-3 py-2 text-sm">
          ${renderSelectOption('ALL', '生产进度', state.techPackChangeProgressFilter)}
          ${progressFilterOptions.map((item) => renderSelectOption(item, item, state.techPackChangeProgressFilter)).join('')}
        </select>
        <select data-prod-field="techPackChangeOwnerFilter" class="rounded-md border px-3 py-2 text-sm">
          ${renderSelectOption('ALL', '跟单负责人', state.techPackChangeOwnerFilter)}
          ${owners.map((owner) => renderSelectOption(owner, owner, state.techPackChangeOwnerFilter)).join('')}
        </select>
      </section>

      <section class="overflow-hidden rounded-lg border bg-background">
        <div class="grid gap-4 border-b bg-muted/20 px-4 py-3 text-xs font-medium text-muted-foreground xl:grid-cols-[1.05fr_1.2fr_1.15fr_0.76fr]">
          <span>生产单</span>
          <span>技术包版本关系 / 模块落地</span>
          <span>版本差异 / 补丁</span>
          <span>进度 / 限制 / 操作</span>
        </div>
        ${relations.length === 0 ? `<div class="px-4 py-12 text-center text-sm text-muted-foreground">暂无符合条件的生产单</div>` : relations.map(renderRelationWorkItem).join('')}
      </section>

      ${renderVersionChangeDialog()}
      ${renderProductionPatchDialog()}
      ${renderPublishGuideDialog()}
      ${renderModuleLandingDialog()}
    </div>
  `
}

function renderDetailTabButtons(): string {
  const tabs: Array<{ key: typeof state.techPackChangeDetailTab; label: string }> = [
    { key: 'relation', label: '版本关系' },
    { key: 'diff', label: '版本对比' },
    { key: 'progress', label: '生产进度' },
    { key: 'restriction', label: '变更限制' },
    { key: 'module-landing', label: '模块落地' },
    { key: 'patch', label: '生产补丁' },
    { key: 'notice', label: '飞书通知' },
    { key: 'logs', label: '操作日志' },
  ]
  return `
    <div class="inline-flex flex-wrap rounded-md border bg-muted/30 p-1">
      ${tabs.map((tab) => `
        <button class="rounded px-3 py-1.5 text-sm ${state.techPackChangeDetailTab === tab.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-prod-action="switch-tech-pack-change-detail-tab" data-tab="${tab.key}">${tab.label}</button>
      `).join('')}
    </div>
  `
}

function renderRelationTab(relation: ProductionOrderTechPackRelation): string {
  const requests = listTechPackChangeRequestsByOrder(relation.productionOrderId)
  const landings = listProductionChangeModuleLandingsByOrder(relation.productionOrderId)
  return `
    <section class="overflow-hidden rounded-lg border bg-background">
      <div class="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
        ${[
          ['生产单', `${relation.productionOrderNo} / ${relation.spuCode} / ${relation.styleName}`],
          ['款式买手', relation.buyerName],
          ['生产跟单', relation.merchandiserName],
          ['当前冻结技术包', `${relation.currentTechPackVersionNo} / 冻结 ${relation.frozenAt}`],
          ['当前最新正式版', `${relation.latestPublishedTechPackVersionNo} / 发布 ${relation.latestPublishedAt}`],
          ['版本关系状态', techPackRelationStatusLabels[relation.relationStatus]],
          ['快照编号', relation.frozenSnapshotId],
          ['关联变更历史', requests.length ? requests.map((item) => item.changeRequestNo).join('、') : '暂无'],
        ].map(([label, value]) => `
          <div class="px-4 py-3">
            <p class="text-xs text-muted-foreground">${escapeHtml(label)}</p>
            <p class="mt-1 text-sm">${escapeHtml(value)}</p>
          </div>
        `).join('')}
      </div>
      <div class="border-t px-4 py-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-semibold">模块落地标识</h3>
            <p class="mt-1 text-xs text-muted-foreground">版本关系和生产补丁在具体业务模块的读取标识。</p>
          </div>
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="switch-tech-pack-change-detail-tab" data-tab="module-landing">查看全部模块</button>
        </div>
        <div class="mt-3 grid gap-2 md:grid-cols-2">
          ${landings.length === 0 ? '<p class="text-sm text-muted-foreground">当前没有模块落地标识。</p>' : landings.slice(0, 4).map((landing) => `
            <div class="border-l-2 border-blue-500 pl-3">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-medium">${escapeHtml(techPackChangeModuleLabels[landing.module])}</span>
                <button class="text-xs text-blue-700 hover:underline" data-prod-action="open-change-module-landing" data-landing-id="${escapeHtml(landing.landingId)}" data-module="${escapeHtml(landing.module)}" data-module-label="${escapeHtml(techPackChangeModuleLabels[landing.module])}">查看落地模块</button>
              </div>
              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(landing.relationMarker)}</p>
              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(landing.patchMarkers[0] || '暂无补丁标识')}</p>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="flex flex-wrap gap-2 border-t px-4 py-4">
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="open-tech-pack-version-change" data-order-id="${escapeHtml(relation.productionOrderId)}">变更版本</button>
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="open-production-patch" data-order-id="${escapeHtml(relation.productionOrderId)}">发起补丁</button>
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="open-order-tech-pack-snapshot" data-order-id="${escapeHtml(relation.productionOrderId)}">查看技术包快照</button>
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="open-current-tech-pack" data-spu-code="${escapeHtml(relation.spuCode)}">查看当前最新技术包</button>
      </div>
    </section>
  `
}

function renderDiffTab(productionOrderId: string): string {
  const diff = getTechPackVersionDiffSnapshot(productionOrderId)
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-base font-semibold">版本对比</h3>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(diff ? `${diff.fromTechPackVersionNo} 对比 ${diff.toTechPackVersionNo}` : '暂无版本差异')}</p>
        </div>
      </div>
      <div class="mt-4 overflow-x-auto rounded-md border">
        <table class="w-full min-w-[1100px] text-sm">
          <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left">变更类型</th>
              <th class="px-3 py-2 text-left">变更对象</th>
              <th class="px-3 py-2 text-left">当前冻结版本</th>
              <th class="px-3 py-2 text-left">目标版本</th>
              <th class="px-3 py-2 text-left">影响范围</th>
              <th class="px-3 py-2 text-left">是否涉及已发生业务</th>
              <th class="px-3 py-2 text-left">相关业务对象</th>
            </tr>
          </thead>
          <tbody>
            ${!diff || diff.items.length === 0 ? renderEmptyRow(7, '暂无版本差异') : diff.items.map((item) => `
              <tr class="border-b last:border-0">
                <td class="px-3 py-2">${escapeHtml(techPackChangeModuleLabels[item.module])} / ${escapeHtml(item.changeType)}</td>
                <td class="px-3 py-2">${escapeHtml(item.objectName)}</td>
                <td class="px-3 py-2">${escapeHtml(item.currentValue)}</td>
                <td class="px-3 py-2">${escapeHtml(item.targetValue)}</td>
                <td class="px-3 py-2">${escapeHtml(item.impactScope)}</td>
                <td class="px-3 py-2">${escapeHtml(item.involvedOccurredBusiness)}</td>
                <td class="px-3 py-2">${escapeHtml(item.relatedObjects.join('、') || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderProgressTab(productionOrderId: string): string {
  const progress = getProductionProgressSnapshot(productionOrderId)
  return `
    <div class="grid gap-4 md:grid-cols-2">
      ${(progress?.sections ?? []).map((section) => `
        <section class="rounded-lg border bg-card p-4">
          <h3 class="text-base font-semibold">${escapeHtml(section.sectionName)}</h3>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(section.statusText)}</p>
          <div class="mt-3 space-y-2">
            ${section.rows.map((row) => `
              <div class="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2 text-sm">
                <span class="text-muted-foreground">${escapeHtml(row.label)}</span>
                <span class="${row.highlight ? 'font-medium text-orange-700' : ''}">${escapeHtml(row.value)}</span>
              </div>
            `).join('')}
          </div>
        </section>
      `).join('')}
    </div>
  `
}

function renderRestrictionTab(productionOrderId: string): string {
  const restriction = getChangeRestrictionSnapshot(productionOrderId)
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">变更限制</h3>
      <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(restriction?.judgementText || '可以提交')}</p>
      <div class="mt-4 overflow-x-auto rounded-md border">
        <table class="w-full min-w-[1000px] text-sm">
          <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left">限制类型</th>
              <th class="px-3 py-2 text-left">影响模块</th>
              <th class="px-3 py-2 text-left">影响对象</th>
              <th class="px-3 py-2 text-left">原因</th>
              <th class="px-3 py-2 text-left">是否阻止版本关系变更</th>
              <th class="px-3 py-2 text-left">是否允许生产补丁</th>
              <th class="px-3 py-2 text-left">相关单据</th>
            </tr>
          </thead>
          <tbody>
            ${!restriction || restriction.items.length === 0 ? renderEmptyRow(7, '当前没有硬限制') : restriction.items.map((item) => `
              <tr class="border-b last:border-0">
                <td class="px-3 py-2">${escapeHtml(item.restrictionType)}</td>
                <td class="px-3 py-2">${escapeHtml(techPackChangeModuleLabels[item.affectedModule])}</td>
                <td class="px-3 py-2">${escapeHtml(item.affectedObject)}</td>
                <td class="px-3 py-2">${escapeHtml(item.reason)}</td>
                <td class="px-3 py-2">${escapeHtml(item.blockVersionChange ? '是' : '否')}</td>
                <td class="px-3 py-2">${escapeHtml(item.allowPatch ? '是' : '否')}</td>
                <td class="px-3 py-2">${escapeHtml(item.relatedDocs.join('、'))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderModuleLandingTab(productionOrderId: string): string {
  const landings = listProductionChangeModuleLandingsByOrder(productionOrderId)
  return `
    <section class="overflow-hidden rounded-lg border bg-background">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4">
        <div>
          <h3 class="text-base font-semibold">模块落地</h3>
          <p class="mt-1 text-sm text-muted-foreground">展示版本关系、补丁在业务模块中的读取标识、责任人、查看入口和最近日志。</p>
        </div>
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="open-production-change-history" data-order-id="${escapeHtml(productionOrderId)}">查看完整日志</button>
      </div>
      <div class="divide-y">
        ${landings.length === 0 ? `<div class="px-4 py-10 text-center text-sm text-muted-foreground">当前没有模块落地标识</div>` : landings.map((landing) => `
          <article class="grid gap-4 px-4 py-4 lg:grid-cols-[0.72fr_1.3fr_1fr_0.72fr]">
            <div>
              <p class="text-sm font-semibold">${escapeHtml(techPackChangeModuleLabels[landing.module])}</p>
              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(landing.ownerRole)}</p>
              <p class="mt-1 text-xs text-muted-foreground">责任人：${escapeHtml(landing.ownerName)}</p>
            </div>
            <div class="space-y-1 text-sm">
              <p>${escapeHtml(landing.relationMarker)}</p>
              ${landing.patchMarkers.length === 0 ? '<p class="text-muted-foreground">补丁标识：暂无</p>' : landing.patchMarkers.map((marker) => `<p>${escapeHtml(marker)}</p>`).join('')}
            </div>
            <div>
              <p class="text-sm">${escapeHtml(landing.landingObject)}</p>
              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(landing.currentRule)}</p>
              <p class="mt-2 text-xs text-muted-foreground">最近日志：${escapeHtml(landing.lastLog)}</p>
            </div>
            <div class="flex flex-wrap content-start gap-2">
              <button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-prod-action="open-change-module-landing" data-landing-id="${escapeHtml(landing.landingId)}" data-module="${escapeHtml(landing.module)}" data-module-label="${escapeHtml(techPackChangeModuleLabels[landing.module])}" data-url="${escapeHtml(landing.viewUrl)}">查看落地模块</button>
              <button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-prod-action="open-change-module-log" data-order-id="${escapeHtml(productionOrderId)}" data-module="${escapeHtml(landing.module)}">查看日志</button>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `
}

function renderPatchTab(productionOrderId: string): string {
  const patches = listProductionPatchesByOrder(productionOrderId)
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-base font-semibold">生产补丁</h3>
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="open-production-patch" data-order-id="${escapeHtml(productionOrderId)}">发起补丁</button>
      </div>
      <div class="mt-4 overflow-x-auto rounded-md border">
        <table class="w-full min-w-[1120px] text-sm">
          <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left">补丁编号</th>
              <th class="px-3 py-2 text-left">补丁类型</th>
              <th class="px-3 py-2 text-left">影响模块</th>
              <th class="px-3 py-2 text-left">生效点</th>
              <th class="px-3 py-2 text-left">生效范围</th>
              <th class="px-3 py-2 text-left">状态</th>
              <th class="px-3 py-2 text-left">申请人</th>
              <th class="px-3 py-2 text-left">审核人</th>
              <th class="px-3 py-2 text-left">生效时间</th>
              <th class="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            ${patches.length === 0 ? renderEmptyRow(10, '暂无生产单补丁') : patches.map((patch: ProductionOrderPatch) => `
              <tr class="border-b last:border-0">
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(patch.patchNo)}</td>
                <td class="px-3 py-2">${escapeHtml(productionPatchTypeLabels[patch.patchType])}</td>
                <td class="px-3 py-2">${escapeHtml(techPackChangeModuleLabels[patch.affectedModule])}</td>
                <td class="px-3 py-2">${escapeHtml(patchEffectivePointLabels[patch.effectivePoint])}</td>
                <td class="px-3 py-2">${escapeHtml(patch.patchScope)}</td>
                <td class="px-3 py-2">${escapeHtml(productionPatchStatusLabels[patch.status])}</td>
                <td class="px-3 py-2">${escapeHtml(patch.submittedBy)}</td>
                <td class="px-3 py-2">${escapeHtml(safeText(patch.approvedBy))}</td>
                <td class="px-3 py-2">${escapeHtml(safeText(patch.effectiveAt))}</td>
                <td class="px-3 py-2">
                  <div class="flex flex-wrap gap-1">
                    <button class="rounded px-2 py-1 text-xs hover:bg-muted" data-prod-action="view-production-patch" data-patch-id="${escapeHtml(patch.patchId)}">查看补丁</button>
                    <button class="rounded px-2 py-1 text-xs hover:bg-muted" data-prod-action="void-production-patch" data-patch-id="${escapeHtml(patch.patchId)}">作废补丁</button>
                    <button class="rounded px-2 py-1 text-xs hover:bg-muted" data-prod-action="open-production-patch-notice" data-order-id="${escapeHtml(productionOrderId)}">查看通知</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderNoticeTab(productionOrderId: string): string {
  const notices = listProductionChangeNoticesByOrder(productionOrderId)
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">飞书通知</h3>
      <div class="mt-4 overflow-x-auto rounded-md border">
        <table class="w-full min-w-[980px] text-sm">
          <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left">通知批次</th>
              <th class="px-3 py-2 text-left">触发事件</th>
              <th class="px-3 py-2 text-left">接收人</th>
              <th class="px-3 py-2 text-left">接收角色</th>
              <th class="px-3 py-2 text-left">所属模块</th>
              <th class="px-3 py-2 text-left">发送状态</th>
              <th class="px-3 py-2 text-left">发送时间</th>
              <th class="px-3 py-2 text-left">飞书消息 ID</th>
              <th class="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            ${notices.length === 0 ? renderEmptyRow(9, '暂无飞书通知') : notices.map((notice) => `
              <tr class="border-b last:border-0">
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(notice.notifyBatchId)}</td>
                <td class="px-3 py-2">${escapeHtml(notice.triggerEvent)}</td>
                <td class="px-3 py-2">${escapeHtml(notice.receiverName)}</td>
                <td class="px-3 py-2">${escapeHtml(notice.receiverRole)}</td>
                <td class="px-3 py-2">${escapeHtml(notice.module === 'COMMON' ? '通用' : techPackChangeModuleLabels[notice.module])}</td>
                <td class="px-3 py-2">${escapeHtml(notice.sendStatus)}</td>
                <td class="px-3 py-2">${escapeHtml(notice.sentAt)}</td>
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(notice.messageId)}</td>
                <td class="px-3 py-2">
                  <button class="rounded px-2 py-1 text-xs hover:bg-muted" data-prod-action="resend-production-change-notice" data-notice-id="${escapeHtml(notice.noticeId)}">重发</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderLogsTab(productionOrderId: string): string {
  const requests = listTechPackChangeRequestsByOrder(productionOrderId)
  const logs = listProductionChangeOperationLogsByOrder(productionOrderId)
  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-base font-semibold">版本关系变更记录</h3>
        <div class="mt-4 overflow-x-auto rounded-md border">
          <table class="w-full min-w-[900px] text-sm">
            <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 text-left">申请单号</th>
                <th class="px-3 py-2 text-left">原版本</th>
                <th class="px-3 py-2 text-left">目标版本</th>
                <th class="px-3 py-2 text-left">状态</th>
                <th class="px-3 py-2 text-left">生效方式</th>
                <th class="px-3 py-2 text-left">申请人</th>
                <th class="px-3 py-2 text-left">申请时间</th>
              </tr>
            </thead>
            <tbody>
              ${requests.length === 0 ? renderEmptyRow(7, '暂无版本关系变更记录') : requests.map((request) => `
                <tr class="border-b last:border-0">
                  <td class="px-3 py-2 font-mono text-xs">${escapeHtml(request.changeRequestNo)}</td>
                  <td class="px-3 py-2">${escapeHtml(request.fromTechPackVersionNo)}</td>
                  <td class="px-3 py-2">${escapeHtml(request.toTechPackVersionNo)}</td>
                  <td class="px-3 py-2">${escapeHtml(techPackChangeRequestStatusLabels[request.status])}</td>
                  <td class="px-3 py-2">${escapeHtml(effectiveModeLabels[request.effectiveMode])}</td>
                  <td class="px-3 py-2">${escapeHtml(request.submittedBy)}</td>
                  <td class="px-3 py-2">${escapeHtml(request.submittedAt)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-base font-semibold">操作日志</h3>
        <div class="mt-4 overflow-x-auto rounded-md border">
          <table class="w-full min-w-[900px] text-sm">
            <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 text-left">时间</th>
                <th class="px-3 py-2 text-left">操作人</th>
                <th class="px-3 py-2 text-left">操作类型</th>
                <th class="px-3 py-2 text-left">操作对象</th>
                <th class="px-3 py-2 text-left">操作前</th>
                <th class="px-3 py-2 text-left">操作后</th>
                <th class="px-3 py-2 text-left">备注</th>
              </tr>
            </thead>
            <tbody>
              ${logs.length === 0 ? renderEmptyRow(7, '暂无操作日志') : logs.map((log) => `
                <tr class="border-b last:border-0">
                  <td class="px-3 py-2">${escapeHtml(log.operatedAt)}</td>
                  <td class="px-3 py-2">${escapeHtml(log.operatorName)}</td>
                  <td class="px-3 py-2">${escapeHtml(log.operationType)}</td>
                  <td class="px-3 py-2">${escapeHtml(log.operationObject)}</td>
                  <td class="px-3 py-2">${escapeHtml(log.beforeText)}</td>
                  <td class="px-3 py-2">${escapeHtml(log.afterText)}</td>
                  <td class="px-3 py-2">${escapeHtml(log.remark)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `
}

export function renderProductionChangeDetailPage(productionOrderId: string): string {
  const detail = getProductionOrderTechPackChangeDetail(productionOrderId)
  const relation = detail.relation
  if (!relation) {
    return `
      <div class="flex min-h-[240px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p>未找到生产单变更判断：${escapeHtml(productionOrderId)}</p>
        <button class="rounded-md border px-4 py-2 hover:bg-muted" data-nav="/fcs/production/changes">返回生产单变更</button>
      </div>
    `
  }

  const tab = state.techPackChangeDetailTab
  const content =
    tab === 'relation'
      ? renderRelationTab(relation)
      : tab === 'diff'
        ? renderDiffTab(productionOrderId)
        : tab === 'progress'
        ? renderProgressTab(productionOrderId)
        : tab === 'restriction'
          ? renderRestrictionTab(productionOrderId)
          : tab === 'module-landing'
            ? renderModuleLandingTab(productionOrderId)
            : tab === 'patch'
              ? renderPatchTab(productionOrderId)
              : tab === 'notice'
                ? renderNoticeTab(productionOrderId)
                : renderLogsTab(productionOrderId)

  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="/fcs/production/changes">返回</button>
            <h1 class="text-xl font-semibold">${escapeHtml(relation.productionOrderNo)} 生产单变更</h1>
            ${renderBadge(techPackRelationStatusLabels[relation.relationStatus], techPackRelationStatusClasses[relation.relationStatus])}
          </div>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(relation.spuCode)} / ${escapeHtml(relation.styleName)} / 当前冻结 ${escapeHtml(relation.currentTechPackVersionNo)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="open-tech-pack-version-change" data-order-id="${escapeHtml(productionOrderId)}">变更版本</button>
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="open-production-patch" data-order-id="${escapeHtml(productionOrderId)}">发起补丁</button>
        </div>
      </header>
      ${renderDetailTabButtons()}
      ${content}
      ${renderVersionChangeDialog()}
      ${renderProductionPatchDialog()}
      ${renderModuleLandingDialog()}
    </div>
  `
}

import {
  escapeHtml,
  state,
  renderBadge,
  renderEmptyRow,
  safeText,
} from './context'
import {
  effectiveModeLabels,
  getChangeRestrictionSnapshot,
  getProductionOrderTechPackChangeDetail,
  getProductionOrderTechPackRelation,
  getProductionProgressSnapshot,
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
  type ProductionPatchType,
  type TechPackChangeModule,
  type TechPackRelationStatus,
} from '../../data/fcs/production-tech-pack-change-domain'

const progressFilterOptions = ['未开始', '已配料', '已领料', '印花中', '染色中', '裁片中', '车缝中', '工艺中']

function renderSelectOption(value: string, label: string, current: string): string {
  return `<option value="${escapeHtml(value)}" ${current === value ? 'selected' : ''}>${escapeHtml(label)}</option>`
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

          <section class="pb-1">
            <h4 class="text-sm font-semibold">步骤 5：提交申请</h4>
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
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-tech-pack-version-change">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="submit-tech-pack-version-change">提交变更申请</button>
        </footer>
      </div>
    </div>
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
  const scopeText = [form.color, form.size, form.material, form.part, form.processNode, form.factory, form.cutOrder, form.markerPlan, form.spreadingOrder, form.processOrder]
    .filter(Boolean)
    .join(' / ')

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-production-patch" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 flex max-h-[88vh] w-[min(1000px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-5 py-4">
          <h3 class="text-lg font-semibold">发起生产单补丁</h3>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(relation.productionOrderNo)} / 当前主版本 ${escapeHtml(relation.currentTechPackVersionNo)}</p>
        </header>
        <div class="space-y-4 overflow-y-auto px-5 py-4">
          <section class="border-b pb-4">
            <h4 class="text-sm font-semibold">步骤 1：选择补丁类型</h4>
            <select data-prod-field="productionPatchType" class="mt-3 w-full rounded-md border px-3 py-2 text-sm">
              ${(Object.keys(productionPatchTypeLabels) as ProductionPatchType[]).map((type) => renderSelectOption(type, productionPatchTypeLabels[type], patchType)).join('')}
            </select>
          </section>
          <section class="border-b pb-4">
            <h4 class="text-sm font-semibold">步骤 2：选择影响范围</h4>
            <div class="mt-3 grid gap-3 md:grid-cols-3">
              ${[
                ['productionPatchColor', '颜色', form.color],
                ['productionPatchSize', '尺码', form.size],
                ['productionPatchMaterial', '物料', form.material],
                ['productionPatchPart', '部位', form.part],
                ['productionPatchProcessNode', '工序节点', form.processNode],
                ['productionPatchFactory', '工厂', form.factory],
                ['productionPatchCutOrder', '裁片单', form.cutOrder],
                ['productionPatchMarkerPlan', '唛架方案', form.markerPlan],
                ['productionPatchSpreadingOrder', '铺布单', form.spreadingOrder],
                ['productionPatchProcessOrder', '工艺单', form.processOrder],
              ].map(([field, label, value]) => `
                <label class="space-y-1 text-sm">
                  <span>${escapeHtml(label)}</span>
                  <input data-prod-field="${escapeHtml(field)}" value="${escapeHtml(value)}" class="w-full rounded-md border px-3 py-2 text-sm" />
                </label>
              `).join('')}
            </div>
            <p class="mt-2 text-xs text-muted-foreground">当前范围：${escapeHtml(scopeText || '尚未明确')}</p>
          </section>
          <section class="border-b pb-4">
            <h4 class="text-sm font-semibold">步骤 3：选择生效点</h4>
            <select data-prod-field="productionPatchEffectivePoint" class="mt-3 w-full rounded-md border px-3 py-2 text-sm">
              ${(Object.keys(patchEffectivePointLabels) as PatchEffectivePoint[]).map((point) => renderSelectOption(point, patchEffectivePointLabels[point], effectivePoint)).join('')}
            </select>
          </section>
          <section class="border-b pb-4">
            <h4 class="text-sm font-semibold">步骤 4：填写补丁内容</h4>
            <div class="mt-3 grid gap-3 md:grid-cols-2">
              <label class="space-y-1 text-sm">
                <span>补丁内容 <span class="text-destructive">*</span></span>
                <textarea data-prod-field="productionPatchContentText" class="min-h-[96px] w-full rounded-md border px-3 py-2 text-sm">${escapeHtml(form.contentText)}</textarea>
              </label>
              <label class="space-y-1 text-sm">
                <span>补丁原因 <span class="text-destructive">*</span></span>
                <textarea data-prod-field="productionPatchReason" class="min-h-[96px] w-full rounded-md border px-3 py-2 text-sm">${escapeHtml(form.reason)}</textarea>
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
  const affected = listProductionOrderTechPackRelations().filter((item) => item.hasNewerPublishedVersion)
  const latest = affected[0] ?? null
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
              <div><span class="text-muted-foreground">SPU</span><div class="font-medium">${escapeHtml(latest?.spuCode || '-')}</div></div>
              <div><span class="text-muted-foreground">版本号</span><div class="font-medium">${escapeHtml(latest?.latestPublishedTechPackVersionNo || '-')}</div></div>
              <div><span class="text-muted-foreground">发布时间</span><div class="font-medium">${escapeHtml(latest?.latestPublishedAt || '-')}</div></div>
              <div><span class="text-muted-foreground">发布人</span><div class="font-medium">陈静</div></div>
            </div>
            <div class="mt-3 text-sm text-muted-foreground">与上一正式版差异模块：物料清单、纸样管理、花型设计</div>
          </section>
          <section class="mb-4">
            <h4 class="text-sm font-semibold">受影响生产单</h4>
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
                  <th class="px-3 py-2 text-left">生产单</th>
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
                    <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.productionOrderNo)}</td>
                    <td class="px-3 py-2">${escapeHtml(item.currentTechPackVersionNo)}</td>
                    <td class="px-3 py-2">${escapeHtml(item.latestPublishedTechPackVersionNo)}</td>
                    <td class="px-3 py-2">${escapeHtml(item.progressSummary[0] || '-')}</td>
                    <td class="px-3 py-2">生效中 ${item.activePatchCount} / 待审核 ${item.pendingPatchCount}</td>
                    <td class="px-3 py-2">${escapeHtml(techPackRelationStatusLabels[item.relationStatus])}</td>
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
          <button class="font-mono text-sm font-semibold text-blue-700 hover:underline" data-prod-action="open-production-change-detail" data-order-id="${escapeHtml(relation.productionOrderId)}">${escapeHtml(relation.productionOrderNo)}</button>
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
    </div>
  `
}

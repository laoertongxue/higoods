import { escapeHtml } from '../utils';
import { EXECUTION_FACTORY_TYPE_SCOPE_LABEL, EXECUTION_TASK_TYPE_SCOPE_LABEL, buildMilestoneRuleLabel, createMilestoneConfig, getFactoryTypeScopeLabel, getMilestoneConfigById, getMilestoneOverdueRuleLabel, getMilestoneProofRequirementLabel, getMilestoneStartRuleLabel, getMilestoneTargetUnitByRuleType, getMilestoneTargetUnitLabel, getTaskTypeScopeLabel, listMilestoneConfigs, listMilestoneProcessOptions, toggleMilestoneConfigEnabled, updateMilestoneConfig, } from '../data/fcs/milestone-configs';
const state = {
    keyword: '',
    enabledFilter: 'ALL',
    overdueFilter: 'ALL',
    drawerConfigId: null,
    drawerMode: 'view',
    formProcessCode: '',
    formProcessNameZh: '',
    formFactoryTypeScope: 'PROCESS_FACTORY',
    formTaskTypeScope: 'ALL',
    formStartRequired: true,
    formStartProofRequirement: 'IMAGE_OR_VIDEO',
    formStartDueHours: '48',
    formEnabled: true,
    formRuleType: 'AFTER_N_PIECES',
    formTargetQty: '5',
    formProofRequirement: 'IMAGE_OR_VIDEO',
    formOverdueEnabled: true,
    formOverdueHours: '48',
    formRemark: '',
};
function showMilestoneConfigToast(message) {
    if (typeof document === 'undefined' || typeof window === 'undefined')
        return;
    const rootId = 'milestone-config-toast-root';
    let root = document.getElementById(rootId);
    if (!root) {
        root = document.createElement('div');
        root.id = rootId;
        root.className = 'pointer-events-none fixed right-6 top-20 z-[120] flex max-w-sm flex-col gap-2';
        document.body.appendChild(root);
    }
    const toast = document.createElement('div');
    toast.className =
        'pointer-events-auto rounded-md border bg-background px-4 py-3 text-sm text-foreground shadow-md transition-all duration-200';
    toast.textContent = message;
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-6px)';
    root.appendChild(toast);
    window.requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });
    window.setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-6px)';
        window.setTimeout(() => {
            toast.remove();
            if (root && root.childElementCount === 0)
                root.remove();
        }, 180);
    }, 2200);
}
function getStatusBadge(enabled) {
    return enabled
        ? '<span class="inline-flex items-center rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700">已启用</span>'
        : '<span class="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">未启用</span>';
}
function getOverdueBadge(config) {
    if (!config.enabled || !config.overdueExceptionEnabled) {
        return '<span class="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">未启用</span>';
    }
    return `<span class="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">${escapeHtml(getMilestoneOverdueRuleLabel(config))}</span>`;
}
function getFilteredConfigs() {
    const keyword = state.keyword.trim().toLowerCase();
    return listMilestoneConfigs().filter((item) => {
        if (keyword) {
            const haystack = `${item.processCode} ${item.processNameZh} ${item.factoryTypeScopeLabel} ${item.taskTypeScopeLabel}`.toLowerCase();
            if (!haystack.includes(keyword))
                return false;
        }
        if (state.enabledFilter === 'YES' && !item.enabled)
            return false;
        if (state.enabledFilter === 'NO' && item.enabled)
            return false;
        const overdueEnabled = item.enabled && item.overdueExceptionEnabled;
        if (state.overdueFilter === 'YES' && !overdueEnabled)
            return false;
        if (state.overdueFilter === 'NO' && overdueEnabled)
            return false;
        return true;
    });
}
function resetFormDefaults() {
    const options = listMilestoneProcessOptions();
    state.formProcessCode = options[0]?.processCode || '';
    state.formProcessNameZh = options[0]?.processNameZh || '';
    state.formFactoryTypeScope = 'PROCESS_FACTORY';
    state.formTaskTypeScope = 'ALL';
    state.formStartRequired = true;
    state.formStartProofRequirement = 'IMAGE_OR_VIDEO';
    state.formStartDueHours = '48';
    state.formEnabled = true;
    state.formRuleType = 'AFTER_N_PIECES';
    state.formTargetQty = '5';
    state.formProofRequirement = 'IMAGE_OR_VIDEO';
    state.formOverdueEnabled = true;
    state.formOverdueHours = '48';
    state.formRemark = '';
}
function syncFormFromConfig(config) {
    state.formProcessCode = config.processCode;
    state.formProcessNameZh = config.processNameZh;
    state.formFactoryTypeScope = config.factoryTypeScope;
    state.formTaskTypeScope = config.taskTypeScope;
    state.formStartRequired = config.startRequired;
    state.formStartProofRequirement = config.startProofRequirement;
    state.formStartDueHours = String(config.startDueHours);
    state.formEnabled = config.enabled;
    state.formRuleType = config.ruleType;
    state.formTargetQty = String(config.targetQty);
    state.formProofRequirement = config.proofRequirement;
    state.formOverdueEnabled = config.overdueExceptionEnabled;
    state.formOverdueHours = String(config.overdueHours);
    state.formRemark = config.remark || '';
}
function openDrawer(configId, mode) {
    const config = getMilestoneConfigById(configId);
    if (!config)
        return;
    state.drawerConfigId = configId;
    state.drawerMode = mode;
    syncFormFromConfig(config);
}
function openCreateDrawer() {
    state.drawerConfigId = null;
    state.drawerMode = 'create';
    resetFormDefaults();
}
function closeDrawer() {
    state.drawerConfigId = null;
    state.drawerMode = 'view';
}
function getCurrentRuleLabelPreview() {
    const qty = Math.max(1, Number.parseInt(state.formTargetQty || '1', 10) || 1);
    return buildMilestoneRuleLabel(state.formRuleType, qty);
}
function renderHeader() {
    return `
    <header class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="space-y-1">
          <h1 class="text-xl font-semibold">开工与关键节点上报配置</h1>
          <p class="text-sm text-muted-foreground">按工序工艺、工厂类型和任务类型配置是否要求开工、开工凭证、关键节点上报及凭证要求。</p>
          <p class="text-xs text-muted-foreground">启用后，工厂端移动应用按匹配规则展示开工时限和关键节点；若开启超时异常，逾期未上报会进入执行异常。</p>
        </div>
        <button class="inline-flex h-9 items-center rounded-md border bg-primary px-3 text-sm text-primary-foreground hover:opacity-90" data-milestone-action="open-create-config">
          <i data-lucide="plus" class="mr-1.5 h-4 w-4"></i>新增配置
        </button>
      </div>
    </header>
  `;
}
function renderFilters() {
    return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">规则搜索</span>
          <input
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            placeholder="搜索工序 / 工厂类型 / 任务类型"
            data-milestone-field="keyword"
            value="${escapeHtml(state.keyword)}"
          />
        </label>

        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">节点上报</span>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-milestone-field="enabledFilter">
            <option value="ALL" ${state.enabledFilter === 'ALL' ? 'selected' : ''}>全部</option>
            <option value="YES" ${state.enabledFilter === 'YES' ? 'selected' : ''}>已启用</option>
            <option value="NO" ${state.enabledFilter === 'NO' ? 'selected' : ''}>未启用</option>
          </select>
        </label>

        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">超时异常</span>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-milestone-field="overdueFilter">
            <option value="ALL" ${state.overdueFilter === 'ALL' ? 'selected' : ''}>全部</option>
            <option value="YES" ${state.overdueFilter === 'YES' ? 'selected' : ''}>已启用</option>
            <option value="NO" ${state.overdueFilter === 'NO' ? 'selected' : ''}>未启用</option>
          </select>
        </label>

        <div class="flex items-end">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-milestone-action="reset-filters">
            <i data-lucide="rotate-ccw" class="mr-1.5 h-4 w-4"></i>重置
          </button>
        </div>
      </div>
    </section>
  `;
}
function renderTable(configs) {
    return `
    <section class="rounded-lg border bg-card">
      <header class="flex items-center justify-between px-4 py-3">
        <h2 class="text-base font-semibold">开工与关键节点规则</h2>
        <p class="text-xs text-muted-foreground">共 ${configs.length} 条</p>
      </header>

      <div class="overflow-x-auto border-t">
        <table class="w-full min-w-[1320px] text-sm">
          <thead class="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">适用规则</th>
              <th class="px-3 py-2 font-medium">开工要求</th>
              <th class="px-3 py-2 font-medium">开工凭证</th>
              <th class="px-3 py-2 font-medium">节点上报</th>
              <th class="px-3 py-2 font-medium">上报规则</th>
              <th class="px-3 py-2 font-medium">节点凭证</th>
              <th class="px-3 py-2 font-medium">超时异常</th>
              <th class="px-3 py-2 font-medium">更新时间</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${configs.length === 0
        ? `
                  <tr>
                    <td colspan="9" class="px-3 py-10 text-center text-sm text-muted-foreground">暂无符合条件的开工与关键节点配置</td>
                  </tr>
                `
        : configs
            .map((item) => {
            const toggleLabel = item.enabled ? '停用' : '启用';
            return `
                        <tr class="border-t align-top">
                          <td class="px-3 py-3">
                            <p class="font-medium">${escapeHtml(item.processNameZh)}</p>
                            <p class="text-xs text-muted-foreground">${escapeHtml(item.processCode)}</p>
                            <div class="mt-2 flex flex-wrap gap-1.5">
                              <span class="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">${escapeHtml(getFactoryTypeScopeLabel(item.factoryTypeScope))}</span>
                              <span class="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">${escapeHtml(getTaskTypeScopeLabel(item.taskTypeScope))}</span>
                            </div>
                          </td>
                          <td class="px-3 py-3 text-xs">${escapeHtml(getMilestoneStartRuleLabel(item))}</td>
                          <td class="px-3 py-3 text-xs">${escapeHtml(getMilestoneProofRequirementLabel(item.startProofRequirement))}</td>
                          <td class="px-3 py-3">${getStatusBadge(item.enabled)}</td>
                          <td class="px-3 py-3 text-xs">
                            ${item.enabled ? escapeHtml(item.ruleLabel) : '<span class="text-muted-foreground">未启用节点上报</span>'}
                          </td>
                          <td class="px-3 py-3 text-xs">${escapeHtml(getMilestoneProofRequirementLabel(item.proofRequirement))}</td>
                          <td class="px-3 py-3 text-xs">${getOverdueBadge(item)}</td>
                          <td class="px-3 py-3 text-xs">
                            <p>${escapeHtml(item.updatedAt)}</p>
                            <p class="text-muted-foreground">更新人：${escapeHtml(item.updatedBy)}</p>
                          </td>
                          <td class="px-3 py-3 text-xs">
                            <div class="flex flex-wrap items-center gap-2">
                              <button class="inline-flex h-7 items-center rounded-md border px-2.5 hover:bg-muted" data-milestone-action="view-config" data-config-id="${escapeHtml(item.id)}">查看</button>
                              <button class="inline-flex h-7 items-center rounded-md border px-2.5 hover:bg-muted" data-milestone-action="edit-config" data-config-id="${escapeHtml(item.id)}">编辑</button>
                              <button class="inline-flex h-7 items-center rounded-md border px-2.5 hover:bg-muted" data-milestone-action="toggle-config" data-config-id="${escapeHtml(item.id)}">${toggleLabel}</button>
                            </div>
                          </td>
                        </tr>
                      `;
        })
            .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}
function renderDrawer() {
    if (state.drawerMode !== 'create' && !state.drawerConfigId)
        return '';
    const config = state.drawerConfigId ? getMilestoneConfigById(state.drawerConfigId) : undefined;
    if (state.drawerMode !== 'create' && !config)
        return '';
    const isCreate = state.drawerMode === 'create';
    const readOnly = state.drawerMode === 'view';
    const readOnlyAttr = readOnly ? 'disabled' : '';
    const processOptions = listMilestoneProcessOptions();
    const unitLabel = getMilestoneTargetUnitLabel(getMilestoneTargetUnitByRuleType(state.formRuleType));
    const ruleLabelPreview = config &&
        config.ruleType === state.formRuleType &&
        String(config.targetQty) === state.formTargetQty
        ? config.ruleLabel
        : getCurrentRuleLabelPreview();
    return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-milestone-action="close-drawer" aria-label="关闭"></button>
      <aside class="absolute inset-y-0 right-0 w-full max-w-[640px] overflow-y-auto border-l bg-background shadow-2xl">
        <header class="sticky top-0 z-10 border-b bg-background px-5 py-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold">${isCreate ? '新增开工与节点配置' : readOnly ? '开工与节点配置详情' : '编辑开工与节点配置'}</h3>
              <p class="text-xs text-muted-foreground">${state.formProcessCode
        ? `${escapeHtml(state.formProcessNameZh)}（${escapeHtml(state.formProcessCode)}）`
        : '请选择工序工艺'}</p>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-milestone-action="close-drawer">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>
        </header>

        <div class="space-y-4 px-5 py-4">
          <section class="rounded-lg border p-4">
            <h4 class="text-sm font-semibold">工序工艺</h4>
            <div class="mt-3">
              ${isCreate
        ? `
                    <label class="space-y-1">
                      <span class="text-xs text-muted-foreground">工序工艺 *</span>
                      <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-milestone-field="formProcessCode" ${readOnlyAttr}>
                        <option value="">请选择工序工艺</option>
                        ${processOptions
            .map((item) => `<option value="${escapeHtml(item.processCode)}" data-process-name="${escapeHtml(item.processNameZh)}" ${state.formProcessCode === item.processCode ? 'selected' : ''}>${escapeHtml(item.processNameZh)}（${escapeHtml(item.processCode)}）</option>`)
            .join('')}
                      </select>
                    </label>
                    <p class="mt-2 text-xs text-muted-foreground">同一工序可按不同工厂类型、任务类型配置多条规则。</p>
                  `
        : `<div class="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">${escapeHtml(state.formProcessNameZh)}（${escapeHtml(state.formProcessCode)}）</div>`}
            </div>
          </section>

          <section class="rounded-lg border p-4">
            <h4 class="text-sm font-semibold">适用范围</h4>
            <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="space-y-1">
                <span class="text-xs text-muted-foreground">工厂类型 *</span>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-milestone-field="formFactoryTypeScope" ${readOnlyAttr}>
                  ${Object.entries(EXECUTION_FACTORY_TYPE_SCOPE_LABEL)
        .map(([value, label]) => `<option value="${escapeHtml(value)}" ${state.formFactoryTypeScope === value ? 'selected' : ''}>${escapeHtml(label)}</option>`)
        .join('')}
                </select>
              </label>
              <label class="space-y-1">
                <span class="text-xs text-muted-foreground">任务类型 *</span>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-milestone-field="formTaskTypeScope" ${readOnlyAttr}>
                  ${Object.entries(EXECUTION_TASK_TYPE_SCOPE_LABEL)
        .map(([value, label]) => `<option value="${escapeHtml(value)}" ${state.formTaskTypeScope === value ? 'selected' : ''}>${escapeHtml(label)}</option>`)
        .join('')}
                </select>
              </label>
            </div>
          </section>

          <section class="rounded-lg border p-4">
            <h4 class="text-sm font-semibold">开工要求</h4>
            <div class="mt-3 space-y-3">
              <label class="space-y-1">
                <span class="text-xs text-muted-foreground">是否要求开工</span>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-milestone-field="formStartRequired" ${readOnlyAttr}>
                  <option value="YES" ${state.formStartRequired ? 'selected' : ''}>要求开工</option>
                  <option value="NO" ${!state.formStartRequired ? 'selected' : ''}>不要求开工</option>
                </select>
              </label>
              <label class="space-y-1">
                <span class="text-xs text-muted-foreground">开工凭证要求</span>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-milestone-field="formStartProofRequirement" ${readOnlyAttr}>
                  <option value="NONE" ${state.formStartProofRequirement === 'NONE' ? 'selected' : ''}>不要求凭证</option>
                  <option value="IMAGE" ${state.formStartProofRequirement === 'IMAGE' ? 'selected' : ''}>要求上传图片</option>
                  <option value="VIDEO" ${state.formStartProofRequirement === 'VIDEO' ? 'selected' : ''}>要求上传视频</option>
                  <option value="IMAGE_OR_VIDEO" ${state.formStartProofRequirement === 'IMAGE_OR_VIDEO' ? 'selected' : ''}>图片或视频任选其一</option>
                </select>
              </label>
              <label class="space-y-1">
                <span class="text-xs text-muted-foreground">接单 / 中标后 N 小时内开工</span>
                <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-milestone-field="formStartDueHours" value="${escapeHtml(state.formStartDueHours)}" ${readOnlyAttr} />
              </label>
              <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                移动端展示文案：${escapeHtml(state.formStartRequired ? `要求开工，${state.formStartDueHours || 'N'} 小时内确认` : '不要求开工')}
              </div>
            </div>
          </section>

          <section class="rounded-lg border p-4">
            <h4 class="text-sm font-semibold">关键节点上报要求</h4>
            <div class="mt-3 space-y-3">
              <label class="space-y-1">
                <span class="text-xs text-muted-foreground">是否要求关键节点上报</span>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-milestone-field="formEnabled" ${readOnlyAttr}>
                  <option value="YES" ${state.formEnabled ? 'selected' : ''}>启用</option>
                  <option value="NO" ${!state.formEnabled ? 'selected' : ''}>不启用</option>
                </select>
              </label>

              <label class="space-y-1">
                <span class="text-xs text-muted-foreground">规则类型</span>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-milestone-field="formRuleType" ${readOnlyAttr}>
                  <option value="AFTER_N_PIECES" ${state.formRuleType === 'AFTER_N_PIECES' ? 'selected' : ''}>完成第 N 件后上报</option>
                  <option value="AFTER_N_YARD" ${state.formRuleType === 'AFTER_N_YARD' ? 'selected' : ''}>完成第 N Yard 后上报</option>
                </select>
              </label>

              <label class="space-y-1">
                <span class="text-xs text-muted-foreground">阈值 N（${escapeHtml(unitLabel)}）</span>
                <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-milestone-field="formTargetQty" value="${escapeHtml(state.formTargetQty)}" ${readOnlyAttr} />
              </label>

              <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                移动端展示文案：${escapeHtml(ruleLabelPreview)}
              </div>
            </div>
          </section>

          <section class="rounded-lg border p-4">
            <h4 class="text-sm font-semibold">关键节点凭证要求</h4>
            <div class="mt-3">
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-milestone-field="formProofRequirement" ${readOnlyAttr}>
                <option value="NONE" ${state.formProofRequirement === 'NONE' ? 'selected' : ''}>不要求凭证</option>
                <option value="IMAGE" ${state.formProofRequirement === 'IMAGE' ? 'selected' : ''}>要求上传图片</option>
                <option value="VIDEO" ${state.formProofRequirement === 'VIDEO' ? 'selected' : ''}>要求上传视频</option>
                <option value="IMAGE_OR_VIDEO" ${state.formProofRequirement === 'IMAGE_OR_VIDEO' ? 'selected' : ''}>图片或视频任选其一</option>
              </select>
            </div>
          </section>

          <section class="rounded-lg border p-4">
            <h4 class="text-sm font-semibold">超时异常</h4>
            <div class="mt-3 space-y-3">
              <label class="space-y-1">
                <span class="text-xs text-muted-foreground">是否启用超时异常</span>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-milestone-field="formOverdueEnabled" ${readOnlyAttr}>
                  <option value="YES" ${state.formOverdueEnabled ? 'selected' : ''}>启用</option>
                  <option value="NO" ${!state.formOverdueEnabled ? 'selected' : ''}>不启用</option>
                </select>
              </label>
              <label class="space-y-1">
                <span class="text-xs text-muted-foreground">开工后 N 小时未上报</span>
                <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-milestone-field="formOverdueHours" value="${escapeHtml(state.formOverdueHours)}" ${readOnlyAttr} />
              </label>
              <div class="grid grid-cols-2 gap-3 text-xs">
                <p class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">异常分类：执行异常</p>
                <p class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">异常原因：关键节点未上报</p>
              </div>
            </div>
          </section>

          <section class="rounded-lg border p-4">
            <h4 class="text-sm font-semibold">备注</h4>
            <textarea
              class="mt-3 min-h-[92px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="可选：补充说明该工序关键节点规则"
              data-milestone-field="formRemark"
              ${readOnlyAttr}
            >${escapeHtml(state.formRemark)}</textarea>
          </section>
        </div>

        <footer class="sticky bottom-0 border-t bg-background px-5 py-3">
          <div class="flex items-center justify-end gap-2">
            ${readOnly
        ? `<button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-milestone-action="switch-edit">编辑</button>`
        : `<button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-milestone-action="cancel-edit">取消</button>
                   <button class="inline-flex h-9 items-center rounded-md border bg-primary px-4 text-sm text-primary-foreground hover:opacity-90" data-milestone-action="save-config">${isCreate ? '新增配置' : '保存'}</button>`}
          </div>
        </footer>
      </aside>
    </div>
  `;
}
export function renderProgressMilestoneConfigPage() {
    const configs = getFilteredConfigs();
    return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderFilters()}
      ${renderTable(configs)}
      ${renderDrawer()}
    </div>
  `;
}
function updateField(field, node) {
    if (field === 'keyword' && node instanceof HTMLInputElement) {
        state.keyword = node.value;
        return;
    }
    if (field === 'enabledFilter' && node instanceof HTMLSelectElement) {
        state.enabledFilter = node.value;
        return;
    }
    if (field === 'overdueFilter' && node instanceof HTMLSelectElement) {
        state.overdueFilter = node.value;
        return;
    }
    if (field === 'formProcessCode' && node instanceof HTMLSelectElement) {
        state.formProcessCode = node.value;
        const matched = listMilestoneProcessOptions().find((item) => item.processCode === node.value);
        state.formProcessNameZh = matched?.processNameZh || '';
        return;
    }
    if (field === 'formFactoryTypeScope' && node instanceof HTMLSelectElement) {
        state.formFactoryTypeScope = node.value;
        return;
    }
    if (field === 'formTaskTypeScope' && node instanceof HTMLSelectElement) {
        state.formTaskTypeScope = node.value;
        return;
    }
    if (field === 'formStartRequired' && node instanceof HTMLSelectElement) {
        state.formStartRequired = node.value === 'YES';
        return;
    }
    if (field === 'formStartProofRequirement' && node instanceof HTMLSelectElement) {
        state.formStartProofRequirement = node.value;
        return;
    }
    if (field === 'formStartDueHours' && node instanceof HTMLInputElement) {
        state.formStartDueHours = node.value;
        return;
    }
    if (field === 'formEnabled' && node instanceof HTMLSelectElement) {
        state.formEnabled = node.value === 'YES';
        return;
    }
    if (field === 'formRuleType' && node instanceof HTMLSelectElement) {
        state.formRuleType = node.value;
        return;
    }
    if (field === 'formTargetQty' && node instanceof HTMLInputElement) {
        state.formTargetQty = node.value;
        return;
    }
    if (field === 'formProofRequirement' && node instanceof HTMLSelectElement) {
        state.formProofRequirement = node.value;
        return;
    }
    if (field === 'formOverdueEnabled' && node instanceof HTMLSelectElement) {
        state.formOverdueEnabled = node.value === 'YES';
        return;
    }
    if (field === 'formOverdueHours' && node instanceof HTMLInputElement) {
        state.formOverdueHours = node.value;
        return;
    }
    if (field === 'formRemark' && node instanceof HTMLTextAreaElement) {
        state.formRemark = node.value;
    }
}
function saveCurrentConfig() {
    const targetQty = Number.parseInt(state.formTargetQty, 10);
    if (!Number.isInteger(targetQty) || targetQty <= 0) {
        showMilestoneConfigToast('请填写有效的阈值 N（正整数）');
        return;
    }
    const startDueHours = Number.parseInt(state.formStartDueHours, 10);
    if (!Number.isInteger(startDueHours) || startDueHours <= 0) {
        showMilestoneConfigToast('请填写有效的开工时限小时数（正整数）');
        return;
    }
    const overdueHours = Number.parseInt(state.formOverdueHours, 10);
    if (!Number.isInteger(overdueHours) || overdueHours <= 0) {
        showMilestoneConfigToast('请填写有效的超时小时数（正整数）');
        return;
    }
    if (state.drawerMode === 'create') {
        if (!state.formProcessCode || !state.formProcessNameZh) {
            showMilestoneConfigToast('请选择工序工艺');
            return;
        }
        const createdResult = createMilestoneConfig({
            processCode: state.formProcessCode,
            processNameZh: state.formProcessNameZh,
            factoryTypeScope: state.formFactoryTypeScope,
            taskTypeScope: state.formTaskTypeScope,
            startRequired: state.formStartRequired,
            startProofRequirement: state.formStartProofRequirement,
            startDueHours,
            enabled: state.formEnabled,
            ruleType: state.formRuleType,
            targetQty,
            proofRequirement: state.formProofRequirement,
            overdueExceptionEnabled: state.formOverdueEnabled,
            overdueHours,
            remark: state.formRemark.trim(),
        }, '平台运营');
        if (!createdResult.ok || !createdResult.config) {
            showMilestoneConfigToast(createdResult.message || '新增失败，请稍后重试');
            return;
        }
        state.drawerConfigId = createdResult.config.id;
        state.drawerMode = 'view';
        syncFormFromConfig(createdResult.config);
        showMilestoneConfigToast('新增配置成功');
        return;
    }
    if (!state.drawerConfigId)
        return;
    const updated = updateMilestoneConfig(state.drawerConfigId, {
        factoryTypeScope: state.formFactoryTypeScope,
        taskTypeScope: state.formTaskTypeScope,
        startRequired: state.formStartRequired,
        startProofRequirement: state.formStartProofRequirement,
        startDueHours,
        enabled: state.formEnabled,
        ruleType: state.formRuleType,
        targetQty,
        proofRequirement: state.formProofRequirement,
        overdueExceptionEnabled: state.formOverdueEnabled,
        overdueHours,
        remark: state.formRemark.trim(),
    }, '平台运营');
    if (!updated) {
        showMilestoneConfigToast('保存失败，配置不存在');
        return;
    }
    state.drawerMode = 'view';
    syncFormFromConfig(updated);
    showMilestoneConfigToast('开工与关键节点配置已更新');
}
function handleAction(action, actionNode) {
    if (action === 'reset-filters') {
        state.keyword = '';
        state.enabledFilter = 'ALL';
        state.overdueFilter = 'ALL';
        return true;
    }
    if (action === 'open-create-config') {
        openCreateDrawer();
        return true;
    }
    if (action === 'view-config') {
        const configId = actionNode.dataset.configId;
        if (configId)
            openDrawer(configId, 'view');
        return true;
    }
    if (action === 'edit-config') {
        const configId = actionNode.dataset.configId;
        if (configId)
            openDrawer(configId, 'edit');
        return true;
    }
    if (action === 'toggle-config') {
        const configId = actionNode.dataset.configId;
        if (!configId)
            return true;
        const current = getMilestoneConfigById(configId);
        if (!current)
            return true;
        const updated = toggleMilestoneConfigEnabled(configId, !current.enabled, '平台运营');
        if (!updated)
            return true;
        showMilestoneConfigToast(updated.enabled ? '节点上报已启用' : '节点上报已停用');
        if (state.drawerConfigId === configId) {
            state.drawerMode = 'view';
            syncFormFromConfig(updated);
        }
        return true;
    }
    if (action === 'close-drawer') {
        closeDrawer();
        return true;
    }
    if (action === 'switch-edit') {
        state.drawerMode = 'edit';
        return true;
    }
    if (action === 'cancel-edit') {
        if (state.drawerMode === 'create') {
            closeDrawer();
            return true;
        }
        if (state.drawerConfigId) {
            const config = getMilestoneConfigById(state.drawerConfigId);
            if (config)
                syncFormFromConfig(config);
        }
        state.drawerMode = 'view';
        return true;
    }
    if (action === 'save-config') {
        saveCurrentConfig();
        return true;
    }
    return false;
}
export function handleProgressMilestoneConfigEvent(target) {
    const fieldNode = target.closest('[data-milestone-field]');
    if (fieldNode instanceof HTMLInputElement ||
        fieldNode instanceof HTMLSelectElement ||
        fieldNode instanceof HTMLTextAreaElement) {
        const field = fieldNode.dataset.milestoneField;
        if (!field)
            return true;
        updateField(field, fieldNode);
        return true;
    }
    const actionNode = target.closest('[data-milestone-action]');
    if (!actionNode)
        return false;
    const action = actionNode.dataset.milestoneAction;
    if (!action)
        return false;
    return handleAction(action, actionNode);
}
export function isProgressMilestoneConfigDialogOpen() {
    return state.drawerMode === 'create' || Boolean(state.drawerConfigId);
}

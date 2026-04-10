import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { getPatternLibraryConfig, updatePatternLibraryConfig } from '../data/pcs-pattern-library'
import { formatPatternCategoryTreeText, parsePatternCategoryTreeText } from '../utils/pcs-pattern-library-services'

interface PatternLibraryConfigState {
  usageTypes: string
  categoryTreeText: string
  styleTags: string
  primaryColors: string
  sourceTypes: string
  namingRuleTemplate: string
  rulePrimaryColor: boolean
  ruleUsageType: boolean
  ruleCategory: boolean
  ruleFilenameTokens: boolean
  similarityThreshold: string
  notice: string | null
}

const state: PatternLibraryConfigState = {
  usageTypes: '',
  categoryTreeText: '',
  styleTags: '',
  primaryColors: '',
  sourceTypes: '',
  namingRuleTemplate: '',
  rulePrimaryColor: true,
  ruleUsageType: true,
  ruleCategory: true,
  ruleFilenameTokens: true,
  similarityThreshold: '12',
  notice: null,
}

let initialized = false

function syncState(): void {
  if (initialized) return
  const config = getPatternLibraryConfig()
  state.usageTypes = config.usageTypes.join('，')
  state.categoryTreeText = formatPatternCategoryTreeText(config.categoryTree)
  state.styleTags = config.styleTags.join('，')
  state.primaryColors = config.primaryColors.join('，')
  state.sourceTypes = config.sourceTypes.join('，')
  state.namingRuleTemplate = config.namingRuleTemplate
  state.rulePrimaryColor = config.ruleToggles.primaryColor
  state.ruleUsageType = config.ruleToggles.usageType
  state.ruleCategory = config.ruleToggles.category
  state.ruleFilenameTokens = config.ruleToggles.filenameTokens
  state.similarityThreshold = String(config.similarityThreshold)
  initialized = true
}

function parseValues(value: string): string[] {
  return value
    .split(/[，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="h-8 rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-100" data-pattern-library-config-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

export function renderPcsPatternLibraryConfigPage(): string {
  syncState()
  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-pattern-library-config-action="go-list">
            <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回花型库
          </button>
          <p class="mt-3 text-xs text-gray-500">工程开发与打样管理 / 花型库 / 配置</p>
          <h1 class="mt-2 text-xl font-semibold">花型库配置</h1>
          <p class="mt-1 text-sm text-gray-500">维护花型使用方式、题材分类、风格标签、主色系、来源类型、命名规则模板和相似度阈值。</p>
        </div>
        <button class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-pattern-library-config-action="save">保存配置</button>
      </header>

      ${renderNotice()}

      <section class="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside class="rounded-lg border bg-white p-4">
          <h2 class="text-sm font-semibold">配置维度</h2>
          <div class="mt-3 space-y-2 text-sm text-gray-600">
            <p>花型使用方式</p>
            <p>题材分类</p>
            <p>风格标签</p>
            <p>主色系</p>
            <p>来源类型</p>
            <p>授权状态</p>
            <p>命名规则模板</p>
            <p>自动标签规则开关</p>
            <p>相似度阈值</p>
          </div>
        </aside>

        <div class="space-y-4">
          <section class="rounded-lg border bg-white p-4">
            <h3 class="text-base font-semibold">字典维护</h3>
            <div class="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label class="mb-1 block text-sm font-medium">花型使用方式</label>
                <textarea class="min-h-[96px] w-full rounded-md border px-3 py-2 text-sm" data-pattern-library-config-field="usageTypes">${escapeHtml(state.usageTypes)}</textarea>
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium">题材分类树</label>
                <textarea class="min-h-[140px] w-full rounded-md border px-3 py-2 text-sm" data-pattern-library-config-field="categoryTreeText">${escapeHtml(state.categoryTreeText)}</textarea>
                <p class="mt-1 text-xs text-gray-500">按“一级 &gt; 二级1|二级2|二级3”维护，每行一组。</p>
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium">风格标签</label>
                <textarea class="min-h-[96px] w-full rounded-md border px-3 py-2 text-sm" data-pattern-library-config-field="styleTags">${escapeHtml(state.styleTags)}</textarea>
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium">主色系</label>
                <textarea class="min-h-[96px] w-full rounded-md border px-3 py-2 text-sm" data-pattern-library-config-field="primaryColors">${escapeHtml(state.primaryColors)}</textarea>
              </div>
              <div class="md:col-span-2">
                <label class="mb-1 block text-sm font-medium">来源类型</label>
                <textarea class="min-h-[72px] w-full rounded-md border px-3 py-2 text-sm" data-pattern-library-config-field="sourceTypes">${escapeHtml(state.sourceTypes)}</textarea>
              </div>
            </div>
          </section>

          <section class="rounded-lg border bg-white p-4">
            <h3 class="text-base font-semibold">规则与阈值</h3>
            <div class="mt-4 grid gap-4 md:grid-cols-2">
              <div class="md:col-span-2">
                <label class="mb-1 block text-sm font-medium">命名规则模板</label>
                <input class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.namingRuleTemplate)}" data-pattern-library-config-field="namingRuleTemplate" />
              </div>
              <label class="flex items-center justify-between rounded-lg border p-3 text-sm">
                <span>自动标签：主色系</span>
                <input type="checkbox" class="h-4 w-4" ${state.rulePrimaryColor ? 'checked' : ''} data-pattern-library-config-action="toggle-rule" data-rule="primaryColor" />
              </label>
              <label class="flex items-center justify-between rounded-lg border p-3 text-sm">
                <span>自动标签：花型使用方式</span>
                <input type="checkbox" class="h-4 w-4" ${state.ruleUsageType ? 'checked' : ''} data-pattern-library-config-action="toggle-rule" data-rule="usageType" />
              </label>
              <label class="flex items-center justify-between rounded-lg border p-3 text-sm">
                <span>自动标签：题材分类</span>
                <input type="checkbox" class="h-4 w-4" ${state.ruleCategory ? 'checked' : ''} data-pattern-library-config-action="toggle-rule" data-rule="category" />
              </label>
              <label class="flex items-center justify-between rounded-lg border p-3 text-sm">
                <span>自动标签：文件名 Token</span>
                <input type="checkbox" class="h-4 w-4" ${state.ruleFilenameTokens ? 'checked' : ''} data-pattern-library-config-action="toggle-rule" data-rule="filenameTokens" />
              </label>
              <div>
                <label class="mb-1 block text-sm font-medium">相似度阈值</label>
                <input type="number" class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.similarityThreshold)}" data-pattern-library-config-field="similarityThreshold" />
                <p class="mt-1 text-xs text-gray-500">用于 pHash 视觉相似检测，数字越小越严格。</p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  `
}

export function handlePcsPatternLibraryConfigEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pattern-library-config-action]')
  const action = actionNode?.dataset.patternLibraryConfigAction
  if (!actionNode || !action) return false

  if (action === 'go-list') {
    appStore.navigate('/pcs/pattern-library')
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'toggle-rule') {
    const rule = actionNode.dataset.rule
    if (rule === 'primaryColor') state.rulePrimaryColor = !state.rulePrimaryColor
    if (rule === 'usageType') state.ruleUsageType = !state.ruleUsageType
    if (rule === 'category') state.ruleCategory = !state.ruleCategory
    if (rule === 'filenameTokens') state.ruleFilenameTokens = !state.ruleFilenameTokens
    return true
  }

  if (action === 'save') {
    updatePatternLibraryConfig({
      usageTypes: parseValues(state.usageTypes),
      categoryTree: parsePatternCategoryTreeText(state.categoryTreeText),
      styleTags: parseValues(state.styleTags),
      primaryColors: parseValues(state.primaryColors),
      sourceTypes: parseValues(state.sourceTypes),
      namingRuleTemplate: state.namingRuleTemplate,
      ruleToggles: {
        primaryColor: state.rulePrimaryColor,
        usageType: state.ruleUsageType,
        category: state.ruleCategory,
        filenameTokens: state.ruleFilenameTokens,
      },
      similarityThreshold: Number(state.similarityThreshold) || 12,
    })
    state.notice = '花型库配置已保存。'
    return true
  }

  return false
}

export function handlePcsPatternLibraryConfigInput(target: Element): boolean {
  syncState()
  const field = (target as HTMLElement).dataset.patternLibraryConfigField
  if (!field) return false
  state[field as keyof PatternLibraryConfigState] = (target as HTMLInputElement | HTMLTextAreaElement).value as never
  return true
}

export function isPcsPatternLibraryConfigDialogOpen(): boolean {
  return false
}

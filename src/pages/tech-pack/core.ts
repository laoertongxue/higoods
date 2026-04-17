import {
  ensureTechPackPageState,
  escapeHtml,
  getChecklist,
  renderChecklist,
  renderStatusBadge,
  renderTabHeader,
  state,
} from './context.ts'
import { getStyleArchiveById } from '../../data/pcs-style-archive-repository.ts'
import { getTechnicalDataVersionById } from '../../data/pcs-technical-data-version-repository.ts'
import {
  buildTechPackVersionSourceTaskSummary,
} from '../../data/pcs-tech-pack-task-generation.ts'
import { getTechnicalVersionBusinessStatusLabel } from '../../data/pcs-technical-data-version-view-model.ts'
import {
  TECH_PACK_AGGREGATE_STATUS_RULES,
  resolveTechPackVersionBusinessStatus,
} from '../../data/pcs-product-lifecycle-governance.ts'
import { renderAttachmentsTab, renderAddAttachmentDialog, renderAddDesignDialog, renderDesignTab } from './asset-domain.ts'
import { renderBomFormDialog, renderBomTab } from './bom-domain.ts'
import { renderColorMappingTab } from './color-mapping-domain.ts'
import { renderCostTab } from './cost-domain.ts'
import { renderPatternDialog, renderPatternFormDialog, renderPatternTab } from './pattern-domain.ts'
import { renderAddTechniqueDialog, renderProcessTab } from './process-domain.ts'
import { renderAddQualityDialog, renderQualityTab } from './quality-domain.ts'
import { renderAddSizeDialog, renderSizeTab } from './size-domain.ts'

function renderCurrentTabContent(): string {
  if (state.activeTab === 'pattern') return renderPatternTab()
  if (state.activeTab === 'bom') return renderBomTab()
  if (state.activeTab === 'process') return renderProcessTab()
  if (state.activeTab === 'cost') return renderCostTab()
  if (state.activeTab === 'color-mapping') return renderColorMappingTab()
  if (state.activeTab === 'size') return renderSizeTab()
  if (state.activeTab === 'quality') return renderQualityTab()
  if (state.activeTab === 'design') return renderDesignTab()
  return renderAttachmentsTab()
}

function renderReleaseDialog(): string {
  if (!state.releaseDialogOpen || !state.techPack) return ''

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-md rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">发布技术包版本</h3>
          <p class="mt-1 text-sm text-muted-foreground">确定发布技术包版本 ${escapeHtml(state.currentTechnicalVersionCode || state.techPack.spuCode)} 吗？发布后不会自动启用为当前生效版本。</p>
        </header>
        <footer class="flex items-center justify-end gap-2 px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-release">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-tech-action="confirm-release">确认发布</button>
        </footer>
      </section>
    </div>
  `
}

function renderTechPackSummary(): string {
  if (!state.currentTechnicalVersionId || !state.currentStyleId) return ''
  const record = getTechnicalDataVersionById(state.currentTechnicalVersionId)
  const style = getStyleArchiveById(state.currentStyleId)
  if (!record) return ''
  const sourceSummary = buildTechPackVersionSourceTaskSummary(record)
  const isCurrent = style?.currentTechPackVersionId === record.technicalVersionId
  return `
    <div class="ml-10 mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
      <div>当前版本状态：<span class="font-medium text-foreground">${escapeHtml(getTechnicalVersionBusinessStatusLabel(record, style?.currentTechPackVersionId || ''))}</span></div>
      <div>是否当前生效版本：<span class="font-medium text-foreground">${isCurrent ? '是' : '否'}</span></div>
      <div>来源任务链：<span class="font-medium text-foreground">${escapeHtml(sourceSummary.taskChainText)}</span></div>
    </div>
  `
}

function renderTechPackLifecyclePanel(): string {
  if (!state.currentTechnicalVersionId || !state.currentStyleId) return ''
  const record = getTechnicalDataVersionById(state.currentTechnicalVersionId)
  const style = getStyleArchiveById(state.currentStyleId)
  if (!record) return ''
  const rule =
    TECH_PACK_AGGREGATE_STATUS_RULES[
      resolveTechPackVersionBusinessStatus(record, style?.currentTechPackVersionId || '')
    ]
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="text-sm font-medium text-foreground">技术包状态口径</h2>
        <span class="${escapeHtml(`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${rule.className}`)}">${escapeHtml(rule.label)}</span>
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-[1.4fr,1fr]">
        <div class="rounded-lg border bg-muted/30 px-4 py-3">
          <div class="text-xs text-muted-foreground">业务场景</div>
          <div class="mt-2 text-sm leading-6 text-foreground">${escapeHtml(rule.scene)}</div>
        </div>
        <div class="rounded-lg border bg-muted/30 px-4 py-3">
          <div class="text-xs text-muted-foreground">当前可操作项</div>
          <div class="mt-2 flex flex-wrap gap-2">
            ${rule.operations
              .map((item) => `<span class="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700">${escapeHtml(item)}</span>`)
              .join('')}
          </div>
        </div>
      </div>
    </section>
  `
}

export function renderTechPackPage(
  rawSpuCode: string,
  options?: {
    spuName?: string
    skuCatalog?: { skuCode: string; color: string; size: string }[]
    activeTab?: 'pattern' | 'bom' | 'process' | 'color-mapping' | 'size' | 'quality' | 'design' | 'attachments' | 'cost'
    styleId?: string
    technicalVersionId?: string
  },
): string {
  ensureTechPackPageState(rawSpuCode, {
    spuName: options?.spuName,
    skuCatalog: options?.skuCatalog,
    activeTab: options?.activeTab,
    styleId: options?.styleId,
    technicalVersionId: options?.technicalVersionId,
  })

  if (state.loading) {
    return '<div class="flex h-64 items-center justify-center text-muted-foreground">加载中...</div>'
  }

  if (!state.techPack || !state.currentSpuCode) {
    return `
      <div class="flex min-h-[320px] items-center justify-center">
        <section class="rounded-lg border bg-card p-8 text-center">
          <p class="text-base font-medium">未找到正式技术包版本</p>
          <p class="mt-1 text-sm text-muted-foreground">当前路由未匹配到正式技术包版本。</p>
        </section>
      </div>
    `
  }

  const checklist = getChecklist()
  const hasIncomplete = checklist.some((item) => item.required && !item.done)
  const canRelease = !hasIncomplete && state.techPack.status !== 'RELEASED'
  const currentRecord =
    state.currentTechnicalVersionId && state.currentStyleId
      ? getTechnicalDataVersionById(state.currentTechnicalVersionId)
      : null
  const currentStyle =
    state.currentTechnicalVersionId && state.currentStyleId
      ? getStyleArchiveById(state.currentStyleId)
      : null
  const currentRule =
    currentRecord
      ? TECH_PACK_AGGREGATE_STATUS_RULES[
          resolveTechPackVersionBusinessStatus(currentRecord, currentStyle?.currentTechPackVersionId || '')
        ]
      : null

  return `
    <div class="space-y-4">
      <header class="flex items-start justify-between">
        <div>
          <div class="mb-1 flex items-center gap-2">
            <button class="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted" data-tech-action="tech-back" aria-label="返回">
              <i data-lucide="arrow-left" class="h-4 w-4"></i>
            </button>
            <h1 class="text-xl font-semibold">技术包版本 - ${escapeHtml(state.currentTechnicalVersionCode || state.currentSpuCode)}</h1>
            ${currentRule ? `<span class="${escapeHtml(`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${currentRule.className}`)}">${escapeHtml(currentRule.label)}</span>` : renderStatusBadge(state.techPack.status)}
            <span class="text-sm text-muted-foreground">(${escapeHtml(state.techPack.versionLabel)})</span>
          </div>
          <p class="ml-10 text-sm text-muted-foreground">${escapeHtml(state.techPack.spuName)}</p>
          ${renderTechPackSummary()}
        </div>

        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <span class="mr-1 text-sm font-medium text-muted-foreground">关键项检查:</span>
            ${renderChecklist()}
          </div>
          <button class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            canRelease ? '' : 'pointer-events-none opacity-50'
          }" data-tech-action="open-release" title="${hasIncomplete ? '核心域未补全，暂不可发布' : ''}">
            <i data-lucide="check" class="mr-2 h-4 w-4"></i>
            发布版本
          </button>
        </div>
      </header>

      ${renderTechPackLifecyclePanel()}
      ${renderTabHeader()}
      ${renderCurrentTabContent()}

      ${renderPatternDialog()}
      ${renderReleaseDialog()}
      ${renderPatternFormDialog()}
      ${renderBomFormDialog()}
      ${renderAddTechniqueDialog()}
      ${renderAddSizeDialog()}
      ${renderAddQualityDialog()}
      ${renderAddDesignDialog()}
      ${renderAddAttachmentDialog()}
    </div>
  `
}

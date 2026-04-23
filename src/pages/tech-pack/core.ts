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
import { listPatternAssetsForTechPackVersions } from '../../data/pcs-pattern-library-archive-linkage.ts'
import {
  buildTechPackVersionSourceTaskSummary,
} from '../../data/pcs-tech-pack-task-generation.ts'
import { listTechPackVersionLogsByVersionId } from '../../data/pcs-tech-pack-version-log-repository.ts'
import { renderAttachmentsTab, renderAddAttachmentDialog, renderAddDesignDialog, renderDesignTab } from './asset-domain.ts'
import { renderBomFormDialog, renderBomTab, renderDesignThumbnailPreviewDialog } from './bom-domain.ts'
import { renderColorMappingTab } from './color-mapping-domain.ts'
import { renderCostTab } from './cost-domain.ts'
import {
  renderPatternDialog,
  renderPatternFormDialog,
  renderPatternTab,
  renderPatternTemplateDialog,
} from './pattern-domain.ts'
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
          <p class="mt-1 text-sm text-muted-foreground">确定发布当前草稿吗？发布后生成新的正式版本号，并启用当前版本。</p>
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
  const patternAssets = listPatternAssetsForTechPackVersions([record])
  return `
    <div class="ml-10 mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
      <div>技术包状态：${renderStatusBadge(state.techPack?.status || 'DRAFT')}</div>
      <div>是否当前生效版本：<span class="font-medium text-foreground">${isCurrent ? '是' : '否'}</span></div>
      <div>来源任务链：<span class="font-medium text-foreground">${escapeHtml(sourceSummary.taskChainText)}</span></div>
      <div>关联花型库资产：<span class="font-medium text-foreground">${patternAssets.length > 0 ? escapeHtml(patternAssets.map((item) => item.pattern_code).join('、')) : '未关联'}</span></div>
      <div>归档状态：<span class="font-medium text-foreground">${record.archiveCollectedFlag ? '已归档' : '未归档'}</span></div>
      <div>当前花型资产：<span class="font-medium text-foreground">${patternAssets.length} 个</span></div>
    </div>
  `
}

function renderTechPackVersionLogsPanel(): string {
  if (!state.currentTechnicalVersionId) return ''
  const logs = listTechPackVersionLogsByVersionId(state.currentTechnicalVersionId)
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-sm font-medium text-foreground">技术包版本日志</h2>
        <span class="text-xs text-muted-foreground">共 ${escapeHtml(String(logs.length))} 条</span>
      </div>
      ${
        logs.length > 0
          ? `
            <div class="mt-4 space-y-3">
              ${logs
                .map(
                  (item) => `
                    <div class="rounded-lg border bg-muted/20 px-4 py-3">
                      <div class="flex flex-wrap items-center justify-between gap-3">
                        <div class="text-sm font-medium text-foreground">${escapeHtml(item.logType)}</div>
                        <div class="text-xs text-muted-foreground">${escapeHtml(item.createdAt)}</div>
                      </div>
                      <div class="mt-2 text-sm text-muted-foreground">${escapeHtml(item.changeText || '未补充版本变更说明。')}</div>
                      <div class="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>操作人：${escapeHtml(item.createdBy || '-')}</span>
                        <span>来源任务：${escapeHtml(item.sourceTaskCode ? `${item.sourceTaskCode} · ${item.sourceTaskName || item.sourceTaskType}` : '系统操作')}</span>
                      </div>
                    </div>
                  `,
                )
                .join('')}
            </div>
          `
          : '<div class="mt-4 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">暂无技术包版本日志。</div>'
      }
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
  const canRelease = !hasIncomplete && state.techPack.status === 'DRAFT'
  return `
    <div data-tech-pack-page-root="true" class="space-y-4">
      <header class="flex items-start justify-between">
        <div>
          <div class="mb-1 flex items-center gap-2">
            <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted" data-tech-action="tech-back" aria-label="返回">
              <i data-lucide="arrow-left" class="h-4 w-4"></i>
            </button>
            <h1 class="text-xl font-semibold">技术包版本 - ${escapeHtml(state.currentTechnicalVersionCode || state.currentSpuCode)}</h1>
            ${renderStatusBadge(state.techPack.status)}
            ${state.techPack.versionLabel ? `<span class="text-sm text-muted-foreground">(${escapeHtml(state.techPack.versionLabel)})</span>` : ''}
          </div>
          <p class="ml-10 text-sm text-muted-foreground">${escapeHtml(state.techPack.spuName)}</p>
          ${renderTechPackSummary()}
          ${state.compatibilityMessage ? `<p class="ml-10 mt-2 text-sm text-red-600">${escapeHtml(state.compatibilityMessage)}</p>` : ''}
        </div>

        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <span class="mr-1 text-sm font-medium text-muted-foreground">关键项检查:</span>
            ${renderChecklist()}
          </div>
          <button type="button" class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            canRelease ? '' : 'pointer-events-none opacity-50'
          }" data-tech-action="open-release" title="${hasIncomplete ? '核心域未补全，暂不可发布' : state.techPack.status !== 'DRAFT' ? '只有草稿可以发布' : ''}">
            <i data-lucide="check" class="mr-2 h-4 w-4"></i>
            发布版本
          </button>
        </div>
      </header>

      ${renderTechPackVersionLogsPanel()}
      ${renderTabHeader()}
      ${renderCurrentTabContent()}

      ${renderPatternDialog()}
      ${renderPatternTemplateDialog()}
      ${renderReleaseDialog()}
      ${renderPatternFormDialog()}
      ${renderBomFormDialog()}
      ${renderDesignThumbnailPreviewDialog()}
      ${renderAddTechniqueDialog()}
      ${renderAddSizeDialog()}
      ${renderAddQualityDialog()}
      ${renderAddDesignDialog()}
      ${renderAddAttachmentDialog()}
    </div>
  `
}

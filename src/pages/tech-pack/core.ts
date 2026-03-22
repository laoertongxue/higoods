import {
  ensureTechPackPageState,
  escapeHtml,
  getChecklist,
  renderChecklist,
  renderStatusBadge,
  renderTabHeader,
  state,
} from './context'
import { renderAttachmentsTab, renderAddAttachmentDialog, renderAddDesignDialog, renderDesignTab } from './asset-domain'
import { renderBomFormDialog, renderBomTab } from './bom-domain'
import { renderColorMappingTab } from './color-mapping-domain'
import { renderCostTab } from './cost-domain'
import { renderPatternDialog, renderPatternFormDialog, renderPatternTab } from './pattern-domain'
import { renderAddTechniqueDialog, renderProcessTab } from './process-domain'
import { renderAddSizeDialog, renderSizeTab } from './size-domain'

function renderCurrentTabContent(): string {
  if (state.activeTab === 'pattern') return renderPatternTab()
  if (state.activeTab === 'bom') return renderBomTab()
  if (state.activeTab === 'process') return renderProcessTab()
  if (state.activeTab === 'cost') return renderCostTab()
  if (state.activeTab === 'color-mapping') return renderColorMappingTab()
  if (state.activeTab === 'size') return renderSizeTab()
  if (state.activeTab === 'design') return renderDesignTab()
  return renderAttachmentsTab()
}

function renderReleaseDialog(): string {
  if (!state.releaseDialogOpen || !state.techPack) return ''

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-md rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">发布技术包</h3>
          <p class="mt-1 text-sm text-muted-foreground">确定将技术包 ${escapeHtml(state.techPack.spuCode)} 发布为正式版本吗？发布后生产单可正常拆解。</p>
        </header>
        <footer class="flex items-center justify-end gap-2 px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-release">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-tech-action="confirm-release">确认</button>
        </footer>
      </section>
    </div>
  `
}

export function renderTechPackPage(rawSpuCode: string): string {
  ensureTechPackPageState(rawSpuCode)

  if (state.loading) {
    return '<div class="flex h-64 items-center justify-center text-muted-foreground">加载中...</div>'
  }

  if (!state.techPack || !state.currentSpuCode) {
    return '<div class="flex h-64 items-center justify-center text-muted-foreground">技术包不存在</div>'
  }

  const checklist = getChecklist()
  const hasIncomplete = checklist.some((item) => item.required && !item.done)
  const canRelease = !hasIncomplete && state.techPack.status !== 'RELEASED'

  return `
    <div class="space-y-4">
      <header class="flex items-start justify-between">
        <div>
          <div class="mb-1 flex items-center gap-2">
            <button class="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted" data-tech-action="tech-back" aria-label="返回">
              <i data-lucide="arrow-left" class="h-4 w-4"></i>
            </button>
            <h1 class="text-xl font-semibold">技术包 - ${escapeHtml(state.currentSpuCode)}</h1>
            ${renderStatusBadge(state.techPack.status)}
            <span class="text-sm text-muted-foreground">(${escapeHtml(state.techPack.versionLabel)})</span>
          </div>
          <p class="ml-10 text-sm text-muted-foreground">${escapeHtml(state.techPack.spuName)}</p>
        </div>

        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <span class="mr-1 text-sm font-medium text-muted-foreground">关键项检查:</span>
            ${renderChecklist()}
          </div>
          <button class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            canRelease ? '' : 'pointer-events-none opacity-50'
          }" data-tech-action="open-release" title="${hasIncomplete ? '关键项未完成，暂不可发布' : ''}">
            <i data-lucide="check" class="mr-2 h-4 w-4"></i>
            发布
          </button>
        </div>
      </header>

      ${renderTabHeader()}
      ${renderCurrentTabContent()}

      ${renderPatternDialog()}
      ${renderReleaseDialog()}
      ${renderPatternFormDialog()}
      ${renderBomFormDialog()}
      ${renderAddTechniqueDialog()}
      ${renderAddSizeDialog()}
      ${renderAddDesignDialog()}
      ${renderAddAttachmentDialog()}
    </div>
  `
}

import {
  ensureTechPackPageState,
  escapeHtml,
  getChecklist,
  renderChecklist,
  renderStatusBadge,
  renderTabHeader,
  state,
} from './context.ts'
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
  if (!state.releaseDialogOpen || !state.techPack || state.compatibilityMode) return ''

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-md rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">发布技术资料版本</h3>
          <p class="mt-1 text-sm text-muted-foreground">确定将技术资料版本 ${escapeHtml(state.currentTechnicalVersionCode || state.techPack.spuCode)} 发布为当前生效版本吗？</p>
        </header>
        <footer class="flex items-center justify-end gap-2 px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-release">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-tech-action="confirm-release">确认</button>
        </footer>
      </section>
    </div>
  `
}

function renderCompatibilityToolbar(): string {
  const hasPcsTarget = state.compatibilityMaintenancePath.startsWith('/pcs/')
  return `
    <div class="flex items-center gap-2">
      ${
        hasPcsTarget
          ? `<button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-tech-action="go-maintenance-target">
              <i data-lucide="external-link" class="mr-2 h-4 w-4"></i>
              去商品中心维护
            </button>`
          : ''
      }
      <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-tech-action="toggle-source-note">
        <i data-lucide="info" class="mr-2 h-4 w-4"></i>
        查看来源说明
      </button>
    </div>
  `
}

function renderCompatibilitySourceNote(): string {
  if (!state.compatibilityMode || !state.compatibilitySourceNoteOpen || !state.compatibilitySourceNote) return ''
  return `
    <section class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
      ${escapeHtml(state.compatibilitySourceNote)}
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
    compatibilityMode?: boolean
  },
): string {
  ensureTechPackPageState(rawSpuCode, {
    spuName: options?.spuName,
    skuCatalog: options?.skuCatalog,
    activeTab: options?.activeTab,
    styleId: options?.styleId,
    technicalVersionId: options?.technicalVersionId,
    compatibilityMode: options?.compatibilityMode,
  })

  if (state.loading) {
    return '<div class="flex h-64 items-center justify-center text-muted-foreground">加载中...</div>'
  }

  if (!state.techPack || !state.currentSpuCode) {
    return `
      <div class="flex min-h-[320px] items-center justify-center">
        <section class="rounded-lg border bg-card p-8 text-center">
          <p class="text-base font-medium">${state.compatibilityMode ? '技术资料兼容查看' : '未找到正式技术资料版本'}</p>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(state.compatibilityMode ? state.compatibilityMessage || '当前无可用技术资料。' : '当前路由未匹配到正式技术资料版本。')}</p>
          ${
            state.compatibilityMode && state.compatibilityMaintenancePath.startsWith('/pcs/')
              ? `<button class="mt-4 inline-flex items-center rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="go-maintenance-target">去商品中心维护</button>`
              : ''
          }
        </section>
      </div>
    `
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
            <h1 class="text-xl font-semibold">${
              state.compatibilityMode
                ? `技术资料兼容查看 - ${escapeHtml(state.currentSpuCode)}`
                : `技术资料版本 - ${escapeHtml(state.currentTechnicalVersionCode || state.currentSpuCode)}`
            }</h1>
            ${renderStatusBadge(state.techPack.status)}
            <span class="text-sm text-muted-foreground">(${escapeHtml(state.techPack.versionLabel)})</span>
          </div>
          ${
            state.compatibilityMode && state.currentTechnicalVersionCode
              ? `<p class="ml-10 text-xs text-muted-foreground">正式技术资料版本：${escapeHtml(state.currentTechnicalVersionCode)}</p>`
              : ''
          }
          <p class="ml-10 text-sm text-muted-foreground">${escapeHtml(state.techPack.spuName)}${
            state.compatibilityMode ? ` · ${escapeHtml(state.compatibilityMessage)}` : ''
          }</p>
        </div>

        ${
          state.compatibilityMode
            ? renderCompatibilityToolbar()
            : `<div class="flex items-center gap-3">
                <div class="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                  <span class="mr-1 text-sm font-medium text-muted-foreground">关键项检查:</span>
                  ${renderChecklist()}
                </div>
                <button class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
                  canRelease ? '' : 'pointer-events-none opacity-50'
                }" data-tech-action="open-release" title="${hasIncomplete ? '核心域未补全，暂不可发布' : ''}">
                  <i data-lucide="check" class="mr-2 h-4 w-4"></i>
                  发布
                </button>
              </div>`
        }
      </header>

      ${renderCompatibilitySourceNote()}
      ${renderTabHeader()}
      ${renderCurrentTabContent()}

      ${state.compatibilityMode ? '' : renderPatternDialog()}
      ${renderReleaseDialog()}
      ${state.compatibilityMode ? '' : renderPatternFormDialog()}
      ${state.compatibilityMode ? '' : renderBomFormDialog()}
      ${state.compatibilityMode ? '' : renderAddTechniqueDialog()}
      ${state.compatibilityMode ? '' : renderAddSizeDialog()}
      ${state.compatibilityMode ? '' : renderAddQualityDialog()}
      ${state.compatibilityMode ? '' : renderAddDesignDialog()}
      ${state.compatibilityMode ? '' : renderAddAttachmentDialog()}
    </div>
  `
}

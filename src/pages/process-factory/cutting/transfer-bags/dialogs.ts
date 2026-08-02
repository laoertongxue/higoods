import { escapeHtml } from '../../../../utils.ts'
import { formatFactoryDisplayName } from '../../../../data/fcs/factory-mock-data.ts'
import { deriveTransferBagMasterStatus } from '../transfer-bags-model.ts'
import {
  state,
  getFactoryOptions,
  getViewModel,
} from './state.ts'
import {
  getDialogTitle,
  getCarrierMasterRecordMap,
} from './handlers.ts'

export function renderDialogShell(body: string, footer: string): string {
  if (!state.activeDialog) return ''
  return `
    <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-8" role="dialog" aria-modal="true">
      <section class="w-full max-w-5xl rounded-lg border bg-background shadow-xl">
        <div class="flex items-center justify-between border-b px-5 py-4">
          <h2 class="text-base font-semibold text-foreground">${escapeHtml(getDialogTitle())}</h2>
          <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="close-dialog">关闭</button>
        </div>
        <div class="space-y-4 px-5 py-4">
          ${body}
        </div>
        <div class="flex flex-wrap justify-end gap-2 border-t px-5 py-4">
          ${footer}
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="close-dialog">取消</button>
        </div>
      </section>
    </div>
  `
}

export function renderFactoryOptions(selectedId: string): string {
  return getFactoryOptions()
    .map((factory) => `<option value="${escapeHtml(factory.id)}" ${selectedId === factory.id ? 'selected' : ''}>${escapeHtml(formatFactoryDisplayName(factory.name, factory.code || factory.id))}</option>`)
    .join('')
}

export function renderBagOptions(selectedId: string): string {
  return getViewModel().masters
    .map((bag) => `<option value="${escapeHtml(bag.bagId)}" ${selectedId === bag.bagId ? 'selected' : ''}>${escapeHtml(`${bag.bagCode} / ${getCarrierMasterRecordMap()[bag.bagCode]?.currentStatus || bag.visibleStatusMeta.label}`)}</option>`)
    .join('')
}

export function renderUsageOptions(selectedId: string, bagId?: string): string {
  return getViewModel().usages
    .filter((usage) => !bagId || usage.bagId === bagId)
    .map((usage) => `<option value="${escapeHtml(usage.usageId)}" ${selectedId === usage.usageId ? 'selected' : ''}>${escapeHtml(`${usage.usageNo} / ${usage.bagCode} / ${usage.usageStageLabel || '交出装袋'}`)}</option>`)
    .join('')
}

export function renderNewMasterDialog(): string {
  return renderDialogShell(
    `
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">中转袋编号</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.masterDraft.bagCode)}" placeholder="例如 BAG-HG-001" data-transfer-bags-master-draft-field="bagCode" />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">归属工厂（货权）</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-master-draft-field="ownershipFactoryId">${renderFactoryOptions(state.masterDraft.ownershipFactoryId)}</select>
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">载具类型</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-master-draft-field="carrierType">
            <option value="bag" ${state.masterDraft.carrierType === 'bag' ? 'selected' : ''}>袋</option>
            <option value="box" ${state.masterDraft.carrierType === 'box' ? 'selected' : ''}>箱</option>
          </select>
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">容量</span>
          <input type="number" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.masterDraft.capacity)}" data-transfer-bags-master-draft-field="capacity" />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">规格</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.masterDraft.bagSpec)}" data-transfer-bags-master-draft-field="bagSpec" />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">材质</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.masterDraft.bagMaterial)}" data-transfer-bags-master-draft-field="bagMaterial" />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">初始位置</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.masterDraft.currentLocation)}" data-transfer-bags-master-draft-field="currentLocation" />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">备注</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.masterDraft.note)}" data-transfer-bags-master-draft-field="note" />
        </label>
      </div>
      <div class="rounded-lg border bg-muted/15 px-4 py-3 text-sm text-muted-foreground">保存后会生成正式中转袋档案二维码，二维码只包含袋码、载具类型和所属工厂等主档信息。</div>
    `,
    '<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-transfer-bags-action="save-master">保存中转袋</button>',
  )
}

export function renderActiveDialog(): string {
  if (state.activeDialog === 'new-master') return renderNewMasterDialog()
  return ''
}

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
  getSourceUsage,
  resolvePackBag,
  parseTicketInputs,
  resolvePackTickets,
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

export function renderPackDialog(stage: 'INBOUND_TEMP' | 'HANDOVER_PACKING'): string {
  const isInbound = stage === 'INBOUND_TEMP'
  const bag = resolvePackBag()
  const scannedTicketInputs = parseTicketInputs(state.packDraft.ticketInput)
  const { tickets, missing } = resolvePackTickets()
  const carrierRecord = bag ? getCarrierMasterRecordMap()[bag.bagCode] : null
  const bagStatusLabel = carrierRecord?.currentStatus || (bag ? deriveTransferBagMasterStatus(bag.currentStatus).label : '待扫描')
  const ticketPreview = tickets.slice(0, 4).map((ticket) => ticket.ticketNo).join(' / ')
  const warehouseReady = Boolean(state.packDraft.warehouseArea.trim() && state.packDraft.locationCode.trim())
  const stepClass = (done: boolean, active: boolean) =>
    done
      ? 'border-emerald-200 bg-emerald-50/70'
      : active
        ? 'border-blue-200 bg-blue-50/60'
        : 'border-border bg-muted/10'
  const stepBadgeClass = (done: boolean, active: boolean) =>
    done
      ? 'bg-emerald-600 text-white'
      : active
        ? 'bg-blue-600 text-white'
        : 'bg-muted text-muted-foreground'
  const renderStep = (index: number, title: string, done: boolean, active: boolean, body: string) => `
    <section class="rounded-lg border p-4 ${stepClass(done, active)}">
      <div class="mb-3 flex items-center gap-2">
        <span class="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${stepBadgeClass(done, active)}">${index}</span>
        <h3 class="text-sm font-semibold text-foreground">${escapeHtml(title)}</h3>
      </div>
      ${body}
    </section>
  `
  return renderDialogShell(
    `
      <div class="space-y-3">
        ${renderStep(
          1,
          '扫码中转袋二维码',
          Boolean(bag),
          !bag,
          `
            <div class="grid gap-3 md:grid-cols-[1fr,1fr]">
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">中转袋二维码 / 袋码</span>
                <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.bagCodeInput)}" placeholder="扫描中转袋二维码，或输入 BAG-A-001" data-transfer-bags-pack-draft-field="bagCodeInput" />
              </label>
              <div class="rounded-lg border bg-background px-3 py-2 text-sm">
                <div><span class="text-muted-foreground">已选中转袋：</span><span class="font-medium text-foreground">${escapeHtml(bag?.bagCode || '待扫描')}</span></div>
                <div class="mt-1 text-xs text-muted-foreground">当前状态：${escapeHtml(bagStatusLabel)}</div>
                <div class="mt-1 text-xs text-muted-foreground">当前位置：${escapeHtml(bag?.currentLocation || '待确认')}</div>
              </div>
            </div>
          `,
        )}
        ${renderStep(
          2,
          '扫码菲票',
          tickets.length > 0 && !missing.length,
          Boolean(bag) && !tickets.length,
          `
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">菲票码</span>
              <textarea class="min-h-[104px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="连续扫描多张菲票，或粘贴票号，使用空格 / 换行 / 顿号分隔" data-transfer-bags-pack-draft-field="ticketInput">${escapeHtml(state.packDraft.ticketInput)}</textarea>
            </label>
            <div class="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
              <div>已扫描：<span class="font-medium text-foreground">${escapeHtml(String(scannedTicketInputs.length))}</span> 张</div>
              <div>已识别：<span class="font-medium text-foreground">${escapeHtml(String(tickets.length))}</span> 张</div>
              <div>未匹配：<span class="${missing.length ? 'font-medium text-amber-700' : 'font-medium text-foreground'}">${escapeHtml(String(missing.length))}</span> 张</div>
            </div>
            ${ticketPreview ? `<div class="mt-2 text-xs text-muted-foreground">示例：${escapeHtml(ticketPreview)}${tickets.length > 4 ? ' ...' : ''}</div>` : ''}
            ${missing.length ? `<div class="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">未匹配：${escapeHtml(missing.join('、'))}</div>` : ''}
          `,
        )}
        ${isInbound
          ? renderStep(
              3,
              '选择库区库位',
              Boolean(bag && tickets.length && !missing.length && warehouseReady),
              Boolean(bag && tickets.length && !missing.length),
              `
                <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label class="space-y-2">
                    <span class="text-sm font-medium text-foreground">库区</span>
                    <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.warehouseArea)}" placeholder="例如 裁片暂存区" data-transfer-bags-pack-draft-field="warehouseArea" />
                  </label>
                  <label class="space-y-2">
                    <span class="text-sm font-medium text-foreground">库位</span>
                    <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.locationCode)}" placeholder="例如 A-01-01" data-transfer-bags-pack-draft-field="locationCode" />
                  </label>
                  <label class="space-y-2">
                    <span class="text-sm font-medium text-foreground">操作人</span>
                    <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.operator)}" data-transfer-bags-pack-draft-field="operator" />
                  </label>
                  <label class="space-y-2">
                    <span class="text-sm font-medium text-foreground">备注</span>
                    <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.note)}" data-transfer-bags-pack-draft-field="note" />
                  </label>
                </div>
              `,
            )
          : `
            <section class="rounded-lg border bg-muted/10 p-4">
              <h3 class="mb-3 text-sm font-semibold text-foreground">交出信息</h3>
              <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">绑定对象类型</span>
                  <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-pack-draft-field="boundObjectType">
                    ${['车缝任务', '特殊工艺交出单'].map((item) => `<option value="${escapeHtml(item)}" ${state.packDraft.boundObjectType === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
                  </select>
                </label>
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">绑定对象单号</span>
                  <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.boundObjectNo)}" placeholder="可填车缝任务 / 交出单号" data-transfer-bags-pack-draft-field="boundObjectNo" />
                </label>
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">接收对象类型</span>
                  <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-pack-draft-field="receiverType">
                    ${['工厂', '仓库', '其他'].map((item) => `<option value="${escapeHtml(item)}" ${state.packDraft.receiverType === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
                  </select>
                </label>
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">接收对象</span>
                  <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.receiverName)}" placeholder="未填则按待指定展示" data-transfer-bags-pack-draft-field="receiverName" />
                </label>
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">操作人</span>
                  <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.operator)}" data-transfer-bags-pack-draft-field="operator" />
                </label>
                <label class="space-y-2 xl:col-span-3">
                  <span class="text-sm font-medium text-foreground">备注</span>
                  <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.note)}" data-transfer-bags-pack-draft-field="note" />
                </label>
              </div>
            </section>
          `}
      </div>
      <div class="rounded-lg border bg-muted/15 px-4 py-3 text-sm text-muted-foreground">${isInbound ? '入仓暂存支持一个中转袋混装；确认后完成入仓暂存，中转袋进入所选库区库位。' : '交出确认后，中转袋直接进入“已交出待回收”。'}</div>
    `,
    `<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-transfer-bags-action="${isInbound ? 'save-inbound-pack' : 'save-handover-pack'}">${isInbound ? '确认入仓暂存' : '交出确认'}</button>`,
  )
}

export function renderReturnDialog(): string {
  const usage = getSourceUsage(state.activeUsageId)
  return renderDialogShell(
    `
      ${usage ? `<div class="rounded-lg border bg-muted/15 px-4 py-3 text-sm text-muted-foreground">当前回收：${escapeHtml(usage.usageNo)} / ${escapeHtml(usage.bagCode)}</div>` : ''}
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label class="space-y-2"><span class="text-sm font-medium text-foreground">回收仓 / 回收点</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.returnDraft.returnWarehouseName)}" data-transfer-bags-return-draft-field="returnWarehouseName" /></label>
        <label class="space-y-2"><span class="text-sm font-medium text-foreground">回收时间</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.returnDraft.returnAt)}" data-transfer-bags-return-draft-field="returnAt" /></label>
        <label class="space-y-2"><span class="text-sm font-medium text-foreground">回收人</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.returnDraft.returnedBy)}" data-transfer-bags-return-draft-field="returnedBy" /></label>
        <label class="space-y-2"><span class="text-sm font-medium text-foreground">回收确认人</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.returnDraft.receivedBy)}" data-transfer-bags-return-draft-field="receivedBy" /></label>
        <label class="space-y-2"><span class="text-sm font-medium text-foreground">差异类型</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="discrepancyType">
          ${[
            ['NONE', '无差异'],
            ['QTY_MISMATCH', '数量差异'],
            ['DAMAGED_BAG', '中转袋破损'],
            ['LATE_RETURN', '逾期未回收'],
            ['MISSING_RECORD', '缺记录'],
          ].map(([value, label]) => `<option value="${value}" ${state.returnDraft.discrepancyType === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select></label>
        <label class="space-y-2 xl:col-span-3"><span class="text-sm font-medium text-foreground">差异说明</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.returnDraft.discrepancyNote)}" data-transfer-bags-return-draft-field="discrepancyNote" /></label>
        <label class="space-y-2"><span class="text-sm font-medium text-foreground">袋况</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="conditionStatus"><option value="GOOD" ${state.conditionDraft.conditionStatus === 'GOOD' ? 'selected' : ''}>完好</option><option value="MINOR_DAMAGE" ${state.conditionDraft.conditionStatus === 'MINOR_DAMAGE' ? 'selected' : ''}>轻微破损可继续使用</option><option value="SEVERE_DAMAGE" ${state.conditionDraft.conditionStatus === 'SEVERE_DAMAGE' ? 'selected' : ''}>报废</option></select></label>
        <label class="space-y-2"><span class="text-sm font-medium text-foreground">回收结果</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="reusableDecision"><option value="REUSABLE" ${state.conditionDraft.reusableDecision === 'REUSABLE' ? 'selected' : ''}>可继续使用</option><option value="DISABLED" ${state.conditionDraft.reusableDecision === 'DISABLED' ? 'selected' : ''}>报废</option></select></label>
        <label class="space-y-2 md:col-span-2"><span class="text-sm font-medium text-foreground">报废说明</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.conditionDraft.damageType)}" data-transfer-bags-condition-field="damageType" /></label>
        <label class="space-y-2 md:col-span-2 xl:col-span-4"><span class="text-sm font-medium text-foreground">回收备注</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.returnDraft.note)}" data-transfer-bags-return-draft-field="note" /></label>
      </div>
    `,
    '<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-transfer-bags-action="save-return">确认回收</button>',
  )
}

export function renderActiveDialog(): string {
  if (state.activeDialog === 'new-master') return renderNewMasterDialog()
  return ''
}

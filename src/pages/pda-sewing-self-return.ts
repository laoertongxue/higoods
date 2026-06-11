import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  authenticateFactoryPdaUserByCredentials,
} from '../data/fcs/store-domain-pda.ts'
import {
  FULL_CAPABILITY_FACTORY_ID,
  FULL_CAPABILITY_FACTORY_NAME,
  getPostFinishingSewingSelfReturnDemoScanValue,
  listPostFinishingSewingSelfReturnRecords,
  resolvePostFinishingSewingSelfReturnScan,
  type PostFinishingSewingSelfReturnScanResult,
} from '../data/fcs/post-finishing-domain.ts'
import {
  createPostFinishingSewingSelfReturnAndSyncHandover,
} from '../data/fcs/pda-handover-events.ts'
import {
  activatePdaSewingSelfReturnMode,
  clearPdaSewingSelfReturnMode,
} from '../data/fcs/pda-sewing-self-return-mode.ts'
import {
  getPdaRuntimeContext,
  renderPdaLoginRedirect,
} from './pda-runtime'

interface PdaSewingSelfReturnState {
  scanValue: string
  deliveryPersonName: string
  deliveryPersonPhone: string
  evidenceImages: Array<{
    id: string
    name: string
    size: number
    previewUrl: string
  }>
  qtyBySkuLineId: Record<string, string>
  errorText: string
  successText: string
  exitLoginId: string
  exitPassword: string
  exitErrorText: string
  exitModalOpen: boolean
}

const state: PdaSewingSelfReturnState = {
  scanValue: '',
  deliveryPersonName: '',
  deliveryPersonPhone: '',
  evidenceImages: [],
  qtyBySkuLineId: {},
  errorText: '',
  successText: '',
  exitLoginId: '',
  exitPassword: '',
  exitErrorText: '',
  exitModalOpen: false,
}

const MAX_EVIDENCE_IMAGE_COUNT = 6

function resolveScanForRender(): PostFinishingSewingSelfReturnScanResult | null {
  if (!state.scanValue.trim()) return null
  try {
    return resolvePostFinishingSewingSelfReturnScan(state.scanValue)
  } catch {
    return null
  }
}

function renderNotice(text: string, tone: 'error' | 'success'): string {
  if (!text) return ''
  const className = tone === 'error'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return `<div class="rounded-2xl border px-3 py-2 text-sm ${className}">${escapeHtml(text)}</div>`
}

function renderLockedHeader(): string {
  return `
    <header class="sticky top-0 z-20 border-b bg-white px-4 py-3 shadow-sm">
      <div class="mx-auto flex max-w-[480px] items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-[11px] font-medium text-slate-500">后道公共 PDA</div>
          <h1 class="text-base font-semibold text-slate-950">车缝现场交货登记模式</h1>
        </div>
        <div class="flex shrink-0 flex-col items-end gap-1">
          <div class="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">锁定中</div>
          <button
            type="button"
            class="rounded-full bg-slate-950 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm"
            data-pda-sewing-self-return-action="open-exit-modal"
          >退出车缝厂回货模式</button>
        </div>
      </div>
    </header>
  `
}

function renderScanBlock(result: PostFinishingSewingSelfReturnScanResult | null): string {
  if (result) {
    return `
      <section class="rounded-2xl border bg-white p-3 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-sm font-semibold text-slate-950">已识别生产确认单</h2>
            <p class="mt-1 truncate text-xs text-blue-700">${escapeHtml(result.productionConfirmationNo)} / ${escapeHtml(result.productionOrderNo)}</p>
          </div>
          <button type="button" class="shrink-0 rounded-full border px-3 py-1 text-xs text-slate-600" data-pda-sewing-self-return-action="reset-scan">重新扫码</button>
        </div>
        <div class="mt-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
          <div>车缝任务：${escapeHtml(result.sourceTaskNo)}</div>
          <div>车缝工厂：${escapeHtml(result.sourceFactoryName)}</div>
          <div class="truncate">默认入库：后道待加工仓 / ${escapeHtml(result.defaultAreaName)} / ${escapeHtml(result.defaultLocationCode)}</div>
        </div>
      </section>
    `
  }

  return `
    <section class="rounded-2xl border bg-white p-3 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-slate-950">扫码识别生产确认单</h2>
        </div>
        <i data-lucide="scan-line" class="h-5 w-5 text-slate-500"></i>
      </div>
      <textarea
        class="mt-3 min-h-16 w-full rounded-xl border bg-white px-3 py-2 text-xs leading-5 text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        data-pda-sewing-self-return-field="scanValue"
        data-skip-page-rerender="true"
        placeholder="扫描或粘贴生产确认单二维码内容"
      >${escapeHtml(state.scanValue)}</textarea>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <button type="button" class="rounded-xl border px-3 py-2 text-sm font-medium text-slate-700" data-pda-sewing-self-return-action="use-demo-scan">演示扫码</button>
        <button type="button" class="rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white" data-pda-sewing-self-return-action="resolve-scan">识别确认单</button>
      </div>
    </section>
  `
}

function formatEvidenceImageSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '图片'
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))}KB`
  return `${(size / 1024 / 1024).toFixed(1)}MB`
}

function renderEvidenceImages(): string {
  return `
    <div class="space-y-2">
      <div class="flex items-center justify-between gap-3">
        <div class="text-xs font-medium text-slate-600">现场凭证图片</div>
        <button
          type="button"
          class="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border px-3 text-xs font-medium text-slate-700"
          data-skip-page-rerender="true"
          data-pda-sewing-self-return-action="open-evidence-image-picker"
        >上传图片</button>
        <input
          id="pda-sewing-self-return-evidence-images"
          type="file"
          class="sr-only"
          accept="image/*"
          multiple
          capture="environment"
          data-pda-sewing-self-return-field="evidenceImages"
        />
      </div>
      ${
        state.evidenceImages.length
          ? `
              <div class="grid grid-cols-3 gap-2">
                ${state.evidenceImages.map((image) => `
                  <div class="relative overflow-hidden rounded-xl border bg-slate-50">
                    <img class="aspect-square w-full object-cover" src="${escapeHtml(image.previewUrl)}" alt="${escapeHtml(image.name)}" />
                    <button
                      type="button"
                      class="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white"
                      data-pda-sewing-self-return-action="remove-evidence-image"
                      data-evidence-image-id="${escapeHtml(image.id)}"
                    >删除</button>
                    <div class="px-2 py-1">
                      <div class="truncate text-[11px] font-medium text-slate-700">${escapeHtml(image.name)}</div>
                      <div class="text-[10px] text-slate-400">${formatEvidenceImageSize(image.size)}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            `
          : '<div class="rounded-xl border border-dashed bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">请上传纸质确认单照片、包装箱照片或现场签名照片。</div>'
      }
    </div>
  `
}

function renderQtyForm(result: PostFinishingSewingSelfReturnScanResult | null): string {
  if (!result) {
    return `
      <section class="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 class="text-sm font-semibold text-slate-950">交货信息</h2>
        <div class="mt-3 rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">先扫描生产确认单后登记颜色尺码数量。</div>
      </section>
    `
  }

  return `
    <section class="rounded-2xl border bg-white p-4 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-slate-950">交货信息</h2>
          <p class="mt-1 text-xs text-slate-500">按颜色尺码填写车缝厂本次带来的数量。</p>
        </div>
      </div>
      <div class="mt-3 space-y-2">
        ${result.items.map((item) => `
          <label class="grid grid-cols-[1fr_96px] items-center gap-3 rounded-xl border px-3 py-2">
            <span class="min-w-0">
              <span class="block truncate text-sm font-medium text-slate-900">${escapeHtml(item.skuCode)}</span>
              <span class="mt-0.5 block text-xs text-slate-500">${escapeHtml(item.colorName)} / ${escapeHtml(item.sizeName)} · 计划 ${item.plannedQty}${escapeHtml(item.qtyUnit)}</span>
            </span>
            <input
              type="number"
              min="0"
              step="1"
              class="h-10 rounded-xl border bg-white px-2 text-right text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value="${escapeHtml(state.qtyBySkuLineId[item.skuLineId] || '')}"
              placeholder="0"
              data-pda-sewing-self-return-field="qty"
              data-sku-line-id="${escapeHtml(item.skuLineId)}"
              data-skip-page-rerender="true"
            />
          </label>
        `).join('')}
      </div>
      <div class="mt-4 grid grid-cols-1 gap-3">
        <label class="block text-xs font-medium text-slate-600">
          送货人
          <input class="mt-1 h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(state.deliveryPersonName)}" data-pda-sewing-self-return-field="deliveryPersonName" data-skip-page-rerender="true" placeholder="车缝厂送货人姓名" />
        </label>
        <label class="block text-xs font-medium text-slate-600">
          联系方式
          <input class="mt-1 h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(state.deliveryPersonPhone)}" data-pda-sewing-self-return-field="deliveryPersonPhone" data-skip-page-rerender="true" placeholder="手机号 / WhatsApp" />
        </label>
        ${renderEvidenceImages()}
      </div>
      <button type="button" class="mt-4 h-12 w-full rounded-xl bg-blue-600 text-base font-semibold text-white shadow-sm" data-pda-sewing-self-return-action="submit-return">提交自助回货</button>
    </section>
  `
}

function renderRecentRecords(): string {
  const records = listPostFinishingSewingSelfReturnRecords().slice(0, 3)
  return `
    <section class="rounded-2xl border bg-white p-4 shadow-sm">
      <h2 class="text-sm font-semibold text-slate-950">最近自助回货</h2>
      <div class="mt-3 space-y-2">
        ${records.length ? records.map((record) => `
          <div class="rounded-xl border px-3 py-2 text-xs leading-5">
            <div class="flex items-center justify-between gap-2">
              <span class="font-semibold text-slate-900">${escapeHtml(record.recordNo)}</span>
              <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">${escapeHtml(record.status)}</span>
            </div>
            <div class="mt-1 text-slate-500">${escapeHtml(record.sourceFactoryName)} · ${escapeHtml(record.productionOrderNo)} · ${record.items.length} 个 SKU</div>
          </div>
        `).join('') : '<div class="rounded-xl bg-slate-50 px-3 py-5 text-center text-xs text-slate-500">暂无自助回货记录</div>'}
      </div>
    </section>
  `
}

function renderExitDialog(): string {
  if (!state.exitModalOpen) return ''
  return `
    <div class="fixed inset-0 z-40 flex items-end justify-center bg-black/40 px-4 pb-6 pt-20">
      <button
        type="button"
        class="absolute inset-0 z-0"
        aria-label="关闭退出弹窗"
        data-pda-sewing-self-return-action="close-exit-modal"
      ></button>
      <section class="relative z-10 w-full max-w-[480px] rounded-3xl border bg-white p-4 shadow-2xl">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-slate-950">退出车缝厂回货模式</h2>
            <p class="mt-1 text-xs leading-5 text-slate-500">退出需要验证当前后道工厂管理员账号密码。</p>
          </div>
          <button
            type="button"
            class="rounded-full border px-3 py-1 text-xs text-slate-600"
            data-pda-sewing-self-return-action="close-exit-modal"
          >关闭</button>
        </div>
        <div class="mt-3">${renderNotice(state.exitErrorText, 'error')}</div>
        <div class="mt-3 grid grid-cols-1 gap-3">
          <input class="h-11 rounded-xl border px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(state.exitLoginId)}" data-pda-sewing-self-return-field="exitLoginId" data-skip-page-rerender="true" placeholder="管理员账号" autocomplete="off" autocapitalize="off" spellcheck="false" />
          <input type="password" class="h-11 rounded-xl border px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(state.exitPassword)}" data-pda-sewing-self-return-field="exitPassword" data-skip-page-rerender="true" placeholder="管理员密码" autocomplete="new-password" autocapitalize="off" spellcheck="false" />
        </div>
        <button type="button" class="mt-3 h-11 w-full rounded-xl bg-slate-950 text-sm font-semibold text-white" data-pda-sewing-self-return-action="exit-mode">验证并退出</button>
      </section>
    </div>
  `
}

export function renderPdaSewingSelfReturnPage(): string {
  const runtime = getPdaRuntimeContext()
  if (!runtime) return renderPdaLoginRedirect('车缝现场交货登记')
  if (runtime.factoryId !== FULL_CAPABILITY_FACTORY_ID) {
    return `
      <section class="min-h-screen bg-slate-100 px-4 py-8">
        <div class="mx-auto max-w-[480px] rounded-2xl border bg-white p-5 shadow-sm">
          <h1 class="text-base font-semibold text-slate-950">无权进入</h1>
          <p class="mt-2 text-sm leading-6 text-slate-500">车缝现场交货登记模式只能由 ${escapeHtml(FULL_CAPABILITY_FACTORY_NAME)} 的公共 PDA 开启。</p>
          <button type="button" class="mt-4 h-11 w-full rounded-xl bg-slate-950 text-sm font-semibold text-white" data-nav="/fcs/pda/handover">返回交接</button>
        </div>
      </section>
    `
  }

  activatePdaSewingSelfReturnMode({
    factoryId: runtime.factoryId,
    factoryName: runtime.factoryName,
    openedBy: runtime.userName,
  })
  const result = resolveScanForRender()
  return `
    <section class="min-h-screen bg-slate-100 text-slate-950" data-testid="pda-sewing-self-return-locked-page">
      ${renderLockedHeader()}
      <main class="mx-auto max-w-[480px] space-y-3 px-4 py-4 pb-8">
        ${renderNotice(state.errorText, 'error')}
        ${renderNotice(state.successText, 'success')}
        ${renderScanBlock(result)}
        ${renderQtyForm(result)}
        ${renderRecentRecords()}
      </main>
      ${renderExitDialog()}
    </section>
  `
}

function fillPlannedQty(result: PostFinishingSewingSelfReturnScanResult): void {
  result.items.forEach((item) => {
    state.qtyBySkuLineId[item.skuLineId] = String(item.plannedQty)
  })
}

function clearSubmitDraft(): void {
  state.deliveryPersonName = ''
  state.deliveryPersonPhone = ''
  clearEvidenceImages()
  state.qtyBySkuLineId = {}
  state.scanValue = ''
}

function revokeEvidenceImage(image: { previewUrl: string }): void {
  if (typeof URL === 'undefined' || !image.previewUrl.startsWith('blob:')) return
  URL.revokeObjectURL(image.previewUrl)
}

function clearEvidenceImages(): void {
  state.evidenceImages.forEach(revokeEvidenceImage)
  state.evidenceImages = []
}

function appendEvidenceImages(files: FileList | null): void {
  const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith('image/'))
  if (!imageFiles.length) return
  const remainingSlots = MAX_EVIDENCE_IMAGE_COUNT - state.evidenceImages.length
  if (remainingSlots <= 0) {
    state.errorText = `最多上传 ${MAX_EVIDENCE_IMAGE_COUNT} 张现场凭证图片。`
    return
  }
  const acceptedFiles = imageFiles.slice(0, remainingSlots)
  state.evidenceImages = [
    ...state.evidenceImages,
    ...acceptedFiles.map((file, index) => ({
      id: `evidence-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      size: file.size,
      previewUrl: typeof URL !== 'undefined' ? URL.createObjectURL(file) : '',
    })),
  ]
  if (imageFiles.length > acceptedFiles.length) {
    state.errorText = `最多上传 ${MAX_EVIDENCE_IMAGE_COUNT} 张现场凭证图片。`
  }
}

function buildEvidenceText(): string {
  if (!state.evidenceImages.length) return ''
  const names = state.evidenceImages.map((image) => image.name).join('、')
  return `现场凭证图片 ${state.evidenceImages.length} 张：${names}`
}

async function exitLockedMode(): Promise<void> {
  const runtime = getPdaRuntimeContext()
  state.exitErrorText = ''
  if (!runtime) {
    state.exitErrorText = '当前 PDA 登录已失效。'
    return
  }
  const result = await authenticateFactoryPdaUserByCredentials(state.exitLoginId.trim(), state.exitPassword.trim())
  if (result.error || !result.user) {
    state.exitErrorText = '管理员账号或密码错误。'
    return
  }
  if (result.user.factoryId !== runtime.factoryId || result.user.roleId !== 'ROLE_ADMIN') {
    state.exitErrorText = '只能由当前后道工厂管理员退出。'
    return
  }
  clearPdaSewingSelfReturnMode()
  state.exitLoginId = ''
  state.exitPassword = ''
  state.exitModalOpen = false
  appStore.navigate('/fcs/pda/handover?tab=pickup')
}

export async function handlePdaSewingSelfReturnEvent(target: HTMLElement): Promise<boolean> {
  const fieldNode = target.closest<HTMLElement>('[data-pda-sewing-self-return-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.pdaSewingSelfReturnField || ''
    if (field === 'evidenceImages' && fieldNode instanceof HTMLInputElement) {
      appendEvidenceImages(fieldNode.files)
      fieldNode.value = ''
      return true
    }
    const value =
      fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLTextAreaElement
        ? fieldNode.value
        : ''
    if (field === 'scanValue') state.scanValue = value
    if (field === 'deliveryPersonName') state.deliveryPersonName = value
    if (field === 'deliveryPersonPhone') state.deliveryPersonPhone = value
    if (field === 'exitLoginId') state.exitLoginId = value
    if (field === 'exitPassword') state.exitPassword = value
    if (field === 'qty') {
      const skuLineId = fieldNode.dataset.skuLineId || ''
      if (skuLineId) state.qtyBySkuLineId[skuLineId] = value
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-sewing-self-return-action]')
  const action = actionNode?.dataset.pdaSewingSelfReturnAction
  if (!action) return false

  state.errorText = ''
  state.successText = ''
  if (action === 'open-exit-modal') {
    state.exitModalOpen = true
    state.exitErrorText = ''
    return true
  }
  if (action === 'close-exit-modal') {
    state.exitModalOpen = false
    state.exitErrorText = ''
    state.exitPassword = ''
    return true
  }
  if (action === 'use-demo-scan') {
    state.scanValue = getPostFinishingSewingSelfReturnDemoScanValue()
    const result = resolvePostFinishingSewingSelfReturnScan(state.scanValue)
    fillPlannedQty(result)
    return true
  }
  if (action === 'reset-scan') {
    state.scanValue = ''
    state.qtyBySkuLineId = {}
    return true
  }
  if (action === 'open-evidence-image-picker') {
    document.getElementById('pda-sewing-self-return-evidence-images')?.click()
    return true
  }
  if (action === 'resolve-scan') {
    try {
      const result = resolvePostFinishingSewingSelfReturnScan(state.scanValue)
      fillPlannedQty(result)
    } catch (error) {
      state.errorText = error instanceof Error ? error.message : '生产确认单识别失败。'
    }
    return true
  }
  if (action === 'remove-evidence-image') {
    const imageId = actionNode?.dataset.evidenceImageId || ''
    const targetImage = state.evidenceImages.find((image) => image.id === imageId)
    if (targetImage) revokeEvidenceImage(targetImage)
    state.evidenceImages = state.evidenceImages.filter((image) => image.id !== imageId)
    return true
  }
  if (action === 'submit-return') {
    const runtime = getPdaRuntimeContext()
    if (!runtime) {
      state.errorText = '当前 PDA 登录已失效。'
      return true
    }
    try {
      const result = resolvePostFinishingSewingSelfReturnScan(state.scanValue)
      const created = createPostFinishingSewingSelfReturnAndSyncHandover({
        scanValue: state.scanValue,
        deliveryPersonName: state.deliveryPersonName,
        deliveryPersonPhone: state.deliveryPersonPhone,
        evidenceText: buildEvidenceText(),
        deviceFactoryId: runtime.factoryId,
        deviceFactoryName: runtime.factoryName,
        deviceUserName: runtime.userName,
        items: result.items.map((item) => ({
          skuLineId: item.skuLineId,
          submittedQty: Number(state.qtyBySkuLineId[item.skuLineId] || 0),
        })),
      })
      clearSubmitDraft()
      state.successText = `已提交 ${created.recordNo}，已生成车缝侧交出记录和后道待确认入库记录。`
    } catch (error) {
      state.errorText = error instanceof Error ? error.message : '提交自助回货失败。'
    }
    return true
  }
  if (action === 'exit-mode') {
    await exitLockedMode()
    return true
  }

  return false
}

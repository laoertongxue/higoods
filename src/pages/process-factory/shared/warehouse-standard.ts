import { escapeHtml } from '../../../utils.ts'

const FLOW_MODAL_ID = 'factory-warehouse-flow-modal'

export interface FactoryWarehouseStandardTab {
  key: string
  label: string
  count: number
  content: string
}

export interface FactoryWarehouseFlowLine {
  flowType: string
  qtyText: string
  sourceNo: string
  operatedAt: string
  operatorName?: string
  statusText?: string
}

export function renderFactoryWarehouseStandardTabs(tabs: FactoryWarehouseStandardTab[], idPrefix: string): string {
  return `
    <section class="rounded-lg border bg-card">
      <style>
        ${tabs
          .map(
            (tab) => `
              #${idPrefix}-${tab.key}:checked ~ .factory-warehouse-tab-labels label[for="${idPrefix}-${tab.key}"] {
                background: rgb(15 23 42);
                border-color: rgb(15 23 42);
                color: white;
              }
              #${idPrefix}-${tab.key}:checked ~ .factory-warehouse-tab-panels [data-factory-warehouse-tab-panel="${tab.key}"] {
                display: block;
              }
            `,
          )
          .join('')}
      </style>
      ${tabs
        .map(
          (tab, index) => `
            <input
              id="${idPrefix}-${tab.key}"
              class="sr-only"
              type="radio"
              name="${idPrefix}"
              ${index === 0 ? 'checked' : ''}
            />
          `,
        )
        .join('')}
      <div class="factory-warehouse-tab-labels flex flex-wrap gap-2 border-b bg-muted/20 px-4 py-3">
        ${tabs
          .map(
            (tab) => `
              <label
                for="${idPrefix}-${tab.key}"
                class="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                <span>${escapeHtml(tab.label)}</span>
                <span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">${String(tab.count)}</span>
              </label>
            `,
          )
          .join('')}
      </div>
      <div class="factory-warehouse-tab-panels">
        ${tabs
          .map(
            (tab) => `
              <div class="hidden" data-factory-warehouse-tab-panel="${escapeHtml(tab.key)}">
                <div class="flex items-center justify-between border-b px-4 py-3">
                  <h2 class="text-base font-semibold">${escapeHtml(tab.label)}</h2>
                  <span class="text-xs text-muted-foreground">共 ${String(tab.count)} 条</span>
                </div>
                ${tab.content}
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

export function renderWarehouseFlowButton(title: string, flows: FactoryWarehouseFlowLine[]): string {
  const encoded = encodeURIComponent(JSON.stringify(flows))
  return `
    <button
      type="button"
      class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted"
      data-warehouse-flow-action="open"
      data-flow-title="${escapeHtml(title)}"
      data-flow-json="${escapeHtml(encoded)}"
    >查看库存流水</button>
  `
}

export function renderWarehouseLocationToolbar(scopeLabel: string): string {
  return `
    <button
      type="button"
      class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      data-factory-warehouse-location-action="add"
      data-location-scope="${escapeHtml(scopeLabel)}"
    >新增库位</button>
  `
}

export function renderWarehouseLocationActions(scopeLabel: string, locationLabel: string): string {
  return `
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="rounded-md border px-2 py-1 text-xs hover:bg-muted"
        data-factory-warehouse-location-action="edit"
        data-location-scope="${escapeHtml(scopeLabel)}"
        data-location-label="${escapeHtml(locationLabel)}"
      >编辑</button>
      <button
        type="button"
        class="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
        data-factory-warehouse-location-action="delete"
        data-location-scope="${escapeHtml(scopeLabel)}"
        data-location-label="${escapeHtml(locationLabel)}"
      >删除</button>
    </div>
  `
}

function removeFlowModal(): void {
  document.getElementById(FLOW_MODAL_ID)?.remove()
}

function openFlowModal(title: string, flows: FactoryWarehouseFlowLine[]): void {
  removeFlowModal()
  const rows = flows.length
    ? flows
      .map(
        (flow) => `
          <article class="rounded-md border bg-background px-3 py-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="font-medium">${escapeHtml(flow.flowType)}：${escapeHtml(flow.qtyText)}</div>
              <div class="text-xs text-muted-foreground">${escapeHtml(flow.operatedAt)}</div>
            </div>
            <div class="mt-1 text-xs text-muted-foreground">
              ${escapeHtml(flow.sourceNo)}
              ${flow.operatorName ? ` / ${escapeHtml(flow.operatorName)}` : ''}
              ${flow.statusText ? ` / ${escapeHtml(flow.statusText)}` : ''}
            </div>
          </article>
        `,
      )
      .join('')
    : '<div class="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">暂无库存流水记录</div>'

  const modal = document.createElement('div')
  modal.id = FLOW_MODAL_ID
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'
  modal.innerHTML = `
    <div class="max-h-[82vh] w-full max-w-2xl overflow-hidden rounded-lg bg-background shadow-xl">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-base font-semibold">${escapeHtml(title || '库存流水')}</h2>
          <p class="mt-1 text-xs text-muted-foreground">按入仓、领料、加工用料、加工入仓、交出等动作形成流水。</p>
        </div>
        <button type="button" class="rounded-md border px-2 py-1 text-sm hover:bg-muted" data-warehouse-flow-action="close">关闭</button>
      </div>
      <div class="max-h-[64vh] space-y-2 overflow-y-auto p-4">
        ${rows}
      </div>
    </div>
  `
  document.body.appendChild(modal)
  modal.addEventListener('click', (event) => {
    const actionNode = (event.target as HTMLElement).closest<HTMLElement>('[data-warehouse-flow-action]')
    if (actionNode?.dataset.warehouseFlowAction === 'close') {
      removeFlowModal()
    }
  })
}

export function isFactoryWarehouseFlowModalOpen(): boolean {
  return Boolean(document.getElementById(FLOW_MODAL_ID))
}

export async function handleFactoryWarehouseSharedEvent(target: HTMLElement): Promise<boolean> {
  const flowNode = target.closest<HTMLElement>('[data-warehouse-flow-action]')
  if (flowNode) {
    const action = flowNode.dataset.warehouseFlowAction
    if (action === 'close') {
      removeFlowModal()
      return true
    }
    if (action === 'open') {
      const title = flowNode.dataset.flowTitle || '库存流水'
      let flows: FactoryWarehouseFlowLine[] = []
      try {
        flows = JSON.parse(decodeURIComponent(flowNode.dataset.flowJson || '[]')) as FactoryWarehouseFlowLine[]
      } catch {
        flows = []
      }
      openFlowModal(title, flows)
      return true
    }
  }

  const locationNode = target.closest<HTMLElement>('[data-factory-warehouse-location-action]')
  if (locationNode) {
    const action = locationNode.dataset.factoryWarehouseLocationAction
    const scope = locationNode.dataset.locationScope || '仓库'
    const location = locationNode.dataset.locationLabel || ''
    if (action === 'delete') {
      window.alert(`${scope}：${location || '库位'} 已执行删除演示。`)
      return true
    }
    if (action === 'edit') {
      window.alert(`${scope}：${location || '库位'} 已打开编辑演示。`)
      return true
    }
    if (action === 'add') {
      window.alert(`${scope} 已打开新增库位演示。`)
      return true
    }
  }

  return false
}

export function closeFactoryWarehouseSharedDialogs(): boolean {
  if (!isFactoryWarehouseFlowModalOpen()) return false
  removeFlowModal()
  return true
}

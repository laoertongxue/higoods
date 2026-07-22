export class ContractHtmlInputElement {
  dataset: Record<string, string>
  value: string

  constructor(draftKey = '', field = '', value = '') {
    this.dataset = { draftKey, pdaExecdSkuField: field }
    this.value = value
  }

  closest(selector: string) {
    return selector === '[data-pda-execd-sku-field]' ? this : null
  }
}

export function installPdaContractRuntime() {
  const storageValues = new Map<string, string>()
  const visibleMessages: string[] = []
  const elementsById = new Map<string, ContractDomElement>()
  class ContractDomElement {
    id = ''
    className = ''
    style: Record<string, string> = {}
    children: ContractDomElement[] = []
    private content = ''

    set textContent(value: string) {
      this.content = value
      if (value) visibleMessages.push(value)
    }

    get textContent(): string {
      return this.content
    }

    get childElementCount(): number {
      return this.children.length
    }

    appendChild(child: ContractDomElement): ContractDomElement {
      this.children.push(child)
      if (child.id) elementsById.set(child.id, child)
      return child
    }

    remove(): void {
      if (this.id) elementsById.delete(this.id)
    }
  }
  const body = new ContractDomElement()
  Object.defineProperty(globalThis, 'HTMLInputElement', { configurable: true, value: ContractHtmlInputElement })
  for (const constructorName of ['HTMLSelectElement', 'HTMLTextAreaElement'] as const) {
    if (!(globalThis as Record<string, unknown>)[constructorName]) {
      ;(globalThis as Record<string, unknown>)[constructorName] = class {}
    }
  }
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storageValues.get(key) ?? null,
      setItem: (key: string, value: string) => storageValues.set(key, value),
      removeItem: (key: string) => storageValues.delete(key),
      clear: () => storageValues.clear(),
    },
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      body,
      createElement: () => new ContractDomElement(),
      getElementById: (id: string) => elementsById.get(id) ?? null,
    },
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: { pathname: '/fcs/pda/warehouse/wait-process', search: '', href: '' },
      requestAnimationFrame: (callback: () => void) => callback(),
      setTimeout: () => 0,
    },
  })
  return {
    reset: () => {
      storageValues.clear()
      visibleMessages.length = 0
      elementsById.clear()
      body.children.length = 0
    },
    storageValues,
    visibleMessages,
  }
}

export const buildPdaExecActionTarget = (action: string, taskId: string) => ({
  closest: (selector: string) => selector === '[data-pda-execd-action]'
    ? { dataset: { pdaExecdAction: action, taskId } }
    : null,
}) as unknown as HTMLElement

export const buildPdaWarehouseActionTarget = (
  action: string,
  input: { stockItemId: string; workOrderId: string; skuCode: string },
) => ({
  closest: (selector: string) => selector === '[data-pda-warehouse-action]'
    ? {
        dataset: {
          pdaWarehouseAction: action,
          stockItemId: input.stockItemId,
          workOrderId: input.workOrderId,
          skuCode: input.skuCode,
        },
      }
    : null,
}) as unknown as HTMLElement

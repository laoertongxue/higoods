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
  return {
    reset: () => storageValues.clear(),
    storageValues,
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

/**
 * TMF 只在换版、主单限制及印染交出接续时读取大型生产事实源。
 * 由事实源模块在实际加载时注册读取器，避免 TMF 五个首屏为未使用能力加载整套生产域。
 */
type Reader = (id: string) => any

let productionOrderReader: Reader = () => undefined
let preparationHandoverReader: Reader = () => undefined

export function registerTmfProductionOrderRuntimeReader(reader: Reader): void {
  productionOrderReader = reader
}

export function registerTmfPreparationHandoverReader(reader: Reader): void {
  preparationHandoverReader = reader
}

export function readTmfProductionOrderRuntimeFact(id: string): any {
  return productionOrderReader(id)
}

export function readTmfPreparationHandoverRecord(id: string): any {
  return preparationHandoverReader(id)
}

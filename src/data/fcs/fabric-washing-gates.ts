/** Passive boundary keeps existing print/receiving domains free of cyclic imports. */
type Release = (printOrderId: string, rollIdOrBarcode: string, mode: 'HANDOUT' | 'USE') => string
let release: Release | undefined
let readingStaticPrintHistory = false
export function setReadingStaticPrintHistory(value:boolean){ readingStaticPrintHistory = value }
export function registerFabricWashingRelease(check: Release): void { release = check }
export function assertFabricWashingRelease(printOrderId: string, rollId: string, mode: 'HANDOUT' | 'USE'): void {
  if (readingStaticPrintHistory) return
  if (!release) throw new Error('面料触摸记录尚未读取，请刷新后重试。')
  const message = release(printOrderId, rollId, mode)
  if (message) throw new Error(message)
}

export function withStaticPrintHistory<T>(read:()=>T):T { const before=readingStaticPrintHistory;readingStaticPrintHistory=true;try{return read()}finally{readingStaticPrintHistory=before} }
import type { FactoryWaitHandoverStockItem } from './factory-internal-warehouse.ts'
let outputProjection:()=>FactoryWaitHandoverStockItem[]=()=>[]
export function registerWashingOutputStock(read:()=>FactoryWaitHandoverStockItem[]){outputProjection=read}
export function washingOutputStock(){return outputProjection()}

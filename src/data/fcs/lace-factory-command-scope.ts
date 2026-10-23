let depth = 0
/** Only the record transaction may publish an original browser lace mutation. */
export function assertLaceFactoryCommandScope() {
  if (typeof window !== 'undefined' && depth === 0) throw new Error('花边操作必须从已读取的单据提交，本次未保存。请重新打开单据后重试。')
}
export function withLaceFactoryCommandScope<T>(action: () => T): T {
  depth++
  try { return action() } finally { depth-- }
}

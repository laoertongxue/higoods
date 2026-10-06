import { getChannelListing, getPcsChannelCatalogSnapshot, writePcsChannelCatalogSnapshot, channelRecordId, channelLog, assertChannelListingEditable, assertChannelListingPublishable, assertChannelDescriptionReady, resolveChannelPrice, validateChannelMapping, isChannelSkuSelectable } from './pcs-channel-catalog.ts'
import { getSkuArchiveById } from './pcs-sku-archive-repository.ts'
import { getChannelStore } from './pcs-channel-store-repository.ts'
import { assertChannelPlatformContentReady } from './pcs-channel-platform-template.ts'
import type { ChannelCatalogSnapshot, ChannelListing, ChannelVariant, ChannelPrice, ChannelPriceType, ChannelSyncOperation, ChannelSyncItem, ChannelPlatformStatus } from './pcs-channel-catalog-types.ts'
const now = () => new Date().toISOString()
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
export const CHANNEL_CONTENT_SYNC_FIELDS = ['title', 'description', 'languageCode', 'sellingPoints', 'translations', 'handle', 'platformCategoryId', 'platformBrandId', 'platformAttributes', 'media']
export const CHANNEL_VARIANT_SYNC_FIELDS = ['sellerSku', 'displayColor', 'displaySize', 'displayPattern', 'imageUrl', 'platformAttributeValues', 'price.regular', 'price.retail', 'price.live', 'price.wholesale', 'price.clearance']
export function channelFieldSupported(channelCode: string, field: string): boolean {
  if (['title', 'description', 'languageCode', 'sellingPoints', 'translations', 'platformCategoryId', 'platformBrandId', 'platformAttributes', 'media', 'sellerSku', 'displayColor', 'displaySize', 'displayPattern', 'imageUrl', 'platformAttributeValues', 'price.regular', 'availability', 'platformStatus'].includes(field)) return true
  if (field === 'handle' || field === 'price.retail') return channelCode === 'shopify' || channelCode === 'independent-site'
  return false
}
export function readChannelSyncField(snapshot: ChannelCatalogSnapshot, listing: ChannelListing, targetId: string, field: string): unknown {
  if (targetId === listing.id) return field === 'platformStatus' ? listing.platformStatus : (listing.content as unknown as Record<string, unknown>)[field]
  const variant = snapshot.variants.find(v => v.id === targetId && v.listingId === listing.id)
  if (!variant) throw new Error('同步范围包含不属于当前 PID 的规格。')
  if (field.startsWith('price.')) return resolveChannelPrice(variant, field.slice(6) as ChannelPriceType, now(), snapshot).amount
  return (variant as unknown as Record<string, unknown>)[field]
}
function fieldVersion(snapshot: ChannelCatalogSnapshot, listing: ChannelListing, targetId: string, field: string): number {
  if (targetId === listing.id) return listing.contentVersion
  const variant = snapshot.variants.find(v => v.id === targetId)!
  if (field.startsWith('price.')) return resolveChannelPrice(variant, field.slice(6) as ChannelPriceType, now(), snapshot).price?.version || 0
  return variant.version
}
function updateBaseline(snapshot: ChannelCatalogSnapshot, listing: ChannelListing, item: Pick<ChannelSyncItem, 'targetId' | 'field'>, value: unknown, eventId: string): void {
  const previous = snapshot.fieldBaselines.find(b => b.listingId === listing.id && b.targetId === item.targetId && b.field === item.field)
  const next = { id: previous?.id || channelRecordId(), listingId: listing.id, targetId: item.targetId, field: item.field, value: structuredClone(value), version: fieldVersion(snapshot, listing, item.targetId, item.field), eventId, updatedAt: now() }
  snapshot.fieldBaselines = [...snapshot.fieldBaselines.filter(b => b.id !== next.id), next]
}
function activeSyncFields(snapshot: ChannelCatalogSnapshot, listing: ChannelListing): Array<{ targetId: string; field: string }> {
  const store = getChannelStore(listing.storeId)!
  return [...CHANNEL_CONTENT_SYNC_FIELDS.map(field => ({ targetId: listing.id, field })), ...snapshot.variants.filter(v => v.listingId === listing.id && v.active).flatMap(v => CHANNEL_VARIANT_SYNC_FIELDS.map(field => ({ targetId: v.id, field })))].filter(f => channelFieldSupported(store.channelCode, f.field)).filter(f => {
    const value = readChannelSyncField(snapshot, listing, f.targetId, f.field)
    return value !== undefined && (value !== null || snapshot.fieldBaselines.some(b=>b.listingId===listing.id&&b.targetId===f.targetId&&b.field===f.field&&b.value!==null))
  })
}
function recalculateSyncState(snapshot: ChannelCatalogSnapshot, listing: ChannelListing): void {
  const operations = snapshot.syncOperations.filter(o => o.listingId === listing.id)
  if (operations.some(o => o.conflicts.length)) { listing.syncStatus = '同时变更待处理'; return }
  if (operations.some(o => o.result === '结果待核实')) { listing.syncStatus = '结果待核实'; return }
  if (operations.some(o => o.result === '提交中')) { listing.syncStatus = '同步中'; return }
  const fields = activeSyncFields(snapshot, listing)
  const latestItems=new Map<string,ChannelSyncItem>()
  for(const op of operations)if(op.direction==='PCS→平台')for(const item of op.items)latestItems.set(`${item.targetId}:${item.field}`,item)
  const currentFailed=[...latestItems.values()].some(i=>i.result==='失败'&&i.fieldVersion===fieldVersion(snapshot,listing,i.targetId,i.field))
  if(currentFailed){listing.syncStatus='失败';return}
  const consistent = listing.platformProductId && fields.every(f => { const b = snapshot.fieldBaselines.find(b => b.listingId === listing.id && b.targetId === f.targetId && b.field === f.field); return b && equal(b.value, readChannelSyncField(snapshot, listing, f.targetId, f.field)) })
  listing.syncStatus = consistent ? '一致' : operations.at(-1)?.items.some(i => i.result === '失败') ? '失败' : '待同步'
}
export function submitChannelSync(listingId: string, action: '发布' | '更新' | '下架' | '重新同步' = '更新', options: { operationId?: string; fields?: Array<{ targetId: string; field: string }>; parentOperationId?: string; actor?: string } = {}): ChannelSyncOperation {
  const snapshot = getPcsChannelCatalogSnapshot(), listing = snapshot.listings.find(l => l.id === listingId)
  if (!listing) throw new Error('渠道商品不存在。'); assertChannelListingEditable(listing)
  if (action !== '下架') assertChannelListingPublishable(listing)
  const id = options.operationId || channelRecordId(), existing = snapshot.syncOperations.find(o => o.id === id)
  if (existing) {if(existing.listingId!==listingId)throw new Error('操作标识已被其他渠道商品使用。');return existing}
  if (snapshot.syncOperations.some(o => o.listingId === listingId && o.result === '结果待核实')) throw new Error('上次首次发布结果待核实，请先查询同次操作结果，不能重复创建 PID。')
  if (snapshot.syncOperations.some(o => o.listingId === listingId && o.conflicts.length)) throw new Error('请先处理同字段同时修改的差异。')
  if (action !== '下架' && (listing.reviewStatus !== '审核通过' || listing.approvedVersion !== listing.contentVersion)) throw new Error('请先审核当前渠道内容版本。')
  const variants = snapshot.variants.filter(v => v.listingId === listing.id && v.active)
  if (action !== '下架') { assertChannelDescriptionReady(listing.content); assertChannelPlatformContentReady(getChannelStore(listing.storeId)!, listing.content, variants) }
  validateChannelMapping(listing.styleId, variants)
  if(!listing.platformProductId&&variants.some(v=>!isChannelSkuSelectable(getSkuArchiveById(v.internalSkuId)!)))throw new Error('首次发布只能使用已审核且启用的内部 SKU。')
  if (action !== '下架' && variants.some(v => (resolveChannelPrice(v, 'regular', now(), snapshot).amount || 0) <= 0)) throw new Error('每个平台规格须设置大于 0 的日常售价。')
  if (action === '下架' && !listing.platformProductId) throw new Error('尚无平台 PID，无需请求平台下架。')
  const store = getChannelStore(listing.storeId)!, selected = options.fields || (action === '下架' ? [{ targetId: listing.id, field: 'platformStatus' }] : activeSyncFields(snapshot, listing))
  const inFlight=snapshot.syncOperations.find(o=>o.listingId===listingId&&o.result==='提交中'&&o.action===action&&o.submittedVersion===listing.version&&JSON.stringify(o.items.map(i=>({targetId:i.targetId,field:i.field})))===JSON.stringify(selected))
  if(inFlight)return inFlight
  const items: ChannelSyncItem[] = selected.map(({ targetId, field }) => {
    const base = snapshot.fieldBaselines.find(b => b.listingId === listing.id && b.targetId === targetId && b.field === field), supported = channelFieldSupported(store.channelCode, field)
    return { targetId, field, submittedValue: action === '下架' ? '已下架' : readChannelSyncField(snapshot, listing, targetId, field), baseValue: base?.value ?? null, fieldVersion: fieldVersion(snapshot, listing, targetId, field), result: supported ? '待回执' : '不支持', error: supported ? '' : '该演示渠道未开放此字段同步；仅保留 PCS 经营资料。' }
  })
  const operation: ChannelSyncOperation = { id, listingId, targetVariantIds: [...new Set(items.filter(i => i.targetId !== listing.id).map(i => i.targetId))], action, direction: 'PCS→平台', fieldScope: [...new Set(items.map(i => i.field))], baseVersion: Math.max(0, ...snapshot.fieldBaselines.filter(b => b.listingId === listingId).map(b => b.version)), submittedVersion: listing.version, sourceEventId: id, result: items.some(i => i.result === '待回执') ? '提交中' : '失败', items, conflicts: [], errorReason: '', startedAt: now(), completedAt: '', parentOperationId: options.parentOperationId || '', demo: true, attempt: 1, processedEventIds: [] }
  snapshot.syncOperations.push(operation); listing.syncStatus = operation.result === '提交中' ? '同步中' : '失败'
  channelLog(snapshot, listingId, `提交${action}`, `操作 ${id}；版本 ${listing.version}；${items.length} 个字段目标；等待演示回执`, options.actor)
  writePcsChannelCatalogSnapshot(snapshot); return operation
}
export interface ChannelReceipt { eventId: string; operationId: string; platformProductId?: string; platformStatus?: ChannelPlatformStatus; rawStatus?: string; unknown?: boolean; items: Array<{ targetId: string; field: string; success: boolean; error?: string; platformVariantId?: string; value?: unknown }> }
export function receiveChannelReceipt(receipt: ChannelReceipt): ChannelSyncOperation {
  const snapshot = getPcsChannelCatalogSnapshot(), operation = snapshot.syncOperations.find(o => o.id === receipt.operationId)
  if (!operation) throw new Error('找不到此回执对应的提交操作。')
  if (operation.processedEventIds.includes(receipt.eventId)) return operation
  const listing = snapshot.listings.find(l => l.id === operation.listingId)!
  assertChannelListingEditable(listing)
  if (receipt.platformProductId !== undefined && typeof receipt.platformProductId !== 'string' || receipt.items.some(item=>item.platformVariantId!==undefined&&typeof item.platformVariantId!=='string')) throw new Error('平台 PID 与规格 ID 必须保留文本原值，不能转换为数字。')
  if (listing.platformProductId && receipt.platformProductId && listing.platformProductId !== receipt.platformProductId) throw new Error('回执 PID 与现有渠道身份不一致，原身份已保留。')
  operation.processedEventIds.push(receipt.eventId)
  operation.receiptSnapshots = [...(operation.receiptSnapshots || []), {
    eventId: receipt.eventId, receivedAt: now(), platformProductId: receipt.platformProductId || '', platformStatus: receipt.platformStatus,
    rawStatus: receipt.rawStatus || '', unknown: !!receipt.unknown, items: structuredClone(receipt.items),
  }]
  if (receipt.unknown || operation.action === '发布' && !listing.platformProductId && !receipt.platformProductId) {
    operation.result = '结果待核实'; operation.errorReason = '首次发布响应超时，平台身份尚未确定，请查询本次操作结果。'; operation.items.filter(i => i.result === '待回执').forEach(i => { i.result = '结果待核实' }); listing.syncStatus = '结果待核实';if(!listing.platformProductId)listing.platformStatus='未取得状态'
    channelLog(snapshot, listing.id, '收到结果待核实回执', operation.id, '演示平台', '演示回执'); writePcsChannelCatalogSnapshot(snapshot); return operation
  }
  const currentSubmission = operation.submittedVersion === listing.version
  // 外部身份属于同一次创建操作。内容变更后迟到的创建回执仍须承接身份，避免再次新建 PID；旧字段值仍按版本拒绝。
  if (receipt.platformProductId && !listing.platformProductId) {
    if (snapshot.listings.some(l => l.id !== listing.id && l.storeId === listing.storeId && l.platformProductId === receipt.platformProductId)) throw new Error('回执 PID 已属于此店铺另一渠道商品，未覆盖原记录。')
    listing.platformProductId = receipt.platformProductId
  }
  for (const response of receipt.items) {
    const item = operation.items.find(i => i.targetId === response.targetId && i.field === response.field)
    if (!item || item.result === '不支持') continue
    if (response.platformVariantId) item.platformVariantId = response.platformVariantId
    if (!response.success) { item.result = '失败'; item.error = response.error || '平台未确认该字段，请重试此项。'; continue }
    if (item.targetId !== listing.id && response.platformVariantId) {
      const variant = snapshot.variants.find(v => v.id === item.targetId)!
      if (variant.platformVariantId && variant.platformVariantId !== response.platformVariantId) throw new Error('回执规格 ID 与已存在身份不一致，原记录已保留。')
      if (snapshot.variants.some(v => v.listingId === listing.id && v.id !== variant.id && v.platformVariantId === response.platformVariantId)) throw new Error('回执包含重复平台规格 ID。')
      variant.platformVariantId = response.platformVariantId
    }
    const fieldStillCurrent = item.fieldVersion === fieldVersion(snapshot, listing, item.targetId, item.field) && (item.field === 'platformStatus' || equal(item.submittedValue, readChannelSyncField(snapshot, listing, item.targetId, item.field)))
    if (!currentSubmission || !fieldStillCurrent) { item.result = '已过期'; item.error = '回执晚于新版本，仅记入历史。'; continue }
    item.result = '成功'; item.error = ''; item.observedValue = response.value ?? item.submittedValue
    updateBaseline(snapshot, listing, item, item.observedValue, receipt.eventId)
  }
  const pending = operation.items.filter(i => ['待回执', '结果待核实'].includes(i.result)), failed = operation.items.filter(i => i.result === '失败' || i.result === '不支持'), succeeded = operation.items.filter(i => i.result === '成功'), stale = operation.items.filter(i => i.result === '已过期')
  operation.result = pending.length ? '提交中' : stale.length && !succeeded.length && !failed.length ? '已过期' : failed.length ? succeeded.length ? '部分成功' : '失败' : '成功'
  operation.errorReason = failed.map(i => `${i.targetId} · ${i.field}：${i.error}`).join('；'); operation.completedAt = pending.length ? '' : now()
  if (operation.action==='发布' && snapshot.variants.some(v=>v.listingId===listing.id&&v.active&&!v.platformVariantId)) { operation.result='结果待核实'; operation.errorReason='部分平台规格身份尚未确定，请核实同次发布结果。'; operation.completedAt='' }
  if (currentSubmission && succeeded.length) {
    if (receipt.platformStatus) listing.platformStatus = receipt.platformStatus
    if (receipt.rawStatus) listing.platformRawStatus = receipt.rawStatus
    if (operation.action === '下架' && operation.result === '成功') listing.platformStatus = '已下架'
    listing.lastSuccessAt = now(); listing.platformObservedAt=now()
    if (listing.publishedContent) {
      for (const item of succeeded.filter(i => i.targetId === listing.id && CHANNEL_CONTENT_SYNC_FIELDS.includes(i.field))) (listing.publishedContent as unknown as Record<string, unknown>)[item.field] = structuredClone(item.observedValue)
    } else if (CHANNEL_CONTENT_SYNC_FIELDS.filter(field => channelFieldSupported(getChannelStore(listing.storeId)!.channelCode, field)).every(field => snapshot.fieldBaselines.some(b => b.listingId === listing.id && b.targetId === listing.id && b.field === field && equal(b.value, readChannelSyncField(snapshot, listing, listing.id, field))))) listing.publishedContent = structuredClone(listing.content)
  }
  // 原操作失败项只有在本次重试得到成功回执后才改为已解决；不重复创建成功的外部身份。
  if (operation.parentOperationId) {
    const parent = snapshot.syncOperations.find(o => o.id === operation.parentOperationId)
    if (parent) for (const item of succeeded) { const old = parent.items.find(i => i.targetId === item.targetId && i.field === item.field); if (old) { old.result = '成功'; old.error = ''; } }
    if (parent && parent.items.every(i => i.result === '成功')) { parent.result = '成功'; parent.errorReason = '' }
  }
  recalculateSyncState(snapshot, listing)
  channelLog(snapshot, listing.id, '收到演示回执', `${operation.action}：${operation.result}；操作 ${operation.id}`, '演示平台', '演示回执')
  writePcsChannelCatalogSnapshot(snapshot); return operation
}
/** 明确由演示回执分配不透明外部 ID；不根据内部 SKU 拼造平台身份。 */
export function demoChannelReceipt(operationId: string, mode: 'success' | 'partial' | 'unknown' = 'success'): ChannelReceipt {
  const snapshot = getPcsChannelCatalogSnapshot(), operation = snapshot.syncOperations.find(o => o.id === operationId)
  if (!operation) throw new Error('提交操作不存在。')
  const listing = snapshot.listings.find(l => l.id === operation.listingId)!, ids = new Map(snapshot.variants.filter(v => v.listingId === listing.id).map(v => [v.id, v.platformVariantId || `demo-${channelRecordId()}`]))
  const eligible = operation.items.filter(i => i.result !== '不支持')
  return { eventId: channelRecordId(), operationId, unknown: mode === 'unknown', platformProductId: listing.platformProductId || `demo-${channelRecordId()}`, platformStatus: operation.action === '下架' ? '已下架' : '在售', rawStatus: operation.action === '下架' ? 'DEMO_OFFLINE' : 'DEMO_ACTIVE', items: eligible.map((i, index) => ({ targetId: i.targetId, field: i.field, success: !(mode === 'partial' && index === eligible.length - 1), error: mode === 'partial' && index === eligible.length - 1 ? '演示平台暂未接受此项；其他已成功项保留。' : '', platformVariantId: ids.get(i.targetId) })) }
}
export function retryChannelFailedItems(operationId: string, actor = '当前用户'): ChannelSyncOperation {
  const snapshot = getPcsChannelCatalogSnapshot(), operation = snapshot.syncOperations.find(o => o.id === operationId)
  if (!operation) throw new Error('同步操作不存在。')
  if (operation.result === '结果待核实') throw new Error('请先核实同次发布结果，不能盲目重发。')
  const fields = operation.items.filter(i => i.result === '失败').map(i => ({ targetId: i.targetId, field: i.field }))
  if (!fields.length) throw new Error('没有可重试的失败项；平台不支持的字段不能强制重试。')
  return submitChannelSync(operation.listingId, '重新同步', { fields, parentOperationId: operation.id, actor })
}
export function verifyUnknownChannelOperation(operationId: string): ChannelSyncOperation {
  const snapshot = getPcsChannelCatalogSnapshot(), operation = snapshot.syncOperations.find(o => o.id === operationId)
  if (!operation || operation.result !== '结果待核实') throw new Error('此操作无需核实首次发布结果。')
  // 在同一操作上收取查询结果，不再发送新建请求。
  return receiveChannelReceipt(demoChannelReceipt(operationId, 'success'))
}
function writePlatformValue(snapshot: ChannelCatalogSnapshot, listing: ChannelListing, targetId: string, field: string, value: unknown, eventId: string): void {
  if (targetId === listing.id) {
    if (!CHANNEL_CONTENT_SYNC_FIELDS.includes(field)) throw new Error('平台不能修改内部商品身份或技术资料。')
    if (field === 'title' && (typeof value !== 'string' || !value.trim())) throw new Error('平台标题不能为空。')
    const wasApproved=listing.reviewStatus==='审核通过'&&listing.approvedVersion===listing.contentVersion
    ;(listing.content as unknown as Record<string, unknown>)[field] = structuredClone(value)
    if (listing.publishedContent) (listing.publishedContent as unknown as Record<string, unknown>)[field] = structuredClone(value)
    listing.contentOverrides = [...new Set([...listing.contentOverrides, field])]; listing.contentVersion++
    // 平台正常回传不需要人工采纳，但不能把同页尚未审核的 PCS 草稿一起放行。
    if(wasApproved){listing.approvedVersion=listing.contentVersion;listing.reviewStatus='审核通过'}else listing.approvedVersion=null
  } else {
    const variant = snapshot.variants.find(v => v.id === targetId && v.listingId === listing.id)
    if (!variant || !CHANNEL_VARIANT_SYNC_FIELDS.includes(field)) throw new Error('平台不能修改内部 SKU 映射或库存。')
    if (field.startsWith('price.')) {
      const amount = value===null ? null : Number(value); if ((amount!==null&&(!Number.isFinite(amount)||amount<0)) || (field==='price.regular'&&(amount===null||amount<=0))) throw new Error('平台售价无效，原价格已保留。')
      const type = field.slice(6) as ChannelPriceType, previous = snapshot.prices.find(p => p.externalVariantId === variant.id && p.priceType === type)
      const price: ChannelPrice = { id: previous?.id || channelRecordId(), storeId: listing.storeId, internalSkuId: variant.internalSkuId, externalVariantId: variant.id, priceType: type, amount, currency: getChannelStore(listing.storeId)!.salesCurrency, mode: '覆盖', validFrom: '', validTo: '', origin: '平台', version: (previous?.version || 0) + 1, updatedAt: now() }
      snapshot.prices = [...snapshot.prices.filter(p => p.id !== price.id), price]
    } else { (variant as unknown as Record<string, unknown>)[field] = structuredClone(value); variant.version++ }
  }
  listing.version++; listing.updatedAt = now(); listing.updatedBy = '平台回传'; updateBaseline(snapshot, listing, { targetId, field }, value, eventId)
}
export interface ChannelPlatformEvent { eventId: string; listingId: string; sourceOperationId?: string; at: string; changes: Array<{ targetId: string; field: string; baseValue: unknown; value: unknown }>; platformStatus?: ChannelPlatformStatus; rawStatus?: string }
export function receiveChannelPlatformChange(event: ChannelPlatformEvent): ChannelSyncOperation {
  const snapshot = getPcsChannelCatalogSnapshot(), listing = snapshot.listings.find(l => l.id === event.listingId)
  if (!listing) throw new Error('平台变更尚未匹配内部渠道商品，不能创建无映射记录。')
  assertChannelListingEditable(listing)
  if(!listing.platformProductId)throw new Error('尚未取得平台 PID，不能接收平台销售变更。')
  const repeated = snapshot.syncOperations.find(o => o.sourceEventId === event.eventId || o.processedEventIds.includes(event.eventId))
  if (repeated) return repeated
  const own = event.sourceOperationId && snapshot.syncOperations.find(o => o.id === event.sourceOperationId && o.listingId === listing.id && o.direction === 'PCS→平台')
  if (own) {
    own.processedEventIds.push(event.eventId); channelLog(snapshot, listing.id, '识别自身同步回传', event.eventId, '演示平台', '演示回执'); writePcsChannelCatalogSnapshot(snapshot); return own
  }
  const store = getChannelStore(listing.storeId)!, operation: ChannelSyncOperation = { id: channelRecordId(), listingId: listing.id, targetVariantIds: [...new Set(event.changes.filter(c => c.targetId !== listing.id).map(c => c.targetId))], action: '平台变更', direction: '平台→PCS', fieldScope: event.changes.map(c => c.field), baseVersion: listing.version, submittedVersion: listing.version, sourceEventId: event.eventId, result: '成功', items: [], conflicts: [], errorReason: '', startedAt: event.at, completedAt: now(), parentOperationId: '', demo: true, attempt: 1, processedEventIds: [event.eventId] }
  operation.receiptSnapshots = [{ eventId: event.eventId, receivedAt: now(), platformProductId: listing.platformProductId, platformStatus: event.platformStatus, rawStatus: event.rawStatus || '', unknown: false,
    items: event.changes.map(change => ({ targetId: change.targetId, field: change.field, success: true, value: structuredClone(change.value), platformVariantId: snapshot.variants.find(variant => variant.id === change.targetId)?.platformVariantId })),
  }]
  for (const change of event.changes) {
    const current = readChannelSyncField(snapshot, listing, change.targetId, change.field), base = snapshot.fieldBaselines.find(b => b.listingId === listing.id && b.targetId === change.targetId && b.field === change.field)
    const item: ChannelSyncItem = { targetId: change.targetId, field: change.field, submittedValue: change.value, baseValue: change.baseValue, fieldVersion: fieldVersion(snapshot, listing, change.targetId, change.field), result: '成功', error: '' }
    if (!channelFieldSupported(store.channelCode, change.field) || ![...CHANNEL_CONTENT_SYNC_FIELDS, ...CHANNEL_VARIANT_SYNC_FIELDS].includes(change.field)) { item.result = '不支持'; item.error = '此字段不是平台可写销售资料；未改内部事实。'; operation.items.push(item); continue }
    if (base && !equal(base.value, change.baseValue)) { item.result = '已过期'; item.error = '平台事件基线已过期，仅记入历史。'; operation.items.push(item); continue }
    if (!equal(current, change.baseValue) && !equal(current, change.value)) {
      operation.conflicts.push({ targetId: change.targetId, field: change.field, baseValue: change.baseValue, pcsValue: current, platformValue: change.value, pcsVersion: listing.version, pcsAt: listing.updatedAt, platformEventId: event.eventId, platformAt: event.at })
      item.result = '失败'; item.error = '同字段从共同基线发生不同修改，请选择最终业务值。'
    } else writePlatformValue(snapshot, listing, change.targetId, change.field, change.value, event.eventId)
    operation.items.push(item)
  }
  const currentPlatformObservation=!listing.platformObservedAt||event.at>=listing.platformObservedAt
  const acceptedStatusObservation=currentPlatformObservation&&(event.changes.length===0||operation.items.some(i=>i.result==='成功'))&&!!(event.platformStatus||event.rawStatus)
  if(acceptedStatusObservation){
    if(event.platformStatus)listing.platformStatus=event.platformStatus
    if(event.rawStatus)listing.platformRawStatus=event.rawStatus
    if(event.platformStatus||event.rawStatus)listing.platformObservedAt=event.at
  }
  if(acceptedStatusObservation||operation.items.some(i=>i.result==='成功'))listing.lastSuccessAt=now()
  operation.result = operation.conflicts.length ? '同时变更待处理' : !operation.items.length ? acceptedStatusObservation?'成功':'已过期' : operation.items.every(i => i.result === '已过期') ? '已过期' : operation.items.some(i => i.result === '不支持') ? operation.items.some(i=>i.result==='成功')?'部分成功':'失败' : '成功'
  snapshot.syncOperations.push(operation); recalculateSyncState(snapshot, listing)
  channelLog(snapshot, listing.id, '平台变更自动同步', `${operation.items.length} 项；${operation.result}；只修改此店铺渠道表达`, '演示平台', '演示回执')
  writePcsChannelCatalogSnapshot(snapshot); return operation
}
export function resolveChannelSyncConflict(operationId: string, targetId: string, field: string, choice: 'PCS' | '平台', actor = '当前用户'): void {
  const snapshot = getPcsChannelCatalogSnapshot(), operation = snapshot.syncOperations.find(o => o.id === operationId), conflict = operation?.conflicts.find(c => c.targetId === targetId && c.field === field)
  if (!operation || !conflict) throw new Error('该差异已经处理，请重新读取。')
  const listing = snapshot.listings.find(l => l.id === operation.listingId)!;assertChannelListingEditable(listing)
  const current = readChannelSyncField(snapshot, listing, targetId, field)
  if (!equal(current, conflict.pcsValue)) throw new Error('PCS 该字段已有新修改，请重新核对最新值。')
  const final = choice === '平台' ? conflict.platformValue : conflict.pcsValue
  writePlatformValue(snapshot, listing, targetId, field, final, channelRecordId())
  operation.conflicts = operation.conflicts.filter(c => c !== conflict)
  const item = operation.items.find(i => i.targetId === targetId && i.field === field)!
  item.result = '成功'; item.observedValue = final; item.error = ''
  if (!operation.conflicts.length) operation.result = '成功'
  const contentConfirmed=CHANNEL_CONTENT_SYNC_FIELDS.filter(f=>channelFieldSupported(getChannelStore(listing.storeId)!.channelCode,f)).every(f=>{const b=snapshot.fieldBaselines.find(b=>b.listingId===listing.id&&b.targetId===listing.id&&b.field===f);return b&&equal(b.value,(listing.content as unknown as Record<string,unknown>)[f])})
  if(contentConfirmed){listing.reviewStatus='审核通过';listing.approvedVersion=listing.contentVersion}
  recalculateSyncState(snapshot, listing); channelLog(snapshot, listing.id, '处理同时变更', `${field} 采用${choice}值；演示回执已确认最终值`, actor)
  writePcsChannelCatalogSnapshot(snapshot)
  if(choice==='PCS'){
    // 人工处理只确认这一冲突字段；其他未审核内容仍保留草稿，不随本次发送。
    const current=getPcsChannelCatalogSnapshot(),subject=current.listings.find(l=>l.id===listing.id)!,id=channelRecordId()
    const propagation:ChannelSyncOperation={id,listingId:subject.id,targetVariantIds:targetId===subject.id?[]:[targetId],action:'更新',direction:'PCS→平台',fieldScope:[field],baseVersion:conflict.pcsVersion,submittedVersion:subject.version,sourceEventId:id,result:'提交中',items:[{targetId,field,submittedValue:final,baseValue:conflict.platformValue,fieldVersion:fieldVersion(current,subject,targetId,field),result:'待回执',error:''}],conflicts:[],errorReason:'',startedAt:now(),completedAt:'',parentOperationId:'',demo:true,attempt:1,processedEventIds:[]}
    current.syncOperations.push(propagation);writePcsChannelCatalogSnapshot(current);receiveChannelReceipt(demoChannelReceipt(id))
  }
}
export function recordSharedChannelAvailability(input: { sourceRef: string; sourceVersion: string; rows: Array<{ internalSkuId: string; available: number; unit: string }>; listingIds: string[] }): ChannelSyncOperation[] {
  const snapshot = getPcsChannelCatalogSnapshot(), source = new Map(input.rows.map(r => [r.internalSkuId, r]))
  if (source.size !== input.rows.length || !input.sourceRef || !input.sourceVersion || input.rows.some(r => !Number.isFinite(r.available) || r.available < 0 || !r.unit)) throw new Error('WMS 共享可售来源必须有唯一 SKU、有效数量、单位和来源版本。')
  const results: ChannelSyncOperation[] = []
  for (const id of input.listingIds) {
    const listing = snapshot.listings.find(l => l.id === id); if (!listing) throw new Error('渠道商品不存在。')
    assertChannelListingEditable(listing)
    if(!listing.platformProductId)throw new Error('未发布渠道商品不能记为平台可售观测。')
    const observedAvailability = snapshot.variants.filter(v => v.listingId === id && v.active && source.has(v.internalSkuId)).map(v => ({ externalVariantId: v.id, internalSkuId: v.internalSkuId, quantity: source.get(v.internalSkuId)!.available, unit: source.get(v.internalSkuId)!.unit }))
    const operation: ChannelSyncOperation = { id: channelRecordId(), listingId: id, targetVariantIds: observedAvailability.map(v => v.externalVariantId), action: '共享可售', direction: 'WMS→平台', fieldScope: ['availability'], baseVersion: listing.version, submittedVersion: listing.version, sourceEventId: `${input.sourceRef}:${input.sourceVersion}`, result: '成功', items: [], conflicts: [], errorReason: '', startedAt: now(), completedAt: now(), parentOperationId: '', demo: true, attempt: 1, processedEventIds: [], observedAvailability, wmsSourceRef: `${input.sourceRef}@${input.sourceVersion}` }
    operation.receiptSnapshots = [{ eventId: operation.sourceEventId, receivedAt: operation.completedAt, platformProductId: listing.platformProductId, platformStatus: listing.platformStatus, rawStatus: listing.platformRawStatus, unknown: false, items: observedAvailability.map(value => ({ targetId: value.externalVariantId, field: 'availability', success: true, platformVariantId: snapshot.variants.find(variant => variant.id === value.externalVariantId)?.platformVariantId, value: { quantity: value.quantity, unit: value.unit, source: operation.wmsSourceRef } })) }]
    snapshot.syncOperations.push(operation); results.push(operation)
  }
  // 只记同步观测；不存在库存表、店铺分配份额或反写 WMS 的操作。
  writePcsChannelCatalogSnapshot(snapshot); return results
}
export function getTestingChannelListingResults(testingOrderId: string, testingListingActionId: string) { return getPcsChannelCatalogSnapshot().listings.filter(l => (l.sourceTestingOrderId === testingOrderId && l.testingListingActionId === testingListingActionId)||l.testingReferences?.some(r=>r.testingOrderId===testingOrderId&&r.testingListingActionId===testingListingActionId)).map(l => ({ listingId: l.id, platformProductId: l.platformProductId, platformStatus: l.platformStatus, syncStatus: l.syncStatus, lastSuccessAt: l.lastSuccessAt, sourceTestingOrderId: testingOrderId, testingListingActionId })) }

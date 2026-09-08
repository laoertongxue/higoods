import type { SpecialCraftTaskOrder } from './special-craft-task-orders.ts'
import type { WoolDomainStore } from './wool-domain/store.ts'

type WoolStoreResolver = () => WoolDomainStore
type SpecialCraftTaskOrderResolver = () => readonly SpecialCraftTaskOrder[]

let resolveWoolStore: WoolStoreResolver | null = null
let resolveSpecialCraftTaskOrders: SpecialCraftTaskOrderResolver | null = null

export function installPostFinishingWoolSourceResolver(resolver: WoolStoreResolver): () => void {
  resolveWoolStore = resolver
  return () => {
    if (resolveWoolStore === resolver) resolveWoolStore = null
  }
}

export function installPostFinishingSpecialCraftSourceResolver(
  resolver: SpecialCraftTaskOrderResolver,
): () => void {
  resolveSpecialCraftTaskOrders = resolver
  return () => {
    if (resolveSpecialCraftTaskOrders === resolver) resolveSpecialCraftTaskOrders = null
  }
}

export function readPostFinishingWoolSourceStore(): WoolDomainStore | undefined {
  return resolveWoolStore?.()
}

export function readPostFinishingSpecialCraftSourceTaskOrders(): SpecialCraftTaskOrder[] {
  return resolveSpecialCraftTaskOrders ? [...resolveSpecialCraftTaskOrders()] : []
}

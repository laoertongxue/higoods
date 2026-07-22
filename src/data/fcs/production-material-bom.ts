export function selectProductionMaterialBomItems<T extends { type?: string }>(bomItems: T[]): T[] {
  return bomItems.filter((item) => item.type !== '成衣')
}

export function selectPrimaryProductionMaterialBomItem<T extends { type?: string }>(bomItems: T[]): T | undefined {
  return selectProductionMaterialBomItems(bomItems)[0]
}

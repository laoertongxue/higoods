// Keep frozen image bytes in this ledger, but store each distinct image only once.
// Legacy JSON remains readable; this is lossless and does not depend on upload lifetime.
const IMAGE_REF = 'higoods-print-image:v1:'
const IMAGE_FIELDS = new Set(['imageUrl', 'targetSpuImageUrl', 'dataUrl'])

export function serializePrintExecution(value: object): string {
  const imageDataUrls: string[] = []
  const indices = new Map<string, number>()
  const compact = JSON.parse(JSON.stringify(value, (key, item) => {
    if (!IMAGE_FIELDS.has(key) || typeof item !== 'string' || !item.startsWith('data:')) return item
    let index = indices.get(item)
    if (index === undefined) {
      index = imageDataUrls.length
      indices.set(item, index)
      imageDataUrls.push(item)
    }
    return `${IMAGE_REF}${index}`
  }))
  return JSON.stringify(imageDataUrls.length ? { ...compact, imageDataUrls } : compact)
}

export function parsePrintExecution(raw: string): unknown {
  const value = JSON.parse(raw)
  const images = value?.imageDataUrls
  if (images === undefined) return value
  if (!Array.isArray(images) || images.some(image => typeof image !== 'string' || !image.startsWith('data:'))) {
    throw new Error('印花图片记录格式不完整')
  }
  delete value.imageDataUrls
  return JSON.parse(JSON.stringify(value), (key, item) => {
    if (!IMAGE_FIELDS.has(key) || typeof item !== 'string' || !item.startsWith(IMAGE_REF)) return item
    const index = item.slice(IMAGE_REF.length)
    if (!/^(0|[1-9]\d*)$/.test(index) || !images[Number(index)]) throw new Error('印花图片引用缺失')
    return images[Number(index)]
  })
}

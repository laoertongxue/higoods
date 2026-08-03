const LABEL_PREFIX = 'LC-'
const QR_PREFIX = 'HIGOOD:LOCATION:v1:'
const FNV_OFFSET = 0xcbf29ce484222325n
const FNV_PRIME = 0x100000001b3n
const FNV_MASK = 0xffffffffffffffffn

function fnv1a64(value: string, seed: bigint): bigint {
  let hash = seed
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte)
    hash = (hash * FNV_PRIME) & FNV_MASK
  }
  return hash
}

function base36(value: bigint): string {
  return value.toString(36).toUpperCase().padStart(13, '0')
}

export function buildWarehouseLocationLabelCode(warehouseId: string, locationId: string): string {
  const identity = `${warehouseId}\u001f${locationId}`
  return `${LABEL_PREFIX}${base36(fnv1a64(identity, FNV_OFFSET))}${base36(fnv1a64(identity, FNV_OFFSET ^ 0x9e3779b97f4a7c15n))}`
}

export function buildWarehouseLocationQrValue(labelCode: string): string {
  return `${QR_PREFIX}${labelCode}`
}

export function parseWarehouseLocationLabelValue(value: string): string | null {
  const normalized = value.trim().toUpperCase()
  const normalizedQrPrefix = QR_PREFIX.toUpperCase()
  const labelCode = normalized.startsWith(normalizedQrPrefix) ? normalized.slice(normalizedQrPrefix.length) : normalized
  return /^LC-[0-9A-Z]{26}$/.test(labelCode) ? labelCode : null
}

export function assertUniqueWarehouseLocationLabelCodes(
  identities: Array<{ warehouseId: string; locationId: string }>,
): void {
  const ownerByCode = new Map<string, string>()
  identities.forEach(({ warehouseId, locationId }) => {
    const owner = `${warehouseId}|${locationId}`
    const code = buildWarehouseLocationLabelCode(warehouseId, locationId)
    const existing = ownerByCode.get(code)
    if (existing && existing !== owner) throw new Error(`库位标签码 ${code} 重复，请停止打印并联系主管。`)
    ownerByCode.set(code, owner)
  })
}

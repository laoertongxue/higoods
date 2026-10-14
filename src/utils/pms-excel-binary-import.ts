import { formatPmsExcelNumber } from './pms-excel-import.ts'

// Only loaded for a compound-binary signature. This reads import cell values, never macros/formulas.
// Format references: Microsoft [MS-CFB] 2.2–2.6 and [MS-XLS] BIFF8/SST/RkNumber/FormulaValue.
const END = 0xfffffffe
const FREE = 0xffffffff
const FAT = 0xfffffffd
const DIFAT = 0xfffffffc
const invalid = (detail: string): never => { throw new Error(`xls 文件${detail}，请用 Excel 重新保存后上传`) }
const viewOf = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
const utf16 = new TextDecoder('utf-16le', { fatal: true })

function workbookStream(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 1536) invalid('被截断')
  const view = viewOf(bytes)
  const major = view.getUint16(26, true), shift = view.getUint16(30, true)
  if ((major !== 3 || shift !== 9) && (major !== 4 || shift !== 12)) invalid('容器版本不支持，请另存为 .xlsx')
  if (view.getUint16(28, true) !== 0xfffe || view.getUint16(32, true) !== 6 || view.getUint32(56, true) !== 4096) invalid('容器结构不支持')
  const sectorSize = 2 ** shift, count = bytes.length / sectorSize - 1
  if (!Number.isInteger(count) || count < 2) invalid('扇区被截断')
  const sector = (id: number): Uint8Array => {
    if (!Number.isInteger(id) || id < 0 || id >= count) invalid('扇区引用损坏')
    return bytes.subarray((id + 1) * sectorSize, (id + 2) * sectorSize)
  }
  const fatCount = view.getUint32(44, true), difatCount = view.getUint32(72, true)
  if (!fatCount || fatCount > count || difatCount > count) invalid('分配表损坏')
  const fatIds: number[] = []
  for (let i = 0; i < 109; i += 1) { const id = view.getUint32(76 + i * 4, true); if (id !== FREE) fatIds.push(id) }
  const difatIds = new Set<number>(); let next = view.getUint32(68, true)
  for (let i = 0; i < difatCount; i += 1) {
    if (difatIds.has(next)) invalid('分配表循环')
    difatIds.add(next)
    const data = viewOf(sector(next))
    for (let j = 0; j < sectorSize / 4 - 1; j += 1) { const id = data.getUint32(j * 4, true); if (id !== FREE) fatIds.push(id) }
    next = data.getUint32(sectorSize - 4, true)
  }
  if (difatCount && next !== END) invalid('分配表结束标记损坏')
  if (fatIds.length !== fatCount || new Set(fatIds).size !== fatCount) invalid('分配表数量或重复引用损坏')
  const fat: number[] = []
  for (const id of fatIds) { const data = viewOf(sector(id)); for (let i = 0; i < sectorSize; i += 4) fat.push(data.getUint32(i, true)) }
  if (fat.length < count || fatIds.some((id) => fat[id] !== FAT) || [...difatIds].some((id) => fat[id] !== DIFAT)) invalid('分配表标记损坏')
  const chain = (start: number, table: number[], limit: number, size?: number): number[] => {
    const ids: number[] = [], seen = new Set<number>(); let id = start
    while (id !== END) {
      if (id >= limit || id >= table.length || seen.has(id) || ids.length >= limit) invalid('数据链损坏或循环')
      seen.add(id); ids.push(id); id = table[id]
    }
    if (size !== undefined && ids.length !== size) invalid('数据链长度不符')
    return ids
  }
  const regular = (start: number, size?: number): Uint8Array => {
    if (size !== undefined && (!Number.isSafeInteger(size) || size < 0 || size > bytes.length)) invalid('数据大小损坏')
    const ids = chain(start, fat, count, size === undefined ? undefined : Math.ceil(size / sectorSize))
    const out = new Uint8Array(size ?? ids.length * sectorSize)
    ids.forEach((id, i) => out.set(sector(id).subarray(0, Math.min(sectorSize, out.length - i * sectorSize)), i * sectorSize))
    return out
  }
  const directory = regular(view.getUint32(48, true)), dv = viewOf(directory)
  if (directory.length < 128 || directory[66] !== 5) invalid('缺少根目录')
  const entries: { name: string; type: number; left: number; right: number; child: number; start: number; size: number }[] = []
  for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
    const type = directory[offset + 66], length = dv.getUint16(offset + 64, true)
    if (type && (length < 2 || length > 64 || length % 2)) invalid('目录名称损坏')
    const high = major === 4 ? dv.getUint32(offset + 124, true) : 0
    let name = ''
    try { if (type) name = utf16.decode(directory.subarray(offset, offset + length - 2)) } catch { invalid('目录文本损坏') }
    entries.push({ name, type, left: dv.getUint32(offset + 68, true), right: dv.getUint32(offset + 72, true), child: dv.getUint32(offset + 76, true), start: dv.getUint32(offset + 116, true), size: dv.getUint32(offset + 120, true) + high * 2 ** 32 })
  }
  const root = entries[0], pending = [root.child], visited = new Set<number>(), streams: typeof entries = []
  while (pending.length) {
    const id = pending.pop()!
    if (id === FREE) continue
    if (id >= entries.length || visited.has(id)) invalid('目录引用损坏或重复')
    visited.add(id)
    const entry = entries[id]
    pending.push(entry.left, entry.right)
    if (entry.type === 2) streams.push(entry)
  }
  if (streams.some((entry) => /^(EncryptionInfo|EncryptedPackage)$/i.test(entry.name))) throw new Error('文件已加密，请取消打开密码后重新上传')
  const books = streams.filter((entry) => /^(Workbook|Book)$/i.test(entry.name))
  if (books.length !== 1 || !books[0].size) invalid('未找到唯一 Excel 工作簿，请另存为 .xlsx')
  const book = books[0]
  if (book.size >= 4096) return regular(book.start, book.size)
  const miniCount = view.getUint32(64, true)
  if (!miniCount || miniCount > count) invalid('小数据分配表损坏')
  const miniBytes = regular(view.getUint32(60, true), miniCount * sectorSize), mv = viewOf(miniBytes), miniFat: number[] = []
  for (let i = 0; i < miniBytes.length; i += 4) miniFat.push(mv.getUint32(i, true))
  const miniStream = regular(root.start, root.size)
  const miniIds = chain(book.start, miniFat, Math.ceil(miniStream.length / 64), Math.ceil(book.size / 64))
  const out = new Uint8Array(book.size)
  miniIds.forEach((id, i) => {
    const length = Math.min(64, book.size - i * 64)
    if (id * 64 + length > miniStream.length) invalid('小数据流截断')
    out.set(miniStream.subarray(id * 64, id * 64 + length), i * 64)
  })
  return out
}

type RecordEntry = { type: number; data: Uint8Array; offset: number }
function records(bytes: Uint8Array, start: number): RecordEntry[] {
  const view = viewOf(bytes), out: RecordEntry[] = []; let offset = start
  while (offset + 4 <= bytes.length) {
    const type = view.getUint16(offset, true), size = view.getUint16(offset + 2, true)
    if (size > 8224 || offset + 4 + size > bytes.length) invalid('工作表记录截断或大小不符')
    out.push({ type, data: bytes.subarray(offset + 4, offset + 4 + size), offset }); offset += 4 + size
    if (type === 0x002f) throw new Error('xls 文件已加密，请取消打开密码后重新上传')
    if (type === 0x000a) return out
  }
  return invalid('工作表缺少结束记录')
}

// CONTINUE re-encoding byte applies only while characters cross a record boundary.
// Rich formatting/phonetic payload is skipped as bytes, preserving the next string boundary.
class StringReader {
  private index = 0
  private offset = 0
  constructor(private chunks: Uint8Array[]) {}
  private advance(): void {
    while (this.index < this.chunks.length && this.offset === this.chunks[this.index].length) { this.index += 1; this.offset = 0 }
    if (this.index >= this.chunks.length) invalid('文本数据截断')
  }
  byte(): number { this.advance(); return this.chunks[this.index][this.offset++] }
  uint16(): number { return this.byte() | (this.byte() << 8) }
  uint32(): number { return (this.uint16() + this.uint16() * 65536) >>> 0 }
  skip(size: number): void { for (let i = 0; i < size; i += 1) this.byte() }
  string(rich = false): string {
    const count = this.uint16(), flags = this.byte()
    if (count > 32767 || (!rich && (flags & 0x0c))) invalid('文本格式不支持')
    const runs = flags & 8 ? this.uint16() : 0, ext = flags & 4 ? this.uint32() : 0
    let wide = Boolean(flags & 1), value = ''
    for (let i = 0; i < count; i += 1) {
      if (this.offset === this.chunks[this.index].length) {
        this.advance(); const encoding = this.byte()
        if (encoding > 1) invalid('连续文本编码损坏')
        wide = Boolean(encoding)
      }
      if (wide && this.chunks[this.index].length - this.offset < 2) invalid('Unicode 文本被截断')
      value += String.fromCharCode(wide ? this.uint16() : this.byte())
    }
    this.skip(runs * 4 + ext)
    return value
  }
}

function sharedStrings(entries: RecordEntry[]): string[] {
  const index = entries.findIndex((entry) => entry.type === 0x00fc)
  if (index < 0) return []
  if (entries.filter((entry) => entry.type === 0x00fc).length !== 1) invalid('共享文本表重复')
  const chunks = [entries[index].data]
  for (let i = index + 1; entries[i]?.type === 0x003c; i += 1) chunks.push(entries[i].data)
  const reader = new StringReader(chunks), total = reader.uint32(), unique = reader.uint32()
  if (unique > total || unique > chunks.reduce((sum, chunk) => sum + chunk.length, 0) / 3) invalid('共享文本数量损坏')
  return Array.from({ length: unique }, () => reader.string(true))
}

function rk(raw: number): number {
  let value: number
  if (raw & 2) value = (raw | 0) >> 2
  else { const view = new DataView(new ArrayBuffer(8)); view.setUint32(4, (raw & 0xfffffffc) >>> 0, true); value = view.getFloat64(0, true) }
  return raw & 1 ? value / 100 : value
}

export function parsePmsBinaryExcelRows(bytes: Uint8Array): string[][] {
  const book = workbookStream(bytes), global = records(book, 0)
  const requireSize = (data: Uint8Array, size: number): DataView => { if (data.length < size) invalid('单元格记录截断'); return viewOf(data) }
  const bof = requireSize(global[0].data, 16)
  if (global[0].type !== 0x0809 || bof.getUint16(0, true) !== 0x0600 || bof.getUint16(2, true) !== 5) invalid('不是支持的 BIFF8 工作簿，请另存为 Excel 97–2003 .xls 或 .xlsx')
  const sheets = global.filter((entry) => entry.type === 0x0085)
  const firstSheet = sheets.find((entry) => { requireSize(entry.data, 8); return entry.data[5] === 0 }) ?? invalid('没有可导入的工作表，请把数据放到普通工作表')
  const sheetOffset = viewOf(firstSheet.data).getUint32(0, true)
  if (sheetOffset < global[global.length - 1].offset + 4 || sheetOffset >= book.length) invalid('工作表位置损坏')
  const shared = sharedStrings(global), xfs: number[] = [], formats = new Map<number, string>(); let date1904 = false
  for (const entry of global) {
    const data = entry.data
    if (entry.type === 0x00e0) xfs.push(requireSize(data, 4).getUint16(2, true))
    if (entry.type === 0x041e) { const id = requireSize(data, 5).getUint16(0, true); if (formats.has(id)) invalid('数字格式重复'); formats.set(id, new StringReader([data.subarray(2)]).string()) }
    if (entry.type === 0x0022) { const value = requireSize(data, 2).getUint16(0, true); if (value > 1) invalid('日期系统不支持'); date1904 = value === 1 }
  }
  const sheet = records(book, sheetOffset), sheetBof = requireSize(sheet[0].data, 16)
  if (sheet[0].type !== 0x0809 || sheetBof.getUint16(0, true) !== 0x0600 || sheetBof.getUint16(2, true) !== 0x0010) invalid('首工作表类型不支持，请把数据放到普通工作表')
  const rows = new Map<number, Map<number, string>>()
  let pendingString: { row: number; col: number } | undefined
  const set = (row: number, col: number, value: string): void => {
    if (col > 255) invalid('列号超出 XLS 范围')
    const cells = rows.get(row) ?? new Map<number, string>()
    if (cells.has(col)) invalid(`第 ${row + 1} 行单元格重复`)
    cells.set(col, value.trim()); rows.set(row, cells)
  }
  const number = (data: Uint8Array, value: number, xfOffset = 4): string => {
    const xf = requireSize(data, xfOffset + 2).getUint16(xfOffset, true)
    if (xf >= xfs.length) invalid('单元格格式引用损坏')
    const id = xfs[xf]; return formatPmsExcelNumber(value, id, formats.get(id), date1904)
  }
  const errorCell = (row: number, col: number): never => { throw new Error(`第 ${row + 1} 行第 ${col + 1} 列存在 Excel 错误，请修正后重新上传`) }
  for (let i = 1; i < sheet.length; i += 1) {
    const { type, data } = sheet[i]
    if (type === 0x00d6 || type === 0x0202) invalid('包含不支持的旧版单元格，请另存为 .xlsx')
    if (type === 0x0081 && requireSize(data, 2).getUint16(0, true) & 0x0010) invalid('对话框工作表不支持，请把数据放到普通工作表')
    if (type === 0x0207) {
      const target = pendingString ?? invalid('公式文本缺少对应单元格')
      const chunks = [data]; while (sheet[i + 1]?.type === 0x003c) chunks.push(sheet[++i].data)
      set(target.row, target.col, new StringReader(chunks).string()); pendingString = undefined; continue
    }
    if (![0x0203, 0x027e, 0x00bd, 0x00fd, 0x0204, 0x0205, 0x0006].includes(type)) continue
    if (pendingString) invalid('公式文本缓存缺失，请在 Excel 中计算并保存文件')
    const view = requireSize(data, 6), row = view.getUint16(0, true), col = view.getUint16(2, true)
    if (type === 0x0203) { requireSize(data, 14); set(row, col, number(data, view.getFloat64(6, true))) }
    else if (type === 0x027e) { requireSize(data, 10); set(row, col, number(data, rk(view.getUint32(6, true)))) }
    else if (type === 0x00bd) {
      const lastCol = view.getUint16(data.length - 2, true), count = lastCol - col + 1
      if (count < 1 || data.length !== 6 + count * 6) invalid('连续数字单元格损坏')
      for (let index = 0; index < count; index += 1) set(row, col + index, number(data, rk(view.getUint32(6 + index * 6, true)), 4 + index * 6))
    } else if (type === 0x00fd) {
      const index = requireSize(data, 10).getUint32(6, true)
      if (index >= shared.length) invalid('共享文本引用损坏')
      set(row, col, shared[index])
    } else if (type === 0x0204) set(row, col, new StringReader([data.subarray(6)]).string())
    else if (type === 0x0205) {
      requireSize(data, 8); if (data[7]) errorCell(row, col)
      if (data[6] > 1) invalid('布尔值损坏')
      set(row, col, data[6] ? 'TRUE' : 'FALSE')
    } else {
      requireSize(data, 22)
      if (view.getUint16(12, true) !== 0xffff) set(row, col, number(data, view.getFloat64(6, true)))
      else if (data[6] === 0) pendingString = { row, col }
      else if (data[6] === 1) { if (data[8] > 1) invalid('公式布尔值损坏'); set(row, col, data[8] ? 'TRUE' : 'FALSE') }
      else if (data[6] === 2) errorCell(row, col)
      else if (data[6] === 3) set(row, col, '')
      else invalid('公式缓存类型不支持，请在 Excel 中计算并保存文件')
    }
  }
  if (pendingString) invalid('公式文本缓存缺失，请在 Excel 中计算并保存文件')
  return [...rows.entries()].sort(([a], [b]) => a - b).map(([, cells]) => Array.from({ length: Math.max(...cells.keys()) + 1 }, (_, col) => cells.get(col) ?? '')).filter((row) => row.some(Boolean))
}

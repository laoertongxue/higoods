/** 保留未移动记录的排序位置；前插、删除和单条置顶不重写整张列表。 */
export function assignPcsRecordPositions(ids: readonly string[], previous: ReadonlyMap<string, number>): Map<string, number> {
  const tails: number[] = []
  const links = new Map<number, number>()
  for (let index = 0; index < ids.length; index++) {
    const position = previous.get(ids[index])
    if (position === undefined) continue
    let low = 0, high = tails.length
    while (low < high) {
      const middle = (low + high) >>> 1
      if (previous.get(ids[tails[middle]])! < position) low = middle + 1
      else high = middle
    }
    links.set(index, low ? tails[low - 1] : -1)
    tails[low] = index
  }
  const anchors = new Set<number>()
  for (let index = tails.at(-1) ?? -1; index >= 0; index = links.get(index) ?? -1) anchors.add(index)
  const positions = new Map<string, number>()
  let start = 0
  let left: number | undefined
  for (let end = 0; end <= ids.length; end++) {
    if (end < ids.length && !anchors.has(end)) continue
    const right = end < ids.length ? previous.get(ids[end])! : undefined
    const count = end - start
    const lower = left ?? (right === undefined ? -1 : right - count - 1)
    const upper = right ?? lower + count + 1
    const step = (upper - lower) / (count + 1)
    for (let offset = 0; offset < count; offset++) {
      const position = lower + step * (offset + 1)
      if (!Number.isFinite(position) || position <= (offset ? positions.get(ids[start + offset - 1])! : lower) || position >= upper) {
        throw new Error('记录排序位置不足，本次未保存。请保留当前输入并联系负责人。')
      }
      positions.set(ids[start + offset], position)
    }
    if (right !== undefined) positions.set(ids[end], right)
    left = right
    start = end + 1
  }
  return positions
}

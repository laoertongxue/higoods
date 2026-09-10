import assert from 'node:assert/strict'
import test from 'node:test'
import {
  aggregateSewingDurationNode,
  calculateActualDurationHours,
  listSewingProductionOrderDurations,
  SEWING_DURATION_NODES,
  type SewingDurationSource,
} from '../../src/data/fcs/sewing-production-order-duration.ts'
import { SEWING_OUTSOURCING_DEMO_CURRENT_PPIC } from '../../src/data/fcs/factory-onboarding-ppic.ts'
const source = (id: string, startAt: string, endAt: string, included = true): SewingDurationSource => ({ id, no: id, label: '测试来源', task: id, factory: id, status: '测试', startAt, endAt, version: 'V1', included, reason: '', href: '/fcs/sewing-outsourcing/returns' })
test('实际耗时跨周日仍按真实时间差；没有可靠时间不造耗时', () => {
  assert.equal(calculateActualDurationHours('2026-09-05 12:00:00', '2026-09-07 12:00:00', ''), 48)
  assert.equal(calculateActualDurationHours('', '2026-09-07 12:00:00', ''), null)
  assert.equal(calculateActualDurationHours('2026-09-07 12:00:00', '2026-09-05 12:00:00', ''), null)
})
test('每任务都达成才结束；同一来源去重，作废明细不影响主表', () => {
  const a = source('A', '2026-09-01 10:00:00', '2026-09-02 10:00:00')
  const b = source('B', '2026-09-01 11:00:00', '')
  const old = source('OLD', '2020-01-01 10:00:00', '2030-01-01 10:00:00', false)
  const result = aggregateSewingDurationNode('30%回货', [a, a, b, old], '2026-09-03 10:00:00')
  assert.equal(result.sources.length, 3)
  assert.equal(result.startAt, a.startAt)
  assert.equal(result.endAt, '')
  assert.equal(result.hours, 48)
  b.endAt = '2026-09-03 10:00:00'
  assert.equal(aggregateSewingDurationNode('30%回货', [a, b, old], '').endAt, b.endAt)
})

test('耗时页 Mock 至少覆盖九张生产单和全部节点，且下游事实不会越过未完成的前置节点', () => {
  const rows = listSewingProductionOrderDurations({
    viewerPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
    nowAt: '2026-09-08 18:00:00',
  })

  assert.ok(rows.length >= 9)
  const coveredNodes = new Set(rows.flatMap((row) => row.nodes.filter((node) => node.sources.length).map((node) => node.name)))
  assert.deepEqual([...coveredNodes].sort(), [...SEWING_DURATION_NODES].sort())

  for (const row of rows) {
    row.nodes.forEach((node, index) => {
      if (!node.sources.length) return
      for (const prerequisite of row.nodes.slice(0, index)) {
        assert.ok(
          prerequisite.endAt,
          `${row.productionOrderNo} 的${node.name}已有数据，但前置节点${prerequisite.name}尚未完成`,
        )
      }
      const previous = row.nodes[index - 1]
      if (previous?.endAt && node.startAt) {
        assert.ok(
          Date.parse(node.startAt.replace(' ', 'T')) >= Date.parse(previous.endAt.replace(' ', 'T')),
          `${row.productionOrderNo} 的${node.name}开始时间早于前置节点${previous.name}结束时间`,
        )
      }
    })
  }
})

test('裁片放行按一张放行单内的多次放行展示并选取节点起止时间', () => {
  const rows = listSewingProductionOrderDurations({
    viewerPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
    nowAt: '2026-09-08 18:00:00',
  })
  const releaseNodes = rows.map((row) => ({
    productionOrderNo: row.productionOrderNo,
    node: row.nodes.find((node) => node.name === '裁片放行')!,
  })).filter(({ node }) => node.sources.length > 0)

  assert.ok(releaseNodes.length >= 2, 'Mock 应同时覆盖已完成和进行中的裁片放行')
  for (const { productionOrderNo, node } of releaseNodes) {
    assert.ok(node.sources.length >= 2, `${productionOrderNo} 应展示同一张放行单内的多次放行`)
    assert.equal(
      new Set(node.sources.map((release) => release.no)).size,
      1,
      `${productionOrderNo} 只能有一个裁片放行单号`,
    )
    node.sources.forEach((release, index) => {
      assert.match(release.label, new RegExp(`第${index + 1}次放行`))
      assert.match(release.label, new RegExp(`V${index + 1}`))
      assert.match(release.label, /本次\d+件/)
      assert.match(release.label, /累计\d+→\d+件/)
      assert.equal(release.version, `V${index + 1}`)
    })
    assert.equal(node.startAt, node.sources[0].startAt, `${productionOrderNo} 应取第一次有效放行为节点开始`)
    if (node.endAt) {
      assert.equal(
        node.endAt,
        node.sources.at(-1)?.endAt,
        `${productionOrderNo} 应取累计首次达到目标的放行为节点结束`,
      )
    }
  }
})

import assert from 'node:assert/strict'

import {
  listMaterialArchives,
} from '../src/data/pcs-material-archive-repository.ts'
import type { MaterialArchiveKind } from '../src/data/pcs-material-archive-types.ts'
import {
  renderPcsAccessoryArchiveListPage,
  renderPcsConsumableArchiveListPage,
  renderPcsFabricArchiveListPage,
  renderPcsPackagingArchiveListPage,
  renderPcsPartsArchiveListPage,
  renderPcsYarnArchiveListPage,
} from '../src/pages/pcs-material-archives.ts'

const kinds: MaterialArchiveKind[] = ['fabric', 'accessory', 'yarn', 'consumable', 'packaging', 'parts']

for (const kind of kinds) {
  const records = listMaterialArchives(kind)
  assert.ok(records.length > 0, `${kind} 应有演示物料主档`)

  for (const record of records) {
    assert.ok(record.mainUnit.trim(), `${record.materialCode} 应维护主单位`)
    assert.ok(Array.isArray(record.auxiliaryUnits), `${record.materialCode} 辅助单位应为数组`)
    assert.ok(record.auxiliaryUnits.length >= 2, `${record.materialCode} 应维护多种辅助单位`)
    assert.equal(new Set(record.auxiliaryUnits).size, record.auxiliaryUnits.length, `${record.materialCode} 辅助单位不应重复`)
    assert.ok(!record.auxiliaryUnits.includes(record.mainUnit), `${record.materialCode} 辅助单位不应重复主单位`)
  }
}

const listPages = [
  renderPcsFabricArchiveListPage(),
  renderPcsAccessoryArchiveListPage(),
  renderPcsYarnArchiveListPage(),
  renderPcsConsumableArchiveListPage(),
  renderPcsPackagingArchiveListPage(),
  renderPcsPartsArchiveListPage(),
]

assert.ok(listPages.every((html) => html.includes('主单位：')), '物料列表应展示主单位')
assert.ok(listPages.every((html) => html.includes('辅助：')), '物料列表应展示辅助单位')

console.log('check-pcs-material-archive-units PASS')

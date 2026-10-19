import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getAccessoryWarehouse,
  isEnabledAccessoryWarehouseLocation,
  listAccessoryWarehouseLocations,
  listEnabledAccessoryWarehouseLocations,
  listAccessoryWarehouses,
  listAccessoryWarehouseZones,
  resolveAccessoryWarehouseForCuttingFactoryName,
} from '../../src/data/wls/accessory-warehouse-master.ts'

test('three enabled Indonesian accessory warehouses have independent usable zones and locations', () => {
  const warehouses = listAccessoryWarehouses()
  const zones = listAccessoryWarehouseZones()
  const locations = listAccessoryWarehouseLocations()

  assert.deepEqual(warehouses.map(({ key, code }) => ({ key, code })), [
    { key: 'gtp', code: 'WH-FITTING-001' },
    { key: 'hilon', code: 'HILON-2' },
    { key: 'mahameru', code: 'WH-FITTING-MAHAMERU' },
  ])
  assert.equal(zones.length, 6)
  assert.equal(locations.length, 18)
  assert.equal(new Set(zones.map((zone) => zone.id)).size, zones.length)
  assert.equal(new Set(locations.map((location) => location.id)).size, locations.length)
  assert.equal(new Set(locations.map((location) => location.locationCode)).size, locations.length)

  for (const warehouse of warehouses) {
    assert.equal(warehouse.enabled, true)
    assert.equal(warehouse.businessType, '辅料仓')
    assert.equal(warehouse.country, '印度尼西亚')
    assert.equal(warehouse.timezone, 'Asia/Jakarta')
    const warehouseZones = listAccessoryWarehouseZones(warehouse.code)
    const warehouseLocations = listAccessoryWarehouseLocations(warehouse.code)
    assert.equal(warehouseZones.length, warehouse.zoneCount)
    assert.equal(warehouseLocations.length, warehouse.locationCount)
    assert.equal(warehouseZones.length, 2)
    assert.equal(warehouseLocations.length, 6)

    for (const zone of warehouseZones) {
      assert.equal(zone.warehouseCode, warehouse.code)
      assert.equal(zone.warehouseName, warehouse.name)
      assert.equal(zone.enabled, true)
      assert.equal(zone.zoneType, '存储')
      const zoneLocations = warehouseLocations.filter((location) => location.zoneId === zone.id)
      assert.equal(zoneLocations.length, zone.locationCount)
      assert.equal(zoneLocations.length, 3)
      for (const location of zoneLocations) {
        assert.equal(location.enabled, true)
        assert.equal(location.warehouseCode, warehouse.code)
        assert.equal(location.warehouseName, warehouse.name)
        assert.equal(location.zoneName, zone.zoneName)
      }
    }
  }
  assert.ok(listAccessoryWarehouseLocations('WH-FITTING-001').every((row) => row.locationCode.startsWith('GTP-')))
  assert.ok(listAccessoryWarehouseLocations('HILON-2').every((row) => row.locationCode.startsWith('HILON-')))
  assert.ok(listAccessoryWarehouseLocations('WH-FITTING-MAHAMERU').every((row) => row.locationCode.startsWith('MAHAMERU-')))
})

test('receipt location lookup and validation reject another warehouse, unknown code, or unnamed location', () => {
  const hilon = getAccessoryWarehouse('hilon')
  const mahameru = getAccessoryWarehouse('mahameru')
  const hilonLocations = listEnabledAccessoryWarehouseLocations(hilon.code)
  const mahameruLocations = listEnabledAccessoryWarehouseLocations(mahameru.code)
  assert.equal(hilonLocations.length, 6)
  assert.equal(mahameruLocations.length, 6)
  for (const location of hilonLocations) {
    assert.equal(isEnabledAccessoryWarehouseLocation(hilon.code, location.locationCode), true)
    assert.equal(isEnabledAccessoryWarehouseLocation(mahameru.code, location.locationCode), false)
  }
  for (const location of mahameruLocations) {
    assert.equal(isEnabledAccessoryWarehouseLocation(mahameru.code, location.locationCode), true)
    assert.equal(isEnabledAccessoryWarehouseLocation(hilon.code, location.locationCode), false)
  }
  assert.deepEqual(listEnabledAccessoryWarehouseLocations(''), [])
  assert.deepEqual(listEnabledAccessoryWarehouseLocations('UNKNOWN'), [])
  assert.equal(isEnabledAccessoryWarehouseLocation('UNKNOWN', hilonLocations[0].locationCode), false)
  assert.equal(isEnabledAccessoryWarehouseLocation(hilon.code, ''), false)
  assert.equal(isEnabledAccessoryWarehouseLocation(hilon.code, 'UNKNOWN'), false)
  assert.equal(isEnabledAccessoryWarehouseLocation(hilon.code, hilonLocations[0].id), false)
  hilonLocations[0].enabled = false
  assert.equal(listEnabledAccessoryWarehouseLocations(hilon.code)[0].enabled, true)
})

test('only the two confirmed cutting factory names resolve to their corresponding warehouse', () => {
  for (const name of ['sea cutting', ' SEA CUTTING ', '\tSea\n Cutting\t']) {
    assert.equal(resolveAccessoryWarehouseForCuttingFactoryName(name)?.key, 'hilon')
  }
  for (const name of ['sea cutting2', ' SEA CUTTING2 ', '\tSea   Cutting2\n']) {
    assert.equal(resolveAccessoryWarehouseForCuttingFactoryName(name)?.key, 'mahameru')
  }
  assert.equal(getAccessoryWarehouse('gtp').boundFactoryName, '')
  assert.equal(getAccessoryWarehouse('hilon').boundFactoryName, 'sea cutting')
  assert.equal(getAccessoryWarehouse('mahameru').boundFactoryName, 'sea cutting2')

  for (const name of ['', ' ', '待定', 'Hilon', 'Mahameru', 'sea cutting 2', 'sea cutting20', 'sea cutting3', 'other sea cutting']) {
    assert.equal(resolveAccessoryWarehouseForCuttingFactoryName(name), null, `${name} must not default to a warehouse`)
  }
  for (const code of ['', 'UNKNOWN', 'WH-TRANSIT-MAHAMERU']) {
    assert.deepEqual(listAccessoryWarehouseZones(code), [])
    assert.deepEqual(listAccessoryWarehouseLocations(code), [])
  }
})

test('callers cannot change master data through returned lists, nested subjects, or resolved warehouses', () => {
  const originalWarehouses = listAccessoryWarehouses()
  const originalZones = listAccessoryWarehouseZones()
  const originalLocations = listAccessoryWarehouseLocations()

  const warehouses = listAccessoryWarehouses()
  warehouses[0].name = 'changed'
  warehouses[0].subjects.push('changed')
  warehouses[1].enabled = false
  warehouses.pop()

  const warehouse = getAccessoryWarehouse('mahameru')
  warehouse.code = 'changed'
  warehouse.subjects[0] = 'changed'

  const resolved = resolveAccessoryWarehouseForCuttingFactoryName('sea cutting')!
  resolved.boundFactoryName = 'changed'
  resolved.subjects.length = 0

  const zones = listAccessoryWarehouseZones('HILON-2')
  zones[0].warehouseCode = 'changed'
  zones[0].enabled = false
  zones.pop()

  const locations = listAccessoryWarehouseLocations('WH-FITTING-MAHAMERU')
  locations[0].zoneId = 'changed'
  locations[0].enabled = false
  locations.pop()

  assert.deepEqual(listAccessoryWarehouses(), originalWarehouses)
  assert.deepEqual(listAccessoryWarehouseZones(), originalZones)
  assert.deepEqual(listAccessoryWarehouseLocations(), originalLocations)
  assert.equal(resolveAccessoryWarehouseForCuttingFactoryName('sea cutting')?.key, 'hilon')
})

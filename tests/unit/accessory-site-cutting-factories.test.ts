import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import {
  DEDICATED_CUTTING_FACTORY_ID,
  DEDICATED_CUTTING_FACTORY_NAME,
  SEA_CUTTING_FACTORY_ID,
  SEA_CUTTING_FACTORY_NAME,
  SEA_CUTTING2_FACTORY_ID,
  SEA_CUTTING2_FACTORY_NAME,
  mockFactories,
} from '../../src/data/fcs/factory-mock-data.ts'

const sites = [
  { id: SEA_CUTTING_FACTORY_ID, name: SEA_CUTTING_FACTORY_NAME },
  { id: SEA_CUTTING2_FACTORY_ID, name: SEA_CUTTING2_FACTORY_NAME },
]

test('两地裁床为可分配的独立档案，仅具有裁剪能力', () => {
  assert.deepEqual(sites.map((site) => site.name), ['sea cutting', 'sea cutting2'])
  assert.equal(new Set([...sites.map((site) => site.id), DEDICATED_CUTTING_FACTORY_ID]).size, 3)

  for (const site of sites) {
    const matches = mockFactories.filter((factory) => factory.id === site.id)
    assert.equal(matches.length, 1)
    const [factory] = matches
    assert.equal(factory.name, site.name)
    assert.equal(mockFactories.filter((entry) => entry.name === site.name).length, 1)
    assert.equal(factory.status, 'active')
    assert.equal(factory.factoryType, 'CENTRAL_CUTTING')
    assert.equal(factory.eligibility.allowDispatch, true)
    assert.equal(factory.eligibility.allowExecute, true)
    assert.deepEqual(factory.processAbilities.map((ability) => ability.processCode), ['CUT_PANEL'])
    assert.ok(factory.processAbilities[0].craftCodes.length > 0)
    assert.equal(factory.processAbilities[0].canReceiveTask, true)
    assert.equal(factory.taskAcceptanceConfig?.canAcceptSewingIronPack, false)
    assert.equal(factory.taskAcceptanceConfig?.canAcceptCuttingSewingIronPack, false)
    assert.equal(factory.pdaTenantId, factory.id)
    assert.equal(factory.sourceChannel, '本地原型演示')
  }

  assert.equal(mockFactories.find((factory) => factory.id === DEDICATED_CUTTING_FACTORY_ID)?.name, DEDICATED_CUTTING_FACTORY_NAME)
})

test('工厂档案合并补齐缺失两地样例，同 ID 用户档案保留且读取不写存储', () => {
  const source = `
    import assert from 'node:assert/strict';
    import { mockFactories, SEA_CUTTING_FACTORY_ID, SEA_CUTTING2_FACTORY_ID } from './src/data/fcs/factory-mock-data.ts';
    const original = mockFactories.find(factory => factory.id === SEA_CUTTING_FACTORY_ID);
    const userFactory = { ...original, name: 'sea cutting 用户维护', code: 'USER-CUT-01', contact: '实际维护人', status: 'paused' };
    const key = 'fcs_factory_master_store_v1';
    const raw = JSON.stringify([userFactory]);
    let writes = 0;
    const values = new Map([[key, raw]]);
    globalThis.window = { localStorage: { getItem: name => values.get(name) ?? null, setItem: () => writes++ } };
    const store = await import('./src/data/fcs/factory-master-store.ts');
    const factories = store.listFactoryMasterRecords();
    const actual = factories.find(factory => factory.id === SEA_CUTTING_FACTORY_ID);
    assert.equal(actual.name, userFactory.name);
    assert.equal(actual.code, userFactory.code);
    assert.equal(actual.contact, userFactory.contact);
    assert.equal(actual.status, userFactory.status);
    assert.equal(factories.filter(factory => factory.id === SEA_CUTTING_FACTORY_ID).length, 1);
    assert.equal(factories.filter(factory => factory.id === SEA_CUTTING2_FACTORY_ID).length, 1);
    assert.equal(factories.find(factory => factory.id === SEA_CUTTING2_FACTORY_ID).name, 'sea cutting2');
    store.listFactoryMasterRecords();
    assert.equal(writes, 0);
    assert.equal(values.get(key), raw);
  `
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', source], {
    cwd: process.cwd(), encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})

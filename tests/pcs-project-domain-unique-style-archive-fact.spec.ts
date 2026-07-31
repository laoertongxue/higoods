import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  getProjectStepDefinition,
  PCS_PROJECT_RELATED_INSTANCE_TYPES,
} from '../src/data/pcs-project-domain-contract.ts'

const contractSource = readFileSync(
  new URL('../src/data/pcs-project-domain-contract.ts', import.meta.url),
  'utf8',
)

assert.doesNotMatch(
  contractSource,
  /测款通过后(?:生成|关联|回写).*款式档案|测款通过后生成的正式款式档案壳|完善商品档案/,
  '商品项目创建时已经建立唯一商品测款档案，领域契约不得保留测款通过后才生成或完善档案的旧事实',
)

const projectInit = getProjectStepDefinition('PROJECT_INIT')
assert.ok(projectInit, '应存在商品项目立项固定步骤')
assert.ok(
  projectInit!.operationDefinitions
    .flatMap((operation) => [...operation.effects, ...operation.writebackRules])
    .some((text) => text.includes('商品测款档案')),
  '创建项目动作必须明确同步建立唯一商品测款档案',
)

const styleArchiveType = PCS_PROJECT_RELATED_INSTANCE_TYPES.find((item) => item.typeCode === 'STYLE_ARCHIVE')
assert.equal(
  styleArchiveType?.businessMeaning,
  '创建商品项目时同步建立的唯一商品测款档案。',
  '款式档案相关实例必须统一为项目创建时建立的唯一事实源',
)

console.log('pcs-project-domain-unique-style-archive-fact.spec.ts PASS')

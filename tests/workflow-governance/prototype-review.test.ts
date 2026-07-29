import assert from 'node:assert/strict'
import test from 'node:test'
import {
  validatePrototypeReviewCoverage,
  type ReviewRecordSource,
} from '../../scripts/workflow-governance/prototype-review.ts'

function reviewRecord(
  path: string,
  files: string[],
  options: { verification?: boolean; exceptions?: boolean } = {},
): ReviewRecordSource {
  const verification = options.verification === false
    ? ''
    : '### 验证命令\n\n- `npm run check:example`：通过\n'
  const exceptions = options.exceptions === false ? '' : '### 例外\n\n- 无\n'

  return {
    path,
    source: `# 原型审查记录

## 2. 参考规范

- \`docs/higood-indonesia-factory-product-design-guidelines.md\`
- \`docs/higood-indonesia-factory-prototype-review-checklist.md\`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 已核对 |

## 6. 最终结论

结论：通过

## 7. 变更覆盖与验证

### 受管文件

${files.map((file) => `- \`${file}\``).join('\n')}

### 页面路由

- \`/example\`

${verification}
${exceptions}`,
  }
}

test('受管页面没有审查记录时失败', () => {
  assert.throws(
    () => validatePrototypeReviewCoverage(['src/pages/example.ts'], []),
    /没有关联的原型审查记录/,
  )
})

test('只有无关审查记录时失败', () => {
  assert.throws(
    () => validatePrototypeReviewCoverage(
      ['src/pages/example.ts'],
      [reviewRecord('docs/prototype-review-records/other.md', ['src/pages/other.ts'])],
    ),
    /src\/pages\/example\.ts/,
  )
})

test('关联记录缺少必填验证项时失败', () => {
  assert.throws(
    () => validatePrototypeReviewCoverage(
      ['src/pages/example.ts'],
      [reviewRecord(
        'docs/prototype-review-records/example.md',
        ['src/pages/example.ts'],
        { verification: false },
      )],
    ),
    /验证命令/,
  )
})

test('验证命令没有明确结果时失败', () => {
  const record = reviewRecord(
    'docs/prototype-review-records/example.md',
    ['src/pages/example.ts'],
  )
  record.source = record.source.replace('`npm run check:example`：通过', '`npm run check:example`')

  assert.throws(
    () => validatePrototypeReviewCoverage(['src/pages/example.ts'], [record]),
    /验证结果/,
  )
})

test('完整记录明确覆盖受管文件时通过', () => {
  const result = validatePrototypeReviewCoverage(
    ['src/pages/example.ts'],
    [reviewRecord('docs/prototype-review-records/example.md', ['src/pages/example.ts'])],
  )

  assert.deepEqual(result.coveredPaths, ['src/pages/example.ts'])
  assert.deepEqual(result.recordPaths, ['docs/prototype-review-records/example.md'])
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  validatePrototypeReviewCoverage,
  type ReviewRecordSource,
} from '../../scripts/workflow-governance/prototype-review.ts'

function visibleReviewRecord(
  path: string,
  files: string[],
  options: { verification?: boolean; exceptions?: boolean; impact?: boolean } = {},
): ReviewRecordSource {
  const impact = options.impact === false
    ? ''
    : '## 2. 影响判定\n\n- 用户可见影响：有\n- 判定依据：页面字段和操作结果发生变化\n\n'
  const verification = options.verification === false
    ? ''
    : '### 验证命令\n\n- `npm run check:example`：通过\n'
  const exceptions = options.exceptions === false ? '' : '### 例外\n\n- 无\n'

  return {
    path,
    source: `# 原型审查记录

${impact}## 参考规范

- \`AGENTS.md\` 第 4、5、7 节

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

${verification}${exceptions}`,
  }
}

function technicalOnlyDeclaration(path: string, files: string[], reason = '仅重命名内部类型，渲染结果和交互契约不变'): ReviewRecordSource {
  return {
    path,
    source: `# 原型变更影响声明

## 2. 影响判定

- 用户可见影响：无
- 判定依据：${reason}

## 7. 变更覆盖与验证

### 受管文件

${files.map((file) => `- \`${file}\``).join('\n')}

### 验证命令

- \`npm run check:example\`：通过
`,
  }
}

function replaceTechnicalVerification(record: ReviewRecordSource, command: string): ReviewRecordSource {
  return {
    ...record,
    source: record.source.replace('npm run check:example', command),
  }
}

test('受管文件没有影响声明或审查记录时失败', () => {
  assert.throws(
    () => validatePrototypeReviewCoverage(['src/pages/example.ts'], []),
    /没有关联的影响声明或原型审查记录/,
  )
})

test('只有无关记录时失败', () => {
  assert.throws(
    () => validatePrototypeReviewCoverage(
      ['src/pages/example.ts'],
      [visibleReviewRecord('docs/prototype-review-records/other.md', ['src/pages/other.ts'])],
    ),
    /src\/pages\/example\.ts/,
  )
})

test('有用户可见影响但缺少完整验证时失败', () => {
  assert.throws(
    () => validatePrototypeReviewCoverage(
      ['src/pages/example.ts'],
      [visibleReviewRecord(
        'docs/prototype-review-records/example.md',
        ['src/pages/example.ts'],
        { verification: false },
      )],
    ),
    /验证命令/,
  )
})

test('验证命令没有明确结果时失败', () => {
  const record = visibleReviewRecord(
    'docs/prototype-review-records/example.md',
    ['src/pages/example.ts'],
  )
  record.source = record.source.replace('`npm run check:example`：通过', '`npm run check:example`')

  assert.throws(
    () => validatePrototypeReviewCoverage(['src/pages/example.ts'], [record]),
    /验证结果/,
  )
})

test('完整用户可见审查记录通过', () => {
  const result = validatePrototypeReviewCoverage(
    ['src/pages/example.ts'],
    [visibleReviewRecord('docs/prototype-review-records/example.md', ['src/pages/example.ts'])],
  )

  assert.deepEqual(result.userVisiblePaths, ['src/pages/example.ts'])
  assert.deepEqual(result.technicalOnlyPaths, [])
  assert.deepEqual(result.recordPaths, ['docs/prototype-review-records/example.md'])
})

test('无用户可见影响只需简版声明和技术验证', () => {
  const result = validatePrototypeReviewCoverage(
    ['src/data/example-domain.ts'],
    [technicalOnlyDeclaration(
      'docs/prototype-review-records/example-technical-only.md',
      ['src/data/example-domain.ts'],
    )],
  )

  assert.deepEqual(result.userVisiblePaths, [])
  assert.deepEqual(result.technicalOnlyPaths, ['src/data/example-domain.ts'])
})

test('无用户可见影响声明缺少有效依据时失败', () => {
  assert.throws(
    () => validatePrototypeReviewCoverage(
      ['src/components/example.ts'],
      [technicalOnlyDeclaration(
        'docs/prototype-review-records/example-technical-only.md',
        ['src/components/example.ts'],
        '无',
      )],
    ),
    /判定依据/,
  )
})

test('无用户可见影响不能只用治理脚本自证', () => {
  const record = replaceTechnicalVerification(
    technicalOnlyDeclaration(
      'docs/prototype-review-records/example-technical-only.md',
      ['src/data/example-domain.ts'],
    ),
    'npm run check:prototype-design-governance',
  )

  assert.throws(
    () => validatePrototypeReviewCoverage(['src/data/example-domain.ts'], [record]),
    /直接技术验证/,
  )
})

test('旧格式完整审查记录保持兼容', () => {
  const record = visibleReviewRecord(
    'docs/prototype-review-records/legacy.md',
    ['src/pages/legacy.ts'],
    { impact: false },
  )
  record.source = record.source.replace(
    '- `AGENTS.md` 第 4、5、7 节',
    '- `docs/higood-indonesia-factory-product-design-guidelines.md`\n- `docs/higood-indonesia-factory-prototype-review-checklist.md`',
  )

  const result = validatePrototypeReviewCoverage(['src/pages/legacy.ts'], [record])
  assert.deepEqual(result.userVisiblePaths, ['src/pages/legacy.ts'])
})

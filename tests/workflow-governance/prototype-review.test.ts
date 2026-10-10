import assert from 'node:assert/strict'
import test from 'node:test'
import {
  validatePrototypeReviewCoverage,
  parseHistoricalPrototypeReviewRecord,
  type ReviewRecordSource,
} from '../../scripts/workflow-governance/prototype-review.ts'

function visibleReviewRecord(
  path: string,
  files: string[],
  options: { verification?: boolean; exceptions?: boolean; impact?: boolean } = {},
): ReviewRecordSource {
  const impact = options.impact === false
    ? ''
    : '## 2. 影响判定\n\n- 记录模式：完整产品审查\n- 用户可见影响：有\n- 判定依据：页面字段和操作结果发生变化\n\n'
  const verification = options.verification === false
    ? ''
    : '### 验证命令\n\n- `npm run check:example`：通过\n'
  const exceptions = options.exceptions === false ? '' : '### 例外\n\n- 无\n'

  return {
    path,
    source: `# 原型审查记录

## 基本信息
- 日期：2026-10-10
- 任务 / 需求编号：GOV-RECORD-001
- 验证人：Codex 契约测试执行者

${impact}## 参考规范

- \`AGENTS.md\` REVIEW-01

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 仓管角色对照 /example 收货动作完成 |

## 6. 最终结论

结论：通过

## 7. 变更覆盖与验证

### 受管文件

${files.map((file) => `- \`${file}\``).join('\n')}

### 页面路由

- \`/example\`

### 页面证据

- 版本：99e25a0，1366×768，当前工作树资产 example123
- 证据：/example，evidence/page.png，操作结果已回读

### 性能结论

- 结论：通过
- 依据：evidence/performance.json 含起止定义和五个样本

${verification}${exceptions}`,
  }
}

function technicalOnlyDeclaration(path: string, files: string[], reason = '仅重命名内部类型，渲染结果和交互契约不变'): ReviewRecordSource {
  return {
    path,
    source: `# 原型变更影响声明

## 基本信息
- 日期：2026-10-10
- 任务 / 需求编号：GOV-RECORD-001
- 验证人：Codex 契约测试执行者

## 2. 影响判定

- 记录模式：无用户可见影响声明
- 用户可见影响：无
- 判定依据：${reason}

## 7. 变更覆盖与验证

### 受管文件

${files.map((file) => `- \`${file}\``).join('\n')}

### 技术证据

- 对象与结果：类型更名后，对照输入的字段值与渲染 HTML 一致
- 证据：tests/example.test.ts，同输入快照和持久数据比较通过

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

test('旧格式只能历史读取，不能作为当前交付', () => {
  const record = visibleReviewRecord(
    'docs/prototype-review-records/legacy.md',
    ['src/pages/legacy.ts'],
    { impact: false },
  )
  record.source = record.source.replace(
    '- `AGENTS.md` REVIEW-01',
    '- `docs/higood-indonesia-factory-product-design-guidelines.md`\n- `docs/higood-indonesia-factory-prototype-review-checklist.md`',
  )

  const result = parseHistoricalPrototypeReviewRecord(record)
  assert.equal(result.historicalOnly, true)
  assert.deepEqual(result.managedFiles, ['src/pages/legacy.ts'])
  assert.throws(() => validatePrototypeReviewCoverage(['src/pages/legacy.ts'], [record]), /记录模式/)
})

function lightReviewRecord(): ReviewRecordSource {
  return {
    path: 'docs/prototype-review-records/light.md',
    source: `# 轻量记录

## 基本信息
- 日期：2026-10-10
- 任务 / 需求编号：GOV-RECORD-001
- 验证人：Codex 契约测试执行者

## 2. 影响判定

- 记录模式：轻量可见变更
- 用户可见影响：有
- 判定依据：仅缩短按钮文字
- 契约变化：无

## 3. 轻量变更

- 对象 / 路由：目标保存按钮，/example
- 改了什么：保存改为保存目标
- 保留什么：数量、状态、事件和存储不变
- 如何验证：同工作树真实页面操作并回读目标
- 结果：通过

## 7. 变更覆盖与验证

### 受管文件

- \`src/pages/example.ts\`

### 页面证据

- 版本：HEAD + 文件哈希，1366×768，本机实际服务
- 证据：浏览器记录 /tmp/example.png，目标保存后回读一致

### 性能结论

- 结论：不适用
- 依据：仅文案，初始化、布局成本和事件链不变

### 验证命令

- \`git diff --check\`：通过
`,
  }
}

test('轻量可见变更有五项和页面证据，不强制完整产品矩阵', () => {
  const result = validatePrototypeReviewCoverage(['src/pages/example.ts'], [lightReviewRecord()])
  assert.deepEqual(result.userVisiblePaths, ['src/pages/example.ts'])
  assert.deepEqual(result.lightweightPaths, ['src/pages/example.ts'])
})

for (const [name, from, to, error] of [
  ['轻量不能缺真实页面证据', '### 页面证据', '### 未提供页面证据', /页面证据/],
  ['轻量不能缺保留范围', '- 保留什么：数量、状态、事件和存储不变', '', /保留什么/],
  ['轻量不能承载契约变化', '- 契约变化：无', '- 契约变化：有', /契约变化/],
  ['性能失败不能因轻量通过关闭', '- 结论：不适用', '- 结论：不通过', /性能/],
  ['性能不适用必须有依据', '- 依据：仅文案，初始化、布局成本和事件链不变', '', /性能/],
  ['轻量不能改称无可见影响', '- 用户可见影响：有', '- 用户可见影响：无', /记录模式/],
  ['未知记录模式不能降级绕过', '- 记录模式：轻量可见变更', '- 记录模式：随意跳过', /记录模式/],
] as const) {
  test(name, () => {
    const record = lightReviewRecord()
    record.source = record.source.replace(from, to)
    assert.throws(() => validatePrototypeReviewCoverage(['src/pages/example.ts'], [record]), error)
  })
}

for (const result of ['不通过', '有条件通过']) {
  test(`完整记录最终${result}不能被覆盖检查当作通过`, () => {
    const record = visibleReviewRecord('docs/prototype-review-records/failed.md', ['src/pages/example.ts'])
    record.source = record.source.replace('结论：通过', `结论：${result}`)
    assert.throws(() => validatePrototypeReviewCoverage(['src/pages/example.ts'], [record]), /最终结论/)
  })
}

test('仅列已失败的验证命令不能通过', () => {
  const record = technicalOnlyDeclaration('docs/prototype-review-records/failed.md', ['src/data/example.ts'])
  record.source = record.source.replace('`：通过', '`：失败')
  assert.throws(() => validatePrototypeReviewCoverage(['src/data/example.ts'], [record]), /验证.*未通过/)
})

test('同一文件多个冲突记录不能用首个通过记录掩盖失败', () => {
  const good = visibleReviewRecord('docs/prototype-review-records/good.md', ['src/pages/example.ts'])
  const bad = { ...good, path: 'docs/prototype-review-records/bad.md', source: good.source.replace('结论：通过', '结论：不通过') }
  assert.throws(() => validatePrototypeReviewCoverage(['src/pages/example.ts'], [good, bad]), /最终结论/)
})

test('新完整模式必须携带页面证据和性能结论', () => {
  const record = visibleReviewRecord('docs/prototype-review-records/full.md', ['src/pages/example.ts'])
  record.source = record.source.replace(/### 页面证据[\s\S]*?(?=### 验证命令)/, '')
  assert.throws(() => validatePrototypeReviewCoverage(['src/pages/example.ts'], [record]), /性能/)
  record.source += '\n### 性能结论\n\n- 结论：通过\n- 依据：五个原始样本及脚本见 evidence/performance.json\n'
  assert.throws(() => validatePrototypeReviewCoverage(['src/pages/example.ts'], [record]), /页面证据/)
  record.source += '\n### 页面证据\n\n- 版本：当前分支及差异哈希，1366×768\n- 证据：/example，evidence/page.png，实际操作成功\n'
  assert.doesNotThrow(() => validatePrototypeReviewCoverage(['src/pages/example.ts'], [record]))
})

test('重复性能结论不能隐藏失败', () => {
  const record = lightReviewRecord()
  record.source = record.source.replace('- 结论：不适用', '- 结论：不适用\n- 结论：不通过')
  assert.throws(() => validatePrototypeReviewCoverage(['src/pages/example.ts'], [record]), /重复/)
})

test('重复最终结论不能隐藏失败', () => {
  const record = visibleReviewRecord('docs/prototype-review-records/conflict.md', ['src/pages/example.ts'])
  record.source = record.source.replace('结论：通过', '结论：通过\n结论：不通过')
  assert.throws(() => validatePrototypeReviewCoverage(['src/pages/example.ts'], [record]), /最终结论|重复/)
})

test('无可见影响不能用不适用命令冒充已执行技术验证', () => {
  const record = technicalOnlyDeclaration('docs/prototype-review-records/no-test.md', ['src/data/example.ts'])
  record.source = record.source.replace('`：通过', '`：不适用（未触及该范围）')
  assert.throws(() => validatePrototypeReviewCoverage(['src/data/example.ts'], [record]), /直接技术验证/)
})

test('同一路径的可见影响声明不得互相冲突', () => {
  const technical = technicalOnlyDeclaration('docs/prototype-review-records/technical.md', ['src/pages/example.ts'])
  assert.throws(() => validatePrototypeReviewCoverage(['src/pages/example.ts'], [lightReviewRecord(), technical]), /可见影响冲突/)
})

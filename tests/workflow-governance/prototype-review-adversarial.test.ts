import assert from 'node:assert/strict'
import test from 'node:test'
import { validatePrototypeReviewCoverage, type ReviewRecordSource } from '../../scripts/workflow-governance/prototype-review.ts'

function fullRecord(): ReviewRecordSource {
  return {
    path: 'docs/prototype-review-records/adversarial.md',
    source: `# 原型审查

## 基本信息
- 日期：2026-10-10
- 任务 / 需求编号：GOV-RECORD-001
- 验证人：Codex 契约测试执行者

## 2. 影响判定
- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：改变目标保存后展示数量

## 参考规范
- \`AGENTS.md\` REVIEW-01

## 3. 自查结论
| 检查项 | 结论 | 证据 |
| --- | --- | --- |
| 保存数量 | 通过 | tests/example.test.ts 保存后回读一致 |

## 6. 最终结论
结论：通过

## 7. 变更覆盖与验证
### 受管文件
- \`src/pages/example.ts\`
### 页面证据
- 版本：99e25a0，工作树 /tmp/higoods，1366×768，资产 abc123
- 证据：/example 保存动作，evidence/example.png
### 性能结论
- 结论：通过
- 依据：evidence/performance.json 含起止定义和五个样本
### 验证命令
- \`npm run check:example\`：通过
### 例外
- 无
`,
  }
}

function verify(record: ReviewRecordSource): void {
  validatePrototypeReviewCoverage(['src/pages/example.ts'], [record])
}

const failures: Array<[string, string, string, RegExp]> = [
  ['不能删除模式降级为历史交付', '- 记录模式：完整产品审查\n', '', /记录模式/],
  ['空版本不能吞下一行', '- 版本：99e25a0，工作树 /tmp/higoods，1366×768，资产 abc123', '- 版本：', /版本/],
  ['不能保留待填写自查行', '| 保存数量 | 通过 | tests/example.test.ts 保存后回读一致 |', '| 保存数量 | 通过 | tests/example.test.ts 保存后回读一致 |\n| 页面刷新 | 待填写 | 待填写 |', /自查/],
  ['通过自查也必须有实质证据', '| 保存数量 | 通过 | tests/example.test.ts 保存后回读一致 |', '| 保存数量 | 通过 | 待填写 |', /自查/],
  ['自查不适用必须有具体理由', '| 保存数量 | 通过 | tests/example.test.ts 保存后回读一致 |', '| 打印 | 不适用 | 不适用 |', /自查/],
  ['拒绝模板版本原文', '- 版本：99e25a0，工作树 /tmp/higoods，1366×768，资产 abc123', '- 版本：分支 / HEAD + 未提交差异哈希、服务 / 工作树、设备 / 视口、实际运行资产', /版本/],
  ['拒绝模板证据原文', '- 证据：/example 保存动作，evidence/example.png', '- 证据：命名路由、实际动作、结果、截图或日志位置；复用证据保留原版本并说明理由', /证据/],
  ['重复页面节不能藏空值', '### 性能结论', '### 页面证据\n- 版本：\n- 证据：\n### 性能结论', /重复/],
  ['重复影响节不能掩盖冲突', '## 参考规范', '## 2. 影响判定\n- 记录模式：无用户可见影响声明\n- 用户可见影响：无\n- 判定依据：内部改名\n## 参考规范', /重复/],
  ['重复可见影响字段不能掩盖冲突', '- 用户可见影响：有', '- 用户可见影响：有\n- 用户可见影响：无', /重复/],
  ['重复命令不能掩盖失败', '- `npm run check:example`：通过', '- `npm run check:example`：通过\n- `npm run check:example`：失败', /重复|未通过/],
  ['命令不能以通过前缀掩盖失败', '- `npm run check:example`：通过', '- `npm run check:example`：通过；实际未运行', /未通过|待填写|未运行/],
  ['不能把无理由不适用作为性能依据', '- 结论：通过\n- 依据：evidence/performance.json 含起止定义和五个样本', '- 结论：不适用\n- 依据：不适用', /性能依据/],
  ['不能只提供旧规则作为本次基线', '- `AGENTS.md` REVIEW-01', '- `docs/higood-indonesia-factory-product-design-guidelines.md`\n- `docs/higood-indonesia-factory-prototype-review-checklist.md`', /治理基线/],
]
for (const [name, from, to, expected] of failures) {
  test(name, () => {
    const record = fullRecord()
    assert(record.source.includes(from))
    record.source = record.source.replace(from, to)
    assert.throws(() => verify(record), expected)
  })
}

test('编号与无编号标题得到相同当前交付结果', () => {
  const record = fullRecord()
  verify(record)
  record.source = record.source.replace(/^(##) \d+\. /gm, '$1 ')
  verify(record)
})

test('按原子需求引用既有矩阵作为自查证据', () => {
  const record = fullRecord()
  record.source = record.source.replace('| 保存数量 | 通过 | tests/example.test.ts 保存后回读一致 |', '| QTY-001 | 通过 | docs/requirement-matrix.md#qty-001，数量保存与回读证据 |\n| PRINT-001 | 不适用 | 本次页面无打印动作或打印结果变化 |')
  verify(record)
})

test('未关联本次受管文件的历史记录不被强制升级', () => {
  assert.doesNotThrow(() => validatePrototypeReviewCoverage(['src/pages/example.ts'], [
    fullRecord(),
    { path: 'docs/prototype-review-records/unrelated-history.md', source: '# 旧历史记录\n### 受管文件\n- `src/pages/other.ts`' },
  ]))
})

for (const [name, from, to, expected] of [
  ['空影响值不能吞下一行', '- 用户可见影响：有', '- 用户可见影响：', /用户可见影响/],
  ['重复同值版本也必须明确唯一', '- 版本：99e25a0，工作树 /tmp/higoods，1366×768，资产 abc123', '- 版本：99e25a0，工作树 /tmp/higoods，1366×768，资产 abc123\n- 版本：99e25a0，工作树 /tmp/higoods，1366×768，资产 abc123', /重复/],
  ['例外声明不能有无并存', '### 例外\n- 无', '### 例外\n- 无\n- PRINT-001 本次未改变打印结果', /例外/],
  ['例外不能保留模板待填说明', '### 例外\n- 无', '### 例外\n- 待填写具体例外', /例外/],
  ['自查不能遗留未验证结果', '| 保存数量 | 通过 |', '| 保存数量 | 未验证 |', /自查/],
  ['缺少表格行末分隔符不能静默截断证据', '| 保存数量 | 通过 | tests/example.test.ts 保存后回读一致 |', '| 保存数量 | 通过 | tests/example.test.ts 保存后回读一致', /自查表/],
  ['最终结论不适用不能关闭交付', '结论：通过\n\n## 7.', '结论：不适用\n\n## 7.', /最终结论/],
  ['隐藏注释不能替代页面证据', '### 页面证据\n- 版本：99e25a0，工作树 /tmp/higoods，1366×768，资产 abc123\n- 证据：/example 保存动作，evidence/example.png', '<!--\n### 页面证据\n- 版本：99e25a0，工作树 /tmp/higoods，1366×768，资产 abc123\n- 证据：/example 保存动作，evidence/example.png\n-->', /页面证据/],
  ['代码示例不能替代页面证据', '### 页面证据\n- 版本：99e25a0，工作树 /tmp/higoods，1366×768，资产 abc123\n- 证据：/example 保存动作，evidence/example.png', '```md\n### 页面证据\n- 版本：99e25a0，工作树 /tmp/higoods，1366×768，资产 abc123\n- 证据：/example 保存动作，evidence/example.png\n```', /页面证据/],
] as const) {
  test(name, () => {
    const record = fullRecord()
    assert(record.source.includes(from))
    record.source = record.source.replace(from, to)
    assert.throws(() => verify(record), expected)
  })
}

test('同一路径的重复记录不能产生多份事实', () => {
  const record = fullRecord()
  assert.throws(() => validatePrototypeReviewCoverage(['src/pages/example.ts'], [record, { ...record }]), /审查记录重复/)
})

function technicalRecord(command: string): ReviewRecordSource {
  return {
    path: 'docs/prototype-review-records/technical.md',
    source: `# 技术声明

## 基本信息
- 日期：2026-10-10
- 任务 / 需求编号：GOV-RECORD-001
- 验证人：Codex 契约测试执行者
## 影响判定
- 记录模式：无用户可见影响声明
- 用户可见影响：无
- 判定依据：只整理内部类型，输出字段和交互入口不变
## 变更覆盖与验证
### 受管文件
- \`src/pages/example.ts\`
### 技术证据
- 对象与结果：同一输入下 HTML、查询输出与写入数量均一致
- 证据：tests/example-contract.test.ts 三组原始结果对照
### 验证命令
- \`${command}\`：通过
`,
  }
}

for (const command of ['git diff --check', 'npm run check:prototype-design-governance', 'npm run check:list-page-governance', 'npm run workflow:verify', 'npm run lint', 'pnpm run format:check', 'npx prettier --check src/pages/example.ts']) {
  test(`技术声明不能只靠 ${command}`, () => {
    assert.throws(() => verify(technicalRecord(command)), /直接技术验证/)
  })
}

test('技术声明有专项通过仍不能省略契约结果证据', () => {
  const record = technicalRecord('node --test tests/example-contract.test.ts')
  record.source = record.source.replace('### 技术证据', '### 其他说明')
  assert.throws(() => verify(record), /直接技术验证对象与结果/)
})

test('技术声明专项契约与结果证据通过', () => {
  verify(technicalRecord('node --test tests/example-contract.test.ts'))
})

test('未闭合 HTML 注释内的整份记录不能作为当前证据', () => {
  const record = technicalRecord('node --test tests/example-contract.test.ts')
  record.source = `<!--\n${record.source}`
  assert.throws(() => verify(record), /关联|基本信息|日期/)
})

test('未闭合 HTML 注释中的尾部页面证据不能使可见变更通过', () => {
  const record = fullRecord()
  record.source = record.source.replace('### 页面证据', '<!--\n### 页面证据')
  assert.throws(() => verify(record), /验证命令|页面证据/)
})

test('闭合 HTML 注释后的有效正文仍可作为当前证据', () => {
  const record = technicalRecord('node --test tests/example-contract.test.ts')
  record.source = `<!-- 旧版说明不作为证据 -->\n${record.source}\n<!-- 未填写的后记`
  verify(record)
})

test('技术模式不能用可选最终结论藏失败', () => {
  const record = technicalRecord('node --test tests/example-contract.test.ts')
  record.source += '\n## 最终结论\n结论：有条件通过\n'
  assert.throws(() => verify(record), /最终结论/)
})

for (const result of ['不适用（无）', '不适用（   ）', '不适用：待填写具体原因']) {
  test(`验证命令不能使用空泛结果：${result}`, () => {
    const record = fullRecord()
    record.source = record.source.replace('`npm run check:example`：通过', `\`npm run check:example\`：${result}`)
    assert.throws(() => verify(record), /不适用理由/)
  })
}


for (const [name, from, to, error] of [
  ['不能省略基本信息', '## 基本信息\n- 日期：2026-10-10\n- 任务 / 需求编号：GOV-RECORD-001\n- 验证人：Codex 契约测试执行者\n', '', /基本信息|日期/],
  ['空日期不能取下一个字段', '- 日期：2026-10-10', '- 日期：', /日期/],
  ['日期必须为有效日历日期', '- 日期：2026-10-10', '- 日期：2026-02-29', /日期/],
  ['日期不能是缩写格式', '- 日期：2026-10-10', '- 日期：2026-1-1', /日期/],
  ['日期必须唯一', '- 日期：2026-10-10', '- 日期：2026-10-10\n- 日期：2026-10-11', /重复/],
  ['任务编号不能留模板值', '- 任务 / 需求编号：GOV-RECORD-001', '- 任务 / 需求编号：待填写', /需求编号/],
  ['验证人不能未定', '- 验证人：Codex 契约测试执行者', '- 验证人：待填写实际执行者', /验证人/],
  ['验证人不能缺失', '- 验证人：Codex 契约测试执行者', '', /验证人/],
  ['验证人重复不能遮盖责任冲突', '- 验证人：Codex 契约测试执行者', '- 验证人：Codex 契约测试执行者\n- 验证人：另一执行者', /重复/],
  ['路径碰巧含 AGENTS.md 不能作为规范引用', '- \`AGENTS.md\` REVIEW-01', '- \`src/data/myAGENTS.md\` REVIEW-01', /治理基线/],
  ['相同文件名的外部链接不是项目规范', '- \`AGENTS.md\` REVIEW-01', '- [AGENTS.md](https://example.com/AGENTS.md)', /治理基线/],
  ['同名子文件不能替代根规范', '- \`AGENTS.md\` REVIEW-01', '- [AGENTS.md](../other/AGENTS.md)', /治理基线/],
  ['证据字段中提及规范不替代独立引用', '- \`AGENTS.md\` REVIEW-01', '- 规则按独立文件检查', /治理基线/],
] as const) {
  test(name, () => {
    const record = fullRecord()
    assert(record.source.includes(from), name)
    record.source = record.source.replace(from, to)
    if (name === '证据字段中提及规范不替代独立引用') record.source += '\n### 其他证据\n- 证据：\`AGENTS.md\` 已核读\n'
    assert.throws(() => verify(record), error)
  })
}

test('有效闰日元数据和真正根规范相对链接通过', () => {
  const record = fullRecord()
  record.source = record.source.replace('2026-10-10', '2024-02-29').replace('- \`AGENTS.md\` REVIEW-01', '- [项目规则](../../AGENTS.md#review-01)')
  verify(record)
})

test('模板头的精确规范引用可使用且不要求额外章节', () => {
  const record = fullRecord()
  record.source = record.source.replace('## 参考规范\n- \`AGENTS.md\` REVIEW-01\n', '').replace('# 原型审查\n', '# 原型审查\n\n依据 \`AGENTS.md\` REVIEW-01。\n')
  verify(record)
})

test('技术模式同样必须有实际执行者', () => {
  const record = technicalRecord('node --test tests/example-contract.test.ts')
  record.source = record.source.replace('- 验证人：Codex 契约测试执行者', '- 验证人：')
  assert.throws(() => verify(record), /验证人/)
})

for (const result of ['通过（本次未运行）', '通过，但实际执行失败', '通过（12/12）', '通过\t未运行', '通过 (实际未执行)']) {
  test(`命令结果必须是确定枚举，不能在通过后追加声明：${result}`, () => {
    const record = fullRecord()
    record.source = record.source.replace('`npm run check:example`：通过', `\`npm run check:example\`：${result}`)
    assert.throws(() => verify(record), /验证未通过|结果/)
  })
}

for (const indent of ['    ', '\t', '  \t']) {
  test(`缩进代码中的字段和表格不能作为有效记录：${JSON.stringify(indent)}`, () => {
    const record = fullRecord()
    record.source = record.source.split('\n').map((line) => /^(?:-|\||结论：)/.test(line) ? `${indent}${line}` : line).join('\n')
    assert.throws(() => verify(record), /关联|基本信息|自查|结论/)
  })
}

test('单独缩进的自查表也不是可执行的检查结论', () => {
  const record = fullRecord()
  record.source = record.source.split('\n').map((line) => line.startsWith('|') ? `    ${line}` : line).join('\n')
  assert.throws(() => verify(record), /自查/)
})

test('合法的两空格列表缩进不被当作代码块', () => {
  const record = fullRecord()
  record.source = record.source.split('\n').map((line) => line.startsWith('-') ? `  ${line}` : line).join('\n')
  verify(record)
})

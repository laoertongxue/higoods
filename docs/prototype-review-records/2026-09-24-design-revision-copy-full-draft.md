# 设计改款复制完整方案与产品说明修订

## 1. 基本信息

- 日期：2026-09-24。
- 记录模式：完整产品审查。
- 系统／角色／端：PCS，买手，管理端。
- 路由：`/pcs/production-preparation/design-revision`、`/pcs/production-preparation/design-revision/:id`。
- 工作树：`/tmp/higoods-design-copy-release`，`codex/design-copy-release`，基线 `92a089ed0482f678e67f133e61cdb6a9ca3b3396` 加本次修改；构建预览 `http://127.0.0.1:4174`。
- 验收浏览器：Playwright Chromium 隔离上下文；1366×768、1280×768；24 条原始任务，复制后 25 条，三行物料、两行费用。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：复制新增继承物料、费用和样衣制作安排；新任务仍为可编辑草稿，修改后手动提交；原任务和新任务互不影响。列表去除未使用筛选资料的重复读取，只读查询仅复制所需记录、存储编码复用重复对象并减少中间解析和数组分配，字段和存储格式保持不变。
- 治理依据：AGENTS.md 第 4、5、7 节。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 买手复制、编辑、保存、手动提交；未增加步骤 |
| 文案、状态、数量与单位 | 通过 | 三行物料、两行费用与要求复制；单件／整单口径保留；复制和保存后为草稿 |
| 图片与对象识别 | 通过 | 沿用源款和物料档案图片；浏览器验证可见图片解码成功，截图保留 |
| 防错与独立性 | 通过 | 新明细标识、无锁定和执行快照；原数据不变；失败源任务单独反馈；存储拒写回滚契约通过 |
| 交接与下达 | 通过 | 复制不下达；修改后提交生成新单据标识；不同物料染／印互斥契约通过 |
| 分辨率与保存恢复 | 通过 | 两种桌面尺寸，保存后刷新读取三类改动 |
| 相关筛选 | 通过 | 默认列表、日期、品牌及重置结果正确 |
| 性能 | 通过 | 每项五次，首次、冷进入、刷新、导航和受影响操作均小于 500ms；原始失败记录保留 |

本次未改变 PDA、打印、大图交互和工厂执行流程；这些入口不在本次运行时变更范围。未增加或替换任何图片。

## 4. 问题标签

- 协作断裂：复制丢失已填写方案。

## 5. 主要问题与处理

| 问题 | 处理 |
| --- | --- |
| 复制没有物料、费用和样衣安排 | 从源任务当前方案独立复制；使用新明细标识；已下达读取工作要求 |
| 复制阶段误认为下达 | 保持草稿，无专业工作、加工单、确认时间；修改后手动提交 |
| 冷进入超过 500ms | CPU 分析确认初始化编码分配与列表无用读取；保留存储格式优化，并移除无用筛选读取 |
| 产品文档混入交付治理和历史兼容 | 更新复制规则，删除 17.2 及后续章节，移除历史兼容和旧口径说明，保留六张业务图 |

## 6. 最终结论

结论：通过

本次修复和文档已在本地验证；未执行提交、推送和 Vercel 发布。本工作区的其他任务修改未纳入本次变更。性能证据绑定的文件散列在 `output/playwright/design-copy/source-hashes.json`。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-engineering-master-sampling.ts`
- `src/data/pcs-engineering-bom-storage.ts`
- `src/data/pcs-engineering-bom-repository.ts`
- `src/pages/pcs-independent-sampling.ts`

### 验证命令

- `node --import tsx --test tests/unit/engineering-bom-storage-codec.test.ts tests/unit/engineering-bom-storage-atomicity.test.ts tests/unit/pcs-design-revision-current-flow.test.ts`：通过，12 项。
- `npm run typecheck:engineering`：通过。
- `npm test`：通过。
- `npx vite build`：通过，有既有大包体积提示。
- `playwright-cli -s=design-copy run-code <output/playwright/design-copy/verify.cjs 内容>`：通过，五组独立上下文验证复制、三类修改、保存刷新、手动提交、源任务不变、日期／品牌／重置及导航。
- `git diff --check`：通过，本任务文件。

### 证据

- 复测脚本：`output/playwright/design-copy/verify.cjs`。
- 最终原始样本与最大值：`output/playwright/design-copy/performance.json`。
- 浏览器运行输出：`output/playwright/design-copy/browser-result.txt`。
- 草稿截图：`output/playwright/design-copy/copied-draft.png`。
- 初始超时和优化过程：同目录 `browser-result-initial.txt`、`browser-result-before-codec.txt`、`browser-result-codec-wall-clock.txt`、`browser-result-before-list-optimization.txt`、`browser-result-before-string-reuse.txt`。初期导航计时包含自动化等待；随后以页面内首屏图片就绪及绘制标记测量；跨文档导航使用 timeOrigin 校正，不使用出现负数的早期导航样本。

隔离发布工作树额外保留 `before-getter-optimization.txt`、`before-owner-query-optimization.txt`、`before-direct-encoding.txt`、`before-object-reuse.txt`、`before-list-clone-optimization.txt` 的失败样本；最终结果如下。

### 性能结果

| 操作 | 五次样本最大值（ms） |
| --- | ---: |
| 列表冷进入 | 445.30 |
| 复制为草稿 | 196.40 |
| 草稿首次进入 | 164.80 |
| 修改物料 | 29.90 |
| 修改费用 | 32.80 |
| 修改样衣安排 | 32.90 |
| 保存草稿 | 82.80 |
| 草稿刷新 | 147.70 |
| 修改后手动提交 | 102.80 |
| 返回列表 | 233.30 |
| 日期筛选 | 118.20 |
| 重置筛选 | 116.50 |
| 品牌筛选 | 109.80 |
| 站内进入详情 | 201.80 |

### 例外

- 无。本次适用性能项按严格小于 500ms 验收。

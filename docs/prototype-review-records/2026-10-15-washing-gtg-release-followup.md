# GTG 洗水发布复核补充修复

依据：[AGENTS.md](../../AGENTS.md) 的 SCOPE-02、TRACE-01、REVIEW-01、PERF-01、EVIDENCE-01 和 RELEASE-01。继承 [V1.3 需求与矩阵](../product-design/post-print-fabric-washing/gtg-routing-and-processing-layout-v1.3.md) WASH-226～266；本记录只补充发布回放发现的直接仓库数量问题。

## 基本信息

- 日期：2026-10-15
- 任务 / 需求编号：WASH-267～WASH-269；V1.3 的 WASH-261、263、264 补充回归
- 验证人：Codex 主代理（技术验证；产品接受待用户）

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：GTG 实收 53 Yard 后全部投入，实际产出 52 Yard；待交出卡片为 52，但摘要仍为待加工 53、待交出 0，刷新后可复现。修复共享仓库摘要读取洗水余额及洗水产出；普通染色、裁床、车缝逻辑不扩展。

## 范围、计划与原子矩阵

目标：已投入洗水的数量退出待加工统计；尚未交出的实际洗水产出进入待交出统计。原实收事实保留，统计只读，不新增库存副本、存储字段或迁移。

实施顺序：先用 53→52 的最小数量契约复现失败，再调整 `getFactoryWarehouseSummary` 两处取数，补齐直接消费者的可见摘要断言；构建固定产物，在 GTG 390×844 两仓及原单直达各采五次，复核筛选与其他工厂隔离，完成两轮主代理语义审查与最终技术收据，再提交、快进合并、推送和验正式站。

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 实际文件 / 符号 | 自动化验证 | 页面 / PDA / 打印 / 性能证据或不适用理由 | 状态 | 证据位置 | 确认人和确认版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WASH-267 | V1.3 WASH-261；本次线上复核 | 洗水待加工数量使用尚未投入的实收余额，原实收数量不被统计改写。 | 发布补充 | src/data/fcs/factory-internal-warehouse.ts / getFactoryWarehouseSummary | washing-factory-warehouse-overview.test.ts 的 53→0 契约 | 原实收 53、投入后待加工为 0；PDA 固定产物两仓及原单直达五次通过；打印不消费仓库摘要。 | 已验证 | ../verification-evidence/2026-10-15-washing-gtg-release-followup/warehouse-summary-red.log；warehouse-summary-green.log | 技术验证：Codex；97adcd3d + b7b5b3e4711c；接受待用户 |
| WASH-268 | V1.3 WASH-261；本次线上复核 | 洗水待交出统计包含尚未交出的实际产出，交出后退出待交出统计。 | 发布补充 | src/data/fcs/factory-internal-warehouse.ts / getFactoryWarehouseSummary | washing-factory-warehouse-overview.test.ts 的 0→52→0 契约 | GTG 产出明细与摘要一致；PDA 固定产物两仓及原单直达五次通过；打印未改取数。 | 已验证 | ../verification-evidence/2026-10-15-washing-gtg-release-followup/warehouse-summary-green.log | 技术验证：Codex；97adcd3d + b7b5b3e4711c；接受待用户 |
| WASH-269 | V1.3 WASH-261；数量读取边界 | 洗水产出遵循现有工厂、工序、仓型、状态和关键词筛选，不计入其他工厂。 | 发布补充 | src/data/fcs/factory-internal-warehouse.ts / getFactoryWarehouseSummary | washing-factory-warehouse-overview.test.ts 的各筛选及 F090 前后对比 | 筛选契约；GTG 两仓页面及确切单据直达五次通过。 | 已验证 | ../verification-evidence/2026-10-15-washing-gtg-release-followup/warehouse-summary-green.log | 技术验证：Codex；97adcd3d + b7b5b3e4711c；接受待用户 |

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 现场问题复现与最小契约 | 通过 | 正式站 97adcd3d；原截图与失败单测保留；失败原因 53 不等于 0。 |
| 原实收、待加工余额与实际产出 | 通过 | 三项定向单测通过，原实收仍为 53；其他工厂及状态筛选不受影响。 |
| PDA 页面与直接原单 | 通过 | 390×844；1 单和 36 单规模，摘要与明细及确切原单一致。完整报告保留。 |
| 性能 | 通过 | 固定产物已完成各家族五次，最大 968.5ms；采集失败原记录与修复映射保留。 |
| 持久化与图片 / 打印 | 不适用 | 只调整摘要只读聚合，未改变保存、图片、打印映射；原版本同事实验证保留原身份。 |
| 两轮语义审查 | 通过 | 主代理分两轮检查原事实及数量流转、筛选隔离及共享消费者，见下文。 |

## 最终结论

结论：通过

## 变更覆盖与验证

### 受管文件

- `src/data/fcs/factory-internal-warehouse.ts`

### 页面证据

- 版本：codex/post-print-fabric-washing；HEAD 97adcd3dd726753540683b75f9db86bb49f38488 + 本次差异；工作树 /Users/laoer/.codex/worktrees/a266/higoods；固定构建预览 127.0.0.1:43159；运行产物绑定本补充的 runtime-assets.json；共享运行文件摘要见 source-manifest.json。
- 证据：../verification-evidence/2026-10-15-washing-gtg-release-followup/PDA-GTG-warehouse-summary-before-refresh.jpg；正式站 /fcs/pda/warehouse/wait-handover，390×844；WS-20261015-384854C3 的产出 52 与顶部 0 不一致，刷新仍复现。原图、原失败记录不覆盖。

### 性能结论

- 结论：通过
- 依据：[补充性能索引](../verification-evidence/2026-10-15-washing-gtg-release-followup/performance-summary.json)；各规模的两仓冷启动与原单直达分别保留五次样本，完成端点包含正确可见摘要、图片、字体及两帧绘制，保存后的资料为原生 IndexedDB 回读。

### 验证命令

- `node --import tsx --test tests/unit/washing-factory-warehouse-overview.test.ts`：通过
- `WASH_DIRECT_SECTION=warehouse WASH_BASE_URL=http://127.0.0.1:43159 node scripts/check-washing-gtg-direct-consumers.mjs`：通过
- `npm exec vite -- build`：通过
- `node scripts/check-typescript-scope.mjs src/data/fcs/factory-internal-warehouse.ts`：通过

### 例外

- 无。本记录是补充修复的本地技术验收；线上发布与原 53→52 记录的最终回放由发布证据单独登记。本补充不修改原历史报告和原技术收据。

## 两轮主代理语义审查

第一轮检查“原实收→领用→产出→交出”的数量关系：洗水投入只影响可用余额，原实收 53 保持；待交出只计算实际完成且未交出的 52；尚未产出与已交出均不计入，未增加任何写入或第二份库存。最小契约先复现 53≠0，再转为通过。

第二轮反向检查共享消费者与边界：移动端概览继续调用同一仓库摘要，现有工厂、工序、仓型、关键词与状态过滤原样作用于洗水投影；F090 前后对比不变，普通非洗水待加工取数不改变；GTG 两仓与确切单据直达重放。扩大 36 单时发现验收脚本隐含首记录假设，已修正夹具顺序并按确切 ID 读回，再完整重放；失败报告、956.10009765625ms 的原有效加载样本及最终样本均保留，未删慢值。

最终技术收据输出到 `output/washing-gtg-v1.3/task-receipt-followup.json`。收据生成期间冻结本记录、矩阵、源码和原始证据；其实际状态与最终全量构建结果在发布交付说明中登记，避免改写绑定文件。

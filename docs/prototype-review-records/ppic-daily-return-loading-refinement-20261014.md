# PPIC 每日回货正式站加载补修记录

依据 [AGENTS.md](../../AGENTS.md) 的 SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01 和 RELEASE-01。本记录继承已确认 PPIC 方案的 R51／R52／R58／R59，记录第三版补修的本地阶段；前两次发布及失败证据保留原版本身份，正式站验收另记于外部部署记录。

## 基本信息

- 日期：2026-10-14
- 任务 / 需求编号：PPIC 加载补修 P01～P03，继承 R51／R52／R58／R59
- 验证人：Codex 主代理；独立只读审查代理核对完整两文件差异

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：三条精确 PPIC 读取路径，在分配产物来源严格为空时省去不必要恢复；将真实初始化依赖和填报对应款图提前抓取。非空持久覆盖仍按原流程恢复，业务保存和正式实收不变。

## 现场依据、范围与实施计划

`93e7c93b` 的正式部署成功，32 个相关资源哈希一致。新标签直接回货跟进已确认 499 件及 10 件原承诺兑现，组长汇总一致；但冷加载 5 样本 1085.5～1986.4ms，浏览器内部内容、图片、两次绘制独立诊断也为 1111.4～1569.4ms，违反 R58。Brotli 正常，后续必需模块被串行发现。原失败保存于 `output/ppic-release-20261014/followup/`，不以本地结果覆盖。

| 编号／继承 | 原子结果 | 实际文件／修改 | 验证与完成条件 | 状态 |
| --- | --- | --- | --- | --- |
| P01／R51、R52 | 三条页面仅在无保存分配覆盖时省去恢复，不遗漏真实来源或普通读取写入 | `src/main.ts`／`hydrateProductionSourceEffectsForEntry`；严格 null 判断在生产来源恢复之后 | 空库零记录、持久回货新标签一致、已有分配及合同消费；事务失败保留原记录 | 已验证 |
| P02／R58 | 三条页面提前抓取真实初始化依赖，填报提前抓取三个对应款图 | `vite.config.ts`／`preloadStaticFirstScreenRoutes`；精确 pathname、modulepreload 不提前执行 | 生产预览每类至少 5 样本，内容／必要图片／绘制／适用持久回读终点全部 ≤1000ms；正式站另验 | 已实现待验证 |
| P03／R59 | 两文件补修经独立审查及冻结技术验证，发布按相同 SHA 核验 | 本记录、技术收据、外部部署记录 | 969 单元、22 浏览器、适用治理、构建及完整 diff；线上版本和闭环由外部记录绑定 | 实施中 |

范围为填报 `/fcs/sewing-outsourcing/daily-return-report`、汇总 `/fcs/sewing-outsourcing/daily-return-summary`、回货跟进 `/fcs/sewing-outsourcing/returns`。只读恢复部位票、裁床事件、生成放行、PCS 后道和 PPIC 仍保留；任何非空分配覆盖，包括删除标记和显式空 entries，仍走原恢复分支。无新增存储、迁移或后备；未预加载全套 FCS，未改数量、身份、两节点、截止、FIFO 分摊或保存行为。无真实数据库和工厂接口写入。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 三条精确路径、严格 null 与恢复顺序 | 通过 | 独立只读审查确认来源先恢复；读取失败会抛错；非空覆盖恢复及来源变更监听保留 |
| 必需恢复、数量与上下游闭环 | 通过 | 本版 22 项浏览器已通过，包含后道正式回货、新标签一致、持久记录不重复及合同两节点 |
| 失败恢复及实际当前身份 | 通过 | 同批 22 项浏览器核验事务中止无半套事实、输入保留及异步身份校验 |
| 页面、图片、电子合同与小屏 | 通过 | 同批 1366×768、1280×720、1024×768、390×844；图片对应与大图 Esc、两页合同 |
| 新生产产物性能 | 通过 | 73 类 × 5 共 365 样本，全部 ≤1000ms，最大 759.9ms；`loading-final/performance-summary.json` |
| 正式站及真实设备接受 | 不适用 | 本记录仅本地补修阶段，线上另验；PDA 为 Chromium 小屏模拟，合同为电子预览 |

## 最终结论

结论：通过

本地补修阶段的业务、页面、构建及生产性能已通过。该结论只支持本地阶段，正式站整体验收仍须第三次部署后验证，不是业务方接受回执。

## 变更覆盖与验证

### 受管文件

- `src/main.ts`
- `vite.config.ts`

### 页面证据

- 版本：分支 `codex/ppic-daily-return`，基准 `93e7c93bf5efbe3985026b1fff89518d8f90fab6` 加本记录两文件差异，运行差异 SHA256 `f1c63d44e5cbcc91ab050550e3c715b38f0b7672b586139e51a2e6f45e3bd119`，生产 HTML SHA256 `cd225be5aeabfe60308247af0fbc5ecb73d7fc2b4b4af2b3e0f9e7802e8bc951`；工作树 `/Users/laoer/.codex/worktrees/5f34/higoods`，本工作树 Vite 5482。
- 证据：`output/ppic-release-20261014/followup/browser-loading-refinement.log` 22 项通过及关联截图；`loading-final/build.log` 工程类型检查、969 单元及构建通过。新的生产预览证据在 `output/ppic-release-20261014/loading-final/` 独立保存。

### 性能结论

- 结论：通过
- 依据：本地生产预览，Asia/Jakarta、真实时钟、实际内容／必要图片／两次绘制／适用持久回读；73 类共 365 样本，最大 759.9ms，全部 ≤1000ms。四份原始 JSON 与汇总独立保存。正式站第二版有效超时保留，不豁免新正式版 1 秒门禁。

### 验证命令

- `npx playwright test --config tests/ppic-daily-return.config.ts`：通过
- `npm run build`：通过
- `node output/ppic-release-20261014/loading-final/performance.mjs`：通过
- `node output/ppic-release-20261014/loading-final/consumer-performance.mjs`：通过
- `node output/ppic-release-20261014/loading-final/receipt-performance.mjs`：通过
- `node output/ppic-release-20261014/loading-final/identity-save-failure-performance.mjs`：通过

### 例外

- 无。正式站部署、业务和性能须另验，未通过时不关闭发布整体。

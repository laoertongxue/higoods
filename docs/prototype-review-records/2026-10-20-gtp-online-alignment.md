# GTP 配料参照与原型全功能展示审查

依据 `AGENTS.md` 的 SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01；沿用 `docs/prototype-review-record-template.md` 的完整产品审查模式。

## 基本信息

- 日期：2026-10-20
- 任务 / 需求编号：GTP线上参照、去维护入口与假角色；GP-01～GP-14
- 验证人：Codex 主代理；独立只读审查由旁路代理执行，产品接受由用户确认

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：单据块与物料明细直接展开；移除维护入口和演示角色；旧数据实际保存兼容，跨入口直接操作保持业务校验；T4 + T5。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 单据身份、工厂待定与逐物料库存/单位 | 通过 | 新GTP契约与stage1；三仓映射继承已确认规则 |
| 查询、排序、分页与全部筛选物料导出 | 通过 | stage1和新筛选契约；查询总数与统计同范围 |
| 配料数量、库存预留、唯一整单调拨 | 通过 | stage1+upstream16例；不足/未配齐阻断、真实失败输入与重试 |
| 普通保存旧资料兼容、保留共用数据/历史 | 通过 | new-contract/run-5-legacy-cutover-results.json 与 run-6-legacy-draft-results.json；完整综合套件同样通过 |
| 历史已配齐正常业务补建 | 通过 | new-contract/run-5-legacy-cutover-results.json；6库存不变、完成事实不变、刷新不重建 |
| 无维护UI、Mock首读不落种子 | 通过 | 新GTP契约首读21/10/零种子；错误页源码差异 |
| 全功能直接显示及实际权限边界 | 通过 | roles/implementation-summary.json；仓属/实际人/数量/状态/差异授权仍校验，真实PDA会话覆盖 |
| 中转收货独立直达 | 通过 | direct-receiving.log；本入口先读毛织交出依赖 |
| 1366/1280/1024页面与主要动作 | 通过 | stage1 responsive-layout 与 roles 页面证据 |
| 款式与物料图片 | 通过 | stage1 全部21款有图；物料为既有正式静态辅料图；大图/Esc/失败态。款图对应例外继承用户明确允许演示错配但不可缺图 |
| 打印内容/图片与只读事实 | 通过 | browser-contracts-final.log 70/70，含固定dist混合凭证、Web/PDA图片、原生打印/PDF与只读记录断言；后续后道优化10例定向复核通过 |
| 完整加载与操作响应 | 通过 | performance-final-r2/results.json：57家族、305有效样本、最大914.9ms；最终列表增量 performance-list-final/results.json：10家族、50有效样本、最大896.8000000715256ms；各家族至少5次，无失败，分别保留实际构建哈希 |
| 独立审查与问题关闭 | 通过 | independent-review.md，两项实质问题已修复并补浏览器复核，主代理核对实际diff |

## 最终结论

结论：通过

## 变更覆盖与验证

### 受管文件

- `src/data/material-decision/workflow.ts`
- `src/data/wls/accessory-warehouse-post-finishing.ts`
- `src/data/wls/accessory-warehouse-records.ts`
- `src/data/wls/accessory-warehouse-sewing.ts`
- `src/main.ts`
- `src/pages/material-decision/events.ts`
- `src/pages/material-decision/index.ts`
- `src/pages/material-decision/views.ts`
- `src/pages/process-factory/accessory/webbing/production-receipts.ts`
- `src/pages/process-factory/dyeing/pending-receipts.ts`
- `src/pages/process-factory/post-finishing/material-transfers.ts`
- `src/pages/wls-finished-inbound.ts`
- `src/pages/wls-inbound.ts`
- `src/pages/wls/accessory-warehouses/gtp-preparation-model.ts`
- `src/pages/wls/accessory-warehouses/gtp-preparation-sheet.ts`
- `src/pages/wls/accessory-warehouses/gtp-preparation.ts`
- `src/pages/wls/accessory-warehouses/pickups.ts`
- `src/pages/wls/accessory-warehouses/transfers.ts`
- `src/router/route-renderers.ts`
- `src/router/routes.ts`

### 页面证据

- 版本：基准 eb1b8c92d9a050e8bbbf0d39fdb9e4092fb57103；codex/accessory-warehouse-flow-20261019 的本次实际差异。工作树 /Users/laoer/.codex/worktrees/ca23/higoods；Vite诊断43270，固定生产预览43272；Chromium桌面1366×768/1280×720/1024×768，真实PDA角色定向390×844。源码及构建资产哈希随正式性能/综合验收保存。
- 证据：`docs/product-design/2026-10-20-gtp-online-alignment.md` GP-01～GP-14索引；`output/verification/gtp-online-alignment/`；`output/verification/full-function-20261020/roles/implementation-summary.json`。source服务证据不冒称正式性能或线上业务。当前固定构建与源码关系、资产完整SHA256见正式性能原始JSON；完整单测1297/1297，综合浏览器70/70；最终后道投影优化后的定向10/10及受管文件TS零错误另见post-projection.log/post-projection-typecheck-final.log。

### 性能结论

- 结论：通过
- 依据：`output/verification/gtp-online-alignment/performance-final-r2/results.json`，57家族、305有效样本、五个独立浏览器进程，全部<=1000ms，最大914.9ms。GTP冷启动/刷新/站内切换分开；查询在1366/1280/1024分别各5次，关闭家族含流水与凭证各5次；其余家族各至少5次。原正式失败（染厂1029.3ms）及预检后道实际1148.1/1196.1ms均保留，局部修复后追加本轮复测。后道实际665.2ms最大值由浏览器DOM变化、原生IDB事务complete、图片decode及两帧确认；同时保留Node断言晚结束的原始值。GTP21张、导出所有匹配物料、旧7+新10等数据规模不减。静态dist index SHA256：2a7ac83b462ecc7e73b18cfc1ae0bf0ad34723cf5feee0dc93343a11fdc58dcf。

### 验证命令

- `npm run build`：通过
- `node scripts/check-typescript-scope.mjs src/pages/wls/accessory-warehouses/`：通过
- `node --experimental-strip-types --test tests/workflow-governance/affected-checks.test.ts`：通过
- `node --import tsx scripts/check-accessory-warehouse-browser-contracts.ts`：通过
- `node scripts/check-gtp-online-performance.mjs`：通过
- `git diff --check`：通过

### 例外

- 仅继承用户已明确允许演示款式图与款名错配、但所有款必须有图的素材口径；不扩展到物料图，不豁免缺图、保存、性能或正式发布。


### 最终列表增量证据与复用范围

- GTP 空查询结果返回标准表格骨架；非空单据卡片继续原表格渲染。物料决策列表提取前后表达式字节相同，详见 `material-decision-list-extraction.json`；TMF 仅修正员工任务队列模式声明。工具只识别实际消费的卡片返回链，50 项门禁专项契约通过，基线未修改。
- 最终列表固定构建增量：`output/verification/gtp-online-alignment/performance-list-final/results.json`，10 家族/50 样本，每家族 5 次，最大 896.8000000715256ms，无失败，1366/1280/1024空结果及恢复均核验；最终 dist index SHA256 `71d7022456326827263689d33b5c6cd706effbcfbee2b3ec8b1f2b292efb0422`，前后资产哈希相同。原 305 样本保持原构建身份，未改变的保存、上下游、图片与打印证据按 EVIDENCE-01 复用；列表增量使用新证据。
- 冻结后的技术收据预定 `output/verification/gtp-online-alignment/task-receipt.json`；收据工具不支持复用已通过的业务命令，将按其实际路由重跑构建、辅料综合浏览器与物料决策浏览器，不预填结果。最终 GitHub 与正式站部署结果在外部发布记录及交付回复登记。

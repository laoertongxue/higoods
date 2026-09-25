# 旧中转袋档案保存入口：事务与失败恢复证据

范围：裁床管理 → 裁后处理 → 中转袋流转，新建空袋档案；共用 part-ticket 仓库的旧袋账实体迁移由另一工作包负责。本目录不重复声称现代扫码装袋、交出、回收或打印已经验收。

## 实现入口

- `src/pages/process-factory/cutting/transfer-bags.ts`：实际页面事件外层等待 `savePartTicketAction`；成功后刷新结果，清单打印历史分支只允许在 complete 后导航。
- `transfer-bags/state.ts`：捕获页内输入与业务状态；失败恢复；`persistStore` 仅向当前事务 stage 差量，拒绝动作外保存；重新读取后从同一仓库恢复。
- `transfer-bags/handlers.ts`：新增档案只生成这个新袋的周转摘要，不重算并持久化其他静态袋派生记录。

实际页面可达写动作是 `save-master`。`print-manifest` 有处理器，但按钮全部位于没有调用者的历史渲染函数（`renderMasterDetail`、`renderUsageSection`、`renderBaggingReviewStepCard`）；当前详情装袋页使用 `renderRuntimeEventRecordTab`。不能注入假按钮冒充真实 UI 验收，历史分支保持受事务保护。历史扫码绑定、完成装袋、交出等旧函数也没有实际事件入口，不重新启用旁路。

## 功能证据

- `check-ui.js`、`ui-results-final.txt`：开发服务 43235 的实际按钮测试。成功仅写新袋 master 和它自己的 reuse cycle 两实体，刷新可查；配额失败无袋实体、输入与备注保留；业务 localStorage 写 0、pageerror 0。
- `ui-results.txt` 保留首次失败诊断：旧 `refreshDerivedState` 曾额外落下 3 个无关演示袋摘要；修复后以 `ui-results-final.txt` 为准。
- 截图 `ui-create.png`、`ui-abort.png` 为开发服务辅助证据，不替代最终 production preview 采样。

## 最终预览采样

脚本 `preview-five-samples.js` 使用生产预览 43236，1366×768，5 个独立 browser context。每样本正常默认数据，不预热冷启动。

计时从 navigationStart 或捕获到的真实点击事件开始，直到结果 DOM、必要图片和两帧绘制完成；保存还要求对应写事务 complete，并另行直接读取 IndexedDB 检查实际持久结果。测试包含：

1. 首次进入、整页刷新、详情返回列表的站内切换。
2. 新增弹窗打开。
3. 新建确认模拟 QuotaExceededError，零新增实体、输入保留。
4. 原表单重试成功，严格两实体，无无关静态数据副本。
5. 刷新回读结果。
6. 第一组另测已有用户档案在后续失败后内容完全不变。

最终 build8 结果已完成并记录于文末；本节保留测量方法。

## 第三版构建诊断与收窄修复

`preview-five-samples-build3.json` 的五组真实值全部满足 `< 500ms`：冷启动最大 412.5ms、刷新 332.5ms、详情返回 49.1ms、开窗 60.4ms、配额失败 82.9ms、保存成功 117.6ms；5 组均无 pageerror、失败输入可恢复、成功仅两实体且刷新一致。该结果发现读侧旧写，因此不能据此关闭存储验收。

完整调用栈 `read-write-stacks-clean.txt` 定位：袋初始化 → `buildTransferBagCutOrderRows` → `buildCutOrderViewModel` → 全量备料计算 → 印花演示初始化 → PDA 交出头汇总 → 毛织初始化 → receiving / wool 业务 localStorage 写。补丁只修改 `transfer-bags-projection.ts`，使用专门裁片来源快照与真实裁床 PDA 事件，并给来源裁片行传 `sourceIdentityOnly:true`；不迁移毛织、印花等宽域。`read-write-stacks-after-fixed.txt` 证明两个业务旧写消失；完整类型检查没有本次文件错误（仍有仓库既有 6 个错误）。

`preview-five-samples.txt` 保留早期脚本返回链接 query 未匹配造成的失败；其中旧版冷780ms/刷新581ms的慢样本仍保存，不作通过证据。正式五样本脚本已修成按 pathname 匹配并 fail-fast，同时记录首次打开、刷新和保存各阶段的存储写入。

本节是 build3 后的历史诊断；最终以文末 build8 重测回执为准。本目录只声明旧袋范围验收，不单独声明整产品验收。

## 最终 build8 通过回执

2026-09-25，主代理确认完整 `npm run build` 成功的 build8，统一生产预览 43236；浏览器 1366×768，五个隔离 context，各 9 个测量点，共 **45 / 45 样本通过**。证据为 `preview-five-samples-build8.json` 和原始工具输出 `.txt`。采样期间源码冻结且无其他浏览器或 CPU 检查并发。

| 场景 | 最大耗时 |
| --- | ---: |
| 全新 context 冷开列表 | 285.2 ms |
| 列表刷新 | 170.0 ms |
| 进入袋详情 | 42.8 ms |
| 详情返回列表 | 49.1 ms |
| 新增弹窗 | 56.3 ms |
| Quota 失败并显示输入保留 | 65.5 ms |
| 同输入重试保存成功 | 68.4 ms |
| 已保存记录刷新 | 185.8 ms |
| 关键字筛选完成 | 43.9 ms |

五组全部 `businessStorageWrites=[]`、`errors=[]`；首次访问未落袋种子；失败记录数为 0、袋码和备注不变；成功仅新增自己的 master 和 reuse summary 两条实体，刷新后两条均存在；第一组另证明已有用户袋档案在之后的失败动作后 JSON 完全不变。

build7 首次读仍两次写 `cutPieceReleaseHandoverSnapshots` 的失败保留在 `preview-five-samples-build7.json`。`read-write-stacks-build7.txt` 和 `read-write-stacks-dev-final.txt` 定位为 `handover-orders.ts` 模块级演示 forEach → `createCutPieceReleaseHandoverSnapshot` → `persistHandoverSnapshotStorage`。主代理在 build8 删除该模块初始化持久化，改为已有持久快照优先、静态 fallback 只读。此次五轮首次打开均无该键写入，关闭此遗留项。

本目录的旧袋列表及保存范围验收完成；现代三类票扫码、重装、回收、报废和详情的另外 165 个通过样本见 `../acceptance-bag-lifecycle/README.md`。不以这些局部结果单独声明整产品验收完成。

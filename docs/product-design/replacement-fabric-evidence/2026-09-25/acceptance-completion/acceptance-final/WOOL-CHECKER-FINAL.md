# 毛织全套检查收尾

工作树 `/private/tmp/higoods-replacement-fabric-release-20260925`，分支 `codex/replacement-fabric-acceptance-20260925`，基础 HEAD `3a3d1648`。本次只接管既有检查脚本前置，未改任何 `src`。

## nonWool 差异归因

原 `nonWool()` 依次返回待加工仓、待交出仓、工艺仓；第三项工艺仓首次查询通过 `buildInitialWarehouseRecords → listSpecialCraftTaskOrders` 惰性装配特殊工艺仓储投影。前两项已取得未完成该初始化的副本，因此原 baseline 混合了两个初始化时点。

独立探针 `wool-initialization-probe.ts` 在任何毛织动作前连续读取三次，证据 `wool-initialization-probe-r5.json`：

| 范围 | 首次 | 第二次 | 新增静态投影 | 原记录改变/删除 |
| --- | ---: | ---: | ---: | ---: |
| 待加工仓 | 26 | 108 | 82 | 0 / 0 |
| 待交出仓 | 14 | 138 | 124 | 0 / 0 |
| 工艺仓 | 237 | 237 | 0 | 0 / 0 |

第二、第三次完整 deepEqual 一致。该失败不证明毛织动作修改了非毛织事实，而是跨仓 baseline 读取前置不充分；不据此宣称全站所有惰性初始化均已审查。

## 最小修正

- `check-wool-craft-warehouse.ts`：取基线前先调用现有工艺仓读取，完成它所依赖的静态投影初始化；新增 `assert.deepEqual(nonWool(), baseline)` 验证业务动作前投影稳定。动作后原完整 deepEqual 保留，库存/单位/身份/副本隔离断言均未删除或弱化。
- `check-wool-stock-allocations.ts`：主代理此前增加的 part / production 空快照 hydrate 误位于 fake document 的同步 querySelector 函数内部，引发 await 语法错误。仅将同两行移到 fake document 定义完成后的顶层，所有原业务断言保留。
- `check-wool-stage-ui.ts`：本次没有新增修改，保留主代理已完成的前置适配。

## 验证

- `wool-final-r4.log`：原 nonWool 失败保留。
- `wool-final-r5.log`：warehouse 7 条通过，后续 generation boundary 5 条通过；暴露 stock-allocations 前置语法错误，原失败保留。
- `wool-final-r6.log`：`npm run check:wool-fact-workflow` exit 0，全部 17 个脚本完成；包括 warehouse 7 条、stock allocations 29 条，以及最终统一仓储守恒、命令防重、错厂/错批次阻断。
- `git diff --check` 三个负责脚本通过。

本次没有运行浏览器、构建或提交。CPU 已释放；既有真实毛织 E2E 由主代理持有，本记录不替代该浏览器和性能证据。

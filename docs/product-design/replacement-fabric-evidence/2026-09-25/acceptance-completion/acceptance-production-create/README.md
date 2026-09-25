# 生产单生成依赖原子保存专项（2026-09-25）

工作树：`/private/tmp/higoods-replacement-fabric-release-20260925`；分支 `codex/replacement-fabric-acceptance-20260925`；起始 HEAD `3a3d16481156a8858155f992aab492cd2cf6bfde`。本目录证据基于当前未提交源码和同工作树 Vite 43235，最终构建、全覆盖性能与发布证据由主任务重新生成。

## 实现范围

- `demand-domain.ts` 保留 Node 同步契约，浏览器生成入口等待 `saveCreatedProductionOrderGroups`；生产单、KOL 自动任务、加工单定义、提前匹配来源使用既有 `saveProductionSourceAction` 同一 IndexedDB 事务。
- 新加工单沿用生产单 `processWorkOrderDefinitions`；提前匹配保存为生产单的 `productionCreatedProcessSources`，不复制染印执行快照。染印读取和原执行保存前合成该来源关系；后续已取消或更晚匹配不会被旧生成事实覆盖。
- 创建准备阶段读取必要旧提前源并做写前一致性检查，不生成无关仓储、交出或毛织演示记录。失败恢复生产单、需求、加工内存及临时 PDA 任务，事务 complete 前不发布新内存结果。
- 新增纯来源校验文件已由生产来源 codec 接入，备份拒绝错误归属、重复及缺冻结来源的成功匹配。
- 实际生成后详情的 SKU 档案和成衣换款两处读取，取消 seed / normalized 全包写回；已有用户源损坏或无法读取明确失败并保留，两个模块的用户保存函数未改。未迁移整个 SKU / 换款 / 染印执行模块。

## 当前证据

- `create-results-final.txt`：5 个浏览器事务场景通过：普通成功、Quota 中止、旧提前源竞态、提前匹配成功、提前匹配中止。成功事务内记录主单及原加工定义；中止无记录、需求不转化；所有场景零业务 localStorage 写。提前匹配从旧执行源重读后合成正确，已取消不复活。
- `unit-final.txt`：4 个测试通过，覆盖来源唯一性、无重复读写、取消 / 更新优先、stage 失败恢复及备份校验。
- `ui-results-with-kol.txt`：真实 `/fcs/production/demand-inbox` 普通需求 DEM-202603-0091 与 KOL 需求 DEM-202603-0092 生成并刷新成功；KOL 2,100 件整单任务、固定分配接收刷新一致。注入存储失败保留确认和技术包输入，页面明确失败，无 pageerror。普通 / KOL 成功仅写 `higood-tabs` 偏好；失败无写。时间仅单次诊断值，不能替代 5 样本最终性能验收。
- `readonly-sources-results-final.txt`：SKU 和成衣换款各四场景共 8 项通过：静态首次读、保留用户记录、损坏 JSON、读取抛错。原源保持不变，无读取写入。
- `garment-core.txt`：原成衣 SPU/SKU 整色替换核心契约通过。
- `typecheck-final.txt`：全项目原有 6 项类型错误，本任务文件无新增错误。
- `existing-generation-contract.txt`：原生成脚本在冻结快照 deepEqual 中因额外 input/output SKU 字段失败（949 行），发生于新增 UI stage 路径之外。保留失败，不将此脚本报告为通过。

## 重跑

浏览器脚本均为 Playwright CLI `run-code` 函数。需要同版本 Vite 43235 与已打开 session；运行 `check-create.js`、`check-ui.js`、`check-readonly-sources.js`。测试数据仅在新建隔离 BrowserContext 中，关闭后丢弃，不影响用户浏览器。

固定依赖旧加工单来源的部分仍采用已有只读读取，未宣称染印执行完整迁移，也未宣称全站 localStorage 问题解决。

# 任务分配粒度统一修复

范围与继承：依据用户 2026-10-10 明确要求、当前 AGENTS.md；T4 实施阶段。目标工作树 e291，分支 `codex/dispatch-assignment-granularity`，基准 `1a2df088fa8e39863b59290cde9e7e86cd84d431`。本记录合并需求、设计、计划与原子矩阵职责；实施证据按实际结果补齐。

## 需求与设计

独立车缝、车缝＋烫包合并任务允许选择完整 SKU 派单或竞价；其余可执行任务只能整单。完整 SKU 不允许再次按数量拆分。默认全选时仍整单，本次选择形成一张任务，全部剩余 SKU 形成一张待分配任务。竞价范围在最终提交时连同工厂池、价格冻结，后续定标使用该范围。

统一事实为 `classifyTaskFulfillmentPolicy`，不再从旧任务字段或工序字典回退粒度。原始任务始终保持整单范围，分区仅在实际分配时生成。删除旧明细分组解析、旧多厂派单、旧逐组竞价写入函数及模块；保留既有拆分计划的读取以保护历史记录与追溯。现有辅料、放行余量、工厂资格、二次确认和合同要求继续适用。

业务对象 → 存储 → 动作：运行任务及拆分计划 → production context IndexedDB 记录覆盖；有效分配与竞价快照 → 同库 effects 记录。派单 / 发起竞价在已有 `saveProductionSourceAction` 内共同保存，事务完成后显示结果；刷新和下游直达从持久记录读取。没有数据迁移或附件改造；未连接或写入测试站数据库。PDA 报价也通过现有原子保存入口保存竞价记录，定标复用当前 PPIC 身份生成分配与合同。

## 实施计划

1. 统一策略与范围校验：merged-production-task、runtime-process-tasks；最小失败契约后修复，校验任务类别、完整数量及拒绝非法选择。
2. 删除旧入口：task-split-dispatch、runtime 旧函数 / 类型、旧脚本与失效旧工作台测试；将有效断言转移到当前分配入口。
3. 当前工作台：unified-dispatch-workbench；竞价选择、精确确认、原子分区和快照，弹窗局部更新。
4. 直接下游：effective-task-assignments、pda-task-receive、dispatch-tenders；整单有效分配写入校验、报价原子保存、定标 PPIC 身份。报价只读取当前招标；同一次 PDA 渲染复用查询，动作仍读取最新数据。报价输入局部更新；最新招标按创建时间及单号确定，不依赖持久回读的记录恢复顺序。
5. 验证：单元与专项契约、相邻回归、构建；当前工作树 Chromium 页面、刷新回读、保存中止、任务单 / PDA 范围及适用设备和性能。最终完整 diff 语义审查与治理收据。

收据路由补齐：`scripts/workflow-governance/affected-checks.ts` 将三个实际浏览器脚本及独立双服务配置绑定同一顺序验收命令，先构建，再在已记录资源条件下执行20个生产预览场景，最后执行25个源服务场景；每轮证据目录用稳定轮次标识，失败worker仍属于同一轮。退役的两个测试文件必须通过实际不存在检查，并执行替代场景；四个变更业务脚本绑定其对应专项。`tests/workflow-governance/affected-checks.test.ts` 验证运行器、删除门禁、顺序与未知路径不能被吞掉。产品运行代码与既有页面证据版本未改变。

## 原子矩阵

确认版本为本次用户要求，技术验证人 Codex；用户产品接受尚未发生。每条证据在实施后绑定。

| 编号 | 来源 | 原子需求 | 工作包 / 实际位置 | 自动化验证 | 页面 / 持久 / 下游证据 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| AG-001 | 用户规则 | 独立车缝允许完整 SKU 派单 | classifyTaskFulfillmentPolicy、resolveRuntimeTaskAssignmentScope、commitDirectDispatchAssignment | 粒度单测、分配基础 / 任务边界专项 | 独立车缝完整 SKU 派单、500/2000 分区及刷新 | 已验证 |
| AG-002 | 用户规则 | 车缝＋烫包允许完整 SKU 派单 | MERGED_PRODUCTION_TASK_DEFINITIONS.SEWING_IRON_PACK、allocateRuntimeSkuTaskScope | 合并 SKU 分区单测、基础专项 | 车缝＋烫包完整 SKU 派单、工序与来源保留 | 已验证 |
| AG-003 | 用户规则 | 两种允许任务可按完整 SKU 竞价 | renderDispatchDialog、发起竞价处理器 | 竞价范围存储单测、工厂池专项 | 两类任务选 1 SKU/500件、冻结、刷新 | 已验证 |
| AG-004 | 用户规则 | 其余任务派单与竞价都只能整单 | classifyTaskFulfillmentPolicy、resolveRuntimeTaskAssignmentScope、createEffectiveTaskAssignment | 非允许任务分区拒绝与底层整单分配单测 | 裁剪 / 特种 / 毛织 / 烫包整单入口；三工序演示配料阻断，底层整单契约 | 已验证 |
| AG-005 | 完整明细边界 | 空选择、重复、未知 SKU、部分数量阻断 | resolveRuntimeTaskAssignmentScope、allocateRuntimeSkuTaskScope、upsertRuntimeTaskTenderRecord | 空 / 重复 / 未知 / 部分数量拒绝单测 | 不适用：非法底层入参以契约证明；页面同 SKU 无数量拆分输入 | 已验证 |
| AG-006 | 分区边界 | 本次一张、剩余一张、数量守恒且来源追溯正确 | allocateRuntimeSkuTaskScope、applyRuntimeSplitPlans | 数量守恒、工序 / 来源 / 子二维码单测 | 本次500件、剩余2000件，两任务刷新一致 | 已验证 |
| AG-007 | 竞价冻结 | 快照与所选子任务一致；定标只分配该范围 | upsertRuntimeTaskTenderRecord、confirmAwardInView | 局部快照拒绝单测、竞价池专项 | PDA报价、刷新定标、合同与打印均500件 | 已验证 |
| AG-008 | STORE-02 | 保存失败无半套；刷新后分区及分配一致 | saveProductionSourceAction、saveProductionSourceUiAction | 单元契约与业务专项 | 竞价与PDA报价事务中止、原输入保留、重试一次、刷新回读；取消重发在记录恢复顺序变化时仍读取新单 | 已验证 |
| AG-009 | 用户清洁要求 | 删除旧分组写入、模块及失效调用；历史计划仍可读 | 删除 task-split-dispatch.ts、旧 runtime 分组函数 / 类型 / 预拆函数 | 旧导出不存在、历史 detailRowKeys 计划回读单测 | 删除旧工作台 / 产能失效测试（被引用页面和模块已经不存在）；转移有效分配契约到当前入口 | 已验证 |
| AG-010 | 直接下游 | 子任务工序与源关联正确；任务单 / PDA 读同一范围 | applyRuntimeSplitPlans、pda-task-receive、confirmAwardInView | 合并来源 / 过程 / QR 单测 | 390×844 PDA、定标合同、DISPATCH_TASK_SHEET打印SKU及真实二维码 | 已验证 |
| AG-011 | UI-01 | 适用设备上可选、确认、保存且主体无溢出 | renderDispatchDialog、refreshDispatchDialog | 浏览器无页面异常 / 无主体溢出断言 | 1366×768、1280×720、1024×768管理；390×844 PDA | 已验证 |
| AG-012 | PERF-01 | 弹窗局部更新；适用事件五次样本均 ≤1000ms | refreshDispatchDialog、PDA当前招标查询与渲染内查找缓存 | 列表节点保持、生产预览原生绘制 / 回读计时 | 生产预览17家族125样本均≤1000ms，最大982.8ms；原始诊断与慢样本保留 | 已验证 |

非范围：真实工厂行为、线上发布、其他业务模块整改、修改测试数据库、删除用户历史记录。

## 本次实现与证据绑定

运行位置均位于 `src/data/fcs/` 与 `src/pages/` 上述符号；专项为 `tests/unit/dispatch-assignment-granularity.test.ts`、`tests/dispatch-assignment-granularity.spec.ts`、`tests/dispatch-assignment-granularity-preview.spec.ts`。页面 / 持久 / 性能原始证据保存在 `output/playwright/dispatch-assignment-granularity-20261010/`；最终结论以同日审查记录绑定的源版本及资产版本为准。

变更记录：验证发现 PDA 报价仅内存成功、定标未传有效 PPIC 身份，纳入 AG-007 / AG-008 / AG-010 的必要直接下游修复；性能诊断发现报价遍历无关招标和重复任务查询，纳入 AG-012。进一步回归确认报价输入重绘会清空金额、最新招标依赖 Map 恢复顺序；分别补局部输入更新和按创建事实读取最新招标，纳入 AG-008 / AG-012。未改变回货天数公式；相邻旧测试的日期、配料与放行版本夹具改为当前业务事实，夹具保存后刷新页面以读取持久结果。

最终证据：源实页25场景通过，生产预览20场景通过，全量780单测及构建通过，8个粒度 / 回读契约通过。当前运行差异SHA256为`11d933635585b8ab43ecd2edf8d9c60a1bead7830e628bbaeed7dde6e059387d`，确认版本与设备、全部性能原始值及历史失败见同日审查记录（历史验收产物已清理）。当前为技术验证，未代填用户接受；治理与技术收据另外绑定实际结果。

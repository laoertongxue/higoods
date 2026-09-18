# 性能调整专项对抗审查

- 审查日期：2026-09-18。
- 工作树：`/Users/laoer/Documents/higoods/.worktrees/work-20260918`。
- 分支：`codex/work-20260918`；基准 HEAD：`4804328a822eec3c77eee1ffa5b10911bb77c9fe`；审查对象为当前未提交差异。
- 审查人：独立子代理 `wool_stage_pages`。本轮只读业务代码，仅新增本记录。
- 范围：`main.ts` 毛织 PDA 精准加载、事件、返回、预加载及二维码懒加载；PDA 任务工厂投影；毛织 mobile 冻结快照；五个后道数据模块的固定 Mock 批量保存；对应两个专项。
- 本轮没有启动浏览器，没有执行构建，没有重写矩阵。后道 13 项专项及三个直接检查使用同一未再修改实现的实际执行结果，不重复运行制造覆盖数量。

## 结论边界

在下述受检分支和反例中，没有发现新增 P1/P2 业务缺陷。此结论只说明本轮代码审查与隔离契约没有发现问题，不是总体任务通过，也不是页面、二维码打印或性能验收通过。

**性能硬门禁仍未通过。** 当前实现还需要统一构建后的真实浏览器冷进入、刷新、切换及全部交互至少五次原始样本；本轮内存脚本耗时、减少的保存次数与代码路径分析均不能替代 `< 200ms` 门禁。

## 对抗检查与定位

| 检查目标 | 实际代码位置 | 反例 / 证据 | 结论 |
| --- | --- | --- | --- |
| 提前筛选是否把别厂任务带入，或漏掉原有默认工厂任务 | `src/data/fcs/pda-cutting-execution-source.ts:2209` | 第一层保留未分配任务，投影后再按最终工厂筛选；lookup 仍包含完整任务，未切断关联对象。执行 `check-wool-pda-factory-projection.ts`：7 个实际工厂及不存在的工厂，与全量投影后筛选逐字段相等。 | 受检数据无串厂、漏项或字段变化。 |
| 待接单与待执行是否取消了原状态判断 | `src/data/fcs/factory-mobile-todos.ts:194`、`:245` | 两处只传入当前工厂；原 `assignedFactoryId`、`acceptanceStatus`、`assignmentMode` 及毛织阶段条件仍保留。 | 没有把减少投影工作当作操作授权替代。 |
| PDA 精准加载是否凭 ID 后缀绕过工厂或路由权限 | `src/main.ts:723`–`:742` | 后缀只选择加载模块；内容仍调用 `renderPdaWoolExecutionContent` 的实际任务/工厂校验，并进入 `renderPdaFrame` 路由权限。专项验证本厂可访问、异厂 `TASK_FACTORY_MISMATCH`、不存在任务阻断。 | 未发现授权绕过；真实页面首操作仍待浏览器验收。 |
| 跳过大处理器后是否丢失首次动作或返回入口 | `src/main.ts:383`–`:430`、`:879`–`:894` | 毛织 root 动作直接加载对应已渲染模块。返回保留允许的 `returnTo`；无来源参数回执行列表；存在来源参数时仍回原详情处理器。PDA 外壳动作位于毛织 root 外，继续走通用 dispatcher；带 `data-nav` 的直接导航在 dispatcher 前处理。 | 静态路径一致，未发现确定性丢事件。不能据此声称真实首次点击或性能已验收。 |
| 冻结快照是否被排序/拼装修改，或保存后仍读旧状态 | `src/data/fcs/wool-domain/mobile.ts:449`、`:520`；`queries.ts:44`–`:54` | 隔离内存反例：根与输出数组被冻结，写入抛 `TypeError`；修改返回的 mobile task 不影响下次查询；`replaceWoolStore` 提交新的 `updatedAt` 后快照对象变化且 mobile task 立即读到新值。排序均作用于 `filter/map/Object.values` 生成的新数组。 | 未发现缓存污染或 revision 失效遗漏。 |
| 后道固定 Mock 是否减少数据或改变普通保存行为 | `post-finishing-full-flow.ts:3806`、`:3851`；四个 `beginPostFinishing*DemoBatch` | 原固定 Mock 命令体逐字符未改。`check-post-finishing-demo-batch.ts` 恢复原即时保存 loader 作为同体基线，比较 15 批 / 75 条 SKU、全部导出业务事实及六个存储值。普通登记仍返回前即时保存状态、日志、编号。 | 深比较通过；主状态 / 日志 / 编号保存由 59 / 86 / 35 次各降为一次，保存次数不是性能结果。 |
| 批量提交中途失败是否留下编号、授权、引用、日志或主状态半提交 | `post-finishing-full-flow.ts:3816`–`:3848`；四个批次 hook | 六个存储 key 分别注入一次失败；历史主状态/日志/编号特意不同于新 seed，另保留历史授权和引用。每次失败后五组内存及原始存储完全恢复，随后重试成功。生成第二订单时抛错，没有任何部分保存。 | 受检异常回滚通过。若底层连恢复写入也拒绝，会抛 `AggregateError` 明确失败，代码不宣称原存储已恢复。 |
| 已有空历史是否被新演示库覆盖 | `post-finishing-full-flow.ts:4043`；专项末两项 | 当前 schema 空 deliveries 但保留 QC 历史，不触发 seed 且原始状态字符串不变；旧版空库仅执行既有迁移，不变成 15 批演示单。 | 保护条件保留，反例通过。 |
| 二维码懒加载是否破坏非二维码页面、失败重试或允许空码打印 | `src/main.ts:40`–`:47`、`:897`；`src/components/real-qr.ts:32`、`:87` | 抽取当前真实 wrapper 的隔离反例：无 `[data-real-qr]` 不请求模块；首请求失败清理缓存，下一次 hydrate 可重试；成功模块缓存。当前二维码占位全部由 `renderRealQrPlaceholder` 生成，对应页面静态导入同一组件。毛织打印 `handover-print.ts:32`、`:162` 仍要求真实 SVG 和图片就绪；通用打印 `print/print-preview.ts:218` 等待真实 SVG，超时显示失败。 | 未发现空码打印放行或非二维码页面新增模块请求；没有实际重测 React 绘制、打印弹窗或网络失败场景。 |

## 已执行证据

1. `node --import tsx scripts/check-wool-pda-factory-projection.ts`：exit 0，7 厂和不存在工厂逐字段一致；同厂、异厂和不存在任务访问断言通过。
2. 一次隔离内存反例（使用上述脚本的内存 storage，未触碰用户浏览器）：`readWoolQuerySnapshot` 冻结；返回 mobile task 独立；`replaceWoolStore` 后 mobile projection 即时读取新版本。exit 0。
3. 一次真实 `main.ts` QR wrapper 的隔离调用反例：零二维码不调用 loader；首失败后再次调用成功；成功缓存。exit 0。仅测试加载与分派，不把 stub hydration 当真实 SVG。
4. 同实现此前已执行 `node --import tsx scripts/check-post-finishing-demo-batch.ts`：13 项通过。
5. 同实现此前已执行 `npm run check:post-finishing-default-demo`、`npm run check:post-finishing-full-flow`、`npm run check:post-finishing-current-read-model`：全部 exit 0。默认演示保持 15 批 / 75 条 SKU；后道全流程专项覆盖 15 条完整交接链。
6. 本轮未执行浏览器、项目构建或页面耗时测量。主代理统一构建和浏览器验收后才能更新对应证据。

## 仍需实际验收

- 两阶段 PDA 首次进入、无权/不存在任务页，以及本厂动作首次点击、填报保存、待接收跳转和返回定位。
- 从精准毛织页进入外壳待办/账号、底部五 Tab 的首次动作；跳过预加载不等于这些后续动作性能已经达标。
- 毛织两阶段打印实际图片和 SVG 就绪、二维码内容正确、打印按钮在未就绪时阻断，以及打印重试。
- 当前统一构建产物上的每路由冷进入、刷新、站内切换与全部操作五次实测；不得用本记录替换失败项。

## 审查版本指纹（SHA-256）

```text
4cdc5bf568d6dccec1ead77a022f3191dbfdc8a93ece7539e55b186ea42ad8a6  src/main.ts
c38336e734acf4224a5b3ddb2d0a18b3304a0cab915d10421259897c852c63bb  src/data/fcs/pda-cutting-execution-source.ts
be833a54a5d0701eebc327ceb45e79b6af7d7a4c539d7d7cdaa495f81dbcee53  src/data/fcs/factory-mobile-todos.ts
7d06be47a4972c3e3d479da1db2da632eb92fa38aaa53efebe2375f08bc6adb3  src/data/fcs/wool-domain/mobile.ts
c4d89c485a1acfb4489473b5d343a2bab4dec5871ab7784be1feda529d8c2634  scripts/check-wool-pda-factory-projection.ts
9b425c900a6363fcbfeb294fc481f6ef52ae2919d0996f1d8898630d43e724d2  src/data/fcs/post-finishing-full-flow.ts
453e2142912e54818858da0dc899f6668b5ac2a65b438c7669a93fb6ff2d462c  src/data/fcs/post-finishing-operation-log.ts
22e045a8b8f67ea3978e4807f75b4f90012c2573c4a1c5b4bbfebbad45af62db  src/data/fcs/post-finishing-document-numbering.ts
7cbdd303f1a2c750ce0328a51ce06602dfb68205943a3d5d6e0e57c3d056bbe3  src/data/fcs/post-finishing-authorization.ts
1c20dc6534c3bec8a0de13b3fe40629e8eed1aee57c2d52c1dad0b5db9c23185  src/data/fcs/post-finishing-qc-reference.ts
b7a92857b3d959324f8cdbc5fa8eb7b01a721b3572f27f08d5edb07974c0d858  scripts/check-post-finishing-demo-batch.ts
```

## 收口增补：工艺查询、阶段完单与接收导出

本节针对后续差异独立复核，工作树、分支及基准 HEAD 不变。只读业务代码，仅更新本记录；本次未运行浏览器、构建或重复测试。下述九项领域契约结果来自本代理在上一轮同实现执行的 `node --import tsx scripts/check-wool-two-stage-flow.ts`，exit 0。

### 未采用的工艺仓缓存优化

`factory-internal-warehouse.ts:2519` 的 `ensureFactoryInternalWarehouseStore` 每次都会取得防御副本并重装四类毛织投影。一次隔离反例记录了同事实版本下 40 次列表读取触发 40 次投影克隆，确认有重复工作；这个次数不是浏览器耗时证据。

仅按毛织 revision 跳过重装会改变现有行为：通用 upsert、库位修改、交出同步、盘点执行和仓储快照恢复都可能修改这四组数组；现有下次读取会用毛织权威事实覆盖派生行，简单缓存却会保留这些修改。安全实施需要在约十处通用写入口同步失效，超出本轮最小优化范围。故未采用该优化，未修改两个仓储生产文件，也未保留仅服务于该优化的临时红测脚本；原接收同步、防御副本和派生数量规则保持不变。

### 增量审查结果

| 检查项 | 定位与反例 | 当前结论 |
| --- | --- | --- |
| 工艺查询切到冻结快照是否污染共享事实或漏刷新 | `craft-flow.ts:45`–`:56` 只遍历冻结毛织与接收快照，按工艺单建立本次局部接收汇总；`:75`–`:86` 的写动作仍使用独立 draft 和提交入口。九项领域契约包含首厂分批实收、末工艺回货及 SKU 最短板。 | 未发现新增 P1/P2；没有用共享查询快照代替写入 draft。 |
| 两阶段完单是否把缝盘重新绑定纱线或设备 | `commands.ts:1245`–`:1257` 先调用 `stageCompletionBlock`，仅横机释放设备；`stage-rules.ts:41`–`:49` 仍要求加工计划、交出和直接下游实收闭合。九项契约包含阶段独立完单与缝盘不得关联设备。 | 受检契约通过；尚未交出或下游未收齐不能完单。 |
| CSV 数值 0 和纱线净重是否丢失或变成毛重 | `pending-receipts.ts:229` 使用 `value ?? ''` 保留零，纱线实发读取 `yarn.netGrams / 1000`；`:136` 复核接收使用相同重量计算函数得到净重。 | 静态核对正确；数值和单位未改为毛重或片数。 |
| **P2：工艺片导出被错误标成备料** | 原 `pending-receipts.ts:229` 只读取 `woolOrderId`；工艺厂片接收源由 `craft-flow.ts:25` 仅设置 `woolCraftOrderId`，因此导出错误。现已改为 `woolCraftOrderId || woolOrderId || '备料'`，与列表关联加工单列一致。 | **修复及真实导出回归通过，该 P2 关闭。** |
| 新回归是否真正覆盖上述错误 | `tests/wool-stage-actions.spec.ts:254`–`:272` 取得实际工艺片来源的工艺单 ID，打开该工艺单待接收页，切为全部并点击真实导出；读取浏览器下载的 CSV，先断言至少一条数据，再逐行断言加工单列等于该 ID、单位为“片”。 | 反例不是字符串源码检查，也不会因空导出而假通过；最终冻结版本回放中该用例通过。 |

**本范围收口结论：通过。** 主代理完成冻结版本最终 30 条浏览器回放，本代理只读核对 `/tmp/wool-final-e2e.log`：末行 `30 passed (2.3m)`，第 30 条为上述工艺片导出身份及“片”单位反例；此前两阶段独立完单、数量修正、扫码防串厂、全量导出与列偏好也在这次回放通过。未发现本增补范围内仍未修复的功能问题；工艺仓缓存优化明确未采用。此结论仅关闭该 P2 和本节增量功能审查，不代表总体任务或性能通过。冷进入、刷新、路由切换及交互五样本性能门禁仍由主代理单独收口，本记录不提供豁免。

本节复核指纹：

```text
aa0605d2645449e6f92b069e12534bd3943f16ba45b52d1c5da739c0e88cb433  src/data/fcs/wool-domain/craft-flow.ts
42667075b39895330579c59cd17d4abd29abc9cddb715dfdd75187ac283e1979  src/data/fcs/wool-domain/commands.ts
1604d8f9262ccd21b37ab4aa7795ddbbc446be60401f8c510e08c0d80f99ffc2  src/pages/process-factory/wool/pending-receipts.ts
b9121af9e6db4ee7986e7073f31bb2cffdae986d563c23bc85e596924fab2d37  tests/wool-stage-actions.spec.ts
```

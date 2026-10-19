# 后道特殊工艺来源专用只读入口：实现与等价契约

技术确认人：Codex 子代理。当前基线 `ecc8af013b5f9d67f5fef14fe5b692483aada61d` 加本任务未提交实现。产品只修改 `src/data/fcs/special-craft-task-orders.ts`；唯一新增验证文件为 `tests/unit/post-finishing-special-craft-source-readonly.test.ts`。本轮没有浏览器、构建或性能采样，不将 Node 耗时解释为业务响应性能。

## 1. 调整及直接消费者

新增 `listPostFinishingSpecialCraftTaskOrderSources`，后道 bridge 改为注册该 getter。读取期间复用现有 `readingCuttingTaskSources` 和 `ensureStore(false)`，不调用 `projectFinalWoolReceipts` 的仓快照删除／重建路径。读取 `readWoolStore()` 后，用纯 `projectWoolFinalCraftTask(task, wool, peers)` 在返回值中保留缝盘成衣末工艺投影；仍合入原 `listWoolCraftTaskOrders()` 集合及原失效过滤，不自行删掉毛织外发片或猜测来源数量。

运行时 bridge 的 F/V 两处消费者仅把特殊工艺任务交给 `buildFormalPostFinishingReturnSources`；正式适配继续检查操作项、成衣对象、实际分配、实际工厂、生产单及实际逐SKU交出量，不消费任务的 `warehouseLinks`。没有替换正式来源、没有取消合法来源，也没有以计划量代替 `lineProgress.returnedQty`。

普通 `listSpecialCraftTaskOrders`、`projectFinalWoolReceipts` 及旧裁床 `listCutPieceSpecialCraftTaskOrderSources` 函数字节与保留的 before 源相同，Node 契约用 AST 实际核对。`ensureStore` 的原首次任务构造部分也相同；只扩充其普通仓投影分支，以补回首次后道来源构造延期的写仓调用。

## 2. 首次延期写仓与红例闭合

只加 getter 的初版存在真实差异。原 `buildLinkedSupplementTaskOrders` 会为盘扣构造补充任务并写仓，随后其8张中间任务被 `BUTTON_LOOP_OPERATION_ID` 过滤掉。只从最终 `taskOrders` 做普通仓投影无法重建这8组既有仓事实。初次 cold 对照因此失败，入库记录由原175变成167；原失败未被删掉。

修正只为首次后道专用来源构造捕获四种实际 upsert 参数及调用次序。复用原 flag 分支已经 `structuredClone` 的返回对象，不额外复制全任务仓或持久化整包。首次普通 `ensureStore` 先按原次序补这批调用，再执行原最终任务仓投影；两部分都成功后才标记完整并清空待补批次。普通首次入口没有批次时不捕获、不额外拍快照；旧裁床 flag 路径没有新捕获器，保持原行为。

有待补批次时，普通投影开始前保存原工艺仓四集合快照；失败恢复四集合并保留整批重试。契约在第3次工艺入库记录克隆时抛错，至少有一条真实 upsert 已执行，然后验证四集合与失败前完整相同，重试仍补回包括盘扣中间记录在内的完整结果。没有把重试当作新的来源或新的加工事实。

边界处理：

- getter 的 flag、捕获器均在 `finally` 恢复；只有首次该入口实际构造任务时才捕获，重复来源读取不会无限追加。
- 首次构造未形成任务 store 就抛错时，不保留不完整批次；已形成 store 后的后续读取异常保留对应批次，供正常入口完成。
- `resetSpecialCraftTaskStore` 同时清空旧批次。fresh 对照中，reset后原／新普通构造的记录克隆次数均1664，未额外回放已废弃批次。
- `restoreSpecialCraftTaskStore` 在有批次时先对旧 store 完成普通投影，再替换 snapshot。不能把旧生成批次追投影到恢复后的任务集合；前置投影失败时 snapshot 尚未替换，保留原 store 和批次。无批次的 restore 保持原流程。
- 批次仅是同一页面进程内、首次来源构造产生的派生参数；不进入 IndexedDB 或 localStorage，不是新的业务队列、离线队列或持久事实。普通完整读取成功后清空；完整页面刷新随模块派生状态一起结束，之后按现有入口重新生成。未验证开发热更新时的跨旧模块对象使用。

## 3. 原始失败、最终运行与非空证明

最终执行：

```text
POST_FINISHING_SOURCE_READ_EVIDENCE=docs/product-design/post-finishing-partial-flow-20261019/evidence/retained-checks/special-craft-source-readonly/final-contract \
node --import tsx --test tests/unit/post-finishing-special-craft-source-readonly.test.ts
```

结果为 exit 0，1个 Node test 通过，内部10个全新 Node 进程完成5对原／新读取对照，运行约8.1秒。[最终日志](run-final-contract.log)、[最终报告](final-contract/report.json) 及每进程完整JSON同目录。每个子进程独立内存、固定同一时钟；不模拟DOM／IndexedDB，也不访问外部数据库。

| fresh场景 | 直接来源任务／毛织片数 | 正式来源及关键事实 | 验证结果 |
| --- | ---: | --- | --- |
| cold静态来源，再普通完整读取；新路径注入回放中途故障并重试 | 158／22 | 默认图案任务尚无交出，所以此场景正式图案来源为空；只证明初始化、完整恢复与仓等价，不单独作为正式来源充分证明 | 来源读取四仓不变；故障恢复、重试、完整任务及四仓等价 |
| 合法成衣烫图／直喷交出及毛织末工艺 | 149／22 | 复用既有毛织缝盘末工艺夹具及公开命令：烫图交出7、直喷交出8；第二笔实际毛织实收后返回 received20／completed12／returned7，保留2笔毛织实际接收；9张有效失效任务被排除 | 两个非空正式来源的完整输出 deepEqual；非仓链接来源字段、随后普通完整任务及四仓 deepEqual |
| cold来源读取→公开直喷交出8→普通完整读取 | 158／22 | 交出通过公开 `executeProcessWebAction` 完成；新旧最终正式来源均为该张实际8件 | 实际动作未被旧延期参数覆盖；全部普通任务及四仓 deepEqual |
| cold来源读取→直接restore→普通完整读取 | 158／22 | 使用已有来源任务的隔离snapshot输入，仅改备注；刻意不先调用会flush的capture | restore返回时原／新四仓已相同；随后完整任务和四仓 deepEqual |
| cold来源读取→reset→普通完整读取 | 158／22 | reset不带走原仓事实，清除旧待补参数，再由正常生成路径构造 | 完整任务／四仓 deepEqual；原／新构造记录克隆次数相同 |

默认普通仓完整结果为待加工116、待交出154、入库175、出库84；实际毛织／图案交出场景为116／158／175／87。比较的是全部记录及字段，不是仅总数或摘要。

正向数量使用现有公开命令产生，没有直接设置 `returnedQty` 假造交出。负向 metadata 是明确隔离的适配输入副本：未分配、非成衣、其他工艺、交出为0和缺工厂均不得添加正式来源。已失效任务由现有未开工任务作废命令形成；毛织片22张仍在原来源返回集合，但正式成衣适配继续排除它们。

原读取对照在独立进程把公开 bridge resolver 指向保留的普通 `listSpecialCraftTaskOrders`；新读取使用当前实际注册的专用 getter。不是写两份近似计算代码来互相比较。

## 4. 严格保留的41张仓链接时点差异

不声称整个专用来源任务对象的原始字节等价。首次来源 getter 延迟仓投影时，41张任务的 `warehouseLinks[1].handoverRecordId` 和 `warehouseLinks[1].handoverRecordNo` 仍是构造阶段的 `JH-*` 值；普通完整投影后为原完整路径的 `SC-HR-*`／`SC-HDR-*` 值。

[deferred-warehouse-link-differences.json](deferred-warehouse-link-differences.json) 逐张列出全部41个 taskOrderId、taskOrderNo、上述两个具体字段及实际原／新值（82个叶字段差异），来自保留的reset边界原始JSON，没有合并为一句“无影响”。`green-boundaries` 的该次外层测试曾因为误称整个来源对象相同而失败，[日志](run-green-boundaries.log) 仍保留，未改为pass。

最终契约在读取当时先 `structuredClone` 除 `warehouseLinks` 外的所有来源字段，再比较，避免后续普通 getter 通过变更旧对象引用掩盖差异。正式来源输出完整 deepEqual，随后普通完整任务的全部字段（包括 `warehouseLinks`）和全部四仓完整 deepEqual，均没有缩减。此限定有实际消费者依据：F/V 的 bridge读取仅送正式来源适配，适配不读取这些仓链接。完整raw任务仍保存在每进程JSON中。

## 5. 加工动作与外部工艺仓入口边界

特殊工艺公开修改路径在写前先普通ensure：`updateSpecialCraftTaskOrderWebStatus`、`executeButtonLoopSpecialCraftAction` 直接ensure，逐行action先 `getSpecialCraftTaskOrderById`→普通project→ensure；普通 `getSpecialCraftWarehouseView` 先读取完整工艺任务再读仓。故这些动作先完成待补批次，再保存实际加工变化。cold→公开交出8的真实对照验证该顺序。

低层 `factory-internal-warehouse.updateWaitProcessStockLocation` 自身仅准备工艺仓，不主动准备特殊任务；实际页面caller为 `src/pages/pda-warehouse-wait-process.ts:2457`。该页面对中央辅助／特种工艺工厂在约1813行先转交接入口；普通特殊工艺仓view则先ensure。当前fresh源读取前四个仓集合中 `SC-*` 记录均为0，新getter没有制造可编辑的SC仓行。

不能外推为任意底层API调用均受到本队列保护：如果手工直接在待补期间对相同SC记录ID调用底层upsert／库位修改，随后普通生成投影仍可能upsert该ID。普通生成路径本来具有按稳定ID重建派生仓字段的行为，此次没有增加通用冲突保护或鉴权；没有使用“无风险”覆盖这类未验证直接调用。开发HMR保留其他模块仓内存、同时替换特殊任务模块的组合也不在上述fresh Node证据内。

`retireLegacyWoolPieceTasks` 的原退役仓清理保持。若存在确实待退役的旧毛织片，它在ensure首次任务构造中仍可能做原仓快照清理；不能把当前fixture未触发解释为全历史绝对无写。本轮证明范围是本任务实际cold及非空正式来源，并阻止新增仓 artifacts；没有修改该旧清理机制或其历史意义。

## 6. 版本哈希与留存

| 对象 | SHA256 |
| --- | --- |
| before `read-projection-before/special-craft-task-orders.ts.txt` | `1299f2b2c5042a26035ae5f36d68cbc445ae42c2442137f73fb50f8d00dd5c81` |
| 当前产品 `src/data/fcs/special-craft-task-orders.ts` | `eea93893a9731ab466c0692fa63715e87af1386b6aa0774f87cf7adee31a2a2e` |
| 唯一新Node unit | `7eee18cada4cf2c7335e032d30fdd08676e5eaec63e7fdaec46255d2f166f256` |
| `final-contract/report.json` | `97432edb5f219179b59942bca4e2fe3081a1673ca0a641baf9a0faac8a759105` |
| `run-final-contract.log` | `ff14c0f135433f6876ae42e0e1f853646b842bb7adf9638393f02ed90fd77d95` |
| `deferred-warehouse-link-differences.json` | `5c8f89ee64fd499622dea0e38799310948b990dff73df4361189e374f74f0df8` |

`run-initial.log`、`run-cold-warehouse-red.log`、`red-initial-test.ts.txt`、`red-cold-warehouse` 保留初版仓差异身份；`green-equivalence` 是补盘扣后首个4进程通过版本；`green-boundaries` 实际是仓链接全对象比较的失败版本，名称不是通过结论；`final-contract` 才是当前10进程最终结果。没有覆盖原失败日志或将旧源证据重标成当前成功。

最终产品和unit均已冻结。构建、完整类型检查、F/V全阶段对照及浏览器性能由主代理统一执行；本记录不提前声称性能已≤1000ms，也不代替实体工厂或产品接受。

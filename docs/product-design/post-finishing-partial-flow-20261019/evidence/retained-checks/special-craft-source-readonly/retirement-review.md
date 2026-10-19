# 特殊工艺来源只读优化：退役补投影复活修复复核

技术确认人：Codex 子代理。基线为 `ecc8af013b5f9d67f5fef14fe5b692483aada61d` 加本任务未提交实现。本记录接续 [上一版本实现与等价契约](review.md)，保留其旧产品／测试哈希和10进程运行身份；本记录绑定下列修复后产品及12进程复验。产品范围仍只有 `src/data/fcs/special-craft-task-orders.ts`，唯一验证入口仍为 `tests/unit/post-finishing-special-craft-source-readonly.test.ts`。没有执行浏览器、构建、页面性能采样或外部数据库操作。

## 1. 实际缺陷和可达输入

首次后道专用来源读取会暂存构造任务时的四类写仓参数，延迟到普通完整读取补投影。原退役逻辑会从任务集合及当前仓集合中删除旧毛织片任务，但未删除这些已捕获的参数。随后普通读取回放参数，可能重新生成刚退役的仓实体。这是新增延期逻辑的真实缺陷，不能用默认静态数据没有触发退役来排除。

控制输入复用公开生产单与技术包数据：在隔离 fresh Node 进程中，找到满足 `shouldGenerateInternalCraftOrderForProductionOrder` 且含部位明细的既有生产单 `PO-202603-0002`，复制其现有技术包，只把纸样文件材质标记为 `WOOL`，并替换该进程内这一张生产单。其余生产单、正式ID和补充任务来源保持。该输入声明为旧通用毛织片元数据控制，未保存生产资料，不代表公开业务编辑动作或实际工厂加工。

标准特殊工艺生成器排除毛织纸样，既有补充任务分支仍可读取这些纸样并生成通用片任务，再由原 `retireLegacyWoolPieceTasks` 识别并退役。测试没有替换退役谓词、四仓清理或生成器；仅安装现有退役回调观察实际移除ID。实际移除8张任务，逐张ID见 [原始 red／green 对比](retirement-red-green-comparison.json)。

| 退役任务所属实体 | 原普通路径 red | 只读优化候选 red，来源→退役→普通读取 | 修复后相同输入 green |
| --- | ---: | ---: | ---: |
| 入库记录 | 0 | 6 | 0 |
| 出库记录 | 0 | 1 | 0 |
| 待加工库存 | 0 | 5 | 0 |
| 待交出库存 | 0 | 6 | 0 |

真实产品 red 的完整进程输出保存在 `retirement-qualified-red/`，运行日志为 [run-retirement-qualified-red.log](run-retirement-qualified-red.log)。`retirement-green/` 保留同一控制输入修复后的完整进程输出，日志为 [run-retirement-green.log](run-retirement-green.log)。比较不止上述数量：随后普通完整任务和四仓全部记录及字段均 `deepEqual`。

## 2. 最小修复及边界

修复位于 `retireLegacyWoolPieceTasks` 的原四类 `ownIds` 构造后。复用原有入库、出库、待加工、待交出ID集合，既含任务显式引用，也含原稳定前缀ID；未增加退役对象或新的清理规则。

- 当前活动捕获器必须原地倒序剔除相同ID。专用 getter 的局部 `capture` 仍指向同一数组，单独重赋全局捕获器会让 `finally` 重新追加已退役参数。
- 尚待普通补投影的批次同时按这四类ID过滤。剩余参数的原调用次序保持。
- 过滤在原仓快照和清理前执行，清理异常不会保留可复活已退役实体的待补参数。原任务退役判定、四仓快照过滤和既有清理回调保持。
- 原完整读取、旧裁床来源 getter、毛织最终仓投影和首次任务构造部分继续由 AST 契约比对原 before 源。首次普通入口无待补批次时保持原流程；reset清旧批次、restore先完成旧store投影、回放失败恢复原四仓并保留批次的原修复一并重放。

旧退役逻辑本身仍可能清理已有历史仓事实；本改动阻止新增延期参数复活退役记录，没有宣称全部历史普通读取绝对无写。专用来源初读的41张仓链接时点差异仍按上一记录限定：`warehouseLinks[1].handoverRecordId`／`handoverRecordNo` 先保留构造值，普通完整投影后相同。实际F/V来源消费者不读取这些链接，正式来源输出完整相同；不得把该限定扩写为专用来源整个原始对象字节相同。

## 3. 最终重放及原失败留存

最终执行命令：

```text
POST_FINISHING_SOURCE_READ_EVIDENCE=docs/product-design/post-finishing-partial-flow-20261019/evidence/retained-checks/special-craft-source-readonly/final-retirement-contract \
node --import tsx --test tests/unit/post-finishing-special-craft-source-readonly.test.ts
```

结果为 exit 0、1/1 Node test通过，6个场景分别用原／新读取入口在12个 fresh Node 进程执行，日志总耗时9237ms。[最终日志](run-final-retirement-contract.log)、[最终报告](final-retirement-contract/report.json) 和每个进程完整JSON保留。本耗时是测试运行时间，不是页面性能证据。

| 场景 | 核验结论 |
| --- | --- |
| cold静态来源→普通读取，中途注入真实回放失败后重试 | 来源读取四仓不变；至少一次实际upsert后失败，完整恢复旧仓；重试普通任务及四仓完整相同 |
| 实际成衣直喷／烫图交出与毛织末工艺 | 公开命令产生直喷8、烫图7的非空正式来源，完整输出相同；毛织实收20／完成12／交出7和两笔实收投影相同；真实失效排除及隔离非法元数据仍阻断 |
| cold来源→公开直喷交出8→普通读取 | 待补参数未覆盖实际新交出，普通完整任务、正式来源及四仓相同 |
| cold来源→直接restore→普通读取 | 未先capture的直接restore在返回时四仓已相同；新snapshot未受旧批次追写；普通完整结果相同 |
| cold来源→reset→普通读取 | 旧批次已清；原／新记录克隆次数1664相同；普通完整任务和四仓相同 |
| 旧毛织片元数据→后道来源→实际退役→普通读取 | 8张任务实际退役；四类所属实体不复活；完整任务与四仓相同 |

校准失败按实际身份保留：`run-retirement-red.log` 的初次输入把生产单集合缩成单张，破坏无关演示补充任务来源，不作为产品red；`run-retirement-source-red.log`／`retirement-source-red/` 使用不满足内部生成边界的生产单，退役集合为空，被断言拒绝，也不作为产品red。`run-retirement-qualified-red.log` 才是实际8张退役及四类复活的red。旧 `run-green-boundaries.log` 等失败记录及旧10进程通过证据保持其原版本身份，未重标为本版通过。

## 4. 版本绑定及交接

| 对象 | SHA256 |
| --- | --- |
| 原 before SC 源 | `1299f2b2c5042a26035ae5f36d68cbc445ae42c2442137f73fb50f8d00dd5c81` |
| 退役修复前候选 `pre-retirement-candidate.ts.txt` | `eea93893a9731ab466c0692fa63715e87af1386b6aa0774f87cf7adee31a2a2e` |
| 本版产品 `src/data/fcs/special-craft-task-orders.ts` | `324af7b517cca23e305c27e9ade633fca3ea7bee288703913a80548b8bff2e3c` |
| 本版唯一 Node unit | `125e0bc1af2ab2ada78b3e94be562430395b473c29242aa9a2caba9e010bca2f` |
| `final-retirement-contract/report.json` | `f0691cd0ad5cfa519a6cf29ee140cb43dca97257d06079809c1e5a2c36733b2b` |
| `run-final-retirement-contract.log` | `4474f4252bbf3ab26c3346318cac08397db2bbff929684020b72351b5d2da0d9` |
| `retirement-red-green-comparison.json` | `43c7c8c7aea5eb53eda37522000c889bb352194bc6d25fcc3158dad60eb67b75` |

产品和unit已冻结；仅本证据说明后补。`git diff --check`通过。主代理负责统一类型、构建、最终实际浏览器性能和全任务验收。本轮Node契约不证明浏览器持久化、跨模块热更新或任意底层同ID手工写仓并发保护，也不代替实体工厂或用户接受。

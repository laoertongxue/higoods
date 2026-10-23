# 捆条加工单源核查与接续范围

继承总矩阵C07/WP3及当前中央PDA小屏、实际账号、印尼语和同单连续作业要求。当前基准6f477551，既有水溶及其他阶段证据保留各自版本。开头各节保留源核查/实施准备时的结论；当前追加的实施及证据见文末，不把前期计划当成完成证明。

## 当前对象与数量

Web原单由binding-strip-orders依据裁剪冻结来源、BOM面料、纸样包和具体捆条规格生成；一单包含多规格，detailId是实际规格身份，不能按宽度或显示名替代。输入与产出实际均为米；裁剪方式斜切/直切/横切各自累计，不能把加工卷数当长度或把米改成条。原面料图、面料SKU/颜色、纸样/版本、来源裁剪单/任务及生产单共同用于识别。

按规格可接收=该规格requiredLength−receivedMaterialLength；可加工沿原getBindingDetailAvailableProcessQty，以已接收面料占requiredLength的比例授权plannedBindingLength，再扣该规格actualLength。不能直接用面料米数减产出米数，不能借另一规格余量超做。交出目前是整单actualOutputQty−handedOverQty，原Web不是按规格交出，不擅自改成逐规格交接事实。实际下游为中央辅料仓。

## 当前动作及直接影响

| 当前原动作 | Web规则 | 新PDA位置与继承 |
| --- | --- | --- |
| BINDING_CONFIRM_RECEIVE | 待加工/加工中，选择具体规格，正数且不超该规格剩余应收；推进加工中 | 接收Tab，扫码选单后同页选规格并填写本次实收；显示原上游 |
| BINDING_PROCESS_REPORT | 加工中，必须detailId，不能超剩余计划或实收比例授权；新增原加工/裁剪方式记录 | 执行Tab，同单内选规格，返回/语言续填按detailId隔离 |
| BINDING_SUBMIT_HANDOVER | 加工中或已完成，正数不超整单可交；生成原中央辅料仓交接 | 执行Tab，只有真实可交量时出现；展示下游与原单位，独立收方不能由发方代填 |
| BINDING_COMPLETE_ORDER | 加工中且已有加工；短裁完成沿当前原备注条件；完成时间与实际操作人 | 执行Tab，既有二次确认表达对象/结果，不替换成中央接单或开工 |

上述完工后剩余可交与短裁条件是当前Web规则；与旧设计示例不同的部分以当前代码为准，不另造提前结束、超计划或通用异常入口。原executeBindingProcessActionWithWarehouse共同维护待加工/待交出仓数量及交接，下游中央辅料仓、卷包装和原来源票必须保留。

## 已确认缺口与下一实施边界

bindingProcessOrderStore目前仅页面模块内存；capture/restore在异常时回滚，Web及旧PDA直接同步调用warehouse联动，没有持久原子提交。现中央special捕获对象只包含辅助/特种，不含该独立捆条单。因此不能仅增加中央页面便声称刷新或下游回读有效，不能把捆条塞进special订单或复制成新示例账。

下一步：为原捆条单/加工记录和实际两仓/交接提供当前PCS记录库中的逐记录保存边界，Web/旧调用和新中央共同切换，普通读取只读不落种子；记录版本冲突/稳定操作号/事务失败回滚/冷读。保存层需避免让未进入捆条的水溶/染印页提前加载捆条整个页面或重写其事实。新中央页使用现有独立框架、session和原域命令，独立简短model/view/controller，不复制Web宽表或旧PDA模板。库区库位与收发记录沿实际原仓，不虚构盘点、移库或手工调账。

待完成证据：原正常/多规格交替和边界、失败留输入、并发同单/不同单、刷新/独立下游实收、320×480及320×640中文/印尼语、扫码错恢复/返回/换人、必要图片/打印关系和适用五样本。实现前矩阵C07保持待实施/准备，不预填通过。全目标其他工序与三方继续推进，无中间提交或发布。


## C07 接续实际结果（6f477 + binding-continuity，技术验收未关闭）

原Web仅内存保存的反例由c07-original-web-cold-read-red.json保留。现binding-process-records注册到原PCS按记录共同事务，原单/规格/动作、待加工仓/待交出仓、交接和guard共同提交；普通读取不写种子。Web模态await保存后才关闭，配额失败留表；直接旧浏览器内存命令拒绝。新增仓储记录ID含原单ID，消除两笔不同单并发时原全局序号碰撞；同单版本冲突仍拦住。节点多规格数组第二条失败会回滚第一条。

独立中央binding-model/view/page已接接收、加工、整单交出、原完单、仓管只读、规格切换、实收、原图片大图、原纸码、返回及换人。数量原为米、宽度cm，原比例授权和整单交出未改变。当前Web原完成后余量可交规则仍保留，未套旧设计的全只读。发方原UID/姓名/工厂进入原动作和交接记录；收方需独立确认，发方不会代填。320×480印尼语实际回放.75收/.10产/.04交，再完单并交.06余量，通过返回、两规格和两账号。

已执行证据均在output/playwright/pda-factory-split：c07-binding-native-record-first；faults-and-parallel-stable-ids/same-order；continuity-small-ui-locators；web-save-native-cold；committed-readback-retry；qr-receipt-print-original-actor；pending-back-ui；receive-history-pagination。原浏览器进程中native存储证明持久结果，不以另一个模块实例内存替代。过程实际发现并修复process-only命令捕获遗漏，独立收方冷读失败反例qr-receipt-print-cold仍保留，修复后真实实收及打印冷读通过。保存callback晚返回时物理browserBack只清理原单草稿，原单1次接收/无下一单残留。

c07-binding-continuity-build.log：工程聚合与1656单测全部通过，Vite39.06秒；之后仅接收记录继续加载及C08原纸码改动，需在当前字节上补生产构建及各自直接检查。接收记录实际16次.01m提交，首屏15条、继续加载16条，未虚构日志。旧执行binding路由已重定向独立中央；文件内未到达的旧binding分支删除及其他旧消费者总核对仍属X11。

正式性能家族已事先登记c07-binding-performance-plan.md，等待同机QC正式验收结束再采集。生产预览当前性能、最终源码/资产绑定及整体治理仍未关闭。本文是进行中技术结果，不代表现场、物理PDA、打印机或完整拆分交付；无提交推送部署。

## 本轮正式采样完成（2026-10-22）

固定 `c07-c08-continuity-final-vite` 构建，`c07-binding-final-production-five.json`：38家族190样本≤466ms，0页面错误；源/运行资产见 `c07-binding-current-progress-freeze.json` 及其source/assets清单。接收、加工、整单分批交出、原规则完工后余量、原图、记录、错误恢复、两账号与返回/语言等本轮技术核验已收束。普通工程范围0、19既有范围外错误；旧消费者最终退役仍由X11收口。没有整体完成、工厂现场接受或发布声明。

# 后道加工数量摘要与子单筛选独立契约核验

2026-10-20；独立测试代理 `/root/partial_flow_contracts`。仅新增指定unit和本目录，未修改产品代码、其他测试或矩阵，未运行浏览器、完整构建或性能。主代理负责V原/新完整结果比较及实际页面。

实际命令：`POST_FINISHING_TASK_SUMMARY_EVIDENCE_OUT=/tmp/pf-task-quantity-summary-actual.json node --import tsx --test tests/unit/post-finishing-task-quantity-summaries.test.ts`。首次实际运行exit0、5/5通过，167.469167ms是Node测试总耗时，不是产品响应性能。

## 实际动态结果

| 唯一例 | 实际输入和验证 |
| --- | --- |
| 1 | 公开回货→确认→送检→QC，Q1000；分项500/300/200/100；主管将开扣眼原500订正为550；分三次100/100/800复检、扫码、出货及各自仓收。每个阶段摘要与完整公开getter逐字段一致，F始终取末项而非分项求和。 |
| 2 | 装扣子/包装两项、四种单项及两生产来源共5父单；生产No子集、全Set、空Set和未知Set与原完整后过滤一致。所有摘要字段均primitive；修改返回行/数组不改变下一次摘要或原完整进度。 |
| 3 | 两SKU各10已加工并占用20，授权仅实交第二SKU10、第一SKU0；出货仅正数行，摘要F20、可交0，与完整getter及原占用20一致。 |
| 4 | 明确旧格式表示：从公开QC生成父单后，仅用现有公开递归转换器去除ITEMS_V1 marker，未注入加工record/仓收。unknown F0；主管明确输入历史H400、N600及新增基线200/100后F500；随后新建400复检占用后A100，再登记包装100后F600。该400复检是本测试新提交，不冒称原历史子单。另比较当前公开demo（3父单，unknown0），再明确去marker编码旧表示（3父单，unknown3）验证旧未知口径；未把编码control称为原demo现场事实。 |
| 5 | 公开生成3个加工父单与复检/出货/待交出，另1张QC直达无postTaskId出货。无参计数3/4/3；每个getter的生产No与postTaskId共36种组合，三getter共108次交集核对均等于完整后过滤。返回数组、行及SKU深层修改不改变源。 |

共18个实际阶段观察，见actual.json。该JSON与run.log分别保留结果和真实执行输出，不把声明的旧表示输入冒称当前工厂动作。临时Q1000来源计划每例结束恢复，全部正常下游来自公开命令。

## F完整与简略计算的静态审查

已逐行比较保存的before F与当前差异：公开getPostFinishingProcessProgress固定调用includeDetails=true。在true分支，四项、各SKU clone、records clone、末项查找、H/基线/有符号登记、逐SKU max(expected,actual)占用及全部返回字段仍采用原表达式。false分支只跳过非必要各项明细和记录复制，并为实际末项计算同一itemLines；最终摘要只导出detached primitive。

本unit动态oracle是当前完整公开getter，不是另起一个旧F模块实例；它与before完整getter的等价由上述差异静态复核支持。主代理的完整V旧/新脚本和页面另行绑定，本文不冒称已运行。

## V旧→新读取字段完整绑定

| 原读取 | 新读取及等价理由 |
| --- | --- |
| taskStatus的status与availableForRecheckQty | 摘要原样带status；available直接取同计算函数的完整供给减占用；状态优先级未改。 |
| postDoneQty | 原每父完整progress.totalCompletedQty改为摘要同字段。 |
| waitPostQty | 原待后道各line.expectedQty之和改为totalExpectedQty；后者仍为同task.lines.expectedQty求和，H不减少Q。 |
| postDoingQty | 原完整Q-F改为摘要Q-F，原状态过滤相同。 |
| waitRecheckQty | 原完整available改摘要available；待复检子单部分原式不变。 |
| updatedAt | 原task.completedAt及qcTaskId回查时间仍由摘要原值提供；createdAt、其他环节时间及排序不变。 |
| postTasks生产No过滤及postOrderCount | 摘要逐父单保持postTaskId/productionOrderNo，过滤与行数不变；不把多子单重复当父单。 |
| 单个WorkOrder snapshot | 先用当前postTaskId筛RC/WH再clone；原toWorkOrder本来按同postTaskId二次过滤。其QC action只读仍全量的delivery/factories/QC，不依赖被剪掉的兄弟记录。完整task和progress仍保留给详情/责任/历史。 |

没有发现摘要遗漏V实际读取字段；未更改日期、数量、状态或计数公式。

## PDA与继承边界

PDA单次同步render只共享一次task/progress/RC/out读取；原两块模板使用同一当前父单事实，未新增跨render缓存。新getter第二参数的交集和深clone已由本unit覆盖；原无参及原生产No第一参数继续核对。

本次Node契约不证明IndexedDB事务、错误恢复、DOM、完整绘制、PDF或1秒响应。后道数据保护及原有业务契约仍由原unit/受影响浏览器证据负责，主代理将在最终版本验收。原before文件及对应manifest保持原目录身份；本目录manifest记录当前3源码、测试与日志/实际JSON指纹。

# 部位菲票与铺布来源专项证据

工作树：`/private/tmp/higoods-replacement-fabric-release-20260925`。分支：`codex/replacement-fabric-acceptance-20260925`。基础 HEAD：`3a3d16481156a8858155f992aab492cd2cf6bfde`。源码版本以 `source-hashes.txt` 为准。本目录为子任务证据，不代表完整换片布产品验收通过。

## 记录与动作范围

同一 `higood-cutting-records-v1` 数据库记录集合，按业务实体 ID 保存：

- `cuttingFeiTicketRecords`：单张已打印票/作废覆盖。
- `cuttingFeiTicketPrintJobs`：单次打印任务。
- `cuttingFeiTicketDrafts`：按原草稿映射键；旧来源实际为 sessionStorage。
- `cuttingManualFeiTicketSources`：手工票与操作记录分开。
- `cuttingMarkerSpreadingLedger`：唛架与铺布单分开；每次只保存实际变更对象。
- `cuttingMarkerPlanSourceLedger`：按唛架来源 ID。
- `cuttingMarkerPlanLedger`：按用户唛架方案 ID，保留床次、尺码配比、操作记录与占用；页面保存由主任务改为同库事务。
- `cuttingTransferBagLedger`：袋档案、周转、绑定、清单、车缝任务引用、审计、退袋/验袋/复用/关闭/报废历史共 12 类实体。

普通读取不创建记录。首次空旧源证明仅随实际保存事务提交。显式迁移按 100 条批次，写入并读回核对后才清理旧键；记录源变化、目标冲突和清理失败均保留原数据。无 localStorage 保存后备。旧袋保存入口由并行任务负责改造，见主任务整合证据。

## 通过的直接证据

| 场景 | 结果 | 文件 |
|---|---|---|
| 记录身份、局部diff、备份校验、袋锁派生、来源等价、首打门禁 | 24/24 | `unit-results-final.txt` |
| 浏览器 IDB：8 旧源迁移中断续跑、源变化、目标冲突、清理重试、CAS、请求成功未发布、事务失败回滚、禁 LS 读写 | 8/8 | `browser-eight-sources-final.txt` |
| 真实手工建票故障→重试→刷新 | 失败时 DB 0、层数 5 保留；重试12票；刷新可读 | `manual-current-native-evidence.txt` |
| 禁 LS 后真实手工票打印 | 12票PRINTED、24条创建/打印日志、调用打印1次 | `manual-print-disabled-final.txt` |
| 禁 LS 后普通生成票首打并刷新 | 6张原ID/原号票+1打印任务，刷新内容完全一致 | `generated-print-disabled-summary.json`、`generated-print-disabled-final.txt` |
| Web 真实开始裁剪并刷新 | 只落盘所选1铺布单；刷新仍为裁剪中 | `web-spreading-results-final.txt` |
| PDA 390×844 真实开始铺布，注入session写失败 | 失败DB0、备注保留；重试同事务event+session；刷新显示完成铺布 | `pda-action-after-perf-final.txt` |
| 专用打印来源与原投影对比 | 6票身份/数量/状态/袋锁、3打印对象状态一致；不读取全量PDA/库存摘要 | `projection-equivalence.txt` |
| 固定标签布局契约 | 通过 | `print-layout-results.txt` |
| 五维标题、来源、追溯与二维码契约 | 通过；正常15片标题、缺失数量不可伪造完整标题、可见页面不显示JSON | `assembly-results-final.txt` |

打印调用通过拦截 `window.print` 验证软件保存与调用时序；不是物理打印机纸面验收。当前总构建与性能门禁由主任务在最终 build 统一复验，子任务最终预览性能结果另存。

## 真实失败与修复

1. main 重复 hydrate 导致输入期间争锁，主任务改为共享入口初始化 promise。
2. PDA select input/change 导致重复全页重绘覆盖紧接着填写的备注，主任务关闭该重复重绘，当前证据验证失败后备注完整。
3. 静态铺布投影重复唛架 ID，被整表比较误当用户修改；改为显式保存被修改 session/marker ID。
4. 部位打印此前全量读取 PDA 领料/库存汇总；改用明确的打印来源窄类型，阶段只据铺布/裁剪记录，未把空领料数组伪装为全量账。普通业务全量投影接口保持。
5. 未使用的袋流转 view 急切计算触发特殊工艺/仓储种子初始化；改为使用时再计算，绑定锁仍据真实袋账。
6. 统一模板注册表 import 初始化无关生产确认来源，导致禁 LS 部位打印失败；部位标签按类型直接加载原标签模板，其他模板仍动态使用原注册表。
7. 已显示的普通生成票没有旧聚合打印 unit，首打被错误阻断；首打改用生成器已确认的实际输出来源，保留原 ID/票号，完整源、作废、数量和承接工厂门禁不放宽。
8. 唛架方案引用读取保留了旧 catch→空数组分支，可能吞掉记录恢复错误；改为真实抛错，专项验证读取失败明确阻断。

历史失败日志保留，不应把 `*debug*` 或非 final 文件当作当前通过证据。旧 `check-cutting-fei-ticket-assembly.ts` 的五维标题源码断言因 `quantity ?? 0` 防护而误报；经主任务授权改成实际函数结果与缺失数量边界，五维结果已通过。该脚本随后在“源码不能含 JSON”断言误报（本次记录 diff/事务 intent 的正常 JSON 调用触发），经授权改为实际渲染可见文本不显示 JSON，专项完整通过，见 `assembly-results-final.txt`。业务/数量断言未放宽，历史失败文件保留。

## 性能验证进行中

`performance-build3.txt` 保留 85 个真实样本，FEI列表/保存/首打与打印预览通过，手工开窗、铺布列表冷启动、PDA铺布存在超时。profile定位后，已移除列表不使用的重复projection、复用同次PDA任务context/detail、复用保存前真实store，并从真实session目标带出裁床/负责人；25个旧目标默认值等价、非空保存值专项及9个完整唛架方案等价均通过。PDA卷号helper遗漏曾导致现场失败，已恢复真正使用它的卷号/完成铺布调用并通过实际故障→重试→刷新；旧失败证据保留。等待新的统一build重新测全部性能，尚不宣称此项通过。


`performance-build5.txt` / `.json` 保留下一轮失败：手工开窗已降至 235–244 ms；铺布冷启动最高 506.6 ms，PDA 冷启动最高 512 ms、开始铺布保存最高 565.4 ms，仍未通过。FEI 保存 5 次超时属于计时监听挂在失焦后被替换的旧按钮，实际 12 张已保存且成功反馈存在（`fei-feedback-build5.txt`）；仅修验收脚本为 document 捕获实际按钮 click，仍从真实 click 到结果、图片、两帧完成计时。保留这 5 个无效计时样本，不当成通过。随后铺布投影复用完整等价的唛架身份来源；新增已保存 session 的卷明细、负责人、裁床和实际裁剪量等价验证，24/24 通过。等待统一新构建复测。

唛架管理页仍展示依赖未迁移收料事件的真实物料库存。该页只验证已迁移的 8 个部位票来源与生产来源禁用旧存储后可保存；不声称该页全部库存已脱离 localStorage。本次不迁移无关接收仓。部位票、混装和交出等本次实际迁移闭环的禁全 localStorage 门禁继续保留。


补充 PDA 同分钟场景实际发现原事件 ID 仅由类型、来源和分钟组成：开始铺布与提交本卷的事件类型均为开始铺布，造成前一事实被覆盖。`pda-stages-diagnostic.txt` 保留 5 动作仅 4 事件的失败。按明确动作身份修复提交卷：使用实际铺布单 ID + 卷号作事件 ID 与幂等键，重试同卷同身份，不改变其它事件生成规则。`pda-two-rolls-dev.txt` 验证同分钟开工、两卷、完成铺布、开始裁剪、完成裁剪共 6 独立事件；第二卷保存故障保留 50 层输入，重试仍只有 2 卷，最终 200 米、6900 实际裁剪数量及同铺布单引用一致，刷新显示已同步完成裁剪。该文件为功能证据，性能仍须最终构建每项 5 样本。


`fei-detail-dev.txt` 补充真实手工票明细动作：创建 12 张；新增独立 17 片票；修改为 19 片；删除并保留审计；原 12 张首打、补打；最终仍为原 12 个 ID 与票号，直达刷新显示补打（12），无页面异常。最终构建的严格性能范围为主路径 85 样本、PDA 相邻动作 40 样本、FEI 明细保存 / 打印 30 样本。


## 最终 build7 性能与闭环结果

统一构建版本：主任务 `source-build7.json`；预览服务 43236，同一工作树。独占浏览器 / CPU 测量窗口，Chromium，Web 1366×768、PDA 390×844。导航开始 / 真实 click 到内容、可见图片与两帧完成，不以 Loading 作为完成。每场景 5 个独立上下文样本，保留全部失败历史。

最终 **155 / 155** 个严格样本全部 `<500 ms`，0 页面异常、0 可见损坏图片：`performance-build7.json`（85）、`pda-stages-build7.json`（40）、`fei-detail-build7.json`（30）。原始 `.txt` 包括执行脚本及完整返回；JSON 是其结果的直接提取。

| 路径 / 场景 | 样本数 | 最大 ms |
|---|---:|---:|
| fei / cold | 5 | 389.2 |
| fei / refresh | 5 | 192.2 |
| fei / navigation | 5 | 73.8 |
| fei / open-manual | 5 | 245.1 |
| fei / save-manual | 5 | 167.9 |
| fei / actual-first-print | 5 | 185.3 |
| print / cold | 5 | 229.3 |
| print / refresh | 5 | 250.2 |
| print / navigation | 5 | 60.8 |
| spreading / cold | 5 | 497.1 |
| spreading / refresh | 5 | 346.4 |
| spreading / navigation | 5 | 256.3 |
| spreading / start-cutting | 5 | 209.8 |
| pda / cold | 5 | 484.7 |
| pda / refresh | 5 | 347.4 |
| pda / navigation | 5 | 248.5 |
| pda / start-spreading | 5 | 405.1 |
| pda-stages / start-spreading | 5 | 401.0 |
| pda-stages / finish-without-roll | 5 | 212.2 |
| pda-stages / submit-roll | 5 | 360.6 |
| pda-stages / second-roll-failure | 5 | 368.3 |
| pda-stages / second-roll-retry | 5 | 382.2 |
| pda-stages / finish-spreading | 5 | 256.5 |
| pda-stages / start-cutting | 5 | 214.7 |
| pda-stages / finish-cutting | 5 | 206.3 |
| fei-detail / create-manual | 5 | 159.0 |
| fei-detail / add | 5 | 94.0 |
| fei-detail / edit | 5 | 94.9 |
| fei-detail / delete | 5 | 137.1 |
| fei-detail / first-print | 5 | 116.0 |
| fei-detail / reprint | 5 | 204.2 |

PDA 5 次均确认同分钟 6 个独立事件、2 卷、200 米和 6900 实际裁剪数量；第二卷失败输入保留，重试不重复，刷新显示完成。FEI 明细 5 次均确认 12 张生成票、新增 / 修改 / 删除、首次打印及补打身份不变、直达刷新一致。该专项证据只覆盖本次列出的存储、票打印与铺布依赖，不代表未迁移接收仓已完成存储改造，也不代表物理打印机纸张已验收。

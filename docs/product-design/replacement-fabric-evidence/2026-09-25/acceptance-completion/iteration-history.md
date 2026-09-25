# 验收迭代历史（非当前状态）

以下为build21最终结果到齐前的真实时点记录，其中“当前”“待验”等均只指当时。最终状态以README及实施追踪矩阵为准。原失败未删除；后续已修复不改变原失败事实。

# 换片布菲票继续验收证据归档（收口初稿）

本目录对应用户要求“整体验收完成后再结束”的继续工作。它保存真实执行产物和仍未关闭的门禁，不是产品 accepted 回执。

- 项目：HiGood 免登录、单浏览器本地产品原型；不代表真实生产业务发生、云端共享数据或现场打印完成。
- 基线HEAD：`3a3d16481156a8858155f992aab492cd2cf6bfde`；分支：`codex/replacement-fabric-acceptance-20260925`。
- 工作树：`/private/tmp/higoods-replacement-fabric-release-20260925`；dev43235；生产构建preview43236。部分历史袋脚本使用43237，须按其manifest确认实际构建。
- 本轮修改尚未以本归档宣称推送/部署；最终源码manifest和发布SHA由主代理补充。
- [92条逐项证据与边界](matrix-boundaries.md)、[机器可读索引](evidence-index.json)、[本次受管文件登记](governed-files.md)。需求来源章节、实现位置和状态保留于上层实施追踪矩阵。

## 归档范围与版本

只归档 `output/playwright/hpb/acceptance-*` 的9个小目录和这些脚本实际引用的顶层依赖。未复制整个output；未访问外部测试数据库。归档前检查私钥、长Bearer token、数据库URL、API密钥常见模式未命中。测试账号/Mock照片/Mock备份为随原型发布或脚本创建的演示前置，不能当真实工厂记录。

build7/8/9/10/11/12各自产物保留原名。已有`source-build7.json`、`source-build8.json`、来源页面`manifest-build7/8/9.json`及各子目录`source-hashes`支持来源追踪；文件名“final”不是新鲜度证明。最后实质修改涉及的路径须按最终manifest重新验收，未受影响证据只能经主代理影响审查后复用。归档文件清单与hash是产物完整性凭据，不是源码版本manifest。

## 当前技术事实

- 7类生产来源及8个部位票旧源按实体迁移至`higood-cutting-records-v1`，复用records/commands/meta/files。草稿旧源实际为sessionStorage，不错误描述成localStorage。
- 本次相关裁后事件与旧裁片领料历史显式迁移，按类型保留共享键其他模块数据。普通读取不迁移、不复制种子。
- CAS、稳定命令、事务complete前不发布、保存中止撤回、旧源变化保留、分批迁移中断恢复、目标冲突、清理失败重试、Blob内容身份/引用保护、损坏备份不破坏原记录均有直接结果。
- 实际来源生成/拆解/派单/定标/合同/样衣/责任/接单/开工保存有各自真实按钮证据；Mock只用于明确前置，核心函数调用结果与真实界面证据分开。
- HPB、部位打印和已迁移交出链有禁全部localStorage结果。唛架库存依赖未迁移的收料事实，测试只禁用15个已迁移键；本归档不宣称全站脱离localStorage。

## 当前未关闭门禁

1. 最终性能：build11唛架613.5ms、build12装袋510.4ms原始失败保留。已完成订单范围读取和顶栏计数优化，build15存在5个路线慢样本；等待新基线build16修复后最终严格复验；修复存在不等于门禁通过。
2. 业务边界：ORDER006/007、HAND012、MAT004/HAND011及多袋UI已经收到最新通过结果；C2 r10回收旧票/新票及历史周期打印已全过，C5三合一/全朴真实交出补齐最后业务场景。`passed:false`或夹具前置失败不能借同文件其他成功项关闭。
3. Web简易交出：build10第五组timeout，不能记成5/5。PDA同版五组结果独立记录，等待最终Web/PDA版本联审。
4. D04物理打印：标签100×100mm是原型尺寸；PDF软件二维码解码、拦截window.print及程序输入扫码码串不等于现场耗材确认、实物出纸或扫码枪读取纸票。PRINT001/002仍待现场结果。
5. 最终源码manifest、全量构建/相关专项/治理结果、正反向矩阵审查、发布及产品接受均由主代理完成后追加，不回填未执行的通过。

## 证据索引

以下只表示证据位置；状态须结合逐项边界说明，不能把同文件所有scene批量判通过。

| 索引 | 原始产物 | 事实与限制 |
| --- | --- | --- |
| U1 | [acceptance-final/core-final-7.log](acceptance-final/core-final-7.log) | 核心84/84中的票身份、5Yard、改派、并集、任务/工厂、空集；不代替UI。tests路径从仓库根起。 |
| U2 | [acceptance-final/core-final-7.log](acceptance-final/core-final-7.log) | SKU需料、朴、同名身份、颜色映射、历史数量与回执。 |
| U3 | [acceptance-final/binding-strip-final.txt](acceptance-final/binding-strip-final.txt) | 捆条/部位契约和混装标签；非物理打印。 |
| D1 | [acceptance-source-ui-final/actions-build7.json](acceptance-source-ui-final/actions-build7.json) | 真分配→3初始票→增票→真改派→移出/历史失效，5组。 |
| D2 | [acceptance-final/roles-build7.json](acceptance-final/roles-build7.json) | 实际Web/PDA角色禁用与说明。 |
| D3 | [acceptance-final/two-factories-final.json](acceptance-final/two-factories-final.json)<br>[check-two-factories.js](check-two-factories.js) | UI交出700片+1票、200片+0票、另任务另厂720片+第2票；前置/后续裁剪用显式Mock，dev单轮功能。 |
| D4 | [acceptance-final/simple-disabled-final.json](acceptance-final/simple-disabled-final.json)<br>[acceptance-final/simple-pda-build10.json](acceptance-final/simple-pda-build10.json)<br>[acceptance-final/simple-handover-build10.json](acceptance-final/simple-handover-build10.json) | 禁全LS直接交出功能；PDA build10五组有结果；Web build10第五组timeout，须以最终重测补齐，不能称十组已过。 |
| D5 | [acceptance-final/mixed-backup-final.json](acceptance-final/mixed-backup-final.json) | 多袋缺项/并集是内部业务函数集成调用；Web/PDA三类型详情是真实页面；不是完整待交出按钮验收。 |
| D6 | [acceptance-part-tickets/performance-build7.json](acceptance-part-tickets/performance-build7.json)<br>[README.md](README.md) | 155/155，FEI/打印/铺布/PDA依赖；6独立事件、2卷、200米/6900量、失败重试；不替代HPB特定业务边界。 |
| D7 | [acceptance-source-ui-final/generation-build8.json](acceptance-source-ui-final/generation-build8.json) | 真实来源生成/拆解/分配/定标/合同/样衣/责任/接单/开工；每项前置与失败保留见脚本。 |
| D8 | [acceptance-final/history-print-build8-functional-r2.json](acceptance-final/history-print-build8-functional-r2.json) | 已交票补打、禁LS、receipt不变、票数不变。未实施改派、回收或再次交出。 |
| L1 | [acceptance-final/list-actions-build11.json](acceptance-final/list-actions-build11.json) | build11完整列表交互与尺寸的原始结果。 |
| L2 | [acceptance-final/extra-controls-build11.json](acceptance-final/extra-controls-build11.json) | build11列冻结/拖拽/页大小/故障图片等原始结果；build8重置831.6ms旧失败保留，不与新版结果混用。 |
| L3 | [acceptance-final/data-tools-build8-functional.json](acceptance-final/data-tools-build8-functional.json) | 20通过样本：检查/确认清理/迁移前确认/显式迁移空源。 |
| P1 | [acceptance-final/print-images-build11.json](acceptance-final/print-images-build11.json) | 新增5次、大图5次；6票首打1张、补打保持票数/2打印记录、部分打印。 |
| P2 | [acceptance-final/print-controls-build11.json](acceptance-final/print-controls-build11.json) | build11取消/未打印阻断/成功票选择/首打补打/整单；旧build8单个528.2ms作为诊断失败保留。 |
| P3 | [acceptance-final/label-qr-decode.json](acceptance-final/label-qr-decode.json) | 正常与1001边界QR软件识别；不代表纸面扫描。 |
| P4 | [acceptance-final/lan-build11.json](acceptance-final/lan-build11.json) | 5次局域网HTTP非secureContext身份、增票、打印。 |
| B1 | [acceptance-bag-lifecycle/hpb-scan-five-samples-build7.json](acceptance-bag-lifecycle/hpb-scan-five-samples-build7.json) | 20通过样本，实际HPB003打印、扫描、装袋、详情刷新。 |
| B2 | [acceptance-bag-lifecycle/lifecycle-five-samples-build7.json](acceptance-bag-lifecycle/lifecycle-five-samples-build7.json) | 80通过样本，三类重装、占用库位失败/重试、回收/报废、逐票守恒。 |
| B3 | [acceptance-bag-lifecycle/web-detail-five-samples-build7.json](acceptance-bag-lifecycle/web-detail-five-samples-build7.json) | 65通过样本，Web详情/刷新/11Tab与图片。历史Tab不等同历史打印。 |
| B4 | [acceptance-legacy-bags/preview-five-samples-build8.json](acceptance-legacy-bags/preview-five-samples-build8.json)<br>[README.md](README.md) | 45通过样本；首读0旧写、失败0实体/输入保留、保存仅自身两实体、刷新。 |
| S1 | [acceptance-final/source-core-final.json](acceptance-final/source-core-final.json) | 7+8+4核心与5动作：迁移/CAS/command/complete/失败/附件/禁LS。 |
| S2 | [acceptance-part-tickets/browser-eight-sources-final.txt](acceptance-part-tickets/browser-eight-sources-final.txt)<br>[acceptance-final/storage-extra-final.json](acceptance-final/storage-extra-final.json) | 8键记录迁移/校验/失败/禁LS；24unit，HPB核心容量/CAS。 |
| S3 | [acceptance-final/migration-final.json](acceptance-final/migration-final.json) | 共用裁后键/历史迁移，101/202条批量、中断/冲突/源变化/清理重试。 |
| S4 | [acceptance-final/upgrade-blocked-final.txt](acceptance-final/upgrade-blocked-final.txt) | 真实IDB blocked，注入下一schema=2、产品schema=1；关闭旧连接重试/原记录保留。 |
| S5 | [acceptance-final/backup-build11.json](acceptance-final/backup-build11.json)<br>[acceptance-final/mixed-backup-final.json](acceptance-final/mixed-backup-final.json)<br>[acceptance-final/files-final.json](acceptance-final/files-final.json) | build11新context五次恢复与错误备份不修改原库；另结合三类混装与Blob实体/引用校验。 |
| S6 | [acceptance-final/files-final.json](acceptance-final/files-final.json)<br>[acceptance-integration/check-file-lifecycle.js](acceptance-integration/check-file-lifecycle.js) | 9项Blob/引用/命令保护/并发/损坏备份/原子失败。 |
| R1 | [acceptance-final/core-final-7.log](acceptance-final/core-final-7.log) | 类型与历史回归专项；不能代替未执行的毛织/特殊工艺页面。 |
| R2 | [acceptance-final/routes-build12.json](acceptance-final/routes-build12.json)<br>[acceptance-final/routes-build15.json](acceptance-final/routes-build15.json) | 历史严格失败全部保留：build12装袋510.4ms，build15路线135样本有5慢样本（PDA简易3、袋列表2）；性能仍未过，等新基线build16修复后复验。 |
| R3 | [acceptance-source-ui-final/perf-build9.json](acceptance-source-ui-final/perf-build9.json) | 来源9路由135通过样本；修复build8 PDA接单613.1ms后的结果。 |
| C1 | [acceptance-final/business-boundaries-agent-r8.json](acceptance-final/business-boundaries-agent-r8.json) | 3/3通过：ORDER004、MAT006、MAT004/HAND011；上游明确Mock，实际打印/交出UI。 |
| C2 | [acceptance-final/bag-boundaries-agent-r10.json](acceptance-final/bag-boundaries-agent-r10.json)<br>[acceptance-final/boundary-evidence-notes.md](acceptance-final/boundary-evidence-notes.md)<br>[acceptance-final/history-route-unit.txt](acceptance-final/history-route-unit.txt)<br>[acceptance-final/bag-time-and-scope-after.txt](acceptance-final/bag-time-and-scope-after.txt) | 3/3真实UI通过：重复/跨袋/跨单；已装袋拒绝直交；回收旧票拒绝、新票新周期，以及选择旧周期实际打印保持原3页20片/5Yard/8米。 |
| C3 | [acceptance-final/reassignment-boundaries-r5.json](acceptance-final/reassignment-boundaries-r5.json) | 3/3通过：旧预览改派拒绝、已交历史保持、同taskId新厂需新独立票；最后一项上游来源明确Mock。 |
| C4 | [acceptance-final/batch-ui-boundaries-r5.json](acceptance-final/batch-ui-boundaries-r5.json) | 两场真实UI通过：未绑定换片布袋漏选阻断→扫描补齐同次交出；两袋已绑定同任务自动归集均被保留。 |
| M1 | [acceptance-final/marker-build11.json](acceptance-final/marker-build11.json)<br>[acceptance-final/profile-marker-build11-dev.txt](acceptance-final/profile-marker-build11-dev.txt)<br>[acceptance-final/profile-pda-bag-build12-dev.txt](acceptance-final/profile-pda-bag-build12-dev.txt)<br>[acceptance-final/factory-mobile-todo-count-unit.txt](acceptance-final/factory-mobile-todo-count-unit.txt) | 唛架613.5ms与PDA装袋510.4ms原失败保留；直接来源局部优化与等价契约已做；build15新增5慢样本，等待最后同版严格复验。 |
| P5 | [acceptance-final/label-managed-after.txt](acceptance-final/label-managed-after.txt) | 4/4核心：混装/纯换片布/非法量拒绝/禁旧存储原cycle；C2另补实际选择旧周期与页面点击打印。 |
| R4 | [acceptance-final/cutting-all-final.log](acceptance-final/cutting-all-final.log)<br>[acceptance-final/fcs-end-to-end-final.log](acceptance-final/fcs-end-to-end-final.log)<br>[acceptance-final/wool-e2e-final.log](acceptance-final/wool-e2e-final.log)<br>[acceptance-final/wool-final-r6.log](acceptance-final/wool-final-r6.log)<br>[acceptance-final/WOOL-CHECKER-FINAL.md](acceptance-final/WOOL-CHECKER-FINAL.md)<br>[acceptance-final/wool-initialization-probe-r5.json](acceptance-final/wool-initialization-probe-r5.json) | 裁床全链/FCS端到端通过，毛织独立服务E2E17/17、完整17个既有专项脚本r6 exit0；前置修正理由与未扩大存储范围见WOOL-CHECKER-FINAL。 |
| C5 | [acceptance-final/scope-empty-agent-r2.json](acceptance-final/scope-empty-agent-r2.json)<br>[acceptance-final/check-scope-empty-handover.js](acceptance-final/check-scope-empty-handover.js) | 2/2真实入口通过：三合一任务不支持且0写入；完整全朴材料集合显示无需换片布并交5票700片、0换片布/0回执。显式Mock仅准备来源。 |

## 失败与前置错误的区分

| 原始产物 | 判定 | 后续证据 |
| --- | --- | --- |
| `source-late-final.json` | 原始失败，错误fixture/hash | `source-late-final-r2.txt`八场景完成，不能误绑旧JSON |
| `simple-prerequisite-invalid-event-shape.higcut` | 明确标为无效前置，历史保留，不用于通过验收 | 当前`simple-prerequisite.higcut`及前置生成脚本；核对独立cut-complete事件 |
| `business-boundaries-agent-r5.json` | ORDER004/MAT006通过；MAT004/HAND011场景旧范围票失效，未过 | business-boundaries-agent-r8三场通过，保留r5失败 |
| `bag-boundaries-r3.json` | HAND009通过；跨单/原三类型Mock前置失败 | 不算产品缺陷修复证明，也不算被测边界通过 |
| `batch-ui-boundaries-r3.json` | 目标任务前置不出现在实际下拉，未进入提交 | batch-ui-boundaries-r5两场真实UI通过 |
| `reassignment-boundaries-first.json` | ORDER007通过；ORDER006 DOM超时、HAND012 PPIC身份前置失败 | reassignment-boundaries-r5三场通过，未绕过产品PPIC校验 |
| build3/5的FEI/PDA、build8的列重置/打印、build11/12冷启动 | 实际超时或产品输入/刷新缺陷，保留原失败 | 对应后续版本原始日志与最终影响审查，禁止挑快样本覆盖 |

## 复现说明

1. 使用归档对应源码manifest的仓库工作树，安装仓库锁文件指定依赖；真实图片来自仓库`public`，例如`public/shirt-sample.jpg`，不另造占位图。
2. 将本目录中的9个`acceptance-*`目录及顶层依赖复制回同结构的`output/playwright/hpb/`。脚本保留执行时的绝对工作树路径；在新路径复现时明确替换根目录，不改业务断言、500ms预算、计时终点和五样本规则。
3. 运行Vite dev43235或构建preview43236，按脚本要求使用隔离浏览器context。dev module-import脚本用于明确Mock前置/核心集成，不能用作构建版严格性能证据。
4. `acceptance-final/run-final-browser.py`、`run-chain-final.py`、`run-storage-final.py`及各子目录脚本记录实际命令。所用Playwright CLI为`@playwright/cli`的`run-code`（本机缓存路径在runner中）；新机器需设置实际CLI位置。Node专项使用`node --import tsx --test`，不得把JSON导入不兼容当业务失败。
5. `.higcut`文件为显式Mock备份，仅导入新建的隔离浏览器context；不得在用户业务浏览器中清库或导入覆盖。恢复页走真实按钮并等待读回提示。
6. 软件打印拦截只验证调用、选择确认、保存和身份。物理打印与扫码须补用户现场证据；本归档未声称这些动作已发生。
7. 性能采样时停止并行浏览器、构建及CPU测试，保留每个样本；功能诊断可并行但结果不得混入严格性能表。

## 待主代理补充

- 最终冻结源码manifest、构建编号及实际提交SHA。
- 最终routes/marker/简易Web-PDA/历史打印/来源页面受影响性能结果，逐个慢样本的处置。
- ORDER/MAT/HAND/BAG剩余边界的真实scene结果与Mock前置说明。
- 最新全量build、相关unit/governance检查日志；既有六处tsc错误的最终对比。
- 92条正反向语义审查、D04现场接受、main/GitHub/部署发布核对（如执行）。

## 本轮归档后收到的新结果

- [改派边界r5](acceptance-final/reassignment-boundaries-r5.json)：3/3通过，原前置失败保留。
- [业务边界r8](acceptance-final/business-boundaries-agent-r8.json)：3/3通过，包括同名不同身份及同任务新增需料。
- [袋边界agent-r5](acceptance-final/bag-boundaries-agent-r5.json)：前两组通过，历史周期打印仍timeout。
- [原cycle打印契约](acceptance-final/label-managed-after.txt)：4/4通过，修复前失败见label-managed-before.txt。
- 最终统一构建改为build14待冻结；上面build13待验描述为初稿时点，不能当作最终版本通过。

## 存储范围登记补充

| 业务对象 | 旧键 | 当前记录/动作及验证入口 |
| --- | --- | --- |
| 用户生产单 | `higood.formal-created-production-orders.v1` | production-context按单；生成/拆解与来源动作；S1、D7 |
| 任务运行覆盖 | `higood.runtime-process-task-actions.v1` | 按覆盖/拆合/改派事实；同库source action；S1、D7 |
| 有效分配 | `higood.effective-task-assignments.v2` | 按assignment；派单/定标/接单；S1、D1/D7 |
| 样衣与关联照片 | `higood:sewing-sample-approval:v3` | 按业务记录及Blob引用；接收/移交；S1/S6、D7 |
| 合同及扫描件 | `higood:fcs:production-contracts:v2` | 按合同及Blob引用；分配/合同确认；S1/S6、D7 |
| 分配关联事实 | `higood.production-assignment-effects.v1` | 按effect；定标/工厂结束等来源动作；S1、D7 |
| PPIC责任 | `higood.sewing-task-responsibility-transfers.v1` | 按责任实体；移交及历史；S1、D7 |
| 8类部位票/唛架/旧袋来源 | 全键及12类袋实体见[部位来源说明](acceptance-part-tickets/README.md) | 同库part-ticket逐ID；S2、D6、B4；正常读取不复制种子 |
| 裁后管理事件/旧裁片领料历史 | `cuttingRuntimeEventLedger`及已登记裁片领料共享源 | 管理类型分记录；共享键保留其他类型；S3 |
| 合同/样衣附件 | 原Base64附件随上述7来源登记 | 转原始Blob、实体元数据及引用；引用/命令保护、确认清理、备份完整恢复；S6 |

所有入口清单与事务参与者见[来源动作登记](acceptance-storage-core/ACTION-INTEGRATION.md)及[部位来源登记](acceptance-part-tickets/README.md)。普通页面不自动迁移；明确迁移失败保留源项并提供重试。无文件功能的新换片布标签沿用静态图片，不虚构用户上传场景。

- [真实双袋r5](acceptance-final/batch-ui-boundaries-r5.json)：两场通过，包含未选袋缺项/补扫以及绑定双袋自动归集；原r3前置错误保留。
- [裁床全链](acceptance-final/cutting-all-final.log)、[FCS端到端](acceptance-final/fcs-end-to-end-final.log)、[毛织独立服务E2E](acceptance-final/wool-e2e-final.log)：实际结果通过；正在运行的毛织r4不提前判通过。
- 主代理现计划build15统一验收（另含重装/回收/报废本地时间修复），旧build13/14计划保留为时点记录。

## 当前冻结和剩余门禁（以此节更新前述历史时点）

- build15源指纹与566/566构建结果已归档；routes-build15五个慢样本保留，仍不能通过性能门禁。当前分支已快进同事main图标提交5ba80551；build15依旧属于3a基线，新build16结果待主代理，不回填改名。
- C2 r10、C3 r5、C4 r5、C5 r2关闭最后功能边界；不再追加没有新风险的重复UI。92条状态仍保留最终性能/版本联审前的开放值；PRINT001/002物理纸票D04继续外部待确认。
- [源码与证据适用边界](source-evidence-compatibility.md)逐组说明历史证据可复用内容、散列差异与不能推定的部分。
- governance-doc-update-r2通过110受管文件；完整17个毛织专项r6 exit0。列表模板契约明确偏好不可读可默认、业务不可读须报告，最终listgov/workflow/发布核对由主代理绑定。

## build16 检查结果（浏览器严格验收仍进行中）

- [源码manifest](acceptance-final/source-build16.json)：基线 `5ba805510f3cf70339db6e3ddd072b9c5d255a01`，源码指纹 `153133af8f6e8db5e5b340de9af9dca7e8aae232478e448512c4b1dda762cf48`。build15仍保留旧基线，不改名混用。
- [列表治理r3](acceptance-final/list-governance-final-r3.log)通过。r2复用已缓存模块未触发首次业务读取，断言失败原样保留；r3使用独立query import触发真实首次读取。偏好默认回退与业务不可读必须报错两项同时保留，未改业务源行为。
- [workflow r2](acceptance-final/workflow-final-16-r2.log)全部通过，566单元、Vite10.71秒；[任务收据](acceptance-final/task-receipt-final-16.json)状态verified、blockers为空，CodeGraph pending137→0。该收据对应生成时点的差异；后续文档和证据收口后主代理应更新最终收据。
- [浏览器会话清点](acceptance-final/browser-inventory-pre16.txt)保留root测试session遗留9个context（含dev HMR）的事实；仅关闭该测试session，其他独立诊断窗口另记。旧慢样本不因此删除或改判，新build16完整严格结果仍须实际完成。
- root当前串行执行部位票155、来源动作90、唛架、三类袋、双袋等最终范围；此刻不预判通过，不改变92条状态。

### build16 历史周期打印慢样本与 build17 修复

真实旧周期打印五个样本耗时631–666ms，未满足500ms门禁；原始web-detail-build16和profile-history-goods-build16保留。profile定位到打印注册表加载47个无关模块，并产生约582ms同步来源初始化。

唯一源修改为src/pages/print/print-preview.ts的loadPrintAdapter：TRANSFER_BAG_LABEL、TRANSFER_BAG_GOODS_LABEL与部位票一起直接调用既有label模板builder和renderer，保持原registry使用的同一标签构造与渲染行为，避免加载无关生产确认来源。实际历史身份/三页/数量仍需在build17原场景复验，不能仅凭加载数降低判通过。

build16此前已执行的部位票155、路由135、列表、打印控制、唛架、简易交出通过结果保留；本次打印公共入口已变，build17安排完整严格重跑。92条状态不变，BAG010/011、PERF001/002及所有关联页面未提前置绿，D04现场结果仍开放。

### build18 图片打印门禁补漏（待验）

在同一历史货物标识真实打印入口进一步验证图片损坏时，发现仍调用打印：goods-image-failure-before记录printedWithBrokenImage=1。此前三类内容/数量正确或大图能打开，不能证明打印前已检查图片完整性；这是实际图片门禁遗漏，失败原样保留。

本次直接相关修改共两文件：print-preview.ts复用prepareVerifiedDocumentPrint，在货物标识图片缺失或加载失败时阻断打印/PDF；label-print-template.ts为面料图片增加已有frame、加载状态、失败提示、重试与大图节点。货物标识原本没有条码，不凭空要求它提供条码；TMF签名模块仅在页面存在签名节点时加载，原签名校验规则保留。上述措施不得被描述为现场实物打印已通过。

check-web-detail-final新增五轮真实打印/PDF调用、面料大图及三种关闭方式、图片故障阻断、重试后复打。build18正在生成，最终原场景、相邻打印及性能结果待绑定；BAG010/011、UX002/003、PRINT004/005与PERF相关条目仍开放。除两处打印相关源码，本次未追加其他业务源修改。

### build19 图片失败反馈性能修正（待严格结果）

build18增强web-detail五轮功能全部通过，但坏图打印阻断反馈一个样本514.2ms，其余约498ms，严格性能仍未过；web-detail-build18原始结果保留，不挑选通过样本。当时将慢反馈归因为打印动作自动重试已坏图片，这一归因并不完整，已由build20后续profile修正（见build21补充）。货物标识打印立即提示图片错误、通过明确“重试图片”恢复的规则继续保留；该规则本身不能解释或证明所有慢样本已修复。

build19构建566单元通过、Vite10.31秒，source-build19源码指纹5c4e3db5f45d60c785ba470e64381c99b84bfebaa635c125c0cde9160f697c29。先重放五轮增强detail，再执行完整严格范围；尚未收到最终结果，矩阵不变更通过状态。该记录暂只更新版本和失败原因，最终产物统一归档，避免在严格窗口反复复制。

### build19 全轮结果与最后两个性能阻塞

build19完整范围已实际执行：除下述两个性能点，其余全部通过。部位票155、主链135、来源路由135、来源七组动作、列表/打印/唛架/简易交出/袋生命周期均有真实通过结果；增强web-detail110样本全部低于500ms，图片故障阻断、三种大图关闭、重试后打印均通过。

1. batch-ui十轮开交出窗口稳定1396–1671ms；十轮业务动作与持久结果均通过，但开窗仍违反性能门禁。待独立profile无用全量票、specialReturns及PPIC计算后最小修复。
2. HPB扫描20样本首轮PDA详情冷启动501.2ms，其余19样本通过；首轮不得丢弃或用后续快样本抵消。

build18坏图反馈514.2ms、build19开窗及HPB冷启动失败原样保留。最终build20计划中，仍不变更矩阵为已验证。最后所有文档与证据冻结后由主代理运行workflow绑定最终diffHash；最终任务收据只留output，不复制回tracked归档，避免收据内容改变自身所证明的差异。

### build20 已完成的定向阻塞复验（完整余下范围仍待）

source-build20：5ba基线，源码指纹938ea5a327c5b1fdd333d5407ba42c4c17efeb53ac5d5a4648ae979e01983231；566单元通过、Vite10.17秒。原build19开窗慢样本及独立profile保留。源修复只增加main对精确待交出路由直接分发原warehouse handler，并使wait-actions按当前action计算所需model，保留现有动作资格；相关专项20+266通过。

已完成定向严格结果：batch-ui120样本最大233.6ms，其中10次开窗64.3–80.6ms；wait-dialogs30样本最大400ms；HPB扫描20样本最大213.2ms。两处旧阻塞及同页袋弹窗定向复验通过。完整余下build20范围仍在串行执行，因此此时不把整个矩阵置绿。

最终预备状态为90条已验证、PRINT001/002因D04用户现场结果缺失保持外部阻塞；须等待主代理确认完整范围全部通过才实际执行状态修改。外部未收到的实物结果不可用软件测试或代理接受替代。

### build21：以实际profile修正坏图反馈慢样本归因

build20增强web-detail坏图反馈再次出现515.9ms。profile-goods-image-failure-build20-r2测得坏图条件处理33.1ms、整个点击66.1ms，而前一次大图Esc触发约445ms longtask：浏览器调用栈包含cut-orders模块加载、cut-order-supplement-fixture及production-object-overview。

实际根因是统一打印图片大图在document冒泡阶段处理Esc但未停止传播；main的全局closeDialogsOnEscape同时启动FCS全模块加载，后台CPU影响了下一次点击。此前把接近500ms归因为图片自动重试是不完整推断；以本次真实调用栈修正，不删除先前失败。

唯一新增源修改在print-preview.ts：图片overlay存在且收到Escape时，通过document capture处理并preventDefault、stopPropagation，阻断无关全局关闭处理；其他按键与非图片弹窗行为不改。显式图片重试保留为独立、合理的恢复规则。check-web-detail-final新增五次Esc严格测量，采用window capture记录起点，避免遗漏捕获阶段耗时。

build21正在构建；build20截至简易交出的其余范围已通过，后半范围尚未执行，不能称build20全套通过。待build21新的原始样本，矩阵状态仍保持开放，最终归档统一更新。

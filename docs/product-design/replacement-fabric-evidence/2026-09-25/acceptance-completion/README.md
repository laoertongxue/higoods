# 换片布菲票软件技术验收归档

## 当前结论

build21软件技术验收关闭：**90条已验证，PRINT001/002因D04现场确认缺失为2条外部已阻塞**。产品实物及accepted没有被替代。单浏览器原型的Mock结果不表示真实工厂业务发生，也不是云端共享系统。

- 基线`5ba805510f3cf70339db6e3ddd072b9c5d255a01`，分支codex/replacement-fabric-acceptance-20260925，工作树/private/tmp/higoods-replacement-fabric-release-20260925；preview43236。
- [source-build21](acceptance-final/source-build21.json)：1240个src，指纹`04165095824efc064c2e26ef942150c79e1b17f814c2e886ddf7346a0f2f0913`，主代理逐项确认与当前一致。
- [严格汇总](acceptance-final/strict-summary-build21.json)：28组全部通过，1280计时样本、最大463ms、issues=[]。[28组场景矩阵](scenario-matrix-build21.md)区分计时与纯功能组。
- [构建](acceptance-final/build-final-21.log)566/566单元、Vite9.99秒；[tsc](acceptance-final/tsc-final-21.log)仅6个既有基线错误，不称全库类型检查通过。
- [逐项证据](matrix-boundaries.md)、[92条状态](status-readiness.md)、[规范章节正反追踪](requirements-trace.md)、[受管文件](governed-files.md)、[源码证据边界](source-evidence-compatibility.md)可联查。
- 最后workflow须在文档/证据冻结后由主代理执行，预期output/playwright/hpb/acceptance-final/task-receipt-final-frozen.json；不预判通过，不复制最终收据进tracked造成diffHash循环。main/GitHub发布另行核对。

## 软件闭环与外部边界

真实分配/改派、资料缺失/完整空集、同名不同料、新增需料、两工厂、同taskId换厂、三合一排除、多袋并集与自动归集、重复/跨单/占用、回收旧票拒绝、新票新周期、旧周期原3页与数量均有真实入口证据；纯非法参数/确定性身份用核心契约补证，不制造不存在的反向UI。最新build21重新跑全部命名场景，不依靠旧版成功拼接为最终性能通过。

7类生产来源、8票来源、管理事件与Blob按实体同库事务，complete后发布；迁移显式分批读回后清理，共用键保留其他模块。HPB/部位票打印/已迁移交出禁全部localStorage通过。唛架完整库存保留未迁移收料，只禁15个已迁移键；不声称全站脱离localStorage。

D04：100×100mm是原型标签规格。现场打印机/耗材、实际出纸、纸面可读性与扫描尚未收到用户结果；PRINT001/002已阻塞。PDF、window.print及程序扫码串不能充当实物结果或产品accepted。

## 证据索引

| 索引 | 原始产物 | 事实与边界 |
| --- | --- | --- |
| U1 | [acceptance-final/core-final-7.log](acceptance-final/core-final-7.log) | 核心84/84中的票身份、5Yard、改派、并集、任务/工厂、空集；不代替UI。tests路径从仓库根起。 |
| U2 | [acceptance-final/core-final-7.log](acceptance-final/core-final-7.log) | SKU需料、朴、同名身份、颜色映射、历史数量与回执。 |
| U3 | [acceptance-final/binding-strip-final.txt](acceptance-final/binding-strip-final.txt) | 捆条/部位契约和混装标签；非物理打印。 |
| D1 | [acceptance-source-ui-final/actions-build7.json](acceptance-source-ui-final/actions-build7.json) | 真分配→3初始票→增票→真改派→移出/历史失效，5组。 |
| D2 | [acceptance-final/roles-build21.json](acceptance-final/roles-build21.json) | 实际Web/PDA角色禁用与说明。 |
| D3 | [acceptance-final/two-factories-final.json](acceptance-final/two-factories-final.json)<br>[check-two-factories.js](check-two-factories.js) | UI交出700片+1票、200片+0票、另任务另厂720片+第2票；前置/后续裁剪用显式Mock，dev单轮功能。 |
| D4 | [acceptance-final/simple-disabled-final.json](acceptance-final/simple-disabled-final.json)<br>[acceptance-final/simple-pda-build10.json](acceptance-final/simple-pda-build10.json)<br>[acceptance-final/simple-handover-build21.json](acceptance-final/simple-handover-build21.json) | 禁全LS直接交出功能；PDA build10五组有结果 |
| D5 | [acceptance-final/mixed-backup-final.json](acceptance-final/mixed-backup-final.json) | 多袋缺项/并集是内部业务函数集成调用；Web/PDA三类型详情是真实页面；不是完整待交出按钮验收。 |
| D6 | [acceptance-part-tickets/performance-build7.json](acceptance-part-tickets/performance-build7.json)<br>[README.md](README.md) | 155/155，FEI/打印/铺布/PDA依赖；6独立事件、2卷、200米/6900量、失败重试；不替代HPB特定业务边界。 |
| D7 | [acceptance-source-ui-final/generation-build8.json](acceptance-source-ui-final/generation-build8.json) | 真实来源生成/拆解/分配/定标/合同/样衣/责任/接单/开工；每项前置与失败保留见脚本。 |
| D8 | [acceptance-final/history-print-build21.json](acceptance-final/history-print-build21.json) | 已交票补打、禁LS、receipt不变、票数不变。未实施改派、回收或再次交出。 |
| L1 | [acceptance-final/list-actions-build21.json](acceptance-final/list-actions-build21.json) | build11完整列表交互与尺寸的原始结果。 |
| L2 | [acceptance-final/extra-controls-build21.json](acceptance-final/extra-controls-build21.json) | build11列冻结/拖拽/页大小/故障图片等原始结果；build8重置831.6ms旧失败保留，不与新版结果混用。 |
| L3 | [acceptance-final/data-tools-build21.json](acceptance-final/data-tools-build21.json) | 20通过样本：检查/确认清理/迁移前确认/显式迁移空源。 |
| P1 | [acceptance-final/print-images-build21.json](acceptance-final/print-images-build21.json) | 新增5次、大图5次；6票首打1张、补打保持票数/2打印记录、部分打印。 |
| P2 | [acceptance-final/print-controls-build21.json](acceptance-final/print-controls-build21.json) | build11取消/未打印阻断/成功票选择/首打补打/整单；旧build8单个528.2ms作为诊断失败保留。 |
| P3 | [acceptance-final/label-qr-decode.json](acceptance-final/label-qr-decode.json) | 正常与1001边界QR软件识别；不代表纸面扫描。 |
| P4 | [acceptance-final/lan-build21.json](acceptance-final/lan-build21.json) | 5次局域网HTTP非secureContext身份、增票、打印。 |
| B1 | [acceptance-bag-lifecycle/hpb-scan-five-samples-build7.json](acceptance-bag-lifecycle/hpb-scan-five-samples-build7.json) | 20通过样本，实际HPB003打印、扫描、装袋、详情刷新。 |
| B2 | [acceptance-bag-lifecycle/lifecycle-five-samples-build7.json](acceptance-bag-lifecycle/lifecycle-five-samples-build7.json) | 80通过样本，三类重装、占用库位失败/重试、回收/报废、逐票守恒。 |
| B3 | [acceptance-bag-lifecycle/web-detail-five-samples-build7.json](acceptance-bag-lifecycle/web-detail-five-samples-build7.json) | 65通过样本，Web详情/刷新/11Tab与图片。历史Tab不等同历史打印。 |
| B4 | [acceptance-legacy-bags/preview-five-samples-build8.json](acceptance-legacy-bags/preview-five-samples-build8.json)<br>[README.md](README.md) | 45通过样本；首读0旧写、失败0实体/输入保留、保存仅自身两实体、刷新。 |
| S1 | [acceptance-final/source-core-final.json](acceptance-final/source-core-final.json) | 7+8+4核心与5动作：迁移/CAS/command/complete/失败/附件/禁LS。 |
| S2 | [acceptance-part-tickets/browser-eight-sources-final.txt](acceptance-part-tickets/browser-eight-sources-final.txt)<br>[acceptance-final/storage-extra-final.json](acceptance-final/storage-extra-final.json) | 8键记录迁移/校验/失败/禁LS；24unit，HPB核心容量/CAS。 |
| S3 | [acceptance-final/migration-final.json](acceptance-final/migration-final.json) | 共用裁后键/历史迁移，101/202条批量、中断/冲突/源变化/清理重试。 |
| S4 | [acceptance-final/upgrade-blocked-final.txt](acceptance-final/upgrade-blocked-final.txt) | 真实IDB blocked，注入下一schema=2、产品schema=1；关闭旧连接重试/原记录保留。 |
| S5 | [acceptance-final/backup-build21.json](acceptance-final/backup-build21.json)<br>[acceptance-final/mixed-backup-final.json](acceptance-final/mixed-backup-final.json)<br>[acceptance-final/files-final.json](acceptance-final/files-final.json) | build11新context五次恢复与错误备份不修改原库；另结合三类混装与Blob实体/引用校验。 |
| S6 | [acceptance-final/files-final.json](acceptance-final/files-final.json)<br>[acceptance-integration/check-file-lifecycle.js](acceptance-integration/check-file-lifecycle.js) | 9项Blob/引用/命令保护/并发/损坏备份/原子失败。 |
| R1 | [acceptance-final/core-final-7.log](acceptance-final/core-final-7.log) | 类型与历史回归专项；不能代替未执行的毛织/特殊工艺页面。 |
| R2 | [acceptance-final/routes-build21.json](acceptance-final/routes-build21.json)<br>[acceptance-final/routes-build15.json](acceptance-final/routes-build15.json) | 历史build12/15失败保留；最终冷启动/刷新/导航以routes-build21及source-routes-build21实际严格结果关闭。 |
| R3 | [acceptance-source-ui-final/perf-build9.json](acceptance-source-ui-final/perf-build9.json) | 来源9路由135通过样本；修复build8 PDA接单613.1ms后的结果。 |
| C1 | [acceptance-final/business-boundaries-agent-r8.json](acceptance-final/business-boundaries-agent-r8.json) | 3/3通过：ORDER004、MAT006、MAT004/HAND011；上游明确Mock，实际打印/交出UI。 |
| C2 | [acceptance-final/bag-boundaries-agent-r10.json](acceptance-final/bag-boundaries-agent-r10.json)<br>[acceptance-final/boundary-evidence-notes.md](acceptance-final/boundary-evidence-notes.md)<br>[acceptance-final/history-route-unit.txt](acceptance-final/history-route-unit.txt)<br>[acceptance-final/bag-time-and-scope-after.txt](acceptance-final/bag-time-and-scope-after.txt) | 3/3真实UI通过：重复/跨袋/跨单；已装袋拒绝直交；回收旧票拒绝、新票新周期，以及选择旧周期实际打印保持原3页20片/5Yard/8米。 |
| C3 | [acceptance-final/reassignment-boundaries-r5.json](acceptance-final/reassignment-boundaries-r5.json) | 3/3通过：旧预览改派拒绝、已交历史保持、同taskId新厂需新独立票；最后一项上游来源明确Mock。 |
| C4 | [acceptance-final/batch-ui-boundaries-r5.json](acceptance-final/batch-ui-boundaries-r5.json) | 两场真实UI通过：未绑定换片布袋漏选阻断→扫描补齐同次交出；两袋已绑定同任务自动归集均被保留。 |
| M1 | [acceptance-final/marker-build11.json](acceptance-final/marker-build11.json)<br>[acceptance-final/profile-marker-build11-dev.txt](acceptance-final/profile-marker-build11-dev.txt)<br>[acceptance-final/profile-pda-bag-build12-dev.txt](acceptance-final/profile-pda-bag-build12-dev.txt)<br>[acceptance-final/factory-mobile-todo-count-unit.txt](acceptance-final/factory-mobile-todo-count-unit.txt) | 旧唛架613.5/装袋510.4失败与profile保留；最终marker-build21及hpb-scan-build21全部通过。 |
| P5 | [acceptance-final/label-managed-after.txt](acceptance-final/label-managed-after.txt) | 4/4核心：混装/纯换片布/非法量拒绝/禁旧存储原cycle；C2另补实际选择旧周期与页面点击打印。 |
| R4 | [acceptance-final/cutting-all-final.log](acceptance-final/cutting-all-final.log)<br>[acceptance-final/fcs-end-to-end-final.log](acceptance-final/fcs-end-to-end-final.log)<br>[acceptance-final/wool-e2e-final.log](acceptance-final/wool-e2e-final.log)<br>[acceptance-final/wool-final-r6.log](acceptance-final/wool-final-r6.log)<br>[acceptance-final/WOOL-CHECKER-FINAL.md](acceptance-final/WOOL-CHECKER-FINAL.md)<br>[acceptance-final/wool-initialization-probe-r5.json](acceptance-final/wool-initialization-probe-r5.json) | 裁床全链/FCS端到端通过，毛织独立服务E2E17/17、完整17个既有专项脚本r6 exit0；前置修正理由与未扩大存储范围见WOOL-CHECKER-FINAL。 |
| C5 | [acceptance-final/scope-empty-agent-r2.json](acceptance-final/scope-empty-agent-r2.json)<br>[acceptance-final/check-scope-empty-handover.js](acceptance-final/check-scope-empty-handover.js) | 2/2真实入口通过：三合一任务不支持且0写入；完整全朴材料集合显示无需换片布并交5票700片、0换片布/0回执。显式Mock仅准备来源。 |
| G1 | [acceptance-final/source-build16.json](acceptance-final/source-build16.json)<br>[acceptance-final/list-governance-final-r3.log](acceptance-final/list-governance-final-r3.log)<br>[acceptance-final/workflow-final-16-r2.log](acceptance-final/workflow-final-16-r2.log)<br>[acceptance-final/task-receipt-final-16.json](acceptance-final/task-receipt-final-16.json) | 历史build16治理/收据结果，只对应生成时点；最终冻结workflow预期output/task-receipt-final-frozen.json，待主代理执行，不复制进tracked。 |
| P6 | [acceptance-final/web-detail-build16.json](acceptance-final/web-detail-build16.json)<br>[acceptance-final/profile-history-goods-build16.json](acceptance-final/profile-history-goods-build16.json) | build16历史标签631–666失败/profile保留；直达既有模板后最终web-detail-build21严格通过。 |
| P7 | [acceptance-final/goods-image-failure-before.json](acceptance-final/goods-image-failure-before.json)<br>[acceptance-final/goods-image-failure-before.txt](acceptance-final/goods-image-failure-before.txt) | 旧坏图仍打印失败保留；verified打印门禁与显式重试、Esc事件传播修复后web-detail-build21增强115样本全部通过。 |
| R5 | [acceptance-final/source-build20.json](acceptance-final/source-build20.json)<br>[acceptance-final/batch-ui-build20.json](acceptance-final/batch-ui-build20.json)<br>[acceptance-final/wait-dialogs-build20.json](acceptance-final/wait-dialogs-build20.json)<br>[acceptance-final/hpb-scan-build20.json](acceptance-final/hpb-scan-build20.json)<br>[acceptance-final/profile-open-handover-build19.json](acceptance-final/profile-open-handover-build19.json)<br>[acceptance-final/open-handover-conditional-unit.txt](acceptance-final/open-handover-conditional-unit.txt) | build20修复后的定向结果保留；最终同版batch-ui-build21/wait-dialogs-build21/hpb-scan-build21全部通过。 |
| F21 | [acceptance-final/source-build21.json](acceptance-final/source-build21.json)<br>[acceptance-final/strict-summary-build21.json](acceptance-final/strict-summary-build21.json)<br>[scenario-matrix-build21.md](scenario-matrix-build21.md)<br>[acceptance-final/build-final-21.log](acceptance-final/build-final-21.log)<br>[acceptance-final/tsc-final-21.log](acceptance-final/tsc-final-21.log) | 最终源码1240逐项一致；28组/1280计时/max463/issues[]；566单元+Vite9.99。独立tsc仅6个旧基线错误。软件技术关闭，D04两条外部阻塞。 |

## 失败和根因演进保留

[完整迭代历史](iteration-history.md)是各build当时记录，其中“当前/待验”不代表本版状态。原始失败/无效前置均保留，不删慢样本、不提高500ms预算。

- 旧source-late错误fixture/hash、改派PPIC身份前置、双袋任务匹配前置分别由r2/r5等明确修正，不把未进入动作的失败当通过。
- build11唛架613.5、build12装袋510.4、build15五慢样本、build16历史标签631–666、build18坏图514.2、build19开窗1396–1671/HPB501.2、build20坏图515.9均保留。
- 真实坏图仍调用打印1次是门禁遗漏，已补图片状态、verified打印阻断与显式重试；对接近500ms仅归因自动重试是不完整推断。build20实际profile发现前Esc约445ms长任务进入全局FCS模块加载，build21仅图片overlay捕获Esc并停止传播，新增五次window-capture计时及随后反馈验证：Esc34.1–40.5ms、坏图反馈62.8–65.5ms；增强web-detail115最大158.1ms。
- 精确待交出路由直接调用原handler，wait-actions只算当前action需要的model；资格/数量不减少。最终batch120、wait-dialogs30通过。
- 旧测试session的9个context清点保留，只关闭本测试session；最终28组串行严格运行，诊断样本不混作性能结果。

## 存储范围登记


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

## 复现说明


1. 使用归档对应源码manifest的仓库工作树，安装仓库锁文件指定依赖；真实图片来自仓库`public`，例如`public/shirt-sample.jpg`，不另造占位图。
2. 将本目录中的9个`acceptance-*`目录及顶层依赖复制回同结构的`output/playwright/hpb/`。脚本保留执行时的绝对工作树路径；在新路径复现时明确替换根目录，不改业务断言、500ms预算、计时终点和五样本规则。
3. 运行Vite dev43235或构建preview43236，按脚本要求使用隔离浏览器context。dev module-import脚本用于明确Mock前置/核心集成，不能用作构建版严格性能证据。
4. `acceptance-final/run-final-browser.py`、`run-chain-final.py`、`run-storage-final.py`及各子目录脚本记录实际命令。所用Playwright CLI为`@playwright/cli`的`run-code`（本机缓存路径在runner中）；新机器需设置实际CLI位置。Node专项使用`node --import tsx --test`，不得把JSON导入不兼容当业务失败。
5. `.higcut`文件为显式Mock备份，仅导入新建的隔离浏览器context；不得在用户业务浏览器中清库或导入覆盖。恢复页走真实按钮并等待读回提示。
6. 软件打印拦截只验证调用、选择确认、保存和身份。物理打印与扫码须补用户现场证据；本归档未声称这些动作已发生。
7. 性能采样时停止并行浏览器、构建及CPU测试，保留每个样本；功能诊断可并行但结果不得混入严格性能表。


## 归档完整性

本目录仅复制本任务9个acceptance目录与脚本所需顶层依赖，包含最终结果/脚本及所有已产生的历史失败；未复制整个output、未访问外部测试数据库。archive-manifest.json记录文件字节与SHA256，只证明归档完整性，不代替source-build21源码manifest。最终冻结收据保留output；历史build16收据明确仅为当时结果。

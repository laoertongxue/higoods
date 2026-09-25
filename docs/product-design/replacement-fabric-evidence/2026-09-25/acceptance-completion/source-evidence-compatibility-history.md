# 历史源码比较（各时点）

以下build15/16等比较均是历史事实，不作为当前待验结论。

# 源码与历史证据适用边界

此表是按已归档散列逐文件比较形成的影响登记，不把旧测试文件名中的final当作最终版证明。build15对应3a3d164；当前快进的5ba80551只涉及同事菜单图标，后续build16仍须绑定自身manifest与严格结果。

build15源码：1240个文件，`caf6a5126cc915a19994bb897f9715eb5ff4eab8de55598639071894100af998`。

## 实际散列差异

### build7 → build15

旧manifest仅记录部分文件；可比较src共101个，91个相同，10个变化。未列入旧manifest的源文件无从据此判断，不能扩大为全src相同。

- `src/data/fcs/cutting/handover-orders.ts`
- `src/data/fcs/cutting/production-material-prep.ts`
- `src/data/fcs/cutting/replacement-fabric-repository.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/production-orders.ts`
- `src/main.ts`
- `src/pages/pda-cutting-transfer-bag-repack.ts`
- `src/pages/pda-task-receive.ts`
- `src/pages/process-factory/cutting/transfer-bags/handlers.ts`

### build8 → build15

旧manifest仅记录部分文件；可比较src共102个，94个相同，8个变化。未列入旧manifest的源文件无从据此判断，不能扩大为全src相同。

- `src/data/fcs/cutting/production-material-prep.ts`
- `src/data/fcs/cutting/replacement-fabric-repository.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/main.ts`
- `src/pages/pda-cutting-transfer-bag-repack.ts`
- `src/pages/pda-task-receive.ts`
- `src/pages/process-factory/cutting/transfer-bags/handlers.ts`

### 部位票专用源清单

`acceptance-part-tickets/source-hashes.txt`列出的27个src文件与build15逐项完全一致；变化0个。此清单以part编码、来源、FEI打印及直接铺布页为中心，不包含全部共享运行入口。

## 按事实复用

| 证据组 | 可以支持的事实 | 最后版本的约束 |
| --- | --- | --- |
| D6/S2 部位票155样本、8源迁移 | 27个专用src散列一致；FEI真实首打身份、手工票保存、两卷6事件、事务中止恢复与按实体迁移事实可复用 | main及共享备料/顶栏等有变化，旧155性能不能直接称build16性能；最新命名路由与受影响入口须统一严格复验 |
| D1/D7 生产来源真实动作 | 保留明确Mock前置下的真实生成/拆解/分配/定标/合同/样衣/责任/接单/开工、失败与重试结果 | build7/8部分源hash有变化，应以现有源码对应动作契约、build15 566单元和source-late-r2补证；build9 manifest没有完整src散列，不编造等同性 |
| B1/B2/B3 旧袋、混装、详情 | 各旧结果支持当时三类型显示、逐票守恒、数量不混计等直接功能 | 时间、scope、历史打印路由已变化，必须结合C2 r10、history-route1/1、time-and-scope2/2、P5 4/4；新性能不得仅用旧build7 |
| C1/C3/C4/C5 最新功能边界 | 同名A/B、历史A+新增B、两袋自动归集/漏选、旧预览改派、同taskId新厂、三合一及全朴交出 | dev真实UI功能结果，不计严格构建性能；Mock仅用于明确上游前置，不伪造打印/交出结果 |
| S1/S3/S4/S5/S6 存储核心 | 事务complete、CAS、迁移中断/冲突/清理、共享键保留、Blob引用、备份恢复与blocked实际事实 | 覆盖登记7+8来源及管理事件；唛架未迁移收料库存仍如实读取，不能作全站LS禁用承诺 |
| L/P 列表、图片和软件打印 | build11真实选择/取消/首打/补打/部分确认与二维码软件解码 | 共享入口末改须复验性能；软件PDF和window.print不能替代D04物理出纸/扫码 |
| R4 既有链回归 | 裁床/FCS端到端、毛织E2E17/17及17脚本r6实际通过 | 毛织基线先完成其原有惰性静态投影是前置修正；见独立probe，不声明未迁移模块已治理 |

## 失败记录不可覆盖

build3/5、build8列重置831.6ms/打印528.2ms、build11唛架613.5ms、build12装袋510.4ms、build15五个路线慢样本均保留。夹具不符合来源身份的失败与真实产品失败分别说明。最后构建未通过前，不将旧成功样本拼接成“全量最终通过”。

## build16 冻结补充

新manifest记录5ba基线及153133af8f6e8db5e5b340de9af9dca7e8aae232478e448512c4b1dda762cf48。此时不重新扫描源码或运行检查，以保持root独占严格窗口。root安排完整同版浏览器重验，完成后以其原始结果替换“待最后性能”判断；上述build7/8→15比较仍是历史事实，不擅自改成build16等同性。

## build17 待验影响

build16历史标签五次631–666ms实际失败后，print-preview.ts的loadPrintAdapter新增两种中转袋标签的直接模板选择。此前“part专用27文件与build15全等”的表述仍只针对build15；不得据此推定build17同样全等。build17将完整重跑，包含部位票、袋历史和打印相关入口。旧版成功与失败均保留原编号。

## build18 新增受影响边界

真实货物标识图片损坏仍调用打印的失败补证后，print-preview.ts和label-print-template.ts均有直接相关修改。此前build16/17任何图片正常加载或软件打印成功证据不能替代故障阻断门禁；build18新增五轮打印/PDF、三种大图关闭和图片失败恢复，实际结果尚待归档。两文件原已在110个受管文件中，不把本次补漏扩展为新的业务范围。

## build21 影响边界

print-preview.ts仅修图片overlay的Escape事件传播，捕获阶段拦截防止全局关闭处理加载无关FCS模块；通过实际profile纠正build19对自动重试的部分归因。必须复验大图Esc本身及后续打印反馈；新五次Esc从window capture计时，不以处理器内部短耗时代替完整交互。build20后半未执行，历史证据不得改标全套通过。

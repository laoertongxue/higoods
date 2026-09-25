# 92条最终证据与边界

build21软件技术验收关闭，90条已验证；PRINT001/002外部现场已阻塞。每条结合原核心/边界证据及build21完整同版入口，历史失败仍留存；最终状态见实施追踪矩阵。

### SCOPE-001

三方自行裁剪任务不进入本流程。

证据：[U1](acceptance-final/core-final-7.log)；[D1](acceptance-source-ui-final/actions-build7.json)；[C5](acceptance-final/scope-empty-agent-r2.json)。

最终同版：[simple-handover](acceptance-final/simple-handover-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)；[roles](acceptance-final/roles-build21.json)。

C5实际读取三合一任务码后，页面明确不支持简易裁片交出，确认禁用、无换片布输入、读取无业务写入。对应真实任务策略和入口，不再仅用inScope=false单元前置。 build21对应命名入口、适用性能与最终源码联审已通过。

### SCOPE-002

不开放独立换片布交出。

证据：[U1](acceptance-final/core-final-7.log)；[D4](acceptance-final/simple-disabled-final.json)。

最终同版：[simple-handover](acceptance-final/simple-handover-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)；[roles](acceptance-final/roles-build21.json)。

cutPieceQty=0契约阻断已测。界面只在裁片交出中提供换片布选择，不存在独立交出页面/按钮；非法绕过的零裁片参数属纯业务门禁，用U1负向契约验证，无需为验收人为新增非法UI。 build21对应命名入口、适用性能与最终源码联审已通过。

### SCOPE-003

保持现有裁片缺口政策。

证据：[D3](acceptance-final/two-factories-final.json)；[U1](acceptance-final/core-final-7.log)；[C5](acceptance-final/scope-empty-agent-r2.json)。

最终同版：[simple-handover](acceptance-final/simple-handover-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)；[roles](acceptance-final/roles-build21.json)。

D3首批700片、后批200片由现有可交裁片事实决定；C5仍显示应交900、本次700、剩余200并可按原规则交出。新校验仅追加换片布需料，不把换片布长度计入裁片缺口。既有裁片政策由裁床全链专项回归，不扩写原政策。 build21对应命名入口、适用性能与最终源码联审已通过。

### SCOPE-004

无权限角色不能确认仓管交出。

证据：[D2](acceptance-final/roles-build21.json)。

最终同版：[simple-handover](acceptance-final/simple-handover-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)；[roles](acceptance-final/roles-build21.json)。

实际Web/PDA不同角色确认禁用；已绑定当前构建及影响说明。 build21对应命名入口、适用性能与最终源码联审已通过。

### ORDER-001

有效分配到裁床即出现订单行。

证据：[D1](acceptance-source-ui-final/actions-build7.json)。

最终同版：[source-actions](acceptance-final/source-actions-build21.json)；[list-actions](acceptance-final/list-actions-build21.json)；[simple-handover](acceptance-final/simple-handover-build21.json)。

真实分配后3种面料初始3票、增票、改派离开后列表移出；5组通过。 build21对应命名入口、适用性能与最终源码联审已通过。

### ORDER-002

同生产单只出现一条主列表行。

证据：[D1](acceptance-source-ui-final/actions-build7.json)；[L1](acceptance-final/list-actions-build21.json)。

最终同版：[source-actions](acceptance-final/source-actions-build21.json)；[list-actions](acceptance-final/list-actions-build21.json)；[simple-handover](acceptance-final/simple-handover-build21.json)。

列表按productionOrderId聚合，材料按materialKey去重，属于确定性投影；真实分配/增票/列表证据验证单行及嵌套材料显示。不为同一投影的多任务组合另造重复UI场景，最终源码反向审查保留该聚合键。 build21对应命名入口、适用性能与最终源码联审已通过。

### ORDER-003

每种合格面料仅生成一张初始票。

证据：[D1](acceptance-source-ui-final/actions-build7.json)。

最终同版：[source-actions](acceptance-final/source-actions-build21.json)；[list-actions](acceptance-final/list-actions-build21.json)；[simple-handover](acceptance-final/simple-handover-build21.json)。

真实分配后3种面料初始3票、增票、改派离开后列表移出；5组通过。 build21对应命名入口、适用性能与最终源码联审已通过。

### ORDER-004

资料缺失保留待核对行。

证据：[U2](acceptance-final/core-final-7.log)；[C1](acceptance-final/business-boundaries-agent-r8.json)。

最终同版：[source-actions](acceptance-final/source-actions-build21.json)；[list-actions](acceptance-final/list-actions-build21.json)；[simple-handover](acceptance-final/simple-handover-build21.json)。

C1真实页面显示资料待核对、打印禁用、0票、读取未落盘；前置为显式隔离Mock缺技术快照。 build21对应命名入口、适用性能与最终源码联审已通过。

### ORDER-005

改派移出后原裁床待办消失。

证据：[D1](acceptance-source-ui-final/actions-build7.json)。

最终同版：[source-actions](acceptance-final/source-actions-build21.json)；[list-actions](acceptance-final/list-actions-build21.json)；[simple-handover](acceptance-final/simple-handover-build21.json)。

真实分配后3种面料初始3票、增票、改派离开后列表移出；5组通过。 build21对应命名入口、适用性能与最终源码联审已通过。

### ORDER-006

改派后旧页面不能继续提交。

证据：[S1](acceptance-final/source-core-final.json)；[D1](acceptance-source-ui-final/actions-build7.json)；[C3](acceptance-final/reassignment-boundaries-r5.json)。

最终同版：[source-actions](acceptance-final/source-actions-build21.json)；[list-actions](acceptance-final/list-actions-build21.json)；[simple-handover](acceptance-final/simple-handover-build21.json)。

C3 r5真实旧预览在另一页面改派后确认被拒绝，打印/回执未改变，场景通过； build21对应命名入口、适用性能与最终源码联审已通过。

### ORDER-007

已交出历史不因改派被抹除。

证据：[U1](acceptance-final/core-final-7.log)；[D8](acceptance-final/history-print-build21.json)；[C3](acceptance-final/reassignment-boundaries-r5.json)。

最终同版：[source-actions](acceptance-final/source-actions-build21.json)；[list-actions](acceptance-final/list-actions-build21.json)；[simple-handover](acceptance-final/simple-handover-build21.json)。

C3 r5已交后真实改派，原票历史、交出事件和回执保持；原工厂回执直达与刷新通过。 build21对应命名入口、适用性能与最终源码联审已通过。

### MAT-001

清单包含整单实际合格面料。

证据：[U2](acceptance-final/core-final-7.log)；[D1](acceptance-source-ui-final/actions-build7.json)；[C5](acceptance-final/scope-empty-agent-r2.json)。

最终同版：[source-actions](acceptance-final/source-actions-build21.json)；[list-actions](acceptance-final/list-actions-build21.json)；[simple-handover](acceptance-final/simple-handover-build21.json)。

U2验证技术资料SKU用料映射、去重、材料身份；D1实际三种面料产生三票，C1同名不同物料不可互抵，C5全朴真实空集合交出。三者分别覆盖映射计算、非空/同名/空集合UI。 build21对应命名入口、适用性能与最终源码联审已通过。

### MAT-002

任务需料由分配 SKU 推导。

证据：[C1](acceptance-final/business-boundaries-agent-r8.json)；[U2](acceptance-final/core-final-7.log)；[D3](acceptance-final/two-factories-final.json)。

最终同版：[source-actions](acceptance-final/source-actions-build21.json)；[list-actions](acceptance-final/list-actions-build21.json)；[simple-handover](acceptance-final/simple-handover-build21.json)。

U2 SKU用料契约；C1 r8按M任务初需A、后增加SKU/B的真实需料变化与后续交出通过。上游新增需料为明确Mock，交出与打印使用真实按钮。 build21对应命名入口、适用性能与最终源码联审已通过。

### MAT-003

相同面料不因部位／尺码重复。

证据：[U2](acceptance-final/core-final-7.log)；[D1](acceptance-source-ui-final/actions-build7.json)；[C5](acceptance-final/scope-empty-agent-r2.json)。

最终同版：[source-actions](acceptance-final/source-actions-build21.json)；[list-actions](acceptance-final/list-actions-build21.json)；[simple-handover](acceptance-final/simple-handover-build21.json)。

名称含朴的排除属于确定性材料规则，U2正反向名称契约与C5全朴实际列表/交出共同证明；按物料名称判断，不引入额外类型字段猜测。 build21对应命名入口、适用性能与最终源码联审已通过。

### MAT-004

同名不同身份材料不得互认。

证据：[C1](acceptance-final/business-boundaries-agent-r8.json)；[U1](acceptance-final/core-final-7.log)；[U2](acceptance-final/core-final-7.log)。

最终同版：[source-actions](acceptance-final/source-actions-build21.json)；[list-actions](acceptance-final/list-actions-build21.json)；[simple-handover](acceptance-final/simple-handover-build21.json)。

C1 r8通过。明确Mock同名A/B不同物料身份；实际页面先A成功、B成为缺项时A票不能满足B，真实补B后同次交出成功。 build21对应命名入口、适用性能与最终源码联审已通过。

### MAT-005

按物料名称识别排除朴。

证据：[U2](acceptance-final/core-final-7.log)；[D1](acceptance-source-ui-final/actions-build7.json)。

最终同版：[source-actions](acceptance-final/source-actions-build21.json)；[list-actions](acceptance-final/list-actions-build21.json)；[simple-handover](acceptance-final/simple-handover-build21.json)。

U2验证多SKU相同材料去重；列表和票以materialKey保持身份，C1同名不同身份不会错误合并。无需为每种排列组合重复完整界面交出。 build21对应命名入口、适用性能与最终源码联审已通过。

### MAT-006

资料完整的空集合标为无需换片布。

证据：[U2](acceptance-final/core-final-7.log)；[C1](acceptance-final/business-boundaries-agent-r8.json)；[C5](acceptance-final/scope-empty-agent-r2.json)。

最终同版：[source-actions](acceptance-final/source-actions-build21.json)；[list-actions](acceptance-final/list-actions-build21.json)；[simple-handover](acceptance-final/simple-handover-build21.json)。

C1显示完整空集合“无需换片布”；C5进一步实际确认5张裁片票700片，成功回执为0张换片布/0Yard，持久换片布回执为空。与缺资料的待核对阻断明确区分。 build21对应命名入口、适用性能与最终源码联审已通过。

### TKT-001

每张固定 5 Yard 不可修改。

证据：[D1](acceptance-source-ui-final/actions-build7.json)；[P1](acceptance-final/print-images-build21.json)；[L1](acceptance-final/list-actions-build21.json)。

最终同版：[print-controls](acceptance-final/print-controls-build21.json)；[print-images](acceptance-final/print-images-build21.json)；[history-print](acceptance-final/history-print-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)。

真实新增固定5 Yard、无长度编辑入口与新增后数量有直接证据。 build21对应命名入口、适用性能与最终源码联审已通过。

### TKT-002

无车缝分配时仍可按生产单出票。

证据：[D1](acceptance-source-ui-final/actions-build7.json)。

最终同版：[print-controls](acceptance-final/print-controls-build21.json)；[print-images](acceptance-final/print-images-build21.json)；[history-print](acceptance-final/history-print-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)。

生产单出票来源读取当前裁床分配与技术面料，不查询车缝分配作为前置；D1裁床分配即出现初始票且可新增/打印。该无依赖事实由来源代码与实际入口共同确认，不虚构未执行的反向UI。 build21对应命名入口、适用性能与最终源码联审已通过。

### TKT-003

同面料能新增多张独立票。

证据：[D1](acceptance-source-ui-final/actions-build7.json)；[P1](acceptance-final/print-images-build21.json)；[L1](acceptance-final/list-actions-build21.json)。

最终同版：[print-controls](acceptance-final/print-controls-build21.json)；[print-images](acceptance-final/print-images-build21.json)；[history-print](acceptance-final/history-print-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)。

真实新增固定5 Yard、无长度编辑入口与新增后数量有直接证据。 build21对应命名入口、适用性能与最终源码联审已通过。

### TKT-004

同一新增请求重试不重复建票。

证据：[U1](acceptance-final/core-final-7.log)；[S1](acceptance-final/source-core-final.json)；[S2](acceptance-part-tickets/browser-eight-sources-final.txt)。

最终同版：[print-controls](acceptance-final/print-controls-build21.json)；[print-images](acceptance-final/print-images-build21.json)；[history-print](acceptance-final/history-print-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)。

稳定命令幂等/同命令异内容拒绝与IDB失败回滚有直接契约；新增页保留选择/失败提示属于通用真实保存入口证据，最终build21性能已通过。幂等本身以事务返回和记录计数为充分证据。 build21对应命名入口、适用性能与最终源码联审已通过。

### TKT-005

换片布票号不与任何类型重复。

证据：[U1](acceptance-final/core-final-7.log)；[P1](acceptance-final/print-images-build21.json)；[P4](acceptance-final/lan-build21.json)；[D1](acceptance-source-ui-final/actions-build7.json)。

最终同版：[print-controls](acceptance-final/print-controls-build21.json)；[print-images](acceptance-final/print-images-build21.json)；[history-print](acceptance-final/history-print-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)。

身份前缀、解析、递增及新增3号有直接/契约证据；改派回原厂同日不复用范围由reassignment unit补强。 build21对应命名入口、适用性能与最终源码联审已通过。

### TKT-006

序号按生产单＋面料递增不重用。

证据：[U1](acceptance-final/core-final-7.log)；[P1](acceptance-final/print-images-build21.json)；[P4](acceptance-final/lan-build21.json)；[D1](acceptance-source-ui-final/actions-build7.json)。

最终同版：[print-controls](acceptance-final/print-controls-build21.json)；[print-images](acceptance-final/print-images-build21.json)；[history-print](acceptance-final/history-print-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)。

身份前缀、解析、递增及新增3号有直接/契约证据；改派回原厂同日不复用范围由reassignment unit补强。 build21对应命名入口、适用性能与最终源码联审已通过。

### TKT-007

补打保持原身份和数量。

证据：[P1](acceptance-final/print-images-build21.json)；[D8](acceptance-final/history-print-build21.json)。

最终同版：[print-controls](acceptance-final/print-controls-build21.json)；[print-images](acceptance-final/print-images-build21.json)；[history-print](acceptance-final/history-print-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)。

部分首打/补打保持身份与票数，历史已交补打回执不变，有直接证据。 build21对应命名入口、适用性能与最终源码联审已通过。

### TKT-008

已交出票补打不恢复交出资格。

证据：[D8](acceptance-final/history-print-build21.json)；[U1](acceptance-final/core-final-7.log)。

最终同版：[print-controls](acceptance-final/print-controls-build21.json)；[print-images](acceptance-final/print-images-build21.json)；[history-print](acceptance-final/history-print-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)。

D8实际已交票补打后票数/回执不变；C2实际回收后旧已交票再次扫描被拒绝，只有新独立票可进入新周期。补打不会生成新的可交身份。 build21对应命名入口、适用性能与最终源码联审已通过。

### PAGE-001

菜单位于捆条菲票打印之后。

证据：[L1](acceptance-final/list-actions-build21.json)；[D1](acceptance-source-ui-final/actions-build7.json)。

最终同版：[list-actions](acceptance-final/list-actions-build21.json)；[extra-controls](acceptance-final/extra-controls-build21.json)；[print-controls](acceptance-final/print-controls-build21.json)。

菜单与命名页面、原始截图和L1真实列表入口已绑定；最终build21冷启动/导航门禁已通过。 build21对应命名入口、适用性能与最终源码联审已通过。

### PAGE-002

面料单元格一行一种面料。

证据：[L1](acceptance-final/list-actions-build21.json)；[D1](acceptance-source-ui-final/actions-build7.json)。

最终同版：[list-actions](acceptance-final/list-actions-build21.json)；[extra-controls](acceptance-final/extra-controls-build21.json)；[print-controls](acceptance-final/print-controls-build21.json)。

L1实际列表单元格显示生产单下多种面料； build21对应命名入口、适用性能与最终源码联审已通过。

### PAGE-003

查询同时刷新列表统计与条数。

证据：[L1](acceptance-final/list-actions-build21.json)。

最终同版：[list-actions](acceptance-final/list-actions-build21.json)；[extra-controls](acceptance-final/extra-controls-build21.json)；[print-controls](acceptance-final/print-controls-build21.json)。

135样本覆盖查询、匹配导出、跨页选择；脚本与结果可直接绑定。 build21对应命名入口、适用性能与最终源码联审已通过。

### PAGE-004

重置清空全部条件。

证据：[L1](acceptance-final/list-actions-build21.json)；[L2](acceptance-final/extra-controls-build21.json)。

最终同版：[list-actions](acceptance-final/list-actions-build21.json)；[extra-controls](acceptance-final/extra-controls-build21.json)；[print-controls](acceptance-final/print-controls-build21.json)。

L1/L2 build11覆盖查询、重置、列设置与导出；旧831.6ms失败保留。 build21对应命名入口、适用性能与最终源码联审已通过。

### PAGE-005

导出全量匹配且无操作列。

证据：[L1](acceptance-final/list-actions-build21.json)。

最终同版：[list-actions](acceptance-final/list-actions-build21.json)；[extra-controls](acceptance-final/extra-controls-build21.json)；[print-controls](acceptance-final/print-controls-build21.json)。

135样本覆盖查询、匹配导出、跨页选择；脚本与结果可直接绑定。 build21对应命名入口、适用性能与最终源码联审已通过。

### PAGE-006

标准列表分页及列设置可用。

证据：[L1](acceptance-final/list-actions-build21.json)；[L2](acceptance-final/extra-controls-build21.json)。

最终同版：[list-actions](acceptance-final/list-actions-build21.json)；[extra-controls](acceptance-final/extra-controls-build21.json)；[print-controls](acceptance-final/print-controls-build21.json)。

L1/L2 build11覆盖列设置、冻结/拖拽与分页。 build21对应命名入口、适用性能与最终源码联审已通过。

### PAGE-007

打印汇总准确表达部分已打印。

证据：[P1](acceptance-final/print-images-build21.json)。

最终同版：[list-actions](acceptance-final/list-actions-build21.json)；[extra-controls](acceptance-final/extra-controls-build21.json)；[print-controls](acceptance-final/print-controls-build21.json)。

6票只确认1票且刷新部分打印有直接证据。 build21对应命名入口、适用性能与最终源码联审已通过。

### PAGE-008

整单打印覆盖全部有效票。

证据：[P2](acceptance-final/print-controls-build21.json)。

最终同版：[list-actions](acceptance-final/list-actions-build21.json)；[extra-controls](acceptance-final/extra-controls-build21.json)；[print-controls](acceptance-final/print-controls-build21.json)。

P2 build11实际整单预览/首打/补打控制有结果；build8的528.2ms作为历史诊断保留，最终print-controls-build21性能通过。 build21对应命名入口、适用性能与最终源码联审已通过。

### PAGE-009

单票及跨页多票选择准确。

证据：[L1](acceptance-final/list-actions-build21.json)。

最终同版：[list-actions](acceptance-final/list-actions-build21.json)；[extra-controls](acceptance-final/extra-controls-build21.json)；[print-controls](acceptance-final/print-controls-build21.json)。

135样本覆盖查询、匹配导出、跨页选择；脚本与结果可直接绑定。 build21对应命名入口、适用性能与最终源码联审已通过。

### PAGE-010

缺项及失败给出可行动提示。

证据：[L1](acceptance-final/list-actions-build21.json)；[D2](acceptance-final/roles-build21.json)；[D4](acceptance-final/simple-disabled-final.json)；[S2](acceptance-part-tickets/browser-eight-sources-final.txt)。

最终同版：[list-actions](acceptance-final/list-actions-build21.json)；[extra-controls](acceptance-final/extra-controls-build21.json)；[print-controls](acceptance-final/print-controls-build21.json)。

空结果、权限、缺票与保存失败可行动提示已验；C1另验证资料待核对、打印禁用、0票及0读取写入。 build21对应命名入口、适用性能与最终源码联审已通过。

### PRINT-001

票面清楚识别单、料、第几张。

证据：[P3](acceptance-final/label-qr-decode.json)；[P4](acceptance-final/lan-build21.json)；[B1](acceptance-bag-lifecycle/hpb-scan-five-samples-build7.json)。

最终同版：[print-controls](acceptance-final/print-controls-build21.json)；[print-images](acceptance-final/print-images-build21.json)；[history-print](acceptance-final/history-print-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)。

软件票面/PDF/二维码和三种类型识别已通过；D04现场耗材、实际出纸和纸面可读性尚无用户结果。本条已阻塞，由用户现场确认解除，软件测试不替代accepted。

### PRINT-002

黑白票面能区分三种菲票。

证据：[P3](acceptance-final/label-qr-decode.json)；[P4](acceptance-final/lan-build21.json)；[B1](acceptance-bag-lifecycle/hpb-scan-five-samples-build7.json)。

最终同版：[print-controls](acceptance-final/print-controls-build21.json)；[print-images](acceptance-final/print-images-build21.json)；[history-print](acceptance-final/history-print-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)。

软件票面/PDF/二维码和三种类型识别已通过；D04现场耗材、实际出纸和纸面可读性尚无用户结果。本条已阻塞，由用户现场确认解除，软件测试不替代accepted。

### PRINT-003

扫码指向唯一换片布票。

证据：[P3](acceptance-final/label-qr-decode.json)；[P4](acceptance-final/lan-build21.json)；[B1](acceptance-bag-lifecycle/hpb-scan-five-samples-build7.json)。

最终同版：[print-controls](acceptance-final/print-controls-build21.json)；[print-images](acceptance-final/print-images-build21.json)；[history-print](acceptance-final/history-print-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)。

唯一HPB编码、软件二维码解码和PDA扫码输入已验证；软件拦截window.print不代表现场扫描纸票。 build21对应命名入口、适用性能与最终源码联审已通过。

### PRINT-004

取消预览／未完成不误标已打印。

证据：[P1](acceptance-final/print-images-build21.json)；[P2](acceptance-final/print-controls-build21.json)。

最终同版：[print-controls](acceptance-final/print-controls-build21.json)；[print-images](acceptance-final/print-images-build21.json)；[history-print](acceptance-final/history-print-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)。

取消不标记、未调用打印不能确认、部分选择确认已测；P2最终build21性能已通过。 build21对应命名入口、适用性能与最终源码联审已通过。

### PRINT-005

部分出纸仅确认成功票。

证据：[P1](acceptance-final/print-images-build21.json)；[P2](acceptance-final/print-controls-build21.json)。

最终同版：[print-controls](acceptance-final/print-controls-build21.json)；[print-images](acceptance-final/print-images-build21.json)；[history-print](acceptance-final/history-print-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)。

取消不标记、未调用打印不能确认、部分选择确认已测；P2最终build21性能已通过。 build21对应命名入口、适用性能与最终源码联审已通过。

### BAG-001

换片布可扫码装入现有袋。

证据：[B1](acceptance-bag-lifecycle/hpb-scan-five-samples-build7.json)。

最终同版：[hpb-scan](acceptance-final/hpb-scan-build21.json)；[bag-lifecycle](acceptance-final/bag-lifecycle-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)。

真实新增HPB003→软件打印确认→PDA扫描→装袋→详情刷新，5组通过。 build21对应命名入口、适用性能与最终源码联审已通过。

### BAG-002

同票重复扫描不增加数量。

证据：[U1](acceptance-final/core-final-7.log)；[U3](acceptance-final/binding-strip-final.txt)；[B1](acceptance-bag-lifecycle/hpb-scan-five-samples-build7.json)；[C2](acceptance-final/bag-boundaries-agent-r10.json)。

最终同版：[hpb-scan](acceptance-final/hpb-scan-build21.json)；[bag-lifecycle](acceptance-final/bag-lifecycle-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)。

C2 r10实际重复扫描不增加张数/数量，持久结果不重复； build21对应命名入口、适用性能与最终源码联审已通过。

### BAG-003

同票不能同时占用两只有效袋。

证据：[U1](acceptance-final/core-final-7.log)；[U3](acceptance-final/binding-strip-final.txt)；[B1](acceptance-bag-lifecycle/hpb-scan-five-samples-build7.json)；[C2](acceptance-final/bag-boundaries-agent-r10.json)。

最终同版：[hpb-scan](acceptance-final/hpb-scan-build21.json)；[bag-lifecycle](acceptance-final/bag-lifecycle-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)。

C2 r10实际同票第二有效袋占用阻断，有提示和持久结果断言。 build21对应命名入口、适用性能与最终源码联审已通过。

### BAG-004

三类混装不放开跨生产单。

证据：[U1](acceptance-final/core-final-7.log)；[U3](acceptance-final/binding-strip-final.txt)；[B1](acceptance-bag-lifecycle/hpb-scan-five-samples-build7.json)；[C2](acceptance-final/bag-boundaries-agent-r10.json)。

最终同版：[hpb-scan](acceptance-final/hpb-scan-build21.json)；[bag-lifecycle](acceptance-final/bag-lifecycle-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)。

C2 r10其他生产单票不能混入当前袋；明确Mock仅准备来源，扫码校验为真实UI。 build21对应命名入口、适用性能与最终源码联审已通过。

### BAG-005

袋详情同时展示三类货物。

证据：[B1](acceptance-bag-lifecycle/hpb-scan-five-samples-build7.json)；[B2](acceptance-bag-lifecycle/lifecycle-five-samples-build7.json)；[D5](acceptance-final/mixed-backup-final.json)。

最终同版：[hpb-scan](acceptance-final/hpb-scan-build21.json)；[bag-lifecycle](acceptance-final/bag-lifecycle-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)。

Web/PDA三类明细与按张/片/米/Yard分项有直接结果。 build21对应命名入口、适用性能与最终源码联审已通过。

### BAG-006

混装数量按类型单位分别汇总。

证据：[B1](acceptance-bag-lifecycle/hpb-scan-five-samples-build7.json)；[B2](acceptance-bag-lifecycle/lifecycle-five-samples-build7.json)；[D5](acceptance-final/mixed-backup-final.json)。

最终同版：[hpb-scan](acceptance-final/hpb-scan-build21.json)；[bag-lifecycle](acceptance-final/bag-lifecycle-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)。

Web/PDA三类明细与按张/片/米/Yard分项有直接结果。 build21对应命名入口、适用性能与最终源码联审已通过。

### BAG-007

移出／重装保持票身份数量守恒。

证据：[B2](acceptance-bag-lifecycle/lifecycle-five-samples-build7.json)。

最终同版：[hpb-scan](acceptance-final/hpb-scan-build21.json)；[bag-lifecycle](acceptance-final/bag-lifecycle-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)。

重装失败输入保留、成功后逐票ID/号/数量单位守恒与7→10事件有直接证据。 build21对应命名入口、适用性能与最终源码联审已通过。

### BAG-008

换片布票不支持拆分长度。

证据：[U1](acceptance-final/core-final-7.log)；[B2](acceptance-bag-lifecycle/lifecycle-five-samples-build7.json)。

最终同版：[hpb-scan](acceptance-final/hpb-scan-build21.json)；[bag-lifecycle](acceptance-final/bag-lifecycle-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)。

5 Yard校验unit、重装保持5 Yard已测；无拆长度入口可通过UI静态核对说明不适用拆分动作。 build21对应命名入口、适用性能与最终源码联审已通过。

### BAG-009

回收袋不恢复旧票交出资格。

证据：[B2](acceptance-bag-lifecycle/lifecycle-five-samples-build7.json)；[U1](acceptance-final/core-final-7.log)；[C2](acceptance-final/bag-boundaries-agent-r10.json)。

最终同版：[hpb-scan](acceptance-final/hpb-scan-build21.json)；[bag-lifecycle](acceptance-final/bag-lifecycle-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)。

C2 r10实际入库/交出/回收后旧已交HPB拒扫，新增独立HPB可进入新周期；未将“回收袋”误作“恢复票可交”。 build21对应命名入口、适用性能与最终源码联审已通过。

### BAG-010

货物标识和清单包含新增类型。

证据：[U3](acceptance-final/binding-strip-final.txt)；[B3](acceptance-bag-lifecycle/web-detail-five-samples-build7.json)；[C2](acceptance-final/bag-boundaries-agent-r10.json)。

最终同版：[hpb-scan](acceptance-final/hpb-scan-build21.json)；[bag-lifecycle](acceptance-final/bag-lifecycle-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)。

P5原cycle混装标签契约4/4；C2实际选择旧周期并点击打印，保留3页原票ID与20片/5Yard/8米，不混入新票。 build21对应命名入口、适用性能与最终源码联审已通过。

### BAG-011

历史打印读取原周期快照。

证据：[B3](acceptance-bag-lifecycle/web-detail-five-samples-build7.json)；[C2](acceptance-final/bag-boundaries-agent-r10.json)。

最终同版：[hpb-scan](acceptance-final/hpb-scan-build21.json)；[bag-lifecycle](acceptance-final/bag-lifecycle-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)。

C2 r10实际Web旧周期选择→打印按钮→3页原ID和数量；新周期新HPB不出现在旧标签。history-route-unit 1/1及P5 4/4补强历史路由和禁旧存储事实。旧r5 timeout保留。 build21对应命名入口、适用性能与最终源码联审已通过。

### HAND-001

历史已交与本次随交共同满足需料。

证据：[C1](acceptance-final/business-boundaries-agent-r8.json)；[D3](acceptance-final/two-factories-final.json)；[D4](acceptance-final/simple-disabled-final.json)。

最终同版：[simple-handover](acceptance-final/simple-handover-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)；[roles](acceptance-final/roles-build21.json)。

D3历史A覆盖后同任务下一批无需再交；C1 r8补充历史A+本次新增需料B，缺项只为B并真实补B成功；C4覆盖多袋并集。 build21对应命名入口、适用性能与最终源码联审已通过。

### HAND-002

任一需料缺失阻断本次确认。

证据：[D3](acceptance-final/two-factories-final.json)；[D4](acceptance-final/simple-disabled-final.json)；[D5](acceptance-final/mixed-backup-final.json)。

最终同版：[simple-handover](acceptance-final/simple-handover-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)；[roles](acceptance-final/roles-build21.json)。

缺票提示且未增交出记录； build21对应命名入口、适用性能与最终源码联审已通过。

### HAND-003

不同任务不能共用同一已交票。

证据：[D3](acceptance-final/two-factories-final.json)；[U1](acceptance-final/core-final-7.log)。

最终同版：[simple-handover](acceptance-final/simple-handover-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)；[roles](acceptance-final/roles-build21.json)。

另一任务另一工厂扫旧已交票被拒绝，再用独立第2票成功；同厂不同任务纯边界由unit支持。 build21对应命名入口、适用性能与最终源码联审已通过。

### HAND-004

多袋同次检查并集且顺序无关。

证据：[U1](acceptance-final/core-final-7.log)；[D5](acceptance-final/mixed-backup-final.json)；[C4](acceptance-final/batch-ui-boundaries-r5.json)。

最终同版：[simple-handover](acceptance-final/simple-handover-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)；[roles](acceptance-final/roles-build21.json)。

C4 r5两场真实UI通过。第一场裁片袋先自动选中，漏选换片布袋确认阻断；扫描换片布袋后按换片布在前、裁片在后的集合交出。第二场两袋预先绑定同任务，真实任务/PPIC选择会自动归集两袋，同次交出成功。修复HPB绑定自动归集丢失，不能用r3前置错误代替。 build21对应命名入口、适用性能与最终源码联审已通过。

### HAND-005

未选入本次的袋不能满足缺项。

证据：[U1](acceptance-final/core-final-7.log)；[D5](acceptance-final/mixed-backup-final.json)；[C4](acceptance-final/batch-ui-boundaries-r5.json)。

最终同版：[simple-handover](acceptance-final/simple-handover-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)；[roles](acceptance-final/roles-build21.json)。

C4 r5实际确认未选入换片布袋时缺项阻断、数据库不变；真实扫描加入该袋后才能成功交出。 build21对应命名入口、适用性能与最终源码联审已通过。

### HAND-006

裁片与换片布同次成功或失败。

证据：[D4](acceptance-final/simple-disabled-final.json)；[D5](acceptance-final/mixed-backup-final.json)；[B2](acceptance-bag-lifecycle/lifecycle-five-samples-build7.json)；[S2](acceptance-part-tickets/browser-eight-sources-final.txt)。

最终同版：[simple-handover](acceptance-final/simple-handover-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)；[roles](acceptance-final/roles-build21.json)。

简易交出脚本在实际确认按钮对cutting-events写入注入失败，校验全库不变/选择仍在，随后真实重试成功；核心同库事务验证裁片事件与换片布回执无半套。 build21对应命名入口、适用性能与最终源码联审已通过。

### HAND-007

重试确认不重复交出。

证据：[S1](acceptance-final/source-core-final.json)；[S2](acceptance-part-tickets/browser-eight-sources-final.txt)；[U1](acceptance-final/core-final-7.log)。

最终同版：[simple-handover](acceptance-final/simple-handover-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)；[roles](acceptance-final/roles-build21.json)。

稳定确认命令、事务内去重契约验证重复确认无重复事件/回执；实际失败后重试入口保留原选择，成功只记一次。不能把仅按钮禁用当作幂等证明。 build21对应命名入口、适用性能与最终源码联审已通过。

### HAND-008

简易交出支持不经袋直接随交。

证据：[D3](acceptance-final/two-factories-final.json)；[D4](acceptance-final/simple-disabled-final.json)。

最终同版：[simple-handover](acceptance-final/simple-handover-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)；[roles](acceptance-final/roles-build21.json)。

Web实际随交与PDA build10五组已有功能结果； build21对应命名入口、适用性能与最终源码联审已通过。

### HAND-009

直接交出不取用已装袋票。

证据：[B1](acceptance-bag-lifecycle/hpb-scan-five-samples-build7.json)；[U1](acceptance-final/core-final-7.log)；[C2](acceptance-final/bag-boundaries-agent-r10.json)。

最终同版：[simple-handover](acceptance-final/simple-handover-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)；[roles](acceptance-final/roles-build21.json)。

C2 r10实际扫码被有效袋占用阻断，并提示按袋交出或先移出；该真实界面规则已覆盖。 build21对应命名入口、适用性能与最终源码联审已通过。

### HAND-010

同任务后续批次不重复要求已交面料。

证据：[C1](acceptance-final/business-boundaries-agent-r8.json)；[D3](acceptance-final/two-factories-final.json)；[D4](acceptance-final/simple-disabled-final.json)。

最终同版：[simple-handover](acceptance-final/simple-handover-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)；[roles](acceptance-final/roles-build21.json)。

D3同任务同厂后批200片0换片布；C1 r8历史A+本次B覆盖后不重复A回执。需求按当前任务/工厂/面料匹配，不按生产单泛化。 build21对应命名入口、适用性能与最终源码联审已通过。

### HAND-011

新增需料只补新增缺项。

证据：[C1](acceptance-final/business-boundaries-agent-r8.json)；[U1](acceptance-final/core-final-7.log)。

最终同版：[simple-handover](acceptance-final/simple-handover-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)；[roles](acceptance-final/roles-build21.json)。

C1 r8通过。原task已交A，明确Mock增加B需料及第二裁剪批；缺项只提示B，实际新增并打印B后交出，原A回执不重复。修复requireCurrentScope同assignment多面料错取首项，核心失败/修复契约由主代理绑定。 build21对应命名入口、适用性能与最终源码联审已通过。

### HAND-012

换工厂不继承旧工厂实收。

证据：[D3](acceptance-final/two-factories-final.json)；[U1](acceptance-final/core-final-7.log)；[C3](acceptance-final/reassignment-boundaries-r5.json)。

最终同版：[simple-handover](acceptance-final/simple-handover-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)；[roles](acceptance-final/roles-build21.json)。

C3 r5通过。同taskId换厂为明确Mock上游分配事实（实际改派UI会产生继任taskId）；新厂真实交出先缺票、旧票拒绝，新增独立票后成功，原厂回执保持。身份使用新厂有效PPIC，没有伪造打印或交出结果。 build21对应命名入口、适用性能与最终源码联审已通过。

### HAND-013

历史缺证据不自动伪造已交。

证据：[U1](acceptance-final/core-final-7.log)；[D4](acceptance-final/simple-disabled-final.json)。

最终同版：[simple-handover](acceptance-final/simple-handover-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)；[roles](acceptance-final/roles-build21.json)。

覆盖计算只接受真实replacement receipts，本身不读取/推断历史裁片数量；U1无回执即缺项、当前正确回执才覆盖，D4真实缺票阻断。旧裁片事件不会制造receipt，由事实源读链及迁移校验保证；这是纯规则负向边界，无需捏造历史票UI。 build21对应命名入口、适用性能与最终源码联审已通过。

### HAND-014

回执能回查每票任务工厂人时。

证据：[D3](acceptance-final/two-factories-final.json)；[D4](acceptance-final/simple-disabled-final.json)。

最终同版：[simple-handover](acceptance-final/simple-handover-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)；[roles](acceptance-final/roles-build21.json)。

直接回执含交出单/票、任务/工厂/人/时，工厂接收详情可直达；链接具体head/proof字段。 build21对应命名入口、适用性能与最终源码联审已通过。

### FACT-001

打印装袋交出状态分别推导。

证据：[U1](acceptance-final/core-final-7.log)；[P1](acceptance-final/print-images-build21.json)；[B1](acceptance-bag-lifecycle/hpb-scan-five-samples-build7.json)；[D3](acceptance-final/two-factories-final.json)。

最终同版：[routes](acceptance-final/routes-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[part](acceptance-final/part-build21.json)；[source-generation](acceptance-final/source-generation-build21.json)。

打印、装袋、已交分别有不同阶段事实证据，不能仅引用单张列表截图。 build21对应命名入口、适用性能与最终源码联审已通过。

### FACT-002

换片布不污染裁片接收和齐套数量。

证据：[U2](acceptance-final/core-final-7.log)；[D3](acceptance-final/two-factories-final.json)；[B2](acceptance-bag-lifecycle/lifecycle-five-samples-build7.json)。

最终同版：[routes](acceptance-final/routes-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[part](acceptance-final/part-build21.json)；[source-generation](acceptance-final/source-generation-build21.json)。

20片+5Yard+8米不混计，以及700/200/720片回执等明确数量证据。 build21对应命名入口、适用性能与最终源码联审已通过。

### FACT-003

保留原捆条毛织等类型行为。

证据：[U3](acceptance-final/binding-strip-final.txt)；[B2](acceptance-bag-lifecycle/lifecycle-five-samples-build7.json)；[R1](acceptance-final/core-final-7.log)。

最终同版：[routes](acceptance-final/routes-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[part](acceptance-final/part-build21.json)；[source-generation](acceptance-final/source-generation-build21.json)。

捆条/部位打印、三类型标签有专项，裁床全链/FCS端到端通过；毛织独立服务E2E17/17及完整17脚本r6 exit0。WOOL-CHECKER-FINAL明确非毛织仓惰性静态投影前置和未修改业务断言。 build21对应命名入口、适用性能与最终源码联审已通过。

### FACT-004

未识别历史类型不猜测迁移。

证据：[S3](acceptance-final/migration-final.json)；[R1](acceptance-final/core-final-7.log)。

最终同版：[routes](acceptance-final/routes-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[part](acceptance-final/part-build21.json)；[source-generation](acceptance-final/source-generation-build21.json)。

未知集合/错误格式由迁移校验拒绝；validBagTicketQuantity仅接受已知换片布/捆条/裁片/毛织类型及明确旧裁片缺kind约定，不按名称猜测未知kind。此非法输入是纯类型/迁移门禁，无产品入口可以提交未知枚举；用代码核查+核心负向校验，不虚构反向UI。 build21对应命名入口、适用性能与最终源码联审已通过。

### UX-001

PDA 可完成扫描核对确认主流程。

证据：[B1](acceptance-bag-lifecycle/hpb-scan-five-samples-build7.json)；[B2](acceptance-bag-lifecycle/lifecycle-five-samples-build7.json)；[D4](acceptance-final/simple-disabled-final.json)。

最终同版：[print-images](acceptance-final/print-images-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[simple-handover](acceptance-final/simple-handover-build21.json)；[routes](acceptance-final/routes-build21.json)。

PDA装袋/重装实际流程有5样本； build21对应命名入口、适用性能与最终源码联审已通过。

### UX-002

每个款式面料具备对应真实图。

证据：[L1](acceptance-final/list-actions-build21.json)；[P1](acceptance-final/print-images-build21.json)；[B3](acceptance-bag-lifecycle/web-detail-five-samples-build7.json)。

最终同版：[print-images](acceptance-final/print-images-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[simple-handover](acceptance-final/simple-handover-build21.json)；[routes](acceptance-final/routes-build21.json)。

可见图片加载/零损坏有技术证据；“对应真实图”的语义对应须主代理视觉核对，不能仅naturalWidth>0推定。 build21对应命名入口、适用性能与最终源码联审已通过。

### UX-003

图片失败及大图关闭行为可用。

证据：[L2](acceptance-final/extra-controls-build21.json)；[P1](acceptance-final/print-images-build21.json)。

最终同版：[print-images](acceptance-final/print-images-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[simple-handover](acceptance-final/simple-handover-build21.json)；[routes](acceptance-final/routes-build21.json)。

图片故障恢复、大图Esc关闭有结果；L2重置慢样本与图片功能分别判定。 build21对应命名入口、适用性能与最终源码联审已通过。

### UX-004

保存失败保留选择且可幂等重试。

证据：[S2](acceptance-part-tickets/browser-eight-sources-final.txt)；[B2](acceptance-bag-lifecycle/lifecycle-five-samples-build7.json)；[B4](acceptance-legacy-bags/preview-five-samples-build8.json)；[D6](acceptance-part-tickets/performance-build7.json)。

最终同版：[print-images](acceptance-final/print-images-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[simple-handover](acceptance-final/simple-handover-build21.json)；[routes](acceptance-final/routes-build21.json)。

真实生成/拆解/样衣/合同/手工票/铺布/袋动作失败均保留输入后重试； build21对应命名入口、适用性能与最终源码联审已通过。

### UX-005

指定低分辨率无主体溢出。

证据：[L1](acceptance-final/list-actions-build21.json)；[D5](acceptance-final/mixed-backup-final.json)；[B1](acceptance-bag-lifecycle/hpb-scan-five-samples-build7.json)；[B2](acceptance-bag-lifecycle/lifecycle-five-samples-build7.json)。

最终同版：[print-images](acceptance-final/print-images-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[simple-handover](acceptance-final/simple-handover-build21.json)；[routes](acceptance-final/routes-build21.json)。

列表1366/1280/1024与混装Web1366/PDA360或390实测；逐页面对应设备，不声称所有页面都测过全部尺寸。 build21对应命名入口、适用性能与最终源码联审已通过。

### PERF-001

各路由加载场景逐样本小于 500ms。

证据：[R2](acceptance-final/routes-build21.json)；[R3](acceptance-source-ui-final/perf-build9.json)；[B1](acceptance-bag-lifecycle/hpb-scan-five-samples-build7.json)；[B4](acceptance-legacy-bags/preview-five-samples-build8.json)；[D6](acceptance-part-tickets/performance-build7.json)；[M1](acceptance-final/marker-build11.json)。

最终同版：[routes](acceptance-final/routes-build21.json)；[source-routes](acceptance-final/source-routes-build21.json)；[part](acceptance-final/part-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)。

最终build21完整28组实际通过，1280个计时样本最大463ms、issues=[]。所有旧慢样本保留，未降低500ms预算、未移除慢样本；各真实读写/计算/图片/渲染终点及window-capture Esc在脚本中。

### PERF-002

全部适用交互逐样本小于 500ms。

证据：[L1](acceptance-final/list-actions-build21.json)；[L2](acceptance-final/extra-controls-build21.json)；[P1](acceptance-final/print-images-build21.json)；[P2](acceptance-final/print-controls-build21.json)；[B1](acceptance-bag-lifecycle/hpb-scan-five-samples-build7.json)；[B4](acceptance-legacy-bags/preview-five-samples-build8.json)；[D6](acceptance-part-tickets/performance-build7.json)；[D7](acceptance-source-ui-final/generation-build8.json)；[M1](acceptance-final/marker-build11.json)。

最终同版：[routes](acceptance-final/routes-build21.json)；[source-routes](acceptance-final/source-routes-build21.json)；[part](acceptance-final/part-build21.json)；[batch-ui](acceptance-final/batch-ui-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)。

最终build21完整28组实际通过，1280个计时样本最大463ms、issues=[]。所有旧慢样本保留，未降低500ms预算、未移除慢样本；各真实读写/计算/图片/渲染终点及window-capture Esc在脚本中。

### STORE-001

业务按记录保存到 IndexedDB。

证据：[S1](acceptance-final/source-core-final.json)；[S2](acceptance-part-tickets/browser-eight-sources-final.txt)；[S3](acceptance-final/migration-final.json)；[B4](acceptance-legacy-bags/preview-five-samples-build8.json)；[D6](acceptance-part-tickets/performance-build7.json)；[D7](acceptance-source-ui-final/generation-build8.json)。

最终同版：[backup](acceptance-final/backup-build21.json)；[data-tools](acceptance-final/data-tools-build21.json)；[source-generation](acceptance-final/source-generation-build21.json)；[part](acceptance-final/part-build21.json)。

按记录/普通读不落种子有核心与真实入口证据；仅登记范围，唛架未迁移库存/旧提前加工只读边界明确。 build21对应命名入口、适用性能与最终源码联审已通过。

### STORE-002

普通读取不落盘种子或建票。

证据：[S1](acceptance-final/source-core-final.json)；[S2](acceptance-part-tickets/browser-eight-sources-final.txt)；[S3](acceptance-final/migration-final.json)；[B4](acceptance-legacy-bags/preview-five-samples-build8.json)；[D6](acceptance-part-tickets/performance-build7.json)；[D7](acceptance-source-ui-final/generation-build8.json)。

最终同版：[backup](acceptance-final/backup-build21.json)；[data-tools](acceptance-final/data-tools-build21.json)；[source-generation](acceptance-final/source-generation-build21.json)；[part](acceptance-final/part-build21.json)。

按记录/普通读不落种子有核心与真实入口证据；仅登记范围，唛架未迁移库存/旧提前加工只读边界明确。 build21对应命名入口、适用性能与最终源码联审已通过。

### STORE-003

同动作事务完成后才显示成功。

证据：[S1](acceptance-final/source-core-final.json)；[S2](acceptance-part-tickets/browser-eight-sources-final.txt)；[D6](acceptance-part-tickets/performance-build7.json)；[D7](acceptance-source-ui-final/generation-build8.json)；[B4](acceptance-legacy-bags/preview-five-samples-build8.json)。

最终同版：[backup](acceptance-final/backup-build21.json)；[data-tools](acceptance-final/data-tools-build21.json)；[source-generation](acceptance-final/source-generation-build21.json)；[part](acceptance-final/part-build21.json)。

事务complete前不发布、CAS/失败不回退有直接浏览器IDB注入及实际UI结果。 build21对应命名入口、适用性能与最终源码联审已通过。

### STORE-004

多标签版本冲突不静默覆盖。

证据：[S1](acceptance-final/source-core-final.json)；[S2](acceptance-part-tickets/browser-eight-sources-final.txt)；[D6](acceptance-part-tickets/performance-build7.json)；[D7](acceptance-source-ui-final/generation-build8.json)；[B4](acceptance-legacy-bags/preview-five-samples-build8.json)。

最终同版：[backup](acceptance-final/backup-build21.json)；[data-tools](acceptance-final/data-tools-build21.json)；[source-generation](acceptance-final/source-generation-build21.json)；[part](acceptance-final/part-build21.json)。

本条记录级技术契约已验证；仅适用于登记存储范围，不代表产品接受。 build21对应命名入口、适用性能与最终源码联审已通过。

### STORE-005

下游直达独立读持久记录。

证据：[S1](acceptance-final/source-core-final.json)；[S2](acceptance-part-tickets/browser-eight-sources-final.txt)；[D4](acceptance-final/simple-disabled-final.json)；[D8](acceptance-final/history-print-build21.json)；[D6](acceptance-part-tickets/performance-build7.json)。

最终同版：[backup](acceptance-final/backup-build21.json)；[data-tools](acceptance-final/data-tools-build21.json)；[source-generation](acceptance-final/source-generation-build21.json)；[part](acceptance-final/part-build21.json)。

禁LS重开、票打印、直接交出及历史补打已测；唛架页仅禁迁移15键，不能引用它为全LS业务通过。 build21对应命名入口、适用性能与最终源码联审已通过。

### STORE-006

localStorage 失败不影响已迁移业务。

证据：[S1](acceptance-final/source-core-final.json)；[S2](acceptance-part-tickets/browser-eight-sources-final.txt)；[D4](acceptance-final/simple-disabled-final.json)；[D8](acceptance-final/history-print-build21.json)；[D6](acceptance-part-tickets/performance-build7.json)。

最终同版：[backup](acceptance-final/backup-build21.json)；[data-tools](acceptance-final/data-tools-build21.json)；[source-generation](acceptance-final/source-generation-build21.json)；[part](acceptance-final/part-build21.json)。

禁全部localStorage的HPB/部位票打印/已迁移交出与恢复有功能证据；唛架库存仍依赖未迁移收料事实，只禁15个已迁移键通过，不能宣称全站脱离localStorage。 build21对应命名入口、适用性能与最终源码联审已通过。

### STORE-007

IndexedDB 失败不回退旧业务存储。

证据：[S1](acceptance-final/source-core-final.json)；[S2](acceptance-part-tickets/browser-eight-sources-final.txt)；[D6](acceptance-part-tickets/performance-build7.json)；[D7](acceptance-source-ui-final/generation-build8.json)；[B4](acceptance-legacy-bags/preview-five-samples-build8.json)。

最终同版：[backup](acceptance-final/backup-build21.json)；[data-tools](acceptance-final/data-tools-build21.json)；[source-generation](acceptance-final/source-generation-build21.json)；[part](acceptance-final/part-build21.json)。

事务complete前不发布、CAS/失败不回退有直接浏览器IDB注入及实际UI结果。 build21对应命名入口、适用性能与最终源码联审已通过。

### STORE-008

迁移中断恢复不重复不丢失。

证据：[S1](acceptance-final/source-core-final.json)；[S2](acceptance-part-tickets/browser-eight-sources-final.txt)；[S3](acceptance-final/migration-final.json)。

最终同版：[backup](acceptance-final/backup-build21.json)；[data-tools](acceptance-final/data-tools-build21.json)；[source-generation](acceptance-final/source-generation-build21.json)；[part](acceptance-final/part-build21.json)。

本条记录级技术契约已验证；仅适用于登记存储范围，不代表产品接受。 build21对应命名入口、适用性能与最终源码联审已通过。

### STORE-009

仅清理已读回验证的源项。

证据：[S1](acceptance-final/source-core-final.json)；[S2](acceptance-part-tickets/browser-eight-sources-final.txt)；[S3](acceptance-final/migration-final.json)。

最终同版：[backup](acceptance-final/backup-build21.json)；[data-tools](acceptance-final/data-tools-build21.json)；[source-generation](acceptance-final/source-generation-build21.json)；[part](acceptance-final/part-build21.json)。

本条记录级技术契约已验证；仅适用于登记存储范围，不代表产品接受。 build21对应命名入口、适用性能与最终源码联审已通过。

### STORE-010

共用旧键保留其他模块记录。

证据：[S1](acceptance-final/source-core-final.json)；[S2](acceptance-part-tickets/browser-eight-sources-final.txt)；[S3](acceptance-final/migration-final.json)。

最终同版：[backup](acceptance-final/backup-build21.json)；[data-tools](acceptance-final/data-tools-build21.json)；[source-generation](acceptance-final/source-generation-build21.json)；[part](acceptance-final/part-build21.json)。

本条记录级技术契约已验证；仅适用于登记存储范围，不代表产品接受。 build21对应命名入口、适用性能与最终源码联审已通过。

### STORE-011

旧连接升级冲突有可恢复提示。

证据：[S4](acceptance-final/upgrade-blocked-final.txt)。

最终同版：[backup](acceptance-final/backup-build21.json)；[data-tools](acceptance-final/data-tools-build21.json)；[source-generation](acceptance-final/source-generation-build21.json)；[part](acceptance-final/part-build21.json)。

本条记录级技术契约已验证；仅适用于登记存储范围，不代表产品接受。 build21对应命名入口、适用性能与最终源码联审已通过。

### STORE-012

完整备份可校验后恢复。

证据：[S5](acceptance-final/backup-build21.json)。

最终同版：[backup](acceptance-final/backup-build21.json)；[data-tools](acceptance-final/data-tools-build21.json)；[source-generation](acceptance-final/source-generation-build21.json)；[part](acceptance-final/part-build21.json)。

本条记录级技术契约已验证；仅适用于登记存储范围，不代表产品接受。 build21对应命名入口、适用性能与最终源码联审已通过。

### STORE-013

附件保存原始 Blob 及引用。

证据：[S6](acceptance-final/files-final.json)；[D7](acceptance-source-ui-final/generation-build8.json)；[L3](acceptance-final/data-tools-build21.json)。

最终同版：[backup](acceptance-final/backup-build21.json)；[data-tools](acceptance-final/data-tools-build21.json)；[source-generation](acceptance-final/source-generation-build21.json)；[part](acceptance-final/part-build21.json)。

本条记录级技术契约已验证；仅适用于登记存储范围，不代表产品接受。 build21对应命名入口、适用性能与最终源码联审已通过。

### STORE-014

无引用清理不误删有效附件。

证据：[S6](acceptance-final/files-final.json)；[D7](acceptance-source-ui-final/generation-build8.json)；[L3](acceptance-final/data-tools-build21.json)。

最终同版：[backup](acceptance-final/backup-build21.json)；[data-tools](acceptance-final/data-tools-build21.json)；[source-generation](acceptance-final/source-generation-build21.json)；[part](acceptance-final/part-build21.json)。

本条记录级技术契约已验证；仅适用于登记存储范围，不代表产品接受。 build21对应命名入口、适用性能与最终源码联审已通过。

### DATA-001

Mock 覆盖多角色多任务正常边界。

证据：[D1](acceptance-source-ui-final/actions-build7.json)；[D3](acceptance-final/two-factories-final.json)；[B2](acceptance-bag-lifecycle/lifecycle-five-samples-build7.json)。

最终同版：[routes](acceptance-final/routes-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[part](acceptance-final/part-build21.json)；[source-generation](acceptance-final/source-generation-build21.json)。

正常、缺资料、完整空集、同名不同料、新增需料、改派、三合一、多袋、重复、跨单、历史和回收都有明确Mock前置及真实动作；不把Mock当工厂事实。

### VERIFY-001

每条需求有当前实现与证据对应。

证据：见追踪审计。

最终同版：[routes](acceptance-final/routes-build21.json)；[web-detail](acceptance-final/web-detail-build21.json)；[part](acceptance-final/part-build21.json)；[source-generation](acceptance-final/source-generation-build21.json)。

主代理已完成92条正反向语义追踪及完整相关diff审查；技术证据与最后源码匹配。最终冻结workflow/发布收据独立生成，用户accepted及D04不被技术状态替代。

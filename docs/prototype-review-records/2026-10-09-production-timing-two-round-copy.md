# 生产时效两轮对抗审查与文案修复记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 日期 / 时区 | 2026-10-09 / Asia/Shanghai |
| 任务 | 第一轮开发审查、第二轮业务审查，查漏补缺并修正文案歧义与堆砌 |
| 角色 / 端 | DDS管理端同屏：一线业务、业务主管、高管；PCS/FCS/PFOS/WLS关联单据只读详情 |
| 分支 / 工作树 | codex/dds-task-business-review / /Users/laoer/.codex/worktrees/d29f/higoods |
| 基线 HEAD | 8a7407989fd06753e57527306e9b06d74ec98fac |
| 实际服务 | node19929工作目录核对为本工作树；http://localhost:4179 |
| 最终资源 | assets/index-CB9bGVLs.js；文案冻结资源7LvFuhsC之后仅增加@media print紧凑布局 |
| 数据 | 20场景，2048张共享Mock单据；fixture SHA256 958d27560fcaa45df50ba3aeb3fe1bd7125b2186b88bad140db1170d35d50752 |
| 当前接受与发布 | 本地技术验收；页面效果待用户接受，本轮未提交、合并或推送 |

控制面：[11项原子需求](../product-design/production-fulfillment-timeliness/two-round-copy-audit-20261009.md)、[完整证据目录](timing-copy-two-rounds-evidence)、[问题登记](timing-copy-two-rounds-evidence/findings.json)。审查遵循AGENTS.md第2/3/4/5/7/8节。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：主图、阶段摘要、展开链路、单据弹窗与原模块只读详情的状态/数量/时间文案修改；fullContract主裁床数量与放行范围冲突纠正；完整展开打印样式紧凑化。

业务口径保持：最早采购＋28自然日，全量入成衣仓；准备4/定位印5天；采购到仓8天；辅助每道3天；合同按业务分配日计时；加工与交接分开；样衣不改变回货；后道每批一张加工单，复核SKU数量和条码。仅修Mock主裁床范围，整单1500、任务800/500/200、物料各单位数量、后道实收及成衣仓480保持。不在DDS增加办理业务或未经确认的SLA。

存储登记：固定fixtures→source→页面普通只读。没有新增或改变IndexedDB、localStorage业务写入、迁移、附件、跟进保存、清空或真实数据库操作；相应存储写入故障/多标签冲突/迁移验收不适用。本轮不改后道工厂办理逻辑、PDA或打印菲票。

## 3. 自查结论

| 项目 | 结论 | 当前直接证据 |
| --- | --- | --- |
| 开发轮 | 通过 | 一个只读代理检查共享事实与渲染分支，主代理实际diff整合；D01—D05 |
| 业务轮 | 通过 | 主代理逐场景实际页面/弹窗/来源详情检查；B01—B07，不以截图或测试代替业务判断 |
| 图示与业务事实 | 通过 | 全程图保留；主裁床1000与B承包500分开；仅B承包未完成；部分入库没有全量勾号；当前/历史状态同时可见 |
| 文案与信息量 | 通过 | 计时名称忠实动作；重复时间/数量/规则删减；未处理与待记录结果分开；实际弹窗明确实收/实领；未到期与当前欠量分开 |
| 单据与数量 | 通过 | 28类单据摘要、原模块详情；同一静态来源；107项专项契约，核心范围差异41张关联单据；仅删除虚假的500放行单 |
| 命名路由与设备 | 通过 | PO-0101和采购待关联240776等20场景；1366×768路由3模式各5次，1280×720及1024×768每场景收起/展开各一遍；无横向溢出、破图 |
| 交互及图片 | 通过 | 20场景展开/收起各5次；28类摘要开关、15类数量/合同节点明细、六摘要定位、五阶段独立开关、跟进清单；实际新标签5次；款式大图/全屏开关5次，图片decode后两帧完成 |
| 原模块直达 | 通过 | 28类原模块冷开及刷新各5次；时间、状态、人员、关联单据均保留；唯一POST三个项目一组数量/时钟，RC仅数量条码 |
| 打印 | 通过 | 完整展开原23页首次1272ms失败；仅打印紧凑布局后22页五次935/794/772/766/759ms；全部事实保留，实际渲染第20页可读 |
| 性能门禁AGENTS§7.2 | 通过 | 最终路由300样本最大225.3ms；文案动作835样本最大127.8ms，最终资源补测31；原模块280最大204.5ms；打印5次最大935ms；所有原始样本含首轮失败均保留 |

证据中7Lv为最后一次文案/数据修改后的版本。随后仅`@media print`规则改动，TS模板/静态事实/非打印样式完全相同；相关非打印交互和原模块证据保留其准确版本，最终CB再核20路由300加载、两个低分辨率40场景视图及全屏/大图/弹窗。打印按最终CB重测。先前BGw/CpS中间样本单独归档，不混算最终性能。

## 4. 问题标签

看不懂、文案歧义、重复说明、状态误导、数量重复、对象范围冲突、追溯不清、打印超时。

## 5. 两轮发现与闭环

| 编号 / 级别 | 审查轮 | 问题 | 当前修复 | 需求 | 状态 |
| --- | --- | --- | --- | --- | --- |
|D-01 P1|开发|主裁床整单1500件已裁出/放行与B500承包裁剪未完成矛盾|主裁床A800+C200范围1000件；B500独立承包裁剪；41张相关单据一致，删除虚假的500件放行单|COPY-211|已验证|
|D-02 P2|开发|采购待关联场景的分配/车缝轨道显示后道资料缺失|按实际对象显示分配记录待核实、车缝执行记录待核实|COPY-208|已验证|
|D-03 P2|开发|缺资料仍显示王明分配，弹窗将采购号写作生产单|责任未知保持待核实；无关联生产单时标题为商品采购240776|COPY-208|已验证|
|D-04 P2|开发|部分入库480/1500仍带整单完成勾号|全部应完成数量入仓后才显示完成标志|COPY-202|已验证|
|D-05 P2|开发|相邻卡片重复开始时间、状态数量和数量块|同一卡片保留一处实际开始、一组结构化数量；实际完成、人员和交接仍保留|COPY-204|已验证|
|B-01 P2|业务|后道质检、复核、车缝都叫制作|计时名称改为质检、数量与条码复核、车缝、裁剪、烫包，与真实动作一致|COPY-201|已验证|
|B-02 P2|业务|混合状态的轨道仅显示进行中，已完成记录看不到|同屏显示进行中和已完成数量，缺完成时间独立说明|COPY-203|已验证|
|B-03 P2|业务|未处理0件容易误解为没有剩余工作|标成已确认未处理；另列尚待记录处理结果60件/90件等|COPY-205|已验证|
|B-04 P2|业务|合同弹窗0/500含义不明；分配用实心菱形与未达标符号混淆；后续目标重复|实际弹窗注明后道实收/工厂实领；分配不带超时符号，未到期要求不计当前欠量|COPY-206|已验证|
|B-05 P2|业务|主图、每批链路和原模块详情重复规则、角色和跳转说明|保留必要位置的一条规则；精简说明，后道原模块四类数量不重复两次|COPY-207|已验证|
|B-06 P2|业务|未来截止处1500件全部入库易被当成已经入库|目标刻度标为入库目标1500件，实际480单独标注|COPY-208|已验证|
|B-07 P2|业务|已完成订单仍在当前优先处理列重复整单结果|结果集中在截止栏；后续处理注明无需继续生产或核实最后入库时间|COPY-207|已验证|
|V-01 P1|最终验证|完整展开首次打印23页，生成1272ms超过门禁|仅打印样式紧凑排版，全部事实仍保留；22页PDF五次935/794/772/766/759ms|COPY-210|已验证|

开发轮发现D01为数据范围冲突，依据三合同和明确承包范围修正Mock；不是用说明掩盖矛盾。业务轮实际弹窗复核发现B04先前只改到备用分支，改实际`details`入口并增加回归断言。其余修改不删除核心事实，不把未知当未开展或完成，不把已完成晚到继续计算当前超时。

工具诊断如实保留：一次30秒批量工具超时后恢复95个已完成样本继续验收；两次短按钮名定位不匹配根据实际DOM改为“收起完整跟进清单”“退出全屏”。测量辅助函数固化旧资源名后已重新创建，未接受混合版本样本。这是工具定位/批量执行诊断，没有伪造页面失败或剔除慢样本。见performance-summary.json。

## 6. 最终结论

结论：通过。本轮12项内容问题及打印门禁发现项均已修复和复核。实现已在同一工作树4179呈现；技术检查不替代用户效果接受。此前V7历史独立门禁不因本轮通过而自动关闭。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/production-timing/source.ts`
- `src/data/production-timing/fixtures.json`
- `src/pages/production-fulfillment/index.ts`
- `src/pages/production-fulfillment/production-order-diagrams.css`
- `src/pages/production-fulfillment/production-order-diagrams.ts`
- `src/pages/production-fulfillment/full-flow-diagrams.ts`
- `src/pages/production-fulfillment/source-document-detail.ts`
- `tests/unit/production-timing-copy.test.ts`
- `tests/unit/production-timing-scenarios.test.ts`
- `tests/unit/production-timing-full-flow-diagrams.test.ts`
- `tests/unit/production-timing-full-flow-fixtures.test.ts`
- `tests/unit/production-timing-full-flow-source-detail.test.ts`

保留前一轮原型接入改动，新增本轮控制面和证据；本轮增量diff为turn-code.diff，Mock183字段均在fullContract分支内，见fixture-scope-diff.json。没有吸收无关业务变化。

### 验证命令

- `node --import tsx --test tests/unit/production-timing-copy.test.ts tests/unit/production-timing-full-flow-source-detail.test.ts tests/unit/production-timing-full-flow-diagrams.test.ts tests/unit/production-timing-full-flow-fixtures.test.ts tests/unit/production-timing-scenarios.test.ts`：通过，107/107。
- `npm run typecheck:engineering`、`npm test`：通过，最终源码613/613测试、工程检查范围内0错误，结果归档final-typecheck.log与final-tests.log；`npx vite build`构建及实际页面已核验。项目最终`npm run build`由workflow执行并绑定当前差异。
- `npx vite build`：通过，最终CB9bGVLs，print-build.log。
- `git diff --check`：通过。
- `codegraph sync`、`codegraph status --json`：通过；状态原始文件随证据归档。
- `npm run workflow:verify -- --output /tmp/timing-copy-two-rounds-receipt.json --task-boundary '生产时效两轮开发/业务对抗审查，修正文案、单据摘要与Mock范围冲突，并完成命名页面和打印验证；保留上一轮全程补齐增量'`：冻结后执行并以实际收据为最终门禁；完整日志与收据为/tmp/timing-copy-two-rounds-workflow.log、/tmp/timing-copy-two-rounds-receipt.json。

### 例外

- 无性能例外。首轮打印失败已实际修复和复测，不能用平均耗时掩盖1272ms。
- PDA、扫码、附件上传、浏览器数据迁移、保存/提交故障：不适用，本轮不修改这些动作。
- 原模块单据仅为Mock只读详情，不表示真实工厂业务已经完成；效果待用户验收，Git发布不在本次范围。

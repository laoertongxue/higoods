# 生产时效后道阶段归并与时间展示审查

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 日期与任务 | 2026-10-09；POST-FOLD-001—008 |
| 记录模式 | 完整产品审查 |
| 系统、角色与端 | DDS管理端；一线业务人员、主管、高管同屏查看 |
| 分支、HEAD与工作树 | codex/dds-task-business-review；77da48e02bec888e36bdeb79a2b9247e0d02dad7；/Users/laoer/.codex/worktrees/d29f/higoods |
| 实际服务 | localhost:4179，node19929工作目录已核对为本工作树 |
| 命名页面 | /dds/supply-chain/production-fulfillment/orders/PO-202610-0101；用户截图内容另核对PO-202610-0092 |
| 最终资源 | index-QXnvFeEk.js；屏幕实现冻结资源index-CowAGUVp.js之后，仅增加打印媒体分页和间距规则 |
| 验收设备 | Codex In-app Browser；1366×768、1280×720、1024×768，全部记录实际innerWidth/innerHeight |
| 当前交付状态 | 本地已验证，效果待用户确认；本轮未提交、合并、推送 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：主图后道由五行归并为一行；展开内显示四项工作时间图与批次单据；车缝执行名称统一；收起阶段和展开工作增加实际时间、耗时、已确认标准对应结果与未知要求说明；打印重新分页。
- 当前基线：AGENTS.md第2/3/4/5/7/8节。范围只含本模块图示与相关活动规范，不改后道工厂办理流程、合同计时规则、数量、人员、路由或浏览器存储。

存储登记：静态fixtures→source登记→监控图与现有只读单据详情。仅更名一处Mock说明，全部单据号、数量、人员、实际日期和要求保留。无新增保存、文件、IndexedDB/localStorage写入、迁移、清空或真实数据库操作；相应存储故障与迁移验收不适用，既有跟进保存保持。

## 3. 自查结论

| 检查项 | 结论 | 证据与适用范围 |
| --- | --- | --- |
| 角色、任务与图示 | 通过 | 后道主图仅一行，四类工作嵌套；主管看阶段摘要，一线展开批次单据，高管保留整单目标；不增加角色页 |
| 文案、状态、数量与单位 | 通过 | 车缝执行统一；实际开始/完成、进行中最长已用与完成最长耗时分开；当前超时、完成时延误、未确认要求分开；不累加并行耗时 |
| 对象识别与真实图片 | 通过 | 保留shirt-086实图，所有受测页面必要图片decode后两帧完成，无破图；本次未改图片、图源和大图交互；扫码不适用管理监控 |
| 防错与办理边界 | 通过 | 不编造后道SLA和未发生单据；无需加工保持质检直接交货；未开始/资料缺失分别说明；不在监控办理加工或接收 |
| 交接与追溯 | 通过 | 制作与交出—下游接收分计；后道每批唯一加工单，复核是数量与条码；四类单据摘要和原模块详情一致 |
| 低分辨率与恢复 | 通过 | 两个低分辨率全部20场景收起/展开共80视图，后道开关各5次共400次；实际尺寸确认，无横向溢出；PDA、上传、弱网写入不适用，本次无写入 |
| 命名页面、弹窗与新标签 | 通过 | 20场景各5次冷载/刷新/切换；后道单阶段、全部展开、摘要定位、车缝开关、四类工作明细和单据摘要；原模块实际新标签与每类5次冷载/刷新 |
| 打印 | 通过 | 全部阶段展开，19页；五次972/782/810/807/807ms；第15页后道时间图、第16页批次单据实际渲染可读，全部事实保留 |
| 性能AGENTS§7.2 | 通过 | 路由300样本最大111.600000ms；动作388样本最大59.100000ms；窄屏400样本最大35.100000ms；原详情42样本最大253.400000ms；最终打印5样本最大972ms。原始精度见JSON，不以此表的格式化值代替判定 |

## 4. 问题标签

阶段层级错误、追溯不清、时间缺失、时效误导、文案堆砌、打印超时。

## 5. 主要问题与处理

| 问题 | 处理 | 当前风险 |
| --- | --- | --- |
| 后道四项内部工作常驻主图 | postFlowRows仅生成后道；postWorkRows嵌入branch-post；主图、摘要及明细入口读取同一展开内容 | 无 |
| 汇总仅有几项已完成，无实际时间 | fullFlowTimeSummary从已登记单据读取实际起止、独立时钟最长用时；多批完成保留各自时间与单据 | 无 |
| 当前工作与完成历史的时间混算 | 长条表示实际记录范围，耗时明确为各独立时钟的最大值；单项待收沿自身交出时间，不由最早历史开始算成等待 | 无 |
| 未配置标准无法判逾期 | 显示要求未确认；已确认要求支持当前超时/完成时延误与要求截止；synthetic unit覆盖两分支，不擅自给当前Mock添加SLA | 当前Mock后道要求未确认是数据边界，不表述为按期 |
| 具体车缝执行名称及重复耗时 | 页面、阶段摘要、展开标题、入口和活动规范统一车缝执行；摘要重复的最长耗时删去 | 无 |
| 展开子图与外层日期轴不对齐 | 子图添加自身同口径日期轴，与内部四行网格列对齐 | 无 |
| 首次完整展开打印1134ms | 只改打印媒体：批次可跨页、单张单据保持完整、列宽和间距紧凑；22页重排为19页；新验收标签首次972ms，后续四次均通过 | 无未通过门禁项 |

## 6. 最终结论

结论：通过

八项已由当前实现、140项相关专项契约、635项全量测试、实际页面、交互、打印和性能证据闭环。已知要求的后道逾期分支仅在合成单元场景验证；当前固定Mock无确认后道SLA，真实浏览器验收如实显示实际用时与要求未确认。用户效果确认及Git发布是独立后续状态。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/production-fulfillment/production-order-diagrams.ts`
- `src/pages/production-fulfillment/production-order-diagrams.css`
- `src/pages/production-fulfillment/full-flow-diagrams.ts`
- `src/data/production-timing/source.ts`
- `src/data/production-timing/fixtures.json`

### 页面路由

- /dds/supply-chain/production-fulfillment/orders/PO-202610-0101
- /dds/supply-chain/production-fulfillment/orders/PO-202610-0092
- /dds/supply-chain/production-fulfillment/pending-purchases/240776
- 其余17场景及4类原单据详情实际地址逐项见production-timing-post-stage-evidence/manifest.json与browser-new-tabs.json

### 验证命令

- `node --import tsx --test tests/unit/production-timing-post-stage.test.ts tests/unit/production-timing-full-flow-diagrams.test.ts tests/unit/production-timing-full-flow-fixtures.test.ts tests/unit/production-timing-copy.test.ts tests/unit/production-timing-scenarios.test.ts tests/unit/production-timing-source-detail.test.ts tests/unit/production-timing-full-flow-source-detail.test.ts`：通过，140/140；日志专项-tests.log。
- `npm run build`：通过，635/635、工程类型检查及Vite构建；日志final-build.log。
- `npm run check:list-page-governance:static`：通过，561页面、12历史基线。
- `npm run check:prototype-design-governance -- --all`：通过，5个用户可见受管文件、1条关联记录；原始结果governance.log。
- `codegraph sync`、`codegraph status --json`：通过；pendingChanges为0、worktreeMismatch为空，见codegraph-status.json。

最终任务收据独立记录于`/tmp/production-timing-post-stage-receipt.json`，用于核对当前差异与项目级检查；不替代以上页面证据。

### 证据与版本

[控制面](../product-design/production-fulfillment-timeliness/post-stage-folding-20261009.md)、[样本汇总](production-timing-post-stage-evidence/acceptance-summary.json)、[最终展开截图](production-timing-post-stage-evidence/expanded-final-1366.png)、[实际打印页](production-timing-post-stage-evidence/print-page-15.png)。

Cow版本之后只改最后打印媒体规则；屏幕模板、数据和非打印规则完全相同。QX最终资源另核20场景、两个实际低分辨率80视图与400开关、打印以及用户0101页面。测量代码、精确耗时、源文件SHA256与资源版本均保留。最初浏览器viewport设置未应用后台标签，实际仍1366，相关记录不作为窄屏证据；改用验收标签CDP实际尺寸后全量重测。一次采样会话超时丢失未落盘样本，已以逐次落盘方式重测；提前读取新标签列表未见标签，下一调用确认标签及内容，未冒充业务路由缺失。

### 例外

- 无性能例外。首轮1134ms失败记录保留于print-failed-and-warm-samples.json；修正后五次全通过。
- 固定Mock无确认后道SLA，不新增任意天数。无标准不判按期/超时，不将28天整单入仓期限套作后道加工标准。

# 采购管理对齐实施计划

本任务继承当前 AGENTS.md；原型基线为 `ee14949905b08b260e9c6309eebc59bfa5b32764`。测试现场清单与21页实施已完成，当前记录315条加载验收、31个分批直接复验case技术通过，以及待生成的最终收据。正式环境历史记录不作为当前测试或原型验收证据。

目标是按 `inventory/` 中逐按钮测试记录补齐 21 页现有采购原型，完整删除用户指定的 6 项基础资料对象。保持 Vite、Vanilla TypeScript 字符串模板和现有标准列表组件；不新增后端、真实集成、框架或依赖。原子需求及来源在 `requirements-matrix.json`，实施后绑定实际文件、验证与版本。源错误、无样本和外部待对接能力保持真实边界，不把错误界面复刻为产品功能。

菜单按测试站的采购建议、商品采购、面辅料采购、面辅料供应商确认、头程物流、库存查询、采购对账、KOL样衣申请、基础资料排列。保留 21 个叶子和每级图标。基础资料仅商品供应商管理、供应商供货档案、头程物流商管理。

## 依赖与负责范围

| 工作包 | 业务目标与文件 | 修改 | 验证与关闭条件 |
|---|---|---|---|
| WP-FOUNDATION | `idb-storage.ts`、`runtime.ts`、`pms-handlers.ts`、必要公共 UI | 同事务保存当前动作记录/明细/日志/附件，失败不报成功；await handler；局部交互 | 正常、打开失败、中止、重复、版本冲突、刷新与直达；共享受影响消费者检查 |
| WP-REMOVE | 六对象页面/数据、菜单/路由/renderers/handlers、直接消费者和专项检查 | 删除独立对象，采购读取既有 PCS 档案/SKU/技术资料和 WLS 仓库；采购自身历史快照保留 | 当前工程无旧对象导入/符号/入口，旧地址退役，合法直接上下游仍可运行；不得清空用户数据 |
| WP-CORE | 建议、KOL需求、商品采购单、备货、售后页面及数据 | 清单筛选/表单/状态动作/批量/明细/导出；备货真实生成原型采购单，售后可刷新回读 | 每页正常与边界；下游采购单独立读取；保存失败保留输入；两页 Mock/真实图 |
| WP-MATERIAL | 需求、面辅料采购单、跟踪、时效页面及数据 | 分组明细/采购关联/物流/费用/打印导出/日期，复用既有 PCS 物料唯一身份 | 需求→采购→物流/确认/请款直接链；单位/数量、正常/越界、原子回读 |
| WP-OPS | 确认、头程、库存、两请款、KOL四页 | 现有表单字段与动作，KOL锁定/释放/申请/链接及真实日志；原始附件 Blob | 保存/失败/刷新/直达；锁定守恒/支付余额/附件引用及预览 |
| WP-BASIC | 供应商、供货档案、物流商页面及数据 | 按清单完善 CRUD、导入导出、渠道及查询，移除退休基础对象依赖 | 正常、必填、禁用、重复、刷新；切换公司同步渠道 |
| WP-ACCEPT | 范围内契约、21实际页面、治理/审查记录 | 两页静态演示、图片预览、1366×768/1280×720、性能样本 | 专项测试/typecheck/build/范围治理/完整 diff；原子矩阵闭合后才能称交付 |

先冻结全部可用入口证据，再开始源代码。最后三组只读筛选补充单独追加，不能改旧冻结 SHA。最终测试站写入始终不执行；此限制不阻止在本地原型验证保存结果。

## 数据与 Mock

固定演示记录直接读取，不在首次访问落盘。用户动作按记录保存 IndexedDB；相关主单、明细、结果、操作记录及附件实体同库同事务，complete 后发布内存和成功。新增业务记录与旧覆盖值分别合并静态源；删除仅记录 tombstone。业务数据不写 localStorage，偏好沿用已有路由键。共享保存附带稳定操作编号与规范化业务输入签名；同次重试回读，改内容不得冒用旧成功。PPO 入出库使用本地 SKU/仓库余额及动作明细共同保存，样衣与 KOL 库存联动。

各有效列表通常采用默认 5 或 10 条，使固定演示场景恰为两页；面辅料需求仅有 3 个合法来源分组，采用默认 2 条形成两页，不虚构来源，已有 11–20 条保留默认 10；不足页数补最少合法关联记录。用户实际记录数量不受两页限制。过滤后的空结果不添加虚假数据。选款/选料使用实际对应图片及唯一档案身份，缺素材的旧演示对象改为已存在且有对应素材的有效来源对象，保留用户记录身份。

旧六项对象不再可写；物料、SKU、单位、仓库与 BOM 作为仍有效采购属性，从现有共享事实读取，不建设同名替代管理页。旧物理持久数据没有清空授权，登记并保留恢复边界；不得通过换名整包存储维持已退役对象。

共享本地资料入口复用备份/恢复能力，备份保存原始附件字节；错误格式、重复附件或冲突整批拒绝，不覆盖当前记录。已退役对象的旧物理资料保留在当前浏览器，不纳入本版本活动对象恢复。原生确认改为页内确认，避免阻塞浏览器控制，保留明确后果及取消。

## 验收与非范围

管理列表对齐染色加工单布局，查询同步列表/统计/总数，导出全部筛选结果。弹窗与行操作局部更新；真实图片有大图关闭、遮罩、Esc 和失败状态。检验当前服务工作树、路由与设备，五次有效响应样本覆盖等价交互家族，保留失败/慢样本。

不发布、不推送、不操作正式环境、不写测试数据库，不修改无关 PCS/WLS/FCS 流程。源站外部集成待对接不能凭按钮发明真实业务完成；原型演示必须清楚显示其实际实现结果。实施者提交各自功能与证据映射，主代理整合并审查完整任务 diff。

## 2026-10-14 前次实施绑定修订与版本边界（历史记录）

前次实施绑定修订涉及实施计划、矩阵和实施清单，继承冻结source-checklist及7份inventory，未改源观察编号与原始SHA。806条是800条测试源观察/分支和6条用户删除要求；现806条均映射到存在owner报告或明确补充定位。此数为实施绑定覆盖，不是806个独立按钮或最终接受数；状态保持800条已实现待验证、6条源站无候选/待对接不适用。

矩阵逐项记录真实报告JSON Pointer、原ID（没有原子ID时明确家族引用）、报告SHA、已有合同日志/页面证据索引及SHA、源码manifest和参与业务对象来源。427条占位字段改成实际诊断引用或明确没有独立按钮证据；404条整页绑定补API/事件家族及关联说明。查询/候选不会因此写成已提交全部关联对象。readChannelFormInput改为readChannelForm，原报告4个旧KOL/时效API名在当前矩阵映射中更正，历史报告SHA保持。

删除按对象绑定旧地址、deleted paths、基线旧符号、当前消费者和cleanup /retirementAudit。成衣/样衣共用product-skus页面/数据，分别登记原渲染函数和同一删除文件，不制造第二套SKU对象。旧inventory-monitor入口亦按v3删除manifest登记；没有清空旧物理用户资料的授权。

此前 V3 阶段源码接受目标记录final-production-v3、5270–5274及冻结manifest；v2 839/839合同为未改业务复用，v3新增7/7窄回归与Vite构建，不称v3全839重跑。root按实际后续版本更新性能计划；v2有效1096ms慢样本保留。V4仅时效修复应独立注明源码/资产、日期语义和保存验证，其余20页复用V3，不改写旧诊断或V3身份。设备、5样本、保存/失败/文件/备份/迁移仍由root记录。

当前listPmsMaterialInventory()只读basis为WLS六SKU各两仓，共12条，默认10两页；明确MPO inventoryPosting另行叠加，不存在独立静态库存10条集。WLS行沿用来源图及单位，本地入库行用采购物料快照，不混称同一静态来源。时效13条仅使用关联MO静态快照、当前采购状态和用户覆盖，实际实到/确认/发货时间不能派生计划或预计时间；V4专项由root关闭。


## 2026-10-14 早期 Excel 格式纠正记录（历史版本）

供货档案与需求数量/入库、采购快递、条码细码、头程货箱均调用src/utils/pms-excel-import.ts的parsePmsExcelRows。在该次纠正版本，能力是OOXML.xlsx、页面HTML表格模板.xls与分隔文本回退，尚未实现OLE/BIFF二进制XLS；后续真实BIFF8实现已补，后续能力见文件实施及V16结果。accept=.xls,.xlsx只是选择扩展名，不是内容格式承诺；本轮无测试站binary最终提交成功证据。

供货成功样本supply-import-valid.xls实际为460B HTML，头3c68746d6c3e3c686561643e3c6d6574；duplicate.xls456B同为HTML。supply-import-valid.xlsx为2726B ZIP/OOXML，头504b0304且含workbook/sheet1成员。条码与需求/快递.xls样本亦是HTML；512B legacy-binary仅OLE签名、其余504B零，不能证明有效完整XLS。旧“供货支持真正binary XLS”断言撤回，owner报告保留历史SHA，该次矩阵与实施清单按当时代码/文件字节纠正，新报告保留该历史格式身份。分隔文本仅是代码路径，仍须页面字段合法；未验证模块不预填成功。精确文件名、字节头、SHA及相关原子编号在矩阵importFormatCorrection。


## 2026-10-14 PCS 采购直达回读修订

在任务独占 5254 来源，经现有 PCS 原子命令修改既有 ASYSA26060310-BLACK-M 的名称为 CHECK-采购目录回读-20261014，独立持久回读成功，其他业务属性未变。新的采购供货档案直达页面仍显示原名称，复现证据 /tmp/pms-catalog-save-actual-20261014.json 与直达候选快照。目标是采购直接消费者在建立名称、图片、单位及发布 BOM 候选前只读准备既有 PCS 资料；main.ts 为 18 个相关页面登记入口，锁定日志、供应商/物流商字典及退役地址不新增此依赖。沿用既有读取失败提示，不初始化种子、不迁移、不写 PCS、不加载 FCS 生产记录。验收是实际保存名称后刷新/直达读到相同名称，正常首次/切换/刷新耗时及打开失败分支，原子编号绑定在最终矩阵。


## 2026-10-14 V12 阶段记录（历史身份）

该次源实施冻结为 V12：分支 `codex/pms-test-alignment-20261013`，基线 HEAD `ee14949905b08b260e9c6309eebc59bfa5b32764`，源摘要 `91189ce2f6806ae1a7a66051004922d6c082b1f9bc9e03801d727935707e68f1`，101 项源码/删除与 1003 项资产，本地生产预览端口 5360–5364。[V12 manifest](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/pms-final-production-v12-manifest.json) 的文件 SHA 为 `37ec37583ee7338c92e9ccde6551d9885886073e2a8dd3fdf55e0b886fe19c93`。该冻结源和本地构建不代表 Git 提交、推送或 Vercel 发布。

已有 [V12 构建日志](/tmp/pms-final-build-v12-20261014.log)（SHA `1075d7cdb6e6ae7d9f4c3eecf15cb78bd233eaf93becd4582e36348b1240bbe8`）记录 engineering TypeScript、865/865 测试、skipped 0、Vite 18.45s 和构建 exit 0；本轮文档任务只读日志，没有重新执行构建。[合并币种合同](/tmp/pms-merge-currency-contract-20261014.log) 实数为 9/9（SHA `c8540c34457246ad5d849b3243d9c24307c57023efb08131efb2774b03325113`），[备份引用合同](/tmp/pms-backup-reference-contract-20261014.log) 实数为 10/10（SHA `63c41c5eba0ddd2a89afde73be35243b5417371713e1097ffa5b8eb1e7d90e58`）。测试和源码审查闭环不自动代替产品接受。

本轮只修订本计划和实施清单，并按原字节归档下列五份重要报告；不改矩阵、源码、浏览器或原始证据，不执行构建/测试。800 条已实现待验证与 6 条具体不适用边界保持，最终接受及状态由 root 填写。

| 原始报告（按原字节归档） | SHA256 | 本轮用途 |
| --- | --- | --- |
| [pms-final-production-v12-manifest.json](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/pms-final-production-v12-manifest.json) | `37ec37583ee7338c92e9ccde6551d9885886073e2a8dd3fdf55e0b886fe19c93` | V12 源/删除与资产身份，101 项源码/删除、1003 项资产；不代表页面接受 |
| [pms-final-independent-review-20261014.json](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/pms-final-independent-review-20261014.json) | `5c7f0b27c88ca3d9c05255d41f38e8d10380be289f99311bd433a86f6ad4a5ed` | 6 项 P2 源码修复复核；独立性限制和旧 diff 身份保留 |
| [pms-material-review-fixes-20261014.json](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/pms-material-review-fixes-20261014.json) | `023a81bbf6b3b01927cd8aa0f0f55d2c66439b0b1b68a15b80603baa77037ac5` | MPO 直达读取、币种、复制重置的 3 项修复及 27/27 窄回归 |
| [pms-real-xls-final-report-20261014.json](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/pms-real-xls-final-report-20261014.json) | `de7fd381ff7107acfac515986d307a6c11218eb061920af7395f78c0aaa70d1d` | BIFF8/OOXML/HTML/CSV 格式合同与 10/10、34 fixture 独立内容比对 |
| [pms-mislabeled-v12-on-v11-correction-20261014.json](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/pms-mislabeled-v12-on-v11-correction-20261014.json) | `e3014c8978942a1ed0f5d7bfb9e75d92a0ce70ce31a4485f42481f2fdd6f51d9` | 误标 V12 样本实际属于 V11/5350 的更正；不改旧 raw 身份 |

独立审查所读的完整任务差异是 [pms-final-independent-reviewed-20261014.diff](/tmp/pms-final-independent-reviewed-20261014.diff)，SHA `4822fb8132a0ccd0c3268ecc838496c653cbefd9bc56b0f287c68aabd3afc60e`；它保留该次审查版本身份，不能由后续文档更新冒称当前源码 diff 或产品接受。

| 编号 | 已记录的源码修复 | 证据与当前接受边界 |
| --- | --- | --- |
| PMS-FINAL-REV-01 | 采购目录入口仅加载直接依赖的 6 个 PCS 集合，避免无范围读取 FCS | 采购目录限定直接依赖已实现；后续真实页/关联回读与加载范围见最终索引 |
| PMS-FINAL-REV-02 | 商品采购合并前校验币种和汇率一致性 | 合并契约日志 9/9；UI 合并及金额回读仍属最终接受 |
| PMS-FINAL-REV-03 | 需求单次/批量下推前读取关联 PPO 持久覆盖，再准备同事务候选 | MPO owner 新增/已编辑父单、版本和中止边界含在 27/27 |
| PMS-FINAL-REV-04 | 新增 MPO 将表单所选 USD/IDR 币种写入候选 | 原币金额保存/独立重读/CSV 合同已记录，不臆造汇率；UI 文件仍由 root 接受 |
| PMS-FINAL-REV-05 | 复制 MPO 清理驳回/关闭原因及旧采购/到货日期 | 保留原单与复制日志，副本可合法推进；含在 27/27 |
| PMS-FINAL-REV-06 | 备份恢复核验业务附件实体/归属/元数据并拒绝内嵌 data/Base64/临时 blob 地址 | 引用契约日志 10/10；后续V13五正常/二十异常案例和字节独立回读，见最终索引 |

### 最新文件能力与本地资料

当前共用 `parsePmsExcelRows` 已补普通 BIFF8 二进制 `.xls`、OOXML `.xlsx`（含日期）、HTML `.xls` 与 CSV/分隔文本读取，五个页面的六项导入能力为供货档案、需求实际采购量、需求累计实到、采购快递、细码、头程装箱。新增格式合同见 [真实 XLS 最终报告](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/pms-real-xls-final-report-20261014.json)，SHA `de7fd381ff7107acfac515986d307a6c11218eb061920af7395f78c0aaa70d1d`；报告记录 10/10 窄测试及 34 个真实 fixture 与独立 xlrd 的内容同值。accept 扩展名仍不证明文件内容，页面列、合法对象和数量校验仍生效。格式能力不包括密码解密、BIFF2–5、宏/图表/对话表导入、公式重算或任意工作表选择；只读首个普通工作表及已保存公式缓存，无法读取的值不造数。

V11 原始 [XLS 六能力记录](/tmp/pms-final-ui-20261013/formal-v11-5350-imports-current.json)（SHA `d847b25ffeb33c3dd58fe3a1bc3bad1357e8f408587a73e1efb4eaaf3aa17bf2`）包含各能力五次有效保存。供货每批 20 条、重复阻断五次；需求四条物料数量和累计实到分别记录；原 CGF-0004 已有物流 800，尝试累计 801 正确阻断五次，新 CGF-0007 导入编号 2–6 有五次有效回读，编号 1 错误 store 采集无效保留。细码每批两条、头程每批两 SKU，父单 `persistentRows=1` 不等于一条条码或一 SKU。

[V11 XLSX 供货与追加记录](/tmp/pms-final-ui-20261013/formal-v11-xlsx-archive-imports.json)（SHA `9a8e24b6f522bd796669524af98d18197878c9da20b7874dce3588b92f7e0f1e`，尾部 XLSX 序列 `/143`–`/155`）保留每批 20 条；第 1 批实际保存但终点采集无效，第 2–6 批为五个有效保存，最终用户供货档案覆盖 220 条。该文件镜像之前数组前缀，不能把复制引用当新增独立样本。旧 HTML `.xls` 的实际字节身份和报告 SHA 不变，新 BIFF8 实现替代旧版本“未实现二进制 XLS”的当前能力口径；这些文件只在本地原型导入，没有提交到测试站或正式站。

本地资料复用共享入口：估算、完整备份/恢复、附件字节与引用、无引用清理及指定范围重置。保存和恢复共同成功的记录/Blob/引用/日志以事务 complete 为准，错误文件、同 operationId 改内容、版本或记录冲突不得假报成功。退休 6 对象的旧物理资料没有清空授权，普通读取不暗中迁移、不复活旧写入口；本地同源资料不能宣传为多用户/设备共享或自动云恢复。

V11 [选好后选坏清除旧候选](/tmp/pms-final-ui-20261013/formal-v11-backup-invalid-cleared.json) 的 `backup-select-good/bad-1..5`、[相同记录恢复去重](/tmp/pms-final-ui-20261013/formal-v11-backup-dedup.json) 的 `backup-restore-identical-1..5` 与 [冲突不保存](/tmp/pms-final-ui-20261013/formal-v11-backup-conflict.json) 的 `backup-restore-conflict-1..5` 分别已有五次原始记录；`backup-restore-normal-1` 读取错误仓库导致采集无效保留，不改称正常恢复已接受。该阶段附件引用/归属门禁当时待复验；后续V13已有25恢复案例及独立回读，见V16证据索引。

[V11 完整备份生成记录](/tmp/pms-final-ui-20261013/formal-v11-backup-generation-complete.json) 的 `/157`–`/161` 即 `backup-generate-heavy-complete-2..6`，生成 Blob 为 394231B，时间分别 145.3/127.3/64.0/47.0/160.5ms。实际原生下载 [backup-2](/tmp/pms-final-downloads-20261013/actual-pms-heavy-backup-2.higood-pms)、[backup-3](/tmp/pms-final-downloads-20261013/actual-pms-heavy-backup-3.higood-pms)、[backup-4](/tmp/pms-final-downloads-20261013/actual-pms-heavy-backup-4.higood-pms)、[backup-5](/tmp/pms-final-downloads-20261013/actual-pms-heavy-backup-5.higood-pms)、[backup-6](/tmp/pms-final-downloads-20261013/actual-pms-heavy-backup-6.higood-pms) 均为 394231B；存在文件与生成时延不单独证明其全部记录/附件恢复闭环。

### V12 当时版本及剩余接受工作（历史记录）

此前 helpers 捕获旧 run 对象，带 `v12-first-*` 标签的 21 个样本实际发生在 V11/5350，不能作为 V12 通过。[版本更正](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/pms-mislabeled-v12-on-v11-correction-20261014.json) 保留原 SHA；[实际 V11 误标原始集合](/tmp/pms-final-ui-20261013/formal-mislabeled-v12-actual-v11-raw.json) 有 183 条记录（SHA `9654b1898d3eab9ff44e65e11a51f5fa174c66450b948a84d965c329470ffcef`），其中 21 条为上述误标标签。[原 formal-v12-5360-current.json](/tmp/pms-final-ui-20261013/formal-v12-5360-current.json) 当前是 `[]`（SHA `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`），保留该身份，不把空文件补成旧样本或修改 raw。

真实 V12 证据是 [formal-v12-5360-actual.json](/tmp/pms-final-ui-20261013/formal-v12-5360-actual.json)；本轮读取截至 `2026-10-13T20:59:49.465Z`，SHA `14b48167bf8caa5ef1f8e43d82d8069fdee42683f56ffd64f79c81498a353a12`。root 已记录 21 页首入、21 页 SPA 和至少 15 页刷新有效样本，首入最大 792.7ms、当前刷新最大 887.1ms；KOL 标题空格造成的一次采集无效保留。该单 origin 阶段记录不能称五个 origin/五样本性能家族已完成，后续功能、失败恢复、文件、目录回读和剩余样本仍由 root 关闭。

V11 时效 SKU 列冻结/取消冻结各五次原始记录及保存的绿色10:04刷新显示另行保留；计划时间、预计时间不能派生为实际确认/发货/实到。采购目录直达回读修订段记录的是原缺陷复现，已改为仅载入直接依赖的PCS目录；V12目录保存→刷新/直达、失败及性能结果仍由root接受。旧V2/V10有效慢样本和版本/采集错误不能删去或改成V12成功。

该V12阶段当时计划由root按源/资产hash完成五 origin 的适用五样本、正常/边界/失败恢复、文件与备份引用、目录直接消费者和两设备布局/图片验收，更新 PERF、矩阵、治理与最终收据。不推送、不部署，不写测试站/正式站数据库，不称真实工厂业务已经发生。


## 当前 V16 实施与验收收口

当前产品冻结为 **V16**，源摘要 `3279d61646e0e47bd4be447eb2e26e3ed2c92758ddc508f61f51a58d3f232c28`，105项源码/删除、1004项资产，本地预览5392。[V16 manifest](/tmp/pms-final-production-v16-manifest.json) SHA `061037d01d9d752b20b8c1eaa0e33a26300f5a0d0e04bdb910590d1d4043e915`；逐项路径/SHA、原版本与复用解释见 [最终证据索引](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/final-evidence-index.json)。这不是Git提交、推送或Vercel发布回执。

已完成 **21页 × 首次访问／SPA／刷新 × 每家族5次＝315条加载验收**，最大 **895.2ms**；1366×768与1280×720记录、30项菜单SVG及主体无横向溢出由 [最终加载覆盖报告](/tmp/pms-final-ui-20261013/final-loading-coverage-report-20261014.json) 确认。原V12 MPO刷新1150.1ms失败保留，V13七张真实首屏图并行请求后有15条受影响页复测；其他20页使用原版本未变依赖及报告明确的复用依据，不重标为V16重新运行。

原V12六项P2审查及其4822差异保持原身份。六P2源码修复、后续PPO复制执行事实清理、FLS新增表单重置与币种说明已实施；后续V13/V14原始与回读补充实际结果，不回写旧审查为新版本审查。数据/记录身份未变时复用原链，短编号仅改变保存提示显示，不改变ID或读写。

后续实际功能证据已补：V13原币USD/IDR采购及独立回读、混币/汇率合并门禁、持久父PPO直达需求下推、驳回MPO复制；V14正常合并/拆分各5次与旧质检/审核/重开事实复制清理5次，均保留原始操作及独立读回版本。V13备份25案例为5完整恢复、缺文件/归属/元数据/内嵌文件地址四类各5阻断，5个Blob的ABC原字节已独立读回；旧V11导出文件、XLS/XLSX及其真实格式身份继续保留。具体索引不把父单persistRows当细码/SKU数，也不把镜像数组当新样本。

V16追加补证：头程新增表单重置[五个实际样本](/tmp/pms-final-ui-20261013/formal-v16-FLS-reset.json)均通过，最大54.6ms且外壳保留；[物流商切换](/tmp/pms-final-ui-20261013/v16-carrier-company-switch.txt)读取陆港两渠道与USD，[筛选统计](/tmp/pms-final-ui-20261013/v16-carrier-company-filter-statistics.txt)为1商/2渠道/1启用。真正的[终结编辑门禁](/tmp/pms-final-ui-20261013/v16-confirmed-terminal-guard.txt)是已确认CONF3关联CGF5实到60后拒绝保存草稿，原确认保留；旧误命名v16-confirm-terminal-guard.txt属于CONF1未确认单合法编辑保存，不能作为阻断证明。[原生CSV内容](/tmp/pms-final-ui-20261013/v16-native-csv-content-report.json)核对商品采购12行和面辅料采购8行，均跨两页、无操作列；以实际文件rows/header为准。商品采购建议1366与面辅料采购1280两张最终截图已由root视读，原图身份见索引。

<!-- FINAL_SUITE_STATUS_START -->
**31个实际业务case已通过技术验收，采用分批直接复验**：V16首批20个、供应商/确认单/KOL三个单case各1个、剩余批前三个、拆合与批量状态复验2个、最后批2个、物流R3最后1个，合计31。具体日志、原case标题和六份spec最新SHA见[最终证据索引](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/final-evidence-index.json)。[原31批次](/tmp/pms-final-local-browser-v16-20261014.log)的20通过/3失败/8未运行、后续失败与额外shutdown错误均保留；这不是同一完整批次31通过，没有跳过有效case。后续只修UI测试步骤或expected排序，V16产品源码不变；[物流R3](/tmp/pms-settlement-repair-v16-r3-20261014.log)最终1通过（3.7s）。root[功能关闭报告](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/final-evidence/final-functional-closure.json)记录技术接受，未冒充用户产品接受。

root已将806条追踪记录登记为**800已验证、6不适用**；806是观察与原子记录，不是806个独立测试。最终[任务收据](/tmp/pms-final-receipt-20261014/task-receipt.json)尚待生成，本清单不预填结果。V13完整构建865/865保留历史版本，PPO复制事实增量10/10另有真实日志；V16现有Vite构建不称最终全量866已运行。
<!-- FINAL_SUITE_STATUS_END -->

21页实现、六整对象14文件退休和固定basis两页见实施清单。UI沿用标准列表、内部宽表滚动、局部弹层/行更新和对象真实图片；存储按记录/同事务、原始Blob、失败保留输入与稳定重试，导入支持真实普通BIFF8/OOXML，打印为Code128/二维码电子预览。本地资料含估算、备份恢复、无引用清理与指定范围重置，六来源不适用边界保持。root最终更新矩阵和治理记录；本轮文档不新增验证，不推送部署、不写测试库或真实工厂业务。


## 最后工程收口

首轮最终收据已实际得到全工程866/866单测与31个页面case单批通过；机器未verified的固定菜单路由/测试映射阻断保留于final-evidence/first-workflow-receipt-implemented.json。已补锁定日志精确路由，15样本最大488ms；治理文件补对应专项，不改产品流程、不跳未知测试。当前V17资产与源哈希见final-evidence/final-production-v17-manifest.json，早先V16证据保持原身份。第二轮最终收据预定位置为/tmp/pms-final-receipt-r2-20261014/task-receipt.json，冻结后生成，未预填其状态。

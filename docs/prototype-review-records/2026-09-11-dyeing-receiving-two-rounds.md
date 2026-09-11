# 染厂待接收、纱线交出与毛织净重入库：两轮技术验收

## 1. 基本信息

| 项目 | 内容 |
|---|---|
| 日期、版本 | 2026-09-11，V2 本地实现；main / f6f3f945a46711265ad6f0eaf7086e9533134fcb 加任务差异 |
| 工作树、运行服务 | /Users/laoer/Documents/higoods；http://192.168.0.17:5188 |
| 范围 | WP01—WP08，染厂收货、送货单、纱线交出、毛织净重入库；WP09 其他加工厂复制不在本期 |
| 记录模式 | 完整产品审查；技术验收人 Codex，产品接受仍由用户复核 |
| 角色 | 管理员查来源/建送货单；本厂仓管按实物接收；染厂交出员称重出货；毛织仓管接收、定位、关联备料 |
| 端类型 | 管理 Web、执行 Web、PDA 浏览器模拟、打印预览 |

需求依据：[总体设计](../2026-09-11-dyeing-receiving-adjustment-design.md)、[实施计划](../2026-09-11-dyeing-receiving-implementation-plan.md)、[原子矩阵](../2026-09-11-dyeing-receiving-requirements-matrix.md)。当前版本以 `output/verification/dyeing-receiving/task-files.json` 的内容哈希为准，不能只用未改变的 HEAD 代表本地实现。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：新增染厂/毛织待接收入口、送货组织与扫码实收、物料计量、库位和库存关联、纱线毛重限额及整单标签；调整旧接收入口和纱线数量展示，保留原列表分类顺序、工厂 Tab、备注及流程卡结构。

依据 `AGENTS.md` 第 4、5、7 节进行场景、图片、设备与证据审查。没有读取禁用技能、创建后端或改动部署配置。

## 3. 自查结论

| 检查项 | 结论 | 直接依据 |
|---|---|---|
| 角色、任务与页面模式 | 通过 | 管理标准列表；执行端扫码、填写、复核、结果四步；登录身份限定收货工厂 |
| 文案、状态、数量与单位 | 通过 | 面料卷数+Yard；辅料 kg/g；纱线 pcs/毛净重；零收单独记录，接收不自动开工 |
| 扫码、真实图片与对象识别 | 通过（软件环境） | 输入条码并按 Enter 查单；真实物料图、大图 Esc 关闭；Vision 解码标签两版本均为同一整单码 |
| 防错、确认与恢复 | 通过 | 空白、负值、无卷码、重复卷、错厂/错SKU、停用库位、内容变化确认号、负净重及超毛重额度阻断；保存失败保留输入 |
| 交接、跨页面事实与追溯 | 通过 | 实收追加且只入库一次；原交出 ID 回传；分配不增加库存；毛织按实际净重且仅入自身账本 |
| 低分辨率与局部交互 | 通过（浏览器模拟） | 1366×768、1280×720、1024×768 无页面横向溢出；PDA 390×844；冻结、排序、拖列、每页数量刷新保持；输入不替换整页 |
| 图片大图与失败恢复 | 通过 | 待接收/PDA及纱线真实图加载；阻断图片请求出现失败提示，解除后刷新恢复；同块名称/SKU识别 |
| 打印 | 通过（预览/软件解码） | 多原单送货单、稳定纱线整单标签及原生产流程卡均检查；实机扫码枪、热敏纸打印不在已有证据中 |

新增纱线使用 `public/materials/process-orders/cotton-yarn-cone.jpg`，对应“粉黑白段染棉纱（演示）”，来源及 CC BY-SA 3.0 许可存于相邻 `.source.json`。面料和辅料复用已对应 SKU 的实际图片，未用颜色块或无关图片补位。备料试织对象使用纱线图并明确试织演示，不冒充已生产成衣。

## 4. 问题标签

- 已处理：算不准、追溯不足、缺扫码识别、协作断裂、字段过载。

## 5. 两轮验收与处理记录

**第一轮：规则、正常收货与关键边界。** 独立浏览器 `receiving-acceptance`，使用页面动作提交；自动化在独立进程运行。

| 场景 | 实际结果 | 证据 |
|---|---|---|
| 面料原卷接收 | 原卷实收 101 Yard，接收单 FR-1789118367270 | 首轮页面操作；核心检查卷码与增量库存 |
| 混合送货 | SH-R1-MIX-001：两张调拨+一张工厂交出，分别实收 100/80/120 Yard；第三行入 B01-01，其余 A01-01 | receiving-round-1/mixed-delivery.png；FR-1789119136600-ajacw |
| 纱线限额 | 下单 10 kg、毛重 31 kg 被阻断；20 宝塔管、毛重 12 kg，净重 9.580 kg 保存 | receiving-round-1/yarn-label.png；YARN-SHIP-YC-1789118696555-7tmxe6 |
| 毛织实际接收 | 19 pcs、11.400 kg 毛重，按 19×121 g 扣重后实收 9.101 kg，只入库一次 | receiving-round-1/wool-received.png；FR-1789118794959 |
| PDA辅料 | 空白被阻断；输入 8125 g 实收为 8.125 kg；错厂原单被阻断；大图可关闭 | receiving-round-1/pda-accessory.png；FR-1789119569200-py8gr |
| PDA明确零收 | FR-1789121398792 记录 0 kg / 0 g，不新增库存，刷新历史仍有该记录 | receiving-round-1/pda-final-zero.png |
| 原流程卡 | DWO-001 四张对应图片全部加载，结构保持 | receiving-round-1/flow-card-final.png |

**第二轮：独立演示数据重放、分批、打印与库存归属。** 独立浏览器 `receiving-round-2`。

| 场景 | 实际结果 | 证据 |
|---|---|---|
| 完整来源数据 | 16 个具体来源场景，初始 13 个可接收；未审核/草稿/作废三个被排除 | mock-completeness.json（16 条、必需字段缺值 0）；两轮 factory-material-receiving 日志；list-final-1366.png |
| 已批准未发货 | 可查看并登记明确零收，不自动当成发货、不开工、不增库存 | FR-1789119978195-dmqgz；核心检查 |
| 混合/少收/超收/库位 | SH-R2-MIX-001 的三个来源实收 100/80/120 Yard，统一应用 B 库位 | mixed-receipt.png；FR-1789120045927-bcgqi |
| 累计毛重防超 | 10 kg 订单、30.001 kg 毛重提交被阻断；另有 9.999/10/10.001 kg 三个完整样例 | yarn-final.png；两轮 yarn-weight-rules |
| 分两批交出 | 第一批 20 pcs / 12 kg / 9.580 kg；第二批三管各一共 3 pcs / 2 kg / 1.737 kg；整单累计 23 pcs / 14 kg / 11.317 kg | yarn-label-v1.png、yarn-label-v2.png；两次实际交出历史 |
| 一单一码重印 | 两版本解码均为 YARN:RS-YARN-260911-1，旧版本可查看；重印不改接收/库存存储 | barcode-decode.log |
| 毛织按净重入库 | 第一批实际 19 pcs / 11.400 kg / 9.101 kg，回传对应原交出记录 | wool-actual-receipt.png；FR-1789120178596 |
| 备料关联及移库 | 分配 5 kg 后备料 4.101+订单 5=9.101 kg；再移 1 kg 到 B，A订单4+B订单1+备料4.101仍为9.101 | wool-stock-locations-final.png；集成检查含领用2/退回1及重放 |
| 原加工单四组数量 | 完整展示实际调拨 30 kg、收货 20 pcs/32.420毛重/30净重、交出及下游三值；待接收净重精确为 2.216 kg | yarn-list-quantities.png |
| 列表交互与尺寸 | 排序升/降/无，冻结源列及物料列，拖动数量列，20条/页刷新保留；三个桌面尺寸无主体溢出 | list-final-1366.png、list-final-1280.png、list-final-1024.png |
| PDA接收 | 错厂扫码阻断；TAG-260911-14 实收8125g=8.125kg，保存后显示具体库位；宽390无溢出 | pda-final-accessory.png；FR-1789121845106-tvokp |
| 图片与打印回归 | 图片失败有提示，恢复后可加载；大图Esc关闭；原卡四图加载；混合送货单逐原单打印 | image-failure.png、flow-card-final.png、delivery-print-final.png |

上述截图均位于 `output/playwright/` 的对应轮次目录。两轮规则检查各自保存 `output/verification/dyeing-receiving/round-1-checks.json`、`round-2-checks.json`；每轮实际运行 8 个专项，不把同一轮重复截图当两轮验收。

最终复核处理：修正纱线演示上游“已实收却显示待备料”的矛盾；补齐纱线中央仓具体属性；PDA 工厂显示名与本期 GTG/MJS 来货一致（账号与工厂 ID 不变）；保留仓库原 ISSUE 类型；毛织实际库位移库保持物料名称；所有克级数量避免旧两位小数丢失。旧接收专项中“接收自动开工”断言已按用户确认口径更新，并重放后续两批加工与交出。

## 6. 最终结论

结论：通过。本期原型技术验收通过。

WP01—WP08 本地实现及两轮技术验收已闭环；仍为浏览器本地演示数据，不代表仓库真实收发或跨设备实时同步。没有提交、推送、生产部署或用户产品接受回执。实体扫码枪/热敏打印机未连接，软件预览及解码通过不代替现场设备验收。WP09 按已约定范围留待染厂产品检查后复制。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/fcs/dye-work-order-demo-details.ts`
- `src/data/fcs/dye-work-order-online-view.ts`
- `src/data/fcs/dyeing-material-receipts.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/factory-internal-warehouse.ts`
- `src/data/fcs/factory-receiving-links.ts`
- `src/data/fcs/factory-receiving-mock.ts`
- `src/data/fcs/factory-receiving-types.ts`
- `src/data/fcs/factory-receiving-warehouse.ts`
- `src/data/fcs/factory-receiving-wool.ts`
- `src/data/fcs/factory-receiving.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/process-order-image-manifest.ts`
- `src/data/fcs/warehouse-material-execution.ts`
- `src/data/fcs/wool-domain/commands.ts`
- `src/data/fcs/wool-domain/queries.ts`
- `src/data/fcs/wool-domain/store.ts`
- `src/data/fcs/wool-domain/types.ts`
- `src/data/fcs/wool-domain/warehouse-ledger.ts`
- `src/data/fcs/yarn-weight.ts`
- `src/main-handlers/fcs-handlers.ts`
- `src/main-handlers/pda-handlers.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-wool-fact-execution.ts`
- `src/pages/print/templates/dye-work-order-flow-card-template.ts`
- `src/pages/process-factory/dyeing/barcode-dialog.ts`
- `src/pages/process-factory/dyeing/output-documents.ts`
- `src/pages/process-factory/dyeing/pending-receipts.ts`
- `src/pages/process-factory/dyeing/warehouse.ts`
- `src/pages/process-factory/dyeing/work-order-detail.ts`
- `src/pages/process-factory/dyeing/work-orders.ts`
- `src/pages/process-factory/dyeing/yarn-shipments.ts`
- `src/pages/process-factory/wool/warehouse.ts`
- `src/pages/process-factory/wool/work-order-detail.ts`
- `src/pages/process-factory/wool/work-orders.ts`
- `src/router/routes-fcs.ts`
- `src/router/routes-pda.ts`

### 页面路由

- `/fcs/craft/dyeing/pending-receipts`：列表、来源、送货单、实收、库位、备料关联。
- `/fcs/pda/factory-receipts`：当前工厂身份扫码接收。
- `/fcs/craft/dyeing/yarn-shipments`：交出与整单标签。
- `/fcs/craft/wool/pending-receipts`：实际接收、历史与备料。
- `/fcs/craft/wool/wait-process-warehouse`：毛织实际净重、物理位置及移库。
- `/fcs/craft/dyeing/work-orders`：原加工单及数量四分组。
- `/fcs/print/task-route-card?sourceType=DYEING_WORK_ORDER&sourceId=DWO-001`：原流程卡。

### 验证命令

- `node --import tsx scripts/check-yarn-weight-rules.ts`：通过，两轮分别保留退出结果与日志。
- `node --import tsx scripts/check-factory-material-receiving.ts`：通过，两轮分别保留退出结果与日志。
- `node --import tsx scripts/check-factory-receiving-integration.ts`：通过，两轮分别保留退出结果与日志。
- `node --import tsx scripts/check-dye-work-order-online-alignment.ts`：通过，两轮分别保留退出结果与日志。
- `node --import tsx scripts/check-dyeing-workflow.ts`：通过，两轮分别保留退出结果与日志。
- `node --import tsx scripts/check-combined-dyeing.ts`：通过，两轮分别保留退出结果与日志。
- `node --import tsx scripts/check-wool-fact-workflow.ts`：通过，两轮分别保留退出结果与日志。
- `node --import tsx scripts/check-dye-material-receipts.ts`：通过，两轮分别保留退出结果与日志。

- `node node_modules/typescript/bin/tsc --noEmit --pretty false`：通过。
- `npm run build`：通过；现有打包体积提醒保留，不作为业务完成依据。
- `npm run check:standard-list-page-template`：通过；沙箱内 Chromium 启动失败后以获准的本地浏览器权限重跑通过。
- `npm run check:list-page-governance:static`：通过；386 个页面扫描。列表模板运行验证另见上一项。
- `node --import tsx scripts/check-menu-routes.mjs`：通过，179 个菜单路由无缺失/重复。
- `npm run check:prototype-design-governance`：通过（staged 无文件，不作为覆盖证据）；本任务受管文件通过 validatePrototypeReviewCoverage 单独核查，结果见 scoped-governance.log。
- `codegraph sync`：通过；`codegraph status` 确认索引最新。

### 例外

- 聚合 check:list-page-governance 在沙箱启动 Chromium 时失败；静态检查、已获准浏览器权限的模板检查及限定任务的原型记录覆盖均分别通过。未扩大为整个脏工作区的 --all 审查。
- 当前工作区有用户此前未提交工作；使用开工快照与 task-delta.patch 识别本任务差异，未重置或暂存其他工作。全量 workflow:verify 会吸收无关工作区内容，按 AGENTS.md 第 7、8.1 节不运行全量收据，以本任务文件哈希、两轮专项、页面和治理证据形成限定范围记录。
- 实体 PDA、扫码枪和热敏打印机不可用；设备证据是浏览器尺寸模拟、Enter 扫码输入及软件条码解码，不能宣称已通过实体硬件验收。
- 接收时允许的无订单、尚未发生日期、不适用幅宽/克重有明确业务表达；这不属于必需 Mock 缺值。现场输入框保持空白防止默认全收，不能拿虚构数字填满。
- 打印流程卡原本供现场手填的工序格保持空白，这是保留的表单结构，不是 Mock 丢值。

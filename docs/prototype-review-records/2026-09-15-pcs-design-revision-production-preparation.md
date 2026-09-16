# PCS 设计改款与生产准备管理增量调整原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-15 |
| 相关需求 / 任务 | 《PCS 设计改款与生产准备管理增量调整方案》 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PCS、FCS |
| 涉及页面路径 | `/pcs/production-preparation/design-revision`、`/pcs/production-preparation/orders`、`/pcs/production-preparation/first-sample/:taskId`、`/pcs/production-preparation/plate-making/:taskId`、`/pcs/product-archives`、`/fcs/production/preparation-timing`、`/fcs/production/preparation-timing-statistics`、FCS 印花／染色加工与交接页面 |
| 端类型 | 管理端、主管端、员工执行端 |
| 主要角色与任务 | 买手确认设计改款方案与成果；专业团队提交成果；跟单安排生产准备；制作团队完成销售展示样衣和首单样衣；版师／毛织团队上传齐码纸样；FCS 加工团队执行印花／染色加工与交接 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：PCS 模块名称、设计改款创建责任、任务状态、三步流程、整款物料与费用、销售展示样衣固定 M 码总件数、真实文件上传、专业任务及加工单关系、临时 SPU 建档承接、生产准备任务依赖、首单样衣数量要求、齐码纸样上传、技术包资料来源和生产准备时效均发生用户可见调整；FCS 增加“设计改款打样”加工来源、结果前置、物料交接和印花交出门禁。
- 调整方式：沿用现有列表、弹窗、详情、任务页、加工单页和路由，在原页面内增量修改；没有创建替代页面、平行业务仓储或第二套流程。
- 审查基线：`AGENTS.md` 第 4 节“印尼工厂现场产品设计基线”、第 5 节“UI 与交互专项规则”和第 7 节“验证原则”。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 设计改款由买手负责；页面未完成时显示当前需处理团队，完成动作后记录具体操作人；管理列表与任务工作台保持原页面模式。 |
| 文案、状态、数量与单位 | 通过 | PCS 使用“生产准备管理”“生产准备单”“设计改款”“待方案确认”“首单样衣”；设计改款阶段的销售展示样衣固定 M 码，只维护总件数和制作要求；生产准备阶段的首单样衣仍按颜色、尺码、件数逐行表达。 |
| 扫码、真实图片与对象识别 | 通过 | 款式图与款号同区展示；设计改款列表直接展示当前设计稿缩略图，点击后查看高清大图；设计稿、样衣图和纸样均走真实本地文件读取；图片加载失败、错误类型和大小会被明确提示或阻断。 |
| 防错、危险确认与主管兜底 | 通过 | 同款参照／目标、缺设计稿、纸样复用缺 `.prj`、整款方案缺物料或费用确认、样衣总件数非法、加工未收齐、技术包前置未完成均阻断；失败不推进来源任务。 |
| 交接、跨端事实与异常追溯 | 通过 | PCS 保存加工单关联，FCS 保存执行事实；先染后印存在前置和中间实收；末道加工按系统默认销售展示样衣制作团队和地点完成交接。 |
| 低分辨率、PDA、弱网与上传恢复 | 有条件通过 | 1366×768 管理端已实测；PDA 加工接单／收料／交出由自动化覆盖。原型不实现真实弱网队列，上传失败会保留页面并提示重试。 |
| 命名路由、交互、图片大图与打印 | 有条件通过 | 生产准备管理九张列表及详情已经统一迁至 `/pcs/production-preparation/*`，旧地址不再注册或跳转；款式关系已改为“参照款、箭头、目标款”三行且全部左对齐；设计改款列表的设计稿缩略图、大图弹窗、工作项与负责团队、完整时间节点均在 1280×720 页面实测。内部对象完整更名仍待后续工作包完成。 |

## 4. 问题标签

- `视觉干扰`
- `追溯不足`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 设计改款原为四步且责任在买手、跟单之间往返 | 协作断裂 | 买手、跟单、专业团队 | 压缩为买手确认方案、专业工作、买手确认成果三步；只在完成记录中落具体操作人 | 否 |
| 第一步把新款颜色、参考物料、物料和费用拆成多个模块 | 字段过载 | 买手 | 删除“新款颜色”和“参考物料处理”；新任务只建一份空白整款方案，物料由买手手工新增；物料与加工要求、费用与综合成本合并在同一张大卡片内一次确认 | 否 |
| 销售展示样衣按颜色、尺码、团队拆成多行安排 | 字段过载 | 买手、制作团队 | 固定展示 M 码，只保留一个总件数和制作要求；团队与地点读取系统默认配置；历史多行要求汇总且保持总件数 | 否 |
| 生产准备重复生成基码纸样并把齐码硬依赖首单样衣 | 状态抽象 | 跟单、制作团队、版师 | 基码改为设计改款前期资料；首单样衣和齐码纸样并行，仅保留推荐顺序 | 否 |
| 设计改款印染任务没有对应加工单和物料交接 | 协作断裂、追溯不足 | 买手、花型团队、染厂、印花厂、样衣制作团队 | 增加设计改款加工来源、幂等关联、成果前置、分厂、实收、加工、交出和末道接收闭环 | 否 |
| 生产准备统计仍保留“完成基码”汇总 | 读不懂 | 跟单、管理人员 | 从当前生产准备统计卡片和导出中移除；历史内部类型仅用于兼容读取 | 否 |
| 参照款和目标款横向并排或箭头与目标款挤在一行，款式关系不清楚 | 视觉干扰 | 买手、跟单 | 参照款显示在第一行、箭头单独显示在第二行、目标款显示在第三行；三行统一左对齐，已建档款与线下临时 SPU 使用同一结构 | 否 |
| 设计稿列只显示“查看当前设计稿”文字，无法直接识别稿件 | 视觉干扰 | 买手、跟单、专业团队 | 直接展示当前设计稿缩略图；点击缩略图使用既有图片预览弹窗查看高清大图；缺图和加载失败均显示明确状态 | 否 |
| 详情页把任务、款式、处理信息和设计稿拆成两个卡片，设计改款目标仅作为标题下的小字展示 | 视觉干扰、信息层级 | 买手、专业团队 | 合并为一张“设计改款基本信息”大卡片；将设计改款目标置于首个全宽重点信息区，参照款、目标款、当前团队、当前步骤和设计稿均归入同一卡片；后续三步工作区保持不变 | 否 |
| 基本信息仍横向堆满、物料费用层级重复，新增物料切换 SKU 后图片、单位和金额不同步 | 视觉干扰、防错不足 | 买手 | 任务号改为详情主标题；基本信息与设计稿左右分栏；删除重复“物料与费用”标题；物料表与费用表恢复独立边框及间距；每行展示对应物料缩略图，切换 SKU 同步计价单位；删除费用有无选择，点击“新增费用”直接增加明细；所有小计读取页面当前草稿并使用系统默认汇率计算 | 否 |
| 列表只显示笼统工作进度，无法知道具体工作项由哪个团队负责 | 追溯不足 | 买手、管理人员 | 将笼统进度列替换为“工作项 / 负责团队”，按任务逐行展示工作项名称及其固定负责团队；动态的“当前需处理的团队”继续独立保留 | 否 |
| 列表只显示最后更新时间，无法还原任务和各工作项的完整时序 | 追溯不足 | 买手、管理人员 | 时间列依次展示任务创建、设计稿上传、物料费用确认、工作安排确认、每个工作项的计划完成／开始／颜色确认（适用时）／提交／完成、设计改款完成和最后更新时间；尚未发生的节点显示“—” | 否 |
| 九张生产准备页面仍使用旧地址 | 追溯不足 | 所有生产准备管理角色 | 已一次迁移到 `/pcs/production-preparation/*`，同步删除旧路由注册、旧跳转引用和重定向；旧地址仅落入通用未注册页面 | 否 |
| PCS 用户页面仍出现“工程主单” | 读不懂 | 跟单、管理人员 | 菜单、页面标题、列表、详情和提示统一显示“生产准备单”；源码、测试和检查脚本的用户可见旧词扫描为 0 | 否 |
| 内部对象仍保留工程主单等旧技术命名 | 追溯不足 | 研发、测试 | 依照 NAME-006、NAME-007 单独完成类型、字段、关联 ID、仓储键、持久化结构和历史数据一次迁移；本轮可见名称收口不伪装为内部对象迁移完成 | 是 |

## 6. 最终结论

结论：有条件通过。

说明：5 组独立测试数据已经走通；九组正式地址迁移、旧地址删除、款式关系三行左对齐，以及 V2.3 的整款物料费用和 M 码样衣安排简化均已完成专项与页面验证。内部对象完整迁移尚未实施，因此本记录只证明当前用户可见业务和 V2.3 原子需求已验证，不作为 `NAME-006`、`NAME-007` 的完成证据。该结论仅针对原型能力，不代表真实后端、鉴权或生产跨系统通信已经交付。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/pcs-engineering-master-sampling.ts`
- `src/data/pcs-engineering-master-types.ts`
- `src/data/pcs-engineering-master-repository.ts`
- `src/data/pcs-engineering-master-view-model.ts`
- `src/data/pcs-engineering-dependency-policy.ts`
- `src/data/pcs-engineering-bom-types.ts`
- `src/data/pcs-engineering-bom-material-resolver.ts`
- `src/data/pcs-engineering-bom-repository.ts`
- `src/data/pcs-engineering-bom-pricing.ts`
- `src/data/pcs-engineering-bom-version.ts`
- `src/data/pcs-engineering-color-task-service.ts`
- `src/data/pcs-engineering-first-production-policy.ts`
- `src/data/pcs-engineering-pattern-result.ts`
- `src/data/pcs-engineering-purchase-linkage.ts`
- `src/data/pcs-engineering-task-review.ts`
- `src/data/pcs-engineering-tech-pack-workspace.ts`
- `src/data/pcs-engineering-preparation-projection.ts`
- `src/data/pcs-project-domain-contract.ts`
- `src/data/pcs-style-archive-bootstrap.ts`
- `src/data/pcs-technical-data-version-repository.ts`
- `src/data/pcs-technical-data-version-bootstrap.ts`
- `src/data/pcs-technical-data-version-project-source.ts`
- `src/data/pcs-technical-data-version-types.ts`
- `src/data/pcs-style-archive-types.ts`
- `src/data/pcs-style-archive-repository.ts`
- `src/data/pcs-task-bootstrap.ts`
- `src/data/pcs-tech-pack-review.ts`
- `src/data/pcs-tech-pack-version-activation.ts`
- `src/data/pcs-design-revision-process-work-order-port.ts`
- `src/data/pcs-project-instance-model.ts`
- `src/data/fcs/design-revision-process-work-order-adapter.ts`
- `src/data/fcs/design-revision-material-transfer.ts`
- `src/data/fcs/process-work-order-domain.ts`
- `src/data/fcs/process-order-flow-contract.ts`
- `src/data/fcs/process-work-order-generation-key.ts`
- `src/data/fcs/process-work-order-generation-registry.ts`
- `src/data/fcs/process-order-receiving-target.ts`
- `src/data/fcs/process-order-task-links.ts`
- `src/data/fcs/process-order-three-axis-view.ts`
- `src/data/fcs/factory-receiving-links.ts`
- `src/data/fcs/sewing-outsourcing-migration-audit.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/printing-factory-demos.ts`
- `src/data/fcs/dye-work-order-online-view.ts`
- `src/data/fcs/platform-process-result-view.ts`
- `src/data/fcs/production-preparation-timing-runtime.ts`
- `src/data/fcs/production-preparation-timing.ts`
- `src/data/fcs/task-print-cards.ts`
- `src/data/fcs/page-adapters/process-prep-pages-adapter.ts`
- `src/pages/pcs-independent-sampling.ts`
- `src/pages/pcs-engineering-master-list.ts`
- `src/pages/pcs-engineering-master-detail.ts`
- `src/pages/pcs-engineering-tasks.ts`
- `src/pages/pcs-engineering-tasks/shared.ts`
- `src/pages/pcs-engineering-tasks/master-task-common.ts`
- `src/pages/pcs-engineering-tasks/first-sample-task.ts`
- `src/pages/pcs-engineering-tasks/plate-making-task.ts`
- `src/pages/pcs-engineering-tasks/master-task-page.ts`
- `src/pages/pcs-engineering-tasks/pattern-task.ts`
- `src/pages/pcs-engineering-tasks/color-task.ts`
- `src/pages/pcs-engineering-tasks/purchase-task.ts`
- `src/pages/pcs-engineering-tasks/tech-pack-task.ts`
- `src/pages/pcs-product-archives.ts`
- `src/pages/pcs-projects.ts`
- `src/pages/pcs-technical-data.ts`
- `src/pages/production/preparation-timing.ts`
- `src/pages/process-factory/dyeing/pending-receipts.ts`
- `src/pages/process-factory/printing/dialogs.ts`
- `src/pages/process-factory/printing/dispatch.ts`
- `src/pages/process-factory/printing/events.ts`
- `src/main-handlers/pcs-handlers.ts`
- `src/router/routes-pcs.ts`

### 页面路由

- `/pcs/production-preparation/design-revision`
- `/pcs/production-preparation/design-revision/:taskId`
- `/pcs/production-preparation/orders`
- `/pcs/production-preparation/orders/:masterOrderId`
- `/pcs/production-preparation/first-sample/:taskId`
- `/pcs/production-preparation/plate-making/:taskId`
- `/pcs/product-archives`
- `/fcs/production/preparation-timing`
- `/fcs/production/preparation-timing-statistics`
- `/fcs/craft/printing/pending-handover`
- FCS 印花／染色加工单详情、收料、PDA 接单和交出既有路由

### 验证命令

- `node --import tsx tests/pcs-design-revision-production-preparation-five-flows.spec.ts`：通过，5/5。
- `npm run check:pcs-engineering-master`：通过，22/22。
- `npm run check:pcs-design-revision-consolidation`：通过。
- `npx tsc --noEmit --project tsconfig.engineering.json`：通过。
- 设计改款简化专项：新建任务只生成一份无参照来源的空白整款方案；页面不存在“新款颜色”“参考物料处理”“重新带入参考物料”、团队选择和多行增删入口；历史多行样衣要求汇总为 M 码总件数。
- `node --import tsx tests/pcs-design-revision-consolidation.spec.ts`：通过；详情页“设计改款基本信息”大卡片、重点目标区和设计稿归组契约通过。
- `npm run check:pcs-production-engineering-full-flow`：通过，2 个既有全流程、43 个步骤。
- `node --import tsx tests/pcs-production-preparation-transition.spec.ts`：通过。
- `node --import tsx tests/pcs-design-revision-color-team.spec.ts`：通过。
- `node --import tsx --test tests/unit/fcs-design-revision-process-work-orders.test.ts tests/unit/fcs-design-revision-result-readiness.test.ts tests/unit/fcs-printing-dispatch-readiness.test.ts`：通过，10/10。
- `node --import tsx scripts/check-printing-dispatch-pages.ts`：通过。
- `node --import tsx scripts/check-printing-factory-alignment.ts`：通过。
- `node --import tsx scripts/check-printing-online-gap.ts`：通过。
- `node --import tsx scripts/check-production-preparation-timing-readonly.ts`：通过。
- `npm run build`：通过，TypeScript 0 错误、单元测试 101/101、Vite 构建成功。
- `npm run check:prototype-design-governance -- --all`：通过，72 个用户可见受管文件均由本记录覆盖。
- `npm run check:list-page-governance`：通过；静态列表治理、公共模板、Chromium 列拖拽与原型审查覆盖全部通过。
- `npm run workflow:verify -- --output /tmp/pcs-design-revision-style-three-lines-task-receipt.json --task-boundary "PCS 设计改款款式关系三行左对齐"`：通过；当前工作树收据状态为 `verified`，无阻塞项。
- `npm run typecheck:engineering`：通过，TypeScript 既有错误 0、本次检查范围错误 0。
- `npm run check:pcs-design-revision-consolidation`：通过。
- `node --import tsx tests/pcs-engineering-task-standard-list.spec.ts`：通过；设计稿缩略图、大图动作、工作项／负责团队和完整时间节点契约均通过。
- Playwright CLI 在 1280×720 验收 `/pcs/production-preparation/design-revision`：通过；设计稿直接显示缩略图，点击后弹出真实高清大图；工作项逐项对应负责团队；时间列覆盖任务创建、设计稿上传、物料费用确认、工作安排确认、工作项计划完成／开始／颜色确认（适用时）／提交／完成、设计改款完成及最后更新；未发生节点显示“—”；控制台错误 0、警告 0。
- Playwright CLI 在 1366×768 验收 `/pcs/production-preparation/design-revision/ES-ID-DR-001`：通过；任务号、状态、买手、设计改款目标、参照款、目标款、当前团队、当前步骤及设计稿均位于同一张“设计改款基本信息”大卡片内；目标为首个全宽重点区；设计稿缩略图可打开高清大图并可用 `Esc` 关闭；后续三步工作区未改变；控制台错误 0、警告 0。
- Playwright CLI 在 1440×1000 复验 `/pcs/production-preparation/design-revision/ES-ID-DR-001`：通过；任务号为主标题，左列集中目标、款式、团队与步骤，右列展示设计稿；新增第二条物料并切换为吊牌后，真实缩略图、`PCS` 计价单位、`¥ 0.1800 / PCS` 和物料小计同步更新；点击“新增费用”直接增加“包装费”明细，其他费用由 `Rp 15.000` 即时更新为 `Rp 20.000`，综合成本由当前物料与费用按默认汇率 `1 CNY = 2.200 IDR` 即时计算；页面无“其他费用”选择器和“待校验”；控制台错误 0、警告 0。
- Playwright CLI 验收 `/pcs/production-preparation/design-revision/ES-ID-DR-001` 第一步：通过；页面只保留“物料与费用”大卡片和“销售展示样衣制作安排”；物料表只有一个“新增物料”入口；样衣安排显示固定 M、一个总件数和制作要求；不存在颜色、参考物料、团队或多行要求操作；控制台错误 0、警告 0。
- Playwright CLI 展开 PCS 左侧“生产准备管理”：通过；菜单显示“生产准备单”，不再显示“工程主单”。
- Playwright CLI 在 1280×720 验收 `/pcs/production-preparation/design-revision`：通过；首行参照款 `x=433, y=402`、第二行箭头 `x=433, y=454`、第三行目标款 `x=433, y=478`，三行左边缘完全一致且顺序不重叠；控制台错误 0、警告 0。
- `node --import tsx tests/pcs-engineering-navigation-removal.spec.ts`：通过；九组正式地址全部注册，`src/**/*.ts(x)` 中九组旧地址、旧路由和兼容跳转为 0。
- PCS 路由专项集合：`pcs-engineering-master-pages`、`pcs-engineering-page-boundary`、`pcs-engineering-task-standard-list`、`pcs-engineering-preparation-projection` 全部通过。
- Playwright CLI 逐页打开九组 `/pcs/production-preparation/*` 列表：全部显示对应业务页；逐页打开九组旧地址：URL 不变化、不跳转，全部只落入通用“PCS 页面”，不再渲染原业务；控制台错误 0。
- `npm run build`：通过；TypeScript 错误 0、单元测试 101/101、Vite 构建成功。
- `npx playwright test tests/pcs-design-revision-work-preview.spec.ts --workers=1 --reporter=line`：通过，1/1；印花和染色从“否”切换为“是”时，“将生成的工作”立即分别出现花型任务和调色任务，切回“否”立即移除，未提交草稿无需刷新或先保存。
- Playwright CLI 验收 `/pcs/production-preparation/design-revision/ES-ID-DR-001`：通过；同一物料行从“印花／染色均为否”切换为“印花／染色均为是”后，工作预览由“销售展示样衣任务、基码纸样”即时更新为“销售展示样衣任务、基码纸样、花型任务、调色任务（面料）”；仅局部替换预览区域，控制台错误 0、警告 0。
- `node --import tsx tests/pcs-design-revision-admin-override.spec.ts`：通过；管理员可以在不改写任务原买手的前提下维护 BOM 与整款费用、跨买手确认设计改款方案并开始专业任务；普通买手仍不能操作其他买手的任务；确认人和操作记录均写入“管理员（代操作）”。
- Playwright CLI 验收 `/pcs/production-preparation/design-revision/ES-ID-DR-001`：通过；顶部登录身份为“管理员”，任务原买手仍为“买手-阿乐”；点击“确认方案并生成工作”后进入“专业工作中”，生成 4 个专业任务和 2 张印染加工单，不再显示权限错误；操作记录写入两条“管理员（代操作）”记录。随后进入“基码纸样”并点击“开始任务”，状态由“待开始”变为“进行中”，操作记录继续保留管理员代操作身份。

### 真实图片验证

- 款式图来源：仓库已有正式款式图片资源；列表中与款号／款名同单元格展示，点击可查看。
- 设计稿实测文件：`public/lace-dress-sample.jpg`。浏览器真实选择后显示 `lace-dress-sample.jpg`、215 KB、买手和读取时间，并提供查看／删除。
- 设计稿截图：`output/playwright/pcs-design-revision-real-upload-final.png`。
- 设计改款列表设计稿缩略图截图：`output/playwright/pcs-design-revision-list-thumbnail-left.png`。
- 设计稿高清大图弹窗截图：`output/playwright/pcs-design-revision-artwork-large-preview.png`。
- 设计改款基本信息大卡片截图：`output/playwright/pcs-design-revision-basic-info-after.png`。
- 设计改款基本信息双列截图：`output/playwright/pcs-design-revision-basic-info-v24.png`。
- 物料缩略图、卡片间距与费用实时汇总截图：`output/playwright/pcs-design-revision-detail-layout-cost-v24.png`。
- 设计改款第一步简化截图：`output/playwright/pcs-design-revision-simplified-plan-v23-step.png`。
- 费用与 M 码样衣安排截图：`output/playwright/pcs-design-revision-simplified-plan-v23-cost-sample.png`。
- 设计改款第一步与“生产准备单”菜单截图：`output/playwright/pcs-design-revision-simplified-plan-menu-v23.png`。
- 工作项／负责团队截图：`output/playwright/pcs-design-revision-work-items.png`。
- 管理员代操作专业任务截图：`output/playwright/pcs-design-revision-admin-override.png`。
- 完整时间节点截图：`output/playwright/pcs-design-revision-work-items-times.png`。
- 款式关系三行左对齐截图：`output/playwright/pcs-design-revision-style-relation-three-lines.png`。
- 样衣结果：5 组全流程均以真实文件对象提交销售展示样衣和首单样衣图片，缺图片会阻断。
- 纸样结果：复用基码和齐码纸样均真实读取 `.prj` 文件；类型不符或缺失会阻断。
- 页面截图：`output/playwright/pcs-design-revision-list-final.png`、`output/playwright/pcs-production-preparation-master-list-final.png`、`output/playwright/pcs-first-order-sample-detail-final.png`、`output/playwright/fcs-production-preparation-timing-final.png`、`output/playwright/fcs-production-preparation-timing-statistics-final.png`、`output/playwright/fcs-printing-pending-handover-final.png`。

### 例外

- 本仓库是高保真原型，不实现真实后端、数据库、鉴权、跨系统消息队列或离线重试；测试通过的是当前原型仓储和页面交互契约。
- 现有内部枚举 `PRE_PRODUCTION_SAMPLE` 继续作为历史兼容标识，但 PCS 用户页面统一显示“首单样衣”；FCS 下游真实“产前版样衣”保持原语义。
- 生产准备时效通用数据类型仍兼容历史基码项目，但当前生产准备单投影不生成基码项目，统计卡片和导出也不再汇总“完成基码”。
- 设计改款内部仍保留一个不向用户展示的“整款”作用域，用于兼容既有 BOM、任务和加工单关联；用户页面不把它呈现为颜色字段，也不能通过页面维护颜色映射。

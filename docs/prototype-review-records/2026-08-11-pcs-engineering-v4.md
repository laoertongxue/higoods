# PCS 生产工程管理 V4 原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-11；2026-08-12 查漏补缺复核 |
| 相关需求／任务 | 严格实施《PCS 生产工程管理完整调整方案》ADJ-001～027 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PCS；FCS 生产准备时效只读页面 |
| 涉及页面路径 | 独立改款／设计打样、销售展示样衣、工程主单、工程变更、制版、花型、调色、辅料下单、技术包确认、产前版样衣、技术包、生产准备时效 |
| 端类型 | 管理端 |
| 主要角色与任务 | 跟单确认工作和衔接；买手维护 BOM 与审核；版师、制作、花型、染厂、采购团队完成专业工作 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：调整业务入口、样衣命名、独立打样创建顺序、A→B 颜色与物料处理、团队责任、主单任务表格、专业任务详情、工程变更对象与状态、技术包退回、时效来源、列表筛选、Mock、真实上传和页面文案。

审查基线：

- `AGENTS.md` 第 4、5、7 节。
- `docs/product-design/PCS生产工程管理完整调整方案.md` V4.0。
- `docs/product-design/PCS生产工程管理总体设计文档.md` V4.0。
- `docs/product-design/PCS生产工程管理需求追踪与交付矩阵.md` V4.0。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 任务先落团队，实际动作后记录人员；管理端采用表格与详情操作区 |
| 文案、状态、数量与单位 | 通过 | 统一业务语言；工程变更六状态；BOM 公式和货币口径保持已确认规则 |
| 扫码、真实图片与对象识别 | 通过 | 本期无扫码；款式／物料真实缩略图与对象同块展示，高清大图可用 |
| 防错、危险确认与主管兜底 | 通过 | A／B 同款、主单唯一、固定依赖、BOM 未确认、文件失败和审核退回均有门禁 |
| 交接、跨端事实与异常追溯 | 通过 | 明确当前团队、动作、完成后去向；时效只读主单事件 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 本期无 PDA；1366×768、1280×720 已验证；上传失败可重新选择 |
| 命名路由、交互、图片大图与打印 | 通过 | 本期无打印；命名路由、状态推进、真实上传、预览／下载及 Esc 关闭已验证 |

## 4. 问题标签

- `读不懂`
- `状态抽象`
- `字段过载`
- `协作断裂`
- `追溯不足`
- `组件误用`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 改款、设计、主单和变更任务边界混用 | 读不懂 | 跟单、专业团队 | 分为三条路径并标注任务来源 | 无遗留风险 |
| 销售展示样衣与产前版样衣混称 | 读不懂 | 跟单、制作团队 | 拆分入口、名称、成果和用途 | 无遗留风险 |
| 创建打样时直接勾任务 | 协作断裂 | 跟单、买手 | 先建业务单和 B 款 BOM，再确认工作 | 无遗留风险 |
| A 款物料直接复制给 B 款 | 追溯不足 | 买手 | 颜色对应和逐物料处理，结果归 B 款 | 无遗留风险 |
| 未开始即出现虚拟个人负责人 | 追溯不足 | 全部团队 | 先记录团队，实际动作后记录个人 | 无遗留风险 |
| 团队专属状态使列表复杂 | 状态抽象 | 全部团队 | 保持统一状态，仅一个团队筛选 | 无遗留风险 |
| 主单泳道花哨、依赖难读 | 字段过载 | 跟单 | 改用任务表格和业务名称 | 无遗留风险 |
| 专业任务用通用说明完成 | 组件误用 | 专业团队 | 按专业字段、真实成果、审核和返工执行 | 无遗留风险 |
| 工程变更选择抽象模块 | 读不懂 | 跟单、买手、专业团队 | 选择具体修改项并分流到真实任务或草稿栏目 | 无遗留风险 |
| 变更任务不进专业列表 | 协作断裂 | 专业团队 | 投影到统一专业列表并标注来源 | 无遗留风险 |
| 技术包退回对象模糊 | 追溯不足 | 审核人、专业团队 | 退回到具体行、栏目、任务或成果 | 无遗留风险 |
| 文件名、地址模拟上传 | 组件误用 | 专业团队 | 使用真实文件选择、校验、保存、预览和下载 | 无遗留风险 |
| 制版成果进入技术包时只剩文件名 | 追溯不足 | 版师团队、跟单、技术包审核人 | 任务成果保存真实源文件和预览图，技术包草稿及正式快照继续保留真实内容与文件信息 | 无遗留风险 |
| 非图片附件或旧记录补造预览／下载 | 组件误用 | 专业团队、审核人 | 非图片明确无预览；缺失原文件提示重新上传；删除假预览、假下载和假种子图 | 无遗留风险 |

## 6. 最终结论

结论：通过。

说明：当前分支的 PCS V4 专项契约、真实浏览器工作流、生产构建、标准列表治理和命名页面已完成验证。原型治理按本任务文件范围隔离执行；工作区中无关 FCS 修改不纳入本记录。

## 7. 变更覆盖与验证

### 受管文件

- `src/components/ui/filter-bar.ts`
- `src/components/ui/engineering-file-upload.ts`
- `src/data/app-shell-config.ts`
- `src/data/fcs/tech-packs.ts`
- `src/data/pcs-engineering-change-workspace.ts`
- `src/data/pcs-engineering-color-task-service.ts`
- `src/data/pcs-engineering-file-upload.ts`
- `src/data/pcs-engineering-master-repository.ts`
- `src/data/pcs-engineering-master-sampling.ts`
- `src/data/pcs-engineering-master-types.ts`
- `src/data/pcs-engineering-master-view-model.ts`
- `src/data/pcs-engineering-pattern-result.ts`
- `src/data/pcs-engineering-preparation-projection.ts`
- `src/data/pcs-engineering-tech-pack-workspace.ts`
- `src/data/pcs-engineering-task-review.ts`
- `src/data/pcs-engineering-task-upload-repository.ts`
- `src/data/pcs-engineering-team-directory.ts`
- `src/data/pcs-tech-pack-review.ts`
- `src/data/pcs-technical-data-version-bootstrap.ts`
- `src/data/pcs-technical-data-version-repository.ts`
- `src/data/pcs-technical-data-version-types.ts`
- `src/main-handlers/pcs-handlers.ts`
- `src/pages/pcs-engineering-change.ts`
- `src/pages/pcs-engineering-master-detail.ts`
- `src/pages/pcs-engineering-tasks.ts`
- `src/pages/pcs-engineering-tasks/color-task.ts`
- `src/pages/pcs-engineering-tasks/first-sample-task.ts`
- `src/pages/pcs-engineering-tasks/master-task-common.ts`
- `src/pages/pcs-engineering-tasks/master-task-page.ts`
- `src/pages/pcs-engineering-tasks/pattern-task.ts`
- `src/pages/pcs-engineering-tasks/plate-making-task.ts`
- `src/pages/pcs-engineering-tasks/shared.ts`
- `src/pages/pcs-independent-sampling.ts`
- `src/pages/production/preparation-timing.ts`
- `src/pages/tech-pack/asset-domain.ts`
- `src/pages/tech-pack/context.ts`
- `src/pages/tech-pack/core.ts`
- `src/pages/tech-pack/events.ts`
- `src/pages/tech-pack/pattern-domain.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-pcs.ts`

### 页面路由

- `/pcs/engineering/revision-sampling`
- `/pcs/engineering/design-sampling`
- `/pcs/samples/display-sample`
- `/pcs/engineering/masters`
- `/pcs/engineering/masters/:id`
- `/pcs/engineering/changes`
- `/pcs/engineering/changes/new`
- `/pcs/engineering/changes/:id`
- `/pcs/patterns/plate-making`
- `/pcs/patterns/artwork`
- `/pcs/engineering/color`
- `/pcs/engineering/purchase`
- `/pcs/engineering/tech-pack`
- `/pcs/samples/first-sample`
- `/pcs/technical-data/tech-packs`
- `/fcs/production/preparation-timing`

### 验证命令

- `npm run check:pcs-engineering-master`：通过，23／23，0 失败；覆盖全部 PCS V4 专项。
- `npx playwright test tests/pcs-engineering-pre-production-sample-submit-dom.spec.ts tests/pcs-engineering-task-review-ui.spec.ts --workers=1 --reporter=line`：通过，4／4；覆盖真实图片、真实 `.prj`、任务成果原文件保存、大图与 Esc、花型部分退回和调色三阶段。
- `npx playwright test tests/pcs-tech-pack-real-pattern-file.spec.ts --workers=1 --reporter=line`：通过，1／1；上传真实 Zip 后下载并逐字节比对一致。
- `npm run build`：通过；隔离任务快照构建 2,339 个模块，仅保留既有大包体积提示，不影响本次业务验收。
- `GIT_INDEX_FILE=/private/tmp/pcs-engineering-v4-audit-20260812.index npm run check:prototype-design-governance`：通过；41 个用户可见文件，按本次 PCS 文件范围隔离执行。
- `npm run check:list-page-governance:static`：通过，355 个受管列表页、18 个历史基线页。
- `npm run check:standard-list-page-template`：通过。
- `codegraph sync && codegraph status`：通过；最终修改后同步，状态正常。

### 真实图片验证

- 图片来源：现有款式／物料档案中与对象对应的稳定资源；任务成果由本地真实图片文件产生。
- 对象对应：款式／物料缩略图与名称、编码同一信息块展示。
- 加载失败：显示重新上传或加载失败提示，不以无关占位图冒充。
- 大图弹窗：当前分支已验证按钮、遮罩、Esc、宽高比和低分辨率不溢出。

### 例外

- 本期为前端高保真原型，不实现真实云上传和后端接口；但原型上传也必须由真实本地文件读取并形成可预览、下载的保存结果。
- 工作区中已有的 FCS 菲票相关修改不属于本次 PCS 任务，不纳入本记录或交付声明。
- 全工作区任务收据 `/private/tmp/pcs-engineering-v4-task-receipt.json` 为 `implemented`：范围外 FCS 菲票数据检查与 FCS `--all` 治理未通过；PCS 任务范围的 23 项专项、5 项浏览器场景、构建和隔离治理均通过。

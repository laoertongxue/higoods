# PCS BOM 与价格整款确认专项原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-13 |
| 相关需求／任务 | SAMPLE-STATUS-001～REG-003：改款／设计打样资料准备与 BOM 价格整款确认 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PCS |
| 涉及页面路径 | 改款打样列表／详情、设计打样列表／详情、BOM 与价格列表／详情、工程主单详情、工程变更详情、技术包审核／生效 |
| 端类型 | 管理端 |
| 主要角色与任务 | 买手维护目标颜色、颜色物料和整款费用并交接；跟单安排工作、退回或确认；专业团队执行既有任务；买手审核技术包物料与核价 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：调整两类打样的创建状态和文案；把多颜色费用收口为整款唯一事实；移除单颜色确认入口；新增整款校验、锁定、退回、主单确认和技术包价格快照规则；调整 BOM 列表、详情和业务动作反馈。

审查基线：

- `AGENTS.md` 第 4、5、7 节。
- `docs/product-design/PCS改款与设计打样资料准备及BOM价格确认专项调整方案.md`。
- `docs/product-design/PCS改款与设计打样BOM价格专项实施验收报告.md`。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 买手完成新款资料准备，跟单安排工作；单颜色维护与整款业务确认边界明确 |
| 文案、状态、数量与单位 | 通过 | 创建态使用“新款资料准备中”；费用明确为整个 SPU 共用；人民币、印尼盾和当前汇率分别展示 |
| 扫码、真实图片与对象识别 | 通过（范围内） | 本期无扫码；款式和物料继续读取档案图片；相邻样衣／纸样真实文件上传回归通过 |
| 防错、危险确认与主管兜底 | 通过 | 缺任一颜色物料、无有效标准价、费用未决定或有费用无明细均整单阻断；失败无部分锁定 |
| 交接、跨端事实与异常追溯 | 通过 | 买手交接整张锁定，跟单退回整张解锁并记录原因；刷新不重建已交接方案 |
| 低分辨率、PDA、弱网与上传恢复 | 通过（范围内） | 本期为管理端原型，无 PDA；真实文件上传的失败恢复沿用既有专业任务能力 |
| 命名路由、交互、图片大图与打印 | 通过（范围内） | 改款／设计／BOM 命名路由与两条真实浏览器流程通过；本期无打印变更 |

## 4. 问题标签

- `读不懂`
- `算不准`
- `状态抽象`
- `协作断裂`
- `点错风险`
- `追溯不足`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 创建任务后仍显示“草稿”，看不出轮到谁 | 状态抽象 | 买手、跟单 | 改为“新款资料准备中”，明确当前团队买手 | 否 |
| 每个颜色各有一套车位费，整款成本重复 | 算不准 | 买手、研发 | 费用上移到整款方案，综合成本和技术包只计一次 | 否 |
| 单颜色可以提前确认，导致整单交接冲突 | 点错风险 | 买手 | 单颜色只保存；所属业务单据一次确认整张方案 | 否 |
| 资料缺失要反复点击才能逐个发现 | 读不懂 | 买手 | 一次列出所有缺颜色物料、价格和费用决定问题 | 否 |
| 交接失败可能留下部分颜色锁定 | 协作断裂 | 买手、跟单 | 整单校验、锁定和失败回滚按原子动作处理 | 否 |
| 退回或重新打开会覆盖已有 BOM | 追溯不足 | 买手、跟单 | 退回只解锁并保留内容；已交接方案不再补种 | 否 |
| 工程变更把资料变更伪装成专业任务 | 读不懂 | 跟单、专业团队 | 统一成下一版技术包的“用料与成本”修改项 | 否 |

## 6. 最终结论

结论：有条件通过

说明：本专项 40／40 原子需求、38／38 验收场景、两条浏览器流程、核心契约、相邻回归、构建、标准列表模板检查和 CodeGraph 均通过。条件仅为全仓列表静态检查仍被一个未由本专项修改的 FCS 基线文件阻断；该问题必须由对应 FCS 任务处理，不能在 PCS 专项中越界修改或改写基线。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-engineering-bom-pricing.ts`
- `src/data/pcs-engineering-bom-repository.ts`
- `src/data/pcs-engineering-bom-types.ts`
- `src/data/pcs-engineering-bom-version.ts`
- `src/data/pcs-engineering-change-workspace.ts`
- `src/data/pcs-engineering-master-repository.ts`
- `src/data/pcs-engineering-master-sampling.ts`
- `src/data/pcs-engineering-master-view-model.ts`
- `src/data/pcs-engineering-tech-pack-workspace.ts`
- `src/data/pcs-tech-pack-review.ts`
- `src/data/pcs-technical-data-version-repository.ts`
- `src/data/pcs-technical-data-version-types.ts`
- `src/pages/pcs-engineering-change.ts`
- `src/pages/pcs-engineering-master-detail.ts`
- `src/pages/pcs-independent-sampling.ts`
- `src/pages/pcs-technical-data.ts`
- `src/pages/tech-pack/cost-domain.ts`
- `src/pages/tech-pack/events.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-pcs.ts`

### 页面路由

- `/pcs/engineering/revision-sampling`
- `/pcs/engineering/revision-sampling/:id`
- `/pcs/engineering/design-sampling`
- `/pcs/engineering/design-sampling/:id`
- `/pcs/technical-data/bom-pricing`
- `/pcs/technical-data/bom-pricing/:id`
- `/pcs/technical-data/bom-pricing/plan/:ownerType/:ownerId`
- `/pcs/engineering/masters/:id`
- `/pcs/engineering/changes/:id`
- `/pcs/technical-data/tech-pack/:id`

### 验证命令

- 8 组 BOM、打样、工程主单、工程变更、技术包专项契约：通过。
- 6 组制版、花型、调色、辅料、样衣、技术包确认和资料库相邻回归：通过。
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4191 PLAYWRIGHT_REUSE_EXISTING_SERVER=true npx playwright test tests/pcs-independent-sampling-v41-e2e.spec.ts --workers=1 --reporter=line`：通过，2／2，10.9 秒。
- `npm run build`：通过，2,340 个模块，6.05 秒。
- 标准列表模板浏览器检查：通过，列拖拽、顺序和持久化正常。
- `npm run check:prototype-design-governance -- --all`：通过，20 个用户可见文件均关联本记录。
- `git diff --check`：通过。
- CodeGraph：已同步 24 个变更文件，索引无待同步文件。
- 全仓 `check:list-page-governance:static`：未通过；只命中未由本专项修改的 `src/pages/process-factory/cutting/fei-tickets.ts`，不作为 PCS 功能失败，也不伪报绿灯。

### 真实图片验证

- 改款、设计、工程主单和 BOM 页面继续从款式档案与物料档案读取对应图片，图片与对象标识同块展示。
- 相邻回归确认销售展示样衣和产前版样衣仍使用浏览器真实本地图片文件；制版任务仍使用真实非空 `.prj` 文件。
- 本专项没有引入占位图片或文件名模拟上传。

### 例外

- 本仓库是高保真前端原型；真实上传指浏览器读取、校验并保存真实本地 `File`，不代表已接入生产云存储。
- 本期不涉及 PDA 和打印，相关验收不适用。
- 全仓列表静态检查的 FCS 基线阻断不属于本次 PCS 变更范围，已单独披露。

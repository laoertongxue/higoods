# PCS 改款与设计打样 V4.1 原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-12 |
| 相关需求／任务 | ADJ-028～ADJ-041：目标颜色、BOM 建立时点、团队四步接力、统一页面与真实上传 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PCS |
| 涉及页面路径 | 改款打样列表／详情、设计打样列表／详情、独立打样专业任务详情、BOM 与价格 |
| 端类型 | 管理端 |
| 主要角色与任务 | 买手完成新款颜色与 BOM；跟单安排和整单确认；版师、制作、花型、染厂团队完成专业工作 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：修改草稿建立时点、目标颜色与目标尺码维护、BOM 建立和来源规则、买手／跟单退回、四步详情、当前团队、自动步骤推进、列表列设置位置、Mock 和真实上传验收。

审查基线：

- `AGENTS.md` 第 4、5、7 节。
- `docs/product-design/PCS改款打样目标颜色BOM与团队分步调整方案.md` V4.1。
- `docs/product-design/PCS生产工程管理总体设计文档.md` V4.1。
- `docs/product-design/PCS生产工程管理需求追踪与交付矩阵.md` V4.1。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 管理端按四步区分买手、跟单和专业团队；未开始时只到团队，实际动作后记录个人 |
| 文案、状态、数量与单位 | 通过 | 使用目标颜色、参考颜色、当前需处理团队等业务语言；目标颜色与 BOM 按 N 对 N 展示 |
| 扫码、真实图片与对象识别 | 通过 | 本期无扫码；款式／物料图片与对象同块展示，样衣成果由真实本地图片产生 |
| 防错、危险确认与主管兜底 | 通过 | 重名、缺尺码、错误文件、空文件、跨步骤编辑和重复确认均阻断；重新按参考色生成需要明确确认 |
| 交接、跨端事实与异常追溯 | 通过 | 当前步骤、当前团队和完成后去向读取同一事实；跟单退回保留原因与操作记录 |
| 低分辨率、PDA、弱网与上传恢复 | 通过（范围内） | 本期无 PDA；1366×768 管理端验收；原型不实现离线队列，上传失败可重新选择 |
| 命名路由、交互、图片大图与打印 | 通过 | 本期无打印；改款／设计命名路由、真实 `.prj`、图片大图和 `Esc` 已验收 |

## 4. 问题标签

- `读不懂`
- `协作断裂`
- `点错风险`
- `追溯不足`
- `组件误用`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 新建草稿就生成空壳 BOM | 读不懂 | 买手、跟单 | 目标颜色确认后才按 N 对 N 建 BOM | 否 |
| 目标颜色被 B 款已有颜色限制 | 点错风险 | 买手 | 允许输入、选用和移出本次颜色，并选择目标尺码 | 否 |
| 参考 A 款与读取 B 款历史混用 | 追溯不足 | 买手 | 只读取明确 A 款合格 BOM；无参考则空白 | 否 |
| 四个团队内容纵向混排 | 协作断裂 | 买手、跟单、专业团队 | 四步详情，默认当前步骤，完成后自动交接 | 否 |
| 完成动作后页面仍停旧步骤 | 协作断裂 | 全部团队 | 成功动作后统一按最新业务事实选择当前步骤 | 否 |
| 页面重组可能退化成文件名模拟上传 | 组件误用 | 专业团队 | 复用真实文件读取、校验、保存、预览和下载 | 否 |
| 列设置与新建混在标题区 | 组件误用 | 跟单 | 列设置归入数据列表表头最右侧 | 否 |

## 6. 最终结论

结论：通过

说明：最后一次源代码修改后，V4.1 两条命名浏览器流程 2／2、既有专业成果与技术包流程 5／5、领域和页面专项、PCS 总门禁 23／23、构建、标准列表治理、隔离 PCS 原型治理和 CodeGraph 均通过。当前仅缺提交、推送和产品确认，不影响本次原型审查结论。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-engineering-bom-repository.ts`
- `src/data/pcs-engineering-bom-types.ts`
- `src/data/pcs-engineering-bom-version.ts`
- `src/data/pcs-engineering-master-sampling.ts`
- `src/data/pcs-engineering-master-types.ts`
- `src/data/pcs-style-archive-repository.ts`
- `src/pages/pcs-independent-sampling.ts`

### 页面路由

- `/pcs/engineering/revision-sampling`
- `/pcs/engineering/revision-sampling/:id`
- `/pcs/engineering/design-sampling`
- `/pcs/engineering/design-sampling/:id`
- `/pcs/engineering/sampling-professional/:id`
- `/pcs/technical-data/bom-pricing/:id`

### 验证命令

- `node --experimental-strip-types --experimental-specifier-resolution=node tests/pcs-independent-sampling.spec.ts`：通过。
- `node --experimental-strip-types --experimental-specifier-resolution=node tests/pcs-independent-sampling-pages.spec.ts`：通过。
- `npx playwright test tests/pcs-independent-sampling-v41-e2e.spec.ts --workers=1 --reporter=line`：通过，2／2；使用当前 127.0.0.1:4173 服务。
- `npx playwright test tests/pcs-engineering-pre-production-sample-submit-dom.spec.ts tests/pcs-engineering-task-review-ui.spec.ts tests/pcs-tech-pack-real-pattern-file.spec.ts --workers=1 --reporter=line`：通过，5／5。
- `npm run check:pcs-engineering-master`：通过，23／23。
- `npm run build`：通过，2,339 个模块；只有既有包体积提示。
- `npm run check:list-page-governance:static`：通过，扫描 355 页、历史基线 18 页。
- `npm run check:standard-list-page-template`：通过，Chromium 列拖拽、顺序和持久化正常。
- 隔离本次 PCS 文件的 `npm run check:prototype-design-governance`：通过，7 个用户可见文件关联本记录。
- `codegraph status`：通过，1,494 个文件、45,932 个节点、162,068 条边，无待同步提示。

### 真实图片验证

- 款式图片来源于款式档案，与款号和款式名同块展示。
- 物料图片来源于物料档案，与物料编码和名称同块展示。
- 销售展示样衣成果通过真实 JPEG 文件选择产生；大图可打开，遮罩和 `Esc` 可关闭。
- 基码纸样通过真实非空 `.prj` 文件产生，保存后可按原文件名下载；空文件被明确阻断。
- 图片或文件失败时不以无关占位内容冒充成功，用户可以重新选择。

### 例外

- 本期是前端高保真原型，不接真实后端或云存储；“真实上传”指浏览器真实读取本地 `File`、校验内容并保存可预览／下载的数据事实。
- 本期不包含 PDA 和打印；相应页面证据不适用。
- 工作区中无关 FCS 修改不属于本记录，不纳入 PCS 结论。

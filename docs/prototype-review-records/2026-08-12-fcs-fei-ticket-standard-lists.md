# FCS 菲票打印标准列表迁移原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-12 |
| 相关需求／任务 | 部位菲票打印列表、捆条菲票打印列表标准化迁移，以及 IMAGE-001、HANDOVER-001、PDA-001、PRINT-001 四项阻塞修复 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PFOS（裁床厂管理）／FCS 共享打印能力 |
| 涉及页面路径 | `/fcs/craft/cutting/fei-tickets`、`/fcs/craft/cutting/binding-fei-tickets`、`/fcs/pda/warehouse/wait-handover?scope=cutting`、`/fcs/pda/cutting/fei-ticket-numbering` |
| 端类型 | 管理／主管端桌面 Web；PDA 仓管入口 |
| 主要角色与任务 | 裁床打票员／主管筛选、查看、打印和补打；PDA 仓管进入菲票打编号 |
| 开工版本 | `main@1decb915f0edcf6c87dc08da2f04c244f31d4a36` |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：两个顶层列表的骨架、表格、分页和列控制发生可见变化；当前列表物料改为对象对应正式效果图；PDA 增加既有菲票编号入口；增加缺工厂与待首打稳定演示样本。

边界说明：

- 不修改普通／特殊工艺分类、菲票生成数量、白／黄纸分流、打印模板、手动建票、补打、承接工厂判断、正式交出门禁或核心打印状态推导。
- 兼容追踪补数只排除显式标记“待打印菲票”的样本，避免把该样本自动伪造成已打印；`derivePrintableUnitStatus` 和打印处理保持原样。
- PDA 新动作只复用既有 `/fcs/pda/cutting/fei-ticket-numbering` 页面，不新增编号业务逻辑。

完整产品审查当前基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、标准列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 两个顶层页面仍是管理／主管端标准数据列表；PDA 只新增一个明确动作入口。 |
| 文案、状态、数量与单位 | 通过 | 原列字段和件、片、张、米口径保持；打印投影稳定覆盖待打印、已打印、需补打。 |
| 扫码、真实图片与对象识别 | 通过 | 当前 17 个捆条加工单／15 个物料颜色身份均映射仓库内正式 PNG，0 SVG、0 缺图；图片与物料身份同列，具备大图、关闭、`Esc` 和失败态。 |
| 防错、危险确认与主管兜底 | 通过 | 白／黄纸混打、特殊工艺缺承接工厂、非法手动层数／全零尺码继续阻断；缺工厂候选保留恢复原因。 |
| 交接、跨端事实与异常追溯 | 通过 | 缺工厂特殊工艺样本由现有候选投影和交出门禁读取；可交出正常样本仍通过。 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 1366×768、1280×720 无页面级横向溢出；PDA 七入口和编号目标页已验收；本页无上传流程。 |
| 命名路由、交互、图片大图与打印 | 通过 | 双列表路由、分页、三态排序、列显示／顺序／冻结、偏好隔离、局部更新、首次打印和白／黄纸打印均有当前证据。 |

## 4. 问题标签

- `组件误用`：两个历史顶层列表未接入统一标准列表能力，现已迁移。
- `缺扫码识别`：PDA 待交出仓缺菲票打编号入口，现已补齐。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 两个顶层列表未接标准列表 | `组件误用` | 打票员／主管 | 接入统一骨架、表格、分页和独立路由偏好 | 否 |
| 物料为生成色板 SVG／Navy、Khaki 拼接物料误回退黑色图 | `视觉干扰` | 打票员／主管 | 补齐 13 个效果图文件；当前列表使用 10 类资源，并对上游拼接物料 Black／Charcoal／Navy／Khaki 四色显式映射 | 否 |
| 缺工厂门禁无法由当前数据观察 | `缺主管兜底` | 裁床主管／仓管 | 补入未配置专用承接工厂的手工钉珠样本，不改门禁算法 | 否 |
| PDA 缺菲票打编号入口 | `缺扫码识别` | PDA 仓管 | 七入口中新增既有编号页直达动作，并更新对应契约文档／检查 | 否 |
| 基线没有待首打对象 | `追溯不足` | 打票员 | 补稳定裁剪完成样本，阻止兼容层为显式待打印样本生成假打印记录 | 否 |

## 6. 最终结论

结论：通过

说明：

- 两张顶层列表已经完成标准化迁移，现有菲票业务动作继续由原逻辑处理。
- IMAGE-001 四色映射、HANDOVER-001 缺工厂门禁、PDA-001 七入口和 PRINT-001 待首打均已重新验证；CodeGraph 无 pending，最终任务收据为 `verified` 且 0 blockers。
- 当前结论是本地当前工作树的产品与技术验证结论，不表示已经提交、远端交付或用户正式接受。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/process-factory/cutting/fei-tickets.ts`
- `src/pages/process-factory/cutting/fei-tickets-model.ts`
- `src/pages/process-factory/cutting/traceability-projection-helpers.ts`
- `src/pages/pda-cutting-wait-handover-actions.ts`
- `src/data/fcs/cutting/generated-cut-orders.ts`
- `src/data/fcs/cutting/generated-fei-tickets.ts`
- `src/data/fcs/production-material-image-assets.ts`
- `src/data/fcs/production-tech-pack-snapshot-builder.ts`
- `src/data/pcs-technical-data-version-bootstrap.ts`

### 页面路由

- `/fcs/craft/cutting/fei-tickets`
- `/fcs/craft/cutting/binding-fei-tickets`
- `/fcs/pda/warehouse/wait-handover?scope=cutting`
- `/fcs/pda/cutting/fei-ticket-numbering`
- `/fcs/craft/cutting/fei-tickets/print`

### 验证命令

- `npm run check:cutting-fei-ticket-standard-lists`：通过（10/10）。
- `npm run check:cutting-fei-ticket-assembly`：通过（6 项装配契约）。
- `npm run check:cutting-fei-ticket-paper-routing`：通过（6/6）。
- `npm run check:cutting-fei-ticket-numbering`：通过。
- `npm run check:cutting-binding-strip-flow`：通过（18 条需求、17 单、20 张唯一票；保持迁移前业务口径）。
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=43193 npx playwright test tests/cutting-fei-ticket-print-route.spec.ts --workers=1 --reporter=line`：通过（1/1）。
- `npm run check:cutting-clean-mainline`：通过（126 条主链路事件；14 个生产单、29 个裁片单）。
- `npm run check:cutting:all`：通过（含待交出仓 266/266）。
- `npm run check:cutting-warehouse-management-switch`：通过。
- `npm run check:pda-cutting-wait-handover-entry-routing`：通过。
- `npm run check:factory-mobile-app-redesign`：通过。
- `npm run check:list-page-governance`：通过（扫描 355 页、历史基线 17 项、Chromium 列拖拽通过）。
- `npm run check:prototype-design-governance -- --all`：通过（9 个用户可见文件、1 份完整审查记录）。
- `npm run build`：通过（Vite 转换 2341 个模块）。
- `git diff --check`：通过。
- `codegraph sync`、`codegraph status`：通过（Already up to date；1497 个文件、46040 个节点、162786 条边）。
- `npm run workflow:verify -- --output /private/tmp/higoods-fei-ticket-recheck-receipt-20260812/task-receipt.json --task-boundary "FCS 部位菲票与捆条菲票标准列表迁移、四项阻塞修复及第二轮查漏补缺"`：通过（`verified`，0 blockers；CodeGraph pending 0；四项路由检查 exit code 均为 0）。

### 真实图片验证

素材来源清单：`public/materials/fei-ticket/sources.json`。素材为本原型生成并人工核查的正式面料效果图，不表述为工厂现场实拍照。

| 素材 | 对象对应关系 |
| --- | --- |
| `black-stretch-twill.png`／`charcoal-stretch-twill.png` | `SPU-2024-010` 主面料，按 Black／Charcoal |
| `black-splice-fabric.png`／`charcoal-splice-fabric.png`／`navy-splice-fabric.png`／`khaki-splice-fabric.png` | `MAT-SUPPLEMENT-SECONDARY-010` 拼接面料，按 Black／Charcoal／Navy／Khaki |
| `grey-main-fabric.png` | `SPU-2024-005` 灰色主面料 |
| `white-poplin.png` | `SPU-2024-009` 本白府绸 |
| `navy-main-fabric.png` | `SPU-2024-017` 藏青主面料；点名 BOM `tdv_demand_SPU_2024_017-bom-main` |
| `fog-grey-sweatshirt-fleece.png` | `SPU-HOODIE-082` 雾霾灰卫衣绒 |
| `red-dress-crepe.png` | `SPU-DRESS-083` 红色裙装面料 |
| `blue-white-print-cotton.png` | `SPU-SHIRT-086` 蓝白印花棉 |
| `khaki-canvas.png` | `SPU-2024-010` Khaki 稳定待首打样本 |

自动化逐行核对 URL 格式、仓库文件存在、文件大于 100KB、非 `data:image/svg+xml`；浏览器再核对缩略图、物料标识、大图比例、关闭和失败提示。

### 页面与打印证据

证据目录：`output/playwright/fei-ticket-complete-20260812/recheck/`。

- `01-part-list-1366x768.png`：部位菲票统一骨架、标准表格和分页。
- `02-binding-list-1280x720.png`：捆条菲票最低桌面分辨率和表格内部滚动。
- `03-spu-017-material-preview.png`：点名 SPU-017 物料缩略图与高清大图。
- `04-pda-seven-actions-390x844.png`：390×844 PDA 待交出仓七个动作。
- `05-pda-numbering-page-390x844.png`：390×844 既有菲票打编号目标页。
- `06-first-print-waiting.png`：`CUT-260307-102-03` 待首打页面。
- `07-white-paper-print-preview.png`：普通菲票白色热敏纸打印输出。
- `08-yellow-paper-special-craft-print-preview.png`：特殊工艺菲票黄色热敏纸打印输出。

### 例外

- 无

### 第二轮查漏补缺

- 发现 Navy／Khaki 拼接物料会回退到 Black 图片，已补齐对应正式效果图和四色显式断言；未知颜色返回缺图，不再静默冒充。
- 发现上一轮为区分图片身份把颜色写入裁单稳定 ID，导致唯一捆条菲票由原业务口径 20 张变为 18 张；该越界改动已撤回，图片按物料身份解析，不触碰生成、聚合或票数规则。
- 原 `04`、`05` PDA 截图尺寸不是实际小屏证据，已作废并按 390×844 重新生成；七入口、目标路由、扫码输入和页面级无横向溢出均已复验。

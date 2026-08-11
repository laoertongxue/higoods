# FCS 部位菲票手动建票与分纸打印原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-11 |
| 补充复核日期 | 2026-08-12 |
| 相关需求 / 任务 | FCS 部位菲票手动建票、详情维护、辅助／特种工艺识别、白／黄热敏纸分流和正式标签模板 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PFOS（裁床厂管理）／FCS 共享打印能力 |
| 涉及页面路径 | `/fcs/craft/cutting/fei-tickets`、手动批次详情、`/fcs/print/preview` |
| 端类型 | 管理端／主管端 |
| 主要角色与任务 | 裁床打票员按唛架手动建票并打印；裁床主管复核工艺、纸色、数量和补打原因 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：列表新增“手动增加打印菲票”；手动批次详情新增普通／特殊工艺 Tab、新增、改量、删除、筛选、分页、选择、批量／全部打印、单条打印和补打门禁；普通菲票改用白色热敏纸提示并删除工艺字段；辅助／特种工艺菲票改用黄色热敏纸提示，并在模板显著展示生产单号（PO）、SPU、工艺和承接工厂；打印记录新增纸色、模板、尺寸、范围和原因。

审查基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 管理／主管端围绕建票、复核、打印和补打组织；主动作名称与现场动作一致。 |
| 文案、状态、数量与单位 | 通过 | 区分件、层和片；无铺布单不伪造编号；白／黄热敏纸、未打印、已打印、补打原因均使用业务文案。 |
| 扫码、真实图片与对象识别 | 通过 | 每张菲票二维码引用同一票号、生产单、来源、部位、尺码、数量和编号范围；本次未新增款式／物料展示，不触发真实图片新增门禁。 |
| 防错、危险确认与主管兜底 | 通过 | 非法层数／全零尺码阻断；混纸阻断；缺工厂阻断；打印前确认纸色；改量和补打强制原因；已打印记录锁定。 |
| 交接、跨端事实与异常追溯 | 通过 | 特殊工艺及承接工厂读取同一菲票事实；操作日志保存新增、改量、删除、打印和补打；捆条链路不变。 |
| 低分辨率、PDA、弱网与上传恢复 | 不适用 | 本次为桌面管理／主管端打印原型，不修改 PDA、上传或离线能力；1366×768 以上可完成主流程。 |
| 命名路由、交互、图片大图与打印 | 通过 | 列表、详情、白纸模板、黄纸模板、补打确认和补打预览均在当前隔离分支实测；打印二维码实际渲染。 |

## 4. 问题标签

- 无。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 原列表缺少无铺布单手动建票 | 协作断裂 | 打票员 | 增加按现有唛架及成员建票并明确“无铺布单”来源 | 否 |
| 普通与辅助／特种工艺菲票无法从页面和纸张区分 | 选不对 | 打票员／主管 | 按票分 Tab、白／黄纸二次确认、禁止混批 | 否 |
| 普通模板仍携带无意义工艺栏，特殊模板标识不突出 | 读不懂 | 现场打印人员 | 普通模板删除整行；特殊模板在标题与正文显著展示 | 否 |
| 黄色特殊工艺菲票缺少生产单号和 SPU | 识别不全 | 打票员／特殊工艺工厂 | 在每张黄色菲票正文顶部增加独立、加粗的“生产单号（PO）”和“SPU”字段，复用同一打印投影 | 否 |
| 改量和补打缺少完整审计事实 | 追溯不足 | 主管／跟单 | 原因必填，并保存纸色、模板、尺寸和来源范围 | 否 |

## 6. 最终结论

结论：有条件通过。

说明：

- 正常、阻断、历史保护、打印和补打场景均有自动化证据。
- 普通／特殊工艺两类模板均有当前分支页面截图，二维码已实际渲染。
- 原型无法读取打印机实际装纸颜色，因此保留明确的人工二次确认；没有把人工确认表述为硬件自动识别。
- 业务、页面、打印、构建和原型治理均通过；隔离工作树尚未初始化 CodeGraph，项目级任务收据需在取得初始化许可后补跑。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/cutting/generated-fei-tickets.ts`
- `src/data/fcs/cutting/manual-fei-tickets.ts`
- `src/data/fcs/cutting/storage/fei-tickets-storage.ts`
- `src/data/fcs/print-service.ts`
- `src/data/fcs/print-template-registry.ts`
- `src/pages/process-factory/cutting/fei-tickets.ts`
- `src/pages/print/print-preview.ts`
- `src/pages/print/print-styles.ts`
- `src/pages/print/templates/label-print-template.ts`
- `src/main-handlers/fcs-handlers.ts`

### 页面路由

- `/fcs/craft/cutting/fei-tickets`
- `/fcs/craft/cutting/fei-tickets/detail?unitType=MANUAL_BATCH&unitId=<手动批次>`
- `/fcs/print/preview?documentType=FEI_TICKET_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=<菲票>&paperColor=WHITE`
- `/fcs/print/preview?documentType=FEI_TICKET_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=<菲票>&paperColor=YELLOW`
- `/fcs/print/preview?documentType=FEI_TICKET_REPRINT_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=<菲票>&paperColor=WHITE&operationReason=<补打原因>`

### 验证命令

- `npm run check:cutting-fei-ticket-paper-routing`：通过，5/5 场景。
- `npm run check:cutting-fei-ticket-assembly`：通过，6 个菲票来源、归属、追溯和二维码维度。
- `npm run check:cutting-binding-strip-flow`：通过，捆条 18 条明细、17 张加工单、20 张唯一菲票。
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=43186 playwright test tests/cutting-fei-ticket-flow.spec.ts --workers=1 --reporter=line`：通过，2/2 场景。
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=43189 npx playwright test tests/.tmp-fei-ticket-final-visual.spec.ts --workers=1 --reporter=line`：通过，1/1 视觉证据生成；临时测试已删除，未进入交付文件。
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=43220 npx playwright test tests/.tmp-fei-ticket-yellow-identifiers-visual.spec.ts --workers=1 --reporter=line`：通过，1/1；复核每张黄色菲票的生产单号（PO）、SPU、工艺／工厂及二维码版式，临时测试已删除。
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=43221 npx playwright test tests/cutting-fei-ticket-manual-paper-routing.spec.ts --workers=1 --reporter=line --grep '辅助工艺和特种工艺菲票只进黄纸 Tab'`：通过，1/1；首次／批量预览逐张检查非空 PO、SPU，并直达黄色补打预览检查补打原因、PO 和 SPU。
- `npm run build`：通过，2340 个模块完成生产构建。
- `npm run check:prototype-design-governance -- --all`：通过，覆盖 10 个用户可见文件和 1 份关联审查记录。
- `npm run workflow:verify -- --output /private/tmp/higoods-fei-receipt.bi6kTA/task-receipt.json --task-boundary "FCS 部位菲票手动建票与白黄热敏纸分流打印"`：失败，隔离工作树未初始化 CodeGraph，收据无法取得 `pendingChanges`；待用户许可初始化后重跑。

### 当前分支页面证据

- `output/playwright/fei-ticket-list-manual-entry-final.png`：列表手动增加入口。
- `output/playwright/fei-ticket-manual-create-modal-final.png`：唛架、成员、生产单、SPU、颜色、SKU、层数和尺码建票。
- `output/playwright/fei-ticket-detail-white-tab-final.png`：普通 Tab、白色热敏纸提示、无工艺列。
- `output/playwright/fei-ticket-detail-yellow-tab-final.png`：特殊工艺 Tab、黄色热敏纸提示、工艺和承接工厂。
- `output/playwright/fei-ticket-edit-reason-final.png`：修改数量原因必填。
- `output/playwright/fei-ticket-print-white-template-final.png`：普通模板无工艺栏且二维码已渲染。
- `output/playwright/fei-ticket-print-yellow-template-final.png`：特殊模板显著标识生产单号（PO）、SPU、工艺／工厂且二维码已渲染。
- `output/playwright/fei-ticket-reprint-reason-final.png`：补打原因与纸张确认。
- `output/playwright/fei-ticket-reprint-preview-final.png`：补打原因、白纸模板和二维码。

### 例外

- 原型不接入打印机传感器，无法自动确认实际装入的纸张颜色；使用强提示和人工二次确认作为原型防错。
- 本次没有修改 PDA、真实后端、上传、离线或打印机驱动能力。

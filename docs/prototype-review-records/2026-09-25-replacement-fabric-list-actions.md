# 换片布列表按钮与详情调整

## 1. 基本信息

2026-09-25；main @ ed0a4d05；/Users/laoer/Documents/higoods；管理端裁床打票员/主管。生产构建 preview43236，开发服务43235。设备1366×768、1280×720、1024×768。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：标题右侧按钮收拢、打印与详情独立、逐票展示实际票面及打印/交出记录。
- 治理基线：AGENTS.md 第2.4、4、5、7节。页面读取既有记录级IndexedDB事实；不新增存储格式或写入入口。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色与布局 | 通过 | 标准列表不变，标题右侧紧凑按钮组，三尺寸按钮间距8px，无主体横溢 |
| 文案、状态、数量 | 通过 | 打印/详情明确分离；5 Yard固定；当前、历史交出、失效票区分 |
| 面料图片 | 通过 | 复用生产单技术资料对应主面料图；同块缩略图、大图三种关闭、失败提示 |
| 追溯与防错 | 通过 | 首次/补打的操作人与时间；交出任务、工厂、时间、确认人、记录与袋使用记录；未打印未交明确为空 |
| 局部更新 | 通过 | 打开详情列表DOM身份不变；详情只读，前后IndexedDB记录完全相等 |
| 性能 | 通过 | 225样本全部<500ms，最大242.69999998807907ms；原始结果和脚本已归档 |

## 4. 问题标签

- 视觉干扰
- 点错风险
- 追溯不足

## 5. 主要问题与处理

三个按钮直接进入justify-between标题栏，导致平均分散；本页用一个右侧flex按钮组包裹。原“打印 / 详情”混合入口拆成独立处理模式。打印保持原选票、新增和预览；详情读取本单全部票及原打印/交出回执，分页展示，无写入动作。12张隔离测试票含首次、补打、已交、未交及失效边界；不表示真实工厂记录。

## 6. 最终结论

结论：通过

本次UI-001至004完成。既有实物标签现场验收不在本次纯页面调整范围内。本轮未推送发布。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/process-factory/cutting/replacement-fabric-fei-tickets.ts`

### 页面路由

- `/fcs/craft/cutting/replacement-fabric-fei-tickets`

### 需求与实施追踪

| 编号 | 用户要求与实现 | 当前证据 | 状态 |
| --- | --- | --- | --- |
| UI-001 | 顶部按钮组；renderContents | browser.json 三尺寸布局、截图 | 已验证 |
| UI-002 | columns、handleReplacementFabricEvent、renderOverlay 分开打印/详情 | 135操作样本；有效票11张整单/单选；无详情写入 | 已验证 |
| UI-003 | renderOrderDetail 逐票打印/交出及历史状态 | 字段断言、10条分页、失效票、40次图片/关闭样本 | 已验证 |

| UI-004 | renderOrderDetail 复用 renderReplacementFabricLabel，逐票实际票面与局部放大预览；hydrateRealQRCodes 生成对应二维码 | ticket-preview/ticket-preview-v2.json：35样本；二维码身份、两处票面一致、预览只读、关闭保持详情DOM及滚动位置；三尺寸截图 | 已验证 |

### 验证命令

- `npm run build`：通过，566单元测试通过；Vite构建13.56秒。
- `playwright-cli run-code --filename output/playwright/hpb-ui-split/check.js`：通过，135样本，最大204.90000000596046ms。
- `playwright-cli run-code --filename output/playwright/hpb-ui-split/routes.js`：通过，冷启动/刷新/站内进入各5次，最大242.69999998807907ms。
- `playwright-cli run-code --filename output/playwright/hpb-ui-split/images.js`：通过，40样本，最大64.5ms；坏图提示通过。
- `playwright-cli run-code --filename output/playwright/hpb-ui-split/ticket-preview.js`：通过，35样本，最大103.69999998807907ms，含5次首次详情打开的实际票面、二维码及图片就绪。
- `git diff --check`：通过。

### 例外

- 无性能豁免。PDA业务、实物打印和交出保存逻辑未改，不增加跨模块实施范围。

### 证据

[evidence/2026-09-25-hpb-list-actions](evidence/2026-09-25-hpb-list-actions) 包含源文件指纹、脚本、每次耗时、截图和构建日志。最新证据为其 `ticket-preview/` 子目录：四份 v2 JSON、脚本、原始输出、票面截图、构建日志及 version.json 源文件指纹；父目录旧190样本仅保留迭代历史，不作为本次完成证明。最终workflow收据在 `output/playwright/hpb-ui-split/task-receipt-preview.json`，绑定冻结差异。

票面直接复用既有打印模板，不另画模拟卡片。票面二维码与当前票身份相同；放大仅更新独立覆盖层，关闭按钮、遮罩和 Esc 均可回到原详情。用户当前 preview43236 浏览器已刷新并打开实际票面，未操作打印确认。

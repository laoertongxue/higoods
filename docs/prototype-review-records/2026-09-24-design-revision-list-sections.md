# 设计改款列表分段展示调整

## 1. 基本信息

2026-09-24；PCS 管理端买手；完整产品审查。路由 `/pcs/production-preparation/design-revision`。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：状态独立列、款式信息精简、物料费用三段展示、加工单去边框，初始化演示任务三种物料两项费用。依据用户本次四点要求及 AGENTS.md 第 4、5、7 节。
- 范围：列表展示和该列表初始化 Mock，已有用户记录不修改；PDA、打印和加工事实无变化。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 标准管理列表，勾选仍在第一列 |
| 文案、状态、数量与单位 | 通过 | 状态独立；品牌仅名称；用量单位、单价、小计和合计 |
| 图片与对象识别 | 通过 | 使用现有 SKU／物料档案图片，同一行并保留大图 |
| 低分辨率、命名路由与交互 | 通过 | 1366×768、1280×720 浏览器验证 |

## 4. 问题标签

视觉干扰、字段过载。

## 5. 主要问题与处理

| 需求 | 实现 | 证据 |
| --- | --- | --- |
| 状态独立列 | listColumns | 列表专项 |
| 删除三项时间、品牌仅名称 | renderDesignRevisionStyleRelation | 列表专项 |
| 物料／费用／合计三段 | renderMaterialCosts | 三段、多行及图片预览断言 |
| 加工单去边框 | renderDesignRevisionProcessOrders | 无 details 断言及截图 |
| 多物料演示 | seedRecords / createDefaultBomLines | 三物料、两费用断言 |

## 6. 最终结论

结论：通过。产品口径由用户本次消息确认；技术验证由 Codex 执行。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/pcs-independent-sampling.ts`
- `src/data/pcs-engineering-master-sampling.ts`

### 页面路由

- `/pcs/production-preparation/design-revision`

### 验证命令

工作树 `/Users/laoer/Documents/higoods`；分支 main，基线 HEAD `5b349675874c3e97fcd7bcf282c3f915942ac395` 加本次差异。

- `npm run build`：通过
- `node scripts/check-typescript-scope.mjs src/pages/pcs-independent-sampling.ts src/data/pcs-engineering-master-sampling.ts`：通过
- `CUTTING_E2E_PORT=4734 CUTTING_E2E_USE_PREVIEW=true CUTTING_E2E_TEST_TIMEOUT=150000 npx playwright test tests/pcs-design-revision-list-performance.spec.ts tests/pcs-design-revision-list-actions.spec.ts tests/pcs-design-revision-legacy-list.spec.ts --workers=1 --reporter=line`：通过

验证结果：

- 生产构建通过；438 项单元测试通过。最后一次 Mock 品类调整后重新执行生产构建及设计改款当前流程 6 项单元测试，全部通过。
- 浏览器列表专项 5 项通过；另行提交染印方案检查加工单无框展示 1 项通过。
- 83 个加载／交互场景各 5 次，共 415 个样本，最大 424.10ms，全部 <500ms。浏览器 Chromium 149.0.7827.55；实际服务为本工作树 preview 4734；1366×768、1280×720。隔离浏览器完整 24 条初始化 Mock，不清除用户数据。
- 原始证据：`docs/prototype-review-records/evidence/2026-09-24-design-revision-sections-performance.json`；包含构建哈希、缓存条件和逐项样本。
- 图片证据：`docs/prototype-review-records/evidence/2026-09-24-design-revision-materials-fees-total.png`、`docs/prototype-review-records/evidence/2026-09-24-design-revision-process-orders.png`。三种面辅料使用已有档案图片，缩略图及大图可用。
- 首轮测试期间重新构建导致旧模块导航失败，保留 `/tmp/dr-layout-browser-first-failed.log`；以稳定最终构建重新完整运行通过，见 `/tmp/dr-layout-browser-final.log`。
- 首轮通用物料种子含设备配件，已将本次多行演示限定为面料／辅料；历史方案仍保持原有单行种子。
- 正向审查四项要求均有实现和页面证据；反向审查未变更实际加工流程、保存数据或其他模块。

### 例外

- 无。未使用染色／印花列表的 1 秒性能例外。

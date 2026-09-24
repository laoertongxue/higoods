# 设计改款列表信息收拢审查

## 1. 范围

管理端买手列表，依据用户 2026-09-24 要求及 AGENTS.md 第 4、5、7 节。原型 Mock，不代表真实业务。

## 2. 实施与追踪

总体设计见 `docs/product-design/PCS设计改款任务产品调整方案-2026-09-23.md` 末节。实施顺序：W1 旧记录规范化 → W2 合并列、数据与筛选 → W3 当前构建自动化和浏览器验证。

| 编号 | 用户要求 | 工作包／实现 | 验证 | 状态 |
| --- | --- | --- | --- | --- |
| LIST-101 | 九列收拢、款式人员设计稿同列 | W2 listColumns / renderDesignRevisionStyleRelation | 列表测试、1280 与 1366 截图 | 已验证 |
| LIST-102 | 工作团队时间并回四个工作列 | W2 taskTiming / processOrders / sampleTask | 浏览器列表及详情 | 已验证 |
| LIST-103 | 物料及费用直接展示 | W2 renderMaterialCosts | 数量单位、图片预览及费用检查 | 已验证 |
| LIST-104 | 原／新款式统一文案 | W2 页面及 sampling 错误文案 | 新建回归及导出 | 已验证 |
| LIST-105 | 不再出现线下设计工作 | W1 normalizeEngineeringDesignRevisionRecord | 幂等、引用去重保留单元测试及旧浏览器刷新 | 已验证 |
| LIST-106 | 老系统可用筛选及时间类型 | W2 recordFilterFacts / extraFilters | 每项五次查询与重置 | 已验证 |

产品规则确认：用户本次消息。技术验收：Codex，当前工作树；最终产品接受待用户查看。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 页面与性能 | 通过 | 当前构建 6 项浏览器专项通过；83 项列表场景及 29 项表单场景各测五次 |

图片使用现有款式、本地设计稿与物料 SKU 档案图片，图片和对象在同块，可预览。未维护数据明确标识，不构造现场事实。仓储、PDA、打印不新增交互；历史引用保留单据身份和来源。

## 4. 问题标签

列表过宽、历史数据残留、信息缺失。

## 5. 主要问题与处理

删除独立团队／工作项／时间／设计稿／买手／状态列；工作字段回归对应实体，物料费用可直接阅读。旧花型调色依赖移除，已有单据引用保持。

## 6. 最终结论

结论：通过。正向核对本次需求与 LIST-101～106，反向核对变更仅涉及设计改款数据规范化、列表及命名，无新增线下设计任务。用户原有 AGENTS.md 和 docs/test-data/ 改动不属于本次提交。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/pcs-independent-sampling.ts`
- `src/data/pcs-engineering-master-sampling.ts`
- `src/data/pcs-engineering-master-types.ts`

### 页面路由

- `/pcs/production-preparation/design-revision`
- `/pcs/production-preparation/design-revision/new`
- `/pcs/production-preparation/design-revision/:samplingTaskId`

### 验证命令

- 验证分支：`codex/design-revision-list-consolidation`；基准 HEAD `a2733d559c1780c8328d53d5bed7e0d3e486207d`；工作树 `/Users/laoer/Documents/higoods`。
- 实际服务：同工作树生产构建 `http://127.0.0.1:4734`，Chromium 149.0.7827.55，1366×768 与 1280×720；完整 24 条 Mock，各轮隔离浏览器，未清除用户浏览器数据。
- `npm run build`：通过，438 个单元测试通过；包含历史工作移除、依赖解除、加工单引用保留及冲突时已有引用优先、重复规范化幂等。
- `node scripts/check-typescript-scope.mjs src/pages/pcs-independent-sampling.ts src/data/pcs-engineering-master-sampling.ts src/data/pcs-engineering-master-types.ts`：通过，范围内 0 错误；全仓其他范围保留 6 个既有错误。
- `CUTTING_E2E_PORT=4734 CUTTING_E2E_USE_PREVIEW=true CUTTING_E2E_TEST_TIMEOUT=150000 npx playwright test tests/pcs-design-revision-list-performance.spec.ts tests/pcs-design-revision-list-actions.spec.ts tests/pcs-design-revision-legacy-list.spec.ts tests/pcs-design-revision-single-page.spec.ts --workers=1 --reporter=line`：通过，6 项专项。最后实质修改后重新运行，结果 `6 passed (1.6m)`。
- 列表 83 项 × 5 次，最大 410.80ms；表单 29 项 × 5 次，最大 298.60ms，全部严格小于 500ms。证据含生产 index SHA256、缓存和计时说明。冷进入从导航起计，交互从事件到结果、可见图解码及两帧绘制。
- 原始数据：`evidence/2026-09-24-design-revision-consolidation-list.json`、`evidence/2026-09-24-design-revision-consolidation-form.json`。
- 截图：`evidence/2026-09-24-design-revision-consolidated-list.png`、`evidence/2026-09-24-design-revision-expanded-filters.png`、`evidence/2026-09-24-design-revision-list-1280.png`。
- 款式、设计稿、物料大图分别测量，关闭按钮和 Esc 回归通过。旧浏览器记录刷新后主任务正文不再展示花型、调色任务。
- `npm run check:list-page-governance:static`：通过，558 页面；`codegraph sync`：通过。
- `npm run check:prototype-design-governance`：通过，3 个受管文件由本记录覆盖。首次检查的文档结果前缀已修正，未修改检查脚本。

### 例外

- 无新增性能例外。仅依据当前已有数据增加有效筛选，不增加老系统已不适用流程。历史没有样衣的记录不自动伪造任务或成果。

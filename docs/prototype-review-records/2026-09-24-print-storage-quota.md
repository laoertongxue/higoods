# 设计改款提交时印花存储容量修复

## 1. 基本信息

- 需求：修复设计改款提交时 `higoods.formal-print-execution.v1` 超出 localStorage 容量。
- 工作树：/Users/laoer/Documents/higoods；main 基线 3ffc72b1eab5c1580ca7887f843604e0607d3911。
- 同工作树构建与 Chromium preview 4734，1366×768；新建页回归含 1280 宽度。
- 现场 ES-ID-DR-031 已由用户后续操作完成，日志显示生成 0 张印染单；本次只读诊断现场，不改写其记录。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：上传设计稿且包含印染物料的任务可在原保存体积会超限的容量条件下提交。遵循 AGENTS.md 第 4、5、7 节；不改变加工顺序、数量、来源、页面和交接规则。

## 3. 自查结论

| 检查项 | 结论 | 直接证据 |
| --- | --- | --- |
| 根因 | 通过 | 现场印花存档 957852 字符，一份上传图在来源、商品预览及关联任务中重复写入 |
| 图片和来源完整性 | 通过 | 每份不同图片在同一印花存档中保留一份完整正文；读取时还原，不依赖上传记录生命周期；旧 JSON 兼容 |
| 容量不足与恢复 | 通过 | 强制拒绝印花写入，草稿和物料保留，恢复写入后重试成功且只有一对染印单 |
| 提交及刷新 | 通过 | 上传设计稿、先染后印，连续 5 次提交成功；刷新后图片可加载、两张单据可关联 |
| 性能 | 通过 | 提交专项 5 个样本最高 283.5ms；单页 29 项各 5 次共 145 个样本最高 314.5ms |
| PDA、打印布局 | 不适用 | 未修改入口、布局、交接或打印规则；共用领域读取仍还原相同完整对象 |
| 数据库 | 不适用 | 未连接数据库 |

## 4. 问题标签

浏览器存储容量、图片重复持久化、提交回滚。

## 5. 主要问题与处理

增加仅用于印花执行存档的图片去重序列化：imageUrl、targetSpuImageUrl、dataUrl 中的数据正文保存到同存档图片表，字段存短引用；读取时验证图片表和引用并还原，再走原有冻结来源校验。旧版 JSON 不含图片表时仍按原样读取。未删除业务数据，未改为仅内存保存，未新增存储依赖。

现场只读计算：957852 → 732163 字符，节省 225689 字符，还原内容逐字相同。浏览器专项：旧格式 624496 字符，新格式 520423 字符，在印花写入预算 560000 字符下成功；旧格式必超限。此预算为隔离测试模拟，未修改现场存储配额。真正无剩余空间时仍保留原有失败回滚，不声称容量无限。

首次专项因新建记录在列表后续页、测试未查询导致定位失败；修正测试为按任务号查询后通过。未改产品分页。

## 6. 最终结论

结论：通过。

本地修复与验证通过。尚未提交 Git 或发布到 GitHub/Vercel；现场只读，未清理、迁移或覆盖用户数据。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/printing-execution-storage.ts`

### 页面路由

- `/pcs/production-preparation/design-revision/new`
- `/pcs/production-preparation/design-revision/:id`
- `/pcs/production-preparation/design-revision`

### 验证命令

- `npm run build`（440 个单元测试及生产构建）：通过
- `node scripts/check-typescript-scope.mjs src/data/fcs/printing-task-domain.ts src/data/fcs/printing-execution-storage.ts`（范围内 0 错误；全量既有范围外 6 错误）：通过
- `node --import tsx tests/pcs-design-revision-result-storage-and-binding.spec.ts`：通过
- `CUTTING_E2E_PORT=4734 CUTTING_E2E_USE_PREVIEW=true CUTTING_E2E_TEST_TIMEOUT=150000 npx playwright test tests/pcs-design-revision-storage-quota.spec.ts tests/pcs-design-revision-single-page.spec.ts --workers=1 --reporter=line`：通过
- `npm run check:prototype-design-governance`：通过

### 证据

- `evidence/2026-09-24-print-storage-quota.json`
- `evidence/2026-09-24-print-storage-single-page-performance.json`
- `evidence/2026-09-24-print-storage-submitted.png`
- `tests/unit/printing-execution-storage.test.ts`：旧格式、无损还原、去重、损坏引用阻断。

### 例外

- 无。所有本次测量样本 <500ms。

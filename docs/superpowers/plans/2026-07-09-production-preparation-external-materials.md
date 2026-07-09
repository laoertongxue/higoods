# 生产准备时效非系统内物料实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在生产准备时效页内支持维护非系统内物料、确认工作项时按行选择物料来源，并把辅料下单改为登记多个面辅料采购单号。

**架构：** 复用现有 `production-preparation-timing` 数据、页面和 runtime storage，不新增独立菜单、不引入后端。非系统内物料作为生产准备运行时数据的一部分，系统内 / 非系统内物料在确认工作项的同一物料行模型内表达。辅料下单复用准备项操作入口，但渲染专用登记弹窗，不走上传凭证弹窗。

**技术栈：** Vite、TypeScript、Vanilla TypeScript 字符串模板、localStorage runtime、现有 `scripts/check-production-preparation-timing.ts`、`npm run check:prototype-design-governance`。

---

## 文件结构

- 修改：`src/data/fcs/production-preparation-timing.ts`
  - 扩展物料行来源字段。
  - 增加非系统内物料初始化清单。
  - 为辅料下单样例补充面辅料采购单号记录。
- 修改：`src/data/fcs/production-preparation-timing-runtime.ts`
  - 在现有运行时状态中保存新增非系统内物料、确认后的物料行、辅料采购单号。
  - 合并 runtime 到 mock 记录。
- 修改：`src/pages/production/preparation-timing.ts`
  - 页面右上角新增 `非系统内物料` 弹窗入口。
  - 确认工作项弹窗的物料行增加来源选择。
  - 辅料下单改成专用单号登记弹窗。
  - 详情展示系统内 / 非系统内物料差异。
- 修改：`scripts/check-production-preparation-timing.ts`
  - 增加非系统内物料、来源切换、辅料下单单号登记断言。
- 修改：`docs/prototype-review-records/2026-07-09-production-preparation-external-materials.md`
  - 新增原型审查记录。

---

## 非系统内物料初始化清单

实现时将以下名称按顺序写入 `externalPreparationMaterialNames`，序号由数组下标 + 1 生成：

```ts
const externalPreparationMaterialNames = [
  '印花雪纺Printing seruti S388-1',
  '白色雪纺white seruti S388-1',
  '黑色雪纺black seruti S388-1',
  '黑色里布 black furing S256',
  '白色里布white furingS256',
  '印花弹力网纱Printed elastic mesh Td-s026',
  '针织里布spandek jerrsy',
  '缎面Satin fabric',
  '欧根纱Organza',
  '白色无弹 网纱 white Tile',
  'Lace 黑蕾丝',
  'Fine pink 粉色里布',
  'Crinkle Army',
  'Fine green 绿色里布',
  'green seruti 绿色雪纺',
  'Fine yellow 黄色里布',
  'jersey pink',
  'Polo Linen 冰棉麻',
  'pink seruti 粉色雪纺',
  'BLACK scuba spandex 黑色印尼替代捻丝',
  'apricot furing 杏色里布',
  'apricot seruti 杏色雪纺',
  '仿真丝缎面 satin velvet',
  '网纹垂感西装面料 jetbalac黑色',
  '印尼本土较好真丝缎 Armani satin',
  '仿棉麻line',
  '里布 ashahi',
  '常见穆斯林便宜薄面料（皱）印花 crinkle',
  'Belina Air Flow DUSTY粉色',
  '常见穆斯林便宜薄面料（皱）黑色 crinkle',
  '常见穆斯林便宜薄面料（皱）白色 crinkle',
  'silver seruti 雪纺',
  '白色厚里布 ashahi',
  '印尼本土仿真丝缎面 satin velvet',
  '印花厚里布 Printing ashahi',
  '印花四面弹110g PrintingS98-2',
  '白色四面弹white110g S98-2',
  '印花平纹120g printing S573',
  '白色平纹120g white S573',
  '印花高密纱printing G1',
  '白色高密纱White G1',
  '印花中国厚 雪纺printing seruti S1',
  '黑色消光破卡Black S788',
  '平纹（冰感）S362-1',
  '斜纹-黑色 Black S427',
  '衬衫面料-S460',
  '厚里布 S555-白色',
  '厚里布 S555-黑色',
  '斜纹-白色-S427',
  '高密纱 China high density yarn G1',
  '50D四面弹（里布）S256',
  '消光破卡S788-white',
  '捻丝-黑色 TD-s027 黑色',
  'Tile 黑色网纱 无弹',
  '黑色四面弹110gChina 110g thin fabric',
  '金光棉-G127-白色white',
  '印尼贵价柔软欧根纱Soft Organza-black黑色',
  'Tile 印花网纱 无弹',
  'Tile 粉色网纱 无弹',
  '细冰丝坑条Td-s 025-白色',
  '宽冰丝坑条 white Td-s024',
  '皱感纱-G115-white',
  '仿棉-S618',
  '双层布- S60厚',
  '平纹120g-S573-black黑色',
  '斜纹-卡其色S427-khaki',
  '斜纹-printing-S427',
  '消光破卡-printing-S788',
  '缎面-printing-S496',
  '细冰丝坑条Td-s 025-black黑色',
  '捻丝-印花 TD-s027printing',
  '细冰丝坑条Td-s 025-printing印花',
  '无弹牛仔285g E016兰',
  '缎面S103-1-印花printing',
  '斜纹-apricot杏色-S427',
  '捻丝-白色 Td-s027 white',
  '印花四面弹110g PrintingS98-1',
  '全锦风衣面料TD-S033-印花printing',
  '180g牛奶丝双磨white',
  '180g牛奶丝双磨black',
  '印花180g牛奶丝双磨',
  '四面弹S534white',
  '印花四面弹S534',
  '白色四面弹white90g S98-1',
  '灯芯绒面料 蓝色',
  '绣花布H8297',
  '印尼牛仔面料 IDSZML24020 -sameasphoto',
  '印尼薄面料wool peach 印花',
  '印尼薄面料wool peach white',
  '印尼常见穆斯林薄皱面料 crinkle white',
  '印尼常见穆斯林薄皱面料 crinkle 印花',
  '印尼消光破卡S788',
  '240g斜纹 S528-1（非白色）',
  '四面弹120g白色-S98印花',
  '竹节格',
  '280g索罗娜棉',
  '40支双纱爽滑棉210g',
  '冰丝（蛇仔纹）',
  '全锦风衣面料TD-S033',
  '240g斜纹 S528-1',
  '缎面103-1',
  '32支CVC拉架180g C2001',
  '莫代尔随心裁',
  '加厚莫代尔',
  '280g双面拉架擦毛',
  'polymicro（印尼睡衣/床单）',
  'R069罗马布250g',
  'AG云朵棉面料s615',
  '0830面料',
  'T288',
  '印尼网布',
  '厚消光平纹破卡S205-1',
  '150CM锦棉皱CNIDML077',
  '哥弟布-裤子面料CNIDML105',
  '灯芯绒黑色',
  '60支人棉空气层',
  '丝光棉S799（幅宽：160）',
  'CVC双面卫衣-JX-808',
  '防晒面料2016',
  '外套面料C2032#',
  '黑色缎面华尔缎',
  'CNIDML328-迈巴赫-S874',
  'CNIDML111-泡泡格W886',
  '2*2螺纹-2*2LW',
  '锦棉皱面料 C1009',
  '云朵棉120g新 S617',
  '牛奶丝-R063',
  '1701仿麻竹节/150幅宽',
  '蕾丝面料',
  'CNIDML359-天丝棉-C2037',
  '棉感绉-C2032#CNIDML360',
  'CNIDML355-经编8坑-C2813',
  '绣花布 H8309/幅宽150',
  '印尼网纱IDSZFL24201',
] as const
```

---

### 任务 1：数据模型和检查先失败

**文件：**
- 修改：`src/data/fcs/production-preparation-timing.ts`
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：编写失败检查**

在 `scripts/check-production-preparation-timing.ts` 末尾附近增加断言，先引用还不存在的导出和字段：

```ts
import {
  externalPreparationMaterials,
  productionPreparationRecords,
} from '../src/data/fcs/production-preparation-timing'

assert.ok(externalPreparationMaterials.length >= 100, '非系统内物料初始化数据必须完整覆盖业务清单')
assert.equal(externalPreparationMaterials[0]?.serialNo, 1, '非系统内物料序号必须从 1 开始')
assert.equal(
  externalPreparationMaterials[0]?.materialName,
  '印花雪纺Printing seruti S388-1',
  '非系统内物料必须保留原始名称，不拆分中英文和规格',
)

const externalMaterialRecord = productionPreparationRecords.find((record) =>
  record.materialRequirement.items?.some((material) => material.materialSource === '非系统内物料'),
)
assert.ok(externalMaterialRecord, 'mock 数据必须包含已选择非系统内物料的准备记录')

const accessoryItem = productionPreparationRecords
  .flatMap((record) => record.items)
  .find((item) => item.itemType === '辅料下单' && item.accessoryPurchaseOrderNos?.length)
assert.ok(accessoryItem, '辅料下单 mock 必须包含面辅料采购单号')
assert.ok(!accessoryItem?.uploads?.length, '辅料下单不应依赖上传凭证')
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
npm run check:production-preparation-timing
```

预期：FAIL，报错包含 `externalPreparationMaterials` 未导出或 `materialSource` / `accessoryPurchaseOrderNos` 类型不存在。

- [ ] **步骤 3：补最小数据类型**

在 `src/data/fcs/production-preparation-timing.ts` 中扩展类型：

```ts
export type PreparationMaterialSource = '系统内物料' | '非系统内物料'

export interface ExternalPreparationMaterial {
  serialNo: number
  materialName: string
}

export interface PreparationMaterialLine {
  materialSource?: PreparationMaterialSource
  externalSerialNo?: number
  materialNo: string
  materialName: string
  materialType: string
  imageUrl: string
  requiredQty: number
  preparedQty: number
  issuedQty: number
  unit: string
}
```

在 `ProductionPreparationItem` 增加：

```ts
accessoryPurchaseOrderNos?: string[]
accessoryPurchaseUpdatedAt?: string
```

- [ ] **步骤 4：补初始化清单**

在 `src/data/fcs/production-preparation-timing.ts` 增加：

```ts
const externalPreparationMaterialNames = [
  '印花雪纺Printing seruti S388-1',
  '白色雪纺white seruti S388-1',
  '黑色雪纺black seruti S388-1',
  '黑色里布 black furing S256',
  '白色里布white furingS256',
] as const

export const externalPreparationMaterials: ExternalPreparationMaterial[] =
  externalPreparationMaterialNames.map((materialName, index) => ({
    serialNo: index + 1,
    materialName,
  }))
```

使用本计划「非系统内物料初始化清单」中的完整数组替换上面的示例数组，保持原始顺序和完整名称。

- [ ] **步骤 5：补 mock 场景**

给一条已确认准备记录的 `materialRequirement.items` 增加非系统内物料行：

```ts
{
  materialSource: '非系统内物料',
  externalSerialNo: 1,
  materialNo: '',
  materialName: '印花雪纺Printing seruti S388-1',
  materialType: '',
  imageUrl: '',
  requiredQty: 0,
  preparedQty: 0,
  issuedQty: 0,
  unit: '',
}
```

给一条 `辅料下单` 已完成项增加：

```ts
{
  accessoryPurchaseOrderNos: ['FPO-202603-002-A', 'FPO-202603-002-B'],
  accessoryPurchaseUpdatedAt: '2026-03-05T15:20:00',
}
```

并确保该辅料项没有 `uploads`。

- [ ] **步骤 6：运行检查验证当前任务通过**

运行：

```bash
npm run check:production-preparation-timing
```

预期：与本任务相关的新增数据断言通过，本任务之外的 UI 断言仍可失败。

- [ ] **步骤 7：Commit**

```bash
git add src/data/fcs/production-preparation-timing.ts scripts/check-production-preparation-timing.ts
git commit -m "feat: add external preparation material data"
```

---

### 任务 2：runtime 保存非系统内物料和辅料单号

**文件：**
- 修改：`src/data/fcs/production-preparation-timing-runtime.ts`
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：编写失败检查**

在检查脚本中增加 runtime 合并断言：

```ts
const runtimeMaterialRecord = mergePreparationRuntimeRecords(productionPreparationRecords, {
  confirmedRecords: {},
  uploads: [],
  downloads: [],
  dyeRequirements: {},
  externalMaterials: [{ serialNo: 999, materialName: '测试非系统物料' }],
  accessoryPurchaseOrders: {
    'prep-202603-001-item-04': {
      orderNos: ['FPO-RUNTIME-001', 'FPO-RUNTIME-002'],
      updatedAt: '2026-07-09T10:00:00',
      updatedBy: '当前跟单',
    },
  },
})

assert.ok(
  runtimeMaterialRecord.some((record) =>
    record.items.some((item) =>
      item.itemId === 'prep-202603-001-item-04' &&
      item.accessoryPurchaseOrderNos?.includes('FPO-RUNTIME-001') &&
      item.actualFinishAt === '2026-07-09T10:00:00',
    ),
  ),
  'runtime 面辅料采购单号必须覆盖到辅料下单项，并以最后更新时间作为完成时间',
)
```

- [ ] **步骤 2：运行检查验证失败**

```bash
npm run check:production-preparation-timing
```

预期：FAIL，`externalMaterials` 或 `accessoryPurchaseOrders` 不存在。

- [ ] **步骤 3：扩展 runtime state**

在 `src/data/fcs/production-preparation-timing-runtime.ts` 增加：

```ts
import type { ExternalPreparationMaterial } from './production-preparation-timing'

export interface AccessoryPurchaseOrderRuntimeRecord {
  orderNos: string[]
  updatedAt: string
  updatedBy: string
}

export interface PreparationRuntimeState {
  confirmedRecords: Record<string, ConfirmedPreparationRecord>
  uploads: PreparationUploadRecord[]
  downloads: PreparationDownloadRecord[]
  dyeRequirements: Record<string, PreparationDyeRequirement>
  externalMaterials: ExternalPreparationMaterial[]
  accessoryPurchaseOrders: Record<string, AccessoryPurchaseOrderRuntimeRecord>
}
```

同步补齐 `EMPTY_PREPARATION_RUNTIME_STATE`：

```ts
externalMaterials: [],
accessoryPurchaseOrders: {},
```

- [ ] **步骤 4：合并辅料下单 runtime**

在合并 items 的位置，为每个 item 应用 runtime：

```ts
const accessoryRuntime = runtime.accessoryPurchaseOrders[item.itemId]
if (!accessoryRuntime || item.itemType !== '辅料下单') return item
return {
  ...item,
  status: accessoryRuntime.orderNos.length ? '已完成' : item.status,
  actualFinishAt: accessoryRuntime.updatedAt,
  evidenceSummary: `已登记 ${accessoryRuntime.orderNos.length} 个面辅料采购单号`,
  accessoryPurchaseOrderNos: accessoryRuntime.orderNos,
  accessoryPurchaseUpdatedAt: accessoryRuntime.updatedAt,
}
```

- [ ] **步骤 5：运行检查验证通过**

```bash
npm run check:production-preparation-timing
```

预期：PASS 或仅剩 UI 缺失类断言失败。

- [ ] **步骤 6：Commit**

```bash
git add src/data/fcs/production-preparation-timing-runtime.ts scripts/check-production-preparation-timing.ts
git commit -m "feat: persist preparation material runtime"
```

---

### 任务 3：非系统内物料弹窗

**文件：**
- 修改：`src/pages/production/preparation-timing.ts`
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：编写失败检查**

增加页面 HTML 断言：

```ts
const externalMaterialHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03&action=external-materials')
assertHtmlIncludes(externalMaterialHtml, '非系统内物料', '页面右上角必须有非系统内物料入口和弹窗标题')
assertHtmlIncludes(externalMaterialHtml, 'data-prep-external-material-form', '非系统内物料弹窗必须支持新增')
assertHtmlIncludes(externalMaterialHtml, '印花雪纺Printing seruti S388-1', '非系统内物料弹窗必须展示初始化物料')
assertHtmlIncludes(externalMaterialHtml, '<th class="px-3 py-2 text-left font-medium">序号</th>', '非系统内物料列表必须展示序号列')
```

- [ ] **步骤 2：运行检查验证失败**

```bash
npm run check:production-preparation-timing
```

预期：FAIL，页面没有 `data-prep-external-material-form`。

- [ ] **步骤 3：增加入口渲染**

在页面标题操作区增加：

```ts
const externalMaterialsHref = buildLedgerHrefFromParams(params, month, { action: 'external-materials' })
```

并渲染按钮：

```html
<button type="button" class="rounded-md border px-3 py-2 text-sm" data-nav="${escapeHtml(externalMaterialsHref)}">非系统内物料</button>
```

- [ ] **步骤 4：增加弹窗渲染函数**

在 `src/pages/production/preparation-timing.ts` 增加：

```ts
function allExternalMaterials(): ExternalPreparationMaterial[] {
  const runtime = loadPreparationRuntimeState()
  return [...externalPreparationMaterials, ...runtime.externalMaterials]
}

function renderExternalMaterialsDialog(params: URLSearchParams, month: string): string {
  if (valueOf(params, 'action') !== 'external-materials') return ''
  const closeHref = buildLedgerHrefFromParams(params, month)
  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-nav="${escapeHtml(closeHref)}" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-10 flex max-h-[calc(100vh-80px)] w-[720px] max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col overflow-hidden rounded-xl bg-background shadow-2xl">
        <div class="border-b p-5">
          <h3 class="text-lg font-semibold">非系统内物料</h3>
        </div>
        <form class="border-b p-5" data-prep-external-material-form>
          <label class="block text-sm">
            <span class="text-muted-foreground">物料名称</span>
            <input name="materialName" class="mt-1 h-10 w-full rounded-md border px-3" required />
          </label>
          <button type="submit" class="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm text-white">新增</button>
        </form>
        <div class="min-h-0 flex-1 overflow-auto p-5">
          <table class="w-full text-sm">
            <thead class="bg-muted/60 text-xs text-muted-foreground">
              <tr><th class="px-3 py-2 text-left font-medium">序号</th><th class="px-3 py-2 text-left font-medium">物料名称</th></tr>
            </thead>
            <tbody>
              ${allExternalMaterials().map((material) => `
                <tr class="border-t">
                  <td class="px-3 py-2">${material.serialNo}</td>
                  <td class="px-3 py-2">${escapeHtml(material.materialName)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `
}
```

把 `renderExternalMaterialsDialog(params, month)` 加入页面返回 HTML 的弹窗区域。

- [ ] **步骤 5：新增提交处理**

在 `handleProductionPreparationTimingSubmit()` 中，早于其他表单分支处理：

```ts
if (form.matches('[data-prep-external-material-form]')) {
  const materialName = String(formData.get('materialName') ?? '').trim()
  if (!materialName) return true
  const runtime = loadPreparationRuntimeState()
  const maxSerialNo = Math.max(
    0,
    ...externalPreparationMaterials.map((item) => item.serialNo),
    ...runtime.externalMaterials.map((item) => item.serialNo),
  )
  savePreparationRuntimeState({
    ...runtime,
    externalMaterials: [
      ...runtime.externalMaterials,
      { serialNo: maxSerialNo + 1, materialName },
    ],
  })
  closePreparationDialog()
  return true
}
```

- [ ] **步骤 6：运行检查验证通过**

```bash
npm run check:production-preparation-timing
```

预期：非系统内物料弹窗断言通过。

- [ ] **步骤 7：Commit**

```bash
git add src/pages/production/preparation-timing.ts scripts/check-production-preparation-timing.ts
git commit -m "feat: manage external preparation materials"
```

---

### 任务 4：确认工作项物料来源选择和详情展示

**文件：**
- 修改：`src/pages/production/preparation-timing.ts`
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：编写失败检查**

```ts
const confirmItemsHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-001&action=confirm-items')
assertHtmlIncludes(confirmItemsHtml, 'name="materialSource"', '确认工作项物料行必须支持物料来源')
assertHtmlIncludes(confirmItemsHtml, '系统内物料', '确认工作项必须支持系统内物料来源')
assertHtmlIncludes(confirmItemsHtml, '非系统内物料', '确认工作项必须支持非系统内物料来源')
assertHtmlIncludes(confirmItemsHtml, 'list="prep-external-material-options"', '确认工作项必须能选择非系统内物料')

const detailWithExternalMaterialHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-002')
assertHtmlIncludes(detailWithExternalMaterialHtml, '非系统内物料', '详情必须展示非系统内物料来源')
assertHtmlIncludes(detailWithExternalMaterialHtml, '印花雪纺Printing seruti S388-1', '详情必须展示非系统内物料名称')
```

- [ ] **步骤 2：运行检查验证失败**

```bash
npm run check:production-preparation-timing
```

预期：FAIL，缺少 `name="materialSource"`。

- [ ] **步骤 3：补 datalist**

在确认弹窗附近增加：

```ts
function renderExternalMaterialDatalist(): string {
  return `
    <datalist id="prep-external-material-options">
      ${allExternalMaterials().map((material) => `
        <option value="${material.serialNo}" label="${escapeHtml(material.materialName)}"></option>
      `).join('')}
    </datalist>
  `
}
```

- [ ] **步骤 4：改物料行渲染**

在 `renderConfirmMaterialRow()` 增加来源列：

```html
<select name="materialSource" class="h-9 rounded-md border px-2 text-sm" data-prep-material-source>
  <option value="系统内物料" ${material.materialSource !== '非系统内物料' ? 'selected' : ''}>系统内物料</option>
  <option value="非系统内物料" ${material.materialSource === '非系统内物料' ? 'selected' : ''}>非系统内物料</option>
</select>
```

非系统内物料输入用同一行：

```html
<input name="externalSerialNo" list="prep-external-material-options" value="${material.externalSerialNo ?? ''}" class="h-9 w-28 rounded-md border px-3 text-sm" data-prep-external-material-input />
```

把表头从：

```ts
['选择物料', '图片', '物料名称', '物料编号', '物料类型', '操作']
```

改成：

```ts
['来源', '选择物料', '图片', '物料名称', '物料编号', '物料类型', '操作']
```

- [ ] **步骤 5：提交确认时保存来源**

在确认表单处理里解析每一行：

```ts
const materialSources = formData.getAll('materialSource').map((value) => String(value).trim())
const externalSerialNos = formData.getAll('externalSerialNo').map((value) => Number(String(value).trim()))
```

组装物料行时：

```ts
const source = materialSources[index] === '非系统内物料' ? '非系统内物料' : '系统内物料'
if (source === '非系统内物料') {
  const externalMaterial = allExternalMaterials().find((item) => item.serialNo === externalSerialNos[index])
  if (!externalMaterial) return null
  return {
    materialSource: '非系统内物料',
    externalSerialNo: externalMaterial.serialNo,
    materialNo: '',
    materialName: externalMaterial.materialName,
    materialType: '',
    imageUrl: '',
    requiredQty: 0,
    preparedQty: 0,
    issuedQty: 0,
    unit: '',
  }
}
```

保留原有系统内物料解析逻辑。

- [ ] **步骤 6：详情展示来源**

在 `renderMaterialRequirementTable()` 中对非系统内物料分支渲染：

```ts
if (material.materialSource === '非系统内物料') {
  return `
    <tr class="border-t">
      <td class="px-3 py-2">非系统内物料</td>
      <td class="px-3 py-2 font-medium">${escapeHtml(material.materialName)}</td>
      <td class="px-3 py-2">序号 ${material.externalSerialNo ?? '-'}</td>
      <td class="px-3 py-2 text-muted-foreground">-</td>
      <td class="px-3 py-2 text-muted-foreground">-</td>
      <td class="px-3 py-2 text-muted-foreground">-</td>
      <td class="px-3 py-2 text-muted-foreground">-</td>
    </tr>
  `
}
```

- [ ] **步骤 7：运行检查验证通过**

```bash
npm run check:production-preparation-timing
```

预期：确认弹窗来源选择和详情展示断言通过。

- [ ] **步骤 8：Commit**

```bash
git add src/pages/production/preparation-timing.ts scripts/check-production-preparation-timing.ts
git commit -m "feat: select preparation material source"
```

---

### 任务 5：辅料下单专用弹窗

**文件：**
- 修改：`src/pages/production/preparation-timing.ts`
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：编写失败检查**

```ts
const accessoryOrderHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-001&itemId=prep-202603-001-item-04&action=operate-item')
assertHtmlIncludes(accessoryOrderHtml, 'data-prep-accessory-order-form', '辅料下单必须打开面辅料采购单号弹窗')
assertHtmlIncludes(accessoryOrderHtml, 'name="accessoryPurchaseOrderNo"', '辅料下单必须支持填写面辅料采购单号')
assert.ok(!accessoryOrderHtml.includes('input type="file"'), '辅料下单不应出现上传文件控件')

const completedAccessoryDetailHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-002')
assertHtmlIncludes(completedAccessoryDetailHtml, 'FPO-202603-002-A', '辅料下单详情必须展示多个面辅料采购单号')
assertHtmlIncludes(completedAccessoryDetailHtml, '最后更新时间', '辅料下单详情必须展示最后更新时间')
```

- [ ] **步骤 2：运行检查验证失败**

```bash
npm run check:production-preparation-timing
```

预期：FAIL，辅料下单仍进入上传弹窗或缺少专用表单。

- [ ] **步骤 3：增加专用弹窗**

新增：

```ts
function renderAccessoryOrderDialog(record: ProductionPreparationRecord, item: ProductionPreparationItem, params: URLSearchParams, month: string): string {
  if (valueOf(params, 'action') !== 'operate-item' || item.itemType !== '辅料下单') return ''
  if (!hasConfirmedWorkItems(record) || !canOperateItem(item, record)) return ''
  const closeHref = buildLedgerHrefFromParams(params, month)
  const orderNos = item.accessoryPurchaseOrderNos?.length ? item.accessoryPurchaseOrderNos : ['']
  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-nav="${escapeHtml(closeHref)}" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-10 w-[680px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl bg-background p-5 shadow-2xl">
        <h3 class="text-lg font-semibold">登记面辅料采购单号</h3>
        <form class="mt-4 space-y-3" data-prep-accessory-order-form>
          <input type="hidden" name="recordId" value="${escapeHtml(record.recordId)}" />
          <input type="hidden" name="itemId" value="${escapeHtml(item.itemId)}" />
          <div data-prep-accessory-order-rows>
            ${orderNos.map((orderNo) => `
              <input name="accessoryPurchaseOrderNo" value="${escapeHtml(orderNo)}" class="mb-2 h-10 w-full rounded-md border px-3" placeholder="面辅料采购单号" required />
            `).join('')}
          </div>
          <button type="button" class="rounded-md border px-3 py-2 text-sm" data-prep-action="add-accessory-order-row">新增单号</button>
          <div class="flex justify-end gap-2 pt-3">
            <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(closeHref)}">取消</button>
            <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">保存</button>
          </div>
        </form>
      </section>
    </div>
  `
}
```

确保 `renderOperateItemDialog()` 对 `辅料下单` 返回空，避免出现上传控件。

- [ ] **步骤 4：提交处理保存单号**

在 submit handler 增加：

```ts
if (form.matches('[data-prep-accessory-order-form]')) {
  const recordId = String(formData.get('recordId') ?? '').trim()
  const itemId = String(formData.get('itemId') ?? '').trim()
  const orderNos = formData.getAll('accessoryPurchaseOrderNo')
    .map((value) => String(value).trim())
    .filter(Boolean)
  if (!recordId || !itemId || !orderNos.length) return true
  const runtime = loadPreparationRuntimeState()
  savePreparationRuntimeState({
    ...runtime,
    accessoryPurchaseOrders: {
      ...runtime.accessoryPurchaseOrders,
      [itemId]: {
        orderNos,
        updatedAt: currentIsoMinute(),
        updatedBy: '当前跟单',
      },
    },
  })
  closePreparationDialog()
  return true
}
```

- [ ] **步骤 5：详情卡片展示单号**

在准备项卡片渲染位置增加：

```ts
if (item.itemType === '辅料下单' && item.accessoryPurchaseOrderNos?.length) {
  return `
    <div class="rounded-lg border p-3 text-sm">
      <div class="font-medium">面辅料采购单号</div>
      ${item.accessoryPurchaseOrderNos.map((orderNo) => `<div>${escapeHtml(orderNo)}</div>`).join('')}
      <div class="mt-2 text-xs text-muted-foreground">最后更新时间：${escapeHtml(item.accessoryPurchaseUpdatedAt ?? item.actualFinishAt)}</div>
    </div>
  `
}
```

不要为 `辅料下单` 渲染“暂无上传记录”。

- [ ] **步骤 6：运行检查验证通过**

```bash
npm run check:production-preparation-timing
```

预期：辅料下单相关断言通过。

- [ ] **步骤 7：Commit**

```bash
git add src/pages/production/preparation-timing.ts scripts/check-production-preparation-timing.ts
git commit -m "feat: register accessory purchase orders"
```

---

### 任务 6：原型治理和最终验证

**文件：**
- 创建：`docs/prototype-review-records/2026-07-09-production-preparation-external-materials.md`

- [ ] **步骤 1：新增原型审查记录**

创建 `docs/prototype-review-records/2026-07-09-production-preparation-external-materials.md`：

```md
# 生产准备时效非系统内物料原型审查记录

## 改动范围

- 生产准备时效页面新增非系统内物料维护入口。
- 确认工作项支持按物料行选择系统内 / 非系统内来源。
- 辅料下单改为登记多个面辅料采购单号，不上传凭证。

## 角色与现场假设

- 跟单维护本次用料、做款要求和辅料采购单号。
- 非系统内物料只是准备阶段临时识别资料，不进入正式物料主数据。

## 自查结论

- 页面入口清晰，不新增独立菜单。
- 非系统内物料只维护名称和序号，避免伪造编码、图片和库存。
- 辅料下单使用单独弹窗，避免误导业务上传凭证。
- 输入和弹窗交互应局部响应，不触发整页重绘。
```

- [ ] **步骤 2：运行专项检查**

```bash
npm run check:production-preparation-timing
```

预期：PASS。

- [ ] **步骤 3：运行原型治理检查**

```bash
npm run check:prototype-design-governance
```

预期：PASS。

- [ ] **步骤 4：运行构建**

```bash
npm run build
```

预期：PASS。

- [ ] **步骤 5：同步 CodeGraph**

```bash
codegraph sync && codegraph status
```

预期：`Index is up to date`。

- [ ] **步骤 6：Commit**

```bash
git add docs/prototype-review-records/2026-07-09-production-preparation-external-materials.md
git commit -m "docs: review preparation external materials"
```

---

## 自检

- 规格覆盖：非系统内物料入口、弹窗、新增、本地保存、物料来源选择、详情展示、辅料下单单号登记、mock 覆盖和验收标准都对应到任务。
- 范围控制：没有独立菜单、没有完整物料主数据、没有采购系统、没有染色要求回塞确认工作项。
- 测试策略：所有业务规则先进入 `scripts/check-production-preparation-timing.ts`，最后跑原型治理和构建。
- 提交策略：每个任务独立 commit，避免混入当前工作区其他未提交文件。

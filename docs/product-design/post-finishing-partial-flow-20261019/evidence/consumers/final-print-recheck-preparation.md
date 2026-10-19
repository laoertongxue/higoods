# 最终电子打印复核准备

状态：等待 consumer 最终重新导出。下列命令尚未执行，不将旧 PDF 重新渲染为新证据，也不覆盖原 `print-inspection.md`。

## 等待与版本绑定

收到最终重新导出的通知后，先核对对应 consumer 测试退出结果、源文件版本与文件更新时间。以新 PDF 的实际 SHA256 绑定本次复核，原失败记录及原 PNG 保留原身份。当前测试计划输出 6 份业务 PDF，并另输出 `multi-sku-pagination-layout-only.pdf`；实际文件以最终 consumer 运行结果为准，缺失项记为未验证。

早期固定命名的 PDF 后来可能已被测试重新导出覆盖；原失败报告与 PNG 仍在，不能据此声称每一份早期 PDF 的原始字节都已独立保存。本轮将先复制最终 PDF 到新的时间目录、记录 SHA256，再只从该副本提取和渲染，避免后续重导出改变本轮被检查对象。

| 文件 | 来源与待核对结果 |
| --- | --- |
| `parent-generic.pdf` | 实际 D1 父单；四项各累计 1000，三张复检/出货。待复检 0、待交出 0、累计实收 1000；不能显示为全部待办或首张实收。 |
| `parent-specialized.pdf` | 同一父单专用入口，逐项数量、全部子单、SKU 图与通用入口一致。 |
| `third-outbound-generic.pdf` | 第三张实际出货 800；单号、SKU、来源工厂、图片、出货/实收均对应本张。 |
| `third-outbound-specialized.pdf` | 同一第三张实际出货，和通用入口逐字段比对。 |
| `second-outbound_barcode.pdf` | 第二张实际出货 100 份；冻结 SKU 条码对应、序号连续、无重复/漏份；重点复看 40×30 标签底部人读条码的间距与裁切。 |
| `second-outbound_hangtag.pdf` | 第二张实际出货 100 份；序号/数量及款式颜色尺码图片对应，逐页查看。 |
| `multi-sku-pagination-layout-only.pdf` | 只在打印 DOM 中扩展行数的分页样例，未保存业务记录；仅证明跨页表格、图片、页尾/页首布局，不冒充新增 SKU 或加工事实。 |

通用第三张 800 份标签的实际 DOM 数量另核对 `generic-label-content.json` 和测试中的 `.online-sku-barcode` 断言。此 DOM 计数不冒称已生成通用 800 标签 PDF；若最终仍无该 PDF，明确电子纸面视觉范围不包含它。当前测试同时核对 builder 冻结条码值；模型、DOM 和 PDF 三类证据分开记录。

## 最终导出后才执行的轻量 PDF 读取与渲染命令

以下命令不启动浏览器；先产生页数、尺寸、逐页文本、图片数与文件哈希，再逐页渲染。输出目录使用新时间身份，不覆盖旧证据。

```sh
task_pdf_source="$PWD/docs/product-design/post-finishing-partial-flow-20261019/evidence/consumers"
task_pdf_output="$task_pdf_source/final-print-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$task_pdf_output"
/Users/laoer/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 - "$task_pdf_source" "$task_pdf_output" <<'PY'
import hashlib, json, pathlib, shutil, subprocess, sys
from pypdf import PdfReader

source, output = map(pathlib.Path, sys.argv[1:])
names = [
    'parent-generic.pdf', 'parent-specialized.pdf',
    'third-outbound-generic.pdf', 'third-outbound-specialized.pdf',
    'second-outbound_barcode.pdf', 'second-outbound_hangtag.pdf',
    'multi-sku-pagination-layout-only.pdf',
]
result = []
for name in names:
    path = source / name
    if not path.exists():
        result.append({'file': name, 'missing': True})
        continue
    copied = output / name
    shutil.copy2(path, copied)
    data = copied.read_bytes()
    reader = PdfReader(copied)
    stem = path.stem
    pages = []
    for number, page in enumerate(reader.pages, 1):
        text = page.extract_text() or ''
        (output / f'{stem}-page-{number}.txt').write_text(text)
        pages.append({'page': number, 'sizePt': [float(page.mediabox.width), float(page.mediabox.height)],
                      'textLength': len(text), 'imageCount': len(page.images)})
    result.append({'file': name, 'sha256': hashlib.sha256(data).hexdigest(),
                   'bytes': len(data), 'pages': pages})
    subprocess.run(['pdftoppm', '-r', '110', '-png', str(copied), str(output / stem)], check=True)
(output / 'pdf-manifest.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(output)
PY
```

渲染完成后，对清单中的每一页 PNG 使用图像查看工具逐张核读。文本字数、图片数和页数只用于定位，不替代目视判断；没有文本的条码页也不能仅凭字数判空白。页面较多时可另做缩略拼图导航，但实际裁切、重叠与条码间距仍逐页查看。

## 验收记录模板（完成核读后另存新报告）

```markdown
# 最终电子打印复核记录

- 实际核读时间：待填写
- consumer 运行证据及退出值：待填写
- HEAD / 工作区或资产版本：待填写
- 本次 PDF 清单与 SHA256：引用本轮 pdf-manifest.json
- 逐页 PNG 目录：待填写
- 确认人：代理技术核读；产品/现场接受另列

结论：待核读后填写；未核读前不填写通过。

| PDF | 实际页数 | 实际逐页目视范围 | 裁切/重叠/空白/错图 | 数量与来源核对 | 结果 |
| --- | ---: | --- | --- | --- | --- |
| 通用父卡 | 待填 | 待填 | 待填 | 待复检0、待交出0、实收1000与全部子单 | 待验证 |
| 专用父卡 | 待填 | 待填 | 待填 | 同父单四项及全部子单 | 待验证 |
| 第三张通用出货 | 待填 | 待填 | 待填 | 本张800、实收800、实际工厂与SKU | 待验证 |
| 第三张专用出货 | 待填 | 待填 | 待填 | 与通用入口逐字段一致 | 待验证 |
| 第二张100条码 | 待填 | 待填 | 待填 | 冻结条码、份数100、序号1—100 | 待验证 |
| 第二张100吊牌 | 待填 | 待填 | 待填 | 对应SKU图片、份数100、序号1—100 | 待验证 |
| 多行分页布局样例 | 待填 | 待填 | 待填 | 仅布局，不代表额外业务事实 | 待验证 |

通用800标签DOM证据：实际选择器、实际计数、冻结条码、脚本断言及证据文件待填写。

原失败项关闭表：

| 原问题 | 新版本电子证据 | 结果 |
| --- | --- | --- |
| 40×30标签底部文字裁切/条纹重叠 | 待填 | 待验证 |
| 通用父卡把累计量映为待办、实收为0 | 待填 | 待验证 |
| 第三张出货双入口工厂不一致 | 待填 | 待验证 |
| 通用800标签DOM数量选择器不正确 | 待填 | 待验证 |

未通过或缺失：据实际情况填写，不用布局样例、模型计数或构建成功代替。

本记录只证明对应版本的电子预览、PDF版式与来源映射。没有实体打印机、纸张实测、扫码枪和工厂试用证据，不代表实体打印、实体扫码或现场接受。
```

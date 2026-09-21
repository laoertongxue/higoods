"""Validate design fixtures only; does not execute application business actions."""
from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parent
data = json.loads((ROOT / 'mock-full-flow.json').read_text())
checks = []


def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)


def equal(a, b):
    return abs(a - b) < 1e-8


check('最终规则不按长度或端头新增SKU', not data['confirmedRules']['lengthCreatesSku'] and not data['confirmedRules']['tipCreatesSku'])
check('不建立定长成品长期备货', not data['confirmedRules']['finishedLongTermStock'])
catalog = {item['sku'] for item in data['materialCatalog']}
check('物料SKU唯一', len(catalog) == len(data['materialCatalog']))
all_ids = []
for flow in data['normalScenarios']:
    fid = flow['id']
    all_ids.append(fid)
    check(f'{fid}步骤连续', [s['step'] for s in flow['steps']] == list(range(1, len(flow['steps']) + 1)))
    check(f'{fid}从采购到领料实收', flow['steps'][0]['action'].startswith('下达采购') and flow['steps'][-1]['action'].endswith('领料方实收'))
    check(f'{fid}时间顺序', [s['plannedAt'] for s in flow['steps']] == sorted(s['plannedAt'] for s in flow['steps']))
    check(f'{fid}基础SKU存在', flow['baseSku'] in catalog)
    previous_sku, previous_qty = flow['baseSku'], flow['issuedM']
    for stage in flow['processingStages']:
        all_ids.append(stage['id'])
        check(f'{fid}/{stage["operation"]}上下游SKU与数量承接', stage['inputSku'] == previous_sku and equal(stage['inputM'], previous_qty))
        check(f'{fid}/{stage["operation"]}更换半成品SKU', stage['inputSku'] != stage['outputSku'] and stage['outputSku'] in catalog)
        check(f'{fid}/{stage["operation"]}米制守恒', equal(stage['inputM'], stage['outputM'] + stage['lossM']))
        previous_sku, previous_qty = stage['outputSku'], stage['outputM']
    check(f'{fid}截断实收承接', equal(previous_qty, flow['cutInputM']))
    for line in flow['details']:
        all_ids.extend([line['id'], line['outputId'], line['packageId']])
        check(f'{line["id"]}生产与技术包引用存在', line['productionOrderId'] in flow['references'].values() and line['techPackVersion'] in flow['references'].values())
        check(f'{line["id"]}半成品SKU承接且不换SKU', line['inputSku'] == previous_sku and not line['skuCreatedByCutOrTip'])
        check(f'{line["id"]}条数与长度合法', line['quantity'] > 0 and isinstance(line['quantity'], int) and line['cutLengthMm'] > 0)
        check(f'{line["id"]}成衣需求换算', line['quantity'] == line['productionGarmentQty'] * line['piecesPerGarment'])
        check(f'{line["id"]}端头要求不为空', bool(line['endTreatment']) and bool(line['tipSpecification']))
        check(f'{line["id"]}逐规格最终满足', flow['steps'][-1]['receivedPiecesByDemand'][line['id']] == line['quantity'])
    net = sum(line['quantity'] * line['cutLengthMm'] / 1000 for line in flow['details'])
    check(f'{fid}理论下料计算', equal(net, flow['netCutM']))
    check(f'{fid}截断米制守恒', equal(flow['cutInputM'], net + flow['cutLossM'] + flow['continuousReturnM']))
    final = flow['expectedFinal']
    check(f'{fid}采购到发料整链守恒', equal(flow['purchaseQuantityM'], final['baseContinuousM'] + final['processedContinuousReturnM'] + final['netPiecesEquivalentM'] + final['totalProcessLossM']))
    check(f'{fid}未重复采购实收', final['purchaseReceivedM'] == flow['purchaseQuantityM'] and flow['steps'][-1]['expectedPurchaseReceivedM'] == flow['purchaseQuantityM'])
    check(f'{fid}终点条料库存为零', final['warehousePieces'] == 0 and flow['steps'][-1]['pieceTransit'] == 0)
    material = flow['baseProductionInput']
    check(f'{fid}基础投入重量账独立守恒', equal(material['received'], material['consumed'] + material['returned'] + material['remaining']))
    head = flow['headMaterials']
    if head:
        check(f'{fid}头材身份存在', head['sku'] in catalog)
        used = head.get('installed', head.get('consumed', 0))
        check(f'{fid}头材独立守恒', equal(head['received'], used + head['scrapped'] + head['remaining']))
        if head['unit'] == '个':
            check(f'{fid}装配件数按端数计算', head['installed'] == sum(x['quantity'] * x['endCount'] for x in flow['details']))
check('需求产出包及工序身份不重复', len(all_ids) == len(set(all_ids)))

normal_ids = {x['id'] for x in data['normalScenarios']}
check('5个正常整链场景', normal_ids == {f'N{i:02}' for i in range(1, 6)})
check('24个边界场景', {x['id'] for x in data['boundaryScenarios']} == {f'B{i:02}' for i in range(1, 25)})
for boundary in data['boundaryScenarios']:
    check(f'{boundary["id"]}有起点注入恢复及跨页断言', boundary['base'] in normal_ids and boundary['replayFrom'] == '采购下达' and all(boundary[k] for k in ['injectAt', 'mutation', 'expected', 'recoveryAndFinal', 'checkAtEveryStep']))

o = data['recoveryOracles']
b = o['B02']; check('B02超收整链守恒', equal(b['purchaseReceivedM'], b['baseRemainingM'] + b['processedReturnM'] + b['productionEquivalentM'] + b['totalLossM']))
b = o['B05']
check('B05首次错配净用量', equal(b['firstPieceEquivalentM'], b['firstOutput50'] * .5 + b['firstOutput70'] * .7))
check('B05补做材料守恒', equal(b['supplementIssueFromReturnM'], b['supplementPieceEquivalentM'] + b['supplementReturnM'] + b['supplementLossM']))
check('B05全链保留冻结短条', equal(b['purchaseM'], b['baseRemainingM'] + b['finalProcessedContinuousM'] + b['finalFrozen50Pieces'] * .5 + b['productionReceivedEquivalentM'] + b['totalLossM']))
b = o['B06']; check('B06补采购报废全链守恒', equal(b['purchaseTotalM'], b['finalContinuousM'] + b['productionEquivalentM'] + b['scrappedEquivalentM'] + b['totalCutLossM']))
check('B06补做投入守恒', equal(b['supplementIssuedM'], b['supplementOutputPieces'] * b['supplementCutLengthMm'] / 1000 + b['supplementReturnM'] + b['supplementLossM']))
h = b['metalHeads'];check('B06金属头不漏损耗', h['received'] == h['installedInFinalGood'] + h['scrapped'] + h['remaining'])
h = b['plasticHeads'];check('B06错装塑料头保留事实', h['received'] == h['installedInScrapped'] + h['remaining'])
b = o['B09']; check('B09占用不双扣', b['basePhysicalM'] - b['otherReservedM'] == b['baseAvailableM'])
b = o['B14']; check('B14变更后新需求计算', equal(b['productionEquivalentM'], b['newGood55Pieces'] * .55 + b['newGood70Pieces'] * .7))
check('B14补料印染守恒', equal(b['newDyeInputM'], b['newDyeOutputM'] + b['newDyeLossM']) and equal(b['newDyeOutputM'], b['newPrintOutputM'] + b['newPrintLossM']))
check('B14变更后整链保留旧产出', equal(b['purchaseTotalM'], b['finalBaseM'] + b['finalProcessedReturnM'] + b['oldFrozenEquivalentM'] + b['productionEquivalentM'] + b['totalProcessLossM']))
b=o['B15'];check('B15取消不消除产出', equal(b['purchaseM'], b['continuousM'] + b['frozenPieceEquivalentM'] + b['cutLossM']) and b['productionReceivedPieces']==0)
b=o['B23'];check('B23变更前整链守恒', equal(b['purchaseM'], b['baseRemainingM'] + b['processedReturnM'] + b['productionEquivalentM'] + b['totalLossM']))
b=o['B24'];check('B24已收退货不改原实收', equal(b['originalGrossReceivedM'], b['netPurchaseReceivedM'] + b['returnedToTmfM']))
check('B24原采购全链仍守恒', equal(b['originalGrossReceivedM'], b['finalWarehouseBaseM'] + b['finalProcessedReturnM'] + b['productionEquivalentM'] + b['lossM'] + b['tmfReturnHeldM']))

matrix=(ROOT/'需求追踪矩阵.md').read_text()
rows=[l for l in matrix.splitlines() if re.match(r'\| [A-Z]+-\d{3} \|',l)]
ids=[r.split('|')[1].strip() for r in rows]
check('127项原子需求编号唯一',len(ids)==127 and len(set(ids))==127)
for row in rows:
    cells=[x.strip() for x in row.split('|')[1:-1]]
    check(cells[0]+'矩阵字段完整',len(cells)==10 and all(cells) and cells[7] in ['待实施','实施中','已实现待验证','已验证','已阻塞','不适用'])
sections={int(n) for r in rows for n in re.findall(r'§(\d+)',r.split('|')[2])}
check('所有规范章节覆盖；第2章为事实依据另由DOC追踪',set(range(1,15))-{2} <= sections)
main=(ROOT/'织带厂管理产品方案.md').read_text()
check('包含流程时序状态共4张图',main.count('```mermaid')==4)
check('Markdown围栏配对',len(re.findall(r'^```',main,re.M))%2==0)
for filename in ['织带厂管理产品方案.md','实施计划.md','需求追踪矩阵.md']:
    text=(ROOT/filename).read_text()
    for target in re.findall(r'\]\(([^)]+)\)',text):
        if not target.startswith(('https:','http:','#')) and target != '文档与数据核查记录.md':
            check(filename+'本地链接存在:'+target,(ROOT/target).exists())
for key,path in data['assets'].items():
    if key.startswith('IMG-'):
        check(key+'参考图片存在',(ROOT/path).is_file())
print(json.dumps({'result':'PASS','checks':len(checks),'normalScenarios':len(normal_ids),'boundaryScenarios':len(data['boundaryScenarios']),'atomicRequirements':len(rows),'fixtureSha256':hashlib.sha256((ROOT/'mock-full-flow.json').read_bytes()).hexdigest(),'scope':'仅产品方案及静态数据合同校验；未执行应用动作/浏览器/打印/性能'},ensure_ascii=False,indent=2))

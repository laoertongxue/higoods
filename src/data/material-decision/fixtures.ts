import type { Material, Stock, Demand, Supply, Policy } from './model'
import { addDays, startDate } from './calculations'
export const snapshot = 'DEMO-20260914-0900'
export const defaultPolicy: Policy = { version: 1, name: '演示：完整日需求 / 合格供给', timezone: 'Asia/Jakarta', horizon: 30, lead: 7, safety: 10, moq: 50, pack: 10, coefficient: 1, includeConditional: false, snapshot }
export const warehouses = [
 ['WH-FABRIC-006','SAMPLE-FABRIC-样衣面辅料仓','面料仓'], ['WH-FABRIC-005','GT面料仓','面料仓'], ['WH-FABRIC-004','holis面料仓','面料仓'],
 ['HILON-5','HILON-裁片仓','面料仓'], ['HILON-4','HILON-耗材','耗材仓'], ['HILON-3','HILON-纱线','纱线仓'],
 ['WH-HAOCAI-001','耗材中央仓','耗材仓'], ['WH-FABRIC-001','面料中央仓(GKP)','面料仓'], ['WH-MAOSHA-001','纱线中央仓','纱线仓'],
 ['WH-FITTING-001','辅料中央仓(GTP)','辅料仓'], ['WH-BDG-009','中转仓（新裁床）','中转仓'], ['HILON-2','HILON-辅料仓','辅料仓'],
 ['HILON-1','HILON-面料仓','面料仓'], ['GUDANG BARU-1','GUDANG BARU-1','面料仓'], ['WH-BDG-005','中转仓（Sea Cutting）','中转仓'],
 ['F&M WH','F&M WH','成衣仓'], ['A&C WH','A&C WH','成衣仓'],
] as const
export const processingTypes = ['染色厂','印花厂','辅料厂','辅助工艺','特种工艺','毛织厂','花边厂']
const specs: [string,string,Material['category'],string[],string,boolean?][] = [
 ['CNIDML074-black','黑色面料','面料',[],'示例SKU，非线上库存；目标色加工供给'],
 ['CNIDML074-white','白坯面料','面料',[],'示例SKU，投入加工占用不能重复分配'],
 ['FLSZ24116-black','黑色吊粒','辅料',['FADFAD'],'用户品牌映射'],
 ['FLSZ24116-white','白色吊粒','辅料',['CHICMORE','MODISH','ASAYA'],'三品牌共享库存池'],
 ['IDSZWL005-white','白色吊粒','辅料',[],'适用场景待核实',true],['IDSZWL005-black','黑色吊粒','辅料',[],'适用场景待核实',true],
 ['FLSZ388-black-onesize','黑色吊粒','辅料',[],'适用场景待核实',true],['FLSZ388-white-onesize','白色吊粒','辅料',[],'适用场景待核实',true],
 ['FLSZ408-sameasphoto','面单纸','耗材',[],'卷与张数换算待核实',true],
 ['FLSZ405-onesize','快递袋','包材',[],'与新规格关系待核实',true],
 ...['white-a','white-b','pink-a','pink-b','black-a','black-b','orange-a','orange-b','white-1','white-2'].map(s => [`FLSZ385-${s}`,'快递袋','包材',[],'旧新规格关系待核实',true] as typeof specs[number]),
 ...['fadfad','chicmore','asaya','modish'].map(b => [`WLID009-${b}`,'品牌吊牌','辅料',[b.toUpperCase()],'按实际挂装件数'] as typeof specs[number]),
 ['WLID007-sameasphoto','空白吊牌','耗材',[],'通用，按打印张数'], ['WLID008-sameasphoto','碳带','耗材',[],'打印长度换算待核实',true],
 ...['fadfad','chicmore','asaya','modish'].map(b => [`WLID002-${b}`,'拉链袋旧短码','包材',[b.toUpperCase()],'与细规格码关系待核实，不叠加保障',true] as typeof specs[number]),
 ...['fadfad','chicmore'].flatMap(b => ['28x30','28x37'].map(size => [`WLID002-${b}-6.5c-${size}`,'磨砂内袋','包材',[b.toUpperCase()],'品牌＋尺寸适用，单耗为演示配置'] as typeof specs[number])),
 ['WLID002-modish-6.5c-28x30','磨砂内袋','包材',['MODISH'],'尺寸独立'], ['WLID002-asaya-6c-28x30','磨砂内袋','包材',['ASAYA'],'尺寸独立'],
 ...['fadfad','chicmore','modish'].flatMap(b => [
  [`WLID001-${b}-6c-${b === 'modish' ? '32x35' : '32x42'}`,'机器快递袋','包材',[b.toUpperCase()],'包装方式待档案确认',true] as typeof specs[number],
  [`WLID001-${b}-dikemas-dengan-tangan-6c-32x42`,'手工快递袋','包材',[b.toUpperCase()],'包装方式待档案确认',true] as typeof specs[number],
 ]),
 ['WLID001-asaya-dikemas-dengan-tangan-6c-32x42','ASAYA快递袋','包材',['ASAYA'],'图片两格同码，机器/手工关系待确认',true],
]
export const materials: Material[] = specs.map(([sku,name,category,brands,notes,uncertain]) => ({ sku, spu: sku.split('-')[0], name, category, brands, notes, unit: category === '面料' ? 'Yard' : sku.startsWith('WLID008') || sku.startsWith('FLSZ408') ? '卷' : '个', scope: category === '面料' ? '面料供给池' : '包装供给池', owner: category === '面料' ? '面料计划组' : '包装计划组', active: true, mapping: uncertain ? '待核实' : '已映射', cost: null }))
export const stock: Stock[] = materials.flatMap((m,i) => [
 { id: `ST-${i}-1`, sku: m.sku, warehouse: m.category === '面料' ? 'WH-FABRIC-001' : 'WH-FITTING-001', qty: i === 1 ? 2000 : i === 3 ? 100 : 50 + i * 13, quality: '合格' as const, internalReserved: i === 1 ? 1800 : i === 0 ? 30 : 0, externalReserved: i === 0 ? 10 : 0, usable: true, measured: true },
 { id: `ST-${i}-2`, sku: m.sku, warehouse: m.category === '面料' ? 'HILON-1' : 'HILON-2', qty: 20, quality: '待检' as const, internalReserved: 0, externalReserved: 0, usable: false, measured: true },
])
export const demands: Demand[] = materials.flatMap((m,i) => i === 1 ? [] : [
 ...Array.from({ length: 30 }, (_,day) => ({ id: `D-${i}-${day}`, sku: m.sku, date: addDays(startDate, day), qty: day < 7 ? (i === 3 ? 20 : 8 + i % 6) : 5, fulfilled: 0, covered: day < 7 ? 0 : 2, kind: day < 7 ? '确定' as const : '预测' as const, brand: m.brands[day % Math.max(1,m.brands.length)] ?? '通用', source: day < 7 ? `DEMO-生产-${i}` : `DEMO-预测-${i}`, order: `ORDER-${i}-${day}` })),
])
export const supplies: Supply[] = [
 { id: 'S1', sku: materials[0].sku, date: addDays(startDate,9), qty: 200, received: 40, kind: '采购', certain: true, source: 'DEMO-PO-001', chain: 'C1' },
 { id: 'S2', sku: materials[0].sku, date: addDays(startDate,15), qty: 100, received: 0, kind: '加工', certain: false, source: 'DEMO-加工-001', chain: 'C2' },
 { id: 'S3', sku: 'FLSZ24116-white', date: addDays(startDate,20), qty: 50, received: 0, kind: '采购', certain: true, source: 'DEMO-PO-002', chain: 'C3' },
 { id: 'S4', sku: 'WLID008-sameasphoto', date: '1970-01-01', qty: 5, received: 0, kind: '采购', certain: true, source: 'DEMO-PO-003', chain: 'C4' },
]

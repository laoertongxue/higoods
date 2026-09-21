import fs from 'node:fs'
import path from 'node:path'
const root = path.resolve('docs/product-design/tmf-webbing')
const mock = JSON.parse(fs.readFileSync(path.join(root,'mock-full-flow.json'),'utf8'))
const scenarios = [...mock.normalScenarios, ...mock.boundaryScenarios]
const results = []
const fail = (id, check, detail) => results.push({id, check, ok:false, detail})
const pass = (id, check, detail) => results.push({id, check, ok:true, detail})
const near = (a,b) => Math.abs(Number(a)-Number(b)) < 0.001

for (const s of mock.normalScenarios) {
  const id=s.id
  if (!s.references?.purchase || !s.references?.productionOrder || !s.references?.techPack) fail(id,'references','采购/生产单/技术包引用不完整')
  else pass(id,'references','采购、生产单、技术包和加工单引用齐全')
  if (!(s.purchaseQuantityM > 0 && s.issuedM >= 0 && s.issuedM <= s.purchaseQuantityM)) fail(id,'purchase-issue','采购与发料数量不守恒')
  else pass(id,'purchase-issue',`${s.purchaseQuantityM}m采购，${s.issuedM}m发料`)
  const stages=s.processingStages||[]
  for (const [i,stage] of stages.entries()) {
    if (!(stage.inputM >= stage.outputM && near(stage.inputM-stage.outputM,stage.lossM))) fail(id,`stage-${i+1}`,`投入/产出/损耗不守恒: ${JSON.stringify(stage)}`)
  }
  if (stages.length) pass(id,'processing-stages',`${stages.length}道加工工序逐道保留投入、产出、损耗`)
  else pass(id,'processing-stages','无染印路线，直接进入TMF截断')
  const detailNet=(s.details||[]).reduce((sum,d)=>sum + d.cutLengthMm*d.quantity/1000,0)
  if (!near(detailNet,s.netCutM)) fail(id,'cut-output',`明细截断米数 ${detailNet} != netCutM ${s.netCutM}`)
  else pass(id,'cut-output',`按尺码/用途分行 ${s.details.length} 行，净截断 ${s.netCutM}m`)
  if (!s.expectedFinal || !(s.expectedFinal.purchaseReceivedM > 0)) fail(id,'final','缺少最终库存/实收守恒断言')
  else pass(id,'final','最终采购实收、连续余料、产出实收和损耗断言齐全')
  if ((s.steps||[]).length < 6) fail(id,'steps','全流程步骤少于6步')
  else pass(id,'steps',`${s.steps.length}步流程含来源、时间、数量和交接`)
}
for (const s of mock.boundaryScenarios) {
  const id=s.id
  if (!s.injectAt || !s.mutation) fail(id,'injection','缺少异常注入点和变异')
  else pass(id,'injection',`${s.injectAt}: ${s.mutation}`)
  if (!s.checkAtEveryStep || !s.expected || !s.recoveryAndFinal) fail(id,'recovery','缺少逐步检查、阻断预期或恢复终点')
  else pass(id,'recovery','逐步数量/状态检查、阻断和恢复终点齐全')
  if (!s.numericalOracle) fail(id,'oracle','缺少数量或库存守恒算子')
  else pass(id,'oracle','数量/库存/状态恢复算子已定义')
  if (!s.replayFrom) fail(id,'replay','缺少重放起点')
  else pass(id,'replay',`从 ${s.replayFrom} 重放`)
}
const summary={scenarioCount:scenarios.length,checks:results.length,passed:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length,byScenario:Object.fromEntries(scenarios.map(s=>[s.id,{passed:results.filter(x=>x.id===s.id&&x.ok).length,failed:results.filter(x=>x.id===s.id&&!x.ok).length}]))}
const output={generatedAt:new Date().toISOString(),fixture:'mock-full-flow.json',summary,results,verdict:summary.failed?'未通过':'通过'}
fs.writeFileSync(path.join(root,'evidence/2026-09-20-full-mock-scenario-validator-current.json'),JSON.stringify(output,null,2)+'\n')
console.log(JSON.stringify(summary))
if(summary.failed) process.exitCode=1

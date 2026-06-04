import { seedPcsProductTestingSixFlowValidationData } from '../src/data/pcs-product-testing-six-flow-validation-seed.ts'

const result = seedPcsProductTestingSixFlowValidationData({
  reset: true,
  operatorName: '六轮验收脚本',
  log: (message) => console.log(message),
})

console.log(`check-pcs-product-testing-six-flows passed: 2 templates x 3 conclusions, ${result.flowCount} flows seeded`)

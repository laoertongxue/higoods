import assert from 'node:assert/strict'
import {YARN_TUBE_GRAMS,calculateYarnWeight,yarnGrossLimit,assertYarnShipment} from '../src/data/fcs/yarn-weight.ts'
assert.deepEqual(YARN_TUBE_GRAMS,{PAPER:62,CONICAL:80,PAGODA:121})
assert.equal(calculateYarnWeight(12,{PAPER:0,CONICAL:0,PAGODA:20}).netGrams,9580)
assert.equal(calculateYarnWeight(11.4,{PAPER:0,CONICAL:0,PAGODA:19}).netGrams,9101)
assert.equal(calculateYarnWeight(20,{PAPER:10,CONICAL:10,PAGODA:10}).netGrams,17370)
for(const [order,cap] of [[9.999,29997],[10,30000],[10.001,20002]]) {
 assert.equal(yarnGrossLimit(order).limitGrams,cap)
 assertYarnShipment(order,0,calculateYarnWeight(cap/1000,{PAPER:1,CONICAL:0,PAGODA:0}),100)
 assert.throws(()=>assertYarnShipment(order,0,calculateYarnWeight((cap+1)/1000,{PAPER:1,CONICAL:0,PAGODA:0}),100),/毛重/)
}
assertYarnShipment(10,28000,calculateYarnWeight(2,{PAPER:1,CONICAL:0,PAGODA:0}),2)
assert.throws(()=>assertYarnShipment(10,28000,calculateYarnWeight(3,{PAPER:1,CONICAL:0,PAGODA:0}),3),/毛重/)
assert.throws(()=>assertYarnShipment(10,0,calculateYarnWeight(2,{PAPER:1,CONICAL:0,PAGODA:0}),1),/净重/)
assert.throws(()=>calculateYarnWeight(.1,{PAPER:0,CONICAL:0,PAGODA:1}),/管重/)
assert.throws(()=>calculateYarnWeight(1,{PAPER:1,CONICAL:0,PAGODA:0},2),/pcs/)
assert.throws(()=>yarnGrossLimit(0),/下单重量/)
assert.equal(calculateYarnWeight(0,{PAPER:0,CONICAL:0,PAGODA:0}).netGrams,0)
console.log('PASS yarn: tube standards, pcs, gram precision, net, 10kg boundary, cumulative gross, available net')

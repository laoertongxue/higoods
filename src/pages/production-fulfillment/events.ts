/** Small synchronous bridge: the DDS route loads its handlers without importing this feature into every system page. */
interface Handlers { click:(target:Element)=>boolean; field:(target:Element)=>boolean; key:(event:KeyboardEvent)=>boolean }
let handlers:Handlers|undefined
export function connectProductionFulfillmentHandlers(value:Handlers):void {handlers=value}
export function handleProductionFulfillmentClick(target:Element):boolean {return handlers?.click(target)??false}
export function handleProductionFulfillmentField(target:Element):boolean {return handlers?.field(target)??false}
export function handleProductionFulfillmentKey(event:KeyboardEvent):boolean {return handlers?.key(event)??false}

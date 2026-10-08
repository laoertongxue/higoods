/** Small synchronous bridge: the DDS route loads its handlers without importing this feature into every system page. */
interface Handlers { click:(target:Element)=>boolean; field:(target:Element)=>boolean; key:(event:KeyboardEvent)=>boolean;drag?:(target:Element,event:Event)=>boolean }
let handlers:Handlers|undefined
// Capture before bubbling handlers so measurements include event dispatch and lazy route imports.
let eventStartedAt=0
if(typeof document!=='undefined')for(const type of ['click','input','change','keydown','drop'])document.addEventListener(type,event=>{eventStartedAt=event.timeStamp>0?event.timeStamp:performance.now();const root=document.querySelector<HTMLElement>('#pf-app,[data-timing-source-detail]');if(root)root.dataset.timingReady=''},true)
if(typeof window!=='undefined')window.addEventListener('popstate',()=>{eventStartedAt=performance.now()})
export function timingEventStart():number{return eventStartedAt||performance.now()}
export function timingRouteStart():number{return eventStartedAt}
export function connectProductionFulfillmentHandlers(value:Handlers):void {handlers=value}
export function handleProductionFulfillmentClick(target:Element):boolean {return handlers?.click(target)??false}
export function handleProductionFulfillmentField(target:Element):boolean {return handlers?.field(target)??false}
export function handleProductionFulfillmentKey(event:KeyboardEvent):boolean {return handlers?.key(event)??false}
let sourceHandlers:{click:(target:HTMLElement,event?:Event)=>boolean;key:(event:KeyboardEvent)=>boolean}|undefined
export function connectTimingSourceHandlers(value:NonNullable<typeof sourceHandlers>):void{sourceHandlers=value}
export function handleTimingSourceClick(target:HTMLElement,event?:Event):boolean{return sourceHandlers?.click(target,event)??false}
export function handleTimingSourceKey(event:KeyboardEvent):boolean{return sourceHandlers?.key(event)??false}

export function handleProductionFulfillmentDrag(target:Element,event:Event):boolean{return handlers?.drag?.(target,event)??false}

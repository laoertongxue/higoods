import { escapeHtml as e } from '../../utils'
import { getTimingMaterialImage } from '../../data/production-timing/material-images'
export function materialFigure(id:string):string {
 const image=getTimingMaterialImage(id);if(!image)return ''
 return '<figure class="timing-material-figure"><button type="button" data-timing-source-action="material-image" data-timing-material="'+e(id)+'" data-skip-page-rerender="true" aria-label="查看'+e(image.name)+'效果大图"><img src="'+e(image.imageUrl||'')+'" alt="'+e(image.alt)+'" width="56" height="56" style="width:56px;height:56px;object-fit:contain;border:1px solid #dce5ef;border-radius:4px"></button><figcaption><strong>'+e(id+' '+image.name)+'</strong><small style="display:block">'+(id==='F01'?'PCS 原型原料效果图':'Mock 物料效果图')+'</small></figcaption></figure>'
}
export function materialImageContent(id:string):string {
 const image=getTimingMaterialImage(id);if(!image)return '对应图片待补'
 return '<h3>'+e(image.name)+' · 物料效果图</h3><img src="'+e(image.imageUrl||'')+'" alt="'+e(image.alt)+'" style="max-width:100%;max-height:70vh;object-fit:contain"><p>'+e(image.note)+'</p>'
}

import {money} from './commerce.js';
import {productDetails} from './shop-tools.js';
import {productUrl} from './product-links.js';
import {isRetiredProduct} from './catalog-policy.js';
const storeNumber='962790025430';
const oneLine=(value,max=110)=>String(value??'').replace(/[\r\n\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
export function whatsappCheckoutUrl({lines=[],quote=null,orderId=''}={}){
 const items=lines.filter(x=>x?.product&&!isRetiredProduct(x.product)&&Number.isInteger(x.qty)&&x.qty>0&&x.qty<=10).slice(0,20);
 if(!items.length)return '';
 const text=[orderId?'مرحبًا Trend Shop، أود متابعة طلبي '+oneLine(orderId,60):'مرحبًا Trend Shop، أود طلب المنتجات التالية:'];
 for(const {product:p,qty,variantLabel=''}of items){text.push(`• ${oneLine(productDetails(p).nameAr||p.name,85)}${variantLabel?' — '+oneLine(variantLabel,65):''} × ${qty} — ${money(Number(p.priceFils??p.price_fils)*qty)}`)}
 if(items.length===1)text.push(productUrl(items[0].product.id));
 if(quote){text.push('');if(quote.discountFils>0)text.push('خصم السلة: '+money(quote.discountFils));text.push('مجموع المنتجات: '+money(quote.subtotalFils),'التوصيل: '+(quote.shippingFeeFils===0?'مجاني':money(quote.shippingFeeFils)),'الإجمالي شامل التوصيل: '+money(quote.totalFils))}
 text.push('','يرجى تأكيد التوفر وتفاصيل التوصيل وطريقة الدفع معي.');
 return 'https://wa.me/'+storeNumber+'?text='+encodeURIComponent(text.join('\n'));
}

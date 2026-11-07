import {money} from './commerce.js?v=5.0.0';
import {productDetails} from './shop-tools.js';
import {productUrl,STORE_ORIGIN} from './product-links.js';
import {isBundleId,bundleHref} from './bundles.js?v=5.8.0';
import {isRetiredProduct} from './catalog-policy.js';
const storeNumber='962790025430';
const oneLine=(value,max=110)=>String(value??'').replace(/[\r\n\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
export function whatsappCheckoutUrl({lines=[],quote=null,orderId='',locale='ar'}={}){
 const items=lines.filter(x=>x?.product&&!isRetiredProduct(x.product)&&Number.isInteger(x.qty)&&x.qty>0&&x.qty<=10).slice(0,20);
 if(!items.length)return '';
 const en=locale==='en',price=n=>en?`${(Number(n||0)/1000).toFixed(2)} JOD`:money(n);
 const text=[orderId?(en?'Hi Trend Shop, I would like to follow up on order ':'مرحبًا Trend Shop، أود متابعة طلبي ')+oneLine(orderId,60):(en?'Hi Trend Shop, I would like to order:':'مرحبًا Trend Shop، أود طلب المنتجات التالية:')];
 for(const {product:p,qty,variantLabel=''}of items){const d=productDetails(p),url=isBundleId(p.id)?STORE_ORIGIN+'/'+(en?'?lang=en':'')+bundleHref(p.id):productUrl(p.id,locale);text.push(`• ${oneLine(en?(d.en?.name||p.name):(d.nameAr||p.name),100)}${variantLabel?' — '+oneLine(variantLabel,65):''} × ${qty} — ${price(Number(p.priceFils??p.price_fils)*qty)}`,url)}
 if(quote){text.push('');if(quote.discountFils>0)text.push((en?'Bag discount: ':'خصم السلة: ')+price(quote.discountFils));text.push((en?'Products subtotal: ':'مجموع المنتجات: ')+price(quote.subtotalFils),(en?'Delivery: ':'التوصيل: ')+(quote.shippingFeeFils===0?(en?'Free':'مجاني'):price(quote.shippingFeeFils)),(en?'Total including delivery: ':'الإجمالي شامل التوصيل: ')+price(quote.totalFils))}
 text.push('',en?'Please confirm availability, delivery details and payment method with me.':'يرجى تأكيد التوفر وتفاصيل التوصيل وطريقة الدفع معي.');
 return 'https://wa.me/'+storeNumber+'?text='+encodeURIComponent(text.join('\n'));
}

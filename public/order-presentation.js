export function orderDisplayItems(order){
 try{const rows=typeof order.presentation_json==='string'?JSON.parse(order.presentation_json):order.presentation_json;
  if(Array.isArray(rows)&&rows.length&&rows.length<=40&&rows.every(x=>typeof x.name_snapshot==='string'&&Number.isInteger(x.qty)&&x.qty>0&&Number.isInteger(x.line_total_fils)&&x.line_total_fils>=0)&&rows.reduce((n,x)=>n+x.line_total_fils,0)===order.subtotal_fils)return rows;
 }catch{}
 return order.items||[];
}
export const orderLineTotal=item=>Number.isInteger(item.line_total_fils)?item.line_total_fils:item.unit_price_fils*item.qty;

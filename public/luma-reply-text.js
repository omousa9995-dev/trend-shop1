// Customer text and the product event have separate contracts. Stop at the
// first internal payload, even when a provider appends it to ordinary prose.
const protocol = /[<{}`]|\[\s*["'“{]|(?:^|[\s:])(?:iktib\s*(?:\/|\b)|(?:\w+\/)?(?:show_pro\w*|get_catalog|ask_question|answer_customer|handoff_to_team)\b)|\b(?:PRODUCTS_JSON|VISITOR_PROFILE|STORE_CONFIG|ACTION CONTRACT|thoughtSignature|function[_ ]?Call|function[_ ]?Response)\b|(?:^|[\s,\[])["'“]?(?:carePlan|dayPlan|productIds?|selections|function_call|tool_calls)["'”]?\s*[:：]/i;
const referenceLine = /^\s*المنتجات المقترحة:.*$/gm;
const code = /\b(?:TS|PROMO)[A-Z0-9-]{4,64}\b/gi;

export function lumaReplyText(value, {partial = false} = {}) {
  if (typeof value !== 'string') return '';
  const raw = value.replace(referenceLine, '');
  const cut = raw.search(protocol);
  let text = cut < 0 ? raw : raw.slice(0, cut);
  if (partial && cut < 0) {
    // A provider can split a command name across multiple token chunks.
    const last = [...text.matchAll(/[.!؟?](?=\s|$)|\n/g)].at(-1);
    text = last ? text.slice(0, last.index + 1) : '';
  }
  return text.replace(code, '').replace(/\(\s*\)/g, '')
    .replace(/(?:^|\n)[^\n]+[:：]\s*$/, '').replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([،؛.!؟?])/g, '$1').trim();
}

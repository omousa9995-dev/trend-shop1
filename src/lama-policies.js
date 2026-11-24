import { STORE_CONFIG } from '../public/store-config.js';
import { normalizeSearch } from '../public/shop-tools.js';

const amount = fils => String(fils / 1000);
const duration = ({ minHours, maxHours }, english) => {
  const term = english ? 'hours' : 'ساعة';
  if (minHours === 0) return english ? 'within '+maxHours+' '+term : 'خلال '+maxHours+' '+term+'، وممكن بنفس اليوم حسب وقت تثبيت الطلب';
  return minHours === maxHours ? maxHours+' '+term : minHours+'–'+maxHours+' '+term;
};

export function lamaPolicyReply(message, config = STORE_CONFIG) {
  const query = normalizeSearch(message);
  const en = !/[\u0600-\u06ff]/.test(message);
  const payment = /الدفع|(?:^| )دفع|ادفع|كاش|كليك|تحويل|cash|cod|payment|cliq/.test(query);
  const delivery = /توصيل|الشحن|شحن|يوصل|بوصل|بتوصل|بتوصلوا|بيوصل|بوصله|متي.{0,15}طلب|مندوب|استلام.{0,12}طلب|deliver|shipping|arriv/.test(query);
  const authenticity = /اصال|اصلي|مقلد|معتمد|كفال|وكيل|الوكلاء|ختم|مختوم|افحص|فحص الطلب|authentic|genuine|original|warranty|sealed|inspect/.test(query);
  const tracking = /(?:وين|اين|تتبع|اتابع|متابعه).{0,18}(?:طلبي|الطلب)|track.{0,15}order/.test(query);
  const support = /رقم.{0,22}(?:متجر|ادار|دعم|فريق)|واتسابكم|رقمكم|contact.{0,20}(?:support|store)|customer support/.test(query);
  if (!payment && !delivery && !authenticity && !tracking && !support) return null;
  const lines = [];
  if (payment) {
    const methods = [
      config.payment.cashOnDelivery && (en ? 'cash on delivery anywhere in Jordan' : 'كاش عند الاستلام بكل محافظات الأردن'),
      config.payment.manualCliQ && (en ? 'manual CliQ transfer arranged with the team' : 'تحويل عبر CliQ بالتنسيق مع فريق المتجر')
    ].filter(Boolean);
    if (methods.length) lines.push((en ? 'You can pay by ' : 'بتقدري تدفعي ') + methods.join(en ? ' or ' : '، أو ') + '.');
  }
  if (delivery) {
    const { shipping } = config;
    const outsideOnly = /خارج عمان|outside amman/.test(query);
    const amman = !outsideOnly && /عمان|amman/.test(query);
    const elsewhere = outsideOnly || /للمحافظات|باقي المحافظات|المحافظات الثانيه|الزرقا|اربد|العقبه|البلقا|السلط|مادبا|المفرق|جرش|عجلون|الكرك|الطفيل|معان/.test(query);
    const timing = [
      (amman||!elsewhere) && (en ? 'In Amman: ' : 'داخل عمّان ') + duration(shipping.amman,en),
      (elsewhere||!amman) && (en ? 'Other governorates: ' : 'للمحافظات الثانية ') + duration(shipping.governorates,en)
    ].filter(Boolean).join(en ? '. ' : '، ');
    lines.push(en
      ? 'We deliver across Jordan. '+timing+' after order confirmation. The courier team calls or messages on WhatsApp to arrange handover.'
      : 'بنوصّل لجميع مناطق الأردن. '+timing+' من تثبيت الطلب. '+shipping.coordination);
    lines.push(en
      ? 'Delivery costs '+amount(shipping.feeFils)+' JOD and is free for subtotals over '+amount(shipping.freeAboveFils)+' JOD after discounts.'
      : 'التوصيل '+amount(shipping.feeFils)+' دينار، ومجاني للطلبات فوق '+amount(shipping.freeAboveFils)+' دينارًا بعد الخصم.');
  }
  if (authenticity) lines.push(en
    ? 'Trend Shop guarantees the authenticity of its products from authorized agents and approved sources. You can inspect the order and check the seal on delivery.'
    : config.authenticity.guarantee+' '+config.authenticity.inspection);
  if (tracking) lines.push(en
    ? 'Our team can check a specific order and confirm its delivery window through WhatsApp.'
    : 'فريقنا بقدر يتابع طلبكِ ويأكد وقت توصيله على واتساب.');
  if (support) lines.push(en ? 'You can reach the Trend Shop team on WhatsApp.' : 'من عيوني، بتقدري تحكي مع فريق Trend Shop على واتساب.');
  return {text:lines.join('\n\n'),...((tracking||support)?{team:{label:en?'Contact Trend Shop':'واتساب إدارة Trend Shop',href:config.supportWhatsApp}}:{})};
}

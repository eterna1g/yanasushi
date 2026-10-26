import { DELIVERY_FEE, FREE_FROM } from './site-settings.js';

export class ApiError extends Error {
  constructor(status,code,message,details={}) { super(message);this.status=status;this.code=code;this.details=details; }
}
export const fail=(status,code,message,details)=>{throw new ApiError(status,code,message,details);};
export async function readJson(request,limit) {
  const reader=request.body?.getReader();if(!reader)fail(400,'INVALID_JSON','Пустой запрос.');
  let size=0;const chunks=[];
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();fail(413,'TOO_LARGE','Слишком большой запрос.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail(400,'INVALID_JSON','Некорректные данные формы.');}
}
export function cleanText(value,min,max,label) {
  if(typeof value!=='string'||value.trim().length<min||value.trim().length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))fail(400,'VALIDATION',`Проверьте поле «${label}».`);
  return value.trim();
}
export function submissionId(value) {
  if(typeof value!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(value))fail(400,'VALIDATION','Некорректный номер отправки.');return value;
}
export function validateOrder(input,menu) {
  if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'VALIDATION','Проверьте заказ.');
  const order={id:submissionId(input.id),name:cleanText(input.name,2,80,'Имя'),phone:cleanText(input.phone,7,25,'Телефон'),address:cleanText(input.address,5,300,'Адрес'),comment:cleanText(input.comment??'',0,1000,'Комментарий'),pay:input.pay};
  if(/[\r\n\t]/.test(order.name+order.phone+order.address)||!/^[+\d ()-]+$/.test(order.phone)||order.phone.replace(/\D/g,'').length<7||order.phone.replace(/\D/g,'').length>15||!['cash','card'].includes(order.pay))fail(400,'VALIDATION','Проверьте телефон и способ оплаты.');
  if(!Array.isArray(input.items)||input.items.length<1||input.items.length>40)fail(400,'VALIDATION','В заказе должно быть от 1 до 40 разных блюд.');
  const ids=new Set();let subtotalCents=0;
  order.items=input.items.map(line=>{
    if(!line||typeof line.id!=='string'||ids.has(line.id)||!Number.isInteger(line.qty)||line.qty<1||line.qty>99)fail(400,'VALIDATION','Некорректное количество или повторяющееся блюдо.');
    ids.add(line.id);const item=menu.find(item=>item.id===line.id);
    if(!item)fail(409,'PRICE_CHANGED','Меню изменилось. Обновите корзину перед заказом.');
    const cents=Math.round(item.price*100);if(!Number.isSafeInteger(cents)||cents<1)fail(503,'CATALOG_UNAVAILABLE','Меню временно недоступно.');
    subtotalCents+=cents*line.qty;
    return {id:item.id,qty:line.qty,price:cents/100,name:typeof item.name==='string'?item.name:item.name.ru};
  });
  if(subtotalCents>100000000)fail(400,'VALIDATION','Слишком большая сумма заказа.');
  const deliveryCents=subtotalCents>=Math.round(FREE_FROM*100)?0:Math.round(DELIVERY_FEE*100);
  Object.assign(order,{subtotal:subtotalCents/100,delivery:deliveryCents/100,total:(subtotalCents+deliveryCents)/100});
  for(const key of ['subtotal','delivery','total']){
    if(typeof input[key]!=='number'||!Number.isFinite(input[key])||input[key]<0)fail(400,'VALIDATION','Некорректная сумма заказа.');
    if(Math.abs(input[key]*100-Math.round(input[key]*100))>.00001||Math.round(input[key]*100)!==Math.round(order[key]*100))fail(409,'PRICE_CHANGED','Цена или доставка изменились. Обновите корзину и подтвердите новую сумму.',{quote:{subtotal:order.subtotal,delivery:order.delivery,total:order.total}});
  }
  return order;
}
export function orderMessage(order,number) {
  const money=value=>`${value.toFixed(2)} ₴`;
  return [`🍣 НОВЫЙ ЗАКАЗ YANASUSHI #${number}`,`Имя: ${order.name}`,`Телефон: ${order.phone}`,`Адрес: ${order.address}`,`Оплата: ${order.pay==='card'?'Картой':'Наличными'}`,order.comment?`Комментарий: ${order.comment}`:'','',...order.items.map(item=>`${item.name} × ${item.qty} — ${money(item.price*item.qty)}`),'',`Блюда: ${money(order.subtotal)}`,`Доставка: ${money(order.delivery)}`,`Итого: ${money(order.total)}`].join('\n');
}
export function validateReview(input) {
  if(!input||typeof input!=='object')fail(400,'VALIDATION','Проверьте отзыв.');
  const review={name:cleanText(input.name,2,80,'Имя'),text:cleanText(input.text,10,1500,'Отзыв'),rating:input.rating};
  if(/[\r\n\t]/.test(review.name))fail(400,'VALIDATION','Введите имя в одну строку.');
  if(!Number.isInteger(review.rating)||review.rating<1||review.rating>5)fail(400,'VALIDATION','Выберите оценку от 1 до 5 звёзд.');
  if(/https?:\/\/|www\./i.test(review.name+' '+review.text))fail(400,'VALIDATION','В отзывах нельзя размещать рекламные ссылки.');
  const photo=input.photo||'';
  if(typeof photo!=='string'||photo.length>400000)fail(400,'INVALID_PHOTO','Фото слишком большое. Загрузите другое изображение.');
  if(!photo)return {...review,photo:'',photoType:''};
  const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo);
  if(!match)fail(400,'INVALID_PHOTO','Допускаются только JPEG, PNG и WebP.');
  let bytes;try{bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));}catch{fail(400,'INVALID_PHOTO','Не удалось прочитать фото.');}
  const ascii=(start,length)=>String.fromCharCode(...bytes.slice(start,start+length));
  const isImage=match[1]==='jpeg'?bytes.length>4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255:match[1]==='png'?bytes.length>24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)&&ascii(12,4)==='IHDR':bytes.length>20&&ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP'&&['VP8 ','VP8L','VP8X'].includes(ascii(12,4));
  if(!isImage)fail(400,'INVALID_PHOTO','Файл не похож на поддерживаемое изображение.');
  const dimensions=imageDimensions(bytes,match[1]);
  if(!dimensions || dimensions.some(n=>!Number.isInteger(n)||n<1||n>3000) || dimensions[0]*dimensions[1]>9000000)fail(400,'INVALID_PHOTO','Фото повреждено или имеет слишком большое разрешение.');
  return {...review,photo:match[2],photoType:`image/${match[1]}`};
}
export async function sha256(text) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
}

function imageDimensions(bytes,type) {
  const data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(type==='png')return [data.getUint32(16),data.getUint32(20)];
  if(type==='webp'){
    const codec=String.fromCharCode(...bytes.slice(12,16));
    if(codec==='VP8X'&&bytes.length>=30)return [1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)];
    if(codec==='VP8L'&&bytes.length>=25&&bytes[20]===47){const bits=data.getUint32(21,true);return [1+(bits&16383),1+((bits>>>14)&16383)];}
    if(codec==='VP8 '&&bytes.length>=30&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42)return [data.getUint16(26,true)&16383,data.getUint16(28,true)&16383];
    return null;
  }
  let offset=2;
  while(offset+4<bytes.length){
    if(bytes[offset]!==255)return null;
    while(bytes[offset]===255)offset++;
    const marker=bytes[offset++];
    if(marker===217||marker===218)return null;
    if(marker===1||(marker>=208&&marker<=215))continue;
    if(offset+2>bytes.length)return null;const length=data.getUint16(offset);
    if(length<2||offset+length>bytes.length)return null;
    if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return length>=7?[data.getUint16(offset+5),data.getUint16(offset+3)]:null;
    offset+=length;
  }
  return null;
}

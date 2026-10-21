import { esc } from './menu-view.js';
import { FREE_FROM } from './site-settings.js';
export const PROMOTION_INTERVAL = 6000;
export function promotionSlides(menu, lang='ru') {
  const uk = lang === 'uk';
  const money = price => `${price.toLocaleString(uk?'uk-UA':'ru-RU')} ₴`;
  const sharing = menu.find(item=>item.id==='set-start');
  const phila = menu.find(item=>item.id==='phila');
  const slides = [];
  if (sharing) slides.push({id:'sharing',theme:'sage',image:'sharing-set',eyebrow:uk?'СЕТ ДЛЯ ВАШОЇ КОМПАНІЇ':'СЕТ ДЛЯ ВАШЕЙ КОМПАНИИ',title:uk?'Ваш вечір.\nНаш сет.':'Ваш вечер.\nНаш сет.',description:`${sharing.name?.[lang] || sharing.name?.ru || sharing.name} · ${typeof sharing.pcs==='string'?sharing.pcs:sharing.pcs?.[lang]} · ${typeof sharing.weight==='string'?sharing.weight:sharing.weight?.[lang]}`,value:money(sharing.price),oldPrice:sharing.oldPrice?money(sharing.oldPrice):'',badge:sharing.oldPrice?`−${Math.round((1-sharing.price/sharing.oldPrice)*100)}%`:(uk?'Разом смачніше':'Вместе вкуснее'),href:'sets.html#product-set-start',cta:uk?'Обрати сет':'Выбрать сет'});
  if (phila) slides.push({id:'phila',theme:'peach',image:'philadelphia',eyebrow:uk?'УЛЮБЛЕНА КЛАСИКА':'ЛЮБИМАЯ КЛАССИКА',title:uk?'Більше лосося.\nБільше любові.':'Больше лосося.\nБольше любви.',description:uk?'Філадельфія класік. Ніжний сир, лосось і огірок.':'Филадельфия классик. Нежный сыр, лосось и огурец.',value:money(phila.price),oldPrice:phila.oldPrice?money(phila.oldPrice):'',badge:phila.oldPrice?`−${Math.round((1-phila.price/phila.oldPrice)*100)}%`:(uk?'Ваш фаворит':'Ваш фаворит'),href:'sushi.html#product-phila',cta:uk?'Хочу Філадельфію':'Хочу Филадельфию'});
  slides.push({id:'delivery',theme:'forest',image:'delivery',eyebrow:uk?'СМАЧНЕ ПРИЇДЕ ДО ВАС':'ВКУСНОЕ ПРИЕДЕТ К ВАМ',title:uk?'Ви обираєте.\nМи привозимо.':'Вы выбираете.\nМы привозим.',description:uk?'Готуємо після замовлення. Пакуємо з турботою.':'Готовим после заказа. Упаковываем с заботой.',value:uk?'Доставка 0 ₴':'Доставка 0 ₴',oldPrice:'',badge:uk?`від ${money(FREE_FROM)}`:`от ${money(FREE_FROM)}`,href:'sushi.html',cta:uk?'Зібрати замовлення':'Собрать заказ'});
  return slides;
}
export function slideMarkup(slide,index=0) {
  return `<article class="promo-slide promo-${slide.theme}${index===0?' is-active':''}" data-slide-id="${slide.id}" role="group" aria-roledescription="слайд" aria-label="${index+1}"${index?' hidden aria-hidden="true"':''} style="--offset:0">
    <img class="promo-art" src="assets/banners/${slide.image}.webp" alt="" width="1536" height="1024"${index?' loading="lazy"':' fetchpriority="high"'} decoding="async">
    <div class="promo-copy"><p class="promo-eyebrow">${esc(slide.eyebrow)}</p><h2 class="promo-title">${esc(slide.title).replace(/\n/g,'<br>')}</h2><p class="promo-description">${esc(slide.description)}</p>
    <div class="promo-offer"><strong>${esc(slide.value)}</strong>${slide.oldPrice?`<s>${esc(slide.oldPrice)}</s>`:''}<span class="promo-badge">${esc(slide.badge)}</span></div>
    <a class="btn btn-primary promo-cta" href="${slide.href}">${esc(slide.cta)} <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></a></div></article>`;
}
export function promotionsHtml(menu,lang='ru') { return promotionSlides(menu,lang).map(slideMarkup).join(''); }

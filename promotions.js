import { esc } from './menu-view.js';
import { FREE_FROM } from './site-settings.js';
import { DEFAULT_SLIDES } from './slides-config.js';
export const PROMOTION_INTERVAL = DEFAULT_SLIDES.intervalMs;
export function promotionSlides(menu, lang='ru', config=DEFAULT_SLIDES) {
  const text=value=>typeof value==='string'?value:(value?.[lang] || value?.ru || '');
  const money=price=>`${price.toLocaleString(lang==='uk'?'uk-UA':'ru-RU')} ₴`;
  return config.slides.filter(s=>s.enabled).flatMap(s=>{
    const product=s.mode==='product'?menu.find(item=>item.id===s.productId):null;
    if(s.mode==='product'&&!product)return [];
    const slide={...s,...Object.fromEntries(['eyebrow','title','description','value','badge','cta'].map(key=>[key,text(s[key])])),oldPrice:''};
    if(product){
      slide.value=money(product.price);
      slide.oldPrice=product.oldPrice?money(product.oldPrice):'';
      if(product.oldPrice)slide.badge=`−${Math.round((1-product.price/product.oldPrice)*100)}%`;
    }
    if(s.mode==='delivery'){
      slide.value='Доставка 0 ₴';
      slide.badge=`${lang==='uk'?'від':'от'} ${money(FREE_FROM)}`;
    }
    return [slide];
  });
}
export function slideMarkup(slide,index=0) {
  return `<article class="promo-slide promo-${slide.theme}${index===0?' is-active':''}" data-slide-id="${esc(slide.id)}" role="group" aria-roledescription="слайд" aria-label="${index+1}"${index?' hidden aria-hidden="true"':''} style="--offset:0">
    <img class="promo-art" src="${esc(slide.image)}" alt="" width="1536" height="1024"${index?' loading="lazy"':' fetchpriority="high"'} decoding="async">
    <div class="promo-copy"><p class="promo-eyebrow">${esc(slide.eyebrow)}</p><h2 class="promo-title">${esc(slide.title).replace(/\n/g,'<br>')}</h2><p class="promo-description">${esc(slide.description)}</p>
    <div class="promo-offer"><strong>${esc(slide.value)}</strong>${slide.oldPrice?`<s>${esc(slide.oldPrice)}</s>`:''}<span class="promo-badge">${esc(slide.badge)}</span></div>
    <a class="btn btn-primary promo-cta" href="${esc(slide.href)}">${esc(slide.cta)} <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></a></div></article>`;
}
export function promotionsHtml(menu,lang='ru') { return promotionSlides(menu,lang).map(slideMarkup).join(''); }

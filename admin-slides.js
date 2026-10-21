import { DEFAULT_SLIDES, validateSlides, validSlideImage } from './slides-config.js';
import { DEFAULT_MENU } from './catalog.js';
import { fetchCatalog, fetchSlides, publishSlides, slidesEndpoint } from './admin-api.js';
import { draftStore } from './draft-store.js';
import { promotionSlides } from './promotions.js';
import { esc } from './menu-view.js';

export function initSlideAdmin() {
  const $=s=>document.querySelector(s), form=$('#slide-editor'), f=name=>form.elements.namedItem(name);
  const texts=['eyebrow','title','description','value','badge','cta'];
  let config=structuredClone(DEFAULT_SLIDES), menu=DEFAULT_MENU, selected=config.slides[0]?.id, dirty=false, editing=false, busy=false, photoBusy=false, session=0, photoSequence=0;
  const endpoint=()=>slidesEndpoint($('#api').value);
  const status=(message,error=false)=>{ $('#slides-status').textContent=message;$('#slides-status').dataset.error=String(error); };
  const discard=()=>!editing||confirm('Изменения слайда не сохранены. Перейти без сохранения?');
  function controls() {
    $('#publish-slides').disabled=busy||photoBusy;
    $('#slides-load').disabled=busy;
    $('#slide-add').disabled=busy||config.slides.length>=20;
    $('#slide-editor').inert=busy;
    $('#slide-interval').disabled=busy;
  }
  function list() {
    $('#slides-count').textContent=`(${config.slides.length})`;
    $('#slides-dirty').textContent=dirty?'Есть неопубликованные изменения':'Нет изменений';
    $('#slides-list').innerHTML=config.slides.map((s,i)=>`<button type="button" class="item ${s.id===selected?'active':''}" data-slide-select="${esc(s.id)}"><img class="thumb" src="${esc(s.image)}" alt=""><span class="item-text"><strong>${i+1}. ${esc(s.title.ru.replace(/\n/g,' '))}</strong><small>${s.enabled?'Показывается':'Скрыт'} · ${s.mode==='product'?'Цена из меню':s.mode==='delivery'?'Доставка':'Свой текст'}</small></span></button>`).join('') || '<p class="empty">Слайдов пока нет. Добавьте первый.</p>';
    controls();
  }
  function current() {
    return {id:selected||`slide-${crypto.randomUUID()}`,enabled:f('enabled').checked,theme:f('theme').value,mode:f('mode').value,productId:f('productId').value,image:f('image').value.trim(),href:f('href').value.trim(),...Object.fromEntries(texts.map(k=>[k,{ru:f(k+'Ru').value,uk:f(k+'Uk').value}]))};
  }
  function preview() {
    const s=current(), product=s.mode==='product', delivery=s.mode==='delivery';
    $('#slide-product-label').hidden=!product;
    $('#slide-price-hint').hidden=!product;
    f('valueRu').disabled=f('valueUk').disabled=product||delivery;
    f('badgeRu').disabled=f('badgeUk').disabled=delivery;
    const offer=promotionSlides(menu,'ru',{slides:[{...s,enabled:true}]})[0];
    const box=$('#slide-preview');box.className=`slide-preview preview-${s.theme}`;
    box.innerHTML=offer?`${validSlideImage(s.image)?`<img src="${esc(s.image)}" alt="Предпросмотр баннера">`:''}<div><small>${esc(offer.eyebrow)}</small><h3>${esc(offer.title).replace(/\n/g,'<br>')}</h3><p>${esc(offer.description)}</p><strong>${esc(offer.value)}</strong> <s>${esc(offer.oldPrice)}</s><p>${esc(offer.badge)}</p><span class="button">${esc(offer.cta)}</span></div>`:'<p>Блюдо удалено из меню. Выберите другое — иначе слайд будет скрыт.</p>';
  }
  function products(value='') {
    f('productId').innerHTML=menu.map(p=>`<option value="${esc(p.id)}">${esc(p.name?.ru||p.name)}</option>`).join('');
    if(value&&!menu.some(p=>p.id===value))f('productId').add(new Option(`Удалённое блюдо: ${value}`,value));
    if(value)f('productId').value=value;
  }
  function select(id) {
    session++;selected=id;editing=false;form.reset();
    const s=config.slides.find(s=>s.id===id);
    products(s?.productId);
    if(s){
      for(const k of ['theme','mode','productId','image','href'])f(k).value=s[k];
      f('enabled').checked=s.enabled;
      for(const k of texts)for(const lang of ['ru','uk'])f(k+(lang==='ru'?'Ru':'Uk')).value=s[k][lang];
    } else {f('href').value='sushi.html';f('image').value='assets/banners/philadelphia.webp';}
    const at=config.slides.findIndex(s=>s.id===id);
    $('#slide-delete').hidden=!s;
    $('#slide-up').disabled=at<=0;$('#slide-down').disabled=at<0||at>=config.slides.length-1;
    preview();list();
  }
  async function saveDraft() {
    dirty=true;list();
    try {await draftStore.set(endpoint(),{config:structuredClone(config),selected});return true;}
    catch {status('Не удалось сохранить черновик на устройстве. Не закрывайте страницу и повторите сохранение.',true);return false;}
  }
  form.addEventListener('input',()=>{editing=true;preview();});
  f('mode').addEventListener('change',preview);
  f('productId').addEventListener('change',()=>{
    const p=menu.find(p=>p.id===f('productId').value);
    if(p&&f('mode').value==='product')f('href').value=`${p.cat==='sets'?'sets':p.cat==='extra'?'extras':'sushi'}.html#product-${p.id}`;
    preview();
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||photoBusy)return;
    try {
      const s=current();config=validateSlides({...config,slides:selected?config.slides.map(old=>old.id===selected?s:old):[...config.slides,s]});
      select(s.id);if(await saveDraft())status('Слайд сохранён в черновик. Нажмите «Опубликовать слайды».');
    }catch(error){status(error.message,true);}
  });
  $('#slides-list').onclick=event=>{const b=event.target.closest('[data-slide-select]');if(b&&!busy&&discard())select(b.dataset.slideSelect);};
  $('#slide-add').onclick=()=>{if(!busy&&discard())select(null);};
  $('#slide-delete').onclick=async()=>{
    if(busy||!selected||!confirm('Удалить слайд?'))return;
    config.slides=config.slides.filter(s=>s.id!==selected);select(config.slides[0]?.id||null);if(await saveDraft())status('Слайд удалён из черновика.');
  };
  async function move(delta) {
    if(busy||!discard())return;
    const i=config.slides.findIndex(s=>s.id===selected),j=i+delta;
    if(i<0||j<0||j>=config.slides.length)return;
    [config.slides[i],config.slides[j]]=[config.slides[j],config.slides[i]];select(selected);if(await saveDraft())status('Порядок сохранён в черновик.');
  }
  $('#slide-up').onclick=()=>move(-1);$('#slide-down').onclick=()=>move(1);
  $('#slide-interval').onchange=async()=>{
    const value=Number($('#slide-interval').value)*1000;
    try {config=validateSlides({...config,intervalMs:value});if(await saveDraft())status('Интервал сохранён в черновик.');}
    catch(error){$('#slide-interval').value=config.intervalMs/1000;status(error.message,true);}
  };
  $('#slide-photo').onchange=async event=>{
    const file=event.target.files[0];if(!file||busy)return;
    const stamp=session, sequence=++photoSequence;photoBusy=true;controls();
    try {
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15000000)throw new Error('Выберите JPEG, PNG или WebP до 15 МБ.');
      const bitmap=await createImageBitmap(file);
      const ratio=Math.min(1,1536/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
      canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
      let image=canvas.toDataURL('image/webp',.8);
      if(image.length>750000)image=canvas.toDataURL('image/webp',.5);
      if(!validSlideImage(image))throw new Error('Фото слишком большое. Выберите другое.');
      if(session!==stamp||sequence!==photoSequence)return;
      f('image').value=image;editing=true;preview();status('Фото готово. Сохраните слайд.');
    }catch(error){status(error.message,true);}finally{if(sequence===photoSequence){photoBusy=false;event.target.value='';controls();}}
  };
  async function load(initial=false) {
    if(busy||(!initial&&(dirty||editing)&&!confirm('Заменить черновик слайдами с сайта?')))return;
    busy=true;controls();
    try {
      const next=validateSlides(await fetchSlides($('#api').value));
      if(initial&&(dirty||editing))return;
      config=next;dirty=false;$('#slide-interval').value=config.intervalMs/1000;select(config.slides[0]?.id||null);
      await draftStore.remove(endpoint());status('Слайды загружены с сайта.');
    }catch(error){status(error.message+' Можно редактировать локальный черновик.',true);}
    finally{busy=false;controls();}
  }
  $('#slides-load').onclick=()=>load();
  $('#publish-slides').onclick=async()=>{
    if(busy||photoBusy)return;
    if(editing){status('Сначала сохраните слайд в черновик.',true);return;}
    const token=$('#token').value.trim();if(!token){$('.connection').open=true;$('#token').focus();status('Введите ключ администратора.',true);return;}
    busy=true;controls();
    try {
      const snapshot=validateSlides(config);await publishSlides($('#api').value,snapshot,token);
      dirty=false;await draftStore.remove(endpoint());list();status('Слайды опубликованы. Обновите главную страницу сайта.');
    }catch(error){status(error.message,true);}finally{busy=false;controls();}
  };
  document.querySelectorAll('[data-admin-tab]').forEach(button=>button.onclick=async()=>{
    const slideTab=button.dataset.adminTab==='slides';
    $('#catalog-panel').hidden=slideTab;$('#slides-panel').hidden=!slideTab;
    document.querySelectorAll('[data-admin-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    if(slideTab){
      try{const next=await fetchCatalog($('#api').value);if(Array.isArray(next)){menu=next;products(f('productId').value);preview();}}catch{/* bundled product choices remain available */}
    }
  });
  window.addEventListener('beforeunload',event=>{if(dirty||editing){event.preventDefault();event.returnValue='';}});
  async function start() {
    select(selected);busy=true;controls();
    try {
      const draft=await draftStore.get(endpoint());
      if(draft){config=validateSlides(draft.config);dirty=true;$('#slide-interval').value=config.intervalMs/1000;select(draft.selected||config.slides[0]?.id||null);status('Восстановлен неопубликованный черновик слайдов.');return;}
    }catch(error){status('Не удалось восстановить черновик: '+error.message,true);}
    finally{busy=false;controls();}
    await load(true);
  }
  start();
}

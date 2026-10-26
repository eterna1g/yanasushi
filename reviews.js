import { esc } from './menu-view.js';
import { apiUrl, submissionGuard } from './submission-guard.js';
import { I18N } from './locales.js';
export function initReviews(initialLang) {
  const form=document.querySelector('#review-form');if(!form)return null;
  const $=s=>document.querySelector(s),guard=submissionGuard('review');
  let lang=initialLang,items=[],cursor='',stats=null,photo='',photoBusy=false,busy=false,loading=false,id=crypto.randomUUID(),photoSequence=0,statusKey='',statusError=false;
  const t=key=>I18N[lang][key]||I18N.ru[key]||key;
  function status(key,error=false){statusKey=key;statusError=error;$('#review-status').textContent=t(key);$('#review-status').dataset.error=String(error);}
  function buttons(){form.querySelector('[type=submit]').disabled=busy||photoBusy;$('#review-photo').disabled=busy||photoBusy;$('#review-choose-photo').disabled=busy||photoBusy;$('#review-remove-photo').disabled=busy||photoBusy;$('#reviews-more').disabled=loading;}
  function countLabel(count){const plural=new Intl.PluralRules(lang==='uk'?'uk-UA':'ru-RU').select(count);const forms=lang==='uk'?{one:'відгук',few:'відгуки',many:'відгуків',other:'відгуків'}:{one:'отзыв',few:'отзыва',many:'отзывов',other:'отзывов'};return forms[plural];}
  function render() {
    if(stats)$('#reviews-summary').textContent=stats.count?`★ ${Number(stats.average).toLocaleString(lang==='uk'?'uk-UA':'ru-RU')} / 5 · ${stats.count} ${countLabel(stats.count)}`:t('reviewsNoRating');
    $('#reviews-list').innerHTML=items.map(r=>`<article class="review-card"><div class="review-card-head"><strong>${esc(r.name)}</strong><time datetime="${esc(r.createdAt)}">${esc(new Date(r.createdAt).toLocaleDateString(lang==='uk'?'uk-UA':'ru-RU',{day:'numeric',month:'long',year:'numeric'}))}</time></div><p class="review-score" aria-label="${r.rating} ${lang==='uk'?'з':'из'} 5">${'★'.repeat(r.rating)}<span aria-hidden="true">${'☆'.repeat(5-r.rating)}</span></p><p class="review-body">${esc(r.text)}</p>${r.hasPhoto?`<a class="review-image-link" href="${apiUrl(`/reviews/${r.id}/photo`)}" target="_blank" rel="noopener"><img src="${apiUrl(`/reviews/${r.id}/photo`)}" alt="${esc(t('reviewPhotoAlt'))}" loading="lazy" width="480" height="320"></a>`:''}</article>`).join('');
    $('#reviews-more').hidden=!cursor;
    if(!loading&&stats)$('#reviews-feed-status').textContent=items.length?'':t('reviewsEmpty');
    form.querySelectorAll('[name=rating]').forEach(input=>input.setAttribute('aria-label',`${input.value} ${lang==='uk'?'з':'из'} 5`));
    if(statusKey)status(statusKey,statusError);
  }
  async function load(append=false) {
    if(loading)return;loading=true;buttons();$('#reviews-feed-status').textContent=t('reviewsLoading');
    try {
      const response=await fetch(apiUrl('/reviews'+(append&&cursor?'?cursor='+encodeURIComponent(cursor):'')),{cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error('unavailable');
      const data=await response.json();
      if(!Array.isArray(data.reviews)||!data.reviews.every(r=>/^[-a-z0-9]{36}$/.test(r.id)&&Number.isInteger(r.rating)&&r.rating>=1&&r.rating<=5&&typeof r.name==='string'&&typeof r.text==='string'&&Number.isFinite(Date.parse(r.createdAt))))throw new Error('invalid');
      items=append?[...items,...data.reviews.filter(r=>!items.some(old=>old.id===r.id))]:data.reviews;cursor=data.nextCursor||'';stats=data;loading=false;render();
    }catch{$('#reviews-feed-status').textContent=t('reviewsUnavailable');}
    finally{loading=false;buttons();}
  }
  $('#reviews-more').onclick=()=>load(true);
  $('#review-choose-photo').onclick=()=>$('#review-photo').click();
  $('#review-photo').onchange=async event=>{
    const file=event.target.files[0];if(!file)return;const sequence=++photoSequence;photoBusy=true;buttons();
    try {
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10000000)throw new Error('photo');
      const bitmap=await createImageBitmap(file);const scale=Math.min(1,960/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
      let result=canvas.toDataURL('image/webp',.78);if(result.length>400000)result=canvas.toDataURL('image/webp',.45);if(result.length>400000)throw new Error('photo');
      if(sequence!==photoSequence)return;photo=result;$('#review-photo-preview').src=photo;$('#review-photo-preview').hidden=false;$('#review-remove-photo').hidden=false;status('reviewPhotoReady');
    }catch{status('reviewPhotoError',true);}finally{if(sequence===photoSequence){photoBusy=false;event.target.value='';buttons();}}
  };
  function removePhoto(){photo='';$('#review-photo-preview').hidden=true;$('#review-photo-preview').removeAttribute('src');$('#review-remove-photo').hidden=true;}
  $('#review-remove-photo').onclick=()=>{if(!busy&&!photoBusy)removePhoto();};
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||photoBusy)return;busy=true;buttons();status('reviewSending');
    try {
      const data=new FormData(form),challenge=await guard.token();
      const response=await fetch(apiUrl('/reviews'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,name:String(data.get('name')||''),text:String(data.get('text')||''),rating:Number(data.get('rating')),photo,website:String(data.get('website')||''),challenge}),signal:AbortSignal.timeout(20000)});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.ok){
        if(['CHALLENGE','FORM_TOO_FAST'].includes(result.code)){guard.reset();guard.warm();status('reviewCheckRetry',true);}
        else if(response.status===429)status('reviewRateLimit',true);
        else if(result.code==='DUPLICATE')status('reviewDuplicate',true);
        else status(response.status===400?'reviewInvalid':'reviewError',true);
        return;
      }
      form.reset();removePhoto();id=crypto.randomUUID();guard.reset();guard.warm();status('reviewSuccess');await load();
    }catch{status('reviewError',true);}finally{busy=false;buttons();}
  });
  form.hidden=false;guard.warm();load();
  return {updateLanguage(next){lang=next;render();}};
}

import {request,catalogEndpoint} from './admin-api.js';
import {esc} from './menu-view.js';
export function initReviewAdmin() {
  const $=s=>document.querySelector(s);let items=[],cursor='',busy=false;
  const url=()=>catalogEndpoint($('#api').value).replace(/\/catalog$/,'/reviews');
  const status=(text,error=false)=>{$('#admin-reviews-status').textContent=text;$('#admin-reviews-status').dataset.error=String(error);};
  function render(){
    $('#admin-reviews-list').innerHTML=items.map(r=>`<article class="admin-review"><div class="section-head"><h2>${esc(r.name)} · ${r.rating}/5 ★</h2><button class="danger" data-delete-review="${esc(r.id)}" ${busy?'disabled':''}>Удалить</button></div><small>${esc(new Date(r.createdAt).toLocaleDateString('ru-RU'))}</small><p>${esc(r.text)}</p>${r.hasPhoto?`<a href="${url()}/${r.id}/photo" target="_blank" rel="noopener"><img src="${url()}/${r.id}/photo" alt="Фото гостя" loading="lazy"></a>`:''}</article>`).join('')||'<p class="empty">Отзывов пока нет.</p>';
    $('#admin-reviews-more').hidden=!cursor;$('#admin-reviews-more').disabled=busy;$('#admin-reviews-load').disabled=busy;
  }
  async function load(append=false){
    if(busy)return;busy=true;render();status('Загрузка отзывов…');
    try{const data=await request(url()+(append&&cursor?'?cursor='+encodeURIComponent(cursor):''));if(!Array.isArray(data.reviews))throw new Error('Обновите Worker и подключите PUBLIC_DATA.');items=append?[...items,...data.reviews]:data.reviews;cursor=data.nextCursor||'';status(`Всего отзывов: ${data.count}.`);}
    catch(error){status(error.message,true);}finally{busy=false;render();}
  }
  $('#admin-reviews-list').onclick=async event=>{
    const button=event.target.closest('[data-delete-review]');if(!button||busy)return;
    const token=$('#token').value.trim();if(!token){$('.connection').open=true;$('#token').focus();status('Введите ключ администратора.',true);return;}
    if(!confirm('Удалить отзыв и прикреплённое фото?'))return;
    busy=true;render();
    try{const result=await request(url()+'/'+button.dataset.deleteReview,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});if(!result.ok)throw new Error('Удаление не подтверждено.');busy=false;await load();status('Отзыв и фото удалены.');}
    catch(error){status(error.message,true);}finally{busy=false;render();}
  };
  $('#admin-reviews-load').onclick=()=>load();$('#admin-reviews-more').onclick=()=>load(true);
  $('[data-admin-tab=reviews]').addEventListener('click',()=>load());
}

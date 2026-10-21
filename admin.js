import { ORDER_API_URL } from './site-settings.js';
import { DEFAULT_MENU, withCatalogPhotos, validateCatalog, validImage } from './catalog.js';
const $ = selector => document.querySelector(selector);
const form = $('#editor');
const field = name => form.elements.namedItem(name);
const categories = { rolls: 'Роллы', sets: 'Сеты', nigiri: 'Нигири', extra: 'Дополнительно' };
const text = value => typeof value === 'string' ? value : value?.ru || '';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let items = structuredClone(DEFAULT_MENU), selected = null, dirty = false, editing = false, busy = false, photoBusy = false;
let uploadedImage = '';
$('#api').value = ORDER_API_URL;
function status(message, error = false) { $('#status').textContent = message; $('#status').dataset.error = error; }
function markDirty() { dirty = true; $('#dirty').textContent = 'Есть неопубликованные изменения'; }
function canDiscard() { return !editing || confirm('Изменения в форме ещё не сохранены. Перейти без сохранения?'); }
function current() {
  const original = items.find(item => item.id === selected) || {};
  const name = field('nameRu').value.trim(), desc = field('descRu').value.trim();
  const category = field('cat').value;
  const item = { ...original, id: selected || `item-${crypto.randomUUID()}`, cat: category,
    kind: original.cat === category ? original.kind : ({rolls:'uramaki',sets:'set',nigiri:'nigiri',extra:'dish'}[category]),
    color: original.color || 'var(--c-salmon)', name: {ru:name,uk:field('nameUk').value.trim() || name},
    desc: {ru:desc,uk:field('descUk').value.trim() || desc}, price: Number(field('price').value),
    pcs: field('pcs').value.trim(), weight: field('weight').value.trim(), image: uploadedImage || field('image').value.trim() };
  delete item.oldPrice;
  if (field('oldPrice').value) item.oldPrice = Number(field('oldPrice').value);
  return item;
}
function preview() {
  const item = current();
  $('#preview-name').textContent = item.name.ru || 'Название блюда';
  $('#preview-desc').textContent = item.desc.ru || 'Здесь будет описание';
  $('#preview-price').textContent = `${item.price || 0} ₴`;
  const hasImage = !!item.image && validImage(item.image);
  $('#preview-image').hidden = !hasImage;
  $('#preview-placeholder').hidden = hasImage;
  if (hasImage) $('#preview-image').src = item.image; else $('#preview-image').removeAttribute('src');
}
function select(id) {
  selected = id; editing = false; uploadedImage = '';
  form.reset();
  const item = items.find(i => i.id === id);
  $('#editor-title').textContent = item ? 'Редактирование' : 'Новая позиция';
  $('#delete').hidden = !item;
  if (item) {
    const values = {nameRu:text(item.name),nameUk:item.name?.uk || '',descRu:text(item.desc),descUk:item.desc?.uk || '',cat:item.cat,price:item.price,oldPrice:item.oldPrice || '',weight:text(item.weight),pcs:text(item.pcs),image:item.image || ''};
    if (values.image.startsWith('data:')) { uploadedImage = values.image; values.image = ''; }
    for (const [key,value] of Object.entries(values)) field(key).value = value;
  }
  preview(); render();
}
function render() {
  const query = $('#search').value.toLocaleLowerCase();
  const visible = items.filter(i => (!$('#filter').value || i.cat === $('#filter').value) && `${text(i.name)} ${i.name?.uk || ''}`.toLocaleLowerCase().includes(query));
  $('#count').textContent = `(${items.length})`;
  $('#list').innerHTML = visible.map(i => `<button class="item ${selected === i.id ? 'active' : ''}" data-id="${escape(i.id)}">${i.image ? `<img class="thumb" src="${escape(i.image)}" alt="" loading="lazy">` : '<span class="thumb">🍣</span>'}<span class="item-text"><strong>${escape(text(i.name))}</strong><small>${categories[i.cat]} · ${escape(text(i.weight))}</small></span><span class="item-price">${i.price} ₴</span></button>`).join('') || '<div class="empty">Позиций пока нет. Добавьте первую.</div>';
}
form.addEventListener('input', event => { if (event.target.name === 'image') uploadedImage = ''; editing = true; preview(); });
form.addEventListener('submit', event => {
  event.preventDefault();
  if (photoBusy) { status('Дождитесь обработки фото', true); return; }
  try {
    const item = current();
    const next = selected ? items.map(i => i.id === selected ? item : i) : [...items,item];
    validateCatalog(next); items = next; markDirty(); select(item.id); status('Позиция сохранена в черновик. Нажмите «Опубликовать меню», чтобы обновить сайт.');
  } catch (error) { status(error.message,true); }
});
$('#list').addEventListener('click', event => { const button = event.target.closest('[data-id]'); if (button && canDiscard()) select(button.dataset.id); });
$('#add').onclick = () => { if (canDiscard()) { select(null); field('nameRu').focus(); } };
$('#delete').onclick = () => { if (selected && confirm('Удалить эту позицию из меню?')) { items = items.filter(i => i.id !== selected); markDirty(); select(items[0]?.id || null); status('Позиция удалена из черновика'); } };
$('#search').oninput = render; $('#filter').onchange = render;
$('#remove-photo').onclick = () => { uploadedImage = ''; field('image').value = ''; editing = true; preview(); };
$('#photo').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  photoBusy = true;
  const target = selected;
  try {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 15000000) throw new Error('Выберите JPEG, PNG или WebP до 15 МБ');
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1,1200 / Math.max(bitmap.width,bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(bitmap.width * scale)); canvas.height = Math.max(1,Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height); bitmap.close();
    let result = canvas.toDataURL('image/webp',.8);
    if (result.length > 750000) result = canvas.toDataURL('image/webp',.5);
    if (result.length > 750000) throw new Error('Фото слишком большое. Выберите изображение меньшего размера.');
    if (target !== selected) return;
    uploadedImage = result; field('image').value = ''; editing = true; preview(); status('Фото готово. Сохраните позицию.');
  } catch (error) { status(error.message,true); }
  finally { photoBusy = false; event.target.value = ''; }
};
function endpoint() {
  const url = new URL($('#api').value);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1','localhost'].includes(url.hostname))) throw new Error('Используйте HTTPS-адрес API');
  url.pathname = url.pathname.replace(/\/$/,'') + '/catalog'; url.search = ''; url.hash = ''; return url.href;
}
async function load(initial = false) {
  if (busy || (!initial && ((dirty && !confirm('Заменить неопубликованный черновик меню данными сервера?')) || !canDiscard()))) return;
  busy = true; $('#publish').disabled = true;
  try {
    const response = await fetch(endpoint(),{cache:'no-store',signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error('API каталога пока недоступен');
    const data = await response.json(); validateCatalog(data);
    if (initial && (dirty || editing)) return;
    items = withCatalogPhotos(data); dirty = false; $('#dirty').textContent = 'Нет изменений'; select(items[0]?.id || null); status('Меню загружено с сайта');
  } catch (error) { status(initial ? 'Открыто встроенное меню. Для публикации подключите обновлённый Worker в разделе «Подключение к сайту».' : error.message,true); }
  finally { busy = false; $('#publish').disabled = false; }
}
$('#load').onclick = () => load();
$('#publish').onclick = async () => {
  if (busy) return;
  if (editing) return status('Сначала сохраните позицию в черновик',true);
  if (!$('#token').value.trim()) { $('.connection').open = true; $('#token').focus(); return status('Введите ключ администратора',true); }
  busy = true; $('#publish').disabled = true;
  try {
    validateCatalog(items);
    const published = JSON.stringify(items);
    const response = await fetch(endpoint(),{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${$('#token').value.trim()}`},body:published});
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'Не удалось опубликовать меню');
    if (JSON.stringify(items) === published) { dirty = false; $('#dirty').textContent = 'Опубликовано'; }
    status('Меню опубликовано. Обновление у гостей может занять до минуты.');
  } catch (error) { status(error.message,true); }
  finally { busy = false; $('#publish').disabled = false; }
};
$('#export').onclick = () => {
  if (editing) return status('Сначала сохраните позицию в черновик',true);
  const url = URL.createObjectURL(new Blob([JSON.stringify(items,null,2)],{type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'yanasushi-menu.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
};
$('#import').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 8000000) throw new Error('Файл больше 8 МБ');
    const data = JSON.parse(await file.text()); validateCatalog(data);
    if (!canDiscard() || !confirm('Заменить черновик импортированным меню?')) return;
    items = data; markDirty(); select(items[0]?.id || null); status('Меню импортировано в черновик');
  } catch (error) { status(error.message,true); }
  finally { event.target.value = ''; }
};
window.addEventListener('beforeunload', event => { if (dirty || editing) { event.preventDefault(); event.returnValue = ''; } });
select(items[0]?.id || null);
load(true);

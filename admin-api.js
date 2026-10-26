export function catalogEndpoint(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Укажите полный HTTPS-адрес Worker.'); }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) throw new Error('Используйте HTTPS-адрес Worker.');
  if (url.username || url.password) throw new Error('Адрес Worker не должен содержать логин или пароль.');
  const path = url.pathname.replace(/\/+$/,'').replace(/\/slides$/,'');
  url.pathname = path.endsWith('/catalog') ? path : path + '/catalog';
  url.search = ''; url.hash = '';
  return url.href;
}
export async function request(url,options={}) {
  let response;
  try { response = await fetch(url,{cache:'no-store',...options,signal:AbortSignal.timeout(options.method==='PUT'?30000:10000)}); }
  catch(error) {
    if (['TimeoutError','AbortError'].includes(error.name)) throw new Error('Worker не ответил вовремя. Данные остаются в черновике; повторите публикацию позже.');
    throw new Error('Браузер не смог связаться с Worker. Проверьте адрес и CORS: нужны GET, PUT, OPTIONS и заголовки Content-Type, Authorization. Данные остаются в черновике.');
  }
  let result;
  try { result = await response.json(); }
  catch { throw new Error('Worker вернул не JSON. Проверьте адрес API и установленную версию Worker.'); }
  if (!response.ok) {
    if(result.code==='NOT_FOUND')throw new Error(result.error||'Запись уже удалена.');
    if(result.code==='NOT_CONFIGURED'&&url.includes('/reviews'))throw new Error('Обновите Worker и подключите Durable Object PUBLIC_DATA по инструкции REVIEWS_SECURITY_SETUP.md.');
    if ([404,405].includes(response.status)) throw new Error('На Worker установлена старая версия без нужного API. Обновите код Worker: маршруты /catalog и /slides должны поддерживать GET, PUT и Authorization.');
    if (response.status===401) throw new Error('Неверный ключ администратора. Проверьте ADMIN_TOKEN в секретах Worker.');
    throw new Error(result.error || `Ошибка Worker: HTTP ${response.status}. Данные остаются в черновике.`);
  }
  return result;
}
export function fetchCatalog(value) { return request(catalogEndpoint(value)); }
export async function publishCatalog(value,items,token) {
  const url=catalogEndpoint(value);
  // A simple public read diagnoses old deployments before a browser hides the PUT failure behind CORS.
  const current = await request(url);
  if (!Array.isArray(current)) throw new Error('API каталога вернул неверный формат. Обновите Worker.');
  const result=await request(url,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(items)});
  if (!result.ok) throw new Error(result.error || 'Worker не подтвердил сохранение. Данные остаются в черновике.');
  return result;
}

export function slidesEndpoint(value) { return catalogEndpoint(value).replace(/\/catalog$/,'/slides'); }
export function fetchSlides(value) { return request(slidesEndpoint(value)); }
export async function publishSlides(value,config,token) {
  const url=slidesEndpoint(value);
  const current=await request(url);
  if(!current || !Array.isArray(current.slides))throw new Error('Обновите Worker: нужен API /slides.');
  const result=await request(url,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(config)});
  if(!result.ok)throw new Error('Worker не подтвердил сохранение слайдов. Черновик сохранён.');
  return result;
}

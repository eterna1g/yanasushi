import { initCarousel } from './carousel.js';
import { contactBarHtml } from './contact-bar.js';
import { CURRENCY, DELIVERY_FEE, FREE_FROM, WORK_HOURS, ORDER_HOURS, PHONE, CONTACTS, ORDER_API_URL } from './site-settings.js';
import { I18N } from './locales.js';
import { cardHtml, SECTION_GROUPS } from './menu-view.js';
import { revealContent, addedToCart } from './motion.js';
import { DEFAULT_MENU, withCatalogPhotos, validateCatalog } from './catalog.js';



const LANG_KEY = 'yanasushi-lang';
let lang = initialLang();

function initialLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'ru' || saved === 'uk') return saved;
  } catch (e) {  }
  return (navigator.language || '').toLowerCase().startsWith('uk') ? 'uk' : 'ru';
}

function t(key, vars) {
  const configuredText = key === 'addrValue' ? CONTACTS.address : key === 'footerCity' ? CONTACTS.city[lang] : '';
  const raw = configuredText || ((I18N[lang] && I18N[lang][key]) ?? I18N.ru[key] ?? key);
  const all = Object.assign({ time: I18N[lang].time, hours: WORK_HOURS, orderHours: ORDER_HOURS, freeFrom: `${FREE_FROM} ₴` }, vars || {});
  return raw.replace(/\{(\w+)\}/g, (m, name) => (all[name] !== undefined ? all[name] : m));
}

let MENU = DEFAULT_MENU;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const money = (n) => n.toLocaleString(lang === 'uk' ? 'uk-UA' : 'ru-RU') + ' ' + CURRENCY;
const byId = (id) => MENU.find((m) => m.id === id);
// текст блюда на текущем языке (или общая строка, если она одинаковая)
const L = (v) => (typeof v === 'string' ? v : v[lang]);

const STORE_KEY = 'yanasushi-cart-v1';
let cart = loadCart();

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    const clean = {};
    for (const id in raw) {
      const q = Math.floor(Number(raw[id]));
      if (byId(id) && q > 0) clean[id] = Math.min(q, 99);
    }
    return clean;
  } catch (e) { return {}; }
}
function saveCart() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(cart)); } catch (e) {  }
}

const qtyOf = (id) => cart[id] || 0;
const cartCount = () => Object.values(cart).reduce((a, b) => a + b, 0);
const subtotal = () => Object.keys(cart).reduce((sum, id) => sum + byId(id).price * cart[id], 0);
const deliveryCost = () => (subtotal() === 0 || subtotal() >= FREE_FROM ? 0 : DELIVERY_FEE);
const total = () => subtotal() + deliveryCost();

function changeQty(id, delta) {
  const next = qtyOf(id) + delta;
  if (next <= 0) delete cart[id];
  else cart[id] = Math.min(next, 99);
  saveCart();
  refreshAll();
}
function removeItem(id) { delete cart[id]; saveCart(); refreshAll(); }

// заполняем разделы «Суши», «Сеты» и «Акции» по правилам из SECTION_GROUPS
function renderMenu() {
  for (const gridId in SECTION_GROUPS) {
    const container = $('#' + gridId);
    if (!container) continue;
    const html = SECTION_GROUPS[gridId].map((group) => {
      const items = MENU.filter(group.test);
      if (!items.length) return '';
      const heading = group.title ? `<h3 class="group-title">${esc(t(group.title))}</h3>` : '';
      return `<div class="menu-block">${heading}<div class="grid">${items.map(item => cardHtml(item, lang)).join('')}</div></div>`;
    }).join('');
    container.innerHTML = html || `<p class="catalog-empty">${lang === 'uk' ? 'У цьому розділі поки немає страв.' : 'В этом разделе пока нет блюд.'}</p>`;
  }
  refreshChips();
  revealContent();
}

// маленький значок «×2» на карточке блюда
function refreshChips() {
  $$('[data-chip]').forEach((el) => {
    const q = qtyOf(el.dataset.chip);
    el.hidden = q === 0;
    el.textContent = '×' + q;
  });
}

let view = 'cart';
let lastOrder = null;
const drawer = $('#drawer');
const overlay = $('#overlay');

function renderCart() {
  const body = $('#drawer-body');
  const foot = $('#drawer-foot');
  const title = $('#drawer-title');
  const ids = Object.keys(cart);

  if (view === 'done' && lastOrder) {
    title.textContent = t('doneTitle');
    body.innerHTML = `
      <div class="done">
        <p class="big">${t('thanks', { name: esc(lastOrder.name) })}</p>
        <p>${t('doneText', { num: lastOrder.num, sum: money(lastOrder.total) })}</p>
        <p class="demo-note" id="order-send-status" role="status">${esc(orderSendStatus)}</p>
      </div>`;
    foot.innerHTML = `
      ${orderSendStatus !== 'Заказ отправлен в обработку.' && orderSendStatus !== 'Замовлення надіслано в обробку.' ? `<button class="btn btn-primary btn-block" type="button" data-act="retry-send">Повторить отправку</button>` : ''}
      <button class="btn btn-ghost btn-block" type="button" data-act="finish">${esc(t('finishBtn'))}</button>`;
    return;
  }

  if (view === 'checkout' && ids.length) {
    title.textContent = t('checkoutTitle');
    body.innerHTML = `
      <button class="link-btn" type="button" data-act="back">${esc(t('back'))}</button>
      <form class="form" id="checkout-form">
        <div class="field">
          <label for="f-name">${esc(t('fName'))}</label>
          <input type="text" id="f-name" name="name" required autocomplete="given-name" placeholder="${esc(t('fNamePh'))}">
        </div>
        <div class="field">
          <label for="f-phone">${esc(t('fPhone'))}</label>
          <input type="tel" id="f-phone" name="phone" required minlength="7" autocomplete="tel" placeholder="+380 00 000 00 00">
        </div>
        <div class="field">
          <label for="f-address">${esc(t('fAddr'))}</label>
          <input type="text" id="f-address" name="address" required autocomplete="street-address" placeholder="${esc(t('fAddrPh'))}">
        </div>
        <fieldset class="field">
          <legend>${esc(t('fPay'))}</legend>
          <label class="radio"><input type="radio" name="pay" value="cash" checked> ${esc(t('payCash'))}</label>
          <label class="radio"><input type="radio" name="pay" value="card"> ${esc(t('payCard'))}</label>
        </fieldset>
        <div class="field">
          <label for="f-comment">${esc(t('fComment'))}</label>
          <textarea id="f-comment" name="comment" placeholder="${esc(t('fCommentPh'))}"></textarea>
        </div>
      </form>`;
    foot.innerHTML = `
      <div class="sum-row"><span>${esc(t('sumItems'))}</span><span>${money(subtotal())}</span></div>
      <div class="sum-row"><span>${esc(t('sumDelivery'))}</span><span>${deliveryCost() ? money(deliveryCost()) : esc(t('free'))}</span></div>
      <div class="sum-row sum-total"><span>${esc(t('sumTotal'))}</span><span>${money(total())}</span></div>
      <button class="btn btn-primary btn-block" type="submit" form="checkout-form">${esc(t('confirmBtn'))}</button>`;
    return;
  }

  // обычный вид корзины
  view = 'cart';
  title.textContent = t('cartTitle');
  if (!ids.length) {
    body.innerHTML = `
      <div class="empty">
        <p>${esc(t('emptyText'))}</p>
        <button class="btn btn-primary" type="button" data-act="to-menu">${esc(t('emptyBtn'))}</button>
      </div>`;
    foot.innerHTML = '';
    return;
  }

  body.innerHTML = ids.map((id) => {
    const m = byId(id);
    const q = cart[id];
    const name = L(m.name);
    return `
      <div class="line">
        <div>
          <div class="line-name">${esc(name)}</div>
          <div class="line-sub">${money(m.price)} · ${esc(L(m.pcs))}</div>
        </div>
        <div class="line-total">${money(m.price * q)}</div>
        <div class="line-controls">
          <div class="stepper">
            <button type="button" data-act="dec" data-id="${id}" aria-label="${esc(t('decAria', { name }))}">−</button>
            <span aria-live="polite">${q}</span>
            <button type="button" data-act="inc" data-id="${id}" aria-label="${esc(t('incAria', { name }))}">+</button>
          </div>
        </div>
        <button class="link-btn" type="button" data-act="remove" data-id="${id}" style="justify-self:end">${esc(t('remove'))}</button>
      </div>`;
  }).join('');

  const sub = subtotal();
  const left = FREE_FROM - sub;
  const pct = Math.min(100, Math.round((sub / FREE_FROM) * 100));
  const note = left > 0 ? t('freeLeft', { sum: money(left) }) : t('freeDone');
  foot.innerHTML = `
    <div class="bar" style="--p:${pct}%"><i></i></div>
    <p class="free-note">${esc(note)}</p>
    <div class="sum-row"><span>${esc(t('sumItems'))}</span><span>${money(sub)}</span></div>
    <div class="sum-row"><span>${esc(t('sumDelivery'))}</span><span>${deliveryCost() ? money(deliveryCost()) : esc(t('free'))}</span></div>
    <div class="sum-row sum-total"><span>${esc(t('sumTotal'))}</span><span>${money(total())}</span></div>
    <button class="btn btn-primary btn-block" type="button" data-act="checkout">${esc(t('checkoutBtn'))}</button>`;
}

function refreshBadge() { $('#cart-count').textContent = cartCount(); }

// обновляем всё сразу и возвращаем фокус на ту же кнопку (удобно с клавиатуры)
function refreshAll() {
  const a = document.activeElement;
  const act = a && a.dataset ? a.dataset.act : null;
  const id = a && a.dataset ? a.dataset.id : null;
  renderCart();
  refreshBadge();
  refreshChips();
  if (act && id && drawer.contains(a)) {
    const again = $(`#drawer [data-act="${act}"][data-id="${id}"]`) || $('#drawer-title');
    if (again) again.focus();
  }
}

let lastFocus = null;
function openCart() {
  lastFocus = document.activeElement;
  if (view === 'done') view = 'cart';
  renderCart();
  drawer.classList.add('open');
  overlay.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  document.documentElement.style.overflow = 'hidden';
  $('#drawer-title').focus();
}
function closeCart() {
  drawer.classList.remove('open');
  overlay.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  document.documentElement.style.overflow = '';
  if (view === 'done') view = 'cart';
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
function goToMenu() {
  closeCart();
  location.href = 'sushi.html';
}

function fillSettings() {
  const values = { time: t('time'), hours: WORK_HOURS, phone: PHONE, fee: money(DELIVERY_FEE), freeFrom: money(FREE_FROM) };
  $$('[data-fill]').forEach((el) => { el.textContent = values[el.dataset.fill]; });
}

function applyStaticText() {
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  $$('[data-lang]').forEach((el) => { el.setAttribute('aria-pressed', String(el.dataset.lang === lang)); });
  document.documentElement.lang = lang;
  const bar = document.querySelector('[data-contact-bar]');
  if (bar) bar.innerHTML = contactBarHtml(lang);
}

function setLang(next) {
  if (next === lang || !I18N[next]) return;
  lang = next;
  try { localStorage.setItem(LANG_KEY, lang); } catch (e) {  }

  // если человек уже заполняет форму заказа, сохраняем то, что он успел ввести
  const form = $('#checkout-form');
  const typed = form ? Object.fromEntries(new FormData(form)) : null;

  applyStaticText();
  fillSettings();
  renderMenu();
  carousel?.update(MENU,lang);
  renderCart();
  refreshBadge();

  const newForm = $('#checkout-form');
  if (typed && newForm) {
    for (const key in typed) {
      if (newForm.elements[key]) newForm.elements[key].value = typed[key];
    }
  }
}

function orderText(o) {
  const lines = [
    t('orderTitle', { num: o.num }),
    `${t('fName')}: ${o.name}`,
    `${t('fPhone')}: ${o.phone}`,
    `${t('fAddr')}: ${o.address}`,
    `${t('fPay')}: ${t(o.pay === 'card' ? 'payCard' : 'payCash')}`,
  ];
  if (o.comment) lines.push(`${t('oComment')}: ${o.comment}`);
  lines.push('');
  o.items.forEach((it) => {
    const m = byId(it.id);
    lines.push(`${L(m.name)} × ${it.qty} — ${money(m.price * it.qty)}`);
  });
  lines.push('');
  lines.push(`${t('sumItems')}: ${money(o.subtotal)}`);
  lines.push(`${t('sumDelivery')}: ${o.delivery ? money(o.delivery) : t('free')}`);
  lines.push(`${t('sumTotal')}: ${money(o.total)}`);
  return lines.join('\n');
}

// Автоматическая отправка заказа в Telegram через Cloudflare Worker.
let orderSendStatus = 'Отправляем заказ в обработку…';
let sendingOrder = false;
async function sendOrderAutomatically() {
  if (!lastOrder || sendingOrder) return;
  if (!ORDER_API_URL || ORDER_API_URL.includes('YOUR-WORKER-NAME')) {
    orderSendStatus = 'Не настроен адрес Worker. Вставьте URL в ORDER_API_URL в файле сайта.';
    renderCart();
    return;
  }
  sendingOrder = true;
  orderSendStatus = 'Отправляем заказ в обработку…';
  renderCart();
  try {
    const response = await fetch(ORDER_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: lastOrder, text: orderText(lastOrder), language: lang })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || 'Ошибка отправки');
    orderSendStatus = lang === 'uk' ? 'Замовлення надіслано в обробку.' : 'Заказ отправлен в обработку.';
  } catch (error) {
    orderSendStatus = lang === 'uk'
      ? 'Не вдалося надіслати замовлення. Перевірте інтернет і натисніть «Повторить отправку».'
      : 'Не удалось отправить заказ. Проверьте интернет и нажмите «Повторить отправку».';
  } finally {
    sendingOrder = false;
    if (view === 'done') renderCart();
  }
}

// клиент отправил заказ: очищаем корзину и закрываем панель
function finishOrder() {
  cart = {};
  saveCart();
  lastOrder = null;
  view = 'cart';
  refreshBadge();
  refreshChips();
  renderCart();
  closeCart();
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const id = el.dataset.id;
  switch (el.dataset.act) {
    case 'add': changeQty(id, 1); addedToCart(el); break;
    case 'inc': changeQty(id, 1); break;
    case 'dec': changeQty(id, -1); break;
    case 'remove': removeItem(id); break;
    case 'open-cart': openCart(); break;
    case 'close-cart': closeCart(); break;
    case 'to-menu': goToMenu(); break;
    case 'lang': setLang(el.dataset.lang); break;
    case 'retry-send': sendOrderAutomatically(); break;
    case 'finish': finishOrder(); break;
    case 'checkout':
      view = 'checkout'; renderCart(); $('#drawer-title').focus(); break;
    case 'back':
      view = 'cart'; renderCart(); $('#drawer-title').focus(); break;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && drawer.classList.contains('open')) closeCart();
});

// отправка формы оформления
drawer.addEventListener('submit', (e) => {
  if (e.target.id !== 'checkout-form') return;
  e.preventDefault();
  const data = new FormData(e.target);
  // запоминаем заказ. Корзину очищаем позже, когда клиент нажмёт «Я отправил(а) заказ»
  lastOrder = {
    num: Math.floor(1000 + Math.random() * 9000),
    name: String(data.get('name') || '').trim(),
    phone: String(data.get('phone') || '').trim(),
    address: String(data.get('address') || '').trim(),
    comment: String(data.get('comment') || '').trim(),
    pay: data.get('pay') === 'card' ? 'card' : 'cash',
    items: Object.keys(cart).map((id) => ({ id, qty: cart[id] })),
    subtotal: subtotal(),
    delivery: deliveryCost(),
    total: total(),
  };
  view = 'done';
  orderSendStatus = 'Отправляем заказ в обработку…';
  renderCart();
  $('#drawer-title').focus();
  sendOrderAutomatically();
});

const carousel = initCarousel(document.querySelector('[data-carousel]'));
carousel?.update(MENU,lang);
applyStaticText();
fillSettings();
renderMenu();
renderCart();
refreshBadge();

async function updateCatalog() {
  try {
    const response = await fetch(`${ORDER_API_URL.replace(/\/$/, '')}/catalog`, {
      cache: 'no-store', signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error('Catalog unavailable');
    const catalog = await response.json();
    validateCatalog(catalog);
    if (view !== 'cart' || drawer.classList.contains('open')) return;
    MENU = withCatalogPhotos(catalog);
    carousel?.update(MENU,lang);
    cart = loadCart();
    renderMenu();
    renderCart();
    refreshBadge();
  } catch (error) {
    console.warn('Using bundled menu:', error.message);
  }
}
updateCatalog();

import { CONTACTS, WORK_HOURS } from './site-settings.js';
import { esc } from './menu-view.js';
const paths = {
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/>',
  whatsapp: '<path d="M20.5 11.5a8.5 8.5 0 0 1-12.8 7.3L3 20l1.3-4.5a8.5 8.5 0 1 1 16.2-4Z"/><path d="M8 7.5c-.6 2.5 3.7 7.1 6.3 7.5l1.4-1.8-2.5-1.3-1 1c-1.7-.8-2.6-1.8-3.3-3.2l.8-1.2Z"/>',
  telegram: '<path d="m21 3-3.2 17-5.2-4.1-3.1 3 .6-5.1L21 3ZM3 9.5 21 3 10.1 13.8Z"/>',
  pin: '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  phone: '<path d="m7 3 3 5-2.5 2a16 16 0 0 0 6.5 6.5l2-2.5 5 3-1 4C10 22 2 14 3 4Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
function link(href, content, label, className = '') {
  const external = /^https:\/\//.test(href);
  return `<a class="${className}" href="${esc(href)}" aria-label="${esc(label)}" title="${esc(label)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${content}</a>`;
}
export function contactBarHtml(lang='ru') {
  const uk = lang === 'uk';
  const fallback = 'contacts.html';
  const social = ['instagram','whatsapp','telegram'].map(name => {
    const label = {instagram:'Instagram',whatsapp:'WhatsApp',telegram:'Telegram'}[name];
    return link(CONTACTS[name] || fallback+'#social', icon(name), CONTACTS[name] ? label : `${label} · ${uk ? 'Контакти' : 'Контакты'}`,'social-icon');
  }).join('');
  const city = CONTACTS.city[lang] || CONTACTS.city.ru;
  const address = CONTACTS.address || `${city} · ${uk ? 'доставка містом' : 'доставка по городу'}`;
  const phone = CONTACTS.phone ? link(`tel:${CONTACTS.phone.replace(/[^+\d]/g,'')}`,icon('phone')+`<span>${esc(CONTACTS.phone)}</span>`,CONTACTS.phone,'topbar-link') : link(fallback,icon('phone')+`<span>${uk ? 'Зв’язатися з нами' : 'Связаться с нами'}</span>`,uk?'Контакти':'Контакты','topbar-link');
  return `<div class="topbar-inner wrap"><div class="social-links">${social}</div><div class="topbar-details">${link(CONTACTS.mapUrl || fallback,icon('pin')+`<span>${esc(address)}</span>`,address,'topbar-link topbar-location')}<span class="topbar-hours">${icon('clock')}<span>${uk ? 'Щодня' : 'Ежедневно'} ${esc(WORK_HOURS)}</span></span>${phone}</div></div>`;
}

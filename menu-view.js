import { I18N } from './locales.js';
export const SECTION_GROUPS = {
  'grid-featured': [{ title: '', test: m => ['phila','calif','dragon','set-start'].includes(m.id) }],
  'grid-sushi': [
    { title: 'groupRolls', test: m => m.cat === 'rolls' },
    { title: 'groupNigiri', test: m => m.cat === 'nigiri' }
  ],
  'grid-sets': [{ title: '', test: m => m.cat === 'sets' }],
  'grid-promo': [
    { title: 'groupRolls', test: m => m.oldPrice && m.cat === 'rolls' },
    { title: 'groupSets', test: m => m.oldPrice && m.cat === 'sets' }
  ],
  'grid-extras': [{ title: '', test: m => m.cat === 'extra' }]
};
export const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function makiAt(cx, cy, r, fill, inverted) {
  // inverted = рис снаружи, нори внутри (ролл «наоборот»)
  const outer = inverted ? 'var(--rice)' : 'var(--nori)';
  const mid = inverted ? 'var(--nori)' : 'var(--rice)';
  const midR = inverted ? r * 0.62 : r * 0.82;
  const fillR = inverted ? r * 0.36 : r * 0.46;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" style="fill:${outer}"/>` +
         `<circle cx="${cx}" cy="${cy}" r="${midR}" style="fill:${mid}"/>` +
         `<circle cx="${cx}" cy="${cy}" r="${fillR}" style="fill:${fill}"/>`;
}

function iconFor(item) {
  const c = item.color;
  let inner = '';
  switch (item.kind) {
    case 'maki':
      inner = makiAt(50, 50, 44, c, false) + `<circle cx="50" cy="50" r="7" style="fill:var(--c-cucumber)"/>`;
      break;
    case 'uramaki':
      inner = makiAt(50, 50, 44, c, true);
      break;
    case 'nigiri':
      inner = `<rect x="14" y="48" width="72" height="28" rx="14" style="fill:var(--rice)"/>` +
              `<path d="M8 52 Q8 30 50 30 Q92 30 92 52 Q92 62 50 58 Q8 62 8 52Z" style="fill:${c}"/>` +
              `<path d="M26 42 Q50 34 74 42" fill="none" stroke="var(--rice)" stroke-width="3" stroke-linecap="round" opacity=".45"/>`;
      break;
    case 'set':
      inner = makiAt(30, 34, 22, 'var(--c-salmon)', false) +
              makiAt(70, 34, 22, 'var(--c-tuna)', true) +
              makiAt(50, 70, 22, c, false);
      break;
    case 'bowl':
      inner = `<path d="M16 48 H84 Q84 84 50 84 Q16 84 16 48Z" style="fill:var(--rice)"/>` +
              `<ellipse cx="50" cy="48" rx="34" ry="7" style="fill:${c}"/>` +
              `<path d="M38 36 Q34 28 38 20 M52 36 Q48 28 52 20 M66 36 Q62 28 66 20" fill="none" stroke="var(--muted)" stroke-width="3" stroke-linecap="round"/>`;
      break;
    case 'cup':
      inner = `<rect x="32" y="26" width="36" height="56" rx="10" style="fill:${c}"/>` +
              `<path d="M32 36 a10 10 0 0 1 10 -10 h16 a10 10 0 0 1 10 10 v4 h-36z" style="fill:var(--rice)"/>` +
              `<path d="M58 26 L68 8" fill="none" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>`;
      break;
    default: // dish
      inner = `<ellipse cx="50" cy="62" rx="38" ry="15" style="fill:var(--rice)"/>` +
              `<ellipse cx="50" cy="57" rx="20" ry="9" style="fill:${c}"/>`;
  }
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${inner}</svg>`;
}


export function cardHtml(m, lang = 'ru') {
  const L = value => typeof value === 'string' ? value : value?.[lang] || value?.ru || '';
  const money = value => value.toLocaleString(lang === 'uk' ? 'uk-UA' : 'ru-RU') + ' ₴';
  const discount = m.oldPrice ? Math.round((1 - m.price / m.oldPrice) * 100) : 0;
  const badge = discount ? `<span class="badge">−${discount}%</span>` : '';
  const old = m.oldPrice ? `<s class="old">${money(m.oldPrice)}</s>` : '';
  const image = m.image ? `<img src="${esc(m.image)}" alt="${esc(L(m.name))}" width="600" height="420" loading="lazy" decoding="async">` : iconFor(m);
  const label = I18N[lang].addAria.replace('{name}', L(m.name));
  return `<article class="card" id="product-${esc(m.id)}" data-product-id="${esc(m.id)}">
    <div class="card-art">${badge}${image}<span class="chip" data-chip="${esc(m.id)}" hidden></span></div>
    <div class="card-body"><h3>${esc(L(m.name))}</h3><p>${esc(L(m.desc))}</p>
      <div class="meta">${esc(L(m.pcs))} · ${esc(L(m.weight))}</div>
      <div class="card-foot"><span class="price">${old}<span>${money(m.price)}</span></span>
        <button class="btn btn-primary btn-sm" type="button" data-act="add" data-id="${esc(m.id)}" aria-label="${esc(label)}">${esc(I18N[lang].addBtn)}</button>
      </div>
    </div></article>`;
}

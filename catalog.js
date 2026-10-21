export const DEFAULT_MENU = [
  { id: 'phila', image: 'assets/menu/salmon-roll.webp', cat: 'rolls', kind: 'uramaki', color: 'var(--c-salmon)', price: 256, oldPrice: 320, pcs: '8 шт', weight: '230 г',
    name: { ru: 'Филадельфия классик', uk: 'Філадельфія класік' },
    desc: { ru: 'Лосось, сливочный сыр, огурец, рис', uk: 'Лосось, вершковий сир, огірок, рис' } },
  { id: 'calif', image: 'assets/menu/california.webp', cat: 'rolls', kind: 'uramaki', color: 'var(--c-shrimp)', price: 249, oldPrice: 290, pcs: '8 шт', weight: '220 г',
    name: { ru: 'Калифорния с креветкой', uk: 'Каліфорнія з креветкою' },
    desc: { ru: 'Креветка, авокадо, огурец, икра тобико', uk: 'Креветка, авокадо, огірок, ікра тобіко' } },
  { id: 'dragon', image: 'assets/menu/dragon.webp', cat: 'rolls', kind: 'uramaki', color: 'var(--c-eel)', price: 289, oldPrice: 340, pcs: '8 шт', weight: '250 г',
    name: { ru: 'Дракон', uk: 'Дракон' },
    desc: { ru: 'Угорь, авокадо, огурец, соус унаги, кунжут', uk: 'Вугор, авокадо, огірок, соус унагі, кунжут' } },
  { id: 'spicy', image: 'assets/menu/spicy-roll.webp', cat: 'rolls', kind: 'maki', color: 'var(--c-tobiko)', price: 280, pcs: '8 шт', weight: '210 г',
    name: { ru: 'Спайси лосось', uk: 'Спайсі лосось' },
    desc: { ru: 'Лосось, острый соус, огурец, нори', uk: 'Лосось, гострий соус, огірок, норі' } },
  { id: 'tuna', image: 'assets/menu/maki.webp', cat: 'rolls', kind: 'maki', color: 'var(--c-tuna)', price: 210, pcs: '6 шт', weight: '150 г',
    name: { ru: 'Маки с тунцом', uk: 'Макі з тунцем' },
    desc: { ru: 'Тунец, рис, лист нори', uk: 'Тунець, рис, лист норі' } },
  { id: 'cucumber', image: 'assets/menu/veggie-roll.webp', cat: 'rolls', kind: 'maki', color: 'var(--c-cucumber)', price: 160, pcs: '6 шт', weight: '140 г',
    name: { ru: 'Маки с огурцом', uk: 'Макі з огірком' },
    desc: { ru: 'Огурец, рис, лист нори. Без рыбы', uk: 'Огірок, рис, лист норі. Без риби' } },

  { id: 'n-salmon', image: 'assets/menu/salmon-nigiri.webp', cat: 'nigiri', kind: 'nigiri', color: 'var(--c-salmon)', price: 120, pcs: '2 шт', weight: '60 г',
    name: { ru: 'Нигири с лососем', uk: 'Нігірі з лососем' },
    desc: { ru: 'Ломтик лосося на рисе', uk: 'Скибочка лосося на рисі' } },
  { id: 'n-tuna', image: 'assets/menu/tuna-nigiri.webp', cat: 'nigiri', kind: 'nigiri', color: 'var(--c-tuna)', price: 135, pcs: '2 шт', weight: '60 г',
    name: { ru: 'Нигири с тунцом', uk: 'Нігірі з тунцем' },
    desc: { ru: 'Ломтик тунца на рисе', uk: 'Скибочка тунця на рисі' } },
  { id: 'n-eel', image: 'assets/menu/nigiri.webp', cat: 'nigiri', kind: 'nigiri', color: 'var(--c-eel)', price: 140, pcs: '2 шт', weight: '70 г',
    name: { ru: 'Нигири с угрём', uk: 'Нігірі з вугрем' },
    desc: { ru: 'Копчёный угорь, соус унаги', uk: 'Копчений вугор, соус унагі' } },
  { id: 'n-shrimp', image: 'assets/menu/nigiri.webp', cat: 'nigiri', kind: 'nigiri', color: 'var(--c-shrimp)', price: 110, pcs: '2 шт', weight: '55 г',
    name: { ru: 'Нигири с креветкой', uk: 'Нігірі з креветкою' },
    desc: { ru: 'Отварная креветка на рисе', uk: 'Варена креветка на рисі' } },

  { id: 'set-start', image: 'assets/menu/set-start.webp', cat: 'sets', kind: 'set', color: 'var(--c-salmon)', price: 749, oldPrice: 890, pcs: '24 шт', weight: '680 г',
    name: { ru: 'Сет «Старт»', uk: 'Сет «Старт»' },
    desc: { ru: 'Филадельфия, калифорния, маки с огурцом, 4 нигири', uk: 'Філадельфія, каліфорнія, макі з огірком, 4 нігірі' } },
  { id: 'set-party', image: 'assets/menu/set-party.webp', cat: 'sets', kind: 'set', color: 'var(--c-salmon)', price: 1390, oldPrice: 1650, pcs: '48 шт', weight: '1300 г',
    name: { ru: 'Сет «Компания»', uk: 'Сет «Компанія»' },
    desc: { ru: 'Пять видов роллов и нигири для 3–4 человек', uk: 'П’ять видів ролів і нігірі для 3–4 осіб' } },
  { id: 'set-veggie', image: 'assets/menu/veggie-roll.webp', cat: 'sets', kind: 'set', color: 'var(--c-cucumber)', price: 720, pcs: '24 шт', weight: '600 г',
    name: { ru: 'Сет «Вегетарианский»', uk: 'Сет «Вегетаріанський»' },
    desc: { ru: 'Роллы с огурцом, авокадо, перцем и тофу', uk: 'Роли з огірком, авокадо, перцем і тофу' } },

  { id: 'miso', image: 'assets/menu/miso.webp', cat: 'extra', kind: 'bowl', color: 'var(--c-miso)', price: 120, weight: '250 мл',
    pcs: { ru: '1 порция', uk: '1 порція' },
    name: { ru: 'Мисо-суп', uk: 'Місо-суп' },
    desc: { ru: 'Тофу, водоросли вакамэ, зелёный лук', uk: 'Тофу, водорості вакаме, зелена цибуля' } },
  { id: 'yuzu', image: 'assets/menu/citrus-drink.webp', cat: 'extra', kind: 'cup', color: 'var(--c-yuzu)', price: 85, pcs: '1 шт', weight: '330 мл',
    name: { ru: 'Лимонад юдзу', uk: 'Лимонад юдзу' },
    desc: { ru: 'Цитрусовый лимонад без сахара', uk: 'Цитрусовий лимонад без цукру' } },
  { id: 'soy', image: 'assets/menu/soy-ginger.webp', cat: 'extra', kind: 'dish', color: 'var(--c-soy)', price: 15, pcs: '1 шт', weight: '30 мл',
    name: { ru: 'Соевый соус', uk: 'Соєвий соус' },
    desc: { ru: 'Порция к заказу', uk: 'Порція до замовлення' } },
  { id: 'ginger', image: 'assets/menu/soy-ginger.webp', cat: 'extra', kind: 'dish', color: 'var(--c-ginger)', price: 20, pcs: '1 шт', weight: '30 г',
    name: { ru: 'Имбирь и васаби', uk: 'Імбир і васабі' },
    desc: { ru: 'Маринованный имбирь и васаби к заказу', uk: 'Маринований імбир і васабі до замовлення' } },
];

export function validImage(value) {
  return typeof value === 'string' && (value === '' || /^assets\/menu\/[a-z0-9-]+\.webp$/.test(value) || /^https:\/\/[^\s]+$/i.test(value) || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value));
}

export function validateCatalog(items) {
  if (!Array.isArray(items) || items.length > 200) throw new Error('Допускается до 200 позиций');
  const ids = new Set();
  const localized = (v, max, required = false) => {
    const values = typeof v === 'string' ? [v] : v && typeof v === 'object' ? [v.ru, v.uk] : [];
    return values.length > 0 && values.every(s => typeof s === 'string' && s.length <= max && (!required || s.trim().length));
  };
  for (const item of items) {
    if (!item || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || ids.has(item.id)) throw new Error('Некорректный или повторяющийся ID');
    ids.add(item.id);
    if (!['rolls','sets','nigiri','extra'].includes(item.cat) || !['maki','uramaki','nigiri','set','bowl','cup','dish'].includes(item.kind)) throw new Error('Некорректная категория');
    if (!Number.isFinite(item.price) || item.price <= 0 || item.price > 100000 || (item.oldPrice != null && (!Number.isFinite(item.oldPrice) || item.oldPrice <= item.price || item.oldPrice > 100000))) throw new Error('Проверьте цену и старую цену');
    if (!localized(item.name,150,true) || !localized(item.desc,2000) || !localized(item.pcs,80) || !localized(item.weight,80)) throw new Error('Проверьте название, описание, вес и количество');
    if (item.image != null && (!validImage(item.image) || item.image.length > 750000)) throw new Error('Фото: HTTPS-ссылка или JPEG, PNG, WebP до 550 КБ');
    if (typeof item.color !== 'string' || !/^(var\(--c-[a-z-]+\)|#[0-9a-fA-F]{6})$/.test(item.color)) throw new Error('Некорректный цвет');
  }
  if (new TextEncoder().encode(JSON.stringify(items)).length > 8000000) throw new Error('Каталог слишком большой: максимум 8 МБ');
  return items;
}

// Older saved menus did not have an image field. An explicit empty string still removes a photo.
export function withCatalogPhotos(items) {
  return items.map(item => item.image === undefined ? {
    ...item,
    image: DEFAULT_MENU.find(original => original.id === item.id)?.image || ''
  } : item);
}

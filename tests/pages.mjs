import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { DEFAULT_MENU } from '../catalog.js';
const read = name => readFileSync(new URL('../'+name,import.meta.url),'utf8');
const categories = {
  'index.html': item => ['phila','calif','dragon','set-start'].includes(item.id),
  'sushi.html': item => ['rolls','nigiri'].includes(item.cat),
  'sets.html': item => item.cat === 'sets',
  'promo.html': item => item.oldPrice && ['rolls','sets'].includes(item.cat),
  'extras.html': item => item.cat === 'extra',
  'contacts.html': () => false,
  'reviews.html': () => false
};
for (const [file,filter] of Object.entries(categories)) {
  const html = read(file);
  const ids = [...html.matchAll(/data-product-id="([^"]+)"/g)].map(match=>match[1]).sort();
  assert.deepEqual(ids,DEFAULT_MENU.filter(filter).map(item=>item.id).sort(),`Missing static products: ${file}`);
  assert.equal((html.match(/<h1\b/g)||[]).length,1,file);
  assert(!html.includes('type="module"'),`Requires browser modules: ${file}`);
  assert.match(html,/<script defer src="app.bundle.js\?v=[a-f0-9]+"><\/script>/);
  for(const link of html.matchAll(/(?:src|href)="([^"#?]+)(?:\?[^"#]*)?(?:#[^"]*)?"/g)) {
    if (/^(https?:|data:)/.test(link[1])) continue;
    assert(existsSync(new URL('../'+link[1],import.meta.url)),`Broken link ${link[1]} in ${file}`);
  }
}
console.log('Static pages PASS: every product is in its page HTML, all local links exist, classic bundle is connected');

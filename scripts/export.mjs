import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../',import.meta.url));
const output = new URL('../dist/',import.meta.url);
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const file of ['index.html','sushi.html','sets.html','promo.html','extras.html','contacts.html','reviews.html','styles.css','app.bundle.js','admin.html','admin.css','admin.bundle.js','assets']) {
  await cp(root+file,new URL(file,output),{recursive:true});
}
console.log('Public site exported to dist/');

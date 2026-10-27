import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const args=process.argv.slice(2),dryRun=args.includes('--dry-run');
const namespace=args.find(arg=>!arg.startsWith('--'))||process.env.CATALOG_NAMESPACE_ID;
if(args.some(arg=>arg.startsWith('--')&&arg!=='--dry-run')||!/^[a-f0-9]{32}$/i.test(namespace||'')||(!dryRun&&/^0+$/.test(namespace))){
  console.error('Usage: npm run deploy:worker -- <existing CATALOG KV namespace ID> [--dry-run]\nThe ID is shown in Cloudflare → Storage & databases → KV. No secret token belongs in this argument.');process.exit(1);
}
const root=fileURLToPath(new URL('../',import.meta.url)),folder=root+'.wrangler/deploy/';
await mkdir(folder,{recursive:true});
const config={name:'yellow-term-d7c1',main:root+'worker.js',compatibility_date:'2026-10-21',keep_vars:true,kv_namespaces:[{binding:'CATALOG',id:namespace}],durable_objects:{bindings:[{name:'PUBLIC_DATA',class_name:'PublicData'}]},migrations:[{tag:'public-data-v1',new_sqlite_classes:['PublicData']}],vars:{LEGACY_CHECKOUT_UNTIL:new Date(Date.now()+30*60*1000).toISOString()}};
await writeFile(folder+'worker.json',JSON.stringify(config,null,2));
console.log(dryRun?'Checking the deployment without changing Cloudflare.':'Deploying Worker with the existing CATALOG and a 30-minute checkout compatibility window. Merge the storefront PR after the health check.');
const npmCli=process.env.npm_execpath;
if(!npmCli){console.error('Run this script with npm run deploy:worker so npm can be invoked without a platform-specific shell.');process.exit(1);}
const child=spawn(process.execPath,[npmCli,'exec','--yes','--package=wrangler@4.153.0','--','wrangler','deploy','--config',folder+'worker.json',...(dryRun?['--dry-run','--outdir',folder+'bundle']:[])],{stdio:'inherit',cwd:root});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});

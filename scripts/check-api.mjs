import {ORDER_API_URL} from '../site-settings.js';
const base=ORDER_API_URL.replace(/\/$/,'');
try {
  const health=await fetch(base+'/health',{signal:AbortSignal.timeout(10000)});
  if(!health.ok)throw new Error('Health endpoint failed.');
  const data=await health.json();
  if(data.apiVersion<2||!data.publicData||!data.catalogStorage||!data.adminConfigured)throw new Error('Deploy the current Worker with PUBLIC_DATA, existing CATALOG and admin secret before publishing the new storefront.');
  const reviews=await fetch(base+'/reviews',{signal:AbortSignal.timeout(10000)});
  if(!reviews.ok||!Array.isArray((await reviews.json()).reviews))throw new Error('The reviews API is not ready.');
  console.log('Production API v2 is ready. No orders or reviews were submitted.');
}catch(error){console.error(error.message);process.exitCode=1;}

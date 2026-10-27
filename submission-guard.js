import { ORDER_API_URL } from './site-settings.js';
export const apiUrl=path=>ORDER_API_URL.replace(/\/$/,'')+path;
export function submissionGuard(purpose) {
  let pending=null,readyAt=0,expiresAt=0;
  async function load() {
    const response=await fetch(apiUrl(`/challenge?purpose=${purpose}`),{cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('FORM_UNAVAILABLE');
    const result=await response.json();
    if(typeof result.token!=='string'||!Number.isFinite(result.minWaitMs)||result.minWaitMs<0||result.minWaitMs>10000||!Number.isFinite(result.expiresInMs))throw new Error('FORM_UNAVAILABLE');
    readyAt=Date.now()+result.minWaitMs;expiresAt=Date.now()+result.expiresInMs-5000;
    return result.token;
  }
  function warm() {
    if(!pending || (expiresAt&&Date.now()>=expiresAt)){
      pending=load().catch(error=>{pending=null;throw error;});
    }
    return pending;
  }
  return {
    warm:()=>warm().catch(()=>{}),
    async token() {const token=await warm();const delay=readyAt-Date.now();if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));return token;},
    reset(){pending=null;expiresAt=0;readyAt=0;}
  };
}

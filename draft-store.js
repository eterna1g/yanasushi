let queue=Promise.resolve();
function transact(key,value,operation) {
  return new Promise((resolve,reject)=>{
    if (!globalThis.indexedDB) { reject(new Error('Автосохранение недоступно. Сохраните черновик через экспорт JSON.')); return; }
    const open=indexedDB.open('yanasushi-admin-drafts',1);
    open.onupgradeneeded=()=>open.result.createObjectStore('drafts');
    open.onerror=()=>reject(open.error);
    open.onsuccess=()=>{
      const db=open.result;
      const transaction=db.transaction('drafts',operation==='get'?'readonly':'readwrite');
      const store=transaction.objectStore('drafts');
      const request=operation==='get'?store.get(key):operation==='delete'?store.delete(key):store.put(value,key);
      transaction.oncomplete=()=>{db.close();resolve(request.result);};
      transaction.onabort=transaction.onerror=()=>{db.close();reject(transaction.error || request.error);};
    };
  });
}
function run(key,value,operation) {
  const task=queue.catch(()=>{}).then(()=>transact(key,value,operation));
  queue=task;return task;
}
export const draftStore={get:key=>run(key,null,'get'),set:(key,value)=>run(key,value,'put'),remove:key=>run(key,null,'delete')};

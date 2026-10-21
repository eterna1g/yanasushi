import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.json':'application/json'};
export async function testServer() {
  const server = createServer(async (request,response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (!pathname.startsWith('/yanasushi/')) { response.writeHead(404).end(); return; }
    const relative = decodeURIComponent(pathname.slice('/yanasushi/'.length)) || 'index.html';
    const path = resolve(root, relative);
    if (!path.startsWith(root) || relative.split('/').some(part=>part.startsWith('.'))) { response.writeHead(403).end(); return; }
    try { const bytes = await readFile(path); response.writeHead(200, {'Content-Type':types[extname(path)] || 'application/octet-stream'}).end(bytes); }
    catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  return { base:`http://127.0.0.1:${server.address().port}/yanasushi/`, close:() => new Promise(resolve => server.close(resolve)) };
}

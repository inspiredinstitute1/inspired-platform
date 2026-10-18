// Public resources only. Identity-bearing pages and private APIs are never cached.
const CACHE_NAME='inspired-public-v1';
const PUBLIC_PATHS=new Set([
 '/offline.html','/style.css','/theme.css','/portal.bundle.js',
 '/assets/logo.jpeg','/assets/notes/100-important-homophones.pdf',
 '/assets/notes/active-passive.txt','/assets/notes/elt-methods.txt',
 '/assets/notes/figures-of-speech.txt','/assets/notes/subject-verb-agreement.txt',
 '/icons/icon-192.png','/icons/icon-512.png','/icons/icon-maskable.png',
 '/icons/apple-touch-icon.png','/manifest.webmanifest',
]);
const PRIVATE_PATHS=new Set(['/signin-with-chatgpt','/signout-with-chatgpt','/callback']);
function canStore(response){return response.ok&&!/\b(?:private|no-store)\b/i.test(response.headers.get('Cache-Control')||'');}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE_NAME);
 await Promise.all([...PUBLIC_PATHS].map(async path=>{
  try{const response=await fetch(new Request(new URL(path,self.location.origin),{cache:'reload'}));if(canStore(response))await cache.put(path,response);}catch(e){}
 }));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const names=await caches.keys();
 await Promise.all(names.filter(name=>(name.startsWith('inspired-cache-')||name.startsWith('inspired-public-'))&&name!==CACHE_NAME).map(name=>caches.delete(name)));
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||PRIVATE_PATHS.has(url.pathname)||request.headers.has('Authorization'))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).catch(async()=>{
   const cache=await caches.open(CACHE_NAME);
   return await cache.match('/offline.html')||new Response('<h1>You are offline</h1><p>Reconnect to open InspirED. Reconnect to access your account.</p>',{status:503,headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'}});
  }));
  return;
 }
 if(url.search||!PUBLIC_PATHS.has(url.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME);
  try{const response=await fetch(request);if(canStore(response))await cache.put(url.pathname,response.clone());return response;}
  catch(e){return await cache.match(url.pathname)||Response.error();}
 })());
});

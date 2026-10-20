import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=(source,n)=>source+'-00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const fixture=(source,n,title='New lesson',category='ಹೊಸ ವಿಭಾಗ')=>({id:id(source,n),source,title,category,description:'Published explanation',bytes:100});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return{resolve,promise}};
const response=notes=>({ok:true,json:async()=>({notes})});
function setup(globals={}){
 const context=vm.createContext({moduleEnabled:()=>true,esc,NOTES:[{id:'original',title:'Original catalogue',category:'Grammar',description:'Original note',minutes:2}],state:{saved:[],read:[],customNotes:[]},currentFilter:'All',listQuery:'',savedOnly:false,VIDEOS:[],TESTS:[],icon:()=>'',route:()=> 'notes',intro:()=>'',empty:()=>'<p>No matching notes</p>',document:{getElementById:()=>null},render:()=>{},...globals});
 vm.runInContext(readFileSync('portal/learning-library.js','utf8'),context);vm.runInContext('const allNotes=()=>[...NOTES,...state.customNotes,...publishedLibrary];',context);
 const app=readFileSync('portal/app.js','utf8');vm.runInContext(app.slice(app.indexOf('function bookmarkButton'),app.indexOf('function homophoneCards')),context);vm.runInContext(app.slice(app.indexOf('function searchPage'),app.indexOf('function notFound')),context);
 return{context,seed(notes){context.metadata=notes;vm.runInContext('publishedLibrary=normaliseLibraryMetadata(metadata);libraryLoading=false;libraryError=false;',context)},notes(){return JSON.parse(vm.runInContext('JSON.stringify(publishedLibrary)',context))}};
}
test('original, authored and PDF notes share search/category/saved filters with correct reader destinations',()=>{
 const h=setup();h.seed([fixture('authored',1,'ಕನ್ನಡ lesson'),fixture('pdf',2,'PDF practice')]);let html=h.context.noteResults();assert.match(html,/#\/notes\/original/);assert.match(html,/#\/material\//);assert.match(html,/#\/pdf\//);assert.match(html,/STUDY NOTE · FREE/);assert.match(html,/PDF · FREE/);
 h.context.currentFilter='ಹೊಸ ವಿಭಾಗ';html=h.context.noteResults();assert(!html.includes('Original catalogue'));assert.match(html,/PDF practice/);
 h.context.currentFilter='All';h.context.listQuery='ಕನ್ನಡ';html=h.context.noteResults();assert.match(html,/ಕನ್ನಡ lesson/);assert(!html.includes('PDF practice'));
 h.context.listQuery='';h.context.savedOnly=true;h.context.state.saved=[id('pdf',2)];html=h.context.noteResults();assert.match(html,/PDF practice/);assert(!html.includes('ಕನ್ನಡ lesson'));
});
test('freeform categories, titles and excerpts cannot inject card markup or CSS class attributes',()=>{
 const h=setup();h.seed([fixture('authored',1,'<img src=x onerror=alert(1)>','bad" onmouseover="alert(1)')]);const html=h.context.noteResults();assert(!html.includes('<img'));assert(!html.includes('class="resource-art bad'));assert.match(html,/class="resource-art general"/);assert.match(html,/&lt;img/);assert.match(html,/BAD&quot;/);
});
test('global search includes newly published notes/PDFs and escapes the result labels',()=>{
 const h=setup();h.seed([fixture('authored',1,'Fresh <script>lesson</script>'),fixture('pdf',2,'Fresh PDF')]);const html=h.context.searchPage('Fresh');assert.match(html,/2 resources found/);assert.match(html,/#\/material\//);assert.match(html,/#\/pdf\//);assert(!html.includes('<script>'));assert.match(html,/&lt;script/);
});
test('newer metadata response wins and search focus/selection survives asynchronous catalogue refresh',async()=>{
 const requests=[],renders=[],focus=[],replacement={focus:options=>focus.push(options),setSelectionRange:(a,b)=>focus.push([a,b])};
 const h=setup({document:{activeElement:{id:'filter-search',selectionStart:2,selectionEnd:4},getElementById:()=>replacement},render:(...args)=>renders.push(args),fetch:(_url,options)=>{const request=deferred();requests.push({...request,options});return request.promise}});
 const first=h.context.loadLearningLibrary(),second=h.context.loadLearningLibrary();requests[1].resolve(response([fixture('pdf',2,'Newest PDF')]));await second;requests[0].resolve(response([fixture('authored',1,'Stale title')]));await first;
 assert.equal(h.notes()[0].title,'Newest PDF');assert.equal(renders.length,1);assert.deepEqual(renders[0],[true,false]);assert.deepEqual(focus[1],[2,4]);assert.equal(requests[0].options.credentials,'omit');assert.equal(requests[0].options.cache,'no-store');
});
test('failed refresh drops stale metadata, keeps original notes and exposes retry without fabricating missing titles',async()=>{
 const h=setup({fetch:async()=>({ok:false,json:async()=>({error:'Unavailable'})})});h.seed([fixture('authored',1,'Stale withdrawn title')]);await h.context.loadLearningLibrary();assert.equal(h.notes().length,0);assert.match(h.context.noteResults(),/Original catalogue/);assert.match(h.context.libraryNotice(),/Try again/);assert(!h.context.unavailableSavedNotes());
});
test('navigation into an editor while metadata is pending prevents form redraw and late metadata commit',async()=>{
 let route='notes',renders=0;const wait=deferred(),h=setup({route:()=>route,render:()=>{renders++},fetch:()=>wait.promise});const pending=h.context.loadLearningLibrary();route='admin';wait.resolve(response([fixture('pdf',1)]));await pending;assert.equal(renders,0);assert.equal(h.notes().length,0);
});
test('withdrawn saved IDs remain removable placeholders and completion history remains without withdrawn titles',()=>{
 const h=setup();h.seed([]);h.context.state.saved=[id('pdf',5)];h.context.state.read=[id('authored',6)];h.context.savedOnly=true;const html=h.context.noteResults();assert.match(html,/Saved note currently unavailable/);assert.match(html,/Remove saved note/);assert(!html.includes('No matching notes'));assert.match(h.context.hiddenReadingHistory(),/1 completed note is currently unavailable/);
});
test('PDF reader uses fresh published metadata, explicit completion and escaped title/category text',async()=>{
 const target={isConnected:true,innerHTML:''},note=fixture('pdf',2,'<img src=x>','<script>bad</script>');let options;
 const h=setup({document:{getElementById:()=>target},fetch:async(_url,opt)=>{options=opt;return{ok:true,json:async()=>({note})}}});await h.context.loadUploadedPdf(note.id);assert(!target.innerHTML.includes('<img'));assert(!target.innerHTML.includes('<script>'));assert.match(target.innerHTML,/Download PDF/);assert.match(target.innerHTML,/data-action="complete-note"/);assert.match(target.innerHTML,/data-action="bookmark"/);assert.match(target.innerHTML,/Downloading alone does not mark it complete/);assert.equal(h.context.state.read.length,0);assert.equal(options.cache,'no-store');
});

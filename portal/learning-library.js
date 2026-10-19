'use strict';
let publishedLibrary=[],libraryLoading=true,libraryError=false,libraryRequestVersion=0;
const libraryRoutes=['home','notes','search','progress'];
function noteRoute(note){return(note.source==='authored'?'material/':note.source==='pdf'?'pdf/':'notes/')+note.id;}
function noteHref(note){return '#/'+noteRoute(note);}
function noteLink(note,label,cls='button secondary'){return `<a class="${cls}" href="${esc(noteHref(note))}">${esc(label)}${icon('arrow')}</a>`;}
function noteCategoryClass(note){const category=note.category.toLowerCase();return['grammar','literature','pedagogy','vocabulary','phonology','general'].includes(category)?category:'general';}
function noteCategories(){return [...new Set(allNotes().map(note=>note.category))].sort((a,b)=>a.localeCompare(b));}
function libraryNotice(){return libraryLoading?'<p class="small muted" role="status">Loading published notes and PDFs…</p>':libraryError?'<div class="notice" role="status">New study material could not load. Existing catalogue notes are available. <button class="button secondary" type="button" data-action="refresh-library">Try again</button></div>':'';}
function normaliseLibraryMetadata(notes){
 if(!Array.isArray(notes))throw Error('Invalid library.');
 return notes.map(note=>{
  if(!['authored','pdf'].includes(note.source)||typeof note.id!=='string'||!new RegExp('^'+note.source+'-[a-f0-9-]{36}$').test(note.id)||typeof note.title!=='string'||typeof note.category!=='string'||typeof note.description!=='string')throw Error('Invalid library metadata.');
  return{id:note.id,source:note.source,title:note.title,category:note.category,description:note.description,readingLabel:note.source==='pdf'?'PDF · '+(Number(note.bytes)/1024).toFixed(1)+' KiB':'Study note',letter:note.source==='pdf'?'PDF':'N',languageLabel:'Published free material'};
 });
}
async function loadLearningLibrary(){
 const version=++libraryRequestVersion,current=route();
 try{
  const response=await fetch('/api/library',{credentials:'omit',cache:'no-store'}),data=await response.json();if(!response.ok)throw Error('Library unavailable.');
  const notes=normaliseLibraryMetadata(data.notes);if(version!==libraryRequestVersion||route()!==current)return;
  publishedLibrary=notes;libraryLoading=false;libraryError=false;
 }catch{if(version!==libraryRequestVersion||route()!==current)return;publishedLibrary=[];libraryLoading=false;libraryError=true;}
 // Preserve search focus; never redraw an Admin/faculty form or active test.
 if(!libraryRoutes.includes(route().split('/')[0]))return;
 const focused=document.activeElement,id=focused?.id,start=focused?.selectionStart,end=focused?.selectionEnd;
 render(true,false);
 if(id){const next=document.getElementById(id);next?.focus({preventScroll:true});if(typeof start==='number'&&next?.setSelectionRange)next.setSelectionRange(start,end);}
}
function unavailableSavedNotes(){
 if(libraryLoading||libraryError)return '';
 const known=new Set(allNotes().map(note=>note.id)),missing=state.saved.filter(id=>!known.has(id));
 return missing.map(id=>`<div class="notice"><p>Saved note currently unavailable. Your saved entry is retained.</p><button class="button secondary" type="button" data-action="bookmark" data-id="${esc(id)}">Remove saved note</button></div>`).join('');
}
function hiddenReadingHistory(){if(libraryLoading||libraryError)return '';const known=new Set(allNotes().map(note=>note.id)),count=state.read.filter(id=>!known.has(id)).length;return count?`<p class="small muted">${count} completed ${count===1?'note is':'notes are'} currently unavailable. Your completion history is retained.</p>`:'';}
function readingActions(note){const done=state.read.includes(note.id);return `<div class="hero-actions">${bookmarkButton(note)}<button class="button" type="button" data-action="complete-note" data-id="${esc(note.id)}" ${done?'disabled':''}>${done?'Completed':'Mark as complete'}</button></div>`;}
function uploadedPdfPage(){return '<section id="uploaded-pdf-reader" class="panel" aria-live="polite"><p>Loading PDF details…</p></section>';}
async function loadUploadedPdf(id){
 const target=document.getElementById('uploaded-pdf-reader');if(!target)return;
 try{
  const response=await fetch('/api/library?id='+encodeURIComponent(id),{credentials:'omit',cache:'no-store'}),data=await response.json();if(!response.ok||data.note?.source!=='pdf')throw Error('This PDF is unavailable or has been withdrawn.');if(!target.isConnected)return;
  const note=data.note;target.innerHTML=`<a class="text-link" href="#/notes">← Free study notes</a><p class="eyebrow">${esc(note.category)}</p><h1>${esc(note.title)}</h1><p>${(Number(note.bytes)/1024).toFixed(1)} KiB · Free PDF</p><p><a class="button" href="/api/files?id=${esc(note.id)}">Download PDF</a></p><p class="small muted">Read the downloaded document, then mark it complete here. Downloading alone does not mark it complete.</p>${readingActions(note)}`;
 }catch(error){if(target.isConnected)target.textContent=error.message;}
}

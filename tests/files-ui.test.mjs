import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {syntheticPdf} from './fixtures/pdf.mjs';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const element=()=>{const attrs=new Map();return{isConnected:true,innerHTML:'',textContent:'',getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)}};
function load(globals){const context=vm.createContext({FormData,...globals});for(const name of ['admin-ui.js','file-admin.js'])vm.runInContext(readFileSync('portal/'+name,'utf8'),context);return context;}
function uploadHarness({ok=true,size}={}){
 const file=new File([size?new Uint8Array(size):syntheticPdf()],'synthetic.pdf',{type:'application/pdf'}),fields={file:{files:[file],disabled:false},title:{value:'Draft PDF',disabled:false},category:{value:'Grammar',disabled:false},reason:{value:'Upload draft',disabled:false}},message=element(),requests=[];
 const form=Object.assign(element(),{elements:fields,querySelectorAll:()=>Object.values(fields),reset(){fields.title.value='';fields.file.files=[]}});
 const context=load({document:{getElementById:()=>message},fetch:async(_url,options)=>{assert(Object.values(fields).every(field=>field.disabled));requests.push(options);return{ok,json:async()=>ok?{id:'pdf-test',version:1}:{error:'Storage unavailable.'}}}});context.loadFileAdmin=async()=>{};context.loadResourceAdmin=async()=>{};
 return{context,form,fields,message,requests,file};
}
test('pending PDF upload still sends file and metadata, lets the browser set multipart headers and clears only after success',async()=>{
 const h=uploadHarness();await h.context.uploadStudyPdf(h.form);assert.equal(h.requests.length,1);const request=h.requests[0];assert.equal(request.headers,undefined);assert.equal(request.body.get('title'),'Draft PDF');assert.equal(request.body.get('reason'),'Upload draft');assert.deepEqual(new Uint8Array(await request.body.get('file').arrayBuffer()),syntheticPdf());assert.equal(h.fields.file.files.length,0);assert.equal(h.fields.file.disabled,false);assert.match(h.message.textContent,/private draft/);
});
test('failed/oversized PDF uploads retain selection and metadata and restore controls for retry',async()=>{
 for(const settings of [{ok:false},{size:5*1024*1024+1}]){
  const h=uploadHarness(settings);await h.context.uploadStudyPdf(h.form);assert.equal(h.fields.file.files[0],h.file);assert.equal(h.fields.title.value,'Draft PDF');assert.equal(h.fields.file.disabled,false);assert.equal(h.requests.length,settings.size?0:1);assert(h.message.textContent);
 }
});

test('PDF publication submit dispatch survives a hidden id field and sends Published metadata',async()=>{
 const fields=Object.fromEntries(Object.entries({id:'pdf-00000000-0000-4000-8000-000000000001',version:'1',title:'Synthetic published PDF',category:'Grammar',status:'published',reason:'Test publication'}).map(([key,value])=>[key,{value,disabled:false}]));
 const message=element(),form=Object.assign(element(),{id:fields.id,elements:fields,querySelectorAll:()=>Object.values(fields)});
 form.setAttribute('id','pdf-metadata-form');let submitted,pending,prevented=false;
 const context=load({document:{getElementById:()=>message,addEventListener:(type,fn)=>{if(type==='submit')submitted=fn}},fetch:async(url,options)=>{assert.equal(url,'/api/admin/files');assert.equal(options.method,'POST');const body=JSON.parse(options.body);assert.equal(body.status,'published');assert.equal(body.id,fields.id.value);assert.equal(body.version,1);return{ok:true,json:async()=>({id:body.id,version:2})};}});
 context.loadFileAdmin=async()=>{};context.loadResourceAdmin=async()=>{};
 const save=context.savePdfMetadata;context.savePdfMetadata=form=>{pending=save(form);};
 const app=readFileSync('portal/app.js','utf8');vm.runInContext(app.slice(app.indexOf("document.addEventListener('submit'"),app.indexOf('\nrender();')),context);
 submitted({target:form,preventDefault(){prevented=true}});assert(prevented);assert(pending);await pending;
 assert.equal(fields.version.value,2);assert.match(message.textContent,/Published/);assert.equal(fields.status.disabled,false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function element() {
  const attributes = new Map();
  let content = '';
  return {
    setAttribute: (key, value) => attributes.set(key, value),
    getAttribute: key => attributes.get(key) ?? null,
    removeAttribute: key => attributes.delete(key),
    get textContent() { return content; }, set textContent(value) { content = value; },
    get innerHTML() { return content; }, set innerHTML(value) { content = value; },
    replaceChildren() { content = ''; },
  };
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function load(file, globals = {}) {
  const context = vm.createContext({ AbortController, Intl, ...globals });
  vm.runInContext(readFileSync(`portal/${file}`, 'utf8'), context, { filename: file });
  return context;
}

test('pending Admin save blocks repeat submission and restores original control states', async () => {
  const context = load('admin-ui.js'), wait = deferred();
  const controls = [{ disabled: false }, { disabled: true }];
  const form = { ...element(), querySelectorAll: () => controls };
  let saves = 0;
  const first = context.withAdminForm(form, () => { saves++; return wait.promise; });
  await context.withAdminForm(form, () => { saves++; });
  assert.equal(saves, 1);
  assert.equal(form.getAttribute('aria-busy'), 'true');
  assert(controls.every(control => control.disabled));
  wait.resolve(); await first;
  assert.equal(form.getAttribute('aria-busy'), null);
  assert.deepEqual(controls.map(control => control.disabled), [false, true]);
});

test('failed Admin save restores controls and permits a later retry', async () => {
  const context = load('admin-ui.js'), control = { disabled: false };
  const form = { ...element(), querySelectorAll: () => [control] };
  await assert.rejects(context.withAdminForm(form, () => { throw Error('Synthetic network error'); }));
  assert.equal(control.disabled, false);
  let retried = false;
  await context.withAdminForm(form, () => { retried = true; });
  assert(retried);
});

function financeHarness() {
  const submit = { disabled: false }, results = element(), requests = [];
  const form = Object.assign(element(), {
    elements: { transactions: { value: '[]' } }, querySelector: () => submit,
    reset() { this.elements.transactions.value = ''; },
  });
  const context = load('finance-admin.js', {
    document: { getElementById: id => id === 'finance-preview-form' ? form : results },
    esc: value => value,
    fetch: (_url, options) => { const pending = deferred(); requests.push({ ...pending, options }); return pending.promise; },
  });
  const response = count => ({ ok: true, json: async () => ({ acceptedCount: count, duplicates: [], rejected: [], unlinkedActivationCount: 0, totals: { grossPaise: 100, feePaise: 0, netPaise: 100 }, note: 'Synthetic' }) });
  return { context, form, submit, results, requests, response };
}

test('Clear cancels preview, ignores late financial response and preserves the next preview', async () => {
  const h = financeHarness();
  const old = h.context.previewFinance(h.form);
  await h.context.previewFinance(h.form);
  assert.equal(h.requests.length, 1);
  assert(h.submit.disabled);
  h.context.clearFinancePreview();
  assert(h.requests[0].options.signal.aborted);
  assert.equal(h.results.innerHTML, '');
  assert.equal(h.submit.disabled, false);
  h.form.elements.transactions.value = '[]';
  const current = h.context.previewFinance(h.form);
  h.requests[1].resolve(h.response(2)); await current;
  const latest = h.results.innerHTML;
  assert.match(latest, /<b>2<\/b>/);
  h.requests[0].resolve(h.response(1)); await old;
  assert.equal(h.results.innerHTML, latest);
  assert.equal(h.form.getAttribute('aria-busy'), null);
});

test('finance preview rejects malformed or excessive input before any network request', async () => {
  const h = financeHarness();
  for (const input of ['broken JSON', '{}', JSON.stringify(Array(201).fill({}))]) {
    h.form.elements.transactions.value = input;
    await h.context.previewFinance(h.form);
    assert(h.results.textContent);
  }
  assert.equal(h.requests.length, 0);
  assert.equal(h.submit.disabled, false);
});

function programmeHarness(response) {
  const values = {id:'',version:'',kind:'division',parentId:'',title:'Synthetic division',description:'Description',status:'draft',sortOrder:'100',reason:'Create division'};
  const fields = Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{value,disabled:false}]));
  const form = Object.assign(element(),{elements:fields,querySelectorAll:()=>Object.values(fields)});
  const message=element(), requests=[];
  const context=load('admin-ui.js',{
    document:{getElementById:id=>id==='programme-message'?message:form},
    fetch:async(_url,options)=>{const body=JSON.parse(options.body);requests.push(body);return response(body);},
  });
  vm.runInContext(readFileSync('portal/content-admin.js','utf8'),context);
  context.loadContentAdmin=async()=>{};
  return {context,form,fields,message,requests};
}

test('programme form turns a successful create into a versioned edit instead of creating duplicates',async()=>{
  const id='00000000-0000-4000-8000-000000000001';
  const h=programmeHarness(body=>({ok:true,json:async()=>({id,version:body.version?body.version+1:1})}));
  await h.context.saveProgramme(h.form);
  assert.equal(h.fields.id.value,id);
  assert.equal(h.fields.version.value,1);
  assert.equal(h.fields.kind.disabled,true);
  h.fields.title.value='Updated division';h.fields.reason.value='Rename division';
  await h.context.saveProgramme(h.form);
  assert.equal(h.requests[1].id,id);
  assert.equal(h.requests[1].version,1);
  assert.equal(h.fields.version.value,2);
  assert.equal(h.form.getAttribute('aria-busy'),null);
});

test('programme conflict preserves the unsaved edit and restores form controls',async()=>{
  const h=programmeHarness(()=>({ok:false,status:409,json:async()=>({error:'A newer version exists. Reload before editing.'})}));
  h.fields.id.value='00000000-0000-4000-8000-000000000001';h.fields.version.value='1';h.fields.kind.disabled=true;
  await h.context.saveProgramme(h.form);
  assert.equal(h.fields.title.value,'Synthetic division');
  assert.equal(h.fields.version.value,'1');
  assert.equal(h.fields.reason.value,'Create division');
  assert.equal(h.fields.title.disabled,false);
  assert.match(h.message.textContent,/newer version/);
});

function enrolmentHarness(){
  const values={id:'',version:'',learnerId:'synthetic-student',nodeId:'00000000-0000-4000-8000-000000000001',status:'pending',startsAt:'2026-01-01T10:00:00',endsAt:'',reason:'Record website enrolment'};
  const fields=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{value,disabled:false}]));
  const form=Object.assign(element(),{elements:fields,querySelectorAll:()=>Object.values(fields)}),message=element(),requests=[];
  const context=load('admin-ui.js',{
    document:{getElementById:id=>id==='enrolment-message'?message:form},
    fetch:async(_url,options)=>{const body=JSON.parse(options.body);requests.push(body);return{ok:true,json:async()=>({id:'00000000-0000-4000-8000-000000000002',version:(body.version||0)+1})};},
  });
  vm.runInContext(readFileSync('portal/enrolment-admin.js','utf8'),context);context.loadEnrolmentAdmin=async()=>{};
  return{context,form,fields,message,requests};
}

test('enrolment form saves versioned edits without changing the selected student, programme or start',async()=>{
  const h=enrolmentHarness();await h.context.saveEnrolment(h.form);
  assert(h.fields.learnerId.disabled);assert(h.fields.nodeId.disabled);
  h.fields.status.value='active';h.fields.reason.value='Approve website enrolment';
  await h.context.saveEnrolment(h.form);
  assert.equal(h.requests[1].version,1);assert(h.requests[1].id);
  assert.equal(h.requests[1].learnerId,h.requests[0].learnerId);
  assert.equal(h.requests[1].startsAt,h.requests[0].startsAt);
  assert.equal(h.fields.version.value,2);
});

test('enrolment form rejects invalid/reversed dates before serializing them as unlimited expiry',async()=>{
  const h=enrolmentHarness();
  for(const end of ['invalid date','2025-01-01T10:00:00']){
    h.fields.endsAt.value=end;await h.context.saveEnrolment(h.form);
    assert.match(h.message.textContent,/valid dates/);
  }
  assert.equal(h.requests.length,0);assert.equal(h.fields.reason.disabled,false);
});

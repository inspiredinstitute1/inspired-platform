import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('import review explains warnings and escapes supplied topic names',()=>{const context=vm.createContext({document:{addEventListener(){}},esc:v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')});vm.runInContext(readFileSync('portal/exam-admin.js','utf8'),context);const html=context.examImportReviewHTML({questionCount:2,maximumMarks:2,labelled:1,unlabelled:1,answerPositions:[1,1,0,0],duplicatePairs:[{first:1,repeat:2,keyConflict:true}],topics:[{subject:'<script>',topic:'<img onerror=x>',questions:1}]});assert.match(html,/different answer keys/);assert.match(html,/Missing labels are never guessed/);assert.match(html,/no options are shuffled/);assert(!html.includes('<script>'));assert(!html.includes('<img onerror'));assert.match(html,/&lt;script&gt;/);assert.equal(context.examImportReviewHTML(null),'');});

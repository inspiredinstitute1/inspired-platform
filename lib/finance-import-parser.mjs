import {parseTransaction} from './finance-reconciliation.mjs';
export const IMPORT_COLUMNS=['source','externalReference','studentId','courseCode','transactionKind','grossPaise','feePaise','netPaise','paidAt'];
const required=['source','externalReference','transactionKind','grossPaise','netPaise','paidAt'];
export function csvRecords(input){
 const text=input.replace(/^\uFEFF/,'');const rows=[];let row=[],field='',quoted=false,closed=false;
 const pushField=()=>{row.push(field);field='';closed=false;};
 const pushRow=()=>{pushField();if(row.some(value=>value.trim()))rows.push(row);row=[];};
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(quoted){if(char==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=char;continue;}
  if(char===','){pushField();continue;}
  if(char==='\n'||char==='\r'){if(char==='\r'&&text[i+1]==='\n')i++;pushRow();continue;}
  if(char==='"'){if(field||closed)throw Error('Malformed CSV quotation.');quoted=true;continue;}
  if(closed)throw Error('Unexpected text after a quoted CSV field.');field+=char;
 }
 if(quoted)throw Error('Unclosed CSV quotation.');if(field||row.length||closed)pushRow();return rows;
}
export function parseImportData(format,data){
 if(format==='json'){let rows;try{rows=JSON.parse(data);}catch{throw Error('Invalid JSON.');}if(!Array.isArray(rows))throw Error('JSON must be an array of transaction rows.');return rows;}
 if(format!=='csv')throw Error('Choose normalized JSON or CSV.');
 const records=csvRecords(data);if(!records.length)throw Error('CSV needs a header and transaction rows.');const header=records.shift().map(value=>value.trim());
 if(new Set(header).size!==header.length||header.some(name=>!IMPORT_COLUMNS.includes(name))||required.some(name=>!header.includes(name)))throw Error('Use the canonical CSV columns in the template.');
 return records.map(values=>{if(values.length!==header.length)return{__invalidColumns:true};return Object.fromEntries(header.map((key,index)=>[key,values[index]]));});
}
export function canonicalSnapshot(row){
 if(!row||typeof row!=='object'||Array.isArray(row))return{};
 return Object.fromEntries(IMPORT_COLUMNS.filter(key=>Object.hasOwn(row,key)).map(key=>{const value=row[key];return[key,typeof value==='string'?value.slice(0,1000):value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)?value:'[invalid value]'];}));
}
export function normaliseImportRow(row,format){
 if(row?.__invalidColumns)throw Error('CSV column count differs from its header.');
 const value={...row};if(format==='csv'){
  for(const key of ['grossPaise','feePaise','netPaise']){if(key==='feePaise'&&(value[key]===undefined||value[key]==='')){value[key]=0;continue;}if(typeof value[key]!=='string'||!/^\d+$/.test(value[key]))throw Error('CSV amounts must be integer paise, without symbols or decimals.');value[key]=Number(value[key]);}
  if(value.studentId==='')value.studentId=null;
 }
 if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Invalid transaction row.');
 for(const key of ['source','externalReference','studentId','courseCode','transactionKind','paidAt'])if(typeof value[key]==='string'&&/[\x00-\x1f\x7f]/.test(value[key]))throw Error('Control characters are not supported in transaction fields.');
 if(value.courseCode!=null&&(typeof value.courseCode!=='string'||value.courseCode.length>100))throw Error('Course code must be text of at most 100 characters.');
 const transaction=parseTransaction(value);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(transaction.paidAt)||new Date(transaction.paidAt+'T00:00:00Z').toISOString().slice(0,10)!==transaction.paidAt)throw Error('Use a valid calendar date in YYYY-MM-DD format.');
 return transaction;
}

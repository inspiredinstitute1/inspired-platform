export const SOURCES=['appx','phonepe','upi','cash','bank','other'];
export const KINDS=['tuition','mock_test','activation','refund','adjustment','other'];
const text=(value,max=100)=>typeof value==='string'&&value.trim()&&value.length<=max?value.trim():null;
export function parseTransaction(row){
 if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Invalid transaction');
 const source=text(row.source,20),reference=text(row.externalReference,120),course=text(row.courseCode??'',100)??'';
 const kind=text(row.transactionKind,30),paidAt=text(row.paidAt,40);
 if(!SOURCES.includes(source)||!KINDS.includes(kind)||!reference||!paidAt||!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(paidAt)||!Number.isFinite(Date.parse(paidAt)))throw Error('Invalid source, reference, kind or date');
 const gross=row.grossPaise,fee=row.feePaise??0,net=row.netPaise;
 if(![gross,fee,net].every(x=>Number.isSafeInteger(x)&&x>=0)||gross<fee||gross-fee!==net)throw Error('Inconsistent transaction amounts');
 const studentId=row.studentId==null?null:text(row.studentId,150);
 if(row.studentId!=null&&!studentId)throw Error('Invalid student ID');
 return {source,externalReference:reference,studentId,courseCode:course,transactionKind:kind,grossPaise:gross,feePaise:fee,netPaise:net,paidAt};
}
export function reconcileTransactions(rows){
 const seen=new Set(),accepted=[],duplicates=[],rejected=[];
 for(const [index,row] of rows.entries()){
  try{const transaction=parseTransaction(row);const key=transaction.source+':'+transaction.externalReference;
   if(seen.has(key)){duplicates.push({index,reference:transaction.externalReference});continue;}
   seen.add(key);accepted.push(transaction);
  }catch(e){rejected.push({index,error:e.message});}
 }
 const unlinkedActivations=accepted.filter(x=>x.transactionKind==='activation');
 const totals=accepted.reduce((a,x)=>{a.grossPaise+=x.grossPaise;a.feePaise+=x.feePaise;a.netPaise+=x.netPaise;return a;},{grossPaise:0,feePaise:0,netPaise:0});
 return {accepted,duplicates,rejected,unlinkedActivations,totals,note:'Raw collection totals, not confirmed tuition revenue or profit. Match coupon activations to direct tuition before revenue reporting.'};
}

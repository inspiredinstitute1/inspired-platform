import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {roleFor} from '../../../../lib/progress-service.mjs';
import {reconcileTransactions} from '../../../../lib/finance-reconciliation.mjs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const user=await getChatGPTUser();
 const headers={'content-type':'application/json','cache-control':'private, no-store'};
 const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(roleFor(user,env)!=='Admin')return respond({error:'Admin access required.'},403);
 if(request.headers.get('origin')!==new URL(request.url).origin)return respond({error:'Invalid request origin.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return respond({error:'JSON required.'},415);
 const raw=await request.text();if(raw.length>100000)return respond({error:'Preview too large.'},413);
 let body;try{body=JSON.parse(raw);}catch{return respond({error:'Invalid JSON.'},400);}
 if(!Array.isArray(body?.transactions)||body.transactions.length>200)return respond({error:'Provide at most 200 transaction rows.'},400);
 const r=reconcileTransactions(body.transactions);
 return respond({previewOnly:true,acceptedCount:r.accepted.length,duplicates:r.duplicates,rejected:r.rejected,unlinkedActivationCount:r.unlinkedActivations.length,totals:r.totals,note:r.note});
}

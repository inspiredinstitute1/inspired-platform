import {roleFor} from './progress-service.mjs';
export const recordVersionSQL=(kind,alias='r')=>`COALESCE((SELECT MAX(version) FROM governance_audit WHERE kind='${kind}' AND record_id=${alias}.id),0)`;
export const validChange=body=>Number.isSafeInteger(body?.version)&&body.version>=0&&body.version<Number.MAX_SAFE_INTEGER&&typeof body.reason==='string'&&body.reason.trim().length>=3&&body.reason.length<=300&&!/[\u0000-\u001f\u007f]/.test(body.reason);
// D1 batch executes atomically. Context is never retained after success; a failed
// data/audit write rolls the entire batch back, including its actor/reason row.
export async function governedWrite(DB,user,reason,statement){const results=await DB.batch([DB.prepare('INSERT INTO governance_context(id,actor_id,reason,changed_at) VALUES(1,?,?,?)').bind(user.userId,reason.trim(),Date.now()),statement,DB.prepare('DELETE FROM governance_context WHERE id=1')]);return results[1];}
export async function governanceAuditEndpoint(request,user,env){
 const headers={'content-type':'application/json','cache-control':'private, no-store','vary':'Cookie, oai-authenticated-user-id','x-content-type-options':'nosniff'},json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(!user?.userId||roleFor(user,env)!=='Admin')return json({error:'Admin access required.'},403);
 if(request.method!=='GET')return json({error:'Audit history is append-only.'},405);
 try{const p=new URL(request.url).searchParams,kind=p.get('kind'),recordId=p.get('recordId'),before=p.get('before'),limit=Number(p.get('limit')||50);if(kind!==null&&!['social','group','member'].includes(kind)||recordId!==null&&(!/^\d+$/.test(recordId)||!Number.isSafeInteger(Number(recordId))||Number(recordId)<1)||before!==null&&(!/^\d+$/.test(before)||!Number.isSafeInteger(Number(before))||Number(before)<1)||!Number.isInteger(limit)||limit<1||limit>100)return json({error:'Invalid audit filter or page size.'},400);
 const clauses=[],values=[];if(kind){clauses.push('kind=?');values.push(kind);}if(recordId){clauses.push('record_id=?');values.push(Number(recordId));}if(before){clauses.push('id<?');values.push(Number(before));}const data=await env.DB.prepare(`SELECT id,kind,record_id AS recordId,version,action,actor_id AS actorId,reason,previous_json AS previousJson,next_json AS nextJson,changed_at AS changedAt FROM governance_audit ${clauses.length?'WHERE '+clauses.join(' AND '):''} ORDER BY id DESC LIMIT ?`).bind(...values,limit+1).all(),rows=data.results||[],items=rows.slice(0,limit);return json({items,nextCursor:rows.length>limit?items.at(-1).id:null});
 }catch{return json({error:'Audit history unavailable.'},503);}
}

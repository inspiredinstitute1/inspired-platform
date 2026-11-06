import {roleFor} from './progress-service.mjs';
import {recordVersionSQL,validChange,governedWrite} from './governance-service.mjs';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','vary':'Cookie, oai-authenticated-user-id','x-content-type-options':'nosniff'};
const json=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers});
const fail=(message,status=400)=>json({error:message},status);
const valid=(s,set)=>typeof s==='string'&&set.includes(s);
const platforms=['whatsapp','telegram','website'],tiers=['free','premium_course','mock_only'];
const memberStatuses=['pending','confirmed','left','review'],payments=['free','paid_active','pending_verification','expired','refund_review','mock_only','manual_exception'];
const clean=(x,n)=>typeof x==='string'&&x.trim().length>0&&x.length<=n&&!/[\u0000-\u001f\u007f]/.test(x)?x.trim():null;
export function membershipFindings(row,adminEmail){const flags=[];if(!row.learnerEmail)flags.push('account_not_matched');else if(row.learnerEmail.toLowerCase()===adminEmail?.toLowerCase())flags.push('admin_account_not_student');if(row.accessTier==='premium_course'&&row.paymentStatus==='mock_only'&&row.membershipStatus!=='left')flags.push('mock_only_excluded_from_premium_group');if(row.membershipStatus==='confirmed'&&!row.groupEnabled)flags.push('confirmed_in_disabled_group_record');if(row.membershipStatus==='review'||['pending_verification','expired','refund_review','manual_exception'].includes(row.paymentStatus))flags.push('manual_review_required');if(row.paymentStatus==='paid_active')flags.push('payment_not_independently_verified');return flags;}
export async function communityEndpoint(request,user,env){
 if(!user?.userId||roleFor(user,env)!=='Admin')return fail('Admin access required.',403);
 if(!env.DB)return fail('Database unavailable.',503);
 try{
  if(request.method==='GET'){
   const p=new URL(request.url).searchParams;
   if(p.get('action')==='learners'){const q=p.get('q')||'';if(q.length<2||q.length>80)return fail('Enter 2–80 characters to search saved Student accounts.');const {results=[]}=await env.DB.prepare("SELECT user_id AS id,display_name AS name,email FROM learner_progress WHERE lower(email)!=? AND (instr(lower(user_id),lower(?))>0 OR instr(lower(email),lower(?))>0 OR instr(lower(display_name),lower(?))>0) ORDER BY display_name,user_id LIMIT 21").bind(env.PORTAL_ADMIN_EMAIL.toLowerCase(),q,q,q).all();return json({learners:results.slice(0,20),truncated:results.length>20});}
   const groupId=p.get('groupId'),before=p.get('before'),limit=Number(p.get('limit')||100);if(groupId!==null&&(!/^\d+$/.test(groupId)||!Number.isSafeInteger(Number(groupId))||Number(groupId)<1)||before!==null&&(!/^\d+$/.test(before)||!Number.isSafeInteger(Number(before))||Number(before)<1)||!Number.isInteger(limit)||limit<1||limit>200)return fail('Invalid group/page filter.');
   const groups=await env.DB.prepare(`SELECT r.id,r.platform,r.title,r.programme,r.access_tier AS accessTier,r.enabled,r.updated_at AS updatedAt,${recordVersionSQL('group')} AS version FROM community_groups r ORDER BY r.id DESC LIMIT 501`).all();
   const clauses=[],values=[];if(groupId){clauses.push('r.group_id=?');values.push(Number(groupId));}if(before){clauses.push('r.id<?');values.push(Number(before));}
   const memberships=await env.DB.prepare(`SELECT r.id,r.group_id AS groupId,r.learner_id AS learnerId,r.membership_status AS membershipStatus,r.payment_status AS paymentStatus,r.verified_at AS verifiedAt,r.updated_at AS updatedAt,${recordVersionSQL('member')} AS version,p.display_name AS learnerName,p.email AS learnerEmail,g.access_tier AS accessTier,g.enabled AS groupEnabled FROM community_memberships r JOIN community_groups g ON g.id=r.group_id LEFT JOIN learner_progress p ON p.user_id=r.learner_id ${clauses.length?'WHERE '+clauses.join(' AND '):''} ORDER BY r.id DESC LIMIT ?`).bind(...values,limit+1).all();
   const rows=(memberships.results||[]).slice(0,limit).map(row=>({...row,findings:membershipFindings(row,env.PORTAL_ADMIN_EMAIL),independentlyVerified:false}));
   const total=await env.DB.prepare(`SELECT COUNT(*) AS n FROM community_memberships ${groupId?'WHERE group_id=?':''}`).bind(...(groupId?[Number(groupId)]:[])).first();
   return json({groups:(groups.results||[]).slice(0,500),groupsTruncated:(groups.results||[]).length>500,memberships:rows,membershipTotal:total.n,nextCursor:(memberships.results||[]).length>limit?rows.at(-1).id:null,limit,findingsScope:'loaded_page_only',providerSynced:false,verification:'unverified',note:'Record classifications only. No external roster verification, payment verification, access grant or group removal occurs.'});
  }
  if(request.method!=='POST')return fail('Method not allowed.',405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Origin not allowed.',403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return fail('JSON required.',415);
  const raw=await request.text();if(new TextEncoder().encode(raw).length>3000)return fail('Request too large.',413);let b;try{b=JSON.parse(raw);}catch{return fail('Invalid JSON.');}
  const now=Date.now();
  if(b?.action==='createGroup'||b?.action==='updateGroup'){
   const title=clean(b.title,100),programme=typeof b.programme==='string'&&b.programme.length<=100?b.programme.trim():null;if(!title||programme===null||!valid(b.platform,platforms)||!valid(b.accessTier,tiers)||!validChange(b))return fail('Choose group details, current version and change reason.');
   if(b.action==='createGroup'){if(b.version!==0)return fail('New groups start at version zero.');const r=await governedWrite(env.DB,user,b.reason,env.DB.prepare('INSERT INTO community_groups(platform,title,programme,access_tier,enabled,updated_at) VALUES(?,?,?,?,0,?)').bind(b.platform,title,programme,b.accessTier,now));return json({ok:true,id:r.meta?.last_row_id,version:1},201);}
   if(!Number.isSafeInteger(b.id)||b.id<1||b.version<1||typeof b.enabled!=='boolean')return fail('Invalid group/version.');const r=await governedWrite(env.DB,user,b.reason,env.DB.prepare(`UPDATE community_groups AS r SET platform=?,title=?,programme=?,access_tier=?,enabled=?,updated_at=? WHERE id=? AND ${recordVersionSQL('group')}=?`).bind(b.platform,title,programme,b.accessTier,b.enabled?1:0,now,b.id,b.version));return r.meta?.changes?json({ok:true,id:b.id,version:b.version+1}):fail('Group changed. Reload before editing.',409);
  }
  if(b?.action==='setGroupEnabled'){
   if(!Number.isSafeInteger(b.id)||b.id<1||typeof b.enabled!=='boolean'||!validChange(b)||b.version<1)return fail('Choose group, current version and reason.');const r=await governedWrite(env.DB,user,b.reason,env.DB.prepare(`UPDATE community_groups AS r SET enabled=?,updated_at=? WHERE id=? AND ${recordVersionSQL('group')}=?`).bind(b.enabled?1:0,now,b.id,b.version));return r.meta?.changes?json({ok:true,version:b.version+1}):fail('Group changed or is unavailable. Reload.',409);
  }
  if(b?.action==='upsertMembership'){
   const learnerId=clean(b.learnerId,150);if(!Number.isSafeInteger(b.groupId)||b.groupId<1||!learnerId||!valid(b.membershipStatus,memberStatuses)||!valid(b.paymentStatus,payments)||!validChange(b))return fail('Choose group, saved Student account, status, current version and reason.');
   if(!await env.DB.prepare('SELECT id FROM community_groups WHERE id=?').bind(b.groupId).first())return fail('Unknown group.',404);
   const existing=await env.DB.prepare('SELECT id FROM community_memberships WHERE group_id=? AND learner_id=?').bind(b.groupId,learnerId).first(),account=await env.DB.prepare('SELECT email FROM learner_progress WHERE user_id=?').bind(learnerId).first();
   if(!existing&&(!account||roleFor(account,env)==='Admin'))return fail('Choose an existing saved Student account. Legacy unmatched records are retained for review.');
   let statement;if(existing){if(b.version<1)return fail('Membership already exists. Reload before editing.',409);statement=env.DB.prepare(`UPDATE community_memberships AS r SET membership_status=?,payment_status=?,verified_at=NULL,updated_at=? WHERE id=? AND ${recordVersionSQL('member')}=?`).bind(b.membershipStatus,b.paymentStatus,now,existing.id,b.version);}else{if(b.version!==0)return fail('Membership not found at this version.',409);statement=env.DB.prepare('INSERT INTO community_memberships(group_id,learner_id,membership_status,payment_status,verified_at,updated_at) SELECT ?,user_id,?,?,NULL,? FROM learner_progress WHERE user_id=? AND lower(email)!=? ON CONFLICT(group_id,learner_id) DO NOTHING').bind(b.groupId,b.membershipStatus,b.paymentStatus,now,learnerId,env.PORTAL_ADMIN_EMAIL.toLowerCase());}
   const result=await governedWrite(env.DB,user,b.reason,statement);return result.meta?.changes?json({ok:true,version:b.version+1,verification:'unverified',providerSynced:false}):fail('Membership changed during save. Reload before editing.',409);
  }
  return fail('Unknown action.');
 }catch{return fail('Community manager unavailable. No partial change/audit is retained.',503);}
}

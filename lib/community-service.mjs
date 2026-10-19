import {roleFor} from './progress-service.mjs';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff'};
const json=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers});
const fail=(message,status=400)=>json({error:message},status);
const valid=(s,set)=>typeof s==='string'&&set.includes(s);
const platforms=['whatsapp','telegram','website'],tiers=['free','premium_course','mock_only'];
const memberStatuses=['pending','confirmed','left','review'];
const payments=['free','paid_active','pending_verification','expired','refund_review','mock_only','manual_exception'];
const clean=(x,n)=>typeof x==='string'&&x.trim().length>0&&x.length<=n?x.trim():null;
export async function communityEndpoint(request,user,env){
 if(roleFor(user,env)!=='Admin')return fail('Admin access required.',403);
 if(!env.DB)return fail('Database unavailable.',503);
 try{
  if(request.method==='GET'){
   const groups=await env.DB.prepare('SELECT id, platform, title, programme, access_tier AS accessTier, enabled, updated_at AS updatedAt FROM community_groups ORDER BY id DESC').all();
   const memberships=await env.DB.prepare('SELECT id, group_id AS groupId, learner_id AS learnerId, membership_status AS membershipStatus, payment_status AS paymentStatus, verified_at AS verifiedAt, updated_at AS updatedAt FROM community_memberships ORDER BY updated_at DESC LIMIT 500').all();
   return json({groups:groups.results||[],memberships:memberships.results||[],limit:500});
  }
  if(request.method!=='POST')return fail('Method not allowed.',405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Origin not allowed.',403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return fail('JSON required.',415);
  const raw=await request.text();if(raw.length>3000)return fail('Request too large.',413);
  let b;try{b=JSON.parse(raw);}catch{return fail('Invalid JSON.');}
  const now=Date.now();
  if(b?.action==='createGroup'){
   const title=clean(b.title,100),programme=typeof b.programme==='string'&&b.programme.length<=100?b.programme.trim():null;
   if(!title||programme===null||!valid(b.platform,platforms)||!valid(b.accessTier,tiers))return fail('Invalid group.');
   const r=await env.DB.prepare('INSERT INTO community_groups(platform,title,programme,access_tier,enabled,updated_at) VALUES(?,?,?,?,0,?)').bind(b.platform,title,programme,b.accessTier,now).run();
   return json({ok:true,id:r.meta?.last_row_id},201);
  }
  if(b?.action==='setGroupEnabled'){
   if(!Number.isSafeInteger(b.id)||b.id<1||typeof b.enabled!=='boolean')return fail('Invalid group update.');
   const r=await env.DB.prepare('UPDATE community_groups SET enabled=?,updated_at=? WHERE id=?').bind(b.enabled?1:0,now,b.id).run();
   return r.meta?.changes?json({ok:true}):fail('Unknown group.',404);
  }
  if(b?.action==='upsertMembership'){
   const learnerId=clean(b.learnerId,150);
   if(!Number.isSafeInteger(b.groupId)||b.groupId<1||!learnerId||!valid(b.membershipStatus,memberStatuses)||!valid(b.paymentStatus,payments))return fail('Invalid membership.');
   const r=await env.DB.prepare('SELECT id FROM community_groups WHERE id=?').bind(b.groupId).first();if(!r)return fail('Unknown group.',404);
   await env.DB.prepare('INSERT INTO community_memberships(group_id,learner_id,membership_status,payment_status,verified_at,updated_at) VALUES(?,?,?,?,NULL,?) ON CONFLICT(group_id,learner_id) DO UPDATE SET membership_status=excluded.membership_status,payment_status=excluded.payment_status,verified_at=NULL,updated_at=excluded.updated_at').bind(b.groupId,learnerId,b.membershipStatus,b.paymentStatus,now).run();
   return json({ok:true,verification:'Manual review required'});
  }
  return fail('Unknown action.');
 }catch{return fail('Community manager unavailable.',503);}
}

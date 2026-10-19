import assert from 'node:assert/strict';
import test from 'node:test';
import {socialLinksEndpoint} from '../lib/social-links-service.mjs';
import {communityEndpoint} from '../lib/community-service.mjs';

const owner={userId:'owner-id',email:'owner@example.org'};
const student={userId:'student-id',email:'student@example.org'};
const env={PORTAL_ADMIN_EMAIL:'owner@example.org',DB:{prepare(){throw Error('Database should not be queried during validation tests');}}};
const request=(path,method='GET',body,origin='https://inspiredinstitute.in')=>new Request('https://inspiredinstitute.in'+path,{method,headers:body===undefined?{}:{origin,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});

test('social links: block unauthenticated and student access',async()=>{
 for(const user of [null,student]){const res=await socialLinksEndpoint(request('/api/admin/social-links'),user,env);assert.equal(res.status,403);}
});
test('community: block unauthenticated and student access',async()=>{
 for(const user of [null,student]){const res=await communityEndpoint(request('/api/admin/community'),user,env);assert.equal(res.status,403);}
});
test('social links: reject cross-origin writes',async()=>{
 const res=await socialLinksEndpoint(request('/api/admin/social-links','POST',{platform:'youtube',label:'Channel',url:'https://youtube.com/example',enabled:false,sortOrder:1},'https://example.net'),owner,env);
 assert.equal(res.status,403);
});
test('social links: reject untrusted URL schemes and malformed data',async()=>{
 const base={platform:'youtube',label:'Channel',url:'https://youtube.com/example',enabled:false,sortOrder:1};
 for(const item of [{...base,url:'javascript:alert(1)'},{...base,url:'http://example.org'},{...base,sortOrder:-1},{...base,enabled:'yes'},{...base,url:'https://user:secret@example.org'}]){
  const res=await socialLinksEndpoint(request('/api/admin/social-links','POST',item),owner,env);assert.equal(res.status,400);
 }
});
test('community: reject unknown membership status before database query',async()=>{
 const res=await communityEndpoint(request('/api/admin/community','POST',{action:'upsertMembership',groupId:1,learnerId:'123',membershipStatus:'administrator',paymentStatus:'paid_active'}),owner,env);
 assert.equal(res.status,400);
});
test('community: reject unsupported group platform before database query',async()=>{
 const res=await communityEndpoint(request('/api/admin/community','POST',{action:'createGroup',title:'Test',platform:'unknown',programme:'English',accessTier:'free'}),owner,env);
 assert.equal(res.status,400);
});
test('community: reject cross-origin writes',async()=>{
 const res=await communityEndpoint(request('/api/admin/community','POST',{action:'createGroup',title:'Group',platform:'telegram',programme:'English',accessTier:'free'},'https://example.net'),owner,env);
 assert.equal(res.status,403);
});

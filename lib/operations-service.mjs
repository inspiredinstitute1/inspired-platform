import {roleFor} from './progress-service.mjs';
import catalogue from './operations-catalogue.json' with {type:'json'};
const headers={'content-type':'application/json','cache-control':'private, no-store','vary':'Cookie, oai-authenticated-user-id','x-content-type-options':'nosniff'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
export async function operationsEndpoint(request,user,env){
 if(!user?.userId||!user.email||roleFor(user,env)!=='Admin')return json({error:'Admin access required.'},403);
 if(request.method!=='GET')return json({error:'Read only. This check never migrates, restores or repairs data.'},405);
 const issues=[],missingObjects=[];let schemaReadable=false,schemaLimited=false,storageReadable=false;
 if(!env.DB)issues.push('database_binding_missing');
 else try{
  const {results=[]}=await env.DB.prepare("SELECT type,name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' LIMIT 1001").all();
  schemaReadable=true;schemaLimited=results.length>1000;if(schemaLimited)issues.push('schema_inventory_limit');
  const present=new Set(results.map(row=>row.type+':'+row.name));
  missingObjects.push(...catalogue.objects.filter(object=>!present.has(object.type+':'+object.name)));
  if(missingObjects.length)issues.push('schema_objects_missing');
 }catch{issues.push('schema_read_failed');}
 if(!env.BUCKET)issues.push('pdf_storage_binding_missing');
 else try{await env.BUCKET.head('inspired/operations/readiness-probe-not-an-application-file');storageReadable=true;}catch{issues.push('pdf_storage_read_failed');}
 const rehearsalConfigured=!!env.FINANCE_REHEARSAL_MODE||!!env.REHEARSAL_TOKEN;
 if(rehearsalConfigured)issues.push('synthetic_rehearsal_configuration_present');
 return json({scope:'application-readiness-only',checkedAt:Date.now(),checksPassed:issues.length===0,issues,
  schema:{readable:schemaReadable,limited:schemaLimited,expectedObjects:catalogue.objects.length,missingObjects,migrationFiles:catalogue.migrationCount,expectedFingerprint:catalogue.fingerprint},
  pdfStorage:{bindingPresent:!!env.BUCKET,headReadable:storageReadable,writeVerified:false,recoveryVerified:false},
  configuration:{rehearsalConfigured},verification:{providerAuthVerified:false,gatewayVerified:false,hostedCapacityVerified:false,backupVerified:false,releaseReady:false},
  note:'Read-only schema-name and storage-head checks. No data rows, secrets, migration execution, backup, provider verification or release approval.'},issues.length?503:200);
}

// Feature availability is not a role, payment entitlement or privacy boundary.
export const MODULES=[
 {key:'library',title:'Study notes and PDFs',description:'Free library, note readers and published PDF downloads.'},
 {key:'practice',title:'Practice tests',description:'New practice and unfinished test changes. Saved results remain available.'},
 {key:'videos',title:'Video classes',description:'Website video browsing. Existing external YouTube links remain external.'},
 {key:'programmes',title:'Programme discovery',description:'Published programme discovery and Student My programmes.'},
 {key:'teaching',title:'Teaching workspace',description:'Scoped faculty views and own-note proposals. Admin review remains accessible.'},
 {key:'premium',title:'APPX information',description:'Website APPX information/link presentation, not external APPX access.'}
];
export async function moduleSettings(DB){
 if(!DB)throw Error('Module settings unavailable');
 let results=[];try{({results=[]}=await DB.prepare('SELECT module_key AS key,enabled,show_navigation AS showNavigation,version FROM portal_modules ORDER BY module_key').all());}
 catch(error){if(!/no such table: (?:main\.)?portal_modules/i.test(error.message))throw error;return{persisted:false,modules:MODULES.map(module=>({...module,enabled:true,showNavigation:true,version:0}))};}
 const saved=new Map(results.map(row=>[row.key,row]));
 return{persisted:true,modules:MODULES.map(module=>{const row=saved.get(module.key);return{...module,enabled:row?!!row.enabled:false,showNavigation:row?!!row.showNavigation:false,version:row?.version||0};})};
}
export async function moduleGate(env,key){
 try{const setting=(await moduleSettings(env.DB)).modules.find(module=>module.key===key);if(setting?.enabled)return null;
 return new Response(JSON.stringify({error:'This learning section is temporarily paused.',module:key}),{status:503,headers:{'content-type':'application/json','cache-control':'private, no-store','retry-after':'60','x-content-type-options':'nosniff'}});
 }catch{return new Response(JSON.stringify({error:'Learning availability could not be checked.'}),{status:503,headers:{'content-type':'application/json','cache-control':'private, no-store'}});}
}

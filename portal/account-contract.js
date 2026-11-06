// Validate the reconciliation envelope before it can touch this tab's state.
function validAccountEnvelope(data,user){
 const p=data?.payload;
 return !!user?.id&&data?.user?.id===user.id&&data.user.role===user.role&&Number.isSafeInteger(data.version)&&data.version>=0&&!!p&&typeof p==='object'&&!Array.isArray(p)&&['read','saved','watched','attempts','customNotes'].every(key=>Array.isArray(p[key]))&&['drafts','activity'].every(key=>p[key]&&typeof p[key]==='object'&&!Array.isArray(p[key]))&&[3,4,5,6,7].includes(p.goal);
}
function accountResponseChanged(status,data,user){return status===401||data?.code==='ACCOUNT_CHANGED'||!!data?.user&&(data.user.id!==user.id||data.user.role!==user.role);}

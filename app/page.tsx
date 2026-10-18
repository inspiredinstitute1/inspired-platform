import Script from 'next/script';
import {getChatGPTUser} from './chatgpt-auth';
import {portalShell} from '../lib/portal-shell';
import {env} from 'cloudflare:workers';
import {roleFor} from '../lib/progress-service.mjs';
export const dynamic='force-dynamic';
export default async function Page(){
 const user=await getChatGPTUser();
 const identity=user?{id:user.userId,email:user.email,displayName:user.displayName,role:roleFor(user,env)}:null;
 return <><div dangerouslySetInnerHTML={{__html:portalShell}}/><script id="portal-identity" type="application/json" dangerouslySetInnerHTML={{__html:JSON.stringify(identity).replace(/</g,'\\u003c')}}/><Script src="/portal.bundle.js" strategy="afterInteractive"/></>;
}

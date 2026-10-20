import {env} from 'cloudflare:workers';
import {publicModulesEndpoint} from '../../../lib/module-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return publicModulesEndpoint(request,env);}

import {env} from 'cloudflare:workers';
import {filesEndpoint} from '../../../lib/file-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return filesEndpoint(request,null,env);}

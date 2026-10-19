import {env} from 'cloudflare:workers';
import {publicMaterialsEndpoint} from '../../../lib/material-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return publicMaterialsEndpoint(request,env);}

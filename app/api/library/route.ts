import {env} from 'cloudflare:workers';
import {libraryEndpoint} from '../../../lib/library-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return libraryEndpoint(request,env);}

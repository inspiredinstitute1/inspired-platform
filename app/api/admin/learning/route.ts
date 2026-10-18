import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {adminEndpoint} from '../../../../lib/progress-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return adminEndpoint(request,await getChatGPTUser(),env);}

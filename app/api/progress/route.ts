import {getChatGPTUser} from '../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {progressEndpoint} from '../../../lib/progress-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return progressEndpoint(request,await getChatGPTUser(),env);}
export async function PUT(request:Request){return progressEndpoint(request,await getChatGPTUser(),env);}

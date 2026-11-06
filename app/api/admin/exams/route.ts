import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {adminExamsEndpoint} from '../../../../lib/exam-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return adminExamsEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return adminExamsEndpoint(request,await getChatGPTUser(),env);}

import {getChatGPTUser} from '../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {examsEndpoint} from '../../../lib/exam-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return examsEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return examsEndpoint(request,await getChatGPTUser(),env);}

import {getChatGPTUser} from '../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {facultyEndpoint} from '../../../lib/faculty-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return facultyEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return facultyEndpoint(request,await getChatGPTUser(),env);}

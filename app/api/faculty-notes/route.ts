import {getChatGPTUser} from '../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {facultyNotesEndpoint} from '../../../lib/faculty-note-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return facultyNotesEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return facultyNotesEndpoint(request,await getChatGPTUser(),env);}

import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {adminFacultyNotesEndpoint} from '../../../../lib/faculty-note-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return adminFacultyNotesEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return adminFacultyNotesEndpoint(request,await getChatGPTUser(),env);}
export async function DELETE(request:Request){return adminFacultyNotesEndpoint(request,await getChatGPTUser(),env);}

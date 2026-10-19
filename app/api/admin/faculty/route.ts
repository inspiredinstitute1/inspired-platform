import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {adminFacultyEndpoint} from '../../../../lib/faculty-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return adminFacultyEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return adminFacultyEndpoint(request,await getChatGPTUser(),env);}
export async function DELETE(request:Request){return adminFacultyEndpoint(request,await getChatGPTUser(),env);}

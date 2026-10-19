import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {adminFilesEndpoint} from '../../../../lib/file-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return adminFilesEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return adminFilesEndpoint(request,await getChatGPTUser(),env);}
export async function DELETE(request:Request){return adminFilesEndpoint(request,await getChatGPTUser(),env);}

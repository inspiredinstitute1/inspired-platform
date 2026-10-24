import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {modulesEndpoint} from '../../../../lib/module-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return modulesEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return modulesEndpoint(request,await getChatGPTUser(),env);}
export async function DELETE(request:Request){return modulesEndpoint(request,await getChatGPTUser(),env);}

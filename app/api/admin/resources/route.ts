import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {resourceEndpoint} from '../../../../lib/resource-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return resourceEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return resourceEndpoint(request,await getChatGPTUser(),env);}
export async function DELETE(request:Request){return resourceEndpoint(request,await getChatGPTUser(),env);}

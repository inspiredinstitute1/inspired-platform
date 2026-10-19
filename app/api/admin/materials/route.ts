import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {materialEndpoint} from '../../../../lib/material-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return materialEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return materialEndpoint(request,await getChatGPTUser(),env);}
export async function DELETE(request:Request){return materialEndpoint(request,await getChatGPTUser(),env);}

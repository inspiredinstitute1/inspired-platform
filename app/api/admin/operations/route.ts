import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {operationsEndpoint} from '../../../../lib/operations-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return operationsEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return operationsEndpoint(request,await getChatGPTUser(),env);}
export async function DELETE(request:Request){return operationsEndpoint(request,await getChatGPTUser(),env);}

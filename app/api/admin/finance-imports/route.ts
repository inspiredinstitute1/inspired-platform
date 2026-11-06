import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {financeImportsEndpoint} from '../../../../lib/finance-import-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return financeImportsEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return financeImportsEndpoint(request,await getChatGPTUser(),env);}
export async function DELETE(request:Request){return financeImportsEndpoint(request,await getChatGPTUser(),env);}

import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {financeApprovalsEndpoint} from '../../../../lib/finance-approval-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return financeApprovalsEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return financeApprovalsEndpoint(request,await getChatGPTUser(),env);}
export async function DELETE(request:Request){return financeApprovalsEndpoint(request,await getChatGPTUser(),env);}

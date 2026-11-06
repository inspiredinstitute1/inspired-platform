import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {financeVerificationEndpoint} from '../../../../lib/finance-verification-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return financeVerificationEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return financeVerificationEndpoint(request,await getChatGPTUser(),env);}
export async function DELETE(request:Request){return financeVerificationEndpoint(request,await getChatGPTUser(),env);}

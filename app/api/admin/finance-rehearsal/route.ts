import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {financeRehearsalEndpoint} from '../../../../lib/finance-rehearsal-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return financeRehearsalEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return financeRehearsalEndpoint(request,await getChatGPTUser(),env);}
export async function DELETE(request:Request){return financeRehearsalEndpoint(request,await getChatGPTUser(),env);}

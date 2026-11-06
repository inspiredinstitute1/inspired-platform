import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {financeEvidenceEndpoint} from '../../../../lib/finance-evidence-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return financeEvidenceEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return financeEvidenceEndpoint(request,await getChatGPTUser(),env);}
export async function DELETE(request:Request){return financeEvidenceEndpoint(request,await getChatGPTUser(),env);}

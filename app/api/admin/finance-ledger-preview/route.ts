import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {financeLedgerPreviewEndpoint} from '../../../../lib/finance-ledger-preview-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return financeLedgerPreviewEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return financeLedgerPreviewEndpoint(request,await getChatGPTUser(),env);}
export async function DELETE(request:Request){return financeLedgerPreviewEndpoint(request,await getChatGPTUser(),env);}

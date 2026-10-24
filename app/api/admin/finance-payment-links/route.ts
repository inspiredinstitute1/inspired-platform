import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {financePaymentLinksEndpoint} from '../../../../lib/finance-payment-links-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return financePaymentLinksEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return financePaymentLinksEndpoint(request,await getChatGPTUser(),env);}
export async function DELETE(request:Request){return financePaymentLinksEndpoint(request,await getChatGPTUser(),env);}

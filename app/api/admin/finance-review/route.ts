import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {financeReviewEndpoint} from '../../../../lib/finance-review-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return financeReviewEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return financeReviewEndpoint(request,await getChatGPTUser(),env);}
export async function DELETE(request:Request){return financeReviewEndpoint(request,await getChatGPTUser(),env);}

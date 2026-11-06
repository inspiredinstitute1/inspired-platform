import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {examAnalyticsEndpoint} from '../../../../lib/exam-analytics.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return examAnalyticsEndpoint(request,await getChatGPTUser(),env);}

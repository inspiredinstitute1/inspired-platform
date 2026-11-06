import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {adminEnrolmentEndpoint} from '../../../../lib/enrolment-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return adminEnrolmentEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return adminEnrolmentEndpoint(request,await getChatGPTUser(),env);}
export async function DELETE(request:Request){return adminEnrolmentEndpoint(request,await getChatGPTUser(),env);}

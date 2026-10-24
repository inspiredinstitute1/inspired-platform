import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {governanceAuditEndpoint} from '../../../../lib/governance-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return governanceAuditEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return governanceAuditEndpoint(request,await getChatGPTUser(),env);}
export async function DELETE(request:Request){return governanceAuditEndpoint(request,await getChatGPTUser(),env);}

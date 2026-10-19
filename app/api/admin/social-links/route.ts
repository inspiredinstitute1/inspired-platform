import {getChatGPTUser} from '../../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {socialLinksEndpoint} from '../../../../lib/social-links-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return socialLinksEndpoint(request,await getChatGPTUser(),env);}
export async function POST(request:Request){return socialLinksEndpoint(request,await getChatGPTUser(),env);}
export async function DELETE(request:Request){return socialLinksEndpoint(request,await getChatGPTUser(),env);}

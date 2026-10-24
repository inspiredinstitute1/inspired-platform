import {env} from 'cloudflare:workers';
import {publicSocialLinksEndpoint} from '../../../lib/social-links-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return publicSocialLinksEndpoint(request,env);}

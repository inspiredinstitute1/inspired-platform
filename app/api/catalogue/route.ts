import { env } from 'cloudflare:workers';
import { catalogueEndpoint } from '../../../lib/content-service.mjs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return catalogueEndpoint(request, env); }

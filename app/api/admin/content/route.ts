import { getChatGPTUser } from '../../../chatgpt-auth';
import { env } from 'cloudflare:workers';
import { contentEndpoint } from '../../../../lib/content-service.mjs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return contentEndpoint(request, await getChatGPTUser(), env); }
export async function POST(request: Request) { return contentEndpoint(request, await getChatGPTUser(), env); }
export async function DELETE(request: Request) { return contentEndpoint(request, await getChatGPTUser(), env); }

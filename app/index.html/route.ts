// Keep links saved from the previous GitHub Pages website usable.
export function GET(request: Request) {
  const destination = new URL(request.url);
  destination.pathname = '/';
  return new Response(null, {
    status: 308,
    headers: { Location: destination.href, 'Cache-Control': 'no-store' },
  });
}

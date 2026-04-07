export const onRequestGet = async () => {
  return Response.json({
    ok: true,
    service: 'photorestore',
    runtime: 'cloudflare-pages-functions',
  });
};

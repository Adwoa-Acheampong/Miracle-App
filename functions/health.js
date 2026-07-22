import { json } from './_lib/common.js';

export async function onRequestGet({ env }) {
  return json({
    ok: true,
    service: 'miracle-cloudflare',
    build: env.CF_PAGES_COMMIT_SHA || env.BUILD_TOKEN || 'cloudflare',
  });
}

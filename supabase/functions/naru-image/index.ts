// Naru 102호 이미지 중계 (한 번 쓰는 도구용 Edge Function)
//
// 앱의 /tools/naru-import 화면이 브라우저에서 Naru 그림을 직접 받지 못해서(브라우저 요청이 막힘),
// 이 함수가 서버에서 Naru 그림을 받아 앱에 넘겨 준다.
//
// 막아 둔 것
//  - 로그인한 사용자만 (verify_jwt = true → Supabase 가 로그인 토큰을 확인)
//  - https://ding-dong.naru.pub/102/ 아래의 img/ · full/ 그림 파일만 (경로 허용 목록, .. 금지)
//  - 그림(image/*)만, 15MB 이하만
//  - 우리 앱 주소에서 온 요청에만 CORS 허용
// 가져오기가 끝나면 Supabase 대시보드 → Edge Functions 에서 지워도 됨.

const ALLOWED_ORIGINS = ['https://ding-dong-eight.vercel.app', 'http://localhost:5173', 'https://localhost']
const PATH_RE = /^(img|full)\/[A-Za-z0-9_\-/.]+\.(png|jpe?g|webp|gif)$/i
const MAX_BYTES = 15 * 1024 * 1024

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') ?? ''
  const cors = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    Vary: 'Origin',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'GET') return new Response('method not allowed', { status: 405, headers: cors })

  const path = new URL(req.url).searchParams.get('path') ?? ''
  if (!PATH_RE.test(path) || path.includes('..') || path.includes('//')) {
    return new Response('bad path', { status: 400, headers: cors })
  }

  const upstream = await fetch('https://ding-dong.naru.pub/102/' + path, { redirect: 'follow' })
  if (!upstream.ok) return new Response('naru ' + upstream.status, { status: 502, headers: cors })
  const type = upstream.headers.get('content-type') ?? ''
  if (!type.startsWith('image/')) return new Response('not an image', { status: 415, headers: cors })
  const buf = await upstream.arrayBuffer()
  if (buf.byteLength > MAX_BYTES) return new Response('too large', { status: 413, headers: cors })

  return new Response(buf, {
    headers: { ...cors, 'Content-Type': type, 'Cache-Control': 'private, max-age=600' },
  })
})

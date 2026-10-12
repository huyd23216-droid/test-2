// Supabase Edge Function: vào web bằng email có trong danh sách cho phép.
// Web gửi email lên; nếu email nằm trong bảng public.allowed_emails, hàm tạo
// phiên đăng nhập cho tài khoản đó (tạo tài khoản nếu chưa có) và trả về cho web.
// Không gửi email nào, nên không bị giới hạn số email mỗi giờ của Supabase.
//
// Lưu ý: ai biết một email trong danh sách là vào được tài khoản đó.
// Chỉ phù hợp cho web học cá nhân.
//
// Deploy: supabase functions deploy email-login --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const reply = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: cors })

function serviceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  try {
    return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default ?? ''
  } catch {
    return ''
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' })

  let email = ''
  try {
    email = String((await req.json())?.email ?? '').trim().toLowerCase()
  } catch {
    // body không phải JSON
  }
  if (!email) return reply(400, { error: 'missing_email' })

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const options = { auth: { persistSession: false, autoRefreshToken: false } }
  const admin = createClient(url, serviceKey(), options)

  const { data: allowed, error: listError } = await admin
    .from('allowed_emails')
    .select('email')
    .eq('email', email)
    .maybeSingle()
  if (listError) return reply(500, { error: 'whitelist_unavailable' })
  if (!allowed) return reply(403, { error: 'not_allowed' })

  let link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (link.error) {
    // Email chưa có tài khoản: tạo tài khoản (đã xác nhận) rồi thử lại
    const created = await admin.auth.admin.createUser({ email, email_confirm: true })
    if (created.error) return reply(500, { error: 'create_user_failed' })
    link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (link.error) return reply(500, { error: 'link_failed' })
  }

  // Đổi link vừa tạo thành phiên đăng nhập ngay trên máy chủ (client riêng,
  // để phiên không dính vào client admin ở trên)
  const verifier = createClient(url, serviceKey(), options)
  const { data, error } = await verifier.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: link.data.properties.verification_type === 'signup' ? 'signup' : 'magiclink',
  })
  if (error || !data.session) return reply(500, { error: 'verify_failed' })

  const { access_token, refresh_token, expires_in, expires_at, token_type } = data.session
  return reply(200, { access_token, refresh_token, expires_in, expires_at, token_type })
})

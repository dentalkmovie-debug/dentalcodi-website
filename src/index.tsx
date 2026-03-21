import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS 설정 (iframe 내에서 사용 가능하도록)
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type'],
}))

// ============================================
// 유틸리티 함수
// ============================================

// 차단 페이지 HTML 생성
function getBlockedPageHtml(title: string, reason: string, message: string): string {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - 치과 TV</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gradient-to-br from-gray-900 to-gray-800 min-h-screen flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
    <div class="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
      <i class="fas fa-exclamation-triangle text-4xl text-red-500"></i>
    </div>
    <h1 class="text-2xl font-bold text-gray-800 mb-2">${title}</h1>
    <p class="text-gray-600 mb-4">${reason}</p>
    <div class="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
      <p class="text-sm text-orange-700">${message}</p>
    </div>
    <div class="bg-gray-50 rounded-lg p-4">
      <p class="text-sm text-gray-600 mb-2">
        <i class="fas fa-phone mr-2 text-blue-500"></i>
        문의: 관리자에게 연락하세요
      </p>
    </div>
    <a href="/login" onclick="clearLoginData()" class="inline-block mt-4 text-blue-500 hover:text-blue-600 text-sm">
      <i class="fas fa-arrow-left mr-1"></i>로그인 페이지로 돌아가기
    </a>
  </div>
  <script>
    function clearLoginData() {
      localStorage.removeItem('dental_tv_session');
    }
  </script>
</body>
</html>
  `
}

// 랜덤 문자열 생성 (단축 URL용 - 5자리)
function generateRandomCode(length: number = 5): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789' // 혼동하기 쉬운 문자 제외 (i,l,o,0,1)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// YouTube 비디오 ID 추출
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

// Vimeo 비디오 ID 추출
function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return match ? match[1] : null
}

// ============================================
// 관리자 코드로 사용자 조회/생성
// ============================================

async function getOrCreateUser(db: D1Database, adminCode: string, clinicName?: string) {
  let user = await db.prepare(
    'SELECT * FROM users WHERE admin_code = ?'
  ).bind(adminCode).first()
  
  if (!user) {
    const result = await db.prepare(`
      INSERT INTO users (admin_code, clinic_name)
      VALUES (?, ?)
    `).bind(adminCode, clinicName || '내 치과').run()
    
    user = await db.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(result.meta.last_row_id).first()
    
    // 새 사용자에게 기본 플레이리스트 자동 생성
    if (user) {
      const shortCode = generateRandomCode(5)
      await db.prepare(`
        INSERT INTO playlists (user_id, name, short_code)
        VALUES (?, ?, ?)
      `).bind(user.id, '대기실1', shortCode).run()
    }
  }
  
  return user
}

// 아임웹 회원 코드로 사용자 조회/생성 (임베드용)
async function getOrCreateUserByMemberCode(db: D1Database, memberCode: string, memberName?: string, memberEmail?: string) {
  // 아임웹 변수가 치환되지 않은 경우 방어 (예: {{ member_code }}, {{member_code}})
  if (!memberCode || memberCode.includes('{{') || memberCode.includes('}}') || memberCode.trim() === '') {
    return null
  }
  
  const normalizedEmail = memberEmail && memberEmail.trim() ? memberEmail.trim().toLowerCase() : ''

  let user: any = await db.prepare(
    'SELECT * FROM users WHERE imweb_member_id = ?'
  ).bind(memberCode).first()

  // 레거시 데이터 보정: member_id가 없는 계정만 이메일로 매칭 (다른 member_id가 있는 계정과 혼용 방지)
  if (!user && normalizedEmail) {
    const emailUser = await db.prepare(
      'SELECT * FROM users WHERE lower(imweb_email) = ? AND (imweb_member_id IS NULL OR imweb_member_id = ?)'
    ).bind(normalizedEmail, memberCode).first() as any

    if (emailUser) {
      user = emailUser
      if (!emailUser.imweb_member_id) {
        // member_id 없는 레거시 계정에 member_id 연결
        await db.prepare(
          'UPDATE users SET imweb_member_id = ? WHERE id = ?'
        ).bind(memberCode, emailUser.id).run()
      }
    }
  }
  
  if (!user) {
    // 새 사용자 생성 - 아임웹 회원 코드를 admin_code로도 사용
    const adminCode = 'imweb_' + memberCode
    const clinicName = memberName || '내 치과'
    const emailValue = normalizedEmail || null
    
    const result = await db.prepare(`
      INSERT INTO users (admin_code, clinic_name, imweb_member_id, imweb_email)
      VALUES (?, ?, ?, ?)
    `).bind(adminCode, clinicName, memberCode, emailValue).run()
    
    user = await db.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(result.meta.last_row_id).first()
    
    // 새 사용자에게 기본 플레이리스트 자동 생성
    if (user) {
      const shortCode = generateRandomCode(5)
      await db.prepare(`
        INSERT INTO playlists (user_id, name, short_code)
        VALUES (?, ?, ?)
      `).bind(user.id, '대기실1', shortCode).run()
    }
  } else {
    let updated = false
    // 기본값/임시값 목록: 이 이름들은 clinic_name을 덮어쓰지 않음
    const defaultNames = ['관리자', '내 치과', '{{ user_name }}', 'Admin', 'admin']
    const currentClinicName = (user as any).clinic_name || ''
    const isCurrentDefault = !currentClinicName || defaultNames.some(n => currentClinicName === n)
    const isNewNameDefault = !memberName || defaultNames.some(n => memberName.trim() === n)

    if (memberName && memberName.trim() && currentClinicName !== memberName.trim()) {
      // 현재 clinic_name이 기본값이 아닌 경우(사용자가 직접 설정), 새 이름이 기본값이면 덮어쓰지 않음
      if (!isCurrentDefault && isNewNameDefault) {
        // 사용자가 직접 설정한 이름 유지, 덮어쓰지 않음
      } else {
        // 아임웹 가입 치과명으로 갱신
        await db.prepare(`
          UPDATE users SET clinic_name = ? WHERE id = ?
        `).bind(memberName.trim(), (user as any).id).run()
        updated = true
      }
    }

    if (normalizedEmail && (user as any).imweb_email !== normalizedEmail) {
      // ADMIN_EMAILS는 회원 이메일로 저장하지 않음 (API 계정 이메일이 잘못 반환될 수 있음)
      if (!ADMIN_EMAILS.includes(normalizedEmail)) {
        await db.prepare(`
          UPDATE users SET imweb_email = ? WHERE id = ?
        `).bind(normalizedEmail, (user as any).id).run()
        updated = true
      }
    }

    if (memberCode && (user as any).imweb_member_id !== memberCode) {
      await db.prepare(`
        UPDATE users SET imweb_member_id = ? WHERE id = ?
      `).bind(memberCode, (user as any).id).run()
      updated = true
    }

    if (updated) {
      user = await db.prepare(
        'SELECT * FROM users WHERE id = ?'
      ).bind((user as any).id).first()
    }
  }
  
  return user
}

// 관리자 이메일 기준 (아임웹 가입 이메일)
const ADMIN_EMAILS = ['imwebaws@gmail.com']
const normalizeEmail = (email?: string) => (email || '').trim().toLowerCase()
const isAdminEmail = (email?: string) => ADMIN_EMAILS.includes(normalizeEmail(email))

// ============================================
// 마스터 관리자 API
// ============================================

// 마스터 관리자 인증 (간단한 비밀번호 방식)
const MASTER_PASSWORD = 'dental2024master'

app.post('/api/master/auth', async (c) => {
  const { password } = await c.req.json()
  if (password === MASTER_PASSWORD) {
    return c.json({ success: true })
  }
  return c.json({ error: '비밀번호가 틀렸습니다.' }, 401)
})

// 마스터 관리자 정보 가져오기/생성
app.get('/api/master/info', async (c) => {
  // 마스터 사용자 조회 또는 생성
  let masterUser = await c.env.DB.prepare(
    'SELECT * FROM users WHERE is_master = 1'
  ).first()
  
  if (!masterUser) {
    // 마스터 사용자 생성
    await c.env.DB.prepare(`
      INSERT INTO users (admin_code, clinic_name, is_master)
      VALUES ('master_admin', '마스터 관리자', 1)
    `).run()
    
    masterUser = await c.env.DB.prepare(
      'SELECT * FROM users WHERE is_master = 1'
    ).first()
  }
  
  // 마스터 플레이리스트 조회
  const masterPlaylist = await c.env.DB.prepare(`
    SELECT p.*, 
      (SELECT COUNT(*) FROM playlist_items WHERE playlist_id = p.id) as item_count
    FROM playlists p
    WHERE p.user_id = ? AND p.is_master_playlist = 1
    LIMIT 1
  `).bind(masterUser.id).first()
  
  return c.json({
    user: masterUser,
    masterPlaylist: masterPlaylist
  })
})

// 마스터 플레이리스트 생성
app.post('/api/master/playlist', async (c) => {
  let masterUser = await c.env.DB.prepare(
    'SELECT * FROM users WHERE is_master = 1'
  ).first()
  
  if (!masterUser) {
    return c.json({ error: '마스터 사용자가 없습니다.' }, 404)
  }
  
  // 기존 마스터 플레이리스트 확인
  const existing = await c.env.DB.prepare(
    'SELECT id FROM playlists WHERE user_id = ? AND is_master_playlist = 1'
  ).bind(masterUser.id).first()
  
  if (existing) {
    return c.json({ error: '이미 마스터 플레이리스트가 있습니다.', playlistId: existing.id }, 400)
  }
  
  const shortCode = generateRandomCode(5)
  const result = await c.env.DB.prepare(`
    INSERT INTO playlists (user_id, name, short_code, is_master_playlist, is_active)
    VALUES (?, '공용 동영상', ?, 1, 1)
  `).bind(masterUser.id, shortCode).run()
  
  return c.json({ 
    success: true, 
    playlistId: result.meta.last_row_id,
    shortCode: shortCode
  })
})

// 마스터 플레이리스트 아이템 목록
app.get('/api/master/items', async (c) => {
  const masterPlaylist = await c.env.DB.prepare(`
    SELECT p.id FROM playlists p
    JOIN users u ON p.user_id = u.id
    WHERE u.is_master = 1 AND p.is_master_playlist = 1
    LIMIT 1
  `).first()
  
  if (!masterPlaylist) {
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    c.header('Pragma', 'no-cache')
    return c.json({ items: [] })
  }
  
  const items = await c.env.DB.prepare(`
    SELECT * FROM playlist_items 
    WHERE playlist_id = ? 
    ORDER BY sort_order ASC
  `).bind(masterPlaylist.id).all()
  
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  c.header('Pragma', 'no-cache')
  return c.json({ items: items.results, playlistId: masterPlaylist.id })
})

// 마스터 플레이리스트에 아이템 추가
app.post('/api/master/items', async (c) => {
  const { url, title } = await c.req.json()
  
  const masterPlaylist = await c.env.DB.prepare(`
    SELECT p.id FROM playlists p
    JOIN users u ON p.user_id = u.id
    WHERE u.is_master = 1 AND p.is_master_playlist = 1
    LIMIT 1
  `).first()
  
  if (!masterPlaylist) {
    return c.json({ error: '마스터 플레이리스트가 없습니다.' }, 404)
  }
  
  // URL 타입 감지
  let itemType = 'image'
  let thumbnailUrl = url
  let itemTitle = title || ''
  
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return c.json({ error: 'Vimeo URL만 지원됩니다.' }, 400)
  } else if (url.includes('vimeo.com')) {
    itemType = 'vimeo'
    // Vimeo oEmbed API로 썸네일과 제목 가져오기
    try {
      const oembedRes = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`)
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json() as any
        thumbnailUrl = oembedData.thumbnail_url || ''
        if (!itemTitle && oembedData.title) {
          itemTitle = oembedData.title
        }
      }
    } catch (e) {
      thumbnailUrl = ''
    }
  }
  
  // 현재 최대 sort_order 가져오기
  const maxOrder = await c.env.DB.prepare(
    'SELECT MAX(sort_order) as max_order FROM playlist_items WHERE playlist_id = ?'
  ).bind(masterPlaylist.id).first()
  
  const sortOrder = (maxOrder?.max_order || 0) + 1
  
  const result = await c.env.DB.prepare(`
    INSERT INTO playlist_items (playlist_id, item_type, url, title, thumbnail_url, sort_order, display_time)
    VALUES (?, ?, ?, ?, ?, ?, 10)
  `).bind(masterPlaylist.id, itemType, url, itemTitle, thumbnailUrl, sortOrder).run()
  
  return c.json({ success: true, itemId: result.meta.last_row_id })
})

// 마스터 플레이리스트 아이템 삭제
app.delete('/api/master/items/:itemId', async (c) => {
  const itemId = c.req.param('itemId')
  
  await c.env.DB.prepare(
    'DELETE FROM playlist_items WHERE id = ?'
  ).bind(itemId).run()
  
  return c.json({ success: true })
})

// 마스터 플레이리스트 아이템 순서 저장
app.post('/api/master/items/reorder', async (c) => {
  const { items } = await c.req.json()
  if (!Array.isArray(items)) {
    return c.json({ error: '잘못된 요청' }, 400)
  }

  const masterPlaylist = await c.env.DB.prepare(`
    SELECT p.id FROM playlists p
    JOIN users u ON p.user_id = u.id
    WHERE u.is_master = 1 AND p.is_master_playlist = 1
    LIMIT 1
  `).first()

  if (!masterPlaylist) {
    return c.json({ error: '마스터 플레이리스트가 없습니다.' }, 404)
  }

  for (const item of items) {
    if (!item || typeof item.id === 'undefined') continue
    await c.env.DB.prepare(
      'UPDATE playlist_items SET sort_order = ? WHERE id = ? AND playlist_id = ?'
    ).bind(item.sort_order, item.id, masterPlaylist.id).run()
  }

  return c.json({ success: true })
})

// ============================================
// 자막 관리 API
// ============================================

// 자막 목록 조회
app.get('/api/master/subtitles', async (c) => {
  const subtitles = await c.env.DB.prepare(`
    SELECT s.*, pi.url as video_url, pi.title as video_title
    FROM subtitles s
    LEFT JOIN playlist_items pi ON s.playlist_item_id = pi.id
    ORDER BY s.created_at DESC
  `).all()
  
  return c.json({ subtitles: subtitles.results })
})

// 특정 Vimeo ID의 자막 조회
app.get('/api/subtitles/:vimeoId', async (c) => {
  const vimeoId = c.req.param('vimeoId')
  
  const subtitle = await c.env.DB.prepare(`
    SELECT * FROM subtitles WHERE vimeo_id = ? ORDER BY created_at DESC LIMIT 1
  `).bind(vimeoId).first()
  
  if (!subtitle) {
    return c.json({ subtitle: null })
  }
  
  return c.json({ subtitle })
})

// 자막 추가/수정
app.post('/api/master/subtitles', async (c) => {
  const body = await c.req.json() as any
  const { vimeo_id, content, language = 'ko', playlist_item_id } = body
  
  if (!vimeo_id || !content) {
    return c.json({ error: 'Vimeo ID와 자막 내용이 필요합니다.' }, 400)
  }
  
  // 기존 자막 확인
  const existing = await c.env.DB.prepare(
    'SELECT id FROM subtitles WHERE vimeo_id = ?'
  ).bind(vimeo_id).first()
  
  if (existing) {
    // 업데이트
    await c.env.DB.prepare(`
      UPDATE subtitles SET content = ?, language = ?, updated_at = CURRENT_TIMESTAMP
      WHERE vimeo_id = ?
    `).bind(content, language, vimeo_id).run()
    
    return c.json({ success: true, message: '자막이 수정되었습니다.' })
  } else {
    // 새로 추가
    await c.env.DB.prepare(`
      INSERT INTO subtitles (vimeo_id, content, language, playlist_item_id)
      VALUES (?, ?, ?, ?)
    `).bind(vimeo_id, content, language, playlist_item_id || null).run()
    
    return c.json({ success: true, message: '자막이 추가되었습니다.' })
  }
})

// 자막 삭제
app.delete('/api/master/subtitles/:id', async (c) => {
  const id = c.req.param('id')
  
  await c.env.DB.prepare('DELETE FROM subtitles WHERE id = ?').bind(id).run()
  
  return c.json({ success: true })
})

// 자막 스타일 설정 조회
app.get('/api/master/subtitle-settings', async (c) => {
  const master = await c.env.DB.prepare(
    'SELECT subtitle_font_size, subtitle_bg_opacity, subtitle_text_color, subtitle_bg_color, subtitle_position, subtitle_bottom_offset FROM users WHERE is_master = 1 LIMIT 1'
  ).first() as any
  
  return c.json({
    settings: {
      font_size: master?.subtitle_font_size || 28,
      bg_opacity: master?.subtitle_bg_opacity || 80,
      text_color: master?.subtitle_text_color || '#ffffff',
      bg_color: master?.subtitle_bg_color || '#000000',
      position: master?.subtitle_position || 'bottom',
      bottom_offset: master?.subtitle_bottom_offset || 80
    }
  })
})

// 자막 스타일 설정 저장
app.put('/api/master/subtitle-settings', async (c) => {
  try {
    const { font_size, bg_opacity, text_color, bg_color, position, bottom_offset } = await c.req.json()
    
    await c.env.DB.prepare(`
      UPDATE users SET 
        subtitle_font_size = ?,
        subtitle_bg_opacity = ?,
        subtitle_text_color = ?,
        subtitle_bg_color = ?,
        subtitle_position = ?,
        subtitle_bottom_offset = ?
      WHERE is_master = 1
    `).bind(font_size, bg_opacity, text_color, bg_color, position || 'bottom', bottom_offset || 80).run()
    
    return c.json({ success: true })
  } catch (e) {
    console.error('자막 설정 저장 에러:', e)
    return c.json({ error: '저장 실패' }, 500)
  }
})

// 전체 치과 사용자 목록 (마스터 관리자용)
app.get('/api/master/users', async (c) => {
  const users = await c.env.DB.prepare(`
    SELECT u.*, 
      (SELECT COUNT(*) FROM playlists WHERE user_id = u.id) as playlist_count,
      (SELECT short_code FROM playlists WHERE user_id = u.id LIMIT 1) as short_code
    FROM users u
    WHERE u.is_master = 0 OR u.is_master IS NULL
    ORDER BY u.created_at DESC
  `).all()
  
  return c.json({ users: users.results })
})

// 아임웹 API 환경 확인 (디버그)
app.get('/api/debug/imweb-env', (c) => {
  const clientId = (c.env as any).IMWEB_CLIENT_ID
  const clientSecret = (c.env as any).IMWEB_CLIENT_SECRET
  return c.json({
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret
  })
})

// 아임웹 회원 목록 가져오기
app.get('/api/master/imweb-members', async (c) => {
  const password = (c.req.query('password') || '').trim()
  if (password !== MASTER_PASSWORD) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  try {
    const clientId = (c.env as any).IMWEB_CLIENT_ID
    const clientSecret = (c.env as any).IMWEB_CLIENT_SECRET
    
    if (!clientId || !clientSecret) {
      return c.json({ error: '아임웹 API 키가 설정되지 않았습니다.' }, 400)
    }
    
    // 1. 액세스 토큰 발급
    const authRes = await fetch('https://api.imweb.me/v2/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: clientId, secret: clientSecret })
    })
    
    const authData = await authRes.json() as any
    if (!authData.access_token) {
      return c.json({ error: '아임웹 인증 실패: ' + (authData.msg || 'Unknown error') }, 401)
    }
    
    // 2. 회원 목록 조회 (access-token 헤더 사용)
    const membersRes = await fetch('https://api.imweb.me/v2/member/members?limit=100', {
      headers: { 'access-token': authData.access_token }
    })
    
    const membersData = await membersRes.json() as any
    if (membersData.code !== 200) {
      return c.json({ error: '회원 목록 조회 실패: ' + (membersData.msg || 'Unknown error') }, 400)
    }

    const users = await c.env.DB.prepare(`
      SELECT imweb_member_id, admin_code, clinic_name
      FROM users
      WHERE imweb_member_id IS NOT NULL
    `).all()

    const userMap = new Map(
      (users.results || []).map((u: any) => [String(u.imweb_member_id || ''), u])
    )

    const members = (membersData.data?.list || []).map((m: any) => {
      const memberCode = String(m.member_code || m.code || m.id || '')
      const registered = userMap.get(memberCode)

      return {
        member_code: memberCode,
        email: m.email,
        name: m.name,
        uid: m.uid,
        join_time: m.join_time,
        registered: !!registered,
        admin_code: registered?.admin_code || null,
        clinic_name: registered?.clinic_name || null
      }
    })
    
    return c.json({ members })
  } catch (e: any) {
    return c.json({ error: '아임웹 API 오류: ' + e.message }, 500)
  }
})

// 아임웹 회원 자동 동기화 (신규 가입 즉시 등록)
app.post('/api/master/imweb-sync', async (c) => {
  const password = (c.req.query('password') || '').trim()
  if (password !== MASTER_PASSWORD) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  try {
    const clientId = (c.env as any).IMWEB_CLIENT_ID
    const clientSecret = (c.env as any).IMWEB_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return c.json({ error: '아임웹 API 키가 설정되지 않았습니다.' }, 400)
    }

    const authRes = await fetch('https://api.imweb.me/v2/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: clientId, secret: clientSecret })
    })

    const authData = await authRes.json() as any
    if (!authData.access_token) {
      return c.json({ error: '아임웹 인증 실패: ' + (authData.msg || 'Unknown error') }, 401)
    }

    const membersRes = await fetch('https://api.imweb.me/v2/member/members?limit=100', {
      headers: { 'access-token': authData.access_token }
    })

    const membersData = await membersRes.json() as any
    if (membersData.code !== 200) {
      return c.json({ error: '회원 목록 조회 실패: ' + (membersData.msg || 'Unknown error') }, 400)
    }

    const list = membersData.data?.list || []
    let created = 0
    let updated = 0

    for (const m of list) {
      const memberCode = String(m.member_code || m.code || m.id || '')
      if (!memberCode) continue

      const before = await c.env.DB.prepare(
        'SELECT id FROM users WHERE imweb_member_id = ?'
      ).bind(memberCode).first()

      const email = normalizeEmail(m.email || m.email_id || '')
      const name = m.name || '내 치과'

      await getOrCreateUserByMemberCode(c.env.DB, memberCode, name, email)

      if (!before) created += 1
      else updated += 1
    }

    return c.json({ success: true, total: list.length, created, updated })
  } catch (e: any) {
    return c.json({ error: '아임웹 API 오류: ' + e.message }, 500)
  }
})

// 아임웹 치과 링크 생성 페이지
app.get('/master/links', async (c) => {
  const baseUrl = new URL(c.req.url).origin
  return c.html(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>아임웹 치과 링크 생성</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-100 min-h-screen">
  <div class="max-w-5xl mx-auto py-10 px-4">
    <div class="bg-white rounded-2xl shadow p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">아임웹 치과 링크 자동 생성</h1>
          <p class="text-sm text-gray-500 mt-1">가입된 회원 목록을 불러와 치과별 로그인 링크를 생성합니다.</p>
        </div>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div class="flex-1">
          <label class="text-sm text-gray-600">마스터 비밀번호</label>
          <input id="master-password" type="password" class="mt-1 w-full border rounded-lg px-3 py-2" placeholder="마스터 비밀번호 입력" />
        </div>
        <button id="load-button" class="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700">
          <i class="fas fa-download mr-2"></i>회원 불러오기
        </button>
      </div>

      <div id="error-message" class="hidden mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700"></div>

      <div class="mt-6 overflow-x-auto">
        <table class="min-w-full text-sm" id="members-table">
          <thead class="bg-gray-50 text-gray-600">
            <tr>
              <th class="text-left px-3 py-2">치과명</th>
              <th class="text-left px-3 py-2">이메일</th>
              <th class="text-left px-3 py-2">회원코드</th>
              <th class="text-left px-3 py-2">등록상태</th>
              <th class="text-left px-3 py-2">로그인 링크</th>
            </tr>
          </thead>
          <tbody id="members-body" class="divide-y"></tbody>
        </table>
      </div>
    </div>

    <div class="mt-6 text-sm text-gray-600">
      <p><i class="fas fa-link mr-2 text-blue-500"></i>아임웹에서 각 치과 전용 페이지를 만들고, 페이지 제목 링크에 아래 로그인 링크를 연결하세요.</p>
      <p class="mt-1">회원이 추가되면 이 페이지에서 다시 불러오면 최신 링크가 자동 생성됩니다.</p>
    </div>
  </div>

  <script>
    const BASE_URL = '${baseUrl}';
    const loadButton = document.getElementById('load-button');
    const errorMessage = document.getElementById('error-message');
    const tbody = document.getElementById('members-body');

    function showError(message) {
      errorMessage.textContent = message;
      errorMessage.classList.remove('hidden');
    }

    function hideError() {
      errorMessage.classList.add('hidden');
    }

    function buildLink(member) {
      const memberCode = member.member_code || member.memberCode || member.uid || member.id || '';
      const email = member.email || '';
      if (memberCode && email) {
        return BASE_URL + '/embed/' + encodeURIComponent(memberCode) + '?email=' + encodeURIComponent(email);
      }
      return BASE_URL + '/login';
    }

    loadButton.addEventListener('click', async () => {
      hideError();
      tbody.innerHTML = '';

      const password = document.getElementById('master-password').value.trim();
      if (!password) {
        showError('마스터 비밀번호를 입력해주세요.');
        return;
      }

      try {
        const res = await fetch(BASE_URL + '/api/master/imweb-members?password=' + encodeURIComponent(password));
        const data = await res.json();

        if (!res.ok) {
          showError(data.error || '회원 목록을 불러올 수 없습니다.');
          return;
        }

        const members = data.members || [];
        if (members.length === 0) {
          showError('회원 목록이 비어 있습니다.');
          return;
        }

        members.forEach(member => {
          const link = buildLink(member);
          const row = document.createElement('tr');
          const registeredLabel = member.registered
            ? '<span class="text-green-600">등록됨</span>'
            : '<span class="text-gray-400">미등록</span>';

          row.innerHTML =
            '<td class="px-3 py-2">' + (member.name || '-') + '</td>' +
            '<td class="px-3 py-2">' + (member.email || '-') + '</td>' +
            '<td class="px-3 py-2">' + (member.member_code || '-') + '</td>' +
            '<td class="px-3 py-2">' + registeredLabel + '</td>' +
            '<td class="px-3 py-2">' +
              '<div class="flex items-center gap-2">' +
                '<input type="text" class="w-full border rounded px-2 py-1 text-xs" data-link="' + link + '" readonly />' +
                '<button class="copy-btn bg-gray-100 px-2 py-1 rounded" data-link="' + link + '">복사</button>' +
              '</div>' +
            '</td>';
          tbody.appendChild(row);

          const input = row.querySelector('input[data-link]');
          if (input) {
            input.value = link;
          }
        });

        document.querySelectorAll('.copy-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const button = e.currentTarget;
            const link = button.getAttribute('data-link') || '';
            const input = button.closest('td')?.querySelector('input');
            if (!link) {
              showError('링크 생성에 실패했습니다.');
              return;
            }

            try {
              await navigator.clipboard.writeText(link);
              button.textContent = '복사됨';
              setTimeout(() => { button.textContent = '복사'; }, 1200);
            } catch (err) {
              try {
                if (input) {
                  input.focus();
                  input.select();
                  input.setSelectionRange(0, link.length);
                  const ok = document.execCommand('copy');
                  if (ok) {
                    button.textContent = '복사됨';
                    setTimeout(() => { button.textContent = '복사'; }, 1200);
                    return;
                  }
                }
              } catch (err2) {
                // ignore
              }
              showError('클립보드 복사에 실패했습니다.');
            }
          });
        });
      } catch (err) {
        showError('서버 연결에 실패했습니다.');
      }
    });
  </script>
</body>
</html>
  `)
})

// 새 치과 등록 (수동)
app.post('/api/master/clinics', async (c) => {
  const { clinicName, email } = await c.req.json()
  
  if (!clinicName) {
    return c.json({ error: '치과명을 입력해주세요.' }, 400)
  }
  
  // 고유 코드 생성 (8자리)
  const adminCode = 'clinic_' + generateRandomCode(8)
  
  // 사용자 생성
  const result = await c.env.DB.prepare(`
    INSERT INTO users (admin_code, clinic_name, imweb_member_id)
    VALUES (?, ?, ?)
  `).bind(adminCode, clinicName, email || null).run()
  
  const userId = result.meta.last_row_id
  
  // 기본 플레이리스트 생성
  const shortCode = generateRandomCode(5)
  await c.env.DB.prepare(`
    INSERT INTO playlists (user_id, name, short_code)
    VALUES (?, ?, ?)
  `).bind(userId, '대기실1', shortCode).run()
  
  return c.json({ 
    success: true, 
    adminCode,
    shortCode,
    url: '/admin/' + adminCode
  })
})

// 아임웹 회원으로 치과 등록
app.post('/api/master/clinics/from-imweb', async (c) => {
  const { memberCode, email, name } = await c.req.json()
  
  if (!email) {
    return c.json({ error: '이메일이 필요합니다.' }, 400)
  }
  
  // 이미 등록된 이메일인지 확인
  const existing = await c.env.DB.prepare(
    'SELECT * FROM users WHERE imweb_member_id = ?'
  ).bind(email).first()
  
  if (existing) {
    return c.json({ 
      error: '이미 등록된 회원입니다.',
      adminCode: existing.admin_code
    }, 400)
  }
  
  // 고유 코드 생성
  const adminCode = 'imweb_' + generateRandomCode(8)
  
  // 사용자 생성
  const result = await c.env.DB.prepare(`
    INSERT INTO users (admin_code, clinic_name, imweb_member_id)
    VALUES (?, ?, ?)
  `).bind(adminCode, name || '내 치과', email).run()
  
  const userId = result.meta.last_row_id
  
  // 기본 플레이리스트 생성
  const shortCode = generateRandomCode(5)
  await c.env.DB.prepare(`
    INSERT INTO playlists (user_id, name, short_code)
    VALUES (?, ?, ?)
  `).bind(userId, '대기실1', shortCode).run()
  
  return c.json({ 
    success: true, 
    adminCode,
    shortCode,
    url: '/admin/' + adminCode
  })
})

// 치과 삭제
app.delete('/api/master/clinics/:adminCode', async (c) => {
  const adminCode = c.req.param('adminCode')
  
  // 마스터 계정은 삭제 불가
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE admin_code = ?'
  ).bind(adminCode).first()
  
  if (!user) {
    return c.json({ error: '치과를 찾을 수 없습니다.' }, 404)
  }
  
  if (user.is_master) {
    return c.json({ error: '마스터 계정은 삭제할 수 없습니다.' }, 400)
  }
  
  // 플레이리스트 아이템 삭제
  await c.env.DB.prepare(`
    DELETE FROM playlist_items 
    WHERE playlist_id IN (SELECT id FROM playlists WHERE user_id = ?)
  `).bind(user.id).run()
  
  // 플레이리스트 삭제
  await c.env.DB.prepare('DELETE FROM playlists WHERE user_id = ?').bind(user.id).run()
  
  // 공지사항 삭제
  await c.env.DB.prepare('DELETE FROM notices WHERE user_id = ?').bind(user.id).run()
  
  // 사용자 삭제
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run()
  
  return c.json({ success: true })
})

// 계정 정지
app.post('/api/master/clinics/:adminCode/suspend', async (c) => {
  const adminCode = c.req.param('adminCode')
  const { reason } = await c.req.json().catch(() => ({ reason: '' }))
  
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE admin_code = ?'
  ).bind(adminCode).first()
  
  if (!user) {
    return c.json({ error: '치과를 찾을 수 없습니다.' }, 404)
  }
  
  if (user.is_master) {
    return c.json({ error: '마스터 계정은 정지할 수 없습니다.' }, 400)
  }
  
  await c.env.DB.prepare(`
    UPDATE users SET is_active = 0, suspended_at = ?, suspended_reason = ?
    WHERE admin_code = ?
  `).bind(new Date().toISOString(), reason || '관리자에 의해 정지됨', adminCode).run()
  
  return c.json({ success: true, message: '계정이 정지되었습니다.' })
})

// 계정 활성화
app.post('/api/master/clinics/:adminCode/activate', async (c) => {
  const adminCode = c.req.param('adminCode')
  
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE admin_code = ?'
  ).bind(adminCode).first()
  
  if (!user) {
    return c.json({ error: '치과를 찾을 수 없습니다.' }, 404)
  }
  
  await c.env.DB.prepare(`
    UPDATE users SET is_active = 1, suspended_at = NULL, suspended_reason = NULL
    WHERE admin_code = ?
  `).bind(adminCode).run()
  
  return c.json({ success: true, message: '계정이 활성화되었습니다.' })
})

// 구독 기간 설정
app.post('/api/master/clinics/:adminCode/subscription', async (c) => {
  const adminCode = c.req.param('adminCode')
  const { plan, startDate, endDate } = await c.req.json()
  
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE admin_code = ?'
  ).bind(adminCode).first()
  
  if (!user) {
    return c.json({ error: '치과를 찾을 수 없습니다.' }, 404)
  }
  
  if (user.is_master) {
    return c.json({ error: '마스터 계정은 구독 설정이 필요하지 않습니다.' }, 400)
  }
  
  // 구독 설정 업데이트
  await c.env.DB.prepare(`
    UPDATE users SET 
      subscription_plan = ?,
      subscription_start = ?,
      subscription_end = ?,
      is_active = 1,
      suspended_at = NULL,
      suspended_reason = NULL
    WHERE admin_code = ?
  `).bind(plan || 'monthly', startDate, endDate, adminCode).run()
  
  return c.json({ 
    success: true, 
    message: '구독 기간이 설정되었습니다.',
    subscription: { plan, startDate, endDate }
  })
})

// 구독 연장
app.post('/api/master/clinics/:adminCode/extend', async (c) => {
  const adminCode = c.req.param('adminCode')
  const { months } = await c.req.json()
  
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE admin_code = ?'
  ).bind(adminCode).first() as any
  
  if (!user) {
    return c.json({ error: '치과를 찾을 수 없습니다.' }, 404)
  }
  
  // 현재 종료일 또는 오늘 기준으로 연장
  const currentEnd = user.subscription_end ? new Date(user.subscription_end) : new Date()
  const baseDate = currentEnd > new Date() ? currentEnd : new Date()
  
  const newEnd = new Date(baseDate)
  newEnd.setMonth(newEnd.getMonth() + (months || 1))
  
  const newEndStr = newEnd.toISOString().split('T')[0]
  
  await c.env.DB.prepare(`
    UPDATE users SET 
      subscription_end = ?,
      is_active = 1,
      suspended_at = NULL,
      suspended_reason = NULL
    WHERE admin_code = ?
  `).bind(newEndStr, adminCode).run()
  
  return c.json({ 
    success: true, 
    message: months + '개월 연장되었습니다.',
    newEndDate: newEndStr
  })
})

// ============================================
// 플레이리스트 API
// ============================================

app.get('/api/:adminCode/playlists', async (c) => {
  const adminCode = c.req.param('adminCode')
  const user = await getOrCreateUser(c.env.DB, adminCode)
  
  if (!user) {
    return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404)
  }
  
  let playlists = await c.env.DB.prepare(`
    SELECT p.*, 
      (SELECT COUNT(*) FROM playlist_items WHERE playlist_id = p.id) as item_count
    FROM playlists p
    WHERE p.user_id = ?
    ORDER BY COALESCE(p.sort_order, 999), p.created_at ASC
  `).bind(user.id).all()
  
  // 플레이리스트가 없으면 기본 플레이리스트 자동 생성
  if (!playlists.results || playlists.results.length === 0) {
    const shortCode = generateRandomCode(5)
    const tvCode = String(Math.floor(1000 + Math.random() * 9000))
    await c.env.DB.prepare(`
      INSERT INTO playlists (user_id, name, short_code, tv_code)
      VALUES (?, ?, ?, ?)
    `).bind(user.id, '대기실1', shortCode, tvCode).run()
    
    // 다시 조회
    playlists = await c.env.DB.prepare(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM playlist_items WHERE playlist_id = p.id) as item_count
      FROM playlists p
      WHERE p.user_id = ?
      ORDER BY COALESCE(p.sort_order, 999), p.created_at ASC
    `).bind(user.id).all()
  }
  
  // playlist items와 activeItemIds도 함께 로드 (편집창 즉시 렌더링용)
  const [allPlaylistItems, masterItemsForActive] = await Promise.all([
    c.env.DB.prepare(`
      SELECT pi.*
      FROM playlist_items pi
      JOIN playlists p ON pi.playlist_id = p.id
      WHERE p.user_id = ? AND (p.is_master_playlist = 0 OR p.is_master_playlist IS NULL)
      ORDER BY pi.playlist_id, pi.sort_order ASC
    `).bind(user.id).all(),
    c.env.DB.prepare(`
      SELECT pi.id
      FROM playlist_items pi
      JOIN playlists p ON pi.playlist_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE u.is_master = 1 AND p.is_master_playlist = 1 AND p.is_active = 1
      ORDER BY pi.sort_order
    `).all()
  ])
  const masterIdsForActive = (masterItemsForActive.results || []).map((i: any) => i.id)

  // playlist별로 items 그룹핑
  const itemsByPlaylist: Record<number, any[]> = {}
  for (const item of (allPlaylistItems.results || [])) {
    const pid = (item as any).playlist_id
    if (!itemsByPlaylist[pid]) itemsByPlaylist[pid] = []
    itemsByPlaylist[pid].push({ ...(item as any), is_master: false })
  }

  const playlistsWithItems = (playlists.results || []).map((p: any) => {
    const items = itemsByPlaylist[p.id] || []
    let activeItemIds: number[] = []
    try {
      const raw = p.active_item_ids
      if (raw === null || raw === undefined) {
        activeItemIds = [...masterIdsForActive, ...items.map((i: any) => i.id)]
      } else {
        activeItemIds = JSON.parse(raw || '[]')
        activeItemIds = Array.isArray(activeItemIds)
          ? activeItemIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id))
          : []
      }
    } catch (e) {
      activeItemIds = [...masterIdsForActive, ...items.map((i: any) => i.id)]
    }
    // 서버에서 is_active 계산 (클라이언트 시간 오차 방지)
    // last_active_at이 60초 이내면 사용중 (TV 3초 폴링 기준, 네트워크 지연/cold start 여유 포함)
    const isActiveNow = p.last_active_at
      ? (Date.now() - new Date(p.last_active_at + 'Z').getTime()) < 60000
      : false
    return { ...p, items, activeItemIds, is_tv_active: isActiveNow }
  })

  return c.json({ playlists: playlistsWithItems, clinic_name: user.clinic_name })
})

app.post('/api/:adminCode/playlists', async (c) => {
  const adminCode = c.req.param('adminCode')
  const user = await getOrCreateUser(c.env.DB, adminCode)
  const { name } = await c.req.json()
  
  if (!name) {
    return c.json({ error: '플레이리스트 이름을 입력해주세요.' }, 400)
  }

  // 동일 사용자 내 중복 이름 체크
  const existing = await c.env.DB.prepare(`
    SELECT id FROM playlists WHERE user_id = ? AND name = ?
  `).bind(user.id, name).first()
  if (existing) {
    return c.json({ error: `'${name}' 이름이 이미 존재합니다. 다른 이름을 사용해주세요.` }, 409)
  }
  
  const shortCode = generateRandomCode(5)
  const tvCode = String(Math.floor(1000 + Math.random() * 9000))
  
  // 새 플레이리스트는 현재 최대 sort_order + 1로 맨 뒤에 추가
  const maxOrder = await c.env.DB.prepare(`
    SELECT COALESCE(MAX(sort_order), -1) as max_order FROM playlists WHERE user_id = ?
  `).bind(user.id).first() as { max_order: number }
  const newSortOrder = (maxOrder?.max_order ?? -1) + 1
  
  const result = await c.env.DB.prepare(`
    INSERT INTO playlists (user_id, name, short_code, tv_code, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).bind(user.id, name, shortCode, tvCode, newSortOrder).run()
  
  return c.json({ 
    success: true,
    playlist: {
      id: result.meta.last_row_id,
      name,
      short_code: shortCode,
      tv_code: tvCode
    }
  })
})

app.put('/api/:adminCode/playlists/:id', async (c) => {
  const adminCode = c.req.param('adminCode')
  const playlistId = c.req.param('id')
  const user = await getOrCreateUser(c.env.DB, adminCode)
  const { name, is_active, transition_effect, transition_duration } = await c.req.json()
  
  await c.env.DB.prepare(`
    UPDATE playlists 
    SET name = COALESCE(?, name), 
        is_active = COALESCE(?, is_active),
        transition_effect = COALESCE(?, transition_effect),
        transition_duration = COALESCE(?, transition_duration),
        updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).bind(name, is_active, transition_effect, transition_duration, playlistId, user.id).run()
  
  return c.json({ success: true })
})

// 플레이리스트 순서 변경
app.post('/api/:adminCode/playlists/reorder', async (c) => {
  const adminCode = c.req.param('adminCode')
  const user = await getOrCreateUser(c.env.DB, adminCode)
  const { order } = await c.req.json()
  
  if (!order || !Array.isArray(order)) {
    return c.json({ error: '순서 정보가 필요합니다.' }, 400)
  }
  
  // 순서 업데이트
  for (const item of order) {
    await c.env.DB.prepare(`
      UPDATE playlists SET sort_order = ? WHERE id = ? AND user_id = ?
    `).bind(item.sort_order, item.id, user.id).run()
  }
  
  return c.json({ success: true })
})

// 플레이리스트 활성 아이템 목록 업데이트 (라이브러리와 독립적)
app.put('/api/:adminCode/playlists/:id/active-items', async (c) => {
  const adminCode = c.req.param('adminCode')
  const playlistId = c.req.param('id')
  const user = await getOrCreateUser(c.env.DB, adminCode)
  const { activeItemIds } = await c.req.json()
  
  const normalizedActiveItemIds = Array.isArray(activeItemIds)
    ? activeItemIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id))
    : []
  
  // active_item_ids를 JSON 문자열로 저장
  const activeItemIdsJson = JSON.stringify(normalizedActiveItemIds)
  
  await c.env.DB.prepare(`
    UPDATE playlists SET active_item_ids = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).bind(activeItemIdsJson, playlistId, user.id).run()
  
  console.log('[API] Updated active_item_ids for playlist', playlistId, ':', activeItemIdsJson)
  
  return c.json({ success: true })
})

app.delete('/api/:adminCode/playlists/:id', async (c) => {
  const adminCode = c.req.param('adminCode')
  const playlistId = c.req.param('id')
  const user = await getOrCreateUser(c.env.DB, adminCode)
  
  await c.env.DB.prepare(`
    DELETE FROM playlists WHERE id = ? AND user_id = ?
  `).bind(playlistId, user.id).run()
  
  return c.json({ success: true })
})

// URL 단축 API - 기존 코드를 5자리로 변경
app.post('/api/:adminCode/playlists/:id/shorten', async (c) => {
  const adminCode = c.req.param('adminCode')
  const playlistId = c.req.param('id')
  const user = await getOrCreateUser(c.env.DB, adminCode)
  
  // 새 5자리 코드 생성
  const newCode = generateRandomCode(5)
  
  await c.env.DB.prepare(`
    UPDATE playlists SET short_code = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).bind(newCode, playlistId, user.id).run()
  
  return c.json({ success: true, short_code: newCode })
})

// 외부 단축 URL 생성 (서버 사이드에서 is.gd API 호출) - DB에 저장하여 유지
app.post('/api/:adminCode/playlists/:id/external-shorten', async (c) => {
  const adminCode = c.req.param('adminCode')
  const playlistId = c.req.param('id')
  
  // 플레이리스트 정보 가져오기
  const user = await getOrCreateUser(c.env.DB, adminCode)
  if (!user) {
    return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404)
  }
  
  const playlist = await c.env.DB.prepare(`
    SELECT short_code, external_short_url FROM playlists WHERE id = ? AND user_id = ?
  `).bind(playlistId, user.id).first() as { short_code: string, external_short_url?: string } | null
  
  if (!playlist) {
    return c.json({ error: '플레이리스트를 찾을 수 없습니다.' }, 404)
  }
  
  // 이미 저장된 단축 URL이 있으면 반환
  if (playlist.external_short_url) {
    return c.json({ success: true, shortUrl: playlist.external_short_url })
  }
  
  // 원본 URL 생성
  const host = c.req.header('host') || 'dental-tv.pages.dev'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const targetUrl = protocol + '://' + host + '/' + playlist.short_code
  
  try {
    let shortUrl = null
    
    // 1. is.gd API 시도 (가장 짧음: is.gd/xxxxxx - 13자)
    const res = await fetch('https://is.gd/create.php?format=simple&url=' + encodeURIComponent(targetUrl))
    if (res.ok) {
      const text = await res.text()
      if (text && text.startsWith('http')) {
        shortUrl = text.trim()
      }
    }
    
    // 2. v.gd 시도 (짧음: v.gd/xxxxxx - 13자)
    if (!shortUrl) {
      const res2 = await fetch('https://v.gd/create.php?format=simple&url=' + encodeURIComponent(targetUrl))
      if (res2.ok) {
        const text = await res2.text()
        if (text && text.startsWith('http')) {
          shortUrl = text.trim()
        }
      }
    }
    
    // 3. TinyURL 시도 (백업: tinyurl.com/xxxxxxxx)
    if (!shortUrl) {
      const tinyRes = await fetch('https://tinyurl.com/api-create.php?url=' + encodeURIComponent(targetUrl))
      if (tinyRes.ok) {
        const text = await tinyRes.text()
        if (text && text.startsWith('http')) {
          shortUrl = text.trim()
        }
      }
    }
    
    if (shortUrl) {
      // DB에 저장
      await c.env.DB.prepare(`
        UPDATE playlists SET external_short_url = ? WHERE id = ?
      `).bind(shortUrl, playlistId).run()
      
      return c.json({ success: true, shortUrl })
    }
    
    // 외부 단축 서비스 모두 실패 시 → 내부 URL을 그대로 반환 (실패하지 않음)
    console.warn('All short URL services failed, using original URL as fallback')
    await c.env.DB.prepare(`
      UPDATE playlists SET external_short_url = ? WHERE id = ?
    `).bind(targetUrl, playlistId).run()
    return c.json({ success: true, shortUrl: targetUrl, fallback: true })
  } catch (e) {
    console.error('Short URL error:', e)
    return c.json({ error: '서버 오류' }, 500)
  }
})

app.get('/api/:adminCode/playlists/:id', async (c) => {
  const adminCode = c.req.param('adminCode')
  const playlistId = c.req.param('id')
  const user = await getOrCreateUser(c.env.DB, adminCode)
  
  const playlist = await c.env.DB.prepare(`
    SELECT * FROM playlists WHERE id = ? AND user_id = ?
  `).bind(playlistId, user.id).first()
  
  if (!playlist) {
    return c.json({ error: '플레이리스트를 찾을 수 없습니다.' }, 404)
  }
  
  const items = await c.env.DB.prepare(`
    SELECT * FROM playlist_items 
    WHERE playlist_id = ? 
    ORDER BY sort_order ASC
  `).bind(playlistId).all()
  
  // 사용자 설정 가져오기
  const userSettings = await c.env.DB.prepare(`
    SELECT use_master_playlist, master_playlist_mode FROM users WHERE id = ?
  `).bind(user.id).first()
  
  // 마스터 플레이리스트 아이템 가져오기 (항상 표시)
  let masterItems: any[] = []
  const masterPlaylist = await c.env.DB.prepare(`
    SELECT p.id FROM playlists p
    JOIN users u ON p.user_id = u.id
    WHERE u.is_master = 1 AND p.is_master_playlist = 1 AND p.is_active = 1
    LIMIT 1
  `).first()
  
  if (masterPlaylist) {
    const masterItemsResult = await c.env.DB.prepare(`
      SELECT * FROM playlist_items 
      WHERE playlist_id = ? 
      ORDER BY sort_order ASC
    `).bind(masterPlaylist.id).all()
    // 마스터 아이템에 is_master 플래그 추가
    masterItems = (masterItemsResult.results || []).map((item: any) => ({
      ...item,
      is_master: true
    }))
  }
  
  // 사용자 아이템에 is_master: false 추가
  const userItems = (items.results || []).map((item: any) => ({
    ...item,
    is_master: false
  }))
  
  // active_item_ids 파싱
  // active_item_ids가 null이면 아직 설정 안된 기존 플레이리스트 (하위 호환성)
  // active_item_ids가 '[]'이면 명시적으로 비워둔 것
  let activeItemIds: number[] = []
  const rawActiveItemIds = (playlist as any).active_item_ids
  
  if (rawActiveItemIds === null || rawActiveItemIds === undefined) {
    // 기존 플레이리스트: active_item_ids가 설정되지 않음 → 현재 아이템으로 초기화 후 저장
    activeItemIds = [
      ...masterItems.map((item: any) => item.id),
      ...userItems.map((item: any) => item.id)
    ]

    try {
      await c.env.DB.prepare(`
        UPDATE playlists SET active_item_ids = ?, updated_at = datetime('now')
        WHERE id = ? AND user_id = ?
      `).bind(JSON.stringify(activeItemIds), playlistId, user.id).run()
    } catch (e) {
      console.log('[Playlist] Failed to backfill active_item_ids:', e)
    }
  } else {
    // 새 플레이리스트: active_item_ids가 설정됨 → 해당 값 그대로 사용
    try {
      activeItemIds = JSON.parse(rawActiveItemIds || '[]')
      activeItemIds = Array.isArray(activeItemIds)
        ? activeItemIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id))
        : []
    } catch (e) {
      activeItemIds = []
    }
  }
  
  return c.json({ 
    playlist: { ...playlist, items: userItems, activeItemIds },
    masterItems: masterItems,
    masterPlaylistMode: userSettings?.master_playlist_mode || 'before'
  })
})

// ============================================
// 플레이리스트 아이템 API
// ============================================

app.post('/api/:adminCode/playlists/:id/items', async (c) => {
  const adminCode = c.req.param('adminCode')
  const playlistId = c.req.param('id')
  const user = await getOrCreateUser(c.env.DB, adminCode)
  const { url, title, display_time, add_to_playlist } = await c.req.json()
  const shouldAddToPlaylist = add_to_playlist !== false
  
  const playlist = await c.env.DB.prepare(`
    SELECT id FROM playlists WHERE id = ? AND user_id = ?
  `).bind(playlistId, user.id).first()
  
  if (!playlist) {
    return c.json({ error: '플레이리스트를 찾을 수 없습니다.' }, 404)
  }
  
  let itemType = 'image'
  let thumbnailUrl = url
  let videoId = ''
  let videoTitle = title || ''
  
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return c.json({ error: 'Vimeo URL만 지원됩니다.' }, 400)
  } else if (url.includes('vimeo.com')) {
    itemType = 'vimeo'
    videoId = extractVimeoId(url) || ''
    // Vimeo 썸네일 및 제목 가져오기 (oEmbed API 우선)
    if (videoId) {
      try {
        // oEmbed API 사용 (더 안정적)
        const oembedRes = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`)
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json() as any
          if (oembedData) {
            thumbnailUrl = oembedData.thumbnail_url || ''
            if (!videoTitle) {
              videoTitle = oembedData.title || ''
            }
          }
        } else {
          // 폴백: v2 API
          const vimeoRes = await fetch(`https://vimeo.com/api/v2/video/${videoId}.json`)
          if (vimeoRes.ok) {
            const vimeoData = await vimeoRes.json() as any[]
            if (vimeoData && vimeoData[0]) {
              thumbnailUrl = vimeoData[0].thumbnail_large || vimeoData[0].thumbnail_medium || ''
              if (!videoTitle) {
                videoTitle = vimeoData[0].title || ''
              }
            }
          }
        }
      } catch (e) {
        thumbnailUrl = ''
      }
    }
  }
  
  const maxOrder = await c.env.DB.prepare(`
    SELECT MAX(sort_order) as max_order FROM playlist_items WHERE playlist_id = ?
  `).bind(playlistId).first()
  
  const sortOrder = ((maxOrder?.max_order as number) || 0) + 1
  
  const result = await c.env.DB.prepare(`
    INSERT INTO playlist_items (playlist_id, item_type, url, title, thumbnail_url, display_time, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(playlistId, itemType, url, videoTitle, thumbnailUrl, display_time || 10, sortOrder).run()
  
  const newItemId = result.meta.last_row_id

  // active_item_ids 업데이트 정책
  const playlistData = await c.env.DB.prepare(
    'SELECT active_item_ids FROM playlists WHERE id = ? AND user_id = ?'
  ).bind(playlistId, user.id).first() as any

  const rawActiveIds = playlistData?.active_item_ids

  if (shouldAddToPlaylist) {
    // 재생목록에 포함해야 하는 경우: 기존 목록에 새 아이템 추가
    let activeIds: number[] = []
    try {
      activeIds = rawActiveIds ? JSON.parse(rawActiveIds as string) : []
    } catch (e) {
      activeIds = []
    }

    // active_item_ids가 비어있으면 현재 전체 아이템으로 초기화
    if (!rawActiveIds) {
      const existing = await c.env.DB.prepare(
        'SELECT id FROM playlist_items WHERE playlist_id = ? ORDER BY sort_order ASC'
      ).bind(playlistId).all()
      activeIds = (existing.results || []).map((r: any) => r.id)
    }

    if (!activeIds.includes(newItemId)) {
      activeIds.push(newItemId)
    }

    await c.env.DB.prepare('UPDATE playlists SET active_item_ids = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(JSON.stringify(activeIds), playlistId).run()
  } else {
    // 라이브러리만 추가: active_item_ids가 없을 때는 기존 목록으로만 초기화 (새 아이템 제외)
    if (rawActiveIds === null || rawActiveIds === undefined) {
      const existing = await c.env.DB.prepare(
        'SELECT id FROM playlist_items WHERE playlist_id = ? ORDER BY sort_order ASC'
      ).bind(playlistId).all()
      const activeIds = (existing.results || []).map((r: any) => r.id).filter((id: number) => id !== newItemId)

      await c.env.DB.prepare('UPDATE playlists SET active_item_ids = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .bind(JSON.stringify(activeIds), playlistId).run()
    }
  }
  
  return c.json({ 
    success: true,
    item: {
      id: newItemId,
      item_type: itemType,
      url,
      title: videoTitle,
      thumbnail_url: thumbnailUrl,
      display_time: display_time || 10,
      sort_order: sortOrder
    }
  })
})

app.put('/api/:adminCode/playlists/:playlistId/items/:itemId', async (c) => {
  try {
    const adminCode = c.req.param('adminCode')
    const { playlistId, itemId } = c.req.param()
    const user = await getOrCreateUser(c.env.DB, adminCode)
    const body = await c.req.json()
    // undefined를 null로 변환 (D1은 undefined를 지원하지 않음)
    const title = body.title !== undefined ? body.title : null
    const display_time = body.display_time !== undefined ? body.display_time : null
    const sort_order = body.sort_order !== undefined ? body.sort_order : null
    const thumbnail_url = body.thumbnail_url !== undefined ? body.thumbnail_url : null
    
    const playlist = await c.env.DB.prepare(`
      SELECT id FROM playlists WHERE id = ? AND user_id = ?
    `).bind(playlistId, user.id).first()
    
    if (!playlist) {
      return c.json({ error: '권한이 없습니다.' }, 403)
    }
    
    await c.env.DB.prepare(`
      UPDATE playlist_items 
      SET title = COALESCE(?, title),
          display_time = COALESCE(?, display_time),
          sort_order = COALESCE(?, sort_order),
          thumbnail_url = COALESCE(?, thumbnail_url)
      WHERE id = ? AND playlist_id = ?
    `).bind(title, display_time, sort_order, thumbnail_url, itemId, playlistId).run()
    
    return c.json({ success: true })
  } catch (e: any) {
    console.error('Item update error:', e)
    return c.json({ error: e.message || '서버 오류' }, 500)
  }
})

app.delete('/api/:adminCode/playlists/:playlistId/items/:itemId', async (c) => {
  const adminCode = c.req.param('adminCode')
  const { playlistId, itemId } = c.req.param()
  const user = await getOrCreateUser(c.env.DB, adminCode)
  
  const playlist = await c.env.DB.prepare(`
    SELECT id FROM playlists WHERE id = ? AND user_id = ?
  `).bind(playlistId, user.id).first()
  
  if (!playlist) {
    return c.json({ error: '권한이 없습니다.' }, 403)
  }
  
  // 삭제 전 아이템 정보 조회 (로깅용)
  const itemToDelete = await c.env.DB.prepare(`
    SELECT * FROM playlist_items WHERE id = ? AND playlist_id = ?
  `).bind(itemId, playlistId).first()
  
  if (!itemToDelete) {
    return c.json({ error: '아이템을 찾을 수 없습니다.' }, 404)
  }
  
  // 삭제 실행
  const result = await c.env.DB.prepare(`
    DELETE FROM playlist_items WHERE id = ? AND playlist_id = ?
  `).bind(itemId, playlistId).run()
  
  // active_item_ids에서 삭제된 항목 제거
  const playlistRow = await c.env.DB.prepare(`
    SELECT active_item_ids FROM playlists WHERE id = ?
  `).bind(playlistId).first<any>()

  if (playlistRow?.active_item_ids) {
    let activeIds: number[] = []
    try {
      activeIds = JSON.parse(playlistRow.active_item_ids)
    } catch (e) {
      activeIds = []
    }

    const itemIdNum = parseInt(itemId, 10)
    const normalized = (activeIds || [])
      .map((id: any) => parseInt(id, 10))
      .filter((id: number) => !Number.isNaN(id))

    const filtered = normalized.filter((id: number) => id !== itemIdNum)

    await c.env.DB.prepare(`
      UPDATE playlists SET active_item_ids = ? WHERE id = ?
    `).bind(JSON.stringify(filtered), playlistId).run()
  }
  
  // 삭제 로그 (console.log는 Cloudflare Workers 로그에서 확인 가능)
  console.log(`[ITEM_DELETE] adminCode=${adminCode}, playlistId=${playlistId}, itemId=${itemId}, url=${(itemToDelete as any).url}, deletedAt=${new Date().toISOString()}`)
  
  return c.json({ success: true, deleted: itemToDelete })
})

// 아이템 순서 재정렬 API
app.put('/api/:adminCode/playlists/:playlistId/reorder', async (c) => {
  const adminCode = c.req.param('adminCode')
  const playlistId = c.req.param('playlistId')
  const user = await getOrCreateUser(c.env.DB, adminCode)
  const { items } = await c.req.json() // items: [{id: number, sort_order: number}]
  
  const playlist = await c.env.DB.prepare(`
    SELECT id FROM playlists WHERE id = ? AND user_id = ?
  `).bind(playlistId, user.id).first()
  
  if (!playlist) {
    return c.json({ error: '권한이 없습니다.' }, 403)
  }
  
  // 각 아이템의 순서 업데이트
  for (const item of items) {
    await c.env.DB.prepare(`
      UPDATE playlist_items SET sort_order = ? WHERE id = ? AND playlist_id = ?
    `).bind(item.sort_order, item.id, playlistId).run()
  }
  
  return c.json({ success: true })
})

// 플레이리스트 활성 아이템 업데이트 API (재생목록에 표시할 아이템 ID 목록)
app.put('/api/:adminCode/playlists/:playlistId/active-items', async (c) => {
  const adminCode = c.req.param('adminCode')
  const playlistId = c.req.param('playlistId')
  const user = await getOrCreateUser(c.env.DB, adminCode)
  const { activeItemIds } = await c.req.json() // activeItemIds: number[]
  
  const playlist = await c.env.DB.prepare(`
    SELECT id FROM playlists WHERE id = ? AND user_id = ?
  `).bind(playlistId, user.id).first()
  
  if (!playlist) {
    return c.json({ error: '권한이 없습니다.' }, 403)
  }
  
  await c.env.DB.prepare(`
    UPDATE playlists SET active_item_ids = ? WHERE id = ?
  `).bind(JSON.stringify(activeItemIds || []), playlistId).run()
  
  return c.json({ success: true })
})

// ===== 임시 영상 전송 API =====
// 임시 영상 상태 조회
app.get('/api/:adminCode/playlists/:playlistId/temp-video', async (c) => {
  const playlistId = c.req.param('playlistId')
  
  const result = await c.env.DB.prepare(`
    SELECT temp_video_url, temp_video_title, temp_video_type, temp_return_time
    FROM playlists WHERE id = ?
  `).bind(playlistId).first<any>()
  
  if (!result || !result.temp_video_url) {
    return c.json({ active: false })
  }
  
  return c.json({
    active: true,
    url: result.temp_video_url,
    title: result.temp_video_title,
    type: result.temp_video_type,
    return_time: result.temp_return_time
  })
})

// 임시 영상 설정
app.post('/api/:adminCode/playlists/:playlistId/temp-video', async (c) => {
  const adminCode = c.req.param('adminCode')
  const playlistId = c.req.param('playlistId')
  const user = await getOrCreateUser(c.env.DB, adminCode)
  
  const playlist = await c.env.DB.prepare(`
    SELECT id, name FROM playlists WHERE id = ? AND user_id = ?
  `).bind(playlistId, user.id).first() as any
  
  if (!playlist) {
    return c.json({ error: '권한이 없습니다.' }, 403)
  }
  
  // 대기실(이름에 '체어'가 없는 경우)은 임시 영상 기능 비활성화
  if (!playlist.name || !playlist.name.includes('체어')) {
    return c.json({ error: '대기실에는 임시 영상을 보낼 수 없습니다.' }, 400)
  }
  
  const { url, title, type, return_time } = await c.req.json()
  
  await c.env.DB.prepare(`
    UPDATE playlists 
    SET temp_video_url = ?, temp_video_title = ?, temp_video_type = ?, temp_return_time = ?
    WHERE id = ?
  `).bind(url, title, type, return_time || 'manual', playlistId).run()
  
  return c.json({ success: true })
})

// TV에서 임시 영상 해제 (영상 끝나면 자동 복귀용)
app.post('/api/tv/:shortCode/clear-temp', async (c) => {
  const shortCode = c.req.param('shortCode')
  
  await c.env.DB.prepare(`
    UPDATE playlists 
    SET temp_video_url = NULL, temp_video_title = NULL, temp_video_type = NULL, temp_return_time = NULL, temp_started_at = NULL
    WHERE short_code = ?
  `).bind(shortCode).run()
  
  return c.json({ success: true })
})

// TV 비활성화 (탭 닫힘 시 last_active_at을 1시간 전으로 설정 → 사용중 해제, 설치필요 뱃지 유지)
app.post('/api/tv/:shortCode/deactivate', async (c) => {
  const shortCode = c.req.param('shortCode')
  
  await c.env.DB.prepare(`
    UPDATE playlists SET last_active_at = datetime('now', '-1 hour') WHERE short_code = ?
  `).bind(shortCode).run()
  
  return c.json({ success: true })
})

// TV heartbeat - 경량 API (last_active_at만 업데이트, 데이터 로드 없음)
app.post('/api/tv/:shortCode/heartbeat', async (c) => {
  const shortCode = c.req.param('shortCode')
  
  await c.env.DB.prepare(`
    UPDATE playlists SET last_active_at = datetime('now') WHERE short_code = ?
  `).bind(shortCode).run()
  
  return c.json({ ok: true })
})

// 임시 영상 해제 (기본으로 복귀)
app.delete('/api/:adminCode/playlists/:playlistId/temp-video', async (c) => {
  const adminCode = c.req.param('adminCode')
  const playlistId = c.req.param('playlistId')
  const user = await getOrCreateUser(c.env.DB, adminCode)
  
  const playlist = await c.env.DB.prepare(`
    SELECT id FROM playlists WHERE id = ? AND user_id = ?
  `).bind(playlistId, user.id).first()
  
  if (!playlist) {
    return c.json({ error: '권한이 없습니다.' }, 403)
  }
  
  await c.env.DB.prepare(`
    UPDATE playlists 
    SET temp_video_url = NULL, temp_video_title = NULL, temp_video_type = NULL, temp_return_time = NULL, temp_started_at = NULL
    WHERE id = ?
  `).bind(playlistId).run()
  
  return c.json({ success: true })
})

// Vimeo 썸네일 가져오기 API (oEmbed 사용)
app.get('/api/vimeo-thumbnail/:videoId', async (c) => {
  const videoId = c.req.param('videoId')
  
  try {
    // oEmbed API 사용 (더 안정적)
    const oembedRes = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`)
    if (oembedRes.ok) {
      const data = await oembedRes.json() as any
      if (data && data.thumbnail_url) {
        return c.json({ 
          success: true, 
          thumbnail: data.thumbnail_url,
          title: data.title || ''
        })
      }
    }
    
    // 폴백: v2 API
    const res = await fetch(`https://vimeo.com/api/v2/video/${videoId}.json`)
    if (res.ok) {
      const data = await res.json() as any[]
      if (data && data[0]) {
        return c.json({ 
          success: true, 
          thumbnail: data[0].thumbnail_large || data[0].thumbnail_medium,
          title: data[0].title
        })
      }
    }
    return c.json({ success: false, thumbnail: '' })
  } catch (e) {
    return c.json({ success: false, thumbnail: '' })
  }
})

// ============================================
// 공지사항 API
// ============================================

app.get('/api/:adminCode/notices', async (c) => {
  const adminCode = c.req.param('adminCode')
  const user = await getOrCreateUser(c.env.DB, adminCode)
  
  const notices = await c.env.DB.prepare(`
    SELECT * FROM notices WHERE user_id = ? ORDER BY sort_order ASC, created_at DESC
  `).bind(user.id).all()
  
  return c.json({ notices: notices.results })
})

app.post('/api/:adminCode/notices', async (c) => {
  const adminCode = c.req.param('adminCode')
  const user = await getOrCreateUser(c.env.DB, adminCode)
  const { content, position, font_size, text_color, bg_color, scroll_speed, is_urgent } = await c.req.json()
  
  if (!content) {
    return c.json({ error: '공지 내용을 입력해주세요.' }, 400)
  }
  
  // 사용자의 글로벌 공지 설정을 기본값으로 사용
  const result = await c.env.DB.prepare(`
    INSERT INTO notices (user_id, content, position, font_size, text_color, bg_color, scroll_speed, is_urgent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    user.id, 
    content, 
    position || 'bottom',
    font_size || user.notice_font_size || 32,
    text_color || user.notice_text_color || '#ffffff',
    bg_color || user.notice_bg_color || '#1a1a2e',
    scroll_speed || user.notice_scroll_speed || 50,
    is_urgent || 0
  ).run()
  
  return c.json({ 
    success: true,
    notice: { id: result.meta.last_row_id }
  })
})

app.put('/api/:adminCode/notices/:id', async (c) => {
  const adminCode = c.req.param('adminCode')
  const noticeId = c.req.param('id')
  const user = await getOrCreateUser(c.env.DB, adminCode)
  const body = await c.req.json()
  
  // undefined를 null로 변환 (D1은 undefined를 허용하지 않음)
  const toNull = (v: any) => v === undefined ? null : v
  
  await c.env.DB.prepare(`
    UPDATE notices 
    SET content = COALESCE(?, content),
        is_active = COALESCE(?, is_active),
        position = COALESCE(?, position),
        font_size = COALESCE(?, font_size),
        text_color = COALESCE(?, text_color),
        bg_color = COALESCE(?, bg_color),
        scroll_speed = COALESCE(?, scroll_speed),
        is_urgent = COALESCE(?, is_urgent),
        updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).bind(
    toNull(body.content), 
    toNull(body.is_active), 
    toNull(body.position), 
    toNull(body.font_size), 
    toNull(body.text_color), 
    toNull(body.bg_color), 
    toNull(body.scroll_speed), 
    toNull(body.is_urgent), 
    noticeId, 
    user.id
  ).run()
  
  return c.json({ success: true })
})

app.delete('/api/:adminCode/notices/:id', async (c) => {
  const adminCode = c.req.param('adminCode')
  const noticeId = c.req.param('id')
  const user = await getOrCreateUser(c.env.DB, adminCode)
  
  await c.env.DB.prepare(`
    DELETE FROM notices WHERE id = ? AND user_id = ?
  `).bind(noticeId, user.id).run()
  
  return c.json({ success: true })
})

// 공지 순서 변경 API
app.put('/api/:adminCode/notices/reorder', async (c) => {
  const adminCode = c.req.param('adminCode')
  const user = await getOrCreateUser(c.env.DB, adminCode)
  const { order } = await c.req.json() // order: [id1, id2, id3, ...]
  
  if (!order || !Array.isArray(order)) {
    return c.json({ error: '순서 데이터가 없습니다.' }, 400)
  }
  
  // 각 공지의 sort_order 업데이트
  for (let i = 0; i < order.length; i++) {
    await c.env.DB.prepare(`
      UPDATE notices SET sort_order = ? WHERE id = ? AND user_id = ?
    `).bind(i, order[i], user.id).run()
  }
  
  return c.json({ success: true })
})

// ============================================
// 설정 API
// ============================================

app.put('/api/:adminCode/settings', async (c) => {
  const adminCode = c.req.param('adminCode')
  const body = await c.req.json()
  
  // undefined를 null로 변환 (D1은 undefined를 허용하지 않음)
  const toNull = (v: any) => v === undefined ? null : v
  
  await c.env.DB.prepare(`
    UPDATE users SET 
      clinic_name = COALESCE(?, clinic_name),
      notice_font_size = COALESCE(?, notice_font_size),
      notice_letter_spacing = COALESCE(?, notice_letter_spacing),
      notice_text_color = COALESCE(?, notice_text_color),
      notice_bg_color = COALESCE(?, notice_bg_color),
      notice_bg_opacity = COALESCE(?, notice_bg_opacity),
      notice_scroll_speed = COALESCE(?, notice_scroll_speed),
      notice_enabled = COALESCE(?, notice_enabled),
      notice_position = COALESCE(?, notice_position),
      logo_url = COALESCE(?, logo_url),
      logo_size = COALESCE(?, logo_size),
      logo_opacity = COALESCE(?, logo_opacity),
      schedule_enabled = COALESCE(?, schedule_enabled),
      schedule_start = COALESCE(?, schedule_start),
      schedule_end = COALESCE(?, schedule_end),
      use_master_playlist = COALESCE(?, use_master_playlist),
      master_playlist_mode = COALESCE(?, master_playlist_mode),
      hidden_master_items = COALESCE(?, hidden_master_items),
      updated_at = datetime('now')
    WHERE admin_code = ?
  `).bind(
    toNull(body.clinic_name), 
    toNull(body.notice_font_size), 
    toNull(body.notice_letter_spacing),
    toNull(body.notice_text_color), 
    toNull(body.notice_bg_color), 
    toNull(body.notice_bg_opacity), 
    toNull(body.notice_scroll_speed),
    toNull(body.notice_enabled),
    toNull(body.notice_position),
    toNull(body.logo_url), 
    toNull(body.logo_size), 
    toNull(body.logo_opacity), 
    toNull(body.schedule_enabled),
    toNull(body.schedule_start), 
    toNull(body.schedule_end),
    toNull(body.use_master_playlist),
    toNull(body.master_playlist_mode),
    toNull(body.hidden_master_items),
    adminCode
  ).run()
  
  return c.json({ success: true })
})

// 설정 가져오기 API
app.get('/api/:adminCode/settings', async (c) => {
  const adminCode = c.req.param('adminCode')
  const user = await getOrCreateUser(c.env.DB, adminCode)
  
  return c.json({
    clinic_name: user.clinic_name,
    notice_font_size: user.notice_font_size || 32,
    notice_letter_spacing: user.notice_letter_spacing ?? 0,
    notice_text_color: user.notice_text_color || '#ffffff',
    notice_bg_color: user.notice_bg_color || '#1a1a2e',
    notice_bg_opacity: user.notice_bg_opacity ?? 100,
    notice_scroll_speed: user.notice_scroll_speed || 50,
    notice_enabled: user.notice_enabled ?? 0,
    notice_position: user.notice_position || 'bottom',
    logo_url: user.logo_url || '',
    logo_size: user.logo_size || 150,
    logo_opacity: user.logo_opacity || 90,
    schedule_enabled: user.schedule_enabled || 0,
    schedule_start: user.schedule_start || '',
    schedule_end: user.schedule_end || '',
    use_master_playlist: user.use_master_playlist ?? 1,
    master_playlist_mode: user.master_playlist_mode || 'before',
    hidden_master_items: user.hidden_master_items || '[]'
  })
})

// ============================================
// TV → 관리자 페이지 직접 이동용 토큰 발급 API
// shortCode로 해당 플레이리스트 계정의 세션 토큰을 발급해 관리자 URL 반환
// localStorage 우회 목적 (동시접속 차단 없이 TV 계정으로 바로 이동)
app.post('/api/tv-admin-token/:shortCode', async (c) => {
  const shortCode = c.req.param('shortCode')

  const playlist = await c.env.DB.prepare(`
    SELECT p.id, u.id as user_id, u.admin_code, u.imweb_email, u.is_active, u.suspended_reason
    FROM playlists p
    JOIN users u ON p.user_id = u.id
    WHERE p.short_code = ? AND p.is_active = 1
  `).bind(shortCode).first() as any

  if (!playlist) {
    return c.json({ success: false, error: '플레이리스트를 찾을 수 없습니다.' }, 404)
  }

  if (playlist.is_active === 0) {
    return c.json({ success: false, error: '정지된 계정입니다.' }, 403)
  }

  // 세션 발급 (기존 세션 삭제 없이 추가 - 동시접속 허용)
  const sessionToken = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
  await c.env.DB.prepare(`
    INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)
  `).bind(sessionToken, playlist.user_id, expiresAt).run()

  const baseUrl = new URL(c.req.url).origin
  const adminUrl = new URL(baseUrl + '/admin/' + playlist.admin_code)
  adminUrl.searchParams.set('session', sessionToken)
  if (playlist.imweb_email) adminUrl.searchParams.set('email', playlist.imweb_email)

  return c.json({
    success: true,
    adminUrl: adminUrl.toString(),
    adminCode: playlist.admin_code,
    email: playlist.imweb_email || ''
  })
})

// TV 미러링 페이지 API
// ============================================

app.get('/api/tv/:shortCode', async (c) => {
  // 강력한 캐시 무효화 헤더 (브라우저가 절대 저장하지 않도록 함)
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');
  c.header('Surrogate-Control', 'no-store'); // Cloudflare 캐시 방지
  
  const shortCode = c.req.param('shortCode')
  
  // 사용자 공지 설정, 로고, 재생시간 설정, 마스터 플레이리스트 설정도 함께 가져오기
  const playlist = await c.env.DB.prepare(`
    SELECT p.*, u.clinic_name, u.id as user_id, u.admin_code, u.imweb_email,
      u.notice_font_size, u.notice_letter_spacing, u.notice_text_color, u.notice_bg_color, u.notice_bg_opacity, u.notice_scroll_speed, u.notice_enabled, u.notice_position,
      u.logo_url, u.logo_size, u.logo_opacity, u.schedule_enabled, u.schedule_start, u.schedule_end,
      u.use_master_playlist, u.master_playlist_mode, u.hidden_master_items
    FROM playlists p
    JOIN users u ON p.user_id = u.id
    WHERE p.short_code = ? AND p.is_active = 1
  `).bind(shortCode).first()
  
  if (!playlist) {
    return c.json({ error: '플레이리스트를 찾을 수 없습니다.' }, 404)
  }
  
  // 사용자 플레이리스트 아이템
  const userItems = await c.env.DB.prepare(`
    SELECT * FROM playlist_items 
    WHERE playlist_id = ? 
    ORDER BY sort_order ASC
  `).bind(playlist.id).all()
  
  // 마스터 플레이리스트 아이템 가져오기
  let masterItems: any[] = []
  const masterPlaylist = await c.env.DB.prepare(`
    SELECT p.id FROM playlists p
    JOIN users u ON p.user_id = u.id
    WHERE u.is_master = 1 AND p.is_master_playlist = 1 AND p.is_active = 1
    LIMIT 1
  `).first()
  
  if (masterPlaylist) {
    const masterItemsResult = await c.env.DB.prepare(`
      SELECT * FROM playlist_items 
      WHERE playlist_id = ? 
      ORDER BY sort_order ASC
    `).bind(masterPlaylist.id).all()
    
    // 숨긴 공용 영상 필터링
    const hiddenIds: number[] = JSON.parse(playlist.hidden_master_items || '[]')
    masterItems = (masterItemsResult.results || []).filter((item: any) => !hiddenIds.includes(item.id))
  }
  
  // active_item_ids 파싱
  // null/undefined/빈 문자열이면 기존 플레이리스트 (하위 호환성)
  const rawActiveItemIds = (playlist as any).active_item_ids
  const hasActiveItemIds = rawActiveItemIds !== null && rawActiveItemIds !== undefined && rawActiveItemIds !== ''
  let activeItemIds: number[] = []
  
  if (hasActiveItemIds) {
    try {
      activeItemIds = JSON.parse(rawActiveItemIds || '[]')
      activeItemIds = Array.isArray(activeItemIds)
        ? activeItemIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id))
        : []
    } catch (e) {
      activeItemIds = []
    }
  }
  
  let combinedItems: any[] = []
  
  if (!hasActiveItemIds) {
    // 하위 호환성: active_item_ids가 없을 때는 사용자 아이템만 재생
    combinedItems = userItems.results || []
  } else {
    // active_item_ids가 설정됨: 해당 ID만 순서대로 재생 (빈 배열이면 아무것도 재생 안함)
    const allItemsMap = new Map<number, any>()
    masterItems.forEach((item: any) => allItemsMap.set(item.id, { ...item, is_master: true }))
    ;(userItems.results || []).forEach((item: any) => allItemsMap.set(item.id, { ...item, is_master: false }))
    
    combinedItems = activeItemIds
      .filter(id => allItemsMap.has(id))
      .map(id => allItemsMap.get(id))
  }
  
  const items = { results: combinedItems }
  
  // 영상이 없어도 TV는 대기 화면으로 처리
  
  // 활성화된 모든 공지 가져오기 (긴급공지 우선, 그 다음 sort_order 순)
  const allNotices = await c.env.DB.prepare(`
    SELECT * FROM notices 
    WHERE user_id = ? AND is_active = 1
    ORDER BY is_urgent DESC, sort_order ASC, created_at DESC
  `).bind(playlist.user_id).all()
  
  // 긴급공지가 있으면 긴급공지만, 없으면 일반 공지 모두
  const urgentNotices = allNotices.results.filter((n: any) => n.is_urgent === 1)
  const normalNotices = allNotices.results.filter((n: any) => n.is_urgent !== 1)
  const notices = urgentNotices.length > 0 ? urgentNotices : normalNotices
  
  // TV 접속 시간 업데이트 (heartbeat와 이중으로 업데이트하여 안정성 확보)
  await c.env.DB.prepare(`
    UPDATE playlists SET last_active_at = datetime('now') WHERE id = ?
  `).bind(playlist.id).run()
  
  // 임시 영상 체크 (대기실은 임시 영상 기능 비활성화 - 이름에 '체어'가 포함된 경우만 활성화)
  let tempVideo = null
  const isChair = playlist.name && playlist.name.includes('체어')
  if (isChair && (playlist as any).temp_video_url) {
    tempVideo = {
      url: (playlist as any).temp_video_url,
      title: (playlist as any).temp_video_title,
      type: (playlist as any).temp_video_type,
      return_time: (playlist as any).temp_return_time || 'manual'
    }
  }
  
  return c.json({
    playlist: {
      name: playlist.name,
      clinic_name: playlist.clinic_name,
      items: items.results,
      transition_effect: playlist.transition_effect || 'fade',
      transition_duration: playlist.transition_duration || 500
    },
    // TV 화면에서 관리자 페이지 이동 시 올바른 계정으로 연결하기 위해 adminCode 포함
    adminCode: (playlist as any).admin_code || null,
    adminEmail: (playlist as any).imweb_email || null,
    tempVideo, // 임시 영상 정보 추가
    notices, // 여러 공지 배열로 변경
    notice: notices[0] || null, // 하위 호환성을 위해 첫 번째 공지도 유지
    // 사용자 공통 공지 스타일 설정
    noticeSettings: {
      font_size: playlist.notice_font_size || 32,
      letter_spacing: playlist.notice_letter_spacing ?? 0,
      text_color: playlist.notice_text_color || '#ffffff',
      bg_color: playlist.notice_bg_color || '#1a1a2e',
      bg_opacity: playlist.notice_bg_opacity ?? 100,
      scroll_speed: playlist.notice_scroll_speed || 50,
      enabled: playlist.notice_enabled ?? 0,
      position: playlist.notice_position || 'bottom'
    },
    // 로고 설정
    logoSettings: {
      url: playlist.logo_url || '',
      size: playlist.logo_size || 150,
      opacity: playlist.logo_opacity || 90
    },
    // 재생 시간 설정
    scheduleSettings: {
      enabled: playlist.schedule_enabled || 0,
      start: playlist.schedule_start || '',
      end: playlist.schedule_end || ''
    },
    // 자막 스타일 설정 (마스터에서 가져옴)
    subtitleSettings: await (async () => {
      const master = await c.env.DB.prepare(
        'SELECT subtitle_font_size, subtitle_bg_opacity, subtitle_text_color, subtitle_bg_color, subtitle_position, subtitle_bottom_offset FROM users WHERE is_master = 1 LIMIT 1'
      ).first() as any
      return {
        font_size: master?.subtitle_font_size || 28,
        bg_opacity: master?.subtitle_bg_opacity || 80,
        text_color: master?.subtitle_text_color || '#ffffff',
        bg_color: master?.subtitle_bg_color || '#000000',
        position: master?.subtitle_position || 'bottom',
        bottom_offset: master?.subtitle_bottom_offset || 80
      }
    })()
  })
})

// ============================================
// 아임웹 임베드용 관리자 페이지 (admin 페이지로 리다이렉트)
// ============================================

// 아임웹 코드 위젯에서 iframe으로 호출 - 회원 코드 기반
app.get('/embed/:memberCode', async (c) => {
  const memberCode = c.req.param('memberCode')
  const memberName = c.req.query('name') || ''
  const memberEmail = c.req.query('email') || ''
  const isAdmin = c.req.query('is_admin') || c.req.query('admin') || ''

  const normalizedEmail = normalizeEmail(memberEmail)

  // ── 빠른 경로: DB에 이미 해당 member_code 사용자가 있으면 아임웹 API 완전 스킵 ──
  const existingUser = await c.env.DB.prepare(
    'SELECT * FROM users WHERE imweb_member_id = ?'
  ).bind(memberCode).first() as any

  if (existingUser) {
    // 기존 사용자 → redirect 없이 handleAdminPage 직접 호출 (네트워크 왕복 1회 절약)
    const adminCode = existingUser.admin_code
    const rawEmail = normalizedEmail || existingUser.imweb_email || ''
    const finalEmail = ADMIN_EMAILS.includes(rawEmail) ? '' : rawEmail
    const isMasterAdmin = adminCode === 'master_admin'
    const isAdminFlag = isAdmin === '1' || isAdmin === 'true' || isAdmin === 'Y' || isAdmin === 'yes' || isMasterAdmin
    return handleAdminPage(c, adminCode, finalEmail, isAdminFlag)
  }

  // ── 신규 사용자: 아임웹 API로 이메일/이름 검증 후 계정 생성 ──
  let imwebApiConfigured = false
  let imwebMemberValid = false
  let apiMemberName = ''
  let registeredEmail = ''
  try {
    const clientId = (c.env as any).IMWEB_CLIENT_ID
    const clientSecret = (c.env as any).IMWEB_CLIENT_SECRET

    if (clientId && clientSecret) {
      imwebApiConfigured = true
      const authRes = await fetch('https://api.imweb.me/v2/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: clientId, secret: clientSecret })
      })
      const authData = await authRes.json() as any

      if (authData.access_token) {
        const membersRes = await fetch('https://api.imweb.me/v2/member/members?member_code=' + encodeURIComponent(memberCode), {
          headers: { 'access-token': authData.access_token }
        })
        const membersData = await membersRes.json() as any
        if (membersData.code === 200 && membersData.data?.list?.length > 0) {
          const member = membersData.data.list[0]
          apiMemberName = member.name || ''
          registeredEmail = normalizeEmail(member.email || member.user_email || member.mail || '')
          if (registeredEmail && registeredEmail === normalizedEmail) {
            imwebMemberValid = true
          }
        }
      }
    }
  } catch (e) {
    console.error('Imweb API error (embed):', e)
  }

  let resolvedEmail = normalizedEmail
  if (!resolvedEmail && imwebApiConfigured) {
    if (registeredEmail && !ADMIN_EMAILS.includes(registeredEmail)) {
      resolvedEmail = registeredEmail
    }
  }

  if (!imwebMemberValid && resolvedEmail) {
    const dbUser = await c.env.DB.prepare(
      'SELECT * FROM users WHERE lower(imweb_email) = ? OR imweb_member_id = ?'
    ).bind(resolvedEmail, memberCode).first() as any
    if (!dbUser && imwebApiConfigured) {
      return c.html(`
        <div style="font-family: sans-serif; padding: 24px;">
          <h1 style="font-size: 20px; font-weight: 700; margin-bottom: 12px;">가입된 이메일과 계정이 일치하지 않습니다.</h1>
          <p style="margin: 4px 0;">등록 이메일: <strong>${registeredEmail || '확인 불가'}</strong></p>
          <p style="margin: 4px 0;">입력 이메일: <strong>${resolvedEmail}</strong></p>
        </div>
      `)
    }
  }

  const finalMemberName = apiMemberName || memberName
  const user = await getOrCreateUserByMemberCode(c.env.DB, memberCode, finalMemberName, resolvedEmail)

  if (!user) {
    return c.html('<h1>오류가 발생했습니다.</h1>')
  }

  const adminCode = (user as any).admin_code
  const rawFinalEmail = resolvedEmail || (user as any).imweb_email || ''
  const finalEmail = ADMIN_EMAILS.includes(rawFinalEmail) ? '' : rawFinalEmail
  const isMasterAdmin = adminCode === 'master_admin'
  const isAdminFlag = isAdmin === '1' || isAdmin === 'true' || isAdmin === 'Y' || isAdmin === 'yes' || isMasterAdmin
  // 신규 사용자도 redirect 없이 직접 handleAdminPage 호출
  return handleAdminPage(c, adminCode, finalEmail, isAdminFlag)
})

// 아임웹 임베드용 - 이전 코드 (사용하지 않음)
app.get('/embed-old/:memberCode', async (c) => {
  const memberCode = c.req.param('memberCode')
  const memberName = c.req.query('name') || ''
  const user = await getOrCreateUserByMemberCode(c.env.DB, memberCode, memberName)
  if (!user) {
    return c.html('<h1>오류가 발생했습니다.</h1>')
  }
  const adminCode = user.admin_code
  return c.html(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>대기실 TV 관리자</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    html, body { margin: 0; padding: 0; }
    .tab-active { border-bottom: 2px solid #3b82f6; color: #3b82f6; }
    .modal-backdrop { background: rgba(0,0,0,0.5); }
    .toast { animation: slideIn 0.3s ease; }
    @keyframes slideIn {
      from { transform: translateY(-100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .preview-frame { aspect-ratio: 16/9; background: #000; }
    .sortable-ghost { opacity: 0.4; background: #e0e7ff; }
    .sortable-drag { background: white; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
    .drag-handle { cursor: grab; }
    .drag-handle:active { cursor: grabbing; }
  </style>
</head>
<body class="bg-gray-100">
  <div id="app">
    <!-- 로딩 -->
    <div id="loading" class="fixed inset-0 bg-white flex items-center justify-center z-50">
      <div class="text-center">
        <i class="fas fa-spinner fa-spin text-4xl text-blue-500 mb-4"></i>
        <p class="text-gray-600">로딩 중...</p>
      </div>
    </div>
    
    <!-- 메인 대시보드 -->
    <div id="dashboard" class="hidden">
      <!-- 헤더 -->
      <header class="bg-white shadow-sm">
        <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <i class="fas fa-tv text-xl text-blue-500"></i>
            <div>
              <h1 class="text-lg font-bold text-gray-800">대기실 TV 관리자</h1>
              <p id="clinic-name" class="text-sm text-gray-500 cursor-pointer hover:text-blue-500" onclick="editClinicName()">
                <span id="clinic-name-text"></span>
                <i class="fas fa-pencil-alt ml-1 text-xs"></i>
              </p>
            </div>
          </div>
        </div>
      </header>
      
      <!-- 탭 네비게이션 -->
      <div class="bg-white border-b">
        <div class="max-w-7xl mx-auto px-4">
          <div class="flex gap-6">
            <button id="tab-playlists" class="py-3 border-b-2 border-blue-500 text-blue-500 font-medium text-sm"
              onclick="showTab('playlists')">
              <i class="fas fa-list mr-1"></i>플레이리스트
            </button>
            <button id="tab-notices" class="py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700 text-sm"
              onclick="showTab('notices')">
              <i class="fas fa-bullhorn mr-1"></i>공지사항
            </button>
          </div>
        </div>
      </div>
      
      <!-- 컨텐츠 영역 - 플레이리스트 -->
      <div id="content-playlists" class="max-w-7xl mx-auto px-4 py-4">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-bold text-gray-800">플레이리스트 관리</h2>
          <button onclick="createPlaylist()" class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 text-sm">
            <i class="fas fa-plus mr-1"></i>새 플레이리스트
          </button>
        </div>
        <div id="playlists-container" class="space-y-3"></div>
      </div>
      
      <!-- 컨텐츠 영역 - 공지사항 -->
      <div id="content-notices" class="hidden max-w-7xl mx-auto px-4 py-4">
        <!-- 공지 스타일 설정 -->
        <div id="notice-style-settings" class="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div class="flex items-center gap-2 mb-3">
            <i class="fas fa-palette text-purple-500"></i>
            <span class="font-bold text-gray-800 text-sm">공지 스타일 설정</span>
            <label class="flex items-center gap-2 ml-4">
              <input type="checkbox" id="global-notice-enabled" onchange="toggleGlobalNotice()" checked
                class="w-4 h-4 text-blue-500 rounded">
              <span class="text-sm text-gray-600">공지창 표시</span>
            </label>
          </div>
          
          <div class="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div>
              <label class="text-xs text-gray-500">폰트 크기</label>
              <input type="number" id="global-notice-font-size" value="32" min="16" max="300"
                class="w-full px-2 py-1 border rounded text-sm" onchange="saveGlobalNoticeSettings()">
            </div>
            <div>
              <label class="text-xs text-gray-500">자간</label>
              <input type="number" id="global-notice-letter-spacing" value="0" min="-5" max="30" step="0.5"
                class="w-full px-2 py-1 border rounded text-sm" oninput="updateNoticePreview(); scheduleSaveNoticeSettings()" onchange="saveGlobalNoticeSettings()">
            </div>
            <div>
              <label class="text-xs text-gray-500">스크롤 속도</label>
              <input type="range" id="global-notice-scroll-speed" value="50" min="10" max="500"
                class="w-full" oninput="updateScrollSpeedLabel()" onchange="saveGlobalNoticeSettings()">
              <span id="scroll-speed-label" class="text-xs text-gray-500">보통 (50)</span>
            </div>
            <div>
              <label class="text-xs text-gray-500">글자 색상</label>
              <input type="color" id="global-notice-text-color" value="#ffffff"
                class="w-full h-8 rounded" onchange="saveGlobalNoticeSettings()">
            </div>
            <div>
              <label class="text-xs text-gray-500">배경 색상</label>
              <input type="color" id="global-notice-bg-color" value="#1a1a2e"
                class="w-full h-8 rounded" onchange="saveGlobalNoticeSettings()">
            </div>
            <div>
              <label class="text-xs text-gray-500">배경 투명도</label>
              <input type="range" id="global-notice-bg-opacity" value="100" min="0" max="100" step="5"
                class="w-full" oninput="updateNoticeOpacityLabel()" onchange="saveGlobalNoticeSettings()">
              <span id="notice-opacity-label" class="text-xs text-gray-500">100%</span>
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">공지 위치</label>
              <input type="hidden" id="global-notice-position" value="bottom">
              <div class="flex gap-1">
                <button type="button" id="position-top-btn" onclick="setNoticePosition('top')"
                  class="flex-1 px-2 py-1.5 border rounded text-xs font-medium transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200">
                  <i class="fas fa-arrow-up mr-1"></i>상단
                </button>
                <button type="button" id="position-bottom-btn" onclick="setNoticePosition('bottom')"
                  class="flex-1 px-2 py-1.5 border rounded text-xs font-medium transition-colors bg-blue-500 text-white">
                  <i class="fas fa-arrow-down mr-1"></i>하단
                </button>
              </div>
            </div>
          </div>
          <div class="mt-3 p-2 rounded-lg overflow-hidden" id="notice-preview-bar" style="background: #1a1a2e; max-height: 60px;">
            <span id="notice-preview-text" style="color: #ffffff; font-size: 16px; font-weight: bold;">공지 미리보기</span>
          </div>
        </div>
        
        <!-- 공지 목록 -->
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-bold text-gray-800">공지사항 목록</h2>
          <button onclick="openNoticeModal()" class="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 text-sm">
            <i class="fas fa-plus mr-1"></i>새 공지사항
          </button>
        </div>
        <div id="notices-container" class="space-y-2"></div>
      </div>
      
    </div>
    
    <!-- 플레이리스트 편집 모달 -->
    <div id="edit-playlist-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 modal-backdrop" onclick="closeEditModal()"></div>
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col m-4">
        <div class="p-4 border-b flex justify-between items-center">
          <h2 id="edit-playlist-title" class="text-lg font-bold text-gray-800">플레이리스트 편집</h2>
          <button onclick="closeEditModal()" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        
        <div class="p-4 overflow-y-auto flex-1">
          <!-- 미디어 추가 -->
          <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div class="flex items-center gap-2 mb-2">
              <i class="fas fa-plus-circle text-green-500"></i>
              <span class="font-bold text-gray-800 text-sm">미디어 추가</span>
            </div>
            
            <div class="flex gap-2 mb-3">
              <button id="tab-video" onclick="switchMediaTab('video')" 
                class="flex-1 px-3 py-1.5 bg-blue-500 text-white rounded text-sm">
                <i class="fab fa-youtube mr-1"></i>동영상
              </button>
              <button id="tab-image" onclick="switchMediaTab('image')" 
                class="flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm">
                <i class="fas fa-image mr-1"></i>이미지
              </button>
            </div>
            
            <div id="input-video">
              <div class="flex gap-2">
                <input type="text" id="new-video-url" 
                  class="flex-1 px-3 py-2 border rounded text-sm"
                  placeholder="Vimeo URL">
                <button onclick="addVideoToLibrary()" class="bg-green-500 text-white px-4 py-2 rounded text-sm">추가</button>
              </div>
              <p class="text-xs text-gray-500 mt-2">플레이리스트 업로드는 Vimeo URL만 가능합니다.</p>
            </div>
            
            <div id="input-image" class="hidden">
              <div class="flex gap-2 mb-2">
                <input type="text" id="new-image-url" 
                  class="flex-1 px-3 py-2 border rounded text-sm"
                  placeholder="이미지 URL">
              </div>
              <div class="flex gap-2 items-center">
                <span class="text-sm text-gray-600">표시 시간:</span>
                <input type="number" id="new-image-display-time" value="10" min="1" max="300"
                  class="w-16 px-2 py-1 border rounded text-sm text-center">
                <span class="text-sm text-gray-500">초</span>
                <button onclick="addImageToLibrary()" class="bg-green-500 text-white px-4 py-2 rounded text-sm ml-auto">추가</button>
              </div>
            </div>
          </div>
          
          <!-- 마스터 영상 (숨김 - 통합됨) -->
          <div id="master-items-section" class="hidden"></div>
          
          <!-- 재생 목록 (공용 + 내 영상 통합) -->
          <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <i class="fas fa-list text-blue-500"></i>
                <span class="font-bold text-gray-800 text-sm">내 재생 목록</span>
              </div>
              <span class="text-xs text-gray-400">
                <i class="fas fa-grip-vertical mr-1"></i>드래그하여 순서 변경
              </span>
            </div>
            <p class="text-xs text-gray-400 mb-2">위에서부터 순서대로 재생되며, 마지막 미디어 후 처음부터 반복됩니다.</p>
            <div class="mb-2">
              <input type="text" id="playlist-search" placeholder="영상 이름 검색"
                class="w-full px-3 py-2 border rounded text-sm" oninput="updatePlaylistSearch()">
            </div>
            <div id="playlist-search-results" class="border rounded-lg max-h-40 overflow-y-auto mb-2 hidden"></div>
            <div id="playlist-items-container" class="border rounded-lg overflow-y-auto max-h-[360px] min-h-[140px]"></div>
          </div>
          
          <!-- 로고 설정 -->
          <div class="bg-gray-50 rounded-lg p-4 mb-4">
            <div class="flex items-center gap-2 mb-2">
              <i class="fas fa-image text-amber-500"></i>
              <span class="font-bold text-gray-800 text-sm">로고 설정</span>
            </div>
            <input type="text" id="logo-url" placeholder="로고 이미지 URL"
              class="w-full px-3 py-2 border rounded text-sm mb-2">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs text-gray-500">크기: <span id="logo-size-label">150px</span></label>
                <input type="range" id="logo-size" value="150" min="50" max="500"
                  class="w-full" oninput="updateLogoSizeLabel()">
              </div>
              <div>
                <label class="text-xs text-gray-500">투명도: <span id="logo-opacity-label">90%</span></label>
                <input type="range" id="logo-opacity" value="90" min="10" max="100"
                  class="w-full" oninput="updateLogoOpacityLabel()">
              </div>
            </div>
          </div>
          
          <!-- 전환 효과 -->
          <div class="bg-gray-50 rounded-lg p-4 mb-4">
            <div class="flex items-center gap-2 mb-2">
              <i class="fas fa-magic text-purple-500"></i>
              <span class="font-bold text-gray-800 text-sm">전환 효과</span>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <select id="transition-effect" class="px-3 py-2 border rounded text-sm">
                <option value="fade">페이드</option>
                <option value="slide-left">슬라이드 (왼쪽)</option>
                <option value="slide-right">슬라이드 (오른쪽)</option>
                <option value="zoom">줌</option>
                <option value="none">없음</option>
              </select>
              <div>
                <input type="range" id="transition-duration" value="1000" min="300" max="3000" step="100"
                  class="w-full" oninput="updateDurationLabel()">
                <span id="duration-label" class="text-xs text-gray-500">1000ms</span>
              </div>
            </div>
          </div>
          
          <!-- 재생 시간 설정 -->
          <div class="bg-gray-50 rounded-lg p-4">
            <div class="flex items-center gap-2 mb-2">
              <i class="fas fa-clock text-blue-500"></i>
              <span class="font-bold text-gray-800 text-sm">재생 시간 설정</span>
              <label class="flex items-center gap-2 ml-auto">
                <input type="checkbox" id="schedule-enabled" onchange="toggleScheduleInputs(this.checked)"
                  class="w-4 h-4 text-blue-500 rounded">
                <span class="text-sm text-gray-600">사용</span>
              </label>
            </div>
            <div id="schedule-inputs" class="hidden grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs text-gray-500">시작 시간</label>
                <input type="time" id="schedule-start" class="w-full px-3 py-2 border rounded text-sm">
              </div>
              <div>
                <label class="text-xs text-gray-500">종료 시간</label>
                <input type="time" id="schedule-end" class="w-full px-3 py-2 border rounded text-sm">
              </div>
            </div>
          </div>
          

        </div>
        
        <div class="p-4 border-t flex justify-end gap-2">
          <button onclick="closeEditModal()" class="px-4 py-2 border rounded text-sm">닫기</button>
          <button onclick="saveAllSettings()" class="bg-blue-500 text-white px-4 py-2 rounded text-sm">저장</button>
        </div>
      </div>
    </div>
    
    <!-- 공지사항 편집 모달 -->
    <div id="notice-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 modal-backdrop" onclick="closeNoticeModal()"></div>
      <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-lg m-4">
        <div class="p-4 border-b flex justify-between items-center">
          <h2 id="notice-modal-title" class="text-lg font-bold">새 공지사항</h2>
          <button onclick="closeNoticeModal()" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div class="p-4">
          <div class="mb-3">
            <label class="block text-sm font-medium text-gray-700 mb-1">공지 내용</label>
            <textarea id="notice-content" rows="3" class="w-full px-3 py-2 border rounded text-sm"
              placeholder="공지 내용을 입력하세요"></textarea>
          </div>
          <label class="flex items-center gap-2">
            <input type="checkbox" id="notice-urgent" class="w-4 h-4 text-red-500 rounded">
            <span class="text-sm text-gray-700">긴급 공지 (빨간색 강조)</span>
          </label>
        </div>
        <div class="p-4 border-t flex justify-end gap-2">
          <button onclick="closeNoticeModal()" class="px-4 py-2 border rounded text-sm">취소</button>
          <button onclick="saveNotice()" class="bg-blue-500 text-white px-4 py-2 rounded text-sm">저장</button>
        </div>
      </div>
    </div>
    
    <!-- 치과명 변경 모달 -->
    <div id="clinic-name-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 modal-backdrop" onclick="closeClinicNameModal()"></div>
      <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-sm m-4">
        <div class="p-4 border-b">
          <h2 class="text-lg font-bold">치과명 변경</h2>
        </div>
        <form onsubmit="saveClinicName(event)" class="p-4">
          <input type="text" id="edit-clinic-name" required
            class="w-full px-3 py-2 border rounded text-sm mb-4" placeholder="치과명">
          <div class="flex justify-end gap-2">
            <button type="button" onclick="closeClinicNameModal()" class="px-4 py-2 border rounded text-sm">취소</button>
            <button type="submit" class="bg-blue-500 text-white px-4 py-2 rounded text-sm">저장</button>
          </div>
        </form>
      </div>
    </div>
    
    <!-- 미리보기 모달 -->
    <div id="preview-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 modal-backdrop" onclick="closePreviewModal()"></div>
      <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl m-4">
        <div class="p-3 border-b flex justify-between items-center">
          <h2 class="text-lg font-bold">TV 미리보기</h2>
          <button onclick="closePreviewModal()" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div class="p-4">
          <div class="preview-frame rounded-lg overflow-hidden">
            <iframe id="preview-iframe" class="w-full h-full" style="min-height: 400px;" allow="autoplay; fullscreen; picture-in-picture"></iframe>
          </div>
        </div>
      </div>
    </div>
    
    <!-- QR 코드 모달 -->
    <div id="qr-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 modal-backdrop" onclick="closeQrModal()"></div>
      <div class="relative bg-white rounded-xl shadow-2xl p-6 m-4 text-center">
        <h3 class="text-lg font-bold mb-4">TV에서 QR 스캔</h3>
        <img id="qr-image" class="mx-auto mb-4">
        <p id="qr-url" class="text-sm text-gray-500 break-all"></p>
        <button onclick="closeQrModal()" class="mt-4 px-4 py-2 border rounded text-sm">닫기</button>
      </div>
    </div>
    
    <!-- 토스트 -->
    <div id="toast" class="hidden fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white toast"></div>
  </div>
  
  <script>
    const API_BASE = '/api/imweb_${memberCode}';
    let playlists = [];
    let currentPlaylist = null;
    let notices = [];
    let editingNoticeId = null;
    let playlistSortable = null;
    let noticesSortable = null;
    
    // 초기화
    document.addEventListener('DOMContentLoaded', async () => {
      // 마스터 아이템 미리 로드 (병렬)
      const initialMasterItems = await loadMasterItems();
      masterItemsSignature = getMasterItemsSignature(initialMasterItems);
      startMasterItemsAutoRefresh();
      
      await loadPlaylists();
      await loadNotices();
      await loadNoticeSettings();
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('dashboard').classList.remove('hidden');
      startMasterItemsAutoRefresh();
      setupAutoHeight();
    });
    
    // 토스트 메시지
    function showToast(message, type = 'success') {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.className = 'fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white toast ' + 
        (type === 'error' ? 'bg-red-500' : 'bg-green-500');
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 3000);
    }

    // 임베드용 높이 자동 전송
    // 모달 열림 상태 플래그 (postParentHeight가 모달 높이를 덮어쓰지 않도록)
    let modalHeightLocked = false;
    
    function postParentHeight() {
      try {
        if (window.parent && window.parent !== window) {
          if (modalHeightLocked) return;
          // #app의 실제 콘텐츠 높이를 전송
          const appEl = document.getElementById('app');
          const height = appEl ? appEl.scrollHeight : document.body.scrollHeight;
          window.parent.postMessage({ type: 'setHeight', height }, '*');
        }
      } catch (e) {}
    }

    function setupAutoHeight() {
      postParentHeight();
      setTimeout(postParentHeight, 300);
      setTimeout(postParentHeight, 1000);
      window.addEventListener('resize', postParentHeight);

      try {
        const observer = new MutationObserver(() => {
          postParentHeight();
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      } catch (e) {
        // ignore
      }
    }
    
    // 탭 전환
    function showTab(tab) {
      document.getElementById('content-playlists').classList.toggle('hidden', tab !== 'playlists');
      document.getElementById('content-notices').classList.toggle('hidden', tab !== 'notices');
      
      ['playlists', 'notices'].forEach(t => {
        const tabBtn = document.getElementById('tab-' + t);
        if (!tabBtn) return;
        const isActive = t === tab;
        tabBtn.classList.toggle('border-blue-500', isActive);
        tabBtn.classList.toggle('text-blue-500', isActive);
        tabBtn.classList.toggle('border-transparent', !isActive);
        tabBtn.classList.toggle('text-gray-500', !isActive);
      });
    }
    
    // 미디어 탭 전환
    function switchMediaTab(tab) {
      document.getElementById('input-video').classList.toggle('hidden', tab !== 'video');
      document.getElementById('input-image').classList.toggle('hidden', tab !== 'image');
      document.getElementById('tab-video').className = 'flex-1 px-3 py-1.5 rounded text-sm ' + 
        (tab === 'video' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700');
      document.getElementById('tab-image').className = 'flex-1 px-3 py-1.5 rounded text-sm ' + 
        (tab === 'image' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700');
    }
    
    // 플레이리스트 로드
    async function loadPlaylists() {
      try {
        const res = await fetch(API_BASE + '/playlists');
        const data = await res.json();
        playlists = data.playlists || [];
        if (INITIAL_DATA.isOwnerAdmin) {
          document.getElementById('clinic-name-text').textContent = '관리자';
        } else {
          document.getElementById('clinic-name-text').textContent = data.clinic_name || '내 치과';
        }
        renderPlaylists();
        if (typeof postParentHeight === 'function') {
          setTimeout(postParentHeight, 50);
        }
      } catch (e) {
        console.error('Load playlists error:', e);
      }
    }
    
    // 플레이리스트 렌더링
    function renderPlaylists() {
      const container = document.getElementById('playlists-container');
      if (playlists.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-500"><i class="fas fa-list-ul text-4xl mb-2"></i><p>플레이리스트가 없습니다.</p></div>';
        if (typeof postParentHeight === 'function') {
          setTimeout(postParentHeight, 50);
        }
        return;
      }
      
      container.innerHTML = playlists.map(p => \`
        <div class="bg-white rounded-lg shadow-sm p-4">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <i class="fas fa-play text-blue-500"></i>
              </div>
              <div>
                <span class="font-bold text-gray-800">\${p.name}</span>
                <p class="text-sm text-gray-400">\${p.item_count || 0}개의 미디어</p>
              </div>
            </div>
            <div class="flex gap-2">
              <button onclick="openPlaylistEditor(\${p.id})" class="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 text-sm">
                <i class="fas fa-edit mr-1"></i>편집
              </button>
              <button onclick="deletePlaylist(\${p.id})" class="bg-red-50 text-red-500 p-1.5 rounded-lg hover:bg-red-100">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          
          <!-- TV 연결 -->
          <div class="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 text-white">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <i class="fas fa-tv text-lg"></i>
                <span class="font-bold">TV 연결</span>
              </div>
              <span class="text-xs bg-white/20 px-2 py-1 rounded-full">실시간 동기화</span>
            </div>
            
            <div class="bg-white rounded-lg p-3 text-gray-800">
              <p class="text-xs text-gray-500 mb-2">TV 주소창에 아래 URL 입력:</p>
              <div class="flex items-center gap-2">
                <div id="tv-short-url-\${p.id}" class="flex-1 bg-gray-100 rounded-lg px-3 py-2 font-mono text-sm text-indigo-600 font-bold" data-url="\${p.external_short_url || location.origin + '/' + p.short_code}">
                  \${p.external_short_url ? p.external_short_url.replace('https://', '') : location.host + '/' + p.short_code}
                </div>
                \${!p.external_short_url ? \`
                <button onclick="createShortUrl('\${location.origin}/\${p.short_code}', \${p.id})" 
                  class="bg-orange-500 text-white px-3 py-2 rounded-lg hover:bg-orange-600 text-sm whitespace-nowrap">
                  단축 URL 생성
                </button>
                \` : ''}
                <button onclick="copyToClipboard(document.getElementById('tv-short-url-\${p.id}').getAttribute('data-url') || '\${location.origin}/\${p.short_code}')" 
                  class="bg-gray-200 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-300 text-sm">
                  복사
                </button>
              </div>
              \${!p.external_short_url ? \`
              <p class="text-xs text-gray-400 mt-2">
                "단축 URL 생성" 클릭 → 짧은 URL 자동 생성 → TV에서 바로 재생!
              </p>
              \` : ''}
            </div>
            
            <div class="flex gap-2 mt-3">
              <button onclick="openQuickPreview('\${p.short_code}')"
                class="flex-1 bg-white/20 px-3 py-2 rounded-lg hover:bg-white/30 text-sm">
                <i class="fas fa-eye mr-1"></i>미리보기
              </button>
              <button onclick="openTVMirror('\${p.short_code}', \${p.item_count || 0})"
                class="flex-1 bg-white/20 px-3 py-2 rounded-lg hover:bg-white/30 text-sm">
                <i class="fas fa-external-link-alt mr-1"></i>TV로 열기
              </button>
            </div>
          </div>
        </div>
      \`).join('');

      if (typeof postParentHeight === 'function') {
        setTimeout(postParentHeight, 50);
        setTimeout(postParentHeight, 300);
      }
    }
    
    // 플레이리스트 생성
    async function createPlaylist() {
      const name = prompt('플레이리스트 이름:');
      if (!name) return;
      
      try {
        const res = await fetch(API_BASE + '/playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        const data = await res.json();
        showToast('플레이리스트가 생성되었습니다.');
        await loadPlaylists();
      } catch (e) {
        showToast('생성 실패', 'error');
      }
    }
    
    // 플레이리스트 삭제
    async function deletePlaylist(id) {
      // 마지막 플레이리스트인지 확인
      if (playlists.length <= 1) {
        showToast('최소 1개의 대기실/체어가 필요합니다.', 'error');
        return;
      }
      
      if (!confirm('삭제하시겠습니까?')) return;
      
      try {
        const res = await fetch(API_BASE + '/playlists/' + id, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          showToast('삭제되었습니다.');
          await loadPlaylists();
        } else {
          showToast(data.error || '삭제 실패', 'error');
        }
      } catch (e) {
        showToast('삭제 실패', 'error');
      }
    }
    
    // 플레이리스트 편집기 열기
    let openingPlaylistEditor = false;

    function resetPlaylistEditorScroll() {
      const playlistContainer = document.getElementById('playlist-items-container');
      if (playlistContainer) playlistContainer.scrollTop = 0;

      const libraryContainer = document.getElementById('library-scroll-container');
      if (libraryContainer) libraryContainer.scrollTop = 0;
    }

    async function openPlaylistEditor(id) {
      if (openingPlaylistEditor) return;
      openingPlaylistEditor = true;

      // 이전 데이터 초기화
      currentPlaylist = null;
      
      // 모달 열고 로딩 표시
      openModal('edit-playlist-modal');
      document.getElementById('edit-playlist-title').textContent = '불러오는 중...';
      resetPlaylistEditorScroll();
      playlistSearchQuery = '';
      const librarySearchInput = document.getElementById('library-search');
      if (librarySearchInput) librarySearchInput.value = '';
      const librarySearchMessage = document.getElementById('library-search-message');
      if (librarySearchMessage) librarySearchMessage.classList.add('hidden');
      const librarySearchResults = document.getElementById('library-search-results');
      if (librarySearchResults) {
        librarySearchResults.innerHTML = '';
        librarySearchResults.classList.add('hidden');
      }
      
      // 컨테이너 즉시 초기화
      const container = document.getElementById('playlist-items-container');
      if (container) {
        container.innerHTML = '<div class="flex items-center justify-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>';
      }
      const searchInput = document.getElementById('playlist-search');
      if (searchInput) searchInput.value = '';
      playlistSearchQuery = '';
      const searchResults = document.getElementById('playlist-search-results');
      if (searchResults) {
        searchResults.innerHTML = '';
        searchResults.classList.add('hidden');
      }

      const cachedPlaylist = playlistCacheById[id];
      if (cachedPlaylist) {
        currentPlaylist = cachedPlaylist;
        document.getElementById('edit-playlist-title').textContent = currentPlaylist.name + ' 편집';
        document.getElementById('transition-effect').value = currentPlaylist.transition_effect || 'fade';
        document.getElementById('transition-duration').value = currentPlaylist.transition_duration || 1000;
        updateDurationLabel();
        if (typeof renderLibraryAndPlaylist === 'function') {
          await renderLibraryAndPlaylist();
        } else {
          await renderPlaylistItems();
        }
        if (typeof startMasterItemsAutoRefresh === 'function') {
          startMasterItemsAutoRefresh();
        }
      }
      
      try {
        let res = null;
        const delays = [300, 600, 1000];
        for (let attempt = 0; attempt < delays.length; attempt++) {
          res = await fetch(API_BASE + '/playlists/' + id + '?attempt=' + (attempt + 1));
          if (res.ok) break;
          await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        }
        if (!res || !res.ok) {
          throw new Error('playlist fetch failed');
        }
        const data = await res.json();
        if (!data.playlist) {
          throw new Error('playlist not found');
        }
        currentPlaylist = data.playlist;
        playlistCacheById[id] = currentPlaylist;
        playlistEditorSignature = getPlaylistEditorSignature(masterItemsCache || [], currentPlaylist);
        
        document.getElementById('edit-playlist-title').textContent = currentPlaylist.name + ' 편집';
        document.getElementById('transition-effect').value = currentPlaylist.transition_effect || 'fade';
        document.getElementById('transition-duration').value = currentPlaylist.transition_duration || 1000;
        updateDurationLabel();
        
        await loadPlaylistSettings();
        if (typeof renderLibraryAndPlaylist === 'function') {
          await renderLibraryAndPlaylist();
        } else {
          await renderPlaylistItems();
        }
        if (typeof startMasterItemsAutoRefresh === 'function') {
          startMasterItemsAutoRefresh();
        }
      } catch (e) {
        console.error('Open editor error:', e);
      } finally {
        openingPlaylistEditor = false;
      }
    }
    
    // 플레이리스트 설정 로드
    async function loadPlaylistSettings() {
      try {
        const res = await fetch(API_BASE + '/settings');
        const settings = await res.json();
        
        document.getElementById('logo-url').value = settings.logo_url || '';
        document.getElementById('logo-size').value = settings.logo_size || 150;
        document.getElementById('logo-opacity').value = settings.logo_opacity || 90;
        updateLogoSizeLabel();
        updateLogoOpacityLabel();
        
        const scheduleEnabled = settings.schedule_enabled || 0;
        document.getElementById('schedule-enabled').checked = scheduleEnabled === 1;
        document.getElementById('schedule-start').value = settings.schedule_start || '';
        document.getElementById('schedule-end').value = settings.schedule_end || '';
        toggleScheduleInputs(scheduleEnabled === 1);
        
        // 숨긴 공용 영상 로드
        hiddenMasterItems = JSON.parse(settings.hidden_master_items || '[]');
      } catch (e) {
        console.error('Settings load error:', e);
      }
    }
    
    let playlistSearchQuery = '';
    let playlistSearchItems = [];

    function normalizePlaylistSearchValue(value) {
      return (value || '')
        .toString()
        .normalize('NFKC')
        .toLowerCase()
        .replace(/\\s/g, '')
        .replace(/[._-]/g, '');
    }

    function getPlaylistSearchText(item) {
      return [item.title, item.name, item.display_title, item.original_title, item.url]
        .filter(Boolean)
        .join(' ');
    }

    function updatePlaylistSearch() {
      const input = document.getElementById('playlist-search');
      playlistSearchQuery = (input?.value || '').trim();
      renderPlaylistSearchResults();
    }

    function updateLibrarySearch() {
      const input = document.getElementById('library-search');
      playlistSearchQuery = (input?.value || '').trim();
      renderLibrarySearchResults();
    }

    function renderLibrarySearchResults() {
      const resultsContainer = document.getElementById('library-search-results');
      const messageEl = document.getElementById('library-search-message');
      if (!resultsContainer) return;

      const query = (playlistSearchQuery || '').trim();
      const normalizedQuery = normalizePlaylistSearchValue(query);
      if (!normalizedQuery) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('hidden');
        if (messageEl) messageEl.classList.add('hidden');
        return;
      }

      const items = currentPlaylist?.items || [];
      const masterItemsList = masterItemsCache || [];
      const allItems = [
        ...masterItemsList.map(item => ({ ...item, is_master: true })),
        ...items.map(item => ({ ...item, is_master: false }))
      ];

      const matches = allItems.filter(item => {
        const text = getPlaylistSearchText(item);
        const normalizedText = normalizePlaylistSearchValue(text);
        return normalizedText.includes(normalizedQuery);
      });

      if (matches.length === 0) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('hidden');
        if (messageEl) messageEl.classList.remove('hidden');
        return;
      }

      if (messageEl) messageEl.classList.add('hidden');
      resultsContainer.innerHTML = matches.map(item => {
        const itemId = String(item.id);
        const itemType = item.item_type || item.type || '';
        const thumb = item.thumbnail_url
          ? '<img src="' + item.thumbnail_url + '" class="w-full h-full object-cover">'
          : itemType === 'image'
            ? '<img src="' + item.url + '" class="w-full h-full object-cover">'
            : '<div class="w-full h-full flex items-center justify-center"><i class="fab fa-' + itemType + ' text-gray-400"></i></div>';
        const badge = item.is_master
          ? '<span class="text-xs bg-purple-100 text-purple-600 px-1 rounded">공용</span>'
          : '<span class="text-xs bg-blue-100 text-blue-600 px-1 rounded">내 영상</span>';

        return ''
          + '<button type="button" class="w-full flex items-center gap-2 p-2 hover:bg-gray-50 text-left" data-library-search-item="1" data-item-id="' + itemId + '" data-item-master="' + (item.is_master ? 1 : 0) + '" onclick="handleLibrarySearchSelect(this.dataset.itemId, this.dataset.itemMaster)">'
          + '<div class="w-12 h-8 bg-gray-100 rounded overflow-hidden flex-shrink-0">' + thumb + '</div>'
          + '<div class="flex-1 min-w-0">'
          + '<p class="text-sm truncate">' + (item.title || item.url) + '</p>'
          + '<p class="text-xs text-gray-400">' + itemType + ' ' + badge + '</p>'
          + '</div>'
          + '</button>';
      }).join('');
      resultsContainer.classList.remove('hidden');
      const buttons = resultsContainer.querySelectorAll('[data-library-search-item="1"]');
      buttons.forEach((btn) => {
        const itemId = btn.getAttribute('data-item-id');
        const isMaster = btn.getAttribute('data-item-master') === '1';
        btn.addEventListener('click', () => handleLibrarySearchSelect(itemId, isMaster));
      });
    }

    function focusLibraryItem(itemId, isMaster) {
      const container = document.getElementById('library-user-list')?.parentElement;
      if (!container) return;
      const selector = '[data-library-id="' + itemId + '"][data-library-master="' + isMaster + '"]';
      const itemEl = container.querySelector(selector);
      if (!itemEl) return;
      itemEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      itemEl.classList.add('library-item-highlight');
      setTimeout(() => {
        itemEl.classList.remove('library-item-highlight');
      }, 1500);
    }

    function handleLibrarySearchSelect(itemId, isMaster) {
      addToPlaylistFromLibrary(itemId);
      const input = document.getElementById('library-search');
      if (input) input.value = '';
      playlistSearchQuery = '';
      const messageEl = document.getElementById('library-search-message');
      if (messageEl) messageEl.classList.add('hidden');
      const resultsContainer = document.getElementById('library-search-results');
      if (resultsContainer) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('hidden');
      }
      renderLibrarySearchResults();
    }

    function renderPlaylistSearchResults() {
      const resultsContainer = document.getElementById('playlist-search-results');
      if (!resultsContainer) return;

      const query = playlistSearchQuery;
      if (!query) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('hidden');
        return;
      }

      const normalizedQuery = normalizePlaylistSearchValue(query);
      const filteredItems = playlistSearchItems.filter(item => {
        const searchText = getPlaylistSearchText(item);
        return searchText.includes(query) || normalizePlaylistSearchValue(searchText).includes(normalizedQuery);
      });

      if (filteredItems.length === 0) {
        resultsContainer.innerHTML = '<div class="text-center py-3 text-gray-400 text-sm">검색 결과가 없습니다</div>';
        resultsContainer.classList.remove('hidden');
        return;
      }

      resultsContainer.innerHTML = filteredItems.map(item => {
        const itemId = String(item.id);
        const itemType = item.item_type || item.type || '';
        const thumb = item.thumbnail_url
          ? '<img src="' + item.thumbnail_url + '" class="w-full h-full object-cover">'
          : itemType === 'image'
            ? '<img src="' + item.url + '" class="w-full h-full object-cover">'
            : '<div class="w-full h-full flex items-center justify-center"><i class="fab fa-' + itemType + ' text-gray-400"></i></div>';
        const badge = item.is_master
          ? '<span class="text-xs bg-purple-100 text-purple-600 px-1 rounded">공용</span>'
          : '<span class="text-xs bg-blue-100 text-blue-600 px-1 rounded">내 영상</span>';

        return ''
          + '<button type="button" class="w-full flex items-center gap-2 p-2 hover:bg-gray-50 text-left" onclick="focusPlaylistItem(&quot;' + itemId + '&quot;, ' + (item.is_master ? 1 : 0) + ')">'
          + '<div class="w-12 h-8 bg-gray-100 rounded overflow-hidden flex-shrink-0">' + thumb + '</div>'
          + '<div class="flex-1 min-w-0">'
          + '<p class="text-sm truncate">' + (item.title || item.url) + '</p>'
          + '<p class="text-xs text-gray-400">' + itemType + ' ' + badge + '</p>'
          + '</div>'
          + '</button>';
      }).join('');

      resultsContainer.classList.remove('hidden');
    }

    function focusPlaylistItem(itemId, isMaster) {
      const container = document.getElementById('playlist-items-container');
      if (!container) return;

      const selector = '[data-id="' + itemId + '"][data-master="' + isMaster + '"]';
      const itemEl = container.querySelector(selector);
      if (!itemEl) return;

      itemEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      itemEl.classList.add('bg-yellow-50', 'ring-2', 'ring-yellow-300');
      setTimeout(() => {
        itemEl.classList.remove('bg-yellow-50', 'ring-2', 'ring-yellow-300');
      }, 1500);
    }

    // 재생 목록 아이템 렌더링 (공용 + 내 영상 통합)
    async function renderPlaylistItems() {
      const container = document.getElementById('playlist-items-container');
      const userItems = currentPlaylist.items || [];
      
      // 마스터 영상 로드 (캐시 사용)
      const masterItemsList = await loadMasterItems();
      
      // 공용 영상 섹션 숨기기
      const masterSection = document.getElementById('master-items-section');
      if (masterSection) masterSection.classList.add('hidden');
      
      let html = '';
      let itemNumber = 1;

      playlistSearchItems = [
        ...masterItemsList.filter(item => !hiddenMasterItems.includes(item.id)).map(item => ({
          ...item,
          is_master: true
        })),
        ...userItems.map(item => ({
          ...item,
          is_master: false
        }))
      ];
      
      // 공용 영상 섹션
      if (masterItemsList.length > 0) {
        html += '<div class="px-2 py-1 bg-purple-50 text-xs text-purple-600 font-medium rounded-t border-b">공용 영상</div>';
        masterItemsList.forEach((item, idx) => {
          const isHidden = hiddenMasterItems.includes(item.id);
          html += \`
            <div class="flex items-center gap-2 p-2 border-b \${isHidden ? 'bg-gray-50 opacity-50' : 'bg-purple-50'}" data-id="\${item.id}" data-master="1">
              <i class="fas fa-lock text-purple-300 w-5 text-center"></i>
              <span class="text-sm \${isHidden ? 'text-gray-400' : 'text-purple-600'} w-5 text-center">\${isHidden ? '-' : itemNumber}</span>
              <div class="w-14 h-9 \${isHidden ? 'bg-gray-200' : 'bg-purple-100'} rounded overflow-hidden flex-shrink-0 editor-master-thumb" data-type="\${item.item_type}" data-url="\${item.url}">
                \${item.thumbnail_url 
                  ? \`<img src="\${item.thumbnail_url}" class="w-full h-full object-cover">\`
                  : \`<div class="w-full h-full flex items-center justify-center"><i class="fab fa-\${item.item_type} text-gray-400"></i></div>\`
                }
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm truncate \${isHidden ? 'text-gray-400 line-through' : 'text-purple-800'}">\${item.title || item.url}</p>
                <p class="text-xs text-purple-400">\${item.item_type} · <span class="bg-purple-200 text-purple-700 px-1 rounded">공용</span></p>
              </div>
              <button onclick="toggleMasterItemHidden(\${item.id})" 
                class="px-2 py-1 text-xs rounded \${isHidden ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}">
                \${isHidden ? '표시' : '숨기기'}
              </button>
            </div>
          \`;
          if (!isHidden) itemNumber++;
        });
      }
      
      // 내 영상 섹션
      html += '<div class="px-2 py-1 bg-blue-50 text-xs text-blue-600 font-medium border-b">↓ 내 영상 ↓</div>';
      
      if (userItems.length === 0) {
        html += '<div class="text-center py-4 text-gray-400 text-sm">미디어를 추가하세요</div>';
      } else {
        userItems.forEach((item, idx) => {
          html += \`
            <div class="flex items-center gap-2 bg-white p-2 border-b hover:bg-gray-50" data-id="\${item.id}" data-master="0">
              <i class="fas fa-grip-vertical drag-handle text-gray-300 cursor-move"></i>
              <span class="text-sm text-blue-600 w-5 text-center">\${itemNumber}</span>
              <div class="w-14 h-9 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                \${item.item_type === 'image' 
                  ? \`<img src="\${item.url}" class="w-full h-full object-cover">\`
                  : \`<div class="w-full h-full flex items-center justify-center"><i class="fab fa-\${item.item_type} text-gray-400"></i></div>\`
                }
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm truncate">\${item.title || item.url}</p>
                <p class="text-xs text-gray-400">\${item.item_type}\${item.item_type === 'image' ? ' · ' + item.display_time + '초' : ''}</p>
              </div>
              <button onclick="deletePlaylistItem(\${item.id})" class="text-red-400 hover:text-red-600 p-1">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          \`;
          itemNumber++;
        });
      }
      
      container.innerHTML = html;
      renderPlaylistSearchResults();
      \`).join('');
      
      // Sortable 초기화
      if (playlistSortable) playlistSortable.destroy();
      playlistSortable = new Sortable(container, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        onEnd: updateItemOrder
      });
    }
    
    // 숨긴 공용 영상 ID 목록
    let hiddenMasterItems = [];
    
    // 마스터 아이템 캐시
    let cachedMasterItems = null;
    let masterItemsCache = null;
    let masterItemsLoading = false;
    let masterItemsSignature = '';
    let masterItemsRefreshTimer = null;
    let playlistEditorSignature = '';
    let editPlaylistRefreshTimer = null;

    function getMasterItemsSignature(items) {
      return (items || [])
        .map(item => String(item.id) + ':' + String(item.sort_order || 0))
        .join('|');
    }

    function getPlaylistEditorSignature(masterItems, playlist) {
      const masterSig = getMasterItemsSignature(masterItems);
      const itemSig = (playlist?.items || [])
        .map(item => String(item.id) + ':' + String(item.sort_order || 0))
        .join('|');
      const activeSig = (playlist?.activeItemIds || [])
        .map(id => String(id))
        .join('|');
      return [masterSig, itemSig, activeSig].join('||');
    }

    async function refreshMasterItemsIfChanged() {
      const items = await loadMasterItems(true);
      const signature = getMasterItemsSignature(items);
      const changed = signature && signature !== masterItemsSignature;
      if (signature) {
        masterItemsSignature = signature;
      }
      masterItemsCache = items;
      cachedMasterItems = items;
      masterItems = items;

      if (currentPlaylist && changed) {
        const editModal = document.getElementById('edit-playlist-modal');
        const isEditOpen = editModal && !editModal.classList.contains('hidden');

        if (isEditOpen && typeof renderPlaylistItems === 'function') {
          await renderPlaylistItems();
        } else if (typeof renderLibraryAndPlaylist === 'function') {
          await renderLibraryAndPlaylist();
        } else if (typeof renderPlaylistItems === 'function') {
          await renderPlaylistItems();
        }
      }
    }

    async function refreshMasterItemsForce() {
      let items = [];
      try {
        const res = await fetch(window.location.origin + '/api/master/items?ts=' + Date.now(), { cache: 'no-store' });
        const data = await res.json();
        items = data.items || [];
      } catch (e) {
        items = cachedMasterItems || [];
      }

      masterItemsCache = items;
      cachedMasterItems = items;
      masterItems = items;

      if (!currentPlaylist) return;
      const editModal = document.getElementById('edit-playlist-modal');
      if (!editModal || editModal.classList.contains('hidden')) return;

      // 서버에서 playlist items(라이브러리) 갱신 - activeItemIds는 로컬 유지
      try {
        const playlistRes = await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '?ts=' + Date.now(), { cache: 'no-store' });
        const playlistData = await playlistRes.json();
        if (playlistData && playlistData.playlist) {
          const savedActiveIds = currentPlaylist.activeItemIds; // 로컬 상태 보존
          currentPlaylist = playlistData.playlist;
          currentPlaylist.activeItemIds = savedActiveIds;     // 덮어쓰기 방지
        }
      } catch (e) {}

      // 라이브러리 패널만 갱신 (플레이리스트 오른쪽은 건드리지 않음)
      if (typeof renderLibraryOnly === 'function') renderLibraryOnly();
    }

    async function refreshPlaylistEditorData() {
      if (!currentPlaylist) return;
      const editModal = document.getElementById('edit-playlist-modal');
      if (!editModal || editModal.classList.contains('hidden')) return;

      let masterOk = false;
      try {
        const masterRes = await fetch(window.location.origin + '/api/master/items?ts=' + Date.now(), { cache: 'no-store' });
        if (masterRes.ok) {
          const masterData = await masterRes.json();
          cachedMasterItems = masterData.items || [];
          masterItemsCache = cachedMasterItems;
          masterOk = true;
        }
      } catch (e) {}

      // playlist items(라이브러리 항목)만 갱신 - activeItemIds는 로컬 유지
      try {
        const res = await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '?ts=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.playlist) {
            const savedActiveIds = currentPlaylist.activeItemIds; // 로컬 상태 보존
            currentPlaylist = data.playlist;
            currentPlaylist.activeItemIds = savedActiveIds;       // 덮어쓰기 방지
          }
        }
      } catch (e) {}

      // 라이브러리 패널만 갱신 (플레이리스트는 사용자가 직접 변경 중일 수 있음)
      if (masterOk && typeof renderLibraryOnly === 'function') renderLibraryOnly();
    }

    function startMasterItemsAutoRefresh() {
      if (masterItemsRefreshTimer) clearInterval(masterItemsRefreshTimer);
      // 30초마다 라이브러리 패널만 조용히 갱신 (5초는 너무 잦음)
      masterItemsRefreshTimer = setInterval(refreshPlaylistEditorData, 30000);
    }
    
    // 마스터 아이템 로드 (캐시 사용)
    async function loadMasterItems(forceRefresh = false) {
      if (cachedMasterItems && !forceRefresh) {
        masterItemsCache = cachedMasterItems;
        return cachedMasterItems;
      }
      
      if (masterItemsLoading) {
        // 이미 로딩 중이면 완료될 때까지 대기
        await new Promise(resolve => {
          const check = setInterval(() => {
            if (!masterItemsLoading) {
              clearInterval(check);
              resolve();
            }
          }, 100);
        });
        return cachedMasterItems || [];
      }
      
      masterItemsLoading = true;
      try {
        const cacheBuster = forceRefresh ? ('?ts=' + Date.now()) : '';
        const res = await fetch(window.location.origin + '/api/master/items' + cacheBuster, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        cachedMasterItems = data.items || [];
        masterItemsCache = cachedMasterItems;
        return cachedMasterItems;
      } catch (e) {
        console.error('Master items load error:', e);
        return cachedMasterItems || [];
      } finally {
        masterItemsLoading = false;
      }
    }
    
    // 편집기에서 마스터 영상 표시 (숨기기 가능)
    async function renderMasterItemsInEditor() {
      const section = document.getElementById('master-items-section');
      const container = document.getElementById('master-items-list');
      
      // 캐시된 마스터 아이템 사용
      const items = await loadMasterItems();
      
      if (items.length === 0) {
        section.classList.add('hidden');
        return;
      }
      
      section.classList.remove('hidden');
      container.innerHTML = items.map((item, idx) => {
        const isHidden = hiddenMasterItems.includes(item.id);
        return \`
        <div class="flex items-center gap-2 p-2 rounded border \${isHidden ? 'bg-gray-100 border-gray-200 opacity-50' : 'bg-white bg-opacity-70 border-purple-200'}">
          <span class="text-sm text-gray-400 w-5 text-center">\${idx + 1}</span>
          <div class="w-16 h-10 \${isHidden ? 'bg-gray-200' : 'bg-purple-100'} rounded overflow-hidden flex-shrink-0 editor-master-thumb" data-type="\${item.item_type}" data-url="\${item.url}">
            \${item.thumbnail_url 
              ? \`<img src="\${item.thumbnail_url}" class="w-full h-full object-cover">\`
              : \`<div class="w-full h-full flex items-center justify-center"><i class="fab fa-\${item.item_type} text-gray-400"></i></div>\`
            }
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm truncate \${isHidden ? 'text-gray-400 line-through' : 'text-purple-800'}">\${item.title || item.url}</p>
            <p class="text-xs \${isHidden ? 'text-gray-400' : 'text-purple-400'}">\${item.item_type} · 공용</p>
          </div>
          <button onclick="toggleMasterItemHidden(\${item.id})" 
            class="px-2 py-1 text-xs rounded \${isHidden ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}">
            \${isHidden ? '표시' : '숨기기'}
          </button>
        </div>
      \`}).join('');
      
      // 썸네일 자동 로드
      loadEditorMasterThumbnails();
    }
    
    // 공용 영상 숨기기/표시 토글
    async function toggleMasterItemHidden(itemId) {
      const idx = hiddenMasterItems.indexOf(itemId);
      if (idx === -1) {
        hiddenMasterItems.push(itemId);
      } else {
        hiddenMasterItems.splice(idx, 1);
      }
      
      // 서버에 저장
      try {
        await fetch(API_BASE + '/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hidden_master_items: JSON.stringify(hiddenMasterItems) })
        });
      } catch (e) {
        console.error('Failed to save hidden master items:', e);
      }
      
      // UI 업데이트
      renderMasterItemsInEditor();
    }
    
    // 편집기 마스터 영상 썸네일 로드
    async function loadEditorMasterThumbnails() {
      const thumbs = document.querySelectorAll('.editor-master-thumb');
      for (const el of thumbs) {
        if (el.querySelector('img')) continue; // 이미 로드됨
        const type = el.dataset.type;
        const url = el.dataset.url;
        
        if (type === 'vimeo') {
          const match = url.match(/vimeo\\.com\\/(\\d+)/);
          const videoId = match ? match[1] : null;
          if (videoId) {
            try {
              const res = await fetch('/api/vimeo-thumbnail/' + videoId);
              const data = await res.json();
              if (data.success && data.thumbnail) {
                el.innerHTML = '<img src="' + data.thumbnail + '" class="w-full h-full object-cover">';
              } else {
                el.innerHTML = '<div class="w-full h-full flex items-center justify-center"><i class="fab fa-vimeo text-purple-400"></i></div>';
              }
            } catch (e) {
              el.innerHTML = '<div class="w-full h-full flex items-center justify-center"><i class="fab fa-vimeo text-purple-400"></i></div>';
            }
          }
        } else if (type === 'youtube') {
          const match = url.match(/(?:youtube\\.com\\/watch\\?v=|youtu\\.be\\/)([\\w-]+)/);
          const videoId = match ? match[1] : null;
          if (videoId) {
            el.innerHTML = '<img src="https://img.youtube.com/vi/' + videoId + '/mqdefault.jpg" class="w-full h-full object-cover">';
          }
        }
      }
    }
    
    // 아이템 순서 변경
    async function updateItemOrder() {
      const container = document.getElementById('playlist-items-container');
      const itemIds = [...container.querySelectorAll('[data-id]')].map(el => parseInt(el.dataset.id));
      
      try {
        await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/reorder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_ids: itemIds })
        });
      } catch (e) {
        console.error('Reorder error:', e);
      }
    }
    
    // 동영상 추가
    async function addVideoItem() {
      const url = document.getElementById('new-video-url').value.trim();
      if (!url) return;
      
      let item_type = 'youtube';
      if (url.includes('vimeo')) item_type = 'vimeo';
      
      try {
        await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_type, url })
        });
        document.getElementById('new-video-url').value = '';
        showToast('추가되었습니다.');
        
        const res = await fetch(API_BASE + '/playlists/' + currentPlaylist.id);
        const data = await res.json();
        currentPlaylist = data.playlist;
        renderPlaylistItems();
      } catch (e) {
        showToast('추가 실패', 'error');
      }
    }
    
    // 이미지 추가
    async function addImageItem() {
      const url = document.getElementById('new-image-url').value.trim();
      const displayTime = parseInt(document.getElementById('new-image-display-time').value) || 10;
      if (!url) return;
      
      try {
        await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_type: 'image', url, display_time: displayTime })
        });
        document.getElementById('new-image-url').value = '';
        showToast('추가되었습니다.');
        
        const res = await fetch(API_BASE + '/playlists/' + currentPlaylist.id);
        const data = await res.json();
        currentPlaylist = data.playlist;
        renderPlaylistItems();
      } catch (e) {
        showToast('추가 실패', 'error');
      }
    }
    
    // 아이템 삭제
    async function deletePlaylistItem(itemId) {
      if (!confirm('이 미디어를 삭제하시겠습니까?')) return;
      
      try {
        const deleteRes = await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/items/' + itemId, { method: 'DELETE' });
        if (!deleteRes.ok) {
          const errData = await deleteRes.json();
          showToast(errData.error || '삭제 실패', 'error');
          return;
        }
        const res = await fetch(API_BASE + '/playlists/' + currentPlaylist.id);
        const data = await res.json();
        currentPlaylist = data.playlist;
        renderPlaylistItems();
        showToast('삭제되었습니다.');
      } catch (e) {
        showToast('삭제 실패', 'error');
      }
    }
    
    // 모든 설정 저장
    async function saveAllSettings() {
      try {
        // 전환 효과 저장
        await fetch(API_BASE + '/playlists/' + currentPlaylist.id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transition_effect: document.getElementById('transition-effect').value,
            transition_duration: parseInt(document.getElementById('transition-duration').value)
          })
        });
        
        // 로고, 스케줄 저장
        await fetch(API_BASE + '/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            logo_url: document.getElementById('logo-url').value,
            logo_size: parseInt(document.getElementById('logo-size').value),
            logo_opacity: parseInt(document.getElementById('logo-opacity').value),
            schedule_enabled: document.getElementById('schedule-enabled').checked ? 1 : 0,
            schedule_start: document.getElementById('schedule-start').value,
            schedule_end: document.getElementById('schedule-end').value,
            use_master_playlist: document.getElementById('use-master-playlist')?.checked ? 1 : 0,
            master_playlist_mode: document.getElementById('master-playlist-mode')?.value || 'before'
          })
        });
        
        showToast('저장되었습니다.');
        await loadPlaylists();
      } catch (e) {
        showToast('저장 실패', 'error');
      }
    }
    
    // 공지사항 로드
    async function loadNotices() {
      try {
        const res = await fetch(API_BASE + '/notices');
        const data = await res.json();
        notices = data.notices || [];
        renderNotices();
      } catch (e) {
        console.error('Load notices error:', e);
      }
    }
    
    // 공지사항 렌더링
    function renderNotices() {
      const container = document.getElementById('notices-container');
      if (notices.length === 0) {
        container.innerHTML = '<div class="text-center py-6 text-gray-500"><i class="fas fa-bullhorn text-3xl mb-2"></i><p>공지사항이 없습니다.</p></div>';
        return;
      }
      
      container.innerHTML = notices.map(n => \`
        <div class="flex items-center gap-3 bg-white p-3 rounded-lg shadow-sm \${n.is_urgent ? 'border-l-4 border-red-500' : ''}">
          <i class="fas fa-grip-vertical drag-handle text-gray-300"></i>
          <div class="flex-1">
            <p class="text-sm \${n.is_urgent ? 'text-red-600 font-bold' : ''}">\${n.content}</p>
          </div>
          <label class="flex items-center gap-1">
            <input type="checkbox" \${n.is_active ? 'checked' : ''} onchange="toggleNoticeActive(\${n.id}, this.checked)"
              class="w-4 h-4 text-blue-500 rounded">
            <span class="text-xs text-gray-500">표시</span>
          </label>
          <button onclick="editNotice(\${n.id})" class="text-blue-500 text-sm"><i class="fas fa-edit"></i></button>
          <button onclick="deleteNotice(\${n.id})" class="text-red-500 text-sm"><i class="fas fa-trash"></i></button>
        </div>
      \`).join('');
    }
    
    // 공지 모달 열기
    function openNoticeModal(notice = null) {
      editingNoticeId = notice ? notice.id : null;
      document.getElementById('notice-modal-title').textContent = notice ? '공지 수정' : '새 공지사항';
      document.getElementById('notice-content').value = notice ? notice.content : '';
      document.getElementById('notice-urgent').checked = notice ? notice.is_urgent : false;
      openModal('notice-modal');
    }
    
    function closeNoticeModal() {
      document.getElementById('notice-modal').style.display = 'none';
    }
    
    // 공지 저장
    async function saveNotice() {
      const content = document.getElementById('notice-content').value.trim();
      if (!content) return;
      
      const data = {
        content,
        is_urgent: document.getElementById('notice-urgent').checked ? 1 : 0
      };
      
      try {
        if (editingNoticeId) {
          await fetch(API_BASE + '/notices/' + editingNoticeId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
        } else {
          await fetch(API_BASE + '/notices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
        }
        closeNoticeModal();
        showToast('저장되었습니다.');
        await loadNotices();
      } catch (e) {
        showToast('저장 실패', 'error');
      }
    }
    
    // 공지 수정
    function editNotice(id) {
      const notice = notices.find(n => n.id === id);
      if (notice) openNoticeModal(notice);
    }
    
    // 공지 삭제
    async function deleteNotice(id) {
      if (!confirm('삭제하시겠습니까?')) return;
      try {
        await fetch(API_BASE + '/notices/' + id, { method: 'DELETE' });
        showToast('삭제되었습니다.');
        await loadNotices();
      } catch (e) {
        showToast('삭제 실패', 'error');
      }
    }
    
    // 공지 활성화 토글
    async function toggleNoticeActive(id, active) {
      try {
        await fetch(API_BASE + '/notices/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: active ? 1 : 0 })
        });
      } catch (e) {
        showToast('변경 실패', 'error');
      }
    }
    
    // 공지 설정 로드
    async function loadNoticeSettings() {
      try {
        const res = await fetch(API_BASE + '/settings');
        const settings = await res.json();
        
        document.getElementById('global-notice-enabled').checked = settings.notice_enabled !== 0;
        document.getElementById('global-notice-font-size').value = settings.notice_font_size || 32;
        document.getElementById('global-notice-letter-spacing').value = settings.notice_letter_spacing ?? 0;
        document.getElementById('global-notice-scroll-speed').value = settings.notice_scroll_speed || 50;
        document.getElementById('global-notice-text-color').value = settings.notice_text_color || '#ffffff';
        document.getElementById('global-notice-bg-color').value = settings.notice_bg_color || '#1a1a2e';
        document.getElementById('global-notice-bg-opacity').value = settings.notice_bg_opacity ?? 100;
        document.getElementById('global-notice-position').value = settings.notice_position || 'bottom';
        updateNoticePositionButtons(settings.notice_position || 'bottom');
        
        updateScrollSpeedLabel();
        updateNoticeOpacityLabel();
      } catch (e) {
        console.error('Notice settings load error:', e);
      }
    }
    
    // 공지 설정 저장
    async function saveGlobalNoticeSettings() {
      try {
        await fetch(API_BASE + '/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notice_enabled: document.getElementById('global-notice-enabled').checked ? 1 : 0,
            notice_font_size: parseInt(document.getElementById('global-notice-font-size').value),
            notice_letter_spacing: parseFloat(document.getElementById('global-notice-letter-spacing').value || '0'),
            notice_scroll_speed: parseInt(document.getElementById('global-notice-scroll-speed').value),
            notice_text_color: document.getElementById('global-notice-text-color').value,
            notice_bg_color: document.getElementById('global-notice-bg-color').value,
            notice_bg_opacity: parseInt(document.getElementById('global-notice-bg-opacity').value),
            notice_position: document.getElementById('global-notice-position').value
          })
        });
      } catch (e) {
        console.error('Save notice settings error:', e);
      }
    }
    
    function toggleGlobalNotice() {
      saveGlobalNoticeSettings();
    }
    
    // 공지 위치 버튼 설정
    function setNoticePosition(position) {
      document.getElementById('global-notice-position').value = position;
      updateNoticePositionButtons(position);
      saveGlobalNoticeSettings();
    }
    
    function updateNoticePositionButtons(position) {
      const topBtn = document.getElementById('position-top-btn');
      const bottomBtn = document.getElementById('position-bottom-btn');
      
      if (!topBtn || !bottomBtn) return;
      
      // 현재 스타일(indigo 또는 blue) 유지
      const activeClass = topBtn.className.includes('indigo') || bottomBtn.className.includes('indigo')
        ? 'flex-1 px-3 py-2 border rounded-lg text-sm font-medium transition-colors bg-indigo-500 text-white'
        : 'flex-1 px-2 py-1.5 border rounded text-xs font-medium transition-colors bg-blue-500 text-white';
      const inactiveClass = topBtn.className.includes('indigo') || bottomBtn.className.includes('indigo')
        ? 'flex-1 px-3 py-2 border rounded-lg text-sm font-medium transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200'
        : 'flex-1 px-2 py-1.5 border rounded text-xs font-medium transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200';
      
      if (position === 'top') {
        topBtn.className = activeClass;
        bottomBtn.className = inactiveClass;
      } else {
        topBtn.className = inactiveClass;
        bottomBtn.className = activeClass;
      }
    }
    
    // 라벨 업데이트
    function updateScrollSpeedLabel() {
      const speed = document.getElementById('global-notice-scroll-speed').value;
      let text = '보통';
      if (speed < 30) text = '느림';
      else if (speed < 70) text = '보통';
      else if (speed < 120) text = '빠름';
      else text = '매우 빠름';
      document.getElementById('scroll-speed-label').textContent = text + ' (' + speed + ')';
    }
    
    function updateNoticeOpacityLabel() {
      document.getElementById('notice-opacity-label').textContent = document.getElementById('global-notice-bg-opacity').value + '%';
    }
    
    function updateLogoSizeLabel() {
      document.getElementById('logo-size-label').textContent = document.getElementById('logo-size').value + 'px';
    }
    
    function updateLogoOpacityLabel() {
      document.getElementById('logo-opacity-label').textContent = document.getElementById('logo-opacity').value + '%';
    }
    
    function updateDurationLabel() {
      document.getElementById('duration-label').textContent = document.getElementById('transition-duration').value + 'ms';
    }
    
    function toggleScheduleInputs(enabled) {
      const inputs = document.getElementById('schedule-inputs');
      if (!inputs) return;
      inputs.classList.toggle('hidden', !enabled);
    }
    
    function toggleMasterPlaylistInputs(enabled) {
      const inputs = document.getElementById('master-playlist-inputs');
      if (!inputs) return;
      inputs.classList.toggle('hidden', !enabled);
    }
    
    // 모달 닫기
    function closeEditModal() {
      document.getElementById('edit-playlist-modal').style.display = 'none';
      loadPlaylists();
    }
    
    function closePreviewModal() {
      document.getElementById('preview-modal').style.display = 'none';
      document.getElementById('preview-iframe').src = '';
    }
    
    function closeQrModal() {
      document.getElementById('qr-modal').style.display = 'none';
    }
    
    function closeClinicNameModal() {
      document.getElementById('clinic-name-modal').style.display = 'none';
    }
    
    // 미리보기
    function openQuickPreview(shortCode) {
      document.getElementById('preview-iframe').src = '/tv/' + shortCode + '?preview=1';
      openModal('preview-modal');
    }
    
    // TV 미러링 열기 (팝업 차단 방지를 위해 동기적으로 창 열기)
    function openTVMirror(shortCode, itemCount) {
      if (!shortCode) {
        alert('TV 코드가 없습니다. 관리자에게 문의하세요.');
        return;
      }
      const url = '/tv/' + shortCode;
      const opened = window.open(url, '_blank');
      if (!opened) {
        window.location.href = url;
      }
    }
    
    // 클립보드 복사
    async function copyToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text);
        showToast('복사되었습니다.');
      } catch (e) {
        showToast('복사 실패', 'error');
      }
    }
    
    // 단축 URL 생성
    async function createShortUrl(url, playlistId) {
      // generateShortUrl로 위임
      const playlist = playlists.find(p => p.id == playlistId);
      const shortCode = playlist ? playlist.short_code : '';
      await generateShortUrl(playlistId, shortCode);
    }
    
    // 치과명 변경
    function editClinicName() {
      document.getElementById('edit-clinic-name').value = document.getElementById('clinic-name-text').textContent;
      openModal('clinic-name-modal');
    }
    
    async function saveClinicName(e) {
      e.preventDefault();
      const name = document.getElementById('edit-clinic-name').value.trim();
      if (!name) return;
      
      try {
        await fetch(API_BASE + '/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clinic_name: name })
        });
        document.getElementById('clinic-name-text').textContent = name;
        closeClinicNameModal();
        showToast('저장되었습니다.');
      } catch (e) {
        showToast('저장 실패', 'error');
      }
    }
  </script>
</body>
</html>
  `)
})


// ============================================
// 관리자 페이지 통합 핸들러 함수
// /admin/ 과 /embed/ 모두 이 함수를 직접 호출 (redirect 없음)
// ============================================
async function handleAdminPage(c: any, adminCode: string, emailParamIn: string, isAdminFlagIn: boolean) {
  let emailParam = normalizeEmail(emailParamIn)
  const isAdminQuery = isAdminFlagIn

  try {
    // 사용자 조회
    let user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE admin_code = ?'
    ).bind(adminCode).first() as any

    if (!user) {
      user = await getOrCreateUser(c.env.DB, adminCode)
      if (!user) {
        return c.html(getBlockedPageHtml('로그인이 필요합니다', '계정 정보를 찾을 수 없습니다.', '아임웹 페이지에서 다시 접속해주세요.'))
      }
    }

    // email 파라미터가 없으면 DB에 저장된 email 사용
    if (!emailParam && user.imweb_email) {
      emailParam = normalizeEmail(user.imweb_email)
    }

    // 이메일이 없어도 imweb_member_id가 있는 계정은 허용 (아임웹 위젯 자동 로그인)
    if (!emailParam && !user.imweb_member_id) {
      return c.html(getBlockedPageHtml('로그인이 필요합니다', '이메일 정보가 없습니다.', '아임웹 페이지에서 다시 접속해주세요.'))
    }

    // email이 있을 때만 DB 값과 비교 (없으면 member_id 기반으로 허용)
    if (emailParam && user.imweb_email && normalizeEmail(user.imweb_email) !== emailParam) {
      return c.html(getBlockedPageHtml('로그인이 필요합니다', '이메일이 일치하지 않습니다.', '아임웹 페이지에서 다시 접속해주세요.'))
    }

    // email이 있고 DB에 없으면 저장 (단, ADMIN_EMAILS는 저장하지 않음) - fire & forget (응답 지연 없음)
    if (emailParam && !user.imweb_email && !ADMIN_EMAILS.includes(emailParam)) {
      c.env.DB.prepare('UPDATE users SET imweb_email = ? WHERE id = ?')
        .bind(emailParam, user.id).run().catch(() => {})
    }

    // 계정 상태 확인 (정지 또는 구독 만료)
    if (user && !user.is_master) {
      if (user.is_active === 0) {
        return c.html(getBlockedPageHtml('계정이 정지되었습니다', user.suspended_reason || '관리자에 의해 정지됨', '관리자에게 문의하여 계정을 활성화해주세요.'))
      }
      if (user.subscription_plan !== 'unlimited' && user.subscription_end) {
        const endDate = new Date(user.subscription_end)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        if (endDate < today) {
          await c.env.DB.prepare(`UPDATE users SET is_active = 0, suspended_reason = '구독 기간 만료' WHERE id = ?`).bind(user.id).run()
          return c.html(getBlockedPageHtml('구독 기간이 만료되었습니다', '만료일: ' + user.subscription_end, '서비스를 계속 이용하시려면 구독을 연장해주세요.'))
        }
      }
    }

    // 세션 없이 바로 관리자 페이지 렌더링 (세션/리다이렉트 불필요)
    const finalUser = user
  
  // 관리자 권한 체크:
  // 1. URL에 is_admin=1 파라미터가 있거나
  // 2. 마스터 관리자 페이지에서 설정한 관리자인 경우
  const isOwnerAdmin = isAdminQuery || finalUser?.is_site_admin === 1 || isAdminEmail(finalUser?.imweb_email)
  
  // 서버에서 초기 데이터 미리 로드 (병렬)
  const [playlistsData, noticesData, masterItemsData, playlistItemsData] = await Promise.all([
    c.env.DB.prepare(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM playlist_items WHERE playlist_id = p.id) as item_count
      FROM playlists p
      WHERE p.user_id = ? AND (p.is_master_playlist = 0 OR p.is_master_playlist IS NULL)
      ORDER BY p.id
    `).bind(finalUser?.id || 0).all(),
    c.env.DB.prepare('SELECT * FROM notices WHERE user_id = ? ORDER BY sort_order ASC, id DESC')
      .bind(finalUser?.id || 0).all(),
    // 3단계 직렬 쿼리 → 1개 JOIN 쿼리로 최적화 (DB 왕복 2→1회)
    c.env.DB.prepare(`
      SELECT pi.*
      FROM playlist_items pi
      JOIN playlists p ON pi.playlist_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE u.is_master = 1 AND p.is_master_playlist = 1
      ORDER BY pi.sort_order
    `).all(),
    // 사용자 playlist의 items를 한 번에 로드 (편집창 즉시 렌더링용)
    c.env.DB.prepare(`
      SELECT pi.*
      FROM playlist_items pi
      JOIN playlists p ON pi.playlist_id = p.id
      WHERE p.user_id = ? AND (p.is_master_playlist = 0 OR p.is_master_playlist IS NULL)
      ORDER BY pi.playlist_id, pi.sort_order ASC
    `).bind(finalUser?.id || 0).all()
  ])

  // playlist별로 items 그룹핑
  const playlistItemsMap: Record<number, any[]> = {}
  for (const item of (playlistItemsData.results || [])) {
    const pid = (item as any).playlist_id
    if (!playlistItemsMap[pid]) playlistItemsMap[pid] = []
    playlistItemsMap[pid].push({ ...(item as any), is_master: false })
  }

  // playlists에 items와 activeItemIds 추가
  const masterItemIds = (masterItemsData.results || []).map((i: any) => i.id)
  const playlistsWithItems = (playlistsData.results || []).map((p: any) => {
    const items = playlistItemsMap[p.id] || []
    let activeItemIds: number[] = []
    try {
      const raw = p.active_item_ids
      if (raw === null || raw === undefined) {
        // API와 동일하게: master ids 먼저, 그 다음 user ids
        activeItemIds = [...masterItemIds, ...items.map((i: any) => i.id)]
      } else {
        activeItemIds = JSON.parse(raw || '[]')
        activeItemIds = Array.isArray(activeItemIds)
          ? activeItemIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id))
          : []
      }
    } catch (e) {
      activeItemIds = [...masterItemIds, ...items.map((i: any) => i.id)]
    }
    return { ...p, items, activeItemIds }
  })

  // 최고관리자(super_admin) 판단: ADMIN_EMAILS에 포함되거나 is_master=1
  const isSuperAdmin = isAdminEmail(finalUser?.imweb_email) || finalUser?.is_master === 1

  // 최고관리자일 때 전체 치과 목록 로드
  let allClinicsData: any[] = []
  if (isSuperAdmin) {
    const clinicsResult = await c.env.DB.prepare(`
      SELECT u.*, 
        (SELECT COUNT(*) FROM playlists WHERE user_id = u.id AND (is_master_playlist = 0 OR is_master_playlist IS NULL)) as playlist_count,
        (SELECT COUNT(*) FROM notices WHERE user_id = u.id) as notice_count
      FROM users u
      WHERE u.is_master = 0 OR u.is_master IS NULL
      ORDER BY u.created_at DESC
    `).all()
    allClinicsData = clinicsResult.results || []
  }

  const initialData = {
    playlists: playlistsWithItems,
    notices: noticesData.results || [],
    masterItems: masterItemsData.results || [],
    clinicName: finalUser?.clinic_name || '내 치과',
    isOwnerAdmin: isOwnerAdmin,
    isSuperAdmin: isSuperAdmin,
    adminCode: adminCode,
    userId: finalUser?.id || 0,
    allClinics: isSuperAdmin ? allClinicsData : []
  }
  const initialDataJson = JSON.stringify(initialData).replace(/</g, '\\u003c')

  const baseUrl = new URL(c.req.url).origin
  
  return c.html(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>치과 TV 관리자</title>
  <script>
    // adminCode/email은 URL 파라미터로만 관리 (localStorage 저장 안 함)
    // localStorage는 /login 페이지에서만 사용
    try {
      const adminCode = "${adminCode}";
      const email = "${emailParam}";
      // 현재 페이지와 localStorage의 계정이 다르면 localStorage 초기화
      // (다른 계정 페이지를 열었을 때 로그인 페이지가 엉뚱한 계정으로 이동하는 것 방지)
      const savedAdminCode = localStorage.getItem('dental_tv_admin_code');
      if (savedAdminCode && savedAdminCode !== adminCode) {
        localStorage.removeItem('dental_tv_admin_code');
        localStorage.removeItem('dental_tv_email');
        localStorage.removeItem('dental_tv_session');
      }
    } catch (e) {}
  </script>
  <!-- Tailwind CSS: 빌드타임 purge (407KB CDN → 38KB 캐시 가능 파일) -->
  <link rel="stylesheet" href="/static/admin.css">
  <!-- SortableJS: defer로 렌더링 비차단 -->
  <script defer src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js"></script>
  <!-- FontAwesome: 비동기 로드 (렌더링 비차단) -->
  <link rel="preload" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css"></noscript>
  <style>
    /* body: 스크롤 가능 (imweb이 iframe 높이를 콘텐츠에 맞게 자동 조정) */
    html, body { margin: 0; padding: 0; width: 100%; height: auto; overflow-x: hidden; overflow-y: auto; }
    /* 모달 열릴 때 body 스크롤 잠금 */
    body.modal-open { overflow: hidden; }
    .tab-active { border-bottom: 2px solid #3b82f6; color: #3b82f6; }
    .modal-backdrop { background: rgba(0,0,0,0.5); }
    .toast { animation: slideIn 0.3s ease; }
    .playlist-item-highlight { background: #fef9c3 !important; box-shadow: 0 0 0 2px #facc15; }
    .library-item-highlight { background: #dbeafe !important; box-shadow: 0 0 0 2px #3b82f6; }

    /* ── 안내 모달(guide-url, script-download, tv-guide 등) 공통 ── */
    /* zoom은 JS openModal에서 동적으로 적용 (visualViewport 기준)      */
    /* 모달 박스 자체 overflow:visible → 스크롤 없이 zoom으로 축소       */
    #tv-guide-modal .bg-white,
    #script-download-modal .bg-white,
    #shortcut-guide-modal .bg-white,
    #autorun-guide-modal .bg-white,
    #guide-url-modal .bg-white {
      transform-origin: top center;
      overflow: visible;
    }
    @keyframes slideIn {
      from { transform: translateY(-100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .preview-frame {
      aspect-ratio: 16/9;
      background: #000;
    }
    .sortable-ghost {
      opacity: 0.4;
      background: #e0e7ff;
    }
    .sortable-drag {
      background: white;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    }
    .drag-handle {
      cursor: grab;
    }
    .drag-handle:active {
      cursor: grabbing;
    }
  </style>
</head>
<body class="bg-white">
  <div id="app">
    <!-- 로딩 (기본 숨김) -->
    <div id="loading" style="display:none" class="fixed inset-0 bg-white flex items-center justify-center z-50">
      <div class="text-center">
        <i class="fas fa-spinner fa-spin text-4xl text-blue-500 mb-4"></i>
        <p class="text-gray-600">로딩 중...</p>
      </div>
    </div>
    
    <!-- 메인 대시보드 (기본 표시) -->
    <div id="dashboard">
      <!-- 헤더 -->
      <header class="bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg">
        <div class="max-w-7xl mx-auto px-4 py-5 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
              <i class="fas fa-tv text-2xl text-white"></i>
            </div>
            <div>
              <h1 id="clinic-name-text" class="text-2xl font-bold text-white cursor-pointer hover:text-blue-100" onclick="editClinicName()">
                내 치과
                <i class="fas fa-pencil-alt ml-2 text-sm text-blue-200"></i>
              </h1>
              <p class="text-blue-100 text-sm">대기실 TV 관리자</p>
            </div>
          </div>
        </div>
      </header>
      
      <!-- 탭 네비게이션 -->
      <div class="bg-white border-b">
        <div class="max-w-7xl mx-auto px-4">
          <div class="flex gap-4 overflow-x-auto" id="tab-nav">
            <button id="tab-playlists" class="py-4 border-b-2 border-blue-500 text-blue-500 font-medium whitespace-nowrap"
              onclick="showTab('playlists')">
              <i class="fas fa-list mr-1"></i>플레이리스트
            </button>
            <button id="tab-notices" class="py-4 border-b-2 border-transparent text-gray-500 hover:text-gray-700 whitespace-nowrap"
              onclick="showTab('notices')">
              <i class="fas fa-bullhorn mr-1"></i>공지사항
            </button>
            <button id="tab-settings" class="py-4 border-b-2 border-transparent text-gray-500 hover:text-gray-700 whitespace-nowrap"
              onclick="showTab('settings')">
              <i class="fas fa-cog mr-1"></i>설정
            </button>
            <button id="tab-admin" class="py-4 border-b-2 border-transparent text-gray-500 hover:text-gray-700 whitespace-nowrap" style="display:none"
              onclick="showTab('admin')">
              <i class="fas fa-crown mr-1 text-purple-500"></i>관리
            </button>
          </div>
        </div>
      </div>
      
      <!-- 콘텐츠 영역 -->
      <main class="max-w-7xl mx-auto px-4 py-6">
        <!-- 플레이리스트 관리 -->
        <div id="content-playlists">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-bold text-gray-800">대기실 관리</h2>
            <button onclick="showCreatePlaylistModal()" 
              class="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-5 py-2.5 rounded-lg hover:from-blue-600 hover:to-indigo-600 transition shadow-lg">
              대기실/체어 추가
            </button>
          </div>
          
          <div id="playlists-container" class="grid gap-4">
          </div>
        </div>
        
        <!-- 공지사항 관리 -->
        <div id="content-notices" class="hidden">
          <!-- 공지 전체 ON/OFF -->
          <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-4">
            <label class="flex items-center justify-between cursor-pointer">
              <div class="flex items-center gap-3">
                <i class="fas fa-bullhorn text-green-500 text-xl"></i>
                <div>
                  <span class="font-bold text-gray-800">공지창 표시</span>
                  <p class="text-xs text-gray-500">TV 화면에 공지를 표시합니다</p>
                </div>
              </div>
              <div class="relative">
                <input type="checkbox" id="notice-global-enabled" checked
                  class="sr-only peer" onchange="toggleGlobalNotice()">
                <div class="w-14 h-8 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
              </div>
            </label>
          </div>
          
          <!-- 공통 공지 스타일 설정 -->
          <div id="notice-style-settings" class="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-6 mb-6">
            <div class="flex items-center gap-2 mb-4">
              <i class="fas fa-palette text-indigo-500"></i>
              <span class="font-bold text-gray-800">공지 스타일 설정 (공통)</span>
              <span class="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded-full">모든 공지에 적용</span>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div>
                <label class="block text-sm text-gray-600 mb-2">글자 크기</label>
                <div class="flex items-center gap-2">
                  <input type="number" id="global-notice-font-size" value="32" min="16" max="300"
                    class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    onchange="saveGlobalNoticeSettings()">
                  <span class="text-sm text-gray-500">px</span>
                </div>
              </div>
              <div>
                <label class="block text-sm text-gray-600 mb-2">자간</label>
                <div class="flex items-center gap-2">
                  <input type="number" id="global-notice-letter-spacing" value="0" min="-5" max="30" step="0.5"
                    class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    oninput="updateNoticePreview(); scheduleSaveNoticeSettings()" onchange="saveGlobalNoticeSettings()">
                  <span class="text-sm text-gray-500">px</span>
                </div>
              </div>
              <div>
                <label class="block text-sm text-gray-600 mb-2">스크롤 속도 <span id="scroll-speed-label" class="text-indigo-600 font-medium">보통</span></label>
                <input type="range" id="global-notice-scroll-speed" value="50" min="10" max="500" step="10"
                  class="w-full h-10 accent-indigo-500"
                  oninput="updateScrollSpeedLabel()" onchange="saveGlobalNoticeSettings()">
                <div class="flex justify-between text-xs text-gray-400 mt-1">
                  <span>느림</span>
                  <span>보통</span>
                  <span>빠름</span>
                  <span>매우빠름</span>
                </div>
              </div>
              <div>
                <label class="block text-sm text-gray-600 mb-2">글자 색상</label>
                <input type="color" id="global-notice-text-color" value="#ffffff"
                  class="w-full h-10 border rounded-lg cursor-pointer"
                  onchange="saveGlobalNoticeSettings()">
              </div>
              <div>
                <label class="block text-sm text-gray-600 mb-2">배경 색상</label>
                <input type="color" id="global-notice-bg-color" value="#1a1a2e"
                  class="w-full h-10 border rounded-lg cursor-pointer"
                  onchange="saveGlobalNoticeSettings()">
              </div>
              <div>
                <label class="block text-sm text-gray-600 mb-2">배경 투명도 <span id="notice-opacity-label">100%</span></label>
                <input type="range" id="global-notice-bg-opacity" value="100" min="0" max="100" step="5"
                  class="w-full h-10"
                  onchange="updateNoticeOpacityLabel(); saveGlobalNoticeSettings()">
              </div>
              <div>
                <label class="block text-sm text-gray-600 mb-2">공지 위치</label>
                <input type="hidden" id="global-notice-position" value="bottom">
                <div class="flex gap-2">
                  <button type="button" id="position-top-btn" onclick="setNoticePosition('top')"
                    class="flex-1 px-3 py-2 border rounded-lg text-sm font-medium transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200">
                    <i class="fas fa-arrow-up mr-1"></i>상단
                  </button>
                  <button type="button" id="position-bottom-btn" onclick="setNoticePosition('bottom')"
                    class="flex-1 px-3 py-2 border rounded-lg text-sm font-medium transition-colors bg-indigo-500 text-white">
                    <i class="fas fa-arrow-down mr-1"></i>하단
                  </button>
                </div>
              </div>
            </div>
            <div class="mt-3 p-2 rounded-lg overflow-hidden" id="notice-preview-bar" style="background: #1a1a2e; max-height: 60px;">
              <span id="notice-preview-text" style="color: #ffffff; font-size: 16px; font-weight: bold;">공지 미리보기</span>
            </div>
          </div>
          
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-bold text-gray-800">공지사항 목록</h2>
            <button onclick="showCreateNoticeModal()"
              class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition">
              <i class="fas fa-plus mr-2"></i>새 공지사항
            </button>
          </div>
          
          <div id="notices-container" class="grid gap-4">
          </div>
        </div>
        
        <!-- 설정 탭 -->
        <div id="content-settings" class="hidden">
          <h2 class="text-xl font-bold text-gray-800 mb-6"><i class="fas fa-cog mr-2 text-blue-500"></i>TV 설정</h2>
          
          <!-- 치과명 -->
          <div class="bg-white rounded-xl shadow-sm p-6 mb-4">
            <h3 class="font-bold text-gray-700 mb-3"><i class="fas fa-hospital mr-2 text-blue-500"></i>치과 정보</h3>
            <div class="flex gap-2">
              <input type="text" id="settings-clinic-name" value="" 
                class="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="치과명을 입력하세요">
              <button onclick="saveClinicNameFromSettings()" 
                class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium">저장</button>
            </div>
          </div>
          
          <!-- TV 바로가기 URL -->
          <div class="bg-white rounded-xl shadow-sm p-6 mb-4">
            <h3 class="font-bold text-gray-700 mb-3"><i class="fas fa-link mr-2 text-blue-500"></i>TV 바로가기 URL</h3>
            <div id="settings-tv-urls" class="space-y-2">
              <p class="text-sm text-gray-500">플레이리스트가 없습니다.</p>
            </div>
          </div>
          
          <!-- 로고 설정 -->
          <div class="bg-white rounded-xl shadow-sm p-6 mb-4">
            <h3 class="font-bold text-gray-700 mb-3"><i class="fas fa-image mr-2 text-blue-500"></i>로고 설정</h3>
            <div class="space-y-3">
              <div>
                <label class="block text-sm text-gray-600 mb-1">로고 URL</label>
                <div class="flex gap-2">
                  <input type="text" id="settings-logo-url" placeholder="https://example.com/logo.png"
                    class="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                  <button onclick="saveLogoSettings()" class="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">저장</button>
                </div>
              </div>
              <div class="flex items-center gap-4">
                <label class="text-sm text-gray-600">로고 크기</label>
                <input type="range" id="settings-logo-size" min="50" max="300" value="150" class="flex-1 accent-blue-500"
                  oninput="document.getElementById('logo-size-label').textContent=this.value+'px'">
                <span id="logo-size-label" class="text-sm text-gray-500 w-12">150px</span>
              </div>
              <div id="settings-logo-preview" class="hidden">
                <p class="text-xs text-gray-500 mb-1">미리보기</p>
                <img id="logo-preview-img" src="" class="max-h-20 rounded border">
              </div>
            </div>
          </div>
          
          <!-- 자막 설정 -->
          <div class="bg-white rounded-xl shadow-sm p-6 mb-4">
            <h3 class="font-bold text-gray-700 mb-3"><i class="fas fa-closed-captioning mr-2 text-blue-500"></i>자막 설정</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label class="block text-xs text-gray-600 mb-1">자막 글자 크기</label>
                <input type="number" id="settings-subtitle-font" value="28" min="12" max="100"
                  class="w-full px-3 py-2 border rounded-lg text-sm" onchange="saveSubtitleSettings()">
              </div>
              <div>
                <label class="block text-xs text-gray-600 mb-1">배경 투명도</label>
                <input type="range" id="settings-subtitle-opacity" value="80" min="0" max="100"
                  class="w-full accent-blue-500" onchange="saveSubtitleSettings()">
              </div>
              <div>
                <label class="block text-xs text-gray-600 mb-1">위치</label>
                <select id="settings-subtitle-position" class="w-full px-3 py-2 border rounded-lg text-sm" onchange="saveSubtitleSettings()">
                  <option value="bottom">하단</option>
                  <option value="top">상단</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-gray-600 mb-1">하단 여백</label>
                <input type="number" id="settings-subtitle-offset" value="80" min="0" max="300"
                  class="w-full px-3 py-2 border rounded-lg text-sm" onchange="saveSubtitleSettings()">
              </div>
            </div>
          </div>
          
          <!-- 계정 정보 -->
          <div class="bg-white rounded-xl shadow-sm p-6">
            <h3 class="font-bold text-gray-700 mb-3"><i class="fas fa-user mr-2 text-blue-500"></i>계정 정보</h3>
            <div class="text-sm text-gray-600 space-y-1" id="settings-account-info">
              <p>관리자 코드: <span class="font-mono bg-gray-100 px-2 py-0.5 rounded" id="settings-admin-code"></span></p>
            </div>
          </div>
        </div>
        
        <!-- 관리 탭 (최고관리자 전용) -->
        <div id="content-admin" class="hidden">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-bold text-gray-800"><i class="fas fa-crown mr-2 text-purple-500"></i>최고관리자</h2>
          </div>
          
          <!-- 관리 서브탭 -->
          <div class="flex gap-2 mb-4">
            <button onclick="showAdminSubTab('clinics')" id="admin-sub-clinics" 
              class="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium">
              <i class="fas fa-hospital mr-1"></i>치과 관리
            </button>
            <button onclick="showAdminSubTab('master-items')" id="admin-sub-master-items" 
              class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300">
              <i class="fas fa-video mr-1"></i>공용 영상
            </button>
            <button onclick="showAdminSubTab('push')" id="admin-sub-push" 
              class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300">
              <i class="fas fa-paper-plane mr-1"></i>링크 배포
            </button>
          </div>
          
          <div id="admin-body" class="min-h-[200px]">
            <div class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>로딩 중...</div>
          </div>
        </div>
        
        
      </main>
    </div>
  </div>
  
  <!-- TV 연결 방법 가이드 모달 -->
  <div id="tv-guide-modal" style="display:none" class="fixed inset-0 z-50">
    <div class="modal-backdrop absolute inset-0" onclick="closeModal('tv-guide-modal')"></div>
    <div class="absolute inset-0 flex items-start justify-center pt-4 px-4 pointer-events-none">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm pointer-events-auto">
        <!-- 헤더 -->
        <div class="px-5 py-4 border-b bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-t-xl flex justify-between items-center">
          <h3 class="font-bold"><i class="fas fa-tv mr-2"></i>TV 연결 방법</h3>
          <button onclick="closeModal('tv-guide-modal')" class="text-white/80 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <!-- 방법 1 -->
        <div class="px-5 py-4 space-y-3">
          <div class="border-2 border-blue-200 rounded-xl p-3.5 bg-blue-50">
            <div class="flex items-center gap-2 mb-2">
              <span class="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">1</span>
              <h4 class="font-bold text-blue-800 text-sm">URL 직접 입력</h4>
            </div>
            <ol class="space-y-1 text-gray-700 text-xs ml-1">
              <li>① TV 웹브라우저 실행</li>
              <li>② <strong>「단축」</strong> 버튼으로 짧은 URL 생성</li>
              <li>③ TV에서 단축 URL 입력 후 전체화면</li>
            </ol>
          </div>
          <!-- 방법 2 -->
          <div class="border-2 border-green-200 rounded-xl p-3.5 bg-green-50">
            <div class="flex items-center gap-2 mb-2">
              <span class="bg-green-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">2</span>
              <h4 class="font-bold text-green-800 text-sm">USB 북마크</h4>
              <span class="bg-green-100 text-green-600 text-xs px-1.5 py-0.5 rounded-full">추천</span>
            </div>
            <ol class="space-y-1 text-gray-700 text-xs ml-1">
              <li>① <strong>「USB 북마크 다운로드」</strong> 클릭</li>
              <li>② HTML 파일을 USB에 복사 후 TV에 연결</li>
              <li>③ TV 브라우저에서 파일 열기 → 링크 클릭</li>
            </ol>
          </div>
        </div>
        <!-- 버튼 -->
        <div class="px-5 pb-4">
          <button onclick="closeModal('tv-guide-modal')"
            class="w-full bg-indigo-500 text-white py-2.5 rounded-lg hover:bg-indigo-600 text-sm font-medium">
            확인
          </button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- TV 설치 방법 모달 (통합) -->
  <div id="script-download-modal" style="display:none" class="fixed inset-0 z-50">
    <div class="modal-backdrop absolute inset-0" onclick="closeModal('script-download-modal')"></div>
    <div class="absolute inset-0 flex items-start justify-center px-4 pt-10 pointer-events-none">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg pointer-events-auto">
        <!-- 헤더 -->
        <div class="px-4 py-3 border-b bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-t-xl flex justify-between items-center">
          <h3 class="font-bold text-sm">유니트체어 모니터 설치 방법</h3>
          <button onclick="closeModal('script-download-modal')" class="text-white/80 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div class="px-4 py-3 space-y-2.5">
          <!-- 설치 단계 3개 가로 배치 -->
          <div class="flex gap-2">
            <div class="flex-1 flex items-start gap-1.5 p-2 bg-gray-50 rounded-lg">
              <span class="bg-indigo-500 text-white w-4 h-4 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">1</span>
              <div>
                <p class="font-medium text-gray-800 text-xs leading-tight">파일 다운로드</p>
                <p class="text-xs text-gray-500 leading-tight mt-0.5">BAT 또는 VBS 선택</p>
              </div>
            </div>
            <div class="flex-1 flex items-start gap-1.5 p-2 bg-gray-50 rounded-lg">
              <span class="bg-indigo-500 text-white w-4 h-4 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">2</span>
              <div>
                <p class="font-medium text-gray-800 text-xs leading-tight">시작 폴더에 복사</p>
                <p class="text-xs text-gray-500 leading-tight mt-0.5">Win+R → <span class="bg-yellow-100 px-0.5 rounded font-mono">shell:startup</span></p>
              </div>
            </div>
            <div class="flex-1 flex items-start gap-1.5 p-2 bg-gray-50 rounded-lg">
              <span class="bg-indigo-500 text-white w-4 h-4 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">3</span>
              <div>
                <p class="font-medium text-gray-800 text-xs leading-tight">파일 더블클릭</p>
                <p class="text-xs text-gray-500 leading-tight mt-0.5">전체화면 재생 시작</p>
              </div>
            </div>
          </div>

          <!-- 파일 형식 선택 + 버튼 -->  
          <div class="border rounded-lg p-2.5 bg-white">
            <p class="text-xs font-medium text-gray-500 mb-1.5">파일 형식 선택</p>
            <div class="flex gap-2 mb-2">
              <label class="flex-1 cursor-pointer">
                <input type="radio" name="script-type" value="bat" checked class="hidden peer">
                <div class="py-1.5 px-2 text-center border-2 rounded-lg peer-checked:border-indigo-500 peer-checked:bg-indigo-50 transition-all">
                  <p class="font-bold text-gray-800 text-xs">BAT</p>
                  <p class="text-xs text-gray-400">창이 잠깐 표시</p>
                </div>
              </label>
              <label class="flex-1 cursor-pointer">
                <input type="radio" name="script-type" value="vbs" class="hidden peer">
                <div class="py-1.5 px-2 text-center border-2 rounded-lg peer-checked:border-indigo-500 peer-checked:bg-indigo-50 transition-all">
                  <p class="font-bold text-gray-800 text-xs">VBS</p>
                  <p class="text-xs text-gray-400">창 없이 실행</p>
                </div>
              </label>
            </div>
            <div class="flex gap-2">
              <button onclick="copyInstallLink()" class="flex-1 bg-indigo-500 text-white py-2 rounded-lg hover:bg-indigo-600 text-sm font-medium">
                링크 복사
              </button>
              <button onclick="downloadInstallScript()" class="flex-1 bg-gray-400 text-white py-2 rounded-lg hover:bg-gray-500 text-sm font-medium">
                다운로드
              </button>
            </div>
          </div>

          <!-- 링크 복사 사용법 + 설치 후 사용법 가로 배치 -->
          <div class="flex gap-2">
            <div class="flex-1 bg-indigo-50 rounded-lg px-2.5 py-2">
              <p class="text-xs font-medium text-indigo-800 mb-1">링크 복사 사용법</p>
              <p class="text-xs text-indigo-600">• URL을 <strong>브라우저 주소창</strong>에 입력</p>
              <p class="text-xs text-indigo-600">• 즐겨찾기 저장 후 재사용 가능</p>
            </div>
            <div class="flex-1 bg-blue-50 rounded-lg px-2.5 py-2">
              <p class="text-xs font-medium text-blue-800 mb-1">설치 후 사용법</p>
              <p class="text-xs text-blue-600">• 전체화면 해제: ESC 또는 F11</p>
              <p class="text-xs text-blue-600">• 전체화면 복귀: 화면 아무곳 클릭</p>
            </div>
          </div>

          <!-- 참고 -->
          <div class="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
            <p class="text-xs text-gray-600"><strong>참고.</strong> PC 재부팅 시 자동으로 전체화면 시작. 필요 시 브라우저 감추기 후 다른 창 사용.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- =========================================================
       ========================================================= -->
  
  <!-- 바로가기 생성 가이드 모달 -->
  <div id="shortcut-guide-modal" style="display:none" class="fixed inset-0 z-50">
    <div class="modal-backdrop absolute inset-0" onclick="closeModal('shortcut-guide-modal')"></div>
    <div class="absolute inset-0 flex items-start justify-center pt-4 px-4 pointer-events-none">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm pointer-events-auto">
        <div class="px-5 py-4 border-b bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-t-xl flex justify-between items-center">
          <h3 class="font-bold"><i class="fas fa-link mr-2"></i>바로가기 직접 만들기</h3>
          <button onclick="closeModal('shortcut-guide-modal')" class="text-white/80 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <div class="px-5 py-4 space-y-3">
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 text-xs">
            <i class="fas fa-info-circle text-yellow-500 mr-1"></i>스크립트 파일 없이 가장 안전한 방법
          </div>
          <ol class="space-y-2.5 text-xs">
            <li class="flex gap-2.5 items-start">
              <span class="bg-purple-500 text-white w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">1</span>
              <p class="text-gray-700">바탕화면 우클릭 → 새로 만들기 → 바로 가기</p>
            </li>
            <li class="flex gap-2.5 items-start">
              <span class="bg-purple-500 text-white w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">2</span>
              <div class="flex-1">
                <p class="text-gray-700 mb-1.5">아래 내용 복사해서 붙여넣기:</p>
                <div class="bg-gray-100 p-2 rounded font-mono text-xs break-all" id="shortcut-command"></div>
                <button onclick="copyShortcutCommand()" class="mt-1.5 text-purple-600 text-xs hover:underline">
                  <i class="fas fa-copy mr-1"></i>복사하기
                </button>
              </div>
            </li>
            <li class="flex gap-2.5 items-start">
              <span class="bg-purple-500 text-white w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">3</span>
              <p class="text-gray-700">이름 입력 후 → <kbd class="bg-gray-100 px-1 rounded font-mono">Win+R</kbd> → <kbd class="bg-gray-100 px-1 rounded font-mono">shell:startup</kbd> → 바로가기 복사</p>
            </li>
          </ol>
          <div class="bg-purple-50 border border-purple-200 rounded-lg p-2.5">
            <p class="text-xs font-medium text-purple-800 mb-1">각 체어 URL:</p>
            <div class="space-y-1 text-xs font-mono max-h-24 overflow-y-auto" id="all-chair-urls"></div>
          </div>
        </div>
        <div class="px-5 pb-4">
          <button onclick="closeModal('shortcut-guide-modal')"
            class="w-full bg-purple-500 text-white py-2.5 rounded-lg hover:bg-purple-600 text-sm font-medium">
            확인
          </button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- 자동 실행 가이드 모달 -->
  <div id="autorun-guide-modal" style="display:none" class="fixed inset-0 z-50">
    <div class="modal-backdrop absolute inset-0" onclick="closeModal('autorun-guide-modal')"></div>
    <div class="absolute inset-0 flex items-start justify-center pt-4 px-4 pointer-events-none">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm pointer-events-auto">
        <div class="px-5 py-4 border-b bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-t-xl flex justify-between items-center">
          <h3 class="font-bold"><i class="fas fa-check-circle mr-2"></i>다운로드 완료!</h3>
          <button onclick="closeModal('autorun-guide-modal')" class="text-white/80 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <div class="px-5 py-4 space-y-3">
          <div class="bg-green-50 border border-green-200 rounded-lg p-3">
            <p class="font-bold text-green-800 text-sm">📁 치과TV_자동실행.bat</p>
            <p class="text-xs text-green-700 mt-1">실행하면 모든 체어 화면이 자동으로 열립니다</p>
          </div>
          <div>
            <p class="text-xs font-bold text-gray-700 mb-1.5">사용 방법</p>
            <ol class="space-y-1 text-xs text-gray-600">
              <li>① 파일 더블클릭 → 모든 체어 화면이 크롬으로 열림</li>
              <li>② 각 크롬 창을 해당 체어 모니터로 드래그</li>
            </ol>
          </div>
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p class="text-xs font-bold text-blue-800 mb-1.5"><i class="fas fa-magic mr-1"></i>PC 시작 시 자동 실행</p>
            <ol class="space-y-1 text-xs text-blue-700">
              <li>① <kbd class="bg-white px-1 rounded border">Win+R</kbd> → <kbd class="bg-white px-1 rounded border font-mono">shell:startup</kbd> 입력</li>
              <li>② 열린 폴더에 bat 파일 복사 → PC 켜면 자동 실행!</li>
            </ol>
          </div>
        </div>
        <div class="px-5 pb-4">
          <button onclick="closeModal('autorun-guide-modal')"
            class="w-full bg-green-500 text-white py-2.5 rounded-lg hover:bg-green-600 text-sm font-medium">
            확인
          </button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- 대기실/체어 추가 모달 -->
  <div id="create-playlist-modal" style="display:none" class="fixed inset-0 z-50">
    <div class="modal-backdrop absolute inset-0" onclick="closeModal('create-playlist-modal')"></div>
    <div class="absolute inset-0 flex items-start justify-center p-4 pt-10 pointer-events-none overflow-y-auto">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md pointer-events-auto">
        <div class="p-6 border-b bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-t-xl">
          <h3 class="text-lg font-bold"><i class="fas fa-plus-circle mr-2"></i>새로 추가하기</h3>
          <p class="text-blue-100 text-sm mt-1">대기실 또는 체어를 추가하세요</p>
        </div>
        
        <!-- Step 1: 타입 선택 -->
        <div id="create-step-1" class="p-6">
          <p class="text-sm text-gray-600 mb-4">어떤 TV를 추가할까요?</p>
          <div class="grid grid-cols-2 gap-3">
            <button type="button" onclick="selectCreateType('waiting')"
              class="p-4 border-2 border-gray-200 rounded-xl hover:border-teal-500 hover:bg-teal-50 transition group">
              <div class="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-teal-200">
                <i class="fas fa-couch text-teal-600 text-xl"></i>
              </div>
              <p class="font-bold text-gray-800">대기실</p>
              <p class="text-xs text-gray-500 mt-1">스마트 TV에서 재생</p>
            </button>
            <button type="button" onclick="selectCreateType('chair')"
              class="p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition group">
              <div class="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-indigo-200">
                <i class="fas fa-tv text-indigo-600 text-xl"></i>
              </div>
              <p class="font-bold text-gray-800">체어</p>
              <p class="text-xs text-gray-500 mt-1">PC 모니터에서 재생</p>
            </button>
          </div>
          <button type="button" onclick="closeModal('create-playlist-modal')"
            class="w-full mt-4 px-4 py-2 text-gray-500 hover:text-gray-700">취소</button>
        </div>
        
        <!-- Step 2: 대기실 설정 -->
        <div id="create-step-waiting" class="hidden p-6">
          <button onclick="backToStep1()" class="text-gray-500 hover:text-gray-700 mb-4 text-sm">
            <i class="fas fa-arrow-left mr-1"></i>뒤로
          </button>
          
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
              <i class="fas fa-couch text-teal-600"></i>
            </div>
            <div>
              <h4 class="font-bold text-gray-800">대기실 추가</h4>
              <p class="text-xs text-gray-500">스마트 TV에서 재생됩니다</p>
            </div>
          </div>
          
          <div class="mb-4">
            <label class="block text-gray-700 text-sm font-medium mb-2">대기실 이름</label>
            <input type="text" id="new-waiting-name" 
              class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500"
              placeholder="예: 대기실1, 로비">
          </div>
          
          <div class="mb-4">
            <label class="block text-gray-700 text-sm font-medium mb-2">TV 연결 방식</label>
            <p class="text-xs text-gray-500 mb-3">USB 인식 문제가 있어 <strong>URL 직접 입력 방식</strong>만 제공합니다.</p>
            <div class="p-4 border-2 border-blue-200 rounded-xl bg-blue-50">
              <p class="font-bold text-gray-800">
                단축 URL 직접 입력
                <span class="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded ml-2">권장</span>
              </p>
              <div class="mt-2 text-sm text-gray-600 space-y-1">
                <p><i class="fas fa-check text-green-500 mr-1"></i>TV 리모컨으로 짧은 주소 입력</p>
                <p><i class="fas fa-check text-green-500 mr-1"></i>USB 없이 바로 연결 가능</p>
                <p><i class="fas fa-check text-green-500 mr-1"></i>인터넷만 되면 OK</p>
              </div>
              <div class="mt-2 p-2 bg-white rounded text-xs text-gray-600 border border-blue-100">
                <i class="fas fa-info-circle mr-1"></i>사용법: TV 인터넷 브라우저 → 주소창에 URL 입력 → 전체화면
              </div>
            </div>
          </div>
          
          <div class="flex gap-3">
            <button type="button" onclick="closeModal('create-playlist-modal')"
              class="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50">취소</button>
            <button type="button" onclick="createWaitingRoom()"
              class="flex-1 px-4 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium">
              <i class="fas fa-plus mr-1"></i>추가하기
            </button>
          </div>
        </div>
        
        <!-- Step 2: 체어 설정 -->
        <div id="create-step-chair" class="hidden p-6">
          <button onclick="backToStep1()" class="text-gray-500 hover:text-gray-700 mb-4 text-sm">
            <i class="fas fa-arrow-left mr-1"></i>뒤로
          </button>
          
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <i class="fas fa-tv text-indigo-600"></i>
            </div>
            <div>
              <h4 class="font-bold text-gray-800">체어 추가</h4>
              <p class="text-xs text-gray-500">PC 모니터에서 재생됩니다</p>
            </div>
          </div>
          
          <div class="mb-4">
            <label class="block text-gray-700 text-sm font-medium mb-2">체어 이름</label>
            <input type="text" id="new-chair-name" 
              class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="예: 체어1, 진료실1">
          </div>
          
          <div class="bg-indigo-50 p-3 rounded-lg mb-4">
            <p class="text-sm text-indigo-700">
              <i class="fas fa-info-circle mr-1"></i>
              체어는 <strong>자동 실행 스크립트</strong>로 설정합니다.<br>
              <span class="text-xs">추가 후 스크립트를 다운로드하세요.</span>
            </p>
          </div>
          
          <div class="flex gap-3">
            <button type="button" onclick="closeModal('create-playlist-modal')"
              class="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50">취소</button>
            <button type="button" onclick="createChair()"
              class="flex-1 px-4 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 font-medium">
              <i class="fas fa-plus mr-1"></i>추가하기
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- 대기실 설치 가이드 모달 (단축 URL) -->
  <div id="guide-url-modal" style="display:none" class="fixed inset-0 z-50">
    <div class="modal-backdrop absolute inset-0" onclick="closeModal('guide-url-modal')"></div>
    <div class="absolute inset-0 flex items-start justify-center pt-4 px-4 pointer-events-none">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm pointer-events-auto">
        <!-- 헤더 -->
        <div class="px-5 py-4 border-b bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-t-xl flex justify-between items-center">
          <div>
            <h3 class="font-bold"><i class="fas fa-link mr-2"></i>대기실 TV 연결</h3>
            <p class="text-blue-100 text-xs mt-0.5">리모컨으로 주소 입력 후 접속</p>
          </div>
          <button onclick="closeModal('guide-url-modal')" class="text-white/80 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <!-- URL 표시 -->
        <div class="px-5 pt-4 pb-2">
          <div class="bg-blue-50 border-2 border-blue-200 rounded-xl py-3 text-center">
            <p class="text-xs text-blue-500 mb-1">TV에 입력할 주소</p>
            <p id="guide-short-url" class="text-2xl font-bold text-blue-800 font-mono tracking-wide"></p>
            <button onclick="copyGuideUrl()" class="mt-1.5 text-xs text-blue-600 hover:text-blue-800">
              <i class="fas fa-copy mr-1"></i>복사하기
            </button>
          </div>
        </div>
        <!-- 3단계 -->
        <div class="px-5 py-3 space-y-2">
          <div class="flex items-center gap-3">
            <div class="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs">1</div>
            <div>
              <p class="text-sm font-semibold text-gray-800">TV 웹브라우저 열기</p>
              <p class="text-xs text-gray-500">리모컨에서 인터넷/웹브라우저 버튼</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs">2</div>
            <div>
              <p class="text-sm font-semibold text-gray-800">주소창에 위 URL 입력 후 이동</p>
              <p class="text-xs text-gray-500">북마크로 저장하면 다음에도 바로 접속</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs">3</div>
            <div>
              <p class="text-sm font-semibold text-gray-800">화면 클릭 → 전체화면 재생</p>
              <p class="text-xs text-gray-500">터치하거나 클릭하면 전체화면으로 전환</p>
            </div>
          </div>
        </div>
        <!-- 버튼 -->
        <div class="px-5 pb-4 pt-2 flex gap-2">
          <button onclick="makeUrlShorter()" class="flex-1 py-2 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 text-sm">
            단축 URL 생성
          </button>
          <button onclick="closeModal('guide-url-modal')" class="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium">
            확인
          </button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- USB 가이드 모달 제거: URL 직접 입력만 사용 -->
  
  <!-- 플레이리스트 편집 모달 -->
  <div id="edit-playlist-modal" style="display:none" class="fixed inset-0 z-50">
    <div class="modal-backdrop absolute inset-0" onclick="closeModal('edit-playlist-modal')"></div>
    <div class="absolute inset-0 flex items-start justify-center px-4 pointer-events-none">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-6xl overflow-hidden pointer-events-auto flex flex-col" style="max-height:100vh; height:100vh;">
        <div class="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 id="edit-playlist-title" class="text-lg font-bold">플레이리스트 편집</h3>
          <button onclick="closeModal('edit-playlist-modal')" class="text-gray-400 hover:text-gray-600">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
        
        <div class="flex flex-1 overflow-hidden">
          <!-- 왼쪽: 라이브러리 (미디어 추가 + 전체 영상 목록) -->
          <div class="w-1/2 border-r flex flex-col overflow-hidden">
            <div class="p-4 bg-blue-50 border-b">
              <div class="flex items-center gap-2 mb-3">
                <i class="fas fa-photo-video text-blue-500"></i>
                <span class="font-bold text-gray-800">라이브러리</span>
                <span class="text-xs text-gray-500">(클릭하여 재생목록에 추가)</span>
              </div>
              
              <!-- 미디어 추가 입력 -->
              <div class="flex gap-2 mb-2">
                <button id="tab-video" onclick="switchMediaTab('video')" 
                  class="px-3 py-1.5 bg-blue-500 text-white rounded text-sm font-medium">
                  <i class="fab fa-youtube mr-1"></i>동영상
                </button>
                <button id="tab-image" onclick="switchMediaTab('image')" 
                  class="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300">
                  <i class="fas fa-image mr-1"></i>이미지
                </button>
              </div>

              <!-- 동영상 입력 -->
              <div id="input-video">
                <div class="flex gap-2">
                  <input type="text" id="new-video-url" 
                    class="flex-1 px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="Vimeo URL">
                  <button onclick="addVideoToLibrary()" class="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600">
                    <i class="fas fa-plus"></i>
                  </button>
                </div>
                <p class="text-xs text-gray-500 mt-2">플레이리스트 업로드는 Vimeo URL만 가능합니다.</p>
              </div>
              
              <!-- 이미지 입력 -->
              <div id="input-image" class="hidden">
                <div class="flex gap-2">
                  <input type="text" id="new-image-url" 
                    class="flex-1 px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="이미지 URL">
                  <input type="number" id="new-image-display-time" value="10" min="1" max="300"
                    class="w-16 px-2 py-2 border rounded text-sm text-center" placeholder="초">
                  <button onclick="addImageToLibrary()" class="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600">
                    <i class="fas fa-plus"></i>
                  </button>
                </div>
              </div>

              <!-- 라이브러리 검색 -->
              <div class="mt-3">
                <input type="text" id="library-search" placeholder="라이브러리 검색"
                  oninput="updateLibrarySearch()"
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm">
                <div id="library-search-results" class="mt-2 border rounded-lg max-h-40 overflow-y-auto hidden"></div>
                <p id="library-search-message" class="text-xs text-red-500 mt-1 hidden">검색 결과가 없습니다</p>
              </div>
            </div>
            
            <!-- 라이브러리 목록 -->
            <div id="library-scroll-container" class="p-4 flex-1 overflow-y-auto" style="min-height:0;">
              <!-- 공용 영상 -->
              <div id="library-master-section" class="mb-4 hidden">
                <div class="flex items-center gap-2 mb-2 text-sm">
                  <i class="fas fa-crown text-purple-500"></i>
                  <span class="font-medium text-purple-700">공용 영상</span>
                </div>
                <div id="library-master-list" class="space-y-2"></div>
              </div>
              
              <!-- 내 영상 -->
              <div class="mb-4">
                <div class="flex items-center gap-2 mb-2 text-sm">
                  <i class="fas fa-folder text-blue-500"></i>
                  <span class="font-medium text-gray-700">내 영상</span>
                </div>
                <div id="library-user-list" class="space-y-2">
                  <div class="text-center py-8 text-gray-400 text-sm">
                    영상을 추가하세요
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 오른쪽: 재생 플레이리스트 -->
          <div class="w-1/2 flex flex-col overflow-hidden">
            <div class="p-4 bg-green-50 border-b">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <i class="fas fa-play-circle text-green-500"></i>
                  <span class="font-bold text-gray-800">재생 플레이리스트</span>
                  <span id="playlist-count" class="text-xs bg-green-200 text-green-700 px-2 py-0.5 rounded-full">0개</span>
                </div>
                <span class="text-xs text-gray-400">
                  <i class="fas fa-grip-vertical mr-1"></i>드래그하여 순서 변경
                </span>
              </div>
              <p class="text-xs text-gray-500 mt-1">위에서부터 순서대로 재생됩니다</p>
            </div>
            
            <div id="playlist-items-container" class="flex-1 overflow-y-auto p-4 space-y-2 border-t" style="min-height:0;">
              <div class="text-center py-8 text-gray-400 text-sm">
                왼쪽 라이브러리에서 영상을 클릭하여 추가하세요
              </div>
            </div>
          </div>
        </div>
        
        <!-- 하단 설정 영역 (접이식) -->
        <div class="border-t">
          <button onclick="togglePlaylistSettings()" class="w-full p-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-center gap-2 text-sm text-gray-600">
            <i id="settings-toggle-icon" class="fas fa-chevron-down"></i>
            <span>추가 설정 (로고, 전환효과, 스케줄 등)</span>
          </button>
          <div id="playlist-settings-panel" class="hidden p-4 bg-gray-50 max-h-none overflow-visible">
            <!-- 기존 설정들을 여기로 이동 -->
            <div class="space-y-3">
              <div class="bg-white rounded-lg border">
                <button type="button" onclick="toggleSettingsSection('logo')" class="w-full p-3 flex items-center justify-between text-sm text-gray-700">
                  <span class="flex items-center gap-2">
                    <i class="fas fa-image text-amber-500"></i>
                    <span class="font-medium">로고 & 전환 효과</span>
                  </span>
                  <i id="settings-section-icon-logo" class="fas fa-chevron-down"></i>
                </button>
                <div id="settings-section-logo" class="hidden p-4 border-t">
                  <div class="grid grid-cols-2 gap-4">
                    <!-- 로고 설정 -->
                    <div class="bg-white rounded-lg p-4 border">
                      <div class="flex items-center gap-2 mb-3">
                        <i class="fas fa-image text-amber-500"></i>
                        <span class="font-medium text-gray-800 text-sm">로고</span>
                      </div>
                      <input type="text" id="logo-url" placeholder="로고 URL (PNG 권장)"
                        class="w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-amber-500 mb-2"
                        onchange="saveLogoSettings()">
                      <div class="flex gap-2">
                        <div class="flex-1">
                          <label class="text-xs text-gray-500">크기 <span id="logo-size-value">150px</span></label>
                          <input type="range" id="logo-size" min="50" max="500" step="10" value="150"
                            onchange="updateLogoSizeLabel(); saveLogoSettings()" class="w-full">
                        </div>
                        <div class="flex-1">
                          <label class="text-xs text-gray-500">투명도 <span id="logo-opacity-value">90%</span></label>
                          <input type="range" id="logo-opacity" min="10" max="100" step="5" value="90"
                            onchange="updateLogoOpacityLabel(); saveLogoSettings()" class="w-full">
                        </div>
                      </div>
                    </div>
                    
                    <!-- 전환 효과 -->
                    <div class="bg-white rounded-lg p-4 border">
                      <div class="flex items-center gap-2 mb-3">
                        <i class="fas fa-magic text-purple-500"></i>
                        <span class="font-medium text-gray-800 text-sm">전환 효과</span>
                      </div>
                      <select id="transition-effect" onchange="saveTransitionSettings()"
                        class="w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-purple-500 bg-white mb-2">
                        <option value="fade">페이드</option>
                        <option value="slide-left">슬라이드 왼쪽</option>
                        <option value="slide-right">슬라이드 오른쪽</option>
                        <option value="zoom">줌</option>
                        <option value="none">없음</option>
                      </select>
                      <div>
                        <label class="text-xs text-gray-500">전환 시간 <span id="transition-duration-value">500ms</span></label>
                        <input type="range" id="transition-duration" min="100" max="2000" step="100" value="500"
                          onchange="updateTransitionDurationLabel(); saveTransitionSettings()" class="w-full">
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="bg-white rounded-lg border">
                <button type="button" onclick="toggleSettingsSection('schedule')" class="w-full p-3 flex items-center justify-between text-sm text-gray-700">
                  <span class="flex items-center gap-2">
                    <i class="fas fa-clock text-blue-500"></i>
                    <span class="font-medium">스케줄 관리</span>
                  </span>
                  <i id="settings-section-icon-schedule" class="fas fa-chevron-down"></i>
                </button>
                <div id="settings-section-schedule" class="hidden p-4 border-t">
                  <div class="flex items-center justify-between mb-3">
                    <label class="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" id="schedule-enabled" onchange="toggleScheduleSettings()" class="rounded">
                      <span class="font-medium">재생 시간 제한 사용</span>
                    </label>
                    <span class="text-xs text-gray-400">예: 09:00 ~ 18:00</span>
                  </div>
                  <div id="schedule-inputs" class="grid grid-cols-2 gap-3 opacity-50 pointer-events-none">
                    <div>
                      <label class="text-xs text-gray-500">시작 시간</label>
                      <input type="time" id="schedule-start" onchange="saveScheduleSettings()"
                        class="w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                      <label class="text-xs text-gray-500">종료 시간</label>
                      <input type="time" id="schedule-end" onchange="saveScheduleSettings()"
                        class="w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500">
                    </div>
                  </div>
                  <p class="text-xs text-gray-500 mt-2">설정된 시간 외에는 대기 화면이 표시됩니다.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- 기존 설정 영역 (숨김 처리) -->
  <div class="hidden">
          <!-- 로고 설정 -->
          <div class="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 mb-6">
            <div class="flex items-center gap-2 mb-3">
              <i class="fas fa-image text-amber-500"></i>
              <span class="font-bold text-gray-800">로고 URL (PNG 권장)</span>
            </div>
            <input type="text" id="logo-url" placeholder="https://example.com/logo.png"
              class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 mb-4"
              onchange="saveLogoSettings()">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm text-gray-600 mb-2">로고 크기 (px) <span id="logo-size-value">150px</span></label>
                <input type="range" id="logo-size" min="50" max="500" step="10" value="150"
                  onchange="updateLogoSizeLabel(); saveLogoSettings()" class="w-full">
                <div class="flex justify-between text-xs text-gray-400 mt-1">
                  <span>50px</span><span>500px</span>
                </div>
              </div>
              <div>
                <label class="block text-sm text-gray-600 mb-2">로고 투명도 <span id="logo-opacity-value">90%</span></label>
                <input type="range" id="logo-opacity" min="10" max="100" step="5" value="90"
                  onchange="updateLogoOpacityLabel(); saveLogoSettings()" class="w-full">
                <div class="flex justify-between text-xs text-gray-400 mt-1">
                  <span>투명</span><span>불투명</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 전환 효과 설정 -->
          <div class="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-5 mb-6">
            <div class="flex items-center gap-2 mb-3">
              <i class="fas fa-magic text-purple-500"></i>
              <span class="font-bold text-gray-800">전환 효과</span>
            </div>
            <div class="mb-4">
              <label class="block text-sm text-gray-600 mb-2">✨ 전환 효과 선택</label>
              <select id="transition-effect" onchange="saveTransitionSettings()"
                class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 bg-white">
                <option value="fade">✨ 페이드 (Fade)</option>
                <option value="slide-left">⬅️ 슬라이드 왼쪽</option>
                <option value="slide-right">➡️ 슬라이드 오른쪽</option>
                <option value="slide-up">⬆️ 슬라이드 위로</option>
                <option value="slide-down">⬇️ 슬라이드 아래로</option>
                <option value="zoom">🔍 줌 (Zoom)</option>
                <option value="flip">🔄 플립 (Flip)</option>
                <option value="none">⏹️ 없음 (None)</option>
              </select>
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-2">전환 효과 지속 시간 <span id="duration-label">1.0초</span></label>
              <input type="range" id="transition-duration" min="300" max="3000" step="100" value="1000"
                onchange="updateDurationLabel(); saveTransitionSettings()" class="w-full">
              <div class="flex justify-between text-xs text-gray-400 mt-1">
                <span>빠름 (0.3초)</span><span>느림 (3.0초)</span>
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-3">
              <i class="fas fa-info-circle mr-1"></i>영상/이미지 전환 시 적용되는 효과의 속도입니다
            </p>
          </div>
          
          <!-- 재생시간 설정 -->
          <div class="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-5 mb-6">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <i class="fas fa-clock text-teal-500"></i>
                <span class="font-bold text-gray-800">재생시간 설정</span>
              </div>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="schedule-enabled" 
                  class="w-5 h-5 text-teal-500 rounded focus:ring-teal-500"
                  onchange="toggleScheduleSettings()">
                <span class="text-sm font-medium text-gray-700">사용</span>
              </label>
            </div>
            <div id="schedule-inputs" class="grid grid-cols-2 gap-4 opacity-50 pointer-events-none">
              <div>
                <label class="block text-sm text-gray-600 mb-2">재생 시작시간</label>
                <input type="time" id="schedule-start" 
                  class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500"
                  onchange="saveScheduleSettings()">
              </div>
              <div>
                <label class="block text-sm text-gray-600 mb-2">재생 종료시간</label>
                <input type="time" id="schedule-end"
                  class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500"
                  onchange="saveScheduleSettings()">
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-3">
              <i class="fas fa-info-circle mr-1"></i>체크하면 설정한 시간에만 재생됩니다. 예: 09:30 ~ 20:00
            </p>
          </div>
  </div>
  
  <!-- 미리보기 모달 -->
  <div id="preview-modal" style="display:none" class="fixed inset-0 z-50">
    <div class="modal-backdrop absolute inset-0" onclick="closeModal('preview-modal')"></div>
    <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-4xl pointer-events-auto">
        <div class="p-4 border-b flex justify-between items-center">
          <div class="flex items-center gap-3">
            <i class="fas fa-tv text-blue-500"></i>
            <h3 class="text-lg font-bold">TV 미리보기</h3>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="sendToTv()" class="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 text-sm">
              <i class="fas fa-external-link-alt mr-2"></i>TV로 보내기 (새창)
            </button>
            <button onclick="closeModal('preview-modal')" class="text-gray-400 hover:text-gray-600 p-2">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>
        <div class="p-4">
          <div class="preview-frame rounded-lg overflow-hidden">
            <iframe id="preview-iframe" class="w-full h-full" style="min-height: 400px;" allow="autoplay; fullscreen; picture-in-picture"></iframe>
          </div>
          <p class="text-center text-sm text-gray-500 mt-3">
            <i class="fas fa-info-circle mr-1"></i>
            실제 TV에서는 전체 화면으로 표시됩니다. 화면을 클릭하면 전체화면 모드로 전환됩니다.
          </p>
        </div>
      </div>
    </div>
  </div>
  
  <!-- 공지사항 생성/편집 모달 (내용만 입력, 스타일은 공통 설정) -->
  <div id="notice-modal" style="display:none" class="fixed inset-0 z-50">
    <div class="modal-backdrop absolute inset-0" onclick="closeModal('notice-modal')"></div>
    <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg pointer-events-auto">
        <div class="p-6 border-b">
          <h3 id="notice-modal-title" class="text-lg font-bold">새 공지사항</h3>
        </div>
        <form onsubmit="saveNotice(event)" class="p-6">
          <input type="hidden" id="notice-id">
          <div class="mb-4">
            <label class="block text-gray-700 text-sm font-medium mb-2">공지 내용</label>
            <textarea id="notice-content" required rows="4"
              class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
              placeholder="TV 화면 하단에 표시될 공지 내용을 입력하세요"></textarea>
          </div>
          <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <label class="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" id="notice-urgent" 
                class="w-5 h-5 text-blue-500 rounded focus:ring-blue-500">
              <div>
                <span class="font-medium text-blue-700">긴급공지</span>
                <p class="text-xs text-blue-500 mt-1">긴급공지는 일반 공지보다 우선 표시되고, 파란색 배경으로 강조됩니다.</p>
              </div>
            </label>
          </div>
          <p class="text-xs text-gray-400 mb-4">
            <i class="fas fa-info-circle mr-1"></i>
            스타일 설정(글자 크기, 색상 등)은 상단의 '공지 스타일 설정'에서 공통으로 적용됩니다.
          </p>
          <div class="flex gap-3">
            <button type="button" onclick="closeModal('notice-modal')"
              class="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50">취소</button>
            <button type="submit"
              class="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600">저장</button>
          </div>
        </form>
      </div>
    </div>
  </div>
  
  <!-- QR 코드 모달 -->
  <div id="qr-modal" style="display:none" class="fixed inset-0 z-50">
    <div class="modal-backdrop absolute inset-0" onclick="closeModal('qr-modal')"></div>
    <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm pointer-events-auto">
        <div class="p-4 border-b flex justify-between items-center">
          <h3 class="text-lg font-bold"><i class="fas fa-qrcode mr-2"></i>QR 코드</h3>
          <button onclick="closeModal('qr-modal')" class="text-gray-400 hover:text-gray-600">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
        <div class="p-6 text-center">
          <div id="qr-code-container" class="flex justify-center mb-4">
            <!-- QR 코드 이미지 -->
          </div>
          <p id="qr-url-text" class="text-sm text-gray-600 break-all mb-4"></p>
          <p class="text-xs text-gray-500">TV에서 이 QR 코드를 스캔하거나<br>위 주소를 직접 입력하세요</p>
        </div>
      </div>
    </div>
  </div>
  
  <!-- 치과명 편집 모달 -->
  <div id="clinic-name-modal" style="display:none" class="fixed inset-0 z-50">
    <div class="modal-backdrop absolute inset-0" onclick="closeModal('clinic-name-modal')"></div>
    <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md pointer-events-auto">
        <div class="p-6 border-b">
          <h3 class="text-lg font-bold">치과명 변경</h3>
        </div>
        <form onsubmit="saveClinicName(event)" class="p-6">
          <div class="mb-4">
            <label class="block text-gray-700 text-sm font-medium mb-2">치과명</label>
            <input type="text" id="edit-clinic-name" required
              class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="OO치과">
          </div>
          <div class="flex gap-3">
            <button type="button" onclick="closeModal('clinic-name-modal')"
              class="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50">취소</button>
            <button type="submit"
              class="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600">저장</button>
          </div>
        </form>
      </div>
    </div>
  </div>
  
  <!-- 임시 영상 전송 모달 -->
  <div id="temp-video-modal" class="fixed inset-0 z-50 hidden">
    <div class="absolute inset-0 bg-black/50" onclick="closeModal('temp-video-modal')"></div>
    <div class="absolute inset-4 md:inset-auto md:top-4 md:left-1/2 md:-translate-x-1/2 md:w-[600px] md:max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-xl font-bold text-gray-800 flex items-center gap-2">
              <i class="fas fa-paper-plane text-orange-500"></i>
              임시 영상 전송
            </h3>
            <p class="text-sm text-gray-500 mt-1" id="temp-video-target-name">1번 체어에 전송</p>
          </div>
          <button onclick="closeModal('temp-video-modal')" class="text-gray-400 hover:text-gray-600 p-2">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
        
        <input type="hidden" id="temp-video-playlist-id">
        <input type="hidden" id="temp-video-short-code">
        
        <!-- 영상 선택 탭 -->
        <div class="flex border-b mb-4">
          <button onclick="switchTempVideoTab('shared')" id="temp-tab-shared" 
            class="flex-1 py-2 text-sm font-medium text-indigo-600 border-b-2 border-indigo-600">
            재생목록
          </button>
          <button onclick="switchTempVideoTab('url')" id="temp-tab-url"
            class="flex-1 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
            URL 직접 입력
          </button>
        </div>
        
        <!-- 재생목록 (공용 + 내 영상) -->
        <div id="temp-video-shared-tab">
          <div class="mb-3 flex gap-2">
            <input type="text" id="temp-video-search" placeholder="영상 이름 검색"
              oninput="updateTempVideoSearch()"
              class="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm">
            <button type="button" onclick="updateTempVideoSearch()"
              class="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600">검색</button>
          </div>
          <div id="temp-video-search-results" class="border rounded-lg max-h-40 overflow-y-auto mb-3 hidden"></div>
          <div id="temp-video-shared-list" class="border rounded-lg max-h-60 overflow-y-auto mb-4">
            <!-- 공용자료 목록이 여기에 렌더링됨 -->
          </div>
        </div>
        
        <!-- URL 직접 입력 -->
        <div id="temp-video-url-tab" class="hidden">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">YouTube 또는 Vimeo URL</label>
            <input type="text" id="temp-video-url" 
              class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="https://youtube.com/watch?v=... 또는 https://vimeo.com/...">
          </div>
        </div>
        
        <!-- 자동 복귀 설정 (단순화) -->
        <div class="bg-gray-50 rounded-lg p-4 mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-3">
            복귀 설정
          </label>
          <div class="flex gap-3">
            <label class="flex-1 flex items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-white transition"
              onclick="document.getElementById('temp-return-time').value='end'">
              <input type="radio" name="return-type" value="end" class="text-indigo-600">
              <span class="text-sm font-medium">영상 끝나면 복귀</span>
            </label>
            <label class="flex-1 flex items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-white transition"
              onclick="document.getElementById('temp-return-time').value='manual'">
              <input type="radio" name="return-type" value="manual" class="text-indigo-600" checked>
              <span class="text-sm font-medium">수동 복귀 (반복)</span>
            </label>
          </div>
          <input type="hidden" id="temp-return-time" value="manual">
        </div>
        
        <!-- 현재 상태 표시 -->
        <div id="temp-video-current-status" class="hidden bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i class="fas fa-play-circle text-orange-500"></i>
              <span class="text-sm text-orange-800">현재 임시 영상 재생 중</span>
            </div>
            <button onclick="stopTempVideo()" class="text-xs bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600">
              <i class="fas fa-stop mr-1"></i>기본으로 복귀
            </button>
          </div>
        </div>
        
        <!-- 버튼 -->
        <div class="flex gap-3">
          <button onclick="closeModal('temp-video-modal')" 
            class="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50 text-gray-700">
            취소
          </button>
          <button onclick="sendTempVideo()" 
            class="flex-1 px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium">
            <i class="fas fa-paper-plane mr-2"></i>전송
          </button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- 토스트 -->
  <div id="admin-toast" style="display:none" class="fixed z-[99999]">
    <div class="bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg toast">
      <span id="admin-toast-message"></span>
    </div>
  </div>

  <script>
    const ADMIN_CODE = '${adminCode}';
    const API_BASE = '/api/' + ADMIN_CODE;
    
    // 서버에서 미리 로드한 초기 데이터
    const INITIAL_DATA = ${initialDataJson};
  </script>
  <!-- 관리자 JS: 렌더링 비차단 defer 로드 -->
  <script defer src="/static/admin.js?v=20260308z2"></script>
  <script>
    // @@ADMIN_JS_BEGIN@@
    // Sortable 인스턴스 (함수 호이스팅을 위해 최상단 선언)
    let sortableInstance = null;
    let playlistItemsSortableInstance = null;
    let noticeSortableInstance = null;
    
    let clinicName = INITIAL_DATA.clinicName || '';
    let playlists = INITIAL_DATA.playlists || [];
    let notices = INITIAL_DATA.notices || [];
    let masterItems = INITIAL_DATA.masterItems || [];
    let cachedMasterItems = masterItems || [];
    let masterItemsCache = masterItems || [];
    let currentPlaylist = null;
    const playlistCacheById = {};
    const tempVideoCacheByPlaylist = {};
    let noticeSettings = { font_size: 32, letter_spacing: 0, text_color: '#ffffff', bg_color: '#1a1a2e', bg_opacity: 100, scroll_speed: 50, position: 'bottom' };
    let playlistSearchQuery = '';
    let masterItemsSignature = '';
    let playlistEditorSignature = '';
    let masterItemsRefreshTimer = null;
    // 아임웹 iframe의 페이지 상단으로부터 top offset (헤더 높이 보정용)
    let iframePageTop = 0;
    // 스크롤 완료 후 모달 top 재조정 콜백
    let pendingModalAdjust = null;
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'iframeTop') {
        iframePageTop = e.data.top || 0;
        // scrollToTop 완료 후 열린 모달의 top을 iframePageTop 기준으로 재조정
        if (pendingModalAdjust) {
          var fn = pendingModalAdjust;
          pendingModalAdjust = null;
          fn(iframePageTop);
        }
      }
    });

    function getMasterItemsSignature(items) {
      return (items || [])
        .map(item => String(item.id) + ':' + String(item.sort_order || 0))
        .join('|');
    }

    function getPlaylistEditorSignature(masterItems, playlist) {
      const masterSig = getMasterItemsSignature(masterItems);
      const itemSig = (playlist?.items || [])
        .map(item => String(item.id) + ':' + String(item.sort_order || 0))
        .join('|');
      const activeSig = (playlist?.activeItemIds || [])
        .map(id => String(id))
        .join('|');
      return [masterSig, itemSig, activeSig].join('||');
    }

    async function refreshPlaylistEditorData() {
      if (!currentPlaylist) return;
      const editModal = document.getElementById('edit-playlist-modal');
      if (!editModal || editModal.classList.contains('hidden')) return;

      try {
        const masterRes = await fetch(window.location.origin + '/api/master/items?ts=' + Date.now(), { cache: 'no-store' });
        if (masterRes.ok) {
          const masterData = await masterRes.json();
          cachedMasterItems = masterData.items || [];
          masterItemsCache = cachedMasterItems;
        }
      } catch (e) {}

      // playlist items(라이브러리 항목)만 갱신 - activeItemIds는 로컬 유지
      try {
        const res = await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '?ts=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.playlist) {
            const savedActiveIds = currentPlaylist.activeItemIds; // 로컬 상태 보존
            currentPlaylist = data.playlist;
            currentPlaylist.activeItemIds = savedActiveIds;       // 덮어쓰기 방지
            playlistCacheById[currentPlaylist.id] = currentPlaylist;
          }
        }
      } catch (e) {}

      // 라이브러리 패널만 갱신
      if (typeof renderLibraryOnly === 'function') renderLibraryOnly();
    }

    function startMasterItemsAutoRefresh() {
      if (masterItemsRefreshTimer) clearInterval(masterItemsRefreshTimer);
      // 30초마다 라이브러리만 조용히 갱신
      masterItemsRefreshTimer = setInterval(refreshPlaylistEditorData, 30000);
    }
    
    function normalizePlaylistSearchValue(value) {
      return (value || '')
        .toString()
        .normalize('NFKC')
        .toLowerCase()
        .replace(/\\s/g, '')
        .replace(/[._-]/g, '');
    }

    function getPlaylistSearchText(item) {
      return [item.title, item.name, item.display_title, item.original_title, item.url]
        .filter(Boolean)
        .join(' ');
    }

    function updatePlaylistSearch() {
      const input = document.getElementById('playlist-search');
      playlistSearchQuery = (input?.value || '').trim();
      renderPlaylistSearchResults();
    }

    function updateLibrarySearch() {
      const input = document.getElementById('library-search');
      playlistSearchQuery = (input?.value || '').trim();
      renderLibrarySearchResults();
    }

    function renderLibrarySearchResults() {
      const resultsContainer = document.getElementById('library-search-results');
      const messageEl = document.getElementById('library-search-message');
      if (!resultsContainer) return;

      const query = (playlistSearchQuery || '').trim();
      const normalizedQuery = normalizePlaylistSearchValue(query);
      if (!normalizedQuery) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('hidden');
        if (messageEl) messageEl.classList.add('hidden');
        return;
      }

      const items = currentPlaylist?.items || [];
      const masterItemsList = masterItemsCache || [];
      const allItems = [
        ...masterItemsList.map(item => ({ ...item, is_master: true })),
        ...items.map(item => ({ ...item, is_master: false }))
      ];

      const matches = allItems.filter(item => {
        const text = getPlaylistSearchText(item);
        const normalizedText = normalizePlaylistSearchValue(text);
        return normalizedText.includes(normalizedQuery);
      });

      if (matches.length === 0) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('hidden');
        if (messageEl) messageEl.classList.remove('hidden');
        return;
      }

      if (messageEl) messageEl.classList.add('hidden');
      resultsContainer.innerHTML = matches.map(item => {
        const itemId = String(item.id);
        const itemType = item.item_type || item.type || '';
        const thumb = item.thumbnail_url
          ? '<img src="' + item.thumbnail_url + '" class="w-full h-full object-cover">'
          : itemType === 'image'
            ? '<img src="' + item.url + '" class="w-full h-full object-cover">'
            : '<div class="w-full h-full flex items-center justify-center"><i class="fab fa-' + itemType + ' text-gray-400"></i></div>';
        const badge = item.is_master
          ? '<span class="text-xs bg-purple-100 text-purple-600 px-1 rounded">공용</span>'
          : '<span class="text-xs bg-blue-100 text-blue-600 px-1 rounded">내 영상</span>';

        return ''
          + '<button type="button" class="w-full flex items-center gap-2 p-2 hover:bg-gray-50 text-left" data-library-search-item="1" data-item-id="' + itemId + '" data-item-master="' + (item.is_master ? 1 : 0) + '" onclick="handleLibrarySearchSelect(this.dataset.itemId, this.dataset.itemMaster)">'
          + '<div class="w-12 h-8 bg-gray-100 rounded overflow-hidden flex-shrink-0">' + thumb + '</div>'
          + '<div class="flex-1 min-w-0">'
          + '<p class="text-sm truncate">' + (item.title || item.url) + '</p>'
          + '<p class="text-xs text-gray-400">' + itemType + ' ' + badge + '</p>'
          + '</div>'
          + '</button>';
      }).join('');
      resultsContainer.classList.remove('hidden');
      const buttons = resultsContainer.querySelectorAll('[data-library-search-item="1"]');
      buttons.forEach((btn) => {
        const itemId = btn.getAttribute('data-item-id');
        const isMaster = btn.getAttribute('data-item-master') === '1';
        btn.addEventListener('click', () => handleLibrarySearchSelect(itemId, isMaster));
      });
    }

    function focusLibraryItem(itemId, isMaster) {
      const container = document.getElementById('library-user-list')?.parentElement;
      if (!container) return;
      const selector = '[data-library-id="' + itemId + '"][data-library-master="' + isMaster + '"]';
      const itemEl = container.querySelector(selector);
      if (!itemEl) return;
      itemEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      itemEl.classList.add('library-item-highlight');
      setTimeout(() => {
        itemEl.classList.remove('library-item-highlight');
      }, 1500);
    }

    function handleLibrarySearchSelect(itemId, isMaster) {
      addToPlaylistFromLibrary(itemId);
      const input = document.getElementById('library-search');
      if (input) input.value = '';
      playlistSearchQuery = '';
      const messageEl = document.getElementById('library-search-message');
      if (messageEl) messageEl.classList.add('hidden');
      const resultsContainer = document.getElementById('library-search-results');
      if (resultsContainer) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('hidden');
      }
      renderLibrarySearchResults();
    }

    function renderPlaylistSearchResults() {
      const resultsContainer = document.getElementById('playlist-search-results');
      if (!resultsContainer) return;

      const query = playlistSearchQuery;
      if (!query) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('hidden');
        return;
      }

      const normalizedQuery = normalizePlaylistSearchValue(query);
      const filteredItems = playlistSearchItems.filter(item => {
        const searchText = getPlaylistSearchText(item);
        return searchText.includes(query) || normalizePlaylistSearchValue(searchText).includes(normalizedQuery);
      });

      if (filteredItems.length === 0) {
        resultsContainer.innerHTML = '<div class="text-center py-3 text-gray-400 text-sm">검색 결과가 없습니다</div>';
        resultsContainer.classList.remove('hidden');
        return;
      }

      resultsContainer.innerHTML = filteredItems.map(item => {
        const itemId = String(item.id);
        const itemType = item.item_type || item.type || '';
        const thumb = item.thumbnail_url
          ? '<img src="' + item.thumbnail_url + '" class="w-full h-full object-cover">'
          : itemType === 'image'
            ? '<img src="' + item.url + '" class="w-full h-full object-cover">'
            : '<div class="w-full h-full flex items-center justify-center"><i class="fab fa-' + itemType + ' text-gray-400"></i></div>';
        const badge = item.is_master
          ? '<span class="text-xs bg-purple-100 text-purple-600 px-1 rounded">공용</span>'
          : '<span class="text-xs bg-blue-100 text-blue-600 px-1 rounded">내 영상</span>';

        return ''
          + '<button type="button" class="w-full flex items-center gap-2 p-2 hover:bg-gray-50 text-left" onclick="focusPlaylistItem(&quot;' + itemId + '&quot;, ' + (item.is_master ? 1 : 0) + ')">'
          + '<div class="w-12 h-8 bg-gray-100 rounded overflow-hidden flex-shrink-0">' + thumb + '</div>'
          + '<div class="flex-1 min-w-0">'
          + '<p class="text-sm truncate">' + (item.title || item.url) + '</p>'
          + '<p class="text-xs text-gray-400">' + itemType + ' ' + badge + '</p>'
          + '</div>'
          + '</button>';
      }).join('');

      resultsContainer.classList.remove('hidden');
    }

    function focusPlaylistItem(itemId, isMaster) {
      const container = document.getElementById('playlist-items-container');
      if (!container) return;

      const selector = '[data-id="' + itemId + '"][data-master="' + isMaster + '"]';
      const itemEl = container.querySelector(selector);
      if (!itemEl) return;

      itemEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      itemEl.classList.add('playlist-item-highlight');
      setTimeout(() => {
        itemEl.classList.remove('playlist-item-highlight');
      }, 1500);
    }
    
    // 관리 탭 상태
    let _adminLoaded = false;
    let _adminSubTab = 'clinics';
    let _allClinics = INITIAL_DATA.allClinics || [];
    let _adminSearchQuery = '';

    // ============================================
    // localStorage 캐시 유틸
    // ============================================
    const CACHE_KEY = 'dental_tv_cache_' + ADMIN_CODE;
    const CACHE_EXPIRY = 60 * 1000; // 1분
    
    function saveToCache(data) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          ts: Date.now(),
          playlists: data.playlists || [],
          notices: data.notices || [],
          clinicName: data.clinicName || ''
        }));
      } catch(e) {}
    }
    
    function loadFromCache() {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (Date.now() - data.ts > CACHE_EXPIRY) return null;
        return data;
      } catch(e) { return null; }
    }

    function init() {
      const t0 = performance.now();
      // 초기 데이터로 즉시 렌더링 (API 호출 없이)
      const loadingDiv = document.getElementById('loading');
      if (loadingDiv) loadingDiv.style.display = 'none';

      if (INITIAL_DATA.isOwnerAdmin) {
        document.getElementById('clinic-name-text').textContent = '관리자';
        document.getElementById('clinic-name-text').classList.remove('cursor-pointer');
        document.getElementById('clinic-name-text').onclick = null;
      } else {
        document.getElementById('clinic-name-text').innerHTML = clinicName + ' <i class="fas fa-pencil-alt ml-2 text-sm text-blue-200"></i>';
      }
      
      // 최고관리자 탭 표시
      if (INITIAL_DATA.isSuperAdmin) {
        const adminTab = document.getElementById('tab-admin');
        if (adminTab) adminTab.style.display = '';
      }
      
      // 이미 로드된 데이터로 즉시 렌더링
      renderPlaylists();
      renderNotices();
      checkMasterLoginStatus();
      
      // 캐시에 현재 데이터 저장
      saveToCache({ playlists, notices, clinicName });
      
      // 설정은 백그라운드에서 로드 (UI 업데이트용)
      loadNoticeSettings();
      setupAutoHeight();
      
      console.log('[DentalTV] init done in', Math.round(performance.now() - t0), 'ms');
      
      // 5초마다 플레이리스트 자동 갱신 (사용중 상태 실시간 반영)
      // 편집 모달이 열려있을 때는 갱신 skip (덮어쓰기 방지)
      setInterval(async () => {
        const editModal = document.getElementById('edit-playlist-modal');
        if (editModal && editModal.style.display !== 'none') return;
        await loadPlaylists();
        saveToCache({ playlists, notices, clinicName });
      }, 5000);
    }

    // DOMContentLoaded 또는 즉시 실행 (이미 fired된 경우 대비)
    function runInit() {
      try {
        init();
      } catch (e) {
        console.error('Admin init error:', e);
        const loadingEl = document.getElementById('loading');
        const dashboardEl = document.getElementById('dashboard');
        if (loadingEl) loadingEl.style.display = 'none';
        // dashboard는 이미 표시 상태
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runInit);
    } else {
      runInit();
    }
    
    // 공용자료 로드 (관리자 페이지용)
    async function loadMasterItemsForAdmin() {
      try {
        const res = await fetch('/api/master/items');
        const data = await res.json();
        masterItems = data.items || [];
      } catch (e) {
        console.error('Load master items error:', e);
        masterItems = [];
      }
    }
    
    async function loadNoticeSettings() {
      try {
        const res = await fetch(API_BASE + '/settings');
        const data = await res.json();
        noticeSettings = {
          font_size: data.notice_font_size || 32,
          letter_spacing: data.notice_letter_spacing ?? 0,
          text_color: data.notice_text_color || '#ffffff',
          bg_color: data.notice_bg_color || '#1a1a2e',
          bg_opacity: data.notice_bg_opacity ?? 100,
          scroll_speed: data.notice_scroll_speed || 50,
          enabled: data.notice_enabled ?? 0,
          position: data.notice_position || 'bottom'
        };
        // UI 업데이트
        document.getElementById('global-notice-font-size').value = noticeSettings.font_size;
        document.getElementById('global-notice-letter-spacing').value = noticeSettings.letter_spacing;
        document.getElementById('global-notice-scroll-speed').value = noticeSettings.scroll_speed;
        document.getElementById('global-notice-text-color').value = noticeSettings.text_color;
        document.getElementById('global-notice-bg-color').value = noticeSettings.bg_color;
        document.getElementById('global-notice-bg-opacity').value = noticeSettings.bg_opacity;
        
        // 공지 위치 설정
        const positionEl = document.getElementById('global-notice-position');
        if (positionEl) {
          positionEl.value = noticeSettings.position;
          updateNoticePositionButtons(noticeSettings.position);
        }
        
        // 공지 전체 ON/OFF 상태
        const enabledCheckbox = document.getElementById('notice-global-enabled') || document.getElementById('global-notice-enabled');
        const styleSettings = document.getElementById('notice-style-settings');
        if (enabledCheckbox) {
          enabledCheckbox.checked = noticeSettings.enabled === 1;
          if (styleSettings && !enabledCheckbox.checked) {
            styleSettings.classList.add('opacity-50', 'pointer-events-none');
          }
        }
        
        updateNoticePreview();
        updateScrollSpeedLabel();
        updateNoticeOpacityLabel();
      } catch (e) {
        console.error('Load notice settings error:', e);
      }
    }
    
    function updateNoticePreview() {
      const fontSize = parseInt(document.getElementById('global-notice-font-size').value);
      const letterSpacing = parseFloat(document.getElementById('global-notice-letter-spacing').value || '0');
      const textColor = document.getElementById('global-notice-text-color').value;
      const bgColor = document.getElementById('global-notice-bg-color').value;
      const bgOpacity = parseInt(document.getElementById('global-notice-bg-opacity').value) / 100;
      
      const previewBar = document.getElementById('notice-preview-bar');
      const previewText = document.getElementById('notice-preview-text');
      if (!previewBar || !previewText) return;
      
      // hex를 rgba로 변환
      const r = parseInt(bgColor.slice(1,3), 16);
      const g = parseInt(bgColor.slice(3,5), 16);
      const b = parseInt(bgColor.slice(5,7), 16);
      previewBar.style.backgroundColor = 'rgba(' + r + ',' + g + ',' + b + ',' + bgOpacity + ')';
      previewText.style.color = textColor;
      // 미리보기는 최대 24px로 제한 (실제 TV에서는 설정된 크기로 표시)
      previewText.style.fontSize = Math.min(fontSize, 24) + 'px';
      previewText.style.letterSpacing = letterSpacing + 'px';
      previewText.style.fontWeight = 'bold';
      previewText.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
      previewText.textContent = '공지 미리보기 (' + fontSize + 'px)';
      
      // 미리보기 바의 패딩 - 컴팩트하게
      previewBar.style.padding = '8px 15px';
    }

    let noticeSaveTimer = null;
    function scheduleSaveNoticeSettings() {
      if (noticeSaveTimer) clearTimeout(noticeSaveTimer);
      noticeSaveTimer = setTimeout(() => {
        saveGlobalNoticeSettings();
      }, 400);
    }
    
    function updateScrollSpeedLabel() {
      const speed = parseInt(document.getElementById('global-notice-scroll-speed').value);
      const label = document.getElementById('scroll-speed-label');
      if (label) {
        if (speed <= 30) label.textContent = '느림 (' + speed + ')';
        else if (speed <= 70) label.textContent = '보통 (' + speed + ')';
        else if (speed <= 120) label.textContent = '빠름 (' + speed + ')';
        else label.textContent = '매우 빠름 (' + speed + ')';
      }
      updateNoticePreview();
    }
    
    async function toggleGlobalNotice() {
      const enabledCheckbox = document.getElementById('notice-global-enabled') || document.getElementById('global-notice-enabled');
      if (!enabledCheckbox) return;
      const enabled = enabledCheckbox.checked;
      const styleSettings = document.getElementById('notice-style-settings');
      
      // UI 토글
      if (enabled) {
        styleSettings.classList.remove('opacity-50', 'pointer-events-none');
      } else {
        styleSettings.classList.add('opacity-50', 'pointer-events-none');
      }
      
      // 서버에 저장
      try {
        await fetch(API_BASE + '/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notice_enabled: enabled ? 1 : 0 })
        });
        showToast(enabled ? '공지가 활성화되었습니다.' : '공지가 비활성화되었습니다.');
      } catch (e) {
        showToast('저장 실패', 'error');
      }
    }
    
    function updateNoticeOpacityLabel() {
      const opacity = document.getElementById('global-notice-bg-opacity').value;
      const label = document.getElementById('notice-opacity-label');
      if (label) label.textContent = opacity + '%';
      updateNoticePreview();
    }
    
    async function saveGlobalNoticeSettings() {
      const positionEl = document.getElementById('global-notice-position');
      const settings = {
        notice_font_size: parseInt(document.getElementById('global-notice-font-size').value),
        notice_letter_spacing: parseFloat(document.getElementById('global-notice-letter-spacing').value || '0'),
        notice_scroll_speed: parseInt(document.getElementById('global-notice-scroll-speed').value),
        notice_text_color: document.getElementById('global-notice-text-color').value,
        notice_bg_color: document.getElementById('global-notice-bg-color').value,
        notice_bg_opacity: parseInt(document.getElementById('global-notice-bg-opacity').value),
        notice_position: positionEl ? positionEl.value : 'bottom'
      };
      
      updateNoticePreview();
      
      try {
        await fetch(API_BASE + '/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
        showToast('공지 스타일이 저장되었습니다. TV에 곧 반영됩니다.');
      } catch (e) {
        showToast('저장 실패', 'error');
      }
    }
    
    // 공지 위치 설정
    function setNoticePosition(position) {
      document.getElementById('global-notice-position').value = position;
      updateNoticePositionButtons(position);
      saveGlobalNoticeSettings();
    }
    
    function updateNoticePositionButtons(position) {
      const topBtn = document.getElementById('position-top-btn');
      const bottomBtn = document.getElementById('position-bottom-btn');
      if (!topBtn || !bottomBtn) return;
      
      if (position === 'top') {
        topBtn.className = 'flex-1 px-3 py-2 border rounded-lg text-sm font-medium transition-colors bg-indigo-500 text-white';
        bottomBtn.className = 'flex-1 px-3 py-2 border rounded-lg text-sm font-medium transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200';
      } else {
        topBtn.className = 'flex-1 px-3 py-2 border rounded-lg text-sm font-medium transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200';
        bottomBtn.className = 'flex-1 px-3 py-2 border rounded-lg text-sm font-medium transition-colors bg-indigo-500 text-white';
      }
    }
    
    function showTab(tab) {
      ['playlists', 'notices', 'settings', 'admin', 'master'].forEach(t => {
        const content = document.getElementById('content-' + t);
        const tabBtn = document.getElementById('tab-' + t);
        if (content) content.classList.toggle('hidden', t !== tab);
        if (tabBtn) {
          if (t === 'master' || t === 'admin') {
            tabBtn.classList.toggle('border-purple-500', t === tab);
            tabBtn.classList.toggle('text-purple-600', t === tab);
          } else {
            tabBtn.classList.toggle('border-blue-500', t === tab);
            tabBtn.classList.toggle('text-blue-500', t === tab);
          }
          tabBtn.classList.toggle('border-transparent', t !== tab);
          tabBtn.classList.toggle('text-gray-500', t !== tab);
        }
      });
      if (tab === 'admin' && !_adminLoaded) { _adminLoaded = true; renderAdminClinics(); }
      if (tab === 'settings') initSettingsTab();
      if (typeof postParentHeight === 'function') setTimeout(postParentHeight, 100);
    }
    
    // ============================================
    // 마스터 관리자 기능 (아임웹 관리자 전용)
    // ============================================
    let isMasterLoggedIn = sessionStorage.getItem('masterLoggedIn') === 'true';
    const MASTER_API = '/api/master';
    
    // 페이지 로드 시 로그인 상태 확인
    function checkMasterLoginStatus() {
      const loginSection = document.getElementById('master-login-section');
      const contentSection = document.getElementById('master-content-section');
      if (!loginSection || !contentSection) return;
      
      if (isMasterLoggedIn) {
        loginSection.classList.add('hidden');
        contentSection.classList.remove('hidden');
        loadMasterData();
      }
    }
    
    async function masterLogin() {
      const password = document.getElementById('master-password-input').value;
      try {
        const res = await fetch(MASTER_API + '/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        
        if (res.ok) {
          isMasterLoggedIn = true;
          sessionStorage.setItem('masterLoggedIn', 'true');
          document.getElementById('master-login-section').classList.add('hidden');
          document.getElementById('master-content-section').classList.remove('hidden');
          document.getElementById('master-login-error').classList.add('hidden');
          loadMasterData();
        } else {
          document.getElementById('master-login-error').classList.remove('hidden');
        }
      } catch (e) {
        console.error(e);
        document.getElementById('master-login-error').classList.remove('hidden');
      }
    }
    
    function masterLogout() {
      isMasterLoggedIn = false;
      sessionStorage.removeItem('masterLoggedIn');
      document.getElementById('master-login-section').classList.remove('hidden');
      document.getElementById('master-content-section').classList.add('hidden');
      document.getElementById('master-password-input').value = '';
    }
    
    async function loadMasterData() {
      try {
        const infoRes = await fetch(MASTER_API + '/info');
        const infoData = await infoRes.json();
        
        if (!infoData.masterPlaylist) {
          await fetch(MASTER_API + '/playlist', { method: 'POST' });
        }
        
        await loadMasterItems();
      } catch (e) {
        console.error(e);
      }
    }
    
    async function loadMasterItems() {
      try {
        const res = await fetch(MASTER_API + '/items');
        const data = await res.json();
        const items = data.items || [];
        
        const countEl = document.getElementById('master-item-count');
        if (countEl) countEl.textContent = items.length + '개';
        
        const container = document.getElementById('master-items-container');
        if (!container) return;
        
        if (items.length === 0) {
          container.innerHTML = '<p class="text-gray-400 text-center py-8">동영상을 추가해주세요</p>';
          return;
        }
        
        container.innerHTML = items.map((item, idx) => \`
          <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <span class="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold text-sm">\${idx + 1}</span>
            <div class="w-24 h-16 bg-gray-200 rounded overflow-hidden flex-shrink-0 master-thumb-loading" data-item-id="\${item.id}" data-type="\${item.item_type}" data-url="\${item.url}">
              \${item.thumbnail_url ? \`<img src="\${item.thumbnail_url}" class="w-full h-full object-cover">\` : 
                \`<div class="w-full h-full flex items-center justify-center text-gray-400"><i class="fas fa-spinner fa-spin"></i></div>\`}
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-gray-800 truncate" id="master-title-\${item.id}">\${item.title || item.url}</p>
              <p class="text-xs text-gray-500">\${item.item_type.toUpperCase()}</p>
            </div>
            <button onclick="masterDeleteItem(\${item.id})" class="text-red-500 hover:text-red-600 p-2">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        \`).join('');
        
        loadMasterThumbnails();
      } catch (e) {
        console.error(e);
      }
    }
    
    async function loadMasterThumbnails() {
      const thumbs = document.querySelectorAll('.master-thumb-loading');
      for (const el of thumbs) {
        if (el.querySelector('img')) continue;
        const type = el.dataset.type;
        const url = el.dataset.url;
        
        if (type === 'vimeo') {
          const match = url.match(/vimeo\\.com\\/(\\d+)/);
          if (match) {
            try {
              const res = await fetch('/api/vimeo-thumbnail/' + match[1]);
              const data = await res.json();
              if (data.success && data.thumbnail) {
                el.innerHTML = '<img src="' + data.thumbnail + '" class="w-full h-full object-cover">';
              } else {
                el.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-blue-100"><i class="fab fa-vimeo text-blue-400 text-xl"></i></div>';
              }
            } catch (e) {
              el.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-blue-100"><i class="fab fa-vimeo text-blue-400 text-xl"></i></div>';
            }
          }
        } else if (type === 'youtube') {
          const match = url.match(/(?:youtube\\.com\\/watch\\?v=|youtu\\.be\\/)([\\w-]+)/);
          if (match) {
            el.innerHTML = '<img src="https://img.youtube.com/vi/' + match[1] + '/mqdefault.jpg" class="w-full h-full object-cover">';
          }
        }
      }
    }
    
    async function masterAddItem() {
      const input = document.getElementById('master-new-url');
      const url = input.value.trim();
      if (!url) {
        showToast('URL을 입력해주세요.', 'error');
        return;
      }
      if (!url.includes('vimeo.com')) {
        showToast('Vimeo URL만 지원됩니다.', 'error');
        return;
      }
      
      try {
        const res = await fetch(MASTER_API + '/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        
        if (res.ok) {
          input.value = '';
          showToast('추가되었습니다.');
          loadMasterItems();
        } else {
          const data = await res.json();
          showToast(data.error || '추가 실패', 'error');
        }
      } catch (e) {
        console.error(e);
        showToast('추가 실패', 'error');
      }
    }
    
    async function masterDeleteItem(itemId) {
      if (!confirm('이 동영상을 삭제하시겠습니까?\\n삭제하면 모든 치과에서 즉시 제거됩니다.')) return;
      
      try {
        await fetch(MASTER_API + '/items/' + itemId, { method: 'DELETE' });
        showToast('삭제되었습니다.');
        loadMasterItems();
      } catch (e) {
        console.error(e);
        showToast('삭제 실패', 'error');
      }
    }
    
    async function loadPlaylists() {
      try {
        const res = await fetch(API_BASE + '/playlists');
        const data = await res.json();
        playlists = data.playlists || [];
        clinicName = data.clinic_name || '내 치과';
        document.getElementById('clinic-name-text').innerHTML = clinicName + ' <i class="fas fa-pencil-alt ml-2 text-sm text-blue-200"></i>';
        renderPlaylists();
      } catch (e) {
        console.error('Load playlists error:', e);
      }
    }
    
    function renderPlaylists() {
      const container = document.getElementById('playlists-container');
      
      // 초기 설정 섹션 열림 상태 미리 저장 (innerHTML 교체 전)
      const exportSectionBefore = document.getElementById('export-section-content');
      const wasExportOpen = exportSectionBefore && exportSectionBefore.style.display === 'block';
      
      // 체크박스 선택 상태 미리 저장 (innerHTML 교체 후 복원용)
      const checkedIds = new Set(
        Array.from(document.querySelectorAll('.chair-checkbox:checked'))
          .map(cb => cb.dataset.id)
      );
      
      if (playlists.length === 0) {
        container.innerHTML = \`
          <div class="bg-white rounded-xl shadow-sm p-8 text-center">
            <i class="fas fa-folder-open text-4xl text-gray-300 mb-4"></i>
            <p class="text-gray-500 mb-4">등록된 대기실/체어가 없습니다.</p>
            <button onclick="showCreatePlaylistModal()" class="text-blue-500 hover:text-blue-600">
              <i class="fas fa-plus mr-2"></i>대기실/체어 추가
            </button>
          </div>
        \`;
        return;
      }
      
      // =========================================================
      // 체어와 대기실 분리
      // - 체어: 이름에 '체어'가 포함된 항목 (스크립트 다운로드 방식)
      // - 대기실: 이름에 '체어'가 없는 항목 (단축 URL + USB 북마크 방식)
      // =========================================================
      const chairs = playlists
        .filter(p => p.name.includes('체어'))
        .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
      const waitingRooms = playlists
        .filter(p => !p.name.includes('체어'))
        .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
      
      // 대기실/체어 분리하여 표시
      container.innerHTML = \`
        <!-- =========================================================
             대기실 목록
             ========================================================= -->
        \${waitingRooms.length > 0 ? \`
        <div class="mb-6">
          <h3 class="text-sm font-bold text-teal-600 mb-3 flex items-center">
            <i class="fas fa-couch mr-2"></i>대기실 (\${waitingRooms.length}개)
            <span class="ml-2 text-xs text-gray-400 font-normal">드래그하여 순서 변경</span>
          </h3>
          <div id="waitingroom-sortable-container" class="grid gap-3">
            \${waitingRooms.map((p, idx) => {
              const isActive = p.is_tv_active === true;
              return \`
            <div class="bg-white rounded-xl shadow-sm overflow-hidden playlist-sortable-item cursor-move border-l-4 \${isActive ? 'border-green-500' : 'border-teal-400'}" 
                 id="playlist-card-main-\${p.id}" data-playlist-id="\${p.id}" draggable="true">
              <div class="p-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 flex items-center justify-center text-gray-300 cursor-grab drag-handle">
                    <i class="fas fa-grip-vertical"></i>
                  </div>
                  <div class="w-10 h-10 \${isActive ? 'bg-green-100' : 'bg-teal-100'} rounded-lg flex items-center justify-center relative">
                    <i class="fas fa-couch \${isActive ? 'text-green-500' : 'text-teal-500'}"></i>
                    \${isActive ? '<span class="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" title="TV 사용중"></span>' : ''}
                  </div>
                  <div>
                    <h3 class="font-bold text-gray-800">
                      \${p.name}
                      \${isActive ? '<span class="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">사용중</span>' : ''}
                      \${!p.external_short_url ? '<span id="badge-setup-' + p.id + '" class="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">TV 설정 필요</span>' : ''}
                    </h3>
                    <p class="text-xs text-gray-500">
                      <span class="text-teal-600 font-mono">\${p.external_short_url ? p.external_short_url.replace('https://', '') : location.host + '/' + p.short_code}</span>
                      <span class="mx-2">•</span>
                      \${p.item_count || 0}개 미디어
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  <button onclick="openPlaylistEditor(\${p.id})" 
                    class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-xs">
                    플레이리스트
                  </button>
                  <button onclick="openTVMirror('\${p.short_code}', \${p.item_count || 0})" 
                    class="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-600 rounded text-xs">
                    TV로 내보내기
                  </button>
                  <button onclick="copyToClipboard('\${p.external_short_url || location.origin + '/' + p.short_code}')" 
                    class="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded text-xs">
                    URL 복사
                  </button>
                  <button onclick="deletePlaylist(\${p.id})" 
                    class="p-2 text-red-400 hover:text-red-600" title="삭제">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            </div>
            \`}).join('')}
          </div>
        </div>
        \` : ''}
        
        <!-- =========================================================
             체어 목록
             ========================================================= -->
        \${chairs.length > 0 ? \`
        <div class="mb-4">
          <h3 class="text-sm font-bold text-indigo-600 mb-3 flex items-center">
            <i class="fas fa-tv mr-2"></i>체어 (\${chairs.length}개)
            <span class="ml-2 text-xs text-gray-400 font-normal">드래그하여 순서 변경</span>
          </h3>
          <div id="chair-sortable-container" class="grid gap-3">
            \${chairs.map((p, idx) => {
              const isActive = p.is_tv_active === true;
              return \`
            <div class="bg-white rounded-xl shadow-sm overflow-hidden playlist-sortable-item cursor-move border-l-4 \${isActive ? 'border-green-500' : 'border-indigo-400'}" 
                 id="playlist-card-main-\${p.id}" data-playlist-id="\${p.id}" draggable="true">
              <div class="p-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 flex items-center justify-center text-gray-300 cursor-grab drag-handle">
                    <i class="fas fa-grip-vertical"></i>
                  </div>
                  <div class="w-10 h-10 \${isActive ? 'bg-green-100' : 'bg-indigo-100'} rounded-lg flex items-center justify-center relative">
                    <i class="fas fa-tv \${isActive ? 'text-green-500' : 'text-indigo-500'}"></i>
                    \${isActive ? '<span class="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" title="TV 사용중"></span>' : ''}
                    <span id="temp-indicator-\${p.id}" class="hidden absolute -top-1 -left-1 w-3 h-3 bg-orange-500 rounded-full animate-pulse" title="임시 영상 재생 중"></span>
                  </div>
                  <div>
                    <h3 class="font-bold text-gray-800">
                      \${p.name}
                      \${isActive ? '<span class="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">사용중</span>' : ''}
                      \${!p.last_active_at ? '<span class="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">체어 설치 필요</span>' : ''}
                    </h3>
                    <p class="text-xs text-gray-500">
                      <span class="text-indigo-600 font-mono">\${p.external_short_url ? p.external_short_url.replace('https://', '') : location.host + '/' + p.short_code}</span>
                      <span class="mx-2">•</span>
                      \${p.item_count || 0}개 미디어
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  <button onclick="openPlaylistEditor(\${p.id})" 
                    class="px-3 py-1.5 w-[110px] bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-xs text-center">
                    플레이리스트
                  </button>
                  <button onclick="openTVMirror('\${p.short_code}', \${p.item_count || 0})" 
                    class="px-3 py-1.5 w-[110px] bg-green-50 hover:bg-green-100 text-green-600 rounded text-xs text-center">
                    TV로 내보내기
                  </button>
                  <button onclick="showTempVideoModal(\${p.id}, '\${p.name}', '\${p.short_code}')" 
                    class="px-3 py-1.5 w-[110px] bg-orange-50 hover:bg-orange-100 text-orange-600 rounded text-xs text-center">
                    임시 영상 전송
                  </button>
                  <button id="stop-temp-btn-\${p.id}" onclick="stopTempVideoForPlaylist(\${p.id})" 
                    class="px-3 py-1.5 w-[110px] bg-gray-50 text-gray-600 border border-gray-200 rounded text-xs font-medium text-center cursor-not-allowed inline-flex items-center justify-center gap-1 opacity-100 visible whitespace-nowrap" aria-disabled="true">
                    <i class="fas fa-stop"></i>
                    <span>기본으로 복귀</span>
                  </button>
                  <button onclick="copyToClipboard('\${p.external_short_url || location.origin + '/' + p.short_code}')" 
                    class="px-3 py-1.5 w-[110px] bg-gray-50 hover:bg-gray-100 text-gray-600 rounded text-xs text-center">
                    URL 복사
                  </button>
                  <button onclick="deletePlaylist(\${p.id})" 
                    class="p-2 text-red-400 hover:text-red-600" title="삭제">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            </div>
            \`}).join('')}
          </div>
        </div>
        \` : ''}
        
        <!-- =========================================================
             초기 설정 섹션 (접기/펼치기)
             ========================================================= -->
        <div class="border border-gray-300 rounded-xl overflow-hidden bg-gray-50">
          <button onclick="toggleExportSection()" class="w-full p-4 bg-gray-100 flex items-center justify-between hover:bg-gray-200 transition">
            <span class="font-bold text-gray-700 flex items-center gap-2">
              <i class="fas fa-cog"></i>초기 설정 (TV 연결)
            </span>
            <i id="export-toggle-icon" class="fas fa-chevron-down text-gray-400"></i>
          </button>
          <div id="export-section-content" style="display:none" class="bg-gray-50 p-4">
            
            <!-- 체어 설정 -->
            <div class="mb-4">
              <div class="flex items-center gap-2 mb-3 pb-2 border-b-2 border-indigo-400">
                <i class="fas fa-tv text-indigo-500"></i>
                <span class="font-bold text-gray-800">체어 설정</span>
                <span class="text-xs text-gray-500">(PC 모니터 자동 실행)</span>
              </div>
              
              \${chairs.length > 0 ? \`
              <div class="bg-white rounded-lg p-4 border border-gray-200">
                <div class="flex flex-wrap gap-2 mb-3">
                  \${chairs.map(p => \`
                    <label class="flex items-center gap-2 bg-gray-100 hover:bg-indigo-50 px-3 py-2 rounded-lg cursor-pointer transition border border-gray-200">
                      <input type="checkbox" class="chair-checkbox rounded text-indigo-500" data-id="\${p.id}" data-code="\${p.short_code}" data-name="\${p.name}">
                      <span class="text-sm text-gray-700">\${p.name}</span>
                      <span class="text-xs text-gray-400">(\${p.item_count || 0})</span>
                      \${!p.last_active_at ? '<span class="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded">미설치</span>' : '<span class="px-1.5 py-0.5 bg-green-100 text-green-600 text-xs rounded">연결됨</span>'}
                    </label>
                  \`).join('')}
                </div>
                <div class="flex flex-wrap gap-2">
                  <button onclick="exportSelectedScripts()" class="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500 text-sm">
                    스크립트 다운로드
                  </button>
                  <button onclick="downloadAutoRunScript(this)" class="bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 text-sm">
                    설치 방법
                  </button>
                </div>
              </div>
              \` : \`
              <div class="bg-white rounded-lg p-4 border border-gray-200 text-center text-gray-500">
                <i class="fas fa-info-circle mr-1"></i>
                등록된 체어가 없습니다. 위에서 체어를 추가하세요.
              </div>
              \`}
            </div>
            
            <!-- 대기실 설정 -->
            <div>
              <div class="flex items-center gap-2 mb-3 pb-2 border-b-2 border-teal-400">
                <i class="fas fa-couch text-teal-500"></i>
                <span class="font-bold text-gray-800">대기실 설정</span>
                <span class="text-xs text-gray-500">(스마트 TV 연결)</span>
              </div>
              
              \${waitingRooms.length > 0 ? \`
              <div class="space-y-3">
                \${waitingRooms.map(p => \`
                <div class="bg-white rounded-lg p-4 border border-gray-200">
                  <div class="flex items-center gap-2 mb-3">
                    <span class="font-medium text-gray-800">\${p.name}</span>
                    <span class="text-xs text-gray-400">(\${p.item_count || 0}개 미디어)</span>
                  </div>
                  
                  <!-- URL 복사 -->
                  <div class="flex items-center gap-2 mb-3">
                    <input type="text" id="setting-url-\${p.id}" value="\${p.external_short_url ? p.external_short_url.replace('https://', '') : location.host + '/' + p.short_code}" 
                      class="flex-1 bg-gray-100 border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 font-mono" readonly>
                    <button onclick="copySettingUrl(\${p.id})" 
                      class="bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded text-sm text-gray-600">
                      복사
                    </button>
                    \${!p.external_short_url ? \`
                    <button id="btn-shorten-\${p.id}" onclick="generateShortUrl(\${p.id}, '\${p.short_code}')" 
                      class="bg-teal-500 hover:bg-teal-600 text-white px-3 py-2 rounded text-sm">
                      단축 URL 생성
                    </button>
                    \` : ''}
                  </div>
                  
                  <!-- 사용법 안내 -->
                  <div class="flex flex-wrap gap-2">
                    <button onclick="showTvExportModal(\${p.id}, '\${p.name}', '\${p.short_code}')"
                      class="bg-teal-500 hover:bg-teal-600 text-white px-3 py-1.5 rounded text-xs">
                      사용법 (URL 직접 입력)
                    </button>
                  </div>
                  <p class="mt-2 text-xs text-blue-700">
                    <i class="fas fa-info-circle mr-1"></i>
                    USB 인식 문제로 <strong>URL 직접 입력 방식</strong>만 제공합니다.
                  </p>
                </div>
                \`).join('')}
              </div>
              \` : \`
              <div class="bg-white rounded-lg p-4 border border-gray-200 text-center text-gray-500">
                <i class="fas fa-info-circle mr-1"></i>
                등록된 대기실이 없습니다. 위에서 대기실을 추가하세요.
              </div>
              \`}
            </div>
            
          </div>
        </div>
      \`;
      
      // 임시 영상 상태 확인
      checkTempVideoStatus();
      
      // 임시 영상 상태 주기적 확인 (5초마다) - 자동복귀 감지용
      if (!window.tempStatusInterval) {
        window.tempStatusInterval = setInterval(checkTempVideoStatus, 5000);
      }
      
      // 초기 설정 섹션 열림 상태 복원 (innerHTML 교체로 style이 리셋되기 때문)
      const exportSectionAfter = document.getElementById('export-section-content');
      const exportIconAfter = document.getElementById('export-toggle-icon');
      if (exportSectionAfter && wasExportOpen) {
        exportSectionAfter.style.display = 'block';
        if (exportIconAfter) {
          exportIconAfter.classList.remove('fa-chevron-down');
          exportIconAfter.classList.add('fa-chevron-up');
        }
      }
      
      // 체크박스 선택 상태 복원
      if (checkedIds.size > 0) {
        document.querySelectorAll('.chair-checkbox').forEach(cb => {
          if (checkedIds.has(cb.dataset.id)) cb.checked = true;
        });
      }
      
      // 드래그 정렬 초기화
      initPlaylistSortable();
    }
    
    // 임시 영상 상태 확인
    async function checkTempVideoStatus() {
      for (const p of playlists) {
        try {
          const res = await fetch(API_BASE + '/playlists/' + p.id + '/temp-video');
          const data = await res.json();
          const indicator = document.getElementById('temp-indicator-' + p.id);
          const stopBtn = document.getElementById('stop-temp-btn-' + p.id);
          
          if (data.active) {
            // 임시 영상 재생 중 - 인디케이터와 복귀 버튼 표시
            if (indicator) indicator.classList.remove('hidden');
            setStopButtonState(p.id, true);
          } else {
            // 임시 영상 없음 (자동복귀 포함) - 인디케이터와 복귀 버튼 숨김
            if (indicator) indicator.classList.add('hidden');
            setStopButtonState(p.id, false);
          }
        } catch (e) {}
      }
    }
    
    // TV 섹션 토글
    function toggleTvSection(id) {
      const section = document.getElementById('tv-section-' + id);
      const btn = document.getElementById('tv-toggle-btn-' + id);
      if (section.classList.contains('hidden')) {
        section.classList.remove('hidden');
        btn.innerHTML = '<i class="fas fa-chevron-up"></i>';
      } else {
        section.classList.add('hidden');
        btn.innerHTML = '<i class="fas fa-chevron-down"></i>';
      }
      if (typeof postParentHeight === 'function') {
        setTimeout(postParentHeight, 50);
        setTimeout(postParentHeight, 300);
      }
    }
    
    // 내보내기 섹션 토글
    function toggleExportSection() {
      const content = document.getElementById('export-section-content');
      const icon = document.getElementById('export-toggle-icon');
      const isHidden = content.style.display === 'none' || content.style.display === '';
      if (isHidden) {
        content.style.display = 'block';
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
        // 초기 설정 섹션으로 스크롤
        setTimeout(() => {
          const btn = content.closest('.border.border-gray-300');
          if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      } else {
        content.style.display = 'none';
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
      }
      if (typeof postParentHeight === 'function') {
        setTimeout(postParentHeight, 50);
        setTimeout(postParentHeight, 300);
      }
    }
    
    // 전체 선택 토글
    function toggleSelectAllChairs() {
      const selectAll = document.getElementById('select-all-chairs');
      const checkboxes = document.querySelectorAll('.chair-checkbox');
      checkboxes.forEach(cb => cb.checked = selectAll.checked);
    }
    
    // 선택된 체어 가져오기
    function getSelectedChairs() {
      const checkboxes = document.querySelectorAll('.chair-checkbox:checked');
      return Array.from(checkboxes).map(cb => ({
        id: cb.dataset.id,
        code: cb.dataset.code,
        name: cb.dataset.name
      }));
    }
    
    // 선택된 스크립트 다운로드 (설명 포함 + BAT/VBS 선택)
    function exportSelectedScripts() {
      const selected = getSelectedChairs();
      if (selected.length === 0) {
        showToast('체어를 선택하세요', 'error', 1200, document.querySelector('[onclick="exportSelectedScripts()"]'));
        return;
      }
      
      // 형식 선택 모달 표시 - openModal 방식으로 body에 고정
      var modal = document.getElementById('script-type-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'script-type-modal';
        document.body.appendChild(modal);
      }
      modal.innerHTML = '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.5)" onclick="closeModal(\'script-type-modal\')"></div>' +
        '<div style="position:relative;background:white;border-radius:12px;padding:24px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3)">' +
          '<h3 style="font-size:17px;font-weight:700;margin-bottom:12px"><i class="fas fa-download" style="color:#6366f1;margin-right:8px"></i>스크립트 다운로드</h3>' +
          '<p style="font-size:13px;color:#666;margin-bottom:16px">선택된 ' + selected.length + '개 체어의 스크립트를 다운로드합니다.</p>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
            '<button onclick="downloadSelectedBat(); closeModal(\'script-type-modal\')" style="background:#3b82f6;color:white;padding:12px;border-radius:8px;border:none;cursor:pointer;text-align:center">' +
              '<i class="fas fa-file-code" style="font-size:24px;display:block;margin-bottom:4px"></i>' +
              '<span style="font-weight:700;display:block">BAT 파일</span>' +
              '<span style="font-size:11px;color:#bfdbfe">일반적인 경우</span>' +
            '</button>' +
            '<button onclick="downloadSelectedVbs(); closeModal(\'script-type-modal\')" style="background:#22c55e;color:white;padding:12px;border-radius:8px;border:none;cursor:pointer;text-align:center">' +
              '<i class="fas fa-shield-alt" style="font-size:24px;display:block;margin-bottom:4px"></i>' +
              '<span style="font-weight:700;display:block">VBS 파일</span>' +
              '<span style="font-size:11px;color:#bbf7d0">백신 차단 시</span>' +
            '</button>' +
          '</div>' +
          '<button onclick="closeModal(\'script-type-modal\')" style="width:100%;margin-top:12px;color:#888;font-size:13px;background:none;border:none;cursor:pointer">취소</button>' +
        '</div>';
      // 스크립트 전용 표시 (openModal 사용 안 함)
      _showScriptModal(modal);
    }
    
    // 선택된 체어 BAT 다운로드
    function downloadSelectedBat() {
      const selected = getSelectedChairs();
      const today = new Date().toLocaleDateString('ko-KR');
      const chairNames = selected.map(p => p.name).join(', ');
      
      let batContent = '@echo off\\n';
      batContent += 'chcp 65001 > nul\\n';
      batContent += 'REM =========================================================\\n';
      batContent += 'REM 치과 TV 스크립트 (선택된 체어)\\n';
      batContent += 'REM ---------------------------------------------------------\\n';
      batContent += 'REM 생성일: ' + today + '\\n';
      batContent += 'REM 체어 수: ' + selected.length + '개\\n';
      batContent += 'REM 체어 목록: ' + chairNames + '\\n';
      batContent += 'REM ---------------------------------------------------------\\n';
      batContent += 'REM [사용 방법]\\n';
      batContent += 'REM 1. 이 파일을 더블클릭하면 선택된 체어의 크롬 창이 열립니다\\n';
      batContent += 'REM 2. 열린 창을 해당 모니터로 드래그해서 배치하세요\\n';
      batContent += 'REM 3. 화면을 클릭하면 전체화면 모드로 전환됩니다\\n';
      batContent += 'REM ---------------------------------------------------------\\n';
      batContent += 'REM [자동 실행] Win+R -> shell:startup -> 이 파일 복사\\n';
      batContent += 'REM =========================================================\\n\\n';
      batContent += 'echo =========================================================\\n';
      batContent += 'echo   치과 TV - ' + selected.length + '개 체어 실행\\n';
      batContent += 'echo =========================================================\\n\\n';
      
      selected.forEach((p, idx) => {
        const url = location.origin + '/' + p.code;
        batContent += 'REM [' + (idx + 1) + '] ' + p.name + ': ' + url + '\\n';
        batContent += 'echo [' + (idx + 1) + '/' + selected.length + '] ' + p.name + ' 실행...\\n';
        batContent += 'start "" chrome --kiosk --new-window "' + url + '"\\n';
        batContent += 'timeout /t 3 /nobreak > nul\\n\\n';
      });
      
      batContent += 'echo.\\n';
      batContent += 'echo =========================================================\\n';
      batContent += 'echo   모든 체어 화면 실행 완료!\\n';
      batContent += 'echo =========================================================\\n';
      batContent += 'timeout /t 5\\n';
      
      const blob = new Blob([batContent.replace(/\\\\n/g, '\\r\\n')], { type: 'text/plain' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = '치과TV_' + selected.length + '개체어.bat';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      
      showToast('✅ ' + selected.length + '개 체어 BAT 스크립트 다운로드 완료');
    }
    
    // 선택된 체어 VBS 다운로드
    function downloadSelectedVbs() {
      const selected = getSelectedChairs();
      const today = new Date().toLocaleDateString('ko-KR');
      const chairNames = selected.map(p => p.name).join(', ');
      
      let vbsContent = '\\'=========================================================\\n';
      vbsContent += '\\' 치과 TV 스크립트 (선택된 체어)\\n';
      vbsContent += '\\'---------------------------------------------------------\\n';
      vbsContent += '\\' 생성일: ' + today + '\\n';
      vbsContent += '\\' 체어 수: ' + selected.length + '개\\n';
      vbsContent += '\\' 체어 목록: ' + chairNames + '\\n';
      vbsContent += '\\'---------------------------------------------------------\\n';
      vbsContent += '\\' [사용 방법]\\n';
      vbsContent += '\\' 1. 이 파일을 더블클릭하면 선택된 체어의 크롬 창이 열립니다\\n';
      vbsContent += '\\' 2. 열린 창을 해당 모니터로 드래그해서 배치하세요\\n';
      vbsContent += '\\' [자동 실행] Win+R -> shell:startup -> 이 파일 복사\\n';
      vbsContent += '\\' (백신이 BAT 파일 차단 시 이 VBS 파일 사용)\\n';
      vbsContent += '\\'=========================================================\\n\\n';
      vbsContent += 'Set WshShell = CreateObject("WScript.Shell")\\n\\n';
      
      selected.forEach((p, idx) => {
        const url = location.origin + '/' + p.code;
        vbsContent += '\\' [' + (idx + 1) + '] ' + p.name + ': ' + url + '\\n';
        vbsContent += 'WshShell.Run "chrome --kiosk --new-window ""' + url + '"""\\n';
        vbsContent += 'WScript.Sleep 3000\\n\\n';
      });
      
      const blob = new Blob([vbsContent.replace(/\\\\n/g, '\\r\\n')], { type: 'text/plain' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = '치과TV_' + selected.length + '개체어.vbs';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      
      showToast('✅ ' + selected.length + '개 체어 VBS 스크립트 다운로드 완료');
    }
    
    // 선택된 TV URL 복사
    function copySelectedLinks() {
      const selected = getSelectedChairs();
      if (selected.length === 0) {
        showToast('복사할 체어를 선택하세요', 'error');
        return;
      }
      const links = selected.map(p => p.name + ' TV: ' + location.origin + '/' + p.code).join('\\n');
      navigator.clipboard.writeText(links);
      showToast('📋 ' + selected.length + '개 체어 TV URL 복사됨\\n(각 체어 PC에서 이 URL을 열어주세요)');
    }
    
    // 카카오톡으로 공유
    function shareSelectedViaKakao() {
      const selected = getSelectedChairs();
      if (selected.length === 0) {
        showToast('공유할 체어를 선택하세요', 'error');
        return;
      }
      const links = selected.map(p => p.name + ': ' + location.origin + '/' + p.code).join('\\n');
      const text = '📺 체어 TV URL\\n\\n' + links + '\\n\\n각 체어 PC에서 해당 URL을 열어주세요.';
      
      // 클립보드에 복사
      navigator.clipboard.writeText(text).then(() => {
        // 복사 성공 후 카카오톡 열기 시도 (모바일만)
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
          // 카카오톡 앱 열기 시도
          window.location.href = 'kakaotalk://';
        }
        // 복사 완료 메시지 표시
        showToast('✅ 클립보드에 복사되었습니다!\\n카카오톡에서 Ctrl+V로 붙여넣기 하세요', 'success', 4000);
      }).catch(() => {
        showToast('복사 실패', 'error');
      });
    }
    
    // 문자로 공유
    function shareSelectedViaSMS() {
      const selected = getSelectedChairs();
      if (selected.length === 0) {
        showToast('공유할 체어를 선택하세요', 'error');
        return;
      }
      const links = selected.map(p => p.name + ': ' + location.origin + '/' + p.code).join('\\n');
      const text = '체어 TV URL\\n' + links + '\\n\\n각 체어 PC에서 해당 URL을 열어주세요.';
      window.location.href = 'sms:?body=' + encodeURIComponent(text);
    }
    
    // ===== TV로 내보내기 모달 =====
    function showTvExportModal(playlistId, playlistName, shortCode) {
      const playlist = playlists.find(p => p.id === playlistId);
      const isChair = playlistName.includes('체어');
      
      if (isChair) {
        // 체어: 스크립트 다운로드 모달 열기
        showScriptDownloadModal();
      } else {
        // 대기실: URL 가이드 모달 열기
        newlyCreatedPlaylist = playlist;
        if (playlist.external_short_url) {
          document.getElementById('guide-short-url').textContent = playlist.external_short_url.replace('https://', '');
        } else {
          document.getElementById('guide-short-url').textContent = location.host + '/' + shortCode;
        }
        openModal('guide-url-modal');
      }
    }
    
    // ===== 플레이리스트 드래그 정렬 =====
    function initPlaylistSortable() {
      // 대기실과 체어 각각의 컨테이너에 드래그 기능 적용
      const waitingRoomContainer = document.getElementById('waitingroom-sortable-container');
      const chairContainer = document.getElementById('chair-sortable-container');
      
      [waitingRoomContainer, chairContainer].forEach(container => {
        if (!container) return;
        initSortableContainer(container);
      });
    }
    
    function initSortableContainer(container) {
      if (!container) return;
      
      let draggedItem = null;
      
      container.addEventListener('dragstart', (e) => {
        const item = e.target.closest('.playlist-sortable-item');
        if (item) {
          draggedItem = item;
          item.classList.add('opacity-50');
          e.dataTransfer.effectAllowed = 'move';
        }
      });
      
      container.addEventListener('dragend', (e) => {
        const item = e.target.closest('.playlist-sortable-item');
        if (item) {
          item.classList.remove('opacity-50');
          draggedItem = null;
        }
      });
      
      container.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(container, e.clientY);
        if (draggedItem) {
          if (afterElement == null) {
            container.appendChild(draggedItem);
          } else {
            container.insertBefore(draggedItem, afterElement);
          }
        }
      });
      
      container.addEventListener('drop', async (e) => {
        e.preventDefault();
        // 대기실과 체어 컨테이너를 모두 읽어 전체 순서를 한번에 저장
        // (각 컨테이너가 따로 0부터 시작하면 sort_order 충돌 → 두 그룹을 합쳐서 연속된 인덱스 부여)
        const waitingItems = document.querySelectorAll('#waitingroom-sortable-container .playlist-sortable-item');
        const chairItems   = document.querySelectorAll('#chair-sortable-container .playlist-sortable-item');
        
        let idx = 0;
        const newOrder = [];
        waitingItems.forEach(item => {
          newOrder.push({ id: parseInt(item.dataset.playlistId), sort_order: idx++ });
        });
        chairItems.forEach(item => {
          newOrder.push({ id: parseInt(item.dataset.playlistId), sort_order: idx++ });
        });
        
        // playlists 배열도 동기화 (30초 자동갱신 시 renderPlaylists가 새 순서 유지)
        newOrder.forEach(({ id, sort_order }) => {
          const p = playlists.find(p => p.id === id);
          if (p) p.sort_order = sort_order;
        });
        
        // API 호출하여 순서 저장
        try {
          const res = await fetch(API_BASE + '/playlists/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: newOrder })
          });
          if (res.ok) {
            showToast('순서가 저장되었습니다.');
          }
        } catch (e) {
          console.error('순서 저장 실패:', e);
        }
      });
      
      function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.playlist-sortable-item:not(.opacity-50)')];
        
        return draggableElements.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          const offset = y - box.top - box.height / 2;
          if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
          } else {
            return closest;
          }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
      }
    }
    
    // ===== 임시 영상 전송 기능 =====
    let selectedTempVideoItem = null;
    let tempVideoSearchQuery = '';
    
    // 임시 영상 전송용 플레이리스트 아이템
    let tempVideoPlaylistItems = [];
    
    // 임시 영상 전송 모달 열기
    function showTempVideoModal(playlistId, playlistName, shortCode) {
      document.getElementById('temp-video-playlist-id').value = playlistId;
      document.getElementById('temp-video-short-code').value = shortCode;
      document.getElementById('temp-video-target-name').textContent = playlistName + '에 전송';
      document.getElementById('temp-video-url').value = '';
      const searchInput = document.getElementById('temp-video-search');
      if (searchInput) searchInput.value = '';
      tempVideoSearchQuery = '';
      selectedTempVideoItem = null;
      
      // 모달 즉시 열기
      openModal('temp-video-modal');
      
      // 재생목록 탭으로 초기화
      switchTempVideoTab('shared');
      
      // ── 즉시 렌더링: masterItemsCache + playlists에서 items 사용 ──
      const cachedItems = tempVideoCacheByPlaylist[playlistId];
      if (cachedItems && cachedItems.length) {
        // 캐시 우선
        tempVideoPlaylistItems = cachedItems;
        renderTempVideoSharedList();
      } else if (masterItemsCache && masterItemsCache.length > 0) {
        // masterItemsCache로 즉시 렌더링 (API fetch 없이)
        const basePlaylist = playlists.find(p => p.id == playlistId);
        const userItems = (basePlaylist?.items || []).map(item => ({ ...item, is_master: false }));
        const masterItemsWithFlag = masterItemsCache.map(item => ({ ...item, is_master: true }));
        tempVideoPlaylistItems = [...masterItemsWithFlag, ...userItems];
        tempVideoCacheByPlaylist[playlistId] = tempVideoPlaylistItems;
        renderTempVideoSharedList();
      } else {
        document.getElementById('temp-video-shared-list').innerHTML = '<div class="text-center py-4 text-gray-500">로딩 중...</div>';
      }
      
      // 백그라운드에서 최신 데이터 로드 (캐시 갱신 + 현재 전송 영상 확인)
      // 이미 즉시 렌더링된 경우 재렌더링 없이 캐시만 갱신
      const alreadyRendered = tempVideoPlaylistItems.length > 0;
      Promise.all([
        loadTempVideoPlaylistItems(playlistId),
        checkCurrentTempVideo(playlistId)
      ]).then(() => {
        if (!alreadyRendered) {
          // 즉시 렌더링 못 한 경우(masterItemsCache 없었을 때)만 렌더링
          renderTempVideoSharedList();
        }
        // 현재 전송 중인 영상 상태 표시는 항상 갱신
        checkCurrentTempVideo(playlistId);
      });
    }
    
    // 플레이리스트 아이템 로드 (공용 + 내 영상)
    async function loadTempVideoPlaylistItems(playlistId) {
      try {
        const [playlistRes, masterRes] = await Promise.all([
          fetch(API_BASE + '/playlists/' + playlistId),
          fetch('/api/master/items')
        ]);
        const data = await playlistRes.json();
        const masterData = await masterRes.json().catch(() => ({}));

        const latestMasterItems = (masterData.items || masterItems || []);
        masterItems = latestMasterItems;

        // 공용 영상 (최신 masterItems)
        const masterItemsWithFlag = (latestMasterItems || []).map(item => ({
          ...item,
          is_master: true
        }));
        
        // 내 영상
        const userItems = (data.playlist?.items || []).map(item => ({
          ...item,
          is_master: false
        }));
        
        // 합치기: 공용 먼저, 내 영상 나중
        tempVideoPlaylistItems = [...masterItemsWithFlag, ...userItems];
        tempVideoCacheByPlaylist[playlistId] = tempVideoPlaylistItems;
      } catch (e) {
        console.error('Failed to load playlist items:', e);
        tempVideoPlaylistItems = [];
      }
    }
    
    // 탭 전환
    function switchTempVideoTab(tab) {
      const sharedTab = document.getElementById('temp-tab-shared');
      const urlTab = document.getElementById('temp-tab-url');
      const sharedContent = document.getElementById('temp-video-shared-tab');
      const urlContent = document.getElementById('temp-video-url-tab');
      
      if (tab === 'shared') {
        sharedTab.classList.add('text-indigo-600', 'border-b-2', 'border-indigo-600');
        sharedTab.classList.remove('text-gray-500');
        urlTab.classList.remove('text-indigo-600', 'border-b-2', 'border-indigo-600');
        urlTab.classList.add('text-gray-500');
        sharedContent.classList.remove('hidden');
        urlContent.classList.add('hidden');
      } else {
        urlTab.classList.add('text-indigo-600', 'border-b-2', 'border-indigo-600');
        urlTab.classList.remove('text-gray-500');
        sharedTab.classList.remove('text-indigo-600', 'border-b-2', 'border-indigo-600');
        sharedTab.classList.add('text-gray-500');
        urlContent.classList.remove('hidden');
        sharedContent.classList.add('hidden');
      }
    }
    
    const normalizeSearchValue = (value) => {
      const base = (value || '')
        .toString()
        .toLowerCase()
        .normalize('NFKC');

      const stripped = base
        .replace(/\\s/g, '')
        .replace(/[._-]/g, '');

      return stripped.replace(/[^a-z0-9가-힣]/g, '');
    };

    const getTempVideoSearchText = (item) => {
      return [item.title, item.name, item.display_title, item.original_title, item.url]
        .filter(Boolean)
        .join(' ');
    };

    function updateTempVideoSearch() {
      const input = document.getElementById('temp-video-search');
      tempVideoSearchQuery = (input?.value || '').trim();
      renderTempVideoSearchResults();
    }

    function renderTempVideoSearchResults() {
      const resultsContainer = document.getElementById('temp-video-search-results');
      const query = tempVideoSearchQuery;
      const rawQuery = (query || '').toLowerCase().trim();
      const normalizedQuery = normalizeSearchValue(query);

      if (!resultsContainer) return;

      if (!rawQuery) {
        resultsContainer.classList.add('hidden');
        resultsContainer.innerHTML = '';
        return;
      }

      const filteredItems = tempVideoPlaylistItems.filter(item => {
        const rawText = (getTempVideoSearchText(item) || '').toLowerCase();
        const normalizedText = normalizeSearchValue(getTempVideoSearchText(item));
        return (normalizedQuery && normalizedText.includes(normalizedQuery)) || rawText.includes(rawQuery);
      });

      resultsContainer.classList.remove('hidden');
      if (filteredItems.length === 0) {
        resultsContainer.innerHTML = '<div class="text-center text-gray-500 py-3">검색 결과가 없습니다.</div>';
      } else {
        let resultHtml = '<div class="px-3 py-1 bg-indigo-50 text-xs text-indigo-600 font-medium">검색 결과</div>';
        resultHtml += filteredItems.map((item, idx) => renderTempVideoItem(item, idx)).join('');
        resultsContainer.innerHTML = resultHtml;
      }
    }

    // 재생 목록 렌더링 (공용 + 내 영상)
    function renderTempVideoSharedList() {
      const container = document.getElementById('temp-video-shared-list');

      if (tempVideoPlaylistItems.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-4">등록된 영상이 없습니다.</div>';
        return;
      }

      const selectedKey = selectedTempVideoItem
        ? ((selectedTempVideoItem.is_master ? 'm' : 'u') + '-' + selectedTempVideoItem.id)
        : null;

      // 공용 영상과 내 영상 분리 (전체 목록 유지)
      const masterVideos = tempVideoPlaylistItems.filter(item => item.is_master)
        .filter(item => ((item.is_master ? 'm' : 'u') + '-' + item.id) !== selectedKey);
      const userVideos = tempVideoPlaylistItems.filter(item => !item.is_master)
        .filter(item => ((item.is_master ? 'm' : 'u') + '-' + item.id) !== selectedKey);
      
      let html = '';

      if (selectedTempVideoItem) {
        html += '<div class="px-3 py-1 bg-indigo-50 text-xs text-indigo-600 font-medium">선택된 영상</div>';
        html += renderTempVideoItem(selectedTempVideoItem, 0);
      }
      
      if (masterVideos.length > 0) {
        html += '<div class="px-3 py-1 bg-purple-50 text-xs text-purple-600 font-medium">공용 영상</div>';
        html += masterVideos.map((item, idx) => renderTempVideoItem(item, idx)).join('');
      }
      
      if (userVideos.length > 0) {
        html += '<div class="px-3 py-1 bg-blue-50 text-xs text-blue-600 font-medium">내 영상</div>';
        html += userVideos.map((item, idx) => renderTempVideoItem(item, masterVideos.length + idx)).join('');
      }
      
      container.innerHTML = html;
      renderTempVideoSearchResults();
    }
    
    // 개별 아이템 렌더링
    function renderTempVideoItem(item, idx) {
      const isSelected = String(selectedTempVideoItem?.id) === String(item.id)
        && Boolean(selectedTempVideoItem?.is_master) === Boolean(item.is_master);
      const itemData = JSON.stringify(item).replace(/"/g, '&quot;');
      
      return \`
        <div class="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 transition \${isSelected ? 'bg-indigo-100' : ''}"
          onclick="selectTempVideoItem(\${itemData})">
          <input type="radio" name="temp-video-item" \${isSelected ? 'checked' : ''} class="text-indigo-600 flex-shrink-0">
          <div class="w-10 h-10 \${item.is_master ? 'bg-purple-100' : 'bg-gray-100'} rounded overflow-hidden flex-shrink-0">
            \${item.thumbnail_url 
              ? \`<img src="\${item.thumbnail_url}" class="w-full h-full object-cover">\`
              : \`<div class="w-full h-full flex items-center justify-center text-gray-400"><i class="fab fa-\${item.item_type}"></i></div>\`
            }
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm text-gray-800 truncate">\${item.title || item.url}</p>
          </div>
          <span class="text-xs \${item.is_master ? 'text-purple-400' : 'text-gray-400'} flex-shrink-0">\${item.item_type}</span>
        </div>
      \`;
    }
    
    // 영상 선택
    function selectTempVideoItem(item) {
      selectedTempVideoItem = item;
      const searchInput = document.getElementById('temp-video-search');
      if (searchInput) searchInput.value = '';
      tempVideoSearchQuery = '';
      const resultsContainer = document.getElementById('temp-video-search-results');
      if (resultsContainer) {
        resultsContainer.classList.add('hidden');
        resultsContainer.innerHTML = '';
      }
      renderTempVideoSharedList();
      const sharedList = document.getElementById('temp-video-shared-list');
      if (sharedList) {
        sharedList.scrollTop = 0;
      }
    }
    
    // 현재 임시 영상 상태 확인
    async function checkCurrentTempVideo(playlistId) {
      try {
        const res = await fetch(API_BASE + '/playlists/' + playlistId + '/temp-video');
        const data = await res.json();
        const statusDiv = document.getElementById('temp-video-current-status');
        
        if (data.active) {
          statusDiv.classList.remove('hidden');
        } else {
          statusDiv.classList.add('hidden');
        }
      } catch (e) {
        document.getElementById('temp-video-current-status').classList.add('hidden');
      }
    }
    
    // 임시 영상 전송
    function setStopButtonState(playlistId, active) {
      const stopBtn = document.getElementById('stop-temp-btn-' + playlistId);
      if (!stopBtn) return;

      stopBtn.classList.remove('opacity-0', 'pointer-events-none', 'invisible', 'hidden');
      stopBtn.classList.add('opacity-100', 'visible', 'inline-flex', 'items-center', 'justify-center', 'gap-1');
      stopBtn.style.opacity = '1';
      stopBtn.style.visibility = 'visible';
      stopBtn.removeAttribute('disabled');

      if (active) {
        stopBtn.classList.remove('bg-gray-50', 'text-gray-600', 'border-gray-200', 'cursor-not-allowed');
        stopBtn.classList.add('bg-red-50', 'text-red-600', 'hover:bg-red-100');
        stopBtn.removeAttribute('aria-disabled');
        delete stopBtn.dataset.disabled;
        stopBtn.innerHTML = '<i class="fas fa-stop"></i><span>기본으로 복귀</span>';
      } else {
        stopBtn.classList.remove('bg-red-50', 'text-red-600', 'hover:bg-red-100');
        stopBtn.classList.add('bg-gray-50', 'text-gray-600', 'border-gray-200', 'cursor-not-allowed');
        stopBtn.setAttribute('aria-disabled', 'true');
        stopBtn.dataset.disabled = 'true';
        stopBtn.innerHTML = '<i class="fas fa-stop"></i><span>기본으로 복귀</span>';
      }
    }

    async function sendTempVideo() {
      const playlistId = document.getElementById('temp-video-playlist-id').value;
      const shortCode = document.getElementById('temp-video-short-code').value;
      const urlInput = document.getElementById('temp-video-url').value.trim();
      const returnTime = document.getElementById('temp-return-time').value;
      
      // URL 또는 공용자료 선택 확인
      let videoUrl = '';
      let videoTitle = '';
      let videoType = '';
      
      if (urlInput) {
        videoUrl = urlInput;
        // YouTube/Vimeo 타입 감지
        if (urlInput.includes('youtube.com') || urlInput.includes('youtu.be')) {
          videoType = 'youtube';
          videoTitle = 'YouTube 영상';
        } else if (urlInput.includes('vimeo.com')) {
          videoType = 'vimeo';
          videoTitle = 'Vimeo 영상';
        } else {
          showToast('YouTube 또는 Vimeo URL을 입력해주세요', 'error');
          return;
        }
      } else if (selectedTempVideoItem) {
        videoUrl = selectedTempVideoItem.url;
        videoTitle = selectedTempVideoItem.title || '공용 영상';
        videoType = selectedTempVideoItem.item_type;
      } else {
        showToast('영상을 선택하거나 URL을 입력해주세요', 'error');
        return;
      }
      
      try {
        const res = await fetch(API_BASE + '/playlists/' + playlistId + '/temp-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: videoUrl,
            title: videoTitle,
            type: videoType,
            return_time: returnTime
          })
        });
        
        if (res.ok) {
          showToast('✅ 임시 영상이 전송되었습니다!');
          closeModal('temp-video-modal');
          // 상태 업데이트 - 인디케이터와 기본으로 복귀 버튼 표시
          const indicator = document.getElementById('temp-indicator-' + playlistId);
          if (indicator) indicator.classList.remove('hidden');
          setStopButtonState(playlistId, true);
        } else {
          showToast('전송 실패', 'error');
        }
      } catch (e) {
        console.error(e);
        showToast('전송 실패', 'error');
      }
    }
    
    // 임시 영상 중지 (기본으로 복귀) - 모달 내부용
    async function stopTempVideo() {
      const playlistId = document.getElementById('temp-video-playlist-id').value;
      await stopTempVideoForPlaylist(playlistId);
    }
    
    // 임시 영상 중지 (기본으로 복귀) - 플레이리스트 카드에서 직접 호출
    async function stopTempVideoForPlaylist(playlistId) {
      const stopBtn = document.getElementById('stop-temp-btn-' + playlistId);
      if (stopBtn?.dataset?.disabled === 'true') return;

      console.log('stopTempVideoForPlaylist called:', playlistId);
      console.log('API_BASE:', API_BASE);
      const url = API_BASE + '/playlists/' + playlistId + '/temp-video';
      console.log('DELETE URL:', url);
      
      try {
        const res = await fetch(url, { method: 'DELETE' });
        console.log('Response status:', res.status);
        
        if (res.ok) {
          showToast('✅ 기본 재생목록으로 복귀합니다');
          document.getElementById('temp-video-current-status')?.classList.add('hidden');
          // 인디케이터 숨기기
          const indicator = document.getElementById('temp-indicator-' + playlistId);
          if (indicator) indicator.classList.add('hidden');
          // 기본으로 복귀 버튼 숨기기
          setStopButtonState(playlistId, false);
        } else {
          const text = await res.text();
          console.log('Response error:', text);
          showToast('복귀 실패: ' + res.status, 'error');
        }
      } catch (e) {
        console.error('stopTempVideoForPlaylist error:', e);
        showToast('복귀 실패', 'error');
      }
    }
    
    // 새로 생성된 플레이리스트 정보 저장용
    let newlyCreatedPlaylist = null;
    
    function showCreatePlaylistModal() {
      // 모든 단계 초기화
      document.getElementById('create-step-1').classList.remove('hidden');
      document.getElementById('create-step-waiting').classList.add('hidden');
      document.getElementById('create-step-chair').classList.add('hidden');
      document.getElementById('new-waiting-name').value = '';
      document.getElementById('new-chair-name').value = '';
      openModal('create-playlist-modal');
    }
    
    function selectCreateType(type) {
      document.getElementById('create-step-1').classList.add('hidden');
      if (type === 'waiting') {
        document.getElementById('create-step-waiting').classList.remove('hidden');
        document.getElementById('new-waiting-name').focus();
      } else {
        document.getElementById('create-step-chair').classList.remove('hidden');
        document.getElementById('new-chair-name').focus();
      }
    }
    
    function backToStep1() {
      document.getElementById('create-step-1').classList.remove('hidden');
      document.getElementById('create-step-waiting').classList.add('hidden');
      document.getElementById('create-step-chair').classList.add('hidden');
    }
    
    // 대기실 생성
    async function createWaitingRoom() {
      const name = document.getElementById('new-waiting-name').value.trim();
      if (!name) {
        showToast('대기실 이름을 입력하세요', 'error');
        return;
      }

      // 프론트엔드 중복 체크
      if (playlists && playlists.some(p => p.name === name)) {
        showToast('"' + name + '" 이름이 이미 존재합니다. 다른 이름을 사용해주세요.', 'error');
        return;
      }
      
      try {
        const res = await fetch(API_BASE + '/playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        
        const data = await res.json();
        
        if (data.success) {
          closeModal('create-playlist-modal');
          newlyCreatedPlaylist = data.playlist;
          await loadPlaylists();
          
          // URL 직접 입력 가이드 모달 표시 (초기설정 탭은 자동으로 열지 않음)
          showUrlGuide(data.playlist);
        } else {
          showToast(data.error || '생성 실패', 'error');
        }
      } catch (e) {
        showToast('오류가 발생했습니다.', 'error');
      }
    }
    
    // 체어 생성
    async function createChair() {
      let name = document.getElementById('new-chair-name').value.trim();
      if (!name) {
        showToast('체어 이름을 입력하세요', 'error');
        return;
      }
      
      // 이름에 '체어'가 없으면 자동으로 추가
      if (!name.includes('체어')) {
        name = '체어' + name;
      }

      // 프론트엔드 중복 체크
      if (playlists && playlists.some(p => p.name === name)) {
        showToast('"' + name + '" 이름이 이미 존재합니다. 다른 이름을 사용해주세요.', 'error');
        return;
      }
      
      try {
        const res = await fetch(API_BASE + '/playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        
        const data = await res.json();
        
        if (data.success) {
          closeModal('create-playlist-modal');
          await loadPlaylists();
          showToast('✅ ' + name + ' 추가 완료! 초기 설정 탭에서 스크립트를 다운로드하세요.');
        } else {
          showToast(data.error || '생성 실패', 'error');
        }
      } catch (e) {
        showToast('오류가 발생했습니다.', 'error');
      }
    }
    
    // 단축 URL 가이드 표시
    function showUrlGuide(playlist) {
      newlyCreatedPlaylist = playlist;
      document.getElementById('guide-short-url').textContent = location.host + '/' + playlist.short_code;
      openModal('guide-url-modal');
    }
    
    // USB 가이드 제거: URL 직접 입력만 사용
    
    // 가이드 모달용 URL 복사
    function copyGuideUrl() {
      if (!newlyCreatedPlaylist) return;
      const url = location.origin + '/' + newlyCreatedPlaylist.short_code;
      navigator.clipboard.writeText(url);
      showToast('URL이 복사되었습니다!');
    }
    
    // 더 짧은 URL 만들기 (팝업창에서 호출)
    async function makeUrlShorter() {
      if (!newlyCreatedPlaylist) return;
      try {
        showToast('단축 URL 생성 중...', 'info');
        const res = await fetch(API_BASE + '/playlists/' + newlyCreatedPlaylist.id + '/external-shorten', {
          method: 'POST'
        });
        const data = await res.json();
        if (data.success && data.shortUrl) {
          const shortUrlDisplay = data.shortUrl.replace('https://', '');
          newlyCreatedPlaylist.externalShortUrl = data.shortUrl;
          
          // 모든 관련 입력창 업데이트
          updateAllUrlDisplays(newlyCreatedPlaylist.id, shortUrlDisplay, data.shortUrl);
          
          // 팝업창 URL 업데이트 (별도로 처리)
          const guideEl = document.getElementById('guide-short-url');
          if (guideEl) guideEl.textContent = shortUrlDisplay;
          
          // 클립보드에 복사 (iframe 환경에서 실패해도 무시)
          try {
            await navigator.clipboard.writeText(data.shortUrl);
            showToast('✅ 단축 URL 생성 완료! ' + shortUrlDisplay + ' (클립보드 복사됨)', 'success', 5000);
          } catch (clipErr) {
            showToast('✅ 단축 URL 생성 완료! ' + shortUrlDisplay, 'success', 5000);
          }
        } else {
          showToast(data.error || '단축 URL 생성 실패', 'error');
        }
      } catch (e) {
        showToast('단축 URL 생성 실패: ' + e.message, 'error');
      }
    }
    
    // 가이드 모달용 북마크 다운로드
    function downloadGuideBookmark(variant = 'universal') {
      if (!newlyCreatedPlaylist) return;
      const url = location.origin + '/' + newlyCreatedPlaylist.short_code;
      downloadBookmark(newlyCreatedPlaylist.name, url, newlyCreatedPlaylist.short_code, variant);
      const label = variant === 'samsung'
        ? '삼성 TV용'
        : variant === 'lg'
          ? 'LG TV용'
          : variant === 'android'
            ? 'Android TV용'
            : '공통';
      showToast(label + ' HTML 파일이 다운로드되었습니다!');
    }
    
    // 가이드 모달용 URL 파일 다운로드
    function downloadGuideUrlFile() {
      if (!newlyCreatedPlaylist) return;
      const url = location.origin + '/' + newlyCreatedPlaylist.short_code;
      downloadUrlFile(newlyCreatedPlaylist.name, url);
      showToast('URL 바로가기 파일이 다운로드되었습니다!');
    }
    
    function showTvGuideModal() {
      openModal('tv-guide-modal');
    }
    
    // 기존 createPlaylist 함수 (이전 버전 호환용)
    async function createPlaylist(e) {
      if (e) e.preventDefault();
      const nameEl = document.getElementById('new-playlist-name');
      if (!nameEl) return;
      const name = nameEl.value;
      
      try {
        const res = await fetch(API_BASE + '/playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        
        const data = await res.json();
        
        if (data.success) {
          closeModal('create-playlist-modal');
          loadPlaylists();
          showToast('생성 완료! 단축 URL: ' + data.playlist.short_code);
        } else {
          showToast(data.error || '생성 실패', 'error');
        }
      } catch (e) {
        showToast('오류가 발생했습니다.', 'error');
      }
    }
    
    async function deletePlaylist(id) {
      // 마지막 플레이리스트인지 확인
      if (playlists.length <= 1) {
        showToast('최소 1개의 대기실/체어가 필요합니다.', 'error');
        return;
      }
      
      if (!confirm('정말 삭제하시겠습니까?')) return;
      
      try {
        const res = await fetch(API_BASE + '/playlists/' + id, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          loadPlaylists();
          showToast('삭제되었습니다.');
        } else {
          showToast(data.error || '삭제 실패', 'error');
        }
      } catch (e) {
        showToast('삭제 실패', 'error');
      }
    }
    
    let isOpeningEditor = false;

    function resetPlaylistEditorScroll() {
      const playlistContainer = document.getElementById('playlist-items-container');
      if (playlistContainer) playlistContainer.scrollTop = 0;

      const libraryContainer = document.getElementById('library-scroll-container');
      if (libraryContainer) libraryContainer.scrollTop = 0;
    }

    async function openPlaylistEditor(id) {
      if (isOpeningEditor) return;
      isOpeningEditor = true;
      
      // 즉시 모달 열기
      openModal('edit-playlist-modal');
      
      // UI 초기화
      resetPlaylistEditorScroll();
      playlistSearchQuery = '';
      const librarySearchInput = document.getElementById('library-search');
      if (librarySearchInput) librarySearchInput.value = '';
      const librarySearchMessage = document.getElementById('library-search-message');
      if (librarySearchMessage) librarySearchMessage.classList.add('hidden');
      const librarySearchResults = document.getElementById('library-search-results');
      if (librarySearchResults) {
        librarySearchResults.innerHTML = '';
        librarySearchResults.classList.add('hidden');
      }

      // sortable 인스턴스 제거
      if (sortableInstance) {
        sortableInstance.destroy();
        sortableInstance = null;
      }
      if (typeof playlistSortableInstance !== 'undefined' && playlistSortableInstance) {
        playlistSortableInstance.destroy();
        playlistSortableInstance = null;
      }

      // ── 1단계: playlists 배열에서 기본 정보를 즉시 사용 ──
      // playlists 배열(INITIAL_DATA)에는 이제 items, activeItemIds도 포함됨
      const basePlaylist = playlists.find(p => p.id == id);
      
      if (basePlaylist) {
        // INITIAL_DATA에서 items 포함한 전체 정보로 즉시 설정
        currentPlaylist = Object.assign({ items: [], activeItemIds: [] }, basePlaylist);
        document.getElementById('edit-playlist-title').textContent = currentPlaylist.name + ' 편집';
        document.getElementById('transition-effect').value = currentPlaylist.transition_effect || 'fade';
        document.getElementById('transition-duration').value = currentPlaylist.transition_duration || 1000;
        updateDurationLabel();
      } else {
        // playlists 배열에 없으면 임시 객체로 설정
        currentPlaylist = {
          id: id,
          name: '재생목록',
          items: [],
          activeItemIds: [],
          transition_effect: 'fade',
          transition_duration: 1000
        };
        document.getElementById('edit-playlist-title').textContent = '불러오는 중...';
      }

      // ── 2단계: INITIAL_DATA로 즉시 전체 렌더링 ──
      // masterItemsCache + currentPlaylist.items 모두 이미 있으므로 즉시 렌더링
      if (masterItemsCache && masterItemsCache.length > 0 && currentPlaylist) {
        // renderLibraryAndPlaylist()는 currentPlaylist.items와 masterItemsCache를 모두 사용
        // 캐시에 있으면 즉시 동기적으로 렌더링 가능 (API fetch 불필요)
        playlistEditorSignature = getPlaylistEditorSignature(masterItemsCache, currentPlaylist);
        await renderLibraryAndPlaylist();
        loadPlaylistOrder();
        // 설정은 백그라운드에서 로드 (UI 블로킹 없음)
        loadPlaylistSettings().catch(() => {});
        if (typeof startMasterItemsAutoRefresh === 'function') {
          startMasterItemsAutoRefresh();
        }
        // 3단계 API fetch는 캐시 업데이트 전용 (재렌더링 없음)
        // INITIAL_DATA가 이미 완전한 데이터를 포함하므로 화면 갱신 불필요
        fetch(API_BASE + '/playlists/' + id + '?ts=' + Date.now())
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data && data.playlist) {
              // 캐시만 업데이트 (다음 번 편집창 열 때 사용)
              playlistCacheById[id] = data.playlist;
            }
          })
          .catch(() => {});
        isOpeningEditor = false;
        return;
      } else {
        // masterItemsCache가 없으면 스켈레톤 표시
        const skeletonItem = '<div class="animate-pulse flex items-center gap-3 p-3 border-b"><div class="w-20 h-14 bg-gray-200 rounded flex-shrink-0"></div><div class="flex-1 space-y-2"><div class="h-3 bg-gray-200 rounded w-3/4"></div><div class="h-3 bg-gray-200 rounded w-1/2"></div></div></div>';
        const libraryMasterList = document.getElementById('library-master-list');
        if (libraryMasterList) libraryMasterList.innerHTML = skeletonItem.repeat(4);
        const libraryUserList = document.getElementById('library-user-list');
        if (libraryUserList) libraryUserList.innerHTML = skeletonItem.repeat(3);
        const playlistContainer = document.getElementById('playlist-items-container');
        if (playlistContainer) playlistContainer.innerHTML = skeletonItem.repeat(4);
      }

      // ── 3단계: 백그라운드에서 playlist 상세(items) fetch ──
      try {
        const fetchWithTimeout = async (url, timeoutMs) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          try {
            return await fetch(url, { signal: controller.signal });
          } finally {
            clearTimeout(timeoutId);
          }
        };

        // 캐시에 있으면 즉시 사용
        const cachedPlaylist = playlistCacheById[id];
        let fullPlaylist = cachedPlaylist || null;

        if (!fullPlaylist) {
          let res = await fetchWithTimeout(API_BASE + '/playlists/' + id + '?ts=' + Date.now(), 3000);
          if (!res || !res.ok) {
            await new Promise(resolve => setTimeout(resolve, 300));
            res = await fetchWithTimeout(API_BASE + '/playlists/' + id + '?retry=1', 3000);
          }
          if (res && res.ok) {
            const data = await res.json();
            if (data && data.playlist) {
              fullPlaylist = data.playlist;
              playlistCacheById[id] = fullPlaylist;
            }
          }
        }

        if (fullPlaylist) {
          currentPlaylist = fullPlaylist;
          document.getElementById('edit-playlist-title').textContent = (currentPlaylist.name || '재생목록') + ' 편집';
          document.getElementById('transition-effect').value = currentPlaylist.transition_effect || 'fade';
          document.getElementById('transition-duration').value = currentPlaylist.transition_duration || 1000;
          updateDurationLabel();
        }

        // 완전한 데이터로 전체 렌더링
        const newSignature = getPlaylistEditorSignature(masterItemsCache || [], currentPlaylist);
        playlistEditorSignature = newSignature;
        await renderLibraryAndPlaylist();
        loadPlaylistOrder();

        // 설정은 렌더링 완료 후 백그라운드에서 로드 (UI 블로킹 없음)
        loadPlaylistSettings().catch(() => {});

        if (typeof startMasterItemsAutoRefresh === 'function') {
          startMasterItemsAutoRefresh();
        }
      } catch (e) {
        console.error('플레이리스트 편집기 오류:', e);
        if (typeof renderLibraryAndPlaylist === 'function') {
          await renderLibraryAndPlaylist();
        }
      } finally {
        isOpeningEditor = false;
      }
    }
    
    async function loadPlaylistSettings() {
      try {
        const res = await fetch(API_BASE + '/settings');
        const settings = await res.json();
        
        // 로고 설정 로드 (요소가 존재하는 경우에만)
        const logoUrl = document.getElementById('logo-url');
        const logoSize = document.getElementById('logo-size');
        const logoOpacity = document.getElementById('logo-opacity');
        if (logoUrl) logoUrl.value = settings.logo_url || '';
        if (logoSize) logoSize.value = settings.logo_size || 150;
        if (logoOpacity) logoOpacity.value = settings.logo_opacity || 90;
        if (typeof updateLogoSizeLabel === 'function') updateLogoSizeLabel();
        if (typeof updateLogoOpacityLabel === 'function') updateLogoOpacityLabel();
        
        // 재생시간 설정 로드
        const scheduleEnabled = settings.schedule_enabled || 0;
        const scheduleEnabledEl = document.getElementById('schedule-enabled');
        const scheduleStart = document.getElementById('schedule-start');
        const scheduleEnd = document.getElementById('schedule-end');
        if (scheduleEnabledEl) scheduleEnabledEl.checked = scheduleEnabled === 1;
        if (scheduleStart) scheduleStart.value = settings.schedule_start || '';
        if (scheduleEnd) scheduleEnd.value = settings.schedule_end || '';
        if (typeof toggleScheduleInputs === 'function') toggleScheduleInputs(scheduleEnabled === 1);
        
        // 공용 플레이리스트 설정 로드
        const useMasterPlaylist = settings.use_master_playlist ?? 1;
        const useMasterEl = document.getElementById('use-master-playlist');
        const masterModeEl = document.getElementById('master-playlist-mode');
        if (useMasterEl) useMasterEl.checked = useMasterPlaylist === 1;
        if (masterModeEl) masterModeEl.value = settings.master_playlist_mode || 'before';
        if (typeof toggleMasterPlaylistInputs === 'function') toggleMasterPlaylistInputs(useMasterPlaylist === 1);
      } catch (e) {
        console.error('설정 로드 오류:', e);
      }
    }
    
    function toggleScheduleSettings() {
      const enabled = document.getElementById('schedule-enabled').checked;
      toggleScheduleInputs(enabled);
      saveScheduleSettings();
    }
    
    function toggleScheduleInputs(enabled) {
      const inputs = document.getElementById('schedule-inputs');
      if (enabled) {
        inputs.classList.remove('opacity-50', 'pointer-events-none');
      } else {
        inputs.classList.add('opacity-50', 'pointer-events-none');
      }
    }
    
    function toggleMasterPlaylistSettings() {
      const enabled = document.getElementById('use-master-playlist').checked;
      toggleMasterPlaylistInputs(enabled);
      saveMasterPlaylistSettings();
    }
    
    function toggleMasterPlaylistInputs(enabled) {
      const inputs = document.getElementById('master-playlist-inputs');
      if (!inputs) return;
      if (enabled) {
        inputs.classList.remove('opacity-50', 'pointer-events-none');
      } else {
        inputs.classList.add('opacity-50', 'pointer-events-none');
      }
    }
    
    async function saveMasterPlaylistSettings() {
      try {
        await fetch(API_BASE + '/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            use_master_playlist: document.getElementById('use-master-playlist').checked ? 1 : 0,
            master_playlist_mode: document.getElementById('master-playlist-mode').value
          })
        });
        showToast('공용 플레이리스트 설정이 저장되었습니다.');
      } catch (e) {
        showToast('저장 실패', 'error');
      }
    }
    
    function updateDurationLabel() {
      const duration = document.getElementById('transition-duration').value;
      document.getElementById('duration-label').textContent = (duration / 1000).toFixed(1) + '초';
    }
    
    function updateLogoSizeLabel() {
      const size = document.getElementById('logo-size').value;
      document.getElementById('logo-size-value').textContent = size + 'px';
    }
    
    function updateLogoOpacityLabel() {
      const opacity = document.getElementById('logo-opacity').value;
      document.getElementById('logo-opacity-value').textContent = opacity + '%';
    }
    
    async function saveTransitionSettings() {
      if (!currentPlaylist) return;
      
      const effect = document.getElementById('transition-effect').value;
      const duration = parseInt(document.getElementById('transition-duration').value);
      
      try {
        await fetch(API_BASE + '/playlists/' + currentPlaylist.id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            transition_effect: effect,
            transition_duration: duration
          })
        });
        
        currentPlaylist.transition_effect = effect;
        currentPlaylist.transition_duration = duration;
        
        showToast('전환 효과가 저장되었습니다.');
      } catch (e) {
        showToast('저장 실패', 'error');
      }
    }
    
    async function saveLogoSettings() {
      try {
        await fetch(API_BASE + '/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            logo_url: document.getElementById('logo-url').value,
            logo_size: parseInt(document.getElementById('logo-size').value),
            logo_opacity: parseInt(document.getElementById('logo-opacity').value)
          })
        });
        showToast('로고 설정이 저장되었습니다.');
      } catch (e) {
        showToast('저장 실패', 'error');
      }
    }
    
    async function saveScheduleSettings() {
      try {
        await fetch(API_BASE + '/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schedule_enabled: document.getElementById('schedule-enabled').checked ? 1 : 0,
            schedule_start: document.getElementById('schedule-start').value,
            schedule_end: document.getElementById('schedule-end').value
          })
        });
        showToast('재생 시간 설정이 저장되었습니다.');
      } catch (e) {
        showToast('저장 실패', 'error');
      }
    }
    
    // sortableInstance는 JS 블록 상단에 선언됨
    
    async function renderPlaylistItems() {
      const container = document.getElementById('playlist-items-container');
      const items = currentPlaylist.items || [];
      
      // 공용 영상 로드 (상단 섹션 숨기고 목록에 통합)
      const masterSection = document.getElementById('master-items-section');
      if (masterSection) masterSection.classList.add('hidden');
      
      // 공용 영상 가져오기 (캐시 우선)
      if (!masterItemsCache) {
        try {
          const baseUrl = window.location.origin;
          const res = await fetch(baseUrl + '/api/master/items');
          const data = await res.json();
          masterItemsCache = data.items || [];
        } catch (e) {
          masterItemsCache = masterItemsCache || [];
        }
      }

      
      // 기존 sortable 인스턴스 제거
      if (sortableInstance) {
        sortableInstance.destroy();
        sortableInstance = null;
      }
      
      // 공용 영상 + 내 영상 = 전체 표시
      const hasUserItems = items.length > 0;
      const hasMasterItems = masterItemsCache && masterItemsCache.length > 0;
      
      if (!hasUserItems && !hasMasterItems) {
        container.innerHTML = \`
          <div class="bg-gray-50 rounded-lg p-8 text-center">
            <i class="fas fa-video text-3xl text-gray-300 mb-3"></i>
            <p class="text-gray-500">추가된 미디어가 없습니다.</p>
            <p class="text-sm text-gray-400 mt-1">위에서 YouTube 또는 Vimeo URL을 추가해주세요.</p>
          </div>
        \`;
        return;
      }
      
      // 공용 영상 HTML 생성 (맨 위에 표시, 수정 불가)
      const masterItemsHtml = masterItemsCache.map((item, index) => \`
        <div class="playlist-item bg-purple-50 rounded-lg p-4 flex items-center gap-4 border-l-4 border-purple-400" data-master="true">
          <div class="text-purple-300 p-2">
            <i class="fas fa-lock text-lg"></i>
          </div>
          <span class="text-purple-400 font-bold w-6 text-center">\${index + 1}</span>
          <div class="w-24 h-16 bg-purple-100 rounded overflow-hidden flex-shrink-0 editor-master-thumb" data-type="\${item.item_type}" data-url="\${item.url}">
            \${item.thumbnail_url 
              ? \`<img src="\${item.thumbnail_url}" class="w-full h-full object-cover">\`
              : \`<div class="w-full h-full flex items-center justify-center"><i class="fas fa-spinner fa-spin text-purple-400"></i></div>\`
            }
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-purple-800 truncate">\${item.title || item.url}</p>
            <p class="text-sm text-purple-500">
              <i class="fab fa-\${item.item_type} mr-1"></i>\${item.item_type} · <span class="bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded text-xs">공용</span>
            </p>
          </div>
        </div>
      \`).join('');
      
      // 내 영상 HTML 생성 (수정 가능)
      const userItemsHtml = items.map((item, index) => \`
        <div class="playlist-item bg-gray-50 rounded-lg p-4 flex items-center gap-4 \${item.item_type === 'image' ? 'border-l-4 border-green-400' : ''}" data-id="\${item.id}">
          <div class="drag-handle text-gray-400 hover:text-gray-600 p-2 cursor-grab active:cursor-grabbing">
            <i class="fas fa-grip-vertical text-lg"></i>
          </div>
          <span class="item-number text-gray-400 font-bold w-6 text-center">\${masterItemsCache.length + index + 1}</span>
          <div class="w-24 h-16 bg-gray-200 rounded overflow-hidden flex-shrink-0 relative" id="thumb-\${item.id}">
            \${item.item_type === 'image' 
              ? \`<img src="\${item.url}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<div class=\\\\'w-full h-full flex items-center justify-center bg-purple-100\\\\'><i class=\\\\'fas fa-image text-purple-400 text-xl\\\\'></i></div>'">\`
              : (item.thumbnail_url && !item.thumbnail_url.includes('vimeo.com/') && !item.thumbnail_url.includes('youtube.com/'))
                ? \`<img src="\${item.thumbnail_url}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/120x80?text=Video'">\`
                : \`<div class="w-full h-full flex items-center justify-center thumb-loading" data-type="\${item.item_type}" data-url="\${item.url}" data-item-id="\${item.id}">
                    <i class="fas fa-spinner fa-spin \${item.item_type === 'youtube' ? 'text-red-500' : 'text-blue-400'} text-xl"></i>
                  </div>\`
            }
            \${item.item_type === 'image' ? \`<div class="absolute bottom-0 right-0 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-tl">\${item.display_time}s</div>\` : ''}
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-gray-800 truncate" id="title-\${item.id}">\${item.title || (item.item_type === 'image' ? '이미지' : item.url)}</p>
            <p class="text-sm \${item.item_type === 'image' ? 'text-green-500' : 'text-gray-500'}">
              \${item.item_type === 'youtube' 
                ? '<i class="fab fa-youtube text-red-500 mr-1"></i>YouTube'
                : item.item_type === 'vimeo'
                  ? '<i class="fab fa-vimeo text-blue-400 mr-1"></i>Vimeo'
                  : '<i class="fas fa-image text-green-400 mr-1"></i>이미지'
              }
              \${item.item_type === 'image' ? \` · <i class="fas fa-clock mr-1"></i>\${item.display_time}초 표시\` : ''}
            </p>
          </div>
          \${item.item_type === 'image' ? \`
            <div class="flex items-center gap-2 bg-white border rounded-lg px-3 py-2">
              <i class="fas fa-clock text-green-400"></i>
              <input type="number" value="\${item.display_time}" min="1" max="300"
                class="w-16 px-2 py-1 border rounded text-center text-sm focus:ring-2 focus:ring-green-300"
                onchange="updateItemDisplayTime(\${item.id}, this.value)">
              <span class="text-sm text-gray-500">초</span>
            </div>
          \` : ''}
          <button onclick="deletePlaylistItem(\${item.id})" class="text-red-500 hover:text-red-600 p-2 hover:bg-red-50 rounded">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      \`).join('');
      
      // 공용 영상이 있으면 구분선 추가
      if (hasMasterItems && hasUserItems) {
        container.innerHTML = masterItemsHtml + 
          '<div class="border-t-2 border-dashed border-gray-300 my-4 relative"><span class="absolute left-1/2 -translate-x-1/2 -top-3 bg-white px-3 text-xs text-gray-400">↓ 내 영상 ↓</span></div>' + 
          userItemsHtml;
      } else if (hasMasterItems) {
        container.innerHTML = masterItemsHtml + 
          '<div class="bg-gray-50 rounded-lg p-4 text-center text-gray-400 text-sm mt-4"><i class="fas fa-plus mr-2"></i>위에서 내 영상을 추가하세요</div>';
      } else {
        container.innerHTML = userItemsHtml;
      }
      
      // Sortable 초기화 (내 영상만 드래그 가능)
      initSortable();
      
      // 썸네일이 없는 아이템에 대해 자동으로 로드
      loadMissingThumbnails();
      loadEditorMasterThumbnails();
    }
    
    // 편집기에서 마스터 영상 표시 (읽기 전용)
    async function renderMasterItemsInEditor() {
      const section = document.getElementById('master-items-section');
      const container = document.getElementById('master-items-list');
      
      try {
        const baseUrl = window.location.origin;
        const res = await fetch(baseUrl + '/api/master/items');
        const data = await res.json();
        const items = data.items || [];
        
        if (items.length === 0) {
          section.classList.add('hidden');
          return;
        }
        
        section.classList.remove('hidden');
        container.innerHTML = items.map((item, idx) => \`
          <div class="flex items-center gap-4 bg-white bg-opacity-70 p-4 rounded-lg border border-purple-200">
            <i class="fas fa-lock text-purple-300"></i>
            <span class="text-purple-400 font-bold w-6 text-center">\${idx + 1}</span>
            <div class="w-24 h-16 bg-purple-100 rounded overflow-hidden flex-shrink-0 editor-master-thumb" data-type="\${item.item_type}" data-url="\${item.url}">
              \${item.thumbnail_url 
                ? \`<img src="\${item.thumbnail_url}" class="w-full h-full object-cover">\`
                : \`<div class="w-full h-full flex items-center justify-center"><i class="fas fa-spinner fa-spin text-purple-400"></i></div>\`
              }
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-purple-800 truncate">\${item.title || item.url}</p>
              <p class="text-sm text-purple-400">
                <i class="fab fa-\${item.item_type} mr-1"></i>\${item.item_type} · 공용
              </p>
            </div>
          </div>
        \`).join('');
        
        // 썸네일 자동 로드
        loadEditorMasterThumbnails();
      } catch (e) {
        section.classList.add('hidden');
      }
    }
    
    // 편집기 마스터 영상 썸네일 로드
    async function loadEditorMasterThumbnails() {
      const thumbs = document.querySelectorAll('.editor-master-thumb');
      for (const el of thumbs) {
        if (el.querySelector('img')) continue;
        const type = el.dataset.type;
        const url = el.dataset.url;
        
        if (type === 'vimeo') {
          const match = url.match(/vimeo\\.com\\/(\\d+)/);
          const videoId = match ? match[1] : null;
          if (videoId) {
            try {
              const res = await fetch('/api/vimeo-thumbnail/' + videoId);
              const data = await res.json();
              if (data.success && data.thumbnail) {
                el.innerHTML = '<img src="' + data.thumbnail + '" class="w-full h-full object-cover">';
              } else {
                el.innerHTML = '<div class="w-full h-full flex items-center justify-center"><i class="fab fa-vimeo text-purple-400"></i></div>';
              }
            } catch (e) {
              el.innerHTML = '<div class="w-full h-full flex items-center justify-center"><i class="fab fa-vimeo text-purple-400"></i></div>';
            }
          }
        } else if (type === 'youtube') {
          const match = url.match(/(?:youtube\\.com\\/watch\\?v=|youtu\\.be\\/)([\\w-]+)/);
          const videoId = match ? match[1] : null;
          if (videoId) {
            el.innerHTML = '<img src="https://img.youtube.com/vi/' + videoId + '/mqdefault.jpg" class="w-full h-full object-cover">';
          }
        }
      }
    }
    
    // 썸네일이 없는 아이템에 대해 자동으로 로드 (서버 API 사용)
    async function loadMissingThumbnails() {
      const loadingThumbs = document.querySelectorAll('.thumb-loading');
      
      for (const el of loadingThumbs) {
        const type = el.dataset.type;
        const url = el.dataset.url;
        const container = el.parentElement;
        const itemId = container.id.replace('thumb-', '');
        
        if (type === 'vimeo') {
          const videoId = extractVimeoIdFront(url);
          if (videoId) {
            try {
              // 서버 API 사용 (CORS 문제 해결)
              const res = await fetch('/api/vimeo-thumbnail/' + videoId);
              const data = await res.json();
              if (data.success && data.thumbnail) {
                container.innerHTML = '<img src="' + data.thumbnail + '" class="w-full h-full object-cover">';
                updateItemThumbnail(itemId, data.thumbnail, data.title);
                
                // 제목도 업데이트
                const titleEl = document.getElementById('title-' + itemId);
                if (titleEl && data.title && titleEl.textContent.startsWith('http')) {
                  titleEl.textContent = data.title;
                }
              } else {
                container.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-blue-100"><i class="fab fa-vimeo text-blue-400 text-xl"></i></div>';
              }
            } catch (e) {
              container.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-blue-100"><i class="fab fa-vimeo text-blue-400 text-xl"></i></div>';
            }
          }
        } else if (type === 'youtube') {
          const videoId = extractYouTubeIdFront(url);
          if (videoId) {
            const thumbUrl = 'https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg';
            container.innerHTML = '<img src="' + thumbUrl + '" class="w-full h-full object-cover">';
            updateItemThumbnail(itemId, thumbUrl, '');
          }
        }
      }
    }
    
    function extractVimeoIdFront(url) {
      const m = url.match(/vimeo\\.com\\/(\\d+)/);
      return m ? m[1] : null;
    }
    
    function extractYouTubeIdFront(url) {
      const m = url.match(/(?:youtube\\.com\\/watch\\?v=|youtu\\.be\\/|youtube\\.com\\/embed\\/|youtube\\.com\\/shorts\\/)([^&\\n?#]+)/);
      return m ? m[1] : null;
    }
    
    async function updateItemThumbnail(itemId, thumbnailUrl, title) {
      try {
        await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/items/' + itemId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ thumbnail_url: thumbnailUrl, title: title || '' })
        });
        
        // 제목도 업데이트
        if (title) {
          const titleEl = document.getElementById('title-' + itemId);
          if (titleEl && titleEl.textContent.startsWith('http')) {
            titleEl.textContent = title;
          }
        }
      } catch (e) {
        console.error('썸네일 업데이트 실패:', e);
      }
    }
    
    function initSortable() {
      const container = document.getElementById('playlist-items-container');
      if (!container || !window.Sortable) return;
      
      sortableInstance = new Sortable(container, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        onEnd: async function(evt) {
          // 순서 번호 업데이트 (UI)
          updateItemNumbers();
          
          // 서버에 순서 저장
          await saveItemOrder();
        }
      });
    }
    
    function updateItemNumbers() {
      const items = document.querySelectorAll('.playlist-item');
      items.forEach((item, index) => {
        const numberEl = item.querySelector('.item-number');
        if (numberEl) {
          numberEl.textContent = index + 1;
        }
      });
    }
    
    async function saveItemOrder() {
      const items = document.querySelectorAll('.playlist-item');
      const orderData = [];
      
      items.forEach((item, index) => {
        const id = parseInt(item.dataset.id);
        orderData.push({ id, sort_order: index + 1 });
      });
      
      // currentPlaylist.items 순서도 업데이트
      const newItems = [];
      items.forEach(item => {
        const id = parseInt(item.dataset.id);
        const found = currentPlaylist.items.find(i => i.id === id);
        if (found) newItems.push(found);
      });
      currentPlaylist.items = newItems;
      
      try {
        const res = await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/reorder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: orderData })
        });
        
        const data = await res.json();
        if (data.success) {
          showToast('순서가 저장되었습니다.');
        }
      } catch (e) {
        showToast('순서 저장 실패', 'error');
      }
    }
    
    function switchMediaTab(tab) {
      document.getElementById('tab-video').className = tab === 'video' 
        ? 'flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium transition'
        : 'flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition';
      document.getElementById('tab-image').className = tab === 'image'
        ? 'flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium transition'
        : 'flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition';
      
      document.getElementById('input-video').classList.toggle('hidden', tab !== 'video');
      document.getElementById('input-image').classList.toggle('hidden', tab !== 'image');
    }
    
    // 설정 패널 토글
    function togglePlaylistSettings() {
      const panel = document.getElementById('playlist-settings-panel');
      const icon = document.getElementById('settings-toggle-icon');
      panel.classList.toggle('hidden');
      icon.classList.toggle('fa-chevron-down');
      icon.classList.toggle('fa-chevron-up');
      if (typeof postParentHeight === 'function') {
        setTimeout(postParentHeight, 50);
        setTimeout(postParentHeight, 300);
      }
    }

    function toggleSettingsSection(key) {
      const panel = document.getElementById('settings-section-' + key);
      const icon = document.getElementById('settings-section-icon-' + key);
      if (!panel) return;
      panel.classList.toggle('hidden');
      if (icon) {
        icon.classList.toggle('fa-chevron-down');
        icon.classList.toggle('fa-chevron-up');
      }
      if (typeof postParentHeight === 'function') {
        setTimeout(postParentHeight, 50);
        setTimeout(postParentHeight, 300);
      }
    }
    
    // 라이브러리에 동영상 추가 (기존 addVideoItem 대체)
    async function addVideoToLibrary() {
      const url = document.getElementById('new-video-url').value.trim();
      if (!url) {
        showToast('동영상 URL을 입력해주세요.', 'error');
        return;
      }
      
      if (!url.includes('vimeo.com')) {
        showToast('Vimeo URL만 지원됩니다.', 'error');
        return;
      }
      
      try {
        const res = await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, add_to_playlist: false }) // 라이브러리에만 추가
        });
        
        const data = await res.json();
        
        if (data.success) {
          // 서버에서 최신 데이터 다시 가져오기 (activeItemIds는 로컬 유지)
          const playlistRes = await fetch(API_BASE + '/playlists/' + currentPlaylist.id);
          const playlistData = await playlistRes.json();
          const savedActiveIds = currentPlaylist.activeItemIds;
          currentPlaylist = playlistData.playlist;
          currentPlaylist.activeItemIds = savedActiveIds;
          
          renderLibraryOnly();
          _renderPlaylistOnly();
          document.getElementById('new-video-url').value = '';
          showToast('라이브러리에 추가되었습니다.');
        } else {
          showToast(data.error || '추가 실패', 'error');
        }
      } catch (e) {
        showToast('오류가 발생했습니다.', 'error');
      }
    }
    
    // 라이브러리에 이미지 추가
    async function addImageToLibrary() {
      const url = document.getElementById('new-image-url').value.trim();
      const displayTime = parseInt(document.getElementById('new-image-display-time').value) || 10;
      
      if (!url) {
        showToast('이미지 URL을 입력해주세요.', 'error');
        return;
      }
      
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        showToast('올바른 URL 형식을 입력해주세요.', 'error');
        return;
      }
      
      try {
        const res = await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            url, 
            item_type: 'image', 
            display_time: displayTime,
            add_to_playlist: false
          })
        });
        
        const data = await res.json();
        
        if (data.success) {
          // 서버에서 최신 데이터 다시 가져오기 (activeItemIds는 로컬 유지)
          const playlistRes = await fetch(API_BASE + '/playlists/' + currentPlaylist.id);
          const playlistData = await playlistRes.json();
          const savedActiveIds = currentPlaylist.activeItemIds;
          currentPlaylist = playlistData.playlist;
          currentPlaylist.activeItemIds = savedActiveIds;
          
          renderLibraryOnly();
          _renderPlaylistOnly();
          document.getElementById('new-image-url').value = '';
          showToast('라이브러리에 추가되었습니다.');
        } else {
          showToast(data.error || '추가 실패', 'error');
        }
      } catch (e) {
        showToast('오류가 발생했습니다.', 'error');
      }
    }
    
    // 라이브러리에서 플레이리스트로 아이템 추가
    function addToPlaylistFromLibrary(itemId) {
      if (!currentPlaylist) return;
      const sid = String(itemId);
      const allItems = [...(masterItemsCache || []), ...(currentPlaylist.items || [])];
      const item = allItems.find(i => String(i.id) === sid);
      if (!item) { console.warn('[Playlist] item not found:', itemId); return; }

      if (!Array.isArray(currentPlaylist.activeItemIds)) currentPlaylist.activeItemIds = [];

      // 이미 있으면 무시
      if (currentPlaylist.activeItemIds.some(id => String(id) === sid)) {
        showToast('이미 재생목록에 있습니다.');
        return;
      }

      // 항상 String 타입으로 통일 저장 (숫자 vs 문자열 불일치 방지)
      currentPlaylist.activeItemIds.push(sid);
      _renderPlaylistOnly();
      _updateLibraryPlusButtons();
      saveActiveItems().then(ok => {
        if (ok) showToast('재생목록에 추가되었습니다.');
        else showToast('저장 실패', 'error');
      });
    }
    
    // 플레이리스트에서 제거 - itemId 기반 (index는 DOM 재렌더 후 불일치 발생)
    function removeFromPlaylist(itemId) {
      if (!currentPlaylist || !Array.isArray(currentPlaylist.activeItemIds)) return;
      const sid = String(itemId);
      const before = currentPlaylist.activeItemIds.length;
      currentPlaylist.activeItemIds = currentPlaylist.activeItemIds.filter(
        id => String(id) !== sid
      );
      if (currentPlaylist.activeItemIds.length === before) {
        console.warn('[Playlist] removeFromPlaylist: item not found', itemId);
        return;
      }
      _renderPlaylistOnly();
      _updateLibraryPlusButtons();
      saveActiveItems().then(ok => {
        if (ok) showToast('재생목록에서 제거되었습니다.');
        else showToast('저장 실패', 'error');
      });
    }
    
    // 활성 아이템 목록 서버에 저장 (공용 영상 포함 모든 ID 저장)
    async function saveActiveItems() {
      // 모든 activeItemIds를 그대로 저장 (공용/사용자 모두 포함)
      const allItemIds = currentPlaylist.activeItemIds || [];
      
      try {
        const res = await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/active-items', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activeItemIds: allItemIds })
        });

        if (!res.ok) {
          console.error('[Playlist] Failed to save active items:', await res.text());
          return false;
        }

        console.log('[Playlist] Active items saved:', allItemIds);
        return true;
      } catch (e) {
        console.error('[Playlist] Failed to save active items:', e);
        return false;
      }
    }

    async function refreshCurrentPlaylist() {
      if (!currentPlaylist?.id) return;
      try {
        const res = await fetch(API_BASE + '/playlists/' + currentPlaylist.id);
        if (!res.ok) return;
        const data = await res.json();
        // activeItemIds는 로컬 상태 유지 (서버 응답으로 덮어쓰지 않음)
        const localActiveIds = currentPlaylist.activeItemIds;
        currentPlaylist = data.playlist;
        currentPlaylist.activeItemIds = localActiveIds;
        _renderPlaylistOnly();
        _updateLibraryPlusButtons();
      } catch (e) {
        console.error('[Playlist] Refresh failed:', e);
      }
    }
    
    // 플레이리스트 순서 저장 (기존 reorder API 사용)
    async function savePlaylistOrder() {
      // playlistOrder에 있는 아이템들의 sort_order를 업데이트
      const order = currentPlaylist.playlistOrder || [];
      const userItems = (currentPlaylist.items || []);
      
      // userItems 중에서 playlistOrder에 있는 것들만 순서 업데이트
      const itemsToReorder = order
        .map((id, index) => ({ id, sort_order: index }))
        .filter(item => userItems.some(ui => ui.id === item.id));
      
      if (itemsToReorder.length === 0) return;
      
      try {
        await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/reorder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsToReorder })
        });
        console.log('[Playlist] Order saved to server');
      } catch (e) {
        console.log('[Playlist] Order saved locally only');
      }
    }
    
    // 플레이리스트 활성 아이템 로드 (서버에서 받은 activeItemIds 사용)
    function loadPlaylistOrder() {
      const items = currentPlaylist.items || [];
      const masterItems = masterItemsCache || [];
      
      // 서버에서 받은 activeItemIds 그대로 사용 (하위 호환성은 서버에서 처리)
      // 빈 배열이면 플레이리스트도 비어있는 것
      currentPlaylist.activeItemIds = currentPlaylist.activeItemIds || [];
      console.log('[Playlist] Loaded activeItemIds:', currentPlaylist.activeItemIds);
    }
    
    // 라이브러리 전체 렌더 (공용영상 캐시 로드 포함) - 모달 열릴 때 1회만 호출
    async function renderLibraryAndPlaylist() {
      if (!currentPlaylist) return;

      const libraryMasterList = document.getElementById('library-master-list');
      const libraryUserList = document.getElementById('library-user-list');
      const playlistContainer = document.getElementById('playlist-items-container');
      const libraryMasterSection = document.getElementById('library-master-section');
      
      const items = currentPlaylist.items || [];
      const activeItemIds = Array.isArray(currentPlaylist.activeItemIds) ? currentPlaylist.activeItemIds : [];
      
      const editModal = document.getElementById('edit-playlist-modal');
      const isEditOpen = editModal && !editModal.classList.contains('hidden');

      // 공용 영상 로드 (캐시 우선, 없을 때만 네트워크)
      if (!masterItemsCache || masterItemsCache.length === 0) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        try {
          const baseUrl = window.location.origin;
          const cacheBuster = isEditOpen ? ('?ts=' + Date.now()) : '';
          const res = await fetch(baseUrl + '/api/master/items' + cacheBuster, { cache: 'no-store', signal: controller.signal });
          if (res.ok) {
            const data = await res.json();
            masterItemsCache = data.items || [];
            cachedMasterItems = masterItemsCache;
          } else {
            masterItemsCache = cachedMasterItems || masterItemsCache || [];
          }
        } catch (e) {
          masterItemsCache = cachedMasterItems || masterItemsCache || [];
        } finally {
          clearTimeout(timeoutId);
        }
      }

      
      // 라이브러리: 공용 영상
      if (masterItemsCache && masterItemsCache.length > 0 && libraryMasterSection) {
        libraryMasterSection.classList.remove('hidden');
        libraryMasterList.innerHTML = masterItemsCache.map(item => \`
          <div class="flex items-center gap-2 p-2 bg-purple-100 rounded cursor-pointer hover:bg-purple-200 transition"
               data-library-id="\${item.id}" data-library-master="1"
               onclick="addToPlaylistFromLibrary(\${item.id})">
            <div class="w-16 h-10 bg-purple-200 rounded overflow-hidden flex-shrink-0">
              \${item.thumbnail_url 
                ? \`<img src="\${item.thumbnail_url}" class="w-full h-full object-cover">\`
                : \`<div class="w-full h-full flex items-center justify-center"><i class="fab fa-\${item.item_type} text-purple-400"></i></div>\`
              }
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-purple-800 truncate">\${item.title || item.url}</p>
              <p class="text-xs text-purple-500"><i class="fas fa-crown mr-1"></i>공용</p>
            </div>
            <i class="fas fa-plus text-purple-400"></i>
          </div>
        \`).join('');
      } else if (libraryMasterSection) {
        libraryMasterSection.classList.add('hidden');
      }
      
      // 라이브러리: 내 영상
      if (items.length > 0) {
        libraryUserList.innerHTML = items.map(item => \`
          <div class="flex items-center gap-2 p-2 bg-gray-100 rounded hover:bg-blue-100 transition group" data-library-id="\${item.id}" data-library-master="0">
            <div class="w-16 h-10 bg-gray-200 rounded overflow-hidden flex-shrink-0 cursor-pointer"
                 onclick="addToPlaylistFromLibrary(\${item.id})">
              \${item.item_type === 'image'
                ? \`<img src="\${item.url}" class="w-full h-full object-cover">\`
                : item.thumbnail_url 
                  ? \`<img src="\${item.thumbnail_url}" class="w-full h-full object-cover">\`
                  : \`<div class="w-full h-full flex items-center justify-center"><i class="fab fa-\${item.item_type} \${item.item_type === 'youtube' ? 'text-red-500' : 'text-blue-400'}"></i></div>\`
              }
            </div>
            <div class="flex-1 min-w-0 cursor-pointer" data-item-id="\${item.id}" onclick="editItemTitleById(this.dataset.itemId)">
              <p class="text-xs font-medium text-gray-800 truncate hover:text-blue-600" title="클릭하여 제목 수정">\${item.title || item.url}</p>
              <p class="text-xs text-gray-500">
                \${item.item_type === 'youtube' ? '<i class="fab fa-youtube text-red-500"></i>' : 
                  item.item_type === 'vimeo' ? '<i class="fab fa-vimeo text-blue-400"></i>' : 
                  '<i class="fas fa-image text-green-400"></i>'}
                <i class="fas fa-pencil-alt ml-1 text-gray-400 text-xs"></i>
              </p>
            </div>
            <button onclick="addToPlaylistFromLibrary(\${item.id})" 
                    class="text-gray-400 hover:text-blue-500 p-1" title="재생목록에 추가">
              <i class="fas fa-plus"></i>
            </button>
            <button onclick="deletePlaylistItem(\${item.id})" 
                    class="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100" title="삭제">
              <i class="fas fa-trash text-xs"></i>
            </button>
          </div>
        \`).join('');
      } else {
        libraryUserList.innerHTML = '<div class="text-center py-4 text-gray-400 text-xs">영상을 추가하세요</div>';
      }

      renderLibrarySearchResults();
      
      // 플레이리스트 순서대로 렌더링
      const allItems = [...masterItemsCache, ...items];
      const playlistItems = activeItemIds
        .map(id => allItems.find(item => String(item.id) === String(id)))
        .filter(item => item);
      
      // 플레이리스트 카운트 업데이트
      const countEl = document.getElementById('playlist-count');
      if (countEl) countEl.textContent = playlistItems.length + '개';
      
      if (playlistItems.length === 0) {
        playlistContainer.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">왼쪽 라이브러리에서 영상을 클릭하여 추가하세요</div>';
        return;
      }
      
      playlistContainer.innerHTML = playlistItems.map((item, index) => \`
        <div class="flex items-center gap-2 p-2 \${item.is_master ? 'bg-purple-50 border border-purple-200' : 'bg-green-50 border border-green-200'} rounded group"
             data-playlist-index="\${index}" data-id="\${item.id}" data-master="\${item.is_master ? 1 : 0}">
          <div class="drag-handle text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
            <i class="fas fa-grip-vertical"></i>
          </div>
          <span class="text-sm font-bold \${item.is_master ? 'text-purple-500' : 'text-green-600'} w-6">\${index + 1}</span>
          <div class="w-14 h-9 bg-gray-200 rounded overflow-hidden flex-shrink-0">
            \${item.item_type === 'image'
              ? \`<img src="\${item.url}" class="w-full h-full object-cover">\`
              : item.thumbnail_url 
                ? \`<img src="\${item.thumbnail_url}" class="w-full h-full object-cover">\`
                : \`<div class="w-full h-full flex items-center justify-center"><i class="fab fa-\${item.item_type} text-gray-400"></i></div>\`
            }
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium text-gray-800 truncate">\${item.title || item.url}</p>
          </div>
          <button onclick="removeFromPlaylist('\${item.id}')" 
                  class="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100">
            <i class="fas fa-times"></i>
          </button>
        </div>
      \`).join('');
      
      // Sortable 초기화 (플레이리스트 에디터 내 영상 순서)
      initPlaylistItemsSortable();
      // 라이브러리 + 버튼 상태 초기화
      _updateLibraryPlusButtons();
    }

    // 플레이리스트 오른쪽만 동기 렌더 (추가/제거 시 즉시 호출)
    function _renderPlaylistOnly() {
      if (!currentPlaylist) return;
      const playlistContainer = document.getElementById('playlist-items-container');
      if (!playlistContainer) return;
      const activeItemIds = Array.isArray(currentPlaylist.activeItemIds) ? currentPlaylist.activeItemIds : [];
      const items = currentPlaylist.items || [];
      const allItems = [...(masterItemsCache || []), ...items];
      const playlistItems = activeItemIds
        .map(id => allItems.find(item => String(item.id) === String(id)))
        .filter(item => item);
      const countEl = document.getElementById('playlist-count');
      if (countEl) countEl.textContent = playlistItems.length + '개';
      if (playlistItems.length === 0) {
        playlistContainer.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">왼쪽 라이브러리에서 영상을 클릭하여 추가하세요</div>';
        return;
      }
      playlistContainer.innerHTML = playlistItems.map((item, index) => \`
        <div class="flex items-center gap-2 p-2 \${item.is_master ? 'bg-purple-50 border border-purple-200' : 'bg-green-50 border border-green-200'} rounded group"
             data-playlist-index="\${index}" data-id="\${item.id}" data-master="\${item.is_master ? 1 : 0}">
          <div class="drag-handle text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
            <i class="fas fa-grip-vertical"></i>
          </div>
          <span class="text-sm font-bold \${item.is_master ? 'text-purple-500' : 'text-green-600'} w-6">\${index + 1}</span>
          <div class="w-14 h-9 bg-gray-200 rounded overflow-hidden flex-shrink-0">
            \${item.item_type === 'image'
              ? \`<img src="\${item.url}" class="w-full h-full object-cover">\`
              : item.thumbnail_url
                ? \`<img src="\${item.thumbnail_url}" class="w-full h-full object-cover">\`
                : \`<div class="w-full h-full flex items-center justify-center"><i class="fab fa-\${item.item_type} text-gray-400"></i></div>\`
            }
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium text-gray-800 truncate">\${item.title || item.url}</p>
          </div>
          <button onclick="removeFromPlaylist('\${item.id}')"
                  class="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100">
            <i class="fas fa-times"></i>
          </button>
        </div>
      \`).join('');
      initPlaylistItemsSortable();
    }

    // 라이브러리의 + 버튼 상태 업데이트 (렌더 후 호출)
    function _updateLibraryPlusButtons() {
      if (!currentPlaylist) return;
      const activeIds = (currentPlaylist.activeItemIds || []).map(id => String(id));
      // 공용 영상
      document.querySelectorAll('[data-library-id][data-library-master="1"]').forEach(el => {
        const id = String(el.getAttribute('data-library-id'));
        const inPlaylist = activeIds.includes(id);
        el.style.opacity = inPlaylist ? '0.5' : '';
        el.style.pointerEvents = inPlaylist ? 'none' : '';
        const icon = el.querySelector('i');
        if (icon) icon.className = inPlaylist ? 'fas fa-check text-green-500' : 'fas fa-plus text-purple-400';
      });
      // 내 영상
      document.querySelectorAll('[data-library-id][data-library-master="0"]').forEach(el => {
        const id = String(el.getAttribute('data-library-id'));
        const inPlaylist = activeIds.includes(id);
        const btn = el.querySelector('button[title="재생목록에 추가"]');
        if (btn) {
          btn.innerHTML = inPlaylist ? '<i class="fas fa-check text-green-500"></i>' : '<i class="fas fa-plus"></i>';
          btn.disabled = inPlaylist;
        }
      });
    }

    // 라이브러리 왼쪽 패널만 렌더 (자동 리프레시 시 플레이리스트는 건드리지 않음)
    function renderLibraryOnly() {
      if (!currentPlaylist) return;
      const libraryMasterList = document.getElementById('library-master-list');
      const libraryUserList = document.getElementById('library-user-list');
      const libraryMasterSection = document.getElementById('library-master-section');
      const items = currentPlaylist.items || [];

      if (masterItemsCache && masterItemsCache.length > 0 && libraryMasterSection) {
        libraryMasterSection.classList.remove('hidden');
        libraryMasterList.innerHTML = masterItemsCache.map(item => \`
          <div class="flex items-center gap-2 p-2 bg-purple-100 rounded cursor-pointer hover:bg-purple-200 transition"
               data-library-id="\${item.id}" data-library-master="1"
               onclick="addToPlaylistFromLibrary(\${item.id})">
            <div class="w-16 h-10 bg-purple-200 rounded overflow-hidden flex-shrink-0">
              \${item.thumbnail_url
                ? \`<img src="\${item.thumbnail_url}" class="w-full h-full object-cover">\`
                : \`<div class="w-full h-full flex items-center justify-center"><i class="fab fa-\${item.item_type} text-purple-400"></i></div>\`
              }
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-purple-800 truncate">\${item.title || item.url}</p>
              <p class="text-xs text-purple-500"><i class="fas fa-crown mr-1"></i>공용</p>
            </div>
            <i class="fas fa-plus text-purple-400"></i>
          </div>
        \`).join('');
      } else if (libraryMasterSection) {
        libraryMasterSection.classList.add('hidden');
      }

      if (items.length > 0 && libraryUserList) {
        libraryUserList.innerHTML = items.map(item => \`
          <div class="flex items-center gap-2 p-2 bg-gray-100 rounded hover:bg-blue-100 transition group" data-library-id="\${item.id}" data-library-master="0">
            <div class="w-16 h-10 bg-gray-200 rounded overflow-hidden flex-shrink-0 cursor-pointer"
                 onclick="addToPlaylistFromLibrary(\${item.id})">
              \${item.item_type === 'image'
                ? \`<img src="\${item.url}" class="w-full h-full object-cover">\`
                : item.thumbnail_url
                  ? \`<img src="\${item.thumbnail_url}" class="w-full h-full object-cover">\`
                  : \`<div class="w-full h-full flex items-center justify-center"><i class="fab fa-\${item.item_type} \${item.item_type === 'youtube' ? 'text-red-500' : 'text-blue-400'}"></i></div>\`
              }
            </div>
            <div class="flex-1 min-w-0 cursor-pointer" data-item-id="\${item.id}" onclick="editItemTitleById(this.dataset.itemId)">
              <p class="text-xs font-medium text-gray-800 truncate hover:text-blue-600">\${item.title || item.url}</p>
              <p class="text-xs text-gray-500">
                \${item.item_type === 'youtube' ? '<i class="fab fa-youtube text-red-500"></i>' :
                  item.item_type === 'vimeo' ? '<i class="fab fa-vimeo text-blue-400"></i>' :
                  '<i class="fas fa-image text-green-400"></i>'}
              </p>
            </div>
            <button onclick="addToPlaylistFromLibrary(\${item.id})"
                    class="text-gray-400 hover:text-blue-500 p-1" title="재생목록에 추가">
              <i class="fas fa-plus"></i>
            </button>
            <button onclick="deletePlaylistItem(\${item.id})"
                    class="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100" title="삭제">
              <i class="fas fa-trash text-xs"></i>
            </button>
          </div>
        \`).join('');
      }
      _updateLibraryPlusButtons();
    }

    // 영상 제목 수정 (ID로 아이템 찾아서 수정)
    async function editItemTitleById(itemId) {
      console.log('[EditTitle] itemId:', itemId, 'currentPlaylist:', currentPlaylist);
      const id = parseInt(itemId);
      const item = currentPlaylist.items.find(i => i.id === id);
      console.log('[EditTitle] Found item:', item);
      if (!item) {
        showToast('아이템을 찾을 수 없습니다.', 'error');
        return;
      }
      
      const currentTitle = item.title || item.url;
      const newTitle = prompt('영상 제목을 입력하세요:', currentTitle);
      console.log('[EditTitle] newTitle:', newTitle, 'currentTitle:', currentTitle);
      if (newTitle === null || newTitle.trim() === currentTitle) return;
      
      try {
        const res = await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/items/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle.trim() })
        });
        
        if (res.ok) {
          // 로컬 데이터 업데이트
          item.title = newTitle.trim();
          renderLibraryAndPlaylist();
          showToast('제목이 수정되었습니다.');
        } else {
          showToast('수정 실패', 'error');
        }
      } catch (e) {
        console.error('Title edit error:', e);
        showToast('오류가 발생했습니다.', 'error');
      }
    }
    
    // 플레이리스트 에디터 내 영상 순서 Sortable 초기화 (playlistItemsSortableInstance는 JS 블록 상단에 선언됨)
    function initPlaylistItemsSortable() {
      const container = document.getElementById('playlist-items-container');
      if (playlistItemsSortableInstance) {
        playlistItemsSortableInstance.destroy();
      }
      
      playlistItemsSortableInstance = new Sortable(container, {
        animation: 150,
        handle: '.drag-handle',
        onEnd: function(evt) {
          if (evt.oldIndex === evt.newIndex) return;
          const activeIds = (currentPlaylist.activeItemIds || []).map(id => String(id));
          const [moved] = activeIds.splice(evt.oldIndex, 1);
          activeIds.splice(evt.newIndex, 0, moved);
          currentPlaylist.activeItemIds = activeIds;
          _renderPlaylistOnly();
          saveActiveItems();
        }
      });
    }
    
    async function addVideoItem() {
      await addVideoToLibrary();
    }
    
    async function addImageItem() {
      await addImageToLibrary();
    }
    
    async function deletePlaylistItem(itemId) {
      try {
        const res = await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/items/' + itemId, {
          method: 'DELETE'
        });
        
        if (!res.ok) {
          throw new Error('삭제 실패');
        }
        
        // 서버에서 최신 데이터 다시 가져오기 (activeItemIds에서도 해당 항목 제거)
        const playlistRes = await fetch(API_BASE + '/playlists/' + currentPlaylist.id);
        const data = await playlistRes.json();
        // activeItemIds에서 삭제된 항목 제거
        const prevActiveIds = (currentPlaylist.activeItemIds || [])
          .map(id => String(id))
          .filter(id => id !== String(itemId));
        currentPlaylist = data.playlist;
        currentPlaylist.activeItemIds = prevActiveIds;
        
        // 공용 영상 캐시도 새로 로드
        masterItemsCache = null;
        
        // 2컬럼 레이아웃 또는 기존 레이아웃 렌더링
        if (document.getElementById('library-master-list')) {
          await renderLibraryAndPlaylist();
        } else {
          renderPlaylistItems();
        }
        loadPlaylists();
        showToast('삭제되었습니다.');
      } catch (e) {
        showToast('삭제 실패', 'error');
      }
    }
    
    async function updateItemDisplayTime(itemId, time) {
      try {
        await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/items/' + itemId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ display_time: parseInt(time) })
        });
        showToast('저장되었습니다.');
      } catch (e) {
        showToast('저장 실패', 'error');
      }
    }
    
    async function shortenUrl(playlistId, currentCode) {
      if (currentCode.length <= 5) {
        showToast('이미 최단 URL입니다.');
        return;
      }
      
      if (!confirm('URL을 5자리로 단축하시겠습니까?\\n기존 URL(' + currentCode + ')은 더 이상 작동하지 않습니다.')) {
        return;
      }
      
      try {
        const res = await fetch(API_BASE + '/playlists/' + playlistId + '/shorten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!res.ok) throw new Error('단축 실패');
        
        const data = await res.json();
        showToast('URL이 단축되었습니다: ' + data.short_code);
        
        // UI 업데이트
        await loadPlaylists();
        
      } catch (e) {
        showToast('단축 실패: ' + e.message, 'error');
      }
    }
    
    // TV 코드 생성
    async function generateTvCode(playlistId) {
      const codeEl = document.getElementById('tv-code-' + playlistId);
      
      try {
        const res = await fetch('/api/playlist/' + playlistId + '/tv-code', {
          method: 'POST'
        });
        
        if (res.ok) {
          const data = await res.json();
          if (codeEl) {
            codeEl.textContent = data.tvCode;
            codeEl.classList.add('animate-pulse');
            setTimeout(() => codeEl.classList.remove('animate-pulse'), 1000);
          }
          showToast('TV 코드: ' + data.tvCode + ' (TV에서 /tv 접속 후 입력)');
        } else {
          throw new Error('코드 생성 실패');
        }
      } catch (e) {
        showToast('TV 코드 생성 실패', 'error');
      }
    }
    
    async function createShortUrl(url, playlistId) {
      // generateShortUrl로 위임
      const playlist = playlists.find(p => p.id == playlistId);
      const shortCode = playlist ? playlist.short_code : '';
      await generateShortUrl(playlistId, shortCode);
    }
    
    // USB 북마크 파일 다운로드
    // 바로가기 명령어 복사
    function copyShortcutCommand() {
      const cmd = document.getElementById('shortcut-command').textContent;
      navigator.clipboard.writeText(cmd);
      showToast('📋 명령어가 복사되었습니다');
    }
    
    // 바로가기 가이드 모달 열 때 URL 목록 업데이트
    function showShortcutGuide() {
      closeModal('script-download-modal');
      
      // 첫 번째 체어 명령어 업데이트
      if (playlists.length > 0) {
        document.getElementById('shortcut-command').textContent = 
          'chrome --kiosk "' + location.origin + '/' + playlists[0].short_code + '"';
      }
      
      // 모든 체어 URL 목록 업데이트
      const urlsDiv = document.getElementById('all-chair-urls');
      urlsDiv.innerHTML = playlists.map(p => 
        '<div class="flex justify-between items-center py-1 border-b border-purple-100">' +
        '<span class="text-purple-700">' + p.name + ':</span>' +
        '<span class="text-gray-600">' + location.origin + '/' + p.short_code + '</span>' +
        '</div>'
      ).join('');
      
      openModal('shortcut-guide-modal');
    }
    
    function downloadBookmark(name, url, shortCode, variant = 'universal') {
      const safeName = (name || '치과TV').replace(/[^a-zA-Z0-9가-힣]/g, '_');
      const profiles = {
        universal: { label: '공통', fileSuffix: '', fontSize: 18, buttonSize: 18, fontFamily: 'Arial, sans-serif' },
        samsung: { label: 'Samsung', fileSuffix: '_Samsung', fontSize: 22, buttonSize: 22, fontFamily: 'SamsungOne, Arial, sans-serif' },
        lg: { label: 'LG', fileSuffix: '_LG', fontSize: 22, buttonSize: 22, fontFamily: 'LG Smart, Arial, sans-serif' },
        android: { label: 'Android TV', fileSuffix: '_AndroidTV', fontSize: 22, buttonSize: 22, fontFamily: 'Roboto, Arial, sans-serif' }
      };
      const profile = profiles[variant] || profiles.universal;
      const noteSize = Math.max(12, profile.fontSize - 6);
      const bookmarkHtmlTv = [
        '<!doctype html>',
        '<html lang="ko">',
        '<head>',
        '  <meta charset="UTF-8">',
        '  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
        '  <title>' + safeName + ' - 치과TV (' + profile.label + ')</title>',
        '  <style>',
        '    body { font-family: ' + profile.fontFamily + '; text-align: center; padding: 32px; font-size: ' + profile.fontSize + 'px; }',
        '    a { display: inline-block; padding: 16px 28px; background: #2563eb; color: #fff; border-radius: 12px; text-decoration: none; font-size: ' + profile.buttonSize + 'px; }',
        '    p { color: #555; margin-top: 12px; }',
        '    .note { margin-top: 14px; color: #92400e; font-size: ' + noteSize + 'px; }',
        '  </style>',
        '</head>',
        '<body>',
        '  <h2>' + safeName + ' - 치과TV (' + profile.label + ')</h2>',
        '  <a href="' + url + '">TV 화면 열기</a>',
        '  <p>링크가 안 열리면 주소창에 아래 URL을 입력하세요.</p>',
        '  <p style="font-family: monospace;">' + url + '</p>',
        '  <p class="note">파일이 TV에서 열리지 않으면 <strong>단축 URL을 직접 입력</strong>해 주세요.</p>',
        '</body>',
        '</html>'
      ].join('\\n');

      const blob = new Blob(['\ufeff' + bookmarkHtmlTv], { type: 'text/html;charset=utf-8' });
      const downloadUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = '치과TV_' + safeName + profile.fileSuffix + '.htm';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      
      showToast('📁 TV 전용 HTML(.htm) 다운로드 완료!\\nUSB에 복사 후 TV에서 열기');
    }
    
    // =========================================================
    // URL 바로가기 파일 다운로드 (.url 형식)
    // - Windows 인터넷 바로가기 형식
    // - 일부 스마트 TV에서 지원
    // =========================================================
    function downloadUrlFile(name, url) {
      const today = new Date().toLocaleDateString('ko-KR');
      // Windows 인터넷 바로가기 형식 (.url)
      let urlContent = '[InternetShortcut]\\n';
      urlContent += 'URL=' + url + '\\n';
      urlContent += '; =========================================================\\n';
      urlContent += '; 치과 TV URL 바로가기 - ' + name + '\\n';
      urlContent += '; 생성일: ' + today + '\\n';
      urlContent += '; ---------------------------------------------------------\\n';
      urlContent += '; [사용 방법]\\n';
      urlContent += '; 1. 이 파일을 USB에 복사\\n';
      urlContent += '; 2. TV USB 포트에 연결\\n';
      urlContent += '; 3. TV 파일 탐색기에서 이 파일 실행\\n';
      urlContent += '; =========================================================\\n';
      
      const blob = new Blob([urlContent.replace(/\\\\n/g, '\\r\\n')], { type: 'text/plain' });
      const downloadUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = '치과TV_' + name.replace(/[^a-zA-Z0-9가-힣]/g, '_') + '.url';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      
      showToast('📁 URL 바로가기 다운로드 완료!\\nUSB에 복사 후 TV에서 열기');
    }
    
    // =========================================================
    // 단축 URL 생성 (is.gd API 사용)
    // - TV 리모컨으로 입력하기 쉬운 짧은 URL 생성
    // - 대기실 TV에 유용
    // =========================================================
    async function generateShortUrl(playlistId, shortCode) {
      try {
        showToast('단축 URL 생성 중...', 'info');
        
        // 서버 API를 통해 단축 URL 생성
        const res = await fetch(API_BASE + '/playlists/' + playlistId + '/external-shorten', {
          method: 'POST'
        });
        
        const data = await res.json();
        
        if (data.success && data.shortUrl) {
          const shortUrlDisplay = data.shortUrl.replace('https://', '');
          
          // 모든 관련 입력창 업데이트
          updateAllUrlDisplays(playlistId, shortUrlDisplay, data.shortUrl);
          
          // 클립보드 복사 (iframe 환경에서 실패해도 무시)
          try {
            await navigator.clipboard.writeText(data.shortUrl);
            showToast('✅ 단축 URL 생성 완료! ' + shortUrlDisplay + ' (클립보드 복사됨)', 'success', 5000);
          } catch (clipErr) {
            showToast('✅ 단축 URL 생성 완료! ' + shortUrlDisplay, 'success', 5000);
          }
        } else {
          showToast('단축 URL 생성 실패: ' + (data.error || ''), 'error');
        }
      } catch (e) {
        console.error('단축 URL 생성 오류:', e);
        showToast('단축 URL 생성 실패: ' + e.message, 'error');
      }
    }
    
    // 모든 URL 표시 영역 업데이트
    function updateAllUrlDisplays(playlistId, shortUrlDisplay, fullUrl) {
      // 1. 초기 설정 섹션 입력창
      const settingInputEl = document.getElementById('setting-url-' + playlistId);
      if (settingInputEl) {
        settingInputEl.value = shortUrlDisplay;
      }
      
      // 2. 전체 목록 div
      const mainDivEl = document.getElementById('tv-short-url-' + playlistId);
      if (mainDivEl) {
        mainDivEl.textContent = shortUrlDisplay;
        mainDivEl.setAttribute('data-url', fullUrl);
      }
      
      // 3. 팝업창 (열려있다면)
      const guideUrlEl = document.getElementById('guide-short-url');
      if (guideUrlEl && newlyCreatedPlaylist && newlyCreatedPlaylist.id == playlistId) {
        guideUrlEl.textContent = shortUrlDisplay;
      }
      
      // 4. 'TV 설정 필요' 배지 제거
      const badgeEl = document.getElementById('badge-setup-' + playlistId);
      if (badgeEl) badgeEl.remove();
      
      // 5. '단축 URL 생성' 버튼 제거
      const btnShortenEl = document.getElementById('btn-shorten-' + playlistId);
      if (btnShortenEl) btnShortenEl.remove();
    }
    
    // 초기 설정 섹션 URL 복사
    function copySettingUrl(playlistId) {
      const inputEl = document.getElementById('setting-url-' + playlistId);
      if (inputEl) {
        const url = inputEl.value.startsWith('http') ? inputEl.value : 'https://' + inputEl.value;
        navigator.clipboard.writeText(url);
        showToast('URL이 복사되었습니다!');
      }
    }
    
    // 전체 자동 실행 스크립트 다운로드
    // 모달용 선택 체어 저장 변수
    var selectedChairsForModal = [];

    function downloadAutoRunScript(btnEl) {
      if (playlists.length === 0) {
        showToast('체어를 먼저 추가해주세요', 'error', 1200, btnEl);
        return;
      }
      const selected = getSelectedChairs();
      if (selected.length === 0) {
        showToast('체어를 먼저 선택하세요', 'error', 1200, btnEl);
        return;
      }
      // 선택 체어를 전역에 저장해서 모달 안에서도 사용
      selectedChairsForModal = selected;
      showScriptDownloadModal();
    }
    
    // 스크립트 전용 모달 표시 (openModal 사용 안 함 - iframe 위치 독립적)
    function _showScriptModal(el) {
      if (!el) return;
      if (el.parentElement !== document.body) document.body.appendChild(el);
      // iframe 내부를 스크롤 최상단으로
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      // iframePageTop: 위젯에서 받은 iframe의 페이지 내 top (= 아임웹 헤더 높이)
      // 이 값만큼 top을 내려야 모달이 iframe 뷰포트 최상단에 표시됨
      var topVal = (iframePageTop > 0 && iframePageTop < 300) ? iframePageTop : 0;
      el.style.cssText = 'display:flex !important; position:fixed; top:' + topVal + 'px; left:0; right:0; bottom:0; width:100%; z-index:99999; align-items:flex-start; justify-content:center; padding-top:40px; box-sizing:border-box;';
      document.body.classList.add('modal-open');
      // 부모(아임웹)에 iframe 높이 확보 + 스크롤 최상단 요청
      try {
        if (window.parent && window.parent !== window) {
          var h = Math.max(Math.round(window.screen.height * 0.92), 700);
          window.parent.postMessage({ type: 'setHeight', height: h }, '*');
          window.parent.postMessage({ type: 'scrollToTop' }, '*');
        }
      } catch(e) {}
    }

    // 스크립트 다운로드 모달 표시 (설치 방법 안내용)
    function showScriptDownloadModal() {
      _showScriptModal(document.getElementById('script-download-modal'));
    }
    
    // 선택된 체어의 링크 복사
    function copyInstallLink() {
      const selected = selectedChairsForModal.length > 0 ? selectedChairsForModal : getSelectedChairs();
      if (selected.length === 0) {
        showToast('체어를 선택해주세요', 'error');
        return;
      }
      const links = selected.map(c => location.origin + '/' + c.code).join('\\n');
      navigator.clipboard.writeText(links).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = links;
        ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch(e) {}
        document.body.removeChild(ta);
      });
      showToast(selected.length + '개 체어 URL 복사됨');
    }
    
    // 선택된 체어의 스크립트 다운로드
    function downloadInstallScript() {
      const selected = selectedChairsForModal.length > 0 ? selectedChairsForModal : getSelectedChairs();
      const scriptType = document.querySelector('input[name="script-type"]:checked').value;
      
      if (selected.length === 0) {
        showToast('체어를 먼저 선택하세요', 'error');
        return;
      }
      
      if (scriptType === 'vbs') {
        selected.forEach(c => downloadSingleVbs(c.code, c.name));
      } else {
        selected.forEach(c => downloadSingleScript(c.code, c.name));
      }
      showToast(selected.length + '개 스크립트 다운로드');
    }
    
    // 개별 스크립트 다운로드 (설명 포함)
    function downloadSingleScript(shortCode, name) {
      const today = new Date().toLocaleDateString('ko-KR');
      const url = location.origin + '/' + shortCode;
      let batContent = '@echo off\\n';
      batContent += 'chcp 65001 > nul\\n';
      batContent += 'REM =========================================================\\n';
      batContent += 'REM 치과 TV 개별 스크립트 - ' + name + '\\n';
      batContent += 'REM ---------------------------------------------------------\\n';
      batContent += 'REM 생성일: ' + today + '\\n';
      batContent += 'REM URL: ' + url + '\\n';
      batContent += 'REM ---------------------------------------------------------\\n';
      batContent += 'REM [사용 방법]\\n';
      batContent += 'REM 1. 이 파일을 더블클릭하면 크롬 전체화면이 열립니다\\n';
      batContent += 'REM 2. ESC 키로 전체화면 해제, 화면 클릭으로 다시 전체화면\\n';
      batContent += 'REM ---------------------------------------------------------\\n';
      batContent += 'REM [자동 실행 설정]\\n';
      batContent += 'REM Win+R -> shell:startup -> 이 파일을 복사\\n';
      batContent += 'REM PC 부팅 시 자동으로 TV 화면이 실행됩니다\\n';
      batContent += 'REM =========================================================\\n\\n';
      batContent += 'echo ' + name + ' TV 화면을 실행합니다...\\n';
      batContent += 'start "" chrome --kiosk "' + url + '"\\n';
      
      const blob = new Blob([batContent.replace(/\\\\n/g, '\\r\\n')], { type: 'text/plain' });
      const downloadUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = '치과TV_' + name.replace(/[^a-zA-Z0-9가-힣]/g, '_') + '.bat';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      
      showToast('✅ ' + name + ' 스크립트 다운로드 완료');
    }
    
    // 개별 설치 모달 표시
    function showIndividualInstall() {
      const container = document.getElementById('individual-chair-scripts');
      if (!container) return;
      
      container.innerHTML = playlists.map((p, idx) => {
        const url = location.origin + '/' + p.short_code;
        return '<div class="bg-orange-50 border border-orange-200 rounded-lg p-3">' +
          '<div class="flex items-center justify-between">' +
            '<div class="flex items-center gap-2">' +
              '<span class="bg-orange-500 text-white text-xs px-2 py-1 rounded-full">' + (idx + 1) + '</span>' +
              '<span class="font-bold text-orange-800">' + p.name + '</span>' +
            '</div>' +
            '<div class="flex gap-1">' +
              '<button onclick="downloadSingleScript(\\'' + p.short_code + '\\', \\'' + p.name + '\\')" class="bg-blue-500 text-white text-xs px-3 py-1 rounded hover:bg-blue-600">BAT</button>' +
              '<button onclick="downloadSingleVbs(\\'' + p.short_code + '\\', \\'' + p.name + '\\')" class="bg-green-500 text-white text-xs px-3 py-1 rounded hover:bg-green-600">VBS</button>' +
            '</div>' +
          '</div>' +
          '<p class="text-xs text-gray-500 mt-2 break-all">' + url + '</p>' +
        '</div>';
      }).join('');
      
      openModal('individual-install-modal');
    }
    
    // 개별 VBS 다운로드 (설명 포함)
    function downloadSingleVbs(shortCode, name) {
      const today = new Date().toLocaleDateString('ko-KR');
      const url = location.origin + '/' + shortCode;
      let vbsContent = "'=========================================================\\n";
      vbsContent += "' 치과 TV 개별 스크립트 - " + name + "\\n";
      vbsContent += "'---------------------------------------------------------\\n";
      vbsContent += "' 생성일: " + today + "\\n";
      vbsContent += "' URL: " + url + "\\n";
      vbsContent += "'---------------------------------------------------------\\n";
      vbsContent += "' [사용 방법]\\n";
      vbsContent += "' 1. 이 파일을 더블클릭하면 크롬 전체화면이 열립니다\\n";
      vbsContent += "' 2. ESC 키로 전체화면 해제, 화면 클릭으로 다시 전체화면\\n";
      vbsContent += "'---------------------------------------------------------\\n";
      vbsContent += "' [자동 실행 설정] Win+R -> shell:startup -> 이 파일 복사\\n";
      vbsContent += "' (백신이 BAT 파일 차단 시 이 VBS 파일 사용)\\n";
      vbsContent += "'=========================================================\\n\\n";
      vbsContent += 'CreateObject("WScript.Shell").Run "chrome --kiosk ""' + url + '"""\\n';
      
      const blob = new Blob([vbsContent.replace(/\\\\n/g, '\\r\\n')], { type: 'text/plain' });
      const downloadUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = '치과TV_' + name.replace(/[^a-zA-Z0-9가-힣]/g, '_') + '.vbs';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      
      showToast('✅ ' + name + ' VBS 스크립트 다운로드 완료');
    }
    
    // =========================================================
    // 네트워크 통합 관리 기능 (로컬 네트워크 IP 방식)
    // - 데스크 PC에서 같은 네트워크의 모든 체어 PC를 관리
    // =========================================================
    
    // 네트워크 관리용 BAT 파일 다운로드 (체어 PC가 아닌 데스크 PC에서 모든 체어 URL 열기)
    function downloadNetworkManageBat() {
      const today = new Date().toLocaleDateString('ko-KR');
      const chairs = playlists;
      
      let batContent = '@echo off\\n';
      batContent += 'chcp 65001 > nul\\n';
      batContent += 'REM =========================================================\\n';
      batContent += 'REM 치과 TV 통합 관리 스크립트 (로컬 네트워크)\\n';
      batContent += 'REM ---------------------------------------------------------\\n';
      batContent += 'REM 생성일: ' + today + '\\n';
      batContent += 'REM 체어 수: ' + chairs.length + '개\\n';
      batContent += 'REM ---------------------------------------------------------\\n';
      batContent += 'REM [이 스크립트의 용도]\\n';
      batContent += 'REM - 데스크 PC에서 모든 체어 TV URL을 한번에 열기\\n';
      batContent += 'REM - 모니터링 및 테스트 용도\\n';
      batContent += 'REM ---------------------------------------------------------\\n';
      batContent += 'REM [실제 운영 시 주의]\\n';
      batContent += 'REM - 실제로는 각 체어 PC에 개별 스크립트 설치 필요\\n';
      batContent += 'REM - 이 스크립트는 데스크 PC에서 확인용\\n';
      batContent += 'REM =========================================================\\n\\n';
      batContent += 'echo =========================================================\\n';
      batContent += 'echo   치과 TV 통합 관리 - 로컬 네트워크 모드\\n';
      batContent += 'echo   ' + chairs.length + '개 체어 화면을 확인합니다...\\n';
      batContent += 'echo =========================================================\\n\\n';
      
      chairs.forEach((p, index) => {
        const url = location.origin + '/' + p.short_code;
        batContent += 'REM ' + (index + 1) + '. ' + p.name + '\\n';
        batContent += 'REM TV URL: ' + url + '\\n';
        batContent += 'echo [' + (index + 1) + '/' + chairs.length + '] ' + p.name + ' 열기...\\n';
        batContent += 'start "" chrome --new-window "' + url + '"\\n';
        batContent += 'timeout /t 2 /nobreak > nul\\n\\n';
      });
      
      batContent += 'echo.\\n';
      batContent += 'echo =========================================================\\n';
      batContent += 'echo   모든 TV 화면이 열렸습니다!\\n';
      batContent += 'echo   각 창에서 TV 화면을 확인하세요.\\n';
      batContent += 'echo =========================================================\\n';
      
      batContent += 'echo.\\n';
      batContent += 'pause\\n';
      
      const blob = new Blob([batContent.replace(/\\\\n/g, '\\r\\n')], { type: 'text/plain' });
      const downloadUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = '치과TV_통합관리_네트워크_' + chairs.length + '체어.bat';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      
      showToast('✅ 네트워크 관리 BAT 파일 다운로드 완료');
    }
    
    // 네트워크 관리용 HTML 대시보드 다운로드
    function downloadNetworkManageHtml() {
      const chairs = playlists;
      
      // 체어 정보를 텍스트로 생성
      let chairList = chairs.map((p, idx) => {
        return (idx + 1) + '. ' + p.name + ' - ' + location.origin + '/' + p.short_code;
      }).join('\\n');
      
      // 간단한 HTML 생성
      const html = [
        '<!DOCTYPE html>',
        '<html><head><meta charset="UTF-8"><title>치과TV 관리</title>',
        '<style>body{font-family:sans-serif;padding:20px;background:#f5f5f5;}',
        '.card{background:white;padding:20px;margin:10px 0;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);}',
        'a{color:#3b82f6;}</style></head>',
        '<body><h1>치과 TV 통합 관리</h1>',
        '<div class="card"><h2>체어 목록</h2><pre>' + chairList + '</pre></div>',
        '<div class="card"><a href="' + location.origin + '/login" target="_blank">관리자 페이지 열기</a></div>',
        '</body></html>'
      ].join('');
      
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dental_tv_dashboard.html';
      a.click();
      URL.revokeObjectURL(url);
      showToast('대시보드 HTML 다운로드 완료');
    }
    
    // 카카오톡 공유
    function shareViaKakao() {
      const links = playlists.map(p => p.name + ': ' + location.origin + '/' + p.short_code).join('\\n');
      const text = '📺 치과 TV 링크\\n\\n' + links;
      
      // 카카오톡 URL scheme (모바일 앱 열기)
      const kakaoUrl = 'kakaotalk://msg/text/' + encodeURIComponent(text);
      
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        // 모바일: 카카오톡 앱 열기 시도
        window.location.href = kakaoUrl;
        setTimeout(() => {
          navigator.clipboard.writeText(text);
          showToast('📋 카카오톡이 없으면 링크가 복사됩니다. 붙여넣기 하세요!');
        }, 1500);
      } else {
        // PC: 클립보드 복사 후 안내
        navigator.clipboard.writeText(text);
        showToast('📋 링크가 복사되었습니다. 카카오톡에 붙여넣기 하세요!');
      }
    }
    
    // 문자 공유
    function shareViaSMS() {
      const links = playlists.map(p => p.name + ': ' + location.origin + '/' + p.short_code).join('\\n');
      const text = '치과 TV 링크\\n' + links;
      
      // SMS URL scheme
      window.location.href = 'sms:?body=' + encodeURIComponent(text);
    }
    
    // 이메일 공유
    function shareViaEmail() {
      const links = playlists.map(p => p.name + ': ' + location.origin + '/' + p.short_code).join('\\n');
      const subject = '치과 TV 체어별 링크';
      const body = '안녕하세요,\\n\\n치과 TV 체어별 링크입니다:\\n\\n' + links + '\\n\\n각 체어 PC에서 해당 링크를 열어주세요.';
      
      const mailUrl = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      window.open(mailUrl);
    }
    
    // 링크 시트 인쇄
    function printLinkSheet() {
      const printContent = '<html><head><title>치과 TV 체어별 링크</title>' +
        '<style>body{font-family:sans-serif;padding:20px;} h1{color:#333;} .chair{border:1px solid #ddd;padding:15px;margin:10px 0;border-radius:8px;} .name{font-weight:bold;font-size:18px;} .url{color:#666;margin-top:5px;} .qr{text-align:center;margin-top:10px;}</style>' +
        '</head><body>' +
        '<h1>📺 치과 TV 체어별 링크</h1>' +
        '<p>각 체어 PC에서 해당 URL을 열어주세요.</p>' +
        playlists.map((p, idx) => {
          const url = location.origin + '/' + p.short_code;
          const qrUrl = 'https://chart.googleapis.com/chart?chs=150x150&cht=qr&chl=' + encodeURIComponent(url);
          return '<div class="chair">' +
            '<div class="name">' + (idx + 1) + '. ' + p.name + '</div>' +
            '<div class="url">' + url + '</div>' +
            '<div class="qr"><img src="' + qrUrl + '"></div>' +
          '</div>';
        }).join('') +
        '</body></html>';
      
      const printWindow = window.open('', '_blank');
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
    
    // BAT 파일 다운로드 (키오스크 모드)
    function downloadBatScript() {
      let batContent = '@echo off\\n';
      batContent += 'chcp 65001 > nul\\n';
      batContent += 'echo 치과 TV 자동 실행 중...\\n';
      
      playlists.forEach((p, index) => {
        const url = location.origin + '/' + p.short_code;
        batContent += 'start "" chrome --kiosk --new-window "' + url + '"\\n';
        batContent += 'timeout /t 3 /nobreak > nul\\n';
      });
      
      const blob = new Blob([batContent.replace(/\\\\n/g, '\\r\\n')], { type: 'text/plain' });
      const downloadUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = '치과TV_자동실행.bat';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      
      closeModal('script-download-modal');
      showToast('✅ BAT 파일 다운로드 완료!');
      showAutoRunGuide();
    }
    
    // VBS 파일 다운로드 (백신 우회용)
    function downloadVbsScript() {
      let vbsContent = '';
      
      playlists.forEach((p, index) => {
        const url = location.origin + '/' + p.short_code;
        vbsContent += 'CreateObject("WScript.Shell").Run "chrome --kiosk --new-window ""' + url + '"""\\n';
        vbsContent += 'WScript.Sleep 3000\\n';
      });
      
      const blob = new Blob([vbsContent.replace(/\\\\n/g, '\\r\\n')], { type: 'text/plain' });
      const downloadUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = '치과TV_자동실행.vbs';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      
      closeModal('script-download-modal');
      showToast('✅ VBS 파일 다운로드 완료!');
      showAutoRunGuide();
    }
    
    // 바로가기 생성 안내 (showShortcutGuide는 8841줄에 정의됨)
    
    // 자동 실행 가이드 모달
    function showAutoRunGuide() {
      openModal('autorun-guide-modal');
    }
    
    function openPreviewModal() {
      const shortCode = currentPlaylist.short_code;
      document.getElementById('preview-iframe').src = '/tv/' + shortCode + '?preview=1';
      openModal('preview-modal');
    }
    
    function openQuickPreview(shortCode) {
      document.getElementById('preview-iframe').src = '/tv/' + shortCode + '?preview=1';
      openModal('preview-modal');
    }
    
    // TV 미러링 열기 (팝업 차단 방지를 위해 동기적으로 창 열기)
    function openTVMirror(shortCode, itemCount) {
      if (!shortCode) {
        alert('TV 코드가 없습니다. 관리자에게 문의하세요.');
        return;
      }
      // 아이템 개수 검증은 서버에서 처리 (공용 영상 포함 시 0일 수 있음)
      const url = '/tv/' + shortCode;
      const opened = window.open(url, '_blank');
      if (!opened) {
        window.location.href = url;
      }
    }
    
    function showQrCode(url) {
      // Google Charts QR API 사용
      const qrUrl = 'https://chart.googleapis.com/chart?cht=qr&chs=250x250&chl=' + encodeURIComponent(url);
      document.getElementById('qr-code-container').innerHTML = '<img src="' + qrUrl + '" alt="QR Code" class="rounded-lg shadow-md">';
      document.getElementById('qr-url-text').textContent = url;
      openModal('qr-modal');
    }
    
    function sendToTv() {
      const shortCode = currentPlaylist ? currentPlaylist.short_code : '';
      if (shortCode) {
        openTVMirror(shortCode, 0);
      }
    }
    
    // 공지사항
    async function loadNotices() {
      try {
        const res = await fetch(API_BASE + '/notices');
        const data = await res.json();
        notices = data.notices || [];
        renderNotices();
      } catch (e) {
        console.error('Load notices error:', e);
      }
    }
    
    // noticeSortableInstance는 JS 블록 상단에 선언됨
    
    function renderNotices() {
      const container = document.getElementById('notices-container');
      
      // 기존 sortable 인스턴스 제거
      if (noticeSortableInstance) {
        noticeSortableInstance.destroy();
        noticeSortableInstance = null;
      }
      
      if (notices.length === 0) {
        container.innerHTML = \`
          <div class="bg-white rounded-xl shadow-sm p-8 text-center">
            <i class="fas fa-bullhorn text-4xl text-gray-300 mb-4"></i>
            <p class="text-gray-500">공지사항이 없습니다.</p>
            <p class="text-sm text-gray-400 mt-2">새 공지사항을 추가해보세요.</p>
          </div>
        \`;
        return;
      }
      
      // 긴급공지와 일반공지 분리
      const urgentNotices = notices.filter(n => n.is_urgent);
      const normalNotices = notices.filter(n => !n.is_urgent);
      
      let html = '';
      
      // 긴급공지 섹션
      if (urgentNotices.length > 0) {
        html += \`
          <div class="mb-4">
            <h4 class="text-sm font-bold text-red-600 mb-2 flex items-center gap-2">
              <i class="fas fa-exclamation-circle"></i>긴급공지 (\${urgentNotices.length}개)
            </h4>
            <div class="bg-red-50 rounded-xl p-3 space-y-2">
        \`;
        urgentNotices.forEach((n, index) => {
          html += \`
            <div class="notice-item bg-white rounded-lg p-3 border-l-4 border-red-500" data-id="\${n.id}">
              <div class="flex items-center justify-between">
                <div class="notice-drag-handle text-gray-400 hover:text-gray-600 p-1 cursor-grab active:cursor-grabbing mr-2">
                  <i class="fas fa-grip-vertical"></i>
                </div>
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">긴급</span>
                    <span class="px-2 py-0.5 rounded text-xs font-medium \${n.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}">
                      \${n.is_active ? '✓ TV에 표시중' : '숨김'}
                    </span>
                  </div>
                  <p class="text-gray-800 whitespace-pre-wrap">\${n.content}</p>
                </div>
                <div class="flex items-center gap-1 ml-4">
                  <button onclick="toggleUrgent(\${n.id}, 0)"
                    class="px-2 py-1 rounded text-xs bg-red-100 text-red-600 hover:bg-red-200">
                    긴급해제
                  </button>
                  <button onclick="toggleNotice(\${n.id}, \${n.is_active ? 0 : 1})"
                    class="px-2 py-1 rounded text-xs \${n.is_active ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}">
                    \${n.is_active ? '숨기기' : '표시'}
                  </button>
                  <button onclick="editNotice(\${n.id})" class="px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs hover:bg-blue-200">
                    수정
                  </button>
                  <button onclick="deleteNotice(\${n.id})" class="p-1.5 text-red-400 hover:text-red-600" title="삭제">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          \`;
        });
        html += \`</div></div>\`;
      }
      
      // 일반공지 섹션
      if (normalNotices.length > 0) {
        html += \`
          <div>
            <h4 class="text-sm font-bold text-gray-600 mb-2 flex items-center gap-2">
              <i class="fas fa-bullhorn"></i>일반공지 (\${normalNotices.length}개)
            </h4>
            <div class="space-y-2">
        \`;
        normalNotices.forEach((n, index) => {
          html += \`
            <div class="notice-item bg-white rounded-xl shadow-sm p-3" data-id="\${n.id}">
              <div class="flex items-center justify-between">
                <div class="notice-drag-handle text-gray-400 hover:text-gray-600 p-1 cursor-grab active:cursor-grabbing mr-2">
                  <i class="fas fa-grip-vertical"></i>
                </div>
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="px-2 py-0.5 rounded text-xs font-medium \${n.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}">
                      \${n.is_active ? '✓ TV에 표시중' : '숨김'}
                    </span>
                  </div>
                  <p class="text-gray-800 whitespace-pre-wrap">\${n.content}</p>
                </div>
                <div class="flex items-center gap-1 ml-4">
                  <button onclick="toggleUrgent(\${n.id}, 1)"
                    class="px-2 py-1 rounded text-xs bg-gray-100 text-gray-500 hover:bg-gray-200">
                    긴급설정
                  </button>
                  <button onclick="toggleNotice(\${n.id}, \${n.is_active ? 0 : 1})"
                    class="px-2 py-1 rounded text-xs \${n.is_active ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}">
                    \${n.is_active ? '숨기기' : '표시'}
                  </button>
                  <button onclick="editNotice(\${n.id})" class="px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs hover:bg-blue-200">
                    수정
                  </button>
                  <button onclick="deleteNotice(\${n.id})" class="p-1.5 text-red-400 hover:text-red-600" title="삭제">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          \`;
        });
        html += \`</div></div>\`;
      }
      
      container.innerHTML = html;
      
      // Sortable 초기화
      initNoticeSortable();
    }
    
    function initNoticeSortable() {
      const container = document.getElementById('notices-container');
      if (!container || container.children.length === 0) return;
      
      noticeSortableInstance = new Sortable(container, {
        animation: 150,
        handle: '.notice-drag-handle',
        onEnd: function(evt) {
          updateNoticeNumbers();
          saveNoticeOrder();
        }
      });
    }
    
    function updateNoticeNumbers() {
      const items = document.querySelectorAll('.notice-item');
      items.forEach((item, index) => {
        const num = item.querySelector('.notice-number');
        if (num) num.textContent = (index + 1).toString();
      });
    }
    
    async function saveNoticeOrder() {
      const items = document.querySelectorAll('.notice-item');
      const order = Array.from(items).map(item => parseInt(item.dataset.id));
      
      try {
        await fetch(API_BASE + '/notices/reorder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order })
        });
        showToast('순서가 저장되었습니다.');
      } catch (e) {
        showToast('순서 저장 실패', 'error');
      }
    }
    
    function showCreateNoticeModal() {
      document.getElementById('notice-modal-title').textContent = '새 공지사항';
      document.getElementById('notice-id').value = '';
      document.getElementById('notice-content').value = '';
      document.getElementById('notice-urgent').checked = false;
      openModal('notice-modal');
    }
    
    function editNotice(id) {
      const notice = notices.find(n => n.id === id);
      if (!notice) return;
      
      document.getElementById('notice-modal-title').textContent = '공지사항 편집';
      document.getElementById('notice-id').value = notice.id;
      document.getElementById('notice-content').value = notice.content;
      document.getElementById('notice-urgent').checked = notice.is_urgent === 1;
      openModal('notice-modal');
    }
    
    async function toggleUrgent(id, isUrgent) {
      try {
        await fetch(API_BASE + '/notices/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_urgent: isUrgent })
        });
        loadNotices();
        showToast(isUrgent ? '긴급공지로 설정되었습니다.' : '긴급공지가 해제되었습니다.');
      } catch (e) {
        showToast('변경 실패', 'error');
      }
    }
    
    async function saveNotice(e) {
      e.preventDefault();
      
      const id = document.getElementById('notice-id').value;
      const data = {
        content: document.getElementById('notice-content').value,
        is_urgent: document.getElementById('notice-urgent').checked ? 1 : 0
      };
      
      try {
        const url = id ? API_BASE + '/notices/' + id : API_BASE + '/notices';
        const method = id ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if (result.success) {
          closeModal('notice-modal');
          loadNotices();
          showToast('저장되었습니다. TV에 곧 반영됩니다.');
        } else {
          showToast(result.error || '저장 실패', 'error');
        }
      } catch (e) {
        showToast('오류가 발생했습니다.', 'error');
      }
    }
    
    async function toggleNotice(id, isActive) {
      try {
        await fetch(API_BASE + '/notices/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: isActive })
        });
        loadNotices();
        showToast(isActive ? 'TV에 표시됩니다.' : 'TV에서 숨겨집니다.');
      } catch (e) {
        showToast('변경 실패', 'error');
      }
    }
    
    async function deleteNotice(id) {
      if (!confirm('정말 삭제하시겠습니까?')) return;
      
      try {
        await fetch(API_BASE + '/notices/' + id, { method: 'DELETE' });
        loadNotices();
        showToast('삭제되었습니다.');
      } catch (e) {
        showToast('삭제 실패', 'error');
      }
    }
    
    function editClinicName() {
      document.getElementById('edit-clinic-name').value = clinicName;
      openModal('clinic-name-modal');
    }
    
    async function saveClinicName(e) {
      e.preventDefault();
      const newName = document.getElementById('edit-clinic-name').value;
      
      try {
        await fetch(API_BASE + '/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clinic_name: newName })
        });
        
        clinicName = newName;
        document.getElementById('clinic-name-text').innerHTML = newName + ' <i class="fas fa-pencil-alt ml-2 text-sm text-blue-200"></i>';
        closeModal('clinic-name-modal');
        showToast('저장되었습니다.');
      } catch (e) {
        showToast('저장 실패', 'error');
      }
    }
    
    // zoom이 필요한 가이드 모달 목록 (이것들만 dashboard 숨김 + scroll 처리)
    const GUIDE_MODALS = new Set([
      'tv-guide-modal', 'shortcut-guide-modal',
      'autorun-guide-modal', 'guide-url-modal', 'individual-install-modal'
    ]);

    function openModal(id) {
      const el = document.getElementById(id);
      if (!el) return;

      const isGuideModal = GUIDE_MODALS.has(id);

      if (isGuideModal) {
        const dashboard = document.getElementById('dashboard');
        if (dashboard) dashboard.style.display = 'none';
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }

      // 모달을 body 직접 자식으로 이동
      if (el.parentElement !== document.body) {
        document.body.appendChild(el);
      }

      // 내부 wrapper paddingTop 제거
      const wrapperEl = el.querySelector('.absolute.inset-0.flex, .inset-0.flex');
      if (wrapperEl) { wrapperEl.style.paddingTop = ''; }

      // 아임웹 헤더 높이 계산
      const headerH = (!isGuideModal && iframePageTop > 0) ? Math.min(iframePageTop, 160) : 0;

      el.style.cssText = 'display:flex !important; position:fixed; top:' + headerH + 'px; left:0; right:0; bottom:0; width:100%; z-index:9999;';
      document.body.classList.add('modal-open');

      try {
        if (window.parent && window.parent !== window) {
          const needH = isGuideModal
            ? (() => {
                const box = wrapperEl ? wrapperEl.querySelector(':scope > div') : null;
                return Math.max(box ? box.scrollHeight + 80 : 650, 600);
              })()
            : Math.max(Math.round(window.screen.height * 0.92), 700);
          window.parent.postMessage({ type: 'setHeight', height: needH }, '*');
          window.parent.postMessage({ type: 'scrollToTop' }, '*');
        }
      } catch(e) {}

      if (isGuideModal) {
        try { if (typeof postParentHeight === 'function') postParentHeight(); } catch(e) {}
      }
    }

    function closeModal(id) {
      const el = document.getElementById(id);
      if (el) {
        // cssText로 일괄 초기화
        el.style.cssText = 'display:none;';
        // 모달 박스 zoom/transform/paddingTop 초기화
        const wrapper = el.querySelector('.absolute.inset-0.flex, .inset-0.flex');
        const box = wrapper ? wrapper.querySelector(':scope > div') : null;
        if (wrapper) { wrapper.style.paddingTop = ''; }
        if (box) { box.style.zoom = ''; box.style.transform = ''; box.style.transformOrigin = ''; }
      }
      
      // 열린 모달이 없을 때 공통 처리
      const openModals = document.querySelectorAll('[style*="position: fixed"][style*="display: flex"]');
      if (openModals.length === 0) {
        document.body.classList.remove('modal-open');

        // 가이드 모달이 닫힐 때만 dashboard 복원 + iframe 높이 원상 복구
        if (GUIDE_MODALS.has(id)) {
          const dashboard = document.getElementById('dashboard');
          if (dashboard) dashboard.style.display = '';
          try {
            if (window.parent && window.parent !== window) {
              modalHeightLocked = false;
              setTimeout(() => { if (typeof postParentHeight === 'function') postParentHeight(); }, 100);
            }
          } catch(e) {}
        }
      }
      if (id === 'preview-modal') {
        document.getElementById('preview-iframe').src = '';
      }
      if (id === 'edit-playlist-modal') {
        currentPlaylist = null;
        if (masterItemsRefreshTimer) {
          clearInterval(masterItemsRefreshTimer);
          masterItemsRefreshTimer = null;
        }
        loadPlaylists();
      }
      // 스크립트/설치방법 모달 닫힐 때 체크박스 전체 해제
      if (id === 'script-download-modal' || id === 'script-type-modal') {
        document.querySelectorAll('.chair-checkbox').forEach(cb => { cb.checked = false; });
        const selectAll = document.getElementById('select-all-chairs');
        if (selectAll) selectAll.checked = false;
      }
    }
    
    function copyToClipboard(text) {
      function fallback() {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try { document.execCommand('copy'); } catch(e) {}
        document.body.removeChild(ta);
        showToast('클립보드에 복사되었습니다.');
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          showToast('클립보드에 복사되었습니다.');
        }).catch(fallback);
      } else {
        fallback();
      }
    }
    
    function showToast(message, type = 'success', duration = 1200, anchorEl) {
      const toast = document.getElementById('admin-toast');
      const toastMessage = document.getElementById('admin-toast-message');
      
      toastMessage.innerHTML = message.replace(/\\n/g, '<br>');
      toast.querySelector('div').className = \`\${type === 'error' ? 'bg-red-500' : type === 'info' ? 'bg-blue-500' : 'bg-gray-800'} text-white px-6 py-3 rounded-lg shadow-lg toast\`;

      if (anchorEl) {
        var rect = anchorEl.getBoundingClientRect();
        // 버튼 바로 위에 표시 (top 기준)
        var toastTop = Math.max(4, rect.top - 52);
        toast.style.cssText = 'display:block;position:fixed;top:' + toastTop + 'px;left:50%;bottom:auto;right:auto;transform:translateX(-50%);z-index:999999;';
      } else {
        var topPx = (iframePageTop > 0 && iframePageTop < 300) ? iframePageTop + 16 : 80;
        toast.style.cssText = 'display:block;position:fixed;top:' + topPx + 'px;left:50%;bottom:auto;right:auto;transform:translateX(-50%);z-index:999999;';
      }

      clearTimeout(toast._timer);
      toast._timer = setTimeout(function() {
        toast.style.display = 'none';
      }, duration);
    }

    // 임베드 높이 자동 전송
    let lastSentHeight = 0;
    function postParentHeight() {
      try {
        if (window.parent && window.parent !== window) {
          const appEl = document.getElementById('app');
          const dashboardEl = document.getElementById('dashboard');
          const targetEl = (dashboardEl && dashboardEl.style.display !== 'none') ? dashboardEl : appEl;
          const rect = targetEl ? targetEl.getBoundingClientRect() : document.body.getBoundingClientRect();
          const height = Math.ceil(rect.top + rect.height + window.scrollY);
          if (Math.abs(height - lastSentHeight) > 5) {
            lastSentHeight = height;
            window.parent.postMessage({ type: 'setHeight', height }, '*');
          }
        }
      } catch (e) {}
    }

    function setupAutoHeight() {
      postParentHeight();
      setTimeout(postParentHeight, 200);
      setTimeout(postParentHeight, 800);
      window.addEventListener('resize', postParentHeight);
      try {
        const observer = new MutationObserver(() => postParentHeight());
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      } catch (e) {}
    }
    
    // ============================================
    // 설정 탭
    // ============================================
    function initSettingsTab() {
      const nameInput = document.getElementById('settings-clinic-name');
      if (nameInput) nameInput.value = clinicName || '';
      
      // admin code
      const codeEl = document.getElementById('settings-admin-code');
      if (codeEl) codeEl.textContent = ADMIN_CODE;
      
      // TV URLs
      const urlsContainer = document.getElementById('settings-tv-urls');
      if (urlsContainer && playlists.length > 0) {
        urlsContainer.innerHTML = playlists.map(p => {
          const tvUrl = location.origin + '/' + p.short_code;
          return \`<div class="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium">\${p.name || ''}</p>
              <p class="text-xs text-blue-600 font-mono truncate">\${tvUrl}</p>
            </div>
            <button onclick="copyToClipboard('\${tvUrl}')" class="px-3 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100 flex-shrink-0">\uBCF5\uC0AC</button>
          </div>\`;
        }).join('');
      }
      
      // 로고/자막 설정 로드
      loadSettingsData();
    }
    
    async function loadSettingsData() {
      try {
        const res = await fetch(API_BASE + '/settings');
        const data = await res.json();
        // 로고 설정
        const logoUrl = document.getElementById('settings-logo-url');
        const logoSize = document.getElementById('settings-logo-size');
        const sizeLabel = document.getElementById('logo-size-label');
        if (logoUrl) logoUrl.value = data.logo_url || '';
        if (logoSize) logoSize.value = data.logo_size || 150;
        if (sizeLabel) sizeLabel.textContent = (data.logo_size || 150) + 'px';
        // 로고 미리보기
        if (data.logo_url) {
          const preview = document.getElementById('settings-logo-preview');
          const img = document.getElementById('logo-preview-img');
          if (preview && img) { img.src = data.logo_url; preview.classList.remove('hidden'); }
        }
        // 자막 설정
        const sf = document.getElementById('settings-subtitle-font');
        const so = document.getElementById('settings-subtitle-opacity');
        const sp = document.getElementById('settings-subtitle-position');
        const soff = document.getElementById('settings-subtitle-offset');
        if (sf) sf.value = data.subtitle_font_size || 28;
        if (so) so.value = data.subtitle_bg_opacity ?? 80;
        if (sp) sp.value = data.subtitle_position || 'bottom';
        if (soff) soff.value = data.subtitle_bottom_offset || 80;
      } catch(e) { console.error('Load settings error:', e); }
    }
    
    async function saveLogoSettings() {
      const logoUrl = (document.getElementById('settings-logo-url') || {}).value || '';
      const logoSize = parseInt((document.getElementById('settings-logo-size') || {}).value) || 150;
      try {
        const res = await fetch(API_BASE + '/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logo_url: logoUrl, logo_size: logoSize })
        });
        if (res.ok) {
          showToast('\uB85C\uACE0 \uC124\uC815\uC774 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.');
          const preview = document.getElementById('settings-logo-preview');
          const img = document.getElementById('logo-preview-img');
          if (logoUrl && preview && img) { img.src = logoUrl; preview.classList.remove('hidden'); }
          else if (preview) preview.classList.add('hidden');
        }
      } catch(e) { showToast('\uC800\uC7A5 \uC2E4\uD328', 'error'); }
    }
    
    async function saveSubtitleSettings() {
      const font = parseInt((document.getElementById('settings-subtitle-font') || {}).value) || 28;
      const opacity = parseInt((document.getElementById('settings-subtitle-opacity') || {}).value) ?? 80;
      const position = (document.getElementById('settings-subtitle-position') || {}).value || 'bottom';
      const offset = parseInt((document.getElementById('settings-subtitle-offset') || {}).value) || 80;
      try {
        const res = await fetch(API_BASE + '/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subtitle_font_size: font, subtitle_bg_opacity: opacity, subtitle_position: position, subtitle_bottom_offset: offset })
        });
        if (res.ok) showToast('\uC790\uB9C9 \uC124\uC815 \uC800\uC7A5');
      } catch(e) { showToast('\uC800\uC7A5 \uC2E4\uD328', 'error'); }
    }

    function saveClinicNameFromSettings() {
      const nameInput = document.getElementById('settings-clinic-name');
      if (!nameInput || !nameInput.value.trim()) return;
      const newName = nameInput.value.trim();
      
      fetch(API_BASE + '/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinic_name: newName })
      }).then(res => {
        if (res.ok) {
          clinicName = newName;
          document.getElementById('clinic-name-text').innerHTML = newName + ' <i class="fas fa-pencil-alt ml-2 text-sm text-blue-200"></i>';
          showToast('\uCE58\uACFC\uBA85\uC774 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4.');
        }
      }).catch(() => showToast('\uC800\uC7A5 \uC2E4\uD328', 'error'));
    }

    // ============================================
    // 최고관리자 탭
    // ============================================
    function showAdminSubTab(sub) {
      _adminSubTab = sub;
      ['clinics', 'master-items', 'push'].forEach(s => {
        const btn = document.getElementById('admin-sub-' + s);
        if (btn) {
          btn.className = s === sub 
            ? 'px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium'
            : 'px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300';
        }
      });
      const body = document.getElementById('admin-body');
      if (!body) return;
      body.innerHTML = '<div class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>\uB85C\uB529 \uC911...</div>';
      if (sub === 'clinics') renderAdminClinics();
      else if (sub === 'master-items') renderAdminMasterItems();
      else if (sub === 'push') renderAdminPush();
    }

    function renderAdminClinics() {
      const body = document.getElementById('admin-body');
      if (!body) return;
      const q = _adminSearchQuery.toLowerCase().trim();
      const clinics = (_allClinics || []).filter(c => {
        if (!q) return true;
        return (c.clinic_name || '').toLowerCase().includes(q) ||
               (c.imweb_email || '').toLowerCase().includes(q) ||
               (c.admin_code || '').toLowerCase().includes(q);
      });
      const totalCount = (_allClinics || []).length;
      const activeCount = clinics.filter(c => c.is_active !== 0).length;
      const suspendedCount = clinics.filter(c => c.is_active === 0).length;
      const imwebCount = clinics.filter(c => c.imweb_member_id).length;
      const unregCount = clinics.filter(c => !c.imweb_member_id).length;
      
      body.innerHTML = \`<div class="bg-white rounded-xl shadow-sm p-6">
        <div class="flex justify-between items-center mb-3">
          <h3 class="font-bold text-gray-800"><i class="fas fa-hospital mr-2 text-purple-500"></i>\uCE58\uACFC \uAD00\uB9AC (\${totalCount}\uAC1C)</h3>
          <button onclick="refreshAdminClinics()" class="text-sm text-purple-500 hover:text-purple-700"><i class="fas fa-sync-alt mr-1"></i>\uC0C8\uB85C\uACE0\uCE68</button>
        </div>
        <!-- \uAC80\uC0C9 -->
        <div class="mb-3">
          <input type="text" id="admin-clinic-search" placeholder="\uCE58\uACFC\uBA85, \uC774\uBA54\uC77C, \uCF54\uB4DC \uAC80\uC0C9..." value="\${q.replace(/"/g, '&quot;')}"
            class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300"
            oninput="_adminSearchQuery=this.value; renderAdminClinics()">
        </div>
        <!-- \uC694\uC57D \uBC30\uC9C0 -->
        <div class="flex gap-2 mb-3 text-xs flex-wrap">
          <span class="px-2 py-1 bg-green-100 text-green-700 rounded-full">\uD65C\uC131 \${activeCount}</span>
          <span class="px-2 py-1 bg-red-100 text-red-700 rounded-full">\uC815\uC9C0 \${suspendedCount}</span>
          <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">\uC784\uC6F9\uC5F0\uB3D9 \${imwebCount}</span>
          <span class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full" title="\uC544\uC784\uC6F9 \uD68C\uC6D0\uC774\uC9C0\uB9CC DB\uC5D0 \uCE58\uACFC \uB808\uCF54\uB4DC\uAC00 \uC5C6\uB294 \uBBF8\uB4F1\uB85D \uC0C1\uD0DC">\uBBF8\uB4F1\uB85D \${unregCount}</span>
        </div>
        \${clinics.length === 0 ? '<p class="text-gray-400 text-center py-4">' + (q ? '\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.' : '\uB4F1\uB85D\uB41C \uCE58\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.') + '</p>' :
        '<div class="space-y-2 max-h-[60vh] overflow-y-auto">' + clinics.map(c => {
          const statusBadge = c.is_active === 0 
            ? '<span class="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded">\uC815\uC9C0</span>'
            : '<span class="px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded">\uD65C\uC131</span>';
          const imwebBadge = c.imweb_member_id
            ? '<span class="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded">\uC784\uC6F9</span>'
            : '<span class="px-2 py-0.5 bg-yellow-100 text-yellow-600 text-xs rounded" title="\uC544\uC784\uC6F9 \uD68C\uC6D0\uC774\uC9C0\uB9CC DB\uC5D0 \uCE58\uACFC \uB808\uCF54\uB4DC\uAC00 \uC5C6\uC74C">\uBBF8\uB4F1\uB85D</span>';
          return \`<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-medium text-sm">\${c.clinic_name || '\uC774\uB984\uC5C6\uC74C'}</span>
                \${statusBadge} \${imwebBadge}
              </div>
              <p class="text-xs text-gray-500 mt-0.5">
                \${c.imweb_email || c.admin_code || ''} | \uD50C\uB808\uC774\uB9AC\uC2A4\uD2B8 \${c.playlist_count || 0}\uAC1C | \uACF5\uC9C0 \${c.notice_count || 0}\uAC1C
              </p>
            </div>
            <div class="flex gap-1 flex-shrink-0">
              <button onclick="window.open('/admin/\${c.admin_code}','_blank')" class="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100" title="\uAD00\uB9AC\uC790 \uD398\uC774\uC9C0 \uC5F4\uAE30"><i class="fas fa-external-link-alt"></i></button>
              \${c.is_active !== 0 
                ? '<button onclick="adminSuspendClinic(\\'' + c.admin_code + '\\')" class="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100">\uC815\uC9C0</button>'
                : '<button onclick="adminActivateClinic(\\'' + c.admin_code + '\\')" class="px-2 py-1 text-xs bg-green-50 text-green-600 rounded hover:bg-green-100">\uD65C\uC131\uD654</button>'}
            </div>
          </div>\`;
        }).join('') + '</div>'}
      </div>\`;
    }

    async function refreshAdminClinics() {
      try {
        const res = await fetch('/api/master/users');
        if (res.ok) {
          const data = await res.json();
          _allClinics = (data.users || []).filter(u => !u.is_master);
          renderAdminClinics();
          showToast('\uC0C8\uB85C\uACE0\uCE68 \uC644\uB8CC');
        }
      } catch(e) { showToast('\uC0C8\uB85C\uACE0\uCE68 \uC2E4\uD328', 'error'); }
    }

    async function adminSuspendClinic(adminCode) {
      if (!confirm('\uC774 \uCE58\uACFC\uB97C \uC815\uC9C0\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?')) return;
      try {
        const res = await fetch('/api/master/clinics/' + adminCode + '/suspend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: '\uAD00\uB9AC\uC790\uC5D0 \uC758\uD574 \uC815\uC9C0' })
        });
        if (res.ok) { showToast('\uC815\uC9C0 \uCC98\uB9AC \uC644\uB8CC'); await refreshAdminClinics(); }
      } catch(e) { showToast('\uCC98\uB9AC \uC2E4\uD328', 'error'); }
    }

    async function adminActivateClinic(adminCode) {
      try {
        const res = await fetch('/api/master/clinics/' + adminCode + '/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) { showToast('\uD65C\uC131\uD654 \uC644\uB8CC'); await refreshAdminClinics(); }
      } catch(e) { showToast('\uCC98\uB9AC \uC2E4\uD328', 'error'); }
    }

    function renderAdminMasterItems() {
      const body = document.getElementById('admin-body');
      if (!body) return;
      
      body.innerHTML = \`<div class="bg-white rounded-xl shadow-sm p-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-bold text-gray-800"><i class="fas fa-video mr-2 text-purple-500"></i>\uACF5\uC6A9 \uC601\uC0C1 \uAD00\uB9AC (\${(masterItems || []).length}\uAC1C)</h3>
        </div>
        <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
          <div class="flex gap-2">
            <input type="text" id="admin-new-url" placeholder="YouTube \uB610\uB294 Vimeo URL" class="flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500">
            <button onclick="adminAddMasterItem()" class="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600"><i class="fas fa-plus mr-1"></i>\uCD94\uAC00</button>
          </div>
        </div>
        <div id="admin-master-items-list" class="space-y-2">
          \${(masterItems || []).map(item => {
            const thumb = item.thumbnail_url 
              ? '<img src="' + item.thumbnail_url + '" class="w-16 h-10 object-cover rounded">'
              : '<div class="w-16 h-10 bg-gray-200 rounded flex items-center justify-center"><i class="fas fa-video text-gray-400"></i></div>';
            return '<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">' +
              thumb +
              '<div class="flex-1 min-w-0"><p class="text-sm font-medium truncate">' + (item.title || item.url || '') + '</p><p class="text-xs text-gray-400">' + (item.item_type || '') + '</p></div>' +
              '<button onclick="adminDeleteMasterItem(' + item.id + ')" class="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"><i class="fas fa-trash"></i></button>' +
              '</div>';
          }).join('')}
        </div>
      </div>\`;
    }

    async function adminAddMasterItem() {
      const urlInput = document.getElementById('admin-new-url');
      if (!urlInput || !urlInput.value.trim()) return;
      try {
        const res = await fetch('/api/master/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlInput.value.trim() })
        });
        if (res.ok) {
          urlInput.value = '';
          const itemsRes = await fetch('/api/master/items');
          if (itemsRes.ok) { const data = await itemsRes.json(); masterItems = data.items || []; cachedMasterItems = masterItems; masterItemsCache = masterItems; }
          renderAdminMasterItems();
          showToast('\uC601\uC0C1 \uCD94\uAC00 \uC644\uB8CC');
        } else { const err = await res.json(); showToast(err.error || '\uCD94\uAC00 \uC2E4\uD328', 'error'); }
      } catch(e) { showToast('\uCD94\uAC00 \uC2E4\uD328', 'error'); }
    }

    async function adminDeleteMasterItem(itemId) {
      if (!confirm('\uC774 \uACF5\uC6A9 \uC601\uC0C1\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?')) return;
      try {
        const res = await fetch('/api/master/items/' + itemId, { method: 'DELETE' });
        if (res.ok) {
          masterItems = masterItems.filter(i => i.id !== itemId); cachedMasterItems = masterItems; masterItemsCache = masterItems;
          renderAdminMasterItems();
          showToast('\uC0AD\uC81C \uC644\uB8CC');
        }
      } catch(e) { showToast('\uC0AD\uC81C \uC2E4\uD328', 'error'); }
    }

    function renderAdminPush() {
      const body = document.getElementById('admin-body');
      if (!body) return;
      const clinics = (_allClinics || []).filter(c => c.is_active !== 0);
      
      body.innerHTML = \`<div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="font-bold text-gray-800 mb-4"><i class="fas fa-paper-plane mr-2 text-purple-500"></i>\uB9C1\uD06C \uBC30\uD3EC</h3>
        <p class="text-sm text-gray-500 mb-2">\uC120\uD0DD\uD55C \uCE58\uACFC\uC758 \uCCAB \uBC88\uC9F8 \uD50C\uB808\uC774\uB9AC\uC2A4\uD2B8\uC5D0 \uC601\uC0C1 \uB9C1\uD06C\uB97C \uCD94\uAC00\uD569\uB2C8\uB2E4.</p>
        
        <!-- STEP 1: \uCE58\uACFC \uC120\uD0DD -->
        <div class="mb-5">
          <div class="flex items-center gap-2 mb-2">
            <span class="bg-purple-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</span>
            <label class="text-sm font-bold text-gray-700">\uBC30\uD3EC \uB300\uC0C1 \uC120\uD0DD (\${clinics.length}\uAC1C \uCE58\uACFC)</label>
          </div>
          <div class="flex items-center gap-2 mb-2">
            <input type="checkbox" id="push-select-all" onchange="togglePushSelectAll()" class="w-4 h-4 accent-purple-500">
            <label for="push-select-all" class="text-sm text-gray-600">\uC804\uCCB4 \uC120\uD0DD</label>
            <span id="push-selected-count" class="text-xs text-purple-500 font-medium ml-auto">0\uAC1C \uC120\uD0DD</span>
          </div>
          <div class="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
            \${clinics.map(c => 
              '<label class="flex items-center gap-2 p-1.5 hover:bg-purple-50 rounded cursor-pointer">' +
              '<input type="checkbox" class="push-clinic-cb w-4 h-4 accent-purple-500" value="' + c.admin_code + '" onchange="updatePushCount()">' +
              '<span class="text-sm">' + (c.clinic_name || c.admin_code) + '</span>' +
              '<span class="text-xs text-gray-400 ml-auto">' + (c.imweb_email || '') + '</span></label>'
            ).join('')}
          </div>
        </div>
        
        <!-- STEP 2: \uB9C1\uD06C \uD15C\uD50C\uB9BF \uC120\uD0DD -->
        <div class="mb-5">
          <div class="flex items-center gap-2 mb-2">
            <span class="bg-purple-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <label class="text-sm font-bold text-gray-700">\uBC30\uD3EC\uD560 \uB9C1\uD06C</label>
          </div>
          
          <!-- \uD15C\uD50C\uB9BF \uBC84\uD2BC -->
          <div class="flex gap-2 mb-3 flex-wrap">
            <button onclick="selectPushTemplate('master')" class="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-200 transition">
              <i class="fas fa-list mr-1"></i>\uACF5\uC6A9 \uC601\uC0C1 \uC120\uD0DD
            </button>
            <button onclick="selectPushTemplate('youtube')" class="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition">
              <i class="fab fa-youtube mr-1"></i>YouTube URL
            </button>
            <button onclick="selectPushTemplate('custom')" class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition">
              <i class="fas fa-edit mr-1"></i>\uC9C1\uC811 \uC785\uB825
            </button>
          </div>
          
          <!-- \uACF5\uC6A9 \uC601\uC0C1 \uC120\uD0DD \uC601\uC5ED (\uAE30\uBCF8 \uC228\uAE40) -->
          <div id="push-master-select" style="display:none" class="mb-3 border rounded-lg p-3 bg-indigo-50">
            <p class="text-xs text-indigo-600 mb-2"><i class="fas fa-info-circle mr-1"></i>\uBC30\uD3EC\uD560 \uACF5\uC6A9 \uC601\uC0C1\uC744 \uC120\uD0DD\uD558\uC138\uC694</p>
            <div class="max-h-32 overflow-y-auto space-y-1" id="push-master-items-list">
              \${(masterItems || []).map(item => 
                '<label class="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer">' +
                '<input type="checkbox" class="push-master-item-cb w-4 h-4 accent-indigo-500" value="' + item.id + '" data-url="' + (item.url || '') + '" data-title="' + ((item.title || '').replace(/"/g, '&amp;quot;')) + '">' +
                (item.thumbnail_url ? '<img src="' + item.thumbnail_url + '" class="w-10 h-6 object-cover rounded">' : '<div class="w-10 h-6 bg-gray-200 rounded flex items-center justify-center"><i class="fas fa-video text-gray-400 text-xs"></i></div>') +
                '<span class="text-xs truncate">' + (item.title || item.url || '') + '</span></label>'
              ).join('')}
            </div>
          </div>
          
          <!-- \uC9C1\uC811 \uC785\uB825 \uC601\uC5ED -->
          <div id="push-custom-input" class="flex gap-2">
            <input type="text" id="push-link-name" placeholder="\uB9C1\uD06C \uC774\uB984" class="w-1/3 border rounded-lg px-3 py-2 text-sm">
            <input type="text" id="push-link-url" placeholder="URL (https://...)" class="flex-1 border rounded-lg px-3 py-2 text-sm">
          </div>
        </div>
        
        <!-- STEP 3: \uBC30\uD3EC \uC2E4\uD589 -->
        <div>
          <div class="flex items-center gap-2 mb-3">
            <span class="bg-purple-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <label class="text-sm font-bold text-gray-700">\uBC30\uD3EC \uC2E4\uD589</label>
          </div>
          <button onclick="executePush()" class="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white py-3 rounded-lg font-bold hover:from-purple-600 hover:to-indigo-600 transition shadow-lg">
            <i class="fas fa-paper-plane mr-2"></i>\uC120\uD0DD \uCE58\uACFC\uC5D0 \uBC30\uD3EC
          </button>
        </div>
      </div>\`;
    }
    
    function updatePushCount() {
      const count = document.querySelectorAll('.push-clinic-cb:checked').length;
      const el = document.getElementById('push-selected-count');
      if (el) el.textContent = count + '\uAC1C \uC120\uD0DD';
    }
    
    function selectPushTemplate(type) {
      const masterSelect = document.getElementById('push-master-select');
      const customInput = document.getElementById('push-custom-input');
      if (!masterSelect || !customInput) return;
      
      if (type === 'master') {
        masterSelect.style.display = '';
        customInput.style.display = 'none';
      } else {
        masterSelect.style.display = 'none';
        customInput.style.display = '';
        if (type === 'youtube') {
          const nameEl = document.getElementById('push-link-name');
          const urlEl = document.getElementById('push-link-url');
          if (nameEl) nameEl.placeholder = '\uC601\uC0C1 \uC81C\uBAA9';
          if (urlEl) { urlEl.placeholder = 'YouTube URL (https://youtube.com/...)'; urlEl.value = ''; }
        } else {
          const nameEl = document.getElementById('push-link-name');
          const urlEl = document.getElementById('push-link-url');
          if (nameEl) nameEl.placeholder = '\uB9C1\uD06C \uC774\uB984';
          if (urlEl) { urlEl.placeholder = 'URL (https://...)'; urlEl.value = ''; }
        }
      }
    }

    function togglePushSelectAll() {
      const checked = document.getElementById('push-select-all').checked;
      document.querySelectorAll('.push-clinic-cb').forEach(cb => { cb.checked = checked; });
      updatePushCount();
    }

    async function executePush() {
      const selectedCodes = Array.from(document.querySelectorAll('.push-clinic-cb:checked')).map(cb => cb.value);
      if (selectedCodes.length === 0) { showToast('\uBC30\uD3EC \uB300\uC0C1\uC744 \uC120\uD0DD\uD558\uC138\uC694', 'error'); return; }
      
      // \uACF5\uC6A9 \uC601\uC0C1 \uC120\uD0DD \uBAA8\uB4DC \uD655\uC778
      const masterSelect = document.getElementById('push-master-select');
      const isMasterMode = masterSelect && masterSelect.style.display !== 'none';
      
      let pushItems = [];
      if (isMasterMode) {
        const checked = document.querySelectorAll('.push-master-item-cb:checked');
        if (checked.length === 0) { showToast('\uBC30\uD3EC\uD560 \uACF5\uC6A9 \uC601\uC0C1\uC744 \uC120\uD0DD\uD558\uC138\uC694', 'error'); return; }
        checked.forEach(cb => {
          pushItems.push({ url: cb.dataset.url, title: cb.dataset.title || cb.dataset.url });
        });
      } else {
        const linkName = (document.getElementById('push-link-name') || {}).value || '';
        const linkUrl = (document.getElementById('push-link-url') || {}).value || '';
        if (!linkUrl.trim()) { showToast('URL\uC744 \uC785\uB825\uD558\uC138\uC694', 'error'); return; }
        pushItems.push({ url: linkUrl.trim(), title: linkName.trim() || linkUrl.trim() });
      }
      
      const itemNames = pushItems.map(i => i.title).join(', ');
      if (!confirm(selectedCodes.length + '\uAC1C \uCE58\uACFC\uC5D0 ' + pushItems.length + '\uAC1C \uB9C1\uD06C\uB97C \uBC30\uD3EC\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?\n\n' + itemNames)) return;
      
      let successCount = 0;
      let failCount = 0;
      for (const code of selectedCodes) {
        try {
          const pRes = await fetch('/api/' + code + '/playlists');
          const pData = await pRes.json();
          const firstPlaylist = (pData.playlists || [])[0];
          if (firstPlaylist) {
            for (const item of pushItems) {
              const addRes = await fetch('/api/' + code + '/playlists/' + firstPlaylist.id + '/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: item.url, title: item.title })
              });
              if (addRes.ok) successCount++;
              else failCount++;
            }
          } else { failCount++; }
        } catch(e) { failCount++; }
      }
      
      if (failCount > 0) {
        showToast('\uC131\uACF5 ' + successCount + '\uAC74 / \uC2E4\uD328 ' + failCount + '\uAC74', 'error');
      } else {
        showToast(successCount + '\uAC74 \uBC30\uD3EC \uC644\uB8CC');
      }
      // \uC785\uB825 \uCD08\uAE30\uD654
      const nameEl = document.getElementById('push-link-name');
      const urlEl = document.getElementById('push-link-url');
      if (nameEl) nameEl.value = '';
      if (urlEl) urlEl.value = '';
      document.querySelectorAll('.push-master-item-cb').forEach(cb => { cb.checked = false; });
    }

    init();
    // @@ADMIN_JS_END@@
  </script>
</body>
</html>
  `)
  } catch (err) {
    console.error('Admin page error:', err)
    return c.html(getBlockedPageHtml('일시적인 오류가 발생했습니다', '관리자 페이지 로딩 중 문제가 발생했습니다.', '잠시 후 다시 시도해주세요.'))
  }
}

// ============================================
// 관리자 페이지 (직접 접속용)
// ============================================
app.get('/admin/:adminCode', async (c) => {
  const adminCode = c.req.param('adminCode')
  const isAdminFlag = c.req.query('is_admin') === '1'
  const emailParam = (c.req.query('email') || '').trim().toLowerCase()
  return handleAdminPage(c, adminCode, emailParam, isAdminFlag)
})

// ============================================
// TV 미러링 페이지
// ============================================

// TV 코드 입력 페이지 - /go 접속 후 코드만 입력
app.get('/go', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TV 연결</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .container {
      text-align: center;
      padding: 40px;
    }
    h1 {
      font-size: 48px;
      margin-bottom: 20px;
      font-weight: 300;
    }
    h1 i { color: #60a5fa; }
    p {
      font-size: 24px;
      color: #94a3b8;
      margin-bottom: 50px;
    }
    .input-box {
      display: flex;
      justify-content: center;
      gap: 15px;
      margin-bottom: 30px;
    }
    input {
      font-size: 72px;
      width: 100px;
      height: 120px;
      text-align: center;
      border: 3px solid #3b82f6;
      border-radius: 16px;
      background: rgba(255,255,255,0.1);
      color: white;
      font-weight: bold;
      text-transform: uppercase;
      caret-color: #60a5fa;
    }
    input:focus {
      outline: none;
      border-color: #60a5fa;
      background: rgba(255,255,255,0.15);
      box-shadow: 0 0 30px rgba(96, 165, 250, 0.3);
    }
    input::placeholder { color: #475569; }
    .btn {
      font-size: 32px;
      padding: 20px 60px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: white;
      border: none;
      border-radius: 16px;
      cursor: pointer;
      font-weight: bold;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .btn:hover {
      transform: scale(1.05);
      box-shadow: 0 10px 40px rgba(59, 130, 246, 0.4);
    }
    .btn:disabled {
      background: #475569;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    .error {
      color: #f87171;
      font-size: 24px;
      margin-top: 30px;
      display: none;
    }
    .hint {
      color: #64748b;
      font-size: 18px;
      margin-top: 40px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1><i class="fas fa-tv"></i> TV 연결</h1>
    <p>관리자 페이지에서 받은 코드를 입력하세요</p>
    
    <div class="input-box">
      <input type="text" id="c1" maxlength="1" autofocus>
      <input type="text" id="c2" maxlength="1">
      <input type="text" id="c3" maxlength="1">
      <input type="text" id="c4" maxlength="1">
      <input type="text" id="c5" maxlength="1">
    </div>
    
    <button class="btn" id="goBtn" onclick="go()" disabled>
      <i class="fas fa-play"></i> 연결
    </button>
    
    <div class="error" id="error">
      <i class="fas fa-exclamation-circle"></i> 코드를 찾을 수 없습니다
    </div>
    
    <p class="hint">
      <i class="fas fa-info-circle"></i> 
      코드는 관리자 페이지의 플레이리스트에서 확인할 수 있습니다
    </p>
  </div>
  
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script>
    const inputs = [
      document.getElementById('c1'),
      document.getElementById('c2'),
      document.getElementById('c3'),
      document.getElementById('c4'),
      document.getElementById('c5')
    ];
    const btn = document.getElementById('goBtn');
    const error = document.getElementById('error');
    
    inputs.forEach((input, i) => {
      input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
        e.target.value = val.toLowerCase();
        
        if (val && i < 4) {
          inputs[i + 1].focus();
        }
        
        checkComplete();
      });
      
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && i > 0) {
          inputs[i - 1].focus();
        }
        if (e.key === 'Enter') {
          go();
        }
      });
      
      // 붙여넣기 지원
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const paste = e.clipboardData.getData('text').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        for (let j = 0; j < Math.min(paste.length, 5); j++) {
          inputs[j].value = paste[j];
        }
        if (paste.length >= 5) inputs[4].focus();
        checkComplete();
      });
    });
    
    function checkComplete() {
      const code = inputs.map(i => i.value).join('');
      btn.disabled = code.length < 5;
      error.style.display = 'none';
    }
    
    async function go() {
      const code = inputs.map(i => i.value).join('').toLowerCase();
      if (code.length < 5) return;
      
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 연결 중...';
      
      try {
        const res = await fetch('/api/tv/' + code);
        if (res.ok) {
          window.location.href = '/tv/' + code;
        } else {
          throw new Error('not found');
        }
      } catch (e) {
        error.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play"></i> 연결';
        inputs[0].focus();
      }
    }
  </script>
</body>
</html>
  `)
})

app.get('/guide', (c) => {
  const baseUrl = new URL(c.req.url).origin
  return c.html(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>대기실TV 사용법</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 text-gray-800">
  <div class="max-w-4xl mx-auto px-6 py-10">
    <h1 class="text-2xl font-bold mb-2">대기실TV 사용법</h1>
    <p class="text-sm text-gray-600 mb-8">대기실 TV를 안정적으로 운영하기 위한 기본 가이드입니다.</p>

    <div class="space-y-8">
      <section>
        <h2 class="text-lg font-semibold mb-2">1. 로그인/관리자 접속</h2>
        <ul class="list-disc list-inside text-sm text-gray-700 space-y-1">
          <li>관리자 페이지에서 이메일로 로그인합니다.</li>
          <li>치과 이름을 클릭하면 치과명 수정이 가능합니다.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-semibold mb-2">2. 플레이리스트 관리 (Vimeo 전용)</h2>
        <ul class="list-disc list-inside text-sm text-gray-700 space-y-1">
          <li>플레이리스트 추가/수정은 Vimeo URL만 허용됩니다.</li>
          <li>이미지 URL도 추가할 수 있습니다.</li>
          <li>드래그로 순서를 변경할 수 있습니다.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-semibold mb-2">3. 임시 영상 전송</h2>
        <ul class="list-disc list-inside text-sm text-gray-700 space-y-1">
          <li>임시 전송은 YouTube/Vimeo 모두 가능합니다.</li>
          <li>전송 버튼 클릭은 자동재생 제한을 완화합니다.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-semibold mb-2">4. TV 연결</h2>
        <ul class="list-disc list-inside text-sm text-gray-700 space-y-1">
          <li>플레이리스트의 TV 링크를 복사해 TV 브라우저에서 접속합니다.</li>
          <li>짧은 URL(단축)을 생성해 입력하기 쉽게 만들 수 있습니다.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-semibold mb-2">5. 전체화면/자동재생 안내</h2>
        <ul class="list-disc list-inside text-sm text-gray-700 space-y-1">
          <li>일부 PC/노트북은 자동재생 제한이 있어 클릭이 필요할 수 있습니다.</li>
          <li>TV 환경은 대부분 전체화면 유지가 안정적입니다.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-semibold mb-2">6. 문제 해결</h2>
        <ul class="list-disc list-inside text-sm text-gray-700 space-y-1">
          <li>화면이 멈추면 새로고침 후 재접속합니다.</li>
          <li>재생 오류가 반복되면 다른 브라우저로 테스트합니다.</li>
        </ul>
      </section>
    </div>

    <div class="mt-10">
      <a href="${baseUrl}/login" class="text-blue-600 text-sm hover:underline">로그인 페이지로 돌아가기</a>
    </div>
  </div>
</body>
</html>
  `)
})

// 단축 URL 전용 라우트 - /s/yxvb4966 형태로 짧게 접속 가능
app.get('/s/:shortCode', (c) => {
  const shortCode = c.req.param('shortCode')
  return c.redirect(`/tv/${shortCode}`)
})

// 단축코드만으로 직접 접속 - /yxvb4966 형태 (5~8자 영숫자만)
// 주의: master, admin, api, go는 제외 (다른 라우트에서 처리)
app.get('/:shortCode{[a-zA-Z0-9]{5,8}}', async (c, next) => {
  const shortCode = c.req.param('shortCode')
  // admin, api, go, master 페이지와 충돌 방지 - 다음 라우트로 넘김
  const reserved = ['admin', 'api', 'master', 'embed', 'go', 'login', 'guide']
  if (reserved.includes(shortCode)) {
    return next()
  }
  return c.redirect(`/tv/${shortCode}`)
})

app.get('/tv/:shortCode', async (c) => {
  const shortCode = c.req.param('shortCode')
  
  // 플레이리스트로 사용자 조회
  const playlist = await c.env.DB.prepare(
    'SELECT p.*, u.is_active, u.is_master, u.subscription_end, u.subscription_plan, u.suspended_reason FROM playlists p JOIN users u ON p.user_id = u.id WHERE p.short_code = ?'
  ).bind(shortCode).first() as any
  
  if (!playlist) {
    return c.html(getBlockedPageHtml('플레이리스트 없음', '플레이리스트를 찾을 수 없습니다.', '올바른 URL인지 확인해주세요.'))
  }
  
  // 계정 상태 확인
  if (playlist && !playlist.is_master) {
    // 1. 계정 정지 확인
    if (playlist.is_active === 0) {
      return c.html(getBlockedPageHtml('서비스 이용 불가', playlist.suspended_reason || '계정이 정지되었습니다', '관리자에게 문의해주세요.'))
    }
    
    // 2. 구독 만료 확인 (무제한 플랜은 제외)
    if (playlist.subscription_plan !== 'unlimited' && playlist.subscription_end) {
      const endDate = new Date(playlist.subscription_end)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (endDate < today) {
        return c.html(getBlockedPageHtml('서비스 이용 불가', '구독 기간이 만료되었습니다 (만료일: ' + playlist.subscription_end + ')', '서비스를 계속 이용하시려면 구독을 연장해주세요.'))
      }
    }
  }
  
  // active_item_ids를 고려한 실제 재생 가능 영상 수 확인
  // TV API와 동일한 로직 사용
  const rawActiveItemIds = playlist.active_item_ids
  const isLegacyPlaylist = (rawActiveItemIds === null || rawActiveItemIds === undefined)
  
  if (!isLegacyPlaylist) {
    // active_item_ids가 설정된 경우 - 해당 ID만 재생
    let activeItemIds: number[] = []
    try {
      activeItemIds = JSON.parse(rawActiveItemIds || '[]')
    } catch (e) {
      activeItemIds = []
    }
    
    if (activeItemIds.length === 0) {
      // 빈 플레이리스트는 TV 화면에서 대기 화면으로 처리
    }
  } else {
    // 레거시 플레이리스트 - 전체 영상 수 확인
    const itemCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM playlist_items WHERE playlist_id = ?'
    ).bind(playlist.id).first() as any
    
    const masterItemCount = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM playlist_items pi
      JOIN playlists p ON pi.playlist_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE u.is_master = 1 AND p.is_master_playlist = 1 AND p.is_active = 1
    `).first() as any
    
    const totalItems = (itemCount?.count || 0) + (masterItemCount?.count || 0)
    
    if (totalItems === 0) {
      // 빈 플레이리스트는 TV 화면에서 대기 화면으로 처리
    }
  }
  
  return c.html(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>TV 미러링</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      width: 100%; 
      height: 100%; 
      overflow: hidden; 
      background: #000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    
    /* 미디어 아이템 레이어 - 모든 아이템을 미리 로드 */
    #media-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
    }
    
    .media-item {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
      opacity: 0;
      z-index: 1;
      transition: opacity var(--transition-duration) ease-in-out;
      pointer-events: none;
    }
    
    .media-item.active {
      opacity: 1;
      z-index: 2;
      pointer-events: auto;
    }
    
    /* 전환 중 두 아이템이 동시에 active일 때 - 새 아이템이 아래에서 페이드인 */
    .media-item.active ~ .media-item.active {
      z-index: 1;
    }
    
    .media-item iframe,
    .media-item video,
    .media-item img {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      min-width: 100%;
      min-height: 100%;
      width: auto;
      height: auto;
      border: none;
      object-fit: cover;
    }
    
    /* Vimeo/YouTube iframe - 화면보다 크게해서 여백 제거 */
    .media-item iframe {
      width: 177.78vh !important;
      height: 100vh !important;
      min-width: 100vw;
      min-height: 56.25vw;
    }
    
    /* 미리보기 모드 - iframe 크기에 맞게 조정 */
    .preview-mode .media-item iframe,
    .preview-mode .media-item video,
    .preview-mode .media-item img {
      width: 100% !important;
      height: 100% !important;
      min-width: 100% !important;
      min-height: 100% !important;
      object-fit: cover !important;
      transform: translate(-50%, -50%) !important;
    }
    
    .preview-mode #notice-bar {
      padding: 3px 0 !important;
      min-height: auto !important;
    }
    
    .preview-mode .notice-text-content {
      font-size: 12px !important;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.5) !important;
    }
    
    .preview-mode #logo-overlay {
      top: 10px !important;
      right: 10px !important;
    }
    
    .preview-mode #logo-overlay img {
      max-width: 60px !important;
      height: auto !important;
    }
    .transition-flip.exit { transform: rotateY(-90deg); }
    
    .transition-none { transition: none; }
    .transition-none.active { opacity: 1; }
    .transition-none.preload { opacity: 0; }
    
    /* 로고 */
    #logo-overlay {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 90;
      pointer-events: none;
    }
    
    #logo-overlay img {
      max-width: 100%;
      height: auto;
    }
    
    /* 재생시간 외 화면 */
    #schedule-screen {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #fff;
      z-index: 180;
    }
    
    #schedule-screen .clock {
      font-size: 120px;
      font-weight: 200;
      margin-bottom: 20px;
    }
    
    #schedule-screen .message {
      font-size: 24px;
      color: #666;
    }
    
    #notice-bar {
      position: fixed;
      left: 0;
      width: 100%;
      padding: 10px 0;
      z-index: 100;
      overflow: hidden;
      display: flex;
      align-items: center;
    }
    
    #notice-bar.position-bottom {
      bottom: 0;
      top: auto;
    }
    
    #notice-bar.position-top {
      top: 0;
      bottom: auto;
    }
    
    /* 자막 오버레이 스타일 */
    #subtitle-overlay {
      position: fixed;
      bottom: 80px;
      left: 0;
      right: 0;
      z-index: 100;
      pointer-events: none;
      display: none;
      text-align: center;
    }
    
    #subtitle-text {
      background: rgba(0, 0, 0, 0.8);
      color: #ffffff;
      padding: 12px 32px;
      border-radius: 8px;
      font-size: 28px;
      font-weight: normal;
      text-align: center;
      line-height: 1.5;
      /* 블록 요소로 변경 */
      display: inline-block;
      /* 단어 단위 줄바꿈 (한글 어절 유지) */
      word-break: keep-all;
      word-wrap: break-word;
      /* 최대 너비 제한 */
      max-width: 90vw;
      margin: 0 auto;
    }
    
    #notice-text-wrapper {
      display: flex;
      white-space: nowrap;
      animation: scroll linear infinite;
    }
    
    .notice-text-content {
      display: inline-block;
      white-space: nowrap;
      padding-right: 0; /* 텍스트 자체에 간격이 포함됨 */
    }
    
    @keyframes scroll {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    
    #loading-screen {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 200;
    }
    
    .spinner {
      width: 50px;
      height: 50px;
      border: 3px solid #333;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin { to { transform: rotate(360deg); } }
    
    #loading-screen p { color: #666; margin-top: 20px; }
    
    #error-screen {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: #000;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #fff;
      z-index: 200;
    }
    
    /* 빈 플레이리스트 대기 화면 */
    #empty-playlist-screen {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #fff;
      z-index: 180;
    }
    
    #empty-playlist-screen .icon {
      font-size: 80px;
      margin-bottom: 30px;
      animation: pulse 2s ease-in-out infinite;
    }
    
    #empty-playlist-screen .message {
      font-size: 28px;
      font-weight: 300;
      margin-bottom: 15px;
    }
    
    #empty-playlist-screen .sub-message {
      font-size: 16px;
      color: #888;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 0.5; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.05); }
    }
    
    .hidden { display: none !important; }
    
    /* 동기화 인디케이터 */
    #sync-indicator {
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.7);
      color: #4ade80;
      padding: 5px 10px;
      border-radius: 20px;
      font-size: 12px;
      z-index: 150;
      opacity: 0;
      transition: opacity 0.3s;
    }
    #sync-indicator.show { opacity: 1; }
    
    /* 전체화면 컨트롤 버튼 */
    #fullscreen-controls {
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 190;
      display: flex;
      gap: 10px;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }

    #fullscreen-hint {
      position: fixed;
      right: 20px;
      bottom: 20px;
      background: rgba(0, 0, 0, 0.65);
      color: #fff;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 200;
      display: none;
      cursor: pointer;
      user-select: none;
    }

    body.not-fullscreen #fullscreen-hint {
      display: block;
    }
    
    /* 전체화면일 때 마우스 움직이면 표시 (JS로 제어) */
    body.is-fullscreen.mouse-active #fullscreen-controls {
      opacity: 1;
      pointer-events: auto;
    }
    
    /* 전체화면 아닐 때는 항상 표시 */
    body.not-fullscreen #fullscreen-controls {
      opacity: 1;
      pointer-events: auto;
    }
    
    .control-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.5);
      border: none;
      color: rgba(255, 255, 255, 0.7);
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    
    .control-btn:hover {
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      transform: scale(1.1);
    }
    
    /* 전체화면일 때 확대 버튼 숨김 */
    body.is-fullscreen #btn-fullscreen {
      display: none;
    }
  </style>
</head>
<body>
  <!-- 로딩 화면을 먼저 표시 (외부 리소스 없이) -->
  <div id="loading-screen">
    <div class="spinner"></div>
    <p>로딩 중...</p>
  </div>
  
  <div id="error-screen">
    <div style="font-size: 60px; color: #ef4444; margin-bottom: 20px;">⚠️</div>
    <p id="error-message">플레이리스트를 찾을 수 없습니다.</p>
    <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 30px; background: #3b82f6; color: #fff; border: none; border-radius: 8px; cursor: pointer;">
      다시 시도
    </button>
  </div>
  
  <!-- 빈 플레이리스트 대기 화면 -->
  <div id="empty-playlist-screen">
    <div class="icon">📺</div>
    <div class="message">재생할 영상을 준비 중입니다</div>
    <div class="sub-message">관리자 페이지에서 영상을 추가해 주세요</div>
  </div>
  
  <!-- 재생시간 외 화면 -->
  <div id="schedule-screen">
    <div class="clock" id="current-clock">00:00</div>
    <div class="message">재생 시간이 아닙니다</div>
    <div style="margin-top: 30px; color: #444; font-size: 18px;">
      <span id="schedule-info"></span>
    </div>
  </div>
  
  <!-- 미디어 컨테이너 - 모든 아이템을 미리 로드 -->
  <div id="media-container"></div>
  
  <!-- 로고 오버레이 -->
  <div id="logo-overlay" style="display: none;">
    <img id="logo-img" src="" alt="Logo">
  </div>
  
  <div id="notice-bar" style="display: none;">
    <div id="notice-text-wrapper">
      <span class="notice-text-content" id="notice-text-1"></span>
      <span class="notice-text-content" id="notice-text-2"></span>
    </div>
  </div>
  
  <!-- 자막 오버레이 -->
  <div id="subtitle-overlay">
    <div id="subtitle-text"></div>
  </div>
  
  <div id="sync-indicator">✓ 업데이트됨</div>
  
  <!-- 전체화면 컨트롤 버튼 (TV에서는 전체화면 진입만 가능) -->
  <div id="fullscreen-controls">
    <button id="btn-fullscreen" class="control-btn" title="전체화면으로 보기">⛶</button>
    <button id="btn-admin" class="control-btn" title="관리자 페이지" style="font-size:14px;">관리</button>
  </div>
  <div id="fullscreen-hint">전체화면 유지하려면 클릭</div>

  <script>
    // 즉시 로딩 화면 표시
    document.getElementById('loading-screen').style.display = 'flex';
  </script>
  
  <!-- API는 나중에 비동기 로드 -->
  <script>
    // [독립 실행 보장] 클라이언트 고유 ID 생성
    const SHORT_CODE = '${shortCode}';
    const CLIENT_ID = 'client_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    
    // [중요] Page Visibility API 무력화 (백그라운드에서도 재생 유지)
    function overrideVisibility() {
      try {
        const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
        if (!hiddenDescriptor || hiddenDescriptor.configurable) {
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        }
        const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
        if (!visibilityDescriptor || visibilityDescriptor.configurable) {
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
        }
      } catch (e) {
        console.log('visibility override skipped:', e?.message || e);
      }
    }
    overrideVisibility();
    window.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);

    const IS_PREVIEW = new URLSearchParams(window.location.search).get('preview') === '1';
    let playlist = null;
    let notices = [];
    let currentIndex = 0;
    let isYTReady = false;
    let transitionEffect = 'fade';
    let transitionDuration = 500;
    
    // 이 TV의 실제 admin_code와 email (API에서 수신 - 로그인 계정과 독립적으로 저장)
    let tvAdminCode = null;
    let tvAdminEmail = null;
    
    // 안정성 강화 변수
    let isTransitioning = false; // 중복 전환 방지
    let wakeLock = null; // 화면 꺼짐 방지
    let lastPlaybackTime = Date.now(); // 워치독용
    let isLoadingData = false;
    let pendingLoad = false;
    let playbackWatchdog = null;
    
    // 미디어 아이템별 관리
    let players = {};  // index -> player
    let itemsReady = {};  // index -> boolean
    let allItemsLoaded = false;
    let currentTimer = null;
    let dataVersion = '';
    
    // 전체화면 상태 추적 (DOM 조작 중에도 유지) - TV는 항상 전체화면
    let shouldBeFullscreen = true;
    
    // 미리보기 모드일 때 스타일 조정
    if (IS_PREVIEW) {
      document.body.classList.add('preview-mode');
    }
    
    // 공통 공지 설정
    let noticeSettings = { font_size: 32, letter_spacing: 0, text_color: '#ffffff', bg_color: '#1a1a2e', bg_opacity: 100, scroll_speed: 50, position: 'bottom' };
    
    // 로고 설정
    let logoSettings = { url: '', size: 150, opacity: 90 };
    
    // 자막 관련
    let subtitles = {};  // vimeoId -> parsed subtitles
    let currentSubtitleTimer = null;
    
    // 자막 스타일 설정
    let subtitleSettings = { font_size: 28, bg_opacity: 80, text_color: '#ffffff', bg_color: '#000000', position: 'bottom', bottom_offset: 80 };
    
    // 재생 시간 설정
    let scheduleSettings = { enabled: 0, start: '', end: '' };
    let scheduleCheckInterval = null;
    let isScheduleActive = true;
    
    // Wake Lock 활성화 (화면 꺼짐 방지)
    async function enableWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
          console.log('Wake Lock active');
          wakeLock.addEventListener('release', () => {
            console.log('Wake Lock released');
            // 다시 활성화 시도
            setTimeout(enableWakeLock, 1000);
          });
        }
      } catch (err) {
        console.error('Wake Lock failed:', err);
      }
    }

    // [핵심] 백그라운드 재생 유지 (Page Visibility API 무력화)
    Object.defineProperty(document, 'hidden', { get: () => false });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    
    // [핵심] 브라우저 스로틀링 방지용 무음 오디오
    let audioCtx;
    function startKeepAlive() {
      if (audioCtx) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        audioCtx = new AudioContext();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = 1; 
        gain.gain.value = 0.001; 
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        console.log('🔊 Background keep-alive active');
      } catch(e) {}
    }
    document.addEventListener('click', startKeepAlive);
    document.addEventListener('touchstart', startKeepAlive);

    // 워치독: 단순 감시 모드
    function initWatchdog() {
      setInterval(() => {
        const now = Date.now();
        if (now - lastPlaybackTime > 300000 && !isScheduleActive) {
          console.log('Watchdog: Stuck > 5min, reloading');
          window.location.reload();
        }
      }, 10000);
    }

    // YouTube/Vimeo API 동적 로드
    let isVimeoReady = false;
    
    function loadYouTubeAPI() {
      return new Promise((resolve) => {
        if (window.YT && window.YT.Player) {
          isYTReady = true;
          resolve();
          return;
        }
        window.onYouTubeIframeAPIReady = function() {
          isYTReady = true;
          resolve();
        };
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      });
    }
    
    function loadVimeoAPI() {
      return new Promise((resolve) => {
        if (window.Vimeo && window.Vimeo.Player) {
          isVimeoReady = true;
          resolve();
          return;
        }
        const tag = document.createElement('script');
        tag.src = 'https://player.vimeo.com/api/player.js';
        tag.onload = function() {
          isVimeoReady = true;
          resolve();
        };
        document.head.appendChild(tag);
      });
    }
    
    function onYouTubeIframeAPIReady() {
      isYTReady = true;
    }
    
    // 재생 시간 체크
    function checkSchedule() {
      // 재생시간 설정이 비활성화되어 있거나 시간 설정이 없으면 항상 재생
      if (!scheduleSettings.enabled || (!scheduleSettings.start && !scheduleSettings.end)) {
        if (!isScheduleActive) {
          isScheduleActive = true;
          hideScheduleScreen();
        }
        return true;
      }
      
      const now = new Date();
      const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      
      let inSchedule = true;
      
      if (scheduleSettings.start && scheduleSettings.end) {
        // 시작/종료 모두 설정된 경우
        if (scheduleSettings.start <= scheduleSettings.end) {
          // 같은 날 (예: 09:00 ~ 18:00)
          inSchedule = currentTime >= scheduleSettings.start && currentTime <= scheduleSettings.end;
        } else {
          // 자정 넘김 (예: 22:00 ~ 06:00)
          inSchedule = currentTime >= scheduleSettings.start || currentTime <= scheduleSettings.end;
        }
      } else if (scheduleSettings.start) {
        // 시작 시간만 설정
        inSchedule = currentTime >= scheduleSettings.start;
      } else if (scheduleSettings.end) {
        // 종료 시간만 설정
        inSchedule = currentTime <= scheduleSettings.end;
      }
      
      if (inSchedule && !isScheduleActive) {
        isScheduleActive = true;
        hideScheduleScreen();
        // 재생 재시작
        if (playlist && playlist.items && playlist.items.length > 0) {
          startPlayback();
        }
      } else if (!inSchedule && isScheduleActive) {
        isScheduleActive = false;
        showScheduleScreen();
        // 모든 재생 중지
        stopAllPlayback();
      }
      
      // 시간 외 화면 시계 업데이트
      if (!inSchedule) {
        updateScheduleClock();
      }
      
      return inSchedule;
    }
    
    function showScheduleScreen() {
      document.getElementById('schedule-screen').style.display = 'flex';
      const info = document.getElementById('schedule-info');
      if (scheduleSettings.start && scheduleSettings.end) {
        info.textContent = '재생 시간: ' + scheduleSettings.start + ' ~ ' + scheduleSettings.end;
      } else if (scheduleSettings.start) {
        info.textContent = '재생 시작 시간: ' + scheduleSettings.start;
      } else if (scheduleSettings.end) {
        info.textContent = '재생 종료 시간: ' + scheduleSettings.end;
      }
    }
    
    function hideScheduleScreen() {
      document.getElementById('schedule-screen').style.display = 'none';
    }
    
    function updateScheduleClock() {
      const now = new Date();
      const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      document.getElementById('current-clock').textContent = timeStr;
    }
    
    function stopAllPlayback() {
      // 모든 플레이어 정지
      if (currentTimer) {
        clearTimeout(currentTimer);
        currentTimer = null;
      }
      Object.keys(players).forEach(idx => {
        const p = players[idx];
        if (p) {
          try {
            if (p.pause) p.pause();
            else if (p.pauseVideo) p.pauseVideo();
          } catch(e) {}
        }
      });
    }
    
    // 로고 표시
    function showLogo() {
      if (logoSettings.url) {
        const overlay = document.getElementById('logo-overlay');
        const img = document.getElementById('logo-img');
        img.src = logoSettings.url;
        img.style.width = logoSettings.size + 'px';
        img.style.opacity = (logoSettings.opacity / 100).toString();
        overlay.style.display = 'block';
      } else {
        document.getElementById('logo-overlay').style.display = 'none';
      }
    }
    
    let currentTempVideo = null; // 현재 클라이언트의 임시 영상 상태
    let tempVideoLoopCount = 0; // 임시 영상 반복 횟수 추적
    let originalPlaylist = null; // 원본 플레이리스트 저장
    
    // 서버에 임시 영상 해제 요청 (영상 끝나면 자동 복귀용)
    async function clearTempVideoOnServer() {
      console.log('=== clearTempVideoOnServer ===');
      
      try {
        const res = await fetch('/api/tv/' + SHORT_CODE + '/clear-temp', { method: 'POST' });
        if (res.ok) {
          console.log('Temp video cleared on server - waiting for next poll');
          // 서버에만 요청, 실제 복귀는 loadData 폴링에서 처리
        }
      } catch (e) {
        console.log('Clear temp error:', e);
      }
    }
    
    // 안전한 재생 재시작 (전체화면 유지)
    function safeRestartPlayback() {
      // 빈 플레이리스트 처리
      if (!playlist || !playlist.items || playlist.items.length === 0) {
        console.log('[safeRestartPlayback] Playlist is empty, showing waiting screen');
        showEmptyPlaylistScreen();
        return;
      }
      
      console.log('safeRestartPlayback called, items:', playlist.items.length);
      
      // 전체화면 상태 저장
      const wasFullscreen = !!document.fullscreenElement;
      
      // 타이머 정리
      if (currentTimer) {
        clearTimeout(currentTimer);
        currentTimer = null;
      }
      clearVimeoTimers();
      hideSubtitle(); // 자막 타이머 및 표시 정리
      vimeoSessionId++;
      
      // 기존 플레이어 정리
      const oldPlayers = Object.values(players).filter(p => p);
      players = {};
      itemsReady = {};
      preloadedPlayers = {};
      
      // 기존 플레이어 즉시 파괴
      oldPlayers.forEach(p => {
        try { p.destroy(); } catch(e) {}
      });
      
      // 기존 미디어 컨테이너 내용 완전 제거
      const container = document.getElementById('media-container');
      if (container) {
        container.innerHTML = '';
      }
      
      // 인덱스 범위 체크
      if (currentIndex >= playlist.items.length) {
        currentIndex = 0;
      }
      
      // 새 미디어 초기화
      initializeAllMedia();
      startPlaybackWatchdog();
      
      // 전체화면 명시적 복원 (DOM 조작 후)
      if (wasFullscreen && userHasInteracted) {
        setTimeout(() => {
          if (!document.fullscreenElement) {
            console.log('safeRestartPlayback: restoring fullscreen');
            document.documentElement.requestFullscreen().catch(() => {});
          }
        }, 150);
      }
    }
    
    async function loadData(isInitial = false) {
      if (isLoadingData) {
        pendingLoad = true;
        return;
      }
      isLoadingData = true;
      try {
        const res = await fetch('/api/tv/' + SHORT_CODE + '?t=' + Date.now() + '&cid=' + CLIENT_ID);
        if (!res.ok) throw new Error('플레이리스트를 찾을 수 없습니다.');
        
        const data = await res.json();
        const serverTempVideo = data.tempVideo;
        
        // 이 TV의 실제 admin_code/email을 저장 (관리자 페이지 이동 시 올바른 계정으로 연결)
        if (data.adminCode) {
          tvAdminCode = data.adminCode;
          tvAdminEmail = data.adminEmail || null;
        }
        
        // 원본 플레이리스트 항상 저장
        originalPlaylist = JSON.parse(JSON.stringify(data.playlist));
        
        // 임시 영상 상태 변경 감지
        const hadTempVideo = currentTempVideo !== null;
        const hasTempVideo = serverTempVideo !== null;
        const tempUrlChanged = (currentTempVideo?.url || null) !== (serverTempVideo?.url || null);
        
        console.log('[loadData] hadTemp:', hadTempVideo, 'hasTemp:', hasTempVideo, 'urlChanged:', tempUrlChanged);
        
        // 임시 영상 상태가 변경됨
        if (tempUrlChanged) {
          if (hasTempVideo && !hadTempVideo) {
            // 새 임시 영상 시작
            console.log('>>> 임시 영상 시작:', serverTempVideo.title);
            currentTempVideo = serverTempVideo;
            tempVideoLoopCount = 0;
            
            showSyncIndicator();
            playlist.items = [{
              id: 'temp-video',
              item_type: serverTempVideo.type,
              url: serverTempVideo.url,
              title: serverTempVideo.title,
              duration: 0,
              sort_order: 0
            }];
            currentIndex = 0;
            safeRestartPlayback();
            return;
            
          } else if (!hasTempVideo && hadTempVideo) {
            // 임시 영상 해제 - 기본 플레이리스트로 복귀
            console.log('>>> 기본 플레이리스트로 복귀');
            currentTempVideo = null;
            
            showSyncIndicator();
            playlist = originalPlaylist;
            currentIndex = 0;
            safeRestartPlayback();
            return;
            
          } else if (hasTempVideo && hadTempVideo) {
            // 임시 영상이 다른 영상으로 교체됨
            console.log('>>> 임시 영상 교체:', serverTempVideo.title);
            currentTempVideo = serverTempVideo;
            tempVideoLoopCount = 0;
            
            showSyncIndicator();
            playlist.items = [{
              id: 'temp-video',
              item_type: serverTempVideo.type,
              url: serverTempVideo.url,
              title: serverTempVideo.title,
              duration: 0,
              sort_order: 0
            }];
            currentIndex = 0;
            safeRestartPlayback();
            return;
          }
        }
        
        // 초기 로드 시 임시 영상 처리
        if (isInitial) {
          currentTempVideo = serverTempVideo;
          if (serverTempVideo) {
            console.log('[Initial] 임시 영상 있음:', serverTempVideo.title);
            playlist = {
              ...data.playlist,
              items: [{
                id: 'temp-video',
                item_type: serverTempVideo.type,
                url: serverTempVideo.url,
                title: serverTempVideo.title,
                duration: 0,
                sort_order: 0
              }]
            };
          } else {
            playlist = data.playlist;
          }
        }
        
        // 현재 임시 영상 재생 중이면 playlist 덮어쓰기 방지
        if (currentTempVideo) {
          // 임시 영상 상태 유지, playlist.items는 건드리지 않음
          // 공지/로고 등 다른 설정만 업데이트
        } else if (!isInitial) {
          // 일반 플레이리스트 업데이트
          const newItems = data.playlist.items || [];
          const oldItems = playlist?.items || [];
          const newItemCount = newItems.length;
          const oldItemCount = oldItems.length;
          
          // 아이템 개수 또는 내용이 변경되었는지 확인
          const itemsChanged = newItemCount !== oldItemCount || 
            JSON.stringify(newItems.map(i => i.id)) !== JSON.stringify(oldItems.map(i => i.id));
          
          if (itemsChanged) {
            console.log('[loadData] Playlist changed, items:', oldItemCount, '->', newItemCount);
            showSyncIndicator();
            
            // 현재 재생 중인 아이템의 URL 저장
            const currentItem = oldItems[currentIndex];
            const currentUrl = currentItem?.url;
            
            // 새 플레이리스트로 교체
            playlist = data.playlist;
            
            // 현재 재생 중이던 아이템이 새 플레이리스트에 있는지 확인
            if (currentUrl && newItemCount > 0) {
              const newIndex = newItems.findIndex(item => item.url === currentUrl);
              if (newIndex >= 0) {
                currentIndex = newIndex;
                console.log('[loadData] Same item found at new index:', newIndex, '- restarting with rebuilt media');
              } else {
                currentIndex = Math.min(currentIndex, newItemCount - 1);
                if (currentIndex < 0) currentIndex = 0;
                console.log('[loadData] Current item deleted, restarting at index:', currentIndex);
              }
            } else if (newItemCount > 0) {
              console.log('[loadData] Playlist updated, restarting from start');
              currentIndex = 0;
            }

            // 아이템 목록 변경 시 항상 재초기화 (새로 추가된 아이템 DOM 반영)
            safeRestartPlayback();
          } else {
            // 아이템은 같지만 다른 설정이 변경될 수 있으므로 playlist 업데이트
            playlist = data.playlist;
          }
        }
        
        // 공지/설정 항상 업데이트
        notices = data.notices || [];
        noticeSettings = { ...noticeSettings, ...(data.noticeSettings || {}) };
        const parsedLetterSpacing = parseFloat((noticeSettings.letter_spacing ?? 0).toString());
        noticeSettings.letter_spacing = Number.isFinite(parsedLetterSpacing) ? parsedLetterSpacing : 0;
        logoSettings = data.logoSettings || logoSettings;
        scheduleSettings = data.scheduleSettings || scheduleSettings;
        subtitleSettings = data.subtitleSettings || subtitleSettings;
        transitionEffect = playlist.transition_effect || 'fade';
        transitionDuration = playlist.transition_duration || 500;
        
        document.documentElement.style.setProperty('--transition-duration', transitionDuration + 'ms');
        
        // 자막 스타일 적용
        applySubtitleSettings();
        
        // 빈 플레이리스트 처리: 오류 대신 대기 화면 표시
        if (!playlist.items || playlist.items.length === 0) {
          console.log('[loadData] Playlist is empty, showing waiting screen');
          showEmptyPlaylistScreen();
          
          // 초기 로드 시 로딩 화면 숨기기
          if (isInitial) {
            document.getElementById('loading-screen').classList.add('hidden');
          }
          
          // 공지와 로고는 계속 표시
          if (noticeSettings.enabled !== 0) {
            showNotices();
          }
          showLogo();
          return; // 재생 시작하지 않음
        }
        
        // 플레이리스트에 아이템이 있으면 대기 화면 숨기기
        hideEmptyPlaylistScreen();
        
        // 공지 표시 (여러 공지 연달아) - enabled 체크
        if (noticeSettings.enabled !== 0) {
          showNotices();
        } else {
          document.getElementById('notice-bar').style.display = 'none';
        }
        
        // 로고 표시
        showLogo();
        
        if (isInitial) {
          // 필요한 API만 로드 (병렬 로드)
          const hasYouTube = playlist.items.some(i => i.item_type === 'youtube');
          const hasVimeo = playlist.items.some(i => i.item_type === 'vimeo');
          
          const loadPromises = [];
          if (hasYouTube) loadPromises.push(loadYouTubeAPI());
          if (hasVimeo) loadPromises.push(loadVimeoAPI());
          
          // API 로드 완료 대기 (타임아웃 5초)
          await Promise.race([
            Promise.all(loadPromises),
            new Promise(resolve => setTimeout(resolve, 5000))
          ]);
          
          document.getElementById('loading-screen').classList.add('hidden');
          
          // 재생 시간 체크 시작
          if (scheduleCheckInterval) clearInterval(scheduleCheckInterval);
          scheduleCheckInterval = setInterval(checkSchedule, 30000); // 30초마다 체크
          
          // 초기 재생 시간 체크
          if (checkSchedule()) {
            startPlayback();
          }
        }
        
      } catch (e) {
        // 초기 로드 실패: 에러 화면 표시
        if (isInitial) {
          document.getElementById('loading-screen').classList.add('hidden');
          document.getElementById('error-screen').style.display = 'flex';
          document.getElementById('error-message').textContent = e.message;
        } else {
          // 폴링 중 404 (플레이리스트 삭제됨) → 재생 중단 + 안내 화면 표시
          const status = (e && e.status) ? e.status : 0;
          // fetch 응답에서 status를 직접 확인하기 위해 별도 처리
          // 에러 메시지에 '404' 또는 '찾을 수 없습니다'가 포함되면 삭제된 것으로 판단
          const isDeleted = e.message && (
            e.message.includes('404') || 
            e.message.includes('찾을 수 없습니다') ||
            e.message.includes('not found')
          );
          if (isDeleted) {
            console.log('[loadData] Playlist deleted (404), stopping playback');
            // 재생 중단
            try { if (typeof stopAllPlayback === 'function') stopAllPlayback(); } catch(_) {}
            // 영상 숨기기
            const videoEl = document.getElementById('main-video');
            if (videoEl) videoEl.style.display = 'none';
            const ytEl = document.getElementById('youtube-player');
            if (ytEl) ytEl.style.display = 'none';
            const vmEl = document.getElementById('vimeo-player');
            if (vmEl) vmEl.style.display = 'none';
            // 에러 화면 표시
            document.getElementById('error-screen').style.display = 'flex';
            document.getElementById('error-message').textContent = '이 채널은 삭제되었습니다. TV를 다른 채널로 전환해주세요.';
            // 폴링 계속하되 빈번하지 않게 (혹시 복구될 경우 대비)
          }
        }
      } finally {
        isLoadingData = false;
        if (pendingLoad) {
          pendingLoad = false;
          setTimeout(() => loadData(false), 0);
        }
      }
    }
    
    function showSyncIndicator() {
      const indicator = document.getElementById('sync-indicator');
      indicator.classList.add('show');
      setTimeout(() => indicator.classList.remove('show'), 2000);
    }
    
    // 대기 화면 표시 상태 추적
    let isEmptyScreenShown = false;
    
    // 빈 플레이리스트 대기 화면 표시
    function showEmptyPlaylistScreen() {
      // 이미 대기 화면이 표시된 상태면 중복 처리 안 함
      if (isEmptyScreenShown) {
        return;
      }
      
      isEmptyScreenShown = true;
      
      const emptyScreen = document.getElementById('empty-playlist-screen');
      const mediaContainer = document.getElementById('media-container');
      
      if (emptyScreen) {
        emptyScreen.style.display = 'flex';
      }
      if (mediaContainer) {
        mediaContainer.style.display = 'none';
      }
      
      // 재생 중인 것 모두 정리 (한 번만)
      stopAllPlayback();
    }
    
    // 빈 플레이리스트 대기 화면 숨기기
    function hideEmptyPlaylistScreen() {
      isEmptyScreenShown = false;
      
      const emptyScreen = document.getElementById('empty-playlist-screen');
      const mediaContainer = document.getElementById('media-container');
      
      if (emptyScreen) {
        emptyScreen.style.display = 'none';
      }
      if (mediaContainer) {
        mediaContainer.style.display = 'block';
      }
    }
    
    // 모든 재생 정지 (타이머, 플레이어 정리)
    function stopAllPlayback() {
      console.log('[stopAllPlayback] Stopping all playback');
      
      // 타이머 정리
      if (currentTimer) {
        clearTimeout(currentTimer);
        currentTimer = null;
      }
      clearVimeoTimers();
      
      // 모든 플레이어 정리
      Object.values(players).forEach(player => {
        if (player) {
          try { player.destroy(); } catch(e) {}
        }
      });
      players = {};
      itemsReady = {};
      preloadedPlayers = {};
      
      // 미디어 컨테이너 비우기
      const container = document.getElementById('media-container');
      if (container) {
        container.innerHTML = '';
      }
    }
    
    // 여러 공지를 연달아 보여주기 (무한 연속 스크롤)
    function showNotices() {
      const bar = document.getElementById('notice-bar');
      const wrapper = document.getElementById('notice-text-wrapper');
      const text1 = document.getElementById('notice-text-1');
      const text2 = document.getElementById('notice-text-2');
      
      // 활성화된 공지가 없으면 숨김
      if (!notices || notices.length === 0) {
        bar.style.display = 'none';
        return;
      }
      
      const fontSize = noticeSettings.font_size || 32;
      
      // 긴급공지가 있는지 확인
      const hasUrgent = notices.some(n => n.is_urgent);
      
      // 배경색 설정 (긴급공지가 있으면 파란색)
      let bgColor, bgOpacity, textColor;
      if (hasUrgent) {
        bgColor = '#2563eb'; // blue-600
        bgOpacity = 0.95;
        textColor = '#ffffff';
      } else {
        bgColor = noticeSettings.bg_color || '#1a1a2e';
        bgOpacity = (noticeSettings.bg_opacity ?? 100) / 100;
        textColor = noticeSettings.text_color || '#ffffff';
      }
      
      // hex를 rgba로 변환
      const r = parseInt(bgColor.slice(1,3), 16);
      const g = parseInt(bgColor.slice(3,5), 16);
      const b = parseInt(bgColor.slice(5,7), 16);
      bar.style.backgroundColor = 'rgba(' + r + ',' + g + ',' + b + ',' + bgOpacity + ')';
      bar.style.display = 'block';
      
      // 공지 위치 적용
      const position = noticeSettings.position || 'bottom';
      bar.classList.remove('position-top', 'position-bottom');
      bar.classList.add('position-' + position);
      
      // 각 공지 사이에 짧은 간격만 (별표 없음)
      const spacer = '\u00A0\u00A0\u00A0\u00A0';
      const combinedContent = notices.map(n => n.content).join(spacer);
      
      // 두 개의 동일한 텍스트로 연속 스크롤 효과 (끝에도 간격 추가)
      text1.textContent = combinedContent + spacer;
      text2.textContent = combinedContent + spacer;
      
      // 스타일 적용
      const letterSpacing = noticeSettings.letter_spacing ?? 0;
      const safeLetterSpacing = Number.isFinite(Number(letterSpacing)) ? Number(letterSpacing) : 0;
      [text1, text2].forEach(el => {
        el.style.color = textColor;
        el.style.fontSize = fontSize + 'px';
        el.style.letterSpacing = safeLetterSpacing + 'px';
        el.style.fontWeight = 'bold';
        el.style.textShadow = 'none'; // 겹침 현상 방지
      });
      
      // 공지창 패딩 최소화 - 폰트가 꽉 차게
      const padding = Math.max(4, Math.round(fontSize * 0.1));
      bar.style.padding = padding + 'px 0';
      bar.style.minHeight = (fontSize + padding * 2 + 4) + 'px';
      
      // 스크롤 속도 계산 - 더 부드럽고 구분되게
      const speed = noticeSettings.scroll_speed || 50;
      // 속도 구간별로 명확한 차이
      // 10-30: 매우 느림 (60-40초)
      // 30-70: 보통 (40-25초)  
      // 70-120: 빠름 (25-12초)
      // 120-200: 매우 빠름 (12-5초)
      let baseDuration;
      if (speed <= 30) {
        baseDuration = 60 - (speed - 10) * 1;  // 60 ~ 40초
      } else if (speed <= 70) {
        baseDuration = 40 - (speed - 30) * 0.375;  // 40 ~ 25초
      } else if (speed <= 120) {
        baseDuration = 25 - (speed - 70) * 0.26;  // 25 ~ 12초
      } else {
        baseDuration = 12 - (speed - 120) * 0.0875;  // 12 ~ 5초
      }
      baseDuration = Math.max(5, baseDuration);
      
      // 공지 개수에 따른 추가 시간 (개당 40% 증가)
      const totalDuration = baseDuration * Math.max(1, 1 + (notices.length - 1) * 0.4);
      wrapper.style.animationDuration = totalDuration + 's';
    }
    
    // ========== 새로운 재생 시스템: 프리로드 방식 ==========
    
    let preloadedPlayers = {};  // 프리로드된 Vimeo 플레이어
    let preloadingIndex = -1;   // 현재 프리로드 중인 인덱스
    
    // 모든 미디어 아이템을 미리 로드
    function initializeAllMedia() {
      const container = document.getElementById('media-container');
      if (!container) {
        console.error('media-container not found');
        return;
      }
      
      // 안전 체크: playlist가 없거나 비어있으면 대기 화면 표시
      if (!playlist || !playlist.items || playlist.items.length === 0) {
        console.log('[initializeAllMedia] Playlist is empty, showing waiting screen');
        showEmptyPlaylistScreen();
        return;
      }
      
      // 대기 화면 숨기기 (아이템이 있으므로)
      hideEmptyPlaylistScreen();
      
      // currentIndex 범위 체크
      if (currentIndex >= playlist.items.length) {
        console.log('initializeAllMedia: adjusting currentIndex', currentIndex, '->', 0);
        currentIndex = 0;
      }
      
      // DocumentFragment 사용하여 DOM 조작 최소화 (전체화면 유지)
      const fragment = document.createDocumentFragment();
      
      // 기존 자식들 숨기기만 (제거는 나중에)
      const oldChildren = Array.from(container.children);
      oldChildren.forEach(child => {
        child.style.display = 'none';
      });
      
      // 나중에 비동기로 제거
      setTimeout(() => {
        oldChildren.forEach(child => {
          try { container.removeChild(child); } catch(e) {}
        });
      }, 500);
      
      players = {};
      itemsReady = {};
      preloadedPlayers = {};
      
      playlist.items.forEach((item, index) => {
        const div = document.createElement('div');
        div.id = 'media-item-' + index;
        div.className = 'media-item' + (index === currentIndex ? ' active' : '');
        container.appendChild(div);
        
        itemsReady[index] = false;
        
        switch (item.item_type) {
          case 'youtube':
            setupYouTube(item, index);
            break;
          case 'vimeo':
            // Vimeo는 처음에 컨테이너만 생성, 플레이어는 나중에
            setupVimeoContainer(item, index);
            break;
          case 'image':
            setupImage(item, index);
            break;
        }
      });
      
      // 현재 인덱스 기준으로 프리로드 후 재생 시작
      preloadAndStart(currentIndex);
    }
    
    // Vimeo 컨테이너만 생성 (플레이어는 나중에)
    function setupVimeoContainer(item, index) {
      const container = document.getElementById('media-item-' + index);
      // 배경 투명하게 - 전환 중에 이전 영상이 보이도록
      container.innerHTML = '<div id="vimeo-' + index + '" style="width:100%;height:100%;"></div>';
      itemsReady[index] = true;  // 컨테이너 준비 완료
    }
    
    // Vimeo 플레이어 프리로드
    function preloadVimeo(index, callback) {
      const item = playlist.items[index];
      if (!item || item.item_type !== 'vimeo') {
        if (callback) callback();
        return;
      }
      
      const videoId = extractVimeoId(item.url);
      if (!videoId) {
        if (callback) callback();
        return;
      }
      
      // 기존 플레이어/프리로드 정리 (매번 새로 생성)
      if (preloadedPlayers[index]) {
        try { preloadedPlayers[index].destroy(); } catch(e) {}
        delete preloadedPlayers[index];
      }
      if (players[index]) {
        try { players[index].destroy(); } catch(e) {}
        players[index] = null;
      }
      
      console.log('Preloading Vimeo:', index, videoId);
      preloadingIndex = index;
      
      const container = document.getElementById('media-item-' + index);
      if (!container) {
        if (callback) callback();
        return;
      }
      
      container.innerHTML = '<div id="vimeo-preload-' + index + '" style="width:100%;height:100%;"></div>';
      
      try {
        const player = new Vimeo.Player('vimeo-preload-' + index, {
          id: videoId,
          width: '100%',
          height: '100%',
          autoplay: false,
          controls: false,
          loop: false,
          muted: true,
          background: false,
          playsinline: true,
          transparent: false,
          texttrack: false
        });
        
        player.ready().then(() => {
          // Vimeo 내장 자막 강제 비활성화
          player.disableTextTrack().catch(() => {});
          
          console.log('Vimeo preload ready:', index);
          preloadedPlayers[index] = player;
          preloadingIndex = -1;
          if (callback) callback();
        }).catch((err) => {
          console.log('Vimeo preload error:', index, err);
          preloadingIndex = -1;
          if (callback) callback();
        });
        
        // 3초 타임아웃
        setTimeout(() => {
          if (preloadingIndex === index) {
            console.log('Vimeo preload timeout:', index);
            preloadedPlayers[index] = player;
            preloadingIndex = -1;
            if (callback) callback();
          }
        }, 3000);
        
      } catch (e) {
        console.log('Vimeo preload exception:', index, e);
        preloadingIndex = -1;
        if (callback) callback();
      }
    }
    
    // 프리로드 후 재생 시작
    function preloadAndStart(index) {
      console.log('Starting playback from index:', index);
      currentIndex = index;
      
      const item = playlist.items[index];
      
      // 첫 번째 아이템 표시
      const firstDiv = document.getElementById('media-item-' + index);
      if (firstDiv) firstDiv.classList.add('active');
      
      // Vimeo는 플레이어 생성 후 재생
      if (item.item_type === 'vimeo') {
        createAndPlayVimeoForStart(index, item);
      } else if (item.item_type === 'youtube') {
        // YouTube는 플레이어가 준비된 후 재생
        startYouTubeWhenReady(index, item);
      } else {
        // Image는 바로 재생
        startCurrentItem();
      }
    }
    
    // YouTube 플레이어가 준비된 후 재생 시작
    function startYouTubeWhenReady(index, item) {
      console.log('startYouTubeWhenReady:', index, 'isYTReady:', isYTReady);
      
      // YouTube API가 아직 로드되지 않았으면 로드 후 재시도
      if (!isYTReady) {
        console.log('YouTube API not ready, loading...');
        loadYouTubeAPI().then(() => {
          console.log('YouTube API loaded, setting up player');
          setupYouTube(item, index);
          startYouTubeWhenReady(index, item);
        });
        return;
      }
      
      // 플레이어가 아직 없으면 생성 시도
      if (!players[index]) {
        console.log('YouTube player not found, setting up...');
        setupYouTube(item, index);
      }
      
      const check = setInterval(() => {
        if (players[index] && typeof players[index].playVideo === 'function') {
          clearInterval(check);
          console.log('YouTube player ready, starting:', index);
          try {
            players[index].mute();
            players[index].setVolume(0);
            players[index].seekTo(0);
            players[index].playVideo();
          } catch(e) {
            console.log('YouTube play error:', e);
          }
        }
      }, 100);
      
      // 15초 타임아웃
      setTimeout(() => {
        clearInterval(check);
        if (!players[index] || typeof players[index].playVideo !== 'function') {
          console.log('YouTube player timeout, moving to next');
          goToNext();
        }
      }, 15000);
    }
    
    // 첫 시작용 Vimeo 플레이어 생성
    function createAndPlayVimeoForStart(idx, item) {
      const videoId = extractVimeoId(item.url);
      if (!videoId) {
        currentTimer = setTimeout(() => goToNext(), 3000);
        return;
      }
      
      const container = document.getElementById('media-item-' + idx);
      if (!container) {
        currentTimer = setTimeout(() => goToNext(), 3000);
        return;
      }
      
      // 기존 플레이어 파괴
      if (players[idx]) {
        try { players[idx].destroy(); } catch(e) {}
        players[idx] = null;
      }
      
      // 세션 설정
      clearVimeoTimers();
      vimeoSessionId++;
      const thisSession = vimeoSessionId;
      console.log('createAndPlayVimeoForStart - new session:', thisSession);
      
      container.innerHTML = '<div id="vimeo-player-' + idx + '-' + Date.now() + '" style="width:100%;height:100%;"></div>';
      const playerId = container.firstChild.id;
      
      try {
        const player = new Vimeo.Player(playerId, {
          id: videoId,
          width: '100%',
          height: '100%',
          autoplay: false,
          controls: false,
          loop: false,
          muted: true,
          background: false,
          playsinline: true,
          transparent: false,
          texttrack: false
        });
        
        players[idx] = player;
        
        // 에러는 로그만
        player.on('error', (err) => {
          console.log('Vimeo error (ignored):', err.name, 'idx:', idx);
        });
        
        player.ready().then(() => {
          if (thisSession !== vimeoSessionId) {
            console.log('Session changed, skipping first start');
            return;
          }
          if (currentIndex === idx) {
            console.log('First Vimeo ready:', idx, 'session:', thisSession);
            // autoplay=true이므로 play() 호출 불필요 - PlayInterrupted 방지
            startVimeoPlayback(player, idx);
            
            // Vimeo 내장 자막 비활성화
            setTimeout(() => {
              player.disableTextTrack().catch(() => {});
            }, 1000);
          }
        }).catch((e) => {
          console.log('Vimeo ready failed:', e);
          if (thisSession === vimeoSessionId) {
            currentTimer = setTimeout(() => goToNext(), 3000);
          }
        });
      } catch (e) {
        console.log('Vimeo player creation failed:', e);
        currentTimer = setTimeout(() => goToNext(), 3000);
      }
    }
    
    function setupYouTube(item, index) {
      const videoId = extractYouTubeId(item.url);
      if (!videoId) { 
        itemsReady[index] = true;
        return; 
      }
      
      const container = document.getElementById('media-item-' + index);
      container.innerHTML = '<div id="yt-' + index + '" style="width:100%;height:100%;"></div>';
      
      function create() {
        players[index] = new YT.Player('yt-' + index, {
          videoId: videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            mute: 1,
            controls: 0, disablekb: 1, fs: 0, modestbranding: 1,
            rel: 0, showinfo: 0, iv_load_policy: 3, playsinline: 1,
            cc_load_policy: 1, cc_lang_pref: 'ko',
            origin: window.location.origin
          },
          events: {
            onReady: () => {
              console.log('YouTube ready:', index);
              itemsReady[index] = true;
              try {
                players[index].mute();
                players[index].setVolume(0);
              } catch(e) {}
              // 자막 활성화 시도
              try {
                players[index].setOption('captions', 'track', {'languageCode': 'ko'});
              } catch(e) {}
              if (currentIndex === index) {
                try { players[index].playVideo(); } catch (e) {}
              }
            },
            onStateChange: (e) => {
              if (e.data === YT.PlayerState.ENDED && currentIndex === index) {
                console.log('YouTube ended:', index);
                goToNext();
              }
            },
            onError: () => {
              itemsReady[index] = true;
              if (currentIndex === index) goToNext();
            }
          }
        });
      }
      
      if (isYTReady) create();
      else {
        const check = setInterval(() => {
          if (isYTReady) { clearInterval(check); create(); }
        }, 50);
      }
    }
    
    // setupVimeo는 더 이상 사용하지 않음 - preloadVimeo와 createAndPlayVimeo 사용
    
    function setupImage(item, index) {
      const container = document.getElementById('media-item-' + index);
      
      const img = new Image();
      img.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);min-width:100%;min-height:100%;width:auto;height:auto;object-fit:cover;';
      
      img.onload = () => {
        container.appendChild(img);
        console.log('Image ready:', index);
        itemsReady[index] = true;
      };
      
      img.onerror = () => {
        itemsReady[index] = true;
      };
      
      img.src = item.url;
    }
    
    // ========== 자막 관련 함수 ==========
    
    // 자막 스타일 적용
    function applySubtitleSettings() {
      const overlay = document.getElementById('subtitle-overlay');
      const textEl = document.getElementById('subtitle-text');
      if (!textEl || !overlay) return;
      
      const r = parseInt(subtitleSettings.bg_color.slice(1,3), 16);
      const g = parseInt(subtitleSettings.bg_color.slice(3,5), 16);
      const b = parseInt(subtitleSettings.bg_color.slice(5,7), 16);
      
      textEl.style.fontSize = subtitleSettings.font_size + 'px';
      textEl.style.color = subtitleSettings.text_color;
      textEl.style.background = 'rgba(' + r + ',' + g + ',' + b + ',' + (subtitleSettings.bg_opacity / 100) + ')';
      
      // 위치 적용
      overlay.style.bottom = subtitleSettings.bottom_offset + 'px';
    }
    
    // SRT 자막 파싱
    function parseSRT(srtContent) {
      const subtitles = [];
      const blocks = srtContent.trim().split(/\\n\\s*\\n/);
      
      for (const block of blocks) {
        const lines = block.trim().split('\\n');
        if (lines.length >= 3) {
          const timeLine = lines[1];
          const timeMatch = timeLine.match(/(\\d{2}):(\\d{2}):(\\d{2})[,\\.](\\d{3})\\s*-->\\s*(\\d{2}):(\\d{2}):(\\d{2})[,\\.](\\d{3})/);
          
          if (timeMatch) {
            const startTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
            const endTime = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
            const text = lines.slice(2).join('\\n');
            
            subtitles.push({ startTime, endTime, text });
          }
        }
      }
      
      return subtitles;
    }
    
    // 자막 로드
    async function loadSubtitleForVimeo(vimeoId) {
      if (subtitles[vimeoId]) return subtitles[vimeoId];
      
      try {
        const res = await fetch('/api/subtitles/' + vimeoId);
        const data = await res.json();
        
        if (data.subtitle && data.subtitle.content) {
          subtitles[vimeoId] = parseSRT(data.subtitle.content);
          console.log('Subtitle loaded for Vimeo:', vimeoId, subtitles[vimeoId].length, 'cues');
          return subtitles[vimeoId];
        }
      } catch (e) {
        console.log('Subtitle load error:', e);
      }
      
      return null;
    }
    
    // 자막 표시
    function showSubtitle(text) {
      const overlay = document.getElementById('subtitle-overlay');
      const textEl = document.getElementById('subtitle-text');
      
      if (!overlay || !textEl) return;
      
      if (text) {
        // 기존 내용 완전히 제거 후 새로 설정
        textEl.textContent = '';
        textEl.innerHTML = text.replace(/\\n/g, '<br>');
        overlay.style.display = 'block';
      } else {
        textEl.textContent = '';
        textEl.innerHTML = '';
        overlay.style.display = 'none';
      }
    }
    
    // 자막 숨기기
    function hideSubtitle() {
      document.getElementById('subtitle-overlay').style.display = 'none';
      if (currentSubtitleTimer) {
        clearInterval(currentSubtitleTimer);
        currentSubtitleTimer = null;
      }
    }
    
    // 자막 동기화 시작
    function startSubtitleSync(player, vimeoId, idx) {
      const subs = subtitles[vimeoId];
      if (!subs || subs.length === 0) return;
      
      // 기존 타이머 정리 및 자막 숨기기
      if (currentSubtitleTimer) {
        clearInterval(currentSubtitleTimer);
        currentSubtitleTimer = null;
      }
      hideSubtitle(); // 새 자막 시작 전 기존 자막 숨기기
      
      console.log('Starting subtitle sync for:', vimeoId, 'idx:', idx);
      
      currentSubtitleTimer = setInterval(() => {
        if (currentIndex !== idx) {
          hideSubtitle();
          return;
        }
        
        player.getCurrentTime().then((currentTime) => {
          let foundSub = null;
          for (const sub of subs) {
            if (currentTime >= sub.startTime && currentTime <= sub.endTime) {
              foundSub = sub;
              break;
            }
          }
          
          if (foundSub) {
            showSubtitle(foundSub.text);
          } else {
            showSubtitle(null);
          }
        }).catch(() => {});
      }, 500); // 500ms (성능 최적화)
    }
    
    // Vimeo 세션별 상태 (각 재생 세션마다 고유 ID)
    let vimeoSessionId = 0;
    let vimeoPollingInterval = null;
    let vimeoSafetyTimeout = null;
    let cachedVimeoDuration = 0; // 영상 길이 캐시 (반복 재생용)
    
    // 모든 Vimeo 타이머 정리
    function clearVimeoTimers() {
      if (vimeoPollingInterval) {
        clearInterval(vimeoPollingInterval);
        vimeoPollingInterval = null;
      }
      if (vimeoSafetyTimeout) {
        clearTimeout(vimeoSafetyTimeout);
        vimeoSafetyTimeout = null;
      }
    }
    
    // Vimeo 재생 시작 (단순화된 버전)
    // 참고: 세션 ID는 이미 호출자(recreateVimeoPlayer, prepareAndTransitionVimeo)에서 설정됨
    function startVimeoPlayback(player, idx) {
      const thisSession = vimeoSessionId; // 현재 세션 캡처 (호출자가 이미 설정함)
      
      clearVimeoTimers();
      
      console.log('startVimeoPlayback session:', thisSession, 'idx:', idx);
      
      // 재생 시작 (실패 시 재시도 - 최대 5회)
      const tryPlay = (attempt) => {
        console.log('Vimeo play attempt:', attempt, 'session:', thisSession);
        player.play().then(() => {
          console.log('Vimeo play SUCCESS, attempt:', attempt);
          // 재생 시작 후 실제로 재생되는지 1초 뒤 확인
          setTimeout(() => {
            if (thisSession !== vimeoSessionId) return;
            player.getPaused().then((paused) => {
              console.log('Vimeo paused check:', paused, 'attempt:', attempt);
              if (paused && attempt < 5) {
                console.log('Vimeo still paused, retrying...');
                tryPlay(attempt + 1);
              }
            }).catch(() => {});
          }, 1000);
        }).catch((err) => {
          console.log('Vimeo play FAILED, attempt:', attempt, 'error:', err?.name, err?.message);
          if (attempt < 5 && thisSession === vimeoSessionId) {
            setTimeout(() => tryPlay(attempt + 1), 1500);
          }
        });
      };
      tryPlay(1);
      
      // duration 가져오고 폴링 시작
      player.getDuration().then((dur) => {
        // 세션이 변경되었으면 무시
        if (thisSession !== vimeoSessionId) {
          console.log('Session changed, ignoring:', thisSession, '!=', vimeoSessionId);
          return;
        }
        
        // duration 캐시 (반복 재생 시 사용)
        if (dur > 0) cachedVimeoDuration = dur;
        const effectiveDuration = dur > 0 ? dur : cachedVimeoDuration;
        
        console.log('Vimeo duration:', effectiveDuration, 'session:', thisSession, '(cached:', cachedVimeoDuration, ')');
        
        // 멈춤 감지용 변수
        let lastTime = 0;
        let stuckCount = 0;
        let pollCount = 0;
        
        // 폴링: 영상 끝 감지 + 멈춤 감지 (2초마다)
        vimeoPollingInterval = setInterval(() => {
          if (thisSession !== vimeoSessionId) {
            clearVimeoTimers();
            return;
          }
          
          pollCount++;
          
          player.getCurrentTime().then((time) => {
            if (thisSession !== vimeoSessionId) return;
            
            // 10초마다 진행 상황 로그
            if (pollCount % 5 === 0) {
              console.log('Vimeo progress:', Math.round(time), '/', effectiveDuration, 'session:', thisSession);
            }
            
            // 멈춤 감지: 3번 연속(6초) 시간이 안 변하면 재시작
            if (time > 0 && Math.abs(time - lastTime) < 0.5) {
              stuckCount++;
              if (stuckCount >= 3) {
                console.log('Vimeo stuck detected, restarting play...');
                stuckCount = 0;
                player.play().catch(() => {});
              }
            } else {
              stuckCount = 0;
            }
            lastTime = time;
            
            // 영상 끝 감지
            if (effectiveDuration > 0 && time >= effectiveDuration - 0.5) {
              console.log('Vimeo ended normally:', time, '/', effectiveDuration);
              clearVimeoTimers();
              goToNext();
            }
          }).catch(() => {});
        }, 2000);
        
        // 안전 타이머 (영상길이 + 3초)
        if (effectiveDuration > 0) {
          vimeoSafetyTimeout = setTimeout(() => {
            if (thisSession !== vimeoSessionId) return;
            console.log('Vimeo safety timeout, session:', thisSession);
            clearVimeoTimers();
            // vimeoSessionId는 goToNext -> prepareAndTransitionVimeo에서 증가시킴
            goToNext();
          }, (effectiveDuration + 3) * 1000);
        }
      }).catch((err) => {
        console.log('Vimeo getDuration failed:', err, 'using cached:', cachedVimeoDuration);
        if (thisSession !== vimeoSessionId) return;
        
        // 캐시된 duration 사용, 없으면 15초 후 강제 전환
        const fallbackDuration = cachedVimeoDuration > 0 ? cachedVimeoDuration : 15;
        vimeoSafetyTimeout = setTimeout(() => {
          if (thisSession !== vimeoSessionId) return;
          clearVimeoTimers();
          // vimeoSessionId는 goToNext -> prepareAndTransitionVimeo에서 증가시킴
          goToNext();
        }, (fallbackDuration + 3) * 1000);
      });
      
      // 자막 로드
      const item = playlist.items[idx];
      if (item) {
        const vimeoId = extractVimeoId(item.url);
        if (vimeoId) {
          loadSubtitleForVimeo(vimeoId).then((subs) => {
            if (subs && subs.length > 0 && thisSession === vimeoSessionId) {
              startSubtitleSync(player, vimeoId, idx);
            }
          });
        }
      }
    }
    
    // Vimeo 플레이어 재시작 (단일 아이템 반복용) - 검정화면 없이 즉시 재생
    function createAndPlayVimeo(idx, item) {
      const videoId = extractVimeoId(item.url);
      if (!videoId) {
        console.log('Invalid Vimeo ID:', item.url);
        currentTimer = setTimeout(() => goToNext(), 3000);
        return;
      }
      
      console.log('>>> createAndPlayVimeo called - idx:', idx);
      
      // 타이머 정리
      clearVimeoTimers();
      
      // 새 세션 시작
      vimeoSessionId++;
      const thisSession = vimeoSessionId;
      console.log('New session:', thisSession);
      
      // 항상 플레이어를 새로 생성 (재사용 시 재생 안 되는 문제 해결)
      console.log('Recreating player for loop');
      recreateVimeoPlayer(idx, item, videoId, thisSession);
    }
    
    // Vimeo 플레이어 완전 재생성
    function recreateVimeoPlayer(idx, item, videoId, sessionOverride = null) {
      // 세션은 호출자가 전달하거나 새로 생성
      if (sessionOverride === null) {
        vimeoSessionId++;
      }
      const thisSession = sessionOverride !== null ? sessionOverride : vimeoSessionId;
      
      const container = document.getElementById('media-item-' + idx);
      if (!container) {
        console.log('Container not found:', idx);
        currentTimer = setTimeout(() => goToNext(), 3000);
        return;
      }
      
      // 기존 플레이어 위에 새 플레이어 오버레이 (검정화면 최소화)
      const oldPlayer = players[idx];
      const newPlayerId = 'vimeo-player-' + idx + '-' + Date.now();
      const newDiv = document.createElement('div');
      newDiv.id = newPlayerId;
      newDiv.style.cssText = 'width:100%;height:100%;position:absolute;top:0;left:0;z-index:10;';
      container.style.position = 'relative';
      container.appendChild(newDiv);
      
      const playerId = newPlayerId;
      
      console.log('Creating Vimeo player:', idx, videoId, 'session:', thisSession);
      
      try {
        const player = new Vimeo.Player(playerId, {
          id: videoId,
          width: '100%',
          height: '100%',
          autoplay: false,
          controls: false,
          loop: false,
          muted: true,
          background: false,
          playsinline: true,
          transparent: false,
          texttrack: false
        });
        
        players[idx] = player;
        
        player.ready().then(() => {
          // Vimeo 내장 자막 강제 비활성화
          player.disableTextTrack().catch(() => {});
          
          // 세션 체크
          if (thisSession !== vimeoSessionId) {
            console.log('Session changed during ready, destroying player');
            try { player.destroy(); } catch(e) {}
            return;
          }
          
          console.log('Vimeo player ready:', idx, 'session:', thisSession);
          
          // 기존 플레이어 정리 (새 플레이어가 준비된 후)
          if (oldPlayer) {
            try { oldPlayer.destroy(); } catch(e) {}
          }
          // 오래된 div 요소들 정리 (새 플레이어 제외)
          const children = Array.from(container.children);
          children.forEach(child => {
            if (child.id !== playerId) {
              container.removeChild(child);
            }
          });
          
          // play() 성공/실패 상관없이 폴링 시작
          player.play().catch(() => {});
          
          if (thisSession === vimeoSessionId) {
            startVimeoPlayback(player, idx);
          }
        }).catch((err) => {
          console.log('Vimeo ready error:', idx, err);
          // 에러 시 기존 플레이어 정리
          if (oldPlayer) {
            try { oldPlayer.destroy(); } catch(e) {}
          }
          if (thisSession === vimeoSessionId) {
            currentTimer = setTimeout(() => goToNext(), 5000);
          }
        });
        
      } catch (e) {
        console.log('Vimeo create error:', idx, e);
        currentTimer = setTimeout(() => goToNext(), 5000);
      }
    }
    
    // 모든 플레이어 정리 및 재시작 (사용 중지 - safeRestartPlayback 사용)
    function clearAllPlayers() {
      console.log('clearAllPlayers -> safeRestartPlayback');
      safeRestartPlayback();
    }
    
    // 현재 아이템 재생 시작 (YouTube, Image 전용 - Vimeo는 prepareAndTransitionVimeo에서 처리)
    function startCurrentItem() {
      // 안전 체크
      if (!playlist || !playlist.items || playlist.items.length === 0) {
        console.error('startCurrentItem: playlist is empty');
        return;
      }
      if (currentIndex >= playlist.items.length) {
        console.log('startCurrentItem: adjusting currentIndex', currentIndex, '->', 0);
        currentIndex = 0;
      }
      
      const item = playlist.items[currentIndex];
      if (!item) {
        console.error('startCurrentItem: item is undefined at index', currentIndex);
        return;
      }
      console.log('Starting item:', currentIndex, item.item_type, item.url);
      
      if (item.item_type === 'youtube') {
        // YouTube 플레이어가 준비되었는지 확인
        if (players[currentIndex] && typeof players[currentIndex].playVideo === 'function') {
          try {
            players[currentIndex].mute();
            players[currentIndex].setVolume(0);
            players[currentIndex].seekTo(0);
            players[currentIndex].playVideo();
          } catch(e) {
            console.log('YouTube play error:', e);
          }
        } else {
          // 플레이어가 아직 준비되지 않음 - 준비될 때까지 대기
          startYouTubeWhenReady(currentIndex, item);
        }
      } else if (item.item_type === 'image') {
        const displayTime = (item.display_time || 10) * 1000;
        console.log('Image display time:', displayTime);
        currentTimer = setTimeout(() => goToNext(), displayTime);
      }
      // Vimeo는 prepareAndTransitionVimeo에서 직접 처리함
    }
    
    function ensurePlaybackAlive() {
      if (!playlist || !playlist.items || playlist.items.length === 0) return;
      if (isTransitioning) return;
      if (currentIndex >= playlist.items.length) return;

      const item = playlist.items[currentIndex];
      if (!item) return;

      if (item.item_type === 'youtube') {
        const ytPlayer = players[currentIndex];
        if (ytPlayer && typeof ytPlayer.getPlayerState === 'function' && window.YT && YT.PlayerState) {
          const state = ytPlayer.getPlayerState();
          if (state === YT.PlayerState.PAUSED || state === YT.PlayerState.UNSTARTED || state === YT.PlayerState.CUED) {
            try {
              ytPlayer.mute();
              ytPlayer.setVolume(0);
              ytPlayer.playVideo();
            } catch (e) {}
          }
        }
      } else if (item.item_type === 'vimeo') {
        const vimeoPlayer = players[currentIndex];
        if (vimeoPlayer && typeof vimeoPlayer.getPaused === 'function') {
          vimeoPlayer.getPaused().then((paused) => {
            if (paused && currentIndex < playlist.items.length) {
              vimeoPlayer.play().catch(() => {});
            }
          }).catch(() => {});
        }
      } else if (item.item_type === 'image') {
        if (!currentTimer) {
          const displayTime = (item.display_time || 10) * 1000;
          currentTimer = setTimeout(() => goToNext(), displayTime);
        }
      }
    }

    function startPlaybackWatchdog() {
      if (playbackWatchdog) {
        clearInterval(playbackWatchdog);
      }
      playbackWatchdog = setInterval(ensurePlaybackAlive, 5000);
    }
    
    // 다음 아이템으로 전환 (디졸브/크로스페이드)
    function goToNext() {
      // 중복 실행 방지 (1초 디바운스)
      if (isTransitioning) {
        console.log('Skipping goToNext: transition in progress');
        return;
      }
      isTransitioning = true;
      const transitionLockDuration = Math.max(transitionDuration || 500, 1000);
      setTimeout(() => isTransitioning = false, transitionLockDuration);
      
      // 워치독 시간 업데이트
      lastPlaybackTime = Date.now();

      // 안전 체크: playlist가 없거나 비어있으면 대기 화면 표시
      if (!playlist || !playlist.items || playlist.items.length === 0) {
        console.log('[goToNext] Playlist is empty, showing waiting screen');
        showEmptyPlaylistScreen();
        return;
      }
      
      if (currentTimer) {
        clearTimeout(currentTimer);
        currentTimer = null;
      }
      
      // 자막 숨기기
      hideSubtitle();
      
      const prevIndex = currentIndex;
      const nextIndex = (currentIndex + 1) % playlist.items.length;
      const nextItem = playlist.items[nextIndex];
      
      // 안전 체크: nextItem이 없으면 대기 화면 표시
      if (!nextItem) {
        console.log('[goToNext] nextItem is undefined, showing waiting screen');
        showEmptyPlaylistScreen();
        return;
      }
      
      console.log('Transition:', prevIndex, '->', nextIndex, nextItem.item_type);
      
      // 단일 아이템(임시 영상)일 때 return_time 체크
      if (prevIndex === nextIndex && playlist.items.length === 1) {
        // 임시 영상의 return_time 확인
        const returnTime = currentTempVideo ? currentTempVideo.return_time : null;
        console.log('========================================');
        console.log('SINGLE ITEM - checking return_time');
        console.log('currentTempVideo:', JSON.stringify(currentTempVideo));
        console.log('return_time value:', returnTime);
        console.log('return_time === "end":', returnTime === 'end');
        console.log('========================================');
        
        // 'end' = 영상 끝나면 자동 복귀 (반복 안함)
        if (returnTime === 'end') {
          console.log('>>> RETURN TIME IS END - CLEARING TEMP VIDEO <<<');
          // 서버에 임시 영상 해제 요청하고 다음 폴링에서 복귀됨
          clearTempVideoOnServer();
          return;
        }
        
        // 'manual' 또는 시간 설정 = 반복 재생
        tempVideoLoopCount++;
        console.log('========================================');
        console.log('>>> LOOP RESTART #' + tempVideoLoopCount + ' <<<');
        console.log('return_time:', returnTime);
        console.log('item_type:', nextItem.item_type);
        console.log('========================================');
        
        if (nextItem.item_type === 'vimeo') {
          // 기존 플레이어가 있으면 seek(0)으로 처음부터 재생 (검정화면 없음)
          const existingPlayer = players[nextIndex];
          if (existingPlayer && typeof existingPlayer.setCurrentTime === 'function') {
            console.log('Vimeo single loop - seeking to start (no black screen)');
            existingPlayer.setCurrentTime(0).then(() => {
              existingPlayer.play().catch(() => {});
              // 재생 시간 추적 다시 시작
              startVimeoPlayback(existingPlayer, nextIndex);
            }).catch(() => {
              // seek 실패 시 플레이어 재생성
              console.log('Vimeo seek failed, recreating player');
              createAndPlayVimeo(nextIndex, nextItem);
            });
          } else {
            // 플레이어가 없으면 새로 생성
            console.log('Vimeo single loop - creating new player');
            createAndPlayVimeo(nextIndex, nextItem);
          }
          return;
        } else if (nextItem.item_type === 'youtube') {
          // YouTube도 seek(0)으로 처음부터 재생
          const ytPlayer = players[nextIndex];
          if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
            console.log('YouTube single loop - seeking to start');
            ytPlayer.seekTo(0);
            ytPlayer.playVideo();
          } else {
            startYouTubeWhenReady(nextIndex, nextItem);
          }
          return;
        } else if (nextItem.item_type === 'image') {
          const displayTime = (nextItem.display_time || 10) * 1000;
          currentTimer = setTimeout(() => goToNext(), displayTime);
          return;
        }
      }
      
      // 다음 인덱스로 업데이트
      currentIndex = nextIndex;
      
      // Vimeo는 플레이어가 준비된 후에 전환 시작
      if (nextItem.item_type === 'vimeo') {
        prepareAndTransitionVimeo(prevIndex, nextIndex, nextItem);
      } else if (nextItem.item_type === 'youtube') {
        // YouTube는 실제 재생 시작까지 이전 화면 유지
        startYouTubeWhenReady(nextIndex, nextItem);
        const startAt = Date.now();
        const check = setInterval(() => {
          const ytPlayer = players[nextIndex];
          if (ytPlayer && typeof ytPlayer.getPlayerState === 'function' && window.YT && YT.PlayerState) {
            const state = ytPlayer.getPlayerState();
            if (state === YT.PlayerState.PLAYING) {
              clearInterval(check);
              doTransition(prevIndex, nextIndex);
              return;
            }
          }
          if (Date.now() - startAt > 3000) {
            clearInterval(check);
            doTransition(prevIndex, nextIndex);
            // 안전하게 재생 보장
            try { ytPlayer && ytPlayer.playVideo && ytPlayer.playVideo(); } catch(e) {}
          }
        }, 100);
      } else {
        // Image는 로드 완료까지 이전 화면 유지
        const startAt = Date.now();
        const check = setInterval(() => {
          if (itemsReady[nextIndex]) {
            clearInterval(check);
            doTransition(prevIndex, nextIndex);
            startCurrentItem();
            return;
          }
          if (Date.now() - startAt > 2000) {
            clearInterval(check);
            doTransition(prevIndex, nextIndex);
            startCurrentItem();
          }
        }, 100);
      }
    }
    
    // Vimeo: 플레이어가 실제 재생 시작한 후 전환
    function prepareAndTransitionVimeo(prevIndex, nextIndex, item) {
      const videoId = extractVimeoId(item.url);
      if (!videoId) {
        doTransition(prevIndex, nextIndex);
        currentTimer = setTimeout(() => goToNext(), 3000);
        return;
      }
      
      // 새 세션 시작 (이 전환의 고유 ID)
      clearVimeoTimers();
      vimeoSessionId++;
      const thisSession = vimeoSessionId;
      console.log('prepareAndTransitionVimeo - new session:', thisSession, 'nextIndex:', nextIndex);
      
      const container = document.getElementById('media-item-' + nextIndex);
      if (!container) {
        doTransition(prevIndex, nextIndex);
        currentTimer = setTimeout(() => goToNext(), 3000);
        return;
      }
      
      // 항상 새 플레이어 생성 (기존 플레이어의 에러 상태 문제 방지)
      createNewVimeoForTransition(prevIndex, nextIndex, item, videoId, thisSession, container);
    }
    
    // Vimeo 새 플레이어 생성 및 전환
    function createNewVimeoForTransition(prevIndex, nextIndex, item, videoId, thisSession, container) {
      // 기존 플레이어 정리
      if (players[nextIndex]) {
        try { players[nextIndex].destroy(); } catch(e) {}
        players[nextIndex] = null;
      }
      
      container.innerHTML = '<div id="vimeo-player-' + nextIndex + '-' + Date.now() + '" style="width:100%;height:100%;"></div>';
      const playerId = container.firstChild.id;
      
      let transitionStarted = false;
      
      try {
        const player = new Vimeo.Player(playerId, {
          id: videoId,
          width: '100%',
          height: '100%',
          autoplay: false,
          controls: false,
          loop: false,
          muted: true,
          background: false,
          playsinline: true,
          transparent: false,
          texttrack: false
        });
        
        players[nextIndex] = player;
        
        const startTransitionIfNeeded = () => {
          if (transitionStarted) return;
          transitionStarted = true;
          doTransition(prevIndex, nextIndex);
          startVimeoPlayback(player, nextIndex);
        };
        
        // 플레이어 준비되면 재생 시작
        player.ready().then(() => {
          player.disableTextTrack().catch(() => {});
          if (thisSession !== vimeoSessionId) return;
          if (currentIndex !== nextIndex) return;
          
          // 실제 재생이 시작될 때까지 이전 영상 유지
          player.on('play', startTransitionIfNeeded);
          player.on('playing', startTransitionIfNeeded);
          player.play().catch(() => {});
          
          // 2.5초 안에 재생 이벤트가 없으면 강제 전환
          setTimeout(() => {
            if (thisSession !== vimeoSessionId) return;
            startTransitionIfNeeded();
          }, 2500);
        }).catch(() => {
          if (thisSession !== vimeoSessionId) return;
          startTransitionIfNeeded();
          currentTimer = setTimeout(() => goToNext(), 3000);
        });
        
      } catch (e) {
        console.log('Vimeo transition player creation failed:', e);
        if (!transitionStarted) doTransition(prevIndex, nextIndex);
        clearVimeoTimers();
        // 에러 시 5초 후 다음으로 (세션은 다음 전환 시 증가)
        currentTimer = setTimeout(() => goToNext(), 5000);
      }
    }
    
    // 실제 전환 수행 (디졸브)
    function doTransition(prevIndex, nextIndex) {
      // 먼저 모든 아이템 숨기기 (현재 재생 중인 것 제외하고 정리)
      const allItems = document.querySelectorAll('.media-item');
      allItems.forEach((item, idx) => {
        if (idx !== nextIndex && idx !== prevIndex) {
          item.classList.remove('active');
        }
      });
      
      // 다음 아이템 보이기
      const nextDiv = document.getElementById('media-item-' + nextIndex);
      if (nextDiv) {
        nextDiv.classList.add('active');
      }

      const duration = transitionDuration || 500;
      const maxWait = 2000;
      const startAt = Date.now();

      const waitForNextReady = () => {
        if (itemsReady && itemsReady[nextIndex]) {
          return Promise.resolve();
        }
        return new Promise(resolve => {
          const interval = setInterval(() => {
            if (itemsReady && itemsReady[nextIndex]) {
              clearInterval(interval);
              resolve(true);
            } else if (Date.now() - startAt > maxWait) {
              clearInterval(interval);
              resolve(false);
            }
          }, 100);
        });
      };
      
      // 다음 아이템이 준비될 때까지 이전 아이템을 유지 (검정 화면 방지)
      waitForNextReady().then(() => {
        setTimeout(() => {
          const prevItem = playlist.items[prevIndex];
          if (prevItem) {
            if (prevItem.item_type === 'vimeo' && players[prevIndex]) {
              players[prevIndex].pause().catch(() => {});
            } else if (prevItem.item_type === 'youtube' && players[prevIndex]) {
              try { players[prevIndex].pauseVideo(); } catch(e) {}
            }
          }
          
          const prevDiv = document.getElementById('media-item-' + prevIndex);
          if (prevDiv) prevDiv.classList.remove('active');
        }, duration);
      });
    }
    
    // 재생 시작 (초기화)
    function startPlayback() {
      // 빈 플레이리스트 처리
      if (!playlist || !playlist.items || playlist.items.length === 0) {
        console.log('[startPlayback] Playlist is empty, showing waiting screen');
        showEmptyPlaylistScreen();
        return;
      }
      
      currentIndex = 0;
      initializeAllMedia();
      startPlaybackWatchdog();
    }
    
    function extractYouTubeId(url) {
      const m = url.match(/(?:youtube\\.com\\/watch\\?v=|youtu\\.be\\/|youtube\\.com\\/embed\\/|youtube\\.com\\/shorts\\/)([^&\\n?#]+)/);
      return m ? m[1] : null;
    }
    
    function extractVimeoId(url) {
      const m = url.match(/vimeo\\.com\\/(?:video\\/)?(\\d+)/);
      return m ? m[1] : null;
    }
    
    // 전체화면 상태 관리 - TV에서는 항상 전체화면 유지
    let userHasInteracted = false; // 사용자 상호작용 여부
    let fullscreenRestoreTimer = null; // 전체화면 복원 타이머
    
    function updateFullscreenState() {
      if (document.fullscreenElement) {
        document.body.classList.add('is-fullscreen');
        document.body.classList.remove('not-fullscreen');
        shouldBeFullscreen = true;
        userHasInteracted = true;
        // 복원 타이머 취소
        if (fullscreenRestoreTimer) {
          clearTimeout(fullscreenRestoreTimer);
          fullscreenRestoreTimer = null;
        }
      } else {
        document.body.classList.remove('is-fullscreen');
        document.body.classList.add('not-fullscreen');
        document.body.classList.remove('mouse-active');
        
        // 전체화면이 풀리면 무조건 복원 시도
        if (shouldBeFullscreen) {
          console.log('Fullscreen exited, scheduling restore...');
          // 기존 타이머 취소 후 새로 설정
          if (fullscreenRestoreTimer) clearTimeout(fullscreenRestoreTimer);
          fullscreenRestoreTimer = setTimeout(() => {
            if (!document.fullscreenElement && shouldBeFullscreen) {
              console.log('Restoring fullscreen now');
              document.documentElement.requestFullscreen().catch((e) => {
                console.log('Fullscreen restore failed:', e.message);
              });
            }
          }, 100);
        }
      }
    }
    
    // 전체화면 변경 이벤트 감지
    document.addEventListener('fullscreenchange', updateFullscreenState);
    
    // 초기 상태 설정
    updateFullscreenState();
    
    // 전체화면에서 마우스 움직이면 버튼 표시 (2초 후 자동 숨김)
    let mouseTimer = null;
    document.addEventListener('mousemove', () => {
      if (document.fullscreenElement) {
        document.body.classList.add('mouse-active');
        if (mouseTimer) clearTimeout(mouseTimer);
        mouseTimer = setTimeout(() => {
          document.body.classList.remove('mouse-active');
        }, 2000);
      }
    });
    
    // 전체화면 진입
    function enterFullscreen() {
      shouldBeFullscreen = true;
      userHasInteracted = true;
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    }
    
    // 전체화면 종료 (실제로는 동작 안 함 - TV에서는 항상 전체화면)
    function exitFullscreen() {
      // TV에서는 전체화면 종료 불가
    }
    
    // 전체화면 버튼 이벤트
    document.getElementById('btn-fullscreen').addEventListener('click', (e) => {
      e.stopPropagation();
      enterFullscreen();
    });

    // 관리자 버튼 이벤트 - tvAdminCode/tvAdminEmail로 직접 이동 (세션/localStorage 우회)
    document.getElementById('btn-admin').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!tvAdminCode) {
        alert('관리자 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      const adminUrl = new URL(location.origin + '/admin/' + tvAdminCode);
      if (tvAdminEmail) adminUrl.searchParams.set('email', tvAdminEmail);
      window.location.href = adminUrl.toString();
    });

    const fullscreenHint = document.getElementById('fullscreen-hint');
    if (fullscreenHint) {
      fullscreenHint.addEventListener('click', (e) => {
        e.stopPropagation();
        enterFullscreen();
      });
    }
    
    // 화면 클릭 시 전체화면 (버튼 외 영역)
    document.addEventListener('click', (e) => {
      // 버튼 클릭은 제외
      if (e.target.closest('#fullscreen-controls')) return;
      if (!document.fullscreenElement) {
        enterFullscreen();
      }
    });
    
    // 시작
    enableWakeLock(); // Wake Lock 활성화
    initWatchdog(); // 워치독 시작
    loadData(true);
    
    // 실시간 동기화 (3초마다)
    setInterval(() => loadData(false), 3 * 1000);
    
    // Heartbeat - 사용중 표시 전용 독립 폴링 (5초마다)
    setInterval(function() {
      fetch('/api/tv/' + SHORT_CODE + '/heartbeat', { method: 'POST' })
        .catch(function() {});
    }, 5000);
    
    // 탭 닫힘 시 즉시 비활성화 (sendBeacon - 언로드 중에도 전송 보장)
    function deactivateTV() {
      navigator.sendBeacon('/api/tv/' + SHORT_CODE + '/deactivate');
    }
    // capture:true 로 visibilitychange 차단 리스너보다 먼저 실행
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        deactivateTV();
      }
    }, true);
    window.addEventListener('pagehide', deactivateTV, true);
    
    // 페이지 로드 후 자동 전체화면 시도 (사용자 클릭 시)
    document.addEventListener('click', function autoFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      // 한 번만 실행
      document.removeEventListener('click', autoFullscreen);
    }, { once: true });
    
    // 주기적으로 전체화면 상태 확인 및 복원 (1초마다)
    setInterval(() => {
      if (shouldBeFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    }, 1000);
  </script>
</body>
</html>
  `)
})

// 기본 페이지
app.get('/', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>치과 TV 관리 시스템</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gradient-to-br from-blue-500 to-purple-600 min-h-screen flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full text-center">
    <i class="fas fa-tv text-6xl text-blue-500 mb-6"></i>
    <h1 class="text-3xl font-bold text-gray-800 mb-4">치과 대기실 TV</h1>
    <p class="text-gray-600 mb-8">관리 시스템</p>
    
    <div class="bg-blue-50 rounded-xl p-6 text-left mb-4">
      <h2 class="font-bold text-gray-800 mb-3"><i class="fas fa-code mr-2 text-blue-500"></i>아임웹 위젯 코드 (아임웹 로그인 자동 연동)</h2>
      <pre class="bg-gray-800 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">&lt;iframe id="dental-tv-frame" src="" width="100%" height="800" frameborder="0" style="border:none; min-height:600px;"&gt;&lt;/iframe&gt;
&lt;script&gt;
(function() {
  var host = 'https://dental-tv.pages.dev';
  var frame = document.getElementById('dental-tv-frame');
  var launched = false;

  function getMemberCode() {
    // 방법1: window.__IMWEB__.member
    try { var m = window.__IMWEB__ &amp;&amp; window.__IMWEB__.member; if (m &amp;&amp; (m.code||m.id)) return { mc: String(m.code||m.id), em: m.email||'' }; } catch(e){}

    // 방법2: __bs_imweb 쿠키에서 JWT 파싱 (아임웹 DVUE SDK)
    try {
      var cookies = document.cookie.split('; ');
      for (var i=0; i&lt;cookies.length; i++) {
        if (cookies[i].startsWith('__bs_imweb=')) {
          var data = JSON.parse(decodeURIComponent(cookies[i].substring('__bs_imweb='.length)));
          if (data.sdk_jwt) {
            var parts = data.sdk_jwt.split('.');
            if (parts.length === 3) {
              var p = JSON.parse(atob(parts[1]));
              var mc = p.sub || p.member_code || p.mc || '';
              if (mc &amp;&amp; mc.startsWith('m')) return { mc: mc, em: p.email||'' };
            }
          }
          // browser_session_id 패턴 매칭
          var match = JSON.stringify(data).match(/m\d{8,}[a-f0-9]+/);
          if (match) return { mc: match[0], em: '' };
        }
      }
    } catch(e){}

    // 방법3: window._imweb_page_info
    try { var info = window._imweb_page_info; if (info &amp;&amp; info.member_code) return { mc: info.member_code, em: info.member_email||info.email||'' }; } catch(e){}

    // 방법4: 아임웹 템플릿 변수
    var mc='{{ member_code }}', em='{{ user_email }}';
    if (mc &amp;&amp; mc.indexOf('{{') === -1) return { mc:mc, em:(em &amp;&amp; em.indexOf('{{') === -1)?em:'' };
    return null;
  }

  function launch() {
    if (launched) return;
    var info = getMemberCode();
    if (info &amp;&amp; info.mc) {
      launched = true;
      var url = host + '/embed/' + encodeURIComponent(info.mc);
      if (info.em) url += '?email=' + encodeURIComponent(info.em);
      frame.src = url;
    }
  }

  // iframe top offset을 iframe 내부로 전달하는 함수
  function sendIframeTop() {
    try {
      var rect = frame.getBoundingClientRect();
      var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      var topFromPage = rect.top + scrollY;
      frame.contentWindow.postMessage({ type: 'iframeTop', top: Math.round(topFromPage) }, '*');
    } catch(err) {}
  }

  // 최대 5초간 100ms마다 폴링
  var n=0, t=setInterval(function(){ launch(); if(launched||++n&gt;=50){ clearInterval(t); if(!launched) frame.src=host+'/not-logged-in'; }}, 100);
  // iframe 로드 완료 시 top offset 전달
  frame.addEventListener('load', function(){ setTimeout(sendIframeTop, 300); });
  // 창 리사이즈/스크롤 시 재전달
  window.addEventListener('resize', sendIframeTop);
  window.addEventListener('scroll', sendIframeTop);
  window.addEventListener('message', function(e){ if(e.data&amp;&amp;e.data.type==='setHeight'){ var newH=(e.data.height+30)+'px'; if(frame.style.height!==newH) frame.style.height=newH; } if(e.data&amp;&amp;e.data.type==='scrollToTop'){ try{ document.documentElement.scrollTop=0; document.body.scrollTop=0; frame.scrollIntoView({behavior:'instant',block:'start'}); setTimeout(sendIframeTop,50); }catch(err){} } });
})();
&lt;/script&gt;</pre>
      <p class="text-xs text-gray-500 mt-2">* 아임웹 로그인 회원의 계정으로 자동 접속됩니다 (비로그인/관리자 계정은 안내 페이지 표시)</p>
    </div>
    
    <div class="bg-purple-50 rounded-xl p-6 text-left mb-4">
      <h2 class="font-bold text-gray-800 mb-3"><i class="fas fa-crown mr-2 text-purple-500"></i>마스터 관리자 위젯 코드</h2>
      <pre class="bg-gray-800 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">&lt;iframe 
  src="${c.req.url.replace(/\/$/, '')}/master"
  width="100%" 
  height="800"
  frameborder="0"
&gt;&lt;/iframe&gt;</pre>
      <p class="text-xs text-gray-500 mt-2">* 마스터 관리자 비밀번호: dental2024master</p>
    </div>
    
    <a href="${c.req.url.replace(/\/$/, '')}/master" class="inline-block bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition">
      <i class="fas fa-crown mr-2"></i>마스터 관리자 바로가기
    </a>
  </div>
</body>
</html>
  `)
})

// ============================================
// 비로그인/관리자 계정 안내 페이지
// ============================================

app.get('/not-logged-in', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>로그인 필요</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center p-6">
  <div class="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
    <div class="text-5xl mb-4">📺</div>
    <h1 class="text-xl font-bold text-gray-800 mb-3">치과 대기실 TV</h1>
    <p class="text-gray-500 mb-6 text-sm leading-relaxed">
      이 페이지는 <strong>아임웹 회원 로그인</strong> 후 이용하실 수 있습니다.<br>
      상단 메뉴에서 로그인 후 다시 방문해 주세요.
    </p>
    <div class="bg-blue-50 rounded-xl p-4 text-left text-xs text-blue-700 mb-4">
      <p class="font-semibold mb-1">💡 안내</p>
      <p>아임웹 일반 회원 계정으로 로그인하시면<br>본인의 치과 TV 관리 화면이 자동으로 표시됩니다.</p>
    </div>
    <div id="debug-info" class="bg-yellow-50 rounded-xl p-4 text-left text-xs text-yellow-800 hidden">
      <p class="font-semibold mb-2">🔍 디버그 정보 (개발용)</p>
      <pre id="debug-text" class="whitespace-pre-wrap break-all"></pre>
    </div>
    <button id="debug-btn" onclick="runDebug()" class="mt-4 text-xs text-gray-400 underline">디버그 정보 확인</button>
  </div>
  <script>
  function runDebug() {
    var info = {};
    // 부모창(아임웹)의 객체 읽기 시도
    try {
      var p = window.parent;
      if (p && p.__IMWEB__) {
        info.__IMWEB__ = {
          member: p.__IMWEB__.member || null
        };
      } else {
        info.__IMWEB__ = 'not found';
      }
    } catch(e) { info.__IMWEB__error = e.message; }

    try {
      var p = window.parent;
      if (p && p._imweb_page_info) {
        info._imweb_page_info = p._imweb_page_info;
      } else {
        info._imweb_page_info = 'not found';
      }
    } catch(e) { info._imweb_page_infoError = e.message; }

    // 현재 창(iframe)에서도 확인
    try {
      info.self__IMWEB__ = window.__IMWEB__ ? JSON.stringify(window.__IMWEB__) : 'not found';
    } catch(e) {}

    // URL 파라미터
    info.url = window.location.href;
    info.parentUrl = '';
    try { info.parentUrl = window.parent.location.href; } catch(e) { info.parentUrl = 'cross-origin blocked'; }

    var el = document.getElementById('debug-text');
    var div = document.getElementById('debug-info');
    el.textContent = JSON.stringify(info, null, 2);
    div.classList.remove('hidden');
  }

  // 자동으로 부모창에서 회원 정보 읽어서 재시도
  setTimeout(function() {
    try {
      var p = window.parent;
      var m = p && p.__IMWEB__ && p.__IMWEB__.member;
      if (m && (m.code || m.id) && m.email) {
        var mc = m.code || m.id;
        var em = m.email;
        window.location.href = 'https://dental-tv.pages.dev/embed/' + encodeURIComponent(mc) + '?email=' + encodeURIComponent(em);
      }
    } catch(e) {}
  }, 1000);
  </script>
</body>
</html>
  `)
})

// ============================================
// 로그인 페이지 (아임웹 연동용)
// ============================================

app.get('/login', (c) => {
  const baseUrl = new URL(c.req.url).origin
  
  return c.html(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>치과 TV 로그인</title>
  <script>
    // /embed 경로에서 넘어온 경우: adminCode + email 이 URL에 모두 있으면 바로 관리자 페이지로 이동
    (function() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlAdminCode = urlParams.get('adminCode');
        const urlEmail = urlParams.get('email');
        if (urlAdminCode && urlEmail) {
          const adminUrl = new URL(window.location.origin + '/admin/' + urlAdminCode);
          adminUrl.searchParams.set('email', urlEmail);
          const isAdmin = urlParams.get('is_admin');
          if (isAdmin) adminUrl.searchParams.set('is_admin', isAdmin);
          window.location.replace(adminUrl.toString());
        }
      } catch(e) {}
    })();
  </script>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gradient-to-br from-blue-500 to-purple-600 min-h-screen flex items-center justify-center p-4">
  <div id="login-container" class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
    <div class="text-center mb-6">
      <i class="fas fa-tv text-5xl text-blue-500 mb-4"></i>
      <h1 class="text-2xl font-bold text-gray-800">치과 대기실 TV</h1>
      <p class="text-gray-500">관리자 로그인</p>
    </div>
    
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">이메일 주소</label>
        <input type="email" id="email-input" placeholder="example@dental.com"
          class="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
        <p id="registered-email" class="text-xs text-gray-500 mt-2 hidden"></p>
      </div>
      
      <button id="login-button" type="button" class="w-full bg-blue-500 text-white py-3 rounded-lg font-bold hover:bg-blue-600 transition">
        <i class="fas fa-sign-in-alt mr-2"></i>로그인
      </button>
    </div>
    
    <p id="error-message" class="text-red-500 text-sm text-center mt-4 hidden"></p>
    
    <!-- 미등록 회원 안내 메시지 -->
    <div id="not-registered-message" class="hidden mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0">
          <i class="fas fa-user-slash text-red-500 text-2xl"></i>
        </div>
        <div class="flex-1">
          <h3 class="font-bold text-red-700 mb-1">등록되지 않은 이메일</h3>
          <p class="text-sm text-red-600 mb-2">
            입력하신 이메일(<span id="not-registered-email" class="font-medium"></span>)은<br>
            등록된 회원이 아닙니다.
          </p>
          <div class="mt-3 p-3 bg-white rounded border border-red-100">
            <p class="text-sm text-gray-700 mb-2">
              <i class="fas fa-info-circle mr-2 text-blue-500"></i>
              서비스 이용을 원하시면 먼저 <strong>회원 가입</strong>이 필요합니다.
            </p>
            <p class="text-xs text-gray-500">
              가입 문의: 관리자에게 연락하세요
            </p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 계정 정지 메시지 -->
    <div id="suspended-message" class="hidden mt-4 p-4 bg-gray-50 border border-gray-300 rounded-lg">
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0">
          <i class="fas fa-ban text-gray-500 text-2xl"></i>
        </div>
        <div class="flex-1">
          <h3 class="font-bold text-gray-700 mb-1">계정 이용 불가</h3>
          <p id="suspended-reason" class="text-sm text-gray-600 mb-2"></p>
          <div class="mt-3 p-3 bg-white rounded border border-gray-200">
            <p class="text-sm text-gray-700">
              <i class="fas fa-phone mr-2 text-blue-500"></i>
              문의: <strong>관리자에게 연락하세요</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 구독 만료 메시지 -->
    <div id="expired-message" class="hidden mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0">
          <i class="fas fa-exclamation-triangle text-orange-500 text-2xl"></i>
        </div>
        <div class="flex-1">
          <h3 class="font-bold text-orange-700 mb-1">구독 기간 만료</h3>
          <p class="text-sm text-orange-600 mb-2">
            만료일: <span id="expired-date" class="font-medium"></span>
          </p>
          <p id="expired-text" class="text-sm text-gray-600"></p>
          <div class="mt-3 p-3 bg-white rounded border border-orange-100">
            <p class="text-sm text-gray-700">
              <i class="fas fa-phone mr-2 text-blue-500"></i>
              구독 연장 문의: <strong>관리자에게 연락하세요</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
    
    <div class="mt-6 text-center text-sm text-gray-500">
      <p>가입한 이메일을 입력하세요</p>
    </div>
  </div>
  
  <div id="loading-container" class="hidden bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
    <i class="fas fa-spinner fa-spin text-4xl text-blue-500 mb-4"></i>
    <p class="text-gray-600">로그인 중...</p>
  </div>

  <script>
    const BASE_URL = '${baseUrl}';
    let autoLoginTriggered = false;
    let autoLoginInProgress = false;

    const sanitizeParam = (value) => {
      if (!value) return '';
      const trimmed = value.trim();
      if (!trimmed || trimmed.includes('{{') || trimmed.includes('}}')) return '';
      return trimmed;
    };

    const lockEmail = (email, label) => {
      const emailInput = document.getElementById('email-input');
      const registeredEl = document.getElementById('registered-email');
      if (!emailInput) return;
      emailInput.value = email;
      emailInput.readOnly = true;
      emailInput.classList.add('bg-gray-50');
      if (registeredEl) {
        registeredEl.textContent = label;
        registeredEl.classList.remove('hidden');
      }
    };

    const redirectToAdmin = (adminCode, sessionToken, email) => {
      const adminUrl = new URL(BASE_URL + '/admin/' + adminCode);
      if (email) adminUrl.searchParams.set('email', email);
      const params = new URLSearchParams(window.location.search);
      const isAdminFlag = params.get('is_admin');
      if (isAdminFlag) adminUrl.searchParams.set('is_admin', isAdminFlag);
      window.location.href = adminUrl.toString();
    };

    const resolveSessionInfo = async (sessionToken) => {
      // 세션/localStorage 기반 자동 이동 완전 제거 (계정 혼용 방지)
      return false;
    };

    async function performLogin(email, memberCode, expectedEmail, isAuto) {
      const normalizedEmail = (email || '').trim();
      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        if (!isAuto) {
          showError('올바른 이메일을 입력해주세요.');
        }
        return;
      }

      if (isAuto) {
        if (autoLoginInProgress) return;
        autoLoginInProgress = true;
      }

      // 로딩 표시
      document.getElementById('login-container').classList.add('hidden');
      document.getElementById('loading-container').classList.remove('hidden');

      try {
        // 이메일로 사용자 조회/생성
        const response = await fetch(BASE_URL + '/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: normalizedEmail,
            memberCode: memberCode,
            expectedEmail: expectedEmail
          })
        });

        const data = await response.json();
        const params = new URLSearchParams(window.location.search);

        if (data.success && data.adminCode) {
          // localStorage 저장 제거 - URL 파라미터로만 인증 (계정 혼용 방지)
          localStorage.removeItem('dental_tv_admin_code');
          localStorage.removeItem('dental_tv_email');
          localStorage.removeItem('dental_tv_session');

          // 관리자 페이지로 이동 (email 파라미터 포함)
          const adminUrl = new URL(BASE_URL + '/admin/' + data.adminCode);
          adminUrl.searchParams.set('email', normalizedEmail);
          const isAdminFlag = params.get('is_admin');
          if (isAdminFlag) adminUrl.searchParams.set('is_admin', isAdminFlag);
          window.location.href = adminUrl.toString();
        } else if (data.errorType === 'not_registered') {
          // 미등록 회원
          showNotRegisteredMessage(data.email || normalizedEmail);
          document.getElementById('login-container').classList.remove('hidden');
          document.getElementById('loading-container').classList.add('hidden');
          autoLoginTriggered = false;
          autoLoginInProgress = false;
        } else if (data.errorType === 'email_mismatch') {
          showError('등록 이메일과 일치하지 않습니다. 등록 이메일: ' + (data.registeredEmail || '확인 불가'));
          document.getElementById('login-container').classList.remove('hidden');
          document.getElementById('loading-container').classList.add('hidden');
          localStorage.removeItem('dental_tv_admin_code');
          localStorage.removeItem('dental_tv_email');
          autoLoginTriggered = false;
          autoLoginInProgress = false;
        } else if (data.errorType === 'suspended') {
          // 계정 정지
          showSuspendedMessage(data.reason || '관리자에 의해 정지됨');
          document.getElementById('login-container').classList.remove('hidden');
          document.getElementById('loading-container').classList.add('hidden');
          localStorage.removeItem('dental_tv_admin_code');
          localStorage.removeItem('dental_tv_email');
          autoLoginTriggered = false;
          autoLoginInProgress = false;
        } else if (data.expired) {
          // 구독 만료 시 특별 메시지 표시
          showExpiredMessage(data.expiredDate, data.message);
          document.getElementById('login-container').classList.remove('hidden');
          document.getElementById('loading-container').classList.add('hidden');
          localStorage.removeItem('dental_tv_admin_code');
          localStorage.removeItem('dental_tv_email');
          autoLoginTriggered = false;
          autoLoginInProgress = false;
        } else {
          showError(data.error || '로그인에 실패했습니다.');
          document.getElementById('login-container').classList.remove('hidden');
          document.getElementById('loading-container').classList.add('hidden');
          autoLoginTriggered = false;
          autoLoginInProgress = false;
        }
      } catch (err) {
        showError('서버 연결에 실패했습니다.');
        document.getElementById('login-container').classList.remove('hidden');
        document.getElementById('loading-container').classList.add('hidden');
        autoLoginTriggered = false;
          autoLoginInProgress = false;
      }
    }

    // URL에 memberCode/email이 있으면 등록 이메일을 조회해 고정 표시 + 자동 로그인
    (function() {
      const params = new URLSearchParams(window.location.search);
      const urlEmail = sanitizeParam(params.get('email'));
      const memberCode = sanitizeParam(params.get('memberCode') || params.get('member_code'));
      const emailInput = document.getElementById('email-input');
      const registeredEl = document.getElementById('registered-email');
      const loginButton = document.querySelector('button[onclick="login()"]');

      const blockAccess = (message) => {
        if (emailInput) {
          emailInput.value = '';
          emailInput.readOnly = true;
          emailInput.classList.add('bg-gray-50');
        }
        if (registeredEl) {
          registeredEl.textContent = message;
          registeredEl.classList.remove('hidden');
        }
        if (loginButton) {
          loginButton.disabled = true;
          loginButton.classList.add('opacity-60', 'cursor-not-allowed');
        }
      };

      const query = memberCode
        ? 'memberCode=' + encodeURIComponent(memberCode)
        : (urlEmail ? 'email=' + encodeURIComponent(urlEmail) : '');

      if (!query) {
        return;
      }

      autoLoginTriggered = true;

      // memberCode가 있으면 아임웹 API로 이메일 조회 후 로그인
      // email만 있으면 아임웹 API 없이 바로 로그인 시도 (레거시 계정 지원)
      if (!memberCode && urlEmail) {
        lockEmail(urlEmail, '이메일: ' + urlEmail);
        performLogin(urlEmail, '', urlEmail, true);
        return;
      }

      fetch(BASE_URL + '/api/imweb/member?' + query)
        .then(res => res.json())
        .then(async data => {
          if (data.success && data.email) {
            lockEmail(data.email, '등록된 이메일: ' + data.email);
            await performLogin(data.email, memberCode, urlEmail || data.email, true);
          } else {
            // 아임웹 API 실패해도 email이 있으면 직접 로그인 시도
            if (urlEmail) {
              lockEmail(urlEmail, '이메일: ' + urlEmail);
              await performLogin(urlEmail, memberCode, urlEmail, true);
            } else {
              blockAccess('등록 이메일을 확인할 수 없습니다.');
            }
          }
        })
        .catch(() => {
          // API 오류 시에도 email이 있으면 직접 로그인
          if (urlEmail) {
            lockEmail(urlEmail, '이메일: ' + urlEmail);
            performLogin(urlEmail, memberCode, urlEmail, true);
          } else {
            blockAccess('등록 이메일 조회 실패');
          }
        });
    })();

    // localStorage 기반 자동 로그인 완전 제거 (계정 혼용 방지)
    // URL에 memberCode 또는 email이 있을 때만 자동 로그인 (아임웹 위젯 경로)

    function login() {
      const email = document.getElementById('email-input').value.trim();
      const params = new URLSearchParams(window.location.search);
      const memberCode = sanitizeParam(params.get('memberCode') || params.get('member_code'));
      const expectedEmail = sanitizeParam(params.get('email'));
      performLogin(email, memberCode, expectedEmail, false);
    }
    
    const emailInputEl = document.getElementById('email-input');
    if (emailInputEl) {
      emailInputEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          login();
        }
      });
    }

    const loginButtonEl = document.getElementById('login-button');
    if (loginButtonEl) {
      loginButtonEl.addEventListener('click', (event) => {
        event.preventDefault();
        login();
      });
    }

    function hideAllMessages() {
      document.getElementById('error-message').classList.add('hidden');
      document.getElementById('not-registered-message').classList.add('hidden');
      document.getElementById('suspended-message').classList.add('hidden');
      document.getElementById('expired-message').classList.add('hidden');
    }
    
    function showError(message) {
      hideAllMessages();
      const errorEl = document.getElementById('error-message');
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }
    
    function showNotRegisteredMessage(email) {
      hideAllMessages();
      document.getElementById('not-registered-email').textContent = email;
      document.getElementById('not-registered-message').classList.remove('hidden');
    }
    
    function showSuspendedMessage(reason) {
      hideAllMessages();
      document.getElementById('suspended-reason').textContent = reason;
      document.getElementById('suspended-message').classList.remove('hidden');
    }
    
    function showExpiredMessage(expiredDate, message) {
      hideAllMessages();
      document.getElementById('expired-date').textContent = expiredDate;
      document.getElementById('expired-text').textContent = message || '서비스를 계속 이용하시려면 구독을 연장해주세요.';
      document.getElementById('expired-message').classList.remove('hidden');
    }
    
    function logout() {
      localStorage.removeItem('dental_tv_admin_code');
      localStorage.removeItem('dental_tv_email');
      localStorage.removeItem('dental_tv_session');
      window.location.reload();
    }
  </script>
</body>
</html>
  `)
})

// 아임웹 회원 이메일/회원코드 조회
app.get('/api/imweb/member', async (c) => {
  const memberCode = c.req.query('memberCode') || ''
  const email = normalizeEmail(c.req.query('email') || '')
  if (!memberCode && !email) {
    return c.json({ success: false, error: 'memberCode or email required' }, 400)
  }

  try {
    const clientId = (c.env as any).IMWEB_CLIENT_ID
    const clientSecret = (c.env as any).IMWEB_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return c.json({ success: false, error: 'imweb_not_configured' }, 400)
    }

    const authRes = await fetch('https://api.imweb.me/v2/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: clientId, secret: clientSecret })
    })
    const authData = await authRes.json() as any
    if (!authData.access_token) {
      return c.json({ success: false, error: 'imweb_auth_failed' }, 400)
    }

    const query = memberCode
      ? 'member_code=' + encodeURIComponent(memberCode)
      : 'email=' + encodeURIComponent(email)

    const membersRes = await fetch('https://api.imweb.me/v2/member/members?' + query, {
      headers: { 'access-token': authData.access_token }
    })
    const membersData = await membersRes.json() as any

    if (membersData.code === 200 && membersData.data?.list?.length > 0) {
      let member = null as any
      if (memberCode) {
        member = membersData.data.list.find((item: any) => {
          const code = String(item.member_code || item.code || item.id || '')
          return code === String(memberCode)
        })
      } else {
        member = membersData.data.list.find((item: any) => {
          const itemEmail = normalizeEmail(item.email || item.email_id || '')
          return itemEmail === email
        })
      }

      if (member) {
        return c.json({
          success: true,
          email: member.email || member.email_id || '',
          name: member.name || '',
          memberCode: member.member_code || member.code || member.id || ''
        })
      }
    }

    return c.json({ success: false, error: 'member_not_found' }, 404)
  } catch (e) {
    console.error('Imweb member lookup error:', e)
    return c.json({ success: false, error: 'imweb_api_error' }, 500)
  }
})

// 세션 정보 조회 (자동 로그인 복구용)
app.get('/api/session-info', async (c) => {
  const token = c.req.query('token') || ''
  if (!token) {
    return c.json({ success: false, error: 'token_required' }, 400)
  }

  try {
    const nowIso = new Date().toISOString()
    const row: any = await c.env.DB.prepare(`
      SELECT s.token, s.expires_at, u.admin_code, u.imweb_email
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > ?
    `).bind(token, nowIso).first()

    if (!row) {
      return c.json({ success: false, error: 'session_not_found' }, 404)
    }

    return c.json({
      success: true,
      adminCode: row.admin_code,
      email: row.imweb_email || ''
    })
  } catch (e) {
    console.error('Session info error:', e)
    return c.json({ success: false, error: 'server_error' }, 500)
  }
})

// 로그인 API
app.post('/api/login', async (c) => {
  const { email, memberCode, expectedEmail } = await c.req.json()
  
  if (!email || !email.includes('@')) {
    return c.json({ success: false, error: '올바른 이메일을 입력해주세요.' })
  }

  const normalizedEmail = normalizeEmail(email)
  const normalizedExpectedEmail = normalizeEmail(expectedEmail)
  
  // 아임웹 변수 미치환 방어 ({{ member_code }} 등이 그대로 들어오는 경우)
  const safeMemberCode = (memberCode && !String(memberCode).includes('{{') && !String(memberCode).includes('}}'))
    ? String(memberCode).trim()
    : ''

  if (normalizedExpectedEmail && normalizedExpectedEmail !== normalizedEmail) {
    return c.json({
      success: false,
      errorType: 'email_mismatch',
      error: '가입된 이메일과 계정이 일치하지 않습니다.',
      registeredEmail: normalizedExpectedEmail
    })
  }
  
  // 아임웹 API로 회원 상태 확인 (member_code 또는 email 기준)
  let imwebMemberExists = false
  let imwebApiConfigured = false
  let imwebApiError = false
  let memberName = '내 치과'
  let imwebMember: any = null
  
  try {
    const clientId = (c.env as any).IMWEB_CLIENT_ID
    const clientSecret = (c.env as any).IMWEB_CLIENT_SECRET
    
    if (clientId && clientSecret) {
      imwebApiConfigured = true
      const authRes = await fetch('https://api.imweb.me/v2/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: clientId, secret: clientSecret })
      })
      const authData = await authRes.json() as any
      
      if (authData.access_token) {
        const query = safeMemberCode
          ? 'member_code=' + encodeURIComponent(safeMemberCode)
          : 'email=' + encodeURIComponent(normalizedEmail)

        const membersRes = await fetch('https://api.imweb.me/v2/member/members?' + query, {
          headers: { 'access-token': authData.access_token }
        })
        const membersData = await membersRes.json() as any
        
        if (membersData.code === 200 && membersData.data?.list?.length > 0) {
          if (safeMemberCode) {
            imwebMember = membersData.data.list.find((item: any) => {
              const code = String(item.member_code || item.code || item.id || '')
              return code === String(safeMemberCode)
            })
          } else {
            imwebMember = membersData.data.list.find((item: any) => {
              const itemEmail = normalizeEmail(item.email || item.email_id || '')
              return itemEmail === normalizedEmail
            })
          }

          if (imwebMember) {
            imwebMemberExists = true
            memberName = imwebMember.name || '내 치과'
            const registeredEmail = normalizeEmail(imwebMember.email || imwebMember.email_id || '')
            if (!registeredEmail || registeredEmail !== normalizedEmail) {
              return c.json({
                success: false,
                errorType: 'email_mismatch',
                error: '가입된 이메일과 계정이 일치하지 않습니다.',
                registeredEmail
              })
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Imweb API error:', e)
    imwebApiError = true
  }

  if (!imwebApiConfigured) {
    return c.json({
      success: false,
      errorType: 'imweb_not_configured',
      error: '아임웹 이메일 확인이 불가합니다. 관리자에게 문의하세요.'
    })
  }

  if (imwebApiError) {
    return c.json({
      success: false,
      errorType: 'imweb_api_error',
      error: '아임웹 이메일 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    })
  }

  // 아임웹 API에서 찾지 못해도, DB에 이미 등록된 계정이면 허용 (레거시 계정 지원)
  if (!imwebMemberExists) {
    const existingUser = await c.env.DB.prepare(
      'SELECT * FROM users WHERE lower(imweb_email) = ?'
    ).bind(normalizedEmail).first() as any

    if (existingUser) {
      // DB에 이미 등록된 계정 → 아임웹 검증 없이 통과
      if (existingUser.is_active === 0) {
        return c.json({
          success: false,
          errorType: 'suspended',
          error: '계정이 정지되었습니다.',
          reason: existingUser.suspended_reason || '관리자에 의해 정지됨'
        })
      }
      if (existingUser.subscription_plan !== 'unlimited' && existingUser.subscription_end) {
        const endDate = new Date(existingUser.subscription_end)
        const today = new Date(); today.setHours(0, 0, 0, 0)
        if (endDate < today) {
          return c.json({
            success: false,
            error: '구독 기간이 만료되었습니다.',
            expired: true,
            expiredDate: existingUser.subscription_end,
            message: '서비스를 계속 이용하시려면 구독을 연장해주세요.'
          })
        }
      }
      return c.json({ success: true, adminCode: existingUser.admin_code, email: normalizedEmail })
    }

    return c.json({ 
      success: false, 
      errorType: 'not_registered',
      error: '등록되지 않은 이메일입니다.',
      email: normalizedEmail
    })
  }

  const imwebMemberCode = imwebMember?.member_code || imwebMember?.code || imwebMember?.id || null
  
  // 회원코드 기준으로 사용자 조회 (치과 계정 분리)
  let user = null as any
  if (imwebMemberCode) {
    user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE imweb_member_id = ?'
    ).bind(imwebMemberCode).first() as any
  }

  // 레거시 보정: 회원코드가 없거나 매칭 실패 시에만 이메일 사용
  if (!user) {
    user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE lower(imweb_email) = ?'
    ).bind(normalizedEmail).first() as any

    if (user && imwebMemberCode) {
      await c.env.DB.prepare(
        'UPDATE users SET imweb_email = ?, imweb_member_id = ? WHERE id = ?'
      ).bind(normalizedEmail, imwebMemberCode, user.id).run()
    }
  }
  
  // 기존 사용자인 경우
  if (user) {
    let expiryWarning: { message: string; daysLeft: number } | null = null

    // 1. DB에서 수동으로 정지된 경우 차단
    if (user.is_active === 0) {
      return c.json({ 
        success: false, 
        errorType: 'suspended',
        error: '계정이 정지되었습니다.',
        reason: user.suspended_reason || '관리자에 의해 정지됨'
      })
    }
    
    
    // 3. 구독 기간 확인 (무제한 플랜은 제외)
    if (user.subscription_plan !== 'unlimited' && user.subscription_end) {
      const endDate = new Date(user.subscription_end)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (endDate < today) {
        // 구독 만료 - 계정 자동 정지
        await c.env.DB.prepare(`
          UPDATE users SET is_active = 0, suspended_reason = '구독 기간 만료'
          WHERE id = ?
        `).bind(user.id).run()
        
        return c.json({ 
          success: false, 
          error: '구독 기간이 만료되었습니다.',
          expired: true,
          expiredDate: user.subscription_end,
          message: '서비스를 계속 이용하시려면 구독을 연장해주세요. 관리자에게 문의하세요.'
        })
      }

      const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays <= 7) {
        expiryWarning = {
          message: `구독이 ${diffDays}일 후 만료됩니다.`,
          daysLeft: diffDays
        }
      }
    }
    
    if (memberName && user.clinic_name !== memberName) {
      await c.env.DB.prepare('UPDATE users SET clinic_name = ? WHERE id = ?')
        .bind(memberName, user.id).run()
    }

    if (user.imweb_email !== normalizedEmail) {
      await c.env.DB.prepare('UPDATE users SET imweb_email = ? WHERE id = ?')
        .bind(normalizedEmail, user.id).run()
    }

    if (imwebMemberCode && user.imweb_member_id !== imwebMemberCode) {
      await c.env.DB.prepare('UPDATE users SET imweb_member_id = ? WHERE id = ?')
        .bind(imwebMemberCode, user.id).run()
    }
    
    // admin_code에 @가 포함되어 있으면 새 코드로 마이그레이션
    let finalAdminCode = user.admin_code
    if (user.admin_code && user.admin_code.includes('@')) {
      finalAdminCode = 'user_' + generateRandomCode(8)
      await c.env.DB.prepare('UPDATE users SET admin_code = ? WHERE id = ?')
        .bind(finalAdminCode, user.id).run()
    }
    
    const sessionToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    await c.env.DB.prepare(`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES (?, ?, ?)
    `).bind(sessionToken, user.id, expiresAt).run()

    // 구독 정보도 함께 반환
    return c.json({ 
      success: true, 
      adminCode: finalAdminCode,
      sessionToken: sessionToken,
      subscription: {
        plan: user.subscription_plan,
        startDate: user.subscription_start,
        endDate: user.subscription_end
      },
      warning: expiryWarning?.message || null,
      warningDays: expiryWarning?.daysLeft || null
    })
  }
  
  // 새 사용자 생성 - 이메일에서 특수문자 제거한 admin_code 생성
  const adminCode = 'user_' + generateRandomCode(8)
  
  const result = await c.env.DB.prepare(`
    INSERT INTO users (admin_code, clinic_name, imweb_email, imweb_member_id, is_active)
    VALUES (?, ?, ?, ?, 1)
  `).bind(adminCode, memberName, normalizedEmail, imwebMemberCode).run()
  
  user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(result.meta.last_row_id).first()
  
  // 기본 플레이리스트 생성
  if (user) {
    const shortCode = generateRandomCode(5)
    await c.env.DB.prepare(`
      INSERT INTO playlists (user_id, name, short_code)
      VALUES (?, ?, ?)
    `).bind(user.id, '대기실1', shortCode).run()
    
    const sessionToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    await c.env.DB.prepare(`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES (?, ?, ?)
    `).bind(sessionToken, user.id, expiresAt).run()

    return c.json({ success: true, adminCode: user.admin_code, sessionToken })
  } else {
    return c.json({ success: false, error: '사용자 생성에 실패했습니다.' })
  }
})

// ============================================
// TV 연결 페이지 (숫자 4자리 코드 입력)
// ============================================

// TV 코드로 플레이리스트 조회 API
app.get('/api/tv-code/:code', async (c) => {
  const code = c.req.param('code')
  
  const playlist = await c.env.DB.prepare(`
    SELECT p.short_code, p.name, u.clinic_name
    FROM playlists p
    JOIN users u ON p.user_id = u.id
    WHERE p.tv_code = ? AND p.is_active = 1
  `).bind(code).first()
  
  if (!playlist) {
    return c.json({ error: '유효하지 않은 코드입니다' }, 404)
  }
  
  return c.json({ 
    success: true, 
    shortCode: playlist.short_code,
    name: playlist.name,
    clinicName: playlist.clinic_name
  })
})

// TV 코드 생성/조회 API
app.post('/api/playlist/:id/tv-code', async (c) => {
  const playlistId = c.req.param('id')
  
  // 기존 TV 코드 확인
  const existing = await c.env.DB.prepare(
    'SELECT tv_code FROM playlists WHERE id = ?'
  ).bind(playlistId).first()
  
  if (existing?.tv_code) {
    return c.json({ tvCode: existing.tv_code })
  }
  
  // 새 TV 코드 생성 (4자리 숫자, 중복 확인)
  let tvCode: string
  let attempts = 0
  
  do {
    tvCode = String(Math.floor(1000 + Math.random() * 9000))
    const duplicate = await c.env.DB.prepare(
      'SELECT id FROM playlists WHERE tv_code = ?'
    ).bind(tvCode).first()
    
    if (!duplicate) break
    attempts++
  } while (attempts < 100)
  
  // TV 코드 저장
  await c.env.DB.prepare(
    'UPDATE playlists SET tv_code = ? WHERE id = ?'
  ).bind(tvCode, playlistId).run()
  
  return c.json({ tvCode })
})

// TV 연결 페이지
app.get('/tv', (c) => {
  const baseUrl = new URL(c.req.url).origin
  
  return c.html(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TV 연결 - 치과 TV</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      min-height: 100vh;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: white;
    }
    
    .container {
      text-align: center;
      padding: 40px;
    }
    
    .logo {
      font-size: 24px;
      margin-bottom: 20px;
      opacity: 0.8;
    }
    
    h1 {
      font-size: 48px;
      margin-bottom: 16px;
      font-weight: 300;
    }
    
    .subtitle {
      font-size: 20px;
      opacity: 0.7;
      margin-bottom: 60px;
    }
    
    .code-input-container {
      display: flex;
      gap: 16px;
      justify-content: center;
      margin-bottom: 40px;
    }
    
    .code-input {
      width: 100px;
      height: 120px;
      font-size: 56px;
      text-align: center;
      border: 3px solid rgba(255,255,255,0.3);
      border-radius: 16px;
      background: rgba(255,255,255,0.1);
      color: white;
      outline: none;
      transition: all 0.3s;
    }
    
    .code-input:focus {
      border-color: #4ade80;
      background: rgba(74, 222, 128, 0.1);
      box-shadow: 0 0 30px rgba(74, 222, 128, 0.3);
    }
    
    .code-input.filled {
      border-color: #4ade80;
      background: rgba(74, 222, 128, 0.2);
    }
    
    .code-input.error {
      border-color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
      animation: shake 0.5s;
    }
    
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-10px); }
      75% { transform: translateX(10px); }
    }
    
    .status {
      font-size: 24px;
      min-height: 36px;
      margin-bottom: 40px;
    }
    
    .status.success {
      color: #4ade80;
    }
    
    .status.error {
      color: #ef4444;
    }
    
    .info-box {
      background: rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 24px 40px;
      display: inline-block;
    }
    
    .info-box p {
      font-size: 18px;
      opacity: 0.8;
      margin-bottom: 8px;
    }
    
    .info-box .clinic-name {
      font-size: 28px;
      font-weight: bold;
      color: #4ade80;
    }
    
    .loading {
      display: none;
      font-size: 24px;
    }
    
    .loading.show {
      display: block;
    }
    
    .spinner {
      display: inline-block;
      width: 24px;
      height: 24px;
      border: 3px solid rgba(255,255,255,0.3);
      border-top-color: #4ade80;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 12px;
      vertical-align: middle;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .help {
      margin-top: 60px;
      opacity: 0.5;
      font-size: 16px;
    }
    
    /* TV 리모컨 네비게이션 지원 */
    .code-input:focus {
      transform: scale(1.05);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🦷 치과 TV</div>
    <h1>TV 연결</h1>
    <p class="subtitle">관리자 페이지에서 발급받은 4자리 코드를 입력하세요</p>
    
    <div class="code-input-container">
      <input type="tel" class="code-input" maxlength="1" id="code1" inputmode="numeric" pattern="[0-9]" autofocus>
      <input type="tel" class="code-input" maxlength="1" id="code2" inputmode="numeric" pattern="[0-9]">
      <input type="tel" class="code-input" maxlength="1" id="code3" inputmode="numeric" pattern="[0-9]">
      <input type="tel" class="code-input" maxlength="1" id="code4" inputmode="numeric" pattern="[0-9]">
    </div>
    
    <div class="status" id="status"></div>
    
    <div class="loading" id="loading">
      <span class="spinner"></span>연결 중...
    </div>
    
    <div class="info-box" id="info-box" style="display: none;">
      <p>연결된 치과</p>
      <div class="clinic-name" id="clinic-name"></div>
    </div>
    
    <p class="help">리모컨 숫자 버튼으로 입력하세요</p>
  </div>

  <script>
    const inputs = [
      document.getElementById('code1'),
      document.getElementById('code2'),
      document.getElementById('code3'),
      document.getElementById('code4')
    ];
    const status = document.getElementById('status');
    const loading = document.getElementById('loading');
    const infoBox = document.getElementById('info-box');
    const clinicName = document.getElementById('clinic-name');
    
    let isProcessing = false;
    
    // 각 입력 필드에 이벤트 리스너 추가
    inputs.forEach((input, index) => {
      // 숫자만 입력 허용
      input.addEventListener('input', (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        e.target.value = value;
        
        if (value) {
          e.target.classList.add('filled');
          // 다음 입력 필드로 이동
          if (index < 3) {
            inputs[index + 1].focus();
          }
        } else {
          e.target.classList.remove('filled');
        }
        
        // 4자리 모두 입력되었는지 확인
        checkComplete();
      });
      
      // 백스페이스 처리
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
          inputs[index - 1].focus();
          inputs[index - 1].value = '';
          inputs[index - 1].classList.remove('filled');
        }
      });
      
      // 붙여넣기 지원
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const paste = (e.clipboardData || window.clipboardData).getData('text');
        const digits = paste.replace(/[^0-9]/g, '').slice(0, 4);
        
        digits.split('').forEach((digit, i) => {
          if (inputs[i]) {
            inputs[i].value = digit;
            inputs[i].classList.add('filled');
          }
        });
        
        if (digits.length === 4) {
          inputs[3].focus();
          checkComplete();
        } else if (digits.length > 0) {
          inputs[Math.min(digits.length, 3)].focus();
        }
      });
    });
    
    // 4자리 완성 확인 및 API 호출
    async function checkComplete() {
      const code = inputs.map(i => i.value).join('');
      
      if (code.length === 4 && !isProcessing) {
        isProcessing = true;
        loading.classList.add('show');
        status.textContent = '';
        status.className = 'status';
        
        try {
          const res = await fetch('/api/tv-code/' + code);
          const data = await res.json();
          
          if (data.success) {
            status.textContent = '연결 성공!';
            status.className = 'status success';
            clinicName.textContent = data.clinicName + ' - ' + data.name;
            infoBox.style.display = 'inline-block';
            
            // 2초 후 해당 플레이리스트로 이동
            setTimeout(() => {
              window.location.href = '/' + data.shortCode;
            }, 2000);
          } else {
            showError('유효하지 않은 코드입니다');
          }
        } catch (e) {
          showError('연결 실패. 다시 시도해주세요.');
        }
        
        loading.classList.remove('show');
        isProcessing = false;
      }
    }
    
    function showError(message) {
      status.textContent = message;
      status.className = 'status error';
      inputs.forEach(i => {
        i.classList.add('error');
        i.classList.remove('filled');
      });
      
      // 애니메이션 후 초기화
      setTimeout(() => {
        inputs.forEach(i => {
          i.classList.remove('error');
          i.value = '';
        });
        inputs[0].focus();
      }, 1500);
    }
    
    // 페이지 로드 시 첫 번째 입력 필드에 포커스
    inputs[0].focus();
    
    // 전역 키보드 이벤트 (TV 리모컨 숫자 버튼 지원)
    document.addEventListener('keydown', (e) => {
      if (e.key >= '0' && e.key <= '9') {
        // 현재 포커스된 입력 필드 찾기
        const focused = document.activeElement;
        const currentIndex = inputs.indexOf(focused);
        
        if (currentIndex === -1) {
          // 포커스가 없으면 첫 번째 빈 칸에 입력
          const emptyIndex = inputs.findIndex(i => !i.value);
          if (emptyIndex !== -1) {
            inputs[emptyIndex].focus();
            inputs[emptyIndex].value = e.key;
            inputs[emptyIndex].classList.add('filled');
            if (emptyIndex < 3) {
              inputs[emptyIndex + 1].focus();
            }
            checkComplete();
          }
        }
      }
    });
  </script>
</body>
</html>
`)
})

// ============================================
// 마스터 관리자 페이지
// ============================================

app.get('/master', (c) => {
  const baseUrl = new URL(c.req.url).origin
  
  return c.html(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>마스터 관리자 - 치과 TV</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-100 min-h-screen">
  <!-- 로그인 화면 -->
  <div id="login-screen" class="min-h-screen flex items-center justify-center">
    <div class="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
      <div class="text-center mb-6">
        <i class="fas fa-user-shield text-5xl text-purple-500 mb-4"></i>
        <h1 class="text-2xl font-bold text-gray-800">마스터 관리자</h1>
        <p class="text-gray-500 text-sm">공용 플레이리스트 관리</p>
      </div>
      
      <div class="space-y-4">
        <div class="relative">
          <input type="password" id="master-password" placeholder="관리자 비밀번호"
            class="w-full border rounded-lg px-4 py-3 pr-12 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            onkeypress="if(event.key==='Enter') login()">
          <button type="button" onclick="toggleMasterPassword()" 
            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <i id="master-password-eye" class="fas fa-eye"></i>
          </button>
        </div>
        <button onclick="login()" class="w-full bg-purple-500 text-white py-3 rounded-lg font-bold hover:bg-purple-600">
          <i class="fas fa-sign-in-alt mr-2"></i>로그인
        </button>
      </div>
      
      <p id="login-error" class="text-red-500 text-sm text-center mt-4 hidden">비밀번호가 틀렸습니다.</p>
    </div>
  </div>
  
  <!-- 메인 화면 -->
  <div id="main-screen" class="hidden">
    <!-- 헤더 -->
    <div class="bg-purple-600 text-white p-4 shadow-lg">
      <div class="max-w-6xl mx-auto flex justify-between items-center">
        <div>
          <h1 class="text-xl font-bold"><i class="fas fa-crown mr-2"></i>마스터 관리자</h1>
          <p class="text-purple-200 text-sm">공용 플레이리스트 관리</p>
        </div>
        <button onclick="logout()" class="bg-purple-700 px-4 py-2 rounded-lg hover:bg-purple-800">
          <i class="fas fa-sign-out-alt mr-1"></i>로그아웃
        </button>
      </div>
    </div>
    
    <div class="max-w-6xl mx-auto p-6">
      <!-- 탭 -->
      <div class="flex border-b mb-6">
        <button onclick="showTab('playlist')" id="tab-playlist" class="px-6 py-3 font-bold tab-active border-b-2 border-purple-500 text-purple-600">
          <i class="fas fa-video mr-2"></i>공용 플레이리스트
        </button>
        <button onclick="showTab('subtitles')" id="tab-subtitles" class="px-6 py-3 font-bold text-gray-500 hover:text-purple-600">
          <i class="fas fa-closed-captioning mr-2"></i>자막 관리
        </button>
        <button onclick="showTab('users')" id="tab-users" class="px-6 py-3 font-bold text-gray-500 hover:text-purple-600">
          <i class="fas fa-users mr-2"></i>치과 관리
        </button>
        <button onclick="showTab('imweb-links')" id="tab-imweb-links" class="px-6 py-3 font-bold text-gray-500 hover:text-purple-600">
          <i class="fas fa-link mr-2"></i>아임웹 링크
        </button>
      </div>
      
      <!-- 공용 플레이리스트 탭 -->
      <div id="content-playlist">
        <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-lg font-bold text-gray-800">
              <i class="fas fa-film mr-2 text-purple-500"></i>공용 동영상 목록
            </h2>
            <span id="item-count" class="bg-purple-100 text-purple-600 px-3 py-1 rounded-full text-sm">0개</span>
          </div>
          
          <!-- 동영상 추가 -->
          <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
            <div class="flex gap-2">
              <input type="text" id="new-url" placeholder="YouTube 또는 Vimeo URL 입력"
                class="flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500">
              <button onclick="addItem()" class="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600">
                <i class="fas fa-plus mr-1"></i>추가
              </button>
            </div>
          </div>
          
          <!-- 동영상 목록 -->
          <div id="items-container" class="space-y-2">
            <p class="text-gray-400 text-center py-8">동영상을 추가해주세요</p>
          </div>
        </div>
        
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 class="font-bold text-yellow-800 mb-2"><i class="fas fa-info-circle mr-2"></i>안내</h3>
          <ul class="text-yellow-700 text-sm space-y-1">
            <li>• 여기에 추가된 동영상은 <strong>모든 치과</strong>에서 공통으로 사용됩니다.</li>
            <li>• 각 치과는 설정에서 공용 동영상 사용 여부를 선택할 수 있습니다.</li>
            <li>• 동영상 순서는 위에서 아래로 재생됩니다.</li>
          </ul>
        </div>
      </div>
      
      <!-- 자막 관리 탭 -->
      <div id="content-subtitles" class="hidden">
        <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-lg font-bold text-gray-800">
              <i class="fas fa-closed-captioning mr-2 text-purple-500"></i>자막 관리
            </h2>
            <span id="subtitle-count" class="bg-purple-100 text-purple-600 px-3 py-1 rounded-full text-sm">0개</span>
          </div>
          
          <!-- 자막 추가 폼 -->
          <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
            <h3 id="subtitle-form-title" class="font-bold text-purple-800 mb-3"><i class="fas fa-plus-circle mr-2"></i>자막 추가</h3>
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Vimeo URL 또는 ID</label>
                <input type="text" id="subtitle-vimeo-id" placeholder="예: https://vimeo.com/123456789 또는 123456789"
                  class="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500">
              </div>
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-sm font-medium text-gray-700">자막 내용 (SRT 형식)</label>
                  <div class="flex gap-2">
                    <button type="button" onclick="document.getElementById('srt-file-input').click()" 
                      class="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded hover:bg-purple-200">
                      <i class="fas fa-folder-open mr-1"></i>파일 불러오기
                    </button>
                  </div>
                </div>
                <input type="file" id="srt-file-input" accept=".srt,.txt" class="hidden" onchange="handleSrtFileSelect(event)">
                <div id="subtitle-dropzone" class="relative">
                  <textarea id="subtitle-content" rows="10" placeholder="SRT 파일을 여기에 드래그하거나 직접 입력하세요

1
00:00:00,000 --> 00:00:03,000
안녕하세요

2
00:00:03,500 --> 00:00:06,000
치과에 오신 것을 환영합니다"
                    class="w-full border-2 border-dashed border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-sm transition-colors"></textarea>
                  <div id="drop-overlay" class="hidden absolute inset-0 bg-purple-100 bg-opacity-90 rounded-lg flex items-center justify-center pointer-events-none">
                    <div class="text-center">
                      <i class="fas fa-file-upload text-4xl text-purple-500 mb-2"></i>
                      <p id="drop-overlay-text" class="text-purple-700 font-bold">SRT 파일을 놓으세요</p>
                    </div>
                  </div>
                </div>
                <p class="text-xs text-gray-500 mt-1"><i class="fas fa-info-circle mr-1"></i>SRT 파일을 드래그 앤 드롭하거나 '파일 불러오기' 버튼을 클릭하세요</p>
              </div>
              <div class="flex gap-2">
                <button id="save-subtitle-btn" onclick="saveSubtitle()" class="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600">
                  <i class="fas fa-save mr-1"></i><span id="save-subtitle-text">저장</span>
                </button>
                <button onclick="clearSubtitleForm()" class="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400">
                  <i class="fas fa-times mr-1"></i>초기화
                </button>
              </div>
            </div>
          </div>
          
          <!-- 등록된 자막 목록 -->
          <div class="mb-4">
            <h3 class="font-bold text-gray-700 mb-2"><i class="fas fa-list mr-2"></i>등록된 자막</h3>
            <div id="subtitles-container" class="space-y-2">
              <p class="text-gray-400 text-center py-4">등록된 자막이 없습니다</p>
            </div>
          </div>
        </div>
        
        <!-- 자막 스타일 설정 -->
        <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 class="text-lg font-bold text-gray-800 mb-4">
            <i class="fas fa-paint-brush mr-2 text-purple-500"></i>자막 스타일 설정
          </h2>
          
          <!-- 자막 선택 -->
          <div class="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <label class="block text-sm font-medium text-purple-800 mb-2">
              <i class="fas fa-closed-captioning mr-1"></i>미리보기할 자막 선택
            </label>
            <select id="preview-subtitle-select" onchange="onPreviewSubtitleChange()" 
              class="w-full border-2 border-purple-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg">
              <option value="">-- 자막을 선택하세요 --</option>
            </select>
            <p id="selected-subtitle-info" class="text-sm text-purple-600 mt-2 hidden">
              <i class="fas fa-info-circle mr-1"></i>선택된 자막: <span id="selected-subtitle-name"></span>
            </p>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- 글자 크기 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">글자 크기</label>
              <div class="flex items-center gap-3">
                <input type="range" id="subtitle-font-size" min="16" max="120" value="28" 
                  class="flex-1" oninput="updateSubtitlePreview()">
                <span id="subtitle-font-size-label" class="text-sm text-gray-600 w-12">28px</span>
              </div>
            </div>
            
            <!-- 배경 투명도 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">배경 투명도</label>
              <div class="flex items-center gap-3">
                <input type="range" id="subtitle-bg-opacity" min="0" max="100" value="80" 
                  class="flex-1" oninput="updateSubtitlePreview()">
                <span id="subtitle-bg-opacity-label" class="text-sm text-gray-600 w-12">80%</span>
              </div>
            </div>
            
            <!-- 글자 색상 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">글자 색상</label>
              <div class="flex items-center gap-2">
                <input type="color" id="subtitle-text-color" value="#ffffff" 
                  class="w-10 h-10 rounded cursor-pointer" oninput="updateSubtitlePreview()">
                <span id="subtitle-text-color-label" class="text-sm text-gray-600">#ffffff</span>
              </div>
            </div>
            
            <!-- 배경 색상 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">배경 색상</label>
              <div class="flex items-center gap-2">
                <input type="color" id="subtitle-bg-color" value="#000000" 
                  class="w-10 h-10 rounded cursor-pointer" oninput="updateSubtitlePreview()">
                <span id="subtitle-bg-color-label" class="text-sm text-gray-600">#000000</span>
              </div>
            </div>
            
            <!-- 위치 (하단에서 거리) -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">하단 위치 (px)</label>
              <div class="flex items-center gap-3">
                <input type="range" id="subtitle-bottom-offset" min="20" max="200" value="80" 
                  class="flex-1" oninput="updateSubtitlePreview()">
                <span id="subtitle-bottom-offset-label" class="text-sm text-gray-600 w-16">80px</span>
              </div>
              <p class="text-xs text-gray-400 mt-1">숫자가 클수록 자막이 위로 올라갑니다</p>
            </div>
          </div>
          
          <!-- 미리보기 -->
          <div class="mt-4">
            <button id="subtitle-preview-toggle" type="button" onclick="toggleSubtitlePreview()" class="text-sm text-purple-600 hover:text-purple-800 font-medium">
              미리보기 펼치기
            </button>
            <div id="subtitle-preview-wrapper" class="mt-2 p-4 bg-gray-800 rounded-lg relative hidden" style="min-height: 150px;">
              <p class="text-xs text-gray-400 mb-3">미리보기 (실제 TV 화면과 동일하게 표시)</p>
              <div class="text-center" style="min-height: 100px; display: flex; align-items: flex-end; justify-content: center;">
                <span id="subtitle-preview" style="background: rgba(0,0,0,0.8); color: #fff; padding: 12px 32px; border-radius: 8px; font-size: 28px; line-height: 1.5; display: inline-block; box-decoration-break: clone; -webkit-box-decoration-break: clone; word-break: keep-all;">
                  자막 미리보기 텍스트입니다
                </span>
              </div>
            </div>
          </div>
          
          <!-- 저장 버튼 -->
          <div class="mt-4 flex justify-end items-center gap-3">
            <span id="save-hint" class="text-orange-500 text-sm hidden">
              <i class="fas fa-exclamation-circle mr-1"></i>변경사항이 있습니다. 저장해주세요!
            </span>
            <button id="save-subtitle-settings-btn" onclick="saveSubtitleSettings()" 
              class="bg-gray-400 text-white px-6 py-2 rounded-lg cursor-not-allowed opacity-60" disabled>
              <i class="fas fa-save mr-2"></i>스타일 저장
            </button>
          </div>
        </div>
        
        <style>
          @keyframes pulse-save {
            0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.7); }
            50% { transform: scale(1.02); box-shadow: 0 0 0 8px rgba(168, 85, 247, 0); }
          }
          .save-needed {
            animation: pulse-save 1.5s ease-in-out infinite;
            background: linear-gradient(135deg, #8b5cf6, #a855f7) !important;
            cursor: pointer !important;
            opacity: 1 !important;
          }
        </style>
        
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 class="font-bold text-blue-800 mb-2"><i class="fas fa-info-circle mr-2"></i>SRT 자막 형식 안내</h3>
          <ul class="text-blue-700 text-sm space-y-1">
            <li>• SRT 형식: 번호, 시간(시:분:초,밀리초), 자막 텍스트 순서로 작성</li>
            <li>• 시간 형식: 00:00:00,000 --> 00:00:03,000</li>
            <li>• 각 자막 블록은 빈 줄로 구분</li>
            <li>• Vimeo 영상에 자막이 표시됩니다 (background 모드 제한으로 영상 위에 오버레이됨)</li>
          </ul>
        </div>
      </div>
      
      <!-- 치과 목록 탭 -->
      <div id="content-users" class="hidden">
        <!-- 치과 등록 버튼들 -->
        <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div class="flex flex-wrap gap-3">
            <button onclick="openAddClinicModal()" class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
              <i class="fas fa-plus mr-2"></i>새 치과 등록
            </button>
            <button onclick="syncImwebMembers()" id="sync-btn" class="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600">
              <i class="fas fa-sync mr-2"></i>아임웹 회원 불러오기
            </button>
          </div>
        </div>
        
        <!-- 아임웹 회원 목록 (동기화 후 표시) -->
        <div id="imweb-members-section" class="hidden bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="font-bold text-green-800">
              <i class="fas fa-users mr-2"></i>아임웹 회원 목록
            </h3>
            <button onclick="hideImwebMembers()" class="text-green-600 hover:text-green-800">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div id="imweb-members-container" class="space-y-2 max-h-64 overflow-y-auto">
            <p class="text-gray-400 text-center py-4">로딩 중...</p>
          </div>
        </div>
        
        <!-- 등록된 치과 목록 -->
        <div class="bg-white rounded-xl shadow-lg p-6">
          <h2 class="text-lg font-bold text-gray-800 mb-4">
            <i class="fas fa-hospital mr-2 text-purple-500"></i>치과 관리 목록
            <span id="clinic-count" class="text-sm font-normal text-gray-500 ml-2">(0개)</span>
          </h2>
          <div id="users-container" class="space-y-2">
            <p class="text-gray-400 text-center py-8">로딩 중...</p>
          </div>
        </div>
      </div>

      <!-- 아임웹 링크 생성 탭 -->
      <div id="content-imweb-links" class="hidden">
        <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-lg font-bold text-gray-800">
                <i class="fas fa-link mr-2 text-purple-500"></i>아임웹 치과 링크 자동 생성
              </h2>
              <p class="text-sm text-gray-500 mt-1">회원 목록을 불러와 치과별 로그인 링크를 생성합니다.</p>
            </div>
          </div>

          <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div class="flex-1">
              <label class="text-sm text-gray-600">마스터 비밀번호</label>
              <input id="imweb-links-password" type="password" class="mt-1 w-full border rounded-lg px-3 py-2" placeholder="마스터 비밀번호 입력" />
            </div>
            <button id="imweb-links-load" onclick="loadImwebLinks()" class="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700">
              <i class="fas fa-download mr-2"></i>회원 불러오기
            </button>
          </div>

          <div id="imweb-links-error" class="hidden mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700"></div>

          <div class="mt-6 overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-gray-50 text-gray-600">
                <tr>
                  <th class="text-left px-3 py-2">치과명</th>
                  <th class="text-left px-3 py-2">이메일</th>
                  <th class="text-left px-3 py-2">회원코드</th>
                  <th class="text-left px-3 py-2">등록상태</th>
                  <th class="text-left px-3 py-2">로그인 링크</th>
                </tr>
              </thead>
              <tbody id="imweb-links-body" class="divide-y"></tbody>
            </table>
          </div>
        </div>

        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
          <p><i class="fas fa-info-circle mr-2"></i>아임웹에서 각 치과 전용 페이지를 만들고, 페이지 제목 링크에 아래 로그인 링크를 연결하세요.</p>
          <p class="mt-1">회원이 추가되면 이 탭에서 다시 불러오면 최신 링크가 자동 생성됩니다.</p>
        </div>
      </div>
      
      <!-- 새 치과 등록 모달 -->
      <div id="add-clinic-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-xl p-6 max-w-md w-full mx-4">
          <h3 class="text-lg font-bold text-gray-800 mb-4">
            <i class="fas fa-hospital mr-2 text-blue-500"></i>새 치과 등록
          </h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">치과명 *</label>
              <input type="text" id="new-clinic-name" placeholder="예: 로이스치과"
                class="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">이메일 (선택)</label>
              <input type="email" id="new-clinic-email" placeholder="예: clinic@example.com"
                class="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500">
            </div>
          </div>
          <div class="flex gap-3 mt-6">
            <button onclick="closeAddClinicModal()" class="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">
              취소
            </button>
            <button onclick="addClinic()" class="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600">
              등록
            </button>
          </div>
        </div>
      </div>
      
      <!-- URL 복사 성공 알림 -->
      <div id="copy-toast" class="hidden fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
        <i class="fas fa-check mr-2"></i>URL이 복사되었습니다!
      </div>
      
      <!-- 구독 설정 모달 -->
      <div id="subscription-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-xl p-6 max-w-md w-full mx-4">
          <h3 class="text-lg font-bold text-gray-800 mb-4">
            <i class="fas fa-calendar-alt mr-2 text-purple-500"></i>구독 기간 설정
          </h3>
          <p id="sub-clinic-name" class="text-sm text-gray-600 mb-4"></p>
          <input type="hidden" id="sub-admin-code">
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">구독 플랜</label>
              <select id="sub-plan" class="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500" onchange="onPlanChange()">
                <option value="trial">체험판 (Trial)</option>
                <option value="monthly">월간 (Monthly)</option>
                <option value="yearly">연간 (Yearly)</option>
                <option value="unlimited">무제한 (Unlimited) - 종료일 무시</option>
              </select>
            </div>
            <div id="date-fields">
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                <input type="date" id="sub-start" class="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">종료일 <span id="end-optional" class="text-gray-400 text-xs hidden">(선택사항)</span></label>
                <input type="date" id="sub-end" class="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500">
              </div>
            </div>
            
            <!-- 무제한 안내 -->
            <div id="unlimited-notice" class="hidden bg-purple-50 border border-purple-200 rounded-lg p-3">
              <p class="text-sm text-purple-700">
                <i class="fas fa-infinity mr-2"></i>
                무제한 플랜은 종료일과 관계없이 영구적으로 사용할 수 있습니다.
              </p>
            </div>
            
            <!-- 빠른 설정 버튼 -->
            <div id="quick-buttons" class="flex gap-2">
              <button onclick="quickSetSubscription(1)" class="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 text-sm">
                +1개월
              </button>
              <button onclick="quickSetSubscription(3)" class="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 text-sm">
                +3개월
              </button>
              <button onclick="quickSetSubscription(6)" class="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 text-sm">
                +6개월
              </button>
              <button onclick="quickSetSubscription(12)" class="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 text-sm">
                +1년
              </button>
            </div>
          </div>
          
          <div class="flex gap-3 mt-6">
            <button onclick="closeSubscriptionModal()" class="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">
              취소
            </button>
            <button onclick="saveSubscription()" class="flex-1 bg-purple-500 text-white py-2 rounded-lg hover:bg-purple-600">
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    const API_BASE = '${baseUrl}/api/master';
    let isLoggedIn = false;
    let masterPlaylistId = null;
    let masterSortable = null;
    let editingSubtitleId = null;  // 현재 편집 중인 자막 ID
    let masterPassword = '';
    let autoSyncTimer = null;
    let lastSyncAt = 0;

    const savedMasterPassword = localStorage.getItem('dental_tv_master_password');
    if (savedMasterPassword) {
      masterPassword = savedMasterPassword;
      const masterPasswordInput = document.getElementById('master-password');
      if (masterPasswordInput) {
        masterPasswordInput.value = savedMasterPassword;
      }
    }
    
    // 토스트 메시지 표시
    function showToast(message, type = 'success') {
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in ' + 
        (type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white');
      toast.innerHTML = '<i class="fas ' + (type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle') + ' mr-2"></i>' + message;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
    
    // 비밀번호 보기/숨기기 토글
    function toggleMasterPassword() {
      const input = document.getElementById('master-password');
      const icon = document.getElementById('master-password-eye');
      if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
    }
    
    async function login() {
      const password = document.getElementById('master-password').value;
      try {
        const res = await fetch(API_BASE + '/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        
        if (res.ok) {
          isLoggedIn = true;
          masterPassword = (password || '').trim();
          if (masterPassword) {
            localStorage.setItem('dental_tv_master_password', masterPassword);
          }
          document.getElementById('login-screen').classList.add('hidden');
          document.getElementById('main-screen').classList.remove('hidden');
          document.getElementById('login-error').classList.add('hidden');
          const imwebPasswordInput = document.getElementById('imweb-links-password');
          if (imwebPasswordInput && masterPassword) {
            imwebPasswordInput.value = masterPassword;
          }
          loadMasterInfo();
          setupSubtitleDropzone();  // SRT 드래그 앤 드롭 설정
          await autoSyncImwebMembers(true, false);
          if (autoSyncTimer) clearInterval(autoSyncTimer);
          autoSyncTimer = setInterval(() => autoSyncImwebMembers(false, true), 1 * 60 * 1000);
        } else {
          document.getElementById('login-error').classList.remove('hidden');
        }
      } catch (e) {
        console.error(e);
        document.getElementById('login-error').classList.remove('hidden');
      }
    }

    async function autoSyncImwebMembers(showToastMessage = false, notifyOnNew = false) {
      if (!masterPassword) return;
      const now = Date.now();
      if (now - lastSyncAt < 30 * 1000) return;
      lastSyncAt = now;

      try {
        const res = await fetch(API_BASE + '/imweb-sync?password=' + encodeURIComponent(masterPassword), {
          method: 'POST'
        });
        const data = await res.json();

        if (!res.ok) {
          if (showToastMessage) {
            showToast(data.error || '아임웹 동기화 실패', 'error');
          }
          return;
        }

        if (showToastMessage) {
          if (data.created > 0) {
            showToast('신규 ' + data.created + '개 자동 등록 완료');
          } else {
            showToast('신규 가입 없음 (동기화 완료)');
          }
        } else if (notifyOnNew && data.created > 0) {
          showToast('신규 가입 ' + data.created + '건 자동 등록');
        }

        if (data.created > 0) {
          loadUsers();
        }
      } catch (e) {
        if (showToastMessage) {
          showToast('아임웹 동기화 실패', 'error');
        }
      }
    }
    
    function logout() {
      isLoggedIn = false;
      masterPassword = '';
      localStorage.removeItem('dental_tv_master_password');
      if (autoSyncTimer) {
        clearInterval(autoSyncTimer);
        autoSyncTimer = null;
      }
      document.getElementById('login-screen').classList.remove('hidden');
      document.getElementById('main-screen').classList.add('hidden');
      document.getElementById('master-password').value = '';
    }
    
    async function showTab(tab) {
      // 모든 컨텐츠 숨기기
      document.getElementById('content-playlist').classList.add('hidden');
      document.getElementById('content-subtitles').classList.add('hidden');
      document.getElementById('content-users').classList.add('hidden');
      document.getElementById('content-imweb-links').classList.add('hidden');
      
      // 모든 탭 비활성화
      document.getElementById('tab-playlist').classList.remove('tab-active', 'border-b-2', 'border-purple-500', 'text-purple-600');
      document.getElementById('tab-subtitles').classList.remove('tab-active', 'border-b-2', 'border-purple-500', 'text-purple-600');
      document.getElementById('tab-users').classList.remove('tab-active', 'border-b-2', 'border-purple-500', 'text-purple-600');
      document.getElementById('tab-imweb-links').classList.remove('tab-active', 'border-b-2', 'border-purple-500', 'text-purple-600');
      document.getElementById('tab-playlist').classList.add('text-gray-500');
      document.getElementById('tab-subtitles').classList.add('text-gray-500');
      document.getElementById('tab-users').classList.add('text-gray-500');
      document.getElementById('tab-imweb-links').classList.add('text-gray-500');
      
      // 선택된 탭 활성화
      document.getElementById('content-' + tab).classList.remove('hidden');
      document.getElementById('tab-' + tab).classList.add('tab-active', 'border-b-2', 'border-purple-500', 'text-purple-600');
      document.getElementById('tab-' + tab).classList.remove('text-gray-500');
      
      if (tab === 'users') {
        await autoSyncImwebMembers(false);
        loadUsers();
      }
      if (tab === 'subtitles') {
        loadSubtitles();
        loadSubtitleSettings();
      }
      if (tab === 'imweb-links') {
        const passwordInput = document.getElementById('imweb-links-password');
        if (passwordInput && masterPassword && !passwordInput.value) {
          passwordInput.value = masterPassword;
        }
        await autoSyncImwebMembers(false);
      }
    }
    
    async function loadMasterInfo() {
      try {
        const res = await fetch(API_BASE + '/info');
        const data = await res.json();
        
        if (!data.masterPlaylist) {
          // 마스터 플레이리스트 생성
          await fetch(API_BASE + '/playlist', { method: 'POST' });
        }
        
        loadItems();
      } catch (e) {
        console.error(e);
      }
    }
    
    function initMasterSortable() {
      const container = document.getElementById('items-container');
      if (!container || typeof Sortable === 'undefined') return;

      if (masterSortable) {
        masterSortable.destroy();
        masterSortable = null;
      }

      masterSortable = new Sortable(container, {
        animation: 150,
        handle: '.master-drag-handle',
        onEnd: async () => {
          const items = Array.from(container.querySelectorAll('[data-master-item="1"]'));
          const order = items
            .map((el, index) => ({
              id: parseInt(el.getAttribute('data-item-id'), 10),
              sort_order: index + 1
            }))
            .filter(item => !Number.isNaN(item.id));

          items.forEach((el, index) => {
            const badge = el.querySelector('.master-order-badge');
            if (badge) badge.textContent = String(index + 1);
          });

          try {
            const res = await fetch(API_BASE + '/items/reorder', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items: order })
            });
            if (!res.ok) {
              throw new Error('reorder_failed');
            }
          } catch (e) {
            console.error(e);
            showToast('순서 저장 실패', 'error');
          }
        }
      });
    }

    async function loadItems() {
      try {
        const res = await fetch(API_BASE + '/items');
        const data = await res.json();
        
        masterPlaylistId = data.playlistId;
        const items = data.items || [];
        
        document.getElementById('item-count').textContent = items.length + '개';
        
        const container = document.getElementById('items-container');
        if (items.length === 0) {
          container.innerHTML = '<p class="text-gray-400 text-center py-8">동영상을 추가해주세요</p>';
          return;
        }
        
        container.innerHTML = items.map((item, idx) => \`
          <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg" data-master-item="1" data-item-id="\${item.id}">
            <i class="fas fa-grip-vertical text-gray-300 cursor-move master-drag-handle"></i>
            <span class="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold text-sm master-order-badge">\${idx + 1}</span>
            <div class="w-16 h-10 bg-gray-200 rounded overflow-hidden flex-shrink-0">
              \${item.thumbnail_url ? \`<img src="\${item.thumbnail_url}" class="w-full h-full object-cover">\` : 
                \`<div class="w-full h-full flex items-center justify-center text-gray-400"><i class="fas fa-video"></i></div>\`}
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-gray-800 truncate">\${item.title || item.url}</p>
              <p class="text-xs text-gray-500">\${item.item_type.toUpperCase()}</p>
            </div>
            <button onclick="deleteItem(\${item.id})" class="text-red-500 hover:text-red-600 p-2">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        \`).join('');

        initMasterSortable();
      } catch (e) {
        console.error(e);
      }
    }
    
    async function addItem() {
      const url = document.getElementById('new-url').value.trim();
      if (!url) {
        alert('URL을 입력해주세요.');
        return;
      }
      
      try {
        const res = await fetch(API_BASE + '/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        
        if (res.ok) {
          document.getElementById('new-url').value = '';
          loadItems();
        } else {
          const data = await res.json();
          alert(data.error || '추가 실패');
        }
      } catch (e) {
        console.error(e);
        alert('추가 실패');
      }
    }
    
    async function deleteItem(itemId) {
      if (!confirm('이 동영상을 삭제하시겠습니까?')) return;
      
      try {
        await fetch(API_BASE + '/items/' + itemId, { method: 'DELETE' });
        loadItems();
      } catch (e) {
        console.error(e);
      }
    }
    
    // ========== 자막 관리 함수 ==========
    
    // SRT 파일 드래그 앤 드롭 설정
    function setupSubtitleDropzone() {
      const dropzone = document.getElementById('subtitle-dropzone');
      const textarea = document.getElementById('subtitle-content');
      const overlay = document.getElementById('drop-overlay');
      
      if (!dropzone || !textarea || !overlay) return;
      
      // 드래그 이벤트 처리
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
      });
      
      // 드래그 중 시각 효과
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
          overlay.classList.remove('hidden');
          textarea.classList.add('border-purple-500', 'bg-purple-50');
        });
      });
      
      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
          overlay.classList.add('hidden');
          textarea.classList.remove('border-purple-500', 'bg-purple-50');
        });
      });
      
      // 파일 드롭 처리
      dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length === 0) return;
        
        const file = files[0];
        // SRT, TXT 파일만 허용
        if (!file.name.match(/\\.(srt|txt)$/i)) {
          alert('SRT 또는 TXT 파일만 업로드할 수 있습니다.');
          return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
          textarea.value = event.target.result;
          // 파일명에서 Vimeo ID 추출 시도 (수정 모드가 아닐 때만)
          const vimeoIdMatch = file.name.match(/(\\d{8,})/);
          if (vimeoIdMatch) {
            const vimeoInput = document.getElementById('subtitle-vimeo-id');
            // 수정 모드(editingSubtitleId가 있음)가 아니거나, 입력값이 비어있을 때만 채움
            if (vimeoInput && !vimeoInput.value && !editingSubtitleId) {
              vimeoInput.value = vimeoIdMatch[1];
            }
          }
          if (editingSubtitleId) {
            showToast('자막 내용이 교체되었습니다. 저장 버튼을 눌러주세요.');
          } else {
            showToast('파일이 로드되었습니다: ' + file.name);
          }
        };
        reader.onerror = () => {
          alert('파일을 읽는 중 오류가 발생했습니다.');
        };
        reader.readAsText(file, 'UTF-8');
      });
    }
    
    // 파일 선택 핸들러 (불러오기 버튼용)
    function handleSrtFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      // SRT, TXT 파일만 허용
      if (!file.name.match(/\\.(srt|txt)$/i)) {
        alert('SRT 또는 TXT 파일만 업로드할 수 있습니다.');
        event.target.value = ''; // 입력 초기화
        return;
      }
      
      const textarea = document.getElementById('subtitle-content');
      const reader = new FileReader();
      
      reader.onload = (e) => {
        textarea.value = e.target.result;
        
        // 파일명에서 Vimeo ID 추출 시도 (수정 모드가 아닐 때만)
        const vimeoIdMatch = file.name.match(/(\\d{8,})/);
        if (vimeoIdMatch) {
          const vimeoInput = document.getElementById('subtitle-vimeo-id');
          // 수정 모드가 아니거나, 입력값이 비어있을 때만 채움
          if (vimeoInput && !vimeoInput.value && !editingSubtitleId) {
            vimeoInput.value = vimeoIdMatch[1];
          }
        }
        
        if (editingSubtitleId) {
          showToast('✅ 자막 내용이 교체되었습니다. 저장 버튼을 눌러주세요.');
        } else {
          showToast('✅ 파일 로드 완료: ' + file.name);
        }
      };
      
      reader.onerror = () => {
        alert('파일을 읽는 중 오류가 발생했습니다.');
      };
      
      reader.readAsText(file, 'UTF-8');
      event.target.value = ''; // 같은 파일 다시 선택할 수 있도록 초기화
    }
    
    function extractVimeoId(url) {
      if (!url) return null;
      // 숫자만 입력된 경우
      if (/^\\d+$/.test(url.trim())) return url.trim();
      // URL에서 추출
      const match = url.match(/vimeo\\.com\\/(\\d+)/);
      return match ? match[1] : null;
    }
    
    // 자막 스타일 미리보기 업데이트
    function updateSubtitlePreview() {
      const fontSize = document.getElementById('subtitle-font-size').value;
      const bgOpacity = document.getElementById('subtitle-bg-opacity').value;
      const textColor = document.getElementById('subtitle-text-color').value;
      const bgColor = document.getElementById('subtitle-bg-color').value;
      const bottomOffset = document.getElementById('subtitle-bottom-offset').value;
      
      // 라벨 업데이트
      document.getElementById('subtitle-font-size-label').textContent = fontSize + 'px';
      document.getElementById('subtitle-bg-opacity-label').textContent = bgOpacity + '%';
      document.getElementById('subtitle-text-color-label').textContent = textColor;
      document.getElementById('subtitle-bg-color-label').textContent = bgColor;
      document.getElementById('subtitle-bottom-offset-label').textContent = bottomOffset + 'px';
      
      // 미리보기 업데이트
      const preview = document.getElementById('subtitle-preview');
      const r = parseInt(bgColor.slice(1,3), 16);
      const g = parseInt(bgColor.slice(3,5), 16);
      const b = parseInt(bgColor.slice(5,7), 16);
      
      preview.style.fontSize = fontSize + 'px';
      preview.style.color = textColor;
      preview.style.background = 'rgba(' + r + ',' + g + ',' + b + ',' + (bgOpacity / 100) + ')';
      
      // 저장 버튼 상태 업데이트
      updateSaveButtonState();
    }
    
    // 미리보기 자막 선택 드롭다운 업데이트
    let subtitlesList = [];  // 자막 목록 저장
    
    // 저장된 설정값 추적 (변경 감지용)
    let savedSubtitleSettings = {
      font_size: 28,
      bg_opacity: 80,
      text_color: '#ffffff',
      bg_color: '#000000',
      bottom_offset: 80
    };
    
    // 설정 변경 여부 확인
    function hasSubtitleSettingsChanged() {
      const current = {
        font_size: parseInt(document.getElementById('subtitle-font-size').value),
        bg_opacity: parseInt(document.getElementById('subtitle-bg-opacity').value),
        text_color: document.getElementById('subtitle-text-color').value,
        bg_color: document.getElementById('subtitle-bg-color').value,
        bottom_offset: parseInt(document.getElementById('subtitle-bottom-offset').value)
      };
      
      return current.font_size !== savedSubtitleSettings.font_size ||
             current.bg_opacity !== savedSubtitleSettings.bg_opacity ||
             current.text_color.toLowerCase() !== savedSubtitleSettings.text_color.toLowerCase() ||
             current.bg_color.toLowerCase() !== savedSubtitleSettings.bg_color.toLowerCase() ||
             current.bottom_offset !== savedSubtitleSettings.bottom_offset;
    }
    
    // 저장 버튼 상태 업데이트
    function updateSaveButtonState() {
      const btn = document.getElementById('save-subtitle-settings-btn');
      const notice = document.getElementById('save-hint');
      if (!btn) return;
      
      if (hasSubtitleSettingsChanged()) {
        // 변경됨 - 버튼 활성화, 깜박임 효과
        btn.disabled = false;
        btn.classList.remove('bg-gray-400', 'cursor-not-allowed', 'opacity-60');
        btn.classList.add('save-needed');
        if (notice) notice.classList.remove('hidden');
      } else {
        // 변경 없음 - 버튼 비활성화
        btn.disabled = true;
        btn.classList.remove('save-needed');
        btn.classList.add('bg-gray-400', 'cursor-not-allowed', 'opacity-60');
        if (notice) notice.classList.add('hidden');
      }
    }

    function toggleSubtitlePreview() {
      const wrapper = document.getElementById('subtitle-preview-wrapper');
      const btn = document.getElementById('subtitle-preview-toggle');
      if (!wrapper || !btn) return;

      const isHidden = wrapper.classList.contains('hidden');
      wrapper.classList.toggle('hidden');
      btn.textContent = isHidden ? '미리보기 접기' : '미리보기 펼치기';
    }
    
    function updatePreviewSubtitleSelect() {
      const select = document.getElementById('preview-subtitle-select');
      if (!select) return;
      
      select.innerHTML = '<option value="">-- 자막을 선택하세요 (' + subtitlesList.length + '개) --</option>';
      
      subtitlesList.forEach((sub, idx) => {
        // 첫 번째 자막 텍스트 추출
        const firstLine = extractFirstSubtitleText(sub.content);
        const cueCount = Math.floor(sub.content.split('\\n').filter(l => l.trim()).length / 3);
        const option = document.createElement('option');
        option.value = idx;
        option.textContent = '[Vimeo ' + sub.vimeo_id + '] ' + firstLine + ' (' + cueCount + '개 자막)';
        select.appendChild(option);
      });
    }
    
    // SRT에서 첫 번째 자막 텍스트 추출
    function extractFirstSubtitleText(content) {
      const lines = content.split('\\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // 숫자만 있는 줄이나 시간 코드 줄 건너뛰기
        if (/^\\d+$/.test(line)) continue;
        if (line.includes('-->')) continue;
        if (line.length > 0) {
          return line.length > 30 ? line.substring(0, 30) + '...' : line;
        }
      }
      return '(내용 없음)';
    }
    
    // 미리보기 자막 변경
    function onPreviewSubtitleChange() {
      const select = document.getElementById('preview-subtitle-select');
      const preview = document.getElementById('subtitle-preview');
      const infoEl = document.getElementById('selected-subtitle-info');
      const nameEl = document.getElementById('selected-subtitle-name');
      
      if (!select || !preview) return;
      
      const idx = select.value;
      if (idx === '' || !subtitlesList[idx]) {
        preview.textContent = '자막을 선택하면 여기에 미리보기가 표시됩니다';
        if (infoEl) infoEl.classList.add('hidden');
      } else {
        // 선택된 자막의 첫 번째 텍스트 사용
        const sub = subtitlesList[idx];
        const content = sub.content;
        const lines = content.split('\\n');
        let subtitleTexts = [];
        
        for (let i = 0; i < lines.length && subtitleTexts.length < 3; i++) {
          const line = lines[i].trim();
          if (/^\\d+$/.test(line)) continue;
          if (line.includes('-->')) continue;
          if (line.length > 0) {
            subtitleTexts.push(line);
          }
        }
        
        preview.textContent = subtitleTexts.join('\\n') || '(자막 내용 없음)';
        
        // 선택된 자막 정보 표시
        if (infoEl && nameEl) {
          nameEl.textContent = 'Vimeo ' + sub.vimeo_id + ' (자막 ' + Math.floor(lines.filter(l => l.trim()).length / 3) + '개)';
          infoEl.classList.remove('hidden');
        }
      }
      
      updateSubtitlePreview();
    }
    
    // 자막 목록에서 미리보기 선택 (더 이상 사용 안함 - 드롭다운으로 통합)
    function selectForPreview(idx) {
      const select = document.getElementById('preview-subtitle-select');
      if (select) {
        select.value = idx;
        onPreviewSubtitleChange();
        
        // 스타일 설정 섹션으로 스크롤
        const styleSection = document.querySelector('#content-subtitles .bg-white.rounded-xl.shadow-lg.p-6.mb-6:nth-of-type(2)');
        if (styleSection) {
          styleSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        showToast('미리보기에 자막이 적용되었습니다');
      }
    }
    
    // 자막 스타일 설정 로드
    async function loadSubtitleSettings() {
      try {
        const res = await fetch(API_BASE + '/subtitle-settings');
        if (res.ok) {
          const data = await res.json();
          const settings = data.settings || {};
          
          document.getElementById('subtitle-font-size').value = settings.font_size || 28;
          document.getElementById('subtitle-bg-opacity').value = settings.bg_opacity || 80;
          document.getElementById('subtitle-text-color').value = settings.text_color || '#ffffff';
          document.getElementById('subtitle-bg-color').value = settings.bg_color || '#000000';
          document.getElementById('subtitle-bottom-offset').value = settings.bottom_offset || 80;
          
          // 저장된 설정값 기록 (변경 감지용)
          savedSubtitleSettings = {
            font_size: settings.font_size || 28,
            bg_opacity: settings.bg_opacity || 80,
            text_color: settings.text_color || '#ffffff',
            bg_color: settings.bg_color || '#000000',
            bottom_offset: settings.bottom_offset || 80
          };
          
          updateSubtitlePreview();
          updateSaveButtonState();
        }
      } catch (e) {
        console.error('자막 설정 로드 에러:', e);
      }
    }
    
    // 자막 스타일 설정 저장
    async function saveSubtitleSettings() {
      const settings = {
        font_size: parseInt(document.getElementById('subtitle-font-size').value),
        bg_opacity: parseInt(document.getElementById('subtitle-bg-opacity').value),
        text_color: document.getElementById('subtitle-text-color').value,
        bg_color: document.getElementById('subtitle-bg-color').value,
        position: 'bottom',
        bottom_offset: parseInt(document.getElementById('subtitle-bottom-offset').value)
      };
      
      try {
        const res = await fetch(API_BASE + '/subtitle-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
        
        if (res.ok) {
          showToast('자막 스타일이 저장되었습니다');
          // 저장된 설정값 업데이트
          savedSubtitleSettings = {
            font_size: settings.font_size,
            bg_opacity: settings.bg_opacity,
            text_color: settings.text_color,
            bg_color: settings.bg_color,
            bottom_offset: settings.bottom_offset
          };
          // 버튼 상태 업데이트 (비활성화)
          updateSaveButtonState();
        } else {
          const errData = await res.json();
          alert('저장 실패: ' + (errData.error || '알 수 없는 오류'));
        }
      } catch (e) {
        console.error('자막 설정 저장 에러:', e);
        alert('저장 실패: ' + e.message);
      }
    }
    
    async function loadSubtitles() {
      try {
        const res = await fetch(API_BASE + '/subtitles');
        const data = await res.json();
        const subtitles = data.subtitles || [];
        
        // 미리보기 선택용 목록 저장
        subtitlesList = subtitles;
        updatePreviewSubtitleSelect();
        
        document.getElementById('subtitle-count').textContent = subtitles.length + '개';
        
        const container = document.getElementById('subtitles-container');
        if (subtitles.length === 0) {
          container.innerHTML = '<p class="text-gray-400 text-center py-4">등록된 자막이 없습니다</p>';
          subtitlesList = [];
          updatePreviewSubtitleSelect();
          return;
        }
        
        container.innerHTML = subtitles.map((sub, idx) => {
          const preview = sub.content.substring(0, 100).replace(/\\n/g, ' ') + (sub.content.length > 100 ? '...' : '');
          const lines = sub.content.split('\\n').filter(l => l.trim()).length;
          const cueCount = Math.floor(lines / 3); // 대략적인 자막 개수
          return \`
            <div class="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-purple-300 transition-colors" id="subtitle-item-\${sub.id}">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="font-bold text-purple-600 text-lg">Vimeo: \${sub.vimeo_id}</span>
                    <span class="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">\${sub.language || 'ko'}</span>
                    <span class="px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded-full">~\${cueCount}개 자막</span>
                  </div>
                  <div class="bg-white p-2 rounded border text-sm text-gray-600 font-mono max-h-20 overflow-y-auto mb-2">
                    \${preview}
                  </div>
                  <p class="text-xs text-gray-400">등록: \${sub.created_at}</p>
                </div>
                <div class="flex flex-col gap-2 ml-4">
                  <input type="file" id="srt-replace-\${sub.id}" accept=".srt,.txt" class="hidden" onchange="handleSrtReplace(event, \${sub.id}, '\${sub.vimeo_id}')">
                  <button onclick="document.getElementById('srt-replace-\${sub.id}').click()" class="bg-purple-500 text-white hover:bg-purple-600 px-4 py-2 rounded text-sm font-medium">
                    <i class="fas fa-folder-open mr-1"></i>SRT 교체
                  </button>
                  <button onclick="deleteSubtitle(\${sub.id})" class="bg-red-100 text-red-600 hover:bg-red-200 px-3 py-1.5 rounded text-sm">
                    <i class="fas fa-trash mr-1"></i>삭제
                  </button>
                </div>
              </div>
            </div>
          \`;
        }).join('');
      } catch (e) {
        console.error('자막 로드 에러:', e);
      }
    }
    
    async function saveSubtitle() {
      const vimeoInput = document.getElementById('subtitle-vimeo-id').value.trim();
      const content = document.getElementById('subtitle-content').value.trim();
      
      const vimeoId = extractVimeoId(vimeoInput);
      if (!vimeoId) {
        alert('올바른 Vimeo URL 또는 ID를 입력해주세요.');
        return;
      }
      
      if (!content) {
        alert('자막 내용을 입력해주세요.');
        return;
      }
      
      try {
        const res = await fetch(API_BASE + '/subtitles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            vimeo_id: vimeoId, 
            content,
            id: editingSubtitleId  // 수정 중인 경우 ID 전달
          })
        });
        
        const data = await res.json();
        if (res.ok) {
          showToast(editingSubtitleId ? '자막이 수정되었습니다.' : '자막이 추가되었습니다.');
          clearSubtitleForm();
          loadSubtitles();
        } else {
          alert(data.error || '저장 실패');
        }
      } catch (e) {
        console.error(e);
        alert('저장 실패');
      }
    }
    
    async function editSubtitle(id, vimeoId) {
      try {
        const res = await fetch('/api/subtitles/' + vimeoId);
        const data = await res.json();
        
        if (data.subtitle) {
          editingSubtitleId = id;
          
          // Vimeo ID 입력란 설정 (읽기 전용)
          const vimeoInput = document.getElementById('subtitle-vimeo-id');
          vimeoInput.value = vimeoId;
          vimeoInput.readOnly = true;
          vimeoInput.classList.add('bg-gray-100', 'cursor-not-allowed');
          
          document.getElementById('subtitle-content').value = data.subtitle.content;
          
          // 헤더 텍스트 변경
          const formTitle = document.getElementById('subtitle-form-title');
          if (formTitle) {
            formTitle.innerHTML = '<i class="fas fa-edit mr-2"></i>자막 수정 <span class="text-sm font-normal text-purple-600">(Vimeo: ' + vimeoId + ')</span>';
          }
          
          // 드래그 오버레이 텍스트 변경
          const overlayText = document.getElementById('drop-overlay-text');
          if (overlayText) {
            overlayText.textContent = '새 SRT 파일로 교체하기';
          }
          
          // 버튼 텍스트 변경
          const saveBtnText = document.getElementById('save-subtitle-text');
          const saveBtn = document.getElementById('save-subtitle-btn');
          if (saveBtnText) saveBtnText.textContent = '수정 저장';
          if (saveBtn) {
            saveBtn.classList.remove('bg-purple-500', 'hover:bg-purple-600');
            saveBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
          }
          
          // 자막 추가 폼 하이라이트
          const subtitleForm = document.querySelector('#content-subtitles .bg-purple-50');
          if (subtitleForm) {
            subtitleForm.classList.add('ring-4', 'ring-blue-400', 'ring-offset-2');
            setTimeout(() => {
              subtitleForm.classList.remove('ring-4', 'ring-blue-400', 'ring-offset-2');
            }, 2000);
          }
          
          // 스크롤 위로 (폼으로)
          document.getElementById('content-subtitles').scrollIntoView({ behavior: 'smooth' });
          
          // 해당 아이템 하이라이트
          document.querySelectorAll('[id^="subtitle-item-"]').forEach(el => el.classList.remove('ring-2', 'ring-purple-500'));
          const item = document.getElementById('subtitle-item-' + id);
          if (item) item.classList.add('ring-2', 'ring-purple-500');
          
          showToast('📝 위 폼에서 자막을 수정하세요\\n파일 불러오기 버튼 또는 드래그로 SRT 교체 가능', 'success', 4000);
        }
      } catch (e) {
        console.error(e);
      }
    }
    
    async function deleteSubtitle(id) {
      if (!confirm('이 자막을 삭제하시겠습니까?')) return;
      
      try {
        const res = await fetch(API_BASE + '/subtitles/' + id, { method: 'DELETE' });
        if (res.ok) {
          showToast('자막이 삭제되었습니다.');
          // 삭제된 자막이 수정 중이었으면 폼 초기화
          if (editingSubtitleId === id) {
            clearSubtitleForm();
          }
          loadSubtitles();
        } else {
          alert('삭제 실패');
        }
      } catch (e) {
        console.error(e);
        alert('삭제 실패');
      }
    }
    
    function clearSubtitleForm() {
      // Vimeo ID 입력란 초기화 (편집 가능으로 복원)
      const vimeoInput = document.getElementById('subtitle-vimeo-id');
      vimeoInput.value = '';
      vimeoInput.readOnly = false;
      vimeoInput.classList.remove('bg-gray-100', 'cursor-not-allowed');
      
      document.getElementById('subtitle-content').value = '';
      editingSubtitleId = null;
      
      // 헤더 텍스트 원래대로
      const formTitle = document.getElementById('subtitle-form-title');
      if (formTitle) {
        formTitle.innerHTML = '<i class="fas fa-plus-circle mr-2"></i>자막 추가';
      }
      
      // 드래그 오버레이 텍스트 원래대로
      const overlayText = document.getElementById('drop-overlay-text');
      if (overlayText) {
        overlayText.textContent = 'SRT 파일을 놓으세요';
      }
      
      // 버튼 텍스트 원래대로
      const saveBtnText = document.getElementById('save-subtitle-text');
      const saveBtn = document.getElementById('save-subtitle-btn');
      if (saveBtnText) saveBtnText.textContent = '저장';
      if (saveBtn) {
        saveBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
        saveBtn.classList.add('bg-purple-500', 'hover:bg-purple-600');
      }
      
      // 하이라이트 제거
      document.querySelectorAll('[id^="subtitle-item-"]').forEach(el => el.classList.remove('ring-2', 'ring-purple-500'));
    }
    
    // SRT 파일 직접 교체 (목록에서 바로 교체)
    async function handleSrtReplace(event, subtitleId, vimeoId) {
      const file = event.target.files[0];
      if (!file) return;
      
      // SRT, TXT 파일만 허용
      if (!file.name.match(/\\.(srt|txt)$/i)) {
        alert('SRT 또는 TXT 파일만 업로드할 수 있습니다.');
        event.target.value = '';
        return;
      }
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target.result;
        
        if (!confirm('Vimeo ' + vimeoId + '의 자막을 이 파일로 교체하시겠습니까?\\n\\n파일: ' + file.name)) {
          event.target.value = '';
          return;
        }
        
        try {
          const res = await fetch(API_BASE + '/subtitles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vimeo_id: vimeoId,
              content: content,
              language: 'ko'
            })
          });
          
          const data = await res.json();
          
          if (res.ok) {
            showToast('✅ 자막이 교체되었습니다!');
            loadSubtitles();
          } else {
            alert(data.error || '교체 실패');
          }
        } catch (err) {
          console.error(err);
          alert('교체 실패');
        }
        
        event.target.value = '';
      };
      
      reader.onerror = () => {
        alert('파일을 읽는 중 오류가 발생했습니다.');
        event.target.value = '';
      };
      
      reader.readAsText(file, 'UTF-8');
    }
    
    async function loadUsers() {
      try {
        const res = await fetch(API_BASE + '/users');
        const data = await res.json();
        const users = data.users || [];
        
        document.getElementById('clinic-count').textContent = '(' + users.length + '개)';
        
        const container = document.getElementById('users-container');
        if (users.length === 0) {
          container.innerHTML = '<p class="text-gray-400 text-center py-8">등록된 치과가 없습니다. 위 버튼으로 치과를 등록하세요.</p>';
          return;
        }
        
        container.innerHTML = users.map(user => {
          const isActive = user.is_active !== 0;
          const statusBadge = isActive 
            ? '<span class="px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded-full">활성</span>'
            : '<span class="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">정지</span>';
          const toggleBtn = isActive
            ? \`<button onclick="suspendClinic('\${user.admin_code}', '\${user.clinic_name}')" class="bg-orange-100 text-orange-600 px-3 py-1 rounded text-sm hover:bg-orange-200" title="계정 정지">
                <i class="fas fa-pause"></i>
              </button>\`
            : \`<button onclick="activateClinic('\${user.admin_code}', '\${user.clinic_name}')" class="bg-green-100 text-green-600 px-3 py-1 rounded text-sm hover:bg-green-200" title="계정 활성화">
                <i class="fas fa-play"></i>
              </button>\`;
          
          // 구독 정보
          const subPlan = user.subscription_plan;
          const subEnd = user.subscription_end;
          const today = new Date().toISOString().split('T')[0];
          const isUnlimited = subPlan === 'unlimited';
          const isExpired = !isUnlimited && subEnd && subEnd < today;
          const daysLeft = subEnd ? Math.ceil((new Date(subEnd) - new Date()) / (1000 * 60 * 60 * 24)) : null;
          
          let subBadge = '';
          if (isUnlimited) {
            subBadge = '<span class="px-2 py-0.5 bg-purple-100 text-purple-600 text-xs rounded-full">무제한</span>';
          } else if (!subEnd) {
            subBadge = '<span class="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">미설정</span>';
          } else if (isExpired) {
            subBadge = '<span class="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">만료됨</span>';
          } else if (daysLeft <= 7) {
            subBadge = \`<span class="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs rounded-full">D-\${daysLeft}</span>\`;
          } else {
            subBadge = \`<span class="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">~\${subEnd}</span>\`;
          }
          
          return \`
          <div class="flex items-center gap-3 p-4 \${isActive ? 'bg-gray-50' : 'bg-red-50'} rounded-lg hover:bg-gray-100">
            <div class="w-10 h-10 \${isActive ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-400'} rounded-full flex items-center justify-center flex-shrink-0">
              <i class="fas fa-hospital"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="font-medium \${isActive ? 'text-gray-800' : 'text-gray-500'}">\${user.clinic_name || '이름 없음'}</p>
                \${statusBadge}
                \${subBadge}
              </div>
              <p class="text-xs text-gray-500 truncate">
                \${user.imweb_member_id ? '📧 ' + user.imweb_member_id : ''} 
                | TV: /tv/\${user.short_code || '-'}
                \${user.suspended_at ? ' | 정지: ' + user.suspended_at.slice(0,10) : ''}
              </p>
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <button onclick="openSubscriptionModal('\${user.admin_code}', '\${user.clinic_name}', '\${user.subscription_end || ''}', '\${user.subscription_plan || 'trial'}')" class="bg-purple-100 text-purple-600 px-3 py-1 rounded text-sm hover:bg-purple-200" title="구독 설정">
                <i class="fas fa-calendar-alt"></i>
              </button>
              <button onclick="copyUrl('\${user.admin_code}')" class="bg-blue-100 text-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-200" title="URL 복사">
                <i class="fas fa-copy"></i>
              </button>
              \${toggleBtn}
              <button onclick="deleteClinic('\${user.admin_code}', '\${user.clinic_name}')" class="bg-red-100 text-red-600 px-3 py-1 rounded text-sm hover:bg-red-200" title="삭제">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        \`}).join('');
      } catch (e) {
        console.error(e);
      }
    }
    
    // 치과 URL 복사
    function copyUrl(adminCode) {
      const url = '${baseUrl}/admin/' + adminCode;
      navigator.clipboard.writeText(url).then(() => {
        const toast = document.getElementById('copy-toast');
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2000);
      });
    }
    
    // 새 치과 등록 모달
    function openAddClinicModal() {
      openModal('add-clinic-modal');
      document.getElementById('new-clinic-name').value = '';
      document.getElementById('new-clinic-email').value = '';
    }
    
    function closeAddClinicModal() {
      document.getElementById('add-clinic-modal').style.display = 'none';
    }
    
    // 구독 설정 모달
    function openSubscriptionModal(adminCode, clinicName, currentEndDate, currentPlan) {
      openModal('subscription-modal');
      document.getElementById('sub-admin-code').value = adminCode;
      document.getElementById('sub-clinic-name').textContent = '치과: ' + clinicName;
      
      // 플랜 설정
      document.getElementById('sub-plan').value = currentPlan || 'trial';
      onPlanChange();
      
      // 오늘 날짜
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('sub-start').value = today;
      
      // 기존 종료일이 있으면 사용, 없으면 1개월 후
      if (currentEndDate) {
        document.getElementById('sub-end').value = currentEndDate;
      } else {
        const oneMonthLater = new Date();
        oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
        document.getElementById('sub-end').value = oneMonthLater.toISOString().split('T')[0];
      }
    }
    
    function closeSubscriptionModal() {
      document.getElementById('subscription-modal').style.display = 'none';
    }
    
    // 플랜 변경 시 UI 업데이트
    function onPlanChange() {
      const plan = document.getElementById('sub-plan').value;
      const isUnlimited = plan === 'unlimited';
      
      document.getElementById('unlimited-notice').classList.toggle('hidden', !isUnlimited);
      document.getElementById('quick-buttons').classList.toggle('hidden', isUnlimited);
      document.getElementById('end-optional').classList.toggle('hidden', !isUnlimited);
    }
    
    // 빠른 구독 기간 설정
    function quickSetSubscription(months) {
      const today = new Date();
      document.getElementById('sub-start').value = today.toISOString().split('T')[0];
      
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + months);
      document.getElementById('sub-end').value = endDate.toISOString().split('T')[0];
      
      // 플랜 자동 설정
      if (months === 1) {
        document.getElementById('sub-plan').value = 'monthly';
      } else if (months >= 12) {
        document.getElementById('sub-plan').value = 'yearly';
      } else {
        document.getElementById('sub-plan').value = 'monthly';
      }
      onPlanChange();
    }
    
    // 구독 저장
    async function saveSubscription() {
      const adminCode = document.getElementById('sub-admin-code').value;
      const plan = document.getElementById('sub-plan').value;
      const startDate = document.getElementById('sub-start').value;
      const endDate = document.getElementById('sub-end').value;
      
      // 무제한이 아닌 경우에만 종료일 필수
      if (plan !== 'unlimited' && !endDate) {
        alert('종료일을 선택해주세요.');
        return;
      }
      
      try {
        const res = await fetch(API_BASE + '/clinics/' + adminCode + '/subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan, startDate, endDate })
        });
        
        if (res.ok) {
          alert('구독 기간이 설정되었습니다.\\n종료일: ' + endDate);
          closeSubscriptionModal();
          loadUsers();
        } else {
          const data = await res.json();
          alert(data.error || '설정 실패');
        }
      } catch (e) {
        console.error(e);
        alert('설정 실패');
      }
    }
    
    // 새 치과 등록
    async function addClinic() {
      const clinicName = document.getElementById('new-clinic-name').value.trim();
      const email = document.getElementById('new-clinic-email').value.trim();
      
      if (!clinicName) {
        alert('치과명을 입력해주세요.');
        return;
      }
      
      try {
        const res = await fetch(API_BASE + '/clinics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clinicName, email })
        });
        
        const data = await res.json();
        
        if (res.ok) {
          closeAddClinicModal();
          loadUsers();
          
          // URL 복사 안내
          const url = '${baseUrl}' + data.url;
          if (confirm('치과가 등록되었습니다!\\n\\n전용 URL: ' + url + '\\n\\n이 URL을 복사하시겠습니까?')) {
            navigator.clipboard.writeText(url);
            const toast = document.getElementById('copy-toast');
            toast.classList.remove('hidden');
            setTimeout(() => toast.classList.add('hidden'), 2000);
          }
        } else {
          alert(data.error || '등록 실패');
        }
      } catch (e) {
        console.error(e);
        alert('등록 실패');
      }
    }
    
    // 치과 삭제
    async function deleteClinic(adminCode, clinicName) {
      if (!confirm(clinicName + ' 치과를 삭제하시겠습니까?\\n\\n⚠️ 모든 플레이리스트와 설정이 삭제됩니다.')) return;
      
      try {
        const res = await fetch(API_BASE + '/clinics/' + adminCode, { method: 'DELETE' });
        
        if (res.ok) {
          loadUsers();
        } else {
          const data = await res.json();
          alert(data.error || '삭제 실패');
        }
      } catch (e) {
        console.error(e);
        alert('삭제 실패');
      }
    }
    
    // 계정 정지
    async function suspendClinic(adminCode, clinicName) {
      const reason = prompt(\`"\${clinicName}" 계정을 정지하시겠습니까?\\n\\n정지 사유를 입력하세요 (선택사항):\`, '');
      if (reason === null) return; // 취소
      
      try {
        const res = await fetch(API_BASE + '/clinics/' + adminCode + '/suspend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason })
        });
        
        if (res.ok) {
          alert('계정이 정지되었습니다.\\n해당 치과는 더 이상 로그인할 수 없습니다.');
          loadUsers();
        } else {
          const data = await res.json();
          alert(data.error || '정지 실패');
        }
      } catch (e) {
        console.error(e);
        alert('정지 실패');
      }
    }
    
    // 계정 활성화
    async function activateClinic(adminCode, clinicName) {
      if (!confirm(\`"\${clinicName}" 계정을 다시 활성화하시겠습니까?\`)) return;
      
      try {
        const res = await fetch(API_BASE + '/clinics/' + adminCode + '/activate', {
          method: 'POST'
        });
        
        if (res.ok) {
          alert('계정이 활성화되었습니다.\\n해당 치과는 다시 로그인할 수 있습니다.');
          loadUsers();
        } else {
          const data = await res.json();
          alert(data.error || '활성화 실패');
        }
      } catch (e) {
        console.error(e);
        alert('활성화 실패');
      }
    }
    
    // 아임웹 회원 동기화
    async function syncImwebMembers() {
      const btn = document.getElementById('sync-btn');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>불러오는 중...';
      
      try {
        const password = (masterPassword || '').trim();
        if (!password) {
          alert('마스터 비밀번호가 필요합니다. 다시 로그인해주세요.');
          return;
        }
        await autoSyncImwebMembers(false);
        const res = await fetch(API_BASE + '/imweb-members?password=' + encodeURIComponent(password));
        const data = await res.json();
        
        if (!res.ok) {
          alert(data.error || '아임웹 연동 실패');
          return;
        }
        
        const members = data.members || [];
        const section = document.getElementById('imweb-members-section');
        const container = document.getElementById('imweb-members-container');
        
        section.classList.remove('hidden');
        
        if (members.length === 0) {
          container.innerHTML = '<p class="text-gray-500 text-center py-4">아임웹에 등록된 회원이 없습니다.</p>';
          return;
        }
        
        // 이미 등록된 이메일 목록 가져오기
        const usersRes = await fetch(API_BASE + '/users');
        const usersData = await usersRes.json();
        const registeredEmails = (usersData.users || []).map(u => u.imweb_member_id).filter(Boolean);
        
        container.innerHTML = members.map(m => {
          const isRegistered = registeredEmails.includes(m.email);
          return \`
            <div class="flex items-center gap-3 p-3 bg-white rounded-lg">
              <div class="flex-1">
                <p class="font-medium text-gray-800">\${m.name || '이름 없음'}</p>
                <p class="text-xs text-gray-500">\${m.email}</p>
              </div>
              \${isRegistered ? 
                '<span class="text-green-600 text-sm"><i class="fas fa-check mr-1"></i>등록됨</span>' :
                \`<button onclick="registerFromImweb('\${m.email}', '\${m.name || ''}')" class="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">
                  <i class="fas fa-plus mr-1"></i>등록
                </button>\`
              }
            </div>
          \`;
        }).join('');
        
      } catch (e) {
        console.error(e);
        alert('아임웹 연동 오류');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sync mr-2"></i>아임웹 회원 불러오기';
      }
    }
    
    function hideImwebMembers() {
      document.getElementById('imweb-members-section').classList.add('hidden');
    }

    function showImwebLinksError(message) {
      const errorEl = document.getElementById('imweb-links-error');
      if (!errorEl) return;
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }

    function hideImwebLinksError() {
      const errorEl = document.getElementById('imweb-links-error');
      if (!errorEl) return;
      errorEl.classList.add('hidden');
    }

    function buildImwebLoginLink(member) {
      const memberCode = member.member_code || member.memberCode || member.uid || member.id || '';
      const email = member.email || '';
      if (memberCode && email) {
        return '${baseUrl}/embed/' + encodeURIComponent(memberCode) + '?email=' + encodeURIComponent(email);
      }
      return '${baseUrl}/login';
    }

    async function loadImwebLinks() {
      hideImwebLinksError();
      const passwordInput = document.getElementById('imweb-links-password');
      const password = (passwordInput && passwordInput.value.trim()) || masterPassword;
      const tbody = document.getElementById('imweb-links-body');
      if (!password) {
        showImwebLinksError('마스터 비밀번호를 입력해주세요.');
        return;
      }

      if (tbody) tbody.innerHTML = '';

      try {
        await autoSyncImwebMembers(false);
        const res = await fetch(API_BASE + '/imweb-members?password=' + encodeURIComponent(password));
        const data = await res.json();

        if (!res.ok) {
          showImwebLinksError(data.error || '회원 목록을 불러올 수 없습니다.');
          return;
        }

        const members = data.members || [];
        if (members.length === 0) {
          showImwebLinksError('회원 목록이 비어 있습니다.');
          return;
        }

        if (tbody) {
          members.forEach(member => {
            const link = buildImwebLoginLink(member);
            const row = document.createElement('tr');
            const registeredLabel = member.registered
              ? '<span class="text-green-600">등록됨</span>'
              : '<span class="text-gray-400">미등록</span>';

            row.innerHTML =
              '<td class="px-3 py-2">' + (member.name || '-') + '</td>' +
              '<td class="px-3 py-2">' + (member.email || '-') + '</td>' +
              '<td class="px-3 py-2">' + (member.member_code || '-') + '</td>' +
              '<td class="px-3 py-2">' + registeredLabel + '</td>' +
              '<td class="px-3 py-2">' +
                '<div class="flex items-center gap-2">' +
                  '<input type="text" class="w-full border rounded px-2 py-1 text-xs" value="' + link + '" readonly />' +
                  '<button class="imweb-copy-btn bg-gray-100 px-2 py-1 rounded" data-link="' + link + '">복사</button>' +
                '</div>' +
              '</td>';
            tbody.appendChild(row);
          });

          document.querySelectorAll('.imweb-copy-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const link = e.currentTarget.getAttribute('data-link');
              try {
                await navigator.clipboard.writeText(link);
                e.currentTarget.textContent = '복사됨';
                setTimeout(() => { e.currentTarget.textContent = '복사'; }, 1200);
              } catch (err) {
                const input = e.currentTarget.closest('div').querySelector('input');
                if (input) {
                  input.select();
                  document.execCommand('copy');
                  e.currentTarget.textContent = '복사됨';
                  setTimeout(() => { e.currentTarget.textContent = '복사'; }, 1200);
                } else {
                  showImwebLinksError('클립보드 복사에 실패했습니다.');
                }
              }
            });
          });
        }
      } catch (err) {
        showImwebLinksError('서버 연결에 실패했습니다.');
      }
    }
    
    // 아임웹 회원으로 치과 등록
    async function registerFromImweb(email, name) {
      try {
        const res = await fetch(API_BASE + '/clinics/from-imweb', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name: name || '내 치과' })
        });
        
        const data = await res.json();
        
        if (res.ok) {
          // 목록 새로고침
          syncImwebMembers();
          loadUsers();
          
          // URL 복사 안내
          const url = '${baseUrl}' + data.url;
          if (confirm('치과가 등록되었습니다!\\n\\n전용 URL: ' + url + '\\n\\n이 URL을 복사하시겠습니까?')) {
            navigator.clipboard.writeText(url);
            const toast = document.getElementById('copy-toast');
            toast.classList.remove('hidden');
            setTimeout(() => toast.classList.add('hidden'), 2000);
          }
        } else {
          alert(data.error || '등록 실패');
        }
      } catch (e) {
        console.error(e);
        alert('등록 실패');
      }
    }
  </script>
</body>
</html>
  `)
})


// ============================================
// 복구된 라우트 핸들러
// ============================================

// 관리자 페이지 (레거시)
app.get('/admin-legacy/:adminCode', async (c) => {
  const adminCode = c.req.param('adminCode')

  return c.html(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>치과 TV 관리자</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-white">
  <div id="app">
    <div class="max-w-7xl mx-auto px-4 py-3 border-b flex justify-between items-center">
      <div class="flex items-center gap-2">
        <i class="fas fa-tv text-xl text-blue-500"></i>
        <h1 class="font-bold text-lg">치과 TV 관리자</h1>
      </div>
    </div>
    <div class="max-w-7xl mx-auto px-4 py-6">
      <iframe 
        src="https://dental-tv-app.pages.dev/admin-inner/${adminCode}"
        width="100%"
        height="800"
        frameborder="0"
        class="w-full h-[calc(100vh-100px)]"
      ></iframe>
    </div>
  </div>
</body>
</html>
  `)
})

// 실제 관리자 페이지 로직 (iframe 내부용 - 간소화 버전)
app.get('/admin-inner/:adminCode', async (c) => {
  const adminCode = c.req.param('adminCode')

  try {
    const user = await getOrCreateUser(c.env.DB, adminCode)
    if (!user) {
      throw new Error('user_not_found')
    }

    // 기본 데이터 로드
    const playlists = await c.env.DB.prepare(
      'SELECT * FROM playlists WHERE user_id = ?'
    ).bind(user.id).all()

    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
      </head>
      <body class="bg-white p-6">
        <div class="max-w-4xl mx-auto">
          <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
            <i class="fas fa-list text-blue-500"></i> 대기실/체어 관리
          </h2>
          
          <div class="grid gap-4">
            ${playlists.results.map(p => `
              <div class="border rounded-lg p-4 flex justify-between items-center bg-gray-50">
                <div>
                  <h3 class="font-bold text-lg">${p.name}</h3>
                  <p class="text-sm text-gray-500">코드: ${p.short_code}</p>
                </div>
                <div class="flex gap-2">
                  <a href="/tv/${p.short_code}" target="_blank" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                    <i class="fas fa-play mr-1"></i> TV 열기
                  </a>
                </div>
              </div>
            `).join('')}
          </div>
          
          <div class="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p class="text-yellow-800">
              <i class="fas fa-tools mr-2"></i>
              시스템 복구 중입니다. 현재는 재생 확인만 가능하며, 상세 편집 기능은 곧 복구됩니다.
            </p>
          </div>
        </div>
      </body>
      </html>
    `)
  } catch (err) {
    return c.html(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>관리자 페이지 오류</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-50">
        <div class="max-w-xl mx-auto px-6 py-16 text-center">
          <h1 class="text-xl font-bold text-gray-800 mb-3">관리자 페이지를 불러올 수 없습니다</h1>
          <p class="text-sm text-gray-600 mb-6">잠시 후 다시 시도해 주세요.</p>
          <button onclick="location.reload()" class="px-4 py-2 bg-blue-500 text-white rounded">다시 시도</button>
        </div>
      </body>
      </html>
    `)
  }
})

// 기본 페이지
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>치과 TV</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 h-screen flex items-center justify-center">
      <div class="bg-white p-8 rounded-xl shadow-lg text-center">
        <h1 class="text-2xl font-bold mb-4">치과 TV 서비스</h1>
        <p class="text-gray-600">관리자 페이지에 접속하여 사용하세요.</p>
      </div>
    </body>
    </html>
  `)
})

export default app

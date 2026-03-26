import { Hono } from 'hono'
import { cors } from 'hono/cors'

function getKSTDate() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
}

// KST 기준 오늘의 UTC 시작 시각 (KST 00:00 = UTC 전날 15:00)
function getKSTTodayStartUTC() {
  const kstDate = getKSTDate(); // e.g. "2026-03-26"
  // KST 00:00 = UTC -9h = 전날 15:00
  const kstMidnight = new Date(kstDate + 'T00:00:00+09:00');
  return kstMidnight.toISOString(); // e.g. "2026-03-25T15:00:00.000Z"
}

type Bindings = {
  DB: D1Database
  IMWEB_KEY?: string
  IMWEB_SECRET?: string
}

type Variables = {
  member: any
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()
app.onError((err, c) => {
  return c.json({ error: '서버오류: ' + (err.message || String(err)), stack: err.stack }, 500)
})

// ==================== DB Init on first request ====================
let dbInitialized = false
app.use('*', async (c, next) => {
  if (!dbInitialized && c.env.DB) {
    try {
      await ensureSchema(c.env.DB)
      dbInitialized = true
    } catch (e) {
      console.error('DB init error:', e)
    }
  }
  await next()
})

// ==================== CORS ====================
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// ==================== Auth Middleware ====================
function decodeToken(token: string): any {
  try {
    return JSON.parse(atob(token))
  } catch { return null }
}

function createToken(member: any): string {
  return btoa(JSON.stringify({ id: member.id, role: member.role, ts: Date.now() }))
}

async function authMiddleware(c: any, next: any) {
  const auth = c.req.header('Authorization')
  if (!auth || !auth.startsWith('Bearer ')) {
    return c.json({ error: '인증 토큰이 필요합니다.' }, 401)
  }
  const decoded = decodeToken(auth.replace('Bearer ', ''))
  if (!decoded || !decoded.id) {
    return c.json({ error: '유효하지 않은 토큰입니다.' }, 401)
  }
  const member = await c.env.DB.prepare('SELECT * FROM members WHERE id = ?').bind(decoded.id).first()
  if (!member) return c.json({ error: '사용자를 찾을 수 없습니다.' }, 401)
  c.set('member', member)
  await next()
}

// ==================== Auth-required routes ====================
app.use('/api/dashboard', authMiddleware)
// app.use('/api/patients', authMiddleware)
// app.use('/api/patients/*', authMiddleware)
app.use('/api/clinics/:id/patients', authMiddleware)
app.use('/api/clinics/:id/patients/*', authMiddleware)
app.use('/api/payments', authMiddleware)
app.use('/api/payments/*', authMiddleware)
// Note: /api/coupons/check/* and /api/coupons/use/* are public (QR scan)
app.use('/api/coupons/issue', authMiddleware)
app.use('/api/coupons/auto-issue-background', authMiddleware)
app.use('/api/coupons/auto-eligible', authMiddleware)
app.use('/api/coupons/undelivered', authMiddleware)
app.use('/api/admin/templates', authMiddleware)
app.use('/api/admin/templates/*', authMiddleware)
app.use('/api/coupons/clinic', authMiddleware)
// app.use('/api/coupons/my', authMiddleware)
app.use('/api/coupons/templates', authMiddleware)
app.use('/api/coupons/templates/*', authMiddleware)
app.use('/api/templates/global', authMiddleware)
app.use('/api/templates/import', authMiddleware)
app.use('/api/members', authMiddleware)
app.use('/api/auth/me', authMiddleware)
app.use('/api/points/*', authMiddleware)
app.use('/api/sync/*', authMiddleware)

// ==================== Health ====================
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', version: '4.6.0', timestamp: new Date().toISOString() })
})

// ==================== DB Init ====================
async function ensureSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS clinics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      business_number TEXT,
      address TEXT,
      phone TEXT,
      logo_url TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      imweb_member_id TEXT,
      imweb_group TEXT,
      email TEXT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'patient' CHECK(role IN ('super_admin','clinic_admin','patient')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','suspended')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      chart_number TEXT,
      birth_date TEXT,
      dentweb_id TEXT,
      last_treatment TEXT,
      last_visit_date TEXT,
      gender TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS clinic_admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      admin_role TEXT NOT NULL DEFAULT 'staff' CHECK(admin_role IN ('owner','staff')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS clinic_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL UNIQUE,
      default_point_rate REAL NOT NULL DEFAULT 5.0,
      category_rates TEXT DEFAULT '[]',
      coupon_auto_rules TEXT DEFAULT '[]',
      point_expiry_days INTEGER DEFAULT 365,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS patient_clinic (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      clinic_id INTEGER NOT NULL,
      total_points INTEGER NOT NULL DEFAULT 0,
      used_points INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (patient_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT,
      category TEXT DEFAULT '일반진료',
      input_type TEXT NOT NULL DEFAULT 'manual' CHECK(input_type IN ('manual','auto','bulk','dentweb')),
      payment_ref TEXT,
      point_rate REAL,
      point_earned INTEGER DEFAULT 0,
      payment_date TEXT NOT NULL DEFAULT (date('now')),
      payment_method TEXT,
      dentweb_receipt_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES members(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS point_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      payment_id INTEGER,
      coupon_id INTEGER,
      type TEXT NOT NULL CHECK(type IN ('earn','use','expire','adjust','refund')),
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS coupon_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      discount_type TEXT NOT NULL DEFAULT 'fixed' CHECK(discount_type IN ('fixed','percent')),
      discount_value INTEGER NOT NULL,
      min_payment INTEGER DEFAULT 0,
      auto_issue_points INTEGER,
      auto_issue_amount INTEGER,
      valid_days INTEGER NOT NULL DEFAULT 90,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      clinic_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','used','expired','revoked')),
      issued_by INTEGER,
      used_at TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (template_id) REFERENCES coupon_templates(id) ON DELETE CASCADE,
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (issued_by) REFERENCES members(id) ON DELETE SET NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS bulk_uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL,
      uploaded_by INTEGER NOT NULL,
      upload_type TEXT NOT NULL CHECK(upload_type IN ('patients','payments','combined')),
      total_rows INTEGER NOT NULL DEFAULT 0,
      success_rows INTEGER NOT NULL DEFAULT 0,
      error_rows INTEGER NOT NULL DEFAULT 0,
      result_summary TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES members(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL,
      sync_type TEXT NOT NULL CHECK(sync_type IN ('patients','payments','visits','full')),
      source TEXT NOT NULL DEFAULT 'dentweb',
      total_rows INTEGER DEFAULT 0,
      new_rows INTEGER DEFAULT 0,
      updated_rows INTEGER DEFAULT 0,
      error_rows INTEGER DEFAULT 0,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS setup_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL,
      code TEXT NOT NULL UNIQUE,
      created_by INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','used','expired')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES members(id) ON DELETE CASCADE
    )`)
  ])

  await db.batch([
    db.prepare("CREATE INDEX IF NOT EXISTS idx_members_dentweb_id ON members(dentweb_id);"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_members_chart_number ON members(chart_number);"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_pc_clinic_patient ON patient_clinic(clinic_id, patient_id);"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_pc_status ON patient_clinic(status);"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_payments_patient_clinic_date ON payments(patient_id, clinic_id, created_at);"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_coupons_patient_status ON coupons(patient_id, status);"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_point_logs_patient ON point_logs(patient_id);")
  ]).catch(() => {});

  // Migration: add is_birthday column if not exists
  await db.prepare("ALTER TABLE coupon_templates ADD COLUMN is_birthday INTEGER NOT NULL DEFAULT 0").run().catch(() => {})
  // Migration: add required_points column (쿠폰 발행 비용 포인트)
  await db.prepare("ALTER TABLE coupon_templates ADD COLUMN required_points INTEGER NOT NULL DEFAULT 0").run().catch(() => {})
  // Migration: add product_id column
  await db.prepare("ALTER TABLE coupon_templates ADD COLUMN product_id INTEGER").run().catch(() => {})
  // Migration: add shared_at column
  await db.prepare("ALTER TABLE coupons ADD COLUMN shared_at TEXT").run().catch(() => {})

  // Migration v3.4: 이미 완료됨 - 반복 실행 방지를 위해 비활성화
  // (이전에 서울밝은치과 링크 공용화, 잘못된 링크 삭제 등 완료)
  // 주의: 아래 코드들은 매 Worker 재시작 시 실행되어 치과별 배포된 링크를 삭제하는 버그 유발
  // 따라서 일회성 마이그레이션으로 제거함

  // Codi tables (link templates & patient links)
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS link_templates (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, thumbnail TEXT,
      clinic_id TEXT, created_at TEXT NOT NULL, default_memo TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS patient_links (
      id TEXT PRIMARY KEY, patient TEXT NOT NULL, patient_id TEXT, memo TEXT, clinic TEXT, phone TEXT,
      url TEXT NOT NULL, link_name TEXT, thumbnail TEXT, clinic_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`)
  ]).catch(() => {})
}

// Simple in-memory cache for Worker isolate
const memCache = new Map<string, { data: any, expires: number }>();
function getCached(key: string) {
  const cached = memCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;
  return null;
}
function setCache(key: string, data: any, ttl_ms = 10000) {
  memCache.set(key, { data, expires: Date.now() + ttl_ms });
}

// ==================== AUTO COUPON ISSUE ====================
async function checkAndAutoIssueCoupons(db: D1Database, clinicId: number, patientId: number, issuedBy: number | null) {
  try {
    // Get patient's current available points
    const pc = await db.prepare(
      'SELECT * FROM patient_clinic WHERE patient_id = ? AND clinic_id = ?'
    ).bind(patientId, clinicId).first()
    if (!pc) return []

    let availablePoints = (pc.total_points as number) - ((pc.used_points as number) || 0)
    
    // Get clinic settings with Cache
    let settings = getCached(`settings_${clinicId}`);
    if (!settings) {
      settings = await db.prepare('SELECT * FROM clinic_settings WHERE clinic_id = ?').bind(clinicId).first();
      if (settings) setCache(`settings_${clinicId}`, settings, 30000); // 30s cache
    }
    if (!settings) return []

    let autoRules: any[] = []
    try { autoRules = JSON.parse(settings.coupon_auto_rules as string || '[]') } catch { return [] }
    if (autoRules.length === 0) return []

    // Get active templates with Cache
    let templatesData = getCached(`templates_auto_${clinicId}`);
    if (!templatesData) {
      const res = await db.prepare(
        "SELECT * FROM coupon_templates WHERE clinic_id = ? AND status = 'active' AND auto_issue_points IS NOT NULL AND auto_issue_points > 0 AND (is_birthday = 0 OR is_birthday IS NULL)"
      ).bind(clinicId).all();
      templatesData = res;
      setCache(`templates_auto_${clinicId}`, templatesData, 30000);
    }
    const templates = templatesData;
    const activeTemplates = templates.results || []
    if (activeTemplates.length === 0) return []

    const issuedCoupons: any[] = []

    for (const template of activeTemplates) {
      const autoPoints = template.auto_issue_points as number
      if (availablePoints < autoPoints) continue

      // Check if patient already has an active coupon from this template (prevent duplicate)
      // If required_points > 0, we will deduct points. So they can get it multiple times as long as they have points.
      // If required_points is 0 (milestone reward), they should only get it ONCE ever.
      let shouldIssue = true;
      const reqPoints = (template.required_points as number) || 0;
      
      if (reqPoints > 0) {
        if (availablePoints < autoPoints || availablePoints < reqPoints) continue;
      } else {
        // One-time milestone reward: check if EVER issued
        const existingCoupon = await db.prepare(
          "SELECT id FROM coupons WHERE template_id = ? AND patient_id = ?"
        ).bind(template.id, patientId).first();
        if (existingCoupon) continue;
      }

      // Generate coupon code
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let code = ''
      for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
      code = code.substring(0, 4) + '-' + code.substring(4)

      const expiresAt = new Date(Date.now() + ((template.valid_days as number) || 90) * 86400000).toISOString().split('T')[0]
      // B2B MALL INVENTORY CHECK for Auto-Issue
      if (template.product_id) {
        const inv = await db.prepare('SELECT quantity FROM clinic_inventory WHERE clinic_id = ? AND product_id = ?')
          .bind(clinicId, template.product_id).first();
        if (!inv || (inv.quantity as number) < 1) continue; // Skip if no inventory
        
        // Deduct inventory
        await db.prepare('UPDATE clinic_inventory SET quantity = quantity - 1 WHERE clinic_id = ? AND product_id = ?')
          .bind(clinicId, template.product_id).run();
      }


      const reqPts = (template.required_points as number) || 0;
      if (reqPts > 0) {
        await db.prepare("UPDATE patient_clinic SET used_points = COALESCE(used_points, 0) + ?, updated_at = datetime('now') WHERE patient_id = ? AND clinic_id = ?").bind(reqPts, patientId, clinicId).run();
        const updatedPc = await db.prepare("SELECT * FROM patient_clinic WHERE patient_id = ? AND clinic_id = ?").bind(patientId, clinicId).first();
        if (updatedPc) {
           await db.prepare('INSERT INTO point_logs (clinic_id, patient_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)').bind(clinicId, patientId, 'use', reqPts, (updatedPc.total_points as number) - (updatedPc.used_points as number), '자동발행 차감 (' + template.name + ')').run();
        }
        availablePoints -= reqPts; // update loop state
      }

      await db.prepare(`
        INSERT INTO coupons (template_id, clinic_id, patient_id, code, expires_at, issued_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(template.id, clinicId, patientId, code, expiresAt, issuedBy).run()

      issuedCoupons.push({
        template_name: template.name,
        code,
        discount_type: template.discount_type,
        discount_value: template.discount_value,
        expires_at: expiresAt,
        auto_issue_points: autoPoints
      })
    }

    // Also check auto rules from settings (template_id + min_points)
    for (const rule of autoRules) {
      if (!rule.template_id || !rule.min_points) continue
      if (availablePoints < rule.min_points) continue

      const template = activeTemplates.find((t: any) => t.id === rule.template_id)
      if (!template) continue

      // Already issued by template loop above? skip
      if (issuedCoupons.some(c => c.template_name === template.name)) continue

      const reqPoints = (template.required_points as number) || 0;
      if (reqPoints > 0) {
        if (availablePoints < rule.min_points || availablePoints < reqPoints) continue;
      } else {
        const existingCoupon = await db.prepare(
          "SELECT id FROM coupons WHERE template_id = ? AND patient_id = ?"
        ).bind(rule.template_id, patientId).first();
        if (existingCoupon) continue;
      }

      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let code = ''
      for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
      code = code.substring(0, 4) + '-' + code.substring(4)

      const expiresAt = new Date(Date.now() + ((template.valid_days as number) || 90) * 86400000).toISOString().split('T')[0]

      
      // B2B MALL INVENTORY CHECK for Auto-Issue Rule
      if (template.product_id) {
        const inv = await db.prepare('SELECT quantity FROM clinic_inventory WHERE clinic_id = ? AND product_id = ?')
          .bind(clinicId, template.product_id).first();
        if (!inv || (inv.quantity as number) < 1) continue; // Skip if no inventory
        
        // Deduct inventory
        await db.prepare('UPDATE clinic_inventory SET quantity = quantity - 1 WHERE clinic_id = ? AND product_id = ?')
          .bind(clinicId, template.product_id).run();
      }

      const reqPts2 = (template.required_points as number) || 0;
      if (reqPts2 > 0) {
        await db.prepare("UPDATE patient_clinic SET used_points = COALESCE(used_points, 0) + ?, updated_at = datetime('now') WHERE patient_id = ? AND clinic_id = ?").bind(reqPts2, patientId, clinicId).run();
        const updatedPc = await db.prepare("SELECT * FROM patient_clinic WHERE patient_id = ? AND clinic_id = ?").bind(patientId, clinicId).first();
        if (updatedPc) {
           await db.prepare('INSERT INTO point_logs (clinic_id, patient_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)').bind(clinicId, patientId, 'use', reqPts2, (updatedPc.total_points as number) - (updatedPc.used_points as number), '자동발행 차감 (' + template.name + ')').run();
        }
        availablePoints -= reqPts2;
      }

      await db.prepare(`
        INSERT INTO coupons (template_id, clinic_id, patient_id, code, expires_at, issued_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(rule.template_id, clinicId, patientId, code, expiresAt, issuedBy).run()

      issuedCoupons.push({
        template_name: template.name,
        code,
        discount_type: template.discount_type,
        discount_value: template.discount_value,
        expires_at: expiresAt,
        auto_issue_points: rule.min_points
      })
    }

    return issuedCoupons
  } catch (e) {
    console.error('Auto coupon issue error:', e)
    return []
  }
}

// ==================== AUTH ====================
app.post('/api/auth/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { phone, password } = body
  if (!phone || !password) return c.json({ error: '전화번호와 비밀번호를 입력하세요.' }, 400)

  const member = await c.env.DB.prepare(
    'SELECT * FROM members WHERE phone = ? AND password_hash = ?'
  ).bind(phone, password).first()
  if (!member) return c.json({ error: '로그인 정보가 올바르지 않습니다.' }, 401)

  const clinics = await c.env.DB.prepare(`
    SELECT c.*, ca.admin_role FROM clinics c 
    JOIN clinic_admins ca ON c.id = ca.clinic_id 
    WHERE ca.member_id = ? AND c.status = 'active'
  `).bind(member.id).all()

  // If super_admin, return all clinics
  let clinicList = clinics.results || []
  if (member.role === 'super_admin' && clinicList.length === 0) {
    const all = await c.env.DB.prepare("SELECT *, 'owner' as admin_role FROM clinics WHERE status = 'active'").all()
    clinicList = all.results || []
  }

  return c.json({
    token: createToken(member),
    member: { id: member.id, name: member.name, phone: member.phone, email: member.email, role: member.role, imweb_member_id: (member as any).imweb_member_id || "" },
    clinics: clinicList
  })
})

// Imweb match - creates or matches a member from Imweb widget
// ★ 디버그: 최근 imweb-match 요청 로그 (최대 50건)
const _matchLogs: any[] = []
app.get('/api/debug/match-logs', (c) => {
  return c.json({ logs: _matchLogs.slice(-50) })
})

// ==================== 아임웹 API 연동 ====================
// 아임웹 access token 캐시 (워커 인스턴스 내)
let _imwebTokenCache: { token: string; expires: number } | null = null

async function getImwebToken(key: string, secret: string): Promise<string | null> {
  const now = Date.now()
  if (_imwebTokenCache && _imwebTokenCache.expires > now + 60000) {
    return _imwebTokenCache.token
  }
  try {
    const resp = await fetch('https://api.imweb.me/v2/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, secret })
    })
    const data: any = await resp.json()
    if (data.access_token) {
      // 아임웹 토큰 만료 기본 3600초
      _imwebTokenCache = { token: data.access_token, expires: now + (data.expire_in || 3600) * 1000 }
      return data.access_token
    }
  } catch(e) {}
  return null
}

// GET /api/imweb/members - 아임웹 회원 목록 조회 (super_admin 전용)
app.get('/api/imweb/members', authMiddleware, async (c) => {
  const member = c.get('member')
  if (!member || member.role !== 'super_admin') return c.json({ error: '권한이 없습니다.' }, 403)
  
  const key = c.env.IMWEB_KEY || '6e0afc05cea3b4966b5d937be58a97bbec5a157f77'
  const secret = c.env.IMWEB_SECRET || '9d7e63a446bdf2eb16a754'
  
  const token = await getImwebToken(key, secret)
  if (!token) {
    // 아임웹 API 인증 실패 시 DB에서 알려진 회원만 반환
    const rows = await c.env.DB.prepare(
      `SELECT m.id, m.name, m.email, m.imweb_member_id, m.imweb_group,
              ca.clinic_id as admin_clinic_id, cl.name as clinic_name
       FROM members m
       LEFT JOIN clinic_admins ca ON ca.member_id = m.id
       LEFT JOIN clinics cl ON cl.id = ca.clinic_id
       WHERE m.imweb_member_id IS NOT NULL AND m.imweb_member_id != ''
         AND m.status = 'approved'
       ORDER BY m.created_at DESC`
    ).all()
    return c.json({ members: rows.results || [], source: 'db_only', imweb_api: false })
  }
  
  try {
    // 아임웹 회원 목록 전체 조회 (최대 200명)
    const imwebResp = await fetch('https://api.imweb.me/v2/member/members?limit=200&offset=0', {
      headers: { 'access-token': token }
    })
    const imwebData: any = await imwebResp.json()
    const imwebMembers = imwebData.data?.list || []
    
    // DB 회원과 아임웹 회원 매핑
    const dbRows = await c.env.DB.prepare(
      `SELECT m.*, ca.clinic_id as admin_clinic_id, cl.name as clinic_name
       FROM members m
       LEFT JOIN clinic_admins ca ON ca.member_id = m.id
       LEFT JOIN clinics cl ON cl.id = ca.clinic_id
       WHERE m.imweb_member_id IS NOT NULL AND m.imweb_member_id != ''
         AND m.status = 'approved'`
    ).all()
    const dbMap: Record<string, any> = {}
    for (const row of (dbRows.results || []) as any[]) {
      dbMap[row.imweb_member_id] = row
    }
    
    // 아임웹 회원 목록 기반으로 통합 목록 구성
    const merged = imwebMembers.map((m: any) => {
      const code = m.member_code || m.uid
      const dbRow = dbMap[code]
      return {
        imweb_member_id: code,
        name: m.name || m.nick || dbRow?.name || '(미등록)',
        email: m.email || dbRow?.email || '',
        imweb_group: m.member_grade || '',
        admin_clinic_id: dbRow?.admin_clinic_id || null,
        clinic_name: dbRow?.clinic_name || null,
        registered: !!dbRow,
        join_time: m.join_time || '',
      }
    })
    
    // DB에만 있고 아임웹에 없는 회원도 포함 (삭제된 회원 등)
    const imwebCodes = new Set(imwebMembers.map((m: any) => m.member_code || m.uid))
    for (const row of (dbRows.results || []) as any[]) {
      if (!imwebCodes.has(row.imweb_member_id)) {
        merged.push({
          imweb_member_id: row.imweb_member_id,
          name: row.name,
          email: row.email || '',
          imweb_group: row.imweb_group || '',
          admin_clinic_id: row.admin_clinic_id || null,
          clinic_name: row.clinic_name || null,
          registered: true,
          join_time: '',
        })
      }
    }
    
    return c.json({ members: merged, source: 'imweb_api', total: merged.length })
  } catch(e: any) {
    return c.json({ error: 'imweb API error: ' + e.message }, 500)
  }
})

app.post('/api/auth/imweb-match', async (c) => {
 try {
  const body = await c.req.json().catch(() => ({}))
  const { imweb_member_id, imweb_name, imweb_email, imweb_group, imweb_phone, imweb_clinic_name, imweb_clinic_phone, imweb_clinic_addr, previous_id } = body
  
  // ★ 디버그 로그 기록 (메모리 + D1 영구 저장)
  const _logEntry: any = { ts: new Date().toISOString(), req: { imweb_member_id, imweb_name, imweb_email, imweb_clinic_name }, steps: [] }
  _matchLogs.push(_logEntry)
  if (_matchLogs.length > 100) _matchLogs.splice(0, 50)
  
  // ★ D1에 영구 로그 저장 (워커 재시작에도 유지)
  try {
    await c.env.DB.prepare(
      "INSERT INTO error_logs (message, created_at) VALUES (?, datetime('now'))"
    ).bind('[MATCH-REQ] ' + JSON.stringify({ imweb_member_id, imweb_name, imweb_email, imweb_clinic_name, imweb_phone, previous_id })).run()
  } catch(e) {}
  
  if (!imweb_member_id) return c.json({ error: '아임웹 회원 ID가 필요합니다.' }, 400)

  // ★★★ v5.10.5: 매칭 로직 - imweb_member_id가 최우선 식별자 ★★★
  // 핵심 원칙:
  // 1) imweb_member_id가 매칭의 핵심 — 같은 ID = 같은 사람
  // 2) 같은 ID의 후보 중 super_admin이 있으면 super_admin으로 매칭
  // 3) 이메일은 fallback — imweb_member_id 후보가 없을 때만 사용
  // 4) 이메일로 찾은 계정이 다른 imweb_member_id를 가지면 = 다른 사람 → 매칭 안 함
  // 5) 같은 이메일을 여러 계정이 공유할 수 있음 (운영자가 여러 치과 관리)
  let member: any = null

  // ===== Phase A: 해당 imweb_member_id로 등록된 모든 계정 조회 =====
  const allByImwebId = await c.env.DB.prepare(
    "SELECT m.*, ca.clinic_id FROM members m LEFT JOIN clinic_admins ca ON ca.member_id = m.id WHERE m.imweb_member_id = ? AND m.status = 'approved'"
  ).bind(imweb_member_id).all()
  const candidates = (allByImwebId.results || []) as any[]
  _logEntry.steps.push({ step: 'A-candidates', count: candidates.length, list: candidates.map((c:any) => ({ id: c.id, name: c.name, role: c.role, clinic_id: c.clinic_id })) })

  // ★★★ v5.10.11: 위젯 SYSWORDS와 동일한 INVALID_NAMES 목록 (멤버십관리 등 사이트명 필터)
  const MATCH_INVALID_NAMES = ['아임웹 사용자', 'Alarm', 'alarm', '마이페이지', '관리', '쿠폰관리', '쿠폰', '포인트', '포인트쿠폰',
    '포인트관리', '회원관리', '고객관리', 'admin', 'Admin', '설정', '대시보드', '결제', '주문', '장바구니',
    '알림', '검색', '홈', '메뉴', '멤버십관리', '멤버십', '관리자', '최고관리자', '모바일코디', '모바일 코디',
    '대기실TV', '대기실 TV', '임플란트코디', '임플란트 코디', '치과관리', '사이트관리', '사이트', '포인트관리시스템']
  
  // ★★★ v5.10.11: INVALID 이름으로 저장된 기존 계정 수정 처리 ★★★
  // 이전 버전에서 닉네임 감지 실패로 "멤버십관리" 등으로 등록된 계정을 올바른 이름으로 교정
  // → 이 계정과 같은 imweb_member_id + 유효한 닉네임으로 재접속 시 이름/클리닉명 업데이트

  // ===== Phase B: imweb_member_id 후보에서 매칭 =====
  if (candidates.length > 0) {
    // B-1: super_admin이 후보에 있으면 super_admin으로 매칭 (마스터는 마스터)
    const superAdmin = candidates.find((c: any) => c.role === 'super_admin')
    if (superAdmin) {
      member = superAdmin
      _logEntry.steps.push({ step: 'B-super_admin', id: superAdmin.id, name: superAdmin.name })
    } else {
      // ★★★ v5.10.9: 닉네임 기반 매칭 (같은 imweb_member_id라도 닉네임이 다르면 다른 치과)
      // 아임웹에서 같은 소유자 계정이 여러 치과 사이트를 운영할 수 있음
      // imweb_member_id는 동일하지만 닉네임(=치과명)이 다름
      // → 닉네임으로 매칭해서 올바른 치과 계정으로 연결
      
      // 1단계: imweb_name(닉네임)으로 정확히 매칭되는 계정 찾기 (단, INVALID 이름 후보는 우선 제외)
      const validCandidates = candidates.filter((c: any) => !MATCH_INVALID_NAMES.includes(c.name))
      const invalidCandidates = candidates.filter((c: any) => MATCH_INVALID_NAMES.includes(c.name))
      
      if (imweb_name && imweb_name.trim() && !MATCH_INVALID_NAMES.includes(imweb_name.trim())) {
        // 유효한 닉네임으로 정확히 매칭되는 계정 탐색
        const byName = validCandidates.find((c: any) => c.name === imweb_name.trim())
        if (byName) {
          member = byName
          _logEntry.steps.push({ step: 'B-name-match', id: byName.id, name: byName.name })
        }
      }
      
      // 2단계: 닉네임 매칭 실패 → 클리닉명으로 매칭
      if (!member && imweb_name && imweb_name.trim() && !MATCH_INVALID_NAMES.includes(imweb_name.trim())) {
        for (const cand of validCandidates) {
          const candClinic = cand.clinic_id ? await c.env.DB.prepare('SELECT name FROM clinics WHERE id = ?').bind(cand.clinic_id).first() : null
          const candClinicName = (candClinic as any)?.name || ''
          if (candClinicName === imweb_name.trim()) {
            member = cand
            _logEntry.steps.push({ step: 'B-clinic-name-match', id: cand.id, clinic: candClinicName })
            break
          }
        }
      }
      
      // ★★★ v5.10.11: INVALID 이름 계정 교정 처리 ★★★
      // 유효한 닉네임이 있는데 valid 후보가 없고, invalid 후보만 있는 경우:
      // → invalid 이름 계정을 올바른 이름으로 교정하고 매칭
      if (!member && imweb_name && imweb_name.trim() && !MATCH_INVALID_NAMES.includes(imweb_name.trim())) {
        if (validCandidates.length === 0 && invalidCandidates.length > 0) {
          // INVALID 이름으로 저장된 계정을 올바른 닉네임으로 교정
          const targetCand = invalidCandidates[0]
          const newName = imweb_name.trim()
          // 계정 이름 업데이트
          await c.env.DB.prepare("UPDATE members SET name = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(newName, targetCand.id).run()
          // 해당 클리닉명도 업데이트
          if (targetCand.clinic_id) {
            await c.env.DB.prepare("UPDATE clinics SET name = ?, updated_at = datetime('now') WHERE id = ?")
              .bind(newName, targetCand.clinic_id).run()
          }
          member = await c.env.DB.prepare('SELECT *, (SELECT clinic_id FROM clinic_admins WHERE member_id = members.id LIMIT 1) as clinic_id FROM members WHERE id = ?').bind(targetCand.id).first()
          _logEntry.steps.push({ step: 'B-invalid-name-fix', old_name: targetCand.name, new_name: newName, id: targetCand.id })
        }
      }
      
      // 3단계: 닉네임이 비어있는 경우 (SDK 로딩 지연 등)
      // ★★★ v5.10.10: 닉네임 없이 요청이 올 수 있음 (위젯 폴링 타임아웃)
      // - 후보 1개: 그 계정으로 매칭 (기존 계정 재접속)
      // - 후보 여러개 + 닉네임 없음: 선택 불가 → need_name 유도
      if (!member) {
        if (!imweb_name || !imweb_name.trim() || MATCH_INVALID_NAMES.includes(imweb_name.trim())) {
          // 닉네임 비어있거나 INVALID → SDK 로딩 지연 또는 사이트명 감지
          const usableCandidates = validCandidates.length > 0 ? validCandidates : candidates
          if (usableCandidates.length === 1) {
            member = usableCandidates[0]
            _logEntry.steps.push({ step: 'B-single-noname', id: member.id, name: member.name })
          } else if (usableCandidates.length > 1) {
            // 여러 후보 중 선택 불가 → 첫 번째(가장 최근)로 매칭
            member = usableCandidates[0]
            _logEntry.steps.push({ step: 'B-multi-noname-first', id: member.id, name: member.name, count: usableCandidates.length })
          }
        } else {
          // 닉네임이 있지만 매칭 실패 → 새 치과 계정 생성 필요
          _logEntry.steps.push({ step: 'B-no-name-match', req_name: imweb_name, existing: candidates.map((c:any) => c.name) })
        }
      }
    }
  }

  // ===== Phase C: 이메일 기반 매칭 (imweb_member_id 후보가 없을 때만!) =====
  // ★ 이메일이 같더라도 imweb_member_id가 다르면 = 다른 계정 → 매칭하지 않음
  if (!member && imweb_email && imweb_email.includes('@')) {
    const byEmail = await c.env.DB.prepare(
      "SELECT m.*, ca.clinic_id FROM members m LEFT JOIN clinic_admins ca ON ca.member_id = m.id WHERE m.email = ? AND m.imweb_member_id = ? AND m.status = 'approved' AND m.role IN ('clinic_admin','super_admin')"
    ).bind(imweb_email, imweb_member_id).first()
    if (byEmail) {
      member = byEmail
      _logEntry.steps.push({ step: 'C-email+id', id: (byEmail as any).id })
    } else {
      // imweb_member_id가 없는 계정(아직 아임웹 연동 안 된 기존 계정)만 이메일로 매칭
      const byEmailNoId = await c.env.DB.prepare(
        "SELECT m.*, ca.clinic_id FROM members m LEFT JOIN clinic_admins ca ON ca.member_id = m.id WHERE m.email = ? AND (m.imweb_member_id IS NULL OR m.imweb_member_id = '') AND m.status = 'approved' AND m.role IN ('clinic_admin','super_admin')"
      ).bind(imweb_email).first()
      if (byEmailNoId) {
        // 아임웹 연동 안 된 기존 계정 → imweb_member_id 업데이트 후 매칭
        await c.env.DB.prepare("UPDATE members SET imweb_member_id = ?, updated_at = datetime('now') WHERE id = ?").bind(imweb_member_id, (byEmailNoId as any).id).run()
        member = await c.env.DB.prepare('SELECT * FROM members WHERE id = ?').bind((byEmailNoId as any).id).first()
        _logEntry.steps.push({ step: 'C-email-link', id: (byEmailNoId as any).id })
      } else {
        _logEntry.steps.push({ step: 'C-email-skip', reason: 'email_exists_but_different_imweb_id' })
      }
    }
  }

  // ===== Phase E: 그룹 기반 매칭 =====
  let groupClinicId: number | null = null
  if (!member && imweb_group && imweb_group.length > 0) {
    const groupOwner = await c.env.DB.prepare(
      `SELECT m.*, ca.clinic_id FROM members m 
       JOIN clinic_admins ca ON ca.member_id = m.id
       WHERE m.imweb_group = ? AND m.status = 'approved' 
       AND m.imweb_member_id != ?
       AND ca.admin_role = 'owner'
       ORDER BY m.created_at ASC LIMIT 1`
    ).bind(imweb_group, imweb_member_id).first()
    if (groupOwner) {
      groupClinicId = (groupOwner as any).clinic_id
      const existingInGroup = await c.env.DB.prepare(
        "SELECT m.* FROM members m JOIN clinic_admins ca ON ca.member_id = m.id WHERE m.imweb_member_id = ? AND ca.clinic_id = ? AND m.status = 'approved'"
      ).bind(imweb_member_id, groupClinicId).first()
      if (existingInGroup) {
        member = existingInGroup
        _logEntry.steps.push({ step: 'E-group', id: (existingInGroup as any).id })
      }
    }
  }

  // ===== Phase F: Migration (old site_/login_/hdr_ IDs) =====
  if (!member && previous_id && previous_id !== imweb_member_id && (previous_id.startsWith('site_') || previous_id.startsWith('login_') || previous_id.startsWith('hdr_'))) {
    const prevMember = await c.env.DB.prepare(
      'SELECT * FROM members WHERE imweb_member_id = ?'
    ).bind(previous_id).first()
    if (prevMember) {
      await c.env.DB.prepare(
        "UPDATE members SET imweb_member_id = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(imweb_member_id, prevMember.id).run()
      member = await c.env.DB.prepare('SELECT * FROM members WHERE id = ?').bind(prevMember.id).first()
      _logEntry.steps.push({ step: 'F-migration', id: (prevMember as any).id })
    }
  }

  if (member) {
    // Already exists - update phone/email/group if provided and changed
    const updates: string[] = []
    const vals: any[] = []
    if (imweb_phone && imweb_phone !== `imweb-${imweb_member_id}` && member.phone !== imweb_phone) { updates.push('phone = ?'); vals.push(imweb_phone) }
    if (imweb_email && member.email !== imweb_email) { updates.push('email = ?'); vals.push(imweb_email) }
    // ★ 그룹 정보 업데이트 (새로 감지된 경우)
    if (imweb_group && (member as any).imweb_group !== imweb_group) { updates.push('imweb_group = ?'); vals.push(imweb_group) }

    // ★★★ v5.10.13: 아임웹 member_code로 항상 실제 이름 검증 및 자동 교정
    // INVALID 이름 또는 imweb_name이 비어있는 경우 → 아임웹 API로 실제 이름 조회·교정
    const MATCH_INVALID_NAMES_UPDATE = ['아임웹 사용자','Alarm','alarm','마이페이지','관리','쿠폰관리','쿠폰','포인트','포인트쿠폰',
      '포인트관리','회원관리','고객관리','admin','Admin','설정','대시보드','결제','주문','장바구니',
      '알림','검색','홈','메뉴','멤버십관리','멤버십','관리자','최고관리자','모바일코디','모바일 코디',
      '대기실TV','대기실 TV','임플란트코디','임플란트 코디','치과관리','사이트관리','사이트','포인트관리시스템',
      '테스트치과','테스트1치과','테스트2치과','테스트3치과']
    const currentName = (member as any).name || ''
    const isInvalidStoredName = MATCH_INVALID_NAMES_UPDATE.includes(currentName)
    // 이름이 INVALID이거나, imweb_name이 비어있고(위젯 감지 실패) imweb_member_id가 있을 때 API 조회
    const needsNameVerification = isInvalidStoredName && imweb_member_id
    if (needsNameVerification) {
      // 아임웹 API에서 실제 이름 조회 (member_code 기반)
      try {
        const iKey = c.env.IMWEB_KEY || '6e0afc05cea3b4966b5d937be58a97bbec5a157f77'
        const iSecret = c.env.IMWEB_SECRET || '9d7e63a446bdf2eb16a754'
        const iToken = await getImwebToken(iKey, iSecret)
        if (iToken) {
          const iResp = await fetch(`https://api.imweb.me/v2/member/members/${imweb_member_id}`, {
            headers: { 'access-token': iToken }
          })
          const iData: any = await iResp.json()
          const realName = iData?.data?.name || iData?.data?.nick || ''
          if (realName && realName.trim() && !MATCH_INVALID_NAMES_UPDATE.includes(realName.trim())) {
            // 이름 교정 (현재 INVALID인 경우만)
            if (isInvalidStoredName && currentName !== realName.trim()) {
              updates.push('name = ?')
              vals.push(realName.trim())
            }
            // 클리닉명도 함께 업데이트
            const memberClinic = await c.env.DB.prepare(
              'SELECT clinic_id FROM clinic_admins WHERE member_id = ? LIMIT 1'
            ).bind(member.id).first() as any
            if (memberClinic?.clinic_id) {
              const existingClinic = await c.env.DB.prepare('SELECT name FROM clinics WHERE id = ?').bind(memberClinic.clinic_id).first() as any
              if (MATCH_INVALID_NAMES_UPDATE.includes(existingClinic?.name || '')) {
                await c.env.DB.prepare("UPDATE clinics SET name = ?, updated_at = datetime('now') WHERE id = ?")
                  .bind(realName.trim(), memberClinic.clinic_id).run()
              }
            }
            _logEntry.steps.push({ step: 'auto-name-fix-from-api', old_name: currentName, new_name: realName.trim(), member_id: member.id })
          }
        }
      } catch(e) {}
    }

    if (updates.length > 0) {
      vals.push(member.id)
      await c.env.DB.prepare(`UPDATE members SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...vals).run()
      member = await c.env.DB.prepare('SELECT * FROM members WHERE id = ?').bind(member.id).first()
    }

    // 역할에 따라 다른 테이블에서 클리닉 조회
    let clinics: any
    if (member!.role === 'patient') {
      // 환자: patient_clinic 테이블에서 조회
      clinics = await c.env.DB.prepare(`
        SELECT c.*, 'patient' as patient_role FROM clinics c 
        JOIN patient_clinic pc ON c.id = pc.clinic_id 
        WHERE pc.patient_id = ? AND c.status = 'active' AND pc.status = 'active'
      `).bind(member!.id).all()
    } else {
      // 관리자: clinic_admins 테이블에서 조회
      clinics = await c.env.DB.prepare(`
        SELECT c.*, ca.admin_role FROM clinics c 
        JOIN clinic_admins ca ON c.id = ca.clinic_id 
        WHERE ca.member_id = ? AND c.status = 'active'
      `).bind(member!.id).all()
    }

    _logEntry.result = { matched: true, member_id: member!.id, member_name: member!.name, role: member!.role, clinic_id: (clinics.results || [])[0]?.id, clinic_name: (clinics.results || [])[0]?.name }
    // ★ D1에 매칭 결과 영구 저장
    try {
      await c.env.DB.prepare(
        "INSERT INTO error_logs (message, created_at) VALUES (?, datetime('now'))"
      ).bind('[MATCH-OK] ' + JSON.stringify({ req_name: imweb_name, req_clinic: imweb_clinic_name, req_id: imweb_member_id, member_id: member!.id, member_name: member!.name, role: member!.role, clinic_id: (clinics.results || [])[0]?.id, clinic_name: (clinics.results || [])[0]?.name, steps: _logEntry.steps })).run()
    } catch(e) {}
    return c.json({
      matched: true,
      already_linked: true,
      token: createToken(member),
      member: { id: member!.id, name: member!.name, phone: member!.phone, email: member!.email, role: member!.role, imweb_member_id: (member as any).imweb_member_id || "" },
      clinics: clinics.results || []
    })
  }

  // ★ 핵심 로직: 아임웹 로그인 = 무조건 관리자 (각 치과가 자기 사이트에서 관리)
  // ★ 각 로그인 계정(닉네임)마다 독립된 클리닉 생성
  // ★ 같은 아임웹 사이트명이라도 닉네임이 다르면 = 다른 치과 = 다른 클리닉
  // ★ 클리닉명 = 닉네임 (예: 디오임플란트 → "디오임플란트" 클리닉, 테스트치과 → "테스트치과" 클리닉)

  // ★★★ v5.10.7: 이름 없이는 새 계정 생성 불가 (잘못된 이름으로 유령 계정 방지) ★★★
  // ★ 핵심 원칙: imweb_name(닉네임) = 치과명 = 클리닉명
  // ★ imweb_clinic_name은 아임웹 사이트명(예: "멤버십관리")이므로 치과명이 아님!
  // ★ 닉네임이 있으면 무조건 닉네임을 클리닉명으로 사용
  // ★ 닉네임이 없을 때만 imweb_clinic_name을 fallback으로 사용
  const INVALID_NAMES = ['아임웹 사용자', 'Alarm', '마이페이지', '관리', '쿠폰관리', '쿠폰', '포인트', '포인트쿠폰', '포인트관리', '회원관리', '고객관리', 'admin', 'Admin', '설정', '대시보드', '결제', '주문', '장바구니', '알림', '검색', '홈', '메뉴', '멤버십관리', '멤버십', '관리자']
  const hasValidName = imweb_name && !INVALID_NAMES.includes(imweb_name)
  const hasClinicName = imweb_clinic_name && imweb_clinic_name.trim().length >= 2 && !INVALID_NAMES.includes(imweb_clinic_name.trim())
  
  if (!hasValidName && !hasClinicName) {
    return c.json({ 
      matched: false, 
      need_name: true,
      error: '치과 이름을 확인할 수 없습니다. 아래 입력창에 치과 이름을 입력해 주세요.' 
    }, 200)
  }

  // ★★★ v5.10.7: 클리닉명 우선순위 변경 ★★★
  // 1) imweb_name(닉네임)이 유효하면 → 닉네임 = 치과명 = 클리닉명
  // 2) 닉네임이 없을 때만 imweb_clinic_name(사이트명)을 fallback으로 사용
  // 이유: 모든 치과가 "멤버십관리" 사이트를 통해 접속하므로
  //       imweb_clinic_name은 항상 "멤버십관리"가 됨 → 클리닉명으로 부적합
  const clinicName = hasValidName
    ? imweb_name.trim()
    : (hasClinicName ? imweb_clinic_name.trim() : 'unknown')

  const name = hasValidName ? imweb_name : clinicName
  const phone = imweb_phone || `imweb-${imweb_member_id}-${name.replace(/\s/g, '')}`

  // ★ Step 3: phone 중복 방지 - 동일 phone으로 이미 등록된 계정이 있으면 그 계정을 사용
  // (같은 ID+이름 조합이 여러 번 INSERT 시도될 때 발생하는 UNIQUE 오류 방지)
  const existingByPhone = await c.env.DB.prepare(
    "SELECT * FROM members WHERE phone = ? AND status = 'approved'"
  ).bind(phone).first()
  
  if (existingByPhone) {
    // phone이 같은 계정이 이미 있음 → 해당 계정으로 매칭
    // imweb_member_id가 다르면 업데이트
    if ((existingByPhone as any).imweb_member_id !== imweb_member_id) {
      await c.env.DB.prepare(
        "UPDATE members SET imweb_member_id = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(imweb_member_id, (existingByPhone as any).id).run()
    }
    member = await c.env.DB.prepare('SELECT * FROM members WHERE id = ?').bind((existingByPhone as any).id).first()
    const existClinics = await c.env.DB.prepare(
      `SELECT c.*, ca.admin_role FROM clinics c 
       JOIN clinic_admins ca ON c.id = ca.clinic_id 
       WHERE ca.member_id = ? AND c.status = 'active'`
    ).bind((existingByPhone as any).id).all()
    return c.json({
      matched: true,
      already_linked: true,
      token: createToken(member),
      member: { id: (member as any).id, name: (member as any).name, phone: (member as any).phone, email: (member as any).email, role: (member as any).role },
      clinics: existClinics.results || []
    })
  }

  const memberResult = await c.env.DB.prepare(
    'INSERT INTO members (imweb_member_id, imweb_group, name, phone, email, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(imweb_member_id, imweb_group || null, name, phone, imweb_email || null, 'clinic_admin', 'approved').run()
  const memberId = memberResult.meta.last_row_id

  // ★ 그룹 클리닉 합류: imweb_group이 있고 같은 그룹의 오너 클리닉이 있으면 그 클리닉에 합류
  let clinicId: number
  let isGroupJoin = false
  
  if (groupClinicId) {
    // 같은 그룹의 클리닉에 staff로 합류
    clinicId = groupClinicId
    isGroupJoin = true
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO clinic_admins (clinic_id, member_id, admin_role) VALUES (?, ?, ?)'
    ).bind(clinicId, memberId, 'staff').run()
  } else {
    // ★ 그룹 없으면 기존처럼 새 클리닉 생성 (각 계정 = 각 치과 = 각 클리닉)
    const clinicResult = await c.env.DB.prepare(
      'INSERT INTO clinics (name, phone, address) VALUES (?, ?, ?)'
    ).bind(clinicName, imweb_clinic_phone || null, imweb_clinic_addr || null).run()
    clinicId = clinicResult.meta.last_row_id

    // 새 클리닉 기본 설정
    await c.env.DB.prepare(
      'INSERT INTO clinic_settings (clinic_id) VALUES (?)'
    ).bind(clinicId).run()

    // 오너로 클리닉에 연결
    await c.env.DB.prepare(
      'INSERT INTO clinic_admins (clinic_id, member_id, admin_role) VALUES (?, ?, ?)'
    ).bind(clinicId, memberId, 'owner').run()
  }

  member = await c.env.DB.prepare('SELECT * FROM members WHERE id = ?').bind(memberId).first()
  const newClinics = await c.env.DB.prepare(
    `SELECT c.*, ca.admin_role FROM clinics c 
     JOIN clinic_admins ca ON c.id = ca.clinic_id 
     WHERE ca.member_id = ? AND c.status = 'active'`
  ).bind(memberId).all()

  // ★ D1에 신규 계정 생성 로그 영구 저장
  try {
    await c.env.DB.prepare(
      "INSERT INTO error_logs (message, created_at) VALUES (?, datetime('now'))"
    ).bind('[MATCH-NEW] ' + JSON.stringify({ req_name: imweb_name, req_clinic: imweb_clinic_name, req_id: imweb_member_id, member_id: member!.id, member_name: member!.name, clinic_id: (newClinics.results || [])[0]?.id, clinic_name: (newClinics.results || [])[0]?.name, clinicName_used: clinicName, group_join: isGroupJoin, steps: _logEntry.steps })).run()
  } catch(e) {}

  return c.json({
    matched: true,
    already_linked: false,
    group_joined: isGroupJoin,
    token: createToken(member),
    member: { id: member!.id, name: member!.name, phone: member!.phone, email: member!.email, role: member!.role, imweb_member_id: (member as any).imweb_member_id || "" },
    clinics: newClinics.results || []
  })
 } catch (e: any) {
   return c.json({ error: 'imweb-match error: ' + e.message }, 500)
 }
})

// Admin: merge duplicate accounts (cleanup tool)
app.post('/api/admin/merge-accounts', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const { keep_member_id, remove_member_id, keep_clinic_id, remove_clinic_id } = body
    if (!keep_member_id || !remove_member_id) return c.json({ error: 'keep_member_id와 remove_member_id 필요' }, 400)

    const results: string[] = []

    // Move all clinic_admins from remove to keep member
    if (keep_clinic_id && remove_clinic_id) {
      const tables = ['patient_clinic', 'payments', 'point_logs', 'coupons', 'coupon_templates', 'bulk_uploads', 'sync_logs']
      for (const t of tables) {
        try {
          const r = await c.env.DB.prepare(`UPDATE ${t} SET clinic_id = ? WHERE clinic_id = ?`).bind(keep_clinic_id, remove_clinic_id).run()
          results.push(`${t}: ${r.meta.changes} rows moved`)
        } catch (e: any) { results.push(`${t}: skip (${e.message})`) }
      }
      // Deactivate old clinic
      await c.env.DB.prepare("UPDATE clinics SET status = 'inactive', updated_at = datetime('now') WHERE id = ?").bind(remove_clinic_id).run()
      results.push('clinic deactivated')
      // Clean up old clinic_admins
      try { await c.env.DB.prepare("DELETE FROM clinic_admins WHERE clinic_id = ? AND member_id = ?").bind(remove_clinic_id, remove_member_id).run(); results.push('clinic_admins cleaned') } catch(e: any) { results.push(`clinic_admins: ${e.message}`) }
      // Clean up old clinic_settings
      try { await c.env.DB.prepare("DELETE FROM clinic_settings WHERE clinic_id = ?").bind(remove_clinic_id).run(); results.push('clinic_settings cleaned') } catch(e: any) { results.push(`clinic_settings: ${e.message}`) }
    }

    // Deactivate old member
    await c.env.DB.prepare("UPDATE members SET status = 'suspended', updated_at = datetime('now') WHERE id = ?").bind(remove_member_id).run()
    results.push('member deactivated')

    return c.json({ success: true, message: `Member ${remove_member_id} merged into ${keep_member_id}`, details: results })
  } catch (e: any) {
    return c.json({ error: e.message, stack: e.stack }, 500)
  }
})

// Admin: list all members and clinics (debug/cleanup)
app.get('/api/admin/list-members', async (c) => {
  try {
    const members = await c.env.DB.prepare(
      "SELECT m.*, GROUP_CONCAT(DISTINCT ca.clinic_id || ':' || ca.admin_role) as admin_clinics, GROUP_CONCAT(DISTINCT pc.clinic_id) as patient_clinics FROM members m LEFT JOIN clinic_admins ca ON m.id = ca.member_id LEFT JOIN patient_clinic pc ON m.id = pc.patient_id GROUP BY m.id ORDER BY m.id"
    ).all()
    const clinics = await c.env.DB.prepare(
      "SELECT c.*, (SELECT COUNT(*) FROM clinic_admins ca2 WHERE ca2.clinic_id = c.id) as admin_count, (SELECT COUNT(*) FROM patient_clinic pc2 WHERE pc2.clinic_id = c.id AND pc2.status = 'active') as patient_count FROM clinics c ORDER BY c.id"
    ).all()
    return c.json({ members: members.results, clinics: clinics.results })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Admin: convert clinic_admin to patient for a specific member
app.post('/api/admin/convert-to-patient', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const { member_id, clinic_id } = body
    if (!member_id || !clinic_id) return c.json({ error: 'member_id와 clinic_id 필요' }, 400)

    // Update member role to patient
    await c.env.DB.prepare(
      "UPDATE members SET role = 'patient', updated_at = datetime('now') WHERE id = ?"
    ).bind(member_id).run()

    // Remove from clinic_admins
    await c.env.DB.prepare(
      "DELETE FROM clinic_admins WHERE member_id = ? AND clinic_id = ?"
    ).bind(member_id, clinic_id).run()

    // Add to patient_clinic (if not already)
    const existing = await c.env.DB.prepare(
      "SELECT id FROM patient_clinic WHERE patient_id = ? AND clinic_id = ?"
    ).bind(member_id, clinic_id).first()
    if (!existing) {
      await c.env.DB.prepare(
        "INSERT INTO patient_clinic (patient_id, clinic_id) VALUES (?, ?)"
      ).bind(member_id, clinic_id).run()
    }

    return c.json({ success: true, message: `Member ${member_id} converted to patient for clinic ${clinic_id}` })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Admin: delete a member completely (cleanup test data)
app.post('/api/admin/delete-member', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const { member_id, delete_clinic } = body
    if (!member_id) return c.json({ error: 'member_id 필요' }, 400)

    // Get member's clinics
    const adminClinics = await c.env.DB.prepare(
      "SELECT clinic_id FROM clinic_admins WHERE member_id = ?"
    ).bind(member_id).all()

    // Remove from clinic_admins
    await c.env.DB.prepare("DELETE FROM clinic_admins WHERE member_id = ?").bind(member_id).run()
    // Remove from patient_clinic
    await c.env.DB.prepare("DELETE FROM patient_clinic WHERE patient_id = ?").bind(member_id).run()
    // Delete member
    await c.env.DB.prepare("DELETE FROM members WHERE id = ?").bind(member_id).run()

    // Optionally delete orphaned clinics
    if (delete_clinic && adminClinics.results) {
      for (const ac of adminClinics.results as any[]) {
        const otherAdmins = await c.env.DB.prepare(
          "SELECT COUNT(*) as cnt FROM clinic_admins WHERE clinic_id = ?"
        ).bind(ac.clinic_id).first()
        if (!otherAdmins || (otherAdmins.cnt as number) === 0) {
          await c.env.DB.prepare("DELETE FROM clinic_settings WHERE clinic_id = ?").bind(ac.clinic_id).run()
          await c.env.DB.prepare("DELETE FROM clinics WHERE id = ?").bind(ac.clinic_id).run()
        }
      }
    }

    return c.json({ success: true, message: `Member ${member_id} deleted` })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Auth me - get/update current user
app.get('/api/auth/me', async (c) => {
  const member = c.get('member')
  return c.json({ member: { id: member.id, name: member.name, phone: member.phone, email: member.email, role: member.role, imweb_member_id: (member as any).imweb_member_id || "" } })
})

app.put('/api/auth/me', async (c) => {
  const member = c.get('member')
  const body = await c.req.json().catch(() => ({}))
  const updates: string[] = []
  const values: any[] = []
  if (body.name) { updates.push('name = ?'); values.push(body.name) }
  if (body.email !== undefined) { updates.push('email = ?'); values.push(body.email) }
  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')")
    values.push(member.id)
    await c.env.DB.prepare(`UPDATE members SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
  }
  return c.json({ success: true })
})


app.get('/api/patients', async (c) => {
  const member = c.get('member') || { role: 'super_admin' }; // Allow bypass for scanner UI
  const q = c.req.query('q') || ''
  if (!q) return c.json({ data: [] })
  
  // Find patients that belong to clinics where the logged-in user is an admin or super_admin
  let sql;
  let params;
  
  if (member.role === 'super_admin') {
    sql = `
      SELECT m.id, m.name, m.phone 
      FROM members m
      WHERE m.role = 'patient' AND (m.name LIKE ? OR m.phone LIKE ? OR m.phone LIKE ?)
      LIMIT 20
    `;
    params = [`%${q}%`, `%${q}%`, `%${q.replace(/-/g, '')}%`];
  } else {
    sql = `
      SELECT m.id, m.name, m.phone 
      FROM members m
      JOIN patient_clinic pc ON m.id = pc.patient_id
      JOIN clinic_admins ca ON pc.clinic_id = ca.clinic_id
      WHERE ca.member_id = ? AND m.role = 'patient' AND (m.name LIKE ? OR m.phone LIKE ? OR m.phone LIKE ?)
      GROUP BY m.id
      LIMIT 20
    `;
    params = [member.id, `%${q}%`, `%${q}%`, `%${q.replace(/-/g, '')}%`];
  }
  
  const patients = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ data: patients.results || [] })
})

// ==================== CLINICS ====================
app.get('/api/clinics', async (c) => {
  const clinics = await c.env.DB.prepare("SELECT * FROM clinics WHERE status = 'active'").all()
  return c.json({ clinics: clinics.results })
})

app.get('/api/clinics/:id', async (c) => {
  const id = c.req.param('id')
  const clinic = await c.env.DB.prepare('SELECT * FROM clinics WHERE id = ?').bind(id).first()
  if (!clinic) return c.json({ error: '치과를 찾을 수 없습니다.' }, 404)
  
  const settings = await c.env.DB.prepare('SELECT * FROM clinic_settings WHERE clinic_id = ?').bind(id).first()
  let parsedSettings: any = settings || {}
  if (parsedSettings.category_rates) {
    try { parsedSettings.category_rates = JSON.parse(parsedSettings.category_rates as string) } catch { parsedSettings.category_rates = [] }
  }
  if (parsedSettings.coupon_auto_rules) {
    try { parsedSettings.coupon_auto_rules = JSON.parse(parsedSettings.coupon_auto_rules as string) } catch { parsedSettings.coupon_auto_rules = [] }
  }
  // 위젯 호환: clinic 객체에 point_rate 병합 (settings.default_point_rate 우선)
  const mergedClinic: any = { ...clinic }
  mergedClinic.point_rate = parsedSettings.default_point_rate ?? 5
  return c.json({ ...mergedClinic, clinic: mergedClinic, settings: parsedSettings })
})

app.put('/api/clinics/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const updates: string[] = []
  const values: any[] = []
  if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name) }
  if (body.phone !== undefined) { updates.push('phone = ?'); values.push(body.phone) }
  if (body.address !== undefined) { updates.push('address = ?'); values.push(body.address) }
  if (body.business_number !== undefined) { updates.push('business_number = ?'); values.push(body.business_number) }
  if (body.logo_url !== undefined) { updates.push('logo_url = ?'); values.push(body.logo_url) }
  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')")
    values.push(id)
    await c.env.DB.prepare(`UPDATE clinics SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
  }
  return c.json({ success: true })
})

// ==================== CLINIC SETTINGS ====================
app.put('/api/clinics/:id/settings', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const existing = await c.env.DB.prepare('SELECT * FROM clinic_settings WHERE clinic_id = ?').bind(id).first()
  if (!existing) {
    await c.env.DB.prepare(
      "INSERT INTO clinic_settings (clinic_id, default_point_rate, category_rates, coupon_auto_rules, point_expiry_days) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, body.default_point_rate || 5, JSON.stringify(body.category_rates || []), JSON.stringify(body.coupon_auto_rules || []), body.point_expiry_days || 365).run()
  } else {
    const updates: string[] = []
    const values: any[] = []
    if (body.default_point_rate !== undefined) { updates.push('default_point_rate = ?'); values.push(body.default_point_rate) }
    if (body.category_rates !== undefined) { updates.push('category_rates = ?'); values.push(JSON.stringify(body.category_rates)) }
    if (body.coupon_auto_rules !== undefined) { updates.push('coupon_auto_rules = ?'); values.push(JSON.stringify(body.coupon_auto_rules)) }
    if (body.point_expiry_days !== undefined) { updates.push('point_expiry_days = ?'); values.push(body.point_expiry_days) }
    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')")
      values.push(id)
      await c.env.DB.prepare(`UPDATE clinic_settings SET ${updates.join(', ')} WHERE clinic_id = ?`).bind(...values).run()
    }
  }
  return c.json({ success: true })
})

// ==================== PATIENTS (under clinic) ====================
app.get('/api/clinics/:id/patients', async (c) => {
  const clinicId = c.req.param('id')
  const search = c.req.query('search') || ''
  const birthdayFilter = c.req.query('birthday') === 'today'
  const page = Math.max(1, parseInt(c.req.query('page') || '1'))
  const limit = 20
  const offset = (page - 1) * limit
  const pointFilter = c.req.query('point_filter')

  const baseWhere = `
    FROM members m
    JOIN patient_clinic pc ON m.id = pc.patient_id AND pc.clinic_id = ?
    WHERE m.role = 'patient' AND pc.status = 'active'
  `
  const selectFields = `
    SELECT m.id, m.name, m.phone, m.email, m.chart_number, m.birth_date, m.dentweb_id,
           m.last_treatment, m.last_visit_date, m.gender,
           pc.total_points, pc.used_points, (pc.total_points - pc.used_points) as available_points,
           pc.status as clinic_status,
           (SELECT p2.amount FROM payments p2 WHERE p2.patient_id = m.id AND p2.clinic_id = ? ORDER BY p2.created_at DESC LIMIT 1) as last_payment_amount,
           (SELECT p2.payment_date FROM payments p2 WHERE p2.patient_id = m.id AND p2.clinic_id = ? ORDER BY p2.created_at DESC LIMIT 1) as last_payment_date,
           m.created_at as joined_at,
           (SELECT GROUP_CONCAT(ct.name || '::' || cp.status || '::' || ct.is_birthday || '::' || date(datetime(cp.created_at, '+9 hours')) || '::' || cp.id || '::' || cp.code || '::' || COALESCE(cp.shared_at, '') || '::' || COALESCE(p.delivery_type, ''), '||') FROM coupons cp JOIN coupon_templates ct ON cp.template_id = ct.id LEFT JOIN products p ON ct.product_id = p.id WHERE cp.patient_id = m.id AND cp.clinic_id = ?) as all_coupons
  `

  let sql = selectFields + baseWhere
  let countSql = 'SELECT COUNT(*) as cnt ' + baseWhere
  const params: any[] = [clinicId, clinicId, clinicId, clinicId]
  const countParams: any[] = [clinicId]

  if (birthdayFilter) {
    // 오늘 생일 환자 (MM-DD 기준)
    const todayMD = getKSTDate().slice(5)
    const cond = ' AND m.birth_date IS NOT NULL AND SUBSTR(m.birth_date, 6, 5) = ?'
    sql += cond
    countSql += cond
    params.push(todayMD)
    countParams.push(todayMD)
  } else if (search) {
    const cond = ' AND (m.name LIKE ? OR m.phone LIKE ? OR m.chart_number LIKE ?)'
    sql += cond
    countSql += cond
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    countParams.push(`%${search}%`, `%${search}%`, `%${search}%`)
  } else if (pointFilter) {
    let minPts = 1;
    let exactCondition = false;
    
    if (pointFilter !== '1') {
      const parsed = parseInt(pointFilter, 10);
      if (!isNaN(parsed)) {
        minPts = parsed;
        exactCondition = true;
      }
    }
    
    if (exactCondition) {
      const cond = ` AND (pc.total_points - pc.used_points) = ${minPts}`;
      sql += cond;
      countSql += cond;
    } else {
      const cond = ` AND (pc.total_points - pc.used_points) >= ${minPts}`;
      sql += cond;
      countSql += cond;
    }
  }

  // 정렬: 포인트 높은 순 → 최근 등록 순
  sql += ' ORDER BY pc.updated_at DESC, available_points DESC'
  sql += ' LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const [result, countResult] = await Promise.all([
    c.env.DB.prepare(sql).bind(...params).all(),
    c.env.DB.prepare(countSql).bind(...countParams).first()
  ])

  const total = (countResult as any)?.cnt || 0
  // Fetch dynamic point filters based on coupon templates (cached)
  let templates = getCached(`templates_all_${clinicId}`);
  if (!templates) {
    templates = await c.env.DB.prepare('SELECT name, auto_issue_points, required_points FROM coupon_templates WHERE clinic_id = ? AND status = ?').bind(clinicId, 'active').all();
    setCache(`templates_all_${clinicId}`, templates, 15000);
  }
  const filterMap = new Map();
  (templates.results || []).forEach((t: any) => {
    if (t.auto_issue_points > 0) {
      const current = filterMap.get(t.auto_issue_points) || '';
      if (!current.includes(t.name)) {
        filterMap.set(t.auto_issue_points, (current ? current + ', ' : '') + t.name);
      }
    }
    if (t.required_points > 0) {
      const current = filterMap.get(t.required_points) || '';
      if (!current.includes(t.name)) {
        filterMap.set(t.required_points, (current ? current + ', ' : '') + t.name);
      }
    }
  });
  
  const point_filters = Array.from(filterMap.entries()).map(([points, label]) => ({
    points,
    label: `${points.toLocaleString()}P (${label})`
  })).sort((a, b) => a.points - b.points);

  return c.json({
    patients: result.results || [],
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
    has_point_filter: !!pointFilter,
    point_filters
  })
})

app.get('/api/clinics/:id/patients/:pid', async (c) => {
  const clinicId = c.req.param('id')
  const pid = c.req.param('pid')
  
  const patient = await c.env.DB.prepare(`
    SELECT m.*, pc.total_points, pc.used_points, (pc.total_points - pc.used_points) as available_points
    FROM members m
    JOIN patient_clinic pc ON m.id = pc.patient_id AND pc.clinic_id = ?
    WHERE m.id = ?
  `).bind(clinicId, pid).first()
  if (!patient) return c.json({ error: '환자를 찾을 수 없습니다.' }, 404)

  const payments = await c.env.DB.prepare(`
    SELECT * FROM payments WHERE clinic_id = ? AND patient_id = ? ORDER BY created_at DESC LIMIT 20
  `).bind(clinicId, pid).all()

  const coupons = await c.env.DB.prepare(`
    SELECT c.*, ct.name as template_name, ct.discount_type, ct.discount_value, ct.image_url, ct.is_birthday
    FROM coupons c JOIN coupon_templates ct ON c.template_id = ct.id
    WHERE c.clinic_id = ? AND c.patient_id = ? AND c.status = 'active'
    ORDER BY c.created_at DESC
  `).bind(clinicId, pid).all()

  return c.json({ patient, payments: payments.results || [], coupons: coupons.results || [] })
})

app.post('/api/clinics/:id/patients', async (c) => {
  const clinicId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const { name, phone, email, chart_number, birth_date, dentweb_id, gender } = body
  if (!name || !phone) return c.json({ error: '이름과 전화번호는 필수입니다.' }, 400)

  // Check if patient exists with same phone
  let member = await c.env.DB.prepare('SELECT * FROM members WHERE phone = ? AND role = ?').bind(phone, 'patient').first()
  
  if (!member) {
    const r = await c.env.DB.prepare(
      'INSERT INTO members (name, phone, email, chart_number, birth_date, dentweb_id, gender, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(name, phone, email || null, chart_number || null, birth_date || null, dentweb_id || null, gender || null, 'patient', 'approved').run()
    member = await c.env.DB.prepare('SELECT * FROM members WHERE id = ?').bind(r.meta.last_row_id).first()
  } else {
    // Update existing member info if new data provided
    const ups: string[] = []
    const vals: any[] = []
    if (chart_number && !member.chart_number) { ups.push('chart_number = ?'); vals.push(chart_number) }
    if (birth_date && !member.birth_date) { ups.push('birth_date = ?'); vals.push(birth_date) }
    if (dentweb_id) { ups.push('dentweb_id = ?'); vals.push(dentweb_id) }
    if (name && name !== member.name) { ups.push('name = ?'); vals.push(name) }
    if (ups.length > 0) {
      ups.push("updated_at = datetime('now')")
      vals.push(member.id)
      await c.env.DB.prepare(`UPDATE members SET ${ups.join(', ')} WHERE id = ?`).bind(...vals).run()
    }
  }

  // Link to clinic
  const existing = await c.env.DB.prepare(
    'SELECT * FROM patient_clinic WHERE patient_id = ? AND clinic_id = ?'
  ).bind(member!.id, clinicId).first()
  if (!existing) {
    await c.env.DB.prepare(
      'INSERT INTO patient_clinic (patient_id, clinic_id) VALUES (?, ?)'
    ).bind(member!.id, clinicId).run()
  } else if (existing.status === 'inactive') {
    await c.env.DB.prepare(
      "UPDATE patient_clinic SET status = 'active', updated_at = datetime('now') WHERE id = ?"
    ).bind(existing.id).run()
  }

  return c.json({ success: true, patient_id: member!.id })
})

app.put('/api/clinics/:id/patients/:pid', async (c) => {
  const pid = c.req.param('pid')
  const body = await c.req.json().catch(() => ({}))
  const updates: string[] = []
  const values: any[] = []
  if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name) }
  if (body.phone !== undefined) { updates.push('phone = ?'); values.push(body.phone) }
  if (body.email !== undefined) { updates.push('email = ?'); values.push(body.email) }
  if (body.chart_number !== undefined) { updates.push('chart_number = ?'); values.push(body.chart_number) }
  if (body.birth_date !== undefined) { updates.push('birth_date = ?'); values.push(body.birth_date) }
  if (body.dentweb_id !== undefined) { updates.push('dentweb_id = ?'); values.push(body.dentweb_id) }
  if (body.last_treatment !== undefined) { updates.push('last_treatment = ?'); values.push(body.last_treatment) }
  if (body.gender !== undefined) { updates.push('gender = ?'); values.push(body.gender) }
  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')")
    values.push(pid)
    await c.env.DB.prepare(`UPDATE members SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
  }
  return c.json({ success: true })
})

app.delete('/api/clinics/:id/patients/:pid', async (c) => {
  const clinicId = c.req.param('id')
  const pid = c.req.param('pid')
  await c.env.DB.prepare(
    "UPDATE patient_clinic SET status = 'inactive', updated_at = datetime('now') WHERE patient_id = ? AND clinic_id = ?"
  ).bind(pid, clinicId).run()
  return c.json({ success: true })
})

// 환자 전체 삭제 (테스트용)
app.delete('/api/clinics/:id/patients_all', async (c) => {
  const clinicId = c.req.param('id')
  
  // 1. 환자와 치과의 연결을 모두 삭제 (완전 삭제)
  await c.env.DB.prepare(
    "DELETE FROM patient_clinic WHERE clinic_id = ?"
  ).bind(clinicId).run()
  
  // 2. 해당 치과의 결제 내역과 포인트 로그도 모두 삭제할지 여부
  // 깔끔한 초기화를 위해 관련된 내역(payments, point_logs)도 삭제 처리
  await c.env.DB.prepare("DELETE FROM payments WHERE clinic_id = ?").bind(clinicId).run()
  await c.env.DB.prepare("DELETE FROM point_logs WHERE clinic_id = ?").bind(clinicId).run()
  
  // 3. 발급된 쿠폰 내역 삭제
  await c.env.DB.prepare("DELETE FROM coupons WHERE clinic_id = ?").bind(clinicId).run()
  
  return c.json({ success: true, message: '모든 환자 및 결제/포인트 내역이 초기화되었습니다.' })
})

// ==================== PAYMENTS ====================
app.post('/api/payments', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { clinic_id, patient_id, amount, category, description, point_rate_override, payment_date, payment_method, dentweb_receipt_id, input_type } = body
  if (!clinic_id || !patient_id || !amount) return c.json({ error: '필수 입력값이 누락되었습니다.' }, 400)

  // Get point rate
  let pointRate = point_rate_override
  if (pointRate === undefined || pointRate === null) {
    const settings = await c.env.DB.prepare('SELECT * FROM clinic_settings WHERE clinic_id = ?').bind(clinic_id).first()
    if (settings) {
      let catRates: any[] = []
      try { catRates = JSON.parse(settings.category_rates as string || '[]') } catch {}
      const catRate = catRates.find((r: any) => r.category === (category || '일반진료'))
      pointRate = catRate ? catRate.rate : (settings.default_point_rate || 5)
    } else {
      pointRate = 5
    }
  }

  const pointEarned = Math.floor(amount * (pointRate / 100))
  const payDate = payment_date || getKSTDate()

  const result = await c.env.DB.prepare(`
    INSERT INTO payments (clinic_id, patient_id, amount, category, description, point_rate, point_earned, payment_date, input_type, payment_method, dentweb_receipt_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(clinic_id, patient_id, amount, category || '일반진료', description || null, pointRate, pointEarned, payDate, input_type || 'manual', payment_method || null, dentweb_receipt_id || null).run()

  // Update last_treatment on member if category provided
  if (category) {
    await c.env.DB.prepare("UPDATE members SET last_treatment = ?, updated_at = datetime('now') WHERE id = ?").bind(category, patient_id).run()
  }

  // Update points
  if (pointEarned > 0) {
    const pc = await c.env.DB.prepare(
      'SELECT * FROM patient_clinic WHERE patient_id = ? AND clinic_id = ?'
    ).bind(patient_id, clinic_id).first()
    if (pc) {
      await c.env.DB.prepare("UPDATE patient_clinic SET total_points = total_points + ?, updated_at = datetime('now') WHERE id = ?").bind(pointEarned, pc.id).run()
      const updatedPc = await c.env.DB.prepare('SELECT total_points, used_points FROM patient_clinic WHERE id = ?').bind(pc.id).first()
      const newAvail = (updatedPc.total_points as number) - ((updatedPc.used_points as number) || 0)
      // Log
      await c.env.DB.prepare(
        'INSERT INTO point_logs (clinic_id, patient_id, payment_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(clinic_id, patient_id, result.meta.last_row_id, 'earn', pointEarned, newAvail, `${category || '일반진료'} 적립`).run()
    }
  }

  // Auto-issue coupons based on accumulated points
  let autoIssuedCoupons: any[] = []
  if (pointEarned > 0) {
    const member = c.get('member')
    autoIssuedCoupons = await checkAndAutoIssueCoupons(c.env.DB, clinic_id, patient_id, member?.id || null)
  }

  return c.json({ success: true, payment_id: result.meta.last_row_id, point_earned: pointEarned, point_rate: pointRate, auto_issued_coupons: autoIssuedCoupons })
})

// ==================== POINT ADJUSTMENT ====================
app.post('/api/points/adjust', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { clinic_id, patient_id, new_balance, description } = body
  if (!clinic_id || !patient_id || new_balance === undefined) return c.json({ error: '필수값 누락' }, 400)

  const pc = await c.env.DB.prepare(
    'SELECT * FROM patient_clinic WHERE patient_id = ? AND clinic_id = ?'
  ).bind(patient_id, clinic_id).first()
  if (!pc) return c.json({ error: '환자-클리닉 관계 없음' }, 404)

  const currentAvail = (pc.total_points as number) - ((pc.used_points as number) || 0)
  const diff = new_balance - currentAvail
  await c.env.DB.prepare(
    "UPDATE patient_clinic SET total_points = total_points + ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(diff, pc.id).run()

  await c.env.DB.prepare(
    'INSERT INTO point_logs (clinic_id, patient_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(clinic_id, patient_id, 'adjust', diff, new_balance, description || '관리자 조정').run()

  return c.json({ success: true, new_balance, diff })
})

app.get('/api/payments', async (c) => {
  const clinicId = c.req.query('clinic_id')
  if (!clinicId) return c.json({ error: 'clinic_id 필요' }, 400)
  const patientId = c.req.query('patient_id')
  const limit = parseInt(c.req.query('limit') || '100')
  
  let sql: string, params: any[]
  if (patientId) {
    // 특정 환자의 결제만 조회 (환자 본인 또는 관리자가 조회)
    sql = `SELECT p.*, m.name as patient_name FROM payments p 
           JOIN members m ON p.patient_id = m.id 
           WHERE p.clinic_id = ? AND p.patient_id = ? ORDER BY p.created_at DESC LIMIT ?`
    params = [clinicId, patientId, limit]
  } else {
    // 전체 결제 조회 (관리자용)
    sql = `SELECT p.*, m.name as patient_name FROM payments p 
           JOIN members m ON p.patient_id = m.id 
           WHERE p.clinic_id = ? ORDER BY p.created_at DESC LIMIT ?`
    params = [clinicId, limit]
  }
  const payments = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ payments: payments.results || [] })
})

// ==================== BULK UPLOAD ====================
app.post('/api/payments/bulk', async (c) => {
  const member = c.get('member')
  const body = await c.req.json().catch(() => ({}))
  const { clinic_id, rows } = body
  if (!clinic_id || !rows || !Array.isArray(rows)) return c.json({ error: '유효한 데이터가 필요합니다.' }, 400)

  let successCount = 0, errorCount = 0
  const errors: any[] = []

  // Get settings for point rate
  const settings = await c.env.DB.prepare('SELECT * FROM clinic_settings WHERE clinic_id = ?').bind(clinic_id).first()
  let catRates: any[] = []
  let defaultRate = 5
  if (settings) {
    try { catRates = JSON.parse(settings.category_rates as string || '[]') } catch {}
    defaultRate = settings.default_point_rate as number || 5
  }
  
  // Pre-fetch active templates for auto-issuance
  const templates = await c.env.DB.prepare(
    "SELECT * FROM coupon_templates WHERE clinic_id = ? AND status = 'active' AND auto_issue_points IS NOT NULL AND auto_issue_points > 0 AND (is_birthday = 0 OR is_birthday IS NULL)"
  ).bind(clinic_id).all();
  const activeTemplates = templates.results || [];






  // Final Batched Logic (ZERO subrequest limit issues)
  try {
    const phones = rows.map((r: any) => r.phone).filter(Boolean);
    const names = rows.map((r: any) => r.name).filter(Boolean);
    
    let existingPatients: any[] = [];
    if (phones.length > 0 || names.length > 0) {
      if (phones.length > 0) {
        const phoneChunks = [];
        for (let i = 0; i < phones.length; i += 100) phoneChunks.push(phones.slice(i, i + 100));
        for (const chunk of phoneChunks) {
          const pRes = await c.env.DB.prepare(`SELECT * FROM members WHERE role = 'patient' AND phone IN (${chunk.map(()=>'?').join(',')})`).bind(...chunk).all();
          existingPatients.push(...(pRes.results || []));
        }
      }
      if (names.length > 0) {
        const nameChunks = [];
        for (let i = 0; i < names.length; i += 100) nameChunks.push(names.slice(i, i + 100));
        for (const chunk of nameChunks) {
          const pRes = await c.env.DB.prepare(`SELECT * FROM members WHERE role = 'patient' AND name IN (${chunk.map(()=>'?').join(',')})`).bind(...chunk).all();
          existingPatients.push(...(pRes.results || []));
        }
      }
    }

    const patientMap = new Map();
    for (const p of existingPatients) {
      if (p.phone) patientMap.set(p.phone, p);
      patientMap.set(p.name, p);
    }

    const pcRes = await c.env.DB.prepare('SELECT * FROM patient_clinic WHERE clinic_id = ?').bind(clinic_id).all();
    const pcMap = new Map();
    for (const pc of (pcRes.results || [])) {
      pcMap.set(pc.patient_id, pc);
    }

    // Step 1: Accumulate new patients
    const newPatientsToInsert = [];
    for (const row of rows) {
      if (!row.name) continue;
      let patient = row.phone ? patientMap.get(row.phone) : patientMap.get(row.name);
      if (!patient && !newPatientsToInsert.find(p => p.name === row.name && p.phone === row.phone)) {
        newPatientsToInsert.push(row);
      }
    }

    if (newPatientsToInsert.length > 0) {
      const insertStmts = newPatientsToInsert.map(row => 
        c.env.DB.prepare('INSERT INTO members (name, phone, chart_number, birth_date, role, status) VALUES (?, ?, ?, ?, ?, ?) RETURNING *')
        .bind(row.name, row.phone || `nophone-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`, row.chart_number || null, row.birth_date || null, 'patient', 'approved')
      );
      for (let i = 0; i < insertStmts.length; i += 50) {
        const batchRes = await c.env.DB.batch(insertStmts.slice(i, i + 50));
        for (const res of batchRes) {
          if (res.results && res.results.length > 0) {
            const p = res.results[0];
            if (p.phone) patientMap.set(p.phone, p);
            patientMap.set(p.name, p);
          }
        }
      }
    }

    // Step 2: Accumulate Patient Updates & PC inserts/updates
    const updateStmts = [];
    const newPcToInsert = new Set();
    
    for (const row of rows) {
      if (!row.name) continue;
      let patient = row.phone ? patientMap.get(row.phone) : patientMap.get(row.name);
      if (!patient) continue;

      if (row.chart_number && !patient.chart_number) {
        updateStmts.push(c.env.DB.prepare("UPDATE members SET chart_number = ?, updated_at = datetime('now') WHERE id = ?").bind(row.chart_number, patient.id));
        patient.chart_number = row.chart_number;
      }
      if (row.birth_date && !patient.birth_date) {
        updateStmts.push(c.env.DB.prepare("UPDATE members SET birth_date = ?, updated_at = datetime('now') WHERE id = ?").bind(row.birth_date, patient.id));
        patient.birth_date = row.birth_date;
      }
      
      // Always update last_treatment if provided, even if it's "일반진료"
      if (row.treatment !== undefined && row.treatment !== null && row.treatment !== '') {
        updateStmts.push(c.env.DB.prepare("UPDATE members SET last_treatment = ?, updated_at = datetime('now') WHERE id = ?").bind(row.treatment, patient.id));
        patient.last_treatment = row.treatment;
      }

      let pc = pcMap.get(patient.id);
      if (!pc && !newPcToInsert.has(patient.id)) {
        newPcToInsert.add(patient.id);
      } else if (pc && pc.status === 'inactive') {
        updateStmts.push(c.env.DB.prepare("UPDATE patient_clinic SET status = 'active', updated_at = datetime('now') WHERE id = ?").bind(pc.id));
        pc.status = 'active';
      }
    }

    // Execute member updates and inactive PC updates
    for (let i = 0; i < updateStmts.length; i += 50) {
      await c.env.DB.batch(updateStmts.slice(i, i + 50));
    }

    // Insert new PCs
    if (newPcToInsert.size > 0) {
      const pcInsertStmts = Array.from(newPcToInsert).map(pid => 
        c.env.DB.prepare('INSERT INTO patient_clinic (patient_id, clinic_id) VALUES (?, ?) RETURNING *').bind(pid, clinic_id)
      );
      for (let i = 0; i < pcInsertStmts.length; i += 50) {
        const batchRes = await c.env.DB.batch(pcInsertStmts.slice(i, i + 50));
        for (const res of batchRes) {
          if (res.results && res.results.length > 0) {
            const pcr = res.results[0];
            pcMap.set(pcr.patient_id, pcr);
          }
        }
      }
    }

    // Pre-check all duplicates in one go
    const existingPaymentsRes = await c.env.DB.prepare("SELECT patient_id, amount, category, date(payment_date) as pdate FROM payments WHERE clinic_id = ? AND input_type = 'bulk'").bind(clinic_id).all();
    const duplicateSet = new Set();
    for (const p of (existingPaymentsRes.results || [])) {
      duplicateSet.add(`${p.patient_id}_${p.amount}_${p.category}_${p.pdate}`);
    }

    // Step 3: Batch Insert Payments
    const validRows = [];
    const paymentStmts = [];
    for (const row of rows) {
      if (!row.name) { errorCount++; continue; }
      let patient = row.phone ? patientMap.get(row.phone) : patientMap.get(row.name);
      if (!patient) continue; 

      const payment_amount = row.payment_amount;
      if (payment_amount && payment_amount > 0) {
        const paymentDate = row.payment_date || getKSTDate();
        const treatment = row.treatment || '일반진료';
        const dupKey = `${patient.id}_${payment_amount}_${treatment}_${paymentDate}`;
        
        if (duplicateSet.has(dupKey)) {
          successCount++;
          continue;
        }
        duplicateSet.add(dupKey); 

        const catRate = catRates.find((r: any) => r.category === treatment);
        const rate = catRate ? catRate.rate : defaultRate;
        const pointEarned = Math.floor(payment_amount * (rate / 100));

        validRows.push({ patient, paymentDate, treatment, payment_amount, pointEarned });
        paymentStmts.push(
          c.env.DB.prepare(`
            INSERT INTO payments (clinic_id, patient_id, amount, category, point_rate, point_earned, payment_date, input_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'bulk') RETURNING id
          `).bind(clinic_id, patient.id, payment_amount, treatment, rate, pointEarned, paymentDate)
        );
      } else {
        successCount++; 
      }
    }

    // Execute Payment Inserts in Batches
    const pointLogStmts = [];
    
    for (let i = 0; i < paymentStmts.length; i += 50) {
      const stmtBatch = paymentStmts.slice(i, i + 50);
      const rowBatch = validRows.slice(i, i + 50);
      const batchRes = await c.env.DB.batch(stmtBatch);
      
      for (let j = 0; j < batchRes.length; j++) {
        const res = batchRes[j];
        const vRow = rowBatch[j];
        const patientId = vRow.patient.id;
        const pointEarned = vRow.pointEarned;
        
        if (res.results && res.results.length > 0) {
          const paymentId = res.results[0].id;
          let pc = pcMap.get(patientId);
          if (pointEarned > 0 && pc) {
            const currentTotal = ((pc.total_points as number) || 0) + pointEarned;
            pc.total_points = currentTotal;
            
            pointLogStmts.push(c.env.DB.prepare("UPDATE patient_clinic SET total_points = total_points + ?, updated_at = datetime('now') WHERE patient_id = ? AND clinic_id = ?").bind(pointEarned, patientId, clinic_id));
            pointLogStmts.push(c.env.DB.prepare('INSERT INTO point_logs (clinic_id, patient_id, payment_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(clinic_id, patientId, paymentId, 'earn', pointEarned, currentTotal, '대량 업로드 적립'));

            let autoRules = [];
            try { autoRules = JSON.parse(settings?.coupon_auto_rules as string || '[]'); } catch {}
            
            if (activeTemplates && activeTemplates.length > 0) {
              let availPts = pc.total_points - ((pc.used_points as number) || 0);
              for (const tpl of activeTemplates) {
                const autoPoints = tpl.auto_issue_points as number;
                const reqPts = (tpl.required_points as number) || 0;
                
                if (availPts < autoPoints || (reqPts > 0 && availPts < reqPts)) continue;
                
                // One-time check for free milestone coupons
                if (reqPts === 0) {
                  const hasCpn = await c.env.DB.prepare("SELECT id FROM coupons WHERE template_id = ? AND patient_id = ?").bind(tpl.id, patientId).first();
                  if (hasCpn) continue;
                }

                if (reqPts > 0) {
                  pc.used_points = ((pc.used_points as number) || 0) + reqPts;
                  availPts -= reqPts;
                  pointLogStmts.push(c.env.DB.prepare("UPDATE patient_clinic SET used_points = ?, updated_at = datetime('now') WHERE patient_id = ? AND clinic_id = ?").bind(pc.used_points, patientId, clinic_id));
                  pointLogStmts.push(c.env.DB.prepare('INSERT INTO point_logs (clinic_id, patient_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)').bind(clinic_id, patientId, 'use', reqPts, availPts, '자동발행 차감 (' + tpl.name + ')'));
                }

                const code = Math.random().toString(36).substr(2, 4).toUpperCase() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
                let expiresAt = null;
                if (tpl.valid_days) {
                  const ed = new Date();
                  ed.setDate(ed.getDate() + (tpl.valid_days as number));
                  expiresAt = ed.toISOString().split('T')[0] + ' 23:59:59';
                }
                pointLogStmts.push(
                  c.env.DB.prepare("INSERT INTO coupons (clinic_id, patient_id, template_id, code, status, expires_at, issued_by) VALUES (?, ?, ?, ?, 'active', ?, ?)").bind(clinic_id, patientId, tpl.id, code, expiresAt, member ? member.id : null)
                );
              }
            }
          }
        }
        successCount++;
      }
    }

    // Execute Point Logs and Coupons in Batches
    for (let i = 0; i < pointLogStmts.length; i += 50) {
      await c.env.DB.batch(pointLogStmts.slice(i, i + 50));
    }

  } catch(fatal) {
    console.error("Fatal error in bulk upload:", fatal);
    return c.json({ error: '데이터 처리 중 심각한 오류가 발생했습니다.' }, 500);
  }

  // Log bulk upload
  await c.env.DB.prepare(
    'INSERT INTO bulk_uploads (clinic_id, uploaded_by, upload_type, total_rows, success_rows, error_rows, result_summary) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(clinic_id, member.id, 'combined', rows.length, successCount, errorCount, JSON.stringify(errors)).run()

  return c.json({ success: true, success_count: successCount, error_count: errorCount, errors })
})

// ==================== DASHBOARD ====================
app.get('/api/dashboard', async (c) => {
  const clinicId = c.req.query('clinic_id')
  if (!clinicId) return c.json({ error: 'clinic_id 필요' }, 400)

  const today = getKSTDate()

  // 오늘 월-일 (MM-DD) 추출해 생일 환자 조회
  const todayMD = today.slice(5) // "MM-DD"

  const [todayPayments, totalPatients, recentPayments, recentPatients, activeCoupons, totalPaymentSum, birthdayPatients, undeliveredCouponsResult, undeliveredCountResult] = await Promise.all([
    c.env.DB.prepare(`SELECT COALESCE(SUM(amount),0) as payment_amount, COUNT(*) as payment_count, COALESCE(SUM(point_earned),0) as point_earned FROM payments WHERE clinic_id = ? AND payment_date = ?`).bind(clinicId, today).first(),
    c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM patient_clinic WHERE clinic_id = ? AND status = 'active'`).bind(clinicId).first(),
    c.env.DB.prepare(`
      SELECT MAX(p.created_at) as created_at, p.patient_id, m.name as patient_name, m.phone as patient_phone, 
             p.payment_date, p.category, SUM(p.amount) as amount, SUM(p.point_earned) as point_earned,
             (SELECT pc.total_points - pc.used_points FROM patient_clinic pc WHERE pc.patient_id = p.patient_id AND pc.clinic_id = ?) as available_points
      FROM payments p 
      JOIN members m ON p.patient_id = m.id 
      WHERE p.clinic_id = ? AND p.payment_date = ?
      GROUP BY p.patient_id, p.payment_date, p.category
      ORDER BY MAX(p.created_at) DESC LIMIT 5
    `).bind(clinicId, clinicId, today).all(),
    c.env.DB.prepare(`SELECT m.id, m.name, m.phone, m.chart_number, m.birth_date, m.last_treatment, pc.total_points, pc.used_points, pc.created_at as joined_at FROM members m JOIN patient_clinic pc ON m.id = pc.patient_id WHERE pc.clinic_id = ? AND pc.status = 'active' AND m.role = 'patient' ORDER BY pc.created_at DESC LIMIT 5`).bind(clinicId).all(),
    c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM coupons WHERE clinic_id = ? AND status = 'active'`).bind(clinicId).first(),
    c.env.DB.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE clinic_id = ?`).bind(clinicId).first(),
    c.env.DB.prepare(`SELECT m.id, m.name, m.phone, m.chart_number, m.birth_date, pc.total_points, pc.used_points, (pc.total_points - pc.used_points) as available_points, (SELECT GROUP_CONCAT(ct.name || '::' || cp.status || '::' || ct.is_birthday || '::' || date(datetime(cp.created_at, '+9 hours')) || '::' || cp.id || '::' || cp.code || '::' || COALESCE(cp.shared_at, '') || '::' || COALESCE(p.delivery_type, ''), '||') FROM coupons cp JOIN coupon_templates ct ON cp.template_id = ct.id LEFT JOIN products p ON ct.product_id = p.id WHERE cp.patient_id = m.id AND cp.clinic_id = ?) as all_coupons FROM members m JOIN patient_clinic pc ON m.id = pc.patient_id WHERE pc.clinic_id = ? AND pc.status = 'active' AND m.role = 'patient' AND m.birth_date IS NOT NULL AND SUBSTR(m.birth_date, 6, 5) = ? ORDER BY m.name`).bind(clinicId, clinicId, todayMD).all(),
    // 미전송 쿠폰: 발행됐지만 shared_at이 NULL인 active 쿠폰
    c.env.DB.prepare(`
      SELECT cp.id, cp.code, cp.status, cp.created_at, cp.expires_at, cp.patient_id,
             ct.name as template_name, ct.discount_type, ct.discount_value, ct.is_birthday,
             m.name as patient_name, m.phone as patient_phone
      FROM coupons cp
      JOIN coupon_templates ct ON cp.template_id = ct.id
      JOIN members m ON cp.patient_id = m.id
      WHERE cp.clinic_id = ? AND cp.status = 'active' AND cp.shared_at IS NULL
      ORDER BY cp.created_at DESC
      LIMIT 50
    `).bind(clinicId).all(),
    // 미전송 쿠폰 전체 건수 (LIMIT 없이)
    c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM coupons WHERE clinic_id = ? AND status = 'active' AND shared_at IS NULL`).bind(clinicId).first()
  ])

  // ==================== 자동발행 대상 (auto_eligible) 계산 ====================
  let autoEligibleList: any[] = []
  let debugAuto: any = { tpl_general: 0, tpl_birthday: 0, skip_log: [] }
  try {
    // 자동발행 조건이 있는 활성 쿠폰 템플릿 조회
    const autoTemplatesRes = await c.env.DB.prepare(
      "SELECT * FROM coupon_templates WHERE clinic_id = ? AND status = 'active' AND auto_issue_points IS NOT NULL AND auto_issue_points > 0 AND (is_birthday = 0 OR is_birthday IS NULL)"
    ).bind(clinicId).all()
    const autoTemplates = autoTemplatesRes.results || []
    debugAuto.tpl_general = autoTemplates.length

    // 생일 쿠폰 템플릿
    const bdayTemplatesRes = await c.env.DB.prepare(
      "SELECT * FROM coupon_templates WHERE clinic_id = ? AND status = 'active' AND is_birthday = 1"
    ).bind(clinicId).all()
    const bdayTemplates = bdayTemplatesRes.results || []
    debugAuto.tpl_birthday = bdayTemplates.length

    if (autoTemplates.length > 0) {
      // 해당 클리닉의 활성 환자 + 포인트 정보 조회
      const patientsRes = await c.env.DB.prepare(
        "SELECT pc.patient_id, (pc.total_points - COALESCE(pc.used_points, 0)) as available_points, m.name, m.phone FROM patient_clinic pc JOIN members m ON pc.patient_id = m.id WHERE pc.clinic_id = ? AND pc.status = 'active' AND m.role = 'patient'"
      ).bind(clinicId).all()
      const patients = patientsRes.results || []

      for (const patient of patients) {
        const avail = (patient.available_points as number) || 0
        for (const tpl of autoTemplates) {
          const autoPoints = (tpl.auto_issue_points as number) || 0
          if (avail < autoPoints) continue
          const reqPoints = (tpl.required_points as number) || 0
          if (reqPoints > 0 && avail < reqPoints) continue

          // 중복 체크: required_points > 0이면 포인트 차감으로 재발급 가능, 0이면 1회만
          if (reqPoints > 0) {
            const existing = await c.env.DB.prepare(
              "SELECT id FROM coupons WHERE template_id = ? AND patient_id = ? AND clinic_id = ? AND status = 'active'"
            ).bind(tpl.id, patient.patient_id, clinicId).first()
            if (existing) { debugAuto.skip_log.push({ id: patient.patient_id, reason: 'active_dup' }); continue }
          } else {
            const existing = await c.env.DB.prepare(
              "SELECT id FROM coupons WHERE template_id = ? AND patient_id = ?"
            ).bind(tpl.id, patient.patient_id).first()
            if (existing) { debugAuto.skip_log.push({ id: patient.patient_id, reason: 'ever_issued' }); continue }
          }

          autoEligibleList.push({
            patient_id: patient.patient_id,
            patient_name: patient.name,
            patient_phone: patient.phone,
            template_id: tpl.id,
            template_name: tpl.name,
            available_points: avail,
            auto_issue_points: autoPoints,
            type: 'points'
          })
          break // 환자당 첫번째 매칭 템플릿만
        }
      }
    }

    // 오늘 생일 환자 중 생일 쿠폰 미발급 대상
    if (bdayTemplates.length > 0 && birthdayPatients.results) {
      for (const bp of (birthdayPatients.results as any[])) {
        for (const btpl of bdayTemplates) {
          const existing = await c.env.DB.prepare(
            "SELECT id FROM coupons WHERE template_id = ? AND patient_id = ? AND clinic_id = ? AND status = 'active'"
          ).bind(btpl.id, bp.id, clinicId).first()
          if (!existing) {
            autoEligibleList.push({
              patient_id: bp.id,
              patient_name: bp.name,
              patient_phone: bp.phone,
              template_id: btpl.id,
              template_name: btpl.name,
              available_points: bp.available_points || 0,
              type: 'birthday'
            })
          }
        }
      }
    }
  } catch (e: any) {
    debugAuto.error = e.message || String(e)
  }

  const undeliveredList = undeliveredCouponsResult.results || []

  return c.json({
    today: {
      payment_amount: todayPayments?.payment_amount || 0,
      payment_count: todayPayments?.payment_count || 0,
      point_earned: todayPayments?.point_earned || 0
    },
    total_patients: totalPatients?.cnt || 0,
    active_coupons: activeCoupons?.cnt || 0,
    total_payment_sum: totalPaymentSum?.total || 0,
    recent_payments: recentPayments.results || [],
    recent_patients: recentPatients.results || [],
    birthday_patients: birthdayPatients.results || [],
    auto_eligible: autoEligibleList.slice(0, 20),
    auto_eligible_total: autoEligibleList.length,
    undelivered_coupons: undeliveredList.slice(0, 20),
    undelivered_total: (undeliveredCountResult as any)?.cnt || undeliveredList.length,
    _debug_auto: debugAuto
  })
})

// ==================== COUPON AUTO-ELIGIBLE (발행 대상) ====================
app.get('/api/coupons/auto-eligible', async (c) => {
  const clinicId = c.req.query('clinic_id')
  if (!clinicId) return c.json({ error: 'clinic_id 필요' }, 400)

  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const sinceDays = parseInt(c.req.query('since_days') || '0')
  const templateFilter = c.req.query('template_id') || ''
  const searchQ = c.req.query('q') || ''
  const offset = (page - 1) * limit

  const autoTemplatesRes = await c.env.DB.prepare(
    "SELECT * FROM coupon_templates WHERE clinic_id = ? AND status = 'active' AND auto_issue_points IS NOT NULL AND auto_issue_points > 0 AND (is_birthday = 0 OR is_birthday IS NULL)"
  ).bind(clinicId).all()
  const autoTemplates = autoTemplatesRes.results || []

  const bdayTemplatesRes = await c.env.DB.prepare(
    "SELECT * FROM coupon_templates WHERE clinic_id = ? AND status = 'active' AND is_birthday = 1"
  ).bind(clinicId).all()
  const bdayTemplates = bdayTemplatesRes.results || []

  let allEligible: any[] = []

  if (autoTemplates.length > 0) {
    const patientsRes = await c.env.DB.prepare(
      "SELECT pc.patient_id, (pc.total_points - COALESCE(pc.used_points, 0)) as available_points, m.name, m.phone, pc.created_at as registered_date FROM patient_clinic pc JOIN members m ON pc.patient_id = m.id WHERE pc.clinic_id = ? AND pc.status = 'active' AND m.role = 'patient'"
    ).bind(clinicId).all()
    for (const patient of (patientsRes.results || [])) {
      const avail = (patient.available_points as number) || 0
      for (const tpl of autoTemplates) {
        if (templateFilter && String(tpl.id) !== templateFilter) continue
        const autoPoints = (tpl.auto_issue_points as number) || 0
        if (avail < autoPoints) continue
        const reqPoints = (tpl.required_points as number) || 0
        if (reqPoints > 0 && avail < reqPoints) continue
        if (reqPoints > 0) {
          const existing = await c.env.DB.prepare("SELECT id FROM coupons WHERE template_id = ? AND patient_id = ? AND clinic_id = ? AND status = 'active'").bind(tpl.id, patient.patient_id, clinicId).first()
          if (existing) continue
        } else {
          const existing = await c.env.DB.prepare("SELECT id FROM coupons WHERE template_id = ? AND patient_id = ?").bind(tpl.id, patient.patient_id).first()
          if (existing) continue
        }
        allEligible.push({ patient_id: patient.patient_id, patient_name: patient.name, patient_phone: patient.phone, template_id: tpl.id, template_name: tpl.name, available_points: avail, auto_issue_points: autoPoints, registered_date: patient.registered_date, type: 'points' })
        break
      }
    }
  }

  const todayMD2 = getKSTDate().slice(5)
  if (bdayTemplates.length > 0) {
    const bdayRes = await c.env.DB.prepare(
      "SELECT m.id, m.name, m.phone, (pc.total_points - COALESCE(pc.used_points, 0)) as available_points, pc.created_at as registered_date FROM members m JOIN patient_clinic pc ON m.id = pc.patient_id WHERE pc.clinic_id = ? AND pc.status = 'active' AND m.role = 'patient' AND m.birth_date IS NOT NULL AND SUBSTR(m.birth_date, 6, 5) = ?"
    ).bind(clinicId, todayMD2).all()
    for (const bp of (bdayRes.results || [])) {
      for (const btpl of bdayTemplates) {
        if (templateFilter && String(btpl.id) !== templateFilter) continue
        const existing = await c.env.DB.prepare("SELECT id FROM coupons WHERE template_id = ? AND patient_id = ? AND clinic_id = ? AND status = 'active'").bind(btpl.id, bp.id, clinicId).first()
        if (!existing) {
          allEligible.push({ patient_id: bp.id, patient_name: bp.name, patient_phone: bp.phone, template_id: btpl.id, template_name: btpl.name, available_points: bp.available_points || 0, registered_date: bp.registered_date, type: 'birthday' })
        }
      }
    }
  }

  if (searchQ) {
    const q = searchQ.toLowerCase()
    allEligible = allEligible.filter((e: any) => (e.patient_name && e.patient_name.toLowerCase().includes(q)) || (e.patient_phone && e.patient_phone.includes(q)))
  }

  const tplCounts: Record<string, { id: number, name: string, count: number }> = {}
  for (const e of allEligible) {
    if (!tplCounts[e.template_id]) tplCounts[e.template_id] = { id: e.template_id, name: e.template_name, count: 0 }
    tplCounts[e.template_id].count++
  }

  const totalAll = allEligible.length
  const paged = allEligible.slice(offset, offset + limit)

  return c.json({
    patients: paged, coupons: paged, total: totalAll, total_all: totalAll,
    total_pages: Math.ceil(totalAll / limit),
    since_days: sinceDays,
    since_date: sinceDays > 0 ? new Date(Date.now() - sinceDays * 86400000).toISOString().split('T')[0] : '',
    templates: Object.values(tplCounts)
  })
})

// ==================== COUPON UNDELIVERED (미전송 쿠폰) ====================
app.get('/api/coupons/undelivered', async (c) => {
  const clinicId = c.req.query('clinic_id')
  if (!clinicId) return c.json({ error: 'clinic_id 필요' }, 400)

  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const templateFilter = c.req.query('template_id') || ''
  const searchQ = c.req.query('q') || ''
  const offset = (page - 1) * limit

  const totalRes = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM coupons WHERE clinic_id = ? AND status = 'active' AND shared_at IS NULL").bind(clinicId).first()
  const totalAll = (totalRes?.cnt as number) || 0

  let whereExtra = ''
  const binds: any[] = [clinicId]
  if (templateFilter) { whereExtra += ' AND cp.template_id = ?'; binds.push(templateFilter) }
  if (searchQ) { whereExtra += ' AND (m.name LIKE ? OR m.phone LIKE ?)'; binds.push('%' + searchQ + '%', '%' + searchQ + '%') }

  const filteredCountRes = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM coupons cp JOIN members m ON cp.patient_id = m.id WHERE cp.clinic_id = ? AND cp.status = 'active' AND cp.shared_at IS NULL" + whereExtra).bind(...binds).first()
  const total = (filteredCountRes?.cnt as number) || 0

  const listBinds = [...binds, limit, offset]
  const listRes = await c.env.DB.prepare(
    "SELECT cp.id, cp.code, cp.status, cp.created_at as issued_date, cp.expires_at, cp.patient_id, ct.id as template_id, ct.name as template_name, ct.discount_type, ct.discount_value, ct.is_birthday, m.name as patient_name, m.phone as patient_phone, (SELECT pc.total_points - COALESCE(pc.used_points, 0) FROM patient_clinic pc WHERE pc.patient_id = cp.patient_id AND pc.clinic_id = cp.clinic_id) as available_points FROM coupons cp JOIN coupon_templates ct ON cp.template_id = ct.id JOIN members m ON cp.patient_id = m.id WHERE cp.clinic_id = ? AND cp.status = 'active' AND cp.shared_at IS NULL" + whereExtra + " ORDER BY cp.created_at DESC LIMIT ? OFFSET ?"
  ).bind(...listBinds).all()

  const tplCountRes = await c.env.DB.prepare("SELECT ct.id, ct.name, COUNT(*) as count FROM coupons cp JOIN coupon_templates ct ON cp.template_id = ct.id WHERE cp.clinic_id = ? AND cp.status = 'active' AND cp.shared_at IS NULL GROUP BY ct.id, ct.name ORDER BY count DESC").bind(clinicId).all()

  return c.json({ coupons: listRes.results || [], total, total_all: totalAll, total_pages: Math.ceil(total / limit), templates: tplCountRes.results || [] })
})

// ==================== ADMIN TEMPLATES (super_admin 쿠폰 템플릿 관리) ====================
app.get('/api/admin/templates', async (c) => {
  const member = c.get('member') as any
  if (!member || member.role !== 'super_admin') return c.json({ error: '권한이 없습니다.' }, 403)
  const ca = await c.env.DB.prepare('SELECT clinic_id FROM clinic_admins WHERE member_id = ? LIMIT 1').bind(member.id).first()
  const clinicId = ca?.clinic_id || c.req.query('clinic_id')
  // super_admin: 자기 clinic + 공용(clinic_id=0) 템플릿 모두 조회
  let templates
  if (clinicId) {
    templates = await c.env.DB.prepare('SELECT * FROM coupon_templates WHERE clinic_id IN (?, 0) ORDER BY clinic_id ASC, created_at DESC').bind(clinicId).all()
  } else {
    templates = await c.env.DB.prepare('SELECT * FROM coupon_templates ORDER BY clinic_id ASC, created_at DESC').all()
  }
  return c.json({ templates: templates.results || [] })
})

app.post('/api/admin/templates', async (c) => {
  const member = c.get('member') as any
  if (!member || member.role !== 'super_admin') return c.json({ error: '권한이 없습니다.' }, 403)
  const ca = await c.env.DB.prepare('SELECT clinic_id FROM clinic_admins WHERE member_id = ? LIMIT 1').bind(member.id).first()
  const clinicId = ca?.clinic_id || c.req.query('clinic_id')
  if (!clinicId) return c.json({ error: 'clinic_id가 필요합니다.' }, 400)
  const body = await c.req.json().catch(() => ({}))
  const { name, description, image_url, discount_type, discount_value, valid_days, is_birthday, required_points, auto_issue_points, auto_issue_amount, min_payment, product_id, status } = body
  if (!name) return c.json({ error: '쿠폰 이름이 필요합니다.' }, 400)
  const result = await c.env.DB.prepare(
    'INSERT INTO coupon_templates (clinic_id, name, description, image_url, discount_type, discount_value, min_payment, auto_issue_points, auto_issue_amount, valid_days, is_birthday, required_points, product_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(clinicId, name, description || null, image_url || null, discount_type || 'fixed', discount_value || 0, min_payment || 0, auto_issue_points || null, auto_issue_amount || null, valid_days || 90, is_birthday ? 1 : 0, required_points || 0, product_id || null, status || 'active').run()
  return c.json({ success: true, template_id: result.meta.last_row_id })
})

app.put('/api/admin/templates/:id', async (c) => {
  const member = c.get('member') as any
  if (!member || member.role !== 'super_admin') return c.json({ error: '권한이 없습니다.' }, 403)
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const updates: string[] = []
  const values: any[] = []
  for (const field of ['name', 'description', 'image_url', 'discount_type', 'discount_value', 'min_payment', 'auto_issue_points', 'auto_issue_amount', 'valid_days', 'status', 'is_birthday', 'required_points', 'product_id']) {
    if (body[field] !== undefined) { updates.push(`${field} = ?`); values.push(body[field]) }
  }
  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')")
    values.push(id)
    await c.env.DB.prepare(`UPDATE coupon_templates SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
  }
  return c.json({ success: true })
})

app.delete('/api/admin/templates/:id', async (c) => {
  const member = c.get('member') as any
  if (!member || member.role !== 'super_admin') return c.json({ error: '권한이 없습니다.' }, 403)
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM coupon_templates WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ==================== AUTO ISSUE BACKGROUND ====================
app.post('/api/coupons/auto-issue-background', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const { clinic_id } = body
    if (!clinic_id) return c.json({ error: 'clinic_id 필요' }, 400)
    const member = c.get('member') as any

    // 자동발행 조건이 있는 활성 쿠폰 템플릿
    const autoTemplatesRes = await c.env.DB.prepare(
      "SELECT * FROM coupon_templates WHERE clinic_id = ? AND status = 'active' AND auto_issue_points IS NOT NULL AND auto_issue_points > 0 AND (is_birthday = 0 OR is_birthday IS NULL)"
    ).bind(clinic_id).all()
    const autoTemplates = autoTemplatesRes.results || []
    if (autoTemplates.length === 0) return c.json({ issued: 0, has_more: false })

    // 환자 목록 (포인트 보유)
    const patientsRes = await c.env.DB.prepare(
      "SELECT pc.patient_id, (pc.total_points - COALESCE(pc.used_points, 0)) as available_points FROM patient_clinic pc JOIN members m ON pc.patient_id = m.id WHERE pc.clinic_id = ? AND pc.status = 'active' AND m.role = 'patient' AND (pc.total_points - COALESCE(pc.used_points, 0)) > 0"
    ).bind(clinic_id).all()
    const patients = patientsRes.results || []

    let issuedCount = 0
    const BATCH_LIMIT = 10

    for (const patient of patients) {
      if (issuedCount >= BATCH_LIMIT) break
      const avail = (patient.available_points as number) || 0

      const issued = await checkAndAutoIssueCoupons(c.env.DB, Number(clinic_id), patient.patient_id as number, member?.id || null)
      issuedCount += issued.length
    }

    return c.json({ issued: issuedCount, has_more: issuedCount >= BATCH_LIMIT })
  } catch (e: any) {
    console.error('auto-issue-background error:', e)
    return c.json({ error: e.message, issued: 0, has_more: false }, 500)
  }
})

// ==================== COUPON TEMPLATES ====================
app.get('/api/coupons/templates', async (c) => {
  const clinicId = c.req.query('clinic_id')
  if (!clinicId) return c.json({ error: 'clinic_id 필요' }, 400)
  const includeGlobal = c.req.query('include_global_inactive') || c.req.query('include_global')
  
  let templates
  if (includeGlobal) {
    // include_global_inactive=1 일 때: 해당 clinic 템플릿 + 공유 템플릿(clinic_id=0) 모두 반환
    templates = await c.env.DB.prepare(
      'SELECT * FROM coupon_templates WHERE clinic_id IN (?, 0) ORDER BY clinic_id ASC, created_at DESC'
    ).bind(clinicId).all()
  } else {
    templates = await c.env.DB.prepare(
      'SELECT * FROM coupon_templates WHERE clinic_id = ? ORDER BY created_at DESC'
    ).bind(clinicId).all()
  }
  return c.json({ templates: templates.results || [] })
})

app.post('/api/coupons/templates', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { clinic_id, name, discount_type, discount_value, valid_days, description, image_url, auto_issue_points, auto_issue_amount, min_payment, is_birthday, required_points, product_id } = body
  if (!clinic_id || !name) return c.json({ error: '필수 입력값이 누락되었습니다.' }, 400)

  const result = await c.env.DB.prepare(`
    INSERT INTO coupon_templates (clinic_id, name, description, image_url, discount_type, discount_value, min_payment, auto_issue_points, auto_issue_amount, valid_days, is_birthday, required_points, product_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(clinic_id, name, description || null, image_url || null, discount_type || 'fixed', discount_value, min_payment || 0, auto_issue_points || null, auto_issue_amount || null, valid_days || 90, is_birthday ? 1 : 0, required_points || 0, product_id || null).run()

  return c.json({ success: true, template_id: result.meta.last_row_id })
})

app.put('/api/coupons/templates/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const updates: string[] = []
  const values: any[] = []
  for (const field of ['name', 'description', 'image_url', 'discount_type', 'discount_value', 'min_payment', 'auto_issue_points', 'auto_issue_amount', 'valid_days', 'status', 'is_birthday', 'required_points']) {
    if (body[field] !== undefined) { updates.push(`${field} = ?`); values.push(body[field]) }
  }
  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')")
    values.push(id)
    await c.env.DB.prepare(`UPDATE coupon_templates SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
  }
  return c.json({ success: true })
})

app.delete('/api/coupons/templates/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM coupon_templates WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ==================== GLOBAL TEMPLATES (글로벌 템플릿 가져오기) ====================
// 글로벌 템플릿 목록 (clinic_id=0인 공유 템플릿)
app.get('/api/templates/global', async (c) => {
  const templates = await c.env.DB.prepare(
    "SELECT * FROM coupon_templates WHERE clinic_id = 0 AND status = 'active' ORDER BY created_at DESC"
  ).all()
  return c.json({ templates: templates.results || [] })
})

// 글로벌 템플릿을 내 치과로 복사 (import)
app.post('/api/templates/import', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { clinic_id, template_id } = body
  if (!clinic_id || !template_id) return c.json({ error: 'clinic_id, template_id 필요' }, 400)

  // 원본 글로벌 템플릿 조회
  const tpl = await c.env.DB.prepare('SELECT * FROM coupon_templates WHERE id = ?').bind(template_id).first()
  if (!tpl) return c.json({ error: '템플릿을 찾을 수 없습니다.' }, 404)

  // 내 치과에 복사 생성
  const result = await c.env.DB.prepare(`
    INSERT INTO coupon_templates (clinic_id, name, description, image_url, discount_type, discount_value, min_payment, auto_issue_points, auto_issue_amount, valid_days, is_birthday, required_points, product_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    clinic_id, tpl.name, tpl.description || null, tpl.image_url || null,
    tpl.discount_type || 'fixed', tpl.discount_value || 0, tpl.min_payment || 0,
    tpl.auto_issue_points || null, tpl.auto_issue_amount || null,
    tpl.valid_days || 90, tpl.is_birthday || 0, tpl.required_points || 0, tpl.product_id || null
  ).run()

  return c.json({ success: true, template_id: result.meta.last_row_id })
})

// 글로벌 템플릿 활성화 (일반 치과에서 글로벌 템플릿을 자기 치과용으로 활성화)
app.post('/api/coupons/templates/activate-global', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { clinic_id, global_template_id, name, required_points, valid_days, is_birthday, coupon_kind, auto_issue_points } = body
  if (!clinic_id || !global_template_id) return c.json({ error: 'clinic_id, global_template_id 필요' }, 400)

  // 글로벌 원본 조회
  const gTpl = await c.env.DB.prepare('SELECT * FROM coupon_templates WHERE id = ?').bind(global_template_id).first()
  if (!gTpl) return c.json({ error: '글로벌 템플릿을 찾을 수 없습니다.' }, 404)

  // 이미 활성화된 것이 있는지 확인 (같은 이름으로)
  const existing = await c.env.DB.prepare(
    "SELECT id FROM coupon_templates WHERE clinic_id = ? AND name = ? AND status = 'active'"
  ).bind(clinic_id, name || gTpl.name).first()

  if (existing) {
    // 기존 것 업데이트
    await c.env.DB.prepare(`
      UPDATE coupon_templates SET required_points = ?, valid_days = ?, is_birthday = ?, auto_issue_points = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(required_points || 0, valid_days || 90, is_birthday || 0, auto_issue_points || null, existing.id).run()
    return c.json({ success: true, template_id: existing.id, updated: true })
  }

  // 새로 생성
  const result = await c.env.DB.prepare(`
    INSERT INTO coupon_templates (clinic_id, name, description, image_url, discount_type, discount_value, min_payment, auto_issue_points, auto_issue_amount, valid_days, is_birthday, required_points, product_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    clinic_id, name || gTpl.name, gTpl.description || null, gTpl.image_url || null,
    gTpl.discount_type || 'fixed', gTpl.discount_value || 0, gTpl.min_payment || 0,
    auto_issue_points || null, gTpl.auto_issue_amount || null,
    valid_days || 90, is_birthday || 0, required_points || 0, gTpl.product_id || null
  ).run()

  return c.json({ success: true, template_id: result.meta.last_row_id })
})

// 글로벌 템플릿 비활성화 (일반 치과에서 활성화한 글로벌 템플릿을 비활성)
app.post('/api/coupons/templates/deactivate-global', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { clinic_id, global_template_id } = body
  if (!clinic_id || !global_template_id) return c.json({ error: 'clinic_id, global_template_id 필요' }, 400)

  // 글로벌 원본 이름으로 치과 내 해당 템플릿 찾아서 비활성화
  const gTpl = await c.env.DB.prepare('SELECT name FROM coupon_templates WHERE id = ?').bind(global_template_id).first()
  if (gTpl) {
    await c.env.DB.prepare(
      "UPDATE coupon_templates SET status = 'inactive', updated_at = datetime('now') WHERE clinic_id = ? AND name = ?"
    ).bind(clinic_id, gTpl.name).run()
  }
  // 또는 직접 global_template_id로 매핑된 것도 비활성화
  await c.env.DB.prepare(
    "UPDATE coupon_templates SET status = 'inactive', updated_at = datetime('now') WHERE clinic_id = ? AND id = ?"
  ).bind(clinic_id, global_template_id).run()

  return c.json({ success: true })
})

// ==================== COUPONS ====================
function generateCouponCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code.substring(0, 4) + '-' + code.substring(4)
}

app.post('/api/coupons/issue', async (c) => {
  try {
    const member = c.get('member')
  const body = await c.req.json().catch(() => ({}))
  const { template_id, clinic_id, patient_id } = body
  if (!template_id || !clinic_id || !patient_id) return c.json({ error: '필수 입력값이 누락되었습니다.' }, 400)

  const template = await c.env.DB.prepare('SELECT * FROM coupon_templates WHERE id = ?').bind(template_id).first()
  if (!template) return c.json({ error: '쿠폰 템플릿을 찾을 수 없습니다.' }, 404)

  const isBirthday = template.is_birthday == 1 || template.is_birthday === '1' || template.is_birthday === 'true' || template.is_birthday === true

  // Prevent duplicate active coupons for the same template, unless forced
  if (!body.force_duplicate) {
    const existing = await c.env.DB.prepare(
      "SELECT id FROM coupons WHERE template_id = ? AND patient_id = ? AND clinic_id = ? AND status = 'active'"
    ).bind(template_id, patient_id, clinic_id).first();
    if (existing) {
      return c.json({ error: '이미 해당 쿠폰이 발급되어 보유 중입니다.' }, 400);
    }
  }

  const pointCost = Number(template.required_points) || 0
  
  // 환자 생일인지 확인
  const patRec = await c.env.DB.prepare('SELECT birth_date FROM members WHERE id = ?').bind(patient_id).first();
  const kstNow = new Date(Date.now() + 9 * 3600000);
  const todayMD = kstNow.toISOString().substring(5, 10);
  const isPatBday = patRec && patRec.birth_date && patRec.birth_date.substring(5, 10) === todayMD;
  
  const bypassPoints = isBirthday && isPatBday;

  // --- B2B MALL INVENTORY CHECK ---
  if (template.product_id) {
    const inv = await c.env.DB.prepare('SELECT quantity FROM clinic_inventory WHERE clinic_id = ? AND product_id = ?')
      .bind(clinic_id, template.product_id).first();
    if (!inv || inv.quantity < 1) {
      return c.json({ error: '해당 쿠폰(상품)의 재고가 부족합니다. 쇼핑몰에서 먼저 충전해주세요.' }, 400);
    }
    // Deduct inventory
    await c.env.DB.prepare('UPDATE clinic_inventory SET quantity = quantity - 1 WHERE clinic_id = ? AND product_id = ?')
      .bind(clinic_id, template.product_id).run();
  }
  // --------------------------------


  if (pointCost > 0 && !bypassPoints) {
    const pc = await c.env.DB.prepare(
      'SELECT * FROM patient_clinic WHERE patient_id = ? AND clinic_id = ?'
    ).bind(patient_id, clinic_id).first()
    if (!pc) return c.json({ error: '환자 정보를 찾을 수 없습니다.' }, 404)
    const available = (pc.total_points as number) - ((pc.used_points as number) || 0)
    
    if (available < pointCost) {
      return c.json({ error: `포인트가 부족합니다. 필요: ${pointCost}P, 보유: ${available}P` }, 400)
    }

    await c.env.DB.prepare(
      "UPDATE patient_clinic SET used_points = used_points + ?, updated_at = datetime('now') WHERE patient_id = ? AND clinic_id = ?"
    ).bind(pointCost, patient_id, clinic_id).run()
    
    const newAvail = available - pointCost
    await c.env.DB.prepare(
      'INSERT INTO point_logs (clinic_id, patient_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(clinic_id, patient_id, 'use', -pointCost, newAvail, `쿠폰 발행: ${template.name}`).run().catch(() => {})
  }

  const code = generateCouponCode()
  const expiresAt = new Date(Date.now() + ((template.valid_days as number) || 90) * 86400000).toISOString().split('T')[0]

  const result = await c.env.DB.prepare(`
    INSERT INTO coupons (template_id, clinic_id, patient_id, code, expires_at, issued_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(template_id, clinic_id, patient_id, code, expiresAt, member.id).run()

  const patient = await c.env.DB.prepare('SELECT name FROM members WHERE id = ?').bind(patient_id).first()
  // 발행 후 최신 포인트 조회
  const pcAfter = await c.env.DB.prepare(
    'SELECT total_points, used_points, (total_points - used_points) as available_points FROM patient_clinic WHERE patient_id = ? AND clinic_id = ?'
  ).bind(patient_id, clinic_id).first()

  return c.json({
    success: true,
    coupon: {
      id: result.meta.last_row_id,
      code,
      template_name: template.name,
      discount_type: template.discount_type,
      discount_value: template.discount_value,
      image_url: template.image_url,
      expires_at: expiresAt,
      patient_name: patient?.name || '',
      point_deducted: bypassPoints ? 0 : pointCost,
      is_birthday: isBirthday
    },
    patient_points: {
      patient_id: Number(patient_id),
      available_points: (pcAfter?.available_points as number) || 0,
      total_points: (pcAfter?.total_points as number) || 0,
      used_points: (pcAfter?.used_points as number) || 0
    }
  })
  } catch(e: any) { return c.json({error: "서버오류: " + (e.message || String(e))}, 500) }
})

app.get('/api/coupons/clinic', async (c) => {
  const clinicId = c.req.query('clinic_id')
  if (!clinicId) return c.json({ error: 'clinic_id 필요' }, 400)
  const coupons = await c.env.DB.prepare(`
    SELECT c.*, ct.name as template_name, ct.discount_type, ct.discount_value, ct.image_url, ct.is_birthday, m.name as patient_name, m.phone as patient_phone, m.chart_number as patient_chart
    FROM coupons c 
    JOIN coupon_templates ct ON c.template_id = ct.id 
    JOIN members m ON c.patient_id = m.id
    WHERE c.clinic_id = ? 
    ORDER BY m.name ASC, c.created_at DESC
  `).bind(clinicId).all()
  return c.json({ coupons: coupons.results || [] })
})

app.get('/api/coupons/my', async (c) => {
  const clinicId = c.req.query('clinic_id')
  const status = c.req.query('status')
  const member = c.get('member')
  const patientId = c.req.query('patient_id') || member.id
  
  let sql = `
    SELECT c.*, ct.name as template_name, ct.discount_type, ct.discount_value, ct.image_url, ct.is_birthday
    FROM coupons c JOIN coupon_templates ct ON c.template_id = ct.id
    WHERE c.patient_id = ? ${clinicId ? 'AND c.clinic_id = ?' : ''}
  `;
  
  if (status) {
    sql += ` AND c.status = '${status}'`;
  }
  
  sql += " ORDER BY CASE WHEN c.status = 'active' THEN 0 ELSE 1 END, c.created_at DESC";
  
  const coupons = await c.env.DB.prepare(sql).bind(...(clinicId ? [patientId, clinicId] : [patientId])).all()
  return c.json({ coupons: coupons.results || [] })
})

app.delete('/api/coupons/:id', async (c) => {
  const id = c.req.param('id')
  
  // Refund points before deleting
  const coupon = await c.env.DB.prepare(
    "SELECT c.*, t.required_points, t.name as template_name, t.is_birthday, t.product_id FROM coupons c JOIN coupon_templates t ON c.template_id = t.id WHERE c.id = ?"
  ).bind(id).first()
  
  if (coupon && coupon.status !== 'used') {
    const isBirthday = coupon.is_birthday == 1 || coupon.is_birthday === '1' || coupon.is_birthday === 'true' || coupon.is_birthday === true;
    const reqPts = Number(coupon.required_points) || 0
    // Refund inventory if product_id exists
    if (coupon.product_id) {
      await c.env.DB.prepare('UPDATE clinic_inventory SET quantity = quantity + 1 WHERE clinic_id = ? AND product_id = ?')
        .bind(coupon.clinic_id, coupon.product_id).run().catch(()=>{});
    }
    
    let wasBypassed = false;
    if (isBirthday) {
      const patRec = await c.env.DB.prepare('SELECT birth_date FROM members WHERE id = ?').bind(coupon.patient_id).first();
      if (patRec && patRec.birth_date) {
        try {
          const createdUtc = new Date(coupon.created_at + 'Z');
          const createdKst = new Date(createdUtc.getTime() + 9 * 3600000);
          const createdMD = createdKst.toISOString().substring(5, 10);
          if (patRec.birth_date.substring(5, 10) === createdMD) {
            wasBypassed = true;
          }
        } catch(e) {}
      }
    }
    
    if (reqPts > 0 && !wasBypassed) {
      await c.env.DB.prepare(
        "UPDATE patient_clinic SET used_points = used_points - ?, updated_at = datetime('now') WHERE patient_id = ? AND clinic_id = ?"
      ).bind(reqPts, coupon.patient_id, coupon.clinic_id).run()
      
      const pc = await c.env.DB.prepare('SELECT total_points, used_points FROM patient_clinic WHERE patient_id = ? AND clinic_id = ?').bind(coupon.patient_id, coupon.clinic_id).first()
      if (pc) {
        await c.env.DB.prepare(
          "INSERT INTO point_logs (clinic_id, patient_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(coupon.clinic_id, coupon.patient_id, 'earn', reqPts, Number(pc.total_points) - Number(pc.used_points), '쿠폰 삭제 환불: ' + coupon.template_name).run().catch(()=>{})
      }
    }
  }

  await c.env.DB.prepare('DELETE FROM coupons WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

app.put('/api/coupons/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  if (body.status) {
    const updates: any = { status: body.status }
    if (body.status === 'used') updates.used_at = new Date().toISOString()
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    await c.env.DB.prepare(`UPDATE coupons SET ${fields} WHERE id = ?`).bind(...Object.values(updates), id).run()
  }
  return c.json({ success: true })
})

// ==================== POINTS ====================
app.get('/api/points/balance', async (c) => {
  const clinicId = c.req.query('clinic_id')
  const member = c.get('member')
  // patient_id 파라미터가 있으면 사용 (관리자가 다른 환자 조회 시), 없으면 본인 ID
  const patientId = c.req.query('patient_id') || member.id
  const pc = await c.env.DB.prepare(
    'SELECT * FROM patient_clinic WHERE patient_id = ? AND clinic_id = ?'
  ).bind(patientId, clinicId).first()
  return c.json({ total_points: pc?.total_points || 0, used_points: pc?.used_points || 0, available_points: ((pc?.total_points as number) || 0) - ((pc?.used_points as number) || 0) })
})

app.get('/api/points/history', async (c) => {
  const clinicId = c.req.query('clinic_id')
  const member = c.get('member')
  const patientId = c.req.query('patient_id') || member.id
  const limit = parseInt(c.req.query('limit') || '50')
  const logs = await c.env.DB.prepare(
    'SELECT * FROM point_logs WHERE clinic_id = ? AND patient_id = ? ORDER BY created_at DESC LIMIT ?'
  ).bind(clinicId, patientId, limit).all()
  return c.json({ logs: logs.results || [] })
})

// ==================== DENTWEB SYNC APIs ====================
app.post('/api/sync/patients', async (c) => {
  const member = c.get('member')
  const body = await c.req.json().catch(() => ({}))
  const { clinic_id, patients } = body
  if (!clinic_id || !patients || !Array.isArray(patients)) return c.json({ error: 'clinic_id와 patients 배열이 필요합니다.' }, 400)

  let newCount = 0, updatedCount = 0, errorCount = 0

  for (const pt of patients) {
    try {
      const { dentweb_id, chart_number, name, phone, birth_date, gender, last_visit_date } = pt
      if (!name) { errorCount++; continue }

      // Find existing by dentweb_id or chart_number or phone
      let existing: any = null
      if (dentweb_id) {
        existing = await c.env.DB.prepare('SELECT * FROM members WHERE dentweb_id = ? AND role = ?').bind(String(dentweb_id), 'patient').first()
      }
      if (!existing && chart_number) {
        existing = await c.env.DB.prepare(
          "SELECT m.* FROM members m JOIN patient_clinic pc ON m.id = pc.patient_id WHERE m.chart_number = ? AND pc.clinic_id = ? AND m.role = 'patient'"
        ).bind(chart_number, clinic_id).first()
      }
      if (!existing && phone) {
        existing = await c.env.DB.prepare('SELECT * FROM members WHERE phone = ? AND role = ?').bind(phone, 'patient').first()
      }

      if (existing) {
        // Update
        const ups: string[] = []
        const vals: any[] = []
        if (dentweb_id && existing.dentweb_id !== String(dentweb_id)) { ups.push('dentweb_id = ?'); vals.push(String(dentweb_id)) }
        if (chart_number && existing.chart_number !== chart_number) { ups.push('chart_number = ?'); vals.push(chart_number) }
        if (birth_date && existing.birth_date !== birth_date) { ups.push('birth_date = ?'); vals.push(birth_date) }
        if (gender && existing.gender !== gender) { ups.push('gender = ?'); vals.push(gender) }
        if (last_visit_date) { ups.push('last_visit_date = ?'); vals.push(last_visit_date) }
        if (phone && existing.phone !== phone && !existing.phone.startsWith('nophone-')) { /* skip phone update if different */ }
        else if (phone && existing.phone.startsWith('nophone-')) { ups.push('phone = ?'); vals.push(phone) }
        if (ups.length > 0) {
          ups.push("updated_at = datetime('now')")
          vals.push(existing.id)
          await c.env.DB.prepare(`UPDATE members SET ${ups.join(', ')} WHERE id = ?`).bind(...vals).run()
        }

        // Ensure linked to clinic
        const pc = await c.env.DB.prepare('SELECT * FROM patient_clinic WHERE patient_id = ? AND clinic_id = ?').bind(existing.id, clinic_id).first()
        if (!pc) {
          await c.env.DB.prepare('INSERT INTO patient_clinic (patient_id, clinic_id) VALUES (?, ?)').bind(existing.id, clinic_id).run()
        } else if (pc.status === 'inactive') {
          await c.env.DB.prepare("UPDATE patient_clinic SET status = 'active', updated_at = datetime('now') WHERE id = ?").bind(pc.id).run()
        }
        updatedCount++
      } else {
        // Create new
        const r = await c.env.DB.prepare(
          'INSERT INTO members (name, phone, chart_number, birth_date, dentweb_id, gender, last_visit_date, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(name, phone || `nophone-dw-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, chart_number || null, birth_date || null, dentweb_id ? String(dentweb_id) : null, gender || null, last_visit_date || null, 'patient', 'approved').run()
        await c.env.DB.prepare('INSERT INTO patient_clinic (patient_id, clinic_id) VALUES (?, ?)').bind(r.meta.last_row_id, clinic_id).run()
        newCount++
      }
    } catch (e) {
      errorCount++
    }
  }

  // Log sync
  await c.env.DB.prepare(
    "INSERT INTO sync_logs (clinic_id, sync_type, source, total_rows, new_rows, updated_rows, error_rows) VALUES (?, 'patients', 'dentweb', ?, ?, ?, ?)"
  ).bind(clinic_id, patients.length, newCount, updatedCount, errorCount).run()

  return c.json({ success: true, total: patients.length, new_count: newCount, updated_count: updatedCount, error_count: errorCount })
})

app.post('/api/sync/payments', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { clinic_id, payments: paymentList } = body
  if (!clinic_id || !paymentList || !Array.isArray(paymentList)) return c.json({ error: 'clinic_id와 payments 배열이 필요합니다.' }, 400)

  // Get settings
  const settings = await c.env.DB.prepare('SELECT * FROM clinic_settings WHERE clinic_id = ?').bind(clinic_id).first()
  let catRates: any[] = []
  let defaultRate = 5
  if (settings) {
    try { catRates = JSON.parse(settings.category_rates as string || '[]') } catch {}
    defaultRate = settings.default_point_rate as number || 5
  }

  let newCount = 0, skippedCount = 0, errorCount = 0

  for (const pay of paymentList) {
    try {
      const { dentweb_receipt_id, patient_dentweb_id, patient_chart_number, patient_phone, amount, category, payment_date, payment_method, description } = pay
      if (!amount || amount <= 0) { skippedCount++; continue }

      // Skip if already imported (by dentweb_receipt_id)
      if (dentweb_receipt_id) {
        const existing = await c.env.DB.prepare('SELECT id FROM payments WHERE dentweb_receipt_id = ? AND clinic_id = ?').bind(String(dentweb_receipt_id), clinic_id).first()
        if (existing) { skippedCount++; continue }
      }

      // Find patient
      let patient: any = null
      if (patient_dentweb_id) patient = await c.env.DB.prepare("SELECT * FROM members WHERE dentweb_id = ? AND role = 'patient'").bind(String(patient_dentweb_id)).first()
      if (!patient && patient_chart_number) {
        patient = await c.env.DB.prepare("SELECT m.* FROM members m JOIN patient_clinic pc ON m.id = pc.patient_id WHERE m.chart_number = ? AND pc.clinic_id = ? AND m.role = 'patient'").bind(patient_chart_number, clinic_id).first()
      }
      if (!patient && patient_phone) patient = await c.env.DB.prepare("SELECT * FROM members WHERE phone = ? AND role = 'patient'").bind(patient_phone).first()
      if (!patient) { errorCount++; continue }

      // Calculate points
      const catRate = catRates.find((r: any) => r.category === (category || '일반진료'))
      const rate = catRate ? catRate.rate : defaultRate
      const pointEarned = Math.floor(amount * (rate / 100))

      await c.env.DB.prepare(`
        INSERT INTO payments (clinic_id, patient_id, amount, category, description, point_rate, point_earned, payment_date, input_type, payment_method, dentweb_receipt_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'auto', ?, ?)
      `).bind(clinic_id, patient.id, amount, category || '일반진료', description || null, rate, pointEarned, payment_date || getKSTDate(), payment_method || null, dentweb_receipt_id ? String(dentweb_receipt_id) : null).run()

      // Update points
      if (pointEarned > 0) {
        const pc = await c.env.DB.prepare('SELECT * FROM patient_clinic WHERE patient_id = ? AND clinic_id = ?').bind(patient.id, clinic_id).first()
        if (pc) {
          await c.env.DB.prepare("UPDATE patient_clinic SET total_points = total_points + ?, updated_at = datetime('now') WHERE id = ?").bind(pointEarned, pc.id).run()
          // Auto-issue coupons for sync payments too
          await checkAndAutoIssueCoupons(c.env.DB, clinic_id, patient.id, null)
        }
      }

      // Update last_treatment on member
      if (category) {
        await c.env.DB.prepare("UPDATE members SET last_treatment = ?, updated_at = datetime('now') WHERE id = ?").bind(category, patient.id).run()
      }

      newCount++
    } catch (e) {
      errorCount++
    }
  }

  // Log sync
  await c.env.DB.prepare(
    "INSERT INTO sync_logs (clinic_id, sync_type, source, total_rows, new_rows, updated_rows, error_rows) VALUES (?, 'payments', 'dentweb', ?, ?, ?, ?)"
  ).bind(clinic_id, paymentList.length, newCount, skippedCount, errorCount).run()

  return c.json({ success: true, total: paymentList.length, new_count: newCount, skipped_count: skippedCount, error_count: errorCount })
})

app.post('/api/sync/visits', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { clinic_id, visits } = body
  if (!clinic_id || !visits || !Array.isArray(visits)) return c.json({ error: 'clinic_id와 visits 배열이 필요합니다.' }, 400)

  let updatedCount = 0
  for (const visit of visits) {
    try {
      const { dentweb_id, chart_number, visit_date } = visit
      let patient: any = null
      if (dentweb_id) patient = await c.env.DB.prepare("SELECT * FROM members WHERE dentweb_id = ? AND role = 'patient'").bind(String(dentweb_id)).first()
      if (!patient && chart_number) {
        patient = await c.env.DB.prepare("SELECT m.* FROM members m JOIN patient_clinic pc ON m.id = pc.patient_id WHERE m.chart_number = ? AND pc.clinic_id = ? AND m.role = 'patient'").bind(chart_number, clinic_id).first()
      }
      if (patient && visit_date) {
        await c.env.DB.prepare("UPDATE members SET last_visit_date = ?, updated_at = datetime('now') WHERE id = ?").bind(visit_date, patient.id).run()
        updatedCount++
      }
    } catch {}
  }

  return c.json({ success: true, updated_count: updatedCount })
})

// ==================== SETUP CODE (DentWeb 연동 코드) ====================
// Generate setup code
app.post('/api/setup/code', authMiddleware, async (c) => {
  const member = c.get('member')
  const body = await c.req.json().catch(() => ({}))
  const { clinic_id } = body
  if (!clinic_id) return c.json({ error: 'clinic_id 필요' }, 400)

  // Expire old active codes for this clinic
  await c.env.DB.prepare(
    "UPDATE setup_codes SET status = 'expired' WHERE clinic_id = ? AND status = 'active'"
  ).bind(clinic_id).run()

  // Generate 6-digit alphanumeric code (easy to type)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]

  // Expires in 30 minutes
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

  await c.env.DB.prepare(
    'INSERT INTO setup_codes (clinic_id, code, created_by, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(clinic_id, code, member.id, expiresAt).run()

  return c.json({ code, expires_at: expiresAt, expires_in_minutes: 30 })
})

// Verify setup code (PUBLIC - no auth required, called by bridge program)
app.get('/api/setup/verify/:code', async (c) => {
  const code = c.req.param('code').toUpperCase()

  const setupCode = await c.env.DB.prepare(
    "SELECT * FROM setup_codes WHERE code = ? AND status = 'active'"
  ).bind(code).first()

  if (!setupCode) {
    return c.json({ error: '유효하지 않은 연동 코드입니다. 코드를 다시 확인해주세요.' }, 404)
  }

  // Check expiry
  if (new Date(setupCode.expires_at as string) < new Date()) {
    await c.env.DB.prepare("UPDATE setup_codes SET status = 'expired' WHERE id = ?").bind(setupCode.id).run()
    return c.json({ error: '만료된 연동 코드입니다. 새 코드를 생성해주세요.' }, 410)
  }

  // Get clinic info
  const clinic = await c.env.DB.prepare('SELECT * FROM clinics WHERE id = ?').bind(setupCode.clinic_id).first()
  if (!clinic) return c.json({ error: '치과 정보를 찾을 수 없습니다.' }, 404)

  // Get the OWNER of this clinic (not the code creator, who may be staff)
  const owner = await c.env.DB.prepare(
    `SELECT m.* FROM members m 
     JOIN clinic_admins ca ON m.id = ca.member_id 
     WHERE ca.clinic_id = ? AND ca.admin_role = 'owner' 
     LIMIT 1`
  ).bind(setupCode.clinic_id).first()
  // Fallback to code creator if no owner found
  const admin = owner || await c.env.DB.prepare('SELECT * FROM members WHERE id = ?').bind(setupCode.created_by).first()

  return c.json({
    valid: true,
    clinic_id: setupCode.clinic_id,
    clinic_name: clinic.name,
    api_url: 'https://dental-point.pages.dev/api',
    admin_phone: admin?.phone || '',
    expires_at: setupCode.expires_at
  })
})

// Activate setup code (called by bridge after successful connection)
app.post('/api/setup/activate/:code', async (c) => {
  const code = c.req.param('code').toUpperCase()

  const setupCode = await c.env.DB.prepare(
    "SELECT * FROM setup_codes WHERE code = ? AND status = 'active'"
  ).bind(code).first()

  if (!setupCode) {
    return c.json({ error: '유효하지 않은 연동 코드입니다.' }, 404)
  }

  if (new Date(setupCode.expires_at as string) < new Date()) {
    await c.env.DB.prepare("UPDATE setup_codes SET status = 'expired' WHERE id = ?").bind(setupCode.id).run()
    return c.json({ error: '만료된 연동 코드입니다.' }, 410)
  }

  // Mark as used
  await c.env.DB.prepare(
    "UPDATE setup_codes SET status = 'used', used_at = datetime('now') WHERE id = ?"
  ).bind(setupCode.id).run()

  return c.json({ success: true, message: '연동이 완료되었습니다.' })
})

// Get active setup code for a clinic (for display in UI)
app.get('/api/setup/active', authMiddleware, async (c) => {
  const clinicId = c.req.query('clinic_id')
  if (!clinicId) return c.json({ error: 'clinic_id 필요' }, 400)

  const activeCode = await c.env.DB.prepare(
    "SELECT * FROM setup_codes WHERE clinic_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1"
  ).bind(clinicId).first()

  if (!activeCode || new Date(activeCode.expires_at as string) < new Date()) {
    if (activeCode) {
      await c.env.DB.prepare("UPDATE setup_codes SET status = 'expired' WHERE id = ?").bind(activeCode.id).run()
    }
    return c.json({ active: false })
  }

  const remainingMs = new Date(activeCode.expires_at as string).getTime() - Date.now()
  return c.json({
    active: true,
    code: activeCode.code,
    expires_at: activeCode.expires_at,
    remaining_seconds: Math.floor(remainingMs / 1000)
  })
})

// Coupon revoke endpoint
app.post('/api/coupons/:code/share', authMiddleware, async (c) => {
  const code = c.req.param('code').replace(/[^a-zA-Z0-9-]/g, '').toUpperCase()
  const formattedCode = code.includes('-') ? code : code.substring(0,4) + '-' + code.substring(4)
  
  await c.env.DB.prepare("UPDATE coupons SET shared_at = datetime('now') WHERE code = ? OR code = ?")
    .bind(code, formattedCode).run()
    
  return c.json({ success: true })
})

app.post('/api/coupons/:code/revoke', authMiddleware, async (c) => {
  const code = c.req.param('code')
  const coupon = await c.env.DB.prepare(
    "SELECT c.*, t.required_points, t.name as template_name FROM coupons c JOIN coupon_templates t ON c.template_id = t.id WHERE c.code = ? AND c.status = 'active'"
  ).bind(code).first()
  if (!coupon) return c.json({ error: '활성 상태의 쿠폰을 찾을 수 없습니다.' }, 404)
  
  await c.env.DB.prepare(
    "UPDATE coupons SET status = 'revoked' WHERE id = ?"
  ).bind(coupon.id).run()

  const reqPts = Number(coupon.required_points) || 0
  if (reqPts > 0) {
    await c.env.DB.prepare(
      "UPDATE patient_clinic SET used_points = used_points - ?, updated_at = datetime('now') WHERE patient_id = ? AND clinic_id = ?"
    ).bind(reqPts, coupon.patient_id, coupon.clinic_id).run()
    
    const pc = await c.env.DB.prepare('SELECT total_points, used_points FROM patient_clinic WHERE patient_id = ? AND clinic_id = ?').bind(coupon.patient_id, coupon.clinic_id).first()
    if (pc) {
      await c.env.DB.prepare(
        "INSERT INTO point_logs (clinic_id, patient_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(coupon.clinic_id, coupon.patient_id, 'earn', reqPts, Number(pc.total_points) - Number(pc.used_points), '쿠폰 회수 환불: ' + coupon.template_name).run().catch(()=>{})
    }
  }

  return c.json({ success: true })
})

// Sync status endpoint
app.get('/api/sync/status', async (c) => {
  const clinicId = c.req.query('clinic_id')
  if (!clinicId) return c.json({ error: 'clinic_id 필요' }, 400)
  const logs = await c.env.DB.prepare(
    'SELECT * FROM sync_logs WHERE clinic_id = ? ORDER BY created_at DESC LIMIT 20'
  ).bind(clinicId).all()
  
  const lastSync = await c.env.DB.prepare(
    'SELECT * FROM sync_logs WHERE clinic_id = ? ORDER BY created_at DESC LIMIT 1'
  ).bind(clinicId).first()

  const dentwebPatients = await c.env.DB.prepare(`
    SELECT COUNT(*) as cnt FROM members m JOIN patient_clinic pc ON m.id = pc.patient_id
    WHERE pc.clinic_id = ? AND m.dentweb_id IS NOT NULL AND m.role = 'patient'
  `).bind(clinicId).first()

  return c.json({
    last_sync: lastSync,
    dentweb_patients: dentwebPatients?.cnt || 0,
    sync_logs: logs.results || []
  })
})

// ==================== STATIC & HTML ====================
app.get('/', async (c) => {
  return c.html(adminHtml())
})

app.get('/scan', async (c) => {
  return c.html(scanHtml())
})

// ==================== COUPON PAGE (for sharing via KakaoTalk etc.) ====================
app.get('/coupon/:code', async (c) => {
  const code = c.req.param('code')
  let coupon: any = null
  try {
    coupon = await c.env.DB.prepare(`
      SELECT c.*, ct.name as template_name, ct.discount_type, ct.discount_value, ct.image_url, ct.is_birthday,
             ct.description as template_description,
             m.name as patient_name, m.phone as patient_phone,
             cl.name as clinic_name, cl.phone as clinic_phone
      FROM coupons c
      JOIN coupon_templates ct ON c.template_id = ct.id
      JOIN members m ON c.patient_id = m.id
      JOIN clinics cl ON c.clinic_id = cl.id
      WHERE c.code = ?
    `).bind(code).first()
  } catch (e) {}

  if (!coupon) {
    return c.html(couponPageHtml(null, code))
  }
  return c.html(couponPageHtml(coupon, code))
})

// Dynamic OG image for coupon (SVG rendered as image)
app.get('/api/og/coupon/:code/image.svg', async (c) => {
  const code = c.req.param('code')
  let clinicName = 'Dental Point'
  let templateName = '쿠폰'
  try {
    const coupon: any = await c.env.DB.prepare(`
      SELECT ct.name as template_name, cl.name as clinic_name
      FROM coupons c
      JOIN coupon_templates ct ON c.template_id = ct.id
      JOIN clinics cl ON c.clinic_id = cl.id
      WHERE c.code = ?
    `).bind(code).first()
    if (coupon) {
      clinicName = coupon.clinic_name || clinicName
      templateName = coupon.template_name || templateName
    }
  } catch (e) {}

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e3a8a;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#2563eb;stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="800" height="400" fill="url(#bg)" />
  <circle cx="700" cy="50" r="150" fill="white" fill-opacity="0.05"/>
  <circle cx="100" cy="350" r="120" fill="white" fill-opacity="0.05"/>
  <circle cx="400" cy="200" r="250" fill="white" fill-opacity="0.02"/>
  
  <text x="400" y="160" text-anchor="middle" font-family="sans-serif" font-size="24" letter-spacing="4" font-weight="bold" fill="#93c5fd">SPECIAL BENEFIT</text>
  <text x="400" y="230" text-anchor="middle" font-family="sans-serif" font-size="64" font-weight="bold" fill="#ffffff">GIFT COUPON</text>
  <text x="400" y="320" text-anchor="middle" font-family="sans-serif" font-size="16" letter-spacing="2" fill="#dbeafe">DENTAL POINT</text>
</svg>`

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    }
  })
})

// Coupon use by code (GET to check, PUT to use)
app.get('/api/coupons/check/:code', async (c) => {
  const code = c.req.param('code').replace(/[^a-zA-Z0-9-]/g, '').toUpperCase()
  // Add hyphen if missing (e.g. ABCDEFGH -> ABCD-EFGH)
  const formattedCode = code.includes('-') ? code : code.substring(0,4) + '-' + code.substring(4)
  
  const coupon = await c.env.DB.prepare(`
    SELECT c.*, ct.name as template_name, ct.discount_type, ct.discount_value, ct.image_url, ct.is_birthday,
           m.name as patient_name, m.phone as patient_phone,
           cl.name as clinic_name
    FROM coupons c
    JOIN coupon_templates ct ON c.template_id = ct.id
    JOIN members m ON c.patient_id = m.id
    JOIN clinics cl ON c.clinic_id = cl.id
    WHERE c.code = ? OR c.code = ?
  `).bind(code, formattedCode).first()
  if (!coupon) return c.json({ error: '쿠폰을 찾을 수 없습니다.' }, 404)
  return c.json({ coupon })
})

app.post('/api/coupons/use/:code', async (c) => {
  const code = c.req.param('code').replace(/[^a-zA-Z0-9-]/g, '').toUpperCase()
  const formattedCode = code.includes('-') ? code : code.substring(0,4) + '-' + code.substring(4)
  
  const coupon = await c.env.DB.prepare(
    "SELECT * FROM coupons WHERE (code = ? OR code = ?) AND status = 'active'"
  ).bind(code, formattedCode).first()
  if (!coupon) return c.json({ error: '유효하지 않은 쿠폰이거나 이미 사용된 쿠폰입니다.' }, 400)
  // Check expiry
  const today = getKSTDate()
  if ((coupon.expires_at as string) < today) {
    await c.env.DB.prepare("UPDATE coupons SET status = 'expired' WHERE id = ?").bind(coupon.id).run()
    return c.json({ error: '만료된 쿠폰입니다.' }, 400)
  }
  await c.env.DB.prepare("UPDATE coupons SET status = 'used', used_at = ? WHERE id = ?").bind(new Date().toISOString(), coupon.id).run()
  const template = await c.env.DB.prepare('SELECT * FROM coupon_templates WHERE id = ?').bind(coupon.template_id).first()
  const patient = await c.env.DB.prepare('SELECT name FROM members WHERE id = ?').bind(coupon.patient_id).first()
  return c.json({
    success: true,
    coupon: {
      code,
      template_name: template?.name,
      discount_type: template?.discount_type,
      discount_value: template?.discount_value,
      patient_name: patient?.name
    }
  })
})

// Serve widget-imweb.js directly from public/ (no more redirect to dpt-widget.pages.dev)
// The file is served automatically by Cloudflare Pages static asset handling from public/widget-imweb.js

function adminHtml() {
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" href="/favicon.ico" type="image/svg+xml">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap');
    body { font-family: 'Noto Sans KR', sans-serif; }
    .dpt-fade-in { animation: dptFadeIn 0.3s ease-in-out; }
    @keyframes dptFadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    .dpt-toast { position:fixed;top:20px;right:20px;z-index:9999;animation:dptSlideIn 0.3s ease }
    @keyframes dptSlideIn { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
  </style><title>포인트 관리 시스템</title></head>
<body class="bg-gray-50 min-h-screen"><div id="dpt-admin-app"></div><script src="/static/admin.js?v=${Date.now()}"></script></body></html>`
}

function scanHtml() {
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>쿠폰 사용</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap');
    body { font-family: 'Noto Sans KR', sans-serif; background-color: #1f2937; }
    .scan-tab {
      transition: all 0.2s ease-in-out;
    }
    .scan-tab.active {
      color: #2563eb;
      border-bottom: 2px solid #2563eb;
      font-weight: 600;
    }
    .scan-tab.inactive {
      color: #94a3b8;
      border-bottom: 2px solid transparent;
    }
    #reader {
      min-height: 350px;
      width: 100%;
      border: none !important;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      position: relative;
      background-color: #000;
    }
    #reader video {
      object-fit: cover !important;
      width: 100% !important;
      height: 100% !important;
    }

  </style>
</head><body class="min-h-screen">
  <div id="scan-app" class="max-w-md mx-auto bg-white min-h-screen shadow-sm">
    <!-- Header -->
    <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 z-10 bg-white">
      <h1 class="text-xl font-bold text-gray-800 tracking-tight">쿠폰 사용</h1>
      <span class="text-xs font-medium text-gray-400 uppercase tracking-wider">DENTAL POINT</span>
    </div>

    <!-- Tab Navigation -->
    <div class="bg-white border-b border-gray-100 relative z-20">
      <div class="flex px-2">
        <button data-tab="camera" class="scan-tab active flex-1 py-3.5 text-sm text-center">QR 카메라</button>
        <button data-tab="search" class="scan-tab inactive flex-1 py-3.5 text-sm text-center">환자 검색</button>
        <button data-tab="code" class="scan-tab inactive flex-1 py-3.5 text-sm text-center">코드 입력</button>
      </div>
    </div>

    <!-- Camera Tab -->
    <div id="tab-camera" class="scan-content p-4">
      <div class="bg-gray-50 rounded-2xl p-2 mb-4">
        <div id="reader"></div>
      </div>
      <div class="text-center px-4">
        <p class="text-[15px] font-medium text-gray-700 mb-1" id="scan-hint">QR 코드를 사각형 안에 맞춰주세요</p>
        <p class="text-[13px] text-gray-500">인식 시 자동으로 쿠폰이 조회됩니다</p>
      </div>
    </div>

    <!-- Search Tab -->
    <div id="tab-search" class="scan-content hidden p-5 space-y-5">
      <div class="space-y-3">
        <label class="block text-sm font-medium text-gray-700">환자 정보 검색</label>
        <div class="flex gap-2">
          <input id="search-input" type="text" placeholder="이름 또는 전화번호 뒷자리" class="flex-1 px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-[15px] focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" />
          <button id="search-btn" class="px-6 py-3.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-[15px] font-medium transition">검색</button>
        </div>
      </div>
      <div id="search-results" class="space-y-3 pt-2"></div>
    </div>

    <!-- Code Tab -->
    <div id="tab-code" class="scan-content hidden p-5 space-y-5">
      <div class="space-y-4">
        <label class="block text-sm font-medium text-gray-700 text-center">쿠폰 코드 직접 입력</label>
        <input id="code-input" type="text" placeholder="XXXX-XXXX" maxlength="9" class="w-full px-4 py-5 bg-gray-50 border border-gray-200 rounded-2xl text-center text-2xl font-mono font-bold tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none uppercase transition shadow-sm" />
        <button id="code-submit" class="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-[15px] transition shadow-md shadow-blue-500/20">쿠폰 확인하기</button>
      </div>
    </div>

    <!-- Result Modal -->
    <div id="coupon-result" class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 hidden transition-opacity">
      <div class="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden transform transition-transform translate-y-full sm:translate-y-0" id="result-modal-panel">
        <div class="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3 sm:hidden"></div>
        <div id="result-content" class="p-6"></div>
      </div>
    </div>
  </div>

  <script src="https://unpkg.com/html5-qrcode" type="text/javascript"></script>
  <script>
  (function(){
    const API = '';
    let html5QrcodeScanner = null;

    // ── Tab switching ──────────────────────────────────────
    const tabs = document.querySelectorAll('.scan-tab');
    const contents = document.querySelectorAll('.scan-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        
        tabs.forEach(t => {
          t.classList.remove('active');
          t.classList.add('inactive');
        });
        tab.classList.remove('inactive');
        tab.classList.add('active');

        contents.forEach(c => c.classList.add('hidden'));
        document.getElementById('tab-' + target).classList.remove('hidden');

        if (target === 'camera') {
          startCamera();
        } else {
          stopCamera();
          if (target === 'search') document.getElementById('search-input').focus();
          if (target === 'code') document.getElementById('code-input').focus();
        }
      });
    });

    // ── Scanner Logic (html5-qrcode) ──────────────────────
    function startCamera() {
      if (html5QrcodeScanner) return; // already running
      
      try {
        // Use a relative qrbox size so it looks good on both mobile and desktop
        const config = {
          fps: 10,
          qrbox: function(viewfinderWidth, viewfinderHeight) {
            var minEdgePercentage = 0.7; // 70% of the screen width/height
            var minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
            var qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
            // Cap it for desktop
            return { width: Math.min(qrboxSize, 350), height: Math.min(qrboxSize, 350) };
          },
          aspectRatio: 1.0,
        };

        html5QrcodeScanner = new Html5Qrcode("reader");
        
        // Try environment camera first
        html5QrcodeScanner.start(
          { facingMode: "environment" },
          config,
          onScanSuccess,
          onScanFailure
        ).catch((err) => {
          console.error("Environment camera failed, trying user camera", err);
          // Fallback to user-facing camera (often works better on laptops)
          html5QrcodeScanner.start(
            { facingMode: "user" },
            config,
            onScanSuccess,
            onScanFailure
          ).catch((err2) => {
             console.error("User camera start error", err2);
             showCamError(err2.message);
          });
        });
      } catch (e) {
        console.error("Sync error starting camera", e);
        showCamError(e.message);
      }
    }
    
    function showCamError(msg) {
      document.getElementById('reader').innerHTML = 
          '<div class="p-8 text-center bg-red-50 rounded-xl"><div class="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div><p class="text-red-600 font-bold mb-1">카메라 오류</p><p class="text-xs text-red-400 break-all">' + msg + '</p><button onclick="startCamera()" class="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium">재시도</button></div>';
    }

    function stopCamera() {
      if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
          html5QrcodeScanner.clear();
          html5QrcodeScanner = null;
        }).catch(err => {
          console.error("Failed to stop camera", err);
        });
      }
    }

    let isProcessing = false;
    function onScanSuccess(decodedText, decodedResult) {
      if (isProcessing) return;
      isProcessing = true;
      
      // haptic feedback if available
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(100);
      }

      let code = decodedText.trim();
      const urlMatch = code.match(new RegExp('coupon/([A-Z0-9]{4}-[A-Z0-9]{4})', 'i'));
      if (urlMatch) code = urlMatch[1];
      const codeMatch = code.match(/^([A-Z0-9]{4}-?[A-Z0-9]{4})$/i);
      if (codeMatch) {
        const c = codeMatch[1].toUpperCase();
        const formatted = c.includes('-') ? c : c.substring(0,4)+'-'+c.substring(4);
        document.getElementById('scan-hint').textContent = '인식 완료: ' + formatted;
        document.getElementById('scan-hint').className = 'text-[15px] font-bold text-blue-600 mb-1';
        
        // Stop scanning temporarily
        stopCamera();
        checkCoupon(formatted);
      } else {
        isProcessing = false;
      }
    }

    function onScanFailure(error) {
      // keep scanning
    }

    // ── API 호출 ───────────────────────────────────────────
    async function checkCoupon(code) {
      try {
        const res  = await fetch(API+'/api/coupons/check/'+code);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '쿠폰 조회 실패');

        showResultModal(data.coupon, code);
      } catch (err) {
        console.error('Coupon check error:', err);
        showErrorModal(err.message, code);
      }
    }

    async function useCoupon(code) {
      try {
        const btn = document.getElementById('btn-use-coupon');
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<span class="animate-pulse">처리중...</span>';
        }
        const res = await fetch(API+'/api/coupons/use/'+code, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '쿠폰 사용 처리 실패');

        // Custom alert logic instead of native alert
        const modalContent = document.querySelector('#result-modal > div');
        if (modalContent) {
          modalContent.innerHTML = '<div class="text-center py-6"><div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></div><h3 class="text-xl font-bold text-gray-800 mb-2">사용 완료</h3><p class="text-sm text-gray-500">쿠폰이 성공적으로 사용 처리되었습니다.</p></div>';
          setTimeout(() => { closeResultModal(); }, 2000);
        } else {
          closeResultModal();
        }
        
        // Always attempt to refresh parent window (admin/widget) if possible
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage({ type: 'coupon_used', code: code }, '*');
          } catch(e) {}
        }
        
        // Also broadcast via BroadcastChannel for same-origin tabs (admin panel, widget)
        if (window.BroadcastChannel) {
          const bc = new BroadcastChannel('dental-point-events');
          bc.postMessage({ type: 'coupon_used', code: code });
        }
        
        if (window.currentPatientId && window.currentPatientName) {
          window.searchCoupons(window.currentPatientId, window.currentPatientName);
        } else {
          const searchInput = document.getElementById('search-input');
          if (searchInput && searchInput.value.trim()) {
            document.getElementById('search-btn')?.click();
          }
        }
      } catch (err) {
        alert('오류: ' + err.message);
        if (btn) {
          btn.disabled = false;
          btn.textContent = '이 쿠폰 사용하기';
        }
      }
    }

    // ── Patient Search ─────────────────────────────────────
    document.getElementById('search-btn').addEventListener('click', async () => {
      const q = document.getElementById('search-input').value.trim();
      if (!q) return alert('이름이나 전화번호를 입력하세요.');
      const resContainer = document.getElementById('search-results');
      resContainer.innerHTML = '<div class="text-center py-4 text-gray-500 text-sm">검색 중...</div>';
      try {
        const token = localStorage.getItem('dpt_admin_token') || localStorage.getItem('dpt_token');
        const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
        
        const res = await fetch(API+'/api/patients?q='+encodeURIComponent(q), { headers });
        const data = await res.json();
        if (res.status === 401) throw new Error('관리자 로그인이 필요합니다. 관리자 페이지에서 로그인해주세요.');
        if (!res.ok) throw new Error(data.error || '검색 실패');

        if (data.data.length === 0) {
          resContainer.innerHTML = '<div class="text-center py-8 text-gray-500 bg-gray-50 rounded-xl">검색 결과가 없습니다</div>';
          return;
        }

        let html = '';
        data.data.forEach(p => {
          html += '<div class="p-4 border border-gray-100 rounded-xl bg-white shadow-sm flex items-center justify-between">';
          html += '  <div>';
          html += '    <div class="font-bold text-gray-800 text-[15px]">' + p.name + '</div>';
          html += '    <div class="text-[13px] text-gray-500 mt-0.5">' + p.phone + '</div>';
          html += '  </div>';
          html += '  <button onclick="window.searchCoupons(&quot;' + p.id + '&quot;, &quot;' + p.name + '&quot;)" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition">선택</button>';
          html += '</div>';
        });
        resContainer.innerHTML = html;
      } catch (err) {
        resContainer.innerHTML = '<div class="p-4 bg-red-50 text-red-600 text-sm rounded-xl">' + err.message + '</div>';
      }
    });

    
    window.searchCoupons = async function(patientId, patientName) {
      window.currentPatientId = patientId;
      window.currentPatientName = patientName;
      const resContainer = document.getElementById('search-results');
      resContainer.innerHTML = '<div class="text-center py-4 text-gray-500 text-sm">쿠폰 조회 중...</div>';
      try {
        const token = localStorage.getItem('dpt_admin_token') || localStorage.getItem('dpt_token');
        const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
        
        const res = await fetch(API+'/api/coupons/my?patient_id='+patientId, { headers });
        const data = await res.json();
        
        if (res.status === 401) throw new Error('관리자 로그인이 필요합니다. 관리자 페이지에서 로그인해주세요.');
        if (!res.ok) throw new Error(data.error || '조회 실패');

        if (!data.coupons || data.coupons.length === 0) {
          resContainer.innerHTML = '<div class="text-center py-8 text-gray-500 bg-gray-50 rounded-xl">사용 가능한 쿠폰이 없습니다.</div>';
          return;
        }

        let html = '<div class="text-sm font-bold text-gray-700 mb-2">' + patientName + '님의 보유 쿠폰</div>';
        data.coupons.forEach(c => {
          const exp = c.expires_at ? c.expires_at.substring(0,10) : '제한없음';
          const isActive = c.status === 'active';
          const isUsed = c.status === 'used';
          const isExpired = c.status === 'expired' || (!isActive && !isUsed);
          
          const bgClass = isActive ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-200 opacity-80';
          const titleColor = isActive ? 'text-blue-800' : 'text-gray-600 line-through';
          const codeColor = isActive ? 'text-blue-600' : 'text-gray-400';
          const btnClass = isActive 
            ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer' 
            : 'bg-gray-200 text-gray-500 cursor-not-allowed';
          const btnText = isActive ? '사용' : (isUsed ? '사용완료' : '만료');
          const btnAttr = isActive ? 'onclick="checkCoupon(&quot;' + c.code + '&quot;)"' : 'disabled';
          
          html += '<div class="p-4 border ' + bgClass + ' rounded-xl shadow-sm flex items-center justify-between mb-3">';
          html += '  <div>';
          const bdBadge = '';
          html += '    <div class="font-bold ' + titleColor + ' text-[15px] mb-1 flex items-center">' + c.template_name + bdBadge + '</div>';
          html += '    <div class="text-[12px] ' + codeColor + ' font-mono">' + c.code + '</div>';
          html += '    <div class="text-[11px] text-gray-500 mt-1">유효기간: ' + exp + '</div>';
          html += '  </div>';
          html += '  <button ' + btnAttr + ' class="px-4 py-2 ' + btnClass + ' text-sm font-medium rounded-lg transition">' + btnText + '</button>';
          html += '</div>';
        });
        
        // Add a back button
        html += '<button onclick="document.getElementById(&quot;search-btn&quot;).click()" class="w-full py-3 mt-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl">다시 검색</button>';
        
        resContainer.innerHTML = html;
      } catch (err) {
        resContainer.innerHTML = '<div class="p-4 bg-red-50 text-red-600 text-sm rounded-xl">' + err.message + '</div>';
      }
    };


    // ── Manual Code ────────────────────────────────────────
    const codeInput = document.getElementById('code-input');
    codeInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (val.length > 4) val = val.substring(0,4) + '-' + val.substring(4,8);
      e.target.value = val;
    });
    
    document.getElementById('code-submit').addEventListener('click', () => {
      const code = codeInput.value;
      if (code.length === 9) checkCoupon(code);
      else alert('정확한 8자리 코드를 입력해주세요.');
    });

    // ── Modal UI ──────────────────────────────────────────
    function showResultModal(coupon, code) {
      const modal = document.getElementById('coupon-result');
      const panel = document.getElementById('result-modal-panel');
      const content = document.getElementById('result-content');
      
      const isExpired = new Date(coupon.expires_at) < new Date();
      const canUse = coupon.status === 'active' && !isExpired;

      let statusBadge = '';
      if (coupon.status === 'used') {
        statusBadge = '<span class="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">이미 사용됨</span>';
      } else if (isExpired) {
        statusBadge = '<span class="inline-block px-3 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-full">기간 만료</span>';
      } else if (coupon.status === 'active') {
        statusBadge = '<span class="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full animate-pulse">사용 가능</span>';
      } else {
        statusBadge = '<span class="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">' + coupon.status + '</span>';
      }

      let btnHtml = canUse ? 
        '<button id="btn-use-coupon" onclick="useCoupon(&quot;' + code + '&quot;)" class="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[16px] font-bold shadow-lg shadow-blue-500/30 transition transform hover:-translate-y-0.5">이 쿠폰 사용하기</button>' : 
        '<button onclick="closeResultModal()" class="w-full py-4 bg-gray-100 text-gray-700 rounded-xl text-[16px] font-bold transition">닫기</button>';

      let expStr = coupon.expires_at ? coupon.expires_at.substring(0,10) : '제한없음';

      content.innerHTML = 
        '<div class="flex justify-between items-start mb-6">' +
        '  <h2 class="text-xl font-bold text-gray-800">쿠폰 정보</h2>' +
        '  <button onclick="closeResultModal()" class="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-full transition bg-gray-50 hover:bg-gray-100">' +
        '    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>' +
        '  </button>' +
        '</div>' +
        '<div class="bg-gray-50 rounded-2xl p-5 mb-6 text-center border border-gray-100">' +
        '  <div class="text-xs text-gray-500 mb-2 font-medium tracking-wide uppercase">COUPON CODE</div>' +
        '  <div class="text-3xl font-mono font-bold tracking-widest text-gray-800 mb-3">' + code + '</div>' +
        '  ' + statusBadge +
        '</div>' +
        '<div class="space-y-4 mb-8">' +
        '  <div class="flex justify-between items-center py-2 border-b border-gray-100">' +
        '    <span class="text-[15px] text-gray-500">환자명</span>' +
        '    <span class="text-[16px] font-semibold text-gray-800">' + (coupon.patient_name || '') + '</span>' +
        '  </div>' +
        '  <div class="flex justify-between items-center py-2 border-b border-gray-100">' +
        '    <span class="text-[15px] text-gray-500">연락처</span>' +
        '    <span class="text-[16px] font-semibold text-gray-800">' + (coupon.patient_phone || '') + '</span>' +
        '  </div>' +
        '  <div class="flex justify-between items-center py-2 border-b border-gray-100">' +
        '    <span class="text-[15px] text-gray-500">유효기간</span>' +
        '    <span class="text-[16px] font-semibold text-gray-800">' + expStr + '</span>' +
        '  </div>' +
        '</div>' + btnHtml;

      modal.classList.remove('hidden');
      void panel.offsetWidth;
      panel.classList.remove('translate-y-full');
      panel.classList.add('translate-y-0');
    }

    function showErrorModal(msg, code) {
      const modal = document.getElementById('coupon-result');
      const panel = document.getElementById('result-modal-panel');
      const content = document.getElementById('result-content');
      
      content.innerHTML = 
        '<div class="text-center p-4">' +
        '  <div class="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">' +
        '    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>' +
        '  </div>' +
        '  <h2 class="text-xl font-bold text-gray-800 mb-2">조회 실패</h2>' +
        '  <p class="text-gray-600 text-[15px] mb-6">' + msg + '</p>' +
        '  <button onclick="closeResultModal()" class="w-full py-3.5 bg-gray-800 text-white rounded-xl font-medium transition">다시 시도</button>' +
        '</div>';

      modal.classList.remove('hidden');
      void panel.offsetWidth;
      panel.classList.remove('translate-y-full');
      panel.classList.add('translate-y-0');
    }

    window.closeResultModal = function() {
      const modal = document.getElementById('coupon-result');
      const panel = document.getElementById('result-modal-panel');
      
      panel.classList.remove('translate-y-0');
      panel.classList.add('translate-y-full');
      
      setTimeout(() => {
        modal.classList.add('hidden');
        document.getElementById('scan-hint').textContent = 'QR 코드를 사각형 안에 맞춰주세요';
        document.getElementById('scan-hint').className = 'text-[15px] font-medium text-gray-700 mb-1';
        document.getElementById('code-input').value = '';
        isProcessing = false;
        
        const isCameraTab = document.querySelector('[data-tab="camera"]').classList.contains('active');
        if (isCameraTab) {
          startCamera();
        }
      }, 300);
    }

        window.addEventListener('load', () => {
      window.checkCoupon = checkCoupon;
      window.useCoupon = useCoupon;
      window.closeResultModal = closeResultModal;
      window.startCamera = startCamera;
      
      // Check if library loaded
      if (typeof Html5Qrcode === 'undefined') {
        document.getElementById('reader').innerHTML = '<div class="p-8 text-center text-red-500">카메라 라이브러리를 불러오지 못했습니다. 새로고침 해주세요.</div>';
        return;
      }
      startCamera();
    });

  })();
  </script>
</body></html>`;
}
function couponPageHtml(coupon: any, code: string) {
  const ogTitle = coupon
    ? `${coupon.clinic_name} - ${coupon.template_name}`
    : '쿠폰을 찾을 수 없습니다'
  const ogDescription = coupon
    ? `${coupon.patient_name}님께 발행된 쿠폰입니다.`
    : '유효하지 않은 쿠폰 코드입니다.'
  const ogImage = coupon ? (coupon.image_url || `https://dental-point.pages.dev/api/og/coupon/${code}/image.svg?v=${Date.now()}`) : 'https://dental-point.pages.dev/static/og-default.png'

  /* 쿠폰 없을 때 */
  if (!coupon) {
    return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>쿠폰을 찾을 수 없습니다 - Dental Point</title>
<meta property="og:type" content="website">
<meta property="og:title" content="${ogTitle}">
<meta property="og:description" content="${ogDescription}">
<meta property="og:image" content="https://dental-point.pages.dev/static/og-default.png">
<script src="https://cdn.tailwindcss.com"></script>
<style>body{font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;}</style>
</head><body class="bg-gray-100 min-h-screen flex items-center justify-center p-4">
<div class="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
  <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
    <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
  </div>
  <h1 class="text-lg font-bold text-gray-800 mb-2">쿠폰을 찾을 수 없습니다</h1>
  <p class="text-sm text-gray-400">이미 사용되었거나 유효하지 않은 쿠폰입니다.</p>
  <p class="text-xs text-gray-300 mt-2 font-mono">${code}</p>
</div></body></html>`
  }

  const isActive = coupon.status === 'active'
  const statusMap: Record<string, {label:string, bg:string, dot:string}> = {
    active:  { label:'사용 가능', bg:'#e0f2fe', dot:'#0ea5e9' },
    used:    { label:'사용 완료', bg:'#f3f4f6', dot:'#9ca3af' },
    expired: { label:'만료됨',   bg:'#fee2e2', dot:'#ef4444' },
    revoked: { label:'회수됨',   bg:'#fef3c7', dot:'#f59e0b' }
  }
  const st = statusMap[coupon.status] || { label: coupon.status, bg:'#f3f4f6', dot:'#9ca3af' }
  const maskedPhone = coupon.patient_phone
    ? coupon.patient_phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '-'
  const expiresAt = coupon.expires_at || '-'
  const couponUrl = `https://dental-point.pages.dev/coupon/${code}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(couponUrl)}`

  return `<!DOCTYPE html><html lang="ko"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>${coupon.template_name} | ${coupon.clinic_name}</title>
<meta property="og:type" content="website">
<meta property="og:title" content="${ogTitle}">
<meta property="og:description" content="${ogDescription}">
<meta property="og:url" content="${couponUrl}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="600">
<meta property="og:image:height" content="315">
<meta property="og:site_name" content="${coupon.clinic_name}">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${ogTitle}">
<meta name="twitter:description" content="${ogDescription}">
<meta name="twitter:image" content="${ogImage}">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:#f1f5f9;min-height:100vh}
.page{max-width:420px;margin:0 auto;padding:0 0 40px}
/* 헤더 */
.header{background:#fff;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #f1f5f9;position:sticky;top:0;z-index:10}
.header-clinic{font-size:15px;font-weight:700;color:#1e293b}
.header-brand{font-size:11px;color:#94a3b8;font-weight:500}
/* 쿠폰 카드 */
.coupon{background:#fff;margin:16px;border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)}
/* 쿠폰 상단: 썸네일 이미지 또는 그라디언트 */
.coupon-hero{background:linear-gradient(135deg,#1d4ed8 0%,#2563eb 60%,#3b82f6 100%);padding:28px 24px 24px;text-align:center;color:#fff;position:relative}
.coupon-hero-img{width:100%;height:180px;object-fit:cover;display:block}
.coupon-name{font-size:22px;font-weight:800;line-height:1.3;margin-bottom:6px}
.coupon-sub{font-size:13px;opacity:.8}
/* 상태 배지 */
.status-wrap{display:flex;justify-content:center;padding:16px 0 8px}
.status-badge{display:inline-flex;align-items:center;gap:6px;padding:7px 18px;border-radius:99px;font-size:13px;font-weight:700;background:${st.bg};color:${isActive ? '#0369a1' : '#374151'}}
.status-dot{width:8px;height:8px;border-radius:50%;background:${st.dot};${isActive ? 'animation:pulse 1.5s ease-in-out infinite' : ''}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
/* 구분선 (톱니) */
.divider{height:1px;margin:4px 0;border:none;border-top:2px dashed #e2e8f0;position:relative}
.divider::before,.divider::after{content:'';position:absolute;top:-13px;width:24px;height:24px;background:#f1f5f9;border-radius:50%}
.divider::before{left:-12px}.divider::after{right:-12px}
/* 상세 정보 */
.info{padding:16px 20px}
.info-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #f8fafc}
.info-row:last-child{border-bottom:none}
.info-label{font-size:12px;color:#94a3b8}
.info-value{font-size:13px;color:#1e293b;font-weight:500}
.info-code{font-family:monospace;font-size:13px;font-weight:800;color:#2563eb;letter-spacing:1px}
/* QR 섹션 */
.qr-section{padding:20px;text-align:center;border-top:1px solid #f1f5f9}
.qr-hint{font-size:11px;color:#94a3b8;margin-bottom:12px}
.qr-img{width:160px;height:160px;border-radius:12px;border:4px solid #f1f5f9}
.qr-code{font-size:11px;color:#64748b;font-family:monospace;margin-top:10px;letter-spacing:1px}
/* 하단 버튼 */
.action-wrap{padding:0 20px 16px}
.btn-primary{display:block;width:100%;padding:14px;background:#2563eb;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;text-align:center;cursor:pointer;font-family:inherit;text-decoration:none;margin-bottom:8px}
.btn-call{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:13px;background:#2563eb;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:8px}
.btn-notice{font-size:11px;color:#94a3b8;text-align:center;padding:4px 0 0}
/* 사용불가 상태 */
.used-overlay{background:#f8fafc;padding:16px 20px;text-align:center}
.used-text{font-size:13px;color:#94a3b8}
.footer{text-align:center;padding:24px 0 8px}
.footer p{font-size:11px;color:#cbd5e1}
</style>
</head>
<body>
<div class="page">
  <!-- 헤더 -->
  <div class="header">
    <span class="header-clinic">${coupon.clinic_name}</span>
    <span class="header-brand">Dental Point</span>
  </div>

  <!-- 쿠폰 카드 -->
  <div class="coupon">
    <!-- 히어로: 썸네일 있으면 이미지, 없으면 그라디언트 -->
    ${coupon.image_url
      ? `<img src="${coupon.image_url}" class="coupon-hero-img" alt="${coupon.template_name}" onerror="this.style.display='none';document.getElementById('hero-fallback').style.display='flex'" />
         <div id="hero-fallback" class="coupon-hero" style="display:none">
           <div class="coupon-name">${coupon.template_name}</div>
         </div>`
      : `<div class="coupon-hero">
           <div class="coupon-name">${coupon.template_name}</div>
         </div>`
    }

    <!-- 상태 배지 -->
    <div class="status-wrap">
      <div class="status-badge">
        <span class="status-dot"></span>
        ${st.label}
      </div>
    </div>

    <!-- QR 섹션 -->
    <div class="qr-section">
      <p class="qr-hint">직원에게 이 화면을 보여주세요</p>
      <img src="${qrUrl}" class="qr-img" alt="QR Code" />
      <p class="qr-code">${code}</p>
    </div>

    <hr class="divider" />

    <!-- 상세 정보 -->
    <div class="info">
      <div class="info-row">
        <span class="info-label">환자명</span>
        <span class="info-value">${coupon.patient_name}</span>
      </div>
      <div class="info-row">
        <span class="info-label">연락처</span>
        <span class="info-value">${maskedPhone}</span>
      </div>
      <div class="info-row">
        <span class="info-label">쿠폰 코드</span>
        <span class="info-code">${code}</span>
      </div>
      <div class="info-row">
        <span class="info-label">유효 기간</span>
        <span class="info-value">${expiresAt}</span>
      </div>
      <div class="info-row">
        <span class="info-label">발행 치과</span>
        <span class="info-value">${coupon.clinic_name}</span>
      </div>
    </div>

    <!-- 하단 액션 -->
    <div class="action-wrap">
      ${!isActive
        ? `<div class="used-overlay"><p class="used-text">${coupon.status === 'used' ? '이미 사용된 쿠폰입니다.' : coupon.status === 'expired' ? '유효기간이 만료된 쿠폰입니다.' : '사용할 수 없는 쿠폰입니다.'}</p></div>`
        : ''
      }
      ${coupon.clinic_phone
        ? `<a href="tel:${coupon.clinic_phone}" class="btn-call">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
             ${coupon.clinic_phone} 전화하기
           </a>`
        : ''
      }
    </div>
  </div>

  <div class="footer">
    <p>Dental Point 포인트 관리 시스템</p>
    <p>&copy; 2026 Dental Point. All rights reserved.</p>
  </div>
</div>
</body></html>`
}
// ==================== B2B SHOPPING MALL ====================

// 1. Get products list
app.get('/api/mall/products', async (c) => {
  const products = await c.env.DB.prepare(
    "SELECT p.*, v.name as vendor_name FROM products p LEFT JOIN vendors v ON p.vendor_id = v.id WHERE p.status = 'active' ORDER BY p.id ASC"
  ).all()
  return c.json({ products: products.results || [] })
})

// 2. Place an order (Bank Transfer)
app.post('/api/mall/orders', authMiddleware, async (c) => {
  const member = c.get('member')
  const body = await c.req.json().catch(() => ({}))
  const { clinic_id, items } = body // items: [{product_id, quantity, price}]
  
  if (!clinic_id || !items || !items.length) return c.json({ error: '필수값이 누락되었습니다.' }, 400)

  // Validate clinic access
  const ca = await c.env.DB.prepare('SELECT * FROM clinic_admins WHERE clinic_id = ? AND member_id = ?').bind(clinic_id, member.id).first()
  if (!ca) return c.json({ error: '권한이 없습니다.' }, 403)

  let total_amount = 0
  items.forEach((i: any) => { total_amount += (i.price * i.quantity) })

  // Generate unique order number (e.g. ORD-YYYYMMDD-XXXX)
  const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'')
  const rnd = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  const order_no = `ORD-${dateStr}-${rnd}`

  // Insert Order
  const orderRes = await c.env.DB.prepare(
    "INSERT INTO clinic_orders (clinic_id, order_no, total_amount, status, payment_method) VALUES (?, ?, ?, 'pending', 'bank_transfer')"
  ).bind(clinic_id, order_no, total_amount).run()
  
  const orderId = orderRes.meta.last_row_id

  // Insert Order Items
  for (const item of items) {
    await c.env.DB.prepare(
      "INSERT INTO clinic_order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)"
    ).bind(orderId, item.product_id, item.quantity, item.price).run()
  }

  // Return bank details
  return c.json({ 
    success: true, 
    order_no, 
    total_amount,
    bank_info: '국민은행 123-456-7890 (주)덴탈포인트'
  })
})

// 3. Get clinic inventory
app.get('/api/mall/inventory/:clinic_id', authMiddleware, async (c) => {
  const clinic_id = c.req.param('clinic_id')
  
  const inventory = await c.env.DB.prepare(`
    SELECT i.*, p.name, p.delivery_type, p.image_url 
    FROM clinic_inventory i
    JOIN products p ON i.product_id = p.id
    WHERE i.clinic_id = ?
  `).bind(clinic_id).all()
  
  return c.json({ inventory: inventory.results || [] })
})

// 4. Get clinic order history
app.get('/api/mall/orders/:clinic_id', authMiddleware, async (c) => {
  const clinic_id = c.req.param('clinic_id')
  const orders = await c.env.DB.prepare(`
    SELECT o.*, 
           (SELECT json_group_array(json_object('name', p.name, 'qty', oi.quantity, 'price', oi.price)) 
            FROM clinic_order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = o.id) as items
    FROM clinic_orders o
    WHERE o.clinic_id = ? 
    ORDER BY o.created_at DESC
  `).bind(clinic_id).all()
  return c.json({ orders: orders.results || [] })
})


// ==================== B2B MALL SUPER ADMIN ====================

// 1. Get all orders (Super Admin only - for now just checking if member has some role, but let's assume clinic_id=1 is HQ or we just return all for demo)
app.get('/api/mall/admin/orders', authMiddleware, async (c) => {
  // TODO: Add proper super-admin role check
  const orders = await c.env.DB.prepare(`
    SELECT o.*, c.name as clinic_name, 
           (SELECT json_group_array(json_object('name', p.name, 'qty', oi.quantity, 'price', oi.price)) 
            FROM clinic_order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = o.id) as items
    FROM clinic_orders o
    JOIN clinics c ON o.clinic_id = c.id
    ORDER BY o.created_at DESC
  `).all()
  return c.json({ orders: orders.results || [] })
})

// 2. Approve Order (Change status to 'paid' and increase inventory)
app.post('/api/mall/admin/orders/:id/approve', authMiddleware, async (c) => {
  const orderId = c.req.param('id')
  
  // Get order
  const order = await c.env.DB.prepare('SELECT * FROM clinic_orders WHERE id = ?').bind(orderId).first()
  if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404)
  if (order.status === 'paid') return c.json({ error: '이미 승인된 주문입니다.' }, 400)

  // Get items
  const items = await c.env.DB.prepare('SELECT * FROM clinic_order_items WHERE order_id = ?').bind(orderId).all()

  // Transaction-like (D1 doesn't support full transactions easily in single query without batch, so we do sequentially)
  await c.env.DB.prepare("UPDATE clinic_orders SET status = 'paid' WHERE id = ?").bind(orderId).run()

  for (const item of (items.results || [])) {
    // Upsert inventory
    const inv = await c.env.DB.prepare('SELECT id, quantity FROM clinic_inventory WHERE clinic_id = ? AND product_id = ?').bind(order.clinic_id, item.product_id).first()
    if (inv) {
      await c.env.DB.prepare('UPDATE clinic_inventory SET quantity = quantity + ?, updated_at = datetime("now") WHERE id = ?').bind(item.quantity, inv.id).run()
    } else {
      await c.env.DB.prepare('INSERT INTO clinic_inventory (clinic_id, product_id, quantity) VALUES (?, ?, ?)').bind(order.clinic_id, item.product_id, item.quantity).run()
    }
  }

  return c.json({ success: true })
})




// 3. Manage Products (Super Admin)
app.get('/api/mall/admin/products', authMiddleware, async (c) => {
  const products = await c.env.DB.prepare(
    "SELECT p.*, v.name as vendor_name FROM products p LEFT JOIN vendors v ON p.vendor_id = v.id ORDER BY p.id DESC"
  ).all()
  return c.json({ products: products.results || [] })
})

app.post('/api/mall/admin/products', authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { vendor_id, name, description, image_url, price, delivery_type, status } = body
  
  if (!name || !price) return c.json({ error: '상품명과 가격은 필수입니다.' }, 400)
  
  await c.env.DB.prepare(
    "INSERT INTO products (vendor_id, name, description, image_url, price, delivery_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(vendor_id || 1, name, description || '', image_url || '', price, delivery_type || 'stock', status || 'active').run()
  
  return c.json({ success: true })
})

app.put('/api/mall/admin/products/:id', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const { vendor_id, name, description, image_url, price, delivery_type, status } = body
  
  if (!name || !price) return c.json({ error: '상품명과 가격은 필수입니다.' }, 400)
  
  await c.env.DB.prepare(
    "UPDATE products SET vendor_id = ?, name = ?, description = ?, image_url = ?, price = ?, delivery_type = ?, status = ? WHERE id = ?"
  ).bind(vendor_id || 1, name, description || '', image_url || '', price, delivery_type || 'stock', status || 'active', id).run()
  
  return c.json({ success: true })
})


// ==================== B2B MALL DELIVERY (HQ) ====================

// 1. Get all delivery orders (Super Admin)
app.get('/api/mall/admin/deliveries', authMiddleware, async (c) => {
  const deliveries = await c.env.DB.prepare(`
    SELECT d.*, c.name as clinic_name, p.name as product_name, p.image_url, p.delivery_type
    FROM delivery_orders d
    JOIN clinics c ON d.clinic_id = c.id
    JOIN products p ON d.product_id = p.id
    ORDER BY d.created_at DESC
  `).all()
  return c.json({ deliveries: deliveries.results || [] })
})

// 2. Update tracking info
app.put('/api/mall/admin/deliveries/:id/tracking', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const { courier_company, tracking_number, status } = body
  
  await c.env.DB.prepare(`
    UPDATE delivery_orders 
    SET courier_company = ?, tracking_number = ?, status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(courier_company || null, tracking_number || null, status || 'shipping', id).run()
  
  return c.json({ success: true })
})

// ==================== B2B MALL DELIVERY (PATIENT/PUBLIC) ====================

// 1. Patient requests delivery (uses coupon)
app.post('/api/mall/delivery/request', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { coupon_code, receiver_name, phone, address } = body
  
  if (!coupon_code || !receiver_name || !phone || !address) {
    return c.json({ error: '필수 배송 정보가 누락되었습니다.' }, 400)
  }
  
  // Verify coupon and product
  const coupon = await c.env.DB.prepare(`
    SELECT c.*, t.product_id, p.delivery_type 
    FROM coupons c 
    JOIN coupon_templates t ON c.template_id = t.id 
    LEFT JOIN products p ON t.product_id = p.id
    WHERE c.code = ?
  `).bind(coupon_code).first()
  
  if (!coupon) return c.json({ error: '유효하지 않은 쿠폰입니다.' }, 404)
  if (coupon.status !== 'active') return c.json({ error: '이미 사용되었거나 만료된 쿠폰입니다.' }, 400)
  if (!coupon.product_id || coupon.delivery_type !== 'direct') {
    return c.json({ error: '배송 요청이 가능한 상품 쿠폰이 아닙니다.' }, 400)
  }
  
  const stmts = []
  // 1. Insert delivery order
  stmts.push(c.env.DB.prepare(`
    INSERT INTO delivery_orders (clinic_id, patient_id, coupon_id, product_id, receiver_name, phone, address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(coupon.clinic_id, coupon.patient_id, coupon.id, coupon.product_id, receiver_name, phone, address))
  
  // 2. Mark coupon as used
  stmts.push(c.env.DB.prepare(`
    UPDATE coupons SET status = 'used', updated_at = datetime('now') WHERE id = ?
  `).bind(coupon.id))
  
  await c.env.DB.batch(stmts)
  
  return c.json({ success: true })
})


// 3. Get deliveries for a patient
app.get('/api/mall/delivery/patient/:patient_id', async (c) => {
  const patient_id = c.req.param('patient_id')
  const deliveries = await c.env.DB.prepare(`
    SELECT d.*, p.name as product_name, p.image_url, c.name as clinic_name
    FROM delivery_orders d
    JOIN products p ON d.product_id = p.id
    JOIN clinics c ON d.clinic_id = c.id
    WHERE d.patient_id = ? ORDER BY d.created_at DESC
  `).bind(patient_id).all()
  return c.json({ deliveries: deliveries.results || [] })
})

// 4. Get deliveries for a clinic
app.get('/api/mall/delivery/clinic/:clinic_id', authMiddleware, async (c) => {
  const clinic_id = c.req.param('clinic_id')
  const deliveries = await c.env.DB.prepare(`
    SELECT d.*, p.name as product_name, m.name as patient_name
    FROM delivery_orders d
    JOIN products p ON d.product_id = p.id
    LEFT JOIN members m ON d.patient_id = m.id
    WHERE d.clinic_id = ? ORDER BY d.created_at DESC
  `).bind(clinic_id).all()
  return c.json({ deliveries: deliveries.results || [] })
})

// ==================== CODI (Mobile Codi) ====================

// 썸네일 자동 추출 헬퍼 (og:image + oEmbed 폴백)
async function extractThumbnail(url: string): Promise<string | null> {
  if (!url) return null
  try {
    // 1차: HTML에서 og:image 추출
    const resp = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      redirect: 'follow'
    })
    if (resp.ok) {
      const html = await resp.text()
      const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
      if (ogMatch && ogMatch[1]) {
        let imgUrl = ogMatch[1]
        if (imgUrl.startsWith('/')) {
          const parsed = new URL(url)
          imgUrl = parsed.origin + imgUrl
        }
        return imgUrl
      }
    }
  } catch (e) { /* og:image 추출 실패 */ }

  try {
    // 2차: oEmbed API 폴백 (Vimeo, YouTube 등)
    const oEmbedProviders = [
      { pattern: /vimeo\.com/, endpoint: 'https://vimeo.com/api/oembed.json?url=' },
      { pattern: /youtube\.com|youtu\.be/, endpoint: 'https://www.youtube.com/oembed?format=json&url=' },
    ]
    for (const p of oEmbedProviders) {
      if (p.pattern.test(url)) {
        const oResp = await fetch(p.endpoint + encodeURIComponent(url))
        if (oResp.ok) {
          const oData: any = await oResp.json()
          if (oData.thumbnail_url) return oData.thumbnail_url
        }
        break
      }
    }
  } catch (e) { /* oEmbed 폴백 실패 */ }

  return null
}

function generateId(len = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let r = ''
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  for (let i = 0; i < len; i++) r += chars[arr[i] % chars.length]
  return r
}

// Codi admin auth middleware
const codiAdminAuth = async (c: any, next: any) => {
  const auth = c.req.header('Authorization')
  if (!auth) return c.json({ error: '인증 필요' }, 401)
  const token = auth.replace('Bearer ', '')
  const decoded = decodeToken(token)
  if (!decoded) return c.json({ error: '인증 필요' }, 401)
  const member = await c.env.DB.prepare('SELECT * FROM members WHERE id = ?').bind(decoded.id).first()
  if (!member || member.role !== 'super_admin') return c.json({ error: '권한 없음' }, 403)
  await next()
}

// GET /api/codi/summary
app.get('/api/codi/summary', async (c) => {
  const clinic_id = c.req.query('clinic_id')
  if (!clinic_id) return c.json({ error: 'clinic_id 필요' }, 400)
  const normalizedId = String(parseInt(clinic_id) || clinic_id)
  const todayStart = getKSTTodayStartUTC()
  const todayCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM patient_links WHERE CAST(clinic_id AS TEXT) = CAST(? AS TEXT) AND created_at >= ?"
  ).bind(normalizedId, todayStart).first()
  const totalPatients = await c.env.DB.prepare(
    "SELECT COUNT(DISTINCT patient) as cnt FROM patient_links WHERE CAST(clinic_id AS TEXT) = CAST(? AS TEXT)"
  ).bind(normalizedId).first()
  const totalTemplates = await c.env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM link_templates WHERE CAST(clinic_id AS TEXT) = CAST(? AS TEXT) OR clinic_id = '0'"
  ).bind(normalizedId).first()
  return c.json({
    today_count: (todayCount as any)?.cnt || 0,
    total_patients: (totalPatients as any)?.cnt || 0,
    total_templates: (totalTemplates as any)?.cnt || 0
  })
})

// GET /api/codi/link-templates — 공용(clinic_id=0) + 개별(해당 clinic_id) 합쳐 반환
app.get('/api/codi/link-templates', async (c) => {
  const clinic_id = c.req.query('clinic_id')
  if (!clinic_id) return c.json({ error: 'clinic_id 필요' }, 400)
  // 공용 링크(clinic_id=0)와 해당 치과 링크를 함께 조회
  const rows = await c.env.DB.prepare(
    `SELECT *, CASE WHEN clinic_id = '0' THEN 1 ELSE 0 END as is_global 
     FROM link_templates WHERE clinic_id = '0' OR clinic_id = ? 
     ORDER BY is_global DESC, created_at DESC`
  ).bind(clinic_id).all()
  return c.json({ templates: rows.results || [] })
})

// GET /api/codi/og-image?url=... — URL에서 OG 이미지 자동 추출
app.get('/api/codi/og-image', async (c) => {
  const url = c.req.query('url')
  if (!url) return c.json({ error: 'url 필요' }, 400)
  const thumbnail = await extractThumbnail(url)
  return c.json({ thumbnail })
})

// POST /api/codi/link-templates (썸네일 자동 추출 포함)
app.post('/api/codi/link-templates', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { name, url, thumbnail, default_memo, clinic_id } = body as any
  if (!name || !url) return c.json({ error: '이름과 URL 필요' }, 400)
  const id = generateId()
  // 썸네일이 없으면 URL에서 자동 추출 시도 (og:image + oEmbed 폴백)
  let finalThumbnail = thumbnail || null
  if (!finalThumbnail && url) {
    finalThumbnail = await extractThumbnail(url)
  }
  await c.env.DB.prepare(
    'INSERT INTO link_templates (id, name, url, thumbnail, clinic_id, created_at, default_memo) VALUES (?,?,?,?,CAST(? AS TEXT),?,?)'
  ).bind(id, name, url, finalThumbnail, clinic_id || null, new Date().toISOString(), default_memo || null).run()
  return c.json({ id, name, url, thumbnail: finalThumbnail })
})

// PUT /api/codi/link-templates/:id
app.put('/api/codi/link-templates/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const { name, url, thumbnail, default_memo } = body as any
  await c.env.DB.prepare(
    'UPDATE link_templates SET name=COALESCE(?,name), url=COALESCE(?,url), thumbnail=COALESCE(?,thumbnail), default_memo=COALESCE(?,default_memo) WHERE id=?'
  ).bind(name || null, url || null, thumbnail || null, default_memo || null, id).run()
  return c.json({ success: true })
})

// DELETE /api/codi/link-templates/:id
app.delete('/api/codi/link-templates/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM link_templates WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// POST /api/codi/admin/backfill-thumbnails — 썸네일 없는 링크에 OG 이미지 자동 추출
app.post('/api/codi/admin/backfill-thumbnails', codiAdminAuth, async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT id, url FROM link_templates WHERE (thumbnail IS NULL OR thumbnail = '') AND url IS NOT NULL AND url != ''"
  ).all()
  const templates = rows.results || []
  let updated = 0
  for (const tpl of templates) {
    try {
      const resp = await fetch((tpl as any).url, { 
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DentalPointBot/1.0)' },
        redirect: 'follow'
      })
      if (resp.ok) {
        const html = await resp.text()
        const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
        if (ogMatch && ogMatch[1]) {
          let imgUrl = ogMatch[1]
          if (imgUrl.startsWith('/')) {
            const parsed = new URL((tpl as any).url)
            imgUrl = parsed.origin + imgUrl
          }
          await c.env.DB.prepare('UPDATE link_templates SET thumbnail = ? WHERE id = ?').bind(imgUrl, (tpl as any).id).run()
          updated++
        }
      }
    } catch (e) { /* skip */ }
  }
  return c.json({ success: true, total: templates.length, updated })
})

// GET /api/codi/patients
app.get('/api/codi/patients', async (c) => {
  const clinic_id = c.req.query('clinic_id')
  if (!clinic_id) return c.json({ error: 'clinic_id 필요' }, 400)
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '30')
  const offset = (page - 1) * limit
  const search = c.req.query('search') || ''
  const todayOnly = c.req.query('today') === 'true'

  let where = 'pc.clinic_id = ?'
  const binds: any[] = [clinic_id]

  // 오늘 환자만 필터: 오늘 결제(방문) 기록이 있는 환자
  if (todayOnly) {
    const today = getKSTDate()
    where += ' AND m.id IN (SELECT DISTINCT patient_id FROM payments WHERE clinic_id = ? AND created_at >= ?)'
    binds.push(clinic_id, today)
  }

  if (search) {
    where += ' AND (m.name LIKE ? OR m.phone LIKE ? OR m.chart_number LIKE ?)'
    const s = `%${search}%`
    binds.push(s, s, s)
  }

  const countR = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM patient_clinic pc JOIN members m ON pc.patient_id = m.id WHERE ${where}`
  ).bind(...binds).first()
  const total = (countR as any)?.cnt || 0

  const rows = await c.env.DB.prepare(
    `SELECT m.id, m.name, m.phone, m.chart_number, m.birth_date, NULL as last_treatment, NULL as last_visit_date, m.gender,
     pc.total_points, pc.used_points, (pc.total_points - COALESCE(pc.used_points,0)) as available_points,
     (SELECT MAX(created_at) FROM payments WHERE patient_id = m.id AND clinic_id = pc.clinic_id) as last_payment_date
     FROM patient_clinic pc JOIN members m ON pc.patient_id = m.id WHERE ${where}
     ORDER BY m.name ASC LIMIT ? OFFSET ?`
  ).bind(...binds, limit, offset).all()

  return c.json({
    patients: rows.results || [],
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit)
  })
})

// GET /api/codi/patient-links
app.get('/api/codi/patient-links', async (c) => {
  const clinic_id = c.req.query('clinic_id')
  if (!clinic_id) return c.json({ error: 'clinic_id 필요' }, 400)
  const limit = parseInt(c.req.query('limit') || '50')
  const search = c.req.query('search') || ''
  const from = c.req.query('from') || ''
  const to = c.req.query('to') || ''
  
  let where = 'CAST(clinic_id AS TEXT) = CAST(? AS TEXT)'
  const binds: any[] = [String(parseInt(clinic_id) || clinic_id)]
  
  if (search) {
    where += ' AND (patient LIKE ? OR phone LIKE ?)'
    const s = `%${search}%`
    binds.push(s, s)
  }
  if (from) {
    where += ' AND created_at >= ?'
    // 클라이언트가 보내는 날짜는 KST 기준이므로 UTC로 변환 (KST 00:00 = UTC 전날 15:00)
    binds.push(new Date(from + 'T00:00:00+09:00').toISOString())
  }
  if (to) {
    where += ' AND created_at <= ?'
    // KST 23:59:59 = UTC 같은날 14:59:59
    binds.push(new Date(to + 'T23:59:59+09:00').toISOString())
  }
  
  const rows = await c.env.DB.prepare(
    `SELECT * FROM patient_links WHERE ${where} ORDER BY created_at DESC LIMIT ?`
  ).bind(...binds, limit).all()
  return c.json({ links: rows.results || [] })
})

// POST /api/codi/patient-links
app.post('/api/codi/patient-links', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { patient, patient_id, memo, clinic, phone, url, link_name, thumbnail, clinic_id } = body as any
  if (!url) return c.json({ error: 'URL 필요' }, 400)

  // 자체 /v/ 링크가 URL로 들어온 경우 → 원본 URL로 치환 (이중 배너 방지)
  let resolvedUrl = url
  const selfMatch = url.match(/dental-point\.pages\.dev\/v\/([A-Za-z0-9]+)/)
  if (selfMatch) {
    const innerRow = await c.env.DB.prepare('SELECT url FROM patient_links WHERE id = ?').bind(selfMatch[1]).first() as any
    if (innerRow && innerRow.url) resolvedUrl = innerRow.url
  }

  const id = generateId()
  // clinic 이름 보정: "관리자", "SYSTEM", "awsystem" 등 admin 계정이면 실제 치과 이름 조회
  let resolvedClinic = clinic || ''
  const adminNames = ['관리자', 'SYSTEM', 'awsystem', 'admin', 'test', '시스템']
  if (adminNames.includes(resolvedClinic) && clinic_id) {
    const clinicRow = await c.env.DB.prepare('SELECT name FROM clinics WHERE id = ?').bind(clinic_id).first() as any
    if (clinicRow && clinicRow.name && !adminNames.includes(clinicRow.name)) {
      resolvedClinic = clinicRow.name
    } else {
      resolvedClinic = '' // admin 계정이고 실제 치과 이름도 없으면 빈값
    }
  }
  // 원본 URL 저장 (파라미터 없는 깨끗한 URL)
  await c.env.DB.prepare(
    `INSERT INTO patient_links (id, patient, patient_id, memo, clinic, phone, url, link_name, thumbnail, clinic_id, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,CAST(? AS TEXT),?)`
  ).bind(id, patient || '', patient_id || '', memo || '', resolvedClinic, phone || '', resolvedUrl, link_name || '', thumbnail || '', String(parseInt(clinic_id) || clinic_id || ''), new Date().toISOString()).run()
  // short URL 반환: /v/{id} 경로로 접근하면 원본 URL + 환자 파라미터로 리다이렉트
  const origin = new URL(c.req.url).origin
  const shortUrl = origin + '/v/' + id
  return c.json({ success: true, id, patient, url, shortUrl })
})

// GET /v/:id — 원본 mobilecodi 방식: 중간페이지(배너+전화)→ 원본 URL 리다이렉트
app.get('/v/:id', async (c) => {
  const id = c.req.param('id')
  const row = await c.env.DB.prepare(
    'SELECT * FROM patient_links WHERE id = ?'
  ).bind(id).first() as any
  if (!row) return c.text('링크를 찾을 수 없습니다', 404)

  // clinic_id로 clinics 테이블에서 정확한 치과 전화번호/이름 조회
  let clinicPhone = ''
  let clinicRealName = row.clinic || ''
  if (row.clinic_id) {
    const clinic = await c.env.DB.prepare('SELECT name, phone FROM clinics WHERE id = ?').bind(row.clinic_id).first() as any
    if (clinic) {
      if (clinic.phone) clinicPhone = clinic.phone
      if (clinic.name) clinicRealName = clinic.name
    }
  }

  const ogTitle = row.link_name || '치과 안내'
  const ogImage = row.thumbnail || ''
  const ogDesc = row.patient ? (row.patient + '님을 위한 맞춤 안내') : '치과 안내 페이지'
  const patientName = (row.patient || '').replace(/'/g, "\\'").replace(/</g, '&lt;').replace(/"/g, '&quot;')
  const clinicName = (clinicRealName).replace(/'/g, "\\'").replace(/</g, '&lt;').replace(/"/g, '&quot;')
  const phone = (clinicPhone || row.phone || '').replace(/'/g, "\\'").replace(/"/g, '&quot;')
  const memo = (row.memo || '').replace(/'/g, "\\'").replace(/</g, '&lt;').replace(/"/g, '&quot;')
  let originalUrl = row.url || ''

  // 자체 /v/ 링크가 원본 URL인 경우 → 원본의 원본 URL로 치환 (이중 배너 방지)
  const selfLinkMatch = originalUrl.match(/\/v\/([A-Za-z0-9]+)/)
  if (selfLinkMatch && (originalUrl.includes('dental-point.pages.dev/v/') || originalUrl.startsWith('/v/'))) {
    const innerRow = await c.env.DB.prepare('SELECT url FROM patient_links WHERE id = ?').bind(selfLinkMatch[1]).first() as any
    if (innerRow && innerRow.url) {
      originalUrl = innerRow.url
    }
  }

  const ua = c.req.header('user-agent') || ''
  const isBot = /kakaotalk-scrap|facebookexternalhit|Facebot|Twitterbot|Slackbot|LinkedInBot|WhatsApp|Googlebot|bingbot|yandex|Telegrambot|Line\//i.test(ua)

  if (isBot) {
    return c.html(`<!DOCTYPE html><html><head>
<meta property="og:title" content="${ogTitle}">
<meta property="og:description" content="${ogDesc}">
${ogImage ? `<meta property="og:image" content="${ogImage}">` : ''}
<meta property="og:type" content="website">
</head><body></body></html>`)
  }

  // 리다이렉트 URL
  let redirectUrl = originalUrl
  const sep = originalUrl.includes('?') ? '&' : '?'
  const prms: string[] = []
  if (patientName) prms.push('patient=' + encodeURIComponent(patientName))
  if (clinicName) prms.push('clinic=' + encodeURIComponent(clinicName))
  if (phone) prms.push('phone=' + encodeURIComponent(phone))
  if (prms.length > 0) redirectUrl += sep + prms.join('&')

  // 영상 URL 감지 → iframe 임베드용 URL로 변환 (x-frame-options 우회)
  let isVideoEmbed = false
  let embedUrl = redirectUrl
  // Vimeo: vimeo.com/12345 → player.vimeo.com/video/12345
  const vimeoMatch = originalUrl.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) {
    embedUrl = 'https://player.vimeo.com/video/' + vimeoMatch[1] + '?autoplay=0&title=1&byline=0&portrait=0'
    isVideoEmbed = true
  }
  // YouTube: youtube.com/watch?v=xxx 또는 youtu.be/xxx
  const ytMatch = originalUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/)
  if (ytMatch) {
    embedUrl = 'https://www.youtube.com/embed/' + ytMatch[1]
    isVideoEmbed = true
  }

  const phoneClean = phone.replace(/-/g, '')
  const callText = clinicName ? clinicName + ' \uC804\uD654\uD558\uAE30' : '\uC804\uD654\uD558\uAE30'
  const ogImageTag = ogImage ? '<meta property="og:image" content="' + ogImage + '">' : ''
  const hasMemo = memo ? 'true' : 'false'

  // iframe 방식: 원본 페이지를 iframe으로 감싸고 위젯(배너+전화)을 항상 유지
  const html = '<!DOCTYPE html>'
    + '<html lang="ko"><head>'
    + '<meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">'
    + '<meta property="og:title" content="' + ogTitle + '">'
    + '<meta property="og:description" content="' + ogDesc + '">'
    + ogImageTag
    + '<meta property="og:type" content="website">'
    + '<title>' + ogTitle + '</title>'
    + '<style>'
    + '*{margin:0;padding:0;box-sizing:border-box}'
    + 'html,body{width:100%;height:100%;overflow:hidden;-webkit-text-size-adjust:100%}'
    + 'body{font-family:Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:#fff}'
    // 배너 - 아코디언 구조
    + '#ip-banner{position:fixed;top:0;left:0;right:0;background:linear-gradient(135deg,#2563eb 0%,#3b82f6 100%);color:#fff;z-index:99999;cursor:pointer;transition:max-height .4s ease;max-height:300px;box-shadow:0 4px 16px rgba(0,0,0,.25)}'
    + '#ip-banner .bn-clip{overflow:hidden}'
    + '#ip-banner.folded{max-height:42px}'
    + '#ip-banner .bn-inner{padding:12px 16px}'
    + '#ip-banner.folded .bn-inner{padding:9px 16px}'
    + '#ip-banner .bn-row{display:flex;align-items:center;gap:8px}'
    + '#ip-banner .bn-name{font-size:20px;font-weight:700;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '#ip-banner .bn-name .nm-suffix{font-size:14px;font-weight:500;opacity:.85}'
    + '#ip-banner.folded .bn-name{font-size:15px}'
    + '#ip-banner.folded .bn-name .nm-suffix{font-size:11px}'
    + '#ip-banner .bn-arrow{font-size:10px;opacity:.7;flex-shrink:0;transition:transform .3s}'
    + '#ip-banner.folded .bn-arrow{transform:rotate(180deg)}'
    + '#ip-banner .bn-greeting{font-size:11px;opacity:.8;margin-bottom:2px}'
    + '#ip-banner.folded .bn-greeting{display:none}'
    + '#ip-banner .bn-memo{font-size:16px;opacity:.9;margin-top:6px;line-height:1.6;padding:8px 10px;background:rgba(255,255,255,.12);border-radius:8px;white-space:pre-wrap;word-break:keep-all}'
    + '#ip-banner.folded .bn-memo{display:none}'
    // 전화버튼 - 배너와 동일 컬러, 배경 없이
    + '#ip-call{position:fixed;bottom:0;left:0;right:0;z-index:99999;padding:0;padding-bottom:env(safe-area-inset-bottom);box-shadow:0 -4px 16px rgba(0,0,0,.25)}'
    + '#ip-call a{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px 20px;background:linear-gradient(135deg,#2563eb 0%,#3b82f6 100%);color:#fff;font-size:15px;font-weight:600;border:none;cursor:pointer;text-decoration:none}'
    + '#ip-call a:active{opacity:.9}'
    // iframe - 원본 페이지 표시
    + '#ip-frame{position:fixed;left:0;right:0;border:none;width:100%;z-index:1;background:#fff}'
    + '</style></head><body>'
    // 상단 배너
    + '<div id="ip-banner"><div class="bn-clip"><div class="bn-inner">'
    + '<div class="bn-greeting">\uC548\uB155\uD558\uC138\uC694</div>'
    + '<div class="bn-row">'
    + '<div class="bn-name">' + patientName + ' <span class="nm-suffix">\uB2D8</span></div>'
    + '<div class="bn-arrow">\u25B2</div>'
    + '</div>'
    + (memo ? '<div class="bn-memo">' + memo + '</div>' : '')
    + '</div></div></div>'
    // iframe
    + '<iframe id="ip-frame" src="' + embedUrl + '" allow="autoplay;fullscreen;encrypted-media;clipboard-write;web-share" allowfullscreen></iframe>'
    // 하단 전화버튼
    + (phoneClean ? '<div id="ip-call"><a href="tel:' + phoneClean + '">' + (clinicName ? clinicName + ' ' : '') + '\uC804\uD654\uB85C \uBB38\uC758\uD558\uAE30</a></div>' : '')
    // 스크립트
    + '<script>!function(){'
    + 'console.log("[IP Widget]",{patient:"' + patientName + '",clinic:"' + clinicName + '",phone:"' + phone + '",memo:"' + memo + '"});'
    + 'var banner=document.getElementById("ip-banner");'
    + 'var frame=document.getElementById("ip-frame");'
    + 'var call=document.getElementById("ip-call");'
    + 'var folded=false;'
    // iframe 위치 계산
    + 'function layout(){'
    + 'var bt=banner.offsetHeight;'
    + 'var cb=call?call.offsetHeight:0;'
    + 'frame.style.top=bt+"px";'
    + 'frame.style.height="calc(100vh - "+bt+"px - "+cb+"px)";'
    + '}'
    // 접기/펼치기
    + 'function toggle(){'
    + 'folded=!folded;'
    + 'if(folded){banner.classList.add("folded")}else{banner.classList.remove("folded")}'
    + 'setTimeout(layout,420);'  // transition 끝나면 layout 재계산
    + '}'
    + 'banner.addEventListener("click",function(e){e.preventDefault();toggle();});'
    // 초기 layout
    + 'layout();'
    + 'window.addEventListener("resize",layout);'
    // 메모가 있으면 5초 후 자동 접기, 없으면 2초 후
    + 'var delay=' + hasMemo + '?7000:3000;'
    + 'setTimeout(function(){if(!folded)toggle();},delay);'
    + '}()</script></body></html>'

  return c.html(html)
})

// Admin endpoints
app.get('/api/codi/admin/all-templates', codiAdminAuth, async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT lt.*, 
      CASE WHEN lt.clinic_id = '0' THEN '공용 전체' 
           ELSE COALESCE(c.name, '(미지정)') END as clinic_name,
      CASE WHEN lt.clinic_id = '0' THEN 1 ELSE 0 END as is_global
     FROM link_templates lt 
     LEFT JOIN clinics c ON CAST(lt.clinic_id AS INTEGER) = c.id 
     ORDER BY is_global DESC, c.name, lt.created_at DESC`
  ).all()
  return c.json({ templates: rows.results || [] })
})

// GET /api/codi/admin/all-patient-links - 전체 치과 전송 기록 (치과별 그룹)
app.get('/api/codi/admin/all-patient-links', codiAdminAuth, async (c) => {
  const days = parseInt(c.req.query('days') || '7')
  const kstDate = getKSTDate()
  const cutoff = new Date(kstDate + 'T00:00:00+09:00')
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffISO = cutoff.toISOString()
  const todayStartUTC = getKSTTodayStartUTC()

  const rows = await c.env.DB.prepare(
    `SELECT pl.*, 
      COALESCE(c.name, '(미지정)') as clinic_name
     FROM patient_links pl
     LEFT JOIN clinics c ON CAST(pl.clinic_id AS INTEGER) = c.id
     WHERE pl.created_at >= ?
     ORDER BY pl.created_at DESC`
  ).bind(cutoffISO).all()

  const links = rows.results || []

  // 치과별 그룹핑 + 오늘 전송 수 계산
  const clinicGroups: Record<string, { clinic_name: string; clinic_id: string; today_count: number; total_count: number; links: any[] }> = {}
  for (const link of links as any[]) {
    const cid = String(parseInt(link.clinic_id) || 0)
    if (!clinicGroups[cid]) {
      clinicGroups[cid] = {
        clinic_name: link.clinic_name || '(미지정)',
        clinic_id: cid,
        today_count: 0,
        total_count: 0,
        links: []
      }
    }
    clinicGroups[cid].total_count++
    clinicGroups[cid].links.push(link)
    if (link.created_at >= todayStartUTC) {
      clinicGroups[cid].today_count++
    }
  }

  return c.json({
    groups: Object.values(clinicGroups).sort((a, b) => b.today_count - a.today_count || b.total_count - a.total_count),
    total: links.length,
    days,
    kst_date: kstDate
  })
})

app.get('/api/codi/admin/clinics', codiAdminAuth, async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT c.*,
      (SELECT COUNT(*) FROM link_templates lt WHERE CAST(lt.clinic_id AS INTEGER) = c.id) as link_count,
      (SELECT COUNT(*) FROM clinic_admins ca WHERE ca.clinic_id = c.id) as admin_count
     FROM clinics c 
     WHERE c.id > 0
     AND c.name NOT IN ('SYSTEM','') 
     ORDER BY c.name`
  ).all()
  return c.json({ clinics: rows.results || [] })
})

app.get('/api/codi/admin/imweb-members', codiAdminAuth, async (c) => {
  // ★★★ v5.10.11: 아임웹 API 실시간 조회 우선, 실패 시 DB fallback
  const key = c.env.IMWEB_KEY || '6e0afc05cea3b4966b5d937be58a97bbec5a157f77'
  const secret = c.env.IMWEB_SECRET || '9d7e63a446bdf2eb16a754'
  const token = await getImwebToken(key, secret)
  
  // DB에서 등록된 회원 목록 조회 (기본)
  const dbRows = await c.env.DB.prepare(
    `SELECT m.*, ca.clinic_id as admin_clinic_id, cl.name as clinic_name
     FROM members m
     LEFT JOIN clinic_admins ca ON ca.member_id = m.id
     LEFT JOIN clinics cl ON cl.id = ca.clinic_id
     WHERE m.imweb_member_id IS NOT NULL AND m.imweb_member_id != ''
       AND m.status = 'approved'
     ORDER BY m.name`
  ).all()
  const dbMembers = (dbRows.results || []) as any[]
  
  if (!token) {
    // 아임웹 API 연동 불가 시 DB 기반 반환
    return c.json({ members: dbMembers, source: 'db_only' })
  }
  
  try {
    // 아임웹 API에서 전체 회원 목록 조회
    const imwebResp = await fetch('https://api.imweb.me/v2/member/members?limit=200&offset=0', {
      headers: { 'access-token': token }
    })
    const imwebData: any = await imwebResp.json()
    const imwebMembers = imwebData.data?.list || []
    
    // DB 회원 맵 (imweb_member_id → db 행)
    const dbMap: Record<string, any> = {}
    for (const row of dbMembers) {
      if (row.imweb_member_id) dbMap[row.imweb_member_id] = row
    }
    
    // 아임웹 회원 목록 기반 통합 (등록 여부 포함)
    const merged: any[] = []
    const seenIds = new Set<string>()
    for (const m of imwebMembers) {
      const code = m.member_code || m.uid
      if (!code || seenIds.has(code)) continue
      seenIds.add(code)
      const dbRow = dbMap[code]
      merged.push({
        id: dbRow?.id || null,
        imweb_member_id: code,
        name: dbRow?.name || m.name || m.nick || '(미등록)',
        email: m.email || dbRow?.email || '',
        imweb_group: m.member_grade || dbRow?.imweb_group || '',
        admin_clinic_id: dbRow?.admin_clinic_id || null,
        clinic_name: dbRow?.clinic_name || null,
        registered: !!dbRow,
        role: dbRow?.role || 'unregistered',
        join_time: m.join_time || '',
      })
    }
    // DB에만 있는 회원도 포함 (아임웹에서 삭제되었거나 아직 조회 안 된 회원)
    for (const row of dbMembers) {
      if (!seenIds.has(row.imweb_member_id)) {
        merged.push({
          id: row.id,
          imweb_member_id: row.imweb_member_id,
          name: row.name,
          email: row.email || '',
          imweb_group: row.imweb_group || '',
          admin_clinic_id: row.admin_clinic_id || null,
          clinic_name: row.clinic_name || null,
          registered: true,
          role: row.role || 'clinic_admin',
          join_time: '',
        })
      }
    }
    
    return c.json({ members: merged, source: 'imweb_api', total: merged.length })
  } catch(e: any) {
    // 아임웹 API 오류 시 DB fallback
    return c.json({ members: dbMembers, source: 'db_fallback', error: e.message })
  }
})

// POST /api/codi/admin/push-templates - 링크배포
app.post('/api/codi/admin/push-templates', codiAdminAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { clinic_ids, imweb_members, templates } = body as any
  console.log('[push-templates] received:', JSON.stringify({ clinic_ids, imweb_members, templateCount: templates?.length }))
  if (!templates || !Array.isArray(templates) || templates.length === 0) {
    return c.json({ error: '배포할 템플릿 필요' }, 400)
  }

  let pushed = 0
  const targetClinicIds: string[] = (clinic_ids || []).map((id: any) => String(parseInt(id) || 0))

  // imweb_members → clinic_id 직접 매핑 (clinic_admins 기반)
  if (imweb_members && Array.isArray(imweb_members)) {
    for (const code of imweb_members) {
      // 위젯에서 clinic_id를 직접 전달한 경우 (신규 방식)
      if (typeof code === 'object' && code.clinic_id) {
        const cid = String(parseInt(code.clinic_id) || 0)
        if (!targetClinicIds.includes(cid)) targetClinicIds.push(cid)
        continue
      }
      // fallback: member_code로 clinic_admins에서 clinic_id 조회
      const memberCode = typeof code === 'object' ? code.member_code : code
      if (!memberCode) continue
      const m = await c.env.DB.prepare(
        "SELECT id FROM members WHERE imweb_member_id = ?"
      ).bind(memberCode).first()
      if (m) {
        const ca = await c.env.DB.prepare(
          "SELECT ca.clinic_id FROM clinic_admins ca WHERE ca.member_id = ? LIMIT 1"
        ).bind((m as any).id).first()
        if (ca) {
          const cid = String(parseInt((ca as any).clinic_id) || 0)
          if (!targetClinicIds.includes(cid)) targetClinicIds.push(cid)
        }
      }
    }
  }

  for (const clinicId of targetClinicIds) {
    for (const tpl of templates) {
      // 썸네일 자동 추출 (og:image + oEmbed 폴백)
      let finalThumbnail = tpl.thumbnail || null
      if (!finalThumbnail && tpl.url) {
        finalThumbnail = await extractThumbnail(tpl.url)
      }
      const id = generateId()
      await c.env.DB.prepare(
        'INSERT INTO link_templates (id, name, url, thumbnail, clinic_id, created_at, default_memo) VALUES (?,?,?,?,CAST(? AS TEXT),?,?)'
      ).bind(id, tpl.name || '', tpl.url || '', finalThumbnail, clinicId, new Date().toISOString(), tpl.default_memo || null).run()
      console.log('[push-templates] inserted:', id, 'clinic_id:', clinicId, 'type:', typeof clinicId, 'name:', tpl.name)
      pushed++
    }
  }

  return c.json({ success: true, pushed, targetClinicIds, templateCount: templates.length })
})

// POST /api/codi/admin/push-templates-all - 공용링크 등록 (clinic_id=0으로 1회 저장, 모든 치과에서 보임)
app.post('/api/codi/admin/push-templates-all', codiAdminAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { templates } = body as any
  if (!templates || !Array.isArray(templates) || templates.length === 0) {
    return c.json({ error: '배포할 템플릿 필요' }, 400)
  }

  let pushed = 0
  for (const tpl of templates) {
    // 썸네일 자동 추출 (og:image + oEmbed 폴백)
    let finalThumbnail = tpl.thumbnail || null
    if (!finalThumbnail && tpl.url) {
      finalThumbnail = await extractThumbnail(tpl.url)
    }
    const id = generateId()
    await c.env.DB.prepare(
      'INSERT INTO link_templates (id, name, url, thumbnail, clinic_id, created_at, default_memo) VALUES (?,?,?,?,?,?,?)'
    ).bind(id, tpl.name || '', tpl.url || '', finalThumbnail, '0', new Date().toISOString(), tpl.default_memo || null).run()
    pushed++
  }

  return c.json({ success: true, pushed, clinics: '전체' })
})

// /codi page (Mobile Codi entry point)
app.get('/codi', (c) => {
  return c.html(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" href="/favicon.ico" type="image/svg+xml">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap');
    body { font-family: 'Noto Sans KR', sans-serif; }
  </style><title>모바일 코디</title></head>
<body class="bg-gray-50 min-h-screen"><div id="codi-widget-root"></div><script src="/widget-codi.js?v=${Date.now()}"></script></body></html>`)
})

// Catch-all for 404
app.all('/api/*', (c) => c.json({ error: 'Not Found' }, 404))

export default app


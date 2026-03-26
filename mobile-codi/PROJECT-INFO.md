# DentalPoint 프로젝트 완전 정보 문서

> **목적**: 수정 요청 시 헤매지 않고 즉시 정확한 파일/함수 위치를 찾아 수정할 수 있도록 모든 정보를 기록한다.
> **버전**: v3.8.12 (2026-03-26)
> **배포 URL**: https://dental-point.pages.dev

---

## 1. 프로젝트 구조

```
extracted_final/dental-point/webapp/
├── src/
│   └── index.tsx          ← 백엔드 API 전체 (4,117줄) - Hono 프레임워크
├── public/
│   ├── widget-codi.js     ← 모바일코디 위젯 (1,936줄) - 아임웹 코디 페이지용
│   ├── widget-imweb.js    ← 아임웹 포인트 위젯 (2,564줄) - 아임웹 환자 페이지용
│   ├── widget-imweb2.js   ← 아임웹 위젯 v2 (292KB)
│   ├── widget-imweb-d573c21.js ← 아임웹 위젯 이전버전
│   ├── widget-codi-admin.js ← 코디 관리자 위젯 (26KB)
│   ├── widget-cafe24.js   ← 카페24 위젯
│   ├── widget-sixshop.js  ← 식스샵 위젯
│   ├── widget-woocommerce.js ← 우커머스 위젯
│   ├── widget-v510.js     ← 통합 위젯 v5.10
│   ├── favicon.ico
│   ├── _headers
│   ├── _routes.json
│   └── static/
│       ├── admin.js       ← 관리자 페이지 JS (212KB)
│       ├── og-default.png ← OG 이미지
│       ├── DentWebBridge.zip ← 덴트웹 브릿지 다운로드
│       ├── dentweb_bridge.py ← 덴트웹 브릿지 Python 스크립트
│       ├── dental-point-operations-manual.pdf
│       └── test-widget.html
├── bridge/                ← 덴트웹 브릿지 소스
│   ├── dentweb_bridge.py  ← Python 브릿지 (치과 PC에서 실행)
│   ├── config.ini         ← 브릿지 설정
│   ├── build_exe/         ← exe 빌드
│   └── README.md
├── ecosystem.config.cjs   ← PM2 설정
├── package.json           ← 의존성
├── vite.config.ts         ← Vite 빌드 설정
├── wrangler.jsonc         ← Cloudflare 설정
├── tsconfig.json
├── seed.sql
└── mall_init.sql
```

---

## 2. 기술 스택

| 구분 | 기술 |
|------|------|
| 런타임 | Cloudflare Workers (Pages) |
| 프레임워크 | Hono v4.12.7 |
| DB | Cloudflare D1 (SQLite) |
| DB ID | `c5ced06c-d12d-4539-8703-37eb558eae9a` |
| DB 이름 | `dental-point-production` |
| 빌드 | Vite v6.3.5 + @hono/vite-build |
| 언어 | TypeScript (백엔드) / JavaScript (프론트엔드 위젯) |
| CSS | Tailwind CSS (CDN) |
| 배포 명령 | `npm run build && wrangler pages deploy dist --project-name dental-point` |

---

## 3. 데이터베이스 스키마 (14개 테이블)

### 3.1 핵심 테이블

#### `clinics` - 치과 정보
```sql
id INTEGER PRIMARY KEY, name TEXT, business_number TEXT, address TEXT, phone TEXT,
logo_url TEXT, status TEXT('active'|'inactive'), created_at, updated_at
```

#### `members` - 회원 (관리자 + 환자 통합)
```sql
id INTEGER PRIMARY KEY, imweb_member_id TEXT, imweb_group TEXT, email TEXT,
name TEXT NOT NULL, phone TEXT NOT NULL, password_hash TEXT,
role TEXT('super_admin'|'clinic_admin'|'patient'),
status TEXT('pending'|'approved'|'suspended'),
chart_number TEXT, birth_date TEXT, dentweb_id TEXT,
last_treatment TEXT, last_visit_date TEXT, gender TEXT
```
- **인덱스**: dentweb_id, chart_number, phone, name

#### `clinic_admins` - 치과-관리자 매핑
```sql
id, clinic_id INTEGER → clinics.id, member_id INTEGER → members.id,
admin_role TEXT('owner'|'staff')
```

#### `patient_clinic` - 환자-치과 매핑 (N:M)
```sql
id, patient_id → members.id, clinic_id → clinics.id,
total_points INTEGER DEFAULT 0, used_points INTEGER DEFAULT 0,
status TEXT('active'|'inactive')
```

### 3.2 포인트/결제 테이블

#### `payments` - 결제 내역
```sql
id, clinic_id, patient_id, amount INTEGER, description TEXT,
category TEXT DEFAULT '일반진료',
input_type TEXT('manual'|'auto'|'bulk'|'dentweb'),
payment_ref TEXT, point_rate REAL, point_earned INTEGER,
payment_date TEXT, payment_method TEXT, dentweb_receipt_id TEXT
```

#### `point_logs` - 포인트 이력
```sql
id, clinic_id, patient_id, payment_id, coupon_id,
type TEXT('earn'|'use'|'expire'|'adjust'|'refund'),
amount INTEGER, balance_after INTEGER, description TEXT
```

### 3.3 쿠폰 테이블

#### `coupon_templates` - 쿠폰 템플릿
```sql
id, clinic_id, name TEXT, description TEXT, image_url TEXT,
discount_type TEXT('fixed'|'percent'), discount_value INTEGER,
min_payment INTEGER, auto_issue_points INTEGER, auto_issue_amount INTEGER,
valid_days INTEGER DEFAULT 90, status TEXT('active'|'inactive'),
is_birthday INTEGER DEFAULT 0, required_points INTEGER DEFAULT 0,
product_id INTEGER  -- B2B 몰 연동
```

#### `coupons` - 발행된 쿠폰
```sql
id, template_id, clinic_id, patient_id, code TEXT UNIQUE,
status TEXT('active'|'used'|'expired'|'revoked'),
issued_by INTEGER, used_at TEXT, expires_at TEXT, shared_at TEXT
```

### 3.4 코디(Codi) 테이블

#### `link_templates` - 링크 템플릿
```sql
id TEXT PRIMARY KEY, name TEXT, url TEXT, thumbnail TEXT,
clinic_id TEXT,  -- '0'=공용, '39'=특정치과
created_at TEXT, default_memo TEXT
```
- **중요**: `clinic_id`가 **TEXT** 타입 (숫자 문자열로 저장)

#### `patient_links` - 환자 전송 링크
```sql
id TEXT PRIMARY KEY, patient TEXT, patient_id TEXT, memo TEXT,
clinic TEXT, phone TEXT, url TEXT, link_name TEXT, thumbnail TEXT,
clinic_id TEXT, created_at DATETIME
```

### 3.5 기타 테이블

#### `clinic_settings` - 치과별 설정
```sql
clinic_id INTEGER UNIQUE, default_point_rate REAL DEFAULT 5.0,
category_rates TEXT DEFAULT '[]', coupon_auto_rules TEXT DEFAULT '[]',
point_expiry_days INTEGER DEFAULT 365
```

#### `bulk_uploads` - 대량 업로드 기록
```sql
clinic_id, uploaded_by, upload_type TEXT('patients'|'payments'|'combined'),
total_rows, success_rows, error_rows, result_summary TEXT
```

#### `sync_logs` - 동기화 기록
```sql
clinic_id, sync_type TEXT('patients'|'payments'|'visits'|'full'),
source TEXT DEFAULT 'dentweb', total/new/updated/error_rows, details TEXT
```

#### `setup_codes` - 셋업 코드
```sql
clinic_id, code TEXT UNIQUE, created_by, expires_at, used_at,
status TEXT('active'|'used'|'expired')
```

---

## 4. API 엔드포인트 전체 목록

### 4.1 인증 (Auth)
| Method | Path | Auth | 설명 | 파일:줄 |
|--------|------|------|------|---------|
| GET | `/api/health` | - | 헬스체크 | index.tsx:96 |
| POST | `/api/auth/login` | - | 로그인 | index.tsx:497 |
| POST | `/api/auth/imweb-match` | - | 아임웹 회원 매칭 | index.tsx:528 |
| GET | `/api/auth/me` | ✅ authMiddleware | 내 정보 | index.tsx:931 |
| PUT | `/api/auth/me` | ✅ authMiddleware | 내 정보 수정 | index.tsx:936 |

### 4.2 관리자 (Admin)
| Method | Path | Auth | 설명 | 파일:줄 |
|--------|------|------|------|---------|
| POST | `/api/admin/merge-accounts` | - | 계정 병합 | index.tsx:808 |
| GET | `/api/admin/list-members` | - | 전체 회원 목록 | index.tsx:845 |
| POST | `/api/admin/convert-to-patient` | - | 회원→환자 전환 | index.tsx:860 |
| POST | `/api/admin/delete-member` | - | 회원 삭제 | index.tsx:893 |

### 4.3 치과 (Clinics)
| Method | Path | Auth | 설명 | 파일:줄 |
|--------|------|------|------|---------|
| GET | `/api/clinics` | - | 치과 목록 | index.tsx:987 |
| GET | `/api/clinics/:id` | - | 치과 상세 | index.tsx:992 |
| PUT | `/api/clinics/:id` | - | 치과 정보 수정 | index.tsx:1011 |
| PUT | `/api/clinics/:id/settings` | - | 치과 설정 | index.tsx:1030 |

### 4.4 환자 (Patients)
| Method | Path | Auth | 설명 | 파일:줄 |
|--------|------|------|------|---------|
| GET | `/api/patients` | - | 환자 검색 | index.tsx:952 |
| GET | `/api/clinics/:id/patients` | ✅ | 치과별 환자 | index.tsx:1055 |
| GET | `/api/clinics/:id/patients/:pid` | ✅ | 환자 상세 | index.tsx:1171 |
| POST | `/api/clinics/:id/patients` | ✅ | 환자 등록 | index.tsx:1197 |
| PUT | `/api/clinics/:id/patients/:pid` | ✅ | 환자 수정 | index.tsx:1243 |
| DELETE | `/api/clinics/:id/patients/:pid` | ✅ | 환자 삭제 | index.tsx:1264 |
| DELETE | `/api/clinics/:id/patients_all` | ✅ | 전체 환자 삭제 | index.tsx:1274 |

### 4.5 결제/포인트 (Payments/Points)
| Method | Path | Auth | 설명 | 파일:줄 |
|--------|------|------|------|---------|
| POST | `/api/payments` | ✅ | 결제 등록 | index.tsx:1294 |
| GET | `/api/payments` | ✅ | 결제 내역 | index.tsx:1376 |
| POST | `/api/payments/bulk` | ✅ | 대량 결제 등록 | index.tsx:1401 |
| POST | `/api/points/adjust` | ✅ | 포인트 조정 | index.tsx:1353 |
| GET | `/api/points/balance` | - | 포인트 잔액 | index.tsx:1974 |
| GET | `/api/points/history` | - | 포인트 이력 | index.tsx:1985 |
| GET | `/api/dashboard` | ✅ | 대시보드 | index.tsx:1676 |

### 4.6 쿠폰 (Coupons)
| Method | Path | Auth | 설명 | 파일:줄 |
|--------|------|------|------|---------|
| GET | `/api/coupons/templates` | ✅ | 쿠폰 템플릿 목록 | index.tsx:1720 |
| POST | `/api/coupons/templates` | ✅ | 쿠폰 템플릿 생성 | index.tsx:1727 |
| PUT | `/api/coupons/templates/:id` | ✅ | 쿠폰 템플릿 수정 | index.tsx:1740 |
| DELETE | `/api/coupons/templates/:id` | ✅ | 쿠폰 템플릿 삭제 | index.tsx:1756 |
| POST | `/api/coupons/issue` | ✅ | 쿠폰 발행 | index.tsx:1770 |
| GET | `/api/coupons/clinic` | ✅ | 치과 쿠폰 목록 | index.tsx:1875 |
| GET | `/api/coupons/my` | - | 내 쿠폰 | index.tsx:1889 |
| DELETE | `/api/coupons/:id` | - | 쿠폰 삭제 | index.tsx:1911 |
| PUT | `/api/coupons/:id` | - | 쿠폰 수정 | index.tsx:1961 |
| GET | `/api/coupons/check/:code` | - | 쿠폰 확인 (QR) | index.tsx:2430 |
| POST | `/api/coupons/use/:code` | - | 쿠폰 사용 | index.tsx:2449 |
| POST | `/api/coupons/:code/share` | ✅ | 쿠폰 공유 | index.tsx:2290 |
| POST | `/api/coupons/:code/revoke` | ✅ | 쿠폰 취소 | index.tsx:2300 |

### 4.7 덴트웹 동기화 (Sync)
| Method | Path | Auth | 설명 | 파일:줄 |
|--------|------|------|------|---------|
| POST | `/api/sync/patients` | ✅ | 환자 동기화 | index.tsx:1997 |
| POST | `/api/sync/payments` | ✅ | 결제 동기화 | index.tsx:2070 |
| POST | `/api/sync/visits` | ✅ | 방문 동기화 | index.tsx:2145 |
| GET | `/api/sync/status` | - | 동기화 상태 | index.tsx:2329 |

**환자 동기화 매칭 로직** (index.tsx:2010-2056):
1. `dentweb_id`로 검색
2. `chart_number` + `clinic_id`로 검색
3. `phone`으로 검색
4. 매칭되면 UPDATE, 없으면 INSERT

### 4.8 셋업 (Setup)
| Method | Path | Auth | 설명 | 파일:줄 |
|--------|------|------|------|---------|
| POST | `/api/setup/code` | ✅ | 셋업 코드 생성 | index.tsx:2171 |
| GET | `/api/setup/verify/:code` | - | 셋업 코드 확인 | index.tsx:2198 |
| POST | `/api/setup/activate/:code` | - | 셋업 코드 활성화 | index.tsx:2240 |
| GET | `/api/setup/active` | ✅ | 활성 셋업 | index.tsx:2265 |

### 4.9 B2B 몰 (Mall)
| Method | Path | Auth | 설명 | 파일:줄 |
|--------|------|------|------|---------|
| GET | `/api/mall/products` | - | 상품 목록 | index.tsx:3209 |
| POST | `/api/mall/orders` | ✅ | 주문 생성 | index.tsx:3217 |
| GET | `/api/mall/inventory/:clinic_id` | ✅ | 재고 확인 | index.tsx:3260 |
| GET | `/api/mall/orders/:clinic_id` | ✅ | 주문 목록 | index.tsx:3274 |
| GET | `/api/mall/admin/orders` | ✅ | 관리자 주문 | index.tsx:3291 |
| POST | `/api/mall/admin/orders/:id/approve` | ✅ | 주문 승인 | index.tsx:3305 |
| GET | `/api/mall/admin/products` | ✅ | 상품 관리 | index.tsx:3336 |
| POST | `/api/mall/admin/products` | ✅ | 상품 등록 | index.tsx:3343 |
| PUT | `/api/mall/admin/products/:id` | ✅ | 상품 수정 | index.tsx:3356 |
| GET | `/api/mall/admin/deliveries` | ✅ | 배송 목록 | index.tsx:3374 |
| PUT | `/api/mall/admin/deliveries/:id/tracking` | ✅ | 배송 추적 | index.tsx:3386 |
| POST | `/api/mall/delivery/request` | - | 배송 요청 | index.tsx:3403 |
| GET | `/api/mall/delivery/patient/:patient_id` | - | 환자 배송 | index.tsx:3445 |
| GET | `/api/mall/delivery/clinic/:clinic_id` | ✅ | 치과 배송 | index.tsx:3458 |

### 4.10 모바일 코디 (Codi)
| Method | Path | Auth | 설명 | 파일:줄 |
|--------|------|------|------|---------|
| GET | `/api/codi/summary` | - | 코디 요약 | index.tsx:3539 |
| GET | `/api/codi/link-templates` | - | 링크 템플릿 (공용+개별) | index.tsx:3561 |
| GET | `/api/codi/og-image` | - | OG 이미지 추출 | index.tsx:3574 |
| POST | `/api/codi/link-templates` | - | 링크 생성 | index.tsx:3582 |
| PUT | `/api/codi/link-templates/:id` | - | 링크 수정 | index.tsx:3599 |
| DELETE | `/api/codi/link-templates/:id` | - | 링크 삭제 | index.tsx:3610 |
| GET | `/api/codi/patients` | - | 환자 목록 (코디용) | index.tsx:3649 |
| GET | `/api/codi/patient-links` | - | 환자 전송 이력 | index.tsx:3697 |
| POST | `/api/codi/patient-links` | - | 환자 링크 생성 | index.tsx:3731 |
| POST | `/api/codi/admin/backfill-thumbnails` | ✅ super_admin | 썸네일 보정 | index.tsx:3617 |
| GET | `/api/codi/admin/all-templates` | ✅ super_admin | 전체 템플릿 | index.tsx:3930 |
| GET | `/api/codi/admin/all-patient-links` | ✅ super_admin | 전체 전송 기록 | index.tsx:3944 |
| GET | `/api/codi/admin/clinics` | ✅ super_admin | 전체 치과 목록 | index.tsx:3991 |
| GET | `/api/codi/admin/imweb-members` | ✅ super_admin | 아임웹 회원 목록 | index.tsx:4004 |
| POST | `/api/codi/admin/push-templates` | ✅ super_admin | 링크 배포 | index.tsx:4018 |
| POST | `/api/codi/admin/push-templates-all` | ✅ super_admin | 전체 배포 | index.tsx:4076 |

### 4.11 페이지 라우트
| Method | Path | 설명 | 파일:줄 |
|--------|------|------|---------|
| GET | `/` | 메인 페이지 | index.tsx:2353 |
| GET | `/scan` | QR 스캔 페이지 | index.tsx:2357 |
| GET | `/coupon/:code` | 쿠폰 상세 | index.tsx:2362 |
| GET | `/api/og/coupon/:code/image.svg` | 쿠폰 OG SVG | index.tsx:2386 |
| GET | `/v/:id` | 단축 URL → 환자 배너 페이지 | index.tsx:3768 |
| GET | `/codi` | 모바일 코디 페이지 | index.tsx:4101 |

---

## 5. 인증 구조

### 5.1 일반 인증 (`authMiddleware` - index.tsx:61)
- `Authorization: Bearer <token>` 헤더
- 토큰 = `btoa(JSON.stringify({id, role, ts}))` (Base64 JSON)
- DB에서 `members.id`로 조회하여 검증

### 5.2 코디 관리자 인증 (`codiAdminAuth` - index.tsx:3527)
- 동일한 Bearer 토큰 방식
- **추가 조건**: `member.role === 'super_admin'` 만 허용
- `/api/codi/admin/*` 라우트에 적용

### 5.3 아임웹 회원 매칭 (`/api/auth/imweb-match` - index.tsx:528)
- 아임웹 SDK에서 `imweb_member_id` 추출
- `members.imweb_member_id`로 DB 조회
- 매칭 성공 → `clinic_admins` 테이블에서 소속 치과 조회 → 토큰 발급

---

## 6. 위젯 상세

### 6.1 widget-codi.js (모바일 코디) - 1,936줄
**위치**: `public/widget-codi.js`
**진입점**: `dental-point.pages.dev/codi` 또는 아임웹 사이트에 삽입
**API 서버**: 자동감지 (`location.origin` 또는 `dental-point.pages.dev`)

#### 주요 함수 및 줄 번호

| 함수 | 줄 | 설명 |
|------|-----|------|
| `callAPI(path, opts)` | 94 | API 호출 (stale-while-revalidate 캐시) |
| `getMemberId()` | 158 | 아임웹 회원 ID 감지 |
| `getLoginName()` | 172 | 로그인 이름 감지 |
| `getLoginEmail()` | 178 | 로그인 이메일 감지 |
| `getLoginGroup()` | 182 | 로그인 그룹 감지 |
| `doMatch(memberId, loginName)` | 191 | 서버 매칭 요청 |
| `_restoreApiCache()` | 233 | localStorage에서 API 캐시 복원 |
| `_persistApiCache()` | 246 | API 캐시 → localStorage 저장 |
| `tryAuth()` | 258 | 인증 시작 (SDK→매칭→앱렌더) |
| `renderApp()` | 306 | 앱 전체 렌더링 (네비게이션 + 탭) |
| `renderPage()` | 353 | 현재 탭 페이지 렌더링 |
| **pgPatients(el)** | 395 | **오늘 환자 탭** |
| `renderList(pats, append)` | 461 | 환자 목록 렌더링 |
| `renderExpandArea(ex, patient, templates, onDone)` | 609 | 링크 전송 UI (드롭다운+메모+전송) |
| `resetForm()` | 747 | 링크 선택/메모 초기화 |
| **pgLinks(el)** | 800 | **링크 관리 탭** |
| `showLinkModal(tpl, onDone)` | 869 | 링크 추가/수정 모달 |
| **pgHistory(el)** | 938 | **전송 기록 탭** |
| **pgSettings(el)** | 1016 | **설정 탭 (메모 폴더 관리)** |
| **pgAdmin(el)** | 1118 | **관리자 탭** (super_admin 전용) |
| `adminPush(body)` | 1164 | 관리자 - 링크 배포 |
| `renderPushUI(body, imMembers)` | 1189 | 배포 대상 치과 체크박스 UI |
| `adminShared(body)` | 1406 | 관리자 - 공용 링크 |
| `adminAll(body)` | 1586 | 관리자 - 전체 현황 |
| `adminMembers(body)` | 1757 | 관리자 - 회원 관리 |
| `adminClinicsList(body)` | 1849 | 관리자 - 치과 목록 |

#### 탭 구조
- **일반 사용자**: 오늘환자 / 링크관리 / 전송기록 / 설정
- **super_admin 추가**: 관리자 탭 → 하위탭: 링크배포(`push`) / 공용링크(`shared`) / 전체현황(`all`)

#### 캐시 구조 (중요!)
```
localStorage:
  'codi_api_cache'  → JSON {path: {data, ts}}  // stale-while-revalidate
  'dpt_admin_token' → Bearer 토큰
  'dpt_admin_member' → 회원 정보 JSON
  'dpt_admin_clinics' → 치과 목록 JSON
  'dpt_admin_clinic'  → 현재 치과 JSON
  'codi_memo_{clinicId}' → 메모 폴더/템플릿 JSON
```

#### callAPI 캐시 동작 (줄 94-138)
1. `noCache: false` (기본): 캐시 히트 → 즉시 반환, 백그라운드에서 갱신 (stale-while-revalidate)
2. `noCache: true`: 캐시 무시, 직접 fetch
3. `_inflight` 맵으로 동일 요청 중복 방지

### 6.2 widget-imweb.js (포인트 위젯) - 2,564줄
**위치**: `public/widget-imweb.js`
**API 서버**: `https://dental-point.pages.dev`
**역할**: 아임웹 환자 페이지에 삽입되어 포인트 조회/쿠폰/결제 내역 표시

### 6.3 widget-imweb-point.js (아임웹 포인트 소스)
**위치**: `mobilecodi-source/dental-point/widget-source/widget-imweb-point.js`
**버전**: v4.9.43
**API 서버**: `https://dental-point.pages.dev`
**역할**: 아임웹 사이트에서 `<script>` 태그로 삽입, 환자 포인트 관리 UI
**회원 감지**: `__bs_imweb` 쿠키 → JWT 디코딩 → `imweb_member_id`

### 6.4 widget-imweb-tv.js (TV 위젯)
**위치**: `mobilecodi-source/dental-tv/widget-source/widget-imweb-tv.js`
**버전**: v3.1.0
**API 서버**: `https://dental-tv-app.pages.dev`
**역할**: 아임웹 사이트에 치과 TV iframe 삽입
**회원 감지**: `__bs_imweb` 쿠키 → member_code 추출 → `/embed/{mc}` iframe 로드

---

## 7. 모바일코디 - 환자 표시 위젯

### 7.1 imweb-patient-widget-mobilecodi.min.html
**위치**: `mobilecodi-source/dental-tv/minified/imweb-patient-widget-mobilecodi.min.html`
**크기**: 2,926 bytes
**역할**: 아임웹 환자 페이지 상단 배너 + 하단 전화 버튼
**동작**: URL 파라미터만 사용 (DB 직접 호출 없음)
```
URL: ?patient=홍길동&clinic=OO치과&phone=02-1234-5678
→ 상단 배너: "안녕하세요 홍길동님"
→ 하단 버튼: "OO치과 전화로 문의하기" (tel: 링크)
```

### 7.2 imweb-widget-mobilecodi.min.html
**위치**: `mobilecodi-source/dental-tv/minified/imweb-widget-mobilecodi.min.html`
**역할**: 아임웹 메인 코디 위젯 (이메일 인증 → 환자 링크 생성 UI)
**기능**: 이메일 입력 → 치과 매칭 → 환자 선택 → 링크 전송

### 7.3 /v/:id 단축 URL 시스템 (index.tsx:3768)
**흐름**:
1. 코디가 환자에게 링크 전송 → `POST /api/codi/patient-links` → `shortUrl = /v/{id}` 생성
2. 환자가 `/v/{id}` 클릭 → DB에서 `patient_links` 조회
3. 봇(카카오톡/페이스북 등) → OG 태그만 반환
4. 일반 유저 → iframe 페이지 렌더링:
   - 상단: 환자 이름 + 메모 배너 (접기/펼치기)
   - 중앙: 원본 URL iframe (비디오 자동 임베드 변환)
   - 하단: 치과 전화 버튼

---

## 8. 데이터 흐름 (연동 구조)

### 8.1 환자 DB 입력 경로
```
[엑셀 업로드] ──┐
                │
[덴트웹 브릿지] ─┤──→ members 테이블 ──→ patient_clinic 연결
                │     (3단계 매칭:        (치과-환자 N:M)
[수동 등록]  ───┘      dentweb_id →
                       chart_number →
                       phone)
```

### 8.2 포인트 시스템
```
결제 등록 ──→ payments 테이블
         └──→ point_logs (earn)
         └──→ patient_clinic.total_points 증가
         └──→ 자동 쿠폰 발행 체크 (checkAndAutoIssueCoupons)
              └──→ coupons 테이블 INSERT
              └──→ point_logs (use) - required_points 차감
```

### 8.3 모바일 코디 연동
```
widget-codi.js (아임웹)
  ├─ SDK 회원ID 감지 → /api/auth/imweb-match → 토큰 발급
  ├─ /api/codi/patients?clinic_id=X → members + patient_clinic 조회
  ├─ /api/codi/link-templates?clinic_id=X → link_templates 조회
  ├─ POST /api/codi/patient-links → patient_links INSERT → shortUrl 반환
  └─ 관리자: /api/codi/admin/* → 전체 치과 관리

환자가 shortUrl 클릭 (/v/:id)
  └─ index.tsx:3768 → patient_links 조회
     └─ iframe 렌더링 (배너 + 원본URL + 전화버튼)
     └─ imweb-patient-widget-mobilecodi.min.html과 동일 개념
```

### 8.4 덴트웹 브릿지 연동
```
치과 PC (Windows)
  └─ dentweb_bridge.py 실행
     ├─ 덴트웹 API에서 환자/결제 데이터 추출
     ├─ POST /api/sync/patients → 3단계 매칭 후 INSERT/UPDATE
     └─ POST /api/sync/payments → 결제 데이터 동기화
```

---

## 9. 수정 시 참조 가이드

### "화면에 OO이 안 나와요" 문제 해결
| 증상 | 원인 위치 | 파일:줄 |
|------|-----------|---------|
| 치과 수 불일치 | adminAll에서 imMembers 그룹핑 | widget-codi.js:1586-1660 |
| 링크 배포 이력 0개 | linkMap 매칭 실패 (clinic_id 타입) | widget-codi.js:1597-1640 |
| 환자 목록 안 나옴 | callAPI 캐시 문제 | widget-codi.js:94-138 |
| 환자 선택 초기화 안됨 | ex.innerHTML='' 누락 | widget-codi.js:550,585 |
| 로그인 안됨 | getMemberId() SDK 감지 실패 | widget-codi.js:158-170 |
| 포인트 안 나옴 | patient_clinic 연결 누락 | index.tsx:1055-1165 |
| 쿠폰 자동발행 안됨 | checkAndAutoIssueCoupons 조건 | index.tsx:322-494 |

### 주요 수정 파일 정리
| 수정 대상 | 파일 | 빌드 필요 |
|-----------|------|-----------|
| 백엔드 API/DB | `src/index.tsx` | ✅ `npm run build` |
| 모바일 코디 UI | `public/widget-codi.js` | ❌ (정적 파일) |
| 아임웹 포인트 | `public/widget-imweb.js` | ❌ (정적 파일) |
| 관리자 페이지 | `public/static/admin.js` | ❌ (정적 파일) |
| 환자 배너 | `/v/:id` 라우트 (index.tsx:3768-3930) | ✅ |

### 배포 명령어
```bash
cd /home/user/extracted_final/dental-point/webapp
npm run build
npx wrangler pages deploy dist --project-name dental-point
```

---

## 10. 알려진 이슈 및 주의사항

1. **link_templates.clinic_id는 TEXT 타입**: clinics.id는 INTEGER. 비교 시 `CAST(clinic_id AS INTEGER)` 또는 `String(id)` 변환 필요
2. **callAPI 캐시**: stale-while-revalidate 방식이므로 첫 호출 실패 시 빈 배열이 캐시됨. `noCache: true`로 강제 갱신 가능
3. **localStorage 캐시**: `_restoreApiCache()`가 앱 시작 시 이전 세션 캐시 복원. 데이터 변경 후에도 오래된 캐시가 남을 수 있음
4. **adminAll의 치과/이력 매칭**: `admin_clinic_id` + `clinic_name` 이중 매칭 적용됨 (v3.8.12)
5. **환자 동기화 3단계**: dentweb_id → chart_number+clinic → phone 순서. 동일 환자가 중복 등록 방지
6. **코디 인증**: `codiAdminAuth`는 `super_admin` 롤만 허용. `clinic_admin`은 자기 치과 데이터만 접근

// ====== Dental API Cloudflare Worker (Full Firestore Proxy + Master Brand Management) ======
// 환경 변수 (Cloudflare Dashboard > Settings > Variables에 설정)
// DENTAL_FIREBASE_PROJECT_ID: Firebase 프로젝트 ID
// DENTAL_FIREBASE_CLIENT_EMAIL: 서비스 계정 이메일
// DENTAL_FIREBASE_PRIVATE_KEY: 서비스 계정 비공개 키
// MASTER_USER_KEYS: 마스터 관리자 유저키 (쉼표 구분, 예: "admin,master_clinic_001")

// ====== JWT / 토큰 관련 유틸리티 ======

function base64urlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

async function createServiceAccountToken(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: env.DENTAL_FIREBASE_CLIENT_EMAIL,
    sub: env.DENTAL_FIREBASE_CLIENT_EMAIL,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform'
  };

  const encoder = new TextEncoder();
  const headerB64 = base64urlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  let privateKeyPem = env.DENTAL_FIREBASE_PRIVATE_KEY;
  if (typeof privateKeyPem === 'string') {
    privateKeyPem = privateKeyPem.replace(/\\n/g, '\n');
  }
  const keyBuffer = pemToArrayBuffer(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBuffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, encoder.encode(signingInput));
  const jwt = `${signingInput}.${base64urlEncode(signature)}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Token error:', errorText);
    throw new Error(`Token request failed: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// ====== 토큰 캐시 ======

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken(env) {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }
  cachedToken = await createServiceAccountToken(env);
  tokenExpiry = now + 50 * 60 * 1000;
  return cachedToken;
}

// ====== Firestore 유틸리티 ======

function firestoreValueToJS(value) {
  if (!value) return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return parseInt(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.nullValue !== undefined) return null;
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.mapValue) {
    const result = {};
    const fields = value.mapValue.fields || {};
    for (const [key, val] of Object.entries(fields)) {
      result[key] = firestoreValueToJS(val);
    }
    return result;
  }
  if (value.arrayValue) {
    return (value.arrayValue.values || []).map(firestoreValueToJS);
  }
  return null;
}

function jsToFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: value.toString() };
    return { doubleValue: value };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(jsToFirestoreValue) } };
  }
  if (typeof value === 'object') {
    const fields = {};
    for (const [key, val] of Object.entries(value)) {
      fields[key] = jsToFirestoreValue(val);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

// ====== Firestore CRUD ======

async function firestoreGet(env, path) {
  const token = await getAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${env.DENTAL_FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore GET failed: ${response.status}`);
  return response.json();
}

async function firestoreSet(env, path, data) {
  const token = await getAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${env.DENTAL_FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
  const fields = {};
  for (const [key, value] of Object.entries(data)) {
    fields[key] = jsToFirestoreValue(value);
  }
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  });
  if (!response.ok) throw new Error(`Firestore SET failed: ${response.status}`);
  return response.json();
}

async function firestoreDelete(env, path) {
  const token = await getAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${env.DENTAL_FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Firestore DELETE failed: ${response.status}`);
  }
  return true;
}

async function firestoreList(env, collectionPath) {
  const token = await getAccessToken(env);
  let allDocuments = [];
  let pageToken = null;
  do {
    let url = `https://firestore.googleapis.com/v1/projects/${env.DENTAL_FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionPath}?pageSize=100`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error(`Firestore LIST failed: ${response.status}`);
    }
    const data = await response.json();
    if (data.documents) allDocuments = allDocuments.concat(data.documents);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return allDocuments;
}

// ====== 마스터 관리자 인증 ======

function isMasterUser(request, env) {
  const userKey = request.headers.get('X-User-Key');
  if (!userKey) return false;
  const masterKeys = (env.MASTER_USER_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
  if (masterKeys.length === 0) return false;
  return masterKeys.includes(userKey);
}

// ====== 기본 마스터 브랜드 데이터 (초기 시드) ======

const DEFAULT_MASTER_BRANDS = [
  // 국산 (18개)
  { id: 'brand_osstem', name: '오스템임플란트', category: 'domestic', order: 0 },
  { id: 'brand_dentium', name: '덴티움', category: 'domestic', order: 1 },
  { id: 'brand_megagen', name: '메가젠임플란트', category: 'domestic', order: 2 },
  { id: 'brand_neobiotech', name: '네오바이오텍', category: 'domestic', order: 3 },
  { id: 'brand_dio', name: '디오', category: 'domestic', order: 4 },
  { id: 'brand_dentis', name: '덴티스', category: 'domestic', order: 5 },
  { id: 'brand_shinhung', name: '신흥 / evertis', category: 'domestic', order: 6 },
  { id: 'brand_ibs', name: 'IBS Implant', category: 'domestic', order: 7 },
  { id: 'brand_point', name: '포인트임플란트', category: 'domestic', order: 8 },
  { id: 'brand_cowell', name: '코웰메디', category: 'domestic', order: 9 },
  { id: 'brand_warantec', name: '워랜텍', category: 'domestic', order: 10 },
  { id: 'brand_biotem', name: '바이오템', category: 'domestic', order: 11 },
  { id: 'brand_snucone', name: 'SNUCONE', category: 'domestic', order: 12 },
  { id: 'brand_cubotech', name: '쿠보텍(쿠워텍)', category: 'domestic', order: 13 },
  { id: 'brand_cybermed', name: '사이버메드', category: 'domestic', order: 14 },
  { id: 'brand_highness', name: '하이니스', category: 'domestic', order: 15 },
  { id: 'brand_arum', name: '아룸(ARUM Dentistry)', category: 'domestic', order: 16 },
  { id: 'brand_chaorum', name: '차오름(Chaorum)', category: 'domestic', order: 17 },
  // 외산 (6개)
  { id: 'brand_straumann', name: '스트라우만', category: 'foreign', order: 18 },
  { id: 'brand_nobel', name: '노벨바이오케어', category: 'foreign', order: 19 },
  { id: 'brand_astra', name: '아스트라 테크', category: 'foreign', order: 20 },
  { id: 'brand_zimvie', name: 'ZimVie', category: 'foreign', order: 21 },
  { id: 'brand_sic', name: 'SIC', category: 'foreign', order: 22 },
  { id: 'brand_anthogyr', name: 'Anthogyr', category: 'foreign', order: 23 }
];

// ====== CORS 헤더 ======

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Key, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  };
}

// ====== JSON 응답 생성 ======

function jsonResponse(data, status = 200, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request)
    }
  });
}

// ====== API 라우터 ======

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request)
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ===================================================
      // ========== 기존 엔드포인트 (변경 없음) =============
      // ===================================================

      // --- Health Check ---
      if (path === '/api/health') {
        return jsonResponse({
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: '3.0.0-master-brands'
        }, 200, request);
      }

      // --- Auth Test ---
      if (path === '/api/auth/test') {
        try {
          const token = await getAccessToken(env);
          return jsonResponse({
            success: true,
            message: 'Firebase 인증 성공',
            projectId: env.DENTAL_FIREBASE_PROJECT_ID,
            hasToken: !!token
          }, 200, request);
        } catch (error) {
          return jsonResponse({
            success: false,
            message: 'Firebase 인증 실패',
            error: error.message
          }, 500, request);
        }
      }

      // --- User Data ---
      if (path === '/api/user-data') {
        const userKey = request.headers.get('X-User-Key');
        if (!userKey) return jsonResponse({ error: 'User key required' }, 401, request);

        if (request.method === 'GET') {
          const doc = await firestoreGet(env, `users/${userKey}`);
          if (!doc || !doc.fields) return jsonResponse({}, 200, request);
          const data = {};
          for (const [key, value] of Object.entries(doc.fields)) {
            data[key] = firestoreValueToJS(value);
          }
          return jsonResponse(data, 200, request);
        }

        if (request.method === 'PUT') {
          const body = await request.json();
          body.updated_at = new Date().toISOString();
          await firestoreSet(env, `users/${userKey}`, body);
          return jsonResponse({ success: true }, 200, request);
        }
      }

      // --- Brands (치과별 - 기존 유지) ---
      if (path === '/api/brands') {
        const userKey = request.headers.get('X-User-Key');
        if (!userKey) return jsonResponse({ error: 'User key required' }, 401, request);

        if (request.method === 'GET') {
          const doc = await firestoreGet(env, `brands/${userKey}`);
          if (!doc || !doc.fields) return jsonResponse({ brands: [] }, 200, request);
          const data = firestoreValueToJS({ mapValue: { fields: doc.fields } });
          return jsonResponse({ brands: data.brands || [] }, 200, request);
        }

        if (request.method === 'PUT') {
          const body = await request.json();
          await firestoreSet(env, `brands/${userKey}`, body);
          return jsonResponse({ success: true }, 200, request);
        }
      }

      // --- Settings (전체) ---
      if (path === '/api/settings') {
        const userKey = request.headers.get('X-User-Key');
        if (!userKey) return jsonResponse({ error: 'User key required' }, 401, request);

        if (request.method === 'GET') {
          const doc = await firestoreGet(env, `settings/${userKey}`);
          if (!doc || !doc.fields) return jsonResponse({}, 200, request);
          const data = {};
          for (const [key, value] of Object.entries(doc.fields)) {
            data[key] = firestoreValueToJS(value);
          }
          return jsonResponse(data, 200, request);
        }

        if (request.method === 'PUT') {
          const body = await request.json();
          body.updated_at = new Date().toISOString();
          await firestoreSet(env, `settings/${userKey}`, body);
          return jsonResponse({ success: true }, 200, request);
        }
      }

      // --- Settings (섹션별) ---
      const settingsMatch = path.match(/^\/api\/settings\/section\/(.+)$/);
      if (settingsMatch) {
        const sectionName = settingsMatch[1];
        const userKey = request.headers.get('X-User-Key');
        if (!userKey) return jsonResponse({ error: 'User key required' }, 401, request);

        if (request.method === 'GET') {
          const doc = await firestoreGet(env, `settings/${userKey}/sections/${sectionName}`);
          if (!doc || !doc.fields) return jsonResponse({}, 200, request);
          const data = {};
          for (const [key, value] of Object.entries(doc.fields)) {
            data[key] = firestoreValueToJS(value);
          }
          return jsonResponse(data, 200, request);
        }

        if (request.method === 'PUT') {
          const body = await request.json();
          body.updated_at = new Date().toISOString();
          await firestoreSet(env, `settings/${userKey}/sections/${sectionName}`, body);
          return jsonResponse({ success: true }, 200, request);
        }
      }

      // --- Additional Items ---
      if (path === '/api/additional-items') {
        const userKey = request.headers.get('X-User-Key');
        if (!userKey) return jsonResponse({ error: 'User key required' }, 401, request);

        if (request.method === 'GET') {
          const doc = await firestoreGet(env, `additional_items/${userKey}`);
          if (!doc || !doc.fields) return jsonResponse({ items: [] }, 200, request);
          const data = firestoreValueToJS({ mapValue: { fields: doc.fields } });
          return jsonResponse({ items: data.items || [] }, 200, request);
        }

        if (request.method === 'PUT') {
          const body = await request.json();
          body.updated_at = new Date().toISOString();
          await firestoreSet(env, `additional_items/${userKey}`, body);
          return jsonResponse({ success: true }, 200, request);
        }
      }

      // ===================================================
      // ========== 신규: 마스터 브랜드 관리 API ============
      // ===================================================

      // --- GET /api/master/brands : 마스터 브랜드 목록 (모든 사용자 읽기 가능) ---
      if (path === '/api/master/brands' && request.method === 'GET') {
        const doc = await firestoreGet(env, 'master_data/brands');

        if (!doc || !doc.fields) {
          // Firestore에 데이터 없으면 기본 브랜드 목록 반환 (자동 시드 아님, 읽기만)
          return jsonResponse({
            brands: DEFAULT_MASTER_BRANDS,
            source: 'default'
          }, 200, request);
        }

        const data = firestoreValueToJS({ mapValue: { fields: doc.fields } });
        return jsonResponse({
          brands: data.brands || [],
          source: 'firestore'
        }, 200, request);
      }

      // --- POST /api/master/brands : 브랜드 추가 (마스터 전용) ---
      if (path === '/api/master/brands' && request.method === 'POST') {
        if (!isMasterUser(request, env)) {
          return jsonResponse({ error: '마스터 관리자 권한이 필요합니다' }, 403, request);
        }

        const body = await request.json();
        if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
          return jsonResponse({ error: '브랜드명은 필수입니다' }, 400, request);
        }

        // 기존 브랜드 목록 가져오기
        const doc = await firestoreGet(env, 'master_data/brands');
        let brands = [];
        if (doc && doc.fields) {
          const data = firestoreValueToJS({ mapValue: { fields: doc.fields } });
          brands = data.brands || [];
        } else {
          // 첫 추가 시 기본 데이터로 시드
          brands = [...DEFAULT_MASTER_BRANDS];
        }

        // 중복 검사
        const exists = brands.some(b => b.name === body.name.trim());
        if (exists) {
          return jsonResponse({ error: '이미 존재하는 브랜드명입니다' }, 409, request);
        }

        // 새 브랜드 생성
        const newBrand = {
          id: `brand_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          name: body.name.trim(),
          category: body.category || 'domestic',
          order: brands.length
        };

        brands.push(newBrand);

        await firestoreSet(env, 'master_data/brands', {
          brands: brands,
          updated_at: new Date().toISOString()
        });

        return jsonResponse({ success: true, brand: newBrand }, 201, request);
      }

      // --- PUT /api/master/brands : 전체 브랜드 목록 저장 (마스터 전용, 순서 변경 등) ---
      if (path === '/api/master/brands' && request.method === 'PUT') {
        if (!isMasterUser(request, env)) {
          return jsonResponse({ error: '마스터 관리자 권한이 필요합니다' }, 403, request);
        }

        const body = await request.json();
        if (!Array.isArray(body.brands)) {
          return jsonResponse({ error: 'brands 배열이 필요합니다' }, 400, request);
        }

        await firestoreSet(env, 'master_data/brands', {
          brands: body.brands,
          updated_at: new Date().toISOString()
        });

        return jsonResponse({ success: true }, 200, request);
      }

      // --- DELETE /api/master/brands/:brandId : 브랜드 삭제 (마스터 전용) ---
      const brandDeleteMatch = path.match(/^\/api\/master\/brands\/([^/]+)$/);
      if (brandDeleteMatch && request.method === 'DELETE') {
        if (!isMasterUser(request, env)) {
          return jsonResponse({ error: '마스터 관리자 권한이 필요합니다' }, 403, request);
        }

        const brandId = brandDeleteMatch[1];

        // 브랜드 목록에서 제거
        const doc = await firestoreGet(env, 'master_data/brands');
        let brands = [];
        if (doc && doc.fields) {
          const data = firestoreValueToJS({ mapValue: { fields: doc.fields } });
          brands = data.brands || [];
        }

        const filtered = brands.filter(b => b.id !== brandId);
        if (filtered.length === brands.length) {
          return jsonResponse({ error: '해당 브랜드를 찾을 수 없습니다' }, 404, request);
        }

        // 순서 재정렬
        filtered.forEach((b, idx) => { b.order = idx; });

        await firestoreSet(env, 'master_data/brands', {
          brands: filtered,
          updated_at: new Date().toISOString()
        });

        // 관련 콘텐츠도 삭제
        try {
          await firestoreDelete(env, `master_data/brand_contents/items/${brandId}`);
        } catch (e) {
          // 콘텐츠가 없어도 무시
        }

        return jsonResponse({ success: true }, 200, request);
      }

      // --- PUT /api/master/brands/:brandId : 개별 브랜드 수정 (마스터 전용) ---
      const brandUpdateMatch = path.match(/^\/api\/master\/brands\/([^/]+)$/);
      if (brandUpdateMatch && request.method === 'PUT') {
        if (!isMasterUser(request, env)) {
          return jsonResponse({ error: '마스터 관리자 권한이 필요합니다' }, 403, request);
        }

        const brandId = brandUpdateMatch[1];
        const body = await request.json();

        const doc = await firestoreGet(env, 'master_data/brands');
        let brands = [];
        if (doc && doc.fields) {
          const data = firestoreValueToJS({ mapValue: { fields: doc.fields } });
          brands = data.brands || [];
        }

        const idx = brands.findIndex(b => b.id === brandId);
        if (idx === -1) {
          return jsonResponse({ error: '해당 브랜드를 찾을 수 없습니다' }, 404, request);
        }

        // 수정 가능 필드 업데이트
        if (body.name !== undefined) brands[idx].name = body.name.trim();
        if (body.category !== undefined) brands[idx].category = body.category;
        if (body.order !== undefined) brands[idx].order = body.order;

        await firestoreSet(env, 'master_data/brands', {
          brands: brands,
          updated_at: new Date().toISOString()
        });

        return jsonResponse({ success: true, brand: brands[idx] }, 200, request);
      }

      // ===================================================
      // ========== 신규: 마스터 브랜드 콘텐츠 API ==========
      // ===================================================

      // --- GET /api/master/brand-contents/:brandId : 브랜드 콘텐츠 조회 (모든 사용자) ---
      const contentGetMatch = path.match(/^\/api\/master\/brand-contents\/([^/]+)$/);
      if (contentGetMatch && request.method === 'GET') {
        const brandId = contentGetMatch[1];
        const doc = await firestoreGet(env, `master_data/brand_contents/items/${brandId}`);

        if (!doc || !doc.fields) {
          return jsonResponse({
            brand_id: brandId,
            categories: [],
            contents: {}
          }, 200, request);
        }

        const data = firestoreValueToJS({ mapValue: { fields: doc.fields } });
        return jsonResponse({
          brand_id: brandId,
          categories: data.categories || [],
          contents: data.contents || {}
        }, 200, request);
      }

      // --- PUT /api/master/brand-contents/:brandId : 브랜드 콘텐츠 저장 (마스터 전용) ---
      const contentPutMatch = path.match(/^\/api\/master\/brand-contents\/([^/]+)$/);
      if (contentPutMatch && request.method === 'PUT') {
        if (!isMasterUser(request, env)) {
          return jsonResponse({ error: '마스터 관리자 권한이 필요합니다' }, 403, request);
        }

        const brandId = contentPutMatch[1];
        const body = await request.json();

        // 유효성 검사
        if (!Array.isArray(body.categories)) {
          return jsonResponse({ error: 'categories 배열이 필요합니다' }, 400, request);
        }
        if (typeof body.contents !== 'object' || body.contents === null) {
          return jsonResponse({ error: 'contents 객체가 필요합니다' }, 400, request);
        }

        await firestoreSet(env, `master_data/brand_contents/items/${brandId}`, {
          brand_id: brandId,
          categories: body.categories,
          contents: body.contents,
          updated_at: new Date().toISOString()
        });

        return jsonResponse({ success: true }, 200, request);
      }

      // --- GET /api/master/brand-contents : 전체 브랜드 콘텐츠 목록 (모든 사용자) ---
      if (path === '/api/master/brand-contents' && request.method === 'GET') {
        const docs = await firestoreList(env, 'master_data/brand_contents/items');
        const allContents = {};

        for (const doc of docs) {
          if (doc.fields) {
            const data = firestoreValueToJS({ mapValue: { fields: doc.fields } });
            const bId = data.brand_id || doc.name.split('/').pop();
            allContents[bId] = {
              categories: data.categories || [],
              contents: data.contents || {}
            };
          }
        }

        return jsonResponse({ brand_contents: allContents }, 200, request);
      }

      // ===================================================
      // ========== 신규: 마스터 브랜드 초기화 API ==========
      // ===================================================

      // --- POST /api/master/brands/seed : 기본 브랜드 데이터로 초기화 (마스터 전용) ---
      if (path === '/api/master/brands/seed' && request.method === 'POST') {
        if (!isMasterUser(request, env)) {
          return jsonResponse({ error: '마스터 관리자 권한이 필요합니다' }, 403, request);
        }

        // 강제 초기화 여부
        const body = await request.json().catch(() => ({}));
        const force = body.force === true;

        // 이미 데이터 있는지 확인
        const existing = await firestoreGet(env, 'master_data/brands');
        if (existing && existing.fields && !force) {
          const data = firestoreValueToJS({ mapValue: { fields: existing.fields } });
          if (data.brands && data.brands.length > 0) {
            return jsonResponse({
              success: false,
              message: '이미 브랜드 데이터가 존재합니다. force:true 로 강제 초기화하세요.',
              current_count: data.brands.length
            }, 200, request);
          }
        }

        // 기본 데이터 저장
        await firestoreSet(env, 'master_data/brands', {
          brands: DEFAULT_MASTER_BRANDS,
          updated_at: new Date().toISOString(),
          seeded_at: new Date().toISOString()
        });

        return jsonResponse({
          success: true,
          message: `${DEFAULT_MASTER_BRANDS.length}개 브랜드가 초기화되었습니다`,
          brands: DEFAULT_MASTER_BRANDS
        }, 200, request);
      }

      // ===================================================
      // ========== 신규: 마스터 권한 확인 API ==============
      // ===================================================

      // --- GET /api/master/check : 마스터 권한 확인 ---
      if (path === '/api/master/check' && request.method === 'GET') {
        const isMaster = isMasterUser(request, env);
        return jsonResponse({
          is_master: isMaster,
          user_key: request.headers.get('X-User-Key') || null
        }, 200, request);
      }

      return jsonResponse({ error: 'Not found' }, 404, request);

    } catch (error) {
      console.error('API Error:', error);
      return jsonResponse({
        error: 'Internal server error',
        message: error.message
      }, 500, request);
    }
  }
};

# Dental Point - 치과 포인트 관리 시스템

## Project Overview
- **Name**: Dental Point
- **Version**: 4.2.0
- **Goal**: 치과 전자차트(DentWeb)와 연동하여 환자 포인트·쿠폰을 자동 관리하는 시스템
- **Platform**: Cloudflare Pages + D1 Database + Hono Framework

## URLs
- **Production**: https://dental-point.pages.dev
- **QR 스캔 (모바일)**: https://dental-point.pages.dev/scan
- **Widget (ImWeb)**: https://dpt-widget.pages.dev/widget-imweb.js

## 주요 기능

### v4.2.0 변경사항

#### 1. 대시보드 데이터 수정
- 최근 결제: `payments.created_at DESC` 기준 최신 5건 (환자명+연락처 포함)
- 최근 등록 환자: `patient_clinic.created_at DESC` 기준 최신 5명 (진료내용 표시)
- 오늘 결제/적립 카드 정상 표시
- DentWeb 연동 상태 카드 추가 (대시보드에서 바로 연동 상태 확인)
- DentWeb 연동 버튼 추가 → 클릭 시 연동 페이지로 이동

#### 2. 환자관리 진료내용 표시
- 결제 등록 시 `members.last_treatment`에 카테고리 자동 업데이트
- 환자 테이블에서 진료내용 컬럼에 마지막 진료항목 표시
- 결제가 있지만 진료 구분이 없으면 "일반진료"로 표시

#### 3. QR 스캔 페이지 완전 재구성
- **카메라 우선 사용**: 페이지 로드 시 카메라 자동 시작
- **jsQR 라이브러리** 사용하여 실시간 QR 코드 스캔
- **후면 카메라 우선**: 모바일에서 `facingMode: environment` 적용
- **3가지 탭**: 카메라 | 환자 검색 | 코드 입력
- **카메라 접근 오류 처리**: 
  - NotAllowedError: 권한 거부 안내
  - NotFoundError: 카메라 없음 안내
  - 다시 시도/권한 설정 버튼
- **쿠폰 확인 → 사용 처리 flow**: QR 인식 → 쿠폰 정보 표시 → 사용 처리 확인
- **공개 API**: `/api/coupons/check/:code`, `/api/coupons/use/:code` (인증 불필요)

#### 4. DentWeb 연동 가이드 대폭 개선
- 4단계 설치 가이드 (dwpublic 활성화 → 브릿지 설치 → config.ini 설정 → 실행/자동화)
- config.ini 예시 (현재 clinic_id, admin_phone 자동 대입)
- 데이터 매핑 상세표 (DentWeb 필드 → 포인트 시스템 필드 + 설명)
- FAQ 섹션 (연결 안됨, 환자 중복, 동기화 주기, 결제 누락 등)
- Windows 작업 스케줄러 자동 실행 방법

### 기존 기능

#### 인증 시스템
- 관리자 로그인, 아임웹 회원 자동 매칭, 내 정보 조회/수정

#### 환자/결제 관리
- 환자 CRUD, 결제 등록 & 포인트 적립, 대량 업로드 (Excel)

#### 쿠폰 시스템
- 쿠폰 템플릿 CRUD, 쿠폰 발행/공유/회수
- 자동 쿠폰 발행 (포인트 달성 시)

#### DentWeb 자동 연동
- 환자/결제/내원 동기화 API
- DentWeb 브릿지 프로그램 (PyInstaller .exe)

## API 엔드포인트 요약

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET | /api/health | - | 헬스체크 |
| POST | /api/auth/login | - | 로그인 |
| POST | /api/auth/imweb-match | - | 아임웹 매칭 |
| GET/PUT | /api/auth/me | O | 내 정보 |
| GET/PUT | /api/clinics/:id | O(PUT) | 치과 정보 |
| PUT | /api/clinics/:id/settings | O | 치과 설정 |
| GET/POST/PUT/DELETE | /api/clinics/:id/patients(/:pid) | O | 환자 관리 |
| GET/POST | /api/payments | O | 결제 |
| POST | /api/payments/bulk | O | 대량 업로드 |
| GET | /api/dashboard | O | 대시보드 |
| GET/POST/PUT/DELETE | /api/coupons/templates(/:id) | O | 쿠폰 템플릿 |
| POST | /api/coupons/issue | O | 쿠폰 발행 |
| GET | /api/coupons/clinic | O | 치과별 쿠폰 |
| **GET** | **/api/coupons/check/:code** | **-** | **쿠폰 조회 (QR스캔)** |
| **POST** | **/api/coupons/use/:code** | **-** | **쿠폰 사용 처리 (QR스캔)** |
| POST | /api/sync/patients | O | DentWeb 환자 동기화 |
| POST | /api/sync/payments | O | DentWeb 결제 동기화 |
| POST | /api/sync/visits | O | DentWeb 내원 동기화 |
| GET | /api/sync/status | O | 동기화 상태 |

## 배포
- **Platform**: Cloudflare Pages
- **Status**: v4.2.0 Active
- **Tech Stack**: Hono + TypeScript + TailwindCSS (CDN) + Cloudflare D1
- **Last Updated**: 2026-03-14

## 변경 이력
- **v4.2.0** (2026-03-14): 대시보드 데이터 수정, 진료내용 표시, QR카메라 재구성, DentWeb 연동 가이드 대폭 개선
- **v4.1.0** (2026-03-14): 자동 쿠폰 발행, 브릿지 v2.0 (PyInstaller), DentWeb 탭 개선
- **v4.0.0** (2026-03-14): 백엔드 전체 재구축, DentWeb Sync API, DB 스키마 확장
- **v3.0.0**: 쿠폰 CRUD, 이미지표시, 아임웹 연동

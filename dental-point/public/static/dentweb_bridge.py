#!/usr/bin/env python3
"""
DentWebBridge v1.0 - DentWeb <-> Dental Point 동기화 브릿지
pip install pymssql requests
python dentweb_bridge.py --setup    (연동 코드로 초기 설정)
python dentweb_bridge.py --test     (연결 테스트)
python dentweb_bridge.py --once     (1회 동기화)
python dentweb_bridge.py            (반복 동기화)
python dentweb_bridge.py --install  (Windows 작업 스케줄러 등록)
"""
import sys, os, json, time, argparse, configparser, subprocess
from datetime import datetime, timedelta

VER = '1.0.0'
CFG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.ini')

def log(msg, level='INFO'):
    ts = datetime.now().strftime('%H:%M:%S')
    print(f'[{ts}] [{level}] {msg}')

def load_config():
    if not os.path.exists(CFG_FILE):
        return None
    cfg = configparser.ConfigParser()
    cfg.read(CFG_FILE, encoding='utf-8')
    return cfg

def save_config(cfg):
    with open(CFG_FILE, 'w', encoding='utf-8') as f:
        cfg.write(f)
    log(f'config.ini 저장 완료: {CFG_FILE}')

# ==================== SETUP (연동 코드) ====================
def do_setup():
    try:
        import requests
    except ImportError:
        log('requests 패키지 필요: pip install requests', 'ERROR')
        return False
    
    print('\n' + '='*50)
    print(f'  DentWebBridge 초기 설정 (v{VER})')
    print('='*50)
    print('\n관리자 페이지에서 생성한 6자리 연동 코드를 입력하세요.')
    print('(30분간 유효합니다)\n')
    
    code = input('연동 코드: ').strip().upper()
    if len(code) != 6:
        log('6자리 코드를 입력하세요.', 'ERROR')
        return False
    
    # Verify code
    api_url = input('API URL (Enter=https://dental-point.pages.dev/api): ').strip()
    if not api_url:
        api_url = 'https://dental-point.pages.dev/api'
    
    log(f'코드 확인 중... ({code})')
    try:
        r = requests.get(f'{api_url}/setup/verify/{code}', timeout=10)
        data = r.json()
    except Exception as e:
        log(f'서버 연결 실패: {e}', 'ERROR')
        return False
    
    if not r.ok or not data.get('valid'):
        log(f'코드 오류: {data.get("error", "알 수 없는 오류")}', 'ERROR')
        return False
    
    clinic_name = data.get('clinic_name', '')
    clinic_id = data.get('clinic_id', 1)
    admin_phone = data.get('admin_phone', '')
    
    print(f'\n  치과: {clinic_name}')
    print(f'  치과 ID: {clinic_id}')
    print(f'  관리자: {admin_phone}')
    
    # DentWeb DB 설정
    print('\n--- DentWeb DB 설정 ---')
    server = input('DentWeb 서버 IP (Enter=localhost): ').strip() or 'localhost'
    port = input('포트 (Enter=1436): ').strip() or '1436'
    
    # 관리자 비밀번호 입력
    admin_pw = input(f'관리자 비밀번호 ({admin_phone}): ').strip()
    if not admin_pw:
        log('비밀번호가 필요합니다.', 'ERROR')
        return False
    
    # config.ini 생성
    cfg = configparser.ConfigParser()
    cfg['dentweb'] = {
        'server': server,
        'port': port,
        'instance': 'DENTWEB',
        'database': 'DentWeb',
        'user': 'dwpublic',
        'password': 'dwpublic2!'
    }
    cfg['dental_point'] = {
        'api_url': api_url,
        'admin_phone': admin_phone,
        'admin_password': admin_pw,
        'clinic_id': str(clinic_id)
    }
    cfg['sync'] = {
        'interval_minutes': '5',
        'payment_days_back': '3',
        'run_once': 'false'
    }
    save_config(cfg)
    
    # Activate code
    try:
        requests.post(f'{api_url}/setup/activate/{code}', timeout=10)
        log('연동 코드 활성화 완료')
    except:
        pass
    
    # Test connection
    print('\n--- 연결 테스트 ---')
    return do_test(cfg)

# ==================== TEST ====================
def do_test(cfg=None):
    try:
        import pymssql, requests
    except ImportError:
        log('필요 패키지: pip install pymssql requests', 'ERROR')
        return False
    
    if cfg is None:
        cfg = load_config()
    if not cfg:
        log('config.ini 없음. --setup 먼저 실행하세요.', 'ERROR')
        return False
    
    ok = True
    
    # Test DentWeb DB
    log('DentWeb DB 연결 테스트...')
    try:
        conn = pymssql.connect(
            server=cfg['dentweb']['server'],
            port=int(cfg['dentweb']['port']),
            user=cfg['dentweb']['user'],
            password=cfg['dentweb']['password'],
            database=cfg['dentweb']['database'],
            login_timeout=5
        )
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM dbo.t_환자정보")
        cnt = cur.fetchone()[0]
        conn.close()
        log(f'  DentWeb DB 연결 성공 (환자 {cnt}명)')
    except Exception as e:
        log(f'  DentWeb DB 연결 실패: {e}', 'ERROR')
        ok = False
    
    # Test API
    log('Dental Point API 연결 테스트...')
    api = cfg['dental_point']['api_url']
    try:
        r = requests.get(f'{api}/health', timeout=10)
        data = r.json()
        log(f'  API 연결 성공 (v{data.get("version", "?")})')
    except Exception as e:
        log(f'  API 연결 실패: {e}', 'ERROR')
        ok = False
    
    # Test login
    log('관리자 로그인 테스트...')
    try:
        r = requests.post(f'{api}/auth/login', json={
            'phone': cfg['dental_point']['admin_phone'],
            'password': cfg['dental_point']['admin_password']
        }, timeout=10)
        data = r.json()
        if data.get('token'):
            log(f'  로그인 성공: {data["member"]["name"]}')
        else:
            log(f'  로그인 실패: {data.get("error", "?")}', 'ERROR')
            ok = False
    except Exception as e:
        log(f'  로그인 실패: {e}', 'ERROR')
        ok = False
    
    if ok:
        log('모든 테스트 통과!', 'INFO')
    else:
        log('일부 테스트 실패. config.ini를 확인하세요.', 'WARN')
    return ok

# ==================== SYNC ====================
def get_token(cfg):
    import requests
    api = cfg['dental_point']['api_url']
    r = requests.post(f'{api}/auth/login', json={
        'phone': cfg['dental_point']['admin_phone'],
        'password': cfg['dental_point']['admin_password']
    }, timeout=10)
    data = r.json()
    if not data.get('token'):
        raise Exception(f'로그인 실패: {data.get("error", "?")}')
    return data['token']

def sync_patients(cfg, token):
    import pymssql, requests
    api = cfg['dental_point']['api_url']
    clinic_id = int(cfg['dental_point']['clinic_id'])
    
    conn = pymssql.connect(
        server=cfg['dentweb']['server'],
        port=int(cfg['dentweb']['port']),
        user=cfg['dentweb']['user'],
        password=cfg['dentweb']['password'],
        database=cfg['dentweb']['database'],
        login_timeout=5,
        charset='utf8'
    )
    cur = conn.cursor(as_dict=True)
    cur.execute("""
        SELECT n환자ID, sz차트번호, sz이름, sz휴대폰, sz주민번호앞, sz성별,
               (SELECT MAX(dt접수일) FROM dbo.t_접수 WHERE n환자ID = p.n환자ID) as last_visit
        FROM dbo.t_환자정보 p
        WHERE sz이름 IS NOT NULL AND sz이름 != ''
    """)
    rows = cur.fetchall()
    conn.close()
    
    patients = []
    for r in rows:
        birth = ''
        ssn = (r.get('sz주민번호앞') or '').strip()
        if len(ssn) == 6:
            y = int(ssn[:2])
            birth = f'{"19" if y > 30 else "20"}{ssn[:2]}-{ssn[2:4]}-{ssn[4:6]}'
        
        phone = (r.get('sz휴대폰') or '').strip().replace('-', '')
        if phone and len(phone) >= 10:
            phone = f'{phone[:3]}-{phone[3:7]}-{phone[7:]}'
        
        lv = r.get('last_visit')
        last_visit = lv.strftime('%Y-%m-%d') if lv else None
        
        patients.append({
            'dentweb_id': r['n환자ID'],
            'chart_number': (r.get('sz차트번호') or '').strip(),
            'name': (r.get('sz이름') or '').strip(),
            'phone': phone,
            'birth_date': birth,
            'gender': (r.get('sz성별') or '').strip() or None,
            'last_visit_date': last_visit
        })
    
    if not patients:
        log('동기화할 환자가 없습니다.')
        return
    
    # Send in batches of 200
    total_new, total_upd, total_err = 0, 0, 0
    for i in range(0, len(patients), 200):
        batch = patients[i:i+200]
        r = requests.post(f'{api}/sync/patients', json={
            'clinic_id': clinic_id,
            'patients': batch
        }, headers={'Authorization': f'Bearer {token}'}, timeout=30)
        data = r.json()
        total_new += data.get('new_count', 0)
        total_upd += data.get('updated_count', 0)
        total_err += data.get('error_count', 0)
    
    log(f'환자 동기화: 전체 {len(patients)} / 신규 {total_new} / 업데이트 {total_upd} / 오류 {total_err}')

def sync_payments(cfg, token):
    import pymssql, requests
    api = cfg['dental_point']['api_url']
    clinic_id = int(cfg['dental_point']['clinic_id'])
    days_back = int(cfg['sync'].get('payment_days_back', '3'))
    
    since = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
    
    conn = pymssql.connect(
        server=cfg['dentweb']['server'],
        port=int(cfg['dentweb']['port']),
        user=cfg['dentweb']['user'],
        password=cfg['dentweb']['password'],
        database=cfg['dentweb']['database'],
        login_timeout=5,
        charset='utf8'
    )
    cur = conn.cursor(as_dict=True)
    cur.execute(f"""
        SELECT r.n접수ID, r.n환자ID, p.sz차트번호, p.sz휴대폰,
               r.dt접수일, r.n본인부담금, r.n비급여, r.sz진료내용
        FROM dbo.t_접수 r
        JOIN dbo.t_환자정보 p ON r.n환자ID = p.n환자ID
        WHERE r.dt접수일 >= %s
          AND (r.n본인부담금 > 0 OR r.n비급여 > 0)
    """, (since,))
    rows = cur.fetchall()
    conn.close()
    
    payments = []
    for r in rows:
        amt = (r.get('n본인부담금') or 0) + (r.get('n비급여') or 0)
        if amt <= 0:
            continue
        dt = r.get('dt접수일')
        payments.append({
            'dentweb_receipt_id': r['n접수ID'],
            'patient_dentweb_id': r['n환자ID'],
            'patient_chart_number': (r.get('sz차트번호') or '').strip(),
            'patient_phone': (r.get('sz휴대폰') or '').strip(),
            'amount': int(amt),
            'category': (r.get('sz진료내용') or '일반진료').strip() or '일반진료',
            'payment_date': dt.strftime('%Y-%m-%d') if dt else datetime.now().strftime('%Y-%m-%d'),
            'description': f'DentWeb 자동동기화'
        })
    
    if not payments:
        log(f'동기화할 결제가 없습니다. ({since}~ )')
        return
    
    for i in range(0, len(payments), 100):
        batch = payments[i:i+100]
        r = requests.post(f'{api}/sync/payments', json={
            'clinic_id': clinic_id,
            'payments': batch
        }, headers={'Authorization': f'Bearer {token}'}, timeout=30)
        data = r.json()
    
    log(f'결제 동기화: 전체 {len(payments)}건 ({since}~)')

def do_sync(cfg=None, once=False):
    if cfg is None:
        cfg = load_config()
    if not cfg:
        log('config.ini 없음. --setup 먼저 실행하세요.', 'ERROR')
        return False
    
    interval = int(cfg['sync'].get('interval_minutes', '5'))
    if cfg['sync'].get('run_once', 'false').lower() == 'true':
        once = True
    
    log(f'DentWebBridge v{VER} 시작' + (' (1회)' if once else f' (매 {interval}분)'))
    
    while True:
        try:
            token = get_token(cfg)
            sync_patients(cfg, token)
            sync_payments(cfg, token)
            log('동기화 완료')
        except Exception as e:
            log(f'동기화 오류: {e}', 'ERROR')
        
        if once:
            break
        
        log(f'다음 동기화: {interval}분 후')
        time.sleep(interval * 60)
    
    return True

# ==================== INSTALL (Windows Task Scheduler) ====================
def do_install():
    if sys.platform != 'win32':
        log('Windows에서만 지원됩니다.', 'ERROR')
        return False
    
    script = os.path.abspath(__file__)
    python = sys.executable
    task_name = 'DentWebBridge'
    
    cmd = f'schtasks /create /tn "{task_name}" /tr "\"{python}\" \"{script}\"" /sc onlogon /rl highest /f'
    try:
        subprocess.run(cmd, shell=True, check=True)
        log(f'작업 스케줄러 등록 완료: {task_name}')
        log('PC 로그인 시 자동 실행됩니다.')
        return True
    except Exception as e:
        log(f'등록 실패: {e}', 'ERROR')
        log('관리자 권한으로 실행하세요.', 'WARN')
        return False

# ==================== MAIN ====================
def main():
    parser = argparse.ArgumentParser(description=f'DentWebBridge v{VER}')
    parser.add_argument('--setup', action='store_true', help='연동 코드로 초기 설정')
    parser.add_argument('--test', action='store_true', help='연결 테스트')
    parser.add_argument('--once', action='store_true', help='1회 동기화')
    parser.add_argument('--install', action='store_true', help='Windows 작업 스케줄러 등록')
    args = parser.parse_args()
    
    print(f'\n  DentWebBridge v{VER}')
    print(f'  config: {CFG_FILE}\n')
    
    if args.setup:
        do_setup()
    elif args.test:
        do_test()
    elif args.install:
        do_install()
    else:
        do_sync(once=args.once)

if __name__ == '__main__':
    main()

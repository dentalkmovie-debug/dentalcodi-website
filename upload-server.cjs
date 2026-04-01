const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 7788;
const UPLOAD_DIR = '/home/user/webapp';

const server = http.createServer((req, res) => {
    // CORS 허용
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // 업로드 페이지 서빙
    if (req.method === 'GET' && (req.url === '/' || req.url === '/upload' || req.url === '/upload.html')) {
        const htmlPath = fs.existsSync(path.join(UPLOAD_DIR, 'public/upload.html'))
            ? path.join(UPLOAD_DIR, 'public/upload.html')
            : path.join(UPLOAD_DIR, 'upload.html');
        const html = fs.readFileSync(htmlPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
    }

    // dental-widget.html 다운로드
    if (req.method === 'GET' && req.url === '/download') {
        const filePath = path.join(UPLOAD_DIR, 'dental-widget.html');
        if (!fs.existsSync(filePath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'dental-widget.html 파일이 없습니다' }));
            return;
        }
        const stat = fs.statSync(filePath);
        const today = new Date().toISOString().slice(0, 10);
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Disposition': `attachment; filename="dental-widget-${today}.html"`,
            'Content-Length': stat.size
        });
        fs.createReadStream(filePath).pipe(res);
        return;
    }

    // worker-with-widget.js 다운로드
    if (req.method === 'GET' && req.url === '/worker-with-widget.js') {
        const filePath = path.join(UPLOAD_DIR, 'dist/worker-with-widget.js');
        if (!fs.existsSync(filePath)) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
            return;
        }
        const stat = fs.statSync(filePath);
        res.writeHead(200, {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Content-Disposition': 'attachment; filename="worker-with-widget.js"',
            'Content-Length': stat.size
        });
        fs.createReadStream(filePath).pipe(res);
        return;
    }

    // 파일 업로드 처리
    if (req.method === 'POST' && req.url === '/upload') {
        let body = [];
        req.on('data', chunk => body.push(chunk));
        req.on('end', () => {
            const buffer = Buffer.concat(body);
            const bodyStr = buffer.toString('binary');

            // Content-Type에서 boundary 추출
            const contentType = req.headers['content-type'] || '';
            const boundaryMatch = contentType.match(/boundary=(.+)$/);
            if (!boundaryMatch) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'boundary 없음' }));
                return;
            }

            const boundary = '--' + boundaryMatch[1];

            // 파일명 추출
            const filenameMatch = bodyStr.match(/filename="([^"]+)"/);
            if (!filenameMatch) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: '파일명 없음' }));
                return;
            }

            const filename = path.basename(filenameMatch[1]);

            // html 파일만 허용
            if (!filename.endsWith('.html')) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: '.html 파일만 허용됩니다' }));
                return;
            }

            // 파일 내용 추출 (헤더 이후 \r\n\r\n 다음부터)
            const headerEndStr = '\r\n\r\n';
            const headerEndIdx = bodyStr.indexOf(headerEndStr, bodyStr.indexOf('filename='));
            if (headerEndIdx === -1) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: '파일 내용 파싱 실패' }));
                return;
            }

            const contentStart = headerEndIdx + headerEndStr.length;
            // boundary로 끝 찾기
            const endBoundary = '\r\n' + boundary + '--';
            let contentEnd = bodyStr.lastIndexOf(endBoundary);
            if (contentEnd === -1) contentEnd = buffer.length;

            const fileBuffer = buffer.slice(contentStart, contentEnd);

            // 저장 경로: dental-widget.html 고정
            const savePath = path.join(UPLOAD_DIR, 'dental-widget.html');
            fs.writeFileSync(savePath, fileBuffer);

            console.log(`✅ 파일 저장 완료: ${savePath} (${fileBuffer.length} bytes)`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                path: savePath,
                size: fileBuffer.length
            }));
        });
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`업로드 서버 실행 중: http://0.0.0.0:${PORT}`);
});

#!/bin/bash
# Cloudflare Pages 배포 스크립트

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "❌ CLOUDFLARE_API_TOKEN 환경변수가 필요합니다."
  echo "사용법: CLOUDFLARE_API_TOKEN=your_token ./deploy.sh"
  exit 1
fi

echo "🔨 빌드 중..."
npm run build

echo "📦 minified 위젯 복사..."
mkdir -p dist/minified
cp minified/*.min.js dist/minified/
cp minified/*.min.html dist/minified/

echo "🚀 Cloudflare Pages 배포 중..."
npx wrangler pages deploy dist --project-name=dental-tv

echo "✅ 배포 완료!"

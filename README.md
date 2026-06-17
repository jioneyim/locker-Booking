# DS 사물함 예약 시스템

기존 CDN/Babel 단일 HTML 코드를 Vite React 배포 구조로 바꾼 프로젝트입니다.

## 로컬 실행

```bash
npm install
npm run dev
```

## 배포 빌드

```bash
npm run build
```

Netlify 설정:

- Build command: `npm run build`
- Publish directory: `dist`

또는 `netlify.toml`이 포함되어 있으므로 GitHub 연동 배포 시 자동으로 인식됩니다.

## 주의

현재 관리자 비밀번호 검증은 프론트엔드에서 이루어집니다. 실제 운영용으로 쓰려면 Firestore Security Rules와 Firebase Authentication 기반 권한 분리가 필요합니다.

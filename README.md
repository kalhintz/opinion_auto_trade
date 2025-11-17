# Opinion Trade Auto Trading Bot

Opinion Trade 플랫폼의 자동 거래 봇입니다.

## 🚀 주요 기능

- 토픽 자동 로딩 및 선택
- YES/NO 양방향 자동 주문
- EIP-712 서명을 통한 안전한 거래
- 실시간 거래 로그 모니터링
- Electron 기반 데스크톱 GUI

## 📦 설치
```bash
npm install
```

## ⚙️ 설정

1. `.env.example` 파일을 복사하여 `.env` 파일 생성:
```bash
cp .env.example .env
```

2. `.env` 파일을 열고 본인의 정보로 수정:
```env
# Opinion Trade API 설정
BEARER_TOKEN=your_bearer_token_here
DEVICE_FINGERPRINT=your_device_fingerprint_here

# 지갑 주소 설정
SIGNER_ADDRESS=0xYourSignerAddress
MAKER_ADDRESS=0xYourMakerAddress

# 프라이빗 키 (절대 공유하지 마세요!)
PRIVATE_KEY=0xYourPrivateKeyHere

# 거래 설정
ORDER_AMOUNT=5.0
```

### 환경 변수 설명

| 변수 | 설명 | 필수 |
|------|------|------|
| `BEARER_TOKEN` | Opinion Trade API 인증 토큰 | ✅ |
| `DEVICE_FINGERPRINT` | 디바이스 식별자 | ✅ |
| `SIGNER_ADDRESS` | EIP-712 서명 주소 | ✅ |
| `MAKER_ADDRESS` | 주문 생성자 주소 | ✅ |
| `PRIVATE_KEY` | 서명용 프라이빗 키 | ✅ |
| `ORDER_AMOUNT` | 주문당 금액 (USDT) | ❌ (기본값: 5.0) |

⚠️ **경고**: `.env` 파일은 절대 Git에 커밋하지 마세요! (`.gitignore`에 포함됨)

## 🎮 실행
```bash
npm start
```

## 🔧 개발 모드 (로그 출력)
```bash
npm run dev
```

## 📦 빌드
```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## 📖 사용법

1. 봇 실행 후 **"토픽 로드"** 버튼 클릭
2. 거래할 토픽 선택
3. **"거래 시작"** 버튼으로 자동 주문 실행
4. 로그에서 실시간 거래 결과 확인

### 키보드 단축키

- `Ctrl + R` 또는 `F5`: 토픽 새로고침
- `Enter`: 거래 시작
- `Ctrl + L`: 로그 지우기
- `Esc`: 설정 창 닫기

## 🛠 기술 스택

- **Electron**: 데스크톱 애플리케이션 프레임워크
- **ethers.js v6**: 이더리움 지갑 및 서명
- **EIP-712**: Typed Data 서명 표준
- **Opinion Trade API**: BSC 체인 예측 마켓

## 📁 프로젝트 구조
```
opinion-trade-bot/
├── main.js           # Electron 메인 프로세스
├── preload.js        # IPC 브릿지
├── renderer.js       # UI 로직
├── index.html        # UI 레이아웃
├── styles.css        # 스타일
├── .env              # 환경 변수 (Git 제외)
├── .env.example      # 환경 변수 템플릿
└── package.json      # 프로젝트 설정
```

## ⚠️ 주의사항

- 실제 자금이 사용되므로 신중하게 사용하세요
- Bearer Token은 주기적으로 만료되므로 업데이트 필요
- **Private Key는 절대 공유하지 마세요**
- `.env` 파일은 절대 Git에 커밋하지 마세요
- 테스트는 소액으로 먼저 진행하세요

## 🔒 보안

- `.env` 파일은 `.gitignore`에 포함되어 Git에서 제외됩니다
- Private Key는 로컬에서만 사용되며 외부로 전송되지 않습니다
- Bearer Token은 HTTPS를 통해서만 전송됩니다

## 🐛 트러블슈팅

### "Invalid price" 오류가 발생합니다
- 가격 정밀도 문제일 수 있습니다. 최신 버전인지 확인하세요.

### Bearer Token 만료 오류
- Opinion Trade 웹사이트에서 새 토큰을 발급받아 `.env` 파일 또는 설정 메뉴에서 업데이트하세요.

### 주문이 실패합니다
- USDT 잔액을 확인하세요
- `ORDER_AMOUNT`를 줄여보세요
- 네트워크 연결을 확인하세요

## 📄 라이센스

MIT

## 🤝 기여

이슈와 PR은 언제나 환영합니다!

## ⚖️ 면책 조항

이 봇은 교육 목적으로 제공됩니다. 실제 거래에서 발생하는 손실에 대해 개발자는 책임지지 않습니다. 사용자의 책임 하에 사용하세요.

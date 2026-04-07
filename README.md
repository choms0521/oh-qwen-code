# Oh My Qwen (OMQ)

> Multi-agent orchestration framework for Qwen Code

## 역할 (Purpose)

Oh My Qwen (OMQ)은 **Qwen Code를 위한 멀티 에이전트 오케스트레이션 프레임워크**입니다.
19개의 전문화된 AI 에이전트를 자동으로 배치하여 복잡한 소프트웨어 엔지니어링 작업을
분할·병렬 실행·검증합니다.

### 핵심 가치
- **Delegate Intelligently**: 작업을 전문 Agent에 분배
- **Parallelize Ruthlessly**: 독립 작업은 병렬로 실행
- **Route by Complexity**: 작업 복잡도에 따라 qwen-turbo / qwen-plus / qwen-max 자동 라우팅
- **Verify Everything**: 빌드/테스트/lint로 검증 후 완료 선언
- **Loop on Failure**: 실패 시 자동 수정 → 재검증

---

## 설치 방법 (Installation)

### 1. 저장소 클론

```bash
git clone https://github.com/choms0521/oh-qwen-code.git
cd oh-qwen-code
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 빌드 확인

```bash
npx tsc --noEmit     # 타입 체크
npm run lint         # 린트 체크
npm test             # 테스트 실행
```

### 4. Qwen Code에 확장 설치

```bash
# Qwen Code에서 확장 링크 (또는 플러그인 디렉토리에 복사)
qwen extensions link ./oh-qwen-code

# 또는 전역 설치
omq install --force
```

### 필수 환경

| 요구사항 | 버전 |
|---------|------|
| Node.js | >= 20.0.0 |
| npm | >= 10 |
| Python 3 | (Python REPL용, 선택) |

### 선택 환경 (LSP 도구 활성화 시)

```bash
# TypeScript/JavaScript
npm install -g typescript-language-server typescript

# Python
pip install python-lsp-server

# 기타 언어 (rust-analyzer, gopls, clangd 등)
```

---

## 사용 방법 (Usage)

### 키워드 기반 자동 활성화

프롬프트에 다음 키워드를 포함하면 OMQ가 자동으로 해당 모드를 활성화합니다:

| 키워드 | 동작 |
|--------|------|
| `autopilot` | 완전 자율 실행 모드 |
| `ultrawork` / `ulw` | 최대 병렬 실행 |
| `ralph` | 완료 검증까지 지속 |
| `team N:agent` | N개 Agent 동시 실행 |
| `ultraqa` | QA 사이클링 until goal met |
| `plan this` | 전략적 계획 수립 |
| `deepinit` | 계층적 AGENTS.md 생성 |
| `deslop` / `anti-slop` | AI slop 정리 |
| `search codebase` | 코드베이스 탐색 |
| `review code` / `review pr` | 코드 리뷰 |

### Agent 수동 호출

```
Task(
  subagent_type: "explore",
  prompt: "Find all API endpoints in the codebase",
  description: "Search for route definitions"
)
```

### MCP 도구 사용

Qwen Code가 자동으로 MCP 도구를 로드합니다:

```
omq_lsp(action="diagnostics")          # 타입/린트 에러 확인
omq_ast(action="structure", path="src") # 코드 구조 분석
omq_python(code="import pandas as pd")  # Python 실행
omq_node(code="console.log([1,2,3])")   # Node.js 실행
omq_plan(action="create", title="...")  # 계획 관리
omq_notify(title="완료", message="...") # 알림 전송
```

---

## 구성 요소 (Components)

### 🤖 Agent 시스템 (19개)

Qwen 모델 Tier에 따라 3단계로 분류됩니다:

#### qwen-turbo (LOW) — 빠른 탐색/단순 작업
| Agent | 역할 |
|-------|------|
| **explore** | 코드베이스 탐색, 패턴 매칭, 키워드 검색 |
| **writer** | 기술 문서, README, API 문서 작성 |
| **tracer** | 실행 흐름 추적, 가설 검증 |

#### qwen-plus (MEDIUM) — 표준 구현/검증
| Agent | 역할 |
|-------|------|
| **debugger** | 루트 원인 분석, 빌드/컴파일 에러 수정 |
| **executor** | 기능 구현, 리팩토링, 자율 작업 |
| **verifier** | 완료 검증, 테스트 적합성 검증 |
| **security-reviewer** | 보안 취약점 분석 (OWASP Top 10) |
| **test-engineer** | 테스트 전략, TDD, Flaky 테스트 개선 |
| **designer** | UI/UX 디자인, 모던 스타일링 |
| **qa-tester** | CLI 인터랙티브 테스트 |
| **scientist** | 데이터 분석, 연구 실행 |
| **git-master** | Git 작업, Atomic 커밋, Rebase |
| **document-specialist** | 외부 문서/SDK/API 조사 |

#### qwen-max (HIGH) — 복잡한 추론/설계
| Agent | 역할 |
|-------|------|
| **analyst** | 요구사항 분석, 숨은 제약 발견 |
| **planner** | 작업 분할, 시퀀싱, 위험 요소 파악 |
| **architect** | 시스템 설계, 인터페이스, trade-off 분석 (READ-ONLY) |
| **code-reviewer** | 종합 코드 리뷰 — 로직 결함, SOLID, 성능 |
| **code-simplifier** | 코드 단순화, 일관성, 유지보수성 개선 |
| **critic** | 계획 리뷰, 다각도 갭 분석 |

---

### 🪝 Hooks 시스템 (7개 이벤트)

Qwen Code의 라이프사이클에 자동으로 연결됩니다:

| 이벤트 | 타이밍 | 역할 |
|--------|--------|------|
| `UserPromptSubmit` | 사용자 입력 전송 전 | 키워드 감지, 스킬 활성화 |
| `SessionStart` | 세션 시작 | 상태 초기화, 프로젝트 메모리 로드 |
| `PreToolUse` | 도구 실행 전 | 권한 검증, 위험 명령 차단 |
| `PostToolUse` | 도구 실행 후 | 결과 검증, 메모리 업데이트 |
| `SubagentStart` | 서브에이전트 시작 | 실행 추적 |
| `SubagentStop` | 서브에이전트 종료 | 산출물 검증 |
| `SessionEnd` | 세션 종료 | 상태 아카이브, 정리 |

---

### 🔧 MCP 도구 서버 (15개 도구)

Model Context Protocol을 통해 Qwen Code에 도구를 제공합니다:

#### LSP 도구 (실제 언어 서버 프로토콜)
| 도구 | 기능 |
|------|------|
| `lsp_hover` | 커서 위치에서 타입 정보/문서 |
| `lsp_goto_definition` | 심볼 정의 위치 찾기 |
| `lsp_find_references` | 전체 코드베이스에서 참조 찾기 |
| `lsp_document_symbols` | 파일 내 심볼 계층 구조 |
| `lsp_workspace_symbols` | 워크스페이스 심볼 검색 |
| `lsp_diagnostics` | 타입 에러/경고/힌트 |
| `lsp_servers` | 설치된 언어 서버 목록 |
| `lsp_rename` | 모든 파일에서 심볼 이름 변경 |
| `lsp_code_actions` | 리팩토링/퀵픽스 액션 |

#### AST 도구 (@ast-grep/napi 기반)
| 도구 | 기능 |
|------|------|
| `ast_grep` | 메타변수 패턴 매칭 (`$VAR`, `$$$`) |
| `ast_replace` | AST 기반 코드 교체 (포맷 유지) |
| `ast_structure` | AST 구조 요약 (노드/정의/복잡도) |

#### REPL 도구
| 도구 | 기능 |
|------|------|
| `omq_python` | Python 실행 (패키지 설치 지원) |
| `omq_node` | Node.js/TypeScript ESM 실행 |

#### 유틸리티 도구
| 도구 | 기능 |
|------|------|
| `omq_notify` | Telegram/Discord/Slack 알림 |
| `omq_plan` | 구현 계획 CRUD |
| `omq_agents` | Agent 목록 조회 |
| `omq_state` | 상태 읽기/쓰기 |

---

### 📋 Skills (37개)

Markdown 기반 워크플로우 템플릿:

| 카테고리 | 스킬 | 설명 |
|---------|------|------|
| **Execution** | autopilot, ultrawork, ralph, team, ultraqa | 자율 실행 모드 |
| **Planning** | omq-plan, ralplan, deep-interview | 계획 수립 |
| **Exploration** | deepinit, sciomc, external-context | 코드 탐색 |
| **Utility** | learner, cancel, hud, setup, omq-doctor | 유틸리티 |
| **Domain** | project-session-manager, writer-memory, release | 도메인 특화 |

---

### ⚙️ 설정 시스템

- **`qwen-extension.json`**: 확장 매니페스트 (MCP 서버 정의)
- **`.qwen/settings.json`**: Hooks 설정
- **`.qwen/agents/*.md`**: Agent 정의 (YAML frontmatter + 프롬프트)
- **환경변수**: `OMQ_MODEL_HIGH`, `OMQ_MODEL_MEDIUM`, `OMQ_MODEL_LOW`

---

## 프로젝트 구조

```
oh-my-qwen/
├── .qwen/
│   ├── agents/              # 19개 Agent 정의 (Markdown + YAML)
│   └── settings.json        # Hooks 설정
├── commands/omq/            # Qwen Code 명령어 (TOML)
├── hooks/scripts/           # Hook 스크립트 (stdin/stdout JSON)
├── mcp-server/              # MCP 도구 서버
│   └── src/index.ts         # 15개 도구 등록
├── src/
│   ├── agents/              # Agent 로더 (TypeScript)
│   ├── cli/                 # CLI 스크립트
│   ├── config/              # 설정 로더 + 모델 라우팅
│   ├── tools/               # LSP + AST 도구
│   ├── installer/           # 설치 스크립트
│   └── shared/              # 공통 타입
├── skills/                  # 워크플로우 스킬
├── docs/                    # 분석 문서
├── QWEN.md                  # 시스템 프롬프트
├── package.json
└── tsconfig.json
```

---

## 테스트

```bash
npm test            # 전체 테스트
npm run test:watch  # Watch 모드
```

현재 **37개 테스트 전체 통과** — Agent 레지스트리, 설정 로딩, MCP 도구, Hook 라이프사이클, 통합 시나리오 포함.

---

## 라이선스

MIT

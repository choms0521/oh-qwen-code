# Oh My Claudecode → Oh My Qwen 이주 분석

> 분석 일자: 2026-04-07
> 대상: oh-my-claudecode (Yeachan-Heo/oh-my-claudecode fork)

---

## 1. 프로젝트 개요

**oh-my-claudecode**는 Claude Code를 위한 멀티 에이전트 오케스트레이션 레이어입니다.
19개의 전문화된 Agent를 정의하고, lifecycle hooks, skills, HUD, team orchestration 등을 통해
복잡한 소프트웨어 엔지니어링 작업을 자동으로 분할·병렬 실행·검증합니다.

이 문서는 해당 프로젝트를 **Qwen Code 전용 외부 확장**으로 이주하기 위한 분석 자료입니다.

---

## 2. 핵심 기능 요약

| 기능 | 설명 | Qwen 호환 |
|------|------|-----------|
| **Agent 시스템 (19종)** | explore, analyst, planner, architect, executor 등 역할별 전문 Agent | ✅ 이식 가능 (프롬프트+모델 매핑만 변경) |
| **Skills 시스템 (37종)** | 마크다운 기반 워크플로우 템플릿 (`/skill-name` 호출) | ✅ 완전 이식 가능 |
| **Hooks 시스템** | PromptSubmit, SessionStart, PreToolUse, PostToolUse 등 라이프사이클 훅 | ⚠️ Qwen hooks API에 맞춤 필요 |
| **HUD (Heads Up Display)** | 실시간 세션 상태 표시 (터미널 상단 바) | ⚠️ Qwen HUD API 확인 필요 |
| **Team 오케스트레이션** | tmux 기반 멀티 에이전트 병렬 실행 | ⚠️ tmux 의존, Qwen 대안 필요 |
| **모델 Tier 라우팅** | LOW/MEDIUM/HIGH tier → 모델 자동 매핑 | ✅ Qwen 모델로 변경 가능 |
| **CLI (`omq` 명령어)** | 커맨드라인에서 orchestration 실행 | ✅ 재구현 가능 |
| **알림 시스템** | Telegram, Discord, Slack 알림 | ✅ 완전 이식 가능 |
| **Python REPL** | 격리된 Python 실행 환경 | ✅ 완전 이식 가능 |
| **Auto-update** | GitHub 릴리스 기반 자동 업데이트 | ✅ 이식 가능 |
| **설정 시스템** | 다중 소스 config 병합 (env, user, project) | ✅ 이식 가능 |
| **MCP Tools 서버** | Model Context Protocol 도구 서버 | ✅ 완전 이식 가능 |

---

## 3. 현재 의존성 분석

### 3.1 필수 의존성
| 패키지 | 용도 | Claude 전용? | Qwen 대체 |
|--------|------|:---:|-----------|
| `@anthropic-ai/claude-agent-sdk` | Claude Agent SDK (Task/Agent 호출) | ❌ | Qwen Code 내장 Agent API |
| `@modelcontextprotocol/sdk` | MCP 서버 구현 | ✅ 아님 | 그대로 사용 |
| `zod` | 스키마 검증 | ✅ 아님 | 그대로 사용 |
| `commander` | CLI 파싱 | ✅ 아님 | 그대로 사용 |
| `chalk` | 터미널 색상 | ✅ 아님 | 그대로 사용 |
| `ajv` | JSON 스키마 | ✅ 아님 | 그대로 사용 |
| `@ast-grep/napi` | AST 파싱 | ✅ 아님 | 그대로 사용 (선택) |
| `better-sqlite3` | 로컬 DB | ✅ 아님 | 그대로 사용 |
| `vscode-languageserver-types` | LSP 타입 | ✅ 아님 | 그대로 사용 (선택) |

### 3.2 제거 대상
| 기능 | 관련 파일 | 제거 사유 |
|------|----------|----------|
| **Claude SDK** | `src/qwen-sdk-adapter.ts` (현재 claude-sdk import) | Qwen에 불필요 |
| **Codex Interop** | `src/cli/interop.ts`, `src/interop/` | OpenAI Codex 전용 |
| **Gemini Interop** | `src/config/models.ts` (geminiModel) | Google Gemini 전용 |
| **OpenClaw** | `src/openclaw/` | 서드파티 통합 |
| **Bedrock/Vertex** | `src/config/models.ts` (AWS/GCP 연동) | Claude 전용 인프라 |

---

## 4. 아키텍처 분석

### 4.1 디렉토리 구조
```
src/
├── agents/          # Agent 정의 (프롬프트+설정)          → ✅ 이식
├── cli/             # CLI 명령어                          → ⚠️ 재구현
├── config/          # 설정 로더 + 모델 라우팅             → ⚠️ Qwen 모델로 변경
├── features/        # 기능 모듈 (delegation, auto-update) → ⚠️ 선별 이식
├── hooks/           # 라이프사이클 훅                     → ⚠️ Qwen API 맞춤
├── hud/             # HUD 렌더링                          → ⚠️ Qwen API 확인
├── installer/       # 설치 스크립트                       → ⚠️ Qwen 경로 맞춤
├── interop/         # Codex/Gemini 연동                   → ❌ 제거
├── lib/             # 공통 유틸리티                       → ✅ 이식
├── mcp/             # MCP 도구 서버                       → ✅ 이식
├── notifications/   # 알림 시스템                         → ✅ 이식
├── openclaw/        # OpenClaw 통합                       → ❌ 제거
├── planning/        # 계획 생성                           → ✅ 이식
├── python-repl/     # Python REPL 도구                    → ✅ 이식
├── ralphthon/       # Ralphthon (persistant execution)    → ⚠️ 검토
├── shared/          # 공통 타입                           → ✅ 이식
├── skills/          # 스킬 정의                           → ✅ 이식
├── team/            # 팀 오케스트레이션                   → ⚠️ tmux 대안 필요
├── tools/           # 커스텀 도구                         → ⚠️ 선별
├── types/           # 타입 정의                           → ✅ 이식
├── utils/           # 유틸리티                            → ✅ 이식
└── verification/    # 검증 시스템                         → ✅ 이식
```

### 4.2 Agent 시스템 (19종)
| Agent | 모델 | 용도 |
|-------|------|------|
| explore | haiku → qwen-turbo | 코드베이스 탐색 |
| analyst | opus → qwen-max | 요구사항 분석 |
| planner | opus → qwen-max | 작업 계획 수립 |
| architect | opus → qwen-max | 시스템 설계 |
| debugger | sonnet → qwen-plus | 디버깅 |
| executor | sonnet → qwen-plus | 코드 구현 |
| verifier | sonnet → qwen-plus | 검증 |
| security-reviewer | sonnet → qwen-plus | 보안 검토 |
| code-reviewer | opus → qwen-max | 코드 리뷰 |
| test-engineer | sonnet → qwen-plus | 테스트 |
| designer | sonnet → qwen-plus | UI/UX |
| writer | haiku → qwen-turbo | 문서 |
| qa-tester | sonnet → qwen-plus | QA 테스트 |
| scientist | sonnet → qwen-plus | 데이터 분석 |
| tracer | haiku → qwen-turbo | 실행 추적 |
| git-master | sonnet → qwen-plus | Git 작업 |
| code-simplifier | opus → qwen-max | 코드 단순화 |
| critic | opus → qwen-max | 계획 리뷰 |
| document-specialist | sonnet → qwen-plus | 외부 문서 |

### 4.3 모델 Tier 시스템 (변경 필요)
```
현재 (Claude):
  LOW    → claude-haiku-4-5
  MEDIUM → claude-sonnet-4-6
  HIGH   → claude-opus-4-6

변경 (Qwen):
  LOW    → qwen-turbo
  MEDIUM → qwen-plus
  HIGH   → qwen-max
```

### 4.4 Hooks 라이프사이클
| Hook | 타이밍 | 용도 |
|------|--------|------|
| PromptSubmit | 사용자 입력 전송 전 | 키워드 감지, 스킬 인젝션 |
| SessionStart | 세션 시작 | 초기화, 프로젝트 메모리 로드 |
| PreToolUse | 도구 실행 전 | 권한 검증 |
| PostToolUse | 도구 실행 후 | 결과 검증, 메모리 업데이트 |
| PostToolUseFailure | 도구 실패 | 에러 처리 |
| SubagentStart | 서브에이전트 시작 | 추적 |
| SubagentStop | 서브에이전트 종료 | 검증 |
| SessionEnd | 세션 종료 | 정리 |

### 4.5 Skills 시스템 (37종)
- **Execution**: autopilot, ultrawork, ralph, team, ultraqa
- **Planning**: omc-plan, ralplan, deep-interview
- **Exploration**: deepinit, sciomc, external-context
- **Utility**: learner, note, cancel, hud, setup, omc-doctor
- **Domain**: project-session-manager, writer-memory, release
- **Cleanup**: ai-slop-cleaner
- **기타**: skill, skillify, trace, remember, ccg, ask 등

---

## 5. Qwen Code 호환성 분석

### 5.1 Qwen Code에서 지원해야 할 것
1. **Agent/Task 호출 API** - Claude Agent SDK 대체
2. **Hooks API** - 라이프사이클 훅 등록 방식
3. **HUD API** - 상태 표시줄 렌더링
4. **Plugin 구조** - `qwen-extension.json` 기반 확장
5. **Skills 경로** - `~/.qwen/skills/` 또는 프로젝트 로컬

### 5.2 대안이 필요한 부분
| Claude 기능 | 문제 | Qwen 대안 |
|-------------|------|----------|
| `@anthropic-ai/claude-agent-sdk` | Task/Agent 호출 SDK | Qwen Code 내장 Task tool 사용 |
| tmux 팀 오케스트레이션 | 프로세스 기반 병렬 실행 | Qwen Code native teams 활용 |
| CLAUDE.md 컨텍스트 | Claude Code 전용 컨텍스트 파일 | QWEN.md 사용 |
| ~/.claude/ 설정 | 설정 경로 | ~/.qwen/ 사용 |
| Bedrock/Vertex | 클라우드 모델 라우팅 | DashScope API 직접 호출 |
| Claude model suffixes (`[1m]`) | 컨텍스트 윈도우 표기 | Qwen 고유의 방식 필요 |

---

## 6. 제거/보류 기능 상세

### 6.1 완전 제거 (❌)
| 기능 | 파일 | 사유 |
|------|------|------|
| Codex Interop | `src/cli/interop.ts`, `src/interop/*` | OpenAI 전용 |
| Gemini Interop | `src/config/models.ts` | Google 전용 |
| OpenClaw | `src/openclaw/*` | 서드파티, Qwen과 무관 |
| Bedrock 연동 | `src/config/models.ts` | AWS Claude 전용 |
| Vertex AI 연동 | `src/config/models.ts` | GCP Claude 전용 |

### 6.2 보류 (⏸)
| 기능 | 파일 | 사유 |
|------|------|------|
| LSP Tools | `src/tools/lsp-tools.ts`, `src/tools/lsp/*` | 복잡도 높음, 코어 기능 아님 |
| AST Tools | `src/tools/ast-tools.ts` | 복잡도 높음, 코어 기능 아님 |
| Auto-research | `src/autoresearch/*` | 부가 기능, 핵심 아님 |
| Ralphthon | `src/ralphthon/*` | persistant execution, 검토 후 결정 |

### 6.3 대안 필요 (⚠️)
| 기능 | 파일 | 문제 | 대안 |
|------|------|------|------|
| Team tmux | `src/team/*` | tmux 의존 | Qwen Code native teams |
| HUD | `src/hud/*` | Claude HUD API | Qwen HUD API 확인 |
| CLI | `src/cli/*` | Claude SDK 호출 | Qwen SDK로 재구현 |

---

## 7. 구현 계획 요약

```
Phase 0: docs/ANALYSIS.md 작성           ← 현재 단계
Phase 1: src/ 전체 삭제 + package.json 재작성
Phase 2: Agent 시스템 + Hooks + Skills + CLI 재구현
Phase 3: MCP 도구 + 설정 + 빌드/테스트
```

---

## 8. 참고: oh-my-claudecode 핵심 가치

1. **Delegate Intelligently** - 작업을 전문 Agent에 분배
2. **Parallelize Ruthlessly** - 독립 작업 병렬 실행
3. **Route by Complexity** - 작업 복잡도에 따른 모델 라우팅
4. **Verify Everything** - 빌드/테스트로 검증
5. **Loop on Failure** - 실패 시 자동 수정

이 원칙들은 Qwen Code에서도 동일하게 유효합니다.

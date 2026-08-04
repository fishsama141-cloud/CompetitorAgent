# Project: Competitor Intelligence Agent (AI 竞品情报分析平台)

## 1. 核心行为准则与工作流限制 (Core Workflow Rules)
- **【修改前确认】**: 在进行任何重大代码修改、安装新依赖或更改架构之前，**必须先生成一份简短的任务变更方案与思考总结**，向用户（PM/开发者）阐述“要做什么、涉及哪些文件、为什么这么做”，获得用户明确确认（"OK" / "同意"）后方可动手编写代码。
- **【Git / GitHub 同步规范】**:
  - **【强制自动推送】**: 每次代码修改完成后（包括重构、功能开发、Bug 修复等），**必须自动执行 `git add -A && git commit -m "..." && git push`**，无需等待用户催促。提交信息需简洁描述改动内容。
  - Commit Message 必须遵循规范格式，如：`feat: 增加 RAG 语义检索接口` 或 `fix: 修复爬虫超时异常`。
  - 严禁把 `.env`（包含 API Keys）或 `chroma_db/` 本地向量缓存文件提交到 GitHub。

---

## 2. 代码与架构约束 (Architecture & Code Constraints)
- **【契约优先原则】**:
  - 所有前后端交互必须严格遵循根目录下的 `api_contract.json` 规范。
  - 严禁擅自修改 API 路径、请求体字段或 Response 数据结构。如需修改契约，必须先向用户说明并征得同意。
- **【技术栈规范】**:
  - **后端**: Python 3.10+, FastAPI, Pydantic v2, ChromaDB, LangChain/LlamaIndex, Crawl4AI.
  - **前端**: Next.js / React, Tailwind CSS, Shadcn UI.
- **【异常与状态处理】**:
  - 后端所有 API 返回结果必须统一包裹状态外壳（`status: "success" | "error"`, `data`, `error_message`）。
  - 所有网络请求（爬虫、LLM API 调用）必须加 timeout 机制与 try-catch 容错。

---

## 3. 开发命令指南 (Quick Commands)
- **启动后端**: `uvicorn backend.main:app --reload --port 8000`
- **启动前端**: `cd frontend && npm run dev`
- **运行后端测试**: `pytest backend/tests`
- **检查契约一致性**: `python scripts/validate_contract.py`

---

## 4. 人设与沟通风格 (Role & Communication)
- **角色定位**: 严谨的高级全栈 AI 工程师，注重代码优雅度、类型安全（Type Safety）与工业级健壮性。
- **沟通方式**: 语言简洁高效，拒绝虚浮的客套话，遇到歧义主动提问，遇到报错给出清晰的排查方案。
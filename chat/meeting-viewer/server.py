import json
import mimetypes
import os
import re
import sqlite3
import subprocess
import sys
import threading
import time
import uuid
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Optional, Tuple
from urllib.parse import urlparse


CHAT_ROOT_DIR = Path(__file__).resolve().parents[1]
SERVICE_ROOT_DIR = CHAT_ROOT_DIR / "tongyi-agent"
OUTPUTS_DIR = SERVICE_ROOT_DIR / "outputs"
RUNTIME_DIR = SERVICE_ROOT_DIR / "runtime"
UPLOADS_DIR = RUNTIME_DIR / "uploads"
JOBS_FILE = RUNTIME_DIR / "jobs.json"
CHAT_DB_FILE = RUNTIME_DIR / "chat.db"
VERIFY_SCRIPT = SERVICE_ROOT_DIR / "verify-offline" / "run_offline_verify.py"
HOST = "127.0.0.1"
PORT = 8123
RANGE_CHUNK_SIZE = 64 * 1024
PROFILE_DIR_NAME = "profile-analysis"
ALLOWED_UPLOAD_EXTENSIONS = {".m4a", ".mp3"}
REQUIRED_CONFIG_KEYS = ("DASHSCOPE_API_KEY", "TINGWU_APP_ID")
ENV_FILES = (SERVICE_ROOT_DIR / ".env", CHAT_ROOT_DIR / ".env")
VENV_PYTHON = SERVICE_ROOT_DIR / ".venv" / "bin" / "python"
JOB_STATUS_QUEUED = "queued"
JOB_STATUS_ANALYZING = "analyzing"
JOB_STATUS_SUCCEEDED = "succeeded"
JOB_STATUS_FAILED = "failed"
RUNNING_JOB_STATUSES = {JOB_STATUS_QUEUED, JOB_STATUS_ANALYZING}
DEFAULT_THREAD_TITLE = "新对话"
THREAD_STATUS_REGULAR = "regular"
JOBS_LOCK = threading.Lock()
JOBS: dict[str, dict] = {}


def now_iso() -> str:
    return datetime.now().isoformat()


def parse_env_line(line: str) -> Optional[Tuple[str, str]]:
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in stripped:
        return None
    key, value = stripped.split("=", 1)
    key = key.strip()
    value = value.strip().strip("'").strip('"')
    if not key:
        return None
    return key, value


def load_env_file(path: Path):
    if not path.exists() or not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        parsed = parse_env_line(line)
        if not parsed:
            continue
        key, value = parsed
        if key not in os.environ and value:
            os.environ[key] = value


def bootstrap_environment():
    for env_file in ENV_FILES:
        load_env_file(env_file)


def chat_config_status() -> dict:
    api_key = os.environ.get("DASHSCOPE_API_KEY", "").strip()
    app_id = os.environ.get("TINGWU_APP_ID", "").strip()
    missing = [key for key in REQUIRED_CONFIG_KEYS if not os.environ.get(key, "").strip()]
    return {
        "hasDashscopeApiKey": bool(api_key),
        "hasTingwuAppId": bool(app_id),
        "missing": missing,
        "envFiles": [str(path) for path in ENV_FILES if path.exists()],
    }


def is_supported_audio_file(file_name: str) -> bool:
    return Path(file_name).suffix.lower() in ALLOWED_UPLOAD_EXTENSIONS


def copilot_runtime_info() -> dict:
    # Minimal runtime info payload for CopilotKit provider handshake.
    return {
        "version": "local-chat-runtime-0.1.0",
        "agents": {
            "default": {
                "description": "AI 原生 CRM 对话层助手（默认别名）",
            },
            "crm_copilot": {
                "description": "AI 原生 CRM 对话层助手（本地 MVP）",
            }
        },
        "audioFileTranscriptionEnabled": False,
        "mode": "sse",
        "a2uiEnabled": False,
        "openGenerativeUIEnabled": False,
    }


def open_chat_db():
    connection = sqlite3.connect(str(CHAT_DB_FILE))
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_chat_db():
    with open_chat_db() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS chat_threads (
                id TEXT PRIMARY KEY,
                assistant_id TEXT NOT NULL,
                title TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'regular',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                thread_id TEXT NOT NULL,
                role TEXT NOT NULL,
                kind TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_chat_threads_updated_at
            ON chat_threads(updated_at DESC);

            CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created_at
            ON chat_messages(thread_id, created_at, id);
            """
        )


def thread_row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "assistantId": row["assistant_id"],
        "title": row["title"],
        "status": row["status"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def message_row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "threadId": row["thread_id"],
        "role": row["role"],
        "kind": row["kind"],
        "payload": json.loads(row["payload_json"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def list_threads_db() -> list[dict]:
    with open_chat_db() as connection:
        rows = connection.execute(
            """
            SELECT id, assistant_id, title, status, created_at, updated_at
            FROM chat_threads
            WHERE status = ?
            ORDER BY updated_at DESC, created_at DESC
            """,
            (THREAD_STATUS_REGULAR,),
        ).fetchall()
    return [thread_row_to_dict(row) for row in rows]


def get_thread_db(thread_id: str) -> Optional[dict]:
    with open_chat_db() as connection:
        thread_row = connection.execute(
            """
            SELECT id, assistant_id, title, status, created_at, updated_at
            FROM chat_threads
            WHERE id = ?
            """,
            (thread_id,),
        ).fetchone()
        if not thread_row:
            return None

        message_rows = connection.execute(
            """
            SELECT id, thread_id, role, kind, payload_json, created_at, updated_at
            FROM chat_messages
            WHERE thread_id = ?
            ORDER BY created_at ASC, id ASC
            """,
            (thread_id,),
        ).fetchall()

    return {
        "thread": thread_row_to_dict(thread_row),
        "messages": [message_row_to_dict(row) for row in message_rows],
    }


def create_thread_db(assistant_id: str, title: str = DEFAULT_THREAD_TITLE) -> dict:
    thread_id = uuid.uuid4().hex[:16]
    timestamp = now_iso()
    with open_chat_db() as connection:
        connection.execute(
            """
            INSERT INTO chat_threads (id, assistant_id, title, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                thread_id,
                assistant_id,
                title,
                THREAD_STATUS_REGULAR,
                timestamp,
                timestamp,
            ),
        )
        row = connection.execute(
            """
            SELECT id, assistant_id, title, status, created_at, updated_at
            FROM chat_threads
            WHERE id = ?
            """,
            (thread_id,),
        ).fetchone()
    return thread_row_to_dict(row)


def touch_thread_db(connection: sqlite3.Connection, thread_id: str):
    connection.execute(
        "UPDATE chat_threads SET updated_at = ? WHERE id = ?",
        (now_iso(), thread_id),
    )


def update_thread_title_db(connection: sqlite3.Connection, thread_id: str, title: str):
    connection.execute(
        "UPDATE chat_threads SET title = ?, updated_at = ? WHERE id = ?",
        (title, now_iso(), thread_id),
    )


def insert_message_db(
    connection: sqlite3.Connection,
    thread_id: str,
    role: str,
    kind: str,
    payload: dict,
    message_id: Optional[str] = None,
) -> dict:
    timestamp = now_iso()
    message_id = message_id or uuid.uuid4().hex[:16]
    connection.execute(
        """
        INSERT INTO chat_messages (id, thread_id, role, kind, payload_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            message_id,
            thread_id,
            role,
            kind,
            json.dumps(payload, ensure_ascii=False),
            timestamp,
            timestamp,
        ),
    )
    touch_thread_db(connection, thread_id)
    row = connection.execute(
        """
        SELECT id, thread_id, role, kind, payload_json, created_at, updated_at
        FROM chat_messages
        WHERE id = ?
        """,
        (message_id,),
    ).fetchone()
    return message_row_to_dict(row)


def update_message_payload_db(thread_id: str, message_id: str, payload_patch: dict) -> Optional[dict]:
    with open_chat_db() as connection:
        row = connection.execute(
            """
            SELECT id, thread_id, role, kind, payload_json, created_at, updated_at
            FROM chat_messages
            WHERE id = ? AND thread_id = ?
            """,
            (message_id, thread_id),
        ).fetchone()
        if not row:
            return None
        payload = json.loads(row["payload_json"])
        payload.update(payload_patch)
        updated_at = now_iso()
        connection.execute(
            """
            UPDATE chat_messages
            SET payload_json = ?, updated_at = ?
            WHERE id = ? AND thread_id = ?
            """,
            (json.dumps(payload, ensure_ascii=False), updated_at, message_id, thread_id),
        )
        touch_thread_db(connection, thread_id)
        updated = connection.execute(
            """
            SELECT id, thread_id, role, kind, payload_json, created_at, updated_at
            FROM chat_messages
            WHERE id = ?
            """,
            (message_id,),
        ).fetchone()
    return message_row_to_dict(updated)


def count_thread_messages_db(connection: sqlite3.Connection, thread_id: str) -> int:
    row = connection.execute(
        "SELECT COUNT(*) AS total FROM chat_messages WHERE thread_id = ?",
        (thread_id,),
    ).fetchone()
    return int(row["total"]) if row else 0


def clip_title(text: str, limit: int = 24) -> str:
    normalized = " ".join(text.strip().split())
    if len(normalized) <= limit:
        return normalized
    return normalized[:limit].rstrip() + "..."


def derive_thread_title(text: str, attachments: list[dict]) -> str:
    if text.strip():
        return clip_title(text)
    if attachments:
        file_name = attachments[0].get("fileName") or DEFAULT_THREAD_TITLE
        if is_supported_audio_file(str(file_name)):
            return clip_title(f"录音分析 · {file_name}")
        return clip_title(str(file_name))
    return DEFAULT_THREAD_TITLE


def build_assistant_reply_payload(text: str, attachments: list[dict]) -> dict:
    has_non_audio_attachments = any(
        not is_supported_audio_file(str(item.get("fileName", "")))
        for item in attachments
    )
    if has_non_audio_attachments and not text.strip():
        reply = "已收到附件。当前 MVP 仅对 m4a/mp3 音频自动触发分析，其它文件会先作为上下文附件保留。"
    elif "线索" in text:
        reply = "已识别为“线索创建”意图。建议先补全联系人、负责人和预计成交周期，然后进入资格判定。"
    elif "商机" in text:
        reply = "已进入“商机推进”模式。我建议先校验阶段门槛，再给销售和售前各分配 1 个本周动作。"
    elif "客户" in text:
        reply = "我会按 CRM 视角继续拆解客户画像、决策链和推进风险。"
    elif has_non_audio_attachments:
        reply = "附件已进入本轮对话上下文。若你上传的是 m4a/mp3 音频，我会在发送后自动生成分析卡片。"
    else:
        reply = "已收到。作为 CRM Copilot，我可以继续把这条请求拆成“对象、动作、约束、下一步待办”。"
    return {"text": reply}


def ensure_runtime_dirs():
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def read_jobs_file() -> dict[str, dict]:
    if not JOBS_FILE.exists():
        return {}
    try:
        payload = json.loads(JOBS_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    if not isinstance(payload, dict):
        return {}
    jobs = {}
    for key, value in payload.items():
        if isinstance(key, str) and isinstance(value, dict):
            jobs[key] = value
    return jobs


def write_jobs_file_locked():
    JOBS_FILE.write_text(
        json.dumps(JOBS, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def job_public_payload(job: dict) -> dict:
    return {
        "id": job.get("id"),
        "status": job.get("status"),
        "fileName": job.get("fileName"),
        "createdAt": job.get("createdAt"),
        "updatedAt": job.get("updatedAt"),
        "taskId": job.get("taskId"),
        "error": job.get("error"),
        "action": "analyze_recording",
    }


def list_chat_jobs() -> list[dict]:
    with JOBS_LOCK:
        jobs = [job_public_payload(job) for job in JOBS.values()]
    jobs.sort(key=lambda item: item.get("updatedAt") or "", reverse=True)
    return jobs


def get_chat_job(job_id: str) -> Optional[dict]:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        return job_public_payload(job) if job else None


def update_job(job_id: str, **changes):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return
        job.update(changes)
        job["updatedAt"] = now_iso()
        write_jobs_file_locked()


def create_job(file_name: str, upload_path: str) -> dict:
    job_id = uuid.uuid4().hex[:12]
    timestamp = now_iso()
    job = {
        "id": job_id,
        "status": JOB_STATUS_QUEUED,
        "fileName": file_name,
        "createdAt": timestamp,
        "updatedAt": timestamp,
        "taskId": None,
        "error": None,
        "audioPath": upload_path,
    }
    with JOBS_LOCK:
        JOBS[job_id] = job
        write_jobs_file_locked()
    return job


def create_analysis_job_from_upload(file_name: str, content: bytes) -> dict:
    ext = Path(file_name).suffix.lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise ValueError("仅支持 .m4a 或 .mp3 音频文件")
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    sanitized_name = f"{uuid.uuid4().hex[:8]}-{timestamp}{ext}"
    destination = UPLOADS_DIR / sanitized_name
    destination.write_bytes(content)
    job = create_job(file_name, str(destination))
    launch_job_worker(job["id"])
    return job_public_payload(job)


def best_effort_extract_data_id(log_text: str) -> Optional[str]:
    for line in reversed(log_text.splitlines()):
        if "dataId" not in line:
            continue
        candidate = line.split(":", 1)[-1].strip().strip('"').strip("'")
        if candidate:
            return candidate
    return None


def resolve_finished_task_id(known_ids: set[str], started_at: float, stdout: str) -> Optional[str]:
    if not OUTPUTS_DIR.exists():
        return best_effort_extract_data_id(stdout)

    current_dirs = [path for path in OUTPUTS_DIR.iterdir() if path.is_dir()]
    new_dirs = [path for path in current_dirs if path.name not in known_ids]
    if len(new_dirs) == 1:
        return new_dirs[0].name
    if len(new_dirs) > 1:
        return sorted(new_dirs, key=lambda item: item.stat().st_mtime, reverse=True)[0].name

    newer_dirs = [
        path for path in current_dirs if path.stat().st_mtime >= (started_at - 2.0)
    ]
    if newer_dirs:
        return sorted(newer_dirs, key=lambda item: item.stat().st_mtime, reverse=True)[0].name

    return best_effort_extract_data_id(stdout)


def format_failure_message(process: subprocess.CompletedProcess) -> str:
    stderr = (process.stderr or "").strip()
    stdout = (process.stdout or "").strip()
    if stderr:
        return stderr.splitlines()[-1][:280]
    if stdout:
        return stdout.splitlines()[-1][:280]
    return "分析失败，请检查服务端日志"


def run_analysis_job(job_id: str):
    app_id = os.environ.get("TINGWU_APP_ID", "").strip()
    api_key = os.environ.get("DASHSCOPE_API_KEY", "").strip()
    if not app_id or not api_key:
        update_job(
            job_id,
            status=JOB_STATUS_FAILED,
            error="缺少环境变量：请配置 DASHSCOPE_API_KEY 与 TINGWU_APP_ID",
        )
        return

    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return
        audio_path = str(job.get("audioPath") or "")

    if not audio_path:
        update_job(job_id, status=JOB_STATUS_FAILED, error="上传文件路径为空")
        return

    update_job(job_id, status=JOB_STATUS_ANALYZING, error=None)
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    known_ids = {path.name for path in OUTPUTS_DIR.iterdir() if path.is_dir()}
    started_at = time.time()

    python_executable = str(VENV_PYTHON if VENV_PYTHON.exists() else Path(sys.executable))

    command = [
        python_executable,
        str(VERIFY_SCRIPT),
        "--app-id",
        app_id,
        "--audio",
        audio_path,
        "--output-dir",
        str(OUTPUTS_DIR),
    ]
    env = os.environ.copy()
    env["DASHSCOPE_API_KEY"] = api_key

    process = subprocess.run(command, capture_output=True, text=True, env=env)
    if process.returncode != 0:
        update_job(
            job_id,
            status=JOB_STATUS_FAILED,
            error=format_failure_message(process),
        )
        return

    task_id = resolve_finished_task_id(known_ids, started_at, process.stdout or "")
    if not task_id:
        update_job(
            job_id,
            status=JOB_STATUS_FAILED,
            error="分析完成但未识别到任务 ID，请稍后重试",
        )
        return

    update_job(
        job_id,
        status=JOB_STATUS_SUCCEEDED,
        taskId=task_id,
        error=None,
    )


def launch_job_worker(job_id: str):
    worker = threading.Thread(target=run_analysis_job, args=(job_id,), daemon=True)
    worker.start()


def bootstrap_runtime_state():
    ensure_runtime_dirs()
    init_chat_db()
    restored = read_jobs_file()
    with JOBS_LOCK:
        JOBS.clear()
        JOBS.update(restored)
        for job in JOBS.values():
            if job.get("status") in RUNNING_JOB_STATUSES:
                job["status"] = JOB_STATUS_FAILED
                job["error"] = "服务重启导致任务中断，请重新上传"
                job["updatedAt"] = now_iso()
        write_jobs_file_locked()


def json_response(handler: SimpleHTTPRequestHandler, payload, status=200):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def read_json(path: Path):
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def task_meta(task_dir: Path):
    assets_dir = task_dir / "assets"
    create_task = read_json(task_dir / "create-task.json") or {}
    task_result = read_json(task_dir / "task-result.json") or {}

    asset_names = []
    if assets_dir.exists():
        asset_names = sorted(
            path.name for path in assets_dir.iterdir() if path.is_file()
        )

    return {
        "id": task_dir.name,
        "updatedAt": datetime.fromtimestamp(task_dir.stat().st_mtime).isoformat(),
        "createdAt": datetime.fromtimestamp(task_dir.stat().st_ctime).isoformat(),
        "hasAudio": (assets_dir / "playback.mp3").exists(),
        "assets": asset_names,
        "status": ((task_result.get("output") or {}).get("status")),
        "requestId": task_result.get("request_id"),
        "dataId": ((create_task.get("output") or {}).get("dataId")) or task_dir.name,
    }


def list_tasks():
    if not OUTPUTS_DIR.exists():
        return []
    tasks = [task_meta(path) for path in OUTPUTS_DIR.iterdir() if path.is_dir()]
    tasks.sort(key=lambda item: item["updatedAt"], reverse=True)
    return tasks


def load_task_bundle(task_id: str):
    task_dir = OUTPUTS_DIR / task_id
    if not task_dir.exists():
        return None

    assets_dir = task_dir / "assets"
    bundle = {
        "id": task_id,
        "meta": task_meta(task_dir),
        "createTask": read_json(task_dir / "create-task.json"),
        "taskResult": read_json(task_dir / "task-result.json"),
        "summaryText": (task_dir / "summary.txt").read_text(encoding="utf-8")
        if (task_dir / "summary.txt").exists()
        else "",
        "assets": {
            "transcription": read_json(assets_dir / "transcription.json"),
            "translations": read_json(assets_dir / "translations.json"),
            "textPolish": read_json(assets_dir / "textPolish.json"),
            "summarization": read_json(assets_dir / "summarization.json"),
            "meetingAssistance": read_json(assets_dir / "meetingAssistance.json"),
            "autoChapters": read_json(assets_dir / "autoChapters.json"),
            "pptExtraction": read_json(assets_dir / "pptExtraction.json"),
        },
        "media": {
            "playbackUrl": f"/tongyi-agent/outputs/{task_id}/assets/playback.mp3"
            if (assets_dir / "playback.mp3").exists()
            else None,
        },
    }
    return bundle


def speaker_raw_label(speaker_id: str) -> str:
    return f"发言人{speaker_id}"


def apply_speaker_aliases(text: str, aliases: dict[str, str]) -> str:
    output = text
    for raw_label, alias in aliases.items():
        if not raw_label or not alias:
            continue
        output = output.replace(raw_label, alias)
    return output


def extract_sentence_candidates(text: str) -> list[str]:
    normalized = (
        text.replace("？", "。\n")
        .replace("！", "。\n")
        .replace("。", "。\n")
        .replace("\n\n", "\n")
    )
    return [line.strip() for line in normalized.splitlines() if line.strip()]


def infer_interview_role(text: str, speaker_index: int, all_text: str) -> str:
    if any(keyword in text for keyword in ["毕业", "加入", "负责", "项目", "经历", "我在", "做过"]):
        return "候选人"
    if any(keyword in text for keyword in ["你好", "请你", "你能", "我们今天", "方便介绍", "为什么"]):
        return "面试官 / 评估方"
    return "候选人" if speaker_index == 0 else "面试官 / 评估方"


def infer_crm_role(text: str, speaker_index: int) -> str:
    if any(keyword in text for keyword in ["我们最怕", "希望", "担心", "预算", "总部", "审批", "内部"]):
        return "客户侧关键参与人"
    if any(keyword in text for keyword in ["方案", "试点", "落地", "推进", "建议", "系统", "我们这边"]):
        return "我方销售 / 顾问"
    return "客户侧关键参与人" if speaker_index == 0 else "我方销售 / 顾问"


def derive_tags(text: str, scenario: str, bundle: dict) -> list[str]:
    keywords = list((bundle.get("assets", {}).get("meetingAssistance") or {}).get("keywords") or [])
    matched = [keyword for keyword in keywords if keyword and keyword in text][:4]
    if matched:
        return matched

    fallback_map = {
        "interview": ["经历表达", "项目复盘", "沟通清晰", "岗位匹配"],
        "crm_visit": ["需求表达", "预算敏感", "决策关注", "推进风险"],
    }
    return fallback_map[scenario]


def infer_interview_profile(text: str, speaker_index: int, bundle: dict) -> dict:
    role = infer_interview_role(text, speaker_index, text)
    tags = derive_tags(text, "interview", bundle)
    communication = "表达完整、偏叙述式" if len(text) > 220 else "表达直接、偏简洁"
    if "？" in text or "?" in text:
        communication = "提问驱动、节奏较强"

    motivations = []
    if any(keyword in text for keyword in ["成长", "发展", "机会", "岗位"]):
        motivations.append("关注岗位成长与职业发展")
    if any(keyword in text for keyword in ["项目", "负责", "落地"]):
        motivations.append("关注项目负责度与落地空间")
    if not motivations:
        motivations.append("关注岗位匹配度与实际业务场景")

    strengths = []
    if any(keyword in text for keyword in ["负责", "主导", "带领"]):
        strengths.append("具备项目负责或牵引经验")
    if any(keyword in text for keyword in ["分析", "规划", "架构", "设计"]):
        strengths.append("在分析、设计或规划表达上较清晰")
    if not strengths:
        strengths.append("表达相对完整，能持续输出上下文")

    risks = []
    if any(keyword in text for keyword in ["可能", "大概", "相对", "应该"]):
        risks.append("部分表述偏概括，细节量化证据可继续追问")
    if not risks:
        risks.append("建议结合追问进一步校验结论与案例细节")

    advice = "继续围绕具体项目、职责边界与结果数据追问，以便形成更稳的面试判断。"

    return {
        "role": role,
        "tags": tags,
        "communication": communication,
        "focus": "；".join(motivations),
        "strengths": "；".join(strengths),
        "risks": "；".join(risks),
        "advice": advice,
    }


def infer_crm_profile(text: str, speaker_index: int, bundle: dict) -> dict:
    role = infer_crm_role(text, speaker_index)
    tags = derive_tags(text, "crm_visit", bundle)
    influence = "高" if any(keyword in text for keyword in ["预算", "审批", "总部", "CEO", "决策"]) else ("中" if any(keyword in text for keyword in ["需求", "方案", "试点"]) else "低")
    attitude = "谨慎" if any(keyword in text for keyword in ["担心", "风险", "顾虑", "怕"]) else ("积极" if any(keyword in text for keyword in ["希望", "推进", "愿意", "可以"]) else "中性")
    concerns = []
    if any(keyword in text for keyword in ["预算", "投入", "ROI", "成本"]):
        concerns.append("对预算投入与回报敏感")
    if any(keyword in text for keyword in ["审批", "合规", "权限", "总部"]):
        concerns.append("关注审批、权限或合规要求")
    if any(keyword in text for keyword in ["试点", "周期", "落地", "集成"]):
        concerns.append("关注试点周期、落地成本或集成复杂度")
    if not concerns:
        concerns.append("关注业务问题解决路径与推进节奏")

    preference = "更容易接受低风险、可试点、可分阶段推进的沟通方式。"
    follow_up = "后续建议围绕其核心关注点准备针对性材料，并在下一轮沟通中确认其在决策链中的实际影响力。"

    return {
        "role": role,
        "influence": influence,
        "attitude": attitude,
        "tags": tags,
        "focus": "；".join(concerns),
        "risks": "；".join(concerns[:2]),
        "preference": preference,
        "advice": follow_up,
    }


def build_profile_prompt(scenario: str, transcript: str, speaker_aliases: dict[str, str]) -> str:
    alias_lines = "\n".join(f"- {key} => {value}" for key, value in speaker_aliases.items() if value.strip())
    alias_block = f"\n【发言人映射】\n{alias_lines}\n" if alias_lines else ""
    if scenario == "interview":
        return f"""你是一位资深面试分析顾问，请基于下面的面试录音转写内容，为每位发言人输出结构化人物画像，要求严格使用 Markdown。

目标：
1. 识别每位发言人的身份角色
2. 归纳其能力亮点、沟通风格、关注点与潜在风险
3. 所有结论必须基于录音内容
4. 输出应适合直接生成图片卡片或人物画像面板

每位发言人输出字段：
- 角色判断
- 核心标签
- 沟通风格
- 动机偏好
- 能力亮点
- 风险提示
- 面试建议
- 证据摘录
{alias_block}
转写内容：
{transcript}"""

    return f"""你是一位资深 B2B 销售顾问，请基于下面的客户拜访录音转写，为每位发言人输出结构化人物画像，要求严格使用 Markdown。

目标：
1. 判断客户拜访中每位发言人的角色、影响力和态度
2. 提炼其关注点、顾虑点与偏好沟通方式
3. 给出后续跟进建议
4. 所有结论必须基于录音内容

每位发言人输出字段：
- 角色 / 职能判断
- 决策影响力
- 当前态度
- 核心关注点
- 潜在顾虑
- 偏好沟通方式
- 跟进建议
- 证据摘录
{alias_block}
转写内容：
{transcript}"""


def build_profile_markdown(task_id: str, scenario: str, bundle: dict, speaker_aliases: dict[str, str]) -> tuple[str, list[str]]:
    transcription = (bundle.get("assets") or {}).get("transcription") or {}
    paragraphs = transcription.get("paragraphs") or []
    by_speaker: dict[str, list[str]] = {}

    for paragraph in paragraphs:
        speaker_id = str(paragraph.get("speakerId") or "")
        if not speaker_id:
            continue
        label = speaker_raw_label(speaker_id)
        paragraph_text = "".join(word.get("text", "") for word in paragraph.get("words") or [])
        by_speaker.setdefault(label, []).append(paragraph_text)

    speaker_labels = list(by_speaker.keys())
    aliased_transcript = apply_speaker_aliases(
        "\n".join(f"{label}: {' '.join(lines)}" for label, lines in by_speaker.items()),
        speaker_aliases,
    )
    prompt = build_profile_prompt(scenario, aliased_transcript, speaker_aliases)

    title = "面试结构化画像" if scenario == "interview" else "CRM 客户拜访结构化画像"
    sections = [f"# {title}", "", f"> 任务：`{task_id}`", ""]

    for index, raw_label in enumerate(speaker_labels):
        text = "\n".join(by_speaker[raw_label])
        display_name = speaker_aliases.get(raw_label, raw_label)
        evidence = extract_sentence_candidates(text)[:3]
        profile = (
            infer_interview_profile(text, index, bundle)
            if scenario == "interview"
            else infer_crm_profile(text, index, bundle)
        )

        sections.extend(
            [
                f"## {display_name}",
                f"- 原始发言人：{raw_label}",
                f"- 角色判断：{profile['role']}",
                f"- 核心标签：{'、'.join(profile['tags'])}",
                f"- 沟通风格：{profile['communication'] if scenario == 'interview' else '表达围绕业务问题推进，信息点较集中'}",
                f"- {'动机偏好' if scenario == 'interview' else '核心关注点'}：{profile['focus']}",
                f"- {'能力亮点' if scenario == 'interview' else '潜在顾虑'}：{profile['strengths'] if scenario == 'interview' else profile['risks']}",
                f"- {'风险提示' if scenario == 'interview' else '决策影响力'}：{profile['risks'] if scenario == 'interview' else profile['influence']}",
                f"- {'面试建议' if scenario == 'interview' else '当前态度'}：{profile['advice'] if scenario == 'interview' else profile['attitude']}",
                f"- {'证据摘录' if scenario == 'interview' else '偏好沟通方式'}：",
            ]
        )

        if scenario != "interview":
            sections.append(f"  - {profile['preference']}")

        for sentence in evidence or ["暂无可提取证据摘录。"]:
            sections.append(f"  - {sentence}")
        if scenario != "interview":
            sections.append(f"- 跟进建议：{profile['advice']}")
        sections.append("")

    return "\n".join(sections).strip() + "\n", [prompt, *speaker_labels]


def save_profile_markdown(task_id: str, scenario: str, content: str) -> str:
    profile_dir = OUTPUTS_DIR / task_id / PROFILE_DIR_NAME
    profile_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"{scenario}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.md"
    path = profile_dir / file_name
    path.write_text(content, encoding="utf-8")
    return f"/tongyi-agent/outputs/{task_id}/{PROFILE_DIR_NAME}/{file_name}"


class ViewerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(CHAT_ROOT_DIR), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/copilotkit/info":
            return json_response(self, copilot_runtime_info())

        if parsed.path == "/api/chat/config":
            return json_response(self, chat_config_status())

        if parsed.path == "/api/chat/threads":
            return json_response(self, {"threads": list_threads_db()})

        if parsed.path.startswith("/api/chat/threads/"):
            thread_id = parsed.path.rsplit("/", 1)[-1]
            payload = get_thread_db(thread_id)
            if payload is None:
                return json_response(self, {"error": "Thread not found"}, status=404)
            return json_response(self, payload)

        if parsed.path == "/api/chat/jobs":
            return json_response(self, {"jobs": list_chat_jobs()})

        if parsed.path.startswith("/api/chat/jobs/"):
            job_id = parsed.path.rsplit("/", 1)[-1]
            job = get_chat_job(job_id)
            if not job:
                return json_response(self, {"error": "Job not found"}, status=404)
            return json_response(self, job)

        if parsed.path == "/api/tasks":
            return json_response(self, {"tasks": list_tasks()})

        if parsed.path.startswith("/api/task/"):
            task_id = parsed.path.rsplit("/", 1)[-1]
            bundle = load_task_bundle(task_id)
            if bundle is None:
                return json_response(self, {"error": "Task not found"}, status=404)
            return json_response(self, bundle)

        if self._should_handle_with_range(parsed.path):
            return self._serve_file_with_range(send_body=True)

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/copilotkit":
            try:
                payload = self._read_json_body()
            except ValueError as error:
                return json_response(self, {"error": str(error)}, status=400)
            if payload.get("method") == "info":
                return json_response(self, copilot_runtime_info())
            return json_response(
                self,
                {"error": "CopilotKit runtime route is not implemented for this method"},
                status=501,
            )

        if parsed.path == "/api/chat/threads":
            try:
                payload = self._read_json_body()
            except ValueError as error:
                return json_response(self, {"error": str(error)}, status=400)

            assistant_id = str(payload.get("assistantId") or "crm-copilot")
            title = str(payload.get("title") or DEFAULT_THREAD_TITLE)
            thread = create_thread_db(assistant_id=assistant_id, title=title)
            return json_response(self, {"thread": thread}, status=201)

        if parsed.path.startswith("/api/chat/threads/") and parsed.path.endswith("/messages"):
            thread_id = parsed.path.split("/")[4]
            existing = get_thread_db(thread_id)
            if existing is None:
                return json_response(self, {"error": "Thread not found"}, status=404)

            try:
                form = self._read_multipart_form()
            except ValueError as error:
                return json_response(self, {"error": str(error)}, status=400)

            text = (form["fields"].get("text") or [""])[0]
            uploads = form["files"]
            attachments = [
                {
                    "id": uuid.uuid4().hex[:12],
                    "fileName": item["fileName"],
                    "mimeType": item.get("contentType") or "",
                    "size": len(item["content"]),
                }
                for item in uploads
            ]
            if not text.strip() and not attachments:
                return json_response(self, {"error": "Message is empty"}, status=400)

            first_audio = next(
                (item for item in uploads if is_supported_audio_file(item["fileName"])),
                None,
            )

            created_messages = []
            with open_chat_db() as connection:
                current_count = count_thread_messages_db(connection, thread_id)
                user_message = insert_message_db(
                    connection=connection,
                    thread_id=thread_id,
                    role="user",
                    kind="user-entry",
                    payload={
                        "text": text,
                        "attachments": attachments,
                    },
                )
                created_messages.append(user_message)

                if current_count == 0:
                    update_thread_title_db(
                        connection=connection,
                        thread_id=thread_id,
                        title=derive_thread_title(text, attachments),
                    )

                if first_audio is not None:
                    try:
                        job = create_analysis_job_from_upload(
                            file_name=first_audio["fileName"],
                            content=first_audio["content"],
                        )
                        analysis_message = insert_message_db(
                            connection=connection,
                            thread_id=thread_id,
                            role="assistant",
                            kind="analysis-card",
                            payload={
                                "fileName": first_audio["fileName"],
                                "status": job["status"],
                                "jobId": job["id"],
                                "taskId": job["taskId"],
                                "error": job["error"],
                            },
                        )
                        created_messages.append(analysis_message)
                    except ValueError as error:
                        return json_response(self, {"error": str(error)}, status=400)
                else:
                    assistant_message = insert_message_db(
                        connection=connection,
                        thread_id=thread_id,
                        role="assistant",
                        kind="assistant-text",
                        payload=build_assistant_reply_payload(text, attachments),
                    )
                    created_messages.append(assistant_message)

            payload = get_thread_db(thread_id)
            return json_response(
                self,
                {
                    "thread": payload["thread"],
                    "messages": payload["messages"],
                    "createdMessages": created_messages,
                },
                status=201,
            )

        if parsed.path == "/api/chat/upload":
            try:
                upload = self._read_upload_file()
            except ValueError as error:
                return json_response(self, {"error": str(error)}, status=400)
            try:
                job = create_analysis_job_from_upload(
                    file_name=upload["fileName"],
                    content=upload["content"],
                )
            except ValueError as error:
                return json_response(self, {"error": str(error)}, status=400)
            return json_response(
                self,
                {"jobId": job["id"], "status": job["status"], "action": "analyze_recording"},
                status=202,
            )

        if parsed.path == "/api/chat/action/analyze_recording":
            try:
                payload = self._read_json_body()
            except ValueError as error:
                return json_response(self, {"error": str(error)}, status=400)

            job_id = str(payload.get("jobId") or "").strip()
            if not job_id:
                return json_response(self, {"error": "jobId is required"}, status=400)
            job = get_chat_job(job_id)
            if not job:
                return json_response(self, {"error": "Job not found"}, status=404)
            return json_response(self, {"action": "analyze_recording", "job": job})

        if parsed.path.startswith("/api/task/") and parsed.path.endswith("/profile-analysis"):
            task_id = parsed.path.split("/")[3]
            bundle = load_task_bundle(task_id)
            if bundle is None:
                return json_response(self, {"error": "Task not found"}, status=404)

            try:
                payload = self._read_json_body()
            except ValueError as error:
                return json_response(self, {"error": str(error)}, status=400)

            scenario = payload.get("scenario") or "interview"
            speaker_aliases = payload.get("speaker_aliases") or {}
            if scenario not in {"interview", "crm_visit"}:
                return json_response(self, {"error": "Invalid scenario"}, status=400)

            markdown, prompt_parts = build_profile_markdown(
                task_id=task_id,
                scenario=scenario,
                bundle=bundle,
                speaker_aliases=speaker_aliases,
            )
            markdown_url = save_profile_markdown(task_id, scenario, markdown)
            prompt = prompt_parts[0]
            speakers = prompt_parts[1:]

            return json_response(
                self,
                {
                    "taskId": task_id,
                    "scenario": scenario,
                    "prompt": prompt,
                    "markdown": markdown,
                    "markdownUrl": markdown_url,
                    "detectedSpeakers": speakers,
                    "appliedAliases": speaker_aliases,
                },
            )

        return json_response(self, {"error": "Not found"}, status=404)

    def do_PATCH(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/chat/threads/") and "/messages/" in parsed.path:
            parts = parsed.path.strip("/").split("/")
            if len(parts) == 6 and parts[:3] == ["api", "chat", "threads"] and parts[4] == "messages":
                thread_id = parts[3]
                message_id = parts[5]
                try:
                    payload = self._read_json_body()
                except ValueError as error:
                    return json_response(self, {"error": str(error)}, status=400)
                updated = update_message_payload_db(thread_id, message_id, payload)
                if updated is None:
                    return json_response(self, {"error": "Message not found"}, status=404)
                return json_response(self, {"message": updated})

        return json_response(self, {"error": "Not found"}, status=404)

    def do_HEAD(self):
        parsed = urlparse(self.path)
        if self._should_handle_with_range(parsed.path):
            return self._serve_file_with_range(send_body=False)
        return super().do_HEAD()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def guess_type(self, path):
        if path.endswith(".js"):
            return "application/javascript; charset=utf-8"
        if path.endswith(".css"):
            return "text/css; charset=utf-8"
        return mimetypes.guess_type(path)[0] or "application/octet-stream"

    def _should_handle_with_range(self, path: str) -> bool:
        return (
            path.startswith("/outputs/") or path.startswith("/tongyi-agent/outputs/")
        ) and path.endswith(".mp3")

    def _serve_file_with_range(self, send_body: bool):
        path = Path(self.translate_path(self.path))
        if not path.exists() or not path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return None

        file_size = path.stat().st_size
        range_header = self.headers.get("Range")
        ctype = self.guess_type(str(path))

        try:
            start, end = self._parse_range_header(range_header, file_size)
        except ValueError:
            self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
            self.send_header("Content-Range", f"bytes */{file_size}")
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", "0")
            self.send_header("Content-Type", ctype)
            self.end_headers()
            return None

        content_length = end - start + 1
        status = (
            HTTPStatus.PARTIAL_CONTENT
            if range_header is not None
            else HTTPStatus.OK
        )

        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(content_length))
        self.send_header("Last-Modified", self.date_time_string(path.stat().st_mtime))
        if range_header is not None:
            self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.end_headers()

        if not send_body:
            return None

        with path.open("rb") as file_obj:
            file_obj.seek(start)
            remaining = content_length
            while remaining > 0:
                chunk = file_obj.read(min(RANGE_CHUNK_SIZE, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)
        return None

    def _parse_range_header(self, header_value: str, file_size: int):
        if not header_value:
            return 0, file_size - 1

        if not header_value.startswith("bytes="):
            raise ValueError("Unsupported range unit")

        byte_range = header_value.split("=", 1)[1].strip()
        if "," in byte_range:
            raise ValueError("Multiple ranges not supported")

        start_str, end_str = byte_range.split("-", 1)
        if not start_str and not end_str:
            raise ValueError("Invalid range")

        if start_str:
            start = int(start_str)
            end = int(end_str) if end_str else file_size - 1
        else:
            suffix_length = int(end_str)
            if suffix_length <= 0:
                raise ValueError("Invalid suffix range")
            if suffix_length >= file_size:
                start = 0
            else:
                start = file_size - suffix_length
            end = file_size - 1

        if start < 0 or end < start or start >= file_size:
            raise ValueError("Range out of bounds")

        end = min(end, file_size - 1)
        return start, end

    def _read_json_body(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as error:
            raise ValueError("Invalid Content-Length header") from error

        body = self.rfile.read(length) if length > 0 else b"{}"
        try:
            return json.loads(body.decode("utf-8"))
        except json.JSONDecodeError as error:
            raise ValueError("Invalid JSON body") from error

    def _read_multipart_form(self) -> dict:
        content_type = self.headers.get("Content-Type", "")
        if not content_type.startswith("multipart/form-data"):
            raise ValueError("Content-Type must be multipart/form-data")

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ValueError("Invalid Content-Length header")
        if length <= 0:
            raise ValueError("上传内容为空")

        body = self.rfile.read(length)
        boundary_match = re.search(r"boundary=([^;]+)", content_type)
        if not boundary_match:
            raise ValueError("Invalid multipart boundary")
        boundary = boundary_match.group(1).strip().strip('"')
        delimiter = f"--{boundary}".encode("utf-8")

        fields: dict[str, list[str]] = {}
        files: list[dict] = []
        parts = body.split(delimiter)
        for part in parts:
            if not part or part in (b"--\r\n", b"--", b"\r\n"):
                continue
            chunk = part.strip(b"\r\n")
            if not chunk:
                continue
            header_bytes, sep, data = chunk.partition(b"\r\n\r\n")
            if not sep:
                continue

            headers_text = header_bytes.decode("utf-8", errors="ignore")
            disposition = ""
            content_type_header = ""
            for line in headers_text.split("\r\n"):
                lower = line.lower()
                if lower.startswith("content-disposition:"):
                    disposition = line
                elif lower.startswith("content-type:"):
                    content_type_header = line.split(":", 1)[1].strip()

            name_match = re.search(r'name="([^"]+)"', disposition)
            if not name_match:
                continue
            field_name = name_match.group(1)
            file_match = re.search(r'filename="([^"]*)"', disposition)
            if file_match and file_match.group(1):
                files.append(
                    {
                        "name": field_name,
                        "fileName": Path(file_match.group(1)).name,
                        "contentType": content_type_header,
                        "content": data.rstrip(b"\r\n"),
                    }
                )
            else:
                fields.setdefault(field_name, []).append(
                    data.decode("utf-8", errors="ignore").rstrip("\r\n")
                )

        return {"fields": fields, "files": files}

    def _read_upload_file(self) -> dict:
        form = self._read_multipart_form()
        upload = next((item for item in form["files"] if item.get("name") == "file"), None)
        if not upload or not upload.get("fileName"):
            raise ValueError("缺少 file 字段")
        if not upload["content"]:
            raise ValueError("上传文件为空")
        if len(upload["content"]) > 100 * 1024 * 1024:
            raise ValueError("文件过大，暂仅支持 100MB 以内")
        return {"fileName": upload["fileName"], "content": upload["content"]}


def main():
    os.chdir(CHAT_ROOT_DIR)
    bootstrap_environment()
    bootstrap_runtime_state()
    server = ThreadingHTTPServer((HOST, PORT), ViewerHandler)
    print(f"Serving meeting viewer at http://{HOST}:{PORT}/meeting-viewer/")
    server.serve_forever()


if __name__ == "__main__":
    main()

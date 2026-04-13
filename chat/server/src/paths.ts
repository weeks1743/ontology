import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const CHAT_ROOT_DIR = join(__dirname, "../..");
export const REPO_ROOT_DIR = join(CHAT_ROOT_DIR, "..");
export const TONGYI_ROOT_DIR = join(CHAT_ROOT_DIR, "tongyi-agent");
export const MEETING_VIEWER_DIR = join(CHAT_ROOT_DIR, "meeting-viewer");
export const RUNTIME_DIR = join(TONGYI_ROOT_DIR, "runtime");
export const OUTPUTS_DIR = join(TONGYI_ROOT_DIR, "outputs");
export const UPLOADS_DIR = join(RUNTIME_DIR, "uploads");
export const ARTIFACTS_DIR = join(RUNTIME_DIR, "artifacts");
export const CHAT_DB_FILE = join(RUNTIME_DIR, "chat.db");
export const VERIFY_SCRIPT = join(TONGYI_ROOT_DIR, "verify-offline", "run_offline_verify.py");
export const VENV_PYTHON = join(TONGYI_ROOT_DIR, ".venv", "bin", "python");

export const MEETING_VIEWER_PORT = Number(process.env.MEETING_VIEWER_PORT ?? "8124");
export const CHAT_SERVER_PORT = Number(process.env.CHAT_SERVER_PORT ?? "8123");

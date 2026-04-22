/**
 * Database bootstrap: creates MySQL database if missing, runs SQLAlchemy
 * create_all, and seeds initial data (see backend/seed.py).
 *
 * Prerequisites: MySQL server running; backend/.env (or env vars) with DB_*.
 * Run from repo root: npm run db
 * Run from frontend:  npm run db
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const backendDir = path.join(repoRoot, "backend");

function pythonCandidates() {
  const list = [];
  const seedArgs = ["seed.py", "--reset"];
  if (process.env.PYTHON) {
    list.push({ cmd: process.env.PYTHON, args: seedArgs });
  }
  const win = process.platform === "win32";
  const venvPy = win
    ? path.join(backendDir, "venv", "Scripts", "python.exe")
    : path.join(backendDir, "venv", "bin", "python");
  if (fs.existsSync(venvPy)) {
    list.push({ cmd: venvPy, args: seedArgs });
  }
  list.push({ cmd: "python", args: seedArgs });
  if (win) {
    list.push({ cmd: "py", args: ["-3", ...seedArgs] });
  }
  list.push({ cmd: "python3", args: seedArgs });
  return list;
}

console.log("Student Internet Usage Analysis System — database setup");
console.log(`Backend directory: ${backendDir}`);
console.log("Running seed.py --reset (recreate tables + full mock data)...\n");

if (!fs.existsSync(path.join(backendDir, "seed.py"))) {
  console.error("Error: backend/seed.py not found. Run this script from the project repository.");
  process.exit(1);
}

for (const { cmd, args } of pythonCandidates()) {
  // shell:false avoids cmd splitting paths that contain spaces (e.g. project folder name).
  const result = spawnSync(cmd, args, {
    cwd: backendDir,
    stdio: "inherit",
    shell: false,
    env: process.env,
  });
  if (result.status === 0) {
    process.exit(0);
  }
}

console.error("\nCould not run database setup.");
console.error("Ensure MySQL is running and DB_* in backend/.env is correct.");
console.error("Install Python dependencies in backend (e.g. pip install pymysql sqlalchemy passlib python-dotenv bcrypt python-jose[cryptography]).");
process.exit(1);

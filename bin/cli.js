#!/usr/bin/env node
// Custer skills — Installer CLI
// Installs/updates/uninstalls skills globally for OpenCode and Claude Code,
// and configures the Custer AI Studio API key used by publicar-presentacion.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const https = require("node:https");
const readline = require("node:readline");

const PKG = require(path.join(__dirname, "..", "package.json"));
const HOME = os.homedir();
const SOURCE_DIR = path.join(__dirname, "..", "skills");
const SKILL_NAMES = fs.readdirSync(SOURCE_DIR).filter((n) =>
  fs.statSync(path.join(SOURCE_DIR, n)).isDirectory()
);

const TARGETS = [
  { label: "OpenCode", dir: path.join(HOME, ".config", "opencode", "skills"), display: "~/.config/opencode/skills/" },
  { label: "Claude Code", dir: path.join(HOME, ".claude", "skills"), display: "~/.claude/skills/" },
];

// API key used by the publicar-presentacion skill.
const KEY_SKILL = "publicar-presentacion";
const KEY_FILE = path.join(HOME, ".config", "custer", "cai_key");
const KEY_FILE_DISPLAY = "~/.config/custer/cai_key";
const KEY_PATTERN = /^cai_[A-Za-z0-9_-]{20,}$/;
const KEY_CHECK_URL = "https://ai.custer.com.ar/api/agent-docs";
const KEY_CREATE_URL = "https://ai.custer.com.ar/config";
const MAX_KEY_ATTEMPTS = 3;

// ── helpers ────────────────────────────────────────────────────────────────

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true, force: true });
}

function rmDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function log(...args) {
  // eslint-disable-next-line no-console
  console.log(...args);
}

function isInteractive() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Reads a line without echoing it, so the key never shows on screen.
function askSecret(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let muted = false;
  rl._writeToOutput = (text) => {
    if (!muted) rl.output.write(text);
  };
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
    muted = true;
  });
}

function maskKey(key) {
  return `${key.slice(0, 8)}…`;
}

function readStoredKey() {
  try {
    const key = fs.readFileSync(KEY_FILE, "utf8").trim();
    return key || null;
  } catch {
    return null;
  }
}

function storeKey(key) {
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true, mode: 0o700 });
  fs.writeFileSync(KEY_FILE, `${key}\n`, { mode: 0o600 });
  fs.chmodSync(KEY_FILE, 0o600); // also tighten a pre-existing file
}

// Resolves to "valid", "invalid" or "unreachable".
function checkKey(key) {
  return new Promise((resolve) => {
    const req = https.get(
      KEY_CHECK_URL,
      { headers: { Authorization: `Bearer ${key}` }, timeout: 10000 },
      (res) => {
        res.resume();
        if (res.statusCode === 200) resolve("valid");
        else if (res.statusCode === 401 || res.statusCode === 403) resolve("invalid");
        else resolve("unreachable");
      }
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve("unreachable"));
  });
}

function printKeyHelp() {
  log(`  Para configurarla después:`);
  log(`    1. Creá una key en ${KEY_CREATE_URL} → API keys`);
  log(`    2. Corré: npx ${PKG.name} set-key`);
  log(`  (o exportá la variable de entorno CAI_KEY)\n`);
}

// Interactive API key setup. Never throws; installing skills must not fail
// because of the key step.
async function setupApiKey({ force = false } = {}) {
  log(`\n  🔑 API key de Custer AI Studio (para ${KEY_SKILL})`);

  if (!isInteractive()) {
    if (readStoredKey()) {
      log(`  ✓ Key ya configurada en ${KEY_FILE_DISPLAY}\n`);
    } else {
      log(`  − Sesión no interactiva: no se pidió la key.`);
      printKeyHelp();
    }
    return;
  }

  const existing = readStoredKey();
  if (existing && !force) {
    const answer = await ask(`  Ya hay una key configurada (${maskKey(existing)}). ¿Reemplazarla? (s/N) `);
    if (!/^s(i|í)?$/i.test(answer)) {
      log(`  ✓ Se mantiene la key actual.\n`);
      return;
    }
  }

  log(`  Creala en ${KEY_CREATE_URL} → API keys. Enter vacío para omitir.`);

  for (let attempt = 1; attempt <= MAX_KEY_ATTEMPTS; attempt++) {
    const key = await askSecret(`  API key (cai_...): `);
    if (!key) {
      log(`  − Omitido.`);
      printKeyHelp();
      return;
    }
    if (!KEY_PATTERN.test(key)) {
      log(`  ✗ Formato inválido: tiene que empezar con "cai_".`);
      continue;
    }

    const result = await checkKey(key);
    if (result === "invalid") {
      log(`  ✗ El servidor rechazó la key (inválida, revocada o expirada).`);
      continue;
    }

    storeKey(key);
    if (result === "valid") {
      log(`  ✓ Key verificada y guardada en ${KEY_FILE_DISPLAY}\n`);
    } else {
      log(`  ⚠️  No se pudo contactar ${KEY_CHECK_URL} para verificarla.`);
      log(`  ✓ Key guardada igual en ${KEY_FILE_DISPLAY}\n`);
    }
    return;
  }

  log(`  ✗ Demasiados intentos; no se guardó ninguna key.`);
  printKeyHelp();
}

// ── commands ───────────────────────────────────────────────────────────────

async function cmdInstall() {
  log(`\n  ${PKG.name} v${PKG.version}\n`);

  TARGETS.forEach((target) => {
    if (!fs.existsSync(target.dir)) {
      fs.mkdirSync(target.dir, { recursive: true });
      log(`  ✓ Created ${target.display}`);
    }
    SKILL_NAMES.forEach((name) => {
      copyDir(path.join(SOURCE_DIR, name), path.join(target.dir, name));
    });
    log(`  ✓ ${target.label}: ${SKILL_NAMES.join(", ")}`);
  });

  log(`\n  ✅ Skills instalados globalmente para OpenCode y Claude Code.`);

  if (SKILL_NAMES.includes(KEY_SKILL)) {
    await setupApiKey();
  } else {
    log();
  }
}

function cmdUninstall() {
  log();

  TARGETS.forEach((target) => {
    SKILL_NAMES.forEach((name) => {
      const dest = path.join(target.dir, name);
      if (fs.existsSync(dest)) {
        rmDir(dest);
        log(`  ✓ ${target.label}: removed ${name}/`);
      } else {
        log(`  − ${target.label}: ${name}/ not installed, skipped`);
      }
    });
  });

  log(`\n  ✅ Skills removidos de OpenCode y Claude Code.`);
  if (readStoredKey()) {
    log(`  ℹ️  La API key sigue en ${KEY_FILE_DISPLAY}; borrala a mano si ya no la usás`);
    log(`     y revocala en ${KEY_CREATE_URL} → API keys.`);
  }
  log();
}

function cmdVersion() {
  log(PKG.version);
}

function cmdStatus() {
  log(`\n  ${PKG.name} v${PKG.version}`);
  log(`  Package location: ${SOURCE_DIR}\n`);

  let allInstalled = true;
  TARGETS.forEach((target) => {
    log(`  ${target.label} (${target.display}):`);
    SKILL_NAMES.forEach((name) => {
      const ok = fs.existsSync(path.join(target.dir, name, "SKILL.md"));
      if (!ok) allInstalled = false;
      log(`    ${ok ? "✅" : "❌"} ${name}/`);
    });
  });

  if (SKILL_NAMES.includes(KEY_SKILL)) {
    const key = process.env.CAI_KEY || readStoredKey();
    const source = process.env.CAI_KEY ? "variable CAI_KEY" : KEY_FILE_DISPLAY;
    log(`\n  API key: ${key ? `✅ ${maskKey(key)} (${source})` : "❌ no configurada"}`);
  }

  if (allInstalled) {
    log(`\n  ✅ Todos los skills están instalados.\n`);
  } else {
    log(`\n  ⚠️  Faltan skills. Corre: npx ${PKG.name} install\n`);
  }
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  const cmd = process.argv[2] || "install";

  switch (cmd) {
    case "install":
    case "update":
      await cmdInstall();
      break;
    case "set-key":
      await setupApiKey({ force: true });
      break;
    case "uninstall":
      cmdUninstall();
      break;
    case "version":
    case "--version":
    case "-v":
      cmdVersion();
      break;
    case "status":
      cmdStatus();
      break;
    default:
      log(`\n  Usage: npx ${PKG.name} <command>\n`);
      log(`  Commands:`);
      log(`    install     Copy skills to OpenCode and Claude Code, then set up the API key (default)`);
      log(`    update      Same as install — re-copies latest version`);
      log(`    set-key     Set or replace the Custer AI Studio API key`);
      log(`    uninstall   Remove skills from OpenCode and Claude Code`);
      log(`    status      Check which skills are installed and whether the key is set`);
      log(`    version     Show package version\n`);
      process.exit(1);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`\n  ✗ ${err.message}\n`);
  process.exit(1);
});

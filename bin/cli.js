#!/usr/bin/env node
// @jtelg/custer-skills-jira — Installer CLI
// Installs/updates/uninstalls OpenCode skills globally.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const PKG = require(path.join(__dirname, "..", "package.json"));
const SKILLS_DIR = path.join(os.homedir(), ".config", "opencode", "skills");
const SOURCE_DIR = path.join(__dirname, "..", "skills");
const SKILL_NAMES = fs.readdirSync(SOURCE_DIR).filter((n) =>
  fs.statSync(path.join(SOURCE_DIR, n)).isDirectory()
);

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

// ── commands ───────────────────────────────────────────────────────────────

function cmdInstall() {
  log(`\n  @jtelg/custer-skills-jira v${PKG.version}\n`);

  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
    log(`  ✓ Created ~/.config/opencode/skills/`);
  }

  SKILL_NAMES.forEach((name) => {
    const src = path.join(SOURCE_DIR, name);
    const dest = path.join(SKILLS_DIR, name);
    copyDir(src, dest);
    log(`  ✓ Installed ${name}/`);
  });

  log(`\n  ✅ Skills instalados globalmente en ~/.config/opencode/skills/`);
  log(`  📦 Ya están disponibles para TODOS los proyectos de OpenCode.\n`);
}

function cmdUninstall() {
  log();

  SKILL_NAMES.forEach((name) => {
    const dest = path.join(SKILLS_DIR, name);
    if (fs.existsSync(dest)) {
      rmDir(dest);
      log(`  ✓ Removed ${name}/`);
    } else {
      log(`  − ${name}/ not installed, skipped`);
    }
  });

  log(`\n  ✅ Skills removidos de ~/.config/opencode/skills/\n`);
}

function cmdVersion() {
  log(PKG.version);
}

function cmdStatus() {
  const installed = [];
  const missing = [];

  SKILL_NAMES.forEach((name) => {
    const dest = path.join(SKILLS_DIR, name, "SKILL.md");
    if (fs.existsSync(dest)) {
      installed.push(name);
    } else {
      missing.push(name);
    }
  });

  log(`\n  @jtelg/custer-skills-jira v${PKG.version}`);
  log(`  Package location: ${SOURCE_DIR}\n`);
  log(`  Skills:`);

  SKILL_NAMES.forEach((name) => {
    const mark = installed.includes(name) ? "✅" : "❌";
    log(`    ${mark} ${name}/`);
  });

  if (installed.length === SKILL_NAMES.length) {
    log(`\n  ✅ Todos los skills están instalados.\n`);
  } else {
    log(`\n  ⚠️  Faltan skills. Corre: npx @jtelg/custer-skills-jira install\n`);
  }
}

// ── main ───────────────────────────────────────────────────────────────────

const cmd = process.argv[2] || "install";

switch (cmd) {
  case "install":
  case "update":
    cmdInstall();
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
    log(`\n  Usage: npx @jtelg/custer-skills-jira <command>\n`);
    log(`  Commands:`);
    log(`    install     Copy skills to ~/.config/opencode/skills/ (default)`);
    log(`    update      Same as install — re-copies latest version`);
    log(`    uninstall   Remove skills from ~/.config/opencode/skills/`);
    log(`    status      Check which skills are installed`);
    log(`    version     Show package version\n`);
    process.exit(1);
}

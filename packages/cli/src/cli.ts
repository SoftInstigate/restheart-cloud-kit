#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createAdminClient, type AdminClient } from './admin.js';
import { isApiError } from './http.js';
import { runSetup, type Setup, type SetupReport, type ProgressEvent } from './setup.js';
import {
  TOKEN_VAR,
  clearSession,
  resolveToken,
  sessionPath,
  writeSession,
  type ResolvedToken,
} from './session.js';

const DEFAULT_API = 'https://cloud-api.restheart.com';

/**
 * Looked for in the working directory when `--file` is not given.
 *
 * Conventional rather than configurable on purpose: `rhc setup --srv ea820b`
 * is the command people type dozens of times, and a flag that is always the
 * same value is a flag worth not typing. `.ts` first because that is what a
 * setup is normally written in — it wants the types.
 */
const DEFAULT_FILES = ['rhc.setup.ts', 'rhc.setup.mts', 'rhc.setup.js', 'rhc.setup.mjs'];

/**
 * What a personal access token starts with.
 *
 * Advisory only — it is server configuration, and this copy of it is used to
 * warn, never to refuse. See {@link warnIfNotAPat}.
 */
const PAT_PREFIX = 'rhc_live_';

const USAGE = `
rhc — the RESTHeart Cloud CLI

  rhc login
  rhc setup --srv ea820b
  rhc setup --srv ea820b --dry-run

  npm i -g @restheart-cloud/cli   for a terminal
  npx @restheart-cloud/cli setup  for a pipeline

Commands
  login           Store a personal access token for later commands.
                  Issue one at cloud.restheart.com, under your profile.
  logout          Forget the stored token.
  setup           Bring a service to the state your setup file describes.
                  Every step is a check and an apply, so running it against a
                  service already set up writes nothing.

Options
  --file <path>   A module exporting a setup (default export, or \`setup\`).
                  A function export is called with no arguments.
                  Defaults to ./${DEFAULT_FILES[0]}.
  --srv <id>      The service to set up.
  --dry-run       Run every check, apply nothing, write nothing.
  --api <url>     Admin node (default ${DEFAULT_API}).
  --json          Emit the report as JSON instead of a step list.
  --help

Credentials
  A personal access token, and never a password — the CLI has no way to accept
  one. A token carries the \`cli\` role rather than yours: it configures services
  and cannot buy one, and it is revoked by itself, without touching anything
  else the account is used for.

  ${TOKEN_VAR}    in a pipeline. Always wins over a stored session.
  rhc login           in a terminal. Stored 0600 under ~/.config/restheart.

  Never a flag: a credential in a flag is a credential in the shell history,
  and in the process list of every other user on the machine.

Exit codes
  0  every step satisfied or applied
  1  a step failed
  2  a dry run found work outstanding — configuration drift, not an error
`;

/** The commands this version answers to. `new` is specced, not built. */
const COMMANDS = ['login', 'logout', 'setup'] as const;
type Command = (typeof COMMANDS)[number];

interface Args {
  command?: Command;
  file?: string;
  srv?: string;
  api: string;
  dryRun: boolean;
  json: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { api: DEFAULT_API, dryRun: false, json: false, help: false };

  // The first bare word is the command. Taken before the option loop so an
  // unknown one is rejected as a command rather than as a stray option.
  const first = argv[0];
  if (first !== undefined && !first.startsWith('-')) {
    if (!(COMMANDS as readonly string[]).includes(first)) {
      throw new Error(`unknown command: ${first}\nAvailable: ${COMMANDS.join(', ')}`);
    }
    args.command = first as Command;
    argv = argv.slice(1);
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--file': args.file = argv[++i]; break;
      case '--srv': args.srv = argv[++i]; break;
      case '--api': args.api = argv[++i] ?? DEFAULT_API; break;
      case '--dry-run': args.dryRun = true; break;
      case '--json': args.json = true; break;
      case '--help':
      case '-h': args.help = true; break;
      default:
        // Rather than ignore it: a misspelled --dry-run that silently applied
        // the setup is the worst failure this tool could have.
        throw new Error(`unknown option: ${a}`);
    }
  }
  return args;
}

/**
 * The setup file to load: what `--file` named, or the first conventional name
 * present in the working directory.
 */
function resolveFile(explicit?: string): string {
  if (explicit !== undefined) return explicit;
  const found = DEFAULT_FILES.find(f => existsSync(resolve(process.cwd(), f)));
  if (found === undefined) {
    throw new Error(
      `no setup file found. Expected ./${DEFAULT_FILES[0]} in the working directory, ` +
        'or a path in --file.'
    );
  }
  return found;
}

/**
 * Load a setup from a module path.
 *
 * A `.ts` setup needs a runtime that can load one — Node 22.18 and later strip
 * types on their own, and anything earlier wants `tsx`. Saying so beats an
 * `Unknown file extension` stack trace.
 */
async function loadSetup(file: string): Promise<Setup> {
  const url = pathToFileURL(resolve(process.cwd(), file)).href;
  let mod: Record<string, unknown>;
  try {
    mod = (await import(url)) as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/Unknown file extension|Cannot find module/.test(message) && /\.tsx?$/.test(file)) {
      throw new Error(
        `${message}\n\nA TypeScript setup needs a runtime that can load one: Node 22.18+, or \`npx tsx\`.`
      );
    }
    throw err;
  }

  const exported = mod['default'] ?? mod['setup'];
  const setup = typeof exported === 'function' ? (exported as () => Setup)() : exported;

  if (!setup || typeof setup !== 'object' || !Array.isArray((setup as Setup).steps)) {
    throw new Error(`${file} does not export a setup (default export, or \`setup\`)`);
  }
  return setup as Setup;
}

/**
 * Ask a question, optionally without echoing the answer.
 *
 * A hidden prompt is the convention for a credential — `gh`, `npm` and `docker`
 * all do it — but a terminal that shows nothing at all is indistinguishable
 * from a terminal that has hung. **So a hidden prompt must say that it is
 * hidden**, in the question itself; a caller passing `silent` without saying so
 * is handing the reader a puzzle.
 */
async function prompt(question: string, silent = false): Promise<string> {
  // Written here rather than passed to `rl.question`, and that is the whole
  // trick: `_writeToOutput` below silences *everything* readline emits, the
  // prompt included. Leaving readline to draw it produced a blank line with a
  // cursor parked where the text should have been — a prompt you cannot read,
  // asking for input that does not echo, which looks exactly like a hung
  // terminal. Drawing it ourselves and handing readline an empty question keeps
  // the two concerns apart: we own the prompt, readline owns the echo.
  if (silent) process.stdout.write(question);

  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  if (silent) {
    // Nothing at all rather than bullets. For a password this hides the length,
    // which is worth a little; for a token it is worth nothing, since the shape
    // is fixed and public. It stays because the prompt now says the input is
    // hidden, which is the reassurance that was actually missing, and because a
    // masked paste of fifty characters is its own kind of noise.
    const out = rl as unknown as { output: NodeJS.WriteStream; _writeToOutput?: (s: string) => void };
    out._writeToOutput = () => {};
  }

  try {
    const answer = await new Promise<string>(res => rl.question(silent ? '' : question, res));
    if (silent) process.stdout.write('\n');
    return answer;
  } finally {
    rl.close();
  }
}

/**
 * What to say when the credential is not accepted.
 *
 * A bare `401` is true and useless. There are only two reasons a token that was
 * good is refused — it was revoked, or it expired — and neither is a thing the
 * user can debug from a status code. The cure differs by where the token came
 * from: a pipeline has no `rhc login` to run.
 */
function credentialError(source: ResolvedToken['source']): string {
  return source === 'env'
    ? `The token in ${TOKEN_VAR} was revoked or has expired. Issue a new one at ` +
        'cloud.restheart.com and update it in your secret store.'
    : 'Your session was revoked or has expired. Run `rhc login`.';
}

/** Turn anything thrown into one line worth printing. */
function describe(err: unknown): string {
  if (isApiError(err)) {
    return err.message ? `${err.message} (HTTP ${err.status})` : `HTTP ${err.status}`;
  }
  return err instanceof Error ? err.message : String(err);
}

function warnIfNotAPat(token: string): void {
  if (!token.startsWith(PAT_PREFIX)) {
    process.stderr.write(
      `Warning: this does not look like a personal access token (they start with ${PAT_PREFIX}).\n` +
        'It authenticated, so something accepted it — but a service admin token, for instance,\n' +
        'lives fifteen minutes, and storing one here means it stops working before you use it.\n'
    );
  }
}

/**
 * The token every command but `login` runs on.
 *
 * Refuses rather than guesses: there is no interactive fallback here, because a
 * `setup` that stops to ask for a credential is a `setup` that hangs a pipeline
 * until it times out.
 */
function requireToken(): ResolvedToken {
  const resolved = resolveToken();
  if (resolved) return resolved;

  if (process.env['RH_CLOUD_PASSWORD'] !== undefined || process.env['RH_CLOUD_EMAIL'] !== undefined) {
    throw new Error(
      'RH_CLOUD_EMAIL and RH_CLOUD_PASSWORD are no longer used. They were the account password, ' +
        'which reaches billing and every service and cannot be revoked without changing it ' +
        `everywhere.\nIssue a personal access token at cloud.restheart.com and set ${TOKEN_VAR}, ` +
        'or run `rhc login`.'
    );
  }

  throw new Error(
    process.stdin.isTTY
      ? 'Not logged in. Run `rhc login`.'
      : `${TOKEN_VAR} is not set, and there is no terminal to ask.\n` +
          "In a pipeline, set it from your platform's secret store."
  );
}

// ── commands ────────────────────────────────────────────────────────────────

/**
 * Store a token, having first checked that it works.
 *
 * The verification is the point. Writing an unchecked credential to disk moves
 * the failure to the next command, where it arrives as a `401` in the middle of
 * something the user cared about instead of at the moment they could still
 * paste the right thing.
 */
async function cmdLogin(args: Args): Promise<number> {
  const fromEnv = process.env[TOKEN_VAR]?.trim();

  if (!fromEnv && !process.stdin.isTTY) {
    process.stderr.write(
      `${TOKEN_VAR} is not set, and there is no terminal to ask.\n` +
        'In a pipeline, set it from your secret store — there is no need to run `rhc login` at all.\n'
    );
    return 1;
  }

  if (!fromEnv) {
    // Where to get one, on its own line — so the prompt itself stays short
    // enough that the note about the hidden input is the last thing read
    // before the cursor.
    process.stdout.write('Issue a personal access token at cloud.restheart.com, under your profile.\n');
  }

  const token =
    fromEnv || (await prompt('Token (input is hidden — paste it and press enter): ', true)).trim();

  if (!token) {
    process.stderr.write('No token given.\n');
    return 1;
  }

  const admin = createAdminClient({ apiBaseUrl: args.api });
  admin.useToken(token);

  try {
    await admin.verifyToken();
  } catch (err) {
    if (isApiError(err) && (err.status === 401 || err.status === 403)) {
      process.stderr.write(
        'That token was not accepted. It may have been revoked, it may have expired, ' +
          'or it may be a token for a different RESTHeart Cloud.\n'
      );
    } else {
      process.stderr.write(`Could not reach ${args.api}: ${describe(err)}\n`);
    }
    return 1;
  }

  warnIfNotAPat(token);

  const path = writeSession({ token, api: args.api });
  process.stdout.write(`Logged in to ${args.api}.\nToken stored in ${path} (mode 0600).\n`);
  return 0;
}

function cmdLogout(): number {
  const removed = clearSession();
  process.stdout.write(
    removed ? `Logged out. Removed ${sessionPath()}.\n` : 'Not logged in; nothing to remove.\n'
  );
  // Revoking is a separate act, and this command cannot do it: the token is
  // gone from this machine, not from the account.
  if (removed) {
    process.stdout.write(
      'The token still exists — revoke it at cloud.restheart.com if it should stop working.\n'
    );
  }
  return 0;
}

const GLYPH: Record<string, string> = {
  satisfied: '·',
  applied: '+',
  missing: '?',
  failed: '✗',
  skipped: '—',
};

function render(e: ProgressEvent): void {
  if (e.state === 'running') return;
  const counter = `[${String(e.index).padStart(String(e.total).length)}/${e.total}]`;
  const suffix = e.error ? ` — ${e.error}` : '';
  process.stdout.write(`${counter} ${GLYPH[e.state] ?? ' '} ${e.step}${suffix}\n`);
}

function summarise(report: SetupReport): void {
  const counts = new Map<string, number>();
  for (const s of report.steps) counts.set(s.state, (counts.get(s.state) ?? 0) + 1);
  const parts = [...counts].map(([state, n]) => `${n} ${state}`);
  process.stdout.write(`\n${report.name} on ${report.srvId}: ${parts.join(', ')}\n`);

  if (report.dryRun && report.steps.some(s => s.state === 'missing')) {
    process.stdout.write('Dry run — nothing was written. Re-run without --dry-run to apply.\n');
  }
}

async function cmdSetup(args: Args): Promise<number> {
  if (!args.srv) {
    process.stderr.write(`--srv is required.\n${USAGE}`);
    return 1;
  }

  const setup = await loadSetup(resolveFile(args.file));
  const credential = requireToken();

  // A stored token was verified against one admin node and means nothing to
  // another. Sending it anyway would be a production credential offered to
  // whatever host --api happened to name.
  if (credential.source === 'file' && credential.api !== undefined && credential.api !== args.api) {
    throw new Error(
      `Your stored session is for ${credential.api}, not ${args.api}.\n` +
        `Run \`rhc login --api ${args.api}\`, or set ${TOKEN_VAR}.`
    );
  }

  const admin: AdminClient = createAdminClient({ apiBaseUrl: args.api });
  admin.useToken(credential.token);

  try {
    await admin.verifyToken();
  } catch (err) {
    if (isApiError(err) && (err.status === 401 || err.status === 403)) {
      throw new Error(credentialError(credential.source));
    }
    throw err;
  }

  const report = await runSetup(setup, {
    admin,
    srvId: args.srv,
    dryRun: args.dryRun,
    // Nothing but a name and a state reaches this — a step that configures a
    // plugin has a secret in its arguments, and this output is the thing most
    // likely to end up in a CI log.
    ...(args.json ? {} : { onProgress: render }),
  });

  if (args.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else summarise(report);

  if (report.steps.some(s => s.state === 'failed')) return 1;
  if (report.steps.some(s => s.state === 'missing')) return 2;
  return 0;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.command === undefined) {
    // No command is not an error worth a non-zero exit only when it was asked
    // for: `rhc` alone should show what it can do, `rhc --srv x` should not
    // silently guess that `setup` was meant.
    const asked = args.help || process.argv.length <= 2;
    (asked ? process.stdout : process.stderr).write(USAGE);
    return asked ? 0 : 1;
  }

  switch (args.command) {
    case 'login': return cmdLogin(args);
    case 'logout': return cmdLogout();
    case 'setup': return cmdSetup(args);
  }
}

main().then(
  code => process.exit(code),
  err => {
    process.stderr.write(`${describe(err)}\n`);
    process.exit(1);
  }
);

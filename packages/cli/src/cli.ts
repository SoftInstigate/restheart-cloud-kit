#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createAdminClient } from './admin.js';
import { runSetup, type Setup, type SetupReport, type ProgressEvent } from './setup.js';

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

const USAGE = `
rhc — the RESTHeart Cloud CLI

  rhc setup --srv ea820b
  rhc setup --srv ea820b --dry-run

  npm i -g @restheart-cloud/cli   for a terminal
  npx @restheart-cloud/cli setup  for a pipeline

Commands
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
  RH_CLOUD_EMAIL and RH_CLOUD_PASSWORD, or a prompt when the terminal is
  interactive. Never a flag — a password in a flag is a password in the shell
  history, and in the process list of every other user on the machine.

Exit codes
  0  every step satisfied or applied
  1  a step failed
  2  a dry run found work outstanding — configuration drift, not an error
`;

/** The commands this version answers to. `login` and `new` are specced, not built. */
const COMMANDS = ['setup'] as const;
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

async function prompt(question: string, silent = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (silent) {
    // Echo nothing at all rather than asterisks: an onlooker counting
    // characters learns the password's length, which is worth something.
    const out = rl as unknown as { output: NodeJS.WriteStream; _writeToOutput?: (s: string) => void };
    out._writeToOutput = () => {};
  }
  try {
    const answer = await new Promise<string>(res => rl.question(question, res));
    if (silent) process.stdout.write('\n');
    return answer;
  } finally {
    rl.close();
  }
}

async function credentials(): Promise<{ email: string; password: string }> {
  const email = process.env['RH_CLOUD_EMAIL'];
  const password = process.env['RH_CLOUD_PASSWORD'];
  if (email && password) return { email, password };

  if (!process.stdin.isTTY) {
    throw new Error(
      'RH_CLOUD_EMAIL and RH_CLOUD_PASSWORD are not set, and there is no terminal to ask.\n' +
        'In a pipeline, set them from your platform\'s secret store.'
    );
  }

  return {
    email: email ?? (await prompt('RESTHeart Cloud email: ')),
    password: password ?? (await prompt('Password: ', true)),
  };
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
  if (!args.srv) {
    process.stderr.write(`--srv is required.\n${USAGE}`);
    return 1;
  }

  const setup = await loadSetup(resolveFile(args.file));
  const { email, password } = await credentials();

  const admin = createAdminClient({ apiBaseUrl: args.api });
  await admin.login(email, password);

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

main().then(
  code => process.exit(code),
  err => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
);

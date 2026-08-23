#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createAdminClient } from './admin.js';
import { runPlan, type Plan, type PlanReport, type ProgressEvent } from './plan.js';

const DEFAULT_API = 'https://cloud-api.restheart.com';

const USAGE = `
rh-config — apply a configuration plan to a RESTHeart Cloud service

  npx @restheart-cloud/kit-config --plan ./rh-plan.ts --srv ea820b
  npx @restheart-cloud/kit-config --plan ./rh-plan.ts --srv ea820b --dry-run

Options
  --plan <file>   A module exporting a plan (default export, or \`plan\`).
                  A function export is called with no arguments.
  --srv <id>      The service to configure.
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

interface Args {
  plan?: string;
  srv?: string;
  api: string;
  dryRun: boolean;
  json: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { api: DEFAULT_API, dryRun: false, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--plan': args.plan = argv[++i]; break;
      case '--srv': args.srv = argv[++i]; break;
      case '--api': args.api = argv[++i] ?? DEFAULT_API; break;
      case '--dry-run': args.dryRun = true; break;
      case '--json': args.json = true; break;
      case '--help':
      case '-h': args.help = true; break;
      default:
        // Rather than ignore it: a misspelled --dry-run that silently applied
        // the plan is the worst failure this tool could have.
        throw new Error(`unknown option: ${a}`);
    }
  }
  return args;
}

/**
 * Load a plan from a module path.
 *
 * A `.ts` plan needs a runtime that can load one — Node 22.18 and later strip
 * types on their own, and anything earlier wants `tsx`. Saying so beats an
 * `Unknown file extension` stack trace.
 */
async function loadPlan(file: string): Promise<Plan> {
  const url = pathToFileURL(resolve(process.cwd(), file)).href;
  let mod: Record<string, unknown>;
  try {
    mod = (await import(url)) as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/Unknown file extension|Cannot find module/.test(message) && /\.tsx?$/.test(file)) {
      throw new Error(
        `${message}\n\nA TypeScript plan needs a runtime that can load one: Node 22.18+, or \`npx tsx\`.`
      );
    }
    throw err;
  }

  const exported = mod['default'] ?? mod['plan'];
  const plan = typeof exported === 'function' ? (exported as () => Plan)() : exported;

  if (!plan || typeof plan !== 'object' || !Array.isArray((plan as Plan).steps)) {
    throw new Error(`${file} does not export a plan (default export, or \`plan\`)`);
  }
  return plan as Plan;
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

function summarise(report: PlanReport): void {
  const counts = new Map<string, number>();
  for (const s of report.steps) counts.set(s.state, (counts.get(s.state) ?? 0) + 1);
  const parts = [...counts].map(([state, n]) => `${n} ${state}`);
  process.stdout.write(`\n${report.plan} on ${report.srvId}: ${parts.join(', ')}\n`);

  if (report.dryRun && report.steps.some(s => s.state === 'missing')) {
    process.stdout.write('Dry run — nothing was written. Re-run without --dry-run to apply.\n');
  }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (!args.plan || !args.srv) {
    process.stderr.write(`--plan and --srv are both required.\n${USAGE}`);
    return 1;
  }

  const plan = await loadPlan(args.plan);
  const { email, password } = await credentials();

  const admin = createAdminClient({ apiBaseUrl: args.api });
  await admin.login(email, password);

  const report = await runPlan(plan, {
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

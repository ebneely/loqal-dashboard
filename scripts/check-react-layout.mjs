/**
 * Guard the one install invariant this app cannot build without: Next and the
 * app must resolve the SAME React.
 *
 * The monorepo root hoists react@18 — AdminJS, in loqal-backend, depends on it —
 * and npm will happily hoist `next` alongside it, because no other workspace
 * asks for next. When that happens Next's runtime resolves React 18 while the
 * app's own code resolves the React 19 nested here, two Reacts meet inside one
 * `next build`, and the export of /404 dies with:
 *
 *   Objects are not valid as a React child (found: object with keys
 *   {$$typeof, type, key, ref, props})     — React error #31
 *
 * which names neither React nor the install layout, and sends whoever reads it
 * hunting for an object being rendered in a component. Hence this check: the
 * failure is cheap to detect and expensive to diagnose.
 *
 * The fix is `npm run fix:deps`, which installs this workspace's tree locally so
 * next, react and react-dom sit beside each other the way a normal Next app has
 * them. The permanent fix belongs in the ROOT package.json, which this
 * workspace may not edit:
 *
 *   "overrides": { "react": "19.2.8", "react-dom": "19.2.8" }
 *
 * or moving AdminJS's React 18 out of the hoisted position.
 */
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appRequire = createRequire(join(appDir, 'noop.js'));

const versionFrom = (fromFile, pkg) => {
  try {
    return createRequire(fromFile)(`${pkg}/package.json`).version;
  } catch {
    return null;
  }
};

let nextPkg;
try {
  nextPkg = appRequire.resolve('next/package.json');
} catch {
  console.error('[react-layout] next is not installed. Run: npm run fix:deps');
  process.exit(1);
}

const problems = [];
for (const pkg of ['react', 'react-dom']) {
  const ours = versionFrom(join(appDir, 'noop.js'), pkg);
  const nexts = versionFrom(nextPkg, pkg);
  if (ours !== nexts) {
    problems.push(
      `  ${pkg}: this app resolves ${ours ?? 'nothing'}, next resolves ${nexts ?? 'nothing'}`
    );
  }
}

if (problems.length > 0) {
  console.error(
    [
      '',
      '[react-layout] Next and this app resolve different copies of React.',
      ...problems,
      '',
      '  The build will fail while exporting /404 with React error #31, which',
      '  does not mention React versions at all. Fix the install first:',
      '',
      '    npm run fix:deps',
      '',
    ].join('\n')
  );
  process.exit(1);
}

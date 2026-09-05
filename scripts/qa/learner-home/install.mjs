// Install a temporary local-only route. Never commit generated app route files.
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const source = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(source, '../../..');
const target = path.join(root, 'apps/web/src/app/[locale]/dev/learner-home-qa');
if (process.argv.includes('--remove')) {
  await rm(target, {recursive: true, force: true});
  console.log('Removed temporary learner home QA route');
} else {
  await mkdir(target, {recursive: true});
  await copyFile(path.join(source, 'page.tsx.fixture'), path.join(target, 'page.tsx'));
  await mkdir(path.join(target, 'rest/v1/profiles'), {recursive: true});
  await copyFile(path.join(source, 'route.ts.fixture'), path.join(target, 'rest/v1/profiles/route.ts'));
  console.log('Installed temporary route in ' + root);
}

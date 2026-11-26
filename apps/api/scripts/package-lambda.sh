#!/usr/bin/env bash
# Builds apps/api/dist/function.zip for Lambda Web Functions.
# Node won't strip TypeScript types inside node_modules, so our code and @exo/shared are
# bundled into index.js; npm dependencies stay external and ship as a normal node_modules.
set -euo pipefail
cd "$(dirname "$0")/.."
root=$(cd ../.. && pwd)
out=dist/pkg
rm -rf dist && mkdir -p "$out"

deps=$(node -p "Object.keys(require('./package.json').dependencies).filter(d => !d.startsWith('@exo/')).join(' ')")
# shellcheck disable=SC2086
"$root/node_modules/.bin/esbuild" src/server.ts --bundle --platform=node --format=esm --target=node24 \
  $(printf -- '--external:%s ' $deps) --outfile="$out/index.js"

# Pin each dependency to the version installed in the workspace.
# shortcut: transitive versions come from npm, not pnpm-lock.yaml; switch to `pnpm deploy` if the
# workspace ever turns on inject-workspace-packages.
node -e "
  const deps = Object.fromEntries('$deps'.split(' ').map(d => [d, require('$root/node_modules/' + d + '/package.json').version]));
  require('fs').writeFileSync('$out/package.json', JSON.stringify({ type: 'module', dependencies: deps }, null, 2));
"
(cd "$out" && pnpm install --prod --ignore-workspace --config.node-linker=hoisted --config.lockfile=false --reporter=silent)
# The Lambda nodejs24.x runtime refuses require() of ES modules, but @fastify/static (via
# swagger-ui) requires the ESM-only content-disposition@3. Rewrite that package as CommonJS.
# shortcut: one known package; if another ESM-only dependency appears, add it to this list.
for p in content-disposition; do
  d="$out/node_modules/$p"
  "$root/node_modules/.bin/esbuild" "$d/dist/index.js" --format=cjs --platform=node --outfile="$d/dist/index.cjs" --log-level=warning
  node -e "const f=require('path').resolve('$d/package.json'),j=require(f);delete j.type;j.main=j.exports='./dist/index.cjs';require('fs').writeFileSync(f,JSON.stringify(j,null,2))"
done
# Reproduce the runtime's behaviour locally: fail the build if @fastify/static still require()s ESM.
(cd "$out" && node --no-experimental-require-module -e "require('./node_modules/@fastify/static')") \
  || { echo "a CommonJS dependency still require()s an ESM-only package; add it to the list above"; exit 1; }

cp -R drizzle "$out/drizzle"

(cd "$out" && zip -qr ../function.zip .)
echo "apps/api/dist/function.zip ($(du -h dist/function.zip | cut -f1))"

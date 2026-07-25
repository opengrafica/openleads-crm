import * as esbuild from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

await esbuild.build({
  entryPoints: [path.join(projectRoot, 'server/prodServer.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: path.join(projectRoot, 'dist-server/prodServer.js'),
  packages: 'external',
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
})

console.log('Server build OK → dist-server/prodServer.js')

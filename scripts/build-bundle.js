import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

esbuild.build({
    entryPoints: [process.argv[2]],
    bundle: true,
    outfile: process.argv[3],
    target: [
    'chrome58',
    'firefox57',
    'safari11',
    'edge16',
    ]
});
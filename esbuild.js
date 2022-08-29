const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Select all typescript files of src directory as entry points
const entryPoints = fs.readdirSync(path.join(process.cwd(), "src"))
    .filter(
        (file) =>
            file.endsWith(".ts") &&
            fs.statSync(path.join(process.cwd(), "src", file)).isFile()
    )
    .map((file) => `src/${file}`);

esbuild
    .build({
        entryPoints: entryPoints,
        outdir: 'lib',
        bundle: true,
        sourcemap: true,
        minify: true,
        splitting: true,
        format: 'esm',
        target: ['esnext'],
        define: { global: "window" },
        external: ["react", "crypto"]
    })
    .catch(() => process.exit(1));


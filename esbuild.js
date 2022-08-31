const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Select all typescript files of src directory as entry points
const entryPoints = fs.readdirSync(path.join(process.cwd(), "src"))
    .filter(
        (file) =>
            file.endsWith(".ts") &&
            fs.statSync(path.join(process.cwd(), "src", file)).isFile()
    )
    .map((file) => `src/${file}`);

const params = {};
process.argv.forEach(function (val, index, array) {
    if (val.includes('=')) {
        const keyVal = val.split('=');
        params[keyVal[0]] = keyVal[1];
    }
});
console.log("esbuild.js params=", params);
if (params.watch === 'true') {
    params.watch = {
        onRebuild: (error, result) => {
            if (error) console.error('watch build failed:', error)
            else {
                onBuild();
                console.log('watch build succeeded:', result);
            }
        }
    }
}

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
        external: ["react"],
        watch: params.watch
    }).then(result => {
    onBuild();
    console.log(params.watch ? 'watching...' : '', result);
})
    .catch(() => process.exit(1));

function onBuild() {
    exec('yarn run ts-types', (err, stdout, stderr) => {
        if (err) {
            // node couldn't execute the command
            return;
        }

        // the *entire* stdout and stderr (buffered)
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);
    });
}

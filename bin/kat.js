#!node
const { resolve } = require('path');
const { visit } = require('../lib/util/visit');
const { iface } = require('../lib/enum');

if (process.send) {
    global.KA_INTERFACE = iface.IPC;
}
else if (!process.stdout.isTTY) {
    global.KA_INTERFACE = iface.PIPE;
}
else {
    global.KA_INTERFACE = iface.CLI;
}

// Detect piped input and interpolate into input
if (!process.stdin.isTTY && !process.send) {
    global.PIPED_INPUT = true;
}

const argHelers = {
    '$$NOW': () => new Date().toISOString(),
    '$$BOT': () => new Date(0).toISOString(),
}

async function main() {

    for (let i = 0; i < process.argv.length; i++) {
        const arg = process.argv[i];
        if (argHelers[arg]) {
            process.argv[i] = argHelers[arg]();
        }
    }

    const yargs = require('yargs');

    const options = {
        recurse: true,
        visit,
    };

    const val = await yargs
        .env('KA')
        .wrap(null)
        .commandDir(resolve(__dirname, '../lib/commands'), options)
        .recommendCommands()
        .help()
        .argv;
}

main().catch(console.error);

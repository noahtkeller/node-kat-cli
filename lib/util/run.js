/**
 * Yargs does not like handlers calling other yargs commands in the same process
 * So we export this fork function to run it in a separate process and pass data via IPC
 */

const { fork, spawn } = require('child_process');
const { resolve } = require('path');
const dot = require('dot-object');

function getArguments(args) {
    if (args[0] === 'ka') {
        args.shift();
    }

    if (typeof args[args.length - 1] === 'object') {
        const options = args.pop();
        const dotOpts = dot.dot(options);
        for (const key in dotOpts) {
            if (typeof dotOpts[key] === 'boolean') {
                args.push(`--${dotOpts[key] ? '' : 'no-'}${key}`);
            }
            else {
                args.push(`--${key}`);
                if (Array.isArray(dotOpts[key])) {
                    args.push(...dotOpts[key]);
                }
                else {
                    args.push(dotOpts[key]);
                }
            }
        }
    }

    return args;
}

async function ipc(...runArgs) {
    const args = getArguments(Array.isArray(runArgs) ? runArgs : [runArgs]);
    const child = fork(resolve(__dirname, '../../bin/ka.js'), args, { encoding: 'utf8', stdio: ['ipc'], detached: true });
    let err = '';
    child.stderr.on('data', (d) => err += d.toString());
    return new Promise((resolve, reject) => {
        const data = [];
        child.on('message', (d) => data.push(d));
        child.on('error', (err) => reject(err));
        child.on('close', (code) => code ? reject(`#run.ipc exit code ${code}:\n\narguments: ${args}\n\n${err}`) : resolve(data));
    });
}

function stream(...runArgs) {
    const args = getArguments(Array.isArray(runArgs) ? runArgs : [runArgs]);
    args.unshift(resolve(__dirname, '../../bin/ka.js'));
    return spawn('node', args, { detached: true });
}

module.exports = { ipc, stream };

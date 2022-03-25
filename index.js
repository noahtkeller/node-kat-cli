const { resolve } = require('path');
const { visit } = require('./lib/util/visit');
const yargs = require("yargs");

const options = {
    recurse: true,
    visit,
};

module.exports = yargs
    .env('KA')
    .wrap(null)
    .commandDir(resolve(__dirname, './lib/commands'), options)
    .recommendCommands()
    .help();

const path = require('path');
const { ObjectId } = require('mongodb');
const cheerio = require('cheerio');
const fs = require('fs/promises');
const { resolve } = require('path');
const got = require('got');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');

const { types, iface } = require('../enum');
const run = require('./run');

const plugins = require('./plugins');

async function resolveData(data) {
    switch (typeof data) {
        case 'string': {
            try {
                const { body } = await got(data);
                return body;
            } catch (e) {
                const relativePath = resolve(process.env.PWD, data);
                try {
                    const stats = await fs.lstat(relativePath);
                    if (stats.isFile()) {
                        try {
                            return require(relativePath);
                        } catch (e) {
                            return fs.readFile(relativePath, 'utf8');
                        }
                    }
                    if (stats.isDirectory()) {
                        return require(relativePath);
                    }
                } catch (e) {
                    console.log(e);
                    return data;
                }
            }
        }
    }
    return data;
}

/**
 * Add default type coercions
 * @param object {Object} The command module
 */
function coerceTypes(object) {
    Object.assign(object.allArgs, object.positional, object.options);
    for (const argName in object.allArgs) {
        const { type } = object.allArgs[argName];
        switch(type) {
            case types.MONGO.OBJECT_ID:
                object.allArgs[argName].coerce = (val) => new ObjectId(val);
                break;
            case types.STRING:
                object.allArgs[argName].coerce = (val) => String(val);
                break;
            case types.NUMBER:
                object.allArgs[argName].coerce = (val) => parseInt(val);
                break;
            case types.FLOAT:
                object.allArgs[argName].coerce = (val) => parseFloat(val);
                break;
            case types.BOOL:
                object.allArgs[argName].coerce = (val) => {
                    if (typeof val === 'boolean') {
                        return val;
                    }
                    switch(val) {
                        case '':
                        case '0':
                        case 0:
                        case null:
                        case undefined:
                        case 'f':
                        case 'false':
                            return false;
                        default:
                            return true;
                    }
                };
                break;
            case types.JSON:
                object.allArgs[argName].coerce = async(val) => {
                    const data = await resolveData(val);
                    if (typeof data === 'string') {
                        return JSON.parse(data);
                    }
                    return data;
                };
                break;
            case types.HTML:
                object.allArgs[argName].coerce = async(val) => cheerio.load(await resolveData(val));
                break;
        }
        // Patch coerce function to run on individual items in the array
        if (object.allArgs[argName].coerce) {
            const c = object.allArgs[argName].coerce;
            object.allArgs[argName].coerce = (val) => {
                if (Array.isArray(val)) {
                    return Promise.all(val.map((v) => c(v)));
                }
                return c(val);
            }
        }
    }
}

/**
 * Sets the default command if none was exported
 * @param object {Object} The command module
 * @param filePath {String} The file path
 * @param fileName {String} The file name
 */
function setDefaults(object, filePath, fileName) {
    object.allArgs ??= {};
    object.argMap ??= {};
    object.positional ??= {};
    object.options ??= {};
    object.context ??= {};
    object.example ??= [];

    // Command
    let command = fileName.replace(path.extname(fileName), '');
    switch (fileName) {
        case 'index.js':
            command = path.basename(path.dirname(filePath));
            break;
    }
    object.commandName ??= command;
    const positionals = Object.keys(object.positional);
    for (let i = 0; i < positionals.length; i++) {
        let acc = '';
        const name = positionals[i];
        const positional = object.positional[name];
        const [pre, post] = positional.required ? ['<', '>'] : ['[', ']'];
        if (positional.accumulate) {
            if (i !== positionals.length - 1) {
                throw new Error('Accumulator positionals can only be in the last positional');
            }
            acc = '...';
        }
        command += ` ${pre}${name}${acc}${post}`;
    }
    object.command ??= command;

    for (const option in object.options) {
        const def = object.options[option];
        def.group ??= 'Parameters:';
    }
}

function assignPrefix(key, options) {
    const assigned = {};
    for (const k in options) {
        assigned[`${key}.${k}`] = options[k];
    }
    return assigned;
}

function buildDependencies(object) {
    const { context } = object;

    for (const key in context) {
        const dependency = context[key];
        const plugin = plugins[dependency.type];
        if (!plugin) {
            continue;
        }
        Object.assign(object.options, plugin.options && assignPrefix(key, plugin.options) || {});
    }
}

const builderFactory = (object) => (yargs) => {
    const { positional, allArgs, argMap, options, examples, commandName, context } = object;
    if (positional) {
        Object.assign(allArgs, positional);
        for (const key in positional) {
            const def = positional[key];
            if (def.map) {
                argMap[key] = def.map;
            }
            yargs.positional(key, def);
        }
    }

    if (options) {
        for (const option in options) {
            const def = options[option];
            yargs.option(option, def);
        }
    }

    for (const ex of Array.isArray(examples) ? examples : [examples]) {
        if (typeof ex === 'string') {
            yargs.example(`$0 ${commandName} ${ex}`);
        }
        if (typeof ex === 'object') {
            const { example, description } = ex;
            yargs.example(`$0 ${commandName} ${example}`, description);
        }
    }
};

const contextFactory = ({ context }) => async(args) => {
    const ctx = { run };

    for (const key in context) {
        if (key in ctx) {
            continue;
        }
        const dependency = context[key];
        const plugin = plugins[dependency.type];
        if (!plugin || !plugin.context) {
            continue;
        }
        plugin.context({ ctx, key, args });
    }

    return ctx;
};

const respondFactory = (object) => async(res, args) => {
    const sendOutput = (value) => {
        switch(global.KA_INTERFACE) {
            case iface.IPC:
                process.send(value);
                break;
            case iface.CLI:
            case iface.PIPE:
                console.log(value);
                break;
        }
    };

    const transform = (val) => {
        switch(global.KA_INTERFACE) {
            case iface.IPC:
                return val;
            case iface.CLI:
                return JSON.stringify(val, null, '    ');
            case iface.PIPE:
                return JSON.stringify(val);
        }
    };

    if (res?.pipe) {
        const output = new Transform({
            readableObjectMode: true,
            writableObjectMode: true,
            transform(chunk, encoding, callback) {
                sendOutput(transform(chunk));
                callback();
            }
        });
        await pipeline(res, output);
    } else if (res) {
        sendOutput(transform(res));
    }
};

const handlerFactory = (obj, context, respond) => async(args) => {
    const { handler } = obj;
    try {
        const ctx = await context(args);
        const res = await handler.call(ctx, args);
        await respond(res, args);
    } catch (e) {
        console.log(e);
    }
};

function visit(object, pathToFile, fileName) {
    setDefaults(object, pathToFile, fileName);
    coerceTypes(object);
    buildDependencies(object);

    const { describe, command, options } = object;
    const context = contextFactory(object);
    const respond = respondFactory(object);

    const modified = {
        command,
        options,
        builder: builderFactory(object),
        handler: handlerFactory(object, context, respond),
    };

    if (describe) {
        modified.describe = describe;
    }

    return modified;
}

module.exports = {
    visit,
    setDefaults,
    coerceTypes,
    builderFactory,
    handlerFactory,
    resolveData,
    contextFactory,
};

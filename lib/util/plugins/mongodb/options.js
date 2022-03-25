module.exports = {
    'user': {
        type: 'string',
        describe: 'Mongo connection information',
        group: 'MongoDB:',
    },
    'pass': {
        type: 'string',
        describe: 'Mongo connection information',
        group: 'MongoDB:',
    },
    'host': {
        type: 'string',
        default: 'localhost',
        describe: 'Mongo connection information',
        group: 'MongoDB:',
    },
    'port': {
        type: 'number',
        default: 27017,
        describe: 'Mongo connection information',
        group: 'MongoDB:',
    },
    'database': {
        type: 'string',
        describe: 'Mongo connection information',
        group: 'MongoDB:',
    },
    'options.useNewUrlParser': {
        type: 'boolean',
        describe: 'Mongo connection options',
        group: 'MongoDB:',
        default: true,
    },
    'options.useUnifiedTopology': {
        type: 'boolean',
        describe: 'Mongo connection options',
        group: 'MongoDB:',
        default: true,
    },
    'options.ssl': {
        type: 'boolean',
        describe: 'Mongo connection options',
        group: 'MongoDB:',
        default: false,
    },
};

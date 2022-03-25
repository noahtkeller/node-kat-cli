const { Transform } = require('stream');

const { types } = require('../../enum');

module.exports.positional = {
    userIds: {
        accumulate: true,
        required: true,
        type: types.JSON,
        describe: 'The MongoDB ObjectId',
    },
};

module.exports.options = {
    test: {
        type: 'string',
        describe: 'The test type',
    },
};

module.exports.examples = [
    'dsdadasd-asadas-asdsad',
    { example: 'dsdadasd-asadas-asdsad --test', description: 'Get all of the test data' }
];

module.exports.context = {
  mongodb: {
      type: types.MONGO.CONNECTION,
  },
};

module.exports.handler = function({ userIds }) {
    const res = new Transform({
        readableObjectMode: true,
        writableObjectMode: true,
        transform(chunk, encoding, callback) {
            if (typeof chunk === 'string') {
                this.push(JSON.parse(chunk));
            }
            else if (chunk instanceof Buffer) {
                this.push(JSON.parse(chunk.toString()));
            }
            else {
                this.push(chunk);
            }
            callback();
        }
    });

    this.run.stream('another', userIds[1]).stdout.pipe(res, { end: false });
    this.run.ipc('another', userIds[0][0]).then(([result]) => res.write(result));
    this.run.ipc('another', userIds[0][1]).then(([result]) => res.write(result));

    return res;
};

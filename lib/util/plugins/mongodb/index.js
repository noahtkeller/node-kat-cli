const { MongoClient } = require('mongodb');

const { types } = require('../../../enum');

module.exports.options = require('./options');

module.exports.type = types.MONGO.CONNECTION;

module.exports.context = function({ ctx, key, args }) {
    const mongo = args[key];
    const userString = mongo.user && mongo.pass ? `${mongo.user}:${mongo.pass}@` : '';
    const dbString = mongo.database ? `/${mongo.database}` : '/';
    ctx[key] = new MongoClient(`mongodb://${userString}${mongo.host}:${mongo.port}${dbString}`);
};

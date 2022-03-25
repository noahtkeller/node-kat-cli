const MongoPlugin = require('./mongodb');

module.exports = {
    [MongoPlugin.type]: MongoPlugin,
};

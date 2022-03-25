module.exports.options = {
    name: {
        type: 'string',
        describe: 'The name to greet',
    }
};

module.exports.handler = async function({ name }) {
    return { message: `Hello, ${name}, welcome to another!` };
};

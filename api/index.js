const serverless = require('serverless-http');
const app = require('../lib/app');

module.exports = serverless(app);

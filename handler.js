'use strict';
const handler = require('serverless-express/handler');
const app = require('./lib/app');


exports.api = handler(app);

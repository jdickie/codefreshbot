'use strict';
const handler = require('serverless-express/handler');
const app = require('./lib/app');
const cf_modal = require('./lib/cf_modal');
const config = require('config');

const projects = config.get('codefresh.projects');

const deploy = async (event, context) => {
    const trigger_id = event.body.trigger_id;
    cf_modal.start(trigger_id);
};
exports.deploy = deploy;
exports.api = handler(app);

const cf_modal = require('./cf_modal');
const express = require('express');
const handler = require('serverless-express/handler');
const app = express();
app.use('/deploy_git_tag', async (req, res) => {
    console.log(req);
    await cf_modal.start(req.body.trigger_id);
});

app.use(express.urlencoded({ extended: true }));
// Parsing application/json
app.use(express.json());
exports.handler = handler(app);
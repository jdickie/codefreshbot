const cf_modal = require('./cf_modal');
const express = require('express');
const handler = require('serverless-express/handler');
const config = require('config');
const app = express();

const { createEventAdapter } = require('@slack/events-api');
const SLACK_SIGNING_SECRET = config.get('slack.signing_secret');

const slackEvents = createEventAdapter(SLACK_SIGNING_SECRET);
slackEvents.on('url_verification', (event, respond) => {
    try {
        if (!event.challenge) {
            console.log("No challenge present - exiting");
            next();
        }
        respond(null, {
            content: event.challenge
        });
    } catch {
        console.log("error responding to challenge");
        // don't continue
    }
});
// Parsing application/json
app.use(express.json());
// Slack has mixed url-form-encoded values and other endpoints with JSON. Enabling x-www-form-urlencoded here
app.use(express.urlencoded({ extended: true }));
app.use('/events', slackEvents.requestListener());

exports.handler = handler(app);
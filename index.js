const util = require('util');
const { createEventAdapter } = require('@slack/events-api');
const { Codefresh, Config } = require('codefresh-sdk');
const configjson = require('config');
const express = require('express');

const CODEFRESH_AUTH_TOKEN = configjson.get('codefresh.token');
const SLACK_SIGNING_SECRET = configjson.get('slack.signing_secret');

const slackEvents = createEventAdapter(SLACK_SIGNING_SECRET);
const app = express();

slackEvents.on('url_verification', (event) => {
    try {
        console.log(event);
        if (!event.challenge) {
            console.log("No challenge present - exiting");
            next();
        }
        res.set('Content-Type', 'text/plain').status(200).send(event.challenge);
        next();
    } catch {
        console.log("error responding to challenge");
        // don't continue
        res.send(400);
    }

});

app.post('/events', slackEvents.requestListener());

async function getCodefreshSDK() {
    return new Codefresh(await Config.load({
        url: 'https://g.codefresh.io',
        apiKey: CODEFRESH_AUTH_TOKEN,
    }));
};

let sdk = null;
app.listen(configjson.get('port'), () => {
    sdk = getCodefreshSDK();
    console.log("Online");
});
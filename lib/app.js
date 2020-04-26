const { createMessageAdapter } = require('@slack/interactive-messages');
const { createEventAdapter } = require('@slack/events-api');
const { WebClient, LogLevel } = require('@slack/web-api');
const rp = require('request-promise-native');
const configjson = require('config');
const express = require('express');
const bodyParser = require('body-parser');
const cf_modal = require('./cf_modal');

const BOT_OAUTH_TOKEN = configjson.get('slack.bot.token');
const CODEFRESH_AUTH_TOKEN = configjson.get('codefresh.token');
const SLACK_SIGNING_SECRET = configjson.get('slack.signing_secret');
const VIEW_SUBMISSION_CALLBACK_ID = 'codefresh_form';

const projects = configjson.get('codefresh.projects');


const slackInteractive = createMessageAdapter(SLACK_SIGNING_SECRET);
const web = new WebClient(BOT_OAUTH_TOKEN);
const slackEvents = createEventAdapter(SLACK_SIGNING_SECRET);
const app = express();

/**
 * Used for health checks from Kubernetes. TODO: maybe make this check
 * connection to github?
 */
app.use('/status', (req, res) => {
    res.send(200);
});

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

slackEvents.on('app_mention', async (event) => {
    const channelID = event.channel;
    const user = event.user;
    web.chat.postEphemeral({
        user: user,
        channel: channelID,
        text: "Available commands:\n/deploy_git_tags"
    });
});

slackInteractive.action({type: 'static_select'}, async (payload, respond) => {
    try {
        console.log(`block_actions hit with\n ${JSON.stringify(payload)}`);
        if (payload.type === "block_actions") {
            switch(payload.actions[0].action_id) {
                case "cf_repo_select_action":
                    cf_modal.update_with_repos(payload);
                    break;
                case "cf_release_select_action":
                    cf_modal.update_release_selection(payload);
                    break;
                case "cf_env_select_action":
                    cf_modal.update_env_selection(payload);
                    break;
            }
        }
    } catch(err) {
        console.log(JSON.stringify(err.data));
    }
    
});

slackInteractive.viewSubmission(VIEW_SUBMISSION_CALLBACK_ID, async (payload) => {
    try {

        const metaParts = payload.view.private_metadata.split(':');
        const result = await rp({
            uri: `https://g.codefresh.io/api/pipelines/run/${encodeURIComponent(metaParts[0])}`,
            method: 'POST',
            body: {
                name: metaParts[0], 
                branch: metaParts[1],
                trigger: metaParts[2]
            },
            headers: {
                'Content-Type': 'application/json',
                'Authorization': CODEFRESH_AUTH_TOKEN
            },
            json: true
        });
        await web.chat.postEphemeral({
            user: payload.user_id,
            channel: payload.channel_id,
            text: `Build URL: https://g.codefresh.io/build/${result}`
        });
    } catch (err) {
        console.log(err);
    }
    
});

app.use('/interactions', slackInteractive.requestListener());
app.use('/events', slackEvents.requestListener());
app.use(bodyParser.urlencoded({ extended: false }));

/**
 * This is what actually starts up the modal now
 */
app.use('/deploy_version', async (req, res) => {
    try {
        const trigger_id = req.body.trigger_id;
        const result = await cf_modal.start(trigger_id);
        if (result.ok == true) {
            console.log(result.view.id);
        }
        res.send(200);
    } catch(err) {
        console.log(`Error: ${JSON.stringify(err)}`);
        res.status(500).send('Oops...something went wrong on our end');
    }
})

// Parsing application/json
app.use(express.json());
// Slack has mixed url-form-encoded values and other endpoints with JSON. Enabling x-www-form-urlencoded here
app.use(express.urlencoded({ extended: true }));

module.exports = app;
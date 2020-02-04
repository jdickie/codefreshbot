const { createMessageAdapter } = require('@slack/interactive-messages');
const { createEventAdapter } = require('@slack/events-api');
const { WebClient } = require('@slack/web-api');
const rp = require('request-promise-native');
const configjson = require('config');
const express = require('serverless-express/express')
const bodyParser = require('body-parser');
const cf_modal = require('./cf_modal');

const BOT_OAUTH_TOKEN = configjson.get('slack.bot.token');
const CODEFRESH_AUTH_TOKEN = configjson.get('codefresh.token');
const SLACK_SIGNING_SECRET = configjson.get('slack.signing_secret');
const VIEW_SUBMISSION_CALLBACK_ID = 'codefresh_form';


let viewId = '';

const slackInteractive = createMessageAdapter(SLACK_SIGNING_SECRET);
const web = new WebClient(BOT_OAUTH_TOKEN);
const slackEvents = createEventAdapter(SLACK_SIGNING_SECRET);
const app = express();

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
        text: ":thumbsup: Starting..."
    });
    cf_modal.start();
});

slackInteractive.action({type: 'static_select'}, async (payload, respond) => {
    try {
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

        console.log(`env: ${cf_modal.selectedEnv} project: ${cf_modal.selectedProject} release: ${cf_modal.selectedRelease}`);
        const result = await rp({
            uri: `https://g.codefresh.io/api/pipelines/run/${encodeURIComponent(cf_modal.selectedProject)}`,
            method: 'POST',
            body: {
                name: cf_modal.selectedProject, 
                branch: cf_modal.selectedRelease,
                trigger: cf_modal.selectedEnv
            },
            headers: {
                'Content-Type': 'application/json',
                'Authorization': CODEFRESH_AUTH_TOKEN
            },
            json: true
        });
        console.log(`result: ${JSON.stringify(result.body)}`);
        web.chat.postEphemeral({
            user: cf_modal.user_id,
            channel: cf_modal.channel_id,
            text: 'Running...',
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'plain_text',
                        text: `Running ${cf_modal.selectedProject} for ${cf_modal.selectedEnvDisplayName}`
                    }
                },
                {
                    type: 'section',
                    text: {
                        type: 'plain_text',
                        text: ''
                    }
                }
            ]
        });
    } catch (err) {
        console.log(err);
    }
    
});

app.use('/interactions', slackInteractive.requestListener());
app.use('/events', slackEvents.requestListener());
app.use(bodyParser.urlencoded({ extended: false }))
app.use('/deploy_git_tag', (req, res) => {
    res.status(200).send(':thumbsup: opening up modal...');
    try {
        const trigger_id = req.body.trigger_id;
        cf_modal.start(trigger_id, req.body.channel_id, req.body.user_id);
    } catch(err) {
        console.log(`Error: ${JSON.stringify(err)}`);
        res.status(500).send('Oops...something went wrong on our end');
    }
})

let sdk = null;
// Parsing application/json
app.use(express.json());
// Slack has mixed url-form-encoded values and other endpoints with JSON. Enabling x-www-form-urlencoded here
app.use(express.urlencoded({ extended: true }));

module.exports = app;
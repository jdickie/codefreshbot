const { createMessageAdapter } = require('@slack/interactive-messages');
const { createEventAdapter } = require('@slack/events-api');
const { WebClient } = require('@slack/web-api');
const { Codefresh, Config } = require('codefresh-sdk');
const configjson = require('config');
const express = require('express');
const bodyParser = require('body-parser');
const cf_modal = require('./lib/cf_modal');

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
        if (payload.type === "block_actions" && 
            payload.actions[0].action_id === "cf_repo_select_action") {
                cf_modal.update_with_repos(payload);
        }
    } catch(err) {
        console.log(JSON.stringify(err.data));
    }
    
});

slackInteractive.viewSubmission(VIEW_SUBMISSION_CALLBACK_ID, async (payload) => {
    console.log(`viewID; ${viewId}`);
    try {
        // const result = await web.views.update({
        //     view_id: viewId,
        //     view: {
        //         type: 'modal',
        //         callback_id: VIEW_SUBMISSION_CALLBACK_ID,
        //         title: {
        //             type: 'plain_text',
        //             text: 'WIP :dealwithit:'
        //         },
        //         submit: {
        //             type: "plain_text",
        //             text: "Submit"
        //         },
        //         blocks: [{
        //             type: 'section',
        //             block_id: 'cf_tag_select',
        //             text: {
        //                 type: 'mrkdwn',
        //                 text: 'WIPS'
        //             },
        //             accessory: {
        //                 action_id: 'cf_release_select_action',
        //                 type: 'static_select',
        //                 placeholder: {
        //                     type: 'plain_text',
        //                     text: 'Git releases'
        //                 },
        //                 options: [
        //                     {
        //                         text: {
        //                             text: 'WIP',
        //                             type: 'plain_text'
        //                         },
        //                         value: 'WIP'
        //                     }
        //                 ]
        //             }
        //         }]
        //     }
        // });
        console.log(`result: ${JSON.stringify(result)}`);
    } catch (err) {
        console.log(`error: ${JSON.stringify(err)}`);
    }
    
});

app.use('/interactions', slackInteractive.requestListener());
app.use('/events', slackEvents.requestListener());
app.use(bodyParser.urlencoded({ extended: false }))
app.use('/deploy_git_tag', (req, res) => {
    res.status(200).send(':thumbsup: opening up modal...');
    const trigger_id = req.body.trigger_id;
    cf_modal.start(trigger_id);
})

async function getCodefreshSDK() {
    return new Codefresh(await Config.load({
        url: 'https://g.codefresh.io',
        apiKey: CODEFRESH_AUTH_TOKEN,
    }));
};

let sdk = null;
// Parsing application/json
app.use(express.json());
// Slack has mixed url-form-encoded values and other endpoints with JSON. Enabling x-www-form-urlencoded here
app.use(express.urlencoded({ extended: true }));
app.listen(configjson.get('port'), () => {
    sdk = getCodefreshSDK();
    console.log("Online");
});
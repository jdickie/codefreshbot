const Octokit = require('@octokit/rest');
const { createMessageAdapter } = require('@slack/interactive-messages');
const { createEventAdapter } = require('@slack/events-api');
const { WebClient } = require('@slack/web-api');
const { Codefresh, Config } = require('codefresh-sdk');
const configjson = require('config');
const express = require('express');

const GITHUB_ACCESS_TOKEN = configjson.get('github.access_token');
const BOT_OAUTH_TOKEN = configjson.get('slack.bot.token');
const CODEFRESH_AUTH_TOKEN = configjson.get('codefresh.token');
const SLACK_SIGNING_SECRET = configjson.get('slack.signing_secret');

/* @var Array */
const projects = configjson.get('codefresh.projects');

const octokit = new Octokit({
    auth: GITHUB_ACCESS_TOKEN,
    userAgent: configjson.get('github.user_agent')
});

const slackInteractive = createMessageAdapter(SLACK_SIGNING_SECRET);
const web = new WebClient(BOT_OAUTH_TOKEN);
const slackEvents = createEventAdapter(SLACK_SIGNING_SECRET);
const app = express();

slackEvents.on('url_verification', (event, respond) => {
    try {
        console.log(event);
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
    let textBlockProjects = [];
    projects.forEach((proj) => {
        textBlockProjects.push({text: 
            {
                type: 'plain_text', 
                text: proj['cf_name']}, 
                value: `${proj['owner']}:${proj['repo']}`
            });
        });
    await web.chat.postEphemeral({
        channel: channelID,
        user: user,
        text: 'CodefreshBot',
        blocks: [
            {
                type: 'section',
                block_id: 'cf_project_select',
                text: {
                    type: 'mrkdwn',
                    text: "Pick a git repo"
                },
                accessory: {
                    action_id: 'cf_repo_select_action',
                    type: 'static_select',
                    placeholder: {
                        type: 'plain_text',
                        text: 'Select a git repo'
                    },
                    options: textBlockProjects
                }
            }
        ]
    });
});

slackInteractive.action({type: 'static_select'}, async (payload, respond) => {
    console.log(payload.channel);
    const selectedOption = payload.actions[0].selected_option;
    const values = selectedOption.value.split(':');
    const owner = values[0];
    const repo = values[1];
    const user = payload.user.id;
    respond({
        text: `:thumbsup: Thanks, looking up some info on ${selectedOption.text.text}`
    });
    try {
        const options = octokit.repos.listReleases.endpoint.merge({
            owner: owner,
            repo: repo,
            per_page: 5
        });
        const tagOptions = await octokit.paginate(
            options, 
            response => response.data.map((release) => {
                return {
                    text: {
                        type: 'plain_text',
                        text: release.tag_name
                    },
                    value: release.tag_name
                };
            })
        );
        await web.chat.postEphemeral({
            user: user,
            channel: payload.channel.id,
            text: {
                type: 'plain_text',
                text: ':wow: Found some things'
            },
            blocks: [{
                type: 'section',
                block_id: 'cf_tag_select',
                text: {
                    type: 'mrkdwn',
                    text: `Releases from ${repo}`
                },
                accessory: {
                    action_id: 'cf_release_select_action',
                    type: 'static_select',
                    placeholder: {
                        type: 'plain_text',
                        text: 'Select a git release'
                    },
                    options: tagOptions
                }
            }]
        });
    } catch(err) {
        console.log(err);
        web.chat.postEphemeral({
            user: user,
            channel: payload.channel.id,
            text: 'Oops, something went wrong'
        });
    }
    
})

app.use('/interactions', slackInteractive.requestListener());
app.use('/events', slackEvents.requestListener());

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
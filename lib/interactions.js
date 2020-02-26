const cf_modal = require('./cf_modal');
const { createMessageAdapter } = require('@slack/interactive-messages');
const config = require('config');
const { WebClient } = require('@slack/web-api');

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const SLACK_SIGNING_SECRET = configjson.get('slack.signing_secret');
const slackInteractive = createMessageAdapter(SLACK_SIGNING_SECRET);
const web = new WebClient(BOT_OAUTH_TOKEN);

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

exports.handler = async (event, context) => {
    const trigger_id = event.body.trigger_id;
    console.log(event);
    return context;
};
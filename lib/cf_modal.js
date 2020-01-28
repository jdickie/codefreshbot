const Octokit = require('@octokit/rest');
const { WebClient } = require('@slack/web-api');
const configjson = require('config');

const GITHUB_ACCESS_TOKEN = configjson.get('github.access_token');
const BOT_OAUTH_TOKEN = configjson.get('slack.bot.token');
const VIEW_SUBMISSION_CALLBACK_ID = 'codefresh_form';
const web = new WebClient(BOT_OAUTH_TOKEN);

const octokit = new Octokit({
    auth: GITHUB_ACCESS_TOKEN,
    userAgent: configjson.get('github.user_agent')
});

/* @var Array */
const projects = configjson.get('codefresh.projects');

class cf_modal {
    constructor() {
    }

    async start(trigger_id) {
        let textBlockProjects = [];
        projects.forEach((proj) => {
            textBlockProjects.push({
                text: {
                    type: 'plain_text', 
                    text: proj['cf_name']}, 
                    value: `${proj['owner']}:${proj['repo']}`
                }
            );
        });
        try {
            const result = await web.views.open({
                trigger_id: trigger_id,
                view: {
                    type: 'modal',
                    callback_id: VIEW_SUBMISSION_CALLBACK_ID,
                    title: {
                        type: 'plain_text',
                        text: 'First, pick a CF project'
                    },
                    close: {
                        type: "plain_text",
                        text: "Cancel"
                    },
                    blocks: [
                        {
                            type: 'section',
                            block_id: 'cf_project_select',
                            text: {
                                type: 'mrkdwn',
                                text: "Projeccts"
                            },
                            accessory: {
                                action_id: 'cf_repo_select_action',
                                type: 'static_select',
                                placeholder: {
                                    type: 'plain_text',
                                    text: 'Select'
                                },
                                options: textBlockProjects
                            }
                        }
                    ]
                }
            });
            
            console.log(`view id: ${result.view.id}`);
            this.view_id = result.view.id;
        } catch(err) {
            console.log(JSON.stringify(err));
        }
    }
    
    async update_with_repos(payload) {
        const selectedOption = payload.actions[0].selected_option;
        const values = selectedOption.value.split(':');
        const owner = values[0];
        const repo = values[1];
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
        let envOptions = [];
        projects.forEach((proj) => {
            if (proj['repo'] == repo) {
                envOptions = proj.environments;
            }
        });
        await web.views.update({
            view_id: this.view_id,
            view: {
                type: 'modal',
                callback_id: VIEW_SUBMISSION_CALLBACK_ID,
                title: {
                    type: 'plain_text',
                    text: `Codebase: ${selectedOption}`
                },
                close: {
                    type: "plain_text",
                    text: "Cancel"
                },
                blocks: [
                    {
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
                    },
                    {
                        type: 'section',
                        block_id: 'cf_env_select',
                        text: {
                            type: 'mrkdwn',
                            text: `Releases from ${repo}`
                        },
                        accessory: envOptions
                    }
                ]
            }
        });
    }
    
}

module.exports = new cf_modal();
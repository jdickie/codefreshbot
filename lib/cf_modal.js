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
        try {
            console.log(`trigger_id: ${trigger_id}`);
            let textBlockProjects = [];
            projects.forEach((proj) => {
                textBlockProjects.push({
                    text: {
                        type: 'plain_text', 
                        text: proj['cf_name']}, 
                        value: `${proj['cf_name']}:${proj['owner']}:${proj['repo']}`
                    }
                );
            });
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
                                type: 'plain_text',
                                text: "Projects"
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
            console.log(`cf_modal.start() result\n${JSON.stringify(result)}`)
        } catch(err) {
            console.log(JSON.stringify(err));
        }
    }

    getEnvOptions(project) {
        let envOptions = [];
        projects.forEach((proj) => {
            if (proj['cf_name'] == project) {
                envOptions = proj.environments;
            }
        });
        return envOptions;
    }

    async getTagOptions(owner, repo) {
        try {
            const options = octokit.repos.listTags.endpoint.merge({
                owner: owner,
                repo: repo,
                per_page: 5
            });
            const tagOptions = await octokit.paginate(
                options, 
                response => response.data.map((tag) => {
                    return {
                        text: {
                            type: 'plain_text',
                            text: tag.name
                        },
                        value: tag.name
                    };
                })
            );
            return tagOptions;
        } catch(err) {
            console.log(err);
            return null;
        }
    }
    
    async update_with_repos(payload) {
        // Show spinner
        try {

            const view_id = payload.view.id;
            await this.update_spinner(view_id);
            const selectedOption = payload.actions[0].selected_option;
            const values = selectedOption.value.split(':');
            const selectedProject  = values[0];
            const owner = values[1];
            const repo = values[2];
            const tagOptions = await this.getTagOptions(owner, repo);
        
            const result = await web.views.update({
                view_id: view_id,
                view: {
                    type: 'modal',
                    callback_id: VIEW_SUBMISSION_CALLBACK_ID,
                    title: {
                        type: 'plain_text',
                        text: 'Select Release'
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
                                type: 'plain_text',
                                text: `Releases from ${repo}`
                            },
                            accessory: {
                                action_id: 'cf_release_select_action',
                                type: 'static_select',
                                placeholder: {
                                    type: 'plain_text',
                                    text: 'Release...'
                                },
                                options: tagOptions
                            }
                        }
                    ],
                    private_metadata: `${selectedProject}`
                }
            });
        } catch (err) {
            console.log(JSON.stringify(err));
        }
    }

    async update_release_selection(payload) {
        try {
            const view_id = payload.view.id;
            const selectedOption = payload.actions[0].selected_option;
            this.selectedRelease = selectedOption.value;
            const metaParts = payload.view.private_metadata.split(':');
            if (metaParts.length == 1 || metaParts.length == 2) {
                // Get previous block for selected_options
                const envOptions = this.getEnvOptions(metaParts[0]);
                await web.views.update({
                    view_id: view_id,
                    view: {
                        type: 'modal',
                        callback_id: VIEW_SUBMISSION_CALLBACK_ID,
                        title: {
                            type: 'plain_text',
                            text: 'Select Environment'
                        },
                        close: {
                            type: "plain_text",
                            text: "Cancel"
                        },
                        blocks: [
                            {
                                type: 'section',
                                block_id: 'cf_release_selected',
                                text: {
                                    type: 'plain_text',
                                    text: `:thumbsup: ${selectedOption.value}`
                                }
                            },
                            {
                                type: 'section',
                                block_id: 'cf_env_select',
                                text: {
                                    type: 'plain_text',
                                    text: `Environments`
                                },
                                accessory: {
                                    action_id: "cf_env_select_action",
                                    type: 'static_select',
                                    placeholder: {
                                        type: 'plain_text',
                                        text: 'Environment...'
                                    },
                                    options: envOptions
                                }
                            }
                        ],
                        private_metadata: `${metaParts[0]}:${selectedOption.value}`
                    }
                });
            } else {
                await web.views.update({
                    view_id: view_id,
                    view: {
                        type: 'modal',
                        callback_id: VIEW_SUBMISSION_CALLBACK_ID,
                        title: {
                            type: 'plain_text',
                            text: 'Run?'
                        },
                        submit: {
                            type: 'plain_text',
                            text: 'Yep, Run'
                        },
                        close: {
                            type: "plain_text",
                            text: "Cancel"
                        },
                        blocks: [
                            {
                                type: 'section',
                                block_id: 'cf_release_selected',
                                text: {
                                    type: 'plain_text',
                                    text: `Release: ${metaParts[1]}`
                                }
                            },
                            {
                                type: 'section',
                                block_id: 'cf_env_selected',
                                text: {
                                    type: 'plain_text',
                                    text: `Env: ${metaParts[2]}`
                                }
                            }
                        ],
                        private_metadata: `${payload.view.private_metadata}`
                    }
                });
            }
        } catch(err) {
            console.log(JSON.stringify(err));
        }
        
    }

    async update_env_selection(payload) {
        const view_id = payload.view.id;
        const selectedOption = payload.actions[0].selected_option;
        const selectedEnvDisplayName = selectedOption.text.text;
        const metaParts = payload.view.private_metadata.split(':');
        try {
            
            await web.views.update({
                view_id: view_id,
                view: {
                    type: 'modal',
                    callback_id: VIEW_SUBMISSION_CALLBACK_ID,
                    title: {
                        type: 'plain_text',
                        text: 'Run?'
                    },
                    submit: {
                        type: 'plain_text',
                        text: 'Run'
                    },
                    close: {
                        type: "plain_text",
                        text: "Cancel"
                    },
                    blocks: [
                        {
                            type: 'section',
                            block_id: 'cf_release_selected',
                            text: {
                                type: 'plain_text',
                                text: `Release: ${metaParts[1]}`
                            }
                        },
                        {
                            type: 'section',
                            block_id: 'cf_env_selected',
                            text: {
                                type: 'plain_text',
                                text: `Env: ${selectedEnvDisplayName}`
                            }
                        }
                    ],
                    private_metadata: `${metaParts[0]}:${metaParts[1]}:${selectedOption}`
                }
            });
        } catch(err) {
            console.log(JSON.stringify(err));
        }

    }
        
    async update_spinner(view_id) {
        try {
            await web.views.update({
                view_id: view_id,
                view: {
                    type: 'modal',
                    callback_id: VIEW_SUBMISSION_CALLBACK_ID,
                    title: {
                        type: 'plain_text',
                        text: 'Working...'
                    },
                    close: {
                        type: "plain_text",
                        text: "Cancel"
                    },
                    blocks: [
                        {
                            "type": "section",
                            "text": {
                                "type": "plain_text",
                                "text": ":cd-spinning: :cd-spinning:"
                            }
                        }
                    ]
                }
            });
        } catch(err) {
            console.log(JSON.stringify(err));
        }
    }
}

module.exports = new cf_modal();
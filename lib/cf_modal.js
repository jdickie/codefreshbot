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

    async start(trigger_id, channel_id, user_id) {
        this.trigger_id = trigger_id;
        this.channel_id = channel_id;
        this.user_id = user_id;
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
            this.view_id = result.view.id;
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

    getTagOptions(owner, repo) {
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
        this.tagOptions = tagOptions;
    }
    
    async update_with_repos(payload) {
        // Show spinner
        const view_id = payload.view.id;
        await this.update_spinner(view_id);
        const selectedOption = payload.actions[0].selected_option;
        const values = selectedOption.value.split(':');
        this.selectedProject  = values[0];
        const owner = values[1];
        const repo = values[2];
        const tagOptions = this.getTagOptions(owner, repo);
        
        try {
            const result = await web.views.update({
                view_id: view_id,
                view: {
                    type: 'modal',
                    callback_id: VIEW_SUBMISSION_CALLBACK_ID,
                    title: {
                        type: 'plain_text',
                        text: 'Select Release, Env'
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
                                options: this.getEnvOptions()
                            }
                        }
                    ]
                }
            });
        } catch (err) {
            console.log(JSON.stringify(err));
        }
    }

    async update_release_selection(payload) {
        const view_id = payload.view.id;
        const selectedOption = payload.actions[0].selected_option;
        this.selectedRelease = selectedOption.value;
        try {
            if (!this.selectedEnv) {
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
                                    text: 'Environments'
                                },
                                accessory: {
                                    action_id: "cf_env_select_action",
                                    type: 'static_select',
                                    placeholder: {
                                        type: 'plain_text',
                                        text: 'Environment...'
                                    },
                                    options: this.envOptions
                                }
                            }
                        ]
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
                                    text: `Release: ${this.selectedRelease}`
                                }
                            },
                            {
                                type: 'section',
                                block_id: 'cf_env_selected',
                                text: {
                                    type: 'plain_text',
                                    text: `Env: ${this.selectedEnvDisplayName}`
                                }
                            }
                        ]
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
        this.selectedEnv = selectedOption.value;
        this.selectedEnvDisplayName = selectedOption.text.text;
        try {
            if (!this.selectedRelease) {
                await web.views.update({
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
                                    options: this.tagOptions
                                }
                            },
                            {
                                type: 'section',
                                block_id: 'cf_env_selected',
                                text: {
                                    type: 'plain_text',
                                    text: `Env: ${this.selectedEnvDisplayName}`
                                }
                            }
                        ]
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
                                    text: `Release: ${this.selectedRelease}`
                                }
                            },
                            {
                                type: 'section',
                                block_id: 'cf_env_selected',
                                text: {
                                    type: 'plain_text',
                                    text: `Env: ${this.selectedEnvDisplayName}`
                                }
                            }
                        ]
                    }
                });
            }
        } catch(err) {
            console.log(JSON.stringify(err));
        }

    }
        
    async update_spinner() {
        try {
            await web.views.update({
                view_id: this.view_id,
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
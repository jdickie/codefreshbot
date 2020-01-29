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
            
            this.view_id = result.view.id;
        } catch(err) {
            console.log(JSON.stringify(err));
        }
    }
    
    async update_with_repos(payload) {
        const selectedOption = payload.actions[0].selected_option;
        const values = selectedOption.value.split(':');
        this.selectedProject  = values[0];
        const owner = values[1];
        const repo = values[2];
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
            if (proj['cf_name'] == this.selectedProject) {
                envOptions = proj.environments;
            }
        });
        this.envOptions = envOptions;
        this.tagOptions = tagOptions;
        try {
            const result = await web.views.update({
                view_id: this.view_id,
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
                                options: this.tagOptions
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
                                options: this.envOptions
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
        console.log(JSON.stringify(payload));
        const selectedOption = payload.actions[0].selected_option;
        this.selectedRelease = selectedOption.value;
        try {
            if (!this.selectedEnv) {
                await web.views.update({
                    view_id: this.view_id,
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
                                    text: `:thumbsup: ${this.selectedRelease}`
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
                    view_id: this.view_id,
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
                                    text: `Env: ${this.selectedEnv}`
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
        const selectedOption = payload.actions[0].selected_option;
        this.selectedEnv = selectedOption.value;
        try {
            if (!this.selectedRelease) {
                await web.views.update({
                    view_id: this.view_id,
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
                                    text: `Env: ${this.selectedEnv}`
                                }
                            }
                        ]
                    }
                });
            } else {
                await web.views.update({
                    view_id: this.view_id,
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
                                    text: `Env: ${this.selectedEnv}`
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
        
}

module.exports = new cf_modal();
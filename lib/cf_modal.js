const { Octokit } = require('@octokit/rest');
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
            return result;
        } catch(err) {
            console.log(JSON.stringify(err));
        }
    }

    getEnvOptions(project) {
        let envOptions = [];
        projects.forEach((proj) => {
            if (proj['cf_name'] == project) {
                proj.environments.forEach(el => {
                    slackOptions.push({
                        value: `${proj.cf_name}:${proj.cf_owner}:${proj.cf_repo}:${el.triggerName}:${el.releaseType}:${el.matchPattern}`,
                        text: {
                            text: el.display,
                            type: 'plain_text'
                        }
                    });
                });
                envOptions = proj.environments;
            }
        });
        let slackOptions = [];
        envOptions.forEach(el => {
            slackOptions.push({
                value: `${el.triggerName}:${el.releaseType}:${el.matchPattern}`,
                text: {
                    text: el.display,
                    type: 'plain_text'
                }
            });
        });
        return slackOptions;
    }

    async getBranchOptions(owner, repo) {
        try {
            const options = octokit.repos.listTags.endpoint.merge({
                owner: owner,
                repo: repo,
                per_page: 5
            });
            const branchOptions = await octokit.paginate(
                options, 
                response => response.data.map((branch) => {
                    return {
                        text: {
                            type: 'plain_text',
                            text: branch.name
                        },
                        value: branch.name
                    };
                })
            );
            return branchOptions;
        } catch(err) {
            console.log(err);
            return null;
        }
    }

    async getTagOptions(owner, repo, filter) {
        try {
            const options = octokit.repos.listTags.endpoint.merge({
                owner: owner,
                repo: repo,
                per_page: 5
            });
            const tagOptions = await octokit.paginate(
                options, 
                response => response.data.map((tag) => {
                    if (tag.match(filter)) {
                        return {
                            text: {
                                type: 'plain_text',
                                text: tag.name
                            },
                            value: tag.name
                        };
                    }
                    return {};
                })
            );
            return tagOptions;
        } catch(err) {
            console.log(err);
            return null;
        }
    }

    async update_with_env_options(payload) {
        try {
            const view_id = payload.view.id;
            const selectedOption = payload.actions[0].selected_option;
            this.selectedRelease = selectedOption.value;
            
            // Get previous block for selected_options
            const envOptions = this.getEnvOptions(selectedOption);
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
                    private_metadata: `${selectedOption.value}`
                }
            });
        } catch(err) {
            console.log(JSON.stringify(err));
        }
    }

    async update_with_release_options(payload) {
        // Show spinner
        try {
            const view_id = payload.view.id;
            await this.update_spinner(view_id);
            const selectedOption = payload.actions[0].selected_option;
            const values = selectedOption.value.split(':');
            const selectedProject  = values[0];
            const owner = values[1];
            const repo = values[2];
            const releaseType = values[3];
            const optionalFilter = values[4];
            const envName = payload.actions[0].selected_option.text.text;
            let releaseOptions = {};
            switch(releaseType) {
                case 'tag':
                    releaseOptions = this.getTagOptions(owner, repo, optionalFilter);
                    break;
                case 'branch':
                    releaseOptions = this.getBranchOptions(owner, repo);
                    break;
            }        
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
                                options: releaseOptions
                            }
                        }
                    ],
                    private_metadata: `${selectedProject}:${envName}`
                }
            });
        } catch (err) {
            console.log(JSON.stringify(err));
        }
    }

    async update_with_submission(payload) {
        const view_id = payload.view.id;
        const selectedOption = payload.actions[0].selected_option.value;
        const selectedReleaseDisplayName = payload.actions[0].selected_option.text.text;
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
                                text: `Release: ${selectedReleaseDisplayName}`
                            }
                        },
                        {
                            type: 'section',
                            block_id: 'cf_env_selected',
                            text: {
                                type: 'plain_text',
                                text: `Env: ${metaParts[1]}`
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
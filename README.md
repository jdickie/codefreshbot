# codefreshbot
Slackbot for Codefresh

# Configuration
This is a guide to setting up your `config/default.json` file. You'll need this to build the Docker image with correct settings.

## Top-level settings

For the `codefresh` section, see more below.

```json
{
  "port": "3000",
  "slack": {
      "secret": "slack_oauth_secret",
      "signing_secret": "slack_signing_secret",
      "bot": {
          "token": "slack_bot_token"
      }
  },
  "github": {
      "access_token": "valid-github-token-with-read-write-perms",
      "user_agent": "MyBot"
  },
  "codefresh": []
}
```

## Codefresh section

This contains an array of `pipeline` objects.

For a given project in codefresh, fill out a `config/default.json` with:

* cf_name - name of the pipeline (Must include the project e.g. `Project-name/pipeline-name`)
* repo - Repo to pull git tags and branches from
* owner - organization for the repo (Use your username if no org)
* environments - Array of `environment options` - see below for an example
  * matchPattern - Regex that will be used to filter when searching tags or branches
  * releaseType - tag or branch
  * triggerName - name that matches a trigger in the given Codefresh pipeline
  * display - What the user will see in the modal

```json
{
  "codefresh": [
  {
    "cf_name": "www-render/main",
    "repo": "www-render",
    "owner": "npr",
    "environments": [
        {
            "matchPattern": "^[\\d]+\\.[\\d]+\\.[\\d]+$",
            "releaseType": "tag",
            "triggerName": "MyTrigger",
            "display": "MyEnvDisplayname"
        }
    ]
}
```


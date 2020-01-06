const util = require('util');
const exec = util.promisify(require('child_process').exec);
const { Codefresh, Config } = require('codefresh-sdk');
const configjson = require('config');
const express = require('express');

const CODEFRESH_AUTH_TOKEN = configjson.get('codefresh.token');

const app = express();

app.get('/', (req, res) => {
    res.send("hi");
});

async function getCodefreshSDK() {
    return new Codefresh(await Config.load({
        url: 'https://g.codefresh.io',
        apiKey: CODEFRESH_AUTH_TOKEN,
    }));
};

const sdk = getCodefreshSDK();

async function getHelmSetup() {
    let { stdout, stderr } = await exec(`export HELM_REPO_ACCESS_TOKEN="${CODEFRESH_AUTH_TOKEN}" && echo $HELM_REPO_ACCESS_TOKEN && helm repo add mycfrepo cm://h.cfcr.io/kostis-codefresh/default && helm search -l codefresh/cmss | head -n10`);
    console.log(`stdout: ${stdout}`);
    console.log(`stderr: ${stderr}`);
}

app.listen(configjson.get('port'), () => {
    getCodefreshSDK();
});
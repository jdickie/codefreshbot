const aws = require('aws-sdk');
const fs = require('fs');
const PARAM_PATH='/codefreshbot/config';

const ssm = new aws.SSM();
ssm.getParameter({
    Name: PARAM_PATH,
    WithDecryption: true
}, (err, data) => {
    if (err) {
        console.log('Error retrieving SSM data');
        throw err;
    }
    fs.writeFileSync('./config/default.json', data.Parameter.Value);
});
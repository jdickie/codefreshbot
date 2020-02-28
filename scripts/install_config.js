const aws = require('aws-sdk');
const fs = require('fs');
const PARAM_PATH='/codefreshbot/config';

const ssm = new aws.SSM();
const configRawJSON = ssm.getParameter({
    Name: PARAM_PATH,
    WithDecryption: false
}, (err, data) => {
    if (err) {
        console.log('Error retrieving SSM data');
        throw err;
    }
    console.log(data);
    fs.writeFileSync('./config/default.json', data.Parameter.Value);
});
const app = require('./lib/app');
const config = require('config');

app.listen(config.get('port'), async () => {
    console.log(`Online at ${config.get('port')}`);
});
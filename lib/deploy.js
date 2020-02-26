const cf_modal = require('./cf_modal');


exports.handler = async (event, context) => {
    const trigger_id = event.body.trigger_id;
    await cf_modal.start(trigger_id);
    return context;
};
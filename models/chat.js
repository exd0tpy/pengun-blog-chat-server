var mongoose = require('mongoose');

const Schema = mongoose.Schema;

const chatSchema = new Schema({
    message: String,
    room: String,
    from: String,
    published_date: { type: Date, default: Date.now  }
});

module.exports =  mongoose.model('chat', chatSchema);

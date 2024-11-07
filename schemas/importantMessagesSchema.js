const mongoose = require('mongoose');

const importantMessageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
    unique: true
  },
  messageName: {
    type: String,
    required: true
  }
});

const ImportantMessage = mongoose.model('ImportantMessage', importantMessageSchema);

module.exports = ImportantMessage;
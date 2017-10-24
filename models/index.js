var mongoose = require('mongoose');
var connect = process.env.MONGODB_URI

mongoose.connect(connect);

var UserSchema = mongoose.Schema({
  slackName: {
    type: String
  },
  slackId: {
    type: String
  },
  googleProfile: {
    type: Object
  },
  channel: {
    type: String
  }
})

var User = mongoose.model('User', UserSchema);


module.exports = {
  User: User
}

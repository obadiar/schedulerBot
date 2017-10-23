var express = require('express');
var router = express.Router();
var models = require('../models/');
var User = models.User;
var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var apiai = require('apiai');

var app = apiai(process.env.APIAI_TOKEN);
var oauth2Client = new OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3000/callback'
);
// index.js
var Slack = require('@slack/client');
var RtmClient = Slack.RtmClient;
var RTM_EVENTS = Slack.RTM_EVENTS;

var axios = require('axios');

var token = process.env.RTM_TOKEN;

var rtm = new RtmClient(token, { logLevel: 'info' });
rtm.start();


rtm.on(RTM_EVENTS.MESSAGE, function(message) {
  console.log("message", message);
  var channel = message.channel;
  var text = message.text;
  var user = message.user;
  var IM = [
    {
        "callback_id": "tender_button",
        "attachment_type": "default",
        "actions": [
            {
                "name": "press",
                "text": "Press",
                "type": "button",
                "value": "pressed"
            }
        ]
    }
]
  IM = JSON.stringify(IM)
  if(!message.subtype){
    axios({
      url: 'https://slack.com/api/users.info?token=' + token + '&user='+message.user,
      method: 'get'
    }).then( x => {
      // console.log(channel);
      // rtm.sendMessage(x.data.user.profile.display_name, channel)
      //check user
      User.findOne({slackId: message.user}, function(err, user) {
        if(user) {
          if(user.googleProfile) {
            //send request to API.AI
            //check token first
            var now = new Date();
            var expiryDate = new Date(user.googleProfile.expiry_date);
            if(expiryDate < now) {
              //refresh token
              oauth2Client.refreshAccessToken(function(err, tokens) {
                // your access_token is now refreshed and stored in oauth2Client
                // store these new tokens in a safe place (e.g. database)
                user.googleProfile = tokens;
                user.save();
              });
            }
            console.log("expiryDate", expiryDate);
            var request = app.textRequest(text, {
              sessionId: user.googleProfile.access_token.slice(0,15)
            });

            request.on('error', function(error) {
                console.log("error", error);
            });

            request.end();
          } else{
            //send message back to user wth url to authorise Google Calendar
            if(process.env.NODE_ENV === 'production') {
              axios({
                url: 'https://slack.com/api/chat.postMessage?token=' + token + '&channel='+channel+'&text=Hey '+x.data.user.profile.display_name +"! This is Maddy and I'm here to help you schedule. Join this link to connect your calendars. https://enigmatic-temple-70986.herokuapp.com/connect?auth_id=" + user._id + "&attachments="+IM,
                method: "get"
              })
            } else{
              axios({
                url: 'https://slack.com/api/chat.postMessage?token=' + token + '&channel='+channel+'&text=Hey '+x.data.user.profile.display_name +"! This is Maddy and I'm here to help you schedule. Join this link to connect your calendars. http://localhost:3000/connect?auth_id=" + user._id + "&attachments="+IM,
                method: "get"
              })
            }

          }
        } else{
          //create user if they don't exist
          User.create({
            slackId: message.user,
            slackName: x.data.user.profile.display_name
          }, function(err, user) {
            //ask them to authorise Google Calendar
            //send message back to user wth url to authorise Google Calendar
            if(process.env.NODE_ENV === 'production') {
              axios({
                url: 'https://slack.com/api/chat.postMessage?token=' + token + '&channel='+channel+'&text=Hey '+x.data.user.profile.display_name +"! This is Maddy and I'm here to help you schedule. Join this link to connect your calendars. https://enigmatic-temple-70986.herokuapp.com/connect?auth_id=" + user._id + "&attachments="+IM,
                method: "get"
              })
            } else{
              axios({
                url: 'https://slack.com/api/chat.postMessage?token=' + token + '&channel='+channel+'&text=Hey '+x.data.user.profile.display_name +"! This is Maddy and I'm here to help you schedule. Join this link to connect your calendars. http://localhost:3000/connect?auth_id=" + user._id + "&attachments="+IM,
                method: "get"
              })
            }
          })
        }
      })
      console.log(token);

    })
  }


});
// generate a url that asks permissions for Google+ and Google Calendar scopes
var scopes = [
  'https://www.googleapis.com/auth/plus.me',
  'https://www.googleapis.com/auth/calendar'
];
/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});


router.get('/connect', function(req, res, next) {
  var userId = req.query.auth_id;
  console.log("what", userId);
  var url = oauth2Client.generateAuthUrl({
  // 'online' (default) or 'offline' (gets refresh_token)
  access_type: 'offline',

  // If you only need one scope you can pass it as a string
  scope: scopes,

  // Optional property that passes state parameters to redirect URI
  state: userId
});
console.log("url", url);
res.redirect(url);

})
router.post('/webhook', function(req, res, next) {
  console.log("APIAI response", response);
  var todoItem = response.parameters["thing-to-do"];
  var time = response.parameters["time"];
})
router.get('/callback', function(req, res, next) {
  console.log("query", req.query);
  var code = req.query.code;
  var auth_id = req.query.state;
  console.log("CODE", code, auth_id);
  oauth2Client.getToken(code, function(err, tokens) {
    console.log("tokens", tokens);
    if(!err) {
      oauth2Client.setCredentials(tokens);
      User.findByIdAndUpdate(auth_id, {googleProfile: tokens}, function(err, user) {
        console.log("USER", user);
        res.render('index');
      })
    } else{
      console.log("WHAT", err);
    }
  })
})
module.exports = router;

var express = require('express');
var router = express.Router();
var models = require('../models/');
var User = models.User;
var Task = models.Task;
var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var apiai = require('apiai');

var app = apiai(process.env.APIAI_TOKEN);
var oauth2Client = new OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://a5bb9b3d.ngrok.io/callback'
);
var calendar = google.calendar('v3');
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
              var oauth2Client = new OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET,
                'http://a5bb9b3d.ngrok.io/callback'
              );
              oauth2Client.refreshAccessToken(function(err, tokens) {
                // your access_token is now refreshed and stored in oauth2Client
                // store these new tokens in a safe place (e.g. database)
                console.log("TOKENS", tokens);
                user.googleProfile = tokens;
                user.save(function(err, user) {
                  console.log("USER", user);
                  var request = app.textRequest(text, {
                    sessionId: user.googleProfile.access_token.slice(0,15)
                  });

                  request.on('response', function(response) {
                    sendInteractiveMessage(token,channel, response);
                  });
                  request.on('error', function(error) {
                      console.log("error", error);
                  });

                  request.end();
                });
              });
            } else{
              var request = app.textRequest(text, {
                sessionId: user.googleProfile.access_token.slice(0,15)
              });

              request.on('response', function(response) {
                sendInteractiveMessage(token, channel, response);
              });
              request.on('error', function(error) {
                  console.log("error", error);
              });

              request.end();
            }

          } else{
            //send message back to user wth url to authorise Google Calendar
            if(process.env.NODE_ENV === 'production') {
              axios({
                url: 'https://slack.com/api/chat.postMessage?token=' + token + '&channel='+channel+'&text=Hey '+x.data.user.profile.display_name +"! This is Maddy and I'm here to help you schedule. Join this link to connect your calendars. https://enigmatic-temple-70986.herokuapp.com/connect?auth_id=" + user._id + "&attachments="+IM,
                method: "get"
              })
            } else{
              axios({
                url: 'https://slack.com/api/chat.postMessage?token=' + token + '&channel='+channel+'&text=Hey '+x.data.user.profile.display_name +"! This is Maddy and I'm here to help you schedule. Join this link to connect your calendars. http://a5bb9b3d.ngrok.io/connect?auth_id=" + user._id + "&attachments="+IM,
                method: "get"
              })
            }

          }
        } else{
          //create user if they don't exist

          User.create({
            slackId: message.user,
            slackName: x.data.user.name,
            channel: message.channel
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
                url: 'https://slack.com/api/chat.postMessage?token=' + token + '&channel='+channel+'&text=Hey '+x.data.user.profile.display_name +"! This is Maddy and I'm here to help you schedule. Join this link to connect your calendars. http://a5bb9b3d.ngrok.io/connect?auth_id=" + user._id + "&attachments="+IM,
                method: "get"
              })
            }
          })
        }
      })

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
  var url = oauth2Client.generateAuthUrl({
  // 'online' (default) or 'offline' (gets refresh_token)
  access_type: 'offline',

  // If you only need one scope you can pass it as a string
  scope: scopes,

  // Optional property that passes state parameters to redirect URI
  state: userId
});
res.redirect(url);

})

function sendInteractiveMessage(token, channel, response) {
  if(!response.result.actionIncomplete) {
    if(response.result.parameters["subject"] && response.result.parameters["date"]) {
      var todoItem = response.result.parameters["subject"];
      var time = response.result.parameters["date"];
      var IM = [
         {
             "text": "Create task to " + todoItem + ' on ' + time + '?',
             "fallback": "You are unable to choose a value.",
             "callback_id": "event_choice",
             "color": "#3AA3E3 ",
             "attachment_type": "default",
             "title": todoItem,
             "author_name": time,
             "actions": [
                 {
                     "name": "yes_no",
                     "type": "button",
                     "value": "yes",
                     "text" : "yes",
                 },
                 {
                   "name": "yes_no",
                   "type": "button",
                   "value": "no",
                   "text" : "no",
                 }
             ]
         }
       ]
       IM = JSON.stringify(IM)
       axios({
         url: 'https://slack.com/api/chat.postMessage?token=' + token + '&channel='+channel+'&text='+'Maddy' + '&attachments='+encodeURIComponent(IM),
         method: "get"
        })
    }

  } else{

    axios({
      url: 'https://slack.com/api/chat.postMessage?token=' + token + '&channel='+channel+'&text='+response.result.fulfillment.speech,
      method: "get"
    });
  }
}
function createGoogleCalendar(tokens, title, date) {
  var oauth2Client = new OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://a5bb9b3d.ngrok.io/createCalendar/callback'
  );
  oauth2Client.setCredentials(tokens);
  console.log("tokens", date);
  return new Promise(function(resolve, reject) {
    calendar.events.insert({
      auth: oauth2Client,
      calendarId: 'primary',
      resource: {
        summary: title,
        start: {
          'dateTime': date,
          'timeZone': 'America/Los_Angeles'
        },
        end: {
          'dateTime': date,
          'timeZone': 'America/Los_Angeles'
        }
      }

    }, function(err, res) {
      if(err) {
        console.log("ERR", err);
        reject(err);
      } else{
        console.log("RES", res);
        resolve(tokens);
      }
    })
  })
}

router.post('/IMCallback', function(req, res){
  console.log(JSON.parse(req.body.payload).original_message.attachments);
  var yes_no = JSON.parse(req.body.payload).actions.filter( x => x.name === "yes_no")[0].value;
  var scheduleItem = JSON.parse(req.body.payload).original_message.attachments[0].title;
  var scheduleTime = JSON.parse(req.body.payload).original_message.attachments[0].author_name;
  scheduleTime = new Date(scheduleTime);
  console.log("scheduleTime", scheduleTime);
  var userId = JSON.parse(req.body.payload).user.id;

  if(yes_no === 'yes') {
    User.findOne({slackId: userId}, function(err, user) {
      Task.create({userSlackId: userId, subject: scheduleItem, date: scheduleTime}, function(err, task) {
        createGoogleCalendar(user.googleProfile, scheduleItem, scheduleTime);
      });

    });
    res.send("Event created on your Google Calendar :)");
  } else{
    res.send("Cancelled");
  }

});

router.get('/callback', function(req, res, next) {
  var code = req.query.code;
  var auth_id = req.query.state;
  oauth2Client.getToken(code, function(err, tokens) {
    if(!err) {
      oauth2Client.setCredentials(tokens);
      User.findByIdAndUpdate(auth_id, {googleProfile: tokens}, function(err, user) {
        console.log("USER", user);
        res.render('index');
      })
    } else{
      console.log("Error", err);
    }
  })
})
module.exports = router;

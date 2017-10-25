var express = require('express');
var router = express.Router();
var models = require('../models/');
var User = models.User;
var Task = models.Task;
var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var apiai = require('apiai');
var async = require('async');
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
              oauth2Client.setCredentials({
                  refresh_token: user.googleProfile.refresh_token
              });
              oauth2Client.refreshAccessToken(function(err, tokens) {
                // your access_token is now refreshed and stored in oauth2Client
                // store these new tokens in a safe place (e.g. database)
                user.googleProfile = tokens;
                user.save(function(err, user) {
                  var request = app.textRequest(text, {
                    sessionId: user.googleProfile.access_token.slice(0,15)
                  });

                  request.on('response', function(response) {
                    sendInteractiveMessage(token,channel, response, tokens);
                  });
                  request.on('error', function(error) {
                      console.log("error", error);
                  });

                  request.end();
                });
              });
            } else {
              if(text.indexOf('<@') > -1) {
                var usernames = text.match(/<@[0-9A-Z]*>/g);
                usernames = usernames.map(x => {
                  var name = x.match(/[0-9A-Z]*/g).filter(x =>  (x !== ''));
                  return name[0];
                });


                axios({
                  url: 'https://slack.com/api/users.list?token=' + token,
                  method: 'get'
                })
                .then(function(response) {

                  var members = response.data.members
                  for(var i =0; i < members.length;i++) {
                    if(usernames.indexOf(members[i].id) > -1) {
                      //replace sentence with names
                      text = text.replace('<@' + members[i].id + '>', members[i].profile.real_name);
                    }
                  }

                  var request = app.textRequest(text, {
                    sessionId: user.googleProfile.access_token.slice(0,15)
                  });

                  request.on('response', function(response) {
                    sendInteractiveMessage(token, channel, response, user.googleProfile);
                  });
                  request.on('error', function(error) {
                      console.log("error", error);
                  });

                  request.end();
                })
              } else {
                var request = app.textRequest(text, {
                  sessionId: user.googleProfile.access_token.slice(0,15)
                });

                request.on('response', function(response) {
                  sendInteractiveMessage(token, channel, response, user.googleProfile);
                });
                request.on('error', function(error) {
                    console.log("error", error);
                });

                request.end();
              }

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
  approval_prompt: "force",
  // Optional property that passes state parameters to redirect URI
  state: userId
});
res.redirect(url);

})

function sendInteractiveMessage(token, channel, response, tokens) {
  if(!response.result.actionIncomplete) {

    if(response.result.parameters["invitees"] && response.result.parameters["date-time"]) {
        var oauth2Client = new OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          'http://a5bb9b3d.ngrok.io/createCalendar/callback'
        );
        oauth2Client.setCredentials(tokens);

        var dateTime = response.result.parameters['date-time'];
        var invitees = response.result.parameters['invitees'];
        var subject = response.result.parameters['subject'];
        var date = dateTime.split('T')[0];


        dateTime = new Date(dateTime);
        var time = dateTime.getHours() + 7;

        dateTime.setHours(dateTime.getHours() + 7);

        var endDate = new Date(dateTime);

        endDate.setMinutes(endDate.getMinutes() + 30);
        calendar.events.list({
          auth: oauth2Client,
          calendarId: 'primary',
          timeMin: dateTime.toISOString(),
          timeMax: endDate.toISOString()
        }, function(err, response) {
          if(response.items.length === 0) {
            var IM = [
               {
                   "text": "Create meeting to discuss " + subject + ' with ' + invitees.join(', ')+' on ' + date + ' at ' + time+ '.00?',
                   "fallback": "You are unable to choose a value.",
                   "callback_id": "event_choice",
                   "color": "#3AA3E3 ",
                   "attachment_type": "default",
                   "title": subject,
                   "author_name": dateTime,
                   "pretext": JSON.stringify({invitees}),
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
          } else{
            var IM = [
                      {
                          "fallback": "Upgrade your Slack client to use messages like these.",
                          "color": "3AA3E3",
                          "attachment_type": "default",
                          "callback_id": JSON.stringify({subject, invitees}),
                          "actions": [
                              {
                                  "name": dateTime,
                                  "value": "another test",
                                  "text": "Which alternate time works for you?",
                                  "type": "select",
                                  "data_source": "external"
                              },
                          ]
                      }
                  ];
                  IM = JSON.stringify(IM)
                  axios({
                    url: 'https://slack.com/api/chat.postMessage?token=' + token + '&channel='+channel+'&text='+'Maddy' + '&attachments='+encodeURIComponent(IM),
                    method: "get"
                })
          }
        })


    }
    if(response.result.parameters["subject"] && response.result.parameters["date"]) {
      var todoItem = response.result.parameters["subject"];
      var time = response.result.parameters["date"];
      var date = new Date(time);
      date = date.setHours(date.getHours() + 7);
      var finalDate = new Date(date);
      var endDate = new Date(date);
      endDate.setMinutes(endDate.getMinutes() + 10);

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
function createGoogleCalendar(tokens, title, date, attendees) {
  var oauth2Client = new OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://a5bb9b3d.ngrok.io/createCalendar/callback'
  );
  oauth2Client.setCredentials(tokens);
  date = date.setHours(date.getHours() + 7);
  var endDate = new Date(date);
  endDate.setMinutes(endDate.getMinutes() + 30);
  date = new Date(date);
  var events = {
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
  if(attendees) {
    events = {
              summary: title,
              start: {
                'dateTime': date,
                'timeZone': 'America/Los_Angeles'
              },
              end: {
                'dateTime': endDate,
                'timeZone': 'America/Los_Angeles'
              },
              'attendees': attendees

            }

  }
  return new Promise(function(resolve, reject) {
    calendar.events.insert({
      auth: oauth2Client,
      calendarId: 'primary',
      sendNotifications: true,
      resource: events

    }, function(err, res) {
      if(err) {
        console.log("ERR creating", err);
        reject(err);
      } else{
        console.log("RES", res);
        resolve(tokens);
      }
    })
  })
}

//get datar



router.post('/IMCallback', function(req, res){

  if(JSON.parse(req.body.payload).actions[0]["name"] ==="yes_no"){
    var yes_no = JSON.parse(req.body.payload).actions.filter( x => x.name === "yes_no")[0].value;
    var scheduleItem = JSON.parse(req.body.payload).original_message.attachments[0].title;
    var scheduleTime = JSON.parse(req.body.payload).original_message.attachments[0].author_name;
    var invitees;
    scheduleTime = new Date(scheduleTime);
    var userId = JSON.parse(req.body.payload).user.id;
    if(JSON.parse(req.body.payload).original_message.attachments[0].pretext){
      invitees = JSON.parse(JSON.parse(req.body.payload).original_message.attachments[0].pretext).invitees;
      axios({
        url: 'https://slack.com/api/users.list?token=' + token,
        method: 'get'
      })
      .then(function(response) {
        var members = response.data.members;
        var emailArr = [];
        var usernameArr = [userId];
        for(var i =0; i < members.length;i++) {
          if(invitees.indexOf(members[i].profile.real_name) > -1) {
            //check
            emailArr.push({email : members[i].profile.email});
            usernameArr.push(members[i].id);
          }
        }
        if(yes_no === 'yes') {
          async.each(usernameArr, function(id, callback) {
            User.findOne({slackId: id}, function(err, user) {
              Task.create({userSlackId: user.slackId, subject: scheduleItem, date: scheduleTime}, function(err, task) {

                if(id === userId) {
                  createGoogleCalendar(user.googleProfile, scheduleItem, scheduleTime, emailArr);
                }
                callback();
              });

            });
          })
          res.send("Event created on your Google Calendar and invited your friends :)");
        } else{
          res.send("Cancelled");
        }
      });
    } else {

      if(yes_no === 'yes') {
        User.findOne({slackId: userId}, function(err, user) {
          Task.create({userSlackId: userId, subject: scheduleItem, date: scheduleTime}, function(err, task) {
            createGoogleCalendar(user.googleProfile, scheduleItem, scheduleTime, null);
          });

        });
        res.send("Event created on your Google Calendar :)");
      } else{
        res.send("Cancelled");
      }
    }
  } else {
    const {subject, invitees} = JSON.parse(JSON.parse(req.body.payload).callback_id);
    const channel = JSON.parse(req.body.payload).channel.id;
    const date = JSON.parse(req.body.payload).actions[0].selected_options[0].value.split("T")[0];
    var  dateTime = new Date(JSON.parse(req.body.payload).actions[0].selected_options[0].value);
    var time = dateTime.getHours() + 7;
    var IM = [
       {
           "text": "Create meeting to discuss " + subject + ' with ' + invitees.join(', ')+' on ' + date + ' at ' + time+ '.00?',
           "fallback": "You are unable to choose a value.",
           "callback_id": "event_choice",
           "color": "#3AA3E3 ",
           "attachment_type": "default",
           "title": subject,
           "author_name": dateTime,
           "pretext": JSON.stringify({invitees}),
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
     IM = JSON.stringify(IM);
     axios({
       url: 'https://slack.com/api/chat.postMessage?token=' + token + '&channel='+channel+'&text='+'Maddy' + '&attachments='+encodeURIComponent(IM),
       method: "get"
     });
     res.status(200);
  }

});

router.post('/getData', function(req, res) {
  var oauth2Client = new OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://a5bb9b3d.ngrok.io/createCalendar/callback'
  );
  console.log("req", req.body);
  var payload = JSON.parse(req.body.payload);
  User.findOne({slackId: payload.user.id}, function(err, user) {
    if(err) {
      console.log("Err", err);

    }
    oauth2Client.setCredentials(user.googleProfile);
    var date = new Date(payload.name);

    // date.setHours(date.getHours());
    var startDate = new Date(date);
    console.log("REQ", req.body);
    var endDate = new Date(payload.name);
    endDate.setDate(endDate.getDate() + 7);
    calendar.events.list({
      auth: oauth2Client,
      calendarId: 'primary',
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString()
    }, function(err, response) {
      var start = new Date(payload.name);
      var possibleDates = [new Date(payload.name)];
      for (var i = 0; i < 8; i ++){
        possibleDates.push(start.setDate(start.getDate() + 1))
      }

      possibleDates = possibleDates.filter( x => {
                                    var day = new Date(x).getDay();
                                    return day !== 6 && day
                                  }).map( x => new Date(x))

      var possibleTimeSlots = [];

      for (var i = 9; i < 17; i ++){
        possibleTimeSlots.push({hours: i, minutes: 0})
        possibleTimeSlots.push({hours: i, minutes: 30})
      }

      var allSlots = [];

      possibleDates.forEach( (day, index) => {
        var newDateObj = {};
        newDateObj["dateArr"] = [];
        possibleTimeSlots.forEach( time => {
          var newDate = new Date(day);
          newDate.setHours(time.hours-7);
          newDate.setMinutes(time.minutes);
          newDate.setSeconds(0);
          newDateObj["dateArr"].push(newDate);
        });
        allSlots.push(newDateObj);
      });
      for(var i = 0; i < allSlots.length; i++) {
        allSlots[i]["dateArr"] = allSlots[i]["dateArr"].filter((slot) => {
          var boolean = true;
          response.items.forEach((item) => {
            var d = new Date(slot);
            var UTCconverted = d.getUTCFullYear() + '-' + z(d.getUTCMonth() + 1) + '-' +
            z(d.getUTCDate()) + 'T' + z(d.getUTCHours()) + ':' +
            z(d.getUTCMinutes()) + ':' + z(d.getUTCSeconds()) + '-07:00';

            if(UTCconverted === item.start.dateTime) {
              boolean= false;
            }
          });
          return boolean;
        })
      }
      var bestSlots = [];
      for(var i = 0; i < allSlots.length; i++) {
        var bestThree = [];
        var start = new Date(payload.name);
        start.setDate(start.getDate() + i);
        start.setHours(start.getHours() - 7);

        start = new Date(start);
        for(var j = 0; j < allSlots[i]["dateArr"].length; j++) {
          if(bestThree.length < 3) {
            const slotDate = new Date(allSlots[i]["dateArr"][j]);
            const diffMs = Math.abs(slotDate - start);
            bestThree.push({date: allSlots[i]["dateArr"][j], diff: diffMs});
          } else{
            //compare date
            const slotDate = new Date(allSlots[i]["dateArr"][j]);

            const diffMs = Math.abs(slotDate - start);
            for(var k = 0; k < bestThree.length; k++) {
              if(diffMs < bestThree[k].diff) {
                bestThree[k] = {date: slotDate, diff: diffMs};
                break;
              }
            }
          }
        }
        bestSlots.push(bestThree);
      }
      var finalBestSlots = [];
      for(var i =0; i < bestSlots.length; i++) {
        for(var j = 0; j < bestSlots[i].length; j++) {
          finalBestSlots.push({
            text: bestSlots[i][j].date,
            value: bestSlots[i][j].date
          })
        }
      }
      res.send({
        options: finalBestSlots
      })
     })
  })


})



router.get('/callback', function(req, res, next) {
  var code = req.query.code;
  var auth_id = req.query.state;

  oauth2Client.getToken(code, function(err, tokens) {
    if(!err) {
      User.findByIdAndUpdate(auth_id, {googleProfile: tokens}, function(err, user) {
        oauth2Client.setCredentials(tokens);
        res.render('index');
      })
    } else{
      console.log("Error", err);
    }
  })
})
function z(n){return (n < 10? '0' : '') + n;};
module.exports = router;

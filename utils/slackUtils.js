var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var axios = require('axios');
var google = require('googleapis');
var oauth2Client = new OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://a5bb9b3d.ngrok.io/callback'
);
var calendar = google.calendar('v3');
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
        var time = dateTime.getHours() + 8;
        dateTime.setHours(dateTime.getHours() + 8);

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
                   "callback_id": JSON.stringify({invitees}),
                   "color": "#3AA3E3 ",
                   "attachment_type": "default",
                   "title": subject,
                   "author_name": dateTime,
                   "value": JSON.stringify({invitees}),
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
                    url: 'https://slack.com/api/chat.postMessage?token=' + token + '&channel='+channel+'&text='+'Maddy says you have a time conflict' + '&attachments='+encodeURIComponent(IM),
                    method: "get"
                })
          }
        })


    }
    if(response.result.parameters["subject"] && response.result.parameters["date"]) {
      var todoItem = response.result.parameters["subject"];
      var time = response.result.parameters["date"];
      var date = new Date(time);
      date = date.setHours(date.getHours() + 8);
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

module.exports = {sendInteractiveMessage};

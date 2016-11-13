var APP_ID = undefined; 

var https = require('https');

var AlexaSkill = require('./AlexaSkill');

var urlPrefix = 'https://api.sandbox.amadeus.com/v1.2/flights/extensive-search?apikey=PTTRsLMSBQTZJ8bhktAPyAIIzTRiZYOd&origin=OAK&departure_date=2016-11-13--2016-11-20&one-way=true&max_price=500&destination=';

var paginationSize = 3;

//var delimiterSize = 2;

var FlightFinderSkill = function() {
    AlexaSkill.call(this, APP_ID);
};

FlightFinderSkill.prototype = Object.create(AlexaSkill.prototype);
FlightFinderSkill.prototype.constructor = FlightFinderSkill;

FlightFinderSkill.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    console.log("FlightFinderSkill onSessionStarted requestId: " + sessionStartedRequest.requestId
        + ", sessionId: " + session.sessionId);

    // any session init logic would go here
};

FlightFinderSkill.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    console.log("FlightFinderSkill onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
    getWelcomeResponse(response);
};

FlightFinderSkill.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    console.log("onSessionEnded requestId: " + sessionEndedRequest.requestId
        + ", sessionId: " + session.sessionId);

    // any session cleanup logic would go here
};

FlightFinderSkill.prototype.intentHandlers = {

    "GetFirstFlightIntent": function (intent, session, response) {
        handleFirstFlightRequest(intent, session, response);
    },

    "GetNextFlightIntent": function (intent, session, response) {
        handleNextFlightRequest(intent, session, response);
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
        var speechText = "With Flight Finder, you can get list of flights to a particular destination from your current Oakland airport." +
            "For example, you could say SFO, or NYC, or you can say exit. Now, which destination do you want to travel to?";
        var repromptText = "Which destination do you want to travel to?";
        var speechOutput = {
            speech: speechText,
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        var repromptOutput = {
            speech: repromptText,
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.ask(speechOutput, repromptOutput);
    },

    "AMAZON.StopIntent": function (intent, session, response) {
        var speechOutput = {
                speech: "Goodbye. Thanks for using our service through Amadeus API",
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.tell(speechOutput);
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
        var speechOutput = {
                speech: "Goodbye. Thanks for using our service through Amadeus API",
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.tell(speechOutput);
    }
};

/**
 * Function to handle the onLaunch skill behavior
 */

function getWelcomeResponse(response) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    var cardTitle = "List of Flights";
    var repromptText = "With Flight Finder, you can get list of flights to a particular destination.";
    var speechText = "<p>Flight Finder.</p> <p>What destination do you want to travel to?</p>";
    var cardOutput = "Flight Finder. What destination do you want to travel to?";
    // If the user either does not reply to the welcome message or says something that is not
    // understood, they will be prompted again with this text.

    var speechOutput = {
        speech: "<speak>" + speechText + "</speak>",
        type: AlexaSkill.speechOutputType.SSML
    };
    var repromptOutput = {
        speech: repromptText,
        type: AlexaSkill.speechOutputType.PLAIN_TEXT
    };
    response.askWithCard(speechOutput, repromptOutput, cardTitle, cardOutput);
}

/**
 * Gets a poster prepares the speech to reply to the user.
 */
function handleFirstFlightRequest(intent, session, response) {
    var destinationSlot = intent.slots.destination;
    var repromptText = "With Flight Finder, you can get flights for a particular destination. For example, you could say City code as NYC, or SAN. Now, which destination do you want?";


    var sessionAttributes = {};
    // Read the first 3 flights, then set the count to 3
    sessionAttributes.index = paginationSize;
    var destination = "";

    if (destinationSlot && destinationSlot.value) {
        destination = destinationSlot.value;
    } else {
        destination = "SFO";
    }

    var prefixContent = "<p>List of flights from OAK to " + destination + ", </p>";
    var cardContent = "List of flights from OAK to " + destination + "- ";

    var cardTitle = "Flights from OAK to " + destination;

    getJsonFlightsFromAmadeus(destination, function (events) {
        var speechText = "",
            i;
        sessionAttributes.text = events;
        session.attributes = sessionAttributes;
        if (events.length == 0) {
            speechText = "There is a problem connecting to Amadeus API at this time. Please try again later.";
            cardContent = speechText;
            response.tell(speechText);
        } else {
            for (i = 0; i < paginationSize; i++) {
                cardContent = cardContent + events[i] + " ";
                speechText = "<p>" + speechText + events[i] + "</p> ";
            }
            speechText = speechText + "<p>Wanna know about other flight options?</p>";
            var speechOutput = {
                speech: "<speak>" + prefixContent + speechText + "</speak>",
                type: AlexaSkill.speechOutputType.SSML
            };
            var repromptOutput = {
                speech: repromptText,
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
            };
            response.askWithCard(speechOutput, repromptOutput, cardTitle, cardContent);
        }
    });
}

/**
 * Gets a poster prepares the speech to reply to the user.
 */
function handleNextFlightRequest(intent, session, response) {
    var cardTitle = "More flights to this destination from OAK",
        sessionAttributes = session.attributes,
        result = sessionAttributes.text,
        speechText = "",
        cardContent = "",
        repromptText = "Do you want to know more flights to that destination?",
        i;
    if (!result) {
        speechText = "With Flight Finder, you can get list of flights to a particular destination. For example, you could say NYC, or SFO. Now, which destination do you want?";
        cardContent = speechText;
    } else if (sessionAttributes.index >= result.length) {
        speechText = "There are no more flights to that destination. Try another destination by saying <break time = \"0.3s\"/> get flights for NYC.";
        cardContent = "There are no more flights to this destination. Try another destination by saying, get flights to SFO.";
    } else {
        for (i = 0; i < paginationSize; i++) {
            if (sessionAttributes.index>= result.length) {
                break;
            }
            speechText = speechText + "<p>" + result[sessionAttributes.index] + "</p> ";
            cardContent = cardContent + result[sessionAttributes.index] + " ";
            sessionAttributes.index++;
        }
        if (sessionAttributes.index < result.length) {
            speechText = speechText + " Wanna know about other flight options?";
            cardContent = cardContent + " Wanna know about other flight options?";
        }
    }
    var speechOutput = {
        speech: "<speak>" + speechText + "</speak>",
        type: AlexaSkill.speechOutputType.SSML
    };
    var repromptOutput = {
        speech: repromptText,
        type: AlexaSkill.speechOutputType.PLAIN_TEXT
    };
    response.askWithCard(speechOutput, repromptOutput, cardTitle, cardContent);
}

function getJsonFlightsFromAmadeus(destination, eventCallback) {
    var url = urlPrefix + destination;

    https.get(url, function(res) {
        var body = '';

        res.on('data', function (chunk) {
            body += chunk;
        });

        res.on('end', function () {
            var stringResult = parseJson(body);
            eventCallback(stringResult);
        });
    }).on('error', function (e) {
        console.log("Got error: ", e);
    });
}

function parseJson(inputText) {
	
	var arr = JSON.parse(inputText);
	var out = "";
    var i;
    var retArr = [];
    for(i = 0; i < arr.results.length; i++) {
        //out += arr["results"][i].name; // logic
        //retArr.push(arr["results"][i].name);
        out = "On "+ arr["results"][i].departure_date + " you have a flight by "+ arr["results"][i].airline  + " airlines for " + arr["results"][i].price + " dollars. <break time = \"0.3s\"/> ";
		retArr.push(out);
    }
	return retArr;
}
	
// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    // Create an instance of the HistoryBuff Skill.
    var skill = new FlightFinderSkill();
    skill.execute(event, context);
};

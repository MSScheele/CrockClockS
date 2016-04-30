var HTTP = require('http');
var URL = require('url');
var ParticleConnection = require('./ParticleConnection');
var EventManager = require('./EventManager');

var connection = new ParticleConnection();
var eventManager = new EventManager(connection);

connection.whenOnline().then(function() {
    eventManager.start();
});

var routing = {
    'login': function() {connection.handleLogin.apply(connection, arguments);},
    'queueEvent': function() {eventManager.queueEvent.apply(eventManager, arguments);}
};

function handleRequest(request, response) {
    var method = request.method;
    if (method === 'OPTIONS') {
        console.log(method.headers); //TODO: CORS header responses? Yes...
    } else {
        response.setHeader('Access-Control-Allow-Origin', '*');
        var parsedUrl = URL.parse(request.url);
        var path = parsedUrl.path.substring(1); //Chop off leading slash
        routeRequest(path, request, response);
    }
}

function routeRequest(path, request, response) {
    if (routing[path]) {
        routing[path](request, response);
    } else {
        response.writeHead('404');
        response.end(); //Redundant? Is this part of writeHead?
    }
}

var server = HTTP.createServer(handleRequest);
server.listen('8080');
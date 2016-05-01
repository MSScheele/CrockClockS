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
    'queueEvent': function() {eventManager.queueEvent.apply(eventManager, arguments);},
    'devices': function() {connection.listAvailableDevices.apply(connection, arguments);}
};

function handleRequest(request, response) {
    var method = request.method;
    if (method === 'OPTIONS') {
        response.setHeader('Access-Control-Allow-Origin', request.headers['origin']);
        response.setHeader('Access-Control-Allow-Headers', request.headers['access-control-request-headers']);
        response.setHeader('Access-Control-Allow-Method', request.headers['access-control-request-method']);
        response.writeHead('200');
        response.end();
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
        response.end();
    }
}

var server = HTTP.createServer(handleRequest);
server.listen('8080');
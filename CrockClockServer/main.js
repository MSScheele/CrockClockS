new function (HTTP, URL, ParticleConnection, EventManager) {

    var connection = new ParticleConnection();
    var eventManager = new EventManager(connection);

    var routing = {
        'login': connection.handleLogin,
        'queueEvent': eventManager.queueEvent
    };

    function handleRequest(request, response) {
        var method = request.method;
        if (method === 'OPTIONS') {
            console.log(method.headers); //TODO: CORS header responses?
        } else {
            var parsedUrl = URL.parse(request.url);
            var path = parsedUrl.path;
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
}(require('http'),
        require('url'),
        require('ParticleConnection'),
        require('EventManager'));
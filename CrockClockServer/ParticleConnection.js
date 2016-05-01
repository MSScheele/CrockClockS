var Particle = require('particle-api-js');
var StreamEater = require('./StreamEater');

ParticleConnection.SCHEDULE_FUNC = 'regEvent';
ParticleConnection.RESPONSE_EVENT = 'ccs-complete';
ParticleConnection.ONLINE_EVENT = 'ccs-online';
ParticleConnection.KEEP_ALIVE = 'keepAlive';

function ParticleConnection() {
    var self = this;

    this.token = null;
    this.particle = new Particle();
    this._onlinePromise = new Promise(function (resolve) {
        self._resolveOnlinePromise = function () {
            resolve();
        };
    });
}

/**
 * Handler to connect to the Particle cloud. Rejects methods other than POST.
 * Other methods of this class will fail until a successful login occurs
 * 
 * @param {IncomingMessage} request
 * @param {ServerResponse} response
 * @returns {undefined}
 */
ParticleConnection.prototype.handleLogin = function (request, response) {
    var self = this;
    if (request.method === 'POST') {
        StreamEater.consumeStream(request).then(function (body) {
            var data = JSON.parse(body.length > 0 ? body : '{}');
            var username = data.username;
            var password = data.password;
            self._login(username, password, response);
        });
    } else {
        response.writeHead('405');
        response.write('Method not supported');
        response.end();
    }
};

/**
 * Calls login to Particle cloud and sets response with result information.
 * 
 * @param {String} username
 * @param {String} password
 * @param {ServerResponse} response
 * @returns {undefined}
 */
ParticleConnection.prototype._login = function (username, password, response) {
    var self = this;
    this.particle.login({username: username, password: password}).then(
            function (data) {
                self.token = data.body.access_token;
                self._resolveOnlinePromise();
                console.log('Login successful. Token recieved:' + self.token);
                response.writeHead('200');
                response.end();
            },
            function (err) {
                console.log('API call completed on promise fail: ', err);
                response.writeHead('401');
                response.write(JSON.stringify(err));
                response.end();
            });
};

/**
 * Calls Particle cloud to pass a new event to the specified device. Returns
 * a Promise containing the response from the cloud.
 * 
 * @param {Number} deviceId
 * @param {Object} event
 * @returns {Promise}
 */
ParticleConnection.prototype.scheduleEvent = function (deviceId, event) {
    var argument = event.time + '|' + event.mode + '|' + event.eventId;
    return this.particle.callFunction({
        deviceId: deviceId,
        name: ParticleConnection.SCHEDULE_FUNC,
        argument: argument,
        auth: this.token
    });
};

/**
 * Calls Particle cloud to call keep-alive on the specified device. Returns
 * a Promise containing the response from the cloud.
 * 
 * @param {Number} deviceId
 * @returns {Promise}
 */
ParticleConnection.prototype.pingDeviceKeepAlive = function (deviceId) {
    return this.particle.callFunction({
        deviceId: deviceId,
        name: this.KEEP_ALIVE,
        argument: '',
        auth: this.token
    });
};

/**
 * Calls Particle cloud to get completion events for specified device. Returns
 * a stream for incoming events.
 * 
 * @param {Number} deviceId
 * @returns {EventStream}
 */
ParticleConnection.prototype.getResponseStream = function (deviceId) {
    var eventName = this.RESPONSE_EVENT;
    return this.particle.getEventStream({
        deviceId: deviceId,
        name: eventName,
        auth: this.token
    });
};

/**
 * Calls Particle cloud to get device online events. Returns
 * a stream for incoming events.
 * 
 * @returns {EventStream}
 */
ParticleConnection.prototype.getDeviceOnlineStream = function () {
    var eventName = this.ONLINE_EVENT;
    return this.particle.getEventStream({
        deviceId: 'mine',
        name: eventName,
        auth: this.token
    });
};

ParticleConnection.prototype.listAvailableDevices = function (request, response) {
    if (request.method === 'GET') {
        this.particle.listDevices({
            auth: this.token
        }).then(function (devices) {
            response.writeHead('200');
            response.write(JSON.stringify(devices));
            response.end();
        }, function (error) {
            response.writeHead('400');
            response.write(JSON.stringify(error));
            response.end();
        });
    } else {
        response.writeHead('405');
        response.write('Method not supported');
        response.end();
    }
};

/**
 * Returns whether an active auth token exists for the cloud.
 * 
 * @returns {Boolean} True if logged in with token, false otherwise
 */
ParticleConnection.prototype.isOnline = function () {
    return token ? true : false;
};

ParticleConnection.prototype.whenOnline = function () {
    return this._onlinePromise;
};

module.exports = ParticleConnection;
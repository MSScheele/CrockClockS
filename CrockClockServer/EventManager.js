var StreamEater = require('./StreamEater');
var Timers = require('timers');

var nextEventId = 0;

/**
 * Constructor.
 * 
 * Events have the following structure:
 * {
 *      time: UNIX timestamp
 *      action: 0: Warm, 1: High 4h 2: High 6h 3: Low 8h 4: Low 10h
 *      eventId: Internally set as a unique ID (via iteration over integers)
 * }
 * 
 * @param {ParticleConnection} connection
 * @returns {EventManager}
 */
function EventManager(connection) {
    var self = this;
    this.connection = connection;
    this.activeDevices = [];
    this.deviceQueues = {};
    this.deviceStreams = {};
}

EventManager.prototype.start = function () {
    var self = this;
    this.connection.getDeviceOnlineStream().then(function (stream) {
        console.log('Listening for devices');
        stream.on('event', function (data) {
            self.connectDevice(data.coreid);
        });
    });

    Timers.setInterval(function() {
        self.keepAlive();
    }, 5 * 60 * 1000); //Run keepalive pings every 5 min 
};

/**
 * Scheduled callback for sending keep-alive pings to devices. Iteratively calls each device
 * to see if it's online and responsive. Devices that fail to response are removed from the
 * list of online devices.
 * 
 * @returns {undefined}
 */
EventManager.prototype.keepAlive = function () {
    var self = this;
    console.log('Pinging active devices');
    for (var i = 0; i < this.activeDevices.length; i++) {
        var curItem = i; //Because i changes before callbacks fire
        this.connection.pingDeviceKeepAlive(this.activeDevices[curItem]).then(function (response) {
            if (response !== 1) {
                console.log('Invalid keep alive response:' + response + ' from device ' + this.activeDevices[curItem]);
                self.deviceStreams[self.activeDevices[curItem]] = null;
                self.activeDevices.splice(curItem, 1);
            }
        }, function (error) {
            console.log('Keep-alive error:' + JSON.stringify(error));
            self.deviceStreams[self.activeDevices[curItem]] = null;
            console.log('Removing item '+curItem);
            self.activeDevices.splice(curItem, 1);
            console.log(self.activeDevices);
        });
    }
};

/**
 * Check if a device is known to be online by the server.
 * 
 * @param {Number} deviceId
 * @returns {Boolean} True if the deviceId is in the active devices list, false otherwise
 */
EventManager.prototype._isDeviceActive = function (deviceId) {
    for (var i = 0; i < this.activeDevices.length; i++) {
        if (this.activeDevices[i] === deviceId) {
            return true;
        }
    }
    return false;
};

/**
 * Handler for event queue calls. Only accepts POST requests, and returns
 * an error if the connection is not active.
 * 
 * @param {IncomingMessage} request
 * @param {ServerResponse} response
 * @returns {undefined}
 */
EventManager.prototype.queueEvent = function (request, response) {
    var self = this;
    if (request.method !== 'POST') {
        response.writeHead('405');
        response.write('Method not supported');
        response.end();
        return;
    }
    if (!this.connection.isOnline) {
        response.writeHead('400');
        response.write('Not logged in. Call login first.');
        response.end();
        //return;
    }
    StreamEater.consumeStream(request).then(function (body) {
        var data = JSON.parse(body);
        var newEvent = {
            time: data.time,
            mode: data.mode
        };
        //TODO: Validation/error handling
        self._queueEventInternal(data.deviceId, newEvent);
        response.writeHead('201');
        response.end();
    });
};

/**
 * Adds a device to the list of currently online devices. If the device has
 * an existing event queue on this server, resend them as the device lacks
 * nonvolatile local storage and they are presumed lost.
 * 
 * @param {Number} deviceId
 * @returns {undefined}
 */
EventManager.prototype.connectDevice = function (deviceId) {
    var self = this;
    if (!this._isDeviceActive(deviceId)) {
        console.log('Device ' + deviceId + ' connected');
        this.activeDevices.push(deviceId);
        if (this.deviceQueues[deviceId]) {
            var queuedEvents = this.deviceQueues[deviceId];
            for (var i = 0; i < queuedEvents.length; i++) {
                this._sendEvent(deviceId, queuedEvents[i]);
            }
        } else {
            this.deviceQueues[deviceId] = [];
        }
        this.listenForResponses(deviceId);
    }
};

EventManager.prototype.listenForResponses = function (deviceId) {
    var self = this;
    this.connection.getResponseStream(deviceId).then(function (stream) {
        console.log('Listening for responses from ' + deviceId);
        self.deviceStreams[deviceId] = stream;
        stream.on('event', function (data) {
            self._handleEventResponse(deviceId, data.data);
        });
    });
};

/**
 * Handles response events from devices. Finds the local copy of an event the
 * device reports having completed and removes it.
 * 
 * @param {Number} deviceId
 * @param {Object} data
 * @returns {undefined}
 */
EventManager.prototype._handleEventResponse = function (deviceId, data) {
    var queue = this.deviceQueues[deviceId];
    for (var i = 0; i < queue.length; i++) {
        var event = queue[i];
        if ('' + event.eventId === data) { //Event ID is an int internally but a string in payload
            queue.splice(i, 1); //Remove from position i
            console.log('Removed completed event ' + event.eventId);
        }
    }
};

/**
 * Inserts an event into the server-side event queue and then sends it to
 * the specified device for storage in local queue.
 * 
 * @param {Number} deviceId
 * @param {Object} event
 * @returns {undefined}
 */
EventManager.prototype._queueEventInternal = function (deviceId, event) {
    if (this.deviceQueues[deviceId] === undefined) {
        this.deviceQueues[deviceId] = [];
        this.listenForResponses(deviceId);
        console.log('Recieved event for unknown device ' + deviceId);
    }
    var queue = this.deviceQueues[deviceId];
    event.eventId = nextEventId;
    nextEventId++;
    for (var i = 0; i < queue.length; i++) {
        if (queue[i].time > event.time) {
            queue.splice(i, 0, event);
            break;
        }
    }
    //Implicit is that we didn't load the event in the loop
    if (queue.length === 0) {
        queue.push(event);
    }
    this._sendEvent(deviceId, event);
};

/**
 * Sends event to the specified device. Follows at-most-once delivery logic.
 * If a device is offline when this is called, it will recieve the event when
 * it next connects to the server.
 * 
 * @param {Number} deviceId
 * @param {Object} event
 * @returns {undefined}
 */
EventManager.prototype._sendEvent = function (deviceId, event) {
    console.log('Publishing event ID ' + event.eventId + ' to device ' + deviceId);
    this.connection.scheduleEvent(deviceId, event).then(
            function (response) {
                if (response.statusCode === 200) {
                    console.log('Published event ID ' + event.eventId + ' to device ' + deviceId);
                } else {
                    console.log('Anomalous success: ' + JSON.stringify(response));
                }
            }, function (error) {
        console.log('Publish failure: ' + JSON.stringify(error));
    });
};

EventManager.prototype.getRegisteredDevices = function () {
    return this.activeDevices;
};

module.exports = EventManager;
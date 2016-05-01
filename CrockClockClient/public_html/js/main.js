$(document).ready(function() {
    
    CrockClockClient.SERVER_HOST = 'http://localhost:8080/';
    CrockClockClient.ENDPOINT_LOGIN = 'login';
    CrockClockClient.ENDPOINT_DEVICES = 'devices';
    CrockClockClient.ENDPOINT_QUEUE = 'queueEvent';
    
    CrockClockClient.DEVICE_SETTINGS = [{
            label: 'Off',
            value: 0
    },{
            label: 'High 4h',
            value: 1
    },{
            label: 'High 6h',
            value: 2
    },{
            label: 'Low 8h',
            value: 3
    },{
            label: 'Low 10h',
            value: 4
    },{
            label: 'Warm',
            value: 5
    }];
    
    function CrockClockClient() {
        this.idBase = 0;
        
        this.loginViewId = this.getUniqueId();
        this.scheduleViewId = this.getUniqueId();
        this.usernameFieldId = this.getUniqueId();
        this.passwordFieldId = this.getUniqueId();
        this.deviceSelectId = this.getUniqueId();
        this.settingSelectId = this.getUniqueId();
        this.timePickerId = this.getUniqueId();
        this.datePickerId = this.getUniqueId();
        
        this.username = ko.observable();
        this.password = ko.observable();
        this.loginError = ko.observable(false);
        
        this.devices = ko.observableArray([]);
        this.selectedDevice = ko.observable();
        
        this.settings = ko.observableArray(CrockClockClient.DEVICE_SETTINGS);
        this.selectedSetting = CrockClockClient.DEVICE_SETTINGS[0];
        
        this.activeContent = ko.observable(this.loginViewId);
    }
    
    CrockClockClient.prototype.getUniqueId = function() {
        return 'cc-client-'+this.idBase++;
    };
    
    CrockClockClient.prototype.submitLogin = function() {
        var self = this;
        var url = CrockClockClient.SERVER_HOST+CrockClockClient.ENDPOINT_LOGIN;
        var data = {
            username: this.username(),
            password: this.password()
        };
        this.password('');
        $.ajax(url, {
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            processData: false
        }).then(function() {
            self.handleLoginSuccess();
        }, function(jqXHR, textStatus, errorThrown) {
            self.handleServiceFailure(errorThrown);
        });
    };
    
    CrockClockClient.prototype.handleLoginSuccess = function() {
        var self = this;
        var url = CrockClockClient.SERVER_HOST+CrockClockClient.ENDPOINT_LOGIN;
        this.loadScheduleView();
        this.activeContent(this.scheduleViewId);
        this.initJQueryWidgets();
        this.loginError(false);
    };
    
    CrockClockClient.prototype.initJQueryWidgets = function() {
        $('#'+this.timePickerId).timepicker({
            scrollDefault: 'now',
            step: 10,
            forceRoundTime: true
        });
        $('#'+this.datePickerId).datepicker({});
    };
    
    CrockClockClient.prototype.loadScheduleView = function() {
        var self = this;
        var url = CrockClockClient.SERVER_HOST+CrockClockClient.ENDPOINT_DEVICES;
        $.ajax(url, {
            method: 'GET'
        }).then(function(data) {
            self.handleDevicesSuccess(data);
        }, function(jqXHR, textStatus, errorThrown) {
            self.handleServiceFailure(errorThrown);
        });
    };
    
    CrockClockClient.prototype.handleDevicesSuccess = function(data) {
        var json = JSON.parse(data).body;
        var devices = [];
        for(var i=0;i<json.length;i++) {
            devices.push({
                id: json[i].id,
                name: json[i].name
            });
        }
        this.devices(devices);
        this.selectedDevice(devices[0]);
    };
    
    CrockClockClient.prototype.scheduleEvent = function() {
        var self = this;
        var baseDate = $('#'+this.datePickerId).datepicker('getDate');
        var dateTime = $('#'+this.timePickerId).timepicker('getTime', baseDate);
        
        var data = {
            mode: this.selectedSetting().id,
            deviceId : this.selectedDevice().id,
            date: dateTime
        };
        
        var url = CrockClockClient.SERVER_HOST+CrockClockClient.ENDPOINT_QUEUE;
        $.ajax(url, {
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            processData: false
        }).then(function() {
            self.handleQueueSuccess();
        }, function(jqXHR, textStatus, errorThrown) {
            self.handleServiceFailure(errorThrown);
        });
    };
    
    CrockClockClient.prototype.handleQueueSuccess = function() {
        console.log('Queue success');
    };
    
    CrockClockClient.prototype.handleServiceFailure = function(error) {
        console.log(error);
        this.loginError(true);
    };
    
    ko.applyBindings(new CrockClockClient());
});
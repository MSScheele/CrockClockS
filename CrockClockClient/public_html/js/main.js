$(document).ready(function() {
    
    CrockClockClient.SERVER_HOST = 'http://localhost:8080/';
    CrockClockClient.ENDPOINT_LOGIN = 'login';
    
    function CrockClockClient() {
        this.idBase = 0;
        
        this.loginViewId = this.getUniqueId();
        this.scheduleViewId = this.getUniqueId();
        this.usernameFieldId = this.getUniqueId();
        this.passwordFieldId = this.getUniqueId();
        
        this.username = ko.observable();
        this.password = ko.observable();
        this.loginError = ko.observable(false);
        
        this.activeContent = ko.observable(this.loginViewId);
    }
    
    CrockClockClient.prototype.getUniqueId = function() {
        return 'cc-client-'+this.idBase++;
    };
    
    CrockClockClient.prototype.submitLogin = function() {
        var url = CrockClockClient.SERVER_HOST+CrockClockClient.ENDPOINT_LOGIN;
        var pass = this.password();
        this.password('');
        $.post(url, {
            username: this.username(),
            password: pass
        });
    };
    
    CrockClockClient.prototype.handleLoginSuccess = function() {
        this.activeContent(this.scheduleViewId);
        this.loginError(false);
    };
    
    CrockClockClient.prototype.handleLoginFailure = function() {
        this.loginError(true);
    };
    
    ko.applyBindings(new CrockClockClient());
});
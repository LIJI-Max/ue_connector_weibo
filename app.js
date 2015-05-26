var express = require("express"),
    Connector = require('./connector'),
    app = express(),
    url = require('url'),
    redis = require("redis"),
    ConnectorObj,
    prefix = '/v1';
var client;
function logErrors(err, req, res, next) {
    console.error(err);
  if (err.stack) {
    console.error(err.stack);
  }
  next(err);
}
function clientErrorHandler(err, req, res, next) {
    var code = ConnectorObj.getErrorCode(err);
    res.send(200, { 
        status: code,
        info: err.message || 'Something went really wrong!!!'
    });
}
app.configure('beta', function () {
    var redisUrl = url.parse(process.env.REDISCLOUD_URL);
    //console.log("current redis auth " + redisUrl.auth);
    var redisAuth = redisUrl.auth.split(':');
    app.set('redisHost', redisUrl.hostname);
    app.set('redisPort', redisUrl.port);
    app.set('redisDb', redisAuth[0]);
    app.set('redisPass', redisAuth[1]);
});

app.configure(function () {

    client = redis.createClient(app.get('redisPort'), app.get('redisHost'));
    
    //client  = redis.createClient(6379, "127.0.0.1");
    client.auth(app.get('redisPass'), function() {
        console.log("Connected!*****");
        app.set('redisConnect', client);
        ConnectorObj = new Connector(app, client);
    });

    var auth = require('http-auth');
    var basic = auth.basic({
        realm: "Weibo ConnectorObj requires authentication."/*,
        file: __dirname + "/data/users.htpasswd" */
    },function (username, password, callback) { // Custom authentication method.
        console.info('username', username);
        console.info('password', password);
        callback(username === "key" && password === "18d217aa8bc3d8242c600052c9e3460f");
    });
    //app.use(auth.connect(basic));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(logErrors);
    app.use(clientErrorHandler);
});    


app.get(prefix + '/capabilities', function (req, res, next) {
    ConnectorObj.capabilities(null, req, res, next);
});
app.post(prefix + '/capabilities', function (req, res, next) {
    ConnectorObj.capabilities(null, req, res, next);
});
app.post(prefix + '/userinfo', function (req, res, next) {
	console.info('capabilities');
	ConnectorObj.userinfo(null, req, res, next);
});
app.get(prefix + '/connector/test', function (req, res, next) {
    console.info('get');
    ConnectorObj.test(null, req, res, next);
});
app.post(prefix + '/test', function (req, res, next) {
    ConnectorObj.test(null, req, res, next);
});
app.post(prefix + '/refresh', function (req, res, next) {
    console.log('inside connector refresh');
    console.info('capabilities ');
    ConnectorObj.refresh(null, req, res, next);
});
app.post(prefix + '/message/send', function (req, res, next) {
    console.log('message/send');
    ConnectorObj.send(null, req, res, next) 
});
app.get(prefix + '/callback', function (req, res, next) {
    console.log('callback');
    ConnectorObj.callback(null, req, res, next) 
});
    
if (!module.parent) {
    console.info('Listening ',process.env.PORT || 5000);
    app.listen(process.env.PORT || 5000);
}
process.on('uncaughtException', function (err) {
    //log the error
    console.error(err);
    console.log('uncaughtException ***', err);
    client.quit();
    //let's tell our master we need to be disconnected
    require('forky').disconnect();
    //in a worker process, this will signal the master that something is wrong
    //the master will immediately spawn a new worker
    //and the master will disconnect our server, allowing all existing traffic to end naturally
    //but not allowing this process to accept any new traffic
});

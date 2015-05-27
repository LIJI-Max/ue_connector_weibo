var weibo = require('weibo'), 
    url = require('url'),
    WEIBO_OAUTH_KEY = '977498608';
    WEIBO_OAUTH_SECRET = '98200c6f6ae3d9e618ef464d7cd60f59',
    //twitter_update_with_media = require('./twitter_update_with_media'),
    call_back_url='http://127.0.0.1:5000/v1/callback',
    request = require('request').defaults({ encoding: null });
weibo.init('weibo',WEIBO_OAUTH_KEY,WEIBO_OAUTH_SECRET, call_back_url);


function Connector(app, client) {
    this.callback = function(err, req, res, next){
        console.log('Response is here ' + res);
    };
    this.test = function (err, req, res, next) {
        if (err) {
            console.info('err');
            return next(err);
        }
        if (!req.param('uri')) {
            return next({code:503, message:'Access credentials invalid!'});
        }
        var reqObj = url.parse(req.param('uri'));
        console.log('uri printing**', reqObj);
         //weibo://2378169164:2.00K8YwaCaCUJEB538ae0aae3L48cmD@weibo.uib
        access = reqObj.auth.split(':');
        if (access && access.length !== 2) {
            return next({code:503, message:'Access credentials invalid!'});
        }
        
        var user = { blogtype: 'weibo', id:access[0], access_token:access[1] };
        weibo.verify_credentials( user, function(err2, res2) {
            console.info('weibo');
            if (err2) {
                console.info('err2');
                return next(err2);
            }
            console.info('res');
            res.json({
              status: 200,
              info: "OK",
              uri: req.param('uri')
            });
        });
    };
    this.getErrorCode = function(data) {
        
        var code = 200;
        if (data && data.code) {
            /*switch (data.code) {
                case 190:
                case 102:
                case 10:
                case (data.code >= 200 && data.code <= 299):
                code = 403;
                break;
                case 1:
                case 2:
                case 4:
                case 17:
                code = 503;
                break;
            }*/
            code = data.code;
        }
        return code;
    }

    this.capabilities = function (err, req, res, next) {
        if (err) {
            return next(err);
        }
		res.json({
			"status": 200,
			"info": "OK",
			"connector": [{
				"name": "Weibo",
				"backends": [{
						"name": "Weibo",
						"type": "OAUTH", 
						"address": "https://api.weibo.com/oauth2/authorize"
					}
				],
				"capabilities": [
					"SEND"
				]
			}]
		});
    };
	
	this.userinfo  = function (err, req, res, next) {

        if (err) {
            next(err);
        }
		var reqObj = url.parse(req.param('uri')),
            access = reqObj.auth.split(':')
			
        //var client = app.get('redisConnect');
        client.hgetall(access[0], function (err, obj) { // Implement cache list connectors
            if (obj) {
                console.log('Taking user data from Cached ********', obj);
                res.json({
                    status: 200,
                    info: "OK",
                    connectors: [{
                        displayName: obj.displayName,
                        userImage: obj.userImage,
                        loginName: obj.loginName
                    }]
                });
            } else {
                console.log('No cached data call weibo *********');
                var user = { blogtype: 'weibo', id:access[0], access_token:access[1] };
                weibo.verify_credentials(user, function(err, resp) {
                    if (err) {
                        next(err);
                    }
                    console.info(resp);
                    // returns the post id
                    res.json({
                        status: 200,
                        info: "OK",
                        connectors: [{
                            displayName: resp.name,
                            userImage: resp.profile_image_url,
                            loginName: resp.screen_name
                        }]
                    });
                    // Implement Cache to reduce twitter call - store values in redis
                    client.hmset(access[0], "displayName", resp.name, "userImage", resp.profile_image_url, "loginName", resp.screen_name);
                    client.expire(access[0], 3600); // Expired in 1 Hour

                });

            }

        });

    };
        
    this.send = function (err, req, res, next) {
        if (err) {
            return next(err);
        }

        var reqObj = url.parse(req.param('uri')),
            wallpost = {},
            media_picture = {},
            access = reqObj.auth.split(':');
            // Repository used for without media upload
            // patch to upload media with status
        var user = { blogtype: 'weibo', id:access[0], access_token:access[1] };
  

        if (req.param('message')) {
            var message = req.param('message'),
                content = message.subject,
                link = [],
                picture;
            if (message.parts && message.parts.length) {
                message.parts.forEach(function (part) {
                    
                    if (part.type === 'body') {
                        var parseMsg = JSON.parse(part.data);
                        var message_data =  parseMsg.content;
                        var picture = parseMsg.image_url;
                        if (parseMsg.twitter_image === true || parseMsg.twitter_image == "true") {
                            console.log('weibo image preview true');
                            media_picture.picture = picture;
                        } else {
                            console.log('twitter image preview false');
                            media_picture.picture = false;
                        }
                        console.log('media_picture.picture ***', media_picture.picture);
                        content = content ? content+ "\n" + message_data : message_data;

                    }
                    if (part.type === 'link') {
                        link = part.data;
                        content = content ? content + "\n" + link : link;
                    }
                });
            }
            wallpost.status = content;
            var error_parse;
            console.log('wall post', wallpost);
            console.log('before decide media', media_picture.picture);
            if (media_picture.picture) {
                console.log('with media upload');
                weibo.upload(user, content,media_picture.picture,
                    function (err, status) {
                    if (err) { // && response.statusCode == 200 commented bcz amazone images not able to post http://www.amazon.com/gp/goldbox/ref=nav_cs_gb
                    
                        console.log('have errors', err);
                        res.json({
                            status: 500,
                            info: err.data.error_code + ' ' + err.message

                        });
                        
                    } else {
                        console.log('Succesfully upload a image to Weibo');
                        res.json({
                                        status: 200,
                                        info: "OK",
                                        id: status.id
                                    });                    
                    }
                });

            } else {
                console.log('no media without media upload');
                weibo.update(user,content, function(err, status){
                    if (err) { // && response.statusCode == 200 commented bcz amazone images not able to post http://www.amazon.com/gp/goldbox/ref=nav_cs_gb
                    
                        console.log('have errors', err);
                        res.json({
                            status: 500,
                            info: err.data.error_code + ' ' + err.message

                        });
                        
                    } else {
                        console.log('Succesfully upload a image to Weibo');
                        res.json({
                                        status: 200,
                                        info: "OK",
                                        id: status.id
                                    });                    
                    }
                } );
            }
        }
    };
    this.refresh  = function (err, req, res, next) {
        if (err) {
            res.json({
                status: 503,
                info: err
            });
        }
        console.log('inside handler refresh', req.param('uri'));
        res.json({
            status: 200,
            info: "OK",
            uri: req.param('uri')
        });
    };
}
module.exports = Connector;
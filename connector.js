var weibo = require('weibo'), 
    url = require('url'),
    WEIBO_OAUTH_KEY = '977498608';
    WEIBO_OAUTH_SECRET = '98200c6f6ae3d9e618ef464d7cd60f59',
    //twitter_update_with_media = require('./twitter_update_with_media'),
    call_back_url='http://127.0.0.1:5000/v1/callback',
    request = require('request').defaults({ encoding: null });
weibo.init('OutboxPro',WEIBO_OAUTH_KEY,WEIBO_OAUTH_SECRET, call_back_url);

function Connector(app, client) {
    var sendMessageWithoutImage = function(err, req, res, next, twit, wallpost,access){
        console.log('inside outer sent function');
        weibo.post('statuses/update', wallpost, function(err, data, response) {
            if (err) {
                console.log('found error', err);
                return next(err);
            }
            res.json({
                status: 200,
                info: "OK"
            });
        });
    };
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
        //twitter://2373196350-BqRyghcN7S1eaA6rUiMm6lEYXZmSA2TpuSNDBOF:o40aqVRWkApZ2kJ1oPqdKzho9yLoQfFGvlgN6RUZUJETV@twitter.uib
        access = reqObj.auth.split(':');
        if (access && access.length !== 2) {
            return next({code:503, message:'Access credentials invalid!'});
        }
        var twit = new Twit({
            consumer_key:         TWITTER_OAUTH_KEY
          , consumer_secret:      TWITTER_OAUTH_SECRET
          , access_token:         access[0]
          , access_token_secret:  access[1]
        })
        
        twit.get( "account/verify_credentials", function(err2, res2) {
            console.info('twit');
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
            capabilities : [ 'SEND' ],
            status: 200,
            info: "OK"
        });
		res.json({
			"status": 200,
			"info": "OK",
			"connector": [{
				"name": "Twitter",
				"icons": {
					"SVG": "https://s3-eu-west-1.amazonaws.com/uib-icons/rss/twitter.svg"
				},
				"backends": [{
						"name": "Twitter",
						"type": "OAUTH", 
						"address": "https://api.twitter.com/oauth/authorize"
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
            access = reqObj.auth.split(':'),
			twit = new Twit({
                consumer_key:         TWITTER_OAUTH_KEY
              , consumer_secret:      TWITTER_OAUTH_SECRET
              , access_token:         access[0]
              , access_token_secret:  access[1]
            })
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
                console.log('No cached data call twitter *********');
                twit.get( "/account/verify_credentials", function(err, resp) {
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
                            userImage: resp.profile_image_url_https || resp.profile_image_url,
                            loginName: resp.screen_name
                        }]
                    });
                    // Implement Cache to reduce twitter call - store values in redis
                    client.hmset(access[0], "displayName", resp.name, "userImage", resp.profile_image_url_https || resp.profile_image_url, "loginName", resp.screen_name);
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
            access = reqObj.auth.split(':'),
            // Repository used for without media upload
            twit = new Twit({
                consumer_key:         TWITTER_OAUTH_KEY
              , consumer_secret:      TWITTER_OAUTH_SECRET
              , access_token:         access[0]
              , access_token_secret:  access[1]
            });
        // patch to upload media with status
        var tuwm = new twitter_update_with_media({
            consumer_key: TWITTER_OAUTH_KEY,
            consumer_secret: TWITTER_OAUTH_SECRET,
            token: access[0],
            token_secret: access[1]
        });

        if (req.param('message')) {
            var mesaage = req.param('message'),
                content = mesaage.subject,
                link = [],
                picture;
            if (mesaage.parts && mesaage.parts.length) {
                mesaage.parts.forEach(function (part) {
                    
                    if (part.type === 'body') {
                        var parseMsg = JSON.parse(part.data);
                        var message_data =  parseMsg.content;
                        var picture = parseMsg.image_url;
                        if (parseMsg.twitter_image === true || parseMsg.twitter_image == "true") {
                            console.log('twitter image preview true');
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
                request.head(media_picture.picture,
                    function (error, response, body) {
                    if (!error) { // && response.statusCode == 200 commented bcz amazone images not able to post http://www.amazon.com/gp/goldbox/ref=nav_cs_gb
                        var image_size = response.headers['content-length'];
                        if (image_size > 2000000) { // 2mb max upload limit
                            console.log('greater than 2mb');
                            sendMessageWithoutImage(err, req, res, next, twit, wallpost, access);

                        } else {
                            console.log('less than 2mb');
                            tuwm.post(content, media_picture.picture, function(err, response) { // deprecated later need to upgrade to status/update api
                                if (err) {
                                    console.log('error', err);
                                    return next(err);
                                }
                                error_parse = JSON.parse(response.body);
                                if (error_parse.errors) {
                                    console.log('have errors', error_parse);
                                    res.json({
                                        status: 500,
                                        info: error_parse.errors[0].code + ' ' + error_parse.errors[0].message

                                    });
                                } else {
                                    res.json({
                                        status: 200,
                                        info: "OK",
                                        id: response.id
                                    });
                                }
                            });

                        }
                    } else {
                        console.log('cannot access image url posting without image');
                        sendMessageWithoutImage(err, req, res, next, twit, wallpost, access)
                    }
                });

            } else {
                console.log('no media without media upload');
                sendMessageWithoutImage(err, req, res, next, twit, wallpost, access)
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
var express = require('express'),
    sys   = require('sys'),
    stylus= require('stylus'),
    io = require('socket.io');

var app = module.exports = express.createServer();
app.set('view engine', 'jade');
app.configure(function(){
    app.use(express.bodyDecoder());
});

app.get('/*.css', function(req, res) {
    var url= req.url.split('/').reverse();
    console.log(url);
    if (url[1] == 'css') {
	var filename= res.req.params[0].split('/')[1];
	// var css= convert_sass(__dirname+'/views/'+filename + '.css.sass');
	res.render(filename + '.css.sass', { layout: false });
    } else if (url[1] == 'styl') {
	var filename= res.req.params[0].split('/')[1];
	var str= fs.readFileSync(__dirname + '/views/'+filename+'.styl', 'utf8');
	stylus.render(str, { filename: filename+'.styl' }, function(err, css){
	    if (err) throw err;
	    res.send(css);
	});
    } else {
	res.sendfile(__dirname+'/public/stylesheets/'+req.params[0]+'.css');
    }
});

app.get('/javascripts/*', function(req, res){
    res.sendfile(__dirname+'/public/javascripts/'+req.params[0]);
});

app.get('/images/*', function(req, res){
    res.sendfile(__dirname+'/public/images/'+req.params[0]);
});

app.get('/', function(req, res){
    res.render('index.jade', {
	locals: {
	    title: "OntoIM"
	}
    });
});

app.get('/chatty', function(req, res){
    res.render('chatty.jade', {
	locals: {
	    title: "OntoIM"
	}
    });
});

app.listen(8080);

var io= io.listen(app);
var _client;

io.on('connection', function(client) {
    var _client= client;
    client.on('message', function(message){
	var msg = { message: [client.sessionId, message] };
	// buffer.push(msg);
	// 
	console.log(msg);
	//
	
	if (buffer.length > 15) buffer.shift();
	client.broadcast(msg);
    });
    
    client.on('disconnect', function(){
	client.broadcast({ announcement: client.sessionId + ' disconnected' });
    });
});

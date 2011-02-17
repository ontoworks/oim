var express = require('express'),
    sys   = require('sys'),
    io = require('socket.io'),
    fs = require('fs'),
    stylus= require('stylus'),
    net = require('net');

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

app.get('/client', function(req, res){
    res.render('client.jade', {
	locals: {
	    title: "OntoIM"
	}
    });
});

app.listen(8080);

// Adds session_id to a JSON string
function add_session_id(message, session_id) {
    var parse;
    try {
	parse= JSON.parse(message);
    } catch(err) {
	console.log(err);
    }
    if(parse) {
	parse.sid= session_id;
	message= JSON.stringify(parse);
	return message;
    }
}

var io= io.listen(app);
var _client;
var buffer= [];

var sessions= {};

io.on('connection', function(client) {
    var _client= client;
    client.send({ buffer: buffer });

    client.on('message', function(message){
	var msg = { message: [client.sessionId, message] };
	buffer.push(msg);
	if (buffer.length > 15) buffer.shift();
	// client.broadcast(msg);
	message= add_session_id(message, client.sessionId);
	cm.write(message);
    });
    
    client.on('disconnect', function(){
	client.broadcast({ announcement: client.sessionId + ' disconnected' });
    });
});

// Connect to XMPP Connection Manager
var cm= net.createConnection(8124, 'localhost');
cm.on('connect', function(stream) {
    cm.setEncoding('utf8');
    console.log("Connected to Connection Manager");
});

cm.on('data', function(stream) {
    console.log("Data from CM");
    var messages= [];
    try {
	// presence messages sometimes have more than one
	// JSON literal after another
	var presence_buffer= stream.split("{\"presence\":");
	if (presence_buffer.length > 1) {
	    for(var i=1; i < presence_buffer.length; i++) {
		messages.push(JSON.parse("{\"presence\":"+presence_buffer[i]));
	    }
	} else {
	    messages.push(JSON.parse(stream));
	}
    } catch(err) {
	console.log("Can't parse JSON");
    }
    if (messages) {
	messages.forEach(function(message) {
	    if (message.session) {
		sessions[message.session.jid]= message.session.sid;
	    } else {
		io.clients[message.sid].send(JSON.stringify(message));
	    }
	});
    } else {
	console.log(stream);
    }
});
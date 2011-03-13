var express= require('express'),
    sys= require('sys'),
    io= require('socket.io'),
    fs= require('fs'),
    stylus= require('stylus'),
    net= require('net');

var app = module.exports = express.createServer();
app.set('view engine', 'jade');
app.configure(function(){
    app.use(express.bodyDecoder());
});

module.exports.__dirname= __dirname;
var XmppProxy= require('./lib/xmpp_proxy').XmppProxy;

app.get('/*.css', function(req, res) {
    var url= req.url.split('/').reverse();
    if (url[1] == 'styl') {
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

app.get('/dev/*', function(req, res){
    res.render("dev/"+req.params[0]+".jade", {
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
var sessions_by_sid= {};

io.on('connection', function(client) {
    client.on('message', function(message){
	message= add_session_id(message, client.sessionId);
	cm.write(message);
    });
    
    client.on('disconnect', function(){
	conman.end_session(client.sessionId);
	remove_session(client.sessionId);
	client.broadcast({ announcement: client.sessionId + ' disconnected' });
    });
});

function remove_session(sid) {
    if (sessions_by_sid[sid]) {
	var jid= sessions_by_sid[sid];
	var rm;
	for (res in sessions[jid]) {
	    if (sessions[jid][res] == sid) { 
		rm= res;
		break;
	    }
	}
	delete sessions[jid][res];
	delete sessions_by_sid[sid];
    }
}


// Receives full jid
function get_session(jid) {
    var bare_jid= jid.split("/")[0];
    var resource= jid.split("/")[1];
    
    // We don't want to lose a message if it's going to a closed session
    // If that happens we try to redirect to another active session, just any
    var sid= (function() {
	var current_sid= sessions[bare_jid][resource];
	if(io.clients[current_sid]) return sessions[bare_jid][resource];
	sessions[bare_jid][resource]= undefined;
	for(res in sessions[bare_jid]) {
	    return sessions[bare_jid][res];
	}
	return false;
    })();
    if (sid) return io.clients[sid];
}

function deliver(message) {
    var bare_jid= message.to.split("/")[0];
    var resource= message.to.split("/")[1];
    var sid= [];
    if (resource) {
	sid.push(sessions[bare_jid][resource]);
    } else {
	for (res in sessions[bare_jid]) {
	    sid.push(sessions[bare_jid][res]);
	}
    }
    sid.forEach(function(id) {
	if (io.clients[id]) {
	    io.clients[id].send(JSON.stringify(message));
	} else {
	    console.log("Can't find session "+id);
	}
    });
}

// Connect to XMPP Connection Manager
var conman= new XmppProxy();
var cm= net.createConnection(8124, 'localhost');
cm.on('connect', function(stream) {
    cm.setEncoding('utf8');
    console.log("Connected to Connection Manager");
});

conman.on('self_vcard', function(message) {
    deliver(message);
});

conman.on('presence', function(message) {
    deliver(message);
});

conman.on('session', function(message) {
    deliver(message);
});


cm.on('data', function(stream) {
    var messages= [];
    try {
	// presence messages sometimes have more than one
	// JSON literal after another
	var presence_buffer= stream.split("{\"presence\":");
	if (presence_buffer.length > 1) {
	    for(var i=1; i < presence_buffer.length; i++) {
		var msg= "{\"presence\":"+presence_buffer[i];
		messages.push(JSON.parse(msg));
	    }
	} else {
	    messages.push(JSON.parse(stream));
	}
    } catch(err) {
	console.log("Can't parse JSON");
	console.log(err);
	console.log(stream);
    }
    if (messages) {
	messages.forEach(function(message) {
	    // console.log(message);
	    if (message.session) {
		var session= message.session;
		var bare_jid= session.jid.user+"@"+session.jid.domain;
		if (!sessions[bare_jid]) sessions[bare_jid]= {};
		if (!sessions_by_sid[message.sid]) sessions_by_sid[message.sid]= bare_jid;
		sessions[bare_jid][session.jid.resource]= message.sid;
		if (message.sid) io.clients[message.sid].send(JSON.stringify(message));
	    } else {
		var bare_jid= message.to.split("/")[0];
		var resource= message.to.split("/")[1];
		var sid= [];
		if (resource) {
		    sid.push(sessions[bare_jid][resource]);
		} else {
		    for (res in sessions[bare_jid]) {
			sid.push(sessions[bare_jid][res]);
		    }
		}
		sid.forEach(function(id) {
		    if (io.clients[id]) {
			io.clients[id].send(JSON.stringify(message));
		    } else {
			console.log("Can't find session "+id);
		    }
		});

	    }
	});
    } else {
	console.log(stream);
    }
});
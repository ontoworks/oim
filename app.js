var express= require('express'),
    sys= require('sys'),
    io= require('socket.io'),
    fs= require('fs'),
    stylus= require('stylus'),
    net= require('net');

var app = module.exports = express.createServer();
app.set('view engine', 'jade');
app.configure(function(){
    app.use(express.bodyParser());
});

module.exports.__dirname= __dirname;

var db= require('./lib/model');
db.connect('mongodb://localhost/urbanitus');
module.exports.db= db;

var domain= require('./lib/domain');
module.exports.domain= domain;

var ConnectionManager= require('./lib/connection_manager').ConnectionManager;

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
    message.sid= session_id;
    return message;
}

var io= io.listen(app);
var _client;
var buffer= [];
var sessions= {};
var sessions_by_sid= {};

var cm= new ConnectionManager();

io.on('connection', function(client) {
    client.on('message', function(message){
	message= add_session_id(message, client.sessionId);
	cm.send(message);
    });
    
    client.on('disconnect', function(){
	cm.close(client.sessionId);
	client.broadcast({ announcement: client.sessionId + ' disconnected' });
    });
});


function deliver(message) {
    try {
	io.clients[message.sid].send(message);
    } catch(err) {
	console.log("Couldn't find session "+message.sid);
    }
}

cm.on('message', function(message) {
    deliver(message);
});











// function remove_session(sid) {
//     if (sessions_by_sid[sid]) {
// 	var jid= sessions_by_sid[sid];
// 	var rm;
// 	for (res in sessions[jid]) {
// 	    if (sessions[jid][res] == sid) { 
// 		rm= res;
// 		break;
// 	    }
// 	}
// 	delete sessions[jid][res];
// 	delete sessions_by_sid[sid];
//     }
// }


// // Receives full jid
// function get_session(jid) {
//     var bare_jid= jid.split("/")[0];
//     var resource= jid.split("/")[1];
    
//     // We don't want to lose a message if it's going to a closed session
//     // If that happens we try to redirect to another active session, just any
//     var sid= (function() {
// 	var current_sid= sessions[bare_jid][resource];
// 	if(io.clients[current_sid]) return sessions[bare_jid][resource];
// 	sessions[bare_jid][resource]= undefined;
// 	for(res in sessions[bare_jid]) {
// 	    return sessions[bare_jid][res];
// 	}
// 	return false;
//     })();
//     if (sid) return io.clients[sid];
// }

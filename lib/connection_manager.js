var sys = require('sys');

var EventEmitter = require('events').EventEmitter;
var FacebookClient= require('./xmpp_proxy').FacebookClient;
var GtalkClient= require('./xmpp_proxy').GtalkClient;
var Domain= module.parent.exports.domain;

var User= Domain.User;

function bare_jid(jid) {
    return jid.split('/')[0];
};

var ConnectionManager= function() {
    EventEmitter.call(this);
    var self= this;
    this._sessions= {}
};
sys.inherits(ConnectionManager, EventEmitter);

ConnectionManager.prototype.send= function(message) {
    var sid= message.sid;
    if (message.session) {
	new_session.call(this, message);
    } else {
	this.get_session(sid).send(message);
    }
};

function wrap_sid(message, sid) {
    message.sid= sid;
    return message;
}

function new_session(message) {
    var config= {};
    var client;
    var self= this;
    switch(message.session.service) {
    case 'facebook':
	config= {
	    jid: message.session.uid+"@chat.facebook.com/urbanitus-"+message.sid,
	    session_key: message.session.session_key
	};
	client= new FacebookClient(config);
    case 'gtalk':
	client= new GtalkClient(message.session);
    }
    client.on('session', function(data) {
	// exists roster in DB?
	var jid= bare_jid(data.session.jid);
	User.exists(jid, function(exists) {
	    var user;
	    if (!exists) {
		User.create({ jid: jid }, function(data) {
		    user= data;
		    client.request_roster();
		});
	    } else {
		User.find_by_jid(jid, function(data) {
		    user= data;
		});
	    }
	});
	self._sessions[message.sid]= client;
    });

    client.on('roster', function(roster) {
	// update roster in DB
	User.update_roster(roster);
	self.emit('message', wrap_sid(roster, message.sid));
    });

    client.on('presence', function(presence) {
	self.emit('message', wrap_sid(presence, message.sid));
    });

    client.on('message', function(msg) {
	self.emit('message', wrap_sid(msg, message.sid));
    });
};

ConnectionManager.prototype.get_session= function(sid) {
    return this._sessions[sid];
};

ConnectionManager.prototype.close= function(sid) {
    this._sessions[sid]= null;
};

module.exports.ConnectionManager= ConnectionManager;
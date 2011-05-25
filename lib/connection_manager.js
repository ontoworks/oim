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
    console.log();
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
    if(!client) throw "Couldn't establish session";
    
    client.on('session', function(data) {
	// exists roster in DB?
	var jid= bare_jid(data.session.jid);
	User.exists(jid, function(exists) {
	    console.log("exists: "+exists);
	    if (!exists) {
		User.create({ jid: jid }, function(data) {
		    client.request_roster();
		});
	    } else {
		User.find_by_jid(jid, function(user) {
		    var roster= user.gtalk_roster[0];
		    roster.roster.contacts= (function() {
		        var contacts= {};
		        user[roster.service+"_buddies"].forEach(function(buddy) {
		    	    contacts[buddy.jid]= buddy;
		        });
		        return contacts;
		    })();
		    delete roster.roster[roster.service+"_buddies"];
		    self.emit('message', wrap_sid(roster, message.sid));
		    client.send_presence();
		});
	    }
	});
	self._sessions[message.sid]= client;
    });
    
    client.on('roster', function(roster) {
	// update roster in DB
	User.update_roster(roster);
	self.emit('message', wrap_sid(roster, message.sid));
	client.send_presence();
    });
    
    client.on('vCard', function(vCard) {
	User.update_vCard(vCard, function(new_vCard) {
	    self.emit('message', wrap_sid(new_vCard, message.sid));
	});
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
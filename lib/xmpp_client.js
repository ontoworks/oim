var sys = require('sys');
var xmpp = require('node-xmpp');
var jQuery= require('jquery');
var EventEmitter = require('events').EventEmitter;

var XmppClient= function() {
};

var google= new GoogleChat({username: 'sgaviria@gmail.com', password: 'S4ntiag0'});

XmppChatClient.prototype.connect= function(o) {
    var h = new xmpp.Client({ jid: o.username,
			      password: o.password,
			      host: o.host,
			      port: o.port
			    });

    this.connection= h;
};

XmppChatClient.prototype.getBuddyList= function() {
    var iq_roster= new xmpp.Element('iq', {type: 'get'});
    var query_roster= new xmpp.Element('query', {xmlns:'jabber:iq:roster'});
    iq_roster.cnode(query_roster);
    this.connection.send(iq_roster);
};

XmppChatClient.prototype.sendMessage= function() {
};

XmppChatClient.prototype.receiveMessage= function() {
};

var sys = require('sys');
var fs = require('fs');
var xmpp = require('node-xmpp');
var net = require('net');
var jQuery= require('jquery');
var htmlparser= require('htmlparser');
var EventEmitter = require('events').EventEmitter;
var im= require('imagemagick');
var path= require('path');

var api_key= "270579051603";
var secret_key= "c8c723b66a60b5c65604b92f04570bee";

function timestamp() {
    var date= new Date();
    var timestamp= date.getHours()+":";
    timestamp += date.getMinutes() < 10 ? '0'+date.getMinutes() : date.getMinutes();
    timestamp += ":";
    timestamp += date.getSeconds() < 10 ? '0'+date.getSeconds() : date.getSeconds();
    return timestamp;
}

function jid(hash) {
    return hash.user+"@"+hash.domain+"/"+hash.resource;
}

var bare_jid= function(jid) {
    return jid.split('/')[0];
};

function isEmpty(ob){
    for(var i in ob){ return false;}
    return true;
}

function removeNL(s){
    return s.replace(/[\n\r\t]/g,"");
}

var StanzaToJSTransform= {};
/*
 * StanzaToJSTransform.roster
 *
 */
StanzaToJSTransform.roster= function(jQ_stanza) {
    var to= jQ_stanza.attr('to');
    var jQ_roster_items= jQ_stanza.find("item[subscription!=none]");
    // jQuery fails for attributes with colons gr:t
    var roster= {roster:{to:to,blist:[],contacts:{}}};
    jQ_roster_items.each(function() {
	if(jQuery(this).attr('gr:t') == 'B') {
	    return true;
	}
	var name= this.attributes.getNamedItem('name') ? this.attributes.getNamedItem('name').value : jQuery(this).attr('jid');
	roster.roster.blist.push({jid:jQuery(this).attr('jid'), name:name});
	roster.roster.contacts[jQuery(this).attr('jid')]= {};
	roster.roster.contacts[jQuery(this).attr('jid')]['name']= name;
	roster.roster.contacts[jQuery(this).attr('jid')]['photo']= '';
    });
    roster.roster.blist.sort(function(a,b) {
	var al=a.name.toLowerCase(),bl=b.name.toLowerCase();
	return al==bl?(a.name==b.name?0:a.name<b.name?-1:1):al<bl?-1:1;
    });
    return roster;
};

StanzaToJSTransform.presence= function(jQ_stanza) {
    var show= jQ_stanza.find("show");
    var status= "available";
    if (jQ_stanza.attr("type") == "unavailable") {
	status= "offline";
    }
    // console.log(stanza.toString());
    if (show.length > 0) {
	show= show.text();
	if (show == "away") {
	    status= "idle";
	} else if (show == "xa" || show == "dnd") {
	    status= "busy";
	} else {
	    console.log("Unknown status:"+status);
	}
    }    

    return {presence:{from:jQ_stanza.attr('from'),status:status,message:jQ_stanza.find('status').text()}};
};

StanzaToJSTransform.vcard= function(jQ_stanza) {
    var jQ_vCard= jQ_stanza.find("vCard");
    var from= jQ_stanza.attr('from');
    var name= jQ_vCard.find("FN").text();
    var vcard= {
	from: from,
	name: name
    };
    
    var $photo= jQ_vCard.find("PHOTO BINVAL");
    if ($photo.length > 0) {
	var buffer= new Buffer($photo.text(), 'base64');
	var type= jQ_vCard.find("PHOTO TYPE").text().split('/')[1];
	var thumb_path= "/images/buddies/"+from+"/"+from+"-small."+type;
	vcard.photo= {
	    data: buffer,
	    type: type,
	    path: thumb_path
	};
    }

    return vcard;
};

var JSToStanzaTransform= {};
JSToStanzaTransform.to_message= function(message) {
    var body_el= new xmpp.Element('body').t(removeNL(message.message.body));
    var msg= new xmpp.Element('message', {to:message.message.to, from:message.from, type:'chat'});
    msg.cnode(body_el);
    return msg;
};

function XmppProxy() {
    EventEmitter.call(this);
    var self= this;

    this.session = new xmpp.Client(this.config);

    this.o_transform= StanzaToJSTransform;
    this.i_transform= JSToStanzaTransform;

    this.session.on('online', function(data) {online.call(self, data)});
    this.session.on('stanza', function(data) {onStanza.call(self, data)});
    this.session.on('error', function(data) {error.call(self, data)});

    this.on('session', function(session) {
	this.jid= jid(this.session.jid);
    });

    this.on('roster', function(roster) {
	roster.roster.blist.forEach(function(buddy) {
	    self.request_vcard(buddy.jid);
	});
	console.log("["+timestamp()+"] roster");
    });
}
sys.inherits(XmppProxy, EventEmitter);

/* *************************
 *
 * PRIVATE METHODS
 *
 * *************************/

/*
 * wrap_sid
 *
 */
function wrap_message(data) {
    jQuery.extend(data, {to:this.jid,service:this.service});
};

function online(data) {
    console.log("online");
    // this.request_roster();
    // Emit session event
    this.emit('session', {session: {jid: jid(this.session.jid)}});
}

function onStanza(stanza) {
    // Transform stanza to jQuery object
    var jQ_stanza= jQuery(stanza.toString());
    if (stanza.is('message') &&	stanza.attrs.type !== 'error') {
	this.receive_message(jQ_stanza);
    } else if(stanza.is('presence')) {
	this.receive_presence(jQ_stanza);
    } else if(stanza.is('iq')) {
	receive_iq.call(this, jQ_stanza);
    }
}

function error(data) {
}

/*
 * receive_iq
 *
 */
function receive_iq(jQ_stanza) {
    var jQ_roster= jQ_stanza.find("query[xmlns='jabber:iq:roster']");

    if (jQ_roster.length > 0) {
    	var roster= this.o_transform.roster(jQ_stanza);
    	// this._finish_roster(roster);
    	wrap_message.call(this, roster);
    	this.emit('roster',roster);
    }

    var jQ_vCard= jQ_stanza.find("vCard");
    if (jQ_vCard.length > 0) {
    	var vcard= this.o_transform.vcard(jQ_stanza);
	var photo_buffer= vcard.buffer;	
    	wrap_message.call(this, vcard);
    	this.emit('vCard', vcard);
    }
};

/* *************************
 *
 * PUBLIC METHODS
 *
 * *************************/
XmppProxy.prototype.send= function(message) {
    if (message.message) {
	this.send_message(message);
    }
}


XmppProxy.prototype.send_message= function(message) {
    var msg= this.i_transform.to_message(message);
    console.log(msg.toString());
    this.session.send(msg);
};

/*
 * request_roster
 *
 */
XmppProxy.prototype.request_roster= function() {    
    var iq_roster= new xmpp.Element('iq', {type: 'get'});
    var query_roster= new xmpp.Element('query', {xmlns:'jabber:iq:roster'});
    iq_roster.cnode(query_roster);
    this.session.send(iq_roster);
};

/*
 * request_vcard
 *
 */
XmppProxy.prototype.request_vcard= function(to) {
    var iq_vCard= new xmpp.Element('iq', {type:'get', id:'vc2', to:to});
    var vCard= new xmpp.Element('vCard', {xmlns:'vcard-temp'});
    iq_vCard.cnode(vCard);
    this.session.send(iq_vCard);
};


/*
 * receive_presence
 *
 */
XmppProxy.prototype.receive_presence= function(jQ_stanza) {
    console.log("received presence");
    var presence= this.o_transform.presence(jQ_stanza);
    wrap_message.call(this, presence);
    this.emit('presence',presence);
};

/*
 * send_presence
 *
 */
XmppProxy.prototype.send_presence= function() {
    this.session.send(new xmpp.Element('presence'));
};

/*
 * receive_message
 *
 */
XmppProxy.prototype.receive_message= function(stanza) {
    var to= stanza.attr('to');
    var from= stanza.attr('from');
    var message= {message:{from:from},to:to,sid:this.sid,service:this.service};
    
    stanza.children().each(function() {
    	// Buddy is composing (typing) a message
    	if (this.tagName.toLowerCase() == 'cha:composing') {
    	    message.message['state']= 'composing';
    	} 
    	// Buddy has entered text
    	else if (this.tagName.toLowerCase() == 'cha:paused') {
    	    message.message['state']= 'paused';
    	}
    });
    
    if (stanza.find('body').length > 0) {
    	message.message['body']= stanza.find("body").text();
    }
    this.emit('message', message);
};


function FacebookClient(c) {
    this.service= 'facebook';
    this.config= {
	jid: c.jid,
	host: 'chat.facebook.com',
	api_key: api_key,
	secret_key: secret_key,
	session_key: c.session_key
    };
    XmppProxy.call(this);
}
sys.inherits(FacebookClient, XmppProxy);

function GtalkClient(c) {
    this.service= 'gtalk';
    this.config= {
	jid: c.jid,
	password: c.password
    };
    XmppProxy.call(this);
}
sys.inherits(GtalkClient, XmppProxy);

GtalkClient.prototype.request_roster= function() {
    var iq_roster= new xmpp.Element('iq', {type: 'get', id:'google-roster-1'});
    var query_roster= new xmpp.Element('query', {xmlns:'jabber:iq:roster', "xmlns:gr":'google:roster', "gr:ext":'2'});
    iq_roster.cnode(query_roster);
    this.session.send(iq_roster);
};


module.exports.FacebookClient= FacebookClient;
module.exports.GtalkClient= GtalkClient;
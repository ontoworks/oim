var sys = require('sys');
var fs = require('fs');
var xmpp = require('node-xmpp');
var net = require('net');
var jQuery= require('jquery');
var htmlparser= require('htmlparser');
var EventEmitter = require('events').EventEmitter;
var im= require('imagemagick');
var path= require('path');

var FacebookChat= require('facebook').FacebookChat;

// var app = module.parent.exports;
var app={}; app.__dirname= "/Users/santiago/Projects/ontoworks/ontoim/app";

function removeNL(s){
    return s.replace(/[\n\r\t]/g,"");
}

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



var StanzaToJSTransform= {};
/*
 * StanzaToJSTransform.roster
 *
 */
StanzaToJSTransform.roster= function(jQ_stanza) {
    var to= jQ_stanza.attr('to');
    var jQ_roster_items= jQ_stanza.find("item[subscription!=none]");
    // jQuery fails for attributes with colons gr:t
    var roster= {roster:{to:to,blist:[],contacts:{}}, to: to};
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
};

var JSToStanzaTransform= {};
JSToStanzaTransform.to_message= function(message) {
    var body_el= new xmpp.Element('body').t(removeNL(message.message.body));
    var msg= new xmpp.Element('message', {to:message.to, from:message.message.from, type:'chat'});
    msg.cnode(body_el);
    return msg;
};

function XmppClient(c, sid) {
    console.log("["+timestamp()+"] starting");
    console.log(c);
    console.log(sid);
    EventEmitter.call(this);
    var self= this;
    this.sid= sid;
    this.service= c['service'];
    this.session= new xmpp.Client(c);
    this.session.on('online', function(data) {self._online(data)});
    this.session.on('stanza', function(data) {self._stanza(data)});
    this.session.on('error', function(data) {self._error(data)});

    this.o_transform= StanzaToJSTransform;
    this.i_transform= JSToStanzaTransform;

    this.on('session', function(session) {
	this.jid= jid(this.session.jid);
    });

    this.on('presence', function(presence) {
	console.log("["+timestamp()+"] presence from:"+presence.presence.from);
    });

    this.on('final_roster', function(roster) {
	console.log("["+timestamp()+"] final roster");
    });

    this.on('roster', function(roster) {
	this.send_presence();
	// this.populate_roster_from_vcard(roster);
	console.log("["+timestamp()+"] roster");
    });

    this.on('vcard_photo', function(vcard_photo) {
	this._final_roster.roster.contacts[vcard_photo.from].photo= vcard_photo.photo;
	delete this._tmp_roster.roster.contacts[vcard_photo.from];
	// Emit roster event after every vCard has been received
	if (isEmpty(this._tmp_roster.roster.contacts)) {
	    this._tmp_roster= undefined;
	    this.emit('final_roster', this._final_roster);
	}
    });
};
sys.inherits(XmppClient, EventEmitter);

/*
 * request_roster
 *
 */
XmppClient.prototype.request_roster= function() {
    var iq_roster= new xmpp.Element('iq', {type: 'get', id:'google-roster-1'});
    var query_roster= new xmpp.Element('query', {xmlns:'jabber:iq:roster', "xmlns:gr":'google:roster', "gr:ext":'2'});
    iq_roster.cnode(query_roster);
    this.session.send(iq_roster);
};

/*
 * populate_roster_from_vcard
 *
 */
XmppClient.prototype.populate_roster_from_vcard= function(jQ_stanza) {
    var self= this;

    var jQ_vCard= jQ_stanza.find("vCard");
    var from= jQ_stanza.attr('from');
    if (this._tmp_roster.roster.contacts[from]) {
	var $photo= jQ_vCard.find("PHOTO BINVAL");
	var thumb_path= "";
	if ($photo.length > 0) {
	    var buffer= new Buffer($photo.text(), 'base64');
	    var type= jQ_vCard.find("PHOTO TYPE").text().split('/')[1];
	    var path_dir= app.__dirname+"/public"+"/images/buddies/"+from+"/";
	    thumb_path= "/images/buddies/"+from+"/"+from+"-small."+type;
	    path.exists(path_dir, function(exists) {
		if (!exists) {
		    var as_is_filename= path_dir+from+"."+type;
		    var medium_filename= path_dir+from+"-medium."+type;
		    var small_filename= path_dir+from+"-small."+type;
		    fs.mkdirSync(path_dir, 0755);

		    fs.open(as_is_filename, "w", function(err, fd) {
			fs.write(fd, buffer, 0, buffer.length, null, function(err, written) {
			    if (err) throw err;
			    im.resize({srcPath:as_is_filename, dstPath:medium_filename, width: 40, height: 40}, function(err) {
				if (err) throw err;
			    });
			    im.resize({srcPath:as_is_filename, dstPath:small_filename, width: 20, height: 20}, function(err) {
				if (err) throw err;
			    });
			});
		    });
		}
	    });
	}
	self.emit('vcard_photo', {from:from, photo:thumb_path});
    }
};

/*
 * request_vcard
 *
 */
XmppClient.prototype.request_vcard= function(to) {
    // console.log("request vCard to:"+to);
    var iq_vCard= new xmpp.Element('iq', {type:'get', id:'vc2', to:to});
    var vCard= new xmpp.Element('vCard', {xmlns:'vcard-temp'});
    iq_vCard.cnode(vCard);
    this.session.send(iq_vCard);
};

/*
 * send_presence
 *
 */
XmppClient.prototype.send_presence= function() {
    this.session.send(new xmpp.Element('presence'));
};

/*
 * send_message
 *
 */
XmppClient.prototype.send_message= function(message) {
    var msg= this.i_transform.to_message(message);
    // console.log(msg.toString());
    this.session.send(msg);
};

/*
 * receive_message
 *
 */
XmppClient.prototype.receive_message= function(stanza) {
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

/*
 * receive_presence
 *
 */
XmppClient.prototype.receive_presence= function(jQ_stanza) {
    var presence= this.o_transform.presence(jQ_stanza);
    this._wrap_sid(presence);
    this.emit('presence',presence);
};

/*
 * receive_iq
 *
 */
XmppClient.prototype.receive_iq= function(jQ_stanza) {
    var jQ_roster= jQ_stanza.find("query[xmlns='jabber:iq:roster']");
    if (jQ_roster.length > 0) {
	var roster= this.o_transform.roster(jQ_stanza);
	this._finish_roster(roster);
	this._wrap_sid(roster);
	this.emit('roster',roster);
    }

    var jQ_vCard= jQ_stanza.find("vCard");
    if (jQ_vCard.length > 0) {
	// console.log("vcard from: "+jQ_stanza.attr('from'));
	// console.log("received vcard from:"+jQ_stanza.attr('from'));
	if (this._tmp_roster) {
	    this.populate_roster_from_vcard(jQ_stanza);
	} else {
	    console.log("received wrong vcard from:"+jQ_stanza.attr('from'));
	    var vcard= this.o_transform.vcard(jQ_stanza);
	    this.emit('vcard', vcard);
	}
    }
};

/*
 * _finish_roster
 *
 */
XmppClient.prototype._finish_roster= function(roster) {
    var self= this;
    this._tmp_roster= {};
    jQuery.extend(true, this._tmp_roster, roster);
    this._final_roster= {};
    jQuery.extend(true, this._final_roster, roster);

    roster.roster.blist.forEach(function(e) {
	// console.log(e.jid);
	self.request_vcard(e.jid);
    });
};

/*
 * _wrap_sid
 *
 */
XmppClient.prototype._wrap_sid= function(data) {
    jQuery.extend(data, {to:this.to,sid:this.sid,service:this.service});
};

/*
 * _online
 *
 */
XmppClient.prototype._online= function(data) {
    this.request_roster();
    // Emit session event
    this.emit('session', {session: {jid: this.session.jid}, sid: this.sid});
};

/*
 * _error
 *
 */
XmppClient.prototype._error= function(error) {
    console.log(error);
};

/*
 * _stanza
 *
 */
XmppClient.prototype._stanza= function(stanza) {
    // Transform stanza to jQuery object
    var jQ_stanza= jQuery(stanza.toString());
    // console.log(stanza.toString());
    if (stanza.is('message') &&	stanza.attrs.type !== 'error') {
	this.receive_message(jQ_stanza);
    } else if(stanza.is('presence')) {
	this.receive_presence(jQ_stanza);
    } else if(stanza.is('iq')) {
	var jQ_vCard= jQ_stanza.find("vCard");
	if (jQ_vCard.length > 0) {
	    console.log("received vcard from: "+jQ_stanza.attr('from'));
	}
	this.receive_iq(jQ_stanza);
    }
};


module.exports.XmppClient= XmppClient;

var c= {session: { jid: 'sgaviria@gmail.com',
	 password: 'S4ntiag0',
	 host: 'talk.google.com',
	 port: 5222,
	 service: 'gtalk'
       }
	, sid: 123};


// var GmailClient= new XmppClient(c.session, c.sid);
// GmailClient.on('session', function(data) {
//     // console.log(data);
// });

// GmailClient.on('message', function(message) {
//     var addr= {message:{from:this.jid}, to:message.message.from};
//     jQuery.extend(true, message, addr);
//     var msg= message;
//     this.send_message(msg);
// });

// GmailClient.on('roster', function(roster) {
//     // console.log(roster);
// });

// function XmppClient(c) {
//     xmpp.Client.call(this);
//     this.addListener('online', this.online);
// };
// sys.inherits(XmppClient, xmpp.Client);

function ConnectionManager() {
    console.log("ConnectionManager");
    this.sessions= {};
}

ConnectionManager.prototype.open_session= function(message) {
    message.session.service= 'gtalk';
    var session= new XmppClient(message.session, message.sid);
};

ConnectionManager.prototype.get_session= function(user) {
};

ConnectionManager.prototype.create_session= function(message) {
};

ConnectionManager.prototype.delete_session= function(user) {
};

ConnectionManager.prototype.process_message= function(message) {
    // console.log(message);
    try {
	message= JSON.parse(message);
    } catch(err) {
	console.log("Can't parse JSON");
    }

    if (message.session) {
	var session= new XmppClient(message.session, message.sid);
	this.open_session(message);
    }
};

module.exports.ConnectionManager= ConnectionManager;

// var cm= new ConnectionManager();
// cm.open_session(c);

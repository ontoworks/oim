var sys = require('sys');
var fs = require('fs');
var xmpp = require('node-xmpp');
var net = require('net');
var jQuery= require('jquery');
var htmlparser= require('htmlparser');
var EventEmitter = require('events').EventEmitter;
var im= require('imagemagick');
var path= require('path');

var app = module.parent.exports;

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

bare_jid= function(jid) {
    return jid.split('/')[0];
};

var ConnectionManager= function() {
    EventEmitter.call(this);

    var sessions= {};
    var self= this;

    this.add_session= function(sid, session) {
	sessions[sid]= session;
    };

    this.get_session= function(sid) {
	return sessions[sid];
    };

    var server= net.createServer(function (stream) {
	stream.setEncoding('utf8');
	
	stream.on('connect', function () {
	    stream.write('hello\r\n');
	});
	
	stream.on('data', function (data) {
	    data= removeNL(data);
	    var request;
	    try {
		request= JSON.parse(data);
	    } catch(err) {
		stream.write(error);
	    }
	    if (!request) return 0;

	    var sid= request.sid;
	    var session= self.get_session(sid);

	    // Open XMPP persistent client connection
	    if(sid) {
		if (request.session) {
		    var session = new xmpp.Client(request.session);
		    session.on('online', function() {
			console.log('online');
			self.add_session(sid, session);

			// request for roster
			var iq_roster= new xmpp.Element('iq', {type: 'get', id:'google-roster-1'});
			var query_roster= new xmpp.Element('query', {xmlns:'jabber:iq:roster', "xmlns:gr":'google:roster', "gr:ext":'2'});
			iq_roster.cnode(query_roster);
			session.send(iq_roster);
			var _session= {session: {jid: session.jid}, sid: sid};
			stream.write(JSON.stringify(_session));
		    });
		    
		    session.on('stanza', function(stanza) {
			var str_stanza= stanza.toString();
			var jQ_stanza= jQuery(str_stanza);

			var stanza_type;
			var to= jid(session.jid);
			if (stanza.is('message') &&
			    // Important: never reply to errors!
			    stanza.attrs.type !== 'error') {
			    stanza_type= "message";
			    // Swap addresses...
			    stanza.attrs.to = stanza.attrs.from;
			    delete stanza.attrs.from;
			    // and send back.
			    session.send(stanza);
			} else if(stanza.is('presence')) {
			    stanza_type= "presence";
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

			    // Check for photo. Send presence after checking for photo.
			    // There should be another way to do this
			    var from= bare_jid(jQ_stanza.attr('from'));
			    var photo_dir_path= app.__dirname+"/public/images/buddies/"+from+"/";
			    var photo_path= "";
			    path.exists(photo_dir_path, function(exists) {
				if (exists) {
				    var files= fs.readdirSync(photo_dir_path);
				    files.forEach(function(v) {
					var m= v.match("-small");
					if (m) {
					    photo_path= "/images/buddies/"+from+"/"+m.input;
					}
				    });
				} else {
				    // request vcard for each buddy
				    var iq_vCard= new xmpp.Element('iq', {type: 'get', id:'vc2', to: from});
				    var vCard= new xmpp.Element('vCard', {xmlns:'vcard-temp'});
				    iq_vCard.cnode(vCard);
				    session.send(iq_vCard);
				}
				// I don't like doing this within this callback
				// but what else can I do ... to emit an event?
				var presence= {presence:{from:jQ_stanza.attr('from'),status:status,message:jQ_stanza.find('status').text(),photo:photo_path},to:to,sid:sid,service:'gtalk'};
				console.log(presence);
				stream.write(JSON.stringify(presence));
			    });
			} else if(stanza.is('iq')) {
			    stanza_type= "iq";

			    // Roster coming
			    var jQ_roster= jQ_stanza.find("query[xmlns='jabber:iq:roster']");
			    if (jQ_roster.length > 0) {
				var jQ_roster_items= jQ_stanza.find("item[subscription!=none]");
				// jQuery fails for attributes with colons gr:t
				var roster= {roster:{to:to,blist:[],contacts:{}},to:to,sid:sid,service:'gtalk'};
				jQ_roster_items.each(function() {
				    if(jQuery(this).attr('gr:t') == 'B') {
					return true;
				    }
				    var name= this.attributes.getNamedItem('name') ? this.attributes.getNamedItem('name').value : jQuery(this).attr('jid');
				    roster.roster.blist.push({jid:jQuery(this).attr('jid'), name:name});
				    roster.roster.contacts[jQuery(this).attr('jid')]= {};
				    roster.roster.contacts[jQuery(this).attr('jid')]['name']= name;
				});
				roster.roster.blist.sort(function(a,b) {
				    var al=a.name.toLowerCase(),bl=b.name.toLowerCase();
				    return al==bl?(a.name==b.name?0:a.name<b.name?-1:1):al<bl?-1:1;
				});
				// console.log(JSON.stringify(roster));
				stream.write(JSON.stringify(roster));
				// send presence only after roster has been received
				session.send(new xmpp.Element('presence'));
			    } // roster coming

			    // vCard coming
			    var jQ_vCard= jQ_stanza.find("vCard");
			    if (jQ_vCard.length > 0) {
				var from= bare_jid(jQ_stanza.attr('from'));
				var $photo= jQ_vCard.find("PHOTO BINVAL");
				if ($photo.length > 0) {
				    var buffer= new Buffer($photo.text(), 'base64');
				    var type= jQ_vCard.find("PHOTO TYPE").text().split('/')[1];
				    var path_dir= app.__dirname+"/public/images/buddies/"+from+"/";
				    path.exists(path_dir, function(exists) {
					if (!exists) {
					    fs.mkdirSync(path_dir, 0755);
					}
					var as_is_filename= path_dir+from+"."+type;
					var medium_filename= path_dir+from+"-medium."+type;
					var small_filename= path_dir+from+"-small."+type;
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
				    });
				}
			    } // vCard coming
			} else {
			    stream.write(stanza.toString());
			}
			
			console.log("["+timestamp()+"] "+stanza_type);
		    });
		} // ends request.session
		else { 
		    if (request.message) {
			// session.send("");
			stream.write(request.message.content);
		    } else if (request.presence) {
			var session= self.get_session(sid);
			session.send(new xmpp.Element('presence'));
		    } else if (request.iq) {
		    }
		}
	    } else {
		stream.write("what?\n");
	    }
	});
	
	stream.on('end', function () {
	    stream.write('goodbye\r\n');
	    stream.end();
	});
    });
    server.listen(8124, 'localhost');
};

sys.inherits(ConnectionManager, EventEmitter);

module.exports.ConnectionManager= ConnectionManager;
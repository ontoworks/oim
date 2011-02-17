var host="@neohomerico.local";

function removeNL(s){
  return s.replace(/[\n\r\t]/g," ");
}

// window.onbeforeunload = confirmExit;
// function confirmExit()
// {
//     return true;
//     // return "You have attempted to leave this page.  If you have made any changes to the fields without clicking the Save button, your changes will be lost.  Are you sure you want to exit this page?";
// }

$(window).unload(function() {
    $("#login").connection_manager("disconnect");
});

/** 
 * @widget: Connection Manager
 * @returns:
 * @author: Santiago Gaviria
 * @version:
 * @requires:
 */
$.widget("ui.connection_manager", {
    _init: function() {
	var self= this;
	var $el= this.element;
	var BOSH_SERVICE= "/bosh";
	this.connection= new Strophe.Connection(BOSH_SERVICE);

	function xmlInput(elem) {
	    // Receives authorization request
	    $(elem).find("presence[type='subscribe']").each(function() {
		var from= $(elem).find("presence[type]").attr('from');
		var to= $(elem).find("presence[type]").attr('to');

		// Auto subscribe when gets a presence request
		var subscribed = $pres({xmlns: Strophe.NS.CLIENT, to: from, from: to, type: 'subscribed'}).tree();
		self.connection.send(subscribed);
		var subscribe = $pres({xmlns: Strophe.NS.CLIENT, to: from, from: to, type: 'subscribe'}).tree();
		self.connection.send(subscribe);
	    });
	}
	this.connection.xmlInput= xmlInput;

	// Callback called once connected
	function onConnect(status) {
	    self._update_status(status);
	}
	
	// click on "connect" btn to start connecting
	$("#connect").click(function(e) {
	    var jid= $el.find("#jid").val();
	    var password= $el.find("#pass").val();
	    self.connection.connect(jid, password, onConnect);
	    e.preventDefault();
	});

	$("#connection-manager select").change(function(e) {
	    var value= $(this).val();
	    var from= self.connection.jid;
	    var pres= $pres({xmlns:Strophe.NS.CLIENT, from: from});

	    if (value == 'online') {
	    } else if (value == 'busy') {
		var show_el= $build("show");
		show_el.t("xa");
		pres.cnode(show_el.tree());
	    } else if (value == 'invisible') {
	    } else if (value == 'offline') {
		self.disconnect();
		return true;
	    }
	    self.connection.send(pres.tree());
	});
    }, // init
    _update_status: function(status) {
	var self= this;

	if (status == Strophe.Status.CONNECTING) {
	    // mask Login
	} else if (status == Strophe.Status.CONNFAIL) {
	} else if (status == Strophe.Status.DISCONNECTING) {
	    // mask Connection Manager
	} else if (status == Strophe.Status.DISCONNECTED) {
	    // Change state of Connection Manager in UI
	    $("#login").show();
	    $("#connection-manager").hide();
	} else if (status == Strophe.Status.CONNECTED) {
	    // Broadcast presence
	    self.connection.send($pres({xmlns:Strophe.NS.CLIENT}).tree());
	    
	    var jid= self.connection.jid;
	    
	    // Contact List
	    $("#contacts-list").show()
		.buddy_list({user_jid:jid, connection:self.connection});
	    
	    // Sessions Manager
	    $("#sessions").sessions_manager({jid:jid, connection:self.connection});

	    // Opens or goes to the corresponding session when clicking on contact
	    $("#contacts-list").bind('open_session', function(e, jid) {
		$("#sessions").sessions_manager('open_session', jid);
	    });
	    
	    // Change state of Connection Manager in UI
	    $("#login").hide();
	    $("#connection-manager")
		.show()
		.find(".connection .label").text(Strophe.getBareJidFromJid(self.connection.jid));
	    self._update_status({state: 'online'});
	} 
	// When what's updated is presence (not connection) state
	else if (status.state) {
	    $("#connection-manager .connection .status")
		.removeClass()
		.addClass("status")
		.addClass(status.state);
	}
    },
    disconnect: function() {
	this.connection.disconnect();
    }
});

/** 
 * @widget: Buddy List
 * @returns:
 * @author:
 * @version:
 * @requires:
 */
$.widget("ui.buddy_list", {
    _init: function() {
	this.connection= this.options.connection;
	
	var self= this;
	this._contacts= {
	    available:[],
	    busy:[],
	    unavailable:[],
	    contacts:{}
	};
	this.bare_jid= Strophe.getBareJidFromJid(this.connection.jid);

	// send presence
	this.connection.send($pres({xmlns:Strophe.NS.CLIENT}).tree());
	
	function onRoster(elem) {
	    var contacts_list= [];
	    $(elem).find("query[xmlns='jabber:iq:roster'] item").each(function() {
		var jid= $(this).attr("jid");
		self._contacts['unavailable'].push(Strophe.getBareJidFromJid(jid));
	    });
	    self._contacts['unavailable'].sort();
	    self._render_roster();
	    return true;
	}
	
	function onPresence(elem) {
	    var next_elem= elem;
	    var show= $(elem).find("show").text();
	    var status= $(elem).attr("type")||'available';
	    var from= $(elem).attr("from");
	    var jid= Strophe.getBareJidFromJid(from);
	    if (show) {
		// console.log(show);
		if (show == 'xa') {
		    status= 'busy';
		}
	    }
	    if (jid!=self.bare_jid) {
		self._update_buddy({jid: jid, status: status, show: show});
	    }
	    return true;
	}

	this.connection.addHandler(onPresence, null, 'presence', null, null, null);
	this.connection.addHandler(onRoster, Strophe.NS.ROSTER, 'iq', null, null, null);

	// request for roster
	var iq_roster= $iq({type:"get"});
	var query_roster=  $build("query", {xmlns:Strophe.NS.ROSTER});
	iq_roster.cnode(query_roster.tree());
	this.connection.send(iq_roster);
    },
    _call_session: function(jid) {
	this.element.trigger("open_session", jid);
    },
    _update_buddy: function(contact) {
	var $el= this.element;
	var self= this;
	var screen_name= Strophe.getNodeFromJid(contact.jid);
	var status= contact.status;
	if (status=='available') status = 'online';
	if (status=='unavailable') status = 'offline';

	var contacts_list= [];

	var $contact_item= $el.find(".contact-item[jid="+contact.jid+"]");

	// clear current status
	$contact_item.find(".status")
	    .removeClass()
	    .addClass("status");

	$el.find(".contacts-"+status+" .contact-item").not(".layout").each(function() {
	    contacts_list.push($(this).attr('jid'));
	});

	contacts_list.sort();

	// $contact_item.find(".status").addClass(status);
	var next;
	$(contacts_list).each(function(i,v) {
	    if (contact.jid <= v) {		
		next= v;
		return false;
	    }
	});
	if (next) {
	    $el.find(".contacts-"+status+" .contact-item[jid="+next+"]").before($contact_item);
	} else {
	    $el.find(".contacts-"+status+" ul").append($contact_item);
	}	
    },
    _render_roster: function() {
	var self= this;
	$(self._contacts['unavailable']).each(function() {
	    self._add_contact({jid:this, status:'unavailable'});
	});
    },
    _add_contact: function(contact) {
	var self= this;
	var $el= this.element;
	var $contact_item= $el.find("li.contact-item.layout").clone();
	var screen_name= Strophe.getNodeFromJid(contact.jid);
	
	$contact_item
	    .removeClass("layout")
	    .find("a .label").text(screen_name)
	    .end()
	    .attr("jid", contact.jid);
	// adds click event to open a session with this
	// contact
	$contact_item.find("a").click(function(e) {
	    $(this).blur();
	    self._call_session($(this).parent().attr("jid"));
	    e.preventDefault();
	});
	$el.find(".contacts-offline ul").append($contact_item);
    }
}); // buddy_list

/** 
 * @widget: Chat Sessions
 * @options: jid, connection
 * @returns:
 * @author: Santiago Gaviria
 * @version:
 * @requires: sessions_manager
 */
$.widget("ui.sessions_manager", {
    _init: function() {
	var self= this;
	this.connection= this.options.connection;

	var onChat= function(elem) {
	    var message= {
	    	from: Strophe.getBareJidFromJid($(elem).attr('from')),
	    	to: Strophe.getBareJidFromJid($(elem).attr('to')),
	    	type: $(elem).attr('type'),
	    	body: $(elem).find("body:first").text()
	    };
	    $.jGrowl(message.body,{header:message.from});
	    self._deliver_message(message);
	    return true;
	}
	this.connection.addHandler(onChat, null, 'message', null, null, null, null);
    },
    open_session: function(id) {
	var $el= this.element;
	var $session= this._find_session(id);
	if ($session) {
	    this._hide_sessions();
	    $session.show();
	    $el.find("#sessions-nav .session").removeClass("open");
	    $el.find("#sessions-nav .session[jid='"+id+"']").addClass("open");
	} else {
	    this._add_session(id);
	    this.open_session(id);
	}
    },
    _add_session: function(from) {
	var $el= this.element;
	var session= $el.find("#sessions-windows .session-window.chat.layout").clone();
	session
	    .attr("id", from)
	    .attr("jid", from)
	    .removeClass("layout")
	    .hide()
	    .session_window({connection: this.connection});
	$el.find("#sessions-windows").append(session);
	var $nav_item= $el.find("#sessions-nav .session.layout").clone();
	$nav_item
	    .attr('jid', from)
	    .removeClass('layout').find("a").text(Strophe.getNodeFromJid(from));
	$el.find("#sessions-nav ul").append($nav_item);
	// open session if only one (first)
	if ($el.find(".session-window[jid]").length == 1) {
	    this.open_session(from);
	}
    },
    _find_session: function(from) {
	var $el= this.element;
	var session= $el.find(".session-window[jid='"+from+"']");
	if ($el.find(".session-window[jid='"+from+"']").length == 0) session= null;
	return session;
    },
    // Delivers messages incoming thru the connection to the corresponding session
    _deliver_message: function(msg) {
	if (!this._find_session(msg.from)) {
	    this._add_session(msg.from);
	}
	this._find_session(msg.from).session_window("render_message", msg);
    },
    _hide_sessions: function() {
	var $el= this.element;
	$el.find(".session-window:visible").hide();
    },
    _show_session: function(jid) {
	this._find_session(jid).show();
    }
});

/** 
 * @widget: Chat Session
 * @returns:
 * @author: Santiago Gaviria
 * @version:
 * @requires:
 */
$.widget("ui.session_window", {
    _init: function() {
	var $el= this.element;
	var self= this;

	this.connection= this.options.connection;

	$el.find(".send-message textarea").keyup(function(e) {
	    if (e.keyCode == 13) {
		self._send_message();
	    }
	});
	
	$el.find(".send-message a").click(function(e) {
	    self._send_message();
	    e.preventDefault();
	});
    },
    render_message: function(msg, sent) {
	var $el= this.element;
	var $msg= $el.find(".chat-message.layout").clone();

	$msg.removeClass("layout");
	$msg.find(".message-content .contact-name .label").text(msg.from);
	$msg.find(".message-content .text").text(msg.body);
	if (sent) $msg.addClass("to");

	$el.find(".messages").append($msg);
    },
    _send_message: function() {
	var $el= this.element;
	var msg= $el.find(".send-message textarea").val();
	var message= {
	    to: Strophe.getBareJidFromJid($el.attr("id")),
	    from: Strophe.getBareJidFromJid(this.connection.jid),
	    body: msg
	};

	var body_el= $build("body");
	body_el.t(removeNL(msg));
	var message_stanza = $msg({to: message.to, from: message.from, type: 'chat'})
	    .cnode(body_el.tree());
	this.connection.send(message_stanza.tree());
	this.render_message(message, true);
	$el.find(".send-message textarea").val("");
    }
});

jQuery(window).ready(function($) {
    $("#login").connection_manager();
});

var socket;
var session;

function truncate(el, len) {
    len = len || 200;
    if (el) {
	var trunc = el.innerHTML;
	if (trunc.length > len) {

	    /* Truncate the content of the P, then go back to the end of the
	       previous word to ensure that we don't truncate in the middle of
	       a word */
	    trunc = trunc.substring(0, len);
	    // trunc = trunc.replace(/\w+$/, '');
	    
	    /* Add an ellipses to the end and make it a link that expands
	       the paragraph back to its original size */
	    trunc += '...';
	    el.innerHTML = trunc;
	}
    }
}

var JID= {};
JID.bare= function(jid) {
    return jid.split('/')[0];
};

$.widget('ui.connection_manager', {
    _init: function() {
    },
    update_self: function(me) {
	// console.log(me);
	var $el= this.element;
	var medium_photo= me.presence.photo ? me.presence.photo.medium||'' : '';
	$el.find(".photo img").attr("src", medium_photo);
	$el.find(".message").text(me.presence.message);
	$el.find(".status-icon").removeClass("offline available idle busy").addClass(me.presence.status);
    },
    update_name: function(name) {
	this.element.find(".my-info .name").text(name);
    }
});

$.widget('ui.buddy_list', {
    _init: function() {
	this.element.find(".layout").hide();
	this.user= this.options.user;
    },
    update_buddy: function(buddy) {
	// console.log("update buddy");
	var $el= this.element;
	var self= this;
	var status= buddy.presence.status;
	// console.log(JID.bare(buddy.presence.from));
	var $buddy_item= $el.find(".buddy-item[id="+JID.bare(buddy.presence.from)+"]");

	// return if no status change is needed
	if ($buddy_item.hasClass(status)) {
	    return false;
	}

	$buddy_item.removeClass("offline available idle busy").addClass(status);
	if (buddy.presence.message) {
	    $buddy_item.removeClass("alone");
	    $buddy_item.find(".buddy-info .message").text(buddy.presence.message);
	    truncate($buddy_item.find(".buddy-info .message").get(0), 28);
	} else {
	    $buddy_item.addClass("alone");
	}

	var small_photo= buddy.presence.photo ? buddy.presence.photo.small||'' : '';
	var medium_photo= buddy.presence.photo ? buddy.presence.photo.medium||'' : '';
	$buddy_item.find(".buddy-photo").attr("src", small_photo);
	$buddy_item.append($("<input class='buddy-photo-medium' type='hidden' value='"+medium_photo+"'/>"));

	this._update_blist($buddy_item, buddy.service, status);
    },
    // Updates a buddy-list qualified by group and status
    // for a new buddy-item
    _update_blist: function($buddy_item, group, status) {
	var $el= this.element;
	// sort buddies alphabetically
	var contacts_list= [];
	$el.find(".buddy-list-section."+group+" .buddy-list."+status+" .buddy-item").not(".layout").each(function() {
	    var name= $(this).find(".name").text();
	    contacts_list.push(name);
	});

	contacts_list.sort(function(a,b) {
	    var al=a.toLowerCase(),bl=b.toLowerCase();
	    return al==bl?(a==b?0:a<b?-1:1):al<bl?-1:1;
	});

	var next;
	$(contacts_list).each(function(i,v) {
	    if ($buddy_item.find(".name").text().toLowerCase() < v.toLowerCase()) {		
		next= v;
		return false;
	    }
	});
	if (next) {
	    $el.find(".buddy-list-section."+group+" .buddy-list."+status+" .buddy-item:contains('"+next+"')").before($buddy_item);
	} else {
	    $el.find(".buddy-list-section."+group+" .buddy-list."+status).append($buddy_item);
	}

	// update evens and odds for online buddies
	// i think this could be slow if very long blist
	$el.find(".buddy-list-section."+group+" .buddy-list:not(.offline) .buddy-item:not(.layout):even")
	    .removeClass("even odd").addClass("odd");
	$el.find(".buddy-list-section."+group+" .buddy-list:not(.offline) .buddy-item:not(.layout):odd")
	    .removeClass("even odd").addClass("even");
	// update evens and odds for offline buddies
	$el.find(".buddy-list-section."+group+" .buddy-list.offline .buddy-item:even")
	    .removeClass("even odd").addClass("odd");
	$el.find(".buddy-list-section."+group+" .buddy-list.offline .buddy-item:odd")
	    .removeClass("even odd").addClass("even");
    },
    /*
      Renders buddy list
      - it should render odds and evens
     */
    load: function(roster) {
	var $el= this.element;
	var self= this;
	var service= roster.service;
	var $buddy_item_layout= $el.find(".buddy-list-section."+service+" .buddy-list.available .buddy-item.layout").clone();
	$buddy_item_layout.removeClass("layout even odd");
	$buddy_item_layout.find(".message").html("&nbsp;");
	for (var i=0; i<roster.roster.blist.length; i++) {
	    var buddy= roster.roster.blist[i];
	    var $buddy_item= $buddy_item_layout.clone();
	    var buddy_jid= buddy.jid;
	    $buddy_item.attr("id", buddy_jid);
	    $buddy_item.addClass((function(parity) { return (parity%2==0) ? 'even' : 'odd'})(i));
	    $buddy_item.find(".name").text(buddy.name);
	    truncate($buddy_item.find(".name").get(0), 26);
	    $buddy_item.dblclick((function(id, self) { 
		return function(e) {
		    self.buddy_to_chat_group(id);
		    self.element.trigger("open_session", {me:this._get_buddy(this.user),buddy:this._get_buddy(buddy_id)});
		    e.preventDefault();
		}
	    })(buddy.jid, self));
	    $el.find(".buddy-list-section."+service+" .buddy-list.offline").append($buddy_item.show());
	}
    },
    buddy_to_chat_group: function(buddy_id) {
	var $el= this.element;
	if ($el.find(".buddy-item[id=session-"+buddy_id+"]").length == 0) {
	    var $buddy_item= $el.find(".buddy-item[id="+buddy_id+"]").clone();
	    $buddy_item.attr("id", "session-"+buddy_id);
	    $buddy_item.unbind();
	    $buddy_item.click((function(id, self) {
		return function(e) {
		    self.element.trigger("open_session", {me:self._get_buddy(self._get_buddy(self.user)), buddy:self._get_buddy(id)});
		}
	    })(buddy_id, this));
	    this._update_blist($buddy_item.show(), "chat", "chat");
	}
    },
    _get_buddy: function(buddy_id) {
	var $el= this.element;
	var $buddy_item= $el.find(".buddy-item[id="+buddy_id+"]");
	var status= (function($b) {
	    if ($b.hasClass('available')) return 'available';
	    if ($b.hasClass('busy')) return 'busy';
	    if ($b.hasClass('idle')) return 'idle';
	    if ($b.hasClass('offline')) return 'offline';
	})($buddy_item);
	return {
	    id: $buddy_item.attr("id"),
	    jid: $buddy_item.attr("id"),
	    name: $buddy_item.find(".name").text(),
	    message: $.trim($buddy_item.find(".message").text()),
	    status: status,
	    photo: {
		small: $buddy_item.find(".buddy-photo").attr('src'),
		medium: $buddy_item.find(".buddy-photo-medium").val()
	    }
	}
    }
});

$.widget("ui.buddy_item", {
    _init: function() {
    },
    destroy: function() {
	$.Widget.prototype.destroy.apply(this, arguments); // default destroy
	this.element.unbind();
    }
});

$.widget("ui.sessions_manager", {
    _init: function() {
	
    },
    _add_session: function(buddies) {
	var $el= this.element;
	var $session_window= $el.find(".chat-session.layout").clone();
	$session_window.removeClass("layout");
	$session_window.session_window(buddies);
	$el.append($session_window);
    },
    open_session: function(buddies) {
	var $el= this.element;
	// console.log(buddies);
	if ($el.find("[id=chat-session-"+buddies.buddy.jid+"]").length == 0) {
	    this._add_session(buddies);
	}
	$el.find(".chat-session").hide();
	$el.find("[id=chat-session-"+buddies.buddy.jid+"]").show();
    }
});

$.widget("ui.session_window", {
    _init: function() {
	var $el= this.element;
	var self= this;
	this.buddy= this.options.buddy;
	this.me= this.options.me;

	$el.find(".info .name").text(this.buddy.name);
	$el.find(".info .message").text(this.buddy.message);
	$el.find(".status-icon").addClass(this.buddy.status);
	$el.find(".session-header .photo").attr('src', this.buddy.photo.medium);
	$el.attr("id", "chat-session-"+this.buddy.jid);

	// send message
	$el.find(".send-message input").keyup(function(e) {
	    if (e.keyCode == 13) {
		var msg= {message:{to:self._buddy(), content:$(this).val()},from:session.user};
		self._render_message($(this).val(), 'me');
		$(this).val("");
		socket.send(JSON.stringify(msg));
	    }
	});
    },
    _buddy: function() {
	var $el= this.element;
	// splits chat-session-user@domain.com
	return $el.attr("id").split("-")[2];
    },
    new_message: function(message) {
	if (message.message.body) {
	    this._render_message(message.message.body, 'buddy');
	}
    },
    // from: who's the message from, 'me' or 'buddy'
    _render_message: function(message, from) {
	var $el= this.element;
	var date= new Date();
	var hours= date.getHours() < 10 ? '0'+date.getHours() : date.getHours();
	var minutes= date.getMinutes() < 10 ? '0'+date.getMinutes() : date.getMinutes();
	var time= hours+":"+minutes;

	var $line= $el.find(".message-new.layout .line").clone();
	$line.addClass("last");
	$line.find("p.content").text(message);
	$line.find("p.time").text(time);

	var $last= $el.find(".message-new:last");
	if ($last.hasClass(from)) {
	    $last.find(".line.last").removeClass("last");
	    $last.find(".message-buffer").append($line);
	} else {
	    var $message= $el.find(".message-new.layout").clone();
	    $message.find(".thumb").attr("src", this[from].photo.small);
	    $message.removeClass("layout me buddy").addClass(from);
	    $message.find(".line").remove();
	    $message.find(".message-buffer").append($line);
	    $el.find(".chat-buffer").append($message);
	}
	var scroll= $el.find(".chat-buffer").height();
	$el.find(".chat-buffer-wrapper").scrollTop(scroll);
    }
});

var SessionsManager= {};
SessionsManager.incoming_message= function(message) {
    var from= JID.bare(message.message.from);
    // There are no sessions open
    if ($("#chat-sessions .chat-session").not(".layout").length == 0) {
	$("#chat-sessions").sessions_manager("open_session");
    }
    // There is at least one active session
    else {
	var $chat= $("#chat-sessions").find("[id=chat-session-"+from+"]");
	$chat.session_window("new_message", message);
    }
};

jQuery(document).ready(function($) {
    socket = new io.Socket(null, {port: 80});
    session= {};
    socket.connect();

    // Indicates whether self presence have been processed
    // Should be processed only once
    var auto_presence= false;

    socket.on('message', function(msg) {
	var message;
	try {
	    if (typeof msg == 'object') {
	    // should be a buffer only
	    } else {
		message= JSON.parse(msg);
	    }
	} catch(err) {
	    console.log(err);
	}	
	if (message) {
	    if (message.session) {
		$("#left").show();
	    } else if (message.roster) {
		session.user= message.to;
		$("#buddy-list-box").buddy_list("load", message);
	    } else if(message.presence) {
		if (JID.bare(message.presence.from)==JID.bare(session.user) && !auto_presence) {
		    $("#status-box").connection_manager("update_self", message);
		    auto_presence= true;
		}
		$("#buddy-list-box").buddy_list("update_buddy",message);
	    } else if(message.message) {
		SessionsManager.incoming_message(message);
	    } else if(message.vCard) {
		console.log("llego el vcard");
		$("#status-box").connection_manager("update_name", message.vCard.name);
	    } else {
		console.log(msg);
	    }
	}
    });
    
    // Connection Manager widget
    $("#connection-manager").find('.connect-btn').click(function() {
	var username= $("#connection-manager").find(".username input").val();
	var password= $("#connection-manager").find(".password input").val();
	var msg= {"session": { "jid":username,"password":password,"host":"talk.google.com","port":5222}, "from":username};
	socket.send(JSON.stringify(msg));
    });
    $("#status-box").connection_manager();


    $("#buddy-list-box").buddy_list({user:session.user});
    $("#chat-sessions").sessions_manager();
    $("#buddy-list-box").bind("open_session", function(e, buddy) {
	$("#chat-sessions").sessions_manager("open_session", buddy);
    });
});
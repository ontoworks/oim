var socket;
var session;

var no_avatar_20= "/images/no-avatar-20x20.png";
var no_avatar_40= "/images/no-avatar-40x40.png";

function get_buddy() {
    var $el= this.element;
    var $buddy_item= $("#status-box");
    var status= (function($b) {
	if ($b.hasClass('available')) return 'available';
	if ($b.hasClass('busy')) return 'busy';
	if ($b.hasClass('idle')) return 'idle';
	if ($b.hasClass('offline')) return 'offline';
    })($("#status-box .status-icon"));
    return {
	id: JID.bare(session.user),
	jid: JID.bare(session.user),
	name: $buddy_item.find(".name").text(),
	message: $.trim($buddy_item.find(".full-message").text()),
	status: status,
	photo: {
	    small: session.thumb,
	    medium: $buddy_item.find(".photo img").attr('src')
	}
    }
}

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

/*
 * Connection Manager
 *
 */
$.widget('ui.connection_manager', {
    _init: function() {
    },
    update_self: function(vcard) {
	var $el= this.element;
	var small_photo= vcard.photos ? vcard.photos.small||no_avatar_20 : no_avatar_20;
	var medium_photo= vcard.photos ? vcard.photos.medium||no_avatar_40 : no_avatar_40;
	session.thumb= small_photo;
	$el.find(".photo img").attr("src", medium_photo);
	$el.find(".message").text("");
	$el.find(".status-icon").removeClass("offline available idle busy").addClass("available");
	this.element.find(".my-info .name").text(vcard.name);
    }
});

/*
 * Buddy List
 *
 */
$.widget('ui.buddy_list', {
    _init: function() {
	var $el= this.element;
	$el.find(".layout").hide();
	this.user= this.options.user;

	$el.find(".header").bind('click', function(e) {
	    $(this).blur();
	    var $wrapper= $(this).closest(".buddy-list-section").find(".buddy-list-wrapper");
	    var action= $(this).hasClass("up") ? 'expand' : ( $(this).hasClass("down") ? 'collapse' : '' );
	    var header= this;
	    if (action == 'collapse') {
		$wrapper.slideUp(function() {
		    $(header).removeClass("down").addClass("up");
		    $(header).find(".click").removeClass().addClass("click header-collapse");
		});
	    }
	    if (action == 'expand') {
		$wrapper.slideDown(function() {
		    $(header).removeClass("up").addClass("down");
		    $(header).find(".click").removeClass().addClass("click header-expand");
		});
	    }
	    e.preventDefault();
	});
    },
    update_buddy: function(buddy) {
	var $el= this.element;
	var self= this;
	var status= buddy.presence.status;

	var $buddy_item= $el.find(".buddy-item[id="+JID.bare(buddy.presence.from)+"]");
	var prev_status= $buddy_item.attr("class");
	var changed_status= !$buddy_item.hasClass(status);

	var medium_photo= buddy.presence.photo ? buddy.presence.photo.medium||no_avatar_40 : no_avatar_40;
	$buddy_item.append($("<input class='buddy-photo-medium' type='hidden' value='"+medium_photo+"'/>"));

	this._update_buddy_item($buddy_item, buddy);
	if (changed_status) this._update_blist($buddy_item, buddy.service, status);
	
	var $items= $el.find(".buddy-item[id="+JID.bare(buddy.presence.from)+"]");
	if ($items.length > 1) {
	    var str= buddy.presence.from+"\n";
	    str += "Prev status: "+prev_status+"\n";
	    str += "Current status: "+status+"\n";
	    socket.send({error:str});
	}

	// Update buddy-item in Chat Section
	var $chat_session= $el.find("[id=session-"+JID.bare(buddy.presence.from)+"]");
	if ($chat_session.length > 0) {
	    this._update_buddy_item($chat_session, buddy);
	    if (status == 'offline') {
		$chat_session.addClass("offline");
	    }
	}
    },
    _update_buddy_item: function($buddy_item, buddy) {
	var status= buddy.presence.status;

	$buddy_item.removeClass("offline available idle busy").addClass(status);
	$buddy_item.find(".buddy-info").find(".message, .full-message").text(buddy.presence.message);
	truncate($buddy_item.find(".buddy-info .message").get(0), 28);
	$.trim(buddy.presence.message) ? $buddy_item.removeClass("alone") : $buddy_item.addClass("alone");

	var small_photo= buddy.presence.photo ? buddy.presence.photo.small||no_avatar_20 : no_avatar_20;
	$buddy_item.find(".buddy-photo").attr("src", small_photo);
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
		    self.element.trigger("open_session", [self.get_buddy(id), true]);
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
		    self.element.trigger("open_session", [self.get_buddy(id), true]);
		}
	    })(buddy_id, this));
	    this._update_blist($buddy_item.show(), "chat", "chat");
	}
    },
    get_buddy: function(buddy_id) {
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
	    message: $.trim($buddy_item.find(".full-message").text()),
	    status: status,
	    photo: {
		small: $buddy_item.find(".buddy-photo").attr('src'),
		medium: $buddy_item.find(".buddy-photo-medium").val()
	    }
	}
    }
});

/*
 * Buddy Item
 *
 */
$.widget("ui.buddy_item", {
    _init: function() {
    },
    destroy: function() {
	$.Widget.prototype.destroy.apply(this, arguments); // default destroy
	this.element.unbind();
    }
});

/*
 * Sessions Manager (Chat Sessions)
 *
 */
$.widget("ui.sessions_manager", {
    _init: function() {
	
    },
    _add_session: function(buddy) {
	var $el= this.element;
	var $session_window= $el.find(".chat-session.layout").clone();
	$session_window.removeClass("layout");
	$session_window.session_window({buddy:buddy});
	$el.append($session_window);
    },
    open_session: function(buddy, show) {
	var $el= this.element;

	if ($el.find(".chat-session").not(".layout").length == 0) {
	    show= true;
	}

	if ($el.find("[id=chat-session-"+buddy.jid+"]").length == 0) {
	    this._add_session(buddy);
	}

	if (show) {
	    this.show_session(buddy.jid);
	}
    },
    close_session: function(jid) {
	this.element.find("[id=chat-session-"+jid+"]").remove();
    },
    show_session: function(jid) {
	var $el= this.element;
	$el.find(".chat-session").hide();
	$el.find("[id=chat-session-"+jid+"]").show();
	$el.find("[id=chat-session-"+jid+"] .send-message input").focus();
    },
    update_buddy: function(buddy) {
	var $el= this.element;
	var $session= $el.find("[id=chat-session-"+JID.bare(buddy.presence.from)+"]");
	if ($session.length > 0) {
	    $session.find(".session-header .status-icon").removeClass().addClass("status-icon "+buddy.presence.status);
	    $session.find(".session-header .message").text(buddy.presence.message);
	}
    }
});

/*
 * (Chat) Session Window
 *
 */
$.widget("ui.session_window", {
    _init: function() {
	var $el= this.element;
	var self= this;
	this.buddy= this.options.buddy;
	this.me= get_buddy();

	$el.find(".info .name").text(this.buddy.name);
	$el.find(".info .message").text(this.buddy.message);
	$el.find(".status-icon").removeClass().addClass("status-icon "+this.buddy.status);
	$el.find(".session-header .photo").attr('src', this.buddy.photo.medium);
	$el.attr("id", "chat-session-"+this.buddy.jid);

	// send message
	$el.find(".send-message input").keyup(function(e) {
	    if (e.keyCode == 13) {
		var msg= {message:{to:self._buddy(), body:$(this).val()},from:session.user};
		console.log(self._buddy());
		self._render_message($(this).val(), 'me');
		$(this).val("");
		socket.send(msg);
	    }
	});
    },
    _buddy: function() {
	var $el= this.element;
	// splits chat-session-user@domain.com
	return $el.attr("id").split("-")[2]||"-"+$el.attr("id").split("-")[3];
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

	var $last= $el.find(".message-new:last").not(".layout");
	if ($last.hasClass(from)) {
	    $last.find(".line.last").removeClass("last");
	    $last.find(".message-buffer").append($line);
	} else {
	    var $message= $el.find(".message-new.layout").clone();
	    $message.find(".thumb").attr("src", this[from].photo.small);
	    $message.removeClass("layout me buddy").addClass(from).show();
	    $message.find(".line").remove();
	    $message.find(".message-buffer").append($line);
	    $el.find(".chat-buffer").append($message);
	}
	var scroll= $el.find(".chat-buffer").height();
	$el.find(".chat-buffer-wrapper").scrollTop(scroll);
    }
});

function incoming_message(message) {
    var from= JID.bare(message.message.from);
    var $buddy_list= $("#buddy-list-box");

    var $chat= $("#chat-sessions").find("[id=chat-session-"+from+"]");
    if ($chat.length > 0) {
	if ($chat.is(":not(:visible)")) {
	    // Indicates new message
	}
    } else {
	var buddy= $buddy_list.buddy_list("get_buddy", from);
	$("#chat-sessions").sessions_manager("open_session", buddy);
	$buddy_list.buddy_list("buddy_to_chat_group", from);
	$chat= $("#chat-sessions").find("[id=chat-session-"+from+"]");
    }

    // There are no sessions open
    $chat.session_window("new_message", message);
};

jQuery(document).ready(function($) {
    socket = new io.Socket(null, {port: 80});
    session= {};
    sessions= {};
    socket.connect();

    socket.on('message', function(message) {
	if (message) {
	    if (message.session) {
	    } else if (message.roster) {
		session.user= message.to;
		$("#left").show();
		$("#buddy-list-box").buddy_list("load", message);
	    } else if(message.presence) {
		$("#buddy-list-box").buddy_list("update_buddy",message);
		$("#chat-sessions").sessions_manager("update_buddy",message);
	    } else if(message.message) {
		incoming_message(message);
	    } else if(message.vCard) {
		$("#status-box").connection_manager("update_self", message.vCard);
	    } else {
		console.log(message);
	    }
	}
    });
    
    // Connection Manager widget
    $("#connection-manager").find('.connect-btn').click(function() {
	var username= $("#connection-manager").find(".username input").val();
	var password= $("#connection-manager").find(".password input").val();
	if (!$.trim(username)) { alert("You must enter a username"); return false; }
	if (!$.trim(password)) { alert("You must enter a password"); return false; }
	var msg= {"session": { "jid":username,"password":password,"host":"talk.google.com","port":5222, service:"gtalk"}, "from":username};
	socket.send(msg);
    });
    $("#status-box").connection_manager();


    $("#buddy-list-box").buddy_list({user:session.user});
    $("#chat-sessions").sessions_manager();
    $("#buddy-list-box").bind("open_session", function(e, buddy, show) {
	$("#chat-sessions").sessions_manager("open_session", buddy, show);
    });
    $("#buddy-list-box").bind("close_session", function(e, buddy, show) {
	$("#chat-sessions").sessions_manager("close_session", buddy_id);
    });

    /*
     * Facebook Integration
     *
     */
    window.fbAsyncInit = function() {
	FB.init({appId: '270579051603', status: true, cookie: true, xfbml: true});
	FB.Event.subscribe('auth.login', function(response) {
	    console.log("User logged in");
	});
    };

    $(".connect a").click(function(e) {
	if($(this).attr("id") == "connect-gmail") {
	    $("#cm-gmail").show();
	}
	if($(this).attr("id") == "connect-fb") {
	    FB.login(function(response) {
		if (response.session) {
		    if (response.perms) {
			var msg= {session: { service: "facebook", "uid":response.session.uid, "session_key":response.session.session_key}};
			socket.send(msg);
		    } else {
			// user is logged in, but did not grant any permissions
		    }
		} else {
		    // user is not logged in
		}
	    }, {perms:'xmpp_login'});
	}
	e.preventDefault();
    });

    (function() {
	var e = document.createElement('script');
	e.type = 'text/javascript';
	e.src = document.location.protocol +
	    '//connect.facebook.net/en_US/all.js';
	e.async = true;
	document.getElementById('fb-root').appendChild(e);
    }());
});
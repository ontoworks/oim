jQuery(document).ready(function($) {
    var socket = new io.Socket(null, {port: 80});
    socket.connect();

    $(".input input").keyup(function(e) {
	if (e.keyCode == 13) {
	    socket.send($(".input input").val());
	}
    });
    
    // Connection Manager widget
    $("#connection-manager").find('.connect-btn').click(function() {
	var username= $("#connection-manager").find(".username input").val();
	var password= $("#connection-manager").find(".password input").val();
	var msg= {"session": { "jid":username,"password":password,"host":"talk.google.com","port":5222}, "from":username};
	socket.send(JSON.stringify(msg));
    });
});

var JID= {};
JID.bare= function(jid) {
    return jid.split('/')[0];
};

$.widget('ui.buddy_list', {
    _init: function() {
	this.element.find(".layout").hide();
    },
    update_buddy: function(buddy) {
	// console.log(JSON.stringify(buddy));
	var $el= this.element;
	var self= this;
	var status= buddy.presence.status;
	var $buddy_item= $el.find(".buddy-item[id="+JID.bare(buddy.presence.from)+"]");

	// return if no status change is needed
	if ($buddy_item.hasClass(status)) {
	    return false;
	}

	$buddy_item.removeClass("offline available idle busy").addClass(status);
	if(buddy.presence.message) {
	    console.log(buddy.presence.message);
	}
	$buddy_item.find(".buddy-info .message").text(buddy.presence.message);
	$buddy_item.find(".buddy-photo").attr("src", buddy.presence.photo);
	$buddy_item.find(".message").trunc(35);

	// sort buddies alphabetically
	var contacts_list= [];
	$el.find(".buddy-list-section."+buddy.service+" .buddy-list."+status+" .buddy-item").not(".layout").each(function() {
	    var name= $(this).find(".name").text();
	    contacts_list.push(name);
	});

	contacts_list.sort(function(a,b) {
	    var al=a.toLowerCase(),bl=b.toLowerCase();
	    return al==bl?(a==b?0:a<b?-1:1):al<bl?-1:1;
	});

	// console.log(contacts_list.length);
	// $contact_item.find(".status").addClass(status);
	var next;
	$(contacts_list).each(function(i,v) {
	    if ($buddy_item.find(".name").text().toLowerCase() < v.toLowerCase()) {		
		next= v;
		return false;
	    }
	});
	if (next) {
	    $el.find(".buddy-list-section."+buddy.service+" .buddy-list."+status+" .buddy-item:contains('"+next+"')").before($buddy_item);
	} else {
	    $el.find(".buddy-list-section."+buddy.service+" .buddy-list."+status).append($buddy_item);
	}

	// update evens and odds for online buddies
	// i think this could be slow if very long blist
	$el.find(".buddy-list-section."+buddy.service+" .buddy-list:not(.offline) .buddy-item:even")
	    .removeClass("even odd").addClass("even");
	$el.find(".buddy-list-section."+buddy.service+" .buddy-list:not(.offline) .buddy-item:odd")
	    .removeClass("even odd").addClass("odd");
	// update evens and odds for offline buddies
	$el.find(".buddy-list-section."+buddy.service+" .buddy-list.offline .buddy-item:even")
	    .removeClass("even odd").addClass("even");
	$el.find(".buddy-list-section."+buddy.service+" .buddy-list.offline .buddy-item:odd")
	    .removeClass("even odd").addClass("odd");
    },
    /*
      Renders buddy list
      - it should render odds and evens
     */
    load: function(roster) {
	var $el= this.element;
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
	    $buddy_item.find(".name").trunc(40);
	    $el.find(".buddy-list-section."+service+" .buddy-list.offline").append($buddy_item.show());
	}
    }
});

$.widget("ui.sessions_manager", {
    _init: function() {
	
    }
});


$("#buddy-list-box").buddy_list();

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
	if (message.roster) {
	    $("#buddy-list-box").buddy_list("load", message);
	} else if(message.presence) {
	    $("#buddy-list-box").buddy_list("update_buddy",message);
	} else {
	    console.log(msg);
	}
    }
});
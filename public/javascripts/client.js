var socket = new io.Socket(null, {port: 80});
socket.connect();

var JID= {};
JID.bare= function(jid) {
    return jid.split('/')[0];
};

$.widget('ui.buddy_list', {
    _init: function() {
    },
    update_buddy: function(buddy) {
	var $el= this.element;
	var self= this;
	var $buddy_item= $el.find(".buddy-item[id="+JID.bare(buddy.presence.from)+"]");
	console.log($buddy_item);
	// state update should not work like this
	$buddy_item.removeClass("offline online idle away").addClass("online");
	$buddy_item.find(".status-icon").removeClass().addClass('status-icon online');
	$buddy_item.find(".buddy-info .message").text(buddy.presence.message);
	$el.find(".buddy-list-section."+buddy.service+" .buddy-list.online").append($buddy_item);
    },
    /*
      Renders buddy list
      - it should render odds and evens
     */
    load: function(roster) {
	var $el= this.element;
	var service= roster.service;
	var buddy_item_layout= $el.find(".buddy-list-section."+service+" .buddy-list.offline .buddy-item.layout").clone();
	buddy_item_layout.removeClass("layout even odd");
	for (var i=0; i<roster.roster.blist.length; i++) {
	    var buddy_item= buddy_item_layout.clone();
	    var buddy_jid= roster.roster.blist[i];
	    buddy_item.attr("id", buddy_jid);
	    buddy_item.addClass((function(parity) { return (parity%2==0) ? 'even' : 'odd'})(i));
	    buddy_item.find(".name").text(roster.roster.contacts[buddy_jid].name);
	    buddy_item.find(".name").trunc(25);
	    $el.find(".buddy-list-section."+service+" .buddy-list.offline").append(buddy_item.show());
	}
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
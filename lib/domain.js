var __dirname= module.parent.exports.__dirname;
var fs = require('fs');
var im= require('imagemagick');
var path= require('path');
var db= module.parent.exports.db;
var UserModel= db.model('User');
var BuddyModel= db.model('Buddy');

function bare_jid(jid) {
    return jid.split('/')[0];
};

var User= function() {
};

// Checks if an user exists with a given Bare JID
User.exists= function(jid, callback) {
    User.find_by_jid(jid, callback);
};

User.create= function(o, callback) {
    var user= new UserModel(o);
    user.save(function(error, doc) {
	if (error === null) {
	    callback(doc);
	} else {
	    callback(null);
	}
    });
};

User.find_by_jid= function(jid, callback) {
    UserModel.findOne({jid: jid}, function(error, a) {
	a ? callback(a) : callback(false);
    });
};

User.update_vCard= function(vCard, callback) {
    var jid= bare_jid(vCard.to);
    User.find_by_jid(jid, function(doc) {
	if (!doc) {
	    callback(null);
	    return false;
	}

	var roster= doc[vCard.service+"_roster"][0];
	var from= vCard.from;
	var thumb_path= "";

	if (vCard.photo) {
	    var buffer= vCard.photo.data;
	    var type= vCard.photo.type;
	    thumb_path= "/images/buddies/"+from+"/"+from+"-small."+type;

	    delete vCard.photo['data'];
	    vCard.photo.path= thumb_path;

	    var path_dir= __dirname+"/public"+"/images/buddies/"+from+"/";
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
				callback({vCard:vCard});
			    });
			});
		    });
		} else {
		    callback({vCard:vCard});
		}
	    });
	} else {
	    vCard.photo= { path: "" };
	    callback({vCard:vCard});
	}
	User.find_by_jid(bare_jid(vCard.to), function(user) {
	    user[vCard.service+"_buddies"].push({jid:vCard.from, thumb_path: vCard.photo.path, name:vCard.name});
	    user.save();
		// Buddy.find_by_jid(vCard.from, function(buddy) {
		//     user[vCard.service+"_buddies"].id(buddy.id).remove();
		//     user[vCard.service+"_buddies"].push(buddy);
		//     user.save();
		// });
	});
    });
};

User.update_roster= function(roster, callback) {
    var doc= {};
    doc[roster.service+"_roster"]= [roster];
    UserModel.update({jid: bare_jid(roster.to)}, doc, function(error) {
	console.log("Update Roster\n"+error);
    });

    // var jid= bare_jid(roster.to);
    // for (buddy_jid in roster.roster.contacts) {
    // 	var buddy;
    // 	(function(buddy_jid) {
    // 	    Buddy.exists(buddy_jid, function(exists) {
    // 		if (exists) {
    // 		    buddy= exists;
    // 		    User.add_buddy(jid, roster.service, buddy);
    // 		} else {
    // 		    var buddy_model= new BuddyModel({jid:buddy_jid});
    // 		    buddy_model.save(function(error, doc) {
    // 			buddy= doc;
    // 			User.add_buddy(jid, roster.service, buddy);
    // 		    });
    // 		}
    // 	    });
    // 	})(buddy_jid);
    // }
    if (callback) callback();

};

User.add_buddy= function(jid, service, buddy) {
    UserModel.findOne({jid:jid}, function(error, doc) {
	doc[service+"_buddies"].push(buddy);
	doc.save();
    });
};

var Buddy= {};
// Checks if an user exists with a given Bare JID
Buddy.exists= function(jid, callback) {
    Buddy.find_by_jid(jid, callback);
};

Buddy.find_by_jid= function(jid, callback) {
    BuddyModel.findOne({jid: jid}, function(error, a) {
	a ? callback(a) : callback(false);
    });
};

Buddy.update_from_vCard= function(vCard, callback) {
    var jid= vCard.from;
    BuddyModel.update({jid: jid}, {thumb_path: vCard.photo.path}, function(error, a) {
	if(callback) a ? callback(a) : callback(false);
    });
};

module.exports= {
    User: User,
    Buddy: Buddy
};
var db= module.parent.exports.db;
var UserModel= db.model('User');

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

User.update_roster= function(roster) {
    var doc= {};
    doc[roster.service+"_roster"]= [roster];
    console.log(doc);
    UserModel.update({jid: bare_jid(roster.to)}, doc, function(error) {
	console.log("Update Roster\n"+error);
    });
};

module.exports= {
    User: User
};
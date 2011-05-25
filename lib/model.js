var mongoose= require('mongoose');

var Schema= mongoose.Schema,
    ObjectId= Schema.ObjectId;

var Buddy= new Schema({
    jid: String,
    name: String,
    thumb_path: String
});
mongoose.model('Buddy', Buddy);

var User= new Schema({
    username: String,
    jid: String,
    gtalk_roster: Array,
    facebook_roster: Array,
    gtalk_buddies: [Buddy]
});
mongoose.model('User', User);

module.exports= mongoose;
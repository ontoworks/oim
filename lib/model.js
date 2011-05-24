var mongoose= require('mongoose');

var Schema= mongoose.Schema,
    ObjectId= Schema.ObjectId;

var User= new Schema({
    username: String,
    jid: String,
    gtalk_roster: Array,
    facebook_roster: Array
});
mongoose.model('User', User);

module.exports= mongoose;
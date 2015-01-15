Meteor.publish("allUsersData", function () {
    if (this.userId) {
        var user = Meteor.users.findOne(this.userId);
        if (user.profile && user.profile.isAdmin) {
            return Meteor.users.find();
        }
    } else {
        this.ready();
    }
});

Meteor.publish("user", function (userId) {
    return Meteor.users.find({_id: userId});
});

Meteor.users.allow({
    remove: function (userId) {
        if (userId) {
            var user = Meteor.users.findOne(userId);
            if (user.profile && user.profile.isAdmin) {
                return true;
            }
        }
        return false;
    }
});

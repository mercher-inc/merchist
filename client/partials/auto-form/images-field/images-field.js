(function () {

    var getDataUrl = function(blob){
        var reader = new FileReader();
        return new Promise(function(resolve, reject){
            reader.onload = function (e) {
                resolve(e.target.result);
            };
            reader.readAsDataURL(blob);
        });
    };

    var getImageCropData = function(dataUrl){
        var image = new Image(),
            cropData = {};
        return new Promise(function(resolve, reject){
            image.onload = function () {
                cropData.top = 0;
                cropData.left = 0;
                cropData.size = 0;

                if (image.height < image.width) {
                    cropData.left = Math.ceil((image.width - image.height) / 2);
                    cropData.size = image.height;
                } else if (image.height > image.width) {
                    cropData.top = Math.ceil((image.height - image.width) / 2);
                    cropData.size = image.width;
                }

                resolve(cropData);
            };
            image.src = dataUrl;
        });
    };

    Template.mcInputImages.created = function () {
        this.data.imageIds = [];
        this.data.imageIdsDep = new Tracker.Dependency;
    };

    Template.mcInputImages.helpers({
        images: function () {
            Template.instance().data.imageIdsDep.depend();
            return Images.find({_id: {$in: Template.instance().data.imageIds}});
        }
    });

    Template.mcInputImages.events({
        'click .uploadBtn':                     function (e, template) {
            var $fileInput = template.$('.uploadBtn input[type="file"]');

            if (!$fileInput.length) {
                $fileInput = $('<input />');
                $fileInput.attr({
                    type:   'file',
                    accept: 'image/*'
                });
                $fileInput.prop({
                    multiple: true
                });
                $fileInput.css({
                    opacity:  0,
                    display:  'block',
                    height:   0,
                    width:    0,
                    position: 'absolute',
                    top:      -9999,
                    left:     -9999
                });
                $fileInput.appendTo(template.$('.uploadBtn'));
            }

            if (e.target !== $fileInput[0]) {
                e.preventDefault();
                $fileInput.click();
            }
        },
        'change .uploadBtn input[type="file"]': function (e, template) {
            e.preventDefault();
            var $fileInput = template.$('.uploadBtn input[type="file"]');
            $fileInput.remove();

            FS.Utility.eachFile(e, function (file) {
                var newFile = new FS.File(file);
                newFile.userId = Meteor.userId();
                newFile.metadata = {
                    shape:  'square'
                };

                getDataUrl(newFile.data.blob)
                    .then(function(dataUrl){
                        return getImageCropData(dataUrl);
                    })
                    .then(function(cropData){
                        newFile.metadata.crop = cropData;
                        return newFile;
                    })
                    .then(function(newFile){
                        Images.insert(newFile, function (err, fileObj) {
                            if (!err) {
                                template.data.imageIds.push(fileObj._id);
                                template.data.imageIdsDep.changed();
                            }
                        });
                    });
            });
        }
    });

    AutoForm.addInputType('mcImages', {
        template: 'mcInputImages',
        valueIn:  function (value) {
            if (!value) {
                value = [];
            }
            return value;
        },
        valueOut: function () {
            var schemaKey = this.attr('data-schema-key');
            var imageIds = [],
                $imageIds = $('input[name="'+schemaKey+'[]"]', this);
            $imageIds.each(function () {
                imageIds.push($(this).val());
            });
            return imageIds;
        }
    });

})();

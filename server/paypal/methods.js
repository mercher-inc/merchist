(function () {

    function rfc3986(str) {
        return encodeURIComponent(str)
            .replace(/!/g, '%21')
            .replace(/\*/g, '%2A')
            .replace(/\./g, "%2E")
            .replace(/\+/g, ' ')
            .replace(/-/g, '%2D')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29')
            .replace(/'/g, '%27')
            .replace(/%7E/g, '~')
            ;
    }

    var genSign = function (consumerKey, consumerSecret, token, tokenSecret, httpMethod, endpoint) {
        var data = {
            "oauth_consumer_key":     consumerKey,
            "oauth_signature_method": "HMAC-SHA1",
            "oauth_timestamp":        Math.round((new Date()).getTime() / 1000),
            "oauth_token":            token,
            "oauth_version":          "1.0"
        };

        var dataString = Object.keys(data).sort().map(function (i) {
            return i + '=' + data[i]
        }).join('&');

        var dataArray = [
            httpMethod.toUpperCase(),
            endpoint,
            dataString
        ];

        var baseString = dataArray.map(function (i) {
            return rfc3986(i).replace(/(%[A-Za-z0-9]{2})/g, function (s) {
                return s.toLowerCase();
            });
        }).join('&');

        var keyParts = [
            consumerSecret,
            tokenSecret ? tokenSecret : ""
        ];

        var key = keyParts.map(function (i) {
            return rfc3986(i).replace(/(%[A-Za-z0-9]{2})/g, function (s) {
                return s.toLowerCase();
            });
        }).join('&');

        var hmac = Npm.require('crypto').createHmac('sha1', key);
        hmac.update(baseString);
        data["oauth_signature"] = hmac.digest('base64');
        return data;
    };

    var generateFullAuthString = function (consumerKey, consumerSecret, token, tokenSecret, httpMethod, endpoint) {
        var response = genSign(consumerKey, consumerSecret, token, tokenSecret, httpMethod, endpoint);
        return "token=" + response['oauth_token'] +
            ",signature=" + response['oauth_signature'] +
            ",timestamp=" + response['oauth_timestamp'];
    };

    Meteor.methods({
        'PayPal:generateAccountRequest': function (shopId, returnUrl, cancelUrl) {
            var baseUrl = 'https://svcs.sandbox.paypal.com/',
                url = baseUrl + 'Permissions/RequestPermissions';

            var data = {
                requestEnvelope: {
                    detailLevel:   'ReturnAll',
                    errorLanguage: 'en_US'
                },
                scope:           [
                    'REFUND',
                    'ACCESS_BASIC_PERSONAL_DATA',
                    'ACCESS_ADVANCED_PERSONAL_DATA'
                ],
                callback:        returnUrl
            };

            var headers = {
                "X-PAYPAL-REQUEST-DATA-FORMAT":  "JSON",
                "X-PAYPAL-RESPONSE-DATA-FORMAT": "JSON",
                "X-PAYPAL-APPLICATION-ID":       'APP-80W284485P519543T',
                "X-PAYPAL-SECURITY-USERID":      'dmitriy.s.les-facilitator_api1.gmail.com',
                "X-PAYPAL-SECURITY-PASSWORD":    '1391764851',
                "X-PAYPAL-SECURITY-SIGNATURE":   'AIkghGmb0DgD6MEPZCmNq.bKujMAA8NEIHryH-LQIfmx7UZ5q1LXAa7T'
            };

            var response = Meteor.wrapAsync(HTTP.post)(url, {data: data, headers: headers});
            Shops.update(shopId, {$addToSet: {'payPal.accountRequests': response.data.token}});
            return 'https://sandbox.paypal.com/cgi-bin/webscr?cmd=_grant-permission&request_token=' + response.data.token;
        },
        'PayPal:verifyAccountRequest':   function (params) {
            var shop = Shops.findOne({'payPal.accountRequests': params.request_token});

            var baseUrl = 'https://svcs.sandbox.paypal.com/',
                url = baseUrl + 'Permissions/GetAccessToken';

            var data = {
                requestEnvelope: {
                    detailLevel:   'ReturnAll',
                    errorLanguage: 'en_US'
                },
                token:           params.request_token,
                verifier:        params.verification_code
            };

            var headers = {
                "X-PAYPAL-REQUEST-DATA-FORMAT":  "JSON",
                "X-PAYPAL-RESPONSE-DATA-FORMAT": "JSON",
                "X-PAYPAL-APPLICATION-ID":       'APP-80W284485P519543T',
                "X-PAYPAL-SECURITY-USERID":      'dmitriy.s.les-facilitator_api1.gmail.com',
                "X-PAYPAL-SECURITY-PASSWORD":    '1391764851',
                "X-PAYPAL-SECURITY-SIGNATURE":   'AIkghGmb0DgD6MEPZCmNq.bKujMAA8NEIHryH-LQIfmx7UZ5q1LXAa7T'
            };

            var response = Meteor.wrapAsync(HTTP.post)(url, {data: data, headers: headers});

            var token = response.data.token,
                tokenSecret = response.data.tokenSecret,
                scope = response.data.scope;

            url = baseUrl + 'Permissions/GetAdvancedPersonalData';

            data = {
                requestEnvelope: {
                    detailLevel:   'ReturnAll',
                    errorLanguage: 'en_US'
                },
                attributeList:   {
                    attribute: [
                        'http://axschema.org/namePerson/first',
                        'http://axschema.org/namePerson/last',
                        'http://axschema.org/contact/email',
                        'http://axschema.org/company/name',
                        'http://axschema.org/contact/country/home',
                        'http://axschema.org/contact/postalCode/home',
                        'http://schema.openid.net/contact/street1',
                        'http://schema.openid.net/contact/street2',
                        'http://axschema.org/contact/city/home',
                        'http://axschema.org/contact/state/home',
                        'http://axschema.org/contact/phone/default',
                        'https://www.paypal.com/webapps/auth/schema/payerID'
                    ]
                }
            };

            headers = {
                "X-PAYPAL-REQUEST-DATA-FORMAT":  "JSON",
                "X-PAYPAL-RESPONSE-DATA-FORMAT": "JSON",
                "X-PAYPAL-APPLICATION-ID":       'APP-80W284485P519543T',
                "X-PAYPAL-AUTHORIZATION":        generateFullAuthString(
                    'dmitriy.s.les-facilitator_api1.gmail.com',
                    '1391764851',
                    token,
                    tokenSecret,
                    'POST',
                    url
                )
            };

            response = Meteor.wrapAsync(HTTP.post)(url, {data: data, headers: headers});

            var personalData = {};
            Object.keys(response.data.response.personalData).map(function (i) {
                var dataItem = response.data.response.personalData[i];
                switch (dataItem.personalDataKey) {
                    case 'http://axschema.org/namePerson/first':
                        if (dataItem.personalDataValue)
                            personalData['firstName'] = dataItem.personalDataValue;
                        break;
                    case 'http://axschema.org/namePerson/last':
                        if (dataItem.personalDataValue)
                            personalData['lastName'] = dataItem.personalDataValue;
                        break;
                    case 'http://axschema.org/contact/email':
                        if (dataItem.personalDataValue)
                            personalData['accountEmail'] = dataItem.personalDataValue;
                        break;
                    case 'http://axschema.org/company/name':
                        if (dataItem.personalDataValue)
                            personalData['businessName'] = dataItem.personalDataValue;
                        break;
                    case 'http://axschema.org/contact/country/home':
                        if (dataItem.personalDataValue)
                            personalData['country'] = dataItem.personalDataValue;
                        break;
                    case 'http://axschema.org/contact/postalCode/home':
                        if (dataItem.personalDataValue)
                            personalData['postalCode'] = dataItem.personalDataValue;
                        break;
                    case 'http://schema.openid.net/contact/street1':
                        if (dataItem.personalDataValue)
                            personalData['street1'] = dataItem.personalDataValue;
                        break;
                    case 'http://schema.openid.net/contact/street2':
                        if (dataItem.personalDataValue)
                            personalData['street2'] = dataItem.personalDataValue;
                        break;
                    case 'http://axschema.org/contact/city/home':
                        if (dataItem.personalDataValue)
                            personalData['city'] = dataItem.personalDataValue;
                        break;
                    case 'http://axschema.org/contact/state/home':
                        if (dataItem.personalDataValue)
                            personalData['state'] = dataItem.personalDataValue;
                        break;
                    case 'http://axschema.org/contact/phone/default':
                        if (dataItem.personalDataValue)
                            personalData['phone'] = dataItem.personalDataValue;
                        break;
                }
            });

            Shops.update(shop._id, {
                $set: {
                    'payPal.account': {
                        profile:     personalData,
                        token:       token,
                        tokenSecret: tokenSecret,
                        scope:       scope
                    }
                }
            });

            console.log(Shops.findOne(shop._id));

            return shop._id;
        }
    });

})();

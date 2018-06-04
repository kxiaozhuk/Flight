    "use strict";

    var dappAddress = "n1p4HkrwESwc4coAib3sn1HepzPskn2NSKo";
    var nebulas = require("nebulas"),
        Account = nebulas.Account;

    var NebPay = require("nebpay"); //https://github.com/nebulasio/nebPay
    var nebPay = new NebPay();
    var serialNumber; //交易序列号
    var intervalQuery; //定时查询交易结果


    var HttpRequest = require("nebulas").HttpRequest;
    var Neb = require("nebulas").Neb;
    var neb = new Neb();
    neb.setRequest(new HttpRequest("https://mainnet.nebulas.io"));

    function funcIntervalQuery() {
        nebPay.queryPayInfo(serialNumber) //search transaction result from server (result upload to server by app)
            .then(function(resp) {
                console.log("tx result: " + resp) //resp is a JSON string
                var respObject = JSON.parse(resp)
                if (respObject.code === 0) {
                    clearInterval(intervalQuery)
                }
            })
            .catch(function(err) {
                console.log(err);
            });
    }

    function cbPush(resp) {
        console.log("response of push: " + JSON.stringify(resp))
    }

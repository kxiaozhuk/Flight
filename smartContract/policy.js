"use strict";

var DictItem = function(text) {
    if (text) {
        var obj = JSON.parse(text);
        this.key = obj.key;
        this.account = obj.account;
        this.premium = obj.premium;
        this.amount = obj.amount;
        this.create = obj.create;
        this.status = obj.status;
        this.flight = obj.flight;
        this.planStart = obj.planStart;
        this.planEnd = obj.planEnd;
        this.actualStart = obj.actualStart;
        this.actualEnd = obj.actualEnd;
        this.remarks = obj.remarks;
        this.from = obj.from;
        this.to = obj.to;
    } else {
        this.key = "";
        this.account = "";
        this.premium = 0;
        this.amount = 0;
        this.create = Date();
        // 0 已投保 1 理赔中 2 已理赔 3 已结案 -1 转账失败
        this.status = 0;
        this.flight = "";
        this.planStart = "";
        this.planEnd = "";
        this.actualStart = "";
        this.actualEnd = "";
        this.remarks = "";
        this.from = "";
        this.to = "";
    }
};

DictItem.prototype = {
    toString: function() {
        return JSON.stringify(this);
    }
};

var Policy = function() {
    LocalContractStorage.defineMapProperty(this, "accountMap");
    LocalContractStorage.defineMapProperty(this, "dataMap", {
        parse: function(text) {
            return new DictItem(text);
        },
        stringify: function(o) {
            return o.toString();
        }
    });
    LocalContractStorage.defineProperty(this, "size");
    LocalContractStorage.defineProperty(this, "rate");
    LocalContractStorage.defineProperty(this, "admin");
    LocalContractStorage.defineMapProperty(this, "arrayMap");
};

Policy.prototype = {
    init: function() {
        this.size = 0;
        this.rate = 10;
        this.admin = "n1UpSJ3r2m1ea6n5UhvbCeRmP215rN71xMD";
    },

    apply: function(key, flight, planStart, planEnd, from, to, remarks) {

        key = key.trim();
        flight = flight.trim();
        if (key === "" || flight === "") {
            throw new Error("empty key / flight");
        }
        if (remarks.length > 128 || key.length > 64) {
            throw new Error("key / remarks exceed limit length")
        }

        var premium = Blockchain.transaction.value;
        if (premium == 0) {
            throw new Error("premium is zero")
        }

        var account = Blockchain.transaction.from;

        var dictItem = new DictItem();
        dictItem.key = key;
        dictItem.account = account;
        dictItem.premium = premium;
        dictItem.amount = premium * this.rate;
        dictItem.status = 0;
        dictItem.flight = flight;
        dictItem.planStart = planStart;
        dictItem.planEnd = planEnd;
        dictItem.remarks = remarks;
        dictItem.create = Date();
        dictItem.from = from;
        dictItem.to = to;

        var accountData = this.accountMap.get(account);
        if(accountData && accountData != ""){
            accountData += "," + key;
            this.accountMap.put(account, accountData);
        } else {
            this.accountMap.put(account, key);
        }
        var index = this.size;
        this.arrayMap.set(index, key);
        this.dataMap.put(key, dictItem);
        this.size += 1;
    },

    get: function(key) {
        key = key.trim();
        if (key === "") {
            throw new Error("empty key")
        }
        return this.dataMap.get(key);
    },

    len: function() {
        return this.size;
    },

    getAccount: function(account) {
        account = account.trim();
        if (account === "") {
            return this.accountMap
        }
        return this.accountMap.get(account);
    },

    getByAccount: function(account) {
        account = account.trim();
        if (account === "") {
            throw new Error("empty account")
        }
        var keys = this.accountMap.get(account);
        var result = new Array();
        if (keys && keys != "") {
            var keyArr = keys.split(",");
            for (var i = 0; i < keyArr.length; i++) {
                var item = this.dataMap.get(keyArr[i]);
                result.push(item);
            }
        }
        return result;
    },

    claim: function(key){
        key = key.trim();
        if (key === "") {
            throw new Error("empty key");
        }
        var policy = this.dataMap.get(key);
        if (policy){
            policy.status = 1; // 申请理赔
            this.dataMap.set(key, policy);
        } else
            throw new Error("Policy number not exists")
        return policy;
    },

    check: function(key, actualStart, actualEnd) {
        var account = Blockchain.transaction.from;
        if (account != this.admin){
            throw new Error("Permission denied");
        }
        key = key.trim();
        if (key === "") {
            throw new Error("empty key");
        }
        var policy = this.dataMap.get(key);
        if(policy){
            if ( (policy.status == 1 || policy.status == -1) && actualStart != null && actualStart != "") {
                var actualStartDate = new Date(actualStart);
                var planStartDate = new Date(policy.planStart);
                var dateDiff = actualStartDate.getTime() - planStartDate.getTime(); //时间差的毫秒数
                //计算出小时数
                var hours = dateDiff / 3600.0 / 1000.0;
                var status;
                // delay more than 3 hours
                if (hours >= 3){
                    // transfer
                    var result = Blockchain.transfer(policy.account, new BigNumber(policy.amount));
                    if (result == 0){
                        // success
                        status = 2;
                    }else{
                        // fail
                        status = -1;
                    }
                }else{
                   status = 3;
                   Blockchain.transfer(this.admin, new BigNumber(policy.premium));
                }
                policy.actualStart = actualStart;
                policy.actualEnd = actualEnd;
                policy.status = status;
                this.dataMap.set(key, policy);
            } else
                throw new Error("Policy not in active")
        } else
            throw new Error("Policy number not exists")
        return policy;
    },

    setRate: function(rate){
        if (Blockchain.transaction.from == this.admin){
            this.rate = rate;
        }
        else
            throw new Error("Permission denied");
        return this.rate;
    },

    getRate: function(){
        return this.rate;
    },

    transfer: function(value){
        try{
            var result = Blockchain.transfer(this.admin, new BigNumber(value));
            console.log("transfer result:", result);
            return result;
        } catch(e){
            throw new Error(e.message); 
        }
    },

    isAdmin: function(){
        if (Blockchain.transaction.from == this.admin){
            return true;
        }else
            return false;
    },

    getByStatus: function(status) {
        var result = new Array();
        for(var i=0; i<this.size; i++){
            var key = this.arrayMap.get(i);
            var item = this.dataMap.get(key);
            if (item.status.toString() == status){
                result.push(item);
            }
        }
        return result;
    }

};

module.exports = Policy;
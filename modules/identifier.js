function getPaymentID() {
    // payment ID should be random and unique for each payment
    // only alphanumeric characters lowercase and uppercase are allowed
    // length of payment ID is 32 characters
    var paymentID = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < 32; i++) {
        paymentID += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return paymentID;
}

module.exports = {
    getPaymentID: getPaymentID
}
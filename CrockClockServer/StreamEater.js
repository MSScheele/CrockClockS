new function () {

    function StreamEater() {
    }

    StreamEater.consumeStream = function (stream) {
        return new Promise(function (resolve, reject) {
            var data = '';
            stream.on('data', function (chunk) {
                data += chunk;
            });
            stream.on('close', function () {
                resolve(data);
            });
            stream.on('error', function (error) {
                reject(error);
            });
        });
    };

    return StreamEater;
}();
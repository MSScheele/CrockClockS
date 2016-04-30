function StreamEater() {
}

StreamEater.consumeStream = function (stream) {
    return new Promise(function (resolve, reject) {
        var data = '';
        stream.on('readable', function () {
            var chunk = stream.read();
            if (chunk !== null) {
                data += chunk;
            } else {
                resolve(data);
            }
        });
        stream.on('close', function () {
            resolve(data);
        });
        stream.on('error', function (error) {
            reject(error);
        });
        stream.resume();
    });
};

module.exports = StreamEater;
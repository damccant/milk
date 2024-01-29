const { spawn } = require('child_process');
async function makeQrCode(s) {
    return qrencode.output;
}

function makeRawQrCode(request, response) {
    response.setHeader('Content-Type', 'image/x-png');
    const qrencode = spawn('qrencode', ['-o', '-']);
    //console.log('encoding: ' + request.params.s);
    qrencode.stdin.write(request.params.s);
    qrencode.stdin.end();
    qrencode.stdout.pipe(response);
}

function makeQrCode(request, response) {
    response.setHeader('Content-Type', 'image/x-png');
    const qrencode = spawn('qrencode', ['-m', '1', '-o', '-']);
    var toEncode = "https://cpri.ddns.net/milk/bin/" + request.params.id;
    //console.log('encoding: ' + toEncode);
    qrencode.stdin.write(toEncode);
    qrencode.stdin.end();
    qrencode.stdout.pipe(response);
}

module.exports = {
	makeRawQrCode,
    makeQrCode
}
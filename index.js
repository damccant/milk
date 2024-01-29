const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser  = require('cookie-parser');
const app = express();
const port = 8443;
var privateKey = fs.readFileSync('certs/cpri.ddns.net.key', 'utf8');
var certificate = fs.readFileSync('certs/cpri.ddns.net.crt', 'utf8');

var credentials = {key: privateKey, cert: certificate};

app.use(express.static(path.join(__dirname, "public")));

// for parsing cookies
app.use(cookieParser())
// for parsing JSON
app.use(bodyParser.json())
// for parsing application/xwww-form-urlencoded
app.use(
	bodyParser.urlencoded({
		extended: true,
	})
)

app.set("view engine", "ejs");

var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);

app.get('/', (request, response) => {
	response.redirect('/milk')
});

app.get('/milk', (request, response) => {
	response.render('index');
});

const admin = require('./admin.js');
app.get('/milk/admin', admin.handleAdmin);
app.get('/milk/admin/poweroff', admin.handlePoweroff);
app.post('/milk/admin/poweroff', admin.handlePoweroff);
app.get('/milk/admin/reboot', admin.handleReboot);
app.post('/milk/admin/reboot', admin.handleReboot);
app.get('/milk/admin/reset', admin.handleResetDatabase);
app.post('/milk/admin/reset', admin.handleResetDatabase);
app.get('/milk/admin/reformat', admin.handleReformat);
app.post('/milk/admin/reformat', admin.handleReformat);
app.get('/milk/admin/sequence', admin.handleResetSequence);
app.post('/milk/admin/sequence', admin.handleResetSequence);
app.locals.getFreeSpace = admin.getFreeSpace;

const qrcode = require('./qrcode.js');
app.get('/milk/makeRawQrCode/:s', qrcode.makeRawQrCode);
app.get('/milk/qr/:id.png', qrcode.makeQrCode);

const bin = require('./bin.js');
app.get('/milk/search', bin.search);
app.get('/milk/bins', bin.listBins);
app.get('/milk/create', bin.getCreateBin);
app.post('/milk/create', bin.postCreateBin);
app.get('/milk/create_id', bin.getCreateBinWithId);
app.post('/milk/create_id', bin.postCreateBinWithId);
//app.get('/milk/move', bin.moveBin);
//app.post('/milk/move', bin.moveBin);
app.get('/milk/img/:id', bin.handleImg);
app.post('/milk/img/:id', bin.handleImg);
app.get('/milk/bin/:id', bin.specificBin);
app.post('/milk/bin/:id', bin.specificBin);
app.get('/milk/print/:id', bin.printableBin);
app.post('/milk/delete/:id', bin.postDeleteBin);

const wifi = require('./wifi.js');
app.get('/milk/wifi', wifi.handleWifi);
app.post('/milk/wifi', wifi.handleWifi);

httpServer.listen(8080);
httpsServer.listen(8443);

/*const login = require('./login.js');
app.locals.login = login; // made this module available to all EJS views
// this is needed because all session management functions are in this module
// and need to be accessed by a lot of different pages
app.post('/login', login.doLogin);
app.get('/login', login.displayLogin);
app.post('/logout', login.doLogout);
app.post('/delete_user', login.doDelete);
app.get('/register', (request, response) => {
	response.render("register");
});
app.post('/register', login.registerUser);

app.get('/', (request, response) => {
	var session = request.cookies.session;
	var redir_url = '/';
	response.render("index", {session, redir_url});
})

const company = require('./company.js');
app.get('/company', company.listCompanies);
app.get('/company/:id', company.specificCompany);

const search = require('./search.js');
app.get('/search', search.specificJob);

const job = require('./job.js');
app.get('/job/:id', job.printJob);

const apply = require('./apply.js');
app.get('/apply/:id', apply.jobApply);

const user = require('./change.js');
app.get('/change_pass', user.changePassword);
app.get('/update_user', user.changeUser);*/


/*app.listen(port, () => {
	console.log('Listening on port ' + port);
})*/



const pool = require('./pool').pool;
const cookieParser = require('cookie-parser');
const user = require('./user.js');
const isValidCreds = user.isValidCreds;

class TwoWayMap {
	constructor(map) {
		this.map = map;
		this.reverseMap = {};
		for(const key in map) {
			const value = map[key];
			this.reverseMap[value] = key;
		}
	}
	get(key) { return this.map[key]; }
	revGet(key) { return this.reverseMap[key]; }
	set(key, value) { this.map[key] = value; this.reverseMap[value] = key; }
	unset(key) {
		if(this.map[key] === undefined)
			return;
		delete this.reverseMap[this.map[key]];
		delete this.map[key];
	}
}
const sessions = new TwoWayMap({});

function getLoggedUser(session) {
	if(session === undefined)
		return undefined;
	return sessions.get(session);
}

function logout(request) {
	var cookie = request.cookies.session;
	sessions.unset(cookie);
}

async function doLogin(request, response) {
	var cookie = request.cookies.session;
	if(getLoggedUser(cookie) !== undefined) {
		logout(request);
	}
	var username = request.body.username;
	var password = request.body.password;
	var valid = await isValidCreds(username, password);
	if(valid) {
		console.log("username " + username + " and password " + password + " seem valid");
		var newSession = "";
		do {
			newSession=Math.random().toString();
			newSession=newSession.substring(2, newSession.length);
		} while(sessions.get(newSession) !== undefined);
		sessions.set(newSession, username);
		response.cookie('session', newSession);
		console.log(sessions.map);
	}

	if(request.body.redir_url !== undefined) {
		console.log("Redirecting to " + request.body.redir_url);
		response.redirect(request.body.redir_url);
	}
	else
	{
		console.log("No redir_url specified, rendering login");
		request.cookies.session = newSession;
		displayLogin(request, response);
	}
}

function doLogout(request, response) {
	logout(request);
	var session = undefined;
	if(request.body.redir_url !== undefined)
		response.redirect(request.body.redir_url);
	else
		response.render("logout", {session});
}

function doDelete(request, response) {
	var cookie = request.cookies.session;
	var username = getLoggedUser(cookie);
	if(username === undefined) {
		response.sendStatus(401);
		return;
	}
	logout(request);
	user.deleteUser(username);
	response.render("delete_user");
}

async function displayLogin(request, response) {
	var session = request.cookies.session;
	console.log("session is " + session + " (user = " + getLoggedUser(session) + ")");
	var username = getLoggedUser(session);
	if(username === undefined)
		response.render("login", {session});
	else {
		const userInfo = await user.getUserInfo(username);
		console.log(userInfo);
		response.render("dashboard", {userInfo});
	}
}

async function registerUser(request, response) {
	if(request.body === undefined)
		return;
	//console.log("request body = " + request.body);
	var username = request.body.username;
	var password = request.body.password;
	var education = request.body.education;
	if(education === "")
		education = undefined;
	var jobExp = request.body.jobExp;
	if(jobExp === "")
		jobExp = undefined;
	var resume = request.body.resume;
	if(resume === "")
		resume = undefined;
	if(user.createUser(username, password, education, jobExp, resume)) {
		doLogin(request, response);
	}
	else
		response.sendStatus(400);
}

module.exports = {
	getLoggedUser,
	doLogin,
	doLogout,
	doDelete,
	registerUser,
	displayLogin
}
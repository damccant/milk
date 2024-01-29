const pool = require('./pool').pool;
const crypto = require('crypto');
const login = require('./login.js');

function md5(password) {
	return crypto.createHash('md5').update(password).digest("hex");
}

async function changePassword(request, response) {
	const password = request.query.password;
	const username = login.getLoggedUser(request.cookies.session);
	var hashed_pass = md5(password);
	const message = "Password Changed";
	const result = await pool.query('UPDATE UserApplicant SET hashed_pass = $1 WHERE userId = $2;', [hashed_pass, username]);
	response.render("change", {message});
	return result.rowCount > 0;
}

async function changeUser(request, response) {
	const resume = request.query.resume;
    const jobExp = request.query.jobExp;
    const education = request.query.education;
	const username = login.getLoggedUser(request.cookies.session);
    const message = "Account Information Updated";
	const result1 = await pool.query('UPDATE UserApplicant SET education = $1 WHERE userId = $2;', [education, username]);
	const result2 = await pool.query('UPDATE UserApplicant SET jobExp = $1 WHERE userId = $2;', [jobExp, username]);
	const result3 = await pool.query('UPDATE UserApplicant SET resume = $1 WHERE userId = $2;', [resume, username]);
	response.render("change", {message});
	return result1.rowCount > 0;
}

module.exports = {
	changePassword,
	changeUser
}
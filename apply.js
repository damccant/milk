const pool = require('./pool').pool;
const cookieParser = require('cookie-parser');
const login = require('./login.js');

async function jobApply(request, response) {
	const jobID = request.params.id;
	const curUser = login.getLoggedUser(request.cookies.session);
	let title = "Not Logged In or Already Applied";

	if(curUser !== undefined){
		const count = await pool.query('SELECT Count(*) FROM Application WHERE jobId = $2 AND userId = $1', [curUser, jobID]);

		if(count.rows.at(0).count == 0){
			const jobs = await pool.query('INSERT INTO Application(userId, jobId) VALUES ($1, $2)', [curUser, jobID]);
            title = "Successfully Applied!";
		}
        //title = "Successfully Applied!";
	}
    response.render("apply", {title})
}

module.exports = {
	jobApply
}
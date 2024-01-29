const pool = require('./pool').pool;
const cookieParser = require('cookie-parser');

const login = require('./login.js');

async function listCompanies(request, response) {
	const result = await pool.query('SELECT * FROM Company');
	var content = "";
	for(var x=0; x < result.rows.length; x++) {
		content += "<li>";
		content += "<a href='/company/";
		content += result.rows[x].companyid;
		content += "'>";
		content += result.rows[x].companyname;
		content += "</a></li>";
	}
	/*content += "<table class='table table-bordered table-striped table-hover'><tbody><tr>";
	for (var x=0; x < result.fields.length; x++) {
		content += "<th>" + result.fields[x].name + "</th>"
	}
	content += "</tr>";

	for(var x=0; x < result.rows.length; x++) {
		content += "<tr>";
		console.log(result.rows[x]);
		for(var y=0; y < result.fields.length; y++) {
			content += "<td>";
			content += result.rows[x][result.fields[y].name];
			content += "</td>";
		}
		content += "</tr>";
	}

	content += "</tbody></table>";*/

	response.render("dynamic", {content});
}

async function specificCompany(request, response) {
	const id = parseInt(request.params.id);
	if(isNaN(id) || !isFinite(id)) {
		console.log(id + " is NaN or infinite!");
		console.log("Got this value from parsing " + request.params.id);
		response.sendStatus(404);
		return;
	}
	const result = await pool.query('SELECT * FROM Company WHERE companyid = $1;', [id]);
	if(result.rows.length < 1) {
		response.sendStatus(404);
		return;
	}
	const companyname = result.rows[0].companyname;
	const jobs = await pool.query('SELECT * FROM JobPosting WHERE companyid = $1;', [id]);
	response.render("company", {companyname, jobs})
}

module.exports = {
	listCompanies,
	specificCompany,
}
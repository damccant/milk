const pool = require('./pool').pool;
const fs = require('fs');
const spawn = require('child_process').spawn;
const execSync = require('child_process').execSync;

const IMG_PATH = '/mnt/mmcblk0p2/img';
//const IMG_PATH = '/Users/derekmccants/img';

const _1KB = 1024;
const _1MB = _1KB * 1024;
const _1GB = _1MB * 1024;
const _1TB = _1GB * 1024;
const _1PB = _1TB * 1024;

function niceify(num) {
	if(!isFinite(num))
		return "infinite";
	else if(num >= _1PB)
		return (Math.round(num / _1PB * 10) / 10) + " PB";
	else if(num >= _1TB)
		return (Math.round(num / _1TB * 10) / 10) + " TB";
	else if(num >= _1GB)
		return (Math.round(num / _1GB * 10) / 10) + " GB";
	else if(num >= _1MB)
		return (Math.round(num / _1MB * 10) / 10) + " MB";
	else if(num >= _1KB)
		return (Math.round(num / _1KB * 10) / 10) + " KB";
	else
		return num + " bytes"
}

function getFreeSpace() {
	const stats = fs.statfsSync(IMG_PATH);
	const total = stats.blocks * stats.bsize;
	const avail = stats.bavail * stats.bsize;
	return {
		total: total,
		total_nice: niceify(total),
		avail: avail,
		avail_nice: niceify(avail),
	};
	//fs.statfs(IMG_PATH, (err, stats) => {});
}

async function listImgs() {
	fs.opendir(IMG_PATH).then(async (d) => {
		var e;
		while((e = await d.read()) !== null) {
			e.name;
		}
		d.closedir();
	});
	
}

async function dropTables() {
	await pool.query('DROP TABLE img CASCADE').catch((e) => {});
	await pool.query('DROP TABLE bins CASCADE').catch((e) => {});
	await pool.query('DROP SEQUENCE bins_seq CASCADE').catch((e) => {});
}

async function createTables() {
	const sequence = await pool.query('CREATE SEQUENCE bins_seq START 20000 INCREMENT 1;');
	const result1 = await pool.query('CREATE TABLE bins(' +
		'binid INT PRIMARY KEY,' +
		'name VARCHAR(255),' +
		'dscr VARCHAR(1024)' +
		');'
	);
	const result2 = await pool.query('CREATE TABLE img(' +
		'binid INT REFERENCES bins(binid) NOT NULL,' +
		'image CHAR(32) NOT NULL' +
		');'
	);
}

async function resetSequence(start) {
	const c = await pool.connect();
	try {
		await c.query('BEGIN');
		await c.query('DROP SEQUENCE bins_seq');
		// not SQL injection because start is already determined to be an integer
		await c.query('CREATE SEQUENCE bins_seq START ' + start + ' INCREMENT 1');
		await c.query('COMMIT');
	} catch (e) {
		await c.query('ROLLBACK');
	} finally {
		c.release();
	}
}

async function reformat_reboot() {
	execSync('/opt/reformat_recreatedb.sh'); // script handles reformatting and recreating db
	createTables().then(reboot);
}

async function poweroff() {
	spawn('/opt/poweroff.sh'); // The OS will kill the database for us
	process.exit(0);
}

async function reboot() {
	spawn('/opt/reboot.sh'); // The OS will kill the database for us
	process.exit(0);
}

async function handleResetSequence(request, response) {
	if(request.method === 'GET') {
		response.render("sequence");
	} else if(request.method === 'POST') {
		const id = parseInt(request.body.start);
		if(isNaN(id) || !isFinite(id)) {
			response.status(400).render("sequence");
		} else {
			const the_id = Math.floor(id); // don't allow decimal
			console.log("RESETTING SEQUENCE TO " + the_id)
			resetSequence(the_id);
			response.redirect('/milk/create');
		}
	}
}

async function handleReformat(request, response) {
	if(request.method === 'GET') {
		const action = "Reformat Storage";
		const notes = [
			"This will permanently delete ALL existing data in the database!  This action cannot be undone!",
			"This action should only be performed by advanced users and normally not necessary.  Only do this if you know what you are doing!",
			"After the reformat, MILK will automatically reboot.  This reboot may take longer than usual, so please be patient and do not power off or enter any other page doing the reformat.",
			"This is your last chance to back out!",
		];
		const confirm_destructive = "DELETE EVERYTHING";
		response.render("confirm_action", {action, notes, confirm_destructive});
	} else if(request.method === 'POST') {
		response.render("reboot");
		reformat_reboot();
	}
}

async function handleResetDatabase(request, response) {
	if(request.method === 'GET') {
		const action = "Reset Database";
		const notes = [
			"This will permanently delete ALL existing data in the database!  This action cannot be undone!",
			"This is your last chance to back out!",
		];
		const confirm_destructive = "DELETE EVERYTHING";
		response.render("confirm_action", {action, notes, confirm_destructive});
	} else if(request.method === 'POST') {
		dropTables().finally(createTables).then(() => {
			response.redirect('/milk/bins');
		});
	}
}

async function handlePoweroff(request, response) {
	if(request.method === 'GET') {
		const action = "Power Off";
		const notes = [
			"After shutting down, you may still need to remove power.  To restart, physically power MILK back on.",
			"After shutdown, there is no way to remotely turn MILK back on.  This is your last chance to back out!",
		];
		const confirm_destructive = undefined;
		response.render("confirm_action", {action, notes, confirm_destructive});
	} else if(request.method === 'POST') {
		response.render("poweroff");
		poweroff();
	}
}

async function handleReboot(request, response) {
	if(request.method === 'GET') {
		const action = "Reboot";
		const notes = [
			"After rebooting, you should be automatically redirected to the home page.  The reboot may take a few minutes, please be patient."
		];
		const confirm_destructive = undefined;
		response.render("confirm_action", {action, notes, confirm_destructive});
	} else if(request.method === 'POST') {
		response.render("reboot");
		reboot();
	}
}

async function handleAdmin(request, response) {
	response.render("admin");
}

module.exports = {
	getFreeSpace,
	handleAdmin,
	handlePoweroff,
	handleReboot,
	handleResetDatabase,
	handleReformat,
	handleResetSequence,
	IMG_PATH,
}
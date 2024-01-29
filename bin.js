const pool = require('./pool').pool;
const { randomFillSync } = require('crypto');
const fs = require('fs');
const path = require('path');
const busboy = require('busboy');
const IMG_PATH = require('./admin.js').IMG_PATH;

const random = (() => {
	const buf = Buffer.alloc(16);
	return () => randomFillSync(buf).toString('hex');
})();

async function search(request, response) {
	const query = request.query.query;
	const query_per = '%' + query + '%';
	const id = parseInt(query);
	var results = null;
	if(isNaN(id) || !isFinite(id)) {
		results = await pool.query(
			'SELECT binid, name, LEFT(dscr, 100) AS dscr FROM bins WHERE name ILIKE $1 UNION ' +
			'SELECT binid, name, LEFT(dscr, 100) AS dscr FROM bins WHERE dscr ILIKE $1', [query_per]);
	} else {
		results = await pool.query(
			'SELECT binid, name, LEFT(dscr, 100) AS dscr FROM bins WHERE CAST(binid AS TEXT) LIKE $1 UNION ' + 
			'SELECT binid, name, LEFT(dscr, 100) AS dscr FROM bins WHERE name ILIKE $1 UNION ' +
			'SELECT binid, name, LEFT(dscr, 100) AS dscr FROM bins WHERE dscr ILIKE $1', [query_per]);
	}
	response.render("search", {query, results});
}

async function listBins(request, response) {
	const results = await pool.query('SELECT binid, name, LEFT(dscr, 100) AS dscr FROM bins ORDER BY binid;');
	response.render("binlist", {results});
}

async function printableBin(request, response) {
	const id = parseInt(request.params.id);
	var name = null;
	try {
		const result = await pool.query('SELECT name FROM bins WHERE binid = $1', [id]);
		if(result.rows.length > 0) {
			name = result.rows[0].name;
		}
	} catch(e) {
		console.log(e);
	}
	response.render("printable", {id, name});
}

async function handleImg(request, response) {
	const img_id = request.params.id;
	const os_path = path.join(IMG_PATH, img_id);
	var ok = true;
	if(!os_path.startsWith(IMG_PATH)) {
		ok = false;
	}
	if(request.method === 'GET') {
		if(!ok) {
			response.sendStatus(404);
			return;
		}
		const r = fs.createReadStream(os_path);
		r.on('error', (e) => { response.sendStatus(404); })
		r.pipe(response)
	}
	else if(request.method === 'POST') {
		if(!ok) {
			response.sendStatus(400);
			return;
		}
		fs.rm(os_path, (e) => {
			console.log("Error while removing file \"" + os_path + "\":");
			console.log(e);
		});
		const result = await pool.query('DELETE FROM img WHERE image = $1', [img_id]);
		if(result.rowCount > 0)
			response.sendStatus(200);
		else
			response.sendStatus(400);
	}
}

async function doBinTasks(request, response, onclose) {
	const bb = busboy({headers: request.headers});
	var bin = {
		id: parseInt(request.params.id),
		imgs: [],
	};
	bb.on('file', (name, file, info) => {
		if(info.filename === undefined) { // bugfix, sometimes browsers upload an empty file if the user does not select anything
			console.log("Ignoring image with empty filename (pipe to /dev/null)");
			console.log(name);
			console.log(file);
			console.log(info);
			file.pipe(fs.createWriteStream("/dev/null"));
		} else {
			const r = random();
			const saveTo = path.join(IMG_PATH, r);
			const f = fs.createWriteStream(saveTo);
			f.on('error', (e) => {
				file.read();
				console.log("Error on file \"" + name + "\"");
				console.log(e);
			});
			file.pipe(f);
			bin.imgs.push(r);
		}
	});
	bb.on('field', (name, value, info) => {
		bin[name] = value;
	});
	bb.on('close', () => {
		onclose(bin);
	});
	request.pipe(bb);
}

async function insertBinImgs(c, bin) {
	if(bin.imgs.length == 0)
		return [];
	var img_results = [];
	for(const i of bin.imgs) {
		const t = await c.query('INSERT INTO img(binid, image) VALUES ($1, $2);', [bin.id, i]);
		img_results.push(t);
	}
	return img_results;
}

async function postSpecificBin(request, response) {
	doBinTasks(request, response, async (bin) => {
		const c = await pool.connect();
		try {
			await c.query('BEGIN');
			const result = await c.query('UPDATE bins SET name = $1, dscr = $2 WHERE binid = $3;', [bin.name, bin.dscr, bin.id]);
			var img_results = insertBinImgs(c, bin);
			await c.query('COMMIT');
			getSpecificBin(request, response);
		} catch (e) {
			await c.query('ROLLBACK');
			console.log(e);
			response.sendStatus(500);
		} finally {
			c.release();
		}
	});
}

async function getSpecificBin(request, response) {
	const id = parseInt(request.params.id);
	if(isNaN(id) || !isFinite(id)) {
		console.log(id + " is NaN or infinite!");
		console.log("Got this value from parsing " + request.params.id);
		response.redirect('/milk/search?query=' + request.params.id);
		return;
	}
	const result = await pool.query('SELECT * FROM bins WHERE binid = $1;', [id]);
	if(result.rows.length < 1) {
		response.redirect('/milk/search?query=' + id);
		return;
	}
	var bin = {
		id: result.rows[0].binid,
		qr: "/milk/qr/" + result.rows[0].binid + ".png",
		name: result.rows[0].name,
		dscr: result.rows[0].dscr,
		imgs: [],
	};
	const img_result = await pool.query('SELECT image FROM img WHERE binid = $1;', [bin.id]);
	for(const r of img_result.rows) {
		bin.imgs.push({id: r.image, path: "/milk/img/" + r.image});
	}
	response.render("bin", {bin});
}

async function specificBin(request, response) {
	if(request.method === 'POST')
		postSpecificBin(request, response);
	else
		getSpecificBin(request, response);
}

async function postCreateBin(request, response) {
	doBinTasks(request, response, async (bin) => {
		var failed = true;
		const c = await pool.connect();
		try {
			await c.query('BEGIN');
			const binid = await c.query('SELECT nextval(\'bins_seq\')');
			bin.id = binid.rows[0].nextval;
			const result = await c.query('INSERT INTO bins(binid, name, dscr) VALUES ($1, $2, $3)', [bin.id, bin.name, bin.dscr]);
			var img_results = insertBinImgs(c, bin);
			await c.query('COMMIT');
			failed = false;
		} catch(e) {
			await c.query('ROLLBACK');
			console.log(e);
		} finally {
			c.release();
		}
		if(failed) {
			response.send(500);
		} else {
			response.redirect('/milk/bin/' + bin.id);
		}
	});
}

async function postCreateBinWithId(request, response) {
	doBinTasks(request, response, async (bin) => {
		var failed = false;
		const c = await pool.connect();
		try {
			await c.query('BEGIN');
			bin.id = bin.id_no;
			const result = await c.query('INSERT INTO bins(binid, name, dscr) VALUES ($1, $2, $3)', [bin.id, bin.name, bin.dscr]).catch(() => {
				failed = true;
			}).then(() => {
				if(!failed) {
					var img_results = insertBinImgs(c, bin);
					c.query('COMMIT');
				}
			});
		} catch(e) {
			failed = true;
			await c.query('ROLLBACK');
			console.log(e);
		} finally {
			c.release();
		}
		if(failed) {
			response.send(500);
		} else {
			response.redirect('/milk/bin/' + bin.id);
		}
	});
}

async function postDeleteBin(request, response) {
	const id = parseInt(request.params.id);
	if(isNaN(id) || !isFinite(id)) {
		console.log(id + " is NaN or infinite!");
		console.log("Got this value from parsing " + request.params.id);
		response.sendStatus(404);
		return;
	}
	const imgs = await pool.query('SELECT * FROM img WHERE binid = $1', [id]);
	for(const r of imgs.rows) {
		const os_path = path.join(IMG_PATH, r.image);
		if(!os_path.startsWith(IMG_PATH))
			continue;
		fs.rm(os_path, (e) => {
			console.log("Error while removing file \"" + os_path + "\":");
			console.log(e);
		});
	}
	const c = await pool.connect();
	try {
		await c.query('BEGIN');
		await c.query('DELETE FROM img WHERE binid = $1', [id]);
		await c.query('DELETE FROM bins WHERE binid = $1', [id]);
		await c.query('COMMIT');
		response.sendStatus(201);
	} catch (e) {
		await c.query('ROLLBACK');
		response.sendStatus(500);
	} finally {
		c.release();
	}
}

async function getCreateBin(request, response) {
	response.render("create");
}

async function getCreateBinWithId(request, response) {
	response.render("create_id");
}

async function moveBin(request, response) {
	if(request.method === 'GET') {
		response.render("move");
	} else if(request.method === 'POST') {
		const old_id = Math.floor(parseInt(request.body.old));
		const new_id = Math.floor(parseInt(request.body.new));
		if(isNaN(old_id) || isNaN(new_id) || !isFinite(old_id) || !isFinite(new_id)) {
			response.sendStatus(400);
		}
		await pool.query("UPDATE bins SET binid = $1 WHERE binid = $2", [new_id, old_id]);
		// TODO: fix this if it fails
	}
}

module.exports = {
	search,
	listBins,
	printableBin,
	handleImg,
	specificBin,
	getCreateBin,
	postCreateBin,
	getCreateBinWithId,
	postCreateBinWithId,
	postDeleteBin,
	moveBin,
};
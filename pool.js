const Pool = require('pg').Pool;
const the_pool = new Pool({
	user: 'tc',
	host: 'localhost',
	database: 'postgres',
	password: 'tc',
	port: 5432,
});

the_pool.connect();

const pool = the_pool;

module.exports = {
	pool
}
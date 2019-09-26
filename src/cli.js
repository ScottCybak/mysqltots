import arg from 'arg';
import mysql from 'mysql';

function parseArgumentsIntoOptions(rawArgs) {
	const args = arg({
		'--host': String,
		'-h': '--host',
		'--user': String,
		'-u': '--user',
		'--password': String,
		'-p': '--password',
		'--db': String,
		'-d': '--db', 
	}, {
		argv: rawArgs.slice(2)
	})

	return {
		mysql: {
			host: args['--host'] || 'localhost',
			user: args['--user'] || null,
			password: args['--password'] || null,
			database: args['--db'] || null
		}
	}
}

function die(err) {
	console.error('\x1b[31m%s\x1b[0m', err || 'undefined_error');
	process.exit(1);
	return;
}

export async function cli(args) {

	let opt = parseArgumentsIntoOptions(args);
	const db = new Database(opt.mysql);
	
	await db.connect();

	const tables = await(db.tables()),
		columns = await db.columns(tables);

	console.log('tables', columns);

	// gracefull exit
	db.disconnect();
	process.exit(0);
}

const TYPES = {
	bigint: 'number',
	binary: 'string',
	bit: 'number',
	blob: 'string',
	char: 'string',
	date: 'Date',
	datetime: 'Date',
	decimal: 'number',
	double: 'number',
	float: 'number',
	int: 'number',
	integer: 'number',
	longblob: 'string',
	longtext: 'string',
	mediumblob: 'string',
	mediumint: 'number',
	mediumtext: 'string',
	numeric: 'number',
	smallint: 'number',
	text: 'string',
	tinyblob: 'string',
	tinyint: 'number',
	tinytext: 'string',
	time: 'string',
	timestamp: 'Date',
	varbinary: 'string',
	varchar: 'string',
}

class Database {

	constructor(
		mysqlConnectArgs
	) {
		this._mysql = mysqlConnectArgs;
		this._connection = mysql.createConnection(mysqlConnectArgs);
	}

	async connect() {
		const conn = this._connection;
		return new Promise((res, rej) => {
			conn.connect(err => {
				if (err) {
					die(err.sqlMessage);
				} else {
					console.log('DB - succesfully connected to ', this._mysql.host);
					res();
				}
			})
		})
	}

	async tables() {
		const field = `Tables_in_${this._mysql.database}`;
		return this.query("SHOW TABLES").then(rows => rows.map(r => r[field]));
	}

	async columns(tables) {
		const db = this._mysql.database;
		return Promise.all(
			(tables || [])
				.map(
					table => this
						.query("SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = ? AND table_schema = ?", [table, db])
						.then(
							rows => rows.map(
								row => `${row.COLUMN_NAME}${this.getColumnType(row)};`,
							)
						)
						.then(rows => [table, rows])
				)
			)
			// .then(all => new Map(all));
	}

	async query(qry, args) {
		const conn = this._connection;
		return new Promise((res, rej) => {
			conn.query(qry, args, (err, rows, fields) => {
				if (err) {
					die(err.sqlMessage);
				} else {
					res(rows);
				}
			})
		})
	}

	disconnect() {
		console.log('DB - disconnected from ', this._mysql.host);
		this._connection.destroy()
	}
	
	getColumnType(col) {
		const optional = col.IS_NULLABLE === 'YES';
		let t = TYPES[col.DATA_TYPE];
		if (!t) {
			// check for enum
			if (col.DATA_TYPE === 'enum') {
				t = col.COLUMN_TYPE
					.substr(5, col.COLUMN_TYPE.length - 6)
					.split(/,(?=(?:[^']*'[^']*')*[^']*$)/)
					.map(word => {
						word = word.substr(1, word.length - 2);
						console.log('word', {word})
						return word;
					})
					.join(' | ');
				// 'this','is','''a''','"test'
			} else {
				console.warn('unable to parse column: ', col);
				die(`unhandled type: ${col.DATA_TYPE}`);
			}
		}

		return `${optional ? '?: ' : ': '}${t}`;
	}
	
}
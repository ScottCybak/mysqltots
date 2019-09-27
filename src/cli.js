import arg from 'arg';
import mysql from 'mysql';
import fs from 'fs';

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
			'--file': String,
			'-f': '--file',
			'--prefix': String,
			'--suffix': String,
			'--force-optional': Boolean,
			'-f': '--force-optional'
		}, {
			argv: rawArgs.slice(2)
		}),
		file = args['--file'] || `./${args['--db']}Schema.ts`;
	
	return {
		mysql: {
			host: args['--host'] || 'localhost',
			user: args['--user'] || null,
			password: args['--password'] || null,
			database: args['--db'] || null
		},
		file,
		forceOptional: !!(args['--force-optional'])
	}
}

function die(err) {
	console.error('\x1b[31m%s\x1b[0m', err || 'undefined_error');
	process.exit(1);
	return;
}

export async function cli(args) {

	let opt = parseArgumentsIntoOptions(args),
		output = ['/* automatically generated by MySQLtoTS */', '', `export namespace ${opt.mysql.database} {`, ''];

	console.log(opt);

	const db = new Database(opt);
	
	await db.connect();

	const tables = await(db.tables()),
		columns = await db.columns(tables, opt.forceOptional);

	db.disconnect();

	columns.forEach(([table, cols])=> {
		output.push(`\texport interface ${table} {`);
		cols.forEach(col => {
			output.push(`\t\t${col}`);
		})
		output.push('\t}', '');
	})

	output.push('}', '');

	fs.writeFile(opt.file, output.join('\n'), err => {
		if (err) {
			console.warn(err);
			die(`unable to write ${args.file}`);
		}
		console.log(`success: ${opt.file}`);
		process.exit(0);
	});
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
		params
	) {
		const p = this.params = params;
		this._connection = mysql.createConnection(p.mysql);
	}

	async connect() {
		const conn = this._connection;
		return new Promise((res, rej) => {
			conn.connect(err => {
				if (err) {
					die(err.sqlMessage);
				} else {
					console.log('DB - succesfully connected to ', this.params.mysql.host);
					res();
				}
			})
		})
	}

	async tables() {
		const field = `Tables_in_${this.params.mysql.database}`;
		return this.query("SHOW TABLES").then(rows => rows.map(r => r[field]));
	}

	async columns(tables, forceOptional) {
		const db = this.params.mysql.database;
		return Promise.all(
			(tables || [])
				.map(
					table => this
						.query("SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = ? AND table_schema = ?", [table, db])
						.then(
							rows => rows.map(
								row => this.getColumnType(row.COLUMN_NAME, row, forceOptional),
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
		console.log('DB - disconnected from ', this.params.mysql.host);
		this._connection.destroy()
	}
	
	getColumnType(name, col, forceOptional) {
		const autoInc = /auto_increment/.test(col.EXTRA),
			optional = forceOptional || autoInc || col.IS_NULLABLE === 'YES',
			type = col.DATA_TYPE;
		let t = TYPES[type];
		
		if (!t) {
			// check for enum
			if (type === 'enum') {
				// we can use ", ', or `
				t = col.COLUMN_TYPE
					.substr(5, col.COLUMN_TYPE.length - 6)
					.split(/,(?=(?:[^']*'[^']*')*[^']*$)/)
					.map(word => word.substr(1, word.length - 2))
					.map(word => {
						if (!/'/g.test(word)) {
							return `'${word}'`;
						} else if (!/"/g.test(word)) {
							return `"${word}"`;
						} else if (!/`/g.test(word)) {
							return '`' + word + '`';
						}
						return 'string';
					})
					.join(' | ');
			} else {
				console.warn('unable to parse column: ', col);
				die(`unhandled type: ${col.DATA_TYPE}`);
			}
		}

		return `${name}${optional ? '?: ' : ': '}${t};${autoInc ? ' // auto_increment' : ''}`;
	}
	
}
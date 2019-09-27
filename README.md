# MySQLtoTS

This package is a simple CLI utility that when ran, connects to a MySQL database, and generates a namespace with interfaces for each of the tables.

# Features 

- auto_increment fields are automatically marked as optional
- nullable fields are flagged as optional
- will strictly define enums: eg, `enum('a', 'b', 'c')` will resolve as `field: 'a' | 'b' | 'c';`
	- quote/backtick safe!

# Sample Output

`mysqltots -u myuser -p ***** -h 127.0.0.1 -d mytestdb`

```typescript
/* automatically generated by MySQLtoTS */

export namespace mytestdb {

	export interface _dummy_ {
		id?: number; // auto_increment
		foo?: number;
		bar?: number;
		enumtest?: 'this' | 'is' | "''a''" | '"test';
	}

	export interface accounts {
		id?: number; // auto_increment
		name?: string;
		owner?: number;
		seed?: number;
	}

	export interface availability {
		id?: number; // auto_increment
		account?: number;
		provider: number;
		weekday: number;
		start: string;
		end: string;
	}
}
```

# Installation

`npm install`

`link mysqltots`

# Usage

## Arguments

MySQL specific arguments

--host, -h: mysql host (string) - defaults to `localhost`

--user, -u: mysql username (string)

--password, -p: mysql password (string)

--db, -d: mysql db name (this will be your namespace name)

Other arguments

--file, -f: path & filename to write file (string) - defaults to `./db.ts`

--force-optional, -f: forces all properties of a namespace to be optional (`?:`)




# Disclaimer

This code was written hastily, and to fill a very particular need i had at my workplace.  I make no guarantees on:

- the accuracy of this
- the security of this
- the realiability of this

and

- if it will work with your MySQL version (i am/was using 5.7.22)
- if it will work with your TypeScript version (i am/was using 3.2.4)
- if it will work your your Node version (i am/was using 12.4.0)
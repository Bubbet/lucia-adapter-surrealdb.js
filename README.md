# `@lucia-auth/adapter-surrealdb.js`

SurrealDB adapter for Lucia.

```
npm install @lucia-auth/adapter-surrealdb.js
```

## Schema

User ID can be numeric (see [Define user ID type](https://github.com/lucia-auth/lucia/blob/main/docs/pages/basics/users.md#define-user-id-type)) but session ID must be a string type.

`SurrealDBAdapter` takes a `Surreal` instance and a list of table names.

```ts
import { SurrealDBAdapter } from ".@lucia-auth/adapter-surrealdb.js";
import { Surreal } from "surrealdb.js";

const db = new Surreal();
await db.connect('http://localhost:8000');
await db.use({ namespace: "lucia", database: "auth" })

const adapter = new SurrealDBAdapter(db, {
	user: 'user',
	session: 'user_session'
})

// these two are optional, if you want SCHEMAFULL tables
await db.query(`
	DEFINE TABLE user SCHEMAFULL;
	DEFINE FIELD username ON TABLE user TYPE string;
	DEFINE INDEX usernameIndex ON TABLE user COLUMNS username UNIQUE;
`);

await db.query(`
	DEFINE TABLE user_session SCHEMAFULL;
	DEFINE FIELD user ON TABLE user_session TYPE record<user>;
	DEFINE FIELD expires_at ON TABLE user_session TYPE datetime;
	DEFINE FIELD country ON TABLE user_session TYPE option<string>;
`)

```
**[Lucia documentation](https://v3.lucia-auth.com)**

## Installation

```
npm install @lucia-auth/adapter-surrealdb.js
pnpm add @lucia-auth/adapter-surrealdb.js
yarn add @lucia-auth/adapter-surrealdb.js
```


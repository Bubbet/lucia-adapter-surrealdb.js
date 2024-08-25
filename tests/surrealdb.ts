import { testAdapter, databaseUser } from "@lucia-auth/adapter-test";
import { SurrealDBAdapter } from "../src";
import { RecordId, Surreal } from "surrealdb.js";

const db = new Surreal();
await db.connect('http://localhost:8000');
await db.use({ namespace: "lucia", database: "test" })

const adapter = new SurrealDBAdapter(db, async () => db, {
	user: 'user',
	session: 'user_session'
})

//await testAdapter(adapter);

await db.query(`
	REMOVE TABLE IF EXISTS user;
	DEFINE TABLE user SCHEMAFULL;
	DEFINE FIELD username ON TABLE user TYPE string;
	DEFINE INDEX usernameIndex ON TABLE user COLUMNS username UNIQUE;
`);

await db.query(`
	REMOVE TABLE IF EXISTS user_session;
	DEFINE TABLE user_session SCHEMAFULL;
	DEFINE FIELD user ON TABLE user_session TYPE record<user>;
	DEFINE FIELD expires_at ON TABLE user_session TYPE datetime;
	DEFINE FIELD country ON TABLE user_session TYPE option<string>;
`)

/*
db.exec(
	`CREATE TABLE user (
	id TEXT NOT NULL PRIMARY KEY,
	username TEXT NOT NULL UNIQUE
)`
).exec(`CREATE TABLE user_session (
	id TEXT NOT NULL PRIMARY KEY,
	user_id TEXT NOT NULL,
	expires_at INTEGER NOT NULL,
	country TEXT,
	FOREIGN KEY (user_id) REFERENCES user(id)
)`);
*/

await db.create(new RecordId('user', databaseUser.id), { username: databaseUser.attributes.username })

/*
db.prepare(`INSERT INTO user (id, username) VALUES (?, ?)`).run(
	databaseUser.id,
	databaseUser.attributes.username
);
*/

/*
const adapter = new BetterSqlite3Adapter(db, {
	user: "user",
	session: "user_session"
});
*/

await testAdapter(adapter);

import type {
	Adapter,
	DatabaseSession,
	RegisteredDatabaseSessionAttributes,
	DatabaseUser,
	RegisteredDatabaseUserAttributes,
	UserId
} from "lucia";
import type { RecordId, Surreal } from "surrealdb.js";

export class SurrealDBAdapter implements Adapter {
	private database: Surreal;
	private refresher: () => Promise<Surreal>;
	private escapedUserTableName: string;
	private escapedSessionTableName: string;
	private record: (key: string, value: string) => RecordId;

	constructor(database: Surreal, databaseRefresher: () => Promise<Surreal>, tableNames: TableNames, recordIdConstructor: (key: string, value: string) => RecordId) {
		this.database = database;
		this.refresher = databaseRefresher;
		this.escapedSessionTableName = tableNames.session;
		this.escapedUserTableName = tableNames.user;
		this.record = recordIdConstructor;
	}

	public async deleteSession(sessionId: string): Promise<void> {
		try {
			await this.database.delete(this.record(this.escapedSessionTableName, sessionId));
		} catch (e) {
			this.database = await this.refresher()
			return await this.deleteSession(sessionId);
		}
	}

	public async deleteUserSessions(userId: UserId): Promise<void> {
		try {
			await this.database.query(`
				DELETE ${this.escapedSessionTableName} WHERE user=${this.escapedUserTableName}:${userId}
		`);
		} catch (e) {
			this.database = await this.refresher()
			return await this.deleteUserSessions(userId);
		}
	}

	public async getSessionAndUser(
		sessionId: string
	): Promise<[session: DatabaseSession | null, user: DatabaseUser | null]> {
		try {
			const [databaseSession, databaseUser] = await Promise.all([
				this.getSession(sessionId),
				this.getUserFromSessionId(sessionId)
			]);
			return [databaseSession, databaseUser];
		} catch (e) {
			this.database = await this.refresher()
			return await this.getSessionAndUser(sessionId);
		}
	}

	public async getUserSessions(userId: UserId): Promise<DatabaseSession[]> {
		try {
			const result = (await this.database.query<SessionSchema[]>(`SELECT * FROM ${this.escapedSessionTableName} WHERE user=${this.escapedUserTableName}:${userId}`)).flat();
			return result.map((val) => {
				return transformIntoDatabaseSession(val);
			});
		} catch (e) {
			this.database = await this.refresher()
			return await this.getUserSessions(userId);
		}
	}

	public async setSession(databaseSession: DatabaseSession): Promise<void> {
		try {
			const value: Omit<SessionSchema, "id"> = {
				user: this.record(this.escapedUserTableName, databaseSession.userId),
				expires_at: databaseSession.expiresAt,
				...databaseSession.attributes
			};
			await this.database.create(this.record(this.escapedSessionTableName, databaseSession.id), value);
		} catch (e) {
			this.database = await this.refresher()
			return await this.setSession(databaseSession);
		}
	}

	public async updateSessionExpiration(sessionId: string, expiresAt: Date): Promise<void> {
		try {
			await this.database.merge(this.record(this.escapedSessionTableName, sessionId), {
				expires_at: expiresAt
			});
		} catch (e) {
			this.database = await this.refresher()
			return await this.updateSessionExpiration(sessionId, expiresAt);
		}
	}

	public async deleteExpiredSessions(): Promise<void> {
		try {
			await this.database.query(`DELETE FROM ${this.escapedSessionTableName} WHERE expires_at < time::now()`);
		} catch (e) {
			this.database = await this.refresher()
			return await this.deleteExpiredSessions();
		}
	}

	private async getSession(sessionId: string): Promise<DatabaseSession | null> {
		try {
			const result = await this.database.select(this.record(this.escapedSessionTableName, sessionId));
			if (!result) return null;
			return transformIntoDatabaseSession(result as any as SessionSchema);
		} catch (e) {
			this.database = await this.refresher()
			return await this.getSession(sessionId);
		}
	}

	private async getUserFromSessionId(sessionId: string): Promise<DatabaseUser | null> {
		try {
			const result = (await this.database.query<{ user: UserSchema }[][]>(`SELECT ${this.escapedUserTableName}.* FROM ${this.escapedSessionTableName} WHERE id=${this.escapedSessionTableName}:${sessionId}`)).flat();
			if (!result || !result[0]) return null;
			return transformIntoDatabaseUser(result[0].user);
		} catch (e) {
			this.database = await this.refresher()
			return await this.getUserFromSessionId(sessionId);
		}
	}
}

export interface TableNames {
	user: string;
	session: string;
}

interface SessionSchema extends RegisteredDatabaseSessionAttributes {
	id: RecordId;
	user: RecordId;
	expires_at: Date;
	[key: string]: unknown;
}

interface UserSchema extends RegisteredDatabaseUserAttributes {
	id: RecordId;
	[key: string]: unknown;
}

function transformIntoDatabaseSession(raw: SessionSchema): DatabaseSession {
	const { id, user: userId, expires_at: expiresAtUnix, ...attributes } = raw;
	return {
		userId: userId.id as string,
		id: id.id as string,
		expiresAt: expiresAtUnix,
		attributes
	};
}

function transformIntoDatabaseUser(raw: UserSchema): DatabaseUser {
	const { id, ...attributes } = raw;
	return {
		id: id.id as string,
		attributes
	};
}


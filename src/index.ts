import type {
	Adapter,
	DatabaseSession,
	RegisteredDatabaseSessionAttributes,
	DatabaseUser,
	RegisteredDatabaseUserAttributes,
	UserId
} from "lucia";
import { RecordId, Surreal } from "surrealdb.js";

export class SurrealDBAdapter implements Adapter {
	private database: Surreal;
	private escapedUserTableName: string;
	private escapedSessionTableName: string;

	constructor(database: Surreal, tableNames: TableNames) {
		this.database = database;
		this.escapedSessionTableName = tableNames.session;
		this.escapedUserTableName = tableNames.user;
	}

	public async deleteSession(sessionId: string): Promise<void> {
		await this.database.delete(new RecordId(this.escapedSessionTableName, sessionId));
	}

	public async deleteUserSessions(userId: UserId): Promise<void> {
		await this.database.query(`
				DELETE ${this.escapedSessionTableName} WHERE user=${this.escapedUserTableName}:${userId}
		`);
	}

	public async getSessionAndUser(
		sessionId: string
	): Promise<[session: DatabaseSession | null, user: DatabaseUser | null]> {
		const [databaseSession, databaseUser] = await Promise.all([
			this.getSession(sessionId),
			this.getUserFromSessionId(sessionId)
		]);
		return [databaseSession, databaseUser];
	}

	public async getUserSessions(userId: UserId): Promise<DatabaseSession[]> {
		const result = (await this.database.query<SessionSchema[]>(`SELECT * FROM ${this.escapedSessionTableName} WHERE user=${this.escapedUserTableName}:${userId}`)).flat();
		return result.map((val) => {
			return transformIntoDatabaseSession(val);
		});
	}

	public async setSession(databaseSession: DatabaseSession): Promise<void> {
		const value: Omit<SessionSchema, "id"> = {
			user: new RecordId(this.escapedUserTableName, databaseSession.userId),
			expires_at: databaseSession.expiresAt,
			...databaseSession.attributes
		};
		await this.database.update(new RecordId(this.escapedSessionTableName, databaseSession.id), value);
	}

	public async updateSessionExpiration(sessionId: string, expiresAt: Date): Promise<void> {
		await this.database.merge(new RecordId(this.escapedSessionTableName, sessionId), {
			expires_at: expiresAt
		});
	}

	public async deleteExpiredSessions(): Promise<void> {
		await this.database.query(`DELETE FROM ${this.escapedSessionTableName} WHERE expires_at < time::now()`);
	}

	private async getSession(sessionId: string): Promise<DatabaseSession | null> {
		const result = await this.database.select(new RecordId(this.escapedSessionTableName, sessionId));
		if (!result) return null;
		return transformIntoDatabaseSession(result as any as SessionSchema);
	}

	private async getUserFromSessionId(sessionId: string): Promise<DatabaseUser | null> {
		const result = (await this.database.query<{ user: UserSchema }[][]>(`SELECT ${this.escapedUserTableName}.* FROM ${this.escapedSessionTableName} WHERE id=${this.escapedSessionTableName}:${sessionId}`)).flat();
		if (!result || !result[0]) return null;
		return transformIntoDatabaseUser(result[0].user);
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


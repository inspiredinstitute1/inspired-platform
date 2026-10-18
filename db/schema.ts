import {integer,sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const learnerProgress=sqliteTable('learner_progress',{
 userId:text('user_id').primaryKey(),
 email:text('email').notNull(),
 displayName:text('display_name').notNull(),
 role:text('role',{enum:['Admin','Student']}).notNull().default('Student'),
 payload:text('payload').notNull(),
 version:integer('version').notNull().default(1),
 updatedAt:integer('updated_at').notNull()
});

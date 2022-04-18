import * as sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { Util } from '@hawryschuk/common';
import { DAO, Model } from '@hawryschuk/dao';

export class SQLiteDAO extends DAO {
    constructor(
        public models: any,
        public dbfile: string = './db2.sqlite',
    ) {
        super(models)
    }

    db = new sqlite3.Database(this.dbfile);

    finish() { return new Promise(resolve => this.db.close(err => resolve(err || null))); }

    columns: { [className: string]: { name: string; }[] } = {};

    ready$ = Promise
        .resolve(1)
        .then(async () => {
            console.log('getting ready...')
            for (const className of Object.keys(this.models)) {
                await this.run(`create table if not exists ${className} (id text UNIQUE, json text not null)`);
                const cols: { name: string; }[] = await this.query(`SELECT name FROM PRAGMA_TABLE_INFO('${className}')`);
                this.columns[className] = cols;
            }
            console.log('getting ready...')
        })
        .then(() => new Date);

    async run(sql: string, params?: string[]): Promise<any[]> {
        return await new Promise(async (resolve, reject) =>
            this.db.run(sql, params || [], (error) => {
                console.log({ RUN: { sql, params, error } });
                return error
                    ? reject(error)
                    : resolve(null)
            })
        );
    }

    async query(sql: string, params?: string[]): Promise<any[]> {
        return await new Promise(async (resolve, reject) =>
            this.db.all(sql, params || [], (error, results) => {
                console.log({ QUERY: { sql, params, error, results } })
                return error
                    ? reject(error)
                    : resolve(results)
            })
        );
    }

    async reset() {
        await Promise.all(Object.keys(this.models).map(tableName => this.run(`delete from ${tableName}`)));
        (this as any).cacheQuery = {};
    }

    async create<M extends Model>(klass: any, data: M): Promise<M> {
        const object = await super.create(klass, data);
        const cols = this.columns[this.className(klass)];
        const params = cols.map(col => col.name === 'json' ? JSON.stringify(object.POJO!(), null, 2) : object[col.name]);
        const sql = `insert into ${this.className(klass)} (${cols.map(col => col.name).join(', ')}) values (${cols.map(c => '?').join(', ')})`;
        await this.run(sql, params);
        return object;
    }

    async update<M extends Model>(klass: any, id: string, data: any): Promise<M> {
        const object: M = await super.update(klass, id, data);
        const cols = this.columns[this.className(klass)].filter(c => c.name !== 'id');
        const params = [...cols.map(col => col.name === 'json' ? JSON.stringify(object.POJO!(), null, 2) : object[col.name]), id];
        const sql = `update ${this.className(klass)} set ${cols.map(col => `${col.name}=?`).join(', ')} where id =? `;
        await this.run(sql, params);
        return object;
    }

    async delete(klass: any, id: string, fromObject?: boolean) {
        const object = await super.delete(klass, id, fromObject, true);
        await this.run(`delete from ${this.className(klass)} where id = ? `, [id]);
        return object;
    }

    async getOnline(klass: any, id = '', from = ''): Promise<Model | { [id: string]: Model }> {
        const doc2obj = async (doc: any): Promise<Model> => {
            const obj: Model = doc && new klass({ ...doc });
            obj && await obj.ready$;
            return obj;
        };
        const sql = id ? `select * from ${this.className(klass)} where id = ? ` : `select * from ${this.className(klass)}`;
        const models: { [id: string]: Model } = await this
            .query(sql, id && [id])
            .then(async (rows: any) => {
                return <Model[]>await Promise.all(rows.map(async (row: any) => {
                    if (row.json) Object.assign(row, JSON.parse(row.json));
                    const model = await doc2obj(row);
                    return model;
                }))
            })
            .then((rows: Model[]) => rows.reduce((all, row) => ({ ...all, [row.id as string]: row }), {} as { [id: string]: Model }));
        return id ? models[id] : models;
    }


}
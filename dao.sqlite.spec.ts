import { SQLiteDAO } from './dao.sqlite';
import { testDAO, SampleDAO } from '@hawryschuk/dao/DAO.spec.exports';

testDAO({
    title: 'SQLite DAO',
    dao: new SQLiteDAO(SampleDAO.models) as any,
})
// testBusinessModel({
//     title: 'Business Model : SQLiteDAO',
//     business: new BusinessModel(SQLiteDAO, 'db.sqlite')
// });

import * as path from "path";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";


export default (): PostgresConnectionOptions => ({
    url: process.env.URL,
    type: 'postgres',
    port: +!process.env.PORT,
    entities: [path.resolve(__dirname, '..') + '/**/*.entity{.ts,.js}'],
    synchronize: true,    // for development only, set to false in production
})
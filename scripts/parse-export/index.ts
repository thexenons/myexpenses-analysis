import { exportData } from '../../data/export.ts';
import { updateAccountsRegistry } from './accounts-registry.ts';
import { updateParsedData } from './parsed-data.ts';
import { generateStatistics } from './statistics/index.ts';

const [accountsRegistry, parsedData] = await Promise.all([
    updateAccountsRegistry(exportData),
    updateParsedData(exportData)
])

generateStatistics(parsedData, accountsRegistry);
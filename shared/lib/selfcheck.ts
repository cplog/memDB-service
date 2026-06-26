import { runMemoryScopeSelfCheck } from './memory-scope'
import { runTeamsSelfCheck } from './teams'
import { runBankGraphSelfCheck } from './bank-graph'
import { runDocumentDisplaySelfCheck } from './document-display'
import { runRecallMapSelfCheck } from './recall-map'
import { runOkfWikiSelfCheck } from './okf-wiki'
import { runRetainValidationSelfCheck } from './retain-validation'
import { runScenarioSelfCheck } from './scenario'
import { runTeamBanksSelfCheck } from './team-banks'

runMemoryScopeSelfCheck()
runTeamsSelfCheck()
runBankGraphSelfCheck()
runDocumentDisplaySelfCheck()
runRecallMapSelfCheck()
runOkfWikiSelfCheck()
runRetainValidationSelfCheck()
runScenarioSelfCheck()
runTeamBanksSelfCheck()
console.log('shared self-check passed')

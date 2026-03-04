# sql-test-runner

A VS Code extension for integrated tSQLt test running with file watching, incremental deployment, and inline diagnostics.

## Features

- **Zero configuration** – spin up SQL Server in a Docker dev container
- **Test Explorer integration** – tSQLt test classes and tests appear in the VS Code Test Explorer
- **Auto-run on save** – save a SQL file; affected tests run automatically
- **Incremental deployment** – only the changed file is deployed via `sqlcmd`
- **Inline diagnostics** – SQL compilation errors highlighted at the right line
- **CI parity mode** – full DACPAC publish + all tests + JUnit XML output
- **Branch change detection** – prompts to rebuild or sync when you switch git branches

## Architecture

```
VS Code Extension
    ├── File Watcher            (src/extension.ts)
    ├── Object Dependency Mapper (src/objectMapper.ts)
    ├── Incremental Deployer    (src/deployer.ts)
    ├── Test Orchestrator       (src/testRunner.ts)
    ├── tSQLt Result Parser     (src/resultParser.ts)
    ├── SQL Connection Manager  (src/sqlConnection.ts)
    ├── CI Mode Runner          (src/ciMode.ts)
    ├── State Manager           (src/stateManager.ts)
    └── VS Code Testing API     (src/extension.ts)

Dev Container
    └── SQL Server 2022
            ├── DevDb database
            ├── tSQLt framework
            └── /db/src + /db/tests
```

## Getting Started

### Dev Container (recommended)

1. Open this project in VS Code with the Dev Containers extension installed.
2. VS Code will offer to **Reopen in Container** – accept.
3. The SQL Server container starts automatically.
4. Run the setup script once to initialise the database:
   ```
   sqlcmd -S localhost,1433 -U sa -P 'YourStrong!Passw0rd' -C -i scripts/setup-db.sql
   ```
5. Deploy tSQLt into the database (download `tSQLt.class.sql` from [tSQLt.org](https://tsqlt.org/)).
6. Open a SQL file – the extension activates and discovers tests automatically.

### Without Dev Container

Configure the connection string in VS Code settings:

```json
{
  "sqlTestRunner.connectionString": "Server=localhost,1433;Database=DevDb;User Id=sa;Password=YourPass;TrustServerCertificate=true",
  "sqlTestRunner.sqlcmdPath": "sqlcmd"
}
```

## Usage

### Test Explorer

Tests appear in the VS Code Test Explorer panel. Click the ▶ button next to a test or class to run it.

### Auto-run on save

When `sqlTestRunner.autoRunOnSave` is `true` (default), saving any `.sql` file under `db/src/` or `db/tests/` will:

1. Deploy the file with `sqlcmd`
2. Identify which tests reference the changed object
3. Run only those tests

### Commands

| Command | Description |
|---------|-------------|
| `SQL Test Runner: Run All Tests` | Run `tSQLt.RunAll` |
| `SQL Test Runner: Refresh Test Discovery` | Re-query tSQLt for test classes/cases |
| `SQL Test Runner: Full Rebuild & Test (CI Mode)` | Drop DB → publish DACPAC → run all → write JUnit XML |
| `SQL Test Runner: Reset Database` | Execute `tSQLt.Reset` and re-discover |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `sqlTestRunner.connectionString` | `Server=localhost,1433;...` | SQL Server connection string |
| `sqlTestRunner.sqlcmdPath` | `sqlcmd` | Path to sqlcmd executable |
| `sqlTestRunner.autoRunOnSave` | `true` | Auto-run tests on file save |
| `sqlTestRunner.dacpacPath` | `""` | DACPAC path for CI mode |
| `sqlTestRunner.junitOutputPath` | `test-results/junit.xml` | JUnit XML output path |

## Repository Structure

```
.devcontainer/          Dev container configuration
  devcontainer.json
  docker-compose.yml
.github/workflows/      CI pipeline
  ci.yml
db/
  src/                  Source SQL objects (procedures, functions, views, tables)
  tests/                tSQLt test classes
extension/              VS Code extension (TypeScript)
  src/                  Extension source
  test/                 Unit tests
scripts/
  setup-db.sql          Database initialisation
```

## Development

```bash
cd extension
npm install
npm run compile     # compile TypeScript
npm test            # run unit tests
npm run lint        # run ESLint
```

## CI Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and PR:

1. Compiles the TypeScript extension
2. Runs ESLint
3. Runs unit tests (no SQL Server required)

For full integration tests, use CI mode from VS Code or via the extension's `Full Rebuild & Test` command against a running SQL Server.

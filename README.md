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

1. Install the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) in VS Code.
2. Open this project and choose **Reopen in Container** when prompted.
3. VS Code builds the custom SQL Server image and starts the container.
4. **tSQLt is installed automatically** – the container's entrypoint:
   - Creates `DevDb`
   - Runs `PrepareServer.sql` (enables CLR, installs the tSQLt signing certificate)
   - Downloads and runs `tSQLt.class.sql` from [tsqlt.org/downloads](https://tsqlt.org/downloads/)
5. Once the container is healthy, the VS Code extension activates and discovers tests automatically.

> **tSQLt license:** tSQLt is licensed under Apache 2.0.  
> See [`third-party/tSQLt/LICENSE`](third-party/tSQLt/LICENSE) and [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

### Manual tSQLt installation (without Dev Container)

```bash
# Set environment variables
export SA_PASSWORD="YourStrong!Passw0rd"
export SQL_SERVER="localhost,1433"
export SQL_DATABASE="DevDb"

# Run the install script (requires curl/wget and unzip)
./scripts/install-tsqlt.sh
```

The script:
1. Waits for SQL Server to be ready
2. Creates the target database if needed
3. Downloads tSQLt V1.1.8738.27883 from tsqlt.org
4. Runs `PrepareServer.sql` (server-level, SA required, once per server)
5. Runs `tSQLt.class.sql` (database-level install)
6. Verifies the installed version

### Without Dev Container (manual connection)

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
  Dockerfile             Custom SQL Server image with tSQLt auto-install
  entrypoint.sh          Container startup: init DB, download & install tSQLt
.github/workflows/      CI pipeline
  ci.yml
db/
  src/                  Source SQL objects (procedures, functions, views, tables)
  tests/                tSQLt test classes
extension/              VS Code extension (TypeScript)
  src/                  Extension source
  test/                 Unit tests
scripts/
  setup-db.sql          Database initialization (creates DevDb, enables CLR)
  install-tsqlt.sh      Downloads and installs tSQLt from tsqlt.org
third-party/
  tSQLt/
    LICENSE             Apache 2.0 license (tSQLt)
THIRD-PARTY-NOTICES.md  Third-party software notices
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

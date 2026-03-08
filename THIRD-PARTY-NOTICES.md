# Third-Party Notices

This project uses the following open-source software components. Required notices
are included below in accordance with their respective licenses.

---

## tSQLt

**Description:** A unit-testing framework for Microsoft SQL Server.

**Source:** https://github.com/tSQLt-org/tSQLt  
**Website:** https://tsqlt.org  
**Version:** V1.1.8738.27883 (latest as of 2024)  
**License:** Apache License, Version 2.0  
**License file:** `third-party/tSQLt/LICENSE`

tSQLt is downloaded at container startup via `scripts/install-tsqlt.sh` from
the official distribution at https://tsqlt.org/downloads/.  
tSQLt is not redistributed as part of this repository.

```
Copyright tSQLt contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

---

## mssql (npm package)

**Description:** Microsoft SQL Server client for Node.js.  
**Source:** https://github.com/tediousjs/node-mssql  
**License:** MIT  
**Usage:** Runtime dependency of the VS Code extension for SQL Server connectivity.

---

## @xmldom/xmldom (npm package)

**Description:** A pure JavaScript W3C standard-based XML DOM parser.  
**Source:** https://github.com/xmldom/xmldom  
**License:** MIT  
**Usage:** Runtime dependency of the VS Code extension for parsing tSQLt XML results.

---

## Microsoft SQL Server 2022 Developer Edition (Docker image)

**Description:** SQL Server 2022 Developer Edition container image.  
**Source:** https://hub.docker.com/_/microsoft-mssql-server  
**License:** Microsoft SQL Server Developer Edition EULA  
  (https://go.microsoft.com/fwlink/?linkid=857698)  
**Note:** By using the container image in `.devcontainer/docker-compose.yml`,
you accept the Microsoft SQL Server EULA (`ACCEPT_EULA=Y`).

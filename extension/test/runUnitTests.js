/**
 * Test runner for pure unit tests (no VS Code host required).
 * Registers a vscode mock before loading test files.
 */
'use strict';

const Module = require('module');
const path = require('path');
const Mocha = require('mocha');

// Register vscode mock so require('vscode') works without VS Code
const vscodeMock = require('./vscode-mock.js');
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
    if (request === 'vscode') {
        return vscodeMock;
    }
    return originalLoad.apply(this, arguments);
};

const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 10000 });
const testsRoot = path.resolve(__dirname, '../out/test/suite');

mocha.addFile(path.join(testsRoot, 'resultParser.test.js'));
mocha.addFile(path.join(testsRoot, 'objectMapper.test.js'));
mocha.addFile(path.join(testsRoot, 'deployer.test.js'));

mocha.run(failures => {
    process.exit(failures > 0 ? 1 : 0);
});

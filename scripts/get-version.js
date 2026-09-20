"use strict";

const { readFileSync } = require("fs");

const packageJson = readFileSync('package.json');
console.log(JSON.parse(packageJson)['version']);

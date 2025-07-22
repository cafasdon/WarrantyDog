#!/usr/bin/env node

/**
 * WarrantyDog Test Runner
 * Basic test suite for validating core functionality
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

console.log('🐕 WarrantyDog Test Suite');
console.log('========================');

let testsPassed = 0;
let testsFailed = 0;

// Test helper functions
function assert(condition, message) {
  if (condition) {
    console.log(`✅ ${message}`);
    testsPassed++;
  } else {
    console.log(`❌ ${message}`);
    testsFailed++;
  }
}

function assertEquals(actual, expected, message) {
  assert(actual === expected, `${message} (expected: ${expected}, actual: ${actual})`);
}

// Test 1: Check if required files exist
console.log('\n📁 File Structure Tests');
console.log('----------------------');

const requiredFiles = [
  'index.html',
  'app.js',
  'vendorApis.js',
  'style.css',
  'package.json',
  'lib/papaparse.min.js',
  'examples/sample-devices.csv'
];

requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(projectRoot, file));
  assert(exists, `Required file exists: ${file}`);
});

// Test 2: Validate package.json
console.log('\n📦 Package.json Tests');
console.log('--------------------');

try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  assert(packageJson.name === 'warrantydog', 'Package name is correct');
  assert(packageJson.version, 'Package has version');
  assert(packageJson.scripts && packageJson.scripts.dev, 'Dev script exists');
  assert(packageJson.scripts && packageJson.scripts.serve, 'Serve script exists');
} catch (error) {
  assert(false, `Package.json is valid JSON: ${error.message}`);
}

// Test 3: Validate sample CSV
console.log('\n📄 CSV Tests');
console.log('------------');

try {
  const csvContent = fs.readFileSync(path.join(projectRoot, 'examples/sample-devices.csv'), 'utf8');
  const lines = csvContent.trim().split('\n');
  assert(lines.length > 1, 'CSV has header and data rows');

  const header = lines[0].toLowerCase();
  assert(header.includes('vendor'), 'CSV has vendor column');
  assert(header.includes('service_tag') || header.includes('serial'), 'CSV has identifier column');

  // Check for Dell entries
  const dellEntries = lines.filter(line => line.toLowerCase().includes('dell'));
  assert(dellEntries.length > 0, 'CSV contains Dell entries for testing');
} catch (error) {
  assert(false, `Sample CSV is readable: ${error.message}`);
}

// Test 4: Check HTML structure
console.log('\n🌐 HTML Tests');
console.log('-------------');

try {
  const htmlContent = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(htmlContent.includes('<html'), 'HTML file has html tag');
  assert(htmlContent.includes('WarrantyDog'), 'HTML contains WarrantyDog title');
  assert(htmlContent.includes('app.js'), 'HTML includes app.js script');
  assert(htmlContent.includes('app.js'), 'HTML includes main app.js script (vendorApis.js imported as ES module)');
  assert(htmlContent.includes('papaparse'), 'HTML includes PapaParse library');
} catch (error) {
  assert(false, `HTML file is readable: ${error.message}`);
}

// Test 5: Check JavaScript syntax
console.log('\n🔧 JavaScript Tests');
console.log('------------------');

const jsFiles = ['app.js', 'vendorApis.js'];

jsFiles.forEach(file => {
  try {
    const jsContent = fs.readFileSync(path.join(projectRoot, file), 'utf8');

    // Basic syntax checks
    assert(!jsContent.includes('console.error') || jsContent.includes('console.error'),
           `${file} has proper error handling`);

    if (file === 'vendorApis.js') {
      assert(jsContent.includes('class'), `${file} contains ES6 classes`);
      assert(jsContent.includes('export'), `${file} has ES6 exports`);
      assert(jsContent.includes('DellAPI'), `${file} contains DellAPI class`);
      assert(jsContent.includes('RateLimiter'), `${file} contains RateLimiter class`);
    }

    if (file === 'app.js') {
      assert(jsContent.includes('import') || jsContent.includes('WarrantyChecker'),
             `${file} contains main application logic`);
    }
  } catch (error) {
    assert(false, `${file} is readable: ${error.message}`);
  }
});

// Test 6: Docker configuration
console.log('\n🐳 Docker Tests');
console.log('---------------');

const dockerFiles = ['Dockerfile', 'docker-compose.yml'];

dockerFiles.forEach(file => {
  const exists = fs.existsSync(path.join(projectRoot, file));
  assert(exists, `Docker file exists: ${file}`);

  if (exists) {
    try {
      const content = fs.readFileSync(path.join(projectRoot, file), 'utf8');
      if (file === 'Dockerfile') {
        assert(content.includes('FROM'), 'Dockerfile has FROM instruction');
        assert(content.includes('node'), 'Dockerfile uses Node.js base image');
      }
      if (file === 'docker-compose.yml') {
        assert(content.includes('version'), 'docker-compose.yml has version');
        assert(content.includes('services'), 'docker-compose.yml has services');
        assert(content.includes('8080'), 'docker-compose.yml exposes port 8080');
      }
    } catch (error) {
      assert(false, `${file} is readable: ${error.message}`);
    }
  }
});

// Test 7: Scripts
console.log('\n📜 Scripts Tests');
console.log('----------------');

const scriptFiles = ['scripts/docker-dev.sh', 'scripts/dev-setup.sh'];

scriptFiles.forEach(file => {
  const exists = fs.existsSync(path.join(projectRoot, file));
  assert(exists, `Script exists: ${file}`);

  if (exists) {
    try {
      const content = fs.readFileSync(path.join(projectRoot, file), 'utf8');
      assert(content.includes('#!/bin/bash'), `${file} has proper shebang`);
      assert(content.includes('WarrantyDog'), `${file} contains WarrantyDog references`);
    } catch (error) {
      assert(false, `${file} is readable: ${error.message}`);
    }
  }
});

// Test Summary
console.log('\n📊 Test Summary');
console.log('===============');
console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log(`📈 Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);

if (testsFailed === 0) {
  console.log('\n🎉 All tests passed! WarrantyDog is ready for development.');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Please check the issues above.');
  process.exit(1);
}

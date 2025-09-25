// Quick test to verify agents.yaml structure
const yaml = require('yaml');
const fs = require('fs');
const path = require('path');

// Test reading the agents file
const testPath = 'C:\\Users\\admin\\Desktop\\Harsh\\test_kilocode\\.oacode\\agents.yaml';

try {
    const content = fs.readFileSync(testPath, 'utf-8');
    const data = yaml.parse(content);

    console.log('✅ Successfully parsed agents.yaml');
    console.log('Found agents:', data.Agents ? data.Agents.length : 0);

    if (data.Agents) {
        data.Agents.forEach(agent => {
            console.log(`  - ${agent.slug}: ${agent.name}`);
        });
    }
} catch (error) {
    console.error('❌ Error reading agents.yaml:', error.message);
}
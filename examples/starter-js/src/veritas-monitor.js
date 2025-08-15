#!/usr/bin/env node
/**
 * Monitor script to check actual on-chain state of Veritas modules
 */
import axios from "axios";
const ROLLUP_URL = "http://127.0.0.1:12346";
// ANSI colors
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    gray: '\x1b[90m',
    magenta: '\x1b[35m'
};
async function queryState(module, path) {
    try {
        const response = await axios.get(`${ROLLUP_URL}/modules/${module}/state/${path}`);
        return response.data;
    }
    catch (error) {
        if (error.response?.status === 404) {
            return null;
        }
        throw error;
    }
}
async function monitorBeliefs() {
    console.log(`${colors.cyan}${colors.bright}\n📊 BELIEF STATES ON-CHAIN:${colors.reset}\n`);
    const beliefIds = [1, 2, 3, 4, 5];
    const beliefs = [];
    for (const id of beliefIds) {
        try {
            const belief = await queryState('veritas-belief', `beliefs/${id}`);
            if (belief) {
                beliefs.push({ id, ...belief });
                const aggregate = belief.aggregate || 0;
                const pct = (aggregate * 100).toFixed(2);
                const bar = createProgressBar(aggregate);
                console.log(`${colors.bright}Belief #${id}:${colors.reset} ${bar} ${pct}%`);
                console.log(`  Question: "${belief.question || 'N/A'}"`);
                console.log(`  Total Weight: ${belief.total_weight || 0}`);
                console.log();
            }
        }
        catch (error) {
            console.log(`${colors.red}Error querying belief ${id}${colors.reset}`);
        }
    }
    return beliefs;
}
async function monitorAgents() {
    console.log(`${colors.cyan}${colors.bright}\n👥 KNOWN AGENTS:${colors.reset}\n`);
    // Try some known addresses
    const knownAddresses = [
        '0x9b08ce57a93751ae790698a2c9ebc76a78f23e25', // Funded address
    ];
    let totalAgents = 0;
    for (const address of knownAddresses) {
        try {
            const agent = await queryState('veritas-agent', `agents/${address}`);
            if (agent) {
                totalAgents++;
                const weight = (agent.stake || 0) * (agent.score || 100);
                console.log(`${colors.bright}Agent ${address.slice(0, 10)}...${colors.reset}`);
                console.log(`  Stake: ${agent.stake || 0}`);
                console.log(`  Score: ${agent.score || 100}`);
                console.log(`  Weight: ${weight}`);
                console.log();
            }
        }
        catch (error) {
            // Agent doesn't exist
        }
    }
    if (totalAgents === 0) {
        console.log(`${colors.yellow}No agents found in known addresses${colors.reset}`);
    }
    return totalAgents;
}
function createProgressBar(value, width = 30) {
    const filled = Math.round(value * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    // Color based on value
    if (value < 0.3)
        return `${colors.red}${bar}${colors.reset}`;
    if (value < 0.7)
        return `${colors.yellow}${bar}${colors.reset}`;
    return `${colors.green}${bar}${colors.reset}`;
}
async function checkModules() {
    try {
        const response = await axios.get(`${ROLLUP_URL}/modules`);
        const modules = response.data.modules;
        const required = ['veritas-agent', 'veritas-belief', 'veritas-submission'];
        const found = required.filter(m => modules[m]);
        if (found.length === required.length) {
            console.log(`${colors.green}✅ All Veritas modules found${colors.reset}`);
            return true;
        }
        else {
            console.log(`${colors.red}❌ Missing modules: ${required.filter(m => !modules[m]).join(', ')}${colors.reset}`);
            return false;
        }
    }
    catch (error) {
        console.error(`${colors.red}Failed to connect to rollup at ${ROLLUP_URL}${colors.reset}`);
        return false;
    }
}
async function main() {
    console.log(`${colors.cyan}${colors.bright}\n🔍 VERITAS ROLLUP MONITOR${colors.reset}`);
    console.log(`${colors.gray}Monitoring rollup at ${ROLLUP_URL}${colors.reset}\n`);
    const hasModules = await checkModules();
    if (!hasModules) {
        console.log(`\n${colors.red}Please ensure the rollup is running with Veritas modules${colors.reset}`);
        process.exit(1);
    }
    // Continuous monitoring
    let iteration = 0;
    while (true) {
        iteration++;
        if (iteration > 1) {
            console.clear();
            console.log(`${colors.cyan}${colors.bright}\n🔍 VERITAS ROLLUP MONITOR${colors.reset}`);
            console.log(`${colors.gray}Iteration ${iteration} - ${new Date().toLocaleTimeString()}${colors.reset}\n`);
        }
        const beliefs = await monitorBeliefs();
        const agents = await monitorAgents();
        // Summary
        console.log(`${colors.cyan}${colors.bright}\n📈 SUMMARY:${colors.reset}`);
        console.log(`  Active Beliefs: ${beliefs.length}`);
        console.log(`  Known Agents: ${agents}`);
        // Calculate average aggregate
        if (beliefs.length > 0) {
            const avgAggregate = beliefs.reduce((sum, b) => sum + (b.aggregate || 0), 0) / beliefs.length;
            console.log(`  Average Aggregate: ${(avgAggregate * 100).toFixed(2)}%`);
        }
        console.log(`\n${colors.gray}Refreshing in 10 seconds... (Ctrl+C to exit)${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, 10000));
    }
}
// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(`\n${colors.yellow}Shutting down monitor...${colors.reset}\n`);
    process.exit(0);
});
main().catch(error => {
    console.error(`${colors.red}Fatal error:`, error.message);
    process.exit(1);
});

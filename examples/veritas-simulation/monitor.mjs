#!/usr/bin/env node
/**
 * Simple monitor for Veritas rollup - pure JavaScript ES modules
 */

import axios from 'axios';
import chalk from 'chalk';

const ROLLUP_URL = 'http://127.0.0.1:12346';

async function queryState(module, path) {
  try {
    const response = await axios.get(`${ROLLUP_URL}/modules/${module}/state/${path}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

async function monitorBeliefs() {
  console.log(chalk.cyan.bold('\n📊 BELIEF STATES:\n'));
  
  // Try to query a few belief IDs
  for (let id = 1; id <= 3; id++) {
    try {
      const belief = await queryState('veritas-belief', `beliefs/${id}`);
      if (belief) {
        console.log(chalk.white(`Belief #${id}:`));
        console.log(`  Question: ${belief.question || 'N/A'}`);
        console.log(`  Aggregate: ${belief.aggregate ? belief.aggregate.toFixed(3) : '0.000'}`);
        console.log(`  Total Weight: ${belief.total_weight || 0}`);
        console.log();
      }
    } catch (error) {
      // Belief doesn't exist, skip
    }
  }
}

async function monitorAgents() {
  console.log(chalk.cyan.bold('\n👥 KNOWN AGENTS:\n'));
  
  // Try the funded address from config
  const fundedAddress = '0x9b08ce9f67b3c8ee97316262c5383edfb403cf95';
  
  try {
    const agent = await queryState('veritas-agent', `agents/${fundedAddress}`);
    if (agent) {
      console.log(chalk.white(`Agent ${fundedAddress.slice(0, 10)}...:`));
      console.log(`  Stake: ${agent.stake || 0}`);
      console.log(`  Score: ${agent.score || 100}`);
      console.log(`  Weight: ${(agent.stake || 0) * (agent.score || 100)}`);
    } else {
      console.log(chalk.yellow('No agent found at funded address'));
    }
  } catch (error) {
    console.log(chalk.yellow('Could not query agent state'));
  }
}

async function checkModules() {
  try {
    const response = await axios.get(`${ROLLUP_URL}/modules`);
    const modules = response.data.modules;
    
    const veritasModules = ['veritas-agent', 'veritas-belief', 'veritas-submission'];
    const found = veritasModules.filter(m => modules[m]);
    
    if (found.length === 3) {
      console.log(chalk.green('✅ All Veritas modules found'));
      return true;
    } else {
      console.log(chalk.red('❌ Some Veritas modules missing'));
      return false;
    }
  } catch (error) {
    console.error(chalk.red('Failed to connect to rollup'));
    return false;
  }
}

async function main() {
  console.log(chalk.cyan.bold('\n🔍 VERITAS ROLLUP MONITOR\n'));
  console.log(chalk.gray(`Monitoring rollup at ${ROLLUP_URL}\n`));
  
  const hasModules = await checkModules();
  if (!hasModules) {
    process.exit(1);
  }
  
  // Monitor loop
  while (true) {
    await monitorBeliefs();
    await monitorAgents();
    
    console.log(chalk.gray('\n⏳ Refreshing in 10 seconds... (Ctrl+C to exit)\n'));
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Clear for next update
    console.clear();
    console.log(chalk.cyan.bold('\n🔍 VERITAS ROLLUP MONITOR\n'));
  }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nShutting down monitor...'));
  process.exit(0);
});

main().catch(error => {
  console.error(chalk.red('Fatal error:'), error.message);
  process.exit(1);
});
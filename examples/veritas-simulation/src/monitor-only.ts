#!/usr/bin/env node
/**
 * Read-only monitor for Veritas rollup state
 * This version doesn't submit transactions, just monitors existing state
 */

import axios from 'axios';
import chalk from 'chalk';
const Table = require('cli-table3');

const ROLLUP_URL = 'http://127.0.0.1:12346';

interface ModuleInfo {
  modules: {
    [key: string]: { id: string };
  };
}

class VeritasMonitor {
  private baseUrl: string;
  
  constructor(url: string = ROLLUP_URL) {
    this.baseUrl = url;
  }
  
  async getModules(): Promise<ModuleInfo> {
    try {
      const response = await axios.get(`${this.baseUrl}/modules`);
      return response.data;
    } catch (error) {
      console.error(chalk.red('Failed to fetch modules'));
      throw error;
    }
  }
  
  async queryModuleState(module: string, path: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/modules/${module}/state/${path}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }
  
  async monitorBeliefs(): Promise<void> {
    console.log(chalk.cyan.bold('\n📊 BELIEF STATES:\n'));
    
    const table = new Table({
      head: [
        chalk.white('ID'),
        chalk.white('Question'),
        chalk.white('Aggregate'),
        chalk.white('Total Weight')
      ],
      colWidths: [5, 40, 15, 15]
    });
    
    // Try to query a few belief IDs
    for (let id = 1; id <= 5; id++) {
      try {
        const belief = await this.queryModuleState('veritas-belief', `beliefs/${id}`);
        if (belief) {
          table.push([
            id.toString(),
            belief.question ? belief.question.slice(0, 37) + '...' : 'N/A',
            belief.aggregate ? belief.aggregate.toFixed(3) : '0.000',
            belief.total_weight || 0
          ]);
        }
      } catch (error) {
        // Belief doesn't exist, skip
      }
    }
    
    console.log(table.toString());
  }
  
  async monitorAgents(): Promise<void> {
    console.log(chalk.cyan.bold('\n👥 AGENT STATES:\n'));
    
    // Try some known addresses (you'd need to know these from genesis or logs)
    const knownAddresses = [
      '0x9b08ce9f67b3c8ee97316262c5383edfb403cf95', // From funded key
    ];
    
    const table = new Table({
      head: [
        chalk.white('Address'),
        chalk.white('Stake'),
        chalk.white('Score'),
        chalk.white('Weight')
      ],
      colWidths: [20, 10, 10, 15]
    });
    
    for (const address of knownAddresses) {
      try {
        const agent = await this.queryModuleState('veritas-agent', `agents/${address}`);
        if (agent) {
          const weight = (agent.stake || 0) * (agent.score || 100);
          table.push([
            address.slice(0, 10) + '...',
            agent.stake || 0,
            agent.score || 100,
            weight
          ]);
        }
      } catch (error) {
        // Agent doesn't exist, skip
      }
    }
    
    if (table.length > 0) {
      console.log(table.toString());
    } else {
      console.log(chalk.yellow('No agents found in known addresses'));
    }
  }
  
  async run(): Promise<void> {
    console.log(chalk.cyan.bold('\n🔍 VERITAS ROLLUP MONITOR\n'));
    console.log(chalk.gray(`Monitoring rollup at ${this.baseUrl}\n`));
    
    try {
      // Check modules
      const modules = await this.getModules();
      console.log(chalk.green('✅ Connected to rollup'));
      console.log(chalk.gray(`Found ${Object.keys(modules.modules).length} modules\n`));
      
      // Check for our modules
      const hasVeritas = 
        modules.modules['veritas-agent'] && 
        modules.modules['veritas-belief'] && 
        modules.modules['veritas-submission'];
      
      if (!hasVeritas) {
        throw new Error('Veritas modules not found in rollup');
      }
      
      console.log(chalk.green('✅ Veritas modules detected\n'));
      
      // Continuous monitoring loop
      while (true) {
        await this.monitorBeliefs();
        await this.monitorAgents();
        
        console.log(chalk.gray('\n⏳ Refreshing in 10 seconds... (Ctrl+C to exit)\n'));
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Clear screen for next update
        console.clear();
        console.log(chalk.cyan.bold('\n🔍 VERITAS ROLLUP MONITOR\n'));
      }
      
    } catch (error) {
      console.error(chalk.red('Monitor error:'), error);
      process.exit(1);
    }
  }
}

// Main entry point
async function main() {
  const monitor = new VeritasMonitor();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\nShutting down monitor...'));
    process.exit(0);
  });
  
  await monitor.run();
}

main().catch(console.error);
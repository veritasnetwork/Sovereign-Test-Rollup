/**
 * Simplified agent management for Veritas simulation
 */

import { Wallet } from 'ethers';
import chalk from 'chalk';
import { config } from './config.js';
import { VeritasTransactions } from './simple-client.js';

export interface Agent {
  address: string;
  privateKey: string;
  stake: number;
  score: number;
  submissions: number;
}

export class SimpleAgentManager {
  private agents: Map<string, Agent> = new Map();
  private rollupClient: any;
  
  constructor(rollupClient: any) {
    this.rollupClient = rollupClient;
  }
  
  /**
   * Initialize a funded agent from config
   */
  async initializeFundedAgent(): Promise<void> {
    if (config.fundedPrivateKeys.length === 0) {
      console.log(chalk.yellow('No funded keys provided, skipping...'));
      return;
    }
    
    const privateKey = config.fundedPrivateKeys[0];
    const wallet = new Wallet('0x' + privateKey);
    
    const agent: Agent = {
      address: wallet.address.toLowerCase(),
      privateKey: privateKey,
      stake: 1000,
      score: 100,
      submissions: 0
    };
    
    // Try to register the agent
    try {
      const tx = VeritasTransactions.registerAgent(agent.address, agent.stake);
      await this.rollupClient.submitTransaction(tx);
      
      this.agents.set(agent.address, agent);
      console.log(chalk.green(`✅ Registered funded agent ${agent.address.slice(0, 8)}...`));
    } catch (error: any) {
      // Agent might already be registered
      console.log(chalk.yellow(`Agent ${agent.address.slice(0, 8)}... may already be registered`));
      this.agents.set(agent.address, agent);
    }
  }
  
  /**
   * Generate a new random agent
   */
  generateRandomAgent(): Agent {
    const wallet = Wallet.createRandom();
    const stake = this.randomInRange(config.stakeRange.min, config.stakeRange.max);
    
    return {
      address: wallet.address.toLowerCase(),
      privateKey: wallet.privateKey.slice(2), // Remove 0x prefix
      stake: stake,
      score: 100,
      submissions: 0
    };
  }
  
  /**
   * Create and register new agents
   */
  async createAgents(count: number): Promise<Agent[]> {
    const newAgents: Agent[] = [];
    
    for (let i = 0; i < count; i++) {
      const agent = this.generateRandomAgent();
      
      try {
        const tx = VeritasTransactions.registerAgent(agent.address, agent.stake);
        await this.rollupClient.submitTransaction(tx);
        
        this.agents.set(agent.address, agent);
        newAgents.push(agent);
        console.log(chalk.green(`✅ Registered agent ${agent.address.slice(0, 8)}...`));
      } catch (error) {
        console.log(chalk.red(`❌ Failed to register agent ${agent.address.slice(0, 8)}...`));
      }
    }
    
    return newAgents;
  }
  
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
  
  getAgentCount(): number {
    return this.agents.size;
  }
  
  incrementSubmissions(address: string): void {
    const agent = this.agents.get(address);
    if (agent) {
      agent.submissions++;
    }
  }
  
  private randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

export default SimpleAgentManager;
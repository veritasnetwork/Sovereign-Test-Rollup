/**
 * Agent management for Veritas simulation
 */

import { Wallet, randomBytes } from 'ethers';
import { Secp256k1Signer } from '@sovereign-sdk/signers';
import { config } from './config.js';
import { RuntimeCall } from "./types";
import { Agent } from "./agents-simple";

export class AgentManager {
  private agents: Map<string, Agent> = new Map();
  private rollupClient: any;
  
  constructor(rollupClient: any) {
    this.rollupClient = rollupClient;
  }
  
  /**
   * Generate a new random agent
   */
  generateRandomAgent(): Agent {
    // Generate random wallet
    const wallet = Wallet.createRandom();
    const stake = this.randomInRange(config.stakeRange.min, config.stakeRange.max);
    
    const agent: Agent = {
      address: wallet.address.toLowerCase(),
      privateKey: wallet.privateKey.slice(2), // Remove 0x prefix
      stake: stake,
      score: 100, // All agents start with score 100
      submissions: 0
    };
    
    return agent;
  }
  
  /**
   * Register an agent on-chain
   */
  async registerAgent(agent: Agent): Promise<boolean> {
    try {
      console.log(`📝 Registering agent ${agent.address.slice(0, 8)}... with stake ${agent.stake}`);
      
      const signer = new Secp256k1Signer(agent.privateKey);
      
      const callMessage: RuntimeCall = {
        veritas_agent: {
          register_agent: { 
            initial_stake: agent.stake 
          }
        }
      };
      
      const response = await this.rollupClient.call(callMessage, { signer });
      
      if (response.response.receipt.result === 'successful') {
        this.agents.set(agent.address, agent);
        console.log(`✅ Agent ${agent.address.slice(0, 8)}... registered successfully`);
        return true;
      } else {
        console.log(`❌ Failed to register agent: ${response.response.receipt.result}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error registering agent: ${error}`);
      return false;
    }
  }
  
  /**
   * Create and register multiple agents
   */
  async createAgents(count: number): Promise<Agent[]> {
    const newAgents: Agent[] = [];
    
    for (let i = 0; i < count; i++) {
      const agent = this.generateRandomAgent();
      const success = await this.registerAgent(agent);
      
      if (success) {
        newAgents.push(agent);
      }
      
      // Small delay between registrations
      await this.delay(500);
    }
    
    return newAgents;
  }
  
  /**
   * Get a random existing agent
   */
  getRandomAgent(): Agent | undefined {
    const agents = Array.from(this.agents.values());
    if (agents.length === 0) return undefined;
    return agents[Math.floor(Math.random() * agents.length)];
  }
  
  /**
   * Get multiple random agents
   */
  getRandomAgents(count: number): Agent[] {
    const agents = Array.from(this.agents.values());
    const selected: Agent[] = [];
    
    // If we have fewer agents than requested, return all
    if (agents.length <= count) {
      return agents;
    }
    
    // Randomly select agents without replacement
    const shuffled = [...agents].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
  
  /**
   * Get all agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
  
  /**
   * Get agent by address
   */
  getAgent(address: string): Agent | undefined {
    return this.agents.get(address.toLowerCase());
  }
  
  /**
   * Update agent's submission count
   */
  incrementSubmissions(address: string): void {
    const agent = this.agents.get(address.toLowerCase());
    if (agent) {
      agent.submissions++;
    }
  }
  
  /**
   * Get total agent count
   */
  getAgentCount(): number {
    return this.agents.size;
  }
  
  /**
   * Initialize with funded agent from config
   */
  async initializeFundedAgent(): Promise<boolean> {
    if (config.fundedPrivateKeys.length === 0) {
      console.log("⚠️  No funded private keys in config");
      return false;
    }
    
    const privateKey = config.fundedPrivateKeys[0];
    const wallet = new Wallet(`0x${privateKey}`);
    
    const agent: Agent = {
      address: wallet.address.toLowerCase(),
      privateKey: privateKey,
      stake: 1000, // Initial stake for funded agent
      score: 100,
      submissions: 0
    };
    
    // Try to register (might already be registered from genesis)
    console.log(`🔑 Initializing funded agent ${agent.address.slice(0, 8)}...`);
    
    // Store it regardless (it might be pre-registered in genesis)
    this.agents.set(agent.address, agent);
    
    // Try to register in case it's not in genesis
    try {
      await this.registerAgent(agent);
    } catch (error) {
      console.log(`ℹ️  Agent might already be registered from genesis`);
    }
    
    return true;
  }
  
  // Utility functions
  private randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
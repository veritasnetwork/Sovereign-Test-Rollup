#!/usr/bin/env node
/**
 * Complete Veritas simulation with agent management and belief submissions
 */

import { createStandardRollup } from "@sovereign-sdk/web3";
import { Secp256k1Signer } from "@sovereign-sdk/signers";
import { Wallet } from "ethers";

// ANSI color codes for terminal output
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

// Configuration
const CONFIG = {
  rollupUrl: "http://127.0.0.1:12346",
  roundDelay: 15000, // 15 seconds between rounds
  agentsPerRound: { min: 1, max: 2 },
  submissionsPerAgent: { min: 1, max: 3 },
  stakeRange: { min: 100, max: 1000 },
  beliefIds: [1, 2, 3, 4, 5], // IDs from genesis.json
};

// Type definitions
interface RuntimeCall {
  [module: string]: any;
}

interface Agent {
  wallet: any; // Wallet or HDNodeWallet
  signer: Secp256k1Signer;
  address: string;
  stake: number;
  submissions: number;
}

interface Belief {
  id: number;
  question: string;
  aggregate: number;
  totalWeight: number;
}

class VeritasSimulation {
  private rollup: any;
  private agents: Map<string, Agent> = new Map();
  private beliefs: Map<number, Belief> = new Map();
  private roundNumber: number = 0;
  private totalSubmissions: number = 0;
  
  constructor() {
    // Initialize with known beliefs from genesis (using fixed-point scale of 10000)
    const genesisBeliefs = [
      { id: 1, question: "Will ETH exceed $5000 by Dec 2024?", aggregate: 5000, totalWeight: 0 },
      { id: 2, question: "Will Bitcoin hit $100,000 in 2024?", aggregate: 4000, totalWeight: 0 },
      { id: 3, question: "Will there be a US Fed rate cut in Q1 2025?", aggregate: 6000, totalWeight: 0 },
      { id: 4, question: "Will AI regulation pass in EU by mid-2025?", aggregate: 7000, totalWeight: 0 },
      { id: 5, question: "Will SpaceX complete Mars mission by 2030?", aggregate: 3000, totalWeight: 0 }
    ];
    
    genesisBeliefs.forEach(b => this.beliefs.set(b.id, b));
  }
  
  async initialize() {
    console.log(`${colors.cyan}${colors.bright}\n🚀 INITIALIZING VERITAS SIMULATION${colors.reset}\n`);
    
    // Connect to rollup
    console.log(`📡 Connecting to rollup at ${CONFIG.rollupUrl}...`);
    this.rollup = await createStandardRollup({ url: CONFIG.rollupUrl });
    console.log(`${colors.green}✅ Connected to rollup${colors.reset}`);
    
    // Initialize funded agent
    const fundedPrivKey = "0d87c12ea7c12024b3f70a26d735874608f17c8bce2b48e6fe87389310191264";
    const fundedWallet = new Wallet("0x" + fundedPrivKey);
    const fundedAgent: Agent = {
      wallet: fundedWallet,
      signer: new Secp256k1Signer(fundedPrivKey),
      address: fundedWallet.address.toLowerCase(),
      stake: 1000,
      submissions: 0
    };
    
    // Try to register funded agent
    try {
      const call: RuntimeCall = {
        veritas_agent: {
          register_agent: { initial_stake: fundedAgent.stake }
        }
      };
      await this.rollup.call(call, { signer: fundedAgent.signer });
      console.log(`${colors.green}✅ Registered funded agent${colors.reset}`);
    } catch (error) {
      console.log(`${colors.yellow}⚠️  Funded agent already registered${colors.reset}`);
    }
    
    this.agents.set(fundedAgent.address, fundedAgent);
    
    console.log(`\n${colors.cyan}${colors.bright}📊 LOADED BELIEFS:${colors.reset}`);
    this.beliefs.forEach(belief => {
      console.log(`  ${colors.gray}Belief #${belief.id}: ${belief.question.slice(0, 50)}...${colors.reset}`);
    });
    
    console.log(`\n${colors.green}✨ Simulation ready! Starting in 3 seconds...${colors.reset}\n`);
    await this.sleep(3000);
  }
  
  async runRound() {
    this.roundNumber++;
    console.log(`${colors.cyan}${colors.bright}\n━━━ ROUND ${this.roundNumber} ━━━${colors.reset}\n`);
    
    // Phase 1: Create new agents
    const newAgentCount = this.randomInRange(CONFIG.agentsPerRound.min, CONFIG.agentsPerRound.max);
    if (newAgentCount > 0) {
      console.log(`${colors.magenta}👥 Creating ${newAgentCount} new agent(s)...${colors.reset}`);
      
      for (let i = 0; i < newAgentCount; i++) {
        const wallet = Wallet.createRandom();
        const stake = this.randomInRange(CONFIG.stakeRange.min, CONFIG.stakeRange.max);
        const agent: Agent = {
          wallet,
          signer: new Secp256k1Signer(wallet.privateKey.slice(2)),
          address: wallet.address.toLowerCase(),
          stake,
          submissions: 0
        };
        
        try {
          const call: RuntimeCall = {
            veritas_agent: {
              register_agent: { initial_stake: stake }
            }
          };
          await this.rollup.call(call, { signer: agent.signer });
          this.agents.set(agent.address, agent);
          console.log(`  ${colors.green}✅ Registered ${agent.address.slice(0, 10)}... (stake: ${stake})${colors.reset}`);
        } catch (error) {
          console.log(`  ${colors.red}❌ Failed to register agent${colors.reset}`);
        }
        
        await this.sleep(500);
      }
    }
    
    // Phase 2: Submit beliefs
    const activeAgents = Array.from(this.agents.values());
    const submittingAgents = this.selectRandomAgents(activeAgents);
    
    if (submittingAgents.length > 0) {
      console.log(`\n${colors.magenta}📊 Processing submissions from ${submittingAgents.length} agents...${colors.reset}`);
      
      for (const agent of submittingAgents) {
        const submissionCount = this.randomInRange(CONFIG.submissionsPerAgent.min, CONFIG.submissionsPerAgent.max);
        
        for (let i = 0; i < submissionCount; i++) {
          const beliefId = CONFIG.beliefIds[Math.floor(Math.random() * CONFIG.beliefIds.length)];
          const belief = this.beliefs.get(beliefId);
          
          if (belief) {
            // Generate submission value based on current aggregate with some variance
            // Using fixed-point scale (10000 = 100%)
            const variance = 3000; // 30% variance
            const baseValue = belief.aggregate + Math.floor((Math.random() - 0.5) * variance);
            const value = Math.max(0, Math.min(10000, baseValue));
            
            try {
              const call: RuntimeCall = {
                veritas_submission: {
                  submit_belief: { belief_id: beliefId, value }
                }
              };
              await this.rollup.call(call, { signer: agent.signer });
              
              agent.submissions++;
              this.totalSubmissions++;
              
              // Update local belief aggregate (approximation)
              const weight = agent.stake * 100; // score starts at 100
              const oldWeight = belief.totalWeight;
              belief.totalWeight += weight;
              // Fixed-point weighted average
              belief.aggregate = Math.floor((belief.aggregate * oldWeight + value * weight) / belief.totalWeight);
              
              console.log(`  ${colors.green}✅ ${agent.address.slice(0, 10)}... → Belief #${beliefId}: ${(value/100).toFixed(2)}%${colors.reset}`);
            } catch (error) {
              console.log(`  ${colors.red}❌ Submission failed${colors.reset}`);
            }
            
            await this.sleep(200);
          }
        }
      }
    }
    
    // Phase 3: Display statistics
    this.displayStats();
  }
  
  displayStats() {
    console.log(`\n${colors.cyan}📈 CURRENT STATE:${colors.reset}`);
    console.log(`  Agents: ${this.agents.size}`);
    console.log(`  Total Submissions: ${this.totalSubmissions}`);
    console.log(`  Rounds Completed: ${this.roundNumber}`);
    
    console.log(`\n${colors.cyan}📊 BELIEF AGGREGATES:${colors.reset}`);
    this.beliefs.forEach(belief => {
      const pct = (belief.aggregate / 100).toFixed(2); // Convert from scale 10000 to percentage
      const normalizedValue = belief.aggregate / 10000; // Normalize for progress bar
      const bar = this.createProgressBar(normalizedValue);
      console.log(`  #${belief.id}: ${bar} ${pct}%`);
    });
  }
  
  createProgressBar(value: number, width: number = 20): string {
    const filled = Math.round(value * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    
    // Color based on value
    if (value < 0.3) return `${colors.red}${bar}${colors.reset}`;
    if (value < 0.7) return `${colors.yellow}${bar}${colors.reset}`;
    return `${colors.green}${bar}${colors.reset}`;
  }
  
  selectRandomAgents(agents: Agent[]): Agent[] {
    const percentage = 0.3 + Math.random() * 0.4; // 30-70% active
    const count = Math.max(1, Math.floor(agents.length * percentage));
    return agents.sort(() => Math.random() - 0.5).slice(0, count);
  }
  
  randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async run() {
    await this.initialize();
    
    // Set up graceful shutdown
    process.on('SIGINT', () => {
      console.log(`\n${colors.yellow}⚠️  Shutting down simulation...${colors.reset}`);
      this.shutdown();
    });
    
    // Main loop
    while (true) {
      await this.runRound();
      console.log(`\n${colors.gray}⏳ Next round in ${CONFIG.roundDelay/1000} seconds... (Ctrl+C to exit)${colors.reset}`);
      await this.sleep(CONFIG.roundDelay);
    }
  }
  
  shutdown() {
    console.log(`\n${colors.cyan}${colors.bright}📊 FINAL STATISTICS${colors.reset}`);
    console.log(`  Total Agents: ${this.agents.size}`);
    console.log(`  Total Submissions: ${this.totalSubmissions}`);
    console.log(`  Rounds Completed: ${this.roundNumber}`);
    
    console.log(`\n${colors.cyan}${colors.bright}📊 FINAL BELIEF STATES${colors.reset}`);
    this.beliefs.forEach(belief => {
      console.log(`  Belief #${belief.id}: ${(belief.aggregate / 100).toFixed(2)}%`);
      console.log(`    "${belief.question}"`);
    });
    
    console.log(`\n${colors.green}✨ Simulation complete!${colors.reset}\n`);
    process.exit(0);
  }
}

// Main entry point
async function main() {
  const simulation = new VeritasSimulation();
  await simulation.run();
}

main().catch(error => {
  console.error(`${colors.red}Fatal error:`, error);
  process.exit(1);
});
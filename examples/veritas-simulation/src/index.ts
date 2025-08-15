#!/usr/bin/env node
/**
 * Main simulation script for Veritas belief aggregation system
 */

import chalk from 'chalk';
import SimpleRollupClient from './simple-client.js';
import { config } from './config.js';
import SimpleAgentManager from './agents-simple.js';
import SimpleBeliefManager from './beliefs-simple.js';
import { Monitor } from './monitor.js';
import { SimulationStats } from './types.js';

class VeritasSimulation {
  private rollupClient: any;
  private agentManager!: SimpleAgentManager;
  private beliefManager!: SimpleBeliefManager;
  private monitor: Monitor;
  private stats: SimulationStats;
  private isRunning: boolean = false;
  
  constructor() {
    this.monitor = new Monitor();
    this.stats = {
      totalAgents: 0,
      totalSubmissions: 0,
      roundsCompleted: 0,
      startTime: new Date(),
      beliefs: new Map()
    };
  }
  
  /**
   * Initialize the simulation
   */
  async initialize(): Promise<void> {
    try {
      console.log(chalk.cyan.bold('\n🚀 INITIALIZING VERITAS SIMULATION...\n'));
      
      // Connect to rollup
      console.log('📡 Connecting to rollup at ' + config.rollupUrl);
      this.rollupClient = new SimpleRollupClient(config.rollupUrl);
      
      // Check if rollup is running
      const isHealthy = await this.rollupClient.healthCheck();
      if (!isHealthy) {
        throw new Error('Rollup is not responding. Make sure it is running.');
      }
      console.log(chalk.green('✅ Connected to rollup'));
      
      // Initialize managers
      this.agentManager = new SimpleAgentManager(this.rollupClient);
      this.beliefManager = new SimpleBeliefManager(this.rollupClient);
      
      // Initialize beliefs from genesis
      await this.beliefManager.initializeBeliefs();
      const beliefs = this.beliefManager.getAllBeliefs();
      console.log(chalk.green(`✅ Loaded ${beliefs.length} beliefs`));
      
      // Initialize belief stats
      beliefs.forEach(belief => {
        this.stats.beliefs.set(belief.id, {
          beliefId: belief.id,
          question: belief.question,
          currentAggregate: belief.aggregate,
          previousAggregate: belief.aggregate,
          totalSubmissions: 0,
          convergenceRate: 0,
          volatility: 0
        });
      });
      
      // Initialize funded agent
      console.log('\n🔑 Initializing funded agent...');
      await this.agentManager.initializeFundedAgent();
      this.stats.totalAgents = this.agentManager.getAgentCount();
      console.log(chalk.green(`✅ Initialized ${this.stats.totalAgents} agent(s)`));
      
      console.log(chalk.cyan.bold('\n✨ SIMULATION READY!\n'));
      console.log(chalk.gray('Starting continuous simulation in 3 seconds...\n'));
      await this.delay(3000);
      
    } catch (error) {
      console.error(chalk.red('❌ Initialization failed:'), error);
      throw error;
    }
  }
  
  /**
   * Run a single simulation round
   */
  async runRound(): Promise<void> {
    this.stats.roundsCompleted++;
    console.log(chalk.cyan(`\n📍 ROUND ${this.stats.roundsCompleted} STARTING...\n`));
    
    try {
      // Phase 1: Create new agents
      const agentCount = this.randomInRange(
        config.agentsPerRound.min,
        config.agentsPerRound.max
      );
      
      if (agentCount > 0) {
        console.log(`👥 Creating ${agentCount} new agent(s)...`);
        const newAgents = await this.agentManager.createAgents(agentCount);
        this.stats.totalAgents += newAgents.length;
        
        newAgents.forEach(agent => {
          this.monitor.addActivity(
            `New agent ${agent.address.slice(0, 8)}... joined with stake ${agent.stake}`
          );
        });
      }
      
      // Phase 2: Submit beliefs
      const activeAgents = this.agentManager.getAllAgents();
      const submittingAgents = this.selectRandomAgents(activeAgents);
      
      if (submittingAgents.length > 0) {
        console.log(`\n📊 Processing submissions from ${submittingAgents.length} agents...`);
        
        for (const agent of submittingAgents) {
          const submissionCount = this.randomInRange(
            config.submissionsPerAgent.min,
            config.submissionsPerAgent.max
          );
          
          for (let i = 0; i < submissionCount; i++) {
            const beliefs = this.beliefManager.getAllBeliefs();
            const belief = beliefs[Math.floor(Math.random() * beliefs.length)];
            
            if (belief) {
              const value = this.beliefManager.generateSubmissionValue(belief.id);
              const success = await this.beliefManager.submitBelief(agent, belief.id, value);
              
              if (success) {
                this.stats.totalSubmissions++;
                this.agentManager.incrementSubmissions(agent.address);
                
                // Update belief stats
                const beliefStat = this.stats.beliefs.get(belief.id);
                if (beliefStat) {
                  beliefStat.totalSubmissions++;
                  
                  // Query updated belief
                  const updatedBelief = await this.beliefManager.queryBelief(belief.id);
                  if (updatedBelief) {
                    beliefStat.previousAggregate = beliefStat.currentAggregate;
                    beliefStat.currentAggregate = updatedBelief.aggregate;
                    
                    const change = Math.abs(beliefStat.currentAggregate - beliefStat.previousAggregate);
                    beliefStat.volatility = beliefStat.volatility * 0.9 + change * 0.1;
                    beliefStat.convergenceRate = -change;
                  }
                }
                
                this.monitor.addActivity(
                  `Agent ${agent.address.slice(0, 8)}... submitted ${(value * 100).toFixed(1)}% to Belief #${belief.id}`
                );
              }
            }
            
            // Small delay between submissions
            await this.delay(100);
          }
        }
      }
      
      // Phase 3: Update display
      if (config.display.clearScreen) {
        this.monitor.displayDashboard(
          this.stats,
          Array.from(this.stats.beliefs.values()),
          this.agentManager.getAllAgents()
        );
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Round error:'), error);
    }
  }
  
  /**
   * Main simulation loop
   */
  async run(): Promise<void> {
    this.isRunning = true;
    
    // Set up graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\n⚠️  Shutting down simulation...'));
      this.shutdown();
    });
    
    while (this.isRunning) {
      await this.runRound();
      
      // Wait for next round
      console.log(chalk.gray(`\n⏳ Next round in ${config.simulationSpeed / 1000} seconds...\n`));
      await this.delay(config.simulationSpeed);
    }
  }
  
  /**
   * Shutdown the simulation
   */
  shutdown(): void {
    this.isRunning = false;
    
    console.log(chalk.cyan.bold('\n📊 FINAL STATISTICS:\n'));
    console.log(chalk.white(`Total Agents Created: ${this.stats.totalAgents}`));
    console.log(chalk.white(`Total Submissions: ${this.stats.totalSubmissions}`));
    console.log(chalk.white(`Rounds Completed: ${this.stats.roundsCompleted}`));
    
    const runtime = new Date().getTime() - this.stats.startTime.getTime();
    const minutes = Math.floor(runtime / 60000);
    const seconds = Math.floor((runtime % 60000) / 1000);
    console.log(chalk.white(`Total Runtime: ${minutes}m ${seconds}s`));
    
    console.log(chalk.cyan.bold('\n✨ Simulation complete! Goodbye.\n'));
    process.exit(0);
  }
  
  /**
   * Select random subset of agents for submissions
   */
  private selectRandomAgents(agents: any[]): any[] {
    // Select 30-70% of agents to be active this round
    const activePercentage = 0.3 + Math.random() * 0.4;
    const count = Math.floor(agents.length * activePercentage);
    
    const shuffled = [...agents].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
  
  // Utility functions
  private randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main entry point
async function main() {
  const simulation = new VeritasSimulation();
  
  try {
    await simulation.initialize();
    await simulation.run();
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  }
}

// Run the simulation
main().catch(console.error);
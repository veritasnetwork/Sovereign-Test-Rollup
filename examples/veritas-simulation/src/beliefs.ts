/**
 * Belief management and submission logic for Veritas simulation
 */

import axios from 'axios';
import { Secp256k1Signer } from '@sovereign-sdk/signers';
import { config } from './config.js';
import { Agent, Belief, RuntimeCall, BeliefResponse, BeliefStats } from './types.js';

export class BeliefManager {
  private beliefs: Map<number, Belief> = new Map();
  private beliefStats: Map<number, BeliefStats> = new Map();
  private rollupClient: any;
  private rollupUrl: string;
  
  constructor(rollupClient: any, rollupUrl: string) {
    this.rollupClient = rollupClient;
    this.rollupUrl = rollupUrl;
  }
  
  /**
   * Initialize beliefs from genesis or config
   * Since we can't create beliefs via transactions (removed from CallMessage),
   * we'll work with the beliefs configured in genesis
   */
  async initializeBeliefs(): Promise<void> {
    console.log("🔍 Discovering beliefs from genesis configuration...");
    
    // For now, we'll work with belief IDs 1-5 as configured
    // In a real implementation, we'd query to discover available beliefs
    for (let i = 1; i <= config.initialBeliefs.length; i++) {
      try {
        const belief = await this.queryBelief(i);
        if (belief) {
          this.beliefs.set(i, belief);
          
          // Initialize stats
          this.beliefStats.set(i, {
            beliefId: i,
            question: belief.question || config.initialBeliefs[i - 1].question,
            currentAggregate: belief.aggregate,
            previousAggregate: belief.aggregate,
            totalSubmissions: belief.submissionCount || 0,
            convergenceRate: 0,
            volatility: 0
          });
          
          console.log(`✅ Loaded belief #${i}: "${belief.question || config.initialBeliefs[i - 1].question}"`);
        }
      } catch (error) {
        console.log(`ℹ️  Belief #${i} not found, using config default`);
        // Use config data as fallback
        const configBelief = config.initialBeliefs[i - 1];
        if (configBelief) {
          this.beliefs.set(i, {
            id: i,
            question: configBelief.question,
            aggregate: configBelief.initialValue,
            totalWeight: 0,
            submissionCount: 0
          });
        }
      }
    }
  }
  
  /**
   * Query belief state from blockchain
   */
  async queryBelief(beliefId: number): Promise<Belief | null> {
    try {
      const response = await axios.get(
        `${this.rollupUrl}/modules/veritas-belief/state/beliefs/${beliefId}`
      );
      
      if (response.data && response.data.value) {
        const data = response.data.value;
        return {
          id: data.id || beliefId,
          question: data.question || "",
          aggregate: data.aggregate || 0.5,
          totalWeight: data.total_weight || 0,
          submissionCount: 0 // Will query separately if needed
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Submit a belief prediction
   */
  async submitBelief(agent: Agent, beliefId: number, value: number): Promise<boolean> {
    try {
      const signer = new Secp256k1Signer(agent.privateKey);
      
      // Convert probability (0.0-1.0) to percentage (0-100)
      const valueInt = Math.round(value * 100);
      
      const callMessage: RuntimeCall = {
        veritas_submission: {
          submit_belief: {
            belief_id: beliefId,
            value: valueInt
          }
        }
      };
      
      const response = await this.rollupClient.call(callMessage, { signer });
      
      if (response.response.receipt.result === 'successful') {
        // Update local belief state
        await this.updateBeliefState(beliefId);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error submitting belief: ${error}`);
      return false;
    }
  }
  
  /**
   * Update local belief state after submission
   */
  async updateBeliefState(beliefId: number): Promise<void> {
    const newBelief = await this.queryBelief(beliefId);
    if (newBelief) {
      const oldBelief = this.beliefs.get(beliefId);
      this.beliefs.set(beliefId, newBelief);
      
      // Update stats
      const stats = this.beliefStats.get(beliefId);
      if (stats && oldBelief) {
        stats.previousAggregate = stats.currentAggregate;
        stats.currentAggregate = newBelief.aggregate;
        stats.totalSubmissions++;
        
        // Calculate volatility (change in aggregate)
        const change = Math.abs(newBelief.aggregate - oldBelief.aggregate);
        stats.volatility = stats.volatility * 0.9 + change * 0.1; // Exponential moving average
        
        // Calculate convergence rate (how fast volatility is decreasing)
        stats.convergenceRate = -change; // Negative means converging
      }
    }
  }
  
  /**
   * Generate submission value based on strategy
   */
  generateSubmissionValue(beliefId: number, strategy?: string): number {
    const belief = this.beliefs.get(beliefId);
    const currentAggregate = belief?.aggregate || 0.5;
    
    // Determine strategy
    const randomStrategy = strategy || this.selectRandomStrategy();
    
    switch (randomStrategy) {
      case 'contrarian':
        // Submit opposite of current consensus
        return currentAggregate > 0.5 
          ? Math.random() * 0.3  // Low value if consensus is high
          : 0.7 + Math.random() * 0.3; // High value if consensus is low
        
      case 'follower':
        // Submit near current consensus with small variation
        const variation = (Math.random() - 0.5) * 0.2; // ±0.1 variation
        return Math.max(0, Math.min(1, currentAggregate + variation));
        
      case 'random':
      default:
        // Completely random value
        return Math.random();
    }
  }
  
  /**
   * Select a random strategy based on configured probabilities
   */
  private selectRandomStrategy(): string {
    const rand = Math.random();
    const strategies = config.beliefStrategies;
    
    if (rand < strategies.contrarian) return 'contrarian';
    if (rand < strategies.contrarian + strategies.follower) return 'follower';
    return 'random';
  }
  
  /**
   * Process submissions for multiple agents
   */
  async processSubmissions(agents: Agent[]): Promise<number> {
    let successCount = 0;
    
    for (const agent of agents) {
      // Select random beliefs to submit to
      const submissionCount = this.randomInRange(
        config.submissionsPerAgent.min,
        config.submissionsPerAgent.max
      );
      
      const beliefIds = this.getRandomBeliefIds(submissionCount);
      
      for (const beliefId of beliefIds) {
        const value = this.generateSubmissionValue(beliefId);
        const success = await this.submitBelief(agent, beliefId, value);
        
        if (success) {
          successCount++;
          console.log(
            `📊 Agent ${agent.address.slice(0, 8)}... submitted ${(value * 100).toFixed(1)}% to Belief #${beliefId}`
          );
        }
        
        // Small delay between submissions
        await this.delay(200);
      }
    }
    
    return successCount;
  }
  
  /**
   * Get random belief IDs
   */
  private getRandomBeliefIds(count: number): number[] {
    const beliefIds = Array.from(this.beliefs.keys());
    const selected: number[] = [];
    
    for (let i = 0; i < Math.min(count, beliefIds.length); i++) {
      const randomIndex = Math.floor(Math.random() * beliefIds.length);
      const beliefId = beliefIds[randomIndex];
      if (!selected.includes(beliefId)) {
        selected.push(beliefId);
      }
    }
    
    return selected;
  }
  
  /**
   * Get all beliefs
   */
  getAllBeliefs(): Belief[] {
    return Array.from(this.beliefs.values());
  }
  
  /**
   * Get belief by ID
   */
  getBelief(id: number): Belief | undefined {
    return this.beliefs.get(id);
  }
  
  /**
   * Get belief statistics
   */
  getBeliefStats(): BeliefStats[] {
    return Array.from(this.beliefStats.values());
  }
  
  // Utility functions
  private randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
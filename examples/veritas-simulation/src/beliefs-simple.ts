/**
 * Simplified belief management for Veritas simulation
 */

import chalk from 'chalk';
import { config } from './config.js';
import { Agent } from './local-types';
import { RuntimeCall } from './types';
import { Secp256k1Signer } from '@sovereign-sdk/signers';

export interface Belief {
  id: number;
  question: string;
  aggregate: number;
  totalWeight: number;
}

export class SimpleBeliefManager {
  private beliefs: Map<number, Belief> = new Map();
  private rollupClient: any;
  private nextBeliefId: number = 1;
  
  constructor(rollupClient: any) {
    this.rollupClient = rollupClient;
  }
  
  /**
   * Initialize beliefs from config
   */
  async initializeBeliefs(): Promise<void> {
    // For simplicity, we'll use hardcoded belief IDs that should exist in genesis
    // In a real scenario, you'd query these from the chain
    const hardcodedBeliefs = [
      { id: 1, question: "Will ETH exceed $5000 by end of 2024?", aggregate: 0.5, totalWeight: 0 },
      { id: 2, question: "Will Bitcoin hit $100,000 in 2024?", aggregate: 0.4, totalWeight: 0 },
      { id: 3, question: "Will there be a US Fed rate cut in Q1 2025?", aggregate: 0.6, totalWeight: 0 }
    ];
    
    for (const belief of hardcodedBeliefs) {
      this.beliefs.set(belief.id, belief);
      console.log(chalk.gray(`Loaded belief #${belief.id}: ${belief.question.slice(0, 40)}...`));
    }
  }
  
  /**
   * Submit a belief prediction
   */
  async submitBelief(agent: Agent, beliefId: number, value: number): Promise<boolean> {
    try {
      const signer = new Secp256k1Signer(agent.privateKey);
      const callMessage: RuntimeCall = {
        veritas_submission: {
          submit_belief: {
            belief_id: beliefId,
            value: Math.round(value * 100) // Convert 0.0-1.0 to 0-100
          }
        }
      };
      await this.rollupClient.call(callMessage, { signer });
      
      // Update local belief aggregate (approximation)
      const belief = this.beliefs.get(beliefId);
      if (belief) {
        // Simple weighted average update (local approximation)
        const agentWeight = agent.stake * agent.score;
        const newTotalWeight = belief.totalWeight + agentWeight;
        if (newTotalWeight > 0) {
          belief.aggregate = (belief.aggregate * belief.totalWeight + value * agentWeight) / newTotalWeight;
          belief.totalWeight = newTotalWeight;
        }
      }
      
      return true;
    } catch (error) {
      console.log(chalk.red(`Failed to submit belief for agent ${agent.address.slice(0, 8)}...`));
      return false;
    }
  }
  
  /**
   * Query belief state from chain
   */
  async queryBelief(beliefId: number): Promise<Belief | null> {
    try {
      const result = await this.rollupClient.modules.veritas_belief.beliefs.get(beliefId);
      if (result) {
        return {
          id: beliefId,
          question: result.question || '',
          aggregate: (result.aggregate || 0) / 100, // Convert from 0-100 to 0.0-1.0
          totalWeight: result.total_weight || 0
        };
      }
    } catch (error) {
      // Return cached belief if query fails
      return this.beliefs.get(beliefId) || null;
    }
    return null;
  }
  
  /**
   * Generate a submission value based on strategy
   */
  generateSubmissionValue(beliefId: number): number {
    const belief = this.beliefs.get(beliefId);
    if (!belief) return Math.random();
    
    const rand = Math.random();
    
    if (rand < config.beliefStrategies.contrarian) {
      // Contrarian: Submit opposite of consensus
      return belief.aggregate > 0.5 ? Math.random() * 0.3 : 0.7 + Math.random() * 0.3;
    } else if (rand < config.beliefStrategies.contrarian + config.beliefStrategies.follower) {
      // Follower: Submit near consensus
      const variance = 0.1;
      return Math.max(0, Math.min(1, belief.aggregate + (Math.random() - 0.5) * variance));
    } else {
      // Random: Submit any value
      return Math.random();
    }
  }
  
  getAllBeliefs(): Belief[] {
    return Array.from(this.beliefs.values());
  }
}

export default SimpleBeliefManager;
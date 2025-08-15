#!/usr/bin/env node
/**
 * Simple HTTP client for Veritas simulation
 * Uses direct REST API calls instead of SDK
 */

import axios from 'axios';
import chalk from 'chalk';

export class SimpleRollupClient {
  private baseUrl: string;
  
  constructor(url: string) {
    this.baseUrl = url;
    console.log(chalk.gray(`Initialized client for ${url}`));
  }
  
  /**
   * Submit a transaction to the rollup
   */
  async submitTransaction(tx: any): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/transactions`, tx);
      return response.data;
    } catch (error: any) {
      console.error(chalk.red('Transaction failed:'), error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Query module state
   */
  async queryState(module: string, path: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/modules/${module}/state/${path}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error(chalk.red('Query failed:'), error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Check if rollup is running
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to query a module endpoint instead of /health
      await axios.get(`${this.baseUrl}/modules`);
      return true;
    } catch {
      return false;
    }
  }
}

// Transaction builders for Veritas modules
export class VeritasTransactions {
  
  static registerAgent(address: string, initialStake: number) {
    return {
      from: address,
      data: {
        veritas_agent: {
          register_agent: {
            initial_stake: initialStake
          }
        }
      }
    };
  }
  
  static addStake(address: string, amount: number) {
    return {
      from: address,
      data: {
        veritas_agent: {
          add_stake: {
            amount: amount
          }
        }
      }
    };
  }
  
  static submitBelief(address: string, beliefId: number, value: number) {
    // Value should be 0-100 (percentage)
    return {
      from: address,
      data: {
        veritas_submission: {
          submit_belief: {
            belief_id: beliefId,
            value: Math.round(value * 100) // Convert 0.0-1.0 to 0-100
          }
        }
      }
    };
  }
}

export default SimpleRollupClient;
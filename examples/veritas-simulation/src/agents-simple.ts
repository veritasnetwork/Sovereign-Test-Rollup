/**
 * Simplified agent management for Veritas simulation
 */

import { Wallet } from 'ethers';
import chalk from 'chalk';
import { config } from './config.js';
import { RuntimeCall } from "./types";
import { Secp256k1Signer } from "@sovereign-sdk/signers";
import { Agent } from "./local-types";

export { Agent };

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

    try {
      // Access the rollup instance directly for queries
      const rollup = this.rollupClient;
      const existingAgent = await rollup.http.get(`/modules/veritas-agent/state/agents/items/${agent.address}`);
      if (existingAgent) {
        console.log(chalk.yellow(`Agent ${agent.address} already registered, skipping registration`));
        agent.stake = existingAgent.value.stake;
        agent.score = existingAgent.value.score;
        console.log("UPDATED AGENT: ", agent)
        this.agents.set(agent.address, agent);
        return;
      }
    } catch (error: any) {
      // Agent doesn't exist, proceed with registration
      console.log(chalk.gray(`Agent ${agent.address} not found on-chain, proceeding with registration`));
      if (error.message) {
        console.log(chalk.gray(`Query check: ${error.message}`));
      }
    }

    // Register the agent if not already registered
    try {
      const signer = new Secp256k1Signer(privateKey);
      const callMessage: RuntimeCall = {
        veritas_agent: {
          register_agent: {
            initial_stake: agent.stake,
          }
        }
      };
      await this.rollupClient.call(callMessage, { signer });

      this.agents.set(agent.address, agent);
      console.log(chalk.green(`✅ Registered funded agent ${agent.address}`));
    } catch (error: any) {
      console.log(chalk.red(`❌ Failed to register agent ${agent.address}`));
      console.log(chalk.red(`Error: ${error}`));
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
        const signer = new Secp256k1Signer(agent.privateKey);
        const callMessage: RuntimeCall = {
          veritas_agent: {
            register_agent: {
              initial_stake: agent.stake
            }
          }
        };
        await this.rollupClient.call(callMessage, { signer });

        this.agents.set(agent.address, agent);
        newAgents.push(agent);
        console.log(chalk.green(`✅ Registered agent ${agent.address}`));
      } catch (error: any) {
        console.log(chalk.red(`❌ Failed to register agent ${agent.address}`));
        console.log(chalk.red(`Error: ${error.message || error}`));

        // Print full error details
        if (error.response?.data) {
          console.log(chalk.red(`Response: ${JSON.stringify(error.response.data, null, 2)}`));
        } else if (error.cause) {
          console.log(chalk.red(`Cause: ${JSON.stringify(error.cause, null, 2)}`));
        } else {
          console.log(chalk.red(`Full error: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`));
        }
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
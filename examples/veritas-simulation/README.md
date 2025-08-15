# Veritas Simulation

An automated simulation system for demonstrating the Veritas belief aggregation protocol on Sovereign SDK.

## Overview

This simulation creates a living demonstration of decentralized belief aggregation by:
- Automatically creating agents with random stakes
- Having agents submit predictions to various beliefs
- Showing real-time consensus convergence
- Tracking reputation scores and weights
- Visualizing the entire process in a dashboard

## Prerequisites

1. **Running Rollup**: The Sovereign SDK rollup must be running with Veritas modules
2. **Node.js**: Version 20.0 or later
3. **Initial Setup**: Genesis must include initial beliefs and at least one funded agent

## Installation

```bash
cd examples/veritas-simulation
npm install
```

## Running the Simulation

### Step 1: Start the Rollup

In terminal 1, start the rollup:

```bash
# From the root of the repository
cargo run --release
```

Wait for the rollup to fully start (you'll see "REST server listening on...")

### Step 2: Run the Simulation

In terminal 2, start the simulation:

```bash
cd examples/veritas-simulation
npm run simulate
```

## What the Simulation Does

### Phase 1: Initialization
1. Connects to the rollup at `http://localhost:12346`
2. Discovers beliefs from genesis configuration
3. Initializes a funded agent (from private key in config)
4. Sets up monitoring dashboard

### Phase 2: Continuous Simulation (Every 30 seconds)
1. **Agent Creation**: Creates 1-3 new agents with random stakes (100-5000 tokens)
2. **Belief Submissions**: Each agent submits predictions to 1-3 random beliefs
3. **Strategy Selection**: Agents use different strategies:
   - **Contrarian (10%)**: Submit opposite of consensus
   - **Follower (60%)**: Submit near current consensus
   - **Random (30%)**: Submit completely random values
4. **Dashboard Update**: Shows real-time statistics and convergence

## Dashboard Features

The simulation displays:

```
╔═══════════════════════════════════════════════════════════════╗
║          VERITAS BELIEF AGGREGATION SIMULATION               ║
╚═══════════════════════════════════════════════════════════════╝

SUMMARY STATISTICS:
- Total Agents
- Total Submissions  
- Active Beliefs
- Average Convergence

BELIEF CONVERGENCE:
[#] Question                    Aggregate  Change  Submissions  Volatility
[1] "Will ETH exceed $5000?"    72.3%     ↑0.3%   145         ████░░░░░░
[2] "Will BTC hit $100k?"       61.2%     ↓0.2%   132         ██░░░░░░░░

TOP AGENTS (by weight):
Address         Stake   Score   Weight      Submissions
0x1234...       2000    105     210,000     23
0x5678...       1500    102     153,000     18

RECENT ACTIVITY:
• Agent 0x1234... submitted 75.0% to Belief #1
• New agent 0x9abc... joined with stake 1200
```

## Configuration

Edit `src/config.ts` to customize:

```typescript
{
  simulationSpeed: 30000,        // MS between rounds
  agentsPerRound: { min: 1, max: 3 },
  submissionsPerAgent: { min: 1, max: 3 },
  stakeRange: { min: 100, max: 5000 },
  beliefStrategies: {
    contrarian: 0.1,    // 10% contrarian
    follower: 0.6,      // 60% followers
    random: 0.3         // 30% random
  }
}
```

## Querying the Blockchain

While the simulation runs, you can manually query the blockchain:

### Get Agent Information
```bash
curl http://localhost:12346/modules/veritas-agent/state/agents/0xADDRESS
```

### Get Belief State
```bash
curl http://localhost:12346/modules/veritas-belief/state/beliefs/1
```

### View Swagger UI
Open in browser: `http://localhost:12346/swagger-ui/`

## Understanding the Results

### Convergence Patterns
- **Fast Convergence**: When most agents follow consensus
- **Slow Convergence**: When contrarians are active
- **Volatility**: Shown as colored bars (green=stable, red=volatile)

### Weight Dynamics
- Agents with higher stakes have more influence
- Accurate predictions increase scores over time
- Weight = Stake × Score

### Reputation Evolution
- Agents closer to final consensus earn higher scores
- Scores compound over time, rewarding consistent accuracy

## Troubleshooting

### "Connection refused" error
- Ensure the rollup is running on port 12346
- Check `config.ts` for correct rollupUrl

### "Agent registration failed"
- Agent might need tokens for gas
- Check genesis.json for funded accounts

### No belief updates
- Ensure beliefs are initialized in genesis
- Check that agents have sufficient weight

## Advanced Usage

### Export Data
The simulation data can be exported for analysis:

```javascript
// Add to monitor.ts
exportToCSV(stats, 'simulation-data.csv');
```

### Custom Strategies
Add new submission strategies in `beliefs.ts`:

```javascript
case 'momentum':
  // Follow the trend direction
  return currentAggregate + (currentAggregate - previousAggregate) * 2;
```

## Architecture

```
simulation/
├── agents.ts       # Agent creation and management
├── beliefs.ts      # Belief queries and submissions
├── monitor.ts      # Dashboard and visualization
├── config.ts       # Configuration parameters
├── types.ts        # TypeScript type definitions
└── index.ts        # Main simulation loop
```

## Next Steps

1. **Analyze Convergence**: Study how different parameters affect convergence speed
2. **Test Edge Cases**: Try extreme stake distributions or strategy mixes
3. **Add Features**: Implement delegation, meta-beliefs, or temporal dynamics
4. **Export Metrics**: Build analytics on submission patterns

## Notes

- The simulation uses mock agents (not real users)
- Gas fees are handled by the paymaster in default configuration
- Belief creation via transaction is not implemented (uses genesis beliefs)
- Score updates are simulated locally (not yet on-chain)

This simulation demonstrates the core mechanics of weighted belief aggregation and how decentralized consensus emerges from individual predictions!
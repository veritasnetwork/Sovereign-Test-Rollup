/**
 * Monitoring and visualization for Veritas simulation
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { SimulationStats, BeliefStats, Agent } from './types.js';

export class Monitor {
  private recentActivity: string[] = [];
  private maxRecentActivity = 10;
  
  /**
   * Clear the console
   */
  clearScreen(): void {
    console.clear();
    process.stdout.write('\x1B[2J\x1B[0f');
  }
  
  /**
   * Display the main dashboard
   */
  displayDashboard(stats: SimulationStats, beliefs: BeliefStats[], agents: Agent[]): void {
    this.clearScreen();
    
    // Header
    console.log(chalk.cyan.bold('\n╔═══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║          VERITAS BELIEF AGGREGATION SIMULATION                ║'));
    console.log(chalk.cyan.bold('╚═══════════════════════════════════════════════════════════════╝\n'));
    
    // Summary stats
    this.displaySummary(stats);
    
    // Belief convergence table
    this.displayBeliefTable(beliefs);
    
    // Top agents
    this.displayTopAgents(agents);
    
    // Recent activity
    this.displayRecentActivity();
    
    // Footer
    const runtime = this.formatRuntime(stats.startTime);
    console.log(chalk.gray(`\n⏱️  Running for: ${runtime} | Round: ${stats.roundsCompleted}`));
    console.log(chalk.gray('Press Ctrl+C to stop simulation\n'));
  }
  
  /**
   * Display summary statistics
   */
  private displaySummary(stats: SimulationStats): void {
    const summaryTable = new Table({
      head: [
        chalk.white('Total Agents'),
        chalk.white('Total Submissions'),
        chalk.white('Active Beliefs'),
        chalk.white('Avg Convergence')
      ],
      colWidths: [15, 20, 15, 18],
      style: { head: [], border: [] }
    });
    
    const avgConvergence = this.calculateAverageConvergence(Array.from(stats.beliefs.values()));
    
    summaryTable.push([
      chalk.yellow(stats.totalAgents.toString()),
      chalk.yellow(stats.totalSubmissions.toString()),
      chalk.yellow(stats.beliefs.size.toString()),
      this.formatConvergence(avgConvergence)
    ]);
    
    console.log(summaryTable.toString());
  }
  
  /**
   * Display belief convergence table
   */
  private displayBeliefTable(beliefs: BeliefStats[]): void {
    console.log(chalk.white.bold('\n📊 BELIEF CONVERGENCE:\n'));
    
    const table = new Table({
      head: [
        chalk.white('#'),
        chalk.white('Question'),
        chalk.white('Aggregate'),
        chalk.white('Change'),
        chalk.white('Submissions'),
        chalk.white('Volatility')
      ],
      colWidths: [5, 35, 12, 10, 13, 12],
      style: { head: [], border: [] }
    });
    
    beliefs.forEach(belief => {
      const change = belief.currentAggregate - belief.previousAggregate;
      const changeStr = this.formatChange(change);
      const volatilityBar = this.createVolatilityBar(belief.volatility);
      
      table.push([
        chalk.cyan(belief.beliefId.toString()),
        chalk.white(this.truncate(belief.question, 33)),
        chalk.yellow((belief.currentAggregate * 100).toFixed(1) + '%'),
        changeStr,
        chalk.gray(belief.totalSubmissions.toString()),
        volatilityBar
      ]);
    });
    
    console.log(table.toString());
  }
  
  /**
   * Display top agents by weight
   */
  private displayTopAgents(agents: Agent[]): void {
    console.log(chalk.white.bold('\n👥 TOP AGENTS (by weight):\n'));
    
    const table = new Table({
      head: [
        chalk.white('Address'),
        chalk.white('Stake'),
        chalk.white('Score'),
        chalk.white('Weight'),
        chalk.white('Submissions')
      ],
      colWidths: [15, 10, 10, 12, 13],
      style: { head: [], border: [] }
    });
    
    // Sort agents by weight and take top 5
    const sortedAgents = agents
      .sort((a, b) => (b.stake * b.score) - (a.stake * a.score))
      .slice(0, 5);
    
    sortedAgents.forEach(agent => {
      const weight = agent.stake * agent.score;
      table.push([
        chalk.cyan(agent.address.slice(0, 10) + '...'),
        chalk.white(agent.stake.toString()),
        chalk.white(agent.score.toString()),
        chalk.yellow(weight.toLocaleString()),
        chalk.gray(agent.submissions.toString())
      ]);
    });
    
    console.log(table.toString());
  }
  
  /**
   * Display recent activity
   */
  private displayRecentActivity(): void {
    if (this.recentActivity.length === 0) return;
    
    console.log(chalk.white.bold('\n📝 RECENT ACTIVITY:\n'));
    
    this.recentActivity.slice(-5).forEach(activity => {
      console.log(chalk.gray('  • ' + activity));
    });
  }
  
  /**
   * Add activity to the log
   */
  addActivity(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.recentActivity.push(`[${timestamp}] ${message}`);
    
    // Keep only recent activities
    if (this.recentActivity.length > this.maxRecentActivity) {
      this.recentActivity.shift();
    }
  }
  
  /**
   * Format change with arrow indicator
   */
  private formatChange(change: number): string {
    const absChange = Math.abs(change * 100);
    const changeStr = absChange.toFixed(2) + '%';
    
    if (change > 0.001) {
      return chalk.green('↑ ' + changeStr);
    } else if (change < -0.001) {
      return chalk.red('↓ ' + changeStr);
    } else {
      return chalk.gray('→ ' + changeStr);
    }
  }
  
  /**
   * Create a visual volatility bar
   */
  private createVolatilityBar(volatility: number): string {
    const barLength = 10;
    const filled = Math.round(volatility * barLength * 10); // Scale volatility
    const bar = '█'.repeat(Math.min(filled, barLength)) + '░'.repeat(Math.max(0, barLength - filled));
    
    if (volatility > 0.1) {
      return chalk.red(bar);
    } else if (volatility > 0.05) {
      return chalk.yellow(bar);
    } else {
      return chalk.green(bar);
    }
  }
  
  /**
   * Format convergence rate
   */
  private formatConvergence(rate: number): string {
    if (rate < 0) {
      return chalk.green('Converging');
    } else if (rate > 0) {
      return chalk.red('Diverging');
    } else {
      return chalk.yellow('Stable');
    }
  }
  
  /**
   * Calculate average convergence
   */
  private calculateAverageConvergence(beliefs: BeliefStats[]): number {
    if (beliefs.length === 0) return 0;
    
    const sum = beliefs.reduce((acc, b) => acc + b.convergenceRate, 0);
    return sum / beliefs.length;
  }
  
  /**
   * Format runtime duration
   */
  private formatRuntime(startTime: Date): string {
    const now = new Date();
    const diff = now.getTime() - startTime.getTime();
    
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }
  
  /**
   * Truncate string to fit in table
   */
  private truncate(str: string, length: number): string {
    if (str.length <= length) return str;
    return str.slice(0, length - 3) + '...';
  }
  
  /**
   * Display simple progress message
   */
  displayProgress(message: string): void {
    console.log(chalk.cyan('ℹ️  ' + message));
  }
  
  /**
   * Display error message
   */
  displayError(message: string): void {
    console.log(chalk.red('❌ ' + message));
  }
  
  /**
   * Display success message
   */
  displaySuccess(message: string): void {
    console.log(chalk.green('✅ ' + message));
  }
}
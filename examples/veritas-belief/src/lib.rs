//! BeliefModule - Manages prediction markets/beliefs in the Veritas system
//!
//! FILE PURPOSE:
//! This is the second of three core modules implementing Veritas.
//! It manages the prediction markets (beliefs) that agents submit predictions to.
//!
//! ARCHITECTURE ROLE:
//! - Stores the questions and current consensus values
//! - Implements the weighted average aggregation formula
//! - Called by SubmissionModule to update aggregates
//! - Does NOT expose public transactions (internal use only)
//!
//! CHANGES MADE:
//! - Created from scratch following spec
//! - Implements weighted average: new = (old × old_weight + new × new_weight) / total
//! - Genesis loads initial beliefs from config
//! - CallMessage only has NoOp (update_aggregate is internal)
//! - REFACTORED: Using u64 fixed-point math (scale 10000) instead of f64 for determinism
//!
//! This module handles:
//! - Storage of beliefs (questions about future events)
//! - Tracking aggregate consensus values
//! - Weighted average calculations for belief updates
//! - Submission counting
//!
//! Each belief represents a prediction market where agents submit
//! their probability estimates (0.0 to 1.0) for an event occurring

#![allow(unused_imports)]
use anyhow::{bail, Result};
use schemars::JsonSchema;
use sov_modules_api::macros::{serialize, UniversalWallet};
use sov_modules_api::{
    Context, Module, ModuleId, ModuleInfo, ModuleRestApi, Spec,
    StateMap, StateValue, TxState,
};
use std::marker::PhantomData;

/// Type alias for belief identifiers
/// Using u64 allows for up to 18 quintillion unique beliefs
pub type BeliefId = u64;

/// Fixed-point scale for probability values
/// We use 10000 to represent 1.0 (100% probability)
/// This gives us 4 decimal places of precision
/// Examples: 5000 = 0.5000, 7525 = 0.7525, 10000 = 1.0000
pub const SCALE: u64 = 10000;

/// Belief represents a prediction market/question
/// Agents submit probability estimates which are aggregated into consensus
#[derive(Clone, Debug, borsh::BorshSerialize, borsh::BorshDeserialize, serde::Serialize, serde::Deserialize, JsonSchema)]
pub struct Belief {
    /// Unique identifier for this belief
    pub id: BeliefId,
    
    /// The question being predicted (e.g., "Will ETH exceed $5000 by Dec 2024?")
    pub question: String,
    
    /// Current weighted average of all submissions (0 to 10000)
    /// This represents the collective probability estimate
    /// 10000 = 100% probability, 5000 = 50%, 0 = 0%
    pub aggregate: u64,
    
    /// Sum of all weights that have contributed to this belief
    /// Used in weighted average calculations
    pub total_weight: u64,
}

#[derive(Clone, Debug, borsh::BorshSerialize, borsh::BorshDeserialize, serde::Serialize, serde::Deserialize, JsonSchema)]
pub struct BeliefState {
    pub id: BeliefId,
    pub question: String,
    pub aggregate: u64,  // Fixed-point: 0-10000 representing 0.0-1.0
    pub total_weight: u64,
    pub submission_count: u64,
}

/// BeliefModule manages all prediction markets in the system
/// 
/// State storage:
/// - beliefs: All active prediction markets
/// - next_belief_id: Counter for generating unique IDs
/// - submission_counts: Track how many predictions each belief received
#[derive(Clone, ModuleInfo, ModuleRestApi)]
pub struct BeliefModule<S: Spec> {
    /// Module identifier required by Sovereign SDK
    #[id]
    pub id: ModuleId,

    /// StateMap storing all beliefs indexed by their ID
    /// Allows O(1) lookup of any belief
    #[state]
    pub beliefs: StateMap<BeliefId, Belief>,

    /// Counter for generating sequential belief IDs
    /// StateValue stores a single value (not a map)
    #[state]
    pub next_belief_id: StateValue<u64>,

    /// Tracks how many submissions each belief has received
    /// Useful for analytics and participation metrics
    #[state]
    pub submission_counts: StateMap<BeliefId, u64>,

    #[phantom]
    pub phantom: PhantomData<S>,
}

impl<S: Spec> Module for BeliefModule<S> {
    type Spec = S;
    type Config = GenesisConfig;
    type CallMessage = CallMessage;
    type Event = ();

    /// Initialize the module's state from genesis configuration
    fn genesis(
        &mut self,
        _header: &<S::Da as sov_modules_api::DaSpec>::BlockHeader,
        config: &Self::Config,
        state: &mut impl sov_modules_api::GenesisState<S>,
    ) -> Result<()> {
        // Initialize beliefs from genesis config
        for belief in &config.initial_beliefs {
            self.beliefs.set(&belief.id, belief, state)?;
            self.submission_counts.set(&belief.id, &0, state)?;
            
            // Update next_belief_id to be higher than any initial belief
            let next_id = self.next_belief_id.get(state)?.unwrap_or(1);
            if belief.id >= next_id {
                self.next_belief_id.set(&(belief.id + 1), state)?;
            }
        }
        Ok(())
    }

    fn call(
        &mut self,
        msg: Self::CallMessage,
        _context: &Context<Self::Spec>,
        _state: &mut impl TxState<S>,
    ) -> Result<()> {
        match msg {
            CallMessage::NoOp => Ok(()), // Do nothing
        }
    }
}

#[derive(Clone, Debug, borsh::BorshSerialize, borsh::BorshDeserialize, serde::Serialize, serde::Deserialize, JsonSchema)]
pub struct GenesisConfig {
    pub initial_beliefs: Vec<Belief>,
}

impl<S: Spec> BeliefModule<S> {
    /// Creates a new belief (prediction market) with an initial probability
    /// 
    /// This would typically be called by an admin or through governance
    /// to create new prediction markets for agents to participate in
    /// 
    /// Parameters:
    /// - question: The event to predict
    /// - initial_value: Starting probability (0 to 10000, representing 0.0 to 1.0)
    /// 
    /// Returns: The ID of the newly created belief
    pub fn create_belief(
        &mut self,
        question: String,
        initial_value: u64,
        state: &mut impl TxState<S>,
    ) -> Result<BeliefId> {
        // Validate probability is in valid range
        if initial_value > SCALE {
            bail!("Initial value must be between 0 and {}", SCALE);
        }

        if question.is_empty() {
            bail!("Question cannot be empty");
        }

        // Get next available ID, starting from 1 if this is the first belief
        // StateValue.get returns Result<Option<T>>
        let current_id = self.next_belief_id.get(state)?.unwrap_or(1);
        
        let belief = Belief {
            id: current_id,
            question: question.clone(),
            aggregate: initial_value,
            total_weight: 0,  // No submissions yet
        };

        // Store the belief and initialize submission count
        self.beliefs.set(&current_id, &belief, state)?;
        self.submission_counts.set(&current_id, &0, state)?;
        
        // Increment ID counter for next belief
        self.next_belief_id.set(&(current_id + 1), state)?;

        Ok(current_id)
    }

    /// Updates a belief's aggregate value with a new weighted submission
    /// 
    /// This implements the core weighted average aggregation mechanism:
    /// new_aggregate = (old_aggregate × old_weight + new_value × new_weight) / total_weight
    /// 
    /// This method is called by SubmissionModule when an agent submits a prediction
    /// The weight parameter comes from the agent's stake × score
    /// 
    /// Parameters:
    /// - belief_id: Which belief to update
    /// - value: The probability estimate (0 to 10000, representing 0.0 to 1.0)
    /// - weight: The agent's weight (stake × score)
    /// 
    /// Returns: The new aggregate value after update
    pub fn update_aggregate(
        &mut self,
        belief_id: BeliefId,
        value: u64,
        weight: u64,
        state: &mut impl TxState<S>,
    ) -> Result<u64> {
        if value > SCALE {
            bail!("Value must be between 0 and {}", SCALE);
        }

        // Fetch the belief, error if it doesn't exist
        let mut belief = self.beliefs.get(&belief_id, state)?
            .ok_or_else(|| anyhow::anyhow!("Belief not found"))?;
        
        // WEIGHTED AVERAGE CALCULATION:
        // This is the heart of the consensus mechanism
        // Agents with higher weight (stake × score) have more influence
        // Using integer math to ensure determinism across all nodes
        let old_total_weight = belief.total_weight;
        let new_total_weight = old_total_weight.saturating_add(weight);
        
        if new_total_weight > 0 {
            // Fixed-point weighted average formula
            // We use u128 for intermediate calculations to prevent overflow
            let old_contribution = (belief.aggregate as u128) * (old_total_weight as u128);
            let new_contribution = (value as u128) * (weight as u128);
            let total_contribution = old_contribution + new_contribution;
            
            // Divide and convert back to u64
            belief.aggregate = (total_contribution / (new_total_weight as u128)) as u64;
        } else {
            // Edge case: first submission
            belief.aggregate = value;
        }
        
        // Update total weight (using saturating_add to prevent overflow)
        belief.total_weight = belief.total_weight.saturating_add(weight);
        
        // Persist updated belief
        self.beliefs.set(&belief_id, &belief, state)?;
        
        // Track submission count for analytics
        let count = self.submission_counts.get(&belief_id, state)?.unwrap_or(0);
        self.submission_counts.set(&belief_id, &(count + 1), state)?;

        Ok(belief.aggregate)
    }

    pub fn get_belief_state(&self, belief_id: BeliefId, state: &mut impl TxState<S>) -> Result<BeliefState> {
        let belief = self.beliefs.get(&belief_id, state)?
            .ok_or_else(|| anyhow::anyhow!("Belief not found"))?;
        let submission_count = self.submission_counts.get(&belief_id, state)?
            .unwrap_or(0);
        
        Ok(BeliefState {
            id: belief.id,
            question: belief.question,
            aggregate: belief.aggregate,
            total_weight: belief.total_weight,
            submission_count,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, JsonSchema, UniversalWallet)]
#[serialize(Borsh, Serde)]
#[serde(rename_all = "snake_case")]
pub enum CallMessage {
    // Dummy variant to satisfy the compiler - this module doesn't expose public methods
    // The update_aggregate method is called by SubmissionModule directly as an internal method
    NoOp,
}


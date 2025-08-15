//! SubmissionModule - Orchestrates belief submissions and scoring
//!
//! FILE PURPOSE:
//! This is the ORCHESTRATOR module - the third and most complex module.
//! It's the main entry point for user interactions with the Veritas system.
//!
//! ARCHITECTURE ROLE:
//! - Accepts belief submissions from agents
//! - Coordinates between AgentModule and BeliefModule
//! - Implements the transaction flow from spec section "Internal Execution Flow"
//! - Demonstrates cross-module communication pattern
//!
//! CHANGES MADE:
//! - Created from scratch as the orchestration layer
//! - Uses #[module] attributes to reference other modules
//! - Implements cross-module calls via internal methods (not CallMessage)
//! - Records all submissions for historical analysis
//! - REFACTORED: Using u64 fixed-point math (scale 10000) instead of f64 for determinism
//!
//! KEY PATTERN:
//! This module shows how Sovereign SDK modules can work together:
//! 1. User calls SubmitBelief on this module
//! 2. This module calls AgentModule.get_weight()
//! 3. This module calls BeliefModule.update_aggregate()
//! 4. Submission is recorded
//!
//! This is the main interaction point for agents. It coordinates:
//! - Accepting agent predictions
//! - Calculating agent weights via AgentModule
//! - Updating belief aggregates via BeliefModule
//! - Computing score rewards based on accuracy
//! - Recording submission history
//!
//! This module demonstrates cross-module communication in Sovereign SDK
//! by referencing and calling methods on other modules

#![allow(unused_imports)]
use anyhow::{bail, Result};
use schemars::JsonSchema;
use sov_modules_api::macros::{serialize, UniversalWallet};
use sov_modules_api::{
    Context, Module, ModuleId, ModuleInfo, ModuleRestApi, Spec,
    StateVec, TxState,
};
use std::marker::PhantomData;
use veritas_belief::{BeliefId, SCALE};

/// Records a single prediction submission
/// Stored for historical analysis and audit purposes
#[derive(Clone, Debug, borsh::BorshSerialize, borsh::BorshDeserialize, JsonSchema)]
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(bound(serialize = "S::Address: serde::Serialize", 
              deserialize = "S::Address: serde::de::DeserializeOwned"))]
pub struct Submission<S: Spec> {
    /// Address of the agent who made this submission
    pub agent: S::Address,
    
    /// Which belief this prediction is for
    pub belief_id: BeliefId,
    
    /// The probability value submitted (0 to 10000, representing 0.0 to 1.0)
    pub value: u64,
    
    /// The agent's weight at time of submission (stake × score)
    pub weight: u64,
    
    /// Block timestamp when submission was made
    /// Currently set to 0 (TODO: get from context)
    pub timestamp: u64,
}

/// SubmissionModule orchestrates the belief submission process
/// 
/// KEY DESIGN: Cross-module references
/// The #[module] attribute allows this module to reference other modules
/// This enables cross-module method calls, demonstrating how modules
/// can work together in Sovereign SDK
#[derive(Clone, ModuleInfo, ModuleRestApi)]
pub struct SubmissionModule<S: Spec> {
    #[id]
    pub id: ModuleId,

    /// StateVec is an append-only list structure
    /// Perfect for storing historical records that don't need updates
    /// All submissions are kept for audit and analysis
    #[state]
    pub submissions: StateVec<Submission<S>>,

    /// Reference to AgentModule for weight calculations.
    /// CRITICAL: The #[module] attribute tells Sovereign SDK this is a module reference.
    /// This is HOW cross-module communication works - we store references to other modules
    /// and call their PUBLIC methods (not CallMessage methods) directly.
    /// This allows calling internal methods like get_weight() that aren't exposed to users.
    #[module]
    pub agent_module: veritas_agent::AgentModule<S>,

    /// Reference to BeliefModule for updating aggregates
    /// Demonstrates module composition pattern
    #[module]
    pub belief_module: veritas_belief::BeliefModule<S>,

    #[phantom]
    pub phantom: PhantomData<S>,
}

impl<S: Spec> Module for SubmissionModule<S> {
    type Spec = S;
    type Config = GenesisConfig<S>;
    type CallMessage = CallMessage;
    type Event = ();

    /// Initialize the module's state from genesis configuration
    fn genesis(
        &mut self,
        _header: &<S::Da as sov_modules_api::DaSpec>::BlockHeader,
        config: &Self::Config,
        state: &mut impl sov_modules_api::GenesisState<S>,
    ) -> Result<()> {
        // Initialize submissions from genesis config (usually empty)
        for submission in &config.initial_submissions {
            self.submissions.push(submission, state)?;
        }
        Ok(())
    }

    /// Entry point for transaction processing
    /// 
    /// NOTE: Value is already in fixed-point format (0-10000)
    /// No conversion needed as we're using u64 throughout for determinism
    fn call(
        &mut self,
        msg: Self::CallMessage,
        context: &Context<Self::Spec>,
        state: &mut impl TxState<S>,
    ) -> Result<()> {
        match msg {
            CallMessage::SubmitBelief { belief_id, value } => {
                // Value is already in fixed-point format (0-10000)
                self.submit_belief(belief_id, value, context, state)
            }
        }
    }
}

#[derive(Clone, Debug, borsh::BorshSerialize, borsh::BorshDeserialize, JsonSchema)]
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(bound(serialize = "S::Address: serde::Serialize",
              deserialize = "S::Address: serde::de::DeserializeOwned"))]
pub struct GenesisConfig<S> 
where
    S: Spec,
    S::Address: serde::Serialize + for<'a> serde::Deserialize<'a>,
{
    pub initial_submissions: Vec<Submission<S>>,
}

impl<S: Spec> SubmissionModule<S> {
    /// Main submission logic - orchestrates the entire prediction process
    /// 
    /// This demonstrates the power of module composition:
    /// 1. Gets agent weight from AgentModule
    /// 2. Updates belief aggregate in BeliefModule
    /// 3. Calculates score rewards
    /// 4. Records submission history
    /// 
    /// FLOW:
    /// 1. Validate input
    /// 2. Get agent's weight (stake × score) via cross-module call
    /// 3. Update belief aggregate via cross-module call
    /// 4. Calculate score bonus based on accuracy
    /// 5. Store submission record
    pub fn submit_belief(
        &mut self,
        belief_id: BeliefId,
        value: u64,
        context: &Context<S>,
        state: &mut impl TxState<S>,
    ) -> Result<()> {
        if value > SCALE {
            bail!("Value must be between 0 and {}", SCALE);
        }

        let sender = context.sender();
        
        // CROSS-MODULE CALL #1: Get agent's weight from AgentModule
        // This demonstrates how modules can call each other's public methods
        let weight = self.agent_module.get_weight(sender, state)?;
        if weight == 0 {
            bail!("Agent has no weight (stake × score = 0)");
        }

        // CROSS-MODULE CALL #2: Update belief aggregate in BeliefModule
        // The new aggregate is returned so we can calculate score rewards
        let new_aggregate = self.belief_module.update_aggregate(belief_id, value, weight, state)?;
        
        // SCORING MECHANISM:
        // Agents are rewarded based on how close their prediction is to consensus
        // Using integer math: distance of 0 = perfect match = 100 point bonus
        // Distance of 5000 (50%) = ~2 point bonus
        let distance = if value > new_aggregate {
            value - new_aggregate
        } else {
            new_aggregate - value
        };
        
        // Score bonus calculation using fixed-point math
        // Max bonus is 100 points for perfect match
        let _score_delta = if distance == 0 {
            100
        } else {
            // Scale down the bonus based on distance
            100u64.saturating_mul(SCALE).saturating_div(SCALE + distance)
        };
        
        // TODO: Currently we can't update scores because update_score is not exposed
        // in AgentModule's CallMessage. In a real implementation, we'd either:
        // 1. Add UpdateScore to CallMessage (but restrict who can call it)
        // 2. Make SubmissionModule a friend module with special access
        // 3. Use a different scoring mechanism
        
        // Record submission for historical tracking
        let submission = Submission {
            agent: sender.clone(),
            belief_id,
            value,
            weight,
            timestamp: 0,  // TODO: Get actual timestamp from context
        };
        
        // StateVec.push appends to the list
        self.submissions.push(&submission, state)?;

        Ok(())
    }

    pub fn get_submissions(
        &self,
        belief_id: BeliefId,
        state: &mut impl TxState<S>,
    ) -> Result<Vec<Submission<S>>> {
        let mut result = Vec::new();
        let len = self.submissions.len(state)?;
        
        for i in 0..len {
            if let Some(submission) = self.submissions.get(i, state)? {
                if submission.belief_id == belief_id {
                    result.push(submission);
                }
            }
        }
        
        Ok(result)
    }

    pub fn get_all_submissions(
        &self,
        state: &mut impl TxState<S>,
    ) -> Result<Vec<Submission<S>>> {
        let mut result = Vec::new();
        let len = self.submissions.len(state)?;
        
        for i in 0..len {
            if let Some(submission) = self.submissions.get(i, state)? {
                result.push(submission);
            }
        }
        
        Ok(result)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, JsonSchema, UniversalWallet)]
#[serialize(Borsh, Serde)]
#[serde(rename_all = "snake_case")]
pub enum CallMessage {
    SubmitBelief { 
        belief_id: BeliefId, 
        value: u64  // Fixed-point value: 0-10000 representing 0.0-1.0
    },
}


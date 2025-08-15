import { createStandardRollup } from "@sovereign-sdk/web3";
import { Secp256k1Signer } from "@sovereign-sdk/signers";
import { computeAddress } from "ethers";

// Type definition for our Veritas runtime calls
interface VeritasRuntimeCall {
  veritas_agent?: {
    register_agent?: { initial_stake: number };
    add_stake?: { amount: number };
  };
  veritas_submission?: {
    submit_belief?: { belief_id: number; value: number };
  };
}

async function main() {
  console.log("🚀 Initializing Veritas transaction test...\n");
  
  // Initialize rollup client
  const rollup = await createStandardRollup({ url: "http://127.0.0.1:12346" });
  console.log("✅ Connected to rollup");
  
  // Use the same private key from genesis that has tokens
  const privKey = "0d87c12ea7c12024b3f70a26d735874608f17c8bce2b48e6fe87389310191264";
  const signer = new Secp256k1Signer(privKey);
  const signerAddress = computeAddress(`0x${privKey}`);
  console.log("📝 Signer address (checksummed):", signerAddress);
  console.log("📝 Signer address (lowercase):", signerAddress.toLowerCase());
  
  // Test 1: Register as an agent
  console.log("\n1️⃣ Registering as agent with 1000 stake...");
  const registerCall: VeritasRuntimeCall = {
    veritas_agent: {
      register_agent: {
        initial_stake: 1000
      }
    }
  };
  
  try {
    const tx1 = await rollup.call(registerCall, { signer });
    console.log("✅ Agent registration successful!");
    console.log("Response:", tx1.response);
  } catch (error: any) {
    console.log("❌ Agent registration failed:", error.message);
    if (error.response) {
      console.log("Error details:", error.response.data || error.response);
    }
    // Agent might already be registered
  }
  
  // Test 2: Submit a belief
  console.log("\n2️⃣ Submitting belief prediction...");
  const submitCall: VeritasRuntimeCall = {
    veritas_submission: {
      submit_belief: {
        belief_id: 1,  // Assuming belief ID 1 exists
        value: 75      // 75% probability (0-100 scale)
      }
    }
  };
  
  try {
    const tx2 = await rollup.call(submitCall, { signer });
    console.log("✅ Belief submission successful!");
    console.log("Response:", tx2.response);
  } catch (error: any) {
    console.log("❌ Belief submission failed:", error.message);
  }
  
  // Test 3: Query agent state
  console.log("\n3️⃣ Querying agent state...");
  try {
    // Try both lowercase and checksummed
    const lowercaseAddr = signerAddress.toLowerCase();
    console.log("Querying address:", lowercaseAddr);
    const response = await fetch(`http://127.0.0.1:12346/modules/veritas-agent/state/agents/${lowercaseAddr}`);
    const agentData = await response.json();
    console.log("Agent state:", agentData);
  } catch (error) {
    console.log("Could not query agent state");
  }
  
  console.log("\n✨ Test complete!");
}

main().catch(console.error);
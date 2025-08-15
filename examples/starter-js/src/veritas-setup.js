import { createStandardRollup } from "@sovereign-sdk/web3";
import { Secp256k1Signer } from "@sovereign-sdk/signers";
import { Wallet } from "ethers";
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function main() {
    console.log("🚀 Setting up Veritas system...\n");
    // Initialize rollup client
    const rollup = await createStandardRollup({ url: "http://127.0.0.1:12346" });
    console.log("✅ Connected to rollup");
    // Use the funded private key
    const fundedPrivKey = "0d87c12ea7c12024b3f70a26d735874608f17c8bce2b48e6fe87389310191264";
    const fundedSigner = new Secp256k1Signer(fundedPrivKey);
    const fundedWallet = new Wallet("0x" + fundedPrivKey);
    console.log("💰 Funded address:", fundedWallet.address.toLowerCase());
    // Generate additional test wallets
    const agents = [];
    for (let i = 0; i < 3; i++) {
        const wallet = Wallet.createRandom();
        agents.push({
            wallet,
            signer: new Secp256k1Signer(wallet.privateKey.slice(2)),
            address: wallet.address.toLowerCase(),
            stake: 100 + Math.floor(Math.random() * 900) // Random stake 100-1000
        });
    }
    console.log("\n📝 Generated test agents:");
    agents.forEach((agent, i) => {
        console.log(`  Agent ${i + 1}: ${agent.address} (stake: ${agent.stake})`);
    });
    // Register the funded account first
    console.log("\n1️⃣ Registering funded account as agent...");
    try {
        const registerFunded = {
            veritas_agent: {
                register_agent: { initial_stake: 1000 }
            }
        };
        const tx = await rollup.call(registerFunded, { signer: fundedSigner });
        console.log("✅ Funded agent registered");
        await sleep(1000);
    }
    catch (error) {
        console.log("⚠️  Funded agent might already be registered");
    }
    // Register other agents
    console.log("\n2️⃣ Registering additional agents...");
    for (const agent of agents) {
        try {
            const registerCall = {
                veritas_agent: {
                    register_agent: { initial_stake: agent.stake }
                }
            };
            await rollup.call(registerCall, { signer: agent.signer });
            console.log(`✅ Registered ${agent.address.slice(0, 10)}... with stake ${agent.stake}`);
            await sleep(500);
        }
        catch (error) {
            console.log(`❌ Failed to register ${agent.address.slice(0, 10)}...`);
        }
    }
    // Try to submit beliefs (assuming belief IDs 1-3 exist in genesis)
    console.log("\n3️⃣ Submitting belief predictions...");
    const beliefIds = [1, 2, 3];
    for (const beliefId of beliefIds) {
        // Funded agent submits
        try {
            const value = Math.floor(30 + Math.random() * 40); // Random 30-70
            const submitCall = {
                veritas_submission: {
                    submit_belief: { belief_id: beliefId, value: value }
                }
            };
            await rollup.call(submitCall, { signer: fundedSigner });
            console.log(`✅ Funded agent submitted ${value}% for belief ${beliefId}`);
            await sleep(500);
        }
        catch (error) {
            console.log(`⚠️  Could not submit to belief ${beliefId} - it might not exist`);
        }
        // Other agents submit
        for (const agent of agents) {
            try {
                const value = Math.floor(20 + Math.random() * 60); // Random 20-80
                const submitCall = {
                    veritas_submission: {
                        submit_belief: { belief_id: beliefId, value: value }
                    }
                };
                await rollup.call(submitCall, { signer: agent.signer });
                console.log(`✅ Agent ${agent.address.slice(0, 10)}... submitted ${value}% for belief ${beliefId}`);
                await sleep(500);
            }
            catch (error) {
                // Skip if belief doesn't exist
            }
        }
    }
    console.log("\n4️⃣ Checking final state...");
    // Query beliefs
    for (const beliefId of beliefIds) {
        try {
            const response = await fetch(`http://127.0.0.1:12346/modules/veritas-belief/state/beliefs/${beliefId}`);
            if (response.ok) {
                const belief = await response.json();
                console.log(`Belief ${beliefId}:`, belief);
            }
        }
        catch (error) {
            // Belief doesn't exist
        }
    }
    console.log("\n✨ Setup complete!");
    console.log("You can now monitor the state with: node monitor.mjs");
}
main().catch(console.error);
